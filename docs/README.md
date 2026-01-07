# MindPoint Arena - Documentation

## Quick Links

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, tech stack, project structure |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Setup guide, commands, testing, deployment |
| [FEATURES.md](./FEATURES.md) | Game modes, skill system, rank system, shop |
| [API.md](./API.md) | REST API, Socket events, AI service endpoints |
| [DATABASE.md](./DATABASE.md) | Supabase schema, migrations, RLS policies |

## Overview

**MindPoint Arena** is a web-based Gomoku (Caro) game with:
- Ranked Bo3 series with MindPoint rating
- 60 tactical skills system
- AI match analysis (Basic/Pro/God-tier)
- Real-time multiplayer via Socket.IO
- VNPAY payment integration

## Tech Stack

| Layer | Technology | Port |
|-------|------------|------|
| Frontend | React 18 + TypeScript + Vite | 5173 |
| Realtime | Socket.IO (Node.js) | 8000 |
| Backend | PHP 8 (PSR-4) | 8001 |
| AI Service | Python FastAPI | 8004 |
| Database | Supabase (PostgreSQL) | - |

## Quick Start

```bash
# Frontend
cd frontend && npm install && npm run dev

# Socket Server
cd server && npm install && npm start

# PHP Backend
cd backend/public && php -S localhost:8001 router.php

# AI Service
cd ai && pip install -r requirements.txt && uvicorn main:app --port 8004
```

Open http://localhost:5173
