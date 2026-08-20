import { useEffect, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import {
  getPrizes,
  getRankings,
  getWeeklyPrizes,
  getCurrentMatchdayNumber,
  type PrizeDoc,
  type WeeklyPrizeItem,
} from '@/lib/db';
import { DEFAULT_WEEKLY_PRIZES } from '@/lib/economy';
import { useAuthContext } from '@/contexts/AuthContext';

const PRIZE_LABELS: Record<PrizeDoc['type'], { label: string; icon: string }> = {
  weekly_winner: { label: 'Vincitore di Giornata', icon: '🏆' },
};

export function PremiPage() {
  const { profile } = useAuthContext();
  const [prizes, setPrizes] = useState<PrizeDoc[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [participantCount, setParticipantCount] = useState(0);
  const [premiSettimana, setPremiSettimana] = useState<WeeklyPrizeItem[]>(DEFAULT_WEEKLY_PRIZES);
  const [giornata, setGiornata] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [prizeDocs, rankings, numeroGiornata] = await Promise.all([
          getPrizes(),
          getRankings(),
          getCurrentMatchdayNumber(),
        ]);
        setPrizes(prizeDocs);
        setParticipantCount(rankings.length);
        setUsernames(
          Object.fromEntries(rankings.map(r => [r.participantId, r.username]))
        );
        setGiornata(numeroGiornata);
        if (numeroGiornata != null) {
          // Assenti = l'admin non li ha ancora scelti: valgono quelli di partenza.
          const scelti = await getWeeklyPrizes(numeroGiornata);
          if (scelti) setPremiSettimana(scelti);
        }
      } catch {
        /* best-effort */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">

        <div className="flex items-center gap-2 mb-1">
          <Gift size={20} className="text-cyan-400" />
          <h1 className="page-title">PREMI</h1>
        </div>

        {/* Premi in palio questa giornata (decisi dall'amministratore) */}
        <div className="relative overflow-hidden rounded-2xl p-4 border border-cyan-500/25 bg-gradient-to-br from-[#04202a] via-[#062b38] to-[#020f14] animate-pop-in">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 bottom-0 w-20 bg-white/8 animate-shine" />
          </div>
          <div className="absolute -right-4 -bottom-6 text-[80px] opacity-15 select-none animate-float">🎁</div>
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] text-cyan-200/50 uppercase tracking-widest">
                  In palio {giornata != null ? `nella giornata ${giornata}` : 'questa giornata'}
                </p>
                <p className="text-sm text-white/60 mt-0.5">
                  {participantCount} in gara: vince chi fa più punti nella giornata.
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-white/40 uppercase tracking-widest">I tuoi gettoni</p>
                <p className="text-xl font-black text-yellow-400 mt-0.5">{profile?.coins ?? 0} 🪙</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {premiSettimana.map((premio, i) => (
                <div
                  key={premio.position}
                  className="flex items-center gap-3 rounded-xl bg-black/25 border border-white/10 px-3 py-2 animate-slide-up"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
                >
                  <span className="text-lg">
                    {premio.position === 1 ? '🥇' : premio.position === 2 ? '🥈' : premio.position === 3 ? '🥉' : '🎖️'}
                  </span>
                  <span className="text-sm font-bold text-white flex-1">{premio.label}</span>
                  {premio.emoji && <span className="text-lg">{premio.emoji}</span>}
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
                    <p className="font-bold text-sm text-white">Giornata {p.matchday}</p>
                    {p.podio && p.podio.length > 0 ? (
                      <div className="mt-1 space-y-0.5">
                        {p.podio.map(riga => (
                          <p key={riga.position} className="text-[11px] text-white/50">
                            <span className="text-white/80 font-bold">
                              {riga.position}. {riga.username}
                            </span>{' '}
                            · {riga.prize}
                            {riga.emoji ? ` ${riga.emoji}` : ''} · {riga.points.toFixed(1)} pt
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-white/40">
                        {info.label}: {usernames[p.winnerId] ?? p.winnerId}
                        {p.points != null && ` · ${p.points.toFixed(1)} pt`}
                      </p>
                    )}
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
