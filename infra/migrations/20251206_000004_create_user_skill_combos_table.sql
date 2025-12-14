-- Migration: Create user_skill_combos table for combo presets
-- Date: 2025-12-06

CREATE TABLE IF NOT EXISTS public.user_skill_combos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  
  -- Preset info
  preset_name varchar(50) DEFAULT 'Default',
  preset_slot integer DEFAULT 1 CHECK (preset_slot >= 1 AND preset_slot <= 3),
  
  -- The combo: array of 20 skill_ids
  skill_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Validation cache
  is_valid boolean DEFAULT true,
  validation_errors jsonb, -- array of error messages if invalid
  
  -- Status
  is_active boolean DEFAULT false, -- which preset is currently selected
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT user_skill_combos_unique UNIQUE(user_id, season_id, preset_slot),
  CONSTRAINT user_skill_combos_skill_count CHECK (jsonb_array_length(skill_ids) <= 20)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_skill_combos_user ON public.user_skill_combos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skill_combos_season ON public.user_skill_combos(season_id);
CREATE INDEX IF NOT EXISTS idx_user_skill_combos_active ON public.user_skill_combos(user_id, is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE public.user_skill_combos ENABLE ROW LEVEL SECURITY;

-- Users can read their own combos
CREATE POLICY "user_skill_combos_select_own" ON public.user_skill_combos
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own combos
CREATE POLICY "user_skill_combos_insert_own" ON public.user_skill_combos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own combos
CREATE POLICY "user_skill_combos_update_own" ON public.user_skill_combos
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own combos
CREATE POLICY "user_skill_combos_delete_own" ON public.user_skill_combos
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can do everything
CREATE POLICY "user_skill_combos_admin_all" ON public.user_skill_combos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin WHERE user_id = auth.uid() AND is_active = true)
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_skill_combos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_skill_combos_updated_at
  BEFORE UPDATE ON public.user_skill_combos
  FOR EACH ROW
  EXECUTE FUNCTION update_user_skill_combos_updated_at();

-- Function to validate combo
CREATE OR REPLACE FUNCTION validate_skill_combo()
RETURNS TRIGGER AS $$
DECLARE
  skill_count integer;
  legendary_count integer;
  attack_count integer;
  defense_count integer;
  errors jsonb := '[]'::jsonb;
BEGIN
  -- Count skills
  skill_count := jsonb_array_length(NEW.skill_ids);
  
  -- Must have exactly 20 skills
  IF skill_count != 20 THEN
    errors := errors || jsonb_build_array('Combo phải có đúng 20 skill');
  END IF;
  
  -- Count legendary skills
  SELECT COUNT(*) INTO legendary_count
  FROM public.skills s
  WHERE s.id::text IN (SELECT jsonb_array_elements_text(NEW.skill_ids))
    AND s.rarity = 'legendary';
  
  IF legendary_count > 2 THEN
    errors := errors || jsonb_build_array('Tối đa 2 skill Legendary');
  END IF;
  
  -- Count by category
  SELECT COUNT(*) INTO attack_count
  FROM public.skills s
  WHERE s.id::text IN (SELECT jsonb_array_elements_text(NEW.skill_ids))
    AND s.category = 'attack';
    
  IF attack_count > 10 THEN
    errors := errors || jsonb_build_array('Tối đa 10 skill Attack');
  END IF;
  
  SELECT COUNT(*) INTO defense_count
  FROM public.skills s
  WHERE s.id::text IN (SELECT jsonb_array_elements_text(NEW.skill_ids))
    AND s.category = 'defense';
    
  IF defense_count > 10 THEN
    errors := errors || jsonb_build_array('Tối đa 10 skill Defense');
  END IF;
  
  -- Set validation result
  NEW.is_valid := (jsonb_array_length(errors) = 0);
  NEW.validation_errors := CASE WHEN jsonb_array_length(errors) > 0 THEN errors ELSE NULL END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_skill_combos_validate
  BEFORE INSERT OR UPDATE ON public.user_skill_combos
  FOR EACH ROW
  EXECUTE FUNCTION validate_skill_combo();

-- Function to ensure only one active combo per user per season
CREATE OR REPLACE FUNCTION ensure_single_active_combo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.user_skill_combos
    SET is_active = false
    WHERE user_id = NEW.user_id
      AND season_id = NEW.season_id
      AND id != NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_skill_combos_single_active
  BEFORE INSERT OR UPDATE ON public.user_skill_combos
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_active_combo();

COMMENT ON TABLE public.user_skill_combos IS 'User skill combo presets - 20 skills selected from season pool';
