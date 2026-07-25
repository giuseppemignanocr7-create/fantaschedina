import { useEffect, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { getPrizes, getRankings, type PrizeDoc } from '@/lib/db';
import { DEFAULT_TOURNAMENT_CONFIG } from '@/lib/scoring';
import { useAuthContext } from '@/contexts/AuthContext';

const PRIZE_LABELS: Record<PrizeDoc['type'], { label: string; icon: string }> = {
  weekly_winner: { label: 'Vincitore di Giornata', icon: '🏆' },
};

export function PremiPage() {
  const { profile } = useAuthContext();
  const [prizes, setPrizes] = useState<PrizeDoc[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [prizeDocs, rankings] = await Promise.all([getPrizes(), getRankings()]);
        setPrizes(prizeDocs);
        setParticipantCount(rankings.length);
        setUsernames(
          Object.fromEntries(rankings.map(r => [r.participantId, r.username]))
        );
      } catch {
        /* best-effort */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cfg = DEFAULT_TOURNAMENT_CONFIG;
  // Montepremi reale: quota iscrizione × partecipanti + quote settimanali maturate
  const weeklyPrizesAwarded = prizes.filter(p => p.type === 'weekly_winner').length;
  const totalPool =
    participantCount * cfg.participationFee +
    weeklyPrizesAwarded * participantCount * cfg.weeklyFeeToPool;

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">

        <div className="flex items-center gap-2 mb-1">
          <Gift size={20} className="text-cyan-400" />
          <h1 className="page-title">PREMI</h1>
        </div>

        {/* Montepremi reale */}
        <div className="relative overflow-hidden rounded-2xl p-4 flex items-center justify-between border border-yellow-500/25 bg-gradient-to-br from-[#1a1400] via-[#241a02] to-[#0f0c00] animate-pop-in">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 bottom-0 w-20 bg-white/8 animate-shine" />
          </div>
          <div className="absolute -right-4 -bottom-6 text-[80px] opacity-15 select-none animate-float">💰</div>
          <div className="relative">
            <p className="text-[10px] text-yellow-200/50 uppercase tracking-widest">Montepremi stimato</p>
            <p className="text-4xl font-black text-yellow-400 mt-0.5 drop-shadow-[0_0_12px_rgba(250,204,21,0.35)]">
              €{totalPool.toLocaleString('it-IT')}
            </p>
            <p className="text-[10px] text-white/30 mt-1">
              {participantCount} partecipanti × €{cfg.participationFee} + quote settimanali
            </p>
          </div>
          <div className="relative text-right">
            <p className="text-[10px] text-white/40 uppercase tracking-widest">I tuoi gettoni</p>
            <p className="text-xl font-black text-yellow-400 mt-0.5">{profile?.coins ?? 0} 🪙</p>
          </div>
        </div>

        {/* Struttura premi (dal regolamento), divisa fine stagione / settimanali */}
        <div className="glass-card p-4 space-y-4">
          <div>
            <p className="section-title mb-3">Premi Fine Stagione</p>
            <div className="space-y-3">
              {[
                { icon: '🥇', label: '1° Classificato finale', value: `€${cfg.firstPlacePrize}` },
                { icon: '🥈', label: '1° Girone d\'andata', value: `€${cfg.firstHalfPrize}` },
              ].map((row, ri) => (
                <div
                  key={row.label}
                  className="flex justify-between items-center animate-slide-up rounded-xl px-2 py-1.5 -mx-2 hover:bg-white/5 transition-colors"
                  style={{ animationDelay: `${ri * 60}ms`, animationFillMode: 'backwards' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{row.icon}</span>
                    <span className="text-sm font-bold text-white">{row.label}</span>
                  </div>
                  <span className="font-black text-accent-400 text-sm">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="section-title mb-3">Premi Settimanali</p>
            <div className="space-y-3">
              {[
                { icon: '🏆', label: 'Vincitore settimanale', value: `${cfg.weeklyWinnerShare * 100}% pool settimanale` },
              ].map((row, ri) => (
                <div
                  key={row.label}
                  className="flex justify-between items-center animate-slide-up rounded-xl px-2 py-1.5 -mx-2 hover:bg-white/5 transition-colors"
                  style={{ animationDelay: `${ri * 60}ms`, animationFillMode: 'backwards' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{row.icon}</span>
                    <span className="text-sm font-bold text-white">{row.label}</span>
                  </div>
                  <span className="font-black text-accent-400 text-sm">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Albo d'oro (dai settlement reali) */}
        <p className="section-title">Albo d'Oro</p>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="text-primary-400 animate-spin" />
          </div>
        ) : prizes.length === 0 ? (
          <div className="glass-card p-8 text-center animate-pop-in">
            <p className="text-5xl mb-3 animate-float inline-block">🏆</p>
            <p className="font-bold text-white">L'albo d'oro ti aspetta!</p>
            <p className="text-sm text-white/40 mt-1">
              I vincitori appariranno qui dopo la prima giornata valutata.
              Potresti essere il primo della storia! ✨
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {prizes.map((p, i) => {
              const info = PRIZE_LABELS[p.type];
              return (
                <div
                  key={i}
                  className="glass-card p-3 flex items-center gap-3 animate-slide-up hover:bg-white/5 transition-colors"
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}
                >
                  <span className="text-2xl">{info.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white">
                      {usernames[p.winnerId] ?? p.winnerId}
                    </p>
                    <p className="text-[11px] text-white/40">
                      {info.label} · Giornata {p.matchday}
                      {p.points != null && ` · ${p.points.toFixed(1)} pt`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
