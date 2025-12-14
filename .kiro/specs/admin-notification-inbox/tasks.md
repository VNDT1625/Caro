# Implementation Plan

## 1. Database Setup

- [x] 1.1 Create notifications table migration
  - Create `infra/migrations/20251205_000003_create_notifications_table.sql`
  - Include: id, admin_id, title, content, is_broadcast, created_at, deleted_at
  - Add foreign key to profiles table
  - _Requirements: 1.1, 1.5_

- [x] 1.2 Create user_notifications table migration
  - Create `infra/migrations/20251205_000004_create_user_notifications_table.sql`
  - Include: id, notification_id, user_id, is_read, read_at, deleted_at, created_at
  - Add indexes for user_id and unread queries
  - Add RLS policies
  - _Requirements: 2.1, 2.5_

## 2. Backend Models

- [x] 2.1 Create Notification model
  - Create `backend/app/Models/Notification.php`
  - Implement BaseModel with table mapping
  - Add validation methods
  - _Requirements: 1.1, 1.4_

- [x] 2.2 Create UserNotification model
  - Create `backend/app/Models/UserNotification.php`
  - Implement BaseModel with table mapping
  - Add relationship methods
  - _Requirements: 2.1, 2.4_

## 3. Backend Service

- [x] 3.1 Create NotificationServiceInterface
  - Create `backend/app/Services/NotificationServiceInterface.php`
  - Define all interface methods as per design
  - _Requirements: 1.1, 2.1, 3.1, 4.1_

- [x] 3.2 Implement NotificationService - Create method
  - Create `backend/app/Services/NotificationService.php`
  - Implement create() for individual and broadcast notifications
  - Validate title/content not empty
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ]* 3.3 Write property test for notification creation
  - **Property 1: Notification Creation Integrity**
  - **Property 3: Validation Rejection**
  - **Validates: Requirements 1.1, 1.3, 1.4, 1.5**

- [x] 3.4 Implement NotificationService - Inbox methods
  - Implement getInbox() with pagination and sorting
  - Implement getNotification() with auto mark read
  - Implement getUnreadCount()
  - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [ ]* 3.5 Write property test for inbox operations
  - **Property 4: Inbox Sort Order**
  - **Property 5: Notification Display Fields**
  - **Property 6: Auto Mark Read**
  - **Property 7: Unread Count Accuracy**
  - **Validates: Requirements 2.1, 2.2, 2.4, 2.5**

- [x] 3.6 Implement NotificationService - User management methods
  - Implement markAsRead()
  - Implement markAllAsRead()
  - Implement deleteForUser()
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ]* 3.7 Write property test for user management
  - **Property 8: User Deletion Isolation**
  - **Property 9: Mark All Read Completeness**
  - **Validates: Requirements 3.1, 3.3, 3.4**

- [x] 3.8 Implement NotificationService - Admin methods
  - Implement getSentNotifications()
  - Implement getReadStats()
  - Implement deleteByAdmin()
  - _Requirements: 4.1, 4.2, 4.3_

- [ ]* 3.9 Write property test for admin operations
  - **Property 10: Admin Sent List Ownership**
  - **Property 11: Read Statistics Accuracy**
  - **Property 12: Admin Cascade Delete**
  - **Validates: Requirements 4.1, 4.2, 4.3**

## 4. Backend Controller

- [x] 4.1 Create NotificationController
  - Create `backend/app/Controllers/NotificationController.php`
  - Implement all endpoints as per design
  - Add admin authorization for send/admin endpoints
  - _Requirements: 1.1, 2.1, 3.1, 4.1_

- [x] 4.2 Register routes
  - Add notification routes to `backend/routes/api.php`
  - Configure middleware for admin routes
  - _Requirements: 1.1, 2.1_

- [x] 4.3 Register service in ServiceProvider
  - Add NotificationService to `backend/bootstrap/ServiceProvider.php`
  - _Requirements: 1.1_

## 5. Checkpoint - Backend Tests

- [ ] 5. Checkpoint - Make sure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## 6. Frontend - Inbox Components

- [x] 6.1 Create notification API client
  - Create `frontend/src/lib/notificationApi.ts`
  - Implement all API calls: getInbox, getNotification, markRead, markAllRead, delete, getUnreadCount
  - _Requirements: 2.1, 3.1_

- [x] 6.2 Create useNotifications hook
  - Create `frontend/src/hooks/useNotifications.ts`
  - Manage inbox state, pagination, loading
  - Handle realtime updates
  - _Requirements: 2.1, 5.1_

- [x] 6.3 Create InboxIcon component
  - Create `frontend/src/components/notification/InboxIcon.tsx`
  - Display bell icon with unread badge
  - Subscribe to realtime count updates
  - _Requirements: 2.5, 5.1_

- [x] 6.4 Create InboxPage
  - Create `frontend/src/pages/Inbox.tsx`
  - List notifications with pagination
  - Filter tabs: All / Unread
  - Actions: Mark read, Delete, Mark all read
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

- [x] 6.5 Create NotificationDetailModal
  - Create `frontend/src/components/notification/NotificationDetailModal.tsx`
  - Display full notification content
  - Auto mark as read on open
  - _Requirements: 2.3, 2.4_

## 7. Frontend - Admin Components

- [x] 7.1 Create admin notification API
  - Add admin methods to `frontend/src/lib/notificationApi.ts`
  - Implement: sendNotification, getSentNotifications, getReadStats, adminDelete
  - _Requirements: 1.1, 4.1, 4.2, 4.3_

- [x] 7.2 Create AdminNotificationPage
  - Create `frontend/src/pages/AdminNotifications.tsx`
  - Form: title, content, recipient selection
  - User search/select for specific recipients
  - List sent notifications with stats
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2_

- [x] 7.3 Create UserSelectModal
  - Create `frontend/src/components/notification/UserSelectModal.tsx`
  - Search users by username
  - Multi-select recipients
  - _Requirements: 1.3_

## 8. Frontend - Integration

- [x] 8.1 Add InboxIcon to header/navbar
  - Integrate InboxIcon into main layout
  - Add route to Inbox page
  - _Requirements: 2.5_

- [x] 8.2 Add AdminNotifications to admin menu
  - Add link in admin navigation
  - Add route configuration
  - _Requirements: 1.1_

- [x] 8.3 Add i18n translations
  - Add Vietnamese and English translations for all notification UI text
  - _Requirements: 2.2_

## 9. Realtime Integration

- [x] 9.1 Add socket events for notifications
  - Add `new_notification` event to server
  - Emit when notification created
  - _Requirements: 5.1, 5.2_

- [x] 9.2 Handle realtime in frontend
  - Subscribe to `new_notification` in useNotifications hook
  - Update unread count and show toast
  - _Requirements: 5.1, 5.2, 5.3_

## 10. Final Checkpoint

- [ ] 10. Final Checkpoint - Make sure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
