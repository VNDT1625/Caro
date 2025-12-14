# Implementation Plan

## Phase 1: Backend Extensions

- [x] 1. Extend ReplayEngine with difficulty support
  - [x] 1.1 Add difficulty parameter to _generate_ai_move method
    - Modify method signature to accept difficulty: str = 'hard'
    - Implement easy mode: select randomly from top 5 moves
    - Implement medium mode: select randomly from top 3 moves
    - Implement hard mode: always select best move
    - _Requirements: 7.2, 7.3, 7.4_
  - [x]* 1.2 Write property test for AI difficulty behavior
    - **Property 13: Difficulty affects AI behavior**
    - **Validates: Requirements 7.2, 7.3, 7.4**
  - [x] 1.3 Add difficulty to play_from_here API endpoint
    - Update PlayReplayRequest model to include difficulty field
    - Pass difficulty to ReplayEngine
    - _Requirements: 7.2_

- [x] 2. Add undo functionality to ReplayEngine
  - [x] 2.1 Implement undo_move method in ReplayEngine
    - Remove last move pair (user + AI) from session
    - Update board state and move index
    - Recalculate win probability
    - _Requirements: 6.1, 6.2_
  - [x]* 2.2 Write property test for undo consistency
    - **Property 12: Undo consistency**
    - **Validates: Requirements 6.1, 6.2, 6.3**
  - [x] 2.3 Add POST /replay/undo endpoint
    - Accept session_id
    - Return updated board state and win probability
    - _Requirements: 6.1_

- [x] 3. Checkpoint - Ensure backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: Frontend API Layer

- [x] 4. Create replayApi.ts
  - [x] 4.1 Implement createReplaySession function
    - POST to /replay/create
    - Handle errors and return session_id
    - _Requirements: 5.1_
  - [x] 4.2 Implement navigateToMove function
    - POST to /replay/navigate
    - Return board state and player turn
    - _Requirements: 4.2, 4.3_
  - [x] 4.3 Implement playFromHere function
    - POST to /replay/play with difficulty parameter
    - Return AI move and comparison data
    - _Requirements: 2.1, 2.3_
  - [x] 4.4 Implement analyzeDivergence function
    - POST to /replay/analyze
    - Return divergence analysis
    - _Requirements: 3.3_
  - [x] 4.5 Implement undoMove function
    - POST to /replay/undo
    - Return updated state
    - _Requirements: 6.1_
  - [x] 4.6 Implement cleanupSession function
    - DELETE to /replay/{session_id}
    - _Requirements: 5.3_

## Phase 3: Frontend Hook

- [x] 5. Create useReplayAI hook
  - [x] 5.1 Implement state management
    - mode, sessionId, divergencePoint, alternativeMoves
    - originalWinProb, currentWinProb, aiThinking, difficulty
    - _Requirements: 1.1, 1.2_
  - [x] 5.2 Implement enterWhatIfMode action
    - Create session via API
    - Set mode to 'what_if'
    - _Requirements: 1.1_
  - [x] 5.3 Implement exitWhatIfMode action
    - Navigate back to divergence point
    - Set mode to 'replay'
    - _Requirements: 1.4_
  - [x] 5.4 Implement playMove action
    - Call playFromHere API
    - Update state with AI response
    - Set divergence point on first move
    - _Requirements: 2.1, 2.4_
  - [x] 5.5 Implement undoMove action
    - Call undo API
    - Update state
    - _Requirements: 6.1_
  - [x] 5.6 Implement switchBranch action
    - Navigate to show original or alternative moves
    - _Requirements: 4.2, 4.3_
  - [ ]* 5.7 Write property test for mode transitions
    - **Property 1: Mode transition consistency**
    - **Validates: Requirements 1.1, 1.4**

## Phase 4: Frontend Components

- [x] 6. Create ReplayAIPanel component
  - [x] 6.1 Implement mode toggle UI
    - "Thử đi nước khác" button for entering what-if mode
    - "Quay lại xem" button for exiting
    - Mode indicator showing current mode
    - _Requirements: 1.1, 1.2, 1.4_
  - [x] 6.2 Implement difficulty selector
    - Dropdown with Dễ, Trung bình, Khó options
    - _Requirements: 7.1_
  - [x] 6.3 Implement undo button
    - Disabled when at divergence point
    - _Requirements: 6.1, 6.4_

- [ ] 7. Create WhatIfBoard component
  - [x] 7.1 Extend InteractiveBoard with click handling
    - Enable cell click in what-if mode
    - Disable in replay mode
    - _Requirements: 1.1_
  - [ ] 7.2 Implement valid cell highlighting
    - Highlight empty cells when in what-if mode
    - _Requirements: 1.3_
  - [ ]* 7.3 Write property test for valid cell highlighting
    - **Property 2: Valid cell highlighting**
    - **Validates: Requirements 1.3**
  - [x] 7.4 Implement AI thinking indicator
    - Show loading state while waiting for AI
    - _Requirements: 2.1_

- [ ] 8. Create BranchIndicator component
  - [ ] 8.1 Implement branch visualization
    - Show original and alternative lines
    - Highlight current branch
    - _Requirements: 4.1_
  - [x] 8.2 Implement branch switching
    - Click to switch between branches
    - _Requirements: 4.2, 4.3_
  - [ ]* 8.3 Write property test for branch switching
    - **Property 8: Branch switching correctness**
    - **Validates: Requirements 4.2, 4.3**

- [x] 9. Create ComparisonPanel component
  - [x] 9.1 Implement win probability display
    - Show original vs current win probability
    - _Requirements: 3.1_
  - [x] 9.2 Implement color coding
    - Green for improvement, red for worse, yellow for similar
    - _Requirements: 3.4_
  - [ ]* 9.3 Write property test for color coding
    - **Property 7: Color coding consistency**
    - **Validates: Requirements 3.4**
  - [x] 9.4 Implement explanation display
    - Show Vietnamese explanation for significant changes
    - _Requirements: 3.2_
  - [ ]* 9.5 Write property test for explanation generation
    - **Property 6: Comparison explanation generation**
    - **Validates: Requirements 3.2**

- [ ] 10. Checkpoint - Ensure frontend component tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: Integration

- [x] 11. Integrate components into AiAnalysis page
  - [x] 11.1 Add ReplayAIPanel to right column
    - Show below analysis panel
    - Only visible when match is selected
    - _Requirements: 1.1_
  - [x] 11.2 Replace InteractiveBoard with WhatIfBoard
    - Pass what-if mode state
    - Connect click handler
    - _Requirements: 1.1, 1.3_
  - [ ] 11.3 Add BranchIndicator below board
    - Show when divergence exists
    - _Requirements: 4.1_
  - [x] 11.4 Add ComparisonPanel to right column
    - Show when in what-if mode
    - _Requirements: 3.1_
  - [x] 11.5 Connect useReplayAI hook to components
    - Wire up all actions and state
    - _Requirements: all_

- [ ] 12. Add session persistence
  - [x] 12.1 Store session_id in localStorage
    - Key: replay_session_{match_id}
    - _Requirements: 5.2_
  - [x] 12.2 Implement session restore on page load
    - Check for existing session
    - Offer to restore or start fresh
    - _Requirements: 5.2_
  - [x] 12.3 Implement cleanup on unmount
    - Clean up session when leaving page
    - _Requirements: 5.3_
  - [ ]* 12.4 Write property test for session lifecycle
    - **Property 9: Session uniqueness**
    - **Property 10: Session persistence**
    - **Property 11: Session cleanup**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [ ] 13. Add i18n translations
  - [ ] 13.1 Add Vietnamese translations
    - replay.whatIfMode, replay.exitWhatIf, replay.undo
    - replay.difficulty.easy, replay.difficulty.medium, replay.difficulty.hard
    - replay.comparison.better, replay.comparison.worse, replay.comparison.similar
    - _Requirements: all UI text_

- [ ] 14. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
