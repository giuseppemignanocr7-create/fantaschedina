import { describe, expect, it } from 'vitest';
import { RAFFLE, bigliettiAcquistabili, estraiVincitore } from '../../../functions/src/raffle';

// L'estrazione pesa ogni biglietto allo stesso modo: con 3 biglietti su 4
// si vince 3 volte su 4, ne' una in piu' ne' una in meno. E chi ha zero
// biglietti non puo' vincere per un arrotondamento.
describe('estraiVincitore', () => {
  const urna = [
    { uid: 'a', count: 1 },
    { uid: 'b', count: 3 },
  ];

  it('ogni biglietto e’ una pallina: il numero casuale cade sul proprietario giusto', () => {
    expect(estraiVincitore(urna, () => 0)).toBe('a'); // pallina 0
    expect(estraiVincitore(urna, () => 0.25)).toBe('b'); // pallina 1
    expect(estraiVincitore(urna, () => 0.5)).toBe('b'); // pallina 2
    expect(estraiVincitore(urna, () => 0.999)).toBe('b'); // pallina 3
  });

  it('sul lungo periodo vince in proporzione ai biglietti', () => {
    let seme = 12345;
    const rnd = () => {
      seme = (seme * 1103515245 + 12345) % 2147483648;
      return seme / 2147483648;
    };
    const vittorie = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) vittorie[estraiVincitore(urna, rnd) as 'a' | 'b']++;
    const quotaB = vittorie.b / 4000;
    expect(quotaB).toBeGreaterThan(0.7);
    expect(quotaB).toBeLessThan(0.8);
  });

  it('ignora voci senza biglietti o senza utente', () => {
    expect(estraiVincitore([{ uid: 'x', count: 0 }, { uid: '', count: 5 }], () => 0.5)).toBeNull();
    expect(estraiVincitore([], () => 0.5)).toBeNull();
    expect(estraiVincitore([{ uid: 'x', count: 0 }, { uid: 'y', count: 2 }], () => 0.99)).toBe('y');
  });

  it('un numero casuale fuori intervallo non fa uscire dall’urna', () => {
    expect(estraiVincitore(urna, () => 1)).toBe('b');
    expect(estraiVincitore(urna, () => -1)).toBe('a');
  });
});

describe('bigliettiAcquistabili', () => {
  it('rispetta il tetto per utente', () => {
    expect(bigliettiAcquistabili(0, 3)).toBe(3);
    expect(bigliettiAcquistabili(RAFFLE.maxTicketsPerUser - 1, 5)).toBe(1);
    expect(bigliettiAcquistabili(RAFFLE.maxTicketsPerUser, 1)).toBe(0);
  });

  it('richieste non valide valgono zero', () => {
    expect(bigliettiAcquistabili(0, 0)).toBe(0);
    expect(bigliettiAcquistabili(0, -2)).toBe(0);
    expect(bigliettiAcquistabili(0, 1.5)).toBe(0);
  });
});
