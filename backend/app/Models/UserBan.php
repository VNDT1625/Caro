<?php

namespace App\Models;

/**
 * UserBan Model
 * 
 * Represents a ban/penalty applied to a user account.
 * 
 * @property string $id UUID primary key
 * @property string $user_id UUID of the banned user
 * @property string|null $report_id UUID of the related report
 * @property string $ban_type Ban type: 'temporary', 'permanent', 'warning'
 * @property string $reason Ban reason text
 * @property string|null $expires_at Expiration timestamp (for temporary bans)
 * @property bool $is_active Whether the ban is currently active
 * @property string|null $lifted_at Timestamp when ban was lifted
 * @property string|null $lifted_by UUID of admin who lifted the ban
 * @property string|null $lift_reason Reason for lifting the ban
 * @property string $created_at Creation timestamp
 * @property string $updated_at Last update timestamp
 */
class UserBan extends BaseModel
{
    /**
     * The table associated with the model.
     */
    protected string $table = 'user_bans';

    /**
     * Valid ban types
     */
    public const TYPE_TEMPORARY = 'temporary';
    public const TYPE_PERMANENT = 'permanent';
    public const TYPE_WARNING = 'warning';

    public const VALID_TYPES = [
        self::TYPE_TEMPORARY,
        self::TYPE_PERMANENT,
        self::TYPE_WARNING,
    ];

    /**
     * Default ban durations in days
     */
    public const DEFAULT_TEMPORARY_DAYS = 7;
    public const SHORT_BAN_DAYS = 3;
    public const LONG_BAN_DAYS = 30;

    /**
     * Maximum reason length
     */
    public const MAX_REASON_LENGTH = 2000;

    /**
     * Maximum lift reason length
     */
    public const MAX_LIFT_REASON_LENGTH = 2000;

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'user_id',
        'report_id',
        'ban_type',
        'reason',
        'expires_at',
        'is_active',
        'lifted_at',
        'lifted_by',
        'lift_reason',
    ];

    /**
     * The attributes that should be cast.
     */
    protected array $casts = [
        'is_active' => 'boolean',
        'expires_at' => 'datetime',
        'lifted_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Default attribute values
     */
    protected array $defaults = [
        'is_active' => true,
    ];

    /**
     * Get the banned user.
     * 
     * @return array|null Profile data
     */
    public function user(): ?array
    {
        if (empty($this->attributes['user_id'])) {
            return null;
        }
        return $this->belongsTo('profiles', 'user_id', 'user_id');
    }

    /**
     * Get the related report.
     * 
     * @return array|null Report data
     */
    public function report(): ?array
    {
        if (empty($this->attributes['report_id'])) {
            return null;
        }
        return $this->belongsTo('reports', 'report_id', 'id');
    }

    /**
     * Get the admin who lifted the ban.
     * 
     * @return array|null Profile data of the admin
     */
    public function liftedBy(): ?array
    {
        if (empty($this->attributes['lifted_by'])) {
            return null;
        }
        return $this->belongsTo('profiles', 'lifted_by', 'user_id');
    }

    /**
     * Scope: Get only active bans.
     * Returns filter criteria for active bans.
     * 
     * @return array Filter criteria
     */
    public static function scopeActive(): array
    {
        return [
            'is_active' => true,
            '_or' => [
                ['expires_at' => null],
                ['expires_at' => ['>' => date('Y-m-d H:i:s')]],
            ],
        ];
    }

    /**
     * Scope: Get only expired bans.
     * Returns filter criteria for expired bans.
     * 
     * @return array Filter criteria
     */
    public static function scopeExpired(): array
    {
        return [
            '_or' => [
                ['is_active' => false],
                [
                    'expires_at' => ['<=' => date('Y-m-d H:i:s')],
                    'ban_type' => self::TYPE_TEMPORARY,
                ],
            ],
        ];
    }

    /**
     * Check if this ban is currently active.
     * 
     * @return bool
     */
    public function isActive(): bool
    {
        if (!$this->getAttribute('is_active')) {
            return false;
        }

        // Permanent bans are always active if is_active is true
        if ($this->getAttribute('ban_type') === self::TYPE_PERMANENT) {
            return true;
        }

        // Warnings are not blocking bans
        if ($this->getAttribute('ban_type') === self::TYPE_WARNING) {
            return false;
        }

        // Check expiration for temporary bans
        $expiresAt = $this->getAttribute('expires_at');
        if ($expiresAt === null) {
            return true;
        }

        if ($expiresAt instanceof \DateTimeInterface) {
            return $expiresAt > new \DateTimeImmutable();
        }

        return strtotime($expiresAt) > time();
    }

    /**
     * Check if this ban has expired.
     * 
     * @return bool
     */
    public function isExpired(): bool
    {
        if (!$this->getAttribute('is_active')) {
            return true;
        }

        if ($this->getAttribute('ban_type') !== self::TYPE_TEMPORARY) {
            return false;
        }

        $expiresAt = $this->getAttribute('expires_at');
        if ($expiresAt === null) {
            return false;
        }

        if ($expiresAt instanceof \DateTimeInterface) {
            return $expiresAt <= new \DateTimeImmutable();
        }

        return strtotime($expiresAt) <= time();
    }

    /**
     * Check if this is a permanent ban.
     * 
     * @return bool
     */
    public function isPermanent(): bool
    {
        return $this->getAttribute('ban_type') === self::TYPE_PERMANENT;
    }

    /**
     * Check if this is a temporary ban.
     * 
     * @return bool
     */
    public function isTemporary(): bool
    {
        return $this->getAttribute('ban_type') === self::TYPE_TEMPORARY;
    }

    /**
     * Check if this is a warning (not a blocking ban).
     * 
     * @return bool
     */
    public function isWarning(): bool
    {
        return $this->getAttribute('ban_type') === self::TYPE_WARNING;
    }

    /**
     * Check if this ban has been lifted.
     * 
     * @return bool
     */
    public function isLifted(): bool
    {
        return $this->getAttribute('lifted_at') !== null;
    }

    /**
     * Validate ban data before creation.
     * 
     * @param array $data Ban data to validate
     * @return array Validation result ['valid' => bool, 'errors' => array]
     */
    public static function validate(array $data): array
    {
        $errors = [];

        // Required fields
        if (empty($data['user_id'])) {
            $errors['user_id'] = 'User ID is required';
        }

        if (empty($data['ban_type'])) {
            $errors['ban_type'] = 'Ban type is required';
        } elseif (!in_array($data['ban_type'], self::VALID_TYPES)) {
            $errors['ban_type'] = 'Invalid ban type. Must be one of: ' . implode(', ', self::VALID_TYPES);
        }

        if (empty($data['reason']) || strlen(trim($data['reason'])) === 0) {
            $errors['reason'] = 'Ban reason is required and cannot be empty';
        } elseif (strlen($data['reason']) > self::MAX_REASON_LENGTH) {
            $errors['reason'] = 'Reason must not exceed ' . self::MAX_REASON_LENGTH . ' characters';
        }

        // Temporary bans must have expiration
        if (isset($data['ban_type']) && $data['ban_type'] === self::TYPE_TEMPORARY) {
            if (empty($data['expires_at'])) {
                $errors['expires_at'] = 'Temporary bans must have an expiration date';
            }
        }

        // Permanent bans should not have expiration
        if (isset($data['ban_type']) && $data['ban_type'] === self::TYPE_PERMANENT) {
            if (!empty($data['expires_at'])) {
                $errors['expires_at'] = 'Permanent bans should not have an expiration date';
            }
        }

        // Lift reason validation
        if (!empty($data['lift_reason']) && strlen($data['lift_reason']) > self::MAX_LIFT_REASON_LENGTH) {
            $errors['lift_reason'] = 'Lift reason must not exceed ' . self::MAX_LIFT_REASON_LENGTH . ' characters';
        }

        // If lifted_at is set, lift_reason must be provided
        if (!empty($data['lifted_at']) && empty($data['lift_reason'])) {
            $errors['lift_reason'] = 'Lift reason is required when lifting a ban';
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Create a new ban.
     * 
     * @param array $data Ban data
     * @return self
     */
    public static function createBan(array $data): self
    {
        // Ensure is_active is set to true for new bans
        $data['is_active'] = true;
        
        $ban = new self();
        $ban->fill($data);
        
        return $ban;
    }

    /**
     * Calculate expiration date for a temporary ban.
     * 
     * @param int $days Number of days
     * @return string ISO 8601 datetime string
     */
    public static function calculateExpiration(int $days): string
    {
        $expiration = new \DateTimeImmutable("+{$days} days");
        return $expiration->format('Y-m-d H:i:s');
    }
}
