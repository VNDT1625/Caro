# Fix Dataset Loading Lag - AI Chat "Cao Nhân"

## Vấn đề gốc
Khi user hỏi "Cao Nhân" (AI chat), hệ thống load dataset từ 13 file parts (~500KB mỗi file, tổng ~6MB). Lag xảy ra ở part 6 trở đi do:

1. **O(n²) complexity trong `pushUnique()`** - Mỗi entry phải check duplicate với tất cả entries đã có
2. **Background load không yield** - Chỉ có 200ms delay giữa các parts, không đủ cho browser xử lý UI
3. **Không có preload** - Dataset chỉ load khi user mở AI chat tab

## Giải pháp đã implement

### 1. Tối ưu `pushUnique()` - O(1) lookup
```typescript
// Trước: O(n) - phải duyệt toàn bộ array
if (!merged.some((e) => normalizeText(e.question) === key)) {
  merged.push(entry)
}

// Sau: O(1) - dùng Map
const seenKeys = new Map<string, boolean>()
if (!seenKeys.has(key)) {
  seenKeys.set(key, true)
  merged.push(entry)
}
```

### 2. Yield to main thread
```typescript
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => resolve(), { timeout: 50 })
    } else {
      setTimeout(resolve, 0)
    }
  })
}

// Process entries in batches
const BATCH_SIZE = 100
for (let i = 0; i < entries.length; i += BATCH_SIZE) {
  const batch = entries.slice(i, i + BATCH_SIZE)
  batch.forEach(pushUnique)
  if (background) await yieldToMain()
}
```

### 3. Preload khi app khởi động
```typescript
// App.tsx
import { preloadDataset } from './lib/caroDataset'

useEffect(() => {
  // Preload AI dataset khi browser rảnh
  preloadDataset()
}, [])
```

### 4. Server-side search API (fallback)
Nếu frontend không load được dataset, có thể gọi server:

```
POST /api/dataset/search
Body: { "query": "luật caro", "language": "vi" }

Response:
{
  "found": true,
  "answer": "...",
  "score": 0.85,
  "matchedText": "luật chơi caro"
}
```

## Files đã thay đổi

1. `frontend/src/lib/caroDataset.ts`
   - Thêm `yieldToMain()` function
   - Tối ưu `pushUnique()` dùng Map
   - Thêm `preloadDataset()`, `isDatasetLoaded()`, `getLoadedEntriesCount()`
   - Thêm `searchDatasetOnServer()` cho server-side fallback
   - Tăng delay giữa background parts từ 200ms lên 300ms

2. `frontend/src/App.tsx`
   - Import và gọi `preloadDataset()` khi app mount

3. `frontend/src/components/chat/HomeChatOverlay.tsx`
   - Sử dụng `isDatasetLoaded()` để check preload status
   - Thêm server-side search fallback khi frontend dataset empty

4. `backend/app/Controllers/DatasetController.php` (mới)
   - Server-side dataset search API
   - `POST /api/dataset/search` - search dataset
   - `GET /api/dataset/stats` - get dataset statistics

5. `backend/routes/api.php`
   - Thêm routes cho DatasetController

## Kết quả mong đợi

- UI không bị freeze khi load dataset
- Dataset được preload sẵn khi user mở AI chat
- Có fallback server-side nếu frontend load fail
- Background load không block main thread

## Test

1. Mở app, đợi vài giây để preload
2. Mở AI chat tab → không lag
3. Hỏi "Cao Nhân" → trả lời nhanh từ cache
4. Nếu frontend fail → tự động fallback server-side
