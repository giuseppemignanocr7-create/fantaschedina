// Il parziale di primo tempo decide se i mercati "1° tempo" sono valutabili.
// Fino al 21/09/2026 non arrivava mai: quelle giocate valevano zero punti e
// contavano come indovinate, cioe' il bonus 10/10 regalato a chi le giocava.
import { describe, it, expect } from 'vitest';
import { giorniIntervallo, golPrimoTempo, intervalloDate, statoEspn } from '../../../functions/src/espn';

describe('statoEspn', () => {
  it('traduce gli stati regolari', () => {
    expect(statoEspn({ state: 'pre', completed: false, name: 'STATUS_SCHEDULED' })).toBe('scheduled');
    expect(statoEspn({ state: 'in', completed: false, name: 'STATUS_FIRST_HALF' })).toBe('live');
    expect(statoEspn({ state: 'post', completed: true, name: 'STATUS_FULL_TIME' })).toBe('finished');
  });

  it('riconosce rinvii, cancellazioni e sospensioni definitive', () => {
    expect(statoEspn({ state: 'post', completed: false, name: 'STATUS_POSTPONED' })).toBe('postponed');
    expect(statoEspn({ state: 'pre', completed: false, name: 'STATUS_POSTPONED' })).toBe('postponed');
    expect(statoEspn({ state: 'post', completed: false, name: 'STATUS_CANCELED' })).toBe('canceled');
    expect(statoEspn({ state: 'post', completed: false, name: 'STATUS_CANCELLED' })).toBe('canceled');
    expect(statoEspn({ state: 'post', completed: true, name: 'STATUS_ABANDONED' })).toBe('abandoned');
  });

  it('senza nome ricade sullo stato', () => {
    expect(statoEspn({ state: 'post', completed: false })).toBe('scheduled');
    expect(statoEspn(undefined)).toBe('scheduled');
  });
});

describe('intervalloDate', () => {
  it('una sola richiesta per tutta la giornata', () => {
    expect(
      intervalloDate([
        new Date('2026-09-27T16:00:00Z'),
        new Date('2026-09-26T18:45:00Z'),
        new Date('2026-09-29T18:45:00Z'),
      ])
    ).toBe('20260926-20260929');
  });

  it('allarga di un giorno per lato se richiesto', () => {
    expect(intervalloDate([new Date('2026-09-27T16:00:00Z')], 1)).toBe('20260926-20260928');
  });

  it('un giorno solo resta un giorno solo', () => {
    expect(intervalloDate([new Date('2026-09-27T16:00:00Z')])).toBe('20260927');
  });

  it('senza date non c e intervallo', () => {
    expect(intervalloDate([])).toBeNull();
    expect(intervalloDate([new Date('n/d')])).toBeNull();
  });
});

// ESPN risponde 400 a dates=AAAAMMGG-AAAAMMGG sul calcio (26/09/2026): senza
// questa scomposizione la sincronizzazione non trovava piu' la giornata e la
// valutazione non leggeva piu' i risultati.
describe('giorniIntervallo', () => {
  it('scompone l intervallo in giorni singoli, anche a cavallo del mese', () => {
    expect(giorniIntervallo('20260930-20261002')).toEqual(['20260930', '20261001', '20261002']);
  });

  it('un giorno solo resta un giorno solo', () => {
    expect(giorniIntervallo('20261010')).toEqual(['20261010']);
  });

  it('non chiede piu del massimo di giorni', () => {
    expect(giorniIntervallo('20261001-20261231', 5)).toHaveLength(5);
  });
});

describe('golPrimoTempo', () => {
  it('legge il numero quando ESPN manda `value` (scoreboard)', () => {
    expect(golPrimoTempo([{ value: 2 }, { value: 1 }])).toBe(2);
    expect(golPrimoTempo([{ value: 0 }])).toBe(0);
  });

  it('legge la stringa quando ESPN manda `displayValue` (summary)', () => {
    // Forma reale del summary: Bologna-Torino 1-1, primo tempo 1-0.
    expect(golPrimoTempo([{ displayValue: '1' }, { displayValue: '0' }])).toBe(1);
    expect(golPrimoTempo([{ displayValue: '0' }, { displayValue: '2' }])).toBe(0);
  });

  it('prende il primo tempo, non il totale ne’ il secondo tempo', () => {
    // Monza-Sassuolo 2-1: primo tempo 0-0, quindi [0, 2] per i padroni di casa.
    expect(golPrimoTempo([{ displayValue: '0' }, { displayValue: '2' }])).toBe(0);
  });

  it('restituisce null quando il parziale non c’è', () => {
    expect(golPrimoTempo(undefined)).toBeNull();
    expect(golPrimoTempo([])).toBeNull();
    expect(golPrimoTempo([{}])).toBeNull();
    expect(golPrimoTempo([{ displayValue: '' }])).toBeNull();
    expect(golPrimoTempo([{ displayValue: 'n/d' }])).toBeNull();
  });

  it('un valore numerico ha la precedenza sulla stringa', () => {
    expect(golPrimoTempo([{ value: 3, displayValue: '9' }])).toBe(3);
  });
});
