-- Migration: Fix music category consistency
-- Date: 2024-12-11
-- Issue: Music items may have inconsistent category values

-- Chuẩn hóa tất cả music items về category 'âm nhạc'
UPDATE public.items 
SET category = 'âm nhạc' 
WHERE LOWER(category) IN ('music', 'am nhac', 'âm nhạc', 'nhạc', 'nhac');

-- Đảm bảo category 'âm nhạc' tồn tại
INSERT INTO public.categories (id, name_vi, name_en, description, icon, color, sort_order, is_active, max_equipped)
VALUES ('âm nhạc', 'Âm Nhạc', 'Music', 'Nhạc nền trong game', '🎵', '#A78BFA', 10, true, 1)
ON CONFLICT (id) DO UPDATE SET
  name_vi = EXCLUDED.name_vi,
  name_en = EXCLUDED.name_en,
  is_active = true;

-- Xóa category 'music' nếu còn tồn tại (đã migrate sang 'âm nhạc')
DELETE FROM public.categories WHERE id = 'music';
