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
import { currentFootballSeason } from './season';

// Configurazione di default del torneo basata sul regolamento
export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  season: currentFootballSeason(),
  participationFee: 20,
  weeklyFee: 10,
  weeklyFeeToPool: 5,
  weeklyFeeToOrganizer: 5,
  minValidOdds: 1.30,
  maxPointsPerBet: 50,      // quota 5.00 × 10 = 50 pt max
  lowOddsThreshold: 1.25,
  lowOddsMaxPoints: 5,       // 0.5 × 10 = 5 pt (quota < 1.25)
  penaltyOddsMin: 1.25,
  penaltyOddsMax: 1.29,
  penaltyPerThree: -15,      // -1.5 × 10 scaled
  bonus9Correct: 20,         // 2 × 10 scaled
  bonus10Correct: 50,        // 5 × 10 scaled
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
 * Formula ufficiale: Punti = Quota × 10
 * - Se quota < 1.25: vale solo 5 punti (0.5 × 10)
 * - Se quota >= 1.25: Quota × 10 (max 50 pt = quota 5.00)
 */
export function calculateBetPoints(
  odds: number,
  isCorrect: boolean,
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): number {
  if (!isCorrect) return 0;

  // Quote inferiori a 1.25: vale solo 5 punti
  if (odds < config.lowOddsThreshold) {
    return config.lowOddsMaxPoints;
  }

  // Punti = Quota × 10, con massimo 50
  return Math.min(odds * 10, config.maxPointsPerBet);
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
  
  // Calcola punti base: somma dei punti già valutati (incluso rimborso void)
  const basePoints = predictions.reduce((sum, pred) => sum + pred.pointsEarned, 0);

  // Conta quote nella fascia penalità
  const penaltyRangeBets = countPenaltyRangeBets(predictions, config);
  
  // Conta quote sotto soglia minima
  const lowOddsBets = predictions.filter(p => p.odds < config.lowOddsThreshold).length;
  
  // Conta giocate cappate al massimo (quota × 10 > maxPointsPerBet)
  const cappedBets = predictions.filter(p => p.odds * 10 > config.maxPointsPerBet).length;

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
 * Valuta un singolo pronostico multi-mercato contro il risultato della partita.
 * Ritorna null se il mercato non è valutabile (es. 1° tempo senza dato HT).
 * Allineata a functions/src/scoring.ts (fonte di verità per il settlement).
 */
export function evaluateBet(
  betType: string,
  outcome: string,
  result: NonNullable<Match['result']>
): boolean | null {
  const total = result.homeGoals + result.awayGoals;
  const outcomeOf = (h: number, a: number) => (h > a ? '1' : a > h ? '2' : 'X');
  switch (betType) {
    case 'esito':
      return outcome === result.outcome;
    case 'over_under':
      return outcome === 'OVER' ? total >= 3 : total <= 2;
    case 'goal_nogoal': {
      const gg = result.homeGoals > 0 && result.awayGoals > 0;
      return outcome === 'GG' ? gg : !gg;
    }
    case 'doppia_chance':
      return outcome.includes(result.outcome);
    case 'multigoal': {
      const line = parseFloat(outcome.slice(1));
      if (Number.isNaN(line)) return null;
      return outcome.startsWith('O') ? total > line : total < line;
    }
    case 'esito_1t': {
      if (result.htHomeGoals == null || result.htAwayGoals == null) return null;
      return outcome === outcomeOf(result.htHomeGoals, result.htAwayGoals);
    }
    case 'over_under_1t': {
      if (result.htHomeGoals == null || result.htAwayGoals == null) return null;
      const ht = result.htHomeGoals + result.htAwayGoals;
      return outcome === 'OVER' ? ht >= 2 : ht <= 1; // linea 1.5
    }
    case 'goal_nogoal_1t': {
      if (result.htHomeGoals == null || result.htAwayGoals == null) return null;
      const gg = result.htHomeGoals > 0 && result.htAwayGoals > 0;
      return outcome === 'GG' ? gg : !gg;
    }
    default:
      return null;
  }
}

/**
 * Valuta i risultati di una schedina confrontandola con i risultati delle partite.
 * Mercati non valutabili (void) = quota 1.00 → 10 punti, contano come corretti.
 */
export function evaluateSchedina(
  schedina: Schedina,
  matches: Match[],
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): SchedinaResult {
  const predictionResults: PredictionResult[] = schedina.predictions.map(pred => {
    const match = matches.find(m => m.id === pred.matchId);
    if (!match?.result) {
      return { ...pred, isCorrect: false, pointsEarned: 0 };
    }
    const evalResult = evaluateBet(pred.betType, pred.outcome, match.result);
    if (evalResult === null) {
      // Void: rimborso a quota 1.00
      return { ...pred, isCorrect: true, pointsEarned: 10 };
    }
    const pointsEarned = calculateBetPoints(pred.odds, evalResult, config);
    
    return {
      ...pred,
      isCorrect: evalResult,
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
