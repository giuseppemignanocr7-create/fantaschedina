// ============================================
// TEST DI INTEGRAZIONE — SCHEDINA E GETTONI
// Girano contro l'emulatore Firestore: `npm run test:integration`.
//
// Coprono i due percorsi che muovono davvero valore: invio/reinvio della
// schedina con i power-up, e il Cambio Last-Minute. Entrambi avevano un bug
// scoperto nell'audit del 20/08/2026 che nessun test unitario poteva vedere,
// perché stava nell'interazione fra transazione, profilo e schedina.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest';
import { FieldValue } from 'firebase-admin/firestore';
import { submitSchedina, changePrediction, cancelSchedina } from '../index';
import { POWERUPS } from '../config';
import {
  coinsOf,
  db,
  readProfile,
  readSchedina,
  seedLega,
  seedMatchday,
  seedProfile,
  setDeadline,
  tenPredictions,
  updateMatch,
  walletOf,
  wipe,
} from './helpers';

type CallableReq = Parameters<typeof submitSchedina.run>[0];

/** Richiesta autenticata minima, come la costruisce il runtime delle callable. */
function req(uid: string, data: unknown): CallableReq {
  return { data, auth: { uid, token: {} } } as unknown as CallableReq;
}

async function expectRejection(p: Promise<unknown>, code: string): Promise<void> {
  await expect(p).rejects.toMatchObject({ code });
}

const JOLLY = POWERUPS.jolly.cost;
const SHIELD = POWERUPS.shield.cost;
const INSURANCE = POWERUPS.insurance.cost;
const LASTMINUTE = POWERUPS.lastminute.cost;

let seq = 0;
/** Un uid nuovo per test: i rate limit sono per utente e non vanno condivisi. */
function freshUid(label: string): string {
  seq += 1;
  return `u_${label}_${seq}`;
}

describe('submitSchedina — invio e power-up', () => {
  beforeEach(async () => {
    await wipe();
    await seedMatchday();
  });

  it('addebita i power-up e salva la schedina con le quote ufficiali', async () => {
    const uid = freshUid('primo');
    await seedProfile(uid, 1000);

    const res = await submitSchedina.run(
      req(uid, { predictions: tenPredictions(), powerups: { jolly: 'm0', shield: true } })
    );

    expect(res).toMatchObject({ ok: true, matchday: 1, coinsSpent: JOLLY + SHIELD });
    expect(await coinsOf(uid)).toBe(1000 - JOLLY - SHIELD);

    const schedina = await readSchedina(uid, 1);
    expect(schedina).toMatchObject({ userId: uid, settled: false, lastMinuteUsed: false });
    // La quota inviata dal client (99) va ignorata a favore di quella ufficiale.
    const predictions = schedina?.predictions as { odds: number }[];
    expect(predictions).toHaveLength(10);
    expect(predictions.every(p => p.odds === 2.0)).toBe(true);

    const movimenti = await walletOf(uid);
    expect(movimenti).toHaveLength(1);
    expect(movimenti[0]).toMatchObject({ amount: -(JOLLY + SHIELD), reason: 'powerups_g1' });
  });

  it('REGRESSIONE: reinviare con gli stessi power-up non crea gettoni', async () => {
    const uid = freshUid('reinvio');
    await seedProfile(uid, 1000);
    const powerups = { jolly: 'm0', shield: true, insurance: true };
    const costo = JOLLY + SHIELD + INSURANCE;

    await submitSchedina.run(req(uid, { predictions: tenPredictions(), powerups }));
    const dopoPrimoInvio = await coinsOf(uid);
    expect(dopoPrimoInvio).toBe(1000 - costo);

    // Due reinvii: con la vecchia contabilità il saldo saliva di `costo` ognuno.
    await submitSchedina.run(req(uid, { predictions: tenPredictions('X'), powerups }));
    await submitSchedina.run(req(uid, { predictions: tenPredictions('2'), powerups }));

    expect(await coinsOf(uid)).toBe(dopoPrimoInvio);
  });

  it('un rimborso non conta come guadagno (coinsEarned resta fermo)', async () => {
    const uid = freshUid('earned');
    await seedProfile(uid, 1000);
    const powerups = { jolly: 'm0' };

    await submitSchedina.run(req(uid, { predictions: tenPredictions(), powerups }));
    await submitSchedina.run(req(uid, { predictions: tenPredictions('X'), powerups }));

    expect((await readProfile(uid)).coinsEarned).toBe(0);
  });

  it('cambiare power-up costa esattamente la differenza', async () => {
    const uid = freshUid('upgrade');
    await seedProfile(uid, 1000);

    await submitSchedina.run(
      req(uid, { predictions: tenPredictions(), powerups: { shield: true } })
    );
    await submitSchedina.run(
      req(uid, { predictions: tenPredictions(), powerups: { jolly: 'm3' } })
    );

    expect(await coinsOf(uid)).toBe(1000 - JOLLY);
    const importi = (await walletOf(uid)).map(m => m.amount).sort((a, b) => a - b);
    expect(importi).toEqual([-JOLLY, -SHIELD, SHIELD].sort((a, b) => a - b));
  });

  it('rifiuta se i gettoni non bastano e non salva nulla', async () => {
    const uid = freshUid('poveri');
    await seedProfile(uid, 100);

    await expectRejection(
      submitSchedina.run(req(uid, { predictions: tenPredictions(), powerups: { jolly: 'm0' } })),
      'failed-precondition'
    );

    expect(await coinsOf(uid)).toBe(100);
    expect(await readSchedina(uid, 1)).toBeNull();
  });

  it('rifiuta dopo la deadline', async () => {
    const uid = freshUid('tardi');
    await seedProfile(uid, 1000);
    await setDeadline(1, -60_000);

    await expectRejection(
      submitSchedina.run(req(uid, { predictions: tenPredictions(), powerups: {} })),
      'failed-precondition'
    );
  });

  it('rifiuta una partita fuori giornata e un mercato inesistente', async () => {
    const uid = freshUid('invalidi');
    await seedProfile(uid, 1000);

    const conPartitaFinta = tenPredictions();
    conPartitaFinta[0] = { ...conPartitaFinta[0], matchId: 'inesistente' };
    await expectRejection(
      submitSchedina.run(req(uid, { predictions: conPartitaFinta, powerups: {} })),
      'invalid-argument'
    );

    const conMercatoFinto = tenPredictions();
    conMercatoFinto[0] = { ...conMercatoFinto[0], outcome: 'NON_ESISTE' };
    await expectRejection(
      submitSchedina.run(req(uid, { predictions: conMercatoFinto, powerups: {} })),
      'invalid-argument'
    );
  });

  it('rifiuta mercati ed esiti pescati dal prototipo (constructor, __proto__)', async () => {
    const uid = freshUid('prototipo');
    await seedProfile(uid, 1000);

    for (const truccato of [
      { betType: 'constructor', outcome: 'name' },
      { betType: 'esito', outcome: '__proto__' },
      { betType: 'esito', outcome: 'constructor' },
      { betType: 'esito', outcome: 'toString' },
      { betType: '__proto__', outcome: '1' },
    ]) {
      const preds = tenPredictions();
      preds[0] = { ...preds[0], ...truccato };
      await expectRejection(
        submitSchedina.run(req(uid, { predictions: preds, powerups: {} })),
        'invalid-argument'
      );
    }
    expect(await readSchedina(uid, 1)).toBeNull();
  });

  it('rifiuta pronostici non stringa, doppioni e quote sotto 1.25', async () => {
    const uid = freshUid('malformati');
    await seedProfile(uid, 1000);

    const numerico = tenPredictions();
    numerico[0] = { ...numerico[0], outcome: 1 };
    await expectRejection(
      submitSchedina.run(req(uid, { predictions: numerico, powerups: {} })),
      'invalid-argument'
    );

    const doppione = tenPredictions();
    doppione[1] = { ...doppione[1], matchId: 'm0' };
    await expectRejection(
      submitSchedina.run(req(uid, { predictions: doppione, powerups: {} })),
      'invalid-argument'
    );

    // Multigoal O0.5 e' quotato 1.10 nel seed: sotto la soglia minima.
    const bassa = tenPredictions();
    bassa[0] = { ...bassa[0], betType: 'multigoal', outcome: 'O0.5' };
    await expect(
      submitSchedina.run(req(uid, { predictions: bassa, powerups: {} }))
    ).rejects.toMatchObject({ code: 'invalid-argument', message: expect.stringContaining('1.25') });
  });

  it('rifiuta una partita gia\' iniziata', async () => {
    const uid = freshUid('giainiziata');
    await seedProfile(uid, 1000);
    await updateMatch(1, 'm0', { kickoffOffsetMs: -60_000, status: 'live' });

    await expectRejection(
      submitSchedina.run(req(uid, { predictions: tenPredictions(), powerups: {} })),
      'failed-precondition'
    );
  });

  it('con meno di dieci partite quotate chiede un pronostico per ciascuna', async () => {
    const uid = freshUid('pochequote');
    await seedProfile(uid, 1000);
    // L'agenzia non quota l'esito di m8 e m9: si giocano otto partite.
    await db.collection('matchdays').doc('1').update({
      'odds.m8.esito': FieldValue.delete(),
      'odds.m9.esito': FieldValue.delete(),
    });

    // Dieci pronostici (su m8 e m9 un mercato ancora quotato) sono troppi.
    const dieci = tenPredictions().map(p =>
      p.matchId === 'm8' || p.matchId === 'm9' ? { ...p, betType: 'over_under', outcome: 'OVER' } : p
    );
    await expect(
      submitSchedina.run(req(uid, { predictions: dieci, powerups: {} }))
    ).rejects.toMatchObject({ code: 'invalid-argument', message: expect.stringContaining('8') });

    const otto = tenPredictions().slice(0, 8);
    await expect(
      submitSchedina.run(req(uid, { predictions: otto, powerups: {} }))
    ).resolves.toMatchObject({ ok: true });
    expect((await readSchedina(uid, 1))?.predictions).toHaveLength(8);
  });

  it('il Jolly va su una delle partite giocate', async () => {
    const uid = freshUid('jollyfuori');
    await seedProfile(uid, 1000);
    await db.collection('matchdays').doc('1').update({
      'odds.m8.esito': FieldValue.delete(),
    });
    // m8 e' della giornata ma non e' nella schedina (solo nove quotate).
    const nove = tenPredictions().filter(p => p.matchId !== 'm8');
    await expectRejection(
      submitSchedina.run(req(uid, { predictions: nove, powerups: { jolly: 'm8' } })),
      'invalid-argument'
    );
    expect(await coinsOf(uid)).toBe(1000);
  });

  it('un utente sospeso non puo\' inviare', async () => {
    const uid = freshUid('sospeso');
    await seedProfile(uid, 1000, { isActive: false });

    await expectRejection(
      submitSchedina.run(req(uid, { predictions: tenPredictions(), powerups: {} })),
      'permission-denied'
    );
  });

  it('cancelSchedina rimborsa i power-up ed elimina la schedina', async () => {
    const uid = freshUid('annulla');
    await seedProfile(uid, 1000);

    await submitSchedina.run(
      req(uid, { predictions: tenPredictions(), powerups: { jolly: 'm0', insurance: true } })
    );
    await cancelSchedina.run(req(uid, {}));

    expect(await coinsOf(uid)).toBe(1000);
    expect((await readProfile(uid)).coinsEarned).toBe(0);
    expect(await readSchedina(uid, 1)).toBeNull();
  });
});

describe('changePrediction — power-up Cambio Last-Minute', () => {
  beforeEach(async () => {
    await wipe();
    await seedMatchday();
  });

  /** Schedina inviata e deadline spostata nel passato: la finestra è aperta. */
  async function schedinaDopoDeadline(uid: string, coins = 1000): Promise<void> {
    await seedProfile(uid, coins);
    await submitSchedina.run(req(uid, { predictions: tenPredictions(), powerups: {} }));
    await setDeadline(1, -60_000);
  }

  it('prima della deadline rifiuta: lì la schedina si rimanda gratis', async () => {
    const uid = freshUid('presto');
    await seedProfile(uid, 1000);
    await submitSchedina.run(req(uid, { predictions: tenPredictions(), powerups: {} }));

    await expectRejection(
      changePrediction.run(req(uid, { matchId: 'm0', betType: 'esito', outcome: 'X' })),
      'failed-precondition'
    );
    expect(await coinsOf(uid)).toBe(1000);
  });

  it('dopo la deadline addebita il power-up, cambia il pronostico e lo consuma', async () => {
    const uid = freshUid('cambio');
    await schedinaDopoDeadline(uid);

    const res = await changePrediction.run(
      req(uid, { matchId: 'm0', betType: 'over_under', outcome: 'OVER' })
    );

    expect(res).toMatchObject({ ok: true, coinsSpent: LASTMINUTE });
    expect(await coinsOf(uid)).toBe(1000 - LASTMINUTE);

    const schedina = await readSchedina(uid, 1);
    expect(schedina?.lastMinuteUsed).toBe(true);
    const predictions = schedina?.predictions as {
      matchId: string;
      betType: string;
      outcome: string;
      odds: number;
    }[];
    expect(predictions.find(p => p.matchId === 'm0')).toEqual({
      matchId: 'm0',
      betType: 'over_under',
      outcome: 'OVER',
      odds: 1.9,
    });

    expect((await walletOf(uid)).map(m => m.reason)).toContain('powerup_lastminute_g1');
  });

  it('si può usare una volta sola per schedina', async () => {
    const uid = freshUid('bis');
    await schedinaDopoDeadline(uid);

    await changePrediction.run(req(uid, { matchId: 'm0', betType: 'esito', outcome: 'X' }));
    await expectRejection(
      changePrediction.run(req(uid, { matchId: 'm1', betType: 'esito', outcome: 'X' })),
      'failed-precondition'
    );

    expect(await coinsOf(uid)).toBe(1000 - LASTMINUTE);
  });

  it('rifiuta su una partita già iniziata', async () => {
    const uid = freshUid('iniziata');
    await schedinaDopoDeadline(uid);
    await updateMatch(1, 'm0', { kickoffOffsetMs: -60_000, status: 'live' });

    await expectRejection(
      changePrediction.run(req(uid, { matchId: 'm0', betType: 'esito', outcome: 'X' })),
      'failed-precondition'
    );
    expect(await coinsOf(uid)).toBe(1000);
    expect((await readSchedina(uid, 1))?.lastMinuteUsed).toBe(false);
  });

  it('rifiuta senza gettoni sufficienti', async () => {
    const uid = freshUid('squattrinato');
    await schedinaDopoDeadline(uid, LASTMINUTE - 1);

    await expectRejection(
      changePrediction.run(req(uid, { matchId: 'm0', betType: 'esito', outcome: 'X' })),
      'failed-precondition'
    );
    expect((await readSchedina(uid, 1))?.lastMinuteUsed).toBe(false);
  });

  it('rifiuta esiti pescati dal prototipo e quote sotto 1.25', async () => {
    const uid = freshUid('cambiotruccato');
    await schedinaDopoDeadline(uid);

    await expectRejection(
      changePrediction.run(req(uid, { matchId: 'm0', betType: 'esito', outcome: '__proto__' })),
      'invalid-argument'
    );
    await expectRejection(
      changePrediction.run(req(uid, { matchId: 'm0', betType: 'constructor', outcome: 'name' })),
      'invalid-argument'
    );
    await expectRejection(
      changePrediction.run(req(uid, { matchId: 'm0', betType: 'multigoal', outcome: 'O0.5' })),
      'invalid-argument'
    );
    expect(await coinsOf(uid)).toBe(1000);
    expect((await readSchedina(uid, 1))?.lastMinuteUsed).toBe(false);
  });

  it('in una lega con la sua agenzia cambia sulle quote di quell\'agenzia', async () => {
    const uid = freshUid('cambiolega');
    await seedProfile(uid, 1000);
    await seedLega('lega_agenzia', [uid]);
    await db.collection('leagues').doc('lega_agenzia').update({ bookmaker: 'Agenzia Test' });
    const odds = (await db.collection('matchdays').doc('1').get()).data()?.odds as Record<
      string,
      Record<string, Record<string, number>>
    >;
    const agenzia = JSON.parse(JSON.stringify(odds)) as typeof odds;
    agenzia.m0.over_under.OVER = 2.2;
    await db.collection('matchdays').doc('1').update({
      oddsPerBookmaker: { 'Agenzia Test': agenzia },
    });

    await submitSchedina.run(
      req(uid, { predictions: tenPredictions(), powerups: {}, leagueId: 'lega_agenzia' })
    );
    await setDeadline(1, -60_000);

    await changePrediction.run(
      req(uid, { matchId: 'm0', betType: 'over_under', outcome: 'OVER', leagueId: 'lega_agenzia' })
    );
    const s = await db.collection('schedine').doc(`${uid}_1_lega_agenzia`).get();
    const m0 = (s.data()?.predictions as { matchId: string; odds: number }[]).find(
      p => p.matchId === 'm0'
    );
    expect(m0?.odds).toBe(2.2);
  });

  it('un utente sospeso non puo\' usare il Cambio Last-Minute', async () => {
    const uid = freshUid('cambiosospeso');
    await schedinaDopoDeadline(uid);
    await db.collection('profiles').doc(uid).update({ isActive: false });

    await expectRejection(
      changePrediction.run(req(uid, { matchId: 'm0', betType: 'esito', outcome: 'X' })),
      'permission-denied'
    );
    expect(await coinsOf(uid)).toBe(1000);
  });

  it('rifiuta un mercato inesistente senza addebitare nulla', async () => {
    const uid = freshUid('mercato');
    await schedinaDopoDeadline(uid);

    await expectRejection(
      changePrediction.run(req(uid, { matchId: 'm0', betType: 'esito', outcome: 'ZZ' })),
      'invalid-argument'
    );
    expect(await coinsOf(uid)).toBe(1000);
  });
});
