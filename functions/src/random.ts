// ============================================
// FANTASCHEDINA FUNCTIONS - RANDOMNESS SICURA
//
// `Math.random()` in V8 usa xorshift128+ : la sequenza è deterministica e,
// osservando abbastanza estrazioni, lo stato interno è ricostruibile e gli
// esiti futuri diventano prevedibili. Per un gioco in cui l'esito assegna
// gettoni (ruota, rigori, ordine delle domande del quiz) questo è un canale
// di abuso reale, non teorico.
//
// Tutte le estrazioni che influenzano l'economia devono passare da qui.
// ============================================

import { randomInt } from 'node:crypto';

/** Intero uniforme in [0, maxExclusive). */
export function secureIndex(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
    throw new RangeError(`secureIndex: maxExclusive non valido (${maxExclusive})`);
  }
  return randomInt(maxExclusive);
}

/**
 * Float uniforme in [0, 1), equivalente sicuro di Math.random().
 *
 * `randomInt` accetta al massimo un intervallo di 2^48 - 1: usare 2^48 tondo
 * fa lanciare RangeError. Dividendo per lo stesso valore massimo il risultato
 * resta strettamente minore di 1, perché l'estrazione più alta è RESOLUTION-1.
 */
export function secureUnit(): number {
  const RESOLUTION = 2 ** 48 - 1; // 281_474_976_710_655
  return randomInt(RESOLUTION) / RESOLUTION;
}

/** Elemento casuale di un array non vuoto. */
export function securePick<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new RangeError('securePick: array vuoto');
  }
  return items[secureIndex(items.length)];
}

/** Esito booleano con la probabilità indicata (0-1). */
export function secureChance(probability: number): boolean {
  return secureUnit() < probability;
}

/** Fisher-Yates con sorgente crittografica. Non muta l'array originale. */
export function secureShuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = secureIndex(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
