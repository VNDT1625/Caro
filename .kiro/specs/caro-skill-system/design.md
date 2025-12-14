# Caro Skill System - Design

## Overview

Hệ thống Caro Skill là một module gameplay phức tạp cho phép người chơi sử dụng 70 skill chiến thuật trong trận đấu. Hệ thống bao gồm:
- Mana system (5 khởi đầu, +3/lượt, max 15)
- Deck building (chọn 20 từ 70 skill)
- In-game random (3 skill/lượt từ deck)
- Ngũ Hành counter system
- Buff/Debuff mechanics
- Skill effect engine

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (React)                            │
├─────────────────────────────────────────────────────────────────┤
│  SkillComboBuilder  │  InGameSkillPanel  │  SkillEffectRenderer │
│  - 70 skill pool    │  - 3 skill cards   │  - Effect animations │
│  - Deck validation  │  - Mana display    │  - Duration overlay  │
│  - Preset manager   │  - Use/Skip/Order  │  - Element indicators│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Socket.IO Server                              │
│  - skill_options (3 skills per turn)                             │
│  - skill_use (execute skill)                                     │
│  - skill_effect (broadcast result)                               │
│  - mana_update (sync mana state)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend Services (PHP)                        │
├─────────────────────────────────────────────────────────────────┤
│  SkillEngineService     │  ManaService      │  EffectTracker    │
│  - Execute 70 skills    │  - Init/Add/Cap   │  - Duration mgmt  │
│  - Validate conditions  │  - Deduct cost    │  - Effect stacking│
│  - Apply board changes  │  - Check balance  │  - Expiration     │
├─────────────────────────────────────────────────────────────────┤
│  DeckService            │  ElementService   │  BuffDebuffService│
│  - Save/Load decks      │  - Ngũ Hành logic │  - Apply buffs    │
│  - Validate 20 skills   │  - Counter system │  - Apply debuffs  │
│  - Preset management    │  - Neutralization │  - Counter logic  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### SkillEngineService

```php
interface SkillEngineServiceInterface {
    public function executeSkill(
        string $matchId,
        string $playerId,
        string $skillId,
        ?array $targetPosition,
        array $currentBoard
    ): SkillExecutionResult;
    
    public function canUseSkill(
        string $skillId,
        int $currentMana,
        array $activeEffects,
        array $board
    ): ValidationResult;
    
    public function getRandomSkills(
        array $deckSkillIds,
        array $cooldownSkillIds,
        string $matchSeed,
        int $turnNumber
    ): array;
}
```

### ManaService

```php
interface ManaServiceInterface {
    public function initializeMana(): int;
    public function addTurnMana(int $current): int;
    public function deductMana(int $current, int $cost): int;
    public function canAfford(int $current, int $cost): bool;
}
```

### ElementService

```php
interface ElementServiceInterface {
    public function canNeutralize(string $skillElement, string $effectElement): bool;
    public function getCounterElement(string $element): string;
    public function neutralizeEffects(
        string $neutralizerElement,
        array $position,
        int $radius,
        array $activeEffects
    ): array;
}
```

## Data Models

### Skill
```typescript
interface Skill {
  id: string;
  code: string;
  name_vi: string;
  mana_cost: number;
  category: 'attack' | 'defense' | 'tactical';
  rarity: 'common' | 'rare' | 'ultra_rare';
  element: 'kim' | 'moc' | 'thuy' | 'hoa' | 'tho' | 'neutral';
  effect_type: string;
  effect_params: Record<string, any>;
  cooldown: number;
}
```

### SkillEffect
```typescript
interface SkillEffect {
  id: string;
  skill_id: string;
  match_id: string;
  player_id: string;
  effect_type: string;
  target_position?: { x: number; y: number };
  duration_remaining: number;
  params: Record<string, any>;
}
```

### PlayerDeck
```typescript
interface PlayerDeck {
  id: string;
  user_id: string;
  preset_name: string;
  preset_slot: number;
  skill_ids: string[];
  is_active: boolean;
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
*For any* saved deck, the number of skills SHALL be exactly 20.
**Validates: Requirements 2.2**

### Property 7: Deck Persistence Round-Trip
*For any* valid deck, saving then loading SHALL produce an equivalent deck.
**Validates: Requirements 2.3**

### Property 8: Turn Skill Selection
*For any* turn start, exactly 3 skills SHALL be selected from the player's deck.
**Validates: Requirements 3.1**

### Property 9: Skip Preserves Mana
*For any* skill skip action, the player's mana SHALL remain unchanged.
**Validates: Requirements 3.4**

### Property 10: Turn Order Flexibility
*For any* turn, both orderings (skill-then-move and move-then-skill) SHALL be valid.
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 11: Sấm Sét Effect
*For any* Sấm Sét usage on a valid target, the target stone SHALL be removed and cell SHALL become empty.
**Validates: Requirements 5.1**

### Property 12: Bảo Hộ Permanence
*For any* Bảo Hộ usage, the protected cell SHALL resist all subsequent effects permanently.
**Validates: Requirements 6.1**

### Property 13: Nguyên Thần Usage Limit
*For any* match, Nguyên Thần SHALL be usable at most 2 times per player.
**Validates: Requirements 6.5**

### Property 14: Element Counter - Fire vs Water
*For any* active Hỏa effect, using Thủy Thần in the same area SHALL neutralize the Hỏa effect.
**Validates: Requirements 8.1**

### Property 15: Buff Extension
*For any* Tăng Cường usage, all active buff durations SHALL increase by 1.
**Validates: Requirements 9.3**

### Property 16: Buff Expiration
*For any* buff with duration reaching 0, the buff effect SHALL be removed.
**Validates: Requirements 9.5**

### Property 17: Cố Định Movement Lock
*For any* stone with Cố Định status, movement skills SHALL fail to move that stone.
**Validates: Requirements 10.2**

### Property 18: Giải Phóng Counter
*For any* Giải Phóng usage on a Cố Định stone, the Cố Định status SHALL be removed.
**Validates: Requirements 11.4**

### Property 19: Win Condition
*For any* board state with 5 consecutive non-frozen player stones, that player SHALL be declared winner.
**Validates: Requirements 13.1**

### Property 20: Nguyên Hóa Delayed Win
*For any* Nguyên Hóa that creates 5-in-a-row, the win SHALL NOT be declared until the next turn.
**Validates: Requirements 13.2**

### Property 21: Duration Decrement
*For any* turn end, all active effect durations SHALL decrease by 1.
**Validates: Requirements 14.2**

### Property 22: State Serialization Round-Trip
*For any* valid game state, serializing then deserializing SHALL produce an equivalent state.
**Validates: Requirements 15.5**

## Error Handling

### Mana Errors
- `INSUFFICIENT_MANA`: Player doesn't have enough mana for skill
- `MANA_OVERFLOW`: Attempted to exceed max mana

### Skill Errors
- `INVALID_SKILL`: Skill ID not found
- `SKILL_ON_COOLDOWN`: Skill is still on cooldown
- `INVALID_TARGET`: Target position is invalid for this skill
- `SKILL_BLOCKED`: Player is affected by Nguyên Tĩnh

### Deck Errors
- `DECK_TOO_LARGE`: More than 20 skills selected
- `DECK_TOO_SMALL`: Less than 20 skills selected
- `PRESET_LIMIT_EXCEEDED`: More than 3 presets

## Testing Strategy

### Property-Based Testing Library
- PHP: Eris (giorgiosironi/eris)
- TypeScript: fast-check

### Unit Tests
- ManaService: init, add, deduct, cap
- ElementService: counter relationships
- BuffDebuffService: apply, remove, extend

### Property-Based Tests
Each correctness property above will have a corresponding property-based test:
- Minimum 100 iterations per property
- Seeded random for reproducibility
- Tag format: `**Feature: caro-skill-system, Property {N}: {description}**`
