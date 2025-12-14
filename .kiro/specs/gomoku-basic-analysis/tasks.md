# Implementation Plan

## Phase 0: Foundation - Board State and Validation

- [x] 0. Implement Board State Validation
  - [x] 0.1 Create board validation utilities
    - Validate board is 15x15 grid
    - Validate cell values (empty, X, O only)
    - Detect overlapping stones (invalid state)
    - _Requirements: 12.1, 12.2, 12.5_
  - [x] 0.2 Write property tests for board validation
    - Property 25: Board State Validation
    - Validates: Requirements 12.1, 12.2, 12.5
  - [x] 0.3 Implement edge case handling
    - Handle games with < 5 moves (return message)
    - Handle patterns at board edges
    - Handle overlapping patterns
    - _Requirements: 13.1, 13.2, 13.3_
  - [x] 0.4 Write property tests for edge cases
    - Property 26: Edge Case - Insufficient Moves
    - Property 27: Edge Case - Board Edge Patterns
    - Validates: Requirements 13.1, 13.2
  - [x] 0.5 Implement pattern priority system
    - Define priority order: FIVE > OPEN_FOUR > FORK > CLOSED_FOUR > OPEN_THREE
    - Implement priority-based threat recommendation
    - _Requirements: 15.1, 15.2, 15.3_
  - [x] 0.6 Write property tests for pattern priority
    - Property 30: Pattern Priority Ordering
    - Validates: Requirements 15.1, 15.2

- [x] 0.7 Checkpoint - Foundation tests pass
  - Board validation, edge cases, and pattern priority all implemented and tested



## Phase 1: Core AI Module Improvements

- [x] 1. Enhance Pattern Detection and Coordinate System
  - [x] 1.1 Review existing `ai/analysis/threat_detector.py`
    - FIVE, OPEN_FOUR, CLOSED_FOUR, OPEN_THREE detection verified
    - Broken patterns (BROKEN_FOUR, BROKEN_THREE, JUMP_THREE) implemented
    - Double threat detection implemented
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.2 Property tests for pattern detection exist
    - `ai/tests/test_threat_detector_property.py` - comprehensive tests
    - `ai/tests/test_broken_patterns_props.py` - broken pattern tests
    - `ai/tests/test_double_threat_props.py` - double threat tests
    - Validates: Requirements 1.1, 1.2, 1.3, 1.4
  - [x] 1.3 Implement coordinate notation utilities
    - Created `ai/analysis/coordinate_utils.py`
    - `notation_to_index()` and `index_to_notation()` functions
    - Support case-insensitive input
    - Validation for invalid notations
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 1.4 Write property tests for coordinate conversion
    - Created `ai/tests/test_coordinate_utils_props.py`
    - Property 16: Coordinate Notation Format
    - Property 17: Coordinate Conversion Round-Trip
    - Property 18: Case-Insensitive Notation Input
    - Property 19: Invalid Notation Rejection
    - Validates: Requirements 8.1, 8.2, 8.3, 8.4

- [x] 2. Checkpoint - Phase 1 tests pass
  - Ensure all tests pass, ask the user if questions arise.



## Phase 2: Role-Based Evaluation and Move Scoring

- [x] 3. Implement RoleEvaluator Module
  - [x] 3.1 Create RoleEvaluator class in `ai/analysis/role_evaluator.py`
    - Implemented `determine_role()` based on board evaluation thresholds
    - Implemented `score_move_by_role()` with attacker/defender criteria
    - Added bonus scoring for defensive moves with counter-attack
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [x] 3.2 Write property tests for role evaluation
    - Created `ai/tests/test_role_evaluator_props.py`
    - Property 7: Role Assignment Consistency
    - Property 8: Attacker Move Scoring
    - Property 9: Defender Move Scoring
    - Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
  - [x] 3.3 Integrate RoleEvaluator into BasicAnalyzer
    - Updated `ai/analysis/basic_analyzer.py` to use RoleEvaluator
    - Added role field to timeline entries
    - Adjusted move scoring based on role
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Implement Move Scoring System (0-10 scale)
  - [x] 4.1 Create MoveScorer class in `ai/analysis/move_scorer.py`
    - Implemented 0-10 scale scoring
    - Consider threats_created, threats_blocked, board_evaluation_change
    - Add classification thresholds (excellent, good, average, poor, blunder)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - [x] 4.2 Write property tests for move scoring
    - Created `ai/tests/test_move_scorer_props.py`
    - Property 5: Move Score Range Invariant
    - Property 6: Move Classification Consistency
    - Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.



## Phase 3: Multi-Language Comment System

- [x] 6. Implement CommentGenerator Module
  - [x] 6.1 Create CommentGenerator class in `ai/analysis/comment_generator.py`
    - Define comment templates for all 4 languages (vi, en, zh, ja)
    - Implement `generate_comment()` for single language
    - Implement `generate_all_languages()` for all 4 languages
    - Add threat type labels in all languages
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 6.2 Write property tests for comment generation
    - Created `ai/tests/test_comment_generator_props.py`
    - Property 10: Multi-Language Comment Availability
    - Validates: Requirements 4.1
  - [x] 6.3 Integrate CommentGenerator into BasicAnalyzer
    - Updated `analyze_game()` to accept language parameter
    - Generate comments for each move in timeline
    - Store comments in all 4 languages in analysis result
    - _Requirements: 4.1_

- [x] 7. Implemnt Alternative Move Suggestions






  - [x] 7.1 Enhance BasicAnalyzer alternative move logic

    - Ensure 2-3 alternatives are always suggested
    - Add reason field for each alternative
    - Mark best alternative when actual move is blunder
    - Detect when alternatives have similar scores
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 7.2 Write property tests for alternative suggestions

    - Property 11: Alternative Move Count
    - Property 12: Alternative Move Reason
    - Validates: Requirements 5.1, 5.2

- [x] 8. Checkpoint Ensure all tests pass



  - Ensure all tests pass, ask the user if questions arise.



## Phase 4: Timeline and Analysis Enhancements

- [-] 9. Enhance Board Evaluation Timelin


  - [x] 9.1 Update timeline generation in BasicAnalyzer


    - Calculate board_evaluation before and after each move
    - Add is_significant flag (change > 20)
    - Add is_critical flag (change > 50)
    - _Requirements: 6.1, 6.2, 6.4_
  - [ ] 9.2 Write property tests for timeline



    - Property 13: Timeline Evaluation Completeness
    - Property 14: Significant Moment Detection
    - Property 15: Critical Turning Point Detection
    - Validates: Requirements 6.1, 6.2, 6.4

- [ ] 10. Implement Tactical Pattern Detection
  - [ ] 10.1 Add tactical pattern detection to BasicAnalyzer

    - Detect "trap" patterns (weak move that sets up fork)
    - Detect "setup" patterns (preparation for future threats)
    - Detect "trading" patterns (ignoring threat to create bigger threat)
    - Use Vietnamese pattern names (Tứ Hướng, Song Song, Chặn Muộn, Bỏ Lỡ Thắng)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 11. Checkpoint - Ensure all tests pas

  - Ensure all tests pass, ask the user if questions arise.



## Phase 5: Performance and Serialization

- [x] 12. Optimize Analysis Performance

  - [x] 12.1 Profile and optimize BasicAnalyzer
    - Created `ai/analysis/basic_analysis_optimized.py` with OptimizedBasicAnalyzer
    - Full game analysis < 2000ms (achieved ~250ms for 50 moves)
    - Single move analysis < 100ms (achieved ~10ms)
    - Comment generation < 50ms per move (achieved ~1ms)
    - Implemented threat caching, position bonus caching, reduced search depth
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 12.2 Write property tests for performance
    - Created `ai/tests/test_performance_props.py`
    - Property 20: Full Game Analysis Performance
    - Property 21: Single Move Analysis Performance
    - Property 22: Comment Generation Performance
    - Property 23: Caching Effectiveness
    - All 13 tests PASSED
    - Validates: Requirements 9.1, 9.2, 9.3, 9.4

- [ ] 13. Implement JSON Serializatio

  - [ ] 13.1 Add serialization methods to analysis types
    - Implement `to_dict()` and `from_dict()` for all dataclasses
    - Ensure all fields are included in serialization
    - Handle enum serialization properly
    - _Requirements: 11.1, 11.2, 11.3_
  - [ ] 13.2 Write property tests for serialization
    - Property 22: JSON Serialization Validity
    - Property 23: JSON Round-Trip Consistency
    - Property 24: Serialization Completeness
    - Validates: Requirements 11.1, 11.2, 11.3

- [ ] 14. Checkpoint - Ensure all tests pas

  - Ensure all tests pass, ask the user if questions arise.



## Phase 6: Frontend UI/UX Improvements

- [x] 15. Frontend Analysis Components (Already Exist)
  - [x] 15.1 ScoreTimeline component exists
  - [x] 15.2 MoveNavigation component exists
  - [x] 15.3 InteractiveBoard component exists
  - [x] 15.4 MatchListSidebar component exists
  - [x] 15.5 ControlsBar component exists
  - [x] 15.6 AiAnalysis page exists

- [x] 16. Update Frontend i18n for Analysis
  - [x] 16.1 Add analysis translations to i18n.json
    - Add Vietnamese (vi) analysis strings
    - Add English (en) analysis strings
    - Add Chinese (zh) analysis strings
    - Add Japanese (ja) analysis strings
    - Include move ratings, pattern names, tactical terms
    - _Requirements: 4.1, 10.1_

- [x] 17. Enhance Analysis UI Components
  - [x] 17.1 Update MoveNavigation component
    - Show move score (0-10) with rating badge
    - Color-code moves by rating (green=excellent, red=blunder)
    - Show role indicator (attacker/defender)
    - _Requirements: 10.1, 10.2, 17.1, 17.2, 17.3, 17.4_
  - [x] 17.2 Update InteractiveBoard component
    - Highlight pattern cells when pattern is selected
    - Show alternative move preview on click
    - Add visual indicator for significant/critical moves
    - _Requirements: 10.3, 10.4, 17.5, 17.6_
  - [x] 17.3 Update ScoreTimeline component
    - Add tooltip with move details on hover
    - Mark significant moments visually (change > 20)
    - Mark critical turning points prominently (change > 50)
    - _Requirements: 10.5, 6.3, 18.1, 18.4, 18.5, 18.6_

- [x] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.



## Phase 7: UI Integration - Entry Points

- [x] 19. Add Analysis Entry Point in Room Page
  - [x] 19.1 Update Room.tsx with post-game analysis button
    - Add "Analyze This Game" button after game ends
    - Button navigates to /analysis?matchId={matchId}
    - Style button prominently (primary variant)
    - _Requirements: 16.1, 20.1_
  - [x] 19.2 Store match data for analysis
    - Save match moves to state/context when game ends
    - Pass match data to analysis page via URL params or state
    - _Requirements: 16.3_

- [x] 20. Add Analysis Entry Point in Profile Page
  - [x] 20.1 Update Profile.tsx match history section
    - Add "Analyze" button for each completed match
    - Button navigates to /analysis?matchId={matchId}
    - Show analysis status if already analyzed (cached)
    - _Requirements: 16.2, 20.2_

- [x] 21. Add Analysis Navigation Menu Item
  - [x] 21.1 Update App.tsx navigation
    - Add "AI Analysis" menu item in main navigation
    - Link to /analysis page
    - Show icon for analysis feature
    - _Requirements: 20.3_
  - [x] 21.2 Update i18n.json with navigation strings
    - Add nav.aiAnalysis translations for all 4 languages
    - _Requirements: 20.3_

- [x] 22. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.



## Phase 8: UI Integration - Analysis Page Enhancements

- [x] 23. Enhance AiAnalysis Page
  - [x] 23.1 Add loading state with progress indicator
    - Show loading spinner while analysis is in progress
    - Display progress percentage if available
    - _Requirements: 16.4_
  - [x] 23.2 Add error handling with retry option
    - Show error message when analysis fails
    - Provide "Retry" button to re-attempt analysis
    - Show specific error message based on error code
    - _Requirements: 16.5_
  - [x] 23.3 Add language selector for comments
    - Add dropdown to select comment language (vi, en, zh, ja)
    - Update comments immediately on language change (no re-analysis)
    - Persist language preference
    - _Requirements: 19.1, 19.2, 19.3_

- [x] 24. Implement Match Selection Flow
  - [x] 24.1 Update MatchListSidebar for better UX
    - Show match list with date, opponent, result
    - Highlight currently selected match
    - Show "Analyzed" badge for cached analyses
    - _Requirements: 16.2_
  - [x] 24.2 Handle URL parameters for direct match access
    - Parse matchId from URL query params
    - Auto-load and analyze match if matchId provided
    - _Requirements: 16.3, 20.4_

- [x] 25. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.



## Phase 9: API and Backend Integration

- [x] 26. Update API Endpoints
  - [x] 26.1 Update FastAPI endpoints in main.py
    - Add language parameter to /analyze endpoint
    - Return multi-language comments in response
    - Include role information in timeline
    - Add error codes to error responses
    - _Requirements: 4.1, 3.1_
  - [x] 26.2 Update PHP AIBridgeService
    - Pass language parameter to AI service
    - Handle multi-language response
    - Handle error codes properly
    - _Requirements: 4.1_
  - [x] 26.3 Add edge case handling to API
    - Return appropriate error for insufficient moves
    - Handle board validation errors
    - Return partial results on timeout
    - _Requirements: 13.1, 12.5_

- [x] 27. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.



## Phase 10: Critical Improvements - Game Context & Opening (GAP 9-10)

- [x] 28. Implemet Game Metadata Handle (GAP 9)







  - [x] 28.1 Create GameMetadata dataclass and handler

    - Create `ai/analysis/game_metadata.py`
    - Implement GameMetadata dataclass with game_type, rule_variant, time_control, player_elo
    - Implement strictness multiplier (tournament=1.2x, casual=0.8x)
    - Implement comment complexity based on ELO
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 28.2 Write property tests for game metadata

    - Property 39: Game Metadata Support
    - Property 40: Context-Aware Strictness
    - Property 41: ELO-Based Comment Complexity
    - Validates: Requirements 14.1, 14.2, 14.3, 14.4

  - [x] 28.3 Integrate metadata into BasicAnalyzer

    - Update analyze_game() to accept metadata parameter
    - Apply strictness multiplier to scoring
    - Adjust comment complexity based on ELO
    - _Requirements: 14.1_

- [-] 29. Complete OpeningEvaluator Implementio (GAP 10)



  - [x] 29.1 Fix incomplete OpeningEvaluator class

    - Complete `ai/analysis/opening_evaluator.py` (currently truncated at line 45)
    - Implement is_near_center(), is_corner(), is_edge() methods
    - Implement evaluate_opening_move() for moves 1-10
    - Add score modifiers for opening principles
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ] 29.2 Write property tests for opening evaluation

    - Property 42: Opening Move Near Center
    - Property 43: Opening Move at Corner
    - Property 44: Opening Move at Edge Warning
    - Validates: Requirements 15.1, 15.2, 15.3
  - [ ] 29.3 Integrate OpeningEvaluator into BasicAnalyzer
    - Apply opening evaluation for moves 1-10
    - Generate opening-specific comments
    - _Requirements: 15.1_

- [x] 30. Checkpoint - Ensure opening and metadattests pas






  - Ensure all tests pass, ask the user if questions arise.



## Phase 11: Win Condition & Defensive Patterns (GAP 11-12)

-

- [x] 31. Implement VCF Detector for BASIC tierr (GAP 11)




  - [x] 31.1 Create simplified VCFDetector class

    - Create `ai/analysis/vcf_detector.py` (simplified version for BASIC tier)
    - Implement detect_vcf() with max_depth=3 for BASIC tier
    - Implement is_position_lost() to check opponent VCF
    - Return winning sequence when VCF found
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_


  - [x] 31.2 Write property tests for VCF detection

    - Property 45: VCF Detection (3-move depth)
    - Property 46: Missed Win Detection
    - Validates: Requirements 16.1, 16.3
  - [x] 31.3 Integrate VCF detection into move scoring


    - Mark missed VCF as "blunder"
    - Mark found VCF as "excellent"
    - Show winning sequence in alternatives
    - _Requirements: 16.3, 16.4, 16.5_
-

- [x] 32. Implement Defensiv Pattern Recognizr (GAP 12)






  - [x] 32.1 Create DefensivePatternRecognizer class

    - Create `ai/analysis/defensive_patterns.py`
    - Implement detect_double_block()
    - Implement detect_sacrifice_block()
    - Implement detect_preventive_block()
    - Use Vietnamese pattern names
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [x] 32.2 Write property tests for defensive patterns

    - Property 47: Double Block Recognition
    - Property 48: Defensive Pattern Names
    - Validates: Requirements 17.1, 17.4

  - [x] 32.3 Integrate defensive patterns into analysis

    - Recognize and praise defensive moves
    - Generate appropriate comments for each pattern type
    - _Requirements: 17.1, 17.2, 17.3_

- [x] 33. Checkpoit - Ensure VCF and defensive pattern tests pas






  - Ensure all tests pass, ask the user if questions arise.



## Phase 12: Tempo Analysis & Caching (GAP 16, 20)
-

- [x] 34. Implement Temo Analyze (GAP 16)

  - [x] 34.1 Create TempoAnalyzer class
    - Create `ai/analysis/tempo_analyzer.py`
    - Implement analyze_tempo() for single move
    - Implement detect_tempo_switch() for game timeline
    - Generate beginner-friendly tempo explanations
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

  - [x] 34.2 Write property tests for tempo analysis
    - Property 50: Forcing Move Detection
    - Property 51: Tempo Switch Detection
    - Validates: Requirements 19.1, 19.3

  - [x] 34.3 Integrate tempo analysis into timeline

    - Add tempo information to each move in timeline
    - Mark tempo switch points
    - _Requirements: 19.1, 19.3_
- [x] 35. Implement Analyss Cache (GAP 20)




- [ ] 35. Implement Analyss Cache (GAP 20)


  - [x] 35.1 Create AnalysisCache class


    - Create `ai/analysis/analysis_cache.py`
    - Implement position evaluation cache with LRU
    - Implement pattern cache with TTL=600s
    - Pre-load comment templates at startup
    - _Requirements: 20.1, 20.2, 20.3, 20.4_
  - [x] 35.2 Write property tests for caching


    - Property 52: Cache Hit Performance
    - Property 53: Cache Performance Improvement
    - Validates: Requirements 20.1, 20.4
  - [x] 35.3 Integrate caching into BasicAnalyzer


    - Use cached position evaluations
    - Use cached pattern detection
    - Use pre-loaded comment templates
    - _Requirements: 20.1, 20.2, 20.3_

- [-] 36. Checkpoint - Ensure empo and caching tests pass


- [ ] 36. Checkpoint - Ensure empo and caching tests pass

  - Ensure all tests pass, ask the user if questions arise.



## Phase 13: API Versioning & Cultural Comments (GAP 21-22)


- [ ] 37. Implement API Versioing (GAP 21)

  - [ ] 37.1 Create versioned API endpoints
    - Add /api/v1/analyze (legacy, backward compatible)
    - Add /api/v2/analyze (new with language, options)
    - Add deprecation warning header for v1
    - _Requirements: 21.1, 21.2, 21.3, 21.4_
  - [ ] 37.2 Write property tests for API versioning
    - Property 54: API Version Support
    - Property 55: API Deprecation Warning
    - Validates: Requirements 21.1, 21.3


- [ ] 38. Implement Cultural Coment Generator (GAP 22)

  - [ ] 38.1 Enhance CommentGenerator with cultural idioms
    - Add Vietnamese idioms dictionary
    - Add Chinese idioms dictionary
    - Add Japanese idioms dictionary
    - Add English natural expressions
    - _Requirements: 22.1, 22.2, 22.3, 22.4_
  - [ ] 38.2 Write property tests for cultural comments
    - Property 56: Cultural Idiom - Vietnamese
    - Property 57: Cultural Idiom - Chinese
    - Validates: Requirements 22.1, 22.2
  - [ ] 38.3 Integrate cultural idioms into comment generation
    - Use idioms for special situations (fork, missed win, etc.)
    - Ensure natural language flow
    - _Requirements: 22.1, 22.2, 22.3, 22.4_


- [ ] 39. Checkpoint - En1``````````````````ure API and cultural comment tests pass

  - Ensure all tests pass, ask the user if questions arise.



## Phase 14: Interactive Learning & Progressive UI (GAP 18, 23)


- [ ] 40. Implement Progressive Disclosure UI (GAP 18)
  - [ ] 40.1 Create ProgressiveAnalysisView component
    - Create `frontend/src/components/analysis/ProgressiveAnalysisView.tsx`
    - Implement Level 1 (Summary): score, rating, 1-line comment
    - Implement Level 2 (Detailed): threats, eval change, alternatives
    - Implement Level 3 (Expert): patterns, directions, tactical elements
    - _Requirements: 18.1, 18.2, 18.3_
  - [ ] 40.2 Implement auto-level selection based on ELO
    - Default to Level 1 for ELO < 1500
    - Default to Level 2 for ELO 1500-1800
    - Allow Level 3 toggle for ELO > 1800
    - _Requirements: 18.4, 18.5, 18.6_

- [ ] 41. Implement What-If Simulator (GAP 23)

  - [ ] 41.1 Create WhatIfSimulator class
    - Create `ai/analysis/what_if_simulator.py`
    - Implement simulate_move() with 3-move depth
    - Return board eval change, opponent response, final evaluation
    - _Requirements: 23.1, 23.2, 23.3, 23.4_
  - [ ] 41.2 Write property tests for what-if simulation
    - Property 58: What-If Simulation
    - Validates: Requirements 23.1, 23.2
  - [ ] 41.3 Create What-If UI component
    - Create `frontend/src/components/analysis/WhatIfPanel.tsx`
    - Allow clicking empty cells to simulate
    - Show simulation results clearly
    - Indicate hypothetical scenario
    - _Requirements: 23.1, 23.4_

- [ ] 42. Checkpoint - Ensure progressive UI and what-if tests pass

  - Ensure all tests pass, ask the user if questions arise.



## Phase 15: Player Profile & Monitoring (GAP 24-25)

- [ ] 43. Implement Player Profile Builder (GAP 24)

  - [ ] 43.1 Create PlayerProfileBuilder class
    - Create `ai/analysis/player_profile.py`
    - Implement build_profile() from ≥5 games
    - Calculate offense/defense ratio, favorite patterns, common mistakes
    - Generate strengths, weaknesses, improvement areas
    - _Requirements: 24.1, 24.2, 24.3, 24.4_
  - [ ] 43.2 Write property tests for player profile
    - Property 59: Player Profile Building
    - Validates: Requirements 24.1, 24.2
  - [ ] 43.3 Create Player Profile UI
    - Create `frontend/src/components/analysis/PlayerProfilePanel.tsx`
    - Display profile stats and charts
    - Show comparison with historical tendencies
    - _Requirements: 24.4_

- [ ] 44. Implement Analysis Metrics Logger (GAP 25)

  - [ ] 44.1 Create AnalysisMetricsLogger class
    - Create `ai/analysis/metrics_logger.py`
    - Implement log_analysis_complete() with performance metrics
    - Implement log_analysis_error() with context
    - Use structured logging format
    - _Requirements: 25.1, 25.2, 25.3, 25.4_
  - [ ] 44.2 Write property tests for metrics logging
    - Property 60: Performance Metrics Logging
    - Property 61: Error Logging with Context
    - Validates: Requirements 25.1, 25.3
  - [ ] 44.3 Integrate metrics logging into BasicAnalyzer
    - Log performance metrics after each analysis
    - Log errors with full context
    - _Requirements: 25.1, 25.2, 25.3_

- [ ] 45. Checkpoint - Ensure profile and monitoring tests pass

  - Ensure all tests pass, ask the user if questions arise.



## Phase 16: Manual Verification with Test Games

- [ ] 46. Create Test Game Repository

  - [ ] 46.1 Create test_data directory structure
    - Create `ai/test_data/` directory
    - Create subdirectories: `patterns/`, `games/`, `edge_cases/`
    - _Requirements: 1.1-1.6, 13.1-13.4_
  - [ ] 46.2 Create test game JSON files
    - Create `beginner_game_1.json` - simple game with clear mistakes
    - Create `fork_example.json` - game with fork creation
    - Create `blunder_example.json` - game with obvious blunders
    - Create `edge_pattern.json` - patterns at board edges
    - Each file includes: moves, expected_analysis (rating, score, threats)
    - _Requirements: 1.1-1.6, 7.1-7.4_

- [ ] 47. Manual Verification Testing

  - [ ] 47.1 Update test_custom_game.py for verification
    - Add comparison mode: AI analysis vs expected analysis
    - Add scoring accuracy calculation
    - Add pattern detection accuracy report
    - Print discrepancies between AI and expected results
    - _Requirements: 1.1-1.6, 2.1-2.7_
  - [ ] 47.2 Run manual verification tests
    - Run `python ai/test_custom_game.py` with each test game
    - Compare AI ratings with human expert ratings
    - Document any discrepancies in note.md
    - Adjust scoring parameters if needed
    - _Requirements: 2.1-2.7, 3.1-3.6_
  - [ ] 47.3 Create verification report
    - Calculate overall accuracy: (correct ratings / total moves) × 100%
    - Target: ≥85% accuracy for BASIC tier
    - Document false positives (AI says blunder but move is okay)
    - Document false negatives (AI says okay but move is blunder)
    - _Requirements: 2.1-2.7_

- [ ] 48. Checkpoint - Verify accuracy meets target

  - Ensure accuracy ≥85%, ask the user if questions arise.



## Phase 17: Integration Testing and Final Polish


- [ ] 49. Integration Testing
  - [ ] 49.1 Test full analysis flow end-to-end
    - Test with sample games in all 4 languages
    - Verify pattern detection accuracy
    - Verify move scoring consistency
    - Verify timeline completeness
    - _Requirements: All_
  - [ ] 49.2 Test UI integration flow
    - Test Room → Analysis navigation
    - Test Profile → Analysis navigation
    - Test Navigation menu → Analysis
    - Test URL parameter handling
    - _Requirements: 16.1, 16.2, 16.3, 20.1, 20.2, 20.3, 20.4_
  - [ ] 49.3 Test edge cases
    - Test with games < 5 moves
    - Test with patterns at board edges
    - Test with overlapping patterns
    - Test language switching
    - _Requirements: 13.1, 13.2, 13.3, 19.2_

- [ ] 50. Final Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

---


## Summary of Implementation Status

### Completed Modules ✅
- `ai/analysis/board_validation.py` - Board validation utilities
- `ai/analysis/coordinate_utils.py` - Coordinate notation utilities
- `ai/analysis/role_evaluator.py` - Role-based evaluation (integrated into BasicAnalyzer)
- `ai/analysis/move_scorer.py` - 0-10 scale move scoring
- `ai/analysis/comment_generator.py` - Multi-language comment generation (integrated)
- `ai/analysis/threat_detector.py` - Pattern detection (existing)
- `ai/analysis/position_evaluator.py` - Position evaluation (existing)
- `ai/analysis/alternative_lines.py` - Alternative move analysis (existing)
- `ai/analysis/basic_analyzer.py` - Core analyzer with RoleEvaluator and CommentGenerator integrated
- `ai/main.py` - FastAPI endpoints with language parameter and error codes
- `backend/app/Services/AIBridgeService.php` - PHP bridge with language parameter

### Frontend Completed ✅
- `frontend/src/pages/AiAnalysis.tsx` - Full page with loading, error handling, language selector
- `frontend/src/pages/Room.tsx` - Analysis button after game ends
- `frontend/src/pages/Profile.tsx` - Analyze button in match history
- `frontend/src/App.tsx` - AI Analysis navigation menu
- `frontend/src/i18n.json` - All 4 languages for analysis strings
- `frontend/src/components/analysis/MatchListSidebar.tsx` - Analyzed badge
- `frontend/src/components/analysis/ScoreTimeline.tsx` - Timeline visualization
- `frontend/src/components/analysis/MoveNavigation.tsx` - Move navigation
- `frontend/src/components/analysis/InteractiveBoard.tsx` - Interactive board
- `frontend/src/components/analysis/ControlsBar.tsx` - Controls bar

### Partially Implemented ⚠️
- `ai/analysis/opening_evaluator.py` - File truncated at line 45, needs completion

### Modules To Be Created ❌
- `ai/analysis/game_metadata.py` - Game context handling (GAP 9)
- `ai/analysis/vcf_detector.py` - Simplified VCF for BASIC tier (GAP 11)
- `ai/analysis/defensive_patterns.py` - Defensive pattern recognition (GAP 12)
- `ai/analysis/tempo_analyzer.py` - Tempo analysis (GAP 16)
- `ai/analysis/analysis_cache.py` - Caching layer (GAP 20)
- `ai/analysis/what_if_simulator.py` - What-if simulation (GAP 23)
- `ai/analysis/player_profile.py` - Player profile building (GAP 24)
- `ai/analysis/metrics_logger.py` - Analysis metrics logging (GAP 25)
- `frontend/src/components/analysis/ProgressiveAnalysisView.tsx` - Progressive disclosure UI (GAP 18)
- `frontend/src/components/analysis/WhatIfPanel.tsx` - What-if UI (GAP 23)
- `frontend/src/components/analysis/PlayerProfilePanel.tsx` - Player profile UI (GAP 24)

### Integration Tasks Pending ❌
- Complete OpeningEvaluator implementation (Task 29.1)
- Implement API versioning (Task 37.1)
- Add cultural idioms to CommentGenerator (Task 38.1)
- Create test data repository (Task 46)
- Implement alternative move reason field (Task 7.1)
- Add is_significant/is_critical flags to timeline (Task 9.1)
- Implement JSON serialization to_dict/from_dict (Task 13.1)
