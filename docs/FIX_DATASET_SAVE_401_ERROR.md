# Plan Fix Lỗi 401 Unauthorized Khi Lưu Dataset

## Phân Tích Lỗi

**Lỗi hiện tại:** HTTP 401 Unauthorized khi gọi `POST /api/dataset/add`

**Nguyên nhân:** Token Supabase không được verify thành công ở backend PHP

**Log quan trọng:**
```
[addServerDatasetEntry] Sending with Authorization token: eyJhbGciOiJIUzI1NiIs...
[addServerDatasetEntry] Response status: 401 Unauthorized
[addServerDatasetEntry] Error response: {"error":"Login required"}
```

## 1. Kiểm Tra Flow Authentication

### 1.1. Kiểm tra frontend gửi token
**Mục tiêu:** Xác nhận token được gửi đúng format

#### 1.1.1. Kiểm tra token có tồn tại
- Mở `frontend/src/components/chat/HomeChatOverlay.tsx`
- Tìm đoạn code lấy token: `const token = sessionData?.session?.access_token`
- Thêm log chi tiết để debug

#### 1.1.2. Kiểm tra token được truyền vào hàm
- Kiểm tra `addServerDatasetEntry()` nhận đúng token
- Xác nhận token không bị null/undefined

#### 1.1.3. Kiểm tra header Authorization
- Mở `frontend/src/lib/caroDataset.ts`
- Xác nhận header được set: `Authorization: Bearer ${token}`
- Kiểm tra token có bị cắt/sửa đổi không

### 1.2. Kiểm tra backend nhận token
**Mục tiêu:** Xác nhận backend nhận và parse token đúng

#### 1.2.1. Kiểm tra getAuthorizationHeaderValue()
- Mở `backend/public/index.php`
- Xem hàm `getAuthorizationHeaderValue()` (line ~180)
- Kiểm tra các trường hợp:
  - `$_SERVER['HTTP_AUTHORIZATION']`
  - `$_SERVER['REDIRECT_HTTP_AUTHORIZATION']`
  - `getallheaders()['Authorization']`

#### 1.2.2. Kiểm tra verifySupabaseToken()
- Xem hàm `verifySupabaseToken()` (line ~91)
- Kiểm tra endpoint: `$SUPABASE_URL/auth/v1/user`
- Xác nhận headers gửi đi:
  - `Authorization: Bearer {token}`
  - `apikey: {SUPABASE_ANON_KEY}`

#### 1.2.3. Kiểm tra biến môi trường
- Kiểm tra `backend/.env`:
  - `SUPABASE_URL` có đúng không
  - `SUPABASE_ANON_KEY` có đúng không
  - `SUPABASE_SERVICE_KEY` có cần không

### 1.3. Kiểm tra CORS và Apache/Nginx config
**Mục tiêu:** Xác nhận header Authorization không bị strip

#### 1.3.1. Kiểm tra CORS headers
- Xem `backend/public/index.php` phần CORS (đầu file)
- Xác nhận `Access-Control-Allow-Headers` có `Authorization`

#### 1.3.2. Kiểm tra Apache config
- Nếu dùng Apache, kiểm tra `.htaccess`
- Cần có: `SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1`

#### 1.3.3. Kiểm tra PHP-FPM config
- Nếu dùng PHP-FPM, kiểm tra `fastcgi_params`
- Cần có: `fastcgi_param HTTP_AUTHORIZATION $http_authorization;`

## 1.4. Test thủ công với curl
**Mục tiêu:** Loại trừ vấn đề từ frontend

#### 1.4.1. Lấy token thật từ browser
- Mở DevTools > Application > Local Storage
- Hoặc log token từ frontend

#### 1.4.2. Test với curl
```bash
curl -X POST http://localhost:8001/api/dataset/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_REAL_TOKEN" \
  -d '{"question":"test","answer":"test","language":"vi"}'
```

#### 1.4.3. Phân tích response
- Nếu curl thành công → vấn đề ở frontend
- Nếu curl thất bại → vấn đề ở backend

## 1.5. Kiểm tra Supabase token validity
**Mục tiêu:** Xác nhận token còn hiệu lực

#### 1.5.1. Kiểm tra token expiry
- Token Supabase có thời hạn (thường 1 giờ)
- Kiểm tra field `exp` trong JWT payload

#### 1.5.2. Test token với Supabase API
```bash
curl https://YOUR_PROJECT.supabase.co/auth/v1/user \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "apikey: YOUR_ANON_KEY"
```

#### 1.5.3. Kiểm tra refresh token
- Nếu token hết hạn, cần refresh
- Xem `supabase.auth.refreshSession()`

## 1.6. Fix và test
**Mục tiêu:** Áp dụng fix và verify

#### 1.6.1. Fix phát hiện được
- Áp dụng fix dựa trên phát hiện từ 1.1-1.5

#### 1.6.2. Test lại flow
- Đăng nhập vào web
- Hỏi AI với Trial mode
- Kiểm tra console log
- Xác nhận không còn lỗi 401

#### 1.6.3. Verify data được lưu
- Kiểm tra file `backend/data/caro_dataset.jsonl`
- Xác nhận entry mới được thêm vào
- Kiểm tra format JSON đúng

#### 1.6.4. Test edge cases
- Test khi token hết hạn
- Test khi không đăng nhập
- Test khi network chậm
- Test khi backend offline

## 1.7. Cải thiện error handling
**Mục tiêu:** Thông báo lỗi rõ ràng cho user

#### 1.7.1. Thêm retry logic
- Nếu 401, thử refresh token và retry
- Giới hạn số lần retry (max 2 lần)

#### 1.7.2. Thêm fallback
- Nếu server fail, lưu vào localStorage
- Hiển thị thông báo cho user biết

#### 1.7.3. Thêm monitoring
- Log các lỗi authentication
- Track success rate của dataset save

## 1.8. Documentation và cleanup
**Mục tiêu:** Hoàn thiện và dọn dẹp

#### 1.8.1. Update documentation
- Ghi lại nguyên nhân lỗi
- Ghi lại cách fix
- Thêm vào troubleshooting guide

#### 1.8.2. Remove debug logs
- Xóa các console.log không cần thiết
- Giữ lại logs quan trọng với level phù hợp

#### 1.8.3. Code review
- Review toàn bộ changes
- Đảm bảo không break existing features
- Test regression

## Ghi Chú Quan Trọng

### Các vấn đề thường gặp:
1. **Token format sai:** Phải là `Bearer <token>`, không có khoảng trắng thừa
2. **CORS:** Header Authorization bị strip bởi server
3. **Token expired:** Token Supabase hết hạn sau 1 giờ
4. **Wrong endpoint:** Verify endpoint phải là `/auth/v1/user` không phải `/rest/v1/...`
5. **Missing apikey:** Supabase cần cả Authorization header và apikey header

### Debug checklist:
- [ ] Token có tồn tại trong frontend?
- [ ] Token được gửi trong header?
- [ ] Backend nhận được header?
- [ ] Backend parse được token?
- [ ] Supabase verify thành công?
- [ ] CORS config đúng?
- [ ] Environment variables đúng?

### Success criteria:
- ✅ Không còn lỗi 401
- ✅ Dataset được lưu vào file
- ✅ User thấy thông báo thành công
- ✅ Không có regression bugs
