import { memo, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Target, Clock, CheckCircle2, Send, RotateCcw,
  ChevronRight, Trophy, RefreshCw,
  ListChecks, TrendingUp, Pencil, Trash2,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useAppStore } from '@/store';
import { sideCannons, vibrate } from '@/lib/juice';
import type { BetType, BetOutcome, Prediction, Match } from '@/types';
import type { MatchOdds } from '@/data/mockData';
import { CountdownTimer, TeamLogo } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { MAX_PICKS_PER_SCHEDINA } from '@/lib/economy';
import { competitionName } from '@/lib/competitions';

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
  onReset,
  onSubmit,
  onEdit,
  onCancel,
}: SlipPanelProps) {
  const getPrediction = (matchId: string): Prediction | undefined =>
    predictions.find(p => p.matchId === matchId);

  return (
    <div className={cn('glass-card overflow-hidden border border-white/8', compact && 'border-accent-500/20')}>
      {/* Slip header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/8 bg-white/3">
        <div className="flex items-center gap-2">
          <ListChecks size={14} className="text-accent-400" />
          <span className="font-black text-xs text-white uppercase tracking-wide">La tua Schedina</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'text-[10px] font-black px-2 py-0.5 rounded-full',
            isComplete ? 'bg-green-500/20 text-green-400' : 'bg-white/8 text-white/40'
          )}>
            {completedCount}/{total}
          </span>
          {completedCount > 0 && !isLocked && (
            <button onClick={onReset} title="Azzera" aria-label="Azzera pronostico" className="text-white/25 hover:text-red-400 transition-colors p-0.5">
              <RotateCcw size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/5">
        {matches.map((match, idx) => {
          const pred = getPrediction(match.id);
          return (
            <div key={match.id} className={cn(
              'flex items-center gap-2 px-3 py-2 transition-colors',
              pred ? 'bg-primary-500/5' : 'opacity-40'
            )}>
              <span className={cn(
                'w-4 h-4 rounded text-[8px] font-black flex items-center justify-center flex-shrink-0',
                pred ? 'bg-primary-500 text-white' : 'bg-white/10 text-white/30'
              )}>{idx + 1}</span>
              <span className="text-[10px] text-white/60 flex-1 truncate leading-none">
                {match.homeTeam.shortName}–{match.awayTeam.shortName}
              </span>
              {pred ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="w-6 h-6 rounded font-black text-[11px] flex items-center justify-center bg-primary-500/25 text-primary-300">{pred.outcome}</span>
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-accent-400 font-bold leading-none">{pred.odds.toFixed(2)}</div>
                    <div className="text-[9px] text-primary-400 font-bold leading-none mt-0.5">{Math.round(pred.odds * 10)}pt</div>
                  </div>
                </div>
              ) : (
                <span className="text-white/20 text-xs flex-shrink-0">—</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="px-3 py-2.5 border-t border-white/8 bg-white/3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40 flex items-center gap-1"><TrendingUp size={11} /> Punti potenziali</span>
          <span className="font-black text-primary-400 text-base">{Math.round(totalPotential)} pt</span>
        </div>
        {isComplete && (
          <div className="text-[9px] text-white/30 text-center">
            Bonus 10/10: <span className="text-green-400 font-bold">+50pt</span> · 9/10: <span className="text-yellow-400 font-bold">+20pt</span>
          </div>
        )}
        {completedCount < total && completedCount > 0 && (
          <div className="text-[9px] text-yellow-400/70 text-center font-bold">
            Mancano {total - completedCount} pronostic{total - completedCount === 1 ? 'o' : 'i'}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isLocked ? (
        <div className="p-2.5 pt-0 space-y-2">
          <button
            onClick={onSubmit}
            disabled={!isComplete || isSubmitting}
            className={cn(
              'w-full py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all',
              isComplete
                ? 'bg-gradient-to-r from-primary-500 to-primary-400 text-white shadow-lg shadow-primary-500/30 hover:from-primary-400 hover:to-primary-300'
                : 'bg-white/8 text-white/25 cursor-not-allowed'
            )}
          >
            {isSubmitting
              ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Invio...</>
              : <><Send size={13} /> {isComplete ? 'INVIA SCHEDINA' : `${completedCount}/${total} COMPLETATE`}</>
            }
          </button>
        </div>
      ) : (
        <div className="p-3 text-center space-y-2">
          <CheckCircle2 size={24} className="text-green-400 mx-auto mb-1.5" />
          <p className="font-bold text-green-400 text-sm">Inviata!</p>
          {canEdit ? (
            <>
              <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                <button
                  onClick={onEdit}
                  className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-primary-500/20 border border-primary-500/30 text-primary-300 text-[10px] font-bold hover:bg-primary-500/30 transition-all"
                >
                  <Pencil size={11} />
                  Modifica
                </button>
                <button
                  onClick={onCancel}
                  disabled={isCancelling}
                  className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-bold hover:bg-red-500/30 transition-all disabled:opacity-50"
                >
                  {isCancelling ? (
                    <div className="w-2.5 h-2.5 border-2 border-red-300/30 border-t-red-300 rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={11} />
                  )}
                  Annulla
                </button>
              </div>
              <p className="text-[9px] text-white/30">Disponibile fino a 2 ore dall'inizio della prima partita</p>
            </>
          ) : (
            <Link to="/classifica" className="text-[10px] text-primary-400 font-bold hover:text-primary-300 flex items-center gap-0.5 justify-center mt-1">
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
            'w-5 h-5 rounded text-[9px] font-black flex items-center justify-center',
            pred ? 'bg-primary-500 text-white' : 'bg-white/10 text-white/40'
          )}>{idx + 1}</span>
          <div>
            <div className="flex items-center gap-1 text-sm font-bold text-white leading-tight">
              <TeamLogo src={match.homeTeam.logo} name={match.homeTeam.name} size={16} />
              <span>{match.homeTeam.shortName}</span>
              <span className="text-white/30 text-[10px] font-normal">vs</span>
              <TeamLogo src={match.awayTeam.logo} name={match.awayTeam.name} size={16} />
              <span>{match.awayTeam.shortName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-bold text-accent-400/70 uppercase tracking-wide">
                {competitionName(match.competition)}
              </span>
              <p className="text-[9px] text-white/35">{formatDate(match.scheduledAt)}</p>
            </div>
          </div>
        </div>
        {pred && (
          <div className="flex items-center gap-1 text-[10px]">
            <CheckCircle2 size={11} className="text-green-400" />
            <span className="font-black px-1.5 py-0.5 rounded text-[11px] bg-primary-500/20 text-primary-300">{pred.outcome}</span>
            <span className="text-accent-400 font-mono font-bold">@{pred.odds.toFixed(2)}</span>
            <span className="text-primary-400 font-bold">={Math.round(pred.odds * 10)}pt</span>
          </div>
        )}
      </div>
      <div className={cn(
        'grid gap-1.5',
        betDef.cols === 2 && 'grid-cols-2',
        betDef.cols === 3 && 'grid-cols-3',
        betDef.cols === 4 && 'grid-cols-4',
      )}>
        {betDef.options.map((opt) => {
          const typeOdds = odds?.[betType] as Record<string, number> | undefined;
          const odd = typeOdds?.[opt.value] ?? 2.00;
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
                  : 'bg-white/5 border-white/10 hover:border-primary-500/50 hover:bg-white/10',
                isLocked && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className={cn('text-[9px] font-bold uppercase mb-0.5',
                isSelected ? 'text-white/80' : 'text-white/40')}>{opt.label}</span>
              <span className={cn('text-base font-mono font-black',
                isSelected ? 'text-white' : 'text-accent-400')}>
                {odd.toFixed(2)}
              </span>
              <span className={cn('text-[8px] font-bold mt-0.5',
                isSelected ? 'text-white/60' : 'text-white/25')}>
                {Math.round(odd * 10)}pt
              </span>
              {isSelected && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={9} className="text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
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
    unlockSchedina,
    cancelSchedina,
    isLoadingOdds,
    lastOddsUpdate,
    refreshOdds,
  } = useAppStore();

  const toast = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [selectedBetType, setSelectedBetType] = useState<BetType>('esito');
  const [selectedCompetition, setSelectedCompetition] = useState<string>('all');

  const predictions = useMemo(() => currentSchedina?.predictions || [], [currentSchedina?.predictions]);
  const total = MAX_PICKS_PER_SCHEDINA;
  const completedCount = predictions.length;
  const isComplete = completedCount === total;

  const getPrediction = (matchId: string): Prediction | undefined =>
    predictions.find(p => p.matchId === matchId);

  const totalPotential = useMemo(() =>
    predictions.reduce((sum, p) => sum + p.odds * 10, 0), [predictions]);

  const currentBetDef = BET_TYPES.find(b => b.key === selectedBetType)!;

  const availableCompetitions = useMemo(() => {
    const codes = new Set((currentMatchday?.matches ?? []).map(m => m.competition));
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
    if (currentSchedina?.isLocked) return;
    const isNewMatch = !predictions.some(p => p.matchId === matchId);
    if (isNewMatch && predictions.length >= MAX_PICKS_PER_SCHEDINA) {
      toast.warning(`Hai già scelto ${MAX_PICKS_PER_SCHEDINA} partite: rimuovine una per cambiarla`);
      return;
    }
    const mOdds = matchOdds[matchId];
    const typeOdds = mOdds?.[betType] as Record<string, number> | undefined;
    const odds = typeOdds?.[outcome] || 2.00;
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
      toast.success('Schedina inviata con successo!');
    } else {
      toast.error(useAppStore.getState().error || 'Errore nell\'invio della schedina');
    }
  };

  const handleEdit = () => {
    unlockSchedina();
    toast.info('Puoi modificare la schedina. Re-invia per confermare le modifiche.');
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    await cancelSchedina();
    setIsCancelling(false);
    if (!useAppStore.getState().error) {
      vibrate([40, 20, 40]);
      toast.success('Schedina annullata con successo. Gettoni power-up rimborsati.');
    } else {
      toast.error(useAppStore.getState().error || 'Errore nell\'annullamento della schedina');
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
          <div className="w-8 h-8 border-2 border-white/20 border-t-primary-500 rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/40">Nessuna giornata disponibile</p>
      </div>
    );
  }

  const isDeadlinePassed = new Date().getTime() >= new Date(currentMatchday.deadline).getTime();
  const canEdit = !!currentSchedina?.isLocked && !isDeadlinePassed;

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
    onReset: resetSchedina,
    onSubmit: handleSubmit,
    onEdit: handleEdit,
    onCancel: handleCancel,
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[1080px] mx-auto px-3 py-4">
        <div className="flex gap-4 items-start">

          {/* ── LEFT / MAIN COLUMN ── */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Target size={20} className="text-primary-400" />
                <h1 className="page-title">PRONOSTICI</h1>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-primary-400 bg-primary-500/10 border border-primary-500/20 px-2 py-1 rounded-full font-bold">
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
                      ? 'bg-accent-500/10 border-accent-500/20 text-accent-400 cursor-not-allowed'
                      : 'bg-accent-500/10 border-accent-500/20 text-accent-400 hover:bg-accent-500/20'
                  )}
                >
                  <RefreshCw size={11} className={cn(isLoadingOdds && 'animate-spin')} />
                  <span className="hidden sm:inline">{isLoadingOdds ? 'Aggiorno...' : lastOddsUpdate ? formatTime(lastOddsUpdate) : 'Quote LIVE'}</span>
                  <span className="sm:hidden">{isLoadingOdds ? '...' : lastOddsUpdate ? formatTime(lastOddsUpdate) : 'LIVE'}</span>
                </button>
              </div>
            </div>

            {/* Progress + Countdown */}
            <div className="glass-card p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Partite scelte (a piacere, da tutti i campionati attivi)</span>
                <span className={cn('font-bold', isComplete ? 'text-green-400' : 'text-primary-400')}>
                  {completedCount} / {total}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500',
                    isComplete ? 'bg-green-500' : 'bg-gradient-to-r from-primary-600 to-primary-400')}
                  style={{ width: `${(completedCount / total) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] text-white/40">
                  <Clock size={10} />
                  <CountdownTimer deadline={currentMatchday.deadline} />
                </div>
                {completedCount > 0 && (
                  <span className="text-[10px] text-accent-400 font-bold flex items-center gap-1">
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
                      ? 'bg-accent-500 text-white'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                  )}
                >
                  Tutti i campionati
                </button>
                <button
                  onClick={() => setSelectedCompetition('mine')}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
                    selectedCompetition === 'mine'
                      ? 'bg-accent-500 text-white'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
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
                        ? 'bg-accent-500 text-white'
                        : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
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
                {BET_TYPES.map((bt) => (
                  <button
                    key={bt.key}
                    onClick={() => setSelectedBetType(bt.key)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
                      selectedBetType === bt.key
                        ? 'bg-primary-500 text-white'
                        : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <span className="font-black text-[11px]">{bt.shortLabel}</span>
                    <span className={cn(
                      'text-[8px] font-normal hidden sm:block',
                      selectedBetType === bt.key ? 'text-white/70' : 'text-white/25'
                    )}>{bt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Matches */}
            <div className="space-y-2">
              {visibleMatches.length === 0 && (
                <div className="glass-card p-6 text-center text-white/40 text-sm">
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
                betType={selectedBetType}
                betDef={currentBetDef}
                isLocked={!!currentSchedina?.isLocked}
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
