-- ============================================================
-- TEST SCHEMA: Report -> Ban Flow
-- Mục đích: Tạo dữ liệu test để kiểm tra quy trình report -> ban
-- 
-- CÁCH SỬ DỤNG:
-- 1. Chạy migration này trong Supabase SQL Editor
-- 2. Đăng nhập với TÀI KHOẢN HIỆN CÓ của bạn
-- 3. Vào lịch sử trận đấu, tìm trận với "hacker_pro"
-- 4. Click "Báo cáo" và chọn "Gian lận trong trận"
-- 5. Hệ thống sẽ tự động phân tích và ban hacker
--
-- LƯU Ý: Script này sẽ tự động lấy user_id của bạn làm victim
-- ============================================================

-- ============================================================
-- PHẦN 1: TẠO 2 TEST USERS TRONG AUTH.USERS
-- ============================================================

-- Xóa test data cũ nếu có (để chạy lại được)
DO $$
BEGIN
  -- Xóa moves trước
  DELETE FROM moves WHERE match_id IN (
    SELECT id FROM matches WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'
  );
  
  -- Xóa reports liên quan
  DELETE FROM report_actions WHERE report_id IN (
    SELECT id FROM reports WHERE match_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  );
  DELETE FROM appeals WHERE report_id IN (
    SELECT id FROM reports WHERE match_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  );
  DELETE FROM user_bans WHERE report_id IN (
    SELECT id FROM reports WHERE match_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  );
  DELETE FROM reports WHERE match_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  
  -- Xóa matches
  DELETE FROM matches WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
  
  -- Xóa profiles, identities và auth users
  DELETE FROM profiles WHERE user_id IN (
    'aaaaaaaa-1111-1111-1111-111111111111',
    'aaaaaaaa-2222-2222-2222-222222222222'
  );
  DELETE FROM auth.identities WHERE user_id IN (
    'aaaaaaaa-1111-1111-1111-111111111111',
    'aaaaaaaa-2222-2222-2222-222222222222'
  );
  DELETE FROM auth.users WHERE id IN (
    'aaaaaaaa-1111-1111-1111-111111111111',
    'aaaaaaaa-2222-2222-2222-222222222222'
  );
  
  RAISE NOTICE 'Cleaned up old test data';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Cleanup skipped (tables may not exist yet)';
END $$;

-- Tạo 2 users trong auth.users
-- User 1: Nạn nhân (bạn sẽ đăng nhập với account này để report)
-- User 2: Hacker (sẽ bị ban sau khi bị report)

-- Lấy instance_id từ Supabase (thường là UUID cố định cho project)
DO $$
DECLARE
  v_instance_id uuid;
BEGIN
  -- Lấy instance_id từ user đầu tiên trong hệ thống (nếu có)
  SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
  
  -- Nếu không có user nào, dùng default
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;

  -- Insert victim user
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    is_sso_user,
    deleted_at
  ) VALUES (
    'aaaaaaaa-1111-1111-1111-111111111111',
    v_instance_id,
    'victim@test.com',
    crypt('Test123456', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{}'::jsonb,
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    false,
    NULL
  ) ON CONFLICT (id) DO NOTHING;

  -- Insert hacker user
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    is_sso_user,
    deleted_at
  ) VALUES (
    'aaaaaaaa-2222-2222-2222-222222222222',
    v_instance_id,
    'hacker@test.com',
    crypt('Test123456', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{}'::jsonb,
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    false,
    NULL
  ) ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Created test users with instance_id: %', v_instance_id;
END $$;

-- Tạo auth.identities cho 2 users (bắt buộc cho Supabase auth)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES 
(
  'aaaaaaaa-1111-1111-1111-111111111111',
  'aaaaaaaa-1111-1111-1111-111111111111',
  '{"sub": "aaaaaaaa-1111-1111-1111-111111111111", "email": "victim@test.com", "email_verified": true}'::jsonb,
  'email',
  'aaaaaaaa-1111-1111-1111-111111111111',
  now(),
  now(),
  now()
),
(
  'aaaaaaaa-2222-2222-2222-222222222222',
  'aaaaaaaa-2222-2222-2222-222222222222',
  '{"sub": "aaaaaaaa-2222-2222-2222-222222222222", "email": "hacker@test.com", "email_verified": true}'::jsonb,
  'email',
  'aaaaaaaa-2222-2222-2222-222222222222',
  now(),
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Tạo profiles cho 2 users
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
) VALUES 
-- Nạn nhân
(
  'aaaaaaaa-1111-1111-1111-111111111111',
  'victim_player',
  'Nạn Nhân',
  'tan_ky',
  1200,
  150,
  20,
  8,
  1000,
  50
),
-- Hacker
(
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
-- PHẦN 2: TẠO TRẬN ĐẤU RANK VỚI NƯỚC ĐI HACK
-- ============================================================

-- Trận đấu rank giữa victim (X) và hacker (O)
-- Hacker sẽ có các nước đi bất hợp lệ:
-- 1. Đi 2 nước liên tiếp (move 4 và 5 đều là O)
-- 2. Đi vào ô đã có quân (move 7 đi vào vị trí của move 1)
-- 3. Thời gian giữa các nước quá nhanh (< 100ms)

INSERT INTO matches (
  id,
  match_type,
  player_x_user_id,  -- Victim chơi X
  player_o_user_id,  -- Hacker chơi O
  winner_user_id,    -- Hacker thắng (hack)
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
  'aaaaaaaa-1111-1111-1111-111111111111',  -- victim_player (X)
  'aaaaaaaa-2222-2222-2222-222222222222',  -- hacker_pro (O)
  'aaaaaaaa-2222-2222-2222-222222222222',  -- hacker thắng
  'win_o',
  10,
  45,
  15,
  5,
  -- Board state cuối: Hacker có 5 quân O liên tiếp (hack)
  '{"board": [[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,2,2,2,2,2,0,0,0],[0,0,0,0,0,0,0,1,1,1,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]}'::jsonb,
  now() - interval '1 hour',
  now() - interval '59 minutes',
  now() - interval '1 hour'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PHẦN 3: TẠO CÁC NƯỚC ĐI (MOVES) - CÓ HACK
-- ============================================================

-- Nước đi với các vi phạm rõ ràng:
-- Vi phạm 1: Move 4 và 5 đều là O (đi 2 nước liên tiếp)
-- Vi phạm 2: Move 7 đi vào vị trí (7,7) đã có quân từ move 1
-- Vi phạm 3: Thời gian giữa move 4 và 5 chỉ 50ms (bot)

INSERT INTO moves (
  id,
  match_id,
  player_user_id,
  move_number,
  position_x,
  position_y,
  time_taken,
  turn_player,
  created_at
) VALUES 
-- Move 1: X đi (7,7) - Victim đi giữa bàn
(
  'bbbbbbbb-0001-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-1111-1111-1111-111111111111',
  1, 7, 7, 5000, 'X',
  now() - interval '60 minutes'
),
-- Move 2: O đi (6,7) - Hacker đi bình thường
(
  'bbbbbbbb-0002-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-2222-2222-2222-222222222222',
  2, 6, 7, 3000, 'O',
  now() - interval '59 minutes' - interval '55 seconds'
),
-- Move 3: X đi (7,8) - Victim đi tiếp
(
  'bbbbbbbb-0003-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-1111-1111-1111-111111111111',
  3, 7, 8, 4000, 'X',
  now() - interval '59 minutes' - interval '50 seconds'
),
-- ⚠️ HACK Move 4: O đi (6,8) - Hacker đi
(
  'bbbbbbbb-0004-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-2222-2222-2222-222222222222',
  4, 6, 8, 100, 'O',  -- Thời gian quá nhanh: 100ms
  now() - interval '59 minutes' - interval '45 seconds'
),
-- ⚠️ HACK Move 5: O đi (6,9) - HACK: O đi 2 lần liên tiếp!
(
  'bbbbbbbb-0005-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-2222-2222-2222-222222222222',
  5, 6, 9, 50, 'O',  -- HACK: Cùng player O, thời gian 50ms
  now() - interval '59 minutes' - interval '45 seconds' + interval '50 milliseconds'
),
-- Move 6: X đi (7,9) - Victim cố gắng chặn
(
  'bbbbbbbb-0006-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-1111-1111-1111-111111111111',
  6, 7, 9, 2000, 'X',
  now() - interval '59 minutes' - interval '40 seconds'
),
-- ⚠️ HACK Move 7: O đi (7,7) - HACK: Đi vào ô đã có quân!
(
  'bbbbbbbb-0007-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-2222-2222-2222-222222222222',
  7, 7, 7, 80, 'O',  -- HACK: Vị trí (7,7) đã có X từ move 1!
  now() - interval '59 minutes' - interval '35 seconds'
),
-- Move 8: X đi (8,7) - Victim tiếp tục
(
  'bbbbbbbb-0008-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-1111-1111-1111-111111111111',
  8, 8, 7, 3000, 'X',
  now() - interval '59 minutes' - interval '30 seconds'
),
-- Move 9: O đi (6,10) - Hacker tiếp tục
(
  'bbbbbbbb-0009-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-2222-2222-2222-222222222222',
  9, 6, 10, 150, 'O',
  now() - interval '59 minutes' - interval '25 seconds'
),
-- Move 10: O đi (6,11) - HACK: Thắng với 5 O liên tiếp (6,7)-(6,11)
(
  'bbbbbbbb-0010-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-2222-2222-2222-222222222222',
  10, 6, 11, 100, 'O',
  now() - interval '59 minutes' - interval '20 seconds'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PHẦN 4: KHÔNG TẠO REPORT/BAN TRƯỚC
-- Để bạn tự test flow: Đăng nhập → Report → Hệ thống xử lý → Ban
-- ============================================================

-- Không insert gì ở đây - để test flow thực tế

-- ============================================================
-- PHẦN 5: QUERIES ĐỂ VERIFY DATA
-- ============================================================

-- Query 1: Xem 2 test users
SELECT user_id, username, display_name, current_rank, elo_rating 
FROM profiles 
WHERE user_id IN (
  'aaaaaaaa-1111-1111-1111-111111111111',
  'aaaaaaaa-2222-2222-2222-222222222222'
);

-- Query 2: Xem trận đấu hack
SELECT id, match_type, result, total_moves, 
       player_x_user_id, player_o_user_id, winner_user_id
FROM matches 
WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Query 3: Xem các nước đi (phát hiện hack)
SELECT move_number, position_x, position_y, turn_player, time_taken,
       CASE 
         WHEN move_number = 5 THEN '⚠️ HACK: O đi 2 lần liên tiếp!'
         WHEN move_number = 7 THEN '⚠️ HACK: Đi vào ô đã có quân!'
         WHEN time_taken < 100 THEN '⚠️ Thời gian quá nhanh (bot?)'
         ELSE 'OK'
       END as violation
FROM moves 
WHERE match_id = 'aaaaaaaa-0000-0000-0000-000000000001'
ORDER BY move_number;

-- Query 4: Sau khi report, xem reports
-- SELECT * FROM reports WHERE match_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Query 5: Sau khi ban, kiểm tra hacker có bị ban không
-- SELECT * FROM is_user_banned('aaaaaaaa-2222-2222-2222-222222222222');

-- ============================================================
-- PHẦN 6: HƯỚNG DẪN TEST
-- ============================================================
/*
CÁCH TEST FLOW REPORT -> BAN:

1. Chạy migration này trong Supabase SQL Editor

2. Đăng nhập vào app với:
   - Email: victim@test.com
   - Password: Test123456

3. Vào trang "Lịch sử trận đấu" hoặc "AI Analysis"
   - Tìm trận đấu với đối thủ "hacker_pro" (Hacker Pro 🤖)
   - Trận này có các nước đi hack rõ ràng

4. Click nút "Báo cáo" 🚩 trên trận đấu đó
   - Chọn loại: "Gian lận trong trận"
   - Mô tả: "Đối thủ đi 2 nước liên tiếp và đi vào ô đã có quân"
   - Gửi report

5. Hệ thống sẽ tự động:
   - Rule Engine phát hiện: đi 2 nước liên tiếp, đi vào ô đã có quân
   - AI phân tích: xác nhận gian lận
   - Quyết định: auto_flagged
   - Tự động ban hacker 7 ngày

6. Kiểm tra kết quả:
   - Vào Admin Panel → Reports để xem report
   - Chạy query: SELECT * FROM user_bans WHERE user_id = 'aaaaaaaa-2222-2222-2222-222222222222';
   - Đăng nhập với hacker@test.com để thấy BanNotificationModal

CÁC VI PHẠM TRONG TRẬN:
- Move 4→5: O đi 2 nước liên tiếp (không có X xen giữa)
- Move 7: O đi vào vị trí (7,7) đã có X từ move 1
- Move 4,5,7,9,10: Thời gian đi < 150ms (nghi ngờ bot)
*/

-- ============================================================
-- PHẦN 7: CLEANUP (chạy khi cần xóa test data)
-- ============================================================
/*
-- Xóa tất cả test data:
DELETE FROM moves WHERE match_id = 'aaaaaaaa-0000-0000-0000-000000000001';
DELETE FROM report_actions WHERE report_id IN (SELECT id FROM reports WHERE match_id = 'aaaaaaaa-0000-0000-0000-000000000001');
DELETE FROM appeals WHERE report_id IN (SELECT id FROM reports WHERE match_id = 'aaaaaaaa-0000-0000-0000-000000000001');
DELETE FROM user_bans WHERE user_id = 'aaaaaaaa-2222-2222-2222-222222222222';
DELETE FROM reports WHERE match_id = 'aaaaaaaa-0000-0000-0000-000000000001';
DELETE FROM matches WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
DELETE FROM profiles WHERE user_id IN ('aaaaaaaa-1111-1111-1111-111111111111', 'aaaaaaaa-2222-2222-2222-222222222222');
DELETE FROM auth.identities WHERE user_id IN ('aaaaaaaa-1111-1111-1111-111111111111', 'aaaaaaaa-2222-2222-2222-222222222222');
DELETE FROM auth.users WHERE id IN ('aaaaaaaa-1111-1111-1111-111111111111', 'aaaaaaaa-2222-2222-2222-222222222222');
*/

