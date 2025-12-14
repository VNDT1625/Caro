# Requirements Document

## Introduction

Hệ thống Swap 2 Opening Rule giải quyết vấn đề công bằng trong Gomoku/Caro khi người đi trước (X) có lợi thế đáng kể. Swap 2 là luật mở đầu được sử dụng trong các giải đấu chuyên nghiệp, cho phép người chơi thứ hai có quyền chọn đổi bên sau khi thấy 3 nước đầu tiên.

**Quy trình Swap 2:**
1. Player 1 đặt 3 quân đầu tiên (2 đen + 1 trắng) theo bất kỳ vị trí nào
2. Player 2 có 3 lựa chọn:
   - **Chọn Đen (Black)**: Giữ nguyên, Player 2 đi tiếp với quân Đen
   - **Chọn Trắng (White)**: Giữ nguyên, Player 2 đi tiếp với quân Trắng  
   - **Đặt thêm 2 quân**: Đặt thêm 1 đen + 1 trắng, sau đó Player 1 chọn màu

**Áp dụng:**
- **Bắt buộc**: Ranked mode (BO3)
- **Tùy chọn**: Các mode khác (Tiêu Dao, Vạn Môn Tranh Đấu, Dị Biến Kỳ...) - có thể bật/tắt khi tạo phòng

## Glossary

- **Swap 2**: Luật mở đầu công bằng trong Gomoku, cho phép đổi bên sau 3 nước đầu
- **Opening Phase**: Giai đoạn mở đầu khi áp dụng Swap 2 (3-5 nước đầu)
- **Main Game Phase**: Giai đoạn chơi chính sau khi hoàn tất Swap 2
- **Tentative Stones**: Các quân cờ tạm thời trong giai đoạn Swap 2, chưa xác định màu cuối cùng
- **Color Selection**: Hành động chọn màu (Đen/Trắng) của người chơi
- **GameEngine**: Module xử lý logic game hiện tại
- **SeriesManager**: Service quản lý series BO3 ranked

## Requirements

### Requirement 1: Swap 2 Phase Management

**User Story:** As a player, I want the game to manage Swap 2 opening phase correctly, so that the game is fair for both players.

#### Acceptance Criteria

1. WHEN a game with Swap 2 enabled starts, THE GameEngine SHALL enter "swap2_placement" phase with Player 1 to place 3 stones
2. WHEN Player 1 places the 3rd stone, THE GameEngine SHALL transition to "swap2_choice" phase for Player 2
3. WHEN Player 2 makes a choice (black/white/place_more), THE GameEngine SHALL process the choice and transition to appropriate next phase
4. IF Player 2 chooses "place_more", THEN THE GameEngine SHALL enter "swap2_extra" phase for Player 2 to place 2 more stones
5. WHEN Player 2 finishes placing 2 extra stones, THE GameEngine SHALL transition to "swap2_final_choice" phase for Player 1 to choose color
6. WHEN color selection is complete, THE GameEngine SHALL transition to "main_game" phase with correct player sides assigned

### Requirement 2: Stone Placement in Swap 2

**User Story:** As a player, I want to place stones correctly during Swap 2 phase, so that the opening is set up properly.

#### Acceptance Criteria

1. WHEN in "swap2_placement" phase, THE GameEngine SHALL allow Player 1 to place exactly 3 stones in any valid positions
2. WHEN in "swap2_placement" phase, THE GameEngine SHALL track stones as tentative (2 black + 1 white pattern)
3. WHEN in "swap2_extra" phase, THE GameEngine SHALL allow Player 2 to place exactly 2 more stones (1 black + 1 white)
4. IF a player attempts to place a stone on an occupied cell during Swap 2, THEN THE GameEngine SHALL reject the move
5. WHEN all required stones are placed in a phase, THE GameEngine SHALL automatically advance to the next phase

### Requirement 3: Color Selection Logic

**User Story:** As a player, I want to choose my color after seeing the opening stones, so that I can make a strategic decision.

#### Acceptance Criteria

1. WHEN in "swap2_choice" phase, THE GameEngine SHALL present Player 2 with exactly 3 options: "black", "white", "place_more"
2. WHEN Player 2 chooses "black", THE GameEngine SHALL assign Black to Player 2 and White to Player 1
3. WHEN Player 2 chooses "white", THE GameEngine SHALL assign White to Player 2 and Black to Player 1
4. WHEN Player 2 chooses "place_more", THE GameEngine SHALL allow Player 2 to place 2 additional stones before Player 1 chooses
5. WHEN in "swap2_final_choice" phase, THE GameEngine SHALL present Player 1 with exactly 2 options: "black", "white"
6. WHEN color selection completes, THE GameEngine SHALL finalize stone colors and determine who moves next

### Requirement 4: Game Mode Configuration

**User Story:** As a room creator, I want to configure Swap 2 for my game mode, so that I can choose the fairness level.

#### Acceptance Criteria

1. WHEN creating a Ranked game, THE System SHALL automatically enable Swap 2 without option to disable
2. WHEN creating a non-Ranked game (Tiêu Dao, Vạn Môn, etc.), THE System SHALL provide a toggle to enable/disable Swap 2
3. WHEN Swap 2 is disabled, THE GameEngine SHALL use traditional alternating turns starting with X
4. WHEN a room is created with Swap 2 setting, THE System SHALL persist this setting for all games in that room/series
5. WHEN displaying room info, THE System SHALL show Swap 2 status clearly to joining players

### Requirement 5: UI State Display

**User Story:** As a player, I want to see clear UI feedback during Swap 2 phase, so that I understand what actions are available.

#### Acceptance Criteria

1. WHEN in any Swap 2 phase, THE UI SHALL display current phase name and instructions
2. WHEN in "swap2_placement" phase, THE UI SHALL show stone count (e.g., "Place stone 1/3")
3. WHEN in "swap2_choice" phase, THE UI SHALL display 3 choice buttons for Player 2
4. WHEN in "swap2_extra" phase, THE UI SHALL show stone count (e.g., "Place stone 4/5")
5. WHEN in "swap2_final_choice" phase, THE UI SHALL display 2 choice buttons for Player 1
6. WHEN Swap 2 completes, THE UI SHALL show final color assignments before main game starts

### Requirement 6: Integration with Series System

**User Story:** As a ranked player, I want Swap 2 to work correctly within BO3 series, so that each game in the series is fair.

#### Acceptance Criteria

1. WHEN a new game starts in a Ranked series, THE SeriesManager SHALL initialize Swap 2 phase
2. WHEN Swap 2 completes in a series game, THE SeriesManager SHALL record the final color assignments
3. WHEN preparing next game in series, THE SeriesManager SHALL reset to Swap 2 phase (not just swap sides)
4. WHEN a series game ends, THE System SHALL preserve Swap 2 history for that game
5. IF a player disconnects during Swap 2 phase, THEN THE DisconnectHandler SHALL apply appropriate timeout rules

### Requirement 7: State Persistence

**User Story:** As a player, I want Swap 2 state to be saved, so that I can resume if disconnected.

#### Acceptance Criteria

1. WHEN any Swap 2 action occurs, THE GameEngine SHALL persist the current phase and stone positions
2. WHEN a player reconnects during Swap 2, THE GameEngine SHALL restore the exact phase and state
3. WHEN Swap 2 completes, THE GameEngine SHALL store the opening sequence in match history
4. IF server restarts during Swap 2, THEN THE System SHALL recover state from persistent storage
5. WHEN viewing match replay, THE System SHALL show Swap 2 phase moves distinctly

### Requirement 8: Validation and Error Handling

**User Story:** As a player, I want the system to prevent invalid actions during Swap 2, so that the game proceeds correctly.

#### Acceptance Criteria

1. IF a player attempts an action not valid for current phase, THEN THE GameEngine SHALL reject with clear error message
2. IF wrong player attempts to act during Swap 2, THEN THE GameEngine SHALL reject and indicate whose turn it is
3. IF color selection receives invalid option, THEN THE GameEngine SHALL reject and show valid options
4. WHEN timeout occurs during Swap 2, THE GameEngine SHALL apply default action (random choice or forfeit based on config)
5. IF Swap 2 state becomes corrupted, THEN THE GameEngine SHALL log error and attempt recovery or restart phase
