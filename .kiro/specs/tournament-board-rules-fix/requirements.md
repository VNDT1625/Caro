# Requirements Document

## Introduction

Tính năng "Vạn Môn Tranh Đấu" (Tournament mode) hiện tại thiếu phần cài đặt "Luật bàn cờ" bao gồm:
1. Chọn chế độ đấu (4 chế độ từ Dị Biến Kỳ: Normal, Caro Skill, Caro Ẩn, Caro Địa Hình)
2. Chọn Swap2 opening rule

Cần bổ sung các tùy chọn này vào phần cài đặt trận đấu của Tournament mode trong CreateRoom.tsx.

## Glossary

- **Tournament Mode (Vạn Môn Tranh Đấu)**: Chế độ giải đấu cho phép tổ chức các trận đấu theo format giải
- **Variant Modes (Dị Biến Kỳ)**: Các chế độ chơi đặc biệt với luật khác nhau
- **Swap2 Opening Rule**: Luật mở đầu công bằng - P1 đặt 3 quân, P2 chọn màu hoặc đặt thêm 2 quân
- **Game Type**: Kiểu chơi (Normal, Caro Skill, Caro Ẩn, Caro Địa Hình, Caro theo cặp)
- **CreateRoom**: Trang tạo phòng trong frontend

## Requirements

### Requirement 1

**User Story:** As a tournament organizer, I want to select game type (variant mode) when creating a tournament room, so that I can customize the tournament rules.

#### Acceptance Criteria

1. WHEN a user selects Tournament mode in CreateRoom THEN the System SHALL display a game type selector with options: Normal, Caro Skill, Caro Ẩn, Caro Địa Hình, Caro theo cặp
2. WHEN a user selects a game type in Tournament mode THEN the System SHALL store the selected game type in matchSettings.gameType
3. WHEN Tournament mode is active THEN the System SHALL default the game type to 'normal'

### Requirement 2

**User Story:** As a tournament organizer, I want to enable or disable Swap2 opening rule for tournament matches, so that I can choose whether to use professional opening rules.

#### Acceptance Criteria

1. WHEN a user is in Tournament mode settings THEN the System SHALL display a Swap2 toggle option
2. WHEN a user toggles Swap2 in Tournament mode THEN the System SHALL update matchSettings.swap2Enabled accordingly
3. WHEN Tournament mode is active THEN the System SHALL default Swap2 to enabled (true)
4. WHEN displaying Swap2 toggle THEN the System SHALL show a tooltip explaining the Swap2 rule

### Requirement 3

**User Story:** As a user, I want to see the selected game type and Swap2 status in the match summary, so that I can verify my tournament settings before creating the room.

#### Acceptance Criteria

1. WHEN displaying match summary for Tournament mode THEN the System SHALL show the selected game type
2. WHEN displaying match summary for Tournament mode THEN the System SHALL show the Swap2 status (ON/OFF)
