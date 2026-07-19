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

describe('functions evaluateSchedina', () => {
  it('senza power-up: 10/10 → 200 base + 50 bonus', () => {
    const s = evaluateSchedina(tenPredictions(), resultsMap(10));
    expect(s.totalPoints).toBeCloseTo(200);
    expect(s.bonusPoints).toBe(50); // bonus10Correct
    expect(s.finalPoints).toBeCloseTo(250);
  });

  it('jolly raddoppia il pronostico scelto (se vinto)', () => {
    const s = evaluateSchedina(tenPredictions(), resultsMap(10), { jolly: 'm0' });
    // m0: 20 → 40 → totale 220 + bonus 50
    expect(s.totalPoints).toBeCloseTo(220);
  });

  it('jolly su pronostico perso non conta', () => {
    const s = evaluateSchedina(tenPredictions(), resultsMap(5), { jolly: 'm9' });
    expect(s.totalPoints).toBeCloseTo(100);
  });

  it('shield annulla la penalità quote basse', () => {
    const preds = tenPredictions(1.27); // fascia penalità
    const noShield = evaluateSchedina(preds, resultsMap(10));
    expect(noShield.penaltyPoints).toBe(-45); // 10 giocate → 3 set → -45
    const withShield = evaluateSchedina(preds, resultsMap(10), { shield: true });
    expect(withShield.penaltyPoints).toBe(0);
  });

  it('insurance: 8/10 riceve bonus del 9 (+20)', () => {
    const without = evaluateSchedina(tenPredictions(), resultsMap(8));
    expect(without.bonusPoints).toBe(0);
    const withIns = evaluateSchedina(tenPredictions(), resultsMap(8), {
      insurance: true,
    });
    expect(withIns.bonusPoints).toBe(20);
  });

  it('partita senza risultato → void (10 pt)', () => {
    const preds: Prediction[] = [
      { matchId: 'mX', betType: 'esito', outcome: '1', odds: 3.0 },
    ];
    const s = evaluateSchedina(preds, new Map());
    expect(s.predictionResults[0].isVoid).toBe(true);
    expect(s.predictionResults[0].pointsEarned).toBe(10);
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
