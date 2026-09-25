// ============================================
// FANTASCHEDINA FUNCTIONS - REGOLE DEI DUELLI RIGORI
// Logica pura della sequenza dei tiri: chi tira in un dato round e quando la
// partita può chiudersi. Isolata qui perché è la regola che decide chi vince.
// ============================================

export type DuelMode = 'human' | 'botAttacker' | 'botKeeper' | 'botAlternate';

/** Tiri regolari a testa, in ogni modalità. */
const TIRI_A_TESTA = 5;

/**
 * Modalità in cui i due giocatori si alternano al tiro fin dal primo round,
 * come in una vera serie di rigori. Nelle altre (contro il bot) si tirano
 * prima i cinque di uno e poi i cinque dell'altro.
 */
export function isAlternata(mode: DuelMode): boolean {
  return mode === 'human' || mode === 'botAlternate';
}

/**
 * Tiri della fase regolare: cinque a testa in tutte le modalità.
 *
 * Fino al 25/09/2026 botAttacker e botKeeper giocavano cinque round in tutto:
 * in "Tu tiri" il giocatore tirava cinque rigori e il bot uno solo, e la
 * vittoria (50 gettoni) era quasi garantita. Il bot segue le stesse regole di
 * un giocatore: stesso numero di tiri.
 */
export function totalRegularRounds(_mode: DuelMode): number {
  return TIRI_A_TESTA * 2;
}

export function attackerForRound(round: number, mode: DuelMode): 1 | 2 {
  // botAttacker: il giocatore tira i suoi cinque, poi il bot i suoi cinque;
  // botKeeper al contrario. Allo spareggio si alterna, chi ha aperto tira per primo.
  if (mode === 'botAttacker' || mode === 'botKeeper') {
    const primo: 1 | 2 = mode === 'botAttacker' ? 1 : 2;
    const secondo: 1 | 2 = primo === 1 ? 2 : 1;
    if (round <= TIRI_A_TESTA) return primo;
    if (round <= TIRI_A_TESTA * 2) return secondo;
    return round % 2 === 1 ? primo : secondo;
  }
  return round % 2 === 1 ? 1 : 2;
}

/**
 * Round in cui il punteggio può decidere la partita.
 *
 * Si confronta solo quando entrambi hanno tirato lo stesso numero di volte:
 * alla fine dei tiri regolari e poi a ogni coppia di spareggio. Prima si
 * controllava a round dispari dopo i regolari, il che significava due cose
 * sbagliate: la fase regolare non decideva mai la sfida (anche 5-2 andava
 * allo spareggio) e lo spareggio si chiudeva dopo il tiro di uno solo dei
 * due, senza lasciare rispondere l'altro.
 */
export function canFinishAtRound(round: number, mode: DuelMode): boolean {
  const regular = totalRegularRounds(mode);
  if (round < regular) return false;
  return (round - regular) % 2 === 0;
}

/** Quante volte ha tirato un giocatore dopo `round` round giocati. */
export function shotsTaken(round: number, mode: DuelMode, player: 1 | 2): number {
  let n = 0;
  for (let r = 1; r <= round; r++) {
    if (attackerForRound(r, mode) === player) n++;
  }
  return n;
}
