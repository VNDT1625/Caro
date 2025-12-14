import React from 'react'
import { checkWinnerLastMove } from '../lib/game/checkWinnerLastMove'
import { checkForbiddenMove, getWinningChain } from '../lib/game/gomokuRules'
import { AudioManager } from '../lib/AudioManager'
import type { TentativeStone, Swap2Phase } from '../types/swap2'

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

type Player = 'X' | 'O'
type BoardState = Record<string, Player>

interface GameBoardProps {
  size?: number
  cellSizePx?: number
  enableForbidden?: boolean
  disabled?: boolean
  board?: BoardState
  currentPlayer?: Player | null
  winner?: Player | null
  winningChain?: Array<[number, number]>
  myPlayerSide?: Player
  onMove?: (x: number, y: number, player: Player) => void
  onWin?: (winner: Player, chain: Array<[number, number]>) => void
  onReset?: () => void
  // Swap 2 props - Requirements: 2.1, 2.3, 5.2, 5.4
  swap2Phase?: Swap2Phase | null
  tentativeStones?: TentativeStone[]
  isSwap2Active?: boolean
  onSwap2PlaceStone?: (x: number, y: number) => void
  // Initial board state (for swap2 completion)
  initialBoard?: BoardState
  initialCurrentPlayer?: Player
}

export default function GameBoard({
  size = 15,
  cellSizePx = 40,
  enableForbidden = true,
  disabled = false,
  board: externalBoard,
  currentPlayer: externalCurrentPlayer,
  winner: externalWinner,
  winningChain: externalWinningChain,
  myPlayerSide,
  onMove,
  onWin,
  onReset,
  // Swap 2 props - Requirements: 2.1, 2.3
  swap2Phase,
  tentativeStones = [],
  isSwap2Active = false,
  onSwap2PlaceStone,
  // Initial board state (for swap2 completion)
  initialBoard,
  initialCurrentPlayer
}: GameBoardProps) {
  const [internalBoard, setInternalBoard] = React.useState<BoardState>(initialBoard ?? {})
  const [internalCurrentPlayer, setInternalCurrentPlayer] = React.useState<Player>(initialCurrentPlayer ?? 'X')
  
  // Update internal state when initial values change (e.g., after swap2 completion)
  React.useEffect(() => {
    if (initialBoard) {
      setInternalBoard(initialBoard)
    }
  }, [initialBoard])
  
  React.useEffect(() => {
    if (initialCurrentPlayer) {
      setInternalCurrentPlayer(initialCurrentPlayer)
    }
  }, [initialCurrentPlayer])
  const [internalWinner, setInternalWinner] = React.useState<Player | null>(null)
  const [internalWinningChain, setInternalWinningChain] = React.useState<Array<[number, number]>>([])
  const [lastMove, setLastMove] = React.useState<[number, number] | null>(null)
  const [hoverCell, setHoverCell] = React.useState<[number, number] | null>(null)
  const [forbiddenCells, setForbiddenCells] = React.useState<Set<string>>(new Set())
  const previousControlledBoard = React.useRef<BoardState>({})

  const isControlled = externalBoard !== undefined
  const board = isControlled ? externalBoard ?? {} : internalBoard
  // Use external currentPlayer if provided, otherwise use internal state
  // This allows Hotseat to control turn order after Swap2 without full controlled mode
  const currentPlayer = externalCurrentPlayer !== undefined 
    ? externalCurrentPlayer 
    : (isControlled ? null : internalCurrentPlayer)
  const winner = isControlled ? externalWinner ?? null : internalWinner
  const winningChain = isControlled ? externalWinningChain ?? [] : internalWinningChain

  React.useEffect(() => {
    if (!enableForbidden || winner || currentPlayer !== 'X') {
      setForbiddenCells(new Set())
      return
    }

    const forbidden = new Set<string>()
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const key = `${x}_${y}`
        if (board[key]) continue

        const check = checkForbiddenMove(board, x, y, 'X')
        if (check.isForbidden) {
          forbidden.add(key)
        }
      }
    }
    setForbiddenCells(forbidden)
  }, [board, currentPlayer, winner, size, enableForbidden])

  React.useEffect(() => {
    if (!isControlled) return
    const prev = previousControlledBoard.current
    const prevKeys = Object.keys(prev)
    const nextKeys = Object.keys(board)

    if (nextKeys.length > prevKeys.length) {
      const newKey = nextKeys.find(key => !prev[key])
      if (newKey) {
        const [lx, ly] = newKey.split('_').map(Number)
        setLastMove([lx, ly])
      }
    }

    previousControlledBoard.current = board
  }, [board, isControlled])

  const handleClick = React.useCallback((x: number, y: number) => {
    if (winner || disabled) return

    const key = `${x}_${y}`
    
    // Swap 2 phase handling - Requirements: 2.1, 2.3
    if (isSwap2Active && onSwap2PlaceStone) {
      // Check if position is occupied by tentative stones
      const isOccupiedByTentative = tentativeStones.some(s => s.x === x && s.y === y)
      if (isOccupiedByTentative) {
        console.log('Position occupied by tentative stone')
        AudioManager.playSoundEffect('error')
        if (navigator.vibrate) {
          const vibrationEnabled = document.body.getAttribute('data-vibration-enabled') === 'true'
          if (vibrationEnabled) {
            navigator.vibrate([50, 30, 50])
          }
        }
        return
      }
      
      // Only allow placement in placement phases
      if (swap2Phase === 'swap2_placement' || swap2Phase === 'swap2_extra') {
        AudioManager.playSoundEffect('move')
        if (navigator.vibrate) {
          const vibrationEnabled = document.body.getAttribute('data-vibration-enabled') === 'true'
          if (vibrationEnabled) {
            navigator.vibrate(30)
          }
        }
        onSwap2PlaceStone(x, y)
      }
      return
    }

    if (board[key]) return

    if (enableForbidden && currentPlayer === 'X') {
      const check = checkForbiddenMove(board, x, y, 'X')
      if (check.isForbidden) {
        console.log(`Forbidden move: ${check.reason}`)
        // Play error sound and vibrate for forbidden move
        AudioManager.playSoundEffect('error')
        if (navigator.vibrate) {
          const vibrationEnabled = document.body.getAttribute('data-vibration-enabled') === 'true'
          if (vibrationEnabled) {
            navigator.vibrate([50, 30, 50]) // Short error pattern
          }
        }
        return
      }
    }

    if (isControlled) {
      if (myPlayerSide && currentPlayer && myPlayerSide !== currentPlayer) {
        console.log(`Not your turn. Current: ${currentPlayer}, You are: ${myPlayerSide}`)
        return
      }

      if (onMove) {
        const actingPlayer = myPlayerSide ?? currentPlayer ?? 'X'
        // Play move sound and vibrate
        AudioManager.playSoundEffect('move')
        if (navigator.vibrate) {
          const vibrationEnabled = document.body.getAttribute('data-vibration-enabled') === 'true'
          if (vibrationEnabled) {
            navigator.vibrate(30) // Short tap
          }
        }
        onMove(x, y, actingPlayer)
      }
      return
    }

    const actingPlayer = currentPlayer ?? 'X'
    const nextBoard = { ...board, [key]: actingPlayer }
    setInternalBoard(nextBoard)
    setLastMove([x, y])
    
    // Play move sound and vibrate
    AudioManager.playSoundEffect('move')
    if (navigator.vibrate) {
      const vibrationEnabled = document.body.getAttribute('data-vibration-enabled') === 'true'
      if (vibrationEnabled) {
        navigator.vibrate(30) // Short tap
      }
    }

    if (onMove) {
      onMove(x, y, actingPlayer)
    }

    if (Object.keys(nextBoard).length >= 5) {
      const result = checkWinnerLastMove(nextBoard, x, y)
      if (result) {
        setInternalWinner(result)
        const chain = getWinningChain(nextBoard, x, y) || []
        setInternalWinningChain(chain)
        
        // Play win/lose sound and vibrate
        const isPlayerWin = result === myPlayerSide
        AudioManager.playSoundEffect(isPlayerWin ? 'win' : 'lose')
        if (navigator.vibrate) {
          const vibrationEnabled = document.body.getAttribute('data-vibration-enabled') === 'true'
          if (vibrationEnabled) {
            if (isPlayerWin) {
              navigator.vibrate([100, 50, 100, 50, 200]) // Victory pattern
            } else {
              navigator.vibrate([200, 100, 200]) // Defeat pattern
            }
          }
        }
        
        if (onWin) {
          onWin(result, chain)
        }
        return
      }
    }

    setInternalCurrentPlayer(prev => (prev === 'X' ? 'O' : 'X'))
  }, [board, currentPlayer, winner, disabled, enableForbidden, isControlled, myPlayerSide, onMove, onWin, isSwap2Active, onSwap2PlaceStone, swap2Phase, tentativeStones])

  const handleMouseEnter = React.useCallback((x: number, y: number) => {
    if (winner || disabled || board[`${x}_${y}`]) return
    if (isControlled && myPlayerSide && currentPlayer && currentPlayer !== myPlayerSide) {
      return
    }
    setHoverCell([x, y])
  }, [board, winner, disabled, isControlled, myPlayerSide, currentPlayer])

  const handleMouseLeave = React.useCallback(() => {
    setHoverCell(null)
  }, [])

  const resetGame = React.useCallback(() => {
    if (!isControlled) {
      setInternalBoard({})
      setInternalCurrentPlayer('X')
      setInternalWinner(null)
      setInternalWinningChain([])
    }
    setLastMove(null)
    setHoverCell(null)
    setForbiddenCells(new Set())
    if (onReset) {
      onReset()
    }
  }, [isControlled, onReset])

  const isWinningCell = (x: number, y: number) => winningChain.some(([cx, cy]) => cx === x && cy === y)
  const isLastMoveCell = (x: number, y: number) => lastMove !== null && lastMove[0] === x && lastMove[1] === y
  const isHoverCell = (x: number, y: number) => hoverCell !== null && hoverCell[0] === x && hoverCell[1] === y
  const isForbiddenCell = (x: number, y: number) => forbiddenCells.has(`${x}_${y}`)

  const isStarPoint = (x: number, y: number) => {
    if (size !== 15) return false
    return (x === 3 || x === 7 || x === 11) && (y === 3 || y === 7 || y === 11)
  }

  // Mobile detection and refs for zoom/scroll
  const isMobile = useIsMobile()
  const boardRef = React.useRef<HTMLDivElement>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to last move position on mobile
  React.useEffect(() => {
    if (!isMobile || !lastMove || !scrollContainerRef.current || !boardRef.current) return
    
    const container = scrollContainerRef.current
    const board = boardRef.current
    const [lx, ly] = lastMove
    
    // Calculate cell position
    const cellSize = board.offsetWidth / size
    const targetX = lx * cellSize + cellSize / 2
    const targetY = ly * cellSize + cellSize / 2
    
    // Scroll to center the last move
    const scrollX = targetX - container.offsetWidth / 2
    const scrollY = targetY - container.offsetHeight / 2
    
    container.scrollTo({
      left: Math.max(0, scrollX),
      top: Math.max(0, scrollY),
      behavior: 'smooth'
    })
  }, [lastMove, isMobile, size])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
      padding: '4px',
      width: '100%',
      maxWidth: isMobile ? '100%' : 'none'
    }}>
      {/* Mobile: scrollable container for zoom effect */}
      {isMobile ? (
        <div 
          ref={scrollContainerRef}
          className="game-board-zoom-container"
          style={{
            width: '100%',
            aspectRatio: '1',
            overflow: 'auto',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #d4a574, #c49563)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
          }}
        >
          {renderBoard()}
        </div>
      ) : (
        renderBoard()
      )}

      <style>{`
        @keyframes piecePlace {
          0% { transform: scale(0) rotate(0deg); opacity: 0; }
          50% { transform: scale(1.15) rotate(180deg); }
          100% { transform: scale(1) rotate(360deg); opacity: 1; }
        }

        @keyframes winPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.95); }
        }
        
        @keyframes lastMoveHighlight {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
      `}</style>
    </div>
  )

  // Extracted board rendering function
  function renderBoard() {
    // Mobile: calculate cell size based on viewport
    const mobileCell = isMobile ? Math.floor((window.innerWidth - 16) / size) : 0
    const cell = isMobile ? Math.max(24, mobileCell) : Math.max(20, Math.min(64, Math.round(cellSizePx)))
    const stone = Math.max(12, cell - 6)
    const hoverStone = stone
    const starDot = Math.max(4, Math.round(cell * 0.2))
    const boardPadding = isMobile ? 4 : 8
    const lastBorder = Math.max(2, Math.round(cell * 0.08))
    const forbidFont = Math.max(12, Math.round(cell * 0.6))

    return (
      <div 
        ref={boardRef}
        style={{
          display: 'inline-grid',
            gridTemplateColumns: `repeat(${size}, ${cell}px)`,
            gap: 0,
            background: 'linear-gradient(135deg, #d4a574, #c49563)',
            padding: `${boardPadding}px`,
            borderRadius: '12px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            position: 'relative'
          }}>
            {Array.from({ length: size }).map((_, y) =>
              Array.from({ length: size }).map((_, x) => {
                const key = `${x}_${y}`
                const piece = board[key]
                const winCell = isWinningCell(x, y)
                const lastCell = isLastMoveCell(x, y)
                const hover = isHoverCell(x, y)
                const forbidden = isForbiddenCell(x, y)
                const myTurn = !isControlled || !myPlayerSide || !currentPlayer || currentPlayer === myPlayerSide
                
                // Swap 2: Check for tentative stone at this position - Requirements: 5.2, 5.4
                const tentativeStone = tentativeStones.find(s => s.x === x && s.y === y)
                const hasTentativeStone = !!tentativeStone
                const latestTentativeOrder = tentativeStones.length > 0 
                  ? Math.max(...tentativeStones.map(s => s.placementOrder)) 
                  : 0
                const isLatestTentative = tentativeStone?.placementOrder === latestTentativeOrder
                
                // During Swap 2, allow clicks on empty cells in placement phases
                const canClickSwap2 = isSwap2Active && 
                  (swap2Phase === 'swap2_placement' || swap2Phase === 'swap2_extra') &&
                  !hasTentativeStone && !piece && !disabled
                
                const canClick = canClickSwap2 || (!winner && !piece && !hasTentativeStone && myTurn && !forbidden && !disabled && !isSwap2Active)

                return (
                  <div
                    key={key}
                    onClick={() => canClick && handleClick(x, y)}
                    onMouseEnter={() => handleMouseEnter(x, y)}
                    onMouseLeave={handleMouseLeave}
                    style={{
                      width: `${cell}px`,
                      height: `${cell}px`,
                      border: '1px solid #8b6f47',
                      background: winCell
                        ? 'rgba(255, 215, 0, 0.4)'
                        : forbidden
                        ? 'rgba(255, 0, 0, 0.15)'
                        : 'transparent',
                      cursor: canClick ? 'pointer' : forbidden ? 'not-allowed' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    {isStarPoint(x, y) && !piece && !hasTentativeStone && (
                      <div style={{
                        width: `${starDot}px`,
                        height: `${starDot}px`,
                        borderRadius: '50%',
                        background: '#8b6f47',
                        position: 'absolute'
                      }} />
                    )}

                    {/* Tentative stone during Swap 2 - Requirements: 5.2, 5.4 */}
                    {hasTentativeStone && tentativeStone && (() => {
                      // Stone color based on placement order: 1,3,4 = Black(X); 2,5 = White(O)
                      const isBlackStone = tentativeStone.placementOrder === 1 || tentativeStone.placementOrder === 3 || tentativeStone.placementOrder === 4
                      return (
                        <div style={{
                          width: `${stone}px`,
                          height: `${stone}px`,
                          borderRadius: '50%',
                          position: 'relative',
                          zIndex: 10,
                          background: isBlackStone
                            ? 'radial-gradient(circle at 35% 35%, #666, #000)'
                            : 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
                          boxShadow: isBlackStone
                            ? '0 3px 6px rgba(0,0,0,0.6), inset 0 -2px 4px rgba(0,0,0,0.4)'
                            : '0 3px 6px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.15)',
                          border: isLatestTentative 
                            ? `3px solid ${isBlackStone ? '#3b82f6' : '#ef4444'}`
                            : '2px dashed rgba(148, 163, 184, 0.5)',
                          animation: isLatestTentative ? 'piecePlace 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {/* Placement order number */}
                          <span style={{
                            fontSize: `${Math.max(10, stone * 0.4)}px`,
                            fontWeight: 700,
                            color: isBlackStone
                              ? 'rgba(255,255,255,0.7)'
                              : 'rgba(0,0,0,0.5)',
                            textShadow: isBlackStone
                              ? '0 1px 2px rgba(0,0,0,0.5)'
                              : '0 1px 2px rgba(255,255,255,0.5)'
                          }}>
                            {tentativeStone.placementOrder}
                          </span>
                        </div>
                      )
                    })()}

                    {piece && !hasTentativeStone && (
                      <div style={{
                        width: `${stone}px`,
                        height: `${stone}px`,
                        borderRadius: '50%',
                        background: piece === 'X'
                          ? 'radial-gradient(circle at 35% 35%, #666, #000)'
                          : 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
                        boxShadow: piece === 'X'
                          ? '0 3px 6px rgba(0,0,0,0.6), inset 0 -2px 4px rgba(0,0,0,0.4)'
                          : '0 3px 6px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.15)',
                        animation: lastCell ? 'piecePlace 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
                        border: lastCell ? `${lastBorder}px solid ${piece === 'X' ? '#3b82f6' : '#ef4444'}` : 'none',
                        position: 'relative',
                        zIndex: 10
                      }} />
                    )}

                    {!piece && hover && !winner && !forbidden && canClick && (
                      <div style={{
                        width: `${hoverStone}px`,
                        height: `${hoverStone}px`,
                        borderRadius: '50%',
                        background: currentPlayer === 'X'
                          ? 'radial-gradient(circle at 35% 35%, rgba(102,102,102,0.5), rgba(0,0,0,0.5))'
                          : 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.5), rgba(204,204,204,0.5))',
                        border: `2px dashed ${currentPlayer === 'X' ? '#3b82f6' : '#ef4444'}`,
                        opacity: 0.8,
                        animation: 'pulse 1s ease infinite'
                      }} />
                    )}

                    {!piece && forbidden && !winner && (
                      <div style={{
                        fontSize: `${forbidFont}px`,
                        color: '#dc2626',
                        opacity: 0.7,
                        fontWeight: 'bold'
                      }}>
                        ✕
                      </div>
                    )}

                    {winCell && (
                      <div style={{
                        position: 'absolute',
                        inset: '-2px',
                        border: '3px solid gold',
                        borderRadius: '6px',
                        boxShadow: '0 0 16px rgba(255, 215, 0, 0.8)',
                        animation: 'winPulse 1.5s ease infinite',
                        zIndex: 5
                      }} />
                    )}
                  </div>
                )
              })
            )}
          </div>
        )
      }
}
