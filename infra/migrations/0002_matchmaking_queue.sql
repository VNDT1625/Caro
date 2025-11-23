-- Migration: Add matchmaking_queue table
-- Description: Table to manage matchmaking queue with ELO-based matching
-- Date: 2025-11-17

-- Create matchmaking_queue table if not exists
CREATE TABLE IF NOT EXISTS matchmaking_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('rank', 'casual', 'custom')),
    elo_rating INTEGER NOT NULL DEFAULT 1000,
    preferred_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'cancelled')),
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    matched_at TIMESTAMP WITH TIME ZONE,
    matched_with_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_user_id ON matchmaking_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_status ON matchmaking_queue(status);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_mode ON matchmaking_queue(mode);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_elo ON matchmaking_queue(elo_rating);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_joined_at ON matchmaking_queue(joined_at);

-- Create composite index for matchmaking query
CREATE INDEX IF NOT EXISTS idx_matchmaking_search 
ON matchmaking_queue(mode, status, elo_rating, joined_at) 
WHERE status = 'waiting';

-- Add RLS (Row Level Security) policies
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own queue entries
DROP POLICY IF EXISTS "Users can view own queue entries" ON matchmaking_queue;
CREATE POLICY "Users can view own queue entries" ON matchmaking_queue
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can view potential matches (for debugging/admin)
DROP POLICY IF EXISTS "Users can view waiting entries" ON matchmaking_queue;
CREATE POLICY "Users can view waiting entries" ON matchmaking_queue
    FOR SELECT
    USING (status = 'waiting' OR auth.uid() = user_id);

-- Policy: Users can insert their own queue entries
DROP POLICY IF EXISTS "Users can insert own queue entries" ON matchmaking_queue;
CREATE POLICY "Users can insert own queue entries" ON matchmaking_queue
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own queue entries
DROP POLICY IF EXISTS "Users can update own queue entries" ON matchmaking_queue;
CREATE POLICY "Users can update own queue entries" ON matchmaking_queue
    FOR UPDATE
    USING (auth.uid() = user_id OR auth.uid() = matched_with_user_id);

-- Policy: Users can delete their own queue entries
DROP POLICY IF EXISTS "Users can delete own queue entries" ON matchmaking_queue;
CREATE POLICY "Users can delete own queue entries" ON matchmaking_queue
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_matchmaking_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_update_matchmaking_queue_updated_at ON matchmaking_queue;
CREATE TRIGGER trigger_update_matchmaking_queue_updated_at
    BEFORE UPDATE ON matchmaking_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_matchmaking_queue_updated_at();

-- Create function to clean up old queue entries (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_matchmaking_queue()
RETURNS void AS $$
BEGIN
    DELETE FROM matchmaking_queue
    WHERE joined_at < NOW() - INTERVAL '1 hour'
    AND status IN ('waiting', 'cancelled');
END;
$$ LANGUAGE plpgsql;

-- Comment on table and columns
COMMENT ON TABLE matchmaking_queue IS 'Queue for matchmaking system with ELO-based matching';
COMMENT ON COLUMN matchmaking_queue.user_id IS 'User ID in the queue';
COMMENT ON COLUMN matchmaking_queue.mode IS 'Game mode: rank, casual, custom';
COMMENT ON COLUMN matchmaking_queue.elo_rating IS 'User ELO rating for matching (±200 range)';
COMMENT ON COLUMN matchmaking_queue.preferred_settings IS 'Game settings preferences (board_size, turn_time, etc)';
COMMENT ON COLUMN matchmaking_queue.status IS 'Queue status: waiting, matched, cancelled';
COMMENT ON COLUMN matchmaking_queue.matched_with_user_id IS 'User ID matched with (if found)';
