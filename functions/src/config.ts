// ============================================
// FANTASCHEDINA FUNCTIONS - CONFIG CONDIVISA
// Economia gettoni, power-up, missioni, torneo.
// Tenere allineata a src/lib/economy.ts del client.
// ============================================

export const TOURNAMENT = {
  minValidOdds: 1.3,
  oddsCap: 5.0,
  penaltyOddsMin: 1.25,
  penaltyMultiplierPerThree: 0.9,
  bonus9Multiplier: 1.2,
  bonus10Multiplier: 1.5,
} as const;

// --- CAMPIONATI / COMPETIZIONI ---
// Catalogo campionati disponibili (slug ESPN soccer). L'admin sceglie quali
// sono "attivi": syncMatchday pesca le partite SOLO dai campionati attivi.
export interface CompetitionDef {
  code: string;
  name: string;
  slug: string;
}

export const COMPETITIONS: CompetitionDef[] = [
  { code: 'ita.1', name: 'Serie A', slug: 'ita.1' },
  { code: 'eng.1', name: 'Premier League', slug: 'eng.1' },
  { code: 'esp.1', name: 'La Liga', slug: 'esp.1' },
  { code: 'ger.1', name: 'Bundesliga', slug: 'ger.1' },
  { code: 'fra.1', name: 'Ligue 1', slug: 'fra.1' },
  { code: 'uefa.champions', name: 'Champions League', slug: 'uefa.champions' },
  { code: 'uefa.europa', name: 'Europa League', slug: 'uefa.europa' },
  { code: 'ita.coppa_italia', name: 'Coppa Italia', slug: 'ita.coppa_italia' },
  // Campionati fuori dal calendario europeo (in corso quando i tornei sopra
  // sono fermi in estate): utili per test reali con partite vere, restano
  // disattivati finché l'admin non li abilita da /admin > Campionati.
  { code: 'bra.1', name: 'Brasileirão', slug: 'bra.1' },
  { code: 'usa.1', name: 'MLS', slug: 'usa.1' },
];

export const DEFAULT_ACTIVE_COMPETITIONS: string[] = ['ita.1'];

// Numero di partite che ogni utente sceglie (a scelta, dal pool dei campionati attivi)
// per comporre la propria schedina.
export const MAX_PICKS_PER_SCHEDINA = 10;


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
