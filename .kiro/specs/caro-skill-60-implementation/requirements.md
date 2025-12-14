# Requirements Document

## Introduction

Hệ thống Caro Skill 60 là phiên bản hoàn chỉnh của skill system cho game Caro, bao gồm đúng 60 skill được phân loại theo độ hiếm (31 Thường, 22 Hiếm, 7 Cực Hiếm). Hệ thống tích hợp cơ chế Mana, Deck 15 lá, Random 3 skill/lượt, Ngũ Hành khắc chế, và các hiệu ứng Buff/Debuff phức tạp.

## Glossary

- **Skill**: Kỹ năng chiến thuật có thể sử dụng trong trận đấu
- **Mana**: Năng lượng cần thiết để sử dụng skill (khởi đầu 5, hồi +3/lượt, tối đa 15)
- **Deck**: Bộ 15 skill người chơi chọn trước trận (tối thiểu 10 lá thường, tối đa 3 lá cực hiếm, tối đa 5 lá hiếm)
- **Hand**: 3 skill random từ deck hiển thị mỗi lượt
- **Ngũ Hành**: Hệ thống 5 nguyên tố (Kim, Mộc, Thủy, Hỏa, Thổ) với cơ chế khắc chế
- **Lan Tỏa**: Hiệu ứng lan sang quân liền kề mỗi lượt (5 skill hệ ngũ hành)
- **Giải Hệ**: Skill xóa hiệu ứng của hệ bị khắc (5 skill counter)
- **Buff**: Hiệu ứng tăng cường sức mạnh
- **Debuff**: Hiệu ứng giảm sức mạnh đối thủ
- **Cooldown (CD)**: Số lượt skill không thể xuất hiện sau khi sử dụng
- **Rarity**: Độ hiếm (Common 70%, Rare 25%, Ultra Rare 5%)
- **Cố Định**: Trạng thái khóa quân không thể di chuyển
- **Block**: Ô bị khóa vĩnh viễn không thể đặt quân
- **Giữ Bài**: Chi phí mana để giữ lại skill qua lượt sau (Thường: 1, Hiếm: 2, Cực Hiếm: 3)

## Requirements

### Requirement 1: Mana System

**User Story:** As a player, I want to manage mana resources, so that I can strategically use skills during the match.

#### Acceptance Criteria

1. WHEN a match starts THEN the Skill_System SHALL initialize player mana to 5
2. WHEN a player's turn ends THEN the Skill_System SHALL add 3 mana to that player's total
3. WHILE a player's mana exceeds 15 THEN the Skill_System SHALL cap the mana at 15
4. WHEN a player uses a skill THEN the Skill_System SHALL deduct the skill's mana cost from the player's total
5. IF a player attempts to use a skill with insufficient mana THEN the Skill_System SHALL reject the action and display an error message

### Requirement 2: Deck Building System (15 Cards)

**User Story:** As a player, I want to build a custom deck of 15 skills with rarity constraints, so that I can create balanced playstyles.

#### Acceptance Criteria

1. WHEN a player opens the deck builder THEN the Skill_System SHALL display all 60 available skills with filtering options
2. WHEN a player selects skills for their deck THEN the Skill_System SHALL enforce exactly 15 skills
3. WHEN validating deck THEN the Skill_System SHALL require minimum 10 Common skills
4. WHEN validating deck THEN the Skill_System SHALL allow maximum 5 optional slots (Rare or Ultra Rare)
5. WHEN validating deck THEN the Skill_System SHALL allow maximum 3 Ultra Rare skills in optional slots
6. WHEN a player saves their deck THEN the Skill_System SHALL validate and persist the deck configuration
7. WHEN displaying skills THEN the Skill_System SHALL show skill name, mana cost, description, rarity, element type, and cooldown

### Requirement 3: In-Game Skill Random (3 Cards/Turn)

**User Story:** As a player, I want to receive 3 random skills each turn from my deck, so that I can choose which skill to use.

#### Acceptance Criteria

1. WHEN a player's turn begins THEN the Skill_System SHALL randomly select 3 skills from the player's 15-skill deck
2. WHEN selecting skills THEN the Skill_System SHALL exclude skills currently on cooldown
3. WHEN displaying skill options THEN the Skill_System SHALL show skill details including mana cost, effect description, and cooldown
4. WHEN a player selects a skill THEN the Skill_System SHALL execute the skill effect and deduct mana
5. WHEN a player skips skill usage THEN the Skill_System SHALL proceed to the move phase without mana deduction
6. WHEN a turn ends THEN the Skill_System SHALL replace all 3 skill options with new random selections

### Requirement 4: Card Retention System

**User Story:** As a player, I want to keep some cards for next turn by paying mana, so that I can plan ahead.

#### Acceptance Criteria

1. WHEN a player chooses to retain a Common skill THEN the Skill_System SHALL deduct 1 mana
2. WHEN a player chooses to retain a Rare skill THEN the Skill_System SHALL deduct 2 mana
3. WHEN a player chooses to retain an Ultra Rare skill THEN the Skill_System SHALL deduct 3 mana
4. WHEN a player retains skills THEN the Skill_System SHALL keep those skills in hand for next turn
5. IF a player has insufficient mana for retention THEN the Skill_System SHALL reject the retention request

### Requirement 5: Turn Flow with Skills

**User Story:** As a player, I want flexible turn order for skill and move actions, so that I can execute tactical combinations.

#### Acceptance Criteria

1. WHEN a player's turn begins THEN the Skill_System SHALL allow either skill usage or stone placement first
2. WHEN a player uses a skill before placing a stone THEN the Skill_System SHALL apply the skill effect immediately
3. WHEN a player places a stone before using a skill THEN the Skill_System SHALL allow skill usage after placement
4. WHEN both actions are completed THEN the Skill_System SHALL allow player to choose retention or end turn
5. WHEN player confirms end turn THEN the Skill_System SHALL end the turn and transfer control to opponent



### Requirement 6: Common Skills Implementation (31 Skills)

**User Story:** As a player, I want to use 31 Common skills with various effects, so that I have basic tactical options.

#### Acceptance Criteria

1. WHEN a player uses Sấm Sét (ID 1, 4 mana, CD 3) THEN the Skill_System SHALL destroy one opponent stone and make the cell empty
2. WHEN a player uses Lưỡi Dao Gió (ID 2, 6 mana, CD 2) THEN the Skill_System SHALL randomly select a line and destroy all pieces on it
3. WHEN a player uses Địa Chấn (ID 3, 6 mana, CD 3) THEN the Skill_System SHALL permanently block one cell from any interaction
4. WHEN a player uses Lốc Xoáy (ID 4, 6 mana, CD 5) THEN the Skill_System SHALL randomly move pieces in 3x3 area to empty positions
5. WHEN a player uses Nguyên Tố Lửa (ID 5, 4 mana, CD 3) THEN the Skill_System SHALL burn 3x3 area for 3 turns preventing placement

### Requirement 7: Common Skills - Movement & Utility (Skills 6-15)

**User Story:** As a player, I want movement and utility skills, so that I can manipulate board state.

#### Acceptance Criteria

1. WHEN a player uses Thủy Chấn (ID 6, 5 mana, CD 5) THEN the Skill_System SHALL push one piece in direction with chain effect
2. WHEN a player uses Phong Cước (ID 7, 3 mana, CD 5) THEN the Skill_System SHALL teleport one piece to any empty cell
3. WHEN a player uses Nguyên Kết (ID 8, 5 mana, CD 3) THEN the Skill_System SHALL make one enemy piece disappear for 3 turns
4. WHEN a player uses Hồi Quy (ID 9, 2 mana, CD 5) THEN the Skill_System SHALL reduce all skill cooldowns by half
5. WHEN a player uses Hồi Không (ID 10, 0 mana, CD 3) THEN the Skill_System SHALL restore mana to 15 and remove one card from deck

### Requirement 8: Common Skills - Defense (Skills 11-20)

**User Story:** As a player, I want defense skills to protect my formations, so that I can maintain board control.

#### Acceptance Criteria

1. WHEN a player uses Nguyên Vệ (ID 11, 5 mana, CD 5) THEN the Skill_System SHALL make 3x3 area immune to effects for 3 turns
2. WHEN a player uses Thiên Mệnh (ID 12, 6 mana, CD 1) THEN the Skill_System SHALL nullify next enemy attack skill
3. WHEN a player uses Bảo Hộ (ID 13, 10 mana, once per game) THEN the Skill_System SHALL permanently protect one cell
4. WHEN a player uses Hồi Nguyên (ID 14, 5 mana, CD 2) THEN the Skill_System SHALL restore one destroyed piece from last 3 turns
5. WHEN a player uses Nguyên Tĩnh (ID 15, 8 mana, CD 5) THEN the Skill_System SHALL prevent all skill usage for 2 turns

### Requirement 9: Common Skills - Advanced (Skills 16-31)

**User Story:** As a player, I want advanced common skills for complex strategies, so that I can execute sophisticated plays.

#### Acceptance Criteria

1. WHEN a player uses Kim Cương (ID 16, 6 mana, CD 5) THEN the Skill_System SHALL let both players protect one piece for 5 turns
2. WHEN a player uses Tường Nguyên (ID 17, 6 mana, CD 5) THEN the Skill_System SHALL protect adjacent line of 2-5 pieces for 2 turns
3. WHEN a player uses Hồn Lực (ID 19, 4 mana, CD 3) THEN the Skill_System SHALL double next skill parameters
4. WHEN a player uses Lưu Chuyển (ID 26, 4 mana, CD 3) THEN the Skill_System SHALL swap positions of one player and one enemy piece
5. WHEN a player uses Hồn Liên (ID 31, 3 mana, CD 5) THEN the Skill_System SHALL create fake piece that disappears after 5 turns

### Requirement 10: Rare Skills - Ngũ Hành Lan Tỏa (Skills 36-40)

**User Story:** As a player, I want elemental spread skills, so that I can create powerful area effects over time.

#### Acceptance Criteria

1. WHEN a player uses Hỏa Hồn (ID 36, 8 mana, CD 5) THEN the Skill_System SHALL start fire spread on enemy piece, spreading 1/turn for 5 turns
2. WHEN a player uses Băng Dịch (ID 37, 8 mana, CD 5) THEN the Skill_System SHALL start ice spread on enemy piece, spreading 1/turn for 5 turns
3. WHEN a player uses Mộc Sinh (ID 38, 8 mana, CD 5) THEN the Skill_System SHALL start root spread on enemy piece, spreading 1/turn for 5 turns
4. WHEN a player uses Thổ Hóa (ID 39, 8 mana, CD 5) THEN the Skill_System SHALL start stone spread on enemy piece, spreading 1/turn for 5 turns
5. WHEN a player uses Kim Sát (ID 40, 8 mana, CD 5) THEN the Skill_System SHALL start rust spread on enemy piece, spreading 1/turn for 5 turns

### Requirement 11: Rare Skills - Ngũ Hành Giải Hệ (Skills 41-45)

**User Story:** As a player, I want counter-element skills, so that I can neutralize enemy elemental effects.

#### Acceptance Criteria

1. WHEN a player uses Hỏa Nguyên (ID 41, 8 mana) THEN the Skill_System SHALL remove all Metal effects in 3x3 area from last 5 turns
2. WHEN a player uses Thủy Nguyên (ID 42, 8 mana, CD 5) THEN the Skill_System SHALL remove all Fire effects in 3x3 area from last 5 turns
3. WHEN a player uses Mộc Nguyên (ID 43, 7 mana, CD 5) THEN the Skill_System SHALL remove all Earth effects in 3x3 area from last 5 turns
4. WHEN a player uses Thổ Nguyên (ID 44, 7 mana, CD 5) THEN the Skill_System SHALL remove all Water effects in 3x3 area from last 5 turns
5. WHEN a player uses Kim Nguyên (ID 45, 7 mana, CD 5) THEN the Skill_System SHALL remove all Wood effects in 3x3 area from last 5 turns

### Requirement 12: Rare Skills - Advanced (Skills 32-35, 46-53)

**User Story:** As a player, I want advanced rare skills for game-changing plays, so that I can turn the tide of battle.

#### Acceptance Criteria

1. WHEN a player uses Linh Ngọc (ID 32, 5 mana, CD 5) THEN the Skill_System SHALL grant an extra turn immediately
2. WHEN a player uses Nguyên Quyết (ID 33, 5 mana, CD 3) THEN the Skill_System SHALL permanently remove one enemy deck skill (sacrifice same rarity)
3. WHEN a player uses Khí Hồn (ID 46, 10 mana, CD 5) THEN the Skill_System SHALL randomly execute any skill effect (50% common, 49% rare, 1% ultra rare)
4. WHEN a player uses Nguyên Hóa (ID 51, 10 mana, CD 3) THEN the Skill_System SHALL convert one isolated enemy piece to player's piece
5. WHEN a player uses Đạo Tặc (ID 53, 2 mana, CD 2) THEN the Skill_System SHALL steal and use one rare/ultra rare skill from enemy deck

### Requirement 13: Ultra Rare Skills (Skills 54-60)

**User Story:** As a player, I want powerful ultra rare skills, so that I can execute game-winning plays.

#### Acceptance Criteria

1. WHEN a player uses Lưỡng Nguyên (ID 54, 15 mana, once per game) THEN the Skill_System SHALL apply random 50/50 effect to all pieces on board
2. WHEN a player uses Hóa Giải (ID 55, 8 mana, once per game) THEN the Skill_System SHALL remove all effects from entire board
3. WHEN a player uses Khai Nguyên (ID 56, 8-15 mana, CD 5) THEN the Skill_System SHALL reuse any previously used skill (sacrifice same rarity)
4. WHEN a player uses Nguyên Thần (ID 57, 15 mana, max 2 per game) THEN the Skill_System SHALL protect all player pieces for 5 turns
5. WHEN a player uses Nguyên Cầu (ID 59, 14 mana, CD 5) THEN the Skill_System SHALL reset 4x4 area to empty state
6. WHEN a player uses Nguyên Động (ID 60, 13 mana, once per game) THEN the Skill_System SHALL randomly move all pieces to adjacent cells

### Requirement 14: Ngũ Hành Counter System

**User Story:** As a player, I want elemental counter relationships, so that I can use strategic counters.

#### Acceptance Criteria

1. WHEN Hỏa (Fire) effect exists THEN the Skill_System SHALL allow Thủy Nguyên to neutralize it (Water counters Fire)
2. WHEN Thủy (Water) effect exists THEN the Skill_System SHALL allow Thổ Nguyên to neutralize it (Earth counters Water)
3. WHEN Mộc (Wood) effect exists THEN the Skill_System SHALL allow Kim Nguyên to neutralize it (Metal counters Wood)
4. WHEN Thổ (Earth) effect exists THEN the Skill_System SHALL allow Mộc Nguyên to neutralize it (Wood counters Earth)
5. WHEN Kim (Metal) effect exists THEN the Skill_System SHALL allow Hỏa Nguyên to neutralize it (Fire counters Metal)

### Requirement 15: Spread Effect Mechanics

**User Story:** As a player, I want spread effects to work consistently, so that I can predict their behavior.

#### Acceptance Criteria

1. WHEN a spread effect is applied THEN the Skill_System SHALL mark the initial target piece
2. WHEN a turn ends with active spread THEN the Skill_System SHALL spread to one random adjacent piece
3. WHEN spread reaches 5 pieces THEN the Skill_System SHALL apply final effect based on element type
4. WHEN Hỏa spread completes THEN the Skill_System SHALL remove all 5 affected pieces
5. WHEN Thổ spread completes THEN the Skill_System SHALL convert all 5 affected cells to permanent blocks

### Requirement 16: Cooldown System

**User Story:** As a player, I want skills to have cooldowns, so that powerful skills cannot be spammed.

#### Acceptance Criteria

1. WHEN a skill is used THEN the Skill_System SHALL set its cooldown to the skill's CD value
2. WHEN a turn ends THEN the Skill_System SHALL decrement all active cooldowns by 1
3. WHEN a skill's cooldown reaches 0 THEN the Skill_System SHALL make it available for random selection
4. WHEN selecting random skills THEN the Skill_System SHALL exclude skills with cooldown > 0
5. WHEN Hồi Quy is used THEN the Skill_System SHALL reduce all cooldowns by half (rounded down)

### Requirement 17: Win Condition with Skills

**User Story:** As a player, I want clear win conditions when skills modify the board, so that victory is determined fairly.

#### Acceptance Criteria

1. WHEN a player creates 5 consecutive stones THEN the Skill_System SHALL declare that player as winner
2. IF a stone is converted by Nguyên Hóa creating 5-in-a-row THEN the Skill_System SHALL NOT declare immediate win (must wait next turn)
3. WHEN a frozen/affected stone is part of 5-in-a-row THEN the Skill_System SHALL count it toward win condition
4. WHEN a ghost stone (Hồn Liên) completes 5-in-a-row THEN the Skill_System SHALL count it as valid win
5. IF both players have no valid moves THEN the Skill_System SHALL declare a draw

### Requirement 18: Skill State Serialization

**User Story:** As a developer, I want skill states to be serializable, so that game state can be saved and restored.

#### Acceptance Criteria

1. WHEN serializing game state THEN the Skill_System SHALL include all active skill effects in JSON format
2. WHEN deserializing game state THEN the Skill_System SHALL restore all skill effects correctly
3. WHEN a match is saved THEN the Skill_System SHALL persist skill usage history and cooldowns
4. WHEN replaying a match THEN the Skill_System SHALL reproduce all skill effects accurately
5. WHEN serializing then deserializing skill state THEN the Skill_System SHALL produce equivalent state (round-trip)

### Requirement 19: Skill Package System

**User Story:** As a player, I want to obtain skills through packages, so that I can expand my skill collection.

#### Acceptance Criteria

1. WHEN a player opens Khai Xuân package (10000 Tinh Thạch) THEN the Skill_System SHALL give 5 cards with 80% common, 19.9% rare, 0.1% ultra rare
2. WHEN a player opens Khai Thiên package (1000 Nguyên Thần) THEN the Skill_System SHALL give 5 cards with 60% common, 35% rare, 5% ultra rare
3. WHEN a player opens Vô Cực package (5000 Nguyên Thần) THEN the Skill_System SHALL give 5 cards with 60% common, 30% rare, 10% ultra rare
4. WHEN a player receives a skill they already own THEN the Skill_System SHALL convert it to currency
5. WHEN displaying package contents THEN the Skill_System SHALL show all received skills with animations

### Requirement 20: Effect Duration and Tracking

**User Story:** As a player, I want to see remaining duration of active effects, so that I can plan my strategy.

#### Acceptance Criteria

1. WHEN a timed effect is applied THEN the Skill_System SHALL display remaining turns on affected cells
2. WHEN a turn ends THEN the Skill_System SHALL decrement all active effect durations by 1
3. WHEN an effect duration reaches 0 THEN the Skill_System SHALL remove the effect and restore normal state
4. WHEN multiple effects exist on one cell THEN the Skill_System SHALL display all effects with their durations
5. WHEN hovering over an affected cell THEN the Skill_System SHALL show detailed effect information
