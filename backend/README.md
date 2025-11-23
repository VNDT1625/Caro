Backend (PHP) — quick start

This is a lightweight skeleton. Recommended next steps:

1. Install Composer: https://getcomposer.org/
2. (Option A) Create a Laravel app here: `composer create-project laravel/laravel .` inside `backend/`.
3. (Option B) Keep this minimal structure and implement your own router and services.

Dev server (quick test):

```powershell
# from project root
php -S localhost:8000 -t backend/public
```

DB and realtime recommendations:
- Use PostgreSQL or MySQL for persistent data
- Use Redis for matchmaking/queues
- For WebSockets: consider Laravel WebSockets or a Node-based Socket server with Redis adapter.

Supabase quick note:
- To start fast you can use Supabase (managed Postgres + Auth + Storage).
- If using Supabase for MVP, copy DB connection values into `backend/.env.supabase.example` and set your frontend `VITE_SUPABASE_*` variables.
- Do NOT rely on Supabase Realtime for core gameplay moves; use a dedicated websocket service for low-latency events.