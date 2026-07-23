import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Users, Swords, Copy, Loader2, Sparkles, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  createPenaltyDuelFn,
  joinPenaltyDuelFn,
  createPenaltyDuelBotFn,
  penaltyDuelMoveFn,
  callableErrorMessage,
  type PenaltyDuelState,
  type PenaltyTarget,
  type DuelMode,
} from '@/lib/gameApi';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { vibrate, burstConfetti } from '@/lib/juice';

type GamePhase = 'menu' | 'create' | 'join' | 'game' | 'finished';

const TARGETS: { value: PenaltyTarget; label: string; x: number; y: number }[] = [
  { value: 'left', label: 'SINISTRA', x: 20, y: 50 },
  { value: 'center', label: 'CENTRO', x: 50, y: 45 },
  { value: 'right', label: 'DESTRA', x: 80, y: 50 },
];

/* Sequenza fotografica reale del rigore (vedi public/rigori) */
const PENALTY_PHOTO = {
  idle: '/rigori/ref3.jpg', // 1. Preparazione
  shot: '/rigori/ref1.jpg', // 3. Tiro
  dive: '/rigori/ref2.jpg', // 4. Volo del portiere
  save: '/rigori/ref5.jpg', // 6. Esito: Parata
};

export function RigoriDuelPage() {
  const { profile } = useAuthContext();
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [duelId, setDuelId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [duel, setDuel] = useState<PenaltyDuelState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [myChoice, setMyChoice] = useState<PenaltyTarget | null>(null);
  const [lastAnim, setLastAnim] = useState<PenaltyDuelState['lastRound'] | null>(null);
  const [shotAnim, setShotAnim] = useState<'goal' | 'save' | null>(null);
  const [shake, setShake] = useState(false);
  const [timer, setTimer] = useState(5);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const isP1 = duel?.p1.uid === profile?.id;
  const playerNum = isP1 ? 1 : 2;
  const amAttacker = duel?.attacker === playerNum;

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (unsubRef.current) unsubRef.current();
  }, []);

  useEffect(() => cleanup, [cleanup]);

  useEffect(() => {
    if (!duelId) return;
    unsubRef.current?.();
    unsubRef.current = onSnapshot(doc(db, 'penalty_duels', duelId), snap => {
      if (!snap.exists()) return;
      const data = snap.data() as Omit<PenaltyDuelState, 'id'>;
      setDuel({ id: snap.id, ...data } as PenaltyDuelState);
    });
  }, [duelId]);

  const handleTimeout = useCallback(async () => {
    if (!duelId || myChoice !== null) return;
    setMyChoice(randomTarget());
    try {
      await penaltyDuelMoveFn(duelId, undefined, true);
    } catch (e) {
      setError(callableErrorMessage(e));
    }
  }, [duelId, myChoice]);

  useEffect(() => {
    if (duel?.phase !== 'playing' || !duel.deadlineAt) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const update = () => {
      const remaining = Math.max(0, Math.ceil((duel.deadlineAt - Date.now()) / 1000));
      setTimer(remaining);
      if (remaining <= 0 && myChoice === null) {
        handleTimeout();
      }
    };
    update();
    timerRef.current = setInterval(update, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [duel?.round, duel?.phase, duel?.deadlineAt, myChoice, handleTimeout]);

  useEffect(() => {
    if (!duel?.lastRound) return;
    if (lastAnim?.round === duel.lastRound.round) return;
    setLastAnim(duel.lastRound);
    setShotAnim(duel.lastRound.goal ? 'goal' : 'save');
    setShake(true);
    setMyChoice(null);
    vibrate(duel.lastRound.goal ? 80 : 40);
    let confettiTimer: ReturnType<typeof setTimeout> | undefined;
    if (duel.lastRound.goal) {
      confettiTimer = setTimeout(() => burstConfetti(), 650);
    }
    const t = setTimeout(() => {
      setShotAnim(null);
      setShake(false);
    }, 2200);
    return () => { clearTimeout(t); if (confettiTimer) clearTimeout(confettiTimer); };
  }, [duel?.lastRound, lastAnim?.round]);

  const handleChoice = async (target: PenaltyTarget) => {
    if (!duelId || myChoice !== null || shotAnim || duel?.phase !== 'playing') return;
    setMyChoice(target);
    vibrate(20);
    try {
      await penaltyDuelMoveFn(duelId, target);
    } catch (e) {
      setError(callableErrorMessage(e));
      setMyChoice(null);
    }
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

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => {
    if (duel?.phase === 'finished' && phase !== 'finished') {
      setPhase('finished');
      setTimer(0);
    }
  }, [duel?.phase, phase]);

  if (phase === 'create') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/rigori/ref3.jpg')] bg-cover bg-center opacity-15" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background" />
        <div className="glass-card p-8 max-w-sm w-full text-center space-y-5 animate-pop-in relative z-10">
          <div className="text-6xl animate-bounce">⚽</div>
          <h1 className="font-display font-black text-2xl text-white uppercase">Sala d'attesa</h1>
          <p className="text-white/50 text-sm">Condividi il codice con un amico per iniziare il duello</p>
          <div className="bg-white/5 rounded-2xl p-5 space-y-3">
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Codice partita</p>
            <div className="font-black text-4xl text-primary-400 tracking-[0.2em]">{code}</div>
            <button onClick={copyCode} className="flex items-center justify-center gap-2 mx-auto text-xs text-white/60 hover:text-white transition-colors">
              <Copy size={14} /> {copied ? 'Copiato!' : 'Copia codice'}
            </button>
          </div>
          {duel?.p2?.uid ? (
            <p className="text-sm text-green-400 font-bold animate-pulse">Avversario connesso! Partita in corso…</p>
          ) : (
            <p className="text-sm text-white/40">In attesa dell'avversario…</p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Link to="/minigiochi" className="block text-xs text-white/30 hover:text-white/60">← Torna ai minigiochi</Link>
        </div>
      </div>
    );
  }

  if (phase === 'finished' && duel) {
    const iAmP1 = duel.p1.uid === profile?.id;
    const myScore = iAmP1 ? duel.p1.score : duel.p2.score;
    const oppScore = iAmP1 ? duel.p2.score : duel.p1.score;
    const iWon = duel.winner === playerNum;
    const isDraw = duel.winner === 'draw';
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/rigori/ref5.jpg')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background" />
        <div className="glass-card p-8 max-w-sm w-full text-center space-y-5 animate-pop-in relative z-10">
          <div className="text-7xl animate-heartbeat">{iWon ? '🏆' : isDraw ? '🤝' : '😢'}</div>
          <h2 className="font-display font-black text-3xl text-white uppercase">
            {iWon ? 'HAI VINTO!' : isDraw ? 'PAREGGIO!' : 'HAI PERSO!'}
          </h2>
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase">Tu</p>
              <p className="font-black text-4xl text-primary-400">{myScore}</p>
            </div>
            <span className="text-2xl text-white/30 font-black">-</span>
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase">{duel.p2.isBot ? 'Bot' : iAmP1 ? duel.p2.username : duel.p1.username}</p>
              <p className="font-black text-4xl text-red-400">{oppScore}</p>
            </div>
          </div>
          {duel.reward > 0 && (iWon || isDraw) && (
            <div className="bg-gradient-to-r from-yellow-500/15 via-yellow-500/25 to-yellow-500/15 border border-yellow-500/30 rounded-2xl p-5">
              <p className="text-yellow-200/60 text-xs uppercase tracking-widest mb-1">Premio</p>
              <p className="font-black text-4xl text-yellow-400">+{duel.reward} 🪙</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => { cleanup(); setPhase('menu'); setDuel(null); setDuelId(null); }} className="flex-1 btn-green text-sm font-black">🔄 Gioca ancora</button>
            <Link to="/minigiochi" className="flex items-center justify-center flex-1 btn-secondary text-sm">← Minigiochi</Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'game' && duel) {
    const iAmP1 = duel.p1.uid === profile?.id;
    const myName = iAmP1 ? duel.p1.username : duel.p2.username;
    const oppName = iAmP1 ? duel.p2.username : duel.p1.username;
    const myScore = iAmP1 ? duel.p1.score : duel.p2.score;
    const oppScore = iAmP1 ? duel.p2.score : duel.p1.score;
    const showResult = shotAnim !== null;
    const resultMsg = lastAnim ? (lastAnim.goal ? 'GOAL!' : 'PARATA!') : '';

    return (
      <div className={cn('min-h-screen relative overflow-hidden', shake && 'animate-shake')}>
        <div className="absolute inset-0 bg-[url('/rigori/ref3.jpg')] bg-cover bg-center opacity-15" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />

        <div className="relative z-10 min-h-screen flex flex-col px-4 py-6">
          <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
            <header className="flex items-center justify-between mb-6">
              <Link to="/minigiochi" className="p-2 text-white/60 hover:text-white transition-colors -ml-2">
                <ArrowLeft size={22} />
              </Link>
              <div className="text-center">
                <p className="font-black text-sm text-white tracking-widest">TURNO {duel.round}</p>
                <p className="text-[10px] text-primary-400 uppercase tracking-widest font-bold">{duel.mode.startsWith('bot') ? 'VS BOT' : '1 VS 1'}</p>
              </div>
              <div className="w-8" />
            </header>

            {/* Scoreboard */}
            <div className="glass-card p-3 flex items-center justify-between mb-4 shadow-2xl">
              <div className="text-center flex-1">
                <p className="text-[10px] font-black text-primary-400 truncate max-w-[80px] mx-auto">{myName}</p>
                <p className="font-black text-4xl text-primary-400 drop-shadow-[0_0_12px_rgba(132,216,12,0.5)]">{myScore}</p>
              </div>
              <div className="px-3">
                <Swords size={24} className="text-orange-400" />
              </div>
              <div className="text-center flex-1">
                <p className="text-[10px] font-black text-red-400 truncate max-w-[80px] mx-auto">{oppName}</p>
                <p className="font-black text-4xl text-red-400">{oppScore}</p>
              </div>
            </div>

            {/* Role + Timer */}
            <div className="text-center space-y-3 mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/10">
                {amAttacker ? <Zap size={16} className="text-primary-400" /> : <Sparkles size={16} className="text-yellow-400" />}
                <p className={cn('font-black text-sm uppercase tracking-widest', amAttacker ? 'text-primary-400' : 'text-yellow-400')}>
                  {amAttacker ? '⚽ TIRA TU!' : '🧤 PARA TU!'}
                </p>
              </div>

              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path className="text-white/10" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                  <path
                    className={cn(timer <= 2 ? 'text-red-500' : 'text-primary-500')}
                    strokeDasharray={`${(timer / 5) * 100}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    style={{ transition: 'stroke-dasharray 0.2s linear' }}
                  />
                </svg>
                <span className={cn('text-2xl font-black', timer <= 2 ? 'text-red-400 animate-pulse' : 'text-white')}>{timer}</span>
              </div>
            </div>

            {/* Scena rigore: sequenza fotografica reale */}
            <div className="relative flex-1 min-h-[360px] rounded-3xl border-4 border-white/20 overflow-hidden shadow-2xl bg-black">
              {/* Frame idle: preparazione, visibile finché non parte la rivelazione */}
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url('${PENALTY_PHOTO.idle}')`,
                  animation: showResult ? 'penalty-idle-out 2.2s ease forwards' : undefined,
                  opacity: showResult ? undefined : 1,
                }}
              />

              {showResult && lastAnim && (
                <div key={`seq-${lastAnim.round}`} className="absolute inset-0">
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url('${PENALTY_PHOTO.shot}')`, animation: 'penalty-shot-flash 2.2s ease forwards' }}
                  />
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url('${PENALTY_PHOTO.dive}')`,
                      animation: `${lastAnim.goal ? 'penalty-dive-hold-goal' : 'penalty-dive-hold-save'} 2.2s ease forwards`,
                    }}
                  />
                  {!lastAnim.goal && (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url('${PENALTY_PHOTO.save}')`, animation: 'penalty-result-in 2.2s ease forwards' }}
                    />
                  )}
                </div>
              )}

              {/* Mirini di scelta (allineati ai reticoli verdi già presenti nella foto) */}
              {!showResult && TARGETS.map(t => {
                const disabled = myChoice !== null || duel.phase !== 'playing';
                const isSelected = myChoice === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => handleChoice(t.value)}
                    disabled={disabled}
                    aria-label={`Tira a ${t.label.toLowerCase()}`}
                    className={cn(
                      'absolute w-20 h-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 transition-all active:scale-90',
                      isSelected
                        ? 'bg-primary-500/40 border-primary-300 scale-110 shadow-[0_0_30px_rgba(132,216,12,0.6)]'
                        : 'bg-transparent border-transparent hover:bg-primary-500/20 hover:border-primary-300/70 hover:scale-105'
                    )}
                    style={{ left: `${t.x}%`, top: `${t.y}%` }}
                  >
                    <span className="sr-only">{t.label}</span>
                  </button>
                );
              })}

              {showResult && lastAnim && (
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 z-30" style={{ animation: 'penalty-result-in 2.2s ease forwards', opacity: 0 }}>
                  <p className={cn(
                    'font-display font-black text-4xl uppercase tracking-widest drop-shadow-2xl px-4 py-1 rounded-xl',
                    lastAnim.goal ? 'text-primary-300 bg-black/40' : 'text-red-400 bg-black/40'
                  )}>
                    {resultMsg}
                  </p>
                </div>
              )}
            </div>

            {/* Instruction */}
            <p className="text-center text-sm text-white/70 font-bold mt-5">
              {amAttacker ? 'Scegli dove spiazzare il portiere' : 'Indovina dove tirerà l\'avversario'}
            </p>

            {error && <p className="text-sm text-red-400 text-center mt-3 animate-shake">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Menu
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/rigori/ref4.jpg')] bg-cover bg-center opacity-15" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/95 to-background" />
      <div className="glass-card p-8 max-w-sm w-full space-y-5 animate-pop-in relative z-10">
        <div className="text-center space-y-2">
          <div className="text-6xl animate-bounce">⚽</div>
          <h1 className="font-display font-black text-3xl text-white uppercase">Rigori Duello</h1>
          <p className="text-white/50 text-sm">3 mirini. 5 secondi. 5 rigori. Vince il più freddo.</p>
        </div>
        {error && <p className="text-sm text-red-400 text-center animate-shake">{error}</p>}
        <div className="space-y-3">
          <button onClick={handleCreate} disabled={loading} className="w-full btn-green text-sm font-black flex items-center justify-center gap-2"><Users size={16} /> CREA PARTITA 1v1</button>
          <div className="flex gap-2">
            <input value={inputCode} onChange={e => setInputCode(e.target.value.toUpperCase())} placeholder="CODICE" aria-label="Codice partita da unire" maxLength={6} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center font-black text-white tracking-widest uppercase focus:outline-none focus:border-primary-500" />
            <button onClick={handleJoin} disabled={loading || inputCode.length !== 6} className="btn-primary px-4 text-sm font-black">{loading ? <Loader2 size={16} className="animate-spin" /> : 'ENTRA'}</button>
          </div>
          <div className="h-px bg-white/10" />
          <p className="text-[10px] text-white/40 uppercase tracking-widest text-center font-bold">Gioca contro il Bot</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => handleBot('botAttacker')} className="btn-secondary text-xs font-black py-3">⚽ Attaccante</button>
            <button onClick={() => handleBot('botKeeper')} className="btn-secondary text-xs font-black py-3">🧤 Portiere</button>
            <button onClick={() => handleBot('botAlternate')} className="btn-secondary text-xs font-black py-3">🔄 Alterna</button>
          </div>
        </div>
        <Link to="/minigiochi" className="block text-xs text-white/30 hover:text-white/60 text-center">← Torna ai minigiochi</Link>
      </div>
    </div>
  );
}

function randomTarget(): PenaltyTarget {
  const t: PenaltyTarget[] = ['left', 'center', 'right'];
  return t[Math.floor(Math.random() * t.length)];
}
