# Fix Avatar Upload Issue

## Vấn đề
Avatar upload thành công nhưng không hiển thị được (hiện gradient thay vì ảnh).

## Nguyên nhân
1. Bucket `avatars` chưa được tạo trong Supabase Storage
2. Hoặc bucket không được set public
3. Hoặc RLS policies chưa được cấu hình

## Cách fix

### Bước 1: Tạo bucket trong Supabase Dashboard

1. Vào Supabase Dashboard → Storage
2. Click "New bucket"
3. Đặt tên: `avatars`
4. Check ✅ "Public bucket"
5. Click "Create bucket"

### Bước 2: Cấu hình RLS Policies

Vào SQL Editor và chạy:

```sql
-- Policy: Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to update their own avatars
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to delete their own avatars
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Anyone can view avatars (public bucket)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

### Bước 3: Test lại

1. Vào Profile → Upload avatar mới
2. Avatar sẽ hiển thị đúng

## Code changes đã thực hiện

1. `Profile.tsx`: Thêm onError handler cho img tag - fallback về 👤 khi ảnh không load được
2. `Home.tsx`: Tương tự cho friend avatar
3. Tạo migration file: `infra/migrations/20251206_000020_create_avatars_bucket.sql`
