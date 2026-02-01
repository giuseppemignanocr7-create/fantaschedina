import { Users, TrendingUp, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommunityStatsProps {
  matchId: string;
  isDeadlinePassed: boolean;
  className?: string;
}

// Mock community votes (in produzione verrebbero dal backend)
const MOCK_COMMUNITY_VOTES: Record<string, Record<string, number>> = {
  'm1': { '1': 45, 'X': 30, '2': 25 },
  'm2': { '1': 60, 'X': 25, '2': 15 },
  'm3': { '1': 55, 'X': 28, '2': 17 },
  'm4': { '1': 40, 'X': 35, '2': 25 },
  'm5': { '1': 38, 'X': 32, '2': 30 },
  'm6': { '1': 48, 'X': 30, '2': 22 },
  'm7': { '1': 42, 'X': 33, '2': 25 },
  'm8': { '1': 35, 'X': 30, '2': 35 },
  'm9': { '1': 44, 'X': 32, '2': 24 },
  'm10': { '1': 40, 'X': 35, '2': 25 },
  'm11': { '1': 38, 'X': 32, '2': 30 },
  'm12': { '1': 42, 'X': 33, '2': 25 },
  'm13': { '1': 45, 'X': 30, '2': 25 },
  'm14': { '1': 28, 'X': 32, '2': 40 },
  'm15': { '1': 36, 'X': 34, '2': 30 },
};

export function CommunityStats({ matchId, isDeadlinePassed, className }: CommunityStatsProps) {
  const votes = MOCK_COMMUNITY_VOTES[matchId] || { '1': 33, 'X': 34, '2': 33 };
  const totalVotes = 47; // Mock total

  if (!isDeadlinePassed) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-white/40', className)}>
        <Lock size={12} />
        <span>Statistiche visibili dopo la deadline</span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-primary-400" />
          <span>Scelte Community</span>
        </div>
        <span>{totalVotes} Voti</span>
      </div>
      
      <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-surface border border-white/5">
        <div 
          className="bg-green-500 transition-all relative group"
          style={{ width: `${votes['1']}%` }}
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div 
          className="bg-yellow-500 transition-all relative group"
          style={{ width: `${votes['X']}%` }}
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div 
          className="bg-red-500 transition-all relative group"
          style={{ width: `${votes['2']}%` }}
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          <span className="text-slate-300">1: <span className="text-white">{votes['1']}%</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
          <span className="text-slate-300">X: <span className="text-white">{votes['X']}%</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          <span className="text-slate-300">2: <span className="text-white">{votes['2']}%</span></span>
        </div>
      </div>

      {/* Trend indicator */}
      <div className="flex items-center gap-2 text-xs bg-white/5 p-2 rounded-lg border border-white/5">
        <TrendingUp size={14} className="text-primary-400" />
        <span className="text-slate-400">Tendenza: <span className="text-white font-bold">Esito {getMostChosen(votes)}</span> dominante</span>
      </div>
    </div>
  );
}

function getMostChosen(votes: Record<string, number>): string {
  const max = Math.max(...Object.values(votes));
  const winner = Object.entries(votes).find(([_, v]) => v === max);
  return winner ? winner[0] : '1';
}
