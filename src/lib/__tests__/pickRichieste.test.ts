import { describe, expect, it } from 'vitest';
import { pickRichieste } from '../pickRichieste';
import { QUOTA_MINIMA, quotaGiocabile, quoteAncoraAperte } from '../markets';
import type { MatchOdds } from '@/data/mockData';

describe('quoteAncoraAperte', () => {
  it('tiene solo le partite in programma e non ancora iniziate', () => {
    const adesso = Date.UTC(2026, 8, 25, 12);
    const partite = [
      { id: 'a', status: 'scheduled' as const, scheduledAt: new Date(adesso + 3600_000) },
      { id: 'b', status: 'scheduled' as const, scheduledAt: new Date(adesso - 60_000) },
      { id: 'c', status: 'live' as const, scheduledAt: new Date(adesso + 3600_000) },
      { id: 'd', status: 'scheduled' as const, scheduledAt: new Date(adesso + 7200_000) },
    ];
    const quote = { a: { esito: { '1': 2, 'X': 3, '2': 4 } }, b: {}, c: {} } as Record<string, MatchOdds>;
    expect(Object.keys(quoteAncoraAperte(partite, quote, adesso))).toEqual(['a']);
    expect(Object.keys(quoteAncoraAperte(partite, quote, 0))).toEqual(['a', 'b']);
    expect(quoteAncoraAperte(undefined, quote, adesso)).toEqual({});
  });
});

const esito = { '1': 2, 'X': 3, '2': 4 };

describe('pickRichieste', () => {
  it('chiede dieci pronostici quando le partite quotate sono dieci o piu', () => {
    const quote: Record<string, MatchOdds> = {};
    for (let i = 0; i < 12; i++) quote[`m${i}`] = { esito };
    expect(pickRichieste(quote)).toBe(10);
  });

  it('ne chiede meno quando l agenzia ha quotato meno partite', () => {
    expect(pickRichieste({ a: { esito }, b: { esito }, c: { over_under: { OVER: 2, UNDER: 2 } } })).toBe(2);
  });

  it('senza quote non chiede nulla', () => {
    expect(pickRichieste(undefined)).toBe(0);
    expect(pickRichieste({})).toBe(0);
  });
});

describe('quotaGiocabile', () => {
  const odds: MatchOdds = { esito: { '1': 1.2, 'X': 3.1, '2': QUOTA_MINIMA } };

  it('restituisce la quota del bookmaker quando e giocabile', () => {
    expect(quotaGiocabile(odds, 'esito', 'X')).toBe(3.1);
    expect(quotaGiocabile(odds, 'esito', '2')).toBe(QUOTA_MINIMA);
  });

  it('scarta le quote sotto il minimo ammesso dal server', () => {
    expect(quotaGiocabile(odds, 'esito', '1')).toBeNull();
  });

  it('non inventa quote per mercati o esiti assenti', () => {
    expect(quotaGiocabile(odds, 'over_under', 'OVER')).toBeNull();
    expect(quotaGiocabile(odds, 'esito', 'Z')).toBeNull();
    expect(quotaGiocabile(undefined, 'esito', '1')).toBeNull();
  });
});
