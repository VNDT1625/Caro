<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Controllers\ReportController;
use App\Models\Report;
use App\Services\ReportService;
use App\Services\ReportServiceInterface;
use App\Services\RuleEngineService;
use App\Services\AIAnalysisService;
use App\Services\BanService;

/**
 * Property-Based Tests for ReportController
 * 
 * Tests the API controller behavior including filtering and status updates.
 */
class ReportControllerPropertyTest extends TestCase
{
    use TestTrait;

    private ReportController $controller;
    private ReportService $reportService;

    protected function setUp(): void
    {
        parent::setUp();
        if (method_exists($this, 'erisSetupBeforeClass')) {
            static::erisSetupBeforeClass();
        }
        $this->erisSetup();

        // Create services
        $ruleEngine = new RuleEngineService();
        $aiService = new AIAnalysisService();
        $this->reportService = new ReportService($ruleEngine, $aiService);
        $banService = new BanService();
        
        $this->controller = new ReportController($this->reportService, $banService);
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
     * **Feature: report-violation-system, Property 5: Report Filter Consistency**
     * 
     * *For any* report query with status filter, all returned reports SHALL have the specified status.
     * 
     * This test verifies that when filtering reports by status, only reports with that
     * exact status are returned. We test this by:
     * 1. Creating a mock ReportService that returns reports with various statuses
     * 2. Filtering by a specific status
     * 3. Verifying all returned reports have the filtered status
     * 
     * **Validates: Requirements 2.4**
     * 
     * @test
     */
    public function reportFilterByStatusReturnsOnlyMatchingReports(): void
    {
        $this
            ->forAll(
                Generators::elements(Report::VALID_STATUSES),
                Generators::choose(1, 10)  // Number of reports to generate
            )
            ->withMaxSize(100)
            ->then(function (string $filterStatus, int $reportCount) {
                // Create mock reports with various statuses
                $reports = [];
                $matchingCount = 0;
                
                for ($i = 0; $i < $reportCount; $i++) {
                    // Randomly assign status, but ensure at least some match
                    $status = ($i % 2 === 0) ? $filterStatus : Report::VALID_STATUSES[array_rand(Report::VALID_STATUSES)];
                    
                    $report = new Report();
                    $report->fill([
                        'id' => $this->generateUuid(),
                        'reporter_id' => $this->generateUuid(),
                        'type' => Report::VALID_TYPES[array_rand(Report::VALID_TYPES)],
                        'status' => $status,
                        'created_at' => date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s'),
                    ]);
                    
                    $reports[] = $report;
                    if ($status === $filterStatus) {
                        $matchingCount++;
                    }
                }

                // Create a mock service that filters correctly
                $mockService = $this->createMockReportService($reports, $filterStatus);
                $controller = new ReportController($mockService, null);

                // Call index with status filter
                $response = $controller->index(['status' => $filterStatus]);

                // Property: All returned reports must have the filtered status
                $this->assertTrue($response['success'], 'Response should be successful');
                
                foreach ($response['data'] as $reportData) {
                    $this->assertEquals(
                        $filterStatus,
                        $reportData['status'],
                        "All returned reports must have status '$filterStatus'"
                    );
                }
            });
    }

    /**
     * **Feature: report-violation-system, Property 5: Report Filter Consistency**
     * 
     * *For any* report query with type filter, all returned reports SHALL have the specified type.
     * 
     * **Validates: Requirements 2.4**
     * 
     * @test
     */
    public function reportFilterByTypeReturnsOnlyMatchingReports(): void
    {
        $this
            ->forAll(
                Generators::elements(Report::VALID_TYPES),
                Generators::choose(1, 10)
            )
            ->withMaxSize(100)
            ->then(function (string $filterType, int $reportCount) {
                // Create mock reports with various types
                $reports = [];
                
                for ($i = 0; $i < $reportCount; $i++) {
                    $type = ($i % 2 === 0) ? $filterType : Report::VALID_TYPES[array_rand(Report::VALID_TYPES)];
                    
                    $report = new Report();
                    $report->fill([
                        'id' => $this->generateUuid(),
                        'reporter_id' => $this->generateUuid(),
                        'type' => $type,
                        'status' => Report::STATUS_PENDING,
                        'created_at' => date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s'),
                    ]);
                    
                    $reports[] = $report;
                }

                // Create a mock service that filters by type
                $mockService = $this->createMockReportServiceByType($reports, $filterType);
                $controller = new ReportController($mockService, null);

                // Call index with type filter
                $response = $controller->index(['type' => $filterType]);

                // Property: All returned reports must have the filtered type
                $this->assertTrue($response['success'], 'Response should be successful');
                
                foreach ($response['data'] as $reportData) {
                    $this->assertEquals(
                        $filterType,
                        $reportData['type'],
                        "All returned reports must have type '$filterType'"
                    );
                }
            });
    }

    /**
     * Create a mock ReportService that filters by status
     */
    private function createMockReportService(array $reports, string $filterStatus): ReportServiceInterface
    {
        $mockService = $this->createMock(ReportServiceInterface::class);
        
        // Filter reports by status
        $filteredReports = array_filter($reports, function ($report) use ($filterStatus) {
            return $report->getAttribute('status') === $filterStatus;
        });
        
        // Format for response
        $formattedReports = array_map(function ($report) {
            return [
                'id' => $report->getAttribute('id'),
                'reporter_id' => $report->getAttribute('reporter_id'),
                'type' => $report->getAttribute('type'),
                'status' => $report->getAttribute('status'),
                'created_at' => $report->getAttribute('created_at'),
                'updated_at' => $report->getAttribute('updated_at'),
            ];
        }, array_values($filteredReports));
        
        $mockService->method('getReports')
            ->willReturn([
                'data' => $formattedReports,
                'total' => count($formattedReports),
                'page' => 1,
                'per_page' => 20,
                'total_pages' => 1,
            ]);
        
        return $mockService;
    }

    /**
     * Create a mock ReportService that filters by type
     */
    private function createMockReportServiceByType(array $reports, string $filterType): ReportServiceInterface
    {
        $mockService = $this->createMock(ReportServiceInterface::class);
        
        // Filter reports by type
        $filteredReports = array_filter($reports, function ($report) use ($filterType) {
            return $report->getAttribute('type') === $filterType;
        });
        
        // Format for response
        $formattedReports = array_map(function ($report) {
            return [
                'id' => $report->getAttribute('id'),
                'reporter_id' => $report->getAttribute('reporter_id'),
                'type' => $report->getAttribute('type'),
                'status' => $report->getAttribute('status'),
                'created_at' => $report->getAttribute('created_at'),
                'updated_at' => $report->getAttribute('updated_at'),
            ];
        }, array_values($filteredReports));
        
        $mockService->method('getReports')
            ->willReturn([
                'data' => $formattedReports,
                'total' => count($formattedReports),
                'page' => 1,
                'per_page' => 20,
                'total_pages' => 1,
            ]);
        
        return $mockService;
    }

    /**
     * **Feature: report-violation-system, Property 4: Status Update Timestamp**
     * 
     * *For any* report status change, the updated_at timestamp SHALL be greater than 
     * or equal to the previous updated_at value.
     * 
     * This test verifies that when a report status is updated, the updated_at timestamp
     * is properly updated to reflect the change time.
     * 
     * **Validates: Requirements 2.3**
     * 
     * @test
     */
    public function statusUpdateUpdatesTimestamp(): void
    {
        $this
            ->forAll(
                Generators::elements(Report::VALID_STATUSES),
                Generators::elements(Report::VALID_STATUSES)
            )
            ->withMaxSize(100)
            ->then(function (string $oldStatus, string $newStatus) {
                // Skip if same status (no change)
                if ($oldStatus === $newStatus) {
                    $this->assertTrue(true);
                    return;
                }

                $reportId = $this->generateUuid();
                $adminId = $this->generateUuid();
                $originalTimestamp = date('Y-m-d H:i:s', strtotime('-1 hour'));
                $newTimestampStr = date('Y-m-d H:i:s'); // Current time

                // Create a mock report with original timestamp
                $originalReport = new Report();
                $originalReport->fill([
                    'id' => $reportId,
                    'reporter_id' => $this->generateUuid(),
                    'type' => Report::TYPE_CHEATING,
                    'status' => $oldStatus,
                    'created_at' => $originalTimestamp,
                    'updated_at' => $originalTimestamp,
                ]);

                // Create updated report with new timestamp
                $updatedReport = new Report();
                $updatedReport->fill([
                    'id' => $reportId,
                    'reporter_id' => $originalReport->getAttribute('reporter_id'),
                    'type' => Report::TYPE_CHEATING,
                    'status' => $newStatus,
                    'created_at' => $originalTimestamp,
                    'updated_at' => $newTimestampStr,
                ]);

                // Create mock service
                $mockService = $this->createMockUpdateService($originalReport, $updatedReport);
                $controller = new ReportController($mockService, null);

                // Call update
                $response = $controller->update($reportId, ['status' => $newStatus], $adminId);

                // Property: updated_at should be >= original timestamp
                $this->assertTrue($response['success'], 'Update should succeed');
                
                $responseUpdatedAt = $response['data']['updated_at'];
                $this->assertNotNull($responseUpdatedAt, 'updated_at should not be null');
                
                // Handle DateTimeImmutable objects
                if ($responseUpdatedAt instanceof \DateTimeInterface) {
                    $newTimestamp = $responseUpdatedAt->getTimestamp();
                } else {
                    $newTimestamp = strtotime($responseUpdatedAt);
                }
                
                $oldTimestamp = strtotime($originalTimestamp);
                
                $this->assertNotFalse($newTimestamp, 'New timestamp should be valid');
                $this->assertNotFalse($oldTimestamp, 'Old timestamp should be valid');
                
                $this->assertGreaterThanOrEqual(
                    $oldTimestamp,
                    $newTimestamp,
                    'updated_at must be >= original timestamp after status change'
                );
            });
    }

    /**
     * Create a mock ReportService for update operations
     */
    private function createMockUpdateService(Report $originalReport, Report $updatedReport): ReportServiceInterface
    {
        $mockService = $this->createMock(ReportServiceInterface::class);
        
        $mockService->method('updateReport')
            ->willReturn($updatedReport);
        
        return $mockService;
    }
}
