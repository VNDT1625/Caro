MindPoint Arena — Kế hoạch 4 ngày để demo (ngắn gọn, hành động)

Mục tiêu trong 4 ngày: có demo chạy được với các chức năng bắt buộc:
- Đăng nhập / Đăng ký
- Tạo phòng, mời bạn, mời ngẫu nhiên (public invite / tìm trận)
- Ghép trận (matchmaking) cho 1v1 rank và casual
- Chơi 1v1 (mode rank + thường)
- Chat (trong phòng / trong trận)
- Chế độ chơi với máy (AI basic hoặc bot random)

Gợi ý kỹ thuật nhanh (để tiết kiệm thời gian)
- Auth + DB: Supabase (Auth + Postgres) — nhanh, không cần backend auth.
- Realtime (game/chat/match): nhỏ gọn Node.js + Socket.IO server (chỉ vài tệp). Server này làm source-of-truth cho trận (validate nước bằng JS checkWinner) và sẽ ghi replay/điểm vào Supabase via HTTP/pg client.
- Frontend: React (hiện có skeleton). Viết các page nhanh: Login, Lobby, Room, Profile.
- Game engine: implement checkWinner bằng JS (shared lib) để dùng cho frontend (mock) và server (node). Sau demo có thể port sang PHP nếu cần.

Bản tóm tắt tính năng tối thiểu (MUST)
1. Auth: Supabase Auth (email/password).  
2. Lobby: danh sách phòng, nút tạo phòng (public/private), invite link (room id).  
3. Friends: add bằng ID (simple DB relation).  
4. Matchmaking: queue đơn giản theo rank (Node server lưu hàng đợi memory hoặc Redis nếu có).  
5. Room: realtime via Socket.IO; events: join, leave, move, chat, start, end.  
6. Game rules: 2 người, 5 in a row, timer optional (for demo, timer on frontend).  
7. Bot: AI cơ bản — random move hoặc simple heuristic (first free near last moves).

Nguyên tắc thực hiện (đừng làm quá nhiều):
- Làm feature hoàn chỉnh nhưng đơn giản (no polish). UX có thể thô nhưng tính năng phải hoạt động.
- Bỏ các tính năng không bắt buộc (3D, skins, premium AI) — ghi là backlog.
- Giao diện 2D đơn giản: lưới canvas hoặc table; click để đặt nước.

Lộ trình 4 ngày (chi tiết)

Ngày 1 — Cơ bản (Auth + Lobby + DB) — ưu tiên cao
- Sáng
  - Thiết lập Supabase project (tạo project, bật Auth). Ghi `VITE_SUPABASE_*` vào `frontend/.env`.
  - Tạo bảng DB cơ bản (Supabase SQL → run): `users` (nếu dùng Supabase Auth, users table có sẵn), `profiles`, `rooms`, `matches`, `moves`, `friends`, `rank`.
- Chiều
  - Frontend: implement Login/Register (Supabase client già có) + redirect vào Lobby.
  - Lobby page: create room (POST to Node server or create row in `rooms` table), list public rooms (select from Supabase).
- Deliverable cuối ngày: có thể đăng nhập, tạo phòng, thấy danh sách phòng.

Ngày 2 — Room + Chat + Friends + Invite — ưu tiên cao
- Sáng
  - Node Socket.IO server skeleton (server.js): events `connection`, `join_room`, `leave_room`, `move`, `chat`, `start_match`.
  - Implement in-memory rooms and simple join logic.
- Chiều
  - Frontend Room page: join room via socket, show chat, show list players, invite link copy.
  - Friends: profile page + add friend by ID (write to Supabase `friends` table).
- Deliverable cuối ngày: join room realtime + chat + invite + friend add.

Ngày 3 — Gameplay (1v1) + Matchmaking + Bot — ưu tiên rất cao
- Sáng
  - Implement shared `checkWinner.js/ts` (pure function) and `Board` component (click to place). Test local in frontend (mock local game vs self).
  - Server: implement server-side move handling: on `move` event, server validates with checkWinner, updates room state, broadcast move.
- Chiều
  - Matchmaking queue: implement simple queue in Node server: players request `join_queue` with rank, server matches two and creates room.
  - Bot: implement simple random/semi-intelligent bot (server can act as second player if user chooses "Play with bot").
- Deliverable cuối ngày: players can be matched, make moves, game ends when someone wins; moves broadcast in realtime.

Ngày 4 — Polish & Persist + Demo prep
- Sáng
  - Persist matches & moves to Supabase (server inserts into `matches` and `moves` tables when match ends).
  - Implement minimal ranking update (simple win +1) or store basic result.
- Chiều
  - Test full flow with 3–5 testers, fix critical bugs, record short demo script and screenshots.
  - Prepare deployment notes: run Node server (Heroku/Render/Vercel serverless or local), host frontend (Vercel/Netlify) and Supabase in cloud.
- Deliverable cuối ngày: working end-to-end demo and short script for presentation.

Chi tiết nhanh: DB schema minimal (Supabase SQL)
- profiles: id (uuid), user_id, display_name, avatar_url, rank, mindpoint
- rooms: id (uuid), name, host_id, mode (rank/casual), max_players, is_private, created_at
- matches: id, room_id, mode, player_a, player_b, winner, started_at, ended_at
- moves: id, match_id, player_id, x, y, move_index, created_at
- friends: id, user_id, friend_user_id, status

Socket events (client ↔ server)
- client → server: `join_room({roomId})`, `leave_room`, `create_room({mode, name})`, `join_queue({rank, mode})`, `move({x,y})`, `chat({text})`, `invite({userId})`
- server → client: `room_state`, `player_joined`, `player_left`, `move_made`, `chat_message`, `match_start`, `match_end`, `queue_matched`

Lưu ý về timebox & testing
- Mỗi feature làm xong: test ngay 10 phút. Nếu bug nặng, revert to simple behavior.
- Prioritize demo script: prepare 3–5 flows (single player vs bot, create room & invite friend, matchmaking rank).

Commands mẫu nhanh
- Start Node server (tạm):
  - create `server/index.js` minimal and run: `node server/index.js` (Port 3000)
- Start frontend: `npm run dev` in `frontend/`

Gợi ý nhân lực / phân công (nếu bạn có 1-2 người):
- Người A: Frontend (Login, Lobby, Room, Board UI)
- Người B: Backend/Realtime (Node Socket server, matchmaking, persistence)
- Người C (optional): Test & Demo script, deploy frontend to Vercel

Backlog (bỏ lại để sau demo)
- 3D models, skins store, payments, premium AI, tournaments, admin panel, advanced ranking algorithm.



