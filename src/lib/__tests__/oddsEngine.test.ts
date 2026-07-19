// ============================================
// SIMULAZIONE MASSIVA ODDS ENGINE
// Tutte le 380 combinazioni casa/trasferta della Serie A
// Verifica invarianti di sanità delle quote generate.
// ============================================
import { describe, it, expect } from 'vitest';
import { generateMatchOdds, generateMatchdayOdds } from '../oddsEngine';

const TEAMS = [
  'int', 'nap', 'ata', 'juv', 'mil', 'laz', 'fio', 'bol', 'rom', 'tor',
  'udi', 'emp', 'com', 'cag', 'gen', 'par', 'lec', 'ver', 'mon', 'ven',
];

const PAIRINGS = TEAMS.flatMap(home =>
  TEAMS.filter(away => away !== home).map(away => ({ home, away }))
);

describe(`oddsEngine — invarianti su tutte le ${PAIRINGS.length} partite possibili`, () => {
  it.each(PAIRINGS)('$home vs $away: quote sane in ogni mercato', ({ home, away }) => {
    const odds = generateMatchOdds(home, away);

    // 1X2 nei limiti e ordinati sensatamente
    expect(odds.esito['1']).toBeGreaterThanOrEqual(1.10);
    expect(odds.esito['1']).toBeLessThanOrEqual(10.0);
    expect(odds.esito['2']).toBeGreaterThanOrEqual(1.10);
    expect(odds.esito['2']).toBeLessThanOrEqual(15.0);
    expect(odds.esito['X']).toBeGreaterThanOrEqual(2.60);
    expect(odds.esito['X']).toBeLessThanOrEqual(5.5);

    // Over/Under coerenti
    expect(odds.over_under.OVER).toBeGreaterThanOrEqual(1.38);
    expect(odds.over_under.UNDER).toBeGreaterThanOrEqual(1.38);
    expect(odds.over_under.OVER).toBeLessThanOrEqual(3.0);
    expect(odds.over_under.UNDER).toBeLessThanOrEqual(3.0);

    // GG/NG
    expect(odds.goal_nogoal.GG).toBeGreaterThanOrEqual(1.42);
    expect(odds.goal_nogoal.NG).toBeGreaterThanOrEqual(1.58);

    // Doppia chance sempre più bassa del singolo esito corrispondente
    expect(odds.doppia_chance['1X']).toBeLessThan(odds.esito['1'] + 0.001);
    expect(odds.doppia_chance['X2']).toBeLessThan(odds.esito['2'] + 0.001);
    expect(odds.doppia_chance['12']).toBeLessThanOrEqual(Math.min(odds.esito['1'], odds.esito['2']) + 0.001);

    // Multigoal: linee più facili → quote più basse
    expect(odds.multigoal['O0.5']).toBeLessThan(odds.multigoal['O1.5']);
    expect(odds.multigoal['O1.5']).toBeLessThan(odds.multigoal['O2.5']);
    expect(odds.multigoal['O2.5']).toBeLessThan(odds.multigoal['O3.5']);
    expect(odds.multigoal['U3.5']).toBeLessThan(odds.multigoal['U2.5']);
    expect(odds.multigoal['U2.5']).toBeLessThan(odds.multigoal['U1.5']);
    expect(odds.multigoal['U1.5']).toBeLessThan(odds.multigoal['U0.5']);

    // 1° tempo presente e nei limiti
    expect(odds.esito_1t['1']).toBeGreaterThanOrEqual(1.5);
    expect(odds.esito_1t['2']).toBeGreaterThanOrEqual(2.0);
    expect(odds.over_under_1t.OVER).toBeGreaterThan(odds.over_under.OVER - 0.001); // segnare 2 gol in un tempo è più difficile
    expect(odds.goal_nogoal_1t.GG).toBeGreaterThan(odds.goal_nogoal.GG - 0.001);
  });
});

describe('oddsEngine — coerenza di forza', () => {
  it('la favorita in casa ha quota 1 più bassa della sfavorita', () => {
    const strongHome = generateMatchOdds('int', 'ven'); // Inter vs Venezia
    const weakHome = generateMatchOdds('ven', 'int');
    expect(strongHome.esito['1']).toBeLessThan(weakHome.esito['1']);
  });

  it('squadre sconosciute usano forza di default senza crash', () => {
    const odds = generateMatchOdds('xxx', 'yyy');
    expect(odds.esito['1']).toBeGreaterThan(1);
    expect(odds.esito['X']).toBeGreaterThan(1);
    expect(odds.esito['2']).toBeGreaterThan(1);
  });

  it('generateMatchdayOdds mappa ogni partita', () => {
    const matches = [
      { id: 'm1', homeTeam: { id: 'int' }, awayTeam: { id: 'juv' } },
      { id: 'm2', homeTeam: { id: 'mil' }, awayTeam: { id: 'nap' } },
    ];
    const all = generateMatchdayOdds(matches);
    expect(Object.keys(all)).toEqual(['m1', 'm2']);
  });
});
