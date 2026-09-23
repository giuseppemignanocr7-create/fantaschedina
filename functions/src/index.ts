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
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { RAFFLE, bigliettiAcquistabili, estraiVincitore } from './raffle';
import {
  TETTI,
  categoriaAttiva,
  inOreDiSilenzio,
  oraDiRoma,
  testoCambio,
  testoEsiti,
  testoGiornata,
  testoGiro,
  type Categoria,
  type CambioPartita,
  type EsitoPartita,
  type PrefNotifiche,
} from './notify';
import {
  getFirestore,
  Timestamp,
  DocumentReference,
  FieldValue,
  Transaction,
} from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { randomInt } from 'node:crypto';
import { secureIndex, securePick, secureShuffle } from './random';

import {
  COINS, MISSIONS, POWERUPS, PowerUpSelection,
  DEFAULT_WEEKLY_PRIZES, MAX_WEEKLY_PRIZES, type WeeklyPrize,
  COMPETITIONS, DEFAULT_ACTIVE_COMPETITIONS, MAX_PICKS_PER_SCHEDINA,
} from './config';
import { ALL_QUIZ_QUESTIONS } from './quizData';
import {
  evaluateBet,
  evaluateSchedina,
  MatchResult,
  Prediction,
} from './scoring';
import type { MatchOdds } from './odds';
import { computePowerupCharge, isLastMinuteWindowOpen, powerupCost } from './powerups';
import { calcolaSerie } from './streak';
import { intInRange } from './input';
import { pickWeeklyWinner, rankWeeklyCandidates } from './settlement';
import { computeRankings, type RankableProfile } from './rankings';
import { attackerForRound, canFinishAtRound, type DuelMode } from './duels';
import {
  fetchRealMatchdayOdds,
  bookmakerDisponibili,
  BOOKMAKER_PREDEFINITO,
} from './realOdds';
import { fetchActiveMatchdayPool, fetchResults } from './espn';
import {
  resolveShot,
  simulateOpponentShot,
  estimateSkillFromProfile,
  isValidZone,
  resolveDuelShot,
  botDuelShot,
  botDuelKeeper,
  zoneFromLegacyTarget,
  PENALTY_ZONES,
  type PenaltyZone,
  type DuelOutcome,
} from './penalty';

initializeApp();
const db = getFirestore();

const REGION = 'europe-west1';

// Le function v2 ricevono i secret solo se dichiarati nelle loro opzioni:
// senza `secrets: [ODDS_API_KEY]` la variabile d'ambiente resta vuota e il
// sistema ricade silenziosamente sulle quote algoritmiche.
const ODDS_API_KEY = defineSecret('ODDS_API_KEY');

// Tetto alle istanze concorrenti: contiene il costo in caso di loop o di
// picco anomalo di traffico.
const MAX_INSTANCES = 10;

/**
 * App Check: verifica che la chiamata arrivi davvero dalla nostra web app e
 * non da uno script con un token utente rubato o creato ad hoc.
 *
 * Richiede che `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` sia configurata sul
 * frontend: senza, il client non allega alcun token e ogni chiamata verrebbe
 * respinta. Sequenza di attivazione (vedi docs/runbook/app-check.md):
 *   1. configurare reCAPTCHA Enterprise e la site key su Vercel
 *   2. deployare il frontend e verificare le metriche App Check in console
 *   3. portare questa costante a `true` e ridistribuire le functions
 */
const ENFORCE_APP_CHECK = false;

/** Opzioni condivise da tutte le callable. */
const callableOpts = {
  region: REGION,
  maxInstances: MAX_INSTANCES,
  enforceAppCheck: ENFORCE_APP_CHECK,
} as const;

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
  return secureShuffle(arr);
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
  /**
   * Quote per agenzia, per le leghe che ne hanno una propria:
   * `oddsPerBookmaker['Eurobet IT'][matchId]`. `odds` resta quella
   * dell'agenzia predefinita, che vale per il circuito generale.
   */
  oddsPerBookmaker?: Record<string, Record<string, MatchOdds>>;
  settled: boolean;
  /** Notifiche gia' inviate per questa giornata (una sola volta ciascuna). */
  reminderSentAt?: Timestamp;
  kickoffNotifiedAt?: Timestamp;
  /** Claim della valutazione in corso (vedi valutaGiornata). */
  settlingAt?: Timestamp;
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
  submittedAt?: Timestamp;
  /** null = circuito generale; altrimenti la lega per cui vale la schedina. */
  leagueId?: string | null;
}

/**
 * Identificativo della schedina. Ogni utente ne ha una per il circuito
 * generale e una per ciascuna lega di cui fa parte, sulla stessa giornata.
 */
function schedinaId(uid: string, matchday: number, leagueId?: string | null): string {
  return leagueId ? `${uid}_${matchday}_${leagueId}` : `${uid}_${matchday}`;
}

/**
 * Valida il circuito richiesto: il generale è sempre ammesso, una lega solo
 * se esiste e se chi scrive ne fa parte. Restituisce l'id normalizzato.
 */
async function requireCircuito(uid: string, leagueId: unknown): Promise<string | null> {
  if (leagueId == null || leagueId === '') return null;
  if (typeof leagueId !== 'string') {
    throw new HttpsError('invalid-argument', 'Lega non valida');
  }
  const snap = await db.collection('leagues').doc(leagueId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Lega non trovata');
  const membri = (snap.data()?.memberIds as string[] | undefined) ?? [];
  if (!membri.includes(uid)) {
    throw new HttpsError('permission-denied', 'Non fai parte di questa lega');
  }
  // Una lega che ha chiesto un'agenzia propria non parte finche' non gliela
  // assegnano: senza il suo palinsesto giocherebbe su quote che non sono
  // quelle promesse a chi l'ha creata.
  if (snap.data()?.stato === 'in_attesa') {
    throw new HttpsError('failed-precondition', 'Lega in attesa di attivazione');
  }
  return leagueId;
}

/**
 * Accredita/addebita gettoni in transaction + audit trail.
 *
 * `countsAsEarned` distingue un guadagno da una restituzione: solo i guadagni
 * alimentano `coinsEarned`, che è una statistica di gioco (e il progresso
 * della missione coins_1000), non il saldo.
 */
async function adjustCoins(
  uid: string,
  amount: number,
  reason: string,
  tx?: Transaction,
  countsAsEarned = true
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
    ...(amount > 0 && countsAsEarned
      ? { coinsEarned: FieldValue.increment(amount) }
      : {}),
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

/**
 * Rate limiting per-callable usando Firestore come store.
 * Transazionale: un check-then-act non atomico permetterebbe a chiamate
 * parallele (stesso uid/azione) di leggere tutte lo stesso conteggio
 * pre-incremento e superare il limite prima che nessun incremento sia
 * ancora committato. La transazione fa sì che Firestore riprovi
 * automaticamente se un'altra chiamata concorrente scrive lo stesso
 * documento nel frattempo, così il conteggio riletto è sempre aggiornato.
 */
async function enforceRateLimit(
  uid: string,
  action: string,
  maxCalls: number,
  windowMs: number
): Promise<void> {
  const ref = db.collection('rate_limits').doc(`${uid}_${action}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const now = Date.now();
    if (data && data.expiresAt?.toMillis() > now) {
      const count = (data.count ?? 0) as number;
      if (count >= maxCalls) {
        throw new HttpsError(
          'resource-exhausted',
          'Troppe richieste. Riprova tra poco.'
        );
      }
      tx.update(ref, {
        count: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(ref, {
        count: 1,
        expiresAt: Timestamp.fromMillis(now + windowMs),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });
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
    // Nuova giornata: max esistente + 1. Con il database vuoto (inizio
    // stagione, dopo l'azzeramento) si parte da 1: la stima "settimane
    // dall'inizio stagione" usava la seasonStart nominale di ESPN (es.
    // 5 giugno per la Serie A) e battezzava la prima giornata come 12.
    const all = await db
      .collection('matchdays')
      .orderBy('number', 'desc')
      .limit(1)
      .get();
    number = all.empty ? 1 : (all.docs[0].data() as MatchdayDoc).number + 1;
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

  // Le partite già pubblicate non si rimuovono mai (i pronostici già fatti le
  // referenziano), ma le partite di un campionato appena attivato dall'admin
  // vengono aggiunte al pool della giornata già aperta invece di essere ignorate.
  const prevMatches = prev?.matches ?? [];
  const prevIds = new Set(prevMatches.map(m => m.id));
  const newMatches = matches.filter(m => !prevIds.has(m.id));
  const mergedMatches = prevMatches.length ? [...prevMatches, ...newMatches] : matches;

  // Le quote non si rigenerano mai una volta pubblicate (a meno di forceOdds),
  // ma le partite nuove aggiunte al pool hanno comunque bisogno delle loro quote.
  const apiKey = ODDS_API_KEY.value();
  // Agenzie da scaricare: la predefinita piu' quelle assegnate alle leghe
  // attive. Vengono chieste in un'unica richiesta per partita, quindi due
  // agenzie non costano il doppio.
  const agenzie = await agenzieInUso(apiKey);

  // Le quote arrivano solo dal fornitore. Dove non ci sono, non ci sono: una
  // partita senza quote non entra in giornata e un mercato non quotato non si
  // gioca. Prima un motore di calcolo riempiva i buchi, e chi giocava quelle
  // partite lo faceva su numeri inventati (23/09/2026).
  let odds = (!forceOdds ? prev?.odds ?? null : null);
  let oddsPerBookmaker = (!forceOdds ? prev?.oddsPerBookmaker ?? null : null);

  const daQuotare = odds
    ? api.matches.filter(m => !prevIds.has(m.id))
    : api.matches;

  if (daQuotare.length > 0) {
    const reali = await fetchRealMatchdayOdds(daQuotare, apiKey, agenzie);
    if (!reali) {
      logger.error('syncMatchday: nessuna quota dal fornitore, giornata non aggiornata', {
        partite: daQuotare.length,
        agenzie,
      });
      // Meglio una giornata ferma che una giornata con quote inventate: si
      // tiene quello che c'era e si riprova al giro successivo.
      if (!odds) return prev ?? null;
    } else {
      const predefinite = reali[BOOKMAKER_PREDEFINITO] ?? {};
      odds = { ...(odds ?? {}), ...predefinite };
      const unione: Record<string, Record<string, MatchOdds>> = { ...(oddsPerBookmaker ?? {}) };
      for (const agenzia of agenzie) {
        unione[agenzia] = { ...(unione[agenzia] ?? {}), ...(reali[agenzia] ?? {}) };
      }
      oddsPerBookmaker = unione;
    }
  }

  // Un'agenzia assegnata dopo la pubblicazione non ha ancora le sue quote.
  const senzaQuote = agenzie.filter(a => !(oddsPerBookmaker ?? {})[a]);
  if (senzaQuote.length > 0) {
    const reali = await fetchRealMatchdayOdds(api.matches, apiKey, senzaQuote);
    if (reali) {
      const base: Record<string, Record<string, MatchOdds>> = { ...(oddsPerBookmaker ?? {}) };
      for (const agenzia of senzaQuote) base[agenzia] = reali[agenzia] ?? {};
      oddsPerBookmaker = base;
    }
  }

  // In giornata entrano solo le partite quotate dall'agenzia predefinita: sono
  // quelle che il circuito generale puo' giocare davvero.
  const quotate = odds ?? {};
  const scartate = mergedMatches.filter(m => !quotate[m.id]);
  const matchesGiocabili = mergedMatches.filter(m => !!quotate[m.id]);
  if (scartate.length > 0) {
    logger.warn('syncMatchday: partite senza quote, escluse dalla giornata', {
      quante: scartate.length,
      partite: scartate.map(m => `${m.homeTeam.name}-${m.awayTeam.name}`),
    });
  }
  if (matchesGiocabili.length === 0) {
    logger.error('syncMatchday: nessuna partita quotata, giornata non aggiornata');
    return prev ?? null;
  }

  const docData: MatchdayDoc = {
    number,
    season: api.season,
    status: prev?.status ?? 'open',
    deadline: prev?.deadline ?? Timestamp.fromDate(api.deadline),
    matches: matchesGiocabili,
    odds: quotate,
    ...(oddsPerBookmaker ? { oddsPerBookmaker } : {}),
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

/**
 * Agenzie di cui servono le quote: la predefinita piu' quelle assegnate alle
 * leghe attive, tenute solo se il piano le consente davvero (il fornitore
 * rifiuta la richiesta se si sfora, e si perderebbero tutte le quote).
 */
async function agenzieInUso(apiKey: string): Promise<string[]> {
  const consentite = await bookmakerDisponibili(apiKey);
  const leghe = await db.collection('leagues').where('bookmaker', '!=', null).get();
  const richieste = leghe.docs
    .map(d => d.data()?.bookmaker as string | undefined)
    .filter((b): b is string => !!b);
  const volute = [...new Set([BOOKMAKER_PREDEFINITO, ...richieste])];
  const ammesse = volute.filter(b => consentite.includes(b));
  const scartate = volute.filter(b => !consentite.includes(b));
  if (scartate.length > 0) {
    logger.warn('agenzie non disponibili sul piano, ignorate', { scartate, consentite });
  }
  return ammesse.length > 0 ? ammesse : [BOOKMAKER_PREDEFINITO];
}

// ---------- Notifiche push ----------
//
// I token stanno in push_tokens/{token} = { uid }. Un utente puo' averne
// piu' d'uno (telefono e pc). I token scaduti li segnala FCM alla prima
// consegna fallita e vengono cancellati qui, cosi' la lista non cresce
// all'infinito.

const APP_URL = 'https://fantaschedina.vercel.app';

interface MessaggioPush {
  title: string;
  body: string;
  /** Percorso nell'app, es. '/pronostici'. */
  path: string;
  /** Stesso tag = la notifica nuova sostituisce la vecchia. */
  tag?: string;
}

/** Token di tutti gli utenti (uids = null) o solo di quelli indicati. */
async function caricaTokenPush(uids: string[] | null): Promise<Map<string, string[]>> {
  const perUtente = new Map<string, string[]>();
  const aggiungi = (snap: FirebaseFirestore.QuerySnapshot) =>
    snap.forEach(d => {
      const uid = d.data().uid as string;
      perUtente.set(uid, [...(perUtente.get(uid) ?? []), d.id]);
    });
  if (uids === null) {
    aggiungi(await db.collection('push_tokens').get());
    return perUtente;
  }
  for (let i = 0; i < uids.length; i += 30) {
    aggiungi(await db.collection('push_tokens').where('uid', 'in', uids.slice(i, i + 30)).get());
  }
  return perUtente;
}

/** Invia lo stesso messaggio a una lista di token. Ritorna quanti consegnati. */
async function inviaPush(tokens: string[], msg: MessaggioPush): Promise<number> {
  if (tokens.length === 0) return 0;
  const url = `${APP_URL}${msg.path}`;
  let consegnati = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const lotto = tokens.slice(i, i + 500);
    try {
      const res = await getMessaging().sendEachForMulticast({
        tokens: lotto,
        notification: { title: msg.title, body: msg.body },
        data: { url, ...(msg.tag ? { tag: msg.tag } : {}) },
        webpush: {
          fcmOptions: { link: url },
          notification: { icon: `${APP_URL}/pwa-192x192.png`, badge: `${APP_URL}/pwa-64x64.png` },
          headers: { TTL: '3600', Urgency: 'high' },
        },
      });
      res.responses.forEach((r, j) => {
        if (r.success) {
          consegnati += 1;
          return;
        }
        const code = r.error?.code ?? '';
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/invalid-argument'
        ) {
          void db.collection('push_tokens').doc(lotto[j]).delete();
        } else {
          logger.warn('[push] invio fallito', { code });
        }
      });
    } catch (e) {
      logger.error('[push] sendEachForMulticast', e);
    }
  }
  return consegnati;
}

/** Uid di tutti i profili attivi: l'audience degli avvisi "a tutti". */
async function utentiAttivi(): Promise<string[]> {
  const snap = await db.collection('profiles').where('isActive', '==', true).select().get();
  return snap.docs.map(d => d.id);
}

/**
 * Copia dell'avviso nella casella di ogni destinatario (notifications/{uid}/items):
 * la campanella la mostra anche a chi non ha le push o le ha gia' scartate.
 */
async function salvaInCasella(uids: string[], msg: MessaggioPush): Promise<void> {
  for (let i = 0; i < uids.length; i += 400) {
    const batch = db.batch();
    for (const uid of uids.slice(i, i + 400)) {
      batch.set(db.collection('notifications').doc(uid).collection('items').doc(), {
        title: msg.title,
        body: msg.body,
        path: msg.path,
        tag: msg.tag ?? null,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

/**
 * Avviso completo, con tre filtri prima di disturbare qualcuno:
 *  - le preferenze: chi ha spento una categoria non la riceve, nemmeno in casella;
 *  - le ore di silenzio (23-8): la copia in casella si scrive lo stesso, la push no;
 *  - il tetto giornaliero per categoria: oltre, resta solo in casella.
 * La casella e' il registro completo, la push e' l'interruzione: sono due
 * cose diverse e vanno dosate diversamente.
 */
async function notifica(uids: string[], msg: MessaggioPush, cat: Categoria): Promise<number> {
  const unici = [...new Set(uids)];
  if (unici.length === 0) return 0;
  const oggi = romeDateString();
  const silenzio = inOreDiSilenzio(oraDiRoma(new Date()));

  const ammessi: string[] = [];
  const daPushare: { uid: string; usate: number; stesso: boolean }[] = [];
  for (let i = 0; i < unici.length; i += 300) {
    const refs = unici.slice(i, i + 300).map(u => db.collection('profiles').doc(u));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      if (!s.exists) continue;
      const d = s.data() ?? {};
      if (!categoriaAttiva(d.notifPrefs as PrefNotifiche | undefined, cat)) continue;
      ammessi.push(s.id);
      const c = (d.notifCount ?? {}) as Record<string, unknown>;
      const stesso = c.date === oggi;
      const usate = stesso ? ((c[cat] as number) ?? 0) : 0;
      if (!silenzio && usate < TETTI[cat]) daPushare.push({ uid: s.id, usate, stesso });
    }
  }
  if (ammessi.length === 0) return 0;
  await salvaInCasella(ammessi, msg);
  if (daPushare.length === 0) return 0;

  // Contatori: se il giorno e' cambiato si riscrive la mappa da zero,
  // altrimenti si incrementa la sola categoria.
  for (let i = 0; i < daPushare.length; i += 400) {
    const batch = db.batch();
    for (const { uid, stesso } of daPushare.slice(i, i + 400)) {
      const ref = db.collection('profiles').doc(uid);
      if (stesso) batch.update(ref, { [`notifCount.${cat}`]: FieldValue.increment(1) });
      else batch.update(ref, { notifCount: { date: oggi, [cat]: 1 } });
    }
    await batch.commit();
  }

  const tokenPer = await caricaTokenPush(daPushare.map(d => d.uid));
  return inviaPush([...tokenPer.values()].flat(), msg);
}

function oraRoma(t: Timestamp): string {
  return t.toDate().toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Rome',
  });
}

// ---------- 2c. PROMEMORIA SCADENZA (ogni 30 min) ----------
//
// Fra 2 h 30 e 30 min prima della chiusura, una sola volta per giornata,
// a chi ha attivato le notifiche e non ha ancora giocato la schedina
// generale. La finestra e' larga apposta: la function gira ogni 30 minuti
// e non deve mancare l'appuntamento se un giro salta.

export const remindSchedina = onSchedule(
  { schedule: 'every 30 minutes', region: REGION, timeZone: 'Europe/Rome', maxInstances: 1 },
  async () => {
    const md = await getCurrentMatchday();
    if (!md || md.settled || md.status !== 'open' || md.reminderSentAt) return;
    const mancano = md.deadline.toMillis() - Date.now();
    if (mancano <= 30 * 60 * 1000 || mancano > 150 * 60 * 1000) return;

    const giocate = await db
      .collection('schedine')
      .where('matchdayNumber', '==', md.number)
      .select('userId', 'leagueId')
      .get();
    const haGiocato = new Set<string>();
    giocate.forEach(d => {
      const x = d.data();
      if (x.leagueId == null) haGiocato.add(x.userId as string);
    });

    const destinatari = (await utentiAttivi()).filter(uid => !haGiocato.has(uid));

    // Segna prima di inviare: se l'invio va lungo e il giro dopo riparte,
    // non si manda due volte.
    await db.collection('matchdays').doc(String(md.number)).update({
      reminderSentAt: FieldValue.serverTimestamp(),
    });
    const n = await notifica(destinatari, {
      title: `⏰ La schedina chiude alle ${oraRoma(md.deadline)}`,
      body: `Giornata ${md.number}: non hai ancora giocato. Bastano due minuti.`,
      path: '/pronostici',
      tag: `reminder-${md.number}`,
    }, 'schedina');
    logger.info(`Giornata ${md.number}: promemoria scadenza a ${n} dispositivi`);
  }
);

// ---------- 2d. GIRO QUOTIDIANO (ogni giorno alle 18:00) ----------
//
// Quiz e ruota sono gratis una volta al giorno: sono il motivo per aprire
// l'app anche quando non si gioca la schedina. A chi ha le notifiche e non
// ha ancora fatto il giro di oggi, un promemoria nell'ora in cui si ha
// tempo. Un solo invio al giorno per dispositivo; il tag sostituisce quello
// del giorno prima se e' rimasto nel centro notifiche.

/**
 * Promemoria del giro gratis, due volte al giorno. Non e' lo stesso avviso
 * ripetuto: la mattina invita, la sera ricorda quello che manca ancora, e a
 * chi ha gia' fatto tutto non arriva niente.
 */
async function promemoriaGiro(momento: 'mattina' | 'sera'): Promise<void> {
  const oggi = romeDateString();
  const snaps = await db.collection('profiles').where('isActive', '==', true).select('lastPlayed').get();
  const massimo = COINS.quizMaxQuestions * COINS.quizPerCorrect + Math.max(...COINS.wheelPrizes);

  let inviati = 0;
  for (const snap of snaps.docs) {
    const last = (snap.data()?.lastPlayed ?? {}) as Record<string, string | undefined>;
    const mancanti = { quiz: last.quiz !== oggi, ruota: last.ruota !== oggi };
    const testo = testoGiro(momento, mancanti, massimo, `${snap.id}-${oggi}-${momento}`);
    if (!testo) continue;
    inviati += await notifica(
      [snap.id],
      { ...testo, path: '/minigiochi', tag: `giro-${oggi}` },
      'giro'
    );
  }
  logger.info(`Giro ${momento}: promemoria a ${inviati} dispositivi`);
}

export const remindMinigiochiMattina = onSchedule(
  { schedule: '45 10 * * *', region: REGION, timeZone: 'Europe/Rome', maxInstances: 1 },
  () => promemoriaGiro('mattina')
);

export const remindMinigiochiSera = onSchedule(
  { schedule: '45 17 * * *', region: REGION, timeZone: 'Europe/Rome', maxInstances: 1 },
  () => promemoriaGiro('sera')
);

/** Posizione di ogni utente attivo in classifica generale, dal punteggio. */
async function posizioniInClassifica(): Promise<Map<string, number>> {
  const snap = await db
    .collection('profiles')
    .where('isActive', '==', true)
    .orderBy('totalPoints', 'desc')
    .get();
  const out = new Map<string, number>();
  snap.docs.forEach((d, i) => out.set(d.id, i + 1));
  return out;
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
  {
    schedule: 'every 6 hours',
    region: REGION,
    timeZone: 'Europe/Rome',
    secrets: [ODDS_API_KEY],
    maxInstances: 1,
  },
  async () => {
    const md = await syncMatchdayInternal();
    logger.info(md ? `Giornata ${md.number} sincronizzata` : 'Nessuna giornata trovata');
  }
);

// ---------- 2. SETTLEMENT AUTOMATICO (scheduled ogni ora) ----------

export const settleMatchdays = onSchedule(
  { schedule: 'every 60 minutes', region: REGION, timeZone: 'Europe/Rome', maxInstances: 1 },
  async () => {
    const pending = await db
      .collection('matchdays')
      .where('settled', '==', false)
      .get();

    for (const mdSnap of pending.docs) {
      if (mdSnap.id === '_meta') continue;
      await valutaGiornata(mdSnap.ref);
    }
  }
);

/**
 * Valuta una giornata se e' pronta: risultati definitivi da ESPN, schedine,
 * classifica, estrazione, avvisi. La chiamano sia lo scheduler orario
 * (rete di sicurezza) sia updateLiveScores appena l'ultima partita si
 * chiude, cosi' l'esito arriva entro un paio di minuti dal fischio finale
 * e non al giro orario successivo. Il claim su `settlingAt` evita che i
 * due arrivino insieme.
 */
async function valutaGiornata(ref: DocumentReference): Promise<void> {
  const now = Timestamp.now();
  const mdSnap = await ref.get();
  if (!mdSnap.exists) return;
  const md = mdSnap.data() as MatchdayDoc;
  if (md.settled) return;
  if (md.deadline.toMillis() > now.toMillis()) return;

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

  await ref.update({
    matches: updatedMatches,
    status: 'locked',
    updatedAt: FieldValue.serverTimestamp(),
  });

  const allFinished = updatedMatches.every(m => m.status === 'finished' && m.result);
  if (!allFinished) {
    logger.info(`Giornata ${md.number}: partite non concluse, skip settlement`);
    return;
  }

  // Posizioni prima della valutazione: servono a dire "sei salito di
  // due posti", che e' l'informazione che si guarda davvero.
  // Un solo valutatore alla volta: live e scheduler possono arrivare insieme.
  const preso = await db.runTransaction(async tx => {
    const fresh = (await tx.get(ref)).data() as MatchdayDoc;
    if (fresh.settled) return false;
    if (fresh.settlingAt && now.toMillis() - fresh.settlingAt.toMillis() < 10 * 60 * 1000) return false;
    tx.update(ref, { settlingAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!preso) return;

  const posizioniPrima = await posizioniInClassifica();
  const valutate = await settleSchedine(md.number, updatedMatches);
  await db.runTransaction(async tx => {
    const fresh = await tx.get(ref);
    if ((fresh.data() as MatchdayDoc).settled) return;
    tx.update(ref, {
      settled: true,
      status: 'completed',
      settledAt: FieldValue.serverTimestamp(),
    });
  });
  logger.info(`Giornata ${md.number} valutata: ${valutate} schedine`);

  try {
    await estraiPremioGiornata(md.number);
  } catch (e) {
    logger.error('[raffle] estrazione', e);
  }

  // Ognuno riceve i propri punti e la posizione raggiunta.
  try {
    const generali = await db
      .collection('schedine')
      .where('matchdayNumber', '==', md.number)
      .select('userId', 'leagueId', 'finalPoints')
      .get();
    const punti = new Map<string, number>();
    generali.forEach(d => {
      const x = d.data();
      if (x.leagueId == null) punti.set(x.userId as string, (x.finalPoints as number) ?? 0);
    });
    const posizioni = await posizioniInClassifica();
    let inviati = 0;
    for (const [uid, p] of punti) {
      const pos = posizioni.get(uid) ?? null;
      const prima = posizioniPrima.get(uid);
      const variazione = pos != null && prima != null ? prima - pos : null;
      const testo = testoGiornata(md.number, p, pos, variazione, `${uid}-${md.number}`);
      inviati += await notifica(
        [uid],
        { ...testo, path: '/classifica', tag: `settled-${md.number}` },
        'esito'
      );
    }
    logger.info(`Giornata ${md.number}: esito inviato a ${inviati} dispositivi`);
  } catch (e) {
    logger.error('[push] esito giornata', e);
  }
}

// ---------- 2b. PUNTEGGI LIVE (scheduled ogni 2 min, solo in finestra partite) ----------

export const updateLiveScores = onSchedule(
  { schedule: 'every 2 minutes', region: REGION, timeZone: 'Europe/Rome', maxInstances: 1 },
  async () => {
    const md = await getCurrentMatchday();
    if (!md || md.settled) return;

    // Finestra live: da 5 min prima del fischio a 4h dopo ogni partita.
    // Fuori dalle finestre usciamo subito senza chiamare ESPN (costo ~0).
    const now = Date.now();
    const allFinished = md.matches.every(m => m.status === 'finished');
    if (allFinished) {
      // Partite tutte chiuse ma giornata non ancora valutata: si prova a ogni
      // giro, finche' non e' fatta. Prima l'aggancio scattava solo se questo
      // ciclo assisteva in diretta all'ultimo cambio: bastava un deploy o un
      // giro perso e l'esito slittava allo scheduler orario (14/09/2026,
      // giornata 3 valutata a mano alle 23:45).
      try {
        await valutaGiornata(db.collection('matchdays').doc(String(md.number)));
      } catch (e) {
        logger.error('[settlement] avvio dal live (partite chiuse)', e);
      }
      return;
    }
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
    let primoFischio: StoredMatch | null = null;
    // Partite appena chiuse e pronostici ribaltati da un gol: sono le due
    // cose che vale la pena raccontare mentre si gioca.
    const appenaFinite: { match: StoredMatch; result: MatchResult }[] = [];
    const esitoCambiato: { match: StoredMatch; prima: MatchResult; dopo: MatchResult }[] = [];
    const updatedMatches = md.matches.map(m => {
      const r = results.get(m.id);
      if (!r || r.status === 'scheduled') return m;
      if (m.status === 'scheduled' && r.status === 'live' && !primoFischio) primoFischio = m;
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
      if (r.status === 'finished' && m.status !== 'finished') {
        appenaFinite.push({ match: m, result });
      } else if (r.status === 'live' && prev && prev.outcome !== result.outcome) {
        esitoCambiato.push({ match: m, prima: prev, dopo: result });
      }
      return { ...m, status: r.status, result };
    });

    if (!changed) return;
    const avvisaKickoff = primoFischio !== null && !md.kickoffNotifiedAt;
    await db.collection('matchdays').doc(String(md.number)).update({
      matches: updatedMatches,
      updatedAt: FieldValue.serverTimestamp(),
      ...(avvisaKickoff ? { kickoffNotifiedAt: FieldValue.serverTimestamp() } : {}),
    });
    logger.info(`Giornata ${md.number}: punteggi live aggiornati`);

    // Ultima partita chiusa: la valutazione parte adesso, non al giro orario.
    const tutteChiuse = updatedMatches.every(m => m.status === 'finished');

    if (avvisaKickoff && primoFischio) {
      const pm = primoFischio as StoredMatch;
      try {
        const n = await notifica(await utentiAttivi(), {
          title: `⚽ Si gioca: ${pm.homeTeam?.shortName ?? pm.homeTeam?.name ?? ''} – ${pm.awayTeam?.shortName ?? pm.awayTeam?.name ?? ''}`,
          body: `Giornata ${md.number} iniziata. Segui i tuoi pronostici in diretta.`,
          path: '/live',
          tag: `kickoff-${md.number}`,
        }, 'live');
        logger.info(`Giornata ${md.number}: calcio d'inizio a ${n} dispositivi`);
      } catch (e) {
        logger.error('[push] calcio d\'inizio', e);
      }
    }

    if (appenaFinite.length > 0 || esitoCambiato.length > 0) {
      try {
        await avvisaPronostici(md.number, appenaFinite, esitoCambiato);
      } catch (e) {
        logger.error('[push] esiti live', e);
      }
    }

    if (tutteChiuse) {
      try {
        await valutaGiornata(db.collection('matchdays').doc(String(md.number)));
      } catch (e) {
        logger.error('[settlement] avvio dal live', e);
      }
    }
  }
);

/** Sigla leggibile di una partita, es. "FIO-TOR". */
function siglaPartita(m: StoredMatch): string {
  return `${m.homeTeam?.shortName ?? m.homeTeam?.name ?? '?'}-${m.awayTeam?.shortName ?? m.awayTeam?.name ?? '?'}`;
}

/**
 * Avvisa chi ha pronosticato le partite che si sono appena chiuse o che un
 * gol ha ribaltato. Una sola notifica per utente per giro: se tre partite
 * finiscono insieme, si raccontano insieme. Solo la schedina del circuito
 * generale, altrimenti chi gioca anche nelle leghe verrebbe avvisato
 * piu' volte per la stessa partita.
 */
async function avvisaPronostici(
  matchday: number,
  finite: { match: StoredMatch; result: MatchResult }[],
  cambi: { match: StoredMatch; prima: MatchResult; dopo: MatchResult }[]
): Promise<void> {
  const coinvolte = new Set([...finite, ...cambi].map(x => x.match.id));
  const snap = await db
    .collection('schedine')
    .where('matchdayNumber', '==', matchday)
    .select('userId', 'leagueId', 'predictions')
    .get();

  const perUtente = new Map<string, { esiti: EsitoPartita[]; cambi: CambioPartita[] }>();
  snap.forEach(d => {
    const x = d.data();
    if (x.leagueId != null) return;
    const uid = x.userId as string;
    const predictions = (x.predictions ?? []) as Prediction[];
    for (const p of predictions) {
      if (!coinvolte.has(p.matchId)) continue;
      const acc = perUtente.get(uid) ?? { esiti: [], cambi: [] };

      const f = finite.find(y => y.match.id === p.matchId);
      if (f) {
        const ok = evaluateBet(p.betType, p.outcome, f.result);
        if (ok !== null) {
          acc.esiti.push({
            label: siglaPartita(f.match),
            score: `${f.result.homeGoals}-${f.result.awayGoals}`,
            corretto: ok,
          });
        }
      }

      const c = cambi.find(y => y.match.id === p.matchId);
      if (c) {
        const prima = evaluateBet(p.betType, p.outcome, c.prima);
        const dopo = evaluateBet(p.betType, p.outcome, c.dopo);
        // Solo un vero ribaltamento: un gol che non cambia l'esito del
        // pronostico non merita di far vibrare il telefono.
        if (prima !== null && dopo !== null && prima !== dopo) {
          acc.cambi.push({
            label: siglaPartita(c.match),
            score: `${c.dopo.homeGoals}-${c.dopo.awayGoals}`,
            oraCorretto: dopo,
          });
        }
      }
      perUtente.set(uid, acc);
    }
  });

  let inviati = 0;
  for (const [uid, acc] of perUtente) {
    const seme = `${uid}-${matchday}-${Date.now()}`;
    // Una partita chiusa e' una notizia definitiva: viene prima di un
    // ribaltamento, che puo' ancora cambiare.
    const testo = testoEsiti(acc.esiti, seme) ?? testoCambio(acc.cambi, seme);
    if (!testo) continue;
    inviati += await notifica([uid], { ...testo, path: '/live' }, 'live');
  }
  logger.info(`Giornata ${matchday}: esiti live a ${inviati} dispositivi`);
}

/** Valuta le schedine della giornata. Restituisce quante ne ha valutate. */
/** Premi definiti dall'admin per la giornata, o quelli di partenza. */
async function leggiPremiSettimanali(matchdayNumber: number): Promise<WeeklyPrize[]> {
  const snap = await db.collection('weekly_prizes').doc(String(matchdayNumber)).get();
  const items = snap.exists ? (snap.data()?.items as WeeklyPrize[] | undefined) : undefined;
  return items && items.length > 0 ? items : DEFAULT_WEEKLY_PRIZES;
}

async function settleSchedine(
  matchdayNumber: number,
  matches: StoredMatch[]
): Promise<number> {
  const resultsMap = new Map<string, MatchResult>();
  for (const m of matches) {
    if (m.result) resultsMap.set(m.id, m.result);
  }

  const schedineSnap = await db
    .collection('schedine')
    .where('matchdayNumber', '==', matchdayNumber)
    .get();

  interface UserOutcome {
    finalPoints: number;
    correct: number;
    bonus: number;
    penalty: number;
    perfect: boolean;
    coins: number;
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

    const outcome: UserOutcome = {
      finalPoints: score.finalPoints,
      correct: score.correctPredictions,
      bonus: score.bonusPoints,
      penalty: score.penaltyPoints,
      perfect: score.correctPredictions >= 10,
      coins,
    };

    return { sSnap, schedina, score, outcome };
  });

  // Due circuiti separati sulla stessa giornata: la schedina generale muove
  // profilo, gettoni e premio di giornata; quelle di lega restano dentro la
  // classifica della loro lega e non toccano nulla del circuito generale.
  const generali = evaluations.filter(e => !e.schedina.leagueId);
  const diLega = evaluations.filter(e => !!e.schedina.leagueId);

  // Classifica di giornata del circuito generale: serve sia il vincitore (per
  // i gettoni) sia il podio completo (per i premi settimanali dell'admin).
  const classificaGiornata = rankWeeklyCandidates(
    generali.map(e => ({
      userId: e.schedina.userId,
      finalPoints: e.score.finalPoints,
      correctPredictions: e.score.correctPredictions,
      submittedAtMs: e.schedina.submittedAt?.toMillis(),
    }))
  );
  const vincitore = classificaGiornata[0] ?? null;
  const bestUserId = vincitore?.userId ?? null;
  const bestPoints = vincitore?.finalPoints ?? 0;

  // Vincitore di giornata di ciascuna lega: stesso criterio, nessun gettone.
  const vincitoriLega = new Map<string, string>();
  for (const leagueId of new Set(diLega.map(e => e.schedina.leagueId as string))) {
    const migliore = pickWeeklyWinner(
      diLega
        .filter(e => e.schedina.leagueId === leagueId)
        .map(e => ({
          userId: e.schedina.userId,
          finalPoints: e.score.finalPoints,
          correctPredictions: e.score.correctPredictions,
          submittedAtMs: e.schedina.submittedAt?.toMillis(),
        }))
    );
    if (migliore) vincitoriLega.set(leagueId, migliore.userId);
  }

  // Una schedina che non si riesce a valutare non deve fermare le altre.
  // Prima un singolo profilo mancante faceva esplodere l’intera funzione: le
  // schedine successive restavano senza punti e, siccome le leghe vengono
  // dopo, NESSUNA classifica di lega veniva aggiornata. Un utente cancellato
  // bastava a bloccare il circuito delle leghe per tutti.
  const nonValutate: { schedinaId: string; motivo: string }[] = [];

  // Aggiorna profili in transaction (uno per utente)
  for (const { sSnap, schedina, score, outcome } of generali) {
    try {
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
    } catch (e) {
      nonValutate.push({ schedinaId: sSnap.id, motivo: (e as Error).message });
      logger.error('settlement: schedina generale non valutata', {
        schedinaId: sSnap.id,
        userId: schedina.userId,
        motivo: (e as Error).message,
      });
    }
  }

  // Schedine di lega: i punti restano nella classifica della lega. Niente
  // gettoni, niente statistiche di profilo, niente missioni: il circuito
  // generale è l'unica strada per i gettoni.
  for (const { sSnap, schedina, score } of diLega) {
    const leagueId = schedina.leagueId as string;
    try {
      await db.runTransaction(async tx => {
      const freshSchedina = await tx.get(sSnap.ref);
      if (!freshSchedina.exists || (freshSchedina.data() as SchedinaDoc).settled) return;

      const standingRef = db
        .collection('leagues')
        .doc(leagueId)
        .collection('standings')
        .doc(schedina.userId);
      const standing = await tx.get(standingRef);
      const precedenti = (standing.data() ?? {}) as Record<string, number>;
      const isVincitoreLega = vincitoriLega.get(leagueId) === schedina.userId;

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

      tx.set(
        standingRef,
        {
          userId: schedina.userId,
          username: schedina.username,
          totalPoints: FieldValue.increment(score.finalPoints),
          weeklyPoints: score.finalPoints,
          matchdaysPlayed: FieldValue.increment(1),
          correctPredictions: FieldValue.increment(score.correctPredictions),
          perfectSchedine: FieldValue.increment(score.correctPredictions >= 10 ? 1 : 0),
          bonusPointsTotal: FieldValue.increment(score.bonusPoints),
          penaltyPointsTotal: FieldValue.increment(score.penaltyPoints),
          bestMatchdayPoints: Math.max(precedenti.bestMatchdayPoints ?? 0, score.finalPoints),
          weeklyWins: FieldValue.increment(isVincitoreLega ? 1 : 0),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      });
    } catch (e) {
      nonValutate.push({ schedinaId: sSnap.id, motivo: (e as Error).message });
      logger.error('settlement: schedina di lega non valutata', {
        schedinaId: sSnap.id,
        userId: schedina.userId,
        leagueId,
        motivo: (e as Error).message,
      });
    }
  }

  if (nonValutate.length > 0) {
    logger.error('settlement: alcune schedine non sono state valutate', {
      matchdayNumber,
      quante: nonValutate.length,
      schedine: nonValutate.slice(0, 20),
    });
  }

  const participantIds = new Set(generali.map(e => e.schedina.userId));
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
      // Un batch invece di N update paralleli: stessa scrittura in una sola
      // richiesta, e nessun rischio di aprire centinaia di connessioni quando
      // gli iscritti cresceranno.
      const writeBatch = db.batch();
      for (const p of toReset) {
        writeBatch.update(p.ref, {
          weeklyPoints: 0,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await writeBatch.commit();
    }
    lastDocId = batch.docs[batch.docs.length - 1].id;
    if (batch.docs.length < batchSize) break;
  }

  // Storico premi: chi ha vinto la giornata e cosa si porta a casa. I premi
  // sono definiti dall'admin giornata per giornata (adminManageWeeklyPrizes);
  // se non li ha ancora scelti valgono quelli di partenza.
  const prizes = db.collection('prizes');
  if (bestUserId) {
    const premi = await leggiPremiSettimanali(matchdayNumber);
    const nomiPerUid = new Map(generali.map(e => [e.schedina.userId, e.schedina.username]));
    const podio = premi
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(premio => {
        const riga = classificaGiornata[premio.position - 1];
        if (!riga) return null;
        return {
          position: premio.position,
          userId: riga.userId,
          username: nomiPerUid.get(riga.userId) ?? 'player',
          points: riga.finalPoints,
          prize: premio.label,
          emoji: premio.emoji ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    await prizes.doc(`weekly_${matchdayNumber}`).set({
      type: 'weekly_winner',
      matchday: matchdayNumber,
      winnerId: bestUserId,
      points: bestPoints,
      podio,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return evaluations.length;
}

/**
 * Quote valide per un circuito: quelle dell'agenzia della lega se ne ha una
 * e se sono state scaricate, altrimenti quelle predefinite della giornata.
 */
async function quotePerCircuito(
  md: MatchdayDoc,
  leagueId: string | null
): Promise<Record<string, MatchOdds>> {
  if (!leagueId) return md.odds;
  const lega = await db.collection('leagues').doc(leagueId).get();
  const agenzia = lega.data()?.bookmaker as string | undefined;
  if (!agenzia) return md.odds;
  return md.oddsPerBookmaker?.[agenzia] ?? md.odds;
}

// ---------- 3. SUBMIT SCHEDINA (callable) ----------

export const submitSchedina = onCall(callableOpts, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  // Il tetto era 3 al minuto, pensato quando esisteva una sola schedina. Con i
  // circuiti un utente ne compila una per la generale e una per ogni lega: chi
  // sta in tre leghe veniva bloccato al quarto invio, cioè giocando normalmente.
  await enforceRateLimit(uid, 'submitSchedina', 15, 60_000);
  logger.info('submitSchedina:start', { uid });

  const predictions = request.data?.predictions as Prediction[] | undefined;
  const powerups = (request.data?.powerups ?? {}) as PowerUpSelection;
  if (!Array.isArray(predictions) || predictions.length === 0) {
    throw new HttpsError('invalid-argument', 'Pronostici mancanti');
  }

  const leagueId = await requireCircuito(uid, request.data?.leagueId);

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

  // Quote ufficiali del circuito: una lega con la sua agenzia gioca su quelle,
  // il generale su quella predefinita. Cosi' i punti vengono dalle stesse
  // quote che l'utente ha visto mentre compilava.
  const quoteCircuito = await quotePerCircuito(md, leagueId);

  // Valida e sostituisce le quote con quelle ufficiali server-side
  const matchIds = new Set(md.matches.map(m => m.id));
  const validated: Prediction[] = predictions.map(p => {
    if (!matchIds.has(p.matchId)) {
      throw new HttpsError('invalid-argument', `Partita non valida: ${p.matchId}`);
    }
    const marketOdds = (quoteCircuito[p.matchId] as unknown as Record<
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

  // Power-up richiesti: normalizzati qui, il costo lo calcola computePowerupCharge
  const cleanPowerups: PowerUpSelection = {};
  if (powerups.jolly) {
    if (!matchIds.has(powerups.jolly)) {
      throw new HttpsError('invalid-argument', 'Jolly su partita non valida');
    }
    cleanPowerups.jolly = powerups.jolly;
  }
  if (powerups.shield) cleanPowerups.shield = true;
  if (powerups.insurance) cleanPowerups.insurance = true;
  const cost = powerupCost(cleanPowerups);

  const schedinaRef = db.collection('schedine').doc(schedinaId(uid, md.number, leagueId));

  await db.runTransaction(async tx => {
    const existing = await tx.get(schedinaRef);
    if (existing.exists && (existing.data() as SchedinaDoc).settled) {
      throw new HttpsError('failed-precondition', 'Schedina già valutata');
    }

    // Rimborso dei power-up precedenti e addebito di quelli nuovi: due
    // movimenti interi e distinti. Vedi computePowerupCharge per il perché.
    const previous = existing.exists
      ? (existing.data() as SchedinaDoc).powerups
      : undefined;
    const { refund, charge, net } = computePowerupCharge(previous, cleanPowerups);

    const profileRef = db.collection('profiles').doc(uid);
    const profile = await tx.get(profileRef);
    if (!profile.exists) throw new HttpsError('not-found', 'Profilo non trovato');
    const coins = (profile.data()?.coins ?? 0) as number;
    if (-net > coins) {
      throw new HttpsError('failed-precondition', 'Gettoni insufficienti per i power-up');
    }
    if (refund > 0) {
      // Un rimborso non è un guadagno: non deve gonfiare `coinsEarned`,
      // su cui si basa la missione coins_1000.
      await adjustCoins(uid, refund, `powerups_refund_g${md!.number}`, tx, false);
    }
    if (charge > 0) {
      await adjustCoins(uid, -charge, `powerups_g${md!.number}`, tx);
    }
    tx.set(schedinaRef, {
      id: schedinaRef.id,
      userId: uid,
      username: profile.data()?.username ?? 'player',
      matchdayNumber: md!.number,
      leagueId,
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

  logger.info('submitSchedina:ok', { uid, matchday: md.number, leagueId, coinsSpent: cost });
  return { ok: true, matchday: md.number, leagueId, coinsSpent: cost };
});

// ---------- 4. CAMBIO LAST-MINUTE (callable) ----------

/**
 * Power-up "Cambio Last-Minute" (100 gettoni).
 *
 * È l'unico modo di toccare la schedina DOPO la deadline: cambia il mercato
 * di un solo pronostico, su una partita non ancora iniziata, una volta sola
 * per schedina. Prima della deadline non serve e non si paga — lì la schedina
 * si rimanda e basta (vedi submitSchedina), quindi la chiamata viene rifiutata
 * per non far pagare una cosa gratuita.
 */
export const changePrediction = onCall(callableOpts, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await enforceRateLimit(uid, 'changePrediction', 15, 60_000);
  logger.info('changePrediction:start', { uid });

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
  const now = Timestamp.now().toMillis();
  if (now < md.deadline.toMillis()) {
    throw new HttpsError(
      'failed-precondition',
      'Prima della deadline puoi modificare la schedina gratis: il Cambio Last-Minute serve dopo'
    );
  }

  const match = md.matches.find(m => m.id === matchId);
  if (!match) throw new HttpsError('invalid-argument', `Partita non valida: ${matchId}`);
  if (
    !isLastMinuteWindowOpen({
      now,
      deadline: md.deadline.toMillis(),
      matchStatus: match.status,
      matchKickoff: match.scheduledAt.toMillis(),
    })
  ) {
    throw new HttpsError('failed-precondition', 'Partita già iniziata: pronostico congelato');
  }

  const marketOdds = (md.odds[matchId] as unknown as Record<
    string,
    Record<string, number>
  >)?.[betType];
  const officialOdds = marketOdds?.[outcome];
  if (officialOdds == null) {
    throw new HttpsError('invalid-argument', 'Mercato non valido');
  }

  const leagueId = await requireCircuito(uid, request.data?.leagueId);
  const cost = POWERUPS.lastminute.cost;
  const schedinaRef = db.collection('schedine').doc(schedinaId(uid, md.number, leagueId));
  await db.runTransaction(async tx => {
    const snap = await tx.get(schedinaRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Nessuna schedina inviata');
    const s = snap.data() as SchedinaDoc;
    if (s.settled) throw new HttpsError('failed-precondition', 'Schedina già valutata');
    if (s.lastMinuteUsed === true) {
      throw new HttpsError(
        'failed-precondition',
        'Cambio Last-Minute già usato per questa giornata'
      );
    }
    const idx = s.predictions.findIndex(p => p.matchId === matchId);
    if (idx === -1) throw new HttpsError('invalid-argument', 'Pronostico non trovato');

    const profileRef = db.collection('profiles').doc(uid);
    const profile = await tx.get(profileRef);
    if (!profile.exists) throw new HttpsError('not-found', 'Profilo non trovato');
    const coins = (profile.data()?.coins ?? 0) as number;
    if (coins < cost) {
      throw new HttpsError(
        'failed-precondition',
        `Gettoni insufficienti: servono ${cost} gettoni`
      );
    }

    const updated = [...s.predictions];
    updated[idx] = { matchId, betType, outcome, odds: officialOdds };
    tx.update(schedinaRef, { predictions: updated, lastMinuteUsed: true });
    await adjustCoins(uid, -cost, `powerup_lastminute_g${md.number}`, tx);
  });

  logger.info('changePrediction:ok', { uid, matchId, coinsSpent: cost });
  return { ok: true, coinsSpent: cost };
});

// ---------- 4b. ANNULLA SCHEDINA (callable) ----------

export const cancelSchedina = onCall(callableOpts, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await enforceRateLimit(uid, 'cancelSchedina', 15, 60_000);
  logger.info('cancelSchedina:start', { uid });

  const md = await getCurrentMatchday();
  if (!md) throw new HttpsError('unavailable', 'Nessuna giornata disponibile');
  if (Timestamp.now().toMillis() >= md.deadline.toMillis()) {
    throw new HttpsError('failed-precondition', 'Deadline superata, non puoi annullare la schedina');
  }

  const leagueId = await requireCircuito(uid, request.data?.leagueId);
  const schedinaRef = db.collection('schedine').doc(schedinaId(uid, md.number, leagueId));

  await db.runTransaction(async tx => {
    const snap = await tx.get(schedinaRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Nessuna schedina da annullare');
    }
    const s = snap.data() as SchedinaDoc;
    if (s.settled) {
      throw new HttpsError('failed-precondition', 'Schedina già valutata, non può essere annullata');
    }

    // Rimborsa i power-up (restituzione, non guadagno: vedi adjustCoins)
    const refund = powerupCost(s.powerups);
    if (refund > 0) {
      await adjustCoins(uid, refund, `powerups_refund_cancel_g${md.number}`, tx, false);
    }

    tx.delete(schedinaRef);
  });

  logger.info('cancelSchedina:ok', { uid, matchday: md.number });
  return { ok: true, refund: true };
});

// ---------- 5. MINIGIOCHI (callable) ----------

// --- Seed/update quiz questions into Firestore (admin callable) ---
export const seedQuizQuestions = onCall(callableOpts, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await requireAdmin(uid);

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

export const playMinigame = onCall(callableOpts, async (request): Promise<Record<string, unknown>> => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');

  const action = request.data?.action as string;
  // Bucket per singola azione (non condiviso tra quiz/ruota/rigori/memoria/sfide):
  // altrimenti giocare a più minigiochi diversi nella stessa sessione esaurisce
  // in fretta un budget pensato per una sola azione ripetuta.
  await enforceRateLimit(uid, `playMinigame_${action}`, 10, 60_000);
  logger.info('playMinigame', { uid, action });
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

  /**
   * Segna che l'utente ha giocato oggi e accredita il bonus della serie.
   *
   * Si chiama dopo ogni azione riuscita: quale minigioco sia non conta, conta
   * essere tornato. Il documento del movimento ha per id il giorno, quindi due
   * partite nello stesso giorno non possono accreditare due volte.
   */
  async function registraGiornoAttivo(): Promise<{ giorni: number; bonus: number }> {
    return db.runTransaction(async tx => {
      const snap = await tx.get(profileRef);
      if (!snap.exists) return { giorni: 0, bonus: 0 };
      const dati = snap.data() ?? {};
      const serie = calcolaSerie(
        dati.streakDate as string | undefined,
        Number(dati.streakDays ?? 0),
        today
      );
      if (!serie.nuovoGiorno) return { giorni: serie.giorni, bonus: 0 };

      const updates: Record<string, unknown> = {
        streakDate: today,
        streakDays: serie.giorni,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (serie.bonus > 0) {
        updates.coins = FieldValue.increment(serie.bonus);
        updates.coinsEarned = FieldValue.increment(serie.bonus);
      }
      tx.update(profileRef, updates);
      if (serie.bonus > 0) {
        tx.set(db.collection('wallet_transactions').doc(`${uid}_serie_${today}`), {
          userId: uid,
          amount: serie.bonus,
          reason: 'serie_giornaliera',
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      return { giorni: serie.giorni, bonus: serie.bonus };
    });
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

  // L'azione vera e propria. Racchiusa qui dentro perche' dopo, qualunque
  // sia il minigioco, si registra la presenza del giorno per la serie.
  const esito = await (async (): Promise<Record<string, unknown>> => {
  switch (action) {
    // --- QUIZ ---
    case 'quiz_start': {
      const pool = await db.collection('quiz_questions').get();
      if (pool.empty) {
        // Seeding va fatto solo dall'admin (vedi seedQuizQuestions): un
        // auto-seed qui duplicherebbe quel percorso di scrittura senza il
        // controllo di ruolo.
        throw new HttpsError(
          'failed-precondition',
          'Quiz non ancora disponibile, riprova più tardi'
        );
      }
      // Get user's seen questions to avoid repeats
      const seenRef = db.collection('quiz_seen').doc(uid);
      const seenDoc = await seenRef.get();
      const seenIds = new Set<string>((seenDoc.data()?.questionIds ?? []) as string[]);
      // Filter unseen, fallback to all if everything seen
      const unseen = pool.docs.filter(d => !seenIds.has(d.id));
      // Quando le domande non viste scendono sotto una partita intera il ciclo
      // riparte dall'intero pool: il reset va PERSISTITO, altrimenti la lista
      // "viste" cresce all'infinito, resta sempre sotto soglia e l'anti-ripetizione
      // smette di filtrare per sempre.
      const mustResetSeen = unseen.length < COINS.quizMaxQuestions;
      const available = mustResetSeen ? [...pool.docs] : unseen;
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
        // Always create a fresh session with new questions.
        // Reusing old sessions caused the same questions to appear after refresh.
        if (mustResetSeen) {
          tx.set(seenRef, { questionIds: [], updatedAt: FieldValue.serverTimestamp() });
        }
        tx.set(sessionRef, {
          userId: uid,
          questions: questionsData.map(q => ({ id: q.id, question: q.question, options: q.options, answerIndex: q.answerIndex })),
          date: today,
          submitted: false,
          createdAt: FieldValue.serverTimestamp(),
        });
        return questionsData;
      });
      // Non inviare mai answerIndex al client prima della submission: un utente
      // potrebbe leggerlo dalla risposta di rete e rispondere sempre corretto.
      return {
        questions: savedQuestions.map(q => ({ id: q.id, question: q.question, options: q.options })),
      };
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
        // Firestore impone TUTTE le letture prima di qualsiasi scrittura: questa
        // get va tenuta qui, non accanto alla scrittura di quiz_seen più sotto,
        // altrimenti l'intera transazione fallisce con INTERNAL e il quiz non
        // viene mai registrato (niente riepilogo, niente limite giornaliero).
        const seenRef = db.collection('quiz_seen').doc(uid);
        const seenSnap = await tx.get(seenRef);

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
        // Track seen questions (la lettura di seenSnap è stata fatta sopra)
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
      const idx = secureIndex(prizes.length);
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
        shots.some(s => !isValidZone(s?.zone) || !Number.isFinite(s?.power))
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
          // Niente saldo dell'avversario: non serve a giocare la sfida.
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
        myShots.some(s => !isValidZone(s?.zone) || !Number.isFinite(s?.power))
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
      const levelsCompleted = intInRange(
        request.data?.levelsCompleted,
        0,
        COINS.memoriaLevelTimes.length
      );
      if (levelsCompleted < 1) {
        throw new HttpsError('invalid-argument', 'Devi completare almeno un livello');
      }
      // Il tempo residuo non può superare quello messo a disposizione dai
      // livelli dichiarati: è l'unico freno a un client che si inventa il bonus.
      const tempoMassimo = COINS.memoriaLevelTimes
        .slice(0, levelsCompleted)
        .reduce((a, b) => a + b, 0);
      const timeRemaining = intInRange(request.data?.timeRemaining, 0, tempoMassimo);
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
  })();

  const serie = await registraGiornoAttivo();
  return { ...esito, serie };
});

/**
 * Classifica già calcolata.
 *
 * Prima ogni client scaricava l'intero elenco dei profili a pagine da 100 e
 * ordinava in locale: N/100 invocazioni e N letture Firestore per ogni utente
 * che apriva la classifica, e per ogni classifica di lega. Qui il calcolo si
 * fa una volta sola e al client tornano solo le righe della classifica.
 *
 * Con `leagueId` la classifica è ristretta ai membri di quella lega, che il
 * chiamante deve poter vedere (lega pubblica o di cui è membro).
 */
export const getRankings = onCall(callableOpts, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');

  const leagueId = request.data?.leagueId as string | undefined;
  if (leagueId) {
    const snap = await db.collection('leagues').doc(leagueId).get();
    if (!snap.exists) throw new HttpsError('not-found', 'Lega non trovata');
    const lega = snap.data() as { isPrivate?: boolean; memberIds?: string[] };
    const memberIds = lega.memberIds ?? [];
    if (lega.isPrivate && !memberIds.includes(uid)) {
      throw new HttpsError('permission-denied', 'Lega privata');
    }

    // La classifica di lega si costruisce sui punti delle schedine di lega
    // (sottocollezione standings), non su quelli del circuito generale: sono
    // due competizioni distinte. I membri che non hanno ancora giocato
    // compaiono comunque, a zero.
    const standings = await db
      .collection('leagues')
      .doc(leagueId)
      .collection('standings')
      .get();
    const perUid = new Map(standings.docs.map(d => [d.id, d.data()]));

    const membriProfili = await Promise.all(
      memberIds.map(m => db.collection('profiles').doc(m).get())
    );
    const righeLega: RankableProfile[] = membriProfili
      .filter(d => d.exists && d.data()?.isActive !== false)
      .map(d => {
        const s = perUid.get(d.id) ?? {};
        return {
          id: d.id,
          username: (s.username as string) ?? (d.data()?.username as string) ?? 'player',
          totalPoints: Number(s.totalPoints ?? 0),
          matchdaysPlayed: Number(s.matchdaysPlayed ?? 0),
          correctPredictions: Number(s.correctPredictions ?? 0),
          bestMatchdayPoints: Number(s.bestMatchdayPoints ?? 0),
          perfectSchedine: Number(s.perfectSchedine ?? 0),
          bonusPointsTotal: Number(s.bonusPointsTotal ?? 0),
          penaltyPointsTotal: Number(s.penaltyPointsTotal ?? 0),
          weeklyWins: Number(s.weeklyWins ?? 0),
        };
      });

    return { rankings: computeRankings(righeLega) };
  }

  const profili: RankableProfile[] = [];
  let cursore: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (;;) {
    // Niente filtro `where('isActive','==',true)`: in Firestore un documento
    // privo del campo non soddisfa l’uguaglianza, quindi ogni profilo scritto
    // senza `isActive` spariva dalla classifica. La classifica di lega qui
    // sopra usa gia’ `isActive !== false`, cioe’ “attivo salvo prova
    // contraria”: le due devono dire la stessa cosa.
    let q = db.collection('profiles').limit(300);
    if (cursore) q = q.startAfter(cursore);
    const pagina = await q.get();
    if (pagina.empty) break;
    for (const d of pagina.docs) {
      const p = d.data();
      if (p.isActive === false) continue;
      profili.push({
        id: d.id,
        username: typeof p.username === 'string' ? p.username : 'player',
        totalPoints: Number(p.totalPoints ?? 0),
        matchdaysPlayed: Number(p.matchdaysPlayed ?? 0),
        correctPredictions: Number(p.correctPredictions ?? 0),
        bestMatchdayPoints: Number(p.bestMatchdayPoints ?? 0),
        perfectSchedine: Number(p.perfectSchedine ?? 0),
        bonusPointsTotal: Number(p.bonusPointsTotal ?? 0),
        penaltyPointsTotal: Number(p.penaltyPointsTotal ?? 0),
        weeklyWins: Number(p.weeklyWins ?? 0),
      });
    }
    cursore = pagina.docs[pagina.docs.length - 1];
    if (pagina.docs.length < 300) break;
  }

  return { rankings: computeRankings(profili) };
});

export const getPublicProfiles = onCall(callableOpts, async request => {
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
          // Il portafoglio di un utente non riguarda gli altri: nessuna
          // schermata lo usa, e restava esposto a chiunque fosse autenticato.
        };
      }),
    nextCursor: lastDoc ? lastDoc.id : null,
  };
});

// ---------- Notifica di prova ----------
//
// Chi attiva le notifiche vuole sapere subito se arrivano, senza aspettare
// una scadenza. Manda ai soli dispositivi dell'utente che chiama.

export const sendTestPush = onCall(callableOpts, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await enforceRateLimit(uid, 'sendTestPush', 3, 60_000);
  const perUtente = await caricaTokenPush([uid]);
  const tokens = perUtente.get(uid) ?? [];
  if (tokens.length === 0) {
    throw new HttpsError('failed-precondition', 'Nessun dispositivo registrato: attiva prima le notifiche');
  }
  const consegnati = await notifica([uid], {
    title: '🔔 Le notifiche funzionano',
    body: 'Ti avviseremo alla scadenza della schedina, al calcio d’inizio e a giornata valutata.',
    path: '/account',
    tag: 'test',
  }, 'esito');
  logger.info('sendTestPush', { uid, dispositivi: tokens.length, consegnati });
  return { dispositivi: tokens.length, consegnati };
});

// ---------- Estrazione di giornata ----------
//
// Il pozzo dei gettoni: un biglietto costa RAFFLE.ticketCost, il premio
// (il terzo dei premi settimanali, di norma il cappellino) va a sorte fra
// chi ha biglietti quando la giornata viene valutata. Tetto per utente,
// cosi' chi ha accumulato molto non compra l'urna intera.

export const buyRaffleTicket = onCall(callableOpts, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await enforceRateLimit(uid, 'buyRaffleTicket', 10, 60_000);
  const richiesti = Number(request.data?.count);
  if (!Number.isInteger(richiesti) || richiesti < 1 || richiesti > RAFFLE.maxTicketsPerUser) {
    throw new HttpsError('invalid-argument', 'Numero di biglietti non valido');
  }
  const md = await getCurrentMatchday();
  if (!md || md.settled) throw new HttpsError('failed-precondition', 'Nessuna giornata aperta');

  const premi = await leggiPremiSettimanali(md.number);
  const premio = premi.find(p => p.position === 3) ?? premi[premi.length - 1] ?? { label: 'Cappellino', emoji: '🧢' };
  const ticketRef = db.collection('raffle_tickets').doc(`${md.number}_${uid}`);
  const raffleRef = db.collection('raffles').doc(String(md.number));
  const profileRef = db.collection('profiles').doc(uid);

  return db.runTransaction(async tx => {
    const [prof, tk, rf] = await Promise.all([tx.get(profileRef), tx.get(ticketRef), tx.get(raffleRef)]);
    if (!prof.exists) throw new HttpsError('not-found', 'Profilo non trovato');
    if (rf.exists && rf.data()?.status === 'drawn') {
      throw new HttpsError('failed-precondition', 'Estrazione gia\' fatta per questa giornata');
    }
    const gia = tk.exists ? ((tk.data()?.count as number) ?? 0) : 0;
    const n = bigliettiAcquistabili(gia, richiesti);
    if (n === 0) {
      throw new HttpsError('failed-precondition', `Massimo ${RAFFLE.maxTicketsPerUser} biglietti per giornata`);
    }
    const costo = n * RAFFLE.ticketCost;
    const coins = (prof.data()?.coins as number) ?? 0;
    if (coins < costo) throw new HttpsError('failed-precondition', `Servono ${costo} gettoni, ne hai ${coins}`);

    await adjustCoins(uid, -costo, `raffle_g${md.number}`, tx);
    tx.set(ticketRef, { uid, matchday: md.number, count: gia + n, updatedAt: FieldValue.serverTimestamp() });
    const totale = (rf.exists ? ((rf.data()?.totalTickets as number) ?? 0) : 0) + n;
    const partecipanti = (rf.exists ? ((rf.data()?.participants as number) ?? 0) : 0) + (gia === 0 ? 1 : 0);
    tx.set(
      raffleRef,
      {
        matchday: md.number,
        prize: { label: premio.label, emoji: premio.emoji ?? null },
        totalTickets: totale,
        participants: partecipanti,
        status: 'open',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    logger.info('buyRaffleTicket', { uid, matchday: md.number, n, totale });
    return { count: gia + n, totalTickets: totale, coins: coins - costo };
  });
});

/** Sorteggio a giornata valutata: una sola volta, poi avvisa chi ha vinto. */
async function estraiPremioGiornata(matchday: number): Promise<void> {
  const raffleRef = db.collection('raffles').doc(String(matchday));
  const rf = await raffleRef.get();
  if (!rf.exists || rf.data()?.status === 'drawn') return;
  const tickets = await db.collection('raffle_tickets').where('matchday', '==', matchday).get();
  const entries = tickets.docs.map(d => ({
    uid: d.data().uid as string,
    count: (d.data().count as number) ?? 0,
  }));
  const vincitore = estraiVincitore(entries);
  let username: string | null = null;
  if (vincitore) {
    const p = await db.collection('profiles').doc(vincitore).get();
    username = (p.data()?.username as string) ?? null;
  }
  await raffleRef.set(
    { status: 'drawn', winnerUid: vincitore, winnerUsername: username, drawnAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  logger.info(`Giornata ${matchday}: estrazione, vincitore ${vincitore ?? 'nessuno'} su ${entries.length} partecipanti`);
  if (!vincitore) return;
  const premio = (rf.data()?.prize ?? {}) as { label?: string; emoji?: string | null };
  await notifica([vincitore], {
    title: '🎉 Hai vinto l\'estrazione!',
    body: `${premio.emoji ?? ''} ${premio.label ?? 'Il premio'} della giornata ${matchday} e' tuo. Ti contattiamo per la consegna.`.trim(),
    path: '/premi',
    tag: `raffle-${matchday}`,
  }, 'social');
}

export const manageLeague = onCall(callableOpts, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await enforceRateLimit(uid, 'manageLeague', 10, 60_000);
  const action = request.data?.action as string;
  logger.info('manageLeague', { uid, action });

  if (action === 'create') {
    const name = typeof request.data?.name === 'string' ? request.data.name.trim() : '';
    const description =
      typeof request.data?.description === 'string' ? request.data.description.trim() : '';
    const isPrivate = request.data?.isPrivate === true;
    const requestedMax = Number(request.data?.maxMembers);
    // Agenzia per il palinsesto delle quote: la scrive a mano chi crea la
    // lega, la assegna l'amministratore fra quelle attive sul piano.
    const agenziaRichiesta =
      typeof request.data?.agenziaRichiesta === 'string'
        ? request.data.agenziaRichiesta.trim().slice(0, 40)
        : '';
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
      agenziaRichiesta: agenziaRichiesta || null,
      bookmaker: null,
      stato: agenziaRichiesta ? 'in_attesa' : 'attiva',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (agenziaRichiesta) {
      // L'amministratore deve sapere che c'e' una lega ferma ad aspettarlo,
      // senza doverlo scoprire aprendo il pannello.
      const admin = await db.collection('profiles').where('role', '==', 'admin').get();
      const destinatari = admin.docs.map(d => d.id);
      if (destinatari.length > 0) {
        await notifica(
          destinatari,
          {
            title: '🏆 Nuova lega da attivare',
            body: `${profile.data()?.username ?? 'Un utente'} ha creato "${name}" e chiede il palinsesto ${agenziaRichiesta}.`,
            path: '/admin',
          },
          'social'
        ).catch(err => logger.warn('notifica lega in attesa non inviata', err));
      }
    }
    return { ok: true, leagueId: ref.id, stato: agenziaRichiesta ? 'in_attesa' : 'attiva' };
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


// ---------- 5-bis. SCHEDINE DI UNA LEGA (callable, solo il creatore) ----------

/**
 * Le schedine dei membri di una lega, appena inviate.
 *
 * Fuori da qui le schedine altrui si vedono solo a tempo scaduto (anti-copia,
 * vedi firestore.rules): questa e' l'unica eccezione, chiesta da chi organizza
 * le leghe per poter seguire chi ha giocato e cosa. Proprio perche' e'
 * un'eccezione passa da una callable che controlla di persona chi chiede,
 * invece di allargare le regole a tutti (Giovanni, 20/09/2026).
 *
 * Chi entra in una lega lo sa: la pagina della lega lo dice a tutti i membri.
 */
export const getSchedineLega = onCall(callableOpts, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await enforceRateLimit(uid, 'getSchedineLega', 30, 60_000);

  const leagueId = typeof request.data?.leagueId === 'string' ? request.data.leagueId : '';
  if (!leagueId || leagueId.length > 128) {
    throw new HttpsError('invalid-argument', 'Lega non valida');
  }

  const legaSnap = await db.collection('leagues').doc(leagueId).get();
  if (!legaSnap.exists) throw new HttpsError('not-found', 'Lega non trovata');
  const lega = legaSnap.data() as { ownerId?: string; memberIds?: string[] };
  if (lega.ownerId !== uid) {
    throw new HttpsError('permission-denied', 'Solo chi ha creato la lega vede le schedine');
  }

  const richiesta = Number(request.data?.matchdayNumber);
  let numero = Number.isInteger(richiesta) && richiesta > 0 ? richiesta : null;
  if (numero == null) {
    const corrente = await getCurrentMatchday();
    if (!corrente) throw new HttpsError('unavailable', 'Nessuna giornata disponibile');
    numero = corrente.number;
  }

  const snap = await db
    .collection('schedine')
    .where('leagueId', '==', leagueId)
    .where('matchdayNumber', '==', numero)
    .get();

  const schedine = snap.docs.map(d => {
    const s = d.data() as SchedinaDoc & { finalPoints?: number; correctPredictions?: number };
    return {
      userId: s.userId,
      username: s.username,
      submittedAt: s.submittedAt?.toMillis() ?? null,
      settled: s.settled === true,
      finalPoints: s.finalPoints ?? null,
      correctPredictions: s.correctPredictions ?? null,
      predictions: (s.predictions ?? []).map(p => ({
        matchId: p.matchId,
        betType: p.betType,
        outcome: p.outcome,
        odds: p.odds,
      })),
    };
  });

  // Anche chi non ha ancora giocato: per chi organizza, sapere chi manca e'
  // meta' dell'informazione utile.
  const presenti = new Set(schedine.map(s => s.userId));
  const mancanti = (lega.memberIds ?? []).filter(m => !presenti.has(m));
  const profili = await Promise.all(
    mancanti.map(m => db.collection('profiles').doc(m).get())
  );

  return {
    matchdayNumber: numero,
    schedine,
    mancanti: profili
      .filter(d => d.exists)
      .map(d => ({ userId: d.id, username: (d.data()?.username as string) ?? 'giocatore' })),
  };
});

// ---------- 5-ter. LEGHE IN ATTESA (callable, solo amministratore) ----------

/**
 * Pannello dell'amministratore per le leghe che hanno chiesto un'agenzia.
 *
 * `elenco` restituisce le leghe ferme e le agenzie davvero disponibili sul
 * piano sottoscritto; `assegna` collega la lega a una di quelle e la fa
 * partire; `rifiuta` la fa partire sull'agenzia predefinita.
 */
export const adminLeghe = onCall(
  { ...callableOpts, secrets: [ODDS_API_KEY] },
  async request => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
    await requireAdmin(uid);
    const action = (request.data?.action as string) ?? 'elenco';

    if (action === 'elenco') {
      const snap = await db.collection('leagues').where('stato', '==', 'in_attesa').get();
      return {
        agenzieDisponibili: await bookmakerDisponibili(ODDS_API_KEY.value()),
        leghe: snap.docs.map(d => ({
          id: d.id,
          name: (d.data()?.name as string) ?? '',
          ownerName: (d.data()?.ownerName as string) ?? '',
          agenziaRichiesta: (d.data()?.agenziaRichiesta as string) ?? '',
          memberCount: Number(d.data()?.memberCount ?? 0),
          createdAt: (d.data()?.createdAt as Timestamp | undefined)?.toMillis() ?? null,
        })),
      };
    }

    const leagueId = typeof request.data?.leagueId === 'string' ? request.data.leagueId : '';
    if (!leagueId) throw new HttpsError('invalid-argument', 'Lega non valida');
    const ref = db.collection('leagues').doc(leagueId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Lega non trovata');
    const nomeLega = (snap.data()?.name as string) ?? 'la tua lega';
    const proprietario = snap.data()?.ownerId as string | undefined;

    if (action === 'assegna') {
      const agenzia = typeof request.data?.bookmaker === 'string' ? request.data.bookmaker : '';
      const disponibili = await bookmakerDisponibili(ODDS_API_KEY.value());
      if (!disponibili.includes(agenzia)) {
        throw new HttpsError(
          'invalid-argument',
          `Agenzia non disponibile sul piano. Disponibili: ${disponibili.join(', ')}`
        );
      }
      await ref.update({
        bookmaker: agenzia,
        stato: 'attiva',
        updatedAt: FieldValue.serverTimestamp(),
      });
      // Le quote dell'agenzia appena assegnata non ci sono ancora sulla
      // giornata aperta: la sincronizzazione le aggiunge senza toccare quelle
      // gia' pubblicate.
      await syncMatchdayInternal().catch(err =>
        logger.warn('quote della nuova agenzia non scaricate subito', err)
      );
      if (proprietario) {
        await notifica(
          [proprietario],
          {
            title: '✅ Lega attivata',
            body: `"${nomeLega}" gioca sulle quote ${agenzia}. Potete cominciare.`,
            path: `/leghe/${leagueId}`,
          },
          'social'
        ).catch(() => undefined);
      }
      return { ok: true, bookmaker: agenzia };
    }

    if (action === 'rifiuta') {
      await ref.update({
        bookmaker: null,
        stato: 'attiva',
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (proprietario) {
        await notifica(
          [proprietario],
          {
            title: '✅ Lega attivata',
            body: `"${nomeLega}" gioca sulle quote standard: l'agenzia richiesta non è disponibile.`,
            path: `/leghe/${leagueId}`,
          },
          'social'
        ).catch(() => undefined);
      }
      return { ok: true, bookmaker: null };
    }

    throw new HttpsError('invalid-argument', `Azione sconosciuta: ${action}`);
  }
);

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

export const claimMission = onCall(callableOpts, async request => {
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
// 7b. DIRITTI DELL'INTERESSATO (GDPR artt. 15, 17, 20)
// ============================================

/**
 * Portabilità (art. 20): restituisce in JSON tutti i dati riferiti
 * all'utente autenticato. Solo i propri: l'uid arriva dal token, non
 * dal payload, quindi non è forzabile dal client.
 */
export const exportMyData = onCall(callableOpts, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await enforceRateLimit(uid, 'exportMyData', 3, 3_600_000);

  const [profileSnap, schedineSnap, walletSnap, duelsP1, duelsP2, leaguesSnap] = await Promise.all([
    db.collection('profiles').doc(uid).get(),
    db.collection('schedine').where('userId', '==', uid).get(),
    db.collection('wallet_transactions').where('userId', '==', uid).get(),
    db.collection('penalty_duels').where('p1.uid', '==', uid).get(),
    db.collection('penalty_duels').where('p2.uid', '==', uid).get(),
    db.collection('leagues').where('memberIds', 'array-contains', uid).get(),
  ]);

  logger.info('exportMyData', { uid });

  return {
    exportedAt: new Date().toISOString(),
    format: 'application/json',
    profile: profileSnap.exists ? { id: profileSnap.id, ...profileSnap.data() } : null,
    schedine: schedineSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    walletTransactions: walletSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    penaltyDuels: [...duelsP1.docs, ...duelsP2.docs].map(d => ({ id: d.id, ...d.data() })),
    leagues: leaguesSnap.docs.map(d => ({
      id: d.id,
      name: d.data().name,
      isOwner: d.data().ownerId === uid,
    })),
  };
});

/**
 * Cancellazione (art. 17). Elimina in cascata tutti i dati personali e
 * infine l'utenza di autenticazione.
 *
 * Scelte deliberate:
 * - le leghe di cui l'utente è proprietario vengono eliminate: senza owner
 *   resterebbero orfane e non più amministrabili;
 * - i duelli vengono cancellati integralmente perché contengono lo username
 *   di entrambi i giocatori;
 * - l'utenza Auth è rimossa per ultima: se qualcosa fallisce prima, l'utente
 *   può ancora autenticarsi e ripetere l'operazione.
 */
export const deleteAccount = onCall(callableOpts, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');

  const confirm = request.data?.confirm;
  if (confirm !== 'ELIMINA') {
    throw new HttpsError('failed-precondition', 'Conferma mancante');
  }

  await enforceRateLimit(uid, 'deleteAccount', 3, 3_600_000);
  logger.info('deleteAccount:start', { uid });

  const deleteAll = async (docs: FirebaseFirestore.QueryDocumentSnapshot[]): Promise<number> => {
    for (let i = 0; i < docs.length; i += 400) {
      const batch = db.batch();
      for (const d of docs.slice(i, i + 400)) batch.delete(d.ref);
      await batch.commit();
    }
    return docs.length;
  };

  const [schedineSnap, walletSnap, duelsP1, duelsP2, ownedLeagues, memberLeagues] =
    await Promise.all([
      db.collection('schedine').where('userId', '==', uid).get(),
      db.collection('wallet_transactions').where('userId', '==', uid).get(),
      db.collection('penalty_duels').where('p1.uid', '==', uid).get(),
      db.collection('penalty_duels').where('p2.uid', '==', uid).get(),
      db.collection('leagues').where('ownerId', '==', uid).get(),
      db.collection('leagues').where('memberIds', 'array-contains', uid).get(),
    ]);

  const removed = {
    schedine: await deleteAll(schedineSnap.docs),
    walletTransactions: await deleteAll(walletSnap.docs),
    penaltyDuels: await deleteAll([...duelsP1.docs, ...duelsP2.docs]),
    ownedLeagues: await deleteAll(ownedLeagues.docs),
  };

  // Uscita dalle leghe altrui: si rimuove il membro, la lega resta agli altri.
  const ownedIds = new Set(ownedLeagues.docs.map(d => d.id));
  for (const league of memberLeagues.docs) {
    if (ownedIds.has(league.id)) continue;
    await league.ref.update({
      memberIds: FieldValue.arrayRemove(uid),
      memberCount: FieldValue.increment(-1),
    });
  }

  await db.collection('profiles').doc(uid).delete();

  // Le sessioni attive vanno invalidate prima di rimuovere l'utenza,
  // altrimenti un ID token già emesso resta valido fino alla scadenza.
  await getAuth().revokeRefreshTokens(uid);
  await getAuth().deleteUser(uid);

  logger.info('deleteAccount:done', { uid, ...removed });
  return { ok: true, removed };
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
export const adminSyncMatchday = onCall({ ...callableOpts, secrets: [ODDS_API_KEY] }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await requireAdmin(uid);
  const forceOdds = request.data?.forceOdds === true;
  const md = await syncMatchdayInternal(forceOdds);
  return { ok: true, matchday: md ? { number: md.number, matches: md.matches.length } : null };
});

/** Lista/attivazione campionati (admin): quali campionati alimentano il pool partite. */
export const adminManageCompetitions = onCall(callableOpts, async request => {
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
export const adminForceSettle = onCall(callableOpts, async request => {
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
      result: {
        homeGoals: r.homeGoals,
        awayGoals: r.awayGoals,
        outcome,
        // Senza i gol del primo tempo i mercati 1T non sono valutabili e
        // verrebbero annullati: la stessa giornata varrebbe punteggi diversi
        // a seconda che la valuti lo scheduler o l'admin.
        ...(r.htHomeGoals != null
          ? { htHomeGoals: r.htHomeGoals, htAwayGoals: r.htAwayGoals }
          : {}),
      },
    };
  });
  await mdSnap.ref.update({ matches: updatedMatches, updatedAt: FieldValue.serverTimestamp() });

  // Lo scheduler salta le giornate con partite ancora in corso; qui il
  // controllo mancava del tutto. Valutare adesso congelerebbe come sbagliati
  // i pronostici su partite non ancora giocate, e `settled: true` rende la
  // cosa irreversibile. Resta possibile forzare, ma va chiesto esplicitamente.
  const nonConcluse = updatedMatches.filter(m => m.status !== 'finished' || !m.result);
  if (nonConcluse.length > 0 && request.data?.force !== true) {
    throw new HttpsError(
      'failed-precondition',
      `${nonConcluse.length} partite non concluse (${nonConcluse
        .map(m => m.id)
        .join(', ')}). Ripeti con force: true per valutare comunque.`
    );
  }
  if (nonConcluse.length > 0) {
    logger.warn('adminForceSettle: settlement forzato su partite non concluse', {
      uid,
      matchday: matchdayNumber,
      partite: nonConcluse.map(m => m.id),
    });
  }

  // Reuse the same settlement logic as the scheduled function (transactions + profile updates + prizes)
  const valutate = await settleSchedine(matchdayNumber, updatedMatches as unknown as StoredMatch[]);

  // Mark matchday as settled
  await mdSnap.ref.update({ settled: true, updatedAt: FieldValue.serverTimestamp() });

  return { ok: true, matchday: matchdayNumber, settled: valutate };
});

/** CRUD sponsor (admin). */
export const adminManageSponsor = onCall(callableOpts, async request => {
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
export const adminGetStats = onCall(callableOpts, async request => {
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

/**
 * Azzeramento di inizio stagione (admin).
 *
 * Riporta tutti i profili allo stato iniziale: punti, statistiche e missioni
 * riscosse a zero, gettoni al bonus di partenza. Serve dopo un cambio di
 * regole del punteggio, quando i valori accumulati sono su una scala che non
 * ha più senso confrontare con quelli nuovi.
 *
 * Non tocca schedine, giornate e premi passati: restano come storico.
 * Le missioni tornano riscuotibili — è voluto, è una stagione nuova.
 */
/** Svuota una collezione a pagine (batch da 400, sotto il limite di 500 op). */
async function svuotaCollezione(nome: string): Promise<number> {
  let eliminati = 0;
  for (;;) {
    const pagina = await db.collection(nome).limit(400).get();
    if (pagina.empty) break;
    const batch = db.batch();
    for (const d of pagina.docs) batch.delete(d.ref);
    await batch.commit();
    eliminati += pagina.docs.length;
    if (pagina.docs.length < 400) break;
  }
  return eliminati;
}

export const adminResetSeason = onCall({ ...callableOpts, secrets: [ODDS_API_KEY] }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await requireAdmin(uid);
  if (request.data?.confirm !== 'AZZERA') {
    throw new HttpsError(
      'failed-precondition',
      'Conferma mancante: serve la parola AZZERA'
    );
  }

  const azzeramento = {
    totalPoints: 0,
    weeklyPoints: 0,
    matchdaysPlayed: 0,
    perfectSchedine: 0,
    bonusPointsTotal: 0,
    penaltyPointsTotal: 0,
    weeklyWins: 0,
    bestMatchdayPoints: 0,
    correctPredictions: 0,
    coins: COINS.starting,
    coinsEarned: 0,
    claimedMissions: [] as string[],
  };

  let azzerati = 0;
  let cursore: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (;;) {
    let q = db.collection('profiles').limit(300);
    if (cursore) q = q.startAfter(cursore);
    const pagina = await q.get();
    if (pagina.empty) break;

    const batch = db.batch();
    for (const d of pagina.docs) {
      batch.update(d.ref, { ...azzeramento, updatedAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
    azzerati += pagina.docs.length;

    cursore = pagina.docs[pagina.docs.length - 1];
    if (pagina.docs.length < 300) break;
  }

  // Anche le classifiche di lega, che sono l’altro circuito: azzerare solo i
  // profili lasciava le leghe coi punti della stagione precedente, e siccome
  // le schedine gia’ valutate non si rivalutano quei punti non tornavano piu’
  // in riga con niente. Una stagione nuova azzera entrambi i circuiti.
  let classificheDiLega = 0;
  const leghe = await db.collection('leagues').get();
  for (const lega of leghe.docs) {
    const standings = await lega.ref.collection('standings').get();
    if (standings.empty) continue;
    const batch = db.batch();
    for (const riga of standings.docs) {
      batch.update(riga.ref, {
        totalPoints: 0,
        weeklyPoints: 0,
        matchdaysPlayed: 0,
        correctPredictions: 0,
        perfectSchedine: 0,
        bonusPointsTotal: 0,
        penaltyPointsTotal: 0,
        bestMatchdayPoints: 0,
        weeklyWins: 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    classificheDiLega += standings.docs.length;
  }

  // Le schedine passate vanno in archivio, non lasciate dove sono: gli id
  // sono `uid_giornata[_lega]` e la numerazione riparte da 1, quindi la
  // vecchia giornata 1 colliderebbe con la nuova. Lo storico resta in
  // `schedine_archivio`, marcato con il momento dell’azzeramento.
  const resetTag = Date.now();
  let schedineArchiviate = 0;
  for (;;) {
    const pagina = await db.collection('schedine').limit(200).get();
    if (pagina.empty) break;
    const batch = db.batch();
    for (const d of pagina.docs) {
      batch.set(db.collection('schedine_archivio').doc(`${resetTag}_${d.id}`), {
        ...d.data(),
        resetTag,
        archiviataAt: FieldValue.serverTimestamp(),
      });
      batch.delete(d.ref);
    }
    await batch.commit();
    schedineArchiviate += pagina.docs.length;
    if (pagina.docs.length < 200) break;
  }

  // Una stagione nuova riparte dalla giornata 1. Il numero della prossima
  // giornata è “max esistente + 1” e vale 1 solo a collezione vuota (vedi
  // syncMatchdayInternal): senza questa pulizia l’azzeramento ripartiva
  // dalla 16. Premi e movimenti gettoni riusano gli stessi id per giornata
  // (`weekly_{n}`, `settlement_{n}_{uid}`) e vanno via con lei.
  const giornateEliminate = await svuotaCollezione('matchdays');
  await svuotaCollezione('weekly_prizes');
  await svuotaCollezione('prizes');
  await svuotaCollezione('wallet_transactions');

  // Riparte subito: con le giornate azzerate la prossima sincronizzata è la
  // 1. Se ESPN non risponde ci pensa il sync schedulato (ogni 6 ore).
  const nuova = await syncMatchdayInternal().catch(e => {
    logger.warn('adminResetSeason: risincronizzazione fallita', {
      motivo: (e as Error).message,
    });
    return null;
  });

  // Traccia dell'operazione: è irreversibile e cambia la classifica di tutti.
  await db.collection('season_resets').add({
    byUid: uid,
    profili: azzerati,
    classificheDiLega,
    schedineArchiviate,
    giornateEliminate,
    prossimaGiornata: nuova?.number ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
  logger.warn('adminResetSeason', {
    uid,
    profili: azzerati,
    classificheDiLega,
    schedineArchiviate,
    giornateEliminate,
    prossimaGiornata: nuova?.number ?? null,
  });

  return {
    ok: true,
    profili: azzerati,
    classificheDiLega,
    schedineArchiviate,
    prossimaGiornata: nuova?.number ?? null,
  };
});

/**
 * Premi settimanali di una giornata (admin).
 *
 * L'amministratore li decide in base a quanti stanno giocando quella
 * settimana, quindi vivono per giornata e non nel codice. Finché non li
 * imposta valgono quelli di partenza (felpa, t-shirt, cappellino).
 */
export const adminManageWeeklyPrizes = onCall(callableOpts, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await requireAdmin(uid);

  const action = request.data?.action as string;
  const matchdayNumber = intInRange(request.data?.matchdayNumber, 0, 38);
  if (matchdayNumber < 1) {
    throw new HttpsError('invalid-argument', 'Giornata non valida');
  }
  const ref = db.collection('weekly_prizes').doc(String(matchdayNumber));

  if (action === 'get') {
    const snap = await ref.get();
    const items = snap.exists ? (snap.data()?.items as WeeklyPrize[] | undefined) : undefined;
    const personalizzati = !!items && items.length > 0;
    return {
      matchdayNumber,
      personalizzati,
      items: personalizzati ? items : DEFAULT_WEEKLY_PRIZES,
    };
  }

  if (action === 'set') {
    const grezzi = request.data?.items;
    if (!Array.isArray(grezzi) || grezzi.length === 0) {
      throw new HttpsError('invalid-argument', 'Serve almeno un premio');
    }
    if (grezzi.length > MAX_WEEKLY_PRIZES) {
      throw new HttpsError(
        'invalid-argument',
        `Non più di ${MAX_WEEKLY_PRIZES} premi per giornata`
      );
    }

    const posizioni = new Set<number>();
    const items: WeeklyPrize[] = grezzi.map((grezzo: unknown) => {
      const p = (grezzo ?? {}) as { position?: unknown; label?: unknown; emoji?: unknown };
      const position = intInRange(p.position, 0, MAX_WEEKLY_PRIZES);
      if (position < 1) {
        throw new HttpsError('invalid-argument', 'Posizione del premio non valida');
      }
      if (posizioni.has(position)) {
        throw new HttpsError('invalid-argument', `Posizione ${position} ripetuta`);
      }
      posizioni.add(position);

      const label = typeof p.label === 'string' ? p.label.trim() : '';
      if (!label) throw new HttpsError('invalid-argument', 'Ogni premio ha bisogno di un nome');
      if (label.length > 60) {
        throw new HttpsError('invalid-argument', 'Nome del premio troppo lungo (max 60)');
      }
      const emoji = typeof p.emoji === 'string' ? p.emoji.trim().slice(0, 8) : '';
      return emoji ? { position, label, emoji } : { position, label };
    });

    items.sort((a, b) => a.position - b.position);
    await ref.set({
      matchday: matchdayNumber,
      items,
      byUid: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info('adminManageWeeklyPrizes:set', { uid, matchdayNumber, premi: items.length });
    return { ok: true, matchdayNumber, items };
  }

  throw new HttpsError('invalid-argument', `Azione sconosciuta: ${action}`);
});

/** Ban/unban utente (admin). */
export const adminToggleBan = onCall(callableOpts, async request => {
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

// ---------- 6. RIGORI DUELLO REALTIME 1v1 / BOT ----------

/** Tempo per tirare o tuffarsi in ogni round: mira + barra di potenza. */
const DUEL_ROUND_MS = 8000;
/** Potenza di un tiro affrettato (tempo scaduto senza scelta). */
const DUEL_TIMEOUT_POWER = 35;
/** Potenza quando il client non la manda (client vecchi): tiro medio. */
const DUEL_DEFAULT_POWER = 60;

interface PenaltyDuelDoc {
  code: string;
  p1: { uid: string; username: string; score: number };
  p2: { uid: string; username: string; score: number; isBot?: boolean };
  mode: DuelMode;
  round: number;
  attacker: 1 | 2;
  /** Zona scelta: dove tira l'attaccante, dove si tuffa il portiere. */
  p1Choice: PenaltyZone | null;
  p2Choice: PenaltyZone | null;
  /** Potenza del tiro (0-100) di chi attacca; null per chi para. */
  p1Power?: number | null;
  p2Power?: number | null;
  phase: 'waiting' | 'playing' | 'finished';
  startedAt: number;
  deadlineAt: number;
  winner: 1 | 2 | 'draw' | null;
  /** Chiusa dalla pulizia perché nessuno ha più giocato, non dal risultato. */
  abandoned?: boolean;
  reward: number;
  lastRound: {
    round: number;
    attacker: 1 | 2;
    p1Choice: PenaltyZone;
    p2Choice: PenaltyZone;
    shot: PenaltyZone;
    keeper: PenaltyZone;
    power: number;
    outcome: DuelOutcome;
    goal: boolean;
    p1Score: number;
    p2Score: number;
  } | null;
}

function duelCode(): string {
  return Array.from({ length: 6 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(34)]
  ).join('');
}

/** Mossa a caso per chi non ha scelto in tempo: tiro affrettato o tuffo cieco. */
function mossaCasuale(attacca: boolean): { zone: PenaltyZone; power: number } {
  return { zone: securePick(PENALTY_ZONES), power: attacca ? DUEL_TIMEOUT_POWER : 0 };
}

export const managePenaltyDuel = onCall(callableOpts, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere autenticato');
  await enforceRateLimit(uid, 'managePenaltyDuel', 15, 60_000);

  const action = request.data?.action as string;
  const duelsRef = db.collection('penalty_duels');
  const profileRef = db.collection('profiles').doc(uid);
  const today = romeDateString();

  const getUsername = async (): Promise<string> => {
    const snap = await profileRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Profilo non trovato');
    return (snap.data()?.username as string) ?? 'Tu';
  };

  // --- CREATE ---
  if (action === 'create') {
    const username = await getUsername();
    const code = duelCode();
    const now = Date.now();
    const docRef = duelsRef.doc();
    await docRef.set({
      code,
      p1: { uid, username, score: 0 },
      p2: { uid: '', username: '', score: 0 },
      mode: 'human',
      round: 1,
      attacker: 1,
      p1Choice: null,
      p2Choice: null,
      phase: 'waiting',
      startedAt: now,
      deadlineAt: now + 30000,
      winner: null,
      reward: 0,
      lastRound: null,
    });
    return { duelId: docRef.id, code };
  }

  // --- JOIN BY CODE ---
  if (action === 'join') {
    const code = (request.data?.code as string)?.toUpperCase().trim();
    if (!code || code.length !== 6) throw new HttpsError('invalid-argument', 'Codice non valido');
    const username = await getUsername();

    // Transazione: due giocatori che uniscono lo stesso codice nello stesso
    // istante non devono poter sovrascrivere entrambi p2. Il commit ottimistico
    // di Firestore riprova automaticamente se il documento letto qui viene
    // scritto da un'altra transazione prima di questa.
    return db.runTransaction(async tx => {
      const query = duelsRef.where('code', '==', code).where('phase', '==', 'waiting').limit(1);
      const snap = await tx.get(query);
      if (snap.empty) throw new HttpsError('not-found', 'Partita non trovata o già iniziata');
      const doc = snap.docs[0];
      const data = doc.data() as PenaltyDuelDoc;
      if (data.p1.uid === uid) throw new HttpsError('failed-precondition', 'Non puoi unire la tua partita');

      const now = Date.now();
      tx.update(doc.ref, {
        'p2.uid': uid,
        'p2.username': username,
        phase: 'playing',
        startedAt: now,
        deadlineAt: now + DUEL_ROUND_MS,
      });
      return { duelId: doc.id };
    });
  }

  // --- CREATE VS BOT ---
  if (action === 'bot') {
    const mode = (request.data?.mode as DuelMode) ?? 'botAlternate';
    if (!['botAttacker', 'botKeeper', 'botAlternate'].includes(mode)) {
      throw new HttpsError('invalid-argument', 'Modalità bot non valida');
    }
    const username = await getUsername();
    const docRef = duelsRef.doc();
    const now = Date.now();
    const starting = attackerForRound(1, mode);
    await docRef.set({
      code: '',
      p1: { uid, username, score: 0 },
      p2: { uid: 'bot', username: 'Bot', score: 0, isBot: true },
      mode,
      round: 1,
      attacker: starting,
      p1Choice: null,
      p2Choice: null,
      phase: 'playing',
      startedAt: now,
      deadlineAt: now + DUEL_ROUND_MS,
      winner: null,
      reward: 0,
      lastRound: null,
    });
    return { duelId: docRef.id };
  }

  // --- MAKE MOVE ---
  if (action === 'move') {
    const duelId = request.data?.duelId as string;
    const timeout = request.data?.timeout === true;
    if (!duelId) throw new HttpsError('invalid-argument', 'duelId richiesto');

    // Zona: le sei della porta; le tre direzioni del vecchio client si
    // accettano ancora (finiscono sulle zone basse).
    const rawTarget = request.data?.target;
    const target = rawTarget == null ? null : zoneFromLegacyTarget(rawTarget);
    if (rawTarget != null && !target) {
      throw new HttpsError('invalid-argument', 'Zona non valida');
    }
    const rawPower = request.data?.power;
    const power =
      typeof rawPower === 'number' && Number.isFinite(rawPower)
        ? Math.max(0, Math.min(100, Math.round(rawPower)))
        : null;

    return db.runTransaction(async tx => {
      const duelRef = duelsRef.doc(duelId);
      const duelSnap = await tx.get(duelRef);
      if (!duelSnap.exists) throw new HttpsError('not-found', 'Partita non trovata');
      const duel = duelSnap.data() as PenaltyDuelDoc;

      if (duel.phase !== 'playing') throw new HttpsError('failed-precondition', 'La partita non è in corso');
      if (duel.p1.uid !== uid && duel.p2.uid !== uid) {
        throw new HttpsError('permission-denied', 'Non fai parte di questa partita');
      }

      const isP1 = duel.p1.uid === uid;
      const isBotGame = duel.p2.isBot === true;
      const iAmAttacker = duel.attacker === (isP1 ? 1 : 2);

      // Entrambi scelgono nello stesso round (l'attaccante dove tirare, il
      // portiere dove tuffarsi); l'esito si calcola quando ci sono tutte e due.
      const now = Date.now();
      const deadlinePassed = now >= duel.deadlineAt;

      // La scelta di chi chiama: quella già registrata vince; altrimenti la
      // sua; senza nulla (o a tempo scaduto) una a caso.
      let myChoice = isP1 ? duel.p1Choice : duel.p2Choice;
      let myPower = (isP1 ? duel.p1Power : duel.p2Power) ?? null;
      if (!myChoice) {
        if (target && !timeout) {
          myChoice = target;
          myPower = iAmAttacker ? (power ?? DUEL_DEFAULT_POWER) : 0;
        } else {
          const m = mossaCasuale(iAmAttacker);
          myChoice = m.zone;
          myPower = m.power;
        }
      }

      let p1Choice = isP1 ? myChoice : duel.p1Choice;
      let p2Choice = isP1 ? duel.p2Choice : myChoice;
      const p1Power = isP1 ? myPower : (duel.p1Power ?? null);
      let p2Power = isP1 ? (duel.p2Power ?? null) : myPower;

      // Il bot (sempre p2) risponde subito.
      if (isBotGame && p2Choice === null) {
        if (duel.attacker === 2) {
          const tiro = botDuelShot();
          p2Choice = tiro.zone;
          p2Power = tiro.power;
        } else {
          p2Choice = botDuelKeeper();
          p2Power = 0;
        }
      }

      const bothChosen = p1Choice !== null && p2Choice !== null;
      const canResolve = bothChosen || deadlinePassed;

      if (!canResolve) {
        tx.update(duelRef, { p1Choice, p2Choice, p1Power, p2Power });
        return { ok: true, resolved: false };
      }

      // Chi non ha scelto entro il tempo tira affrettato o si tuffa a caso.
      const attackerIs1 = duel.attacker === 1;
      const shotZone = (attackerIs1 ? p1Choice : p2Choice) ?? mossaCasuale(true).zone;
      const shotPower = (attackerIs1 ? p1Power : p2Power) ?? DUEL_TIMEOUT_POWER;
      const keeperZone = (attackerIs1 ? p2Choice : p1Choice) ?? mossaCasuale(false).zone;
      const esito = resolveDuelShot(shotZone, shotPower, keeperZone);
      const goal = esito.goal;
      p1Choice = attackerIs1 ? shotZone : keeperZone;
      p2Choice = attackerIs1 ? keeperZone : shotZone;

      let p1Score = duel.p1.score;
      let p2Score = duel.p2.score;
      if (goal) {
        if (duel.attacker === 1) p1Score++; else p2Score++;
      }

      const lastRound = {
        round: duel.round,
        attacker: duel.attacker,
        p1Choice,
        p2Choice,
        shot: shotZone,
        keeper: keeperZone,
        power: esito.power,
        outcome: esito.outcome,
        goal,
        p1Score,
        p2Score,
      };

      // Fine partita: vedi canFinishAtRound per il criterio.
      const finished = canFinishAtRound(duel.round, duel.mode) && p1Score !== p2Score;

      if (finished) {
        let winner: 1 | 2 | 'draw' = 'draw';
        if (p1Score > p2Score) winner = 1;
        if (p2Score > p1Score) winner = 2;

        const reward = winner === 'draw' ? COINS.duelDraw : COINS.duelWin;
        const winnerUid = winner === 1 ? duel.p1.uid : winner === 2 ? duel.p2.uid : null;

        // Va accreditato il profilo del vincitore, non quello di chi ha
        // effettuato questa chiamata: in una sfida PvP la transazione che
        // chiude il round può essere quella dell'uno o dell'altro giocatore
        // (dipende da chi arriva per ultimo), indipendentemente da chi vince.
        //
        // Il pareggio premia entrambi, altrimenti il client mostrerebbe
        // "+25 monete" senza che nessuno riceva nulla (fix pareggio fantasma).
        //
        // Nota: oggi il pareggio non si verifica mai, perché `finished`
        // richiede punteggi diversi e i tiri di spareggio proseguono finché
        // qualcuno non passa avanti. Il ramo resta perché la condizione di fine
        // partita è a un passo dal cambiare (vedi audit 20/08/2026 sul criterio
        // `canFinish`), non perché serva adesso.
        const beneficiari: { uid: string; docId: string; reason: string }[] =
          winner === 'draw'
            ? ([['p1', duel.p1.uid], ['p2', duel.p2.uid]] as const)
                .filter(([, uidBen]) => uidBen && uidBen !== 'bot')
                .map(([role, uidBen]) => ({
                  uid: uidBen,
                  docId: `${uidBen}_penaltyduel_${duelId}_${role}`,
                  reason: 'penalty_duel_draw',
                }))
            : winnerUid && winnerUid !== 'bot'
            ? [{
                uid: winnerUid,
                docId: `${winnerUid}_penaltyduel_${duelId}`,
                reason: 'penalty_duel_win',
              }]
            : [];

        // Le letture devono precedere le scritture della transazione: i profili
        // dei beneficiari servono per applicare il tetto giornaliero.
        const profiliBeneficiari = await Promise.all(
          beneficiari.map(b => tx.get(db.collection('profiles').doc(b.uid)))
        );

        let rewardAccreditato = 0;
        // Il client mostra `duel.reward` dal documento, e solo a chi ha vinto o
        // pareggiato: deve essere ciò che è stato davvero accreditato, non il
        // premio nominale, altrimenti col tetto raggiunto annuncia gettoni mai
        // arrivati. Con un solo vincitore il massimo è esattamente il suo.
        let rewardMostrato = 0;
        beneficiari.forEach((b, i) => {
          const data = profiliBeneficiari[i].data() ?? {};
          const giaOggi = data.duelDate === today ? ((data.duelCoinsToday as number) ?? 0) : 0;
          const accreditato = Math.max(0, Math.min(reward, COINS.duelDailyCap - giaOggi));
          if (b.uid === uid) rewardAccreditato = accreditato;
          rewardMostrato = Math.max(rewardMostrato, accreditato);
          if (accreditato <= 0) return;

          tx.update(db.collection('profiles').doc(b.uid), {
            coins: FieldValue.increment(accreditato),
            coinsEarned: FieldValue.increment(accreditato),
            duelDate: today,
            duelCoinsToday: giaOggi + accreditato,
            updatedAt: FieldValue.serverTimestamp(),
          });
          tx.set(db.collection('wallet_transactions').doc(b.docId), {
            userId: b.uid,
            amount: accreditato,
            reason: b.reason,
            createdAt: FieldValue.serverTimestamp(),
          });
        });

        tx.update(duelRef, {
          p1: { ...duel.p1, score: p1Score },
          p2: { ...duel.p2, score: p2Score },
          phase: 'finished',
          winner,
          reward: rewardMostrato,
          lastRound,
          deadlineAt: now + 60000,
        });
        return {
          ok: true,
          resolved: true,
          finished: true,
          winner,
          p1Score,
          p2Score,
          reward: rewardAccreditato,
        };
      }

      // Setup next round
      const nextRound = duel.round + 1;
      const nextAttacker = attackerForRound(nextRound, duel.mode);
      const nextStart = now;
      const nextDeadline = now + DUEL_ROUND_MS;

      tx.update(duelRef, {
        p1: { ...duel.p1, score: p1Score },
        p2: { ...duel.p2, score: p2Score },
        round: nextRound,
        attacker: nextAttacker,
        p1Choice: null,
        p2Choice: null,
        p1Power: null,
        p2Power: null,
        phase: 'playing',
        startedAt: nextStart,
        deadlineAt: nextDeadline,
        lastRound,
      });
      return { ok: true, resolved: true, finished: false, p1Score, p2Score, goal };
    });
  }

  throw new HttpsError('invalid-argument', 'Azione non valida');
});

// ---------- 9. PULIZIA DUELLI ABBANDONATI (scheduled ogni ora) ----------

/** Quanto si aspetta prima di considerare un duello abbandonato. */
const DUELLO_ATTESA_MAX_MS = 60 * 60 * 1000; // in attesa di un avversario
const DUELLO_INATTIVITA_MAX_MS = 30 * 60 * 1000; // partita iniziata e ferma
const DUELLO_CONSERVAZIONE_MS = 7 * 24 * 60 * 60 * 1000; // storico partite chiuse

/**
 * I duelli non si chiudono da soli: uno creato e mai raggiunto resta in
 * `waiting` per sempre, e uno in cui entrambi smettono di giocare resta in
 * `playing` per sempre. Nessuno li leggeva più, ma restavano lì a crescere.
 *
 * Nota: finché *uno* dei due continua a giocare la partita si risolve da sola
 * (le scelte mancanti diventano casuali alla scadenza del round), quindi qui
 * si chiude solo ciò che è davvero fermo.
 */
export const cleanupPenaltyDuels = onSchedule(
  { schedule: 'every 60 minutes', region: REGION, timeZone: 'Europe/Rome', maxInstances: 1 },
  async () => {
    const now = Date.now();
    const duels = db.collection('penalty_duels');

    const [inAttesa, inCorso, concluse] = await Promise.all([
      duels.where('phase', '==', 'waiting').get(),
      duels.where('phase', '==', 'playing').get(),
      duels.where('phase', '==', 'finished').get(),
    ]);

    const daEliminare: FirebaseFirestore.DocumentReference[] = [];
    const daAbbandonare: FirebaseFirestore.DocumentReference[] = [];

    for (const d of inAttesa.docs) {
      const data = d.data() as PenaltyDuelDoc;
      if (now - data.startedAt > DUELLO_ATTESA_MAX_MS) daEliminare.push(d.ref);
    }
    for (const d of inCorso.docs) {
      const data = d.data() as PenaltyDuelDoc;
      if (now - data.deadlineAt > DUELLO_INATTIVITA_MAX_MS) daAbbandonare.push(d.ref);
    }
    for (const d of concluse.docs) {
      const data = d.data() as PenaltyDuelDoc;
      if (now - data.startedAt > DUELLO_CONSERVAZIONE_MS) daEliminare.push(d.ref);
    }

    if (daAbbandonare.length > 0) {
      const batch = db.batch();
      for (const ref of daAbbandonare) {
        batch.update(ref, {
          phase: 'finished',
          winner: null,
          abandoned: true,
          reward: 0,
        });
      }
      await batch.commit();
    }

    for (let i = 0; i < daEliminare.length; i += 400) {
      const batch = db.batch();
      for (const ref of daEliminare.slice(i, i + 400)) batch.delete(ref);
      await batch.commit();
    }

    logger.info(
      `Pulizia duelli: ${daAbbandonare.length} abbandonati, ${daEliminare.length} eliminati`
    );
  }
);
