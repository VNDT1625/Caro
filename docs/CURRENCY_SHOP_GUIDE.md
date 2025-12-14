# Currency Shop - Nạp Xu & Kim Cương

## Tổng quan

Hệ thống nạp Coin (Xu) và Gem (Kim cương) cho phép người chơi mua virtual currency để sử dụng trong shop mua vật phẩm.

## Truy cập

- URL: `http://localhost:5173/#currency-shop`
- Hoặc click nút "💰 Nạp" trên header

## Các gói nạp

### Coin (Xu)
| Gói | Số lượng | Bonus | Giá (VND) | Giảm giá |
|-----|----------|-------|-----------|----------|
| 100 Xu | 100 | 0 | 10,000 | 0% |
| 500 Xu | 500 | +50 | 45,000 | 10% |
| 1000 Xu | 1000 | +150 | 80,000 | 20% ⭐ |
| 2500 Xu | 2500 | +500 | 180,000 | 25% |
| 5000 Xu | 5000 | +1500 | 320,000 | 30% |

### Gem (Kim cương)
| Gói | Số lượng | Bonus | Giá (VND) | Giảm giá |
|-----|----------|-------|-----------|----------|
| 10 Kim cương | 10 | 0 | 20,000 | 0% |
| 50 Kim cương | 50 | +5 | 90,000 | 10% |
| 100 Kim cương | 100 | +15 | 160,000 | 20% ⭐ |
| 250 Kim cương | 250 | +50 | 360,000 | 25% |
| 500 Kim cương | 500 | +150 | 640,000 | 30% |

⭐ = Gói HOT (featured)

## API Endpoints

### GET /api/currency/packages
Lấy danh sách các gói nạp.

Query params:
- `type`: `coin` hoặc `gem` (optional)

### POST /api/currency/purchase
Tạo giao dịch nạp tiền (VNPay).

Body:
```json
{
  "package_code": "coin_1000"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "pay_url": "https://sandbox.vnpayment.vn/...",
    "txn_ref": "CUR251205123456789012",
    "expires_at": 1733400000
  }
}
```

### POST /api/currency/test
Test mua gói (dev only) - không cần thanh toán thật.

### GET /api/currency/balance
Lấy số dư coin/gem của user.

### GET /api/currency/history
Lấy lịch sử mua của user.

### GET /api/currency/status/{txnRef}
Kiểm tra trạng thái giao dịch.

## Database Schema

### currency_packages
```sql
- id: uuid
- package_code: varchar(50) UNIQUE
- name_vi, name_en: varchar(100)
- currency_type: 'coin' | 'gem'
- amount: integer
- bonus_amount: integer
- price_vnd: integer
- discount_percent: integer
- is_featured: boolean
- is_active: boolean
```

### currency_purchases
```sql
- id: uuid
- user_id: uuid (FK profiles)
- package_id: uuid (FK currency_packages)
- txn_ref: varchar(50) UNIQUE
- currency_type: 'coin' | 'gem'
- amount, bonus_amount, total_amount: integer
- price_vnd: integer
- status: 'pending' | 'paid' | 'failed' | 'refunded'
- vnp_data: jsonb
```

## Setup

1. Chạy migration:
```powershell
.\scripts\run-currency-migration.ps1
```

2. Hoặc chạy SQL trực tiếp trong Supabase SQL Editor:
```
infra/migrations/20251205_000001_create_currency_packages_table.sql
```

3. Start backend:
```bash
cd backend/public && php -S localhost:8001 router.php
```

4. Start frontend:
```bash
cd frontend && npm run dev
```

5. Truy cập: `http://localhost:5173/#currency-shop`

## Test Mode

Trong môi trường dev, có thể dùng nút "Test" để nhận currency ngay mà không cần thanh toán VNPay thật.

## Flow thanh toán

1. User chọn gói → Click "VNPay"
2. Backend tạo payment session → Trả về pay_url
3. User được redirect đến VNPay sandbox
4. Sau khi thanh toán → VNPay callback về `/api/currency/webhook`
5. Backend verify signature → Cộng currency vào profile
6. User được redirect về `/#currency-result`
