import { describe, it, expect } from 'vitest';
import {
  calculateBetPoints,
  calculateBonusPoints,
  calculatePenaltyPoints,
  calculateSchedinaScore,
  countPenaltyRangeBets,
  evaluateBet,
  evaluateSchedina,
  isInPenaltyRange,
  isValidOdds,
} from '../scoring';
import type { Match, Prediction, PredictionResult, Schedina } from '@/types';

// ---------- calculateBetPoints ----------
describe('calculateBetPoints', () => {
  it('quota persa vale 0', () => {
    expect(calculateBetPoints(2.5, false)).toBe(0);
  });
  it('quota vinta contribuisce la quota stessa al combo', () => {
    expect(calculateBetPoints(2.2, true)).toBeCloseTo(2.2);
  });
  it('cap a oddsCap (5.00)', () => {
    expect(calculateBetPoints(8.0, true)).toBe(5);
  });
  it('quota bassa (1.1) contribuisce comunque la quota reale, nessun floor', () => {
    expect(calculateBetPoints(1.1, true)).toBeCloseTo(1.1);
  });
  it('quota 1.25 (fascia penalità) contribuisce la quota stessa', () => {
    expect(calculateBetPoints(1.25, true)).toBeCloseTo(1.25);
  });
});

// ---------- validità e penalità quote ----------
describe('odds ranges', () => {
  it('quota valida da 1.30', () => {
    expect(isValidOdds(1.3)).toBe(true);
    expect(isValidOdds(1.29)).toBe(false);
  });
  it('fascia penalità 1.25-1.29', () => {
    expect(isInPenaltyRange(1.25)).toBe(true);
    expect(isInPenaltyRange(1.29)).toBe(true);
    expect(isInPenaltyRange(1.3)).toBe(false);
    expect(isInPenaltyRange(1.24)).toBe(false);
  });
  it('ogni 3 giocate in fascia penalità → ×0.9 (si compone)', () => {
    expect(calculatePenaltyPoints(2)).toBeCloseTo(1);
    expect(calculatePenaltyPoints(3)).toBeCloseTo(0.9);
    expect(calculatePenaltyPoints(6)).toBeCloseTo(0.81);
  });
});

// ---------- bonus ----------
describe('calculateBonusPoints', () => {
  it('9 corretti → ×1.2', () => {
    expect(calculateBonusPoints(9)).toBe(1.2);
  });
  it('10 corretti → ×1.5', () => {
    expect(calculateBonusPoints(10)).toBe(1.5);
  });
  it('8 corretti → ×1 (nessun bonus)', () => {
    expect(calculateBonusPoints(8)).toBe(1);
  });
});

// ---------- evaluateBet (multi-mercato) ----------
const result = (h: number, a: number, htH?: number, htA?: number) => ({
  homeGoals: h,
  awayGoals: a,
  outcome: (h > a ? '1' : a > h ? '2' : 'X') as '1' | 'X' | '2',
  ...(htH != null ? { htHomeGoals: htH, htAwayGoals: htA } : {}),
});

describe('evaluateBet', () => {
  it('esito 1X2', () => {
    expect(evaluateBet('esito', '1', result(2, 1))).toBe(true);
    expect(evaluateBet('esito', 'X', result(1, 1))).toBe(true);
    expect(evaluateBet('esito', '2', result(2, 1))).toBe(false);
  });
  it('over/under 2.5', () => {
    expect(evaluateBet('over_under', 'OVER', result(2, 1))).toBe(true);
    expect(evaluateBet('over_under', 'OVER', result(1, 1))).toBe(false);
    expect(evaluateBet('over_under', 'UNDER', result(0, 2))).toBe(true);
  });
  it('goal/nogoal', () => {
    expect(evaluateBet('goal_nogoal', 'GG', result(1, 1))).toBe(true);
    expect(evaluateBet('goal_nogoal', 'GG', result(2, 0))).toBe(false);
    expect(evaluateBet('goal_nogoal', 'NG', result(2, 0))).toBe(true);
  });
  it('doppia chance', () => {
    expect(evaluateBet('doppia_chance', '1X', result(1, 1))).toBe(true);
    expect(evaluateBet('doppia_chance', '1X', result(0, 1))).toBe(false);
    expect(evaluateBet('doppia_chance', '12', result(0, 1))).toBe(true);
    expect(evaluateBet('doppia_chance', 'X2', result(0, 1))).toBe(true);
  });
  it('multigoal', () => {
    expect(evaluateBet('multigoal', 'O0.5', result(1, 0))).toBe(true);
    expect(evaluateBet('multigoal', 'U0.5', result(0, 0))).toBe(true);
    expect(evaluateBet('multigoal', 'O3.5', result(2, 2))).toBe(true);
    expect(evaluateBet('multigoal', 'U1.5', result(1, 1))).toBe(false);
  });
  it('mercati 1° tempo con dato HT', () => {
    expect(evaluateBet('esito_1t', '1', result(3, 0, 1, 0))).toBe(true);
    expect(evaluateBet('over_under_1t', 'OVER', result(3, 2, 2, 1))).toBe(true);
    expect(evaluateBet('goal_nogoal_1t', 'NG', result(3, 2, 1, 0))).toBe(true);
  });
  it('mercati 1° tempo senza dato HT → null (void)', () => {
    expect(evaluateBet('esito_1t', '1', result(3, 0))).toBeNull();
    expect(evaluateBet('over_under_1t', 'OVER', result(3, 2))).toBeNull();
  });
  it('mercato sconosciuto → null', () => {
    expect(evaluateBet('unknown', 'X', result(1, 1))).toBeNull();
  });
});

// ---------- schedina completa ----------
function makeMatch(id: string, h: number, a: number): Match {
  return {
    id,
    matchday: 1,
    competition: 'ita.1',
    homeTeam: { id: 'aaa', name: 'Home', shortName: 'HOM' },
    awayTeam: { id: 'bbb', name: 'Away', shortName: 'AWY' },
    scheduledAt: new Date(),
    status: 'finished',
    result: result(h, a),
  };
}

function makeSchedina(predictions: Prediction[]): Schedina {
  return {
    id: 's1',
    participantId: 'u1',
    matchday: 1,
    predictions,
    submittedAt: new Date(),
    isLocked: true,
  };
}

describe('evaluateSchedina', () => {
  it('10/10 corretti: le quote si moltiplicano e il bonus è ×1.5', () => {
    const matches = Array.from({ length: 10 }, (_, i) => makeMatch(`m${i}`, 2, 0));
    const predictions: Prediction[] = matches.map(m => ({
      matchId: m.id,
      betType: 'esito',
      outcome: '1',
      odds: 2.0,
    }));
    const r = evaluateSchedina(makeSchedina(predictions), matches);
    expect(r.correctPredictions).toBe(10);
    expect(r.totalPoints).toBeCloseTo(1024); // 2.0^10
    expect(r.bonusPoints).toBeCloseTo(512); // 1024 × (1.5 - 1)
    expect(r.finalPoints).toBeCloseTo(1536); // 1024 × 1.5
  });

  it('valuta correttamente mercati misti: le quote corrette si moltiplicano tra loro', () => {
    const matches = [makeMatch('m1', 2, 1), makeMatch('m2', 0, 0)];
    const predictions: Prediction[] = [
      { matchId: 'm1', betType: 'over_under', outcome: 'OVER', odds: 1.85 },
      { matchId: 'm2', betType: 'goal_nogoal', outcome: 'NG', odds: 2.0 },
    ];
    const r = evaluateSchedina(makeSchedina(predictions), matches);
    expect(r.correctPredictions).toBe(2);
    expect(r.totalPoints).toBeCloseTo(1.85 * 2.0);
  });

  it('penalità applicata con 3 quote in fascia 1.25-1.29 (moltiplicatore ×0.9)', () => {
    const matches = Array.from({ length: 3 }, (_, i) => makeMatch(`m${i}`, 1, 0));
    const predictions: Prediction[] = matches.map(m => ({
      matchId: m.id,
      betType: 'esito',
      outcome: '1',
      odds: 1.27,
    }));
    const r = evaluateSchedina(makeSchedina(predictions), matches);
    const combo = 1.27 ** 3;
    expect(r.penaltyPoints).toBeCloseTo(Math.round((combo * 0.9 - combo) * 100) / 100, 2);
  });

  it('mercato 1T senza dato HT → void = contributo neutro (1)', () => {
    const matches = [makeMatch('m1', 2, 1)];
    const predictions: Prediction[] = [
      { matchId: 'm1', betType: 'esito_1t', outcome: '1', odds: 2.5 },
    ];
    const r = evaluateSchedina(makeSchedina(predictions), matches);
    expect(r.predictions[0].pointsEarned).toBe(1);
    expect(r.predictions[0].isCorrect).toBe(true);
  });

  it('0 corretti su 10 → punteggio 0 (non 1, anche se il prodotto di fattori neutri sarebbe 1)', () => {
    const matches = Array.from({ length: 10 }, (_, i) => makeMatch(`m${i}`, 2, 0));
    const predictions: Prediction[] = matches.map(m => ({
      matchId: m.id,
      betType: 'esito',
      outcome: '2', // sempre sbagliato: il risultato è sempre 2-0 (home vince)
      odds: 3.0,
    }));
    const r = evaluateSchedina(makeSchedina(predictions), matches);
    expect(r.correctPredictions).toBe(0);
    expect(r.finalPoints).toBe(0);
  });
});

// ---------- calcolo aggregato ----------
describe('calculateSchedinaScore', () => {
  it('combo = prodotto delle sole giocate corrette (cappate a oddsCap)', () => {
    const preds: PredictionResult[] = [
      { matchId: 'a', betType: 'esito', outcome: '1', odds: 1.1, isCorrect: true, pointsEarned: 1.1 },
      { matchId: 'b', betType: 'esito', outcome: '1', odds: 1.27, isCorrect: false, pointsEarned: 0 },
      { matchId: 'c', betType: 'esito', outcome: '1', odds: 6.0, isCorrect: true, pointsEarned: 5 },
    ];
    const score = calculateSchedinaScore(preds);
    expect(score.details.penaltyRangeBets).toBe(1);
    expect(score.details.cappedBets).toBe(1);
    expect(score.basePoints).toBeCloseTo(1.1 * 5); // 'b' è sbagliata, esclusa dal prodotto
  });
  it('countPenaltyRangeBets', () => {
    const preds: Prediction[] = [
      { matchId: 'a', betType: 'esito', outcome: '1', odds: 1.25 },
      { matchId: 'b', betType: 'esito', outcome: '1', odds: 1.29 },
      { matchId: 'c', betType: 'esito', outcome: '1', odds: 1.3 },
    ];
    expect(countPenaltyRangeBets(preds)).toBe(2);
  });
});
