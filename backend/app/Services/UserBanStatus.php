<?php

namespace App\Services;

use App\Models\UserBan;

/**
 * UserBanStatus DTO
 * 
 * Data Transfer Object representing a user's current ban status.
 * Used to communicate ban information to the frontend.
 * 
 * **Validates: Requirements 6.3**
 */
class UserBanStatus
{
    /**
     * Whether the user is currently banned
     */
    public bool $isBanned;

    /**
     * The active ban record (if banned)
     */
    public ?UserBan $activeBan;

    /**
     * Ban type (if banned): 'temporary', 'permanent', 'warning'
     */
    public ?string $banType;

    /**
     * Ban reason (if banned)
     */
    public ?string $reason;

    /**
     * Expiration timestamp (for temporary bans)
     */
    public ?string $expiresAt;

    /**
     * Whether the user can appeal this ban
     */
    public bool $canAppeal;

    /**
     * Related report ID (if any)
     */
    public ?string $reportId;

    /**
     * Create a new UserBanStatus instance.
     * 
     * @param bool $isBanned Whether the user is banned
     * @param UserBan|null $activeBan The active ban record
     * @param bool $canAppeal Whether the user can appeal
     */
    public function __construct(
        bool $isBanned = false,
        ?UserBan $activeBan = null,
        bool $canAppeal = true
    ) {
        $this->isBanned = $isBanned;
        $this->activeBan = $activeBan;
        $this->canAppeal = $canAppeal;

        if ($activeBan !== null) {
            $this->banType = $activeBan->getAttribute('ban_type');
            $this->reason = $activeBan->getAttribute('reason');
            
            // Handle expires_at which may be DateTimeImmutable or string
            $expiresAt = $activeBan->getAttribute('expires_at');
            if ($expiresAt instanceof \DateTimeInterface) {
                $this->expiresAt = $expiresAt->format('Y-m-d H:i:s');
            } else {
                $this->expiresAt = $expiresAt;
            }
            
            $this->reportId = $activeBan->getAttribute('report_id');
        } else {
            $this->banType = null;
            $this->reason = null;
            $this->expiresAt = null;
            $this->reportId = null;
        }
    }

    /**
     * Create a status for a non-banned user.
     * 
     * @return self
     */
    public static function notBanned(): self
    {
        return new self(false, null, false);
    }

    /**
     * Create a status for a banned user.
     * 
     * @param UserBan $ban The active ban
     * @param bool $canAppeal Whether the user can appeal
     * @return self
     */
    public static function banned(UserBan $ban, bool $canAppeal = true): self
    {
        return new self(true, $ban, $canAppeal);
    }

    /**
     * Check if this is a permanent ban.
     * 
     * @return bool
     */
    public function isPermanent(): bool
    {
        return $this->banType === UserBan::TYPE_PERMANENT;
    }

    /**
     * Check if this is a temporary ban.
     * 
     * @return bool
     */
    public function isTemporary(): bool
    {
        return $this->banType === UserBan::TYPE_TEMPORARY;
    }

    /**
     * Check if this is a warning (not a blocking ban).
     * 
     * @return bool
     */
    public function isWarning(): bool
    {
        return $this->banType === UserBan::TYPE_WARNING;
    }

    /**
     * Convert to array for API response.
     * 
     * @return array
     */
    public function toArray(): array
    {
        return [
            'is_banned' => $this->isBanned,
            'ban_type' => $this->banType,
            'reason' => $this->reason,
            'expires_at' => $this->expiresAt,
            'can_appeal' => $this->canAppeal,
            'report_id' => $this->reportId,
        ];
    }
}
