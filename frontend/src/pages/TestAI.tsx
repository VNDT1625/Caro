import { useState, useCallback } from 'react'

const BOARD_SIZE = 15

type Cell = 'X' | 'O' | null
type Board = Cell[][]

interface Move {
  row: number
  col: number
  player: 'X' | 'O'
  moveNumber: number
}

function checkWinner(board: Board, row: number, col: number, player: 'X' | 'O'): boolean {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]]
  for (const [dx, dy] of directions) {
    let count = 1
    for (let i = 1; i < 5; i++) {
      const nr = row + dx * i, nc = col + dy * i
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) count++
      else break
    }
    for (let i = 1; i < 5; i++) {
      const nr = row - dx * i, nc = col - dy * i
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) count++
      else break
    }
    if (count >= 5) return true
  }
  return false
}

export default function TestAI() {
  const [board, setBoard] = useState<Board>(() => 
    Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null))
  )
  const [moves, setMoves] = useState<Move[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X')
  const [winner, setWinner] = useState<'X' | 'O' | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCellClick = useCallback((row: number, col: number) => {
    if (board[row][col] || winner) return
    const newBoard = board.map(r => [...r])
    newBoard[row][col] = currentPlayer
    const newMove: Move = { row, col, player: currentPlayer, moveNumber: moves.length + 1 }
    setBoard(newBoard)
    setMoves([...moves, newMove])
    if (checkWinner(newBoard, row, col, currentPlayer)) setWinner(currentPlayer)
    else setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
  }, [board, currentPlayer, moves, winner])

  const handleUndo = useCallback(() => {
    if (moves.length === 0) return
    const lastMove = moves[moves.length - 1]
    const newBoard = board.map(r => [...r])
    newBoard[lastMove.row][lastMove.col] = null
    setBoard(newBoard)
    setMoves(moves.slice(0, -1))
    setCurrentPlayer(lastMove.player)
    setWinner(null)
  }, [board, moves])

  const handleReset = useCallback(() => {
    setBoard(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)))
    setMoves([])
    setCurrentPlayer('X')
    setWinner(null)
  }, [])

  const generatePythonCode = useCallback(() => {
    const lines = moves.map((m) => `    (${m.row}, ${m.col}),   # Nước ${m.moveNumber}: ${m.player}`)
    return `MOVES = [\n${lines.join('\n')}\n]`
  }, [moves])

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(generatePythonCode())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [generatePythonCode])

  const cellSize = 36

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', padding: 20 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', fontSize: 28, marginBottom: 8 }}>🧪 Test AI Analysis</h1>
        <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: 24 }}>
          Đánh cờ và export moves để test AI analyzer
        </p>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {/* Board */}
          <div style={{ flex: 1, minWidth: 400 }}>
            <div style={{ background: 'rgba(30,41,59,0.8)', padding: 16, borderRadius: 12, border: '1px solid rgba(71,85,105,0.5)' }}>
              <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 18 }}>
                {winner ? (
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>🏆 {winner} Thắng!</span>
                ) : (
                  <span>Lượt: <span style={{ color: currentPlayer === 'X' ? '#ef4444' : '#3b82f6', fontWeight: 700 }}>{currentPlayer}</span> (Nước {moves.length + 1})</span>
                )}
              </div>

              {/* Board Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
                gap: 0,
                margin: '0 auto',
                width: 'fit-content',
                background: '#d4a574',
                padding: 2,
                borderRadius: 4
              }}>
                {board.map((row, rowIdx) =>
                  row.map((cell, colIdx) => (
                    <div
                      key={`${rowIdx}-${colIdx}`}
                      onClick={() => handleCellClick(rowIdx, colIdx)}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        background: '#c9a066',
                        border: '1px solid #a08050',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: cell || winner ? 'default' : 'pointer',
                        position: 'relative',
                        fontSize: 22,
                        fontWeight: 700
                      }}
                    >
                      {cell && (
                        <>
                          <span style={{ 
                            color: cell === 'X' ? '#1a1a1a' : '#fff',
                            textShadow: cell === 'O' ? '0 0 3px #000' : 'none'
                          }}>{cell === 'X' ? '✖' : '●'}</span>
                          <span style={{
                            position: 'absolute',
                            bottom: 1,
                            right: 2,
                            fontSize: 8,
                            color: '#666'
                          }}>
                            {moves.findIndex(m => m.row === rowIdx && m.col === colIdx) + 1}
                          </span>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
                <button onClick={handleUndo} disabled={moves.length === 0} style={{
                  padding: '8px 16px', background: moves.length ? '#ca8a04' : '#475569', color: '#fff',
                  border: 'none', borderRadius: 6, cursor: moves.length ? 'pointer' : 'default'
                }}>↩️ Undo</button>
                <button onClick={handleReset} style={{
                  padding: '8px 16px', background: '#dc2626', color: '#fff',
                  border: 'none', borderRadius: 6, cursor: 'pointer'
                }}>🔄 Reset</button>
              </div>
            </div>
          </div>

          {/* Export Panel */}
          <div style={{ width: 360 }}>
            <div style={{ background: 'rgba(30,41,59,0.8)', padding: 16, borderRadius: 12, border: '1px solid rgba(71,85,105,0.5)' }}>
              <h2 style={{ fontSize: 18, marginBottom: 16 }}>📤 Export Moves</h2>
              
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Danh sách ({moves.length}):</h3>
                <div style={{ background: '#0f172a', padding: 8, borderRadius: 6, maxHeight: 120, overflowY: 'auto', fontSize: 12 }}>
                  {moves.length === 0 ? (
                    <span style={{ color: '#64748b' }}>Chưa có nước đi</span>
                  ) : moves.map((m) => (
                    <div key={m.moveNumber} style={{ color: m.player === 'X' ? '#ef4444' : '#3b82f6' }}>
                      #{m.moveNumber}: {m.player} ({m.row}, {m.col})
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Python Code:</h3>
                <pre style={{ background: '#0f172a', padding: 12, borderRadius: 6, fontSize: 11, overflowX: 'auto', maxHeight: 180, overflowY: 'auto' }}>
                  {generatePythonCode()}
                </pre>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={handleCopyCode} style={{
                  padding: '10px 16px', background: copied ? '#22c55e' : '#16a34a', color: '#fff',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600
                }}>{copied ? '✅ Đã copy!' : '📋 Copy Python Code'}</button>
              </div>

              <div style={{ marginTop: 16, padding: 12, background: 'rgba(71,85,105,0.3)', borderRadius: 6, fontSize: 12 }}>
                <h3 style={{ fontWeight: 700, marginBottom: 8 }}>📝 Hướng dẫn:</h3>
                <ol style={{ paddingLeft: 16, color: '#cbd5e1', lineHeight: 1.6 }}>
                  <li>Đánh cờ trên bàn cờ</li>
                  <li>Click "Copy Python Code"</li>
                  <li>Paste vào <code style={{ background: '#1e293b', padding: '2px 4px', borderRadius: 3 }}>ai/test_custom_game.py</code></li>
                  <li>Chạy: <code style={{ background: '#1e293b', padding: '2px 4px', borderRadius: 3 }}>python ai/test_custom_game.py</code></li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
