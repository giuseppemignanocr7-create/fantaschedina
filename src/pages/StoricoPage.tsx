import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Trophy,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { getPrizes } from '@/lib/db';
import type { Schedina, SchedinaResult } from '@/types';
import { SkeletonList, EmptyState } from '@/components/ui';

type FilterType = 'tutti' | 'vinte' | 'perse';

function isResult(s: Schedina | SchedinaResult): s is SchedinaResult {
  return (s as SchedinaResult).finalPoints !== undefined;
}

export function StoricoPage() {
  const { currentUser, currentMatchday, schedinaHistory, isLoadingHistory, loadSchedinaHistory } = useAppStore();
  const [filter, setFilter] = useState<FilterType>('tutti');
  const [expandedMatchday, setExpandedMatchday] = useState<number | null>(null);
  const [winnerMatchdays, setWinnerMatchdays] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!currentUser) return;
    loadSchedinaHistory();
    getPrizes()
      .then(prizes =>
        setWinnerMatchdays(
          new Set(
            prizes
              .filter(p => p.type === 'weekly_winner' && p.winnerId === currentUser.id)
              .map(p => p.matchday)
          )
        )
      )
      .catch(() => setWinnerMatchdays(new Set()));
  }, [currentUser, loadSchedinaHistory]);

  const items = useMemo(() => {
    return schedinaHistory.map(s => {
      const settled = isResult(s);
      return {
        raw: s,
        matchday: s.matchday,
        date: s.submittedAt
          ? new Date(s.submittedAt).toLocaleDateString('it-IT', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : '-',
        totalPoints: settled ? Math.round(s.finalPoints * 10) / 10 : 0,
        correctPredictions: settled ? s.correctPredictions : 0,
        bonusPoints: settled ? s.bonusPoints : 0,
        penaltyPoints: settled ? s.penaltyPoints : 0,
        isWinner: settled && winnerMatchdays.has(s.matchday),
        settled,
        predictions: settled
          ? s.predictions.map(p => ({
              matchId: p.matchId,
              prediction: String(p.outcome),
              odds: p.odds,
              correct: p.isCorrect,
            }))
          : [],
      };
    });
  }, [schedinaHistory, winnerMatchdays]);

  const filtered = items.filter(s => {
    if (filter === 'vinte') return s.isWinner;
    if (filter === 'perse') return !s.isWinner && s.settled;
    return true;
  });

  const totalStats = useMemo(() => {
    const settled = items.filter(s => s.settled);
    if (settled.length === 0) {
      return {
        totalSchedine: items.length,
        wins: 0,
        avgPoints: '0.0',
        avgCorrect: '0.0',
      };
    }
    const totalPts = settled.reduce((acc, s) => acc + s.totalPoints, 0);
    const totalCorr = settled.reduce((acc, s) => acc + s.correctPredictions, 0);
    return {
      totalSchedine: items.length,
      wins: settled.filter(s => s.isWinner).length,
      avgPoints: (totalPts / settled.length).toFixed(1),
      avgCorrect: (totalCorr / settled.length).toFixed(1),
    };
  }, [items]);

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-primary-400 text-sm font-bold uppercase tracking-wider mb-1">
                <Calendar size={16} />
                Archivio Giocate
              </div>
              <h1 className="text-3xl sm:text-5xl font-display font-black uppercase italic tracking-tight text-white">
                Storico{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">
                  Schedine
                </span>
              </h1>
            </div>
          </div>
          <p className="text-slate-400 font-medium">
            Tutte le tue schedine della stagione {currentMatchday?.season ?? 'corrente'}
          </p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="glass-card p-4 text-center border-t-2 border-primary-500">
            <p className="text-3xl font-mono font-bold text-white">{totalStats.totalSchedine}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              Schedine
            </p>
          </div>
          <div className="glass-card p-4 text-center border-t-2 border-yellow-500">
            <p className="text-3xl font-mono font-bold text-yellow-400">{totalStats.wins}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              Vittorie
            </p>
          </div>
          <div className="glass-card p-4 text-center border-t-2 border-accent-500">
            <p className="text-3xl font-mono font-bold text-accent-400">{totalStats.avgPoints}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              Media Punti
            </p>
          </div>
          <div className="glass-card p-4 text-center border-t-2 border-green-500">
            <p className="text-3xl font-mono font-bold text-green-400">{totalStats.avgCorrect}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              Media Corretti
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-6 p-1 bg-surface/50 rounded-xl border border-white/5 backdrop-blur-sm w-fit" role="group" aria-label="Filtra storico">
          <div className="pl-3 text-slate-500">
            <Filter size={16} />
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex gap-1">
            {(['tutti', 'vinte', 'perse'] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all',
                  filter === f
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoadingHistory && (
          <SkeletonList count={4} type="card" />
        )}

        {/* Schedine List */}
        {!isLoadingHistory && (
          <div className="space-y-4">
            {filtered.map(schedina => {
              const isExpanded = expandedMatchday === schedina.matchday;
              return (
                <div
                  key={schedina.matchday}
                  className="glass-card overflow-hidden border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div
                    className={cn(
                      'p-4 sm:p-5 cursor-pointer transition-colors',
                      schedina.isWinner
                        ? 'bg-gradient-to-r from-yellow-500/10 to-transparent'
                        : 'hover:bg-white/5'
                    )}
                    onClick={() =>
                      setExpandedMatchday(isExpanded ? null : schedina.matchday)
                    }
                  >
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div
                        className={cn(
                          'w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-bold border',
                          schedina.isWinner
                            ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                            : 'bg-surface border-white/10 text-slate-400'
                        )}
                      >
                        <span className="text-[10px] uppercase font-normal opacity-70">G</span>
                        <span className="text-xl leading-none">{schedina.matchday}</span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-display font-bold text-lg uppercase italic tracking-wide text-white">
                            Giornata {schedina.matchday}
                          </span>
                          {schedina.isWinner && (
                            <span className="flex items-center gap-1 text-yellow-400 text-[10px] font-bold uppercase tracking-wider bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                              <Trophy size={10} />
                              Vincitore
                            </span>
                          )}
                          {!schedina.settled && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20">
                              In attesa risultati
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-2">
                          <Calendar size={14} />
                          {schedina.date}
                        </p>
                      </div>

                      <div className="text-right hidden sm:block">
                        <p className="font-mono font-bold text-2xl text-white">
                          {schedina.totalPoints}{' '}
                          <span className="text-sm text-slate-500">pt</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {schedina.settled ? `${schedina.correctPredictions}/10 corretti` : '—'}
                        </p>
                      </div>

                      <ChevronDown
                        size={20}
                        className={cn(
                          'text-slate-500 transition-transform duration-300',
                          isExpanded && 'rotate-180 text-primary-400'
                        )}
                      />
                    </div>
                  </div>

                  <div
                    className={cn(
                      'overflow-hidden transition-all duration-300 bg-black/20',
                      isExpanded && schedina.predictions.length > 0
                        ? 'max-h-[800px]'
                        : 'max-h-0'
                    )}
                  >
                    <div className="border-t border-white/10">
                      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-surface/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-white/5">
                        <div className="col-span-7 sm:col-span-7">Match</div>
                        <div className="col-span-3 text-center">Esito</div>
                        <div className="col-span-2 text-right">Quota</div>
                      </div>
                      <div className="divide-y divide-white/5">
                        {schedina.predictions.map((pred, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-white/5 transition-colors"
                          >
                            <div className="col-span-7 sm:col-span-7 flex items-center gap-3">
                              <div
                                className={cn(
                                  'w-6 h-6 rounded-full flex items-center justify-center shrink-0 border',
                                  pred.correct
                                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                                )}
                              >
                                {pred.correct ? (
                                  <CheckCircle2 size={12} />
                                ) : (
                                  <XCircle size={12} />
                                )}
                              </div>
                              <p className="text-sm font-mono text-white/70 truncate">
                                {pred.matchId}
                              </p>
                            </div>
                            <div className="col-span-3 text-center">
                              <span
                                className={cn(
                                  'font-bold font-mono',
                                  pred.correct ? 'text-green-400' : 'text-red-400'
                                )}
                              >
                                {pred.prediction}
                              </span>
                            </div>
                            <div className="col-span-2 text-right">
                              <span
                                className={cn(
                                  'font-bold font-mono',
                                  pred.correct ? 'text-primary-400' : 'text-slate-600'
                                )}
                              >
                                {pred.odds.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {isExpanded && schedina.predictions.length === 0 && (
                    <div className="border-t border-white/10 p-4 text-center text-white/50 text-sm">
                      Dettagli non disponibili — schedina non ancora valutata
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isLoadingHistory && filtered.length === 0 && (
          <EmptyState
            icon={items.length === 0 ? '📋' : '🔍'}
            title={items.length === 0 ? 'Nessuno storico' : 'Nessun risultato'}
            message={items.length === 0
              ? 'Il tuo storico è tutto da scrivere: gioca la prima schedina!'
              : 'Nessuna schedina trovata con questo filtro'}
            ctaLabel={items.length === 0 ? 'Gioca ora' : undefined}
            ctaTo={items.length === 0 ? '/pronostici' : undefined}
          />
        )}
      </div>
    </div>
  );
}
