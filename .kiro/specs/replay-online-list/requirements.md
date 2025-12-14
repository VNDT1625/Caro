# Requirements Document

## Introduction

Tính năng hiển thị danh sách người chơi đang online trong chế độ xem lại diễn biến ván cờ (Replay Mode). Cho phép người dùng xem ai đang online khi họ đang xem replay/phân tích ván đấu, tạo cơ hội kết nối và thách đấu.

## Glossary

- **Replay Mode**: Chế độ xem lại diễn biến ván cờ từng nước một trong trang AI Analysis
- **Online List**: Danh sách người chơi đang trực tuyến trong hệ thống
- **Presence**: Trạng thái online/offline của người dùng được theo dõi qua Supabase Realtime
- **AI Analysis Page**: Trang phân tích ván đấu với AI, nơi người dùng có thể xem replay

## Requirements

### Requirement 1

**User Story:** As a user viewing a replay, I want to see a list of online players, so that I can know who is available to play or chat with.

#### Acceptance Criteria

1. WHEN a user opens the AI Analysis page THEN the system SHALL display an online players panel showing currently online users
2. WHEN a user's online status changes THEN the system SHALL update the online list in real-time within 5 seconds
3. WHEN displaying online players THEN the system SHALL show each player's avatar, username, and rank
4. WHEN the online list contains more than 10 players THEN the system SHALL provide scrollable view with pagination
5. IF the user is not authenticated THEN the system SHALL hide the online players panel

### Requirement 2

**User Story:** As a user, I want to interact with online players from the replay view, so that I can challenge them or start a conversation.

#### Acceptance Criteria

1. WHEN a user clicks on an online player THEN the system SHALL show a context menu with options (View Profile, Challenge, Message)
2. WHEN a user selects "Challenge" option THEN the system SHALL send a game invitation to the selected player
3. WHEN a user selects "Message" option THEN the system SHALL open a direct message chat with the selected player
4. WHEN a user selects "View Profile" option THEN the system SHALL navigate to the selected player's profile page

### Requirement 3

**User Story:** As a user, I want to filter and search online players, so that I can find specific friends or players of similar skill level.

#### Acceptance Criteria

1. WHEN a user types in the search box THEN the system SHALL filter online players by username in real-time
2. WHEN a user selects a rank filter THEN the system SHALL show only online players of that rank
3. WHEN a user toggles "Friends Only" filter THEN the system SHALL show only online friends
4. WHEN no players match the filter criteria THEN the system SHALL display an appropriate empty state message

### Requirement 4

**User Story:** As a user, I want to see the total count of online players, so that I can gauge the activity level of the platform.

#### Acceptance Criteria

1. WHEN the online list loads THEN the system SHALL display the total count of online players in the header
2. WHEN the online count changes THEN the system SHALL update the displayed count in real-time
3. WHEN hovering over the online count THEN the system SHALL show a tooltip with breakdown by rank
