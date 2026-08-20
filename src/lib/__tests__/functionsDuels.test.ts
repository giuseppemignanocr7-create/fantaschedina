// Regole di sequenza dei duelli rigori (functions/src/duels.ts).
//
// Regressione: la partita poteva chiudersi solo a round dispari dopo i tiri
// regolari. Nelle sfide alternate significava che 5-2 dopo dieci tiri non
// decideva nulla, e che lo spareggio si chiudeva dopo il tiro di uno solo
// dei due giocatori.
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
const ASIMMETRICHE: DuelMode[] = ['botAttacker', 'botKeeper'];

describe('sequenza dei tiri', () => {
  it.each(ALTERNATE)('%s: i due si alternano dal primo round', mode => {
    expect([1, 2, 3, 4].map(r => attackerForRound(r, mode))).toEqual([1, 2, 1, 2]);
  });

  it('botAttacker: il giocatore tira i primi cinque', () => {
    expect([1, 2, 3, 4, 5].map(r => attackerForRound(r, 'botAttacker'))).toEqual([1, 1, 1, 1, 1]);
  });

  it('botKeeper: il bot tira i primi cinque', () => {
    expect([1, 2, 3, 4, 5].map(r => attackerForRound(r, 'botKeeper'))).toEqual([2, 2, 2, 2, 2]);
  });

  it.each(ALTERNATE)('%s: dieci round regolari, cinque tiri a testa', mode => {
    expect(totalRegularRounds(mode)).toBe(10);
    expect(shotsTaken(10, mode, 1)).toBe(5);
    expect(shotsTaken(10, mode, 2)).toBe(5);
  });
});

describe('canFinishAtRound — sfide alternate', () => {
  it.each(ALTERNATE)('%s: non si chiude prima dei tiri regolari', mode => {
    for (let r = 1; r <= 9; r++) {
      expect(canFinishAtRound(r, mode)).toBe(false);
    }
  });

  it.each(ALTERNATE)('%s: REGRESSIONE — i tiri regolari possono decidere la partita', mode => {
    expect(canFinishAtRound(10, mode)).toBe(true);
  });

  it.each(ALTERNATE)('%s: lo spareggio si valuta a coppie, non dopo un tiro solo', mode => {
    expect(canFinishAtRound(11, mode)).toBe(false);
    expect(canFinishAtRound(12, mode)).toBe(true);
    expect(canFinishAtRound(13, mode)).toBe(false);
    expect(canFinishAtRound(14, mode)).toBe(true);
  });

  it.each(ALTERNATE)(
    '%s: INVARIANTE — quando la partita può chiudersi, i due hanno tirato lo stesso numero di volte',
    mode => {
      for (let r = 1; r <= 40; r++) {
        if (!canFinishAtRound(r, mode)) continue;
        expect(shotsTaken(r, mode, 1)).toBe(shotsTaken(r, mode, 2));
      }
    }
  );
});

describe('canFinishAtRound — modalità asimmetriche', () => {
  it.each(ASIMMETRICHE)('%s: cinque round regolari', mode => {
    expect(totalRegularRounds(mode)).toBe(5);
    expect(isAlternata(mode)).toBe(false);
  });

  it.each(ASIMMETRICHE)('%s: comportamento invariato rispetto a prima', mode => {
    expect(canFinishAtRound(4, mode)).toBe(false);
    expect(canFinishAtRound(5, mode)).toBe(false);
    expect(canFinishAtRound(6, mode)).toBe(true);
    expect(canFinishAtRound(7, mode)).toBe(false);
    expect(canFinishAtRound(8, mode)).toBe(true);
  });
});
