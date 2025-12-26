-- Migration: Add piece_skin and board_skin categories
-- Date: 2024-12-15
-- Description: Ensure piece_skin and board_skin categories exist for skin customization

-- Add piece_skin category if not exists
INSERT INTO public.categories (id, name_vi, name_en, description, icon, color, sort_order, is_active, max_equipped)
VALUES ('piece_skin', 'Quân Cờ', 'Pieces', 'Skin cho quân cờ', '♟️', '#22D3EE', 1, true, 1)
ON CONFLICT (id) DO UPDATE SET
  name_vi = EXCLUDED.name_vi,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  is_active = true;

-- Add board_skin category if not exists
INSERT INTO public.categories (id, name_vi, name_en, description, icon, color, sort_order, is_active, max_equipped)
VALUES ('board_skin', 'Bàn Cờ', 'Boards', 'Skin cho bàn cờ', '🎯', '#F59E0B', 2, true, 1)
ON CONFLICT (id) DO UPDATE SET
  name_vi = EXCLUDED.name_vi,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  is_active = true;

-- Add some sample piece skins
INSERT INTO public.items (item_code, name, description, category, price_coins, price_gems, rarity, is_available, name_en, description_en, asset_data)
VALUES 
  ('skin_jade_pieces', 'Quân Ngọc Bích', 'Quân cờ màu ngọc bích sang trọng', 'piece_skin', 500, 0, 'rare', true, 'Jade Pieces', 'Elegant jade colored pieces', '{"black_color": "#0d9488", "white_color": "#5eead4"}'),
  ('skin_gold_pieces', 'Quân Vàng Kim', 'Quân cờ màu vàng kim lấp lánh', 'piece_skin', 1000, 0, 'epic', true, 'Golden Pieces', 'Shiny golden pieces', '{"black_color": "#b45309", "white_color": "#fcd34d"}'),
  ('skin_ruby_pieces', 'Quân Hồng Ngọc', 'Quân cờ màu đỏ ruby quý phái', 'piece_skin', 0, 50, 'legendary', true, 'Ruby Pieces', 'Noble ruby red pieces', '{"black_color": "#be123c", "white_color": "#fda4af"}')
ON CONFLICT (item_code) DO NOTHING;

-- Add some sample board skins
INSERT INTO public.items (item_code, name, description, category, price_coins, price_gems, rarity, is_available, name_en, description_en, asset_data)
VALUES 
  ('skin_dark_board', 'Bàn Cờ Tối', 'Bàn cờ tông màu tối huyền bí', 'board_skin', 500, 0, 'rare', true, 'Dark Board', 'Mysterious dark themed board', '{"background": "linear-gradient(135deg, #1e293b, #0f172a)", "grid_color": "#475569", "star_color": "#64748b"}'),
  ('skin_ocean_board', 'Bàn Cờ Đại Dương', 'Bàn cờ màu xanh đại dương', 'board_skin', 1000, 0, 'epic', true, 'Ocean Board', 'Ocean blue themed board', '{"background": "linear-gradient(135deg, #0ea5e9, #0284c7)", "grid_color": "#38bdf8", "star_color": "#7dd3fc"}'),
  ('skin_sakura_board', 'Bàn Cờ Hoa Anh Đào', 'Bàn cờ màu hồng hoa anh đào', 'board_skin', 0, 50, 'legendary', true, 'Sakura Board', 'Cherry blossom pink board', '{"background": "linear-gradient(135deg, #fda4af, #fb7185)", "grid_color": "#f43f5e", "star_color": "#e11d48"}')
ON CONFLICT (item_code) DO NOTHING;
