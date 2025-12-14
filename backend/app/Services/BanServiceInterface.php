<?php

namespace App\Services;

use App\Models\UserBan;

/**
 * BanServiceInterface
 * 
 * Interface for managing user bans and penalties.
 * Handles ban application, lifting, and status checking.
 * 
 * **Validates: Requirements 6.1, 6.2, 6.3, 7.5**
 */
interface BanServiceInterface
{
    /**
     * Apply a ban to a user.
     * 
     * @param string $userId UUID of the user to ban
     * @param string|null $reportId UUID of the related report (optional)
     * @param string $banType Ban type: 'temporary', 'permanent', 'warning'
     * @param string $reason Ban reason text
     * @param int|null $durationDays Duration in days for temporary bans (null for permanent)
     * @return UserBan The created ban record
     * @throws \InvalidArgumentException If validation fails
     */
    public function applyBan(
        string $userId,
        ?string $reportId,
        string $banType,
        string $reason,
        ?int $durationDays = null
    ): UserBan;

    /**
     * Lift an existing ban.
     * 
     * @param string $banId UUID of the ban to lift
     * @param string $adminId UUID of the admin lifting the ban
     * @param string $reason Reason for lifting the ban
     * @return UserBan The updated ban record
     * @throws \RuntimeException If ban not found
     * @throws \InvalidArgumentException If validation fails
     */
    public function liftBan(string $banId, string $adminId, string $reason): UserBan;

    /**
     * Check if a user is currently banned.
     * 
     * @param string $userId UUID of the user to check
     * @return UserBanStatus Ban status information
     */
    public function checkUserBanStatus(string $userId): UserBanStatus;

    /**
     * Send ban notification to a user.
     * 
     * @param string $userId UUID of the user to notify
     * @param UserBan $ban The ban record
     * @param string $summaryForPlayer Summary message for the player
     * @return bool True if notification was sent successfully
     */
    public function sendBanNotification(string $userId, UserBan $ban, string $summaryForPlayer): bool;

    /**
     * Get all active bans for a user.
     * 
     * @param string $userId UUID of the user
     * @return array List of active UserBan records
     */
    public function getActiveBans(string $userId): array;

    /**
     * Get ban history for a user.
     * 
     * @param string $userId UUID of the user
     * @return array List of all UserBan records (active and lifted)
     */
    public function getBanHistory(string $userId): array;
}
