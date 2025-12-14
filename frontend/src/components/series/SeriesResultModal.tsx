/**
 * SeriesResultModal Component
 * 
 * Displays the final result of a completed series with MP, coins, EXP rewards
 * Requirements: 8.4 - WHEN series ends THEN the system SHALL display final result with Mindpoint change and rewards
 */

import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { Rank, RANK_DISPLAY, RankChange } from '../../../../shared/types/series'
import SeriesScoreDisplay from './SeriesScoreDisplay'
import RankChangeAnimation from './RankChangeAnimation'

interface Rewards {
  mp: number
  coins: number
  exp: number
}

interface SeriesResultModalProps {
  /** Whether the current player won the series */
  isWinner: boolean
  /** Winner's name */
  winnerName: string
  /** Loser's name */
  loserName: string
  /** Final series score [player1Wins, player2Wins] */
  finalScore: [number, number]
  /** Current player number (1 or 2) */
  currentPlayerNumber: 1 | 2
  /** Rewards for the current player */
  rewards: Rewards
  /** Rank change info (if any) */
  rankChange?: RankChange
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback when rematch is requested */
  onRematch?: () => void
  /** Whether rematch button should be shown */
  showRematchButton?: boolean
}

export default function SeriesResultModal({
  isWinner,
  winnerName,
  loserName,
  finalScore,
  currentPlayerNumber,
  rewards,
  rankChange,
  onClose,
  onRematch,
  showRematchButton = true
}: SeriesResultModalProps) {
  const { t, language } = useLanguage()
  const [showRankAnimation, setShowRankAnimation] = useState(!!rankChange)

  const resultColor = isWinner ? '#22C55E' : '#EF4444'
  const resultIcon = isWinner ? '🏆' : '💔'
  const resultText = isWinner
    ? (t('series.seriesWin') || 'Thắng Series!')
    : (t('series.seriesLose') || 'Thua Series')

  // Format MP change with sign
  const formatMPChange = (mp: number) => {
    if (mp >= 0) return `+${mp}`
    return `${mp}`
  }

  // Get rank display name
  const getRankName = (rank: Rank) => {
    const display = RANK_DISPLAY[rank]
    return language === 'vi' ? display.nameVi : display.name
  }

  // Handle rank animation complete
  const handleRankAnimationComplete = () => {
    setShowRankAnimation(false)
  }

  // Show rank animation first if there's a rank change
  if (showRankAnimation && rankChange) {
    return (
      <RankChangeAnimation
        oldRank={rankChange.oldRank}
        newRank={rankChange.newRank}
        newMP={rankChange.newMP}
        onComplete={handleRankAnimationComplete}
      />
    )
  }

  return (
    <div
      className="series-result-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        padding: '20px',
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      <div
        className="series-result-modal"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
          borderRadius: '24px',
          maxWidth: '480px',
          width: '100%',
          overflow: 'hidden',
          border: `1px solid ${isWinner ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
          boxShadow: `0 25px 80px ${isWinner ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
          animation: 'slideUp 0.4s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${isWinner ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'} 0%, transparent 100%)`,
          padding: '32px 24px',
          textAlign: 'center',
          borderBottom: `1px solid ${isWinner ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
        }}>
          <div style={{
            fontSize: '72px',
            marginBottom: '12px',
            animation: isWinner ? 'trophy 1s ease-out' : 'shake 0.5s ease-out'
          }}>
            {resultIcon}
          </div>
          <h2 style={{
            margin: 0,
            fontSize: '32px',
            fontWeight: 700,
            color: resultColor,
            textTransform: 'uppercase',
            letterSpacing: '3px',
            textShadow: `0 0 30px ${resultColor}40`
          }}>
            {resultText}
          </h2>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Final Score */}
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
              {t('series.seriesScore') || 'Tỷ số cuối'}
            </div>
            <SeriesScoreDisplay
              player1Wins={finalScore[0]}
              player2Wins={finalScore[1]}
              currentPlayerNumber={currentPlayerNumber}
              size="large"
            />
          </div>

          {/* Rewards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '24px'
          }}>
            {/* MP Change */}
            <div style={{
              background: rewards.mp >= 0 
                ? 'rgba(34, 197, 94, 0.15)' 
                : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${rewards.mp >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>⚡</div>
              <div style={{
                fontSize: '20px',
                fontWeight: 700,
                color: rewards.mp >= 0 ? '#22C55E' : '#EF4444'
              }}>
                {formatMPChange(rewards.mp)}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#64748B',
                textTransform: 'uppercase',
                marginTop: '4px'
              }}>
                MindPoint
              </div>
            </div>

            {/* Coins */}
            <div style={{
              background: 'rgba(251, 191, 36, 0.15)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>🪙</div>
              <div style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#FBBF24'
              }}>
                +{rewards.coins}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#64748B',
                textTransform: 'uppercase',
                marginTop: '4px'
              }}>
                {t('shop.coins') || 'Tinh Thạch'}
              </div>
            </div>

            {/* EXP */}
            <div style={{
              background: 'rgba(139, 92, 246, 0.15)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>✨</div>
              <div style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#A78BFA'
              }}>
                +{rewards.exp}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#64748B',
                textTransform: 'uppercase',
                marginTop: '4px'
              }}>
                EXP
              </div>
            </div>
          </div>

          {/* Rank Change Info (if shown after animation) */}
          {rankChange && !showRankAnimation && (
            <div style={{
              background: rankChange.newRank > rankChange.oldRank
                ? 'rgba(34, 197, 94, 0.1)'
                : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${rankChange.newRank > rankChange.oldRank ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}>
              <span style={{ 
                color: RANK_DISPLAY[rankChange.oldRank].color,
                fontWeight: 600
              }}>
                {RANK_DISPLAY[rankChange.oldRank].icon} {getRankName(rankChange.oldRank)}
              </span>
              <span style={{ fontSize: '20px' }}>→</span>
              <span style={{ 
                color: RANK_DISPLAY[rankChange.newRank].color,
                fontWeight: 700,
                fontSize: '18px'
              }}>
                {RANK_DISPLAY[rankChange.newRank].icon} {getRankName(rankChange.newRank)}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {showRematchButton && onRematch && (
              <button
                onClick={onRematch}
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
                  boxShadow: '0 6px 20px rgba(34, 211, 238, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span>🔄</span>
                <span>{t('series.rematch') || 'Đấu lại'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '12px',
                background: 'rgba(71, 85, 105, 0.3)',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                color: '#F8FAFC',
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
        @keyframes trophy {
          0% { transform: scale(0) rotate(-180deg); }
          50% { transform: scale(1.3) rotate(10deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  )
}
