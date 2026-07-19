// ============================================
// FANTASCHEDINA FUNCTIONS - PENALTY ENGINE (server-side)
// Meccanica rigori a 6 zone (mira) + potenza/precisione (timing).
// Sostituisce il vecchio schema L/C/R a probabilità fissa 2/3.
// Allineato a src/lib/penalty.ts (tipi/costanti condivise col client).
// ============================================

export type PenaltyZone = 'TL' | 'TC' | 'TR' | 'BL' | 'BC' | 'BR';

export const PENALTY_ZONES: PenaltyZone[] = ['TL', 'TC', 'TR', 'BL', 'BC', 'BR'];

export interface ShotInput {
  zone: PenaltyZone;
  power: number; // 0-100, da minigioco di timing lato client
}

export interface ShotResult {
  shot: PenaltyZone;
  keeper: PenaltyZone;
  goal: boolean;
  power: number;
}

// Probabilità base di gol per zona: gli angoli alti sono i più difficili da
// raggiungere per il portiere, il centro-basso il più facile da parare.
const ZONE_BASE_CHANCE: Record<PenaltyZone, number> = {
  TL: 0.80, TR: 0.80,
  BL: 0.68, BR: 0.68,
  TC: 0.45, BC: 0.40,
};

function randomZone(): PenaltyZone {
  return PENALTY_ZONES[Math.floor(Math.random() * PENALTY_ZONES.length)];
}

export function isValidZone(z: unknown): z is PenaltyZone {
  return typeof z === 'string' && (PENALTY_ZONES as string[]).includes(z);
}

/**
 * Risolve un singolo tiro. La zona scelta e la precisione (power, dal
 * minigioco di timing) determinano la probabilità reale di gol: angoli +
 * ottimo timing = alta probabilità; centro + timing scarso = bassa.
 * Il portiere ha comunque una chance di "leggere" la zona giusta.
 */
export function resolveShot(zone: PenaltyZone, power: number): ShotResult {
  const clampedPower = Math.max(0, Math.min(100, Math.round(power)));
  const keeper = randomZone();
  const base = ZONE_BASE_CHANCE[zone] ?? 0.55;
  const precisionFactor = 0.55 + (clampedPower / 100) * 0.6; // 0.55 → 1.15
  let chance = base * precisionFactor;
  if (keeper === zone) chance *= 0.45; // il portiere ha indovinato la zona
  chance = Math.max(0.05, Math.min(0.95, chance));
  const goal = Math.random() < chance;
  return { shot: zone, keeper, goal, power: clampedPower };
}

/**
 * Simula il tiro di un avversario "CPU" nelle Sfide 1v1, con qualità legata
 * alle sue statistiche reali (non più puro random): un giocatore con più
 * pronostici corretti tira meglio (più angoli, più precisione media).
 */
export function simulateOpponentShot(skillLevel: number): ShotInput {
  const skill = Math.max(0, Math.min(1, skillLevel));
  const goesForCorner = Math.random() < 0.25 + skill * 0.45;
  const pool: PenaltyZone[] = goesForCorner ? ['TL', 'TR', 'BL', 'BR'] : ['TC', 'BC'];
  const zone = pool[Math.floor(Math.random() * pool.length)];
  const power = Math.max(0, Math.min(100, 35 + skill * 45 + Math.random() * 20));
  return { zone, power };
}

/** Stima 0-1 dell'abilità di un profilo dalle statistiche reali (per l'avversario CPU). */
export function estimateSkillFromProfile(correctPredictions: number, matchdaysPlayed: number): number {
  if (matchdaysPlayed <= 0) return 0.4; // baseline per profili nuovi
  const accuracy = correctPredictions / (matchdaysPlayed * 10);
  return Math.max(0, Math.min(1, accuracy));
}
