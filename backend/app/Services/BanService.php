<?php

namespace App\Services;

use App\Models\UserBan;
use InvalidArgumentException;
use RuntimeException;

/**
 * BanService
 * 
 * Implements ban management including application, lifting, and status checking.
 * 
 * **Property 14: Ban Application**
 * For any auto_flagged report, a corresponding ban record SHALL be created 
 * with the configured penalty type.
 * 
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 7.5**
 */
class BanService implements BanServiceInterface
{
    /**
     * Default ban duration in days for temporary bans
     */
    private int $defaultBanDuration;

    /**
     * Whether auto-ban is enabled
     */
    private bool $autoBanEnabled;

    /**
     * Default ban type for auto-flagged reports
     */
    private string $defaultBanType;

    /**
     * In-memory storage for bans (for testing without database)
     * @var array<string, UserBan>
     */
    private array $bans = [];

    /**
     * In-memory storage for notifications (for testing)
     * @var array
     */
    private array $notifications = [];

    /**
     * PDO database connection (optional, for direct DB operations)
     * @var \PDO|null
     */
    private ?\PDO $db = null;

    public function __construct(
        int $defaultBanDuration = 7,
        bool $autoBanEnabled = true,
        string $defaultBanType = UserBan::TYPE_TEMPORARY
    ) {
        $this->defaultBanDuration = $defaultBanDuration;
        $this->autoBanEnabled = $autoBanEnabled;
        $this->defaultBanType = $defaultBanType;
    }

    /**
     * Set the database connection for direct DB operations.
     * 
     * @param \PDO $db PDO database connection
     * @return self
     */
    public function setDatabase(\PDO $db): self
    {
        $this->db = $db;
        return $this;
    }


    /**
     * {@inheritdoc}
     * 
     * **Property 14: Ban Application**
     * For any auto_flagged report, a corresponding ban record SHALL be created 
     * with the configured penalty type.
     * 
     * **Validates: Requirements 6.1, 6.2**
     */
    public function applyBan(
        string $userId,
        ?string $reportId,
        string $banType,
        string $reason,
        ?int $durationDays = null
    ): UserBan {
        // Validate ban type
        if (!in_array($banType, UserBan::VALID_TYPES)) {
            throw new InvalidArgumentException(
                'Invalid ban type. Must be one of: ' . implode(', ', UserBan::VALID_TYPES)
            );
        }

        // Validate reason
        if (empty(trim($reason))) {
            throw new InvalidArgumentException('Ban reason is required and cannot be empty');
        }

        if (strlen($reason) > UserBan::MAX_REASON_LENGTH) {
            throw new InvalidArgumentException(
                'Reason must not exceed ' . UserBan::MAX_REASON_LENGTH . ' characters'
            );
        }

        // Calculate expiration for temporary bans
        $expiresAt = null;
        if ($banType === UserBan::TYPE_TEMPORARY) {
            $days = $durationDays ?? $this->defaultBanDuration;
            if ($days <= 0) {
                throw new InvalidArgumentException('Duration days must be positive for temporary bans');
            }
            $expiresAt = UserBan::calculateExpiration($days);
        }

        // Validate that permanent bans don't have duration
        if ($banType === UserBan::TYPE_PERMANENT && $durationDays !== null) {
            throw new InvalidArgumentException('Permanent bans should not have a duration');
        }

        // Build ban data
        $banData = [
            'user_id' => $userId,
            'report_id' => $reportId,
            'ban_type' => $banType,
            'reason' => $reason,
            'expires_at' => $expiresAt,
            'is_active' => true,
        ];

        // Validate using model validation
        $validation = UserBan::validate($banData);
        if (!$validation['valid']) {
            throw new InvalidArgumentException(
                'Invalid ban data: ' . implode(', ', $validation['errors'])
            );
        }

        // Create the ban
        $ban = UserBan::createBan($banData);

        // Generate ID
        $banId = $this->generateUuid();
        $ban->fill([
            'id' => $banId,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        // Save to database if connection available
        if ($this->db !== null) {
            $this->saveBanToDb($ban);
        }

        // Also store in memory for quick access
        $this->bans[$banId] = $ban;

        return $ban;
    }

    /**
     * {@inheritdoc}
     * 
     * **Validates: Requirements 7.5**
     */
    public function liftBan(string $banId, string $adminId, string $reason): UserBan
    {
        // Find the ban (try memory first, then database)
        $ban = $this->bans[$banId] ?? $this->findBanFromDb($banId);
        
        if ($ban === null) {
            throw new RuntimeException('Ban not found: ' . $banId);
        }

        // Validate lift reason
        if (empty(trim($reason))) {
            throw new InvalidArgumentException('Lift reason is required');
        }

        if (strlen($reason) > UserBan::MAX_LIFT_REASON_LENGTH) {
            throw new InvalidArgumentException(
                'Lift reason must not exceed ' . UserBan::MAX_LIFT_REASON_LENGTH . ' characters'
            );
        }

        // Check if ban is already lifted
        if ($ban->isLifted()) {
            throw new InvalidArgumentException('Ban has already been lifted');
        }

        // Update ban record
        $ban->fill([
            'is_active' => false,
            'lifted_at' => date('Y-m-d H:i:s'),
            'lifted_by' => $adminId,
            'lift_reason' => $reason,
        ]);

        // Update in database
        $this->updateBanInDb($ban);

        // Update in memory storage
        $this->bans[$banId] = $ban;

        return $ban;
    }

    /**
     * {@inheritdoc}
     * 
     * **Validates: Requirements 6.3**
     */
    public function checkUserBanStatus(string $userId): UserBanStatus
    {
        // Find active bans for this user (try database first, then memory)
        $activeBan = null;
        
        // Check database first
        $dbBans = $this->findActiveBansFromDb($userId);
        if (!empty($dbBans)) {
            $activeBan = $dbBans[0];
        } else {
            // Fallback to in-memory storage
            foreach ($this->bans as $ban) {
                if ($ban->getAttribute('user_id') === $userId && $ban->isActive()) {
                    $activeBan = $ban;
                    break;
                }
            }
        }

        if ($activeBan === null) {
            return UserBanStatus::notBanned();
        }

        // Check if user can appeal (has a report_id to appeal against)
        $canAppeal = !empty($activeBan->getAttribute('report_id'));

        return UserBanStatus::banned($activeBan, $canAppeal);
    }

    /**
     * {@inheritdoc}
     * 
     * **Validates: Requirements 6.3, 6.4**
     */
    public function sendBanNotification(string $userId, UserBan $ban, string $summaryForPlayer): bool
    {
        // In a real implementation, this would send an in-app notification
        // For now, we store it in memory for testing
        $notification = [
            'user_id' => $userId,
            'type' => 'ban_notification',
            'ban_id' => $ban->getAttribute('id'),
            'ban_type' => $ban->getAttribute('ban_type'),
            'reason' => $ban->getAttribute('reason'),
            'summary' => $summaryForPlayer,
            'expires_at' => $ban->getAttribute('expires_at'),
            'created_at' => date('Y-m-d H:i:s'),
        ];

        $this->notifications[] = $notification;

        return true;
    }

    /**
     * {@inheritdoc}
     */
    public function getActiveBans(string $userId): array
    {
        // Try database first
        $dbBans = $this->findActiveBansFromDb($userId);
        if (!empty($dbBans)) {
            return $dbBans;
        }

        // Fallback to in-memory storage
        $activeBans = [];
        foreach ($this->bans as $ban) {
            if ($ban->getAttribute('user_id') === $userId && $ban->isActive()) {
                $activeBans[] = $ban;
            }
        }

        return $activeBans;
    }

    /**
     * {@inheritdoc}
     */
    public function getBanHistory(string $userId): array
    {
        // Try database first
        if ($this->db !== null) {
            try {
                $stmt = $this->db->prepare('SELECT * FROM user_bans WHERE user_id = ? ORDER BY created_at DESC');
                $stmt->execute([$userId]);
                $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);
                
                $bans = [];
                foreach ($rows as $row) {
                    $ban = new UserBan();
                    $ban->fill($row);
                    $bans[] = $ban;
                }
                return $bans;
            } catch (\Exception $e) {
                error_log("Failed to get ban history for user {$userId}: " . $e->getMessage());
            }
        }

        // Fallback to in-memory storage
        $history = [];
        foreach ($this->bans as $ban) {
            if ($ban->getAttribute('user_id') === $userId) {
                $history[] = $ban;
            }
        }

        return $history;
    }

    /**
     * Apply ban for an auto-flagged report.
     * Uses configured default ban type and duration.
     * 
     * **Property 14: Ban Application**
     * 
     * @param string $userId User to ban
     * @param string $reportId Related report ID
     * @param string $reasonResult Rule-based findings
     * @param string $aiDetails AI analysis details
     * @return UserBan|null The created ban, or null if auto-ban is disabled
     */
    public function applyBanForAutoFlagged(
        string $userId,
        string $reportId,
        string $reasonResult,
        string $aiDetails
    ): ?UserBan {
        if (!$this->autoBanEnabled) {
            return null;
        }

        // Combine reason from rule engine and AI
        $reason = "Tự động phát hiện gian lận.\n\n";
        $reason .= "Phân tích quy tắc:\n{$reasonResult}\n\n";
        $reason .= "Phân tích AI:\n{$aiDetails}";

        // Truncate if too long
        if (strlen($reason) > UserBan::MAX_REASON_LENGTH) {
            $reason = substr($reason, 0, UserBan::MAX_REASON_LENGTH - 3) . '...';
        }

        return $this->applyBan(
            $userId,
            $reportId,
            $this->defaultBanType,
            $reason,
            $this->defaultBanType === UserBan::TYPE_TEMPORARY ? $this->defaultBanDuration : null
        );
    }

    /**
     * Get notifications (for testing purposes).
     * 
     * @return array
     */
    public function getNotifications(): array
    {
        return $this->notifications;
    }

    /**
     * Clear all bans (for testing purposes).
     */
    public function clearBans(): void
    {
        $this->bans = [];
        $this->notifications = [];
    }

    /**
     * Add a ban directly (for testing purposes).
     * 
     * @param UserBan $ban
     * @param string|null $id Optional ID to use
     */
    public function addBan(UserBan $ban, ?string $id = null): void
    {
        $banId = $id ?? $this->generateUuid();
        $ban->fill(['id' => $banId]);
        $this->bans[$banId] = $ban;
    }

    /**
     * Get a ban by ID (for testing purposes).
     * 
     * @param string $banId
     * @return UserBan|null
     */
    public function getBan(string $banId): ?UserBan
    {
        return $this->bans[$banId] ?? null;
    }

    /**
     * Generate a UUID.
     * 
     * @return string
     */
    private function generateUuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }

    /**
     * Save a ban to the database.
     * 
     * @param UserBan $ban The ban to save
     * @return void
     */
    private function saveBanToDb(UserBan $ban): void
    {
        if ($this->db === null) {
            return;
        }

        try {
            $data = $ban->toArray();
            $columns = array_keys($data);
            $placeholders = array_fill(0, count($columns), '?');
            
            $sql = 'INSERT INTO user_bans (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')';
            $stmt = $this->db->prepare($sql);
            $stmt->execute(array_values($data));
        } catch (\Exception $e) {
            error_log("Failed to save ban to database: " . $e->getMessage());
            throw new RuntimeException("Failed to save ban: " . $e->getMessage());
        }
    }

    /**
     * Find a ban by ID from database.
     * 
     * @param string $banId UUID of the ban
     * @return UserBan|null
     */
    private function findBanFromDb(string $banId): ?UserBan
    {
        if ($this->db === null) {
            return null;
        }

        try {
            $stmt = $this->db->prepare('SELECT * FROM user_bans WHERE id = ?');
            $stmt->execute([$banId]);
            $row = $stmt->fetch(\PDO::FETCH_ASSOC);
            
            if ($row) {
                $ban = new UserBan();
                $ban->fill($row);
                return $ban;
            }
        } catch (\Exception $e) {
            error_log("Failed to find ban {$banId}: " . $e->getMessage());
        }
        
        return null;
    }

    /**
     * Update a ban in the database.
     * 
     * @param UserBan $ban The ban to update
     * @return void
     */
    private function updateBanInDb(UserBan $ban): void
    {
        if ($this->db === null) {
            return;
        }

        try {
            $data = $ban->toArray();
            $id = $data['id'];
            unset($data['id'], $data['created_at']);
            $data['updated_at'] = date('Y-m-d H:i:s');
            
            $setClauses = [];
            $values = [];
            foreach ($data as $key => $value) {
                $setClauses[] = "{$key} = ?";
                $values[] = $value;
            }
            $values[] = $id;
            
            $sql = 'UPDATE user_bans SET ' . implode(', ', $setClauses) . ' WHERE id = ?';
            $stmt = $this->db->prepare($sql);
            $stmt->execute($values);
        } catch (\Exception $e) {
            error_log("Failed to update ban: " . $e->getMessage());
            throw new RuntimeException("Failed to update ban: " . $e->getMessage());
        }
    }

    /**
     * Find active bans for a user from database.
     * 
     * @param string $userId User ID
     * @return array<UserBan>
     */
    private function findActiveBansFromDb(string $userId): array
    {
        if ($this->db === null) {
            return [];
        }

        try {
            $stmt = $this->db->prepare(
                'SELECT * FROM user_bans WHERE user_id = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())'
            );
            $stmt->execute([$userId]);
            $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);
            
            $bans = [];
            foreach ($rows as $row) {
                $ban = new UserBan();
                $ban->fill($row);
                $bans[] = $ban;
            }
            return $bans;
        } catch (\Exception $e) {
            error_log("Failed to find active bans for user {$userId}: " . $e->getMessage());
            return [];
        }
    }
}
