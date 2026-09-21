// L'abbinamento fra il nome ESPN e il nome del fornitore di quote decide se
// una partita ha quote vere o calcolate. Per cinque giornate la Lazio non si
// e' mai abbinata ("Lazio" contro "Lazio Rome") e nessuno se n'era accorto:
// questi test tengono l'elenco onesto.
import { describe, it, expect } from 'vitest';
import { canonicalName, teamsMatch } from '../../../functions/src/realOdds';

/**
 * Nomi come li scrivono le due fonti, verificati il 21/09/2026 chiedendo a
 * ESPN (scoreboard Serie A) e al fornitore (/events?league=italy-serie-a).
 */
const COPPIE: [espn: string, fornitore: string][] = [
  ['Lazio', 'Lazio Rome'],
  ['AC Milan', 'AC Milan'],
  ['Monza', 'AC Monza'],
  ['Fiorentina', 'ACF Fiorentina'],
  ['AS Roma', 'AS Roma'],
  ['Atalanta', 'Atalanta BC'],
  ['Bologna', 'Bologna FC'],
  ['Cagliari', 'Cagliari Calcio'],
  ['Como', 'Como 1907'],
  ['Frosinone', 'Frosinone Calcio'],
  ['Genoa', 'Genoa CFC'],
  ['Internazionale', 'Inter Milano'],
  ['Juventus', 'Juventus Turin'],
  ['Parma', 'Parma Calcio'],
  ['Napoli', 'SSC Napoli'],
  ['Sassuolo', 'Sassuolo Calcio'],
  ['Torino', 'Torino FC'],
  ['Lecce', 'US Lecce'],
  ['Udinese', 'Udinese Calcio'],
  ['Venezia', 'Venezia FC'],
];

describe('abbinamento squadre ESPN ↔ fornitore quote', () => {
  it.each(COPPIE.map(([espn, fornitore]) => ({ espn, fornitore })))(
    '$espn si abbina a $fornitore',
    ({ espn, fornitore }) => {
      expect(teamsMatch(espn, fornitore)).toBe(true);
    }
  );

  it('tutte e venti le squadre di Serie A si abbinano', () => {
    const fallite = COPPIE.filter(([espn, fornitore]) => !teamsMatch(espn, fornitore));
    expect(fallite).toEqual([]);
  });

  it('non abbina squadre diverse', () => {
    expect(teamsMatch('Lazio', 'AS Roma')).toBe(false);
    expect(teamsMatch('Milan', 'Inter Milano')).toBe(false);
    expect(teamsMatch('Torino', 'Juventus Turin')).toBe(false);
    expect(teamsMatch('Venezia', 'Verona')).toBe(false);
  });

  it('due nomi della stessa squadra danno lo stesso identificativo', () => {
    for (const [espn, fornitore] of COPPIE) {
      expect(canonicalName(espn)).toBe(canonicalName(fornitore));
    }
  });

  it('non appiattisce squadre diverse sullo stesso identificativo', () => {
    const identificativi = COPPIE.map(([espn]) => canonicalName(espn));
    expect(new Set(identificativi).size).toBe(COPPIE.length);
  });
});
