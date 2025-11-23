import React from 'react'
import { getAIMove, TrainingDifficulty } from '../lib/game/botAI'

type Cell = 'X' | 'O' | null

const BOARD_SIZE = 15

const createEmptyBoard = (): Cell[][] =>
  Array.from({ length: BOARD_SIZE }, () => Array<Cell>(BOARD_SIZE).fill(null))

export default function TrainingRoom() {
  const [board, setBoard] = React.useState<Cell[][]>(() => createEmptyBoard())
  const [playerSymbol, setPlayerSymbol] = React.useState<'X' | 'O'>('X')
  const [currentTurn, setCurrentTurn] = React.useState<'X' | 'O'>('X')
  const [difficulty, setDifficulty] = React.useState<TrainingDifficulty>('nhap-mon')
  const [botProfile, setBotProfile] = React.useState<{ title: string; caption?: string; emoji?: string }>(() => ({
    title: 'Nhập Môn',
    caption: 'Phòng thủ cơ bản',
    emoji: '🛡️'
  }))
  const [statusMessage, setStatusMessage] = React.useState('Tới lượt bạn')
  const [isBotThinking, setIsBotThinking] = React.useState(false)
  const [scores, setScores] = React.useState({ player: 0, bot: 0 })
  const [gameWinner, setGameWinner] = React.useState<'player' | 'bot' | null>(null)
  const [matchWinner, setMatchWinner] = React.useState<'player' | 'bot' | null>(null)
  const [lastMove, setLastMove] = React.useState<{ x: number; y: number } | null>(null)
  const [moveHistory, setMoveHistory] = React.useState<Array<{ x: number; y: number; owner: 'player' | 'bot' }>>([])

  const botSymbol = playerSymbol === 'X' ? 'O' : 'X'

  React.useEffect(() => {
    const stored = localStorage.getItem('trainingMatch')
    if (!stored) {
      window.location.hash = '#home'
      return
    }

    try {
      const parsed = JSON.parse(stored)
      if (parsed.difficulty) setDifficulty(parsed.difficulty as TrainingDifficulty)
      if (parsed.playerSymbol === 'O') {
        setPlayerSymbol('O')
        setCurrentTurn('O')
      }
      if (parsed.botProfile) setBotProfile(parsed.botProfile)
    } catch (error) {
      console.error('Không đọc được cấu hình thí luyện:', error)
    }
  }, [])

  React.useEffect(() => {
    if (matchWinner || gameWinner || currentTurn !== botSymbol) return

    setIsBotThinking(true)
    setStatusMessage('Bot đang suy nghĩ...')

    const delay = difficulty === 'nghich-thien' ? 320 : difficulty === 'ky-tai' ? 420 : 520
    const timer = setTimeout(() => {
      const move = getAIMove(board, botSymbol, difficulty, playerSymbol)
      if (!move) {
        setIsBotThinking(false)
        setStatusMessage('Chờ bạn đi')
        return
      }

      const newBoard = board.map(row => [...row])
      if (newBoard[move.y][move.x] !== null) {
        setIsBotThinking(false)
        setStatusMessage('Ô đã bị chiếm, chờ bạn đi')
        setCurrentTurn(playerSymbol)
        return
      }

      newBoard[move.y][move.x] = botSymbol
      setBoard(newBoard)
      setLastMove({ x: move.x, y: move.y })
      setMoveHistory(prev => [...prev, { x: move.x, y: move.y, owner: 'bot' }])

      const winner = checkWinner(newBoard, move.x, move.y, botSymbol)
      if (winner) {
        finishRound('bot')
      } else {
        setCurrentTurn(playerSymbol)
        setStatusMessage('Tới lượt bạn')
      }

      setIsBotThinking(false)
    }, delay)

    return () => clearTimeout(timer)
  }, [board, botSymbol, currentTurn, difficulty, gameWinner, matchWinner, playerSymbol])

  const handleCellClick = (x: number, y: number) => {
    if (matchWinner || gameWinner || currentTurn !== playerSymbol) return
    if (board[y][x] !== null) return

    const newBoard = board.map(row => [...row])
    newBoard[y][x] = playerSymbol
    setBoard(newBoard)
    setLastMove({ x, y })
    setMoveHistory(prev => [...prev, { x, y, owner: 'player' }])

    const winner = checkWinner(newBoard, x, y, playerSymbol)
    if (winner) {
      finishRound('player')
      return
    }

    setCurrentTurn(botSymbol)
    setStatusMessage('Bot đang suy nghĩ...')
  }

  const finishRound = (winner: 'player' | 'bot') => {
    setGameWinner(winner)
    setStatusMessage(winner === 'player' ? 'Bạn thắng ván này!' : 'Bot dẫn trước!')

    setScores(prev => {
      const next = { ...prev }
      next[winner] += 1
      if (next[winner] >= 2) {
        setMatchWinner(winner)
      } else {
        setTimeout(() => {
          resetForNextGame()
        }, 2200)
      }
      return next
    })
  }

  const resetForNextGame = () => {
    setBoard(createEmptyBoard())
    setGameWinner(null)
    setLastMove(null)
    setMoveHistory([])
    setCurrentTurn(playerSymbol)
    setStatusMessage('Tới lượt bạn')
  }

  const handleRestartMatch = () => {
    setScores({ player: 0, bot: 0 })
    setMatchWinner(null)
    setGameWinner(null)
    setBoard(createEmptyBoard())
    setLastMove(null)
    setMoveHistory([])
    setCurrentTurn(playerSymbol)
    setStatusMessage('Tới lượt bạn')
  }

  const handleLeave = () => {
    localStorage.removeItem('trainingMatch')
    window.location.hash = '#home'
  }

  return (
    <div
      className="training-room"
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top, #0f172a 0%, #020617 70%)',
        color: '#fff',
        paddingBottom: '40px'
      }}
    >
      <div style={{ padding: '0 30px' }}>
        <nav className="breadcrumb-nav" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault()
              handleLeave()
            }}
          >
            Chánh Điện
          </a>
          <span>›</span>
          <span className="breadcrumb-current">Thí Luyện</span>
        </nav>
      </div>
      <div
        className="training-room-top"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 30px 20px'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>Thí Luyện • {botProfile.title}</div>
          <div style={{ fontSize: '13px', color: '#9ca3af' }}>{botProfile.caption}</div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '20px',
            fontSize: '14px'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#38bdf8', fontWeight: 600 }}>Bạn</div>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>{scores.player}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#f97316', fontWeight: 600 }}>Bot</div>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>{scores.bot}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 20px' }}>
        <div
          className="training-board-wrapper"
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            borderRadius: '24px',
            padding: '24px',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            boxShadow: '0 20px 60px rgba(2, 6, 23, 0.7)'
          }}
        >
          <div
            className="status-bar"
            style={{
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            <div style={{ fontSize: '14px', color: '#cbd5f5' }}>{statusMessage}</div>
            {isBotThinking && <div style={{ fontSize: '12px', color: '#facc15' }}>🤖 Đang phân tích...</div>}
          </div>

          <div
            className="board-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
              gap: '2px',
              background: '#78350f',
              padding: '6px',
              borderRadius: '18px'
            }}
          >
            {board.map((row, y) =>
              row.map((cell, x) => {
                const isLast = lastMove && lastMove.x === x && lastMove.y === y
                return (
                  <button
                    key={`${x}-${y}`}
                    onClick={() => handleCellClick(x, y)}
                    style={{
                      width: '32px',
                      height: '32px',
                      background: isLast ? 'rgba(248, 250, 252, 0.06)' : 'rgba(15, 23, 42, 0.45)',
                      border: '1px solid rgba(30, 41, 59, 0.9)',
                      borderRadius: '4px',
                      color: cell === playerSymbol ? '#38bdf8' : '#f97316',
                      fontWeight: 700,
                      fontSize: '16px',
                      cursor: cell || currentTurn !== playerSymbol || gameWinner ? 'default' : 'pointer',
                      transition: 'background 0.15s'
                    }}
                    disabled={Boolean(cell) || currentTurn !== playerSymbol || Boolean(gameWinner)}
                  >
                    {cell ?? ''}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {matchWinner && (
        <div
          className="training-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              padding: '32px',
              borderRadius: '24px',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              width: 'min(420px, 90vw)',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>{matchWinner === 'player' ? '🎉' : '🤖'}</div>
            <h3 style={{ margin: '0 0 10px', fontSize: '24px' }}>
              {matchWinner === 'player' ? 'Bạn đã khuất phục bot!' : 'Bot đã thắng trận này'}
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
              {matchWinner === 'player'
                ? 'Tiếp tục luyện tập để duy trì cảm giác tay nhé!'
                : 'Thử lại hoặc đổi độ khó khác để cải thiện chiến thuật.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleLeave}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(248, 113, 113, 0.6)',
                  background: 'transparent',
                  color: '#fca5a5',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Về Home
              </button>
              <button
                onClick={handleRestartMatch}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(120deg, #22D3EE, #6366F1)',
                  color: '#0f172a',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Đánh lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function checkWinner(board: Cell[][], lastX: number, lastY: number, player: 'X' | 'O'): boolean {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ] as const

  for (const [dx, dy] of directions) {
    let count = 1

    let x = lastX + dx
    let y = lastY + dy
    while (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE && board[y][x] === player) {
      count += 1
      x += dx
      y += dy
    }

    x = lastX - dx
    y = lastY - dy
    while (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE && board[y][x] === player) {
      count += 1
      x -= dx
      y -= dy
    }

    if (count >= 5) {
      return true
    }
  }

  return false
}
