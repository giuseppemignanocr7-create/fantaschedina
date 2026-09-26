// ============================================
// FANTA SCHEDINA - STATE MANAGEMENT (Zustand)
// Auth handled by AuthContext (Firebase) — store sincronizza profilo,
// gestisce giornata corrente, schedina in compilazione, classifica.
// ============================================

import { create } from 'zustand';
import type {
  Participant,
  Matchday,
  RankingEntry,
  WeeklyRanking,
  Schedina,
  SchedinaResult,
  Prediction,
} from '@/types';
import type { MatchOdds } from '@/data/mockData';
import { fetchMatchResults, type LiveScore } from '@/services/footballApi';
import {
  getMatchdayCircuito,
  getCurrentMatchdayNumber,
  subscribeMatchday as subscribeMatchdayDoc,
  getUserSchedinaForMatchday,
  getUserSchedine,
  getRankings,
  getWeeklyRanking,
  schedinaDocToResult,
  profileToParticipant,
  type MatchdayCircuito,
  type ProfileDoc,
} from '@/lib/db';
import {
  submitSchedinaFn,
  cancelSchedinaFn,
  changePredictionFn,
  callableErrorMessage,
} from '@/lib/gameApi';
import { type PowerUpSelection } from '@/lib/economy';
import { getLeague } from '@/lib/leagues';
import { pickRichieste } from '@/lib/pickRichieste';
import { quotaGiocabile, quoteAncoraAperte } from '@/lib/markets';

/**
 * Pronostici richiesti in questo momento: come il server, si contano solo le
 * partite quotate e non ancora iniziate.
 */
function richiesteAdesso(
  matchday: Matchday | null,
  odds: Record<string, MatchOdds>
): number {
  return pickRichieste(quoteAncoraAperte(matchday?.matches, odds, Date.now()));
}
import { getCached, setCached, invalidate, invalidatePrefix, CACHE_TTL } from '@/lib/cache';

/** Esito della copia dalla schedina generale verso quella di una lega. */
export interface EsitoCopia {
  copiati: number;
  /** Pronostici lasciati fuori: mercato o esito non quotato (o troppo basso) nella lega. */
  scartati: number;
}

/** `bozza`: c'e' una schedina non inviata che il cambio di circuito cancellerebbe. */
export type EsitoCambioCircuito = 'ok' | 'bozza';

interface AppStore {
  // Auth state (sincronizzato da AuthContext)
  currentUser: Participant | null;
  isAuthenticated: boolean;

  // Tournament state
  currentMatchday: Matchday | null;
  /** Quote del circuito in compilazione (generale o agenzia della lega). */
  matchOdds: Record<string, MatchOdds>;
  /** La lega corrente ha un'agenzia che non ha ancora pubblicato le quote. */
  agenziaSenzaQuote: boolean;
  liveScores: Record<string, LiveScore>;
  /** Quando il client ha letto per l'ultima volta i punteggi da ESPN (ms). */
  liveFetchedAt: number;
  rankings: RankingEntry[];
  weeklyRankings: WeeklyRanking[];

  // Schedina state
  currentSchedina: Partial<Schedina> | null;
  schedinaHistory: (Schedina | SchedinaResult)[];
  selectedPowerups: PowerUpSelection;
  /**
   * Circuito in compilazione: null = classifica generale, altrimenti l'id
   * della lega. Ogni circuito ha la sua schedina sulla stessa giornata.
   */
  currentLeagueId: string | null;

  // UI state
  isLoading: boolean;
  isLoadingOdds: boolean;
  isLoadingRankings: boolean;
  isLoadingHistory: boolean;
  isSubmitting: boolean;
  lastOddsUpdate: Date | null;
  /** Errore nel caricare la giornata: i dati di prima restano a schermo. */
  matchdayError: string | null;
  /** Errore nel caricare la classifica generale. */
  rankingsError: string | null;
  error: string | null;

  // Auth sync (chiamato da App.tsx)
  syncCurrentUser: (profile: ProfileDoc | null) => void;

  // Schedina actions
  updatePrediction: (matchId: string, prediction: Prediction) => void;
  setPowerups: (powerups: PowerUpSelection) => void;
  submitSchedina: () => Promise<void>;
  resetSchedina: () => void;
  unlockSchedina: () => void;
  cancelSchedina: () => Promise<void>;
  applyLastMinuteChange: (
    matchId: string,
    betType: string,
    outcome: string
  ) => Promise<boolean>;
  /**
   * Cambia circuito e carica la schedina corrispondente. Se c'e' una bozza non
   * inviata risponde `bozza` e non cambia nulla, a meno di `scartaBozza`.
   */
  setCircuito: (
    leagueId: string | null,
    opzioni?: { scartaBozza?: boolean }
  ) => Promise<EsitoCambioCircuito>;
  /** Ricopia i pronostici della schedina generale in quella in compilazione. */
  copiaDaGenerale: () => Promise<EsitoCopia | null>;
  loadUserSchedina: () => Promise<void>;
  loadSchedinaHistory: () => Promise<void>;

  // Tournament actions
  setCurrentMatchday: (matchday: Matchday) => void;
  loadRankings: () => Promise<void>;
  loadWeeklyRanking: () => Promise<void>;
  loadMatchday: () => Promise<void>;
  refreshOdds: () => Promise<void>;
  /** A: aggiorna punteggi live reali da ESPN e li fonde nella giornata corrente. */
  refreshLiveScores: () => Promise<void>;
  /** B: sottoscrive il doc giornata su Firestore (realtime). Ritorna l'unsubscribe. */
  subscribeMatchday: (matchdayNumber: number) => () => void;

  // UI
  clearError: () => void;
}

function emptyDraft(matchday: number, userId?: string): Partial<Schedina> {
  return {
    participantId: userId ?? '',
    matchday,
    predictions: [],
    isLocked: false,
  };
}

/** Una schedina con pronostici non ancora inviati (nuova o sbloccata per modifica). */
function haBozza(s: Partial<Schedina> | null): boolean {
  return !!s && !s.isLocked && (s.predictions?.length ?? 0) > 0;
}

/**
 * Agenzia di ogni lega gia' letta. Il palinsesto si rilegge ogni due minuti:
 * rileggere anche la lega a ogni giro sarebbe una lettura sprecata. Si
 * aggiorna comunque a ogni cambio di circuito.
 */
const agenziaDellaLega = new Map<string, string | null>();

async function agenziaDelCircuito(leagueId: string | null, rileggi: boolean): Promise<string | null> {
  if (!leagueId) return null;
  if (!rileggi && agenziaDellaLega.has(leagueId)) return agenziaDellaLega.get(leagueId) ?? null;
  const lega = await getLeague(leagueId);
  const agenzia = lega?.bookmaker ?? null;
  agenziaDellaLega.set(leagueId, agenzia);
  return agenzia;
}

/**
 * Giornata e quote del circuito indicato: unica strada per leggerle, cosi'
 * setCircuito, loadMatchday e refreshOdds mostrano sempre le quote con cui il
 * server valutera' la schedina (quelle dell'agenzia, per una lega che ne ha una).
 */
async function caricaCircuito(
  numero: number,
  leagueId: string | null,
  rileggiLega = false
): Promise<MatchdayCircuito | null> {
  const agenzia = await agenziaDelCircuito(leagueId, rileggiLega);
  return getMatchdayCircuito(numero, agenzia);
}

/**
 * Ogni richiesta di giornata/quote prende un numero: arriva a destinazione solo
 * l'ultima. Senza, passando in fretta da una lega all'altra le quote della
 * prima potevano arrivare dopo e restare sulla schedina della seconda.
 */
let ultimaRichiesta = 0;

export const useAppStore = create<AppStore>()((set, get) => ({
  // Initial state
  currentUser: null,
  isAuthenticated: false,
  currentMatchday: null,
  matchOdds: {},
  agenziaSenzaQuote: false,
  liveScores: {},
  liveFetchedAt: 0,
  rankings: [],
  weeklyRankings: [],
  currentSchedina: null,
  schedinaHistory: [],
  selectedPowerups: {},
  currentLeagueId: null,
  isLoading: false,
  isLoadingOdds: false,
  isLoadingRankings: false,
  isLoadingHistory: false,
  isSubmitting: false,
  lastOddsUpdate: null,
  matchdayError: null,
  rankingsError: null,
  error: null,

  syncCurrentUser: (profile: ProfileDoc | null) => {
    if (!profile) {
      set({ currentUser: null, isAuthenticated: false, currentSchedina: null });
      return;
    }
    const participant = profileToParticipant(profile);
    const rank = get().rankings.find(r => r.participantId === participant.id)?.rank ?? 0;
    set({
      currentUser: { ...participant, rank },
      isAuthenticated: true,
      currentSchedina:
        get().currentSchedina ??
        emptyDraft(get().currentMatchday?.number ?? 1, participant.id),
    });
    // Carica la schedina salvata dell'utente ora che abbiamo il profile
    if (get().currentMatchday) {
      get().loadUserSchedina();
    }
  },

  updatePrediction: (matchId: string, prediction: Prediction) => {
    const { currentSchedina, currentMatchday, currentUser, matchOdds } = get();
    const draft =
      currentSchedina ?? emptyDraft(currentMatchday?.number ?? 1, currentUser?.id);
    if (draft.isLocked) return;
    const richieste = richiesteAdesso(currentMatchday, matchOdds);
    const existing = draft.predictions ?? [];
    const isNewMatch = !existing.some(p => p.matchId === matchId);
    if (isNewMatch && existing.length >= richieste) {
      set({ error: `Puoi scegliere al massimo ${richieste} partite` });
      return;
    }
    const updated = existing.filter(p => p.matchId !== matchId);
    updated.push(prediction);
    set({ currentSchedina: { ...draft, predictions: updated } });
  },

  setPowerups: (powerups: PowerUpSelection) => {
    set({ selectedPowerups: powerups });
  },

  submitSchedina: async () => {
    const { currentSchedina, currentUser, currentMatchday, selectedPowerups, matchOdds } = get();
    if (!currentUser) {
      set({ error: 'Devi essere autenticato per inviare la schedina' });
      return;
    }
    if (!currentMatchday) {
      set({ error: 'Nessuna giornata attiva' });
      return;
    }
    const richieste = richiesteAdesso(currentMatchday, matchOdds);
    if (richieste === 0) {
      set({ error: 'Nessuna partita quotata: la schedina non si può ancora giocare' });
      return;
    }
    const predictions = currentSchedina?.predictions ?? [];
    if (predictions.length !== richieste) {
      set({ error: `Devi scegliere esattamente ${richieste} partite` });
      return;
    }

    const { currentLeagueId } = get();
    set({ isSubmitting: true, error: null });
    try {
      // Invio validato server-side (deadline, quote ufficiali, power-up)
      await submitSchedinaFn(predictions, selectedPowerups, currentLeagueId);
      invalidatePrefix('schedinaHistory_');
      invalidate('rankings');
      set({
        currentSchedina: {
          id: currentLeagueId
            ? `${currentUser.id}_${currentMatchday.number}_${currentLeagueId}`
            : `${currentUser.id}_${currentMatchday.number}`,
          participantId: currentUser.id,
          matchday: currentMatchday.number,
          predictions,
          submittedAt: new Date(),
          isLocked: true,
          powerups: selectedPowerups,
          lastMinuteUsed: false,
        },
        selectedPowerups: {},
        isSubmitting: false,
      });
    } catch (e) {
      set({ error: callableErrorMessage(e), isSubmitting: false });
    }
  },

  resetSchedina: () => {
    const { currentMatchday, currentUser, currentSchedina } = get();
    if (currentSchedina?.isLocked) return;
    set({
      currentSchedina: emptyDraft(currentMatchday?.number ?? 1, currentUser?.id),
      error: null,
    });
  },

  unlockSchedina: () => {
    const { currentSchedina } = get();
    if (!currentSchedina?.isLocked) return;
    set({
      currentSchedina: { ...currentSchedina, isLocked: false },
      // Si riparte dai power-up gia' allegati: il server rimborsa i vecchi e
      // addebita i nuovi, quindi lasciarli com'erano non costa nulla.
      selectedPowerups: currentSchedina.powerups ?? {},
      error: null,
    });
  },

  cancelSchedina: async () => {
    const { currentUser, currentMatchday } = get();
    if (!currentUser || !currentMatchday) return;
    set({ isSubmitting: true, error: null });
    try {
      await cancelSchedinaFn(get().currentLeagueId);
      invalidatePrefix('schedinaHistory_');
      invalidate('rankings');
      set({
        currentSchedina: emptyDraft(currentMatchday.number, currentUser.id),
        selectedPowerups: {},
        isSubmitting: false,
      });
    } catch (e) {
      set({ error: callableErrorMessage(e), isSubmitting: false });
    }
  },

  /**
   * Power-up "Cambio Last-Minute": cambia un pronostico dopo la deadline,
   * a pagamento e una volta sola. Il costo e il consumo li applica il server
   * (callable `changePrediction`); qui si rilegge la schedina autorevole
   * invece di indovinare la nuova quota lato client.
   */
  applyLastMinuteChange: async (matchId, betType, outcome) => {
    const { currentUser, currentMatchday } = get();
    if (!currentUser || !currentMatchday) return false;
    set({ isSubmitting: true, error: null });
    try {
      await changePredictionFn(matchId, betType, outcome, get().currentLeagueId);
      invalidatePrefix('schedinaHistory_');
      await get().loadUserSchedina();
      set({ isSubmitting: false });
      return true;
    } catch (e) {
      set({ error: callableErrorMessage(e), isSubmitting: false });
      return false;
    }
  },

  /**
   * Passa da un circuito all'altro. I power-up in selezione non seguono: si
   * acquistano per singola schedina, quindi trascinarli sarebbe un addebito a
   * sorpresa sul circuito sbagliato. Una bozza non inviata andrebbe persa:
   * senza `scartaBozza` il cambio si ferma e la UI chiede conferma.
   */
  setCircuito: async (leagueId, opzioni) => {
    if (get().currentLeagueId === leagueId) return 'ok';
    if (haBozza(get().currentSchedina) && !opzioni?.scartaBozza) return 'bozza';
    const richiesta = ++ultimaRichiesta;
    const { currentMatchday, currentUser } = get();
    set({
      currentLeagueId: leagueId,
      selectedPowerups: {},
      currentSchedina: emptyDraft(currentMatchday?.number ?? 1, currentUser?.id),
      // Le quote del circuito di prima non valgono qui: meglio nessuna quota
      // per un attimo che una quota dell'agenzia sbagliata.
      matchOdds: {},
      agenziaSenzaQuote: false,
      error: null,
    });

    if (currentMatchday) {
      set({ isLoadingOdds: true });
      try {
        const circuito = await caricaCircuito(currentMatchday.number, leagueId, true);
        if (richiesta !== ultimaRichiesta || get().currentLeagueId !== leagueId) return 'ok';
        set({
          matchOdds: circuito?.odds ?? {},
          agenziaSenzaQuote: circuito?.agenziaSenzaQuote ?? false,
          lastOddsUpdate: new Date(),
          isLoadingOdds: false,
          matchdayError: null,
        });
      } catch (err) {
        console.warn('[Store] quote del circuito:', err);
        if (richiesta !== ultimaRichiesta) return 'ok';
        set({
          isLoadingOdds: false,
          matchdayError: 'Non siamo riusciti a caricare le quote di questa classifica.',
        });
      }
    }

    await get().loadUserSchedina();
    return 'ok';
  },

  /**
   * Copia i pronostici della schedina generale in quella in compilazione.
   * Serve a chi gioca più leghe: dieci pronostici per circuito, a mano, sono
   * un lavoro inutile quando si vuole giocare la stessa schedina ovunque.
   * Le quote pero' sono quelle della lega (la sua agenzia puo' pagare
   * diverso): ogni pronostico riprende la quota della lega, e quelli che la
   * lega non quota — o quota sotto il minimo — restano fuori.
   */
  copiaDaGenerale: async () => {
    const { currentUser, currentMatchday, currentSchedina, currentLeagueId } = get();
    if (!currentUser || !currentMatchday) return null;
    if (!currentLeagueId) {
      set({ error: 'Sei già sulla schedina generale' });
      return null;
    }
    if (currentSchedina?.isLocked) {
      set({ error: 'Schedina già inviata: sbloccala prima di ricopiarla' });
      return null;
    }
    try {
      const generale = await getUserSchedinaForMatchday(
        currentUser.id,
        currentMatchday.number,
        null
      );
      if (get().currentLeagueId !== currentLeagueId) return null;
      if (!generale || generale.predictions.length === 0) {
        set({ error: 'Non hai ancora compilato la schedina generale' });
        return null;
      }
      const { matchOdds } = get();
      const richieste = richiesteAdesso(currentMatchday, matchOdds);
      const copiati: Prediction[] = [];
      for (const p of generale.predictions) {
        if (copiati.length >= richieste) break;
        const quota = quotaGiocabile(matchOdds[p.matchId], p.betType, p.outcome);
        if (quota == null) continue;
        copiati.push({ ...p, odds: quota });
      }
      const scartati = generale.predictions.length - copiati.length;
      if (copiati.length === 0) {
        set({ error: 'Nessun pronostico della generale è quotato in questa lega' });
        return null;
      }
      set({
        currentSchedina: {
          ...(get().currentSchedina ?? emptyDraft(currentMatchday.number, currentUser.id)),
          predictions: copiati,
        },
        error: null,
      });
      return { copiati: copiati.length, scartati };
    } catch (e) {
      set({ error: callableErrorMessage(e) });
      return null;
    }
  },

  loadUserSchedina: async () => {
    const { currentUser, currentMatchday, currentLeagueId } = get();
    if (!currentUser || !currentMatchday) return;
    try {
      const saved = await getUserSchedinaForMatchday(
        currentUser.id,
        currentMatchday.number,
        currentLeagueId
      );
      // Nel frattempo si e' cambiato circuito: questa schedina non c'entra piu'.
      if (get().currentLeagueId !== currentLeagueId) return;
      if (saved) {
        set({
          currentSchedina: {
            id: saved.id,
            participantId: saved.userId,
            matchday: saved.matchdayNumber,
            predictions: saved.predictions,
            submittedAt: saved.submittedAt?.toDate(),
            isLocked: saved.isLocked,
            powerups: saved.powerups,
            lastMinuteUsed: saved.lastMinuteUsed,
          },
        });
      } else if (
        !get().currentSchedina ||
        get().currentSchedina?.matchday !== currentMatchday.number
      ) {
        set({
          currentSchedina: emptyDraft(currentMatchday.number, currentUser.id),
        });
      }
    } catch (e) {
      console.warn('[Store] loadUserSchedina:', e);
    }
  },

  loadSchedinaHistory: async () => {
    const { currentUser } = get();
    if (!currentUser) return;
    const cacheKey = `schedinaHistory_${currentUser.id}`;
    const cached = getCached<(Schedina | SchedinaResult)[]>(cacheKey);
    if (cached) {
      set({ schedinaHistory: cached, isLoadingHistory: false });
      return;
    }
    set({ isLoadingHistory: true });
    try {
      const docs = await getUserSchedine(currentUser.id);
      const history = docs.map(schedinaDocToResult);
      setCached(cacheKey, history, CACHE_TTL.schedinaHistory);
      set({
        schedinaHistory: history,
        isLoadingHistory: false,
      });
    } catch (e) {
      console.warn('[Store] loadSchedinaHistory:', e);
      set({ isLoadingHistory: false });
    }
  },

  setCurrentMatchday: (matchday: Matchday) => {
    set({ currentMatchday: matchday });
  },

  loadRankings: async () => {
    const cached = getCached<ReturnType<typeof getRankings> extends Promise<infer T> ? T : never>('rankings');
    if (cached) {
      const currentUser = get().currentUser;
      const currentRank = currentUser
        ? cached.find(r => r.participantId === currentUser.id)?.rank ?? 0
        : 0;
      set({
        rankings: cached,
        currentUser: currentUser ? { ...currentUser, rank: currentRank } : null,
        isLoadingRankings: false,
        rankingsError: null,
      });
      return;
    }
    set({ isLoadingRankings: true, rankingsError: null });
    try {
      const ranks = await getRankings();
      setCached('rankings', ranks, CACHE_TTL.rankings);
      const currentUser = get().currentUser;
      const currentRank = currentUser
        ? ranks.find(r => r.participantId === currentUser.id)?.rank ?? 0
        : 0;
      set({
        rankings: ranks,
        currentUser: currentUser ? { ...currentUser, rank: currentRank } : null,
        isLoadingRankings: false,
      });
    } catch (e) {
      console.warn('[Store] loadRankings:', e);
      set({
        isLoadingRankings: false,
        rankingsError: 'Impossibile caricare la classifica. Riprova.',
      });
    }
  },

  loadWeeklyRanking: async () => {
    const { currentMatchday } = get();
    if (!currentMatchday) return;
    const cacheKey = `weeklyRanking_${currentMatchday.number}`;
    const cached = getCached<ReturnType<typeof getWeeklyRanking> extends Promise<infer T> ? T : never>(cacheKey);
    if (cached) {
      set({ weeklyRankings: [cached] });
      return;
    }
    try {
      const weekly = await getWeeklyRanking(currentMatchday.number);
      setCached(cacheKey, weekly, CACHE_TTL.weeklyRanking);
      set({ weeklyRankings: [weekly] });
    } catch (e) {
      console.warn('[Store] loadWeeklyRanking:', e);
    }
  },

  loadMatchday: async () => {
    const richiesta = ++ultimaRichiesta;
    const leagueId = get().currentLeagueId;
    set({ isLoadingOdds: true });

    // Fonte di verità: Firestore (scritto dalle Cloud Functions). Nessun
    // ripiego che fabbrica quote: se Firestore non risponde si tiene quello
    // che c'era e si offre "Riprova" (23/09/2026: prima si generavano quote
    // con un motore di calcolo, numeri inventati mostrati come del bookmaker).
    try {
      const currentNumber = await getCurrentMatchdayNumber();
      const circuito =
        currentNumber != null ? await caricaCircuito(currentNumber, leagueId) : null;
      if (richiesta !== ultimaRichiesta || get().currentLeagueId !== leagueId) return;
      if (!circuito) {
        // Nessuna giornata pubblicata: non e' un errore, e' che non ce n'e'.
        set({
          currentMatchday: null,
          matchOdds: {},
          agenziaSenzaQuote: false,
          isLoadingOdds: false,
          matchdayError: null,
        });
        return;
      }
      const stessaGiornata = get().currentMatchday?.number === circuito.matchday.number;
      set({
        currentMatchday: circuito.matchday,
        matchOdds: circuito.odds,
        agenziaSenzaQuote: circuito.agenziaSenzaQuote,
        ...(stessaGiornata ? {} : { liveScores: {} }),
        isLoadingOdds: false,
        lastOddsUpdate: new Date(),
        matchdayError: null,
      });
      // Una schedina gia' in mano per questa giornata non si rilegge: si
      // perderebbero le modifiche in corso a ogni aggiornamento delle quote.
      if (!stessaGiornata || !get().currentSchedina?.matchday) {
        await get().loadUserSchedina();
      }
    } catch (err) {
      console.warn('[Store] loadMatchday Firestore error:', err);
      if (richiesta !== ultimaRichiesta) return;
      set({
        isLoadingOdds: false,
        matchdayError: 'Non siamo riusciti a caricare la giornata. Controlla la connessione e riprova.',
      });
    }
  },

  refreshOdds: async () => {
    await get().loadMatchday();
  },

  // ── A: punteggi live reali da ESPN (display), fusi nella giornata ──
  refreshLiveScores: async () => {
    const md = get().currentMatchday;
    if (!md || md.matches.length === 0) return;
    const now = Date.now();
    const inLiveWindow = md.matches.some(m => {
      const kickoff = new Date(m.scheduledAt).getTime();
      return (
        m.status === 'live' ||
        (now >= kickoff - 5 * 60 * 1000 && now <= kickoff + 4 * 60 * 60 * 1000)
      );
    });
    if (!inLiveWindow) return;
    try {
      const scores = await fetchMatchResults(md.matches);
      if (scores.size === 0) return;
      const fetchedScores = Object.fromEntries(scores) as Record<string, LiveScore>;
      set(state => {
        const current = state.currentMatchday;
        if (!current || current.number !== md.number) return {};
        const matches = current.matches.map(m => {
          const score = scores.get(m.id);
          if (!score) return m;
          if (score.status === 'scheduled') {
            return m.status === 'scheduled' ? { ...m, status: score.status } : m;
          }
          return {
            ...m,
            status: score.status,
            result: {
              homeGoals: score.homeGoals,
              awayGoals: score.awayGoals,
              outcome: score.outcome,
              ...(score.htHomeGoals != null && score.htAwayGoals != null
                ? { htHomeGoals: score.htHomeGoals, htAwayGoals: score.htAwayGoals }
                : {}),
            },
          };
        });
        return {
          currentMatchday: { ...current, matches },
          liveScores: { ...state.liveScores, ...fetchedScores },
          liveFetchedAt: Date.now(),
        };
      });
    } catch (err) {
      console.warn('[Store] refreshLiveScores:', err);
    }
  },

  // ── B: realtime dal doc giornata Firestore (aggiornato da updateLiveScores) ──
  // Il doc lo scrive updateLiveScores ogni 2 minuti: i suoi risultati sono
  // per forza piu' vecchi di quelli che il client ha appena letto da ESPN
  // (ogni 30 s). Prima ogni snapshot sovrascriveva tutto e il punteggio
  // tornava indietro fino al giro successivo: in campo sembrava una
  // differita di 3-4 minuti. Ora status e risultato delle partite restano
  // quelli del client finche' la sua lettura e' recente; il resto del doc
  // (quote, scadenza, stato giornata) passa sempre.
  subscribeMatchday: (matchdayNumber: number) =>
    subscribeMatchdayDoc(matchdayNumber, next => {
      if (!next) return;
      set(state => {
        const prev = state.currentMatchday;
        const clientIsFresh = Date.now() - state.liveFetchedAt < 3 * 60 * 1000;
        if (!prev || prev.number !== next.number || !clientIsFresh) {
          return { currentMatchday: next };
        }
        const mine = new Map(prev.matches.map(m => [m.id, m]));
        const matches = next.matches.map(m => {
          const c = mine.get(m.id);
          return c && c.status !== 'scheduled' ? { ...m, status: c.status, result: c.result } : m;
        });
        return { currentMatchday: { ...next, matches } };
      });
    }),

  clearError: () => set({ error: null }),
}));
