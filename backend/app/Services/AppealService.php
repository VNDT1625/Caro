<?php

namespace App\Services;

use App\Models\Appeal;
use App\Models\Report;
use InvalidArgumentException;
use RuntimeException;

/**
 * AppealService
 * 
 * Implements appeal management including creation and admin processing.
 * 
 * **Property 15: Appeal Creation**
 * For any appeal submission, the appeal SHALL be linked to the original report_id 
 * and SHALL NOT trigger AI processing.
 * 
 * **Property 16: Appeal Queue**
 * For any created appeal, the associated report status SHALL be updated to include 
 * appeal in admin review queue.
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
 */
class AppealService implements AppealServiceInterface
{
    /**
     * In-memory storage for appeals (for testing without database)
     * @var array<string, Appeal>
     */
    private array $appeals = [];

    /**
     * In-memory storage for reports (for testing without database)
     * @var array<string, Report>
     */
    private array $reports = [];

    /**
     * Ban service for lifting bans
     */
    private ?BanServiceInterface $banService;

    public function __construct(?BanServiceInterface $banService = null)
    {
        $this->banService = $banService;
    }

    /**
     * {@inheritdoc}
     * 
     * **Property 15: Appeal Creation**
     * For any appeal submission, the appeal SHALL be linked to the original report_id 
     * and SHALL NOT trigger AI processing.
     * 
     * **Property 16: Appeal Queue**
     * For any created appeal, the associated report status SHALL be updated to include 
     * appeal in admin review queue.
     * 
     * **Validates: Requirements 7.1, 7.2, 7.3**
     */
    public function createAppeal(string $reportId, string $userId, string $reason): Appeal
    {
        // Validate report exists
        $report = $this->getReport($reportId);
        if ($report === null) {
            throw new RuntimeException('Report not found: ' . $reportId);
        }

        // Check if appeal already exists for this report by this user
        if ($this->appealExists($reportId, $userId)) {
            throw new RuntimeException('Appeal already exists for this report');
        }

        // Validate reason
        if (empty(trim($reason))) {
            throw new InvalidArgumentException('Appeal reason is required and cannot be empty');
        }

        if (strlen($reason) > Appeal::MAX_REASON_LENGTH) {
            throw new InvalidArgumentException(
                'Reason must not exceed ' . Appeal::MAX_REASON_LENGTH . ' characters'
            );
        }

        // Build appeal data
        $appealData = [
            'report_id' => $reportId,
            'user_id' => $userId,
            'reason' => $reason,
            'status' => Appeal::STATUS_PENDING,
        ];

        // Validate using model validation
        $validation = Appeal::validate($appealData);
        if (!$validation['valid']) {
            throw new InvalidArgumentException(
                'Invalid appeal data: ' . implode(', ', $validation['errors'])
            );
        }

        // Create the appeal - NOTE: NO AI processing per Requirements 7.2
        $appeal = Appeal::createAppeal($appealData);

        // Generate ID for in-memory storage
        $appealId = $this->generateUuid();
        $appeal->fill(['id' => $appealId]);

        // Store in memory
        $this->appeals[$appealId] = $appeal;

        // Update report status to indicate pending appeal (Property 16)
        $this->updateReportForAppeal($reportId);

        return $appeal;
    }


    /**
     * {@inheritdoc}
     * 
     * **Validates: Requirements 7.5**
     */
    public function processAppeal(
        string $appealId,
        string $status,
        string $adminResponse,
        string $adminId,
        bool $liftBan = false
    ): Appeal {
        // Find the appeal
        if (!isset($this->appeals[$appealId])) {
            throw new RuntimeException('Appeal not found: ' . $appealId);
        }

        $appeal = $this->appeals[$appealId];

        // Validate status
        if (!in_array($status, [Appeal::STATUS_APPROVED, Appeal::STATUS_REJECTED])) {
            throw new InvalidArgumentException(
                'Invalid status. Must be one of: ' . Appeal::STATUS_APPROVED . ', ' . Appeal::STATUS_REJECTED
            );
        }

        // Validate admin response
        if (empty(trim($adminResponse))) {
            throw new InvalidArgumentException('Admin response is required');
        }

        if (strlen($adminResponse) > Appeal::MAX_ADMIN_RESPONSE_LENGTH) {
            throw new InvalidArgumentException(
                'Admin response must not exceed ' . Appeal::MAX_ADMIN_RESPONSE_LENGTH . ' characters'
            );
        }

        // Check if appeal is already processed
        if ($appeal->isProcessed()) {
            throw new InvalidArgumentException('Appeal has already been processed');
        }

        // Update appeal record
        $appeal->fill([
            'status' => $status,
            'admin_response' => $adminResponse,
            'processed_by' => $adminId,
            'processed_at' => date('Y-m-d H:i:s'),
        ]);

        // Update in storage
        $this->appeals[$appealId] = $appeal;

        // If approved and liftBan is true, lift the associated ban
        if ($status === Appeal::STATUS_APPROVED && $liftBan && $this->banService !== null) {
            $this->liftAssociatedBan($appeal, $adminId, $adminResponse);
        }

        // Update report status based on appeal outcome
        $this->updateReportAfterAppealProcessed($appeal);

        return $appeal;
    }

    /**
     * {@inheritdoc}
     */
    public function getAppeal(string $appealId): ?Appeal
    {
        return $this->appeals[$appealId] ?? null;
    }

    /**
     * {@inheritdoc}
     */
    public function getPendingAppeals(): array
    {
        $pending = [];
        
        foreach ($this->appeals as $appeal) {
            if ($appeal->isPending()) {
                $pending[] = $appeal;
            }
        }

        return $pending;
    }

    /**
     * {@inheritdoc}
     */
    public function getAppealsForReport(string $reportId): array
    {
        $appeals = [];
        
        foreach ($this->appeals as $appeal) {
            if ($appeal->getAttribute('report_id') === $reportId) {
                $appeals[] = $appeal;
            }
        }

        return $appeals;
    }

    /**
     * {@inheritdoc}
     */
    public function getAppealsForUser(string $userId): array
    {
        $appeals = [];
        
        foreach ($this->appeals as $appeal) {
            if ($appeal->getAttribute('user_id') === $userId) {
                $appeals[] = $appeal;
            }
        }

        return $appeals;
    }

    /**
     * {@inheritdoc}
     */
    public function appealExists(string $reportId, string $userId): bool
    {
        foreach ($this->appeals as $appeal) {
            if ($appeal->getAttribute('report_id') === $reportId &&
                $appeal->getAttribute('user_id') === $userId) {
                return true;
            }
        }

        return false;
    }

    /**
     * Update report status to indicate pending appeal.
     * 
     * **Property 16: Appeal Queue**
     * 
     * @param string $reportId
     */
    private function updateReportForAppeal(string $reportId): void
    {
        $report = $this->getReport($reportId);
        if ($report !== null) {
            // Mark report as having a pending appeal
            // The report should be added to admin review queue
            $report->fill([
                'status' => Report::STATUS_ESCALATED,
                'admin_notes' => ($report->getAttribute('admin_notes') ?? '') . 
                    "\n[" . date('Y-m-d H:i:s') . "] Appeal submitted - pending review",
            ]);
            $this->reports[$reportId] = $report;
        }
    }

    /**
     * Update report status after appeal is processed.
     * 
     * @param Appeal $appeal
     */
    private function updateReportAfterAppealProcessed(Appeal $appeal): void
    {
        $reportId = $appeal->getAttribute('report_id');
        $report = $this->getReport($reportId);
        
        if ($report !== null) {
            $status = $appeal->getAttribute('status');
            $note = $status === Appeal::STATUS_APPROVED 
                ? 'Appeal approved - ban lifted' 
                : 'Appeal rejected - ban maintained';
            
            $report->fill([
                'status' => Report::STATUS_RESOLVED,
                'admin_notes' => ($report->getAttribute('admin_notes') ?? '') . 
                    "\n[" . date('Y-m-d H:i:s') . "] {$note}",
            ]);
            $this->reports[$reportId] = $report;
        }
    }

    /**
     * Lift the ban associated with an approved appeal.
     * 
     * @param Appeal $appeal
     * @param string $adminId
     * @param string $reason
     */
    private function liftAssociatedBan(Appeal $appeal, string $adminId, string $reason): void
    {
        $reportId = $appeal->getAttribute('report_id');
        $userId = $appeal->getAttribute('user_id');
        
        // Find active bans for this user related to this report
        $activeBans = $this->banService->getActiveBans($userId);
        
        foreach ($activeBans as $ban) {
            if ($ban->getAttribute('report_id') === $reportId) {
                $banId = $ban->getAttribute('id');
                $this->banService->liftBan($banId, $adminId, 'Appeal approved: ' . $reason);
            }
        }
    }

    /**
     * Get a report by ID.
     * 
     * @param string $reportId
     * @return Report|null
     */
    private function getReport(string $reportId): ?Report
    {
        return $this->reports[$reportId] ?? null;
    }

    /**
     * Add a report directly (for testing purposes).
     * 
     * @param Report $report
     * @param string|null $id Optional ID to use
     */
    public function addReport(Report $report, ?string $id = null): void
    {
        $reportId = $id ?? $this->generateUuid();
        $report->fill(['id' => $reportId]);
        $this->reports[$reportId] = $report;
    }

    /**
     * Get a report by ID (for testing purposes).
     * 
     * @param string $reportId
     * @return Report|null
     */
    public function getReportById(string $reportId): ?Report
    {
        return $this->reports[$reportId] ?? null;
    }

    /**
     * Clear all appeals and reports (for testing purposes).
     */
    public function clearAll(): void
    {
        $this->appeals = [];
        $this->reports = [];
    }

    /**
     * Add an appeal directly (for testing purposes).
     * 
     * @param Appeal $appeal
     * @param string|null $id Optional ID to use
     */
    public function addAppeal(Appeal $appeal, ?string $id = null): void
    {
        $appealId = $id ?? $this->generateUuid();
        $appeal->fill(['id' => $appealId]);
        $this->appeals[$appealId] = $appeal;
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
}
