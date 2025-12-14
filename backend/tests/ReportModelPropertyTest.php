<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Models\Report;

/**
 * Property-Based Tests for Report Model
 * 
 * **Feature: report-violation-system, Property 1: Report Creation Data Integrity**
 * 
 * Tests that for any valid report submission, the created report SHALL contain
 * all required fields (reporter_id, type, status) and the status SHALL always be "pending".
 * 
 * **Validates: Requirements 2.1, 2.2**
 */
class ReportModelPropertyTest extends TestCase
{
    use TestTrait;

    protected function setUp(): void
    {
        parent::setUp();
        // Eris setup - load generator files
        if (method_exists($this, 'erisSetupBeforeClass')) {
            static::erisSetupBeforeClass();
        }
        // Initialize Eris for this test
        $this->erisSetup();
    }

    /**
     * Compatibility method for Eris TestTrait with PHPUnit 9.x
     * Eris 1.0 expects name() but PHPUnit 9.x uses getName()
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
     * **Feature: report-violation-system, Property 1: Report Creation Data Integrity**
     * 
     * *For any* valid report submission, the created report SHALL contain
     * all required fields (reporter_id, type, status) and the status SHALL always be "pending".
     * 
     * **Validates: Requirements 2.1, 2.2**
     * 
     * @test
     */
    public function reportCreationAlwaysHasRequiredFieldsAndPendingStatus(): void
    {
        $this
            ->forAll(
                Generators::elements(Report::VALID_TYPES),
                Generators::oneOf(
                    Generators::constant(null),
                    Generators::string()
                )
            )
            ->withMaxSize(100)
            ->then(function (string $type, ?string $description) {
                $reporterId = $this->generateUuid();
                
                $data = [
                    'reporter_id' => $reporterId,
                    'type' => $type,
                ];
                
                if ($description !== null) {
                    // Truncate to max length for valid input
                    $data['description'] = substr($description, 0, Report::MAX_DESCRIPTION_LENGTH);
                }

                // Create report using the factory method
                $report = Report::createReport($data);

                // Property 1: Required fields must be present
                $this->assertNotNull(
                    $report->getAttribute('reporter_id'),
                    'reporter_id must be present'
                );
                $this->assertNotNull(
                    $report->getAttribute('type'),
                    'type must be present'
                );
                $this->assertNotNull(
                    $report->getAttribute('status'),
                    'status must be present'
                );

                // Property 2: Status must always be "pending" for new reports
                $this->assertEquals(
                    Report::STATUS_PENDING,
                    $report->getAttribute('status'),
                    'New reports must have status "pending"'
                );

                // Property 3: reporter_id must match input
                $this->assertEquals(
                    $reporterId,
                    $report->getAttribute('reporter_id'),
                    'reporter_id must match input'
                );

                // Property 4: type must match input
                $this->assertEquals(
                    $type,
                    $report->getAttribute('type'),
                    'type must match input'
                );

                // Property 5: type must be valid
                $this->assertContains(
                    $report->getAttribute('type'),
                    Report::VALID_TYPES,
                    'type must be a valid report type'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 1: Report Creation Data Integrity**
     * 
     * *For any* report, even if status is explicitly set during creation,
     * the createReport method SHALL override it to "pending".
     * 
     * **Validates: Requirements 2.2**
     * 
     * @test
     */
    public function createReportAlwaysOverridesStatusToPending(): void
    {
        $this
            ->forAll(
                Generators::elements(Report::VALID_TYPES),
                Generators::elements(Report::VALID_STATUSES)
            )
            ->withMaxSize(100)
            ->then(function (string $type, string $attemptedStatus) {
                $reporterId = $this->generateUuid();
                
                $data = [
                    'reporter_id' => $reporterId,
                    'type' => $type,
                    'status' => $attemptedStatus,  // Try to set a different status
                ];

                $report = Report::createReport($data);

                // Status must always be "pending" regardless of input
                $this->assertEquals(
                    Report::STATUS_PENDING,
                    $report->getAttribute('status'),
                    "createReport must set status to 'pending' even when '$attemptedStatus' was provided"
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 1: Report Creation Data Integrity**
     * 
     * *For any* valid report data, the validation function SHALL return valid=true.
     * 
     * **Validates: Requirements 2.1**
     * 
     * @test
     */
    public function validReportDataPassesValidation(): void
    {
        $this
            ->forAll(
                Generators::elements(Report::VALID_TYPES)
            )
            ->withMaxSize(100)
            ->then(function (string $type) {
                $reporterId = $this->generateUuid();
                
                $data = [
                    'reporter_id' => $reporterId,
                    'type' => $type,
                ];

                $result = Report::validate($data);

                $this->assertTrue(
                    $result['valid'],
                    'Valid report data should pass validation. Errors: ' . json_encode($result['errors'])
                );
                $this->assertEmpty(
                    $result['errors'],
                    'Valid report data should have no validation errors'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 1: Report Creation Data Integrity**
     * 
     * *For any* report data missing reporter_id, validation SHALL fail.
     * 
     * **Validates: Requirements 2.1**
     * 
     * @test
     */
    public function missingReporterIdFailsValidation(): void
    {
        $this
            ->forAll(
                Generators::elements(Report::VALID_TYPES)
            )
            ->withMaxSize(100)
            ->then(function (string $type) {
                $data = [
                    'type' => $type,
                    // reporter_id is missing
                ];

                $result = Report::validate($data);

                $this->assertFalse(
                    $result['valid'],
                    'Missing reporter_id should fail validation'
                );
                $this->assertArrayHasKey(
                    'reporter_id',
                    $result['errors'],
                    'Errors should include reporter_id'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 1: Report Creation Data Integrity**
     * 
     * *For any* report data missing type, validation SHALL fail.
     * 
     * **Validates: Requirements 2.1**
     * 
     * @test
     */
    public function missingTypeFailsValidation(): void
    {
        $this
            ->forAll(
                Generators::int()
            )
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $reporterId = $this->generateUuid();
                
                $data = [
                    'reporter_id' => $reporterId,
                    // type is missing
                ];

                $result = Report::validate($data);

                $this->assertFalse(
                    $result['valid'],
                    'Missing type should fail validation'
                );
                $this->assertArrayHasKey(
                    'type',
                    $result['errors'],
                    'Errors should include type'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 1: Report Creation Data Integrity**
     * 
     * *For any* invalid report type, validation SHALL fail.
     * 
     * **Validates: Requirements 2.1**
     * 
     * @test
     */
    public function invalidTypeFailsValidation(): void
    {
        $this
            ->forAll(
                Generators::suchThat(
                    function ($type) {
                        return !in_array($type, Report::VALID_TYPES) && strlen($type) > 0;
                    },
                    Generators::string()
                )
            )
            ->withMaxSize(100)
            ->then(function (string $invalidType) {
                $reporterId = $this->generateUuid();
                
                $data = [
                    'reporter_id' => $reporterId,
                    'type' => $invalidType,
                ];

                $result = Report::validate($data);

                $this->assertFalse(
                    $result['valid'],
                    "Invalid type '$invalidType' should fail validation"
                );
                $this->assertArrayHasKey(
                    'type',
                    $result['errors'],
                    'Errors should include type'
                );
            });
    }
}
