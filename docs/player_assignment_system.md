# Player Assignment & Side Selection System

## Overview
Added a complete player assignment system that clearly shows which player controls Black (X) vs White (O), with the ability to swap sides before the game starts.

## Features Implemented

### ✅ Player Side Assignment
Each player is assigned either:
- **Black (X)** - Đi trước (Goes first)
- **White (O)** - Đi sau (Goes second)

### ✅ Side Swap Functionality

#### Swap Button
- **Position**: Above board, centered between players
- **Label**: "🔄 Đổi quân"
- **State**:
  - **Before game starts**: Gold gradient, clickable
  - **After first move**: Gray, disabled
- **Tooltip**: Shows "Không thể đổi quân sau khi bắt đầu" when disabled

#### Swap Logic
```typescript
const handleSwapSides = () => {
  if (gameStarted) return // Locked after first move
  
  setPlayers(prev => [
    { ...prev[0], side: prev[0].side === 'X' ? 'O' : 'X' },
    { ...prev[1], side: prev[1].side === 'X' ? 'O' : 'X' }
  ])
}
```

### ✅ Visual Indicators

#### Player Card Side Indicator
```
Before game:
┌───────────────────────────────┐
│  VôDanh123                    │
│  Cao Kỳ | Elo: 1180          │
│  ┌─────────────────────────┐ │
│  │ ⚫ Quân Đen (Đi trước)   │ │ ← Blue gradient box
│  └─────────────────────────┘ │
└───────────────────────────────┘

After swap:
┌───────────────────────────────┐
│  VôDanh123                    │
│  Cao Kỳ | Elo: 1180          │
│  ┌─────────────────────────┐ │
│  │ ⚪ Quân Trắng (Đi sau)   │ │ ← Red gradient box
│  └─────────────────────────┘ │
└───────────────────────────────┘
```

#### Color Coding
- **Black (X)**: 
  - Border: Blue `rgba(59,130,246,0.4)`
  - Background: Blue gradient `rgba(59,130,246,0.2)`
  - Text: Light blue `#60a5fa`
  
- **White (O)**:
  - Border: Red `rgba(239,68,68,0.4)`
  - Background: Red gradient `rgba(239,68,68,0.2)`
  - Text: Light red `#f87171`

### ✅ Game Flow

#### Phase 1: Setup (Before First Move)
```
1. Both players see their assigned sides
2. "🔄 Đổi quân" button is ENABLED (gold)
3. Header shows: "💡 Nhấn '🔄 Đổi quân' để hoán đổi quân cờ trước khi bắt đầu"
4. Players can click swap button to exchange sides
5. Board shows which side goes first clearly
```

#### Phase 2: Game Started (After First Move)
```
1. First piece placed → gameStarted = true
2. "🔄 Đổi quân" button is DISABLED (gray)
3. Side assignments are LOCKED
4. Turn indicator shows active player
5. Players alternate turns normally
```

#### Phase 3: Game Reset
```
1. Click "↻ Ván mới" button on board
2. gameStarted = false (unlock swap)
3. Sides remain as they were (can swap again)
4. Board clears, turn resets to X
5. Setup phase begins again
```

### ✅ State Management

```typescript
// Room.tsx
const [players, setPlayers] = useState<Player[]>([
  { username: 'VôDanh123', side: 'X', ... },
  { username: 'MinhQuân', side: 'O', ... }
])
const [gameStarted, setGameStarted] = useState(false)

// GameBoard.tsx
const [current, setCurrent] = useState<'X' | 'O'>('X')
const [board, setBoard] = useState<Record<string, string>>({})
```

### ✅ UI Layout

```
┌─────────────────────────────────────────────────────────┐
│         ⚔️ Trận Đấu Cờ Caro                            │
│  💡 Nhấn "🔄 Đổi quân" để hoán đổi...                  │
└─────────────────────────────────────────────────────────┘

        ┌──────────────────┐
        │  🔄 Đổi quân     │  ← Swap button (enabled before game)
        └──────────────────┘

┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│  VôDanh123  │        │             │        │  MinhQuân   │
│  👤 ⚫      │        │   15x15     │        │  👤 ⚪      │
│  [😊]       │        │   Board     │        │  [😊]       │
│             │        │             │        │             │
│ ⚫ Quân Đen  │        │             │        │ ⚪ Quân Trắng│
│ (Đi trước)  │        │             │        │ (Đi sau)    │
└─────────────┘        └─────────────┘        └─────────────┘
   Player 1 (X)           Game Board             Player 2 (O)
```

## Technical Implementation

### Props Added to GameBoard
```typescript
interface GameBoardProps {
  size?: number
  enableForbidden?: boolean
  onMove?: (x, y, player) => void
  onWin?: (winner, chain) => void
  onReset?: () => void  // ← New callback
}
```

### Reset Handler
```typescript
// GameBoard.tsx
const resetGame = useCallback(() => {
  setBoard({})
  setCurrent('X')
  setWinner(null)
  setWinningChain([])
  setLastMove(null)
  setHoverCell(null)
  setForbiddenCells(new Set())
  if (onReset) {
    onReset() // ← Notify parent to unlock swap
  }
}, [onReset])

// Room.tsx
const handleReset = () => {
  setCurrentTurn('X')
  setGameStatus('playing')
  setWinner(null)
  setGameStarted(false) // ← Unlock side selection
}
```

### Move Handler
```typescript
const handleMove = (x: number, y: number, player: 'X' | 'O') => {
  if (!gameStarted) {
    setGameStarted(true) // ← Lock sides after first move
  }
  setCurrentTurn(player === 'X' ? 'O' : 'X')
}
```

## User Experience

### Clear Communication
1. **Visual**: Bold colored boxes show each player's side
2. **Text**: "(Đi trước)" and "(Đi sau)" clarify turn order
3. **Icons**: ⚫ for Black, ⚪ for White
4. **Hint**: Helper text explains swap function
5. **Disabled State**: Gray button shows when swap is locked

### Intuitive Flow
- See assignments immediately
- Easy one-click swap before game
- Automatic lock after first move
- Can swap again after reset

### Error Prevention
- Can't swap during active game
- Disabled button with tooltip explanation
- Visual feedback (gray = disabled)

## Testing Checklist

- [x] Players assigned X and O correctly
- [x] Side indicator shows on player cards
- [x] Swap button enabled before game
- [x] Swap button swaps player sides
- [x] Player avatars and info update correctly
- [x] First move locks swap button
- [x] Swap button shows disabled state
- [x] Reset unlocks swap button
- [x] Turn system works after swap
- [x] Forbidden moves apply to correct player (X)
- [x] Winner detection works for both sides
- [x] No TypeScript errors

## Summary

✅ **Complete player assignment system** with:
- Clear visual indicators (⚫ Black vs ⚪ White)
- Pre-game side swapping ("🔄 Đổi quân")
- Automatic lock after first move
- Reset unlocks swap for next game
- Color-coded player cards (blue vs red)
- Turn order labels "(Đi trước)" and "(Đi sau)"

Players now clearly understand who controls which side and can adjust before the game begins!
