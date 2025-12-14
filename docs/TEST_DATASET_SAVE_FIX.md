# Hướng Dẫn Test Fix Lỗi 401 Dataset Save

## Tóm Tắt Các Fixes Đã Thực Hiện

### 1. Frontend Improvements (caroDataset.ts)
- ✅ Thêm hàm `decodeJWT()` để decode và validate token
- ✅ Thêm hàm `validateToken()` để check token expiry
- ✅ Validate token trước khi gửi request
- ✅ Log chi tiết token info để debug

### 2. Frontend Improvements (HomeChatOverlay.tsx)
- ✅ Log toàn bộ session structure để debug
- ✅ Check token expiry và auto-refresh nếu sắp hết hạn
- ✅ Log chi tiết các bước xử lý token

### 3. Backend Improvements (index.php)
- ✅ Cải thiện logging trong `verifySupabaseToken()`
- ✅ Log chi tiết response từ Supabase
- ✅ Xử lý các error codes cụ thể (401, 403, 5xx)
- ✅ Cải thiện logging trong endpoint `/api/dataset/add`
- ✅ Log tất cả sources của Authorization header

## Cách Test

### Option 1: Test Với Browser Test Page (Khuyến Nghị)

1. **Start backend server:**
   ```bash
   cd backend
   php -S localhost:8001 -t public
   ```

2. **Start frontend dev server (nếu chưa chạy):**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Login vào app:**
   - Mở http://localhost:5173
   - Login với tài khoản của bạn

4. **Mở test page:**
   - Mở http://localhost:5173/test-dataset-save.html
   - Page sẽ tự động load session info

5. **Kiểm tra session:**
   - Xem phần "Supabase Session Info"
   - Verify token có hợp lệ không (màu xanh = OK)
   - Nếu token sắp hết hạn, click "🔑 Refresh Token"

6. **Test save:**
   - Nhập question và answer (hoặc dùng giá trị mặc định)
   - Click "🚀 Test Save to Backend"
   - Xem logs để theo dõi quá trình

7. **Kiểm tra kết quả:**
   - Nếu thành công: sẽ thấy "✅ SUCCESS! Dataset entry saved"
   - Nếu lỗi 401: xem backend logs để debug

### Option 2: Test Trong App Thật

1. **Start servers** (như Option 1)

2. **Login và mở AI Chat:**
   - Login vào app
   - Click vào icon chat
   - Chọn tab "Cao nhan AI"

3. **Chọn Trial mode:**
   - Chọn "Trial" từ dropdown
   - Gửi một câu hỏi bất kỳ

4. **Kiểm tra logs:**
   - Mở DevTools Console (F12)
   - Xem logs bắt đầu với `[sendAi]` và `[addServerDatasetEntry]`
   - Verify token được gửi đúng

5. **Kiểm tra Network tab:**
   - Mở DevTools → Network tab
   - Tìm request `POST /api/dataset/add`
   - Verify header `Authorization: Bearer ...` có tồn tại
   - Xem response status và body

### Option 3: Test Với PHP Script

1. **Get token từ browser:**
   - Login vào app
   - Mở DevTools → Console
   - Chạy:
     ```javascript
     const { data } = await supabase.auth.getSession()
     console.log(data.session.access_token)
     ```
   - Copy token

2. **Run test script:**
   ```bash
   cd backend
   php test-dataset-endpoint.php YOUR_TOKEN_HERE
   ```

3. **Xem kết quả:**
   - Script sẽ hiển thị chi tiết request và response
   - Nếu lỗi 401, xem backend logs

## Kiểm Tra Backend Logs

### Xem logs realtime:

**Windows (PowerShell):**
```powershell
Get-Content backend\storage\logs\php_errors.log -Wait -Tail 50
```

**Windows (CMD):**
```cmd
type backend\storage\logs\php_errors.log
```

### Tìm logs liên quan:

Tìm các dòng log bắt đầu với:
- `[dataset/add]` - Logs từ endpoint
- `[verifySupabaseToken]` - Logs từ token verification
- `[Config]` - Logs về config loading

### Các logs quan trọng cần check:

1. **Config được load đúng:**
   ```
   [Config] Loaded SUPABASE_URL from .env: https://odkemyagrewvphbcikdy...
   [Config] Loaded SUPABASE_ANON_KEY from .env
   [Config] Final SUPABASE_URL: https://odkemyagrewvphbcikdy...
   [Config] Final SUPABASE_ANON_KEY: SET (xxx chars)
   ```

2. **Authorization header được nhận:**
   ```
   [dataset/add] getAuthorizationHeaderValue() returned: Bearer eyJhbGciOiJI...
   [dataset/add] ✅ Token extracted successfully
   ```

3. **Token verification thành công:**
   ```
   [verifySupabaseToken] Calling Supabase: https://odkemyagrewvphbcikdy.supabase.co/auth/v1/user
   [verifySupabaseToken] HTTP response code: 200
   [verifySupabaseToken] ✅ Success - user ID: 05efe9cc-04e7-4777-8c00-c96d40b1d120
   ```

4. **Authentication thành công:**
   ```
   [dataset/add] ✅ Authentication SUCCESS
   [dataset/add] Authenticated user ID: 05efe9cc-04e7-4777-8c00-c96d40b1d120
   ```

## Troubleshooting

### Lỗi: "No active session"

**Nguyên nhân:** User chưa login hoặc session đã hết hạn

**Giải pháp:**
1. Login lại vào app
2. Refresh test page
3. Verify session info hiển thị đúng

### Lỗi: "Token expired"

**Nguyên nhân:** Token đã hết hạn

**Giải pháp:**
1. Click "🔑 Refresh Token" trong test page
2. Hoặc login lại vào app

### Lỗi: 401 Unauthorized - "No Authorization header found"

**Nguyên nhân:** Backend không nhận được Authorization header

**Giải pháp:**
1. Kiểm tra CORS settings trong `backend/public/index.php`
2. Verify header `Access-Control-Allow-Headers` có chứa `Authorization`
3. Nếu dùng Apache, check `.htaccess` có forward Authorization header không

### Lỗi: 401 Unauthorized - "Token verification failed"

**Nguyên nhân:** Backend không verify được token với Supabase

**Giải pháp:**
1. Check backend logs để xem response từ Supabase
2. Verify `SUPABASE_URL` và `SUPABASE_ANON_KEY` trong `backend/.env`
3. Test trực tiếp với Supabase:
   ```bash
   curl -X GET "https://odkemyagrewvphbcikdy.supabase.co/auth/v1/user" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "apikey: YOUR_ANON_KEY"
   ```

### Lỗi: "Token invalid: Token missing expiry"

**Nguyên nhân:** Token không đúng format JWT

**Giải pháp:**
1. Verify token có 3 parts (header.payload.signature)
2. Paste token vào https://jwt.io để decode
3. Check token có claims `exp`, `sub`, `iss` không

### Lỗi: Network error / CORS

**Nguyên nhân:** CORS không được config đúng

**Giải pháp:**
1. Verify backend có CORS headers:
   ```php
   header('Access-Control-Allow-Origin: http://localhost:5173');
   header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
   header('Access-Control-Allow-Credentials: true');
   ```
2. Verify backend xử lý OPTIONS preflight request
3. Check browser console có lỗi CORS không

## Verify Fix Thành Công

### Checklist:

- [ ] Test page hiển thị session info đúng
- [ ] Token có status "✅ Active" (màu xanh)
- [ ] Click "Test Save" → thấy "✅ SUCCESS!"
- [ ] Backend logs hiển thị "✅ Authentication SUCCESS"
- [ ] File `backend/data/caro_dataset.jsonl` có entry mới
- [ ] Test trong app thật → gửi câu hỏi Trial → không có lỗi 401
- [ ] DevTools Console không có error logs
- [ ] Network tab hiển thị request thành công (200/201)

### Verify dataset file:

```bash
# Xem 5 dòng cuối của dataset
tail -n 5 backend/data/caro_dataset.jsonl

# Hoặc trên Windows:
Get-Content backend\data\caro_dataset.jsonl -Tail 5
```

Entry mới phải có format:
```json
{
  "id": "c-auto-1733169958-...",
  "question": "Test question...",
  "paraphrases": [],
  "answer": "Test answer...",
  "topic": "test",
  "difficulty": "beginner",
  "language": "vi"
}
```

## Next Steps Sau Khi Fix

1. **Remove debug logs:** Sau khi verify fix thành công, có thể remove một số logs chi tiết để giảm noise

2. **Test với nhiều scenarios:**
   - User mới login
   - User đã login lâu (token gần hết hạn)
   - Logout → login lại
   - Gửi nhiều câu hỏi liên tiếp

3. **Monitor production:** Nếu deploy lên production, monitor logs để đảm bảo không có lỗi 401

4. **Optimize:** Có thể cache token validation result để giảm số lần gọi Supabase

## Liên Hệ

Nếu vẫn gặp lỗi sau khi thử tất cả các bước trên:
1. Copy toàn bộ logs từ test page (click "📋 Copy Logs")
2. Copy backend logs liên quan
3. Gửi cho team để debug thêm
