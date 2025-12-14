# Requirements Document

## Introduction

Hệ thống "Báo cáo vi phạm / gian lận" cho phép người chơi báo cáo các hành vi vi phạm trong game Cờ Caro online. Hệ thống tích hợp AI để tự động phân tích và phát hiện gian lận, đồng thời cung cấp giao diện quản trị cho admin xử lý các báo cáo.

## Glossary

- **Report**: Báo cáo vi phạm do người chơi gửi
- **Reporter**: Người gửi báo cáo
- **Reported User**: Người bị báo cáo
- **Rule-based Detection**: Hệ thống phát hiện bất thường dựa trên quy tắc cố định
- **AI Detection**: Hệ thống AI phân tích và đánh giá gian lận
- **Appeal**: Khiếu nại của người chơi bị xử phạt
- **Auto-flag**: Tự động đánh dấu báo cáo là gian lận rõ ràng
- **Escalate**: Chuyển báo cáo lên admin xem xét thủ công

## Requirements

### Requirement 1: Gửi báo cáo vi phạm

**User Story:** As a player, I want to report violations or cheating, so that the game remains fair and enjoyable.

#### Acceptance Criteria

1. WHEN a player clicks the report button THEN the system SHALL display a report form with violation type options: "gian_lan_trong_tran", "toxic", "bug", "khac"
2. WHEN a player submits a report from a match context THEN the system SHALL automatically attach the match_id to the report
3. WHEN a player submits a report THEN the system SHALL allow optional description text up to 1000 characters
4. WHEN a player submits a report against another player THEN the system SHALL record the reported_user_id
5. WHEN a report is successfully submitted THEN the system SHALL display a confirmation message "Đã gửi report, hệ thống sẽ kiểm tra"

### Requirement 2: Lưu trữ và quản lý báo cáo

**User Story:** As a system administrator, I want reports to be stored with complete information, so that I can review and process them effectively.

#### Acceptance Criteria

1. WHEN a report is created THEN the system SHALL store: id, reporter_id, reported_user_id, match_id, type, description, status, created_at, updated_at
2. WHEN a report is created THEN the system SHALL set initial status to "pending"
3. WHEN a report status changes THEN the system SHALL update the updated_at timestamp
4. WHEN querying reports THEN the system SHALL support filtering by status: "pending", "auto_flagged", "resolved", "dismissed", "escalated"
5. WHEN a report references a match THEN the system SHALL validate that the match_id exists in the database

### Requirement 3: Rule-based Detection cho gian lận trong trận

**User Story:** As a system, I want to automatically detect obvious cheating patterns, so that clear violations can be flagged immediately.

#### Acceptance Criteria

1. WHEN a "gian_lan_trong_tran" report with match_id is received THEN the system SHALL fetch complete match data including moves, players, and mode
2. WHEN analyzing match data THEN the system SHALL detect if a player made multiple moves in a single turn
3. WHEN analyzing match data THEN the system SHALL detect if both players have winning conditions simultaneously
4. WHEN analyzing match data THEN the system SHALL detect impossible move sequences or timestamps
5. WHEN anomalies are detected THEN the system SHALL generate a reason_result string describing each anomaly with specific details

### Requirement 4: AI Integration cho phân tích gian lận

**User Story:** As a system, I want AI to analyze match data for cheating, so that complex fraud patterns can be detected.

#### Acceptance Criteria

1. WHEN processing a cheating report THEN the backend SHALL call the AI model (NOT from frontend)
2. WHEN calling AI THEN the system SHALL send $information (match data JSON) and $reason_result (rule-based findings)
3. WHEN AI responds THEN the system SHALL expect JSON format: {"report_result": "co"|"khong", "summary_for_player": string, "details_for_admin": string}
4. WHEN AI returns invalid format THEN the system SHALL log the error and NOT use the result
5. WHEN AI analysis completes THEN the system SHALL store the AI response with the report for admin review

### Requirement 5: Logic quyết định xử lý báo cáo

**User Story:** As a system, I want to automatically determine report outcomes, so that clear cases are handled efficiently.

#### Acceptance Criteria

1. WHEN rule-based detects clear anomaly AND AI returns "co" THEN the system SHALL set status to "auto_flagged"
2. WHEN rule-based has suspicion BUT AI returns "khong" THEN the system SHALL set status to "escalated" for admin review
3. WHEN rule-based finds nothing AND AI returns "khong" THEN the system SHALL set status to "dismissed"
4. WHEN processing reports THEN the system SHALL NOT lock accounts directly from frontend
5. WHEN a report is auto_flagged THEN the system SHALL log the complete reason including rule-based and AI findings

### Requirement 6: Xử lý tài khoản vi phạm

**User Story:** As a system administrator, I want violating accounts to be penalized appropriately, so that fair play is enforced.

#### Acceptance Criteria

1. WHEN a report is auto_flagged THEN the system SHALL apply configured penalty (temporary ban 3/7 days or permanent)
2. WHEN banning an account THEN the system SHALL log detailed reason combining reason_result and details_for_admin
3. WHEN an account is banned THEN the system SHALL send in-app notification with ban reason and duration
4. WHEN displaying ban notification THEN the system SHALL show summary_for_player and provide "OK" and "Khiếu nại" buttons
5. WHEN penalty configuration changes THEN the system SHALL read from environment variables or config file

### Requirement 7: Hệ thống khiếu nại

**User Story:** As a banned player, I want to appeal my ban, so that wrongful bans can be reviewed and reversed.

#### Acceptance Criteria

1. WHEN a banned player clicks "Khiếu nại" THEN the system SHALL create an appeal record linked to the original report_id
2. WHEN an appeal is created THEN the system SHALL NOT send it to AI for processing
3. WHEN an appeal is created THEN the system SHALL add it to admin review queue with status "pending_appeal"
4. WHEN admin reviews an appeal THEN the system SHALL display: match info, $information, $reason_result, AI JSON response, ban history
5. WHEN admin processes an appeal THEN the system SHALL provide options: "Giữ nguyên xử lý", "Gỡ ban và xin lỗi", "Sửa note nội bộ"

### Requirement 8: Giao diện người chơi

**User Story:** As a player, I want an intuitive interface to report violations, so that I can easily submit reports when needed.

#### Acceptance Criteria

1. WHEN viewing a match or match history THEN the system SHALL display a "Báo cáo" button
2. WHEN clicking report button THEN the system SHALL show a popup form with type selection and description field
3. WHEN submitting report THEN the system SHALL validate required fields before sending
4. WHEN report is submitted THEN the system SHALL close the popup and show success notification
5. WHEN a player is banned THEN the system SHALL display ban notification modal on login with reason and appeal option

### Requirement 9: Giao diện Admin

**User Story:** As an administrator, I want a comprehensive admin interface, so that I can efficiently manage and process reports.

#### Acceptance Criteria

1. WHEN admin accesses report list THEN the system SHALL display reports with filters for status, type, and date range
2. WHEN admin views report detail THEN the system SHALL show: reporter info, reported user info, match_id, player description, reason_result, AI JSON
3. WHEN admin views report detail THEN the system SHALL display action buttons based on current status
4. WHEN admin takes action THEN the system SHALL update report status and log the action with admin_id and timestamp
5. WHEN admin views appeal THEN the system SHALL show complete history including original report, AI analysis, and previous actions
