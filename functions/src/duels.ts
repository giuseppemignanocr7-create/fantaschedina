// ============================================
// FANTASCHEDINA FUNCTIONS - REGOLE DEI DUELLI RIGORI
// Logica pura della sequenza dei tiri: chi tira in un dato round e quando la
// partita può chiudersi. Isolata qui perché è la regola che decide chi vince.
// ============================================

export type DuelMode = 'human' | 'botAttacker' | 'botKeeper' | 'botAlternate';

/**
 * Modalità in cui i due giocatori si alternano al tiro, come in una vera
 * serie di rigori. Le altre sono asimmetriche per disegno: uno tira sempre e
 * l'altro para sempre.
 */
export function isAlternata(mode: DuelMode): boolean {
  return mode === 'human' || mode === 'botAlternate';
}

/** Tiri della fase regolare: 5 a testa nelle alternate, 5 in tutto nelle altre. */
export function totalRegularRounds(mode: DuelMode): number {
  return isAlternata(mode) ? 10 : 5;
}

export function attackerForRound(round: number, mode: DuelMode): 1 | 2 {
  if (mode === 'botAttacker') {
    return round <= 5 ? 1 : round % 2 === 0 ? 2 : 1;
  }
  if (mode === 'botKeeper') {
    return round <= 5 ? 2 : round % 2 === 0 ? 1 : 2;
  }
  return round % 2 === 1 ? 1 : 2;
}

/**
 * Round in cui il punteggio può decidere la partita.
 *
 * Nelle sfide alternate si confronta solo quando entrambi hanno tirato lo
 * stesso numero di volte: alla fine dei tiri regolari e poi a ogni coppia di
 * spareggio. Prima si controllava a round dispari dopo i regolari, il che
 * significava due cose sbagliate: la fase regolare non decideva mai la sfida
 * (anche 5-2 andava allo spareggio) e lo spareggio si chiudeva dopo il tiro
 * di uno solo dei due, senza lasciare rispondere l'altro.
 *
 * Le modalità botAttacker/botKeeper restano com'erano: lì i due non tirano lo
 * stesso numero di volte per costruzione, quindi non esiste un momento "pari"
 * a cui agganciarsi.
 */
export function canFinishAtRound(round: number, mode: DuelMode): boolean {
  const regular = totalRegularRounds(mode);
  if (round < regular) return false;
  const offset = round - regular;
  return isAlternata(mode) ? offset % 2 === 0 : offset % 2 === 1;
}

/** Quante volte ha tirato un giocatore dopo `round` round giocati. */
export function shotsTaken(round: number, mode: DuelMode, player: 1 | 2): number {
  let n = 0;
  for (let r = 1; r <= round; r++) {
    if (attackerForRound(r, mode) === player) n++;
  }
  return n;
}
