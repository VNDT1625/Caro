import React from 'react'
import { checkWinnerLastMove } from '../lib/game/checkWinnerLastMove'
import { checkForbiddenMove, getWinningChain } from '../lib/game/gomokuRules'

type Player = 'X' | 'O'
type BoardState = Record<string, Player>

interface GameBoardProps {
  size?: number
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
}

export default function GameBoard({
  size = 15,
  enableForbidden = true,
  disabled = false,
  board: externalBoard,
  currentPlayer: externalCurrentPlayer,
  winner: externalWinner,
  winningChain: externalWinningChain,
  myPlayerSide,
  onMove,
  onWin,
  onReset
}: GameBoardProps) {
  const [internalBoard, setInternalBoard] = React.useState<BoardState>({})
  const [internalCurrentPlayer, setInternalCurrentPlayer] = React.useState<Player>('X')
  const [internalWinner, setInternalWinner] = React.useState<Player | null>(null)
  const [internalWinningChain, setInternalWinningChain] = React.useState<Array<[number, number]>>([])
  const [lastMove, setLastMove] = React.useState<[number, number] | null>(null)
  const [hoverCell, setHoverCell] = React.useState<[number, number] | null>(null)
  const [forbiddenCells, setForbiddenCells] = React.useState<Set<string>>(new Set())
  const previousControlledBoard = React.useRef<BoardState>({})

  const isControlled = externalBoard !== undefined
  const board = isControlled ? externalBoard ?? {} : internalBoard
  const currentPlayer = isControlled ? externalCurrentPlayer ?? null : internalCurrentPlayer
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
    if (board[key]) return

    if (enableForbidden && currentPlayer === 'X') {
      const check = checkForbiddenMove(board, x, y, 'X')
      if (check.isForbidden) {
        console.log(`Forbidden move: ${check.reason}`)
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
        onMove(x, y, actingPlayer)
      }
      return
    }

    const actingPlayer = currentPlayer ?? 'X'
    const nextBoard = { ...board, [key]: actingPlayer }
    setInternalBoard(nextBoard)
    setLastMove([x, y])

    if (onMove) {
      onMove(x, y, actingPlayer)
    }

    if (Object.keys(nextBoard).length >= 5) {
      const result = checkWinnerLastMove(nextBoard, x, y)
      if (result) {
        setInternalWinner(result)
        const chain = getWinningChain(nextBoard, x, y) || []
        setInternalWinningChain(chain)
        if (onWin) {
          onWin(result, chain)
        }
        return
      }
    }

    setInternalCurrentPlayer(prev => (prev === 'X' ? 'O' : 'X'))
  }, [board, currentPlayer, winner, disabled, enableForbidden, isControlled, myPlayerSide, onMove, onWin])

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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
      padding: '20px'
    }}>
      <div style={{
        display: 'flex',
        gap: '30px',
        alignItems: 'center',
        fontSize: '18px',
        fontWeight: 600
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '8px',
          background: currentPlayer === 'X' && !winner
            ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
            : 'transparent',
          color: currentPlayer === 'X' && !winner ? 'white' : '#374151',
          border: `2px solid ${currentPlayer === 'X' && !winner ? '#3b82f6' : '#e5e7eb'}`,
          transition: 'all 0.3s ease',
          opacity: isControlled && myPlayerSide === 'O' ? 0.65 : 1
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #555, #000)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }} />
          <span>Quân Đen</span>
          {currentPlayer === 'X' && !winner && <span>← Lượt đi</span>}
          {isControlled && myPlayerSide === 'X' && <span style={{ fontSize: '14px', opacity: 0.85 }}>(Bạn)</span>}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '8px',
          background: currentPlayer === 'O' && !winner
            ? 'linear-gradient(135deg, #ef4444, #dc2626)'
            : 'transparent',
          color: currentPlayer === 'O' && !winner ? 'white' : '#374151',
          border: `2px solid ${currentPlayer === 'O' && !winner ? '#ef4444' : '#e5e7eb'}`,
          transition: 'all 0.3s ease',
          opacity: isControlled && myPlayerSide === 'X' ? 0.65 : 1
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #fff, #ddd)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }} />
          <span>Quân Trắng</span>
          {currentPlayer === 'O' && !winner && <span>← Lượt đi</span>}
          {isControlled && myPlayerSide === 'O' && <span style={{ fontSize: '14px', opacity: 0.85 }}>(Bạn)</span>}
        </div>
      </div>

      {winner && (
        <div style={{
          padding: '16px 32px',
          background: winner === 'X'
            ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
            : 'linear-gradient(135deg, #ef4444, #dc2626)',
          color: 'white',
          borderRadius: '12px',
          fontSize: '24px',
          fontWeight: 'bold',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
        }}>
          🎉 {winner === 'X' ? 'Quân Đen' : 'Quân Trắng'} Thắng! 🎉
          {isControlled && myPlayerSide && (
            <div style={{ fontSize: '16px', marginTop: '8px', opacity: 0.9 }}>
              {winner === myPlayerSide ? '🏆 Bạn thắng!' : '😔 Bạn thua!'}
            </div>
          )}
        </div>
      )}

      <div style={{
        display: 'inline-grid',
        gridTemplateColumns: `repeat(${size}, 40px)`,
        gap: 0,
        background: 'linear-gradient(135deg, #d4a574, #c49563)',
        padding: '24px',
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
            const canClick = !winner && !piece && myTurn && !forbidden && !disabled

            return (
              <div
                key={key}
                onClick={() => canClick && handleClick(x, y)}
                onMouseEnter={() => handleMouseEnter(x, y)}
                onMouseLeave={handleMouseLeave}
                style={{
                  width: '40px',
                  height: '40px',
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
                {isStarPoint(x, y) && !piece && (
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#8b6f47',
                    position: 'absolute'
                  }} />
                )}

                {piece && (
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: piece === 'X'
                      ? 'radial-gradient(circle at 35% 35%, #666, #000)'
                      : 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
                    boxShadow: piece === 'X'
                      ? '0 3px 6px rgba(0,0,0,0.6), inset 0 -2px 4px rgba(0,0,0,0.4)'
                      : '0 3px 6px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.15)',
                    animation: lastCell ? 'piecePlace 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
                    border: lastCell ? `3px solid ${piece === 'X' ? '#3b82f6' : '#ef4444'}` : 'none',
                    position: 'relative',
                    zIndex: 10
                  }} />
                )}

                {!piece && hover && !winner && !forbidden && canClick && (
                  <div style={{
                    width: '34px',
                    height: '34px',
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
                    fontSize: '24px',
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

      <div style={{
        display: 'flex',
        gap: '20px',
        fontSize: '14px',
        color: '#6b7280'
      }}>
        <div>Nước đi: {Object.keys(board).length}</div>
        {enableForbidden && currentPlayer === 'X' && (
          <div>Ô cấm: {forbiddenCells.size}</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {(!isControlled || !myPlayerSide) && (
          <button
            onClick={resetGame}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}
          >
            ↻ Ván mới
          </button>
        )}

        {enableForbidden && (
          <div style={{
            padding: '12px 20px',
            background: 'rgba(220, 38, 38, 0.1)',
            border: '2px solid rgba(220, 38, 38, 0.3)',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 500
          }}>
            ⚠️ Cấm 3-3 / 4-4 cho Đen
          </div>
        )}
      </div>

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
      `}</style>
    </div>
  )
}
