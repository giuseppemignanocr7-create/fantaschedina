import { memo, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Target, Clock, CheckCircle2, Send, RotateCcw,
  ChevronRight, Trophy, RefreshCw,
  ListChecks, TrendingUp, Pencil, Trash2, Copy,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useAppStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { sideCannons, vibrate } from '@/lib/juice';
import type { BetType, BetOutcome, Prediction, Match } from '@/types';
import type { MatchOdds } from '@/data/mockData';
import { CountdownTimer, PowerUpSelector, TeamLogo, ErrorState, useConferma } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { useSchedinaEditWindow } from '@/hooks';
import { MAX_PICKS_PER_SCHEDINA, type PowerUpSelection } from '@/lib/economy';
import {
  BONUS_TUTTI_GIUSTI,
  BONUS_UNO_SBAGLIATO,
  MIN_RICHIESTE_BONUS_UNO_SBAGLIATO,
  costoPowerup,
  puntiGiocata,
  puntiPotenziali,
} from '@/lib/anteprimaPunti';
import { pickRichieste } from '@/lib/pickRichieste';
import { QUOTA_MINIMA, quotaGiocabile, quoteAncoraAperte } from '@/lib/markets';
import { competitionName } from '@/lib/competitions';
import { getUserLeagues, type LeagueDoc } from '@/lib/leagues';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSilentProfileRefresh } from '@/hooks/useSilentProfileRefresh';
import { POWERUPS } from '@/lib/economy';

const BET_TYPES: {
  key: BetType;
  label: string;
  shortLabel: string;
  cols: number;
  options: { value: string; label: string }[];
}[] = [
  {
    key: 'esito', label: 'Esito Finale', shortLabel: '1X2', cols: 3,
    options: [{ value: '1', label: '1' }, { value: 'X', label: 'X' }, { value: '2', label: '2' }],
  },
  {
    key: 'over_under', label: 'Over/Under 2.5', shortLabel: 'O/U', cols: 2,
    options: [{ value: 'OVER', label: 'Over 2.5' }, { value: 'UNDER', label: 'Under 2.5' }],
  },
  {
    key: 'goal_nogoal', label: 'Goal / NoGoal', shortLabel: 'GG', cols: 2,
    options: [{ value: 'GG', label: 'Goal Goal' }, { value: 'NG', label: 'No Goal' }],
  },
  {
    key: 'doppia_chance', label: 'Doppia Chance', shortLabel: 'DC', cols: 3,
    options: [{ value: '1X', label: '1X' }, { value: '12', label: '12' }, { value: 'X2', label: 'X2' }],
  },
  {
    key: 'multigoal', label: 'Multigoal', shortLabel: 'MG', cols: 4,
    options: [
      { value: 'O0.5', label: 'O 0.5' }, { value: 'U0.5', label: 'U 0.5' },
      { value: 'O1.5', label: 'O 1.5' }, { value: 'U1.5', label: 'U 1.5' },
      { value: 'O2.5', label: 'O 2.5' }, { value: 'U2.5', label: 'U 2.5' },
      { value: 'O3.5', label: 'O 3.5' }, { value: 'U3.5', label: 'U 3.5' },
    ],
  },
  {
    key: 'esito_1t', label: 'Esito 1° Tempo', shortLabel: '1T', cols: 3,
    options: [{ value: '1', label: '1' }, { value: 'X', label: 'X' }, { value: '2', label: '2' }],
  },
  {
    key: 'over_under_1t', label: 'O/U 1° Tempo', shortLabel: 'O/U1T', cols: 2,
    options: [{ value: 'OVER', label: 'Over 1.5' }, { value: 'UNDER', label: 'Under 1.5' }],
  },
  {
    key: 'goal_nogoal_1t', label: 'GG/NG 1° Tempo', shortLabel: 'GG1T', cols: 2,
    options: [{ value: 'GG', label: 'Goal Goal' }, { value: 'NG', label: 'No Goal' }],
  },
];

type SlipPanelProps = {
  compact?: boolean;
  isComplete: boolean;
  completedCount: number;
  total: number;
  isLocked: boolean;
  canEdit: boolean;
  matches: Match[];
  predictions: Prediction[];
  totalPotential: number;
  isSubmitting: boolean;
  isCancelling: boolean;
  /** Saldo gettoni, per sapere quali power-up ci si puo' permettere. */
  coins: number;
  /** Power-up scelti per l'invio (o per il re-invio in modifica). */
  powerups: PowerUpSelection;
  onPowerupsChange: (p: PowerUpSelection) => void;
  /** Power-up allegati alla schedina gia' inviata (riepilogo a schedina chiusa). */
  savedPowerups: PowerUpSelection | undefined;
  /** Gettoni dei power-up gia' pagati, rimborsati al re-invio di una modifica. */
  creditoPowerup: number;
  onReset: () => void;
  onSubmit: () => void;
  onEdit: () => void;
  onCancel: () => void;
};

const SlipPanel = memo(function SlipPanel({
  compact = false,
  isComplete,
  completedCount,
  total,
  isLocked,
  canEdit,
  matches,
  predictions,
  totalPotential,
  isSubmitting,
  isCancelling,
  coins,
  powerups,
  onPowerupsChange,
  savedPowerups,
  creditoPowerup,
  onReset,
  onSubmit,
  onEdit,
  onCancel,
}: SlipPanelProps) {
  const getPrediction = (matchId: string): Prediction | undefined =>
    predictions.find(p => p.matchId === matchId);
  const attivi = (['jolly', 'shield', 'insurance'] as const).filter(id => !!savedPowerups?.[id]);

  return (
    <div className={cn('glass-card overflow-hidden border border-slate-200', compact && 'border-accent-500/20')}>
      {/* Slip header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <ListChecks size={14} className="text-accent-700" />
          <span className="font-black text-xs text-slate-900 uppercase tracking-wide">La tua Schedina</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'text-[10px] font-black px-2 py-0.5 rounded-full',
            isComplete ? 'bg-green-500/20 text-green-600' : 'bg-slate-100 text-slate-500'
          )}>
            {completedCount}/{total}
          </span>
          {completedCount > 0 && !isLocked && (
            <button
              onClick={onReset}
              title="Azzera la schedina"
              aria-label="Azzera tutti i pronostici"
              className="-my-2 -mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-600 hover:text-red-600 transition-colors"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-200">
        {matches.map((match, idx) => {
          const pred = getPrediction(match.id);
          return (
            <div key={match.id} className={cn(
              'flex items-center gap-2 px-3 py-2 transition-colors',
              pred ? 'bg-primary-500/5' : 'opacity-40'
            )}>
              <span className={cn(
                'w-4 h-4 rounded text-[10px] font-black flex items-center justify-center flex-shrink-0',
                pred ? 'bg-primary-500 text-night' : 'bg-slate-100 text-slate-600'
              )}>{idx + 1}</span>
              <span className="text-[10px] text-slate-500 flex-1 truncate leading-none">
                {match.homeTeam.shortName}–{match.awayTeam.shortName}
              </span>
              {pred ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="w-6 h-6 rounded font-black text-[11px] flex items-center justify-center bg-primary-500/25 text-primary-800">{pred.outcome}</span>
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-accent-700 font-bold leading-none">{pred.odds.toFixed(2)}</div>
                  </div>
                </div>
              ) : (
                <span className="text-slate-600 text-xs flex-shrink-0">—</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="px-3 py-2.5 border-t border-slate-200 bg-slate-50 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 flex items-center gap-1"><TrendingUp size={11} /> Punti potenziali</span>
          <span className="font-black text-primary-700 text-base">{Math.round(totalPotential)} pt</span>
        </div>
        {total > 0 && (
          <div className="text-[10px] text-slate-600 text-center">
            Bonus tutti giusti: <span className="text-green-600 font-bold">+{BONUS_TUTTI_GIUSTI} pt</span>
            {total >= MIN_RICHIESTE_BONUS_UNO_SBAGLIATO && (
              <> · uno solo sbagliato: <span className="text-yellow-700 font-bold">+{BONUS_UNO_SBAGLIATO} pt</span></>
            )}
          </div>
        )}
        {completedCount < total && completedCount > 0 && (
          <div className="text-[10px] text-yellow-700/90 text-center font-bold">
            Mancano {total - completedCount} pronostic{total - completedCount === 1 ? 'o' : 'i'}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isLocked ? (
        <div className="p-2.5 pt-0 space-y-2">
          {/* Power-up: si allegano alla schedina, il server li addebita all'invio
              (tornati il 15/09/2026: erano spariti con il rifacimento della pagina). */}
          {completedCount > 0 && (
            <PowerUpSelector
              coins={coins}
              selection={powerups}
              onChange={onPowerupsChange}
              matches={matches}
              predictions={predictions}
              disabled={isSubmitting}
              credito={creditoPowerup}
            />
          )}
          <button
            onClick={onSubmit}
            disabled={!isComplete || isSubmitting}
            className={cn(
              'w-full py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all',
              isComplete
                ? 'bg-gradient-to-r from-primary-500 to-primary-400 text-white shadow-lg shadow-primary-500/30 hover:from-primary-400 hover:to-primary-300'
                : 'bg-slate-100 text-slate-600 cursor-not-allowed'
            )}
          >
            {isSubmitting
              ? <><div className="w-3 h-3 border-2 border-slate-300 border-t-white rounded-full animate-spin" /> Invio...</>
              : <><Send size={13} /> {isComplete ? 'INVIA SCHEDINA' : total === 0 ? 'QUOTE NON DISPONIBILI' : `${completedCount}/${total} COMPLETATE`}</>
            }
          </button>
        </div>
      ) : (
        <div className="p-3 text-center space-y-2">
          <CheckCircle2 size={24} className="text-green-600 mx-auto mb-1.5" />
          <p className="font-bold text-green-600 text-sm">Inviata!</p>
          {attivi.length > 0 ? (
            <div className="flex flex-wrap gap-1 justify-center">
              {attivi.map(id => (
                <span key={id} className="text-[10px] font-bold bg-primary-500/15 text-primary-800 rounded-full px-2 py-0.5">
                  {POWERUPS[id].emoji} {POWERUPS[id].name}
                  {id === 'jolly' && savedPowerups?.jolly && (
                    <span className="text-slate-500 font-medium">
                      {' '}su {matches.find(m => m.id === savedPowerups.jolly)?.homeTeam.shortName ?? '?'}–
                      {matches.find(m => m.id === savedPowerups.jolly)?.awayTeam.shortName ?? '?'}
                    </span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-slate-500">Nessun power-up: con Modifica puoi aggiungerli.</p>
          )}
          {canEdit ? (
            <>
              <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                <button
                  onClick={onEdit}
                  className="min-h-[44px] flex items-center justify-center gap-1 px-3 rounded-lg bg-primary-500/20 border border-primary-500/30 text-primary-800 text-xs font-bold hover:bg-primary-500/30 transition-all"
                >
                  <Pencil size={12} />
                  Modifica
                </button>
                <button
                  onClick={onCancel}
                  disabled={isCancelling}
                  className="min-h-[44px] flex items-center justify-center gap-1 px-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-600 text-xs font-bold hover:bg-red-500/30 transition-all disabled:opacity-50"
                >
                  {isCancelling ? (
                    <div className="w-2.5 h-2.5 border-2 border-red-300/30 border-t-red-300 rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  Ritira schedina
                </button>
              </div>
              <p className="text-[10px] text-slate-600">Puoi modificarla o ritirarla fino a 2 ore prima dell'inizio della prima partita</p>
            </>
          ) : (
            <Link to="/classifica" className="text-[10px] text-primary-700 font-bold hover:text-primary-700 flex items-center gap-0.5 justify-center mt-1">
              Classifica <ChevronRight size={10} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
});

const MatchCard = memo(function MatchCard({
  match,
  idx,
  pred,
  odds,
  betType,
  betDef,
  isLocked,
  onSelect,
}: {
  match: Match;
  idx: number;
  pred: Prediction | undefined;
  odds: MatchOdds | undefined;
  betType: BetType;
  betDef: typeof BET_TYPES[number];
  isLocked: boolean;
  onSelect: (matchId: string, betType: BetType, outcome: BetOutcome) => void;
}) {
  const quoteMercato = odds?.[betType] as Record<string, number> | undefined;
  const sottoMinimo = betDef.options.some(
    opt => quoteMercato?.[opt.value] != null && quotaGiocabile(odds, betType, opt.value) == null
  );
  return (
    <div
      className={cn(
        'glass-card p-3 transition-all duration-200',
        pred && 'ring-1 ring-primary-500/60 bg-primary-500/5'
      )}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'w-5 h-5 rounded text-[10px] font-black flex items-center justify-center',
            pred ? 'bg-primary-500 text-night' : 'bg-slate-100 text-slate-500'
          )}>{idx + 1}</span>
          <div>
            <div className="flex items-center gap-1 text-sm font-bold text-slate-900 leading-tight">
              <TeamLogo src={match.homeTeam.logo} name={match.homeTeam.name} size={16} />
              <span>{match.homeTeam.shortName}</span>
              <span className="text-slate-600 text-[10px] font-normal">vs</span>
              <TeamLogo src={match.awayTeam.logo} name={match.awayTeam.name} size={16} />
              <span>{match.awayTeam.shortName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-accent-700/90 uppercase tracking-wide">
                {competitionName(match.competition)}
              </span>
              <p className="text-[10px] text-slate-600">{formatDate(match.scheduledAt)}</p>
            </div>
          </div>
        </div>
        {pred && (
          <div className="flex items-center gap-1 text-[10px]">
            <CheckCircle2 size={11} className="text-green-600" />
            <span className="font-black px-1.5 py-0.5 rounded text-[11px] bg-primary-500/20 text-primary-800">{pred.outcome}</span>
            <span className="text-accent-700 font-mono font-bold">@{pred.odds.toFixed(2)}</span>
          </div>
        )}
      </div>
      {!odds?.[betType] && (
        <p className="text-[11px] text-slate-500 py-2 text-center">
          {betDef.label}: quota non disponibile per questa partita
        </p>
      )}
      <div className={cn(
        'grid gap-1.5',
        betDef.cols === 2 && 'grid-cols-2',
        betDef.cols === 3 && 'grid-cols-3',
        betDef.cols === 4 && 'grid-cols-4',
      )}>
        {betDef.options.map((opt) => {
          // Senza quota del bookmaker non si offre la giocata: prima al suo
          // posto compariva un 2.00 fisso, cioe' un numero inventato. Anche
          // le quote sotto il minimo restano fuori: il server le rifiuta.
          const odd = quotaGiocabile(odds, betType, opt.value);
          if (odd == null) return null;
          const isSelected = pred?.outcome === opt.value && pred?.betType === betType;
          return (
            <button
              key={opt.value}
              onClick={() => onSelect(match.id, betType, opt.value as BetOutcome)}
              disabled={isLocked}
              aria-label={`${match.homeTeam.shortName} vs ${match.awayTeam.shortName}: seleziona ${opt.label} a quota ${odd.toFixed(2)}`}
              aria-pressed={isSelected}
              className={cn(
                'flex flex-col items-center justify-center py-2.5 rounded-xl border-2 transition-all duration-200 relative',
                isSelected
                  ? 'bg-primary-500/30 border-primary-400 shadow-lg shadow-primary-500/20'
                  : 'bg-slate-100 border-slate-200 hover:border-primary-500/50 hover:bg-slate-100',
                isLocked && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className={cn('text-[10px] font-bold uppercase mb-0.5',
                isSelected ? 'text-slate-600' : 'text-slate-500')}>{opt.label}</span>
              <span className={cn('text-base font-mono font-black',
                isSelected ? 'text-slate-900' : 'text-accent-700')}>
                {odd.toFixed(2)}
              </span>
              <span className={cn('text-[10px] font-bold mt-0.5',
                isSelected ? 'text-slate-500' : 'text-slate-600')}>
                {puntiGiocata(odd)}pt
              </span>
              {isSelected && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={9} className="text-slate-900" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      {sottoMinimo && (
        <p className="text-[10px] text-slate-500 mt-1.5 text-center">
          Le quote sotto {QUOTA_MINIMA.toFixed(2)} non si possono giocare e non sono mostrate.
        </p>
      )}
    </div>
  );
});

export function PronosticiPage() {
  const {
    currentMatchday,
    matchOdds,
    currentSchedina,
    updatePrediction,
    resetSchedina,
    submitSchedina,
    isLoadingOdds,
    lastOddsUpdate,
    refreshOdds,
    currentLeagueId,
    setCircuito,
    copiaDaGenerale,
    applyLastMinuteChange,
    selectedPowerups,
    setPowerups,
    agenziaSenzaQuote,
    matchdayError,
    loadMatchday,
  } = useAppStore(useShallow(s => ({
      agenziaSenzaQuote: s.agenziaSenzaQuote,
      matchdayError: s.matchdayError,
      loadMatchday: s.loadMatchday,
      currentMatchday: s.currentMatchday,
      matchOdds: s.matchOdds,
      currentSchedina: s.currentSchedina,
      updatePrediction: s.updatePrediction,
      resetSchedina: s.resetSchedina,
      submitSchedina: s.submitSchedina,
      isLoadingOdds: s.isLoadingOdds,
      lastOddsUpdate: s.lastOddsUpdate,
      refreshOdds: s.refreshOdds,
      currentLeagueId: s.currentLeagueId,
      setCircuito: s.setCircuito,
      copiaDaGenerale: s.copiaDaGenerale,
      applyLastMinuteChange: s.applyLastMinuteChange,
      selectedPowerups: s.selectedPowerups,
      setPowerups: s.setPowerups,
    })));

  const toast = useToast();
  const { user, profile } = useAuthContext();
  const refreshProfile = useSilentProfileRefresh('PronosticiPage');
  const {
    canEdit, canUseLastMinute, lastMinuteUsed, isDeadlinePassed, isSubmitted,
    isSubmitting: isCancelling, handleEdit, handleCancel,
  } = useSchedinaEditWindow();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBetType, setSelectedBetType] = useState<BetType>('esito');
  const [selectedCompetition, setSelectedCompetition] = useState<string>('all');

  // Leghe di cui l'utente fa parte: ognuna ha la sua schedina sulla stessa
  // giornata, e si compila da qui — non da un'altra pagina.
  // L'identita’ viene dall’autenticazione, non dal profilo: un documento
  // profilo senza il campo `id` faceva sparire il selettore di circuito senza
  // un errore, e la schedina di lega diventava irraggiungibile.
  const [mieLeghe, setMieLeghe] = useState<LeagueDoc[]>([]);
  const [erroreLeghe, setErroreLeghe] = useState(false);
  const [tentativoLeghe, setTentativoLeghe] = useState(0);
  const uid = user?.uid ?? null;
  useEffect(() => {
    if (!uid) return;
    let annullato = false;
    getUserLeagues(uid)
      .then(l => {
        if (annullato) return;
        setMieLeghe(l);
        setErroreLeghe(false);
      })
      .catch(e => {
        console.warn('[Pronostici] leghe:', e);
        if (!annullato) setErroreLeghe(true);
      });
    return () => {
      annullato = true;
    };
  }, [uid, tentativoLeghe]);

  const [dialogoConferma, chiediConferma] = useConferma();

  // `?lega=<id>` permette a Leghe di aprire direttamente la schedina giusta.
  const [searchParams, setSearchParams] = useSearchParams();
  const legaDaUrl = searchParams.get('lega');
  const richiestaUrl = legaDaUrl && legaDaUrl.length > 0 ? legaDaUrl : null;
  useEffect(() => {
    if (richiestaUrl === currentLeagueId) return;
    let vivo = true;
    void setCircuito(richiestaUrl).then(async esito => {
      if (!vivo || esito !== 'bozza') return;
      // C'e' una schedina non inviata: cambiando classifica andrebbe persa.
      const ok = await chiediConferma({
        titolo: 'Cambiare classifica?',
        messaggio:
          'La schedina che stai compilando non è stata inviata: cambiando classifica i pronostici scelti andranno persi.',
        conferma: 'Cambia e scarta',
        annulla: 'Resta qui',
        pericolo: true,
      });
      if (!vivo) return;
      if (ok) {
        void setCircuito(richiestaUrl, { scartaBozza: true });
      } else {
        const attuale = useAppStore.getState().currentLeagueId;
        setSearchParams(attuale ? { lega: attuale } : {}, { replace: true });
      }
    });
    return () => {
      vivo = false;
    };
  }, [richiestaUrl, currentLeagueId, setCircuito, chiediConferma, setSearchParams]);

  const cambiaCircuito = (leagueId: string | null) => {
    setSearchParams(leagueId ? { lega: leagueId } : {}, { replace: true });
  };

  // --- Cambio Last-Minute: dopo la deadline, a pagamento, una volta sola ---
  const [lastMinuteMode, setLastMinuteMode] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    matchId: string;
    betType: BetType;
    outcome: BetOutcome;
    odds: number;
  } | null>(null);
  // L'orologio sta nello stato: leggerlo durante il render rende il componente
  // impuro, e l'idoneità deve comunque decadere quando una partita inizia.
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Quote vive: si aggiornano da sole ogni due minuti finche’ la giornata e’
  // aperta. Prima si muovevano solo premendo il pulsante, e una schedina con
  // quote ferme da ore non invoglia nessuno. I pronostici gia’ scelti restano
  // dove sono, e i punti veri restano quelli che il server fissa all’invio.
  useEffect(() => {
    if (isDeadlinePassed) return;
    const id = setInterval(() => {
      if (!isSubmitting) void refreshOdds();
    }, 120_000);
    return () => clearInterval(id);
  }, [isDeadlinePassed, isSubmitting, refreshOdds]);

  const isMatchOpen = (matchId: string): boolean => {
    const m = currentMatchday?.matches.find(x => x.id === matchId);
    if (!m || now === 0) return false;
    return m.status === 'scheduled' && new Date(m.scheduledAt).getTime() > now;
  };

  const confermaLastMinute = async () => {
    if (!pendingChange) return;
    const ok = await applyLastMinuteChange(
      pendingChange.matchId,
      pendingChange.betType,
      pendingChange.outcome
    );
    if (ok) {
      vibrate([40, 20, 40]);
      toast.success(`Pronostico cambiato! −${POWERUPS.lastminute.cost} gettoni`);
      refreshProfile();
      setPendingChange(null);
      setLastMinuteMode(false);
    } else {
      toast.error(useAppStore.getState().error || 'Cambio non riuscito');
    }
  };

  const handleCopiaDaGenerale = async () => {
    if ((currentSchedina?.predictions?.length ?? 0) > 0) {
      const ok = await chiediConferma({
        titolo: 'Sostituire i pronostici?',
        messaggio: 'I pronostici già scelti per questa lega verranno sostituiti da quelli della schedina generale.',
        conferma: 'Sostituisci',
        pericolo: true,
      });
      if (!ok) return;
    }
    const esito = await copiaDaGenerale();
    if (!esito) {
      toast.error(useAppStore.getState().error || 'Copia non riuscita');
    } else if (esito.scartati > 0) {
      toast.warning(
        `Copiati ${esito.copiati} pronostici con le quote della lega. ${esito.scartati} ${
          esito.scartati === 1 ? 'è rimasto fuori' : 'sono rimasti fuori'
        }: in questa lega quel mercato non è quotato (o la quota è sotto ${QUOTA_MINIMA.toFixed(2)}).`
      );
    } else {
      toast.success(`Copiati ${esito.copiati} pronostici con le quote della lega`);
    }
  };

  const handleReset = async () => {
    const ok = await chiediConferma({
      titolo: 'Azzerare la schedina?',
      messaggio: 'Tutti i pronostici scelti verranno tolti.',
      conferma: 'Azzera',
      pericolo: true,
    });
    if (ok) resetSchedina();
  };

  const handleRitira = async () => {
    const ok = await chiediConferma({
      titolo: 'Ritirare la schedina?',
      messaggio:
        'La schedina non sarà più in gioco per questa giornata e i gettoni dei power-up ti verranno restituiti. Potrai compilarne una nuova fino alla chiusura.',
      conferma: 'Ritira schedina',
      annulla: 'Tienila',
      pericolo: true,
    });
    if (!ok) return;
    await handleCancel();
    refreshProfile();
  };

  const predictions = useMemo(() => currentSchedina?.predictions || [], [currentSchedina?.predictions]);
  const completedCount = predictions.length;
  // Dieci pronostici, o meno se l'agenzia del circuito ha quotato meno partite
  // (contando, come il server, solo quelle non ancora iniziate). Una schedina
  // gia' inviata resta della sua misura anche quando le partite cominciano.
  const richiesteAperte = pickRichieste(quoteAncoraAperte(currentMatchday?.matches, matchOdds, now));
  const total = currentSchedina?.isLocked && completedCount > 0 ? completedCount : richiesteAperte;
  const isComplete = total > 0 && completedCount === total;

  const getPrediction = (matchId: string): Prediction | undefined =>
    predictions.find(p => p.matchId === matchId);

  // Punti se va tutto a segno, con i power-up scelti (Jolly, Scudo) e il bonus.
  const powerupInAnteprima = currentSchedina?.isLocked ? currentSchedina.powerups : selectedPowerups;
  const totalPotential = useMemo(
    () => puntiPotenziali(predictions, powerupInAnteprima, total),
    [predictions, powerupInAnteprima, total]
  );
  // Modificando una schedina gia' inviata, i power-up pagati tornano al re-invio.
  const creditoPowerup =
    currentSchedina?.submittedAt && !currentSchedina.isLocked
      ? costoPowerup(currentSchedina.powerups)
      : 0;

  // Mercati davvero quotati in questa giornata, per questo circuito: gli
  // altri non compaiono nemmeno come linguetta.
  const mercatiDisponibili = useMemo(() => {
    const presenti = new Set<string>();
    for (const m of currentMatchday?.matches ?? []) {
      const quote = matchOdds[m.id] as Record<string, unknown> | undefined;
      if (!quote) continue;
      for (const [mercato, valori] of Object.entries(quote)) {
        if (valori) presenti.add(mercato);
      }
    }
    const disponibili = BET_TYPES.filter(b => presenti.has(b.key));
    return disponibili.length > 0 ? disponibili : BET_TYPES.slice(0, 1);
  }, [currentMatchday, matchOdds]);

  const currentBetDef =
    mercatiDisponibili.find(b => b.key === selectedBetType) ?? mercatiDisponibili[0];

  const availableCompetitions = useMemo(() => {
    // m.competition può mancare per partite sincronizzate prima che il campo fosse
    // popolato lato server: le si mostra comunque sotto "Tutti i campionati", ma
    // non genera un bottone filtro rotto (key vuota / label vuota).
    const codes = new Set((currentMatchday?.matches ?? []).map(m => m.competition).filter(Boolean));
    return [...codes];
  }, [currentMatchday?.matches]);

  const pickedMatches = useMemo(() => {
    const pickedIds = new Set(predictions.map(p => p.matchId));
    return (currentMatchday?.matches ?? []).filter(m => pickedIds.has(m.id));
  }, [currentMatchday?.matches, predictions]);

  const visibleMatches = useMemo(() => {
    const all = currentMatchday?.matches ?? [];
    if (selectedCompetition === 'all') return all;
    if (selectedCompetition === 'mine') return pickedMatches;
    return all.filter(m => m.competition === selectedCompetition);
  }, [currentMatchday?.matches, selectedCompetition, pickedMatches]);

  const handleSelect = (matchId: string, betType: BetType, outcome: BetOutcome) => {
    // In modalità Cambio Last-Minute il click non modifica la schedina: propone
    // la sostituzione, che poi va confermata perché costa gettoni.
    if (lastMinuteMode && isMatchOpen(matchId) && predictions.some(p => p.matchId === matchId)) {
      const quota = quotaGiocabile(matchOdds[matchId], betType, outcome);
      if (quota == null) return;
      setPendingChange({ matchId, betType, outcome, odds: quota });
      return;
    }
    if (currentSchedina?.isLocked) return;
    const isNewMatch = !predictions.some(p => p.matchId === matchId);
    if (isNewMatch && predictions.length >= total) {
      toast.warning(`Hai già scelto ${total} partite: rimuovine una per cambiarla`);
      return;
    }
    // Il server valida sulle sue quote: una giocata senza quota (o sotto il
    // minimo) verrebbe comunque rifiutata, ed e' giusto non farla nemmeno scegliere.
    const odds = quotaGiocabile(matchOdds[matchId], betType, outcome);
    if (odds == null) return;
    vibrate(15);
    updatePrediction(matchId, { matchId, betType, outcome, odds });
  };

  const handleSubmit = async () => {
    if (!isComplete) return;
    setIsSubmitting(true);
    await submitSchedina();
    setIsSubmitting(false);
    if (!useAppStore.getState().error) {
      vibrate([50, 30, 80]);
      sideCannons();
      // Il saldo gettoni cambia se ci sono power-up: va riletto.
      refreshProfile();
      toast.success('Schedina inviata con successo!');
    } else {
      toast.error(useAppStore.getState().error || 'Errore nell\'invio della schedina');
    }
  };

  const formatTime = (d: Date | null) => {
    if (!d) return null;
    return new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  if (!currentMatchday) {
    if (isLoadingOdds) {
      return (
        <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Caricamento giornata in corso">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-primary-500 rounded-full animate-spin" />
        </div>
      );
    }
    if (matchdayError) {
      return <ErrorState message={matchdayError} onRetry={() => void loadMatchday()} />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Nessuna giornata disponibile</p>
      </div>
    );
  }

  const slipProps = {
    isComplete,
    completedCount,
    total,
    isLocked: !!currentSchedina?.isLocked,
    canEdit,
    matches: pickedMatches,
    predictions,
    totalPotential,
    isSubmitting,
    isCancelling,
    coins: profile?.coins ?? 0,
    powerups: selectedPowerups,
    onPowerupsChange: setPowerups,
    savedPowerups: currentSchedina?.powerups,
    creditoPowerup,
    onReset: () => void handleReset(),
    onSubmit: handleSubmit,
    onEdit: handleEdit,
    onCancel: () => void handleRitira(),
  };

  const legaCorrente = mieLeghe.find(l => l.id === currentLeagueId);

  return (
    <div className="min-h-screen">
      {dialogoConferma}
      <div className="max-w-[1080px] mx-auto px-3 py-4">
        <div className="flex gap-4 items-start">

          {/* ── LEFT / MAIN COLUMN ── */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Target size={20} className="text-primary-700" />
                <h1 className="page-title">PRONOSTICI</h1>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-primary-800 bg-primary-500/10 border border-primary-500/20 px-2 py-1 rounded-full font-bold">
                  <Trophy size={11} />
                  G.{currentMatchday.number}
                </div>
                <button
                  onClick={refreshOdds}
                  disabled={isLoadingOdds}
                  title={lastOddsUpdate ? `Aggiornato: ${formatTime(lastOddsUpdate)}` : 'Aggiorna quote'}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border transition-all',
                    isLoadingOdds
                      ? 'bg-accent-500/10 border-accent-500/20 text-accent-700 cursor-not-allowed'
                      : 'bg-accent-500/10 border-accent-500/20 text-accent-700 hover:bg-accent-500/20'
                  )}
                >
                  <RefreshCw size={11} className={cn(isLoadingOdds && 'animate-spin')} />
                  <span className="hidden sm:inline">{isLoadingOdds ? 'Aggiorno...' : lastOddsUpdate ? formatTime(lastOddsUpdate) : 'Quote LIVE'}</span>
                  <span className="sm:hidden">{isLoadingOdds ? '...' : lastOddsUpdate ? formatTime(lastOddsUpdate) : 'LIVE'}</span>
                </button>
              </div>
            </div>

            {matchdayError && (
              <div className="glass-card p-3 border-red-500/30 bg-red-500/5 flex flex-wrap items-center justify-between gap-2" role="alert">
                <p className="text-xs text-red-700">{matchdayError}</p>
                <button
                  onClick={() => void loadMatchday()}
                  className="min-h-[44px] flex items-center gap-1.5 px-3 rounded-lg bg-white border border-red-500/30 text-red-700 text-xs font-bold hover:bg-red-50"
                >
                  <RefreshCw size={12} /> Riprova
                </button>
              </div>
            )}

            {erroreLeghe && (
              <div className="glass-card p-3 flex flex-wrap items-center justify-between gap-2" role="alert">
                <p className="text-xs text-slate-600">
                  Non siamo riusciti a caricare le tue leghe: per ora puoi giocare solo la classifica generale.
                </p>
                <button
                  onClick={() => setTentativoLeghe(n => n + 1)}
                  className="min-h-[44px] flex items-center gap-1.5 px-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-200"
                >
                  <RefreshCw size={12} /> Riprova
                </button>
              </div>
            )}

            {/* Circuito: una schedina per la generale, una per ogni lega */}
            {mieLeghe.length > 0 && (
              <div className="glass-card p-3">
                <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-2">
                  Per quale classifica stai giocando
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[{ id: null as string | null, nome: 'Generale', inAttesa: false },
                    ...mieLeghe.map(l => ({
                      id: l.id as string | null,
                      nome: l.name,
                      // Lega in attesa dell'agenzia: non si gioca finche' l'admin non la assegna.
                      inAttesa: l.stato === 'in_attesa',
                    }))].map(circuito => (
                    <button
                      key={circuito.id ?? 'generale'}
                      onClick={() => cambiaCircuito(circuito.id)}
                      disabled={circuito.inAttesa && currentLeagueId !== circuito.id}
                      title={circuito.inAttesa ? "In attesa che l'admin assegni l'agenzia delle quote" : undefined}
                      className={cn(
                        'min-h-[44px] px-3 rounded-lg text-xs font-bold border transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                        currentLeagueId === circuito.id
                          ? 'bg-primary-500 border-primary-400 text-night'
                          : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-100'
                      )}
                    >
                      {circuito.nome}
                      {circuito.inAttesa && (
                        <span className="block text-[10px] font-semibold">in attesa dell'agenzia</span>
                      )}
                    </button>
                  ))}
                </div>
                {legaCorrente?.stato === 'in_attesa' && (
                  <p className="mt-2 text-[11px] text-yellow-700 font-bold">
                    Questa lega aspetta che l'admin le assegni l'agenzia delle quote: la schedina non si può ancora giocare.
                  </p>
                )}
                {currentLeagueId && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleCopiaDaGenerale}
                      disabled={!!currentSchedina?.isLocked || total === 0}
                      className="min-h-[44px] flex items-center gap-1.5 px-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Copy size={12} />
                      Copia dalla schedina generale
                    </button>
                    <span className="text-[10px] text-slate-500">
                      Vale solo per la lega: niente gettoni dai pronostici.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Cambio Last-Minute: dopo la deadline è l'unico modo di toccare la schedina */}
            {isSubmitted && isDeadlinePassed && (
              <div className="glass-card p-3 border-accent-500/30 bg-accent-500/5">
                {lastMinuteUsed ? (
                  <p className="text-slate-500 text-xs">
                    Cambio Last-Minute già usato per questa giornata.
                  </p>
                ) : pendingChange ? (
                  <>
                    <p className="text-accent-700 font-bold text-sm mb-1">Confermi il cambio?</p>
                    <p className="text-slate-500 text-xs mb-2">
                      Nuovo pronostico {pendingChange.outcome} @{pendingChange.odds.toFixed(2)} ·{' '}
                      <span className="text-accent-700 font-bold">
                        −{POWERUPS.lastminute.cost} gettoni
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={confermaLastMinute}
                        className="px-3 py-1.5 rounded-lg bg-accent-500/20 border border-accent-500/30 text-accent-700 text-xs font-bold hover:bg-accent-500/30"
                      >
                        Conferma (−{POWERUPS.lastminute.cost} 🪙)
                      </button>
                      <button
                        onClick={() => setPendingChange(null)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-100"
                      >
                        Scegli un'altra quota
                      </button>
                    </div>
                  </>
                ) : lastMinuteMode ? (
                  <>
                    <p className="text-accent-700 font-bold text-sm mb-1">Scegli la nuova quota</p>
                    <p className="text-slate-500 text-xs mb-2">
                      Tocca una quota su una partita che hai giocato e non è ancora iniziata.
                    </p>
                    <button
                      onClick={() => setLastMinuteMode(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-100"
                    >
                      Annulla
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-accent-700 font-bold text-sm mb-1">
                      Cambio Last-Minute disponibile
                    </p>
                    <p className="text-slate-500 text-xs mb-2">
                      La deadline è passata: con {POWERUPS.lastminute.cost} gettoni cambi{' '}
                      <span className="font-bold">un solo</span> pronostico, su una partita non
                      ancora iniziata.
                    </p>
                    <button
                      onClick={() => setLastMinuteMode(true)}
                      disabled={!canUseLastMinute}
                      className="px-3 py-1.5 rounded-lg bg-accent-500/20 border border-accent-500/30 text-accent-700 text-xs font-bold hover:bg-accent-500/30 disabled:opacity-40"
                    >
                      Usa Cambio Last-Minute ({POWERUPS.lastminute.cost} 🪙)
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Quante partite si possono davvero giocare in questo circuito */}
            {!isLoadingOdds && agenziaSenzaQuote ? (
              <div className="glass-card p-3 border-yellow-500/30 bg-yellow-500/5" role="status">
                <p className="text-xs text-yellow-800 font-bold">
                  Quote dell'agenzia non ancora disponibili
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Questa lega gioca con le quote della sua agenzia, che non le ha ancora pubblicate. Riprova più tardi.
                </p>
              </div>
            ) : !isLoadingOdds && total === 0 ? (
              <div className="glass-card p-3 border-yellow-500/30 bg-yellow-500/5" role="status">
                <p className="text-xs text-yellow-800 font-bold">Nessuna partita quotata per ora</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Senza quote del bookmaker la schedina non si può giocare. Riprova più tardi.
                </p>
              </div>
            ) : total > 0 && total < MAX_PICKS_PER_SCHEDINA ? (
              <div className="glass-card p-3 border-accent-500/30 bg-accent-500/5" role="status">
                <p className="text-[11px] text-slate-700">
                  Per questa giornata {currentLeagueId ? "l'agenzia della lega ha" : 'il bookmaker ha'} quotato
                  solo {total} partit{total === 1 ? 'a' : 'e'}: la schedina è di{' '}
                  <span className="font-bold">{total} pronostic{total === 1 ? 'o' : 'i'}</span> invece di {MAX_PICKS_PER_SCHEDINA}.
                </p>
              </div>
            ) : null}

            {/* Progress + Countdown */}
            <div className="glass-card p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Partite scelte (a piacere, da tutti i campionati attivi)</span>
                <span className={cn('font-bold', isComplete ? 'text-green-600' : 'text-primary-700')}>
                  {completedCount} / {total}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500',
                    isComplete ? 'bg-green-500' : 'bg-gradient-to-r from-primary-600 to-primary-400')}
                  style={{ width: `${total > 0 ? Math.min(100, (completedCount / total) * 100) : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Clock size={10} />
                  <CountdownTimer deadline={currentMatchday.deadline} />
                </div>
                {completedCount > 0 && (
                  <span className="text-[10px] text-accent-700 font-bold flex items-center gap-1">
                    <TrendingUp size={11} />
                    {Math.round(totalPotential)} pt potenziali
                  </span>
                )}
              </div>
            </div>

            {/* Competition Filter */}
            <div className="glass-card p-1.5 overflow-x-auto scrollbar-hide">
              <div className="flex gap-1 min-w-max">
                <button
                  onClick={() => setSelectedCompetition('all')}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
                    selectedCompetition === 'all'
                      ? 'bg-accent-500 text-night'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  Tutti i campionati
                </button>
                <button
                  onClick={() => setSelectedCompetition('mine')}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
                    selectedCompetition === 'mine'
                      ? 'bg-accent-500 text-night'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  Le mie ({completedCount})
                </button>
                {availableCompetitions.map(code => (
                  <button
                    key={code}
                    onClick={() => setSelectedCompetition(code)}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
                      selectedCompetition === code
                        ? 'bg-accent-500 text-night'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    {competitionName(code)}
                  </button>
                ))}
              </div>
            </div>

            {/* Bet Type Selector */}
            <div className="glass-card p-1.5 overflow-x-auto scrollbar-hide">
              <div className="flex gap-1 min-w-max">
                {mercatiDisponibili.map((bt) => (
                  <button
                    key={bt.key}
                    onClick={() => setSelectedBetType(bt.key)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
                      currentBetDef.key === bt.key
                        ? 'bg-primary-500 text-night'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    <span className="font-black text-[11px]">{bt.shortLabel}</span>
                    <span className={cn(
                      'text-[10px] font-normal hidden sm:block',
                      currentBetDef.key === bt.key ? 'text-slate-500' : 'text-slate-600'
                    )}>{bt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Matches */}
            <div className="space-y-2">
              {visibleMatches.length === 0 && (
                <div className="glass-card p-6 text-center text-slate-500 text-sm">
                  Nessuna partita in questo campionato al momento.
                </div>
              )}
              {visibleMatches.map((match, idx) => (
              <MatchCard
                key={match.id}
                match={match}
                idx={idx}
                pred={getPrediction(match.id)}
                odds={matchOdds[match.id]}
                betType={currentBetDef.key}
                betDef={currentBetDef}
                isLocked={!!currentSchedina?.isLocked && !lastMinuteMode}
                onSelect={handleSelect}
              />
            ))}
            </div>

            {/* Slip panel — always visible on mobile, below all matches */}
            <div className="lg:hidden pb-20">
              <SlipPanel {...slipProps} />
            </div>

          </div>

          {/* ── RIGHT COLUMN: Slip (desktop only, sticky) ── */}
          <div className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-20">
              <SlipPanel {...slipProps} compact />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
