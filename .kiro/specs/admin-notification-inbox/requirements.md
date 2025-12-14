# Requirements Document

## Introduction

Hệ thống thông báo từ Admin tới người dùng (Inbox/Mailbox) cho phép quản trị viên gửi thông báo đến người dùng cụ thể hoặc tất cả người dùng. Người dùng có thể xem, đánh dấu đã đọc và xóa thông báo trong hộp thư của mình.

## Glossary

- **Notification**: Một thông báo từ admin gửi đến người dùng
- **Inbox**: Hộp thư chứa các thông báo của người dùng
- **Admin**: Người quản trị có quyền gửi thông báo
- **Recipient**: Người nhận thông báo
- **Broadcast**: Thông báo gửi đến tất cả người dùng

## Requirements

### Requirement 1

**User Story:** As an admin, I want to send notifications to specific users or all users, so that I can communicate important information effectively.

#### Acceptance Criteria

1. WHEN an admin submits a notification with title, content, and recipient selection THEN the System SHALL create the notification and deliver it to selected recipients
2. WHEN an admin selects "all users" as recipient THEN the System SHALL create a broadcast notification visible to all users
3. WHEN an admin selects specific users as recipients THEN the System SHALL create individual notifications for each selected user
4. IF an admin submits a notification without title or content THEN the System SHALL reject the submission and display validation error
5. WHEN a notification is created THEN the System SHALL record the creation timestamp and admin sender ID

### Requirement 2

**User Story:** As a user, I want to view my notifications in an inbox, so that I can stay informed about important announcements.

#### Acceptance Criteria

1. WHEN a user opens the inbox THEN the System SHALL display all notifications sorted by creation date (newest first)
2. WHEN displaying notifications THEN the System SHALL show title, preview content, sender name, timestamp, and read status
3. WHEN a user clicks on a notification THEN the System SHALL display the full notification content
4. WHEN a user views a notification THEN the System SHALL mark it as read automatically
5. WHEN the inbox contains unread notifications THEN the System SHALL display an unread count badge on the inbox icon

### Requirement 3

**User Story:** As a user, I want to manage my notifications, so that I can keep my inbox organized.

#### Acceptance Criteria

1. WHEN a user deletes a notification THEN the System SHALL remove it from the user's inbox
2. WHEN a user marks a notification as read THEN the System SHALL update the read status immediately
3. WHEN a user marks all notifications as read THEN the System SHALL update all unread notifications to read status
4. WHEN a user deletes a notification THEN the System SHALL preserve the notification for other recipients (if broadcast)

### Requirement 4

**User Story:** As an admin, I want to manage sent notifications, so that I can track and update communications.

#### Acceptance Criteria

1. WHEN an admin views sent notifications THEN the System SHALL display a list of all notifications sent by that admin
2. WHEN an admin views a sent notification THEN the System SHALL show read statistics (total recipients, read count)
3. WHEN an admin deletes a broadcast notification THEN the System SHALL remove it from all users' inboxes

### Requirement 5

**User Story:** As a user, I want to receive real-time notification updates, so that I can see new messages immediately.

#### Acceptance Criteria

1. WHEN a new notification is sent to a user THEN the System SHALL update the unread count in real-time
2. WHEN a user is online and receives a notification THEN the System SHALL display a toast notification
3. WHEN the notification count changes THEN the System SHALL update the inbox badge without page refresh
