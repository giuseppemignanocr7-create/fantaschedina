import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Clock, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { playMemoria, callableErrorMessage, type MemoriaPlayResponse } from '@/lib/gameApi';
import { COINS } from '@/lib/economy';
import { useAuthContext } from '@/contexts/AuthContext';
import { burstConfetti, sideCannons, coinRain, vibrate } from '@/lib/juice';

const EMOJIS = ['⚽', '🥅', '🧤', '🚩', '🏟️', '🏆', '🎯', '🥈', '🥉', '🏅', '🎖️', '👟', '🧦', '🟨', '🥇', '🟥'];

interface Level {
  pairs: number;
  cols: number;
  time: number;
  name: string;
}

// I tempi arrivano da `COINS.memoriaLevelTimes`: il server li usa per validare
// il bonus tempo dichiarato dal client, quindi devono essere gli stessi.
const LEVELS: Level[] = [
  { pairs: 4, cols: 4, time: COINS.memoriaLevelTimes[0], name: 'Esordiente' },
  { pairs: 6, cols: 4, time: COINS.memoriaLevelTimes[1], name: 'Titolare' },
  { pairs: 8, cols: 4, time: COINS.memoriaLevelTimes[2], name: 'Campione' },
];

type Phase = 'intro' | 'playing' | 'submitting' | 'done';
type CardState = 'hidden' | 'flipped' | 'matched';

interface Card {
  id: number;
  emoji: string;
  state: CardState;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(pairs: number): Card[] {
  const picked = shuffle(EMOJIS).slice(0, pairs);
  return shuffle([...picked, ...picked]).map((emoji, i) => ({
    id: i,
    emoji,
    state: 'hidden' as CardState,
  }));
}

export function MemoriaCalcioPage() {
  const { refreshProfile } = useAuthContext();
  const [phase, setPhase] = useState<Phase>('intro');
  const [levelIdx, setLevelIdx] = useState(0);
  const [deck, setDeck] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matchedCount, setMatchedCount] = useState(0);
  const [timer, setTimer] = useState(0);
  const [moves, setMoves] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MemoriaPlayResponse | null>(null);

  // Refs to avoid stale closures
  const lockRef = useRef(false);
  const levelEndedRef = useRef(false);
  const levelsDoneRef = useRef(0);
  const timeRemainingRef = useRef(0);
  const timerRef = useRef(0);
  const levelIdxRef = useRef(0);

  const level = LEVELS[levelIdx];

  const startLevel = useCallback((idx: number) => {
    const lv = LEVELS[idx];
    levelIdxRef.current = idx;
    levelEndedRef.current = false;
    timerRef.current = lv.time;
    setLevelIdx(idx);
    setDeck(buildDeck(lv.pairs));
    setFlipped([]);
    setMatchedCount(0);
    setTimer(lv.time);
    setMoves(0);
    lockRef.current = false;
    setPhase('playing');
  }, []);

  const begin = () => {
    setError(null);
    levelsDoneRef.current = 0;
    timeRemainingRef.current = 0;
    setResult(null);
    startLevel(0);
  };

  const finishGame = useCallback(async (completedLevels: number, totalTimeRemaining: number) => {
    setPhase('submitting');
    try {
      const r = await playMemoria(completedLevels, totalTimeRemaining);
      setResult(r);
      setPhase('done');
      refreshProfile();
      if (r.reward >= 20) { sideCannons(); coinRain(1500); vibrate([60, 40, 60]); }
      else if (r.reward >= 10) { burstConfetti(); coinRain(1000); vibrate([40, 30]); }
      else vibrate(40);
    } catch (e) {
      setError(callableErrorMessage(e));
      setPhase('intro');
    }
  }, [refreshProfile]);

  const handleLevelEnd = useCallback((completed: boolean) => {
    if (levelEndedRef.current) return;
    levelEndedRef.current = true;

    const timeRemaining = completed ? timerRef.current : 0;
    const newLevelsDone = completed ? levelsDoneRef.current + 1 : levelsDoneRef.current;
    levelsDoneRef.current = newLevelsDone;
    timeRemainingRef.current += timeRemaining;

    if (completed && levelIdxRef.current + 1 < LEVELS.length) {
      setTimeout(() => startLevel(levelIdxRef.current + 1), 800);
    } else {
      finishGame(newLevelsDone, timeRemainingRef.current);
    }
  }, [startLevel, finishGame]);

  // Timer tick
  useEffect(() => {
    if (phase !== 'playing') return;
    if (timer <= 0) {
      handleLevelEnd(false);
      return;
    }
    timerRef.current = timer;
    const t = setTimeout(() => setTimer(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timer, handleLevelEnd]);

  // Match check when two cards flipped
  useEffect(() => {
    if (flipped.length !== 2) return;
    const [a, b] = flipped;
    const isMatch = deck[a]?.emoji === deck[b]?.emoji;

    if (isMatch) {
      vibrate([20, 30, 20]);
      const matchTimer = setTimeout(() => {
        setDeck(prev => prev.map((c, i) =>
          i === a || i === b ? { ...c, state: 'matched' as CardState } : c
        ));
        setMatchedCount(prev => prev + 2);
        setFlipped([]);
        lockRef.current = false;
      }, 400);
      return () => clearTimeout(matchTimer);
    } else {
      vibrate(60);
      const unflipTimer = setTimeout(() => {
        setDeck(prev => prev.map((c, i) =>
          i === a || i === b ? { ...c, state: 'hidden' as CardState } : c
        ));
        setFlipped([]);
        lockRef.current = false;
      }, 800);
      return () => clearTimeout(unflipTimer);
    }
  }, [flipped, deck]);

  // Level complete check
  useEffect(() => {
    if (phase !== 'playing') return;
    if (matchedCount > 0 && matchedCount === deck.length) {
      handleLevelEnd(true);
    }
  }, [matchedCount, deck, phase, handleLevelEnd]);

  const flipCard = (idx: number) => {
    if (lockRef.current) return;
    if (deck[idx].state !== 'hidden') return;
    if (flipped.length >= 2) return;
    vibrate(15);
    // Lock only after second flip, so user can still pick the first card freely
    if (flipped.length === 1) lockRef.current = true;
    setFlipped(prev => [...prev, idx]);
    setDeck(prev => prev.map((c, i) => i === idx ? { ...c, state: 'flipped' as CardState } : c));
    setMoves(m => m + 1);
  };

  // --- INTRO ---
  if (phase === 'intro' || phase === 'submitting') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-5 animate-pop-in">
          {phase === 'submitting' ? (
            <>
              <Loader2 size={48} className="mx-auto animate-spin text-primary-400" />
              <h2 className="font-display font-black text-2xl text-white uppercase">Calcolo premi...</h2>
            </>
          ) : (
            <>
              <div className="text-7xl animate-float">🧠</div>
              <h1 className="font-display font-black text-3xl text-white uppercase">Memoria Calcio</h1>
              <p className="text-white/50 text-sm">
                Trova le coppie di emoji calcistiche prima dello scadere del tempo!
              </p>
              <div className="bg-white/5 rounded-xl p-4 text-left space-y-2">
                <p className="text-xs font-black text-white/80 uppercase tracking-widest mb-2">3 Livelli</p>
                {LEVELS.map((lv, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-white/70">
                    <span className="text-primary-400 text-xs">▸</span>
                    <span className="font-bold">{lv.name}</span>
                    <span className="text-white/40">· {lv.pairs} coppie · {lv.time}s</span>
                  </div>
                ))}
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-left space-y-1">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <span className="text-yellow-400">🪙</span>
                  +{COINS.memoriaPerLevel} per livello completato
                </div>
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <span className="text-yellow-400">⏱️</span>
                  +{COINS.memoriaTimeBonus} per 5 secondi rimanenti
                </div>
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <span className="text-yellow-400">📊</span>
                  Max {COINS.memoriaDailyCap} gettoni al giorno · gioca quanto vuoi!
                </div>
              </div>
              {error && <p className="text-sm text-red-400 animate-shake">{error}</p>}
              <button onClick={begin} className="btn-green w-full text-sm font-black animate-pulse-glow active:scale-95 transition-transform">
                ⚡ INIZIA A GIOCARE
              </button>
              <Link to="/minigiochi" className="block text-xs text-white/30 hover:text-white/60 transition-colors">
                ← Torna ai minigiochi
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- DONE ---
  if (phase === 'done' && result) {
    const allDone = result.levelsCompleted === LEVELS.length;
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-5 animate-pop-in">
          <div className="text-7xl animate-heartbeat">
            {allDone ? '🏆' : result.levelsCompleted >= 2 ? '⭐' : '🎮'}
          </div>
          <h2 className="font-display font-black text-3xl text-white uppercase">
            {allDone ? 'PERFETTO!' : result.levelsCompleted >= 2 ? 'BRAVO!' : 'HAI GIOCATO!'}
          </h2>
          <p className="text-white/60 font-bold">
            {result.levelsCompleted}/{LEVELS.length} livelli completati
          </p>

          {/* Level badges */}
          <div className="flex gap-2 justify-center flex-wrap">
            {LEVELS.map((lv, i) => (
              <div key={i} className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-black animate-pop-in',
                i < result.levelsCompleted
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/40'
                  : 'bg-white/5 text-white/20 border border-white/10'
              )} style={{ animationDelay: `${i * 100}ms` }}>
                {i < result.levelsCompleted ? '✓ ' : ''}{lv.name}
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div className="bg-white/5 rounded-xl p-4 space-y-2 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Livelli ({result.levelsCompleted} × {COINS.memoriaPerLevel}🪙)</span>
              <span className="text-yellow-400 font-bold">+{result.levelReward}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Bonus tempo ({result.timeRemaining}s)</span>
              <span className="text-yellow-400 font-bold">+{result.timeBonus}</span>
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex justify-between text-sm font-black">
              <span className="text-white">Totale</span>
              <span className="text-yellow-400">+{result.reward} 🪙</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={begin}
              className="flex-1 btn-green text-xs font-black active:scale-95 transition-transform"
            >
              ⚡ GIOCA ANCORA
            </button>
            <Link to="/minigiochi" className="flex items-center justify-center gap-2 btn-secondary text-xs">
              <ArrowLeft size={14} /> Sala giochi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- PLAYING ---
  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to="/minigiochi" className="p-2 text-white/40 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="text-center">
            <p className="font-black text-sm text-white">
              Livello {levelIdx + 1} / {LEVELS.length}
            </p>
            <p className="text-[10px] text-primary-400 uppercase tracking-widest">{level.name}</p>
          </div>
          <div className={cn(
            'flex items-center gap-1.5 text-sm font-bold px-2.5 py-1 rounded-lg transition-colors',
            timer <= 10 && 'bg-red-500/20 animate-heartbeat'
          )}>
            <Clock size={14} className={timer <= 10 ? 'text-red-400' : 'text-white/40'} />
            <span className={timer <= 10 ? 'text-red-400 font-black' : 'text-white/60'}>{timer}s</span>
          </div>
        </div>

        {/* Timer bar */}
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-1000',
              timer > 10 ? 'bg-primary-500' : 'bg-red-500')}
            style={{ width: `${(timer / level.time) * 100}%` }}
          />
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2">
          {LEVELS.map((_, i) => (
            <div key={i} className={cn(
              'w-8 h-1.5 rounded-full transition-all',
              i < levelIdx ? 'bg-primary-500' : i === levelIdx ? 'bg-white' : 'bg-white/15'
            )} />
          ))}
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-4 text-xs text-white/40">
          <span>Coppie: <span className="text-primary-400 font-bold">{matchedCount / 2}/{level.pairs}</span></span>
          <span>Mosse: <span className="text-white/70 font-bold">{moves}</span></span>
        </div>

        {/* Card grid 3D flip */}
        <div
          className="grid gap-2.5"
          style={{ gridTemplateColumns: `repeat(${level.cols}, 1fr)` }}
        >
          {deck.map((card, i) => (
            <div
              key={card.id}
              onClick={() => card.state === 'hidden' && flipCard(i)}
              className={cn(
                'group aspect-square rounded-2xl cursor-pointer select-none',
                card.state === 'matched' && 'opacity-60'
              )}
              style={{ perspective: '800px' }}
            >
              <div
                className={cn(
                  'relative w-full h-full transition-transform duration-500 ease-out',
                  card.state !== 'hidden' && '[transform:rotateY(180deg)]'
                )}
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Back face */}
                <div
                  className="absolute inset-0 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary-600/40 to-primary-800/60 border border-primary-500/30 shadow-inner active:scale-95 transition-transform [backface-visibility:hidden]"
                  style={{ transform: 'rotateY(0deg)' }}
                >
                  <span className="text-3xl drop-shadow-md">⚽</span>
                </div>
                {/* Front face */}
                <div
                  className={cn(
                    'absolute inset-0 rounded-2xl flex items-center justify-center text-4xl bg-gradient-to-br from-white/15 to-white/5 border shadow-lg [backface-visibility:hidden]',
                    card.state === 'matched' ? 'border-green-500/40 shadow-green-500/15' : 'border-white/30'
                  )}
                  style={{ transform: 'rotateY(180deg)' }}
                >
                  <span className={cn(
                    'drop-shadow-md animate-pop-in',
                    card.state === 'matched' && 'opacity-80'
                  )}>
                    {card.emoji}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
