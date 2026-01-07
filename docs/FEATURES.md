# Game Features

## Game Modes

| Mode | Description | Swap2 | Board |
|------|-------------|-------|-------|
| Ranked | Bo3 series, MindPoint rating | Required | 15x15 |
| Casual | No rating impact | Optional | 15x15 |
| Tournament | Bracket-based competition | Optional | 15x15 |
| AI Training | vs AI (3 levels: Nhập Môn, Kỳ Tài, Nghịch Thiên) | No | 15x15 |
| Hotseat | 2 players, 1 device | Optional | 15x15 |

## Variant Modes (Dị Biến Kỳ)

| Variant | Description | Swap2 |
|---------|-------------|-------|
| Custom | Configurable board size, win length, time | Yes |
| Hidden | Pieces hidden until adjacent pieces placed | Yes |
| Skill | 60 tactical skills with mana system | No |
| Terrain | Special tiles with random effects (bomb, freeze, teleport, shield, double, block, mystery, score) | No |

## Swap2 Opening Rule

```
Phase 1: PLACEMENT → Player 1 places 3 stones (2 Black + 1 White)
Phase 2: CHOICE → Player 2 chooses: black/white/place_more
Phase 3: EXTRA → If place_more: Player 2 places 2 more stones
Phase 4: FINAL_CHOICE → Player 1 chooses color
Phase 5: COMPLETE → Main game starts
```

## Rank System (MindPoint)

| Rank | MindPoint Required |
|------|-------------------|
| Vô Danh | 0 |
| Tân Kỳ | 50 |
| Học Kỳ | 200 |
| Kỳ Lão | 600 |
| Cao Kỳ | 1500 |
| Kỳ Thánh | 3000 |
| Truyền Thuyết | 5500 |

**Disconnect Auto-Win:** 10s grace period, then opponent wins (+20 MP)

## Skill System (60 Skills)

- **31 Common** (70% drop rate)
- **22 Rare** (25% drop rate)
- **7 Legendary** (5% drop rate)

**Mana:** Start 5, +3/turn, max 15

**Packages:**
- Khai Xuân (5 cards, 70% common)
- Khai Thiên (5 cards, 25% rare)
- Vô Cực (5 cards, 5% legendary)

## AI Analysis

| Tier | Features |
|------|----------|
| Basic | Pattern detection, basic mistakes, rule-based |
| Pro | VCF/VCT search, deep analysis, AI-enhanced |
| God-tier | Pro Analyzer V2, advanced mistake detection, threat space analysis |

**Analysis Modules:** basic_analyzer, pro_analyzer, pro_analyzer_v2, god_tier_mistake_analyzer, vcf_search, vct_search, threat_detector, threat_space, pattern_evaluator, opening_book, endgame_analyzer, comment_generator (vi/en/zh/ja), role_evaluator, tempo_analyzer, defensive_patterns

## Shop & Economy

**Currencies:** Coins, Gems

**Items:**
- Board skins
- Piece skins  
- Avatar frames
- Background music
- Skill packages (Khai Xuân, Khai Thiên, Vô Cực)
- Titles

**Payment:** VNPAY integration for subscriptions and currency packages

## Social Features

- Friend system (Add, Accept, Block)
- Chat (Global, Friends, Room)
- Report/Ban/Appeal system with AI analysis
- Admin notification broadcast with gift attachments
- Inbox for user notifications
