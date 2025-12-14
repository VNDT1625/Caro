/**
 * useRematch - Hook for managing rematch requests and state
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 * 
 * This hook manages:
 * - Rematch request state
 * - Timeout handling (15 seconds)
 * - Mutual acceptance detection
 * - New series creation
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { requestRematch } from '../lib/seriesApi'

export type RematchStatus = 'idle' | 'requesting' | 'waiting' | 'accepted' | 'declined' | 'timeout' | 'error'

interface UseRematchOptions {
  seriesId: string | null
  playerId: string | null
  timeoutSeconds?: number
  onRematchAccepted?: (newSeriesId: string) => void
  onRematchTimeout?: () => void
  onRematchError?: (error: string) => void
}

interface UseRematchReturn {
  status: RematchStatus
  remainingTime: number
  error: string | null
  newSeriesId: string | null
  requestRematch: () => Promise<void>
  cancelRematch: () => void
}

const DEFAULT_TIMEOUT_SECONDS = 15

export function useRematch(options: UseRematchOptions): UseRematchReturn {
  const {
    seriesId,
    playerId,
    timeoutSeconds = DEFAULT_TIMEOUT_SECONDS,
    onRematchAccepted,
    onRematchTimeout,
    onRematchError
  } = options

  const [status, setStatus] = useState<RematchStatus>('idle')
  const [remainingTime, setRemainingTime] = useState(timeoutSeconds)
  const [error, setError] = useState<string | null>(null)
  const [newSeriesId, setNewSeriesId] = useState<string | null>(null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // Start countdown timer
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    setRemainingTime(timeoutSeconds)

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000)
      const remaining = Math.max(0, timeoutSeconds - elapsed)

      setRemainingTime(remaining)

      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        setStatus('timeout')
        onRematchTimeout?.()
      }
    }, 100)
  }, [timeoutSeconds, onRematchTimeout])

  // Stop countdown timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    startTimeRef.current = null
  }, [])

  // Request rematch
  const handleRequestRematch = useCallback(async () => {
    if (!seriesId || !playerId) {
      const errorMsg = 'Missing series ID or player ID'
      setError(errorMsg)
      setStatus('error')
      onRematchError?.(errorMsg)
      return
    }

    try {
      setStatus('requesting')
      setError(null)

      const result = await requestRematch(seriesId, playerId)

      if (!result.success) {
        const errorMsg = result.error || 'Failed to request rematch'
        setError(errorMsg)
        setStatus('error')
        onRematchError?.(errorMsg)
        return
      }

      // Check if rematch was accepted (both players requested)
      if (result.newSeriesId) {
        setNewSeriesId(result.newSeriesId)
        setStatus('accepted')
        stopTimer()
        onRematchAccepted?.(result.newSeriesId)
      } else {
        // Waiting for opponent
        setStatus('waiting')
        startTimer()
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to request rematch'
      setError(errorMsg)
      setStatus('error')
      onRematchError?.(errorMsg)
    }
  }, [seriesId, playerId, startTimer, stopTimer, onRematchAccepted, onRematchError])

  // Cancel rematch request
  const handleCancelRematch = useCallback(() => {
    stopTimer()
    setStatus('idle')
    setError(null)
    setRemainingTime(timeoutSeconds)
    setNewSeriesId(null)
  }, [stopTimer, timeoutSeconds])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer()
    }
  }, [stopTimer])

  return {
    status,
    remainingTime,
    error,
    newSeriesId,
    requestRematch: handleRequestRematch,
    cancelRematch: handleCancelRematch
  }
}

export default useRematch
