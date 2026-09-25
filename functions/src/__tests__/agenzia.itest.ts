// ============================================
// TEST DI INTEGRAZIONE - AGENZIA DELLE QUOTE PER LEGA
//
// Chi crea una lega puo' chiedere l'agenzia con cui confrontare le quote. La
// lega resta ferma finche' l'amministratore non collega il palinsesto: se
// partisse subito giocherebbe su quote diverse da quelle promesse, ed e'
// esattamente il genere di scarto fra quello che si vede e quello che vale
// che ha gia' prodotto lamentele (Giovanni, 20/09/2026).
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../espn', () => ({
  fetchResults: vi.fn(async () => new Map()),
  fetchActiveMatchdayPool: vi.fn(async () => null),
}));

// Niente rete verso il fornitore di quote: qui interessa il ciclo di vita
// della lega, non lo scaricamento del palinsesto.
vi.mock('../realOdds', () => ({
  BOOKMAKER_PREDEFINITO: 'Goldbet IT',
  bookmakerDisponibili: vi.fn(async () => ['Goldbet IT', 'Eurobet IT']),
  fetchRealMatchdayOdds: vi.fn(async () => null),
  canonicalName: (s: string) => s.toLowerCase(),
  teamsMatch: (a: string, b: string) => a === b,
}));

const { manageLeague, adminLeghe, submitSchedina } = await import('../index');
const { db, seedMatchday, seedProfile, setDeadline, tenPredictions, wipe } = await import('./helpers');

type Req = Parameters<typeof manageLeague.run>[0];
function req(uid: string, data: unknown): Req {
  return { data, auth: { uid, token: {} } } as unknown as Req;
}

let seq = 0;
function uid(label: string): string {
  seq += 1;
  return `ag_${label}_${seq}`;
}

async function leggiLega(id: string) {
  return (await db.collection('leagues').doc(id).get()).data() as {
    stato?: string;
    bookmaker?: string | null;
    agenziaRichiesta?: string | null;
  };
}

/** Quote predefinite della giornata seminata, per ricopiarle su un'agenzia. */
async function leggiQuote() {
  const md = (await db.collection('matchdays').doc('1').get()).data() as {
    odds: Record<string, unknown>;
  };
  return { odds: md.odds };
}

describe('lega con agenzia richiesta', () => {
  beforeEach(async () => {
    await wipe();
    await seedMatchday();
    await setDeadline(1, 60 * 60 * 1000);
  });

  it('senza agenzia la lega nasce gia attiva', async () => {
    const u = uid('semplice');
    await seedProfile(u, 1000);

    const res = (await manageLeague.run(
      req(u, { action: 'create', name: 'Amici', description: '', isPrivate: true, maxMembers: 10 })
    )) as { leagueId: string; stato: string };

    expect(res.stato).toBe('attiva');
    const lega = await leggiLega(res.leagueId);
    expect(lega.stato).toBe('attiva');
    expect(lega.bookmaker ?? null).toBeNull();
  });

  it('con l agenzia richiesta la lega resta in attesa', async () => {
    const u = uid('attesa');
    await seedProfile(u, 1000);

    const res = (await manageLeague.run(
      req(u, {
        action: 'create',
        name: 'Bar Sport',
        description: '',
        isPrivate: true,
        maxMembers: 10,
        agenziaRichiesta: 'Sisal',
      })
    )) as { leagueId: string; stato: string };

    expect(res.stato).toBe('in_attesa');
    const lega = await leggiLega(res.leagueId);
    expect(lega.stato).toBe('in_attesa');
    expect(lega.agenziaRichiesta).toBe('Sisal');
  });

  it('una lega in attesa non accetta schedine', async () => {
    const u = uid('bloccata');
    await seedProfile(u, 1000);
    const { leagueId } = (await manageLeague.run(
      req(u, {
        action: 'create', name: 'Ferma', description: '', isPrivate: true,
        maxMembers: 10, agenziaRichiesta: 'Snai',
      })
    )) as { leagueId: string };

    await expect(
      submitSchedina.run(req(u, { predictions: tenPredictions(), leagueId }) as never)
    ).rejects.toThrow(/attesa/i);
  });

  it('l amministratore assegna l agenzia e la lega parte', async () => {
    const capo = uid('capo');
    const admin = uid('admin');
    await seedProfile(capo, 1000);
    await seedProfile(admin, 0, { role: 'admin' });
    const { leagueId } = (await manageLeague.run(
      req(capo, {
        action: 'create', name: 'Da attivare', description: '', isPrivate: true,
        maxMembers: 10, agenziaRichiesta: 'eurobet',
      })
    )) as { leagueId: string };

    const elenco = (await adminLeghe.run(req(admin, { action: 'elenco' }) as never)) as {
      agenzieDisponibili: string[];
      leghe: { id: string; agenziaRichiesta: string }[];
    };
    expect(elenco.agenzieDisponibili).toContain('Eurobet IT');
    expect(elenco.leghe.map(l => l.id)).toContain(leagueId);

    await adminLeghe.run(
      req(admin, { action: 'assegna', leagueId, bookmaker: 'Eurobet IT' }) as never
    );

    const lega = await leggiLega(leagueId);
    expect(lega.stato).toBe('attiva');
    expect(lega.bookmaker).toBe('Eurobet IT');

    // Finche' il palinsesto dell'agenzia non c'e', la lega non gioca: niente
    // ripiego sulle quote dell'agenzia predefinita.
    await expect(
      submitSchedina.run(req(capo, { predictions: tenPredictions(), leagueId }) as never)
    ).rejects.toThrow(/Mercato non valido/i);

    // Arrivate le quote dell'agenzia, la schedina di lega si puo' inviare.
    const { odds } = await leggiQuote();
    await db.collection('matchdays').doc('1').update({ oddsPerBookmaker: { 'Eurobet IT': odds } });
    await submitSchedina.run(req(capo, { predictions: tenPredictions(), leagueId }) as never);
  });

  it('una partita che l agenzia della lega non quota non si gioca in quella lega', async () => {
    const capo = uid('buco');
    const admin = uid('admin4');
    await seedProfile(capo, 1000);
    await seedProfile(admin, 0, { role: 'admin' });
    const { leagueId } = (await manageLeague.run(
      req(capo, {
        action: 'create', name: 'Buco', description: '', isPrivate: true,
        maxMembers: 10, agenziaRichiesta: 'eurobet',
      })
    )) as { leagueId: string };
    await adminLeghe.run(
      req(admin, { action: 'assegna', leagueId, bookmaker: 'Eurobet IT' }) as never
    );

    // L'agenzia quota tutte le partite tranne m3: la predefinita ce l'ha, ma
    // in questa lega non vale.
    const { odds } = await leggiQuote();
    const senzaM3 = { ...odds };
    delete senzaM3.m3;
    await db.collection('matchdays').doc('1').update({ oddsPerBookmaker: { 'Eurobet IT': senzaM3 } });

    await expect(
      submitSchedina.run(req(capo, { predictions: tenPredictions(), leagueId }) as never)
    ).rejects.toThrow(/Mercato non valido/i);
  });

  it('non si riassegna l agenzia di una lega gia attiva', async () => {
    const capo = uid('gia');
    const admin = uid('admin5');
    await seedProfile(capo, 1000);
    await seedProfile(admin, 0, { role: 'admin' });
    const { leagueId } = (await manageLeague.run(
      req(capo, { action: 'create', name: 'Gia attiva', description: '', isPrivate: true, maxMembers: 10 })
    )) as { leagueId: string };

    await expect(
      adminLeghe.run(req(admin, { action: 'assegna', leagueId, bookmaker: 'Eurobet IT' }) as never)
    ).rejects.toThrow(/non è in attesa/i);
    await expect(
      adminLeghe.run(req(admin, { action: 'rifiuta', leagueId }) as never)
    ).rejects.toThrow(/non è in attesa/i);

    const lega = await leggiLega(leagueId);
    expect(lega.bookmaker ?? null).toBeNull();
  });

  it('non si puo assegnare un agenzia fuori dal piano', async () => {
    const capo = uid('fuori');
    const admin = uid('admin2');
    await seedProfile(capo, 1000);
    await seedProfile(admin, 0, { role: 'admin' });
    const { leagueId } = (await manageLeague.run(
      req(capo, {
        action: 'create', name: 'Impossibile', description: '', isPrivate: true,
        maxMembers: 10, agenziaRichiesta: 'Bet365',
      })
    )) as { leagueId: string };

    await expect(
      adminLeghe.run(req(admin, { action: 'assegna', leagueId, bookmaker: 'Bet365' }) as never)
    ).rejects.toThrow(/non disponibile/i);

    expect((await leggiLega(leagueId)).stato).toBe('in_attesa');
  });

  it('rifiutando l agenzia la lega parte sulle quote standard', async () => {
    const capo = uid('standard');
    const admin = uid('admin3');
    await seedProfile(capo, 1000);
    await seedProfile(admin, 0, { role: 'admin' });
    const { leagueId } = (await manageLeague.run(
      req(capo, {
        action: 'create', name: 'Ripiego', description: '', isPrivate: true,
        maxMembers: 10, agenziaRichiesta: 'Agenzia sotto casa',
      })
    )) as { leagueId: string };

    await adminLeghe.run(req(admin, { action: 'rifiuta', leagueId }) as never);

    const lega = await leggiLega(leagueId);
    expect(lega.stato).toBe('attiva');
    expect(lega.bookmaker ?? null).toBeNull();
  });

  it('solo un amministratore vede e attiva le leghe', async () => {
    const tizio = uid('curioso');
    await seedProfile(tizio, 0);
    await expect(
      adminLeghe.run(req(tizio, { action: 'elenco' }) as never)
    ).rejects.toThrow();
  });
});
