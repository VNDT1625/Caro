import React from 'react'
import { getAIMove, TrainingDifficulty } from '../lib/game/botAI'
import { useLanguage } from '../contexts/LanguageContext'
import { useSwap2Local } from '../hooks/useSwap2Local'
import Swap2PhaseIndicator from '../components/swap2/Swap2PhaseIndicator'
import ColorChoiceModal from '../components/swap2/ColorChoiceModal'
import TentativeStoneOverlay from '../components/swap2/TentativeStoneDisplay' // default export is single stone display
import type { Swap2Choice, TentativeStone } from '../types/swap2'
import { MobileBreadcrumb } from '../components/layout'

// Hook to detect mobile screen
const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

type Cell = 'X' | 'O' | null

const BOARD_SIZE = 15

const createEmptyBoard = (): Cell[][] =>
  Array.from({ length: BOARD_SIZE }, () => Array<Cell>(BOARD_SIZE).fill(null))

export default function TrainingRoom() {
  const { t } = useLanguage()
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
  const [swap2Enabled, setSwap2Enabled] = React.useState(false)
  const [gameStarted, setGameStarted] = React.useState(false)
  
  // Mobile detection and refs
  const isMobile = useIsMobile()
  const boardRef = React.useRef<HTMLDivElement>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [tapHighlight, setTapHighlight] = React.useState<{x: number, y: number} | null>(null)
  
  // Calculate board size to always be 1:1 square and fit screen
  const [boardPixelSize, setBoardPixelSize] = React.useState(400)
  
  React.useEffect(() => {
    const updateBoardSize = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const padding = isMobile ? 32 : 80
      const headerSpace = isMobile ? 180 : 220
      const maxSize = Math.min(vw - padding, vh - headerSpace)
      setBoardPixelSize(Math.max(280, Math.min(560, maxSize)))
    }
    updateBoardSize()
    window.addEventListener('resize', updateBoardSize)
    return () => window.removeEventListener('resize', updateBoardSize)
  }, [isMobile])
  
  const cellSize = Math.floor(boardPixelSize / BOARD_SIZE)

  const botSymbol = playerSymbol === 'X' ? 'O' : 'X'
  
  // Auto-scroll to last move on mobile
  React.useEffect(() => {
    if (!isMobile || !lastMove || !scrollContainerRef.current || !boardRef.current) return
    
    const container = scrollContainerRef.current
    const board = boardRef.current
    
    // Calculate cell position
    const boardCellSize = board.offsetWidth / BOARD_SIZE
    const targetX = lastMove.x * boardCellSize + boardCellSize / 2
    const targetY = lastMove.y * boardCellSize + boardCellSize / 2
    
    // Scroll to center the last move
    const scrollX = targetX - container.offsetWidth / 2
    const scrollY = targetY - container.offsetHeight / 2
    
    container.scrollTo({
      left: Math.max(0, scrollX),
      top: Math.max(0, scrollY),
      behavior: 'smooth'
    })
  }, [lastMove, isMobile])

  // Swap2 hook for AI training mode
  const swap2 = useSwap2Local({
    enabled: swap2Enabled && !gameStarted,
    player1Name: 'Bạn',
    player2Name: botProfile.title || 'Bot',
    onComplete: (assignment) => {
      console.log('🎯 Swap2 complete:', assignment)
      // Set player symbol based on assignment
      // Player 1 = human player, Player 2 = bot
      setPlayerSymbol(assignment.player1Side)
      
      // Initialize board with tentative stones
      const newBoard = createEmptyBoard()
      // Stone pattern: 1=Black, 2=White, 3=Black, 4=Black (if place_more), 5=White (if place_more)
      assignment.tentativeStones.forEach((stone, idx) => {
        // Stones 0,2,3 = Black (X), Stones 1,4 = White (O)
        const isBlack = idx === 0 || idx === 2 || idx === 3
        newBoard[stone.y][stone.x] = isBlack ? 'X' : 'O'
      })
      setBoard(newBoard)
      
      // Black (X) always moves first after Swap2
      setCurrentTurn('X')
      setGameStarted(true)
      setStatusMessage(assignment.player1Side === 'X' ? 'Tới lượt bạn' : 'Bot đang suy nghĩ...')
    }
  })

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
      // Check if Swap2 is enabled
      if (parsed.swap2Enabled) {
        setSwap2Enabled(true)
        setGameStarted(false) // Wait for Swap2 to complete
      } else {
        setGameStarted(true) // Start game immediately without Swap2
      }
    } catch (error) {
      console.error('Không đọc được cấu hình thí luyện:', error)
    }
  }, [])

  // Bot AI for Swap2 phases - bot makes choices automatically
  React.useEffect(() => {
    if (!swap2.isSwap2Active) return
    
    // Bot is player 2 in Swap2
    if (swap2.activePlayer !== 2) return
    
    // Bot needs to make a choice
    if (swap2.shouldShowChoiceModal) {
      const timer = setTimeout(() => {
        // Bot AI choice logic based on difficulty
        let choice: Swap2Choice
        if (swap2.currentPhase === 'swap2_choice') {
          // After 3 stones, bot decides
          if (difficulty === 'nghich-thien') {
            // Master bot: analyze position and choose strategically
            // For simplicity, prefer black (first mover advantage)
            choice = 'black'
          } else if (difficulty === 'ky-tai') {
            // Expert bot: sometimes place more for variety
            choice = Math.random() > 0.6 ? 'place_more' : 'black'
          } else {
            // Beginner bot: random choice
            const choices: Swap2Choice[] = ['black', 'white', 'place_more']
            choice = choices[Math.floor(Math.random() * choices.length)]
          }
        } else {
          // Final choice after 5 stones
          choice = Math.random() > 0.5 ? 'black' : 'white'
        }
        swap2.makeChoice(choice)
      }, 800)
      return () => clearTimeout(timer)
    }
    
    // Bot needs to place stones (in swap2_extra phase)
    if (swap2.currentPhase === 'swap2_extra' && swap2.stonesPlaced < 5) {
      const timer = setTimeout(() => {
        // Find empty cell near existing stones
        const emptyNear = findEmptyCellNearStones(swap2.tentativeStones)
        if (emptyNear) {
          swap2.placeStone(emptyNear.x, emptyNear.y)
        }
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [swap2.isSwap2Active, swap2.activePlayer, swap2.shouldShowChoiceModal, swap2.currentPhase, swap2.stonesPlaced, difficulty])

  // Helper to find empty cell near existing stones
  function findEmptyCellNearStones(stones: TentativeStone[]): { x: number; y: number } | null {
    const occupied = new Set(stones.map(s => `${s.x},${s.y}`))
    const candidates: { x: number; y: number }[] = []
    
    for (const stone of stones) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const nx = stone.x + dx
          const ny = stone.y + dy
          if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
            if (!occupied.has(`${nx},${ny}`)) {
              candidates.push({ x: nx, y: ny })
            }
          }
        }
      }
    }
    
    if (candidates.length === 0) {
      // Fallback to center area
      return { x: 7, y: 7 }
    }
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  React.useEffect(() => {
    if (!gameStarted || matchWinner || gameWinner || currentTurn !== botSymbol) return

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
  }, [board, botSymbol, currentTurn, difficulty, gameWinner, matchWinner, playerSymbol, gameStarted])

  const handleCellClick = (x: number, y: number) => {
    // Handle Swap2 placement phase (player is player1)
    if (swap2.isSwap2Active && swap2.activePlayer === 1) {
      if (swap2.currentPhase === 'swap2_placement' || swap2.currentPhase === 'swap2_extra') {
        swap2.placeStone(x, y)
        return
      }
    }
    
    // Normal game move
    if (!gameStarted || matchWinner || gameWinner || currentTurn !== playerSymbol) return
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
    setPlayerSymbol('X')
    setCurrentTurn('X')
    setStatusMessage('Tới lượt bạn')
    // Reset Swap2 if enabled
    if (swap2Enabled) {
      setGameStarted(false)
      swap2.reset()
    }
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
      {/* Mobile Breadcrumb - Simple inline */}
      {isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span 
            style={{ fontSize: 13, color: '#94A3B8', cursor: 'pointer' }}
            onClick={handleLeave}
          >
            {t('breadcrumb.home')}
          </span>
          <span style={{ color: '#94A3B8' }}>›</span>
          <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 500 }}>
            {t('breadcrumb.training') || 'Thí Luyện'}
          </span>
        </div>
      )}
      <div style={{ padding: '0 30px' }} className="desktop-breadcrumb">
        <nav className="breadcrumb-nav" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault()
              handleLeave()
            }}
          >
            {t('breadcrumb.home')}
          </a>
          <span>›</span>
          <span className="breadcrumb-current">{t('breadcrumb.training') || 'Thí Luyện'}</span>
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

      <div style={{ display: 'flex', justifyContent: 'center', padding: isMobile ? '0 8px' : '0 20px' }}>
        <div
          className="training-board-wrapper"
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            borderRadius: isMobile ? 16 : 24,
            padding: isMobile ? 12 : 24,
            border: '1px solid rgba(148, 163, 184, 0.25)',
            boxShadow: '0 20px 60px rgba(2, 6, 23, 0.7)',
            width: 'fit-content'
          }}
        >
          {/* Swap2 Phase Indicator */}
          {swap2.isSwap2Active && (
            <Swap2PhaseIndicator
              phase={swap2.currentPhase || 'swap2_placement'}
              stonesPlaced={swap2.stonesPlaced}
              stonesRequired={swap2.stonesRequired}
              activePlayerName={swap2.getActivePlayerName()}
              isCurrentUserActive={swap2.activePlayer === 1}
            />
          )}

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
            <div style={{ fontSize: '14px', color: '#cbd5f5' }}>
              {swap2.isSwap2Active 
                ? swap2.getPhaseDisplayInfo().description 
                : statusMessage}
            </div>
            {isBotThinking && <div style={{ fontSize: '12px', color: '#facc15' }}>🤖 Đang phân tích...</div>}
          </div>

          {/* Board Grid - PlayOK style responsive */}
          <div
            ref={boardRef}
            className="board-grid"
            style={{
              width: boardPixelSize,
              height: boardPixelSize,
              display: 'grid',
              gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
              background: 'linear-gradient(135deg, #d4a574, #c49563)',
              borderRadius: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              position: 'relative',
              touchAction: 'none',
              userSelect: 'none'
            }}
          >
            {/* Grid lines overlay - cell borders style (like Hotseat) */}
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 1
            }}>
              <svg width="100%" height="100%" style={{ position: 'absolute' }}>
                {/* Vertical lines - cell borders */}
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
                {/* Horizontal lines - cell borders */}
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
                {/* Star points - at cell centers */}
                {[[3,3],[3,11],[11,3],[11,11],[7,7],[3,7],[11,7],[7,3],[7,11]].map(([sx, sy]) => (
                  <circle
                    key={`star${sx}${sy}`}
                    cx={`${(sx + 0.5) * (100 / BOARD_SIZE)}%`}
                    cy={`${(sy + 0.5) * (100 / BOARD_SIZE)}%`}
                    r="3"
                    fill="#8b6f47"
                  />
                ))}
              </svg>
            </div>
            
            {board.map((row, y) =>
              row.map((cell, x) => {
                const isLast = lastMove && lastMove.x === x && lastMove.y === y
                const isTapHighlighted = tapHighlight && tapHighlight.x === x && tapHighlight.y === y
                const canClick = !cell && (swap2.isSwap2Active || currentTurn === playerSymbol) && !gameWinner
                
                return (
                  <div
                    key={`${x}-${y}`}
                    onClick={() => {
                      if (!canClick) return
                      setTapHighlight({ x, y })
                      setTimeout(() => setTapHighlight(null), 200)
                      handleCellClick(x, y)
                    }}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: canClick ? 'pointer' : 'default',
                      zIndex: 2
                    }}
                  >
                    {/* Last move highlight */}
                    {isLast && (
                      <div style={{
                        position: 'absolute',
                        inset: 2,
                        background: 'rgba(34, 197, 94, 0.3)',
                        borderRadius: 4,
                        pointerEvents: 'none'
                      }} />
                    )}
                    
                    {/* Tap highlight circle */}
                    {isTapHighlighted && (
                      <div style={{
                        position: 'absolute',
                        width: cellSize * 0.6,
                        height: cellSize * 0.6,
                        borderRadius: '50%',
                        border: '2px solid rgba(59, 130, 246, 0.8)',
                        animation: 'tapPulse 0.3s ease-out',
                        pointerEvents: 'none'
                      }} />
                    )}
                    
                    {/* Stone */}
                    {cell && (
                      <div style={{
                        width: cellSize * 0.85,
                        height: cellSize * 0.85,
                        borderRadius: '50%',
                        background: cell === 'X'
                          ? 'radial-gradient(circle at 35% 35%, #4a4a4a, #000)'
                          : 'radial-gradient(circle at 35% 35%, #fff, #d1d1d1)',
                        boxShadow: cell === 'X'
                          ? '2px 2px 4px rgba(0,0,0,0.5)'
                          : '2px 2px 4px rgba(0,0,0,0.2)',
                        border: isLast ? `2px solid ${cell === 'X' ? '#3b82f6' : '#ef4444'}` : 'none'
                      }} />
                    )}
                    
                    {/* Tentative stones during Swap2 */}
                    {swap2.isSwap2Active && swap2.tentativeStones.some(s => s.x === x && s.y === y) && (() => {
                      const stone = swap2.tentativeStones.find(s => s.x === x && s.y === y)!
                      const isBlack = [1, 3, 4].includes(stone.placementOrder)
                      return (
                        <div style={{
                          width: cellSize * 0.75,
                          height: cellSize * 0.75,
                          borderRadius: '50%',
                          background: isBlack
                            ? 'radial-gradient(circle at 35% 35%, #4a4a4a, #000)'
                            : 'radial-gradient(circle at 35% 35%, #fff, #d1d1d1)',
                          border: `2px dashed ${isBlack ? '#22D3EE' : '#F59E0B'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: cellSize * 0.35,
                          fontWeight: 700,
                          color: isBlack ? '#fff' : '#000',
                          opacity: 0.85
                        }}>
                          {stone.placementOrder}
                        </div>
                      )
                    })()}
                  </div>
                )
              })
            )}
          </div>
          
          <style>{`
            @keyframes tapPulse {
              0% { transform: scale(1); opacity: 0.8; }
              100% { transform: scale(1.5); opacity: 0; }
            }
          `}</style>
        </div>
      </div>

      {/* Swap2 Color Choice Modal - only for player (activePlayer === 1) */}
      {swap2.shouldShowChoiceModal && swap2.activePlayer === 1 && (
        <ColorChoiceModal
          onChoice={(choice: Swap2Choice) => swap2.makeChoice(choice)}
          phase={(swap2.currentPhase === 'swap2_choice' || swap2.currentPhase === 'swap2_final_choice') ? swap2.currentPhase : 'swap2_choice'}
          tentativeStones={swap2.tentativeStones}
          timeRemaining={30}
        />
      )}

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
