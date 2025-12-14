<?php

namespace App\Services;

use App\Models\Report;

/**
 * ReportServiceInterface
 * 
 * Interface for managing violation/cheating reports.
 * Handles report creation, processing, and status management.
 * 
 * **Validates: Requirements 2.1**
 */
interface ReportServiceInterface
{
    /**
     * Create a new report.
     * 
     * @param array $data Report data including type, description, match_id, reported_user_id
     * @param string $reporterId UUID of the user submitting the report
     * @return Report The created report
     * @throws \InvalidArgumentException If validation fails
     */
    public function createReport(array $data, string $reporterId): Report;

    /**
     * Process a cheating report through rule engine and AI analysis.
     * 
     * @param string $reportId UUID of the report to process
     * @return void
     * @throws \RuntimeException If report not found or processing fails
     */
    public function processCheatReport(string $reportId): void;

    /**
     * Get paginated list of reports with filters.
     * 
     * @param array $filters Filter options: status, type, date_from, date_to
     * @param int $page Page number
     * @param int $perPage Items per page
     * @return array Paginated results with reports and metadata
     */
    public function getReports(array $filters = [], int $page = 1, int $perPage = 20): array;

    /**
     * Get detailed report information.
     * 
     * @param string $reportId UUID of the report
     * @return Report|null The report or null if not found
     */
    public function getReportDetail(string $reportId): ?Report;

    /**
     * Update a report (admin action).
     * 
     * @param string $reportId UUID of the report
     * @param array $data Update data: status, admin_notes
     * @param string $adminId UUID of the admin making the update
     * @return Report The updated report
     * @throws \RuntimeException If report not found
     */
    public function updateReport(string $reportId, array $data, string $adminId): Report;

    /**
     * Determine the final status based on rule analysis and AI result.
     * 
     * Decision logic:
     * - Rule violations + AI "co" → auto_flagged
     * - Rule violations + AI "khong" → escalated
     * - No violations + AI "khong" → dismissed
     * - No violations + AI "co" → escalated (unusual case)
     * - AI unavailable → escalated
     * 
     * @param RuleAnalysisResult $ruleResult Rule engine analysis result
     * @param AIAnalysisResult|null $aiResult AI analysis result (null if AI failed)
     * @return string The determined status
     */
    public function determineStatus(RuleAnalysisResult $ruleResult, ?AIAnalysisResult $aiResult): string;
}
