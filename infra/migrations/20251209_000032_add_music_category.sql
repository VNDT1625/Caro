-- Migration: Add music category to categories table
-- Date: 2024-12-09
-- Issue: Foreign key constraint violation when adding music items

-- Thêm category music nếu chưa có
INSERT INTO public.categories (id, name_vi, name_en, description, icon, color, sort_order, is_active, max_equipped)
VALUES 
  ('music', 'Âm nhạc', 'Music', 'Nhạc nền trong game', '🎵', '#A78BFA', 10, true, 1),
  ('board_skin', 'Giao diện bàn cờ', 'Board Skin', 'Skin cho bàn cờ', '🎨', '#60A5FA', 20, true, 1),
  ('piece_skin', 'Giao diện quân cờ', 'Piece Skin', 'Skin cho quân cờ', '⚫', '#F472B6', 30, true, 1),
  ('avatar_frame', 'Khung avatar', 'Avatar Frame', 'Khung trang trí avatar', '🖼️', '#FBBF24', 40, true, 1),
  ('emote', 'Biểu cảm', 'Emote', 'Biểu cảm trong game', '😀', '#34D399', 50, true, 5),
  ('effect', 'Hiệu ứng', 'Effect', 'Hiệu ứng đặc biệt', '✨', '#F87171', 60, true, 3)
ON CONFLICT (id) DO UPDATE SET
  name_vi = EXCLUDED.name_vi,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  is_active = EXCLUDED.is_active;
