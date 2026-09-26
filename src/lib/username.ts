// ============================================
// USERNAME — formato e normalizzazione
//
// Lo username compare in classifiche, leghe e duelli: lettere senza accenti,
// numeri, "_" e ".", da 3 a 20 caratteri. Deve restare uguale alla regola in
// firestore.rules (`usernameValido`), che e' quella che conta davvero.
// L'unicita' (senza distinguere maiuscole e minuscole) la garantisce la
// collezione `usernames`, un documento per nome in minuscolo.
// ============================================

export const USERNAME_RE = /^[A-Za-z0-9_.]{3,20}$/;

export const USERNAME_REGOLA = 'Da 3 a 20 caratteri: lettere, numeri, _ e .';

/** Vero se lo username rispetta il formato. */
export function usernameValido(value: string): boolean {
  return USERNAME_RE.test(value);
}

/** Chiave della prenotazione in `usernames`: unica senza badare alle maiuscole. */
export function chiaveUsername(value: string): string {
  return value.toLowerCase();
}

/**
 * Porta un nome qualsiasi (es. il displayName di Google, "Mario Rossì") al
 * formato ammesso: spazi in "_", accenti tolti, il resto scartato.
 */
export function normalizzaUsername(value: string | null | undefined): string {
  const pulito = (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_.]/g, '')
    .slice(0, 20);
  return pulito.length >= 3 ? pulito : 'player';
}

/** Variante con suffisso numerico, per quando il nome e' gia' preso. */
export function conSuffisso(base: string, n: number): string {
  const coda = `_${n}`;
  return `${base.slice(0, 20 - coda.length)}${coda}`;
}
