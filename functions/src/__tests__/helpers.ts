// Utilità condivise dai test di integrazione: semina e ripulisce lo stato
// dell'emulatore, e costruisce le richieste per le callable.

// L'import di `../index` va per primo: è lì che avviene `initializeApp()`.
// Inizializzare l'app anche qui farebbe fallire il secondo dei due con
// "default Firebase app already exists".
import '../index';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { COINS } from '../config';
import type { MatchOdds } from '../odds';

export const db = getFirestore();

/** Quote piatte e valide per ogni mercato: i test verificano i soldi, non le quote. */
export function flatOdds(): MatchOdds {
  return {
    esito: { '1': 2.0, X: 3.2, '2': 3.8 },
    over_under: { OVER: 1.9, UNDER: 1.9 },
    goal_nogoal: { GG: 1.8, NG: 2.0 },
    doppia_chance: { '1X': 1.3, '12': 1.25, X2: 1.7 },
    multigoal: {
      'O0.5': 1.1, 'U0.5': 6.0, 'O1.5': 1.4, 'U1.5': 2.8,
      'O2.5': 2.1, 'U2.5': 1.7, 'O3.5': 3.6, 'U3.5': 1.28,
    },
    esito_1t: { '1': 2.6, X: 2.1, '2': 4.2 },
    over_under_1t: { OVER: 2.4, UNDER: 1.5 },
    goal_nogoal_1t: { GG: 3.1, NG: 1.35 },
  };
}

export interface SeedMatchdayOptions {
  number?: number;
  /** Millisecondi da adesso: negativo = deadline già passata. */
  deadlineOffsetMs?: number;
  /** Millisecondi da adesso per il fischio d'inizio di ogni partita. */
  kickoffOffsetMs?: number;
  matchCount?: number;
  settled?: boolean;
}

export async function seedMatchday(opts: SeedMatchdayOptions = {}) {
  const {
    number = 1,
    deadlineOffsetMs = 60 * 60 * 1000,
    kickoffOffsetMs = 3 * 60 * 60 * 1000,
    matchCount = 10,
    settled = false,
  } = opts;

  const now = Date.now();
  const matches = Array.from({ length: matchCount }, (_, i) => ({
    id: `m${i}`,
    matchday: number,
    competition: 'ITA.1',
    homeTeam: { id: `h${i}`, name: `Casa ${i}`, shortName: `CAS${i}` },
    awayTeam: { id: `a${i}`, name: `Ospite ${i}`, shortName: `OSP${i}` },
    scheduledAt: Timestamp.fromMillis(now + kickoffOffsetMs),
    status: 'scheduled',
  }));
  const odds: Record<string, MatchOdds> = {};
  for (const m of matches) odds[m.id] = flatOdds();

  await db.collection('matchdays').doc(String(number)).set({
    number,
    season: '2025-2026',
    status: 'open',
    deadline: Timestamp.fromMillis(now + deadlineOffsetMs),
    matches,
    odds,
    settled,
  });
  await db.collection('matchdays').doc('_meta').set({ currentNumber: number });

  return { number, matches, odds };
}

/** Sposta il fischio d'inizio (o lo stato) di una singola partita già seminata. */
export async function updateMatch(
  matchdayNumber: number,
  matchId: string,
  patch: { kickoffOffsetMs?: number; status?: string }
) {
  const ref = db.collection('matchdays').doc(String(matchdayNumber));
  const snap = await ref.get();
  const data = snap.data() as { matches: { id: string; scheduledAt: Timestamp; status: string }[] };
  const matches = data.matches.map(m =>
    m.id === matchId
      ? {
          ...m,
          ...(patch.kickoffOffsetMs != null
            ? { scheduledAt: Timestamp.fromMillis(Date.now() + patch.kickoffOffsetMs) }
            : {}),
          ...(patch.status != null ? { status: patch.status } : {}),
        }
      : m
  );
  await ref.update({ matches });
}

/** Sposta la deadline della giornata (per i test post-deadline). */
export async function setDeadline(matchdayNumber: number, offsetMs: number): Promise<void> {
  await db
    .collection('matchdays')
    .doc(String(matchdayNumber))
    .update({ deadline: Timestamp.fromMillis(Date.now() + offsetMs) });
}

/**
 * Duello contro il bot all'ultimo tiro dei regolari (round 10, tira il bot):
 * qualunque sia l'esito il giocatore resta avanti, quindi la mossa successiva
 * chiude la partita con lui vincitore. Serve a testare il premio senza giocare
 * dieci round veri, che il rate limit non permetterebbe.
 */
export async function seedDuelloQuasiFinito(uid: string, username = 'sfidante'): Promise<string> {
  const now = Date.now();
  const ref = db.collection('penalty_duels').doc();
  await ref.set({
    code: '',
    p1: { uid, username, score: 5 },
    p2: { uid: 'bot', username: 'Bot', score: 2, isBot: true },
    mode: 'botAlternate',
    round: 10,
    attacker: 2,
    p1Choice: null,
    p2Choice: null,
    phase: 'playing',
    startedAt: now,
    deadlineAt: now + 5000,
    winner: null,
    reward: 0,
    lastRound: null,
  });
  return ref.id;
}

/** Duello in uno stato arbitrario, per i test della pulizia. */
export async function seedDuello(stato: {
  phase: 'waiting' | 'playing' | 'finished';
  startedAtOffsetMs?: number;
  deadlineOffsetMs?: number;
  p1Uid?: string;
  p2Uid?: string;
}): Promise<string> {
  const now = Date.now();
  const ref = db.collection('penalty_duels').doc();
  await ref.set({
    code: 'ABC123',
    p1: { uid: stato.p1Uid ?? 'p1', username: 'P1', score: 0 },
    p2: { uid: stato.p2Uid ?? '', username: '', score: 0 },
    mode: 'human',
    round: 1,
    attacker: 1,
    p1Choice: null,
    p2Choice: null,
    phase: stato.phase,
    startedAt: now + (stato.startedAtOffsetMs ?? 0),
    deadlineAt: now + (stato.deadlineOffsetMs ?? 5000),
    winner: null,
    reward: 0,
    lastRound: null,
  });
  return ref.id;
}

export async function readDuello(duelId: string): Promise<Record<string, unknown> | null> {
  const snap = await db.collection('penalty_duels').doc(duelId).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

/** La data "di oggi" come la calcola il server (fuso di Roma). */
export function todayRome(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export async function seedProfile(uid: string, coins = 1000, extra: Record<string, unknown> = {}) {
  await db.collection('profiles').doc(uid).set({
    id: uid,
    username: `player_${uid}`,
    email: `${uid}@example.com`,
    avatarUrl: null,
    totalPoints: 0,
    weeklyPoints: 0,
    matchdaysPlayed: 0,
    perfectSchedine: 0,
    bonusPointsTotal: 0,
    penaltyPointsTotal: 0,
    weeklyWins: 0,
    bestMatchdayPoints: 0,
    correctPredictions: 0,
    paidWeeks: 0,
    joinedMatchday: 1,
    isActive: true,
    coins,
    coinsEarned: 0,
    claimedMissions: [],
    leaguesJoined: 0,
    ...extra,
  });
}

/** Lega con i membri indicati. */
export async function seedLega(
  leagueId: string,
  memberIds: string[],
  opts: { isPrivate?: boolean; name?: string } = {}
): Promise<void> {
  await db.collection('leagues').doc(leagueId).set({
    id: leagueId,
    name: opts.name ?? `Lega ${leagueId}`,
    description: '',
    ownerId: memberIds[0] ?? '',
    memberIds,
    memberCount: memberIds.length,
    maxMembers: 20,
    isPrivate: opts.isPrivate ?? false,
    inviteCode: 'ABC123',
  });
}

/** Riga di classifica di una lega (sottocollezione standings). */
export async function readStanding(
  leagueId: string,
  uid: string
): Promise<Record<string, number> | null> {
  const snap = await db
    .collection('leagues')
    .doc(leagueId)
    .collection('standings')
    .doc(uid)
    .get();
  return snap.exists ? (snap.data() as Record<string, number>) : null;
}

export async function readProfile(uid: string): Promise<Record<string, number>> {
  const snap = await db.collection('profiles').doc(uid).get();
  return (snap.data() ?? {}) as Record<string, number>;
}

export async function coinsOf(uid: string): Promise<number> {
  return (await readProfile(uid)).coins ?? 0;
}

export async function readSchedina(uid: string, matchdayNumber: number) {
  const snap = await db.collection('schedine').doc(`${uid}_${matchdayNumber}`).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

export async function walletOf(uid: string): Promise<{ amount: number; reason: string }[]> {
  const snap = await db.collection('wallet_transactions').where('userId', '==', uid).get();
  return snap.docs
    .map(d => d.data() as { amount: number; reason: string })
    .sort((a, b) => a.reason.localeCompare(b.reason));
}

/**
 * 10 pronostici validi sulle prime 10 partite della giornata seminata.
 *
 * Il tipo di ritorno è volutamente largo: i test costruiscono anche payload
 * non validi, che è esattamente ciò che manderebbe un client malevolo.
 */
export function tenPredictions(outcome: string = '1'): Record<string, unknown>[] {
  return Array.from({ length: 10 }, (_, i) => ({
    matchId: `m${i}`,
    betType: 'esito',
    outcome,
    // Quota volutamente falsa: il server deve sostituirla con quella ufficiale.
    odds: 99,
  }));
}

/** Ripulisce le collezioni toccate dai test. */
export async function wipe(): Promise<void> {
  for (const name of [
    'profiles', 'schedine', 'matchdays', 'wallet_transactions',
    'rate_limits', 'prizes', 'penalty_duels', 'leagues', 'season_resets',
    'sfide_cooldowns',
  ]) {
    await db.recursiveDelete(db.collection(name));
  }
}

export const STARTING_COINS = COINS.starting;
