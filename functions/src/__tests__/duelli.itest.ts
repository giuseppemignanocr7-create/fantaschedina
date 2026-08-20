// ============================================
// TEST DI INTEGRAZIONE — DUELLI RIGORI 1v1
// Verificano il tetto giornaliero sui premi: un duello contro il bot dura
// circa un minuto, quindi senza tetto è la sorgente di gettoni più redditizia
// del gioco (audit del 20/08/2026).
// ============================================

import { beforeEach, describe, expect, it } from 'vitest';
import { managePenaltyDuel, cleanupPenaltyDuels } from '../index';
import { COINS } from '../config';
import {
  coinsOf,
  db,
  readProfile,
  readDuello,
  seedDuello,
  seedDuelloQuasiFinito,
  seedProfile,
  todayRome,
  walletOf,
  wipe,
} from './helpers';

type CallableReq = Parameters<typeof managePenaltyDuel.run>[0];

function req(uid: string, data: unknown): CallableReq {
  return { data, auth: { uid, token: {} } } as unknown as CallableReq;
}

let seq = 0;
function freshUid(label: string): string {
  seq += 1;
  return `d_${label}_${seq}`;
}

/** Chiude il duello seminato con una sola mossa e restituisce l'esito. */
async function chiudiDuello(uid: string, duelId: string) {
  return (await managePenaltyDuel.run(
    req(uid, { action: 'move', duelId, target: 'left' })
  )) as { finished: boolean; winner: 1 | 2 | 'draw'; reward: number };
}

describe('managePenaltyDuel — premio e tetto giornaliero', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('accredita il premio pieno alla prima vittoria di giornata', async () => {
    const uid = freshUid('prima');
    await seedProfile(uid, 0);
    const duelId = await seedDuelloQuasiFinito(uid);

    const res = await chiudiDuello(uid, duelId);

    expect(res).toMatchObject({ finished: true, winner: 1, reward: COINS.duelWin });
    expect(await coinsOf(uid)).toBe(COINS.duelWin);

    const profilo = await readProfile(uid);
    expect(profilo.duelCoinsToday).toBe(COINS.duelWin);
    expect(profilo.duelDate as unknown as string).toBe(todayRome());

    const movimenti = await walletOf(uid);
    expect(movimenti).toHaveLength(1);
    expect(movimenti[0]).toMatchObject({ amount: COINS.duelWin, reason: 'penalty_duel_win' });
  });

  it('taglia il premio quando il tetto giornaliero è quasi esaurito', async () => {
    const uid = freshUid('quasi');
    const residuo = 20;
    await seedProfile(uid, 0, {
      duelDate: todayRome(),
      duelCoinsToday: COINS.duelDailyCap - residuo,
    });
    const duelId = await seedDuelloQuasiFinito(uid);

    const res = await chiudiDuello(uid, duelId);

    expect(res.reward).toBe(residuo);
    expect(await coinsOf(uid)).toBe(residuo);
    expect((await readProfile(uid)).duelCoinsToday).toBe(COINS.duelDailyCap);
  });

  it('a tetto raggiunto non accredita nulla e non annuncia premi fantasma', async () => {
    const uid = freshUid('pieno');
    await seedProfile(uid, 0, {
      duelDate: todayRome(),
      duelCoinsToday: COINS.duelDailyCap,
    });
    const duelId = await seedDuelloQuasiFinito(uid);

    const res = await chiudiDuello(uid, duelId);

    expect(res).toMatchObject({ finished: true, winner: 1, reward: 0 });
    expect(await coinsOf(uid)).toBe(0);
    expect(await walletOf(uid)).toHaveLength(0);
    // Il client mostra `duel.reward` dal documento: deve dire 0, non 50.
    expect((await readDuello(duelId))?.reward).toBe(0);
  });

  it('il tetto di ieri non limita oggi', async () => {
    const uid = freshUid('ieri');
    await seedProfile(uid, 0, {
      duelDate: todayRome(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      duelCoinsToday: COINS.duelDailyCap,
    });
    const duelId = await seedDuelloQuasiFinito(uid);

    const res = await chiudiDuello(uid, duelId);

    expect(res.reward).toBe(COINS.duelWin);
    expect(await coinsOf(uid)).toBe(COINS.duelWin);
    expect((await readProfile(uid)).duelCoinsToday).toBe(COINS.duelWin);
  });

  it('il duello chiuso resta chiuso: una seconda mossa non paga due volte', async () => {
    const uid = freshUid('replay');
    await seedProfile(uid, 0);
    const duelId = await seedDuelloQuasiFinito(uid);

    await chiudiDuello(uid, duelId);
    await expect(chiudiDuello(uid, duelId)).rejects.toMatchObject({
      code: 'failed-precondition',
    });

    expect(await coinsOf(uid)).toBe(COINS.duelWin);
    expect(await walletOf(uid)).toHaveLength(1);
  });

  it('non fa entrare un estraneo nel duello altrui', async () => {
    const proprietario = freshUid('owner');
    const intruso = freshUid('intruso');
    await seedProfile(proprietario, 0);
    await seedProfile(intruso, 0);
    const duelId = await seedDuelloQuasiFinito(proprietario);

    await expect(chiudiDuello(intruso, duelId)).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(await coinsOf(intruso)).toBe(0);
  });
});

describe('managePenaltyDuel — fine partita', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('REGRESSIONE: i tiri regolari decidono la partita, senza spareggio inutile', async () => {
    const uid = freshUid('regolari');
    await seedProfile(uid, 0);
    // Round 10, tira il bot: 5-2 per il giocatore, che resta avanti comunque.
    const duelId = await seedDuelloQuasiFinito(uid);

    const res = await chiudiDuello(uid, duelId);

    expect(res).toMatchObject({ finished: true, winner: 1 });
    expect((await readDuello(duelId))?.phase).toBe('finished');
  });

  it('lo spareggio non si chiude dopo il tiro di uno solo dei due', async () => {
    const uid = freshUid('spareggio');
    await seedProfile(uid, 0);
    // Round 11: nello spareggio ha tirato solo p1, l'altro deve poter rispondere.
    const duelId = await seedDuello({
      phase: 'playing',
      p2Uid: 'bot',
    });
    await db.collection('penalty_duels').doc(duelId).update({
      mode: 'botAlternate',
      round: 11,
      attacker: 1,
      p1: { uid, username: 'Sfidante', score: 5 },
      p2: { uid: 'bot', username: 'Bot', score: 2, isBot: true },
      deadlineAt: Date.now() + 5000,
    });

    const res = (await managePenaltyDuel.run(
      req(uid, { action: 'move', duelId, target: 'left' })
    )) as { finished?: boolean };

    expect(res.finished).toBe(false);
    const duello = await readDuello(duelId);
    expect(duello?.phase).toBe('playing');
    expect(duello?.round).toBe(12);
  });
});

describe('cleanupPenaltyDuels — duelli fermi', () => {
  const ORA = 60 * 60 * 1000;

  beforeEach(async () => {
    await wipe();
  });

  /** Esegue la funzione schedulata come la invocherebbe Cloud Scheduler. */
  async function eseguiPulizia() {
    await (cleanupPenaltyDuels.run as (e: unknown) => Promise<void>)({});
  }

  it('elimina le partite in attesa che nessuno ha raggiunto', async () => {
    const vecchia = await seedDuello({ phase: 'waiting', startedAtOffsetMs: -2 * ORA });
    const recente = await seedDuello({ phase: 'waiting', startedAtOffsetMs: -5 * 60 * 1000 });

    await eseguiPulizia();

    expect(await readDuello(vecchia)).toBeNull();
    expect(await readDuello(recente)).not.toBeNull();
  });

  it('chiude come abbandonata una partita ferma, senza premio e senza sconfitte', async () => {
    const ferma = await seedDuello({
      phase: 'playing',
      p2Uid: 'p2',
      deadlineOffsetMs: -45 * 60 * 1000,
    });

    await eseguiPulizia();

    const duello = await readDuello(ferma);
    expect(duello).toMatchObject({
      phase: 'finished',
      abandoned: true,
      winner: null,
      reward: 0,
    });
  });

  it('non tocca una partita il cui round è appena scaduto', async () => {
    const viva = await seedDuello({
      phase: 'playing',
      p2Uid: 'p2',
      deadlineOffsetMs: -10 * 1000,
    });

    await eseguiPulizia();

    expect((await readDuello(viva))?.phase).toBe('playing');
  });

  it('elimina lo storico più vecchio di una settimana, non quello recente', async () => {
    const antica = await seedDuello({
      phase: 'finished',
      startedAtOffsetMs: -8 * 24 * ORA,
    });
    const ieri = await seedDuello({ phase: 'finished', startedAtOffsetMs: -24 * ORA });

    await eseguiPulizia();

    expect(await readDuello(antica)).toBeNull();
    expect(await readDuello(ieri)).not.toBeNull();
  });
});
