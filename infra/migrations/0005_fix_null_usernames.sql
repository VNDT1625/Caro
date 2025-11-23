-- Fix NULL username in profiles
UPDATE profiles 
SET username = 'Player_' || substring(user_id::text, 1, 8)
WHERE username IS NULL;

-- Fix NULL display_name
UPDATE profiles
SET display_name = COALESCE(username, 'Người chơi')
WHERE display_name IS NULL;

-- Verify
SELECT user_id, username, display_name, current_rank FROM profiles;
