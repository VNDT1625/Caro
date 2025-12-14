-- Migration: Create skills table for skill system
-- Date: 2025-12-06

-- Enum for skill categories
DO $$ BEGIN
  CREATE TYPE skill_category AS ENUM ('attack', 'defense', 'utility', 'special');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum for skill rarity
DO $$ BEGIN
  CREATE TYPE skill_rarity AS ENUM ('common', 'rare', 'epic', 'legendary');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_code varchar(50) NOT NULL UNIQUE,
  name_vi varchar(100) NOT NULL,
  name_en varchar(100),
  description_vi text NOT NULL,
  description_en text,
  
  -- Classification
  category skill_category NOT NULL,
  rarity skill_rarity NOT NULL DEFAULT 'common',
  
  -- Effect configuration
  effect_type varchar(50) NOT NULL, -- 'place_double', 'remove_enemy', 'block_cell', etc.
  effect_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Example effect_params:
  -- { "count": 2 } for double place
  -- { "radius": 1 } for bomb (3x3)
  -- { "duration": 2 } for shield
  
  -- Gameplay
  cooldown integer DEFAULT 3 CHECK (cooldown >= 0 AND cooldown <= 10),
  mana_cost integer DEFAULT 0, -- future use
  
  -- Visuals
  icon_url text,
  preview_animation varchar(50), -- animation key
  effect_color varchar(20) DEFAULT '#ffffff',
  
  -- Unlock requirements
  unlock_requirement jsonb, -- null = free
  -- Examples:
  -- { "type": "level", "value": 10 }
  -- { "type": "achievement", "achievement_code": "win_100" }
  -- { "type": "purchase", "coins": 1000 }
  
  -- Upgrade system
  upgrade_costs jsonb DEFAULT '[{"level": 2, "coins": 500}, {"level": 3, "coins": 1500}]'::jsonb,
  level_scaling jsonb DEFAULT '{"2": 1.2, "3": 1.5}'::jsonb, -- effect multiplier per level
  
  -- Status
  is_active boolean DEFAULT true,
  is_starter boolean DEFAULT false, -- included in beginner set
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_skills_category ON public.skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_rarity ON public.skills(rarity);
CREATE INDEX IF NOT EXISTS idx_skills_active ON public.skills(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_skills_starter ON public.skills(is_starter) WHERE is_starter = true;

-- RLS Policies
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

-- Everyone can read active skills
CREATE POLICY "skills_select_active" ON public.skills
  FOR SELECT USING (is_active = true);

-- Admins can do everything
CREATE POLICY "skills_admin_all" ON public.skills
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin WHERE user_id = auth.uid() AND is_active = true)
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER skills_updated_at
  BEFORE UPDATE ON public.skills
  FOR EACH ROW
  EXECUTE FUNCTION update_skills_updated_at();

COMMENT ON TABLE public.skills IS 'All available skills in the game';
COMMENT ON COLUMN public.skills.effect_type IS 'Type of effect: place_double, remove_enemy, block_cell, shield, copy_move, etc.';
COMMENT ON COLUMN public.skills.effect_params IS 'JSON parameters for the effect (count, radius, duration, etc.)';
