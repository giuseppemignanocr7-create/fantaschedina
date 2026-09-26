// ============================================
// ANTEPRIMA PUNTI DELLA SCHEDINA IN COMPILAZIONE
// Quanto vale la schedina se i pronostici vanno tutti a segno, con le
// stesse regole del server (functions/src/scoring.ts): quota cappata × 10,
// Jolly che raddoppia una giocata, penalita' quote basse annullata dallo
// Scudo, bonus in punti pieni.
// ============================================

import type { Prediction } from '@/types';
import { POWERUPS, type PowerUpSelection } from './economy';
import {
  DEFAULT_TOURNAMENT_CONFIG,
  calculateBetPoints,
  calculatePenaltyPoints,
  countPenaltyRangeBets,
} from './scoring';

/** Punti bonus: tutti i pronostici giusti / uno solo sbagliato. */
export const BONUS_TUTTI_GIUSTI = DEFAULT_TOURNAMENT_CONFIG.bonus10Points;
export const BONUS_UNO_SBAGLIATO = DEFAULT_TOURNAMENT_CONFIG.bonus9Points;

/** Il bonus "uno solo sbagliato" vale solo con schedine da almeno nove pronostici. */
export const MIN_RICHIESTE_BONUS_UNO_SBAGLIATO = 9;

/** Punti di un singolo pronostico indovinato (quota cappata × 10). */
export function puntiGiocata(quota: number): number {
  return Math.round(calculateBetPoints(quota, true));
}

/** Costo in gettoni di una selezione di power-up. */
export function costoPowerup(selection: PowerUpSelection | undefined): number {
  if (!selection) return 0;
  return (
    (selection.jolly ? POWERUPS.jolly.cost : 0) +
    (selection.shield ? POWERUPS.shield.cost : 0) +
    (selection.insurance ? POWERUPS.insurance.cost : 0)
  );
}

/**
 * Punti se tutti i pronostici scelti risultano giusti. Il bonus pieno si
 * conta solo a schedina completa (tutti i pronostici richiesti).
 */
export function puntiPotenziali(
  predictions: Prediction[],
  powerups: PowerUpSelection | undefined,
  richieste: number
): number {
  if (predictions.length === 0) return 0;
  const cfg = DEFAULT_TOURNAMENT_CONFIG;
  const base = predictions.reduce(
    (somma, p) =>
      somma + calculateBetPoints(p.odds, true, cfg) * (powerups?.jolly === p.matchId ? 2 : 1),
    0
  );
  const penalita = powerups?.shield
    ? 1
    : calculatePenaltyPoints(countPenaltyRangeBets(predictions, cfg), cfg);
  const completa = richieste > 0 && predictions.length === richieste;
  const bonus = completa ? BONUS_TUTTI_GIUSTI : 0;
  return Math.round((base * penalita + bonus) * 100) / 100;
}
