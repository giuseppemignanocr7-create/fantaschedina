import { useState, useMemo } from 'react';
import { 
  Check, 
  AlertCircle, 
  Send, 
  Info,
  Trophy,
  Zap,
  Clock,
  RotateCcw
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useAppStore } from '@/store';
import { MOCK_ODDS } from '@/data/mockData';
import type { BetType, BetOutcome, Prediction } from '@/types';
import { isValidOdds, isInPenaltyRange, calculateSchedinaScore } from '@/lib/scoring';
import { CountdownTimer, QuickBet } from '@/components/ui';

const TOTAL_PREDICTIONS = 15;

const BET_TYPES: { key: BetType; label: string; options: { value: string; label: string }[] }[] = [
  { key: 'esito', label: 'Esito Finale', options: [{ value: '1', label: '1' }, { value: 'X', label: 'X' }, { value: '2', label: '2' }] },
  { key: 'over_under', label: 'Over/Under 2.5', options: [{ value: 'OVER', label: 'Over' }, { value: 'UNDER', label: 'Under' }] },
  { key: 'goal_nogoal', label: 'Goal/NoGoal', options: [{ value: 'GG', label: 'GG' }, { value: 'NG', label: 'NG' }] },
  { key: 'doppia_chance', label: 'Doppia Chance', options: [{ value: '1X', label: '1X' }, { value: '12', label: '12' }, { value: 'X2', label: 'X2' }] },
];

export function SchedinaPage() {
  const { 
    currentMatchday, 
    currentSchedina, 
    updatePrediction,
    submitSchedina,
    resetSchedina,
    error,
    clearError
  } = useAppStore();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedBetType, setSelectedBetType] = useState<BetType>('esito');

  const predictions = currentSchedina?.predictions || [];
  const completedCount = predictions.length;
  const isComplete = completedCount === TOTAL_PREDICTIONS;

  const scorePreview = useMemo(() => {
    if (predictions.length === 0) return null;
    
    const mockResults = predictions.map(p => ({
      ...p,
      isCorrect: true,
      pointsEarned: p.odds,
    }));
    
    return calculateSchedinaScore(mockResults);
  }, [predictions]);

  const handleOutcomeSelect = (matchId: string, betType: BetType, outcome: BetOutcome) => {
    const matchOdds = MOCK_ODDS[matchId];
    const typeOdds = matchOdds?.[betType] as Record<string, number>;
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
    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    submitSchedina();
    setIsSubmitting(false);
  };

  const handleQuickBet = (newPredictions: Prediction[]) => {
    newPredictions.forEach(pred => {
      updatePrediction(pred.matchId, pred);
    });
  };

  // Calcola quota combinata totale
  const combinedOdds = useMemo(() => {
    if (predictions.length === 0) return 0;
    return predictions.reduce((acc, p) => acc * p.odds, 1);
  }, [predictions]);

  const getPrediction = (matchId: string): Prediction | undefined => {
    return predictions.find(p => p.matchId === matchId);
  };

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
                  Stagione 2025-2026
                </div>
                <QuickBet 
                  matches={currentMatchday.matches}
                  odds={MOCK_ODDS}
                  onApply={handleQuickBet}
                  disabled={currentSchedina?.isLocked}
                />
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

            {/* Bet Type Selector */}
            <div className="glass-card p-3 mb-6">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {BET_TYPES.map((bt) => (
                  <button
                    key={bt.key}
                    onClick={() => setSelectedBetType(bt.key)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                      selectedBetType === bt.key
                        ? 'bg-primary-500 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    {bt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Matches List */}
            <div className="space-y-3 mb-8">
              {currentMatchday.matches.map((match, index) => {
                const prediction = getPrediction(match.id);
                const odds = MOCK_ODDS[match.id];

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
                            <span className="font-semibold text-sm sm:text-base truncate">{match.homeTeam.shortName || match.homeTeam.name}</span>
                            <span className="text-white/40 text-xs">vs</span>
                            <span className="font-semibold text-sm sm:text-base truncate">{match.awayTeam.shortName || match.awayTeam.name}</span>
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

                      {/* Odds Buttons - Always visible */}
                      <div className={cn(
                        'grid gap-2',
                        BET_TYPES.find(b => b.key === selectedBetType)?.options.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                      )}>
                        {BET_TYPES.find(b => b.key === selectedBetType)?.options.map((opt) => {
                          const typeOdds = odds?.[selectedBetType] as Record<string, number> | undefined;
                          const outcomeOdds = typeOdds?.[opt.value] || 2.00;
                          const isSelected = prediction?.outcome === opt.value && prediction?.betType === selectedBetType;
                          const isValid = isValidOdds(outcomeOdds);
                          const isPenalty = isInPenaltyRange(outcomeOdds);

                          return (
                            <button
                              key={opt.value}
                              onClick={() => handleOutcomeSelect(match.id, selectedBetType, opt.value as BetOutcome)}
                              disabled={currentSchedina?.isLocked}
                              className={cn(
                                'relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200',
                                isSelected 
                                  ? 'bg-primary-500 border-primary-400 text-white shadow-lg shadow-primary-500/30' 
                                  : 'bg-white/5 border-white/10 hover:border-primary-500/50 hover:bg-white/10',
                                currentSchedina?.isLocked && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              <span className={cn(
                                'text-sm font-bold mb-0.5',
                                isSelected ? 'text-white' : 'text-slate-300'
                              )}>
                                {opt.label}
                              </span>
                              <span className={cn(
                                'text-lg font-mono font-bold',
                                isSelected ? 'text-white' : 'text-accent-400',
                                !isValid && !isSelected && 'text-red-400',
                                isPenalty && !isSelected && 'text-yellow-400'
                              )}>
                                {outcomeOdds.toFixed(2)}
                              </span>
                              
                              {isSelected && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                  <Check size={12} className="text-white" />
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
                  {predictions.length > 0 && !currentSchedina?.isLocked && (
                    <button
                      onClick={resetSchedina}
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
                  <div className="border-t border-white/10 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Quota combinata:</span>
                      <span className="font-bold text-accent-400">x{combinedOdds.toFixed(2)}</span>
                    </div>
                    {scorePreview && (
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">Punti potenziali:</span>
                        <span className="font-bold gradient-text">{scorePreview.finalPoints.toFixed(2)} pt</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Submit Button */}
                {!currentSchedina?.isLocked && (
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
                        Invia Schedina
                      </>
                    )}
                  </button>
                )}

                {currentSchedina?.isLocked && (
                  <div className="mt-4 p-3 bg-green-500/20 rounded-lg text-center">
                    <Check size={24} className="text-green-400 mx-auto mb-1" />
                    <p className="text-green-400 font-bold text-sm">Schedina Inviata!</p>
                  </div>
                )}
              </div>

              {/* Info Card */}
              <div className="glass-card p-4">
                <div className="flex items-start gap-3">
                  <Info className="text-primary-400 shrink-0 mt-0.5" size={18} />
                  <div className="text-xs text-white/60">
                    <p className="mb-2 font-bold text-white text-sm">Regole punteggio</p>
                    <ul className="space-y-1">
                      <li>• Punti = quota (max 3.5)</li>
                      <li>• Quote &lt;1.25: 0.5 pt</li>
                      <li>• 13/15: +2 pt bonus</li>
                      <li>• 15/15: +5 pt bonus</li>
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
