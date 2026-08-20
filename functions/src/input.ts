// ============================================
// FANTASCHEDINA FUNCTIONS - INPUT DEL CLIENT
// I payload delle callable arrivano da fuori: qualunque campo numerico può
// essere una stringa, null, o NaN. Un NaN che arriva a FieldValue.increment
// non fallisce: scrive NaN sul saldo e lo rende irrecuperabile.
// ============================================

/**
 * Intero preso da un payload non fidato, riportato dentro [min, max].
 *
 * Accetta solo numeri e stringhe numeriche: tutto il resto vale `min`. La
 * coercizione automatica di JavaScript non va bene qui — `Number(null)` e
 * `Number([])` valgono 0, `Number(true)` vale 1, e un campo assente
 * diventerebbe silenziosamente un risultato di gioco valido.
 */
export function intInRange(value: unknown, min: number, max: number): number {
  const raw =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  const n = Math.floor(raw);
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
