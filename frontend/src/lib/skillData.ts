// 60 skills với mana_cost theo spec skill.md
export interface LocalSkill {
  id: string
  skill_code: string
  name_vi: string
  name_en: string
  description_vi: string
  description_en: string
  category: 'attack' | 'defense' | 'utility' | 'special'
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  effect_type: string
  effect_params: Record<string, any>
  cooldown: number
  mana_cost: number
  is_starter: boolean
}

// Mana costs theo spec skill.md
export const LOCAL_SKILLS: LocalSkill[] = [
  // ===================== SKILLS THƯỜNG (31 skills) =====================
  { id: 'SKL_001', skill_code: 'SKL_001', name_vi: 'Sấm Sét', name_en: 'Thunder Strike', description_vi: 'Phá hủy 1 quân địch', description_en: 'Destroy 1 enemy piece', category: 'attack', rarity: 'common', effect_type: 'destroy_piece', effect_params: { count: 1 }, cooldown: 3, mana_cost: 4, is_starter: true },
  { id: 'SKL_002', skill_code: 'SKL_002', name_vi: 'Lưỡi Dao Gió', name_en: 'Wind Blade', description_vi: 'Phá hủy quân trên 1 đường ngẫu nhiên', description_en: 'Destroy pieces on random line', category: 'attack', rarity: 'common', effect_type: 'line_destroy', effect_params: {}, cooldown: 2, mana_cost: 6, is_starter: true },
  { id: 'SKL_003', skill_code: 'SKL_003', name_vi: 'Địa Chấn', name_en: 'Earthquake', description_vi: 'Block 1 ô vĩnh viễn', description_en: 'Block 1 cell permanently', category: 'utility', rarity: 'common', effect_type: 'block_cell', effect_params: { permanent: true }, cooldown: 3, mana_cost: 6, is_starter: true },
  { id: 'SKL_004', skill_code: 'SKL_004', name_vi: 'Lốc Xoáy', name_en: 'Tornado', description_vi: 'Di chuyển ngẫu nhiên quân trong vùng 3x3', description_en: 'Randomly move pieces in 3x3', category: 'utility', rarity: 'common', effect_type: 'chaos_move', effect_params: { area: '3x3' }, cooldown: 5, mana_cost: 6, is_starter: true },
  { id: 'SKL_005', skill_code: 'SKL_005', name_vi: 'Nguyên Tố Lửa', name_en: 'Fire Element', description_vi: 'Đốt vùng 3x3 trong 3 lượt', description_en: 'Burn 3x3 area for 3 turns', category: 'utility', rarity: 'common', effect_type: 'burn_area', effect_params: { area: '3x3', duration: 3 }, cooldown: 3, mana_cost: 4, is_starter: true },
  { id: 'SKL_006', skill_code: 'SKL_006', name_vi: 'Thủy Chấn', name_en: 'Water Push', description_vi: 'Đẩy quân địch theo chuỗi', description_en: 'Push enemy pieces in chain', category: 'utility', rarity: 'common', effect_type: 'push_chain', effect_params: { distance: 1 }, cooldown: 5, mana_cost: 5, is_starter: true },
  { id: 'SKL_007', skill_code: 'SKL_007', name_vi: 'Phong Cước', name_en: 'Wind Step', description_vi: 'Di chuyển 1 quân đến ô trống bất kỳ', description_en: 'Move 1 piece to any empty cell', category: 'utility', rarity: 'common', effect_type: 'teleport_piece', effect_params: {}, cooldown: 5, mana_cost: 3, is_starter: true },
  { id: 'SKL_008', skill_code: 'SKL_008', name_vi: 'Nguyên Kết', name_en: 'Elemental Bind', description_vi: 'Quân địch biến mất 3 lượt', description_en: 'Enemy piece disappears for 3 turns', category: 'utility', rarity: 'common', effect_type: 'temp_remove', effect_params: { duration: 3 }, cooldown: 3, mana_cost: 5, is_starter: true },
  { id: 'SKL_009', skill_code: 'SKL_009', name_vi: 'Hồi Quy', name_en: 'Regression', description_vi: 'Giảm CD tất cả skill đi một nửa', description_en: 'Reduce all skill CD by half', category: 'utility', rarity: 'common', effect_type: 'reduce_cooldown', effect_params: { amount: 0.5 }, cooldown: 5, mana_cost: 2, is_starter: true },
  { id: 'SKL_010', skill_code: 'SKL_010', name_vi: 'Hồi Không', name_en: 'Void Return', description_vi: 'Mana về 15, loại bỏ 1 lá bài', description_en: 'Mana to 15, remove 1 card', category: 'utility', rarity: 'common', effect_type: 'restore_mana', effect_params: {}, cooldown: 3, mana_cost: 0, is_starter: true },
  { id: 'SKL_011', skill_code: 'SKL_011', name_vi: 'Nguyên Vệ', name_en: 'Elemental Guard', description_vi: 'Bảo vệ vùng 3x3 trong 3 lượt', description_en: 'Protect 3x3 area for 3 turns', category: 'defense', rarity: 'common', effect_type: 'immunity_area', effect_params: { area: '3x3', duration: 3 }, cooldown: 5, mana_cost: 5, is_starter: false },
  { id: 'SKL_012', skill_code: 'SKL_012', name_vi: 'Thiên Mệnh', name_en: 'Divine Fate', description_vi: 'Vô hiệu 1 skill tấn công địch', description_en: 'Nullify 1 enemy attack skill', category: 'defense', rarity: 'common', effect_type: 'dodge_next', effect_params: { count: 1 }, cooldown: 1, mana_cost: 6, is_starter: false },
  { id: 'SKL_013', skill_code: 'SKL_013', name_vi: 'Bảo Hộ', name_en: 'Protection', description_vi: 'Bảo vệ 1 ô đến cuối game', description_en: 'Protect 1 cell until end', category: 'defense', rarity: 'common', effect_type: 'permanent_protect', effect_params: {}, cooldown: 1, mana_cost: 10, is_starter: false },
  { id: 'SKL_014', skill_code: 'SKL_014', name_vi: 'Hồi Nguyên', name_en: 'Restoration', description_vi: 'Hồi 1 quân bị phá trong 3 lượt', description_en: 'Restore 1 piece from last 3 turns', category: 'defense', rarity: 'common', effect_type: 'restore_piece', effect_params: { time_limit: 3 }, cooldown: 2, mana_cost: 5, is_starter: false },
  { id: 'SKL_015', skill_code: 'SKL_015', name_vi: 'Nguyên Tĩnh', name_en: 'Elemental Silence', description_vi: 'Cả 2 không dùng skill 2 lượt', description_en: 'Both cannot use skills for 2 turns', category: 'utility', rarity: 'common', effect_type: 'silence_all', effect_params: { duration: 2 }, cooldown: 5, mana_cost: 8, is_starter: false },
  { id: 'SKL_016', skill_code: 'SKL_016', name_vi: 'Kim Cương', name_en: 'Diamond', description_vi: 'Cả 2 chọn 1 quân bảo hộ 5 lượt', description_en: 'Both choose 1 piece to protect 5 turns', category: 'defense', rarity: 'common', effect_type: 'mutual_protect', effect_params: { duration: 5 }, cooldown: 5, mana_cost: 6, is_starter: false },
  { id: 'SKL_017', skill_code: 'SKL_017', name_vi: 'Tường Nguyên', name_en: 'Elemental Wall', description_vi: 'Bảo vệ 1 hàng quân 2 lượt', description_en: 'Protect 1 row for 2 turns', category: 'defense', rarity: 'common', effect_type: 'protect_line', effect_params: { duration: 2 }, cooldown: 5, mana_cost: 6, is_starter: false },
  { id: 'SKL_018', skill_code: 'SKL_018', name_vi: 'Lá Chắn', name_en: 'Shield', description_vi: 'Bảo vệ 1 quân khỏi phá hủy', description_en: 'Protect 1 piece from destroy', category: 'defense', rarity: 'common', effect_type: 'destroy_immunity', effect_params: {}, cooldown: 3, mana_cost: 7, is_starter: false },
  { id: 'SKL_019', skill_code: 'SKL_019', name_vi: 'Hồn Lực', name_en: 'Soul Power', description_vi: 'Tăng gấp đôi skill tiếp theo', description_en: 'Double next skill effect', category: 'utility', rarity: 'common', effect_type: 'double_next', effect_params: {}, cooldown: 3, mana_cost: 4, is_starter: false },
  { id: 'SKL_020', skill_code: 'SKL_020', name_vi: 'Thần Hộ', name_en: 'Divine Protection', description_vi: 'Chuyển sát thương sang ô khác', description_en: 'Redirect damage to another cell', category: 'defense', rarity: 'common', effect_type: 'redirect_damage', effect_params: {}, cooldown: 3, mana_cost: 5, is_starter: false },
  { id: 'SKL_021', skill_code: 'SKL_021', name_vi: 'Khí Ngưng', name_en: 'Energy Condense', description_vi: 'Loại bỏ 5 skill địch 5 lượt', description_en: 'Remove 5 enemy skills for 5 turns', category: 'utility', rarity: 'common', effect_type: 'disable_skills', effect_params: { count: 5, duration: 5 }, cooldown: 5, mana_cost: 5, is_starter: false },
  { id: 'SKL_022', skill_code: 'SKL_022', name_vi: 'Cố Định Quân', name_en: 'Fix Piece', description_vi: 'Quân không di chuyển được 3 lượt', description_en: 'Piece cannot move for 3 turns', category: 'utility', rarity: 'common', effect_type: 'immobilize', effect_params: { duration: 3 }, cooldown: 2, mana_cost: 5, is_starter: false },
  { id: 'SKL_023', skill_code: 'SKL_023', name_vi: 'Giải Phóng', name_en: 'Liberation', description_vi: 'Giải trạng thái Cố Định', description_en: 'Remove Fixed status', category: 'utility', rarity: 'common', effect_type: 'remove_immobilize', effect_params: {}, cooldown: 3, mana_cost: 5, is_starter: false },
  { id: 'SKL_024', skill_code: 'SKL_024', name_vi: 'Tăng Cường', name_en: 'Enhancement', description_vi: 'Tăng 1 lượt cho tất cả buff', description_en: 'Add 1 turn to all buffs', category: 'utility', rarity: 'common', effect_type: 'extend_buffs', effect_params: { amount: 1 }, cooldown: 2, mana_cost: 5, is_starter: false },
  { id: 'SKL_025', skill_code: 'SKL_025', name_vi: 'Thời Không', name_en: 'Time Space', description_vi: '50/50 đi 2 lượt hoặc địch đi 2', description_en: '50/50 you or enemy gets 2 turns', category: 'utility', rarity: 'common', effect_type: 'turn_manipulation', effect_params: { chance: 0.5 }, cooldown: 1, mana_cost: 3, is_starter: false },
  { id: 'SKL_026', skill_code: 'SKL_026', name_vi: 'Lưu Chuyển', name_en: 'Flow', description_vi: 'Đổi vị trí 1 quân ta và 1 địch', description_en: 'Swap 1 your piece with 1 enemy', category: 'utility', rarity: 'common', effect_type: 'swap_pieces', effect_params: {}, cooldown: 3, mana_cost: 4, is_starter: false },
  { id: 'SKL_027', skill_code: 'SKL_027', name_vi: 'Hợp Nhất', name_en: 'Fusion', description_vi: 'Lượt sau dùng 2 skill cùng lúc', description_en: 'Next turn use 2 skills at once', category: 'utility', rarity: 'common', effect_type: 'double_skill', effect_params: {}, cooldown: 5, mana_cost: 8, is_starter: false },
  { id: 'SKL_028', skill_code: 'SKL_028', name_vi: 'Nguyên Phong', name_en: 'Elemental Wind', description_vi: 'Đẩy 2 quân địch tách chuỗi', description_en: 'Push 2 enemy pieces to break chain', category: 'attack', rarity: 'common', effect_type: 'break_chain', effect_params: {}, cooldown: 4, mana_cost: 5, is_starter: false },
  { id: 'SKL_029', skill_code: 'SKL_029', name_vi: 'Nguyên Sát', name_en: 'Elemental Strike', description_vi: 'Tăng 50% skill tấn công tiếp', description_en: 'Increase 50% next attack skill', category: 'utility', rarity: 'common', effect_type: 'attack_buff', effect_params: { multiplier: 1.5 }, cooldown: 3, mana_cost: 4, is_starter: false },
  { id: 'SKL_030', skill_code: 'SKL_030', name_vi: 'Bẫy Thiên Thần', name_en: 'Angel Trap', description_vi: 'Chọn 3 ô, skill địch bị phản', description_en: 'Choose 3 cells, enemy skills reflect', category: 'defense', rarity: 'common', effect_type: 'reflect_trap', effect_params: { count: 3 }, cooldown: 5, mana_cost: 7, is_starter: false },
  { id: 'SKL_031', skill_code: 'SKL_031', name_vi: 'Hồn Liên', name_en: 'Soul Link', description_vi: 'Tạo quân giả biến mất sau 5 lượt', description_en: 'Create fake piece for 5 turns', category: 'utility', rarity: 'common', effect_type: 'fake_piece', effect_params: { duration: 5 }, cooldown: 5, mana_cost: 3, is_starter: false },

  // ===================== SKILLS HIẾM (22 skills) =====================
  { id: 'SKL_032', skill_code: 'SKL_032', name_vi: 'Linh Ngọc', name_en: 'Spirit Gem', description_vi: 'Thêm 1 lượt đi ngay', description_en: 'Get 1 extra turn', category: 'utility', rarity: 'rare', effect_type: 'extra_turn', effect_params: {}, cooldown: 5, mana_cost: 5, is_starter: false },
  { id: 'SKL_033', skill_code: 'SKL_033', name_vi: 'Nguyên Quyết', name_en: 'Elemental Decision', description_vi: 'Xóa 1 skill địch, hy sinh 1 skill', description_en: 'Remove 1 enemy skill, sacrifice 1', category: 'utility', rarity: 'rare', effect_type: 'remove_enemy_skill', effect_params: {}, cooldown: 3, mana_cost: 5, is_starter: false },
  { id: 'SKL_034', skill_code: 'SKL_034', name_vi: 'Khí Nguyên', name_en: 'Energy Element', description_vi: 'Tăng 10% may mắn, stack 2 lần', description_en: 'Increase 10% luck, stack 2 times', category: 'utility', rarity: 'rare', effect_type: 'luck_buff', effect_params: { amount: 0.1, max_stack: 2 }, cooldown: 3, mana_cost: 4, is_starter: false },
  { id: 'SKL_035', skill_code: 'SKL_035', name_vi: 'Khử Buff', name_en: 'Remove Buff', description_vi: 'Vô hiệu buff trong 3 lượt tới', description_en: 'Nullify buffs for next 3 turns', category: 'utility', rarity: 'rare', effect_type: 'buff_immunity', effect_params: { duration: 3 }, cooldown: 5, mana_cost: 6, is_starter: false },
  { id: 'SKL_036', skill_code: 'SKL_036', name_vi: 'Hỏa Hồn', name_en: 'Fire Soul', description_vi: 'Đốt lan tỏa 5 quân trong 5 lượt', description_en: 'Fire spreads to 5 pieces in 5 turns', category: 'attack', rarity: 'rare', effect_type: 'fire_spread', effect_params: { duration: 5 }, cooldown: 5, mana_cost: 8, is_starter: false },
  { id: 'SKL_037', skill_code: 'SKL_037', name_vi: 'Băng Dịch', name_en: 'Ice Plague', description_vi: 'Đóng băng lan tỏa 5 quân', description_en: 'Ice spreads to 5 pieces', category: 'attack', rarity: 'rare', effect_type: 'ice_spread', effect_params: { duration: 5 }, cooldown: 5, mana_cost: 8, is_starter: false },
  { id: 'SKL_038', skill_code: 'SKL_038', name_vi: 'Mộc Sinh', name_en: 'Wood Growth', description_vi: 'Rễ quấn lan tỏa 5 quân', description_en: 'Roots spread to 5 pieces', category: 'attack', rarity: 'rare', effect_type: 'root_spread', effect_params: { duration: 5 }, cooldown: 5, mana_cost: 8, is_starter: false },
  { id: 'SKL_039', skill_code: 'SKL_039', name_vi: 'Thổ Hóa', name_en: 'Earth Transform', description_vi: 'Hóa thạch lan tỏa 5 ô', description_en: 'Petrify spreads to 5 cells', category: 'attack', rarity: 'rare', effect_type: 'stone_spread', effect_params: { duration: 5 }, cooldown: 5, mana_cost: 8, is_starter: false },
  { id: 'SKL_040', skill_code: 'SKL_040', name_vi: 'Kim Sát', name_en: 'Metal Strike', description_vi: 'Gỉ sét lan tỏa 5 quân', description_en: 'Rust spreads to 5 pieces', category: 'attack', rarity: 'rare', effect_type: 'rust_spread', effect_params: { duration: 5 }, cooldown: 5, mana_cost: 8, is_starter: false },
  { id: 'SKL_041', skill_code: 'SKL_041', name_vi: 'Hỏa Nguyên', name_en: 'Fire Counter', description_vi: 'Giải hiệu ứng Kim trong 3x3', description_en: 'Remove Metal effects in 3x3', category: 'utility', rarity: 'rare', effect_type: 'counter_metal', effect_params: { area: '3x3' }, cooldown: 5, mana_cost: 8, is_starter: false },
  { id: 'SKL_042', skill_code: 'SKL_042', name_vi: 'Thủy Nguyên', name_en: 'Water Counter', description_vi: 'Giải hiệu ứng Hỏa trong 3x3', description_en: 'Remove Fire effects in 3x3', category: 'utility', rarity: 'rare', effect_type: 'counter_fire', effect_params: { area: '3x3' }, cooldown: 5, mana_cost: 8, is_starter: false },
  { id: 'SKL_043', skill_code: 'SKL_043', name_vi: 'Mộc Nguyên', name_en: 'Wood Counter', description_vi: 'Giải hiệu ứng Thổ trong 3x3', description_en: 'Remove Earth effects in 3x3', category: 'utility', rarity: 'rare', effect_type: 'counter_earth', effect_params: { area: '3x3' }, cooldown: 5, mana_cost: 7, is_starter: false },
  { id: 'SKL_044', skill_code: 'SKL_044', name_vi: 'Thổ Nguyên', name_en: 'Earth Counter', description_vi: 'Giải hiệu ứng Thủy trong 3x3', description_en: 'Remove Water effects in 3x3', category: 'utility', rarity: 'rare', effect_type: 'counter_water', effect_params: { area: '3x3' }, cooldown: 5, mana_cost: 7, is_starter: false },
  { id: 'SKL_045', skill_code: 'SKL_045', name_vi: 'Kim Nguyên', name_en: 'Metal Counter', description_vi: 'Giải hiệu ứng Mộc trong 3x3', description_en: 'Remove Wood effects in 3x3', category: 'utility', rarity: 'rare', effect_type: 'counter_wood', effect_params: { area: '3x3' }, cooldown: 5, mana_cost: 7, is_starter: false },
  { id: 'SKL_046', skill_code: 'SKL_046', name_vi: 'Khí Hồn', name_en: 'Energy Soul', description_vi: 'Random skill bất kỳ', description_en: 'Random any skill effect', category: 'utility', rarity: 'rare', effect_type: 'random_skill', effect_params: {}, cooldown: 5, mana_cost: 10, is_starter: false },
  { id: 'SKL_047', skill_code: 'SKL_047', name_vi: 'Khử Debuff', name_en: 'Remove Debuff', description_vi: 'Xóa 1 debuff đang tác động', description_en: 'Remove 1 active debuff', category: 'utility', rarity: 'rare', effect_type: 'remove_debuff', effect_params: {}, cooldown: 5, mana_cost: 8, is_starter: false },
  { id: 'SKL_048', skill_code: 'SKL_048', name_vi: 'Cưỡng Chế', name_en: 'Force Move', description_vi: 'Di chuyển quân bị Cố Định', description_en: 'Move Fixed piece', category: 'utility', rarity: 'rare', effect_type: 'force_move_fixed', effect_params: {}, cooldown: 3, mana_cost: 8, is_starter: false },
  { id: 'SKL_049', skill_code: 'SKL_049', name_vi: 'Phản Nguyên', name_en: 'Reflect Element', description_vi: 'Đặt bẫy phản skill sau 5 lượt', description_en: 'Place reflect trap for 5 turns', category: 'defense', rarity: 'rare', effect_type: 'reflect_trap_delayed', effect_params: { duration: 5 }, cooldown: 5, mana_cost: 8, is_starter: false },
  { id: 'SKL_050', skill_code: 'SKL_050', name_vi: 'Nguyên Điểm', name_en: 'Element Point', description_vi: 'Ép địch chọn trước ô đặt quân', description_en: 'Force enemy to reveal next move', category: 'utility', rarity: 'rare', effect_type: 'force_reveal', effect_params: {}, cooldown: 5, mana_cost: 9, is_starter: false },
  { id: 'SKL_051', skill_code: 'SKL_051', name_vi: 'Nguyên Hóa', name_en: 'Transmutation', description_vi: 'Biến quân địch đơn lẻ thành ta', description_en: 'Convert isolated enemy to yours', category: 'attack', rarity: 'rare', effect_type: 'convert_piece', effect_params: {}, cooldown: 3, mana_cost: 10, is_starter: false },
  { id: 'SKL_052', skill_code: 'SKL_052', name_vi: 'Phong Ấn', name_en: 'Seal', description_vi: 'Ngăn quân địch nhận buff 3 lượt', description_en: 'Prevent enemy piece from buffs 3 turns', category: 'utility', rarity: 'rare', effect_type: 'seal_buff', effect_params: { duration: 3 }, cooldown: 3, mana_cost: 5, is_starter: false },
  { id: 'SKL_053', skill_code: 'SKL_053', name_vi: 'Đạo Tặc', name_en: 'Thief', description_vi: 'Lấy 1 skill hiếm/cực hiếm từ địch', description_en: 'Take 1 rare/legendary skill from enemy', category: 'utility', rarity: 'rare', effect_type: 'steal_skill', effect_params: {}, cooldown: 2, mana_cost: 2, is_starter: false },
  // ===================== SKILLS CỰC HIẾM (7 skills) =====================
  { id: 'SKL_054', skill_code: 'SKL_054', name_vi: 'Lưỡng Nguyên', name_en: 'Dual Element', description_vi: 'Random 50% có lợi/bất lợi cho mỗi quân', description_en: '50% beneficial/harmful for each piece', category: 'special', rarity: 'legendary', effect_type: 'chaos_all', effect_params: { chance: 0.5 }, cooldown: 0, mana_cost: 15, is_starter: false },
  { id: 'SKL_055', skill_code: 'SKL_055', name_vi: 'Hóa Giải', name_en: 'Dissolution', description_vi: 'Xóa tất cả hiệu ứng trên bàn cờ', description_en: 'Remove all effects on board', category: 'utility', rarity: 'legendary', effect_type: 'clear_all_effects', effect_params: {}, cooldown: 0, mana_cost: 8, is_starter: false },
  { id: 'SKL_056', skill_code: 'SKL_056', name_vi: 'Khai Nguyên', name_en: 'Origin', description_vi: 'Dùng lại 1 skill đã dùng', description_en: 'Reuse 1 used skill', category: 'utility', rarity: 'legendary', effect_type: 'reuse_skill', effect_params: {}, cooldown: 5, mana_cost: 8, is_starter: false },
  { id: 'SKL_057', skill_code: 'SKL_057', name_vi: 'Nguyên Thần', name_en: 'Elemental God', description_vi: 'Bảo vệ tất cả quân ta 5 lượt', description_en: 'Protect all your pieces 5 turns', category: 'defense', rarity: 'legendary', effect_type: 'protect_all', effect_params: { duration: 5 }, cooldown: 5, mana_cost: 15, is_starter: false },
  { id: 'SKL_058', skill_code: 'SKL_058', name_vi: 'Ẩn Thân', name_en: 'Invisibility', description_vi: 'Ẩn 5 quân, ta thấy địch không', description_en: 'Hide 5 pieces, you see enemy cannot', category: 'utility', rarity: 'legendary', effect_type: 'hide_pieces', effect_params: { count: 5 }, cooldown: 5, mana_cost: 5, is_starter: false },
  { id: 'SKL_059', skill_code: 'SKL_059', name_vi: 'Nguyên Cầu', name_en: 'Elemental Sphere', description_vi: 'Reset vùng 4x4 về trống', description_en: 'Reset 4x4 area to empty', category: 'attack', rarity: 'legendary', effect_type: 'reset_area', effect_params: { area: '4x4' }, cooldown: 5, mana_cost: 14, is_starter: false },
  { id: 'SKL_060', skill_code: 'SKL_060', name_vi: 'Nguyên Động', name_en: 'Chaos', description_vi: 'Tất cả quân nhảy ngẫu nhiên', description_en: 'All pieces jump randomly', category: 'special', rarity: 'legendary', effect_type: 'chaos_jump', effect_params: {}, cooldown: 0, mana_cost: 13, is_starter: false }
]

// Helper: Random 3 skills từ local pool
export const getRandomLocalSkills = (count: number = 3, exclude: string[] = []): LocalSkill[] => {
  const available = LOCAL_SKILLS.filter(s => !exclude.includes(s.id))
  const shuffled = [...available].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// Get skill by ID
export const getLocalSkillById = (id: string): LocalSkill | undefined => {
  return LOCAL_SKILLS.find(s => s.id === id || s.skill_code === id)
}

// Get skills by rarity
export const getLocalSkillsByRarity = (rarity: string): LocalSkill[] => {
  return LOCAL_SKILLS.filter(s => s.rarity === rarity)
}

// Get starter skills
export const getStarterSkills = (): LocalSkill[] => {
  return LOCAL_SKILLS.filter(s => s.is_starter)
}
