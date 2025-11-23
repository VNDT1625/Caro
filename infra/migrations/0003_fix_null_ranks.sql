-- Migration: Set default values for existing users with null ranks
-- Description: Update existing profiles to have default rank and ELO
-- Date: 2025-11-17

-- Update profiles with null current_rank
UPDATE profiles 
SET 
  current_rank = 'vo_danh',
  elo_rating = COALESCE(elo_rating, 1000),
  mindpoint = COALESCE(mindpoint, 0)
WHERE 
  current_rank IS NULL 
  OR elo_rating IS NULL 
  OR mindpoint IS NULL;

-- Log results
DO $$ 
DECLARE
  affected_rows INT;
BEGIN
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'Updated % profiles with default values', affected_rows;
END $$;
