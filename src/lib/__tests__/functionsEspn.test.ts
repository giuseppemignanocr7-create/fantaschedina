// Il parziale di primo tempo decide se i mercati "1° tempo" sono valutabili.
// Fino al 21/09/2026 non arrivava mai: quelle giocate valevano zero punti e
// contavano come indovinate, cioe' il bonus 10/10 regalato a chi le giocava.
import { describe, it, expect } from 'vitest';
import { golPrimoTempo } from '../../../functions/src/espn';

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
