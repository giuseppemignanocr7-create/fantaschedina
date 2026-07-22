import { Calendar } from 'lucide-react';
import { cn, formatDateShort, formatTime } from '@/lib/utils';
import { useAppStore } from '@/store';

const STATUS_LABEL: Record<string, string> = {
  upcoming: 'IN ARRIVO',
  open: 'APERTA',
  locked: 'IN CORSO',
  completed: 'CONCLUSA',
};

export function CalendarioPage() {
  const { currentMatchday, isLoadingOdds } = useAppStore();

  if (!currentMatchday) {
    if (isLoadingOdds) {
      return (
        <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Caricamento calendario in corso">
          <div className="w-8 h-8 border-2 border-white/20 border-t-primary-500 rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Nessuna giornata attiva</h2>
          <p className="text-white/60">Torna più tardi per la prossima giornata</p>
        </div>
      </div>
    );
  }

  const { number, season, status, matches } = currentMatchday;

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">

        <div className="flex items-center gap-2 mb-1">
          <Calendar size={20} className="text-yellow-400" />
          <h1 className="page-title">CALENDARIO</h1>
        </div>

        {/* Current round header */}
        <div className="glass-card p-3 flex items-center justify-between">
          <div>
            <p className="font-display font-black text-base text-white uppercase">Giornata {number}</p>
            <p className="text-xs text-white/40">Stagione {season}</p>
          </div>
          <span className="text-[10px] font-black text-primary-400 bg-primary-500/15 border border-primary-500/30 px-2.5 py-1 rounded-full">
            {STATUS_LABEL[status] ?? status.toUpperCase()}
          </span>
        </div>

        {/* Matches */}
        {matches.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-10">Nessuna partita in calendario per questa giornata</p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => {
              const isLive = m.status === 'live';
              const isFinished = m.status === 'finished';
              const isPostponed = m.status === 'postponed';
              return (
                <div key={m.id} className="glass-card p-3 flex items-center gap-3">
                  <div className="flex-1 flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex-1 text-right truncate">
                      {m.homeTeam.shortName || m.homeTeam.name}
                    </span>
                    <div className="mx-3 text-center min-w-[54px]">
                      {isPostponed ? (
                        <span className="text-[10px] text-white/40 font-bold uppercase">Rinviata</span>
                      ) : (isLive || isFinished) && m.result ? (
                        <span className={cn(
                          'font-black text-base',
                          isLive ? 'text-live' : 'text-white'
                        )}>
                          {m.result.homeGoals} - {m.result.awayGoals}
                        </span>
                      ) : (
                        <span className="text-xs text-white/40 font-bold">{formatTime(m.scheduledAt)}</span>
                      )}
                      <p className="text-[8px] text-white/20">{formatDateShort(m.scheduledAt)}</p>
                    </div>
                    <span className="font-bold text-sm text-white flex-1 truncate">
                      {m.awayTeam.shortName || m.awayTeam.name}
                    </span>
                  </div>
                  {isLive && (
                    <span className="text-[9px] font-black text-live bg-live/15 px-1.5 py-0.5 rounded uppercase animate-pulse">
                      Live
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
