// ============================================
// FANTASCHEDINA FUNCTIONS - PENALTY ENGINE (server-side)
// Meccanica rigori a 6 zone (mira) + potenza/precisione (timing).
// Sostituisce il vecchio schema L/C/R a probabilità fissa 2/3.
// Allineato a src/lib/penalty.ts (tipi/costanti condivise col client).
// ============================================

import { secureChance, securePick, secureUnit } from './random';

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
  return securePick(PENALTY_ZONES);
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
  let keeper = randomZone();
  const base = ZONE_BASE_CHANCE[zone] ?? 0.55;
  const precisionFactor = 0.55 + (clampedPower / 100) * 0.6; // 0.55 → 1.15
  let chance = base * precisionFactor;
  if (keeper === zone) chance *= 0.45; // il portiere ha indovinato la zona
  chance = Math.max(0.05, Math.min(0.95, chance));
  const goal = secureChance(chance);
  // Una parata e' sempre del portiere sulla palla: se non e' gol, il tuffo
  // e' sulla zona del tiro (15/09/2026: "tiro a destra, si tuffa a sinistra e
  // dice parata" non deve succedere).
  if (!goal) keeper = zone;
  return { shot: zone, keeper, goal, power: clampedPower };
}

/**
 * Simula il tiro di un avversario "CPU" nelle Sfide 1v1, con qualità legata
 * alle sue statistiche reali (non più puro random): un giocatore con più
 * pronostici corretti tira meglio (più angoli, più precisione media).
 */
export function simulateOpponentShot(skillLevel: number): ShotInput {
  const skill = Math.max(0, Math.min(1, skillLevel));
  const goesForCorner = secureChance(0.25 + skill * 0.45);
  const pool: PenaltyZone[] = goesForCorner ? ['TL', 'TR', 'BL', 'BR'] : ['TC', 'BC'];
  const zone = securePick(pool);
  const power = Math.max(0, Math.min(100, 35 + skill * 45 + secureUnit() * 20));
  return { zone, power };
}

/** Stima 0-1 dell'abilità di un profilo dalle statistiche reali (per l'avversario CPU). */
export function estimateSkillFromProfile(correctPredictions: number, matchdaysPlayed: number): number {
  if (matchdaysPlayed <= 0) return 0.4; // baseline per profili nuovi
  const accuracy = correctPredictions / (matchdaysPlayed * 10);
  return Math.max(0, Math.min(1, accuracy));
}

// ============================================
// RIGORI DUELLO (1v1 in tempo reale): il portiere e' un giocatore vero (o il
// bot) che sceglie una delle sei zone. L'esito non e' piu' "gol se non
// indovina": conta dove si tuffa rispetto al tiro e quanto bene e' stato
// calibrato il tiro (potenza dalla barra di timing). Un tiro tirato male
// puo' finire fuori o sul palo anche con il portiere dall'altra parte.
// ============================================

export type DuelOutcome = 'goal' | 'saved' | 'miss' | 'post';

export interface DuelShotResult {
  shot: PenaltyZone;
  keeper: PenaltyZone;
  power: number;
  goal: boolean;
  outcome: DuelOutcome;
}

export type ZoneColumn = 'L' | 'C' | 'R';
export type ZoneRow = 'T' | 'B';

export function zoneColumn(z: PenaltyZone): ZoneColumn {
  return z[1] as ZoneColumn;
}

export function zoneRow(z: PenaltyZone): ZoneRow {
  return z[0] as ZoneRow;
}

/**
 * Probabilita' che il tiro non prenda la porta (fuori o palo), per zona e
 * precisione: gli angoli alti sono i piu' difficili da centrare, il centro
 * basso non si sbaglia quasi mai.
 */
export function duelMissChance(zone: PenaltyZone, precision: number): number {
  const p = Math.max(0, Math.min(1, precision));
  const row = zoneRow(zone);
  const col = zoneColumn(zone);
  if (col === 'C') return row === 'T' ? 0.01 + 0.12 * (1 - p) : 0;
  return row === 'T' ? 0.03 + 0.30 * (1 - p) : 0.02 + 0.18 * (1 - p);
}

/**
 * Probabilita' di parata quando la palla e' in porta: dipende da quanto il
 * tuffo si avvicina alla zona del tiro. Stessa zona = quasi sempre parata,
 * stessa colonna ma altezza sbagliata = a volte (il portiere allunga il
 * braccio), colonna sbagliata = mai: chi si tuffa dall'altra parte non para.
 * Un tiro potente riduce ogni chance del portiere.
 */
export function duelSaveChance(shot: PenaltyZone, keeper: PenaltyZone, precision: number): number {
  const p = Math.max(0, Math.min(1, precision));
  if (shot === keeper) return 0.85 - 0.20 * p;
  if (zoneColumn(shot) === zoneColumn(keeper)) {
    // Al centro il portiere copre bene entrambe le altezze restando in piedi.
    return zoneColumn(shot) === 'C' ? 0.55 - 0.25 * p : 0.45 - 0.25 * p;
  }
  return 0;
}

/**
 * Risolve un rigore del duello: tiro (zona + potenza) contro tuffo (zona).
 * `precision` = potenza/100: la barra di timing del client premia chi ferma
 * il cursore nel verde. Il server non si fida del valore e lo vincola.
 */
export function resolveDuelShot(zone: PenaltyZone, power: number, keeper: PenaltyZone): DuelShotResult {
  const clampedPower = Math.max(0, Math.min(100, Math.round(Number.isFinite(power) ? power : 0)));
  const precision = clampedPower / 100;

  if (secureChance(duelMissChance(zone, precision))) {
    const outcome: DuelOutcome = secureChance(0.4) ? 'post' : 'miss';
    return { shot: zone, keeper, power: clampedPower, goal: false, outcome };
  }
  if (secureChance(duelSaveChance(zone, keeper, precision))) {
    return { shot: zone, keeper, power: clampedPower, goal: false, outcome: 'saved' };
  }
  return { shot: zone, keeper, power: clampedPower, goal: true, outcome: 'goal' };
}

/** Il bot al tiro: cerca gli angoli ma non e' infallibile con la potenza. */
export function botDuelShot(): ShotInput {
  const pool: PenaltyZone[] = ['TL', 'TR', 'BL', 'BR', 'BL', 'BR', 'TC', 'BC'];
  const zone = securePick(pool);
  const power = Math.round(45 + secureUnit() * 50);
  return { zone, power };
}

/** Il bot in porta: si tuffa piu' spesso ai lati e piu' spesso in basso. */
export function botDuelKeeper(): PenaltyZone {
  const pool: PenaltyZone[] = ['BL', 'BR', 'BL', 'BR', 'TL', 'TR', 'BC', 'TC', 'BC'];
  return securePick(pool);
}

/**
 * Le vecchie tre direzioni del duello (client precedenti al 15/09/2026 o
 * partite ancora in corso al momento del deploy) si mappano sulle zone basse.
 */
export function zoneFromLegacyTarget(t: unknown): PenaltyZone | null {
  if (isValidZone(t)) return t;
  if (t === 'left') return 'BL';
  if (t === 'center') return 'BC';
  if (t === 'right') return 'BR';
  return null;
}
