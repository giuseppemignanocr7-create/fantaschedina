// ============================================
// TEST DI REGRESSIONE — i tre guasti visti in produzione il 26/08/2026
//
// Segnalazione: "nella lega non ha calcolato i punti", "nella classifica
// generale risulto solo io", e i punti spariti dopo l'azzeramento stagione.
// Ogni test qui sotto fallisce sul codice di allora.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldValue } from 'firebase-admin/firestore';

const risultati = new Map<
  string,
  { status: string; homeGoals: number; awayGoals: number; htHomeGoals?: number; htAwayGoals?: number }
>();

vi.mock('../espn', () => ({
  fetchResults: vi.fn(async () => risultati),
  fetchActiveMatchdayPool: vi.fn(async () => null),
}));

const { submitSchedina, adminForceSettle, adminResetSeason, getRankings } = await import('../index');
const {
  db,
  readProfile,
  readStanding,
  seedLega,
  seedMatchday,
  seedProfile,
  setDeadline,
  tenPredictions,
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

const LEGA = 'reg_lega';
let admin: string;

beforeEach(async () => {
  await wipe();
  await seedMatchday();
  risultati.clear();
  admin = 'reg_admin';
  await seedProfile(admin, 0, { role: 'admin' });
});

// ---------------------------------------------------------------------------

describe('classifica generale — chi ha il profilo senza il campo isActive', () => {
  // La query filtrava con `where('isActive','==',true)`. In Firestore un
  // documento privo del campo NON soddisfa l'uguaglianza: quei profili
  // sparivano dalla classifica senza errori. Chi guardava vedeva solo se
  // stesso.
  it('compare in classifica anche chi non ha il campo isActive', async () => {
    await seedProfile('reg_conFlag', 1000, { totalPoints: 50 });
    await seedProfile('reg_senzaFlag', 1000, { totalPoints: 80 });
    await db.collection('profiles').doc('reg_senzaFlag').update({
      isActive: FieldValue.delete(),
    });

    const { rankings } = await getRankings.run(req('reg_conFlag', {}));
    const nomi = rankings.map((r: { participantId: string }) => r.participantId);

    expect(nomi).toContain('reg_senzaFlag');
    expect(nomi).toContain('reg_conFlag');
  });

  it('chi è stato disattivato resta fuori', async () => {
    await seedProfile('reg_attivo', 1000, { totalPoints: 10 });
    await seedProfile('reg_bandito', 1000, { totalPoints: 999, isActive: false });

    const { rankings } = await getRankings.run(req('reg_attivo', {}));
    const nomi = rankings.map((r: { participantId: string }) => r.participantId);

    expect(nomi).toContain('reg_attivo');
    expect(nomi).not.toContain('reg_bandito');
  });

  it('la posizione è coerente coi punti di tutti, non solo di chi ha il flag', async () => {
    await seedProfile('reg_primo', 1000, { totalPoints: 300 });
    await seedProfile('reg_secondo', 1000, { totalPoints: 200 });
    await db.collection('profiles').doc('reg_primo').update({ isActive: FieldValue.delete() });

    const { rankings } = await getRankings.run(req('reg_secondo', {}));
    const secondo = rankings.find(
      (r: { participantId: string }) => r.participantId === 'reg_secondo'
    );

    // Senza il primo in classifica, il secondo risulterebbe 1º.
    expect(secondo?.rank).toBe(2);
  });
});

// ---------------------------------------------------------------------------

describe('settlement — una schedina rotta non deve fermare le altre', () => {
  // Il ciclo sul circuito generale lanciava un errore se mancava il profilo, e
  // l'errore usciva dalla funzione: le schedine successive restavano senza
  // punti e il ciclo delle leghe, che sta dopo, non partiva proprio. Bastava
  // un utente cancellato per bloccare tutte le classifiche di lega.
  it('la classifica di lega si aggiorna anche se un profilo del circuito generale è sparito', async () => {
    await seedProfile('reg_fantasma', 1000);
    await seedProfile('reg_vivo', 1000);
    await seedLega(LEGA, ['reg_vivo']);

    await submitSchedina.run(req('reg_fantasma', { predictions: tenPredictions('1'), powerups: {} }));
    await submitSchedina.run(req('reg_vivo', { predictions: tenPredictions('1'), powerups: {} }));
    await submitSchedina.run(
      req('reg_vivo', { predictions: tenPredictions('1'), powerups: {}, leagueId: LEGA })
    );

    // L'utente cancella l'account dopo aver giocato: il profilo non c'è più,
    // la schedina sì.
    await db.collection('profiles').doc('reg_fantasma').delete();

    await setDeadline(1, -60_000);
    tuttePartiteFinite(2, 0);
    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    const standing = await readStanding(LEGA, 'reg_vivo');
    expect(standing, 'la classifica di lega non è stata scritta').not.toBeNull();
    expect(standing!.totalPoints).toBeGreaterThan(0);
  });

  it('gli altri giocatori del circuito generale prendono comunque i loro punti', async () => {
    await seedProfile('reg_fantasma2', 1000);
    await seedProfile('reg_vivo2', 1000);

    await submitSchedina.run(
      req('reg_fantasma2', { predictions: tenPredictions('1'), powerups: {} })
    );
    await submitSchedina.run(req('reg_vivo2', { predictions: tenPredictions('1'), powerups: {} }));
    await db.collection('profiles').doc('reg_fantasma2').delete();

    await setDeadline(1, -60_000);
    tuttePartiteFinite(2, 0);
    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    expect((await readProfile('reg_vivo2')).totalPoints).toBeGreaterThan(0);
  });

  it('la schedina che non si è potuta valutare resta non valutata, senza punti finti', async () => {
    await seedProfile('reg_fantasma3', 1000);
    await submitSchedina.run(
      req('reg_fantasma3', { predictions: tenPredictions('1'), powerups: {} })
    );
    await db.collection('profiles').doc('reg_fantasma3').delete();

    await setDeadline(1, -60_000);
    tuttePartiteFinite(2, 0);
    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    const s = await db.collection('schedine').doc('reg_fantasma3_1').get();
    expect(s.data()!.settled).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('azzeramento stagione — i circuiti sono due', () => {
  // Azzerava solo `profiles`. Le leghe restavano coi punti vecchi, e siccome
  // una schedina già valutata non si rivaluta, quei punti non tornavano più in
  // riga con niente.
  it('azzera anche le classifiche di lega, non solo i profili', async () => {
    await seedProfile('reg_gio', 1000);
    await seedLega(LEGA, ['reg_gio']);

    await submitSchedina.run(req('reg_gio', { predictions: tenPredictions('1'), powerups: {} }));
    await submitSchedina.run(
      req('reg_gio', { predictions: tenPredictions('1'), powerups: {}, leagueId: LEGA })
    );
    await setDeadline(1, -60_000);
    tuttePartiteFinite(2, 0);
    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    expect((await readStanding(LEGA, 'reg_gio'))!.totalPoints).toBeGreaterThan(0);

    await adminResetSeason.run(req(admin, { confirm: 'AZZERA' }));

    const standing = await readStanding(LEGA, 'reg_gio');
    expect(standing!.totalPoints).toBe(0);
    expect(standing!.matchdaysPlayed).toBe(0);
    expect(standing!.correctPredictions).toBe(0);
    expect(standing!.weeklyWins).toBe(0);
  });

  it('dopo l’azzeramento i due circuiti ripartono dallo stesso punto: zero', async () => {
    await seedProfile('reg_ugo', 1000);
    await seedLega(LEGA, ['reg_ugo']);
    await submitSchedina.run(req('reg_ugo', { predictions: tenPredictions('1'), powerups: {} }));
    await submitSchedina.run(
      req('reg_ugo', { predictions: tenPredictions('1'), powerups: {}, leagueId: LEGA })
    );
    await setDeadline(1, -60_000);
    tuttePartiteFinite(2, 0);
    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    await adminResetSeason.run(req(admin, { confirm: 'AZZERA' }));

    expect((await readProfile('reg_ugo')).totalPoints).toBe(0);
    expect((await readStanding(LEGA, 'reg_ugo'))!.totalPoints).toBe(0);
  });

  it('conta quante righe di lega ha azzerato, così l’admin sa cosa è successo', async () => {
    await seedProfile('reg_a', 1000);
    await seedProfile('reg_b', 1000);
    await seedLega(LEGA, ['reg_a', 'reg_b']);
    await submitSchedina.run(
      req('reg_a', { predictions: tenPredictions('1'), powerups: {}, leagueId: LEGA })
    );
    await submitSchedina.run(
      req('reg_b', { predictions: tenPredictions('1'), powerups: {}, leagueId: LEGA })
    );
    await setDeadline(1, -60_000);
    tuttePartiteFinite(2, 0);
    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    const esito = await adminResetSeason.run(req(admin, { confirm: 'AZZERA' }));
    expect(esito.classificheDiLega).toBe(2);
  });
});
