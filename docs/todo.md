# TODO — MindPoint Arena (Ưu tiên & trạng thái)

**Progress: 34%**

Ghi chú: trạng thái = not-started / in-progress / completed

## Mức ưu tiên: Cao
- [x] Frontend skeleton (React + Vite) — `frontend/` — completed
  - Trạng thái: completed
  - Ghi chú: đã cài dependencies, dev server chạy.
- [x] GameEngine (server-side) — validate move, checkWinner
  - Trạng thái: completed (basic checkWinner implemented)
  - Ước lượng: 1–3 giờ
- [ ] Backend full (Laravel) — scaffold + auth + API create/join room
  - Trạng thái: partially-completed (lightweight API endpoints implemented)
  - Ước lượng: 1–2 ngày (scaffold) + thêm endpoints
- [ ] Realtime (room/moves) — server-authoritative
  - Trạng thái: completed (Node Socket.IO server skeleton available in `server/`)
  - Ghi chú: ban đầu dùng Laravel WebSockets; khi scale -> Node + Redis

## Mức ưu tiên: Trung bình
- [ ] Matchmaking queue (Redis) — basic rank matching
  - Trạng thái: completed (simple in-memory matchmaking added to `server/index.js`)
  - Ước lượng: 1–2 ngày
- [ ] Store (skins) + simple payment flow (mock)
  - Trạng thái: completed (mock store endpoints added to `server/`)
  - Ước lượng: 3–5 ngày
- [ ] AI service skeleton (FastAPI) — suggestion + analysis endpoints
  - Trạng thái: completed (skeleton FastAPI service in `ai/`)
  - Ước lượng: 1 tuần (basic)

## Mức ưu tiên: Thấp
- [ ] 3D assets & Three.js integration (optional)
  - Trạng thái: placeholder created (`frontend/src/3d/README.md`)
  - Ghi chú: làm sau khi 2D ổn định
- [ ] Tournament system, Leaderboard nâng cao
  - Trạng thái: not-started (placeholder endpoints can be added)

## Công việc đã làm / ghi chú kỹ thuật
- [x] Tạo `docs/business_plan.md` — completed
- [x] Tạo `docs/lessons.md` — completed
- [x] Tạo `docs/mapping.md` — completed
- [x] Tạo `frontend/.env.example`, `frontend/src/...` cơ bản — completed
- [x] Thêm `backend/.env.supabase.example`, `backend/README.md` — completed

## Nhiệm vụ tức thời (next actions) — ưu tiên hàng đầu
1. (High) Viết `GameEngine::checkWinner()` trong `backend/app/GameEngine.php` và unit test — bắt đầu ngay.  
2. (High) Nếu bạn muốn demo nhanh: kết nối Supabase cho auth/DB (mình có thể hướng dẫn chi tiết).  
3. (Medium) Implement Room UI (2D board) giao tiếp mock với GameEngine.  

---
Bạn có thể cập nhật trạng thái các task bằng cách chỉnh file này hoặc bảo mình cập nhật (tôi sẽ sửa và commit vào repo theo yêu cầu).