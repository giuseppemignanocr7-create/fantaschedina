// ============================================
// GIOCATORE — il profilo pubblico di chi sta in classifica.
//
// Dalla classifica si tocca un nome e si arriva qui: punti accumulati, le
// fantaschedine delle giornate passate e — SOLO a tempo scaduto — quella
// della giornata in corso. Prima della deadline resta coperta: vederla
// permetterebbe di copiarla, e le regole Firestore la negano comunque
// (la pagina spiega il perché invece di mostrare un errore).
//
// I numeri arrivano dalla classifica ufficiale (callable getRankings), che
// non espone gettoni né email; le schedine valutate sono leggibili da
// chiunque per regola, quella in corso solo dopo la deadline.
// ============================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Award, Calendar, Check, Clock, Loader2, Lock, Medal, Trophy,
  User, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { useAuthContext } from '@/contexts/AuthContext';
import { CountdownTimer, EmptyState, ErrorState } from '@/components/ui';
import { betLabel } from '@/lib/markets';
import {
  getMatchday,
  getPublicSchedine,
  getUserSchedinaForMatchday,
  type SchedinaDoc,
} from '@/lib/db';
import type { Match } from '@/types';

function medaglia(rank: number): string | null {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
}

export function GiocatorePage() {
  const { uid = '' } = useParams();
  const { user } = useAuthContext();
  const sonoIo = user?.uid === uid;
  const { rankings, currentMatchday, loadRankings, loadMatchday } = useAppStore();

  const [passate, setPassate] = useState<SchedinaDoc[]>([]);
  const [inCorso, setInCorso] = useState<SchedinaDoc | null>(null);
  const [partitePerId, setPartitePerId] = useState<Map<string, Match>>(new Map());
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [aperta, setAperta] = useState<string | null>(null);

  // L'orologio serve a decidere se la giornata in corso è già chiusa.
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (rankings.length === 0) void loadRankings();
  }, [rankings.length, loadRankings]);

  useEffect(() => {
    if (!currentMatchday) void loadMatchday();
  }, [currentMatchday, loadMatchday]);

  const giocatore = useMemo(
    () => rankings.find(r => r.participantId === uid) ?? null,
    [rankings, uid]
  );

  const deadlinePassata =
    !!currentMatchday && now > 0 && new Date(currentMatchday.deadline).getTime() <= now;

  const carica = useCallback(async () => {
    if (!uid) return;
    setCaricamento(true);
    setErrore(null);
    try {
      const vecchie = await getPublicSchedine(uid);
      setPassate(vecchie);

      // La schedina della giornata in corso si chiede solo a tempo scaduto:
      // prima, le regole la negherebbero comunque (anti-copia).
      if (currentMatchday && deadlinePassata) {
        const corrente = await getUserSchedinaForMatchday(uid, currentMatchday.number).catch(
          () => null
        );
        setInCorso(corrente && !corrente.settled ? corrente : null);
      } else {
        setInCorso(null);
      }

      // I nomi delle partite, per leggere i pronostici.
      const numeri = [...new Set(vecchie.map(s => s.matchdayNumber))];
      const giornate = await Promise.all(numeri.map(n => getMatchday(n).catch(() => null)));
      const mappa = new Map<string, Match>();
      for (const g of giornate) g?.matches.forEach(m => mappa.set(m.id, m));
      currentMatchday?.matches.forEach(m => mappa.set(m.id, m));
      setPartitePerId(mappa);
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setCaricamento(false);
    }
  }, [uid, currentMatchday, deadlinePassata]);

  useEffect(() => {
    const t = setTimeout(() => void carica(), 0);
    return () => clearTimeout(t);
  }, [carica]);

  const nomePartita = (matchId: string) => {
    const m = partitePerId.get(matchId);
    if (!m) return matchId;
    return `${m.homeTeam.shortName || m.homeTeam.name} - ${m.awayTeam.shortName || m.awayTeam.name}`;
  };

  if (caricamento && !giocatore) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="text-primary-400 animate-spin" />
      </div>
    );
  }

  if (errore) {
    return (
      <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
        <ErrorState message={errore} onRetry={() => void carica()} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">
        {/* Testata */}
        <div className="flex items-center gap-2">
          <Link
            to="/classifica"
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Torna alla classifica"
          >
            <ArrowLeft size={18} className="text-white/60" />
          </Link>
          <div className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center flex-shrink-0">
            <User size={18} className="text-primary-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="page-title truncate">
              {giocatore?.username ?? 'Giocatore'}
              {sonoIo && <span className="text-[10px] text-primary-400 ml-2">TU</span>}
            </h1>
            {giocatore && (
              <p className="text-[11px] text-white/40">
                {medaglia(giocatore.rank) ?? `${giocatore.rank}º`} in classifica generale
              </p>
            )}
          </div>
        </div>

        {/* I numeri della stagione */}
        {giocatore && (
          <div className="grid grid-cols-4 gap-2">
            <Numero etichetta="Punti" valore={giocatore.totalPoints.toFixed(1)} evidenzia />
            <Numero etichetta="Giornate" valore={String(giocatore.matchdaysPlayed)} />
            <Numero etichetta="Esatti" valore={String(giocatore.correctPredictions)} />
            <Numero
              etichetta="Vittorie"
              valore={String(giocatore.weeklyWins)}
              icona={giocatore.weeklyWins > 0 ? <Medal size={11} className="text-amber-400" /> : undefined}
            />
          </div>
        )}

        {/* Giornata in corso */}
        {currentMatchday && (
          <div className="glass-card overflow-hidden">
            <div className="px-3 py-2 bg-white/5 border-b border-white/5 flex items-center gap-1.5">
              <Calendar size={12} className="text-primary-400" />
              <p className="text-xs font-bold text-white/70">
                Giornata {currentMatchday.number} — in corso
              </p>
            </div>

            {!deadlinePassata ? (
              <div className="p-4 flex items-start gap-3">
                <Lock size={16} className="text-white/30 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-white/50">
                  <p>
                    La schedina di questa giornata resta coperta finché si può ancora
                    giocare: si scopre alla chiusura.
                  </p>
                  <p className="text-[11px] text-white/35 mt-1.5 flex items-center gap-1.5">
                    <Clock size={11} />
                    Chiude tra <CountdownTimer deadline={currentMatchday.deadline} />
                  </p>
                </div>
              </div>
            ) : inCorso ? (
              <div className="divide-y divide-white/5">
                {inCorso.predictions.map((p, i) => (
                  <div key={`${p.matchId}-${p.betType}`} className="flex items-center gap-2 px-3 py-2">
                    <span className="w-5 text-white/25 text-xs flex-shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{nomePartita(p.matchId)}</p>
                      <p className="text-[11px] text-white/40">{betLabel(p.betType, p.outcome)}</p>
                    </div>
                    <span className="text-xs font-mono text-white/60 flex-shrink-0">
                      {p.odds.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-4 text-sm text-white/40">
                Non ha giocato la schedina di questa giornata.
              </p>
            )}
          </div>
        )}

        {/* Fantaschedine delle giornate passate */}
        <div className="flex items-center gap-1.5 px-1 pt-1">
          <Trophy size={12} className="text-primary-400" />
          <p className="text-xs font-bold text-white/60">Le sue fantaschedine</p>
        </div>

        {passate.length === 0 && !caricamento ? (
          <EmptyState
            icon="📋"
            title="Nessuna schedina valutata"
            message="Le schedine compaiono qui dopo la valutazione della giornata."
          />
        ) : (
          <div className="space-y-2">
            {passate.map(s => {
              const apertaQui = aperta === s.id;
              return (
                <div key={s.id} className="glass-card overflow-hidden">
                  <button
                    onClick={() => setAperta(apertaQui ? null : s.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-surface border border-white/10 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[9px] text-white/40 uppercase">G</span>
                      <span className="text-sm font-black text-white leading-none">
                        {s.matchdayNumber}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">
                        {s.correctPredictions}/10 esatti
                      </p>
                      {s.bonusPoints > 0 && (
                        <p className="text-[10px] text-green-400 flex items-center gap-1">
                          <Award size={10} /> bonus +{s.bonusPoints}
                        </p>
                      )}
                    </div>
                    <p className="font-black text-primary-300 flex-shrink-0">
                      {s.finalPoints} pt
                    </p>
                  </button>

                  {apertaQui && (
                    <div className="border-t border-white/5 divide-y divide-white/5">
                      {(s.predictionResults ?? []).map(p => (
                        <div
                          key={`${p.matchId}-${p.betType}`}
                          className="flex items-center gap-2 px-3 py-2"
                        >
                          <span className="w-5 flex-shrink-0">
                            {p.isCorrect ? (
                              <Check size={13} className="text-green-400" />
                            ) : (
                              <X size={13} className="text-red-400" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{nomePartita(p.matchId)}</p>
                            <p className="text-[11px] text-white/40">
                              {betLabel(p.betType, p.outcome)}
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="text-xs font-mono text-white/60">{p.odds.toFixed(2)}</p>
                            <p
                              className={cn(
                                'text-[11px] font-bold',
                                p.pointsEarned > 0 ? 'text-green-400' : 'text-white/30'
                              )}
                            >
                              {p.pointsEarned > 0 ? `+${p.pointsEarned}` : '0'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
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

function Numero({
  etichetta,
  valore,
  evidenzia,
  icona,
}: {
  etichetta: string;
  valore: string;
  evidenzia?: boolean;
  icona?: React.ReactNode;
}) {
  return (
    <div className="glass-card p-2.5 text-center">
      <p className="text-[10px] text-white/40">{etichetta}</p>
      <p
        className={cn(
          'font-black text-sm flex items-center justify-center gap-1',
          evidenzia ? 'text-primary-300' : 'text-white'
        )}
      >
        {icona}
        {valore}
      </p>
    </div>
  );
}
