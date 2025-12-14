# Script để fix shop-assets bucket
# Chạy migration trong Supabase SQL Editor

Write-Host "=== FIX SHOP-ASSETS BUCKET ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Lỗi 400 Bad Request khi upload MP3 thường do MIME type không được phép." -ForegroundColor Yellow
Write-Host ""
Write-Host "CÁCH 1: Chạy SQL trong Supabase Dashboard" -ForegroundColor Green
Write-Host "1. Mở Supabase Dashboard -> SQL Editor"
Write-Host "2. Copy nội dung file: infra/migrations/20251209_000031_fix_shop_assets_mime_types.sql"
Write-Host "3. Chạy SQL"
Write-Host ""
Write-Host "CÁCH 2: Kiểm tra bucket trong Storage" -ForegroundColor Green
Write-Host "1. Mở Supabase Dashboard -> Storage"
Write-Host "2. Kiểm tra bucket 'shop-assets' đã tồn tại chưa"
Write-Host "3. Nếu chưa có, tạo bucket mới với tên 'shop-assets', public = true"
Write-Host "4. Vào Configuration -> MIME types, thêm: audio/mpeg, audio/mp3, application/octet-stream"
Write-Host ""
Write-Host "CÁCH 3: Quick SQL (copy paste vào SQL Editor)" -ForegroundColor Green
Write-Host @"

-- Quick fix: Cập nhật MIME types cho bucket shop-assets
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'video/mp4', 'application/octet-stream'
]
WHERE id = 'shop-assets';

-- Nếu bucket chưa có, tạo mới
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-assets', 'shop-assets', true, 52428800,
  ARRAY['audio/mpeg','audio/mp3','audio/wav','audio/ogg','image/png','image/jpeg','image/gif','image/webp','video/mp4','application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Policy cho authenticated users upload
DROP POLICY IF EXISTS "Authenticated upload shop assets" ON storage.objects;
CREATE POLICY "Authenticated upload shop assets" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'shop-assets' AND auth.role() = 'authenticated');

"@

Write-Host ""
Write-Host "Sau khi chạy SQL, thử upload lại file MP3 trong Admin -> Shop" -ForegroundColor Cyan
