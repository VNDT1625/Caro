# Test Plan: AI Analysis Quota System

## Yêu cầu
| Plan | Analyze/ngày | Chat thông minh/ngày |
|------|--------------|---------------------|
| Free | 1 | 0 |
| Trial | 4 | 10 |
| Pro | 40 | 120 |

## Test Cases

### Case 1: Free User
**Setup:**
1. Mở Supabase Dashboard
2. Tìm profile của bạn trong bảng `profiles`
3. Set: `plan = 'free'`, `trial_expires_at = NULL`, `pro_expires_at = NULL`

**Test Steps:**
1. Refresh trang AI Analysis
2. Chọn 1 trận đấu
3. Click "Analyze" lần 1 → **Expected: OK, phân tích thành công**
4. Click "Analyze" lần 2 (cùng trận hoặc khác trận) → **Expected: Nút disable hoặc báo lỗi "Bạn đã hết lượt..."**
5. Thử click tab "Hỏi AI" và gửi câu hỏi → **Expected: Báo lỗi "Bạn đã hết lượt hỏi thông minh..."**

**Verify:**
- [ ] Lần 1 analyze OK
- [ ] Lần 2 analyze bị chặn
- [ ] Chat bị chặn (0 lượt)
- [ ] UI hiển thị "0/1" cho basic usage

---

### Case 2: Trial User
**Setup:**
1. Set profile: `plan = 'trial'`, `trial_expires_at = '2025-12-31T23:59:59Z'`

**Test Steps:**
1. Refresh trang
2. Analyze 4 lần → **Expected: Tất cả OK**
3. Analyze lần 5 → **Expected: Bị chặn**
4. Chat 10 lần → **Expected: Tất cả OK**
5. Chat lần 11 → **Expected: Bị chặn**

**Verify:**
- [ ] 4 lần analyze OK
- [ ] Lần 5 bị chặn
- [ ] 10 lần chat OK
- [ ] Lần 11 chat bị chặn
- [ ] UI hiển thị Trial badge với số ngày còn lại

---

### Case 3: Pro User
**Setup:**
1. Set profile: `plan = 'pro'`, `pro_expires_at = '2025-12-31T23:59:59Z'`

**Test Steps:**
1. Refresh trang
2. Verify UI hiển thị Pro access
3. Analyze vài lần → **Expected: OK**
4. Chat vài lần → **Expected: OK**

**Quick Test (giảm limit):**
Để test nhanh Pro hết lượt, tạm sửa `useAnalysisState.ts`:
```typescript
const PLAN_LIMITS = {
  // ...
  pro: { basic: 2, pro: 2, ai_qa: 3 } // Giảm để test nhanh
}
```

**Verify:**
- [ ] Pro tier hiển thị đúng
- [ ] Analyze hoạt động
- [ ] Chat hoạt động
- [ ] Khi hết lượt, nút disable

---

### Case 4: Trial Expired
**Setup:**
1. Set profile: `plan = 'trial'`, `trial_expires_at = '2024-01-01T00:00:00Z'` (quá khứ)

**Test Steps:**
1. Refresh trang
2. **Expected: Fallback về Free tier**
3. Chỉ được 1 lần analyze, 0 chat

**Verify:**
- [ ] Fallback về Free đúng
- [ ] Không hiển thị Trial badge

---

## UI Checkpoints

### ControlsBar
- [X] Nút "Basic" hiển thị usage: `X/Y`
- [X] Nút "Pro" hiển thị usage nếu có Pro access
- [X] Nút "Pro" bị mờ (opacity 0.6) nếu không có Pro access
- [X] Nút "Analyze" disable khi `remainingForTier <= 0`
- [X] Trial countdown hiển thị đúng số ngày

### Error Messages
- [X] "Bạn đã hết lượt phân tích hôm nay. Vui lòng chờ ngày mai hoặc nâng cấp."
- [X] "Bạn đã hết lượt hỏi thông minh hôm nay. Vui lòng chờ ngày mai hoặc nâng cấp."
- [X] "Gói hiện tại không cho phép phân tích Pro. Vui lòng nâng cấp."

---

## Code Locations

| Feature | File | Function/Line |
|---------|------|---------------|
| Plan limits | `useAnalysisState.ts` | `PLAN_LIMITS` constant |
| Analyze quota check | `useAnalysisState.ts` | `analyze()` function |
| Chat quota check | `useAnalysisState.ts` | `askQuestionAction()` function |
| Button disable | `ControlsBar.tsx` | `canAnalyze` variable |
| Usage display | `ControlsBar.tsx` | `basicUsageDisplay`, `proUsageDisplay` |

---

## Notes
- Backend chưa enforce quota - đây chỉ là frontend guard
- Quota reset hàng ngày (cần backend implement)
- Cache analysis results để không tốn quota khi xem lại
