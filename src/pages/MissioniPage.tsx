import { useState } from 'react';
import { Flag, CheckCircle2, Coins, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MISSIONS } from '@/lib/economy';
import { claimMissionFn, callableErrorMessage } from '@/lib/gameApi';
import { useAuthContext } from '@/contexts/AuthContext';
import { burstConfetti, coinRain, vibrate } from '@/lib/juice';
import { useSilentProfileRefresh } from '@/hooks/useSilentProfileRefresh';

export function MissioniPage() {
  const { profile } = useAuthContext();
  const refreshProfileSilently = useSilentProfileRefresh('MissioniPage');
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const claimed = profile?.claimedMissions ?? [];

  const progressOf = (field: string): number =>
    ((profile as unknown as Record<string, number> | null)?.[field] ?? 0) as number;

  const missions = MISSIONS.map(m => {
    const progress = Math.min(progressOf(m.field), m.target);
    return {
      ...m,
      progress,
      completed: progress >= m.target,
      isClaimed: claimed.includes(m.id),
    };
  });

  const completedCount = missions.filter(m => m.isClaimed).length;
  const claimableCount = missions.filter(m => m.completed && !m.isClaimed).length;
  const earnedCoins = missions
    .filter(m => m.isClaimed)
    .reduce((s, m) => s + m.reward, 0);

  const claim = async (missionId: string) => {
    setError(null);
    setClaiming(missionId);
    try {
      await claimMissionFn(missionId);
    } catch (e) {
      setError(callableErrorMessage(e));
      setClaiming(null);
      return;
    }
    // Il claim è già andato a buon fine lato server a questo punto: festeggia
    // subito e non far dipendere l'esito percepito dal refresh del profilo,
    // altrimenti un fallimento di rete qui mostrerebbe un errore fuorviante
    // su un premio già assegnato (e un retry darebbe "già riscossa").
    vibrate([50, 30, 80]);
    burstConfetti();
    coinRain(1200);
    setClaiming(null);
    refreshProfileSilently();
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">

        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Flag size={20} className="text-pink-400" />
            <h1 className="page-title">MISSIONI</h1>
          </div>
          <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 px-3 py-1.5 rounded-xl animate-pulse-glow">
            <Coins size={14} className="text-yellow-400" />
            <span className="font-black text-sm text-yellow-400">{profile?.coins ?? 0}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="glass-card p-3 text-center">
            <p className="text-xl font-black text-primary-400">{completedCount}</p>
            <p className="text-[9px] text-white/40 uppercase tracking-wide">Completate</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-xl font-black text-white">{claimableCount}</p>
            <p className="text-[9px] text-white/40 uppercase tracking-wide">Da riscuotere</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-xl font-black text-yellow-400">{earnedCoins}</p>
            <p className="text-[9px] text-white/40 uppercase tracking-wide">🪙 Guadagnati</p>
          </div>
        </div>

        {error && (
          <div className="glass-card p-3 border-red-500/30 text-sm text-red-300">{error}</div>
        )}

        {/* Mission list */}
        <div className="space-y-2">
          {missions.map((m, mi) => (
            <div
              key={m.id}
              className={cn(
                'glass-card p-3 animate-slide-up',
                m.isClaimed ? 'border-primary-500/30 opacity-70' : '',
                m.completed && !m.isClaimed ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/10 animate-pulse-glow' : ''
              )}
              style={{ animationDelay: `${mi * 50}ms`, animationFillMode: 'backwards' }}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                  m.isClaimed ? 'bg-primary-500/20 border border-primary-500/40' : 'bg-white/5',
                  m.completed && !m.isClaimed && 'animate-wiggle'
                )}>
                  {m.isClaimed ? (
                    <CheckCircle2 size={18} className="text-primary-400" />
                  ) : m.completed ? (
                    <span className="text-lg">🎁</span>
                  ) : (
                    <Flag size={16} className="text-pink-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('font-bold text-sm', m.isClaimed ? 'text-primary-400 line-through' : 'text-white')}>
                      {m.name}
                    </p>
                    <span className="text-[10px] font-black text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                      +{m.reward} 🪙
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">{m.description}</p>
                  {!m.isClaimed && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[9px] mb-1">
                        <span className="text-white/30">Progresso</span>
                        <span className="text-white/60 font-bold">{m.progress}/{m.target}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-700"
                          style={{
                            width: `${(m.progress / m.target) * 100}%`,
                            boxShadow: m.progress > 0 ? '0 0 8px rgba(132,216,12,0.6)' : 'none',
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {m.completed && !m.isClaimed && (
                    <button
                      onClick={() => claim(m.id)}
                      disabled={claiming === m.id}
                      className="mt-2 flex items-center gap-1.5 bg-gradient-to-r from-yellow-500 to-orange-400 hover:from-yellow-400 hover:to-orange-300 text-black font-black text-[11px] uppercase px-4 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-60 shadow-lg shadow-yellow-500/30 animate-heartbeat"
                    >
                      {claiming === m.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Coins size={12} />
                      )}
                      Riscuoti +{m.reward}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
