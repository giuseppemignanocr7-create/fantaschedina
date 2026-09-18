// ============================================
// TEST DI INTEGRAZIONE — MINIGIOCHI
// Il client dichiara il proprio risultato: qui si verifica che il server non
// gli creda sulla parola e che nessun payload strano finisca sul saldo.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest';
import { playMinigame } from '../index';
import { COINS } from '../config';
import { coinsOf, readProfile, seedProfile, todayRome, walletOf, wipe } from './helpers';
import { STREAK } from '../config';
import { giornoPrecedente } from '../streak';

type CallableReq = Parameters<typeof playMinigame.run>[0];

function req(uid: string, data: unknown): CallableReq {
  return { data, auth: { uid, token: {} } } as unknown as CallableReq;
}

let seq = 0;
function freshUid(label: string): string {
  seq += 1;
  return `g_${label}_${seq}`;
}

const TEMPO_LIVELLO_1 = COINS.memoriaLevelTimes[0];

describe('memoria_play — risultato dichiarato dal client', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('limita il bonus tempo al tempo disponibile nei livelli dichiarati', async () => {
    const uid = freshUid('bugiardo');
    await seedProfile(uid, 0);

    const res = (await playMinigame.run(
      req(uid, { action: 'memoria_play', levelsCompleted: 1, timeRemaining: 99_999 })
    )) as { reward: number; timeBonus: number; timeRemaining: number };

    const bonusMassimo = Math.floor(TEMPO_LIVELLO_1 / 5) * COINS.memoriaTimeBonus;
    expect(res.timeRemaining).toBe(TEMPO_LIVELLO_1);
    expect(res.timeBonus).toBe(bonusMassimo);
    expect(await coinsOf(uid)).toBe(COINS.memoriaPerLevel + bonusMassimo);
  });

  it.each([
    ['stringa', 'tantissimo'],
    ['NaN', NaN],
    ['null', null],
    ['oggetto', { hack: true }],
  ])('un tempo residuo %s non corrompe il saldo', async (_label, timeRemaining) => {
    const uid = freshUid('sporco');
    await seedProfile(uid, 0);

    await playMinigame.run(
      req(uid, { action: 'memoria_play', levelsCompleted: 1, timeRemaining })
    );

    const gettoni = await coinsOf(uid);
    expect(Number.isFinite(gettoni)).toBe(true);
    expect(gettoni).toBe(COINS.memoriaPerLevel);
  });

  it('non accetta più livelli di quelli esistenti', async () => {
    const uid = freshUid('troppilivelli');
    await seedProfile(uid, 0);

    const res = (await playMinigame.run(
      req(uid, { action: 'memoria_play', levelsCompleted: 99, timeRemaining: 0 })
    )) as { levelsCompleted: number };

    expect(res.levelsCompleted).toBe(COINS.memoriaLevelTimes.length);
  });

  it('rifiuta chi non ha completato nemmeno un livello', async () => {
    const uid = freshUid('zerolivelli');
    await seedProfile(uid, 0);

    await expect(
      playMinigame.run(req(uid, { action: 'memoria_play', levelsCompleted: 0, timeRemaining: 10 }))
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    expect(await coinsOf(uid)).toBe(0);
  });

  it('rispetta il tetto giornaliero', async () => {
    const uid = freshUid('quasialtetto');
    const residuo = 3;
    await seedProfile(uid, 0, {
      memoriaDate: todayRome(),
      memoriaCoinsToday: COINS.memoriaDailyCap - residuo,
    });

    const res = (await playMinigame.run(
      req(uid, { action: 'memoria_play', levelsCompleted: 3, timeRemaining: 60 })
    )) as { reward: number };

    expect(res.reward).toBe(residuo);
    expect(await coinsOf(uid)).toBe(residuo);
    expect((await readProfile(uid)).memoriaCoinsToday).toBe(COINS.memoriaDailyCap);
  });
});

describe('rigori_play — tiri dichiarati dal client', () => {
  beforeEach(async () => {
    await wipe();
  });

  function tiri(power: unknown) {
    return Array.from({ length: COINS.rigoriMaxShots }, () => ({ zone: 'TL', power }));
  }

  it('accetta cinque tiri validi e paga entro il tetto', async () => {
    const uid = freshUid('tiratore');
    await seedProfile(uid, 0);

    const res = (await playMinigame.run(
      req(uid, { action: 'rigori_play', shots: tiri(80) })
    )) as { goals: number; reward: number };

    expect(res.goals).toBeGreaterThanOrEqual(0);
    expect(res.goals).toBeLessThanOrEqual(COINS.rigoriMaxShots);
    expect(res.reward).toBe(res.goals * COINS.rigoriPerGoal);
    expect(await coinsOf(uid)).toBe(res.reward);
  });

  it.each([
    ['NaN', NaN],
    ['stringa', 'fortissimo'],
    ['null', null],
  ])('rifiuta una potenza %s', async (_label, power) => {
    const uid = freshUid('potenzafinta');
    await seedProfile(uid, 0);

    await expect(
      playMinigame.run(req(uid, { action: 'rigori_play', shots: tiri(power) }))
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    expect(await coinsOf(uid)).toBe(0);
  });

  it('rifiuta un numero di tiri diverso da quello previsto', async () => {
    const uid = freshUid('troppitiri');
    await seedProfile(uid, 0);

    await expect(
      playMinigame.run(req(uid, { action: 'rigori_play', shots: [{ zone: 'TL', power: 50 }] }))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

// ============================================
// SERIE GIORNALIERA
// Il bonus e' gettoni veri: interessano il fatto che si incassi una volta
// sola al giorno, che continui se si e' giocato ieri e che riparta da capo
// dopo un giorno saltato.
// ============================================

describe('serie giornaliera', () => {
  beforeEach(async () => {
    await wipe();
  });

  /** Una partita qualsiasi: `memoria_play` non ha limiti di una al giorno. */
  async function gioca(uid: string) {
    return playMinigame.run(
      req(uid, { action: 'memoria_play', levelsCompleted: 1, timeRemaining: 0 })
    ) as Promise<{ serie?: { giorni: number; bonus: number } }>;
  }

  it('la prima partita del giorno apre la serie e paga il bonus', async () => {
    const uid = freshUid('serie_prima');
    await seedProfile(uid, 0, { streakDate: null, streakDays: 0 });

    const res = await gioca(uid);

    expect(res.serie).toEqual({ giorni: 1, bonus: STREAK.bonusPerGiorno });
    const profilo = await readProfile(uid);
    expect(profilo.streakDays).toBe(1);
    expect(profilo.streakDate as unknown as string).toBe(todayRome());
    expect(await coinsOf(uid)).toBe(COINS.memoriaPerLevel + STREAK.bonusPerGiorno);
  });

  it('la seconda partita dello stesso giorno non paga di nuovo', async () => {
    const uid = freshUid('serie_doppia');
    await seedProfile(uid, 0, { streakDate: null, streakDays: 0 });

    await gioca(uid);
    const res = await gioca(uid);

    expect(res.serie).toEqual({ giorni: 1, bonus: 0 });
    const movimenti = (await walletOf(uid)).filter(m => m.reason === 'serie_giornaliera');
    expect(movimenti).toHaveLength(1);
    expect(movimenti[0].amount).toBe(STREAK.bonusPerGiorno);
  });

  it('avendo giocato ieri la serie continua e il bonus cresce', async () => {
    const uid = freshUid('serie_continua');
    await seedProfile(uid, 0, { streakDate: giornoPrecedente(todayRome()), streakDays: 3 });

    const res = await gioca(uid);

    expect(res.serie?.giorni).toBe(4);
    expect(res.serie?.bonus).toBe(Math.min(4 * STREAK.bonusPerGiorno, STREAK.bonusMassimo));
    expect((await readProfile(uid)).streakDays).toBe(4);
  });

  it('dopo un giorno saltato la serie riparte da uno', async () => {
    const uid = freshUid('serie_persa');
    const altroIeri = giornoPrecedente(giornoPrecedente(todayRome()));
    await seedProfile(uid, 0, { streakDate: altroIeri, streakDays: 9 });

    const res = await gioca(uid);

    expect(res.serie).toEqual({ giorni: 1, bonus: STREAK.bonusPerGiorno });
    expect((await readProfile(uid)).streakDays).toBe(1);
  });

  it('una serie lunga non sfonda il tetto giornaliero del bonus', async () => {
    const uid = freshUid('serie_lunga');
    await seedProfile(uid, 0, { streakDate: giornoPrecedente(todayRome()), streakDays: 40 });

    const res = await gioca(uid);

    expect(res.serie?.bonus).toBe(STREAK.bonusMassimo);
  });
});
