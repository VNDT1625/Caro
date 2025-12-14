<?php

namespace App\Controllers;

use App\Services\NotificationServiceInterface;

/**
 * Controller for notification endpoints
 */
class NotificationController
{
    private NotificationServiceInterface $notificationService;

    public function __construct(NotificationServiceInterface $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    /**
     * POST /api/notifications - Admin sends notification
     */
    public function send(array $request): array
    {
        $adminId = $request['user_id'] ?? null;
        $title = $request['body']['title'] ?? '';
        $content = $request['body']['content'] ?? '';
        $recipientIds = $request['body']['recipient_ids'] ?? [];
        $isBroadcast = $request['body']['is_broadcast'] ?? false;
        $giftData = $request['body']['gift_data'] ?? null;

        if (!$adminId) {
            return $this->error('Unauthorized', 401);
        }

        // Validate required fields
        if (empty(trim($title)) || empty(trim($content))) {
            return $this->error('Title and content are required', 400, 'validation_error');
        }

        // Either broadcast or specific recipients
        if (!$isBroadcast && empty($recipientIds)) {
            return $this->error('Recipients are required for non-broadcast notifications', 400, 'validation_error');
        }

        // Validate gift data if provided
        if ($giftData !== null) {
            if (!is_array($giftData)) {
                return $this->error('Gift data must be an object', 400, 'validation_error');
            }
            // Ensure numeric values
            $giftData['coins'] = (int)($giftData['coins'] ?? 0);
            $giftData['gems'] = (int)($giftData['gems'] ?? 0);
            // Frontend sends item_ids (array of UUIDs referencing items.id)
            $giftData['item_ids'] = $giftData['item_ids'] ?? [];
        }

        $result = $this->notificationService->create($adminId, $title, $content, $recipientIds, $isBroadcast, $giftData);

        if (!$result['success']) {
            return $this->error($result['message'] ?? $result['error'], 400, $result['error']);
        }

        return $this->success([
            'notification_id' => $result['notification_id'],
            'recipients_count' => $result['recipients_count'],
            'has_gift' => $result['has_gift'] ?? false
        ], 201);
    }

    /**
     * POST /api/notifications/{id}/claim-gift - Claim gift from notification
     */
    public function claimGift(array $request): array
    {
        $userId = $request['user_id'] ?? null;
        $notificationId = $request['params']['id'] ?? null;

        if (!$userId) {
            return $this->error('Unauthorized', 401);
        }

        if (!$notificationId) {
            return $this->error('Notification ID is required', 400);
        }

        $result = $this->notificationService->claimGift($userId, $notificationId);

        if (!$result['success']) {
            $errorMessages = [
                'notification_not_found' => 'Notification not found',
                'already_claimed' => 'Gift already claimed',
                'no_gift' => 'This notification has no gift',
                'invalid_gift_data' => 'Invalid gift data'
            ];
            $message = $errorMessages[$result['error']] ?? $result['error'];
            return $this->error($message, 400, $result['error']);
        }

        return $this->success([
            'claimed' => $result['claimed']
        ]);
    }

    /**
     * GET /api/notifications/inbox - Get user's inbox
     */
    public function inbox(array $request): array
    {
        $userId = $request['user_id'] ?? null;
        $page = (int)($request['query']['page'] ?? 1);
        $limit = (int)($request['query']['limit'] ?? 20);

        if (!$userId) {
            return $this->error('Unauthorized', 401);
        }

        $result = $this->notificationService->getInbox($userId, $page, $limit);

        if (!$result['success']) {
            return $this->error($result['error'], 500);
        }

        return $this->success([
            'notifications' => $result['data'],
            'pagination' => $result['pagination']
        ]);
    }

    /**
     * GET /api/notifications/{id} - Get notification detail
     */
    public function show(array $request): array
    {
        $userId = $request['user_id'] ?? null;
        $notificationId = $request['params']['id'] ?? null;

        if (!$userId) {
            return $this->error('Unauthorized', 401);
        }

        if (!$notificationId) {
            return $this->error('Notification ID is required', 400);
        }

        $notification = $this->notificationService->getNotification($userId, $notificationId);

        if (!$notification) {
            return $this->error('Notification not found', 404, 'not_found');
        }

        return $this->success(['notification' => $notification]);
    }

    /**
     * POST /api/notifications/{id}/read - Mark as read
     */
    public function markRead(array $request): array
    {
        $userId = $request['user_id'] ?? null;
        $notificationId = $request['params']['id'] ?? null;

        if (!$userId) {
            return $this->error('Unauthorized', 401);
        }

        if (!$notificationId) {
            return $this->error('Notification ID is required', 400);
        }

        $success = $this->notificationService->markAsRead($userId, $notificationId);

        return $this->success(['marked' => $success]);
    }

    /**
     * POST /api/notifications/read-all - Mark all as read
     */
    public function markAllRead(array $request): array
    {
        $userId = $request['user_id'] ?? null;

        if (!$userId) {
            return $this->error('Unauthorized', 401);
        }

        $count = $this->notificationService->markAllAsRead($userId);

        return $this->success(['marked_count' => $count]);
    }

    /**
     * DELETE /api/notifications/{id} - Delete notification
     */
    public function delete(array $request): array
    {
        $userId = $request['user_id'] ?? null;
        $notificationId = $request['params']['id'] ?? null;

        if (!$userId) {
            return $this->error('Unauthorized', 401);
        }

        if (!$notificationId) {
            return $this->error('Notification ID is required', 400);
        }

        $success = $this->notificationService->deleteForUser($userId, $notificationId);

        return $this->success(['deleted' => $success]);
    }

    /**
     * GET /api/notifications/unread-count - Get unread count
     */
    public function unreadCount(array $request): array
    {
        $userId = $request['user_id'] ?? null;

        if (!$userId) {
            return $this->error('Unauthorized', 401);
        }

        $count = $this->notificationService->getUnreadCount($userId);

        return $this->success(['unread_count' => $count]);
    }

    /**
     * GET /api/admin/notifications/sent - Admin view sent notifications
     */
    public function sent(array $request): array
    {
        $adminId = $request['user_id'] ?? null;
        $page = (int)($request['query']['page'] ?? 1);
        $limit = (int)($request['query']['limit'] ?? 20);

        if (!$adminId) {
            return $this->error('Unauthorized', 401);
        }

        $result = $this->notificationService->getSentNotifications($adminId, $page, $limit);

        if (!$result['success']) {
            return $this->error($result['error'], 500);
        }

        return $this->success([
            'notifications' => $result['data'],
            'pagination' => $result['pagination']
        ]);
    }

    /**
     * GET /api/admin/notifications/{id}/stats - Get read stats
     */
    public function stats(array $request): array
    {
        $notificationId = $request['params']['id'] ?? null;

        if (!$notificationId) {
            return $this->error('Notification ID is required', 400);
        }

        $stats = $this->notificationService->getReadStats($notificationId);

        return $this->success(['stats' => $stats]);
    }

    /**
     * DELETE /api/admin/notifications/{id} - Admin delete notification
     */
    public function adminDelete(array $request): array
    {
        $adminId = $request['user_id'] ?? null;
        $notificationId = $request['params']['id'] ?? null;

        if (!$adminId) {
            return $this->error('Unauthorized', 401);
        }

        if (!$notificationId) {
            return $this->error('Notification ID is required', 400);
        }

        $success = $this->notificationService->deleteByAdmin($adminId, $notificationId);

        if (!$success) {
            return $this->error('Failed to delete notification or not authorized', 403, 'forbidden');
        }

        return $this->success(['deleted' => true]);
    }

    /**
     * Success response helper
     */
    private function success(array $data, int $status = 200): array
    {
        return [
            'status' => $status,
            'body' => array_merge(['success' => true], $data)
        ];
    }

    /**
     * GET /api/debug/notifications - Debug: Check notifications with gift_data
     * This is for debugging only - remove in production
     */
    public function debugNotifications(array $request): array
    {
        $result = $this->notificationService->debugGetNotificationsWithGift();
        return $this->success($result);
    }

    /**
     * Error response helper
     */
    private function error(string $message, int $status = 400, string $error = 'error'): array
    {
        return [
            'status' => $status,
            'body' => [
                'success' => false,
                'error' => $error,
                'message' => $message
            ]
        ];
    }
}
