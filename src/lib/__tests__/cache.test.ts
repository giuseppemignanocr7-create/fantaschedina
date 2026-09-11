import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_TTL, getCached, invalidate, invalidatePrefix, setCached } from '../cache';

// La cache in memoria sta davanti a Firestore per classifiche e giornata:
// un valore scaduto restituito per sbaglio mostrerebbe punteggi vecchi,
// uno invalidato troppo poco farebbe pagare letture inutili.
describe('cache in memoria', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-11T10:00:00Z'));
    invalidatePrefix('');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('restituisce il valore entro il TTL e null dopo', () => {
    setCached('rankings', [{ rank: 1 }], 1000);
    expect(getCached('rankings')).toEqual([{ rank: 1 }]);
    vi.advanceTimersByTime(999);
    expect(getCached('rankings')).toEqual([{ rank: 1 }]);
    vi.advanceTimersByTime(2);
    expect(getCached('rankings')).toBeNull();
  });

  it('una chiave mai scritta e’ null', () => {
    expect(getCached('niente')).toBeNull();
  });

  it('invalidate cancella solo quella chiave', () => {
    setCached('a', 1, 10_000);
    setCached('b', 2, 10_000);
    invalidate('a');
    expect(getCached('a')).toBeNull();
    expect(getCached('b')).toBe(2);
  });

  it('invalidatePrefix cancella tutte le chiavi con quel prefisso', () => {
    setCached('schedina:1', 'x', 10_000);
    setCached('schedina:2', 'y', 10_000);
    setCached('rankings', 'z', 10_000);
    invalidatePrefix('schedina:');
    expect(getCached('schedina:1')).toBeNull();
    expect(getCached('schedina:2')).toBeNull();
    expect(getCached('rankings')).toBe('z');
  });

  it('una scrittura successiva sostituisce valore e scadenza', () => {
    setCached('k', 'vecchio', 100);
    setCached('k', 'nuovo', 10_000);
    vi.advanceTimersByTime(500);
    expect(getCached('k')).toBe('nuovo');
  });

  it('i TTL di progetto sono quelli attesi', () => {
    expect(CACHE_TTL).toEqual({
      rankings: 60_000,
      weeklyRanking: 30_000,
      matchday: 15_000,
      schedinaHistory: 30_000,
    });
  });
});
