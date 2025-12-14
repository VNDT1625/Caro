<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Services\AIAnalysisService;
use App\Services\AIAnalysisResult;

/**
 * Property-Based Tests for AIAnalysisService
 * 
 * Tests AI response validation and analysis result handling.
 */
class AIAnalysisPropertyTest extends TestCase
{
    use TestTrait;

    private AIAnalysisService $aiService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->erisSetup();
        // Create service without API key (we're testing validation, not API calls)
        $this->aiService = new AIAnalysisService(
            apiUrl: 'https://test.api',
            apiKey: '',
            model: 'test-model',
            timeoutSeconds: 30
        );
    }

    /**
     * Compatibility method for Eris TestTrait with PHPUnit 9.x
     */
    public function name(): string
    {
        return $this->getName();
    }

    /**
     * Generate a valid report result ('co' or 'khong')
     */
    private function validReportResultGenerator()
    {
        return Generators::elements(['co', 'khong']);
    }

    /**
     * Generate a non-empty string
     */
    private function nonEmptyStringGenerator()
    {
        return Generators::filter(
            function ($str) {
                return is_string($str) && trim($str) !== '';
            },
            Generators::map(
                function ($chars) {
                    // Ensure we have at least one non-whitespace character
                    return 'text_' . implode('', $chars);
                },
                Generators::seq(Generators::char(['a', 'z']))
            )
        );
    }


    /**
     * **Feature: report-violation-system, Property 10: AI Response Validation**
     * 
     * *For any* AI response with valid report_result ('co' or 'khong'),
     * non-empty summary_for_player, and non-empty details_for_admin,
     * the validation SHALL return true.
     * 
     * **Validates: Requirements 4.3**
     * 
     * @test
     */
    public function validResponsesPassValidation(): void
    {
        $this
            ->forAll(
                $this->validReportResultGenerator(),
                Generators::suchThat(
                    function ($s) { return strlen($s) > 0; },
                    Generators::string()
                ),
                Generators::suchThat(
                    function ($s) { return strlen($s) > 0; },
                    Generators::string()
                )
            )
            ->withMaxSize(100)
            ->then(function (string $reportResult, string $summary, string $details) {
                // Ensure non-empty strings (suchThat might still produce empty after trim)
                if (trim($summary) === '' || trim($details) === '') {
                    return; // Skip this iteration
                }

                $response = [
                    'report_result' => $reportResult,
                    'summary_for_player' => $summary,
                    'details_for_admin' => $details,
                ];

                $isValid = $this->aiService->validateResponse($response);

                $this->assertTrue(
                    $isValid,
                    "Valid response should pass validation: " . json_encode($response)
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 10: AI Response Validation**
     * 
     * *For any* AI response with invalid report_result (not 'co' or 'khong'),
     * the validation SHALL return false.
     * 
     * **Validates: Requirements 4.3**
     * 
     * @test
     */
    public function invalidReportResultFailsValidation(): void
    {
        $invalidResults = ['yes', 'no', 'true', 'false', '1', '0', '', 'có', 'không', 'maybe'];
        
        foreach ($invalidResults as $invalidResult) {
            $response = [
                'report_result' => $invalidResult,
                'summary_for_player' => 'Valid summary',
                'details_for_admin' => 'Valid details',
            ];

            $isValid = $this->aiService->validateResponse($response);

            $this->assertFalse(
                $isValid,
                "Invalid report_result '{$invalidResult}' should fail validation"
            );
        }
    }

    /**
     * **Feature: report-violation-system, Property 10: AI Response Validation**
     * 
     * *For any* AI response missing required fields,
     * the validation SHALL return false.
     * 
     * **Validates: Requirements 4.3**
     * 
     * @test
     */
    public function missingFieldsFailValidation(): void
    {
        $this
            ->forAll($this->validReportResultGenerator())
            ->withMaxSize(100)
            ->then(function (string $reportResult) {
                // Missing summary_for_player
                $response1 = [
                    'report_result' => $reportResult,
                    'details_for_admin' => 'Valid details',
                ];
                $this->assertFalse(
                    $this->aiService->validateResponse($response1),
                    'Missing summary_for_player should fail validation'
                );

                // Missing details_for_admin
                $response2 = [
                    'report_result' => $reportResult,
                    'summary_for_player' => 'Valid summary',
                ];
                $this->assertFalse(
                    $this->aiService->validateResponse($response2),
                    'Missing details_for_admin should fail validation'
                );

                // Missing report_result
                $response3 = [
                    'summary_for_player' => 'Valid summary',
                    'details_for_admin' => 'Valid details',
                ];
                $this->assertFalse(
                    $this->aiService->validateResponse($response3),
                    'Missing report_result should fail validation'
                );

                // Empty response
                $this->assertFalse(
                    $this->aiService->validateResponse([]),
                    'Empty response should fail validation'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 10: AI Response Validation**
     * 
     * *For any* AI response with empty or whitespace-only strings,
     * the validation SHALL return false.
     * 
     * **Validates: Requirements 4.3**
     * 
     * @test
     */
    public function emptyStringsFailValidation(): void
    {
        $emptyStrings = ['', ' ', '  ', "\t", "\n", "   \t\n  "];
        
        foreach ($emptyStrings as $emptyString) {
            // Empty summary_for_player
            $response1 = [
                'report_result' => 'co',
                'summary_for_player' => $emptyString,
                'details_for_admin' => 'Valid details',
            ];
            $this->assertFalse(
                $this->aiService->validateResponse($response1),
                "Empty/whitespace summary_for_player should fail validation"
            );

            // Empty details_for_admin
            $response2 = [
                'report_result' => 'co',
                'summary_for_player' => 'Valid summary',
                'details_for_admin' => $emptyString,
            ];
            $this->assertFalse(
                $this->aiService->validateResponse($response2),
                "Empty/whitespace details_for_admin should fail validation"
            );
        }
    }

    /**
     * **Feature: report-violation-system, Property 10: AI Response Validation**
     * 
     * *For any* AI response with wrong types (non-string values),
     * the validation SHALL return false.
     * 
     * **Validates: Requirements 4.3**
     * 
     * @test
     */
    public function wrongTypesFailValidation(): void
    {
        $wrongTypes = [null, 123, 45.67, true, false, [], ['array']];
        
        foreach ($wrongTypes as $wrongType) {
            // Wrong type for report_result
            $response1 = [
                'report_result' => $wrongType,
                'summary_for_player' => 'Valid summary',
                'details_for_admin' => 'Valid details',
            ];
            $this->assertFalse(
                $this->aiService->validateResponse($response1),
                "Wrong type for report_result should fail validation"
            );

            // Wrong type for summary_for_player
            $response2 = [
                'report_result' => 'co',
                'summary_for_player' => $wrongType,
                'details_for_admin' => 'Valid details',
            ];
            $this->assertFalse(
                $this->aiService->validateResponse($response2),
                "Wrong type for summary_for_player should fail validation"
            );

            // Wrong type for details_for_admin
            $response3 = [
                'report_result' => 'co',
                'summary_for_player' => 'Valid summary',
                'details_for_admin' => $wrongType,
            ];
            $this->assertFalse(
                $this->aiService->validateResponse($response3),
                "Wrong type for details_for_admin should fail validation"
            );
        }
    }

    /**
     * **Feature: report-violation-system, Property 10: AI Response Validation**
     * 
     * *For any* valid AIAnalysisResult created from valid data,
     * converting to array and back SHALL produce equivalent result.
     * 
     * **Validates: Requirements 4.3**
     * 
     * @test
     */
    public function aiResultRoundTrip(): void
    {
        $this
            ->forAll(
                $this->validReportResultGenerator(),
                Generators::suchThat(
                    function ($s) { return strlen($s) > 0; },
                    Generators::string()
                ),
                Generators::suchThat(
                    function ($s) { return strlen($s) > 0; },
                    Generators::string()
                )
            )
            ->withMaxSize(100)
            ->then(function (string $reportResult, string $summary, string $details) {
                // Skip empty strings after trim
                if (trim($summary) === '' || trim($details) === '') {
                    return;
                }

                // Create original result
                $original = new AIAnalysisResult($reportResult, $summary, $details);
                
                // Convert to array
                $array = $original->toArray();
                
                // Create from array
                $restored = AIAnalysisResult::fromArray($array);
                
                // Property: round-trip should preserve all data
                $this->assertNotNull($restored, 'fromArray should succeed for valid data');
                $this->assertEquals($original->reportResult, $restored->reportResult);
                $this->assertEquals($original->summaryForPlayer, $restored->summaryForPlayer);
                $this->assertEquals($original->detailsForAdmin, $restored->detailsForAdmin);
            });
    }

    /**
     * **Feature: report-violation-system, Property 10: AI Response Validation**
     * 
     * *For any* AIAnalysisResult with report_result 'co',
     * isCheating() SHALL return true.
     * 
     * **Validates: Requirements 4.3**
     * 
     * @test
     */
    public function isCheatingReturnsCorrectValue(): void
    {
        // Test 'co' returns true
        $cheatingResult = new AIAnalysisResult('co', 'Summary', 'Details');
        $this->assertTrue($cheatingResult->isCheating(), "'co' should indicate cheating");

        // Test 'khong' returns false
        $noCheatingResult = new AIAnalysisResult('khong', 'Summary', 'Details');
        $this->assertFalse($noCheatingResult->isCheating(), "'khong' should indicate no cheating");
    }
}
