# Hệ thống Rank V2 - MindPoint

## 1. Cấu trúc Rank

### Các bậc chính
```
Vô Danh → Tân Kỳ → Học Kỳ → Kỳ Lão → Cao Kỳ → Tam Kỳ → Đệ Nhị → Vô Đối
```

### Phân nhánh chi tiết (Giai đoạn dưới: Vô Danh → Học Kỳ)

Mỗi bậc chia thành 3 cấp × 3 tier = 9 sub-ranks:

```
Vô Danh:
├── Sơ Kỳ: 1 → 2 → 3
├── Trung Kỳ: 1 → 2 → 3
└── Cao Kỳ: 1 → 2 → 3

Tân Kỳ:
├── Sơ Kỳ: 1 → 2 → 3
├── Trung Kỳ: 1 → 2 → 3
└── Cao Kỳ: 1 → 2 → 3

Học Kỳ:
├── Sơ Kỳ: 1 → 2 → 3
├── Trung Kỳ: 1 → 2 → 3
├── Cao Kỳ: 1 → 2 → 3
└── Vượt Cấp: Leaderboard (tính điểm theo giai đoạn cao)
```

### Giai đoạn cao (Kỳ Lão → Vô Đối)
- Tập trung điểm cá nhân + Leaderboard
- Không chia sub-rank, chỉ có điểm tích lũy

---

## 2. Công thức tính điểm

### Giai đoạn dưới (Vô Danh → Học Kỳ Cao Kỳ 3)

```
Điểm = (Điểm_Lượt + Điểm_Thời_Gian + Điểm_Rank + 5) × Kết_Quả
```

**Range:** 20 → 35 điểm

#### Điểm theo lượt (số nước đi trong ván)
| Điều kiện | Điểm |
|-----------|------|
| Lượt < 10 | 10 |
| Lượt < 20 | 7 |
| Lượt ≥ 20 | 5 |

#### Điểm chênh lệch thời gian (tổng thời gian suy nghĩ)
| Điều kiện | Điểm |
|-----------|------|
| Chênh > gấp đôi | 10 |
| Chênh > ×1.5 | 7 |
| Còn lại | 5 |

#### Điểm theo Rank đối thủ
| Rank đối thủ | Điểm |
|--------------|------|
| Vô Danh | 10 |
| Tân Kỳ | 7 |
| Học Kỳ | 5 |

#### Kết quả
| Kết quả | Hệ số |
|---------|-------|
| Thắng | +1 |
| Thua | -1 |

**Ví dụ:**
- Thắng nhanh (8 lượt), thời gian gấp đôi đối thủ, đối thủ Vô Danh:
  - (10 + 10 + 10 + 5) × 1 = **+35 điểm**
- Thua chậm (25 lượt), thời gian ngang, đối thủ Học Kỳ:
  - (5 + 5 + 5 + 5) × (-1) = **-20 điểm**

---

### Giai đoạn cao (Học Kỳ Vượt Cấp → Vô Đối)

```
Điểm = (Điểm_Lượt + Điểm_Thời_Gian + 5) × Hệ_Số_Rank
```

#### Hệ số chênh lệch Rank

| Tình huống | Thắng | Thua |
|------------|-------|------|
| Player cao hơn đối thủ | ×0.5 | ×(-1.5) |
| Player thấp hơn đối thủ | ×1.5 | ×(-0.5) |

**Ví dụ:**
- Cao Kỳ thắng Kỳ Lão (cao hơn): (7 + 7 + 5) × 0.5 = **+9.5 điểm**
- Kỳ Lão thắng Cao Kỳ (thấp hơn): (7 + 7 + 5) × 1.5 = **+28.5 điểm**
- Cao Kỳ thua Kỳ Lão (cao hơn): (7 + 7 + 5) × (-1.5) = **-28.5 điểm**
- Kỳ Lão thua Cao Kỳ (thấp hơn): (7 + 7 + 5) × (-0.5) = **-9.5 điểm**

---

## 3. Điều kiện lên Rank

### Giai đoạn dưới
- **100 điểm** = lên 1 nhánh (sub-rank)
- Điểm bắt đầu từ 0 cho người mới

**Ví dụ tiến trình:**
```
Vô Danh Sơ Kỳ 1 (0đ) → +100đ → Vô Danh Sơ Kỳ 2
Vô Danh Sơ Kỳ 3 → +100đ → Vô Danh Trung Kỳ 1
Vô Danh Cao Kỳ 3 → +100đ → Tân Kỳ Sơ Kỳ 1
```

### Giai đoạn cao
- Điểm tích lũy liên tục
- Leaderboard xếp hạng theo điểm

---

## 4. Matchmaking

- Ưu tiên ghép rank ngang hoặc hơi thấp hơn
- ELO range: ±200 (có thể mở rộng nếu queue lâu)

---

## 5. Decay System (Hạ rank theo mùa)

### Thông số
- **Mùa:** 3-4 tháng
- **Thước đo:** số trận đã chơi trong mùa (matches_played)

### Công thức Decay
```
Decay = (P - B) × base_decay_pct[rank] × activity_multiplier
P' = max(B, P - Decay)
```

Trong đó:
- P = điểm hiện tại
- B = điểm tối thiểu để giữ rank (rank floor)
- P' = điểm sau decay

### base_decay_pct theo Rank
| Rank | Decay % |
|------|---------|
| Vô Danh | 0% |
| Tân Kỳ | 20% |
| Học Kỳ | 18% |
| Kỳ Lão | 15% |
| Cao Kỳ | 12% |
| Tam Kỳ | 10% |
| Đệ Nhị | 8% |
| Vô Đối | 5% |

### activity_multiplier theo số trận
| Số trận trong mùa | Multiplier |
|-------------------|------------|
| ≥ 20 trận | 0.0 (không decay) |
| 10-19 trận | 0.5 (decay giảm nửa) |
| 1-9 trận | 1.0 (decay đầy đủ) |
| 0 trận | 1.5 (penalty tăng) |

### Soft-demotion (Bảo vệ mềm)
- Nếu decay đưa xuống rank thấp hơn → gắn cờ "soft-demoted"
- Có 1 mùa probation (hoặc 14 ngày) để lấy lại điểm
- Nếu sau probation vẫn dưới ngưỡng → rớt chính thức

### Ví dụ Decay
Cao Kỳ, floor B = 2400, P = 2600, base_decay = 12%:
- 0 trận: (2600-2400) × 0.12 × 1.5 = 36 → P' = 2564
- 15 trận: (2600-2400) × 0.12 × 0.5 = 12 → P' = 2588
- 20+ trận: không decay → P' = 2600

---

## 6. Database Schema cần cập nhật

### profiles table
```sql
ALTER TABLE profiles ADD COLUMN rank_tier VARCHAR DEFAULT 'so_ky';  -- so_ky, trung_ky, cao_ky, vuot_cap
ALTER TABLE profiles ADD COLUMN rank_level INTEGER DEFAULT 1;       -- 1, 2, 3
ALTER TABLE profiles ADD COLUMN season_matches INTEGER DEFAULT 0;   -- số trận trong mùa
ALTER TABLE profiles ADD COLUMN soft_demoted BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN soft_demoted_at TIMESTAMP;
```

### seasons table (mới)
```sql
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_number INTEGER NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT false,
  decay_processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);
```

### rank_decay_logs table (mới)
```sql
CREATE TABLE rank_decay_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id),
  season_id UUID REFERENCES seasons(id),
  pre_points INTEGER NOT NULL,
  post_points INTEGER NOT NULL,
  matches_played INTEGER NOT NULL,
  multiplier DECIMAL NOT NULL,
  decay_amount INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

---

## 7. So sánh với hệ thống cũ

| Aspect | Cũ | Mới |
|--------|-----|-----|
| Ranks | 7 bậc đơn giản | 8 bậc + sub-ranks |
| Tính điểm | Base + bonus cố định | Công thức động theo lượt/thời gian |
| Lên rank | Theo ngưỡng MP | 100đ/sub-rank |
| Decay | Không có | Có, theo mùa |
| Giai đoạn | Không phân biệt | Dưới vs Cao |

---

## 8. Files đã tạo/cập nhật

### Backend Services
- `backend/app/Services/RankSystemV2Service.php` - Logic tính điểm và rank mới
- `backend/app/Services/ScoringEngineV2Service.php` - Scoring engine sử dụng V2

### Database Migrations
- `infra/migrations/20251206_000010_rank_system_v2.sql` - Schema mới

### Cần làm tiếp
1. Cập nhật `SeriesManagerService` để sử dụng `ScoringEngineV2Service`
2. Tạo cron job để chạy decay cuối mùa
3. Cập nhật frontend hiển thị sub-ranks
4. Tạo admin panel để quản lý seasons và config
