-- TEMPORARY: Disable RLS for testing
-- Chạy SQL này để test, sau đó sẽ bật lại

ALTER TABLE matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE moves DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('matches', 'moves');
