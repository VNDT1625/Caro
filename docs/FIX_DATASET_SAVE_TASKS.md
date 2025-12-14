# Tasks & Plan: Fix Lỗi 401 Unauthorized Khi Lưu Dataset

## Phân Tích Lỗi

**Lỗi hiện tại:** HTTP 401 Unauthorized khi gọi `POST /api/dataset/add`

**Nguyên nhân chính:**
- Token Supabase được gửi từ frontend nhưng backend không verify thành công
- Có thể do token hết hạn, sai format, hoặc backend không đọc được Authorization header

**Log quan trọng:**
```
[addServerDatasetEntry] Sending with Authorization token: eyJhbGciOiJIUzI1NiIs...
POST http://localhost:8001/api/dataset/add
Status: 401 Unauthorized
Response: {"error":"Login required"}
```

## Quy Trình Fix: Kiểm Tra → Fix → Test → Lặp Lại

### 1. Kiểm Tra Token & Authentication Flow

#### 1.1. Kiểm tra token có được gửi đúng không
- **Mục tiêu:** Xác nhận frontend gửi token đúng format
- **Cách làm:**
  - Kiểm tra code frontend trong `HomeChatOverlay.tsx` dòng ~640
  - Xác nhận token được lấy từ `supabase.auth.getSession()`
  - Verify token được gửi trong header `Authorization: Bearer <token>`

#### 1.1.1. Kiểm tra cấu trúc session data
- **Mục tiêu:** Đảm bảo đọc đúng path của access_token
- **Vấn đề phát hiện:** Code hiện tại có thể đọc sai path
  ```typescript
  // Có thể sai:
  const token = sessionData?.session?.session?.access_token
  
  // Đúng phải là:
  const token = sessionData?.session?.access_token
  ```

#### 1.1.1.1. Fix path access_token trong HomeChatOverlay.tsx
- **File:** `frontend/src/components/chat/HomeChatOverlay.tsx`
- **Dòng:** ~640-650
- **Action:** Sửa từ `sessionData?.session?.session?.access_token` thành `sessionData?.session?.access_token`

#### 1.1.1.2. Thêm logging chi tiết để debug
- **Mục tiêu:** Log ra toàn bộ session structure để verify
- **Action:** Thêm `console.log('[sendAi] Session structure:', JSON.stringify(sessionData, null, 2))`

#### 1.1.2. Test token có hợp lệ không
- **Mục tiêu:** Verify token chưa hết hạn và có thể decode
- **Cách làm:**
  - Thêm code decode JWT token ở frontend để check expiry
  - Log ra token expiry time vs current time

#### 1.1.2.1. Thêm hàm decode JWT token
- **File:** `frontend/src/lib/caroDataset.ts`
- **Action:** Thêm helper function để decode và validate token
  ```typescript
  function decodeJWT(token: string) {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => 
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join(''))
      return JSON.parse(jsonPayload)
    } catch (e) {
      return null
    }
  }
  ```

#### 1.1.2.2. Validate token trước khi gửi
- **Mục tiêu:** Kiểm tra token expiry trước khi gửi request
- **Action:** Thêm validation logic
  ```typescript
  if (token) {
    const decoded = decodeJWT(token)
    if (decoded && decoded.exp) {
      const now = Math.floor(Date.now() / 1000)
      if (decoded.exp < now) {
        console.error('[addServerDatasetEntry] Token expired!')
        // Refresh token hoặc yêu cầu login lại
      }
    }
  }
  ```

#### 1.2. Kiểm tra backend nhận được token không
- **Mục tiêu:** Xác nhận backend đọc được Authorization header
- **Cách làm:**
  - Kiểm tra logs trong `backend/public/index.php` dòng ~1308-1320
  - Verify các biến `$_SERVER['HTTP_AUTHORIZATION']`, `REDIRECT_HTTP_AUTHORIZATION`

#### 1.2.1. Kiểm tra Apache/Nginx config
- **Mục tiêu:** Đảm bảo web server forward Authorization header
- **Vấn đề:** Một số config Apache/Nginx không forward header này

#### 1.2.1.1. Kiểm tra .htaccess (nếu dùng Apache)
- **File:** `backend/public/.htaccess`
- **Action:** Thêm rule để forward Authorization header
  ```apache
  RewriteEngine On
  RewriteCond %{HTTP:Authorization} ^(.*)
  RewriteRule .* - [e=HTTP_AUTHORIZATION:%1]
  ```

#### 1.2.1.2. Test với curl để verify
- **Mục tiêu:** Bypass frontend để test trực tiếp backend
- **Action:** Chạy curl command với token thật
  ```bash
  curl -X POST http://localhost:8001/api/dataset/add \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_REAL_TOKEN" \
    -d '{"question":"test","answer":"test","language":"vi"}'
  ```

#### 1.2.1.3. Kiểm tra response và logs
- **Mục tiêu:** Xác định backend có nhận được header không
- **Action:** 
  - Nếu vẫn 401: vấn đề ở backend verification
  - Nếu 200: vấn đề ở frontend gửi token

#### 1.3. Kiểm tra hàm verifySupabaseToken
- **Mục tiêu:** Đảm bảo backend verify token đúng cách
- **File:** `backend/public/index.php` dòng ~91-130

#### 1.3.1. Kiểm tra SUPABASE_URL và SUPABASE_ANON_KEY
- **Mục tiêu:** Verify config được load đúng
- **Action:** Kiểm tra logs xem có "SUPABASE_URL not configured" không

#### 1.3.1.1. Verify .env được load
- **File:** `backend/public/index.php` đầu file
- **Action:** Đảm bảo có code load .env file
  ```php
  // Load .env
  $envFile = __DIR__ . '/../.env';
  if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
      if (strpos(trim($line), '#') === 0) continue;
      list($key, $value) = explode('=', $line, 2);
      $_ENV[trim($key)] = trim($value);
    }
  }
  ```

#### 1.3.1.2. Test Supabase API endpoint
- **Mục tiêu:** Verify Supabase URL và credentials hoạt động
- **Action:** Test với curl
  ```bash
  curl -X GET "https://odkemyagrewvphbcikdy.supabase.co/auth/v1/user" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "apikey: YOUR_ANON_KEY"
  ```

#### 1.3.2. Kiểm tra response từ Supabase
- **Mục tiêu:** Xem Supabase trả về gì khi verify token
- **Action:** Thêm logging chi tiết trong `verifySupabaseToken()`
  ```php
  error_log("[verifySupabaseToken] Calling: $url");
  error_log("[verifySupabaseToken] Token: " . substr($token, 0, 20) . "...");
  error_log("[verifySupabaseToken] Response code: $code");
  error_log("[verifySupabaseToken] Response body: " . substr($resp, 0, 500));
  ```

#### 1.3.2.1. Xử lý các error codes từ Supabase
- **Mục tiêu:** Handle các trường hợp lỗi cụ thể
- **Action:** Thêm error handling
  ```php
  if ($code === 401) {
    error_log("[verifySupabaseToken] Token invalid or expired");
  } elseif ($code === 403) {
    error_log("[verifySupabaseToken] Token valid but insufficient permissions");
  } elseif ($code >= 500) {
    error_log("[verifySupabaseToken] Supabase server error");
  }
  ```

### 1.4. Test sau khi fix mỗi bước

#### 1.4.1. Test với browser console
- **Mục tiêu:** Verify token được gửi đúng
- **Action:**
  1. Mở DevTools → Network tab
  2. Gửi câu hỏi AI với mode Trial
  3. Kiểm tra request `POST /api/dataset/add`
  4. Verify header `Authorization: Bearer ...` có tồn tại
  5. Kiểm tra response status và body

#### 1.4.2. Test với backend logs
- **Mục tiêu:** Verify backend nhận và xử lý đúng
- **Action:**
  1. Mở file log: `backend/storage/logs/php_errors.log`
  2. Tìm các dòng log từ `[verifySupabaseToken]` và `[getSupabaseAuthContext]`
  3. Verify token được extract và verify thành công

#### 1.4.3. Test end-to-end
- **Mục tiêu:** Verify toàn bộ flow hoạt động
- **Action:**
  1. Login vào app
  2. Chọn AI mode = Trial
  3. Gửi câu hỏi: "test lưu dataset"
  4. Kiểm tra response có lỗi không
  5. Verify file `backend/data/caro_dataset.jsonl` có entry mới

### 1.5. Nếu vẫn lỗi → Kiểm tra chuyên sâu

#### 1.5.1. Debug token format
- **Mục tiêu:** Verify token có đúng format JWT không
- **Action:** Paste token vào jwt.io để decode và check structure

#### 1.5.1.1. Kiểm tra token claims
- **Mục tiêu:** Verify token có đủ claims cần thiết
- **Expected claims:**
  - `sub`: user ID
  - `exp`: expiry timestamp
  - `iss`: issuer (Supabase URL)
  - `aud`: audience (authenticated)

#### 1.5.1.2. So sánh với token mẫu hoạt động
- **Mục tiêu:** Tìm điểm khác biệt
- **Action:** Lấy token từ một request thành công khác (ví dụ: create report) và so sánh

#### 1.5.2. Kiểm tra CORS settings
- **Mục tiêu:** Đảm bảo CORS không block Authorization header
- **File:** `backend/public/index.php` đầu file

#### 1.5.2.1. Verify CORS headers
- **Action:** Kiểm tra có các headers sau:
  ```php
  header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
  header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
  header('Access-Control-Allow-Credentials: true');
  ```

#### 1.5.2.2. Test OPTIONS preflight
- **Mục tiêu:** Verify preflight request thành công
- **Action:**
  ```bash
  curl -X OPTIONS http://localhost:8001/api/dataset/add \
    -H "Origin: http://localhost:5173" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Authorization"
  ```

#### 1.5.3. Kiểm tra session refresh
- **Mục tiêu:** Đảm bảo token được refresh khi hết hạn
- **File:** `frontend/src/components/chat/HomeChatOverlay.tsx`

#### 1.5.3.1. Thêm auto-refresh token
- **Action:** Thêm logic refresh token trước khi gửi
  ```typescript
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  
  // Check if token expired or about to expire
  if (sessionData?.session?.access_token) {
    const decoded = decodeJWT(sessionData.session.access_token)
    if (decoded?.exp) {
      const now = Math.floor(Date.now() / 1000)
      const timeUntilExpiry = decoded.exp - now
      
      // Refresh if less than 5 minutes until expiry
      if (timeUntilExpiry < 300) {
        console.log('[sendAi] Token expiring soon, refreshing...')
        const { data: refreshData } = await supabase.auth.refreshSession()
        if (refreshData?.session?.access_token) {
          token = refreshData.session.access_token
        }
      }
    }
  }
  ```

### 1.6. Fix cuối cùng và test tổng thể

#### 1.6.1. Tổng hợp tất cả fixes
- **Mục tiêu:** Apply tất cả các fixes đã identify
- **Action:** Review và apply từng fix một cách có hệ thống

#### 1.6.2. Test regression
- **Mục tiêu:** Đảm bảo không làm hỏng features khác
- **Action:**
  1. Test login/logout
  2. Test chat world/friend
  3. Test AI Free mode
  4. Test AI Trial mode
  5. Test AI Pro mode

#### 1.6.3. Test với nhiều scenarios
- **Mục tiêu:** Verify fix hoạt động trong mọi trường hợp
- **Scenarios:**
  1. User mới login → gửi câu hỏi Trial
  2. User đã login lâu → gửi câu hỏi Trial (token có thể gần hết hạn)
  3. User logout → login lại → gửi câu hỏi Trial
  4. Gửi nhiều câu hỏi liên tiếp
  5. Refresh page → gửi câu hỏi Trial

#### 1.6.4. Verify dataset được lưu đúng
- **Mục tiêu:** Kiểm tra dữ liệu trong file
- **Action:**
  1. Mở file `backend/data/caro_dataset.jsonl`
  2. Verify có entries mới với đúng format
  3. Verify language field được lưu đúng
  4. Verify không có duplicates

## Tóm Tắt Các Fixes Chính

### Fix 1: Sửa path access_token
**File:** `frontend/src/components/chat/HomeChatOverlay.tsx`
```typescript
// Sai:
const token = sessionData?.session?.session?.access_token

// Đúng:
const token = sessionData?.session?.access_token
```

### Fix 2: Thêm token validation
**File:** `frontend/src/lib/caroDataset.ts`
- Thêm hàm `decodeJWT()` để decode token
- Validate token expiry trước khi gửi
- Auto-refresh token nếu sắp hết hạn

### Fix 3: Improve backend logging
**File:** `backend/public/index.php`
- Thêm chi tiết logs trong `verifySupabaseToken()`
- Log response từ Supabase để debug

### Fix 4: Verify .env loading
**File:** `backend/public/index.php`
- Đảm bảo SUPABASE_URL và SUPABASE_ANON_KEY được load đúng
- Thêm fallback nếu .env không load được

### Fix 5: Handle CORS properly
**File:** `backend/public/index.php`
- Verify CORS headers cho phép Authorization
- Handle OPTIONS preflight request

## Checklist Hoàn Thành

- [x] 1.1.1.1: Fix path access_token trong HomeChatOverlay.tsx (Đã đúng từ đầu)
- [x] 1.1.1.2: Thêm logging chi tiết session structure
- [x] 1.1.2.1: Thêm hàm decode JWT token
- [x] 1.1.2.2: Validate token trước khi gửi
- [ ] 1.2.1.1: Kiểm tra .htaccess (nếu dùng Apache) - Cần test
- [ ] 1.2.1.2: Test với curl - Có script test
- [x] 1.3.1.1: Verify .env được load (Đã có code load .env)
- [ ] 1.3.1.2: Test Supabase API endpoint - Cần test
- [x] 1.3.2.1: Xử lý error codes từ Supabase
- [ ] 1.4.1: Test với browser console - Có test page
- [ ] 1.4.2: Test với backend logs - Cần chạy test
- [ ] 1.4.3: Test end-to-end - Cần chạy test
- [ ] 1.5.1.1: Kiểm tra token claims - Có trong test page
- [x] 1.5.2.1: Verify CORS headers (Đã có trong index.php)
- [ ] 1.5.2.2: Test OPTIONS preflight - Cần test
- [x] 1.5.3.1: Thêm auto-refresh token
- [ ] 1.6.2: Test regression - Cần test
- [ ] 1.6.3: Test với nhiều scenarios - Cần test
- [ ] 1.6.4: Verify dataset được lưu đúng - Cần test

## Files Đã Tạo

1. **docs/FIX_DATASET_SAVE_TASKS.md** - Tasks chi tiết
2. **frontend/test-dataset-save.html** - Test page để test trong browser
3. **backend/test-dataset-endpoint.php** - Script PHP để test endpoint
4. **docs/TEST_DATASET_SAVE_FIX.md** - Hướng dẫn test chi tiết

## Các Fixes Đã Apply

### Frontend (caroDataset.ts)
- ✅ Thêm `decodeJWT()` function
- ✅ Thêm `validateToken()` function
- ✅ Validate token trước khi gửi request
- ✅ Log chi tiết token info

### Frontend (HomeChatOverlay.tsx)
- ✅ Log toàn bộ session structure
- ✅ Check token expiry và auto-refresh
- ✅ Log chi tiết các bước xử lý

### Backend (index.php)
- ✅ Cải thiện logging trong `verifySupabaseToken()`
- ✅ Log chi tiết response từ Supabase
- ✅ Xử lý error codes cụ thể
- ✅ Cải thiện logging trong `/api/dataset/add`

## Bước Tiếp Theo

**QUAN TRỌNG:** Bây giờ cần TEST để verify fixes hoạt động!

### Test ngay:

1. **Start backend server:**
   ```bash
   cd backend
   php -S localhost:8001 -t public
   ```

2. **Mở test page:**
   - Truy cập: http://localhost:5173/test-dataset-save.html
   - Login trước tại: http://localhost:5173
   - Chạy test và xem kết quả

3. **Xem logs:**
   ```bash
   # Xem logs realtime
   Get-Content backend\storage\logs\php_errors.log -Wait -Tail 50
   ```

### Nếu vẫn lỗi 401:

Xem file **docs/TEST_DATASET_SAVE_FIX.md** để troubleshoot chi tiết.
