// ============================================
// FANTA SCHEDINA - FIRESTORE DATA LAYER
// CRUD helpers per profili, schedine, giornate
// ============================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  Timestamp,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Match,
  Matchday,
  Participant,
  Prediction,
  PredictionResult,
  RankingEntry,
  Schedina,
  SchedinaResult,
} from '@/types';
import type { MatchOdds } from '@/data/mockData';
import { computeWeeklyRanking } from './rankings';
import { getPublicProfilesFn, getRankingsFn, type PublicProfileData } from './gameApi';
import {
  USERNAME_REGOLA,
  chiaveUsername,
  conSuffisso,
  normalizzaUsername,
  usernameValido,
} from './username';
import type { WeeklyRanking } from '@/types';

// ============================================
// COLLECTIONS
// ============================================
const COL = {
  profiles: 'profiles',
  usernames: 'usernames',
  matchdays: 'matchdays',
  schedine: 'schedine',
} as const;

// ============================================
// PROFILE
// ============================================
export interface ProfileDoc {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  totalPoints: number;
  weeklyPoints: number;
  matchdaysPlayed: number;
  perfectSchedine: number;
  bonusPointsTotal: number;
  penaltyPointsTotal: number;
  weeklyWins: number;
  bestMatchdayPoints: number;
  correctPredictions: number;
  paidWeeks: number;
  joinedMatchday: number;
  isActive: boolean;
  coins: number;
  coinsEarned: number;
  claimedMissions: string[];
  leaguesJoined: number;
  role?: 'admin' | 'user';
  lastPlayed?: Record<string, string>;
  /** Giorni consecutivi di presenza (serie), scritti dal server. */
  streakDays?: number;
  /** Ultimo giorno contato nella serie, `YYYY-MM-DD` nel fuso di Roma. */
  streakDate?: string;
  /** Categorie di notifica spente dall'utente (assente = tutte attive). */
  notifPrefs?: Record<string, boolean>;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export async function ensureProfile(
  uid: string,
  email: string,
  username: string
): Promise<ProfileDoc> {
  const ref = doc(db, COL.profiles, uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { ...(snap.data() as ProfileDoc), id: uid };

  const profile: Omit<ProfileDoc, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    id: uid,
    username: normalizzaUsername(username),
    email,
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
    coins: 100,
    coinsEarned: 0,
    claimedMissions: [],
    leaguesJoined: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  // Il profilo nasce insieme alla prenotazione del suo username (collezione
  // `usernames`): le rules accettano l'uno solo con l'altra, e la
  // prenotazione non si puo' creare se il nome e' gia' preso. Se lo e', si
  // riprova con un suffisso numerico: il nome si cambia poi dal profilo.
  let ultimoErrore: unknown = null;
  for (let tentativo = 0; tentativo < 5; tentativo++) {
    const nome =
      tentativo === 0
        ? profile.username
        : conSuffisso(profile.username, 1000 + Math.floor(Math.random() * 9000));
    try {
      const batch = writeBatch(db);
      batch.set(ref, { ...profile, username: nome });
      batch.set(doc(db, COL.usernames, chiaveUsername(nome)), {
        uid,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      const created = await getDoc(ref);
      return created.data() as ProfileDoc;
    } catch (e) {
      // Alla registrazione questa funzione parte due volte: una da `signUp` e
      // una dal listener `onAuthStateChanged`, che ha già letto "profilo
      // assente". La seconda scrive su un documento nel frattempo creato, e
      // Firestore la valuta come update: le rules la respingono (giustamente,
      // consentono di toccare solo username/avatarUrl). Il profilo però c'è:
      // va riletto, non trattato come errore — altrimenti finisce a Sentry e
      // l'utente resta senza profilo caricato fino al reload.
      const esistente = await getDoc(ref);
      if (esistente.exists()) return esistente.data() as ProfileDoc;
      // Profilo assente: il rifiuto viene dal nome gia' prenotato da altri.
      ultimoErrore = e;
      if ((e as { code?: string }).code !== 'permission-denied') break;
    }
  }
  throw ultimoErrore;
}

/**
 * Cambia lo username: aggiorna il profilo e sposta la prenotazione in
 * `usernames` nella stessa scrittura atomica, cosi' due persone non possono
 * prendere lo stesso nome (nemmeno cambiando solo le maiuscole).
 */
export async function cambiaUsername(uid: string, attuale: string, nuovo: string): Promise<void> {
  if (!usernameValido(nuovo)) throw new Error(`Username non valido. ${USERNAME_REGOLA}`);
  const nuovaRef = doc(db, COL.usernames, chiaveUsername(nuovo));
  const prenotazione = await getDoc(nuovaRef);
  if (prenotazione.exists() && prenotazione.data()?.uid !== uid) {
    throw new Error('Username già in uso: scegline un altro');
  }
  const batch = writeBatch(db);
  batch.update(doc(db, COL.profiles, uid), { username: nuovo, updatedAt: serverTimestamp() });
  if (!prenotazione.exists()) {
    batch.set(nuovaRef, { uid, createdAt: serverTimestamp() });
  }
  // La prenotazione del vecchio nome si libera, se era nostra.
  if (usernameValido(attuale) && chiaveUsername(attuale) !== chiaveUsername(nuovo)) {
    const vecchiaRef = doc(db, COL.usernames, chiaveUsername(attuale));
    const vecchia = await getDoc(vecchiaRef);
    if (vecchia.exists() && vecchia.data()?.uid === uid) batch.delete(vecchiaRef);
  }
  // Fra il controllo e la scrittura qualcun altro puo' aver preso il nome:
  // le rules respingono il batch.
  const esito = await batch.commit().then(
    () => null,
    (e: unknown) => e
  );
  if (esito === null) return;
  if ((esito as { code?: string }).code === 'permission-denied') {
    throw new Error('Username già in uso: scegline un altro');
  }
  throw esito;
}

export async function getProfile(uid: string): Promise<ProfileDoc | null> {
  const snap = await getDoc(doc(db, COL.profiles, uid));
  // `id` viene dall’uid, che e’ l’id del documento: cosi’ e’ sempre valorizzato
  // anche per i profili scritti dalle Functions, che non ripetono l’uid nei
  // campi. Senza, `profile.id` restava undefined e le leghe non si caricavano.
  return snap.exists() ? { ...(snap.data() as ProfileDoc), id: uid } : null;
}

export async function updateProfile(
  uid: string,
  updates: Partial<Omit<ProfileDoc, 'id' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, COL.profiles, uid), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function getAllProfiles(): Promise<PublicProfileData[]> {
  const all: PublicProfileData[] = [];
  let cursor: string | undefined;
  for (;;) {
    const { profiles, nextCursor } = await getPublicProfilesFn(100, cursor);
    all.push(...profiles);
    if (!nextCursor) break;
    cursor = nextCursor;
  }
  return all;
}

export function profileToParticipant(p: ProfileDoc): Participant {
  return {
    id: p.id,
    username: p.username,
    email: p.email,
    avatarUrl: p.avatarUrl ?? undefined,
    createdAt: p.createdAt?.toDate().toISOString() ?? new Date().toISOString(),
    isActive: p.isActive,
    totalPoints: p.totalPoints,
    weeklyPoints: p.weeklyPoints,
    rank: 0,
    paidWeeks: p.paidWeeks,
    joinedMatchday: p.joinedMatchday,
    coins: p.coins ?? 0,
    coinsEarned: p.coinsEarned ?? 0,
  };
}

// ============================================
// MATCHDAY
// ============================================
interface SerializedMatch extends Omit<Match, 'scheduledAt'> {
  scheduledAt: Timestamp;
}

export interface MatchdayDoc {
  number: number;
  season: string;
  status: Matchday['status'];
  deadline: Timestamp;
  matches: SerializedMatch[];
  odds: Record<string, MatchOdds>;
  /** Quote per agenzia, per le leghe che ne hanno una propria. */
  oddsPerBookmaker?: Record<string, Record<string, MatchOdds>>;
  /** Partite quotate (mercato esito) per agenzia, scritto dal server. */
  quotateConteggio?: Record<string, number>;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  settled: boolean;
}

function deserializeMatch(m: SerializedMatch): Match {
  return { ...m, scheduledAt: m.scheduledAt.toDate() };
}

function matchdayDocToMatchday(data: MatchdayDoc): Matchday {
  return {
    number: data.number,
    season: data.season,
    status: data.status,
    deadline: data.deadline.toDate(),
    matches: data.matches.map(deserializeMatch),
  };
}

export async function getMatchday(number: number): Promise<Matchday | null> {
  const snap = await getDoc(doc(db, COL.matchdays, String(number)));
  if (!snap.exists()) return null;
  return matchdayDocToMatchday(snap.data() as MatchdayDoc);
}

/**
 * Sottoscrizione realtime al doc di una giornata (aggiornata dalle Cloud Functions,
 * es. updateLiveScores). Ritorna la funzione di unsubscribe.
 */
export function subscribeMatchday(
  number: number,
  cb: (matchday: Matchday | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, COL.matchdays, String(number)),
    snap => cb(snap.exists() ? matchdayDocToMatchday(snap.data() as MatchdayDoc) : null),
    err => console.warn('[db] subscribeMatchday:', err)
  );
}

/** Agenzia delle quote generali. Specchio di BOOKMAKER_PREDEFINITO in functions/src/realOdds.ts. */
export const BOOKMAKER_PREDEFINITO = 'Goldbet IT';

export interface MatchdayCircuito {
  matchday: Matchday;
  /** Quote con cui si gioca in questo circuito (vuote se non ce ne sono). */
  odds: Record<string, MatchOdds>;
  /**
   * La lega ha un'agenzia propria che non ha ancora pubblicato il palinsesto.
   * Non si ripiega sulle quote del generale: il server valuta la schedina di
   * lega con quelle dell'agenzia, quindi mostrarne altre sarebbe un inganno.
   */
  agenziaSenzaQuote: boolean;
}

/**
 * Giornata e quote del circuito in una sola lettura. Con `bookmaker` (la lega
 * ha un'agenzia assegnata) valgono solo le quote di quell'agenzia; senza,
 * quelle predefinite del circuito generale.
 */
export async function getMatchdayCircuito(
  number: number,
  bookmaker: string | null
): Promise<MatchdayCircuito | null> {
  const snap = await getDoc(doc(db, COL.matchdays, String(number)));
  if (!snap.exists()) return null;
  const dati = snap.data() as MatchdayDoc;
  const matchday = matchdayDocToMatchday(dati);
  if (bookmaker) {
    // L'agenzia predefinita e' quella delle quote generali: per lei `odds` e'
    // lo stesso palinsesto. Per le altre nessun ripiego.
    const quote =
      bookmaker === BOOKMAKER_PREDEFINITO
        ? dati.oddsPerBookmaker?.[bookmaker] ?? dati.odds
        : dati.oddsPerBookmaker?.[bookmaker];
    const vuote = !quote || Object.keys(quote).length === 0;
    return { matchday, odds: vuote ? {} : quote, agenziaSenzaQuote: vuote };
  }
  return { matchday, odds: dati.odds ?? {}, agenziaSenzaQuote: false };
}

/**
 * Giornata corrente puntata da matchdays/_meta (scritto dalle Cloud Functions).
 */
export async function getCurrentMatchdayNumber(): Promise<number | null> {
  const snap = await getDoc(doc(db, COL.matchdays, '_meta'));
  if (!snap.exists()) return null;
  return (snap.data().currentNumber as number) ?? null;
}

// ============================================
// SCHEDINA
// ============================================
export interface SchedinaDoc {
  id: string;
  userId: string;
  username: string;
  matchdayNumber: number;
  /** Circuito: assente o null = classifica generale, altrimenti la lega. */
  leagueId?: string | null;
  predictions: Prediction[];
  predictionResults: PredictionResult[] | null;
  isLocked: boolean;
  settled: boolean;
  totalPoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  finalPoints: number;
  correctPredictions: number;
  powerups?: { jolly?: string; shield?: boolean; insurance?: boolean };
  lastMinuteUsed?: boolean;
  submittedAt: Timestamp | null;
  settledAt: Timestamp | null;
  createdAt: Timestamp | null;
}

/** Stesso schema del server (functions/src/index.ts:schedinaId). */
function schedinaIdFor(
  uid: string,
  matchdayNumber: number,
  leagueId?: string | null
): string {
  return leagueId ? `${uid}_${matchdayNumber}_${leagueId}` : `${uid}_${matchdayNumber}`;
}

export async function getUserSchedinaForMatchday(
  uid: string,
  matchdayNumber: number,
  leagueId?: string | null
): Promise<SchedinaDoc | null> {
  const snap = await getDoc(
    doc(db, COL.schedine, schedinaIdFor(uid, matchdayNumber, leagueId))
  );
  return snap.exists() ? (snap.data() as SchedinaDoc) : null;
}

/**
 * Schedine valutate di un altro giocatore, solo circuito generale. Le regole
 * lasciano leggere agli altri le schedine con `settled == true` (quelle della
 * giornata in corso si leggono una a una, e solo dopo la deadline): la query
 * filtra cosi’, e ordina qui invece che con orderBy, che con due filtri
 * chiederebbe un indice composito.
 */
/**
 * Schedine gia' valutate di un giocatore, visibili a tutti (le regole le
 * aprono solo a giornata chiusa). `leagueId` null = circuito generale,
 * altrimenti quelle giocate in quella lega.
 */
export async function getPublicSchedine(uid: string, leagueId: string | null = null): Promise<SchedinaDoc[]> {
  const snap = await getDocs(
    query(
      collection(db, COL.schedine),
      where('userId', '==', uid),
      where('settled', '==', true)
    )
  );
  return snap.docs
    .map(d => d.data() as SchedinaDoc)
    .filter(s => (s.leagueId ?? null) === leagueId)
    .sort((a, b) => b.matchdayNumber - a.matchdayNumber);
}

export async function getUserSchedine(uid: string): Promise<SchedinaDoc[]> {
  const snap = await getDocs(
    query(
      collection(db, COL.schedine),
      where('userId', '==', uid),
      orderBy('matchdayNumber', 'desc')
    )
  );
  return snap.docs.map((d): SchedinaDoc => d.data() as SchedinaDoc);
}

export async function getMatchdaySchedine(matchdayNumber: number): Promise<SchedinaDoc[]> {
  const snap = await getDocs(
    query(
      collection(db, COL.schedine),
      where('matchdayNumber', '==', matchdayNumber),
      where('settled', '==', true)
    )
  );
  return snap.docs.map((d): SchedinaDoc => d.data() as SchedinaDoc);
}

export function schedinaDocToResult(d: SchedinaDoc): SchedinaResult | Schedina {
  const base: Schedina = {
    id: d.id,
    participantId: d.userId,
    matchday: d.matchdayNumber,
    leagueId: d.leagueId ?? null,
    predictions: d.predictions,
    submittedAt: d.submittedAt?.toDate() ?? new Date(),
    isLocked: d.isLocked,
    powerups: d.powerups,
    lastMinuteUsed: d.lastMinuteUsed,
  };
  if (!d.settled || !d.predictionResults) return base;
  const result: SchedinaResult = {
    ...base,
    predictions: d.predictionResults,
    totalPoints: d.totalPoints,
    correctPredictions: d.correctPredictions,
    bonusPoints: d.bonusPoints,
    penaltyPoints: d.penaltyPoints,
    finalPoints: d.finalPoints,
  };
  return result;
}

// ============================================
// WALLET / PREMI / COMMUNITY (sola lettura, scritti dalle Functions)
// ============================================
export interface WalletTransactionDoc {
  userId: string;
  amount: number;
  reason: string;
  createdAt: Timestamp | null;
}

export async function getWalletTransactions(
  uid: string,
  max = 30
): Promise<WalletTransactionDoc[]> {
  const snap = await getDocs(
    query(
      collection(db, 'wallet_transactions'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(max)
    )
  );
  return snap.docs.map(d => d.data() as WalletTransactionDoc);
}

export interface PodioEntry {
  position: number;
  userId: string;
  username: string;
  points: number;
  prize: string;
  emoji?: string | null;
}

export interface PrizeDoc {
  type: 'weekly_winner';
  matchday: number;
  winnerId: string;
  points?: number;
  /** Podio della giornata con il premio assegnato a ciascuna posizione. */
  podio?: PodioEntry[];
  createdAt: Timestamp | null;
}

export interface WeeklyPrizeItem {
  position: number;
  label: string;
  emoji?: string;
}

/**
 * Premi in palio per una giornata, decisi dall'admin. Assenti = la giornata
 * non è ancora stata configurata e valgono quelli di partenza del client.
 */
export async function getWeeklyPrizes(
  matchdayNumber: number
): Promise<WeeklyPrizeItem[] | null> {
  const snap = await getDoc(doc(db, 'weekly_prizes', String(matchdayNumber)));
  if (!snap.exists()) return null;
  const items = snap.data()?.items as WeeklyPrizeItem[] | undefined;
  return items && items.length > 0 ? items : null;
}

export async function getPrizes(): Promise<PrizeDoc[]> {
  const snap = await getDocs(
    query(collection(db, 'prizes'), orderBy('createdAt', 'desc'), limit(60))
  );
  return snap.docs.map(d => d.data() as PrizeDoc);
}

/** Ultime schedine valutate (feed community). */
export async function getRecentSettledSchedine(max = 20): Promise<SchedinaDoc[]> {
  const snap = await getDocs(
    query(
      collection(db, COL.schedine),
      where('settled', '==', true),
      orderBy('settledAt', 'desc'),
      limit(max)
    )
  );
  return snap.docs.map(d => d.data() as SchedinaDoc);
}

/** Classifica di giornata dalle schedine valutate della giornata corrente. */
export async function getWeeklyRanking(matchdayNumber: number): Promise<WeeklyRanking> {
  const [schedine, profiles] = await Promise.all([
    getMatchdaySchedine(matchdayNumber),
    getAllProfiles(),
  ]);
  const usernames = Object.fromEntries(profiles.map(p => [p.id, p.username]));
  return computeWeeklyRanking(matchdayNumber, schedine, usernames);
}

// ============================================
// RANKINGS (computed from profiles)
// ============================================
/**
 * La classifica arriva già ordinata dal server (callable `getRankings`):
 * prima ogni client scaricava tutti i profili, a pagine da 100, e ordinava in
 * locale. `computeRankings` resta lato client per i test e per le classifiche
 * calcolate in locale (giornata, lega), ed è confrontata con la copia server
 * da `rankingsMirror.test.ts`.
 */
export async function getRankings(leagueId?: string): Promise<RankingEntry[]> {
  const { rankings } = await getRankingsFn(leagueId);
  return rankings;
}

// Util to read raw query snapshots (debug/admin)
export type FirestoreDoc = QueryDocumentSnapshot<DocumentData>;
