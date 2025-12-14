/**
 * Swap 2 Opening Rule Components
 * 
 * Components for the Swap 2 fair opening phase in Gomoku/Caro.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

export { default as Swap2PhaseIndicator } from './Swap2PhaseIndicator'
export { default as ColorChoiceModal } from './ColorChoiceModal'
export { 
  default as TentativeStoneDisplay,
  TentativeStoneOverlay,
  TentativeStoneLegend 
} from './TentativeStoneDisplay'
export { default as Swap2CompleteOverlay } from './Swap2CompleteOverlay'
export { default as Swap2GameWrapper } from './Swap2GameWrapper'
export { default as Swap2Badge } from './Swap2Badge'

// Re-export types
export type {
  Swap2Phase,
  Swap2Choice,
  TentativeStone,
  Swap2Action,
  ColorAssignment,
  Swap2State,
  Swap2PhaseInfo,
  Swap2ChoiceOption
} from '../../types/swap2'
