# Implementation Plan

- [x] 1. Implement Socket Server Disconnect Handling




  - [x] 1.1 Add ranked disconnect state tracking in server/index.js

    - Create `rankedDisconnectStates` Map to track active disconnects


    - Store roomId, seriesId, disconnectedPlayerId, remainingPlayerId, timeoutId
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Implement handleRankedDisconnect function
    - Detect disconnect in ranked room
    - Start 10-second countdown timer
    - Emit `opponent_disconnected` event to remaining player
    - Emit `disconnect_countdown` every second

    - _Requirements: 1.1, 1.2, 1.3_
  - [ ]* 1.3 Write property test for disconnect detection timing
    - **Property 1: Disconnect Detection Timing**

    - **Validates: Requirements 1.1, 1.2**
  - [x] 1.4 Implement handleRankedReconnect function
    - Cancel countdown timer if player reconnects within 10s
    - Clear disconnect state



    - Emit `opponent_reconnected` event
    - _Requirements: 4.2_
  - [ ]* 1.5 Write property test for reconnection cancels forfeit
    - **Property 7: Reconnection Cancels Forfeit**
    - **Validates: Requirements 4.2**

- [x] 2. Implement Auto-Win Processing

  - [x] 2.1 Implement processRankedAutoWin function in server/index.js

    - Call backend API to process forfeit
    - Emit `ranked_auto_win` to winner with +20 MP
    - Emit `ranked_forfeit_loss` to loser with -20 MP (if reconnects)
    - Update room state and cleanup
    - _Requirements: 1.3, 1.4, 1.5_
  - [x]* 2.2 Write property test for auto-win timeout trigger





    - **Property 2: Auto-Win Timeout Trigger**
    - **Validates: Requirements 1.3**
  - [x] 2.3 Add retry logic for backend API calls
    - Retry up to 3 times with exponential backoff
    - Log error if all retries fail
    - _Requirements: 4.4, 4.5_
  - [x]* 2.4 Write property test for retry on backend failure

    - **Property 8: Retry on Backend Failure**
    - **Validates: Requirements 4.4**


- [x] 3. Implement Backend Forfeit Processing
  - [x] 3.1 Add processForfeitDisconnect method to DisconnectHandlerService.php

    - Award winner exactly +20 MP
    - Deduct loser exactly -20 MP

    - Update series score (increment winner's wins)
    - Check if series is complete (2 wins)
    - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3_
  - [ ]* 3.2 Write property test for fixed MP award/penalty
    - **Property 3: Fixed MP Award/Penalty**
    - **Validates: Requirements 1.4, 1.5**

  - [x] 3.3 Add API endpoint POST /api/series/{id}/forfeit-disconnect
    - Validate series exists and is in_progress

    - Call processForfeitDisconnect
    - Return forfeit result with MP changes
    - _Requirements: 2.1, 2.2_



  - [ ]* 3.4 Write property test for forfeit game state update
    - **Property 4: Forfeit Game State Update**
    - **Validates: Requirements 2.1, 2.2**
  - [x] 3.5 Implement series completion on forfeit

    - Check if winner has 2 wins after forfeit
    - Mark series as complete
    - Update both players' profiles

    - Emit series_complete event
    - _Requirements: 2.3, 2.4, 2.5_
  - [x]* 3.6 Write property test for series completion on forfeit




    - **Property 5: Series Completion on Forfeit**
    - **Validates: Requirements 2.3, 2.4, 2.5**



- [x] 4. Checkpoint - Ensure backend tests pass


  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Handle Edge Cases

  - [x] 5.1 Implement simultaneous disconnect handling

    - Detect if both players disconnect within 5 seconds
    - Declare draw with no MP changes


    - Clean up room state
    - _Requirements: 4.1_
  - [ ]* 5.2 Write property test for simultaneous disconnect draw
    - **Property 6: Simultaneous Disconnect Draw**
    - **Validates: Requirements 4.1**
  - [x] 5.3 Handle disconnect during Swap2 phase


    - Apply same forfeit rules during Swap2
    - Clean up Swap2 state on forfeit
    - _Requirements: 1.3_


- [x] 6. Implement Frontend UI Components
  - [x] 6.1 Create DisconnectOverlay component

    - Display "Đối thủ đã thoát" message
    - Show 10-second countdown timer
    - Show auto-win result with "+20 MP"
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 6.2 Update Room.tsx to handle disconnect events


    - Listen for `opponent_disconnected` event
    - Show DisconnectOverlay component
    - Handle `ranked_auto_win` event
    - Display victory screen with series score
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 6.3 Update useSeriesRealtime hook

    - Add handlers for new disconnect events
    - Track disconnect countdown state
    - Handle reconnection events
    - _Requirements: 3.1, 3.2_


- [x] 7. Final Checkpoint - Ensure all tests pass


  - Ensure all tests pass, ask the user if questions arise.
