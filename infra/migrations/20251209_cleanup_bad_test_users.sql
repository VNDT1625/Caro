-- ============================================================
-- CLEANUP: Xóa test users đã tạo sai trong auth.users
-- Chạy file này để fix lỗi "Database error querying schema"
-- ============================================================

-- Xóa identities trước (có foreign key)
DELETE FROM auth.identities WHERE user_id IN (
  'aaaaaaaa-1111-1111-1111-111111111111',
  'aaaaaaaa-2222-2222-2222-222222222222'
);

-- Xóa users
DELETE FROM auth.users WHERE id IN (
  'aaaaaaaa-1111-1111-1111-111111111111',
  'aaaaaaaa-2222-2222-2222-222222222222'
);

-- Verify
SELECT 'Cleanup done. Users remaining:' as status;
SELECT id, email FROM auth.users WHERE id IN (
  'aaaaaaaa-1111-1111-1111-111111111111',
  'aaaaaaaa-2222-2222-2222-222222222222'
);
