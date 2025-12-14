# Implementation Plan - Swap 2 Opening Rule

## Phase 1: Backend Core Logic

- [x] 1. Create Swap2Manager Service
  - [x] 1.1 Create Swap2ManagerServiceInterface with method signatures
    - Define initializeSwap2, placeStone, makeChoice, getState, isComplete, getFinalAssignments
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Create Swap2State and related types/DTOs
    - Swap2Phase enum, TentativeStone, Swap2Action, ColorAssignment classes
    - _Requirements: 2.2, 7.1_

  - [x] 1.3 Implement Swap2ManagerService core logic
    - State machine transitions, stone placement validation, choice processing
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.4 Write property test for initial phase correctness
    - **Property 1: Initial Phase Correctness**
    - **Validates: Requirements 1.1**

  - [x] 1.5 Write property test for state machine transitions
    - **Property 2: State Machine Transition Correctness**
    - **Validates: Requirements 1.2, 1.3, 1.5, 1.6**

  - [x] 1.6 Write property test for stone count invariant
    - **Property 3: Stone Count Invariant**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 2. Implement Stone Placement Logic
  - [x] 2.1 Add placeStone method with position validation
    - Check bounds, check occupied, check phase allows placement
    - _Requirements: 2.1, 2.4_

  - [x] 2.2 Implement tentative stone tracking
    - Track placement order, phase, placer for each stone
    - _Requirements: 2.2, 2.3_

  - [x] 2.3 Implement phase auto-advance after required stones placed
    - 3 stones → swap2_choice, 5 stones → swap2_final_choice
    - _Requirements: 2.5_

  - [x] 2.4 Write property test for occupied cell rejection
    - **Property 4: Occupied Cell Rejection**
    - **Validates: Requirements 2.4**

- [x] 3. Implement Color Choice Logic
  - [x] 3.1 Add makeChoice method with option validation
    - Validate choice is valid for current phase
    - _Requirements: 3.1, 3.5_

  - [x] 3.2 Implement color assignment based on choice
    - Map choice to blackPlayerId/whitePlayerId
    - _Requirements: 3.2, 3.3_

  - [x] 3.3 Implement next mover determination
    - Black player always moves first in main_game
    - _Requirements: 3.6_

  - [x] 3.4 Write property test for color assignment correctness
    - **Property 5: Color Assignment Correctness**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 3.5 Write property test for available options
    - **Property 6: Available Options Correctness**
    - **Validates: Requirements 3.1, 3.5**

  - [x] 3.6 Write property test for next mover determination
    - **Property 7: Next Mover Determination**
    - **Validates: Requirements 3.6**

- [x] 4. Checkpoint - Backend Core Tests
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: Game Mode Configuration

- [x] 5. Extend Room Configuration
  - [x] 5.1 Add swap2_enabled field to room creation
    - Update room creation API to accept swap2_enabled
    - _Requirements: 4.2, 4.4_

  - [x] 5.2 Implement ranked mode enforcement
    - Auto-set swap2_enabled=true for ranked, prevent override
    - _Requirements: 4.1_

  - [x] 5.3 Update room info response to include swap2 status
    - _Requirements: 4.5_

  - [x] 5.4 Write property test for ranked mode enforcement
    - **Property 8: Ranked Mode Enforcement**
    - **Validates: Requirements 4.1**

  - [x] 5.5 Write property test for disabled swap2 behavior
    - **Property 9: Disabled Swap 2 Behavior**
    - **Validates: Requirements 4.3**

## Phase 3: GameEngine Integration

- [x] 6. Integrate Swap2Manager with GameEngine
  - [x] 6.1 Extend GameState with swap2State and gamePhase fields
    - Add to existing game_state JSON structure
    - _Requirements: 1.1, 7.1_

  - [x] 6.2 Modify game initialization to check swap2_enabled
    - Initialize Swap2State if enabled, skip to main_game if not
    - _Requirements: 1.1, 4.3_

  - [x] 6.3 Add Swap 2 action handlers to game flow
    - Route placeStone and makeChoice through Swap2Manager during swap2 phase
    - _Requirements: 1.2, 1.3, 2.1, 3.1_

  - [x] 6.4 Implement transition from Swap 2 to main game
    - Apply final color assignments, set currentTurn, clear swap2 UI state
    - _Requirements: 1.6, 3.6_

- [x] 7. Checkpoint - GameEngine Integration Tests
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: Series Integration

- [x] 8. Integrate with SeriesManager
  - [x] 8.1 Modify series game initialization to use Swap 2
    - Each game in ranked series starts with fresh Swap 2
    - _Requirements: 6.1, 6.3_

  - [x] 8.2 Store Swap 2 history in match record
    - Save actions and final assignment to matches.swap2_history
    - _Requirements: 6.2, 6.4_

  - [x] 8.3 Update prepareNextSeriesGame to reset Swap 2
    - Don't just swap sides, restart full Swap 2 process
    - _Requirements: 6.3_

  - [x] 8.4 Write property test for series Swap 2 reset
    - **Property 10: Series Swap 2 Reset**
    - **Validates: Requirements 6.3**

## Phase 5: State Persistence & Validation

- [x] 9. Implement State Persistence
  - [x] 9.1 Add Swap 2 state serialization/deserialization
    - JSON encode/decode for database storage
    - _Requirements: 7.1, 7.2_

  - [x] 9.2 Implement reconnection state restoration
    - Restore exact phase and tentativeStones on reconnect
    - _Requirements: 7.2_

  - [x] 9.3 Add swap2_history to match completion
    - Store complete Swap 2 sequence when game ends
    - _Requirements: 7.3_

  - [x] 9.4 Write property test for state persistence round-trip
    - **Property 11: State Persistence Round-Trip**
    - **Validates: Requirements 7.1, 7.2**

- [x] 10. Implement Validation & Error Handling
  - [x] 10.1 Add comprehensive action validation
    - Check player, phase, position validity
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 10.2 Implement timeout handling for Swap 2 phases
    - Auto-action on timeout (random place or default choice)
    - _Requirements: 8.4_

  - [x] 10.3 Add error recovery for corrupted state
    - Log and attempt recovery or reset
    - _Requirements: 8.5_

  - [x] 10.4 Write property test for invalid action rejection
    - **Property 12: Invalid Action Rejection**
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [x] 10.5 Write property test for active player correctness
    - **Property 13: Active Player Correctness**
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.5**

  - [x] 10.6 Write property test for history completeness
    - **Property 14: Swap 2 History Completeness**
    - **Validates: Requirements 6.4, 7.3**

- [x] 11. Checkpoint - Backend Complete
  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: Database Migration

- [x] 12. Create Database Migration
  - [x] 12.1 Add swap2_enabled column to rooms table
    - ALTER TABLE rooms ADD COLUMN swap2_enabled boolean DEFAULT false
    - _Requirements: 4.4_

  - [x] 12.2 Add swap2_history column to matches table
    - ALTER TABLE matches ADD COLUMN swap2_history jsonb
    - _Requirements: 7.3_

  - [x] 12.3 Update existing ranked rooms to have swap2_enabled=true
    - Migration script for existing data
    - _Requirements: 4.1_

## Phase 7: Socket Server Integration

- [x] 13. Update Socket Server for Swap 2
  - [x] 13.1 Add Swap 2 event types
    - swap2_stone_placed, swap2_choice_made, swap2_complete
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 13.2 Modify makeMove to handle Swap 2 phases
    - Route to Swap2Manager during swap2 gamePhase
    - _Requirements: 2.1, 2.3_

  - [x] 13.3 Add choice endpoint for color selection
    - New socket event for makeChoice action
    - _Requirements: 3.1, 3.5_

  - [x] 13.4 Emit Swap 2 state updates to room
    - Broadcast phase changes, stone placements, choices
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

## Phase 8: Frontend Implementation

- [x] 14. Create Swap 2 UI Components
  - [x] 14.1 Create Swap2PhaseIndicator component
    - Show current phase, active player, stone count
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 14.2 Create ColorChoiceModal component
    - Display options based on phase (3 or 2 options)
    - _Requirements: 5.3, 5.5_

  - [x] 14.3 Create TentativeStone display component
    - Show stones with visual distinction (not yet colored)
    - _Requirements: 5.2, 5.4_

  - [x] 14.4 Create Swap2CompleteOverlay component
    - Show final color assignments before main game
    - _Requirements: 5.6_

- [x] 15. Integrate Swap 2 UI with Game Board
  - [x] 15.1 Modify GameBoard to handle Swap 2 phases
    - Different click behavior during swap2 vs main_game
    - _Requirements: 2.1, 2.3_

  - [x] 15.2 Add Swap 2 state to game context/hooks
    - useSwap2State hook for component access
    - _Requirements: 5.1_

  - [x] 15.3 Implement choice submission flow
    - Connect ColorChoiceModal to socket events
    - _Requirements: 3.1, 3.5_

  - [x] 15.4 Handle Swap 2 → main game transition in UI
    - Clear swap2 UI, show final assignments, start main game
    - _Requirements: 1.6, 5.6_

- [x] 16. Update Room Creation UI
  - [x] 16.1 Add Swap 2 toggle for non-ranked modes
    - Checkbox/switch in room creation form
    - _Requirements: 4.2_

  - [x] 16.2 Show Swap 2 status in room info
    - Display in room list and room details
    - _Requirements: 4.5_

  - [x] 16.3 Disable toggle for ranked mode (always on)
    - Visual indication that Swap 2 is mandatory
    - _Requirements: 4.1_

## Phase 9: Final Integration & Testing

- [x] 17. End-to-End Integration

  - [x] 17.1 Test full Swap 2 flow (direct choice path)
    - P1 places 3 → P2 chooses black/white → main game
    - _Requirements: 1.1-1.6, 2.1-2.5, 3.1-3.6_


  - [x] 17.2 Test full Swap 2 flow (place_more path)
    - P1 places 3 → P2 place_more → P2 places 2 → P1 chooses → main game
    - _Requirements: 1.4, 1.5, 2.3_

  - [x] 17.3 Test Swap 2 in ranked series
    - Multiple games, each with fresh Swap 2
    - _Requirements: 6.1, 6.3_

  - [x] 17.4 Test reconnection during Swap 2

    - Disconnect/reconnect at various phases
    - _Requirements: 7.2_

- [x] 18. Final Checkpoint




  - Ensure all tests pass, ask the user if questions arise.
