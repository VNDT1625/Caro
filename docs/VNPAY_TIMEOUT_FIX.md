# 🔧 Fix: VNPay Giao dịch quá thời gian chờ thanh toán

## 🎯 Vấn đề

Khi thanh toán qua VNPay Sandbox, nhận được lỗi:
```
Thông báo: Giao dịch đã quá thời gian chờ thanh toán. 
Quý khách vui lòng thực hiện lại giao dịch
```

## 🔍 Nguyên nhân

**Session lưu trong memory** - Khi backend restart hoặc crash, tất cả payment sessions bị mất. Khi VNPay gọi webhook callback, backend không tìm thấy transaction → giao dịch bị timeout.

## ✅ Giải pháp

Đã migrate payment sessions từ **in-memory storage** sang **MySQL database** để persistent.

### Các thay đổi:

1. **Migration mới**: `infra/migrations/20251204_000001_create_payment_sessions_table.sql`
   - Tạo bảng `payment_sessions` để lưu trữ transaction data
   - Lưu VNPay response data (JSON)
   - Indexes cho performance

2. **PaymentService.php** - Updated:
   - Thay thế `$sessions = []` (memory) bằng database queries
   - `saveSessionToDb()` - Lưu session khi tạo payment
   - `getSessionFromDb()` - Lấy session từ DB
   - `updateSessionStatus()` - Update status khi webhook callback

3. **ServiceProvider.php** - Updated:
   - Thêm `PaymentServiceInterface` binding
   - Thêm `SubscriptionServiceInterface` binding
   - Thêm `createPaymentController()` method
   - Thêm `getDatabase()` helper

4. **public/index.php** - Updated:
   - `createPaymentController()` giờ pass database connection
   - PaymentService có thể lưu/lấy session từ DB

## 🚀 Cách sử dụng

### 1. Chạy migration

```bash
# Nếu dùng Supabase (recommended)
# Vào Supabase dashboard → SQL Editor
# Copy & paste nội dung file: infra/migrations/20251204_000001_create_payment_sessions_table.sql
# Chạy query

# Hoặc nếu dùng MySQL local
mysql -u root -p mindpoint < infra/migrations/20251204_000001_create_payment_sessions_table.sql
```

### 2. Restart backend

```powershell
cd backend
php -S localhost:8001 -t public
```

### 3. Test thanh toán

1. Mở frontend: http://localhost:5173
2. Đăng nhập
3. Vào trang **Subscription**
4. Click nút **VNPay**
5. Dùng thẻ test:
   - Số thẻ: `9704198526191432198`
   - Tên: `NGUYEN VAN A`
   - Ngày: `07/15`
   - OTP: `123456`

### 4. Kiểm tra kết quả

- VNPay sẽ redirect về webhook endpoint
- Backend sẽ verify signature và cập nhật subscription
- Check trong database:
  ```sql
  SELECT * FROM payment_sessions WHERE status = 'paid';
  SELECT * FROM subscriptions WHERE user_id = 'YOUR_USER_ID';
  ```

## 📊 Flow thanh toán (cải thiện)

```
User click "VNPay" 
  → Frontend gọi POST /api/payment/create
  → Backend tạo payment URL + lưu session vào DB ✅
  → User redirect tới VNPay sandbox
  → User nhập thông tin thẻ test
  → VNPay xử lý thanh toán
  → VNPay gọi IPN webhook (qua ngrok)
  → Backend verify signature + lấy session từ DB ✅
  → Backend cập nhật subscription
  → User redirect về Return URL
```

## 🔒 Bảo mật

- VNPay signature verification vẫn được giữ nguyên
- Session data được lưu an toàn trong database
- RLS policies đảm bảo users chỉ xem được session của họ
- Admins có thể xem tất cả sessions

## 🐛 Troubleshooting

### "Unknown transaction" error
- Kiểm tra migration đã chạy chưa
- Kiểm tra database connection trong backend/.env
- Xem logs: `storage/supabase_errors.log`

### "Invalid signature" error
- Kiểm tra `VNPAY_HASH_SECRET` có đúng không
- Đảm bảo không có khoảng trắng thừa trong .env

### VNPay không gọi webhook
- Kiểm tra ngrok có đang chạy không
- Kiểm tra URL trên VNPay portal có đúng không
- Xem ngrok web interface: http://127.0.0.1:4040

## 📝 Notes

- Session tự động expire sau 15 phút (theo VNPay requirement)
- Có thể query payment history từ database
- Webhook endpoint không cần authentication (VNPay gọi từ server)

