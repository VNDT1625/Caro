-- 1. Kiểm tra xem có username "KhangHi" không (case-insensitive)
SELECT user_id, username, display_name, current_rank 
FROM profiles 
WHERE username ILIKE '%khanghi%' OR display_name ILIKE '%khanghi%';

-- 2. Xem tất cả username hiện có
SELECT user_id, username, display_name 
FROM profiles 
WHERE username IS NOT NULL 
ORDER BY username;

-- 3. Kiểm tra RLS policies trên profiles
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles';

-- 4. Tạm thời disable RLS để test (CHỈ dùng để debug, sau đó enable lại)
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 5. Sau khi test xong, enable lại RLS
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
