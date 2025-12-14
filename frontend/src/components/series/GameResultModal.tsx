/**
 * GameResultModal Component
 * 
 * Displays the result of a single game within a series
 * Requirements: 8.3 - WHEN a game ends THEN the system SHALL display game result and updated series score
 */


import { useLanguage } from '../../contexts/LanguageContext'
import SeriesScoreDisplay from './SeriesScoreDisplay'

interface GameResultModalProps {
  /** Whether the current player won this game */
  isWinner: boolean
  /** Winner's name */
  winnerName: string
  /** Loser's name */
  loserName: string
  /** Current series score [player1Wins, player2Wins] */
  seriesScore: [number, number]
  /** Current game number that just ended */
  gameNumber: number
  /** Whether the series is now complete */
  isSeriesComplete: boolean
  /** Current player number (1 or 2) */
  currentPlayerNumber: 1 | 2
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback when ready for next game (only if series not complete) */
  onNextGame?: () => void
}

export default function GameResultModal({
  isWinner,
  winnerName,
  loserName,
  seriesScore,
  gameNumber,
  isSeriesComplete,
  currentPlayerNumber,
  onClose,
  onNextGame
}: GameResultModalProps) {
  const { t } = useLanguage()

  const resultColor = isWinner ? '#22C55E' : '#EF4444'
  const resultIcon = isWinner ? '🎉' : '😔'
  const resultText = isWinner 
    ? (t('series.gameWin') || 'Thắng ván!')
    : (t('series.gameLose') || 'Thua ván')

  return (
    <div
      className="game-result-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      <div
        className="game-result-modal"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
          borderRadius: '24px',
          maxWidth: '420px',
          width: '100%',
          overflow: 'hidden',
          border: `1px solid ${isWinner ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
          boxShadow: `0 25px 80px ${isWinner ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          animation: 'slideUp 0.4s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${isWinner ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'} 0%, transparent 100%)`,
          padding: '32px 24px',
          textAlign: 'center',
          borderBottom: `1px solid ${isWinner ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
        }}>
          <div style={{
            fontSize: '64px',
            marginBottom: '12px',
            animation: 'bounce 0.6s ease-out'
          }}>
            {resultIcon}
          </div>
          <h2 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 700,
            color: resultColor,
            textTransform: 'uppercase',
            letterSpacing: '2px'
          }}>
            {resultText}
          </h2>
          <p style={{
            margin: '8px 0 0',
            fontSize: '14px',
            color: '#94A3B8'
          }}>
            {t('series.game') || 'Ván'} {gameNumber}
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Winner info */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{
                fontSize: '12px',
                color: '#64748B',
                marginBottom: '4px',
                textTransform: 'uppercase'
              }}>
                {t('series.gameWin') || 'Người thắng'}
              </div>
              <div style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#22C55E'
              }}>
                {winnerName}
              </div>
            </div>
            <span style={{ fontSize: '24px' }}>🏆</span>
          </div>

          {/* Series Score */}
          <div style={{
            textAlign: 'center',
            marginBottom: '24px'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#64748B',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              {t('series.seriesScore') || 'Tỷ số series'}
            </div>
            <SeriesScoreDisplay
              player1Wins={seriesScore[0]}
              player2Wins={seriesScore[1]}
              currentPlayerNumber={currentPlayerNumber}
              size="large"
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {!isSeriesComplete && onNextGame && (
              <button
                onClick={onNextGame}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #22D3EE 0%, #0EA5E9 100%)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(34, 211, 238, 0.3)'
                }}
              >
                {t('series.nextGame') || 'Ván tiếp theo'} →
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                flex: isSeriesComplete ? 1 : undefined,
                padding: '14px 24px',
                borderRadius: '12px',
                background: 'rgba(71, 85, 105, 0.3)',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                color: '#94A3B8',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {t('common.close') || 'Đóng'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
