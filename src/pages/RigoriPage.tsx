import { useState, useEffect } from 'react';
import { ArrowLeft, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { playRigori, callableErrorMessage, type RigoriShot, type PenaltyShotInput } from '@/lib/gameApi';
import { COINS } from '@/lib/economy';
import { useAuthContext } from '@/contexts/AuthContext';
import { CountUp } from '@/components/ui/CountUp';
import { burstConfetti, sideCannons, jackpotCelebration, coinRain, vibrate } from '@/lib/juice';
import { playPenaltySound } from '@/lib/penaltySound';
import { PenaltyStadium } from '@/components/games/PenaltyStadium';
import { PenaltyZoneGrid, PenaltyPowerMeter } from '@/components/games/PenaltyAimer';
import type { PenaltyZone } from '@/lib/penalty';

const TOTAL_KICKS = COINS.rigoriMaxShots;

type Phase = 'intro' | 'aiming' | 'loading' | 'reveal' | 'done';

export function RigoriPage() {
  const { refreshProfile } = useAuthContext();
  const [phase, setPhase] = useState<Phase>('intro');
  const [shots, setShots] = useState<PenaltyShotInput[]>([]);
  const [aimZone, setAimZone] = useState<PenaltyZone | null>(null);
  const [results, setResults] = useState<RigoriShot[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [reward, setReward] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);

  const kick = async (zone: PenaltyZone, power: number) => {
    if (phase !== 'aiming') return;
    playPenaltySound('kick');
    vibrate(30);
    setAimZone(null);
    const updated = [...shots, { zone, power }];
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
      void refreshProfile().catch(err => console.error('[RigoriPage] refreshProfile:', err));
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
        if (goals >= TOTAL_KICKS) { playPenaltySound('whistle'); jackpotCelebration(); }
        else if (goals >= 3) { playPenaltySound('whistle'); sideCannons(); coinRain(1200); }
        else if (goals >= 1) { playPenaltySound('whistle'); coinRain(800); }
        else playPenaltySound('miss');
      }, 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setRevealed(n => {
        const shot = results[n];
        if (shot?.goal) {
          playPenaltySound('goal');
          vibrate([40, 30, 60]);
          burstConfetti({ x: 0.5, y: 0.35 });
          setStreak(s => {
            const ns = s + 1;
            setBestStreak(b => Math.max(b, ns));
            return ns;
          });
        } else {
          playPenaltySound('save');
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
          <p className="text-white/50 text-sm">{TOTAL_KICKS} rigori · Mira l'angolo e dosa la potenza<br />Gli angoli sono quasi imparabili, il centro è più sicuro ma facile da bloccare</p>
          <div className="bg-white/5 rounded-xl p-4 text-left space-y-2">
            {[
              'Tocca una delle 6 zone della porta',
              'Blocca la barra al momento giusto: più precisione, più gol',
              'Angoli = rischio alto ma quasi imparabili, centro = più sicuro',
              `+${COINS.rigoriPerGoal} gettoni per gol (max ${COINS.rigoriDailyCap}/giorno)`,
              'Gioca quante volte vuoi!',
            ].map(r => (
              <div key={r} className="flex items-center gap-2 text-sm text-white/70">
                <span className="text-primary-400 text-xs">▸</span> {r}
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-400 animate-shake">{error}</p>}
          <button onClick={() => { setError(null); setShots([]); setAimZone(null); setPhase('aiming'); playPenaltySound('whistle'); }} className="btn-green w-full text-sm font-black animate-pulse-glow active:scale-95 transition-transform">
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
        <div className="glass-card p-4 text-center relative">
          <PenaltyStadium
            revealShot={phase === 'reveal' && lastKick ? { shot: lastKick.shot, keeper: lastKick.keeper, goal: lastKick.goal } : null}
            revealKey={revealed}
          >
            {phase === 'aiming' && !aimZone && (
              <PenaltyZoneGrid onPick={z => { vibrate(15); setAimZone(z); }} />
            )}
          </PenaltyStadium>

          {/* Streak indicator */}
          {phase === 'reveal' && streak >= 2 && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/30 border border-orange-500/50 animate-pop-in z-10">
              <Flame size={12} className="text-orange-400" />
              <span className="text-[10px] font-black text-orange-300">STREAK {streak}!</span>
            </div>
          )}

          {/* Mira / potenza / reveal */}
          <div className="mt-3">
            {phase === 'aiming' && !aimZone && (
              <p className="text-sm font-bold text-white/80 animate-pulse">Tocca la porta: dove tiri? 🎯</p>
            )}
            {phase === 'aiming' && aimZone && (
              <PenaltyPowerMeter
                zone={aimZone}
                onCancel={() => setAimZone(null)}
                onConfirm={power => kick(aimZone, power)}
              />
            )}
            {phase === 'reveal' && (
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest animate-pulse">Momento della verità…</p>
            )}
          </div>
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
