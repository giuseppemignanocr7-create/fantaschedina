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
}

export interface Participant extends User {
  totalPoints: number;
  weeklyPoints: number;
  rank: number;
  paidWeeks: number;
  joinedMatchday?: number;
  entryFee?: number;
  startingPoints?: number;
}

// === PARTITA ===
export type MatchOutcome = '1' | 'X' | '2';
export type OverUnder = 'OVER' | 'UNDER';
export type GoalNoGoal = 'GG' | 'NG';
export type DoppiaChance = '1X' | '12' | 'X2';
export type MultiGoal = 'O0.5' | 'U0.5' | 'O1.5' | 'U1.5' | 'O2.5' | 'U2.5' | 'O3.5' | 'U3.5';

export type BetType = 'esito' | 'over_under' | 'goal_nogoal' | 'doppia_chance' | 'multigoal';
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
  homeTeam: Team;
  awayTeam: Team;
  scheduledAt: Date;
  result?: {
    homeGoals: number;
    awayGoals: number;
    outcome: MatchOutcome;
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
export interface Prize {
  id: string;
  type: 'weekly_winner' | 'final_first' | 'first_half_first' | 'highest_odds' | 'poker';
  amount: number;
  matchday?: number;
  winnerId?: string;
  status: 'pending' | 'awarded' | 'accumulated';
}

export interface PrizePool {
  totalPool: number;
  weeklyPool: number;
  finalPool: number;
  accumulatedPoker: number;
  accumulatedHighestOdds: number;
}

// === CONFIGURAZIONE TORNEO ===
export interface TournamentConfig {
  season: string;
  participationFee: number; // 20€
  weeklyFee: number; // 10€
  weeklyFeeToPool: number; // 5€
  weeklyFeeToOrganizer: number; // 5€
  minValidOdds: number; // 1.30
  maxPointsPerBet: number; // 3.5
  lowOddsThreshold: number; // 1.25
  lowOddsMaxPoints: number; // 0.5
  penaltyOddsMin: number; // 1.25
  penaltyOddsMax: number; // 1.29
  penaltyPerThree: number; // -1.5
  bonus9Correct: number; // +2
  bonus10Correct: number; // +5
  maxJoinMatchday: number; // 10
  lateJoinFeePerMatchday: number; // 5€
  minParticipantsForGuarantee: number; // 30
  guaranteedPrize: number; // 500€
  firstPlacePrize: number; // 300€
  firstHalfPrize: number; // 200€
  highestOddsPrize: number; // 10€
  pokerPrize: number; // 20€
  minOddsForPoker: number; // 2.00
  minOddsForHighestOddsPrize: number; // 2.00
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
    lowOddsBets: number;
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
