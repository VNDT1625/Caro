# Design Document

## Overview

Bổ sung tính năng chọn chế độ đấu (game type) và Swap2 opening rule cho Tournament mode (Vạn Môn Tranh Đấu) trong CreateRoom.tsx. Hiện tại Tournament mode chỉ có chọn kiểu đấu (Solo/Theo cặp) mà thiếu các tùy chọn về luật bàn cờ.

## Architecture

Thay đổi chỉ ảnh hưởng đến frontend component CreateRoom.tsx:
- Thêm UI elements cho game type selector trong Tournament mode
- Đảm bảo Swap2 toggle hiển thị đúng trong Tournament mode
- Cập nhật match summary để hiển thị game type và Swap2 status

## Components and Interfaces

### CreateRoom.tsx Changes

```typescript
// Existing matchSettings state - no changes needed to interface
const [matchSettings, setMatchSettings] = useState({
  mode: 'rank' as 'rank' | 'casual' | 'ai' | 'tournament',
  gameType: 'normal' as 'normal' | 'skill' | 'hidden' | 'terrain' | 'pair',
  // ... other fields
  swap2Enabled: true
})
```

### UI Components to Add

1. **Game Type Selector for Tournament Mode**
   - Radio group with 5 options: Normal, Caro Skill, Caro Ẩn, Caro Địa Hình, Caro theo cặp
   - Placed in "Chế Độ & Kiểu Chơi" card when isTournamentMode is true

2. **Swap2 Toggle for Tournament Mode**
   - Checkbox with tooltip
   - Already exists but needs to be verified it's in the right location

## Data Models

No database changes required. The matchSettings object already supports:
- `gameType`: string enum
- `swap2Enabled`: boolean

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Game type state consistency
*For any* game type selection in Tournament mode, the matchSettings.gameType state SHALL equal the selected value immediately after selection.
**Validates: Requirements 1.2**

### Property 2: Swap2 toggle state consistency
*For any* Swap2 toggle action in Tournament mode, the matchSettings.swap2Enabled state SHALL equal the toggled value (true/false) immediately after toggle.
**Validates: Requirements 2.2**

## Error Handling

- No special error handling needed - this is UI state management
- Invalid game type values are prevented by TypeScript type checking

## Testing Strategy

### Unit Tests
- Verify Tournament mode renders game type selector
- Verify Tournament mode renders Swap2 toggle
- Verify default values when entering Tournament mode

### Property-Based Tests
- Use Hypothesis/fast-check to test state consistency for any sequence of game type selections
- Test Swap2 toggle state for any sequence of toggle actions

### Testing Framework
- Vitest for React component testing
- React Testing Library for DOM assertions
