-- Migration: Add equipped_avatar_frame column to profiles
-- This allows users to equip avatar frames purchased from shop

-- Add equipped_avatar_frame column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS equipped_avatar_frame uuid REFERENCES public.items(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_equipped_avatar_frame 
ON public.profiles(equipped_avatar_frame) 
WHERE equipped_avatar_frame IS NOT NULL;

-- Add avatar_frame category if not exists
INSERT INTO public.categories (id, name_vi, name_en, description, icon, color, sort_order, is_active, max_equipped)
VALUES ('avatar_frame', 'Khung Avatar', 'Avatar Frames', 'Khung trang trí cho avatar', '🖼️', '#A855F7', 3, true, 1)
ON CONFLICT (id) DO UPDATE SET
  name_vi = EXCLUDED.name_vi,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  is_active = true;

-- Insert sample avatar frames if not exist
INSERT INTO public.items (item_code, name, description, category, price_coins, price_gems, rarity, is_available, preview_url, name_en, description_en)
VALUES 
  ('frame_bronze', 'Khung Đồng', 'Khung avatar màu đồng cơ bản', 'avatar_frame', 1000, 0, 'common', true, '/frames/bronze.svg', 'Bronze Frame', 'Basic bronze avatar frame'),
  ('frame_silver', 'Khung Bạc', 'Khung avatar màu bạc sang trọng', 'avatar_frame', 3000, 0, 'rare', true, '/frames/silver.svg', 'Silver Frame', 'Elegant silver avatar frame'),
  ('frame_gold', 'Khung Vàng', 'Khung avatar màu vàng quý phái', 'avatar_frame', 0, 30, 'epic', true, '/frames/gold.svg', 'Gold Frame', 'Noble gold avatar frame'),
  ('frame_diamond', 'Khung Kim Cương', 'Khung avatar kim cương huyền thoại', 'avatar_frame', 0, 100, 'legendary', true, '/frames/diamond.svg', 'Diamond Frame', 'Legendary diamond avatar frame'),
  ('frame_fire', 'Khung Lửa', 'Khung avatar với hiệu ứng lửa', 'avatar_frame', 0, 50, 'epic', true, '/frames/gold.svg', 'Fire Frame', 'Avatar frame with fire effect'),
  ('frame_ice', 'Khung Băng', 'Khung avatar với hiệu ứng băng giá', 'avatar_frame', 5000, 0, 'rare', true, '/frames/silver.svg', 'Ice Frame', 'Avatar frame with ice effect'),
  ('frame_nature', 'Khung Thiên Nhiên', 'Khung avatar với hoa lá', 'avatar_frame', 2000, 0, 'common', true, '/frames/bronze.svg', 'Nature Frame', 'Avatar frame with nature elements'),
  ('frame_cyber', 'Khung Cyber', 'Khung avatar phong cách cyberpunk', 'avatar_frame', 0, 80, 'legendary', true, '/frames/diamond.svg', 'Cyber Frame', 'Cyberpunk style avatar frame')
ON CONFLICT (item_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price_coins = EXCLUDED.price_coins,
  price_gems = EXCLUDED.price_gems,
  rarity = EXCLUDED.rarity,
  is_available = EXCLUDED.is_available,
  preview_url = EXCLUDED.preview_url,
  name_en = EXCLUDED.name_en,
  description_en = EXCLUDED.description_en;

-- Comment for documentation
COMMENT ON COLUMN public.profiles.equipped_avatar_frame IS 'Reference to the avatar frame item currently equipped by the user';
