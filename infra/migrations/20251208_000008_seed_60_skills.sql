-- Seed 60 skills for Caro Skill mode (deck 15, draw 3/turn)
-- Wipe old skill data (guarded if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'match_skill_logs') THEN
    EXECUTE 'TRUNCATE public.match_skill_logs RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_skill_combos') THEN
    EXECUTE 'TRUNCATE public.user_skill_combos RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_skills') THEN
    EXECUTE 'TRUNCATE public.user_skills RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'skills') THEN
    EXECUTE 'TRUNCATE public.skills RESTART IDENTITY CASCADE';
  END IF;
END$$;

-- Insert 60 skills (names/descriptions in ASCII to avoid mojibake)
INSERT INTO public.skills
  (skill_code, name_vi, name_en, description_vi, description_en, category, rarity, effect_type, effect_params, cooldown, mana_cost, is_starter)
VALUES
  -- Lan toa (rare)
  ('SKL_001', 'Hoa Hon', 'Hoa Hon', 'Dot 1 quan dich, lan 5 luot se mat 5 quan', 'Burn spreads 5 turns, remove 5 enemy pieces', 'attack', 'rare', 'custom_effect', '{}', 5, 8, false),
  ('SKL_002', 'Bang Dich', 'Bang Dich', 'Dong bang lan 5 luot, mat luot va bien mat 5 quan', 'Freeze spreads, remove 5 pieces', 'attack', 'rare', 'custom_effect', '{}', 5, 8, false),
  ('SKL_003', 'Moc Sinh', 'Moc Sinh', 'Re lan 5 luot, khoa di chuyen vinh vien 5 quan', 'Roots spread, lock 5 pieces', 'attack', 'rare', 'custom_effect', '{}', 5, 8, false),
  ('SKL_004', 'Tho Hoa', 'Tho Hoa', 'Hoa thach lan 5 luot, block vinh vien 5 o', 'Stone spread blocks 5 cells', 'attack', 'rare', 'custom_effect', '{}', 5, 8, false),
  ('SKL_005', 'Kim Sat', 'Kim Sat', 'Gi set lan 5 luot, mat kha nang skill 5 quan', 'Rust spread disables 5 pieces', 'attack', 'rare', 'custom_effect', '{}', 5, 8, false),
  -- Tan cong thuong
  ('SKL_006', 'Sam Set', 'Lightning', 'Pha huy 1 quan dich', 'Destroy one enemy piece', 'attack', 'common', 'remove_enemy', '{}', 3, 4, false),
  ('SKL_007', 'Luoi Dao Gio', 'Wind Blade', 'Pha ngau nhien 1 hang/cot/cheo', 'Destroy random line', 'attack', 'common', 'custom_effect', '{}', 2, 6, false),
  ('SKL_008', 'Dia Chan', 'Earth Quake', 'Block 1 o vinh vien', 'Permanently block a cell', 'defense', 'common', 'block_cell', '{"duration": 0}', 3, 6, false),
  ('SKL_009', 'Loc Xoay', 'Tornado', 'Xao tron 3x3, day toi da 3 quan', 'Shuffle pieces in 3x3', 'attack', 'common', 'custom_effect', '{}', 5, 6, false),
  ('SKL_010', 'Nguyen To Lua', 'Fire Zone', 'Dot 3x3 trong 3 luot', 'Burn 3x3 for 3 turns', 'attack', 'common', 'custom_effect', '{}', 3, 4, false),
  ('SKL_011', 'Thuy Chan', 'Water Push', 'Day 1 quan theo huong', 'Push one enemy piece', 'attack', 'common', 'push_enemy', '{"distance":1}', 5, 5, false),
  ('SKL_012', 'Phong Cuoc', 'Wind Step', 'Di chuyen 1 quan toi o trong', 'Move any piece to empty cell', 'attack', 'common', 'teleport_piece', '{}', 5, 3, false),
  ('SKL_013', 'Nguyen Ket', 'Banish', 'An 1 quan dich 3 luot', 'Hide enemy piece for 3 turns', 'attack', 'common', 'custom_effect', '{}', 3, 5, false),
  ('SKL_014', 'Hoa Nhan', 'Reveal Fire', 'Soi sang 3x3', 'Reveal 3x3 area', 'utility', 'common', 'custom_effect', '{}', 2, 2, false),
  ('SKL_015', 'Bung No', 'Explosion', 'Pha ngau nhien 5 o trong 5x5', 'Destroy 5 cells in 5x5', 'attack', 'common', 'bomb_area', '{"radius":2}', 4, 8, false),
  -- Giai he (rare)
  ('SKL_016', 'Hoa Nguyen', 'Fire Cleanse', 'Xoa hieu ung he Kim', 'Cleanse Metal effects', 'utility', 'rare', 'custom_effect', '{}', 3, 7, false),
  ('SKL_017', 'Thuy Nguyen', 'Water Cleanse', 'Xoa hieu ung he Hoa', 'Cleanse Fire effects', 'utility', 'rare', 'custom_effect', '{}', 3, 7, false),
  ('SKL_018', 'Moc Nguyen', 'Wood Cleanse', 'Xoa hieu ung he Tho', 'Cleanse Earth effects', 'utility', 'rare', 'custom_effect', '{}', 3, 7, false),
  ('SKL_019', 'Tho Nguyen', 'Earth Cleanse', 'Xoa hieu ung he Thuy', 'Cleanse Water effects', 'utility', 'rare', 'custom_effect', '{}', 3, 7, false),
  ('SKL_020', 'Kim Nguyen', 'Metal Cleanse', 'Xoa hieu ung he Moc', 'Cleanse Wood effects', 'utility', 'rare', 'custom_effect', '{}', 3, 7, false),
  -- Phong thu/buff thuong
  ('SKL_021', 'Nguyen Ve', 'Aegis Zone', 'Bao ve 3x3 trong 3 luot', 'Shield 3x3 for 3 turns', 'defense', 'common', 'shield_area', '{"size":1,"duration":3}', 5, 5, false),
  ('SKL_022', 'Thien Menh', 'Dodge', 'Vo hieu 1 skill tan cong luot ke', 'Negate next enemy skill', 'defense', 'common', 'dodge_next', '{}', 1, 6, false),
  ('SKL_023', 'Bao Ho', 'Sanctuary', 'Bao ve 1 o den cuoi game', 'Protect a cell until end', 'defense', 'common', 'protect_piece', '{"duration":99}', 1, 10, false),
  ('SKL_024', 'Hoi Nguyen', 'Restore', 'Hoi lai 1 quan bi pha 3 luot gan nhat', 'Restore a recently destroyed piece', 'defense', 'common', 'restore_piece', '{}', 2, 5, false),
  ('SKL_025', 'Nguyen Tinh', 'Silence', 'Cam dung skill 2-3 luot', 'Silence skills for 2-3 turns', 'utility', 'common', 'freeze_skills', '{"duration":2}', 5, 8, false),
  ('SKL_026', 'Kim Cuong', 'Diamond Guard', 'Bao ho 1 quan moi ben 5 luot', 'Both sides protect one piece 5 turns', 'defense', 'common', 'custom_effect', '{}', 5, 6, false),
  ('SKL_027', 'Tuong Nguyen', 'Wall Line', 'Bao ve 1 day quan 2-5 quan 3 luot', 'Shield a line of own pieces', 'defense', 'common', 'wall_line', '{"length":3}', 5, 6, false),
  ('SKL_028', 'La Chan', 'Shield One', 'Chan pha huy bien mat', 'Immunity to destroy effects', 'defense', 'common', 'protect_piece', '{"duration":99}', 3, 7, false),
  ('SKL_029', 'Hon Luc', 'Power Up', 'Gap doi thong so skill ke tiep', 'Double next skill effect', 'utility', 'common', 'custom_effect', '{"type":"buff_next"}', 3, 4, false),
  ('SKL_030', 'Than Ho', 'Bodyguard', 'Chuyen sat thuong sang o khac', 'Redirect damage to another piece', 'defense', 'common', 'custom_effect', '{}', 3, 5, false),
  ('SKL_031', 'Khi Ngung', 'Fog', 'Loai 10 skill deck dich 5 luot', 'Temporarily remove 10 enemy skills', 'utility', 'common', 'custom_effect', '{}', 5, 5, false),
  -- Legendary/rare/special
  ('SKL_032', 'Linh Ngoc', 'Double Turn', 'Them 1 luot di ngay', 'Gain an extra turn', 'special', 'legendary', 'extend_turn', '{"seconds":0}', 5, 12, false),
  ('SKL_033', 'Nguyen Than', 'Ultimate Guard', 'Bao ve tat ca quan 5 luot', 'Protect all own pieces 5 turns', 'defense', 'legendary', 'custom_effect', '{}', 5, 15, false),
  ('SKL_034', 'Khi Hon', 'Fate Dice', 'Random hieu ung 1 skill bat ky', 'Random any skill effect', 'utility', 'rare', 'custom_effect', '{}', 5, 8, false),
  ('SKL_035', 'Khu Debuff', 'Cleanse Debuff', 'Xoa 1 debuff cu the', 'Remove a chosen debuff', 'defense', 'rare', 'custom_effect', '{}', 5, 6, false),
  ('SKL_036', 'Co Dinh Quan', 'Anchor', 'Khoa di chuyen 1 quan 3-4 luot', 'Anchor a piece', 'defense', 'common', 'anchor_piece', '{"duration":4}', 2, 5, false),
  ('SKL_037', 'Giai Phong', 'Unanchor', 'Giai co dinh 1 quan', 'Release anchored piece', 'utility', 'common', 'custom_effect', '{}', 3, 3, false),
  ('SKL_038', 'Cuong Che Di Chuyen', 'Force Move', 'Bat di chuyen quan bi co dinh', 'Force move anchored piece', 'utility', 'rare', 'custom_effect', '{}', 3, 6, false),
  ('SKL_039', 'An Than', 'Stealth Field', 'An 5 quan dich 5 luot', 'Hide 5 enemy pieces for 5 turns', 'special', 'legendary', 'hide_pieces', '{"count":5,"duration":5}', 5, 10, false),
  ('SKL_040', 'Tang Cuong', 'Extend Buff', 'Tang them 1 luot cho cac buff dang co', 'Extend current buffs by 1 turn', 'utility', 'common', 'custom_effect', '{}', 2, 5, false),
  ('SKL_041', 'Thoi Khong', 'Time Swap', 'Dao thu tu luot (50/50)', 'Swap turn order', 'special', 'rare', 'custom_effect', '{}', 1, 7, false),
  ('SKL_042', 'Nguyen Quyet', 'Erase Skill', 'Xoa vinh vien 1 skill trong deck dich', 'Delete one enemy deck skill', 'utility', 'rare', 'custom_effect', '{}', 3, 5, false),
  ('SKL_043', 'Luu Chuyen', 'Swap Pieces', 'Doi vi tri 1 quan ta va 1 quan dich', 'Swap one own piece with enemy', 'utility', 'rare', 'custom_effect', '{}', 3, 4, false),
  ('SKL_044', 'Phan Nguyen', 'Reflect', 'Dat bay 5 luot, phan skill dich', 'Set up reflect for 5 turns', 'defense', 'rare', 'reflect_attack', '{}', 5, 6, false),
  ('SKL_045', 'Khai Nguyen', 'Recast', 'Tai su dung 1 skill da dung', 'Reuse a previously used skill', 'utility', 'legendary', 'custom_effect', '{}', 5, 10, false),
  ('SKL_046', 'Nguyen Cau', 'Reset Zone', 'Reset 4x4, xoa quan va hieu ung', 'Reset 4x4 area', 'attack', 'legendary', 'bomb_area', '{"radius":2}', 5, 14, false),
  ('SKL_047', 'Hop Nhat', 'Twin Cast', 'Luot sau dung 2 skill', 'Use 2 skills next turn', 'utility', 'common', 'custom_effect', '{}', 5, 7, false),
  ('SKL_048', 'Nguyen Diem', 'Force Cell', 'Bat dich chon o dat quan ke', 'Force enemy choose next cell', 'utility', 'rare', 'custom_effect', '{}', 5, 9, false),
  ('SKL_049', 'Luong Nguyen', 'Chaos Chain', '50/50 hieu ung co loi/ha i tat ca quan', 'Apply random good/bad effects to all pieces', 'special', 'legendary', 'custom_effect', '{}', 1, 15, false),
  ('SKL_050', 'Nguyen Hoa', 'Convert', 'Bien 1 quan dich thanh quan ta', 'Convert enemy piece', 'attack', 'rare', 'custom_effect', '{}', 3, 10, false),
  ('SKL_051', 'Khi Nguyen', 'Luck Boost', 'Tang ty le skill may man', 'Increase luck-based odds', 'utility', 'rare', 'custom_effect', '{}', 3, 4, false),
  ('SKL_052', 'Nguyen Phong', 'Gust Split', 'Day 2 quan dich tach chuoi', 'Push 2 enemy pieces to break chain', 'attack', 'common', 'custom_effect', '{}', 4, 5, false),
  ('SKL_053', 'Nguyen Sat', 'Attack Buff', 'Buff tan cong +50% hieu ung', 'Buff next attack skill', 'utility', 'common', 'custom_effect', '{}', 3, 4, false),
  ('SKL_054', 'Nguyen Dong', 'Chaos Jump', 'Toan ban co nhay loạn', 'All pieces jump randomly', 'special', 'legendary', 'custom_effect', '{}', 1, 13, false),
  ('SKL_055', 'Phong An', 'Seal Buff', 'Cam buff tren 1 quan 3 luot', 'Prevent buffs on a piece', 'defense', 'rare', 'custom_effect', '{}', 3, 7, false),
  ('SKL_056', 'Khu Buff I', 'Purge Buffs', 'Xoa tat ca buff dang ton tai', 'Remove all active buffs', 'utility', 'common', 'custom_effect', '{}', 3, 4, false),
  ('SKL_057', 'Khu Buff II', 'Block Future Buffs', 'Chan buff se dung trong 3 luot', 'Block upcoming buffs 3 turns', 'utility', 'common', 'custom_effect', '{}', 3, 3, false),
  ('SKL_058', 'Khu Buff III', 'Remove Specific Buff', 'Xoa 1 buff chi dinh', 'Remove a chosen buff', 'utility', 'rare', 'custom_effect', '{}', 5, 2, false),
  ('SKL_059', 'Bay Thien Than', 'Angel Trap', 'Chon 3 o, phan skill len chinh no', 'Trap reflects skill on 3 cells', 'defense', 'common', 'custom_effect', '{}', 5, 6, false),
  ('SKL_060', 'Hon Lien', 'Phantom Piece', 'Tao quan gia ton tai 5 luot', 'Create clone piece for 5 turns', 'special', 'common', 'clone_piece', '{"duration":5}', 5, 3, false);

-- Update current season pool to include all active skills
UPDATE public.seasons
SET skill_pool = (SELECT jsonb_agg(id) FROM public.skills WHERE is_active = true)
WHERE is_active = true;
