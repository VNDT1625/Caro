Mapping tính năng → module (khởi tạo)

- Auth / Account → `backend/` (API: `server/api/auth`)
- Matchmaking → `backend/app/MatchmakingService.php` + `frontend/features/matchmaking`
- Room / Game session → `backend/` (sockets) + `frontend/pages/Room`
- Game rules / engine → `shared/` (rules) + server `app/GameEngine.php`
- AI (move suggestion, analysis, chat) → `ai/` service
- Shop / Skin → `backend/api/store` + `frontend/pages/Store` + `assets/`
- Leaderboard / Rank → `backend/services/rank` + `frontend/pages/Profile`
- Admin → `backend/api/admin`

Ghi chú: đây là mapping ban đầu. Tôi có thể chi tiết hoá từng endpoint và file nếu bạn muốn.
