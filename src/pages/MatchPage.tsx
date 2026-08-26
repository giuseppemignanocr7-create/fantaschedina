// ============================================
// MATCH — le partite della giornata in corso
//
// Fino al 22/08/2026 questa pagina mostrava un elenco scritto a mano nel file
// (Inter-Milan, "Sabato 24 Maggio"): dalla barra in basso l'utente vedeva
// partite di mesi prima. Ora legge la giornata vera dallo store, la stessa
// che si usa per compilare la schedina.
// ============================================

import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Loader2, Target } from 'lucide-react';
import { useAppStore } from '@/store';
import { useLiveMatchday } from '@/hooks/useLiveMatchday';
import { cn } from '@/lib/utils';
import { CountdownTimer, TeamLogo } from '@/components/ui';
import { competitionName } from '@/lib/competitions';
import type { Match } from '@/types';

/** Le partite raggruppate per giorno, nell'ordine in cui si giocano. */
function raggruppaPerGiorno(matches: Match[]): { giorno: string; partite: Match[] }[] {
  const gruppi = new Map<string, Match[]>();
  for (const m of [...matches].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  )) {
    const giorno = new Date(m.scheduledAt).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const esistente = gruppi.get(giorno);
    if (esistente) esistente.push(m);
    else gruppi.set(giorno, [m]);
  }
  return [...gruppi.entries()].map(([giorno, partite]) => ({ giorno, partite }));
}

function orario(d: Date | string): string {
  return new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export function MatchPage() {
  const { currentMatchday, liveScores, isLoadingOdds, loadMatchday } = useAppStore();

  useEffect(() => {
    if (!currentMatchday) void loadMatchday();
  }, [currentMatchday, loadMatchday]);

  useLiveMatchday();

  const giornate = useMemo(
    () => raggruppaPerGiorno(currentMatchday?.matches ?? []),
    [currentMatchday?.matches]
  );

  if (!currentMatchday) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        {isLoadingOdds ? (
          <Loader2 size={24} className="text-primary-400 animate-spin" />
        ) : (
          <div className="glass-card p-8 text-center max-w-sm">
            <p className="text-5xl mb-3">📅</p>
            <p className="font-bold text-white">Nessuna giornata attiva</p>
            <p className="text-sm text-white/40 mt-1">
              Le partite compaiono qui appena la prossima giornata è pronta.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-primary-400" />
            <h1 className="page-title">MATCH</h1>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary-400 bg-primary-500/10 border border-primary-500/20 px-2 py-1 rounded-full">
            Giornata {currentMatchday.number}
          </div>
        </div>

        <div className="glass-card p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <Clock size={12} />
            <CountdownTimer deadline={currentMatchday.deadline} />
          </div>
          <Link
            to="/pronostici"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500/20 border border-primary-500/30 text-primary-300 text-xs font-bold hover:bg-primary-500/30 transition-colors"
          >
            <Target size={12} />
            Compila la schedina
          </Link>
        </div>

        {giornate.map(({ giorno, partite }) => (
          <div key={giorno} className="glass-card overflow-hidden">
            <div className="px-3 py-2 bg-white/5 border-b border-white/5">
              <p className="text-xs font-bold text-white/70 capitalize">{giorno}</p>
            </div>
            <div className="divide-y divide-white/5">
              {partite.map(m => {
                const live = liveScores[m.id];
                const risultato = live ?? m.result;
                const inCorso = (live?.status ?? m.status) === 'live';
                const finita = (live?.status ?? m.status) === 'finished';
                return (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="w-12 flex-shrink-0 text-center">
                      {inCorso ? (
                        <span className="text-[10px] font-black text-red-400 animate-pulse">
                          LIVE
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-white/40">
                          {orario(m.scheduledAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <TeamLogo src={m.homeTeam.logo} name={m.homeTeam.name} size={16} />
                      <span className="text-sm truncate">
                        {m.homeTeam.shortName || m.homeTeam.name}
                      </span>
                      <span className="text-white/30 text-xs px-1">-</span>
                      <TeamLogo src={m.awayTeam.logo} name={m.awayTeam.name} size={16} />
                      <span className="text-sm truncate">
                        {m.awayTeam.shortName || m.awayTeam.name}
                      </span>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {risultato ? (
                        <span
                          className={cn(
                            'font-black text-sm',
                            finita ? 'text-white' : 'text-red-400'
                          )}
                        >
                          {risultato.homeGoals}-{risultato.awayGoals}
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/30">
                          {competitionName(m.competition)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
