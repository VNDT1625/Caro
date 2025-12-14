/**
 * useSwap2State Hook
 * 
 * Provides Swap 2 state management and actions for game components.
 * Handles socket communication for Swap 2 events.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useSocket } from './useSocket'
import type { 
  Swap2State, 
  Swap2Phase, 
  Swap2Choice, 
  TentativeStone,
  ColorAssignment 
} from '../types/swap2'

interface UseSwap2StateOptions {
  roomId: string | null
  userId: string | null
  player1Id: string | null
  player2Id: string | null
  enabled?: boolean
  onPhaseChange?: (phase: Swap2Phase) => void
  onComplete?: (assignment: ColorAssignment) => void
  onError?: (error: string) => void
}

interface UseSwap2StateReturn {
  // State
  swap2State: Swap2State | null
  isSwap2Active: boolean
  isSwap2Complete: boolean
  currentPhase: Swap2Phase | null
  tentativeStones: TentativeStone[]
  activePlayerId: string | null
  isCurrentUserActive: boolean
  stonesPlaced: number
  stonesRequired: number
  colorAssignment: ColorAssignment | null
  
  // Actions
  placeStone: (x: number, y: number) => Promise<boolean>
  makeChoice: (choice: Swap2Choice) => Promise<boolean>
  
  // UI helpers
  shouldShowChoiceModal: boolean
  availableChoices: Swap2Choice[]
  getPhaseDisplayInfo: () => {
    title: string
    description: string
    icon: string
    color: string
  }
}

export function useSwap2State({
  roomId,
  userId,
  player1Id,
  player2Id,
  enabled = true,
  onPhaseChange,
  onComplete,
  onError
}: UseSwap2StateOptions): UseSwap2StateReturn {
  const [swap2State, setSwap2State] = useState<Swap2State | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const previousPhaseRef = useRef<Swap2Phase | null>(null)
  
  // Socket connection for swap2 events
  const { socket, isConnected, emit, on, off } = useSocket({ 
    autoConnect: enabled && !!roomId,
    roomId 
  })

  // Derived state
  const isSwap2Active = swap2State !== null && swap2State.phase !== 'complete'
  const isSwap2Complete = swap2State?.phase === 'complete'
  const currentPhase = swap2State?.phase ?? null
  const tentativeStones = swap2State?.tentativeStones ?? []
  const activePlayerId = swap2State?.activePlayerId ?? null
  const isCurrentUserActive = activePlayerId === userId

  // Calculate stones placed and required based on phase
  const stonesPlaced = tentativeStones.length
  const stonesRequired = currentPhase === 'swap2_placement' ? 3 
    : currentPhase === 'swap2_extra' ? 5 
    : stonesPlaced

  // Color assignment
  const colorAssignment: ColorAssignment | null = swap2State?.blackPlayerId && swap2State?.whitePlayerId
    ? {
        blackPlayerId: swap2State.blackPlayerId,
        whitePlayerId: swap2State.whitePlayerId,
        firstMover: swap2State.blackPlayerId
      }
    : null

  // UI helpers
  const shouldShowChoiceModal = isCurrentUserActive && 
    (currentPhase === 'swap2_choice' || currentPhase === 'swap2_final_choice')

  const availableChoices: Swap2Choice[] = currentPhase === 'swap2_choice'
    ? ['black', 'white', 'place_more']
    : currentPhase === 'swap2_final_choice'
    ? ['black', 'white']
    : []

  // Phase change callback
  useEffect(() => {
    if (currentPhase && currentPhase !== previousPhaseRef.current) {
      previousPhaseRef.current = currentPhase
      onPhaseChange?.(currentPhase)
      
      // Check for completion
      if (currentPhase === 'complete' && colorAssignment) {
        onComplete?.(colorAssignment)
      }
    }
  }, [currentPhase, colorAssignment, onPhaseChange, onComplete])

  // Subscribe to socket events for Swap2
  useEffect(() => {
    if (!roomId || !enabled || !isConnected) return

    // Handle stone placed event
    const handleStonePlaced = (data: any) => {
      console.log('🎯 Swap2 stone placed:', data)
      
      // Map server format to client format
      const mappedStones = (data.tentative_stones || []).map((s: any) => ({
        x: s.x,
        y: s.y,
        placedBy: s.placed_by,
        placementOrder: s.placement_order,
        phase: s.phase
      }))
      
      setSwap2State(prev => {
        if (!prev) {
          // Initialize state if not exists
          return {
            phase: data.phase,
            player1Id: player1Id || '',
            player2Id: player2Id || '',
            activePlayerId: data.active_player_id,
            tentativeStones: mappedStones,
            blackPlayerId: undefined,
            whitePlayerId: undefined,
            finalChoice: undefined,
            actions: []
          }
        }
        return {
          ...prev,
          phase: data.phase,
          activePlayerId: data.active_player_id,
          tentativeStones: mappedStones.length > 0 ? mappedStones : prev.tentativeStones
        }
      })
    }

    // Handle choice made event
    const handleChoiceMade = (data: any) => {
      console.log('🎨 Swap2 choice made:', data)
      setSwap2State(prev => {
        if (!prev) return prev
        return {
          ...prev,
          phase: data.phase,
          activePlayerId: data.active_player_id,
          blackPlayerId: data.black_player_id || prev.blackPlayerId,
          whitePlayerId: data.white_player_id || prev.whitePlayerId
        }
      })
    }

    // Handle swap2 complete event
    const handleSwap2Complete = (data: any) => {
      console.log('✅ Swap2 complete:', data)
      const assignment: ColorAssignment = {
        blackPlayerId: data.black_player_id,
        whitePlayerId: data.white_player_id,
        firstMover: data.first_mover || data.black_player_id
      }
      
      setSwap2State(prev => ({
        ...prev!,
        phase: 'complete',
        blackPlayerId: data.black_player_id,
        whitePlayerId: data.white_player_id
      }))
      
      onComplete?.(assignment)
    }

    // Handle error event
    const handleSwap2Error = (data: any) => {
      console.error('❌ Swap2 error:', data)
      onError?.(data.error || 'Unknown swap2 error')
    }

    // Handle room state (initial state when joining)
    const handleRoomState = (data: any) => {
      console.log('📍 Room state received:', data)
      if (data.swap2_enabled && data.swap2_state) {
        setSwap2State({
          phase: data.swap2_state.phase,
          player1Id: data.swap2_state.player1_id || player1Id || '',
          player2Id: data.swap2_state.player2_id || player2Id || '',
          activePlayerId: data.swap2_state.active_player_id,
          tentativeStones: (data.swap2_state.tentative_stones || []).map((s: any) => ({
            x: s.x,
            y: s.y,
            placedBy: s.placed_by,
            placementOrder: s.placement_order,
            phase: s.phase
          })),
          blackPlayerId: data.swap2_state.black_player_id || null,
          whitePlayerId: data.swap2_state.white_player_id || null,
          finalChoice: data.swap2_state.final_choice || null,
          actions: data.swap2_state.actions || []
        })
      }
    }

    // Register event handlers
    on('swap2_stone_placed', handleStonePlaced)
    on('swap2_choice_made', handleChoiceMade)
    on('swap2_complete', handleSwap2Complete)
    on('swap2_error', handleSwap2Error)
    on('room_state', handleRoomState)

    return () => {
      off('swap2_stone_placed', handleStonePlaced)
      off('swap2_choice_made', handleChoiceMade)
      off('swap2_complete', handleSwap2Complete)
      off('swap2_error', handleSwap2Error)
      off('room_state', handleRoomState)
    }
  }, [roomId, enabled, isConnected, player1Id, player2Id, on, off, onComplete, onError])

  // Place stone action - via socket
  const placeStone = useCallback(async (x: number, y: number): Promise<boolean> => {
    if (!roomId || !userId || !isSwap2Active || !isCurrentUserActive) {
      console.log('❌ Cannot place stone:', { roomId, userId, isSwap2Active, isCurrentUserActive })
      return false
    }

    // Check if placement is allowed in current phase
    if (currentPhase !== 'swap2_placement' && currentPhase !== 'swap2_extra') {
      onError?.('Stone placement not allowed in current phase')
      return false
    }

    // Check if position is already occupied
    if (tentativeStones.some(s => s.x === x && s.y === y)) {
      onError?.('Position already occupied')
      return false
    }

    if (!isConnected) {
      onError?.('Socket not connected')
      return false
    }

    // Emit via socket - server will validate and broadcast
    console.log('🎯 Emitting swap2_place_stone:', { roomId, x, y })
    emit('swap2_place_stone', { roomId, x, y })
    return true
  }, [roomId, userId, isSwap2Active, isCurrentUserActive, currentPhase, tentativeStones, isConnected, emit, onError])

  // Make choice action - via socket
  const makeChoice = useCallback(async (choice: Swap2Choice): Promise<boolean> => {
    if (!roomId || !userId || !isSwap2Active || !isCurrentUserActive) {
      console.log('❌ Cannot make choice:', { roomId, userId, isSwap2Active, isCurrentUserActive })
      return false
    }

    // Validate choice for current phase
    if (!availableChoices.includes(choice)) {
      onError?.(`Invalid choice "${choice}" for current phase`)
      return false
    }

    if (!isConnected) {
      onError?.('Socket not connected')
      return false
    }

    // Emit via socket - server will validate and broadcast
    console.log('🎨 Emitting swap2_make_choice:', { roomId, choice })
    emit('swap2_make_choice', { roomId, choice })
    return true
  }, [roomId, userId, isSwap2Active, isCurrentUserActive, availableChoices, isConnected, emit, onError])

  // Get phase display info
  const getPhaseDisplayInfo = useCallback(() => {
    switch (currentPhase) {
      case 'swap2_placement':
        return {
          title: 'Đặt quân mở đầu',
          description: 'Đặt 3 quân đầu tiên (2 đen + 1 trắng)',
          icon: '🎯',
          color: '#22D3EE'
        }
      case 'swap2_choice':
        return {
          title: 'Chọn màu',
          description: 'Chọn màu hoặc đặt thêm quân',
          icon: '🎨',
          color: '#A78BFA'
        }
      case 'swap2_extra':
        return {
          title: 'Đặt thêm quân',
          description: 'Đặt thêm 2 quân (1 đen + 1 trắng)',
          icon: '➕',
          color: '#F59E0B'
        }
      case 'swap2_final_choice':
        return {
          title: 'Chọn màu cuối',
          description: 'Chọn màu để bắt đầu',
          icon: '✨',
          color: '#10B981'
        }
      case 'complete':
        return {
          title: 'Hoàn tất',
          description: 'Bắt đầu trận đấu',
          icon: '✅',
          color: '#22C55E'
        }
      default:
        return {
          title: 'Swap 2',
          description: '',
          icon: '🎮',
          color: '#64748B'
        }
    }
  }, [currentPhase])

  return {
    // State
    swap2State,
    isSwap2Active,
    isSwap2Complete,
    currentPhase,
    tentativeStones,
    activePlayerId,
    isCurrentUserActive,
    stonesPlaced,
    stonesRequired,
    colorAssignment,
    
    // Actions
    placeStone,
    makeChoice,
    
    // UI helpers
    shouldShowChoiceModal,
    availableChoices,
    getPhaseDisplayInfo
  }
}

export default useSwap2State
