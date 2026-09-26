// ============================================
// ESTRAZIONE DI GIORNATA — logica pura
//
// Ogni giornata un premio va a sorte fra chi ha comprato biglietti con i
// gettoni. Piu' biglietti, piu' probabilita': l'estrazione e' pesata sul
// numero di biglietti. Qui non c'e' Firestore: solo aritmetica, cosi' si
// prova con i test unitari e senza emulatore.
// ============================================

import { secureUnit } from './random';

export const RAFFLE = {
  /** Gettoni per un biglietto. */
  ticketCost: 100,
  /** Biglietti massimi per utente e giornata: un tetto contro chi accumula. */
  maxTicketsPerUser: 10,
} as const;

export interface RaffleEntry {
  uid: string;
  count: number;
}

/**
 * Sceglie il vincitore: ogni biglietto e' una pallina nell'urna.
 * `rnd` e' in [0, 1): iniettabile per i test; in produzione e' crittografico
 * (crypto.randomInt, vedi random.ts), perche' Math.random e' prevedibile.
 * Con nessun biglietto valido non c'e' vincitore.
 */
export function estraiVincitore(entries: RaffleEntry[], rnd: () => number = secureUnit): string | null {
  const valide = entries.filter(e => Number.isInteger(e.count) && e.count > 0 && !!e.uid);
  const totale = valide.reduce((s, e) => s + e.count, 0);
  if (totale === 0) return null;
  let soglia = Math.floor(rnd() * totale);
  if (soglia < 0) soglia = 0;
  if (soglia >= totale) soglia = totale - 1;
  for (const e of valide) {
    if (soglia < e.count) return e.uid;
    soglia -= e.count;
  }
  return valide[valide.length - 1].uid;
}

/** Quanti biglietti si possono ancora comprare, dato quanti se ne hanno. */
export function bigliettiAcquistabili(giaPosseduti: number, richiesti: number): number {
  if (!Number.isInteger(richiesti) || richiesti <= 0) return 0;
  const spazio = RAFFLE.maxTicketsPerUser - Math.max(0, giaPosseduti);
  return Math.max(0, Math.min(richiesti, spazio));
}
