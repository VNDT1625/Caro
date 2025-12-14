# Music Selection System - Tasks

## Task 1: Update AudioManager ✅
- [x] Thêm currentMusicUrl và currentMusicId properties
- [x] Thêm setBackgroundMusic(url, id) method
- [x] Thêm getCurrentMusicId() method
- [x] Update startBgLoop() để sử dụng currentMusicUrl

## Task 2: Update Inventory cho Music ✅
- [x] Thêm nút Preview cho items category music
- [x] Preview audio riêng biệt với background music
- [x] Khi Use nhạc: update AudioManager

## Task 3: Tạo MusicSelector Component ✅
- [x] Component dropdown chọn nhạc
- [x] Load owned music từ user_items
- [x] Preview button cho mỗi option
- [x] Save selection

## Task 4: Integrate vào Profile Settings ✅
- [x] Thêm MusicSelector vào tab Sound
- [x] Load selected music on app start
- [x] Sync với AudioManager
- [x] Thêm i18n keys cho 4 ngôn ngữ (vi, en, zh, ja)

## Task 5: Auto-load music on app start ✅
- [x] Check equipped music từ user_items
- [x] Set AudioManager với music URL
- [x] Fallback về default nếu không có
- [x] Hook useEquippedMusic integrated vào App.tsx

## COMPLETED ✅
All tasks implemented successfully.
