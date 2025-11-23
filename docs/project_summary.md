# MindPoint Arena — Tóm tắt dự án (Toàn bộ)

## 1. Ý tưởng chung
MindPoint Arena là web game Cờ Caro (Five in a Row) phong cách anime cổ trang, hỗ trợ chơi online 1v1 (Rank), phòng mời bạn, nhiều chế độ giải trí, AI đa mức độ và khả năng phân tích ván đấu.

Mục tiêu đồ án: xây được một bản web chơi được thực tế (MVP) với tối thiểu các tính năng chính: tạo phòng, mời bạn, tìm trận + ghép trận rank, gameplay mượt, lưu ván đấu và UI cơ bản.

## Thông tin chuyên sâu (kỹ thuật)
 Phần này mô tả chi tiết các quyết định kỹ thuật để AI hoặc bất kỳ kỹ sư nào đọc hiểu toàn bộ cấu trúc, stack và các điểm cần chú ý khi phát triển/MVP hóa dự án.

    ### Frontend
    - **Stack:** React + TypeScript + Vite. Dự trữ `Three.js` cho phần 3D (bàn/quân) nhưng khởi tạo demo bằng `2D canvas`/SVG/HTML để tiết kiệm thời gian.
    - **Cấu trúc thư mục gợi ý:**
        - `src/pages` — `Lobby`, `Room`, `Profile`, `Store`, `Auth`.
        - `src/components` — `Board`, `Cell`, `Chat`, `Timer`, `PlayerBadge`, `Modal`.
        - `src/lib` — `supabase.ts`, `api.ts`, `socket.ts`, `game/checkWinner.ts`.
        - `src/state` — global state via `Zustand` hoặc `React Context` (lưu player session, current room, match state).
    - **Networking:** `@supabase/supabase-js` for auth/DB. `socket.io-client` (or native WebSocket) to connect realtime server for moves/presence/chat.
    - **Build / Dev:** `npm install` → `npm run dev`; `npm run build` để build production. Thêm `vitest` cho unit test `checkWinner`.
    - **Env vars (frontend):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, `VITE_SOCKET_URL`.

    ### Backend
    - **Stack khuyến nghị (MVP):** Laravel (PHP) cho tốc độ phát triển nếu quen PHP; nếu muốn nhanh hơn với realtime, tách thành Node.js + Socket.IO microservice.
    - **Chức năng chính / API endpoints (REST + WebSocket events):**
        - `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.
        - `POST /api/rooms` — tạo phòng; `GET /api/rooms` — danh sách phòng; `POST /api/rooms/:id/join`.
        - `POST /api/matches` — khởi tạo trận; `GET /api/matches/:id` — trạng thái/ replay.
        - `POST /api/matches/:id/move` — gửi nước (server-side validate bằng `GameEngine`).
        - WebSocket events: `joinRoom`, `leaveRoom`, `playerMove`, `matchStart`, `matchEnd`, `chatMessage`, `presence`.
    - **GameEngine:** server-authoritative module (validate move legality, apply move, detect win/draw, enforce timers). Có thể port `checkWinner` từ TypeScript sang PHP.
    - **Data models (core):** `User`, `Room`, `Match`, `Move`, `Rating`, `Item(Skin)`, `Achievement`.
    - **Env vars (backend):** `DATABASE_URL`, `SUPABASE_SERVICE_KEY` (if using Supabase on server), `APP_URL`, `JWT_SECRET`.

    ### Realtime / Presence
    - **Option A (fast MVP):** Node.js + Socket.IO microservice (lightweight, easy to test locally). Use it to handle move broadcasting, presence, matchmaking queue.
    - **Option B:** Laravel WebSockets (integrated) — chọn nếu muốn keep everything PHP.
    - **Presence & scaling:** Redis for pub/sub and presence when scaling to multiple instances.

    ### AI service
    - **Stack:** Python + FastAPI for endpoints; GPU optional if using large local models. `requirements.txt` includes `fastapi`, `uvicorn`, `numpy`, plus client libs for LLMs (OpenAI or local LLM SDK).
    - **Endpoints:** `POST /ai/suggest_move` (input: board state, turn, mode), `POST /ai/analyze` (return evaluation, suggested lines), `POST /ai/chat` (assistant/coach).
    - **Auth & quota:** issue API key per frontend user or proxy via backend to protect model keys.

    ### Database & Storage
    - **MVP:** Supabase (Postgres) for users, matches, moves, storage for replays and assets. Use Supabase Auth for quick auth flow.
    - **Schema (high level):**
        - `users(id,email,display_name,avatar,rank,elo,created_at)`
        - `rooms(id,owner_id,mode,board_size,win_length,is_private,created_at)`
        - `matches(id,room_id,player_x,player_o,state,started_at,ended_at)`
        - `moves(id,match_id,player,position_x,position_y,move_index,timestamp)`
    - **Caching/Queues:** Redis for matchmaking queue, timers, and ephemeral presence.

    ### Infra & Deployment
    - **Local dev:** `docker-compose` for Postgres/Redis (optional) — Supabase can be used instead of local DB.
    - **Deploy:** Frontend → Vercel/Netlify; Backend → Heroku/Render/VPS; AI → dedicated host or cloud GPU; Socket service → render/VPS with sticky sessions or behind Redis adapter.

    ### Dev commands (quick)
    ```
    cd frontend
    npm install
    npm run dev

    # backend (Laravel example)
    cd backend
    composer install
    cp .env.example .env
    php artisan key:generate
    php artisan migrate

    # AI service
    cd ai
    python -m venv .venv
    .venv\Scripts\Activate.ps1  ; # on Windows PowerShell
    pip install -r requirements.txt
    uvicorn ai.main:app --reload
    ```

    ### API contract (example `playerMove` payload)
    ```
    {
        "match_id": "uuid",
        "player_id": "uuid",
        "x": 7,
        "y": 5,
        "client_move_index": 12
    }
    ```

    ### Testing & Quality
    - Unit-test `checkWinner` & `GameEngine` logic (Vitest/Jest for frontend, PHPUnit for backend).
    - Linting: `eslint` + `prettier` for frontend; `phpcs` for backend if desired.

    ### Notes / trade-offs
    - For a 4‑day demo, prefer: `React (2D Board)` + `Supabase` + lightweight `Node Socket.IO` for realtime. Port `GameEngine` server-side later for authoritative validation.

    ---
    *Phần này được viết để AI/một dev khác đọc nhanh và hiểu các quyết định kỹ thuật, các biến môi trường cần cấu hình, endpoints chính và các file quan trọng trong repo.*
## 2. Gameplay chính
- Luật cơ bản: 2 người (X/O) luân phiên; ai xếp được 5 quân liên tiếp (ngang/dọc/chéo) thắng.
- Board: chế độ Rank là board mở rộng (không giới hạn ô), một số chế độ có board cố định (3x3, 9x9, 15x15).
- Timer: Rank có giới hạn thời gian mỗi nước (30s → 15s theo rank); phòng giải trí có thể tùy chỉnh (tối thiểu 5s hoặc không giới hạn).

## 3. Các chế độ phụ / biến thể
- Caro Skill: một số quân có skill đặc biệt (hoán vị, chặn hàng, xóa nước...).
- Caro Ẩn: quân mờ sau mỗi 3 nước.
- Caro theo ô: kích thước cố định (3x3, 9x9,...).
- Caro theo hàng: số quân nối tiếp để thắng (3/4/5/...).
- Caro theo cặp (2v2): 4 người, đánh luân phiên A1→B1→A2→B2.
- Caro Địa Hình: ô đặc biệt, tính điểm thay vì 5 liên tiếp.

## 4. Hệ thống Rank (MindPoint)
- Các bậc: Vô danh → Tân Kỳ → Học Kỳ → Kỳ Lão → Cao Kỳ → Tam Kỳ → Đệ Nhị → Vô Đối.

- Giai đoạn dưới ( vô danh -> học kỳ (Cao kỳ 3)): 
    + chia nhánh : 
        ++ vô danh -> Tân Kỳ :  
            +++ Sơ kỳ : 1 -> 2 -> 3
            +++ Trung kỳ : 1 -> 2 -> 3
            +++ Cao kỳ : 1 -> 2 -> 3
        ++ Học Kỳ : 
            +++ Sơ kỳ : 1 -> 2 -> 3
            +++ Trung kỳ : 1 -> 2 -> 3
            +++ Cao kỳ : 1 -> 2 -> 3
            +++ Vượt Cấp : Matchpoint ( leader board ) -- tính điểm theo giai đoạn cao
    + cách tính điểm =  ( tính điểm theo lượt  + chênh lệch thời gian + rank + 5 ) x Kết Quả 
                            -> Max = 35 , min = 20 , 20 -> 35đ .
        ++ Theo Lượt : lượt <10 = 10 , lượt < 20 = 7 , lượt > 20 = 5
        ++ Thời gian chênh lệch : chênh > gấp đôi = 10 , > chênh x1.5 = 7 , còn lại = 5
        ++ Rank : vô danh = 10 , Tân Kỳ = 7 , Học Kỳ = 5
        ++ Kết Quả :  Thắng : 1 , Thua : (-1) -> tức là thắng thì sẽ được ( + điểm ) theo cách tính điểm đó còn thua thì trừ điểm đi , trừ và cộng (cách tính điểm theo trận ) với điểm hiện tại đang có , điểm hiện tại bắt đầu từ 0 với người mới
    +  Điều kiện lên rank : 100 điểm sẽ lên 1 nhánh . Ví dụ : 
        ++ Vô danh - sơ kỳ 1 -> Vô danh - sơ kỳ 2 
        ++ Vô danh - sơ kỳ 3 -> Vô danh trung kỳ 1
        ++ Vô danh - cao kỳ 3 -> Tân Kỳ - sơ kỳ 1 
- Giai đoạn cao(học kỳ - vượt cấp): tập trung điểm cá nhân + leaderboard.
    + điểm cá nhân = ( tính điểm theo lượt  + chênh lệch thời gian + 5 ) x chênh lệch rank
        ++ Chênh lệch rank :    +++ Player cao hơn đối thủ  
                                        ++++  Player win : 0.5
                                        ++++ Player lose : (-1.5)
                                +++ Player thấp hơn đối thủ 
                                        ++++  Player win : 1.5
                                        ++++ Player lose : (-0.5)
- Matchmaking: ghép rank ngang/hơi thấp hơn.
- Decay system (hạ rank theo mùa): hệ thống hạ rank được thiết kế để giữ người chơi hoạt động và làm mới bảng xếp hạng sau mỗi mùa (một mùa = 3–4 tháng). Dưới đây là quy tắc chi tiết, công thức và ví dụ áp dụng.

            **Mục tiêu:** khuyến khích người chơi tham gia đều đặn; tránh hạ rank quá nặng cho người chơi vẫn hoạt động; đảm bảo rớt hạng do bất hoạt rõ ràng và có cơ chế bảo vệ mềm (soft-protection).

            **Nguyên tắc chính**
            - Mùa kết thúc: thực hiện bước tính decay cho mọi tài khoản.
            - Thước đo hoạt động (activity): số trận đã chơi trong mùa (matches_played).
            - Decay phụ thuộc vào cấp bậc hiện tại (rank tier) và activity. Cấp cao hơn có decay theo tỷ lệ nhỏ hơn.
            - Nếu decay đưa người chơi xuống bậc thấp hơn, áp dụng "soft demotion" (cần thêm điều kiện để chính thức rớt tiếp).

            **Công thức**
            - Định nghĩa:
                - P = điểm hiện tại của người chơi (season points hoặc elo-like score).
                - B = điểm tối thiểu để giữ ở rank hiện tại (rank floor).
                - base_decay_pct[rank] = tỷ lệ decay cơ bản theo rank (tham số cấu hình).
                - activity_multiplier = hệ số theo mức hoạt động.
            - Decay amount = (P - B) * base_decay_pct[rank] * activity_multiplier
            - Điểm sau decay: P' = max(B, P - Decay amount)

            **Giá trị gợi ý (cấu hình mặc định)**
            - base_decay_pct (theo rank):
                - `Vô danh`: 0% (không hạ)  
                - `Tân Kỳ`: 20%  
                - `Học Kỳ`: 18%  
                - `Kỳ Lão`: 15%  
                - `Cao Kỳ`: 12%  
                - `Tam Kỳ`: 10%  
                - `Đệ Nhị`: 8%  
                - `Vô Đối`: 5%
            - activity_multiplier (theo matches_played trong mùa):
                - matches_played >= 20 → multiplier = 0.0 (không decay)
                - 10 <= matches_played < 20 → multiplier = 0.5 (decay giảm một nửa)
                - 1 <= matches_played < 10 → multiplier = 1.0 (decay đầy đủ)
                - matches_played = 0 → multiplier = 1.5 (penalty tăng do bất hoạt hoàn toàn)

            **Soft-demotion (bảo vệ mềm)**
            - Nếu P' < floor_of_lower_rank (tức là rớt về rank thấp hơn) thì:
                - Gắn cờ "soft-demoted" cho tài khoản; soft-demoted players có 1 mùa probation (hoặc 14 ngày) để lấy lại điểm bằng chiến thắng; trong thời gian này, hệ thống sẽ không cho phép rớt tiếp nếu người chơi thắng đủ để vượt mốc.
                - Nếu sau probation người chơi vẫn dưới ngưỡng rank cũ thì rớt chính thức.

            **Ví dụ**
            - Giả sử bậc `Cao Kỳ` có floor B = 2400, người chơi có P = 2600, base_decay_pct = 12%.
                - Nếu matches_played = 0 → multiplier = 1.5 → Decay = (2600-2400)*0.12*1.5 = 200*0.18 = 36 → P' = 2564.
                - Nếu matches_played = 15 → multiplier = 0.5 → Decay = 200*0.12*0.5 = 12 → P' = 2588.
            - Nếu P' rơi xuống dưới ngưỡng rank thấp hơn, người chơi sẽ bị soft-demoted (xem trên) thay vì bị rớt ngay lập tức.

            **Điều chỉnh & vận hành**
            - Các thông số `base_decay_pct` và thresholds matches_played nên được lưu trong cấu hình (DB / admin panel) để điều chỉnh theo dữ liệu thực tế.
            - Có thể bổ sung bonus hoạt động (activity bonus) cộng điểm cho người chơi quá active (ví dụ +10 pts nếu matches_played >= 50) để khuyến khích retention.
            - Log chi tiết mỗi lần decay (pre_point, post_point, matches_played, multiplier, reason) để audit và điều chỉnh sau mùa.

            **Tóm tắt ngắn gọn:** hệ thống trừ một phần điểm vượt ngưỡng rank theo tỷ lệ cấu hình, giảm nhẹ hoặc bỏ qua nếu người chơi đủ hoạt động; nếu decay đưa xuống rank thấp hơn thì áp dụng cơ chế soft-demotion để tránh rớt đột ngột do bất hoạt tạm thời.
- Cách chống smurfing/boosting trong rank :  là chống người chơi rất giỏi (rank cao) nhưng tạo acc mới (acc phụ) để chơi ở rank thấp ( smurfing ) và chống người khác chơi hộ hoặc cày thuê cho bạn để đẩy rank lên cao ( boosting ).
    + Rank từ Cao kỳ trở lên chở thành leaderboard nhằm khuyến khích thi đấu nhiều để kiếm điểm cũng có nghĩa việc tạo acc để chơi sẽ gây mất rank mất thành tựu khả năng đánh đổi này người dùng sẽ hạn chế tạo lại acc ( smurfing ) . Điều này đồng nghĩa ở mức rank từ học kỳ - cao kỳ 1 trở xuống thì người dùng có thể tạo acc đánh với vô danh nhưng sự chênh lệch này không quá cao giúp vô danh phát triển khi đánh với người mạnh nhưng sẽ không hẳn là thế trận 1 chiều và nó vô tình lại biến thành lợi ích chung . 
    + Khi đăng nhập sẽ yêu cầu face id để chồng cày rank hộ ( boosting ) . Đa số cày game onlien đưa tài khoảng mật khẩu để cày , hiếm khi trực tiếp . Đồng thời không can thiệp vào lúc trong trận tránh gây lag 
    + Hạn chế tạo acc :  chỉ cho phép đăng nhập bằng số điện thoại + cccd -> nếu mất acc có thể dùng số điện thoại + cccd để yêu cầu gửi lại mật khẩu .
    + Hậu Kiểm :
         1. Phân tích hành vi bất thường (hậu kiểm)
                Log các trận có:
                Tỉ lệ thắng bất thường quá cao khi ở rank thấp
                Thời gian phản ứng (đặt nước) siêu nhanh
                IP thiết bị / Browser fingerprint khác so với bình thường
                Nếu nghi ngờ → gắn cờ đánh giá, yêu cầu xác minh lại Face ID hoặc thông báo cảnh báo.

        2. Giới hạn hành vi nghi ngờ ở acc mới
            Acc mới tạo nhưng có win streak quá cao → đưa vào queue “smurf suspected”
            Trong queue này: ưu tiên match với người win streak tương đương để tránh phá newbie

        3. Thêm logic “khóa rank cao khi bị nghi boost”
            Nếu acc đang từ rank cao → tự nhiên giảm phong độ cực mạnh trong 5–10 trận
            → Gắn cờ và đóng băng tạm rank, yêu cầu xác thực (Face ID, OTP)
    + Báo lỗi khi có nghi vấn : có nút báo lỗi khi thông báo acc đó có nghi vấn và được admin kiểm duyệt lại bằng cách trong n admin ngẫu nhiên 1 trong n admin nhận báo cáo lỗi đó và chấp nhận hoặc bác bỏ tùy vào trường hợp hoặc gửi lại cho người dùng kiểm tra faceid lại lần nữa nếu có vấn đề . Giành cho trường hợp cùng 1 người nhưng faceid không hoạt động như mong đợi . Trong thời gian kiểm duyệt ( trong vòng 7 ngày ) admin sẽ duyệt báo cáo lỗi , phía người dùng trong thời gian này vẫn leo rank bình thường nhưng được lưu trữ điểm tại database nếu có hành vi gian dối thì sẽ trừ gấp đôi và khóa acc trong 1 thười gian hoặc vĩnh viễn 
## 5. Giao diện & trang chức năng
Trang chính: Landing, Đăng nhập/Đăng ký, Home (Rank, Giải trí, Đấu với máy), Store, Profile, Events, Settings, Room (lobby), In-match (bàn, timer, chat), Loading, Admin.

Phong cách: anime cổ trang + hiện đại; 3D cho bàn và quân, có option 2D cho máy yếu.

## 5.1 Chức năng (Các tính năng chính)
- **Auth:** Đăng ký / Đăng nhập (email, OAuth), quản lý phiên, bảo mật.
- **Lobby & Social:** Danh sách phòng, bạn bè, mời bạn, tìm ngẫu nhiên, profile, hệ thống lời mời.
- **Tạo & Quản lý phòng:** Tạo phòng công khai/riêng tư, cài đặt board (kích thước, win length), thời gian/mode, khởi động trận.
- **Matchmaking:** Hệ ghép trận rank/casual, queue đơn giản, tìm đối thủ ngang rank.
- **Gameplay (In-match):**
    - Board 2D/3D, đặt nước, hiển thị lượt, timer per-move, undo (chỉ local hoặc thỏa thuận), chat trong phòng, spectator mode.
    - Rule engine: xác thực nước, kiểm tra thắng/thua/hòa, ghi lại history moves.
- **AI:** Chế độ chơi với máy (multi-level : Nhập Môn - Kỳ Tài - Nghịch Thiên), gợi ý nước và phân tích ván sau trận.
- **Lưu & Replay:** Lưu ván đấu, xem lại từng nước, tải xuống / chia sẻ ván.
- **Profile & Progress:** Lịch sử trận, thống kê, ranking, achievements.
- **Store & Monetization:** Mua skins, cosmetics, gói AI, battle pass.
- **Admin & Moderation:** Quản lý người dùng, phòng, báo cáo, log trận.

## 6. Hệ thống & Module
- Frontend (React + TypeScript + Three.js cho 3D, Vite dev).
- Backend (PHP — Laravel khuyến nghị; hiện skeleton có sẵn). Server-authoritative game engine.
- Realtime: Laravel WebSockets (ban đầu) hoặc Node.js + Socket.IO (tách khi scale).
- AI: service Python (FastAPI) cho move suggestion, phân tích ván, AI chat.
- DB: Supabase (Postgres) cho MVP; production chuyển sang PostgreSQL managed + Redis cho queues/presence.
- Storage: S3 / Supabase Storage cho assets lớn.

## 7. Monetization (các nguồn doanh thu)
1. Bán skins & cosmetics (chủ lực).  
2. Premium AI analysis / coach (mua theo ván hoặc subscription).  
3. Battle pass / season pass.  
4. Tournament entry fees.  
5. Quảng cáo nhẹ (khi cần).

## 8. MVP & Roadmap (Ưu tiên)
**Phase 0 — Chuẩn bị (1–2 tuần)**
- Chọn stack (Supabase cho MVP nhanh).  
- Tạo repo, scaffold frontend + backend skeleton (đã xong phần frontend).  
- Thiết kế data model cơ bản: User, Match, Move, Item, Skin.

**Phase 1 — MVP cơ bản (3–6 tuần)**
- Backend: auth, API tạo phòng, lưu match, ranking đơn giản.  
- Realtime: room + gửi move (Laravel WebSockets hoặc Node Socket).  
- Frontend: Lobby, Room (2D board), Store, Profile.  
- Test: local e2e, 5 người chơi thử nghiệm.

**Phase 2 — Kiểm chứng thị trường (4–8 tuần)**
- Thu thập analytics, event, A/B test pricing.  
- Nếu traction, nâng cấp DB, Redis, CDN.

**Phase 3 — Scale & Monetize**
- Tách realtime, nâng infra, phát triển hệ store, battle pass, subscription AI.

## 9. KPI & Mục tiêu kinh doanh cơ bản
- DAU mục tiêu ban đầu: 100–500.  
- Retention D1 ≥ 25%, D7 ≥ 8%.  
- Conversion rate: 0.5%–2%.  
- ARPU tham khảo: $0.5/ngày với 1000 DAU → $500/tháng.

## 10. Rủi ro & Giải pháp
- Rủi ro realtime lag/scale → tách socket layer, dùng Redis cho pub/sub.  
- Rủi ro retention thấp → ưu tiên UX, tutorial, event, reward system.  
- Rủi ro chi phí assets/hosting → bắt đầu bằng free tier Supabase/Vercel, assets tối giản.

## 11. Kế hoạch kỹ thuật ngắn hạn (các việc ưu tiên)
- Hoàn thiện `GameEngine` server-side (validate move, check win).  
- Implement Room UI 2D & client-side move handling (mock server).  
- Auth basics + create/join room API (backend).  
- Basic matchmaking queue (Redis or simple DB queue).

## 12. Tài liệu & tham chiếu hiện có
- File `thongtin.txt`, `docs/thongtindoan1.md`: mô tả chi tiết gameplay và yêu cầu.  
- Frontend skeleton đã tạo trong `frontend/`.  
- Backend skeleton và `.env.supabase.example` đã có trong `backend/`.

## 13. Gợi ý triển khai cho đồ án (ngắn gọn)
- Nếu mục tiêu là đồ án/đề tài: ưu tiên hoàn thiện MVP (Phase 1) dùng Supabase để tiết kiệm thời gian.  
- Nếu mục tiêu thương mại lâu dài: triển khai như roadmap, chuẩn bị chuyển DB, Redis, tách service.

---
*File này là bản tổng hợp ngắn gọn — tôi có thể mở rộng thành bản spec chi tiết (API list, DB schema, sequence diagrams) nếu bạn yêu cầu.*
