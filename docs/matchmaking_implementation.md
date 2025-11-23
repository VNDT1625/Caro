# Real Matchmaking Implementation Guide

## Tổng quan
Hệ thống matchmaking thực tế đã được implement với các tính năng:
- Join queue với ELO matching
- Real-time subscription (Supabase Realtime)
- Polling backup để tìm opponent
- Auto-cancel sau 60 giây
- Hiển thị thông tin opponent thật

## Flow hoạt động

### 1. Tạo phòng và bắt đầu matchmaking
```
User -> CreateRoom -> Click "TẠO PHÒNG NGAY"
  -> joinMatchmakingQueue(userId, settings)
  -> Insert vào table matchmaking_queue
  -> Lưu queueId vào localStorage
  -> Redirect về Home
```

### 2. Tìm trận
```
Home page:
  -> Poll mỗi 2 giây: findMatch(userId, queueId, settings)
  -> Query matchmaking_queue tìm opponent với:
     + Cùng mode (rank/casual)
     + ELO ±200 điểm
     + Status = 'waiting'
     + Không phải chính mình
  -> Nếu tìm thấy:
     + Update cả 2 queue entries -> 'matched'
     + Tạo room mới
     + Add cả 2 players vào room_players
     + Hiển thị popup "Đã tìm thấy trận!"
```

### 3. Xác nhận và vào trận
```
User click "SẴN SÀNG"
  -> Store match info vào localStorage
  -> Redirect to #inmatch
  -> InMatch page load opponent data từ localStorage
  -> Start game với opponent thật
```

## Database Tables sử dụng

### matchmaking_queue
```sql
- id: UUID
- user_id: UUID (người trong queue)
- mode: TEXT (rank/casual/...)
- elo_rating: INT (để match)
- preferred_settings: JSONB
- status: TEXT (waiting/matched/cancelled)
- joined_at: TIMESTAMP
- matched_at: TIMESTAMP
```

### rooms
```sql
- id: UUID
- owner_user_id: UUID
- name: TEXT
- mode: TEXT
- board_size: TEXT
- win_condition: INT
- turn_time_seconds: INT
- max_players: INT
- current_players: INT
- status: TEXT (waiting/full/playing)
```

### room_players
```sql
- id: UUID
- room_id: UUID
- user_id: UUID
- player_side: TEXT (X/O)
- is_ready: BOOLEAN
```

## Files đã tạo/sửa

### 1. `/frontend/src/lib/matchmaking.ts` (MỚI)
Service chính xử lý matchmaking:
- `joinMatchmakingQueue()` - Join queue
- `findMatch()` - Tìm opponent
- `cancelMatchmaking()` - Cancel queue
- `subscribeToMatchmaking()` - Realtime updates
- `getQueuePosition()` - Vị trí trong queue

### 2. `/frontend/src/pages/Home.tsx` (CẬP NHẬT)
- Import matchmaking service
- Thêm state: queueId, opponent, roomId
- Poll findMatch mỗi 2 giây khi trong queue
- Subscribe Realtime updates
- Hiển thị opponent info khi tìm thấy

### 3. `/frontend/src/pages/CreateRoom.tsx` (CẬP NHẬT)
- Import joinMatchmakingQueue
- Call API khi user click "TẠO PHÒNG NGAY"
- Lưu queueId vào localStorage

### 4. `/frontend/src/pages/InMatch.tsx` (CẬP NHẬT)
- Load opponent data từ localStorage
- Hiển thị thông tin opponent thật thay vì mock

## Testing

### Cần 2 accounts để test:
1. Login account 1 -> Tạo phòng Rank -> Tìm trận
2. Login account 2 (tab khác) -> Tạo phòng Rank -> Tìm trận
3. Sau vài giây sẽ match với nhau
4. Click "SẴN SÀNG" để vào trận

### Mock testing (1 account):
- Tạo fake users trong profiles table
- Insert fake queue entries vào matchmaking_queue
- Test UI flow

## Environment Variables cần thiết

```env
# frontend/.env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Supabase Setup cần làm

### 1. Enable Realtime
```
Supabase Dashboard -> Database -> Replication
-> Enable cho table: matchmaking_queue, rooms, room_players
```

### 2. RLS Policies (nếu enable RLS)
```sql
-- matchmaking_queue
CREATE POLICY "Users can view own queue" ON matchmaking_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queue" ON matchmaking_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own queue" ON matchmaking_queue
  FOR UPDATE USING (auth.uid() = user_id);

-- rooms
CREATE POLICY "Users can view all rooms" ON rooms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create rooms" ON rooms
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);

-- room_players
CREATE POLICY "Users can view room players" ON room_players
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can manage room players" ON room_players
  FOR ALL TO authenticated USING (true);
```

## Cải tiến có thể làm

### Short-term:
- [ ] Add loading spinner khi joining queue
- [ ] Show queue position
- [ ] Better error handling
- [ ] Timeout messages

### Mid-term:
- [ ] Websocket thay vì polling
- [ ] ELO calculation algorithm
- [ ] Ranked tier matching
- [ ] Region-based matching

### Long-term:
- [ ] AI opponent matching
- [ ] Tournament brackets
- [ ] Team matchmaking (2v2)
- [ ] Spectator mode

## Troubleshooting

### Không tìm được opponent
- Check có user nào khác trong queue không
- Check ELO range (±200)
- Check mode phải giống nhau
- Check Supabase connection

### Realtime không hoạt động
- Check Realtime enable trong Supabase
- Check browser console errors
- Fallback vẫn dùng polling

### Queue không cancel
- Check queueId đúng
- Check status update trong DB
- Manual cleanup nếu cần

## Notes
- Hiện tại opponent move vẫn là random (AI)
- Để implement multiplayer thật cần WebSocket/Realtime cho moves
- Xem file `/server/` hoặc `/backend/` để implement real-time game logic
