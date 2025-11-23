-- Migration: Rebalance rank thresholds
-- Description: Update rank thresholds for better progression curve
-- Version: 2.0
-- Date: 2025-11-23

-- Create rank history table to track rank changes
CREATE TABLE IF NOT EXISTS rank_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  old_rank VARCHAR(50),
  new_rank VARCHAR(50) NOT NULL,
  mindpoint INTEGER NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rank_history_user ON rank_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rank_history_created ON rank_history(created_at DESC);

COMMENT ON TABLE rank_history IS 'Track all rank changes for users';

-- Update the rank update function with new balanced thresholds
CREATE OR REPLACE FUNCTION update_user_rank(p_user_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  current_mp INTEGER;
  new_rank VARCHAR(50);
  old_rank VARCHAR(50);
  rank_changed BOOLEAN := false;
BEGIN
  -- Get current mindpoint and rank
  SELECT mindpoint, current_rank 
  INTO current_mp, old_rank 
  FROM profiles 
  WHERE user_id = p_user_id;
  
  -- If no profile found, return null
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- New balanced thresholds (v2.0)
  IF current_mp < 50 THEN 
    new_rank := 'vo_danh';
  ELSIF current_mp < 200 THEN 
    new_rank := 'tan_ky';
  ELSIF current_mp < 600 THEN 
    new_rank := 'hoc_ky';
  ELSIF current_mp < 1500 THEN 
    new_rank := 'ky_lao';
  ELSIF current_mp < 3000 THEN 
    new_rank := 'cao_ky';
  ELSIF current_mp < 5500 THEN 
    new_rank := 'ky_thanh';
  ELSE 
    new_rank := 'truyen_thuyet';
  END IF;
  
  -- Check if rank changed
  IF new_rank != old_rank OR old_rank IS NULL THEN
    rank_changed := true;
    
    -- Update profile with new rank
    UPDATE profiles 
    SET current_rank = new_rank,
        updated_at = now()
    WHERE user_id = p_user_id;
    
    -- Log rank change to history
    INSERT INTO rank_history (user_id, old_rank, new_rank, mindpoint, reason, created_at)
    VALUES (
      p_user_id, 
      old_rank, 
      new_rank, 
      current_mp,
      CASE 
        WHEN old_rank IS NULL THEN 'initial_rank'
        WHEN new_rank > old_rank THEN 'rank_up'
        ELSE 'rank_down'
      END,
      now()
    );
    
    -- Log to console
    RAISE NOTICE 'User % rank changed: % (MP: %) → % (MP: %)', 
      p_user_id, 
      COALESCE(old_rank, 'none'), 
      current_mp,
      new_rank,
      current_mp;
  END IF;
  
  RETURN new_rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_user_rank(UUID) TO authenticated;

COMMENT ON FUNCTION update_user_rank IS 
  'Updates user rank based on mindpoint. New balanced thresholds (v2.0): 0/50/200/600/1500/3000/5500';

-- Update all existing users to new rank system
DO $$
DECLARE
  user_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  FOR user_record IN 
    SELECT user_id, mindpoint, current_rank 
    FROM profiles 
    WHERE mindpoint > 0 OR current_rank IS NOT NULL
  LOOP
    PERFORM update_user_rank(user_record.user_id);
    updated_count := updated_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Updated ranks for % users', updated_count;
END $$;

-- Create view for rank distribution
CREATE OR REPLACE VIEW rank_distribution AS
SELECT 
  current_rank,
  COUNT(*) as player_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM profiles WHERE current_rank IS NOT NULL), 2) as percentage,
  MIN(mindpoint) as min_mp,
  MAX(mindpoint) as max_mp,
  ROUND(AVG(mindpoint), 0) as avg_mp
FROM profiles
WHERE current_rank IS NOT NULL
GROUP BY current_rank
ORDER BY MIN(mindpoint);

COMMENT ON VIEW rank_distribution IS 'Shows distribution of players across ranks';

-- Grant view access
GRANT SELECT ON rank_distribution TO authenticated;

-- Log completion
DO $$ 
BEGIN
  RAISE NOTICE '✅ Migration 0013_rebalance_ranks completed successfully';
  RAISE NOTICE '📊 New rank thresholds: vo_danh(0), tan_ky(50), hoc_ky(200), ky_lao(600), cao_ky(1500), ky_thanh(3000), truyen_thuyet(5500)';
END $$;
