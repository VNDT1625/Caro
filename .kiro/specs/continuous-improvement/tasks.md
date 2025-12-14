# Implementation Plan

- [x] 1. Fix Swap2ManagerService truncated code
  - [x] 1.1 Complete the `attemptStateRecovery` method
    - Add missing recovery cases for stone_count_exceeds_placement_limit
    - Add proper error handling and logging
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Fix Server index.js incomplete Swap2 handlers
  - [x] 2.1 Complete the swap2_make_choice handler
    - Handle 'place_more' choice transition
    - Handle color choice and assignment
    - Emit swap2_complete event
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Fix useSeriesRealtime race condition
  - [x] 3.1 Fix seriesData dependency in presence handlers
    - Use ref to track current seriesData
    - Ensure disconnect state updates correctly
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Fix AI BasicAnalyzer exception handling
  - [x] 4.1 Complete the `_check_missed_win` method
    - Add try-except wrapper
    - Return None on exception
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 5. Add Swap2 API endpoints to PHP backend
  - [x] 5.1 Create Swap2Controller with endpoints
    - POST /api/swap2/initialize
    - POST /api/swap2/place-stone
    - POST /api/swap2/make-choice
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 6. Fix memory cleanup for Swap2 states
  - [x] 6.1 Add cleanup on game end
    - Clear state when game completes
    - Clear state when room is deleted
    - _Requirements: 5.1, 5.2_

- [x] 7. Checkpoint - Phase 1 complete
  - All critical fixes applied

## Phase 2 - Additional Improvements

- [x] 8. Remove debug code from production
  - [x] 8.1 Clean up Shop.tsx debug handlers
  - [x] 8.2 Clean up OnboardingTour.tsx DEBUG constants
  - _Requirements: Code quality_

- [x] 9. Implement pending TODOs
  - [x] 9.1 Implement 5-minute block logic in Home.tsx
  - [x] 9.2 Implement upgrade flow in AiAnalysis.tsx
  - _Requirements: Feature completion_

- [x] 10. Find more bugs and improvements
  - [x] 10.1 Scan for potential issues
  - [x] 10.2 Update tasks with new findings
  - _Requirements: Continuous improvement_

## Phase 3 - Next Iteration

- [x] 11. Add missing Swap2 types to frontend
  - [x] 11.1 Create frontend/src/types/swap2.ts if missing
  - _Requirements: Type safety_

- [x] 12. Add integration tests for Swap2 flow
  - [x] 12.1 Test full Swap2 flow through socket server
  - _Requirements: Test coverage_

- [x] 13. Performance optimization
  - [x] 13.1 Review and optimize heavy components
  - [x] 13.2 Add React.memo where appropriate
  - _Requirements: Performance_

- [x] 14. Continue bug hunting
  - [x] 14.1 Scan for new issues
  - [x] 14.2 Update tasks
  - _Requirements: Continuous improvement_

## Phase 4 - Production Cleanup

- [ ] 15. Remove excessive console.log statements
  - [ ] 15.1 Clean up Shop.tsx debug console.log statements
    - Remove handleCardClickDebug and related debug code
    - Remove fetchDebug state and related logging
    - _Requirements: Code quality_
  - [ ] 15.2 Clean up Home.tsx console.log statements
    - Remove matchmaking debug logs
    - Remove room subscription debug logs
    - Keep only error logging
    - _Requirements: Code quality_
  - [ ] 15.3 Clean up Room.tsx console.log statements
    - Remove move processing debug logs
    - Remove subscription debug logs
    - Keep only error logging
    - _Requirements: Code quality_
  - [ ] 15.4 Clean up HomeChatOverlay.tsx debug logs
    - Remove session data debug logging
    - _Requirements: Code quality_

- [ ] 16. Clean up backend debug logging
  - [ ] 16.1 Remove dataset endpoint debug logs in index.php
    - Remove DATASET ADD DEBUG section
    - Keep only essential error_log calls
    - _Requirements: Code quality_

- [ ] 17. Checkpoint - Phase 4 complete
  - Ensure all tests pass, ask the user if questions arise.

## Phase 5 - Future Improvements (Backlog)

- [ ] 18. Add comprehensive error boundaries
  - [ ] 18.1 Add error boundaries to main pages
    - Wrap Home, Room, Shop pages with error boundaries
    - _Requirements: Error handling_

- [ ] 19. Improve type safety
  - [ ] 19.1 Replace `any` types with proper interfaces
    - Audit frontend code for `any` usage
    - Create proper TypeScript interfaces
    - _Requirements: Type safety_

- [ ] 20. Add monitoring and observability
  - [ ] 20.1 Add structured logging
    - Replace console.log with proper logger
    - Add log levels (debug, info, warn, error)
    - _Requirements: Observability_
0