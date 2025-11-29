# Hướng Dẫn Cấu Hình Storage Bucket cho Avatar

## Bước 1: Tạo Avatars Bucket trong Supabase

1. Truy cập Supabase Dashboard
2. Vào **SQL Editor**
3. Chạy file migration: `infra/migrations/20251123_create_avatars_bucket.sql`

Hoặc tạo thủ công:

1. Vào **Storage** trong Supabase Dashboard
2. Click **New bucket**
3. Bucket name: `avatars`
4. **Public bucket**: Bật (ON)
5. Click **Create bucket**

## Bước 2: Cấu Hình RLS Policies

Nếu chưa có policies, vào **Storage > avatars > Policies** và tạo:

### Policy 1: Public Read
- **Name**: Avatar images are publicly accessible
- **Operation**: SELECT
- **Policy definition**: `bucket_id = 'avatars'`

### Policy 2: User Upload
- **Name**: Users can upload their own avatar
- **Operation**: INSERT
- **Policy definition**: 
```sql
bucket_id = 'avatars' 
AND auth.uid()::text = (storage.foldername(name))[1]
```

### Policy 3: User Update
- **Name**: Users can update their own avatar
- **Operation**: UPDATE
- **Policy definition**: 
```sql
bucket_id = 'avatars' 
AND auth.uid()::text = (storage.foldername(name))[1]
```

### Policy 4: User Delete
- **Name**: Users can delete their own avatar
- **Operation**: DELETE
- **Policy definition**: 
```sql
bucket_id = 'avatars' 
AND auth.uid()::text = (storage.foldername(name))[1]
```

## Bước 3: Test Upload

1. Truy cập **Profile** page
2. Click nút **Chọn ảnh** trong mục **Đổi avatar**
3. Chọn ảnh (tối đa 2MB)
4. Ảnh sẽ được upload và hiển thị ngay

## Các Tính Năng Đã Được Kích Hoạt

### ✅ Tài Khoản (Account Settings)
- [x] Hiển thị username từ database
- [x] Đổi username với validation
- [x] Upload avatar (JPG, PNG, GIF - max 2MB)
- [x] Đăng xuất

### ✅ Thông Tin Profile (Overview)
- [x] Avatar từ database (hoặc placeholder nếu chưa có)
- [x] Username/Display name từ database
- [x] Email từ auth.users
- [x] Level tính từ ELO (elo_rating / 100 + 1)
- [x] EXP bar (elo_rating % 100)
- [x] Rank từ profiles.current_rank
- [x] Coins & Gems từ database
- [x] Stats thật:
  - Total matches
  - Win rate (%)
  - Current win streak
  - ELO rating

### ✅ Lịch Sử Đấu (Match History)
- [x] Load 20 trận gần nhất từ database
- [x] Hiển thị đối thủ (username)
- [x] Kết quả (Thắng/Thua/Hòa)
- [x] ELO change (+/-)
- [x] Thời gian (time ago format)
- [x] Loading state
- [x] Empty state (chưa có trận nào)

### ✅ Cài Đặt (Settings)
- [x] Giao diện (Theme, Effects, UI Style, Font Size)
- [x] Âm thanh (Music, SFX, Move Sound với volume sliders)
- [x] Bàn cờ (Highlight, Piece Drop Effect, Vibration)
- [x] Thông báo (System, Invite, Chat, Turn)
- [x] Ngôn ngữ (VI, EN, CN, JP)
- [x] Reset settings về mặc định

## Rank Icons

| Rank Code | Tên | Icon |
|-----------|-----|------|
| vo_danh | Vô Danh | 🥉 |
| tan_ky | Tân Kỳ | 🥈 |
| hoc_ky | Học Kỳ | 🥇 |
| ky_lao | Kỳ Lão | 💎 |
| cao_ky | Cao Kỳ | 🏆 |
| ky_thanh | Kỳ Thánh | 👑 |
| truyen_thuyet | Truyền Thuyết | ⭐ |

## Troubleshooting

### Avatar không upload được
1. Kiểm tra bucket `avatars` đã được tạo chưa
2. Kiểm tra RLS policies đã được cấu hình đúng chưa
3. Kiểm tra file size < 2MB và là ảnh hợp lệ

### Match history không load
1. Kiểm tra user đã login chưa
2. Kiểm tra RLS policies cho bảng `matches`
3. Xem console log để biết lỗi cụ thể

### Stats không hiển thị đúng
1. Kiểm tra dữ liệu trong bảng `profiles`
2. Chạy migration để cập nhật schema nếu thiếu cột

## Database Schema Requirements

Đảm bảo bảng `profiles` có các cột:
- `username` (varchar)
- `display_name` (varchar)
- `avatar_url` (text)
- `current_rank` (varchar)
- `elo_rating` (int)
- `coins` (int)
- `gems` (int)
- `total_matches` (int)
- `total_wins` (int)
- `total_losses` (int)
- `total_draws` (int)
- `win_streak` (int)
- `best_win_streak` (int)
