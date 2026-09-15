// ============================================
// FANTA SCHEDINA - PENALTY ENGINE (client shared)
// Zone di mira, geometria della porta ed esiti condivisi tra Rigori Duello e
// Sfide 1v1. Speculare a functions/src/penalty.ts: il server decide, qui si
// disegna.
// ============================================

export type PenaltyZone = 'TL' | 'TC' | 'TR' | 'BL' | 'BC' | 'BR';

export const PENALTY_ZONES: PenaltyZone[] = ['TL', 'TC', 'TR', 'BL', 'BC', 'BR'];

/** Come e' finito un rigore del duello (nelle sfide esistono solo gol e parata). */
export type PenaltyOutcome = 'goal' | 'saved' | 'miss' | 'post';

export interface ZoneMeta {
  zone: PenaltyZone;
  label: string;
  /** Nome breve per i riepiloghi ("alto sx"). */
  short: string;
  row: 0 | 1;
  col: 0 | 1 | 2;
}

export const ZONE_LAYOUT: ZoneMeta[] = [
  { zone: 'TL', label: 'Alto a sinistra', short: 'alto sx', row: 0, col: 0 },
  { zone: 'TC', label: 'Alto al centro', short: 'alto centro', row: 0, col: 1 },
  { zone: 'TR', label: 'Alto a destra', short: 'alto dx', row: 0, col: 2 },
  { zone: 'BL', label: 'Basso a sinistra', short: 'basso sx', row: 1, col: 0 },
  { zone: 'BC', label: 'Basso al centro', short: 'basso centro', row: 1, col: 1 },
  { zone: 'BR', label: 'Basso a destra', short: 'basso dx', row: 1, col: 2 },
];

export const ZONE_META: Record<PenaltyZone, ZoneMeta> = Object.fromEntries(
  ZONE_LAYOUT.map(z => [z.zone, z])
) as Record<PenaltyZone, ZoneMeta>;

/**
 * Rischio/rendimento per zona, solo a scopo di indicazione UI (badge):
 * "alto" = angoli alti, imparabili se centrati ma facili da sbagliare;
 * "basso" = centro, difficile da sbagliare ma il portiere lo copre meglio.
 */
export const ZONE_RISK: Record<PenaltyZone, 'alto' | 'medio' | 'basso'> = {
  TL: 'alto', TR: 'alto',
  BL: 'medio', BR: 'medio',
  TC: 'basso', BC: 'basso',
};

// ---------- Geometria dell'arena (viewBox 400x300) ----------
// 15/09/2026: porta piu' grande (260x123) e portiere in proporzione (circa il
// 70% dell'altezza della traversa, come dal vero). Palla e tuffo vanno sempre
// nella direzione della zona scelta: fuori e palo restano su quel lato.

/** Riquadro interno della porta nel viewBox: pali a x=70/330, traversa y=62, linea y=185. */
export const GOAL = { left: 70, right: 330, top: 62, bottom: 185 } as const;

/** Dischetto del rigore. */
export const SPOT = { x: 200, y: 262 } as const;

/** Punto d'arrivo della palla per ogni zona (dentro la porta). */
export const ZONE_POINT: Record<PenaltyZone, { x: number; y: number }> = {
  TL: { x: 110, y: 92 },
  TC: { x: 200, y: 88 },
  TR: { x: 290, y: 92 },
  BL: { x: 110, y: 160 },
  BC: { x: 200, y: 164 },
  BR: { x: 290, y: 160 },
};

/** Dove va la palla quando esce: appena fuori dal palo o sopra la traversa, dallo stesso lato e alla stessa altezza. */
export const MISS_POINT: Record<PenaltyZone, { x: number; y: number }> = {
  TL: { x: 44, y: 78 },
  TC: { x: 200, y: 34 },
  TR: { x: 356, y: 78 },
  BL: { x: 42, y: 162 },
  BC: { x: 200, y: 34 },
  BR: { x: 358, y: 162 },
};

/** Dove colpisce il legno: il palo dal lato scelto, la traversa al centro. */
export const POST_POINT: Record<PenaltyZone, { x: number; y: number }> = {
  TL: { x: 73, y: 80 },
  TC: { x: 200, y: 64 },
  TR: { x: 327, y: 80 },
  BL: { x: 72, y: 160 },
  BC: { x: 200, y: 64 },
  BR: { x: 328, y: 160 },
};

/** Punto d'arrivo della palla in base all'esito. */
export function ballTarget(zone: PenaltyZone, outcome: PenaltyOutcome): { x: number; y: number } {
  if (outcome === 'miss') return MISS_POINT[zone];
  if (outcome === 'post') return POST_POINT[zone];
  return ZONE_POINT[zone];
}

/**
 * Tuffo del portiere per zona: spostamento (unita' del viewBox), rotazione
 * del corpo e angoli delle braccia. Il portiere parte in piedi al centro
 * della linea, alto circa 86 unita'.
 */
export interface KeeperPose {
  x: number;
  y: number;
  rot: number;
  armL: number;
  armR: number;
}

export const KEEPER_IDLE: KeeperPose = { x: 0, y: 0, rot: 0, armL: 40, armR: -40 };

export const KEEPER_DIVE: Record<PenaltyZone, KeeperPose> = {
  TL: { x: -76, y: -50, rot: -62, armL: 168, armR: 150 },
  TC: { x: 0, y: -42, rot: 0, armL: 174, armR: -174 },
  TR: { x: 76, y: -50, rot: 62, armL: -150, armR: -168 },
  BL: { x: -74, y: -6, rot: -86, armL: 118, armR: 100 },
  BC: { x: 0, y: 10, rot: 0, armL: 58, armR: -58 },
  BR: { x: 74, y: -6, rot: 86, armL: -100, armR: -118 },
};

/**
 * Zona verso cui si tuffa il portiere nella scena: in caso di parata e'
 * sempre quella del tiro (una parata dall'altra parte non esiste).
 */
export function keeperZoneFor(shot: PenaltyZone, keeper: PenaltyZone, outcome: PenaltyOutcome): PenaltyZone {
  return outcome === 'saved' ? shot : keeper;
}

/** Testo dell'esito, per l'arena e per i riepiloghi. */
export const OUTCOME_LABEL: Record<PenaltyOutcome, string> = {
  goal: 'GOOOL!',
  saved: 'PARATA!',
  post: 'PALO!',
  miss: 'FUORI!',
};

export const OUTCOME_EMOJI: Record<PenaltyOutcome, string> = {
  goal: '⚽',
  saved: '🧤',
  post: '🥅',
  miss: '💨',
};
