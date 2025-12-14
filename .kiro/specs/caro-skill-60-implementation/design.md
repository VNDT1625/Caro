# Caro Skill 60 Implementation - Design

## Overview

Hệ thống Caro Skill 60 là module gameplay hoàn chỉnh cho phép người chơi sử dụng 60 skill chiến thuật trong trận đấu. Hệ thống bao gồm:
- Mana system (5 khởi đầu, +3/lượt, max 15)
- Deck building (chọn 15 từ 60 skill với ràng buộc độ hiếm)
- In-game random (3 skill/lượt từ deck, trừ skill đang cooldown)
- Card retention (giữ bài qua lượt với chi phí mana)
- Ngũ Hành counter system (5 hệ khắc chế)
- Spread effect mechanics (lan tỏa 5 lượt)
- Buff/Debuff mechanics
- Skill effect engine với 60 effect types

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (React)                            │
├─────────────────────────────────────────────────────────────────┤
│  SkillDeckBuilder   │  InGameSkillPanel  │  SkillEffectRenderer │
│  - 60 skill pool    │  - 3 skill cards   │  - Effect animations │
│  - 15 card deck     │  - Mana display    │  - Duration overlay  │
│  - Rarity limits    │  - Use/Skip/Retain │  - Element indicators│
│  - Preset manager   │  - Cooldown display│  - Spread visualizer │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Socket.IO Server                              │
│  - skill_options (3 skills per turn)                             │
│  - skill_use (execute skill)                                     │
│  - skill_effect (broadcast result)                               │
│  - skill_retain (keep cards)                                     │
│  - mana_update (sync mana state)                                 │
│  - spread_tick (spread effect progress)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend Services (PHP)                        │
├─────────────────────────────────────────────────────────────────┤
│  SkillEngine60Service   │  ManaService      │  EffectTracker    │
│  - Execute 60 skills    │  - Init/Add/Cap   │  - Duration mgmt  │
│  - Validate conditions  │  - Deduct cost    │  - Effect stacking│
│  - Apply board changes  │  - Check balance  │  - Spread logic   │
├─────────────────────────────────────────────────────────────────┤
│  DeckService            │  ElementService   │  CooldownService  │
│  - Save/Load decks      │  - Ngũ Hành logic │  - Track cooldowns│
│  - Validate 15 skills   │  - Counter system │  - Reduce/Reset   │
│  - Rarity constraints   │  - Spread effects │  - Per-skill CD   │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### SkillEngine60ServiceInterface

```php
interface SkillEngine60ServiceInterface {
    public function executeSkill(
        string $matchId,
        string $playerId,
        int $skillId,
        ?array $targetPosition,
        array $currentBoard,
        array $context
    ): SkillEffectResult;
    
    public function canUseSkill(
        int $skillId,
        int $currentMana,
        array $activeEffects,
        array $board,
        array $cooldowns
    ): ValidationResult;
    
    public function getRandomSkills(
        array $deckSkillIds,
        array $cooldowns,
        array $retainedSkills,
        string $matchSeed,
        int $turnNumber
    ): array;
    
    public function processSpreadEffects(
        string $matchId,
        array $activeSpreadEffects,
        array $board
    ): SpreadTickResult;
}
```

### ManaServiceInterface

```php
interface ManaServiceInterface {
    public function initializeMana(): int; // Returns 5
    public function addTurnMana(int $current): int; // +3, cap 15
    public function deductMana(int $current, int $cost): int;
    public function canAfford(int $current, int $cost): bool;
    public function getRetentionCost(string $rarity): int; // common:1, rare:2, ultra_rare:3
}
```

### ElementServiceInterface

```php
interface ElementServiceInterface {
    public function getCounterElement(string $element): string;
    public function canNeutralize(string $counterElement, string $targetElement): bool;
    public function neutralizeEffects(
        string $counterElement,
        array $position,
        int $radius,
        array $activeEffects,
        int $turnLimit
    ): array;
    public function processSpreadTick(
        array $spreadEffect,
        array $board
    ): SpreadTickResult;
}
```

### CooldownServiceInterface

```php
interface CooldownServiceInterface {
    public function setCooldown(string $matchId, string visitorId, int $skillId, int $turns): void;
    public function decrementAllCooldowns(string $matchId, string $playerId): void;
    public function getCooldowns(string $matchId, string $playerId): array;
    public function reduceCooldownsByHalf(string $matchId, string $playerId): void;
    public function resetCooldown(string $matchId, string $playerId, int $skillId): void;
}
```

## Data Models

### Skill (60 skills)
```typescript
interface Skill {
  id: number; // 1-60
  skill_code: string; // SKL_001 - SKL_060
  name_vi: string;
  name_en: string;
  description_vi: string;
  description_en: string;
  category: 'attack' | 'defense' | 'utility' | 'special';
  rarity: 'common' | 'rare' | 'ultra_rare';
  element: 'kim' | 'moc' | 'thuy' | 'hoa' | 'tho' | 'phep' | 'loi';
  effect_type: string;
  effect_params: Record<string, any>;
  cooldown: number;
  mana_cost: number;
  is_once_per_game: boolean;
  max_uses_per_game?: number;
}
```

### PlayerDeck (15 cards)
```typescript
interface PlayerDeck {
  id: string;
  user_id: string;
  preset_name: string;
  preset_slot: number; // 1-3
  skill_ids: number[]; // exactly 15
  common_count: number; // >= 10
  rare_count: number; // <= 5
  ultra_rare_count: number; // <= 3
  is_active: boolean;
}
```

### MatchSkillState
```typescript
interface MatchSkillState {
  match_id: string;
  player1_mana: number;
  player2_mana: number;
  player1_cooldowns: Record<number, number>; // skillId -> turnsRemaining
  player2_cooldowns: Record<number, number>;
  player1_retained: number[]; // skillIds kept for next turn
  player2_retained: number[];
  player1_once_used: number[]; // once-per-game skills used
  player2_once_used: number[];
  active_effects: SkillEffect[];
  spread_effects: SpreadEffect[];
  turn_number: number;
}
```

### SpreadEffect
```typescript
interface SpreadEffect {
  id: string;
  element: 'hoa' | 'thuy' | 'moc' | 'tho' | 'kim';
  source_skill_id: number;
  affected_positions: Array<{x: number, y: number}>;
  turns_remaining: number; // starts at 5
  owner_player_id: string;
  final_effect: 'destroy' | 'block' | 'immobilize' | 'silence';
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Mana Initialization
*For any* new match, both players' mana SHALL be initialized to exactly 5.
**Validates: Requirements 1.1**

### Property 2: Mana Regeneration
*For any* turn end, the active player's mana SHALL increase by exactly 3.
**Validates: Requirements 1.2**

### Property 3: Mana Cap Invariant
*For any* game state, no player's mana SHALL exceed 15.
**Validates: Requirements 1.3**

### Property 4: Mana Deduction
*For any* skill usage, the player's mana SHALL decrease by exactly the skill's mana cost.
**Validates: Requirements 1.4**

### Property 5: Insufficient Mana Rejection
*For any* skill usage attempt where player mana is less than skill cost, the system SHALL reject the action.
**Validates: Requirements 1.5**

### Property 6: Deck Size Constraint
*For any* saved deck, the number of skills SHALL be exactly 15.
**Validates: Requirements 2.2**

### Property 7: Deck Common Minimum
*For any* valid deck, the number of Common skills SHALL be at least 10.
**Validates: Requirements 2.3**

### Property 8: Deck Ultra Rare Maximum
*For any* valid deck, the number of Ultra Rare skills SHALL be at most 3.
**Validates: Requirements 2.5**

### Property 9: Deck Persistence Round-Trip
*For any* valid deck, saving then loading SHALL produce an equivalent deck.
**Validates: Requirements 2.6**

### Property 10: Turn Skill Selection Count
*For any* turn start, exactly 3 skills SHALL be selected from the player's deck.
**Validates: Requirements 3.1**

### Property 11: Cooldown Exclusion
*For any* skill selection, skills with cooldown > 0 SHALL NOT be included.
**Validates: Requirements 3.2**

### Property 12: Skip Preserves Mana
*For any* skill skip action, the player's mana SHALL remain unchanged.
**Validates: Requirements 3.5**

### Property 13: Retention Cost - Common
*For any* Common skill retention, exactly 1 mana SHALL be deducted.
**Validates: Requirements 4.1**

### Property 14: Retention Cost - Rare
*For any* Rare skill retention, exactly 2 mana SHALL be deducted.
**Validates: Requirements 4.2**

### Property 15: Retention Cost - Ultra Rare
*For any* Ultra Rare skill retention, exactly 3 mana SHALL be deducted.
**Validates: Requirements 4.3**

### Property 16: Turn Order Flexibility
*For any* turn, both orderings (skill-then-move and move-then-skill) SHALL be valid.
**Validates: Requirements 5.1, 5.2, 5.3**

### Property 17: Sấm Sét Effect
*For any* Sấm Sét usage on a valid target, the target stone SHALL be removed and cell SHALL become empty.
**Validates: Requirements 6.1**

### Property 18: Địa Chấn Permanence
*For any* Địa Chấn usage, the blocked cell SHALL resist all subsequent effects permanently.
**Validates: Requirements 6.3**

### Property 19: Spread Effect Initialization
*For any* spread skill usage, exactly 1 piece SHALL be marked as initial target.
**Validates: Requirements 15.1**

### Property 20: Spread Effect Progression
*For any* turn end with active spread, exactly 1 adjacent piece SHALL be added to spread.
**Validates: Requirements 15.2**

### Property 21: Spread Effect Completion
*For any* spread reaching 5 pieces, the final effect SHALL be applied to all 5 pieces.
**Validates: Requirements 15.3**

### Property 22: Element Counter - Fire vs Metal
*For any* active Kim effect, using Hỏa Nguyên in the same area SHALL neutralize the Kim effect.
**Validates: Requirements 14.5**

### Property 23: Element Counter - Water vs Fire
*For any* active Hỏa effect, using Thủy Nguyên in the same area SHALL neutralize the Hỏa effect.
**Validates: Requirements 14.1**

### Property 24: Cooldown Decrement
*For any* turn end, all active cooldowns SHALL decrease by 1.
**Validates: Requirements 16.2**

### Property 25: Cooldown Zero Availability
*For any* skill with cooldown reaching 0, it SHALL become available for random selection.
**Validates: Requirements 16.3**

### Property 26: Nguyên Thần Usage Limit
*For any* match, Nguyên Thần SHALL be usable at most 2 times per player.
**Validates: Requirements 13.4**

### Property 27: Once Per Game Enforcement
*For any* once-per-game skill, it SHALL be usable exactly once per match.
**Validates: Requirements 13.1, 13.2**

### Property 28: Win Condition
*For any* board state with 5 consecutive non-blocked player stones, that player SHALL be declared winner.
**Validates: Requirements 17.1**

### Property 29: Nguyên Hóa Delayed Win
*For any* Nguyên Hóa that creates 5-in-a-row, the win SHALL NOT be declared until the next turn.
**Validates: Requirements 17.2**

### Property 30: State Serialization Round-Trip
*For any* valid game state, serializing then deserializing SHALL produce an equivalent state.
**Validates: Requirements 18.5**

## Error Handling

### Mana Errors
- `INSUFFICIENT_MANA`: Player doesn't have enough mana for skill
- `MANA_OVERFLOW`: Attempted to exceed max mana (15)

### Skill Errors
- `INVALID_SKILL`: Skill ID not found (must be 1-60)
- `SKILL_ON_COOLDOWN`: Skill is still on cooldown
- `INVALID_TARGET`: Target position is invalid for this skill
- `SKILL_BLOCKED`: Player is affected by Nguyên Tĩnh (silence)
- `ONCE_PER_GAME_USED`: Skill already used this game
- `MAX_USES_EXCEEDED`: Skill usage limit reached (e.g., Nguyên Thần max 2)

### Deck Errors
- `DECK_SIZE_INVALID`: Not exactly 15 skills
- `COMMON_MINIMUM_NOT_MET`: Less than 10 Common skills
- `ULTRA_RARE_EXCEEDED`: More than 3 Ultra Rare skills
- `RARE_EXCEEDED`: More than 5 Rare skills in optional slots
- `PRESET_LIMIT_EXCEEDED`: More than 3 presets

### Element Errors
- `INVALID_COUNTER`: Counter element doesn't match target element
- `NO_EFFECT_TO_COUNTER`: No matching element effect in area

## Testing Strategy

### Property-Based Testing Library
- PHP: Eris (giorgiosironi/eris)
- TypeScript: fast-check

### Unit Tests
- ManaService: init, add, deduct, cap, retention costs
- ElementService: counter relationships, spread mechanics
- CooldownService: set, decrement, reduce, reset
- DeckService: validate constraints, save/load

### Property-Based Tests
Each correctness property above will have a corresponding property-based test:
- Minimum 100 iterations per property
- Seeded random for reproducibility
- Tag format: `**Feature: caro-skill-60, Property {N}: {description}**`

### Integration Tests
- Full turn flow with skill usage
- Spread effect over multiple turns
- Counter skill interactions
- Win condition with skill effects
