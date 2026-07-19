import { useEffect, useState } from 'react';
import { BarChart3, Loader2, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/store';
import type { SchedinaResult, Schedina } from '@/types';

function isResult(s: Schedina | SchedinaResult): s is SchedinaResult {
  return 'finalPoints' in s;
}

export function StatistichePage() {
  const { currentUser, schedinaHistory, loadSchedinaHistory, rankings, loadRankings } =
    useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await Promise.all([loadSchedinaHistory(), loadRankings()]);
      setLoading(false);
    })();
  }, [loadSchedinaHistory, loadRankings]);

  const results = schedinaHistory.filter(isResult);
  const totalPredictions = results.reduce((s, r) => s + r.predictions.length, 0);
  const totalCorrect = results.reduce((s, r) => s + r.correctPredictions, 0);
  const hitRate = totalPredictions > 0 ? (totalCorrect / totalPredictions) * 100 : 0;
  const best = results.reduce((max, r) => Math.max(max, r.finalPoints), 0);
  const totalBonus = results.reduce((s, r) => s + r.bonusPoints, 0);
  const totalPenalty = results.reduce((s, r) => s + r.penaltyPoints, 0);
  const myRank = rankings.find(r => r.participantId === currentUser?.id);
  const avgAll =
    rankings.length > 0
      ? rankings.reduce((s, r) => s + r.averagePointsPerMatchday, 0) / rankings.length
      : 0;
  const myAvg = myRank?.averagePointsPerMatchday ?? 0;

  // Trend ultimi 10 risultati (dal più vecchio al più recente)
  const trend = [...results].reverse().slice(-10);
  const trendMax = Math.max(...trend.map(r => r.finalPoints), 1);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="text-primary-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">

        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={20} className="text-emerald-400" />
          <h1 className="page-title">STATISTICHE</h1>
        </div>

        {results.length === 0 ? (
          <div className="glass-card p-8 text-center animate-pop-in">
            <p className="text-5xl mb-3 animate-float inline-block">📊</p>
            <p className="font-bold text-white mb-1">Nessun dato ancora</p>
            <p className="text-xs text-white/40">
              Le statistiche compaiono dopo la prima giornata valutata: gioca la schedina e torna qui!
            </p>
          </div>
        ) : (
          <>
            {/* KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Giornate giocate', value: String(results.length) },
                { label: '% esatti', value: `${hitRate.toFixed(0)}%` },
                { label: 'Miglior giornata', value: `${best.toFixed(1)} pt` },
                { label: 'Posizione', value: myRank ? `#${myRank.rank}` : '—' },
              ].map(k => (
                <div key={k.label} className="glass-card p-3 text-center">
                  <p className="text-lg font-black text-primary-400">{k.value}</p>
                  <p className="text-[9px] text-white/40 uppercase tracking-wide">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Trend */}
            <div className="glass-card p-4">
              <p className="section-title mb-3 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-primary-400" /> Andamento punti
              </p>
              <div className="flex items-end gap-1.5 h-28">
                {trend.map((r, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-white/60">
                      {r.finalPoints.toFixed(0)}
                    </span>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-primary-600 to-primary-400 min-h-[4px]"
                      style={{ height: `${(r.finalPoints / trendMax) * 100}%` }}
                    />
                    <span className="text-[8px] text-white/30">G{r.matchday}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Confronto con la media */}
            <div className="glass-card p-4 space-y-3">
              <p className="section-title">Confronto con la lega</p>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/60">La tua media/giornata</span>
                    <span className="font-bold text-primary-400">{myAvg.toFixed(1)} pt</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500"
                      style={{ width: `${Math.min(100, (myAvg / Math.max(avgAll * 2, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/60">Media della lega</span>
                    <span className="font-bold text-white/70">{avgAll.toFixed(1)} pt</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-white/30" style={{ width: '50%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Bonus/Penalità */}
            <div className="grid grid-cols-2 gap-2">
              <div className="glass-card p-3 text-center">
                <p className="text-lg font-black text-green-400">+{totalBonus}</p>
                <p className="text-[9px] text-white/40 uppercase tracking-wide">Bonus totali</p>
              </div>
              <div className="glass-card p-3 text-center">
                <p className="text-lg font-black text-red-400">{totalPenalty}</p>
                <p className="text-[9px] text-white/40 uppercase tracking-wide">Penalità totali</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
