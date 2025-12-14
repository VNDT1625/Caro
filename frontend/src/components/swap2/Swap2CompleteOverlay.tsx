/**
 * Swap2CompleteOverlay Component
 * 
 * Shows final color assignments before main game starts.
 * Displays which player got which color and who moves first.
 * 
 * Requirements: 5.6
 */

import { useEffect, useState, memo, useMemo } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import type { ColorAssignment } from '../../types/swap2'

interface Swap2CompleteOverlayProps {
  colorAssignment: ColorAssignment
  player1Name: string
  player2Name: string
  currentUserId: string
  onContinue: () => void
  autoCloseDelay?: number // ms, default 5000
}

const Swap2CompleteOverlay = memo(function Swap2CompleteOverlay({
  colorAssignment,
  player1Name,
  player2Name,
  currentUserId,
  onContinue,
  autoCloseDelay = 5000
}: Swap2CompleteOverlayProps) {
  const { t } = useLanguage()
  const [countdown, setCountdown] = useState(Math.ceil(autoCloseDelay / 1000))

  const isCurrentUserBlack = colorAssignment.blackPlayerId === currentUserId
  const blackPlayerName = useMemo(() => colorAssignment.blackPlayerId === currentUserId 
    ? (t('swap2.you') || 'Bạn')
    : (colorAssignment.blackPlayerId === player1Name ? player1Name : player2Name), [colorAssignment.blackPlayerId, currentUserId, player1Name, player2Name, t])
  const whitePlayerName = useMemo(() => colorAssignment.whitePlayerId === currentUserId
    ? (t('swap2.you') || 'Bạn')
    : (colorAssignment.whitePlayerId === player1Name ? player1Name : player2Name), [colorAssignment.whitePlayerId, currentUserId, player1Name, player2Name, t])

  // Get actual player names for display
  const getPlayerName = (playerId: string) => {
    if (playerId === currentUserId) return t('swap2.you') || 'Bạn'
    // Try to match with player1 or player2 names
    return playerId
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          onContinue()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [onContinue])

  return (
    <div
      className="swap2-complete-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        animation: 'fadeIn 0.4s ease-out'
      }}
    >
      <div
        className="swap2-complete-modal"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
          borderRadius: '28px',
          maxWidth: '440px',
          width: '100%',
          overflow: 'hidden',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          boxShadow: '0 30px 100px rgba(34, 197, 94, 0.2)',
          animation: 'slideUp 0.5s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, transparent 100%)',
          padding: '32px 24px',
          textAlign: 'center',
          borderBottom: '1px solid rgba(34, 197, 94, 0.2)'
        }}>
          <div style={{
            fontSize: '64px',
            marginBottom: '16px',
            animation: 'bounce 0.6s ease-out'
          }}>
            ✅
          </div>
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 700,
            color: '#22C55E',
            textTransform: 'uppercase',
            letterSpacing: '2px'
          }}>
            {t('swap2.openingComplete') || 'Hoàn tất mở đầu'}
          </h2>
          <p style={{
            margin: '8px 0 0',
            fontSize: '14px',
            color: '#94A3B8'
          }}>
            {t('swap2.gameStartingSoon') || 'Trận đấu sắp bắt đầu'}
          </p>
        </div>

        {/* Color Assignments */}
        <div style={{ padding: '24px' }}>
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '24px'
          }}>
            {/* Black Player */}
            <div style={{
              flex: 1,
              background: isCurrentUserBlack 
                ? 'rgba(34, 197, 94, 0.15)' 
                : 'rgba(30, 41, 59, 0.6)',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center',
              border: isCurrentUserBlack 
                ? '2px solid rgba(34, 197, 94, 0.4)' 
                : '2px solid rgba(71, 85, 105, 0.3)'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #666, #000)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                margin: '0 auto 12px'
              }} />
              <div style={{
                fontSize: '12px',
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '4px'
              }}>
                {t('swap2.black') || 'Đen'}
              </div>
              <div style={{
                fontSize: '16px',
                fontWeight: 600,
                color: isCurrentUserBlack ? '#22C55E' : '#E2E8F0'
              }}>
                {blackPlayerName}
              </div>
              {isCurrentUserBlack && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '11px',
                  color: '#22C55E',
                  fontWeight: 500
                }}>
                  ⭐ {t('swap2.movesFirst') || 'Đi trước'}
                </div>
              )}
            </div>

            {/* White Player */}
            <div style={{
              flex: 1,
              background: !isCurrentUserBlack 
                ? 'rgba(34, 197, 94, 0.15)' 
                : 'rgba(30, 41, 59, 0.6)',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center',
              border: !isCurrentUserBlack 
                ? '2px solid rgba(34, 197, 94, 0.4)' 
                : '2px solid rgba(71, 85, 105, 0.3)'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                margin: '0 auto 12px'
              }} />
              <div style={{
                fontSize: '12px',
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '4px'
              }}>
                {t('swap2.white') || 'Trắng'}
              </div>
              <div style={{
                fontSize: '16px',
                fontWeight: 600,
                color: !isCurrentUserBlack ? '#22C55E' : '#E2E8F0'
              }}>
                {whitePlayerName}
              </div>
            </div>
          </div>

          {/* First Mover Info */}
          <div style={{
            background: 'rgba(34, 211, 238, 0.1)',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center',
            marginBottom: '20px',
            border: '1px solid rgba(34, 211, 238, 0.2)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '20px' }}>🎯</span>
              <span style={{
                fontSize: '14px',
                color: '#22D3EE',
                fontWeight: 500
              }}>
                {t('swap2.blackMovesFirst') || 'Quân Đen đi trước'}
              </span>
            </div>
          </div>

          {/* Continue Button */}
          <button
            onClick={onContinue}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(34, 197, 94, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <span>{t('swap2.startGame') || 'Bắt đầu trận đấu'}</span>
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '4px 10px',
              fontSize: '14px',
              fontFamily: 'monospace'
            }}>
              {countdown}s
            </span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  )
})

export default Swap2CompleteOverlay