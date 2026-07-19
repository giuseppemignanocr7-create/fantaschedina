// ============================================
// FANTASCHEDINA FUNCTIONS - SCORING
// Valutazione multi-mercato (1X2, O/U, GG/NG, DC, multigoal, 1° tempo)
// + calcolo punteggio schedina + power-up.
// ============================================

import { TOURNAMENT, PowerUpSelection } from './config';

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  outcome: '1' | 'X' | '2';
  htHomeGoals?: number;
  htAwayGoals?: number;
}

export interface Prediction {
  matchId: string;
  betType: string;
  outcome: string;
  odds: number;
}

export interface PredictionResult extends Prediction {
  isCorrect: boolean;
  isVoid: boolean;
  pointsEarned: number;
}

export interface SchedinaScore {
  totalPoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  finalPoints: number;
  correctPredictions: number;
  predictionResults: PredictionResult[];
}

function outcomeOf(h: number, a: number): '1' | 'X' | '2' {
  return h > a ? '1' : a > h ? '2' : 'X';
}

/**
 * Valuta un pronostico contro il risultato.
 * Ritorna true/false, oppure null se il mercato non è valutabile
 * (es. mercati 1° tempo senza dato HT disponibile → void).
 */
export function evaluateBet(
  betType: string,
  outcome: string,
  r: MatchResult
): boolean | null {
  const total = r.homeGoals + r.awayGoals;
  switch (betType) {
    case 'esito':
      return outcome === r.outcome;
    case 'over_under':
      return outcome === 'OVER' ? total >= 3 : total <= 2;
    case 'goal_nogoal': {
      const gg = r.homeGoals > 0 && r.awayGoals > 0;
      return outcome === 'GG' ? gg : !gg;
    }
    case 'doppia_chance':
      return outcome.includes(r.outcome);
    case 'multigoal': {
      const line = parseFloat(outcome.slice(1));
      if (Number.isNaN(line)) return null;
      return outcome.startsWith('O') ? total > line : total < line;
    }
    case 'esito_1t': {
      if (r.htHomeGoals == null || r.htAwayGoals == null) return null;
      return outcome === outcomeOf(r.htHomeGoals, r.htAwayGoals);
    }
    case 'over_under_1t': {
      if (r.htHomeGoals == null || r.htAwayGoals == null) return null;
      const ht = r.htHomeGoals + r.htAwayGoals;
      return outcome === 'OVER' ? ht >= 2 : ht <= 1; // linea 1.5
    }
    case 'goal_nogoal_1t': {
      if (r.htHomeGoals == null || r.htAwayGoals == null) return null;
      const gg = r.htHomeGoals > 0 && r.htAwayGoals > 0;
      return outcome === 'GG' ? gg : !gg;
    }
    default:
      return null;
  }
}

/** Punti per singola giocata vinta: Quota × 10 (cap 50, quote basse 5pt). */
export function calculateBetPoints(odds: number, isCorrect: boolean): number {
  if (!isCorrect) return 0;
  if (odds < TOURNAMENT.lowOddsThreshold) return TOURNAMENT.lowOddsMaxPoints;
  return Math.min(odds * 10, TOURNAMENT.maxPointsPerBet);
}

/**
 * Valuta una schedina completa contro i risultati.
 * - void (mercato non valutabile) = quota 1.00 → 10 punti, conta come corretto
 * - jolly power-up: raddoppia i punti del pronostico selezionato
 * - shield: annulla le penalità quote basse
 * - insurance: con 8/10 corretti applica comunque il bonus del 9/10
 */
export function evaluateSchedina(
  predictions: Prediction[],
  results: Map<string, MatchResult>,
  powerups: PowerUpSelection = {}
): SchedinaScore {
  const predictionResults: PredictionResult[] = predictions.map(pred => {
    const r = results.get(pred.matchId);
    if (!r) {
      return { ...pred, isCorrect: false, isVoid: true, pointsEarned: 10 };
    }
    const evalResult = evaluateBet(pred.betType, pred.outcome, r);
    if (evalResult === null) {
      // Mercato non valutabile → rimborso (quota 1.00)
      return { ...pred, isCorrect: true, isVoid: true, pointsEarned: 10 };
    }
    let points = calculateBetPoints(pred.odds, evalResult);
    if (evalResult && powerups.jolly === pred.matchId) {
      points *= 2;
    }
    return {
      ...pred,
      isCorrect: evalResult,
      isVoid: false,
      pointsEarned: Math.round(points * 100) / 100,
    };
  });

  const correctPredictions = predictionResults.filter(p => p.isCorrect).length;
  const basePoints = predictionResults.reduce((s, p) => s + p.pointsEarned, 0);

  // Bonus 9/10 e 10/10 (insurance: 8 corretti → bonus 9)
  let bonusPoints = 0;
  if (correctPredictions >= 10) bonusPoints = TOURNAMENT.bonus10Correct;
  else if (correctPredictions === 9) bonusPoints = TOURNAMENT.bonus9Correct;
  else if (correctPredictions === 8 && powerups.insurance) {
    bonusPoints = TOURNAMENT.bonus9Correct;
  }

  // Penalità quote 1.25-1.29 (ogni 3 giocate → -15), annullata dallo shield
  const penaltyRange = predictions.filter(
    p => p.odds >= TOURNAMENT.lowOddsThreshold - 0.001 && p.odds < TOURNAMENT.minValidOdds
  ).length;
  let penaltyPoints = Math.floor(penaltyRange / 3) * TOURNAMENT.penaltyPerThree;
  if (powerups.shield) penaltyPoints = 0;

  const finalPoints = Math.round((basePoints + bonusPoints + penaltyPoints) * 100) / 100;

  return {
    totalPoints: Math.round(basePoints * 100) / 100,
    bonusPoints,
    penaltyPoints,
    finalPoints,
    correctPredictions,
    predictionResults,
  };
}
