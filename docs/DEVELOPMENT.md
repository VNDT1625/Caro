# Development Guide

## Prerequisites

- Node.js 18+ & npm
- PHP 8.1+ & Composer
- Python 3.10+ & pip
- Supabase account
- ngrok (optional, for VNPAY callbacks)

## Setup

### 1. Install Dependencies

```bash
cd frontend && npm install && cd ..
cd server && npm install && cd ..
cd backend && composer install && cd ..
cd ai && pip install -r requirements.txt && cd ..
```

### 2. Configure Environment

Copy and fill environment files:
- `frontend/.env` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `server/.env` — Supabase keys
- `backend/.env` — Supabase keys, VNPAY config
- `ai/.env` — `OPENROUTER_API_KEY` (optional)

### 3. Start Services

```bash
# Terminal 1: PHP Backend (port 8001)
cd backend/public && php -S localhost:8001 router.php

# Terminal 2: Socket Server (port 8000)
cd server && npm start

# Terminal 3: AI Service (port 8004)
cd ai && uvicorn main:app --port 8004

# Terminal 4: Frontend (port 5173)
cd frontend && npm run dev

# Terminal 5 (optional): ngrok for VNPAY
ngrok http 8001
```

### 4. Open Browser

http://localhost:5173

## Testing

```bash
# Frontend (Vitest)
cd frontend && npm test

# Backend (PHPUnit + Eris property tests)
cd backend && ./vendor/bin/phpunit --testdox

# AI (pytest + Hypothesis)
cd ai && python -m pytest tests/ -v
```

## Coding Style

| Language | Style | Tools |
|----------|-------|-------|
| PHP | PSR-4/PSR-12 | php-cs-fixer |
| TypeScript | 2-space, single quotes | ESLint + Prettier |
| Python | Type hints, docstrings | black + isort |

## Git Workflow

- Main branch: `main`
- Feature branches: `feature/<name>`
- Bugfix branches: `fix/<name>`
- Commits: short, imperative messages

## Common Issues

| Issue | Solution |
|-------|----------|
| CORS errors | Check backend allows `localhost:5173` |
| RLS blocked | Check `infra/migrations/` for policies |
| Port conflicts | Ensure 5173, 8000, 8001, 8004 are free |
| Socket disconnect | Frontend handles reconnection in `useSeriesRealtime.ts` |
