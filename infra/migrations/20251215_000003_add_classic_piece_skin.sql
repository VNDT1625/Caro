-- Migration: Add classic piece skin (default black/white)
-- Date: 2024-12-15
-- Description: Add a "Classic" piece skin that uses default black/white stones

-- First ensure piece_skin category exists
INSERT INTO public.categories (id, name_vi, name_en, description, icon, color, sort_order, is_active, max_equipped)
VALUES ('piece_skin', 'Quân Cờ', 'Pieces', 'Skin cho quân cờ', '♟️', '#22D3EE', 1, true, 1)
ON CONFLICT (id) DO NOTHING;

-- Insert classic piece skin - no image URL, just uses default colors
INSERT INTO public.items (
  item_code, 
  name, 
  name_en,
  description, 
  description_en,
  category, 
  price_coins, 
  price_gems, 
  rarity, 
  is_available, 
  source_type,
  asset_data,
  preview_url
)
VALUES (
  'skin_classic_pieces',
  'Quân Cờ Cổ Điển',
  'Classic Pieces',
  'Quân cờ trắng đen truyền thống',
  'Traditional black and white pieces',
  'piece_skin',
  0,  -- Free
  0,
  'common',
  true,
  'starter',  -- Given to all users
  '{"black_color": "#1a1a1a", "white_color": "#f5f5f5"}',  -- No stone URL, just colors
  NULL  -- No preview image needed
)
ON CONFLICT (item_code) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  description_en = EXCLUDED.description_en,
  asset_data = EXCLUDED.asset_data,
  is_available = true;

-- Verify
SELECT id, item_code, name, category, asset_data, preview_url 
FROM public.items 
WHERE item_code = 'skin_classic_pieces';
