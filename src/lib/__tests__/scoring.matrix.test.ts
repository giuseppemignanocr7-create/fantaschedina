// ============================================
// MATRICE ESAUSTIVA DI SIMULAZIONE SCORING
// Ogni mercato × ogni risultato plausibile (0-4 gol per squadra)
// Le attese sono calcolate dal regolamento, NON dall'implementazione.
// ============================================
import { describe, it, expect } from 'vitest';
import { evaluateBet, calculateBetPoints, calculateBonusPoints, calculatePenaltyPoints } from '../scoring';
import type { Match } from '@/types';

type Result = NonNullable<Match['result']>;

const mkResult = (h: number, a: number, hth?: number, hta?: number): Result => ({
  homeGoals: h,
  awayGoals: a,
  outcome: h > a ? '1' : a > h ? '2' : 'X',
  ...(hth != null && hta != null ? { htHomeGoals: hth, htAwayGoals: hta } : {}),
});

// Tutti i risultati 0-4 × 0-4 = 25 scoreline
const SCORELINES: Array<[number, number]> = [];
for (let h = 0; h <= 4; h++) for (let a = 0; a <= 4; a++) SCORELINES.push([h, a]);

describe('evaluateBet — matrice completa 1X2', () => {
  const cases = SCORELINES.flatMap(([h, a]) =>
    (['1', 'X', '2'] as const).map(o => ({ h, a, o }))
  );
  it.each(cases)('esito $o su $h-$a', ({ h, a, o }) => {
    const expected = o === (h > a ? '1' : a > h ? '2' : 'X');
    expect(evaluateBet('esito', o, mkResult(h, a))).toBe(expected);
  });
});

describe('evaluateBet — matrice completa Over/Under 2.5', () => {
  const cases = SCORELINES.flatMap(([h, a]) =>
    (['OVER', 'UNDER'] as const).map(o => ({ h, a, o }))
  );
  it.each(cases)('$o su $h-$a', ({ h, a, o }) => {
    const expected = o === 'OVER' ? h + a >= 3 : h + a <= 2;
    expect(evaluateBet('over_under', o, mkResult(h, a))).toBe(expected);
  });
});

describe('evaluateBet — matrice completa GG/NG', () => {
  const cases = SCORELINES.flatMap(([h, a]) =>
    (['GG', 'NG'] as const).map(o => ({ h, a, o }))
  );
  it.each(cases)('$o su $h-$a', ({ h, a, o }) => {
    const gg = h > 0 && a > 0;
    expect(evaluateBet('goal_nogoal', o, mkResult(h, a))).toBe(o === 'GG' ? gg : !gg);
  });
});

describe('evaluateBet — matrice completa Doppia Chance', () => {
  const cases = SCORELINES.flatMap(([h, a]) =>
    (['1X', '12', 'X2'] as const).map(o => ({ h, a, o }))
  );
  it.each(cases)('$o su $h-$a', ({ h, a, o }) => {
    const outcome = h > a ? '1' : a > h ? '2' : 'X';
    expect(evaluateBet('doppia_chance', o, mkResult(h, a))).toBe(o.includes(outcome));
  });
});

describe('evaluateBet — matrice completa Multigoal', () => {
  const lines = ['O0.5', 'U0.5', 'O1.5', 'U1.5', 'O2.5', 'U2.5', 'O3.5', 'U3.5'] as const;
  const cases = SCORELINES.flatMap(([h, a]) => lines.map(o => ({ h, a, o })));
  it.each(cases)('$o su $h-$a', ({ h, a, o }) => {
    const total = h + a;
    const line = parseFloat(o.slice(1));
    const expected = o.startsWith('O') ? total > line : total < line;
    expect(evaluateBet('multigoal', o, mkResult(h, a))).toBe(expected);
  });
});

describe('evaluateBet — matrice 1° Tempo (0-2 gol HT per squadra)', () => {
  const HT: Array<[number, number]> = [];
  for (let h = 0; h <= 2; h++) for (let a = 0; a <= 2; a++) HT.push([h, a]);

  const esitoCases = HT.flatMap(([h, a]) => (['1', 'X', '2'] as const).map(o => ({ h, a, o })));
  it.each(esitoCases)('esito_1t $o su HT $h-$a', ({ h, a, o }) => {
    const expected = o === (h > a ? '1' : a > h ? '2' : 'X');
    expect(evaluateBet('esito_1t', o, mkResult(h + a, 0, h, a))).toBe(expected);
  });

  const ouCases = HT.flatMap(([h, a]) => (['OVER', 'UNDER'] as const).map(o => ({ h, a, o })));
  it.each(ouCases)('over_under_1t $o su HT $h-$a (linea 1.5)', ({ h, a, o }) => {
    const expected = o === 'OVER' ? h + a >= 2 : h + a <= 1;
    expect(evaluateBet('over_under_1t', o, mkResult(h + a, 0, h, a))).toBe(expected);
  });

  const ggCases = HT.flatMap(([h, a]) => (['GG', 'NG'] as const).map(o => ({ h, a, o })));
  it.each(ggCases)('goal_nogoal_1t $o su HT $h-$a', ({ h, a, o }) => {
    const gg = h > 0 && a > 0;
    expect(evaluateBet('goal_nogoal_1t', o, mkResult(h + a, 0, h, a))).toBe(o === 'GG' ? gg : !gg);
  });
});

describe('evaluateBet — mercati 1T void senza dato HT', () => {
  const markets = ['esito_1t', 'over_under_1t', 'goal_nogoal_1t'] as const;
  const outcomes: Record<string, string[]> = {
    esito_1t: ['1', 'X', '2'],
    over_under_1t: ['OVER', 'UNDER'],
    goal_nogoal_1t: ['GG', 'NG'],
  };
  const cases = markets.flatMap(m => outcomes[m].map(o => ({ m, o })));
  it.each(cases)('$m $o senza HT → null (void)', ({ m, o }) => {
    expect(evaluateBet(m, o, mkResult(2, 1))).toBeNull();
  });
});

describe('evaluateBet — input non validi', () => {
  it('betType sconosciuto → null', () => {
    expect(evaluateBet('handicap_asiatico', '1', mkResult(1, 0))).toBeNull();
  });
  it('multigoal con linea non numerica → null', () => {
    expect(evaluateBet('multigoal', 'OXX', mkResult(1, 0))).toBeNull();
  });
});

describe('calculateBetPoints — griglia quote 1.00→6.00 (step 0.05)', () => {
  const oddsGrid: number[] = [];
  for (let o = 100; o <= 600; o += 5) oddsGrid.push(o / 100);

  it.each(oddsGrid.map(o => ({ o })))('quota $o vinta → contributo da regolamento (cappato a 5.00)', ({ o }) => {
    // Regolamento: le quote corrette si moltiplicano tra loro, cappate a oddsCap
    const expected = Math.min(o, 5);
    expect(calculateBetPoints(o, true)).toBeCloseTo(expected, 10);
  });

  it.each(oddsGrid.map(o => ({ o })))('quota $o persa → 0 (esclusa dal prodotto)', ({ o }) => {
    expect(calculateBetPoints(o, false)).toBe(0);
  });
});

describe('calculateBonusPoints — tutti i conteggi 0→10', () => {
  it.each(Array.from({ length: 11 }, (_, n) => ({ n })))('%s corrette', ({ n }) => {
    const expected = n === 10 ? 1.5 : n === 9 ? 1.2 : 1;
    expect(calculateBonusPoints(n)).toBe(expected);
  });
});

describe('calculatePenaltyPoints — tutti i conteggi 0→12', () => {
  it.each(Array.from({ length: 13 }, (_, n) => ({ n })))('%s giocate in fascia penalità', ({ n }) => {
    const expected = Math.pow(0.9, Math.floor(n / 3));
    expect(calculatePenaltyPoints(n)).toBeCloseTo(expected, 10);
  });
});
