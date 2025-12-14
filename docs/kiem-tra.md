# Tài liệu chuẩn bị thuyết trình (MindPoint Arena)

## 1. Giới thiệu chung
- Nền tảng chơi Gomoku/Caro đa dịch vụ: React/Vite frontend, PHP REST backend, Node Socket.IO server, FastAPI AI service, Supabase (Auth + Postgres + Realtime + Storage).
- Mục tiêu: chơi xếp hạng/đấu giải, phân tích trận bằng AI, hỗ trợ tính năng social (bạn bè, chat, báo cáo).
- Kiến trúc phân tầng để scale riêng game realtime và AI, giảm coupling, dễ thay thế từng dịch vụ.

## 2. Công nghệ & lý do chọn
- Frontend: React + TypeScript + Vite (HMR nhanh, type safety, tách nhỏ UI bằng hooks, dễ tối ưu render), Socket.IO client, Supabase client cho Auth + Realtime.
- Backend PHP: PSR-4/PSR-12, phù hợp VNPAY + hạ tầng PHP phổ biến; dịch vụ trung gian gọi AI, xử lý nghiệp vụ rank/series, thanh toán, moderation.
- Socket server Node: Socket.IO để truyền nước đi/chat latency thấp; có verify token Supabase và rate-limit.
- AI service FastAPI (Python): dễ tích hợp ML/lib phân tích, async I/O; tách riêng CPU-bound khỏi game server.
- Supabase: cung cấp Auth + Postgres + Realtime/presence; giảm chi phí vận hành WebSocket/PG tự host; dùng service key cho server-side.

## 3. Kiến trúc & luồng hoạt động
- Frontend ↔ Backend (REST): cấu hình `VITE_API_URL`, gọi API cho series, skill, thanh toán, báo cáo, AI proxy.
- Frontend ↔ Socket server (Socket.IO): sự kiện join_room/make_move/game_over/chat_message/rematch_request; truyền token Supabase, server xác thực rồi gắn vào room.
- Frontend ↔ Supabase Realtime: hook `useSeriesRealtime` subscribe bảng `ranked_series` + presence để theo dõi điểm/side/disconnect.
- Backend ↔ AI: HTTP tới FastAPI (`ai/main.py`) cho analyze/explain/replay; có cache Redis và timeout.
- DB: Postgres/Supabase lưu profiles, rooms, matchmaking_queue, ranked_series, reports, payments; RLS bảo vệ dữ liệu người chơi.

## 4. Chức năng chính & kỹ thuật triển khai
- Ghép trận (rank/casual/skill): `frontend/src/lib/matchmaking.ts` ghi vào `matchmaking_queue`, chọn mode hiệu lực (skill_ranked/skill_matchmaking) + ép luật Swap2 cho rank/skill online; subscribe realtime để biết matched; UI popup ở `Home.tsx`, trang riêng `Matchmaking.tsx`.
- Quản lý series BO3: `useSeriesRealtime` emit sự kiện `series_*` (created, game_ended, score_updated, side_swapped, next_game_ready, player_disconnected/reconnected, forfeited, abandoned); countdown reconnect 60s; UI xử lý ở `InMatch.tsx`.
- In-game flow: Socket.IO nhận/gửi nước đi, cập nhật board, chat, rematch; khi socket bị drop, Supabase presence phát hiện và hiển thị cảnh báo + timeout.
- AI phân tích trận: frontend gọi `analysisApi.ts` → PHP `AnalysisController.php`/`AIProxyController.php` → FastAPI `BasicAnalyzer`/`ProAnalyzer`; trả timeline, best move, mistake highlight, pattern, gợi ý; hỗ trợ replay “what-if”.
- Social/moderation: bạn bè (`server/friends.js`), báo cáo/ban/appeal (`backend/app/Controllers/*Controller.php`), thông báo (`NotificationController.php` + `notificationApi.ts`), title/skill/currency.
- Thanh toán: `PaymentController.php` tích hợp VNPAY, cấu hình qua `.env`.

## 5. Kỹ thuật React nổi bật
- Hook chuyên biệt: `useSeriesRealtime` (Supabase Realtime + presence + countdown), các API client tách trong `frontend/src/lib/*.ts` (matchmaking/analysis/skill/title/notification).
- State persistence: lưu matchmaking vào `localStorage` để reload không mất trạng thái chờ; App router thủ công trong `App.tsx`.
- UI realtime: đồng bộ song song Socket.IO (nước đi/chat) + Realtime DB (series state) để tránh missing event; xử lý idempotent bằng timestamp/event type.
- Quốc tế hóa: `i18n.json` và `LanguageContext.tsx` đa ngôn ngữ.

## 6. Socket server (Node)
- `server/index.js`: load env, verify Supabase token (ưu tiên service client, fallback HTTP), rate-limit kiểm tra token, CORS mở cho dev.
- Game logic: `game/checkWinner.js` xác định thắng, tính side trong series, xử lý forfeit sau timeout; emit qua Socket.IO.
- API bạn bè: `registerFriendRoutes` (REST nhỏ gọn).

## 7. Backend PHP
- Controllers theo domain: Series/Skill/Swap2/Payment/Report/Appeal/Ban/Notification/Analysis.
- Services: `MatchmakingService.php`, `GameEngine.php` xử lý luật, ghi DB, tính điểm/rank, gọi AI.
- Tuân thủ PSR-12, dùng typed params/properties; RLS Supabase bảo vệ select/update.

## 8. AI service (FastAPI)
- `ai/main.py`: CORS mở dev, error handler chuẩn hóa, sanitize input, timeout wrapper.
- Analyzer: `BasicAnalyzer`/`ProAnalyzer`, `ReplayEngine` cho what-if, `CommentGenerator` đa ngôn ngữ, `RoleEvaluator` phân vai người chơi.
- Cache Redis (tùy config), rate-limit bằng `USAGE_LIMITS`; phân loại nước đi, tính win-prob, phát hiện pattern/threat.
- Tests Pytest ở `ai/tests/`.

## 9. Testing & quan sát
- Frontend: `npm run lint`, Vitest (module-level); cần thêm test cho hook realtime/matchmaking.
- Backend: PHPUnit (`./vendor/bin/phpunit --testdox`), property-based cho realtime series (tài liệu `docs/REALTIME_INTEGRATION_GUIDE.md`).
- AI: `python -m pytest ai/tests -v`.
- Giám sát: log đơn giản; khuyến nghị thêm metrics/healthcheck cho AI và socket.

## 10. Luồng hoạt động tóm tắt
1) Đăng nhập Supabase → 2) Chọn chế độ → 3) Join queue (ghi DB, sub realtime) → 4) Matched → 5) Tạo room + join Socket.IO → 6) Chơi + chat, presence theo dõi disconnect → 7) Kết thúc BO3, cập nhật rank/mindpoint → 8) Gửi log cho AI phân tích → 9) Hiển thị báo cáo/tips, lưu lịch sử/báo cáo nếu cần.

## 11. Rủi ro & đề xuất
- Router thủ công trong `App.tsx` lớn, nên tách router + code-splitting.
- Phụ thuộc Supabase Realtime/presence: cần fallback khi dịch vụ lỗi (reconnect + polling).
- Thêm test e2e/contract cho `useSeriesRealtime` và matchmaking queue/room flow.
- Bổ sung metrics/health cho Socket.IO và AI, canary/feature-flag cho thay đổi lớn.
