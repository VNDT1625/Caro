-- Map basic effect_type/effect_params for skills that can use existing engine handlers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'skills') THEN
    -- Core attack/utility already supported
    UPDATE public.skills SET effect_type = 'remove_enemy', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_006';
    UPDATE public.skills SET effect_type = 'block_cell', effect_params = '{"duration":0}'::jsonb WHERE skill_code = 'SKL_008';
    UPDATE public.skills SET effect_type = 'push_enemy', effect_params = '{"distance":1}'::jsonb WHERE skill_code = 'SKL_011';
    UPDATE public.skills SET effect_type = 'teleport_piece', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_012';
    UPDATE public.skills SET effect_type = 'bomb_area', effect_params = '{"radius":2}'::jsonb WHERE skill_code = 'SKL_015';
    UPDATE public.skills SET effect_type = 'line_destroy', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_007';
    UPDATE public.skills SET effect_type = 'shuffle_area', effect_params = '{"radius":1}'::jsonb WHERE skill_code = 'SKL_009';
    UPDATE public.skills SET effect_type = 'zone_block', effect_params = '{"radius":1,"duration":3}'::jsonb WHERE skill_code = 'SKL_010';
    UPDATE public.skills SET effect_type = 'banish_piece', effect_params = '{"duration":3}'::jsonb WHERE skill_code = 'SKL_013';
    UPDATE public.skills SET effect_type = 'reveal_area', effect_params = '{"radius":1}'::jsonb WHERE skill_code = 'SKL_014';

    -- Lan to/cleanse
    UPDATE public.skills SET effect_type = 'spread_status', effect_params = '{"status":"burn","max_targets":5,"duration":5}'::jsonb WHERE skill_code = 'SKL_001';
    UPDATE public.skills SET effect_type = 'spread_status', effect_params = '{"status":"freeze","max_targets":5,"duration":5}'::jsonb WHERE skill_code = 'SKL_002';
    UPDATE public.skills SET effect_type = 'spread_status', effect_params = '{"status":"root","max_targets":5,"duration":5}'::jsonb WHERE skill_code = 'SKL_003';
    UPDATE public.skills SET effect_type = 'spread_status', effect_params = '{"status":"petrify","max_targets":5,"duration":0}'::jsonb WHERE skill_code = 'SKL_004';
    UPDATE public.skills SET effect_type = 'spread_status', effect_params = '{"status":"rust","max_targets":5,"duration":5}'::jsonb WHERE skill_code = 'SKL_005';
    UPDATE public.skills SET effect_type = 'cleanse_element', effect_params = '{"element":"kim"}'::jsonb WHERE skill_code = 'SKL_016';
    UPDATE public.skills SET effect_type = 'cleanse_element', effect_params = '{"element":"hoa"}'::jsonb WHERE skill_code = 'SKL_017';
    UPDATE public.skills SET effect_type = 'cleanse_element', effect_params = '{"element":"tho"}'::jsonb WHERE skill_code = 'SKL_018';
    UPDATE public.skills SET effect_type = 'cleanse_element', effect_params = '{"element":"thuy"}'::jsonb WHERE skill_code = 'SKL_019';
    UPDATE public.skills SET effect_type = 'cleanse_element', effect_params = '{"element":"moc"}'::jsonb WHERE skill_code = 'SKL_020';

    -- Defense/utility
    UPDATE public.skills SET effect_type = 'shield_area', effect_params = '{"size":1,"duration":3}'::jsonb WHERE skill_code = 'SKL_021';
    UPDATE public.skills SET effect_type = 'dodge_next', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_022';
    UPDATE public.skills SET effect_type = 'protect_piece', effect_params = '{"duration":99}'::jsonb WHERE skill_code = 'SKL_023';
    UPDATE public.skills SET effect_type = 'restore_piece', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_024';
    UPDATE public.skills SET effect_type = 'freeze_skills', effect_params = '{"duration":3}'::jsonb WHERE skill_code = 'SKL_025';
    UPDATE public.skills SET effect_type = 'dual_protect', effect_params = '{"duration":5}'::jsonb WHERE skill_code = 'SKL_026';
    UPDATE public.skills SET effect_type = 'wall_line', effect_params = '{"length":3,"duration":3}'::jsonb WHERE skill_code = 'SKL_027';
    UPDATE public.skills SET effect_type = 'protect_piece', effect_params = '{"duration":99}'::jsonb WHERE skill_code = 'SKL_028';
    UPDATE public.skills SET effect_type = 'buff_next_multiplier', effect_params = '{"multiplier":2}'::jsonb WHERE skill_code = 'SKL_029';
    UPDATE public.skills SET effect_type = 'redirect_damage', effect_params = '{"duration":3}'::jsonb WHERE skill_code = 'SKL_030';
    UPDATE public.skills SET effect_type = 'deck_lock', effect_params = '{"count":10,"duration":5}'::jsonb WHERE skill_code = 'SKL_031';

    -- Specials supported
    UPDATE public.skills SET effect_type = 'extend_turn', effect_params = '{"seconds":0}'::jsonb WHERE skill_code = 'SKL_032';
    UPDATE public.skills SET effect_type = 'protect_all', effect_params = '{"duration":5}'::jsonb WHERE skill_code = 'SKL_033';
    UPDATE public.skills SET effect_type = 'random_effect', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_034';
    UPDATE public.skills SET effect_type = 'remove_debuff', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_035';
    UPDATE public.skills SET effect_type = 'anchor_piece', effect_params = '{"duration":4}'::jsonb WHERE skill_code = 'SKL_036';
    UPDATE public.skills SET effect_type = 'remove_anchor', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_037';
    UPDATE public.skills SET effect_type = 'force_move_anchor', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_038';
    UPDATE public.skills SET effect_type = 'hide_pieces', effect_params = '{"count":5,"duration":5}'::jsonb WHERE skill_code = 'SKL_039';
    UPDATE public.skills SET effect_type = 'extend_buffs', effect_params = '{"extra_duration":1}'::jsonb WHERE skill_code = 'SKL_040';
    UPDATE public.skills SET effect_type = 'swap_turn_order', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_041';
    UPDATE public.skills SET effect_type = 'erase_enemy_skill', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_042';
    UPDATE public.skills SET effect_type = 'swap_pieces', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_043';
    UPDATE public.skills SET effect_type = 'reflect_attack', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_044';
    UPDATE public.skills SET effect_type = 'reuse_skill', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_045';
    UPDATE public.skills SET effect_type = 'bomb_area', effect_params = '{"radius":2}'::jsonb WHERE skill_code = 'SKL_046';
    UPDATE public.skills SET effect_type = 'two_skills_next_turn', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_047';
    UPDATE public.skills SET effect_type = 'force_next_cell', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_048';
    UPDATE public.skills SET effect_type = 'chaos_board', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_049';
    UPDATE public.skills SET effect_type = 'convert_piece', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_050';
    UPDATE public.skills SET effect_type = 'luck_buff', effect_params = '{"max_stack":3}'::jsonb WHERE skill_code = 'SKL_051';
    UPDATE public.skills SET effect_type = 'push_split_chain', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_052';
    UPDATE public.skills SET effect_type = 'attack_buff', effect_params = '{"multiplier":1.5}'::jsonb WHERE skill_code = 'SKL_053';
    UPDATE public.skills SET effect_type = 'chaos_jump', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_054';
    UPDATE public.skills SET effect_type = 'seal_buff', effect_params = '{"duration":3}'::jsonb WHERE skill_code = 'SKL_055';
    UPDATE public.skills SET effect_type = 'purge_buffs', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_056';
    UPDATE public.skills SET effect_type = 'block_future_buffs', effect_params = '{"duration":3}'::jsonb WHERE skill_code = 'SKL_057';
    UPDATE public.skills SET effect_type = 'remove_specific_buff', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_058';
    UPDATE public.skills SET effect_type = 'trap_reflect', effect_params = '{}'::jsonb WHERE skill_code = 'SKL_059';
    UPDATE public.skills SET effect_type = 'clone_piece', effect_params = '{"duration":5}'::jsonb WHERE skill_code = 'SKL_060';
  END IF;
END$$;
