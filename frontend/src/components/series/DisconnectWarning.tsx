/**
 * DisconnectWarning - Component to display when opponent disconnects
 * Requirements: 7.1, 7.2
 * 
 * Shows countdown timer for reconnection timeout (60 seconds)
 */

import React from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

interface DisconnectWarningProps {
  disconnectedPlayerName?: string
  remainingSeconds: number
  isOpponent: boolean
  onClose?: () => void
}

export function DisconnectWarning({
  disconnectedPlayerName = 'Đối thủ',
  remainingSeconds,
  isOpponent,
  onClose
}: DisconnectWarningProps) {
  const { t } = useLanguage()

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Determine urgency level for styling
  const getUrgencyColor = () => {
    if (remainingSeconds <= 10) return '#ef4444' // Red - critical
    if (remainingSeconds <= 30) return '#f59e0b' // Orange - warning
    return '#3b82f6' // Blue - normal
  }

  const urgencyColor = getUrgencyColor()

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        border: `2px solid ${urgencyColor}`,
        borderRadius: '16px',
        padding: '24px 32px',
        textAlign: 'center',
        minWidth: '320px',
        boxShadow: `0 0 30px ${urgencyColor}40`,
        animation: 'pulse 2s infinite'
      }}
    >
      {/* Warning Icon */}
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>
        {isOpponent ? '⚠️' : '📡'}
      </div>

      {/* Title */}
      <h3 style={{
        color: urgencyColor,
        fontSize: '20px',
        fontWeight: 'bold',
        marginBottom: '12px'
      }}>
        {isOpponent 
          ? t('series.opponentDisconnected') || 'Đối thủ mất kết nối'
          : t('series.connectionLost') || 'Mất kết nối'
        }
      </h3>

      {/* Description */}
      <p style={{
        color: '#9ca3af',
        fontSize: '14px',
        marginBottom: '20px'
      }}>
        {isOpponent
          ? t('series.waitingForReconnect') || `Đang chờ ${disconnectedPlayerName} kết nối lại...`
          : t('series.tryingToReconnect') || 'Đang thử kết nối lại...'
        }
      </p>

      {/* Countdown Timer */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{
          fontSize: '48px',
          fontWeight: 'bold',
          color: urgencyColor,
          fontFamily: 'monospace',
          textShadow: `0 0 10px ${urgencyColor}60`
        }}>
          {formatTime(remainingSeconds)}
        </div>

        <div style={{
          color: '#6b7280',
          fontSize: '12px'
        }}>
          {t('series.timeRemaining') || 'Thời gian còn lại'}
        </div>

        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: '4px',
          backgroundColor: '#374151',
          borderRadius: '2px',
          overflow: 'hidden',
          marginTop: '8px'
        }}>
          <div style={{
            width: `${(remainingSeconds / 60) * 100}%`,
            height: '100%',
            backgroundColor: urgencyColor,
            transition: 'width 1s linear'
          }} />
        </div>
      </div>

      {/* Warning message when time is low */}
      {remainingSeconds <= 10 && (
        <p style={{
          color: '#ef4444',
          fontSize: '12px',
          marginTop: '16px',
          animation: 'blink 1s infinite'
        }}>
          {isOpponent
            ? t('series.forfeitSoon') || 'Đối thủ sẽ bị xử thua nếu không kết nối lại!'
            : t('series.willForfeit') || 'Bạn sẽ bị xử thua nếu không kết nối lại!'
          }
        </p>
      )}

      {/* Close button (optional) */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            backgroundColor: 'transparent',
            border: '1px solid #4b5563',
            borderRadius: '8px',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          {t('common.dismiss') || 'Đóng'}
        </button>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.9; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

export default DisconnectWarning
