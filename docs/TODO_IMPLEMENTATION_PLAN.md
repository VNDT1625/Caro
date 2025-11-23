# 📋 KẾ HOẠCH THỰC HIỆN SỬA LỖI HỆ THỐNG GAME

**Dự án:** Mindpoint Arena - Caro Game  
**Ngày:** 23/11/2025  
**Tổng thời gian ước tính:** 4-5 giờ  
**Tài liệu phân tích:** `docs/GAME_LOGIC_ANALYSIS.md`

---

## 🎯 CHIẾN LƯỢC THỰC HIỆN

### Nguyên tắc:
1. ✅ Sửa lỗi CRITICAL trước (ảnh hưởng trực tiếp gameplay)
2. ✅ Test sau mỗi fix bằng giả lập
3. ✅ Commit sau mỗi task hoàn thành
4. ✅ Cập nhật TODO list realtime

### Phân chia:
- **Phase 1:** Fix lỗi CRITICAL (1.5h)
- **Phase 2:** Fix lỗi HIGH (2h)
- **Phase 3:** Cải thiện MEDIUM (1.5h)
- **Phase 4:** Testing tổng thể (0.5h)

---

## PHASE 1: FIX LỖI CRITICAL (1.5 giờ)

### ✅ TODO 1.1: Sửa logic chuyển lượt sai
**Ưu tiên:** 🔴 CRITICAL  
**Thời gian:** 5 phút  
**File:** `frontend/src/pages/InMatch.tsx`

#### Prompt thực hiện:
```
Sửa logic chuyển lượt trong hàm handleCellClick() tại line 517:

TỪ:
currentTurn: result ? currentTurn : opponentSymbol

THÀNH:
currentTurn: result ? currentTurn : opponentSymbol

LÝ DO: Khi game kết thúc (result !== null), không nên chuyển lượt nữa.
Nhưng để tránh bug UI, vẫn giữ currentTurn hiện tại cho đến khi reset game.

TESTING:
1. X đánh → thắng
2. Check: currentTurn vẫn là 'X'
3. Check: gameWinner = 'X'
4. Check: Không thể đánh thêm nước
5. Sau 3s → startNextGame() → reset currentTurn = 'X'
```

#### Code cần sửa:
```typescript
// File: frontend/src/pages/InMatch.tsx
// Line: ~517

// ❌ CŨ:
const newState: GameState = {
  board: newBoard,
  moves: newMoves,
  currentTurn: result ? currentTurn : opponentSymbol,
  // ...
}

// ✅ MỚI:
const newState: GameState = {
  board: newBoard,
  moves: newMoves,
  currentTurn: result ? currentTurn : opponentSymbol, // Giữ nguyên nếu có winner
  // ...
}

// THỰC RA CODE ĐÃ ĐÚNG, NHƯNG CẦN THÊM CHECK Ở ĐIỀU KIỆN CLICK:
// Line ~488
if (currentTurn !== playerSymbol) {
  console.log('❌ Not your turn')
  return
}

// Thêm check gameWinner:
if (gameWinner || matchWinner) {
  console.log('❌ Game already ended')
  return
}
```

**Giả lập test:**
```javascript
// Test case 1: X đánh thắng
playerSymbol = 'X'
currentTurn = 'X'
board[7][7] = 'X' // Nước thứ 5 liên tiếp
result = checkWinner(board, 7, 7) // = 'X'

newState.currentTurn = result ? 'X' : 'O' // = 'X'
setGameState(newState)

// Opponent (O) nhận realtime
// currentTurn = 'X' (không phải 'O')
// gameWinner = 'X'
// → O không thể đánh (check currentTurn !== playerSymbol) ✅

// Test case 2: Chơi tiếp ván mới
startNextGame()
// currentTurn = 'X' (reset)
// gameWinner = null
// → X có thể đánh ✅
```

---

### ✅ TODO 1.2: Thêm popup hiển thị winner từng ván
**Ưu tiên:** 🔴 CRITICAL  
**Thời gian:** 20 phút  
**File:** `frontend/src/pages/InMatch.tsx`

#### Prompt thực hiện:
```
Thêm popup/toast hiển thị kết quả sau mỗi ván (không phải cả trận).

VỊ TRÍ: Sau line 620, trước match winner modal

CODE CẦN THÊM:
- UI: Toast animation từ trên xuống
- Nội dung: "{Winner} thắng ván {currentGame}! | Tỷ số: X {scores.X} - {scores.O} O"
- Thời gian: Hiển thị 3 giây rồi tự đóng (đúng lúc startNextGame)
- Style: Gradient background theo winner (X = cyan, O = orange)

ĐIỀU KIỆN HIỂN THỊ:
- gameWinner !== null
- matchWinner === null (chưa kết thúc trận)
```

#### Code cần thêm:
```typescript
// File: frontend/src/pages/InMatch.tsx
// Thêm vào ~line 625 (trước Match Winner Modal)

{/* Game Winner Toast - Hiển thị kết quả từng ván */}
{gameWinner && !matchWinner && (
  <div 
    className="game-winner-toast"
    style={{
      position: 'fixed',
      top: '20%',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: gameWinner === 'X' 
        ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.95), rgba(6, 182, 212, 0.95))'
        : gameWinner === 'O'
        ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.95), rgba(217, 119, 6, 0.95))'
        : 'linear-gradient(135deg, rgba(100, 100, 100, 0.95), rgba(60, 60, 60, 0.95))',
      padding: '24px 40px',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      animation: 'slideDown 0.5s ease-out',
      textAlign: 'center'
    }}
  >
    <div style={{ fontSize: '48px', marginBottom: '12px' }}>
      {gameWinner === 'draw' ? '🤝' : '🏆'}
    </div>
    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
      {gameWinner === 'draw' 
        ? 'Hòa!' 
        : `${gameWinner === playerSymbol ? 'Bạn' : 'Đối thủ'} thắng ván ${currentGame}!`
      }
    </div>
    <div style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.9)' }}>
      Tỷ số: <span style={{ fontWeight: 'bold' }}>X {scores.X}</span> - <span style={{ fontWeight: 'bold' }}>{scores.O} O</span>
    </div>
    <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '8px' }}>
      Ván tiếp theo sẽ bắt đầu sau 3 giây...
    </div>
  </div>
)}

{/* Thêm CSS animation */}
<style>{`
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-50px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
`}</style>
```

**Giả lập test:**
```javascript
// Test case 1: X thắng ván 1
gameWinner = 'X'
matchWinner = null
scores = { X: 1, O: 0 }
currentGame = 1

// UI hiển thị:
// 🏆
// "Bạn thắng ván 1!" (nếu playerSymbol = 'X')
// "Tỷ số: X 1 - 0 O"
// Sau 3s → popup biến mất → startNextGame()

// Test case 2: Hòa ván 2
gameWinner = 'draw'
scores = { X: 1, O: 0 } // Không đổi

// UI hiển thị:
// 🤝
// "Hòa!"
// "Tỷ số: X 1 - 0 O"
```

---

### ✅ TODO 1.3: Tính và cập nhật Mindpoint sau trận
**Ưu tiên:** 🔴 CRITICAL  
**Thời gian:** 30 phút  
**File:** `frontend/src/pages/InMatch.tsx`

#### Prompt thực hiện - Part A (5 phút):
```
Tạo hàm helper calculateMindpointChange() trong InMatch.tsx:

INPUT:
- isWinner: boolean
- totalMoves: number
- playerRank: string
- opponentRank: string
- timeDifference: number (thời gian còn lại)

OUTPUT:
- mindpointChange: number (có thể âm)

LOGIC:
1. Base points = 20
2. Quick win bonus: moves < 50 → +10
3. Time bonus: timeLeft > 180s → +5
4. Rank difference:
   - Beat higher rank → +10 to +20
   - Beat same rank → +0
   - Beat lower rank → -5
5. Loser: -15 base

CODE:
function calculateMindpointChange(
  isWinner: boolean,
  totalMoves: number,
  playerRank: string,
  opponentRank: string,
  timeRemaining: number
): number {
  if (!isWinner) return -15;
  
  let points = 20;
  
  if (totalMoves < 50) points += 10;
  if (timeRemaining > 180) points += 5;
  
  // Rank comparison (simplified)
  const rankValues: Record<string, number> = {
    'vo_danh': 0,
    'tan_ky': 1,
    'hoc_ky': 2,
    'ky_lao': 3,
    'cao_ky': 4,
    'ky_thanh': 5,
    'truyen_thuyet': 6
  };
  
  const playerRankValue = rankValues[playerRank] || 0;
  const opponentRankValue = rankValues[opponentRank] || 0;
  const diff = opponentRankValue - playerRankValue;
  
  if (diff > 0) points += diff * 5; // Beat higher rank
  else if (diff < 0) points += diff * 3; // Beat lower rank (penalty)
  
  return points;
}
```

#### Prompt thực hiện - Part B (25 phút):
```
Sửa hàm handleGameEnd() để tính và lưu mindpoint_change:

VỊ TRÍ: Line ~414-442

BƯỚC 1: Lấy thông tin cả 2 players
const { data: players } = await supabase
  .from('room_players')
  .select(`
    user_id,
    player_side,
    profiles!inner(current_rank)
  `)
  .eq('room_id', roomId)

const playerXData = players?.find(p => p.player_side === 'X')
const playerOData = players?.find(p => p.player_side === 'O')

BƯỚC 2: Tính mindpoint cho cả 2
const playerXMindpointChange = calculateMindpointChange(
  finalMatchWinner === 'X',
  moveHistory.length,
  playerXData?.profiles?.current_rank || 'vo_danh',
  playerOData?.profiles?.current_rank || 'vo_danh',
  totalTimeX
)

const playerOMindpointChange = calculateMindpointChange(
  finalMatchWinner === 'O',
  moveHistory.length,
  playerOData?.profiles?.current_rank || 'vo_danh',
  playerXData?.profiles?.current_rank || 'vo_danh',
  totalTimeO
)

BƯỚC 3: Update match với mindpoint_change
await supabase
  .from('matches')
  .update({
    winner_user_id: finalMatchWinner === 'X' ? playerXData?.user_id : playerOData?.user_id,
    result: finalMatchWinner === 'X' ? 'win_x' : 'win_o',
    ended_at: new Date().toISOString(),
    total_moves: moveHistory.length,
    player_x_mindpoint_change: playerXMindpointChange, // ✅ THÊM
    player_o_mindpoint_change: playerOMindpointChange  // ✅ THÊM
  })
  .eq('id', matchId)

LÝ DO: Trigger update_profile_stats_after_match sẽ tự động cộng trừ điểm
```

**Giả lập test:**
```javascript
// Setup
Player X: user_id='aaa', rank='tan_ky', mindpoint=150
Player O: user_id='bbb', rank='vo_danh', mindpoint=80

// Match: X thắng 2-0
totalMoves = 45
totalTimeX = 210s (còn nhiều)
totalTimeO = 50s

// Calculate mindpoint X (winner)
isWinner = true
points = 20 (base)
  + 10 (moves < 50)
  + 5 (time > 180)
  + 0 (same/lower rank: vo_danh < tan_ky → -3)
= 32 points

// Calculate mindpoint O (loser)
isWinner = false
points = -15

// Update match
player_x_mindpoint_change = 32
player_o_mindpoint_change = -15

// Trigger runs
UPDATE profiles SET mindpoint = 150 + 32 = 182 WHERE user_id='aaa'
UPDATE profiles SET mindpoint = 80 + (-15) = 65 WHERE user_id='bbb'

// Verify
SELECT mindpoint FROM profiles WHERE user_id='aaa' → 182 ✅
SELECT mindpoint FROM profiles WHERE user_id='bbb' → 65 ✅
```

---

### ✅ TODO 1.4: Tự động cập nhật rank sau trận
**Ưu tiên:** 🔴 CRITICAL  
**Thời gian:** 15 phút  
**File:** `frontend/src/pages/InMatch.tsx`

#### Prompt thực hiện:
```
Sau khi update match (TODO 1.3), gọi function update_user_rank() cho cả 2 players:

VỊ TRÍ: Trong handleGameEnd(), sau UPDATE matches

CODE:
// Update rank cho cả 2 players
const { data: newRankX } = await supabase
  .rpc('update_user_rank', { p_user_id: playerXData?.user_id })

const { data: newRankO } = await supabase
  .rpc('update_user_rank', { p_user_id: playerOData?.user_id })

console.log('✅ Ranks updated:', {
  playerX: newRankX,
  playerO: newRankO
})

// Optional: Hiển thị rank up notification
if (finalMatchWinner === playerSymbol && newRankX !== playerXData?.profiles?.current_rank) {
  // TODO: Show "RANK UP!" animation
  console.log('🎉 RANK UP!', newRankX)
}
```

**Giả lập test:**
```javascript
// Setup (tiếp từ TODO 1.3)
Player X: mindpoint=182 (từ 150)
Player O: mindpoint=65 (từ 80)

// Call RPC
supabase.rpc('update_user_rank', { p_user_id: 'aaa' })

// Function runs:
current_mp = 182
IF 182 < 100 THEN 'vo_danh'      → FALSE
ELSIF 182 < 500 THEN 'tan_ky'    → TRUE ✅

UPDATE profiles SET current_rank = 'tan_ky' WHERE user_id='aaa'
RETURN 'tan_ky'

// Player O:
current_mp = 65
IF 65 < 100 THEN 'vo_danh'       → TRUE ✅

UPDATE profiles SET current_rank = 'vo_danh' WHERE user_id='bbb'
RETURN 'vo_danh'

// Verify:
Player X: rank='tan_ky' (không đổi)
Player O: rank='vo_danh' (không đổi)

// Test rank up:
Player X ban đầu: mindpoint=95, rank='vo_danh'
Thắng: +32 → mindpoint=127
update_user_rank() → rank='tan_ky' ✅ RANK UP!

// UI hiển thị:
"🎉 RANK UP! Bạn đã lên Tân Kỳ!"
```

---

## PHASE 2: FIX LỖI HIGH (2 giờ)

### ✅ TODO 2.1: Fix match record thiếu opponent ID
**Ưu tiên:** 🟡 HIGH  
**Thời gian:** 20 phút  
**File:** `frontend/src/pages/InMatch.tsx`

#### Prompt thực hiện:
```
Sửa hàm initializeMatch() để lấy đúng cả 2 player IDs:

VỊ TRÍ: Line ~167-182

TỪ:
const playerXId = roomPlayer?.player_side === 'X' ? user.id : null
const playerOId = roomPlayer?.player_side === 'O' ? user.id : null

THÀNH:
// Lấy cả 2 players từ room
const { data: allPlayers, error: playersError } = await supabase
  .from('room_players')
  .select('user_id, player_side')
  .eq('room_id', storedRoomId)

if (!allPlayers || allPlayers.length < 2) {
  console.error('❌ Room must have 2 players')
  setIsLoading(false)
  return
}

const playerX = allPlayers.find(p => p.player_side === 'X')
const playerO = allPlayers.find(p => p.player_side === 'O')

if (!playerX || !playerO) {
  console.error('❌ Missing X or O player')
  setIsLoading(false)
  return
}

// Create match với đầy đủ info
const { data: newMatch, error: createError } = await supabase
  .from('matches')
  .insert({
    room_id: storedRoomId,
    match_type: 'ranked',
    player_x_user_id: playerX.user_id, // ✅ Luôn có
    player_o_user_id: playerO.user_id, // ✅ Luôn có
    started_at: new Date().toISOString()
  })
  .select()
  .single()
```

**Giả lập test:**
```javascript
// Setup
Room ID: 'room-123'
room_players:
  - { user_id: 'aaa', player_side: 'X' }
  - { user_id: 'bbb', player_side: 'O' }

// User X chạy initializeMatch()
const allPlayers = [
  { user_id: 'aaa', player_side: 'X' },
  { user_id: 'bbb', player_side: 'O' }
]

playerX = { user_id: 'aaa', player_side: 'X' }
playerO = { user_id: 'bbb', player_side: 'O' }

// Insert match
{
  player_x_user_id: 'aaa',  ✅
  player_o_user_id: 'bbb',  ✅
  match_type: 'ranked'
}

// Verify: Match có đầy đủ 2 IDs
SELECT * FROM matches WHERE room_id='room-123'
→ player_x_user_id='aaa', player_o_user_id='bbb' ✅
```

---

### ✅ TODO 2.2: Cải thiện Realtime đồng bộ
**Ưu tiên:** 🟡 HIGH  
**Thời gian:** 45 phút  
**File:** `frontend/src/pages/InMatch.tsx`

#### Prompt thực hiện:
```
Thêm optimistic update và subscribe moves table:

BƯỚC 1: Optimistic update (Line ~500-520 trong handleCellClick)
TỪ:
// Update game state
const newState = { ... }
await supabase.from('rooms').update({ game_state: newState })

THÀNH:
// ✅ Update local state IMMEDIATELY (optimistic)
setGameState(newState)
setLastMovePosition({ x, y })

// Then sync to database
const { error } = await supabase
  .from('rooms')
  .update({ game_state: newState })
  .eq('id', roomId)

if (error) {
  console.error('❌ Failed to sync, reverting...')
  // Revert optimistic update
  setGameState(gameState) // old state
  return
}

LÝ DO: User thấy move ngay lập tức, không chờ database

BƯỚC 2: Subscribe moves table (Line ~229-252)
THÊM channel mới:

const movesChannel = supabase
  .channel(`moves-${matchId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'moves',
      filter: `match_id=eq.${matchId}`
    },
    (payload) => {
      console.log('🎲 New move detected:', payload.new)
      const move = payload.new as any
      
      // Nếu không phải move của mình, update UI
      if (move.player_user_id !== user?.id) {
        // Refresh game state từ rooms
        fetchLatestGameState()
      }
    }
  )
  .subscribe()

return () => {
  channel.unsubscribe()
  movesChannel.unsubscribe()
}
```

**Giả lập test:**
```javascript
// Timeline WITHOUT optimistic update:
T+0ms: X click cell
T+50ms: handleCellClick() → create newState
T+100ms: supabase.update() → send to server
T+200ms: Server processes → UPDATE rooms
T+250ms: Realtime broadcast
T+300ms: O receives update → setGameState()

TOTAL LATENCY: 300ms

// Timeline WITH optimistic update:
T+0ms: X click cell
T+0ms: setGameState(newState) ✅ INSTANT
T+50ms: supabase.update() → send to server
T+200ms: Server processes
T+250ms: O receives update → setGameState()

X sees move: 0ms ✅
O sees move: 250ms (same as before)
Improvement: X doesn't wait!

// Edge case: Network error
T+0ms: X click → optimistic update
T+1000ms: supabase.update() → ERROR
T+1001ms: Revert → setGameState(oldState)
X sees: Move appears then disappears (feedback!)
```

---

### ✅ TODO 2.3: Thêm validation turn ở database
**Ưu tiên:** 🟡 HIGH  
**Thời gian:** 30 phút  
**File:** `infra/supabase_schema.sql` + migration

#### Prompt thực hiện:
```
Tạo migration mới để update RLS policy cho moves table:

FILE: infra/migrations/0012_validate_turn_on_moves.sql

CONTENT:
-- Drop old policy
DROP POLICY IF EXISTS moves_insert ON moves;

-- Create new policy with turn validation
CREATE POLICY moves_insert ON moves FOR INSERT WITH CHECK (
  -- Check 1: Must be authenticated user
  auth.uid()::uuid = player_user_id
  
  -- Check 2: Match must not be ended
  AND (SELECT ended_at IS NULL FROM matches WHERE id = match_id)
  
  -- Check 3: Must be your turn
  AND (
    SELECT 
      CASE 
        WHEN game_state IS NULL THEN true -- No game state yet, allow
        WHEN game_state->>'currentTurn' = turn_player THEN true
        ELSE false
      END
    FROM rooms
    WHERE id = (SELECT room_id FROM matches WHERE id = match_id)
  )
);

-- Test the policy
DO $$
DECLARE
  test_user_id UUID := 'test-user-123';
BEGIN
  -- This should PASS if it's X's turn
  INSERT INTO moves (match_id, player_user_id, move_number, position_x, position_y, turn_player)
  VALUES ('test-match', test_user_id, 1, 5, 5, 'X');
  
  -- This should FAIL if it's X's turn but we try to insert O's move
  INSERT INTO moves (match_id, player_user_id, move_number, position_x, position_y, turn_player)
  VALUES ('test-match', test_user_id, 2, 5, 6, 'O');
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy test completed with expected errors';
END $$;
```

**Giả lập test:**
```sql
-- Setup
INSERT INTO rooms (id, game_state) VALUES 
('room-1', '{"currentTurn": "X", "board": [[null, ...]], ...}');

INSERT INTO matches (id, room_id, player_x_user_id, player_o_user_id) VALUES
('match-1', 'room-1', 'user-x', 'user-o');

-- Test 1: X's turn, X inserts move → SHOULD PASS
SET LOCAL auth.uid TO 'user-x';
INSERT INTO moves (match_id, player_user_id, move_number, position_x, position_y, turn_player)
VALUES ('match-1', 'user-x', 1, 5, 5, 'X');
-- ✅ SUCCESS

-- Test 2: X's turn, O tries to insert → SHOULD FAIL
SET LOCAL auth.uid TO 'user-o';
INSERT INTO moves (match_id, player_user_id, move_number, position_x, position_y, turn_player)
VALUES ('match-1', 'user-o', 2, 5, 6, 'O');
-- ❌ POLICY VIOLATION: currentTurn='X' but turn_player='O'

-- Test 3: After X's move, update room to O's turn
UPDATE rooms SET game_state = '{"currentTurn": "O", ...}' WHERE id='room-1';

SET LOCAL auth.uid TO 'user-o';
INSERT INTO moves (match_id, player_user_id, move_number, position_x, position_y, turn_player)
VALUES ('match-1', 'user-o', 2, 5, 6, 'O');
-- ✅ SUCCESS (now it's O's turn)
```

---

## PHASE 3: CẢI THIỆN MEDIUM (1.5 giờ)

### ✅ TODO 3.1: Cân bằng lại hệ thống Rank
**Ưu tiên:** 🟢 MEDIUM  
**Thời gian:** 1 giờ  
**File:** `infra/supabase_schema.sql` + `docs/RANK_SYSTEM.md`

#### Prompt thực hiện - Part A (30 phút):
```
Tạo document chi tiết về rank system:

FILE: docs/RANK_SYSTEM.md

CONTENT:
# Hệ thống Rank - Mindpoint Arena

## 📊 Rank Tiers

| Rank | Tên Việt | Mindpoint Range | Số trận cần* | Đặc điểm |
|------|----------|----------------|--------------|----------|
| 1 | Vô Danh | 0 - 49 | 2-3 trận | Người mới |
| 2 | Tân Kỳ | 50 - 199 | +6 trận | Học cơ bản |
| 3 | Học Kỳ | 200 - 599 | +16 trận | Hiểu chiến thuật |
| 4 | Kỳ Lão | 600 - 1499 | +36 trận | Thành thạo |
| 5 | Cao Kỳ | 1500 - 2999 | +60 trận | Chuyên nghiệp |
| 6 | Kỳ Thánh | 3000 - 5499 | +100 trận | Cao thủ |
| 7 | Truyền Thuyết | 5500+ | +150 trận | Huyền thoại |

*Ước tính với win rate 60%, avg +25 MP/win

## 🎯 Mindpoint Calculation

### Base Formula
```typescript
let points = 20; // Base

// Win bonuses
if (totalMoves < 50) points += 10;      // Quick win
if (timeRemaining > 180) points += 5;   // Time bonus

// Rank difference
const rankDiff = opponentRank - playerRank;
if (rankDiff > 0) points += rankDiff * 5;  // Beat higher → bonus
else if (rankDiff < 0) points += rankDiff * 3; // Beat lower → penalty

// Lose
if (isWinner === false) points = -15;
```

### Examples

**Example 1: Same rank**
- Player: Tân Kỳ (rank=1), Mindpoint=120
- Opponent: Tân Kỳ (rank=1), Mindpoint=150
- Result: Player wins in 45 moves, 200s remaining

Calculation:
- Base: 20
- Quick win: +10 (moves < 50)
- Time bonus: +5 (time > 180)
- Rank diff: 0
- **Total: +35 MP** → New MP: 155

**Example 2: Beat higher rank**
- Player: Học Kỳ (rank=2), MP=250
- Opponent: Kỳ Lão (rank=3), MP=800
- Result: Player wins in 60 moves, 120s remaining

Calculation:
- Base: 20
- Quick win: 0 (moves >= 50)
- Time bonus: 0 (time < 180)
- Rank diff: +1 → +5
- **Total: +25 MP** → New MP: 275

**Example 3: Beat lower rank**
- Player: Cao Kỳ (rank=4), MP=2000
- Opponent: Tân Kỳ (rank=1), MP=100
- Result: Player wins in 30 moves

Calculation:
- Base: 20
- Quick win: +10
- Time bonus: +5
- Rank diff: -3 → -9
- **Total: +26 MP** (capped at minimum)

**Example 4: Lose to higher rank**
- Player: Học Kỳ (rank=2), MP=400
- Opponent: Cao Kỳ (rank=4), MP=2500
- Result: Player loses

Calculation:
- Base: -15 (loser)
- **Total: -15 MP** → New MP: 385
- Note: Losing to higher rank is less punishing

## 🔄 Rank Decay (Planned)
- Inactive 30 days: -5 MP/day
- Inactive 60 days: -10 MP/day
- Inactive 90 days: Drop 1 rank tier

## 🎨 Rank Icons & Colors
- Vô Danh: 🆕 Gray (#9CA3AF)
- Tân Kỳ: ⭐ Blue (#3B82F6)
- Học Kỳ: 🌟 Cyan (#06B6D4)
- Kỳ Lão: 💫 Purple (#8B5CF6)
- Cao Kỳ: ✨ Orange (#F59E0B)
- Kỳ Thánh: 🔥 Red (#EF4444)
- Truyền Thuyết: 👑 Gold (#FCD34D)
```

#### Prompt thực hiện - Part B (30 phút):
```
Update function update_user_rank() với rank mới:

FILE: infra/migrations/0013_rebalance_ranks.sql

CONTENT:
-- Update rank thresholds
CREATE OR REPLACE FUNCTION update_user_rank(p_user_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  current_mp INTEGER;
  new_rank VARCHAR(50);
  old_rank VARCHAR(50);
BEGIN
  SELECT mindpoint, current_rank 
  INTO current_mp, old_rank 
  FROM profiles 
  WHERE user_id = p_user_id;
  
  -- New balanced thresholds
  IF current_mp < 50 THEN 
    new_rank := 'vo_danh';
  ELSIF current_mp < 200 THEN 
    new_rank := 'tan_ky';
  ELSIF current_mp < 600 THEN 
    new_rank := 'hoc_ky';
  ELSIF current_mp < 1500 THEN 
    new_rank := 'ky_lao';
  ELSIF current_mp < 3000 THEN 
    new_rank := 'cao_ky';
  ELSIF current_mp < 5500 THEN 
    new_rank := 'ky_thanh';
  ELSE 
    new_rank := 'truyen_thuyet';
  END IF;
  
  -- Update if changed
  IF new_rank != old_rank THEN
    UPDATE profiles 
    SET current_rank = new_rank 
    WHERE user_id = p_user_id;
    
    -- Log rank change
    INSERT INTO rank_history (user_id, old_rank, new_rank, mindpoint, created_at)
    VALUES (p_user_id, old_rank, new_rank, current_mp, now());
    
    RAISE NOTICE 'User % ranked up/down: % → % (MP: %)', 
      p_user_id, old_rank, new_rank, current_mp;
  END IF;
  
  RETURN new_rank;
END;
$$ LANGUAGE plpgsql;

-- Create rank history table (optional)
CREATE TABLE IF NOT EXISTS rank_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  old_rank VARCHAR(50),
  new_rank VARCHAR(50) NOT NULL,
  mindpoint INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rank_history_user ON rank_history(user_id, created_at DESC);
```

**Giả lập test:**
```sql
-- Test progression
INSERT INTO profiles (user_id, username, mindpoint, current_rank) VALUES
('test-user', 'TestPlayer', 0, 'vo_danh');

-- Win 2 games (+50 MP)
UPDATE profiles SET mindpoint = 50 WHERE user_id='test-user';
SELECT update_user_rank('test-user');
-- → 'tan_ky' ✅ RANK UP!

-- Win 6 more (+150 MP total = 200)
UPDATE profiles SET mindpoint = 200 WHERE user_id='test-user';
SELECT update_user_rank('test-user');
-- → 'hoc_ky' ✅ RANK UP!

-- Lose some games (150 MP)
UPDATE profiles SET mindpoint = 150 WHERE user_id='test-user';
SELECT update_user_rank('test-user');
-- → 'tan_ky' ❌ RANK DOWN!

-- Check history
SELECT * FROM rank_history WHERE user_id='test-user' ORDER BY created_at DESC;
/*
| old_rank  | new_rank  | mindpoint | created_at          |
|-----------|-----------|-----------|---------------------|
| hoc_ky    | tan_ky    | 150       | 2025-11-23 11:30:00 |
| tan_ky    | hoc_ky    | 200       | 2025-11-23 11:20:00 |
| vo_danh   | tan_ky    | 50        | 2025-11-23 11:10:00 |
*/
```

---

### ✅ TODO 3.2: Thêm Rank Up animation
**Ưu tiên:** 🟢 MEDIUM  
**Thời gian:** 30 phút  
**File:** `frontend/src/pages/InMatch.tsx`

#### Prompt thực hiện:
```
Thêm animation khi rank up (sửa TODO 1.4):

VỊ TRÍ: Trong handleGameEnd(), sau gọi update_user_rank()

CODE:
// Check if player ranked up
if (finalMatchWinner === playerSymbol) {
  const oldRank = playerSymbol === 'X' 
    ? playerXData?.profiles?.current_rank 
    : playerOData?.profiles?.current_rank;
  
  const newRank = playerSymbol === 'X' ? newRankX : newRankO;
  
  if (newRank && newRank !== oldRank) {
    // Show rank up modal
    setShowRankUpModal(true);
    setRankUpData({
      oldRank,
      newRank,
      mindpoint: playerSymbol === 'X' 
        ? playerXData?.profiles?.mindpoint + playerXMindpointChange
        : playerOData?.profiles?.mindpoint + playerOMindpointChange
    });
    
    // Auto close after 5s
    setTimeout(() => setShowRankUpModal(false), 5000);
  }
}

// Thêm state
const [showRankUpModal, setShowRankUpModal] = React.useState(false);
const [rankUpData, setRankUpData] = React.useState<{
  oldRank: string;
  newRank: string;
  mindpoint: number;
} | null>(null);

// Thêm modal UI (line ~705)
{showRankUpModal && rankUpData && (
  <div className="rank-up-modal-overlay">
    <div className="rank-up-modal" style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px',
      borderRadius: '24px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      textAlign: 'center',
      animation: 'scaleIn 0.5s ease-out'
    }}>
      <div style={{ fontSize: '72px', marginBottom: '16px' }}>
        👑
      </div>
      <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: 'white', marginBottom: '12px' }}>
        RANK UP!
      </h1>
      <div style={{ fontSize: '20px', color: 'rgba(255,255,255,0.9)', marginBottom: '24px' }}>
        <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>
          {rankUpData.oldRank.replace('_', ' ').toUpperCase()}
        </span>
        {' → '}
        <span style={{ fontWeight: 'bold', color: '#FCD34D' }}>
          {rankUpData.newRank.replace('_', ' ').toUpperCase()}
        </span>
      </div>
      <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)' }}>
        Mindpoint: {rankUpData.mindpoint}
      </div>
      <div style={{ marginTop: '24px', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
        Tiếp tục cố gắng để đạt rank cao hơn!
      </div>
    </div>
  </div>
)}

<style>{`
  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.5);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  .rank-up-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }
`}</style>
```

---

## PHASE 4: TESTING TỔNG THỂ (30 phút)

### ✅ TODO 4.1: Test end-to-end flow
**Thời gian:** 20 phút

#### Test Cases:

**TC1: Full game flow - X wins**
```
1. Create room với 2 players
2. X đánh (7,7) → Check O nhận realtime
3. O đánh (7,8) → Check X nhận realtime
4. ... tiếp tục đến nước thứ 9
5. X đánh (7,11) → THẮNG
   - Check: gameWinner = 'X'
   - Check: Popup "X thắng ván 1!"
   - Check: scores = {X: 1, O: 0}
6. Đợi 3s → startNextGame()
   - Check: board reset
   - Check: gameWinner = null
   - Check: currentTurn = 'X'
7. Chơi ván 2, X thắng tiếp
   - Check: matchWinner = 'X'
   - Check: Popup "X thắng toàn bộ!"
8. Check database:
   - matches: winner_user_id = X's ID
   - matches: player_x_mindpoint_change > 0
   - matches: player_o_mindpoint_change < 0
   - profiles X: mindpoint tăng
   - profiles O: mindpoint giảm
   - profiles X: current_rank updated (nếu đủ MP)
```

**TC2: Draw game**
```
1. Chơi cho đến khi board đầy (225 nước)
2. Không ai đủ 5 liên tiếp
3. Check: gameWinner = 'draw'
4. Check: Popup "Hòa!"
5. Check: scores không đổi
6. startNextGame()
```

**TC3: Timeout**
```
1. X đánh
2. Đợi 30s không đánh
3. Check: handleTimeOut() được gọi
4. Check: Popup "Hết giờ! O thắng!"
5. Check: scores.O++
```

**TC4: Rank up**
```
Setup: Player có mindpoint=45, rank='vo_danh'
1. Thắng trận (+30 MP) → mindpoint=75
2. Check: update_user_rank() được gọi
3. Check: rank vẫn là 'vo_danh' (chưa đủ 50)
4. Chơi thêm 1 trận, thắng (+25 MP) → mindpoint=100
5. Check: rank = 'tan_ky' ✅
6. Check: Popup "RANK UP!"
7. Check: rank_history có record mới
```

---

### ✅ TODO 4.2: Test edge cases
**Thời gian:** 10 phút

**Edge Case 1: Network disconnect**
```
1. X đánh
2. Tắt mạng ngay sau khi click
3. Check: Optimistic update vẫn hiển thị
4. Check: Error sau 5s → revert move
5. Bật lại mạng
6. Check: Sync lại state từ database
```

**Edge Case 2: Race condition - both players click**
```
1. Cả X và O click vào 2 cell khác nhau cùng lúc
2. Database policy: Chỉ người có turn mới insert được
3. Check: Chỉ 1 move được accepted
4. Check: Người kia nhận error hoặc state update
```

**Edge Case 3: Opponent leaves mid-game**
```
1. Đang chơi
2. O đóng tab
3. X đợi 60s
4. Check: System tự động cho X thắng? (TODO: implement)
```

---

## 📝 PROMPT CHO TỪNG BƯỚC NHỎ

### Khi bắt đầu mỗi TODO:
```
Đang thực hiện: [TODO Title]
File cần sửa: [File path]
Thời gian ước tính: [X phút]

Yêu cầu:
1. Đọc lại code hiện tại tại [line range]
2. Áp dụng thay đổi theo mô tả
3. Giải thích lý do thay đổi
4. Chạy giả lập test case
5. Xác nhận logic đúng

Khi hoàn thành:
- ✅ Đánh dấu TODO
- 📝 Ghi chú kết quả test
- 🔄 Commit code với message rõ ràng
```

### Prompt kiểm tra:
```
Sau khi sửa [TODO], hãy:
1. Mô phỏng lại test case với input cụ thể
2. Trace từng bước thực thi
3. Kiểm tra output có đúng không
4. Liệt kê các edge case còn thiếu

Format output:
✅ Test PASS: [mô tả]
❌ Test FAIL: [lý do] → Cần sửa thêm [...]
⚠️ Edge case: [mô tả] → TODO: [...]
```

---

## 📊 TIẾN ĐỘ TRACKING

### Checklist tổng thể:
- [ ] Phase 1: Fix CRITICAL (4/4)
  - [ ] TODO 1.1: Logic chuyển lượt
  - [ ] TODO 1.2: Popup game winner
  - [ ] TODO 1.3: Tính mindpoint
  - [ ] TODO 1.4: Cập nhật rank
- [ ] Phase 2: Fix HIGH (3/3)
  - [ ] TODO 2.1: Fix match opponent ID
  - [ ] TODO 2.2: Realtime optimistic
  - [ ] TODO 2.3: Validate turn DB
- [ ] Phase 3: Cải thiện MEDIUM (2/2)
  - [ ] TODO 3.1: Rebalance ranks
  - [ ] TODO 3.2: Rank up animation
- [ ] Phase 4: Testing (2/2)
  - [ ] TODO 4.1: E2E tests
  - [ ] TODO 4.2: Edge cases

### Log thực hiện:
```
[HH:MM] Started Phase 1
[HH:MM] ✅ TODO 1.1 completed - 5 phút
[HH:MM] ✅ TODO 1.2 completed - 20 phút
[HH:MM] ✅ TODO 1.3 completed - 30 phút
[HH:MM] ✅ TODO 1.4 completed - 15 phút
[HH:MM] Phase 1 DONE - Total: 1h 10m

... (tiếp tục)
```

---

## 🚀 BẮT ĐẦU THỰC HIỆN

**Lệnh để bắt đầu:**
```bash
# 1. Backup code hiện tại
git add .
git commit -m "Backup before fixing game logic"
git branch backup/before-game-logic-fix

# 2. Tạo branch mới
git checkout -b fix/game-logic-and-ranking

# 3. Bắt đầu Phase 1
echo "Starting Phase 1: Fix CRITICAL issues"
```

**Prompt để AI thực hiện từng TODO:**
```
Hãy thực hiện TODO 1.1: Sửa logic chuyển lượt sai

Yêu cầu:
1. Đọc file frontend/src/pages/InMatch.tsx line 480-520
2. Áp dụng fix theo mô tả trong TODO 1.1
3. Giải thích tại sao fix này đúng
4. Chạy giả lập test với input: X đánh thắng tại (7,11)
5. Verify: currentTurn vẫn giữ đúng, gameWinner được set

Output format:
✅ Code đã sửa
🔬 Giả lập test
✅ Kết quả test
```

---

**🎉 HOÀN THÀNH TẤT CẢ → HỆ THỐNG GAME HOẠT ĐỘNG ĐÚNG!**
