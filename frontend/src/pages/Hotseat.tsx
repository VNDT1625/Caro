import React from 'react'
import GameBoard from '../components/GameBoard'
import { useLanguage } from '../contexts/LanguageContext'

type PlayerSide = 'X' | 'O'

const STORAGE_KEY = 'hotseatConfig'

interface PlayerCardProps {
  side: PlayerSide
  name: string
  score: number
  isTurn: boolean
  isLastWinner: boolean
  onNameChange: (value: string) => void
  timeEnabled?: boolean
  secondsRemaining?: number
  totalTimeSec?: number
}

function PlayerCard({ side, name, score, isTurn, isLastWinner, onNameChange, timeEnabled, secondsRemaining, totalTimeSec }: PlayerCardProps) {
  const { t } = useLanguage()
  const accent = side === 'X' ? '#3b82f6' : '#ef4444'
  const glowColor = side === 'X' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(239, 68, 68, 0.4)'
  const sideLabel = side === 'X' ? t('hotseat.sideBlack') : t('hotseat.sideWhite')
  const fallbackName = sideLabel
  const mm = Math.floor((secondsRemaining ?? 0) / 60)
  const ss = Math.max(0, (secondsRemaining ?? 0) % 60)
  const timeText = `${mm}:${ss.toString().padStart(2, '0')}`
  const pct = totalTimeSec && totalTimeSec > 0 ? Math.max(0, Math.min(100, Math.round(((secondsRemaining ?? 0) / totalTimeSec) * 100))) : 0
  const padTop = 10 + (isTurn && timeEnabled ? 6 : 0)
  const padBottom = 10 + (isTurn && timeEnabled ? 12 : 0)

  return (
    <div
      style={{
        position: 'relative',
        padding: `${padTop}px 10px ${padBottom}px`,
        borderRadius: '12px',
        background: 'rgba(15, 23, 42, 0.7)',
        border: `1px solid ${isTurn ? accent : 'rgba(148, 163, 184, 0.2)'}`,
        boxShadow: isTurn ? `0 0 18px ${glowColor}` : 'none',
        transition: 'all 0.25s ease',
        transform: isTurn ? 'translateY(-2px)' : 'none',
        width: 240
      }}
    >
      {/* Glow effect when active */}
      {isTurn && (
        <div
          style={{
            position: 'absolute',
            top: '-2px',
            left: '-2px',
            right: '-2px',
            bottom: '-2px',
            background: `linear-gradient(135deg, ${accent}, transparent)`,
            borderRadius: '20px',
            opacity: 0.3,
            filter: 'blur(8px)',
            zIndex: -1,
            animation: 'pulse 2s ease-in-out infinite'
          }}
        />
      )}

      {/* Timer badge on active turn */}
      {isTurn && timeEnabled && (
        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ padding: '2px 6px', borderRadius: 8, border: `1px solid ${accent}66`, background: 'rgba(15,23,42,0.8)', color: '#E2E8F0', fontSize: 12, fontWeight: 700 }}>
            ⏱ {timeText}
          </div>
        </div>
      )}

      {/* Player Avatar & Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: side === 'X'
              ? 'radial-gradient(circle at 30% 30%, #4a4a4a, #000)'
              : 'radial-gradient(circle at 30% 30%, #fff, #d1d1d1)',
            border: `2px solid ${isTurn ? accent : 'rgba(148, 163, 184, 0.3)'}`,
            boxShadow: isTurn ? `0 6px 12px ${glowColor}` : 'none',
            transition: 'all 0.4s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 700,
            color: side === 'X' ? '#fff' : '#000'
          }}
        >
          {side}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '9px', 
            textTransform: 'uppercase', 
            letterSpacing: '0.1em', 
            color: 'rgba(226,232,240,0.6)',
            marginBottom: '2px',
            fontWeight: 600
          }}>
            {sideLabel}
          </div>
          <input
            type="text"
            maxLength={24}
            value={name}
            placeholder={fallbackName}
            onChange={(e) => onNameChange(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(15, 23, 42, 0.4)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '8px',
              padding: '5px 8px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#fff',
              outline: 'none',
              transition: 'all 0.3s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = accent
              e.target.style.background = 'rgba(15, 23, 42, 0.6)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(148, 163, 184, 0.2)'
              e.target.style.background = 'rgba(15, 23, 42, 0.4)'
            }}
          />
          {timeEnabled && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>
              ⏱ {timeText}
            </div>
          )}
        </div>
      </div>

      {/* Small turn badge */}
      {isTurn && (
        <div
          style={{
            marginTop: 6,
            padding: '3px 8px',
            borderRadius: '12px',
            background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
            color: '#fff',
            fontSize: '10px',
            fontWeight: 700,
            width: 'fit-content'
          }}
        >
          ⚡ {t('hotseat.turn')}
        </div>
      )}

      {/* Time progress bar at bottom when active */}
      {isTurn && timeEnabled && (
        <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, height: 6, borderRadius: 6, background: 'rgba(148,163,184,0.2)' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 6, background: accent, transition: 'width 0.3s linear' }} />
        </div>
      )}
    </div>
  )
}

export default function Hotseat() {
  const { t } = useLanguage()
  const [playerNames, setPlayerNames] = React.useState<Record<PlayerSide, string>>({
    X: 'Người chơi 1',
    O: 'Người chơi 2'
  })
  const [scores, setScores] = React.useState<Record<PlayerSide, number>>({ X: 0, O: 0 })
  const [currentTurn, setCurrentTurn] = React.useState<PlayerSide>('X')
  const [status, setStatus] = React.useState('')
  const [forbiddenEnabled, setForbiddenEnabled] = React.useState(true)
  const [roundResolved, setRoundResolved] = React.useState(false)
  const [lastWinner, setLastWinner] = React.useState<PlayerSide | null>(null)
  const [boardSeed, setBoardSeed] = React.useState(0)
  const [showSetup, setShowSetup] = React.useState(false)
  const [showPostWin, setShowPostWin] = React.useState(false)
  const boardAnchorRef = React.useRef<HTMLDivElement | null>(null)
  const [cellSize, setCellSize] = React.useState<number>(40)
  const [timeEnabled, setTimeEnabled] = React.useState<boolean>(false)
  const [timePerTurnSec, setTimePerTurnSec] = React.useState<number>(30)
  const [turnRemainingSec, setTurnRemainingSec] = React.useState<number>(0)
  // Draft settings for the setup popup (apply on Agree)
  const [draftForbiddenEnabled, setDraftForbiddenEnabled] = React.useState<boolean>(forbiddenEnabled)
  const [draftTimeEnabled, setDraftTimeEnabled] = React.useState<boolean>(timeEnabled)
  const [draftTimePerTurnSec, setDraftTimePerTurnSec] = React.useState<number>(timePerTurnSec)

  // Compute a responsive cell size so the full board fits without scrolling
  React.useEffect(() => {
    const computeCell = () => {
      const anchor = boardAnchorRef.current
      const bottomReserve = 36 // page bottom padding (reduced)
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const available = Math.max(200, window.innerHeight - rect.top - bottomReserve - 8)
      const totalPadding = 16 // board padding 8 * 2
      const proposed = Math.floor((available - totalPadding) / 15)
      const clamped = Math.max(22, Math.min(40, proposed))
      setCellSize(clamped)
    }
    computeCell()
    window.addEventListener('resize', computeCell)
    return () => window.removeEventListener('resize', computeCell)
  }, [])

  // Turn timer ticking
  React.useEffect(() => {
    if (!timeEnabled || roundResolved || showSetup || showPostWin) return
    if (turnRemainingSec <= 0) return
    const id = window.setInterval(() => {
      setTurnRemainingSec((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => window.clearInterval(id)
  }, [timeEnabled, roundResolved, showSetup, showPostWin, turnRemainingSec])

  // When opening the setup popup, initialize drafts from current settings
  React.useEffect(() => {
    if (showSetup) {
      setDraftForbiddenEnabled(forbiddenEnabled)
      setDraftTimeEnabled(timeEnabled)
      setDraftTimePerTurnSec(timePerTurnSec)
    }
  }, [showSetup, forbiddenEnabled, timeEnabled, timePerTurnSec])

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
      if (typeof parsed.timeEnabled === 'boolean') {
        setTimeEnabled(parsed.timeEnabled)
      }
      if (typeof parsed.timePerTurnSec === 'number') {
        setTimePerTurnSec(parsed.timePerTurnSec)
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
          forbiddenEnabled,
          timeEnabled,
          timePerTurnSec
        })
      )
    } catch (error) {
      console.warn('Không thể lưu cấu hình Tiêu Dao:', error)
    }
  }, [playerNames, scores, forbiddenEnabled, timeEnabled, timePerTurnSec])

  const handleNameChange = React.useCallback((side: PlayerSide, value: string) => {
    const sanitized = value.slice(0, 24)
    setPlayerNames((prev) => ({ ...prev, [side]: sanitized }))
  }, [])

  const resetRoundState = React.useCallback(() => {
    setCurrentTurn('X')
    setStatus(t('hotseat.startNewRoundBlackFirst'))
    setRoundResolved(false)
    setLastWinner(null)
    setTurnRemainingSec(timeEnabled ? timePerTurnSec : 0)
  }, [t, timeEnabled, timePerTurnSec])

  const handleManualReset = React.useCallback(() => {
    resetRoundState()
    setBoardSeed((prev) => prev + 1)
  }, [resetRoundState])

  const handleMove = React.useCallback(
    (_x: number, _y: number, player: PlayerSide) => {
      const next = player === 'X' ? 'O' : 'X'
      setCurrentTurn(next)
      const nextName = playerNames[next] || (next === 'X' ? t('hotseat.sideBlack') : t('hotseat.sideWhite'))
      setStatus(t('hotseat.nextTurn', { name: nextName }))
      setTurnRemainingSec(timeEnabled ? timePerTurnSec : 0)
    },
    [playerNames, timeEnabled, timePerTurnSec, t]
  )

  const handleWin = React.useCallback(
    (winner: PlayerSide) => {
      if (roundResolved) return
      setRoundResolved(true)
      setScores((prev) => ({ ...prev, [winner]: prev[winner] + 1 }))
      const winnerName = playerNames[winner] || (winner === 'X' ? t('hotseat.sideBlack') : t('hotseat.sideWhite'))
      setStatus(t('hotseat.winThisRound', { name: winnerName }))
      setLastWinner(winner)
      // Show post-win choice popup (New game or Review) after each win
      setShowPostWin(true)
    },
    [playerNames, roundResolved, t]
  )

  // Timeout: when the active player's time reaches 0, they lose
  const handleTimeoutLoss = React.useCallback((loser: PlayerSide) => {
    if (roundResolved) return
    const winner: PlayerSide = loser === 'X' ? 'O' : 'X'
    setRoundResolved(true)
    setScores((prev) => ({ ...prev, [winner]: prev[winner] + 1 }))
    const loserName = playerNames[loser] || (loser === 'X' ? t('hotseat.sideBlack') : t('hotseat.sideWhite'))
    const winnerName = playerNames[winner] || (winner === 'X' ? t('hotseat.sideBlack') : t('hotseat.sideWhite'))
    setStatus(t('hotseat.timeOutWin', { loser: loserName, winner: winnerName }))
    setLastWinner(winner)
    setShowPostWin(true)
  }, [playerNames, roundResolved, t])

  React.useEffect(() => {
    if (!timeEnabled || roundResolved || showSetup || showPostWin) return
    if (turnRemainingSec === 0) {
      handleTimeoutLoss(currentTurn)
    }
  }, [turnRemainingSec, timeEnabled, roundResolved, showSetup, showPostWin, currentTurn, handleTimeoutLoss])

  const handleBoardReset = React.useCallback(() => {
    resetRoundState()
  }, [resetRoundState])

  const handleSwapSides = React.useCallback(() => {
    setPlayerNames((prev) => ({ X: prev.O || t('hotseat.sideWhite'), O: prev.X || t('hotseat.sideBlack') }))
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
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        color: '#e2e8f0',
        paddingBottom: '36px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Animated background particles */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(239, 68, 68, 0.08) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />

      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '8px 12px', position: 'relative', zIndex: 1 }}>
        {/* Breadcrumb */}
        <nav className="breadcrumb-nav" style={{ paddingLeft: 0, marginBottom: '8px' }}>
          <a href="#home">{t('breadcrumb.home')}</a>
          <span>›</span>
          <span className="breadcrumb-current">{t('hotseat.breadcrumb')}</span>
        </nav>

        {/* Compact top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#E2E8F0' }}>⚔️ {t('hotseat.title')}</div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>{t('hotseat.subtitle')}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Global Scoreboard */}
            <div style={{ display: 'flex', gap: 6, marginRight: 6 }}>
              <div style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.12)', color: '#BFDBFE', fontWeight: 700 }}>X {scores.X}</div>
              <div style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.12)', color: '#FECACA', fontWeight: 700 }}>O {scores.O}</div>
            </div>
            <button onClick={() => setShowSetup(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.35)', background: 'rgba(15,23,42,0.6)', color: '#E2E8F0', cursor: 'pointer' }}>⚙ {t('hotseat.setupTitle')}</button>
          </div>
        </div>

        {/* Removed glow strip for extra vertical space */}

        {/* Removed control panel and status bar for compact layout */}

        {/* Game Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: '12px',
            alignItems: 'center',
            maxWidth: '1120px',
            margin: '0 auto'
          }}
        >
          {/* Player X Card */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <PlayerCard
              side="X"
              name={playerNames.X}
              score={scores.X}
              isTurn={!roundResolved && currentTurn === 'X'}
              isLastWinner={lastWinner === 'X'}
              onNameChange={(value) => handleNameChange('X', value)}
              timeEnabled={timeEnabled}
              secondsRemaining={timeEnabled ? (!roundResolved && currentTurn === 'X' ? turnRemainingSec : timePerTurnSec) : undefined}
              totalTimeSec={timePerTurnSec}
            />
          </div>

          {/* Game Board (responsive cell size to fit viewport) */}
          <div ref={boardAnchorRef} style={{ display: 'flex', justifyContent: 'center' }}>
            <GameBoard
              key={boardSeed}
              enableForbidden={forbiddenEnabled}
              onMove={handleMove}
              onWin={handleWin}
              onReset={handleBoardReset}
              cellSizePx={cellSize}
            />
          </div>

          {/* Player O Card */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <PlayerCard
              side="O"
              name={playerNames.O}
              score={scores.O}
              isTurn={!roundResolved && currentTurn === 'O'}
              isLastWinner={lastWinner === 'O'}
              onNameChange={(value) => handleNameChange('O', value)}
              timeEnabled={timeEnabled}
              secondsRemaining={timeEnabled ? (!roundResolved && currentTurn === 'O' ? turnRemainingSec : timePerTurnSec) : undefined}
              totalTimeSec={timePerTurnSec}
            />
          </div>
        </div>
      </div>

      {/* Setup Popup */}
      {showSetup && (
        <div onClick={() => setShowSetup(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 360, background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 800, color: '#E2E8F0' }}>{t('hotseat.setupTitle')}</div>
              <button onClick={() => setShowSetup(false)} style={{ border: '1px solid rgba(148,163,184,0.35)', background: 'transparent', color: '#94A3B8', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#E2E8F0' }}>
                <input type="checkbox" checked={draftForbiddenEnabled} onChange={() => setDraftForbiddenEnabled((p) => !p)} /> 🚫 {t('hotseat.forbiddenRulesBlack')}
              </label>
              <div style={{ display: 'grid', gap: 8, color: '#E2E8F0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" checked={draftTimeEnabled} onChange={() => setDraftTimeEnabled((p) => !p)} /> ⏱️ {t('hotseat.timeLimit')}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: draftTimeEnabled ? 1 : 0.6 }}>
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>{t('hotseat.timePerTurn')}</span>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    step={5}
                    value={draftTimePerTurnSec}
                    onChange={(e) => setDraftTimePerTurnSec(Math.max(5, Math.min(300, Number(e.target.value) || 0)))}
                    disabled={!draftTimeEnabled}
                    style={{
                      width: 80,
                      background: 'rgba(15, 23, 42, 0.4)',
                      border: '1px solid rgba(148, 163, 184, 0.3)',
                      borderRadius: 8,
                      padding: '6px 8px',
                      color: '#E2E8F0'
                    }}
                  />
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>{t('hotseat.seconds')}</span>
                </div>
              </div>
              <button onClick={() => { handleSwapSides(); setShowSetup(false) }} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.15)', color: '#BFDBFE', cursor: 'pointer' }}>🔄 {t('hotseat.swapSides')}</button>
              <button onClick={() => { handleManualReset(); setShowSetup(false) }} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.15)', color: '#C7D2FE', cursor: 'pointer' }}>🆕 {t('hotseat.newRound')}</button>
              <button onClick={() => { handleResetScores(); setShowSetup(false) }} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.15)', color: '#FECACA', cursor: 'pointer' }}>🗑️ {t('hotseat.resetScores')}</button>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowSetup(false)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.35)', background: 'transparent', color: '#94A3B8', cursor: 'pointer' }}>{t('common.cancel')}</button>
                <button
                  onClick={() => {
                    setForbiddenEnabled(draftForbiddenEnabled)
                    setTimeEnabled(draftTimeEnabled)
                    setTimePerTurnSec(draftTimePerTurnSec)
                    setTurnRemainingSec(draftTimeEnabled ? draftTimePerTurnSec : 0)
                    setShowSetup(false)
                  }}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.5)', background: 'rgba(34,197,94,0.15)', color: '#BBF7D0', cursor: 'pointer', fontWeight: 700 }}
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post-win Popup: choose New game or Review, show winner info */}
      {showPostWin && (
        <div onClick={() => setShowPostWin(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 340, background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 800, color: '#E2E8F0' }}>{t('hotseat.postWinTitle')}</div>
              <button onClick={() => setShowPostWin(false)} style={{ border: '1px solid rgba(148,163,184,0.35)', background: 'transparent', color: '#94A3B8', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 14, color: '#E2E8F0', fontWeight: 700 }}>
                {(() => {
                  const w = lastWinner
                  const name = w ? (playerNames[w] || (w === 'X' ? t('hotseat.sideBlack') : t('hotseat.sideWhite'))) : '—'
                  const accent = w === 'X' ? '#BFDBFE' : '#FECACA'
                  return (
                    <span>
                      <span style={{ color: accent }}>{name}</span> {t('hotseat.winThisRoundSuffix')}
                    </span>
                  )
                })()}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { handleManualReset(); setShowPostWin(false) }}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.15)', color: '#C7D2FE', cursor: 'pointer', fontWeight: 700 }}
                >
                  🆕 {t('hotseat.newRound')}
                </button>
                <button
                  onClick={() => setShowPostWin(false)}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.35)', background: 'transparent', color: '#E2E8F0', cursor: 'pointer', fontWeight: 700 }}
                >
                  👁️ {t('hotseat.review')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
