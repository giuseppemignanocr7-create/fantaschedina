// ============================================
// FANTASCHEDINA FUNCTIONS - CONTABILITÀ POWER-UP
// Logica pura del costo dei power-up allegati a una schedina, isolata qui
// perché è la parte che muove gettoni: deve essere testabile senza Firestore.
// ============================================

import { POWERUPS, PowerUpSelection } from './config';

/** Costo totale dei power-up di una selezione. */
export function powerupCost(selection: PowerUpSelection | undefined): number {
  const pu = selection ?? {};
  let cost = 0;
  if (pu.jolly) cost += POWERUPS.jolly.cost;
  if (pu.shield) cost += POWERUPS.shield.cost;
  if (pu.insurance) cost += POWERUPS.insurance.cost;
  return cost;
}

export interface PowerupCharge {
  /** Gettoni da restituire per i power-up della schedina precedente. */
  refund: number;
  /** Gettoni da addebitare per i power-up della schedina nuova. */
  charge: number;
  /** Effetto netto sul saldo: negativo = l'utente spende. */
  net: number;
}

/**
 * Rimborso e addebito per un (re)invio di schedina.
 *
 * Rimborso e addebito sono entrambi INTERI: due movimenti distinti, così il
 * registro `wallet_transactions` resta leggibile. Accreditare il rimborso
 * pieno e addebitare solo la differenza — come faceva la versione precedente —
 * regalava `2×refund − cost` gettoni a ogni modifica della schedina: con gli
 * stessi power-up (refund == cost) l'utente incassava l'intero costo a ogni
 * reinvio, dall'interfaccia normale.
 */
export function computePowerupCharge(
  previous: PowerUpSelection | undefined,
  next: PowerUpSelection | undefined
): PowerupCharge {
  const refund = powerupCost(previous);
  const charge = powerupCost(next);
  return { refund, charge, net: refund - charge };
}

/**
 * Finestra del Cambio Last-Minute su una singola partita: si apre alla
 * deadline della giornata e si chiude al fischio d'inizio di quella partita.
 *
 * Prima della deadline la schedina si rimanda gratis, quindi far pagare il
 * power-up lì sarebbe una truffa; dopo il fischio d'inizio si scommetterebbe
 * a partita in corso. Fuori da questi due estremi non c'è nulla da comprare.
 */
export function isLastMinuteWindowOpen(input: {
  now: number;
  deadline: number;
  matchStatus: string;
  matchKickoff: number;
}): boolean {
  const { now, deadline, matchStatus, matchKickoff } = input;
  if (now < deadline) return false;
  if (matchStatus !== 'scheduled') return false;
  return matchKickoff > now;
}
