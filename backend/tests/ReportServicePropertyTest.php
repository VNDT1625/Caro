<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Models\Report;
use App\Services\ReportService;
use App\Services\RuleEngineService;
use App\Services\AIAnalysisService;
use App\Services\RuleAnalysisResult;
use App\Services\AIAnalysisResult;

/**
 * Property-Based Tests for ReportService
 * 
 * Tests the report creation, processing, and decision logic.
 */
class ReportServicePropertyTest extends TestCase
{
    use TestTrait;

    private ReportService $reportService;

    protected function setUp(): void
    {
        parent::setUp();
        if (method_exists($this, 'erisSetupBeforeClass')) {
            static::erisSetupBeforeClass();
        }
        $this->erisSetup();

        // Create service with real dependencies
        $ruleEngine = new RuleEngineService();
        $aiService = new AIAnalysisService();
        $this->reportService = new ReportService($ruleEngine, $aiService);
    }

    /**
     * Compatibility method for Eris TestTrait with PHPUnit 9.x
     */
    public function name(): string
    {
        return $this->getName();
    }

    /**
     * Generate a valid UUID string
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
     * **Feature: report-violation-system, Property 2: Match ID Auto-attachment**
     * 
     * *For any* report submitted from a match context (with match_id in data),
     * the match_id SHALL be automatically attached to the report record.
     * 
     * **Validates: Requirements 1.2**
     * 
     * @test
     */
    public function matchIdIsAutoAttachedToReport(): void
    {
        $this
            ->forAll(
                Generators::elements(Report::VALID_TYPES)
            )
            ->withMaxSize(100)
            ->then(function (string $type) {
                $reporterId = $this->generateUuid();
                $matchId = $this->generateUuid();

                $data = [
                    'type' => $type,
                    'match_id' => $matchId,
                ];

                $report = $this->reportService->createReport($data, $reporterId);

                // Property: match_id must be attached to the report
                $this->assertEquals(
                    $matchId,
                    $report->getAttribute('match_id'),
                    'match_id must be auto-attached to the report'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 2: Match ID Auto-attachment**
     * 
     * *For any* report submitted without match context (no match_id),
     * the report SHALL still be created successfully with null match_id.
     * 
     * **Validates: Requirements 1.2**
     * 
     * @test
     */
    public function reportCanBeCreatedWithoutMatchId(): void
    {
        $this
            ->forAll(
                Generators::elements(Report::VALID_TYPES)
            )
            ->withMaxSize(100)
            ->then(function (string $type) {
                $reporterId = $this->generateUuid();

                $data = [
                    'type' => $type,
                    // No match_id provided
                ];

                $report = $this->reportService->createReport($data, $reporterId);

                // Report should be created successfully
                $this->assertNotNull($report);
                $this->assertEquals($type, $report->getAttribute('type'));
                
                // match_id should be null when not provided
                $this->assertNull($report->getAttribute('match_id'));
            });
    }


    /**
     * **Feature: report-violation-system, Property 3: Description Length Validation**
     * 
     * *For any* report with description, the description length SHALL NOT exceed 1000 characters.
     * Valid descriptions (≤1000 chars) should be accepted.
     * 
     * **Validates: Requirements 1.3**
     * 
     * @test
     */
    public function validDescriptionLengthIsAccepted(): void
    {
        $this
            ->forAll(
                Generators::elements(Report::VALID_TYPES),
                Generators::choose(0, Report::MAX_DESCRIPTION_LENGTH)
            )
            ->withMaxSize(100)
            ->then(function (string $type, int $descLength) {
                $reporterId = $this->generateUuid();
                $description = str_repeat('a', $descLength);

                $data = [
                    'type' => $type,
                    'description' => $description,
                ];

                $report = $this->reportService->createReport($data, $reporterId);

                // Property: description should be stored as-is when valid
                $this->assertEquals(
                    $description,
                    $report->getAttribute('description'),
                    "Description of length $descLength should be accepted"
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 3: Description Length Validation**
     * 
     * *For any* report with description exceeding 1000 characters,
     * the system SHALL reject the report with an error.
     * 
     * **Validates: Requirements 1.3**
     * 
     * @test
     */
    public function descriptionExceedingMaxLengthIsRejected(): void
    {
        $this
            ->forAll(
                Generators::elements(Report::VALID_TYPES),
                Generators::choose(Report::MAX_DESCRIPTION_LENGTH + 1, Report::MAX_DESCRIPTION_LENGTH + 500)
            )
            ->withMaxSize(100)
            ->then(function (string $type, int $descLength) {
                $reporterId = $this->generateUuid();
                $description = str_repeat('a', $descLength);

                $data = [
                    'type' => $type,
                    'description' => $description,
                ];

                $this->expectException(\InvalidArgumentException::class);
                $this->reportService->createReport($data, $reporterId);
            });
    }


    /**
     * **Feature: report-violation-system, Property 11: Decision Logic - Auto Flag**
     * 
     * *For any* report where rule-based detects violations AND AI returns "co",
     * the final status SHALL be "auto_flagged".
     * 
     * **Validates: Requirements 5.1**
     * 
     * @test
     */
    public function ruleViolationsAndAiCoResultsInAutoFlagged(): void
    {
        $this
            ->forAll(
                Generators::choose(1, 5),  // Number of violations
                Generators::elements(RuleAnalysisResult::VALID_CONFIDENCE_LEVELS)
            )
            ->withMaxSize(100)
            ->then(function (int $violationCount, string $confidence) {
                // Create rule result with violations
                $violations = [];
                for ($i = 0; $i < $violationCount; $i++) {
                    $violations[] = [
                        'type' => RuleAnalysisResult::VIOLATION_MULTIPLE_MOVES,
                        'description' => "Test violation $i",
                        'details' => [],
                    ];
                }

                $ruleResult = new RuleAnalysisResult(
                    hasViolations: true,
                    violations: $violations,
                    confidence: $confidence,
                    reasonResult: 'Test violations detected',
                    metadata: []
                );

                // Create AI result saying "co" (cheating)
                $aiResult = new AIAnalysisResult(
                    reportResult: AIAnalysisResult::RESULT_CHEATING,
                    summaryForPlayer: 'Phát hiện gian lận',
                    detailsForAdmin: 'Chi tiết cho admin'
                );

                $status = $this->reportService->determineStatus($ruleResult, $aiResult);

                // Property: status must be auto_flagged
                $this->assertEquals(
                    Report::STATUS_AUTO_FLAGGED,
                    $status,
                    'Rule violations + AI "co" must result in auto_flagged status'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 12: Decision Logic - Escalate**
     * 
     * *For any* report where rule-based has suspicion BUT AI returns "khong",
     * the final status SHALL be "escalated".
     * 
     * **Validates: Requirements 5.2**
     * 
     * @test
     */
    public function ruleViolationsAndAiKhongResultsInEscalated(): void
    {
        $this
            ->forAll(
                Generators::choose(1, 5),  // Number of violations
                Generators::elements(RuleAnalysisResult::VALID_CONFIDENCE_LEVELS)
            )
            ->withMaxSize(100)
            ->then(function (int $violationCount, string $confidence) {
                // Create rule result with violations
                $violations = [];
                for ($i = 0; $i < $violationCount; $i++) {
                    $violations[] = [
                        'type' => RuleAnalysisResult::VIOLATION_TIMING_ANOMALY,
                        'description' => "Test violation $i",
                        'details' => [],
                    ];
                }

                $ruleResult = new RuleAnalysisResult(
                    hasViolations: true,
                    violations: $violations,
                    confidence: $confidence,
                    reasonResult: 'Test violations detected',
                    metadata: []
                );

                // Create AI result saying "khong" (no cheating)
                $aiResult = new AIAnalysisResult(
                    reportResult: AIAnalysisResult::RESULT_NO_CHEATING,
                    summaryForPlayer: 'Không phát hiện gian lận',
                    detailsForAdmin: 'Chi tiết cho admin'
                );

                $status = $this->reportService->determineStatus($ruleResult, $aiResult);

                // Property: status must be escalated
                $this->assertEquals(
                    Report::STATUS_ESCALATED,
                    $status,
                    'Rule violations + AI "khong" must result in escalated status'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 13: Decision Logic - Dismiss**
     * 
     * *For any* report where rule-based finds nothing AND AI returns "khong",
     * the final status SHALL be "dismissed".
     * 
     * **Validates: Requirements 5.3**
     * 
     * @test
     */
    public function noViolationsAndAiKhongResultsInDismissed(): void
    {
        $this
            ->forAll(
                Generators::elements(RuleAnalysisResult::VALID_CONFIDENCE_LEVELS)
            )
            ->withMaxSize(100)
            ->then(function (string $confidence) {
                // Create rule result with NO violations
                $ruleResult = new RuleAnalysisResult(
                    hasViolations: false,
                    violations: [],
                    confidence: $confidence,
                    reasonResult: 'Không phát hiện bất thường',
                    metadata: []
                );

                // Create AI result saying "khong" (no cheating)
                $aiResult = new AIAnalysisResult(
                    reportResult: AIAnalysisResult::RESULT_NO_CHEATING,
                    summaryForPlayer: 'Không phát hiện gian lận',
                    detailsForAdmin: 'Chi tiết cho admin'
                );

                $status = $this->reportService->determineStatus($ruleResult, $aiResult);

                // Property: status must be dismissed
                $this->assertEquals(
                    Report::STATUS_DISMISSED,
                    $status,
                    'No violations + AI "khong" must result in dismissed status'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 12: Decision Logic - Escalate (AI unavailable)**
     * 
     * *For any* report where AI is unavailable (returns null),
     * the final status SHALL be "escalated" for manual review.
     * 
     * **Validates: Requirements 5.2**
     * 
     * @test
     */
    public function aiUnavailableResultsInEscalated(): void
    {
        $this
            ->forAll(
                Generators::bool(),  // hasViolations
                Generators::elements(RuleAnalysisResult::VALID_CONFIDENCE_LEVELS)
            )
            ->withMaxSize(100)
            ->then(function (bool $hasViolations, string $confidence) {
                $ruleResult = new RuleAnalysisResult(
                    hasViolations: $hasViolations,
                    violations: $hasViolations ? [['type' => 'test', 'description' => 'test', 'details' => []]] : [],
                    confidence: $confidence,
                    reasonResult: 'Test',
                    metadata: []
                );

                // AI is unavailable (null)
                $aiResult = null;

                $status = $this->reportService->determineStatus($ruleResult, $aiResult);

                // Property: status must be escalated when AI is unavailable
                $this->assertEquals(
                    Report::STATUS_ESCALATED,
                    $status,
                    'AI unavailable must result in escalated status for manual review'
                );
            });
    }
}
