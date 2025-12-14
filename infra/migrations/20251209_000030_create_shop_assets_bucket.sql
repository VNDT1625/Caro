-- Migration: Create shop-assets bucket for all shop items (music, skins, boards, emotes, etc.)
-- Date: 2024-12-09

-- Bucket chung cho tất cả shop assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-assets', 
  'shop-assets', 
  true,
  52428800,  -- 50MB limit
  ARRAY[
    'audio/mpeg', 
    'audio/wav', 
    'audio/ogg',
    'audio/mp3',
    'image/png', 
    'image/jpeg', 
    'image/gif', 
    'image/webp', 
    'video/mp4'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy cho phép public read (ai cũng đọc được)
DROP POLICY IF EXISTS "Public read shop assets" ON storage.objects;
CREATE POLICY "Public read shop assets" ON storage.objects
FOR SELECT USING (bucket_id = 'shop-assets');

-- Policy cho phép admin upload (dùng bảng admin)
DROP POLICY IF EXISTS "Admin upload shop assets" ON storage.objects;
CREATE POLICY "Admin upload shop assets" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'shop-assets' 
  AND (
    -- Service role bypass
    auth.role() = 'service_role'
    OR
    -- Admin users (check admin table)
    EXISTS (
      SELECT 1 FROM admin 
      WHERE admin.user_id = auth.uid() 
      AND admin.is_active = true
    )
  )
);

-- Policy cho phép admin update
DROP POLICY IF EXISTS "Admin update shop assets" ON storage.objects;
CREATE POLICY "Admin update shop assets" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'shop-assets'
  AND (
    auth.role() = 'service_role'
    OR
    EXISTS (
      SELECT 1 FROM admin 
      WHERE admin.user_id = auth.uid() 
      AND admin.is_active = true
    )
  )
);

-- Policy cho phép admin delete
DROP POLICY IF EXISTS "Admin delete shop assets" ON storage.objects;
CREATE POLICY "Admin delete shop assets" ON storage.objects
FOR DELETE USING (
  bucket_id = 'shop-assets'
  AND (
    auth.role() = 'service_role'
    OR
    EXISTS (
      SELECT 1 FROM admin 
      WHERE admin.user_id = auth.uid() 
      AND admin.is_active = true
    )
  )
);

-- Xóa bucket music cũ nếu có (optional - comment out nếu muốn giữ)
-- DELETE FROM storage.buckets WHERE id = 'music';
