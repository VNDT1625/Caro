# Music Selection System - Requirements

## Mô tả
Cho phép người dùng chọn nhạc nền từ inventory (nhạc đã mua trong shop) hoặc từ Settings.

## User Stories

### US-1: Xem nhạc trong Inventory
- Người dùng có thể xem tất cả nhạc đã mua trong trang Inventory
- Nhạc được hiển thị trong category "music" 
- Có thể preview (nghe thử) nhạc trước khi chọn

### US-2: Chọn nhạc từ Inventory
- Click "Use" trên một bài nhạc để đặt làm nhạc nền
- Nhạc được chọn sẽ hiển thị trạng thái "Đang sử dụng"
- Chỉ có 1 nhạc được active tại một thời điểm

### US-3: Chọn nhạc từ Settings
- Trong Settings > Sound có dropdown chọn nhạc nền
- Dropdown hiển thị tất cả nhạc đã sở hữu
- Có option "Default" cho nhạc mặc định

### US-4: Lưu và áp dụng nhạc
- Nhạc được chọn lưu vào profile settings
- Khi load app, tự động play nhạc đã chọn
- AudioManager sử dụng nhạc từ user settings

## Acceptance Criteria

### AC-1: Database
- [x] Bảng `items` có category "music" với `preview_url` chứa URL file nhạc
- [x] Bảng `user_items` lưu nhạc đã mua với `is_equipped` cho nhạc đang dùng

### AC-2: Inventory
- [ ] Hiển thị nhạc trong category music
- [ ] Nút "Use" để chọn nhạc
- [ ] Nút "Preview" để nghe thử
- [ ] Hiển thị trạng thái đang sử dụng

### AC-3: Settings
- [ ] Dropdown chọn nhạc trong tab Sound
- [ ] Load danh sách nhạc từ user_items
- [ ] Lưu selection vào localStorage và profile

### AC-4: AudioManager
- [ ] Load nhạc từ user settings thay vì hardcode
- [ ] Hỗ trợ thay đổi nhạc runtime
- [ ] Fallback về nhạc mặc định nếu không có selection
