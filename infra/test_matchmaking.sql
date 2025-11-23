-- Test Script: Insert fake opponent into matchmaking queue for testing
-- Run this in Supabase SQL Editor to simulate a second player

-- First, get a test user ID (replace with actual user_id from profiles table)
-- You can find user_id by running: SELECT user_id, email FROM profiles LIMIT 5;

-- Insert a fake queue entry to test matching
-- REPLACE 'YOUR_TEST_USER_ID_HERE' with actual UUID from profiles table
INSERT INTO matchmaking_queue (
    user_id,
    mode,
    elo_rating,
    preferred_settings,
    status,
    joined_at
)
VALUES (
    'YOUR_TEST_USER_ID_HERE'::uuid,  -- REPLACE THIS
    'rank',  -- or 'casual'
    1000,
    '{"mode":"rank","gameType":"standard","boardSize":"15x15","winCondition":5,"turnTime":30,"totalTime":600}'::jsonb,
    'waiting',
    NOW()
)
RETURNING *;

-- To clean up after testing:
-- DELETE FROM matchmaking_queue WHERE user_id = 'YOUR_TEST_USER_ID_HERE'::uuid;

-- To see all waiting entries:
-- SELECT id, user_id, mode, elo_rating, status, joined_at FROM matchmaking_queue WHERE status = 'waiting';
