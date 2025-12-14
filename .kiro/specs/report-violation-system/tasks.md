# Implementation Plan - Hệ thống Báo cáo Vi phạm / Gian lận

## Phase 1: Database và Core Infrastructure

- [-]  Tạo database schema và migrations

  - [x] 1.1 Tạo migration cho bảng `reports`


    - Tạo file migration với các fields: id, reporter_id, reported_user_id, match_id, type, description, status, rule_analysis, reason_result, ai_analysis, ai_summary_player, ai_details_admin, processed_at, processed_by, admin_notes, timestamps
    - Thêm indexes cho performance


    - _Requirements: 2.1, 2.2_
  - [x] 1.2 Tạo migration cho bảng `appeals`


    - Fields: id, report_id, user_id, reason, status, admin_response, processed_by, processed_at, timestamps



    - Foreign key constraints
    - _Requirements: 7.1_
  - [x] 1.3 Tạo migration cho bảng `user_bans`
    - Fields: id, user_id, report_id, ban_type, reason, expires_at, is_active, lifted_at, lifted_by, lift_reason, timestamps
    - _Requirements: 6.1, 6.2_
  - [x] 1.4 Tạo migration cho bảng `report_actions` (audit log)
    - Fields: id, report_id, admin_id, action, old_status, new_status, notes, metadata, created_at
    - _Requirements: 9.4_

- [x] 2. Tạo Eloquent Models



  - [x] 2.1 Tạo Report model với relationships và casts


    - Relationships: reporter, reportedUser, match, appeals, actions
    - _Requirements: 2.1_


  - [x] 2.2 Tạo Appeal model với relationships


    - Relationships: report, user, processedBy




    - _Requirements: 7.1_
  - [x] 2.3 Tạo UserBan model với relationships và scopes
    - Scope: active(), expired()
    - _Requirements: 6.1_
  - [x] 2.4 Tạo ReportAction model
    - _Requirements: 9.4_
  - [x] 2.5 Write property test cho Report model data integrity





    - **Property 1: Report Creation Data Integrity**
    - **Validates: Requirements 2.1, 2.2**

## Phase 2: Rule Engine Service

- [x] 3. Implement Rule Engine Service

  - [x] 3.1 Tạo RuleEngineService class và interface


    - Method: analyzeMatch(matchId): RuleAnalysisResult
    - _Requirements: 3.1_
  - [x] 3.2 Implement checkMultipleMoves() - phát hiện nhiều nước đi trong 1 lượt

    - Kiểm tra consecutive moves của cùng 1 player
    - _Requirements: 3.2_
  - [x] 3.3 Write property test cho Multiple Moves Detection


    - **Property 7: Multiple Moves Detection**
    - **Validates: Requirements 3.2**
  - [x] 3.4 Implement checkImpossibleWins() - phát hiện cả 2 bên thắng

    - Kiểm tra board state có 2 winning lines
    - _Requirements: 3.3_
  - [x] 3.5 Write property test cho Impossible Win Detection


    - **Property 8: Impossible Win Detection**
    - **Validates: Requirements 3.3**
  - [x] 3.6 Implement checkTimingAnomalies() - phát hiện timing bất thường

    - Kiểm tra time between moves < 100ms hoặc > timeout
    - _Requirements: 3.4_
  - [x] 3.7 Write property test cho Timing Anomaly Detection


    - **Property 9: Timing Anomaly Detection**
    - **Validates: Requirements 3.4**
  - [x] 3.8 Implement generateReasonResult() - tạo mô tả violations

    - Format violations thành human-readable string
    - _Requirements: 3.5_

- [x] 4. Checkpoint - Đảm bảo tất cả tests pass



  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: AI Analysis Service

- [x] 5. Implement AI Analysis Service





  - [x] 5.1 Tạo AIAnalysisService class và interface


    - Method: analyzeCheatReport(information, reasonResult): ?AIAnalysisResult
    - _Requirements: 4.1_
  - [x] 5.2 Implement buildPrompt() - tạo prompt cho AI

    - Include match data và rule-based findings
    - _Requirements: 4.2_

  - [x] 5.3 Implement callAIModel() - gọi OpenRouter/DeepSeek API
    - HTTP client với timeout 30s

    - _Requirements: 4.1_
  - [x] 5.4 Implement validateResponse() - validate AI response format
    - Check required fields: report_result, summary_for_player, details_for_admin
    - _Requirements: 4.3_
  - [x] 5.5 Write property test cho AI Response Validation


    - **Property 10: AI Response Validation**

    - **Validates: Requirements 4.3**
  - [x] 5.6 Implement error handling cho AI service
    - Handle timeout, invalid response, network errors
    - _Requirements: 4.4, 4.5_

## Phase 4: Report Service và Decision Logic

- [-] 6. Implement Report Service



  - [x] 6.1 Tạo ReportService class và interface


    - _Requirements: 2.1_

  - [x] 6.2 Implement createReport() - tạo báo cáo mới

    - Validate input, set status = pending, auto-attach match_id
    - _Requirements: 1.2, 1.3, 1.4, 2.1, 2.2_

  - [x] 6.3 Write property test cho Match ID Auto-attachment





    - **Property 2: Match ID Auto-attachment**
    - **Validates: Requirements 1.2**
  - [x] 6.4 Write property test cho Description Length Validation





    - **Property 3: Description Length Validation**
    - **Validates: Requirements 1.3**
  - [x] 6.5 Implement processCheatReport() - xử lý báo cáo gian lận
    - Gọi RuleEngine → AI → Decision Logic
    - _Requirements: 3.1, 4.1, 5.1-5.3_

  - [x] 6.6 Implement decision logic - quyết định status cuối cùng





    - Rule + AI = co → auto_flagged
    - Rule + AI = khong → escalated
    - No rule + AI = khong → dismissed
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 6.7 Write property test cho Decision Logic - Auto Flag





    - **Property 11: Decision Logic - Auto Flag**
    --**Validates: Requirements 5.1**

  - [x] 6.8 Write property test cho Decision Logic - Escalate




    - **Property 12: Decision Logic - Escalate**
    - **Validates: Requirements 5.2**
  - [x] 6.9 Write property test cho Decision Logic - Dismiss









    - **Property 13: Decision Logic - Dismiss**
    - **Validates: Requirements 5.3**
-

- [x] 7. Checkpoint - Đảm bảo tất cả tests pass






  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: Ban Service
-


- [x] 8. Implement Ban Service



  - [x] 8.1 Tạo BanService class và interface


    - _Requirements: 6.1_
  - [x] 8.2 Implement applyBan() - áp dụng ban

    - Create UserBan record, log reason
    - _Requirements: 6.1, 6.2_
  - [x] 8.3 Write property test cho Ban Application


    - **Property 14: Ban Application**
    - **Validates: Requirements 6.1**
  - [x] 8.4 Implement liftBan() - gỡ ban

    - Update is_active = false, set lifted_at, lifted_by
    - _Requirements: 7.5_
  - [x] 8.5 Implement checkUserBanStatus() - kiểm tra trạng thái ban

    - Return active ban info hoặc null
    - _Requirements: 6.3_
  - [x] 8.6 Implement sendBanNotification() - gửi thông báo ban

    - In-app notification với summary_for_player
    - _Requirements: 6.3, 6.4_

## Phase 6: Appeal Service
-

- [x] 9. Implement Appeal Service




  - [x] 9.1 Tạo AppealService class và interface


    - _Requirements: 7.1_
  - [x] 9.2 Implement createAppeal() - tạo khiếu nại


    - Link to report_id, NOT trigger AI
    - _Requirements: 7.1, 7.2_
  - [x] 9.3 Write property test cho Appeal Creation


    - **Property 15: Appeal Creation**
    - **Validates: Requirements 7.1, 7.2**
  - [x] 9.4 Implement processAppeal() - xử lý khiếu nại


    - Admin approve/reject, optional lift ban
    - _Requirements: 7.5_
  - [x] 9.5 Write property test cho Appeal Queue


    - **Property 16: Appeal Queue**
    - **Validates: Requirements 7.3**

- [x] 10. Checkpoint - Đảm bảo tất cả tests pass





  - Ensure all tests pass, ask the user if questions arise.

## Phase 7: API Controllers

- [x] 11. Implement Report API Controller





  - [x] 11.1 Tạo ReportController với dependency injection


    - _Requirements: 8.1_

  - [x] 11.2 Implement POST /api/reports - tạo báo cáo

    - Validate request, call ReportService
    - _Requirements: 1.1, 1.5_

  - [x] 11.3 Implement GET /api/reports - danh sách (admin)
    - Filter by status, type, date range
    - _Requirements: 9.1_
  - [x] 11.4 Write property test cho Report Filter Consistency
    - **Property 5: Report Filter Consistency**
    - **Validates: Requirements 2.4**
  - [x] 11.5 Implement GET /api/reports/{id} - chi tiết (admin)
    - Include all related data
    - _Requirements: 9.2_
  - [x] 11.6 Implement PUT /api/reports/{id} - cập nhật (admin)
    - Update status, admin_notes, trigger actions
    - _Requirements: 9.3, 9.4_
  - [x] 11.7 Write property test cho Status Update Timestamp
    - **Property 4: Status Update Timestamp**
    - **Validates: Requirements 2.3**

- [x] 12. Implement Appeal API Controller











  - [x] 12.1 Tạo AppealController


    - _Requirements: 7.1_


  - [x] 12.2 Implement POST /api/appeals - tạo khiếu nại


    - Validate, call AppealService
    - _Requirements: 7.1_
  - [x] 12.3 Implement GET /api/appeals - danh sách (admin)


    - _Requirements: 9.5_
  - [x] 12.4 Implement PUT /api/appeals/{id} - xử lý (admin)


    - _Requirements: 7.5_
- [x] 13. Implement Ban API Controller




- [ ] 13. Implement Ban API Controller

  - [x] 13.1 Tạo BanController


    - _Requirements: 6.1_

  - [x] 13.2 Implement GET /api/bans/status - kiểm tra ban status

    - Return current user's ban status
    - _Requirements: 6.3_
  - [x] 13.3 Implement GET /api/admin/bans - danh sách bans (admin)


    - _Requirements: 9.1_

## Phase 8: Frontend Components

- [x] 14. Implement Report UI Components


  - [x] 14.1 Tạo ReportButton component


    - Button hiển thị trong match và profile
    - _Requirements: 8.1_

  - [x] 14.2 Tạo ReportModal component

    - Form với type selection và description
    - _Requirements: 8.2, 8.3_

  - [x] 14.3 Implement report submission logic
    - Call API, show success/error notification
    - _Requirements: 8.4, 1.5_

  - [x] 14.4 Tạo BanNotificationModal component


    - Hiển thị khi user bị ban, có nút Khiếu nại
    - _Requirements: 8.5, 6.4_

- [x] 15. Implement Admin Dashboard








  - [x] 15.1 Tạo AdminReportsPage component



    - Danh sách reports với filters
    - _Requirements: 9.1_

  - [x] 15.2 Tạo ReportDetailModal component

    - Hiển thị full report info, AI analysis, actions
    - _Requirements: 9.2, 9.3_

  - [x] 15.3 Tạo AdminAppealsPage component

    - Danh sách appeals với actions
    - _Requirements: 9.5_

  - [x] 15.4 Implement admin action handlers

    - Update status, apply/lift bans
    - _Requirements: 9.3, 9.4_

## -hase 9: Integration và Test
ing
- [x] 16. Integration và wiring






- [ ] 16. Integration và wiring

  - [x] 16.1 Register services trong ServiceProvider


    - Bind interfaces to implementations
  - [x] 16.2 Add routes trong api.php

    - Report, Appeal, Ban routes với middleware
  - [x] 16.3 Add middleware cho rate limiting

    - _Requirements: Non-functional_
  - [x] 16.4 Add middleware cho admin authorization

    - _Requirements: 9.1_
-


- [x] 17. Integration tests



  - [x] 17.1 Test full report submission flow


    - Create report → Rule analysis → AI → Decision
  - [x] 17.2 Test appeal flow







    --Create appeal → Admin revi
ew → Lift ban
  - [x] 17.3 Test admin workflow






    - View reports → Take action → Log action
-

- [x] 18. Fin+al Checkpoint - Đảm bảo tất cả tests pass







  - Ensure all tests pass, ask the user if questions arise.
