// ============================================
// TEST DI INTEGRAZIONE — AZZERAMENTO STAGIONE
// L'operazione tocca tutti i profili ed è irreversibile: qui si verifica che
// azzeri quello che deve e non tocchi il resto.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest';
import { adminResetSeason } from '../index';
import { COINS } from '../config';
import { db, readProfile, readSchedina, seedProfile, wipe } from './helpers';

type CallableReq = Parameters<typeof adminResetSeason.run>[0];

function req(uid: string, data: unknown = {}): CallableReq {
  return { data, auth: { uid, token: {} } } as unknown as CallableReq;
}

const CONFERMA = { confirm: 'AZZERA' };

/** Profilo a stagione avanzata: punti, statistiche e gettoni accumulati. */
async function profiloUsato(uid: string) {
  await seedProfile(uid, 940, {
    totalPoints: 128.5,
    weeklyPoints: 22.4,
    matchdaysPlayed: 7,
    perfectSchedine: 1,
    bonusPointsTotal: 30,
    penaltyPointsTotal: -4,
    weeklyWins: 2,
    bestMatchdayPoints: 41,
    correctPredictions: 52,
    coinsEarned: 1240,
    claimedMissions: ['first_schedina', 'sharp_50'],
    leaguesJoined: 2,
  });
}

describe('adminResetSeason', () => {
  let admin: string;

  beforeEach(async () => {
    await wipe();
    admin = 'r_admin';
    await seedProfile(admin, 0, { role: 'admin' });
  });

  it('richiede il ruolo admin', async () => {
    await seedProfile('r_tizio', 100);
    await expect(adminResetSeason.run(req('r_tizio', CONFERMA))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('senza la parola di conferma non azzera nulla', async () => {
    await profiloUsato('r_utente');

    await expect(adminResetSeason.run(req(admin, {}))).rejects.toMatchObject({
      code: 'failed-precondition',
    });
    await expect(
      adminResetSeason.run(req(admin, { confirm: 'azzera' }))
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    expect((await readProfile('r_utente')).totalPoints).toBe(128.5);
  });

  it('riporta punti, statistiche e gettoni allo stato iniziale', async () => {
    await profiloUsato('r_utente');

    const res = await adminResetSeason.run(req(admin, CONFERMA));
    expect(res).toMatchObject({ ok: true });

    const p = await readProfile('r_utente');
    expect(p.totalPoints).toBe(0);
    expect(p.weeklyPoints).toBe(0);
    expect(p.matchdaysPlayed).toBe(0);
    expect(p.perfectSchedine).toBe(0);
    expect(p.bonusPointsTotal).toBe(0);
    expect(p.penaltyPointsTotal).toBe(0);
    expect(p.weeklyWins).toBe(0);
    expect(p.bestMatchdayPoints).toBe(0);
    expect(p.correctPredictions).toBe(0);
    expect(p.coins).toBe(COINS.starting);
    expect(p.coinsEarned).toBe(0);
    expect(p.claimedMissions as unknown as string[]).toEqual([]);
  });

  it('non tocca identità, stato dell\'account e appartenenza alle leghe', async () => {
    await profiloUsato('r_utente');

    await adminResetSeason.run(req(admin, CONFERMA));

    const p = (await db.collection('profiles').doc('r_utente').get()).data() ?? {};
    expect(p.username).toBe('player_r_utente');
    expect(p.email).toBe('r_utente@example.com');
    expect(p.isActive).toBe(true);
    // leaguesJoined rispecchia le leghe di cui si fa parte davvero: azzerarlo
    // lo scollegherebbe dalla realtà.
    expect(p.leaguesJoined).toBe(2);
  });

  it('azzera tutti i profili, non solo il primo', async () => {
    await profiloUsato('r_uno');
    await profiloUsato('r_due');
    await profiloUsato('r_tre');

    const res = (await adminResetSeason.run(req(admin, CONFERMA))) as { profili: number };

    expect(res.profili).toBe(4); // i tre più l'admin
    for (const uid of ['r_uno', 'r_due', 'r_tre']) {
      expect((await readProfile(uid)).totalPoints).toBe(0);
    }
  });

  it('lascia le schedine passate come storico', async () => {
    await profiloUsato('r_utente');
    await db.collection('schedine').doc('r_utente_3').set({
      id: 'r_utente_3',
      userId: 'r_utente',
      matchdayNumber: 3,
      predictions: [],
      settled: true,
      finalPoints: 41,
    });

    await adminResetSeason.run(req(admin, CONFERMA));

    const schedina = await readSchedina('r_utente', 3);
    expect(schedina).toMatchObject({ settled: true, finalPoints: 41 });
  });

  it('lascia traccia di chi ha azzerato e quando', async () => {
    await profiloUsato('r_utente');

    await adminResetSeason.run(req(admin, CONFERMA));

    const tracce = await db.collection('season_resets').get();
    expect(tracce.size).toBe(1);
    expect(tracce.docs[0].data()).toMatchObject({ byUid: admin, profili: 2 });
  });
});
