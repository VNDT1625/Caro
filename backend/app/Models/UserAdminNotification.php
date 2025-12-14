<?php

namespace App\Models;

/**
 * UserAdminNotification model for tracking admin notification delivery and read status
 * Table: user_admin_notifications
 */
class UserAdminNotification extends BaseModel
{
    protected string $table = 'user_admin_notifications';

    protected array $fillable = [
        'notification_id',
        'user_id',
        'is_read',
        'read_at',
        'deleted_at',
        'created_at'
    ];

    /**
     * Create user notification record
     */
    public static function create(string $notificationId, string $userId): array
    {
        return [
            'notification_id' => $notificationId,
            'user_id' => $userId,
            'is_read' => false,
            'read_at' => null,
            'deleted_at' => null,
            'created_at' => date('c')
        ];
    }

    /**
     * Mark as read data
     */
    public static function markReadData(): array
    {
        return [
            'is_read' => true,
            'read_at' => date('c')
        ];
    }

    /**
     * Soft delete data
     */
    public static function softDeleteData(): array
    {
        return [
            'deleted_at' => date('c')
        ];
    }

    /**
     * Check if notification is read
     */
    public static function isRead(array $userNotification): bool
    {
        return isset($userNotification['is_read']) && $userNotification['is_read'] === true;
    }

    /**
     * Check if notification is deleted
     */
    public static function isDeleted(array $userNotification): bool
    {
        return !empty($userNotification['deleted_at']);
    }
}
