// ============================================
// FANTA SCHEDINA - SISTEMA DI CALCOLO PUNTEGGIO
// Implementazione completa del regolamento
// ============================================

import type { 
  Prediction, 
  PredictionResult, 
  Schedina, 
  SchedinaResult,
  ScoreCalculation,
  TournamentConfig,
  Match
} from '@/types';

// Configurazione di default del torneo basata sul regolamento
export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  season: '2025-2026',
  participationFee: 20,
  weeklyFee: 10,
  weeklyFeeToPool: 5,
  weeklyFeeToOrganizer: 5,
  minValidOdds: 1.30,
  maxPointsPerBet: 3.5,
  lowOddsThreshold: 1.25,
  lowOddsMaxPoints: 0.5,
  penaltyOddsMin: 1.25,
  penaltyOddsMax: 1.29,
  penaltyPerThree: -1.5,
  bonus9Correct: 2,
  bonus10Correct: 5,
  maxJoinMatchday: 10,
  lateJoinFeePerMatchday: 5,
  minParticipantsForGuarantee: 30,
  guaranteedPrize: 500,
  firstPlacePrize: 300,
  firstHalfPrize: 200,
  highestOddsPrize: 10,
  pokerPrize: 20,
  minOddsForPoker: 2.00,
  minOddsForHighestOddsPrize: 2.00,
  weeklyWinnerShare: 0.40,
  weeklyAllShare: 0.40,
  weeklyToFinalShare: 0.20,
};

/**
 * Calcola i punti per una singola scommessa vinta
 * - Se quota < 1.25: vale solo 0.5 punti
 * - Se quota >= 1.25 e < 1.30: vale il valore della quota (ma attenzione alle penalità)
 * - Se quota >= 1.30: vale il valore della quota (max 3.5)
 */
export function calculateBetPoints(
  odds: number, 
  isCorrect: boolean,
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): number {
  if (!isCorrect) return 0;

  // Quote inferiori a 1.25: vale solo 0.5 punti
  if (odds < config.lowOddsThreshold) {
    return config.lowOddsMaxPoints;
  }

  // Punti = quota, con massimo 3.5
  return Math.min(odds, config.maxPointsPerBet);
}

/**
 * Verifica se una quota è valida per il gioco
 * Quota minima valida: 1.30
 */
export function isValidOdds(
  odds: number, 
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): boolean {
  return odds >= config.minValidOdds;
}

/**
 * Verifica se una quota è nella fascia di penalità (1.25 - 1.29)
 */
export function isInPenaltyRange(
  odds: number,
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): boolean {
  return odds >= config.penaltyOddsMin && odds < config.minValidOdds;
}

/**
 * Conta quante scommesse sono nella fascia di penalità
 */
export function countPenaltyRangeBets(
  predictions: Prediction[],
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): number {
  return predictions.filter(p => isInPenaltyRange(p.odds, config)).length;
}

/**
 * Calcola i punti di penalità per le quote nella fascia 1.25-1.29
 * Ogni 3 giocate di questo tipo = -1.5 punti
 */
export function calculatePenaltyPoints(
  penaltyRangeBetsCount: number,
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): number {
  const penaltySets = Math.floor(penaltyRangeBetsCount / 3);
  return penaltySets * config.penaltyPerThree;
}

/**
 * Calcola i bonus per esiti corretti
 * - 9 esiti corretti su 10: +2 punti extra
 * - 10 esiti corretti su 10: +5 punti extra
 */
export function calculateBonusPoints(
  correctPredictions: number,
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): number {
  if (correctPredictions === 10) {
    return config.bonus10Correct;
  }
  if (correctPredictions === 9) {
    return config.bonus9Correct;
  }
  return 0;
}

/**
 * Calcola il punteggio completo di una schedina
 */
export function calculateSchedinaScore(
  predictions: PredictionResult[],
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): ScoreCalculation {
  // Conta pronostici corretti
  const correctPredictions = predictions.filter(p => p.isCorrect).length;
  
  // Calcola punti base (somma delle quote vinte, con cap e regole speciali)
  const basePoints = predictions.reduce((sum, pred) => {
    return sum + calculateBetPoints(pred.odds, pred.isCorrect, config);
  }, 0);

  // Conta quote nella fascia penalità
  const penaltyRangeBets = countPenaltyRangeBets(predictions, config);
  
  // Conta quote sotto soglia minima
  const lowOddsBets = predictions.filter(p => p.odds < config.lowOddsThreshold).length;
  
  // Conta quote cappate a 3.5
  const cappedBets = predictions.filter(p => p.odds > config.maxPointsPerBet).length;

  // Calcola bonus
  const bonusPoints = calculateBonusPoints(correctPredictions, config);
  
  // Calcola penalità
  const penaltyPoints = calculatePenaltyPoints(penaltyRangeBets, config);

  // Punteggio finale
  const finalPoints = basePoints + bonusPoints + penaltyPoints;

  return {
    basePoints: Math.round(basePoints * 100) / 100,
    bonusPoints,
    penaltyPoints,
    finalPoints: Math.round(finalPoints * 100) / 100,
    details: {
      correctPredictions,
      lowOddsBets,
      penaltyRangeBets,
      cappedBets,
    },
  };
}

/**
 * Valuta i risultati di una schedina confrontandola con i risultati delle partite
 */
export function evaluateSchedina(
  schedina: Schedina,
  matches: Match[],
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): SchedinaResult {
  const predictionResults: PredictionResult[] = schedina.predictions.map(pred => {
    const match = matches.find(m => m.id === pred.matchId);
    const isCorrect = match?.result?.outcome === pred.outcome;
    const pointsEarned = calculateBetPoints(pred.odds, isCorrect, config);
    
    return {
      ...pred,
      isCorrect,
      pointsEarned,
    };
  });

  const scoreCalc = calculateSchedinaScore(predictionResults, config);

  return {
    id: schedina.id,
    participantId: schedina.participantId,
    matchday: schedina.matchday,
    predictions: predictionResults,
    submittedAt: schedina.submittedAt,
    isLocked: true,
    totalPoints: scoreCalc.basePoints,
    correctPredictions: scoreCalc.details.correctPredictions,
    bonusPoints: scoreCalc.bonusPoints,
    penaltyPoints: scoreCalc.penaltyPoints,
    finalPoints: scoreCalc.finalPoints,
  };
}

/**
 * Calcola la quota di ingresso per chi entra in corso
 * - Quota base: 20€
 * - +5€ per ogni giornata già passata
 */
export function calculateLateEntryFee(
  currentMatchday: number,
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): { totalFee: number; baseFee: number; additionalFee: number; toPool: number } {
  if (currentMatchday > config.maxJoinMatchday) {
    throw new Error(`Non è possibile iscriversi dopo la giornata ${config.maxJoinMatchday}`);
  }

  const baseFee = config.participationFee;
  const additionalFee = (currentMatchday - 1) * config.lateJoinFeePerMatchday;
  
  return {
    totalFee: baseFee + additionalFee,
    baseFee,
    additionalFee,
    toPool: baseFee + additionalFee, // Tutto va al montepremi
  };
}

/**
 * Calcola la distribuzione della vincita settimanale
 * - 40% al vincitore della schedina
 * - 40% diviso tra tutti i partecipanti
 * - 20% al montepremi finale
 */
export function calculateWeeklyPrizeDistribution(
  weeklyPool: number,
  participantCount: number,
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): { toWinner: number; toEach: number; toFinal: number } {
  const toWinner = weeklyPool * config.weeklyWinnerShare;
  const toAllPool = weeklyPool * config.weeklyAllShare;
  const toEach = toAllPool / participantCount;
  const toFinal = weeklyPool * config.weeklyToFinalShare;

  return {
    toWinner: Math.round(toWinner * 100) / 100,
    toEach: Math.round(toEach * 100) / 100,
    toFinal: Math.round(toFinal * 100) / 100,
  };
}

/**
 * Verifica se un partecipante ha diritto al premio "Quota Poker"
 * Servono 4 quote vincenti superiori a 2.00
 */
export function checkPokerPrize(
  predictions: PredictionResult[],
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): { eligible: boolean; qualifyingBets: PredictionResult[]; totalOdds: number } {
  const qualifyingBets = predictions.filter(
    p => p.isCorrect && p.odds > config.minOddsForPoker
  );

  return {
    eligible: qualifyingBets.length >= 4,
    qualifyingBets,
    totalOdds: qualifyingBets.reduce((sum, p) => sum + p.odds, 0),
  };
}

/**
 * Trova la quota vincente più alta della giornata
 * Deve essere superiore a 2.00 per vincere il premio
 */
export function findHighestWinningOdds(
  allSchedinaResults: SchedinaResult[],
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): { winnerId: string | null; highestOdds: number; prediction: PredictionResult | null } {
  let highestOdds = 0;
  let winnerId: string | null = null;
  let winningPrediction: PredictionResult | null = null;

  for (const schedina of allSchedinaResults) {
    for (const pred of schedina.predictions) {
      if (pred.isCorrect && pred.odds > highestOdds) {
        highestOdds = pred.odds;
        winnerId = schedina.participantId;
        winningPrediction = pred;
      }
    }
  }

  // Il premio viene assegnato solo se la quota è >= 2.00
  if (highestOdds < config.minOddsForHighestOddsPrize) {
    return { winnerId: null, highestOdds: 0, prediction: null };
  }

  return { winnerId, highestOdds, prediction: winningPrediction };
}
