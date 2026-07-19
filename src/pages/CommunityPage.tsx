import { useEffect, useState } from 'react';
import { Users, Trophy, Loader2, Flame } from 'lucide-react';
import { getRecentSettledSchedine, getRankings, type SchedinaDoc } from '@/lib/db';
import type { RankingEntry } from '@/types';

export function CommunityPage() {
  const [feed, setFeed] = useState<SchedinaDoc[]>([]);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [schedine, ranks] = await Promise.all([
          getRecentSettledSchedine(20),
          getRankings(),
        ]);
        setFeed(schedine);
        setRankings(ranks);
      } catch {
        /* best-effort */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalPlayers = rankings.length;
  const perfectCount = rankings.reduce((s, r) => s + r.perfectSchedine, 0);
  const avgPoints =
    totalPlayers > 0
      ? rankings.reduce((s, r) => s + r.averagePointsPerMatchday, 0) / totalPlayers
      : 0;

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">

        <div className="flex items-center gap-2 mb-1">
          <Users size={20} className="text-violet-400" />
          <h1 className="page-title">COMMUNITY</h1>
        </div>

        {/* Stats reali */}
        <div className="grid grid-cols-3 gap-2">
          <div className="glass-card p-3 text-center">
            <p className="text-xl font-black text-primary-400">{totalPlayers}</p>
            <p className="text-[9px] text-white/40 uppercase tracking-wide">Giocatori</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-xl font-black text-yellow-400">{perfectCount}</p>
            <p className="text-[9px] text-white/40 uppercase tracking-wide">Schedine 10/10</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-xl font-black text-white">{avgPoints.toFixed(1)}</p>
            <p className="text-[9px] text-white/40 uppercase tracking-wide">Media pt/giornata</p>
          </div>
        </div>

        {/* Feed schedine valutate */}
        <p className="section-title flex items-center gap-1.5">
          <Flame size={14} className="text-orange-400" /> Ultime schedine valutate
        </p>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={28} className="text-primary-400 animate-spin" />
          </div>
        ) : feed.length === 0 ? (
          <div className="glass-card p-8 text-center animate-pop-in">
            <p className="text-5xl mb-3 animate-float inline-block">📣</p>
            <p className="font-bold text-white mb-1">Ancora nessuna attività</p>
            <p className="text-xs text-white/40">
              Il feed si popola dopo la prima giornata valutata: sarà pieno di sfide, sorpassi e sfottò!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {feed.map(s => (
              <div key={s.id} className="glass-card p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center font-black text-primary-400 text-sm flex-shrink-0">
                    {s.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white truncate">
                      {s.username}
                      {s.correctPredictions >= 10 && (
                        <span className="ml-2 text-[9px] font-black text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded uppercase">
                          Perfetta! 🏆
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-white/40">
                      Giornata {s.matchdayNumber} · {s.correctPredictions}/
                      {s.predictions.length} esatti
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black gradient-text">{s.finalPoints.toFixed(1)} pt</p>
                    {s.bonusPoints > 0 && (
                      <p className="text-[10px] text-green-400 font-bold">
                        +{s.bonusPoints} bonus
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Top 3 */}
        {rankings.length > 0 && (
          <>
            <p className="section-title flex items-center gap-1.5">
              <Trophy size={14} className="text-yellow-400" /> Podio attuale
            </p>
            <div className="grid grid-cols-3 gap-2">
              {rankings.slice(0, 3).map((r, i) => (
                <div key={r.participantId} className="glass-card p-3 text-center">
                  <p className="text-2xl mb-1">{['🥇', '🥈', '🥉'][i]}</p>
                  <p className="font-bold text-xs text-white truncate">{r.username}</p>
                  <p className="text-[11px] font-black gradient-text">
                    {r.totalPoints.toFixed(1)} pt
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
