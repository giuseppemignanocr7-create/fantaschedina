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
  PrizePool,
  Schedina,
  SchedinaResult,
  Prediction,
} from '@/types';
import { MOCK_MATCHES, getNextMatchdayDeadline } from '@/data/mockData';
import type { MatchOdds } from '@/data/mockData';
import { generateMatchdayOdds } from '@/lib/oddsEngine';
import { fetchNextMatchday, fetchMatchResults, type LiveScore } from '@/services/footballApi';
import {
  getMatchday,
  getMatchdayOdds,
  getCurrentMatchdayNumber,
  subscribeMatchday as subscribeMatchdayDoc,
  getUserSchedinaForMatchday,
  getUserSchedine,
  getRankings,
  getWeeklyRanking,
  schedinaDocToResult,
  profileToParticipant,
  getArcadeRankings,
  type ProfileDoc,
} from '@/lib/db';
import { submitSchedinaFn, callableErrorMessage } from '@/lib/gameApi';
import { MAX_PICKS_PER_SCHEDINA, type PowerUpSelection } from '@/lib/economy';
import { DEFAULT_TOURNAMENT_CONFIG } from '@/lib/scoring';
import { getCached, setCached, invalidate, invalidatePrefix, CACHE_TTL } from '@/lib/cache';

export interface ArcadeRankingEntry {
  rank: number;
  participantId: string;
  username: string;
  coinsEarned: number;
  coins: number;
}

interface AppStore {
  // Auth state (sincronizzato da AuthContext)
  currentUser: Participant | null;
  isAuthenticated: boolean;

  // Tournament state
  currentMatchday: Matchday | null;
  matchOdds: Record<string, MatchOdds>;
  liveScores: Record<string, LiveScore>;
  rankings: RankingEntry[];
  arcadeRankings: ArcadeRankingEntry[];
  weeklyRankings: WeeklyRanking[];
  prizePool: PrizePool;

  // Schedina state
  currentSchedina: Partial<Schedina> | null;
  schedinaHistory: (Schedina | SchedinaResult)[];
  selectedPowerups: PowerUpSelection;

  // UI state
  isLoading: boolean;
  isLoadingOdds: boolean;
  isLoadingRankings: boolean;
  isLoadingHistory: boolean;
  isSubmitting: boolean;
  lastOddsUpdate: Date | null;
  error: string | null;

  // Auth sync (chiamato da App.tsx)
  syncCurrentUser: (profile: ProfileDoc | null) => void;

  // Schedina actions
  updatePrediction: (matchId: string, prediction: Prediction) => void;
  setPowerups: (powerups: PowerUpSelection) => void;
  submitSchedina: () => Promise<void>;
  resetSchedina: () => void;
  unlockSchedina: () => void;
  loadUserSchedina: () => Promise<void>;
  loadSchedinaHistory: () => Promise<void>;

  // Tournament actions
  setCurrentMatchday: (matchday: Matchday) => void;
  loadRankings: () => Promise<void>;
  loadArcadeRankings: () => Promise<void>;
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

// Calcolato dai partecipanti reali in loadRankings (regolamento ufficiale)
const initialPrizePool: PrizePool = {
  totalPool: 0,
  weeklyPool: 0,
  finalPool: DEFAULT_TOURNAMENT_CONFIG.firstPlacePrize + DEFAULT_TOURNAMENT_CONFIG.firstHalfPrize,
  accumulatedPoker: 0,
  accumulatedHighestOdds: 0,
};

function emptyDraft(matchday: number, userId?: string): Partial<Schedina> {
  return {
    participantId: userId ?? '',
    matchday,
    predictions: [],
    isLocked: false,
  };
}

export const useAppStore = create<AppStore>()((set, get) => ({
  // Initial state
  currentUser: null,
  isAuthenticated: false,
  currentMatchday: null,
  matchOdds: {},
  liveScores: {},
  rankings: [],
  arcadeRankings: [],
  weeklyRankings: [],
  prizePool: initialPrizePool,
  currentSchedina: null,
  schedinaHistory: [],
  selectedPowerups: {},
  isLoading: false,
  isLoadingOdds: false,
  isLoadingRankings: false,
  isLoadingHistory: false,
  isSubmitting: false,
  lastOddsUpdate: null,
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
  },

  updatePrediction: (matchId: string, prediction: Prediction) => {
    const { currentSchedina, currentMatchday, currentUser } = get();
    const draft =
      currentSchedina ?? emptyDraft(currentMatchday?.number ?? 1, currentUser?.id);
    if (draft.isLocked) return;
    const existing = draft.predictions ?? [];
    const isNewMatch = !existing.some(p => p.matchId === matchId);
    if (isNewMatch && existing.length >= MAX_PICKS_PER_SCHEDINA) {
      set({ error: `Puoi scegliere al massimo ${MAX_PICKS_PER_SCHEDINA} partite` });
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
    const { currentSchedina, currentUser, currentMatchday, selectedPowerups } = get();
    if (!currentUser) {
      set({ error: 'Devi essere autenticato per inviare la schedina' });
      return;
    }
    if (!currentMatchday) {
      set({ error: 'Nessuna giornata attiva' });
      return;
    }
    const predictions = currentSchedina?.predictions ?? [];
    if (predictions.length !== MAX_PICKS_PER_SCHEDINA) {
      set({ error: `Devi scegliere esattamente ${MAX_PICKS_PER_SCHEDINA} partite` });
      return;
    }

    set({ isSubmitting: true, error: null });
    try {
      // Invio validato server-side (deadline, quote ufficiali, power-up)
      await submitSchedinaFn(predictions, selectedPowerups);
      invalidatePrefix('schedinaHistory_');
      invalidate('rankings');
      set({
        currentSchedina: {
          id: `${currentUser.id}_${currentMatchday.number}`,
          participantId: currentUser.id,
          matchday: currentMatchday.number,
          predictions,
          submittedAt: new Date(),
          isLocked: true,
          powerups: selectedPowerups,
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
      error: null,
    });
  },

  loadUserSchedina: async () => {
    const { currentUser, currentMatchday } = get();
    if (!currentUser || !currentMatchday) return;
    try {
      const saved = await getUserSchedinaForMatchday(currentUser.id, currentMatchday.number);
      if (saved) {
        set({
          currentSchedina: {
            id: saved.id,
            participantId: saved.userId,
            matchday: saved.matchdayNumber,
            predictions: saved.predictions,
            submittedAt: saved.submittedAt?.toDate(),
            isLocked: saved.isLocked,
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
      });
      return;
    }
    set({ isLoadingRankings: true });
    try {
      const ranks = await getRankings();
      setCached('rankings', ranks, CACHE_TTL.rankings);
      const cfg = DEFAULT_TOURNAMENT_CONFIG;
      const n = ranks.length;
      const currentUser = get().currentUser;
      const currentRank = currentUser
        ? ranks.find(r => r.participantId === currentUser.id)?.rank ?? 0
        : 0;
      set({
        rankings: ranks,
        currentUser: currentUser ? { ...currentUser, rank: currentRank } : null,
        isLoadingRankings: false,
        prizePool: {
          totalPool: n * cfg.participationFee,
          weeklyPool: Math.round(n * cfg.weeklyFeeToPool * cfg.weeklyWinnerShare),
          finalPool: cfg.firstPlacePrize + cfg.firstHalfPrize,
          accumulatedPoker: 0,
          accumulatedHighestOdds: 0,
        },
      });
    } catch (e) {
      console.warn('[Store] loadRankings:', e);
      set({ isLoadingRankings: false, error: 'Impossibile caricare la classifica. Riprova.' });
    }
  },

  loadArcadeRankings: async () => {
    const cached = getCached<ReturnType<typeof getArcadeRankings> extends Promise<infer T> ? T : never>('arcadeRankings');
    if (cached) {
      set({ arcadeRankings: cached });
      return;
    }
    try {
      const ranks = await getArcadeRankings();
      setCached('arcadeRankings', ranks, CACHE_TTL.arcadeRankings);
      set({ arcadeRankings: ranks });
    } catch (e) {
      console.warn('[Store] loadArcadeRankings:', e);
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
    set({ isLoadingOdds: true });

    // 1. Fonte di verità: Firestore (scritto dalle Cloud Functions)
    try {
      const currentNumber = await getCurrentMatchdayNumber();
      if (currentNumber != null) {
        const [cached, cachedOdds] = await Promise.all([
          getMatchday(currentNumber),
          getMatchdayOdds(currentNumber),
        ]);
        if (cached && cachedOdds) {
          set({
            currentMatchday: cached,
            matchOdds: cachedOdds,
            liveScores: {},
            isLoadingOdds: false,
            lastOddsUpdate: new Date(),
          });
          await get().loadUserSchedina();
          return;
        }
      }
    } catch (err) {
      console.warn('[Store] loadMatchday Firestore error:', err);
    }

    // 2. Fallback display-only: ESPN diretto (quote locali NON ufficiali;
    //    l'invio le sostituisce comunque con quelle server-side)
    try {
      const apiData = await fetchNextMatchday();
      if (apiData && apiData.matches.length >= 5) {
        set({
          currentMatchday: {
            number: apiData.number,
            season: apiData.season,
            matches: apiData.matches,
            deadline: apiData.deadline,
            status: 'open',
          },
          matchOdds: generateMatchdayOdds(apiData.matches),
          isLoadingOdds: false,
          lastOddsUpdate: new Date(),
        });
        await get().loadUserSchedina();
        return;
      }
    } catch (err) {
      console.warn('[Store] loadMatchday API error:', err);
    }

    // 3. Fallback finale: mock (solo sviluppo)
    if (import.meta.env.DEV) {
      set({
        currentMatchday: {
          number: 1,
          season: '2025-2026',
          matches: MOCK_MATCHES,
          deadline: getNextMatchdayDeadline(),
          status: 'open',
        },
        matchOdds: generateMatchdayOdds(MOCK_MATCHES),
        isLoadingOdds: false,
        lastOddsUpdate: new Date(),
      });
      return;
    }
    set({ currentMatchday: null, matchOdds: {}, isLoadingOdds: false });
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
        };
      });
    } catch (err) {
      console.warn('[Store] refreshLiveScores:', err);
    }
  },

  // ── B: realtime dal doc giornata Firestore (aggiornato da updateLiveScores) ──
  subscribeMatchday: (matchdayNumber: number) =>
    subscribeMatchdayDoc(matchdayNumber, next => {
      if (next) set({ currentMatchday: next });
    }),

  clearError: () => set({ error: null }),
}));
