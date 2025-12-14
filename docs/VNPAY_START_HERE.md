# 🚀 VNPay Fix - START HERE

## ⚡ Quick Fix (5 phút)

Bạn gặp lỗi "Giao dịch đã quá thời gian chờ thanh toán"? Làm theo các bước này:

### Bước 1: Chạy Migration (1 phút)

**Cách nhanh nhất - Dùng PowerShell Script**:
```powershell
cd scripts
.\run-payment-migration.ps1
```

**Hoặc chạy thủ công**:

Nếu dùng **Supabase**:
1. Mở: https://app.supabase.com
2. SQL Editor → New Query
3. Copy file: `infra/migrations/20251204_000001_create_payment_sessions_table.sql`
4. Paste vào editor
5. Click **Run**

Nếu dùng **MySQL Local**:
```powershell
mysql -u root -p mindpoint < infra/migrations/20251204_000001_create_payment_sessions_table.sql
```

### Bước 2: Restart Backend (1 phút)

```powershell
cd backend
php -S localhost:8001 -t public
```

### Bước 3: Test Thanh Toán (3 phút)

1. Mở: http://localhost:5173
2. Đăng nhập
3. Vào **Subscription**
4. Click nút **VNPay**
5. Nhập thẻ test:
   - Số: `9704198526191432198`
   - Tên: `NGUYEN VAN A`
   - Ngày: `07/15`
   - OTP: `123456`

✅ **Xong!** Thanh toán sẽ thành công

---

## 📚 Tài Liệu Chi Tiết

| File | Nội Dung |
|------|---------|
| `docs/VNPAY_FIX_SUMMARY.md` | Tóm tắt vấn đề & giải pháp |
| `docs/VNPAY_TIMEOUT_FIX.md` | Hướng dẫn chi tiết |
| `docs/VNPAY_MIGRATION_STEPS.md` | Các bước migration |
| `docs/VNPAY_SETUP_GUIDE.md` | Setup từ đầu |
| `docs/VNPAY_QUICK_START.md` | Quick start |

---

## 🔍 Verify Kết Quả

Sau khi test thanh toán, kiểm tra:

**Trên Supabase**:
1. Table Editor → `payment_sessions`
2. Tìm row với `status = 'paid'`
3. Nếu thấy → ✅ Thành công

**Trên MySQL**:
```powershell
mysql -u root -p mindpoint -e "SELECT * FROM payment_sessions WHERE status = 'paid' ORDER BY created_at DESC LIMIT 1;"
```

---

## ❓ FAQ

**Q: Lỗi "Table already exists"?**
A: Migration đã chạy rồi, bỏ qua tiếp tục

**Q: Vẫn bị timeout?**
A: Kiểm tra:
- Ngrok có chạy không?
- URL trên VNPay portal có đúng không?
- Backend restart chưa?

**Q: Làm sao biết thanh toán thành công?**
A: Kiểm tra database hoặc xem subscription tier đã thay đổi chưa

---

## 🆘 Cần Giúp?

1. Xem logs: `backend/storage/supabase_errors.log`
2. Xem ngrok: http://127.0.0.1:4040
3. Kiểm tra backend console output
4. Verify credentials trong `backend/.env`

---

## 📝 Tóm Tắt Thay Đổi

✅ Tạo bảng `payment_sessions` để lưu transaction data
✅ Update `PaymentService` để dùng database thay vì memory
✅ Update `ServiceProvider` để inject database connection
✅ Update `public/index.php` để pass DB connection

**Kết quả**: Payment sessions persistent → VNPay webhook reliable → Không còn timeout

