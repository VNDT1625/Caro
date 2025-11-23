-- Add matched_with column to matchmaking_queue
ALTER TABLE matchmaking_queue 
ADD COLUMN IF NOT EXISTS matched_with UUID REFERENCES profiles(user_id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_matched_with 
ON matchmaking_queue(matched_with);
