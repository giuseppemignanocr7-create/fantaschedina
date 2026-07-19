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
  checkPokerPrize,
  findHighestWinningOdds,
} from '../scoring';
import type { Match, Prediction, PredictionResult, Schedina } from '@/types';

// ---------- calculateBetPoints ----------
describe('calculateBetPoints', () => {
  it('quota persa vale 0', () => {
    expect(calculateBetPoints(2.5, false)).toBe(0);
  });
  it('quota vinta = quota × 10', () => {
    expect(calculateBetPoints(2.2, true)).toBeCloseTo(22);
  });
  it('cap a 50 punti (quota 5.00)', () => {
    expect(calculateBetPoints(8.0, true)).toBe(50);
  });
  it('quota < 1.25 vale solo 5 punti', () => {
    expect(calculateBetPoints(1.1, true)).toBe(5);
  });
  it('quota 1.25 (fascia penalità) vale quota × 10', () => {
    expect(calculateBetPoints(1.25, true)).toBeCloseTo(12.5);
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
  it('ogni 3 giocate in fascia penalità → -15', () => {
    expect(calculatePenaltyPoints(2)).toBeCloseTo(0);
    expect(calculatePenaltyPoints(3)).toBe(-15);
    expect(calculatePenaltyPoints(6)).toBe(-30);
  });
});

// ---------- bonus ----------
describe('calculateBonusPoints', () => {
  it('9 corretti → +20', () => {
    expect(calculateBonusPoints(9)).toBe(20);
  });
  it('10 corretti → +50', () => {
    expect(calculateBonusPoints(10)).toBe(50);
  });
  it('8 corretti → 0', () => {
    expect(calculateBonusPoints(8)).toBe(0);
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
  it('10/10 corretti include bonus +50', () => {
    const matches = Array.from({ length: 10 }, (_, i) => makeMatch(`m${i}`, 2, 0));
    const predictions: Prediction[] = matches.map(m => ({
      matchId: m.id,
      betType: 'esito',
      outcome: '1',
      odds: 2.0,
    }));
    const r = evaluateSchedina(makeSchedina(predictions), matches);
    expect(r.correctPredictions).toBe(10);
    expect(r.totalPoints).toBeCloseTo(200);
    expect(r.bonusPoints).toBe(50);
    expect(r.finalPoints).toBeCloseTo(250);
  });

  it('valuta correttamente mercati misti', () => {
    const matches = [makeMatch('m1', 2, 1), makeMatch('m2', 0, 0)];
    const predictions: Prediction[] = [
      { matchId: 'm1', betType: 'over_under', outcome: 'OVER', odds: 1.85 },
      { matchId: 'm2', betType: 'goal_nogoal', outcome: 'NG', odds: 2.0 },
    ];
    const r = evaluateSchedina(makeSchedina(predictions), matches);
    expect(r.correctPredictions).toBe(2);
    expect(r.totalPoints).toBeCloseTo(18.5 + 20);
  });

  it('penalità applicata con 3 quote in fascia 1.25-1.29', () => {
    const matches = Array.from({ length: 3 }, (_, i) => makeMatch(`m${i}`, 1, 0));
    const predictions: Prediction[] = matches.map(m => ({
      matchId: m.id,
      betType: 'esito',
      outcome: '1',
      odds: 1.27,
    }));
    const r = evaluateSchedina(makeSchedina(predictions), matches);
    expect(r.penaltyPoints).toBe(-15);
  });

  it('mercato 1T senza dato HT → void = 10 punti', () => {
    const matches = [makeMatch('m1', 2, 1)];
    const predictions: Prediction[] = [
      { matchId: 'm1', betType: 'esito_1t', outcome: '1', odds: 2.5 },
    ];
    const r = evaluateSchedina(makeSchedina(predictions), matches);
    expect(r.predictions[0].pointsEarned).toBe(10);
    expect(r.predictions[0].isCorrect).toBe(true);
  });
});

// ---------- premi speciali ----------
describe('premi speciali', () => {
  const pr = (odds: number, isCorrect: boolean): PredictionResult => ({
    matchId: 'm',
    betType: 'esito',
    outcome: '1',
    odds,
    isCorrect,
    pointsEarned: isCorrect ? odds * 10 : 0,
  });

  it('poker: 4 quote vinte > 2.00', () => {
    const preds = [pr(2.1, true), pr(2.5, true), pr(3.0, true), pr(2.2, true)];
    expect(checkPokerPrize(preds).eligible).toBe(true);
  });
  it('poker: quote a 2.00 esatto non contano', () => {
    const preds = [pr(2.0, true), pr(2.5, true), pr(3.0, true), pr(2.2, true)];
    expect(checkPokerPrize(preds).eligible).toBe(false);
  });
  it('quota più alta assegnata solo se >= 2.00', () => {
    const low = [{ ...makeSchedina([]), predictions: [pr(1.8, true)], totalPoints: 0, correctPredictions: 1, bonusPoints: 0, penaltyPoints: 0, finalPoints: 18 }];
    expect(findHighestWinningOdds(low).winnerId).toBeNull();
    const high = [{ ...makeSchedina([]), predictions: [pr(3.5, true)], totalPoints: 0, correctPredictions: 1, bonusPoints: 0, penaltyPoints: 0, finalPoints: 35 }];
    expect(findHighestWinningOdds(high).winnerId).toBe('u1');
  });
});

// ---------- calcolo aggregato ----------
describe('calculateSchedinaScore', () => {
  it('conta correttamente low odds e penalty range', () => {
    const preds: PredictionResult[] = [
      { matchId: 'a', betType: 'esito', outcome: '1', odds: 1.1, isCorrect: true, pointsEarned: 5 },
      { matchId: 'b', betType: 'esito', outcome: '1', odds: 1.27, isCorrect: false, pointsEarned: 0 },
      { matchId: 'c', betType: 'esito', outcome: '1', odds: 6.0, isCorrect: true, pointsEarned: 50 },
    ];
    const score = calculateSchedinaScore(preds);
    expect(score.details.lowOddsBets).toBe(1);
    expect(score.details.penaltyRangeBets).toBe(1);
    expect(score.details.cappedBets).toBe(1);
    expect(score.basePoints).toBeCloseTo(55);
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
