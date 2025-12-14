/**
 * RematchWaiting Component
 * 
 * Displays waiting state while waiting for opponent to accept rematch
 * Requirements: 10.3 - WHEN only one player clicks rematch THEN the system SHALL wait 15 seconds for the other player
 * Requirements: 10.4 - WHEN rematch timeout expires THEN the system SHALL return both players to home screen
 */

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

type RematchStatus = 'waiting' | 'accepted' | 'declined' | 'timeout'

interface RematchWaitingProps {
  /** Total timeout in seconds (default 15) */
  timeoutSeconds?: number
  /** Callback when timeout expires */
  onTimeout: () => void
  /** Callback when opponent accepts */
  onAccepted?: () => void
  /** Callback when opponent declines */
  onDeclined?: () => void
  /** Callback to cancel waiting */
  onCancel: () => void
  /** Current status (controlled externally) */
  status?: RematchStatus
  /** Opponent's name */
  opponentName?: string
}

export default function RematchWaiting({
  timeoutSeconds = 15,
  onTimeout,
  onAccepted,
  onDeclined,
  onCancel,
  status = 'waiting',
  opponentName
}: RematchWaitingProps) {
  const { t } = useLanguage()
  const [remainingTime, setRemainingTime] = useState(timeoutSeconds)
  const [currentStatus, setCurrentStatus] = useState<RematchStatus>(status)

  // Update status when prop changes
  useEffect(() => {
    setCurrentStatus(status)
  }, [status])

  // Countdown timer
  useEffect(() => {
    if (currentStatus !== 'waiting') return

    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          setCurrentStatus('timeout')
          onTimeout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [currentStatus, onTimeout])

  // Handle status changes
  useEffect(() => {
    if (currentStatus === 'accepted' && onAccepted) {
      onAccepted()
    } else if (currentStatus === 'declined' && onDeclined) {
      onDeclined()
    }
  }, [currentStatus, onAccepted, onDeclined])

  // Calculate progress percentage
  const progressPercent = (remainingTime / timeoutSeconds) * 100

  // Get status message
  const getStatusMessage = useCallback(() => {
    switch (currentStatus) {
      case 'waiting':
        return t('series.waitingRematch') || 'Chờ đối thủ...'
      case 'accepted':
        return t('series.rematchAccepted') || 'Đối thủ đồng ý!'
      case 'declined':
        return t('series.rematchDeclined') || 'Đối thủ từ chối'
      case 'timeout':
        return t('series.rematchTimeout') || 'Hết thời gian chờ'
      default:
        return ''
    }
  }, [currentStatus, t])

  // Get status color
  const getStatusColor = () => {
    switch (currentStatus) {
      case 'waiting':
        return '#22D3EE'
      case 'accepted':
        return '#22C55E'
      case 'declined':
      case 'timeout':
        return '#EF4444'
      default:
        return '#22D3EE'
    }
  }

  const statusColor = getStatusColor()

  return (
    <div
      className="rematch-waiting"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        padding: '24px',
        background: 'rgba(15, 23, 42, 0.95)',
        borderRadius: '16px',
        border: `1px solid ${statusColor}40`,
        boxShadow: `0 10px 40px ${statusColor}20`,
        minWidth: '280px'
      }}
    >
      {/* Status Icon */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: `${statusColor}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          animation: currentStatus === 'waiting' ? 'pulse 1.5s ease-in-out infinite' : 'none'
        }}
      >
        {currentStatus === 'waiting' && '⏳'}
        {currentStatus === 'accepted' && '✅'}
        {currentStatus === 'declined' && '❌'}
        {currentStatus === 'timeout' && '⏰'}
      </div>

      {/* Status Message */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: statusColor,
            marginBottom: '8px'
          }}
        >
          {getStatusMessage()}
        </div>
        {opponentName && currentStatus === 'waiting' && (
          <div style={{ fontSize: '14px', color: '#94A3B8' }}>
            {opponentName}
          </div>
        )}
      </div>

      {/* Countdown Timer (only when waiting) */}
      {currentStatus === 'waiting' && (
        <div style={{ width: '100%' }}>
          {/* Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '6px',
              background: 'rgba(71, 85, 105, 0.3)',
              borderRadius: '3px',
              overflow: 'hidden',
              marginBottom: '8px'
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${statusColor} 0%, ${statusColor}80 100%)`,
                borderRadius: '3px',
                transition: 'width 1s linear'
              }}
            />
          </div>

          {/* Time Display */}
          <div
            style={{
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: 700,
              color: remainingTime <= 5 ? '#EF4444' : '#F8FAFC',
              fontFamily: 'monospace'
            }}
          >
            {remainingTime}
            <span style={{ fontSize: '14px', fontWeight: 400, marginLeft: '4px', color: '#64748B' }}>
              {t('common.seconds') || 'giây'}
            </span>
          </div>
        </div>
      )}

      {/* Cancel Button (only when waiting) */}
      {currentStatus === 'waiting' && (
        <button
          onClick={onCancel}
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            background: 'rgba(71, 85, 105, 0.3)',
            border: '1px solid rgba(71, 85, 105, 0.4)',
            color: '#94A3B8',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'
            e.currentTarget.style.color = '#EF4444'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(71, 85, 105, 0.3)'
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.4)'
            e.currentTarget.style.color = '#94A3B8'
          }}
        >
          {t('common.cancel') || 'Hủy'}
        </button>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}
