# MindPoint Arena (Caro) - Huong dan chay full stack

MindPoint Arena gom 4 dich vu: frontend React/Vite, backend PHP, socket server Node (Socket.IO) va dich vu AI FastAPI. Duoi day la cac buoc de dung toan bo he thong tren may ca nhan.

## Kien truc nhanh
- Frontend `frontend/` (React + Vite + TS) chay tai `http://localhost:5173`
- Backend PHP `backend/` phuc vu API REST va goi AI, chay tai `http://localhost:8001`
- Socket server `server/` (Node + Socket.IO) chay tai `ws://localhost:8000`
- AI service `ai/` (FastAPI) chay tai `http://localhost:8004` (port 8004 do tranh xung dot browser extension)
- Ket noi: Frontend -> Backend `http://localhost:8001/api/*`; Frontend -> Socket `ws://localhost:8000`; Backend -> AI `http://localhost:8004` (cau hinh qua `AI_SERVICE_URL`)

## Yeu cau
- Node.js 18+ va npm
- PHP 8.1+ va Composer
- Python 3.10+ va pip (khuyen nghi dung virtualenv)
- Tai khoan Supabase (Postgres + Auth + Storage)
- (Tuy chon) ngrok de expose backend cho callback
- Vi du lenh ben duoi dung PowerShell tren Windows; macOS/Linux doi cu phap kich hoat venv cho phu hop

## Thiet lap dependencies
```powershell
# Frontend
cd frontend
npm install

# Socket server
cd ../server
npm install

# PHP backend
cd ../backend
composer install

# AI service
cd ../ai
python -m venv .venv
.\.venv\Scripts\Activate.ps1      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

## Cau hinh moi truong
- `frontend/.env` (copy tu `.env.example`):
  ```env
  VITE_SUPABASE_URL=https://<project>.supabase.co
  VITE_SUPABASE_ANON_KEY=<public-anon-key>
  VITE_SUPABASE_AVATAR_BUCKET=avatars
  VITE_API_URL=http://localhost:8001
  VITE_AI_URL=https://openrouter.ai/api/v1/chat/completions   # hoac http://localhost:8002 neu dung AI noi bo
  VITE_AI_API_KEY=                                            # bat buoc khi goi OpenRouter
  VITE_AI_MODEL=tngtech/deepseek-r1t2-chimera:free
  VITE_AI_TRIAL_EMAIL_REGEX=.*@.+\.edu(\.vn)?$
  ```

- `backend/.env` (chon mot mau roi doi gia tri):
  - Dung DB tu quan: copy `backend/.env.example`, chinh `DB_*`, `APP_URL=http://localhost:8001`, thong tin VNPAY sandbox neu can.
  - Dung Supabase: copy `backend/.env.supabase.example`, dien `DB_*` tu Supabase, them `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Dat `AI_SERVICE_URL=http://localhost:8004` de tro dung dich vu AI.
  - Neu muon bat phan tich gian lan qua OpenRouter: dien `AI_API_URL`, `AI_API_KEY`, `AI_MODEL`.

- `server/.env` (tu tao, khong co file mau):
  ```env
  PORT=8000
  SUPABASE_URL=https://<project>.supabase.co
  SUPABASE_ANON_KEY=<public-anon-key>
  SUPABASE_SERVICE_KEY=<service-role-key>    # bat buoc cho xac thuc/ban be
  PHP_BACKEND_URL=http://localhost:8001      # REST backend cho su kien game
  BACKEND_API_URL=http://localhost:8001      # fallback
  ```

- `ai/.env` (tuy chon neu dich vu AI goi OpenRouter truc tiep):
  ```env
  OPENROUTER_API_KEY=<your-key>
  ```

- Dam bao cac cong trong: 5173 (frontend), 8000 (socket), 8001 (backend), 8004 (AI). Neu doi cong, cap nhat dong bo trong `.env`.

## Chay toan bo (4 terminal)
Terminal 1 - PHP backend:
```powershell
cd backend/public
php -S localhost:8001 router.php
```

Terminal 2 - Socket server:
```powershell
cd server
npm start
```

Terminal 3 - AI service:
```powershell
cd ai
.\.venv\Scripts\Activate.ps1      # neu da tao venv
uvicorn main:app --port 8004
```

Terminal 4 - Frontend:
```powershell
cd frontend
npm run dev -- --host --port 5173
```

Mo trinh duyet tai `http://localhost:5173`. (Tuy chon) Terminal 5: `ngrok http 8001` de nhan URL public cho callback VNPAY hoac test ben ngoai.

## Lenh kiem tra nhanh
- Frontend: `cd frontend && npm run lint`
- Backend: `cd backend && ./vendor/bin/phpunit --testdox`
- AI: `cd ai && python -m pytest ai/tests -v`

## Ghi chu them
- Schema Supabase va migrations nam trong thu muc `infra/`.
- Giao thuc realtime/Socket.IO xem `docs/REALTIME_INTEGRATION_GUIDE.md`.
- Khi doi cong AI service, cap nhat `AI_SERVICE_URL` (backend) va `VITE_AI_ANALYSIS_URL` neu frontend goi truc tiep.
- Khong commit cac gia tri secret trong `.env`.
