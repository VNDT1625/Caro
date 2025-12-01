# MindPoint Arena — Full Technical & Product Spec (Consolidated)

This document consolidates the entire project vision and the current implementation direction into a single, AI‑friendly reference. It is designed for report writing, technical onboarding, and future planning. It merges core ideas from `docs/project_summary.md` and `docs/thongtindoan1.md` with practical, implementable details for the MVP and beyond.

## 1. Executive Overview
- Product: MindPoint Arena — web‑based Caro (Five‑in‑a‑Row) with rank system (MindPoint), realtime PvP, casual modes, AI opponents, and match replay.
- Goal (MVP): Playable web game with rooms, matchmaking (basic), smooth gameplay, server‑authoritative validation, and stored match history.
- Audience: Students/engineers building a demo in weeks, with a clear path to scale.

## 1.1 Technology Stack (Explicit)
- Frontend: React + TypeScript + Vite; optional Three.js for 3D; state via Zustand/React Context; testing with Vitest.
- Backend: PHP (Laravel) for REST APIs and server‑authoritative `GameEngine`; PHPUnit for tests.
- Realtime: Node.js + Socket.IO microservice (MVP) or Laravel WebSockets; Redis adapter for scaling.
- AI Service: Python + FastAPI + Uvicorn; heuristics initially, optional LLM integration later.
- Database: Supabase (Postgres) for MVP Auth/DB; migration path to managed Postgres.
- Storage: Supabase Storage/S3 for assets and replays.
- Infra/Dev: Docker Compose (optional) for Postgres/Redis; Deploy via Vercel/Netlify (FE), Render/Heroku/VPS (BE/Socket/AI).
- Tooling: ESLint + Prettier; PHPCS optional; CI with GitHub Actions (planned).

## 1.2 Feature Matrix (What the product includes)
- Core Gameplay: 1v1 Caro with 5‑in‑a‑row; fixed or dynamic board.
- Rooms & Lobby: create/join rooms, private/public, room settings.
- Matchmaking (Rank): basic queue matching by rank/elo; tolerance expansion.
- Rank System (MindPoint): staged tiers, match points, seasonal decay, leaderboard.
- Timers: per‑move countdown with forfeit on expiry.
- Chat & Presence: in‑room chat, online presence via sockets.
- AI Play: vs AI with multiple difficulty levels; post‑match analysis (planned).
- Replay & History: persist moves; replay viewing.
- Profile: user info, stats, rank history.
- Store & Cosmetics: skins/cosmetics (roadmap), non‑intrusive effects.
- Admin & Moderation: reports, rank config, decay runs, audit logs.

## 1.3 Highlights (What’s notable)
- Server‑authoritative GameEngine ensures fair play and consistent rule enforcement.
- Sparse board representation enables effectively “infinite” rank boards without memory blowups.
- MindPoint rank system blends points, tiers, and seasonal decay with soft‑demotion.
- Dual realtime options: quick Node Socket.IO or integrated Laravel WebSockets.
- AI service designed modularly: start with heuristics, upgrade to LLM/ML without breaking contracts.
- Replay‑first design: every match can be reconstructed for debugging, analytics, and coaching.

## 2. Core Gameplay
- Rules: 2 players (X/O) take turns placing marks on a grid; 5 contiguous marks (horizontal/vertical/diagonal) win.
- Boards:
  - Rank: theoretically unbounded board; practical implementation uses large dynamic grid with virtual paging.
  - Casual modes: fixed sizes (e.g., 9x9, 15x15). Variants like “win length” configurable (3/4/5/…).
- Turn & Timer:
  - Rank: per‑move timer 30s decreasing toward 15s for higher ranks.
  - Casual: configurable (min 5s; can be unlimited). Server tracks timers and enforces forfeits.
- End states: Win (5‑in‑a‑row), Draw (board full or stalemate—mode dependent), Forfeit (timeout or leave).

## 3. Modes & Variants (Roadmap)
- Standard Rank (MindPoint): competitive queue with rank progression.
- Casual Rooms: invite friends, customize board size/win length/timer.
- AI Duels: play versus AI at multiple skill levels (Nhập Môn, Kỳ Tài, Nghịch Thiên).
- Entertainment Variants (optional for later):
  - Caro Skill (special actions: swap, block line, remove move)
  - Caro Ẩn (pieces fade every 3 moves)
  - Caro theo cặp (2v2 alternating turns)
  - Caro Địa Hình (special tiles, score‑based win)

## 4. Rank System (MindPoint)
- Tiers: Vô Danh → Tân Kỳ → Học Kỳ → Kỳ Lão → Cao Kỳ → Tam Kỳ → Đệ Nhị → Vô Đối.
- Lower stages (Vô Danh → Học Kỳ): sub‑branches Sơ/Trung/Cao (1→3) + Vượt Cấp.
- Scoring (lower stages) per match: points = (MoveCountScore + TimeDiffScore + RankBase + 5) × Result
  - MoveCountScore: <10→10; <20→7; ≥20→5
  - TimeDiffScore: opponent time vs player time: >2×→10; >1.5×→7; else→5
  - RankBase: Vô Danh→10; Tân Kỳ→7; Học Kỳ→5
  - Result: Win→+1; Loss→−1 (applied to computed points)
  - Progression: +100 points per sub‑branch up.
- Higher stages (Học Kỳ — Vượt Cấp → Kỳ Lão+): focus on MatchPoint = (MoveCountScore + TimeDiffScore + 5) × RankDelta
  - RankDelta:
    - Player higher rank: Win→0.5; Loss→−1.5
    - Player lower rank: Win→1.5; Loss→−0.5
- Decay System (seasonal): subtract fraction of points above floor per season, modulated by matches played.
  - base_decay_pct by rank (e.g., Vô Đối→5%, Cao Kỳ→12%, …).
  - activity_multiplier: ≥20 matches→0.0; 10–19→0.5; 1–9→1.0; 0→1.5.
  - Soft‑demotion protection window (probation) if crossing into lower rank.
- Anti‑abuse: smurf/boost detection via anomaly logs, queues for suspected accounts, rank freeze + verification.

## 5. System Architecture
- Frontend: React + TypeScript + Vite. Optional 3D via Three.js; MVP uses 2D Canvas/SVG/HTML for board.
- Backend: PHP (Laravel skeleton present) for REST APIs and authoritative GameEngine; optional Node.js Socket.IO service for realtime events.
- Realtime: Option A Node Socket.IO microservice; Option B Laravel WebSockets. Redis recommended for scaling presence/pub/sub.
- AI Service: Python + FastAPI, endpoints for `suggest_move`, `analyze`, `chat`.
- Database: Supabase (Postgres) for MVP (Auth, tables, storage). Future: managed Postgres + Redis.
- Storage: Supabase Storage / S3 for replays/assets.

## 6. Folder Structure (current workspace)
- `frontend/` — React + TS skeleton.
- `backend/` — Laravel app with `GameEngine.php` and tests in `tests/`.
- `server/` — Node (Socket/room logic) scaffold.
- `ai/` — Python FastAPI skeleton.
- `infra/` — SQL/migrations/automation for Supabase & realtime setup.
- `docs/` — specs, reports, and planning documents.

## 7. Frontend Detail
- Tech: React + TypeScript, Vite build; optional Zustand/Context for global state.
- Proposed structure:
  - `src/pages`: `Lobby`, `Room`, `Profile`, `Store`, `Auth`.
  - `src/components`: `Board`, `Cell`, `Chat`, `Timer`, `PlayerBadge`, `Modal`.
  - `src/lib`: `supabase.ts`, `api.ts`, `socket.ts`, `game/checkWinner.ts`.
  - `src/state`: user session, room state, match state.
- Networking:
  - REST via backend for auth/rooms/matches.
  - WebSocket (Socket.IO client) for realtime moves/presence/chat.
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, `VITE_SOCKET_URL`.
- Board rendering:
  - 2D grid with virtualized view for large boards (rank mode).
  - Client shows ghost move; server validates; on accept, broadcast and render.
- UX basics: turn indicator, timer bar, simple chat, modal for end states.

## 8. Backend Detail (Laravel)
- Core modules:
  - Auth: register/login/me.
  - Rooms: create/list/join.
  - Matches: create/fetch; move submission; history; replay.
  - GameEngine (server‑authoritative): validate legality, apply move, check win/draw, manage timers.
- REST API (baseline):
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/rooms` (mode, board_size, win_length, is_private)
  - `GET /api/rooms`
  - `POST /api/rooms/:id/join`
  - `POST /api/matches` (room_id, players, settings)
  - `GET /api/matches/:id`
  - `POST /api/matches/:id/move` (x, y, player, client_move_index)
- Policies:
  - Server is source of truth; rejects illegal/out‑of‑turn moves.
  - Move index protects against reordering/duplication.
  - Timer enforcement yields automatic forfeit when expired.

## 9. Realtime Service (Node Socket.IO)
- Events:
  - `joinRoom`, `leaveRoom`, `matchStart`, `playerMove`, `matchEnd`, `chatMessage`, `presence`.
- Flow:
  - Client connects → joins room → ready → server broadcasts match state.
  - Player moves emitted; server forwards to backend or validates locally (depending on authority model).
- Scaling:
  - Redis adapter for multi‑instance pub/sub.
  - Sticky sessions or stateless events with room membership tracking.

## 10. AI Service (Python FastAPI)
- Endpoints:
  - `POST /ai/suggest_move` — input: board, turn, mode; output: best move (x,y).
  - `POST /ai/analyze` — input: board, history; output: evaluation and suggestions.
  - `POST /ai/chat` — assistant coach constrained to Caro domain.
- Implementation notes:
  - Simple heuristic engine for MVP (patterns/threats). Later integrate LLMs/NNs.
  - Auth: proxy via backend or per‑user API keys.

## 11. Data Model (MVP)
- `users(id,email,display_name,avatar,rank,elo,created_at)`
- `rooms(id,owner_id,mode,board_size,win_length,is_private,created_at)`
- `matches(id,room_id,player_x,player_o,state,started_at,ended_at)`
- `moves(id,match_id,player,position_x,position_y,move_index,timestamp)`
- Optional: `ratings(user_id,points,rank_tier,season)`, `items`, `skins`, `achievements`.

## 12. Game Logic (Authoritative)
- Board state: sparse representation (map of coordinates → player) for large boards.
- Validation:
  - Check turn order; ensure cell is empty; enforce within bounds if fixed board.
  - Apply move; recompute last‑move victory via directional scanning (4 directions × both sides).
- Win check (5‑in‑a‑row): scan counts in directions (Δx,Δy): (1,0), (0,1), (1,1), (1,−1).
- Draw: fixed board full or mutually forced stalemate (rare; configurable).
- Timers:
  - Per‑move countdown; server triggers forfeit upon expiration.
- Replay:
  - Persist sequence of moves; reconstruct board incrementally for review.

## 13. Matchmaking (MVP → Advanced)
- MVP: simple queue matching nearest rank/elo; fallback within tolerance window.
- Inputs: player rank points, current tier; mode; region (optional).
- Constraints: avoid large rank gap; prefer similar latency.
- Advanced: dynamic tolerance growth, queue buckets, party matching for 2v2 variant.

## 14. Security & Fair Play
- Smurf/Boost countermeasures:
  - Anomaly logging: abnormal win rate at low rank, ultra‑fast reaction times, device/IP fingerprint changes.
  - Suspect queue: match suspected smurfs together.
  - Rank freeze + verification (Face ID/OTP) if sudden performance drop.
  - Report flow: admin receives reports; soft actions during 7‑day review; retroactive penalties.
- Cheating mitigation:
  - Server‑authoritative validation; no client‑side trust.
  - WebSocket message signing or token auth per session.
  - Rate limits on move/chat.

## 15. Admin & Operations
- Admin panel:
  - User management, room moderation, match logs, reports.
  - Rank/decay configuration; seasonal ops.
- Telemetry:
  - Log match lifecycle, move latencies, disconnects, timers, AI usage.
- Audit:
  - Keep decay logs with pre/post points, matches_played, multiplier, reasons.

## 16. Deployment & Infra
- Local dev:
  - Supabase or local Postgres; optional Redis via Docker.
  - Frontend: Vite dev server.
  - Backend: Laravel with `.env` and migrations.
  - AI: FastAPI with Uvicorn.
- Suggested deploy targets:
  - Frontend → Vercel/Netlify.
  - Backend → Render/Heroku/VPS.
  - Socket → Render/VPS with Redis adapter.
  - AI → VPS/cloud GPU if needed.

## 17. Environment Variables
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, `VITE_SOCKET_URL`.
- Backend: `APP_URL`, `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_SERVICE_KEY` (if used), socket config.
- AI: `AI_SERVICE_KEY` (if using third‑party), rate limit configs.

## 18. APIs — Payload Contracts (Examples)
- `POST /api/matches/:id/move`
  - Request:
    ```json
    {
      "match_id": "uuid",
      "player_id": "uuid",
      "x": 7,
      "y": 5,
      "client_move_index": 12
    }
    ```
  - Response:
    ```json
    {
      "accepted": true,
      "server_move_index": 12,
      "board_delta": {"x":7,"y":5,"player":"X"},
      "win": false,
      "next_player": "O",
      "timer_ms": 30000
    }
    ```
- Socket events:
  - `playerMove` payload mirrors REST; server broadcasts accepted moves with `server_move_index` and win/draw flags.

## 19. Testing Strategy
- Unit: `checkWinner` in frontend (Vitest) and `GameEngine` in backend (PHPUnit).
- Integration: REST endpoints for rooms/matches/moves; mock sockets.
- E2E: two clients playing via dev server; verify timers, win detection, replay storage.
- Lint/format: ESLint + Prettier (frontend); PHPCS (backend) optional.

## 20. Roadmap & Phases
- Phase 0: scaffold frontend/backend; basic models; Supabase setup.
- Phase 1 (MVP):
  - Backend: auth, room, match creation, move validation (`GameEngine`).
  - Realtime: basic Socket.IO events for rooms/moves.
  - Frontend: Lobby/Room, 2D board, timers, simple chat.
  - Storage: save matches & replays.
- Phase 2: analytics, matchmaking improvements, rank system operational, AI basic.
- Phase 3: scale sockets, store/monetization, battle pass, advanced AI.

## 21. Risks & Mitigations
- Realtime lag: separate socket service; Redis; optimize payloads.
- Low retention: strong UX/tutorials; events; rewards.
- Hosting costs: start on free tiers; optimize assets.
- Logic bugs: thorough unit tests; server‑authoritative checks; replay‑based debugging.

## 22. Glossary
- MindPoint: rank system with staged progression, match points, seasonal decay.
- Server‑authoritative: server validates all moves; client is a thin UI.
- Replay: stored move history to reconstruct match for review.

## 23. Quick Dev Commands (Windows cmd.exe)
```
cd frontend
npm install
npm run dev

cd ..\backend
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate

cd ..\ai
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn ai.main:app --reload
```

## 24. Implementation Notes (Practical Tips)
- Use sparse board maps to avoid huge arrays in rank mode.
- Keep move payloads minimal; include `client_move_index` to detect duplicates.
- Timer source of truth on server; clients display mirror countdown.
- Store match replays as JSON arrays of moves with metadata.
- Decay configs stored in DB and adjustable via admin.

---
This spec is intended to be stable enough for AI report generation and human onboarding, while remaining flexible for iterative MVP development.

## 25. Deep Dive Addendum (Full Detail)

### 25.1 Complete API Catalogue (v1)
- Auth
  - `POST /api/auth/register` — body: `email,password,display_name`; returns `user,token`.
  - `POST /api/auth/login` — body: `email,password`; returns `user,token`.
  - `GET /api/auth/me` — header: `Authorization: Bearer <token>`; returns `user`.
- Users
  - `GET /api/users/:id` — public profile.
  - `PATCH /api/users/:id` — update display_name/avatar; owner only.
- Rooms
  - `POST /api/rooms` — body: `{mode,board_size,win_length,is_private}`; returns `room`.
  - `GET /api/rooms` — query: `mode,is_open`; returns open rooms.
  - `POST /api/rooms/:id/join` — join room; returns room state.
  - `POST /api/rooms/:id/start` — owner starts match; returns `match`.
  - `DELETE /api/rooms/:id` — owner closes room.
- Matches
  - `POST /api/matches` — create match (outside rooms) with settings.
  - `GET /api/matches/:id` — match state, players, settings, last move index.
  - `GET /api/matches/:id/replay` — array of moves with timestamps.
  - `POST /api/matches/:id/move` — submit move; returns acceptance/win/draw/next player.
  - `POST /api/matches/:id/forfeit` — player forfeits; match ends.
  - `POST /api/matches/:id/undo` — optional: request undo; server policy‑based.
- Ranking
  - `GET /api/rank/leaderboard` — tier filters; top N.
  - `GET /api/rank/me` — current points, tier, branch, decay status.
  - `POST /api/rank/decay/run` — admin seasonal job.
- Admin
  - `GET /api/admin/reports` — list of player reports.
  - `POST /api/admin/reports/:id/resolve` — action: `accept|reject|verify`.
  - `PATCH /api/admin/config/rank` — base_decay_pct & thresholds.
  - `PATCH /api/admin/config/matchmaking` — tolerance windows.
- AI
  - `POST /ai/suggest_move` — body: `{board,turn,mode}`; returns `{x,y,score}`.
  - `POST /ai/analyze` — body: `{board,history}`; returns `{evaluation,lines}`.
  - `POST /ai/chat` — body: `{message,context}`; domain‑limited coach.

Error codes (example):
- `ROOM_FULL`, `ROOM_CLOSED`, `NOT_ROOM_OWNER`, `MATCH_NOT_FOUND`, `OUT_OF_TURN`, `CELL_OCCUPIED`, `INVALID_COORDINATE`, `TIMER_EXPIRED`, `AUTH_REQUIRED`, `RATE_LIMITED`.

### 25.2 Database Schema (DDL, Postgres / Supabase)
```sql
-- Users
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  display_name text,
  avatar text,
  rank_tier text default 'VoDanh',
  points int default 0,
  elo int default 1200,
  created_at timestamptz default now()
);

-- Rooms
create table rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  mode text not null, -- Rank|Casual|AI
  board_size int null, -- null for dynamic rank
  win_length int not null default 5,
  is_private boolean default false,
  is_open boolean default true,
  created_at timestamptz default now()
);

-- Matches
create table matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete set null,
  player_x uuid references users(id),
  player_o uuid references users(id),
  state jsonb not null default '{}', -- serialized minimal state
  started_at timestamptz default now(),
  ended_at timestamptz null,
  win_length int not null default 5,
  board_size int null,
  mode text not null
);

-- Moves
create table moves (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player text not null check (player in ('X','O')),
  position_x int not null,
  position_y int not null,
  move_index int not null,
  timestamp timestamptz default now(),
  unique (match_id, move_index),
  unique (match_id, position_x, position_y)
);

-- Ranking seasonal decay logs
create table rank_decay_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  pre_points int not null,
  post_points int not null,
  matches_played int not null,
  base_pct numeric not null,
  multiplier numeric not null,
  season text not null,
  created_at timestamptz default now()
);
```

Indexes: add btree indexes on `moves(match_id, move_index)`, `matches(room_id)`, `rooms(is_open, is_private)`.

### 25.3 GameEngine — Pseudocode & Edge Cases
State design:
- Board: sparse map `{"x,y": 'X'|'O'}` or two sets per player for O(1) occupancy.
- Turn: `'X'|'O'`.
- LastMoveIndex: int, starts at 0.
- Timers: per‑move deadline `deadline_ts` in server memory/store.

Pseudocode (move apply):
```
function submitMove(matchId, playerId, x, y, clientIdx):
  S = loadState(matchId)
  assert clientIdx == S.lastMoveIndex + 1
  assert S.turn belongsTo(playerId)
  assert cellEmpty(S.board, x, y)
  place(S.board, x, y, S.turn)
  if checkWin(S.board, x, y, S.winLength):
     endMatch(matchId, winner=S.turn)
     return {accepted:true, win:true}
  if fixedBoardFull(S):
     endMatch(matchId, draw=true)
     return {accepted:true, draw:true}
  S.turn = other(S.turn)
  S.lastMoveIndex += 1
  resetTimer(S)
  persist(S)
  return {accepted:true, next:S.turn}
```

Directional scan:
```
function checkWin(board, x, y, L):
  dirs = [(1,0), (0,1), (1,1), (1,-1)]
  for (dx,dy) in dirs:
    count = 1 + scan(board,x,y,dx,dy) + scan(board,x,y,-dx,-dy)
    if count >= L: return true
  return false
```

Edge cases:
- Duplicate `client_move_index` → reject with `OUT_OF_ORDER`.
- Very large coordinates (rank mode) → allow; but enforce bounds if mode has fixed size.
- Timer expiry during submit → server wins race; reject with `TIMER_EXPIRED` and forfeit.
- Disconnects: grace window; auto‑forfeit after threshold.

### 25.4 Matchmaking Algorithm (Detailed)
- Inputs: `tier`, `points`, `elo`, `mode`, `region`, `queue_time_ms`.
- Tolerance windows:
  - Initial: `elo ± 50`, same tier preferred.
  - Expanding: every 10s increase window by +50 ELO and allow adjacent tiers.
- Selection:
  - Bucket candidates by region → ping estimates → sort by proximity and queue time.
  - Choose symmetrical pairing; avoid repeat opponents if possible.
- Failover:
  - After 60s, allow cross‑region if queue low; notify user.

### 25.5 State Machines
- Match lifecycle: `Created → Ready → InProgress → Ended(win|draw|forfeit)`.
- Room lifecycle: `Open → Filled → Started → Closed`.
- Timer: `Idle → Running → Expired → Reset` per move.

### 25.6 Security & Performance Details
- Auth: JWT with short‑lived access + refresh; websocket auth via token at connect.
- Rate limiting: `POST /move` and chat; leaky bucket per user.
- Message signing: include `match_id`, `server_move_index`, `nonce` to prevent replay.
- Performance:
  - Sparse board keeps memory low.
  - Use integer keys `x<<16 | y` for fast maps in JS/PHP.
  - Batch writes of moves; async persistence of telemetry.

### 25.7 Admin Workflows
- Report handling: triage → assign random admin → action (`accept/reject/verify`) → user notified.
- Seasonal decay runbook: set season label → lock writes → compute per user → write logs → unlock.
- Config changes: maintain versioned config records; audit who changed what.

### 25.8 Configuration Reference
- Rank decay config
  - `base_decay_pct`: map tier→percentage.
  - `activity_thresholds`: [20, 10, 1, 0] → multipliers [0.0, 0.5, 1.0, 1.5].
- Matchmaking config
  - `elo_initial_window`: 50
  - `elo_expand_step`: 50
  - `expand_interval_ms`: 10000
  - `cross_region_timeout_ms`: 60000
- Timer config
  - `rank_timer_ms`: 30000 → 15000 (tier‑based)
  - `casual_min_timer_ms`: 5000

### 25.9 Logging & Analytics
- Events: `match_start`, `move_applied`, `win_detected`, `timer_expired`, `disconnect`, `chat_message`.
- Metrics: average move time, win rates per tier, queue time, AI usage.
- Storage: write to `matches`, `moves`, and an `events` table (optional) for analytics pipelines.

### 25.10 Client UX Contracts
- Board interactions: highlight legal cells; gray out occupied.
- Error handling: show short code and friendly message (e.g., `CELL_OCCUPIED → Ô đã có quân`).
- Sync model: optimistic UI until server response; reconcile with server index.

### 25.11 AI Evaluation Heuristics (MVP)
- Patterns: open‑four, blocked‑four, open‑three, double‑three; assign weighted scores.
- Threats: immediate opponent win → highest priority to block.
- Move ordering: center bias (for fixed boards), proximity to last moves.

### 25.12 Compliance & Privacy Notes
- Store minimal PII; prefer Supabase Auth for managed security.
- Face ID/OTP verification (boosting control) as optional feature; ensure consent and fallback verification.

### 25.13 Future Enhancements
- 2v2 mode with alternating turns; presence of spectators.
- 3D board via Three.js with low‑poly assets; switchable to 2D.
- Battle pass, achievements, cosmetics with in‑match effects (non‑intrusive).

### 25.14 Sample Sequence (Move)
1) Client emits `playerMove` `{match_id,x,y,client_move_index}`.
2) Socket relays → Backend validates in GameEngine.
3) Backend persists move → emits `moveAccepted` with `server_move_index`.
4) All clients update; winner/draw triggers `matchEnd` broadcast.

### 25.15 Admin SQL (Examples)
```sql
-- Update decay base percentage for a tier
update rank_config set base_pct = 0.12 where tier = 'CaoKy';

-- Leaderboard top 100 by points
select id, display_name, points, rank_tier
from users
order by points desc
limit 100;
```

### 25.16 Error Localization Map (VN)
- `AUTH_REQUIRED`: "Cần đăng nhập để tiếp tục."
- `ROOM_FULL`: "Phòng đã đủ người."
- `OUT_OF_TURN`: "Chưa đến lượt bạn."
- `CELL_OCCUPIED`: "Ô đã có quân."
- `INVALID_COORDINATE`: "Tọa độ không hợp lệ."
- `TIMER_EXPIRED`: "Hết thời gian, bạn đã thua lượt."
