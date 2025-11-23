# Hướng dẫn chạy Server và sửa lỗi

## ✅ ĐÃ SỬA CÁC LỖI:

### 1. **X đánh O không thấy** - ✅ FIXED
- Thêm retry mechanism (3 lần) khi sync game state thất bại
- Thêm error notification để user biết khi có vấn đề
- Optimistic update vẫn giữ nguyên để UX mượt mà

### 2. **Chat không hoạt động** - ✅ FIXED
- Tích hợp `useChat` hook vào InMatch.tsx
- Thêm chat API endpoints vào `server/index.js`:
  - `GET /api/chat/history` - Lấy lịch sử chat
  - `POST /api/chat/send` - Gửi tin nhắn
- Chat messages giờ lưu vào database `chat_messages`
- Realtime sync qua Supabase realtime

### 3. **CORS errors** - ✅ FIXED
- Thêm CORS middleware vào server
- Cho phép tất cả origins (dev mode)

## 🚀 CÁCH CHẠY SERVER:

### Bước 1: Cài đặt dependencies (nếu chưa)
```powershell
cd C:\PJ\caro\server
npm install
```

### Bước 2: Cấu hình .env
File `server/.env` đã được tạo. Bạn cần:
1. Lấy **SUPABASE_SERVICE_KEY** từ Supabase Dashboard:
   - Vào https://supabase.com/dashboard
   - Chọn project của bạn
   - Settings → API → "service_role" key (secret)
   - Copy và thay thế `YOUR_SERVICE_ROLE_KEY_HERE` trong `.env`

### Bước 3: Chạy server
```powershell
cd C:\PJ\caro\server
npm start
```

Server sẽ chạy tại **http://localhost:3000**

### Bước 4: Cập nhật VITE_API_URL (nếu cần)
Frontend đã được config để gọi `http://localhost:8000` nhưng server chạy port `3000`.

**Option 1: Đổi port server thành 8000** (khuyến nghị)
```env
# server/.env
PORT=8000
```

**Option 2: Đổi frontend config**
```env
# frontend/.env
VITE_API_URL=http://localhost:3000
```

### Bước 5: Khởi động lại frontend
```powershell
cd C:\PJ\caro\frontend
npm run dev
```

## 🧪 KIỂM TRA:

1. **Kiểm tra server đã chạy:**
   - Mở http://localhost:8000 (hoặc 3000) trong browser
   - Nếu thấy trang trống hoặc JSON response → server OK

2. **Test realtime:**
   - Mở 2 tab browser
   - Đăng nhập 2 accounts khác nhau
   - Tạo room và join
   - X đánh 1 nước → O phải thấy ngay lập tức

3. **Test chat:**
   - Trong room, click icon chat (💬)
   - Gõ tin nhắn và gửi
   - Tab còn lại phải thấy tin nhắn xuất hiện

## ⚠️ LƯU Ý:

- Server PHẢI chạy trước khi test chat
- Nếu vẫn lỗi CORS, check lại port trong `.env` files
- Console log sẽ hiện rõ lỗi nếu có
- Chat messages được lưu vào database, không bị mất khi refresh

## 🐛 NẾU VẪN CÓ LỖI:

1. Check console log ở cả frontend và server
2. Verify Supabase credentials trong `.env`
3. Verify service_role key có quyền đọc/ghi `chat_messages` table
4. Check RLS policies cho `chat_messages` table (có thể cần disable tạm thời để test)
