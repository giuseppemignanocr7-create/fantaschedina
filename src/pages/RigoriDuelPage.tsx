import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Users, Swords, Timer, Copy, Loader2 } from 'lucide-react';
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
import { vibrate } from '@/lib/juice';

type GamePhase = 'menu' | 'create' | 'join' | 'game' | 'finished';

const TARGETS: { value: PenaltyTarget; label: string; icon: string; position: string }[] = [
  { value: 'left', label: 'Sinistra', icon: '⬅️', position: 'absolute left-[12%] top-1/2 -translate-y-1/2' },
  { value: 'center', label: 'Centro', icon: '⬆️', position: 'absolute left-1/2 top-[15%] -translate-x-1/2' },
  { value: 'right', label: 'Destra', icon: '➡️', position: 'absolute right-[12%] top-1/2 -translate-y-1/2' },
];

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
  const [revealing, setRevealing] = useState(false);
  const [timer, setTimer] = useState(5);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const isP1 = duel?.p1.uid === profile?.id;
  const playerNum = isP1 ? 1 : 2;
  const isMyTurn = duel?.attacker === playerNum;
  const amAttacker = isMyTurn;

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

  // Start timer when playing and new round
  useEffect(() => {
    if (duel?.phase !== 'playing' || !duel.deadlineAt) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const update = () => {
      const remaining = Math.max(0, Math.ceil((duel.deadlineAt - Date.now()) / 1000));
      setTimer(remaining);
      if (remaining <= 1) {
        // auto timeout
        if (myChoice === null && duel.phase === 'playing') {
          handleTimeout();
        }
      }
    };
    update();
    timerRef.current = setInterval(update, 250);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [duel?.round, duel?.phase, duel?.deadlineAt]);

  // Reveal animation when lastRound changes
  useEffect(() => {
    if (!duel?.lastRound) return;
    if (lastAnim?.round === duel.lastRound.round) return;
    setLastAnim(duel.lastRound);
    setRevealing(true);
    setMyChoice(null);
    const t = setTimeout(() => setRevealing(false), 1800);
    return () => clearTimeout(t);
  }, [duel?.lastRound]);

  const handleTimeout = async () => {
    if (!duelId || myChoice !== null) return;
    setMyChoice(randomTarget());
    try {
      await penaltyDuelMoveFn(duelId, undefined, true);
    } catch (e) {
      setError(callableErrorMessage(e));
    }
  };

  const handleChoice = async (target: PenaltyTarget) => {
    if (!duelId || myChoice !== null || revealing || duel?.phase !== 'playing') return;
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

  const isFinished = duel?.phase === 'finished';
  useEffect(() => {
    if (isFinished && phase !== 'finished') {
      setPhase('finished');
      setTimer(0);
    }
  }, [isFinished, phase]);

  if (phase === 'create') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card p-8 max-w-sm w-full text-center space-y-5 animate-pop-in">
          <div className="text-6xl animate-bounce">⚽</div>
          <h1 className="font-display font-black text-2xl text-white uppercase">Sala d'attesa</h1>
          <p className="text-white/50 text-sm">Condividi il codice con un amico per iniziare il duello</p>

          <div className="bg-white/5 rounded-2xl p-5 space-y-3">
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Codice partita</p>
            <div className="font-black text-4xl text-primary-400 tracking-[0.2em]">{code}</div>
            <button
              onClick={copyCode}
              className="flex items-center justify-center gap-2 mx-auto text-xs text-white/60 hover:text-white transition-colors"
            >
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
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card p-8 max-w-sm w-full text-center space-y-5 animate-pop-in">
          <div className="text-7xl animate-heartbeat">
            {iWon ? '🏆' : isDraw ? '🤝' : '😢'}
          </div>
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

          {(duel.reward > 0 && (iWon || isDraw)) && (
            <div className="bg-gradient-to-r from-yellow-500/15 via-yellow-500/25 to-yellow-500/15 border border-yellow-500/30 rounded-2xl p-5">
              <p className="text-yellow-200/60 text-xs uppercase tracking-widest mb-1">Premio</p>
              <p className="font-black text-4xl text-yellow-400">+{duel.reward} 🪙</p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => { cleanup(); setPhase('menu'); setDuel(null); setDuelId(null); }} className="flex-1 btn-green text-sm font-black">
              🔄 Gioca ancora
            </button>
            <Link to="/minigiochi" className="flex items-center justify-center flex-1 btn-secondary text-sm">
              ← Minigiochi
            </Link>
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
    const roleSub = amAttacker ? 'Scegli uno dei 3 lati della porta' : 'Indovina dove tirerà l\'avversario';

    return (
      <div className="min-h-screen px-4 py-6">
        <div className="max-w-md mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Link to="/minigiochi" className="p-2 text-white/40 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="text-center">
              <p className="font-black text-sm text-white">Rigore {duel.round} / {duel.mode.startsWith('bot') && duel.mode !== 'botAlternate' ? 5 : '∞'}</p>
              <p className="text-[10px] text-primary-400 uppercase tracking-widest font-bold">
                {duel.mode.startsWith('bot') ? 'vs Bot' : '1 vs 1'}
              </p>
            </div>
            <div className="w-8" />
          </div>

          {/* Scoreboard */}
          <div className="glass-card p-4 flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-xs font-bold text-primary-400 truncate max-w-[80px] mx-auto">{myName}</p>
              <p className="font-black text-4xl text-primary-400">{myScore}</p>
            </div>
            <div className="px-4">
              <Swords size={28} className="text-orange-400" />
            </div>
            <div className="text-center flex-1">
              <p className="text-xs font-bold text-red-400 truncate max-w-[80px] mx-auto">{oppName}</p>
              <p className="font-black text-4xl text-red-400">{oppScore}</p>
            </div>
          </div>

          {/* Timer */}
          <div className={cn(
            'flex items-center justify-center gap-2 text-xl font-black',
            timer <= 2 ? 'text-red-400 animate-pulse' : 'text-white'
          )}>
            <Timer size={20} />
            <span>{timer}s</span>
          </div>

          {/* Role banner */}
          <div className="text-center space-y-1">
            <p className={cn('font-black text-lg uppercase', amAttacker ? 'text-primary-400' : 'text-yellow-400')}>
              {amAttacker ? '⚽ Sei l\'attaccante' : '🧤 Sei il portiere'}
            </p>
            <p className="text-sm text-white/60">{roleSub}</p>
          </div>

          {/* Goal with 3 targets */}
          <div className="relative aspect-[16/10] bg-gradient-to-b from-green-900/40 to-green-800/20 rounded-3xl border-4 border-white/20 overflow-hidden shadow-2xl">
            {/* Goal net */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }} />

            {TARGETS.map(t => {
              const disabled = revealing || myChoice !== null || duel.phase !== 'playing';
              return (
                <button
                  key={t.value}
                  onClick={() => handleChoice(t.value)}
                  disabled={disabled}
                  className={cn(
                    'w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all active:scale-90',
                    t.position,
                    disabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-110 hover:bg-white/20 bg-white/10 border border-white/20 shadow-lg'
                  )}
                >
                  <span className="text-3xl filter drop-shadow-lg">{t.icon}</span>
                  <span className="text-[10px] font-black text-white/80 uppercase mt-1">{t.label}</span>
                </button>
              );
            })}

            {revealing && lastAnim && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 animate-pop-in z-20">
                <p className="text-5xl mb-2">{lastAnim.goal ? '⚽' : '🧤'}</p>
                <p className={cn('font-black text-2xl uppercase', lastAnim.goal ? 'text-green-400' : 'text-red-400')}>
                  {lastAnim.goal ? 'GOAL!' : 'PARATA!'}
                </p>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-400 text-center animate-shake">{error}</p>}
        </div>
      </div>
    );
  }

  // Default menu
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-card p-8 max-w-sm w-full space-y-5 animate-pop-in">
        <div className="text-center space-y-2">
          <div className="text-6xl animate-bounce">⚽</div>
          <h1 className="font-display font-black text-3xl text-white uppercase">Rigori Duello</h1>
          <p className="text-white/50 text-sm">3 mirini, 5 secondi, 5 rigori a testa. Vince il più freddo!</p>
        </div>

        {error && <p className="text-sm text-red-400 text-center animate-shake">{error}</p>}

        <div className="space-y-3">
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full btn-green text-sm font-black flex items-center justify-center gap-2"
          >
            <Users size={16} /> CREA PARTITA 1v1
          </button>

          <div className="flex gap-2">
            <input
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              placeholder="CODICE"
              maxLength={6}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center font-black text-white tracking-widest uppercase focus:outline-none focus:border-primary-500"
            />
            <button
              onClick={handleJoin}
              disabled={loading || inputCode.length !== 6}
              className="btn-primary px-4 text-sm font-black"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'ENTRA'}
            </button>
          </div>

          <div className="h-px bg-white/10" />

          <p className="text-[10px] text-white/40 uppercase tracking-widest text-center font-bold">Gioca contro il Bot</p>

          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => handleBot('botAttacker')} className="btn-secondary text-xs font-black py-3">
              ⚽ Attaccante
            </button>
            <button onClick={() => handleBot('botKeeper')} className="btn-secondary text-xs font-black py-3">
              🧤 Portiere
            </button>
            <button onClick={() => handleBot('botAlternate')} className="btn-secondary text-xs font-black py-3">
              🔄 Alterna
            </button>
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
