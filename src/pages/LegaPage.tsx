// ============================================
// LA MIA LEGA — tutto quello che si fa dentro una lega, in un posto solo.
//
// Fino al 22/08/2026 unirsi a una lega non portava da nessuna parte: la
// pagina LEGHE diceva "sei dentro" e finiva lì. Qui la lega ha la sua casa,
// col sottomenu che serve davvero: la schedina di questa lega, la sua
// classifica, le partite della giornata, i membri.
//
// I punti fatti qui valgono solo per la classifica di questa lega: la
// schedina generale resta un circuito separato (vedi functions/src/index.ts,
// dove le schedine di lega hanno id `uid_giornata_lega`).
// ============================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Award, Calendar, Check, Copy, Crown, Loader2, Medal,
  Target, Trophy, Users, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { useLiveMatchday } from '@/hooks/useLiveMatchday';
import { useAuthContext } from '@/contexts/AuthContext';
import { CountdownTimer, EmptyState, ErrorState, TeamLogo } from '@/components/ui';
import { competitionName } from '@/lib/competitions';
import { betLabel } from '@/lib/markets';
import { getLeague, type LeagueDoc } from '@/lib/leagues';
import { getRankingsFn, type RankingRow } from '@/lib/gameApi';
import { getUserSchedinaForMatchday, type SchedinaDoc } from '@/lib/db';
import type { Match } from '@/types';

const SEZIONI = ['SCHEDINA', 'CLASSIFICA', 'PARTITE', 'MEMBRI'] as const;
type Sezione = (typeof SEZIONI)[number];

function medaglia(posizione: number): string | null {
  return posizione === 1 ? '🥇' : posizione === 2 ? '🥈' : posizione === 3 ? '🥉' : null;
}

function orario(d: Date | string): string {
  return new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export function LegaPage() {
  const { leagueId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const uid = user?.uid ?? '';
  const { currentMatchday, liveScores, loadMatchday } = useAppStore();

  const [sezione, setSezione] = useState<Sezione>('SCHEDINA');
  const [lega, setLega] = useState<LeagueDoc | null>(null);
  const [classifica, setClassifica] = useState<RankingRow[]>([]);
  const [schedina, setSchedina] = useState<SchedinaDoc | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [codiceCopiato, setCodiceCopiato] = useState(false);

  useEffect(() => {
    if (!currentMatchday) void loadMatchday();
  }, [currentMatchday, loadMatchday]);

  useLiveMatchday();

  const carica = useCallback(async () => {
    if (!leagueId || !uid) return;
    setCaricamento(true);
    setErrore(null);
    try {
      const doc = await getLeague(leagueId);
      if (!doc) {
        setErrore('Questa lega non esiste, oppure non ne fai parte.');
        return;
      }
      setLega(doc);
      // Classifica e schedina non devono far fallire la pagina: se la giornata
      // non è ancora partita non c'è nulla da mostrare, e va bene così.
      const [righe, mia] = await Promise.all([
        getRankingsFn(leagueId)
          .then(r => r.rankings)
          .catch(() => []),
        currentMatchday
          ? getUserSchedinaForMatchday(uid, currentMatchday.number, leagueId).catch(() => null)
          : Promise.resolve(null),
      ]);
      setClassifica(righe);
      setSchedina(mia);
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setCaricamento(false);
    }
  }, [leagueId, uid, currentMatchday]);

  // Come in LeghePage: il caricamento parte fuori dal ciclo di render, cosi
  // il primo setState non avviene dentro l’effetto.
  useEffect(() => {
    const t = setTimeout(() => void carica(), 0);
    return () => clearTimeout(t);
  }, [carica]);

  const mioPosto = useMemo(
    () => classifica.find(r => r.participantId === uid) ?? null,
    [classifica, uid]
  );

  const partite = useMemo(
    () =>
      [...(currentMatchday?.matches ?? [])].sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      ),
    [currentMatchday?.matches]
  );

  const copiaCodice = async () => {
    if (!lega) return;
    await navigator.clipboard.writeText(lega.inviteCode);
    setCodiceCopiato(true);
    setTimeout(() => setCodiceCopiato(false), 2000);
  };

  if (caricamento) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="text-primary-400 animate-spin" />
      </div>
    );
  }

  if (errore || !lega) {
    return (
      <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
        <ErrorState message={errore ?? 'Lega non disponibile'} onRetry={() => void carica()} />
        <button
          onClick={() => navigate('/leghe')}
          className="mt-4 mx-auto flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft size={14} /> Torna alle leghe
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">
        {/* Testata della lega */}
        <div className="flex items-center gap-2">
          <Link
            to="/leghe"
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Torna alle leghe"
          >
            <ArrowLeft size={18} className="text-white/60" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="page-title truncate">{lega.name}</h1>
            <p className="text-[11px] text-white/40 flex items-center gap-1.5">
              <Users size={11} />
              {lega.memberCount} {lega.memberCount === 1 ? 'membro' : 'membri'}
              {mioPosto && (
                <>
                  <span className="text-white/20">·</span>
                  sei {mioPosto.rank}º con {mioPosto.totalPoints} punti
                </>
              )}
            </p>
          </div>
        </div>

        {/* Sottomenu della lega */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/5">
          {SEZIONI.map(s => (
            <button
              key={s}
              onClick={() => setSezione(s)}
              className={cn(
                'flex-1 py-2 rounded-lg text-[11px] font-bold transition-colors',
                sezione === s
                  ? 'bg-primary-500/25 text-primary-200 border border-primary-500/30'
                  : 'text-white/50 hover:text-white/80'
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {sezione === 'SCHEDINA' && (
          <SezioneSchedina
            leagueId={lega.id}
            schedina={schedina}
            giornata={currentMatchday?.number ?? null}
            deadline={currentMatchday?.deadline ?? null}
            partite={partite}
          />
        )}

        {sezione === 'CLASSIFICA' && <SezioneClassifica righe={classifica} uid={uid} />}

        {sezione === 'PARTITE' && (
          <SezionePartite
            partite={partite}
            giornata={currentMatchday?.number ?? null}
            liveScores={liveScores}
          />
        )}

        {sezione === 'MEMBRI' && (
          <SezioneMembri
            lega={lega}
            righe={classifica}
            codiceCopiato={codiceCopiato}
            onCopia={() => void copiaCodice()}
          />
        )}
      </div>
    </div>
  );
}

// --- SCHEDINA di questa lega -------------------------------------------------

function SezioneSchedina({
  leagueId,
  schedina,
  giornata,
  deadline,
  partite,
}: {
  leagueId: string;
  schedina: SchedinaDoc | null;
  giornata: number | null;
  deadline: Date | null;
  partite: Match[];
}) {
  const nomePartita = (matchId: string) => {
    const m = partite.find(p => p.id === matchId);
    if (!m) return matchId;
    return `${m.homeTeam.shortName || m.homeTeam.name} - ${m.awayTeam.shortName || m.awayTeam.name}`;
  };

  if (giornata == null) {
    return (
      <EmptyState
        icon="📅"
        title="Nessuna giornata attiva"
        message="Appena la prossima giornata è pronta potrai giocare la schedina di questa lega."
      />
    );
  }

  if (!schedina) {
    return (
      <div className="space-y-3">
        <div className="glass-card p-4 text-center">
          <p className="text-4xl mb-2">🎯</p>
          <p className="font-bold text-white">Schedina della giornata {giornata}</p>
          <p className="text-sm text-white/50 mt-1">
            Non l&apos;hai ancora compilata per questa lega.
          </p>
          {deadline && (
            <div className="text-[11px] text-white/40 mt-2 flex items-center justify-center gap-1.5">
              Chiude tra <CountdownTimer deadline={deadline} />
            </div>
          )}
          <Link
            to={`/pronostici?lega=${leagueId}`}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 text-black font-bold text-sm hover:bg-primary-400 transition-colors active:scale-[0.98]"
          >
            <Target size={16} />
            Compila la schedina
          </Link>
        </div>
        <p className="text-[11px] text-white/40 text-center px-4">
          Stesse partite e stesse quote della generale. I punti che fai qui contano solo per la
          classifica di questa lega.
        </p>
      </div>
    );
  }

  const esiti = schedina.predictionResults;

  return (
    <div className="space-y-3">
      <div className="glass-card p-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-white/50">Giornata {schedina.matchdayNumber}</p>
          <p className="font-bold text-white text-sm">
            {schedina.settled
              ? `${schedina.correctPredictions}/10 · ${schedina.finalPoints} punti`
              : 'Schedina inviata'}
          </p>
        </div>
        {!schedina.isLocked && (
          <Link
            to={`/pronostici?lega=${leagueId}`}
            className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition-colors"
          >
            Modifica
          </Link>
        )}
      </div>

      {schedina.settled && (
        <div className="grid grid-cols-3 gap-2">
          <Riquadro etichetta="Punti giocate" valore={schedina.totalPoints} />
          <Riquadro
            etichetta="Bonus"
            valore={schedina.bonusPoints}
            evidenzia={schedina.bonusPoints > 0}
          />
          <Riquadro etichetta="Penalità" valore={schedina.penaltyPoints} negativo />
        </div>
      )}

      <div className="glass-card overflow-hidden divide-y divide-white/5">
        {schedina.predictions.map((p, i) => {
          const esito = esiti?.[i];
          return (
            <div key={`${p.matchId}-${p.betType}`} className="flex items-center gap-2 px-3 py-2.5">
              <div className="w-5 flex-shrink-0">
                {esito ? (
                  esito.isCorrect ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <X size={14} className="text-red-400" />
                  )
                ) : (
                  <span className="text-white/20 text-xs">{i + 1}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{nomePartita(p.matchId)}</p>
                <p className="text-[11px] text-white/40">{betLabel(p.betType, p.outcome)}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xs font-mono text-white/60">{p.odds.toFixed(2)}</p>
                {esito && (
                  <p
                    className={cn(
                      'text-[11px] font-bold',
                      esito.pointsEarned > 0 ? 'text-green-400' : 'text-white/30'
                    )}
                  >
                    {esito.pointsEarned > 0 ? `+${esito.pointsEarned}` : '0'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Riquadro({
  etichetta,
  valore,
  evidenzia,
  negativo,
}: {
  etichetta: string;
  valore: number;
  evidenzia?: boolean;
  negativo?: boolean;
}) {
  return (
    <div className="glass-card p-2.5 text-center">
      <p className="text-[10px] text-white/40">{etichetta}</p>
      <p
        className={cn(
          'font-black text-sm',
          evidenzia ? 'text-green-400' : negativo && valore < 0 ? 'text-red-400' : 'text-white'
        )}
      >
        {valore > 0 && evidenzia ? '+' : ''}
        {valore}
      </p>
    </div>
  );
}

// --- CLASSIFICA di lega ------------------------------------------------------

function SezioneClassifica({ righe, uid }: { righe: RankingRow[]; uid: string }) {
  if (righe.length === 0) {
    return (
      <EmptyState
        icon="🏆"
        title="Classifica vuota"
        message="Appena la prima giornata viene valutata qui compaiono i punti di tutti."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="glass-card overflow-hidden divide-y divide-white/5">
        {righe.map(r => {
          const sonoIo = r.participantId === uid;
          return (
            <div
              key={r.participantId}
              className={cn('flex items-center gap-3 px-3 py-2.5', sonoIo && 'bg-primary-500/10')}
            >
              <div className="w-7 text-center flex-shrink-0">
                {medaglia(r.rank) ?? <span className="text-xs font-bold text-white/40">{r.rank}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm truncate',
                    sonoIo ? 'font-bold text-primary-200' : 'text-white'
                  )}
                >
                  {r.username}
                  {sonoIo && <span className="text-[10px] text-primary-400 ml-1.5">tu</span>}
                </p>
                <p className="text-[10px] text-white/40">
                  {r.matchdaysPlayed} {r.matchdaysPlayed === 1 ? 'giornata' : 'giornate'} ·{' '}
                  {r.correctPredictions} esatti
                  {r.weeklyWins > 0 && <span className="text-amber-400"> · {r.weeklyWins} 🏅</span>}
                </p>
              </div>
              <p className="font-black text-primary-300 flex-shrink-0">{r.totalPoints}</p>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-white/40 text-center px-4">
        Punti fatti con le schedine di questa lega. La classifica generale dell&apos;app è
        un&apos;altra cosa e si vede in{' '}
        <Link to="/classifica" className="text-primary-400 hover:underline">
          CLASSIFICA
        </Link>
        .
      </p>
    </div>
  );
}

// --- PARTITE della giornata --------------------------------------------------

function SezionePartite({
  partite,
  giornata,
  liveScores,
}: {
  partite: Match[];
  giornata: number | null;
  liveScores: Record<string, { homeGoals: number; awayGoals: number; status?: string }>;
}) {
  if (giornata == null || partite.length === 0) {
    return (
      <EmptyState
        icon="⚽"
        title="Nessuna partita"
        message="Le partite compaiono qui appena la prossima giornata è pronta."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 px-1">
        <Calendar size={12} className="text-primary-400" />
        <p className="text-xs font-bold text-white/60">Giornata {giornata}</p>
      </div>
      <div className="glass-card overflow-hidden divide-y divide-white/5">
        {partite.map(m => {
          const live = liveScores[m.id];
          const risultato = live ?? m.result;
          const inCorso = (live?.status ?? m.status) === 'live';
          const finita = (live?.status ?? m.status) === 'finished';
          return (
            <div key={m.id} className="flex items-center gap-2 px-3 py-2.5">
              <div className="w-12 flex-shrink-0 text-center">
                {inCorso ? (
                  <span className="text-[10px] font-black text-red-400 animate-pulse">LIVE</span>
                ) : (
                  <span className="text-[11px] font-mono text-white/40">{orario(m.scheduledAt)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <TeamLogo src={m.homeTeam.logo} name={m.homeTeam.name} size={16} />
                <span className="text-sm truncate">{m.homeTeam.shortName || m.homeTeam.name}</span>
                <span className="text-white/30 text-xs px-1">-</span>
                <TeamLogo src={m.awayTeam.logo} name={m.awayTeam.name} size={16} />
                <span className="text-sm truncate">{m.awayTeam.shortName || m.awayTeam.name}</span>
              </div>
              <div className="flex-shrink-0 text-right">
                {risultato ? (
                  <span className={cn('font-black text-sm', finita ? 'text-white' : 'text-red-400')}>
                    {risultato.homeGoals}-{risultato.awayGoals}
                  </span>
                ) : (
                  <span className="text-[10px] text-white/30">{competitionName(m.competition)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- MEMBRI ------------------------------------------------------------------

function SezioneMembri({
  lega,
  righe,
  codiceCopiato,
  onCopia,
}: {
  lega: LeagueDoc;
  righe: RankingRow[];
  codiceCopiato: boolean;
  onCopia: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="glass-card p-3">
        <p className="text-[10px] text-white/40 mb-1">Codice invito</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono font-black text-lg text-primary-300 tracking-widest">
            {lega.inviteCode}
          </code>
          <button
            onClick={onCopia}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
            aria-label="Copia il codice invito"
          >
            {codiceCopiato ? (
              <Check size={14} className="text-green-400" />
            ) : (
              <Copy size={14} className="text-white/60" />
            )}
          </button>
        </div>
        {lega.description && (
          <p className="text-xs text-white/50 mt-2 pt-2 border-t border-white/5">
            {lega.description}
          </p>
        )}
      </div>

      {/* La classifica elenca tutti i membri, anche chi non ha ancora giocato:
          è la sola fonte che porta anche i nomi. */}
      <div className="glass-card overflow-hidden divide-y divide-white/5">
        {righe.map(m => (
          <div key={m.participantId} className="flex items-center gap-2 px-3 py-2.5">
            <div className="w-6 flex-shrink-0 text-center">
              {m.participantId === lega.ownerId ? (
                <Crown size={13} className="text-amber-400 mx-auto" />
              ) : (
                <Users size={13} className="text-white/25 mx-auto" />
              )}
            </div>
            <p className="flex-1 min-w-0 text-sm truncate">{m.username}</p>
            {m.perfectSchedine > 0 && <Award size={13} className="text-primary-400 flex-shrink-0" />}
            {m.weeklyWins > 0 && (
              <span className="text-[10px] text-amber-400 flex-shrink-0 flex items-center gap-0.5">
                <Medal size={11} />
                {m.weeklyWins}
              </span>
            )}
          </div>
        ))}
        {righe.length === 0 && (
          <p className="px-3 py-4 text-sm text-white/40 text-center">
            {lega.memberCount} {lega.memberCount === 1 ? 'membro' : 'membri'}
          </p>
        )}
      </div>

      <Link
        to="/leghe"
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10 transition-colors"
      >
        <Trophy size={14} />
        Gestisci le mie leghe
      </Link>
    </div>
  );
}
