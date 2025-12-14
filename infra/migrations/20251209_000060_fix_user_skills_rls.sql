-- Migration: Fix user_skills RLS policies for package purchases
-- Date: 2025-12-09
-- Description: Ensure users can insert/update their own skills via frontend

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "user_skills_select_own" ON public.user_skills;
DROP POLICY IF EXISTS "user_skills_insert_own" ON public.user_skills;
DROP POLICY IF EXISTS "user_skills_update_own" ON public.user_skills;

-- Recreate policies with correct auth.uid() check
-- Users can read their own skills
CREATE POLICY "user_skills_select_own" ON public.user_skills
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own skills
CREATE POLICY "user_skills_insert_own" ON public.user_skills
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own skills
CREATE POLICY "user_skills_update_own" ON public.user_skills
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Also allow upsert (which needs both insert and update)
-- The above policies should cover upsert, but let's add explicit handling

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.user_skills TO authenticated;

-- Verify starter skills trigger exists and works
-- This ensures new users get starter skills automatically
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger if not exists
DROP TRIGGER IF EXISTS profiles_auto_unlock_skills ON public.profiles;
CREATE TRIGGER profiles_auto_unlock_skills
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_unlock_starter_skills();

-- For existing users without starter skills, run this once:
INSERT INTO public.user_skills (user_id, skill_id, is_unlocked, unlocked_at, unlock_method)
SELECT p.user_id, s.id, true, now(), 'free'
FROM public.profiles p
CROSS JOIN public.skills s
WHERE s.is_starter = true AND s.is_active = true
ON CONFLICT (user_id, skill_id) DO NOTHING;
