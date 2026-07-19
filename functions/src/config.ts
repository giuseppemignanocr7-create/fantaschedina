// ============================================
// FANTASCHEDINA FUNCTIONS - CONFIG CONDIVISA
// Economia gettoni, power-up, missioni, torneo.
// Tenere allineata a src/lib/economy.ts del client.
// ============================================

export const TOURNAMENT = {
  minValidOdds: 1.3,
  maxPointsPerBet: 50,
  lowOddsThreshold: 1.25,
  lowOddsMaxPoints: 5,
  penaltyPerThree: -15,
  bonus9Correct: 20,
  bonus10Correct: 50,
  minOddsForPoker: 2.0,
  minOddsForHighestOddsPrize: 2.0,
} as const;

// --- GETTONI ---
export const COINS = {
  starting: 100,
  perCorrectPrediction: 2,
  bonus9Correct: 50,
  bonus10Correct: 150,
  weeklyWinner: 100,
  // Minigiochi
  quizPerCorrect: 3, // max 10 domande → 30 gettoni
  quizMaxQuestions: 10,
  rigoriPerGoal: 2, // max 5 tiri → 10 gettoni (gocce!)
  rigoriMaxShots: 5,
  rigoriDailyCap: 50, // max gettoni cumulabili al giorno da rigori
  wheelPrizes: [5, 10, 10, 15, 20, 30, 50, 100] as number[], // pesi uniformi su 8 spicchi
  // Sfide 1vs1
  sfidaBaseReward: 5, // premio base per vittoria
  sfidaMaxReward: 30, // premio massimo
  sfidaCooldownDays: 7, // una sfida per coppia per settimana
  // Memoria Calcio
  memoriaPerLevel: 5, // gettoni per livello completato
  memoriaTimeBonus: 1, // gettoni per 5 secondi rimanenti
  memoriaDailyCap: 40, // max gettoni al giorno da memoria
} as const;

// --- POWER-UP ---
export interface PowerUpDef {
  id: 'jolly' | 'shield' | 'insurance' | 'lastminute';
  cost: number;
}

export const POWERUPS: Record<PowerUpDef['id'], PowerUpDef> = {
  jolly: { id: 'jolly', cost: 200 },
  shield: { id: 'shield', cost: 150 },
  insurance: { id: 'insurance', cost: 120 },
  lastminute: { id: 'lastminute', cost: 100 },
};

// Selezione power-up salvata sulla schedina
export interface PowerUpSelection {
  jolly?: string; // matchId del pronostico da raddoppiare
  shield?: boolean;
  insurance?: boolean;
}

// --- MISSIONI ---
export interface MissionDef {
  id: string;
  field:
    | 'matchdaysPlayed'
    | 'perfectSchedine'
    | 'correctPredictions'
    | 'weeklyWins'
    | 'coinsEarned'
    | 'leaguesJoined';
  target: number;
  reward: number;
}

export const MISSIONS: MissionDef[] = [
  { id: 'first_schedina', field: 'matchdaysPlayed', target: 1, reward: 50 },
  { id: 'veteran_10', field: 'matchdaysPlayed', target: 10, reward: 150 },
  { id: 'veteran_25', field: 'matchdaysPlayed', target: 25, reward: 300 },
  { id: 'perfect_schedina', field: 'perfectSchedine', target: 1, reward: 500 },
  { id: 'sharp_50', field: 'correctPredictions', target: 50, reward: 100 },
  { id: 'sharp_150', field: 'correctPredictions', target: 150, reward: 250 },
  { id: 'weekly_win_1', field: 'weeklyWins', target: 1, reward: 200 },
  { id: 'weekly_win_5', field: 'weeklyWins', target: 5, reward: 500 },
  { id: 'coins_1000', field: 'coinsEarned', target: 1000, reward: 100 },
  { id: 'league_member', field: 'leaguesJoined', target: 1, reward: 75 },
];
