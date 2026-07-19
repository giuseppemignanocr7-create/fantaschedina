import { useState, useEffect } from 'react';
import { ArrowLeft, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { playRigori, callableErrorMessage, type RigoriShot } from '@/lib/gameApi';
import { COINS } from '@/lib/economy';
import { useAuthContext } from '@/contexts/AuthContext';
import { CountUp } from '@/components/ui/CountUp';
import { burstConfetti, sideCannons, jackpotCelebration, coinRain, vibrate } from '@/lib/juice';

const TOTAL_KICKS = COINS.rigoriMaxShots;
const DIRECTIONS = [
  { id: 'L', label: 'SINISTRA', emoji: '↖️' },
  { id: 'C', label: 'CENTRO', emoji: '⬆️' },
  { id: 'R', label: 'DESTRA', emoji: '↗️' },
] as const;

const FLY: Record<string, { x: string; y: string }> = {
  L: { x: '-80px', y: '-72px' },
  C: { x: '0px', y: '-78px' },
  R: { x: '80px', y: '-72px' },
};
const DIVE: Record<string, { x: string; r: string }> = {
  L: { x: '-72px', r: '-28deg' },
  C: { x: '0px', r: '0deg' },
  R: { x: '72px', r: '28deg' },
};

type Phase = 'intro' | 'aiming' | 'loading' | 'reveal' | 'done';

// --- Sound effects via Web Audio API ---
let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try { audioCtx = new AudioContext(); } catch { return null; }
  }
  return audioCtx;
}

function playSound(type: 'kick' | 'goal' | 'save' | 'whistle' | 'miss') {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;

  if (type === 'kick') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.start(now); osc.stop(now + 0.15);
  } else if (type === 'goal') {
    // Cheer + horn
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440 + i * 220, now + i * 0.05);
      osc.frequency.exponentialRampToValueAtTime(880 + i * 220, now + 0.3 + i * 0.05);
      gain.gain.setValueAtTime(0.15, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4 + i * 0.05);
      osc.start(now + i * 0.05); osc.stop(now + 0.4 + i * 0.05);
    }
  } else if (type === 'save') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now); osc.stop(now + 0.2);
  } else if (type === 'whistle') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now); osc.stop(now + 0.3);
  } else if (type === 'miss') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.start(now); osc.stop(now + 0.4);
  }
}

export function RigoriPage() {
  const { refreshProfile } = useAuthContext();
  const [phase, setPhase] = useState<Phase>('intro');
  const [shots, setShots] = useState<string[]>([]);
  const [results, setResults] = useState<RigoriShot[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [reward, setReward] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);

  const kick = async (dir: string) => {
    if (phase !== 'aiming') return;
    playSound('kick');
    vibrate(30);
    const updated = [...shots, dir];
    setShots(updated);
    if (updated.length < TOTAL_KICKS) return;
    setPhase('loading');
    try {
      const r = await playRigori(updated);
      setResults(r.results);
      setReward(r.reward);
      setRevealed(0);
      setPhase('reveal');
      setGamesPlayed(g => g + 1);
      setTotalEarned(t => t + r.reward);
      refreshProfile();
    } catch (e) {
      setError(callableErrorMessage(e));
      setPhase('intro');
      setShots([]);
    }
  };

  useEffect(() => {
    if (phase !== 'reveal') return;
    if (revealed >= results.length) {
      const t = setTimeout(() => {
        setPhase('done');
        const goals = results.filter(r => r.goal).length;
        if (goals >= TOTAL_KICKS) { playSound('whistle'); jackpotCelebration(); }
        else if (goals >= 3) { playSound('whistle'); sideCannons(); coinRain(1200); }
        else if (goals >= 1) { playSound('whistle'); coinRain(800); }
        else playSound('miss');
      }, 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setRevealed(n => {
        const shot = results[n];
        if (shot?.goal) {
          playSound('goal');
          vibrate([40, 30, 60]);
          burstConfetti({ x: 0.5, y: 0.35 });
          setStreak(s => {
            const ns = s + 1;
            setBestStreak(b => Math.max(b, ns));
            return ns;
          });
        } else {
          playSound('save');
          vibrate(80);
          setStreak(0);
        }
        return n + 1;
      });
    }, 1400);
    return () => clearTimeout(t);
  }, [phase, revealed, results]);

  const score = results.slice(0, revealed).filter(r => r.goal).length;
  const finalScore = results.filter(r => r.goal).length;
  const lastKick = revealed > 0 ? results[revealed - 1] : null;
  const isGoal = lastKick?.goal ?? false;

  if (phase === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card p-8 max-w-sm w-full text-center space-y-5 animate-pop-in">
          <div className="text-7xl animate-heartbeat">{finalScore >= 5 ? '👑' : finalScore >= 4 ? '⚽' : finalScore >= 2 ? '🥅' : '😅'}</div>
          <h2 className="font-display font-black text-3xl text-white uppercase">
            {finalScore >= 5 ? 'PERFETTO!' : finalScore >= 4 ? 'BOMBER!' : finalScore >= 2 ? 'Discreto!' : 'Portiere MVP!'}
          </h2>
          <p className="text-white/50">{finalScore}/{TOTAL_KICKS} rigori segnati</p>

          {/* Streak badge */}
          {bestStreak >= 2 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/40">
              <Flame size={14} className="text-orange-400" />
              <span className="text-xs font-black text-orange-400">Streak {bestStreak}!</span>
            </div>
          )}

          {/* Kick log */}
          <div className="flex gap-2 justify-center">
            {results.map((k, i) => (
              <div key={i} className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm animate-pop-in',
                k.goal ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
                  : 'bg-red-500/20 text-red-400 border border-red-500/50'
              )}
                style={{ animationDelay: `${i * 100}ms` }}>
                {k.goal ? '⚽' : '🧤'}
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-yellow-500/15 via-yellow-500/25 to-yellow-500/15 border border-yellow-500/30 rounded-2xl p-5">
            <p className="text-yellow-200/60 text-xs uppercase tracking-widest mb-1">Bottino</p>
            <p className="font-black text-5xl text-yellow-400 animate-coin-pop">
              +<CountUp to={reward} durationMs={1300} /> 🪙
            </p>
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-4 text-xs text-white/40">
            <span>Partite: <span className="text-white/70 font-bold">{gamesPlayed}</span></span>
            <span>Totale: <span className="text-yellow-400 font-bold">{totalEarned}🪙</span></span>
          </div>

          <button
            onClick={() => { setError(null); setShots([]); setResults([]); setRevealed(0); setStreak(0); setPhase('aiming'); }}
            className="btn-green w-full text-sm font-black animate-pulse-glow active:scale-95 transition-transform"
          >
            ⚡ GIOCA ANCORA!
          </button>
          <Link to="/minigiochi" className="block text-xs text-white/30 hover:text-white/60 transition-colors">
            ← Torna ai minigiochi
          </Link>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card p-8 max-w-sm w-full text-center space-y-5 animate-pop-in">
          <div className="text-7xl animate-float">⚽</div>
          <h1 className="font-display font-black text-3xl text-white uppercase">Rigori</h1>
          <p className="text-white/50 text-sm">{TOTAL_KICKS} rigori · Scegli dove tirare<br />Il portiere (server) si muove a caso!</p>
          <div className="bg-white/5 rounded-xl p-4 text-left space-y-2">
            {[
              'Scegli sinistra, centro o destra',
              'Il portiere para una direzione a caso',
              'GOAL se non coincidono!',
              `+${COINS.rigoriPerGoal} gettoni per gol (max ${COINS.rigoriDailyCap}/giorno)`,
              'Gioca quante volte vuoi!',
            ].map(r => (
              <div key={r} className="flex items-center gap-2 text-sm text-white/70">
                <span className="text-primary-400 text-xs">▸</span> {r}
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-400 animate-shake">{error}</p>}
          <button onClick={() => { setError(null); setShots([]); setPhase('aiming'); playSound('whistle'); }} className="btn-green w-full text-sm font-black animate-pulse-glow active:scale-95 transition-transform">
            ⚡ CALCIO DI RIGORE!
          </button>
          <Link to="/minigiochi" className="block text-xs text-white/30 hover:text-white/60 transition-colors">← Torna ai minigiochi</Link>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-6xl animate-wiggle">🧤</div>
        <p className="text-white/60 animate-pulse font-bold">Il portiere si prepara…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-sm mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to="/minigiochi" className="p-2 text-white/40 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="text-center">
            <p className="font-black text-sm text-white">
              {phase === 'aiming'
                ? `Rigore ${shots.length + 1} / ${TOTAL_KICKS}`
                : `Esito ${Math.min(revealed, TOTAL_KICKS)} / ${TOTAL_KICKS}`}
            </p>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_KICKS }).map((_, i) => {
              const k = phase === 'reveal' ? results[i] : undefined;
              const shown = phase === 'reveal' && i < revealed;
              return (
                <div key={i} className={cn('w-6 h-6 rounded-lg flex items-center justify-center text-xs',
                  phase === 'aiming'
                    ? i < shots.length ? 'bg-primary-500/30 text-primary-400' : 'bg-white/10 text-white/20'
                    : !shown ? 'bg-white/10 text-white/20'
                    : k?.goal ? 'bg-primary-500/30 text-primary-400' : 'bg-red-500/30 text-red-400'
                )}>
                  {phase === 'aiming'
                    ? i < shots.length ? '⚽' : '·'
                    : !shown ? '·' : k?.goal ? '⚽' : '🤚'}
                </div>
              );
            })}
          </div>
        </div>

        {/* Stadium scene */}
        <div className={cn('glass-card p-4 text-center overflow-hidden', phase === 'reveal' && lastKick && !isGoal && 'animate-shake')}>
          {/* Sky + goal */}
          <div className="relative mx-auto w-full max-w-[300px] h-[190px] rounded-xl overflow-hidden mb-3"
            style={{ background: 'linear-gradient(180deg, #0a1530 0%, #10254d 55%, #14532d 55%, #166534 100%)' }}>

            {/* Crowd dots */}
            <div className="absolute top-0 left-0 right-0 h-[38px] opacity-40"
              style={{ background: 'repeating-radial-gradient(circle at 8px 8px, rgba(255,255,255,0.25) 0 1.5px, transparent 2px 12px)' }} />

            {/* Goal frame */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[36px] w-[240px] h-[86px] border-[3px] border-white/80 border-b-0 rounded-t-sm"
              style={{ background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 10px), repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 10px)' }}>
              {/* Keeper */}
              <div
                key={phase === 'reveal' ? `k-${revealed}` : 'k-idle'}
                className={cn('absolute left-1/2 bottom-0 -ml-[18px] text-4xl select-none', phase === 'reveal' && lastKick ? 'animate-keeper-dive' : 'animate-wiggle')}
                style={phase === 'reveal' && lastKick ? {
                  ['--dive-x' as string]: DIVE[lastKick.keeper]?.x ?? '0px',
                  ['--dive-r' as string]: DIVE[lastKick.keeper]?.r ?? '0deg',
                } : undefined}
              >
                🧤
              </div>
            </div>

            {/* Ball */}
            <div
              key={phase === 'reveal' ? `b-${revealed}` : 'b-idle'}
              className={cn('absolute left-1/2 -ml-[15px] bottom-[10px] text-3xl select-none', phase === 'reveal' && lastKick && 'animate-ball-fly')}
              style={phase === 'reveal' && lastKick ? {
                ['--fly-x' as string]: FLY[lastKick.shot]?.x ?? '0px',
                ['--fly-y' as string]: FLY[lastKick.shot]?.y ?? '-70px',
              } : undefined}
            >
              ⚽
            </div>

            {/* Penalty spot */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[8px] w-8 h-1.5 rounded-full bg-black/30" />

            {/* Reveal flash */}
            {phase === 'reveal' && lastKick && (
              <div className={cn('absolute inset-0 flex items-center justify-center pointer-events-none')}>
                <p className={cn('font-display font-black text-3xl uppercase drop-shadow-lg animate-pop-in', isGoal ? 'text-primary-300' : 'text-red-400')}
                  style={{ animationDelay: '450ms', opacity: 0, animationFillMode: 'forwards' }}>
                  {isGoal ? 'GOOOOL! ⚽' : 'PARATO! 🧤'}
                </p>
              </div>
            )}
          </div>

          {/* Streak indicator */}
          {phase === 'reveal' && streak >= 2 && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/30 border border-orange-500/50 animate-pop-in z-10">
              <Flame size={12} className="text-orange-400" />
              <span className="text-[10px] font-black text-orange-300">STREAK {streak}!</span>
            </div>
          )}

          {/* Direction buttons */}
          {phase === 'aiming' ? (
            <div className="space-y-2">
              <p className="text-sm font-bold text-white/80 animate-pulse">Dove tiri? 🎯</p>
              <div className="grid grid-cols-3 gap-2">
                {DIRECTIONS.map(dir => (
                  <button
                    key={dir.id}
                    onClick={() => { vibrate(25); kick(dir.id); }}
                    className="py-3.5 rounded-xl bg-primary-500/15 border border-primary-500/40 text-primary-300 font-black text-xs uppercase transition-all hover:bg-primary-500/30 hover:scale-[1.03] active:scale-95"
                  >
                    <span className="block text-xl mb-0.5">{dir.emoji}</span>
                    {dir.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-white/40 font-bold uppercase tracking-widest animate-pulse">Momento della verità…</p>
          )}
        </div>

        {/* Score */}
        <div className="glass-card p-3 flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="text-[9px] text-white/40 uppercase tracking-widest">Gol</p>
            <p className="font-black text-2xl text-primary-400">{phase === 'reveal' ? score : 0}</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center flex-1">
            <p className="text-[9px] text-white/40 uppercase tracking-widest">Rigori</p>
            <p className="font-black text-2xl text-white">
              {phase === 'aiming' ? shots.length : revealed}/{TOTAL_KICKS}
            </p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center flex-1">
            <p className="text-[9px] text-white/40 uppercase tracking-widest">Gettoni</p>
            <p className="font-black text-2xl text-yellow-400">
              +{(phase === 'reveal' ? score : 0) * COINS.rigoriPerGoal}
            </p>
          </div>
          {streak >= 2 && (
            <>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center flex-1">
                <p className="text-[9px] text-white/40 uppercase tracking-widest">Streak</p>
                <p className="font-black text-2xl text-orange-400 flex items-center justify-center gap-0.5">
                  <Flame size={14} />{streak}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
