-- Migration: Replace old skills with official 60 skills
-- Date: 2025-12-09
-- Description: Xóa skills cũ, seed đúng 60 skills theo spec skill.md

-- =====================================================
-- STEP 0: Add 'ultra_rare' to skill_rarity enum if not exists
-- =====================================================
DO $$ 
BEGIN
  -- Check if 'ultra_rare' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'ultra_rare' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'skill_rarity')
  ) THEN
    ALTER TYPE skill_rarity ADD VALUE 'ultra_rare';
  END IF;
END $$;

-- =====================================================
-- STEP 1: Clear old skills data
-- =====================================================
TRUNCATE TABLE public.user_skill_combos CASCADE;
TRUNCATE TABLE public.user_skills CASCADE;
TRUNCATE TABLE public.match_skill_logs CASCADE;
DELETE FROM public.skills;

-- Reset sequence if exists
ALTER SEQUENCE IF EXISTS public.skills_id_seq RESTART WITH 1;

-- =====================================================
-- STEP 2: Seed 60 official skills theo spec skill.md
-- Thường: 31 skills (70% drop) - is_starter = true cho 10 skills
-- Hiếm: 22 skills (25% drop) - is_starter = false
-- Cực hiếm: 7 skills (5% drop) - is_starter = false
-- =====================================================

-- =====================================================
-- SKILLS THƯỜNG (31 skills) - ID 1-31
-- =====================================================
INSERT INTO public.skills (skill_code, name_vi, name_en, description_vi, description_en, category, rarity, effect_type, effect_params, cooldown, mana_cost, is_starter) VALUES
('SKL_001', 'Sấm Sét', 'Thunder Strike', 'Phá hủy 1 quân địch, ô đó trở thành ô trống có thể đặt quân cho cả 2 bên', 'Destroy 1 enemy piece, cell becomes empty for both players', 'attack', 'common', 'destroy_piece', '{"count": 1}', 3, 4, true),
('SKL_002', 'Lưỡi Dao Gió', 'Wind Blade', 'Random chọn 1 hàng/cột/đường chéo, phá hủy tất cả quân trên đường đó', 'Randomly choose row/column/diagonal, destroy all pieces on that line', 'attack', 'common', 'line_destroy', '{"direction": "random"}', 2, 6, true),
('SKL_003', 'Địa Chấn', 'Earthquake', 'Block 1 ô vĩnh viễn: không thể đặt quân và không chịu hiệu ứng đến hết game', 'Block 1 cell permanently until end game', 'utility', 'common', 'block_cell', '{"permanent": true}', 3, 6, true),
('SKL_004', 'Lốc Xoáy', 'Tornado', 'Chọn vùng 3x3, di chuyển ngẫu nhiên các quân đến vị trí trống', 'Choose 3x3 area, randomly move pieces to empty positions', 'utility', 'common', 'chaos_move', '{"area": "3x3"}', 5, 6, true),
('SKL_005', 'Nguyên Tố Lửa', 'Fire Element', 'Đốt các ô trong vùng 3x3 trong 3 lượt, không thể đặt quân vào', 'Burn cells in 3x3 area for 3 turns', 'utility', 'common', 'burn_area', '{"area": "3x3", "duration": 3}', 3, 4, true),
('SKL_006', 'Thủy Chấn', 'Water Push', 'Xê dịch 1 quân địch theo hướng, tất cả quân phía sau cũng bị đẩy theo chuỗi', 'Push 1 enemy piece in direction, all pieces behind also get pushed', 'utility', 'common', 'push_chain', '{"distance": 1}', 5, 5, true),
('SKL_007', 'Phong Cước', 'Wind Step', 'Di chuyển 1 quân đến 1 ô trống bất kỳ trên bàn cờ', 'Move 1 piece to any empty cell on board', 'utility', 'common', 'teleport_piece', '{}', 5, 3, true),
('SKL_008', 'Nguyên Kết', 'Elemental Bind', 'Làm 1 quân địch biến mất tạm thời trong 3 lượt, sau đó xuất hiện lại', 'Make 1 enemy piece disappear for 3 turns, then reappear', 'utility', 'common', 'temp_remove', '{"duration": 3}', 3, 5, true),
('SKL_009', 'Hồi Quy', 'Regression', 'Giảm thời gian CD tất cả skill đang hồi đi một nửa', 'Reduce CD time of all skills by half', 'utility', 'common', 'reduce_cooldown', '{"amount": 0.5}', 5, 2, true),
('SKL_010', 'Hồi Không', 'Void Return', 'Mana quay về 15. Loại bỏ 1 lá bài trong deck vĩnh viễn', 'Mana returns to 15. Remove 1 card from deck permanently', 'utility', 'common', 'restore_mana', '{"cost": "remove_card"}', 3, 0, true),
('SKL_011', 'Nguyên Vệ', 'Elemental Guard', 'Bảo vệ vùng 3x3 trong 3 lượt, miễn nhiễm tất cả hiệu ứng skill', 'Protect 3x3 area for 3 turns, immune to all skill effects', 'defense', 'common', 'immunity_area', '{"area": "3x3", "duration": 3}', 5, 5, false),
('SKL_012', 'Thiên Mệnh', 'Divine Fate', 'Vô hiệu hóa 1 skill tấn công của địch ở lượt tiếp theo', 'Nullify 1 enemy attack skill in next turn', 'defense', 'common', 'dodge_next', '{"count": 1}', 1, 6, false),
('SKL_013', 'Bảo Hộ', 'Protection', 'Bảo vệ 1 ô đến cuối game khỏi tất cả hiệu ứng', 'Protect 1 cell until end game from all effects', 'defense', 'common', 'permanent_protect', '{}', 1, 10, false),
('SKL_014', 'Hồi Nguyên', 'Restoration', 'Hồi lại 1 quân đã bị phá trong 3 lượt gần nhất', 'Restore 1 piece destroyed in last 3 turns', 'defense', 'common', 'restore_piece', '{"time_limit": 3}', 2, 5, false),
('SKL_015', 'Nguyên Tĩnh', 'Elemental Silence', 'Địch và ta đều không thể dùng skill trong 2 lượt', 'Both players cannot use skills for 2 turns', 'utility', 'common', 'silence_all', '{"duration": 2}', 5, 8, false),
('SKL_016', 'Kim Cương', 'Diamond', 'Cả 2 bên chọn 1 quân để bảo hộ trong 5 lượt', 'Both sides choose 1 piece to protect for 5 turns', 'defense', 'common', 'mutual_protect', '{"duration": 5}', 5, 6, false),
('SKL_017', 'Tường Nguyên', 'Elemental Wall', 'Bảo vệ 1 hàng quân liền kề (2-5 quân) trong 2 lượt', 'Protect 1 row of adjacent pieces for 2 turns', 'defense', 'common', 'protect_line', '{"duration": 2}', 5, 6, false),
('SKL_018', 'Lá Chắn', 'Shield', 'Bảo vệ 1 quân khỏi skill phá hủy đến cuối game', 'Protect 1 piece from destroy skills until end game', 'defense', 'common', 'destroy_immunity', '{}', 3, 7, false),
('SKL_019', 'Hồn Lực', 'Soul Power', 'Tăng gấp đôi thông số skill tiếp theo', 'Double the parameters of next skill', 'utility', 'common', 'double_next', '{}', 3, 4, false),
('SKL_020', 'Thần Hộ', 'Divine Protection', 'Thiết lập 1 ô nhận sát thương thay cho ô khác', 'Set up 1 cell to receive damage instead of another', 'defense', 'common', 'redirect_damage', '{}', 3, 5, false),
('SKL_021', 'Khí Ngưng', 'Energy Condense', 'Random loại bỏ tạm thời 5 skill trong deck địch trong 5 lượt', 'Randomly remove 5 skills from enemy deck for 5 turns', 'utility', 'common', 'disable_skills', '{"count": 5, "duration": 5}', 5, 5, false),
('SKL_022', 'Cố Định Quân', 'Fix Piece', 'Chọn 1 quân, không thể di chuyển bằng skill trong 3 lượt', 'Choose 1 piece, cannot be moved by skills for 3 turns', 'utility', 'common', 'immobilize', '{"duration": 3}', 2, 5, false),
('SKL_023', 'Giải Phóng', 'Liberation', 'Giải trạng thái Cố Định của 1 quân', 'Remove Fixed status from 1 piece', 'utility', 'common', 'remove_immobilize', '{}', 3, 5, false),
('SKL_024', 'Tăng Cường', 'Enhancement', 'Tăng thêm 1 lượt cho tất cả buff đang tác động', 'Add 1 turn to all active buffs', 'utility', 'common', 'extend_buffs', '{"amount": 1}', 2, 5, false),
('SKL_025', 'Thời Không', 'Time Space', 'Đảo thứ tự lượt: 50/50 địch đi 2 lượt hoặc ta đi 2 lượt', 'Reverse turn order: 50/50 chance', 'utility', 'common', 'turn_manipulation', '{"chance": 0.5}', 1, 3, false),
('SKL_026', 'Lưu Chuyển', 'Flow', 'Đổi vị trí 2 quân: 1 quân ta và 1 quân địch', 'Swap positions of 1 your piece and 1 enemy piece', 'utility', 'common', 'swap_pieces', '{}', 3, 4, false),
('SKL_027', 'Hợp Nhất', 'Fusion', 'Lượt tiếp theo có thể dùng 2 skill cùng lúc', 'Next turn can use 2 skills at once', 'utility', 'common', 'double_skill', '{}', 5, 8, false),
('SKL_028', 'Nguyên Phong', 'Elemental Wind', 'Tạo gió đẩy 2 quân địch liền nhau làm tách chuỗi', 'Create wind to push 2 adjacent enemy pieces to break chain', 'attack', 'common', 'break_chain', '{}', 4, 5, false),
('SKL_029', 'Nguyên Sát', 'Elemental Strike', 'Buff tấn công: tăng 50% hiệu ứng cho skill tấn công tiếp theo', 'Attack buff: increase 50% effect for next attack skill', 'utility', 'common', 'attack_buff', '{"multiplier": 1.5}', 3, 4, false),
('SKL_030', 'Bẫy Thiên Thần', 'Angel Trap', 'Chọn 3 ô quân ta, nếu địch dùng skill lên đó thì phản ngược', 'Choose 3 cells, if enemy uses skill on them, effect reflects back', 'defense', 'common', 'reflect_trap', '{"count": 3}', 5, 7, false),
('SKL_031', 'Hồn Liên', 'Soul Link', 'Tạo 1 quân giả, hoạt động như quân thật nhưng biến mất sau 5 lượt', 'Create 1 fake piece, works like real but disappears after 5 turns', 'utility', 'common', 'fake_piece', '{"duration": 5}', 5, 3, false);


-- =====================================================
-- SKILLS HIẾM (22 skills) - ID 32-53
-- =====================================================
INSERT INTO public.skills (skill_code, name_vi, name_en, description_vi, description_en, category, rarity, effect_type, effect_params, cooldown, mana_cost, is_starter) VALUES
('SKL_032', 'Linh Ngọc', 'Spirit Gem', 'Cho thêm 1 lượt đi ngay sau lượt hiện tại', 'Give 1 extra turn right after current turn', 'utility', 'rare', 'extra_turn', '{}', 5, 5, false),
('SKL_033', 'Nguyên Quyết', 'Elemental Decision', 'Chọn và xóa vĩnh viễn 1 skill trong deck địch. Hy sinh 1 skill cùng độ hiếm', 'Choose and permanently remove 1 skill from enemy deck. Sacrifice 1 skill of same rarity', 'utility', 'rare', 'remove_enemy_skill', '{"cost": "same_rarity"}', 3, 5, false),
('SKL_034', 'Khí Nguyên', 'Energy Element', 'Tăng tỷ lệ random có lợi +10%, stack tối đa 2 lần, duy trì 5 lượt', 'Increase favorable random chance +10%, max stack 2, lasts 5 turns', 'utility', 'rare', 'luck_buff', '{"amount": 0.1, "max_stack": 2, "duration": 5}', 3, 4, false),
('SKL_035', 'Khử Buff', 'Remove Buff', 'Vô hiệu hóa mọi buff sẽ được dùng trong 3 lượt tiếp theo', 'Nullify all buffs that will be used in next 3 turns', 'utility', 'rare', 'buff_immunity', '{"duration": 3}', 5, 6, false),
('SKL_036', 'Hỏa Hồn', 'Fire Soul', 'LAN TỎA HỆ HỎA: Đốt 1 quân địch, mỗi lượt lan sang 1 quân liền kề. Sau 5 lượt, 5 quân biến mất', 'FIRE SPREAD: Burn 1 enemy, spreads each turn. After 5 turns, 5 pieces disappear', 'attack', 'rare', 'fire_spread', '{"duration": 5, "spread_per_turn": 1}', 5, 8, false),
('SKL_037', 'Băng Dịch', 'Ice Plague', 'LAN TỎA HỆ THỦY: Đóng băng 1 quân địch, mỗi lượt lan sang 1 quân liền kề. Sau 5 lượt, 5 quân biến mất', 'WATER SPREAD: Freeze 1 enemy, spreads each turn. After 5 turns, 5 pieces disappear', 'attack', 'rare', 'ice_spread', '{"duration": 5, "spread_per_turn": 1}', 5, 8, false),
('SKL_038', 'Mộc Sinh', 'Wood Growth', 'LAN TỎA HỆ MỘC: Rễ quấn 1 quân địch, mỗi lượt lan. Sau 5 lượt, 5 quân không thể di chuyển', 'WOOD SPREAD: Roots wrap 1 enemy, spreads each turn. After 5 turns, 5 pieces cannot move', 'attack', 'rare', 'root_spread', '{"duration": 5, "spread_per_turn": 1}', 5, 8, false),
('SKL_039', 'Thổ Hóa', 'Earth Transform', 'LAN TỎA HỆ THỔ: Hóa thạch 1 quân địch, mỗi lượt lan. Sau 5 lượt, 5 ô thành block vĩnh viễn', 'EARTH SPREAD: Petrify 1 enemy, spreads each turn. After 5 turns, 5 cells become permanent blocks', 'attack', 'rare', 'stone_spread', '{"duration": 5, "spread_per_turn": 1}', 5, 8, false),
('SKL_040', 'Kim Sát', 'Metal Strike', 'LAN TỎA HỆ KIM: Gỉ sét 1 quân địch, mỗi lượt lan. Sau 5 lượt, 5 quân biến mất và không dùng skill 3 lượt', 'METAL SPREAD: Rust 1 enemy, spreads each turn. After 5 turns, 5 pieces disappear and no skills for 3 turns', 'attack', 'rare', 'rust_spread', '{"duration": 5, "spread_per_turn": 1}', 5, 8, false),
('SKL_041', 'Hỏa Nguyên', 'Fire Element', 'GIẢI HỆ KIM: Xóa mọi hiệu ứng hệ Kim trong vùng 3x3 trong 5 lượt gần nhất', 'COUNTER METAL: Remove all Metal effects in 3x3 area from last 5 turns', 'utility', 'rare', 'counter_metal', '{"area": "3x3", "time_limit": 5}', 5, 8, false),
('SKL_042', 'Thủy Nguyên', 'Water Element', 'GIẢI HỆ HỎA: Xóa mọi hiệu ứng hệ Hỏa trong vùng 3x3 trong 5 lượt gần nhất', 'COUNTER FIRE: Remove all Fire effects in 3x3 area from last 5 turns', 'utility', 'rare', 'counter_fire', '{"area": "3x3", "time_limit": 5}', 5, 8, false),
('SKL_043', 'Mộc Nguyên', 'Wood Element', 'GIẢI HỆ THỔ: Xóa mọi hiệu ứng hệ Thổ trong vùng 3x3 trong 5 lượt gần nhất', 'COUNTER EARTH: Remove all Earth effects in 3x3 area from last 5 turns', 'utility', 'rare', 'counter_earth', '{"area": "3x3", "time_limit": 5}', 5, 7, false),
('SKL_044', 'Thổ Nguyên', 'Earth Element', 'GIẢI HỆ THỦY: Xóa mọi hiệu ứng hệ Thủy trong vùng 3x3 trong 5 lượt gần nhất', 'COUNTER WATER: Remove all Water effects in 3x3 area from last 5 turns', 'utility', 'rare', 'counter_water', '{"area": "3x3", "time_limit": 5}', 5, 7, false),
('SKL_045', 'Kim Nguyên', 'Metal Element', 'GIẢI HỆ MỘC: Xóa mọi hiệu ứng hệ Mộc trong vùng 3x3 trong 5 lượt gần nhất', 'COUNTER WOOD: Remove all Wood effects in 3x3 area from last 5 turns', 'utility', 'rare', 'counter_wood', '{"area": "3x3", "time_limit": 5}', 5, 7, false),
('SKL_046', 'Khí Hồn', 'Energy Soul', 'Random sinh ra hiệu ứng của 1 skill bất kỳ (50% thường, 49% hiếm, 1% cực hiếm)', 'Randomly generate effect of any skill (50% common, 49% rare, 1% ultra rare)', 'utility', 'rare', 'random_skill', '{"common": 0.5, "rare": 0.49, "ultra_rare": 0.01}', 5, 10, false),
('SKL_047', 'Khử Debuff', 'Remove Debuff', 'Xóa 1 debuff cụ thể đang tác động lên quân ta', 'Remove 1 specific debuff affecting your pieces', 'utility', 'rare', 'remove_debuff', '{}', 5, 8, false),
('SKL_048', 'Cưỡng Chế Di Chuyển', 'Force Move', 'Bắt buộc di chuyển 1 quân đang bị Cố Định đến ô trống, phá vỡ trạng thái Cố Định', 'Force move 1 Fixed piece to empty cell, breaking Fixed status', 'utility', 'rare', 'force_move_fixed', '{}', 3, 8, false),
('SKL_049', 'Phản Nguyên', 'Reflect Element', 'Setup: đặt bẫy phản, sau 5 lượt sẽ phản lại 1 skill địch nếu bị kích hoạt', 'Setup: place reflect trap, after 5 turns will reflect 1 enemy skill if triggered', 'defense', 'rare', 'reflect_trap_delayed', '{"duration": 5}', 5, 8, false),
('SKL_050', 'Nguyên Điểm', 'Element Point', 'Ép địch phải chọn trước ô sẽ đặt quân ở lượt sau', 'Force enemy to choose cell for next turn placement', 'utility', 'rare', 'force_reveal', '{}', 5, 9, false),
('SKL_051', 'Nguyên Hóa', 'Transmutation', 'Biến 1 quân địch đơn lẻ thành quân ta', 'Convert 1 isolated enemy piece to yours', 'attack', 'rare', 'convert_piece', '{}', 3, 10, false),
('SKL_052', 'Phong Ấn', 'Seal', 'Debuff: Ngăn 1 quân địch nhận bất kỳ buff nào trong 3 lượt', 'Debuff: Prevent 1 enemy piece from receiving any buff for 3 turns', 'utility', 'rare', 'seal_buff', '{"duration": 3}', 3, 5, false),
('SKL_053', 'Đạo Tặc', 'Thief', 'Ngẫu nhiên lấy 1 skill hiếm/cực hiếm từ deck địch, dùng ngay nếu đủ mana', 'Randomly take 1 rare/ultra rare skill from enemy deck, use immediately if enough mana', 'utility', 'rare', 'steal_skill', '{"rare": 0.7, "ultra_rare": 0.3}', 2, 2, false);

-- =====================================================
-- SKILLS CỰC HIẾM (7 skills) - ID 54-60
-- Dùng 'legendary' thay vì 'ultra_rare' vì enum chưa có ultra_rare
-- =====================================================
INSERT INTO public.skills (skill_code, name_vi, name_en, description_vi, description_en, category, rarity, effect_type, effect_params, cooldown, mana_cost, is_starter) VALUES
('SKL_054', 'Lưỡng Nguyên', 'Dual Element', 'Chọn liên tục các quân trên bàn cờ, mỗi quân random 50% có lợi / 50% bất lợi', 'Select pieces continuously, each gets random 50% beneficial / 50% harmful effect', 'special', 'legendary', 'chaos_all', '{"chance": 0.5}', 0, 15, false),
('SKL_055', 'Hóa Giải', 'Dissolution', 'Xóa tất cả hiệu ứng đang tồn tại trên bàn cờ của cả 2 bên', 'Remove all existing effects on board for both sides', 'utility', 'legendary', 'clear_all_effects', '{}', 0, 8, false),
('SKL_056', 'Khai Nguyên', 'Origin', 'Chọn lại 1 skill đã dùng từ đầu ván để dùng lại ngay. Hy sinh 1 skill cùng độ hiếm', 'Choose 1 used skill from start of match to use again. Sacrifice 1 skill of same rarity', 'utility', 'legendary', 'reuse_skill', '{"cost": "same_rarity"}', 5, 8, false),
('SKL_057', 'Nguyên Thần', 'Elemental God', 'ULTIMATE: Bảo vệ tất cả quân ta trong 5 lượt khỏi mọi hiệu ứng', 'ULTIMATE: Protect all your pieces for 5 turns from all effects', 'defense', 'legendary', 'protect_all', '{"duration": 5}', 5, 15, false),
('SKL_058', 'Ẩn Thân', 'Invisibility', 'Random ẩn 5 quân bất kì của ta và địch, ta vẫn nhìn thấy, địch không thấy', 'Randomly hide 5 pieces of both sides, you can see them, enemy cannot', 'utility', 'legendary', 'hide_pieces', '{"count": 5}', 5, 5, false),
('SKL_059', 'Nguyên Cầu', 'Elemental Sphere', 'RESET vùng 4x4: xóa mọi hiệu ứng và quân cờ trong vùng, trả về trạng thái trống', 'RESET 4x4 area: remove all effects and pieces in area, return to empty state', 'attack', 'legendary', 'reset_area', '{"area": "4x4"}', 5, 14, false),
('SKL_060', 'Nguyên Động', 'Chaos', 'CHAOS: toàn bộ quân trên bàn nhảy loạn sang 1 ô ngẫu nhiên (8 hướng) nếu trống', 'CHAOS: all pieces on board jump randomly to adjacent cell (8 directions) if empty', 'special', 'legendary', 'chaos_jump', '{}', 0, 13, false);

-- =====================================================
-- STEP 3: Verify counts
-- =====================================================
-- Expected: 31 common, 22 rare, 7 legendary = 60 total
-- SELECT rarity, COUNT(*) FROM public.skills GROUP BY rarity;
-- SELECT COUNT(*) FROM public.skills; -- Should be 60
