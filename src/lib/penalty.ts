// ============================================
// FANTA SCHEDINA - PENALTY ENGINE (client shared)
// Zone di mira, layout griglia e traiettorie condivise tra
// RigoriPage e Sfide1v1Page. Speculare a functions/src/penalty.ts.
// ============================================

export type PenaltyZone = 'TL' | 'TC' | 'TR' | 'BL' | 'BC' | 'BR';

export const PENALTY_ZONES: PenaltyZone[] = ['TL', 'TC', 'TR', 'BL', 'BC', 'BR'];

export interface ZoneMeta {
  zone: PenaltyZone;
  label: string;
  /** posizione in griglia css (row/col) sulla porta */
  row: 0 | 1;
  col: 0 | 1 | 2;
}

export const ZONE_LAYOUT: ZoneMeta[] = [
  { zone: 'TL', label: 'Alto Sx', row: 0, col: 0 },
  { zone: 'TC', label: 'Alto Centro', row: 0, col: 1 },
  { zone: 'TR', label: 'Alto Dx', row: 0, col: 2 },
  { zone: 'BL', label: 'Basso Sx', row: 1, col: 0 },
  { zone: 'BC', label: 'Basso Centro', row: 1, col: 1 },
  { zone: 'BR', label: 'Basso Dx', row: 1, col: 2 },
];

/** Traiettoria della palla (offset finale rispetto al dischetto) per zona. */
export const BALL_FLY: Record<PenaltyZone, { x: string; y: string }> = {
  TL: { x: '-78px', y: '-108px' },
  TC: { x: '0px', y: '-112px' },
  TR: { x: '78px', y: '-108px' },
  BL: { x: '-70px', y: '-58px' },
  BC: { x: '0px', y: '-52px' },
  BR: { x: '70px', y: '-58px' },
};

/** Tuffo del portiere (offset + rotazione) per zona "letta". */
export const KEEPER_DIVE: Record<PenaltyZone, { x: string; y: string; r: string }> = {
  TL: { x: '-74px', y: '-16px', r: '-30deg' },
  TC: { x: '0px', y: '-20px', r: '0deg' },
  TR: { x: '74px', y: '-16px', r: '30deg' },
  BL: { x: '-62px', y: '2px', r: '-18deg' },
  BC: { x: '0px', y: '4px', r: '0deg' },
  BR: { x: '62px', y: '2px', r: '18deg' },
};

/**
 * Rischio/rendimento per zona, solo a scopo di indicazione UI (badge):
 * "alto" = angoli, più difficili da centrare ma quasi imparabili;
 * "basso" = centro, facile da colpire ma il portiere lo copre meglio.
 */
export const ZONE_RISK: Record<PenaltyZone, 'alto' | 'medio' | 'basso'> = {
  TL: 'alto', TR: 'alto',
  BL: 'medio', BR: 'medio',
  TC: 'basso', BC: 'basso',
};
