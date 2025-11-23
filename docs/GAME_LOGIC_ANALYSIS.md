# PHÂN TÍCH CHI TIẾT HỆ THỐNG GHÉP TRẬN VÀ LOGIC GAME

**Ngày phân tích:** 23/11/2025  
**Người thực hiện:** AI Analysis System  
**Phạm vi:** Matchmaking, Game Logic, Turn System, Win Detection, Rank/EXP System

---

## 📋 TÓM TẮT CÁC VẤN ĐỀ PHÁT HIỆN

### 🔴 CRITICAL - Nghiêm trọng

1. **KHÔNG CẬP NHẬT MINDPOINT/EXP SAU TRẬN**
   - File: `frontend/src/pages/InMatch.tsx` - hàm `handleGameEnd()`
   - Vị trí: Line 394-442
   - Vấn đề: Match kết thúc KHÔNG gọi hàm tính toán mindpoint_change
   - Ảnh hưởng: Player không nhận điểm sau khi thắng

2. **KHÔNG CẬP NHẬT RANK SAU TRẬN**
   - File: `infra/supabase_schema.sql` - function `update_user_rank()`
   - Vị trí: Line 1257-1281
   - Vấn đề: Function tồn tại NHƯNG không được gọi sau match
   - Ảnh hưởng: Rank không tự động thay đổi dù có đủ mindpoint

3. **LOGIC CHUYỂN LƯỢT SAI**
   - File: `frontend/src/pages/InMatch.tsx` - hàm `handleCellClick()`
   - Vị trí: Line 517
   - Code hiện tại:
   ```typescript
   currentTurn: result ? currentTurn : opponentSymbol
   ```
   - **LỖI LOGIC:** Khi có result (winner), vẫn giữ currentTurn không đổi
   - **VÍ DỤ GIẢ LẬP:**
     ```
     X đánh (5,5) → thắng
     result = 'X'
     currentTurn = 'X' (vì result = true)
     → Lượt tiếp theo vẫn là X → SAI!
     → Trò chơi đóng băng, không ai có thể đi tiếp
     ```

4. **KHÔNG HIỂN THỊ POPUP CHIẾN THẮNG**
   - File: `frontend/src/pages/InMatch.tsx`
   - Vị trí: Line 620-705
   - Vấn đề: Có code popup nhưng chỉ hiển thị khi `matchWinner !== null`
   - Thực tế: Popup game winner (`gameWinner`) không được hiển thị rõ ràng

### 🟡 HIGH - Quan trọng

5. **REALTIME KHÔNG ĐỒNG BỘ GIỮA 2 PLAYER**
   - File: `frontend/src/pages/InMatch.tsx` - useEffect realtime
   - Vị trí: Line 229-252
   - Vấn đề: Chỉ subscribe UPDATE của table `rooms`, không subscribe `moves`
   - Ảnh hưởng: X đánh xong → O có thể không thấy ngay lập tức

6. **THIẾU VALIDATION TURN Ở DATABASE**
   - File: `infra/supabase_schema.sql` - Policy `moves_insert`
   - Vị trí: Line 897-901
   - Vấn đề: Policy chỉ check auth.uid(), KHÔNG check turn trong game_state
   - Exploit: User có thể đánh nhiều lần liên tiếp bằng cách spam API

7. **MATCH RECORD KHÔNG CÓ PLAYER_O_USER_ID KHI TẠO**
   - File: `frontend/src/pages/InMatch.tsx` - initializeMatch
   - Vị trí: Line 167-182
   - Code:
   ```typescript
   const playerXId = roomPlayer?.player_side === 'X' ? user.id : null
   const playerOId = roomPlayer?.player_side === 'O' ? user.id : null
   ```
   - **LỖI:** Chỉ set ID của player hiện tại, không lấy opponent ID
   - **HẬU QUẢ:** Match record thiếu thông tin → không tính điểm cho cả 2

### 🟢 MEDIUM - Cần cải thiện

8. **HỆ THỐNG RANK KHÔNG RÕ RÀNG**
   - File: `infra/supabase_schema.sql` - function `update_user_rank()`
   - Vấn đề: Có 7 ranks nhưng ngưỡng mindpoint chưa hợp lý:
     - vo_danh: 0-99 (TOO EASY)
     - tan_ky: 100-499
     - hoc_ky: 500-1499
     - ky_lao: 1500-2999
     - cao_ky: 3000-4999
     - ky_thanh: 5000-7999
     - truyen_thuyet: 8000+

9. **CALCULATE_MINDPOINT_CHANGE CHƯA ĐƯỢC SỬ DỤNG**
   - File: `infra/supabase_schema.sql`
   - Vị trí: Line 1213-1256
   - Function tồn tại nhưng KHÔNG được gọi trong `handleGameEnd()`

10. **TRIGGER UPDATE_PROFILE_STATS CHỈ CHẠY KHI UPDATE MATCHES**
    - File: `infra/supabase_schema.sql`
    - Vị trí: Line 739-789
    - Vấn đề: Trigger chỉ chạy khi `ended_at` thay đổi
    - **ĐIỀU KIỆN:** Phải có `player_x_mindpoint_change` và `player_o_mindpoint_change`
    - **THỰC TẾ:** Frontend KHÔNG set 2 trường này → Trigger chạy nhưng không cộng điểm

---

## 🔬 PHÂN TÍCH CHI TIẾT TỪNG VẤN ĐỀ

### VẤN ĐỀ 1: Logic Chuyển Lượt Sai

**File:** `frontend/src/pages/InMatch.tsx:517`

**Code hiện tại:**
```typescript
const newState: GameState = {
  board: newBoard,
  moves: newMoves,
  currentTurn: result ? currentTurn : opponentSymbol, // ❌ SAI
  currentGame,
  scores,
  totalTimeX: playerSymbol === 'X' ? totalTimeX : gameState.totalTimeX,
  totalTimeO: playerSymbol === 'O' ? totalTimeO : gameState.totalTimeO,
  gameStartedAt: gameState.gameStartedAt,
  lastMoveAt: new Date().toISOString()
}
```

**Giả lập lỗi:**
```
STATE BAN ĐẦU:
- currentTurn: 'X'
- playerSymbol: 'X'
- opponentSymbol: 'O'
- board: rỗng

BƯỚC 1: X đánh (7, 7)
- newBoard[7][7] = 'X'
- result = checkWinner(newBoard, 7, 7) → null (chưa đủ 5)
- currentTurn = result ? 'X' : 'O' → 'O' ✅ ĐÚNG
- Game state được update → O nhận realtime

BƯỚC 2: O đánh (7, 8)
- newBoard[7][8] = 'O'
- result = null
- currentTurn = null ? 'O' : 'X' → 'X' ✅ ĐÚNG

BƯỚC 3-8: X và O đánh tiếp...

BƯỚC 9: X đánh (7, 11) → THẮNG!
- newBoard[7][11] = 'X'
- result = checkWinner(newBoard, 7, 11) → 'X' ✅ Phát hiện thắng
- currentTurn = 'X' ? 'X' : 'O' → 'X' ❌ SAI!!!
  
  LOGIC SAI:
  - result = 'X' (truthy)
  - Điều kiện: result ? currentTurn : opponentSymbol
  - Kết quả: currentTurn vẫn là 'X'
  
  ĐÁNG LẼ:
  - Khi game kết thúc, currentTurn không còn ý nghĩa
  - HOẶC nên set thành null
  - HOẶC không nên dùng để check nữa
```

**Hậu quả:**
- O nhận được game state với `currentTurn: 'X'` và `gameWinner: 'X'`
- O thấy màn hình nhưng KHÔNG hiển thị popup rõ ràng
- Nếu có bug khác, game có thể đóng băng

**Giải pháp:**
```typescript
currentTurn: result ? null : opponentSymbol, // null khi game kết thúc
```

---

### VẤN ĐỀ 2: Không cập nhật Mindpoint/EXP

**File:** `frontend/src/pages/InMatch.tsx:394-442`

**Code hiện tại:**
```typescript
const handleGameEnd = async (winner: 'X' | 'O' | 'draw') => {
  if (!roomId) return

  console.log('🏁 Game ended. Winner:', winner)
  setGameWinner(winner)

  // Update scores
  const newScores = { ...scores }
  if (winner !== 'draw') {
    newScores[winner]++
  }

  // Check if match is over (best of 3)
  const matchOver = newScores.X >= 2 || newScores.O >= 2
  const finalMatchWinner = newScores.X >= 2 ? 'X' : newScores.O >= 2 ? 'O' : null

  if (matchOver && finalMatchWinner) {
    console.log('Match over! Winner:', finalMatchWinner)
    setMatchWinner(finalMatchWinner)

    // Update match record
    if (matchId) {
      await supabase
        .from('matches')
        .update({
          winner_user_id: finalMatchWinner === playerSymbol ? user?.id : null, // ❌ SAI
          result: finalMatchWinner === 'X' ? 'win_x' : 'win_o',
          ended_at: new Date().toISOString(),
          total_moves: moveHistory.length
          // ❌ THIẾU: player_x_mindpoint_change
          // ❌ THIẾU: player_o_mindpoint_change
        })
        .eq('id', matchId)
    }
    // ❌ THIẾU: Không gọi calculate_mindpoint_change
    // ❌ THIẾU: Không gọi update_user_rank
  }
}
```

**Giả lập:**
```
STATE:
- Player X (user.id: 'aaa-111'): mindpoint = 50, rank = 'vo_danh'
- Player O (opponent.id: 'bbb-222'): mindpoint = 80, rank = 'vo_danh'
- Match: best of 3

VÁN 1: X thắng → scores = {X: 1, O: 0}
VÁN 2: X thắng → scores = {X: 2, O: 0}

→ matchOver = true, finalMatchWinner = 'X'

CODE THỰC TẾ:
await supabase.from('matches').update({
  winner_user_id: 'aaa-111',
  result: 'win_x',
  ended_at: '2025-11-23T10:30:00Z',
  total_moves: 45
  // player_x_mindpoint_change: 0 (default) ❌
  // player_o_mindpoint_change: 0 (default) ❌
})

TRIGGER update_profile_stats_after_match CHẠY:
UPDATE profiles
  SET mindpoint = mindpoint + COALESCE(0, 0) // = mindpoint + 0
WHERE user_id = 'aaa-111'
→ mindpoint vẫn là 50 ❌ KHÔNG THAY ĐỔI!

UPDATE profiles
  SET mindpoint = mindpoint + COALESCE(0, 0)
WHERE user_id = 'bbb-222'
→ mindpoint vẫn là 80 ❌ KHÔNG THAY ĐỔI!

KẾT QUẢ:
- X thắng nhưng không được cộng điểm
- O thua nhưng không bị trừ điểm
- Rank không đổi
```

**Giải pháp:**
1. Gọi function `calculate_mindpoint_change()` trong frontend
2. Hoặc tạo RPC function trong Supabase để tự động tính
3. Update match record với mindpoint_change

---

### VẤN ĐỀ 3: Không hiển thị Popup chiến thắng

**File:** `frontend/src/pages/InMatch.tsx:620-705`

**Code hiện tại:**
```typescript
{/* Match Winner Modal */}
{matchWinner && (
  <div className="winner-modal-overlay">
    {/* ... hiển thị winner ... */}
  </div>
)}

{/* Game Winner - KHÔNG CÓ MODAL RIÊNG */}
{gameWinner && !matchWinner && (
  // ❌ KHÔNG CÓ CODE NÀY!
)}
```

**Vấn đề:**
- Chỉ có popup cho `matchWinner` (khi kết thúc cả trận best-of-3)
- KHÔNG có popup cho `gameWinner` (khi kết thúc 1 ván)
- User không biết ai thắng ván hiện tại

**Giả lập:**
```
VÁN 1: X thắng
- setGameWinner('X')
- matchWinner = null (vì scores = {X: 1, O: 0}, chưa đủ 2)
- UI: KHÔNG HIỂN THỊ GÌ ❌
- 3 giây sau: startNextGame() → reset gameWinner = null
- User: "Ủa, ai thắng vậy?" 🤔

VÁN 2: O thắng
- setGameWinner('O')
- matchWinner = null (scores = {X: 1, O: 1})
- UI: KHÔNG HIỂN THỊ GÌ ❌

VÁN 3: X thắng
- setGameWinner('X')
- scores = {X: 2, O: 1}
- matchWinner = 'X' ✅
- UI: HIỂN THỊ POPUP MATCH WINNER ✅
```

**Giải pháp:**
Thêm popup cho gameWinner:
```typescript
{gameWinner && !matchWinner && (
  <div className="game-winner-toast">
    🏆 {gameWinner === playerSymbol ? 'Bạn' : 'Đối thủ'} thắng ván này!
    <br />
    Tỷ số: X {scores.X} - {scores.O} O
  </div>
)}
```

---

### VẤN ĐỀ 4: Realtime không đồng bộ

**File:** `frontend/src/pages/InMatch.tsx:229-252`

**Code hiện tại:**
```typescript
React.useEffect(() => {
  if (!roomId) return

  const channel = supabase
    .channel(`game-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms', // ❌ Chỉ subscribe rooms
        filter: `id=eq.${roomId}`
      },
      (payload) => {
        const newRoom = payload.new as any
        if (newRoom.game_state) {
          setGameState(newRoom.game_state as GameState)
        }
      }
    )
    .subscribe()

  return () => {
    channel.unsubscribe()
  }
}, [roomId])
```

**Vấn đề:**
- Chỉ subscribe UPDATE của table `rooms`
- `game_state` là JSONB field → có thể bị delay khi Supabase Realtime serialize
- Không subscribe table `moves` → không biết khi nào có move mới

**Giả lập:**
```
TIME: 10:00:00.000
X đánh (5, 5) → Update rooms.game_state

TIME: 10:00:00.050
Supabase nhận request

TIME: 10:00:00.100
Supabase UPDATE rooms

TIME: 10:00:00.150
Realtime serialize game_state (JSONB → JSON)

TIME: 10:00:00.200
Realtime broadcast qua WebSocket

TIME: 10:00:00.250
O nhận được payload → setGameState()

TOTAL DELAY: 250ms

NẾU NETWORK CHẬM:
- WebSocket lag: +200ms
- Total: 450ms
- User experience: "Lag quá!" 😤
```

**Giải pháp:**
1. Subscribe cả `moves` table để update nhanh hơn
2. Hoặc dùng Supabase Broadcast (faster than Postgres Changes)
3. Optimistic update: X đánh → update UI ngay, không chờ realtime

---

### VẤN ĐỀ 5: Thiếu validation turn ở database

**File:** `infra/supabase_schema.sql:897-901`

**Code hiện tại:**
```sql
CREATE POLICY moves_insert ON moves FOR INSERT WITH CHECK (
  auth.uid()::uuid = player_user_id
  AND (SELECT ended_at IS NULL FROM matches WHERE id = match_id)
);
```

**Vấn đề:**
- Policy KHÔNG check `currentTurn` trong `rooms.game_state`
- Hacker có thể spam INSERT moves

**Giả lập exploit:**
```javascript
// Hacker code (X's turn)
for (let i = 0; i < 100; i++) {
  await supabase.from('moves').insert({
    match_id: 'xxx',
    player_user_id: 'O-user-id', // ❌ Không phải turn của O
    move_number: i,
    position_x: i % 15,
    position_y: Math.floor(i / 15),
    turn_player: 'O'
  })
}

// Policy check:
// ✅ auth.uid() = 'O-user-id' → PASS
// ✅ match.ended_at IS NULL → PASS
// ❌ KHÔNG CHECK currentTurn = 'X' → O vẫn insert được!

// Kết quả: Database có 100 moves của O mặc dù không phải turn
```

**Giải pháp:**
Thêm validation vào policy:
```sql
CREATE POLICY moves_insert ON moves FOR INSERT WITH CHECK (
  auth.uid()::uuid = player_user_id
  AND (SELECT ended_at IS NULL FROM matches WHERE id = match_id)
  AND (
    SELECT (game_state->>'currentTurn') = turn_player
    FROM rooms
    WHERE id = (SELECT room_id FROM matches WHERE id = match_id)
  )
);
```

---

### VẤN ĐỀ 6: Match record thiếu opponent ID

**File:** `frontend/src/pages/InMatch.tsx:167-182`

**Code hiện tại:**
```typescript
const playerXId = roomPlayer?.player_side === 'X' ? user.id : null
const playerOId = roomPlayer?.player_side === 'O' ? user.id : null

const { data: newMatch, error: createError } = await supabase
  .from('matches')
  .insert({
    room_id: storedRoomId,
    match_type: 'ranked',
    player_x_user_id: playerXId, // ❌ Có thể là null
    player_o_user_id: playerOId, // ❌ Có thể là null
    started_at: new Date().toISOString()
  })
```

**Giả lập:**
```
PLAYER X (user.id = 'aaa'):
- roomPlayer.player_side = 'X'
- playerXId = 'aaa' ✅
- playerOId = null ❌

MATCH RECORD:
{
  player_x_user_id: 'aaa',
  player_o_user_id: null, // ❌ THIẾU OPPONENT
  match_type: 'ranked'
}

KHI KẾT THÚC:
handleGameEnd() → update matches
- winner_user_id = 'aaa'
- player_x_mindpoint_change = 25
- player_o_mindpoint_change = -10

TRIGGER update_profile_stats:
- UPDATE profiles WHERE user_id = 'aaa' ✅
- UPDATE profiles WHERE user_id = NULL ❌ KHÔNG CHẠY!

KẾT QUẢ:
- X được cộng điểm ✅
- O KHÔNG được cập nhật stats ❌
```

**Giải pháp:**
Lấy opponent ID từ `room_players`:
```typescript
// Lấy cả 2 players
const { data: players } = await supabase
  .from('room_players')
  .select('user_id, player_side')
  .eq('room_id', storedRoomId)

const playerX = players?.find(p => p.player_side === 'X')
const playerO = players?.find(p => p.player_side === 'O')

const { data: newMatch } = await supabase
  .from('matches')
  .insert({
    room_id: storedRoomId,
    match_type: 'ranked',
    player_x_user_id: playerX?.user_id, // ✅ Luôn có
    player_o_user_id: playerO?.user_id, // ✅ Luôn có
    started_at: new Date().toISOString()
  })
```

---

### VẤN ĐỀ 7: Hệ thống Rank không rõ ràng

**File:** `infra/supabase_schema.sql:1257-1281`

**Code hiện tại:**
```sql
CREATE OR REPLACE FUNCTION update_user_rank(p_user_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  current_mp INTEGER;
  new_rank VARCHAR(50);
BEGIN
  SELECT mindpoint INTO current_mp FROM profiles WHERE user_id = p_user_id;
  
  IF current_mp < 100 THEN new_rank := 'vo_danh';
  ELSIF current_mp < 500 THEN new_rank := 'tan_ky';
  ELSIF current_mp < 1500 THEN new_rank := 'hoc_ky';
  ELSIF current_mp < 3000 THEN new_rank := 'ky_lao';
  ELSIF current_mp < 5000 THEN new_rank := 'cao_ky';
  ELSIF current_mp < 8000 THEN new_rank := 'ky_thanh';
  ELSE new_rank := 'truyen_thuyet';
  END IF;
  
  UPDATE profiles SET current_rank = new_rank WHERE user_id = p_user_id;
  
  RETURN new_rank;
END;
$$ LANGUAGE plpgsql;
```

**Phân tích:**
```
RANK TIERS:
1. vo_danh (Vô Danh): 0-99 MP
   - TOO EASY: 1 trận thắng = ~25 MP → 4 trận lên rank
   
2. tan_ky (Tân Kỳ): 100-499 MP
   - Cần thêm 400 MP = ~16 trận thắng
   
3. hoc_ky (Học Kỳ): 500-1499 MP
   - Cần thêm 1000 MP = ~40 trận thắng
   
4. ky_lao (Kỳ Lão): 1500-2999 MP
   - Cần thêm 1500 MP = ~60 trận thắng
   
5. cao_ky (Cao Kỳ): 3000-4999 MP
   - Cần thêm 2000 MP = ~80 trận thắng
   
6. ky_thanh (Kỳ Thánh): 5000-7999 MP
   - Cần thêm 3000 MP = ~120 trận thắng
   
7. truyen_thuyet (Truyền Thuyết): 8000+ MP
   - Cần thêm 320 trận thắng tổng cộng

VẤN ĐỀ:
- Rank đầu quá dễ (4 trận)
- Rank cuối quá khó (320 trận)
- Không có hệ thống decay (idle → mất rank)
- Không có MMR matching (rank thấp gặp rank cao)
```

**Đề xuất cải thiện:**
```sql
-- Cân bằng lại ngưỡng
IF current_mp < 50 THEN new_rank := 'vo_danh';        -- 2 trận
ELSIF current_mp < 200 THEN new_rank := 'tan_ky';     -- +6 trận
ELSIF current_mp < 600 THEN new_rank := 'hoc_ky';     -- +16 trận
ELSIF current_mp < 1500 THEN new_rank := 'ky_lao';    -- +36 trận
ELSIF current_mp < 3000 THEN new_rank := 'cao_ky';    -- +60 trận
ELSIF current_mp < 5500 THEN new_rank := 'ky_thanh';  -- +100 trận
ELSE new_rank := 'truyen_thuyet';                      -- +150 trận tổng
END IF;
```

---

## 📊 BẢNG TÓM TẮT LỖI

| # | Vấn đề | File | Độ ưu tiên | Ảnh hưởng | Thời gian fix |
|---|--------|------|-----------|-----------|---------------|
| 1 | Logic chuyển lượt sai | InMatch.tsx:517 | 🔴 CRITICAL | Game đóng băng | 5 phút |
| 2 | Không cộng Mindpoint | InMatch.tsx:394 | 🔴 CRITICAL | Mất động lực chơi | 30 phút |
| 3 | Không cập nhật Rank | InMatch.tsx:442 | 🔴 CRITICAL | Progression bị vỡ | 15 phút |
| 4 | Không popup winner | InMatch.tsx:620 | 🔴 CRITICAL | UX tệ | 20 phút |
| 5 | Realtime lag | InMatch.tsx:229 | 🟡 HIGH | UX lag | 45 phút |
| 6 | Thiếu validation turn | supabase_schema.sql:897 | 🟡 HIGH | Security hole | 30 phút |
| 7 | Match thiếu opponent ID | InMatch.tsx:167 | 🟡 HIGH | Stats không chính xác | 20 phút |
| 8 | Rank progression không rõ | supabase_schema.sql:1257 | 🟢 MEDIUM | Balance vấn đề | 1 giờ |
| 9 | Function không dùng | supabase_schema.sql:1213 | 🟢 MEDIUM | Code thừa | 10 phút |
| 10 | Trigger điều kiện yếu | supabase_schema.sql:739 | 🟢 MEDIUM | Edge cases | 30 phút |

**TỔNG THỜI GIAN ƯỚC TÍNH: 4-5 giờ**

---

## ✅ KẾT LUẬN

Hệ thống có **kiến trúc tốt** nhưng **thiếu implementation chi tiết**:
- ✅ Database schema đầy đủ
- ✅ Functions SQL đã được định nghĩa
- ❌ Frontend không gọi đúng functions
- ❌ Thiếu validation ở nhiều nơi
- ❌ UX chưa hoàn thiện

**Ưu tiên sửa:**
1. Fix logic chuyển lượt (5 phút)
2. Thêm popup game winner (20 phút)
3. Cập nhật mindpoint sau trận (30 phút)
4. Cập nhật rank (15 phút)
5. Fix match opponent ID (20 phút)

**Tổng: 1.5 giờ để fix các lỗi CRITICAL**

