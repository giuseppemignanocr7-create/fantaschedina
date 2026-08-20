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
import { submitSchedina, changePrediction, cancelSchedina } from '../index';
import { POWERUPS } from '../config';
import {
  coinsOf,
  readProfile,
  readSchedina,
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
