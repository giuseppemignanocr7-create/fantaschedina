// ============================================
// FANTA SCHEDINA - ECONOMIA DI GIOCO (client)
// Gettoni, power-up e missioni.
// Tenere allineata a functions/src/config.ts (fonte di verità server).
// ============================================

// Numero di partite che ogni utente sceglie (a scelta, dal pool dei campionati attivi).
export const MAX_PICKS_PER_SCHEDINA = 10;

export const COINS = {
  starting: 100,
  perCorrectPrediction: 2,
  bonus9Correct: 50,
  bonus10Correct: 150,
  weeklyWinner: 100,
  quizPerCorrect: 3,
  quizMaxQuestions: 10,
  rigoriPerGoal: 2,
  rigoriMaxShots: 5,
  rigoriDailyCap: 50,
  wheelPrizes: [5, 10, 10, 15, 20, 30, 50, 100],
  sfidaBaseReward: 5,
  sfidaMaxReward: 30,
  sfidaCooldownDays: 7,
  // Memoria Calcio
  memoriaPerLevel: 5,
  memoriaTimeBonus: 1,
  memoriaDailyCap: 40,
  memoriaLevelTimes: [30, 45, 60],
  // Duelli rigori 1v1
  duelWin: 50,
  duelDraw: 25,
  duelDailyCap: 150,
} as const;

export type PowerUpId = 'jolly' | 'shield' | 'insurance' | 'lastminute';

export interface PowerUpInfo {
  id: PowerUpId;
  name: string;
  emoji: string;
  cost: number;
  description: string;
}

export const POWERUPS: Record<PowerUpId, PowerUpInfo> = {
  jolly: {
    id: 'jolly',
    name: 'Jolly Raddoppio',
    emoji: '🃏',
    cost: 200,
    description: 'Raddoppia i punti di un pronostico a tua scelta (se vinto)',
  },
  shield: {
    id: 'shield',
    name: 'Scudo',
    emoji: '🛡️',
    cost: 150,
    description: 'Annulla le penalità delle quote basse per questa giornata',
  },
  insurance: {
    id: 'insurance',
    name: 'Assicurazione',
    emoji: '⭐',
    cost: 120,
    description: 'Con 8/10 corretti ricevi comunque il bonus del 9/10 (×1.2)',
  },
  lastminute: {
    id: 'lastminute',
    name: 'Cambio Last-Minute',
    emoji: '🔄',
    cost: 100,
    description: 'Dopo la deadline cambia 1 pronostico, su una partita non ancora iniziata',
  },
};

// Selezione power-up allegata alla schedina
export interface PowerUpSelection {
  jolly?: string; // matchId
  shield?: boolean;
  insurance?: boolean;
}

// --- MISSIONI ---
export type MissionField =
  | 'matchdaysPlayed'
  | 'perfectSchedine'
  | 'correctPredictions'
  | 'weeklyWins'
  | 'coinsEarned'
  | 'leaguesJoined';

export interface MissionInfo {
  id: string;
  name: string;
  description: string;
  field: MissionField;
  target: number;
  reward: number;
}

export const MISSIONS: MissionInfo[] = [
  { id: 'first_schedina', name: 'Prima Schedina', description: 'Gioca la tua prima giornata', field: 'matchdaysPlayed', target: 1, reward: 50 },
  { id: 'veteran_10', name: 'Veterano', description: 'Partecipa a 10 giornate', field: 'matchdaysPlayed', target: 10, reward: 150 },
  { id: 'veteran_25', name: 'Stakanovista', description: 'Partecipa a 25 giornate', field: 'matchdaysPlayed', target: 25, reward: 300 },
  { id: 'perfect_schedina', name: 'Pronostico Perfetto', description: 'Indovina tutti e 10 i pronostici', field: 'perfectSchedine', target: 1, reward: 500 },
  { id: 'sharp_50', name: 'Occhio Fino', description: 'Indovina 50 pronostici totali', field: 'correctPredictions', target: 50, reward: 100 },
  { id: 'sharp_150', name: 'Veggente', description: 'Indovina 150 pronostici totali', field: 'correctPredictions', target: 150, reward: 250 },
  { id: 'weekly_win_1', name: 'Campione di Giornata', description: 'Vinci una giornata', field: 'weeklyWins', target: 1, reward: 200 },
  { id: 'weekly_win_5', name: 'Dominatore', description: 'Vinci 5 giornate', field: 'weeklyWins', target: 5, reward: 500 },
  { id: 'coins_1000', name: 'Paperone', description: 'Accumula 1000 gettoni totali', field: 'coinsEarned', target: 1000, reward: 100 },
  { id: 'league_member', name: 'Socio Fondatore', description: 'Entra o crea una lega', field: 'leaguesJoined', target: 1, reward: 75 },
];
