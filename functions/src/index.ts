// ============================================
// FANTASCHEDINA - CLOUD FUNCTIONS
// - syncMatchday: crea/aggiorna la giornata con quote server-side
// - settleMatchdays: settlement automatico + premi + gettoni
// - submitSchedina: invio validato (deadline, quote, power-up)
// - changePrediction: power-up Cambio Last-Minute
// - playMinigame: quiz / ruota / rigori server-validated
// - claimMission: riscossione ricompense missioni
// ============================================

import { initializeApp } from 'firebase-admin/app';
import {
  getFirestore,
  Timestamp,
  FieldValue,
  Transaction,
} from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { randomInt } from 'node:crypto';

import {
  COINS, MISSIONS, POWERUPS, PowerUpSelection, TOURNAMENT,
  COMPETITIONS, DEFAULT_ACTIVE_COMPETITIONS, MAX_PICKS_PER_SCHEDINA,
} from './config';
import { ALL_QUIZ_QUESTIONS } from './quizData';
import {
  evaluateSchedina,
  MatchResult,
  Prediction,
} from './scoring';
import { generateMatchdayOdds, MatchOdds } from './odds';
import { fetchRealMatchdayOdds } from './realOdds';
import { fetchActiveMatchdayPool, fetchResults } from './espn';
import { resolveShot, simulateOpponentShot, estimateSkillFromProfile, isValidZone } from './penalty';

initializeApp();
const db = getFirestore();

const REGION = 'europe-west1';

// ---------- Helpers ----------

function romeDateString(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function fyShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[randomInt(chars.length)]).join('');
}

interface StoredMatch {
  id: string;
  matchday: number;
  competition: string;
  homeTeam: { id: string; name: string; shortName: string; logo?: string };
  awayTeam: { id: string; name: string; shortName: string; logo?: string };
  scheduledAt: Timestamp;
  status: string;
  result?: MatchResult;
}

interface MatchdayDoc {
  number: number;
  season: string;
  status: string;
  deadline: Timestamp;
  matches: StoredMatch[];
  odds: Record<string, MatchOdds>;
  settled: boolean;
}

interface SchedinaDoc {
  id: string;
  userId: string;
  username: string;
  matchdayNumber: number;
  predictions: Prediction[];
  powerups?: PowerUpSelection;
  lastMinuteUsed?: boolean;
  settled: boolean;
}

/** Accredita/addebita gettoni in transaction + audit trail. */
async function adjustCoins(
  uid: string,
  amount: number,
  reason: string,
  tx?: Transaction
): Promise<void> {
  const profileRef = db.collection('profiles').doc(uid);
  const txRef = db.collection('wallet_transactions').doc();
  const payload = {
    userId: uid,
    amount,
    reason,
    createdAt: FieldValue.serverTimestamp(),
  };
  const updates = {
    coins: FieldValue.increment(amount),
    ...(amount > 0 ? { coinsEarned: FieldValue.increment(amount) } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (tx) {
    tx.update(profileRef, updates);
    tx.set(txRef, payload);
  } else {
    await profileRef.update(updates);
    await txRef.set(payload);
  }
}

/** Rate limiting per-callable usando Firestore come store. */
async function enforceRateLimit(
  uid: string,
  action: string,
  maxCalls: number,
  windowMs: number
): Promise<void> {
  const ref = db.collection('rate_limits').doc(`${uid}_${action}`);
  const now = Date.now();
  const snap = await ref.get();
  const data = snap.data();
  if (data && data.expiresAt?.toMillis() > now) {
    const count = (data.count ?? 0) as number;
    if (count >= maxCalls) {
      throw new HttpsError(
        'resource-exhausted',
        'Troppe richieste. Riprova tra poco.'
      );
    }
    await ref.update({
      count: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await ref.set({
      count: 1,
      expiresAt: Timestamp.fromMillis(now + windowMs),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

/** Legge i campionati attivi (scelti dall'admin) da Firestore, con fallback a Serie A. */
async function getActiveCompetitions(): Promise<{ code: string; slug: string }[]> {
  const snap = await db.collection('config').doc('competitions').get();
  const active = (snap.exists ? (snap.data()?.active as string[]) : null) ?? DEFAULT_ACTIVE_COMPETITIONS;
  const codes = active.length > 0 ? active : DEFAULT_ACTIVE_COMPETITIONS;
  return codes
    .map(code => COMPETITIONS.find(c => c.code === code))
    .filter((c): c is typeof COMPETITIONS[number] => !!c)
    .map(c => ({ code: c.code, slug: c.slug }));
}

/** Crea/aggiorna il doc della prossima giornata con quote server-side (pool multi-campionato). */
async function syncMatchdayInternal(forceOdds = false): Promise<MatchdayDoc | null> {
  const competitions = await getActiveCompetitions();
  const api = await fetchActiveMatchdayPool(competitions);
  if (!api) return null;

  const fetchedIds = new Set(api.matches.map(m => m.id));

  // Cerca una giornata esistente con partite in comune
  const existing = await db
    .collection('matchdays')
    .where('settled', '==', false)
    .get();
  let number: number | null = null;
  for (const d of existing.docs) {
    const data = d.data() as MatchdayDoc;
    if (data.matches.some(m => fetchedIds.has(m.id))) {
      number = data.number;
      break;
    }
  }

  if (number === null) {
    // Nuova giornata: max esistente + 1, altrimenti stima dalle settimane
    const all = await db
      .collection('matchdays')
      .orderBy('number', 'desc')
      .limit(1)
      .get();
    if (!all.empty) {
      number = (all.docs[0].data() as MatchdayDoc).number + 1;
    } else {
      const weeks = Math.round(
        (api.matches[0].scheduledAt.getTime() - api.seasonStart.getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      );
      number = Math.max(1, Math.min(38, weeks + 1));
    }
  }

  const ref = db.collection('matchdays').doc(String(number));
  const snap = await ref.get();
  const prev = snap.exists ? (snap.data() as MatchdayDoc) : null;

  const matches: StoredMatch[] = api.matches.map(m => ({
    id: m.id,
    matchday: number as number,
    competition: m.competition,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    scheduledAt: Timestamp.fromDate(m.scheduledAt),
    status: m.status,
  }));

  // Le quote non si rigenerano mai una volta pubblicate (a meno di forceOdds)
  let odds = (!forceOdds ? prev?.odds ?? null : null);
  if (!odds) {
    const apiKey = process.env.ODDS_API_KEY ?? '';
    const realOdds = await fetchRealMatchdayOdds(api.matches, apiKey);
    if (realOdds) {
      logger.info('syncMatchday: using real odds from odds-api.io');
      odds = realOdds;
    } else {
      logger.info('syncMatchday: using algorithmic odds (real odds unavailable or no API key)');
      odds = generateMatchdayOdds(api.matches);
    }
  }

  const docData: MatchdayDoc = {
    number,
    season: api.season,
    status: prev?.status ?? 'open',
    deadline: prev?.deadline ?? Timestamp.fromDate(api.deadline),
    matches: prev?.matches?.length ? prev.matches : matches,
    odds,
    settled: prev?.settled ?? false,
  };
  await ref.set(
    { ...docData, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  await db.collection('matchdays').doc('_meta').set(
    { currentNumber: number, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return docData;
}

async function getCurrentMatchday(): Promise<MatchdayDoc | null> {
  const meta = await db.collection('matchdays').doc('_meta').get();
  const num = meta.exists ? (meta.data()?.currentNumber as number) : null;
  if (num == null) return null;
  const snap = await db.collection('matchdays').doc(String(num)).get();
  return snap.exists ? (snap.data() as MatchdayDoc) : null;
}

// ---------- 1. SYNC GIORNATA (scheduled ogni 6 ore) ----------

export const syncMatchday = onSchedule(
  { schedule: 'every 6 hours', region: REGION, timeZone: 'Europe/Rome' },
  async () => {
    const md = await syncMatchdayInternal();
    logger.info(md ? `Giornata ${md.number} sincronizzata` : 'Nessuna giornata trovata');
  }
);

// ---------- 2. SETTLEMENT AUTOMATICO (scheduled ogni ora) ----------

export const settleMatchdays = onSchedule(
  { schedule: 'every 60 minutes', region: REGION, timeZone: 'Europe/Rome' },
  async () => {
    const now = Timestamp.now();
    const pending = await db
      .collection('matchdays')
      .where('settled', '==', false)
      .get();

    for (const mdSnap of pending.docs) {
      if (mdSnap.id === '_meta') continue;
      const md = mdSnap.data() as MatchdayDoc;
      if (md.deadline.toMillis() > now.toMillis()) continue;

      // Aggiorna risultati da ESPN
      const results = await fetchResults(
        md.matches.map(m => ({ id: m.id, scheduledAt: m.scheduledAt.toDate(), competition: m.competition }))
      );

      const updatedMatches = md.matches.map(m => {
        const r = results.get(m.id);
        if (!r) return m;
        const base = { ...m, status: r.status };
        if (r.status !== 'finished') return base;
        return {
          ...base,
          result: {
            homeGoals: r.homeGoals,
            awayGoals: r.awayGoals,
            outcome: (r.homeGoals > r.awayGoals
              ? '1'
              : r.awayGoals > r.homeGoals
              ? '2'
              : 'X') as MatchResult['outcome'],
            ...(r.htHomeGoals != null
              ? { htHomeGoals: r.htHomeGoals, htAwayGoals: r.htAwayGoals }
              : {}),
          },
        };
      });

      await mdSnap.ref.update({
        matches: updatedMatches,
        status: 'locked',
        updatedAt: FieldValue.serverTimestamp(),
      });

      const allFinished = updatedMatches.every(m => m.status === 'finished' && m.result);
      if (!allFinished) {
        logger.info(`Giornata ${md.number}: partite non concluse, skip settlement`);
        continue;
      }

      await settleSchedine(md.number, updatedMatches);
      await db.runTransaction(async tx => {
        const fresh = await tx.get(mdSnap.ref);
        if ((fresh.data() as MatchdayDoc).settled) return;
        tx.update(mdSnap.ref, {
          settled: true,
          status: 'completed',
          settledAt: FieldValue.serverTimestamp(),
        });
      });
      logger.info(`Giornata ${md.number} valutata`);
    }
  }
);

// ---------- 2b. PUNTEGGI LIVE (scheduled ogni 2 min, solo in finestra partite) ----------

export const updateLiveScores = onSchedule(
  { schedule: 'every 2 minutes', region: REGION, timeZone: 'Europe/Rome' },
  async () => {
    const md = await getCurrentMatchday();
    if (!md || md.settled) return;

    // Finestra live: da 5 min prima del fischio a 4h dopo ogni partita.
    // Fuori dalle finestre usciamo subito senza chiamare ESPN (costo ~0).
    const now = Date.now();
    const allFinished = md.matches.every(m => m.status === 'finished');
    if (allFinished) return;
    const activeMatches = md.matches.filter(m => {
      const kickoff = m.scheduledAt.toMillis();
      const nearKickoff =
        now >= kickoff - 5 * 60 * 1000 && now <= kickoff + 4 * 60 * 60 * 1000;
      const staleLive = m.status === 'live' && now <= kickoff + 8 * 60 * 60 * 1000;
      return nearKickoff || staleLive;
    });
    if (activeMatches.length === 0) return;

    const results = await fetchResults(
      activeMatches.map(m => ({ id: m.id, scheduledAt: m.scheduledAt.toDate(), competition: m.competition }))
    );
    if (results.size === 0) return;

    let changed = false;
    const updatedMatches = md.matches.map(m => {
      const r = results.get(m.id);
      if (!r || r.status === 'scheduled') return m;
      const result: MatchResult = {
        homeGoals: r.homeGoals,
        awayGoals: r.awayGoals,
        outcome: (r.homeGoals > r.awayGoals
          ? '1'
          : r.awayGoals > r.homeGoals
          ? '2'
          : 'X') as MatchResult['outcome'],
        ...(r.htHomeGoals != null
          ? { htHomeGoals: r.htHomeGoals, htAwayGoals: r.htAwayGoals }
          : {}),
      };
      // Evita scritture inutili se nulla è cambiato
      const prev = m.result;
      if (
        m.status === r.status &&
        prev &&
        prev.homeGoals === result.homeGoals &&
        prev.awayGoals === result.awayGoals
      ) {
        return m;
      }
      changed = true;
      return { ...m, status: r.status, result };
    });

    if (!changed) return;
    await db.collection('matchdays').doc(String(md.number)).update({
      matches: updatedMatches,
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info(`Giornata ${md.number}: punteggi live aggiornati`);
  }
);

async function settleSchedine(
  matchdayNumber: number,
  matches: StoredMatch[]
): Promise<void> {
  const resultsMap = new Map<string, MatchResult>();
  for (const m of matches) {
    if (m.result) resultsMap.set(m.id, m.result);
  }

  const schedineSnap = await db
    .collection('schedine')
    .where('matchdayNumber', '==', matchdayNumber)
    .get();

  let bestPoints = -Infinity;
  let bestUserId: string | null = null;
  let highestWinningOdds = 0;
  let highestOddsUserId: string | null = null;

  interface UserOutcome {
    finalPoints: number;
    correct: number;
    bonus: number;
    penalty: number;
    perfect: boolean;
    coins: number;
    pokerEligible: boolean;
  }

  const evaluations = schedineSnap.docs.map(sSnap => {
    const schedina = sSnap.data() as SchedinaDoc;
    const score = evaluateSchedina(
      schedina.predictions,
      resultsMap,
      schedina.powerups ?? {}
    );

    // Gettoni da performance
    let coins = score.correctPredictions * COINS.perCorrectPrediction;
    if (score.correctPredictions === 9) coins += COINS.bonus9Correct;
    if (score.correctPredictions >= 10) coins += COINS.bonus10Correct;

    // Poker: 4 quote vincenti > 2.00
    const pokerBets = score.predictionResults.filter(
      p => p.isCorrect && !p.isVoid && p.odds > TOURNAMENT.minOddsForPoker
    );
    const outcome: UserOutcome = {
      finalPoints: score.finalPoints,
      correct: score.correctPredictions,
      bonus: score.bonusPoints,
      penalty: score.penaltyPoints,
      perfect: score.correctPredictions >= 10,
      coins,
      pokerEligible: pokerBets.length >= 4,
    };

    if (score.finalPoints > bestPoints) {
      bestPoints = score.finalPoints;
      bestUserId = schedina.userId;
    }
    for (const p of score.predictionResults) {
      if (p.isCorrect && !p.isVoid && p.odds > highestWinningOdds) {
        highestWinningOdds = p.odds;
        highestOddsUserId = schedina.userId;
      }
    }

    return { sSnap, schedina, score, outcome };
  });

  const outcomes = new Map(
    evaluations.map(({ schedina, outcome }) => [schedina.userId, outcome])
  );

  // Aggiorna profili in transaction (uno per utente)
  for (const { sSnap, schedina, score, outcome } of evaluations) {
    await db.runTransaction(async tx => {
      const freshSchedina = await tx.get(sSnap.ref);
      if (!freshSchedina.exists || (freshSchedina.data() as SchedinaDoc).settled) return;

      const profileRef = db.collection('profiles').doc(schedina.userId);
      const freshProfile = await tx.get(profileRef);
      if (!freshProfile.exists) {
        throw new Error(`Profilo ${schedina.userId} mancante durante il settlement`);
      }
      const profile = freshProfile.data() as Record<string, number>;
      const isWeeklyWinner = schedina.userId === bestUserId;
      const coins = outcome.coins + (isWeeklyWinner ? COINS.weeklyWinner : 0);
      const profileUpdates: Record<string, unknown> = {
        totalPoints: FieldValue.increment(outcome.finalPoints),
        weeklyPoints: outcome.finalPoints,
        matchdaysPlayed: FieldValue.increment(1),
        bonusPointsTotal: FieldValue.increment(outcome.bonus),
        penaltyPointsTotal: FieldValue.increment(outcome.penalty),
        perfectSchedine: FieldValue.increment(outcome.perfect ? 1 : 0),
        bestMatchdayPoints: Math.max(profile.bestMatchdayPoints ?? 0, outcome.finalPoints),
        correctPredictions: FieldValue.increment(outcome.correct),
        weeklyWins: FieldValue.increment(isWeeklyWinner ? 1 : 0),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (coins > 0) {
        profileUpdates.coins = FieldValue.increment(coins);
        profileUpdates.coinsEarned = FieldValue.increment(coins);
      }

      tx.update(sSnap.ref, {
        predictionResults: score.predictionResults,
        settled: true,
        totalPoints: score.totalPoints,
        bonusPoints: score.bonusPoints,
        penaltyPoints: score.penaltyPoints,
        finalPoints: score.finalPoints,
        correctPredictions: score.correctPredictions,
        settledAt: FieldValue.serverTimestamp(),
      });
      tx.update(profileRef, profileUpdates);
      if (coins > 0) {
        tx.set(
          db.collection('wallet_transactions').doc(`settlement_${matchdayNumber}_${schedina.userId}`),
          {
            userId: schedina.userId,
            amount: coins,
            reason: `settlement_g${matchdayNumber}`,
            createdAt: FieldValue.serverTimestamp(),
          }
        );
      }
    });
  }

  const participantIds = new Set(evaluations.map(e => e.schedina.userId));
  // Paginated reset of weeklyPoints for non-participants (no hard limit)
  let lastDocId: string | null = null;
  const batchSize = 200;
  for (;;) {
    let q = db.collection('profiles').where('isActive', '==', true).limit(batchSize);
    if (lastDocId) {
      const cursorDoc = await db.collection('profiles').doc(lastDocId).get();
      if (cursorDoc.exists) q = q.startAfter(cursorDoc);
    }
    const batch = await q.get();
    if (batch.empty) break;
    const toReset = batch.docs.filter(p => !participantIds.has(p.id));
    if (toReset.length > 0) {
      await Promise.all(
        toReset.map(p =>
          p.ref.update({ weeklyPoints: 0, updatedAt: FieldValue.serverTimestamp() })
        )
      );
    }
    lastDocId = batch.docs[batch.docs.length - 1].id;
    if (batch.docs.length < batchSize) break;
  }

  // Storico premi
  const prizes = db.collection('prizes');
  if (bestUserId) {
    await prizes.doc(`weekly_${matchdayNumber}`).set({
      type: 'weekly_winner',
      matchday: matchdayNumber,
      winnerId: bestUserId,
      points: bestPoints,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  if (
    highestOddsUserId &&
    highestWinningOdds >= TOURNAMENT.minOddsForHighestOddsPrize
  ) {
    await prizes.doc(`highest_odds_${matchdayNumber}`).set({
      type: 'highest_odds',
      matchday: matchdayNumber,
      winnerId: highestOddsUserId,
      odds: highestWinningOdds,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  for (const [uid, o] of outcomes) {
    if (o.pokerEligible) {
      await prizes.doc(`poker_${matchdayNumber}_${uid}`).set({
        type: 'poker',
        matchday: matchdayNumber,
        winnerId: uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
}

// ---------- 3. SUBMIT SCHEDINA (callable) ----------

export const submitSchedina = onCall({ region: REGION, enforceAppCheck: false }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await enforceRateLimit(uid, 'submitSchedina', 3, 60_000);

  const predictions = request.data?.predictions as Prediction[] | undefined;
  const powerups = (request.data?.powerups ?? {}) as PowerUpSelection;
  if (!Array.isArray(predictions) || predictions.length === 0) {
    throw new HttpsError('invalid-argument', 'Pronostici mancanti');
  }

  let md = await getCurrentMatchday();
  if (!md) md = await syncMatchdayInternal();
  if (!md) throw new HttpsError('unavailable', 'Nessuna giornata disponibile');

  if (Timestamp.now().toMillis() >= md.deadline.toMillis()) {
    throw new HttpsError('failed-precondition', 'Deadline superata: schedina chiusa');
  }
  if (predictions.length !== MAX_PICKS_PER_SCHEDINA) {
    throw new HttpsError(
      'invalid-argument',
      `Devi scegliere esattamente ${MAX_PICKS_PER_SCHEDINA} partite`
    );
  }

  // Valida e sostituisce le quote con quelle ufficiali server-side
  const matchIds = new Set(md.matches.map(m => m.id));
  const validated: Prediction[] = predictions.map(p => {
    if (!matchIds.has(p.matchId)) {
      throw new HttpsError('invalid-argument', `Partita non valida: ${p.matchId}`);
    }
    const marketOdds = (md!.odds[p.matchId] as unknown as Record<
      string,
      Record<string, number>
    >)?.[p.betType];
    const officialOdds = marketOdds?.[p.outcome];
    if (officialOdds == null) {
      throw new HttpsError(
        'invalid-argument',
        `Mercato non valido: ${p.betType}/${p.outcome}`
      );
    }
    return { matchId: p.matchId, betType: p.betType, outcome: p.outcome, odds: officialOdds };
  });
  const uniqueMatches = new Set(validated.map(p => p.matchId));
  if (uniqueMatches.size !== validated.length) {
    throw new HttpsError('invalid-argument', 'Un solo pronostico per partita');
  }

  // Costo power-up
  let cost = 0;
  const cleanPowerups: PowerUpSelection = {};
  if (powerups.jolly) {
    if (!matchIds.has(powerups.jolly)) {
      throw new HttpsError('invalid-argument', 'Jolly su partita non valida');
    }
    cost += POWERUPS.jolly.cost;
    cleanPowerups.jolly = powerups.jolly;
  }
  if (powerups.shield) {
    cost += POWERUPS.shield.cost;
    cleanPowerups.shield = true;
  }
  if (powerups.insurance) {
    cost += POWERUPS.insurance.cost;
    cleanPowerups.insurance = true;
  }

  const schedinaRef = db.collection('schedine').doc(`${uid}_${md.number}`);

  await db.runTransaction(async tx => {
    const existing = await tx.get(schedinaRef);
    if (existing.exists && (existing.data() as SchedinaDoc).settled) {
      throw new HttpsError('failed-precondition', 'Schedina già valutata');
    }

    // Ricalcola costo power-up precedenti da rimborsare
    let refund = 0;
    if (existing.exists) {
      const prev = (existing.data() as SchedinaDoc).powerups ?? {};
      if (prev.jolly) refund += POWERUPS.jolly.cost;
      if (prev.shield) refund += POWERUPS.shield.cost;
      if (prev.insurance) refund += POWERUPS.insurance.cost;
    }

    const profileRef = db.collection('profiles').doc(uid);
    const profile = await tx.get(profileRef);
    if (!profile.exists) throw new HttpsError('not-found', 'Profilo non trovato');
    const coins = (profile.data()?.coins ?? 0) as number;
    const netCost = cost - refund;
    if (netCost > coins) {
      throw new HttpsError('failed-precondition', 'Gettoni insufficienti per i power-up');
    }
    if (refund > 0) {
      await adjustCoins(uid, refund, `powerups_refund_g${md!.number}`, tx);
    }
    if (netCost > 0) {
      await adjustCoins(uid, -netCost, `powerups_g${md!.number}`, tx);
    }
    tx.set(schedinaRef, {
      id: schedinaRef.id,
      userId: uid,
      username: profile.data()?.username ?? 'player',
      matchdayNumber: md!.number,
      predictions: validated,
      powerups: cleanPowerups,
      lastMinuteUsed: false,
      predictionResults: null,
      isLocked: true,
      settled: false,
      totalPoints: 0,
      bonusPoints: 0,
      penaltyPoints: 0,
      finalPoints: 0,
      correctPredictions: 0,
      submittedAt: FieldValue.serverTimestamp(),
      settledAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true, matchday: md.number, coinsSpent: cost };
});

// ---------- 4. CAMBIO LAST-MINUTE (callable) ----------

export const changePrediction = onCall({ region: REGION, enforceAppCheck: false }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await enforceRateLimit(uid, 'changePrediction', 5, 60_000);

  const { matchId, betType, outcome } = (request.data ?? {}) as {
    matchId?: string;
    betType?: string;
    outcome?: string;
  };
  if (!matchId || !betType || !outcome) {
    throw new HttpsError('invalid-argument', 'Parametri mancanti');
  }

  const md = await getCurrentMatchday();
  if (!md) throw new HttpsError('unavailable', 'Nessuna giornata disponibile');
  if (Timestamp.now().toMillis() >= md.deadline.toMillis()) {
    throw new HttpsError('failed-precondition', 'Deadline superata');
  }

  const marketOdds = (md.odds[matchId] as unknown as Record<
    string,
    Record<string, number>
  >)?.[betType];
  const officialOdds = marketOdds?.[outcome];
  if (officialOdds == null) {
    throw new HttpsError('invalid-argument', 'Mercato non valido');
  }

  const schedinaRef = db.collection('schedine').doc(`${uid}_${md.number}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(schedinaRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Nessuna schedina inviata');
    const s = snap.data() as SchedinaDoc;
    if (s.settled) throw new HttpsError('failed-precondition', 'Schedina già valutata');
    const idx = s.predictions.findIndex(p => p.matchId === matchId);
    if (idx === -1) throw new HttpsError('invalid-argument', 'Pronostico non trovato');
    const updated = [...s.predictions];
    updated[idx] = { matchId, betType, outcome, odds: officialOdds };
    tx.update(schedinaRef, { predictions: updated });
  });

  return { ok: true, coinsSpent: 0 };
});

// ---------- 4b. ANNULLA SCHEDINA (callable) ----------

export const cancelSchedina = onCall({ region: REGION, enforceAppCheck: false }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');

  const md = await getCurrentMatchday();
  if (!md) throw new HttpsError('unavailable', 'Nessuna giornata disponibile');
  if (Timestamp.now().toMillis() >= md.deadline.toMillis()) {
    throw new HttpsError('failed-precondition', 'Deadline superata, non puoi annullare la schedina');
  }

  const schedinaRef = db.collection('schedine').doc(`${uid}_${md.number}`);

  await db.runTransaction(async tx => {
    const snap = await tx.get(schedinaRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Nessuna schedina da annullare');
    }
    const s = snap.data() as SchedinaDoc;
    if (s.settled) {
      throw new HttpsError('failed-precondition', 'Schedina già valutata, non può essere annullata');
    }

    // Rimborsa i power-up
    let refund = 0;
    const pu = s.powerups ?? {};
    if (pu.jolly) refund += POWERUPS.jolly.cost;
    if (pu.shield) refund += POWERUPS.shield.cost;
    if (pu.insurance) refund += POWERUPS.insurance.cost;

    if (refund > 0) {
      await adjustCoins(uid, refund, `powerups_refund_cancel_g${md.number}`, tx);
    }

    tx.delete(schedinaRef);
  });

  return { ok: true, refund: true };
});

// ---------- 5. MINIGIOCHI (callable) ----------

// --- Seed/update quiz questions into Firestore (admin callable) ---
export const seedQuizQuestions = onCall({ region: REGION }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');

  const batch = db.batch();
  for (let i = 0; i < ALL_QUIZ_QUESTIONS.length; i++) {
    const q = ALL_QUIZ_QUESTIONS[i];
    const ref = db.collection('quiz_questions').doc(`q_${i}`);
    batch.set(ref, {
      question: q.question,
      options: q.options,
      answerIndex: q.answerIndex,
      category: q.category,
    }, { merge: true });
  }
  // Remove old questions beyond current pool
  const allDocs = await db.collection('quiz_questions').get();
  for (const doc of allDocs.docs) {
    if (!doc.id.startsWith('q_') || parseInt(doc.id.slice(2)) >= ALL_QUIZ_QUESTIONS.length) {
      batch.delete(doc.ref);
    }
  }
  await batch.commit();
  return { message: 'Domande aggiornate', count: ALL_QUIZ_QUESTIONS.length };
});

export const playMinigame = onCall({ region: REGION, enforceAppCheck: false }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await enforceRateLimit(uid, 'playMinigame', 10, 60_000);

  const action = request.data?.action as string;
  const today = romeDateString();
  const profileRef = db.collection('profiles').doc(uid);

  // Claim daily reward with once-per-day enforcement
  async function claimDailyReward(
    game: 'ruota' | 'rigori',
    reward: number,
    reason: string
  ): Promise<void> {
    await db.runTransaction(async tx => {
      const profile = await tx.get(profileRef);
      if (!profile.exists) throw new HttpsError('not-found', 'Profilo non trovato');
      const last = profile.data()?.lastPlayed?.[game] as string | undefined;
      if (last === today) {
        throw new HttpsError('failed-precondition', 'Hai già giocato oggi, torna domani!');
      }
      const updates: Record<string, unknown> = {
        [`lastPlayed.${game}`]: today,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (reward > 0) {
        updates.coins = FieldValue.increment(reward);
        updates.coinsEarned = FieldValue.increment(reward);
      }
      tx.update(profileRef, updates);
      if (reward > 0) {
        tx.set(db.collection('wallet_transactions').doc(`${uid}_${game}_${today}`), {
          userId: uid,
          amount: reward,
          reason,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    });
  }

  // Award coins with daily cap (generic, used by rigori and memoria)
  async function awardCappedCoins(
    reward: number,
    cap: number,
    dateField: string,
    counterField: string,
    reason: string
  ): Promise<number> {
    let awarded = 0;
    await db.runTransaction(async tx => {
      const profile = await tx.get(profileRef);
      if (!profile.exists) throw new HttpsError('not-found', 'Profilo non trovato');
      const spentToday = profile.data()?.[counterField] ?? 0;
      const spentDate = profile.data()?.[dateField] as string | undefined;
      const currentCap = spentDate === today ? spentToday : 0;
      const cappedReward = Math.min(reward, cap - currentCap);
      awarded = Math.max(0, cappedReward);
      const updates: Record<string, unknown> = {
        [dateField]: today,
        [counterField]: currentCap + awarded,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (awarded > 0) {
        updates.coins = FieldValue.increment(awarded);
        updates.coinsEarned = FieldValue.increment(awarded);
      }
      tx.update(profileRef, updates);
      if (awarded > 0) {
        tx.set(
          db.collection('wallet_transactions').doc(`${uid}_${reason}_${today}_${Date.now()}`),
          {
            userId: uid,
            amount: awarded,
            reason,
            createdAt: FieldValue.serverTimestamp(),
          }
        );
      }
    });
    return awarded;
  }

  // Award rigori coins with daily cap (no once-per-day limit)
  async function awardRigoriCoins(
    reward: number,
    reason: string
  ): Promise<void> {
    await db.runTransaction(async tx => {
      const profile = await tx.get(profileRef);
      if (!profile.exists) throw new HttpsError('not-found', 'Profilo non trovato');
      const rigoriToday = profile.data()?.rigoriCoinsToday ?? 0;
      const rigoriDate = profile.data()?.rigoriDate as string | undefined;
      const currentCap = rigoriDate === today ? rigoriToday : 0;
      const cappedReward = Math.min(reward, COINS.rigoriDailyCap - currentCap);
      const updates: Record<string, unknown> = {
        rigoriDate: today,
        rigoriCoinsToday: currentCap + Math.max(0, cappedReward),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (cappedReward > 0) {
        updates.coins = FieldValue.increment(cappedReward);
        updates.coinsEarned = FieldValue.increment(cappedReward);
      }
      tx.update(profileRef, updates);
      if (cappedReward > 0) {
        tx.set(
          db.collection('wallet_transactions').doc(`${uid}_rigori_${today}_${Date.now()}`),
          {
            userId: uid,
            amount: cappedReward,
            reason,
            createdAt: FieldValue.serverTimestamp(),
          }
        );
      }
    });
  }

  switch (action) {
    // --- QUIZ ---
    case 'quiz_start': {
      const pool = await db.collection('quiz_questions').get();
      if (pool.empty) {
        throw new HttpsError('unavailable', 'Nessuna domanda disponibile');
      }
      // Get user's seen questions to avoid repeats
      const seenDoc = await db.collection('quiz_seen').doc(uid).get();
      const seenIds = new Set<string>((seenDoc.data()?.questionIds ?? []) as string[]);
      // Filter unseen, fallback to all if everything seen
      let available = pool.docs.filter(d => !seenIds.has(d.id));
      if (available.length < COINS.quizMaxQuestions) {
        // Reset seen if not enough unseen questions
        available = [...pool.docs];
        seenIds.clear();
      }
      const shuffled = fyShuffle(available);
      const picked = shuffled.slice(0, COINS.quizMaxQuestions);
      // Pre-shuffle options for each question and save mapping in session
      const questionsData = picked.map(d => {
        const opts = d.data()?.options as string[];
        const ans = d.data()?.answerIndex as number;
        const indexed = opts.map((opt, i) => ({ opt, correct: i === ans }));
        const shuffledOpts = fyShuffle(indexed);
        return {
          id: d.id,
          question: d.data()?.question as string,
          options: shuffledOpts.map(o => o.opt),
          answerIndex: shuffledOpts.findIndex(o => o.correct),
        };
      });
      const sessionRef = db.collection('quiz_sessions').doc(uid);
      const savedQuestions = await db.runTransaction(async tx => {
        const profile = await tx.get(profileRef);
        if (!profile.exists) throw new HttpsError('not-found', 'Profilo non trovato');
        const last = profile.data()?.lastPlayed?.quiz as string | undefined;
        if (last === today) {
          throw new HttpsError('failed-precondition', 'Hai già giocato oggi, torna domani!');
        }
        const session = await tx.get(sessionRef);
        if (
          session.exists &&
          session.data()?.date === today &&
          session.data()?.submitted === false
        ) {
          return session.data()?.questions as { id: string; options: string[]; answerIndex: number }[];
        }
        tx.set(sessionRef, {
          userId: uid,
          questions: questionsData.map(q => ({ id: q.id, options: q.options, answerIndex: q.answerIndex })),
          date: today,
          submitted: false,
          createdAt: FieldValue.serverTimestamp(),
        });
        return questionsData;
      });
      return { questions: savedQuestions };
    }
    case 'quiz_submit': {
      const answers = (request.data?.answers ?? {}) as Record<string, number>;
      const sessionRef = db.collection('quiz_sessions').doc(uid);
      return db.runTransaction(async tx => {
        const session = await tx.get(sessionRef);
        if (!session.exists || session.data()?.submitted || session.data()?.date !== today) {
          throw new HttpsError('failed-precondition', 'Nessuna sessione quiz attiva');
        }
        const sessQuestions = session.data()?.questions as { id: string; options: string[]; answerIndex: number }[];
        if (!Array.isArray(sessQuestions) || sessQuestions.length === 0) {
          throw new HttpsError('failed-precondition', 'Sessione quiz non valida');
        }
        const profile = await tx.get(profileRef);
        if (!profile.exists) throw new HttpsError('not-found', 'Profilo non trovato');
        const last = profile.data()?.lastPlayed?.quiz as string | undefined;
        if (last === today) {
          throw new HttpsError('failed-precondition', 'Hai già giocato oggi, torna domani!');
        }
        let correct = 0;
        const corrections: Record<string, number> = {};
        for (const q of sessQuestions) {
          corrections[q.id] = q.answerIndex;
          if (answers[q.id] === q.answerIndex) correct++;
        }
        const reward = correct * COINS.quizPerCorrect;
        const updates: Record<string, unknown> = {
          'lastPlayed.quiz': today,
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (reward > 0) {
          updates.coins = FieldValue.increment(reward);
          updates.coinsEarned = FieldValue.increment(reward);
        }
        tx.update(sessionRef, { submitted: true, correct });
        tx.update(profileRef, updates);
        // Track seen questions
        const seenRef = db.collection('quiz_seen').doc(uid);
        const seenSnap = await tx.get(seenRef);
        const existingSeen = (seenSnap.data()?.questionIds ?? []) as string[];
        const newSeen = [...new Set([...existingSeen, ...sessQuestions.map(q => q.id)])];
        tx.set(seenRef, { questionIds: newSeen, updatedAt: FieldValue.serverTimestamp() });
        if (reward > 0) {
          tx.set(db.collection('wallet_transactions').doc(`${uid}_quiz_${today}`), {
            userId: uid,
            amount: reward,
            reason: 'minigame_quiz',
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        return { correct, total: sessQuestions.length, reward, corrections };
      });
    }

    // --- RUOTA ---
    case 'wheel_spin': {
      const prizes = COINS.wheelPrizes;
      const idx = Math.floor(Math.random() * prizes.length);
      const reward = prizes[idx];
      await claimDailyReward('ruota', reward, 'minigame_ruota');
      return { segmentIndex: idx, reward };
    }

    // --- RIGORI (no daily limit, daily coin cap) ---
    case 'rigori_play': {
      const shots = (request.data?.shots ?? []) as { zone: unknown; power: unknown }[];
      if (
        !Array.isArray(shots) ||
        shots.length !== COINS.rigoriMaxShots ||
        shots.some(s => !isValidZone(s?.zone) || typeof s?.power !== 'number')
      ) {
        throw new HttpsError('invalid-argument', `Tiri non validi (${COINS.rigoriMaxShots} tiri con zona e potenza)`);
      }
      const results = shots.map(s => resolveShot(s.zone as Parameters<typeof resolveShot>[0], s.power as number));
      const goals = results.filter(r => r.goal).length;
      const reward = goals * COINS.rigoriPerGoal;
      await awardRigoriCoins(reward, 'minigame_rigori');
      return { results, goals, reward };
    }

    // --- SFIDE 1VS1 ---
    case 'sfida_start': {
      const opponentId = request.data?.opponentId as string;
      if (!opponentId || opponentId === uid) {
        throw new HttpsError('invalid-argument', 'Avversario non valido');
      }
      // Check cooldown: one challenge per pair per week
      const pairKey = [uid, opponentId].sort().join('_');
      const cooldownRef = db.collection('sfide_cooldowns').doc(pairKey);
      const cooldownSnap = await cooldownRef.get();
      if (cooldownSnap.exists) {
        const lastDate = cooldownSnap.data()?.lastDate as string;
        const daysSince = (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < COINS.sfidaCooldownDays) {
          throw new HttpsError(
            'failed-precondition',
            `Hai già sfidato questo avversario. Riprova tra ${Math.ceil(COINS.sfidaCooldownDays - daysSince)} giorni.`
          );
        }
      }
      // Get both profiles for the challenge
      const [myProfile, oppProfile] = await Promise.all([
        profileRef.get(),
        db.collection('profiles').doc(opponentId).get(),
      ]);
      if (!oppProfile.exists) {
        throw new HttpsError('not-found', 'Avversario non trovato');
      }
      return {
        opponent: {
          uid: opponentId,
          displayName: oppProfile.data()?.username ?? 'Avversario',
          coins: oppProfile.data()?.coins ?? 0,
        },
        myCoins: myProfile.data()?.coins ?? 0,
      };
    }
    case 'sfida_play': {
      const opponentId = request.data?.opponentId as string;
      const myShots = (request.data?.shots ?? []) as { zone: unknown; power: unknown }[];
      if (
        !opponentId ||
        opponentId === uid ||
        !Array.isArray(myShots) ||
        myShots.length !== COINS.rigoriMaxShots ||
        myShots.some(s => !isValidZone(s?.zone) || typeof s?.power !== 'number')
      ) {
        throw new HttpsError('invalid-argument', 'Dati sfida non validi');
      }
      const pairKey = [uid, opponentId].sort().join('_');
      const cooldownRef = db.collection('sfide_cooldowns').doc(pairKey);
      // L'avversario "CPU" tira con una qualità legata alle sue statistiche reali
      // (pronostici corretti / giornate giocate), non più a puro random.
      const oppProfileSnap = await db.collection('profiles').doc(opponentId).get();
      const oppSkill = estimateSkillFromProfile(
        (oppProfileSnap.data()?.correctPredictions as number) ?? 0,
        (oppProfileSnap.data()?.matchdaysPlayed as number) ?? 0
      );
      const myResults = myShots.map(s => resolveShot(s.zone as Parameters<typeof resolveShot>[0], s.power as number));
      const oppResults = Array.from({ length: COINS.rigoriMaxShots }, () => {
        const shot = simulateOpponentShot(oppSkill);
        return resolveShot(shot.zone, shot.power);
      });
      const myGoals = myResults.filter(r => r.goal).length;
      const oppGoals = oppResults.filter(r => r.goal).length;
      const won = myGoals > oppGoals;
      const draw = myGoals === oppGoals;
      // Reward proportional to performance
      let reward = 0;
      if (won) {
        reward = Math.min(
          COINS.sfidaBaseReward + myGoals * 2,
          COINS.sfidaMaxReward
        );
      } else if (draw) {
        reward = Math.min(myGoals, COINS.sfidaMaxReward);
      }
      // Set cooldown and award coins in transaction
      await db.runTransaction(async tx => {
        const cooldownSnap = await tx.get(cooldownRef);
        if (cooldownSnap.exists) {
          const lastDate = cooldownSnap.data()?.lastDate as string;
          const daysSince = (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < COINS.sfidaCooldownDays) {
            throw new HttpsError('failed-precondition', 'Sfida già effettuata questa settimana');
          }
        }
        tx.set(cooldownRef, {
          pairKey,
          lastDate: new Date().toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (reward > 0) {
          const updates: Record<string, unknown> = {
            coins: FieldValue.increment(reward),
            coinsEarned: FieldValue.increment(reward),
            updatedAt: FieldValue.serverTimestamp(),
          };
          tx.update(profileRef, updates);
          tx.set(
            db.collection('wallet_transactions').doc(`${uid}_sfida_${pairKey}_${Date.now()}`),
            {
              userId: uid,
              amount: reward,
              reason: 'minigame_sfida',
              createdAt: FieldValue.serverTimestamp(),
            }
          );
        }
      });
      return {
        myResults,
        oppResults,
        myGoals,
        oppGoals,
        won,
        draw,
        reward,
      };
    }

    // --- MEMORIA CALCIO (no daily limit, daily coin cap) ---
    case 'memoria_play': {
      const levelsCompleted = Math.min(3, Math.max(0, Math.floor(request.data?.levelsCompleted ?? 0)));
      const timeRemaining = Math.max(0, Math.floor(request.data?.timeRemaining ?? 0));
      if (levelsCompleted < 1) {
        throw new HttpsError('invalid-argument', 'Devi completare almeno un livello');
      }
      const levelReward = levelsCompleted * COINS.memoriaPerLevel;
      const timeBonus = Math.floor(timeRemaining / 5) * COINS.memoriaTimeBonus;
      const totalReward = levelReward + timeBonus;
      const awarded = await awardCappedCoins(
        totalReward, COINS.memoriaDailyCap,
        'memoriaDate', 'memoriaCoinsToday',
        'minigame_memoria'
      );
      return {
        levelsCompleted,
        timeRemaining,
        reward: awarded,
        levelReward,
        timeBonus,
      };
    }

    default:
      throw new HttpsError('invalid-argument', `Azione sconosciuta: ${action}`);
  }
});

export const getPublicProfiles = onCall({ region: REGION, enforceAppCheck: false }, async request => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  }
  const pageSize = Math.min(100, Math.max(10, Number(request.data?.pageSize ?? 100)));
  const cursor = request.data?.cursor as string | undefined;

  let query = db.collection('profiles').orderBy('totalPoints', 'desc').limit(pageSize);
  if (cursor) {
    const cursorDoc = await db.collection('profiles').doc(cursor).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }
  const profiles = await query.get();
  const lastDoc = profiles.docs[profiles.docs.length - 1];
  return {
    profiles: profiles.docs
      .filter(d => d.data().isActive !== false)
      .map(d => {
        const p = d.data();
        return {
          id: d.id,
          username: typeof p.username === 'string' ? p.username : 'player',
          avatarUrl: typeof p.avatarUrl === 'string' ? p.avatarUrl : null,
          totalPoints: Number(p.totalPoints ?? 0),
          weeklyPoints: Number(p.weeklyPoints ?? 0),
          matchdaysPlayed: Number(p.matchdaysPlayed ?? 0),
          perfectSchedine: Number(p.perfectSchedine ?? 0),
          bonusPointsTotal: Number(p.bonusPointsTotal ?? 0),
          penaltyPointsTotal: Number(p.penaltyPointsTotal ?? 0),
          weeklyWins: Number(p.weeklyWins ?? 0),
          bestMatchdayPoints: Number(p.bestMatchdayPoints ?? 0),
          correctPredictions: Number(p.correctPredictions ?? 0),
          coins: Number(p.coins ?? 0),
          coinsEarned: Number(p.coinsEarned ?? 0),
        };
      }),
    nextCursor: lastDoc ? lastDoc.id : null,
  };
});

export const manageLeague = onCall({ region: REGION, enforceAppCheck: false }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  const action = request.data?.action as string;

  if (action === 'create') {
    const name = typeof request.data?.name === 'string' ? request.data.name.trim() : '';
    const description =
      typeof request.data?.description === 'string' ? request.data.description.trim() : '';
    const isPrivate = request.data?.isPrivate === true;
    const requestedMax = Number(request.data?.maxMembers);
    if (!name || name.length > 40 || description.length > 80) {
      throw new HttpsError('invalid-argument', 'Nome o descrizione non validi');
    }
    if (!Number.isInteger(requestedMax) || requestedMax < 2 || requestedMax > 100) {
      throw new HttpsError('invalid-argument', 'Numero massimo partecipanti non valido');
    }
    const profile = await db.collection('profiles').doc(uid).get();
    if (!profile.exists) throw new HttpsError('not-found', 'Profilo non trovato');

    let inviteCode = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateInviteCode();
      const duplicate = await db
        .collection('leagues')
        .where('inviteCode', '==', candidate)
        .limit(1)
        .get();
      if (duplicate.empty) {
        inviteCode = candidate;
        break;
      }
    }
    if (!inviteCode) throw new HttpsError('internal', 'Impossibile generare il codice invito');

    const ref = db.collection('leagues').doc();
    await ref.set({
      name,
      description,
      ownerId: uid,
      ownerName: profile.data()?.username ?? 'player',
      inviteCode,
      isPrivate,
      maxMembers: requestedMax,
      memberIds: [uid],
      memberCount: 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, leagueId: ref.id };
  }

  if (action === 'joinByCode') {
    const inviteCode =
      typeof request.data?.inviteCode === 'string'
        ? request.data.inviteCode.trim().toUpperCase()
        : '';
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(inviteCode)) {
      throw new HttpsError('invalid-argument', 'Codice invito non valido');
    }
    const found = await db
      .collection('leagues')
      .where('inviteCode', '==', inviteCode)
      .limit(1)
      .get();
    if (found.empty) throw new HttpsError('not-found', 'Codice invito non valido');
    const ref = found.docs[0].ref;
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'Lega non trovata');
      const league = snap.data() as { memberIds?: string[]; maxMembers?: number };
      const members = Array.isArray(league.memberIds) ? league.memberIds : [];
      if (members.includes(uid)) {
        throw new HttpsError('failed-precondition', 'Sei già membro di questa lega');
      }
      if (members.length >= Number(league.maxMembers ?? 0)) {
        throw new HttpsError('resource-exhausted', 'Lega al completo');
      }
      tx.update(ref, {
        memberIds: [...members, uid],
        memberCount: members.length + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return { ok: true, leagueId: ref.id };
  }

  const leagueId = typeof request.data?.leagueId === 'string' ? request.data.leagueId : '';
  if (!leagueId || leagueId.length > 128) {
    throw new HttpsError('invalid-argument', 'Lega non valida');
  }
  const ref = db.collection('leagues').doc(leagueId);

  if (action === 'joinPublic') {
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'Lega non trovata');
      const league = snap.data() as {
        isPrivate?: boolean;
        memberIds?: string[];
        maxMembers?: number;
      };
      if (league.isPrivate) throw new HttpsError('permission-denied', 'Lega privata');
      const members = Array.isArray(league.memberIds) ? league.memberIds : [];
      if (members.includes(uid)) {
        throw new HttpsError('failed-precondition', 'Sei già membro di questa lega');
      }
      if (members.length >= Number(league.maxMembers ?? 0)) {
        throw new HttpsError('resource-exhausted', 'Lega al completo');
      }
      tx.update(ref, {
        memberIds: [...members, uid],
        memberCount: members.length + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return { ok: true, leagueId };
  }

  if (action === 'leave') {
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'Lega non trovata');
      const league = snap.data() as { ownerId?: string; memberIds?: string[] };
      if (league.ownerId === uid) {
        throw new HttpsError('failed-precondition', 'Il proprietario deve eliminare la lega');
      }
      const members = Array.isArray(league.memberIds) ? league.memberIds : [];
      if (!members.includes(uid)) {
        throw new HttpsError('failed-precondition', 'Non sei membro di questa lega');
      }
      const nextMembers = members.filter(id => id !== uid);
      tx.update(ref, {
        memberIds: nextMembers,
        memberCount: nextMembers.length,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return { ok: true, leagueId };
  }

  if (action === 'delete') {
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'Lega non trovata');
      if (snap.data()?.ownerId !== uid) {
        throw new HttpsError('permission-denied', 'Solo il proprietario può eliminare la lega');
      }
      tx.delete(ref);
    });
    return { ok: true, leagueId };
  }

  throw new HttpsError('invalid-argument', `Azione sconosciuta: ${action}`);
});

// ---------- 6. LEGHE: contatore leaguesJoined (trigger) ----------

export const onLeagueWritten = onDocumentWritten(
  { document: 'leagues/{leagueId}', region: REGION },
  async event => {
    const before = (event.data?.before?.data()?.memberIds ?? []) as string[];
    const after = (event.data?.after?.data()?.memberIds ?? []) as string[];
    const added = after.filter(uid => !before.includes(uid));
    for (const uid of added) {
      await db
        .collection('profiles')
        .doc(uid)
        .set({ leaguesJoined: FieldValue.increment(1) }, { merge: true })
        .catch(err => logger.warn(`leaguesJoined update failed for ${uid}`, err));
    }
  }
);

// ---------- 7. MISSIONI (callable) ----------

export const claimMission = onCall({ region: REGION, enforceAppCheck: false }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');

  const missionId = request.data?.missionId as string;
  const mission = MISSIONS.find(m => m.id === missionId);
  if (!mission) throw new HttpsError('invalid-argument', 'Missione sconosciuta');

  const profileRef = db.collection('profiles').doc(uid);
  const reward = await db.runTransaction(async tx => {
    const snap = await tx.get(profileRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Profilo non trovato');
    const p = snap.data() as Record<string, unknown>;
    const claimed = (p.claimedMissions ?? []) as string[];
    if (claimed.includes(missionId)) {
      throw new HttpsError('failed-precondition', 'Missione già riscossa');
    }
    const value = (p[mission.field] ?? 0) as number;
    if (value < mission.target) {
      throw new HttpsError(
        'failed-precondition',
        `Missione non completata (${value}/${mission.target})`
      );
    }
    tx.update(profileRef, {
      claimedMissions: FieldValue.arrayUnion(missionId),
    });
    await adjustCoins(uid, mission.reward, `mission_${missionId}`, tx);
    return mission.reward;
  });

  return { ok: true, reward };
});

// ============================================
// 8. ADMIN FUNCTIONS (callable, role-gated)
// ============================================

async function requireAdmin(uid: string): Promise<void> {
  const snap = await db.collection('profiles').doc(uid).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Profilo non trovato');
  if (snap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Accesso negato: richiesto ruolo admin');
  }
}

/** Sync giornata manuale (admin). */
export const adminSyncMatchday = onCall({ region: REGION }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await requireAdmin(uid);
  const forceOdds = request.data?.forceOdds === true;
  const md = await syncMatchdayInternal(forceOdds);
  return { ok: true, matchday: md ? { number: md.number, matches: md.matches.length } : null };
});

/** Lista/attivazione campionati (admin): quali campionati alimentano il pool partite. */
export const adminManageCompetitions = onCall({ region: REGION }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await requireAdmin(uid);

  const action = request.data?.action as string;
  const configRef = db.collection('config').doc('competitions');

  if (action === 'list') {
    const snap = await configRef.get();
    const active = (snap.exists ? (snap.data()?.active as string[]) : null) ?? DEFAULT_ACTIVE_COMPETITIONS;
    return {
      competitions: COMPETITIONS.map(c => ({ ...c, active: active.includes(c.code) })),
    };
  }

  if (action === 'toggle') {
    const code = request.data?.code as string;
    if (!code || !COMPETITIONS.some(c => c.code === code)) {
      throw new HttpsError('invalid-argument', 'Campionato non valido');
    }
    const snap = await configRef.get();
    const active = (snap.exists ? (snap.data()?.active as string[]) : null) ?? [...DEFAULT_ACTIVE_COMPETITIONS];
    const isActive = active.includes(code);
    const updated = isActive ? active.filter(c => c !== code) : [...active, code];
    await configRef.set({ active: updated, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, active: !isActive };
  }

  throw new HttpsError('invalid-argument', `Azione sconosciuta: ${action}`);
});

/** Force settlement di una giornata specifica (admin). */
export const adminForceSettle = onCall({ region: REGION }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await requireAdmin(uid);
  const matchdayNumber = request.data?.matchdayNumber as number;
  if (!matchdayNumber) throw new HttpsError('invalid-argument', 'matchdayNumber richiesto');

  const mdSnap = await db.collection('matchdays').doc(String(matchdayNumber)).get();
  if (!mdSnap.exists) throw new HttpsError('not-found', 'Giornata non trovata');
  const md = mdSnap.data() as MatchdayDoc;
  if (md.settled) throw new HttpsError('failed-precondition', 'Giornata già settleata');

  const results = await fetchResults(
    md.matches.map(m => ({ id: m.id, scheduledAt: m.scheduledAt.toDate(), competition: m.competition }))
  );

  const updatedMatches = md.matches.map(m => {
    const r = results.get(m.id);
    if (!r) return m;
    const outcome = r.homeGoals > r.awayGoals ? '1' as const : r.awayGoals > r.homeGoals ? '2' as const : 'X' as const;
    return {
      ...m,
      status: r.status,
      result: { homeGoals: r.homeGoals, awayGoals: r.awayGoals, outcome },
    };
  });
  await mdSnap.ref.update({ matches: updatedMatches, updatedAt: FieldValue.serverTimestamp() });

  // Reuse the same settlement logic as the scheduled function (transactions + profile updates + prizes)
  await settleSchedine(matchdayNumber, updatedMatches as unknown as StoredMatch[]);

  // Mark matchday as settled
  await mdSnap.ref.update({ settled: true, updatedAt: FieldValue.serverTimestamp() });

  return { ok: true, matchday: matchdayNumber };
});

/** CRUD sponsor (admin). */
export const adminManageSponsor = onCall({ region: REGION }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await requireAdmin(uid);

  const action = request.data?.action as string;
  const { name, tagline, accent, href, sponsorId } = request.data ?? {};

  if (action === 'list') {
    const snap = await db.collection('sponsors').orderBy('createdAt', 'desc').get();
    return {
      sponsors: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    };
  }

  if (action === 'create') {
    if (!name) throw new HttpsError('invalid-argument', 'name richiesto');
    const ref = db.collection('sponsors').doc();
    await ref.set({
      name,
      tagline: tagline ?? '',
      accent: accent ?? '#84d80c',
      href: href ?? null,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, sponsorId: ref.id };
  }

  if (action === 'update') {
    if (!sponsorId) throw new HttpsError('invalid-argument', 'sponsorId richiesto');
    await db.collection('sponsors').doc(sponsorId).update({
      ...(name != null && { name }),
      ...(tagline != null && { tagline }),
      ...(accent != null && { accent }),
      ...(href != null && { href }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true };
  }

  if (action === 'delete') {
    if (!sponsorId) throw new HttpsError('invalid-argument', 'sponsorId richiesto');
    await db.collection('sponsors').doc(sponsorId).delete();
    return { ok: true };
  }

  if (action === 'toggle') {
    if (!sponsorId) throw new HttpsError('invalid-argument', 'sponsorId richiesto');
    const ref = db.collection('sponsors').doc(sponsorId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Sponsor non trovato');
    await ref.update({ active: !snap.data()?.active });
    return { ok: true, active: !snap.data()?.active };
  }

  throw new HttpsError('invalid-argument', `Azione sconosciuta: ${action}`);
});

/** Statistiche admin (utenti, schedine, gettoni). */
export const adminGetStats = onCall({ region: REGION }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await requireAdmin(uid);

  const [profilesSnap, schedineSnap, matchdaysSnap, sponsorsSnap] = await Promise.all([
    db.collection('profiles').count().get(),
    db.collection('schedine').count().get(),
    db.collection('matchdays').where('settled', '==', false).count().get(),
    db.collection('sponsors').where('active', '==', true).count().get(),
  ]);

  const activeProfilesSnap = await db
    .collection('profiles')
    .where('isActive', '==', true)
    .count()
    .get();

  return {
    totalUsers: profilesSnap.data().count,
    activeUsers: activeProfilesSnap.data().count,
    totalSchedine: schedineSnap.data().count,
    pendingMatchdays: matchdaysSnap.data().count,
    activeSponsors: sponsorsSnap.data().count,
  };
});

/** Ban/unban utente (admin). */
export const adminToggleBan = onCall({ region: REGION }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await requireAdmin(uid);

  const targetUid = request.data?.targetUid as string;
  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid richiesto');
  if (targetUid === uid) throw new HttpsError('invalid-argument', 'Non puoi bannare te stesso');

  const ref = db.collection('profiles').doc(targetUid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Utente non trovato');

  const currentActive = snap.data()?.isActive ?? true;
  await ref.update({
    isActive: !currentActive,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, isActive: !currentActive };
});
