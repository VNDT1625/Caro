-- Migration: Update skill combo rules for 15-card deck and new rarity limits
-- Date: 2025-12-08

-- Adjust max skill count constraint (was 20)
ALTER TABLE public.user_skill_combos
  DROP CONSTRAINT IF EXISTS user_skill_combos_skill_count,
  ADD CONSTRAINT user_skill_combos_skill_count CHECK (jsonb_array_length(skill_ids) <= 15);

-- Update validation logic: exactly 15 skills, >=10 common, <=5 rare, <=3 legendary (ultra)
CREATE OR REPLACE FUNCTION validate_skill_combo()
RETURNS TRIGGER AS $$
DECLARE
  skill_count integer;
  common_count integer;
  rare_count integer;
  legendary_count integer;
  errors jsonb := '[]'::jsonb;
BEGIN
  skill_count := jsonb_array_length(NEW.skill_ids);

  IF skill_count != 15 THEN
    errors := errors || jsonb_build_array('Combo phai co dung 15 skill');
  END IF;

  SELECT COUNT(*) INTO common_count
  FROM public.skills s
  WHERE s.id::text IN (SELECT jsonb_array_elements_text(NEW.skill_ids))
    AND s.rarity = 'common';

  SELECT COUNT(*) INTO rare_count
  FROM public.skills s
  WHERE s.id::text IN (SELECT jsonb_array_elements_text(NEW.skill_ids))
    AND s.rarity = 'rare';

  SELECT COUNT(*) INTO legendary_count
  FROM public.skills s
  WHERE s.id::text IN (SELECT jsonb_array_elements_text(NEW.skill_ids))
    AND s.rarity = 'legendary';

  IF common_count < 10 THEN
    errors := errors || jsonb_build_array('Can toi thieu 10 skill thuong');
  END IF;

  IF rare_count > 5 THEN
    errors := errors || jsonb_build_array('Toi da 5 skill hiem');
  END IF;

  IF legendary_count > 3 THEN
    errors := errors || jsonb_build_array('Toi da 3 skill cuc hiem');
  END IF;

  NEW.is_valid := (jsonb_array_length(errors) = 0);
  NEW.validation_errors := CASE WHEN jsonb_array_length(errors) > 0 THEN errors ELSE NULL END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.user_skill_combos IS 'User skill combo presets - 15 skills selected from season pool';
