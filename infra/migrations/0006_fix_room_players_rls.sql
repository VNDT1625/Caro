-- Fix room_players RLS policy to allow room owner to add any player
-- This is needed for matchmaking where one user creates the room and adds both players

-- Temporarily disable RLS to clean up
ALTER TABLE room_players DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS room_players_insert ON room_players;
DROP POLICY IF EXISTS room_players_select ON room_players;
DROP POLICY IF EXISTS room_players_update ON room_players;
DROP POLICY IF EXISTS room_players_delete ON room_players;

-- Re-enable RLS
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;

-- SELECT: Everyone can view room players
CREATE POLICY room_players_select ON room_players FOR SELECT USING (true);

-- INSERT: Can insert if you're adding yourself OR if you're the room owner
CREATE POLICY room_players_insert ON room_players FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    auth.uid()::uuid = user_id  -- Can add yourself
    OR 
    EXISTS (  -- Or you're the room owner
      SELECT 1 FROM rooms 
      WHERE rooms.id = room_players.room_id 
      AND rooms.owner_user_id = auth.uid()::uuid
    )
  )
);

-- UPDATE: Can update your own player record
CREATE POLICY room_players_update ON room_players FOR UPDATE 
  USING (auth.uid()::uuid = user_id)
  WITH CHECK (auth.uid()::uuid = user_id);

-- DELETE: Can delete your own player record or if you're room owner
CREATE POLICY room_players_delete ON room_players FOR DELETE 
  USING (
    auth.uid()::uuid = user_id
    OR
    EXISTS (
      SELECT 1 FROM rooms 
      WHERE rooms.id = room_players.room_id 
      AND rooms.owner_user_id = auth.uid()::uuid
    )
  );
