# MindPoint Arena — PHP layout

Dự án MindPoint Arena có thể triển khai backend bằng PHP (nhất là khi bạn hoặc team quen PHP). PHP phù hợp cho web realtime khi dùng kết hợp với:
- Frameworks: Laravel (khuyến nghị) hoặc Symfony
- Realtime: Pusher, Socket.IO (via Node adapter) hoặc Laravel WebSockets
- DB: MySQL/PostgreSQL; Redis cho presence/matchmaking queues

Tôi đã thêm cấu trúc backend PHP skeleton trong `backend/` để bạn bắt đầu.

Short start (backend):
- Cài Composer
- Chạy local dev: `php -S localhost:8000 -t backend/public` (tạm thời)

Tiếp theo: bạn có thể cài Laravel vào `backend/` bằng `composer create-project laravel/laravel backend` nếu muốn dùng full framework.

## Hướng dẫn nhanh cho frontend (cài Node/npm và chạy dev)

Nếu bạn thấy lỗi giống “'npm' is not recognized”, nghĩa là Node.js (và npm) chưa được cài hoặc chưa có trong PATH. Dưới đây là các bước để cài và chạy frontend dev server (Windows, PowerShell):

1) Cài Node.js bằng winget (nhanh nhất nếu có winget):

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

Sau khi cài xong, đóng PowerShell rồi mở lại, kiểm tra:

```powershell
node -v
npm -v
```

2) Hoặc cài thủ công: tải bản LTS từ https://nodejs.org và chạy installer (chọn Add to PATH).

3) Khi `node` và `npm` đã hoạt động, cài dependencies và chạy frontend:

```powershell
cd C:\PJ\caro\frontend
npm install
npm run dev
```

4) Lưu ý trước khi chạy:
- Copy `frontend/.env.example` → `frontend/.env` và điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` (hoặc để trống tạm thời nếu chỉ dev giao diện).
- Nếu TypeScript báo lỗi về `import.meta.env`, đã có file `frontend/src/env.d.ts` để khai báo types.

5) Nếu bạn muốn scaffold Laravel backend tiếp theo, xem `backend/README.md` để biết cách kết nối DB/Supabase.

Nếu gặp lỗi cụ thể khi chạy `npm install` hoặc `npm run dev`, copy nguyên văn lỗi vào đây và tôi sẽ hướng dẫn sửa.