import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Check, 
  AlertCircle, 
  Send, 
  Info,
  ChevronDown,
  Trophy,
  Zap,
  Clock,
  Sparkles
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useAppStore } from '@/store';
import { MOCK_ODDS } from '@/data/mockData';
import type { BetType, BetOutcome, Prediction } from '@/types';
import { isValidOdds, isInPenaltyRange, calculateSchedinaScore } from '@/lib/scoring';
import { CountdownTimer, QuickBet, CommunityStats } from '@/components/ui';

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
    currentUser, 
    isAuthenticated,
    updatePrediction,
    submitSchedina,
    error,
    clearError
  } = useAppStore();

  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-primary-400 text-sm font-medium">
              <Trophy size={16} />
              Stagione 2025-2026
            </div>
            {isAuthenticated && (
              <QuickBet 
                matches={currentMatchday.matches}
                odds={MOCK_ODDS}
                onApply={handleQuickBet}
                disabled={currentSchedina?.isLocked}
              />
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold mb-3">
            Giornata {currentMatchday.number}
          </h1>
          
          {/* Countdown + Stats Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <div className="glass-card px-4 py-2 inline-flex items-center gap-3">
              <Clock size={16} className="text-primary-400" />
              <CountdownTimer deadline={currentMatchday.deadline} />
            </div>
            
            {combinedOdds > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Sparkles size={14} className="text-accent-400" />
                <span className="text-white/60">Quota combinata:</span>
                <span className="font-bold text-accent-400">x {combinedOdds.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Auth Warning */}
        {!isAuthenticated && (
          <div className="glass-card p-4 mb-6 border-yellow-500/30 bg-yellow-500/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-yellow-400 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-medium text-yellow-400">Accedi per giocare</h4>
                <p className="text-sm text-white/60 mt-1">
                  Devi effettuare l'accesso per compilare e inviare la tua schedina.
                </p>
                <Link to="/login" className="btn-primary text-sm mt-3 inline-block py-2 px-4">
                  Accedi ora
                </Link>
              </div>
            </div>
          </div>
        )}

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

        {/* Progress Bar */}
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Pronostici completati</span>
            <span className="text-sm text-primary-400 font-bold">{completedCount}/{TOTAL_PREDICTIONS}</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-300"
              style={{ width: `${(completedCount / TOTAL_PREDICTIONS) * 100}%` }}
            />
          </div>
          {scorePreview && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-sm">
              <span className="text-white/60">Punti potenziali (se tutti vincenti):</span>
              <span className="font-bold gradient-text">{scorePreview.finalPoints.toFixed(2)} pt</span>
            </div>
          )}
        </div>

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
            const isExpanded = expandedMatch === match.id;

            return (
              <div 
                key={match.id}
                className={cn(
                  'glass-card overflow-hidden transition-all duration-200',
                  prediction && 'ring-1 ring-primary-500/50'
                )}
              >
                {/* Match Header */}
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm font-bold text-white/50">
                      {index + 1}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                        <span className="font-semibold text-sm sm:text-base truncate">{match.homeTeam.shortName || match.homeTeam.name}</span>
                        <span className="text-white/40 hidden sm:inline">vs</span>
                        <span className="text-white/40 text-xs sm:hidden">vs</span>
                        <span className="font-semibold text-sm sm:text-base truncate">{match.awayTeam.shortName || match.awayTeam.name}</span>
                      </div>
                      <p className="text-xs text-white/50 mt-0.5">
                        {formatDate(match.scheduledAt)}
                      </p>
                    </div>

                    {prediction && (
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'px-3 py-1 rounded-lg font-bold text-sm',
                          'bg-primary-500/20 text-primary-400'
                        )}>
                          {prediction.outcome}
                        </div>
                        <div className={cn(
                          'px-2 py-1 rounded text-xs font-medium',
                          !isValidOdds(prediction.odds) ? 'bg-red-500/20 text-red-400' :
                          isInPenaltyRange(prediction.odds) ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-white/10 text-white/70'
                        )}>
                          @{prediction.odds.toFixed(2)}
                        </div>
                      </div>
                    )}

                    <ChevronDown 
                      size={20} 
                      className={cn(
                        'text-white/40 transition-transform',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  </div>
                </div>

                {/* Expanded Section */}
                <div className={cn(
                  'overflow-hidden transition-all duration-300',
                  isExpanded ? 'max-h-96' : 'max-h-0'
                )}>
                  <div className="px-4 pb-4 pt-2 border-t border-white/5">
                    <p className="text-xs text-white/50 mb-3">
                      {BET_TYPES.find(b => b.key === selectedBetType)?.label} - Seleziona:
                    </p>
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOutcomeSelect(match.id, selectedBetType, opt.value as BetOutcome);
                            }}
                            disabled={!isAuthenticated || currentSchedina?.isLocked}
                            className={cn(
                              'btn-odds group',
                              isSelected && 'selected',
                              (!isAuthenticated || currentSchedina?.isLocked) && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <span className={cn(
                              'text-sm font-bold mb-0.5 transition-colors',
                              isSelected ? 'text-primary-400' : 'text-slate-300 group-hover:text-white'
                            )}>
                              {opt.label}
                            </span>
                            <span className={cn(
                              'text-lg font-mono font-bold tracking-tight',
                              isSelected ? 'text-white' : 'text-accent-400',
                              !isValid && 'text-red-400',
                              isPenalty && 'text-yellow-400'
                            )}>
                              {outcomeOdds.toFixed(2)}
                            </span>
                            
                            {!isValid && (
                              <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" title="Quota troppo bassa" />
                            )}
                            {isPenalty && (
                              <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-yellow-500" title="Penalità" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Card */}
        <div className="glass-card p-4 mb-6">
          <div className="flex items-start gap-3">
            <Info className="text-primary-400 shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-white/60">
              <p className="mb-2"><strong className="text-white">Regole punteggio:</strong></p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Punti = quota presa (max 3.5 pt)</li>
                <li>Quote &lt; 1.25: solo 0.5 pt</li>
                <li>Quote 1.25-1.29: ogni 3 = -1.5 pt penalità</li>
                <li>13/15 corretti = +2 pt bonus</li>
                <li>14/15 corretti = +3 pt bonus</li>
                <li>15/15 corretti = +5 pt bonus</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        {isAuthenticated && !currentSchedina?.isLocked && (
          <div className="sticky bottom-4 px-2 sm:px-0">
            <button
              onClick={handleSubmit}
              disabled={!isComplete || isSubmitting}
              className={cn(
                'w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all',
                isComplete
                  ? 'bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-400 hover:to-accent-400 shadow-lg shadow-primary-500/25'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Invio in corso...
                </>
              ) : currentSchedina?.isLocked ? (
                <>
                  <Check size={20} />
                  Schedina Inviata
                </>
              ) : (
                <>
                  <Send size={20} />
                  Invia Schedina ({completedCount}/{TOTAL_PREDICTIONS})
                </>
              )}
            </button>
          </div>
        )}

        {/* Locked State */}
        {currentSchedina?.isLocked && (
          <div className="glass-card p-6 text-center border-green-500/30 bg-green-500/5">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-green-400 mb-2">Schedina Inviata!</h3>
            <p className="text-white/60 text-sm">
              La tua schedina è stata registrata. Sarà visibile a tutti dopo la deadline.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-white/50">
              <Zap size={14} />
              <span>Punti potenziali: {scorePreview?.finalPoints.toFixed(2)} pt</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
