-- Migration: Create user_skills table for skill unlock/upgrade tracking
-- Date: 2025-12-06

CREATE TABLE IF NOT EXISTS public.user_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  
  -- Unlock status
  is_unlocked boolean DEFAULT false,
  unlocked_at timestamp with time zone,
  unlock_method varchar(50), -- 'free', 'level', 'achievement', 'purchase'
  
  -- Upgrade level
  current_level integer DEFAULT 1 CHECK (current_level >= 1 AND current_level <= 3),
  
  -- Usage stats
  times_used integer DEFAULT 0,
  times_successful integer DEFAULT 0, -- skill led to win within 5 moves
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT user_skills_unique UNIQUE(user_id, skill_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_skills_user ON public.user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_unlocked ON public.user_skills(user_id, is_unlocked) WHERE is_unlocked = true;

-- RLS Policies
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;

-- Users can read their own skills
CREATE POLICY "user_skills_select_own" ON public.user_skills
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own skills
CREATE POLICY "user_skills_insert_own" ON public.user_skills
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own skills
CREATE POLICY "user_skills_update_own" ON public.user_skills
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can do everything
CREATE POLICY "user_skills_admin_all" ON public.user_skills
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin WHERE user_id = auth.uid() AND is_active = true)
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_skills_updated_at
  BEFORE UPDATE ON public.user_skills
  FOR EACH ROW
  EXECUTE FUNCTION update_user_skills_updated_at();

-- Function to auto-unlock free skills for new users
CREATE OR REPLACE FUNCTION auto_unlock_starter_skills()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_skills (user_id, skill_id, is_unlocked, unlocked_at, unlock_method)
  SELECT NEW.user_id, s.id, true, now(), 'free'
  FROM public.skills s
  WHERE s.is_starter = true AND s.is_active = true
  ON CONFLICT (user_id, skill_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on profiles to auto-unlock starter skills
CREATE TRIGGER profiles_auto_unlock_skills
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_unlock_starter_skills();

COMMENT ON TABLE public.user_skills IS 'Tracks which skills each user has unlocked and their upgrade levels';
