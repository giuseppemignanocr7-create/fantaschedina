import { useState } from 'react';
import { 
  Trophy, 
  Medal,
  TrendingUp,
  Calendar,
  ChevronDown,
  User,
  Target,
  Zap
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useAppStore } from '@/store';

type TabType = 'generale' | 'settimanale';

export function ClassificaPage() {
  const { rankings, prizePool, currentUser, currentMatchday } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabType>('generale');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-primary-400 text-sm font-bold uppercase tracking-wider mb-1">
                <TrendingUp size={16} />
                Ranking Ufficiale
              </div>
              <h1 className="text-3xl sm:text-5xl font-display font-black uppercase italic tracking-tight text-white">
                Classifica <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">2025-26</span>
              </h1>
            </div>
            <div className="hidden sm:block">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center border border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                <Trophy size={32} className="text-yellow-400" />
              </div>
            </div>
          </div>

          {/* Prize Pool Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-card p-4 text-center border-t-2 border-accent-500 bg-surface/80">
              <p className="text-xl sm:text-2xl font-mono font-bold text-accent-400">{formatCurrency(prizePool.finalPool)}</p>
              <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Montepremi Finale</p>
            </div>
            <div className="glass-card p-4 text-center border-t-2 border-primary-500 bg-surface/80">
              <p className="text-xl sm:text-2xl font-mono font-bold text-white">{formatCurrency(prizePool.weeklyPool)}</p>
              <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Vincita Settimanale</p>
            </div>
            <div className="glass-card p-4 text-center border-t-2 border-live bg-surface/80">
              <p className="text-xl sm:text-2xl font-mono font-bold text-live">{formatCurrency(prizePool.accumulatedPoker)}</p>
              <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Jackpot Poker</p>
            </div>
            <div className="glass-card p-4 text-center border-t-2 border-slate-500 bg-surface/80">
              <p className="text-xl sm:text-2xl font-mono font-bold text-white">{rankings.length}</p>
              <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Tipsters</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-surface/50 rounded-xl mb-8 border border-white/5 backdrop-blur-sm">
          <button
            onClick={() => setActiveTab('generale')}
            className={cn(
              'flex-1 py-3 px-4 rounded-lg font-bold text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2',
              activeTab === 'generale'
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            )}
          >
            <Trophy size={16} />
            Generale
          </button>
          <button
            onClick={() => setActiveTab('settimanale')}
            className={cn(
              'flex-1 py-3 px-4 rounded-lg font-bold text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2',
              activeTab === 'settimanale'
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            )}
          >
            <Calendar size={16} />
            Giornata {currentMatchday?.number || 18}
          </button>
        </div>

        {/* Top 3 Podium */}
        {activeTab === 'generale' && rankings.length >= 3 && (
          <div className="mb-12 relative">
            <div className="absolute inset-0 bg-gradient-radial from-primary-500/10 to-transparent opacity-50 blur-3xl" />
            <div className="flex items-end justify-center gap-2 sm:gap-6 relative z-10">
              {/* 2nd Place */}
              <div className="flex-1 max-w-[140px] transform hover:-translate-y-1 transition-transform duration-300">
                <div className="glass-card p-4 text-center border-t-4 border-t-slate-300 bg-surface/90 shadow-xl">
                  <div className="w-12 h-12 rounded-full bg-slate-300/10 flex items-center justify-center mx-auto mb-3 border border-slate-300/20">
                    <span className="text-2xl font-bold text-slate-300">2</span>
                  </div>
                  <p className="font-bold truncate text-white mb-1">{rankings[1].username}</p>
                  <p className="text-xl font-mono font-bold text-slate-300">{rankings[1].totalPoints}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">PT</p>
                </div>
                <div className="h-12 bg-gradient-to-t from-slate-300/10 to-transparent rounded-b-xl mx-2" />
              </div>

              {/* 1st Place */}
              <div className="flex-1 max-w-[160px] transform hover:-translate-y-2 transition-transform duration-300 z-20 -mb-4">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                  <Medal size={32} className="text-yellow-400 fill-yellow-400 animate-bounce" />
                </div>
                <div className="glass-card p-5 text-center border-t-4 border-t-yellow-400 bg-surface/90 shadow-[0_0_40px_rgba(250,204,21,0.15)] ring-1 ring-yellow-400/20">
                  <div className="w-16 h-16 rounded-full bg-yellow-400/10 flex items-center justify-center mx-auto mb-3 border border-yellow-400/30 shadow-[0_0_20px_rgba(250,204,21,0.2)]">
                    <span className="text-3xl font-bold text-yellow-400">1</span>
                  </div>
                  <p className="font-bold truncate text-white text-lg mb-1">{rankings[0].username}</p>
                  <p className="text-3xl font-mono font-bold text-yellow-400">{rankings[0].totalPoints}</p>
                  <p className="text-[10px] text-yellow-500/60 uppercase font-bold">PUNTI TOTALI</p>
                </div>
                <div className="h-20 bg-gradient-to-t from-yellow-400/10 to-transparent rounded-b-xl mx-2" />
              </div>

              {/* 3rd Place */}
              <div className="flex-1 max-w-[140px] transform hover:-translate-y-1 transition-transform duration-300">
                <div className="glass-card p-4 text-center border-t-4 border-t-orange-400 bg-surface/90 shadow-xl">
                  <div className="w-12 h-12 rounded-full bg-orange-400/10 flex items-center justify-center mx-auto mb-3 border border-orange-400/20">
                    <span className="text-2xl font-bold text-orange-400">3</span>
                  </div>
                  <p className="font-bold truncate text-white mb-1">{rankings[2].username}</p>
                  <p className="text-xl font-mono font-bold text-orange-400">{rankings[2].totalPoints}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">PT</p>
                </div>
                <div className="h-8 bg-gradient-to-t from-orange-400/10 to-transparent rounded-b-xl mx-2" />
              </div>
            </div>
          </div>
        )}

        {/* Rankings List */}
        <div className="glass-card overflow-hidden border border-white/5 shadow-2xl">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-4 bg-surface border-b border-white/10 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
            <div className="col-span-1 text-center">Rank</div>
            <div className="col-span-5 sm:col-span-4">Tipster</div>
            <div className="col-span-2 text-center hidden sm:block">Giornate</div>
            <div className="col-span-2 text-center hidden sm:block">Esatti</div>
            <div className="col-span-6 sm:col-span-3 text-right">Punti</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5">
            {rankings.map((player) => {
              const isExpanded = expandedPlayer === player.participantId;
              const isCurrentUser = currentUser?.id === player.participantId;

              return (
                <div 
                  key={player.participantId}
                  className={cn(
                    'transition-all duration-200',
                    isCurrentUser ? 'bg-primary-900/20' : 'hover:bg-white/5'
                  )}
                >
                  {/* Main Row */}
                  <div 
                    className="grid grid-cols-12 gap-2 px-4 py-4 items-center cursor-pointer"
                    onClick={() => setExpandedPlayer(isExpanded ? null : player.participantId)}
                  >
                    {/* Rank */}
                    <div className="col-span-1 flex justify-center">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm font-mono',
                        player.rank <= 3 ? 'bg-white/5 border border-white/10' : 'text-slate-500'
                      )}>
                        {player.rank}
                      </div>
                    </div>

                    {/* Username */}
                    <div className="col-span-5 sm:col-span-4 flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center border",
                        isCurrentUser ? "bg-primary-600 border-primary-400 text-white" : "bg-surface border-white/10 text-slate-400"
                      )}>
                        <User size={14} />
                      </div>
                      <div className="truncate">
                        <span className={cn(
                          'font-bold text-sm block',
                          isCurrentUser ? 'text-primary-400' : 'text-white'
                        )}>
                          {player.username}
                        </span>
                        {isCurrentUser && (
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">TU</span>
                        )}
                      </div>
                    </div>

                    {/* Matchdays */}
                    <div className="col-span-2 text-center hidden sm:block">
                      <span className="bg-white/5 px-2 py-1 rounded text-xs font-mono text-slate-300">
                        {player.matchdaysPlayed}
                      </span>
                    </div>

                    {/* Correct Predictions */}
                    <div className="col-span-2 text-center hidden sm:block">
                      <span className="text-xs font-mono text-slate-300">
                        {player.correctPredictions}
                      </span>
                    </div>

                    {/* Points */}
                    <div className="col-span-6 sm:col-span-3 flex items-center justify-end gap-3">
                      <span className={cn(
                        "text-lg font-mono font-bold",
                        isCurrentUser ? "text-primary-400" : "text-white"
                      )}>
                        {player.totalPoints.toFixed(1)}
                      </span>
                      <ChevronDown 
                        size={16} 
                        className={cn(
                          'text-slate-500 transition-transform duration-300',
                          isExpanded && 'rotate-180 text-primary-400'
                        )}
                      />
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <div className={cn(
                    'overflow-hidden transition-all duration-300 bg-black/20',
                    isExpanded ? 'max-h-48' : 'max-h-0'
                  )}>
                    <div className="px-4 pb-4 pt-2 border-t border-white/5">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div className="p-3 rounded-lg bg-surface border border-white/5">
                          <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Media Punti</p>
                          <p className="font-mono font-bold text-white">{player.averagePointsPerMatchday.toFixed(2)}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-surface border border-white/5">
                          <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Miglior Punteggio</p>
                          <p className="font-mono font-bold text-primary-400">{player.bestMatchdayPoints.toFixed(2)}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-surface border border-white/5">
                          <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Vittorie</p>
                          <div className="flex items-center gap-1 font-bold text-yellow-400">
                            <Trophy size={14} className="fill-yellow-400" />
                            {player.weeklyWins}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-surface border border-white/5">
                          <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Rendimento</p>
                          <div className="flex items-center gap-2 font-mono text-xs">
                            <span className="text-green-400">+{player.bonusPointsTotal}</span>
                            <span className="text-slate-600">|</span>
                            <span className="text-live">{player.penaltyPointsTotal}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 glass-card p-6 border-t-4 border-t-accent-500">
          <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-white">
            <Zap size={20} className="text-accent-400" />
            Struttura Premi
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex items-start gap-4 p-3 rounded-xl bg-surface/50 border border-white/5">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                <Trophy size={20} className="text-yellow-400" />
              </div>
              <div>
                <p className="font-bold text-white">1° Classificato</p>
                <p className="text-sm text-slate-400 mt-1">{formatCurrency(300)}</p>
                <p className="text-[10px] text-slate-500 uppercase mt-1">Montepremi Finale</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-3 rounded-xl bg-surface/50 border border-white/5">
              <div className="w-10 h-10 rounded-lg bg-slate-300/10 border border-slate-300/20 flex items-center justify-center shrink-0">
                <Medal size={20} className="text-slate-300" />
              </div>
              <div>
                <p className="font-bold text-white">Campione Inverno</p>
                <p className="text-sm text-slate-400 mt-1">{formatCurrency(200)}</p>
                <p className="text-[10px] text-slate-500 uppercase mt-1">Girone Andata</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-3 rounded-xl bg-surface/50 border border-white/5">
              <div className="w-10 h-10 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
                <Target size={20} className="text-primary-400" />
              </div>
              <div>
                <p className="font-bold text-white">Vincitore Settimanale</p>
                <p className="text-sm text-slate-400 mt-1">40% Pool</p>
                <p className="text-[10px] text-slate-500 uppercase mt-1">Ogni Giornata</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
