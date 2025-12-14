# Notes

## Nút "Qua lượt" - 2024-12-12

### Yêu cầu
- Chỉ chuyển lượt khi user ấn nút "Qua lượt" hoặc hết thời gian
- Dùng skill KHÔNG tự động qua lượt
- Nút "Qua lượt" chỉ hiện khi đã đánh quân

### Các fix đã thực hiện
1. **handleCellClick - Normal move**: Thêm `setHasMovedThisTurn(true)` và xóa logic tự động chuyển lượt
2. **handleCellClick - block-move skill**: Thêm `setHasMovedThisTurn(true)` và xóa logic tự động chuyển lượt
3. **handleCellClick - teleport-2 skill**: Xóa logic tự động chuyển lượt
4. **handleCellClick - clone skill**: Xóa logic tự động chuyển lượt
5. **handleCellClick - bomb skill**: Xóa logic tự động chuyển lượt
6. **handleCellClick - fake skill**: Xóa logic tự động chuyển lượt
7. **handleCellClick - reflect-trap skill**: Xóa logic tự động chuyển lượt
8. **handleEndTurn function**: Xử lý chuyển lượt khi user ấn nút
9. **UI nút "Qua lượt"**: Điều kiện hiển thị `hasMovedThisTurn || timeRemaining <= 0`

### Lưu ý đặc biệt
- `turn_manipulation` skill: Giữ nguyên logic chuyển lượt vì đây là effect của skill (50/50 địch đi thêm)
- Các skill khác không tự động chuyển lượt - user phải ấn nút

---

## Skill System Fix - 2024-12-12

### Vấn đề
Skill trong mode Caro Skill không hoạt động - user chọn skill như "Lưỡi Dao Gió", click "Sử dụng", nhưng effect không xảy ra, chỉ hết lượt. Chỉ có skill "block_cell" hoạt động.

### Nguyên nhân gốc
Trong `handleUseSkill` (VariantMatch.tsx), chỉ có một số ít effect_type được xử lý trong switch case. Các skill như `destroy_piece`, `line_destroy`, `chaos_move`, `push_chain`, v.v. rơi vào `default` case và chỉ apply cooldown mà không thực hiện effect gì.

### Các fix đã thực hiện
1. **VariantMatch.tsx - handleUseSkill**: Thêm xử lý cho 40+ effect_type mới:
   - Attack: `destroy_piece`, `line_destroy`, `push_enemy`, `push_chain`, `break_chain`
   - Area: `chaos_move`, `burn_area`, `reset_area`, `shuffle_area`, `bomb_area`
   - Defense: `shield_area`, `immunity_area`, `protect_piece`, `permanent_protect`
   - Utility: `extra_turn`, `reduce_cooldown`, `restore_mana`, `double_next`, `double_skill`
   - Special: `chaos_jump`, `chaos_all`, `hide_pieces`, `fake_piece`, `reflect_trap`
   - Và nhiều effect khác...

2. **VariantMatch.tsx - handleCellClick**: Thêm xử lý cho các skillMode mới:
   - `destroy`: Chọn 1 quân địch để phá hủy
   - `push`: Chọn 1 quân địch để đẩy
   - `area`: Chọn tâm vùng 3x3 cho chaos_move, burn_area, reset_area
   - `shield`: Chọn 1 quân của mình để bảo vệ
   - `teleport-1`, `teleport-2`: Di chuyển quân đến ô trống
   - `clone`: Nhân bản quân gần đó
   - `bomb`: Nổ vùng 3x3
   - `fake`: Đặt quân giả
   - `reflect-trap`: Đặt bẫy phản

3. **UI Updates**:
   - Thêm hướng dẫn cho từng skillMode (hiển thị khi đang chọn target)
   - Thêm nút "Hủy" để user có thể hủy skill mode nếu chọn nhầm
   - Tất cả skillMode đều apply cooldown và mana cost đúng cách

### Cách test
1. Vào mode Caro Skill (Dị Biến Kỳ > Caro Skill)
2. Bắt đầu game local
3. Thử các skill:
   - **Sấm Sét** (destroy_piece): Click skill → chọn quân địch → quân bị xóa
   - **Lưỡi Dao Gió** (line_destroy): Click skill → random 1 hàng/cột bị xóa quân địch
   - **Lốc Xoáy** (chaos_move): Click skill → chọn tâm → quân trong 3x3 bị shuffle
   - **Địa Chấn** (block_cell): Click skill → chọn ô trống → ô bị block
   - **Linh Ngọc** (extra_turn): Click skill → được đi thêm 1 lượt

### Kiểm tra lần 2 - 2024-12-12
**Kết quả**: Tất cả 60 skill đã được xử lý trong handleUseSkill switch:
- 31 skills thường (common)
- 22 skills hiếm (rare)  
- 7 skills cực hiếm (legendary)

**Fix nhỏ**: Xóa case `fake_piece` duplicate (xuất hiện 2 lần trong switch)

**Danh sách skillMode và xử lý trong handleCellClick**:
- `swap-1`, `swap-2`: Đổi vị trí 2 quân ✅
- `block`, `block-move`: Block ô và đánh quân ✅
- `bomb`: Nổ vùng 3x3 ✅
- `shield`: Bảo vệ 1 quân ✅
- `teleport-1`, `teleport-2`: Di chuyển quân ✅
- `clone`: Nhân bản quân ✅
- `destroy`: Phá hủy quân địch ✅
- `push`: Đẩy quân địch ✅
- `area`: Chọn tâm vùng 3x3 ✅
- `reflect-trap`: Đặt bẫy phản ✅
- `fake`: Đặt quân giả ✅

---

## Gift Notification Fix - 2024-12-12 (FINAL FIX)

### Vấn đề
User không thấy quà tặng trong thông báo dù admin đã gửi. Console log: `gift_data: undefined`

### Nguyên nhân gốc THỰC SỰ
Function `notificationCreate` trong `backend/public/index.php` **KHÔNG nhận parameter `gift_data`** và **KHÔNG lưu vào database**.

Route handler cũng **KHÔNG extract `gift_data`** từ request body để truyền vào function.

### Các fix đã thực hiện (Session này)
1. **Function `notificationCreate`** (line ~2563):
   - Thêm parameter `?array $giftData = null`
   - Thêm logic kiểm tra và lưu `gift_data` vào `$notificationPayload`

2. **Route handler POST `/api/admin/notifications`** (line ~2877):
   - Extract `gift_data` từ body request
   - Parse coins, gems, item_ids
   - Truyền vào function `notificationCreate`

### Cách test
1. **QUAN TRỌNG: Restart PHP backend**: 
   ```
   cd backend/public && php -S localhost:8001 router.php
   ```
2. **Chạy migration** (nếu chưa): `infra/migrations/20251212_fix_gift_notification_urgent.sql`
3. **Gửi thông báo MỚI** với gift từ Admin panel (thông báo cũ không có gift_data)
4. **User mở Inbox** → click thông báo → phải thấy "🎁 Quà tặng kèm theo"
5. **Click "Nhận quà"** → coins/gems được cộng vào profile

### Kiểm tra database
```sql
-- Xem thông báo có gift_data không
SELECT id, title, gift_data, created_at 
FROM admin_notifications 
ORDER BY created_at DESC LIMIT 5;

-- Xem user đã claim gift chưa
SELECT notification_id, gift_claimed, gift_claimed_at 
FROM user_admin_notifications 
WHERE user_id = 'YOUR_USER_ID' 
ORDER BY created_at DESC LIMIT 5;
```


---

## Mana Regen Bug Fix - 2024-12-12

### Vấn đề
Khi A đi trước (mana 5), đến lượt B thì B có 8 mana thay vì 5. B chưa đi lượt nào mà đã được hồi mana.

### Nguyên nhân
Trong `handleEndTurn`, khi chuyển lượt từ A sang B:
- `refreshSkillsForPlayer(nextPlayer, ...)` được gọi cho B
- Trong function này: `newMana = Math.min(15, manaAfterHold + 3)` → B được hồi +3 mana

Logic sai: Mana hồi cho người **sắp đi** (B) thay vì người **vừa đi xong** (A).

### Fix
1. **handleEndTurn**: Thêm logic hồi mana cho `currentTurn` (người vừa đi xong) TRƯỚC khi chuyển lượt
2. **refreshSkillsForPlayer**: Thêm parameter `regenMana: boolean = false`
   - Khi `regenMana = false`: Không hồi mana (mặc định)
   - Khi `regenMana = true`: Hồi +3 mana (chỉ dùng khi cần)
3. Gọi `refreshSkillsForPlayer(nextPlayer, turn, false)` để chỉ refresh skill, không hồi mana

### Logic đúng sau fix
1. Game bắt đầu: X = 5 mana, O = 5 mana
2. X đi xong, ấn "Qua lượt": X được +3 → X = 8, chuyển sang O (O = 5)
3. O đi xong, ấn "Qua lượt": O được +3 → O = 8, chuyển sang X (X = 8)


---

## Ranked Disconnect Auto-Win - 2024-12-12

### Tính năng
Xử lý tự động khi người chơi disconnect trong ranked mode:
- Phát hiện disconnect trong 5 giây
- Countdown 10 giây grace period
- Auto-win cho người còn lại với +20 MP
- Người disconnect bị -20 MP

### Các file đã cập nhật
1. **server/index.js**:
   - `rankedDisconnectStates` Map để track disconnect
   - `handleRankedDisconnect()` - bắt đầu countdown
   - `handleRankedReconnect()` - hủy countdown nếu reconnect
   - `processRankedAutoWin()` - xử lý auto-win với retry logic
   - `handleSimultaneousDisconnect()` - xử lý cả 2 disconnect = draw
   - Cleanup Swap2 state khi forfeit

2. **backend/app/Services/DisconnectHandlerService.php**:
   - `processForfeitDisconnect()` - xử lý forfeit với ±20 MP

3. **backend/app/Controllers/SeriesController.php**:
   - API endpoint `POST /api/series/{id}/forfeit-disconnect`

4. **frontend/src/pages/Room.tsx**:
   - Import và integrate `useRankedDisconnect` hook
   - Thêm state `seriesId`, `roomMode`
   - Render `DisconnectOverlay` component

5. **frontend/src/hooks/useRankedDisconnect.ts** (đã có)
6. **frontend/src/components/series/DisconnectOverlay.tsx** (đã có)
7. **frontend/src/hooks/useSeriesRealtime.ts** (đã có event types)

### Tests
- `DisconnectHandlerPropertyTest.php`: 9 tests pass
- `SeriesManagerPropertyTest.php`: 13 tests pass

### Cách test
1. Vào ranked mode với 2 accounts
2. Một account disconnect (đóng tab/mất mạng)
3. Account còn lại thấy overlay "Đối thủ đã thoát" với countdown 10s
4. Sau 10s → auto-win với +20 MP
