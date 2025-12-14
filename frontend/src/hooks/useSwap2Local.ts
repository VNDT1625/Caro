/**
 * useSwap2Local Hook
 * 
 * Local Swap 2 state management for offline modes (Hotseat/Tiêu Dao).
 * No socket communication - all state managed locally.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type { Swap2Phase, Swap2Choice, TentativeStone, ColorAssignment } from '../types/swap2'

type PlayerSide = 'X' | 'O'

interface UseSwap2LocalOptions {
  enabled: boolean
  player1Name: string
  player2Name: string
  onComplete?: (assignment: ColorAssignment & { player1Side: PlayerSide; player2Side: PlayerSide; tentativeStones: TentativeStone[] }) => void
}

interface UseSwap2LocalReturn {
  // State
  isSwap2Active: boolean
  isSwap2Complete: boolean
  currentPhase: Swap2Phase | null
  tentativeStones: TentativeStone[]
  activePlayer: 1 | 2
  stonesPlaced: number
  stonesRequired: number
  
  // Actions
  placeStone: (x: number, y: number) => boolean
  makeChoice: (choice: Swap2Choice) => boolean
  reset: () => void
  
  // UI helpers
  shouldShowChoiceModal: boolean
  availableChoices: Swap2Choice[]
  getActivePlayerName: () => string
  getPhaseDisplayInfo: () => {
    title: string
    description: string
    icon: string
    color: string
  }
  
  // Result
  colorAssignment: (ColorAssignment & { player1Side: PlayerSide; player2Side: PlayerSide; tentativeStones: TentativeStone[] }) | null
}

export function useSwap2Local({
  enabled,
  player1Name,
  player2Name,
  onComplete
}: UseSwap2LocalOptions): UseSwap2LocalReturn {
  // Phase: swap2_placement -> swap2_choice -> (swap2_extra -> swap2_final_choice) -> complete
  const [phase, setPhase] = useState<Swap2Phase | null>(enabled ? 'swap2_placement' : null)
  const [tentativeStones, setTentativeStones] = useState<TentativeStone[]>([])
  const [activePlayer, setActivePlayer] = useState<1 | 2>(1) // Player 1 starts
  const [colorAssignment, setColorAssignment] = useState<(ColorAssignment & { player1Side: PlayerSide; player2Side: PlayerSide; tentativeStones: TentativeStone[] }) | null>(null)
  const prevEnabledRef = useRef(enabled)
  
  // Auto-reset when enabled changes
  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      // Just enabled - start swap2
      console.log('🔄 Swap2 enabled, starting placement phase')
      setPhase('swap2_placement')
      setTentativeStones([])
      setActivePlayer(1)
      setColorAssignment(null)
    } else if (!enabled && prevEnabledRef.current) {
      // Just disabled
      console.log('🔄 Swap2 disabled')
      setPhase(null)
    }
    prevEnabledRef.current = enabled
  }, [enabled])

  // Derived state
  const isSwap2Active = enabled && phase !== null && phase !== 'complete'
  const isSwap2Complete = phase === 'complete'
  const stonesPlaced = tentativeStones.length
  const stonesRequired = phase === 'swap2_placement' ? 3 : phase === 'swap2_extra' ? 5 : stonesPlaced

  const shouldShowChoiceModal = phase === 'swap2_choice' || phase === 'swap2_final_choice'
  
  const availableChoices: Swap2Choice[] = useMemo(() => {
    if (phase === 'swap2_choice') return ['black', 'white', 'place_more']
    if (phase === 'swap2_final_choice') return ['black', 'white']
    return []
  }, [phase])

  const getActivePlayerName = useCallback(() => {
    return activePlayer === 1 ? player1Name : player2Name
  }, [activePlayer, player1Name, player2Name])

  // Place stone during placement phases
  const placeStone = useCallback((x: number, y: number): boolean => {
    if (!isSwap2Active) return false
    if (phase !== 'swap2_placement' && phase !== 'swap2_extra') return false
    
    // Check if position already occupied
    if (tentativeStones.some(s => s.x === x && s.y === y)) return false

    const newStone: TentativeStone = {
      x,
      y,
      placedBy: `player${activePlayer}`,
      placementOrder: stonesPlaced + 1,
      phase: phase
    }

    const newStones = [...tentativeStones, newStone]
    setTentativeStones(newStones)

    // Check phase transitions
    if (phase === 'swap2_placement' && newStones.length >= 3) {
      // After 3 stones, Player 2 makes choice
      setPhase('swap2_choice')
      setActivePlayer(2)
    } else if (phase === 'swap2_extra' && newStones.length >= 5) {
      // After 5 stones, Player 1 makes final choice
      setPhase('swap2_final_choice')
      setActivePlayer(1)
    }

    return true
  }, [isSwap2Active, phase, tentativeStones, stonesPlaced, activePlayer])

  // Make choice during choice phases
  const makeChoice = useCallback((choice: Swap2Choice): boolean => {
    if (!isSwap2Active) return false
    if (!availableChoices.includes(choice)) return false

    if (choice === 'place_more') {
      // Player 2 wants to place more stones
      setPhase('swap2_extra')
      // Player 2 continues placing
      return true
    }

    // Color choice made
    // In Swap2: stones 1,3,4 = Black(X), stones 2,5 = White(O)
    // If player chooses 'black', they play as X
    // If player chooses 'white', they play as O
    
    let player1Side: PlayerSide
    let player2Side: PlayerSide
    
    if (activePlayer === 2) {
      // Player 2 is choosing (after 3 stones)
      if (choice === 'black') {
        player2Side = 'X'
        player1Side = 'O'
      } else {
        player2Side = 'O'
        player1Side = 'X'
      }
    } else {
      // Player 1 is choosing (after 5 stones - final choice)
      if (choice === 'black') {
        player1Side = 'X'
        player2Side = 'O'
      } else {
        player1Side = 'O'
        player2Side = 'X'
      }
    }

    const assignment = {
      blackPlayerId: player1Side === 'X' ? 'player1' : 'player2',
      whitePlayerId: player1Side === 'O' ? 'player1' : 'player2',
      firstMover: 'player1', // Black always moves first
      player1Side,
      player2Side,
      tentativeStones // Include stones in callback for board initialization
    }

    setColorAssignment(assignment)
    setPhase('complete')
    onComplete?.(assignment)

    return true
  }, [isSwap2Active, availableChoices, activePlayer, onComplete])

  // Reset swap2 state
  const reset = useCallback(() => {
    if (enabled) {
      setPhase('swap2_placement')
      setTentativeStones([])
      setActivePlayer(1)
      setColorAssignment(null)
    } else {
      setPhase(null)
    }
  }, [enabled])

  // Get phase display info
  const getPhaseDisplayInfo = useCallback(() => {
    switch (phase) {
      case 'swap2_placement':
        return {
          title: 'Đặt quân mở đầu',
          description: `${getActivePlayerName()} đặt 3 quân (2 đen + 1 trắng)`,
          icon: '🎯',
          color: '#22D3EE'
        }
      case 'swap2_choice':
        return {
          title: 'Chọn màu',
          description: `${getActivePlayerName()} chọn màu hoặc đặt thêm quân`,
          icon: '🎨',
          color: '#A78BFA'
        }
      case 'swap2_extra':
        return {
          title: 'Đặt thêm quân',
          description: `${getActivePlayerName()} đặt thêm 2 quân`,
          icon: '➕',
          color: '#F59E0B'
        }
      case 'swap2_final_choice':
        return {
          title: 'Chọn màu cuối',
          description: `${getActivePlayerName()} chọn màu để bắt đầu`,
          icon: '✨',
          color: '#10B981'
        }
      case 'complete':
        return {
          title: 'Hoàn tất Swap 2',
          description: 'Bắt đầu trận đấu!',
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
  }, [phase, getActivePlayerName])

  return {
    isSwap2Active,
    isSwap2Complete,
    currentPhase: phase,
    tentativeStones,
    activePlayer,
    stonesPlaced,
    stonesRequired,
    placeStone,
    makeChoice,
    reset,
    shouldShowChoiceModal,
    availableChoices,
    getActivePlayerName,
    getPhaseDisplayInfo,
    colorAssignment
  }
}

export default useSwap2Local
