// ============================================
// FANTA SCHEDINA - STATE MANAGEMENT (Zustand)
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  Participant, 
  Matchday, 
  RankingEntry, 
  WeeklyRanking, 
  PrizePool,
  Schedina,
  SchedinaResult,
  Prediction
} from '@/types';
import { MOCK_MATCHES, MOCK_RANKINGS } from '@/data/mockData';
import { 
  loginUser, 
  registerUser, 
  logoutUser, 
  getCurrentUser,
  type AuthResult 
} from '@/lib/auth';

interface AppStore {
  // Auth state
  currentUser: Participant | null;
  isAuthenticated: boolean;
  authError: string | null;
  
  // Tournament state
  currentMatchday: Matchday | null;
  rankings: RankingEntry[];
  weeklyRankings: WeeklyRanking[];
  prizePool: PrizePool;
  
  // Schedina state
  currentSchedina: Partial<Schedina> | null;
  schedinaHistory: SchedinaResult[];
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Auth Actions
  login: (email: string, password: string) => AuthResult;
  register: (email: string, username: string, password: string) => AuthResult;
  logout: () => void;
  checkAuth: () => void;
  clearAuthError: () => void;
  
  // Other Actions
  setCurrentMatchday: (matchday: Matchday) => void;
  updatePrediction: (matchId: string, prediction: Prediction) => void;
  submitSchedina: () => void;
  loadRankings: () => void;
  clearError: () => void;
}

const initialPrizePool: PrizePool = {
  totalPool: 1250,
  weeklyPool: 150,
  finalPool: 800,
  accumulatedPoker: 60,
  accumulatedHighestOdds: 0,
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentUser: getCurrentUser(),
      isAuthenticated: getCurrentUser() !== null,
      authError: null,
      currentMatchday: {
        number: 18,
        season: '2025-2026',
        matches: MOCK_MATCHES,
        deadline: new Date('2026-12-31T23:59:00'),
        status: 'open',
      },
      rankings: MOCK_RANKINGS,
      weeklyRankings: [],
      prizePool: initialPrizePool,
      currentSchedina: null,
      schedinaHistory: [],
      isLoading: false,
      error: null,

      // Auth Actions
      login: (email: string, password: string) => {
        const result = loginUser(email, password);
        if (result.success && result.user) {
          set({ 
            currentUser: result.user, 
            isAuthenticated: true,
            authError: null,
            currentSchedina: {
              participantId: result.user.id,
              matchday: get().currentMatchday?.number || 1,
              predictions: [],
              isLocked: false,
            }
          });
        } else {
          set({ authError: result.error || 'Errore di login' });
        }
        return result;
      },

      register: (email: string, username: string, password: string) => {
        const result = registerUser(email, username, password);
        if (result.success && result.user) {
          set({ 
            currentUser: result.user, 
            isAuthenticated: true,
            authError: null,
            currentSchedina: {
              participantId: result.user.id,
              matchday: get().currentMatchday?.number || 1,
              predictions: [],
              isLocked: false,
            }
          });
        } else {
          set({ authError: result.error || 'Errore di registrazione' });
        }
        return result;
      },

      logout: () => {
        logoutUser();
        set({ 
          currentUser: null, 
          isAuthenticated: false,
          authError: null,
          currentSchedina: null 
        });
      },

      checkAuth: () => {
        const user = getCurrentUser();
        if (user) {
          set({ 
            currentUser: user, 
            isAuthenticated: true,
            currentSchedina: {
              participantId: user.id,
              matchday: get().currentMatchday?.number || 1,
              predictions: [],
              isLocked: false,
            }
          });
        } else {
          set({ currentUser: null, isAuthenticated: false });
        }
      },

      clearAuthError: () => {
        set({ authError: null });
      },

      setCurrentMatchday: (matchday: Matchday) => {
        set({ currentMatchday: matchday });
      },

      updatePrediction: (matchId: string, prediction: Prediction) => {
        const { currentSchedina } = get();
        if (!currentSchedina) return;

        const existingPredictions = currentSchedina.predictions || [];
        const updatedPredictions = existingPredictions.filter(p => p.matchId !== matchId);
        updatedPredictions.push(prediction);

        set({
          currentSchedina: {
            ...currentSchedina,
            predictions: updatedPredictions,
          }
        });
      },

      submitSchedina: () => {
        const { currentSchedina, currentUser, currentMatchday } = get();
        if (!currentSchedina || !currentUser || !currentMatchday) return;

        if ((currentSchedina.predictions?.length || 0) < 15) {
          set({ error: 'Devi completare tutti i 15 pronostici' });
          return;
        }

        const submittedSchedina: Schedina = {
          id: `schedina-${Date.now()}`,
          participantId: currentUser.id,
          matchday: currentMatchday.number,
          predictions: currentSchedina.predictions as Prediction[],
          submittedAt: new Date(),
          isLocked: true,
        };

        set({
          currentSchedina: {
            ...submittedSchedina,
            isLocked: true,
          },
          error: null,
        });

        console.log('Schedina inviata:', submittedSchedina);
      },

      loadRankings: () => {
        set({ rankings: MOCK_RANKINGS });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'fantaschedina-storage',
      partialize: (state) => ({
        currentSchedina: state.currentSchedina,
      }),
    }
  )
);
