/**
 * NextGameCountdown Component
 * 
 * Displays a countdown timer between games in a series
 * Requirements: 8.5 - WHEN between games THEN the system SHALL display countdown timer before next game starts (10 seconds)
 */

import { useEffect, useState, useCallback } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { TIMING } from '../../../../shared/types/series'

interface NextGameCountdownProps {
  /** Initial countdown seconds (default from TIMING.NEXT_GAME_COUNTDOWN_S) */
  initialSeconds?: number
  /** Current game number that will start */
  nextGameNumber: number
  /** Total games in series */
  totalGames?: number
  /** Callback when countdown reaches 0 */
  onComplete: () => void
  /** Callback for each tick (optional) */
  onTick?: (secondsRemaining: number) => void
  /** Whether to show as overlay or inline */
  variant?: 'overlay' | 'inline'
}

export default function NextGameCountdown({
  initialSeconds = TIMING.NEXT_GAME_COUNTDOWN_S,
  nextGameNumber,
  totalGames = 3,
  onComplete,
  onTick,
  variant = 'overlay'
}: NextGameCountdownProps) {
  const { t } = useLanguage()
  const [seconds, setSeconds] = useState(initialSeconds)
  const [isAnimating, setIsAnimating] = useState(false)

  // Memoize onComplete to avoid re-renders
  const handleComplete = useCallback(() => {
    onComplete()
  }, [onComplete])

  useEffect(() => {
    if (seconds <= 0) {
      handleComplete()
      return
    }

    const timer = setInterval(() => {
      setSeconds(prev => {
        const newValue = prev - 1
        onTick?.(newValue)
        
        // Trigger animation on each tick
        setIsAnimating(true)
        setTimeout(() => setIsAnimating(false), 200)
        
        if (newValue <= 0) {
          clearInterval(timer)
          handleComplete()
        }
        return newValue
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [handleComplete, onTick, seconds])

  // Get urgency color based on remaining time
  const getUrgencyColor = () => {
    if (seconds <= 3) return '#EF4444' // Red - urgent
    if (seconds <= 5) return '#F59E0B' // Amber - warning
    return '#22D3EE' // Cyan - normal
  }

  const urgencyColor = getUrgencyColor()

  // Inline variant
  if (variant === 'inline') {
    return (
      <div
        className="next-game-countdown-inline"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 20px',
          background: 'rgba(0, 0, 0, 0.6)',
          borderRadius: '12px',
          border: `1px solid ${urgencyColor}40`
        }}
      >
        <span style={{ fontSize: '20px' }}>⏱️</span>
        <div>
          <div style={{
            fontSize: '12px',
            color: '#94A3B8',
            marginBottom: '2px'
          }}>
            {t('series.nextGame') || 'Ván tiếp theo'}
          </div>
          <div style={{
            fontSize: '24px',
            fontWeight: 700,
            color: urgencyColor,
            fontFamily: 'monospace',
            transform: isAnimating ? 'scale(1.1)' : 'scale(1)',
            transition: 'transform 0.1s ease-out'
          }}>
            {seconds}s
          </div>
        </div>
      </div>
    )
  }

  // Overlay variant (default)
  return (
    <div
      className="next-game-countdown-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      <div
        className="countdown-content"
        style={{
          textAlign: 'center',
          animation: 'slideUp 0.4s ease-out'
        }}
      >
        {/* Game info */}
        <div style={{
          fontSize: '16px',
          color: '#64748B',
          textTransform: 'uppercase',
          letterSpacing: '3px',
          marginBottom: '16px'
        }}>
          {t('series.game') || 'Ván'} {nextGameNumber} {t('series.of') || 'trong'} {totalGames}
        </div>

        {/* Title */}
        <h2 style={{
          margin: '0 0 32px',
          fontSize: '28px',
          fontWeight: 600,
          color: '#F8FAFC',
          letterSpacing: '1px'
        }}>
          {t('series.nextGame') || 'Ván tiếp theo'}
        </h2>

        {/* Countdown circle */}
        <div style={{
          position: 'relative',
          width: '180px',
          height: '180px',
          margin: '0 auto 32px'
        }}>
          {/* Background circle */}
          <svg
            width="180"
            height="180"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: 'rotate(-90deg)'
            }}
          >
            <circle
              cx="90"
              cy="90"
              r="80"
              fill="none"
              stroke="rgba(71, 85, 105, 0.3)"
              strokeWidth="8"
            />
            <circle
              cx="90"
              cy="90"
              r="80"
              fill="none"
              stroke={urgencyColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 80}
              strokeDashoffset={2 * Math.PI * 80 * (1 - seconds / initialSeconds)}
              style={{
                transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease',
                filter: `drop-shadow(0 0 10px ${urgencyColor})`
              }}
            />
          </svg>

          {/* Number */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{
              fontSize: '72px',
              fontWeight: 700,
              color: urgencyColor,
              fontFamily: 'monospace',
              textShadow: `0 0 30px ${urgencyColor}60`,
              transform: isAnimating ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform 0.15s ease-out'
            }}>
              {seconds}
            </span>
          </div>
        </div>

        {/* Hint text */}
        <div style={{
          fontSize: '14px',
          color: '#475569'
        }}>
          {t('series.countdown') || 'Bắt đầu sau'} {seconds} {t('common.seconds') || 'giây'}
        </div>

        {/* Side swap notice */}
        {nextGameNumber > 1 && (
          <div style={{
            marginTop: '24px',
            padding: '12px 20px',
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '18px' }}>🔄</span>
            <span style={{ color: '#FBBF24', fontSize: '14px' }}>
              {t('series.sideSwap') || 'Đổi bên X/O'}
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
