-- Migration: Create tournaments table for VẠN MÔN TRANH ĐẤU feature
-- Date: 2024-12-08

-- Create tournaments table
CREATE TABLE IF NOT EXISTS public.tournaments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_code character varying(20) NOT NULL UNIQUE,
  tournament_name character varying(100) NOT NULL,
  description text,
  creator_user_id uuid NOT NULL,
  format character varying(30) NOT NULL DEFAULT 'single_elimination' CHECK (format IN ('single_elimination', 'double_elimination', 'round_robin', 'swiss')),
  status character varying(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'registration', 'in_progress', 'completed', 'cancelled')),
  
  -- Player limits
  min_players integer NOT NULL DEFAULT 4 CHECK (min_players >= 2),
  max_players integer NOT NULL DEFAULT 16 CHECK (max_players <= 256),
  current_players integer NOT NULL DEFAULT 0,
  
  -- Game settings
  board_size integer NOT NULL DEFAULT 15 CHECK (board_size >= 9 AND board_size <= 25),
  win_length integer NOT NULL DEFAULT 5 CHECK (win_length >= 3 AND win_length <= 10),
  time_per_move integer NOT NULL DEFAULT 30 CHECK (time_per_move >= 5 AND time_per_move <= 300),
  swap2_enabled boolean NOT NULL DEFAULT false,
  
  -- Entry & Prize
  entry_fee_coins integer NOT NULL DEFAULT 0 CHECK (entry_fee_coins >= 0),
  entry_fee_gems integer NOT NULL DEFAULT 0 CHECK (entry_fee_gems >= 0),
  prize_pool_coins integer NOT NULL DEFAULT 0 CHECK (prize_pool_coins >= 0),
  prize_pool_gems integer NOT NULL DEFAULT 0 CHECK (prize_pool_gems >= 0),
  
  -- Timing
  registration_start timestamp with time zone,
  registration_end timestamp with time zone,
  tournament_start timestamp with time zone,
  tournament_end timestamp with time zone,
  
  -- Visibility & Access
  is_public boolean NOT NULL DEFAULT true,
  required_rank character varying(50),
  password_hash character varying(255),
  
  -- Additional settings
  cover_image_url text,
  rules_text text,
  game_config jsonb DEFAULT '{}'::jsonb,
  bracket_data jsonb DEFAULT '{}'::jsonb,
  
  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT tournaments_pkey PRIMARY KEY (id),
  CONSTRAINT tournaments_creator_fkey FOREIGN KEY (creator_user_id) REFERENCES public.profiles(user_id),
  CONSTRAINT tournaments_players_check CHECK (min_players <= max_players)
);

-- Create tournament_participants table
CREATE TABLE IF NOT EXISTS public.tournament_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  user_id uuid NOT NULL,
  seed_number integer,
  status character varying(20) NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'playing', 'eliminated', 'winner', 'withdrawn')),
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  registered_at timestamp with time zone NOT NULL DEFAULT now(),
  checked_in_at timestamp with time zone,
  eliminated_at timestamp with time zone,
  final_placement integer,
  
  CONSTRAINT tournament_participants_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_participants_tournament_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE,
  CONSTRAINT tournament_participants_user_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id),
  CONSTRAINT tournament_participants_unique UNIQUE (tournament_id, user_id)
);

-- Create tournament_matches table
CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  match_id uuid,
  round_number integer NOT NULL,
  match_number integer NOT NULL,
  player1_id uuid,
  player2_id uuid,
  winner_id uuid,
  status character varying(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'bye')),
  scheduled_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  next_match_id uuid,
  bracket_position character varying(50),
  
  CONSTRAINT tournament_matches_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_matches_tournament_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE,
  CONSTRAINT tournament_matches_match_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT tournament_matches_player1_fkey FOREIGN KEY (player1_id) REFERENCES public.profiles(user_id),
  CONSTRAINT tournament_matches_player2_fkey FOREIGN KEY (player2_id) REFERENCES public.profiles(user_id),
  CONSTRAINT tournament_matches_winner_fkey FOREIGN KEY (winner_id) REFERENCES public.profiles(user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON public.tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_is_public ON public.tournaments(is_public);
CREATE INDEX IF NOT EXISTS idx_tournaments_creator ON public.tournaments(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_code ON public.tournaments(tournament_code);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON public.tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_user ON public.tournament_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON public.tournament_matches(tournament_id);

-- RLS Policies
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

-- Tournaments: Anyone can view public tournaments
CREATE POLICY "Public tournaments are viewable by everyone"
  ON public.tournaments FOR SELECT
  USING (is_public = true OR creator_user_id = auth.uid());

-- Tournaments: Authenticated users can create
CREATE POLICY "Authenticated users can create tournaments"
  ON public.tournaments FOR INSERT
  TO authenticated
  WITH CHECK (creator_user_id = auth.uid());

-- Tournaments: Creator can update
CREATE POLICY "Creator can update their tournaments"
  ON public.tournaments FOR UPDATE
  TO authenticated
  USING (creator_user_id = auth.uid());

-- Participants: Anyone can view
CREATE POLICY "Tournament participants are viewable"
  ON public.tournament_participants FOR SELECT
  USING (true);

-- Participants: Authenticated users can register
CREATE POLICY "Users can register for tournaments"
  ON public.tournament_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Participants: Users can update their own participation
CREATE POLICY "Users can update their participation"
  ON public.tournament_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Matches: Anyone can view
CREATE POLICY "Tournament matches are viewable"
  ON public.tournament_matches FOR SELECT
  USING (true);

-- Function to update current_players count
CREATE OR REPLACE FUNCTION update_tournament_player_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tournaments 
    SET current_players = current_players + 1,
        updated_at = now()
    WHERE id = NEW.tournament_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tournaments 
    SET current_players = current_players - 1,
        updated_at = now()
    WHERE id = OLD.tournament_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for player count
DROP TRIGGER IF EXISTS trigger_update_tournament_player_count ON public.tournament_participants;
CREATE TRIGGER trigger_update_tournament_player_count
  AFTER INSERT OR DELETE ON public.tournament_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_player_count();

-- Grant permissions
GRANT SELECT ON public.tournaments TO anon;
GRANT ALL ON public.tournaments TO authenticated;
GRANT SELECT ON public.tournament_participants TO anon;
GRANT ALL ON public.tournament_participants TO authenticated;
GRANT SELECT ON public.tournament_matches TO anon;
GRANT ALL ON public.tournament_matches TO authenticated;
