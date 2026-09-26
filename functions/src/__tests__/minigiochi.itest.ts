// ============================================
// TEST DI INTEGRAZIONE — MINIGIOCHI
// Il client dichiara il proprio risultato: qui si verifica che il server non
// gli creda sulla parola e che nessun payload strano finisca sul saldo.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest';
import { playMinigame } from '../index';
import { COINS } from '../config';
import {
  coinsOf,
  db,
  readProfile,
  seedProfile,
  seedSessioneMinigioco,
  todayRome,
  walletOf,
  wipe,
} from './helpers';
import { STREAK } from '../config';
import { giornoPrecedente } from '../streak';
import { MEMORIA_SECONDI_MINIMI, QUIZ_DURATA_MAX_MS } from '../minigiochi';

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

/** Memoria giocata dentro una sessione aperta cinque minuti fa. */
async function giocaMemoria(uid: string, levelsCompleted: unknown, timeRemaining: unknown) {
  const sessionId = await seedSessioneMinigioco(uid, 'memoria');
  return playMinigame.run(
    req(uid, { action: 'memoria_play', sessionId, levelsCompleted, timeRemaining })
  ) as Promise<{
    reward: number;
    timeBonus: number;
    timeRemaining: number;
    levelsCompleted: number;
    serie?: { giorni: number; bonus: number };
  }>;
}

describe('memoria_play — risultato dichiarato dal client', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('limita il bonus tempo al tempo disponibile nei livelli dichiarati', async () => {
    const uid = freshUid('bugiardo');
    await seedProfile(uid, 0);

    const res = await giocaMemoria(uid, 1, 99_999);

    const residuoMassimo = TEMPO_LIVELLO_1 - MEMORIA_SECONDI_MINIMI[0];
    const bonusMassimo = Math.floor(residuoMassimo / 5) * COINS.memoriaTimeBonus;
    expect(res.timeRemaining).toBe(residuoMassimo);
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

    await giocaMemoria(uid, 1, timeRemaining);

    const gettoni = await coinsOf(uid);
    expect(Number.isFinite(gettoni)).toBe(true);
    expect(gettoni).toBe(COINS.memoriaPerLevel);
  });

  it('non accetta più livelli di quelli esistenti', async () => {
    const uid = freshUid('troppilivelli');
    await seedProfile(uid, 0);

    const res = await giocaMemoria(uid, 99, 0);

    expect(res.levelsCompleted).toBe(COINS.memoriaLevelTimes.length);
  });

  it('rifiuta chi non ha completato nemmeno un livello', async () => {
    const uid = freshUid('zerolivelli');
    await seedProfile(uid, 0);

    await expect(giocaMemoria(uid, 0, 10)).rejects.toMatchObject({ code: 'invalid-argument' });

    expect(await coinsOf(uid)).toBe(0);
  });

  it('rispetta il tetto giornaliero', async () => {
    const uid = freshUid('quasialtetto');
    const residuo = 3;
    await seedProfile(uid, 0, {
      memoriaDate: todayRome(),
      memoriaCoinsToday: COINS.memoriaDailyCap - residuo,
    });

    const res = await giocaMemoria(uid, 3, 60);

    expect(res.reward).toBe(residuo);
    expect(await coinsOf(uid)).toBe(residuo);
    expect((await readProfile(uid)).memoriaCoinsToday).toBe(COINS.memoriaDailyCap);
  });
});

describe('sessioni di memoria e rigori', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('memoria_start apre una sessione con id e orario del server', async () => {
    const uid = freshUid('avvio');
    await seedProfile(uid, 0);

    const prima = Date.now();
    const res = (await playMinigame.run(req(uid, { action: 'memoria_start' }))) as {
      sessionId: string;
      serverTime: number;
      serie?: unknown;
    };

    expect(typeof res.sessionId).toBe('string');
    expect(res.sessionId.length).toBeGreaterThan(10);
    expect(res.serverTime).toBeGreaterThanOrEqual(prima);
    // Aprire una partita non e' averla giocata.
    expect(res.serie).toBeUndefined();
  });

  it('senza sessione il risultato non vale', async () => {
    const uid = freshUid('senzasessione');
    await seedProfile(uid, 0);

    await expect(
      playMinigame.run(req(uid, { action: 'memoria_play', levelsCompleted: 3, timeRemaining: 60 }))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(await coinsOf(uid)).toBe(0);
  });

  it('una sessione vale una volta sola', async () => {
    const uid = freshUid('replay');
    await seedProfile(uid, 0);
    const sessionId = await seedSessioneMinigioco(uid, 'memoria');
    const invio = () =>
      playMinigame.run(req(uid, { action: 'memoria_play', sessionId, levelsCompleted: 1, timeRemaining: 0 }));

    await invio();
    await expect(invio()).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(await coinsOf(uid)).toBe(COINS.memoriaPerLevel);
  });

  it('la sessione di un altro non si usa', async () => {
    const proprietario = freshUid('owner');
    const ladro = freshUid('ladro');
    await seedProfile(proprietario, 0);
    await seedProfile(ladro, 0);
    const sessionId = await seedSessioneMinigioco(proprietario, 'memoria');

    await expect(
      playMinigame.run(req(ladro, { action: 'memoria_play', sessionId, levelsCompleted: 1, timeRemaining: 0 }))
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(await coinsOf(ladro)).toBe(0);
  });

  it('tre livelli chiusi in un secondo non sono credibili', async () => {
    const uid = freshUid('lampo');
    await seedProfile(uid, 0);
    const sessionId = await seedSessioneMinigioco(uid, 'memoria', 1000);

    await expect(
      playMinigame.run(req(uid, { action: 'memoria_play', sessionId, levelsCompleted: 3, timeRemaining: 100 }))
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(await coinsOf(uid)).toBe(0);
  });

  it('una sessione aperta da troppo tempo e\' scaduta', async () => {
    const uid = freshUid('vecchia');
    await seedProfile(uid, 0);
    const sessionId = await seedSessioneMinigioco(uid, 'memoria', 60 * 60 * 1000);

    await expect(
      playMinigame.run(req(uid, { action: 'memoria_play', sessionId, levelsCompleted: 1, timeRemaining: 0 }))
    ).rejects.toMatchObject({ code: 'deadline-exceeded' });
    expect(await coinsOf(uid)).toBe(0);
  });
});

describe('rigori in singolo — tolti', () => {
  beforeEach(async () => {
    await wipe();
  });

  // Il gioco non aveva piu' una pagina (portava al duello): le azioni non
  // devono piu' pagare nulla.
  it.each(['rigori_start', 'rigori_play'])('%s non esiste piu\'', async action => {
    const uid = freshUid('rigoritolti');
    await seedProfile(uid, 0);
    await expect(
      playMinigame.run(
        req(uid, {
          action,
          sessionId: 'x',
          shots: Array.from({ length: COINS.rigoriMaxShots }, () => ({ zone: 'TL', power: 80 })),
        })
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(await coinsOf(uid)).toBe(0);
  });
});

// ============================================
// SFIDE 1VS1
// ============================================

describe('sfide 1vs1 — avversario e tetto giornaliero', () => {
  beforeEach(async () => {
    await wipe();
  });

  function tiri() {
    return Array.from({ length: COINS.rigoriMaxShots }, () => ({ zone: 'TL', power: 90 }));
  }

  it.each(['sfida_start', 'sfida_play'])('%s: rifiuta un avversario inesistente', async action => {
    const uid = freshUid('fantasma');
    await seedProfile(uid, 0);

    await expect(
      playMinigame.run(req(uid, { action, opponentId: 'nessuno_qui', shots: tiri() }))
    ).rejects.toMatchObject({ code: 'not-found' });
    expect(await coinsOf(uid)).toBe(0);
  });

  it.each(['sfida_start', 'sfida_play'])('%s: non si sfida se stessi', async action => {
    const uid = freshUid('specchio');
    await seedProfile(uid, 0);

    await expect(
      playMinigame.run(req(uid, { action, opponentId: uid, shots: tiri() }))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it.each(['sfida_start', 'sfida_play'])('%s: non si sfida un giocatore sospeso', async action => {
    const uid = freshUid('sfidante');
    const sospeso = freshUid('sospeso');
    await seedProfile(uid, 0);
    await seedProfile(sospeso, 0, { isActive: false });

    await expect(
      playMinigame.run(req(uid, { action, opponentId: sospeso, shots: tiri() }))
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(await coinsOf(uid)).toBe(0);
  });

  it('sfida_start non conta per la serie', async () => {
    const uid = freshUid('soloapertura');
    const avversario = freshUid('avversario');
    await seedProfile(uid, 0, { streakDate: null, streakDays: 0 });
    await seedProfile(avversario, 0);

    const res = (await playMinigame.run(req(uid, { action: 'sfida_start', opponentId: avversario }))) as {
      serie?: unknown;
    };

    expect(res.serie).toBeUndefined();
    const profilo = await readProfile(uid);
    expect(profilo.streakDays).toBe(0);
    expect(await coinsOf(uid)).toBe(0);
  });

  it('a tetto raggiunto la sfida si gioca ma non paga, e lo dice', async () => {
    const uid = freshUid('alletto');
    const avversario = freshUid('avv');
    await seedProfile(uid, 0, {
      sfideDate: todayRome(),
      sfideCoinsToday: COINS.sfideTettoGiornaliero,
    });
    await seedProfile(avversario, 0);

    const res = (await playMinigame.run(
      req(uid, { action: 'sfida_play', opponentId: avversario, shots: tiri() })
    )) as { reward: number; won: boolean; draw: boolean; tettoRaggiunto?: boolean; messaggio?: string };

    expect(res.reward).toBe(0);
    expect(await coinsOf(uid)).toBe(0);
    expect((await walletOf(uid)).filter(m => m.reason === 'minigame_sfida')).toHaveLength(0);
    if (res.won || res.draw) {
      expect(res.tettoRaggiunto).toBe(true);
      expect(res.messaggio).toMatch(/tetto/);
    }
  });

  it('il premio si taglia al residuo del tetto', async () => {
    const uid = freshUid('residuo');
    const avversario = freshUid('avv2');
    const residuo = 2;
    await seedProfile(uid, 0, {
      sfideDate: todayRome(),
      sfideCoinsToday: COINS.sfideTettoGiornaliero - residuo,
    });
    await seedProfile(avversario, 0);

    const res = (await playMinigame.run(
      req(uid, { action: 'sfida_play', opponentId: avversario, shots: tiri() })
    )) as { reward: number };

    expect(res.reward).toBeLessThanOrEqual(residuo);
    expect(await coinsOf(uid)).toBe(res.reward);
    const profilo = await readProfile(uid);
    expect(profilo.sfideCoinsToday ?? COINS.sfideTettoGiornaliero - residuo).toBeLessThanOrEqual(
      COINS.sfideTettoGiornaliero
    );
  });

  it('il contatore di ieri non limita oggi', async () => {
    const uid = freshUid('ieri');
    const avversario = freshUid('avv3');
    await seedProfile(uid, 0, {
      sfideDate: giornoPrecedente(todayRome()),
      sfideCoinsToday: COINS.sfideTettoGiornaliero,
    });
    await seedProfile(avversario, 0);

    const res = (await playMinigame.run(
      req(uid, { action: 'sfida_play', opponentId: avversario, shots: tiri() })
    )) as { reward: number; won: boolean; draw: boolean; tettoRaggiunto?: boolean };

    expect(res.tettoRaggiunto).toBeUndefined();
    expect(await coinsOf(uid)).toBe(res.reward);
    if (res.reward > 0) expect((await readProfile(uid)).sfideCoinsToday).toBe(res.reward);
  });
});

// ============================================
// QUIZ
// ============================================

describe('quiz — niente reroll, tempo misurato dal server', () => {
  beforeEach(async () => {
    await wipe();
    const batch = db.batch();
    for (let i = 0; i < COINS.quizMaxQuestions + 5; i++) {
      batch.set(db.collection('quiz_questions').doc(`q_${i}`), {
        question: `Domanda ${i}?`,
        options: ['A', 'B', 'C', 'D'],
        answerIndex: 0,
      });
    }
    await batch.commit();
  });

  it('riaprire il quiz restituisce le stesse domande', async () => {
    const uid = freshUid('reroll');
    await seedProfile(uid, 0);

    const prima = (await playMinigame.run(req(uid, { action: 'quiz_start' }))) as {
      questions: { id: string }[];
      serie?: unknown;
    };
    const seconda = (await playMinigame.run(req(uid, { action: 'quiz_start' }))) as {
      questions: { id: string }[];
    };

    expect(seconda.questions.map(q => q.id)).toEqual(prima.questions.map(q => q.id));
    // Aprire il quiz non e' averlo giocato.
    expect(prima.serie).toBeUndefined();
  });

  it('risposte arrivate oltre il tempo massimo valgono zero', async () => {
    const uid = freshUid('ritardo');
    await seedProfile(uid, 0);
    await playMinigame.run(req(uid, { action: 'quiz_start' }));
    const sessionRef = db.collection('quiz_sessions').doc(uid);
    await sessionRef.update({ startedAtMs: Date.now() - QUIZ_DURATA_MAX_MS - 1000 });
    const domande = (await sessionRef.get()).data()?.questions as { id: string; answerIndex: number }[];
    const tutteGiuste = Object.fromEntries(domande.map(q => [q.id, q.answerIndex]));

    const res = (await playMinigame.run(req(uid, { action: 'quiz_submit', answers: tutteGiuste }))) as {
      correct: number;
      reward: number;
      scaduta?: boolean;
    };

    expect(res).toMatchObject({ correct: 0, reward: 0, scaduta: true });
    expect(await coinsOf(uid)).toBe(0);
  });

  it('una sessione scaduta non si riapre: il quiz di oggi e\' chiuso', async () => {
    const uid = freshUid('scaduto');
    await seedProfile(uid, 0);
    await playMinigame.run(req(uid, { action: 'quiz_start' }));
    await db
      .collection('quiz_sessions')
      .doc(uid)
      .update({ startedAtMs: Date.now() - QUIZ_DURATA_MAX_MS - 1000 });

    await expect(playMinigame.run(req(uid, { action: 'quiz_start' }))).rejects.toMatchObject({
      code: 'failed-precondition',
    });
    const profilo = (await readProfile(uid)) as unknown as { lastPlayed?: { quiz?: string } };
    expect(profilo.lastPlayed?.quiz).toBe(todayRome());
  });

  it('nei tempi le risposte giuste pagano', async () => {
    const uid = freshUid('intempo');
    await seedProfile(uid, 0);
    await playMinigame.run(req(uid, { action: 'quiz_start' }));
    const domande = (await db.collection('quiz_sessions').doc(uid).get()).data()?.questions as {
      id: string;
      answerIndex: number;
    }[];
    const tutteGiuste = Object.fromEntries(domande.map(q => [q.id, q.answerIndex]));

    const res = (await playMinigame.run(req(uid, { action: 'quiz_submit', answers: tutteGiuste }))) as {
      correct: number;
      reward: number;
    };

    expect(res.correct).toBe(COINS.quizMaxQuestions);
    expect(res.reward).toBe(COINS.quizMaxQuestions * COINS.quizPerCorrect);
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
    return giocaMemoria(uid, 1, 0);
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

  it('REGRESSIONE: aprire una partita senza finirla non conta per la serie', async () => {
    const uid = freshUid('serie_apertura');
    await seedProfile(uid, 0, { streakDate: null, streakDays: 0 });

    for (const action of ['memoria_start']) {
      const res = (await playMinigame.run(req(uid, { action }))) as { serie?: unknown };
      expect(res.serie).toBeUndefined();
    }

    const profilo = await readProfile(uid);
    expect(profilo.streakDays).toBe(0);
    expect(await coinsOf(uid)).toBe(0);
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
