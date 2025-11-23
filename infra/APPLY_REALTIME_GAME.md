# Hướng dẫn kích hoạt chế độ Realtime Game Sync

## Bước 1: Chạy Migration

Vào Supabase SQL Editor và chạy file migration:

```sql
-- File: infra/migrations/0010_add_game_state_to_rooms.sql
```

Hoặc dùng PowerShell:

```powershell
cd c:\PJ\caro\infra
# Chạy migration mới nhất
Get-Content migrations\0010_add_game_state_to_rooms.sql | psql $env:DATABASE_URL
```

## Bước 2: Xác minh Realtime Publication

Đảm bảo bảng `rooms` đã có trong realtime publication:

```sql
-- Kiểm tra trong Supabase Dashboard > Database > Replication
-- Hoặc chạy SQL:
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('rooms', 'room_players', 'moves');
```

Nếu chưa có, thêm vào:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE moves;
```

## Bước 3: Test Realtime

1. Mở 2 browser tabs (hoặc incognito)
2. Đăng nhập 2 tài khoản khác nhau
3. Vào matchmaking và ghép trận
4. Khi vào InMatch, kiểm tra console log:
   - `🎮 Subscribing to game state updates for room: ...`
   - `🎲 Game state updated: ...` (khi đối thủ đánh)

## Bước 4: Kiểm tra Database

Sau khi test, xem dữ liệu:

```sql
-- Xem game state của room
SELECT id, status, game_state->>'currentGame' as game_num, 
       game_state->'scores' as scores
FROM rooms 
WHERE status = 'playing';

-- Xem moves đã lưu
SELECT m.move_number, m.position_x, m.position_y, m.turn_player,
       p.username as player_name
FROM moves m
JOIN profiles p ON m.player_user_id = p.user_id
ORDER BY m.created_at DESC
LIMIT 20;
```

## Cơ chế hoạt động

### Best of 3 System:
- Mỗi trận gồm 3 ván đấu (currentGame: 1, 2, 3)
- Ai thắng 2 ván trước thì thắng trận (scores.X >= 2 hoặc scores.O >= 2)
- Sau mỗi ván, bàn cờ reset và bắt đầu ván mới

### Realtime Sync:
- Player A đánh → Update `rooms.game_state` 
- Supabase Realtime broadcast → Player B nhận UPDATE event
- Player B UI tự động cập nhật board + turn

### Database Structure:
```
rooms
  ├─ game_state (JSONB)
  │   ├─ board: (null | 'X' | 'O')[][]
  │   ├─ moves: [{x, y, player, timestamp}]
  │   ├─ currentTurn: 'X' | 'O'
  │   ├─ currentGame: 1 | 2 | 3
  │   ├─ scores: {X: number, O: number}
  │   ├─ gameStartedAt: ISO timestamp
  │   └─ lastMoveAt: ISO timestamp

matches
  ├─ room_id (FK)
  ├─ player_x_user_id
  ├─ player_o_user_id
  ├─ winner_user_id
  └─ result: 'win_x' | 'win_o' | 'draw'

moves
  ├─ match_id (FK)
  ├─ player_user_id
  ├─ move_number
  ├─ position_x, position_y
  └─ turn_player: 'X' | 'O'
```

## Troubleshooting

### Không nhận được realtime update?
1. Kiểm tra console có log subscription không
2. Xác minh RLS policies cho `rooms` table
3. Test với `supabase.realtime.setAuth(token)`

### Game state không cập nhật?
```sql
-- Xem game_state trực tiếp
SELECT game_state FROM rooms WHERE id = 'YOUR_ROOM_ID';

-- Reset game state nếu cần
UPDATE rooms 
SET game_state = jsonb_build_object(
  'board', '[]'::jsonb,
  'moves', '[]'::jsonb,
  'currentTurn', 'X',
  'currentGame', 1,
  'scores', jsonb_build_object('X', 0, 'O', 0)
)
WHERE id = 'YOUR_ROOM_ID';
```

### Lỗi permissions?
```sql
-- Xem RLS policies
SELECT * FROM pg_policies WHERE tablename = 'rooms';

-- Thêm policy nếu thiếu
CREATE POLICY rooms_update_game_state ON rooms 
FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT user_id FROM room_players WHERE room_id = rooms.id
  )
);
```

## Performance Tips

- `game_state` dùng JSONB có index GIN → query nhanh
- Realtime chỉ broadcast khi có UPDATE → không overload
- Moves table dùng để replay/analysis sau này
- Timer xử lý client-side → không tốn DB resources
