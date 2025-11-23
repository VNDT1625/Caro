-- ========================================
-- CHẠY SQL NÀY TRONG SUPABASE SQL EDITOR
-- ========================================

-- Bước 1: Tắt RLS tạm thời
ALTER TABLE room_players DISABLE ROW LEVEL SECURITY;

-- Bước 2: Xóa tất cả policies cũ
DROP POLICY IF EXISTS room_players_insert ON room_players;
DROP POLICY IF EXISTS room_players_select ON room_players;
DROP POLICY IF EXISTS room_players_update ON room_players;
DROP POLICY IF EXISTS room_players_delete ON room_players;

-- Bước 3: Bật lại RLS
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;

-- Bước 4: Tạo policy SELECT - mọi người có thể xem
CREATE POLICY room_players_select ON room_players 
FOR SELECT 
USING (true);

-- Bước 5: Tạo policy INSERT - room owner có thể thêm bất kỳ ai
CREATE POLICY room_players_insert ON room_players 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    auth.uid()::uuid = user_id  -- Có thể thêm chính mình
    OR 
    EXISTS (  -- Hoặc là room owner
      SELECT 1 FROM rooms 
      WHERE rooms.id = room_players.room_id 
      AND rooms.owner_user_id = auth.uid()::uuid
    )
  )
);

-- Bước 6: Tạo policy UPDATE - chỉ update chính mình
CREATE POLICY room_players_update ON room_players 
FOR UPDATE 
USING (auth.uid()::uuid = user_id)
WITH CHECK (auth.uid()::uuid = user_id);

-- Bước 7: Xóa dữ liệu cũ để test lại
DELETE FROM matchmaking_queue;
DELETE FROM room_players;
DELETE FROM rooms;

-- HOÀN TẤT! Bây giờ refresh 2 browser tabs và test lại
