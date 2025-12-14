-- ============================================================================
-- Ranked BO3 Series System
-- Migration: Create ranked_series table and update matches table
-- Requirements: 9.1, 9.2
-- ============================================================================

-- Create ranked_series table
CREATE TABLE IF NOT EXISTS public.ranked_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Players (References profiles table as per existing schema)
    player1_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    player2_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    
    -- Initial state (captured at series start for MP calculation)
    -- Requirements: 1.3
    player1_initial_mp INTEGER NOT NULL DEFAULT 0,
    player2_initial_mp INTEGER NOT NULL DEFAULT 0,
    player1_initial_rank VARCHAR(20) NOT NULL DEFAULT 'vo_danh',
    player2_initial_rank VARCHAR(20) NOT NULL DEFAULT 'vo_danh',
    
    -- Current score (wins per player)
    -- Requirements: 2.1, 2.3
    player1_wins INTEGER NOT NULL DEFAULT 0 CHECK (player1_wins >= 0 AND player1_wins <= 2),
    player2_wins INTEGER NOT NULL DEFAULT 0 CHECK (player2_wins >= 0 AND player2_wins <= 2),
    
    -- BO3 format constant
    -- Requirements: 1.4
    games_to_win INTEGER NOT NULL DEFAULT 2,
    
    -- Current game number (1, 2, or 3)
    current_game INTEGER NOT NULL DEFAULT 1 CHECK (current_game >= 1 AND current_game <= 3),
    
    -- Side assignment for current game
    -- Requirements: 1.2, 2.4
    player1_side CHAR(1) NOT NULL DEFAULT 'X' CHECK (player1_side IN ('X', 'O')),
    player2_side CHAR(1) NOT NULL DEFAULT 'O' CHECK (player2_side IN ('X', 'O')),
    
    -- Series status
    -- Requirements: 1.1, 3.1
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress' 
        CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    
    -- Winner (set when series completes)
    -- Requirements: 3.1, 9.3
    winner_id UUID REFERENCES public.profiles(user_id),
    final_score VARCHAR(10), -- e.g., "2-1", "2-0"
    
    -- Rewards (calculated at series end)
    -- Requirements: 3.2, 3.3, 3.4, 6.2, 6.3, 6.4, 9.3
    winner_mp_change INTEGER,
    loser_mp_change INTEGER,
    winner_coins INTEGER,
    loser_coins INTEGER,
    winner_exp INTEGER,
    loser_exp INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT different_players CHECK (player1_id != player2_id),
    CONSTRAINT valid_sides CHECK (player1_side != player2_side)
);

-- Add series_id and game_number to matches table
-- Requirements: 9.2
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES public.ranked_series(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS game_number INTEGER CHECK (game_number IS NULL OR (game_number >= 1 AND game_number <= 3));

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_ranked_series_player1 ON public.ranked_series(player1_id);
CREATE INDEX IF NOT EXISTS idx_ranked_series_player2 ON public.ranked_series(player2_id);
CREATE INDEX IF NOT EXISTS idx_ranked_series_status ON public.ranked_series(status);
CREATE INDEX IF NOT EXISTS idx_ranked_series_created ON public.ranked_series(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_series_id ON public.matches(series_id);

-- Create rank_history table for tracking rank changes
-- Requirements: 5.4
CREATE TABLE IF NOT EXISTS public.rank_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    series_id UUID REFERENCES public.ranked_series(id) ON DELETE SET NULL,
    
    -- Rank change details
    old_rank VARCHAR(20) NOT NULL,
    new_rank VARCHAR(20) NOT NULL,
    old_mp INTEGER NOT NULL,
    new_mp INTEGER NOT NULL,
    mp_change INTEGER NOT NULL,
    
    -- Reason for change
    reason VARCHAR(100),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rank_history_user ON public.rank_history(user_id);
CREATE INDEX IF NOT EXISTS idx_rank_history_created ON public.rank_history(created_at DESC);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.ranked_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_history ENABLE ROW LEVEL SECURITY;

-- ranked_series policies
-- Users can view series they are part of
DROP POLICY IF EXISTS "Users can view own series" ON public.ranked_series;
CREATE POLICY "Users can view own series" ON public.ranked_series
    FOR SELECT
    USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Service role can manage all series (for backend operations)
DROP POLICY IF EXISTS "Service role can manage series" ON public.ranked_series;
CREATE POLICY "Service role can manage series" ON public.ranked_series
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can insert series (for matchmaking)
DROP POLICY IF EXISTS "Authenticated users can create series" ON public.ranked_series;
CREATE POLICY "Authenticated users can create series" ON public.ranked_series
    FOR INSERT
    WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Players can update their own series (for game progression)
DROP POLICY IF EXISTS "Players can update own series" ON public.ranked_series;
CREATE POLICY "Players can update own series" ON public.ranked_series
    FOR UPDATE
    USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- rank_history policies
-- Users can view their own rank history
DROP POLICY IF EXISTS "Users can view own rank history" ON public.rank_history;
CREATE POLICY "Users can view own rank history" ON public.rank_history
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can manage rank history
DROP POLICY IF EXISTS "Service role can manage rank history" ON public.rank_history;
CREATE POLICY "Service role can manage rank history" ON public.rank_history
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

-- Create trigger function for auto-updating updated_at
CREATE OR REPLACE FUNCTION public.update_ranked_series_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_ranked_series_updated_at ON public.ranked_series;
CREATE TRIGGER trigger_ranked_series_updated_at
    BEFORE UPDATE ON public.ranked_series
    FOR EACH ROW
    EXECUTE FUNCTION public.update_ranked_series_updated_at();

-- ============================================================================
-- Enable Realtime for ranked_series (for live updates)
-- ============================================================================

-- Note: This may fail if table is already in publication, which is fine
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ranked_series;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Table already in publication
END $$;
