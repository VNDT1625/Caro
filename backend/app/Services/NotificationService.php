<?php

namespace App\Services;

use App\Models\AdminNotification;
use App\Models\UserAdminNotification;

/**
 * Service for managing admin notifications to users
 * Uses tables: admin_notifications, user_admin_notifications
 * Supports gift attachments (coins, gems, items)
 */
class NotificationService implements NotificationServiceInterface
{
    private $supabase;
    private ?CurrencyServiceInterface $currencyService;

    public function __construct($supabaseClient = null, ?CurrencyServiceInterface $currencyService = null)
    {
        $this->supabase = $supabaseClient;
        $this->currencyService = $currencyService;
    }

    /**
     * Set Supabase client (for testing)
     */
    public function setSupabaseClient($client): void
    {
        $this->supabase = $client;
    }

    /**
     * Set currency service (for dependency injection)
     */
    public function setCurrencyService(CurrencyServiceInterface $service): void
    {
        $this->currencyService = $service;
    }

    /**
     * Create a new notification with optional gift
     * @param array|null $giftData Format: ['coins' => int, 'gems' => int, 'items' => string[]]
     */
    public function create(string $adminId, string $title, string $content, array $recipientIds, bool $isBroadcast, ?array $giftData = null): array
    {
        // Validate input
        $notificationData = AdminNotification::fromInput($adminId, $title, $content, $isBroadcast);
        $errors = AdminNotification::validate($notificationData);
        
        if (!empty($errors)) {
            return [
                'success' => false,
                'error' => 'validation_error',
                'errors' => $errors
            ];
        }

        // Validate gift data if provided
        if ($giftData !== null) {
            $giftErrors = $this->validateGiftData($giftData);
            if (!empty($giftErrors)) {
                return [
                    'success' => false,
                    'error' => 'gift_validation_error',
                    'errors' => $giftErrors
                ];
            }
            // Supabase JSONB accepts array directly, no need to json_encode
            $notificationData['gift_data'] = $giftData;
            error_log("[NotificationService] create - gift_data to save: " . json_encode($giftData));
        }

        // For broadcast, get all user IDs
        if ($isBroadcast) {
            $recipientIds = $this->getAllUserIds();
        }

        if (empty($recipientIds)) {
            return [
                'success' => false,
                'error' => 'no_recipients',
                'message' => 'No recipients specified'
            ];
        }

        try {
            // Create notification record
            $notificationId = $this->insertNotification($notificationData);
            
            if (!$notificationId) {
                return [
                    'success' => false,
                    'error' => 'insert_failed',
                    'message' => 'Failed to create notification'
                ];
            }

            // Create user_admin_notification records for each recipient
            $created = $this->createUserNotifications($notificationId, $recipientIds);

            // Get admin email for notification
            $senderName = $this->getAdminEmail($adminId);

            // Send realtime notification via socket server
            $this->emitRealtimeNotification($recipientIds, [
                'id' => $notificationId,
                'title' => $title,
                'content_preview' => AdminNotification::getPreview($content),
                'sender_name' => $senderName,
                'is_broadcast' => $isBroadcast,
                'has_gift' => $giftData !== null,
                'created_at' => date('c')
            ], $isBroadcast);

            return [
                'success' => true,
                'notification_id' => $notificationId,
                'recipients_count' => $created,
                'has_gift' => $giftData !== null
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => 'exception',
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Validate gift data
     */
    private function validateGiftData(array $giftData): array
    {
        $errors = [];
        
        $coins = $giftData['coins'] ?? 0;
        $gems = $giftData['gems'] ?? 0;
        $itemIds = $giftData['item_ids'] ?? [];

        if (!is_int($coins) || $coins < 0) {
            $errors[] = 'Coins must be a non-negative integer';
        }
        if (!is_int($gems) || $gems < 0) {
            $errors[] = 'Gems must be a non-negative integer';
        }
        if (!is_array($itemIds)) {
            $errors[] = 'item_ids must be an array';
        }
        if ($coins === 0 && $gems === 0 && empty($itemIds)) {
            $errors[] = 'Gift must contain at least coins, gems, or items';
        }
        if ($coins > 100000) {
            $errors[] = 'Coins cannot exceed 100,000 per notification';
        }
        if ($gems > 10000) {
            $errors[] = 'Gems cannot exceed 10,000 per notification';
        }

        // Validate item_ids exist in items table
        if (!empty($itemIds)) {
            $validItems = $this->validateItemIds($itemIds);
            if (count($validItems) !== count($itemIds)) {
                $errors[] = 'Some item_ids are invalid or do not exist';
            }
        }

        return $errors;
    }

    /**
     * Validate item IDs exist in items table
     */
    private function validateItemIds(array $itemIds): array
    {
        try {
            $result = $this->supabase
                ->from('items')
                ->select('id')
                ->in('id', $itemIds)
                ->execute();
            
            return array_column($result->data ?? [], 'id');
        } catch (\Exception $e) {
            return [];
        }
    }

    /**
     * Get user's inbox with pagination
     */
    public function getInbox(string $userId, int $page = 1, int $limit = 20): array
    {
        $offset = ($page - 1) * $limit;
        
        try {
            // Get user notifications with notification details
            $query = $this->supabase
                ->from('user_admin_notifications')
                ->select('*, admin_notifications!inner(id, admin_id, title, content, is_broadcast, created_at, gift_data)')
                ->eq('user_id', $userId)
                ->is('deleted_at', null)
                ->order('created_at', ['ascending' => false])
                ->range($offset, $offset + $limit - 1);
            
            $result = $query->execute();
            $items = $result->data ?? [];

            // Get total count
            $countQuery = $this->supabase
                ->from('user_admin_notifications')
                ->select('id', ['count' => 'exact'])
                ->eq('user_id', $userId)
                ->is('deleted_at', null);
            
            $countResult = $countQuery->execute();
            $total = $countResult->count ?? count($items);

            // Format response
            $notifications = array_map(function ($item) {
                $notification = $item['admin_notifications'] ?? [];
                $senderName = $this->getAdminEmail($notification['admin_id'] ?? '');
                
                // Parse gift_data - may be string or array from Supabase JSONB
                $giftDataRaw = $notification['gift_data'] ?? null;
                $giftData = null;
                if ($giftDataRaw !== null) {
                    $giftData = is_string($giftDataRaw) ? json_decode($giftDataRaw, true) : $giftDataRaw;
                }
                
                // Check if has gift with actual values
                $hasGift = $giftData !== null && (
                    ($giftData['coins'] ?? 0) > 0 || 
                    ($giftData['gems'] ?? 0) > 0 || 
                    !empty($giftData['item_ids'] ?? [])
                );
                
                return [
                    'id' => $item['notification_id'],
                    'user_notification_id' => $item['id'],
                    'title' => $notification['title'] ?? '',
                    'content_preview' => AdminNotification::getPreview($notification['content'] ?? ''),
                    'sender_name' => $senderName,
                    'is_read' => $item['is_read'] ?? false,
                    'read_at' => $item['read_at'],
                    'created_at' => $notification['created_at'] ?? $item['created_at'],
                    'is_broadcast' => $notification['is_broadcast'] ?? false,
                    'has_gift' => $hasGift,
                    'gift_claimed' => $item['gift_claimed'] ?? false
                ];
            }, $items);

            return [
                'success' => true,
                'data' => $notifications,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'total_pages' => ceil($total / $limit)
                ]
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'data' => []
            ];
        }
    }

    /**
     * Get single notification detail
     */
    public function getNotification(string $userId, string $notificationId): ?array
    {
        try {
            $query = $this->supabase
                ->from('user_admin_notifications')
                ->select('*, admin_notifications!inner(id, admin_id, title, content, is_broadcast, created_at, gift_data)')
                ->eq('user_id', $userId)
                ->eq('notification_id', $notificationId)
                ->is('deleted_at', null)
                ->single();
            
            $result = $query->execute();
            $item = $result->data;

            if (!$item) {
                return null;
            }

            // Auto mark as read
            if (!($item['is_read'] ?? false)) {
                $this->markAsRead($userId, $notificationId);
            }

            $notification = $item['admin_notifications'] ?? [];
            $senderName = $this->getAdminEmail($notification['admin_id'] ?? '');
            
            // Parse gift data - handle both string (JSON) and array from Supabase JSONB
            $giftData = null;
            $rawGiftData = $notification['gift_data'] ?? null;
            if ($rawGiftData !== null) {
                if (is_string($rawGiftData)) {
                    $giftData = json_decode($rawGiftData, true);
                } elseif (is_array($rawGiftData)) {
                    $giftData = $rawGiftData;
                }
            }
            
            // Debug log for gift data
            error_log("[NotificationService] getNotification - raw gift_data: " . json_encode($rawGiftData));
            error_log("[NotificationService] getNotification - parsed gift_data: " . json_encode($giftData));
            
            return [
                'id' => $item['notification_id'],
                'user_notification_id' => $item['id'],
                'title' => $notification['title'] ?? '',
                'content' => $notification['content'] ?? '',
                'sender_name' => $senderName,
                'is_read' => true, // Now marked as read
                'read_at' => $item['read_at'] ?? date('c'),
                'created_at' => $notification['created_at'] ?? $item['created_at'],
                'is_broadcast' => $notification['is_broadcast'] ?? false,
                'gift_data' => $giftData,
                'gift_claimed' => $item['gift_claimed'] ?? false,
                'gift_claimed_at' => $item['gift_claimed_at'] ?? null
            ];
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Claim gift from notification
     */
    public function claimGift(string $userId, string $notificationId): array
    {
        try {
            // Get notification with gift data
            $query = $this->supabase
                ->from('user_admin_notifications')
                ->select('*, admin_notifications!inner(gift_data)')
                ->eq('user_id', $userId)
                ->eq('notification_id', $notificationId)
                ->is('deleted_at', null)
                ->single();
            
            $result = $query->execute();
            $item = $result->data;

            if (!$item) {
                return ['success' => false, 'error' => 'notification_not_found'];
            }

            // Check if already claimed
            if ($item['gift_claimed'] ?? false) {
                return ['success' => false, 'error' => 'already_claimed'];
            }

            // Get gift data
            $notification = $item['admin_notifications'] ?? [];
            $giftDataRaw = $notification['gift_data'] ?? null;
            
            if (!$giftDataRaw) {
                return ['success' => false, 'error' => 'no_gift'];
            }

            $giftData = is_string($giftDataRaw) ? json_decode($giftDataRaw, true) : $giftDataRaw;
            
            if (!$giftData) {
                return ['success' => false, 'error' => 'invalid_gift_data'];
            }

            // Credit coins
            $coinsAdded = 0;
            $gemsAdded = 0;
            
            if (($giftData['coins'] ?? 0) > 0) {
                $coinsAdded = (int)$giftData['coins'];
                $this->creditCurrency($userId, 'coin', $coinsAdded);
            }

            // Credit gems
            if (($giftData['gems'] ?? 0) > 0) {
                $gemsAdded = (int)$giftData['gems'];
                $this->creditCurrency($userId, 'gem', $gemsAdded);
            }

            // Add items to user_items
            $itemIds = $giftData['item_ids'] ?? [];
            $itemsAdded = [];
            if (!empty($itemIds)) {
                $itemsAdded = $this->grantItemsToUser($userId, $itemIds);
            }

            // Mark gift as claimed
            $this->supabase
                ->from('user_admin_notifications')
                ->update([
                    'gift_claimed' => true,
                    'gift_claimed_at' => date('c')
                ])
                ->eq('user_id', $userId)
                ->eq('notification_id', $notificationId)
                ->execute();

            return [
                'success' => true,
                'claimed' => [
                    'coins' => $coinsAdded,
                    'gems' => $gemsAdded,
                    'items' => $itemsAdded
                ]
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Credit currency to user
     */
    private function creditCurrency(string $userId, string $type, int $amount): void
    {
        if ($this->currencyService) {
            $this->currencyService->addCurrency($userId, $type, $amount, 'gift_notification');
            return;
        }

        // Fallback: direct Supabase update
        $this->creditCurrencyDirect($userId, $type, $amount);
    }

    /**
     * Grant items to user by inserting into user_items table
     * @return array List of item details that were granted
     */
    private function grantItemsToUser(string $userId, array $itemIds): array
    {
        $grantedItems = [];
        
        try {
            // Get item details for response
            $itemsResult = $this->supabase
                ->from('items')
                ->select('id, item_code, name, category, rarity')
                ->in('id', $itemIds)
                ->execute();
            
            $itemsMap = [];
            foreach ($itemsResult->data ?? [] as $item) {
                $itemsMap[$item['id']] = $item;
            }

            // Insert into user_items
            $records = [];
            foreach ($itemIds as $itemId) {
                $records[] = [
                    'user_id' => $userId,
                    'item_id' => $itemId,
                    'is_equipped' => false,
                    'acquired_at' => date('c')
                ];
                
                if (isset($itemsMap[$itemId])) {
                    $grantedItems[] = $itemsMap[$itemId];
                }
            }

            if (!empty($records)) {
                $this->supabase
                    ->from('user_items')
                    ->insert($records)
                    ->execute();
            }
        } catch (\Exception $e) {
            error_log("Failed to grant items: " . $e->getMessage());
        }

        return $grantedItems;
    }

    /**
     * Direct currency credit via Supabase
     */
    private function creditCurrencyDirect(string $userId, string $type, int $amount): void
    {
        try {
            // Get current balance
            $result = $this->supabase
                ->from('profiles')
                ->select('coins, gems')
                ->eq('user_id', $userId)
                ->single()
                ->execute();
            
            $profile = $result->data ?? ['coins' => 0, 'gems' => 0];
            $currentCoins = (int)($profile['coins'] ?? 0);
            $currentGems = (int)($profile['gems'] ?? 0);

            // Update
            $newCoins = $type === 'coin' ? $currentCoins + $amount : $currentCoins;
            $newGems = $type === 'gem' ? $currentGems + $amount : $currentGems;

            $this->supabase
                ->from('profiles')
                ->update(['coins' => $newCoins, 'gems' => $newGems])
                ->eq('user_id', $userId)
                ->execute();
        } catch (\Exception $e) {
            error_log("Failed to credit currency: " . $e->getMessage());
        }
    }

    /**
     * Mark notification as read
     */
    public function markAsRead(string $userId, string $notificationId): bool
    {
        try {
            $this->supabase
                ->from('user_admin_notifications')
                ->update(UserAdminNotification::markReadData())
                ->eq('user_id', $userId)
                ->eq('notification_id', $notificationId)
                ->execute();
            
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Mark all notifications as read for user
     */
    public function markAllAsRead(string $userId): int
    {
        try {
            $result = $this->supabase
                ->from('user_admin_notifications')
                ->update(UserAdminNotification::markReadData())
                ->eq('user_id', $userId)
                ->eq('is_read', false)
                ->is('deleted_at', null)
                ->execute();
            
            return count($result->data ?? []);
        } catch (\Exception $e) {
            return 0;
        }
    }

    /**
     * Delete notification for user (soft delete)
     */
    public function deleteForUser(string $userId, string $notificationId): bool
    {
        try {
            $this->supabase
                ->from('user_admin_notifications')
                ->update(UserAdminNotification::softDeleteData())
                ->eq('user_id', $userId)
                ->eq('notification_id', $notificationId)
                ->execute();
            
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Delete notification by admin (cascade to all users)
     */
    public function deleteByAdmin(string $adminId, string $notificationId): bool
    {
        try {
            // Verify admin owns this notification
            $notification = $this->supabase
                ->from('admin_notifications')
                ->select('id, admin_id')
                ->eq('id', $notificationId)
                ->eq('admin_id', $adminId)
                ->single()
                ->execute();
            
            if (!$notification->data) {
                return false;
            }

            // Soft delete the notification
            $this->supabase
                ->from('admin_notifications')
                ->update(['deleted_at' => date('c')])
                ->eq('id', $notificationId)
                ->execute();

            // Also soft delete all user_admin_notifications
            $this->supabase
                ->from('user_admin_notifications')
                ->update(UserAdminNotification::softDeleteData())
                ->eq('notification_id', $notificationId)
                ->execute();
            
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Get unread notification count for user
     */
    public function getUnreadCount(string $userId): int
    {
        try {
            $result = $this->supabase
                ->from('user_admin_notifications')
                ->select('id', ['count' => 'exact'])
                ->eq('user_id', $userId)
                ->eq('is_read', false)
                ->is('deleted_at', null)
                ->execute();
            
            return $result->count ?? 0;
        } catch (\Exception $e) {
            return 0;
        }
    }

    /**
     * Get sent notifications by admin
     */
    public function getSentNotifications(string $adminId, int $page = 1, int $limit = 20): array
    {
        $offset = ($page - 1) * $limit;
        
        try {
            $query = $this->supabase
                ->from('admin_notifications')
                ->select('*')
                ->eq('admin_id', $adminId)
                ->is('deleted_at', null)
                ->order('created_at', ['ascending' => false])
                ->range($offset, $offset + $limit - 1);
            
            $result = $query->execute();
            $items = $result->data ?? [];

            // Get stats for each notification
            $notifications = [];
            foreach ($items as $item) {
                $stats = $this->getReadStats($item['id']);
                $giftStats = $this->getGiftClaimStats($item['id']);
                
                // Parse gift data
                $giftData = null;
                if (!empty($item['gift_data'])) {
                    $giftData = is_string($item['gift_data']) 
                        ? json_decode($item['gift_data'], true) 
                        : $item['gift_data'];
                }
                
                $notifications[] = array_merge($item, [
                    'content_preview' => AdminNotification::getPreview($item['content'] ?? ''),
                    'stats' => $stats,
                    'gift_data' => $giftData,
                    'gift_stats' => $giftStats
                ]);
            }

            // Get total count
            $countQuery = $this->supabase
                ->from('admin_notifications')
                ->select('id', ['count' => 'exact'])
                ->eq('admin_id', $adminId)
                ->is('deleted_at', null);
            
            $countResult = $countQuery->execute();
            $total = $countResult->count ?? count($items);

            return [
                'success' => true,
                'data' => $notifications,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'total_pages' => ceil($total / $limit)
                ]
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'data' => []
            ];
        }
    }

    /**
     * Get gift claim statistics for a notification
     */
    public function getGiftClaimStats(string $notificationId): array
    {
        try {
            // Get total recipients
            $totalResult = $this->supabase
                ->from('user_admin_notifications')
                ->select('id', ['count' => 'exact'])
                ->eq('notification_id', $notificationId)
                ->is('deleted_at', null)
                ->execute();
            
            $total = $totalResult->count ?? 0;

            // Get claimed count
            $claimedResult = $this->supabase
                ->from('user_admin_notifications')
                ->select('id', ['count' => 'exact'])
                ->eq('notification_id', $notificationId)
                ->eq('gift_claimed', true)
                ->is('deleted_at', null)
                ->execute();
            
            $claimed = $claimedResult->count ?? 0;

            return [
                'total_recipients' => $total,
                'claimed_count' => $claimed,
                'unclaimed_count' => $total - $claimed
            ];
        } catch (\Exception $e) {
            return [
                'total_recipients' => 0,
                'claimed_count' => 0,
                'unclaimed_count' => 0
            ];
        }
    }

    /**
     * Get read statistics for a notification
     */
    public function getReadStats(string $notificationId): array
    {
        try {
            // Get total recipients
            $totalResult = $this->supabase
                ->from('user_admin_notifications')
                ->select('id', ['count' => 'exact'])
                ->eq('notification_id', $notificationId)
                ->is('deleted_at', null)
                ->execute();
            
            $total = $totalResult->count ?? 0;

            // Get read count
            $readResult = $this->supabase
                ->from('user_admin_notifications')
                ->select('id', ['count' => 'exact'])
                ->eq('notification_id', $notificationId)
                ->eq('is_read', true)
                ->is('deleted_at', null)
                ->execute();
            
            $readCount = $readResult->count ?? 0;

            return [
                'total_recipients' => $total,
                'read_count' => $readCount,
                'unread_count' => $total - $readCount
            ];
        } catch (\Exception $e) {
            return [
                'total_recipients' => 0,
                'read_count' => 0,
                'unread_count' => 0
            ];
        }
    }

    /**
     * Get all user IDs for broadcast
     */
    private function getAllUserIds(): array
    {
        try {
            $result = $this->supabase
                ->from('profiles')
                ->select('user_id')
                ->execute();
            
            return array_column($result->data ?? [], 'user_id');
        } catch (\Exception $e) {
            return [];
        }
    }

    /**
     * Insert notification record
     */
    private function insertNotification(array $data): ?string
    {
        try {
            $result = $this->supabase
                ->from('admin_notifications')
                ->insert($data)
                ->execute();
            
            return $result->data[0]['id'] ?? null;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Create user_admin_notification records
     */
    private function createUserNotifications(string $notificationId, array $userIds): int
    {
        $records = array_map(function ($userId) use ($notificationId) {
            return UserAdminNotification::create($notificationId, $userId);
        }, $userIds);

        try {
            $result = $this->supabase
                ->from('user_admin_notifications')
                ->insert($records)
                ->execute();
            
            return count($result->data ?? []);
        } catch (\Exception $e) {
            return 0;
        }
    }

    /**
     * Get admin email from admin table
     */
    private function getAdminEmail(string $adminId): string
    {
        try {
            $result = $this->supabase
                ->from('admin')
                ->select('email')
                ->eq('user_id', $adminId)
                ->single()
                ->execute();
            
            return $result->data['email'] ?? 'Admin';
        } catch (\Exception $e) {
            return 'Admin';
        }
    }

    /**
     * Emit realtime notification via socket server
     */
    private function emitRealtimeNotification(array $userIds, array $notification, bool $isBroadcast): void
    {
        $socketServerUrl = getenv('SOCKET_SERVER_URL') ?: 'http://localhost:8000';
        
        try {
            $endpoint = $isBroadcast 
                ? $socketServerUrl . '/api/internal/notify-all'
                : $socketServerUrl . '/api/internal/notify';
            
            $payload = $isBroadcast 
                ? ['notification' => $notification]
                : ['user_ids' => $userIds, 'notification' => $notification];

            $ch = curl_init($endpoint);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode($payload),
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 5,
                CURLOPT_CONNECTTIMEOUT => 2
            ]);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode !== 200) {
                error_log("Failed to emit realtime notification: HTTP $httpCode - $response");
            }
        } catch (\Exception $e) {
            error_log("Realtime notification error: " . $e->getMessage());
        }
    }

    /**
     * Debug: Get notifications with gift_data for debugging
     * Remove in production
     */
    public function debugGetNotificationsWithGift(): array
    {
        try {
            $result = $this->supabase
                ->from('admin_notifications')
                ->select('id, title, gift_data, created_at')
                ->order('created_at', ['ascending' => false])
                ->limit(10)
                ->execute();
            
            $notifications = $result->data ?? [];
            
            // Check if gift_data column exists
            $hasGiftColumn = true;
            if (!empty($notifications) && !array_key_exists('gift_data', $notifications[0])) {
                $hasGiftColumn = false;
            }
            
            return [
                'notifications' => $notifications,
                'has_gift_column' => $hasGiftColumn,
                'message' => $hasGiftColumn 
                    ? 'gift_data column exists. Check if any notification has gift_data != null'
                    : 'gift_data column NOT FOUND! Run migration: 20251209_000050_add_gift_to_admin_notifications.sql'
            ];
        } catch (\Exception $e) {
            return [
                'error' => $e->getMessage(),
                'message' => 'Failed to query notifications. Check if migration was run.'
            ];
        }
    }
}
