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

/**
 * Punti di una singola giocata vinta: la quota (cappata a oddsCap)
 * moltiplicata per 10. Una giocata a 2.00 vale 20 punti, una a 5.00 o più ne
 * vale 50. I punti della schedina sono la somma di questi contributi.
 */
export function calculateBetPoints(odds: number, isCorrect: boolean): number {
  if (!isCorrect) return 0;
  return Math.min(odds, TOURNAMENT.oddsCap) * TOURNAMENT.pointsMultiplier;
}

/**
 * Valuta una schedina completa contro i risultati.
 * - punti base = somma delle quote (cappate) × 10 delle giocate corrette
 * - void (mercato non valutabile) = 0 punti, ma conta come corretto
 * - jolly power-up: raddoppia il contributo della giocata selezionata (se vinta)
 * - shield: annulla il moltiplicatore di penalità quote basse
 * - insurance: con 8/10 corretti dà comunque il bonus del 9/10
 * Bonus e penalità restano espressi come impatto assoluto in punti, così
 * finalPoints resta sempre totalPoints + bonusPoints + penaltyPoints.
 */
export function evaluateSchedina(
  predictions: Prediction[],
  results: Map<string, MatchResult>,
  powerups: PowerUpSelection = {}
): SchedinaScore {
  const predictionResults: PredictionResult[] = predictions.map(pred => {
    const r = results.get(pred.matchId);
    if (!r) {
      return { ...pred, isCorrect: false, isVoid: true, pointsEarned: 0 };
    }
    const evalResult = evaluateBet(pred.betType, pred.outcome, r);
    if (evalResult === null) {
      // Mercato non valutabile → rimborso: contributo neutro. In una somma il
      // neutro è 0, non 1 come quando le quote si moltiplicavano.
      return { ...pred, isCorrect: true, isVoid: true, pointsEarned: 0 };
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
  // Punti della schedina: somma delle quote indovinate (ognuna cappata a
  // oddsCap, raddoppiata dal Jolly). Fino al 20/08/2026 si moltiplicavano:
  // dieci quote da 2.00 valevano 1024 punti invece di 20, e una sola giocata
  // sbagliata azzerava tutto.
  const puntiBase = predictionResults.reduce(
    (somma, p) => (p.isCorrect ? somma + p.pointsEarned : somma),
    0
  );

  // Bonus 9/10 e 10/10: punti pieni aggiunti in fondo, non moltiplicatori
  // (insurance: con 8 corretti si prende comunque il bonus del 9).
  let bonusPunti = 0;
  if (correctPredictions >= 10) bonusPunti = TOURNAMENT.bonus10Points;
  else if (correctPredictions === 9) bonusPunti = TOURNAMENT.bonus9Points;
  else if (correctPredictions === 8 && powerups.insurance) {
    bonusPunti = TOURNAMENT.bonus9Points;
  }

  // Penalità quote 1.25-1.29 (composizione della schedina, a prescindere
  // dall'esito), ogni 3 giocate → ×0.9, annullata dallo shield
  const penaltyRange = predictions.filter(
    p => p.odds >= TOURNAMENT.penaltyOddsMin - 0.001 && p.odds < TOURNAMENT.minValidOdds
  ).length;
  let penaltyMultiplier = Math.pow(TOURNAMENT.penaltyMultiplierPerThree, Math.floor(penaltyRange / 3));
  if (powerups.shield) penaltyMultiplier = 1;

  // La penalità colpisce la composizione della schedina, quindi si applica ai
  // punti delle giocate; il bonus premia la precisione e si somma in fondo,
  // senza essere eroso dalla penalità.
  const totalPoints = Math.round(puntiBase * 100) / 100;
  const afterPenalty = Math.round(totalPoints * penaltyMultiplier * 100) / 100;
  const penaltyPoints = Math.round((afterPenalty - totalPoints) * 100) / 100;
  const bonusPoints = bonusPunti;

  return {
    totalPoints,
    bonusPoints,
    penaltyPoints,
    finalPoints: Math.round((afterPenalty + bonusPoints) * 100) / 100,
    correctPredictions,
    predictionResults,
  };
}
