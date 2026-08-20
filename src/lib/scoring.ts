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
  oddsCap: 5.00,             // tetto ai punti di una singola giocata indovinata
  penaltyOddsMin: 1.25,
  penaltyMultiplierPerThree: 0.9, // ogni 3 giocate in fascia 1.25-1.29
  bonus9Multiplier: 1.2,
  bonus10Multiplier: 1.5,
  maxJoinMatchday: 10,
  lateJoinFeePerMatchday: 5,
  minParticipantsForGuarantee: 30,
  guaranteedPrize: 500,
  firstPlacePrize: 300,
  firstHalfPrize: 200,
  weeklyWinnerShare: 0.40,
  weeklyAllShare: 0.40,
  weeklyToFinalShare: 0.20,
};

/**
 * Punti di una singola giocata: la propria quota se indovinata (cappata a
 * oddsCap), zero se sbagliata. I punti della schedina sono la SOMMA di questi
 * contributi.
 */
export function calculateBetPoints(
  odds: number,
  isCorrect: boolean,
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): number {
  if (!isCorrect) return 0;
  return Math.min(odds, config.oddsCap);
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
 * Moltiplicatore di penalità per le giocate con quota nella fascia 1.25-1.29
 * (indipendentemente dall'esito): ogni 3 giocate di questo tipo → ×0.9,
 * si compone (6 giocate → ×0.81, ecc).
 */
export function calculatePenaltyPoints(
  penaltyRangeBetsCount: number,
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): number {
  const penaltySets = Math.floor(penaltyRangeBetsCount / 3);
  return Math.pow(config.penaltyMultiplierPerThree, penaltySets);
}

/**
 * Moltiplicatore bonus per esiti corretti.
 * - 9 esiti corretti su 10: ×1.2
 * - 10 esiti corretti su 10: ×1.5
 */
export function calculateBonusPoints(
  correctPredictions: number,
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): number {
  if (correctPredictions >= 10) {
    return config.bonus10Multiplier;
  }
  if (correctPredictions === 9) {
    return config.bonus9Multiplier;
  }
  return 1;
}

/**
 * Calcola il punteggio completo di una schedina.
 * I punti base sono la SOMMA delle quote (cappate) delle giocate corrette.
 * Bonus e penalità restano espressi come impatto assoluto in punti (non
 * moltiplicatori grezzi), così `finalPoints` resta sempre
 * `basePoints + bonusPoints + penaltyPoints` e i totali cumulativi di profilo
 * (bonusPointsTotal/penaltyPointsTotal) restano sommabili nel tempo.
 */
export function calculateSchedinaScore(
  predictions: PredictionResult[],
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG
): ScoreCalculation {
  const correctPredictions = predictions.filter(p => p.isCorrect).length;

  // Punti della schedina: somma delle quote indovinate (vedi
  // functions/src/scoring.ts, che è la fonte di verità del calcolo).
  const puntiBase = predictions.reduce(
    (somma, pred) => (pred.isCorrect ? somma + pred.pointsEarned : somma),
    0
  );

  // Conta quote nella fascia penalità (composizione della schedina, a prescindere dall'esito)
  const penaltyRangeBets = countPenaltyRangeBets(predictions, config);

  // Conta giocate cappate (quota oltre il tetto oddsCap)
  const cappedBets = predictions.filter(p => p.odds > config.oddsCap).length;

  const bonusMultiplier = calculateBonusPoints(correctPredictions, config);
  const penaltyMultiplier = calculatePenaltyPoints(penaltyRangeBets, config);

  // Arrotonda ogni passaggio in modo progressivo (non i 4 valori indipendentemente
  // dai loro grezzi non arrotondati): altrimenti basePoints+bonusPoints+penaltyPoints
  // può divergere di qualche centesimo da finalPoints per arrotondamenti scorrelati.
  const basePoints = Math.round(puntiBase * 100) / 100;
  const afterBonus = Math.round(basePoints * bonusMultiplier * 100) / 100;
  const bonusPoints = Math.round((afterBonus - basePoints) * 100) / 100;
  const afterPenalty = Math.round(afterBonus * penaltyMultiplier * 100) / 100;
  const penaltyPoints = Math.round((afterPenalty - afterBonus) * 100) / 100;

  return {
    basePoints,
    bonusPoints,
    penaltyPoints,
    finalPoints: afterPenalty,
    details: {
      correctPredictions,
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
      // Void: contributo neutro. Nella somma il neutro è 0, non 1.
      return { ...pred, isCorrect: true, pointsEarned: 0 };
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

