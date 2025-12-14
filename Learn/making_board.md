# Hướng Dẫn Tạo Bàn Cờ Caro (Gomoku) với React

Tài liệu này hướng dẫn cách tạo bàn cờ Caro từ đầu, dành cho sinh viên mới bắt đầu học lập trình web.

## Mục Lục
1. [Khái niệm cơ bản](#1-khái-niệm-cơ-bản)
2. [Cấu trúc dữ liệu bàn cờ](#2-cấu-trúc-dữ-liệu-bàn-cờ)
3. [Vẽ bàn cờ bằng CSS Grid](#3-vẽ-bàn-cờ-bằng-css-grid)
4. [Xử lý click để đánh quân](#4-xử-lý-click-để-đánh-quân)
5. [Code mẫu hoàn chỉnh](#5-code-mẫu-hoàn-chỉnh)

---

## 1. Khái niệm cơ bản

### State (Trạng thái)
- **State** là dữ liệu mà component (thành phần giao diện) cần nhớ và có thể thay đổi
- Khi state thay đổi, React tự động vẽ lại giao diện
- Ví dụ: trạng thái bàn cờ (ô nào có quân, ô nào trống)

### CSS Grid
- **Grid** là cách bố trí các phần tử thành lưới (hàng và cột)
- Dùng để tạo bàn cờ 15x15 ô vuông đều nhau
- `gridTemplateColumns: repeat(15, 1fr)` = chia thành 15 cột bằng nhau

### Event Handler (Xử lý sự kiện)
- **onClick** là hàm được gọi khi người dùng click vào phần tử
- Dùng để xử lý khi người chơi click vào ô cờ

---

## 2. Cấu trúc dữ liệu bàn cờ

### Cách 1: Mảng 2 chiều (2D Array)
```typescript
// Tạo bàn cờ 15x15, mỗi ô ban đầu là null (trống)
const board = Array.from({ length: 15 }, () => 
  Array(15).fill(null)
)

// Truy cập ô tại vị trí (x=7, y=7):
board[7][7] // = null (trống), 'X' (đen), hoặc 'O' (trắng)
```

**Giải thích:**
- `Array.from({ length: 15 }, ...)` = tạo mảng có 15 phần tử
- `Array(15).fill(null)` = tạo mảng 15 phần tử, tất cả đều là `null`
- Kết quả: mảng 15 hàng, mỗi hàng có 15 ô

### Cách 2: Object với key là tọa độ
```typescript
// Bàn cờ rỗng
const board = {}

// Đánh quân X tại vị trí (7, 7):
board['7_7'] = 'X'

// Kiểm tra ô (7, 7) có quân không:
if (board['7_7']) {
  console.log('Ô này đã có quân')
}
```

**Ưu điểm:** Dễ kiểm tra ô trống, tiết kiệm bộ nhớ khi bàn cờ còn ít quân.

---

## 3. Vẽ bàn cờ bằng CSS Grid

### Bước 1: Tạo container (khung chứa) bàn cờ
```tsx
<div style={{
  display: 'grid',                              // Bật chế độ grid
  gridTemplateColumns: 'repeat(15, 1fr)',       // 15 cột bằng nhau
  width: 600,                                   // Chiều rộng 600px
  height: 600,                                  // Chiều cao 600px
  background: 'linear-gradient(135deg, #d4a574, #c49563)', // Màu gỗ
  borderRadius: 8,                              // Bo góc
}}>
  {/* Các ô cờ sẽ được render ở đây */}
</div>
```

**Giải thích:**
- `display: 'grid'` = sử dụng CSS Grid layout
- `gridTemplateColumns: 'repeat(15, 1fr)'` = chia thành 15 cột, mỗi cột chiếm 1 phần bằng nhau (1fr = 1 fraction)
- `linear-gradient` = màu chuyển từ `#d4a574` sang `#c49563` theo góc 135 độ

### Bước 2: Vẽ đường kẻ ô vuông bằng SVG
```tsx
<svg width="100%" height="100%" style={{ position: 'absolute' }}>
  {/* Vẽ 16 đường dọc (tạo 15 cột) */}
  {Array.from({ length: 16 }).map((_, i) => (
    <line
      key={`v${i}`}
      x1={`${i * (100 / 15)}%`}   // Điểm bắt đầu X
      y1="0%"                      // Điểm bắt đầu Y (trên cùng)
      x2={`${i * (100 / 15)}%`}   // Điểm kết thúc X
      y2="100%"                    // Điểm kết thúc Y (dưới cùng)
      stroke="#8b6f47"             // Màu đường kẻ
      strokeWidth="1"              // Độ dày đường kẻ
    />
  ))}
  
  {/* Vẽ 16 đường ngang (tạo 15 hàng) */}
  {Array.from({ length: 16 }).map((_, i) => (
    <line
      key={`h${i}`}
      x1="0%"
      y1={`${i * (100 / 15)}%`}
      x2="100%"
      y2={`${i * (100 / 15)}%`}
      stroke="#8b6f47"
      strokeWidth="1"
    />
  ))}
</svg>
```

**Giải thích:**
- SVG (Scalable Vector Graphics) = định dạng vẽ hình vector
- `<line>` = vẽ đường thẳng từ điểm (x1, y1) đến điểm (x2, y2)
- `100 / 15 = 6.67%` = mỗi ô chiếm 6.67% chiều rộng/cao
- 16 đường kẻ tạo ra 15 ô (đường đầu + đường cuối + 14 đường giữa)

### Bước 3: Render các ô cờ
```tsx
{board.map((row, y) =>
  row.map((cell, x) => (
    <div
      key={`${x}-${y}`}
      onClick={() => handleClick(x, y)}
      style={{
        display: 'flex',
        alignItems: 'center',      // Căn giữa theo chiều dọc
        justifyContent: 'center',  // Căn giữa theo chiều ngang
        cursor: 'pointer',         // Con trỏ hình bàn tay khi hover
      }}
    >
      {/* Nếu ô có quân, vẽ quân cờ */}
      {cell && (
        <div style={{
          width: '85%',
          height: '85%',
          borderRadius: '50%',     // Hình tròn
          background: cell === 'X'
            ? 'radial-gradient(circle at 35% 35%, #666, #000)'  // Quân đen
            : 'radial-gradient(circle at 35% 35%, #fff, #ccc)', // Quân trắng
        }} />
      )}
    </div>
  ))
)}
```

**Giải thích:**
- `board.map()` = lặp qua từng hàng của bàn cờ
- `row.map()` = lặp qua từng ô trong hàng
- `key={...}` = React cần key duy nhất để theo dõi từng phần tử
- `radial-gradient` = màu chuyển từ tâm ra ngoài, tạo hiệu ứng 3D cho quân cờ

---

## 4. Xử lý click để đánh quân

### Bước 1: Tạo state cho bàn cờ và lượt chơi
```tsx
import { useState } from 'react'

function GameBoard() {
  // State bàn cờ: mảng 2D, mỗi ô là null/'X'/'O'
  const [board, setBoard] = useState(
    Array.from({ length: 15 }, () => Array(15).fill(null))
  )
  
  // State lượt chơi: 'X' đi trước
  const [currentPlayer, setCurrentPlayer] = useState('X')
  
  // ... phần còn lại
}
```

**Giải thích:**
- `useState(initialValue)` = tạo state với giá trị ban đầu
- `[board, setBoard]` = `board` là giá trị hiện tại, `setBoard` là hàm để thay đổi
- Khi gọi `setBoard(newValue)`, React sẽ vẽ lại giao diện với giá trị mới

### Bước 2: Hàm xử lý khi click vào ô
```tsx
const handleClick = (x, y) => {
  // Kiểm tra ô đã có quân chưa
  if (board[y][x] !== null) {
    console.log('Ô này đã có quân!')
    return // Không làm gì cả
  }
  
  // Tạo bản sao bàn cờ (QUAN TRỌNG: không sửa trực tiếp state)
  const newBoard = board.map(row => [...row])
  
  // Đặt quân vào ô được click
  newBoard[y][x] = currentPlayer
  
  // Cập nhật state bàn cờ
  setBoard(newBoard)
  
  // Đổi lượt chơi
  setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
}
```

**Giải thích:**
- `board[y][x]` = truy cập ô tại hàng y, cột x
- `board.map(row => [...row])` = tạo bản sao sâu (deep copy) của mảng
  - **Tại sao cần bản sao?** React chỉ vẽ lại khi phát hiện state thay đổi. Nếu sửa trực tiếp `board[y][x] = 'X'`, React không biết có thay đổi.
- `currentPlayer === 'X' ? 'O' : 'X'` = nếu đang là X thì đổi sang O, ngược lại

### Bước 3: Gắn hàm xử lý vào ô cờ
```tsx
<div
  onClick={() => handleClick(x, y)}  // Gọi handleClick với tọa độ (x, y)
  style={{ cursor: 'pointer' }}
>
  {/* ... */}
</div>
```

**Giải thích:**
- `onClick={() => handleClick(x, y)}` = khi click, gọi hàm `handleClick` với tọa độ của ô đó
- `() => ...` là arrow function (hàm mũi tên), cách viết ngắn gọn của function

---

## 5. Code mẫu hoàn chỉnh

```tsx
import React, { useState } from 'react'

const BOARD_SIZE = 15  // Kích thước bàn cờ 15x15

export default function SimpleBoard() {
  // ===== STATE =====
  // Bàn cờ: mảng 2D, mỗi ô là null (trống), 'X' (đen), hoặc 'O' (trắng)
  const [board, setBoard] = useState(
    Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null))
  )
  
  // Lượt chơi hiện tại: 'X' đi trước
  const [currentPlayer, setCurrentPlayer] = useState('X')
  
  // ===== XỬ LÝ CLICK =====
  const handleClick = (x, y) => {
    // Bỏ qua nếu ô đã có quân
    if (board[y][x] !== null) return
    
    // Tạo bản sao bàn cờ và đặt quân
    const newBoard = board.map(row => [...row])
    newBoard[y][x] = currentPlayer
    
    // Cập nhật state
    setBoard(newBoard)
    setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
  }
  
  // ===== TÍNH TOÁN KÍCH THƯỚC =====
  const boardPixelSize = 600  // Kích thước bàn cờ (pixel)
  const cellSize = boardPixelSize / BOARD_SIZE  // Kích thước mỗi ô
  
  // ===== RENDER GIAO DIỆN =====
  return (
    <div style={{ padding: 20 }}>
      {/* Hiển thị lượt chơi */}
      <div style={{ marginBottom: 10, fontSize: 18 }}>
        Lượt: {currentPlayer === 'X' ? 'Đen (X)' : 'Trắng (O)'}
      </div>
      
      {/* Bàn cờ */}
      <div style={{
        width: boardPixelSize,
        height: boardPixelSize,
        display: 'grid',
        gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
        background: 'linear-gradient(135deg, #d4a574, #c49563)',
        borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        position: 'relative',
      }}>
        {/* Đường kẻ ô vuông */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <svg width="100%" height="100%">
            {/* Đường dọc */}
            {Array.from({ length: BOARD_SIZE + 1 }).map((_, i) => (
              <line
                key={`v${i}`}
                x1={`${i * (100 / BOARD_SIZE)}%`}
                y1="0%"
                x2={`${i * (100 / BOARD_SIZE)}%`}
                y2="100%"
                stroke="#8b6f47"
                strokeWidth="1"
              />
            ))}
            {/* Đường ngang */}
            {Array.from({ length: BOARD_SIZE + 1 }).map((_, i) => (
              <line
                key={`h${i}`}
                x1="0%"
                y1={`${i * (100 / BOARD_SIZE)}%`}
                x2="100%"
                y2={`${i * (100 / BOARD_SIZE)}%`}
                stroke="#8b6f47"
                strokeWidth="1"
              />
            ))}
          </svg>
        </div>
        
        {/* Các ô cờ */}
        {board.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${x}-${y}`}
              onClick={() => handleClick(x, y)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: cell ? 'default' : 'pointer',
                zIndex: 2,
              }}
            >
              {/* Quân cờ */}
              {cell && (
                <div style={{
                  width: cellSize * 0.85,
                  height: cellSize * 0.85,
                  borderRadius: '50%',
                  background: cell === 'X'
                    ? 'radial-gradient(circle at 35% 35%, #666, #000)'
                    : 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
                  boxShadow: cell === 'X'
                    ? '2px 2px 4px rgba(0,0,0,0.5)'
                    : '2px 2px 4px rgba(0,0,0,0.2)',
                }} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

---

## Tóm tắt các bước

1. **Tạo state** cho bàn cờ (mảng 2D) và lượt chơi
2. **Vẽ container** bằng CSS Grid với `gridTemplateColumns: repeat(15, 1fr)`
3. **Vẽ đường kẻ** bằng SVG `<line>` tạo ô vuông
4. **Render các ô** bằng `board.map()` lồng nhau
5. **Xử lý click** bằng `onClick`, cập nhật state bằng `setBoard`

---

## Thuật ngữ

| Thuật ngữ | Giải thích |
|-----------|------------|
| State | Dữ liệu mà component cần nhớ, khi thay đổi sẽ vẽ lại giao diện |
| useState | Hook của React để tạo và quản lý state |
| CSS Grid | Cách bố trí phần tử thành lưới hàng/cột |
| SVG | Định dạng vẽ hình vector, dùng để vẽ đường kẻ |
| onClick | Sự kiện khi người dùng click vào phần tử |
| map() | Hàm lặp qua mảng và trả về mảng mới |
| Arrow function | Cách viết hàm ngắn gọn: `() => ...` |
| Deep copy | Tạo bản sao hoàn toàn mới, không liên kết với bản gốc |
