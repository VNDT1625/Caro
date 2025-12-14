<?php

namespace App\Services;

use App\Models\Appeal;

/**
 * AppealServiceInterface
 * 
 * Interface for managing ban appeals.
 * Handles appeal creation and processing by admins.
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
interface AppealServiceInterface
{
    /**
     * Create a new appeal for a report.
     * 
     * Note: Appeals SHALL NOT trigger AI processing per Requirements 7.2
     * 
     * @param string $reportId UUID of the report to appeal
     * @param string $userId UUID of the user submitting the appeal
     * @param string $reason Appeal reason text
     * @return Appeal The created appeal
     * @throws \InvalidArgumentException If validation fails
     * @throws \RuntimeException If report not found or appeal already exists
     */
    public function createAppeal(string $reportId, string $userId, string $reason): Appeal;

    /**
     * Process an appeal (admin action).
     * 
     * @param string $appealId UUID of the appeal to process
     * @param string $status New status: 'approved' or 'rejected'
     * @param string $adminResponse Admin's response text
     * @param string $adminId UUID of the admin processing the appeal
     * @param bool $liftBan Whether to lift the associated ban (only for approved appeals)
     * @return Appeal The updated appeal
     * @throws \RuntimeException If appeal not found
     * @throws \InvalidArgumentException If validation fails
     */
    public function processAppeal(
        string $appealId,
        string $status,
        string $adminResponse,
        string $adminId,
        bool $liftBan = false
    ): Appeal;

    /**
     * Get an appeal by ID.
     * 
     * @param string $appealId UUID of the appeal
     * @return Appeal|null The appeal or null if not found
     */
    public function getAppeal(string $appealId): ?Appeal;

    /**
     * Get all pending appeals for admin review queue.
     * 
     * @return array List of pending Appeal records
     */
    public function getPendingAppeals(): array;

    /**
     * Get appeals for a specific report.
     * 
     * @param string $reportId UUID of the report
     * @return array List of Appeal records
     */
    public function getAppealsForReport(string $reportId): array;

    /**
     * Get appeals submitted by a specific user.
     * 
     * @param string $userId UUID of the user
     * @return array List of Appeal records
     */
    public function getAppealsForUser(string $userId): array;

    /**
     * Check if an appeal already exists for a report by a user.
     * 
     * @param string $reportId UUID of the report
     * @param string $userId UUID of the user
     * @return bool True if appeal exists
     */
    public function appealExists(string $reportId, string $userId): bool;
}
