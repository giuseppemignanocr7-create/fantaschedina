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

/** Riquadro interno della porta nel viewBox: pali a x=95/305, traversa y=88, linea y=178. */
export const GOAL = { left: 95, right: 305, top: 88, bottom: 178 } as const;

/** Dischetto del rigore. */
export const SPOT = { x: 200, y: 262 } as const;

/** Punto d'arrivo della palla per ogni zona (dentro la porta). */
export const ZONE_POINT: Record<PenaltyZone, { x: number; y: number }> = {
  TL: { x: 130, y: 110 },
  TC: { x: 200, y: 108 },
  TR: { x: 270, y: 110 },
  BL: { x: 130, y: 156 },
  BC: { x: 200, y: 158 },
  BR: { x: 270, y: 156 },
};

/** Dove va la palla quando esce (fuori) o colpisce il legno (palo/traversa). */
export const MISS_POINT: Record<PenaltyZone, { x: number; y: number }> = {
  TL: { x: 66, y: 56 },
  TC: { x: 200, y: 44 },
  TR: { x: 334, y: 56 },
  BL: { x: 60, y: 150 },
  BC: { x: 200, y: 52 },
  BR: { x: 340, y: 150 },
};

export const POST_POINT: Record<PenaltyZone, { x: number; y: number }> = {
  TL: { x: 99, y: 94 },
  TC: { x: 200, y: 90 },
  TR: { x: 301, y: 94 },
  BL: { x: 98, y: 152 },
  BC: { x: 200, y: 90 },
  BR: { x: 302, y: 152 },
};

/** Punto d'arrivo della palla in base all'esito. */
export function ballTarget(zone: PenaltyZone, outcome: PenaltyOutcome): { x: number; y: number } {
  if (outcome === 'miss') return MISS_POINT[zone];
  if (outcome === 'post') return POST_POINT[zone];
  return ZONE_POINT[zone];
}

/**
 * Tuffo del portiere per zona: spostamento (unita' del viewBox), rotazione
 * del corpo e angoli delle braccia. Il portiere parte in piedi al centro.
 */
export interface KeeperPose {
  x: number;
  y: number;
  rot: number;
  armL: number;
  armR: number;
}

export const KEEPER_IDLE: KeeperPose = { x: 0, y: 0, rot: 0, armL: 38, armR: -38 };

export const KEEPER_DIVE: Record<PenaltyZone, KeeperPose> = {
  TL: { x: -60, y: -34, rot: -62, armL: 165, armR: 150 },
  TC: { x: 0, y: -30, rot: 0, armL: 172, armR: -172 },
  TR: { x: 60, y: -34, rot: 62, armL: -150, armR: -165 },
  BL: { x: -58, y: -4, rot: -84, armL: 120, armR: 100 },
  BC: { x: 0, y: 8, rot: 0, armL: 62, armR: -62 },
  BR: { x: 58, y: -4, rot: 84, armL: -100, armR: -120 },
};

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
