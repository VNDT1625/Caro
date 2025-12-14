/**
 * Swap2GameWrapper Component
 * 
 * Wrapper component that integrates Swap 2 UI with game board.
 * Handles the complete Swap 2 flow including:
 * - Phase indicator display
 * - Color choice modal
 * - Transition to main game
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 1.6
 */

import { useState, useCallback } from 'react'
import { useSwap2State } from '../../hooks/useSwap2State'
import Swap2PhaseIndicator from './Swap2PhaseIndicator'
import ColorChoiceModal from './ColorChoiceModal'
import Swap2CompleteOverlay from './Swap2CompleteOverlay'
import type { Swap2Choice, ColorAssignment, Swap2Phase } from '../../types/swap2'

interface Swap2GameWrapperProps {
  roomId: string | null
  userId: string | null
  player1Id: string | null
  player2Id: string | null
  player1Name: string
  player2Name: string
  enabled?: boolean
  timeRemaining?: number
  onSwap2Complete?: (assignment: ColorAssignment) => void
  onError?: (error: string) => void
  children: (props: {
    isSwap2Active: boolean
    swap2Phase: Swap2Phase | null
    tentativeStones: ReturnType<typeof useSwap2State>['tentativeStones']
    onSwap2PlaceStone: (x: number, y: number) => void
    isCurrentUserActive: boolean
  }) => React.ReactNode
}

export default function Swap2GameWrapper({
  roomId,
  userId,
  player1Id,
  player2Id,
  player1Name,
  player2Name,
  enabled = true,
  timeRemaining,
  onSwap2Complete,
  onError,
  children
}: Swap2GameWrapperProps) {
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false)
  const [completedAssignment, setCompletedAssignment] = useState<ColorAssignment | null>(null)

  // Handle Swap 2 completion - Requirements: 1.6, 5.6
  const handleSwap2Complete = useCallback((assignment: ColorAssignment) => {
    setCompletedAssignment(assignment)
    setShowCompleteOverlay(true)
  }, [])

  const handleContinueToGame = useCallback(() => {
    setShowCompleteOverlay(false)
    if (completedAssignment) {
      onSwap2Complete?.(completedAssignment)
    }
  }, [completedAssignment, onSwap2Complete])

  const {
    isSwap2Active,
    isSwap2Complete,
    currentPhase,
    tentativeStones,
    activePlayerId,
    isCurrentUserActive,
    stonesPlaced,
    stonesRequired,
    colorAssignment,
    placeStone,
    makeChoice,
    shouldShowChoiceModal,
    availableChoices,
    getPhaseDisplayInfo
  } = useSwap2State({
    roomId,
    userId,
    player1Id,
    player2Id,
    enabled,
    onComplete: handleSwap2Complete,
    onError
  })

  // Handle stone placement - Requirements: 2.1, 2.3
  const handleSwap2PlaceStone = useCallback(async (x: number, y: number) => {
    const success = await placeStone(x, y)
    if (!success) {
      console.log('Failed to place stone at', x, y)
    }
  }, [placeStone])

  // Handle color choice - Requirements: 3.1, 3.5
  const handleChoice = useCallback(async (choice: Swap2Choice) => {
    const success = await makeChoice(choice)
    if (!success) {
      console.log('Failed to make choice:', choice)
    }
  }, [makeChoice])

  // Get active player name
  const activePlayerName = activePlayerId === player1Id ? player1Name 
    : activePlayerId === player2Id ? player2Name 
    : 'Unknown'

  return (
    <div className="swap2-game-wrapper" style={{ position: 'relative' }}>
      {/* Swap 2 Phase Indicator - Requirements: 5.1, 5.2, 5.4 */}
      {isSwap2Active && currentPhase && currentPhase !== 'complete' && (
        <div style={{
          position: 'absolute',
          top: '-80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100
        }}>
          <Swap2PhaseIndicator
            phase={currentPhase}
            activePlayerName={activePlayerName}
            isCurrentUserActive={isCurrentUserActive}
            stonesPlaced={stonesPlaced}
            stonesRequired={stonesRequired}
            timeRemaining={timeRemaining}
          />
        </div>
      )}

      {/* Game Board with Swap 2 props */}
      {children({
        isSwap2Active,
        swap2Phase: currentPhase,
        tentativeStones,
        onSwap2PlaceStone: handleSwap2PlaceStone,
        isCurrentUserActive
      })}

      {/* Color Choice Modal - Requirements: 5.3, 5.5 */}
      {shouldShowChoiceModal && (currentPhase === 'swap2_choice' || currentPhase === 'swap2_final_choice') && (
        <ColorChoiceModal
          phase={currentPhase}
          onChoice={handleChoice}
          tentativeStones={tentativeStones}
          timeRemaining={timeRemaining}
          disabled={!isCurrentUserActive}
        />
      )}

      {/* Swap 2 Complete Overlay - Requirements: 5.6, 1.6 */}
      {showCompleteOverlay && completedAssignment && userId && (
        <Swap2CompleteOverlay
          colorAssignment={completedAssignment}
          player1Name={player1Name}
          player2Name={player2Name}
          currentUserId={userId}
          onContinue={handleContinueToGame}
          autoCloseDelay={5000}
        />
      )}
    </div>
  )
}
