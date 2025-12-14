# Requirements Document

## Introduction

Tính năng xử lý tự động khi một người chơi thoát/disconnect trong trận đấu Ranked mode. Khi một người chơi rời khỏi trận đấu ranked, người chơi còn lại sẽ tự động được tuyên bố thắng với điểm số 20 (mindpoint), và trận đấu kết thúc ngay lập tức.

## Glossary

- **Ranked_Mode**: Chế độ chơi xếp hạng (mode: 'rank'), sử dụng hệ thống Bo3 series
- **Disconnect**: Người chơi mất kết nối hoặc thoát khỏi trận đấu
- **Auto_Win**: Chiến thắng tự động được trao cho người chơi còn lại
- **Mindpoint**: Điểm xếp hạng trong hệ thống ranked
- **Series**: Chuỗi trận đấu Bo3 trong ranked mode
- **Forfeit_Score**: Điểm thưởng cố định (20 MP) khi đối thủ bỏ cuộc

## Requirements

### Requirement 1

**User Story:** As a player in ranked mode, I want to automatically win when my opponent disconnects/leaves, so that I don't waste time waiting and receive fair compensation.

#### Acceptance Criteria

1. WHEN a player disconnects from a ranked room THEN the Ranked_System SHALL detect the disconnection within 5 seconds
2. WHEN a player disconnects from a ranked room THEN the Ranked_System SHALL notify the remaining player about opponent disconnection
3. WHEN a player remains disconnected for more than 10 seconds in ranked mode THEN the Ranked_System SHALL declare the remaining player as winner
4. WHEN the remaining player wins by opponent disconnect THEN the Ranked_System SHALL award exactly 20 mindpoint to the winner
5. WHEN the remaining player wins by opponent disconnect THEN the Ranked_System SHALL deduct exactly 20 mindpoint from the disconnected player

### Requirement 2

**User Story:** As a ranked player, I want the series to end properly when my opponent disconnects, so that my ranking is updated correctly.

#### Acceptance Criteria

1. WHEN a player disconnects and forfeits in ranked mode THEN the Ranked_System SHALL mark the current game as forfeit with winner being the remaining player
2. WHEN a forfeit occurs THEN the Ranked_System SHALL update the series score (player wins count)
3. WHEN a forfeit causes series completion (2 wins) THEN the Ranked_System SHALL complete the series with final results
4. WHEN a series completes by forfeit THEN the Ranked_System SHALL update both players' profiles with new mindpoint values
5. WHEN a series completes by forfeit THEN the Ranked_System SHALL emit series_complete event to both players

### Requirement 3

**User Story:** As a player, I want to see clear feedback when my opponent disconnects, so that I understand what is happening.

#### Acceptance Criteria

1. WHEN opponent disconnects THEN the UI SHALL display a "Đối thủ đã thoát" (Opponent left) notification
2. WHEN opponent disconnects THEN the UI SHALL show countdown timer for auto-win (10 seconds)
3. WHEN auto-win is triggered THEN the UI SHALL display victory screen with "+20 MP" reward
4. WHEN auto-win is triggered THEN the UI SHALL show the final series score

### Requirement 4

**User Story:** As a system administrator, I want disconnect handling to be robust, so that the system handles edge cases properly.

#### Acceptance Criteria

1. WHEN both players disconnect simultaneously THEN the Ranked_System SHALL declare a draw with no mindpoint changes
2. WHEN a player reconnects within the 10-second grace period THEN the Ranked_System SHALL cancel the forfeit process and resume the game
3. WHEN network issues cause temporary disconnection THEN the Ranked_System SHALL allow reconnection within grace period
4. IF the backend fails to process forfeit THEN the Ranked_System SHALL retry up to 3 times before declaring error
5. WHEN forfeit processing fails after retries THEN the Ranked_System SHALL log the error and notify admin
