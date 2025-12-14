-- ============================================================
-- TEST SCHEMA V2: Report -> Ban Flow
-- KHÔNG TẠO AUTH.USERS - Dùng user hiện có của bạn
-- 
-- CÁCH SỬ DỤNG:
-- 1. Thay YOUR_USER_ID bằng user_id thật của bạn (lấy từ profiles)
-- 2. Chạy migration này trong Supabase SQL Editor
-- 3. Đăng nhập với tài khoản của bạn
-- 4. Vào lịch sử trận đấu, tìm trận với "hacker_pro"
-- 5. Click "Báo cáo" và chọn "Gian lận trong trận"
-- ============================================================

-- ============================================================
-- BƯỚC 0: LẤY USER_ID CỦA BẠN
-- Chạy query này trước để lấy user_id:
-- SELECT user_id, username, email FROM profiles LIMIT 10;
-- ============================================================

-- ============================================================
-- PHẦN 1: CLEANUP DỮ LIỆU CŨ
-- ============================================================
DO $$
BEGIN
  DELETE FROM moves WHERE match_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  DELETE FROM report_actions WHERE report_id IN (SELECT id FROM reports WHERE match_id = 'aaaaaaaa-0000-0000-0000-000000000001');
  DELETE FROM appeals WHERE report_id IN (SELECT id FROM reports WHERE match_id = 'aaaaaaaa-0000-0000-0000-000000000001');
  DELETE FROM user_bans WHERE user_id = 'aaaaaaaa-2222-2222-2222-222222222222';
  DELETE FROM reports WHERE match_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  DELETE FROM matches WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
  DELETE FROM profiles WHERE user_id = 'aaaaaaaa-2222-2222-2222-222222222222';
  RAISE NOTICE 'Cleanup done';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Cleanup skipped';
END $$;

-- ============================================================
-- PHẦN 2: TẠO HACKER PROFILE (không cần auth.users)
-- Hacker chỉ là profile giả để test, không cần đăng nhập được
-- ============================================================
INSERT INTO profiles (
  user_id,
  username,
  display_name,
  current_rank,
  elo_rating,
  mindpoint,
  total_matches,
  total_wins,
  coins,
  gems
) VALUES (
  'aaaaaaaa-2222-2222-2222-222222222222',
  'hacker_pro',
  'Hacker Pro 🤖',
  'ky_thanh',
  2500,
  800,
  100,
  95,
  99999,
  9999
)
ON CONFLICT (user_id) DO UPDATE SET
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name;

-- ============================================================
-- PHẦN 3: TẠO TRẬN ĐẤU HACK
-- ⚠️ THAY YOUR_USER_ID BẰNG USER_ID THẬT CỦA BẠN
-- ============================================================

-- Lấy user_id đầu tiên từ profiles làm victim (thay đổi nếu cần)
DO $$
DECLARE
  v_victim_id uuid;
BEGIN
  -- Lấy user_id đầu tiên có trong profiles (không phải hacker)
  SELECT user_id INTO v_victim_id 
  FROM profiles 
  WHERE user_id != 'aaaaaaaa-2222-2222-2222-222222222222'
  LIMIT 1;
  
  IF v_victim_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy user nào trong profiles!';
  END IF;
  
  RAISE NOTICE 'Victim user_id: %', v_victim_id;
  
  -- Tạo trận đấu
  INSERT INTO matches (
    id,
    match_type,
    player_x_user_id,
    player_o_user_id,
    winner_user_id,
    result,
    total_moves,
    duration_seconds,
    board_size,
    win_length,
    final_board_state,
    started_at,
    ended_at,
    created_at
  ) VALUES (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'ranked',
    v_victim_id,  -- Bạn chơi X
    'aaaaaaaa-2222-2222-2222-222222222222',  -- Hacker chơi O
    'aaaaaaaa-2222-2222-2222-222222222222',  -- Hacker thắng (hack)
    'win_o',
    10,
    45,
    15,
    5,
    '{"board": [[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,2,2,2,2,2,0,0,0],[0,0,0,0,0,0,0,1,1,1,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]}'::jsonb,
    now() - interval '1 hour',
    now() - interval '59 minutes',
    now() - interval '1 hour'
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Tạo các nước đi
  INSERT INTO moves (id, match_id, player_user_id, move_number, position_x, position_y, time_taken, turn_player, created_at) VALUES 
  ('bbbbbbbb-0001-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', v_victim_id, 1, 7, 7, 5000, 'X', now() - interval '60 minutes'),
  ('bbbbbbbb-0002-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-2222-2222-2222-222222222222', 2, 6, 7, 3000, 'O', now() - interval '59 minutes' - interval '55 seconds'),
  ('bbbbbbbb-0003-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', v_victim_id, 3, 7, 8, 4000, 'X', now() - interval '59 minutes' - interval '50 seconds'),
  -- ⚠️ HACK: O đi nhanh
  ('bbbbbbbb-0004-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-2222-2222-2222-222222222222', 4, 6, 8, 100, 'O', now() - interval '59 minutes' - interval '45 seconds'),
  -- ⚠️ HACK: O đi 2 lần liên tiếp!
  ('bbbbbbbb-0005-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-2222-2222-2222-222222222222', 5, 6, 9, 50, 'O', now() - interval '59 minutes' - interval '45 seconds' + interval '50 milliseconds'),
  ('bbbbbbbb-0006-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', v_victim_id, 6, 7, 9, 2000, 'X', now() - interval '59 minutes' - interval '40 seconds'),
  -- ⚠️ HACK: Đi vào ô đã có quân!
  ('bbbbbbbb-0007-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-2222-2222-2222-222222222222', 7, 7, 7, 80, 'O', now() - interval '59 minutes' - interval '35 seconds'),
  ('bbbbbbbb-0008-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', v_victim_id, 8, 8, 7, 3000, 'X', now() - interval '59 minutes' - interval '30 seconds'),
  ('bbbbbbbb-0009-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-2222-2222-2222-222222222222', 9, 6, 10, 150, 'O', now() - interval '59 minutes' - interval '25 seconds'),
  ('bbbbbbbb-0010-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-2222-2222-2222-222222222222', 10, 6, 11, 100, 'O', now() - interval '59 minutes' - interval '20 seconds')
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE 'Created match and moves for victim: %', v_victim_id;
END $$;

-- ============================================================
-- PHẦN 4: VERIFY DATA (chạy riêng từng query)
-- ============================================================

-- Query 1: Xem hacker profile
SELECT user_id, username, display_name FROM profiles WHERE user_id = 'aaaaaaaa-2222-2222-2222-222222222222';

-- Query 2: Xem trận đấu
SELECT id, match_type, result, total_moves FROM matches WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Query 3: Xem các nước đi hack
SELECT move_number, turn_player, position_x, position_y, time_taken,
  CASE 
    WHEN move_number = 5 THEN 'HACK: O di 2 lan lien tiep!'
    WHEN move_number = 7 THEN 'HACK: Di vao o da co quan!'
    WHEN time_taken < 100 THEN 'Bot (qua nhanh)'
    ELSE 'OK'
  END as status
FROM moves 
WHERE match_id = 'aaaaaaaa-0000-0000-0000-000000000001'
ORDER BY move_number;

-- ============================================================
-- HƯỚNG DẪN:
-- 1. Chạy script này
-- 2. Đăng nhập với tài khoản của bạn
-- 3. Vào AI Analysis hoặc Match History
-- 4. Tìm trận với "Hacker Pro 🤖"
-- 5. Click Report → Gian lận trong trận
-- ============================================================
