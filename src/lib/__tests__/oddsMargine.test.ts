// ============================================
// MARGINE DEL BANCO SULLE QUOTE CALCOLATE
//
// Fino al 21/09/2026 il margine veniva moltiplicato invece che diviso: il
// libro sommava al 94% invece che al 106,5%, cioe' le quote calcolate
// regalavano valore al giocatore e pagavano circa il 13% piu' di quelle vere.
// Nessun test guardava la somma delle probabilita' implicite, ed e' il motivo
// per cui e' passato inosservato per cinque giornate.
//
// Il motore del client e quello delle functions sono copie: qui si controllano
// tutti e due, perche' una divergenza si vedrebbe solo in produzione.
// ============================================

import { describe, it, expect } from 'vitest';
import { generateMatchOdds as quoteClient } from '../oddsEngine';
import { generateMatchOdds as quoteServer } from '../../../functions/src/odds';

const SQUADRE = [
  'int', 'nap', 'ata', 'juv', 'mil', 'laz', 'fio', 'bol', 'rom', 'tor',
  'udi', 'emp', 'com', 'cag', 'gen', 'par', 'lec', 'ver', 'mon', 'ven',
];

const PARTITE = SQUADRE.flatMap(casa =>
  SQUADRE.filter(fuori => fuori !== casa).map(fuori => ({ casa, fuori }))
);

/** Somma delle probabilita' implicite: 1.065 = il banco trattiene il 6,5%. */
function libro(quote: Record<string, number>): number {
  return Object.values(quote).reduce((s, q) => s + 1 / q, 0);
}

const MOTORI = [
  { nome: 'client', genera: quoteClient },
  { nome: 'functions', genera: quoteServer },
] as const;

describe.each(MOTORI)('$nome — margine del banco', ({ genera }) => {
  it('il libro dell’1X2 sta sopra il 100% in ogni partita', () => {
    const sotto = PARTITE.filter(({ casa, fuori }) => {
      const o = genera(casa, fuori);
      return libro(o.esito as unknown as Record<string, number>) <= 1;
    });
    expect(sotto).toEqual([]);
  });

  it('nessun mercato regala valore al giocatore', () => {
    for (const { casa, fuori } of PARTITE.slice(0, 80)) {
      const o = genera(casa, fuori);
      const mercati = [o.esito, o.over_under, o.goal_nogoal, o.esito_1t, o.over_under_1t, o.goal_nogoal_1t];
      for (const m of mercati) {
        const somma = libro(m as unknown as Record<string, number>);
        expect(somma).toBeGreaterThan(1);
        expect(somma).toBeLessThan(1.25);
      }
    }
  });

  it('su un mercato a due esiti il margine e’ quello dichiarato', () => {
    const o = genera('int', 'ven');
    expect(libro(o.over_under as unknown as Record<string, number>)).toBeCloseTo(1.065, 1);
    expect(libro(o.goal_nogoal as unknown as Record<string, number>)).toBeCloseTo(1.065, 1);
  });
});

describe('client e functions calcolano le stesse quote', () => {
  it.each(PARTITE.slice(0, 40))('$casa vs $fuori: quote identiche', ({ casa, fuori }) => {
    expect(quoteClient(casa, fuori)).toEqual(quoteServer(casa, fuori));
  });
});
