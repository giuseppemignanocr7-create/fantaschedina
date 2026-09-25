// ============================================
// RIGORI DUELLO — 1v1 in tempo reale (o contro il bot)
//
// Ogni round l'attaccante sceglie una delle sei zone della porta e ferma la
// barra di potenza; il portiere sceglie dove tuffarsi. L'esito lo decide il
// server (functions/src/penalty.ts: parata, gol, palo, fuori) e arriva via
// snapshot del documento `penalty_duels/{id}`; qui si anima nell'arena.
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Users, Copy, Loader2, Bot, Swords, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSilentProfileRefresh } from '@/hooks/useSilentProfileRefresh';
import {
  createPenaltyDuelFn,
  joinPenaltyDuelFn,
  createPenaltyDuelBotFn,
  penaltyDuelMoveFn,
  callableErrorMessage,
  type PenaltyDuelState,
  type DuelMode,
} from '@/lib/gameApi';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { vibrate, burstConfetti } from '@/lib/juice';
import { PenaltyArena, type ArenaReveal } from '@/components/games/PenaltyArena';
import { PenaltyPowerMeter } from '@/components/games/PenaltyAimer';
import { OUTCOME_EMOJI, ZONE_META, type PenaltyOutcome, type PenaltyZone } from '@/lib/penalty';
import { COINS } from '@/lib/economy';

type GamePhase = 'menu' | 'create' | 'join' | 'game' | 'finished';

/** Tempo di ogni round: speculare a DUEL_ROUND_MS lato server. */
const ROUND_S = 8;
/** Potenza di un tiro affrettato: mira scelta ma barra non fermata in tempo. */
const TIMEOUT_POWER = 35;
/** Durata della rivelazione: tuffo, volo, impatto, scritta. */
const PENALTY_REVEAL_MS = 2300;

type LastRound = NonNullable<PenaltyDuelState['lastRound']>;

/** Partite iniziate prima del 15/09/2026 hanno ancora le tre direzioni. */
function toZone(v: unknown): PenaltyZone {
  if (v === 'left') return 'BL';
  if (v === 'right') return 'BR';
  if (v === 'center') return 'BC';
  return (v as PenaltyZone) in ZONE_META ? (v as PenaltyZone) : 'BC';
}

function revealOf(r: LastRound): ArenaReveal {
  const shot = toZone(r.shot ?? (r.attacker === 1 ? r.p1Choice : r.p2Choice));
  const keeper = toZone(r.keeper ?? (r.attacker === 1 ? r.p2Choice : r.p1Choice));
  const outcome: PenaltyOutcome = r.outcome ?? (r.goal ? 'goal' : 'saved');
  return { shot, keeper, outcome };
}

interface Tiro {
  round: number;
  attacker: 1 | 2;
  outcome: PenaltyOutcome;
}

export function RigoriDuelPage() {
  const { profile } = useAuthContext();
  const refreshProfile = useSilentProfileRefresh('RigoriDuelPage');
  const [localPhase, setPhase] = useState<GamePhase>('menu');
  const [duelId, setDuelId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [duel, setDuel] = useState<PenaltyDuelState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** Zona toccata nella porta (non ancora inviata se attaccante: manca la potenza). */
  const [zona, setZona] = useState<PenaltyZone | null>(null);
  /** Mossa del round gia' inviata al server. */
  const [inviata, setInviata] = useState(false);
  const [lastAnim, setLastAnim] = useState<LastRound | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [timer, setTimer] = useState(ROUND_S);
  const [copied, setCopied] = useState(false);
  const [tiri, setTiri] = useState<Tiro[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const revealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Ultimo round gia' animato: gli snapshot successivi dello stesso round
  // (cambiano altri campi) non devono rigiocare l'animazione.
  const animatedRoundRef = useRef<number | null>(null);
  const celebratedRef = useRef(false);

  const isP1 = duel?.p1.uid === profile?.id;
  const playerNum: 1 | 2 = isP1 ? 1 : 2;
  const amAttacker = duel?.attacker === playerNum;

  // La fine partita la decide il server: derivata in render, non sincronizzata.
  const phase: GamePhase = duel?.phase === 'finished' ? 'finished' : localPhase;

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (unsubRef.current) unsubRef.current();
    revealTimersRef.current.forEach(clearTimeout);
    revealTimersRef.current = [];
  }, []);

  /** Anima l'esito quando il server pubblica un nuovo round. */
  const playRoundReveal = useCallback((round: LastRound) => {
    if (animatedRoundRef.current === round.round) return;
    animatedRoundRef.current = round.round;

    const esito = revealOf(round).outcome;
    setLastAnim(round);
    setRevealing(true);
    setZona(null);
    setInviata(false);
    setTiri(t => [...t, { round: round.round, attacker: round.attacker, outcome: esito }]);
    vibrate(esito === 'goal' ? [40, 30, 90] : esito === 'saved' ? 50 : 30);

    revealTimersRef.current.forEach(clearTimeout);
    revealTimersRef.current = [];
    if (esito === 'goal') {
      revealTimersRef.current.push(setTimeout(() => burstConfetti({ x: 0.5, y: 0.35 }), 640));
    }
    revealTimersRef.current.push(setTimeout(() => setRevealing(false), PENALTY_REVEAL_MS));
  }, []);

  useEffect(() => cleanup, [cleanup]);

  useEffect(() => {
    if (!duelId) return;
    unsubRef.current?.();
    unsubRef.current = onSnapshot(doc(db, 'penalty_duels', duelId), snap => {
      if (!snap.exists()) return;
      const data = snap.data() as Omit<PenaltyDuelState, 'id'>;
      const next = { id: snap.id, ...data } as PenaltyDuelState;
      setDuel(next);
      if (next.lastRound) playRoundReveal(next.lastRound);
      if (next.phase === 'finished' && !celebratedRef.current) {
        celebratedRef.current = true;
        refreshProfile();
      }
    });
  }, [duelId, playRoundReveal, refreshProfile]);

  const invia = useCallback(
    async (z: PenaltyZone | undefined, power: number | undefined, timeout = false) => {
      if (!duelId) return;
      setInviata(true);
      try {
        await penaltyDuelMoveFn(duelId, z, power, timeout);
      } catch (e) {
        setError(callableErrorMessage(e));
        setInviata(false);
      }
    },
    [duelId]
  );

  const handleTimeout = useCallback(() => {
    if (inviata) return;
    // Mira scelta ma barra non fermata: parte un tiro affrettato su quella
    // zona. Nessuna scelta: il server ne assegna una a caso.
    if (zona) void invia(zona, amAttacker ? TIMEOUT_POWER : 0);
    else void invia(undefined, undefined, true);
  }, [inviata, zona, amAttacker, invia]);

  useEffect(() => {
    if (duel?.phase !== 'playing' || !duel.deadlineAt) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const update = () => {
      const remaining = Math.max(0, Math.ceil((duel.deadlineAt - Date.now()) / 1000));
      setTimer(Math.min(ROUND_S, remaining));
      if (remaining <= 0 && !inviata) handleTimeout();
    };
    update();
    timerRef.current = setInterval(update, 100);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [duel?.round, duel?.phase, duel?.deadlineAt, inviata, handleTimeout]);

  const scegliZona = (z: PenaltyZone) => {
    if (inviata || revealing || duel?.phase !== 'playing') return;
    vibrate(15);
    setZona(z);
    // Il portiere non ha potenza: il tuffo parte subito.
    if (!amAttacker) void invia(z, 0);
  };

  const tira = (power: number) => {
    if (!zona || inviata) return;
    vibrate(25);
    void invia(zona, power);
  };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { duelId: id, code: c } = await createPenaltyDuelFn();
      setDuelId(id);
      setCode(c);
      setPhase('create');
    } catch (e) {
      setError(callableErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inputCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { duelId: id } = await joinPenaltyDuelFn(inputCode.trim());
      setDuelId(id);
      setPhase('game');
    } catch (e) {
      setError(callableErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleBot = async (mode: Exclude<DuelMode, 'human'>) => {
    setLoading(true);
    setError(null);
    try {
      const { duelId: id } = await createPenaltyDuelBotFn(mode);
      setDuelId(id);
      setPhase('game');
    } catch (e) {
      setError(callableErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const ricomincia = () => {
    cleanup();
    animatedRoundRef.current = null;
    celebratedRef.current = false;
    setLastAnim(null);
    setRevealing(false);
    setTiri([]);
    setZona(null);
    setInviata(false);
    setPhase('menu');
    setDuel(null);
    setDuelId(null);
  };

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Sala d'attesa: quando l'avversario entra, il documento passa a "playing".
  if (phase === 'create' && duel?.phase !== 'playing') {
    return (
      <div className="min-h-screen px-4 py-6 max-w-md mx-auto space-y-4">
        <Intestazione titolo="Sala d'attesa" sotto="Rigori Duello · 1 vs 1" />
        <PenaltyArena reveal={null} revealKey="lobby" />
        <div className="paper-card p-6 text-center space-y-4 animate-pop-in">
          <p className="text-slate-500 text-sm">Manda il codice a un amico: appena entra si tira.</p>
          <div className="bg-night rounded-2xl p-5 space-y-2">
            <p className="text-[10px] text-white/50 uppercase tracking-widest">Codice partita</p>
            <div className="font-black text-4xl text-primary-400 tracking-[0.25em]">{code}</div>
            <button
              onClick={copyCode}
              className="flex items-center justify-center gap-2 mx-auto text-xs text-white/60 hover:text-white transition-colors"
            >
              <Copy size={14} /> {copied ? 'Copiato!' : 'Copia codice'}
            </button>
          </div>
          <p className="text-sm text-slate-500 flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> In attesa dell'avversario…
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={ricomincia} className="text-xs text-slate-500 hover:text-slate-900">
            ← Annulla e torna ai minigiochi
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'finished' && duel) {
    const myScore = isP1 ? duel.p1.score : duel.p2.score;
    const oppScore = isP1 ? duel.p2.score : duel.p1.score;
    const oppName = duel.p2.isBot ? 'Bot' : isP1 ? duel.p2.username : duel.p1.username;
    const iWon = duel.winner === playerNum;
    const isDraw = duel.winner === 'draw';
    // Chiusa dalla pulizia perche' ferma da troppo: non e' una sconfitta.
    const isAbandoned = duel.abandoned === true;
    const mieiTiri = tiri.filter(t => t.attacker === playerNum);
    const suoiTiri = tiri.filter(t => t.attacker !== playerNum);
    return (
      <div className="min-h-screen px-4 py-6 max-w-md mx-auto space-y-4">
        <Intestazione titolo="Fine del duello" sotto={duel.mode.startsWith('bot') ? 'Contro il bot' : '1 vs 1'} />
        <PenaltyArena reveal={lastAnim ? revealOf(lastAnim) : null} revealKey={`fine-${lastAnim?.round ?? 0}`} />
        <div className="paper-card p-6 text-center space-y-5 animate-pop-in">
          <div className="text-6xl">{isAbandoned ? '🕒' : iWon ? '🏆' : isDraw ? '🤝' : '😤'}</div>
          <h2 className="font-display font-black text-3xl text-slate-900 uppercase">
            {isAbandoned ? 'Partita abbandonata' : iWon ? 'Hai vinto!' : isDraw ? 'Pareggio!' : 'Hai perso!'}
          </h2>
          {isAbandoned && (
            <p className="text-slate-500 text-sm">Nessuno ha più giocato: la sfida è stata chiusa senza premio.</p>
          )}
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Tu</p>
              <p className="font-black text-5xl text-primary-700">{myScore}</p>
              <PipsTiri tiri={mieiTiri} />
            </div>
            <span className="text-2xl text-slate-300 font-black">–</span>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold truncate max-w-[100px]">{oppName}</p>
              <p className="font-black text-5xl text-red-600">{oppScore}</p>
              <PipsTiri tiri={suoiTiri} />
            </div>
          </div>
          {duel.reward > 0 && (iWon || isDraw) && (
            <div className="bg-gradient-to-r from-yellow-500/15 via-yellow-500/25 to-yellow-500/15 border border-yellow-500/30 rounded-2xl p-4">
              <p className="text-yellow-800/80 text-xs uppercase tracking-widest mb-1">Premio</p>
              <p className="font-black text-4xl text-yellow-700">+{duel.reward} 🪙</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={ricomincia} className="flex-1 btn-green text-sm font-black py-3">
              🔄 Gioca ancora
            </button>
            <Link to="/minigiochi" className="flex items-center justify-center flex-1 btn-secondary text-xs">
              ← Minigiochi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if ((phase === 'game' || phase === 'create') && duel) {
    const myName = isP1 ? duel.p1.username : duel.p2.username;
    const oppName = duel.p2.isBot ? 'Bot' : isP1 ? duel.p2.username : duel.p1.username;
    const myScore = isP1 ? duel.p1.score : duel.p2.score;
    const oppScore = isP1 ? duel.p2.score : duel.p1.score;
    const mieiTiri = tiri.filter(t => t.attacker === playerNum);
    const suoiTiri = tiri.filter(t => t.attacker !== playerNum);
    const picking = revealing ? null : amAttacker ? 'shoot' : 'keep';

    return (
      <div className="min-h-screen">
        {/* Fascia scura: arena e tabellone, come la testata della home */}
        <div className="relative bg-night rounded-b-[28px] shadow-lg shadow-black/25">
          <div
            className="absolute inset-0 rounded-b-[28px] pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(ellipse 70% 90% at 50% -30%, rgba(132,216,12,0.14) 0%, transparent 70%)' }}
          />
          <div className="relative max-w-md mx-auto px-4 pt-3 pb-4 space-y-3">
            <header className="flex items-center justify-between">
              <Link to="/minigiochi" className="p-2 -ml-2 text-white/70 hover:text-white transition-colors" aria-label="Torna ai minigiochi">
                <ArrowLeft size={22} />
              </Link>
              <div className="text-center">
                <p className="font-display font-black text-sm text-white tracking-[0.2em]">RIGORE {duel.round}</p>
                <p className="text-[10px] text-primary-400 uppercase tracking-widest font-bold">
                  {duel.mode.startsWith('bot') ? 'contro il bot' : '1 vs 1 in diretta'}
                </p>
              </div>
              <TimerAnello secondi={timer} />
            </header>

            {/* Tabellone */}
            <div className="paper-card px-3 py-2 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-primary-700 truncate">{myName}</p>
                <PipsTiri tiri={mieiTiri} align="left" />
              </div>
              <div className="flex items-center gap-2 px-2">
                <span className="font-display font-black text-3xl text-slate-900">{myScore}</span>
                <span className="text-slate-300 font-black">:</span>
                <span className="font-display font-black text-3xl text-slate-900">{oppScore}</span>
              </div>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[10px] font-black text-red-600 truncate">{oppName}</p>
                <PipsTiri tiri={suoiTiri} align="right" />
              </div>
            </div>

            <PenaltyArena
              reveal={revealing && lastAnim ? revealOf(lastAnim) : null}
              revealKey={lastAnim?.round ?? 'idle'}
              picking={picking}
              picked={zona}
              disabled={inviata || duel.phase !== 'playing'}
              onPick={scegliZona}
            >
              {!revealing && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest backdrop-blur-sm',
                      amAttacker ? 'bg-primary-500/90 text-night' : 'bg-yellow-400/90 text-night'
                    )}
                  >
                    {amAttacker ? '⚽ Tiri tu' : '🧤 Pari tu'}
                  </span>
                </div>
              )}
            </PenaltyArena>
          </div>
        </div>

        {/* Comandi */}
        <div className="max-w-md mx-auto px-4 py-4 space-y-3">
          {revealing ? (
            <p className="text-center text-sm text-slate-500 font-bold">
              {tiri[tiri.length - 1]?.attacker === playerNum ? 'Il tuo rigore…' : 'Il suo rigore…'}
            </p>
          ) : inviata ? (
            <div className="paper-card p-4 text-center space-y-1 animate-pop-in">
              <p className="text-sm font-black text-slate-900">
                {amAttacker ? '⚽ Tiro partito!' : `🧤 Ti tuffi ${zona ? ZONE_META[zona].label.toLowerCase() : ''}`}
              </p>
              <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                {amAttacker ? 'Il portiere sta scegliendo…' : 'Aspetta il tiro…'}
              </p>
            </div>
          ) : amAttacker ? (
            zona ? (
              <div className="paper-card p-4">
                <PenaltyPowerMeter key={`${duel.round}-${zona}`} zone={zona} onConfirm={tira} onCancel={() => setZona(null)} />
              </div>
            ) : (
              <p className="text-center text-sm text-slate-600 font-bold">
                Tocca un bersaglio nella porta, poi ferma la barra di potenza.
              </p>
            )
          ) : (
            <p className="text-center text-sm text-slate-600 font-bold">
              Dove tirerà? Tocca la zona in cui tuffarti.
            </p>
          )}

          {error && <p className="text-sm text-red-600 text-center animate-shake">{error}</p>}
        </div>
      </div>
    );
  }

  // Menu
  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto space-y-4">
      <Intestazione titolo="Rigori Duello" sotto="Sei zone, una barra di potenza, un portiere vero" />
      <PenaltyArena reveal={null} revealKey="menu">
        <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/70">
            5 rigori a testa · {ROUND_S} secondi a tiro
          </p>
        </div>
      </PenaltyArena>

      {error && <p className="text-sm text-red-600 text-center animate-shake">{error}</p>}

      <div className="paper-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Swords size={16} className="text-primary-700" />
          <p className="font-black text-sm text-slate-900">Sfida un amico</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full btn-green text-sm font-black py-3 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Users size={16} /> CREA PARTITA 1v1
        </button>
        <div className="flex gap-2">
          <input
            value={inputCode}
            onChange={e => setInputCode(e.target.value.toUpperCase())}
            placeholder="CODICE"
            aria-label="Codice partita da unire"
            maxLength={6}
            className="input-field text-center font-black tracking-[0.3em] uppercase"
          />
          <button
            onClick={handleJoin}
            disabled={loading || inputCode.length !== 6}
            className="btn-primary px-4 text-sm font-black disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'ENTRA'}
          </button>
        </div>
      </div>

      <div className="paper-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-primary-700" />
          <p className="font-black text-sm text-slate-900">Allenati contro il bot</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => handleBot('botAttacker')} disabled={loading} className="btn-secondary px-2 py-3 text-[11px] font-black normal-case tracking-normal">
            ⚽ Prima tiri tu
          </button>
          <button onClick={() => handleBot('botKeeper')} disabled={loading} className="btn-secondary px-2 py-3 text-[11px] font-black normal-case tracking-normal">
            🧤 Prima pari tu
          </button>
          <button onClick={() => handleBot('botAlternate')} disabled={loading} className="btn-secondary px-2 py-3 text-[11px] font-black normal-case tracking-normal">
            🔄 Alternati
          </button>
        </div>
        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <Trophy size={12} className="text-yellow-600" />
          {COINS.duelWin} gettoni a vittoria, {COINS.duelDraw} a pareggio, massimo {COINS.duelDailyCap} al giorno.
        </p>
      </div>

      <div className="paper-card p-4 space-y-2">
        <p className="section-title-ink">Come si gioca</p>
        <ul className="text-xs text-slate-600 space-y-1.5">
          <li>🎯 <b>Chi tira</b> tocca una delle sei zone e ferma la barra: nel verde il tiro è preciso e potente.</li>
          <li>🧤 <b>Chi para</b> sceglie dove tuffarsi. Stessa zona: quasi sempre parata. Stesso lato: a volte.</li>
          <li>💨 Un angolo alto tirato male finisce <b>fuori</b> o sul <b>palo</b>. Il centro basso non si sbaglia, ma è il più facile da parare.</li>
        </ul>
      </div>

      <Link to="/minigiochi" className="block text-xs text-slate-500 hover:text-slate-900 text-center">
        ← Torna ai minigiochi
      </Link>
    </div>
  );
}

function Intestazione({ titolo, sotto }: { titolo: string; sotto: string }) {
  return (
    <div className="flex items-center gap-3">
      <Link to="/minigiochi" className="p-2 -ml-2 text-slate-500 hover:text-slate-900 transition-colors" aria-label="Torna ai minigiochi">
        <ArrowLeft size={20} />
      </Link>
      <div>
        <h1 className="page-title">{titolo}</h1>
        <p className="text-[11px] text-slate-500">{sotto}</p>
      </div>
    </div>
  );
}

function TimerAnello({ secondi }: { secondi: number }) {
  const urgente = secondi <= 3;
  return (
    <div className="relative w-11 h-11 flex items-center justify-center" aria-live="polite" aria-label={`${secondi} secondi`}>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15.9"
          fill="none"
          stroke={urgente ? '#ef4444' : '#84d80c'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(secondi / ROUND_S) * 100}, 100`}
          style={{ transition: 'stroke-dasharray 0.2s linear' }}
        />
      </svg>
      <span className={cn('text-sm font-black', urgente ? 'text-red-400 animate-pulse' : 'text-white')}>{secondi}</span>
    </div>
  );
}

function PipsTiri({ tiri, align = 'center' }: { tiri: Tiro[]; align?: 'left' | 'center' | 'right' }) {
  return (
    <div
      className={cn(
        'flex gap-0.5 mt-1 text-[11px] leading-none min-h-[12px]',
        align === 'left' && 'justify-start',
        align === 'center' && 'justify-center',
        align === 'right' && 'justify-end'
      )}
      aria-label="Esiti dei rigori"
    >
      {tiri.map(t => (
        <span key={t.round} title={t.outcome}>
          {OUTCOME_EMOJI[t.outcome]}
        </span>
      ))}
    </div>
  );
}
