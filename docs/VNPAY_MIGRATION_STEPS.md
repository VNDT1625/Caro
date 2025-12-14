# 📋 Các bước chạy migration payment_sessions

## ✅ Checklist

- [ ] Bước 1: Chạy migration
- [ ] Bước 2: Verify table được tạo
- [ ] Bước 3: Restart backend
- [ ] Bước 4: Test thanh toán

---

## 🔧 Bước 1: Chạy Migration

### Tùy chọn A: Dùng Supabase (Recommended)

1. Mở Supabase dashboard: https://app.supabase.com
2. Chọn project của bạn
3. Vào **SQL Editor** (bên trái)
4. Click **New Query**
5. Copy toàn bộ nội dung file: `infra/migrations/20251204_000001_create_payment_sessions_table.sql`
6. Paste vào editor
7. Click **Run** (hoặc Ctrl+Enter)
8. Chờ query hoàn thành ✅

### Tùy chọn B: Dùng MySQL Local

```powershell
# Mở PowerShell, chạy:
cd backend
mysql -u root -p mindpoint < ../infra/migrations/20251204_000001_create_payment_sessions_table.sql

# Nhập password khi được hỏi (từ backend/.env: DB_PASSWORD)
```

---

## ✔️ Bước 2: Verify Table Được Tạo

### Kiểm tra trên Supabase

1. Vào **Table Editor** (bên trái)
2. Scroll down, tìm table `payment_sessions`
3. Nếu thấy → Migration thành công ✅

### Kiểm tra trên MySQL Local

```powershell
mysql -u root -p mindpoint -e "SHOW TABLES LIKE 'payment_sessions';"
```

Nếu thấy output:
```
+---------------------------+
| Tables_in_mindpoint       |
+---------------------------+
| payment_sessions          |
+---------------------------+
```

→ Migration thành công ✅

---

## 🚀 Bước 3: Restart Backend

```powershell
# Stop backend hiện tại (Ctrl+C nếu đang chạy)

# Restart:
cd backend
php -S localhost:8001 -t public
```

Nếu thấy:
```
Development Server (http://127.0.0.1:8001) started
```

→ Backend ready ✅

---

## 🧪 Bước 4: Test Thanh Toán

### 4.1 Mở Frontend

```
http://localhost:5173
```

### 4.2 Đăng nhập

- Email: `test@example.com` (hoặc tài khoản của bạn)
- Password: (password của bạn)

### 4.3 Vào trang Subscription

- Click menu → **Subscription**
- Hoặc truy cập: `http://localhost:5173/#subscription`

### 4.4 Click nút VNPay

- Chọn gói bất kỳ (Pro, Pro+, Trial)
- Click nút **VNPay**
- Sẽ mở tab mới với trang thanh toán VNPay

### 4.5 Nhập thông tin thẻ test

- **Số thẻ**: `9704198526191432198`
- **Tên chủ thẻ**: `NGUYEN VAN A`
- **Ngày phát hành**: `07/15`
- **Mật khẩu OTP**: `123456`

### 4.6 Hoàn thành thanh toán

- Click **Thanh toán**
- VNPay sẽ xử lý
- Sẽ redirect về webhook endpoint
- Backend sẽ cập nhật subscription

---

## ✅ Kiểm tra Kết Quả

### Cách 1: Kiểm tra Database

**Trên Supabase:**
1. Vào **Table Editor**
2. Click table `payment_sessions`
3. Tìm row với `status = 'paid'`
4. Nếu thấy → Thanh toán thành công ✅

**Trên MySQL Local:**
```powershell
mysql -u root -p mindpoint -e "SELECT * FROM payment_sessions WHERE status = 'paid' ORDER BY created_at DESC LIMIT 1;"
```

### Cách 2: Kiểm tra Subscription

**Trên Supabase:**
1. Vào **Table Editor**
2. Click table `subscriptions`
3. Tìm row của user bạn
4. Kiểm tra `tier` và `expires_at` đã thay đổi chưa

**Trên MySQL Local:**
```powershell
mysql -u root -p mindpoint -e "SELECT * FROM subscriptions WHERE user_id = 'YOUR_USER_ID';"
```

### Cách 3: Kiểm tra Frontend

- Sau khi thanh toán, page sẽ reload
- Kiểm tra subscription status đã update chưa
- Nếu tier thay đổi từ "free" → "pro" → Thành công ✅

---

## 🐛 Nếu Gặp Lỗi

### Lỗi: "Table already exists"
- Migration đã chạy rồi
- Bỏ qua, tiếp tục bước 3

### Lỗi: "Unknown transaction"
- Kiểm tra migration đã chạy chưa
- Kiểm tra database connection
- Xem logs: `backend/storage/supabase_errors.log`

### Lỗi: "Invalid signature"
- Kiểm tra `VNPAY_HASH_SECRET` trong `backend/.env`
- Đảm bảo không có khoảng trắng thừa
- Restart backend

### VNPay không gọi webhook
- Kiểm tra ngrok có đang chạy không
- Kiểm tra URL trên VNPay portal
- Xem ngrok logs: http://127.0.0.1:4040

---

## 📞 Cần Giúp?

Nếu vẫn gặp vấn đề:
1. Kiểm tra logs: `backend/storage/supabase_errors.log`
2. Xem ngrok web interface: http://127.0.0.1:4040
3. Kiểm tra backend console output
4. Verify credentials trong `backend/.env`

