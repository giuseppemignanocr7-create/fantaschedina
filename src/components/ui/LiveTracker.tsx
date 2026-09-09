import { Play, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateBetPoints, evaluateBet } from '@/lib/scoring';
import type { Match, Prediction } from '@/types';
import type { LiveScore } from '@/services/footballApi';

interface LiveTrackerProps {
  matches: Match[];
  predictions: Prediction[];
  liveScores?: Record<string, LiveScore>;
  className?: string;
}

type PredStatus = 'winning' | 'losing' | 'pending' | 'none';

/**
 * Stato live di un pronostico rispetto al risultato reale corrente:
 * - winning: attualmente soddisfatto
 * - losing: partita finita e non soddisfatto
 * - pending: in corso ma non ancora soddisfatto (può ancora cambiare)
 */
function predictionStatus(
  match: Match | undefined,
  prediction: Prediction | undefined
): PredStatus {
  if (!match || !prediction) return 'none';
  if (match.status === 'scheduled' || !match.result) return 'pending';
  const ev = evaluateBet(prediction.betType, prediction.outcome, match.result);
  if (ev === null) return 'pending';
  if (ev === true) return 'winning';
  return match.status === 'finished' ? 'losing' : 'pending';
}

export function LiveTracker({ matches, predictions, liveScores = {}, className }: LiveTrackerProps) {
  const getPredictionStatus = (matchId: string): PredStatus =>
    predictionStatus(
      matches.find(m => m.id === matchId),
      predictions.find(p => p.matchId === matchId)
    );

  const anyMatchLive = matches.some(m => m.status === 'live');

  const stats = {
    winning: matches.filter(m => getPredictionStatus(m.id) === 'winning').length,
    losing: matches.filter(m => getPredictionStatus(m.id) === 'losing').length,
    pending: matches.filter(m => getPredictionStatus(m.id) === 'pending').length,
  };

  // Punti live reali: somma dei punti dei pronostici attualmente vincenti
  const livePoints = predictions.reduce(
    (sum, p) => (getPredictionStatus(p.matchId) === 'winning' ? sum + calculateBetPoints(p.odds, true) : sum),
    0
  );

  return (
    <div className={cn('glass-card overflow-hidden border border-slate-200', className)}>
      <div className="bg-surface px-4 py-3 border-b border-slate-200 flex items-center justify-center relative">
        {anyMatchLive && (
          <div className="absolute left-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-live animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <span className="text-xs font-bold text-live uppercase tracking-wider">In Diretta</span>
          </div>
        )}
        <h3 className="font-display font-bold text-slate-900 uppercase tracking-wide text-sm">
          Tracker Partite
        </h3>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 bg-surface/50">
        <div className="p-3 text-center">
          <p className="text-xl font-mono font-bold text-green-600">{stats.winning}</p>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Vincenti</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-xl font-mono font-bold text-yellow-700">{stats.pending}</p>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">In Attesa</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-xl font-mono font-bold text-live">{stats.losing}</p>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Perdenti</p>
        </div>
      </div>

      {/* Live Matches */}
      <div className="max-h-80 overflow-y-auto divide-y divide-slate-200 bg-surface/30">
        {matches.slice(0, 10).map((match) => {
          const prediction = predictions.find(p => p.matchId === match.id);
          const status = getPredictionStatus(match.id);
          const live = liveScores[match.id];
          const score = match.result;
          const started = match.status === 'live' || match.status === 'finished';

          return (
            <div key={match.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-100 transition-colors">
              {/* Status Icon */}
              <div className="shrink-0">
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center border',
                  status === 'winning' && 'bg-green-500/10 border-green-500/20 text-green-600',
                  status === 'losing' && 'bg-live/10 border-live/20 text-live',
                  status === 'pending' && 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700',
                  status === 'none' && 'bg-slate-100 border-slate-200 text-slate-500'
                )}>
                  {status === 'winning' && <CheckCircle2 size={16} />}
                  {status === 'losing' && <XCircle size={16} />}
                  {status === 'pending' && <Clock size={16} />}
                  {status === 'none' && <Play size={16} />}
                </div>
              </div>

              {/* Match Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 text-sm mb-1">
                  <span className="font-bold text-slate-900 truncate w-1/3 text-right">{match.homeTeam.shortName}</span>
                  
                  {started && score ? (
                    <span className={cn(
                      'font-mono font-bold px-2 py-0.5 rounded text-xs min-w-[40px] text-center border',
                      match.status === 'live'
                        ? 'bg-live text-slate-900 border-live'
                        : 'bg-surface text-slate-900 border-slate-200'
                    )}>
                      {score.homeGoals}-{score.awayGoals}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 min-w-[40px] text-center">vs</span>
                  )}
                  
                  <span className="font-bold text-slate-900 truncate w-1/3 text-left">{match.awayTeam.shortName}</span>
                </div>
                
                <div className="flex justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {match.status === 'scheduled' && 'In Arrivo'}
                    {match.status === 'live' && (
                      <span className="text-live animate-pulse">{live?.displayClock ?? 'LIVE'}</span>
                    )}
                    {match.status === 'finished' && 'FT'}
                  </span>
                </div>
              </div>

              {/* Prediction */}
              {prediction && (
                <div className={cn(
                  'flex flex-col items-center justify-center min-w-[40px] px-2 py-1 rounded border',
                  status === 'winning' && 'bg-green-500/10 border-green-500/20 text-green-600',
                  status === 'losing' && 'bg-live/10 border-live/20 text-live',
                  status === 'pending' && 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700',
                  status === 'none' && 'bg-slate-100 border-slate-200 text-slate-500'
                )}>
                  <span className="text-[10px] font-bold uppercase opacity-70">Scelta</span>
                  <span className="text-sm font-bold">{prediction.outcome}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Potential Points */}
      {predictions.length > 0 && (
        <div className="p-3 bg-surface border-t border-slate-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 flex items-center gap-2 font-medium uppercase tracking-wide text-xs">
              <Zap size={14} className="text-accent-700" />
              Punti Live
            </span>
            <span className="font-mono font-bold text-lg text-slate-900">
              {livePoints.toFixed(0)} <span className="text-xs text-slate-500">pt</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
