// ============================================
// SIMULAZIONE REALE — KILLCRITIC
//
// Una stagione in miniatura giocata davvero: 12 utenti, 4 leghe con iscrizioni
// sovrapposte, schedine su tutti i circuiti, power-up, minigiochi, duelli,
// missioni, annullamenti, reinvii e infine il settlement della giornata.
// Tutto passa dalle callable vere contro Firestore, come farebbe l'app.
//
// La partita si gioca una volta sola in `beforeAll`; i test che seguono sono
// asserzioni sullo stato che ne risulta. Servono a scoprire i guasti che
// nascono dall'incrocio delle funzionalità — punti di lega che finiscono nel
// profilo, gettoni che si moltiplicano, saldi NaN — non quelli di una funzione
// isolata, che hanno già i loro test.
// ============================================

import { beforeAll, describe, expect, it, vi } from 'vitest';

const risultati = new Map<
  string,
  { status: string; homeGoals: number; awayGoals: number; htHomeGoals?: number; htAwayGoals?: number }
>();

vi.mock('../espn', () => ({
  fetchResults: vi.fn(async () => risultati),
  fetchActiveMatchdayPool: vi.fn(async () => null),
}));

const {
  submitSchedina,
  cancelSchedina,
  adminForceSettle,
  adminResetSeason,
  getRankings,
  playMinigame,
  claimMission,
  managePenaltyDuel,
} = await import('../index');
const { COINS, POWERUPS, TOURNAMENT, MISSIONS } = await import('../config');
const {
  db,
  readProfile,
  seedLega,
  seedMatchday,
  seedProfile,
  seedDuelloQuasiFinito,
  setDeadline,
  wipe,
} = await import('./helpers');

type Req = Parameters<typeof submitSchedina.run>[0];
function req(uid: string, data: unknown = {}): Req {
  return { data, auth: { uid, token: {} } } as unknown as Req;
}

/** Generatore deterministico: una simulazione che non si ripete non è un test. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UTENTI = Array.from({ length: 12 }, (_, i) => `sim_u${i + 1}`);
const LEGHE = [
  { id: 'lega_amici', nome: 'Amici del Bar', membri: [0, 1, 2, 3, 4] },
  { id: 'lega_ufficio', nome: 'Ufficio', membri: [2, 3, 5, 6] },
  { id: 'lega_famiglia', nome: 'Famiglia', membri: [0, 7, 8] },
  { id: 'lega_grande', nome: 'Lega Grande', membri: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
];
const ADMIN = 'sim_admin';
const GIORNATA = 1;
const GIORNATA_2 = 2;
/** Ogni partita finisce 2-0: chi gioca '1' indovina, chi gioca '2' sbaglia. */
const ESITO_CASA = 2;
const ESITO_OSPITE = 0;

interface PianoUtente {
  uid: string;
  /** Quanti pronostici azzecca nella schedina generale (gli altri sbagliati). */
  esattiGenerale: number;
  powerup: Record<string, unknown>;
  leghe: string[];
  /** Esatti per ciascuna lega, nello stesso ordine di `leghe`. */
  esattiPerLega: number[];
  annullaEReinvia: boolean;
  /** Seconda giornata: serve a verificare che i punti si sommino. */
  esattiGenerale2: number;
  esattiPerLega2: number[];
}

const piani: PianoUtente[] = [];
const saldiPrimaDelSettlement = new Map<string, number>();
const gettoniSpesiInPowerup = new Map<string, number>();
/**
 * Stato dopo la prima giornata. La simulazione ne gioca due, quindi lo stato
 * finale è cumulato: per verificare cosa fa *una* valutazione serve la
 * fotografia scattata subito dopo.
 */
const dopoG1 = new Map<string, Record<string, number>>();
const standingsDopoG1 = new Map<string, Record<string, number>>();

/** Dieci pronostici: i primi `esatti` su '1' (giusti), gli altri su '2'. */
function schedina(esatti: number) {
  return Array.from({ length: 10 }, (_, i) => ({
    matchId: `m${i}`,
    betType: 'esito',
    outcome: i < esatti ? '1' : '2',
    odds: 99, // volutamente falsa: il server deve sostituirla
  }));
}

/** Punti attesi secondo il regolamento, calcolati a mano dal test. */
function puntiAttesi(esatti: number, powerup: Record<string, unknown>): number {
  const quota = 2.0; // tutte le partite hanno esito '1' a 2.00 nel seed
  const perGiocata = Math.min(quota, TOURNAMENT.oddsCap) * TOURNAMENT.pointsMultiplier;
  let base = esatti * perGiocata;
  // Il Jolly raddoppia m0, che è indovinato solo se esatti >= 1.
  if (powerup.jolly === 'm0' && esatti >= 1) base += perGiocata;
  let bonus = 0;
  if (esatti >= 10) bonus = TOURNAMENT.bonus10Points;
  else if (esatti === 9) bonus = TOURNAMENT.bonus9Points;
  else if (esatti === 8 && powerup.insurance) bonus = TOURNAMENT.bonus9Points;
  return Math.round(base * 100) / 100 + bonus;
}

function gettoniAttesiDaSchedina(esatti: number): number {
  let c = esatti * COINS.perCorrectPrediction;
  if (esatti === 9) c += COINS.bonus9Correct;
  if (esatti >= 10) c += COINS.bonus10Correct;
  return c;
}

beforeAll(async () => {
  await wipe();
  await seedMatchday();
  risultati.clear();
  for (let i = 0; i < 10; i++) {
    risultati.set(`m${i}`, {
      status: 'finished',
      homeGoals: ESITO_CASA,
      awayGoals: ESITO_OSPITE,
      htHomeGoals: 1,
      htAwayGoals: 0,
    });
  }

  await seedProfile(ADMIN, 0, { role: 'admin', username: 'Admin' });

  const casuale = rng(20260822);

  // --- Iscrizioni: profili e leghe con appartenenze sovrapposte ---
  for (const uid of UTENTI) {
    await seedProfile(uid, 3000, { username: `Giocatore ${uid.slice(-2)}` });
  }
  for (const lega of LEGHE) {
    await seedLega(lega.id, lega.membri.map(i => UTENTI[i]), { name: lega.nome });
  }
  for (const [i, uid] of UTENTI.entries()) {
    const leghe = LEGHE.filter(l => l.membri.includes(i)).map(l => l.id);
    await db.collection('profiles').doc(uid).update({ leaguesJoined: leghe.length });
    piani.push({
      uid,
      esattiGenerale: Math.floor(casuale() * 11),
      powerup:
        i % 4 === 0
          ? { jolly: 'm0' }
          : i % 4 === 1
          ? { shield: true }
          : i % 4 === 2
          ? { insurance: true }
          : {},
      leghe,
      esattiPerLega: leghe.map(() => Math.floor(casuale() * 11)),
      annullaEReinvia: i % 5 === 0,
      esattiGenerale2: Math.floor(casuale() * 11),
      esattiPerLega2: leghe.map(() => Math.floor(casuale() * 11)),
    });
  }

  // --- Giornata aperta: ognuno compila tutte le sue schedine ---
  for (const piano of piani) {
    const prima = (await readProfile(piano.uid)).coins;

    await submitSchedina.run(
      req(piano.uid, { predictions: schedina(piano.esattiGenerale), powerups: piano.powerup })
    );

    // Qualcuno cambia idea: annulla e rimanda. Il saldo deve tornare quello
    // di partenza meno un solo addebito di power-up.
    if (piano.annullaEReinvia) {
      await cancelSchedina.run(req(piano.uid, {}));
      await submitSchedina.run(
        req(piano.uid, { predictions: schedina(piano.esattiGenerale), powerups: piano.powerup })
      );
    }

    for (const [k, leagueId] of piano.leghe.entries()) {
      await submitSchedina.run(
        req(piano.uid, {
          predictions: schedina(piano.esattiPerLega[k]),
          powerups: k === 0 ? piano.powerup : {},
          leagueId,
        })
      );
    }

    const dopo = (await readProfile(piano.uid)).coins;
    gettoniSpesiInPowerup.set(piano.uid, prima - dopo);
  }

  // --- Minigiochi e duelli: la vita del gioco intorno alla schedina ---
  for (const [i, uid] of UTENTI.entries()) {
    if (i % 3 === 0) {
      await playMinigame.run(
        req(uid, { action: 'memoria_play', levelsCompleted: 2, timeRemaining: 20 })
      );
    }
    if (i % 3 === 1) {
      await playMinigame.run(
        req(uid, {
          action: 'rigori_play',
          shots: Array.from({ length: COINS.rigoriMaxShots }, () => ({ zone: 'TL', power: 70 })),
        })
      );
    }
    if (i % 3 === 2) {
      await playMinigame.run(req(uid, { action: 'wheel_spin' }));
    }
    if (i % 4 === 0) {
      const duelId = await seedDuelloQuasiFinito(uid);
      await managePenaltyDuel.run(req(uid, { action: 'move', duelId, target: 'left' }));
    }
  }

  // Missione "sei in una lega": chi ne fa parte deve poterla riscuotere.
  for (const piano of piani) {
    if (piano.leghe.length > 0) {
      await claimMission.run(req(piano.uid, { missionId: 'league_member' }));
    }
  }

  for (const uid of UTENTI) {
    saldiPrimaDelSettlement.set(uid, (await readProfile(uid)).coins);
  }

  // --- Deadline passata, giornata valutata ---
  await setDeadline(GIORNATA, -60_000);
  await adminForceSettle.run(req(ADMIN, { matchdayNumber: GIORNATA }));

  for (const uid of UTENTI) {
    dopoG1.set(uid, await readProfile(uid));
  }
  for (const lega of LEGHE) {
    const snap = await db.collection('leagues').doc(lega.id).collection('standings').get();
    for (const d of snap.docs) {
      standingsDopoG1.set(`${lega.id}/${d.id}`, d.data() as Record<string, number>);
    }
  }

  // --- Seconda giornata: i punti devono sommarsi a quelli della prima ---
  await seedMatchday({ number: GIORNATA_2 });
  for (const piano of piani) {
    await submitSchedina.run(
      req(piano.uid, { predictions: schedina(piano.esattiGenerale2), powerups: {} })
    );
    for (const [k, leagueId] of piano.leghe.entries()) {
      await submitSchedina.run(
        req(piano.uid, {
          predictions: schedina(piano.esattiPerLega2[k]),
          powerups: {},
          leagueId,
        })
      );
    }
  }
  await setDeadline(GIORNATA_2, -60_000);
  await adminForceSettle.run(req(ADMIN, { matchdayNumber: GIORNATA_2 }));
}, 480_000);

// ============================================
// STATO DI PARTENZA DELLA SIMULAZIONE
// ============================================
describe('simulazione — la partita è stata giocata davvero', () => {
  it('dodici giocatori più l\'admin', async () => {
    const profili = await db.collection('profiles').get();
    expect(profili.size).toBe(UTENTI.length + 1);
  });

  it('quattro leghe con iscrizioni sovrapposte', async () => {
    const leghe = await db.collection('leagues').get();
    expect(leghe.size).toBe(LEGHE.length);
    // Chi sta in più leghe è il caso che rompeva il rate limit degli invii.
    expect(piani.filter(p => p.leghe.length >= 3).length).toBeGreaterThan(0);
  });

  it('ogni giocatore ha una schedina generale e una per ogni sua lega, su due giornate', async () => {
    const schedine = await db.collection('schedine').get();
    const attesePerGiornata = piani.reduce((n, p) => n + 1 + p.leghe.length, 0);
    expect(schedine.size).toBe(attesePerGiornata * 2);
  });

  it('la giornata risulta valutata', async () => {
    const md = await db.collection('matchdays').doc(String(GIORNATA)).get();
    expect(md.data()?.settled).toBe(true);
  });
});

// ============================================
// UN CONTROLLO PER OGNI GIOCATORE
// ============================================
describe.each(UTENTI.map(uid => ({ uid })))('giocatore $uid', ({ uid }) => {
  const piano = () => piani.find(p => p.uid === uid)!;

  it('il saldo gettoni è un numero finito e non negativo', async () => {
    const c = (await readProfile(uid)).coins;
    expect(Number.isFinite(c)).toBe(true);
    expect(c).toBeGreaterThanOrEqual(0);
  });

  it('nessun campo numerico del profilo è NaN', async () => {
    const p = await readProfile(uid);
    for (const [campo, valore] of Object.entries(p)) {
      if (typeof valore === 'number') {
        expect(Number.isFinite(valore), `${campo} non è finito`).toBe(true);
      }
    }
  });

  it('dopo una giornata i punti sono quelli della sola schedina generale', () => {
    const p = dopoG1.get(uid)!;
    expect(p.totalPoints).toBeCloseTo(puntiAttesi(piano().esattiGenerale, piano().powerup), 2);
  });

  it('dopo una giornata gli esatti contati sono quelli della generale', () => {
    expect(dopoG1.get(uid)!.correctPredictions).toBe(piano().esattiGenerale);
  });

  it('una giornata valutata conta una giornata giocata, non una per lega', () => {
    expect(dopoG1.get(uid)!.matchdaysPlayed).toBe(1);
  });

  it('la schedina perfetta è contata solo se ha fatto 10/10 in generale', () => {
    expect(dopoG1.get(uid)!.perfectSchedine).toBe(piano().esattiGenerale >= 10 ? 1 : 0);
  });

  it('i gettoni da pronostici sono quelli della generale, non moltiplicati per le leghe', () => {
    const dopo = dopoG1.get(uid)!.coins;
    const prima = saldiPrimaDelSettlement.get(uid)!;
    const premioGiornata = dopo - prima - gettoniAttesiDaSchedina(piano().esattiGenerale);
    // L'unico extra ammesso è il premio di giornata al migliore.
    expect([0, COINS.weeklyWinner]).toContain(Math.round(premioGiornata));
  });

  it('il registro movimenti quadra col saldo', async () => {
    const movimenti = await db.collection('wallet_transactions').where('userId', '==', uid).get();
    const somma = movimenti.docs.reduce((t, d) => t + (d.data().amount as number), 0);
    const p = await readProfile(uid);
    // Saldo = bonus di partenza del seed + tutti i movimenti registrati.
    expect(p.coins).toBeCloseTo(3000 + somma, 2);
  });

  it('i power-up sono stati pagati una volta per schedina, non una volta sola', async () => {
    const speso = gettoniSpesiInPowerup.get(uid)!;
    const costoUno = Object.keys(piano().powerup).length > 0
      ? (piano().powerup.jolly ? POWERUPS.jolly.cost : 0) +
        (piano().powerup.shield ? POWERUPS.shield.cost : 0) +
        (piano().powerup.insurance ? POWERUPS.insurance.cost : 0)
      : 0;
    // Generale + prima lega (le altre le manda senza power-up).
    const atteso = costoUno * (piano().leghe.length > 0 ? 2 : 1);
    expect(speso).toBe(atteso);
  });

  it('annullare e rimandare non ha creato né bruciato gettoni', async () => {
    if (!piano().annullaEReinvia) return;
    const speso = gettoniSpesiInPowerup.get(uid)!;
    expect(speso).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(speso)).toBe(true);
  });

  it('la schedina generale è valutata e coerente', async () => {
    const s = await db.collection('schedine').doc(`${uid}_${GIORNATA}`).get();
    const d = s.data()!;
    expect(d.settled).toBe(true);
    expect(d.leagueId).toBeNull();
    expect(d.correctPredictions).toBe(piano().esattiGenerale);
    expect((d.predictions as unknown[]).length).toBe(10);
  });

  it('le quote salvate sono quelle ufficiali, non quelle mandate dal client', async () => {
    const s = await db.collection('schedine').doc(`${uid}_${GIORNATA}`).get();
    for (const p of s.data()!.predictions as { odds: number }[]) {
      expect(p.odds).not.toBe(99);
      expect(p.odds).toBeLessThanOrEqual(10);
    }
  });

  it('compare nella classifica generale', async () => {
    const res = (await getRankings.run(req(uid, {}))) as {
      rankings: { participantId: string }[];
    };
    expect(res.rankings.some(r => r.participantId === uid)).toBe(true);
  });

  it('la missione della lega è riscossa solo se è in una lega', async () => {
    const p = await readProfile(uid);
    const riscosse = (p.claimedMissions as unknown as string[]) ?? [];
    expect(riscosse.includes('league_member')).toBe(piano().leghe.length > 0);
  });
});

// ============================================
// UN CONTROLLO PER OGNI LEGA
// ============================================
describe.each(LEGHE.map(l => ({ id: l.id, nome: l.nome, membri: l.membri })))(
  'lega $nome',
  ({ id, membri }) => {
    const uidMembri = membri.map(i => UTENTI[i]);

    it('la classifica contiene tutti i membri e nessun estraneo', async () => {
      const res = (await getRankings.run(req(uidMembri[0], { leagueId: id }))) as {
        rankings: { participantId: string }[];
      };
      expect(res.rankings.map(r => r.participantId).sort()).toEqual([...uidMembri].sort());
    });

    it('la classifica è ordinata per punti decrescenti', async () => {
      const res = (await getRankings.run(req(uidMembri[0], { leagueId: id }))) as {
        rankings: { totalPoints: number }[];
      };
      const punti = res.rankings.map(r => r.totalPoints);
      expect([...punti].sort((a, b) => b - a)).toEqual(punti);
    });

    it('i rank partono da 1 e non saltano più del dovuto', async () => {
      const res = (await getRankings.run(req(uidMembri[0], { leagueId: id }))) as {
        rankings: { rank: number }[];
      };
      expect(res.rankings[0].rank).toBe(1);
      res.rankings.forEach((r, i) => expect(r.rank).toBeLessThanOrEqual(i + 1));
    });

    it('dopo una giornata i punti di lega sono quelli della schedina di lega', () => {
      for (const uid of uidMembri) {
        const riga = standingsDopoG1.get(`${id}/${uid}`)!;
        const piano = piani.find(p => p.uid === uid)!;
        const k = piano.leghe.indexOf(id);
        expect(riga.totalPoints).toBeCloseTo(
          puntiAttesi(piano.esattiPerLega[k], k === 0 ? piano.powerup : {}),
          2
        );
      }
    });

    it('dopo una giornata ogni membro ne ha giocata una in questa lega', () => {
      for (const uid of uidMembri) {
        expect(standingsDopoG1.get(`${id}/${uid}`)!.matchdaysPlayed).toBe(1);
      }
    });

    it('ogni giornata ha un solo vincitore di lega', () => {
      const vincitoriG1 = uidMembri.filter(
        uid => (standingsDopoG1.get(`${id}/${uid}`)!.weeklyWins ?? 0) > 0
      );
      expect(vincitoriG1.length).toBe(1);
    });

    it('il vincitore di lega della prima giornata è quello coi punti più alti', () => {
      const righe = uidMembri.map(uid => ({
        punti: standingsDopoG1.get(`${id}/${uid}`)!.totalPoints,
        vinta: (standingsDopoG1.get(`${id}/${uid}`)!.weeklyWins ?? 0) > 0,
      }));
      expect(righe.find(r => r.vinta)!.punti).toBe(Math.max(...righe.map(r => r.punti)));
    });

    it('dopo due giornate la classifica contiene ancora tutti e soli i membri', async () => {
      const standings = await db.collection('leagues').doc(id).collection('standings').get();
      expect(standings.size).toBe(uidMembri.length);
    });

    it('nessun gettone è stato pagato per le schedine di questa lega', async () => {
      for (const uid of uidMembri) {
        const movimenti = await db
          .collection('wallet_transactions')
          .where('userId', '==', uid)
          .get();
        const daLega = movimenti.docs.filter(d =>
          String(d.data().reason).includes(id)
        );
        // Gli unici movimenti che citano la lega sono addebiti di power-up.
        for (const m of daLega) {
          expect(m.data().amount).toBeLessThan(0);
        }
      }
    });

    it('le schedine di lega esistono e sono valutate', async () => {
      for (const uid of uidMembri) {
        const s = await db.collection('schedine').doc(`${uid}_${GIORNATA}_${id}`).get();
        expect(s.exists).toBe(true);
        expect(s.data()!.settled).toBe(true);
        expect(s.data()!.leagueId).toBe(id);
      }
    });
  }
);

// ============================================
// UN CONTROLLO PER OGNI SCHEDINA DI LEGA
// ============================================
const coppieLega = LEGHE.flatMap(l =>
  l.membri.map(i => ({ lega: l.id, uid: UTENTI[i] }))
);

describe.each(coppieLega)('schedina di $uid in $lega', ({ lega, uid }) => {
  it('ha dieci pronostici con quote ufficiali', async () => {
    const s = await db.collection('schedine').doc(`${uid}_${GIORNATA}_${lega}`).get();
    const preds = s.data()!.predictions as { odds: number }[];
    expect(preds).toHaveLength(10);
    preds.forEach(p => expect(p.odds).not.toBe(99));
  });

  it('i suoi punti stanno nella lega e non nel profilo', async () => {
    const s = await db.collection('schedine').doc(`${uid}_${GIORNATA}_${lega}`).get();
    const puntiSchedina = s.data()!.finalPoints as number;
    expect(standingsDopoG1.get(`${lega}/${uid}`)!.totalPoints).toBeCloseTo(puntiSchedina, 2);

    const piano = piani.find(p => p.uid === uid)!;
    expect(dopoG1.get(uid)!.totalPoints).toBeCloseTo(
      puntiAttesi(piano.esattiGenerale, piano.powerup),
      2
    );
  });

  it('il punteggio segue il regolamento: somma delle quote ×10 più bonus', async () => {
    const s = await db.collection('schedine').doc(`${uid}_${GIORNATA}_${lega}`).get();
    const d = s.data()!;
    const piano = piani.find(p => p.uid === uid)!;
    const k = piano.leghe.indexOf(lega);
    expect(d.finalPoints).toBeCloseTo(
      puntiAttesi(piano.esattiPerLega[k], k === 0 ? piano.powerup : {}),
      2
    );
  });

  it('finalPoints resta uguale a base più bonus più penalità', async () => {
    const s = await db.collection('schedine').doc(`${uid}_${GIORNATA}_${lega}`).get();
    const d = s.data()!;
    expect(d.finalPoints).toBeCloseTo(
      (d.totalPoints as number) + (d.bonusPoints as number) + (d.penaltyPoints as number),
      2
    );
  });

  it('nessun pronostico vale più del tetto per giocata', async () => {
    const s = await db.collection('schedine').doc(`${uid}_${GIORNATA}_${lega}`).get();
    for (const p of s.data()!.predictionResults as { pointsEarned: number }[]) {
      // Il Jolly può raddoppiare una giocata: il tetto vero è il doppio.
      expect(p.pointsEarned).toBeLessThanOrEqual(
        TOURNAMENT.oddsCap * TOURNAMENT.pointsMultiplier * 2
      );
      expect(Number.isFinite(p.pointsEarned)).toBe(true);
    }
  });
});

// ============================================
// SECONDA GIORNATA — I PUNTI SI SOMMANO
// ============================================
describe.each(UTENTI.map(uid => ({ uid })))('due giornate per $uid', ({ uid }) => {
  const piano = () => piani.find(p => p.uid === uid)!;

  it('ha giocato due giornate', async () => {
    expect((await readProfile(uid)).matchdaysPlayed).toBe(2);
  });

  it('i punti totali sono la somma delle due giornate, non solo l’ultima', async () => {
    const atteso =
      puntiAttesi(piano().esattiGenerale, piano().powerup) +
      puntiAttesi(piano().esattiGenerale2, {});
    expect((await readProfile(uid)).totalPoints).toBeCloseTo(atteso, 2);
  });

  it('i pronostici esatti si sommano', async () => {
    const atteso = piano().esattiGenerale + piano().esattiGenerale2;
    expect((await readProfile(uid)).correctPredictions).toBe(atteso);
  });

  it('la miglior giornata è la più alta delle due', async () => {
    const g1 = puntiAttesi(piano().esattiGenerale, piano().powerup);
    const g2 = puntiAttesi(piano().esattiGenerale2, {});
    expect((await readProfile(uid)).bestMatchdayPoints).toBeCloseTo(Math.max(g1, g2), 2);
  });

  it('i punti di settimana sono quelli dell’ultima giornata, non cumulati', async () => {
    expect((await readProfile(uid)).weeklyPoints).toBeCloseTo(
      puntiAttesi(piano().esattiGenerale2, {}),
      2
    );
  });

  it('entrambe le schedine generali restano nello storico, valutate', async () => {
    for (const g of [GIORNATA, GIORNATA_2]) {
      const s = await db.collection('schedine').doc(`${uid}_${g}`).get();
      expect(s.exists).toBe(true);
      expect(s.data()!.settled).toBe(true);
    }
  });

  it('il saldo resta finito e non negativo dopo due giornate', async () => {
    const c = (await readProfile(uid)).coins;
    expect(Number.isFinite(c)).toBe(true);
    expect(c).toBeGreaterThanOrEqual(0);
  });
});

describe.each(coppieLega)('due giornate in lega — $uid in $lega', ({ lega, uid }) => {
  it('la classifica di lega somma le due giornate', async () => {
    const piano = piani.find(p => p.uid === uid)!;
    const k = piano.leghe.indexOf(lega);
    const atteso =
      puntiAttesi(piano.esattiPerLega[k], k === 0 ? piano.powerup : {}) +
      puntiAttesi(piano.esattiPerLega2[k], {});
    const standing = await db
      .collection('leagues')
      .doc(lega)
      .collection('standings')
      .doc(uid)
      .get();
    expect(standing.data()!.totalPoints).toBeCloseTo(atteso, 2);
  });

  it('risulta due giornate giocate nella lega', async () => {
    const standing = await db
      .collection('leagues')
      .doc(lega)
      .collection('standings')
      .doc(uid)
      .get();
    expect(standing.data()!.matchdaysPlayed).toBe(2);
  });

  it('esistono entrambe le schedine di lega, valutate', async () => {
    for (const g of [GIORNATA, GIORNATA_2]) {
      const s = await db.collection('schedine').doc(`${uid}_${g}_${lega}`).get();
      expect(s.exists).toBe(true);
      expect(s.data()!.settled).toBe(true);
      expect(s.data()!.leagueId).toBe(lega);
    }
  });

  it('i punti di lega restano fuori dal profilo anche dopo due giornate', async () => {
    const piano = piani.find(p => p.uid === uid)!;
    const profilo = await readProfile(uid);
    const soloGenerale =
      puntiAttesi(piano.esattiGenerale, piano.powerup) +
      puntiAttesi(piano.esattiGenerale2, {});
    expect(profilo.totalPoints).toBeCloseTo(soloGenerale, 2);
  });
});

// ============================================
// INVARIANTI GLOBALI
// ============================================
describe('invarianti dopo il settlement', () => {
  it('ogni giornata assegna una sola vittoria nel circuito generale', async () => {
    const vincitoriG1 = UTENTI.filter(uid => (dopoG1.get(uid)!.weeklyWins ?? 0) > 0);
    expect(vincitoriG1.length).toBe(1);

    const profili = await db.collection('profiles').get();
    const vittorieTotali = profili.docs.reduce(
      (t, d) => t + ((d.data().weeklyWins as number) ?? 0),
      0
    );
    expect(vittorieTotali).toBe(2); // una per giornata
  });

  it('il premio della prima giornata è andato a chi ha fatto più punti', () => {
    const righe = UTENTI.map(uid => ({
      punti: dopoG1.get(uid)!.totalPoints,
      vinta: (dopoG1.get(uid)!.weeklyWins ?? 0) > 0,
    }));
    expect(righe.find(r => r.vinta)!.punti).toBe(Math.max(...righe.map(r => r.punti)));
  });

  it('l\'albo d\'oro ha il podio della giornata', async () => {
    const premio = await db.collection('prizes').doc(`weekly_${GIORNATA}`).get();
    const podio = premio.data()!.podio as { position: number; userId: string }[];
    expect(podio.length).toBeGreaterThan(0);
    expect(podio.map(p => p.position)).toEqual(podio.map((_, i) => i + 1));
  });

  it('nessun profilo ha punti o gettoni negativi', async () => {
    const profili = await db.collection('profiles').get();
    for (const d of profili.docs) {
      expect(d.data().coins).toBeGreaterThanOrEqual(0);
      expect(d.data().totalPoints).toBeGreaterThanOrEqual(0);
    }
  });

  it('nessun movimento del portafoglio ha importo NaN', async () => {
    const movimenti = await db.collection('wallet_transactions').get();
    expect(movimenti.size).toBeGreaterThan(0);
    for (const d of movimenti.docs) {
      expect(Number.isFinite(d.data().amount)).toBe(true);
    }
  });

  it('nessun movimento è registrato due volte con lo stesso id', async () => {
    const movimenti = await db.collection('wallet_transactions').get();
    const ids = movimenti.docs.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rivalutare una giornata già chiusa non paga una seconda volta', async () => {
    const prima = await db.collection('profiles').get();
    const saldiPrima = new Map(prima.docs.map(d => [d.id, d.data().coins as number]));

    await expect(
      adminForceSettle.run(req(ADMIN, { matchdayNumber: GIORNATA }))
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    const dopo = await db.collection('profiles').get();
    for (const d of dopo.docs) {
      expect(d.data().coins).toBe(saldiPrima.get(d.id));
    }
  });

  it('la somma dei punti di lega non compare da nessuna parte nel profilo', async () => {
    for (const piano of piani) {
      if (piano.leghe.length === 0) continue;
      const puntiLega = piano.esattiPerLega.reduce(
        (t, e, k) => t + puntiAttesi(e, k === 0 ? piano.powerup : {}),
        0
      );
      const profilo = await readProfile(piano.uid);
      const puntiGenerale = puntiAttesi(piano.esattiGenerale, piano.powerup);
      if (puntiLega > 0) {
        expect(profilo.totalPoints).not.toBeCloseTo(puntiGenerale + puntiLega, 2);
      }
    }
  });

  it('le missioni riscosse hanno pagato il premio previsto', async () => {
    const missione = MISSIONS.find(m => m.id === 'league_member')!;
    const movimenti = await db
      .collection('wallet_transactions')
      .where('reason', '==', 'mission_league_member')
      .get();
    for (const d of movimenti.docs) {
      expect(d.data().amount).toBe(missione.reward);
    }
  });

  it('i minigiochi non hanno superato i tetti giornalieri', async () => {
    const profili = await db.collection('profiles').get();
    for (const d of profili.docs) {
      const p = d.data();
      expect((p.memoriaCoinsToday ?? 0) as number).toBeLessThanOrEqual(COINS.memoriaDailyCap);
      expect((p.rigoriCoinsToday ?? 0) as number).toBeLessThanOrEqual(COINS.rigoriDailyCap);
      expect((p.duelCoinsToday ?? 0) as number).toBeLessThanOrEqual(COINS.duelDailyCap);
    }
  });

  it('la classifica generale non espone i saldi', async () => {
    const res = (await getRankings.run(req(UTENTI[0], {}))) as unknown as {
      rankings: Record<string, unknown>[];
    };
    for (const riga of res.rankings) {
      expect(riga).not.toHaveProperty('coins');
      expect(riga).not.toHaveProperty('email');
    }
  });

  it('chi non è nella lega non ne vede la classifica se è privata', async () => {
    await db.collection('leagues').doc('lega_chiusa').set({
      id: 'lega_chiusa', name: 'Chiusa', isPrivate: true,
      memberIds: [UTENTI[0]], ownerId: UTENTI[0],
    });
    await expect(
      getRankings.run(req(UTENTI[11], { leagueId: 'lega_chiusa' }))
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('un estraneo non può inviare la schedina di una lega altrui', async () => {
    await expect(
      submitSchedina.run(
        req(UTENTI[11], { predictions: schedina(5), powerups: {}, leagueId: 'lega_famiglia' })
      )
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

// ---------------------------------------------------------------------------
// NUOVA STAGIONE — l'azzeramento riapre il gioco dalla giornata 1.
//
// Gira per ultimo, sullo stato lasciato dalle due giornate simulate: e' la
// storia vera di un torneo che ricomincia. Le schedine passate vanno in
// archivio (gli id `uid_giornata` devono liberarsi), le giornate spariscono
// (cosi' la prossima sincronizzata e' la 1) e chi rigioca riparte da zero.
// ---------------------------------------------------------------------------

describe("nuova stagione dopo l'azzeramento", () => {
  const RIENTRANTE = UTENTI[0];
  let schedinePrimaDelReset = 0;

  beforeAll(async () => {
    schedinePrimaDelReset = (await db.collection('schedine').get()).size;

    await adminResetSeason.run(req(ADMIN, { confirm: 'AZZERA' }));

    // Il sync vero e' mockato a null: la nuova giornata 1 arriva dal seed,
    // come farebbe il primo sync della stagione.
    await seedMatchday({ number: 1 });

    // Un utente della vecchia stagione rigioca: schedina generale e di lega
    // con gli stessi id della stagione archiviata (sim_u1_1, sim_u1_1_lega).
    await submitSchedina.run(req(RIENTRANTE, { predictions: schedina(7), powerups: {} }));
    await submitSchedina.run(
      req(RIENTRANTE, { predictions: schedina(5), powerups: {}, leagueId: LEGHE[0].id })
    );

    await setDeadline(1, -60_000);
    await adminForceSettle.run(req(ADMIN, { matchdayNumber: 1 }));
  });

  it('le schedine della vecchia stagione stanno tutte in archivio', async () => {
    const archivio = await db.collection('schedine_archivio').get();
    expect(archivio.size).toBe(schedinePrimaDelReset);
  });

  it('gli id liberati si riusano senza trovare il fantasma della vecchia giornata', async () => {
    const s = await db.collection('schedine').doc(`${RIENTRANTE}_1`).get();
    expect(s.exists).toBe(true);
    expect(s.data()!.settled).toBe(true);
    expect(s.data()!.finalPoints).toBeCloseTo(puntiAttesi(7, {}), 2);
  });

  it('il profilo conta solo la nuova stagione', async () => {
    const p = await readProfile(RIENTRANTE);
    expect(p.totalPoints).toBeCloseTo(puntiAttesi(7, {}), 2);
    expect(p.matchdaysPlayed).toBe(1);
    expect(p.correctPredictions).toBe(7);
  });

  it('la classifica di lega riparte anche lei da questa stagione', async () => {
    const standing = await db
      .collection('leagues')
      .doc(LEGHE[0].id)
      .collection('standings')
      .doc(RIENTRANTE)
      .get();
    expect(standing.data()!.totalPoints).toBeCloseTo(puntiAttesi(5, {}), 2);
    expect(standing.data()!.matchdaysPlayed).toBe(1);
  });

  it('i gettoni ripartono dal saldo iniziale piu’ i guadagni nuovi', async () => {
    const p = await readProfile(RIENTRANTE);
    // Unico giocatore della giornata: vince anche il premio settimanale.
    expect(p.coins).toBe(
      COINS.starting + gettoniAttesiDaSchedina(7) + COINS.weeklyWinner
    );
  });

  it('resta una sola giornata attiva: la 1', async () => {
    const giornate = await db.collection('matchdays').get();
    const numeri = giornate.docs.filter(d => d.id !== '_meta').map(d => d.data().number);
    expect(numeri).toEqual([1]);
  });
});
