# Requirements Document
# supabase_schema.sql là schema chính xác nhất
## Introduction

Hệ thống Ranked BO3 (Best of 3) là chế độ xếp hạng chính thức cho game Cờ Caro online. Trong chế độ này, hai người chơi sẽ đấu với nhau trong một series gồm tối đa 3 ván cờ. Người chơi thắng 2 ván trước sẽ giành chiến thắng series và được cộng điểm Mindpoint, người thua sẽ bị trừ điểm. Hệ thống này đảm bảo tính công bằng và giảm yếu tố may rủi so với chế độ đấu 1 ván.

## Glossary

- **BO3 (Best of 3)**: Thể thức đấu trong đó người chơi cần thắng 2 ván để giành chiến thắng series
- **Series**: Một trận đấu BO3 hoàn chỉnh gồm 2-3 ván cờ
- **Game/Ván**: Một ván cờ đơn lẻ trong series
- **Mindpoint (MP)**: Điểm xếp hạng của người chơi
- **ELO Rating**: Điểm đánh giá kỹ năng dùng để ghép trận
- **Rank**: Hạng của người chơi (Vô Danh, Tân Kỳ, Học Kỳ, Kỳ Lão, Cao Kỳ, Kỳ Thánh, Truyền Thuyết)
- **Series Score**: Tỷ số hiện tại của series (VD: 1-0, 1-1, 2-0)
- **Match Result**: Kết quả cuối cùng của series (win/loss)
- **Side Swap**: Đổi bên (X/O) giữa các ván trong series

## Requirements

### Requirement 1: Khởi tạo Series BO3

**User Story:** As a player, I want to start a ranked BO3 match, so that I can compete fairly with another player in a best-of-three format.

#### Acceptance Criteria

1. WHEN two players are matched in ranked mode THEN the system SHALL create a new series with status "in_progress" and series_score "0-0"
2. WHEN a series is created THEN the system SHALL assign player_x and player_o randomly for the first game
3. WHEN a series is created THEN the system SHALL record both players' current Mindpoint and rank for later calculation
4. WHEN a series is created THEN the system SHALL set games_to_win to 2 (for BO3 format)
5. WHEN a series starts THEN the system SHALL display series information including opponent name, rank, and current score

### Requirement 2: Quản lý các ván trong Series

**User Story:** As a player, I want each game in the series to be tracked properly, so that the series progresses correctly.

#### Acceptance Criteria

1. WHEN a game in the series ends THEN the system SHALL update the series_score based on the winner
2. WHEN a game ends THEN the system SHALL check if either player has reached 2 wins
3. WHEN a player wins a game THEN the system SHALL increment that player's game_wins count in the series
4. WHEN a game ends and series is not complete THEN the system SHALL swap player sides (X becomes O, O becomes X) for the next game
5. WHEN starting the next game in series THEN the system SHALL display current series score and game number (Game 2 of 3, etc.)

### Requirement 3: Kết thúc Series và Tính điểm

**User Story:** As a player, I want to receive appropriate Mindpoint rewards when I win a series, so that my rank reflects my skill.

#### Acceptance Criteria

1. WHEN a player reaches 2 wins THEN the system SHALL mark the series as "completed" with that player as winner
2. WHEN series ends THEN the system SHALL calculate Mindpoint change using the formula: base_points + performance_bonus + rank_difference_modifier
3. WHEN series ends THEN the system SHALL award winner between 20-50 Mindpoint based on performance
4. WHEN series ends THEN the system SHALL deduct loser 15 Mindpoint (fixed penalty)
5. WHEN series ends THEN the system SHALL update both players' Mindpoint and check for rank changes

### Requirement 4: Tính toán Mindpoint chi tiết

**User Story:** As a player, I want the Mindpoint calculation to be fair and reward good performance, so that skilled play is recognized.

#### Acceptance Criteria

1. WHEN calculating winner's Mindpoint THEN the system SHALL use base reward of 20 points
2. WHEN winner wins 2-0 (sweep) THEN the system SHALL add 10 bonus points for dominant victory
3. WHEN winner has faster average move time THEN the system SHALL add 5 bonus points for time efficiency
4. WHEN winner beats a higher-ranked opponent THEN the system SHALL add (rank_difference × 5) bonus points
5. WHEN winner beats a lower-ranked opponent THEN the system SHALL subtract (rank_difference × 3) points (minimum 5 total)

### Requirement 5: Cập nhật Rank sau Series

**User Story:** As a player, I want my rank to update automatically when I reach new Mindpoint thresholds, so that my progress is visible.

#### Acceptance Criteria

1. WHEN player's Mindpoint crosses a rank threshold THEN the system SHALL update player's current_rank
2. WHEN player ranks up THEN the system SHALL display rank-up animation and notification
3. WHEN player ranks down THEN the system SHALL display rank-down notification
4. WHEN rank changes THEN the system SHALL record the change in rank_history table
5. WHEN series ends THEN the system SHALL display detailed breakdown of Mindpoint gained/lost

### Requirement 6: Thưởng tài nguyên sau Series

**User Story:** As a player, I want to receive coins and experience after completing a ranked series, so that I can progress in the game.

#### Acceptance Criteria

1. WHEN series ends THEN the system SHALL award coins to both players (winner gets more)
2. WHEN player wins series THEN the system SHALL award 50 coins base + 10 coins per game won
3. WHEN player loses series THEN the system SHALL award 20 coins for participation
4. WHEN series ends THEN the system SHALL award EXP to both players (winner: 100 EXP, loser: 40 EXP)
5. WHEN player gains enough EXP THEN the system SHALL level up the player and award bonus coins

### Requirement 7: Xử lý Disconnect và Abandon

**User Story:** As a player, I want the system to handle disconnections fairly, so that I'm not unfairly penalized for technical issues.

#### Acceptance Criteria

1. WHEN a player disconnects during a game THEN the system SHALL pause the game and wait 60 seconds for reconnection
2. WHEN a player fails to reconnect within 60 seconds THEN the system SHALL forfeit that game to the opponent
3. WHEN a player forfeits 2 games THEN the system SHALL end the series with that player as loser
4. WHEN a player abandons (clicks leave) THEN the system SHALL immediately forfeit the series
5. WHEN series is forfeited THEN the system SHALL apply standard loss penalty (-15 MP) plus abandon penalty (-10 MP)

### Requirement 8: UI hiển thị trong trận

**User Story:** As a player, I want to see clear information about the series progress, so that I know the current state of the match.

#### Acceptance Criteria

1. WHEN in a series THEN the system SHALL display series score prominently (e.g., "1 - 0")
2. WHEN in a series THEN the system SHALL display current game number (e.g., "Game 2 of 3")
3. WHEN a game ends THEN the system SHALL display game result and updated series score
4. WHEN series ends THEN the system SHALL display final result with Mindpoint change and rewards
5. WHEN between games THEN the system SHALL display countdown timer before next game starts (10 seconds)

### Requirement 9: Lưu trữ dữ liệu Series

**User Story:** As a system administrator, I want series data to be stored properly, so that match history and statistics are accurate.

#### Acceptance Criteria

1. WHEN a series is created THEN the system SHALL store: series_id, player1_id, player2_id, mode, created_at
2. WHEN a game ends THEN the system SHALL store game result linked to the series
3. WHEN series ends THEN the system SHALL store: winner_id, final_score, duration, mp_changes
4. WHEN querying match history THEN the system SHALL return series with all associated games
5. WHEN displaying statistics THEN the system SHALL calculate series win rate separately from game win rate

### Requirement 10: Rematch và Continue

**User Story:** As a player, I want the option to rematch after a series ends, so that I can continue playing with the same opponent.

#### Acceptance Criteria

1. WHEN series ends THEN the system SHALL display "Rematch" button to both players
2. WHEN both players click rematch THEN the system SHALL create a new series with the same players
3. WHEN only one player clicks rematch THEN the system SHALL wait 15 seconds for the other player
4. WHEN rematch timeout expires THEN the system SHALL return both players to home screen
5. WHEN player clicks "Exit" THEN the system SHALL return that player to home screen immediately
