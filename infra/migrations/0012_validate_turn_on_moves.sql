-- Migration: Add turn validation to moves policy
-- Description: Prevent players from making moves when it's not their turn
-- Date: 2025-11-23

-- Drop old policy
DROP POLICY IF EXISTS moves_insert ON moves;

-- Create new policy with turn validation
CREATE POLICY moves_insert ON moves FOR INSERT WITH CHECK (
  -- Check 1: Must be authenticated user
  auth.uid()::uuid = player_user_id
  
  -- Check 2: Match must not be ended
  AND (SELECT ended_at IS NULL FROM matches WHERE id = match_id)
  
  -- Check 3: Must be your turn (validate against game_state)
  AND (
    SELECT 
      CASE 
        -- If no game state yet, allow first move
        WHEN game_state IS NULL THEN true
        -- Check if current turn matches the turn_player
        WHEN (game_state->>'currentTurn')::text = turn_player::text THEN true
        ELSE false
      END
    FROM rooms
    WHERE id = (SELECT room_id FROM matches WHERE id = match_id)
  )
);

-- Add comment
COMMENT ON POLICY moves_insert ON moves IS 
  'Players can only insert moves when authenticated, match is active, and it is their turn';

-- Grant necessary permissions
GRANT INSERT ON moves TO authenticated;

-- Log completion
DO $$ 
BEGIN
  RAISE NOTICE 'Migration 0012_validate_turn_on_moves completed successfully';
END $$;
