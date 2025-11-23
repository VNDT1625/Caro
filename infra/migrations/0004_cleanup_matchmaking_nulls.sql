-- Migration: Fix NULL values in matchmaking_queue
-- Description: Ensure all NULL columns in current entries are properly set
-- Date: 2025-11-17

-- Update any NULL matched_with_user_id, matched_at, room_id columns
-- These should be NULL for waiting entries, but let's ensure consistency

-- Clean up any entries with NULL mode (should not happen but just in case)
DELETE FROM matchmaking_queue 
WHERE mode IS NULL;

-- Clean up any entries with NULL elo_rating
UPDATE matchmaking_queue
SET elo_rating = 1000
WHERE elo_rating IS NULL;

-- Clean up any entries with NULL status
UPDATE matchmaking_queue
SET status = 'cancelled'
WHERE status IS NULL;

-- Log results
DO $$ 
BEGIN
  RAISE NOTICE 'Cleaned up matchmaking_queue NULL values';
END $$;
