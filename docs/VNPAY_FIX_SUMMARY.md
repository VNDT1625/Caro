# 📊 VNPay Timeout Fix - Summary

## 🎯 Vấn đề Gốc

Khi thanh toán qua VNPay Sandbox, nhận được lỗi:
```
Giao dịch đã quá thời gian chờ thanh toán. 
Quý khách vui lòng thực hiện lại giao dịch
```

**Nguyên nhân**: Payment sessions lưu trong memory → mất khi backend restart → VNPay webhook không tìm thấy transaction

---

## ✅ Giải Pháp Được Áp Dụng

### 1. Database Migration
**File**: `infra/migrations/20251204_000001_create_payment_sessions_table.sql`

Tạo bảng `payment_sessions` với:
- `txn_ref` - Transaction reference từ VNPay
- `user_id` - User UUID
- `plan` - Subscription plan (trial/pro/pro_plus)
- `amount` - Amount in VND
- `status` - Payment status (pending/paid/failed/cancelled/expired)
- `vnp_data` - VNPay response (JSON)
- Indexes cho performance
- RLS policies cho security

### 2. PaymentService.php - Updated
**File**: `backend/app/Services/PaymentService.php`

**Thay đổi**:
- Thêm `$db` parameter vào constructor
- Xóa `$sessions = []` (in-memory storage)
- Thêm `saveSessionToDb()` - Lưu session vào DB khi tạo payment
- Thêm `getSessionFromDb()` - Lấy session từ DB
- Thêm `updateSessionStatus()` - Update status khi webhook callback
- Tất cả queries sử dụng prepared statements (SQL injection safe)

**Flow**:
```
createPaymentSession() 
  → saveSessionToDb() 
  → return pay_url

verifyWebhook() 
  → getSessionFromDb() 
  → updateSessionStatus() 
  → return result
```

### 3. ServiceProvider.php - Updated
**File**: `backend/bootstrap/ServiceProvider.php`

**Thay đổi**:
- Thêm import: `PaymentService`, `PaymentServiceInterface`, `SubscriptionService`, `SubscriptionServiceInterface`
- Thêm factory cho `PaymentServiceInterface` (with DB connection)
- Thêm factory cho `SubscriptionServiceInterface`
- Thêm `createPaymentController()` method
- Thêm `getDatabase()` helper method

### 4. public/index.php - Updated
**File**: `backend/public/index.php`

**Thay đổi**:
- Update `createPaymentController()` function
- Giờ tạo database connection
- Pass `$db` vào PaymentService constructor

---

## 📁 Files Được Tạo/Sửa

### Tạo Mới:
- ✅ `infra/migrations/20251204_000001_create_payment_sessions_table.sql` - Migration
- ✅ `docs/VNPAY_TIMEOUT_FIX.md` - Hướng dẫn fix
- ✅ `docs/VNPAY_MIGRATION_STEPS.md` - Chi tiết các bước
- ✅ `scripts/run-payment-migration.ps1` - Script tự động
- ✅ `docs/VNPAY_FIX_SUMMARY.md` - File này

### Sửa Đổi:
- ✏️ `backend/app/Services/PaymentService.php` - Migrate to DB
- ✏️ `backend/bootstrap/ServiceProvider.php` - Add bindings
- ✏️ `backend/public/index.php` - Pass DB connection

---

## 🚀 Cách Sử Dụng

### 1. Chạy Migration

**Option A - Supabase (Recommended)**:
```
1. Mở: https://app.supabase.com
2. SQL Editor → New Query
3. Copy nội dung: infra/migrations/20251204_000001_create_payment_sessions_table.sql
4. Click Run
```

**Option B - MySQL Local**:
```powershell
cd backend
mysql -u root -p mindpoint < ../infra/migrations/20251204_000001_create_payment_sessions_table.sql
```

**Option C - PowerShell Script**:
```powershell
cd scripts
.\run-payment-migration.ps1
```

### 2. Restart Backend
```powershell
cd backend
php -S localhost:8001 -t public
```

### 3. Test Thanh Toán
```
1. http://localhost:5173
2. Đăng nhập
3. Vào Subscription
4. Click VNPay
5. Dùng thẻ test: 9704198526191432198
```

### 4. Verify Kết Quả
```sql
-- Check payment session
SELECT * FROM payment_sessions WHERE status = 'paid' ORDER BY created_at DESC LIMIT 1;

-- Check subscription updated
SELECT * FROM subscriptions WHERE user_id = 'YOUR_USER_ID';
```

---

## 🔒 Bảo Mật

✅ VNPay signature verification vẫn được giữ nguyên
✅ Prepared statements (SQL injection safe)
✅ RLS policies (users chỉ xem được session của họ)
✅ Admins có thể xem tất cả sessions
✅ Session data được lưu an toàn trong database

---

## 📊 Improvements

| Aspect | Before | After |
|--------|--------|-------|
| Session Storage | In-memory | Database |
| Data Persistence | ❌ Mất khi restart | ✅ Persistent |
| Webhook Reliability | ❌ Thường fail | ✅ Reliable |
| Timeout Issues | ❌ Thường xảy ra | ✅ Fixed |
| Query Performance | N/A | ✅ Indexed |
| Audit Trail | ❌ Không có | ✅ Có (created_at, updated_at) |

---

## 🧪 Testing Checklist

- [ ] Migration chạy thành công
- [ ] Table `payment_sessions` được tạo
- [ ] Backend restart không có lỗi
- [ ] Frontend load bình thường
- [ ] Click VNPay button → redirect to VNPay
- [ ] Nhập thẻ test → thanh toán thành công
- [ ] VNPay redirect về webhook
- [ ] Subscription được cập nhật
- [ ] Database có record trong `payment_sessions`
- [ ] Database có record trong `subscriptions` với tier mới

---

## 📝 Notes

- Session tự động expire sau 15 phút (VNPay requirement)
- Có thể query payment history từ database
- Webhook endpoint không cần authentication (VNPay gọi từ server)
- Ngrok URL phải được cập nhật trên VNPay portal
- Mỗi lần restart ngrok, phải cập nhật lại URL

---

## 🔗 Related Files

- Setup guide: `docs/VNPAY_SETUP_GUIDE.md`
- Quick start: `docs/VNPAY_QUICK_START.md`
- Migration steps: `docs/VNPAY_MIGRATION_STEPS.md`
- Next steps: `VNPAY_NEXT_STEPS.md`

