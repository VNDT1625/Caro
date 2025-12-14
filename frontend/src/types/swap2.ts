/**
 * Swap 2 Opening Rule Types
 * 
 * TypeScript types for the Swap 2 opening phase in Gomoku/Caro.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

export type Swap2Phase = 
  | 'swap2_placement'    // P1 places 3 stones
  | 'swap2_choice'       // P2 chooses
  | 'swap2_extra'        // P2 places 2 more (if chose place_more)
  | 'swap2_final_choice' // P1 chooses color
  | 'complete'           // Swap 2 done, ready for main game

export type Swap2Choice = 'black' | 'white' | 'place_more'

export interface TentativeStone {
  x: number
  y: number
  placedBy: string
  placementOrder: number
  phase: Swap2Phase
}

export interface Swap2Action {
  type: 'place' | 'choice'
  playerId: string
  timestamp: string
  data: {
    x?: number
    y?: number
    choice?: Swap2Choice
  }
}

export interface ColorAssignment {
  blackPlayerId: string
  whitePlayerId: string
  firstMover: string
}

export interface Swap2State {
  phase: Swap2Phase
  player1Id: string
  player2Id: string
  activePlayerId: string
  tentativeStones: TentativeStone[]
  finalChoice?: {
    chooser: string
    chosenColor: 'black' | 'white'
  }
  blackPlayerId?: string
  whitePlayerId?: string
  actions: Swap2Action[]
}

// Phase display info
export interface Swap2PhaseInfo {
  phase: Swap2Phase
  title: string
  description: string
  stonesRequired: number
  stonesPlaced: number
  activePlayerName: string
  isCurrentUserActive: boolean
}

// Choice options for UI
export interface Swap2ChoiceOption {
  value: Swap2Choice
  label: string
  description: string
  icon: string
}
