import { describe, expect, it } from 'vitest';
import {
  categoriaAttiva,
  inOreDiSilenzio,
  oraDiRoma,
  scegli,
  testoCambio,
  testoEsiti,
  testoGiornata,
  testoGiro,
} from '../../../functions/src/notify';

describe('preferenze e silenzio', () => {
  it('senza preferenze salvate tutto e’ attivo', () => {
    expect(categoriaAttiva(undefined, 'live')).toBe(true);
    expect(categoriaAttiva({}, 'giro')).toBe(true);
  });

  it('solo un false esplicito spegne una categoria', () => {
    expect(categoriaAttiva({ live: false }, 'live')).toBe(false);
    expect(categoriaAttiva({ live: false }, 'esito')).toBe(true);
    expect(categoriaAttiva({ live: true }, 'live')).toBe(true);
  });

  it('le ore di silenzio coprono la notte, non la sera', () => {
    expect(inOreDiSilenzio(23)).toBe(true);
    expect(inOreDiSilenzio(3)).toBe(true);
    expect(inOreDiSilenzio(7)).toBe(true);
    expect(inOreDiSilenzio(8)).toBe(false);
    expect(inOreDiSilenzio(18)).toBe(false);
    expect(inOreDiSilenzio(22)).toBe(false);
  });

  it('oraDiRoma converte dall’ora UTC al fuso italiano', () => {
    // 21:30 UTC d'estate = 23:30 a Roma: dentro le ore di silenzio.
    expect(oraDiRoma(new Date('2026-07-01T21:30:00Z'))).toBe(23);
    // 21:30 UTC d'inverno = 22:30 a Roma: fuori.
    expect(oraDiRoma(new Date('2026-01-15T21:30:00Z'))).toBe(22);
  });
});

describe('scegli', () => {
  it('stesso seme, stessa frase; semi diversi distribuiscono', () => {
    const opzioni = ['a', 'b', 'c'] as const;
    expect(scegli(opzioni, 'utente1-2026-09-14')).toBe(scegli(opzioni, 'utente1-2026-09-14'));
    const usciti = new Set(
      Array.from({ length: 60 }, (_, i) => scegli(opzioni, `utente${i}`))
    );
    expect(usciti.size).toBe(3);
  });
});

describe('testoGiro', () => {
  it('non dice niente a chi ha gia’ fatto tutto', () => {
    expect(testoGiro('sera', { quiz: false, ruota: false }, 130, 's')).toBeNull();
  });

  it('nomina solo quello che manca davvero', () => {
    expect(testoGiro('sera', { quiz: false, ruota: true }, 130, 's')?.body).toContain('La ruota');
    expect(testoGiro('sera', { quiz: true, ruota: false }, 130, 's')?.body).toContain('Il quiz');
    expect(testoGiro('mattina', { quiz: true, ruota: true }, 130, 's')?.body).toContain('Quiz e ruota');
  });

  it('mattina e sera hanno titoli diversi', () => {
    const m = testoGiro('mattina', { quiz: true, ruota: true }, 130, 's');
    const e = testoGiro('sera', { quiz: true, ruota: true }, 130, 's');
    expect(m?.title).not.toBe(e?.title);
  });
});

describe('testoEsiti', () => {
  it('una sola partita: esito esplicito nel titolo', () => {
    const t = testoEsiti([{ label: 'FIO-TOR', score: '1-2', corretto: true }], 's');
    expect(t?.title).toContain('✅');
    expect(t?.title).toContain('FIO-TOR 1-2');
  });

  it('piu’ partite: si raggruppano in un conteggio', () => {
    const t = testoEsiti(
      [
        { label: 'FIO-TOR', score: '1-2', corretto: true },
        { label: 'NAP-JUV', score: '0-0', corretto: false },
        { label: 'INT-MIL', score: '3-1', corretto: true },
      ],
      's'
    );
    expect(t?.title).toContain('2 su 3');
    expect(t?.body).toContain('FIO-TOR');
    expect(t?.body).toContain('NAP-JUV');
  });

  it('en plein quando sono tutte prese', () => {
    const t = testoEsiti(
      [
        { label: 'A-B', score: '1-0', corretto: true },
        { label: 'C-D', score: '2-0', corretto: true },
      ],
      's'
    );
    expect(t?.title).toContain('en plein');
  });

  it('nessun esito, nessun messaggio', () => {
    expect(testoEsiti([], 's')).toBeNull();
  });
});

describe('testoCambio', () => {
  it('con piu’ cambi racconta quello buono', () => {
    const t = testoCambio(
      [
        { label: 'A-B', score: '0-1', oraCorretto: false },
        { label: 'C-D', score: '2-1', oraCorretto: true },
      ],
      's'
    );
    expect(t?.title).toContain('C-D');
    expect(t?.title).toContain('🔥');
    expect(t?.body).toContain('altre 1');
  });

  it('se sono tutti negativi lo dice, senza drammi', () => {
    const t = testoCambio([{ label: 'A-B', score: '0-1', oraCorretto: false }], 's');
    expect(t?.title).toContain('😱');
    expect(t?.body).toContain('rifarsi');
  });

  it('nessun cambio, nessun messaggio', () => {
    expect(testoCambio([], 's')).toBeNull();
  });
});

describe('testoGiornata', () => {
  it('il primo posto si festeggia', () => {
    expect(testoGiornata(3, 42.5, 1, 2, 's').body).toContain('testa alla classifica');
  });

  it('la salita mostra il segno piu’', () => {
    const t = testoGiornata(3, 42.5, 3, 2, 's');
    expect(t.body).toContain('3°');
    expect(t.body).toContain('(+2)');
  });

  it('la discesa mostra il segno meno', () => {
    expect(testoGiornata(3, 10, 7, -1, 's').body).toContain('(-1)');
  });

  it('senza posizione resta solo il punteggio', () => {
    const t = testoGiornata(3, 42.5, null, null, 's');
    expect(t.body).toContain('42.5 punti');
    expect(t.body).not.toContain('°');
  });

  it('i punti tondi non mostrano il decimale inutile', () => {
    expect(testoGiornata(3, 40, 2, 0, 's').body).toContain('40 punti');
  });
});
