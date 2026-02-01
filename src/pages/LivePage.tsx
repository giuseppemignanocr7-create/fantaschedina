import { 
  Play, 
  Calendar,
  Trophy,
  Target,
  Users
} from 'lucide-react';
import { cn, formatTime } from '@/lib/utils';
import { useAppStore } from '@/store';
import { LiveTracker, CountdownTimer, WinSimulator } from '@/components/ui';

export function LivePage() {
  const { 
    currentMatchday, 
    currentSchedina, 
    currentUser,
    isAuthenticated,
    rankings,
    prizePool
  } = useAppStore();

  const predictions = currentSchedina?.predictions || [];
  const userRanking = rankings.find(r => r.participantId === currentUser?.id);
  const userPosition = userRanking?.rank || rankings.length + 1;

  if (!currentMatchday) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Nessuna giornata attiva</h2>
          <p className="text-white/60">Torna più tardi per la prossima giornata</p>
        </div>
      </div>
    );
  }

  // Mock: partite in corso (in produzione verrebbe controllato da API)
  const hasLiveMatches = true;

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold mb-2">
            Giornata {currentMatchday.number} - In Diretta
          </h1>
          
          {/* Countdown */}
          {!hasLiveMatches && (
            <div className="flex items-center gap-4 text-white/60 mt-3">
              <span className="text-sm">Prossima partita tra:</span>
              <CountdownTimer deadline={currentMatchday.deadline} />
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Status Banner */}
            {hasLiveMatches && (
              <div className="glass-card p-6 bg-gradient-to-r from-live/20 to-orange-600/20 border-live/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Play size={100} />
                </div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-16 h-16 rounded-full bg-live flex items-center justify-center animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                    <Play size={32} className="text-white fill-white" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-2xl text-white uppercase italic tracking-wide">Giornata Live</h3>
                    <p className="text-white/80 font-medium">
                      Le partite sono in corso! Segui i risultati in tempo reale.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Live Tracker */}
            {isAuthenticated && predictions.length > 0 ? (
              <LiveTracker 
                matches={currentMatchday.matches}
                predictions={predictions}
                className="border-t-4 border-t-live"
              />
            ) : (
              <div className="glass-card p-12 text-center border-dashed border-2 border-white/10">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                  <Play size={40} className="text-white/20" />
                </div>
                <h3 className="font-display font-bold text-xl mb-2">Nessun pronostico attivo</h3>
                <p className="text-slate-400 mb-6 max-w-md mx-auto">
                  Non hai compilato la schedina per questa giornata.
                  {isAuthenticated 
                    ? ' Compilala ora per seguire i tuoi risultati live!'
                    : ' Accedi per partecipare al gioco.'
                  }
                </p>
                {isAuthenticated ? (
                   <a href="/schedina" className="btn-primary inline-flex items-center gap-2">
                     Vai alla Schedina
                   </a>
                ) : (
                  <a href="/login" className="btn-primary inline-flex items-center gap-2">
                    Accedi Ora
                  </a>
                )}
              </div>
            )}

            {/* Match List with Results */}
            <div className="glass-card overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 bg-surface flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2 uppercase tracking-wider text-sm">
                  <Calendar size={18} className="text-primary-400" />
                  Tabellone Partite
                </h3>
                <span className="text-xs font-bold text-slate-500 bg-white/5 px-2 py-1 rounded">
                  {currentMatchday.matches.length} PARTITE
                </span>
              </div>
              
              <div className="divide-y divide-white/5">
                {currentMatchday.matches.map((match, idx) => {
                  // Mock risultato random per demo
                  const mockScore = {
                    home: Math.floor(Math.random() * 4),
                    away: Math.floor(Math.random() * 4),
                  };
                  const isLive = idx < 5; // Prime 5 partite "live" per demo
                  const isFinished = idx >= 5 && idx < 10;
                  
                  return (
                    <div key={match.id} className="px-4 sm:px-6 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors">
                      {/* Status */}
                      <div className={cn(
                        'w-14 text-center text-[10px] font-bold py-1 rounded uppercase tracking-wider',
                        isLive && 'bg-live/20 text-live animate-pulse',
                        isFinished && 'bg-white/5 text-slate-500',
                        !isLive && !isFinished && 'bg-white/5 text-slate-400'
                      )}>
                        {isLive && 'LIVE'}
                        {isFinished && 'FT'}
                        {!isLive && !isFinished && formatTime(match.scheduledAt)}
                      </div>

                      {/* Teams */}
                      <div className="flex-1 flex items-center justify-center gap-4 sm:gap-8">
                        <div className="flex-1 text-right font-bold text-sm sm:text-base text-white truncate">
                          {match.homeTeam.shortName || match.homeTeam.name}
                        </div>
                        
                        {(isLive || isFinished) ? (
                          <div className={cn(
                            "px-3 py-1 rounded font-mono font-bold text-lg min-w-[80px] text-center border",
                            isLive ? "bg-live text-white border-live shadow-[0_0_10px_rgba(239,68,68,0.3)]" : "bg-surface border-white/10 text-white"
                          )}>
                            {mockScore.home} - {mockScore.away}
                          </div>
                        ) : (
                          <div className="px-3 py-1 rounded bg-surface border border-white/5 text-slate-500 text-sm min-w-[80px] text-center font-mono">
                            vs
                          </div>
                        )}
                        
                        <div className="flex-1 text-left font-bold text-sm sm:text-base text-white truncate">
                          {match.awayTeam.shortName || match.awayTeam.name}
                        </div>
                      </div>

                      {/* User prediction */}
                      {predictions.find(p => p.matchId === match.id) && (
                        <div className="hidden sm:flex flex-col items-center min-w-[50px]">
                           <span className="text-[10px] text-slate-500 uppercase">Scelta</span>
                           <span className="font-bold text-primary-400 text-lg">
                             {predictions.find(p => p.matchId === match.id)?.outcome}
                           </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* User Stats */}
            {isAuthenticated && currentUser && (
              <div className="glass-card p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Target size={18} className="text-primary-400" />
                  La tua schedina
                </h3>
                
                {predictions.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Pronostici:</span>
                      <span className="font-bold">{predictions.length}/15</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Stato:</span>
                      <span className={cn(
                        'font-medium',
                        currentSchedina?.isLocked ? 'text-green-400' : 'text-yellow-400'
                      )}>
                        {currentSchedina?.isLocked ? 'Inviata ✓' : 'In bozza'}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-white/10">
                      <p className="text-xs text-white/50 mb-1">Punti potenziali:</p>
                      <p className="text-2xl font-bold gradient-text">
                        {predictions.reduce((sum, p) => sum + Math.min(p.odds, 3.5), 0).toFixed(1)} pt
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white/50">
                    Non hai ancora compilato la schedina
                  </p>
                )}
              </div>
            )}

            {/* Win Simulator */}
            {isAuthenticated && currentUser && (
              <WinSimulator
                totalPoints={currentUser.totalPoints}
                weeklyPool={prizePool.weeklyPool}
                finalPool={prizePool.finalPool}
                currentRank={userPosition}
                participantCount={rankings.length}
              />
            )}

            {/* Leaderboard Mini */}
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10">
                <h3 className="font-semibold flex items-center gap-2">
                  <Trophy size={18} className="text-yellow-400" />
                  Classifica Live
                </h3>
              </div>
              <div className="divide-y divide-white/5">
                {rankings.slice(0, 5).map((r, idx) => (
                  <div 
                    key={r.participantId}
                    className={cn(
                      'px-4 py-2 flex items-center gap-3',
                      r.participantId === currentUser?.id && 'bg-primary-500/10'
                    )}
                  >
                    <span className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                      idx === 0 && 'bg-yellow-500 text-black',
                      idx === 1 && 'bg-gray-400 text-black',
                      idx === 2 && 'bg-orange-500 text-black',
                      idx > 2 && 'bg-white/10'
                    )}>
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate">
                      {r.username}
                    </span>
                    <span className="text-sm font-bold gradient-text">
                      {r.totalPoints} pt
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="glass-card p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users size={18} className="text-primary-400" />
                Statistiche Giornata
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Schedine inviate:</span>
                  <span className="font-bold">{rankings.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Media punti attesi:</span>
                  <span className="font-bold">3.2 pt</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Quota più alta giocata:</span>
                  <span className="font-bold text-accent-400">4.50</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
