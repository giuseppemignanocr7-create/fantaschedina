// L'abbinamento fra il nome ESPN e il nome del fornitore di quote decide se
// una partita ha quote vere o calcolate. Per cinque giornate la Lazio non si
// e' mai abbinata ("Lazio" contro "Lazio Rome") e nessuno se n'era accorto:
// questi test tengono l'elenco onesto.
import { describe, it, expect } from 'vitest';
import {
  canonicalName,
  teamsMatch,
  trovaEvento,
  SCARTO_MASSIMO_MS,
  type OddsApiEvent,
} from '../../../functions/src/realOdds';

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

  it.each([
    ['Pisa', 'AC Pisa 1909'],
    ['Pisa', 'Pisa SC'],
    ['Pisa', 'Pisa'],
    ['Cremonese', 'US Cremonese'],
    ['Cremonese', 'Cremonese'],
    ['Hellas Verona', 'Hellas Verona FC'],
    ['Hellas Verona', 'Verona'],
    ['Verona', 'Hellas Verona'],
  ])('neopromosse e Verona: %s si abbina a %s', (espn, fornitore) => {
    expect(teamsMatch(espn, fornitore)).toBe(true);
  });

  it('Pisa, Cremonese e Verona restano squadre distinte', () => {
    expect(teamsMatch('Pisa', 'US Cremonese')).toBe(false);
    expect(teamsMatch('Hellas Verona', 'Venezia FC')).toBe(false);
    expect(teamsMatch('Cremonese', 'Como 1907')).toBe(false);
  });
});

describe('trovaEvento: stesse squadre, stesso giorno, ancora da giocare', () => {
  const kickoff = new Date('2026-09-27T16:00:00Z');
  const partita = {
    homeTeam: { name: 'Lazio' },
    awayTeam: { name: 'Hellas Verona' },
    scheduledAt: kickoff,
  };
  const evento = (over: Partial<OddsApiEvent> = {}): OddsApiEvent => ({
    id: 1,
    home: 'Lazio Rome',
    away: 'Hellas Verona FC',
    homeId: 10,
    awayId: 20,
    date: '2026-09-27T16:00:00Z',
    status: 'pending',
    ...over,
  });

  it('abbina l evento con nomi e orario coerenti', () => {
    expect(trovaEvento([evento()], partita)?.id).toBe(1);
  });

  it('tollera uno scarto di orario fino a 36 ore', () => {
    const vicino = new Date(kickoff.getTime() + SCARTO_MASSIMO_MS).toISOString();
    expect(trovaEvento([evento({ date: vicino })], partita)?.id).toBe(1);
  });

  it('scarta la stessa sfida in un altra data (ritorno, recupero, coppa)', () => {
    const lontano = new Date(kickoff.getTime() + SCARTO_MASSIMO_MS + 60_000).toISOString();
    expect(trovaEvento([evento({ date: lontano })], partita)).toBeUndefined();
    expect(trovaEvento([evento({ date: '2027-02-14T19:45:00Z' })], partita)).toBeUndefined();
  });

  it('usa solo eventi ancora da giocare', () => {
    for (const status of ['live', 'settled', 'postponed', 'cancelled']) {
      expect(trovaEvento([evento({ status })], partita)).toBeUndefined();
    }
  });

  it('fra piu eventi sceglie quello giusto', () => {
    const eventi = [
      evento({ id: 7, date: '2027-02-14T19:45:00Z' }),
      evento({ id: 8, home: 'AS Roma' }),
      evento({ id: 9 }),
    ];
    expect(trovaEvento(eventi, partita)?.id).toBe(9);
  });

  it('una data illeggibile non abbina', () => {
    expect(trovaEvento([evento({ date: 'n/d' })], partita)).toBeUndefined();
  });
});
