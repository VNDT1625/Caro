# ⚡ VNPay Setup - Quick Start

## 🚀 Các bước thực hiện (5 phút)

### 1. Stop ngrok cũ và chạy lại cho backend
```powershell
# Ctrl+C để stop ngrok hiện tại
# Sau đó chạy:
ngrok http 8001
```

Copy URL ngrok mới, VD: `https://abc-xyz-123.ngrok-free.app`

---

### 2. Lấy credentials từ VNPay Sandbox

Truy cập: https://sandbox.vnpayment.vn/merchantv2

- **TMN Code**: Vào Cấu hình → Thông tin tài khoản
- **Hash Secret**: Cùng trang, copy Secret Key

---

### 3. Cập nhật VNPay Portal

Vào **Cấu hình** → **Cấu hình URL**, điền:

```
IPN URL: https://[your-ngrok-url]/api/payment/webhook
Return URL: https://[your-ngrok-url]/api/payment/webhook
```

Thay `[your-ngrok-url]` bằng URL ngrok ở bước 1.

---

### 4. Cập nhật backend/.env

Mở file `backend/.env`, tìm và sửa:

```env
VNPAY_TMN_CODE=YOUR_TMN_CODE_HERE
VNPAY_HASH_SECRET=YOUR_HASH_SECRET_HERE
VNPAY_RETURN_URL=https://YOUR_NGROK_URL/api/payment/webhook
VNPAY_IPN_URL=https://YOUR_NGROK_URL/api/payment/webhook
```

**Ví dụ:**
```env
VNPAY_TMN_CODE=DEMOV2XX
VNPAY_HASH_SECRET=ABCDEFGHIJKLMNOPQRSTUVWXYZ123456
VNPAY_RETURN_URL=https://abc-xyz-123.ngrok-free.app/api/payment/webhook
VNPAY_IPN_URL=https://abc-xyz-123.ngrok-free.app/api/payment/webhook
```

---

### 5. Restart backend
```powershell
cd backend
php -S localhost:8001 -t public
```

---

### 6. Test thanh toán

1. Mở frontend: http://localhost:5173
2. Đăng nhập
3. Vào trang Subscription
4. Click nút **VNPay**
5. Dùng thẻ test VNPay:
   - Số thẻ: `9704198526191432198`
   - Tên: `NGUYEN VAN A`
   - Ngày: `07/15`
   - OTP: `123456`

---

## ✅ Xong!

Sau khi thanh toán thành công, VNPay sẽ gọi webhook qua ngrok → Backend cập nhật subscription.

## 🔍 Debug

Xem requests tới ngrok: http://127.0.0.1:4040
