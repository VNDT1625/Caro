# Repository Guidelines

## Agent Notes
- Luon tra loi bang tieng Viet trong cac phien lam viec voi nguoi dung.
- Quy trinh fix bug chuyen nghiep:
  - Xac nhan va tai hien: thu thap mo ta, log, moi truong; viet lai cac buoc tai hien ngan gon.
  - Khoanh vung nguyen nhan: doc log/trace, tang log level khi can, dung breakpoint/profiler, thu hep toi module/ham/dong gay loi.
  - Viet test tai hien: bo sung test (unit/integration/e2e) that bai truoc khi sua, dung du lieu thuc te.
  - Sua nho nhat co the: giu thay doi toi thieu, tuan thu style; chay lint + test lien quan, dam bao test moi pass.
  - Rasoat va hoi quy: code review tap trung vao do an toan, hieu nang, concurrency; chay smoke/regression suite hoac kich ban thu cong quan trong.
  - Trien khai an toan: dung feature flag/canary neu co; giam sat metrics/log/alert; san phuong an rollback.
  - Don dep va ghi nhan: xoa log tam, cap nhat changelog/tai lieu; dong issue kem buoc tai hien, nguyen nhan, cach khac phuc, test da chay.
- Quy trinh tao chuc nang moi:
  - Lam ro yeu cau: dac ta dau ra, pham vi, tieu chi chap nhan, rui ro.
  - Thiet ke ngan: phan tach module/API, data model, RLS/phan quyen, UX flow; chot bien the/tinh huong xau.
  - Lap ke hoach test: dinh nghia test cases (unit/integration/e2e), tinh nang quan sat/telemetry can log.
  - Thuc thi theo buoc nho: tao skeleton, wiring, logic, UI; commit nho de de review.
  - Tu kiem tra: chay lint/test; smoke flow chinh; ghi lai cac test da chay.
  - Review va trien khai an toan: PR review theo checklist; dung flag/canary neu tinh nang nhay cam.
- Quy trinh kiem tra chuyen sau tim loi:
  - Lap danh sach kich ban quan trong/ngoai le: du lieu bien, duong bien, luu luong song song, retry, mat ket noi, timeout.
  - Phu song testing: unit (ham tinh), integration (API + DB + cache), e2e (user flow chinh), property-based cho logic tinh toan, fuzz input cho API quan trong.
  - Quan sat he thong: bat log chi tiet co dieu kien, them metric/trace cho duong code nhay cam, kiem tra memory/CPU/latency qua profiling.
  - Thu nghiem hoi quy thu cong: chay cac thao tac user pho bien va edge cases da gap trong qua khu.
  - Thu them gia lap su co: cat mang, cham truong hop, mat token, du lieu bi thieu, DB tra ve loi; dam bao he thong xu ly on dinh.

## Getting Started (Full Stack)

### Prerequisites
- Node.js 18+ & npm
- PHP 8.1+ & Composer
- Python 3.10+ & pip
- Supabase account (for DB)
- ngrok (optional, for external callbacks)

### Setup Steps
1. **Clone & install dependencies**
   ```bash
   git clone <repo> && cd caro
   cd frontend && npm install && cd ..
   cd server && npm install && cd ..
   cd backend && composer install && cd ..
   cd ai && pip install -r requirements.txt && cd ..
   ```

2. **Configure environment files**
   - `frontend/.env` — Supabase URL/key
   - `server/.env` — Supabase keys
   - `backend/.env` — Supabase keys, VNPAY config
   - `ai/.env` — OPENROUTER_API_KEY (if needed)

3. **Start services (in order)**
   ```bash
   # Terminal 1: PHP backend
   cd backend/public && php -S localhost:8001 router.php

   # Terminal 2: Socket server
   cd server && npm start

   # Terminal 3: AI service (port 8004 do browser extension redirect)
   cd ai && uvicorn main:app --port 8004

   # Terminal 4: Frontend
   cd frontend && npm run dev

   # Terminal 5 (optional): ngrok for external access
   ngrok http 8001
   ```

4. **Open browser**: http://localhost:5173

## Service Communication
- **Frontend → PHP backend**: `http://localhost:8001/api/*` (or ngrok URL for external)
- **Frontend → Socket server**: `ws://localhost:8000`, events: `join_room`, `make_move`, `game_over`, `chat_message`, `rematch_request`
- **Backend → AI service**: `http://localhost:8004/analyze`, `/explain-mistake`, `/replay/*`
- See `docs/REALTIME_INTEGRATION_GUIDE.md` for detailed socket protocol.

## Project Structure & Module Organization
- `frontend/` React + Vite TypeScript UI (pages/components/hooks/locales), served by `npm run dev`; assets in `public/`, global styles in `styles.css`.
- `backend/` PHP 8 skeleton with PSR-4 autoload via Composer; HTTP entry in `public/`, domain services under `app/`, tests in `tests/`.
- `server/` Socket.IO Node server (`index.js`, helpers in `game/` and `scripts/`) for realtime rooms.
- `ai/` FastAPI Python analysis service (`ai/main.py`, domain logic in `analysis/` and `replay/`, tests in `ai/tests/`).
- `docs/` specs/feature plans; `infra/` Supabase schema + migrations; `scripts/` misc tooling; shared assets under `assets/`.

## Build, Test, and Development Commands
- Frontend: `cd frontend && npm run dev` — port **5173**
- Socket server: `cd server && npm start` — port **8000** (reads `.env` for Supabase keys)
- PHP backend: `cd backend/public && php -S localhost:8001 router.php` — port **8001**
- AI service: `cd ai && uvicorn main:app --port 8004` — port **8004** (changed from 8002 due to browser extension)
- Ngrok (expose PHP backend): `ngrok http 8001` — provides public HTTPS URL for external access (e.g., VNPAY callbacks)
- Tests: Backend `./vendor/bin/phpunit --testdox`; AI `python -m pytest ai/tests -v`

## Coding Style & Naming Conventions
- PHP: PSR-4 namespaces under `App\`; PSR-12 formatting (4-space indent, typed properties/params, docblocks); tests suffixed `*Test.php` or `*PropertyTest.php`.
- Frontend TS/JS: 2-space indent, single quotes, semicolon-less; components/hooks in PascalCase; types in `src/types`.
- Node server: CommonJS modules, async/await, centralized env access; avoid console noise in production.
- Python: type hints and docstrings; pure functions where possible; pytest/Hypothesis property-based style.

## Lint & Format Tools
- PHP: `php-cs-fixer` (PSR-12)
- Frontend: `eslint` + `prettier` — run `npm run lint`
- Python: `black` + `isort` — run `black . && isort .`
- Before commit: `cd frontend && npm run lint; cd ../backend && composer test; cd ../ai && python -m pytest`

## Testing Guidelines
- Backend: PHPUnit + Eris property tests in `backend/tests`. Run `./vendor/bin/phpunit --testdox`.
- Frontend: Vitest + Testing Library; specs as `*.test.ts(x)` alongside modules; mock Supabase.
- AI: `python -m pytest ai/tests -v`; prefer property-based tests for analysis logic.
- Socket server: verify events against running frontend when changing protocols.
- **Rules**: Don't merge if tests red. Add test when fixing bugs. AI service prioritizes property-based tests.

## Branching & CI
- Main branch: `main` — PRs target here by default
- Feature branches: `feature/<name>`, bugfix: `fix/<name>`
- CI runs tests on PR open (PHPUnit, pytest, vitest)
- Don't merge if tests are red

## Commit & Pull Request Guidelines
- Commits: short, imperative messages; optional scope prefix (e.g., `infra: add migrations`)
- PRs: summary of change, linked issue, env files touched, test results, screenshots for UI changes
- Note breaking API/event changes for frontend/server clients

## Security & Configuration Tips
- Copy env templates: `frontend/.env.example`, `backend/.env.supabase.example`, `server/.env`. Never commit Supabase service keys or OpenRouter tokens.
- Keep secrets out of logs and docs; prefer local `.env` over hardcoding.
- Validate inputs on socket/server endpoints; treat Supabase tokens as untrusted.
- **CORS**: Backend allows `localhost:5173` in dev; configure for production domain.
- **Rate limiting**: Socket events (`join_room`, `chat_message`) have anti-spam limits in `server/index.js`.
- **Logging**: Never log full auth tokens or sensitive headers; redact in production.

## Database Schema (Supabase)
Key tables: `profiles`, `matches`, `ranked_series`, `subscriptions`, `usage_logs`, `analysis_cache`, `reports`, `appeals`, `user_bans`. See `infra/supabase_schema.sql` and `infra/migrations/` for details.

## Domain Knowledge
- **Gomoku rules**: 15x15 board, 5-in-a-row wins, Black plays first
- **Swap2 opening**: After 3 stones, opponent chooses color or places 2 more stones
- **Ranked system**: Bo3 series, ELO-based rating, see `.kiro/specs/ranked-bo3-system/`

## Common Pitfalls
- **CORS errors**: Check backend allows frontend origin; use ngrok for external testing
- **RLS policies**: Supabase Row Level Security may block queries; check `infra/migrations/`
- **Port conflicts**: Ensure 5173, 8000, 8001, 8004 are free before starting
- **Socket disconnect**: Frontend must handle reconnection; see `useSeriesRealtime.ts`

## Service Dependencies
- Frontend requires: Socket server (realtime), PHP backend (API)
- PHP backend requires: Supabase (DB), AI service (analysis)
- AI service: standalone, but called by backend for match analysis
