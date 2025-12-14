<?php

namespace App\Models;

/**
 * Report Model
 * 
 * Represents a violation/cheating report submitted by players.
 * 
 * @property string $id UUID primary key
 * @property string $reporter_id UUID of the user who submitted the report
 * @property string|null $reported_user_id UUID of the reported user
 * @property string|null $match_id UUID of the related match
 * @property string $type Report type: 'gian_lan_trong_tran', 'toxic', 'bug', 'khac'
 * @property string|null $description Optional description (max 1000 chars)
 * @property string $status Status: 'pending', 'auto_flagged', 'resolved', 'dismissed', 'escalated'
 * @property array|null $rule_analysis JSON rule-based analysis results
 * @property string|null $reason_result Text description of rule violations
 * @property array|null $ai_analysis JSON AI analysis results
 * @property string|null $ai_summary_player Summary for the player
 * @property string|null $ai_details_admin Detailed info for admin
 * @property string|null $processed_at Timestamp when processed
 * @property string|null $processed_by UUID of admin who processed
 * @property string|null $admin_notes Admin notes (max 2000 chars)
 * @property string $created_at Creation timestamp
 * @property string $updated_at Last update timestamp
 */
class Report extends BaseModel
{
    /**
     * The table associated with the model.
     */
    protected string $table = 'reports';

    /**
     * Valid report types
     */
    public const TYPE_CHEATING = 'gian_lan_trong_tran';
    public const TYPE_TOXIC = 'toxic';
    public const TYPE_BUG = 'bug';
    public const TYPE_OTHER = 'khac';

    public const VALID_TYPES = [
        self::TYPE_CHEATING,
        self::TYPE_TOXIC,
        self::TYPE_BUG,
        self::TYPE_OTHER,
    ];

    /**
     * Valid report statuses
     */
    public const STATUS_PENDING = 'pending';
    public const STATUS_AUTO_FLAGGED = 'auto_flagged';
    public const STATUS_RESOLVED = 'resolved';
    public const STATUS_DISMISSED = 'dismissed';
    public const STATUS_ESCALATED = 'escalated';

    public const VALID_STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_AUTO_FLAGGED,
        self::STATUS_RESOLVED,
        self::STATUS_DISMISSED,
        self::STATUS_ESCALATED,
    ];

    /**
     * Maximum description length
     */
    public const MAX_DESCRIPTION_LENGTH = 1000;

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'reporter_id',
        'reported_user_id',
        'match_id',
        'type',
        'description',
        'status',
        'rule_analysis',
        'reason_result',
        'ai_analysis',
        'ai_summary_player',
        'ai_details_admin',
        'processed_at',
        'processed_by',
        'admin_notes',
        'created_at',
        'updated_at',
    ];

    /**
     * The attributes that should be cast.
     */
    protected array $casts = [
        'rule_analysis' => 'array',
        'ai_analysis' => 'array',
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
     * Get the reporter (user who submitted the report).
     * 
     * @return array|null Profile data of the reporter
     */
    public function reporter(): ?array
    {
        if (empty($this->attributes['reporter_id'])) {
            return null;
        }
        return $this->belongsTo('profiles', 'reporter_id', 'user_id');
    }

    /**
     * Get the reported user.
     * 
     * @return array|null Profile data of the reported user
     */
    public function reportedUser(): ?array
    {
        if (empty($this->attributes['reported_user_id'])) {
            return null;
        }
        return $this->belongsTo('profiles', 'reported_user_id', 'user_id');
    }

    /**
     * Get the related match.
     * 
     * @return array|null Match data
     */
    public function match(): ?array
    {
        if (empty($this->attributes['match_id'])) {
            return null;
        }
        return $this->belongsTo('matches', 'match_id', 'id');
    }

    /**
     * Get all appeals for this report.
     * 
     * @return array List of Appeal records
     */
    public function appeals(): array
    {
        return $this->hasMany('appeals', 'report_id');
    }

    /**
     * Get all actions (audit log) for this report.
     * 
     * @return array List of ReportAction records
     */
    public function actions(): array
    {
        return $this->hasMany('report_actions', 'report_id');
    }

    /**
     * Validate report data before creation.
     * 
     * @param array $data Report data to validate
     * @return array Validation result ['valid' => bool, 'errors' => array]
     */
    public static function validate(array $data): array
    {
        $errors = [];

        // Required fields
        if (empty($data['reporter_id'])) {
            $errors['reporter_id'] = 'Reporter ID is required';
        }

        if (empty($data['type'])) {
            $errors['type'] = 'Report type is required';
        } elseif (!in_array($data['type'], self::VALID_TYPES)) {
            $errors['type'] = 'Invalid report type. Must be one of: ' . implode(', ', self::VALID_TYPES);
        }

        // Optional field validation
        if (!empty($data['description']) && strlen($data['description']) > self::MAX_DESCRIPTION_LENGTH) {
            $errors['description'] = 'Description must not exceed ' . self::MAX_DESCRIPTION_LENGTH . ' characters';
        }

        if (!empty($data['status']) && !in_array($data['status'], self::VALID_STATUSES)) {
            $errors['status'] = 'Invalid status. Must be one of: ' . implode(', ', self::VALID_STATUSES);
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Check if this is a cheating report.
     * 
     * @return bool
     */
    public function isCheatingReport(): bool
    {
        return $this->getAttribute('type') === self::TYPE_CHEATING;
    }

    /**
     * Check if report is pending.
     * 
     * @return bool
     */
    public function isPending(): bool
    {
        return $this->getAttribute('status') === self::STATUS_PENDING;
    }

    /**
     * Check if report was auto-flagged.
     * 
     * @return bool
     */
    public function isAutoFlagged(): bool
    {
        return $this->getAttribute('status') === self::STATUS_AUTO_FLAGGED;
    }

    /**
     * Check if report needs admin review (escalated).
     * 
     * @return bool
     */
    public function isEscalated(): bool
    {
        return $this->getAttribute('status') === self::STATUS_ESCALATED;
    }

    /**
     * Create a new report with default status.
     * 
     * @param array $data Report data
     * @return self
     */
    public static function createReport(array $data): self
    {
        // Ensure status is set to pending for new reports
        $data['status'] = self::STATUS_PENDING;
        
        $report = new self();
        $report->fill($data);
        
        return $report;
    }
}
