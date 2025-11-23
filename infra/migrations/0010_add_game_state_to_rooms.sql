-- Add game_state column to rooms table for real-time game synchronization
-- This allows both players to see the current board state and moves

-- Add game_state JSONB column to store current game state
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS game_state JSONB DEFAULT jsonb_build_object(
  'board', '[]'::jsonb,
  'moves', '[]'::jsonb,
  'currentTurn', 'X',
  'currentGame', 1,
  'scores', jsonb_build_object('X', 0, 'O', 0),
  'gameStartedAt', NULL,
  'lastMoveAt', NULL
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_rooms_game_state ON rooms USING gin(game_state);

-- Enable replica identity FULL for rooms table to get old and new values in realtime
ALTER TABLE rooms REPLICA IDENTITY FULL;

-- Ensure rooms table is in realtime publication (should already be there)
-- ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

COMMENT ON COLUMN rooms.game_state IS 'Real-time game state: board, moves, turn, scores for best-of-3';
