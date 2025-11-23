import React from 'react'
import GameBoard from '../components/GameBoard'

type PlayerSide = 'X' | 'O'

const STORAGE_KEY = 'hotseatConfig'
const SIDE_LABEL: Record<PlayerSide, string> = {
  X: 'Quân Đen',
  O: 'Quân Trắng'
}

interface PlayerCardProps {
  side: PlayerSide
  name: string
  score: number
  isTurn: boolean
  isLastWinner: boolean
  onNameChange: (value: string) => void
}

function PlayerCard({ side, name, score, isTurn, isLastWinner, onNameChange }: PlayerCardProps) {
  const accent = side === 'X' ? '#3b82f6' : '#ef4444'
  const fallbackName = SIDE_LABEL[side]

  return (
    <div
      className="hotseat-player-card"
      style={{
        width: '260px',
        padding: '24px',
        borderRadius: '18px',
        background: 'rgba(15, 23, 42, 0.75)',
        border: `2px solid ${isTurn ? accent : 'rgba(148, 163, 184, 0.2)'}`,
        boxShadow: isTurn
          ? `0 12px 30px rgba(59, 130, 246, 0.35)`
          : '0 8px 24px rgba(15, 23, 42, 0.6)',
        transition: 'all 0.25s ease',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: side === 'X'
              ? 'radial-gradient(circle at 30% 30%, #555, #000)'
              : 'radial-gradient(circle at 30% 30%, #fff, #ddd)',
            boxShadow: '0 4px 10px rgba(0,0,0,0.45)'
          }}
        />
        <div>
          <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(226,232,240,0.7)' }}>
            {SIDE_LABEL[side]}
          </div>
          <input
            type="text"
            maxLength={24}
            value={name}
            placeholder={fallbackName}
            onChange={(e) => onNameChange(e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: 0,
              marginTop: '2px',
              fontSize: '20px',
              fontWeight: 700,
              color: '#fff',
              outline: 'none'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '18px' }}>
        <div
          style={{
            padding: '10px 18px',
            borderRadius: '999px',
            background: 'rgba(15,23,42,0.6)',
            border: `1px solid ${accent}`,
            color: '#e2e8f0',
            fontWeight: 600
          }}
        >
          Tỉ số: {score}
        </div>
        {isTurn && (
          <span
            style={{
              fontSize: '13px',
              color: accent,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}
          >
            Lượt đi
          </span>
        )}
        {isLastWinner && !isTurn && (
          <span
            style={{
              fontSize: '13px',
              color: '#fcd34d',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}
          >
            Ván trước thắng
          </span>
        )}
      </div>
    </div>
  )
}

export default function Hotseat() {
  const [playerNames, setPlayerNames] = React.useState<Record<PlayerSide, string>>({
    X: 'Bạn',
    O: 'Đạo hữu'
  })
  const [scores, setScores] = React.useState<Record<PlayerSide, number>>({ X: 0, O: 0 })
  const [currentTurn, setCurrentTurn] = React.useState<PlayerSide>('X')
  const [status, setStatus] = React.useState('Chạm để bắt đầu ván đầu tiên, Quân Đen đi trước.')
  const [forbiddenEnabled, setForbiddenEnabled] = React.useState(true)
  const [roundResolved, setRoundResolved] = React.useState(false)
  const [lastWinner, setLastWinner] = React.useState<PlayerSide | null>(null)
  const [boardSeed, setBoardSeed] = React.useState(0)

  // Load persisted setup for smoother resume between visits
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return
      const parsed = JSON.parse(saved)
      if (parsed.names) {
        setPlayerNames((prev) => ({ ...prev, ...parsed.names }))
      }
      if (parsed.scores) {
        setScores((prev) => ({ ...prev, ...parsed.scores }))
      }
      if (typeof parsed.forbiddenEnabled === 'boolean') {
        setForbiddenEnabled(parsed.forbiddenEnabled)
      }
    } catch (error) {
      console.warn('Không thể đọc cấu hình Tiêu Dao:', error)
    }
  }, [])

  // Persist whenever settings change so players do not lose progress mid-session
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          names: playerNames,
          scores,
          forbiddenEnabled
        })
      )
    } catch (error) {
      console.warn('Không thể lưu cấu hình Tiêu Dao:', error)
    }
  }, [playerNames, scores, forbiddenEnabled])

  const handleNameChange = React.useCallback((side: PlayerSide, value: string) => {
    const sanitized = value.slice(0, 24)
    setPlayerNames((prev) => ({ ...prev, [side]: sanitized }))
  }, [])

  const resetRoundState = React.useCallback(() => {
    setCurrentTurn('X')
    setStatus('Chạm để bắt đầu ván mới, Quân Đen đi trước.')
    setRoundResolved(false)
    setLastWinner(null)
  }, [])

  const handleManualReset = React.useCallback(() => {
    resetRoundState()
    setBoardSeed((prev) => prev + 1)
  }, [resetRoundState])

  const handleMove = React.useCallback(
    (_x: number, _y: number, player: PlayerSide) => {
      const next = player === 'X' ? 'O' : 'X'
      setCurrentTurn(next)
      const nextName = playerNames[next] || SIDE_LABEL[next]
      setStatus(`Tới lượt ${nextName}`)
    },
    [playerNames]
  )

  const handleWin = React.useCallback(
    (winner: PlayerSide) => {
      if (roundResolved) return
      setRoundResolved(true)
      setScores((prev) => ({ ...prev, [winner]: prev[winner] + 1 }))
      const winnerName = playerNames[winner] || SIDE_LABEL[winner]
      setStatus(`${winnerName} thắng ván này!`)
      setLastWinner(winner)
    },
    [playerNames, roundResolved]
  )

  const handleBoardReset = React.useCallback(() => {
    resetRoundState()
  }, [resetRoundState])

  const handleSwapSides = React.useCallback(() => {
    setPlayerNames((prev) => ({ X: prev.O || SIDE_LABEL.O, O: prev.X || SIDE_LABEL.X }))
    setScores((prev) => ({ X: prev.O, O: prev.X }))
    handleManualReset()
  }, [handleManualReset])

  const handleResetScores = React.useCallback(() => {
    setScores({ X: 0, O: 0 })
    handleManualReset()
  }, [handleManualReset])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top, #0f172a 0%, #020617 70%)',
        color: '#e2e8f0',
        paddingBottom: '50px'
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>
        <nav className="breadcrumb-nav" style={{ paddingLeft: 0 }}>
          <a href="#home">Chánh Điện</a>
          <span>›</span>
          <span className="breadcrumb-current">Tiêu Dao</span>
        </nav>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: '28px', color: '#fff', letterSpacing: '0.04em' }}>
              Tiêu Dao • 1 Máy 2 Người
            </h1>
            <p style={{ margin: '6px 0 0', color: 'rgba(226,232,240,0.75)' }}>
              Chạm để đặt quân, cùng một thiết bị nhưng tận hưởng cảm giác thi đấu thực thụ.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(15,23,42,0.6)',
                padding: '8px 12px',
                borderRadius: '999px',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                fontSize: '13px'
              }}
            >
              <input
                type="checkbox"
                checked={forbiddenEnabled}
                onChange={() => setForbiddenEnabled((prev) => !prev)}
              />
              Cấm 3-3 / 4-4 cho Đen
            </label>
            <button
              onClick={handleSwapSides}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(59, 130, 246, 0.8)',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#bfdbfe',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Đổi bên
            </button>
            <button
              onClick={handleManualReset}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(99, 102, 241, 0.8)',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#c7d2fe',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Ván mới
            </button>
            <button
              onClick={handleResetScores}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(248, 113, 113, 0.8)',
                background: 'rgba(248, 113, 113, 0.15)',
                color: '#fecaca',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Xóa tỉ số
            </button>
          </div>
        </header>

        <div
          style={{
            marginTop: '24px',
            padding: '14px 20px',
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            fontSize: '16px',
            fontWeight: 600,
            color: '#cbd5f5'
          }}
        >
          {status}
        </div>

        <div
          style={{
            marginTop: '32px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '24px',
            alignItems: 'start'
          }}
        >
          <PlayerCard
            side="X"
            name={playerNames.X}
            score={scores.X}
            isTurn={!roundResolved && currentTurn === 'X'}
            isLastWinner={lastWinner === 'X'}
            onNameChange={(value) => handleNameChange('X', value)}
          />

          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              borderRadius: '24px',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.65)'
            }}
          >
            <GameBoard
              key={boardSeed}
              enableForbidden={forbiddenEnabled}
              onMove={handleMove}
              onWin={handleWin}
              onReset={handleBoardReset}
            />
          </div>

          <PlayerCard
            side="O"
            name={playerNames.O}
            score={scores.O}
            isTurn={!roundResolved && currentTurn === 'O'}
            isLastWinner={lastWinner === 'O'}
            onNameChange={(value) => handleNameChange('O', value)}
          />
        </div>
      </div>
    </div>
  )
}
