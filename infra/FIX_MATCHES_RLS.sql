-- ========================================
-- FIX MATCHES & MOVES RLS POLICIES
-- Chạy SQL này trong Supabase SQL Editor
-- ========================================

-- 1. DISABLE RLS temporarily to clean up
ALTER TABLE matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE moves DISABLE ROW LEVEL SECURITY;

-- 2. DROP ALL existing policies
DROP POLICY IF EXISTS matches_select ON matches;
DROP POLICY IF EXISTS matches_insert ON matches;
DROP POLICY IF EXISTS matches_update ON matches;
DROP POLICY IF EXISTS matches_delete ON matches;

DROP POLICY IF EXISTS moves_select ON moves;
DROP POLICY IF EXISTS moves_insert ON moves;
DROP POLICY IF EXISTS moves_update ON moves;
DROP POLICY IF EXISTS moves_delete ON moves;

-- 3. RE-ENABLE RLS
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;

-- 4. CREATE NEW POLICIES FOR MATCHES

-- SELECT: Everyone can view all matches (no restrictions)
CREATE POLICY matches_select ON matches 
FOR SELECT 
USING (true);

-- INSERT: Players can create matches they're part of
CREATE POLICY matches_insert ON matches 
FOR INSERT 
WITH CHECK (
  auth.uid()::uuid = player_x_user_id 
  OR auth.uid()::uuid = player_o_user_id
);

-- UPDATE: Only players in the match can update
CREATE POLICY matches_update ON matches 
FOR UPDATE 
USING (
  auth.uid()::uuid = player_x_user_id 
  OR auth.uid()::uuid = player_o_user_id
)
WITH CHECK (
  auth.uid()::uuid = player_x_user_id 
  OR auth.uid()::uuid = player_o_user_id
);

-- 5. CREATE NEW POLICIES FOR MOVES

-- SELECT: Everyone can view all moves (no restrictions)
CREATE POLICY moves_select ON moves 
FOR SELECT 
USING (true);

-- INSERT: Only the player making the move can insert
CREATE POLICY moves_insert ON moves 
FOR INSERT 
WITH CHECK (
  auth.uid()::uuid = player_user_id
  AND (SELECT ended_at IS NULL FROM matches WHERE id = match_id)
);

-- ========================================
-- VERIFY POLICIES
-- ========================================
-- Run this to check if policies are created:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename IN ('matches', 'moves')
-- ORDER BY tablename, policyname;
