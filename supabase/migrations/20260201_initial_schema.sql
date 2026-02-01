-- =============================================
-- FANTASCHEDINA DATABASE SCHEMA
-- =============================================

-- Enable UUID extension (using pgcrypto for gen_random_uuid)

-- =============================================
-- PROFILES TABLE (extends Supabase auth.users)
-- =============================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  total_points DECIMAL(10,2) DEFAULT 0,
  weekly_points DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- =============================================
-- SEASONS TABLE
-- =============================================
CREATE TABLE public.seasons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- MATCHDAYS TABLE
-- =============================================
CREATE TABLE public.matchdays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'live', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.matchdays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Matchdays are viewable by everyone" ON public.matchdays
  FOR SELECT USING (true);

-- =============================================
-- TEAMS TABLE
-- =============================================
CREATE TABLE public.teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams are viewable by everyone" ON public.teams
  FOR SELECT USING (true);

-- =============================================
-- MATCHES TABLE
-- =============================================
CREATE TABLE public.matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  matchday_id UUID REFERENCES public.matchdays(id) ON DELETE CASCADE,
  home_team_id UUID REFERENCES public.teams(id),
  away_team_id UUID REFERENCES public.teams(id),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished', 'postponed')),
  minute INTEGER,
  result TEXT, -- '1', 'X', '2'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Matches are viewable by everyone" ON public.matches
  FOR SELECT USING (true);

-- =============================================
-- ODDS TABLE
-- =============================================
CREATE TABLE public.odds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  bet_type TEXT NOT NULL CHECK (bet_type IN ('esito', 'over_under', 'goal_nogoal', 'doppia_chance')),
  outcome TEXT NOT NULL,
  value DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, bet_type, outcome)
);

-- Enable RLS
ALTER TABLE public.odds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Odds are viewable by everyone" ON public.odds
  FOR SELECT USING (true);

-- =============================================
-- SCHEDINE TABLE
-- =============================================
CREATE TABLE public.schedine (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  matchday_id UUID REFERENCES public.matchdays(id) ON DELETE CASCADE,
  is_locked BOOLEAN DEFAULT false,
  total_points DECIMAL(10,2) DEFAULT 0,
  bonus_points DECIMAL(10,2) DEFAULT 0,
  penalty_points DECIMAL(10,2) DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, matchday_id)
);

-- Enable RLS
ALTER TABLE public.schedine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedine" ON public.schedine
  FOR SELECT USING (auth.uid() = user_id OR is_locked = true);

CREATE POLICY "Users can insert own schedine" ON public.schedine
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedine before lock" ON public.schedine
  FOR UPDATE USING (auth.uid() = user_id AND is_locked = false);

-- =============================================
-- PREDICTIONS TABLE
-- =============================================
CREATE TABLE public.predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedina_id UUID REFERENCES public.schedine(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  bet_type TEXT NOT NULL CHECK (bet_type IN ('esito', 'over_under', 'goal_nogoal', 'doppia_chance')),
  outcome TEXT NOT NULL,
  odds DECIMAL(5,2) NOT NULL,
  is_correct BOOLEAN,
  points_earned DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(schedina_id, match_id)
);

-- Enable RLS
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view predictions after deadline" ON public.predictions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.schedine s
      JOIN public.matchdays m ON s.matchday_id = m.id
      WHERE s.id = predictions.schedina_id
      AND (s.user_id = auth.uid() OR m.deadline < NOW())
    )
  );

CREATE POLICY "Users can insert own predictions" ON public.predictions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedine s
      WHERE s.id = schedina_id AND s.user_id = auth.uid() AND s.is_locked = false
    )
  );

CREATE POLICY "Users can update own predictions before lock" ON public.predictions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.schedine s
      WHERE s.id = schedina_id AND s.user_id = auth.uid() AND s.is_locked = false
    )
  );

-- =============================================
-- RANKINGS VIEW
-- =============================================
CREATE VIEW public.rankings AS
SELECT 
  p.id as participant_id,
  p.username,
  p.avatar_url,
  p.total_points,
  COUNT(DISTINCT s.matchday_id) as matchdays_played,
  SUM(s.correct_predictions) as total_correct,
  SUM(s.bonus_points) as bonus_total,
  SUM(s.penalty_points) as penalty_total,
  COALESCE(MAX(s.total_points), 0) as best_matchday_points,
  COALESCE(AVG(s.total_points), 0) as avg_points_per_matchday,
  COUNT(CASE WHEN s.total_points = (
    SELECT MAX(s2.total_points) 
    FROM public.schedine s2 
    WHERE s2.matchday_id = s.matchday_id
  ) THEN 1 END) as weekly_wins
FROM public.profiles p
LEFT JOIN public.schedine s ON p.id = s.user_id
GROUP BY p.id, p.username, p.avatar_url, p.total_points
ORDER BY p.total_points DESC;

-- =============================================
-- PRIZE POOL TABLE
-- =============================================
CREATE TABLE public.prize_pool (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE,
  entry_fee DECIMAL(10,2) DEFAULT 10,
  weekly_pool DECIMAL(10,2) DEFAULT 0,
  final_pool DECIMAL(10,2) DEFAULT 0,
  accumulated_poker DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.prize_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prize pool is viewable by everyone" ON public.prize_pool
  FOR SELECT USING (true);

-- =============================================
-- FUNCTION: Create profile on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- FUNCTION: Update profile points
-- =============================================
CREATE OR REPLACE FUNCTION public.update_user_points()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET 
    total_points = (
      SELECT COALESCE(SUM(total_points), 0) 
      FROM public.schedine 
      WHERE user_id = NEW.user_id
    ),
    updated_at = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for updating points
CREATE TRIGGER on_schedina_update
  AFTER INSERT OR UPDATE ON public.schedine
  FOR EACH ROW EXECUTE FUNCTION public.update_user_points();
