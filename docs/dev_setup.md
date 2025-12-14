# Development setup (local)

This file describes how to run the local components and configure Supabase for the MVP demo.

## Prerequisites
- PHP 8+, Composer
- Node.js 18+ and npm
- Python 3.8+ (for AI service)
- (Optional) Redis, SQLite/Postgres for persistence

## Supabase setup (quick)
1. Create a Supabase project at https://app.supabase.com
2. From Project Settings copy:
   - `SUPABASE_URL` (project URL, e.g. `https://your-project-ref.supabase.co`)
   - `SUPABASE_ANON_KEY` (public anon key)
3. For server-side verification you can use the anon key above. For privileged DB operations use the service_role key — do NOT commit it.

## Local env
- Frontend: copy `frontend/.env.example` → `frontend/.env` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Backend: copy `backend/.env.supabase.example` → `backend/.env` and fill `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

## Run services (examples)
### Backend (PHP built-in dev server)
Open a shell and run:

# cmd.exe
cd /d C:\PJ\caro\backend\public
php -S localhost:8001 router.php

# PowerShell
Set-Location -Path 'C:\PJ\caro\backend\public'
php -S localhost:8001 router.php

Note: PHP backend uses port 8001 because Node.js socket server uses port 8000

### Socket server (Node)

cd /d C:\PJ\caro\server
npm install
node index.js

### Frontend (Vite)

cd /d C:\PJ\caro\frontend
npm install
npm run dev

### AI service (FastAPI)

# create venv and install
python -m venv .venv
.venv\Scripts\activate
pip install -r c:\PJ\caro\ai\requirements.txt
uvicorn ai.main:app --reload --port 8001

## Quick test of Supabase token verification
1. Login from frontend (Supabase auth) and obtain access token.
2. Call backend API creating a room with Authorization header:

# curl example (PowerShell):
$headers = @{ Authorization = "Bearer <ACCESS_TOKEN>" }
Invoke-RestMethod -Uri http://localhost:8000/api/rooms -Method Post -Body (@{ name = 'test' } | ConvertTo-Json) -ContentType 'application/json' -Headers $headers

The backend will attempt to verify the token via `SUPABASE_URL/auth/v1/user` and auto-assign the player id.

## Notes
- This lightweight backend approach uses Supabase `/auth/v1/user` to verify tokens; it's sufficient for demos but for production you'd validate JWT signatures locally or use a backend SDK.
- Do NOT commit service_role keys.
