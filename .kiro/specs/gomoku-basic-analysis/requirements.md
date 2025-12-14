# Requirements Document

## Introduction

Cải thiện hệ thống AI Match Analysis cho Gomoku/Caro, tập trung vào phiên bản BASIC dành cho người chơi mới và trung bình (ELO < 1800). Hệ thống hiện tại đã có các module phân tích cơ bản (basic_analyzer.py, threat_detector.py, position_evaluator.py, mistake_analyzer.py) nhưng cần cải thiện về:
- Độ chính xác nhận diện pattern
- Chất lượng comment/note đa ngôn ngữ (4 thứ tiếng: VI, EN, ZH, JA)
- Hệ thống đánh giá nước đi theo vai trò (công/thủ)
- UI/UX hiển thị phân tích

## Glossary

- **Pattern**: Các hình thế cờ như hàng 3, hàng 4, fork
- **Threat**: Đe dọa - các pattern có thể dẫn đến thắng
- **Fork**: Đa đường - 1 nước tạo ≥2 hàng 3 mở
- **VCF**: Victory by Continuous Four - thắng bằng chuỗi tứ liên tục
- **Open Four (Tứ Mở)**: _XXXX_ - 4 quân liên tiếp, 2 đầu trống
- **Closed Four (Tứ Kín)**: XXXX_ hoặc _XXXX - 4 quân, 1 đầu bị chặn
- **Open Three (Tam Mở)**: _XXX_ - 3 quân liên tiếp, 2 đầu trống
- **Attacker**: Người đang ở thế công
- **Defender**: Người đang ở thế thủ
- **Board Evaluation**: Điểm đánh giá thế trận
- **Move Score**: Điểm đánh giá nước đi (0-10)
- **Notation**: Ký hiệu tọa độ chuẩn quốc tế (A1-O15)

## Requirements

### Requirement 1: Pattern Recognition Enhancement

**User Story:** As a player, I want the AI to accurately detect all basic patterns on the board, so that I can understand the current threats and opportunities.

#### Acceptance Criteria

1. WHEN the AI analyzes a board position THEN the Analysis_System SHALL detect all FIVE patterns (5 quân liên tiếp) with 100% accuracy
2. WHEN the AI analyzes a board position THEN the Analysis_System SHALL detect all OPEN_FOUR patterns (_XXXX_) with 100% accuracy
3. WHEN the AI analyzes a board position THEN the Analysis_System SHALL detect all CLOSED_FOUR patterns (XXXX_ hoặc _XXXX) with 100% accuracy
4. WHEN the AI analyzes a board position THEN the Analysis_System SHALL detect all OPEN_THREE patterns (_XXX_) with 100% accuracy
5. WHEN the AI analyzes a board position THEN the Analysis_System SHALL detect all FORK patterns (1 nước tạo ≥2 hàng 3 mở) with 95% accuracy
6. WHEN the AI analyzes a board position THEN the Analysis_System SHALL return pattern positions with correct coordinates in standard notation (A1-O15)

### Requirement 2: Move Scoring System

**User Story:** As a player, I want each move to be scored on a 0-10 scale with clear rating, so that I can understand how good or bad my moves were.

#### Acceptance Criteria

1. WHEN the AI evaluates a move THEN the Analysis_System SHALL assign a score from 0.0 to 10.0
2. WHEN a move score is 9-10 THEN the Analysis_System SHALL classify it as "excellent"
3. WHEN a move score is 7-8 THEN the Analysis_System SHALL classify it as "good"
4. WHEN a move score is 5-6 THEN the Analysis_System SHALL classify it as "average"
5. WHEN a move score is 3-4 THEN the Analysis_System SHALL classify it as "poor"
6. WHEN a move score is 0-2 THEN the Analysis_System SHALL classify it as "blunder"
7. WHEN calculating move score THEN the Analysis_System SHALL consider threats_created, threats_blocked, and board_evaluation_change

### Requirement 3: Role-Based Evaluation

**User Story:** As a player, I want the AI to evaluate moves based on my role (attacker/defender), so that I can learn appropriate strategies for each situation.

#### Acceptance Criteria

1. WHEN board_evaluation > +20 for player X THEN the Analysis_System SHALL assign "attacker" role to X and "defender" role to O
2. WHEN board_evaluation < -20 for player X THEN the Analysis_System SHALL assign "defender" role to X and "attacker" role to O
3. WHEN board_evaluation is between -20 and +20 THEN the Analysis_System SHALL assign "balanced" role to both players
4. WHEN evaluating an attacker's move THEN the Analysis_System SHALL reward moves that create multiple threats
5. WHEN evaluating a defender's move THEN the Analysis_System SHALL reward moves that block the highest priority threat
6. WHEN a defender blocks a threat AND creates counter-attack THEN the Analysis_System SHALL give bonus score

### Requirement 4: Multi-Language Comment System

**User Story:** As a player, I want analysis comments in my preferred language (Vietnamese, English, Chinese, Japanese), so that I can understand the analysis easily.

#### Acceptance Criteria

1. WHEN generating a comment THEN the Analysis_System SHALL support Vietnamese (vi), English (en), Chinese (zh), and Japanese (ja) languages
2. WHEN a move is rated "excellent" THEN the Analysis_System SHALL generate a positive comment explaining why the move is excellent
3. WHEN a move is rated "blunder" THEN the Analysis_System SHALL generate a warning comment explaining the mistake and suggesting alternatives
4. WHEN a move creates a fork THEN the Analysis_System SHALL explain the fork concept in simple terms
5. WHEN a move blocks an opponent threat THEN the Analysis_System SHALL acknowledge the defensive play
6. WHEN generating comments THEN the Analysis_System SHALL use natural language appropriate for beginners (avoid complex terminology)

### Requirement 5: Alternative Move Suggestions

**User Story:** As a player, I want to see 2-3 alternative moves for each position, so that I can learn better options.

#### Acceptance Criteria

1. WHEN analyzing a move THEN the Analysis_System SHALL suggest 2-3 alternative moves with scores
2. WHEN suggesting alternatives THEN the Analysis_System SHALL include a brief reason for each suggestion
3. WHEN the actual move is a blunder THEN the Analysis_System SHALL highlight the best alternative prominently
4. WHEN all alternatives have similar scores (within 0.5) THEN the Analysis_System SHALL indicate that multiple good options exist

### Requirement 6: Board Evaluation Timeline

**User Story:** As a player, I want to see how the board evaluation changed throughout the game, so that I can identify turning points.

#### Acceptance Criteria

1. WHEN analyzing a game THEN the Analysis_System SHALL calculate board_evaluation before and after each move
2. WHEN board_evaluation changes by more than 20 points THEN the Analysis_System SHALL mark it as a significant moment
3. WHEN displaying timeline THEN the Analysis_System SHALL show score changes visually (positive for X advantage, negative for O advantage)
4. WHEN a move causes evaluation swing > 50 points THEN the Analysis_System SHALL flag it as a critical turning point

### Requirement 7: Tactical Pattern Detection

**User Story:** As a player, I want the AI to identify tactical patterns like traps and setups, so that I can learn advanced concepts.

#### Acceptance Criteria

1. WHEN a move creates a "trap" (weak-looking move that sets up fork) THEN the Analysis_System SHALL identify and explain the trap
2. WHEN a move is a "setup" (preparation for future threats) THEN the Analysis_System SHALL explain the strategic value
3. WHEN a player uses "trading" tactic (ignoring opponent threat to create bigger threat) THEN the Analysis_System SHALL explain the trade-off
4. WHEN detecting patterns THEN the Analysis_System SHALL use Vietnamese pattern names (Tứ Hướng, Song Song, Chặn Muộn, Bỏ Lỡ Thắng)

### Requirement 8: Coordinate System Compliance

**User Story:** As a player, I want all coordinates to follow standard Gomoku notation, so that I can easily understand positions.

#### Acceptance Criteria

1. WHEN displaying coordinates THEN the Analysis_System SHALL use format [LETTER][NUMBER] (e.g., H8, A1, O15)
2. WHEN converting array index to notation THEN the Analysis_System SHALL map column 0-14 to A-O and row 0-14 to 1-15
3. WHEN receiving notation input THEN the Analysis_System SHALL accept both uppercase and lowercase letters
4. WHEN notation is invalid (P1, A16, A0) THEN the Analysis_System SHALL return a validation error

### Requirement 9: Performance Requirements

**User Story:** As a player, I want analysis to complete quickly, so that I don't have to wait long for results.

#### Acceptance Criteria

1. WHEN analyzing a complete game (up to 225 moves) THEN the Analysis_System SHALL complete within 2000 milliseconds
2. WHEN analyzing a single move THEN the Analysis_System SHALL complete within 100 milliseconds
3. WHEN generating comments THEN the Analysis_System SHALL complete within 50 milliseconds per move

### Requirement 10: UI/UX Improvements

**User Story:** As a player, I want a clear and intuitive interface to view analysis results, so that I can easily learn from my games.

#### Acceptance Criteria

1. WHEN displaying move analysis THEN the UI SHALL show move score, rating badge, and comment clearly
2. WHEN a move is a mistake THEN the UI SHALL highlight it with a distinct color (red for blunder, orange for poor)
3. WHEN showing alternatives THEN the UI SHALL allow clicking to preview the alternative move on the board
4. WHEN displaying patterns THEN the UI SHALL highlight the pattern cells on the board
5. WHEN user hovers over a timeline point THEN the UI SHALL show a tooltip with move details

### Requirement 11: Analysis Result Serialization

**User Story:** As a developer, I want analysis results to be serializable to JSON, so that they can be cached and transmitted via API.

#### Acceptance Criteria

1. WHEN serializing analysis result THEN the Analysis_System SHALL produce valid JSON
2. WHEN deserializing JSON THEN the Analysis_System SHALL reconstruct the original analysis result
3. WHEN serializing THEN the Analysis_System SHALL include all fields: timeline, mistakes, patterns, best_move, summary

---

## Critical Improvements (GAP 9-25)

### Requirement 14: Game Context and Metadata

**User Story:** As a player, I want the analysis to understand my game context (tournament, casual, with rule variants), so that evaluation is appropriate.

#### Acceptance Criteria

1. WHEN analyzing game THEN the Analysis_System SHALL support metadata including game_type (tournament, ranked, casual), rule_variant (Standard, Renju, Swap2, Pro), time_control (blitz, rapid, classical), and player_elo (if available)
2. WHEN game is tournament THEN the Analysis_System SHALL apply stricter mistake thresholds
3. WHEN game is casual THEN the Analysis_System SHALL generate encouraging and educational comments
4. WHEN player ELO is known THEN the Analysis_System SHALL adjust comment complexity to match skill level
5. WHEN rule is Renju THEN the Analysis_System SHALL detect forbidden moves for Black

### Requirement 15: Opening Principles (BASIC tier)

**User Story:** As a beginner player, I want the AI to evaluate my opening moves (moves 1-10), so that I can learn proper opening principles.

#### Acceptance Criteria

1. WHEN a move in opening phase (moves 1-10) is near center (within 3 cells of H8) THEN the Analysis_System SHALL rate it positively
2. WHEN a move in opening phase is at board corner (A1, O1, A15, O15) THEN the Analysis_System SHALL rate it as "poor" with explanation
3. WHEN a move in opening phase is at board edge (columns A-C or M-O, rows 1-3 or 13-15) without clear reason THEN the Analysis_System SHALL warn about limited development
4. WHEN a move creates flexible structure (multiple development directions) THEN the Analysis_System SHALL acknowledge the strategic value
5. WHEN a move creates rigid structure (only 1 development direction) THEN the Analysis_System SHALL suggest more flexible alternatives

### Requirement 16: Win Condition Detection (VCF)

**User Story:** As a player, I want to know when the game was already won/lost, so that I can understand critical moments.

#### Acceptance Criteria

1. WHEN position has forced win in N moves (VCF, N≤3 for BASIC tier) THEN the Analysis_System SHALL detect and report it
2. WHEN position is already lost (opponent has VCF) THEN the Analysis_System SHALL mark the "game over" point
3. WHEN player misses forced win THEN the Analysis_System SHALL rate the move as "blunder" with winning sequence explanation
4. WHEN player finds forced win THEN the Analysis_System SHALL rate the move as "excellent"
5. WHEN forced win exists THEN the Analysis_System SHALL show the winning sequence in alternatives

### Requirement 17: Defensive Pattern Recognition

**User Story:** As a player, I want the AI to recognize and praise good defensive moves, so that I can learn defensive strategies.

#### Acceptance Criteria

1. WHEN a move blocks two threats simultaneously (Double Block) THEN the Analysis_System SHALL recognize and praise it
2. WHEN a move sacrifices blocking one threat to create stronger counter-attack (Sacrifice Block) THEN the Analysis_System SHALL explain the trade-off
3. WHEN a move prevents opponent from creating a fork (Preventive Block) THEN the Analysis_System SHALL acknowledge the foresight
4. WHEN evaluating defensive moves THEN the Analysis_System SHALL use Vietnamese pattern names (Chặn Kép, Chặn Hi Sinh, Chặn Phòng Ngừa)

### Requirement 18: Progressive Disclosure UI

**User Story:** As a player, I want analysis information to be shown progressively based on my skill level, so that I am not overwhelmed.

#### Acceptance Criteria

1. WHEN displaying analysis at Level 1 (Summary) THEN the UI SHALL show only move score, rating badge, and 1-line comment
2. WHEN user clicks to expand (Level 2 - Detailed) THEN the UI SHALL show threats created/blocked, board evaluation change, and 2-3 alternatives
3. WHEN user toggles advanced mode (Level 3 - Expert) THEN the UI SHALL show pattern detection details, all 8 directions analysis, and full tactical elements
4. WHEN user ELO < 1500 THEN the UI SHALL default to Level 1 (Summary)
5. WHEN user ELO 1500-1800 THEN the UI SHALL default to Level 2 (Detailed)
6. WHEN user ELO > 1800 THEN the UI SHALL allow Level 3 (Expert) toggle

### Requirement 19: Temporal Reasoning (Tempo Analysis)

**User Story:** As a player, I want to understand tempo and initiative throughout the game, so that I can learn timing concepts.

#### Acceptance Criteria

1. WHEN a move forces opponent to respond (creates immediate threat) THEN the Analysis_System SHALL mark it as "forcing" with tempo gain
2. WHEN a move has no immediate threat THEN the Analysis_System SHALL mark it as "slow" with potential tempo loss
3. WHEN initiative changes from one player to another THEN the Analysis_System SHALL mark the tempo switch point
4. WHEN generating comments THEN the Analysis_System SHALL explain tempo concepts in beginner-friendly terms

### Requirement 20: Caching Strategy

**User Story:** As a user, I want analysis to be fast, so that I don't wait long for results.

#### Acceptance Criteria

1. WHEN analyzing a position that was previously analyzed THEN the Analysis_System SHALL return cached result within 10ms
2. WHEN detecting patterns THEN the Analysis_System SHALL use pattern cache with TTL of 600 seconds
3. WHEN generating comments THEN the Analysis_System SHALL use pre-loaded comment templates (no disk I/O per request)
4. WHEN cache is used THEN the Analysis_System SHALL achieve 5x-10x performance improvement over uncached analysis

### Requirement 21: API Versioning

**User Story:** As a developer, I want API versioning, so that I can update the API without breaking existing clients.

#### Acceptance Criteria

1. WHEN calling API THEN the Analysis_System SHALL support URL-based versioning (/api/v1/analyze, /api/v2/analyze)
2. WHEN using v1 API THEN the Analysis_System SHALL maintain backward compatibility for 6 months
3. WHEN using deprecated v1 API THEN the Analysis_System SHALL return warning header "X-API-Deprecated: true"
4. WHEN using v2 API THEN the Analysis_System SHALL support new parameters: language, options (depth, include_alternatives, player_elo)

### Requirement 22: Cultural Context in Comments

**User Story:** As a player, I want comments to use culturally appropriate idioms and expressions, so that they feel natural in my language.

#### Acceptance Criteria

1. WHEN generating Vietnamese comments THEN the Analysis_System SHALL use Vietnamese idioms (e.g., "một mũi tên trúng hai đích" for fork)
2. WHEN generating Chinese comments THEN the Analysis_System SHALL use Chinese idioms (e.g., "一石二鸟" for fork)
3. WHEN generating Japanese comments THEN the Analysis_System SHALL use Japanese idioms (e.g., "一石二鳥" for fork)
4. WHEN generating English comments THEN the Analysis_System SHALL use natural English expressions (e.g., "Double threat brilliancy!" for fork)

### Requirement 23: Interactive Learning Mode

**User Story:** As a player, I want to simulate "what if" scenarios, so that I can learn by exploring alternatives.

#### Acceptance Criteria

1. WHEN user clicks on an empty cell during analysis THEN the UI SHALL simulate the move and show expected outcome
2. WHEN simulating a move THEN the Analysis_System SHALL calculate 3 moves ahead and show board evaluation change
3. WHEN simulation completes THEN the UI SHALL show opponent's best response and final evaluation
4. WHEN displaying simulation THEN the UI SHALL clearly indicate it is a hypothetical scenario

### Requirement 24: Player Profile and Tendencies

**User Story:** As a player, I want to understand my playing style and tendencies over multiple games, so that I can improve strategically.

#### Acceptance Criteria

1. WHEN analyzing multiple games (≥5) for same player THEN the Analysis_System SHALL build a player profile
2. WHEN profile is built THEN the Analysis_System SHALL show offense/defense ratio, favorite patterns, and common mistakes
3. WHEN analyzing new game THEN the Analysis_System SHALL compare with player's historical tendencies
4. WHEN displaying profile THEN the UI SHALL show strengths, weaknesses, and improvement areas

### Requirement 25: Monitoring and Telemetry

**User Story:** As a system administrator, I want to monitor analysis performance and quality, so that I can maintain service quality.

#### Acceptance Criteria

1. WHEN analysis completes THEN the Analysis_System SHALL log performance metrics (total_time, pattern_detection_time, evaluation_time, comment_generation_time)
2. WHEN analysis completes THEN the Analysis_System SHALL log quality metrics (patterns_detected, threats_detected, mistakes_identified)
3. WHEN error occurs THEN the Analysis_System SHALL log error details with context (game_id, user_id, language)
4. WHEN logging THEN the Analysis_System SHALL use structured logging format for easy querying
