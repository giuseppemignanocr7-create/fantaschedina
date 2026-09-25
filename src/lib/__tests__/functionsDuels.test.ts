// Regole di sequenza dei duelli rigori (functions/src/duels.ts).
//
// Regressione: la partita poteva chiudersi solo a round dispari dopo i tiri
// regolari. Nelle sfide alternate significava che 5-2 dopo dieci tiri non
// decideva nulla, e che lo spareggio si chiudeva dopo il tiro di uno solo
// dei due giocatori.
//
// Regressione (25/09/2026): contro il bot in "Tu tiri" / "Tu pari" i tiri non
// erano simmetrici (cinque contro uno). Il bot tira quanto un giocatore.
import { describe, it, expect } from 'vitest';
import {
  attackerForRound,
  canFinishAtRound,
  isAlternata,
  shotsTaken,
  totalRegularRounds,
  type DuelMode,
} from '../../../functions/src/duels';

const ALTERNATE: DuelMode[] = ['human', 'botAlternate'];
const A_BLOCCHI: DuelMode[] = ['botAttacker', 'botKeeper'];
const TUTTE: DuelMode[] = [...ALTERNATE, ...A_BLOCCHI];

describe('sequenza dei tiri', () => {
  it.each(ALTERNATE)('%s: i due si alternano dal primo round', mode => {
    expect([1, 2, 3, 4].map(r => attackerForRound(r, mode))).toEqual([1, 2, 1, 2]);
    expect(isAlternata(mode)).toBe(true);
  });

  it('botAttacker: il giocatore tira i primi cinque, poi il bot i suoi cinque', () => {
    expect([1, 2, 3, 4, 5].map(r => attackerForRound(r, 'botAttacker'))).toEqual([1, 1, 1, 1, 1]);
    expect([6, 7, 8, 9, 10].map(r => attackerForRound(r, 'botAttacker'))).toEqual([2, 2, 2, 2, 2]);
    expect([11, 12, 13, 14].map(r => attackerForRound(r, 'botAttacker'))).toEqual([1, 2, 1, 2]);
    expect(isAlternata('botAttacker')).toBe(false);
  });

  it('botKeeper: il bot tira i primi cinque, poi il giocatore i suoi cinque', () => {
    expect([1, 2, 3, 4, 5].map(r => attackerForRound(r, 'botKeeper'))).toEqual([2, 2, 2, 2, 2]);
    expect([6, 7, 8, 9, 10].map(r => attackerForRound(r, 'botKeeper'))).toEqual([1, 1, 1, 1, 1]);
    expect([11, 12, 13, 14].map(r => attackerForRound(r, 'botKeeper'))).toEqual([2, 1, 2, 1]);
  });

  it.each(TUTTE)('%s: dieci round regolari, cinque tiri a testa', mode => {
    expect(totalRegularRounds(mode)).toBe(10);
    expect(shotsTaken(10, mode, 1)).toBe(5);
    expect(shotsTaken(10, mode, 2)).toBe(5);
  });
});

describe('canFinishAtRound', () => {
  it.each(TUTTE)('%s: non si chiude prima dei tiri regolari', mode => {
    for (let r = 1; r <= 9; r++) {
      expect(canFinishAtRound(r, mode)).toBe(false);
    }
  });

  it.each(TUTTE)('%s: REGRESSIONE — i tiri regolari possono decidere la partita', mode => {
    expect(canFinishAtRound(10, mode)).toBe(true);
  });

  it.each(TUTTE)('%s: lo spareggio si valuta a coppie, non dopo un tiro solo', mode => {
    expect(canFinishAtRound(11, mode)).toBe(false);
    expect(canFinishAtRound(12, mode)).toBe(true);
    expect(canFinishAtRound(13, mode)).toBe(false);
    expect(canFinishAtRound(14, mode)).toBe(true);
  });

  it.each(TUTTE)(
    '%s: INVARIANTE — quando la partita può chiudersi, i due hanno tirato lo stesso numero di volte',
    mode => {
      for (let r = 1; r <= 40; r++) {
        if (!canFinishAtRound(r, mode)) continue;
        expect(shotsTaken(r, mode, 1)).toBe(shotsTaken(r, mode, 2));
      }
    }
  );
});
