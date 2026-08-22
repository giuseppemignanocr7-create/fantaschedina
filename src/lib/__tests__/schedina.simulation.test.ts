// ============================================
// SIMULAZIONE MASSIVA END-TO-END
// 200 schedine casuali (seed deterministico) da 10 pronostici ciascuna
// = 2000 pronostici valutati. Il punteggio atteso è ricalcolato in modo
// indipendente dal regolamento e confrontato con evaluateSchedina.
// ============================================
import { describe, it, expect } from 'vitest';
import { evaluateSchedina } from '../scoring';
import type { Match, Prediction, Schedina } from '@/types';

// PRNG deterministico (mulberry32) per simulazioni riproducibili
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Result = NonNullable<Match['result']>;

const MARKETS = [
  { betType: 'esito', outcomes: ['1', 'X', '2'] },
  { betType: 'over_under', outcomes: ['OVER', 'UNDER'] },
  { betType: 'goal_nogoal', outcomes: ['GG', 'NG'] },
  { betType: 'doppia_chance', outcomes: ['1X', '12', 'X2'] },
  { betType: 'multigoal', outcomes: ['O0.5', 'U0.5', 'O1.5', 'U1.5', 'O2.5', 'U2.5', 'O3.5', 'U3.5'] },
  { betType: 'esito_1t', outcomes: ['1', 'X', '2'] },
  { betType: 'over_under_1t', outcomes: ['OVER', 'UNDER'] },
  { betType: 'goal_nogoal_1t', outcomes: ['GG', 'NG'] },
] as const;

// ---- Oracle indipendente: reimplementa il regolamento passo-passo ----
function oracleEvaluate(betType: string, outcome: string, r: Result): boolean | null {
  const tot = r.homeGoals + r.awayGoals;
  const out = r.homeGoals > r.awayGoals ? '1' : r.awayGoals > r.homeGoals ? '2' : 'X';
  const hasHT = r.htHomeGoals != null && r.htAwayGoals != null;
  const htH = r.htHomeGoals ?? 0;
  const htA = r.htAwayGoals ?? 0;
  const htTot = htH + htA;
  const htOut = htH > htA ? '1' : htA > htH ? '2' : 'X';

  if (betType === 'esito') return outcome === out;
  if (betType === 'over_under') return outcome === 'OVER' ? tot >= 3 : tot <= 2;
  if (betType === 'goal_nogoal') {
    const gg = r.homeGoals > 0 && r.awayGoals > 0;
    return outcome === 'GG' ? gg : !gg;
  }
  if (betType === 'doppia_chance') return outcome.includes(out);
  if (betType === 'multigoal') {
    const line = parseFloat(outcome.slice(1));
    return outcome[0] === 'O' ? tot > line : tot < line;
  }
  if (!hasHT) return null;
  if (betType === 'esito_1t') return outcome === htOut;
  if (betType === 'over_under_1t') return outcome === 'OVER' ? htTot >= 2 : htTot <= 1;
  if (betType === 'goal_nogoal_1t') {
    const gg = htH > 0 && htA > 0;
    return outcome === 'GG' ? gg : !gg;
  }
  return null;
}

function oracleBetPoints(odds: number, won: boolean): number {
  if (!won) return 0;
  // Quota cappata a 5.00 e moltiplicata per 10.
  return Math.min(odds, 5) * 10;
}

interface Sim {
  seed: number;
  matches: Match[];
  schedina: Schedina;
}

function buildSimulation(seed: number): Sim {
  const rnd = mulberry32(seed);
  const matches: Match[] = [];
  const predictions: Prediction[] = [];

  for (let i = 0; i < 10; i++) {
    const homeGoals = Math.floor(rnd() * 5);
    const awayGoals = Math.floor(rnd() * 5);
    // 70% dei match ha il dato del primo tempo
    const hasHT = rnd() < 0.7;
    const htHomeGoals = hasHT ? Math.floor(rnd() * (homeGoals + 1)) : undefined;
    const htAwayGoals = hasHT ? Math.floor(rnd() * (awayGoals + 1)) : undefined;

    const result: Result = {
      homeGoals,
      awayGoals,
      outcome: homeGoals > awayGoals ? '1' : awayGoals > homeGoals ? '2' : 'X',
      ...(hasHT ? { htHomeGoals, htAwayGoals } : {}),
    };

    matches.push({
      id: `m${i}`,
      matchday: 1,
      competition: 'ita.1',
      homeTeam: { id: 'aaa', name: 'Home', shortName: 'HOM' },
      awayTeam: { id: 'bbb', name: 'Away', shortName: 'AWY' },
      scheduledAt: new Date('2026-01-01'),
      status: 'finished',
      result,
    });

    const market = MARKETS[Math.floor(rnd() * MARKETS.length)];
    const outcome = market.outcomes[Math.floor(rnd() * market.outcomes.length)];
    // Quote realistiche 1.05 → 6.00
    const odds = Math.round((1.05 + rnd() * 4.95) * 100) / 100;
    predictions.push({ matchId: `m${i}`, betType: market.betType, outcome, odds });
  }

  return {
    seed,
    matches,
    schedina: {
      id: `s${seed}`,
      participantId: `u${seed}`,
      matchday: 1,
      predictions,
      submittedAt: new Date('2026-01-01'),
      isLocked: true,
    },
  };
}

const SIMULATIONS = Array.from({ length: 200 }, (_, i) => buildSimulation(1000 + i));

describe('Simulazione 200 schedine casuali (2000 pronostici) — confronto con oracle', () => {
  it.each(SIMULATIONS.map(s => ({ seed: s.seed, sim: s })))('schedina seed $seed', ({ sim }) => {
    const r = evaluateSchedina(sim.schedina, sim.matches);

    // Oracle indipendente: i punti sono la somma delle quote indovinate
    // (una persa non contribuisce, una void contribuisce 0: neutro).
    let expectedCombo = 0;
    let expectedCorrect = 0;
    let penaltyBets = 0;
    sim.schedina.predictions.forEach((pred, i) => {
      const evalRes = oracleEvaluate(pred.betType, pred.outcome, sim.matches[i].result!);
      let pts: number;
      let correct: boolean;
      if (evalRes === null) {
        pts = 0; // void: contributo neutro in una somma
        correct = true;
      } else {
        pts = oracleBetPoints(pred.odds, evalRes);
        correct = evalRes;
      }
      if (correct) expectedCombo += pts;
      if (correct) expectedCorrect++;
      if (pred.odds >= 1.25 && pred.odds < 1.30) penaltyBets++;

      // Verifica anche il singolo pronostico
      expect(r.predictions[i].pointsEarned).toBeCloseTo(pts, 8);
      expect(r.predictions[i].isCorrect).toBe(correct);
    });

    const expectedBonus = expectedCorrect === 10 ? 10 : expectedCorrect === 9 ? 5 : 0;
    const expectedPenaltyMultiplier = Math.pow(0.9, Math.floor(penaltyBets / 3));
    // Arrotondamento progressivo: vedi lo stesso schema in calculateSchedinaScore.
    // La penalità agisce sui punti delle giocate, il bonus si somma in fondo.
    const expectedBase = Math.round(expectedCombo * 100) / 100;
    const expectedAfterPenalty = Math.round(expectedBase * expectedPenaltyMultiplier * 100) / 100;
    const expectedPenalty = Math.round((expectedAfterPenalty - expectedBase) * 100) / 100;
    const expectedFinal = Math.round((expectedAfterPenalty + expectedBonus) * 100) / 100;

    expect(r.correctPredictions).toBe(expectedCorrect);
    expect(r.totalPoints).toBeCloseTo(expectedBase, 6);
    expect(r.bonusPoints).toBeCloseTo(expectedBonus, 6);
    expect(r.penaltyPoints).toBeCloseTo(expectedPenalty, 6);
    expect(r.finalPoints).toBeCloseTo(expectedFinal, 6);
  });
});

describe('Simulazione — proprietà globali', () => {
  it('nessuna schedina produce punti negativi', () => {
    SIMULATIONS.forEach(sim => {
      const r = evaluateSchedina(sim.schedina, sim.matches);
      expect(r.finalPoints).toBeGreaterThanOrEqual(0);
    });
  });
  it('nessun pronostico contribuisce oltre il tetto (5.00 × 10) al totale', () => {
    SIMULATIONS.forEach(sim => {
      const r = evaluateSchedina(sim.schedina, sim.matches);
      r.predictions.forEach(p => expect(p.pointsEarned).toBeLessThanOrEqual(50));
    });
  });
  it('i punti finali sono sempre base + bonus + penalità', () => {
    SIMULATIONS.forEach(sim => {
      const r = evaluateSchedina(sim.schedina, sim.matches);
      expect(r.finalPoints).toBeCloseTo(r.totalPoints + r.bonusPoints + r.penaltyPoints, 6);
    });
  });
});
