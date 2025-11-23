# Hệ thống Rank - Mindpoint Arena

**Phiên bản:** 2.0 (Rebalanced)  
**Ngày cập nhật:** 23/11/2025

---

## 📊 Rank Tiers (Cân bằng lại)

| Rank | Tên Việt | Mindpoint Range | Số trận cần* | % Players | Đặc điểm |
|------|----------|----------------|--------------|-----------|----------|
| 1 | Vô Danh | 0 - 49 | 2-3 trận | 15% | Người mới bắt đầu |
| 2 | Tân Kỳ | 50 - 199 | +6-8 trận | 25% | Học cơ bản |
| 3 | Học Kỳ | 200 - 599 | +16-20 trận | 30% | Hiểu chiến thuật |
| 4 | Kỳ Lão | 600 - 1499 | +36-40 trận | 18% | Thành thạo |
| 5 | Cao Kỳ | 1500 - 2999 | +60-70 trận | 8% | Chuyên nghiệp |
| 6 | Kỳ Thánh | 3000 - 5499 | +100-120 trận | 3% | Cao thủ |
| 7 | Truyền Thuyết | 5500+ | +150-200 trận | 1% | Huyền thoại |

*Ước tính với win rate 60%, trung bình +25 MP/win, -15 MP/loss

---

## 🎯 Mindpoint Calculation Formula

### Base Formula
```typescript
function calculateMindpointChange(
  isWinner: boolean,
  totalMoves: number,
  timeRemaining: number,
  playerRank: string,
  opponentRank: string
): number {
  if (!isWinner) return -15; // Fixed penalty for losing
  
  let points = 20; // Base win reward
  
  // Performance bonuses
  if (totalMoves < 50) points += 10;      // Quick win bonus
  if (timeRemaining > 180) points += 5;   // Time management bonus
  
  // Rank difference modifier
  const rankDiff = opponentRank - playerRank;
  if (rankDiff > 0) {
    points += rankDiff * 5;  // Bonus for beating higher rank
  } else if (rankDiff < 0) {
    points += rankDiff * 3;  // Penalty for beating lower rank
  }
  
  return Math.max(points, 5); // Minimum 5 points
}
```

### Rank Value Mapping
```typescript
const rankValues = {
  'vo_danh': 0,
  'tan_ky': 1,
  'hoc_ky': 2,
  'ky_lao': 3,
  'cao_ky': 4,
  'ky_thanh': 5,
  'truyen_thuyet': 6
}
```

---

## 📈 Example Calculations

### Example 1: Same Rank Match
**Setup:**
- Player: Tân Kỳ (rank=1), MP=120
- Opponent: Tân Kỳ (rank=1), MP=150
- Result: Player wins in 45 moves, 200s remaining

**Calculation:**
```
Base: 20
Quick win: +10 (moves < 50)
Time bonus: +5 (time > 180)
Rank diff: 0 (same rank)
Total: +35 MP
```
**Result:** Player MP: 120 → 155 ✅

---

### Example 2: Beat Higher Rank
**Setup:**
- Player: Học Kỳ (rank=2), MP=250
- Opponent: Kỳ Lão (rank=3), MP=800
- Result: Player wins in 60 moves, 120s remaining

**Calculation:**
```
Base: 20
Quick win: 0 (moves >= 50)
Time bonus: 0 (time < 180)
Rank diff: +1 → +5
Total: +25 MP
```
**Result:** Player MP: 250 → 275 ✅

---

### Example 3: Beat Lower Rank
**Setup:**
- Player: Cao Kỳ (rank=4), MP=2000
- Opponent: Tân Kỳ (rank=1), MP=100
- Result: Player wins in 30 moves, 250s

**Calculation:**
```
Base: 20
Quick win: +10
Time bonus: +5
Rank diff: -3 → -9
Total: 20 + 10 + 5 - 9 = 26 MP
```
**Result:** Player MP: 2000 → 2026 (small gain)

---

### Example 4: Lose to Higher Rank
**Setup:**
- Player: Học Kỳ (rank=2), MP=400
- Opponent: Cao Kỳ (rank=4), MP=2500
- Result: Player loses

**Calculation:**
```
Base: -15 (fixed penalty)
Total: -15 MP
```
**Result:** Player MP: 400 → 385
**Note:** Losing to higher rank is less punishing (no multiplier)

---

### Example 5: Lose to Lower Rank
**Setup:**
- Player: Kỳ Lão (rank=3), MP=1000
- Opponent: Học Kỳ (rank=2), MP=400
- Result: Player loses

**Calculation:**
```
Base: -15 (fixed penalty)
Total: -15 MP
```
**Result:** Player MP: 1000 → 985
**Note:** Same penalty regardless of opponent rank

---

## 🔄 Rank Progression Examples

### Beginner Journey (Vô Danh → Tân Kỳ)
```
Starting: MP=0, Rank=Vô Danh

Match 1: Win (+25 MP) → MP=25
Match 2: Win (+30 MP) → MP=55 ✅ RANK UP to Tân Kỳ!
```
**Time:** ~30 minutes (2 matches)

---

### Intermediate Journey (Tân Kỳ → Học Kỳ)
```
Starting: MP=50, Rank=Tân Kỳ

Matches 1-3: WWL → +25, +30, -15 = +40 → MP=90
Matches 4-6: WWW → +35, +28, +32 = +95 → MP=185
Match 7: Win (+20 MP) → MP=205 ✅ RANK UP to Học Kỳ!
```
**Time:** ~2-3 hours (7 matches, 60% win rate)

---

### Advanced Journey (Học Kỳ → Kỳ Lão)
```
Starting: MP=200, Rank=Học Kỳ

Need: 400 more MP to reach 600
Win rate: 60%
Avg per match: +15 MP (accounting for losses)

Matches needed: 400 / 15 = ~27 matches
Time: 8-10 hours
```

---

## 🎨 Rank Visual Design

### Icons & Colors
```typescript
const rankIcons = {
  'vo_danh': { icon: '🆕', color: '#9CA3AF', gradient: 'linear-gradient(135deg, #9CA3AF, #6B7280)' },
  'tan_ky': { icon: '⭐', color: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)' },
  'hoc_ky': { icon: '🌟', color: '#06B6D4', gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)' },
  'ky_lao': { icon: '💫', color: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
  'cao_ky': { icon: '✨', color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)' },
  'ky_thanh': { icon: '🔥', color: '#EF4444', gradient: 'linear-gradient(135deg, #EF4444, #DC2626)' },
  'truyen_thuyet': { icon: '👑', color: '#FCD34D', gradient: 'linear-gradient(135deg, #FCD34D, #F59E0B)' }
}
```

---

## 🔒 Rank Decay System (Future)

### Inactive Penalty
- **30 days:** -5 MP/day
- **60 days:** -10 MP/day  
- **90 days:** Drop 1 rank tier
- **180 days:** Reset to Vô Danh

**Note:** Currently NOT implemented. Planned for Phase 2.

---

## 📊 Distribution Goals

Target distribution of players across ranks:
```
Vô Danh:       ████████████████ (15%)
Tân Kỳ:        █████████████████████████ (25%)
Học Kỳ:        ██████████████████████████████ (30%)
Kỳ Lão:        ████████████████ (18%)
Cao Kỳ:        ████████ (8%)
Kỳ Thánh:      ███ (3%)
Truyền Thuyết: █ (1%)
```

This creates a healthy pyramid where:
- Majority of players in mid-tiers (Tân Kỳ - Học Kỳ)
- Top tiers feel exclusive and prestigious
- New players can progress quickly to mid-tier

---

## 🎯 Design Philosophy

1. **Easy to Start:** First rank up comes quickly (2-3 wins)
2. **Smooth Mid-Game:** Majority of players will be in Tân Kỳ - Kỳ Lão
3. **Hard to Master:** Top 2 tiers require significant dedication
4. **Fair Matching:** Players matched by similar ELO/Mindpoint
5. **Rewarding Skill:** Quick wins and good time management rewarded
6. **Punish Smurfing:** Lower rewards for beating lower ranks

---

## 🔧 Balancing Notes

### Why these thresholds?
- **50 MP:** Easy first milestone, ~2-3 wins
- **200 MP:** Separates casual from committed players
- **600 MP:** True intermediate players
- **1500 MP:** Serious competitive players
- **3000 MP:** Elite players (top 10%)
- **5500 MP:** Legendary (top 1%)

### Adjustment History
- **v1.0:** Original system (0, 100, 500, 1500, 3000, 5000, 8000)
- **v2.0:** Rebalanced (0, 50, 200, 600, 1500, 3000, 5500)
  - Reason: First rank too hard, top rank too easy
  - Impact: Better distribution, more players in mid-tier

---

## 📱 UI Display Examples

### Profile Display
```
┌─────────────────────────────┐
│  👑 Truyền Thuyết          │
│  MP: 6,250 / ∞              │
│  ████████████████ 100%      │
│  Top 0.5% players           │
└─────────────────────────────┘
```

### Rank Progress Bar
```
Học Kỳ (450/600 MP)
🌟 ████████████░░░░░ 75%
↑ 150 MP to Kỳ Lão
```

### Match Result
```
🎉 VICTORY! +35 MP
Học Kỳ: 450 → 485 MP
↗ 115 MP to next rank
```

---

## 🚀 Implementation Status

- ✅ Database schema updated
- ✅ Calculation function implemented  
- ✅ Rank thresholds rebalanced
- ✅ Auto rank update after match
- ⏳ Rank decay system (planned)
- ⏳ Season reset system (planned)
- ⏳ Rank rewards (titles, items) (planned)

---

**Last updated:** November 23, 2025  
**Version:** 2.0  
**Status:** Active
