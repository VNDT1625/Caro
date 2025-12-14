-- Add metadata column to profiles table for storing event progress, etc.
-- Run this migration in Supabase SQL Editor

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.metadata IS 'Stores additional user data like event progress, settings, etc.';

-- Example metadata structure:
-- {
--   "events": {
--     "lastLoginDate": "2025-12-03",
--     "consecutiveLogins": 3,
--     "login": { "1": true, "2": true },
--     "matches": { "1": true },
--     "seasonQuest": {},
--     "battlePass": {}
--   }
-- }
