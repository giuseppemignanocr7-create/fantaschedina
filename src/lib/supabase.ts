import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for database tables
export type Profile = {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  total_points: number;
  weekly_points: number;
  created_at: string;
  updated_at: string;
};

export type Season = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
};

export type Matchday = {
  id: string;
  season_id: string;
  number: number;
  deadline: string;
  status: 'upcoming' | 'active' | 'live' | 'completed';
  created_at: string;
};

export type Team = {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  created_at: string;
};

export type Match = {
  id: string;
  matchday_id: string;
  home_team_id: string;
  away_team_id: string;
  scheduled_at: string;
  home_score: number | null;
  away_score: number | null;
  status: 'scheduled' | 'live' | 'finished' | 'postponed';
  minute: number | null;
  result: string | null;
  created_at: string;
  // Joined data
  home_team?: Team;
  away_team?: Team;
};

export type Odds = {
  id: string;
  match_id: string;
  bet_type: 'esito' | 'over_under' | 'goal_nogoal' | 'doppia_chance';
  outcome: string;
  value: number;
  created_at: string;
};

export type Schedina = {
  id: string;
  user_id: string;
  matchday_id: string;
  is_locked: boolean;
  total_points: number;
  bonus_points: number;
  penalty_points: number;
  correct_predictions: number;
  submitted_at: string | null;
  created_at: string;
};

export type Prediction = {
  id: string;
  schedina_id: string;
  match_id: string;
  bet_type: 'esito' | 'over_under' | 'goal_nogoal' | 'doppia_chance';
  outcome: string;
  odds: number;
  is_correct: boolean | null;
  points_earned: number;
  created_at: string;
};

export type Ranking = {
  participant_id: string;
  username: string;
  avatar_url: string | null;
  total_points: number;
  matchdays_played: number;
  total_correct: number;
  bonus_total: number;
  penalty_total: number;
  best_matchday_points: number;
  avg_points_per_matchday: number;
  weekly_wins: number;
};

export type PrizePool = {
  id: string;
  season_id: string;
  entry_fee: number;
  weekly_pool: number;
  final_pool: number;
  accumulated_poker: number;
  updated_at: string;
};
