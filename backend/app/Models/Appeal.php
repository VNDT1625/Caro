<?php

namespace App\Models;

/**
 * Appeal Model
 * 
 * Represents an appeal submitted by a banned player against their ban.
 * 
 * @property string $id UUID primary key
 * @property string $report_id UUID of the related report
 * @property string $user_id UUID of the user who submitted the appeal
 * @property string $reason Appeal reason text
 * @property string $status Status: 'pending', 'approved', 'rejected'
 * @property string|null $admin_response Admin's response to the appeal
 * @property string|null $processed_by UUID of admin who processed
 * @property string|null $processed_at Timestamp when processed
 * @property string $created_at Creation timestamp
 * @property string $updated_at Last update timestamp
 */
class Appeal extends BaseModel
{
    /**
     * The table associated with the model.
     */
    protected string $table = 'appeals';

    /**
     * Valid appeal statuses
     */
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    public const VALID_STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_APPROVED,
        self::STATUS_REJECTED,
    ];

    /**
     * Maximum reason length
     */
    public const MAX_REASON_LENGTH = 2000;

    /**
     * Maximum admin response length
     */
    public const MAX_ADMIN_RESPONSE_LENGTH = 2000;

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'report_id',
        'user_id',
        'reason',
        'status',
        'admin_response',
        'processed_by',
        'processed_at',
    ];

    /**
     * The attributes that should be cast.
     */
    protected array $casts = [
        'processed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Default attribute values
     */
    protected array $defaults = [
        'status' => self::STATUS_PENDING,
    ];

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
     * Get the user who submitted the appeal.
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
     * Get the admin who processed the appeal.
     * 
     * @return array|null Profile data of the admin
     */
    public function processedBy(): ?array
    {
        if (empty($this->attributes['processed_by'])) {
            return null;
        }
        return $this->belongsTo('profiles', 'processed_by', 'user_id');
    }

    /**
     * Validate appeal data before creation.
     * 
     * @param array $data Appeal data to validate
     * @return array Validation result ['valid' => bool, 'errors' => array]
     */
    public static function validate(array $data): array
    {
        $errors = [];

        // Required fields
        if (empty($data['report_id'])) {
            $errors['report_id'] = 'Report ID is required';
        }

        if (empty($data['user_id'])) {
            $errors['user_id'] = 'User ID is required';
        }

        if (empty($data['reason']) || strlen(trim($data['reason'])) === 0) {
            $errors['reason'] = 'Appeal reason is required and cannot be empty';
        } elseif (strlen($data['reason']) > self::MAX_REASON_LENGTH) {
            $errors['reason'] = 'Reason must not exceed ' . self::MAX_REASON_LENGTH . ' characters';
        }

        // Optional field validation
        if (!empty($data['status']) && !in_array($data['status'], self::VALID_STATUSES)) {
            $errors['status'] = 'Invalid status. Must be one of: ' . implode(', ', self::VALID_STATUSES);
        }

        if (!empty($data['admin_response']) && strlen($data['admin_response']) > self::MAX_ADMIN_RESPONSE_LENGTH) {
            $errors['admin_response'] = 'Admin response must not exceed ' . self::MAX_ADMIN_RESPONSE_LENGTH . ' characters';
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Check if appeal is pending.
     * 
     * @return bool
     */
    public function isPending(): bool
    {
        return $this->getAttribute('status') === self::STATUS_PENDING;
    }

    /**
     * Check if appeal was approved.
     * 
     * @return bool
     */
    public function isApproved(): bool
    {
        return $this->getAttribute('status') === self::STATUS_APPROVED;
    }

    /**
     * Check if appeal was rejected.
     * 
     * @return bool
     */
    public function isRejected(): bool
    {
        return $this->getAttribute('status') === self::STATUS_REJECTED;
    }

    /**
     * Check if appeal has been processed.
     * 
     * @return bool
     */
    public function isProcessed(): bool
    {
        return !$this->isPending();
    }

    /**
     * Create a new appeal with default status.
     * Note: Appeals should NOT trigger AI processing per Requirements 7.2
     * 
     * @param array $data Appeal data
     * @return self
     */
    public static function createAppeal(array $data): self
    {
        // Ensure status is set to pending for new appeals
        $data['status'] = self::STATUS_PENDING;
        
        $appeal = new self();
        $appeal->fill($data);
        
        return $appeal;
    }
}
