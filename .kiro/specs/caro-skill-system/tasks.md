# Implementation Plan

## Phase 1: Core Mana System

- [x] 1. Implement ManaService
  - [x] 1.1 Create ManaService class with init, add, deduct, canAfford methods
    - Initialize mana to 5
    - Add 3 mana per turn with cap at 15
    - Deduct mana cost on skill use
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x]* 1.2 Write property test for mana initialization
    - **Property 1: Mana Initialization**
    - **Validates: Requirements 1.1**
  - [x]* 1.3 Write property test for mana regeneration and cap
    - **Property 2: Mana Regeneration**
    - **Property 3: Mana Cap Invariant**
    - **Validates: Requirements 1.2, 1.3**
  - [x]* 1.4 Write property test for mana deduction
    - **Property 4: Mana Deduction**
    - **Property 5: Insufficient Mana Rejection**
    - **Validates: Requirements 1.4, 1.5**

- [ ] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: Deck Building System

- [ ] 3. Implement DeckService
  - [ ] 3.1 Create database migrations for user_decks table
    - user_id, preset_slot (1-3), skill_ids (array of 20), is_active
    - _Requirements: 2.2, 2.4_
  - [ ] 3.2 Create DeckService class with save, load, validate methods
    - Validate exactly 20 skills
    - Support 3 preset slots
    - _Requirements: 2.2, 2.3, 2.4_
  - [ ]* 3.3 Write property test for deck size constraint
    - **Property 6: Deck Size Constraint**
    - **Validates: Requirements 2.2**
  - [ ]* 3.4 Write property test for deck persistence round-trip
    - **Property 7: Deck Persistence Round-Trip**
    - **Validates: Requirements 2.3**

- [ ] 4. Implement SkillComboBuilder frontend component
  - [ ] 4.1 Create SkillComboBuilder.tsx with 70 skill pool display
    - Filter by category, rarity, element
    - Click to select/deselect skills
    - _Requirements: 2.1, 2.5_
  - [ ] 4.2 Add deck validation UI
    - Show count (X/20)
    - Highlight when invalid
    - _Requirements: 2.2_
  - [ ] 4.3 Add preset management (3 slots)
    - Save, load, rename presets
    - _Requirements: 2.4_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: In-Game Skill Random

- [ ] 6. Implement SkillRandomizer
  - [ ] 6.1 Create seeded random algorithm for skill selection
    - Select 3 skills from 20-skill deck
    - Exclude skills on cooldown
    - Apply rarity weights (60% common, 30% rare, 10% ultra rare)
    - _Requirements: 3.1, 12.1, 12.2, 12.3_
  - [ ]* 6.2 Write property test for turn skill selection
    - **Property 8: Turn Skill Selection**
    - **Validates: Requirements 3.1**

- [ ] 7. Implement InGameSkillPanel frontend component
  - [ ] 7.1 Create InGameSkillPanel.tsx with 3 skill cards
    - Display skill name, mana cost, description
    - Highlight selected skill
    - _Requirements: 3.2_
  - [ ] 7.2 Add Use/Skip buttons
    - Use button executes skill
    - Skip button proceeds without skill
    - _Requirements: 3.3, 3.4_
  - [ ]* 7.3 Write property test for skip preserves mana
    - **Property 9: Skip Preserves Mana**
    - **Validates: Requirements 3.4**

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: Turn Flow Integration

- [ ] 9. Implement flexible turn order
  - [ ] 9.1 Modify turn state machine to allow skill-then-move or move-then-skill
    - Track which actions completed
    - End turn when both done
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ]* 9.2 Write property test for turn order flexibility
    - **Property 10: Turn Order Flexibility**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 10. Add Socket.IO events for skills
  - [ ] 10.1 Add skill_options event (server → client)
    - Send 3 random skills at turn start
    - _Requirements: 3.1_
  - [ ] 10.2 Add skill_use event (client → server)
    - Execute skill and broadcast result
    - _Requirements: 3.3_
  - [ ] 10.3 Add skill_skip event (client → server)
    - Proceed to move phase
    - _Requirements: 3.4_
  - [ ] 10.4 Add mana_update event (server → client)
    - Sync mana state after skill use
    - _Requirements: 1.4_

- [ ] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: Attack Skills Implementation

- [ ] 12. Implement attack skill effects
  - [ ] 12.1 Implement Sấm Sét (destroy 1 opponent stone)
    - Validate target is opponent stone
    - Remove stone, make cell empty
    - _Requirements: 5.1_
  - [ ]* 12.2 Write property test for Sấm Sét
    - **Property 11: Sấm Sét Effect**
    - **Validates: Requirements 5.1**
  - [ ] 12.3 Implement Nguyên Tố Lửa (burn 3x3 area for 3 turns)
    - Mark area as burning
    - Prevent stone placement
    - _Requirements: 5.2_
  - [ ] 12.4 Implement Thủy Chấn (push stones in direction)
    - Push target and all stones behind
    - _Requirements: 5.3_
  - [ ] 12.5 Implement Địa Chấn (permanent block)
    - Mark cell as permanently blocked
    - _Requirements: 5.4_
  - [ ] 12.6 Implement Lốc Xoáy (destroy up to 3 in 3x3)
    - Random selection within area
    - _Requirements: 5.5_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: Defense Skills Implementation

- [ ] 14. Implement defense skill effects
  - [ ] 14.1 Implement Bảo Hộ (permanent protection)
    - Mark cell as protected
    - Resist all effects
    - _Requirements: 6.1_
  - [ ]* 14.2 Write property test for Bảo Hộ
    - **Property 12: Bảo Hộ Permanence**
    - **Validates: Requirements 6.1**
  - [ ] 14.3 Implement Nguyên Vệ (3x3 immunity for 3 turns)
    - Mark area as immune
    - Track duration
    - _Requirements: 6.2_
  - [ ] 14.4 Implement Hồi Nguyên (restore destroyed stone)
    - Track destroyed stones (last 3 turns)
    - Restore to original position
    - _Requirements: 6.3_
  - [ ] 14.5 Implement Nguyên Tĩnh (block opponent skills for 3 turns)
    - Apply debuff to opponent
    - _Requirements: 6.4_
  - [ ] 14.6 Implement Nguyên Thần (protect all stones for 5 turns, 2 uses max)
    - Track usage count per player
    - Apply protection to all player stones
    - _Requirements: 6.5_
  - [ ]* 14.7 Write property test for Nguyên Thần usage limit
    - **Property 13: Nguyên Thần Usage Limit**
    - **Validates: Requirements 6.5**

- [ ] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 7: Ngũ Hành (Five Elements) System

- [ ] 16. Implement ElementService
  - [ ] 16.1 Create element counter relationships
    - Hỏa khắc Kim, Kim khắc Mộc, Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [ ] 16.2 Implement Thần skills (Hỏa Thần, Thủy Thần, Mộc Thần, Thổ Thần, Kim Thần)
    - Neutralize effects of countered element in 3x3 area
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [ ]* 16.3 Write property test for element counter
    - **Property 14: Element Counter - Fire vs Water**
    - **Validates: Requirements 8.1**

- [ ] 17. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 8: Buff/Debuff System

- [ ] 18. Implement BuffDebuffService
  - [ ] 18.1 Create buff application and tracking
    - Apply buff with duration
    - Track active buffs
    - _Requirements: 9.1, 9.2, 9.4_
  - [ ] 18.2 Implement Tăng Cường (extend all buffs by 1 turn)
    - _Requirements: 9.3_
  - [ ]* 18.3 Write property test for buff extension
    - **Property 15: Buff Extension**
    - **Validates: Requirements 9.3**
  - [ ] 18.4 Implement buff expiration
    - Remove buff when duration reaches 0
    - _Requirements: 9.5_
  - [ ]* 18.5 Write property test for buff expiration
    - **Property 16: Buff Expiration**
    - **Validates: Requirements 9.5**

- [ ] 19. Implement debuff skills
  - [ ] 19.1 Implement Băng Nguyên (freeze stone for 5 turns)
    - _Requirements: 10.1_
  - [ ] 19.2 Implement Cố Định Quân (lock movement for 4 turns)
    - _Requirements: 10.2_
  - [ ]* 19.3 Write property test for Cố Định movement lock
    - **Property 17: Cố Định Movement Lock**
    - **Validates: Requirements 10.2**
  - [ ] 19.4 Implement Thanh Tẩy (remove debuff)
    - _Requirements: 10.5_
  - [ ] 19.5 Implement Giải Phóng (remove Cố Định)
    - _Requirements: 11.4_
  - [ ]* 19.6 Write property test for Giải Phóng counter
    - **Property 18: Giải Phóng Counter**
    - **Validates: Requirements 11.4**

- [ ] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 9: Win Condition with Skills

- [ ] 21. Update win condition logic
  - [ ] 21.1 Modify checkWinner to handle skill effects
    - Exclude frozen stones from win check
    - Include ghost stones in win check
    - _Requirements: 13.1, 13.3, 13.4_
  - [ ]* 21.2 Write property test for win condition
    - **Property 19: Win Condition**
    - **Validates: Requirements 13.1**
  - [ ] 21.3 Implement Nguyên Hóa delayed win
    - Mark converted stones
    - Delay win check by 1 turn
    - _Requirements: 13.2_
  - [ ]* 21.4 Write property test for Nguyên Hóa delayed win
    - **Property 20: Nguyên Hóa Delayed Win**
    - **Validates: Requirements 13.2**

- [ ] 22. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 10: Effect Duration and Tracking

- [ ] 23. Implement EffectTracker
  - [ ] 23.1 Create effect duration management
    - Track all active effects with durations
    - Decrement durations on turn end
    - _Requirements: 14.1, 14.2_
  - [ ]* 23.2 Write property test for duration decrement
    - **Property 21: Duration Decrement**
    - **Validates: Requirements 14.2**
  - [ ] 23.3 Implement effect expiration
    - Remove effects when duration reaches 0
    - _Requirements: 14.3_

- [ ] 24. Add effect visualization
  - [ ] 24.1 Display duration overlay on affected cells
    - Show remaining turns
    - _Requirements: 14.1_
  - [ ] 24.2 Display effect details on hover
    - Show effect type and parameters
    - _Requirements: 14.5_

- [ ] 25. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 11: Serialization and Persistence

- [ ] 26. Implement state serialization
  - [ ] 26.1 Create serialization for game state with skills
    - Include active effects, mana, cooldowns
    - _Requirements: 15.1_
  - [ ] 26.2 Create deserialization for game state
    - Restore all skill effects correctly
    - _Requirements: 15.2_
  - [ ]* 26.3 Write property test for serialization round-trip
    - **Property 22: State Serialization Round-Trip**
    - **Validates: Requirements 15.5**

- [ ] 27. Implement match skill logging
  - [ ] 27.1 Log skill usage to match_skill_logs table
    - Record turn, offered skills, selected skill, effect result
    - _Requirements: 15.3_
  - [ ] 27.2 Implement replay with skill effects
    - Reproduce all skill effects accurately
    - _Requirements: 15.4_

- [ ] 28. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 12: Remaining 70 Skills Implementation

- [ ] 29. Implement remaining attack skills (19 more)
  - Phong Cước, Lưỡi Dao Gió, Hỏa Hồn, Bẫy Nguyên Khí, Sấm Nổ, etc.
  - _Requirements: 5.1-5.5_

- [ ] 30. Implement remaining defense skills (22 more)
  - Thiên Mệnh, Kim Cương, Tường Nguyên, Lá Chắn, etc.
  - _Requirements: 6.1-6.5_

- [ ] 31. Implement tactical skills (18 total)
  - Thời Không, Nguyên Quyết, Phản Nguyên, Khai Nguyên, etc.
  - _Requirements: 7.1-7.5_

- [ ] 32. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
