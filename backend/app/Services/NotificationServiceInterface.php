<?php

namespace App\Services;

/**
 * Interface for notification service
 */
interface NotificationServiceInterface
{
    /**
     * Create a new notification with optional gift
     * 
     * @param string $adminId Admin who sends the notification
     * @param string $title Notification title
     * @param string $content Notification content
     * @param array $recipientIds List of recipient user IDs (empty for broadcast)
     * @param bool $isBroadcast Whether this is a broadcast to all users
     * @param array|null $giftData Optional gift data: ['coins' => int, 'gems' => int, 'items' => string[]]
     * @return array Result with 'success', 'notification_id', 'error', 'has_gift'
     */
    public function create(string $adminId, string $title, string $content, array $recipientIds, bool $isBroadcast, ?array $giftData = null): array;

    /**
     * Claim gift from notification
     * 
     * @param string $userId User ID
     * @param string $notificationId Notification ID
     * @return array Result with 'success', 'claimed' => ['coins', 'gems', 'items'], 'error'
     */
    public function claimGift(string $userId, string $notificationId): array;

    /**
     * Get gift claim statistics for a notification
     * 
     * @param string $notificationId Notification ID
     * @return array Stats with 'total_recipients', 'claimed_count', 'unclaimed_count'
     */
    public function getGiftClaimStats(string $notificationId): array;

    /**
     * Get user's inbox with pagination
     * 
     * @param string $userId User ID
     * @param int $page Page number (1-based)
     * @param int $limit Items per page
     * @return array List of notifications with metadata
     */
    public function getInbox(string $userId, int $page = 1, int $limit = 20): array;

    /**
     * Get single notification detail
     * 
     * @param string $userId User ID
     * @param string $notificationId Notification ID
     * @return array|null Notification data or null if not found
     */
    public function getNotification(string $userId, string $notificationId): ?array;

    /**
     * Mark notification as read
     * 
     * @param string $userId User ID
     * @param string $notificationId Notification ID
     * @return bool Success status
     */
    public function markAsRead(string $userId, string $notificationId): bool;

    /**
     * Mark all notifications as read for user
     * 
     * @param string $userId User ID
     * @return int Number of notifications marked as read
     */
    public function markAllAsRead(string $userId): int;

    /**
     * Delete notification for user (soft delete)
     * 
     * @param string $userId User ID
     * @param string $notificationId Notification ID
     * @return bool Success status
     */
    public function deleteForUser(string $userId, string $notificationId): bool;

    /**
     * Delete notification by admin (cascade to all users)
     * 
     * @param string $adminId Admin ID
     * @param string $notificationId Notification ID
     * @return bool Success status
     */
    public function deleteByAdmin(string $adminId, string $notificationId): bool;

    /**
     * Get unread notification count for user
     * 
     * @param string $userId User ID
     * @return int Unread count
     */
    public function getUnreadCount(string $userId): int;

    /**
     * Get sent notifications by admin
     * 
     * @param string $adminId Admin ID
     * @param int $page Page number
     * @param int $limit Items per page
     * @return array List of sent notifications
     */
    public function getSentNotifications(string $adminId, int $page = 1, int $limit = 20): array;

    /**
     * Get read statistics for a notification
     * 
     * @param string $notificationId Notification ID
     * @return array Stats with 'total_recipients', 'read_count', 'unread_count'
     */
    public function getReadStats(string $notificationId): array;

    /**
     * Debug: Get notifications with gift_data for debugging
     * Remove in production
     * 
     * @return array Debug info about notifications and gift_data column
     */
    public function debugGetNotificationsWithGift(): array;
}
