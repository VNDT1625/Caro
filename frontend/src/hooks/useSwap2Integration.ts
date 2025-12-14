/**
 * useSwap2Integration Hook
 * 
 * Higher-level hook for integrating Swap 2 with existing game pages.
 * Handles the transition from Swap 2 phase to main game phase.
 * 
 * Requirements: 1.6, 5.6
 */

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { ColorAssignment, Swap2State, TentativeStone } from '../types/swap2'

interface UseSwap2IntegrationOptions {
  roomId: string | null
  userId: string | null
  enabled?: boolean
  onTransitionToMainGame?: (assignment: ColorAssignment, playerSide: 'X' | 'O') => void
}

interface UseSwap2IntegrationReturn {
  // State
  isSwap2Enabled: boolean
  isSwap2Phase: boolean
  isMainGamePhase: boolean
  swap2State: Swap2State | null
  colorAssignment: ColorAssignment | null
  playerSide: 'X' | 'O' | null
  
  // For board rendering
  tentativeStones: TentativeStone[]
  
  // Actions
  initializeSwap2: () => Promise<boolean>
  transitionToMainGame: () => void
  
  // Loading state
  isLoading: boolean
}

const PHP_BACKEND_URL = import.meta.env.VITE_PHP_BACKEND_URL || 'http://localhost:8001'

export function useSwap2Integration({
  roomId,
  userId,
  enabled = true,
  onTransitionToMainGame
}: UseSwap2IntegrationOptions): UseSwap2IntegrationReturn {
  const [isSwap2Enabled, setIsSwap2Enabled] = useState(false)
  const [swap2State, setSwap2State] = useState<Swap2State | null>(null)
  const [colorAssignment, setColorAssignment] = useState<ColorAssignment | null>(null)
  const [playerSide, setPlayerSide] = useState<'X' | 'O' | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasTransitioned, setHasTransitioned] = useState(false)

  // Derived state
  const isSwap2Phase = isSwap2Enabled && swap2State !== null && swap2State.phase !== 'complete' && !hasTransitioned
  const isMainGamePhase = !isSwap2Enabled || hasTransitioned || swap2State?.phase === 'complete'
  const tentativeStones = swap2State?.tentativeStones ?? []

  // Load initial state
  useEffect(() => {
    if (!roomId || !enabled) {
      setIsLoading(false)
      return
    }

    const loadRoomState = async () => {
      try {
        const { data: room, error } = await supabase
          .from('rooms')
          .select('swap2_enabled, game_state')
          .eq('id', roomId)
          .single()

        if (error) {
          console.error('Failed to load room for Swap2 integration:', error)
          setIsLoading(false)
          return
        }

        setIsSwap2Enabled(room?.swap2_enabled ?? false)
        
        if (room?.game_state?.swap2State) {
          setSwap2State(room.game_state.swap2State)
          
          // Check if already completed
          if (room.game_state.swap2State.phase === 'complete') {
            const assignment: ColorAssignment = {
              blackPlayerId: room.game_state.swap2State.blackPlayerId,
              whitePlayerId: room.game_state.swap2State.whitePlayerId,
              firstMover: room.game_state.swap2State.blackPlayerId
            }
            setColorAssignment(assignment)
            
            // Determine player side
            if (userId === assignment.blackPlayerId) {
              setPlayerSide('X')
            } else if (userId === assignment.whitePlayerId) {
              setPlayerSide('O')
            }
          }
        }
        
        setIsLoading(false)
      } catch (err) {
        console.error('Error loading Swap2 integration state:', err)
        setIsLoading(false)
      }
    }

    loadRoomState()
  }, [roomId, userId, enabled])

  // Subscribe to realtime updates
  useEffect(() => {
    if (!roomId || !enabled) return

    const channel = supabase
      .channel(`swap2-integration-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`
        },
        (payload) => {
          const newRoom = payload.new as any
          
          if (newRoom?.swap2_enabled !== undefined) {
            setIsSwap2Enabled(newRoom.swap2_enabled)
          }
          
          if (newRoom?.game_state?.swap2State) {
            const newSwap2State = newRoom.game_state.swap2State
            setSwap2State(newSwap2State)
            
            // Check for completion
            if (newSwap2State.phase === 'complete' && !hasTransitioned) {
              const assignment: ColorAssignment = {
                blackPlayerId: newSwap2State.blackPlayerId,
                whitePlayerId: newSwap2State.whitePlayerId,
                firstMover: newSwap2State.blackPlayerId
              }
              setColorAssignment(assignment)
              
              // Determine player side
              if (userId === assignment.blackPlayerId) {
                setPlayerSide('X')
              } else if (userId === assignment.whitePlayerId) {
                setPlayerSide('O')
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [roomId, userId, enabled, hasTransitioned])

  // Initialize Swap 2 for a new game
  const initializeSwap2 = useCallback(async (): Promise<boolean> => {
    if (!roomId) return false

    setIsLoading(true)
    setHasTransitioned(false)

    try {
      const response = await fetch(`${PHP_BACKEND_URL}/api/swap2/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Failed to initialize Swap2:', result.error)
        setIsLoading(false)
        return false
      }

      if (result.swap2State) {
        setSwap2State(result.swap2State)
        setIsSwap2Enabled(true)
      }

      setIsLoading(false)
      return true
    } catch (err) {
      console.error('Error initializing Swap2:', err)
      setIsLoading(false)
      return false
    }
  }, [roomId])

  // Transition to main game - Requirements: 1.6, 5.6
  const transitionToMainGame = useCallback(() => {
    if (!colorAssignment || !playerSide) {
      console.warn('Cannot transition: missing color assignment or player side')
      return
    }

    setHasTransitioned(true)
    onTransitionToMainGame?.(colorAssignment, playerSide)
  }, [colorAssignment, playerSide, onTransitionToMainGame])

  return {
    // State
    isSwap2Enabled,
    isSwap2Phase,
    isMainGamePhase,
    swap2State,
    colorAssignment,
    playerSide,
    
    // For board rendering
    tentativeStones,
    
    // Actions
    initializeSwap2,
    transitionToMainGame,
    
    // Loading state
    isLoading
  }
}

export default useSwap2Integration
