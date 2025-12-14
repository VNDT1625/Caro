<?php

namespace App\Models;

/**
 * AdminNotification model for admin-to-user messaging
 * Table: admin_notifications
 */
class AdminNotification extends BaseModel
{
    protected string $table = 'admin_notifications';

    protected array $fillable = [
        'admin_id',
        'title',
        'content',
        'is_broadcast',
        'created_at',
        'deleted_at'
    ];

    /**
     * Validate notification data
     */
    public static function validate(array $data): array
    {
        $errors = [];

        if (empty($data['title']) || trim($data['title']) === '') {
            $errors['title'] = 'Title is required';
        } elseif (strlen($data['title']) > 255) {
            $errors['title'] = 'Title must not exceed 255 characters';
        }

        if (empty($data['content']) || trim($data['content']) === '') {
            $errors['content'] = 'Content is required';
        }

        if (empty($data['admin_id'])) {
            $errors['admin_id'] = 'Admin ID is required';
        }

        return $errors;
    }

    /**
     * Check if notification data is valid
     */
    public static function isValid(array $data): bool
    {
        return empty(self::validate($data));
    }

    /**
     * Create notification array from input
     */
    public static function fromInput(string $adminId, string $title, string $content, bool $isBroadcast = false): array
    {
        return [
            'admin_id' => $adminId,
            'title' => trim($title),
            'content' => trim($content),
            'is_broadcast' => $isBroadcast,
            'created_at' => date('c')
        ];
    }

    /**
     * Get content preview (first 100 chars)
     */
    public static function getPreview(string $content, int $length = 100): string
    {
        $content = strip_tags($content);
        if (strlen($content) <= $length) {
            return $content;
        }
        return substr($content, 0, $length) . '...';
    }
}
