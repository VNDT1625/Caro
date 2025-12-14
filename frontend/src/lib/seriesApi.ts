/**
 * Series API - Client-side API calls for ranked series
 * Requirements: 7.1, 7.2, 7.3, 7.4, 8.3, 8.5
 */

import { supabase } from './supabase'

const PHP_BACKEND_URL = (import.meta.env as any).VITE_PHP_BACKEND_URL || 'http://localhost:8001'
const NODE_SERVER_URL = (import.meta.env as any).VITE_NODE_SERVER_URL || 'http://localhost:8000'

/**
 * Get auth token for API calls
 */
async function getAuthToken(): Promise<string | null> {
  const { data: session } = await supabase.auth.getSession()
  return session?.session?.access_token || null
}

/**
 * Get series state by ID
 * Requirements: 8.3
 */
export async function getSeriesState(seriesId: string): Promise<{
  success: boolean
  series?: any
  isComplete?: boolean
  nextGameReady?: boolean
  error?: string
}> {
  try {
    const response = await fetch(`${PHP_BACKEND_URL}/api/series/${seriesId}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: errorText }
    }

    const data = await response.json()
    return {
      success: true,
      series: data.series || data,
      isComplete: data.isComplete || false,
      nextGameReady: data.nextGameReady || false
    }
  } catch (err: any) {
    console.error('getSeriesState error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Get series state for a room
 * Requirements: 8.3
 */
export async function getSeriesStateForRoom(roomId: string): Promise<{
  success: boolean
  seriesId?: string
  gameNumber?: number
  series?: any
  isComplete?: boolean
  nextGameReady?: boolean
  error?: string
}> {
  try {
    const token = await getAuthToken()
    if (!token) {
      return { success: false, error: 'Not authenticated' }
    }

    const response = await fetch(`${NODE_SERVER_URL}/api/game/series/${roomId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: errorText }
    }

    const data = await response.json()
    return {
      success: true,
      seriesId: data.seriesId,
      gameNumber: data.gameNumber,
      series: data.series,
      isComplete: data.isComplete || false,
      nextGameReady: data.nextGameReady || false
    }
  } catch (err: any) {
    console.error('getSeriesStateForRoom error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Prepare next game in series (reset board, swap sides)
 * Requirements: 8.5
 */
export async function prepareNextSeriesGame(roomId: string, seriesId: string): Promise<{
  success: boolean
  gameState?: any
  series?: any
  matchId?: string
  error?: string
}> {
  try {
    const token = await getAuthToken()
    if (!token) {
      return { success: false, error: 'Not authenticated' }
    }

    const response = await fetch(`${NODE_SERVER_URL}/api/game/series/${roomId}/next`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ seriesId })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: errorText }
    }

    const data = await response.json()
    return {
      success: data.success,
      gameState: data.gameState,
      series: data.series,
      matchId: data.matchId
    }
  } catch (err: any) {
    console.error('prepareNextSeriesGame error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Forfeit current game in series
 * Requirements: 7.2, 7.3
 */
export async function forfeitSeriesGame(seriesId: string, forfeitingPlayerId: string): Promise<{
  success: boolean
  isComplete?: boolean
  seriesScore?: string
  error?: string
}> {
  try {
    const response = await fetch(`${PHP_BACKEND_URL}/api/series/${seriesId}/forfeit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ forfeiting_player_id: forfeitingPlayerId })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: errorText }
    }

    const data = await response.json()
    return {
      success: true,
      isComplete: data.isComplete,
      seriesScore: `${data.series?.player1_wins || 0}-${data.series?.player2_wins || 0}`
    }
  } catch (err: any) {
    console.error('forfeitSeriesGame error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Abandon entire series (voluntary leave)
 * Requirements: 7.4, 7.5
 */
export async function abandonSeries(seriesId: string, abandoningPlayerId: string): Promise<{
  success: boolean
  winnerId?: string
  abandonPenalty?: number
  finalScore?: string
  error?: string
}> {
  try {
    const response = await fetch(`${PHP_BACKEND_URL}/api/series/${seriesId}/abandon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ abandoning_player_id: abandoningPlayerId })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: errorText }
    }

    const data = await response.json()
    return {
      success: true,
      winnerId: data.winnerId,
      abandonPenalty: data.abandonPenalty,
      finalScore: data.finalScore
    }
  } catch (err: any) {
    console.error('abandonSeries error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Request rematch after series ends
 * Requirements: 10.1, 10.2
 */
export async function requestRematch(seriesId: string, playerId: string): Promise<{
  success: boolean
  newSeriesId?: string
  newSeries?: any
  error?: string
}> {
  try {
    const response = await fetch(`${PHP_BACKEND_URL}/api/series/${seriesId}/rematch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ player_id: playerId })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: errorText }
    }

    const data = await response.json()
    return {
      success: true,
      newSeriesId: data.newSeriesId || data.series?.id,
      newSeries: data.series
    }
  } catch (err: any) {
    console.error('requestRematch error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Subscribe to series updates via Supabase Realtime
 * Requirements: 8.3, 8.5
 */
export function subscribeToSeries(
  seriesId: string,
  callbacks: {
    onUpdate?: (series: any) => void
    onGameEnded?: (data: any) => void
    onSeriesCompleted?: (data: any) => void
    onError?: (error: any) => void
  }
) {
  const channel = supabase
    .channel(`series:${seriesId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'ranked_series',
        filter: `id=eq.${seriesId}`
      },
      (payload) => {
        console.log('📡 Series update received:', payload)
        const newData = payload.new as any
        const oldData = payload.old as any

        callbacks.onUpdate?.(newData)

        // Detect game ended (score changed)
        if (oldData && (
          oldData.player1_wins !== newData.player1_wins ||
          oldData.player2_wins !== newData.player2_wins
        )) {
          callbacks.onGameEnded?.({
            seriesId: newData.id,
            score: `${newData.player1_wins}-${newData.player2_wins}`,
            currentGame: newData.current_game,
            isComplete: newData.status === 'completed'
          })
        }

        // Detect series completed
        if (oldData && oldData.status !== 'completed' && newData.status === 'completed') {
          callbacks.onSeriesCompleted?.({
            seriesId: newData.id,
            winnerId: newData.winner_id,
            finalScore: newData.final_score,
            rewards: {
              winnerMp: newData.winner_mp_change,
              loserMp: newData.loser_mp_change,
              winnerCoins: newData.winner_coins,
              loserCoins: newData.loser_coins,
              winnerExp: newData.winner_exp,
              loserExp: newData.loser_exp
            }
          })
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Subscribed to series updates:', seriesId)
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Failed to subscribe to series')
        callbacks.onError?.(new Error('Failed to subscribe to series updates'))
      }
    })

  // Return unsubscribe function
  return () => {
    console.log('🔕 Unsubscribing from series:', seriesId)
    supabase.removeChannel(channel)
  }
}

export default {
  getSeriesState,
  getSeriesStateForRoom,
  prepareNextSeriesGame,
  forfeitSeriesGame,
  abandonSeries,
  requestRematch,
  subscribeToSeries
}
