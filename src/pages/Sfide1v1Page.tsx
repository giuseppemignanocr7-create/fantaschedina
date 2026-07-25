import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Swords, Search, User, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  startSfida,
  playSfida,
  getPublicProfilesFn,
  callableErrorMessage,
  type PublicProfileData,
  type SfidaPlayResponse,
  type PenaltyShotInput,
  type RigoriShot,
} from '@/lib/gameApi';
import { COINS } from '@/lib/economy';
import { useAuthContext } from '@/contexts/AuthContext';
import { CountUp } from '@/components/ui/CountUp';
import { burstConfetti, sideCannons, coinRain, vibrate } from '@/lib/juice';
import { playPenaltySound } from '@/lib/penaltySound';
import { PenaltyStadium } from '@/components/games/PenaltyStadium';
import { PenaltyZoneGrid, PenaltyPowerMeter } from '@/components/games/PenaltyAimer';
import type { PenaltyZone } from '@/lib/penalty';
import { useSequentialReveal } from '@/hooks/useSequentialReveal';

type Phase = 'select' | 'aiming' | 'loading' | 'reveal' | 'result';
interface RevealEntry { who: 'me' | 'opp'; shot: RigoriShot }

export function Sfide1v1Page() {
  const { profile, refreshProfile } = useAuthContext();
  const [phase, setPhase] = useState<Phase>('select');
  const [opponents, setOpponents] = useState<PublicProfileData[]>([]);
  const [selectedOpp, setSelectedOpp] = useState<PublicProfileData | null>(null);
  const [shots, setShots] = useState<PenaltyShotInput[]>([]);
  const [aimZone, setAimZone] = useState<PenaltyZone | null>(null);
  const [result, setResult] = useState<SfidaPlayResponse | null>(null);
  const [revealSeq, setRevealSeq] = useState<RevealEntry[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  const loadOpponents = useCallback(async () => {
    try {
      const { profiles } = await getPublicProfilesFn();
      const filtered = profiles.filter(p => p.id !== profile?.id).slice(0, 50);
      setOpponents(filtered);
    } catch (e) {
      setError(callableErrorMessage(e));
    } finally {
      setLoadingList(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadOpponents();
  }, [loadOpponents]);

  const challengeOpponent = async (opp: PublicProfileData) => {
    setError(null);
    try {
      await startSfida(opp.id);
      setSelectedOpp(opp);
      setShots([]);
      setAimZone(null);
      setPhase('aiming');
    } catch (e) {
      setError(callableErrorMessage(e));
    }
  };

  const kick = async (zone: PenaltyZone, power: number) => {
    if (phase !== 'aiming') return;
    playPenaltySound('kick');
    vibrate(25);
    setAimZone(null);
    const updated = [...shots, { zone, power }];
    setShots(updated);
    if (updated.length < COINS.rigoriMaxShots) return;
    setPhase('loading');
    try {
      const r = await playSfida(selectedOpp!.id, updated);
      setResult(r);
      const interleaved: RevealEntry[] = [];
      for (let i = 0; i < r.myResults.length; i++) {
        interleaved.push({ who: 'me', shot: r.myResults[i] });
        if (r.oppResults[i]) interleaved.push({ who: 'opp', shot: r.oppResults[i] });
      }
      setRevealSeq(interleaved);
      setRevealed(0);
      setPhase('reveal');
    } catch (e) {
      setError(callableErrorMessage(e));
      setPhase('select');
      setShots([]);
    }
  };

  useSequentialReveal(
    revealSeq,
    revealed,
    setRevealed,
    phase === 'reveal',
    1300,
    700,
    entry => {
      if (entry.shot.goal) {
        playPenaltySound('goal');
        vibrate(entry.who === 'me' ? [40, 30, 60] : 30);
        if (entry.who === 'me') burstConfetti({ x: 0.5, y: 0.35 });
      } else {
        playPenaltySound('save');
        if (entry.who === 'me') vibrate(80);
      }
    },
    () => {
      setPhase('result');
      refreshProfile();
      if (result?.won) { sideCannons(); coinRain(1500); vibrate([60, 40, 60]); }
      else if (result?.draw) { burstConfetti(); vibrate(40); }
      else vibrate(80);
    }
  );

  if (phase === 'result' && result) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card p-8 max-w-sm w-full text-center space-y-5 animate-pop-in">
          <div className="text-7xl animate-heartbeat">
            {result.won ? '🏆' : result.draw ? '🤝' : '😢'}
          </div>
          <h2 className="font-display font-black text-3xl text-white uppercase">
            {result.won ? 'HAI VINTO!' : result.draw ? 'PAREGGIO!' : 'HAI PERSO!'}
          </h2>
          <p className="text-white/50">vs {selectedOpp?.username ?? 'Avversario'}</p>

          {/* Score */}
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase">Tu</p>
              <p className="font-black text-4xl text-primary-400">{result.myGoals}</p>
            </div>
            <span className="text-2xl text-white/30 font-black">-</span>
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase">{selectedOpp?.username ?? 'Avv.'}</p>
              <p className="font-black text-4xl text-red-400">{result.oppGoals}</p>
            </div>
          </div>

          {/* Kick log */}
          <div className="space-y-2">
            <p className="text-[10px] text-white/40 uppercase tracking-widest">I tuoi tiri</p>
            <div className="flex gap-2 justify-center">
              {result.myResults.map((k, i) => (
                <div key={i} className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center text-sm animate-pop-in',
                  k.goal ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
                    : 'bg-red-500/20 text-red-400 border border-red-500/50'
                )} style={{ animationDelay: `${i * 80}ms` }}>
                  {k.goal ? '⚽' : '🧤'}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Tiri avversario</p>
            <div className="flex gap-2 justify-center">
              {result.oppResults.map((k, i) => (
                <div key={i} className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center text-sm animate-pop-in',
                  k.goal ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                    : 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
                )} style={{ animationDelay: `${i * 80 + 400}ms` }}>
                  {k.goal ? '⚽' : '🧤'}
                </div>
              ))}
            </div>
          </div>

          {result.reward > 0 && (
            <div className="bg-gradient-to-r from-yellow-500/15 via-yellow-500/25 to-yellow-500/15 border border-yellow-500/30 rounded-2xl p-5">
              <p className="text-yellow-200/60 text-xs uppercase tracking-widest mb-1">Premio</p>
              <p className="font-black text-5xl text-yellow-400 animate-coin-pop">
                +<CountUp to={result.reward} durationMs={1300} /> 🪙
              </p>
            </div>
          )}

          <p className="text-xs text-white/40">
            Puoi sfidare {selectedOpp?.username ?? 'questo avversario'} tra {COINS.sfidaCooldownDays} giorni
          </p>
          <button
            onClick={() => { setResult(null); setSelectedOpp(null); setShots([]); setPhase('select'); }}
            className="btn-secondary w-full text-sm font-black active:scale-95 transition-transform"
          >
            ← Scegli altro avversario
          </button>
          <Link to="/minigiochi" className="block text-xs text-white/30 hover:text-white/60 transition-colors">
            ← Torna ai minigiochi
          </Link>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-6xl animate-wiggle">⚔️</div>
        <p className="text-white/60 animate-pulse font-bold">Calcolo dei rigori…</p>
      </div>
    );
  }

  if (phase === 'reveal' && selectedOpp) {
    const lastEntry = revealed > 0 ? revealSeq[revealed - 1] : null;
    const myScoreSoFar = revealSeq.slice(0, revealed).filter(e => e.who === 'me' && e.shot.goal).length;
    const oppScoreSoFar = revealSeq.slice(0, revealed).filter(e => e.who === 'opp' && e.shot.goal).length;
    return (
      <div className="min-h-screen px-4 py-6">
        <div className="max-w-sm mx-auto space-y-4">
          {/* Live score */}
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-xs text-primary-400 font-bold uppercase truncate max-w-[100px]">Tu</p>
              <p className="font-black text-3xl text-primary-400">{myScoreSoFar}</p>
            </div>
            <span className="text-xl text-white/30 font-black">-</span>
            <div className="text-center">
              <p className="text-xs text-red-400 font-bold uppercase truncate max-w-[100px]">{selectedOpp.username}</p>
              <p className="font-black text-3xl text-red-400">{oppScoreSoFar}</p>
            </div>
          </div>

          {lastEntry && (
            <p className={cn('text-xs font-black uppercase tracking-widest text-center animate-pop-in',
              lastEntry.who === 'me' ? 'text-primary-400' : 'text-red-400')}>
              {lastEntry.who === 'me' ? '⚡ IL TUO TIRO' : `🛡️ TIRO DI ${selectedOpp.username.toUpperCase()}`}
            </p>
          )}

          <div className="glass-card p-4 text-center">
            <PenaltyStadium
              revealShot={lastEntry ? { shot: lastEntry.shot.shot, keeper: lastEntry.shot.keeper, goal: lastEntry.shot.goal } : null}
              revealKey={revealed}
            />
            <p className="text-xs text-white/40 font-bold uppercase tracking-widest animate-pulse mt-3">
              {revealed >= revealSeq.length ? 'Fischio finale…' : 'Momento della verità…'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'aiming' && selectedOpp) {
    return (
      <div className="min-h-screen px-4 py-6">
        <div className="max-w-sm mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setPhase('select'); setShots([]); setSelectedOpp(null); }}
              aria-label="Torna alla selezione avversario"
              className="p-2 text-white/40 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="text-center">
              <p className="font-black text-sm text-white">
                Rigore {shots.length + 1} / {COINS.rigoriMaxShots}
              </p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: COINS.rigoriMaxShots }).map((_, i) => (
                <div key={i} className={cn(
                  'w-6 h-6 rounded-lg flex items-center justify-center text-xs',
                  i < shots.length ? 'bg-primary-500/30 text-primary-400' : 'bg-white/10 text-white/20'
                )}>
                  {i < shots.length ? '⚽' : '·'}
                </div>
              ))}
            </div>
          </div>

          {/* VS banner */}
          <div className="glass-card p-4 flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="w-12 h-12 rounded-full bg-primary-500/20 border border-primary-500/40 flex items-center justify-center mx-auto mb-1">
                <User size={20} className="text-primary-400" />
              </div>
              <p className="text-xs font-bold text-primary-400">TU</p>
              <p className="text-[10px] text-white/40">{profile?.coins ?? 0} 🪙</p>
            </div>
            <div className="px-4">
              <Swords size={28} className="text-orange-400 animate-wiggle" />
            </div>
            <div className="text-center flex-1">
              <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto mb-1">
                <User size={20} className="text-red-400" />
              </div>
              <p className="text-xs font-bold text-red-400 truncate max-w-[80px]">
                {selectedOpp.username}
              </p>
              <p className="text-[10px] text-white/40">{selectedOpp.coins} 🪙</p>
            </div>
          </div>

          {/* Stadium + mira */}
          <div className="glass-card p-4 text-center">
            <PenaltyStadium revealShot={null} revealKey="aiming">
              {!aimZone && (
                <PenaltyZoneGrid onPick={z => { vibrate(15); setAimZone(z); }} />
              )}
            </PenaltyStadium>
            <div className="mt-3">
              {!aimZone && (
                <p className="text-sm font-bold text-white/80 animate-pulse">Tocca la porta: dove tiri? 🎯</p>
              )}
              {aimZone && (
                <PenaltyPowerMeter
                  zone={aimZone}
                  onCancel={() => setAimZone(null)}
                  onConfirm={power => kick(aimZone, power)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: opponent selection
  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-sm mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to="/minigiochi" className="p-2 text-white/40 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="font-display font-black text-lg text-white uppercase flex items-center gap-2">
            <Swords size={18} className="text-orange-400" /> SFIDE 1vs1
          </h1>
          <div className="w-8" />
        </div>

        {/* Info card */}
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <span className="text-orange-400">▸</span> Sfida un avversario ai rigori
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <span className="text-orange-400">▸</span> 5 tiri ciascuno, chi segna di più vince
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <span className="text-orange-400">▸</span> Una sfida per coppia ogni {COINS.sfidaCooldownDays} giorni
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <span className="text-orange-400">▸</span> Premio: {COINS.sfidaBaseReward}-{COINS.sfidaMaxReward} 🪙
          </div>
        </div>

        {error && <p className="text-sm text-red-400 animate-shake text-center">{error}</p>}

        {/* Opponent list */}
        {loadingList ? (
          <div className="text-center py-8">
            <Search size={24} className="text-white/30 mx-auto mb-2 animate-pulse" />
            <p className="text-sm text-white/40">Caricamento avversari…</p>
          </div>
        ) : opponents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-white/40">Nessun avversario disponibile</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-widest font-bold">
              Scegli avversario ({opponents.length})
            </p>
            {opponents.map(opp => (
              <button
                key={opp.id}
                onClick={() => challengeOpponent(opp)}
                className="w-full glass-card p-3 flex items-center gap-3 active:scale-[0.98] transition-transform hover:bg-white/5"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                  {opp.avatarUrl ? (
                    <img src={opp.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User size={18} className="text-white/50" />
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-bold text-sm text-white truncate">{opp.username}</p>
                  <p className="text-[10px] text-white/40">
                    {opp.matchdaysPlayed} giornate · {opp.totalPoints} pt
                  </p>
                </div>
                <div className="flex items-center gap-1 text-yellow-400 flex-shrink-0">
                  <Coins size={12} />
                  <span className="text-xs font-bold">{opp.coins}</span>
                </div>
                <Swords size={16} className="text-orange-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
