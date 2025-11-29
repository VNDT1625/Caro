# Hướng Dẫn Cấu Hình Reset Password Email

## 📧 Tính Năng Đã Tạo

### 1. Forgot Password Page (`/forgot-password`)
- Form nhập email để gửi link reset password
- Validation email format
- Hiển thị thông báo thành công/lỗi
- Link quay lại đăng nhập

### 2. Reset Password Page (`/reset-password`)
- Form nhập mật khẩu mới và xác nhận
- Validation:
  - Mật khẩu tối thiểu 6 ký tự
  - Xác nhận mật khẩu phải khớp
- Kiểm tra token hợp lệ
- Auto redirect về login sau khi đổi mật khẩu thành công

### 3. Login Page Updates
- Thêm link "Quên mật khẩu?"
- Thêm link "Đăng ký ngay" cho user mới

## 🔧 Cấu Hình Supabase Email

### Bước 1: Cấu Hình SMTP (Production)

1. Truy cập **Supabase Dashboard**
2. Vào **Project Settings** > **Authentication** > **Email Templates**
3. Cấu hình SMTP server (nếu dùng custom email):
   - Host: smtp.gmail.com (hoặc provider khác)
   - Port: 587 (TLS) hoặc 465 (SSL)
   - Username: your-email@gmail.com
   - Password: app-specific password

#### Gmail App Password:
1. Bật 2-Step Verification
2. Vào Security > App passwords
3. Tạo app password mới cho "Mail"
4. Copy password và dùng trong SMTP settings

### Bước 2: Cấu Hình Email Template

Vào **Authentication** > **Email Templates** > **Reset Password**

**Subject**: Khôi phục mật khẩu - MindPoint Arena

**Body (HTML)**:
```html
<h2>🔐 Khôi Phục Mật Khẩu</h2>

<p>Xin chào,</p>

<p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản MindPoint Arena của mình.</p>

<p>Click vào nút bên dưới để đặt lại mật khẩu:</p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{ .ConfirmationURL }}" 
     style="background: linear-gradient(135deg, #22D3EE, #06B6D4); 
            color: white; 
            padding: 12px 32px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: 600;
            display: inline-block;">
    Đặt Lại Mật Khẩu
  </a>
</p>

<p>Hoặc copy link sau vào trình duyệt:</p>
<p style="word-break: break-all; color: #22D3EE;">{{ .ConfirmationURL }}</p>

<p style="color: #999; font-size: 14px; margin-top: 30px;">
  <strong>Lưu ý:</strong> Link này sẽ hết hạn sau 1 giờ.<br>
  Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
</p>

<hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">

<p style="color: #666; font-size: 12px;">
  © 2025 MindPoint Arena. All rights reserved.
</p>
```

### Bước 3: Cấu Hình Redirect URLs

1. Vào **Authentication** > **URL Configuration**
2. Thêm vào **Redirect URLs**:
   ```
   http://localhost:5173/
   http://localhost:5174/
   http://localhost:5175/
   http://localhost:5176/
   https://yourdomain.com/
   ```

**Lưu ý**: Không cần hash trong redirect URL. App.tsx sẽ tự động detect `type=recovery` param và redirect đến `#reset-password`.

### Bước 4: Test Development (Không cần SMTP)

Trong development mode, Supabase sẽ log email links vào console:

1. Mở **Supabase Dashboard**
2. Vào **Logs** > **Auth Logs**
3. Khi user request reset password, click vào log entry
4. Copy **Confirmation URL** từ log
5. Paste vào browser để test

## 🚀 Cách Sử Dụng

### Flow 1: User Quên Mật Khẩu
```
Login Page
  ↓ Click "Quên mật khẩu?"
Forgot Password Page
  ↓ Nhập email
  ↓ Click "Gửi email khôi phục"
Email được gửi ✅
  ↓ User check email
  ↓ Click link trong email (dạng: yourdomain.com/?type=recovery&token=...)
  ↓ App.tsx detect type=recovery
  ↓ Auto redirect to #reset-password
Reset Password Page
  ↓ Nhập mật khẩu mới
  ↓ Confirm password
  ↓ Click "Đặt lại mật khẩu"
Password đã đổi ✅
  ↓ Auto redirect sau 2s
Login Page (đăng nhập với password mới)
```

### Flow 2: Test trong Development
```bash
# 1. Gửi reset password request
User nhập email → Click "Gửi email"

# 2. Check logs trong Supabase Dashboard
Dashboard > Logs > Auth Logs > Xem confirmation URL

# 3. Copy URL và paste vào browser
URL dạng: http://localhost:5173/#reset-password?token=...

# 4. Reset password
Nhập password mới → Submit → Done!
```

## 🔒 Security Features

### Đã Implement:
- ✅ Token expiry (default 1 hour)
- ✅ Email validation (regex check)
- ✅ Password strength (min 6 chars)
- ✅ Password confirmation matching
- ✅ One-time use token (can't reuse)
- ✅ Secure password hashing (Supabase auto)

### Recommendations:
- [ ] Rate limiting (prevent spam)
- [ ] CAPTCHA (prevent bots)
- [ ] Password strength meter
- [ ] Email verification before reset

## 🐛 Troubleshooting

### Email không được gửi
1. Kiểm tra SMTP settings trong Supabase
2. Kiểm tra email có trong bảng `auth.users` không
3. Xem logs trong Supabase Dashboard
4. Kiểm tra spam folder

### Link không hoạt động
1. Kiểm tra redirect URLs đã cấu hình đúng chưa
2. Kiểm tra token chưa expire (1 hour)
3. Clear browser cache và thử lại
4. Kiểm tra hash routing (#reset-password)

### Không thể đổi password
1. Kiểm tra password requirements (min 6 chars)
2. Kiểm tra confirm password matching
3. Kiểm tra console logs để xem error
4. Verify user session valid

## 📱 UI Components

### ForgotPassword.tsx Features:
- Email input với validation
- Loading state button
- Success/Error messages
- Links: Back to login, Sign up

### ResetPassword.tsx Features:
- Password input với validation
- Confirm password input
- Token validation check
- Auto redirect on success
- Error handling for expired tokens

### Login.tsx Updates:
- "Quên mật khẩu?" link
- "Đăng ký ngay" link cho new users

## 🎨 Styling

Tất cả pages đã sử dụng:
- Glass card effect
- Consistent spacing
- Icon prefixes (🔐, 📧, 🔒)
- Color scheme matching app theme
- Responsive design
- Loading states
- Success/Error states

## 🔄 Next Steps (Optional Improvements)

1. **Email Template Customization**
   - Vietnamese language support
   - Branded header/footer
   - Inline CSS styles

2. **Enhanced Security**
   - Add CAPTCHA
   - Rate limiting
   - Password strength meter
   - 2FA support

3. **User Experience**
   - Progress indicators
   - Better error messages
   - Toast notifications
   - Email sent confirmation page

4. **Analytics**
   - Track reset password attempts
   - Monitor success rate
   - Alert on suspicious activity
