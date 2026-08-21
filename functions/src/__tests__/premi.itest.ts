// ============================================
// TEST DI INTEGRAZIONE — PREMI SETTIMANALI
// I premi di una giornata li decide l'amministratore in base a quanti stanno
// giocando; il settlement li assegna al podio della giornata.
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

const { adminManageWeeklyPrizes, adminForceSettle, submitSchedina } = await import('../index');
const { DEFAULT_WEEKLY_PRIZES, MAX_WEEKLY_PRIZES } = await import('../config');
const {
  db,
  seedMatchday,
  seedProfile,
  setDeadline,
  tenPredictions,
  wipe,
} = await import('./helpers');

type CallableReq = Parameters<typeof adminManageWeeklyPrizes.run>[0];

function req(uid: string, data: unknown = {}): CallableReq {
  return { data, auth: { uid, token: {} } } as unknown as CallableReq;
}

interface Podio {
  position: number;
  userId: string;
  username: string;
  points: number;
  prize: string;
  emoji: string | null;
}

async function leggiPodio(matchday: number): Promise<Podio[]> {
  const snap = await db.collection('prizes').doc(`weekly_${matchday}`).get();
  return (snap.data()?.podio ?? []) as Podio[];
}

const PREMI = [
  { position: 1, label: 'Felpa firmata', emoji: '🧥' },
  { position: 2, label: 'T-shirt', emoji: '👕' },
  { position: 3, label: 'Cappellino', emoji: '🧢' },
];

describe('adminManageWeeklyPrizes', () => {
  const admin = 'p_admin';

  beforeEach(async () => {
    await wipe();
    await seedMatchday();
    risultati.clear();
    await seedProfile(admin, 0, { role: 'admin' });
  });

  it('richiede il ruolo admin', async () => {
    await seedProfile('p_tizio', 0);
    await expect(
      adminManageWeeklyPrizes.run(req('p_tizio', { action: 'get', matchdayNumber: 1 }))
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('finché non sono impostati valgono quelli di partenza', async () => {
    const res = (await adminManageWeeklyPrizes.run(
      req(admin, { action: 'get', matchdayNumber: 1 })
    )) as { personalizzati: boolean; items: typeof PREMI };

    expect(res.personalizzati).toBe(false);
    expect(res.items).toEqual(DEFAULT_WEEKLY_PRIZES);
  });

  it('salva i premi della giornata e li rilegge', async () => {
    await adminManageWeeklyPrizes.run(
      req(admin, { action: 'set', matchdayNumber: 3, items: PREMI })
    );

    const res = (await adminManageWeeklyPrizes.run(
      req(admin, { action: 'get', matchdayNumber: 3 })
    )) as { personalizzati: boolean; items: typeof PREMI };

    expect(res.personalizzati).toBe(true);
    expect(res.items).toEqual(PREMI);
    // Giornate diverse hanno premi diversi: la 1 resta ai valori di partenza.
    const altra = (await adminManageWeeklyPrizes.run(
      req(admin, { action: 'get', matchdayNumber: 1 })
    )) as { personalizzati: boolean };
    expect(altra.personalizzati).toBe(false);
  });

  it('rifiuta premi senza nome, posizioni ripetute e liste vuote', async () => {
    await expect(
      adminManageWeeklyPrizes.run(req(admin, { action: 'set', matchdayNumber: 1, items: [] }))
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    await expect(
      adminManageWeeklyPrizes.run(
        req(admin, { action: 'set', matchdayNumber: 1, items: [{ position: 1, label: '   ' }] })
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    await expect(
      adminManageWeeklyPrizes.run(
        req(admin, {
          action: 'set',
          matchdayNumber: 1,
          items: [
            { position: 1, label: 'Felpa' },
            { position: 1, label: 'Altra felpa' },
          ],
        })
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('non accetta un catalogo infinito di premi', async () => {
    const troppi = Array.from({ length: MAX_WEEKLY_PRIZES + 1 }, (_, i) => ({
      position: i + 1,
      label: `Premio ${i + 1}`,
    }));

    await expect(
      adminManageWeeklyPrizes.run(req(admin, { action: 'set', matchdayNumber: 1, items: troppi }))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('ordina i premi per posizione, comunque arrivino', async () => {
    const res = (await adminManageWeeklyPrizes.run(
      req(admin, {
        action: 'set',
        matchdayNumber: 1,
        items: [
          { position: 3, label: 'Cappellino' },
          { position: 1, label: 'Felpa' },
          { position: 2, label: 'T-shirt' },
        ],
      })
    )) as { items: { position: number }[] };

    expect(res.items.map(i => i.position)).toEqual([1, 2, 3]);
  });
});

describe('assegnazione dei premi al settlement', () => {
  const admin = 'p_admin';

  beforeEach(async () => {
    await wipe();
    await seedMatchday();
    risultati.clear();
    await seedProfile(admin, 0, { role: 'admin' });
    for (let i = 0; i < 10; i++) {
      risultati.set(`m${i}`, { status: 'finished', homeGoals: 2, awayGoals: 0, htHomeGoals: 1, htAwayGoals: 0 });
    }
  });

  /** Tre giocatori con punteggi decrescenti: 10, 5 e 0 pronostici azzeccati. */
  async function treGiocatori() {
    await seedProfile('p_primo', 0, { username: 'Primo' });
    await seedProfile('p_secondo', 0, { username: 'Secondo' });
    await seedProfile('p_terzo', 0, { username: 'Terzo' });

    const mezzeGiuste = tenPredictions('1').map((p, i) =>
      i < 5 ? p : { ...p, outcome: '2' }
    );
    await submitSchedina.run(req('p_primo', { predictions: tenPredictions('1'), powerups: {} }));
    await submitSchedina.run(req('p_secondo', { predictions: mezzeGiuste, powerups: {} }));
    await submitSchedina.run(req('p_terzo', { predictions: tenPredictions('2'), powerups: {} }));
    await setDeadline(1, -60_000);
  }

  it('assegna i premi impostati dall\'admin al podio della giornata', async () => {
    await treGiocatori();
    await adminManageWeeklyPrizes.run(
      req(admin, { action: 'set', matchdayNumber: 1, items: PREMI })
    );

    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    const podio = await leggiPodio(1);
    expect(podio).toHaveLength(3);
    expect(podio.map(r => [r.position, r.userId, r.prize])).toEqual([
      [1, 'p_primo', 'Felpa firmata'],
      [2, 'p_secondo', 'T-shirt'],
      [3, 'p_terzo', 'Cappellino'],
    ]);
    expect(podio[0].username).toBe('Primo');
    expect(podio[0].points).toBeGreaterThan(podio[1].points);
    expect(podio[0].emoji).toBe('🧥');
  });

  it('senza premi impostati assegna comunque quelli di partenza', async () => {
    await treGiocatori();

    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    const podio = await leggiPodio(1);
    expect(podio.map(r => r.prize)).toEqual(DEFAULT_WEEKLY_PRIZES.map(p => p.label));
  });

  it('con meno giocatori che premi assegna solo le posizioni coperte', async () => {
    await seedProfile('p_unico', 0, { username: 'Unico' });
    await submitSchedina.run(req('p_unico', { predictions: tenPredictions('1'), powerups: {} }));
    await setDeadline(1, -60_000);
    await adminManageWeeklyPrizes.run(
      req(admin, { action: 'set', matchdayNumber: 1, items: PREMI })
    );

    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    const podio = await leggiPodio(1);
    expect(podio).toHaveLength(1);
    expect(podio[0]).toMatchObject({ position: 1, userId: 'p_unico', prize: 'Felpa firmata' });
  });

  it('le schedine di lega non entrano nel podio dei premi generali', async () => {
    await seedProfile('p_generale', 0, { username: 'Generale' });
    await seedProfile('p_dilega', 0, { username: 'DiLega' });
    await db.collection('leagues').doc('lega_premi').set({
      id: 'lega_premi', name: 'Lega Premi', isPrivate: false,
      memberIds: ['p_dilega'], ownerId: 'p_dilega',
    });

    await submitSchedina.run(req('p_generale', { predictions: tenPredictions('1'), powerups: {} }));
    await submitSchedina.run(
      req('p_dilega', { predictions: tenPredictions('1'), powerups: {}, leagueId: 'lega_premi' })
    );
    await setDeadline(1, -60_000);

    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    const podio = await leggiPodio(1);
    expect(podio.map(r => r.userId)).toEqual(['p_generale']);
  });
});
