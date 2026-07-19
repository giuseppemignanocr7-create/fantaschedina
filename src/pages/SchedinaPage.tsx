import { useMemo, useState } from 'react';
import {
  Check, AlertCircle, Send, Info, Trophy, Zap, Clock, RotateCcw, RefreshCw, Pencil, Trash2,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useAppStore } from '@/store';
import type { BetType, BetOutcome, Prediction } from '@/types';
import { isValidOdds, isInPenaltyRange, calculateSchedinaScore, calculateBetPoints } from '@/lib/scoring';
import { CountdownTimer, QuickBet, PowerUpSelector, TeamLogo } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { sideCannons, vibrate } from '@/lib/juice';

// 10 matches = 10 giocate
const TOTAL_PREDICTIONS = 10;

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

export function SchedinaPage() {
  const {
    currentMatchday,
    matchOdds,
    currentSchedina,
    currentUser,
    updatePrediction,
    submitSchedina,
    resetSchedina,
    unlockSchedina,
    cancelSchedina,
    selectedPowerups,
    setPowerups,
    isLoadingOdds,
    isSubmitting,
    lastOddsUpdate,
    refreshOdds,
    error,
    clearError,
  } = useAppStore();

  const toast = useToast();

  const formatTime = (d: Date | null) => {
    if (!d) return null;
    return new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const [selectedBetType, setSelectedBetType] = useState<BetType>('esito');

  const predictions = useMemo(() => currentSchedina?.predictions || [], [currentSchedina?.predictions]);
  const completedCount = predictions.length;
  const isComplete = completedCount === TOTAL_PREDICTIONS;

  const isDeadlinePassed = useMemo(() => {
    if (!currentMatchday?.deadline) return false;
    return new Date().getTime() >= new Date(currentMatchday.deadline).getTime();
  }, [currentMatchday?.deadline]);

  const isSubmitted = !!(currentSchedina?.isLocked || currentSchedina?.submittedAt);
  const canEdit = isSubmitted && !isDeadlinePassed;

  const scorePreview = useMemo(() => {
    if (predictions.length === 0) return null;
    const previewResults = predictions.map(p => ({
      ...p,
      isCorrect: true,
      pointsEarned: calculateBetPoints(p.odds, true),
    }));
    return calculateSchedinaScore(previewResults);
  }, [predictions]);

  const handleOutcomeSelect = (matchId: string, betType: BetType, outcome: BetOutcome) => {
    const mOdds = matchOdds[matchId];
    const typeOdds = mOdds?.[betType] as Record<string, number>;
    const odds = typeOdds?.[outcome] || 2.00;
    const prediction: Prediction = {
      matchId,
      betType,
      outcome,
      odds,
    };
    updatePrediction(matchId, prediction);
  };

  const handleSubmit = async () => {
    if (!isComplete) return;
    const isUpdate = !!currentSchedina?.submittedAt;
    await submitSchedina();
    if (!useAppStore.getState().error) {
      vibrate([50, 30, 80]);
      sideCannons();
      toast.success(isUpdate ? 'Schedina aggiornata con successo!' : 'Schedina inviata con successo!');
    } else {
      toast.error(useAppStore.getState().error || 'Errore nell\'invio della schedina');
    }
  };

  const handleEdit = () => {
    unlockSchedina();
    toast.info('Puoi modificare la schedina. Re-invia per confermare le modifiche.');
  };

  const handleReset = () => {
    unlockSchedina();
    resetSchedina();
    toast.info('Schedina azzerata. Ricompila e re-invia.');
  };

  const handleCancel = async () => {
    await cancelSchedina();
    if (!useAppStore.getState().error) {
      vibrate([40, 20, 40]);
      toast.success('Schedina annullata con successo. Gettoni power-up rimborsati.');
    } else {
      toast.error(useAppStore.getState().error || 'Errore nell\'annullamento della schedina');
    }
  };

  const handleQuickBet = (newPredictions: Prediction[]) => {
    newPredictions.forEach(pred => {
      updatePrediction(pred.matchId, pred);
    });
  };

  const totalPoints = useMemo(() => {
    if (predictions.length === 0) return 0;
    return predictions.reduce((sum, p) => sum + p.odds * 10, 0);
  }, [predictions]);

  const getPrediction = (matchId: string): Prediction | undefined =>
    predictions.find(p => p.matchId === matchId);

  const currentBetDef = BET_TYPES.find(b => b.key === selectedBetType)!

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

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-primary-400 text-sm font-medium">
                  <Trophy size={16} />
                  Stagione {currentMatchday.season}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={refreshOdds}
                    disabled={isLoadingOdds}
                    title={lastOddsUpdate ? `Aggiornato alle ${formatTime(lastOddsUpdate)}` : 'Aggiorna quote live'}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all',
                      isLoadingOdds
                        ? 'bg-accent-500/10 border-accent-500/20 text-accent-400/50 cursor-not-allowed'
                        : 'bg-accent-500/10 border-accent-500/20 text-accent-400 hover:bg-accent-500/20'
                    )}
                  >
                    <RefreshCw size={12} className={cn(isLoadingOdds && 'animate-spin')} />
                    {isLoadingOdds ? 'Aggiorno...' : lastOddsUpdate ? `Quote ${formatTime(lastOddsUpdate)}` : 'Quote LIVE'}
                  </button>
                  <QuickBet
                    matches={currentMatchday.matches}
                    odds={matchOdds}
                    onApply={handleQuickBet}
                    disabled={isSubmitted}
                  />
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold mb-3">
                Giornata {currentMatchday.number}
              </h1>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="glass-card px-4 py-2 inline-flex items-center gap-3">
                  <Clock size={16} className="text-primary-400" />
                  <CountdownTimer deadline={currentMatchday.deadline} />
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="glass-card p-4 mb-6 border-red-500/30 bg-red-500/5">
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-red-400" size={20} />
                  <p className="text-red-400">{error}</p>
                  <button onClick={clearError} className="ml-auto text-red-400 hover:text-red-300">
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* Schedina inviata - banner modifiche in alto */}
            {isSubmitted && canEdit && (
              <div className="glass-card p-4 mb-6 border-green-500/30 bg-green-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <Check size={18} className="text-green-400" />
                  <p className="text-green-400 font-bold text-sm">Schedina inviata! Puoi ancora modificarla o annullarla.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleEdit}
                    className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-primary-500/20 border border-primary-500/30 text-primary-300 text-xs font-bold hover:bg-primary-500/30 transition-all"
                  >
                    <Pencil size={14} />
                    Modifica
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-xs font-bold hover:bg-yellow-500/30 transition-all"
                  >
                    <RotateCcw size={14} />
                    Azzera
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-500/30 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3 h-3 border-2 border-red-300/30 border-t-red-300 rounded-full animate-spin" />
                        Annullamento...
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} />
                        Annulla Schedina
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-white/40 mt-2">
                  Disponibile fino a 2 ore dall'inizio della prima partita
                </p>
              </div>
            )}

            {/* Bet Type Selector */}
            <div className="glass-card p-2 mb-4">
              <div className="flex gap-1">
                {BET_TYPES.map((bt) => (
                  <button
                    key={bt.key}
                    onClick={() => setSelectedBetType(bt.key)}
                    className={cn(
                      'flex-1 flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg text-xs font-bold transition-all',
                      selectedBetType === bt.key
                        ? 'bg-primary-500 text-white'
                        : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <span className="font-black text-[11px]">{bt.shortLabel}</span>
                    <span className={cn(
                      'text-[8px] font-normal hidden sm:block truncate max-w-full px-0.5',
                      selectedBetType === bt.key ? 'text-white/70' : 'text-white/25'
                    )}>{bt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Matches List */}
            <div className="space-y-3 mb-8">
              {currentMatchday.matches.map((match, index) => {
                const prediction = getPrediction(match.id);
                const odds = matchOdds[match.id];

                return (
                  <div 
                    key={match.id}
                    className={cn(
                      'glass-card overflow-hidden transition-all duration-200',
                      prediction && 'ring-2 ring-primary-500'
                    )}
                  >
                    {/* Match Header */}
                    <div className="p-4">
                      <div className="flex items-center gap-4 mb-3">
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                          prediction ? 'bg-primary-500 text-white' : 'bg-white/5 text-white/50'
                        )}>
                          {index + 1}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                            <span className="font-semibold text-sm sm:text-base truncate flex items-center gap-1.5">
                              <TeamLogo src={match.homeTeam.logo} name={match.homeTeam.name} size={18} />
                              {match.homeTeam.shortName || match.homeTeam.name}
                            </span>
                            <span className="text-white/40 text-xs">vs</span>
                            <span className="font-semibold text-sm sm:text-base truncate flex items-center gap-1.5">
                              <TeamLogo src={match.awayTeam.logo} name={match.awayTeam.name} size={18} />
                              {match.awayTeam.shortName || match.awayTeam.name}
                            </span>
                          </div>
                          <p className="text-xs text-white/50 mt-0.5">
                            {formatDate(match.scheduledAt)}
                          </p>
                        </div>

                        {prediction && (
                          <div className="flex items-center gap-2">
                            <div className="px-3 py-1 rounded-lg font-bold text-sm bg-primary-500 text-white">
                              {prediction.outcome} @{prediction.odds.toFixed(2)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Odds Buttons */}
                      <div className={cn(
                        'grid gap-1.5',
                        currentBetDef.cols === 2 && 'grid-cols-2',
                        currentBetDef.cols === 3 && 'grid-cols-3',
                        currentBetDef.cols === 4 && 'grid-cols-4',
                      )}>
                        {currentBetDef.options.map((opt) => {
                          const typeOdds = odds?.[selectedBetType] as Record<string, number> | undefined;
                          const outcomeOdds = typeOdds?.[opt.value] ?? 2.00;
                          const isSelected = prediction?.outcome === opt.value && prediction?.betType === selectedBetType;
                          const isValid = isValidOdds(outcomeOdds);
                          const isPenalty = isInPenaltyRange(outcomeOdds);
                          const pts = Math.round(outcomeOdds * 10);

                          return (
                            <button
                              key={opt.value}
                              onClick={() => handleOutcomeSelect(match.id, selectedBetType, opt.value as BetOutcome)}
                              disabled={isSubmitted}
                              className={cn(
                                'relative flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all duration-200 group',
                                isSelected
                                  ? 'bg-primary-500 border-primary-400 shadow-lg shadow-primary-500/30'
                                  : 'bg-white/5 border-white/10 hover:border-primary-500/40 hover:bg-white/10',
                                isSubmitted && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              <span className={cn(
                                'text-[10px] font-bold mb-0.5 uppercase tracking-wide',
                                isSelected ? 'text-white/80' : 'text-white/50'
                              )}>
                                {opt.label}
                              </span>
                              <span className={cn(
                                'text-base font-mono font-black leading-tight',
                                isSelected ? 'text-white' : 'text-accent-400',
                                !isValid && !isSelected && 'text-red-400',
                                isPenalty && !isSelected && 'text-yellow-400'
                              )}>
                                {outcomeOdds.toFixed(2)}
                              </span>
                              <span className={cn(
                                'text-[9px] font-bold mt-0.5',
                                isSelected ? 'text-white/60' : 'text-white/25 group-hover:text-white/40'
                              )}>
                                {pts}pt
                              </span>
                              {isSelected && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                  <Check size={9} className="text-white" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar - 1 column */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-4 space-y-4">
              {/* Riepilogo Schedina */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Zap size={18} className="text-primary-400" />
                    Riepilogo Schedina
                  </h3>
                  {predictions.length > 0 && (
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Azzera schedina"
                    >
                      <RotateCcw size={14} />
                      Azzera
                    </button>
                  )}
                </div>
                
                {/* Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/60">Completamento</span>
                    <span className="text-sm font-bold text-primary-400">{completedCount}/{TOTAL_PREDICTIONS}</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-300"
                      style={{ width: `${(completedCount / TOTAL_PREDICTIONS) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Predictions List */}
                <div className="space-y-2 max-h-80 overflow-y-auto mb-4">
                  {predictions.length === 0 ? (
                    <p className="text-white/40 text-sm text-center py-4">
                      Seleziona le quote per compilare la schedina
                    </p>
                  ) : (
                    predictions.map((pred) => {
                      const match = currentMatchday.matches.find(m => m.id === pred.matchId);
                      return (
                        <div key={pred.matchId} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                          <span className="text-xs text-white/70 truncate flex-1">
                            {match?.homeTeam.shortName} - {match?.awayTeam.shortName}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary-400">{pred.outcome}</span>
                            <span className="text-xs font-mono text-accent-400">@{pred.odds.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Stats */}
                {predictions.length > 0 && (
                  <div className="border-t border-white/10 pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Punti totali (se esatti):</span>
                      <span className="font-bold text-accent-400">{Math.round(totalPoints)} pt</span>
                    </div>
                    {scorePreview && scorePreview.bonusPoints > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">Bonus ({scorePreview.details.correctPredictions}/10):</span>
                        <span className="font-bold text-green-400">+{scorePreview.bonusPoints} pt</span>
                      </div>
                    )}
                    {scorePreview && (
                      <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                        <span className="font-bold text-white">Totale potenziale:</span>
                        <span className="font-black gradient-text text-base">{Math.round(scorePreview.finalPoints)} pt</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Power-up */}
                {!isSubmitted && predictions.length > 0 && (
                  <PowerUpSelector
                    coins={currentUser?.coins ?? 0}
                    selection={selectedPowerups}
                    onChange={setPowerups}
                    matches={currentMatchday.matches}
                    predictions={predictions}
                    disabled={isSubmitting}
                  />
                )}

                {/* Submit Button */}
                {!isSubmitted && (
                  <button
                    onClick={handleSubmit}
                    disabled={!isComplete || isSubmitting}
                    className={cn(
                      'w-full mt-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all',
                      isComplete
                        ? 'bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-400 hover:to-accent-400 shadow-lg shadow-primary-500/25'
                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Invio...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        {currentSchedina?.submittedAt ? 'Aggiorna Schedina' : 'Invia Schedina'}
                      </>
                    )}
                  </button>
                )}

                {isSubmitted && (
                  <div className="mt-4 p-3 bg-green-500/20 rounded-lg text-center space-y-2">
                    <Check size={24} className="text-green-400 mx-auto mb-1" />
                    <p className="text-green-400 font-bold text-sm">Schedina Inviata!</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleEdit}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-primary-500/20 border border-primary-500/30 text-primary-300 text-xs font-bold hover:bg-primary-500/30 transition-all"
                      >
                        <Pencil size={14} />
                        Modifica
                      </button>
                      <button
                        onClick={handleReset}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-xs font-bold hover:bg-yellow-500/30 transition-all"
                      >
                        <RotateCcw size={14} />
                        Azzera
                      </button>
                    </div>
                    <button
                      onClick={handleCancel}
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-500/30 transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-3 h-3 border-2 border-red-300/30 border-t-red-300 rounded-full animate-spin" />
                          Annullamento...
                        </>
                      ) : (
                        <>
                          <Trash2 size={14} />
                          Annulla Schedina
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-white/40">
                      Puoi modificare, azzerare o annullare fino a 2 ore dall'inizio della prima partita
                    </p>
                    {currentSchedina.powerups &&
                      (currentSchedina.powerups.jolly ||
                        currentSchedina.powerups.shield ||
                        currentSchedina.powerups.insurance) && (
                        <p className="text-xs text-white/50 mt-1">
                          Power-up attivi:{' '}
                          {[
                            currentSchedina.powerups.jolly && '🃏 Jolly',
                            currentSchedina.powerups.shield && '🛡️ Scudo',
                            currentSchedina.powerups.insurance && '⭐ Assicurazione',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                  </div>
                )}
              </div>

              {/* Info Card */}
              <div className="glass-card p-4">
                <div className="flex items-start gap-3">
                  <Info className="text-primary-400 shrink-0 mt-0.5" size={18} />
                  <div className="text-xs text-white/60">
                    <p className="mb-2 font-bold text-white text-sm">Formula Punteggio</p>
                    <ul className="space-y-1">
                      <li>• <span className="text-primary-400 font-bold">Punti = Quota × 10</span></li>
                      <li>• Es: quota 2.20 → 22 pt</li>
                      <li>• Quote &lt;1.25: 5 pt fissi</li>
                      <li>• Quote &lt;1.30: non valide</li>
                      <li>• 9/10 esatti: +20 pt bonus</li>
                      <li>• 10/10 esatti: +50 pt bonus</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
