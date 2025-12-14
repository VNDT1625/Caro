# ✅ VNPay Fix Implementation Checklist

## 📋 Pre-Implementation

- [ ] Đọc `docs/VNPAY_START_HERE.md`
- [ ] Đảm bảo backend đang chạy
- [ ] Đảm bảo ngrok đang chạy (port 8001)
- [ ] Đảm bảo frontend đang chạy (port 5173)

---

## 🔧 Phase 1: Migration

### 1.1 Chạy Migration

- [ ] Chọn phương pháp:
  - [ ] PowerShell Script: `scripts/run-payment-migration.ps1`
  - [ ] Supabase SQL Editor
  - [ ] MySQL Command Line

- [ ] Migration file: `infra/migrations/20251204_000001_create_payment_sessions_table.sql`

### 1.2 Verify Table Được Tạo

- [ ] Kiểm tra trên Supabase:
  - [ ] Vào Table Editor
  - [ ] Tìm table `payment_sessions`
  - [ ] Xem columns: txn_ref, user_id, plan, amount, status, vnp_data

- [ ] Hoặc kiểm tra trên MySQL:
  ```powershell
  mysql -u root -p mindpoint -e "SHOW TABLES LIKE 'payment_sessions';"
  ```

---

## 🚀 Phase 2: Backend Update

### 2.1 Verify Code Changes

- [ ] `backend/app/Services/PaymentService.php`
  - [ ] Có `$db` parameter trong constructor
  - [ ] Có `saveSessionToDb()` method
  - [ ] Có `getSessionFromDb()` method
  - [ ] Có `updateSessionStatus()` method

- [ ] `backend/bootstrap/ServiceProvider.php`
  - [ ] Có import `PaymentService`, `PaymentServiceInterface`
  - [ ] Có import `SubscriptionService`, `SubscriptionServiceInterface`
  - [ ] Có factory cho `PaymentServiceInterface`
  - [ ] Có `createPaymentController()` method

- [ ] `backend/public/index.php`
  - [ ] `createPaymentController()` tạo database connection
  - [ ] Pass `$db` vào PaymentService

### 2.2 Restart Backend

- [ ] Stop backend hiện tại (Ctrl+C)
- [ ] Chạy lại:
  ```powershell
  cd backend
  php -S localhost:8001 -t public
  ```
- [ ] Kiểm tra output: "Development Server started"

### 2.3 Verify Backend Không Có Lỗi

- [ ] Không có PHP errors trong console
- [ ] Không có database connection errors
- [ ] Backend ready để nhận requests

---

## 🧪 Phase 3: Testing

### 3.1 Prepare Test Environment

- [ ] Frontend: http://localhost:5173
- [ ] Backend: http://localhost:8001
- [ ] Ngrok: http://127.0.0.1:4040 (web interface)
- [ ] Supabase/MySQL: Database accessible

### 3.2 Test Payment Flow

- [ ] Mở frontend: http://localhost:5173
- [ ] Đăng nhập với tài khoản test
- [ ] Vào trang **Subscription**
- [ ] Click nút **VNPay** trên gói bất kỳ
- [ ] Sẽ mở tab mới với VNPay payment page

### 3.3 Complete Payment

- [ ] Nhập thẻ test:
  - [ ] Số thẻ: `9704198526191432198`
  - [ ] Tên: `NGUYEN VAN A`
  - [ ] Ngày: `07/15`
  - [ ] OTP: `123456`
- [ ] Click **Thanh toán**
- [ ] Chờ VNPay xử lý
- [ ] Sẽ redirect về webhook endpoint

### 3.4 Verify Webhook Callback

- [ ] Kiểm tra ngrok web interface: http://127.0.0.1:4040
- [ ] Tìm request tới `/api/payment/webhook`
- [ ] Status code: 200 (success)
- [ ] Response body có `status: 'paid'`

### 3.5 Verify Database Updates

**Check payment_sessions table**:
- [ ] Supabase: Table Editor → payment_sessions
- [ ] Hoặc MySQL:
  ```powershell
  mysql -u root -p mindpoint -e "SELECT * FROM payment_sessions WHERE status = 'paid' ORDER BY created_at DESC LIMIT 1;"
  ```
- [ ] Verify:
  - [ ] `txn_ref` có giá trị
  - [ ] `user_id` là user của bạn
  - [ ] `plan` là gói bạn chọn
  - [ ] `status` = 'paid'
  - [ ] `vnp_data` có JSON response từ VNPay

**Check subscriptions table**:
- [ ] Supabase: Table Editor → subscriptions
- [ ] Hoặc MySQL:
  ```powershell
  mysql -u root -p mindpoint -e "SELECT * FROM subscriptions WHERE user_id = 'YOUR_USER_ID';"
  ```
- [ ] Verify:
  - [ ] `tier` thay đổi từ 'free' → 'pro' hoặc 'pro_plus'
  - [ ] `status` = 'active'
  - [ ] `expires_at` là ngày trong tương lai

### 3.6 Verify Frontend Update

- [ ] Reload page: http://localhost:5173
- [ ] Kiểm tra subscription status
- [ ] Tier đã thay đổi chưa?
- [ ] Nếu có → ✅ Thành công

---

## 🔍 Phase 4: Verification

### 4.1 Payment Session Verification

- [ ] [ ] Payment session được lưu trong database
- [ ] [ ] Session có tất cả thông tin cần thiết
- [ ] [ ] VNPay response data được lưu (JSON)

### 4.2 Subscription Update Verification

- [ ] [ ] Subscription tier được cập nhật
- [ ] [ ] Expires date được set đúng
- [ ] [ ] Status là 'active'

### 4.3 Frontend Verification

- [ ] [ ] Subscription page hiển thị tier mới
- [ ] [ ] Không có error messages
- [ ] [ ] UI responsive

### 4.4 Security Verification

- [ ] [ ] VNPay signature verification vẫn hoạt động
- [ ] [ ] Database queries sử dụng prepared statements
- [ ] [ ] RLS policies được apply

---

## 🐛 Phase 5: Troubleshooting (Nếu Cần)

### 5.1 Nếu Migration Fail

- [ ] Kiểm tra file migration tồn tại: `infra/migrations/20251204_000001_create_payment_sessions_table.sql`
- [ ] Kiểm tra database connection
- [ ] Kiểm tra MySQL/Supabase credentials
- [ ] Xem error message chi tiết

### 5.2 Nếu Backend Fail

- [ ] Kiểm tra PHP syntax: `php -l backend/app/Services/PaymentService.php`
- [ ] Kiểm tra database connection trong `backend/.env`
- [ ] Xem backend console output
- [ ] Restart backend

### 5.3 Nếu Payment Fail

- [ ] Kiểm tra ngrok có chạy không
- [ ] Kiểm tra URL trên VNPay portal
- [ ] Kiểm tra VNPAY_HASH_SECRET trong `backend/.env`
- [ ] Xem ngrok logs: http://127.0.0.1:4040

### 5.4 Nếu Webhook Không Được Gọi

- [ ] Kiểm tra ngrok URL có đúng không
- [ ] Kiểm tra VNPay portal IPN URL setting
- [ ] Xem ngrok web interface
- [ ] Kiểm tra backend logs

---

## ✅ Final Verification

- [ ] Migration chạy thành công
- [ ] Backend restart không có lỗi
- [ ] Payment flow hoàn thành
- [ ] Database được cập nhật
- [ ] Frontend hiển thị tier mới
- [ ] Không có error messages
- [ ] Webhook callback thành công

---

## 📝 Sign-Off

- [ ] Tất cả checklist items đã hoàn thành
- [ ] VNPay payment working correctly
- [ ] Ready for production

**Date Completed**: _______________
**Tested By**: _______________
**Notes**: _______________

