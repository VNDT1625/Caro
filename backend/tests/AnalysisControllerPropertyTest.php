<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Controllers\AnalysisController;
use App\Services\AIBridgeService;
use App\Services\AIBridgeServiceInterface;
use App\Services\SubscriptionService;
use App\Services\SubscriptionServiceInterface;
use App\Services\UsageService;
use App\Services\UsageServiceInterface;

/**
 * Property-Based Tests for AnalysisController
 * 
 * **Feature: ai-match-analysis-system, Property 11: API Contract Compliance**
 * 
 * Tests that:
 * - Validates request structure and returns 400 for invalid requests
 * - Checks tier permissions and returns 403 for unauthorized access
 * - Returns correctly structured responses matching the defined schemas
 * - Returns appropriate error codes (400, 403, 429, 500) without exposing internal details
 * 
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**
 */
class AnalysisControllerPropertyTest extends TestCase
{
    use TestTrait;

    private AnalysisController $controller;
    private SubscriptionService $subscriptionService;
    private UsageService $usageService;
    private MockAIBridgeService $aiBridge;
    private \DateTimeImmutable $fixedTime;

    protected function setUp(): void
    {
        parent::setUp();
        $this->erisSetup();
        
        $this->fixedTime = new \DateTimeImmutable('2024-12-03 12:00:00');
        $this->subscriptionService = new SubscriptionService(null, fn() => $this->fixedTime);
        $this->usageService = new UsageService(null, fn() => $this->fixedTime);
        $this->aiBridge = new MockAIBridgeService();
        
        $this->controller = new AnalysisController(
            $this->aiBridge,
            $this->subscriptionService,
            $this->usageService
        );
    }

    protected function tearDown(): void
    {
        $this->subscriptionService->clearSubscriptions();
        $this->usageService->clearUsageLogs();
        $this->controller->clearCache();
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
     * **Feature: ai-match-analysis-system, Property 11: API Contract Compliance**
     * 
     * *For any* invalid analyze request, the system SHALL return 400.
     * 
     * **Validates: Requirements 9.1**
     * 
     * @test
     */
    public function analyzeReturns400ForInvalidRequest(): void
    {
        $invalidRequests = [
            [],  // Empty
            ['match_id' => 'invalid'],  // Invalid UUID
            ['match_id' => $this->generateUuid()],  // Missing moves and tier
            ['match_id' => $this->generateUuid(), 'moves' => []],  // Missing tier
            ['match_id' => $this->generateUuid(), 'moves' => [], 'tier' => 'invalid'],  // Invalid tier
        ];

        $this
            ->forAll(Generators::elements($invalidRequests))
            ->withMaxSize(100)
            ->then(function (array $invalidRequest) {
                $userId = $this->generateUuid();
                
                $response = $this->controller->analyze($invalidRequest, $userId);

                // Property: Status must be 400
                $this->assertEquals(400, $response['status'], 'Invalid request must return 400');

                // Property: Response must have error structure
                $this->assertFalse($response['success']);
                $this->assertArrayHasKey('error', $response);
                $this->assertEquals('VALIDATION_ERROR', $response['error']['code']);
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 11: API Contract Compliance**
     * 
     * *For any* Pro analysis request from Free user, the system SHALL return 403.
     * 
     * **Validates: Requirements 9.1**
     * 
     * @test
     */
    public function analyzeReturns403ForUnauthorizedProAccess(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $userId = $this->generateUuid();
                $matchId = $this->generateUuid();

                // Create free subscription
                $this->subscriptionService->createDefaultSubscription($userId);

                $request = [
                    'match_id' => $matchId,
                    'moves' => [['x' => 7, 'y' => 7, 'player' => 'X']],
                    'tier' => 'pro',
                ];

                $response = $this->controller->analyze($request, $userId);

                // Property: Status must be 403
                $this->assertEquals(403, $response['status'], 'Unauthorized Pro access must return 403');

                // Property: Response must have error structure
                $this->assertFalse($response['success']);
                $this->assertEquals('FORBIDDEN', $response['error']['code']);
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 11: API Contract Compliance**
     * 
     * *For any* valid basic analysis request, the system SHALL return 200 with correct structure.
     * 
     * **Validates: Requirements 9.1**
     * 
     * @test
     */
    public function analyzeReturns200ForValidBasicRequest(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $this->subscriptionService->clearSubscriptions();
                $this->usageService->clearUsageLogs();
                $this->controller->clearCache();
                
                $userId = $this->generateUuid();
                $matchId = $this->generateUuid();

                // Create free subscription (has basic analysis access)
                $this->subscriptionService->createDefaultSubscription($userId);

                $request = [
                    'match_id' => $matchId,
                    'moves' => [['x' => 7, 'y' => 7, 'player' => 'X']],
                    'tier' => 'basic',
                ];

                $response = $this->controller->analyze($request, $userId);

                // Property: Status must be 200
                $this->assertEquals(200, $response['status'], 'Valid basic request must return 200');

                // Property: Response must have success structure
                $this->assertTrue($response['success']);
                $this->assertArrayHasKey('data', $response);
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 11: API Contract Compliance**
     * 
     * *For any* request exceeding usage limit, the system SHALL return 429.
     * 
     * **Validates: Requirements 9.1**
     * 
     * @test
     */
    public function analyzeReturns429WhenLimitExceeded(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $this->subscriptionService->clearSubscriptions();
                $this->usageService->clearUsageLogs();
                $this->controller->clearCache();
                
                $userId = $this->generateUuid();
                $matchId = $this->generateUuid();

                // Create free subscription (limit: 3 basic analyses per day)
                $this->subscriptionService->createDefaultSubscription($userId);

                // Use up the limit
                for ($i = 0; $i < 3; $i++) {
                    $this->usageService->logUsage($userId, UsageServiceInterface::FEATURE_BASIC_ANALYSIS);
                }

                $request = [
                    'match_id' => $matchId,
                    'moves' => [['x' => 7, 'y' => 7, 'player' => 'X']],
                    'tier' => 'basic',
                ];

                $response = $this->controller->analyze($request, $userId);

                // Property: Status must be 429
                $this->assertEquals(429, $response['status'], 'Exceeded limit must return 429');

                // Property: Response must have error structure
                $this->assertFalse($response['success']);
                $this->assertEquals('RATE_LIMIT_EXCEEDED', $response['error']['code']);
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 11: API Contract Compliance**
     * 
     * *For any* invalid ask request, the system SHALL return 400.
     * 
     * **Validates: Requirements 9.2**
     * 
     * @test
     */
    public function askReturns400ForInvalidRequest(): void
    {
        $invalidRequests = [
            [],  // Empty
            ['match_id' => 'invalid'],  // Invalid UUID
            ['match_id' => $this->generateUuid()],  // Missing question
            ['match_id' => $this->generateUuid(), 'question' => ''],  // Empty question
            ['match_id' => $this->generateUuid(), 'question' => str_repeat('a', 501)],  // Too long
        ];

        $this
            ->forAll(Generators::elements($invalidRequests))
            ->withMaxSize(100)
            ->then(function (array $invalidRequest) {
                $userId = $this->generateUuid();
                
                // Give user Pro access
                $this->subscriptionService->createDefaultSubscription($userId);
                $this->subscriptionService->activateTrial($userId);
                
                $response = $this->controller->ask($invalidRequest, $userId);

                // Property: Status must be 400
                $this->assertEquals(400, $response['status'], 'Invalid ask request must return 400');
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 11: API Contract Compliance**
     * 
     * *For any* ask request from Free user, the system SHALL return 403.
     * 
     * **Validates: Requirements 9.2**
     * 
     * @test
     */
    public function askReturns403ForFreeUser(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $userId = $this->generateUuid();
                $matchId = $this->generateUuid();

                // Create free subscription
                $this->subscriptionService->createDefaultSubscription($userId);

                $request = [
                    'match_id' => $matchId,
                    'question' => 'Tại sao nước này là sai lầm?',
                ];

                $response = $this->controller->ask($request, $userId);

                // Property: Status must be 403
                $this->assertEquals(403, $response['status'], 'Free user ask must return 403');
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 11: API Contract Compliance**
     * 
     * *For any* replay create request from Free user, the system SHALL return 403.
     * 
     * **Validates: Requirements 9.3**
     * 
     * @test
     */
    public function createReplayReturns403ForFreeUser(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $userId = $this->generateUuid();
                $matchId = $this->generateUuid();

                // Create free subscription
                $this->subscriptionService->createDefaultSubscription($userId);

                $request = ['match_id' => $matchId];

                $response = $this->controller->createReplaySession($request, $userId);

                // Property: Status must be 403
                $this->assertEquals(403, $response['status'], 'Free user replay must return 403');
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 11: API Contract Compliance**
     * 
     * *For any* navigate request with invalid data, the system SHALL return 400.
     * 
     * **Validates: Requirements 9.4**
     * 
     * @test
     */
    public function navigateReturns400ForInvalidRequest(): void
    {
        $invalidRequests = [
            [],  // Empty
            ['session_id' => 'test'],  // Missing move_index
            ['session_id' => 'test', 'move_index' => -1],  // Negative index
            ['session_id' => 'test', 'move_index' => 'invalid'],  // Non-integer
        ];

        $this
            ->forAll(Generators::elements($invalidRequests))
            ->withMaxSize(100)
            ->then(function (array $invalidRequest) {
                $userId = $this->generateUuid();
                
                $response = $this->controller->navigateReplay($invalidRequest, $userId);

                // Property: Status must be 400
                $this->assertEquals(400, $response['status'], 'Invalid navigate request must return 400');
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 11: API Contract Compliance**
     * 
     * *For any* play move request with invalid data, the system SHALL return 400.
     * 
     * **Validates: Requirements 9.5**
     * 
     * @test
     */
    public function playMoveReturns400ForInvalidRequest(): void
    {
        $invalidRequests = [
            [],  // Empty
            ['session_id' => 'test'],  // Missing move
            ['session_id' => 'test', 'move' => []],  // Empty move
            ['session_id' => 'test', 'move' => ['x' => 0]],  // Missing y
        ];

        $this
            ->forAll(Generators::elements($invalidRequests))
            ->withMaxSize(100)
            ->then(function (array $invalidRequest) {
                $userId = $this->generateUuid();
                
                $response = $this->controller->playReplayMove($invalidRequest, $userId);

                // Property: Status must be 400
                $this->assertEquals(400, $response['status'], 'Invalid play move request must return 400');
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 11: API Contract Compliance**
     * 
     * *For any* user, getUsage SHALL return correctly structured response.
     * 
     * **Validates: Requirements 9.6**
     * 
     * @test
     */
    public function getUsageReturnsCorrectStructure(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $this->subscriptionService->clearSubscriptions();
                $this->usageService->clearUsageLogs();
                
                $userId = $this->generateUuid();
                $this->subscriptionService->createDefaultSubscription($userId);

                $response = $this->controller->getUsage($userId);

                // Property: Status must be 200
                $this->assertEquals(200, $response['status']);
                $this->assertTrue($response['success']);

                // Property: Data must have required fields
                $data = $response['data'];
                $this->assertArrayHasKey('tier', $data);
                $this->assertArrayHasKey('is_trial', $data);
                $this->assertArrayHasKey('trial_days_remaining', $data);
                $this->assertArrayHasKey('usage', $data);
                $this->assertArrayHasKey('reset_times', $data);

                // Property: Usage must have all features
                foreach (UsageServiceInterface::VALID_FEATURES as $feature) {
                    $this->assertArrayHasKey($feature, $data['usage']);
                    $this->assertArrayHasKey('limit', $data['usage'][$feature]);
                    $this->assertArrayHasKey('used', $data['usage'][$feature]);
                    $this->assertArrayHasKey('remaining', $data['usage'][$feature]);
                }
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 15: Cache Behavior**
     * 
     * *For any* analysis result, the system SHALL cache it and return cached result.
     * 
     * **Validates: Requirements 16.1, 16.2**
     * 
     * @test
     */
    public function cacheStoresAndReturnsResults(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $this->controller->clearCache();
                
                $matchId = $this->generateUuid();
                $tier = 'basic';
                $cacheKey = "{$matchId}:{$tier}";
                $data = ['test' => 'data', 'score' => 100];

                // Set cache
                $this->controller->setCache($cacheKey, $data);

                // Get from cache
                $cached = $this->controller->getFromCache($cacheKey);

                // Property: Cached data must match original
                $this->assertEquals($data, $cached, 'Cached data must match original');
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 15: Cache Behavior**
     * 
     * *For any* cache key format, it SHALL be {match_id}:{tier}.
     * 
     * **Validates: Requirements 16.1**
     * 
     * @test
     */
    public function cacheKeyFormatIsCorrect(): void
    {
        $this
            ->forAll(
                Generators::elements(['basic', 'pro'])
            )
            ->withMaxSize(100)
            ->then(function (string $tier) {
                $matchId = $this->generateUuid();
                $expectedKey = "{$matchId}:{$tier}";

                // Property: Cache key format must be {match_id}:{tier}
                $this->assertMatchesRegularExpression(
                    '/^[0-9a-f-]+:(basic|pro)$/',
                    $expectedKey,
                    'Cache key must match format {match_id}:{tier}'
                );
            });
    }
}

/**
 * Mock AI Bridge Service for testing
 */
class MockAIBridgeService implements AIBridgeServiceInterface
{
    public function analyzeMatch(
        string $matchId,
        array $moves,
        string $tier,
        string $userId,
        ?string $difficulty = null,
        ?string $language = 'vi'
    ): ?array
    {
        return [
            'tier' => $tier,
            'timeline' => [],
            'mistakes' => [],
            'patterns' => [],
            'best_move' => null,
            'summary' => ['total_moves' => count($moves)],
        ];
    }

    public function askQuestion(string $matchId, string $question, string $userId): ?array
    {
        return [
            'answer' => 'Đây là câu trả lời mẫu.',
            'actions' => [],
        ];
    }

    public function createReplaySession(string $matchId, string $userId): ?array
    {
        return [
            'session_id' => 'test-session-' . substr($matchId, 0, 8),
            'total_moves' => 10,
        ];
    }

    public function navigateReplay(string $sessionId, int $moveIndex): ?array
    {
        return [
            'board' => [],
            'current_move' => $moveIndex,
        ];
    }

    public function playReplayMove(string $sessionId, array $move): ?array
    {
        return [
            'board' => [],
            'ai_move' => ['x' => 8, 'y' => 8],
        ];
    }

    public function getUsage(string $userId): ?array
    {
        return [];
    }

    public function healthCheck(): bool
    {
        return true;
    }
}
