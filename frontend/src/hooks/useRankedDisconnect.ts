/**
 * useRankedDisconnect - Hook for handling ranked disconnect auto-win
 * 
 * Requirements: 1.1-1.5, 3.1-3.4, 4.2 (ranked-disconnect-auto-win)
 * 
 * This hook provides:
 * - Disconnect detection and countdown display
 * - Auto-win result handling
 * - Reconnection handling
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import type { AutoWinResult } from '../components/series/DisconnectOverlay'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000'

export interface RankedDisconnectState {
  isOpponentDisconnected: boolean
  disconnectedPlayerId: string | null
  remainingSeconds: number
  autoWinResult: AutoWinResult | null
  isReconnecting: boolean
}

interface UseRankedDisconnectOptions {
  roomId: string | null
  seriesId: string | null
  userId: string | null
  enabled?: boolean
  onAutoWin?: (result: AutoWinResult) => void
  onOpponentReconnected?: () => void
}

interface UseRankedDisconnectReturn {
  state: RankedDisconnectState
  isOverlayVisible: boolean
}

export function useRankedDisconnect(options: UseRankedDisconnectOptions): UseRankedDisconnectReturn {
  const {
    roomId,
    seriesId,
    userId,
    enabled = true,
    onAutoWin,
    onOpponentReconnected
  } = options

  const [state, setState] = useState<RankedDisconnectState>({
    isOpponentDisconnected: false,
    disconnectedPlayerId: null,
    remainingSeconds: 10,
    autoWinResult: null,
    isReconnecting: false
  })

  const socketRef = useRef<Socket | null>(null)

  // Connect to socket and listen for disconnect events
  useEffect(() => {
    if (!roomId || !enabled) return

    // Get existing socket or create new one
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true
    })
    socketRef.current = socket

    // Listen for opponent disconnected
    socket.on('opponent_disconnected', (data: {
      roomId: string
      seriesId: string
      disconnectedPlayerId: string
      gracePeriodSeconds: number
      message: string
    }) => {
      if (data.roomId !== roomId) return
      
      console.log('⚠️ Opponent disconnected:', data)
      setState(prev => ({
        ...prev,
        isOpponentDisconnected: true,
        disconnectedPlayerId: data.disconnectedPlayerId,
        remainingSeconds: data.gracePeriodSeconds
      }))
    })

    // Listen for countdown updates
    socket.on('disconnect_countdown', (data: {
      roomId: string
      remainingSeconds: number
    }) => {
      if (data.roomId !== roomId) return
      
      setState(prev => ({
        ...prev,
        remainingSeconds: data.remainingSeconds
      }))
    })

    // Listen for opponent reconnected
    socket.on('opponent_reconnected', (data: {
      roomId: string
      reconnectedPlayerId: string
      message: string
    }) => {
      if (data.roomId !== roomId) return
      
      console.log('✅ Opponent reconnected:', data)
      setState(prev => ({
        ...prev,
        isOpponentDisconnected: false,
        disconnectedPlayerId: null,
        remainingSeconds: 10
      }))
      onOpponentReconnected?.()
    })

    // Listen for auto-win result
    socket.on('ranked_auto_win', (data: {
      roomId: string
      seriesId: string
      winnerId: string
      loserId: string
      mpChange: number
      seriesComplete: boolean
      finalScore: string
      seriesWinnerId?: string
      message: string
    }) => {
      if (data.roomId !== roomId) return
      
      console.log('🏆 Ranked auto-win:', data)
      const result: AutoWinResult = {
        winnerId: data.winnerId,
        loserId: data.loserId,
        mpChange: data.mpChange,
        seriesComplete: data.seriesComplete,
        finalScore: data.finalScore,
        seriesWinnerId: data.seriesWinnerId,
        message: data.message
      }
      
      setState(prev => ({
        ...prev,
        isOpponentDisconnected: true,
        autoWinResult: result
      }))
      onAutoWin?.(result)
    })

    // Listen for forfeit loss (if we were the one who disconnected)
    socket.on('ranked_forfeit_loss', (data: {
      roomId: string
      seriesId: string
      winnerId: string
      loserId: string
      mpChange: number
      seriesComplete: boolean
      message: string
    }) => {
      if (data.roomId !== roomId) return
      if (data.loserId !== userId) return
      
      console.log('😢 Ranked forfeit loss:', data)
      // Could show a different UI for the loser
    })

    // Listen for game forfeited (broadcast to room)
    socket.on('ranked_game_forfeited', (data: {
      roomId: string
      seriesId: string
      winnerId: string
      loserId: string
      reason: string
      mpChange: number
      seriesComplete: boolean
      finalScore: string
    }) => {
      if (data.roomId !== roomId) return
      
      console.log('📢 Ranked game forfeited:', data)
    })

    // Listen for simultaneous disconnect (draw)
    socket.on('ranked_simultaneous_disconnect', (data: {
      roomId: string
      seriesId: string
      result: string
      mpChange: number
      message: string
    }) => {
      if (data.roomId !== roomId) return
      
      console.log('🤝 Simultaneous disconnect - draw:', data)
      // Handle draw case
    })

    return () => {
      socket.off('opponent_disconnected')
      socket.off('disconnect_countdown')
      socket.off('opponent_reconnected')
      socket.off('ranked_auto_win')
      socket.off('ranked_forfeit_loss')
      socket.off('ranked_game_forfeited')
      socket.off('ranked_simultaneous_disconnect')
      socket.disconnect()
    }
  }, [roomId, userId, enabled, onAutoWin, onOpponentReconnected])

  // Determine if overlay should be visible
  const isOverlayVisible = state.isOpponentDisconnected || state.autoWinResult !== null

  return {
    state,
    isOverlayVisible
  }
}

export default useRankedDisconnect
