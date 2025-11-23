/**
 * TEST FILE - Game Logic Validation
 * Kiểm tra các trường hợp edge case trong game logic
 */

type Player = 'X' | 'O'
type Board = (null | Player)[][]

/**
 * Hàm checkWinner - Copy từ Room.tsx để test
 */
function checkWinner(board: Board, lastX: number, lastY: number, player: Player): Player | null {
  console.log(`🔍 Checking winner for ${player} at (${lastX}, ${lastY})`)
  console.log(`  Board at position:`, board[lastY]?.[lastX])
  
  // Verify the move is actually on the board
  if (!board[lastY] || board[lastY][lastX] !== player) {
    console.warn(`  ⚠️ Invalid board state at (${lastX}, ${lastY})`, board[lastY]?.[lastX])
    return null
  }
  
  const directions = [
    [1, 0],   // horizontal
    [0, 1],   // vertical
    [1, 1],   // diagonal \
    [1, -1]   // diagonal /
  ]
  const dirNames = ['horizontal', 'vertical', 'diagonal \\', 'diagonal /']

  for (let i = 0; i < directions.length; i++) {
    const [dx, dy] = directions[i]
    let count = 1

    // Count in positive direction
    let x = lastX + dx
    let y = lastY + dy
    while (x >= 0 && x < 15 && y >= 0 && y < 15 && board[y] && board[y][x] === player) {
      count++
      x += dx
      y += dy
    }

    // Count in negative direction
    x = lastX - dx
    y = lastY - dy
    while (x >= 0 && x < 15 && y >= 0 && y < 15 && board[y] && board[y][x] === player) {
      count++
      x -= dx
      y -= dy
    }

    console.log(`  ${dirNames[i]}: ${count} in a row`)

    if (count >= 5) {
      console.log(`✅ WINNER FOUND! ${player} has ${count} in ${dirNames[i]}`)
      return player
    }
  }

  console.log(`  No winner detected (max < 5)`)
  return null
}

/**
 * Helper: Tạo board trống
 */
function createEmptyBoard(): Board {
  return Array(15).fill(null).map(() => Array(15).fill(null))
}

/**
 * Helper: In board ra console
 */
function printBoard(board: Board, title: string = 'Board') {
  console.log(`\n${'='.repeat(50)}`)
  console.log(title)
  console.log('='.repeat(50))
  for (let y = 0; y < 15; y++) {
    const row = board[y].map(cell => cell || '.').join(' ')
    console.log(`${y.toString().padStart(2, '0')} | ${row}`)
  }
  console.log('='.repeat(50) + '\n')
}

/**
 * TEST 1: 5 hàng ngang (Horizontal Win)
 */
export function test1_HorizontalWin(): boolean {
  console.log('\n🧪 TEST 1: 5 Hàng Ngang (Horizontal Win)')
  const board = createEmptyBoard()
  
  // X đặt 5 quân liên tiếp tại hàng 7, cột 3-7
  board[7][3] = 'X'
  board[7][4] = 'X'
  board[7][5] = 'X'
  board[7][6] = 'X'
  board[7][7] = 'X'
  
  printBoard(board, 'TEST 1: 5 hàng ngang')
  
  const winner = checkWinner(board, 7, 7, 'X')
  const passed = winner === 'X'
  
  console.log(`Result: ${winner}`)
  console.log(`Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`)
  
  return passed
}

/**
 * TEST 2: 5 hàng dọc (Vertical Win)
 */
export function test2_VerticalWin(): boolean {
  console.log('\n🧪 TEST 2: 5 Hàng Dọc (Vertical Win)')
  const board = createEmptyBoard()
  
  // O đặt 5 quân liên tiếp tại cột 5, hàng 3-7
  board[3][5] = 'O'
  board[4][5] = 'O'
  board[5][5] = 'O'
  board[6][5] = 'O'
  board[7][5] = 'O'
  
  printBoard(board, 'TEST 2: 5 hàng dọc')
  
  const winner = checkWinner(board, 5, 7, 'O')
  const passed = winner === 'O'
  
  console.log(`Result: ${winner}`)
  console.log(`Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`)
  
  return passed
}

/**
 * TEST 3: 5 hàng chéo \ (Diagonal Win)
 */
export function test3_DiagonalWin(): boolean {
  console.log('\n🧪 TEST 3: 5 Hàng Chéo \\ (Diagonal Win)')
  const board = createEmptyBoard()
  
  // X đặt 5 quân liên tiếp theo đường chéo \
  board[3][3] = 'X'
  board[4][4] = 'X'
  board[5][5] = 'X'
  board[6][6] = 'X'
  board[7][7] = 'X'
  
  printBoard(board, 'TEST 3: 5 hàng chéo \\')
  
  const winner = checkWinner(board, 7, 7, 'X')
  const passed = winner === 'X'
  
  console.log(`Result: ${winner}`)
  console.log(`Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`)
  
  return passed
}

/**
 * TEST 4: 5 hàng chéo / (Anti-diagonal Win)
 */
export function test4_AntiDiagonalWin(): boolean {
  console.log('\n🧪 TEST 4: 5 Hàng Chéo / (Anti-diagonal Win)')
  const board = createEmptyBoard()
  
  // O đặt 5 quân liên tiếp theo đường chéo /
  board[7][3] = 'O'
  board[6][4] = 'O'
  board[5][5] = 'O'
  board[4][6] = 'O'
  board[3][7] = 'O'
  
  printBoard(board, 'TEST 4: 5 hàng chéo /')
  
  const winner = checkWinner(board, 3, 7, 'O')
  const passed = winner === 'O'
  
  console.log(`Result: ${winner}`)
  console.log(`Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`)
  
  return passed
}

/**
 * TEST 5: 4 hàng - Không thắng
 */
export function test5_NoWinWith4(): boolean {
  console.log('\n🧪 TEST 5: 4 Hàng - Không Thắng')
  const board = createEmptyBoard()
  
  // X chỉ có 4 quân liên tiếp
  board[7][3] = 'X'
  board[7][4] = 'X'
  board[7][5] = 'X'
  board[7][6] = 'X'
  
  printBoard(board, 'TEST 5: Chỉ 4 hàng')
  
  const winner = checkWinner(board, 7, 6, 'X')
  const passed = winner === null
  
  console.log(`Result: ${winner}`)
  console.log(`Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`)
  
  return passed
}

/**
 * TEST 6: 6 hàng - Vẫn thắng
 */
export function test6_WinWith6(): boolean {
  console.log('\n🧪 TEST 6: 6 Hàng - Vẫn Thắng')
  const board = createEmptyBoard()
  
  // O đặt 6 quân liên tiếp
  board[7][2] = 'O'
  board[7][3] = 'O'
  board[7][4] = 'O'
  board[7][5] = 'O'
  board[7][6] = 'O'
  board[7][7] = 'O'
  
  printBoard(board, 'TEST 6: 6 hàng')
  
  const winner = checkWinner(board, 7, 7, 'O')
  const passed = winner === 'O'
  
  console.log(`Result: ${winner}`)
  console.log(`Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`)
  
  return passed
}

/**
 * TEST 7: Bị chặn giữa - Không thắng
 */
export function test7_BlockedInMiddle(): boolean {
  console.log('\n🧪 TEST 7: Bị Chặn Giữa - Không Thắng')
  const board = createEmptyBoard()
  
  // X có 2-2 bị O chặn giữa
  board[7][3] = 'X'
  board[7][4] = 'X'
  board[7][5] = 'O'  // ← Chặn
  board[7][6] = 'X'
  board[7][7] = 'X'
  
  printBoard(board, 'TEST 7: Bị chặn giữa')
  
  const winner = checkWinner(board, 7, 7, 'X')
  const passed = winner === null
  
  console.log(`Result: ${winner}`)
  console.log(`Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`)
  
  return passed
}

/**
 * TEST 8: Edge case - Thắng ở góc board
 */
export function test8_WinAtEdge(): boolean {
  console.log('\n🧪 TEST 8: Thắng Ở Góc Board')
  const board = createEmptyBoard()
  
  // X thắng ở góc trên bên trái
  board[0][0] = 'X'
  board[0][1] = 'X'
  board[0][2] = 'X'
  board[0][3] = 'X'
  board[0][4] = 'X'
  
  printBoard(board, 'TEST 8: Thắng ở góc')
  
  const winner = checkWinner(board, 0, 4, 'X')
  const passed = winner === 'X'
  
  console.log(`Result: ${winner}`)
  console.log(`Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`)
  
  return passed
}

/**
 * TEST 9: Edge case - Thắng ở cuối board
 */
export function test9_WinAtBottomRight(): boolean {
  console.log('\n🧪 TEST 9: Thắng Ở Cuối Board')
  const board = createEmptyBoard()
  
  // O thắng ở góc dưới bên phải
  board[14][10] = 'O'
  board[14][11] = 'O'
  board[14][12] = 'O'
  board[14][13] = 'O'
  board[14][14] = 'O'
  
  printBoard(board, 'TEST 9: Thắng ở cuối board')
  
  const winner = checkWinner(board, 14, 14, 'O')
  const passed = winner === 'O'
  
  console.log(`Result: ${winner}`)
  console.log(`Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`)
  
  return passed
}

/**
 * TEST 10: Complex - Có nhiều dãy 4 nhưng không có 5
 */
export function test10_Multiple4NoWin(): boolean {
  console.log('\n🧪 TEST 10: Nhiều Dãy 4 - Không Thắng')
  const board = createEmptyBoard()
  
  // X có nhiều dãy 4 nhưng không có dãy 5 nào
  // Hàng ngang
  board[7][3] = 'X'
  board[7][4] = 'X'
  board[7][5] = 'X'
  board[7][6] = 'X'
  
  // Hàng dọc
  board[3][5] = 'X'
  board[4][5] = 'X'
  board[6][5] = 'X'  // Bỏ qua 5,5 để không tạo ra 5 hàng
  board[8][5] = 'X'
  
  printBoard(board, 'TEST 10: Nhiều dãy 4')
  
  const winner = checkWinner(board, 7, 6, 'X')
  const passed = winner === null
  
  console.log(`Result: ${winner}`)
  console.log(`Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`)
  
  return passed
}

/**
 * Chạy tất cả tests
 */
export function runAllTests(): void {
  console.log('\n' + '🧪'.repeat(25))
  console.log('      GAME LOGIC TEST SUITE')
  console.log('🧪'.repeat(25) + '\n')
  
  const tests = [
    { name: 'TEST 1: Horizontal Win', fn: test1_HorizontalWin },
    { name: 'TEST 2: Vertical Win', fn: test2_VerticalWin },
    { name: 'TEST 3: Diagonal Win', fn: test3_DiagonalWin },
    { name: 'TEST 4: Anti-diagonal Win', fn: test4_AntiDiagonalWin },
    { name: 'TEST 5: No Win With 4', fn: test5_NoWinWith4 },
    { name: 'TEST 6: Win With 6', fn: test6_WinWith6 },
    { name: 'TEST 7: Blocked In Middle', fn: test7_BlockedInMiddle },
    { name: 'TEST 8: Win At Edge', fn: test8_WinAtEdge },
    { name: 'TEST 9: Win At Bottom Right', fn: test9_WinAtBottomRight },
    { name: 'TEST 10: Multiple 4 No Win', fn: test10_Multiple4NoWin }
  ]
  
  const results = tests.map(test => ({
    name: test.name,
    passed: test.fn()
  }))
  
  console.log('\n' + '='.repeat(50))
  console.log('            TEST SUMMARY')
  console.log('='.repeat(50))
  
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.name}: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`)
  })
  
  const passed = results.filter(r => r.passed).length
  const total = results.length
  
  console.log('='.repeat(50))
  console.log(`Total: ${passed}/${total} tests passed`)
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`)
  console.log('='.repeat(50) + '\n')
  
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! 🎉')
  } else {
    console.log('❌ SOME TESTS FAILED!')
  }
}

// Export default để có thể import dễ dàng
export default {
  runAllTests,
  test1_HorizontalWin,
  test2_VerticalWin,
  test3_DiagonalWin,
  test4_AntiDiagonalWin,
  test5_NoWinWith4,
  test6_WinWith6,
  test7_BlockedInMiddle,
  test8_WinAtEdge,
  test9_WinAtBottomRight,
  test10_Multiple4NoWin
}
