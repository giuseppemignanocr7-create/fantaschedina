// Lo stato della serie decide cosa promette l'interfaccia: una serie mostrata
// viva quando e' gia' persa e' una bugia verso chi ha saltato il giro.
import { describe, it, expect } from 'vitest';
import { statoSerie, oggiRoma } from '../serie';
import { STREAK } from '../economy';

const OGGI = '2026-09-18';

describe('oggiRoma', () => {
  it('usa il fuso di Roma, non quello del telefono', () => {
    // 23:30 UTC del 17 = 01:30 del 18 a Roma (ora legale).
    expect(oggiRoma(new Date('2026-09-17T23:30:00Z'))).toBe('2026-09-18');
    // 22:30 UTC del 17 = 00:30 del 18 a Roma.
    expect(oggiRoma(new Date('2026-09-17T22:30:00Z'))).toBe('2026-09-18');
    // 21:30 UTC del 17 = 23:30 del 17 a Roma.
    expect(oggiRoma(new Date('2026-09-17T21:30:00Z'))).toBe('2026-09-17');
  });

  it('produce il formato del server', () => {
    expect(oggiRoma(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
  });
});

describe('statoSerie', () => {
  it('senza mai aver giocato non c’è nessuna serie', () => {
    const s = statoSerie(undefined, undefined, OGGI);
    expect(s.giorni).toBe(0);
    expect(s.giocatoOggi).toBe(false);
    expect(s.aRischio).toBe(false);
    expect(s.prossimoBonus).toBe(STREAK.bonusPerGiorno);
  });

  it('giocando oggi la serie è al sicuro', () => {
    const s = statoSerie(OGGI, 3, OGGI);
    expect(s).toEqual({
      giorni: 3,
      giocatoOggi: true,
      aRischio: false,
      prossimoBonus: STREAK.bonusPerGiorno * 4,
    });
  });

  it('con l’ultima partita di ieri la serie è a rischio', () => {
    const s = statoSerie('2026-09-17', 5, OGGI);
    expect(s.giorni).toBe(5);
    expect(s.aRischio).toBe(true);
    expect(s.giocatoOggi).toBe(false);
  });

  it('dopo un giorno saltato la serie è già persa', () => {
    const s = statoSerie('2026-09-16', 9, OGGI);
    expect(s.giorni).toBe(0);
    expect(s.aRischio).toBe(false);
    expect(s.prossimoBonus).toBe(STREAK.bonusPerGiorno);
  });

  it('il bonus mostrato non supera mai il tetto', () => {
    expect(statoSerie(OGGI, 50, OGGI).prossimoBonus).toBe(STREAK.bonusMassimo);
  });

  it('regge dati incoerenti del profilo', () => {
    expect(statoSerie(OGGI, 0, OGGI).giorni).toBe(0);
    expect(statoSerie('non-una-data', 4, OGGI).giorni).toBe(0);
    expect(statoSerie(OGGI, -2, OGGI).giorni).toBe(0);
  });
});
