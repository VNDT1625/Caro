-- Migration: Add level and exp columns to profiles table
-- Description: Adds experience system for player progression
-- Date: 2025-11-24

-- Add level column (default level 1, range 1-100)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS level integer DEFAULT 1 CHECK (level >= 1 AND level <= 100);

-- Add exp column (default 0 exp)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS exp integer DEFAULT 0 CHECK (exp >= 0);

-- Update existing users to have level 1 and 0 exp
UPDATE public.profiles 
SET level = 1, exp = 0 
WHERE level IS NULL OR exp IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.level IS 'Player level (1-100), increases when gaining enough EXP';
COMMENT ON COLUMN public.profiles.exp IS 'Current experience points towards next level';

-- Optional: Create index for faster level-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_level ON public.profiles(level);

-- Grant permissions (if needed)
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
