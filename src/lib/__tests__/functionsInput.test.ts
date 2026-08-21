// Sanificazione dei payload delle callable (functions/src/input.ts).
//
// Il caso che conta davvero: `Number.isFinite` è l'unica barriera fra un campo
// numerico inventato dal client e `FieldValue.increment`. Un NaN che arriva
// fin lì non genera un errore, scrive NaN sul saldo dell'utente.
import { describe, it, expect } from 'vitest';
import { intInRange } from '../../../functions/src/input';

describe('intInRange — interi da payload non fidati', () => {
  it('lascia passare un intero già dentro l\'intervallo', () => {
    expect(intInRange(5, 0, 10)).toBe(5);
  });

  it('tronca verso il basso i decimali', () => {
    expect(intInRange(4.99, 0, 10)).toBe(4);
    expect(intInRange('7.5', 0, 10)).toBe(7);
  });

  it('riporta dentro i limiti i valori fuori scala', () => {
    expect(intInRange(9999, 0, 10)).toBe(10);
    expect(intInRange(-3, 0, 10)).toBe(0);
    expect(intInRange(Number.MAX_SAFE_INTEGER, 0, 135)).toBe(135);
  });

  it.each([
    ['NaN', NaN],
    ['stringa non numerica', 'abc'],
    ['undefined', undefined],
    ['null', null],
    ['oggetto', { a: 1 }],
    ['array', [1, 2]],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['booleano', true],
  ])('%s non diventa mai NaN', (_label, value) => {
    const r = intInRange(value, 0, 10);
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(10);
  });

  it('un valore non numerico vale il minimo, non il massimo', () => {
    expect(intInRange('abc', 0, 100)).toBe(0);
    expect(intInRange(NaN, 3, 100)).toBe(3);
  });

  it('non si fida della coercizione di JavaScript', () => {
    // Number(null) === 0 e Number(true) === 1: senza controllo di tipo, un
    // campo assente o un booleano diventerebbero un risultato di gioco valido.
    expect(intInRange(null, 2, 10)).toBe(2);
    expect(intInRange(true, 2, 10)).toBe(2);
    expect(intInRange([], 2, 10)).toBe(2);
    expect(intInRange('', 2, 10)).toBe(2);
  });
});
