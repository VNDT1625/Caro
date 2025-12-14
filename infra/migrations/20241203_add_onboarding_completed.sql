-- Add onboarding_completed column to profiles table
-- This tracks whether a user has completed the onboarding tour

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Update existing users who have username set to mark onboarding as completed
UPDATE profiles 
SET onboarding_completed = true 
WHERE username IS NOT NULL 
  AND username != '' 
  AND LENGTH(username) >= 3 
  AND username NOT LIKE '%@%';

COMMENT ON COLUMN profiles.onboarding_completed IS 'Whether the user has completed the onboarding tour';
