// Gomoku/Renju rules: forbidden moves for Black (X)
// 3-3: Two open-threes created by the same move
// 4-4: Two open-fours created by the same move

export interface ForbiddenMove {
  isForbidden: boolean
  reason?: '3-3' | '4-4'
}

// Count consecutive pieces in a direction
function countLine(
  board: Record<string, string>,
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: string
): { count: number; openEnds: number } {
  let count = 1 // include the current position
  let openEnds = 0

  // Forward direction
  let i = 1
  while (true) {
    const key = `${x + dx * i}_${y + dy * i}`
    if (board[key] === player) {
      count++
      i++
    } else {
      if (!board[key]) openEnds++ // empty = open end
      break
    }
  }

  // Backward direction
  i = 1
  while (true) {
    const key = `${x - dx * i}_${y - dy * i}`
    if (board[key] === player) {
      count++
      i++
    } else {
      if (!board[key]) openEnds++ // empty = open end
      break
    }
  }

  return { count, openEnds }
}

// Check if placing at (x, y) creates an open-three (3 in a row with 2 open ends)
function isOpenThree(
  board: Record<string, string>,
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: string
): boolean {
  const testBoard = { ...board, [`${x}_${y}`]: player }
  const line = countLine(testBoard, x, y, dx, dy, player)
  return line.count === 3 && line.openEnds === 2
}

// Check if placing at (x, y) creates an open-four (4 in a row with at least 1 open end)
function isOpenFour(
  board: Record<string, string>,
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: string
): boolean {
  const testBoard = { ...board, [`${x}_${y}`]: player }
  const line = countLine(testBoard, x, y, dx, dy, player)
  return line.count === 4 && line.openEnds >= 1
}

// Check if move creates forbidden pattern (only for Black/X)
export function checkForbiddenMove(
  board: Record<string, string>,
  x: number,
  y: number,
  player: 'X' | 'O'
): ForbiddenMove {
  // Only Black (X) has forbidden moves in Renju rules
  if (player !== 'X') {
    return { isForbidden: false }
  }

  const directions = [
    [1, 0],  // horizontal
    [0, 1],  // vertical
    [1, 1],  // diagonal \
    [1, -1], // diagonal /
  ]

  // Count open-threes and open-fours
  let openThrees = 0
  let openFours = 0

  for (const [dx, dy] of directions) {
    if (isOpenThree(board, x, y, dx, dy, player)) {
      openThrees++
    }
    if (isOpenFour(board, x, y, dx, dy, player)) {
      openFours++
    }
  }

  // 3-3: Two or more open-threes
  if (openThrees >= 2) {
    return { isForbidden: true, reason: '3-3' }
  }

  // 4-4: Two or more open-fours
  if (openFours >= 2) {
    return { isForbidden: true, reason: '4-4' }
  }

  return { isForbidden: false }
}

// Get winning chain coordinates
export function getWinningChain(
  board: Record<string, string>,
  x0: number,
  y0: number
): Array<[number, number]> | null {
  const positions: Record<string, Record<string, boolean>> = { X: {}, O: {} }
  for (const key in board) {
    const val = board[key]
    if (val !== 'X' && val !== 'O') continue
    const parts = key.split('_')
    if (parts.length !== 2) continue
    const x = parseInt(parts[0], 10)
    const y = parseInt(parts[1], 10)
    positions[val][`${x}_${y}`] = true
  }

  const keyLast = `${x0}_${y0}`
  let player: 'X' | 'O' | null = null
  if (positions['X'][keyLast]) player = 'X'
  else if (positions['O'][keyLast]) player = 'O'
  else return null

  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ]

  const set = positions[player]
  for (const d of dirs) {
    const dx = d[0]
    const dy = d[1]
    const chain: Array<[number, number]> = [[x0, y0]]

    // Forward
    let i = 1
    while (set[`${x0 + dx * i}_${y0 + dy * i}`]) {
      chain.push([x0 + dx * i, y0 + dy * i])
      i++
    }

    // Backward
    i = 1
    while (set[`${x0 - dx * i}_${y0 - dy * i}`]) {
      chain.unshift([x0 - dx * i, y0 - dy * i])
      i++
    }

    if (chain.length >= 5) return chain
  }

  return null
}
