// Test della sorgente casuale usata per gli esiti che assegnano gettoni.
// Non verificano "la casualità" in senso statistico stretto: verificano che
// i contratti siano rispettati (range, uniformità grossolana, nessuna perdita
// di elementi nello shuffle) e che le funzioni siano davvero non deterministiche.
import { describe, it, expect } from 'vitest';
import {
  secureIndex,
  secureUnit,
  securePick,
  secureChance,
  secureShuffle,
} from '../../../functions/src/random';

describe('secureIndex', () => {
  it('resta sempre dentro il range richiesto', () => {
    for (let i = 0; i < 5000; i++) {
      const v = secureIndex(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('con maxExclusive = 1 restituisce sempre 0', () => {
    for (let i = 0; i < 50; i++) expect(secureIndex(1)).toBe(0);
  });

  it('rifiuta parametri non validi invece di produrre NaN', () => {
    expect(() => secureIndex(0)).toThrow(RangeError);
    expect(() => secureIndex(-3)).toThrow(RangeError);
    expect(() => secureIndex(2.5)).toThrow(RangeError);
  });

  it('copre tutti i valori possibili su un numero ampio di estrazioni', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(secureIndex(6));
    expect(seen.size).toBe(6);
  });

  it('non favorisce sistematicamente un valore (chi-quadro grossolano)', () => {
    const buckets = new Array(10).fill(0);
    const draws = 20_000;
    for (let i = 0; i < draws; i++) buckets[secureIndex(10)]++;

    const expected = draws / 10;
    // Tolleranza ampia: cerchiamo bias evidenti, non finezze statistiche.
    for (const count of buckets) {
      expect(count).toBeGreaterThan(expected * 0.8);
      expect(count).toBeLessThan(expected * 1.2);
    }
  });
});

describe('secureUnit', () => {
  it('resta in [0, 1)', () => {
    for (let i = 0; i < 5000; i++) {
      const v = secureUnit();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produce valori distinti (non è una costante)', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(secureUnit());
    expect(seen.size).toBeGreaterThan(990);
  });

  it('ha media vicina a 0,5', () => {
    let sum = 0;
    const draws = 20_000;
    for (let i = 0; i < draws; i++) sum += secureUnit();
    expect(sum / draws).toBeGreaterThan(0.48);
    expect(sum / draws).toBeLessThan(0.52);
  });
});

describe('securePick', () => {
  it('restituisce sempre un elemento della collezione', () => {
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 1000; i++) {
      expect(items).toContain(securePick(items));
    }
  });

  it('rifiuta un array vuoto invece di restituire undefined', () => {
    expect(() => securePick([])).toThrow(RangeError);
  });
});

describe('secureChance', () => {
  it('con probabilità 0 non accade mai, con 1 accade sempre', () => {
    for (let i = 0; i < 500; i++) {
      expect(secureChance(0)).toBe(false);
      expect(secureChance(1)).toBe(true);
    }
  });

  it('rispetta approssimativamente la probabilità richiesta', () => {
    let hits = 0;
    const draws = 20_000;
    for (let i = 0; i < draws; i++) if (secureChance(0.3)) hits++;
    expect(hits / draws).toBeGreaterThan(0.28);
    expect(hits / draws).toBeLessThan(0.32);
  });
});

describe('secureShuffle', () => {
  it('non muta l\'array di partenza', () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    secureShuffle(original);
    expect(original).toEqual(copy);
  });

  it('conserva esattamente gli stessi elementi', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    for (let i = 0; i < 200; i++) {
      expect([...secureShuffle(items)].sort((a, b) => a - b)).toEqual(items);
    }
  });

  it('gestisce array vuoti e di un solo elemento', () => {
    expect(secureShuffle([])).toEqual([]);
    expect(secureShuffle(['x'])).toEqual(['x']);
  });

  it('cambia effettivamente l\'ordine', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const unchanged = Array.from({ length: 100 }, () =>
      secureShuffle(items).every((v, i) => v === items[i])
    ).filter(Boolean).length;
    // La probabilità di ottenere l'identità su 20 elementi è ~1/20!
    expect(unchanged).toBe(0);
  });

  it('distribuisce ogni elemento su tutte le posizioni', () => {
    // Se lo shuffle avesse un bias posizionale, un elemento non toccherebbe
    // mai certe posizioni: è il difetto tipico di un Fisher-Yates scritto male.
    const items = ['a', 'b', 'c', 'd'];
    const positionsOfA = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      positionsOfA.add(secureShuffle(items).indexOf('a'));
    }
    expect(positionsOfA.size).toBe(4);
  });
});
