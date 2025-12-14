-- Migration: Create seasons table for skill system
-- Date: 2025-12-06

CREATE TABLE IF NOT EXISTS public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_number integer NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  name_en varchar(100),
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  is_active boolean DEFAULT false,
  skill_pool jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of skill_ids
  theme_color varchar(20) DEFAULT '#22D3EE',
  banner_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT seasons_dates_check CHECK (end_date > start_date),
  CONSTRAINT seasons_duration_check CHECK (end_date - start_date <= interval '5 months')
);

-- Index for active season lookup
CREATE INDEX IF NOT EXISTS idx_seasons_active ON public.seasons(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_seasons_dates ON public.seasons(start_date, end_date);

-- RLS Policies
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

-- Everyone can read seasons
CREATE POLICY "seasons_select_all" ON public.seasons
  FOR SELECT USING (true);

-- Only admins can modify
CREATE POLICY "seasons_admin_all" ON public.seasons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin WHERE user_id = auth.uid() AND is_active = true)
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_seasons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER seasons_updated_at
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION update_seasons_updated_at();

COMMENT ON TABLE public.seasons IS 'Skill seasons - each season lasts 4 months with 40 skills';
