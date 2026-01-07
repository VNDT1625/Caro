# System Architecture

## Service Communication

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

## Project Structure

### Frontend (`frontend/src/`)
```
pages/           # 34 route pages (Home, Room, Shop, Profile, Admin...)
components/      # 15 component folders (board, series, swap2, skill, analysis, chat, rank, report, notification, avatar, title, shop, tournament, settings, layout)
hooks/           # 23 custom hooks (useSocket, useSeriesRealtime, useSkillSystem, useSwap2State...)
lib/             # 19 API clients & utilities (supabase, analysisApi, skillApi, matchmaking...)
contexts/        # React Context (LanguageContext)
types/           # TypeScript definitions (rankV2, swap2, chat)
```

### Backend (`backend/app/`)
```
Controllers/     # 13 HTTP handlers (Series, Swap2, Analysis, Payment, Report, Appeal, Ban, Notification, Skill, Title, Currency, AIProxy, Dataset)
Services/        # 64 service files (Service + Interface + DTOs)
Models/          # 7 data models (Report, Appeal, UserBan, ReportAction, AdminNotification, UserAdminNotification, BaseModel)
Middleware/      # RateLimiter, AdminAuthorization
+ GameEngine.php, MatchmakingService.php, Database.php, SupabaseDatabase.php
```

### AI Service (`ai/`)
```
main.py          # FastAPI endpoints
analysis/        # 44 analysis modules (basic, pro, god-tier, VCF/VCT, threat, pattern, opening, endgame...)
replay/          # Replay engine (replay_engine.py)
tests/           # 57 property-based tests (Hypothesis)
api/             # API utilities
```

### Socket Server (`server/`)
```
index.js         # Main Socket.IO server
game.js          # Game API endpoints
friends.js       # Friend system routes
game/            # Game logic (checkWinner)
scripts/         # Admin scripts
```

## Key Technologies

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | React 18 + TypeScript + Vite | SPA with hot reload |
| State | React Context + Hooks | Global state management |
| Realtime | Socket.IO | Game events, chat, presence |
| Backend | PHP 8 (PSR-4) | REST API, business logic |
| AI | Python FastAPI | Match analysis, AI opponent |
| Database | Supabase (PostgreSQL) | Data persistence, auth, RLS |
| Auth | Supabase Auth | JWT-based authentication |
| Payment | VNPAY | Subscription & currency purchase |
