// ============================================
// TEST DI INTEGRAZIONE — CIRCUITI SEPARATI (GENERALE E LEGHE)
//
// Ogni utente compila una schedina per la classifica generale e una per ogni
// lega di cui fa parte, sulla stessa giornata. I punti di lega restano nella
// lega: niente gettoni, niente statistiche di profilo. I power-up invece si
// pagano su ogni schedina.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

const risultati = new Map<
  string,
  { status: string; homeGoals: number; awayGoals: number; htHomeGoals?: number; htAwayGoals?: number }
>();

vi.mock('../espn', () => ({
  fetchResults: vi.fn(async () => risultati),
  fetchActiveMatchdayPool: vi.fn(async () => null),
}));

const { submitSchedina, cancelSchedina, adminForceSettle, getRankings } = await import('../index');
const { COINS, POWERUPS } = await import('../config');
const {
  coinsOf,
  db,
  readProfile,
  readSchedina,
  readStanding,
  seedLega,
  seedMatchday,
  seedProfile,
  setDeadline,
  tenPredictions,
  walletOf,
  wipe,
} = await import('./helpers');

type CallableReq = Parameters<typeof submitSchedina.run>[0];

function req(uid: string, data: unknown = {}): CallableReq {
  return { data, auth: { uid, token: {} } } as unknown as CallableReq;
}

function tuttePartiteFinite(homeGoals: number, awayGoals: number): void {
  risultati.clear();
  for (let i = 0; i < 10; i++) {
    risultati.set(`m${i}`, {
      status: 'finished',
      homeGoals,
      awayGoals,
      htHomeGoals: homeGoals,
      htAwayGoals: 0,
    });
  }
}

/** Legge la schedina di un circuito specifico. */
async function readSchedinaLega(uid: string, matchday: number, leagueId: string) {
  const snap = await db.collection('schedine').doc(`${uid}_${matchday}_${leagueId}`).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

describe('schedine di lega', () => {
  const LEGA = 'lega_amici';
  let admin: string;

  beforeEach(async () => {
    await wipe();
    await seedMatchday();
    risultati.clear();
    admin = 'l_admin';
    await seedProfile(admin, 0, { role: 'admin' });
  });

  it('rifiuta la schedina di una lega di cui non si fa parte', async () => {
    await seedProfile('l_estraneo', 1000);
    await seedLega(LEGA, ['l_membro']);

    await expect(
      submitSchedina.run(
        req('l_estraneo', { predictions: tenPredictions(), powerups: {}, leagueId: LEGA })
      )
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rifiuta una lega inesistente', async () => {
    await seedProfile('l_utente', 1000);

    await expect(
      submitSchedina.run(
        req('l_utente', { predictions: tenPredictions(), powerups: {}, leagueId: 'mai-esistita' })
      )
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('generale e lega convivono come schedine distinte sulla stessa giornata', async () => {
    await seedProfile('l_utente', 1000);
    await seedLega(LEGA, ['l_utente']);

    await submitSchedina.run(req('l_utente', { predictions: tenPredictions('1'), powerups: {} }));
    await submitSchedina.run(
      req('l_utente', { predictions: tenPredictions('X'), powerups: {}, leagueId: LEGA })
    );

    const generale = await readSchedina('l_utente', 1);
    const diLega = await readSchedinaLega('l_utente', 1, LEGA);

    expect(generale?.leagueId).toBeNull();
    expect(diLega?.leagueId).toBe(LEGA);
    expect((generale?.predictions as { outcome: string }[])[0].outcome).toBe('1');
    expect((diLega?.predictions as { outcome: string }[])[0].outcome).toBe('X');
  });

  it('i power-up si pagano su ogni schedina, non una volta sola', async () => {
    await seedProfile('l_utente', 1000);
    await seedLega(LEGA, ['l_utente']);

    await submitSchedina.run(
      req('l_utente', { predictions: tenPredictions(), powerups: { shield: true } })
    );
    expect(await coinsOf('l_utente')).toBe(1000 - POWERUPS.shield.cost);

    await submitSchedina.run(
      req('l_utente', {
        predictions: tenPredictions(),
        powerups: { shield: true },
        leagueId: LEGA,
      })
    );
    expect(await coinsOf('l_utente')).toBe(1000 - 2 * POWERUPS.shield.cost);
  });

  it('annullare la schedina di lega non tocca quella generale', async () => {
    await seedProfile('l_utente', 1000);
    await seedLega(LEGA, ['l_utente']);
    await submitSchedina.run(req('l_utente', { predictions: tenPredictions(), powerups: {} }));
    await submitSchedina.run(
      req('l_utente', { predictions: tenPredictions(), powerups: {}, leagueId: LEGA })
    );

    await cancelSchedina.run(req('l_utente', { leagueId: LEGA }));

    expect(await readSchedinaLega('l_utente', 1, LEGA)).toBeNull();
    expect(await readSchedina('l_utente', 1)).not.toBeNull();
  });

  describe('settlement', () => {
    beforeEach(async () => {
      await seedProfile('l_uno', 1000);
      await seedProfile('l_due', 1000);
      await seedLega(LEGA, ['l_uno', 'l_due']);
    });

    it('i punti di lega restano nella lega e non toccano profilo né gettoni', async () => {
      // Solo schedina di lega: nel circuito generale non gioca.
      await submitSchedina.run(
        req('l_uno', { predictions: tenPredictions('1'), powerups: {}, leagueId: LEGA })
      );
      await setDeadline(1, -60_000);
      tuttePartiteFinite(2, 0);

      await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

      const profilo = await readProfile('l_uno');
      expect(profilo.totalPoints).toBe(0);
      expect(profilo.correctPredictions).toBe(0);
      expect(profilo.matchdaysPlayed).toBe(0);
      expect(profilo.coins).toBe(1000); // nessun gettone dai pronostici di lega
      expect(await walletOf('l_uno')).toHaveLength(0);

      const standing = await readStanding(LEGA, 'l_uno');
      expect(standing).toMatchObject({
        correctPredictions: 10,
        matchdaysPlayed: 1,
        perfectSchedine: 1,
      });
      expect(standing?.totalPoints).toBeGreaterThan(0);
    });

    it('la stessa persona accumula punti separati nei due circuiti', async () => {
      // Generale tutte '1' (giuste), lega tutte '2' (sbagliate).
      await submitSchedina.run(req('l_uno', { predictions: tenPredictions('1'), powerups: {} }));
      await submitSchedina.run(
        req('l_uno', { predictions: tenPredictions('2'), powerups: {}, leagueId: LEGA })
      );
      await setDeadline(1, -60_000);
      tuttePartiteFinite(2, 0);

      await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

      const profilo = await readProfile('l_uno');
      expect(profilo.correctPredictions).toBe(10);
      expect(profilo.totalPoints).toBeGreaterThan(0);

      const standing = await readStanding(LEGA, 'l_uno');
      expect(standing?.correctPredictions).toBe(0);
      expect(standing?.totalPoints).toBe(0);
    });

    it('la classifica di lega usa i punti di lega, non quelli generali', async () => {
      // l_due domina il generale, l_uno domina la lega.
      await submitSchedina.run(req('l_due', { predictions: tenPredictions('1'), powerups: {} }));
      await submitSchedina.run(
        req('l_uno', { predictions: tenPredictions('1'), powerups: {}, leagueId: LEGA })
      );
      await submitSchedina.run(
        req('l_due', { predictions: tenPredictions('2'), powerups: {}, leagueId: LEGA })
      );
      await setDeadline(1, -60_000);
      tuttePartiteFinite(2, 0);

      await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

      const res = (await getRankings.run(req('l_uno', { leagueId: LEGA }))) as {
        rankings: { participantId: string; rank: number; totalPoints: number }[];
      };
      expect(res.rankings.map(r => r.participantId)).toEqual(['l_uno', 'l_due']);
      expect(res.rankings[1].totalPoints).toBe(0);

      // Nella generale l'ordine è opposto: lì ha giocato solo l_due.
      const generale = (await getRankings.run(req('l_uno', {}))) as {
        rankings: { participantId: string }[];
      };
      expect(generale.rankings[0].participantId).toBe('l_due');
    });

    it('il premio di giornata in gettoni resta al circuito generale', async () => {
      await submitSchedina.run(
        req('l_uno', { predictions: tenPredictions('1'), powerups: {}, leagueId: LEGA })
      );
      await submitSchedina.run(req('l_due', { predictions: tenPredictions('1'), powerups: {} }));
      await setDeadline(1, -60_000);
      tuttePartiteFinite(2, 0);

      await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

      const premio = await db.collection('prizes').doc('weekly_1').get();
      expect(premio.data()?.winnerId).toBe('l_due');
      expect((await readProfile('l_due')).coins).toBe(
        1000 + 10 * COINS.perCorrectPrediction + COINS.bonus10Correct + COINS.weeklyWinner
      );
      // Chi ha giocato solo in lega non prende gettoni né vittorie di giornata.
      expect((await readProfile('l_uno')).coins).toBe(1000);
      expect((await readProfile('l_uno')).weeklyWins).toBe(0);
      // Nella lega però la vittoria di giornata viene registrata.
      expect((await readStanding(LEGA, 'l_uno'))?.weeklyWins).toBe(1);
    });
  });
});
