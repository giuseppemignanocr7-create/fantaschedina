// ============================================
// TEST DI INTEGRAZIONE — SETTLEMENT
// La valutazione di una giornata è il punto in cui si assegnano punti,
// gettoni e premio di giornata: qui si verifica contro un Firestore vero,
// con i risultati ESPN sostituiti da un finto (nessuna rete nei test).
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Risultati che il finto ESPN restituirà: lo riempie ogni test. */
const risultati = new Map<
  string,
  { status: string; homeGoals: number; awayGoals: number; htHomeGoals?: number; htAwayGoals?: number }
>();

vi.mock('../espn', () => ({
  fetchResults: vi.fn(async () => risultati),
  fetchActiveMatchdayPool: vi.fn(async () => null),
}));

const { adminForceSettle, buyRaffleTicket, submitSchedina } = await import('../index');
const { COINS, POWERUPS } = await import('../config');
const { RAFFLE } = await import('../raffle');
const {
  coinsOf,
  readProfile,
  readSchedina,
  seedMatchday,
  seedProfile,
  setDeadline,
  tenPredictions,
  walletOf,
  wipe,
  db,
} = await import('./helpers');

const JOLLY = POWERUPS.jolly.cost;

type CallableReq = Parameters<typeof adminForceSettle.run>[0];

function req(uid: string, data: unknown): CallableReq {
  return { data, auth: { uid, token: {} } } as unknown as CallableReq;
}

let seq = 0;
function freshUid(label: string): string {
  seq += 1;
  return `s_${label}_${seq}`;
}

/** Tutte le partite finite con lo stesso risultato. */
function tuttePartiteFinite(homeGoals: number, awayGoals: number, quante = 10): void {
  risultati.clear();
  for (let i = 0; i < quante; i++) {
    risultati.set(`m${i}`, {
      status: 'finished',
      homeGoals,
      awayGoals,
      htHomeGoals: homeGoals,
      htAwayGoals: 0,
    });
  }
}

describe('adminForceSettle — valutazione della giornata', () => {
  let admin: string;

  beforeEach(async () => {
    await wipe();
    await seedMatchday();
    admin = freshUid('admin');
    await seedProfile(admin, 0, { role: 'admin' });
    risultati.clear();
  });

  it('richiede il ruolo admin', async () => {
    const tizio = freshUid('tizio');
    await seedProfile(tizio, 0);
    tuttePartiteFinite(2, 0);

    await expect(
      adminForceSettle.run(req(tizio, { matchdayNumber: 1 }))
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('valuta le schedine, accredita punti e gettoni e assegna il premio di giornata', async () => {
    const vincitore = freshUid('vincitore');
    const perdente = freshUid('perdente');
    await seedProfile(vincitore, 0);
    await seedProfile(perdente, 0);

    // Il vincitore gioca tutti '1', il perdente tutti '2': in casa segna sempre.
    await submitSchedina.run(req(vincitore, { predictions: tenPredictions('1'), powerups: {} }));
    await submitSchedina.run(req(perdente, { predictions: tenPredictions('2'), powerups: {} }));
    await setDeadline(1, -60_000);
    tuttePartiteFinite(2, 0);

    const res = await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));
    expect(res).toMatchObject({ ok: true, matchday: 1, settled: 2 });

    const profiloVincitore = await readProfile(vincitore);
    expect(profiloVincitore.correctPredictions).toBe(10);
    expect(profiloVincitore.matchdaysPlayed).toBe(1);
    expect(profiloVincitore.perfectSchedine).toBe(1);
    expect(profiloVincitore.totalPoints).toBeGreaterThan(0);
    // 10 esatti: 2 gettoni ciascuno + bonus 10/10 + premio di giornata.
    expect(profiloVincitore.coins).toBe(
      10 * COINS.perCorrectPrediction + COINS.bonus10Correct + COINS.weeklyWinner
    );

    const profiloPerdente = await readProfile(perdente);
    expect(profiloPerdente.correctPredictions).toBe(0);
    expect(profiloPerdente.coins).toBe(0);
    expect(profiloPerdente.weeklyWins).toBe(0);

    const schedina = await readSchedina(vincitore, 1);
    expect(schedina).toMatchObject({ settled: true, correctPredictions: 10 });

    const premio = await db.collection('prizes').doc('weekly_1').get();
    expect(premio.data()).toMatchObject({ type: 'weekly_winner', winnerId: vincitore });
  });

  it('non paga due volte: la giornata già valutata viene rifiutata', async () => {
    const utente = freshUid('doppio');
    await seedProfile(utente, 0);
    await submitSchedina.run(req(utente, { predictions: tenPredictions('1'), powerups: {} }));
    await setDeadline(1, -60_000);
    tuttePartiteFinite(1, 0);

    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));
    const gettoniDopoPrimo = await coinsOf(utente);

    await expect(
      adminForceSettle.run(req(admin, { matchdayNumber: 1 }))
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    expect(await coinsOf(utente)).toBe(gettoniDopoPrimo);
  });

  it('rifiuta se ci sono partite non concluse, e le elenca', async () => {
    const utente = freshUid('incompleta');
    await seedProfile(utente, 0);
    await submitSchedina.run(req(utente, { predictions: tenPredictions('1'), powerups: {} }));
    await setDeadline(1, -60_000);

    tuttePartiteFinite(1, 0);
    risultati.set('m7', { status: 'live', homeGoals: 0, awayGoals: 0 });

    await expect(
      adminForceSettle.run(req(admin, { matchdayNumber: 1 }))
    ).rejects.toMatchObject({ code: 'failed-precondition', message: expect.stringContaining('m7') });

    // Niente valutazione, niente gettoni, giornata ancora aperta.
    expect(await coinsOf(utente)).toBe(0);
    expect((await readSchedina(utente, 1))?.settled).toBe(false);
    const md = await db.collection('matchdays').doc('1').get();
    expect(md.data()?.settled).toBe(false);
  });

  it('con force: true valuta comunque, annullando la partita aperta', async () => {
    const utente = freshUid('forzata');
    await seedProfile(utente, 0);
    await submitSchedina.run(req(utente, { predictions: tenPredictions('1'), powerups: {} }));
    await setDeadline(1, -60_000);

    tuttePartiteFinite(1, 0);
    risultati.set('m7', { status: 'live', homeGoals: 0, awayGoals: 0 });

    const res = await adminForceSettle.run(req(admin, { matchdayNumber: 1, force: true }));
    expect(res).toMatchObject({ ok: true, settled: 1 });

    const profilo = await readProfile(utente);
    expect(profilo.correctPredictions).toBe(9);
    expect(profilo.perfectSchedine).toBe(0);

    // Nessun risultato scritto per la partita non finita, pronostico annullato.
    const md = await db.collection('matchdays').doc('1').get();
    const m7 = (md.data()?.matches as { id: string; result?: unknown }[]).find(m => m.id === 'm7');
    expect(m7?.result).toBeUndefined();
    expect(md.data()).toMatchObject({ settled: true, status: 'completed' });
    const schedina = await readSchedina(utente, 1);
    const esiti = schedina?.predictionResults as { matchId: string; isVoid: boolean; isCorrect: boolean }[];
    expect(esiti.find(p => p.matchId === 'm7')).toMatchObject({ isVoid: true, isCorrect: false });
  });

  it('partita rinviata: pronostico annullato, non esatto, e il Jolly sopra torna indietro', async () => {
    const utente = freshUid('rinviata');
    await seedProfile(utente, 1000);
    await submitSchedina.run(
      req(utente, { predictions: tenPredictions('1'), powerups: { jolly: 'm3' } })
    );
    await setDeadline(1, -60_000);
    tuttePartiteFinite(2, 0);
    risultati.set('m3', { status: 'postponed', homeGoals: 0, awayGoals: 0 });

    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    const profilo = await readProfile(utente);
    // Nove esatti veri su dieci: vale il +5, non il +10.
    expect(profilo.correctPredictions).toBe(9);
    expect(profilo.perfectSchedine).toBe(0);
    expect((await readSchedina(utente, 1))?.bonusPoints).toBe(5);
    // Saldo: 1000 - Jolly + premi da 9 esatti + premio di giornata + Jolly restituito.
    expect(profilo.coins).toBe(
      1000 - JOLLY + 9 * COINS.perCorrectPrediction + COINS.bonus9Correct + COINS.weeklyWinner + JOLLY
    );
    const movimenti = await walletOf(utente);
    expect(movimenti.map(m => m.reason)).toContain('powerup_jolly_refund_g1');
    // Il registro torna col saldo.
    expect(1000 + movimenti.reduce((s, m) => s + m.amount, 0)).toBe(profilo.coins);
    // Il rimborso non e' un guadagno.
    expect(profilo.coinsEarned).toBe(
      9 * COINS.perCorrectPrediction + COINS.bonus9Correct + COINS.weeklyWinner
    );
  });

  it('manca il parziale di primo tempo: la giornata aspetta, con force il pronostico e\' annullato', async () => {
    const utente = freshUid('senzaparziale');
    await seedProfile(utente, 0);
    const predictions = tenPredictions('1').map((p, i) =>
      i === 0 ? { ...p, betType: 'esito_1t', outcome: '1' } : p
    );
    await submitSchedina.run(req(utente, { predictions, powerups: {} }));
    await setDeadline(1, -60_000);
    tuttePartiteFinite(2, 0);
    risultati.set('m0', { status: 'finished', homeGoals: 2, awayGoals: 0 });

    await expect(
      adminForceSettle.run(req(admin, { matchdayNumber: 1 }))
    ).rejects.toMatchObject({ code: 'failed-precondition', message: expect.stringContaining('m0') });
    expect((await readSchedina(utente, 1))?.settled).toBe(false);

    await adminForceSettle.run(req(admin, { matchdayNumber: 1, force: true }));
    const profilo = await readProfile(utente);
    expect(profilo.correctPredictions).toBe(9);
    expect(profilo.perfectSchedine).toBe(0);
  });

  it('estrazione: una sola volta, fra chi ha biglietti', async () => {
    const a = freshUid('bigliettiA');
    const b = freshUid('bigliettiB');
    await seedProfile(a, 1000);
    await seedProfile(b, 1000);
    await buyRaffleTicket.run(req(a, { count: 2 }));
    await buyRaffleTicket.run(req(b, { count: 1 }));
    await submitSchedina.run(req(a, { predictions: tenPredictions('1'), powerups: {} }));
    await setDeadline(1, -60_000);
    tuttePartiteFinite(2, 0);

    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    const urna = (await db.collection('raffles').doc('1').get()).data();
    expect(urna?.status).toBe('drawn');
    expect([a, b]).toContain(urna?.winnerUid);
    // Urna chiusa: niente altri biglietti.
    await expect(buyRaffleTicket.run(req(b, { count: 1 }))).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  it('estrazione senza vincitori validi: annullata e biglietti rimborsati', async () => {
    const sospeso = freshUid('bigliettiSospeso');
    await seedProfile(sospeso, 1000);
    await buyRaffleTicket.run(req(sospeso, { count: 3 }));
    expect(await coinsOf(sospeso)).toBe(1000 - 3 * RAFFLE.ticketCost);
    await db.collection('profiles').doc(sospeso).update({ isActive: false });
    await setDeadline(1, -60_000);
    tuttePartiteFinite(2, 0);

    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    const urna = (await db.collection('raffles').doc('1').get()).data();
    expect(urna?.status).toBe('annullata');
    expect(urna?.winnerUid).toBeNull();
    expect(await coinsOf(sospeso)).toBe(1000);
    expect((await walletOf(sospeso)).map(m => m.reason)).toContain('raffle_refund_g1');
    // Il rimborso non e' un guadagno.
    expect((await readProfile(sospeso)).coinsEarned).toBe(0);
  });

  it('un utente sospeso non incassa gettoni ne\' vince la giornata', async () => {
    const sospeso = freshUid('sospeso');
    const onesto = freshUid('onesto');
    await seedProfile(sospeso, 0);
    await seedProfile(onesto, 0);
    await submitSchedina.run(req(sospeso, { predictions: tenPredictions('1'), powerups: {} }));
    const cinque = tenPredictions('1').map((p, i) => (i < 5 ? p : { ...p, outcome: '2' }));
    await submitSchedina.run(req(onesto, { predictions: cinque, powerups: {} }));
    await db.collection('profiles').doc(sospeso).update({ isActive: false });
    await setDeadline(1, -60_000);
    tuttePartiteFinite(2, 0);

    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    expect(await coinsOf(sospeso)).toBe(0);
    expect((await readProfile(sospeso)).weeklyWins).toBe(0);
    const premio = await db.collection('prizes').doc('weekly_1').get();
    expect(premio.data()?.winnerId).toBe(onesto);
  });

  it('a parità di punti il premio va a chi ha consegnato prima, non a caso', async () => {
    const primo = 'z_consegna_prima';
    const secondo = 'a_consegna_dopo';
    await seedProfile(primo, 0);
    await seedProfile(secondo, 0);

    // Stessa schedina identica: stessi punti e stessi esatti. L'unico criterio
    // che li separa è l'ordine di consegna, non l'ordine dei documenti (che
    // per userId metterebbe davanti 'a_consegna_dopo').
    await submitSchedina.run(req(primo, { predictions: tenPredictions('1'), powerups: {} }));
    await submitSchedina.run(req(secondo, { predictions: tenPredictions('1'), powerups: {} }));
    await setDeadline(1, -60_000);
    tuttePartiteFinite(3, 0);

    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    const premio = await db.collection('prizes').doc('weekly_1').get();
    expect(premio.data()?.winnerId).toBe(primo);
    expect((await readProfile(primo)).weeklyWins).toBe(1);
    expect((await readProfile(secondo)).weeklyWins).toBe(0);
    expect((await readProfile(primo)).coins).toBe(
      10 * COINS.perCorrectPrediction + COINS.bonus10Correct + COINS.weeklyWinner
    );
    expect((await readProfile(secondo)).coins).toBe(
      10 * COINS.perCorrectPrediction + COINS.bonus10Correct
    );
  });

  it('valuta i mercati del primo tempo, che senza i gol di intervallo sarebbero annullati', async () => {
    const utente = freshUid('primotempo');
    await seedProfile(utente, 0);
    const predictions = tenPredictions('1').map((p, i) =>
      i === 0 ? { ...p, betType: 'esito_1t', outcome: '1' } : p
    );
    await submitSchedina.run(req(utente, { predictions, powerups: {} }));
    await setDeadline(1, -60_000);

    // 2-0 finale con 1-0 all'intervallo: il pronostico 1T è corretto.
    tuttePartiteFinite(2, 0);
    risultati.set('m0', {
      status: 'finished',
      homeGoals: 2,
      awayGoals: 0,
      htHomeGoals: 1,
      htAwayGoals: 0,
    });

    await adminForceSettle.run(req(admin, { matchdayNumber: 1 }));

    expect((await readProfile(utente)).correctPredictions).toBe(10);
  });
});
