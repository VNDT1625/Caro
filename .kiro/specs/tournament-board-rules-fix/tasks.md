# Implementation Plan

- [x] 1. Add game type selector to Tournament mode in CreateRoom.tsx


  - Add radio group for game type selection (Normal, Caro Skill, Caro Ẩn, Caro Địa Hình, Caro theo cặp)
  - Place it after the tournament type selector (Solo/Theo cặp)
  - Use same styling as Casual mode game type selector
  - _Requirements: 1.1, 1.2, 1.3_



- [ ] 2. Verify and fix Swap2 toggle in Tournament mode
  - Ensure Swap2 toggle is displayed in Tournament mode settings
  - Add tooltip explaining Swap2 rule


  - Verify default value is true for Tournament mode
  - _Requirements: 2.1, 2.2, 2.3, 2.4_




- [ ] 3. Update match summary to show game type and Swap2 for Tournament mode
  - Add game type display in summary section
  - Ensure Swap2 status shows correctly for Tournament mode
  - _Requirements: 3.1, 3.2_

- [ ] 4. Checkpoint - Verify all changes work correctly
  - Ensure all tests pass, ask the user if questions arise.
