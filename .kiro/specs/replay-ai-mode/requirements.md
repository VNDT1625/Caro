# Requirements Document

## Introduction

Tính năng "AI trong chế độ đi biên ký" (Replay AI Mode) cho phép người dùng tương tác với AI khi xem lại ván đấu. Thay vì chỉ xem lại các nước đi gốc, người dùng có thể:
- Chọn một vị trí bất kỳ trong ván đấu và thử đi nước khác
- AI sẽ phản hồi lại nước đi của người dùng
- So sánh kết quả giữa nhánh gốc và nhánh mới
- Học hỏi từ các tình huống "what-if"

Tính năng này tận dụng ReplayEngine đã có sẵn trong backend AI và mở rộng UI để hỗ trợ chế độ chơi thử với AI.

## Glossary

- **Replay Mode**: Chế độ xem lại ván đấu, chỉ xem không tương tác
- **What-If Mode**: Chế độ thử nghiệm, người dùng có thể đi nước khác và AI phản hồi
- **Divergence Point**: Điểm rẽ nhánh - nước đi đầu tiên mà người dùng đi khác với ván gốc
- **Original Line**: Nhánh gốc - các nước đi trong ván đấu thực tế
- **Alternative Line**: Nhánh thử nghiệm - các nước đi mới do người dùng và AI tạo ra
- **Win Probability**: Xác suất thắng được tính bởi AI
- **ReplayEngine**: Module backend xử lý logic replay và what-if
- **Session**: Phiên replay được lưu trữ trên server

## Requirements

### Requirement 1

**User Story:** As a player, I want to enter what-if mode from any position in the replay, so that I can explore alternative moves.

#### Acceptance Criteria

1. WHEN a user clicks "Thử đi nước khác" button while in replay mode THEN the system SHALL switch to what-if mode and enable board interaction
2. WHEN the system enters what-if mode THEN the system SHALL display a visual indicator showing the current mode is "Thử nghiệm"
3. WHEN the user is in what-if mode THEN the system SHALL highlight valid cells where the user can place a stone
4. WHEN the user clicks "Quay lại xem" button in what-if mode THEN the system SHALL return to replay mode and restore the original board state

### Requirement 2

**User Story:** As a player, I want to play alternative moves and see AI responses, so that I can learn from different scenarios.

#### Acceptance Criteria

1. WHEN a user places a stone in what-if mode THEN the system SHALL send the move to ReplayEngine and receive AI response within 3 seconds
2. WHEN the AI responds with a move THEN the system SHALL display the AI move on the board with animation
3. WHEN a move is played in what-if mode THEN the system SHALL update the win probability display for both players
4. WHEN the user plays the first alternative move THEN the system SHALL mark and display the divergence point

### Requirement 3

**User Story:** As a player, I want to compare my alternative line with the original game, so that I can understand which approach is better.

#### Acceptance Criteria

1. WHEN the user is in what-if mode THEN the system SHALL display a comparison panel showing original vs current win probability
2. WHEN the win probability changes significantly (>10%) THEN the system SHALL display a Vietnamese explanation of the change
3. WHEN the user requests divergence analysis THEN the system SHALL display detailed comparison between original and alternative outcomes
4. WHEN displaying comparison THEN the system SHALL use color coding (green for improvement, red for worse, yellow for similar)

### Requirement 4

**User Story:** As a player, I want to navigate between original and alternative lines, so that I can review both scenarios.

#### Acceptance Criteria

1. WHEN the user has created an alternative line THEN the system SHALL display a branch indicator showing both lines
2. WHEN the user clicks on the original line indicator THEN the system SHALL show the original game moves from divergence point
3. WHEN the user clicks on the alternative line indicator THEN the system SHALL show the what-if moves from divergence point
4. WHEN switching between lines THEN the system SHALL animate the board transition smoothly

### Requirement 5

**User Story:** As a player, I want the what-if session to persist during my analysis, so that I can continue exploring without losing progress.

#### Acceptance Criteria

1. WHEN a what-if session is created THEN the system SHALL store the session on the server with a unique session_id
2. WHEN the user navigates away and returns to the same match THEN the system SHALL offer to restore the previous what-if session
3. WHEN the user explicitly ends the session THEN the system SHALL clean up server resources via cleanup_session API
4. WHEN the session is inactive for 30 minutes THEN the system SHALL automatically clean up the session

### Requirement 6

**User Story:** As a player, I want to undo moves in what-if mode, so that I can try different alternatives from the same position.

#### Acceptance Criteria

1. WHEN the user clicks "Hoàn tác" button in what-if mode THEN the system SHALL remove the last move pair (user + AI)
2. WHEN undoing moves THEN the system SHALL update the board state and win probability accordingly
3. WHEN all alternative moves are undone THEN the system SHALL return to the divergence point state
4. IF the user tries to undo when at divergence point THEN the system SHALL disable the undo button

### Requirement 7

**User Story:** As a player, I want to see AI difficulty options in what-if mode, so that I can practice against appropriate skill levels.

#### Acceptance Criteria

1. WHEN entering what-if mode THEN the system SHALL display AI difficulty selector with options: Dễ, Trung bình, Khó
2. WHEN the user selects a difficulty THEN the system SHALL adjust AI response strength accordingly
3. WHEN difficulty is "Dễ" THEN the system SHALL make AI occasionally miss optimal moves
4. WHEN difficulty is "Khó" THEN the system SHALL make AI play at maximum strength

