<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Services\AppealService;
use App\Services\BanService;
use App\Models\Appeal;
use App\Models\Report;
use App\Models\UserBan;

/**
 * Property-Based Tests for AppealService
 * 
 * **Feature: report-violation-system, Property 15: Appeal Creation**
 * **Feature: report-violation-system, Property 16: Appeal Queue**
 * 
 * Tests that appeals are correctly linked to reports and added to admin queue.
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3**
 */
class AppealServicePropertyTest extends TestCase
{
    use TestTrait;

    private AppealService $appealService;
    private BanService $banService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->erisSetup();
        $this->banService = new BanService();
        $this->appealService = new AppealService($this->banService);
    }

    protected function tearDown(): void
    {
        $this->appealService->clearAll();
        $this->banService->clearBans();
        parent::tearDown();
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
     * Generate a valid appeal reason string (non-empty, within length limit)
     */
    private function reasonGenerator()
    {
        return Generators::map(
            function ($suffix) {
                $reason = 'Appeal reason: ' . $suffix;
                if (strlen($reason) > Appeal::MAX_REASON_LENGTH) {
                    $reason = substr($reason, 0, Appeal::MAX_REASON_LENGTH);
                }
                return $reason;
            },
            Generators::string()
        );
    }

    /**
     * Create a test report and add it to the service
     */
    private function createTestReport(string $reportId, string $reportedUserId): Report
    {
        $report = Report::createReport([
            'reporter_id' => $this->generateUuid(),
            'reported_user_id' => $reportedUserId,
            'type' => Report::TYPE_CHEATING,
            'status' => Report::STATUS_AUTO_FLAGGED,
        ]);
        $this->appealService->addReport($report, $reportId);
        return $report;
    }


    /**
     * **Feature: report-violation-system, Property 15: Appeal Creation**
     * 
     * *For any* appeal submission, the appeal SHALL be linked to the original report_id 
     * and SHALL NOT trigger AI processing.
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function appealCreationLinksToReportAndDoesNotTriggerAI(): void
    {
        $this
            ->forAll($this->reasonGenerator())
            ->withMaxSize(100)
            ->then(function (string $reason) {
                // Clear previous data
                $this->appealService->clearAll();
                
                $reportId = $this->generateUuid();
                $userId = $this->generateUuid();
                
                // Create a report first
                $this->createTestReport($reportId, $userId);

                // Create appeal
                $appeal = $this->appealService->createAppeal($reportId, $userId, $reason);

                // Property 15: Appeal SHALL be linked to the original report_id
                $this->assertEquals(
                    $reportId,
                    $appeal->getAttribute('report_id'),
                    'Appeal must be linked to the original report_id'
                );

                // Property 15: Appeal SHALL be linked to the user
                $this->assertEquals(
                    $userId,
                    $appeal->getAttribute('user_id'),
                    'Appeal must be linked to the user'
                );

                // Property 15: Appeal SHALL have pending status
                $this->assertEquals(
                    Appeal::STATUS_PENDING,
                    $appeal->getAttribute('status'),
                    'New appeal must have pending status'
                );

                // Property 15: Appeal reason SHALL match input
                $this->assertEquals(
                    $reason,
                    $appeal->getAttribute('reason'),
                    'Appeal reason must match input'
                );

                // Property 15: Appeal SHALL NOT have AI-related fields populated
                // (No AI processing means no AI analysis stored)
                $this->assertNull(
                    $appeal->getAttribute('ai_analysis'),
                    'Appeal must not have AI analysis (no AI processing)'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 15: Appeal Creation**
     * 
     * *For any* appeal submission, the appeal SHALL have all required fields populated.
     * 
     * **Validates: Requirements 7.1**
     * 
     * @test
     */
    public function appealCreationPopulatesRequiredFields(): void
    {
        $this
            ->forAll($this->reasonGenerator())
            ->withMaxSize(100)
            ->then(function (string $reason) {
                $this->appealService->clearAll();
                
                $reportId = $this->generateUuid();
                $userId = $this->generateUuid();
                
                $this->createTestReport($reportId, $userId);

                $appeal = $this->appealService->createAppeal($reportId, $userId, $reason);

                // Required fields must be present
                $this->assertNotNull($appeal->getAttribute('report_id'), 'report_id must be present');
                $this->assertNotNull($appeal->getAttribute('user_id'), 'user_id must be present');
                $this->assertNotNull($appeal->getAttribute('reason'), 'reason must be present');
                $this->assertNotNull($appeal->getAttribute('status'), 'status must be present');

                // Status must be pending for new appeals
                $this->assertTrue(
                    $appeal->isPending(),
                    'New appeal must be in pending state'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 15: Appeal Creation**
     * 
     * *For any* duplicate appeal submission (same report_id and user_id), 
     * the system SHALL reject the appeal.
     * 
     * **Validates: Requirements 7.1**
     * 
     * @test
     */
    public function duplicateAppealIsRejected(): void
    {
        $this
            ->minimumEvaluationRatio(0.0)
            ->forAll($this->reasonGenerator())
            ->withMaxSize(100)
            ->then(function (string $reason) {
                $this->appealService->clearAll();
                
                $reportId = $this->generateUuid();
                $userId = $this->generateUuid();
                
                $this->createTestReport($reportId, $userId);

                // First appeal should succeed
                $appeal1 = $this->appealService->createAppeal($reportId, $userId, $reason);
                $this->assertNotNull($appeal1);

                // Second appeal should fail
                $exceptionThrown = false;
                try {
                    $this->appealService->createAppeal($reportId, $userId, 'Another reason');
                } catch (\RuntimeException $e) {
                    $exceptionThrown = true;
                    $this->assertStringContainsString('Appeal already exists', $e->getMessage());
                }
                
                $this->assertTrue($exceptionThrown, 'Duplicate appeal must throw RuntimeException');
            });
    }

    /**
     * **Feature: report-violation-system, Property 15: Appeal Creation**
     * 
     * *For any* appeal with empty reason, the system SHALL reject the appeal.
     * 
     * **Validates: Requirements 7.1**
     * 
     * @test
     */
    public function appealWithEmptyReasonIsRejected(): void
    {
        $this
            ->minimumEvaluationRatio(0.0)
            ->forAll(
                Generators::elements(['', '   ', "\t", "\n", "  \t\n  "])
            )
            ->withMaxSize(100)
            ->then(function (string $emptyReason) {
                $this->appealService->clearAll();
                
                $reportId = $this->generateUuid();
                $userId = $this->generateUuid();
                
                $this->createTestReport($reportId, $userId);

                $exceptionThrown = false;
                try {
                    $this->appealService->createAppeal($reportId, $userId, $emptyReason);
                } catch (\InvalidArgumentException $e) {
                    $exceptionThrown = true;
                }
                
                $this->assertTrue($exceptionThrown, 'Empty reason must throw InvalidArgumentException');
            });
    }

    /**
     * **Feature: report-violation-system, Property 15: Appeal Creation**
     * 
     * *For any* appeal for non-existent report, the system SHALL reject the appeal.
     * 
     * **Validates: Requirements 7.1**
     * 
     * @test
     */
    public function appealForNonExistentReportIsRejected(): void
    {
        $this
            ->minimumEvaluationRatio(0.0)
            ->forAll($this->reasonGenerator())
            ->withMaxSize(100)
            ->then(function (string $reason) {
                $this->appealService->clearAll();
                
                $nonExistentReportId = $this->generateUuid();
                $userId = $this->generateUuid();

                $exceptionThrown = false;
                try {
                    $this->appealService->createAppeal($nonExistentReportId, $userId, $reason);
                } catch (\RuntimeException $e) {
                    $exceptionThrown = true;
                    $this->assertStringContainsString('Report not found', $e->getMessage());
                }
                
                $this->assertTrue($exceptionThrown, 'Non-existent report must throw RuntimeException');
            });
    }


    /**
     * **Feature: report-violation-system, Property 16: Appeal Queue**
     * 
     * *For any* created appeal, the associated report status SHALL be updated 
     * to include appeal in admin review queue.
     * 
     * **Validates: Requirements 7.3**
     * 
     * @test
     */
    public function appealCreationUpdatesReportStatusForAdminQueue(): void
    {
        $this
            ->forAll($this->reasonGenerator())
            ->withMaxSize(100)
            ->then(function (string $reason) {
                $this->appealService->clearAll();
                
                $reportId = $this->generateUuid();
                $userId = $this->generateUuid();
                
                // Create a report with auto_flagged status
                $report = Report::createReport([
                    'reporter_id' => $this->generateUuid(),
                    'reported_user_id' => $userId,
                    'type' => Report::TYPE_CHEATING,
                    'status' => Report::STATUS_AUTO_FLAGGED,
                ]);
                $this->appealService->addReport($report, $reportId);

                // Create appeal
                $this->appealService->createAppeal($reportId, $userId, $reason);

                // Property 16: Report status SHALL be updated for admin review queue
                $updatedReport = $this->appealService->getReportById($reportId);
                
                $this->assertEquals(
                    Report::STATUS_ESCALATED,
                    $updatedReport->getAttribute('status'),
                    'Report status must be escalated for admin review queue'
                );

                // Property 16: Report admin_notes SHALL indicate pending appeal
                $adminNotes = $updatedReport->getAttribute('admin_notes');
                $this->assertStringContainsString(
                    'Appeal submitted',
                    $adminNotes,
                    'Report admin_notes must indicate appeal was submitted'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 16: Appeal Queue**
     * 
     * *For any* created appeal, the appeal SHALL appear in the pending appeals list.
     * 
     * **Validates: Requirements 7.3**
     * 
     * @test
     */
    public function createdAppealAppearsInPendingQueue(): void
    {
        $this
            ->forAll($this->reasonGenerator())
            ->withMaxSize(100)
            ->then(function (string $reason) {
                $this->appealService->clearAll();
                
                $reportId = $this->generateUuid();
                $userId = $this->generateUuid();
                
                $this->createTestReport($reportId, $userId);

                // Create appeal
                $appeal = $this->appealService->createAppeal($reportId, $userId, $reason);
                $appealId = $appeal->getAttribute('id');

                // Property 16: Appeal SHALL appear in pending appeals list
                $pendingAppeals = $this->appealService->getPendingAppeals();
                
                $this->assertNotEmpty(
                    $pendingAppeals,
                    'Pending appeals list must not be empty after creating appeal'
                );

                // Find our appeal in the list
                $found = false;
                foreach ($pendingAppeals as $pendingAppeal) {
                    if ($pendingAppeal->getAttribute('id') === $appealId) {
                        $found = true;
                        break;
                    }
                }
                
                $this->assertTrue(
                    $found,
                    'Created appeal must appear in pending appeals queue'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 16: Appeal Queue**
     * 
     * *For any* processed appeal, the appeal SHALL be removed from pending queue.
     * 
     * **Validates: Requirements 7.3, 7.5**
     * 
     * @test
     */
    public function processedAppealRemovedFromPendingQueue(): void
    {
        $this
            ->minimumEvaluationRatio(0.0)
            ->forAll(
                $this->reasonGenerator(),
                Generators::elements([Appeal::STATUS_APPROVED, Appeal::STATUS_REJECTED])
            )
            ->withMaxSize(100)
            ->then(function (string $reason, string $status) {
                $this->appealService->clearAll();
                
                $reportId = $this->generateUuid();
                $userId = $this->generateUuid();
                $adminId = $this->generateUuid();
                
                $this->createTestReport($reportId, $userId);

                // Create appeal
                $appeal = $this->appealService->createAppeal($reportId, $userId, $reason);
                $appealId = $appeal->getAttribute('id');

                // Verify it's in pending queue
                $pendingBefore = $this->appealService->getPendingAppeals();
                $this->assertNotEmpty($pendingBefore);

                // Process the appeal
                $this->appealService->processAppeal(
                    $appealId,
                    $status,
                    'Admin response: ' . $reason,
                    $adminId,
                    false
                );

                // Property 16: Processed appeal SHALL be removed from pending queue
                $pendingAfter = $this->appealService->getPendingAppeals();
                
                $found = false;
                foreach ($pendingAfter as $pendingAppeal) {
                    if ($pendingAppeal->getAttribute('id') === $appealId) {
                        $found = true;
                        break;
                    }
                }
                
                $this->assertFalse(
                    $found,
                    'Processed appeal must not appear in pending appeals queue'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 16: Appeal Queue**
     * 
     * *For any* appeal, it SHALL be retrievable by report_id.
     * 
     * **Validates: Requirements 7.3**
     * 
     * @test
     */
    public function appealRetrievableByReportId(): void
    {
        $this
            ->forAll($this->reasonGenerator())
            ->withMaxSize(100)
            ->then(function (string $reason) {
                $this->appealService->clearAll();
                
                $reportId = $this->generateUuid();
                $userId = $this->generateUuid();
                
                $this->createTestReport($reportId, $userId);

                // Create appeal
                $appeal = $this->appealService->createAppeal($reportId, $userId, $reason);
                $appealId = $appeal->getAttribute('id');

                // Property 16: Appeal SHALL be retrievable by report_id
                $appeals = $this->appealService->getAppealsForReport($reportId);
                
                $this->assertNotEmpty(
                    $appeals,
                    'Appeals for report must not be empty'
                );

                $found = false;
                foreach ($appeals as $foundAppeal) {
                    if ($foundAppeal->getAttribute('id') === $appealId) {
                        $found = true;
                        $this->assertEquals(
                            $reportId,
                            $foundAppeal->getAttribute('report_id'),
                            'Retrieved appeal must have correct report_id'
                        );
                        break;
                    }
                }
                
                $this->assertTrue($found, 'Appeal must be found by report_id');
            });
    }
}
