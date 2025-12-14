-- Migration: Check and report items with invalid preview_url
-- Date: 2024-12-11
-- Purpose: Identify music items that may have broken URLs

-- Query để tìm các music items có preview_url
-- Admin cần chạy query này và kiểm tra từng URL
SELECT 
  i.id,
  i.item_code,
  i.name,
  i.category,
  i.preview_url,
  CASE 
    WHEN i.preview_url IS NULL THEN 'NULL'
    WHEN i.preview_url = '' THEN 'EMPTY'
    WHEN i.preview_url NOT LIKE 'http%' THEN 'INVALID_FORMAT'
    ELSE 'CHECK_MANUALLY'
  END as url_status
FROM public.items i
WHERE i.category = 'âm nhạc'
   OR LOWER(i.category) IN ('music', 'am nhac', 'nhạc', 'nhac')
ORDER BY i.created_at DESC;

-- Nếu cần xóa items có URL không hợp lệ (CẢNH BÁO: Chỉ chạy sau khi đã backup)
-- DELETE FROM public.user_items WHERE item_id IN (
--   SELECT id FROM public.items 
--   WHERE (category = 'âm nhạc' OR LOWER(category) IN ('music', 'am nhac'))
--   AND (preview_url IS NULL OR preview_url = '')
-- );
-- DELETE FROM public.items 
-- WHERE (category = 'âm nhạc' OR LOWER(category) IN ('music', 'am nhac'))
-- AND (preview_url IS NULL OR preview_url = '');
