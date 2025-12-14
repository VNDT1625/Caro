-- Migration: Cleanup duplicate categories
-- Date: 2024-12-09
-- Issue: Có cả 'music' và 'âm nhạc' category trùng nhau

-- Bước 1: Cập nhật tất cả items đang dùng 'music' sang 'âm nhạc'
UPDATE public.items 
SET category = 'âm nhạc' 
WHERE category = 'music';

-- Bước 2: Xóa category 'music' (giữ lại 'âm nhạc')
DELETE FROM public.categories WHERE id = 'music';

-- Bước 3: Đảm bảo các category chuẩn tồn tại với tên đúng
-- Cập nhật hoặc thêm các category chuẩn
INSERT INTO public.categories (id, name_vi, name_en, description, icon, color, sort_order, is_active, max_equipped)
VALUES 
  ('âm nhạc', 'Âm Nhạc', 'Music', 'Nhạc nền trong game', '🎵', '#A78BFA', 10, true, 1),
  ('piece_skin', 'Skin Quân Cờ', 'Piece Skin', 'Skin cho quân cờ', '♟️', '#F472B6', 20, true, 1),
  ('board_skin', 'Skin Bàn Cờ', 'Board Skin', 'Skin cho bàn cờ', '🎯', '#60A5FA', 30, true, 1),
  ('avatar_frame', 'Khung Avatar', 'Avatar Frame', 'Khung trang trí avatar', '🖼️', '#FBBF24', 40, true, 1),
  ('emote', 'Biểu Cảm', 'Emote', 'Biểu cảm trong game', '😀', '#34D399', 50, true, 5),
  ('title', 'Danh Hiệu', 'Title', 'Danh hiệu người chơi', '🏆', '#F59E0B', 60, true, 1)
ON CONFLICT (id) DO UPDATE SET
  name_vi = EXCLUDED.name_vi,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- Bước 4: Xóa các category trùng lặp khác nếu có
DELETE FROM public.categories 
WHERE id IN ('Music', 'MUSIC', 'Âm Nhạc', 'Âm nhạc')
AND id != 'âm nhạc';

-- Bước 5: Cập nhật items có category không chuẩn
UPDATE public.items SET category = 'piece_skin' WHERE LOWER(category) IN ('piece skin', 'pieceskin', 'skin quân cờ');
UPDATE public.items SET category = 'board_skin' WHERE LOWER(category) IN ('board skin', 'boardskin', 'skin bàn cờ');
UPDATE public.items SET category = 'avatar_frame' WHERE LOWER(category) IN ('avatar frame', 'avatarframe', 'khung avatar');
UPDATE public.items SET category = 'emote' WHERE LOWER(category) IN ('emotes', 'biểu cảm');
UPDATE public.items SET category = 'title' WHERE LOWER(category) IN ('titles', 'danh hiệu');
