# Requirements Document

## Introduction

Hệ thống Caro Skill là một tính năng gameplay nâng cao cho game Caro, cho phép người chơi sử dụng các skill chiến thuật trong trận đấu. Hệ thống bao gồm 70 skill được phân loại theo độ hiếm và nhóm chức năng, kết hợp với cơ chế Mana, Ngũ Hành khắc chế, và hệ thống Buff/Debuff.

## Glossary

- **Skill**: Kỹ năng chiến thuật có thể sử dụng trong trận đấu
- **Mana**: Năng lượng cần thiết để sử dụng skill (khởi đầu 5, hồi +3/lượt, tối đa 15)
- **Deck**: Bộ 20 skill người chơi chọn trước trận từ pool 70 skill
- **Ngũ Hành**: Hệ thống 5 nguyên tố (Kim, Mộc, Thủy, Hỏa, Thổ) với cơ chế khắc chế
- **Buff**: Hiệu ứng tăng cường sức mạnh
- **Debuff**: Hiệu ứng giảm sức mạnh đối thủ
- **Cooldown**: Số lượt skill không thể xuất hiện sau khi sử dụng
- **Rarity**: Độ hiếm của skill (Common 60%, Rare 30%, Ultra Rare 10%)
- **Cố Định**: Trạng thái khóa quân không thể di chuyển
- **Hóa Giải**: Xóa hiệu ứng skill hệ bị khắc

## Requirements

### Requirement 1: Mana System

**User Story:** As a player, I want to manage mana resources, so that I can strategically use skills during the match.

#### Acceptance Criteria

1. WHEN a match starts THEN the Skill_System SHALL initialize player mana to 5
2. WHEN a player's turn ends THEN the Skill_System SHALL add 3 mana to that player's total
3. WHILE a player's mana exceeds 15 THEN the Skill_System SHALL cap the mana at 15
4. WHEN a player uses a skill THEN the Skill_System SHALL deduct the skill's mana cost from the player's total
5. IF a player attempts to use a skill with insufficient mana THEN the Skill_System SHALL reject the action and display an error message

### Requirement 2: Deck Building System

**User Story:** As a player, I want to build a custom deck of 20 skills, so that I can create my own playstyle.

#### Acceptance Criteria

1. WHEN a player opens the deck builder THEN the Skill_System SHALL display all 70 available skills with filtering options
2. WHEN a player selects skills for their deck THEN the Skill_System SHALL enforce a maximum of 20 skills
3. WHEN a player saves their deck THEN the Skill_System SHALL validate and persist the deck configuration
4. WHEN a player has multiple deck presets THEN the Skill_System SHALL allow switching between up to 3 saved presets
5. WHEN displaying skills THEN the Skill_System SHALL show skill name, mana cost, description, rarity, and element type

### Requirement 3: In-Game Skill Random

**User Story:** As a player, I want to receive 3 random skills each turn from my deck, so that I can choose which skill to use.

#### Acceptance Criteria

1. WHEN a player's turn begins THEN the Skill_System SHALL randomly select 3 skills from the player's 20-skill deck
2. WHEN displaying skill options THEN the Skill_System SHALL show skill details including mana cost and effect description
3. WHEN a player selects a skill THEN the Skill_System SHALL execute the skill effect and deduct mana
4. WHEN a player skips skill usage THEN the Skill_System SHALL proceed to the move phase without mana deduction
5. WHEN a turn ends THEN the Skill_System SHALL replace all 3 skill options with new random selections

### Requirement 4: Turn Flow with Skills

**User Story:** As a player, I want flexible turn order for skill and move actions, so that I can execute tactical combinations.

#### Acceptance Criteria

1. WHEN a player's turn begins THEN the Skill_System SHALL allow either skill usage or stone placement first
2. WHEN a player uses a skill before placing a stone THEN the Skill_System SHALL apply the skill effect immediately
3. WHEN a player places a stone before using a skill THEN the Skill_System SHALL allow skill usage after placement
4. WHEN both actions are completed THEN the Skill_System SHALL end the turn and transfer control to opponent
5. IF a player has no valid moves THEN the Skill_System SHALL declare the opponent as winner

### Requirement 5: Attack Skills (25 Skills)

**User Story:** As a player, I want to use attack skills to disrupt opponent's formations, so that I can gain tactical advantage.

#### Acceptance Criteria

1. WHEN a player uses Sấm Sét (4 mana) THEN the Skill_System SHALL destroy one opponent stone and make the cell empty
2. WHEN a player uses Nguyên Tố Lửa (4 mana) THEN the Skill_System SHALL burn a 3x3 area for 3 turns preventing stone placement
3. WHEN a player uses Thủy Chấn (5 mana) THEN the Skill_System SHALL push one opponent stone in a direction along with all stones behind it
4. WHEN a player uses Địa Chấn (6 mana) THEN the Skill_System SHALL permanently block one cell from any interaction
5. WHEN a player uses Lốc Xoáy (6 mana) THEN the Skill_System SHALL destroy up to 3 random stones in a 3x3 area

### Requirement 6: Defense Skills (27 Skills)

**User Story:** As a player, I want to use defense skills to protect my formations, so that I can maintain board control.

#### Acceptance Criteria

1. WHEN a player uses Bảo Hộ (10 mana) THEN the Skill_System SHALL protect one cell permanently from all effects
2. WHEN a player uses Nguyên Vệ (5 mana) THEN the Skill_System SHALL make all stones in a 3x3 area immune to effects for 3 turns
3. WHEN a player uses Hồi Nguyên (5 mana) THEN the Skill_System SHALL restore one destroyed stone from the last 3 turns
4. WHEN a player uses Nguyên Tĩnh (7 mana) THEN the Skill_System SHALL prevent opponent from using skills for 3 turns
5. WHEN a player uses Nguyên Thần (15 mana) THEN the Skill_System SHALL protect all player stones for 5 turns (limited to 2 uses per game)

### Requirement 7: Tactical Skills (18 Skills)

**User Story:** As a player, I want to use tactical skills for strategic manipulation, so that I can create winning opportunities.

#### Acceptance Criteria

1. WHEN a player uses Lưu Chuyển (4 mana) THEN the Skill_System SHALL swap positions of one player stone and one opponent stone
2. WHEN a player uses Nguyên Hóa (10 mana) THEN the Skill_System SHALL convert one isolated opponent stone to player's stone
3. WHEN a player uses Linh Ngọc (12 mana) THEN the Skill_System SHALL grant an extra turn immediately (5-turn cooldown)
4. WHEN a player uses Hợp Nhất (7 mana) THEN the Skill_System SHALL allow using 2 skills in the next turn
5. WHEN a player uses Nguyên Cầu (14 mana) THEN the Skill_System SHALL reset a 4x4 area to empty state

### Requirement 8: Ngũ Hành (Five Elements) System

**User Story:** As a player, I want skills to have elemental types with counter relationships, so that I can use strategic counters.

#### Acceptance Criteria

1. WHEN a Hỏa (Fire) skill effect exists THEN the Skill_System SHALL allow Thủy Thần to neutralize it in a 3x3 area
2. WHEN a Thủy (Water) skill effect exists THEN the Skill_System SHALL allow Hỏa Thần to neutralize it in a 3x3 area
3. WHEN a Mộc (Wood) skill effect exists THEN the Skill_System SHALL allow Thổ Thần to neutralize it in a 3x3 area
4. WHEN a Thổ (Earth) skill effect exists THEN the Skill_System SHALL allow Mộc Thần to neutralize it in a 3x3 area
5. WHEN a Kim (Metal) skill effect exists THEN the Skill_System SHALL allow Kim Thần to neutralize it in a 3x3 area

### Requirement 9: Buff System

**User Story:** As a player, I want to use buff skills to enhance my abilities, so that I can amplify my skill effects.

#### Acceptance Criteria

1. WHEN a player uses Nguyên Tâm (4 mana) THEN the Skill_System SHALL increase the next attack skill effect by 50%
2. WHEN a player uses Hồn Lực (4 mana) THEN the Skill_System SHALL double the parameters of the next skill
3. WHEN a player uses Tăng Cường (5 mana) THEN the Skill_System SHALL extend all active buffs by 1 turn
4. WHEN a buff is active THEN the Skill_System SHALL display a visual indicator on affected stones or player
5. WHEN a buff expires THEN the Skill_System SHALL remove the effect and update the display

### Requirement 10: Debuff System

**User Story:** As a player, I want to use debuff skills to weaken opponent, so that I can limit their options.

#### Acceptance Criteria

1. WHEN a player uses Băng Nguyên (4 mana) THEN the Skill_System SHALL freeze one opponent stone for 5 turns preventing win condition
2. WHEN a player uses Cố Định Quân (5 mana) THEN the Skill_System SHALL lock one stone from movement for 4 turns
3. WHEN a player uses Phong Ấn (7 mana) THEN the Skill_System SHALL prevent one opponent stone from receiving buffs for 3 turns
4. WHEN a debuff is active THEN the Skill_System SHALL display a visual indicator on affected stones
5. WHEN a player uses Thanh Tẩy (6 mana) THEN the Skill_System SHALL remove one debuff from player's stone

### Requirement 11: Buff/Debuff Counter System

**User Story:** As a player, I want to counter opponent's buffs and debuffs, so that I can neutralize their advantages.

#### Acceptance Criteria

1. WHEN a player uses Khử Buff I (4 mana) THEN the Skill_System SHALL remove all active buffs from both players
2. WHEN a player uses Khử Buff II (3 mana) THEN the Skill_System SHALL prevent all buffs for the next 3 turns
3. WHEN a player uses Khử Buff III (2 mana) THEN the Skill_System SHALL remove one specific buff
4. WHEN a player uses Giải Phóng (3 mana) THEN the Skill_System SHALL remove Cố Định status from one stone
5. WHEN a player uses Cưỡng Chế Di Chuyển (6 mana) THEN the Skill_System SHALL force move a Cố Định stone breaking the lock

### Requirement 12: Skill Rarity and Drop Rate

**User Story:** As a player, I want skills to have different rarities, so that powerful skills are appropriately rare.

#### Acceptance Criteria

1. WHEN randomly selecting skills THEN the Skill_System SHALL apply 60% chance for Common skills
2. WHEN randomly selecting skills THEN the Skill_System SHALL apply 30% chance for Rare skills
3. WHEN randomly selecting skills THEN the Skill_System SHALL apply 10% chance for Ultra Rare skills
4. WHEN displaying skills THEN the Skill_System SHALL show rarity with distinct visual styling
5. WHEN building a deck THEN the Skill_System SHALL allow any combination of rarities

### Requirement 13: Win Condition with Skills

**User Story:** As a player, I want clear win conditions when skills modify the board, so that victory is determined fairly.

#### Acceptance Criteria

1. WHEN a player creates 5 consecutive stones THEN the Skill_System SHALL declare that player as winner
2. IF a stone is converted by Nguyên Hóa creating 5-in-a-row THEN the Skill_System SHALL NOT declare immediate win (must wait next turn)
3. WHEN a frozen stone is part of 5-in-a-row THEN the Skill_System SHALL NOT count it toward win condition
4. WHEN a ghost stone (Hồn Liên) completes 5-in-a-row THEN the Skill_System SHALL count it as valid win
5. IF both players have no valid moves THEN the Skill_System SHALL declare a draw

### Requirement 14: Skill Effect Duration and Tracking

**User Story:** As a player, I want to see remaining duration of active effects, so that I can plan my strategy.

#### Acceptance Criteria

1. WHEN a timed effect is applied THEN the Skill_System SHALL display remaining turns on affected cells
2. WHEN a turn ends THEN the Skill_System SHALL decrement all active effect durations by 1
3. WHEN an effect duration reaches 0 THEN the Skill_System SHALL remove the effect and restore normal state
4. WHEN multiple effects exist on one cell THEN the Skill_System SHALL display all effects with their durations
5. WHEN hovering over an affected cell THEN the Skill_System SHALL show detailed effect information

### Requirement 15: Skill Serialization and Persistence

**User Story:** As a developer, I want skill states to be serializable, so that game state can be saved and restored.

#### Acceptance Criteria

1. WHEN serializing game state THEN the Skill_System SHALL include all active skill effects in JSON format
2. WHEN deserializing game state THEN the Skill_System SHALL restore all skill effects correctly
3. WHEN a match is saved THEN the Skill_System SHALL persist skill usage history
4. WHEN replaying a match THEN the Skill_System SHALL reproduce all skill effects accurately
5. WHEN serializing then deserializing skill state THEN the Skill_System SHALL produce equivalent state (round-trip)

