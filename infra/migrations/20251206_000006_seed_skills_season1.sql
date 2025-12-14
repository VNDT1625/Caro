-- Migration: Seed 40 skills for Season 1
-- Date: 2025-12-06

-- =====================================================
-- ATTACK SKILLS (12 total: 8 common, 3 rare, 1 epic)
-- =====================================================

-- Common Attack Skills
INSERT INTO public.skills (skill_code, name_vi, name_en, description_vi, description_en, category, rarity, effect_type, effect_params, cooldown, is_starter) VALUES
('ATK_QUICK', 'Tốc Công', 'Quick Strike', 'Đặt thêm 1 quân ở ô kề với quân vừa đặt', 'Place an extra piece adjacent to your last move', 'attack', 'common', 'place_adjacent', '{"count": 1}', 3, true),
('ATK_PUSH', 'Đẩy Lùi', 'Push Back', 'Đẩy 1 quân địch ra xa 1 ô', 'Push an enemy piece 1 cell away', 'attack', 'common', 'push_enemy', '{"distance": 1}', 3, true),
('ATK_MARK', 'Đánh Dấu', 'Mark Target', 'Đánh dấu 1 ô, quân đặt vào đó được +1 điểm threat', 'Mark a cell, pieces placed there gain +1 threat', 'attack', 'common', 'mark_cell', '{"bonus": 1, "duration": 3}', 4, false),
('ATK_RUSH', 'Xung Phong', 'Rush', 'Lượt này đặt quân không tốn thời gian', 'This turn placing piece costs no time', 'attack', 'common', 'no_time_cost', '{}', 2, true),
('ATK_FOCUS', 'Tập Trung', 'Focus', 'Quân tiếp theo đặt sẽ không bị skill địch ảnh hưởng', 'Next piece placed is immune to enemy skills', 'attack', 'common', 'immune_next', '{"duration": 1}', 3, false),
('ATK_CHAIN', 'Liên Hoàn', 'Chain', 'Nếu tạo được 3 liên tiếp, được đặt thêm 1 quân', 'If you create 3 in a row, place another piece', 'attack', 'common', 'bonus_on_three', '{}', 4, false),
('ATK_SCOUT', 'Trinh Sát', 'Scout', 'Xem vị trí đối thủ sẽ đặt quân tiếp theo', 'See where opponent will place next', 'attack', 'common', 'reveal_next_move', '{}', 5, false),
('ATK_PRESSURE', 'Áp Lực', 'Pressure', 'Giảm 5s thời gian lượt của đối thủ', 'Reduce opponent turn time by 5s', 'attack', 'common', 'reduce_time', '{"seconds": 5}', 3, true),

-- Rare Attack Skills
('ATK_DOUBLE', 'Đôi Công', 'Double Strike', 'Đặt 2 quân cùng lúc (cách nhau ít nhất 2 ô)', 'Place 2 pieces at once (at least 2 cells apart)', 'attack', 'rare', 'place_double', '{"count": 2, "min_distance": 2}', 5, false),
('ATK_PIERCE', 'Xuyên Phá', 'Pierce', 'Xóa 1 quân địch bất kỳ (không phải quân vừa đặt)', 'Remove any enemy piece (not the last placed)', 'attack', 'rare', 'remove_enemy', '{"count": 1}', 6, false),
('ATK_SNIPE', 'Tỉa', 'Snipe', 'Xóa quân địch xa nhất từ trung tâm bàn cờ', 'Remove enemy piece furthest from center', 'attack', 'rare', 'remove_furthest', '{}', 5, false),

-- Epic Attack Skill
('ATK_BOMB', 'Bom', 'Bomb', 'Xóa tất cả quân trong vùng 3x3 (cả 2 bên)', 'Remove all pieces in 3x3 area (both sides)', 'attack', 'epic', 'bomb_area', '{"radius": 1}', 8, false);

-- =====================================================
-- DEFENSE SKILLS (12 total: 8 common, 3 rare, 1 epic)
-- =====================================================

-- Common Defense Skills
INSERT INTO public.skills (skill_code, name_vi, name_en, description_vi, description_en, category, rarity, effect_type, effect_params, cooldown, is_starter) VALUES
('DEF_GUARD', 'Phòng Thủ', 'Guard', 'Bảo vệ 1 quân của mình khỏi bị xóa trong 2 lượt', 'Protect one of your pieces from removal for 2 turns', 'defense', 'common', 'protect_piece', '{"duration": 2}', 3, true),
('DEF_BLOCK', 'Chặn', 'Block', 'Đặt 1 ô chặn tạm thời (2 lượt), không ai đặt được', 'Place a temporary blocker (2 turns), no one can place there', 'defense', 'common', 'block_cell', '{"duration": 2}', 3, true),
('DEF_HEAL', 'Hồi Phục', 'Heal', 'Khôi phục 1 quân đã bị xóa gần đây nhất', 'Restore your most recently removed piece', 'defense', 'common', 'restore_piece', '{"count": 1}', 4, false),
('DEF_DODGE', 'Né Tránh', 'Dodge', 'Skill tiếp theo của đối thủ sẽ miss', 'Opponent next skill will miss', 'defense', 'common', 'dodge_next', '{}', 4, true),
('DEF_ANCHOR', 'Neo', 'Anchor', 'Cố định 1 quân của mình, không thể bị di chuyển', 'Anchor your piece, cannot be moved', 'defense', 'common', 'anchor_piece', '{"duration": 5}', 3, false),
('DEF_MIST', 'Sương Mù', 'Mist', 'Ẩn 3 quân của mình trong 2 lượt', 'Hide 3 of your pieces for 2 turns', 'defense', 'common', 'hide_pieces', '{"count": 3, "duration": 2}', 5, false),
('DEF_REFLECT', 'Phản Xạ', 'Reflect', 'Skill attack tiếp theo của địch sẽ ảnh hưởng chính họ', 'Next enemy attack skill affects themselves', 'defense', 'common', 'reflect_attack', '{}', 5, false),
('DEF_FORTIFY', 'Củng Cố', 'Fortify', 'Tăng thời gian lượt của mình thêm 10s', 'Increase your turn time by 10s', 'defense', 'common', 'add_time', '{"seconds": 10}', 2, true),

-- Rare Defense Skills
('DEF_SHIELD', 'Khiên', 'Shield', 'Tạo khiên bảo vệ vùng 2x2, không bị skill ảnh hưởng', 'Create shield protecting 2x2 area from skills', 'defense', 'rare', 'shield_area', '{"size": 2, "duration": 3}', 6, false),
('DEF_WALL', 'Tường', 'Wall', 'Đặt 3 ô chặn liên tiếp (ngang hoặc dọc)', 'Place 3 consecutive blockers (horizontal or vertical)', 'defense', 'rare', 'wall_line', '{"length": 3, "duration": 3}', 7, false),
('DEF_SWAP', 'Hoán Đổi', 'Swap', 'Đổi vị trí 2 quân của mình', 'Swap positions of 2 of your pieces', 'defense', 'rare', 'swap_own', '{}', 5, false),

-- Epic Defense Skill
('DEF_MIRROR', 'Gương', 'Mirror', 'Copy nước đi cuối của đối thủ (đặt quân cùng pattern)', 'Copy opponent last move pattern', 'defense', 'epic', 'copy_move', '{}', 8, false);

-- =====================================================
-- UTILITY SKILLS (12 total: 8 common, 3 rare, 1 epic)
-- =====================================================

-- Common Utility Skills
INSERT INTO public.skills (skill_code, name_vi, name_en, description_vi, description_en, category, rarity, effect_type, effect_params, cooldown, is_starter) VALUES
('UTL_SCAN', 'Quét', 'Scan', 'Hiện 2 ô tốt nhất để đặt quân (AI suggest)', 'Show 2 best cells to place (AI suggest)', 'utility', 'common', 'ai_suggest', '{"count": 2}', 3, true),
('UTL_PEEK', 'Nhìn Trộm', 'Peek', 'Xem 2 skill tiếp theo trong combo của đối thủ', 'See opponent next 2 skills in their combo', 'utility', 'common', 'peek_skills', '{"count": 2}', 4, false),
('UTL_SHUFFLE', 'Xáo Trộn', 'Shuffle', 'Xáo lại 3 skill được random lượt này', 'Re-roll the 3 random skills this turn', 'utility', 'common', 'reroll_skills', '{}', 2, true),
('UTL_SAVE', 'Lưu', 'Save', 'Lưu 1 skill để dùng lượt sau (không random)', 'Save 1 skill to use next turn (no random)', 'utility', 'common', 'save_skill', '{}', 4, false),
('UTL_BOOST', 'Tăng Tốc', 'Boost', 'Giảm cooldown tất cả skill của mình đi 1', 'Reduce all your skill cooldowns by 1', 'utility', 'common', 'reduce_cooldown', '{"amount": 1}', 5, false),
('UTL_DRAIN', 'Hút', 'Drain', 'Tăng cooldown 1 skill của đối thủ thêm 2', 'Increase 1 enemy skill cooldown by 2', 'utility', 'common', 'increase_enemy_cd', '{"amount": 2}', 4, false),
('UTL_INSIGHT', 'Thấu Hiểu', 'Insight', 'Xem threat level của tất cả ô trống', 'See threat level of all empty cells', 'utility', 'common', 'show_threats', '{"duration": 1}', 3, true),
('UTL_BALANCE', 'Cân Bằng', 'Balance', 'Reset cooldown của 1 skill bất kỳ của mình', 'Reset cooldown of any of your skills', 'utility', 'common', 'reset_one_cd', '{}', 6, false),

-- Rare Utility Skills
('UTL_REVEAL', 'Soi', 'Reveal', 'Hiện 3 nước đi tốt nhất với phân tích chi tiết', 'Show 3 best moves with detailed analysis', 'utility', 'rare', 'ai_analyze', '{"count": 3, "detailed": true}', 6, false),
('UTL_UNDO', 'Hồi', 'Undo', 'Undo nước đi cuối của đối thủ', 'Undo opponent last move', 'utility', 'rare', 'undo_enemy', '{}', 8, false),
('UTL_FREEZE', 'Đóng Băng', 'Freeze', 'Đối thủ không thể dùng skill trong 2 lượt', 'Opponent cannot use skills for 2 turns', 'utility', 'rare', 'freeze_skills', '{"duration": 2}', 7, false),

-- Epic Utility Skill
('UTL_EXTEND', 'Kéo Dài', 'Extend', 'Thêm 30s cho lượt này + xem AI analysis', 'Add 30s to this turn + see AI analysis', 'utility', 'epic', 'extend_turn', '{"seconds": 30, "analysis": true}', 10, false);

-- =====================================================
-- ADDITIONAL SKILLS FROM EXISTING FRONTEND (20 more)
-- These match the skills in VariantMatch.tsx
-- =====================================================

-- Existing frontend skills - Attack category
INSERT INTO public.skills (skill_code, name_vi, name_en, description_vi, description_en, category, rarity, effect_type, effect_params, cooldown, is_starter) VALUES
('ATK_LIGHTNING', 'Sét Đánh', 'Lightning', 'Xóa ngẫu nhiên 1 quân địch trên bàn cờ', 'Remove a random enemy piece from the board', 'attack', 'rare', 'random_remove', '{"count": 1}', 6, false),
('ATK_POISON', 'Độc', 'Poison', 'Đánh dấu 1 quân địch, sau 2 lượt sẽ bị xóa', 'Mark an enemy piece, it will be removed after 2 turns', 'attack', 'common', 'poison_mark', '{"delay": 2}', 5, false),
('ATK_STEAL', 'Cướp', 'Steal', 'Cướp 1 skill ngẫu nhiên từ đối thủ', 'Steal a random skill from opponent', 'attack', 'rare', 'steal_skill', '{}', 7, false),
('ATK_GRAVITY', 'Trọng Lực', 'Gravity', 'Kéo tất cả quân về phía dưới bàn cờ', 'Pull all pieces towards the bottom of the board', 'attack', 'epic', 'gravity_pull', '{"direction": "down"}', 8, false);

-- Existing frontend skills - Defense category  
INSERT INTO public.skills (skill_code, name_vi, name_en, description_vi, description_en, category, rarity, effect_type, effect_params, cooldown, is_starter) VALUES
('DEF_CLONE', 'Phân Thân', 'Clone', 'Nhân đôi 1 quân của mình (tạo ở ô kề)', 'Clone one of your pieces to an adjacent cell', 'defense', 'rare', 'clone_piece', '{}', 9, false),
('DEF_HEAL', 'Hồi Máu', 'Heal', 'Khôi phục 1 quân đã bị xóa gần nhất', 'Restore your most recently removed piece', 'defense', 'common', 'restore_piece', '{}', 4, true);

-- Existing frontend skills - Utility category
INSERT INTO public.skills (skill_code, name_vi, name_en, description_vi, description_en, category, rarity, effect_type, effect_params, cooldown, is_starter) VALUES
('UTL_SCOUT', 'Trinh Sát', 'Scout', 'Xem 3 nước đi tiếp theo của đối thủ', 'See opponent next 3 planned moves', 'utility', 'common', 'scout_moves', '{"count": 3}', 3, true),
('UTL_SHUFFLE', 'Xáo Bài', 'Shuffle', 'Xáo trộn vị trí tất cả quân trên bàn cờ', 'Shuffle positions of all pieces on the board', 'utility', 'epic', 'shuffle_board', '{}', 10, false),
('UTL_TIMEWARP', 'Xoay Thời Gian', 'Time Warp', 'Quay lại trạng thái bàn cờ 3 lượt trước', 'Revert board state to 3 turns ago', 'utility', 'legendary', 'time_revert', '{"turns": 3}', 12, false);

-- =====================================================
-- SPECIAL/LEGENDARY SKILLS (4 total)
-- =====================================================

INSERT INTO public.skills (skill_code, name_vi, name_en, description_vi, description_en, category, rarity, effect_type, effect_params, cooldown, unlock_requirement) VALUES
('SPC_TELEPORT', 'Dịch Chuyển', 'Teleport', 'Di chuyển 1 quân của mình đến bất kỳ ô trống nào', 'Move one of your pieces to any empty cell', 'special', 'legendary', 'teleport_piece', '{}', 10, '{"type": "level", "value": 15}'),
('SPC_CLONE', 'Phân Thân', 'Clone', 'Nhân đôi 1 quân (tạo thêm 1 quân ở ô kề trống)', 'Clone a piece (create copy in adjacent empty cell)', 'special', 'legendary', 'clone_piece', '{}', 10, '{"type": "level", "value": 20}'),
('SPC_VOID', 'Hư Vô', 'Void', 'Reset cooldown tất cả skill của mình về 0', 'Reset all your skill cooldowns to 0', 'special', 'legendary', 'reset_all_cd', '{}', 15, '{"type": "achievement", "achievement_code": "win_50_ranked"}'),
('SPC_DESTINY', 'Định Mệnh', 'Destiny', 'Chọn chính xác 3 skill sẽ xuất hiện lượt sau', 'Choose exactly which 3 skills appear next turn', 'special', 'legendary', 'choose_next_skills', '{}', 12, '{"type": "purchase", "coins": 5000}');

-- =====================================================
-- CREATE SEASON 1
-- =====================================================

INSERT INTO public.seasons (season_number, name, name_en, start_date, end_date, is_active, skill_pool, theme_color)
SELECT 
  1,
  'Mùa Khai Nguyên',
  'Genesis Season',
  '2025-12-01'::timestamp with time zone,
  '2026-04-01'::timestamp with time zone,
  true,
  jsonb_agg(id),
  '#22D3EE'
FROM public.skills
WHERE is_active = true;

-- Update skill_pool with all skill IDs
UPDATE public.seasons 
SET skill_pool = (SELECT jsonb_agg(id) FROM public.skills WHERE is_active = true)
WHERE season_number = 1;
