# Onboarding Menu Overview Fix

## Problem
The "menuOverview" step in the onboarding tour displayed incorrect emoji and descriptions that didn't match the actual menu in the application.

### Discrepancies Found
**Onboarding (Before):**
- 🛒 Shop - Mua vật phẩm
- 📦 Kho đồ - Xem & trang bị
- ⚔️ Nhiệm vụ - Nhận thưởng
- 🎉 Sự kiện - Phần thưởng đặc biệt

**Actual Menu:**
- 🏯 Shop - Mua vật phẩm
- 🎒 Inventory - Xem & trang bị
- ✨ Quests - Hoàn thành quest
- 🎉 Events - Phần thưởng đặc biệt

## Solution
Updated the `menuOverview` description in all 4 languages to match the actual menu icons and labels.

### Changes Made

**File: `frontend/src/i18n.json`**

#### Vietnamese (vi)
```json
"menuOverview": {
  "title": "Menu chính",
  "description": "Đây là các mục quan trọng:\n• 🏯 Shop - Mua vật phẩm\n• 🎒 Bộ Sưu Tập - Xem & trang bị\n• ✨ Nhiệm Vụ - Hoàn thành quest\n• 🎉 Sự Kiện - Phần thưởng đặc biệt"
}
```

#### English (en)
```json
"menuOverview": {
  "title": "Main menu",
  "description": "Key sections:\n• 🏯 Shop - Buy items\n• 🎒 Inventory - View & equip\n• ✨ Quests - Complete tasks\n• 🎉 Events - Limited-time prizes"
}
```

#### Chinese (zh)
```json
"menuOverview": {
  "title": "主菜单",
  "description": "主要功能：\n• 🏯 商店 - 购买物品\n• 🎒 背包 - 查看和装备\n• ✨ 任务 - 完成任务\n• 🎉 活动 - 限时奖励"
}
```

#### Japanese (ja)
```json
"menuOverview": {
  "title": "メインメニュー",
  "description": "主要セクション：\n• 🏯 ショップ - アイテム購入\n• 🎒 インベントリ - 表示と装備\n• ✨ クエスト - タスク完了\n• 🎉 イベント - 期間限定報酬"
}
```

## Emoji Changes
- Shop: 🛒 → 🏯 (matches actual menu icon)
- Inventory: 📦 → 🎒 (matches actual menu icon)
- Quests: ⚔️ → ✨ (matches actual menu icon)
- Events: 🎉 → 🎉 (no change, already correct)

## Text Updates
- Vietnamese: "Kho đồ" → "Bộ Sưu Tập", "Nhận thưởng" → "Hoàn thành quest"
- English: "Claim rewards" → "Complete tasks"
- Chinese: "领取奖励" → "完成任务"
- Japanese: "報酬を受け取る" → "タスク完了"

## Testing
To verify the fix:
1. Start the onboarding tour
2. Navigate to the "menuOverview" step
3. Verify the emoji and text match the actual menu:
   - 🏯 Shop
   - 🎒 Inventory/Bộ Sưu Tập/背包/インベントリ
   - ✨ Quests/Nhiệm Vụ/任务/クエスト
   - 🎉 Events/Sự Kiện/活动/イベント

## Files Modified
- `frontend/src/i18n.json` (4 language sections updated)

## Impact
- ✅ Onboarding now accurately reflects the actual menu
- ✅ Users see correct emoji and descriptions
- ✅ Consistent across all 4 languages
- ✅ No breaking changes
