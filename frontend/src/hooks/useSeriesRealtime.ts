/**
 * useSeriesRealtime - Hook for subscribing to ranked series realtime events
 * Requirements: 7.1, 7.2, 8.3, 8.5
 * 
 * This hook provides realtime subscriptions for:
 * - series_created: When a new series is created
 * - game_ended: When a game in the series ends
 * - series_completed: When the series is complete (someone wins 2 games)
 * - side_swapped: When player sides are swapped between games
 * - disconnect/reconnect: Player connection status changes
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Series event types matching server/game/checkWinner.js
export const SeriesEvents = {
  GAME_ENDED: 'series_game_ended',
  SERIES_COMPLETED: 'series_completed',
  SIDE_SWAPPED: 'series_side_swapped',
  NEXT_GAME_READY: 'series_next_game_ready',
  SCORE_UPDATED: 'series_score_updated',
  PLAYER_DISCONNECTED: 'series_player_disconnected',
  PLAYER_RECONNECTED: 'series_player_reconnected',
  GAME_FORFEITED: 'series_game_forfeited',
  SERIES_ABANDONED: 'series_abandoned',
  // New events for ranked disconnect auto-win (Requirements: 1.1-1.5, 3.1-3.4)
  OPPONENT_DISCONNECTED: 'opponent_disconnected',
  OPPONENT_RECONNECTED: 'opponent_reconnected',
  DISCONNECT_COUNTDOWN: 'disconnect_countdown',
  RANKED_AUTO_WIN: 'ranked_auto_win',
  RANKED_FORFEIT_LOSS: 'ranked_forfeit_loss',
  RANKED_GAME_FORFEITED: 'ranked_game_forfeited',
  RANKED_SIMULTANEOUS_DISCONNECT: 'ranked_simultaneous_disconnect'
} as const

export type SeriesEventType = typeof SeriesEvents[keyof typeof SeriesEvents]

// Event payload interfaces
export interface GameEndedEvent {
  type: typeof SeriesEvents.GAME_ENDED
  seriesId: string
  matchId: string
  winnerId: string | null
  gameNumber: number
  score: string
  isSeriesComplete: boolean
  timestamp: string
}

export interface SeriesCompletedEvent {
  type: typeof SeriesEvents.SERIES_COMPLETED
  seriesId: string
  winnerId: string
  loserId: string
  finalScore: string
  rewards: {
    winner: { mp: number; coins: number; exp: number }
    loser: { mp: number; coins: number; exp: number }
  } | null
  timestamp: string
}

export interface SideSwappedEvent {
  type: typeof SeriesEvents.SIDE_SWAPPED
  seriesId: string
  nextGameNumber: number
  player1Side: 'X' | 'O'
  player2Side: 'X' | 'O'
  timestamp: string
}

export interface NextGameReadyEvent {
  type: typeof SeriesEvents.NEXT_GAME_READY
  seriesId: string
  gameNumber: number
  player1Side: 'X' | 'O'
  player2Side: 'X' | 'O'
  currentScore: string
  countdownSeconds: number
  timestamp: string
}

export interface ScoreUpdatedEvent {
  type: typeof SeriesEvents.SCORE_UPDATED
  seriesId: string
  score: string
  player1Wins: number
  player2Wins: number
  gamesPlayed: number
  timestamp: string
}

export interface PlayerDisconnectedEvent {
  type: typeof SeriesEvents.PLAYER_DISCONNECTED
  seriesId: string
  playerId: string
  disconnectedAt: string
  timeoutSeconds: number
}

export interface PlayerReconnectedEvent {
  type: typeof SeriesEvents.PLAYER_RECONNECTED
  seriesId: string
  playerId: string
  reconnectedAt: string
}

export interface GameForfeitedEvent {
  type: typeof SeriesEvents.GAME_FORFEITED
  seriesId: string
  forfeitingPlayerId: string
  isSeriesComplete: boolean
  seriesScore: string
}

export interface SeriesAbandonedEvent {
  type: typeof SeriesEvents.SERIES_ABANDONED
  seriesId: string
  abandoningPlayerId: string
  winnerId: string
  abandonPenalty: number
  finalScore: string
}

// New event types for ranked disconnect auto-win (Requirements: 1.1-1.5, 3.1-3.4)
export interface OpponentDisconnectedEvent {
  roomId: string
  seriesId: string
  disconnectedPlayerId: string
  gracePeriodSeconds: number
  message: string
}

export interface OpponentReconnectedEvent {
  roomId: string
  reconnectedPlayerId: string
  message: string
}

export interface DisconnectCountdownEvent {
  roomId: string
  remainingSeconds: number
}

export interface RankedAutoWinEvent {
  roomId: string
  seriesId: string
  winnerId: string
  loserId: string
  mpChange: number
  seriesComplete: boolean
  finalScore: string
  seriesWinnerId?: string
  message: string
}

export interface RankedForfeitLossEvent {
  roomId: string
  seriesId: string
  winnerId: string
  loserId: string
  mpChange: number
  seriesComplete: boolean
  message: string
}

export interface RankedGameForfeitedEvent {
  roomId: string
  seriesId: string
  winnerId: string
  loserId: string
  reason: string
  mpChange: number
  seriesComplete: boolean
  finalScore: string
}

export type SeriesEvent = 
  | GameEndedEvent 
  | SeriesCompletedEvent 
  | SideSwappedEvent 
  | NextGameReadyEvent 
  | ScoreUpdatedEvent
  | PlayerDisconnectedEvent
  | PlayerReconnectedEvent
  | GameForfeitedEvent
  | SeriesAbandonedEvent

// Series data from database
export interface SeriesData {
  id: string
  player1_id: string
  player2_id: string
  player1_initial_mp: number
  player2_initial_mp: number
  player1_initial_rank: string
  player2_initial_rank: string
  player1_wins: number
  player2_wins: number
  games_to_win: number
  current_game: number
  player1_side: 'X' | 'O'
  player2_side: 'X' | 'O'
  status: 'in_progress' | 'completed' | 'abandoned'
  winner_id: string | null
  final_score: string | null
  winner_mp_change: number | null
  loser_mp_change: number | null
  winner_coins: number | null
  loser_coins: number | null
  winner_exp: number | null
  loser_exp: number | null
  created_at: string
  started_at: string | null
  ended_at: string | null
}

// Disconnect tracking state
export interface DisconnectState {
  isDisconnected: boolean
  disconnectedPlayerId: string | null
  disconnectedAt: Date | null
  timeoutSeconds: number
  remainingSeconds: number
}

interface UseSeriesRealtimeOptions {
  seriesId: string | null
  userId?: string
  onGameEnded?: (event: GameEndedEvent) => void
  onSeriesCompleted?: (event: SeriesCompletedEvent) => void
  onSideSwapped?: (event: SideSwappedEvent) => void
  onNextGameReady?: (event: NextGameReadyEvent) => void
  onScoreUpdated?: (event: ScoreUpdatedEvent) => void
  onPlayerDisconnected?: (event: PlayerDisconnectedEvent) => void
  onPlayerReconnected?: (event: PlayerReconnectedEvent) => void
  onGameForfeited?: (event: GameForfeitedEvent) => void
  onSeriesAbandoned?: (event: SeriesAbandonedEvent) => void
  onSeriesDataChanged?: (data: SeriesData) => void
  enabled?: boolean
}

interface UseSeriesRealtimeReturn {
  seriesData: SeriesData | null
  isLoading: boolean
  error: string | null
  disconnectState: DisconnectState
  isSubscribed: boolean
  refetch: () => Promise<void>
}

const DISCONNECT_TIMEOUT_SECONDS = 60

export function useSeriesRealtime(options: UseSeriesRealtimeOptions): UseSeriesRealtimeReturn {
  const {
    seriesId,
    userId,
    onGameEnded,
    onSeriesCompleted,
    onSideSwapped,
    onNextGameReady,
    onScoreUpdated,
    onPlayerDisconnected,
    onPlayerReconnected,
    onGameForfeited,
    onSeriesAbandoned,
    onSeriesDataChanged,
    enabled = true
  } = options

  const [seriesData, setSeriesData] = useState<SeriesData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [disconnectState, setDisconnectState] = useState<DisconnectState>({
    isDisconnected: false,
    disconnectedPlayerId: null,
    disconnectedAt: null,
    timeoutSeconds: DISCONNECT_TIMEOUT_SECONDS,
    remainingSeconds: DISCONNECT_TIMEOUT_SECONDS
  })

  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // Fix race condition: use ref to track current seriesData for presence handlers
  const seriesDataRef = useRef<SeriesData | null>(null)
  
  // Keep ref in sync with state
  useEffect(() => {
    seriesDataRef.current = seriesData
  }, [seriesData])

  // Fetch series data
  const fetchSeriesData = useCallback(async () => {
    if (!seriesId) {
      setSeriesData(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('ranked_series')
        .select('*')
        .eq('id', seriesId)
        .single()

      if (fetchError) {
        console.error('Failed to fetch series data:', fetchError)
        setError(fetchError.message)
        return
      }

      setSeriesData(data as SeriesData)
      onSeriesDataChanged?.(data as SeriesData)
    } catch (err: any) {
      console.error('Error fetching series:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [seriesId, onSeriesDataChanged])

  // Start disconnect countdown timer
  const startDisconnectTimer = useCallback((playerId: string) => {
    // Clear any existing timer
    if (disconnectTimerRef.current) {
      clearInterval(disconnectTimerRef.current)
    }

    const disconnectedAt = new Date()
    setDisconnectState({
      isDisconnected: true,
      disconnectedPlayerId: playerId,
      disconnectedAt,
      timeoutSeconds: DISCONNECT_TIMEOUT_SECONDS,
      remainingSeconds: DISCONNECT_TIMEOUT_SECONDS
    })

    // Start countdown
    disconnectTimerRef.current = setInterval(() => {
      setDisconnectState(prev => {
        const elapsed = Math.floor((Date.now() - disconnectedAt.getTime()) / 1000)
        const remaining = Math.max(0, DISCONNECT_TIMEOUT_SECONDS - elapsed)
        
        if (remaining <= 0) {
          // Timer expired - forfeit will be handled by server
          if (disconnectTimerRef.current) {
            clearInterval(disconnectTimerRef.current)
          }
        }

        return {
          ...prev,
          remainingSeconds: remaining
        }
      })
    }, 1000)
  }, [])

  // Stop disconnect countdown timer
  const stopDisconnectTimer = useCallback(() => {
    if (disconnectTimerRef.current) {
      clearInterval(disconnectTimerRef.current)
      disconnectTimerRef.current = null
    }

    setDisconnectState({
      isDisconnected: false,
      disconnectedPlayerId: null,
      disconnectedAt: null,
      timeoutSeconds: DISCONNECT_TIMEOUT_SECONDS,
      remainingSeconds: DISCONNECT_TIMEOUT_SECONDS
    })
  }, [])

  // Subscribe to realtime updates
  useEffect(() => {
    if (!seriesId || !enabled) {
      return
    }

    // Fetch initial data
    fetchSeriesData()

    // Create channel for series updates
    const channelName = `series:${seriesId}`
    console.log('🔔 Subscribing to series realtime:', channelName)

    const channel = supabase
      .channel(channelName)
      // Subscribe to ranked_series table changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ranked_series',
          filter: `id=eq.${seriesId}`
        },
        (payload) => {
          console.log('📡 Series data changed:', payload)
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newData = payload.new as SeriesData
            const oldData = payload.old as SeriesData | undefined
            
            setSeriesData(newData)
            onSeriesDataChanged?.(newData)

            // Detect specific events based on data changes
            if (oldData) {
              // Check for score update
              if (oldData.player1_wins !== newData.player1_wins || 
                  oldData.player2_wins !== newData.player2_wins) {
                const scoreEvent: ScoreUpdatedEvent = {
                  type: SeriesEvents.SCORE_UPDATED,
                  seriesId: newData.id,
                  score: `${newData.player1_wins}-${newData.player2_wins}`,
                  player1Wins: newData.player1_wins,
                  player2Wins: newData.player2_wins,
                  gamesPlayed: newData.current_game,
                  timestamp: new Date().toISOString()
                }
                onScoreUpdated?.(scoreEvent)
              }

              // Check for side swap
              if (oldData.player1_side !== newData.player1_side) {
                const swapEvent: SideSwappedEvent = {
                  type: SeriesEvents.SIDE_SWAPPED,
                  seriesId: newData.id,
                  nextGameNumber: newData.current_game,
                  player1Side: newData.player1_side,
                  player2Side: newData.player2_side,
                  timestamp: new Date().toISOString()
                }
                onSideSwapped?.(swapEvent)
              }

              // Check for series completion
              if (oldData.status !== 'completed' && newData.status === 'completed') {
                const winnerId = newData.winner_id!
                const loserId = winnerId === newData.player1_id 
                  ? newData.player2_id 
                  : newData.player1_id

                const completedEvent: SeriesCompletedEvent = {
                  type: SeriesEvents.SERIES_COMPLETED,
                  seriesId: newData.id,
                  winnerId,
                  loserId,
                  finalScore: newData.final_score || `${newData.player1_wins}-${newData.player2_wins}`,
                  rewards: newData.winner_mp_change !== null ? {
                    winner: {
                      mp: newData.winner_mp_change,
                      coins: newData.winner_coins || 0,
                      exp: newData.winner_exp || 0
                    },
                    loser: {
                      mp: newData.loser_mp_change || 0,
                      coins: newData.loser_coins || 0,
                      exp: newData.loser_exp || 0
                    }
                  } : null,
                  timestamp: new Date().toISOString()
                }
                onSeriesCompleted?.(completedEvent)
              }

              // Check for series abandoned
              if (oldData.status !== 'abandoned' && newData.status === 'abandoned') {
                const abandonEvent: SeriesAbandonedEvent = {
                  type: SeriesEvents.SERIES_ABANDONED,
                  seriesId: newData.id,
                  abandoningPlayerId: newData.winner_id === newData.player1_id 
                    ? newData.player2_id 
                    : newData.player1_id,
                  winnerId: newData.winner_id!,
                  abandonPenalty: -25, // Standard abandon penalty
                  finalScore: newData.final_score || `${newData.player1_wins}-${newData.player2_wins}`
                }
                onSeriesAbandoned?.(abandonEvent)
              }
            }
          }
        }
      )
      // Subscribe to presence for disconnect detection
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        console.log('👥 Presence sync:', state)
        
        // Check if opponent is still present
        const presentUserIds = Object.values(state).flat().map((p: any) => p.user_id)
        
        // Use ref to avoid stale closure - fix race condition
        const currentSeriesData = seriesDataRef.current
        if (currentSeriesData && userId) {
          const opponentId = currentSeriesData.player1_id === userId 
            ? currentSeriesData.player2_id 
            : currentSeriesData.player1_id

          if (!presentUserIds.includes(opponentId) && disconnectState.disconnectedPlayerId !== opponentId) {
            // Opponent disconnected
            console.log('⚠️ Opponent disconnected:', opponentId)
            startDisconnectTimer(opponentId)
            
            const disconnectEvent: PlayerDisconnectedEvent = {
              type: SeriesEvents.PLAYER_DISCONNECTED,
              seriesId: currentSeriesData.id,
              playerId: opponentId,
              disconnectedAt: new Date().toISOString(),
              timeoutSeconds: DISCONNECT_TIMEOUT_SECONDS
            }
            onPlayerDisconnected?.(disconnectEvent)
          } else if (presentUserIds.includes(opponentId) && disconnectState.disconnectedPlayerId === opponentId) {
            // Opponent reconnected
            console.log('✅ Opponent reconnected:', opponentId)
            stopDisconnectTimer()
            
            const reconnectEvent: PlayerReconnectedEvent = {
              type: SeriesEvents.PLAYER_RECONNECTED,
              seriesId: currentSeriesData.id,
              playerId: opponentId,
              reconnectedAt: new Date().toISOString()
            }
            onPlayerReconnected?.(reconnectEvent)
          }
        }
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('👋 Player joined:', key, newPresences)
        
        // Check if this is the disconnected player reconnecting
        const joinedUserIds = newPresences.map((p: any) => p.user_id)
        if (disconnectState.disconnectedPlayerId && joinedUserIds.includes(disconnectState.disconnectedPlayerId)) {
          stopDisconnectTimer()
          
          // Use ref to avoid stale closure
          const currentSeriesData = seriesDataRef.current
          if (currentSeriesData) {
            const reconnectEvent: PlayerReconnectedEvent = {
              type: SeriesEvents.PLAYER_RECONNECTED,
              seriesId: currentSeriesData.id,
              playerId: disconnectState.disconnectedPlayerId,
              reconnectedAt: new Date().toISOString()
            }
            onPlayerReconnected?.(reconnectEvent)
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('👋 Player left:', key, leftPresences)
        
        // Check if opponent left
        const leftUserIds = leftPresences.map((p: any) => p.user_id)
        
        // Use ref to avoid stale closure
        const currentSeriesData = seriesDataRef.current
        if (currentSeriesData && userId) {
          const opponentId = currentSeriesData.player1_id === userId 
            ? currentSeriesData.player2_id 
            : currentSeriesData.player1_id

          if (leftUserIds.includes(opponentId)) {
            startDisconnectTimer(opponentId)
            
            const disconnectEvent: PlayerDisconnectedEvent = {
              type: SeriesEvents.PLAYER_DISCONNECTED,
              seriesId: currentSeriesData.id,
              playerId: opponentId,
              disconnectedAt: new Date().toISOString(),
              timeoutSeconds: DISCONNECT_TIMEOUT_SECONDS
            }
            onPlayerDisconnected?.(disconnectEvent)
          }
        }
      })

    // Subscribe and track presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Subscribed to series channel:', channelName)
        setIsSubscribed(true)

        // Track own presence
        if (userId) {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString()
          })
        }
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Failed to subscribe to series channel')
        setError('Failed to subscribe to series updates')
        setIsSubscribed(false)
      }
    })

    channelRef.current = channel

    // Cleanup
    return () => {
      console.log('🔕 Unsubscribing from series channel:', channelName)
      if (disconnectTimerRef.current) {
        clearInterval(disconnectTimerRef.current)
      }
      channel.unsubscribe()
      setIsSubscribed(false)
    }
  }, [seriesId, userId, enabled, fetchSeriesData, onSeriesDataChanged, onScoreUpdated, 
      onSideSwapped, onSeriesCompleted, onSeriesAbandoned, onPlayerDisconnected, 
      onPlayerReconnected, startDisconnectTimer, stopDisconnectTimer])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (disconnectTimerRef.current) {
        clearInterval(disconnectTimerRef.current)
      }
    }
  }, [])

  return {
    seriesData,
    isLoading,
    error,
    disconnectState,
    isSubscribed,
    refetch: fetchSeriesData
  }
}

export default useSeriesRealtime
