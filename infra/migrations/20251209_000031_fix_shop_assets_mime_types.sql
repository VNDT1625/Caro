-- Migration: Fix shop-assets bucket MIME types
-- Date: 2024-12-09
-- Issue: Upload MP3 fails with 400 Bad Request

-- OPTION 1: Xóa bucket cũ và tạo lại KHÔNG có MIME restriction
DELETE FROM storage.buckets WHERE id = 'shop-assets';

-- Tạo bucket MỚI với allowed_mime_types = NULL (cho phép tất cả)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-assets', 
  'shop-assets', 
  true,
  52428800,  -- 50MB limit
  NULL       -- NULL = cho phép TẤT CẢ mime types
);

-- OPTION 2: Nếu không muốn xóa, chỉ update
-- UPDATE storage.buckets 
-- SET allowed_mime_types = NULL
-- WHERE id = 'shop-assets';

-- Drop all existing policies first
DROP POLICY IF EXISTS "Admin upload shop assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read shop assets" ON storage.objects;
DROP POLICY IF EXISTS "Admin update shop assets" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete shop assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload shop assets" ON storage.objects;
DROP POLICY IF EXISTS "shop-assets public read" ON storage.objects;
DROP POLICY IF EXISTS "shop-assets authenticated upload" ON storage.objects;

-- Policy cho phép PUBLIC READ
CREATE POLICY "shop-assets public read" ON storage.objects
FOR SELECT USING (bucket_id = 'shop-assets');

-- Policy cho phép AUTHENTICATED USERS upload (bao gồm admin)
CREATE POLICY "shop-assets authenticated upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'shop-assets' 
  AND auth.role() = 'authenticated'
);

-- Policy cho phép authenticated users update own files
CREATE POLICY "shop-assets authenticated update" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'shop-assets'
  AND auth.role() = 'authenticated'
);

-- Policy cho phép authenticated users delete
CREATE POLICY "shop-assets authenticated delete" ON storage.objects
FOR DELETE USING (
  bucket_id = 'shop-assets'
  AND auth.role() = 'authenticated'
);
