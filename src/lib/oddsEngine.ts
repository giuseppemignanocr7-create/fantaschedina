// ============================================
// FANTA SCHEDINA - ODDS ENGINE
// Modello Poisson basato sui goal attesi (xG).
// ============================================

import type { MatchOdds } from '@/data/mockData';

const TEAM_STRENGTH: Record<string, number> = {
  'int': 92, 'nap': 89, 'ata': 87, 'juv': 84, 'mil': 82,
  'laz': 78, 'fio': 76, 'bol': 75, 'rom': 73, 'tor': 65,
  'udi': 62, 'emp': 60, 'com': 59, 'cag': 58, 'gen': 57,
  'par': 56, 'lec': 54, 'ver': 53, 'mon': 52, 'ven': 50,
};

const HOME_ADV = 5;
const MARGIN = 1.065;
const LEAGUE_AVG_GOALS = 2.65;

function r(n: number): number {
  return Math.round(Math.max(1.01, n) * 100) / 100;
}

function poisson(k: number, lambda: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function expectedGoals(homeStrength: number, awayStrength: number): { home: number; away: number } {
  const avg = LEAGUE_AVG_GOALS;
  const diff = homeStrength - awayStrength;
  const home = Math.max(0.35, Math.min(3.8, (avg / 2) + (diff / 100) * 1.3 + (HOME_ADV / 100) * 0.9));
  const away = Math.max(0.25, Math.min(3.0, (avg / 2) - (diff / 100) * 1.1));
  return { home, away };
}

function scoreMatrix(lh: number, la: number, maxGoals = 8): number[][] {
  const matrix: number[][] = [];
  for (let i = 0; i <= maxGoals; i++) {
    matrix[i] = [];
    for (let j = 0; j <= maxGoals; j++) {
      matrix[i][j] = poisson(i, lh) * poisson(j, la);
    }
  }
  return matrix;
}

function sumWhere(matrix: number[][], pred: (i: number, j: number) => boolean): number {
  let s = 0;
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      if (pred(i, j)) s += matrix[i][j];
    }
  }
  return s;
}

export function generateMatchOdds(homeId: string, awayId: string): MatchOdds {
  const hs = (TEAM_STRENGTH[homeId] ?? 62) + HOME_ADV;
  const as_ = TEAM_STRENGTH[awayId] ?? 62;

  const xg = expectedGoals(hs, as_);
  const m = scoreMatrix(xg.home, xg.away);

  const pH = sumWhere(m, (i, j) => i > j);
  const pA = sumWhere(m, (i, j) => i < j);
  const pD = sumWhere(m, (i, j) => i === j);
  const pOver25 = sumWhere(m, (i, j) => i + j >= 3);
  const pUnder25 = 1 - pOver25;
  const pGG = sumWhere(m, (i, j) => i >= 1 && j >= 1);
  const pNG = 1 - pGG;
  const pO05 = sumWhere(m, (i, j) => i + j >= 1);
  const pU05 = 1 - pO05;
  const pO15 = sumWhere(m, (i, j) => i + j >= 2);
  const pU15 = 1 - pO15;
  const pO35 = sumWhere(m, (i, j) => i + j >= 4);
  const pU35 = 1 - pO35;

  const h1 = r((1 / pH) * MARGIN);
  const xD = r((1 / pD) * MARGIN);
  const a2 = r((1 / pA) * MARGIN);
  const ov = r((1 / pOver25) * MARGIN);
  const un = r((1 / pUnder25) * MARGIN);
  const gg = r((1 / pGG) * MARGIN);
  const ng = r((1 / pNG) * MARGIN);
  const dc1X = r((1 / (pH + pD)) * MARGIN);
  const dc12 = r((1 / (pH + pA)) * MARGIN);
  const dcX2 = r((1 / (pD + pA)) * MARGIN);

  const lh1 = xg.home * 0.44;
  const la1 = xg.away * 0.44;
  const m1 = scoreMatrix(lh1, la1);
  const pH1 = sumWhere(m1, (i, j) => i > j);
  const pA1 = sumWhere(m1, (i, j) => i < j);
  const pD1 = sumWhere(m1, (i, j) => i === j);
  const pOv1 = sumWhere(m1, (i, j) => i + j >= 2);
  const pUn1 = 1 - pOv1;
  const pGG1 = sumWhere(m1, (i, j) => i >= 1 && j >= 1);
  const pNG1 = 1 - pGG1;

  return {
    esito: { '1': h1, 'X': xD, '2': a2 },
    over_under: { 'OVER': ov, 'UNDER': un },
    goal_nogoal: { 'GG': gg, 'NG': ng },
    doppia_chance: { '1X': dc1X, '12': dc12, 'X2': dcX2 },
    multigoal: {
      'O0.5': r((1 / pO05) * MARGIN),
      'U0.5': r((1 / pU05) * MARGIN),
      'O1.5': r((1 / pO15) * MARGIN),
      'U1.5': r((1 / pU15) * MARGIN),
      'O2.5': ov,
      'U2.5': un,
      'O3.5': r((1 / pO35) * MARGIN),
      'U3.5': r((1 / pU35) * MARGIN),
    },
    esito_1t: { '1': r((1 / pH1) * MARGIN), 'X': r((1 / pD1) * MARGIN), '2': r((1 / pA1) * MARGIN) },
    over_under_1t: { 'OVER': r((1 / pOv1) * MARGIN), 'UNDER': r((1 / pUn1) * MARGIN) },
    goal_nogoal_1t: { 'GG': r((1 / pGG1) * MARGIN), 'NG': r((1 / pNG1) * MARGIN) },
  };
}

// Genera odds per tutte le partite di una giornata
export function generateMatchdayOdds(
  matches: { id: string; homeTeam: { id: string }; awayTeam: { id: string } }[]
): Record<string, MatchOdds> {
  return Object.fromEntries(
    matches.map(m => [m.id, generateMatchOdds(m.homeTeam.id, m.awayTeam.id)])
  );
}
