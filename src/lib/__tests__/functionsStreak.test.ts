// La serie giornaliera accredita gettoni: interessano il confine fra un giorno
// e l'altro, l'azzeramento dopo un salto e l'impossibilita' di incassare due
// volte lo stesso giorno.
import { describe, it, expect } from 'vitest';
import { calcolaSerie, bonusSerie, giornoPrecedente } from '../../../functions/src/streak';
import { STREAK } from '../../../functions/src/config';

describe('giornoPrecedente', () => {
  it('torna indietro di un giorno', () => {
    expect(giornoPrecedente('2026-09-18')).toBe('2026-09-17');
  });

  it('attraversa mesi e anni', () => {
    expect(giornoPrecedente('2026-09-01')).toBe('2026-08-31');
    expect(giornoPrecedente('2026-01-01')).toBe('2025-12-31');
    expect(giornoPrecedente('2026-03-01')).toBe('2026-02-28');
    expect(giornoPrecedente('2028-03-01')).toBe('2028-02-29');
  });

  it('non si fa ingannare dal cambio di ora legale', () => {
    // A Roma l'ora legale finisce il 25/10/2026: il giorno prima resta il 24.
    expect(giornoPrecedente('2026-10-25')).toBe('2026-10-24');
    expect(giornoPrecedente('2026-03-29')).toBe('2026-03-28');
  });

  it('respinge formati non validi', () => {
    for (const v of ['', '18-09-2026', '2026-9-1', 'ieri']) {
      expect(giornoPrecedente(v)).toBe('');
    }
  });
});

describe('bonusSerie', () => {
  it('cresce di giorno in giorno fino al tetto', () => {
    expect(bonusSerie(1)).toBe(STREAK.bonusPerGiorno);
    expect(bonusSerie(2)).toBe(STREAK.bonusPerGiorno * 2);
    expect(bonusSerie(999)).toBe(STREAK.bonusMassimo);
  });

  it('non premia serie inesistenti o assurde', () => {
    expect(bonusSerie(0)).toBe(0);
    expect(bonusSerie(-3)).toBe(0);
    expect(bonusSerie(Number.NaN)).toBe(0);
  });

  it('non supera mai il tetto', () => {
    for (let g = 1; g <= 60; g++) expect(bonusSerie(g)).toBeLessThanOrEqual(STREAK.bonusMassimo);
  });
});

describe('calcolaSerie', () => {
  const OGGI = '2026-09-18';
  const IERI = '2026-09-17';

  it('la prima presenza in assoluto apre la serie', () => {
    expect(calcolaSerie(undefined, 0, OGGI)).toEqual({
      giorni: 1,
      bonus: bonusSerie(1),
      nuovoGiorno: true,
    });
  });

  it('giocando ieri e oggi la serie sale', () => {
    const s = calcolaSerie(IERI, 3, OGGI);
    expect(s.giorni).toBe(4);
    expect(s.bonus).toBe(bonusSerie(4));
    expect(s.nuovoGiorno).toBe(true);
  });

  it('il bonus si incassa una volta sola al giorno', () => {
    const s = calcolaSerie(OGGI, 4, OGGI);
    expect(s).toEqual({ giorni: 4, bonus: 0, nuovoGiorno: false });
  });

  it('saltare un giorno azzera la serie', () => {
    const s = calcolaSerie('2026-09-16', 9, OGGI);
    expect(s.giorni).toBe(1);
    expect(s.bonus).toBe(bonusSerie(1));
  });

  it('una serie lunga non supera il tetto giornaliero', () => {
    expect(calcolaSerie(IERI, 40, OGGI).bonus).toBe(STREAK.bonusMassimo);
  });

  it('regge dati incoerenti senza inventare gettoni', () => {
    expect(calcolaSerie(OGGI, 0, OGGI).giorni).toBe(1);
    expect(calcolaSerie(IERI, -5, OGGI).giorni).toBe(1);
    expect(calcolaSerie('non-una-data', 5, OGGI).giorni).toBe(1);
  });

  it('una settimana di presenze consecutive non si interrompe', () => {
    const giorni = ['2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'];
    let ultimo: string | undefined;
    let conta = 0;
    for (const g of giorni) {
      const s = calcolaSerie(ultimo, conta, g);
      conta = s.giorni;
      ultimo = g;
    }
    expect(conta).toBe(7);
  });
});
