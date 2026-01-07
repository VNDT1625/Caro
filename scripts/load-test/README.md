# Load Testing Tool - MindPoint Arena

Tool kiểm tra khả năng chịu tải của hệ thống với nhiều người dùng đồng thời.

## Cài đặt

```bash
cd scripts/load-test
pip install -r requirements.txt
```

## Chạy Test

### 1. Khởi động services trước
```bash
# Terminal 1: PHP Backend
cd backend/public && php -S localhost:8001 router.php

# Terminal 2: Socket Server  
cd server && npm start

# Terminal 3: AI Service (optional)
cd ai && uvicorn main:app --port 8004
```

### 2. Chạy Locust

**Cách 1: Web UI (khuyến nghị)**
```bash
cd scripts/load-test
locust -f locustfile.py --host=http://localhost:8001
```
Mở browser: http://localhost:8089

**Cách 2: Command line**
```bash
# Test 100 users, spawn 10 users/second, run 60 seconds
locust -f locustfile.py --host=http://localhost:8001 --users 100 --spawn-rate 10 --run-time 60s --headless
```

**Cách 3: PowerShell script**
```powershell
.\run-load-test.ps1 -Users 50 -SpawnRate 5 -Duration 60
```

## Test Classes

| Class | Mô tả | Endpoints |
|-------|-------|-----------|
| `APIUser` | Test PHP Backend API | /api/health, /api/rooms, /api/leaderboard, /api/skills, /api/items |
| `SocketUser` | Test Socket.IO connections | join_room, chat_message, make_move |
| `CombinedUser` | Full user flow simulation | Browse, Profile, Shop, Analysis |

## Kết quả

Locust hiển thị:
- **RPS** (Requests Per Second): Số request/giây hệ thống xử lý được
- **Response Time**: Thời gian phản hồi (median, 95%, 99%)
- **Failures**: Số request thất bại
- **Users**: Số user đang active

## Đánh giá

| Metric | Tốt | Trung bình | Cần cải thiện |
|--------|-----|------------|---------------|
| Response Time (p95) | < 200ms | 200-500ms | > 500ms |
| Failure Rate | < 1% | 1-5% | > 5% |
| RPS (per user) | > 2 | 1-2 | < 1 |

## Lưu ý

- Chạy test trên máy local sẽ bị giới hạn bởi resources của máy
- Để test chính xác, nên deploy lên server staging
- Socket test cần Socket server chạy ở port 8000
- AI Analysis test cần AI service chạy ở port 8004
