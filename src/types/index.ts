// ============================================
// FANTA SCHEDINA - DOMAIN TYPES
// Sistema di tipi TypeScript per il dominio
// ============================================

// === UTENTE ===
export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  isActive: boolean;
  avatarUrl?: string;
  role?: 'admin' | 'user';
}

export interface Participant extends User {
  totalPoints: number;
  weeklyPoints: number;
  rank: number;
  paidWeeks: number;
  joinedMatchday?: number;
  entryFee?: number;
  startingPoints?: number;
  coins: number;
  coinsEarned: number;
}

// === PARTITA ===
export type MatchOutcome = '1' | 'X' | '2';
export type OverUnder = 'OVER' | 'UNDER';
export type GoalNoGoal = 'GG' | 'NG';
export type DoppiaChance = '1X' | '12' | 'X2';
export type MultiGoal = 'O0.5' | 'U0.5' | 'O1.5' | 'U1.5' | 'O2.5' | 'U2.5' | 'O3.5' | 'U3.5';

export type BetType =
  | 'esito' | 'over_under' | 'goal_nogoal' | 'doppia_chance' | 'multigoal'
  | 'esito_1t' | 'over_under_1t' | 'goal_nogoal_1t';
export type BetOutcome = MatchOutcome | OverUnder | GoalNoGoal | DoppiaChance | MultiGoal;

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
}

export interface Match {
  id: string;
  matchday: number;
  competition: string;
  homeTeam: Team;
  awayTeam: Team;
  scheduledAt: Date;
  result?: {
    homeGoals: number;
    awayGoals: number;
    outcome: MatchOutcome;
    htHomeGoals?: number;
    htAwayGoals?: number;
  };
  status: 'scheduled' | 'live' | 'finished' | 'postponed';
}

// === PRONOSTICO ===
export interface Prediction {
  matchId: string;
  betType: BetType;
  outcome: BetOutcome;
  odds: number;
}

export interface PredictionResult extends Prediction {
  isCorrect: boolean;
  pointsEarned: number;
}

// === SCHEDINA ===
export interface Schedina {
  id: string;
  participantId: string;
  matchday: number;
  predictions: Prediction[];
  submittedAt: Date;
  isLocked: boolean;
  powerups?: {
    jolly?: string;
    shield?: boolean;
    insurance?: boolean;
  };
  lastMinuteUsed?: boolean;
}

export interface SchedinaResult extends Omit<Schedina, 'predictions'> {
  predictions: PredictionResult[];
  totalPoints: number;
  correctPredictions: number;
  bonusPoints: number;
  penaltyPoints: number;
  finalPoints: number;
}

// === GIORNATA ===
export interface Matchday {
  number: number;
  season: string;
  matches: Match[];
  deadline: Date;
  status: 'upcoming' | 'open' | 'locked' | 'completed';
}

// === CLASSIFICA ===
export interface RankingEntry {
  rank: number;
  participantId: string;
  username: string;
  totalPoints: number;
  matchdaysPlayed: number;
  correctPredictions: number;
  averagePointsPerMatchday: number;
  bestMatchdayPoints: number;
  perfectSchedine: number; // 10/10
  bonusPointsTotal: number;
  penaltyPointsTotal: number;
  weeklyWins: number;
}

export interface WeeklyRanking {
  matchday: number;
  entries: RankingEntry[];
  winner?: RankingEntry;
}

// === PREMI ===
export interface PrizePool {
  totalPool: number;
  weeklyPool: number;
  finalPool: number;
}

// === CONFIGURAZIONE TORNEO ===
export interface TournamentConfig {
  season: string;
  participationFee: number; // 20€
  weeklyFee: number; // 10€
  weeklyFeeToPool: number; // 5€
  weeklyFeeToOrganizer: number; // 5€
  minValidOdds: number; // 1.30
  oddsCap: number; // 5.00 — tetto al contributo di una singola giocata nel combo
  penaltyOddsMin: number; // 1.25
  penaltyMultiplierPerThree: number; // ×0.9 ogni 3 giocate in fascia 1.25-1.29
  bonus9Multiplier: number; // ×1.2
  bonus10Multiplier: number; // ×1.5
  maxJoinMatchday: number; // 10
  lateJoinFeePerMatchday: number; // 5€
  minParticipantsForGuarantee: number; // 30
  guaranteedPrize: number; // 500€
  firstPlacePrize: number; // 300€
  firstHalfPrize: number; // 200€
  weeklyWinnerShare: number; // 0.40
  weeklyAllShare: number; // 0.40
  weeklyToFinalShare: number; // 0.20
}

// === CALCOLO PUNTEGGIO ===
export interface ScoreCalculation {
  basePoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  finalPoints: number;
  details: {
    correctPredictions: number;
    penaltyRangeBets: number;
    cappedBets: number;
  };
}

// === STATO APPLICAZIONE ===
export interface AppState {
  currentUser: Participant | null;
  currentMatchday: Matchday | null;
  rankings: RankingEntry[];
  weeklyRankings: WeeklyRanking[];
  prizePool: PrizePool;
  isLoading: boolean;
  error: string | null;
}
