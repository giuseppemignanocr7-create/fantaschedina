// Test del motore di settlement server-side (functions/src/scoring.ts)
// incluso il comportamento dei power-up.
import { describe, it, expect } from 'vitest';
import {
  evaluateSchedina,
  evaluateBet,
  type MatchResult,
  type Prediction,
} from '../../../functions/src/scoring';

const res = (h: number, a: number): MatchResult => ({
  homeGoals: h,
  awayGoals: a,
  outcome: h > a ? '1' : a > h ? '2' : 'X',
});

function tenPredictions(odds = 2.0): Prediction[] {
  return Array.from({ length: 10 }, (_, i) => ({
    matchId: `m${i}`,
    betType: 'esito',
    outcome: '1',
    odds,
  }));
}

function resultsMap(correct: number): Map<string, MatchResult> {
  // Le prime `correct` partite finiscono 1 (vinte), le altre 2 (perse)
  return new Map(
    Array.from({ length: 10 }, (_, i) => [
      `m${i}`,
      i < correct ? res(2, 0) : res(0, 2),
    ])
  );
}

// Stesso arrotondamento progressivo usato da evaluateSchedina, per calcolare
// i valori attesi senza duplicare la logica interna a mano. `base` è già in
// punti (quota × 10), `bonus` è in punti pieni.
function expectedTotals(base: number, bonus: number, penaltyMultiplier: number) {
  const totalPoints = Math.round(base * 100) / 100;
  const afterPenalty = Math.round(totalPoints * penaltyMultiplier * 100) / 100;
  const penaltyPoints = Math.round((afterPenalty - totalPoints) * 100) / 100;
  return {
    totalPoints,
    bonusPoints: bonus,
    penaltyPoints,
    finalPoints: Math.round((afterPenalty + bonus) * 100) / 100,
  };
}

describe('functions evaluateSchedina', () => {
  it('senza power-up: 10/10 → quote ×10 sommate, più 10 punti di bonus', () => {
    const s = evaluateSchedina(tenPredictions(), resultsMap(10));
    const expected = expectedTotals(10 * 20, 10, 1);
    expect(s.totalPoints).toBeCloseTo(expected.totalPoints);
    expect(s.bonusPoints).toBeCloseTo(expected.bonusPoints);
    expect(s.finalPoints).toBeCloseTo(expected.finalPoints);
  });

  it('jolly raddoppia il contributo del pronostico scelto (se vinto)', () => {
    const s = evaluateSchedina(tenPredictions(), resultsMap(10), { jolly: 'm0' });
    // m0: 20 → 40 punti (raddoppiato), le altre 9 restano da 20
    const base = 40 + 9 * 20;
    const expected = expectedTotals(base, 10, 1);
    expect(s.totalPoints).toBeCloseTo(expected.totalPoints);
  });

  it('jolly su pronostico perso non raddoppia nulla', () => {
    const s = evaluateSchedina(tenPredictions(), resultsMap(5), { jolly: 'm9' });
    // m9 è tra le perse (solo m0-m4 corrette): il jolly non si applica
    const expected = expectedTotals(5 * 20, 0, 1);
    expect(s.totalPoints).toBeCloseTo(expected.totalPoints);
  });

  it('shield annulla il moltiplicatore di penalità quote basse', () => {
    const preds = tenPredictions(1.27); // fascia penalità, tutte e 10
    const combo = 10 * 12.7;
    const noShield = evaluateSchedina(preds, resultsMap(10));
    // 10/10 corrette → il bonus di 10 punti si somma comunque; la penalità
    // (10 giocate in fascia → 3 set → ×0.9^3) colpisce solo i punti giocati.
    const expectedNoShield = expectedTotals(combo, 10, Math.pow(0.9, 3));
    expect(noShield.penaltyPoints).toBeCloseTo(expectedNoShield.penaltyPoints);
    expect(noShield.finalPoints).toBeCloseTo(expectedNoShield.finalPoints);

    const withShield = evaluateSchedina(preds, resultsMap(10), { shield: true });
    const expectedShield = expectedTotals(combo, 10, 1);
    expect(withShield.penaltyPoints).toBe(0);
    expect(withShield.finalPoints).toBeCloseTo(expectedShield.finalPoints);
  });

  it('insurance: 8/10 riceve il bonus del 9/10 (+5 punti)', () => {
    const without = evaluateSchedina(tenPredictions(), resultsMap(8));
    expect(without.bonusPoints).toBe(0);

    const withIns = evaluateSchedina(tenPredictions(), resultsMap(8), {
      insurance: true,
    });
    const expected = expectedTotals(8 * 20, 5, 1);
    expect(withIns.bonusPoints).toBeCloseTo(expected.bonusPoints);
  });

  it('partita senza risultato → non corretta, contributo 0', () => {
    const preds: Prediction[] = [
      { matchId: 'mX', betType: 'esito', outcome: '1', odds: 3.0 },
    ];
    const s = evaluateSchedina(preds, new Map());
    expect(s.predictionResults[0].isVoid).toBe(true);
    expect(s.predictionResults[0].isCorrect).toBe(false);
    expect(s.predictionResults[0].pointsEarned).toBe(0);
    expect(s.finalPoints).toBe(0);
  });

  it('mercato non valutabile (void) → corretta, contributo neutro (0 punti)', () => {
    // esito_1t senza dato HT nel risultato → evaluateBet ritorna null (void)
    const preds: Prediction[] = [
      { matchId: 'mY', betType: 'esito_1t', outcome: '1', odds: 3.0 },
    ];
    const s = evaluateSchedina(preds, new Map([['mY', res(2, 0)]]));
    expect(s.predictionResults[0].isVoid).toBe(true);
    expect(s.predictionResults[0].isCorrect).toBe(true);
    // Nella somma il neutro è 0: un mercato non valutabile non regala punti,
    // ma continua a contare come corretto per i bonus 9/10 e 10/10.
    expect(s.predictionResults[0].pointsEarned).toBe(0);
    expect(s.totalPoints).toBe(0);
  });
});

describe('functions evaluateBet coerente col client', () => {
  it('over/under, GG/NG, DC', () => {
    expect(evaluateBet('over_under', 'OVER', res(2, 1))).toBe(true);
    expect(evaluateBet('goal_nogoal', 'GG', res(1, 1))).toBe(true);
    expect(evaluateBet('doppia_chance', 'X2', res(0, 0))).toBe(true);
    expect(evaluateBet('multigoal', 'U1.5', res(1, 0))).toBe(true);
  });
});
