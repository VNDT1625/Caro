<?php

namespace App\Controllers;

use App\Services\AIBridgeServiceInterface;
use App\Services\SubscriptionServiceInterface;
use App\Services\UsageServiceInterface;
use InvalidArgumentException;
use RuntimeException;

/**
 * AnalysisController
 * 
 * Handles HTTP requests for the AI Match Analysis system.
 * Provides endpoints for analysis, Q&A, replay, and usage tracking.
 * 
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**
 * 
 * **Property 11: API Contract Compliance**
 * - Validates request structure and returns 400 for invalid requests
 * - Checks tier permissions and returns 403 for unauthorized access
 * - Returns correctly structured responses matching the defined schemas
 * - Returns appropriate error codes (400, 403, 429, 500) without exposing internal details
 */
class AnalysisController
{
    private AIBridgeServiceInterface $aiBridge;
    private SubscriptionServiceInterface $subscriptionService;
    private UsageServiceInterface $usageService;

    /**
     * In-memory cache for testing
     * @var array
     */
    private array $cache = [];

    /**
     * Cache TTL in seconds (1 hour)
     */
    private const CACHE_TTL = 3600;

    public function __construct(
        AIBridgeServiceInterface $aiBridge,
        SubscriptionServiceInterface $subscriptionService,
        UsageServiceInterface $usageService
    ) {
        $this->aiBridge = $aiBridge;
        $this->subscriptionService = $subscriptionService;
        $this->usageService = $usageService;
    }

    /**
     * POST /api/analysis/analyze - Analyze a match
     * 
     * Request body:
     * - match_id: string (required) - UUID of the match
     * - moves: array (required) - List of moves [{x, y, player}, ...]
     * - tier: string (required) - 'basic' or 'pro'
     * - difficulty: string (optional) - Training difficulty
     * 
     * **Validates: Requirements 9.1**
     * 
     * @param array $requestData Request body data
     * @param string $userId UUID of the authenticated user
     * @return array Response with analysis results or error
     */
    public function analyze(array $requestData, string $userId): array
    {
        try {
            // Validate request
            $validation = $this->validateAnalyzeRequest($requestData);
            if (!$validation['valid']) {
                return $this->errorResponse('VALIDATION_ERROR', 'Dữ liệu không hợp lệ', $validation['errors'], 400);
            }

            $matchId = $requestData['match_id'];
            $moves = $requestData['moves'];
            $tier = $requestData['tier'];
            $difficulty = $requestData['difficulty'] ?? null;

            // Check tier permissions
            if ($tier === 'pro' && !$this->subscriptionService->hasAccess($userId, SubscriptionServiceInterface::TIER_TRIAL)) {
                return $this->errorResponse('FORBIDDEN', 'Cần nâng cấp lên Pro để sử dụng tính năng này', [], 403);
            }

            // Check usage limits
            $feature = $tier === 'pro' ? UsageServiceInterface::FEATURE_PRO_ANALYSIS : UsageServiceInterface::FEATURE_BASIC_ANALYSIS;
            $userTier = $this->subscriptionService->getTier($userId);
            $limit = $this->subscriptionService->getLimit($userId, $feature);
            
            // Determine if daily or monthly limit applies
            $isMonthlyLimit = in_array($userTier, [SubscriptionServiceInterface::TIER_PRO, SubscriptionServiceInterface::TIER_PRO_PLUS]);
            $currentUsage = $isMonthlyLimit 
                ? $this->usageService->getMonthlyUsage($userId, $feature)
                : $this->usageService->getDailyUsage($userId, $feature);

            if (!$this->subscriptionService->canUseFeature($userId, $feature, $currentUsage)) {
                $resetTime = $isMonthlyLimit 
                    ? $this->usageService->getTimeUntilMonthlyReset()
                    : $this->usageService->getTimeUntilDailyReset();
                
                return $this->errorResponse(
                    'RATE_LIMIT_EXCEEDED',
                    'Đã đạt giới hạn sử dụng. Vui lòng thử lại sau.',
                    ['reset_in_seconds' => $resetTime],
                    429
                );
            }

            // Check cache
            $cacheKey = "{$matchId}:{$tier}";
            $cached = $this->getFromCache($cacheKey);
            if ($cached !== null) {
                return $this->successResponse($cached, 'Kết quả phân tích (từ cache)');
            }

            // Call Python AI service
            $result = $this->aiBridge->analyzeMatch($matchId, $moves, $tier, $userId, $difficulty);

            if ($result === null) {
                return $this->errorResponse('SERVICE_UNAVAILABLE', 'Dịch vụ phân tích tạm thời không khả dụng', [], 503);
            }

            // Log usage
            $this->usageService->logUsage($userId, $feature);

            // Cache result
            $this->setCache($cacheKey, $result);

            return $this->successResponse($result, 'Phân tích hoàn tất');

        } catch (RuntimeException $e) {
            return $this->errorResponse('SERVER_ERROR', 'Lỗi hệ thống', [], 500);
        }
    }

    /**
     * POST /api/analysis/ask - Ask a question about a match
     * 
     * Request body:
     * - match_id: string (required) - UUID of the match
     * - question: string (required) - User's question
     * 
     * **Validates: Requirements 9.2**
     * 
     * @param array $requestData Request body data
     * @param string $userId UUID of the authenticated user
     * @return array Response with AI answer or error
     */
    public function ask(array $requestData, string $userId): array
    {
        try {
            // Validate request
            $validation = $this->validateAskRequest($requestData);
            if (!$validation['valid']) {
                return $this->errorResponse('VALIDATION_ERROR', 'Dữ liệu không hợp lệ', $validation['errors'], 400);
            }

            // Check Pro subscription
            if (!$this->subscriptionService->hasAccess($userId, SubscriptionServiceInterface::TIER_TRIAL)) {
                return $this->errorResponse('FORBIDDEN', 'Cần nâng cấp lên Pro để sử dụng tính năng hỏi đáp AI', [], 403);
            }

            // Check usage limits
            $feature = UsageServiceInterface::FEATURE_AI_QA;
            $userTier = $this->subscriptionService->getTier($userId);
            $limit = $this->subscriptionService->getLimit($userId, $feature);
            
            $isMonthlyLimit = in_array($userTier, [SubscriptionServiceInterface::TIER_PRO, SubscriptionServiceInterface::TIER_PRO_PLUS]);
            $currentUsage = $isMonthlyLimit 
                ? $this->usageService->getMonthlyUsage($userId, $feature)
                : $this->usageService->getDailyUsage($userId, $feature);

            if (!$this->subscriptionService->canUseFeature($userId, $feature, $currentUsage)) {
                $resetTime = $isMonthlyLimit 
                    ? $this->usageService->getTimeUntilMonthlyReset()
                    : $this->usageService->getTimeUntilDailyReset();
                
                return $this->errorResponse(
                    'RATE_LIMIT_EXCEEDED',
                    'Đã đạt giới hạn câu hỏi. Vui lòng thử lại sau.',
                    ['reset_in_seconds' => $resetTime],
                    429
                );
            }

            // Call Python AI service
            $result = $this->aiBridge->askQuestion(
                $requestData['match_id'],
                $requestData['question'],
                $userId
            );

            if ($result === null) {
                return $this->errorResponse('SERVICE_UNAVAILABLE', 'Dịch vụ AI tạm thời không khả dụng', [], 503);
            }

            // Log usage
            $this->usageService->logUsage($userId, $feature);

            return $this->successResponse($result, 'Trả lời thành công');

        } catch (RuntimeException $e) {
            return $this->errorResponse('SERVER_ERROR', 'Lỗi hệ thống', [], 500);
        }
    }

    /**
     * POST /api/analysis/replay/create - Create a replay session
     * 
     * Request body:
     * - match_id: string (required) - UUID of the match
     * 
     * **Validates: Requirements 9.3**
     * 
     * @param array $requestData Request body data
     * @param string $userId UUID of the authenticated user
     * @return array Response with session info or error
     */
    public function createReplaySession(array $requestData, string $userId): array
    {
        try {
            // Validate request
            if (empty($requestData['match_id']) || !$this->isValidUuid($requestData['match_id'])) {
                return $this->errorResponse('VALIDATION_ERROR', 'match_id không hợp lệ', [], 400);
            }

            // Check Pro subscription
            if (!$this->subscriptionService->hasAccess($userId, SubscriptionServiceInterface::TIER_TRIAL)) {
                return $this->errorResponse('FORBIDDEN', 'Cần nâng cấp lên Pro để sử dụng tính năng replay', [], 403);
            }

            // Check usage limits
            $feature = UsageServiceInterface::FEATURE_REPLAY;
            $userTier = $this->subscriptionService->getTier($userId);
            
            $isMonthlyLimit = in_array($userTier, [SubscriptionServiceInterface::TIER_PRO, SubscriptionServiceInterface::TIER_PRO_PLUS]);
            $currentUsage = $isMonthlyLimit 
                ? $this->usageService->getMonthlyUsage($userId, $feature)
                : $this->usageService->getDailyUsage($userId, $feature);

            if (!$this->subscriptionService->canUseFeature($userId, $feature, $currentUsage)) {
                return $this->errorResponse('RATE_LIMIT_EXCEEDED', 'Đã đạt giới hạn replay', [], 429);
            }

            // Call Python AI service
            $result = $this->aiBridge->createReplaySession($requestData['match_id'], $userId);

            if ($result === null) {
                return $this->errorResponse('SERVICE_UNAVAILABLE', 'Dịch vụ replay tạm thời không khả dụng', [], 503);
            }

            // Log usage
            $this->usageService->logUsage($userId, $feature);

            return $this->successResponse($result, 'Tạo phiên replay thành công');

        } catch (RuntimeException $e) {
            return $this->errorResponse('SERVER_ERROR', 'Lỗi hệ thống', [], 500);
        }
    }

    /**
     * POST /api/analysis/replay/navigate - Navigate to a specific move
     * 
     * Request body:
     * - session_id: string (required) - Replay session ID
     * - move_index: int (required) - Move index to navigate to
     * 
     * **Validates: Requirements 9.4**
     * 
     * @param array $requestData Request body data
     * @param string $userId UUID of the authenticated user
     * @return array Response with board state or error
     */
    public function navigateReplay(array $requestData, string $userId): array
    {
        try {
            // Validate request
            if (empty($requestData['session_id'])) {
                return $this->errorResponse('VALIDATION_ERROR', 'session_id là bắt buộc', [], 400);
            }
            if (!isset($requestData['move_index']) || !is_int($requestData['move_index']) || $requestData['move_index'] < 0) {
                return $this->errorResponse('VALIDATION_ERROR', 'move_index không hợp lệ', [], 400);
            }

            // Call Python AI service
            $result = $this->aiBridge->navigateReplay($requestData['session_id'], $requestData['move_index']);

            if ($result === null) {
                return $this->errorResponse('SERVICE_UNAVAILABLE', 'Dịch vụ replay tạm thời không khả dụng', [], 503);
            }

            return $this->successResponse($result);

        } catch (RuntimeException $e) {
            return $this->errorResponse('SERVER_ERROR', 'Lỗi hệ thống', [], 500);
        }
    }

    /**
     * POST /api/analysis/replay/play - Play an alternative move
     * 
     * Request body:
     * - session_id: string (required) - Replay session ID
     * - move: object (required) - Move to play {x, y}
     * 
     * **Validates: Requirements 9.5**
     * 
     * @param array $requestData Request body data
     * @param string $userId UUID of the authenticated user
     * @return array Response with updated state or error
     */
    public function playReplayMove(array $requestData, string $userId): array
    {
        try {
            // Validate request
            if (empty($requestData['session_id'])) {
                return $this->errorResponse('VALIDATION_ERROR', 'session_id là bắt buộc', [], 400);
            }
            if (empty($requestData['move']) || !isset($requestData['move']['x']) || !isset($requestData['move']['y'])) {
                return $this->errorResponse('VALIDATION_ERROR', 'move không hợp lệ (cần x và y)', [], 400);
            }

            // Call Python AI service
            $result = $this->aiBridge->playReplayMove($requestData['session_id'], $requestData['move']);

            if ($result === null) {
                return $this->errorResponse('SERVICE_UNAVAILABLE', 'Dịch vụ replay tạm thời không khả dụng', [], 503);
            }

            return $this->successResponse($result);

        } catch (RuntimeException $e) {
            return $this->errorResponse('SERVER_ERROR', 'Lỗi hệ thống', [], 500);
        }
    }

    /**
     * GET /api/analysis/usage - Get usage information
     * 
     * **Validates: Requirements 9.6**
     * 
     * @param string $userId UUID of the authenticated user
     * @return array Response with usage info
     */
    public function getUsage(string $userId): array
    {
        try {
            $tier = $this->subscriptionService->getTier($userId);
            $subscription = $this->subscriptionService->getSubscription($userId);
            $usageSummary = $this->usageService->getUsageSummary($userId);

            // Calculate remaining for each feature
            $remaining = [];
            foreach (UsageServiceInterface::VALID_FEATURES as $feature) {
                $limit = $this->subscriptionService->getLimit($userId, $feature);
                $isMonthlyLimit = in_array($tier, [SubscriptionServiceInterface::TIER_PRO, SubscriptionServiceInterface::TIER_PRO_PLUS]);
                
                $remaining[$feature] = [
                    'limit' => $limit,
                    'used' => $isMonthlyLimit ? $usageSummary[$feature]['monthly'] : $usageSummary[$feature]['daily'],
                    'remaining' => $isMonthlyLimit 
                        ? $this->usageService->getRemainingMonthly($userId, $feature, $limit)
                        : $this->usageService->getRemainingDaily($userId, $feature, $limit),
                    'period' => $isMonthlyLimit ? 'monthly' : 'daily',
                ];
            }

            $result = [
                'tier' => $tier,
                'is_trial' => $tier === SubscriptionServiceInterface::TIER_TRIAL,
                'trial_days_remaining' => $this->subscriptionService->getTrialDaysRemaining($userId),
                'usage' => $remaining,
                'reset_times' => [
                    'daily' => $this->usageService->getTimeUntilDailyReset(),
                    'monthly' => $this->usageService->getTimeUntilMonthlyReset(),
                ],
            ];

            return $this->successResponse($result);

        } catch (RuntimeException $e) {
            return $this->errorResponse('SERVER_ERROR', 'Lỗi hệ thống', [], 500);
        }
    }

    /**
     * Validate analyze request data.
     */
    private function validateAnalyzeRequest(array $data): array
    {
        $errors = [];

        if (empty($data['match_id']) || !$this->isValidUuid($data['match_id'])) {
            $errors['match_id'] = 'match_id không hợp lệ';
        }

        if (!isset($data['moves']) || !is_array($data['moves'])) {
            $errors['moves'] = 'moves phải là một mảng';
        }

        if (empty($data['tier']) || !in_array($data['tier'], ['basic', 'pro'])) {
            $errors['tier'] = 'tier phải là "basic" hoặc "pro"';
        }

        return ['valid' => empty($errors), 'errors' => $errors];
    }

    /**
     * Validate ask request data.
     */
    private function validateAskRequest(array $data): array
    {
        $errors = [];

        if (empty($data['match_id']) || !$this->isValidUuid($data['match_id'])) {
            $errors['match_id'] = 'match_id không hợp lệ';
        }

        if (empty($data['question']) || !is_string($data['question'])) {
            $errors['question'] = 'question là bắt buộc';
        } elseif (strlen($data['question']) > 500) {
            $errors['question'] = 'question không được vượt quá 500 ký tự';
        }

        return ['valid' => empty($errors), 'errors' => $errors];
    }

    /**
     * Check if a string is a valid UUID.
     */
    private function isValidUuid(string $uuid): bool
    {
        return preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $uuid) === 1;
    }

    /**
     * Create a success response.
     */
    private function successResponse(array $data, ?string $message = null): array
    {
        $response = [
            'success' => true,
            'data' => $data,
            'status' => 200,
        ];
        if ($message !== null) {
            $response['message'] = $message;
        }
        return $response;
    }

    /**
     * Create an error response.
     * 
     * **Validates: Requirements 17.1-17.5**
     * Returns appropriate error codes without exposing internal details
     */
    private function errorResponse(string $code, string $message, array $details, int $status): array
    {
        return [
            'success' => false,
            'error' => [
                'code' => $code,
                'message' => $message,
                'details' => $details,
            ],
            'status' => $status,
        ];
    }

    /**
     * Sanitize string input to prevent injection attacks.
     * 
     * **Validates: Requirements 17.4**
     */
    private function sanitizeString(string $value, int $maxLength = 500): string
    {
        // Remove control characters
        $value = preg_replace('/[\x00-\x1f\x7f-\x9f]/', '', $value);
        // Trim whitespace
        $value = trim($value);
        // Limit length
        return mb_substr($value, 0, $maxLength);
    }

    /**
     * Handle timeout errors from AI service.
     * 
     * **Validates: Requirements 17.3**
     */
    private function handleTimeout(): array
    {
        return $this->errorResponse(
            'TIMEOUT',
            'Yêu cầu đã hết thời gian chờ. Vui lòng thử lại.',
            [],
            504
        );
    }

    /**
     * Get from cache.
     * 
     * **Property 15: Cache Behavior**
     */
    public function getFromCache(string $key): ?array
    {
        if (!isset($this->cache[$key])) {
            return null;
        }

        $entry = $this->cache[$key];
        if (time() > $entry['expires_at']) {
            unset($this->cache[$key]);
            return null;
        }

        return $entry['data'];
    }

    /**
     * Set cache.
     * 
     * **Property 15: Cache Behavior**
     * Cache key format: {match_id}:{tier}, TTL: 1 hour
     */
    public function setCache(string $key, array $data): void
    {
        $this->cache[$key] = [
            'data' => $data,
            'expires_at' => time() + self::CACHE_TTL,
        ];
    }

    /**
     * Clear cache (for testing).
     */
    public function clearCache(): void
    {
        $this->cache = [];
    }
}
