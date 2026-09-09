import { useEffect, useMemo } from 'react';
import {
  Play,
  Calendar,
  Trophy,
  Target,
  Users,
} from 'lucide-react';
import { cn, formatTime } from '@/lib/utils';
import { useAppStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { useLiveMatchday } from '@/hooks/useLiveMatchday';
import { calculateBetPoints, calculateSchedinaScore } from '@/lib/scoring';
import { LiveTracker, CountdownTimer, WinSimulator, SkeletonList } from '@/components/ui';

export function LivePage() {
  const {
    currentMatchday,
    currentSchedina,
    currentUser,
    rankings,
    prizePool,
    liveScores,
    isLoadingOdds,
    isLoadingRankings,
    loadRankings,
  } = useAppStore(useShallow(s => ({
      currentMatchday: s.currentMatchday,
      currentSchedina: s.currentSchedina,
      currentUser: s.currentUser,
      rankings: s.rankings,
      prizePool: s.prizePool,
      liveScores: s.liveScores,
      isLoadingOdds: s.isLoadingOdds,
      isLoadingRankings: s.isLoadingRankings,
      loadRankings: s.loadRankings,
    })));

  useLiveMatchday();

  useEffect(() => {
    if (rankings.length === 0) loadRankings();
  }, [rankings.length, loadRankings]);

  const predictions = useMemo(() => currentSchedina?.predictions || [], [currentSchedina?.predictions]);
  const potentialScore = useMemo(() => {
    if (predictions.length === 0) return 0;
    const previewResults = predictions.map(p => ({
      ...p,
      isCorrect: true,
      pointsEarned: calculateBetPoints(p.odds, true),
    }));
    return calculateSchedinaScore(previewResults).finalPoints;
  }, [predictions]);
  const userPosition =
    rankings.findIndex(r => r.participantId === currentUser?.id) + 1 || rankings.length;

  if (!currentMatchday) {
    if (isLoadingOdds) {
      return (
        <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Caricamento giornata in corso">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-primary-500 rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-pop-in">
          <p className="text-6xl mb-4 animate-float inline-block">📺</p>
          <h2 className="text-2xl font-bold mb-2">Nessuna giornata attiva</h2>
          <p className="text-slate-500">Torna più tardi per la prossima giornata</p>
        </div>
      </div>
    );
  }

  const hasLiveMatches = currentMatchday.matches.some(m => m.status === 'live');
  const allFinished =
    currentMatchday.matches.length > 0 &&
    currentMatchday.matches.every(m => m.status === 'finished');

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Settlement info: calcolo automatico server-side */}
        {allFinished && (
          <div className="glass-card p-4 mb-6 border-green-500/30 bg-green-500/5">
            <p className="font-bold text-green-600">Giornata terminata</p>
            <p className="text-xs text-slate-500">
              I punteggi vengono calcolati automaticamente entro un'ora dalla fine
              delle partite. La classifica si aggiornerà da sola.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-red-600 text-sm font-medium mb-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold mb-2">
            Giornata {currentMatchday.number} - In Diretta
          </h1>
          
          {/* Countdown */}
          {!hasLiveMatches && (
            <div className="flex items-center gap-4 text-slate-500 mt-3">
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
                    <Play size={32} className="text-slate-900 fill-white" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-2xl text-slate-900 uppercase italic tracking-wide">Giornata Live</h3>
                    <p className="text-slate-600 font-medium">
                      Le partite sono in corso! Segui i risultati in tempo reale.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Live Tracker */}
            {predictions.length > 0 ? (
              <LiveTracker 
                matches={currentMatchday.matches}
                predictions={predictions}
                liveScores={liveScores}
                className="border-t-4 border-t-live"
              />
            ) : (
              <div className="glass-card p-12 text-center border-dashed border-2 border-slate-200">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
                  <Play size={40} className="text-slate-600" />
                </div>
                <h3 className="font-display font-bold text-xl mb-2">Nessun pronostico attivo</h3>
                <p className="text-slate-600 mb-6 max-w-md mx-auto">
                  Non hai ancora compilato la schedina per questa giornata.
                  Compilala ora per seguire i tuoi risultati live!
                </p>
                <a href="/schedina" className="btn-primary inline-flex items-center gap-2">
                  Vai alla Schedina
                </a>
              </div>
            )}

            {/* Match List with Results */}
            <div className="glass-card overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-surface flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2 uppercase tracking-wider text-sm">
                  <Calendar size={18} className="text-primary-700" />
                  Tabellone Partite
                </h3>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                  {currentMatchday.matches.length} PARTITE
                </span>
              </div>
              
              <div className="divide-y divide-slate-200">
                {currentMatchday.matches.map(match => {
                  const isLive = match.status === 'live';
                  const isFinished = match.status === 'finished';
                  const score = match.result;

                  return (
                    <div key={match.id} className="px-4 sm:px-6 py-4 flex items-center gap-4 hover:bg-slate-100 transition-colors">
                      {/* Status */}
                      <div className={cn(
                        'w-14 text-center text-[10px] font-bold py-1 rounded uppercase tracking-wider',
                        isLive && 'bg-live/20 text-live animate-pulse',
                        isFinished && 'bg-slate-100 text-slate-500',
                        !isLive && !isFinished && 'bg-slate-100 text-slate-600'
                      )}>
                        {isLive && 'LIVE'}
                        {isFinished && 'FT'}
                        {!isLive && !isFinished && formatTime(match.scheduledAt)}
                      </div>

                      {/* Teams */}
                      <div className="flex-1 flex items-center justify-center gap-4 sm:gap-8">
                        <div className="flex-1 text-right font-bold text-sm sm:text-base text-slate-900 truncate">
                          {match.homeTeam.shortName || match.homeTeam.name}
                        </div>
                        
                        {(isLive || isFinished) && score ? (
                          <div className={cn(
                            "px-3 py-1 rounded font-mono font-bold text-lg min-w-[80px] text-center border",
                            isLive ? "bg-live text-slate-900 border-live shadow-[0_0_10px_rgba(239,68,68,0.3)]" : "bg-surface border-slate-200 text-slate-900"
                          )}>
                            {score.homeGoals} - {score.awayGoals}
                          </div>
                        ) : (
                          <div className="px-3 py-1 rounded bg-surface border border-slate-200 text-slate-500 text-sm min-w-[80px] text-center font-mono">
                            vs
                          </div>
                        )}
                        
                        <div className="flex-1 text-left font-bold text-sm sm:text-base text-slate-900 truncate">
                          {match.awayTeam.shortName || match.awayTeam.name}
                        </div>
                      </div>

                      {/* User prediction */}
                      {predictions.find(p => p.matchId === match.id) && (
                        <div className="hidden sm:flex flex-col items-center min-w-[50px]">
                           <span className="text-[10px] text-slate-500 uppercase">Scelta</span>
                           <span className="font-bold text-primary-700 text-lg">
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
            <div className="glass-card p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Target size={18} className="text-primary-700" />
                  La tua schedina
                </h3>
                
                {predictions.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Pronostici:</span>
                      <span className="font-bold">
                        {predictions.length}/{currentMatchday.matches.length}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Stato:</span>
                      <span className={cn(
                        'font-medium',
                        currentSchedina?.isLocked ? 'text-green-600' : 'text-yellow-700'
                      )}>
                        {currentSchedina?.isLocked ? 'Inviata ✓' : 'In bozza'}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Punti potenziali:</p>
                      <p className="text-2xl font-bold gradient-text">
                        {potentialScore.toFixed(0)} pt
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Non hai ancora compilato la schedina
                  </p>
                )}
              </div>

            {/* Win Simulator */}
            <WinSimulator
              totalPoints={currentUser?.totalPoints ?? 0}
              weeklyPool={prizePool.weeklyPool}
              finalPool={prizePool.finalPool}
              currentRank={userPosition}
              participantCount={rankings.length}
            />

            {/* Leaderboard Mini */}
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h3 className="font-semibold flex items-center gap-2">
                  <Trophy size={18} className="text-yellow-700" />
                  Classifica Live
                </h3>
              </div>
              <div className="divide-y divide-slate-200">
                {isLoadingRankings && rankings.length === 0 ? (
                  <div className="p-3">
                    <SkeletonList count={5} />
                  </div>
                ) : rankings.length === 0 ? (
                  <p className="text-sm text-slate-500 px-4 py-6 text-center">Nessuna classifica disponibile</p>
                ) : (
                  rankings.slice(0, 5).map((r, idx) => (
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
                        idx > 2 && 'bg-slate-100'
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
                  ))
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="glass-card p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users size={18} className="text-primary-700" />
                Statistiche Giornata
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Partecipanti:</span>
                  <span className="font-bold">{rankings.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Partite live:</span>
                  <span className="font-bold text-live">
                    {currentMatchday.matches.filter(m => m.status === 'live').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Partite concluse:</span>
                  <span className="font-bold">
                    {currentMatchday.matches.filter(m => m.status === 'finished').length}/
                    {currentMatchday.matches.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
