/**
 * RematchFlow Component
 * 
 * Orchestrates the complete rematch flow after a series ends.
 * Manages the display of rematch button, waiting state, and new series creation.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import RematchButton from './RematchButton'
import RematchWaiting from './RematchWaiting'
import { useRematch } from '../../hooks/useRematch'

interface RematchFlowProps {
  /** Series ID that just completed */
  seriesId: string
  /** Current player ID */
  playerId: string
  /** Opponent name */
  opponentName: string
  /** Callback when rematch is accepted and new series is created */
  onRematchAccepted: (newSeriesId: string) => void
  /** Callback when player exits (clicks Exit or timeout) */
  onExit: () => void
  /** Timeout for rematch request in seconds (default 15) */
  rematchTimeoutSeconds?: number
}

type FlowState = 'idle' | 'waiting' | 'accepted' | 'timeout' | 'error'

export default function RematchFlow({
  seriesId,
  playerId,
  opponentName,
  onRematchAccepted,
  onExit,
  rematchTimeoutSeconds = 15
}: RematchFlowProps) {
  const { t } = useLanguage()
  const [flowState, setFlowState] = useState<FlowState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const rematch = useRematch({
    seriesId,
    playerId,
    timeoutSeconds: rematchTimeoutSeconds,
    onRematchAccepted: (newSeriesId) => {
      setFlowState('accepted')
      onRematchAccepted(newSeriesId)
    },
    onRematchTimeout: () => {
      setFlowState('timeout')
      // Auto-exit after timeout
      setTimeout(onExit, 2000)
    },
    onRematchError: (error) => {
      setFlowState('error')
      setErrorMessage(error)
    }
  })

  // Handle rematch button click
  const handleRematchClick = useCallback(async () => {
    setFlowState('waiting')
    await rematch.requestRematch()
  }, [rematch])

  // Handle cancel/exit
  const handleExit = useCallback(() => {
    rematch.cancelRematch()
    onExit()
  }, [rematch, onExit])

  // Handle rematch waiting cancel
  const handleWaitingCancel = useCallback(() => {
    rematch.cancelRematch()
    setFlowState('idle')
  }, [rematch])

  // Render based on flow state
  if (flowState === 'idle') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '24px'
        }}
      >
        <RematchButton
          onRematch={handleRematchClick}
          size="large"
          fullWidth
        />
        <button
          onClick={handleExit}
          style={{
            width: '100%',
            padding: '12px 24px',
            borderRadius: '12px',
            background: 'rgba(71, 85, 105, 0.3)',
            border: '1px solid rgba(71, 85, 105, 0.4)',
            color: '#F8FAFC',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(71, 85, 105, 0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(71, 85, 105, 0.3)'
          }}
        >
          {t('common.exit') || 'Thoát'}
        </button>
      </div>
    )
  }

  if (flowState === 'waiting') {
    return (
      <RematchWaiting
        timeoutSeconds={rematchTimeoutSeconds}
        onTimeout={handleExit}
        onCancel={handleWaitingCancel}
        status="waiting"
        opponentName={opponentName}
      />
    )
  }

  if (flowState === 'accepted') {
    return (
      <RematchWaiting
        timeoutSeconds={rematchTimeoutSeconds}
        onTimeout={handleExit}
        onCancel={handleExit}
        status="accepted"
        opponentName={opponentName}
      />
    )
  }

  if (flowState === 'timeout') {
    return (
      <RematchWaiting
        timeoutSeconds={rematchTimeoutSeconds}
        onTimeout={handleExit}
        onCancel={handleExit}
        status="timeout"
        opponentName={opponentName}
      />
    )
  }

  if (flowState === 'error') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '24px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '12px',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }}
      >
        <div style={{ fontSize: '32px' }}>❌</div>
        <div style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#EF4444',
          textAlign: 'center'
        }}>
          {t('series.rematchError') || 'Lỗi yêu cầu rematch'}
        </div>
        {errorMessage && (
          <div style={{
            fontSize: '13px',
            color: '#94A3B8',
            textAlign: 'center'
          }}>
            {errorMessage}
          </div>
        )}
        <button
          onClick={handleExit}
          style={{
            width: '100%',
            padding: '12px 24px',
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
    )
  }

  return null
}
