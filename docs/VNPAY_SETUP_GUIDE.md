# 🔐 Hướng dẫn thiết lập VNPay Sandbox với Ngrok

## 📋 Checklist

### Bước 1: Lấy thông tin từ VNPay Sandbox
1. Truy cập: https://sandbox.vnpayment.vn/merchantv2
2. Đăng nhập tài khoản merchant
3. Vào **Cấu hình** → **Thông tin tài khoản**
4. Copy 2 thông tin:
   - [ ] **TMN Code** (Terminal/Website Code) - VD: `DEMOV2XX`
   - [ ] **Hash Secret** (Secret Key) - VD: `ABCDEFGH...`

### Bước 2: Chạy Ngrok cho Backend

**⚠️ LƯU Ý:** Ngrok free plan chỉ cho 1 tunnel cùng lúc. Stop ngrok cũ nếu đang chạy (Ctrl+C).

```powershell
# Backend PHP chạy ở port 8001
ngrok http 8001
```

**Lưu lại URL ngrok**, VD: `https://abc-xyz-123.ngrok-free.app`

**Frontend sẽ gọi API qua Vite proxy** (đã config sẵn trong vite.config.ts)

### Bước 3: Cập nhật URL trên VNPay Portal
1. Vào https://sandbox.vnpayment.vn/merchantv2
2. **Cấu hình** → **Cấu hình URL**
3. Cập nhật:
   - **IPN URL**: `https://[your-ngrok-url].ngrok-free.app/api/payment/webhook`
   - **Return URL**: `https://[your-ngrok-url].ngrok-free.app/api/payment/webhook`
4. Lưu lại

### Bước 4: Cập nhật file backend/.env

Thay thế các giá trị sau trong `backend/.env`:

```env
# VNPay Sandbox
VNPAY_TMN_CODE=YOUR_TMN_CODE_FROM_STEP_1
VNPAY_HASH_SECRET=YOUR_HASH_SECRET_FROM_STEP_1
VNPAY_RETURN_URL=https://YOUR_NGROK_URL/api/payment/webhook
VNPAY_IPN_URL=https://YOUR_NGROK_URL/api/payment/webhook
VNPAY_GATEWAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
```

**Ví dụ cụ thể:**
```env
VNPAY_TMN_CODE=DEMOV2XX
VNPAY_HASH_SECRET=ABCDEFGHIJKLMNOPQRSTUVWXYZ123456
VNPAY_RETURN_URL=https://abc-xyz-123.ngrok-free.app/api/payment/webhook
VNPAY_IPN_URL=https://abc-xyz-123.ngrok-free.app/api/payment/webhook
VNPAY_GATEWAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
```

### Bước 5: Restart Backend
```powershell
# Nếu đang chạy PHP built-in server
cd backend
php -S localhost:8001 -t public
```

### Bước 6: Test thanh toán

1. Mở frontend: http://localhost:5173
2. Đăng nhập
3. Vào trang **Subscription** (menu hoặc #subscription)
4. Click nút **VNPay** trên gói bất kỳ
5. Sẽ mở tab mới với trang thanh toán VNPay sandbox
6. Dùng thẻ test:
   - **Số thẻ**: `9704198526191432198`
   - **Tên chủ thẻ**: `NGUYEN VAN A`
   - **Ngày phát hành**: `07/15`
   - **Mật khẩu OTP**: `123456`

### Bước 7: Kiểm tra kết quả

- VNPay sẽ redirect về webhook endpoint
- Backend sẽ verify signature và cập nhật subscription
- Check trong Supabase table `subscriptions` để xem user đã được upgrade chưa

---

## 🐛 Troubleshooting

### Lỗi: "Invalid signature"
- Kiểm tra `VNPAY_HASH_SECRET` có đúng không
- Đảm bảo không có khoảng trắng thừa trong .env

### Lỗi: "Unknown transaction"
- Session bị mất (do in-memory storage)
- Restart backend và thử lại

### Lỗi: VNPay không gọi webhook
- Kiểm tra ngrok có đang chạy không
- Kiểm tra URL trên VNPay portal có đúng không
- Xem ngrok web interface: http://127.0.0.1:4040

### Ngrok free plan giới hạn
- Mỗi lần restart ngrok, URL sẽ thay đổi
- Phải cập nhật lại trên VNPay portal
- Cân nhắc upgrade ngrok hoặc dùng localtunnel

---

## 📊 Flow thanh toán

```
User click "VNPay" 
  → Frontend gọi POST /api/payment/create
  → Backend tạo payment URL với signature
  → User redirect tới VNPay sandbox
  → User nhập thông tin thẻ test
  → VNPay xử lý thanh toán
  → VNPay gọi IPN webhook (qua ngrok)
  → Backend verify signature
  → Backend cập nhật subscription
  → User redirect về Return URL
```

---

## 🔗 Links hữu ích

- VNPay Sandbox: https://sandbox.vnpayment.vn/merchantv2
- VNPay Docs: https://sandbox.vnpayment.vn/apis/docs/
- Ngrok Dashboard: https://dashboard.ngrok.com/
- Ngrok Web Interface: http://127.0.0.1:4040

---

## ✅ Checklist hoàn thành

- [ ] Lấy được TMN_CODE và HASH_SECRET từ VNPay
- [ ] Chạy ngrok cho backend (port 8001)
- [ ] Cập nhật IPN URL và Return URL trên VNPay portal
- [ ] Cập nhật backend/.env với thông tin đúng
- [ ] Restart backend PHP server
- [ ] Test thanh toán thành công với thẻ test
- [ ] Verify subscription được cập nhật trong database
