# Fix AI Analysis Errors - Tóm Tắt

## Vấn Đề Chính
Trang AI Analysis gặp 3 lỗi chính:
1. **Maximum update depth exceeded** - Vòng lặp vô hạn trong React
2. **TypeError: can't access property "timeline", result.timeline is undefined** - Lỗi khi API trả về null
3. **TypeError: can't access property "basic_analysis", usage.daily_usage is undefined** - Lỗi khi usage data không đầy đủ

## Các Fix Đã Thực Hiện

### 1. Fix LanguageContext.tsx - Vòng Lặp Vô Hạn
**Nguyên Nhân:** 
- `setLanguage()` dispatch event `languageChanged`
- Event listener cũng gọi `setLanguageState()` 
- Điều này trigger useEffect lại, tạo vòng lặp

**Giải Pháp:**
- Thêm `useRef` để track language state
- Tách event listener vào useEffect riêng với dependency array rỗng
- Sử dụng ref để so sánh thay vì state trong closure

```typescript
const languageRef = useRef(language)

useEffect(() => {
  languageRef.current = language
}, [language])

const setLanguage = (lang: Language) => {
  if (lang === languageRef.current) return // Early exit
  // ... rest of logic
}

useEffect(() => {
  const handleLanguageChange = (event: Event) => {
    const newLang = (event as CustomEvent).detail as Language
    if (newLang && newLang !== languageRef.current) {
      setLanguageState(newLang)
      languageRef.current = newLang
    }
  }
  window.addEventListener('languageChanged', handleLanguageChange)
  return () => window.removeEventListener('languageChanged', handleLanguageChange)
}, []) // Empty dependency array
```

### 2. Fix useAnalysisState.ts - Vòng Lặp Vô Hạn (refreshUsage)
**Nguyên Nhân:**
- `refreshUsage` có `state.subscriptionTier` trong body
- Dependency array có `[effectiveUserId, state.subscriptionTier, updateState]`
- Khi `state.subscriptionTier` thay đổi, `refreshUsage` được tạo lại
- Điều này trigger useEffect lại

**Giải Pháp:**
- Loại bỏ `state.subscriptionTier` khỏi dependency array
- Lấy giá trị từ state bên trong function thay vì dependency

```typescript
const refreshUsage = useCallback(async () => {
  if (!effectiveUserId) return
  
  try {
    const currentTier = state.subscriptionTier // Get from state inside
    const usage = await getUsage({
      userId: effectiveUserId,
      tier: currentTier
    })
    // ... rest of logic
  } catch (err) {
    console.error('Failed to refresh usage:', err)
  }
}, [effectiveUserId, updateState]) // Removed state.subscriptionTier
```

### 3. Fix useAnalysisState.ts - Undefined Timeline
**Nguyên Nhân:**
- API có thể trả về `null` hoặc object không có `timeline` property
- Code cố gắng truy cập `result.timeline.length` mà không check

**Giải Pháp:**
- Thêm validation trước khi sử dụng result
- Tạo safe variable `const timeline = result.timeline || []`
- Thêm try-catch xung quanh API call

```typescript
let result
try {
  result = await analyzeMatch({...})
} catch (apiErr) {
  console.error('API call failed:', apiErr)
  updateState({ analyzing: false, error: 'Lỗi kết nối' })
  return
}

if (!result || typeof result !== 'object') {
  updateState({ analyzing: false, error: 'Không nhận được kết quả' })
  return
}

const timeline = result.timeline || []
// ... use timeline safely
```

### 4. Fix useAnalysisState.ts - Undefined daily_usage
**Nguyên Nhân:**
- API trả về `usage.daily_usage` có thể là `undefined`
- Code cố gắng truy cập `usage.daily_usage.basic_analysis` mà không check

**Giải Pháp:**
- Tạo safe variables trước khi truy cập
- Sử dụng nullish coalescing operator

```typescript
const dailyUsageData = usage.daily_usage || {}
const dailyRemainingData = usage.daily_remaining || {}

updateState({
  dailyUsage: {
    basic: dailyUsageData.basic_analysis || 0,
    pro: dailyUsageData.pro_analysis || 0,
    replay: dailyUsageData.replay || 0,
    ai_qa: dailyUsageData.ai_qa || 0
  },
  // ... rest
})
```

### 5. Fix useAnalysisState.ts - Auto-select Match Loop
**Nguyên Nhân:**
- useEffect dependency array có `state.matches` (entire array)
- Mỗi lần state update, array reference thay đổi
- Điều này trigger useEffect lại

**Giải Pháp:**
- Sử dụng `state.matches.length` thay vì `state.matches`

```typescript
useEffect(() => {
  if (state.matches.length > 0 && !state.selectedMatchId) {
    selectMatch(state.matches[0].id)
  }
}, [state.matches.length, state.selectedMatchId, selectMatch])
```

### 6. Thêm Mock Data cho Development
**Mục Đích:** Cho phép test khi Python AI service không chạy

**Giải Pháp:**
- Thêm `generateMockAnalysisResult()` function
- Thêm `VITE_USE_MOCK_ANALYSIS` env variable
- Sửa `analyzeMatch()` để sử dụng mock data khi enabled

```typescript
// frontend/.env
VITE_USE_MOCK_ANALYSIS=true

// analysisApi.ts
if (USE_MOCK_DATA) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(generateMockAnalysisResult(tier))
    }, 1000)
  })
}
```

## Kết Quả
- ✅ Không còn "Maximum update depth exceeded" warning
- ✅ Không còn "can't access property" errors
- ✅ Component render thành công
- ✅ Mock data cho phép test mà không cần Python service
- ✅ Tất cả files compile không có lỗi

## Files Đã Sửa
1. `frontend/src/contexts/LanguageContext.tsx`
2. `frontend/src/hooks/useAnalysisState.ts`
3. `frontend/src/lib/analysisApi.ts`
4. `frontend/.env`

## Testing
Để test:
1. Đảm bảo `VITE_USE_MOCK_ANALYSIS=true` trong `.env`
2. Mở trang AI Analysis
3. Chọn một trận đấu
4. Click "Phân tích" button
5. Kết quả mock sẽ hiển thị sau 1 giây
