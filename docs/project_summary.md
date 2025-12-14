# MindPoint Arena — Tài Liệu Kỹ Thuật Toàn Diện

> **Cập nhật lần cuối:** 15/12/2024 (Đã đồng bộ hoàn chỉnh với codebase thực tế)

## 1. Tổng Quan Dự Án

**MindPoint Arena** là web game Cờ Caro (Gomoku) phong cách anime cổ trang, hỗ trợ chơi online 1v1 với nhiều chế độ: Ranked (Bo3), Casual, Tournament, AI Training, Caro Skill (60 skill chiến thuật), và Variant modes (Dị Biến Kỳ).

### Mục Tiêu
- Web game caro online hoàn chỉnh với realtime multiplayer
- Hệ thống xếp hạng MindPoint với Bo3 series
- AI phân tích ván đấu chuyên sâu (Basic + Pro + God-tier)
- Hệ thống skill chiến thuật 60 skill theo ngũ hành
- Hệ thống Report/Ban/Appeal hoàn chỉnh
- Admin panel với notification broadcast

---

## 2. System Architecture

### 2.1 Công Nghệ Sử Dụng

| Layer | Technology | Port | Mục đích |
|-------|------------|------|----------|
| **Frontend** | React 18 + TypeScript + Vite | 5173 | SPA với hot reload, type safety |
| **Realtime** | Socket.IO (Node.js) | 8000 | Game events, chat, presence |
| **Backend API** | PHP 8 (PSR-4) | 8001 | REST API, business logic |
| **AI Service** | Python FastAPI | 8004 | Match analysis, AI opponent |
| **Database** | Supabase (PostgreSQL) | - | Data persistence, auth, RLS |
| **Cache** | Redis (optional) | - | Analysis cache, session |

### 2.2 Service Communication Flow

```
┌─────────────┐     WebSocket      ┌─────────────┐
│   Frontend  │◄──────────────────►│   Socket    │
│   (React)   │                    │   Server    │
│  :5173      │                    │   :8000     │
└──────┬──────┘                    └──────┬──────┘
       │ HTTP                             │
       ▼                                  │
┌─────────────┐     HTTP           ┌──────▼──────┐
│   PHP API   │◄──────────────────►│  Supabase   │
│   :8001     │                    │  (Postgres) │
└──────┬──────┘                    └─────────────┘
       │ HTTP
       ▼
┌─────────────┐
│  AI Service │
│   :8004     │
└─────────────┘
```

---

## 3. Cấu Trúc Dự Án (Project Structure)

### 3.1 Frontend (`frontend/src/`)

```
frontend/src/
├── pages/                    # Route pages
│   ├── Home.tsx              # Menu chính
│   ├── Room.tsx              # Gameplay chính
│   ├── TrainingRoom.tsx      # AI Training mode
│   ├── VariantMatch.tsx      # Dị Biến Kỳ modes
│   ├── Hotseat.tsx           # 2 người 1 máy
│   ├── AiAnalysis.tsx        # Phân tích ván đấu
│   ├── Shop.tsx              # Mua items
│   ├── CurrencyShop.tsx      # Mua Coin/Gem
│   ├── CurrencyResult.tsx    # Kết quả mua currency
│   ├── Inventory.tsx         # Kho đồ
│   ├── Titles.tsx            # Danh hiệu
│   ├── Profile.tsx           # Thông tin cá nhân
│   ├── Inbox.tsx             # Hộp thư
│   ├── Tournament.tsx        # Giải đấu
│   ├── Admin.tsx             # Admin dashboard
│   ├── AdminReports.tsx      # Quản lý reports
│   ├── AdminAppeals.tsx      # Quản lý appeals
│   ├── AdminNotifications.tsx # Gửi thông báo
│   ├── Login.tsx             # Đăng nhập
│   ├── Register.tsx          # Đăng ký
│   ├── AuthLanding.tsx       # Landing page auth
│   ├── ForgotPassword.tsx    # Quên mật khẩu
│   ├── ResetPassword.tsx     # Reset mật khẩu
│   ├── Lobby.tsx             # Danh sách phòng
│   ├── CreateRoom.tsx        # Tạo phòng
│   ├── Matchmaking.tsx       # Queue matchmaking
│   ├── Subscription.tsx      # Gói subscription
│   ├── PaymentResult.tsx     # Kết quả thanh toán
│   ├── Guide.tsx             # Hướng dẫn chơi
│   ├── Quests.tsx            # Nhiệm vụ
│   ├── Events.tsx            # Sự kiện
│   ├── KhaiNhan.tsx          # Khai nhân (gacha)
│   ├── InMatch.tsx           # Trong trận đấu
│   └── TestAI.tsx            # Test AI (dev)
│
├── components/               # Reusable UI components
│   ├── board/                # GomokuBoard, Cell
│   ├── series/               # SeriesScoreDisplay, GameResultModal, RematchFlow
│   ├── swap2/                # Swap2PhaseIndicator, ColorChoiceModal, TentativeStoneDisplay, Swap2GameWrapper
│   ├── skill/                # SkillCard, InGameSkillPanel, SkillComboBuilder, SkillEffectOverlay, SkillTargetSelector
│   ├── analysis/             # InteractiveBoard, ScoreTimeline, ReplayAIPanel, ComparisonPanel, OnlinePlayersPanel
│   ├── chat/                 # ChatPanel, HomeChatOverlay
│   ├── rank/                 # RankBadgeV2, RankProgressV2, RankChangeAnimationV2, PointsBreakdown
│   ├── report/               # ReportModal, ReportButton, BanNotificationModal, ReportDetailModal
│   ├── notification/         # InboxIcon, NotificationDetailModal, UserSelectModal
│   ├── avatar/               # AvatarWithFrame
│   ├── title/                # TitleCard
│   ├── shop/                 # SkillPackageSection
│   ├── tournament/           # TournamentModal
│   ├── settings/             # MusicSelector
│   ├── layout/               # MobileQuickSettings, MobileBreadcrumb
│   │
│   ├── Board.tsx             # Legacy board component
│   ├── GameBoard.tsx         # Game board wrapper
│   ├── OnboardingTour.tsx    # Onboarding tour
│   ├── UsernamePopup.tsx     # Username popup
│   ├── EmotePicker.tsx       # Emote picker
│   └── ShopGrid.tsx          # Shop grid layout
│
├── hooks/                    # Custom React hooks
│   ├── useSocket.ts          # Socket.IO connection singleton
│   ├── useSeriesRealtime.ts  # Ranked series events
│   ├── useSwap2State.ts      # Swap 2 opening rule FSM
│   ├── useSwap2Local.ts      # Local Swap 2 (Hotseat)
│   ├── useSwap2Integration.ts # Swap 2 integration helper
│   ├── useSkillSystem.ts     # Skill deck management
│   ├── useRankV2.ts          # Rank calculation from mindpoint
│   ├── useAnalysisState.ts   # Analysis data management
│   ├── useReplayAI.ts        # Replay session with AI
│   ├── useRematch.ts         # Rematch flow
│   ├── useNotifications.ts   # Inbox notifications
│   ├── useBanCheck.ts        # Check user ban status
│   ├── useRankedDisconnect.ts # Ranked disconnect handling
│   ├── useOnlinePlayers.ts   # Online players list
│   ├── useEquippedMusic.ts   # Equipped music track
│   ├── useEquippedFrame.ts   # Equipped avatar frame
│   ├── useTitles.ts          # User titles
│   ├── useChat.ts            # Chat functionality
│   └── useFriendSystem.ts    # Friend system
│
├── lib/                      # Utilities & API clients
│   ├── supabase.ts           # Supabase client
│   ├── apiBase.ts            # Base API configuration
│   ├── analysisApi.ts        # AI analysis API
│   ├── replayApi.ts          # Replay session API
│   ├── seriesApi.ts          # Series management API
│   ├── skillApi.ts           # Skill system API
│   ├── skillData.ts          # 60 skills definition (local)
│   ├── matchmaking.ts        # Matchmaking queue
│   ├── notificationApi.ts    # Notification API
│   ├── titleApi.ts           # Title API
│   ├── adminActions.ts       # Admin actions
│   ├── AudioManager.ts       # Audio singleton
│   ├── NotificationManager.ts # System notifications
│   ├── caroDataset.ts        # AI chat dataset
│   ├── question_dataset.ts   # Question dataset for AI
│   ├── chat.ts               # Chat utilities
│   ├── friends.ts            # Friend system API
│   ├── username.ts           # Username utilities
│   └── game/                 # Game logic utilities
│
├── contexts/                 # React Context providers
│   └── LanguageContext.tsx   # i18n (vi, en, zh, ja)
│
└── types/                    # TypeScript definitions
    ├── rankV2.ts             # Rank system types
    ├── swap2.ts              # Swap 2 types
    └── chat.ts               # Chat types
```

### 3.2 Backend PHP (`backend/app/`)

```
backend/app/
├── Controllers/              # HTTP request handlers
│   ├── SeriesController.php      # Ranked Bo3 series
│   ├── Swap2Controller.php       # Swap 2 opening rule
│   ├── AnalysisController.php    # AI analysis proxy
│   ├── SkillController.php       # Skill system
│   ├── PaymentController.php     # VNPAY subscription
│   ├── CurrencyController.php    # Coin/Gem purchase
│   ├── ReportController.php      # Report violations
│   ├── AppealController.php      # Ban appeals
│   ├── BanController.php         # User bans
│   ├── NotificationController.php # Admin notifications
│   ├── TitleController.php       # User titles
│   ├── AIProxyController.php     # AI service proxy
│   └── DatasetController.php     # Dataset search
│
├── Services/                 # Business logic (60+ files: Service + Interface + DTOs)
│   │   # Series & Ranked
│   ├── SeriesManagerService.php / SeriesManagerServiceInterface.php
│   ├── ScoringEngineService.php / ScoringEngineServiceInterface.php
│   ├── ScoringEngineV2Service.php    # MP calculation v2
│   ├── RankManagerService.php / RankManagerServiceInterface.php
│   ├── RankSystemV2Service.php       # Rank system v2
│   ├── DisconnectHandlerService.php / DisconnectHandlerServiceInterface.php
│   │   # Swap 2
│   ├── Swap2ManagerService.php / Swap2ManagerServiceInterface.php
│   ├── Swap2State.php, Swap2Action.php, ColorAssignment.php, TentativeStone.php
│   │   # Skill System
│   ├── SkillService.php / SkillServiceInterface.php
│   ├── SkillEngineService.php / SkillEngineServiceInterface.php
│   ├── SkillRandomizerService.php / SkillRandomizerServiceInterface.php
│   ├── ManaService.php / ManaServiceInterface.php
│   ├── MatchSkillStateService.php, SkillEffectResult.php
│   ├── ComboService.php / ComboServiceInterface.php
│   ├── SeasonService.php / SeasonServiceInterface.php
│   │   # Game State
│   ├── GameStateService.php / GameStateServiceInterface.php
│   ├── RoomConfigService.php / RoomConfigServiceInterface.php
│   ├── StateRecoveryResult.php
│   │   # Report/Ban/Appeal
│   ├── ReportService.php / ReportServiceInterface.php
│   ├── AppealService.php / AppealServiceInterface.php
│   ├── BanService.php / BanServiceInterface.php
│   ├── UserBanStatus.php
│   │   # Notifications & Titles
│   ├── NotificationService.php / NotificationServiceInterface.php
│   ├── TitleService.php              # Titles (no interface)
│   │   # Payment & Currency
│   ├── PaymentService.php / PaymentServiceInterface.php
│   ├── CurrencyService.php / CurrencyServiceInterface.php
│   ├── SubscriptionService.php / SubscriptionServiceInterface.php
│   ├── UsageService.php / UsageServiceInterface.php
│   │   # AI Integration
│   ├── AIBridgeService.php / AIBridgeServiceInterface.php
│   ├── AIAnalysisService.php / AIAnalysisServiceInterface.php
│   ├── AnalysisCacheService.php / AnalysisCacheServiceInterface.php
│   ├── RuleEngineService.php / RuleEngineServiceInterface.php
│   ├── AIAnalysisResult.php, RuleAnalysisResult.php, ValidationResult.php
│   │   # Infrastructure
│   └── SupabaseClient.php            # Supabase client wrapper
│
├── Models/                   # Data models (7 models)
│   ├── BaseModel.php             # Base model class
│   ├── Report.php                # Report model
│   ├── Appeal.php                # Appeal model
│   ├── UserBan.php               # User ban model
│   ├── ReportAction.php          # Report action model
│   ├── AdminNotification.php     # Admin notification model
│   └── UserAdminNotification.php # User-admin notification junction
│
├── Middleware/               # Request middleware
│   ├── RateLimiter.php
│   └── AdminAuthorization.php
│
├── GameEngine.php            # Game logic
├── MatchmakingService.php    # Matchmaking
├── Database.php              # Database interface
└── SupabaseDatabase.php      # Supabase implementation
```

### 3.3 AI Service Python (`ai/`)

```
ai/
├── main.py                   # FastAPI application (endpoints)
│
├── analysis/                 # Analysis modules
│   ├── basic_analyzer.py         # Rule-based analysis
│   ├── pro_analyzer.py           # AI-enhanced analysis
│   ├── pro_analyzer_v2.py        # God-tier analysis (VCF/VCT deep)
│   ├── god_tier_mistake_analyzer.py # Advanced mistake detection
│   │
│   ├── threat_detector.py        # Threat pattern detection
│   ├── threat_space.py           # Threat space search
│   ├── pattern_evaluator.py      # Pattern recognition
│   ├── position_evaluator.py     # Position evaluation
│   ├── advanced_evaluator.py     # Advanced evaluation
│   │
│   ├── vcf_search.py             # Victory by Continuous Four
│   ├── vct_search.py             # Victory by Continuous Threat
│   ├── vcf_detector.py           # VCF detection
│   ├── basic_vcf_search.py       # Basic VCF search
│   │
│   ├── basic_search.py           # Alpha-beta search
│   ├── dbs_search.py             # Dependency-based search
│   ├── bitboard.py               # Bitboard representation
│   ├── transposition_table.py    # Position cache
│   │
│   ├── opening_book.py           # Opening recognition
│   ├── opening_evaluator.py      # Opening evaluation
│   ├── endgame_analyzer.py       # Endgame analysis
│   │
│   ├── mistake_analyzer.py       # Mistake detection
│   ├── basic_mistake_analyzer.py # Basic mistake detection
│   ├── move_scorer.py            # Move scoring
│   ├── role_evaluator.py         # Player role evaluation
│   │
│   ├── comment_generator.py      # Multi-language comments
│   ├── lesson_generator.py       # Learning lessons
│   ├── alternative_lines.py      # Alternative move lines
│   │
│   ├── tempo_analyzer.py         # Tempo analysis
│   ├── defensive_patterns.py     # Defensive patterns
│   ├── game_metadata.py          # Game metadata
│   ├── coordinate_utils.py       # Coordinate utilities
│   ├── board_validation.py       # Board validation
│   │
│   ├── redis_cache.py            # Redis caching
│   ├── analysis_cache.py         # In-memory cache
│   ├── cache_warmer.py           # Cache warming
│   ├── parallel_search.py        # Parallel search
│   ├── numba_core.py             # Numba JIT acceleration
│   │
│   ├── basic_analysis_lite.py    # Lightweight analysis
│   ├── basic_analysis_optimized.py # Optimized analysis
│   ├── serialization.py          # Data serialization
│   ├── types.py                  # Type definitions
│   │
│   ├── metrics_logger.py         # Metrics logging
│   ├── player_profile.py         # Player profile analysis
│   ├── what_if_simulator.py      # What-if scenario simulation
│   └── gomoku_basic/             # Basic gomoku utilities subfolder
│
├── replay/                   # Replay engine
│   └── replay_engine.py          # Replay session management
│
└── tests/                    # Property-based tests (Hypothesis)
    ├── test_basic_analyzer_props.py
    ├── test_pro_analyzer_props.py
    ├── test_vcf_search_props.py
    ├── test_vct_search_props.py
    ├── test_threat_detector_property.py
    ├── test_pattern_evaluator_props.py
    ├── test_opening_book_props.py
    ├── test_comment_generator_props.py
    ├── test_role_evaluator_props.py
    └── ... (50+ test files)
```

### 3.4 Socket Server (`server/`)

```
server/
├── index.js              # Main Socket.IO server
├── game.js               # Game API endpoints
├── friends.js            # Friend system routes
├── game/
│   └── checkWinner.js    # Win detection logic
└── scripts/
    └── create-admin.mjs  # Admin creation script
```

---

## 4. Gameplay Systems

### 4.1 Các Chế Độ Chơi

| Mode | Mô tả | Swap 2 | Board |
|------|-------|--------|-------|
| **Ranked** | Xếp hạng Bo3, tính MindPoint | Bắt buộc | 15x15 |
| **Casual** | Chơi thoải mái, không tính điểm | Tùy chọn | 15x15 |
| **Tournament** | Giải đấu theo bracket | Tùy chọn | 15x15 |
| **AI Training** | Đấu với AI (3 levels) | Không | 15x15 |
| **Hotseat** | 2 người 1 máy | Tùy chọn | 15x15 |

### 4.2 Dị Biến Kỳ (Variant Modes)

Các chế độ chơi đặc biệt với luật chơi khác biệt:

| Variant | Tên | Mô tả | Swap 2 |
|---------|-----|-------|--------|
| **custom** | Tùy Chỉnh | Caro cơ bản với cài đặt tùy chỉnh (board size, win length, time) | ✅ Có |
| **hidden** | Caro Ẩn | Quân cờ bị ẩn, chỉ hiện khi có quân xung quanh | ✅ Có |
| **skill** | Caro Skill | Sử dụng 60 skill chiến thuật, mana system, deck 15 lá | ❌ Không |
| **terrain** | Địa Hình | Bàn cờ có các ô đặc biệt với hiệu ứng ngẫu nhiên | ❌ Không |

**Terrain Types (Caro Địa Hình):**
| Icon | Type | Hiệu ứng |
|------|------|----------|
| 💣 | bomb | Xóa quân xung quanh |
| ❄️ | freeze | Đóng băng ô xung quanh 2 lượt |
| 🌀 | teleport | Di chuyển quân đến ô trống ngẫu nhiên |
| 🛡️ | shield | Bảo vệ quân không bị bomb/swap |
| ❓ | skill | Nhận skill ngẫu nhiên |
| ⭐ | double | Đi thêm lượt |
| 🚧 | block | Ô bị khóa vĩnh viễn |
| 🎁 | mystery | Hiệu ứng ngẫu nhiên (tốt hoặc xấu) |
| 💎 | score | Cộng 1 điểm bonus |

**Terrain Scoring System:**
- Mỗi quân cờ đơn = 1 điểm
- Chuỗi n quân (n≥2) = n điểm
- Giao điểm chuỗi = bonus x2
- Ô 💎 = +1 điểm bonus

### 4.2 Hệ Thống Swap 2 Opening

**Luồng Swap 2:**
```
Phase 1: PLACEMENT
  └── Player 1 đặt 3 quân (2 Đen + 1 Trắng)

Phase 2: CHOICE
  └── Player 2 chọn:
      ├── "black" → Chơi Đen
      ├── "white" → Chơi Trắng
      └── "place_more" → Đặt thêm 2 quân

Phase 3: EXTRA (nếu chọn place_more)
  └── Player 2 đặt thêm 2 quân (1 Đen + 1 Trắng)

Phase 4: FINAL_CHOICE
  └── Player 1 chọn màu

Phase 5: COMPLETE
  └── Bắt đầu main game
```

### 4.3 Hệ Thống Ranked Bo3

**Rank Tiers (7 cấp):**
```
Vô Danh → Tân Kỳ → Học Kỳ → Kỳ Lão → Cao Kỳ → Kỳ Thánh → Truyền Thuyết
   0        50       200      600     1500     3000        5500 MP
```

**Ranked Disconnect Auto-Win:**
- Grace period: 10 giây
- Nếu disconnect quá 10s → đối thủ thắng tự động
- MP change: ±20 fixed

---

## 5. Hệ Thống Skill (60 Skills)

### 5.1 Phân Loại
- **31 Skill Thường** (Common) - 70% drop rate
- **22 Skill Hiếm** (Rare) - 25% drop rate  
- **7 Skill Cực Hiếm** (Legendary) - 5% drop rate

### 5.2 Cơ Chế Gameplay
```
Mana: Bắt đầu 5, hồi +3/lượt, tối đa 15

Mỗi lượt:
1. Random 3 skill từ deck 15 lá
2. Đặt quân (bắt buộc)
3. Dùng 1 skill (tùy chọn, nếu đủ mana)
4. Giữ lại bài (tốn mana theo rarity)
5. Kết thúc lượt → Random 3 skill mới
```

### 5.3 Skill Packages
- **Khai Xuân** (5 cards, 70% common)
- **Khai Thiên** (5 cards, 25% rare)
- **Vô Cực** (5 cards, 5% legendary)

---

## 6. AI Analysis System

### 6.1 Analysis Tiers

| Tier | Mô tả | Features |
|------|-------|----------|
| **Basic** | Free, rule-based | Pattern detection, basic mistakes |
| **Pro** | Paid, AI-enhanced | VCF/VCT search, deep analysis |
| **God-tier** | Premium | Pro Analyzer V2, advanced mistake detection |

### 6.2 Core Modules

| Module | Mục đích |
|--------|----------|
| `basic_analyzer.py` | Rule-based analysis |
| `pro_analyzer.py` | AI-enhanced analysis |
| `pro_analyzer_v2.py` | God-tier analysis |
| `vcf_search.py` | Victory by Continuous Four |
| `vct_search.py` | Victory by Continuous Threat |
| `threat_detector.py` | Threat pattern recognition |
| `opening_book.py` | Opening recognition |
| `comment_generator.py` | Multi-language comments (vi, en, zh, ja) |
| `role_evaluator.py` | Player role evaluation |
| `replay_engine.py` | Replay session with AI Q&A |

### 6.3 API Endpoints

```
POST /analyze      → Match analysis
POST /ask          → Q&A about match
POST /replay/create → Create replay session
POST /replay/navigate → Navigate replay
POST /replay/play  → Play move in replay
GET  /usage        → Usage tracking
GET  /health       → Health check
```

---

## 7. Database Schema (Key Tables)

```sql
-- Core
profiles (user_id, username, mindpoint, current_rank, coins, gems, equipped_avatar_frame)
matches (id, player_x_user_id, player_o_user_id, winner_user_id, series_id, swap2_history)
ranked_series (id, player1_id, player2_id, player1_wins, player2_wins, status)
moves (match_id, player_user_id, position_x, position_y, move_number)

-- Skill System
skills (id, skill_code, name_vi, mana_cost, cooldown, effect_type, rarity)
user_skills (user_id, skill_id, quantity)
user_skill_combos (user_id, combo_name, skill_ids)
match_skill_state (match_id, state)
match_skill_logs (match_id, user_id, turn_number, selected_skill_id)
skill_packages (id, package_code, cards_count, common_rate, rare_rate, legendary_rate)
seasons (id, season_number, name, is_active)

-- Economy
items (id, item_code, category, price_coins, price_gems)
user_items (user_id, item_id, is_equipped)
currency_packages (id, currency_type, amount, price_vnd)
currency_purchases (user_id, package_id, txn_ref, status)
subscriptions (user_id, tier, expires_at)
usage_logs (user_id, feature, count)
analysis_cache (match_id, tier, result)

-- Social
friends (user_id, friend_id, status)
chat_messages (sender_user_id, content, channel_scope, room_id, target_user_id)
reports (reporter_id, reported_user_id, type, status, rule_analysis, ai_analysis)
appeals (report_id, user_id, reason, status, admin_response)
user_bans (user_id, reason, expires_at, is_permanent)
report_actions (report_id, admin_id, action, notes)

-- Notifications
admin_notifications (id, admin_id, title, content, is_broadcast)
user_admin_notifications (user_id, notification_id, is_read, gift_claimed)
notifications (user_id, type, title, message, is_read)

-- Rooms & Matchmaking
rooms (id, room_code, owner_user_id, mode, swap2_enabled, game_state)
room_players (room_id, user_id, player_side, is_ready)
matchmaking_queue (user_id, mode, status)

-- Categories & Items
categories (id, name_vi, name_en, max_equipped)
```

---

## 8. Tổng Hợp Chức Năng

### 8.1 Authentication & Profile
- Đăng ký/Đăng nhập (Email, OAuth)
- Quên mật khẩu, Reset password
- Profile: Avatar, Username, Display name, Avatar Frame
- Onboarding tour cho user mới
- Title system (danh hiệu)

### 8.2 Gameplay
- Tạo phòng (public/private)
- Matchmaking queue (Ranked/Casual/Variant)
- Bàn cờ 15x15 với timer
- Swap 2 opening rule
- Chat trong phòng
- Spectator mode
- Hotseat (2 người 1 máy)
- Variant modes (Dị Biến Kỳ)

### 8.3 Ranked System
- Bo3 series với MindPoint
- 7 rank tiers
- Disconnect auto-win (10s grace)
- Rematch flow

### 8.4 AI Features
- AI opponent (3 levels: Nhập Môn, Kỳ Tài, Nghịch Thiên)
- Post-match analysis (Basic/Pro/God-tier)
- Move-by-move evaluation
- Mistake detection (VCF/VCT missed)
- Replay với AI Q&A
- Multi-language comments

### 8.5 Shop & Economy
- Tiền tệ: Coins, Gems, Tinh Thạch, Nguyên Thần
- Mua skins (Board, Piece, Avatar Frame)
- Mua nhạc nền
- Skill packages (Khai Xuân, Khai Thiên, Vô Cực)
- Currency packages (VNPAY)
- Subscription plans (Trial, Pro, Pro Plus)

### 8.6 Social
- Friend system (Add, Accept, Block)
- Chat (Global, Friends, Room)
- Report/Ban system với AI analysis
- Appeal system

### 8.7 Admin Panel
- User management
- Report review với AI summary
- Ban management
- Notification broadcast (all/specific users)
- Gift notifications (coins, gems, items)
- Statistics dashboard

### 8.8 Inventory & Customization
- Equipped items (Board, Piece, Frame, Music)
- Title system
- Achievement badges

---

## 9. Các Trang Frontend

| Page | Route | Chức năng |
|------|-------|-----------|
| Home | `/` | Menu chính, quick actions |
| Login | `/login` | Đăng nhập |
| Register | `/register` | Đăng ký |
| AuthLanding | `/auth` | Landing page auth |
| ForgotPassword | `/forgot-password` | Quên mật khẩu |
| ResetPassword | `/reset-password` | Reset mật khẩu |
| Lobby | `/lobby` | Danh sách phòng |
| CreateRoom | `/create-room` | Tạo phòng |
| Room | `/room/:id` | Gameplay chính |
| Training | `/training` | AI Training mode |
| Variant | `/variant` | Dị Biến Kỳ modes |
| Hotseat | `/hotseat` | 2 người 1 máy |
| Matchmaking | `/matchmaking` | Queue ranked/casual |
| InMatch | `/in-match` | Trong trận đấu |
| AI Analysis | `/ai-analysis` | Phân tích ván đấu |
| Shop | `/shop` | Mua items |
| Currency Shop | `/currency-shop` | Mua Coin/Gem |
| CurrencyResult | `/currency-result` | Kết quả mua currency |
| Subscription | `/subscription` | Gói subscription |
| PaymentResult | `/payment-result` | Kết quả thanh toán |
| Profile | `/profile` | Thông tin cá nhân |
| Inventory | `/inventory` | Kho đồ |
| Titles | `/titles` | Danh hiệu |
| Inbox | `/inbox` | Hộp thư |
| Quests | `/quests` | Nhiệm vụ |
| Events | `/events` | Sự kiện |
| KhaiNhan | `/khai-nhan` | Khai nhân (gacha) |
| Guide | `/guide` | Hướng dẫn chơi |
| Tournament | `/tournament` | Giải đấu |
| Admin | `/admin` | Admin dashboard |
| Admin Reports | `/admin/reports` | Quản lý reports |
| Admin Appeals | `/admin/appeals` | Quản lý appeals |
| Admin Notifications | `/admin/notifications` | Gửi thông báo |
| TestAI | `/test-ai` | Test AI (dev only) |

---

## 10. Development Commands

```bash
# Frontend (port 5173)
cd frontend && npm run dev

# Socket Server (port 8000)
cd server && npm start

# PHP Backend (port 8001)
cd backend/public && php -S localhost:8001 router.php

# AI Service (port 8004)
cd ai && uvicorn main:app --port 8004

# Run all (PowerShell)
./scripts/ai-orchestrator/START_ALL.ps1
```

---

## 11. Testing

```bash
# Frontend
cd frontend && npm test

# Backend (PHPUnit + Eris property tests)
cd backend && ./vendor/bin/phpunit --testdox

# AI (pytest + Hypothesis)
cd ai && python -m pytest tests/ -v
```

---

## 12. MVP Hoàn Thành

- ✅ Gameplay cơ bản (Room, Board, Timer)
- ✅ Ranked Bo3 với MindPoint
- ✅ Swap 2 opening rule
- ✅ AI Analysis (Basic + Pro + God-tier)
- ✅ Shop & Payment (VNPAY)
- ✅ 60 Skills system
- ✅ Report/Ban/Appeal system
- ✅ Admin panel với notification broadcast
- ✅ Multi-language (4 languages: vi, en, zh, ja)
- ✅ Ranked disconnect auto-win
- ✅ Title system
- ✅ Avatar frame system
- ✅ Music selection system
- ✅ Variant modes (Dị Biến Kỳ)

---

---

## 13. Cấu Trúc Thư Mục Đầy Đủ

```
caro/
├── frontend/                 # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/            # 35+ route pages
│   │   ├── components/       # 15+ component folders
│   │   ├── hooks/            # 20 custom hooks
│   │   ├── lib/              # 18+ utility modules
│   │   ├── contexts/         # React contexts
│   │   └── types/            # TypeScript definitions
│   ├── public/               # Static assets
│   └── styles.css            # Global styles
│
├── backend/                  # PHP 8 + PSR-4
│   ├── app/
│   │   ├── Controllers/      # 13 controllers
│   │   ├── Services/         # 40+ services
│   │   ├── Models/           # 7 models
│   │   └── Middleware/       # 2 middleware
│   ├── public/               # HTTP entry
│   └── tests/                # PHPUnit + Eris tests
│
├── ai/                       # Python FastAPI
│   ├── analysis/             # 45+ analysis modules
│   ├── replay/               # Replay engine
│   └── tests/                # 50+ property tests
│
├── server/                   # Node.js Socket.IO
│   ├── index.js              # Main server
│   ├── game.js               # Game routes
│   ├── friends.js            # Friend routes
│   └── game/                 # Game utilities
│
├── infra/                    # Database
│   ├── supabase_schema.sql   # Main schema
│   └── migrations/           # 50+ migrations
│
├── docs/                     # Documentation
├── scripts/                  # Utility scripts
├── shared/                   # Shared types
└── assets/                   # Static assets
```

---

*Tài liệu này được đồng bộ hoàn chỉnh với codebase thực tế của MindPoint Arena (15/12/2024).*
