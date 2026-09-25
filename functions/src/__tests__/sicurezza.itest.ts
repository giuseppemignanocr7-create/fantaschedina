// ============================================
// TEST DI INTEGRAZIONE — LEGHE: INGRESSO, INVITI, CONTATORI, TETTI
//
// - entrare in una lega e' idempotente: ripetere la richiesta non e' errore
// - un link d'invito mostra la lega prima di farci entrare (anteprimaInvito)
// - leaguesJoined conta leghe distinte: uscire e rientrare non lo gonfia
// - non piu' di 3 leghe in attesa dell'agenzia per creatore
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../espn', () => ({
  fetchResults: vi.fn(async () => new Map()),
  fetchActiveMatchdayPool: vi.fn(async () => null),
}));

const { manageLeague, onLeagueWritten } = await import('../index');
const { db, readProfile, seedLega, seedProfile, wipe } = await import('./helpers');

type Req = Parameters<typeof manageLeague.run>[0];
function req(uid: string, data: unknown): Req {
  return { data, auth: { uid, token: {} } } as unknown as Req;
}

// Il codice di seedLega (ABC123) contiene "1", che l'alfabeto degli inviti
// esclude: qui serve un codice che il server accetti.
const CODICE = 'ABC234';
async function legaConCodice(id: string, membri: string[], opts: { name?: string } = {}) {
  await seedLega(id, membri, { isPrivate: true, ...opts });
  await db.collection('leagues').doc(id).update({ inviteCode: CODICE });
}

/** Evento finto del trigger sulle leghe: interessano solo i membri prima e dopo. */
function eventoLega(leagueId: string, prima: string[], dopo: string[]) {
  return {
    params: { leagueId },
    data: {
      before: { data: () => ({ memberIds: prima }) },
      after: { data: () => ({ memberIds: dopo }) },
    },
  } as never;
}

describe('leghe: ingresso e inviti', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('entrare due volte con lo stesso codice non e un errore e non duplica il membro', async () => {
    await seedProfile('s_capo');
    await seedProfile('s_ospite');
    await legaConCodice('s_lega', ['s_capo']);

    const primo = (await manageLeague.run(
      req('s_ospite', { action: 'joinByCode', inviteCode: CODICE })
    )) as { giaMembro: boolean };
    const secondo = (await manageLeague.run(
      req('s_ospite', { action: 'joinByCode', inviteCode: CODICE })
    )) as { giaMembro: boolean };

    expect(primo.giaMembro).toBe(false);
    expect(secondo.giaMembro).toBe(true);
    const lega = (await db.collection('leagues').doc('s_lega').get()).data();
    expect(lega?.memberIds).toEqual(['s_capo', 's_ospite']);
    expect(lega?.memberCount).toBe(2);
  });

  it('l anteprima dell invito mostra la lega senza far entrare', async () => {
    await seedProfile('s_capo');
    await seedProfile('s_curioso');
    await legaConCodice('s_lega', ['s_capo'], { name: 'Bar Sport' });

    const anteprima = (await manageLeague.run(
      req('s_curioso', { action: 'anteprimaInvito', inviteCode: CODICE.toLowerCase() })
    )) as { leagueId: string; name: string; memberCount: number; giaMembro: boolean };

    expect(anteprima).toMatchObject({
      leagueId: 's_lega',
      name: 'Bar Sport',
      memberCount: 1,
      giaMembro: false,
    });
    const lega = (await db.collection('leagues').doc('s_lega').get()).data();
    expect(lega?.memberIds).toEqual(['s_capo']);
  });

  it('entrare in una lega pubblica due volte resta idempotente', async () => {
    await seedProfile('s_capo');
    await seedProfile('s_ospite');
    await seedLega('s_pub', ['s_capo'], { isPrivate: false });

    await manageLeague.run(req('s_ospite', { action: 'joinPublic', leagueId: 's_pub' }));
    const res = (await manageLeague.run(
      req('s_ospite', { action: 'joinPublic', leagueId: 's_pub' })
    )) as { giaMembro: boolean };

    expect(res.giaMembro).toBe(true);
    expect((await db.collection('leagues').doc('s_pub').get()).data()?.memberCount).toBe(2);
  });
});

describe('leaguesJoined conta leghe distinte', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('uscire e rientrare nella stessa lega non incrementa di nuovo', async () => {
    await seedProfile('s_giro');

    await onLeagueWritten.run(eventoLega('s_l1', [], ['s_giro']));
    await onLeagueWritten.run(eventoLega('s_l1', ['s_giro'], []));
    await onLeagueWritten.run(eventoLega('s_l1', [], ['s_giro']));
    // Trigger consegnato due volte: stesso effetto.
    await onLeagueWritten.run(eventoLega('s_l1', [], ['s_giro']));
    expect((await readProfile('s_giro')).leaguesJoined).toBe(1);

    await onLeagueWritten.run(eventoLega('s_l2', [], ['s_giro']));
    expect((await readProfile('s_giro')).leaguesJoined).toBe(2);
  });

  it('non ricrea il profilo di chi non c e piu', async () => {
    await onLeagueWritten.run(eventoLega('s_l1', [], ['s_fantasma']));
    expect((await db.collection('profiles').doc('s_fantasma').get()).exists).toBe(false);
  });
});

describe('creazione lega: tetto alle richieste di agenzia', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('al massimo 3 leghe in attesa per creatore', async () => {
    await seedProfile('s_insistente');
    const crea = (n: number) =>
      manageLeague.run(
        req('s_insistente', {
          action: 'create',
          name: `Lega ${n}`,
          description: '',
          isPrivate: true,
          maxMembers: 10,
          agenziaRichiesta: 'Sisal',
        })
      );

    await crea(1);
    await crea(2);
    await crea(3);
    await expect(crea(4)).rejects.toMatchObject({ code: 'resource-exhausted' });

    const inAttesa = await db
      .collection('leagues')
      .where('ownerId', '==', 's_insistente')
      .where('stato', '==', 'in_attesa')
      .get();
    expect(inAttesa.size).toBe(3);
  });
});
