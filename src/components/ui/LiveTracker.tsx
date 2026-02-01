import { useState, useEffect } from 'react';
import { 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Match, Prediction } from '@/types';

interface LiveTrackerProps {
  matches: Match[];
  predictions: Prediction[];
  className?: string;
}

interface LiveMatchState {
  matchId: string;
  minute: number;
  homeScore: number;
  awayScore: number;
  status: 'not_started' | 'first_half' | 'half_time' | 'second_half' | 'finished';
  currentOutcome: '1' | 'X' | '2';
}

// Mock live data (in produzione verrebbe da API esterne)
const generateMockLiveState = (matchId: string): LiveMatchState => {
  const statuses: LiveMatchState['status'][] = ['not_started', 'first_half', 'half_time', 'second_half', 'finished'];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  
  let minute = 0;
  if (randomStatus === 'first_half') minute = Math.floor(Math.random() * 45) + 1;
  if (randomStatus === 'half_time') minute = 45;
  if (randomStatus === 'second_half') minute = Math.floor(Math.random() * 45) + 46;
  if (randomStatus === 'finished') minute = 90;

  const homeScore = Math.floor(Math.random() * 4);
  const awayScore = Math.floor(Math.random() * 4);
  
  let currentOutcome: '1' | 'X' | '2' = 'X';
  if (homeScore > awayScore) currentOutcome = '1';
  if (awayScore > homeScore) currentOutcome = '2';

  return {
    matchId,
    minute,
    homeScore,
    awayScore,
    status: randomStatus,
    currentOutcome,
  };
};

export function LiveTracker({ matches, predictions, className }: LiveTrackerProps) {
  const [liveStates, setLiveStates] = useState<Record<string, LiveMatchState>>({});
  const [isSimulating, setIsSimulating] = useState(false);

  // Inizializza stati live
  useEffect(() => {
    const initialStates: Record<string, LiveMatchState> = {};
    matches.forEach(m => {
      initialStates[m.id] = generateMockLiveState(m.id);
    });
    setLiveStates(initialStates);
  }, [matches]);

  // Simulazione live (per demo)
  useEffect(() => {
    if (!isSimulating) return;
    
    const interval = setInterval(() => {
      setLiveStates(prev => {
        const newStates = { ...prev };
        Object.keys(newStates).forEach(matchId => {
          const state = newStates[matchId];
          if (state.status !== 'finished' && state.status !== 'not_started') {
            // Incrementa minuto
            let newMinute = state.minute + 1;
            let newStatus: LiveMatchState['status'] = state.status;
            
            if (newMinute === 45) newStatus = 'half_time';
            if (newMinute === 46) newStatus = 'second_half';
            if (newMinute >= 90) {
              newMinute = 90;
              newStatus = 'finished';
            }

            // Possibilità di gol
            if (Math.random() < 0.02) {
              if (Math.random() < 0.5) {
                state.homeScore++;
              } else {
                state.awayScore++;
              }
            }

            let outcome: '1' | 'X' | '2' = 'X';
            if (state.homeScore > state.awayScore) outcome = '1';
            if (state.awayScore > state.homeScore) outcome = '2';

            newStates[matchId] = {
              ...state,
              minute: newMinute,
              status: newStatus,
              currentOutcome: outcome,
            };
          }
        });
        return newStates;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSimulating]);

  const getPredictionStatus = (matchId: string): 'winning' | 'losing' | 'pending' | 'none' => {
    const prediction = predictions.find(p => p.matchId === matchId);
    const liveState = liveStates[matchId];
    
    if (!prediction || !liveState) return 'none';
    if (liveState.status === 'not_started') return 'pending';
    
    // Solo per esito 1X2
    if (prediction.betType === 'esito') {
      return prediction.outcome === liveState.currentOutcome ? 'winning' : 'losing';
    }
    
    // Per over/under
    if (prediction.betType === 'over_under') {
      const totalGoals = liveState.homeScore + liveState.awayScore;
      if (prediction.outcome === 'OVER') {
        return totalGoals > 2 ? 'winning' : (liveState.status === 'finished' ? 'losing' : 'pending');
      } else {
        return totalGoals < 3 ? 'winning' : 'losing';
      }
    }

    // Per goal/nogoal
    if (prediction.betType === 'goal_nogoal') {
      const bothScored = liveState.homeScore > 0 && liveState.awayScore > 0;
      if (prediction.outcome === 'GG') {
        return bothScored ? 'winning' : (liveState.status === 'finished' ? 'losing' : 'pending');
      } else {
        return !bothScored ? 'winning' : 'losing';
      }
    }

    return 'pending';
  };

  const stats = {
    winning: matches.filter(m => getPredictionStatus(m.id) === 'winning').length,
    losing: matches.filter(m => getPredictionStatus(m.id) === 'losing').length,
    pending: matches.filter(m => getPredictionStatus(m.id) === 'pending').length,
  };

  return (
    <div className={cn('glass-card overflow-hidden border border-white/5', className)}>
      <div className="bg-surface px-4 py-3 border-b border-white/5 flex items-center justify-center relative">
        <div className="absolute left-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-live animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          <span className="text-xs font-bold text-live uppercase tracking-wider">In Diretta</span>
        </div>
        <h3 className="font-display font-bold text-white uppercase tracking-wide text-sm">
          Tracker Partite
        </h3>
        <button
          onClick={() => setIsSimulating(!isSimulating)}
          className={cn(
            'absolute right-4 text-[10px] px-2 py-1 rounded border font-bold uppercase tracking-wider transition-all',
            isSimulating 
              ? 'bg-live/10 text-live border-live/30 hover:bg-live/20' 
              : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
          )}
        >
          {isSimulating ? 'Stop' : 'Demo'}
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 divide-x divide-white/5 border-b border-white/5 bg-surface/50">
        <div className="p-3 text-center">
          <p className="text-xl font-mono font-bold text-green-400">{stats.winning}</p>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Vincenti</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-xl font-mono font-bold text-yellow-400">{stats.pending}</p>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">In Attesa</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-xl font-mono font-bold text-live">{stats.losing}</p>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Perdenti</p>
        </div>
      </div>

      {/* Live Matches */}
      <div className="max-h-80 overflow-y-auto divide-y divide-white/5 bg-surface/30">
        {matches.slice(0, 8).map((match) => {
          const liveState = liveStates[match.id];
          const prediction = predictions.find(p => p.matchId === match.id);
          const status = getPredictionStatus(match.id);

          if (!liveState) return null;

          return (
            <div key={match.id} className="px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
              {/* Status Icon */}
              <div className="shrink-0">
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center border',
                  status === 'winning' && 'bg-green-500/10 border-green-500/20 text-green-400',
                  status === 'losing' && 'bg-live/10 border-live/20 text-live',
                  status === 'pending' && 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
                  status === 'none' && 'bg-white/5 border-white/10 text-slate-500'
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
                  <span className="font-bold text-white truncate w-1/3 text-right">{match.homeTeam.shortName}</span>
                  
                  {liveState.status !== 'not_started' ? (
                    <span className="font-mono font-bold text-white bg-surface border border-white/10 px-2 py-0.5 rounded text-xs min-w-[40px] text-center">
                      {liveState.homeScore}-{liveState.awayScore}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 min-w-[40px] text-center">vs</span>
                  )}
                  
                  <span className="font-bold text-white truncate w-1/3 text-left">{match.awayTeam.shortName}</span>
                </div>
                
                <div className="flex justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {liveState.status === 'not_started' && 'In Arrivo'}
                    {liveState.status === 'first_half' && <span className="text-green-400 animate-pulse">{liveState.minute}'</span>}
                    {liveState.status === 'half_time' && <span className="text-yellow-400">Int.</span>}
                    {liveState.status === 'second_half' && <span className="text-green-400 animate-pulse">{liveState.minute}'</span>}
                    {liveState.status === 'finished' && 'FT'}
                  </span>
                </div>
              </div>

              {/* Prediction */}
              {prediction && (
                <div className={cn(
                  'flex flex-col items-center justify-center min-w-[40px] px-2 py-1 rounded border',
                  status === 'winning' && 'bg-green-500/10 border-green-500/20 text-green-400',
                  status === 'losing' && 'bg-live/10 border-live/20 text-live',
                  status === 'pending' && 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
                  status === 'none' && 'bg-white/5 border-white/10 text-slate-500'
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
        <div className="p-3 bg-surface border-t border-white/5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-2 font-medium uppercase tracking-wide text-xs">
              <Zap size={14} className="text-accent-400" />
              Punti Live
            </span>
            <span className="font-mono font-bold text-lg text-white">
              {(stats.winning * 2.5).toFixed(1)} <span className="text-xs text-slate-500">pt</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
