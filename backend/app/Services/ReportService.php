<?php

namespace App\Services;

use App\Models\Report;
use App\Models\ReportAction;
use InvalidArgumentException;
use RuntimeException;

/**
 * ReportService
 * 
 * Implements report management including creation, processing, and status updates.
 * Integrates with RuleEngineService and AIAnalysisService for cheat detection.
 * 
 * **Validates: Requirements 1.2, 1.3, 1.4, 2.1, 2.2, 3.1, 4.1, 5.1, 5.2, 5.3**
 */
class ReportService implements ReportServiceInterface
{
    private RuleEngineServiceInterface $ruleEngine;
    private AIAnalysisServiceInterface $aiService;
    private ?BanServiceInterface $banService;

    /**
     * Callback for finding reports (for testing/dependency injection)
     * @var callable|null
     */
    private $reportFinder = null;

    /**
     * Callback for fetching match data (for testing/dependency injection)
     * @var callable|null
     */
    private $matchDataFetcher = null;

    /**
     * Callback for saving reports (for testing/dependency injection)
     * @var callable|null
     */
    private $reportSaver = null;

    /**
     * PDO database connection (optional, for direct DB operations)
     * @var \PDO|null
     */
    private ?\PDO $db = null;

    /**
     * Supabase client for REST API operations
     * @var SupabaseClient|null
     */
    private ?SupabaseClient $supabase = null;

    /**
     * Toggle auto-processing cheat reports on create (enabled by default).
     * Useful to disable in tests to keep initial status = pending.
     */
    private bool $autoProcessEnabled = true;

    public function __construct(
        RuleEngineServiceInterface $ruleEngine,
        AIAnalysisServiceInterface $aiService,
        ?BanServiceInterface $banService = null
    ) {
        $this->ruleEngine = $ruleEngine;
        $this->aiService = $aiService;
        $this->banService = $banService;
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
     * Set the Supabase client for REST API operations.
     * 
     * @param SupabaseClient $supabase Supabase client
     * @return self
     */
    public function setSupabase(SupabaseClient $supabase): self
    {
        $this->supabase = $supabase;
        return $this;
    }

    /**
     * Set the ban service for auto-ban functionality.
     * 
     * @param BanServiceInterface $banService
     * @return self
     */
    public function setBanService(BanServiceInterface $banService): self
    {
        $this->banService = $banService;
        return $this;
    }

    /**
     * Enable/disable auto-processing of cheat reports after creation.
     */
    public function setAutoProcessEnabled(bool $enabled): self
    {
        $this->autoProcessEnabled = $enabled;
        return $this;
    }

    /**
     * Set the report finder callback for testing/dependency injection.
     * 
     * @param callable $finder Function that takes reportId and returns Report|null
     * @return self
     */
    public function setReportFinder(callable $finder): self
    {
        $this->reportFinder = $finder;
        return $this;
    }

    /**
     * Set the match data fetcher callback for testing/dependency injection.
     * 
     * @param callable $fetcher Function that takes matchId and returns array|null
     * @return self
     */
    public function setMatchDataFetcher(callable $fetcher): self
    {
        $this->matchDataFetcher = $fetcher;
        return $this;
    }

    /**
     * Set the report saver callback for testing/dependency injection.
     * 
     * @param callable $saver Function that takes Report and saves it
     * @return self
     */
    public function setReportSaver(callable $saver): self
    {
        $this->reportSaver = $saver;
        return $this;
    }

    /**
     * {@inheritdoc}
     * 
     * **Property 2: Match ID Auto-attachment**
     * For any report submitted from a match context, the match_id SHALL be 
     * automatically attached to the report record.
     * 
     * **Property 3: Description Length Validation**
     * For any report with description, the description length SHALL NOT exceed 1000 characters.
     * 
     * **Validates: Requirements 1.2, 1.3, 1.4, 2.1, 2.2**
     */
    public function createReport(array $data, string $reporterId): Report
    {
        // Set reporter_id
        $data['reporter_id'] = $reporterId;

        // Validate description length (Property 3)
        if (isset($data['description']) && strlen($data['description']) > Report::MAX_DESCRIPTION_LENGTH) {
            throw new InvalidArgumentException(
                'Description must not exceed ' . Report::MAX_DESCRIPTION_LENGTH . ' characters'
            );
        }

        // Validate report data
        $validation = Report::validate($data);
        if (!$validation['valid']) {
            throw new InvalidArgumentException(
                'Invalid report data: ' . implode(', ', $validation['errors'])
            );
        }

        // Create report with pending status (enforced by createReport)
        $report = Report::createReport($data);

        // Generate UUID for the report
        $reportId = $this->generateUuid();
        $report->fill([
            'id' => $reportId,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        // Save to database
        $this->saveReport($report);

        // AUTO-PROCESSING: If this is a cheating report, process it immediately
        if ($report->isCheatingReport() && $this->autoProcessEnabled) {
            $this->processCheatReportAsync($reportId);
        }

        return $report;
    }

    /**
     * Process a cheat report asynchronously (or synchronously for now).
     * In production, this could be queued for background processing.
     * 
     * @param string $reportId UUID of the report
     * @return void
     */
    protected function processCheatReportAsync(string $reportId): void
    {
        try {
            $this->processCheatReport($reportId);
        } catch (\Exception $e) {
            // Log error but don't fail the report creation
            error_log("Failed to auto-process cheat report {$reportId}: " . $e->getMessage());
        }
    }

    /**
     * Generate a UUID v4.
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
     * {@inheritdoc}
     * 
     * Process flow:
     * 1. Fetch report and validate it's a cheating report
     * 2. Run rule engine analysis on match data
     * 3. Call AI analysis with match data and rule findings
     * 4. Determine final status based on decision logic
     * 5. Update report with analysis results and status
     * 
     * **Validates: Requirements 3.1, 4.1, 5.1, 5.2, 5.3**
     */
    public function processCheatReport(string $reportId): void
    {
        // Fetch report from repository
        $report = $this->findReport($reportId);
        
        if ($report === null) {
            throw new RuntimeException('Report not found: ' . $reportId);
        }

        // Only process cheating reports
        if (!$report->isCheatingReport()) {
            return;
        }

        // Fetch match data if match_id exists
        $matchId = $report->getAttribute('match_id');
        if (empty($matchId)) {
            // No match data to analyze, escalate for manual review
            $report->fill([
                'status' => Report::STATUS_ESCALATED,
                'reason_result' => 'Không có dữ liệu trận đấu để phân tích.',
                'processed_at' => date('Y-m-d H:i:s'),
            ]);
            $this->saveReport($report);
            return;
        }

        // Fetch match data
        $matchData = $this->fetchMatchData($matchId);
        
        if ($matchData === null) {
            // Match not found, escalate for manual review
            $report->fill([
                'status' => Report::STATUS_ESCALATED,
                'reason_result' => 'Không tìm thấy dữ liệu trận đấu.',
                'processed_at' => date('Y-m-d H:i:s'),
            ]);
            $this->saveReport($report);
            return;
        }

        // Process the report with match data
        $processedReport = $this->processCheatReportWithData($report, $matchData);
        
        // Save the processed report
        $this->saveReport($processedReport);
    }

    /**
     * Find a report by ID.
     * 
     * Uses injected finder callback if available, otherwise queries Supabase or database.
     * 
     * @param string $reportId UUID of the report
     * @return Report|null The report or null if not found
     */
    protected function findReport(string $reportId): ?Report
    {
        if ($this->reportFinder !== null) {
            return ($this->reportFinder)($reportId);
        }
        
        // Try Supabase REST API first
        if ($this->supabase !== null && $this->supabase->isConfigured()) {
            try {
                $row = $this->supabase->getById('reports', $reportId);
                if ($row) {
                    return $this->rowToReport($row);
                }
            } catch (\Exception $e) {
                error_log("Supabase find report {$reportId} failed: " . $e->getMessage());
            }
        }
        
        // Fallback to PDO database if connection available
        if ($this->db !== null) {
            try {
                $stmt = $this->db->prepare('SELECT * FROM reports WHERE id = ?');
                $stmt->execute([$reportId]);
                $row = $stmt->fetch(\PDO::FETCH_ASSOC);
                
                if ($row) {
                    return $this->rowToReport($row);
                }
            } catch (\Exception $e) {
                error_log("PDO find report {$reportId} failed: " . $e->getMessage());
            }
        }
        
        return null;
    }

    /**
     * Convert database row to Report model.
     * 
     * @param array $row Database row
     * @return Report
     */
    private function rowToReport(array $row): Report
    {
        $report = new Report();
        // Decode JSON fields if they are strings
        if (isset($row['rule_analysis']) && is_string($row['rule_analysis'])) {
            $row['rule_analysis'] = json_decode($row['rule_analysis'], true);
        }
        if (isset($row['ai_analysis']) && is_string($row['ai_analysis'])) {
            $row['ai_analysis'] = json_decode($row['ai_analysis'], true);
        }
        $report->fill($row);
        return $report;
    }

    /**
     * Fetch match data from database.
     * 
     * Uses injected fetcher callback if available, otherwise queries Supabase or database.
     * 
     * @param string $matchId UUID of the match
     * @return array|null Match data or null if not found
     */
    protected function fetchMatchData(string $matchId): ?array
    {
        if ($this->matchDataFetcher !== null) {
            return ($this->matchDataFetcher)($matchId);
        }
        
        // Try Supabase REST API first
        if ($this->supabase !== null && $this->supabase->isConfigured()) {
            try {
                $row = $this->supabase->getById('matches', $matchId);
                if ($row) {
                    return $this->normalizeMatchData($row);
                }
            } catch (\Exception $e) {
                error_log("Supabase fetch match {$matchId} failed: " . $e->getMessage());
            }
        }
        
        // Fallback to PDO database if connection available
        if ($this->db !== null) {
            try {
                $stmt = $this->db->prepare('SELECT * FROM matches WHERE id = ?');
                $stmt->execute([$matchId]);
                $row = $stmt->fetch(\PDO::FETCH_ASSOC);
                
                if ($row) {
                    return $this->normalizeMatchData($row);
                }
            } catch (\Exception $e) {
                error_log("PDO fetch match {$matchId} failed: " . $e->getMessage());
            }
        }
        
        return null;
    }

    /**
     * Normalize match data from database row.
     * 
     * @param array $row Raw database row
     * @return array Normalized match data
     */
    private function normalizeMatchData(array $row): array
    {
        // Parse final_board_state from JSON (Supabase uses this column)
        if (isset($row['final_board_state']) && is_string($row['final_board_state'])) {
            $row['board_state'] = json_decode($row['final_board_state'], true) ?? [];
        } elseif (isset($row['final_board_state']) && is_array($row['final_board_state'])) {
            $row['board_state'] = $row['final_board_state'];
        } else {
            $row['board_state'] = [];
        }
        
        // Parse moves from JSON if stored as string
        if (isset($row['moves']) && is_string($row['moves'])) {
            $row['moves'] = json_decode($row['moves'], true) ?? [];
        } elseif (!isset($row['moves'])) {
            // If no moves column, set empty array - rule engine will handle this
            $row['moves'] = [];
        }
        
        // Parse swap2_history if exists
        if (isset($row['swap2_history']) && is_string($row['swap2_history'])) {
            $row['swap2_history'] = json_decode($row['swap2_history'], true) ?? [];
        }
        
        return $row;
    }

    /**
     * Save a report to the database.
     * 
     * Uses injected saver callback if available, otherwise persists via Supabase or database.
     * 
     * @param Report $report The report to save
     * @return void
     */
    protected function saveReport(Report $report): void
    {
        if ($this->reportSaver !== null) {
            ($this->reportSaver)($report);
            return;
        }
        
        $data = $report->toArray();
        $id = $data['id'] ?? null;
        
        // Try Supabase REST API first
        if ($this->supabase !== null && $this->supabase->isConfigured()) {
            try {
                // Check if report exists
                $existing = $this->supabase->getById('reports', $id);
                
                if ($existing) {
                    // Update existing report
                    $data['updated_at'] = date('c'); // ISO 8601 format for Supabase
                    unset($data['id'], $data['created_at']);
                    
                    $result = $this->supabase->update('reports', $data, ['id' => "eq.{$id}"]);
                    if ($result !== null) {
                        return;
                    }
                } else {
                    // Insert new report
                    $data['created_at'] = date('c');
                    $data['updated_at'] = date('c');
                    
                    $result = $this->supabase->insert('reports', $data);
                    if ($result !== null) {
                        return;
                    }
                }
            } catch (\Exception $e) {
                error_log("Supabase save report failed: " . $e->getMessage());
                // Fall through to PDO
            }
        }
        
        // Fallback to PDO database if connection available
        if ($this->db !== null) {
            try {
                // Encode JSON fields for PDO
                if (isset($data['rule_analysis']) && is_array($data['rule_analysis'])) {
                    $data['rule_analysis'] = json_encode($data['rule_analysis']);
                }
                if (isset($data['ai_analysis']) && is_array($data['ai_analysis'])) {
                    $data['ai_analysis'] = json_encode($data['ai_analysis']);
                }
                
                // Check if report exists
                $stmt = $this->db->prepare('SELECT id FROM reports WHERE id = ?');
                $stmt->execute([$id]);
                $exists = $stmt->fetch();
                
                if ($exists) {
                    // Update existing report
                    $data['updated_at'] = date('Y-m-d H:i:s');
                    unset($data['id'], $data['created_at']);
                    
                    $setClauses = [];
                    $values = [];
                    foreach ($data as $key => $value) {
                        if ($value !== null) {
                            $setClauses[] = "{$key} = ?";
                            $values[] = $value;
                        }
                    }
                    $values[] = $id;
                    
                    $sql = 'UPDATE reports SET ' . implode(', ', $setClauses) . ' WHERE id = ?';
                    $stmt = $this->db->prepare($sql);
                    $stmt->execute($values);
                } else {
                    // Insert new report
                    $columns = array_keys($data);
                    $placeholders = array_fill(0, count($columns), '?');
                    
                    $sql = 'INSERT INTO reports (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')';
                    $stmt = $this->db->prepare($sql);
                    $stmt->execute(array_values($data));
                }
            } catch (\Exception $e) {
                error_log("PDO save report failed: " . $e->getMessage());
                throw new RuntimeException("Failed to save report: " . $e->getMessage());
            }
        }
    }

    /**
     * Process a cheating report with the report object.
     * 
     * @param Report $report The report to process
     * @param array $matchData Match data for analysis
     * @return Report The processed report with updated status
     */
    public function processCheatReportWithData(Report $report, array $matchData): Report
    {
        // Validate this is a cheating report
        if (!$report->isCheatingReport()) {
            return $report;
        }

        // Step 1: Run rule engine analysis
        $ruleResult = $this->ruleEngine->analyzeMatchData($matchData);

        // Store rule analysis results
        $report->fill([
            'rule_analysis' => $ruleResult->toArray(),
            'reason_result' => $ruleResult->reasonResult,
        ]);

        // Step 2: Call AI analysis
        $aiResult = $this->aiService->analyzeCheatReport(
            $matchData,
            $ruleResult->reasonResult
        );

        // Store AI analysis results if available
        if ($aiResult !== null) {
            $report->fill([
                'ai_analysis' => $aiResult->toArray(),
                'ai_summary_player' => $aiResult->summaryForPlayer,
                'ai_details_admin' => $aiResult->detailsForAdmin,
            ]);
        }

        // Step 3: Determine final status
        $status = $this->determineStatus($ruleResult, $aiResult);
        $report->fill(['status' => $status]);

        // Mark as processed
        $report->fill([
            'processed_at' => date('Y-m-d H:i:s'),
        ]);

        // Step 4: AUTO-BAN if status is auto_flagged
        if ($status === Report::STATUS_AUTO_FLAGGED && $this->banService !== null) {
            $this->applyAutoBan($report, $aiResult);
        }

        return $report;
    }

    /**
     * Apply automatic ban for an auto-flagged report.
     * 
     * **Property 14: Ban Application**
     * For any auto_flagged report, a corresponding ban record SHALL be created.
     * 
     * @param Report $report The auto-flagged report
     * @param AIAnalysisResult|null $aiResult AI analysis result
     * @return void
     */
    protected function applyAutoBan(Report $report, ?AIAnalysisResult $aiResult): void
    {
        $reportedUserId = $report->getAttribute('reported_user_id');
        
        // Can't ban if no reported user
        if (empty($reportedUserId)) {
            return;
        }

        $reportId = $report->getAttribute('id');
        $reasonResult = $report->getAttribute('reason_result') ?? 'Phát hiện gian lận tự động';
        $aiDetails = $aiResult !== null ? $aiResult->detailsForAdmin : 'AI không có chi tiết';
        $aiSummary = $aiResult !== null ? $aiResult->summaryForPlayer : 'Tài khoản bị cấm do gian lận';

        try {
            // Apply the ban
            $ban = $this->banService->applyBanForAutoFlagged(
                $reportedUserId,
                $reportId,
                $reasonResult,
                $aiDetails
            );

            // Send notification to the banned user
            if ($ban !== null) {
                $this->banService->sendBanNotification(
                    $reportedUserId,
                    $ban,
                    $aiSummary
                );
            }
        } catch (\Exception $e) {
            // Log error but don't fail the report processing
            error_log("Failed to apply auto-ban for report {$reportId}: " . $e->getMessage());
        }
    }

    /**
     * {@inheritdoc}
     * 
     * **Property 11: Decision Logic - Auto Flag**
     * For any report where rule-based detects violations AND AI returns "co",
     * the final status SHALL be "auto_flagged".
     * 
     * **Property 12: Decision Logic - Escalate**
     * For any report where rule-based has suspicion BUT AI returns "khong",
     * the final status SHALL be "escalated".
     * 
     * **Property 13: Decision Logic - Dismiss**
     * For any report where rule-based finds nothing AND AI returns "khong",
     * the final status SHALL be "dismissed".
     * 
     * **Validates: Requirements 5.1, 5.2, 5.3**
     */
    public function determineStatus(RuleAnalysisResult $ruleResult, ?AIAnalysisResult $aiResult): string
    {
        // If AI is unavailable, decide based on rule-based only
        if ($aiResult === null) {
            // If rule-based found serious violations, auto-flag
            if ($ruleResult->hasViolations && $ruleResult->confidence === RuleAnalysisResult::CONFIDENCE_HIGH) {
                return Report::STATUS_AUTO_FLAGGED;
            }
            return Report::STATUS_ESCALATED;
        }

        $hasRuleViolations = $ruleResult->hasViolations;
        $aiSaysCheating = $aiResult->isCheating();
        $isHighConfidence = $ruleResult->confidence === RuleAnalysisResult::CONFIDENCE_HIGH;

        // Decision matrix:
        // Rule violations + AI "co" → auto_flagged (Property 11)
        if ($hasRuleViolations && $aiSaysCheating) {
            return Report::STATUS_AUTO_FLAGGED;
        }

        // HIGH CONFIDENCE rule violations → auto_flagged even if AI says "khong"
        // (AI might be inconsistent, but rule-based is deterministic)
        if ($hasRuleViolations && $isHighConfidence) {
            return Report::STATUS_AUTO_FLAGGED;
        }

        // Rule violations + AI "khong" + not high confidence → escalated (Property 12)
        if ($hasRuleViolations && !$aiSaysCheating) {
            return Report::STATUS_ESCALATED;
        }

        // No violations + AI "khong" → dismissed (Property 13)
        if (!$hasRuleViolations && !$aiSaysCheating) {
            return Report::STATUS_DISMISSED;
        }

        // No violations + AI "co" → escalated (unusual, needs review)
        return Report::STATUS_ESCALATED;
    }

    /**
     * {@inheritdoc}
     */
    public function getReports(array $filters = [], int $page = 1, int $perPage = 20): array
    {
        if ($this->db === null) {
            return [
                'data' => [],
                'total' => 0,
                'page' => $page,
                'per_page' => $perPage,
                'total_pages' => 0,
            ];
        }

        try {
            // Build WHERE clause
            $where = [];
            $params = [];
            
            if (!empty($filters['status'])) {
                $where[] = 'status = ?';
                $params[] = $filters['status'];
            }
            if (!empty($filters['type'])) {
                $where[] = 'type = ?';
                $params[] = $filters['type'];
            }
            if (!empty($filters['date_from'])) {
                $where[] = 'created_at >= ?';
                $params[] = $filters['date_from'];
            }
            if (!empty($filters['date_to'])) {
                $where[] = 'created_at <= ?';
                $params[] = $filters['date_to'];
            }

            $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

            // Get total count
            $countSql = "SELECT COUNT(*) FROM reports {$whereClause}";
            $stmt = $this->db->prepare($countSql);
            $stmt->execute($params);
            $total = (int) $stmt->fetchColumn();

            // Get paginated data
            $offset = ($page - 1) * $perPage;
            $sql = "SELECT * FROM reports {$whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?";
            $params[] = $perPage;
            $params[] = $offset;
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            // Convert to Report objects
            $data = [];
            foreach ($rows as $row) {
                $report = new Report();
                if (isset($row['rule_analysis']) && is_string($row['rule_analysis'])) {
                    $row['rule_analysis'] = json_decode($row['rule_analysis'], true);
                }
                if (isset($row['ai_analysis']) && is_string($row['ai_analysis'])) {
                    $row['ai_analysis'] = json_decode($row['ai_analysis'], true);
                }
                $report->fill($row);
                $data[] = $report->toArray();
            }

            return [
                'data' => $data,
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'total_pages' => (int) ceil($total / $perPage),
            ];
        } catch (\Exception $e) {
            error_log("Failed to get reports: " . $e->getMessage());
            return [
                'data' => [],
                'total' => 0,
                'page' => $page,
                'per_page' => $perPage,
                'total_pages' => 0,
            ];
        }
    }

    /**
     * {@inheritdoc}
     */
    public function getReportDetail(string $reportId): ?Report
    {
        return $this->findReport($reportId);
    }

    /**
     * {@inheritdoc}
     */
    public function updateReport(string $reportId, array $data, string $adminId): Report
    {
        $report = $this->findReport($reportId);
        
        if ($report === null) {
            throw new RuntimeException('Report not found: ' . $reportId);
        }

        // Update allowed fields
        $allowedFields = ['status', 'admin_notes', 'processed_by'];
        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $report->fill([$field => $data[$field]]);
            }
        }

        // Set processed_by and processed_at if status changed
        if (isset($data['status'])) {
            $report->fill([
                'processed_by' => $adminId,
                'processed_at' => date('Y-m-d H:i:s'),
            ]);
        }

        $report->fill(['updated_at' => date('Y-m-d H:i:s')]);

        // Save to database
        $this->saveReport($report);

        // Log the action
        $this->logReportAction($reportId, $adminId, 'update', $data);

        return $report;
    }

    /**
     * Log a report action for audit trail.
     * 
     * @param string $reportId Report ID
     * @param string $adminId Admin who performed the action
     * @param string $action Action type
     * @param array $details Action details
     * @return void
     */
    protected function logReportAction(string $reportId, string $adminId, string $action, array $details): void
    {
        if ($this->db === null) {
            return;
        }

        try {
            $sql = 'INSERT INTO report_actions (id, report_id, admin_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?)';
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                $this->generateUuid(),
                $reportId,
                $adminId,
                $action,
                json_encode($details),
                date('Y-m-d H:i:s'),
            ]);
        } catch (\Exception $e) {
            error_log("Failed to log report action: " . $e->getMessage());
        }
    }
}
