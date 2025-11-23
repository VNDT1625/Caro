-- Enable Realtime for rooms table
-- Run this in Supabase SQL Editor

-- Enable realtime for rooms table
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- Verify
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
