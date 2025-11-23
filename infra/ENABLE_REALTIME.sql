-- Enable Realtime for moves table
-- Chạy SQL này trong Supabase SQL Editor

-- 1. Enable publication for moves
ALTER PUBLICATION supabase_realtime ADD TABLE moves;

-- 2. Enable publication for matches (for winner updates)
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

-- 3. Verify
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('moves', 'matches');
