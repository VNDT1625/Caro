# Implementation Plan - Ranked BO3 System

## Phase 1: Database & Core Types

- [x] 1. Tạo database schema và TypeScript types




  - Tạo migration file `infra/migrations/20251203_create_ranked_series.sql` với bảng `ranked_series`
  - Thêm cột `series_id` và `game_number` vào bảng `matches`
  - Tạo file `shared/types/series.ts` với các interfaces: Series, SeriesState, GameResult, SeriesResult, RankChange
  - Định nghĩa constants: RANK_THRESHOLDS, RANK_VALUES
  - Tạo RLS policies cho bảng ranked_series
  - _Requirements: 9.1, 9.2_

## Phase 2: Backend Services



- [x] 2. Implement SeriesManager service


  - Tạo `backend/app/Services/SeriesManagerService.php` với interface
  - Implement `createSeries()`: tạo series mới, random assign sides, lưu initial MP/rank
  - Implement `endGame()`: cập nhật score, check completion, swap sides
  - Implement `getSeriesState()`: lấy trạng thái hiện tại
  - Implement `completeSeries()`: đánh dấu hoàn thành, gọi ScoringEngine
  - Implement `forfeitGame()` và `abandonSeries()`: xử lý forfeit/abandon
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 7.3, 7.4_

- [x] 2.1 Property tests cho SeriesManager









  - **Property 1: Series Initialization Correctness** - Validates: Requirements 1.1, 1.3, 1.4
  - **Property 2: Side Assignment Fairness** - Validates: Requirements 1.2
  - **Property 3: Score Update Consistency** - Validates: Requirements 2.1, 2.3
  - **Property 4: Series Completion Detection** - Validates: Requirements 2.2, 3.1
  - **Property 5: Side Swap Correctness** - Validates: Requirements 2.4




- [x] 3. Implement ScoringEngine service

  - Tạo `backend/app/Services/ScoringEngineService.php` với interface
  - Implement `calculateWinnerMP()`: base 20 + sweep bonus + time bonus + rank diff modifier
  - Implement `calculateLoserMP()`: fixed -15 (hoặc -25 nếu abandon)
  - Implement `calculateCoins()`: winner 50+10*games, loser 20
  - Implement `calculateEXP()`: winner 100, loser 40
  - Implement `applyRewards()`: apply tất cả rewards vào profiles
  - _Requirements: 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2, 6.3, 6.4_














- [x] 3.1 Property tests cho ScoringEngine




  - **Property 6: Winner MP Range** - Validates: Requirements 3.3, 4.5
  - **Property 7: Loser MP Fixed Penalty** - Validates: Requirements 3.4
  - **Property 8: MP Calculation Formula** - Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5




  - **Property 9: Sweep Bonus Application** - Validates: Requirements 4.2




  - **Property 12: Winner Coins Calculation** - Validates: Requirements 6.2
  - **Property 13: Loser Coins Fixed** - Validates: Requirements 6.3
  - **Property 14: EXP Distribution** - Validates: Requirements 6.4

- [x] 4. Implement RankManager service






  - Tạo `backend/app/Services/RankManagerService.php` với interface





  - Implement `updateMindpoint()`: cập nhật MP và check rank change
  - Implement `getRankFromMP()`: trả về rank dựa trên MP thresholds
  - Implement `recordRankChange()`: ghi vào rank_history table


  - Tạo migration cho bảng `rank_history` nếu chưa có
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4.1 Property tests cho RankManager



  - **Property 10: Rank Threshold Consistency** - Validates: Requirements 5.1
  - **Property 11: Rank History Recording** - Validates: Requirements 5.4

- [x] 5. Implement DisconnectHandler service








  - Tạo `backend/app/Services/DisconnectHandlerService.php` với interface
  - Implement `handleDisconnect()`: pause game, start 60s timer



  - Implement `handleReconnect()`: resume game nếu trong timeout
  - Implement `checkTimeout()`: forfeit game nếu quá 60s
  - Tích hợp với SeriesManager để forfeit/abandon
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_




- [x] 5.1 Property tests cho DisconnectHandler







  - **Property 15: Disconnect Timeout Forfeit** - Validates: Requirements 7.1, 7.2
  - **Property 16: Double Forfeit Series End** - Validates: Requirements 7.3


  - **Property 17: Abandon Penalty** - Validates: Requirements 7.5
-

- [x] 6. Checkpoint - Đảm bảo tất cả tests pass





  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: API Endpoints




-

- [x] 7. Tạo API endpoints cho Series







  - Tạo `backend/app/Controllers/SeriesController.php`
  - POST `/api/series/create` - tạo series mới (gọi từ matchmaking)
  - GET `/api/series/{id}` - lấy series state
  - POST `/api/series/{id}/end-game` - kết thúc game trong series



  - POST `/api/series/{id}/forfeit` - forfeit game hiện tại
  - POST `/api/series/{id}/abandon` - abandon toàn bộ series
  - POST `/api/series/{id}/rematch` - request rematch
  - Đăng ký routes trong `backend/routes/api.php`


  - _Requirements: 1.1, 2.1, 7.4, 10.1, 10.2_

- [x] 7.1 Property tests cho SeriesController













  - **Property 18: Series Data Completeness** - Validates: Requirements 9.3


  - **Property 19: Game-Series Linkage** - Validates: Requirements 9.2
  - **Property 20: Rematch Creates New Series** - Validates: Requirements 10.2

## Phase 4: Frontend Components

- [x] 8. Tạo Series Display components





  - Tạo `frontend/src/components/series/SeriesScoreDisplay.tsx` - hiển thị score "1 - 0"
  - Tạo `frontend/src/components/series/GameNumberBadge.tsx` - hiển thị "Game 2 of 3"
  - Tạo `frontend/src/components/series/PlayerSideIndicator.tsx` - hiển thị X/O cho mỗi player
  - Tích hợp vào InMatch UI hiện có
  - _Requirements: 8.1, 8.2_

-

- [x] 9. Tạo Result Modals




  - Tạo `frontend/src/components/series/GameResultModal.tsx` - kết quả từng game
  - Tạo `frontend/src/components/series/SeriesResultModal.tsx` - kết quả series với MP, coins, EXP
  - Tạo `frontend/src/components/series/RankChangeAnimation.tsx` - animation rank up/down
  - Tạo `frontend/src/components/series/NextGameCountdown.tsx` - countdown 10s giữa các game
  - _Requirements: 8.3, 8.4, 8.5, 5.2, 5.3_

- [x] 10. Tạo Rematch UI





  - Tạo `frontend/src/components/series/RematchButton.tsx` - nút rematch
  - Tạo `frontend/src/components/series/RematchWaiting.tsx` - chờ đối thủ accept
  - Implement logic timeout 15s cho rematch
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

## Phase 5: Integration

- [x] 11. Tích hợp với Matchmaking





  - Cập nhật `backend/app/MatchmakingService.php` để tạo series khi match ranked
  - Cập nhật `server/game.js` để handle series flow
  - Cập nhật frontend matchmaking để nhận series_id
  - _Requirements: 1.1, 1.5_


- [x] 12. Tích hợp với Game Engine




  - Cập nhật `backend/app/GameEngine.php` để gọi SeriesManager khi game kết thúc
  - Cập nhật `server/game/checkWinner.js` để emit series events
  - Handle side swap giữa các games
  - _Requirements: 2.1, 2.4, 2.5_
-

- [x] 13. Tích hợp Realtime




  - Cập nhật Supabase realtime subscriptions cho ranked_series table
  - Emit events: series_created, game_ended, series_completed, side_swapped
  - Handle disconnect/reconnect events
  - _Requirements: 7.1, 7.2, 8.3, 8.5_

- [x] 14. Checkpoint - Integration tests






  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: i18n và Polish


- [x] 15. Thêm translations




  - Cập nhật `frontend/src/i18n.json` với các strings cho series UI
  - Thêm translations cho: series score, game number, result messages, rank names
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 16. Final Checkpoint





  - Ensure all tests pass, ask the user if questions arise.
