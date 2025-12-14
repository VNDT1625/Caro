<?php

namespace App\Services;

use Exception;

/**
 * AIBridgeService
 * 
 * Handles HTTP communication with the Python AI analysis service.
 * Implements timeouts, retries, and graceful error handling.
 * 
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 16.1**
 */
class AIBridgeService implements AIBridgeServiceInterface
{
    /**
     * Base URL of the Python AI service
     */
    private string $baseUrl;

    /**
     * Request timeout in seconds
     */
    private int $timeoutSeconds;

    /**
     * Connection timeout in seconds
     */
    private int $connectTimeoutSeconds;

    /**
     * Maximum retry attempts
     */
    private int $maxRetries;

    /**
     * Retry delay in milliseconds (base for exponential backoff)
     */
    private int $retryDelayMs;

    /**
     * Logger callback for errors
     */
    private $errorLogger;

    public function __construct(
        string $baseUrl = '',
        int $timeoutSeconds = 20,
        int $connectTimeoutSeconds = 5,
        int $maxRetries = 3,
        int $retryDelayMs = 500,
        ?callable $errorLogger = null
    ) {
        $this->baseUrl = $baseUrl ?: (getenv('AI_SERVICE_URL') ?: 'http://localhost:8004');
        $this->timeoutSeconds = $timeoutSeconds ?: (int)(getenv('AI_TIMEOUT_SECONDS') ?: 20);
        $this->connectTimeoutSeconds = $connectTimeoutSeconds;
        $this->maxRetries = $maxRetries;
        $this->retryDelayMs = $retryDelayMs;
        $this->errorLogger = $errorLogger;
    }

    /**
     * {@inheritdoc}
     * 
     * Requirements: 4.1 - Multi-language support
     */
    public function analyzeMatch(
        string $matchId,
        array $moves,
        string $tier,
        string $userId,
        ?string $difficulty = null,
        ?string $language = 'vi'
    ): ?array {
        $payload = [
            'match_id' => $matchId,
            'moves' => $moves,
            'tier' => $tier,
            'user_id' => $userId,
            'language' => $language ?? 'vi',
        ];

        if ($difficulty !== null) {
            $payload['difficulty'] = $difficulty;
        }

        $result = $this->post('/analyze', $payload);
        
        // Handle error codes from AI service
        if ($result === null) {
            return null;
        }
        
        // Check for error response
        if (isset($result['code']) && isset($result['message'])) {
            // Return error response with proper structure
            return [
                'success' => false,
                'error' => [
                    'code' => $result['code'],
                    'message' => $result['message'],
                    'details' => $result['details'] ?? null,
                ],
            ];
        }
        
        return $result;
    }

    /**
     * {@inheritdoc}
     */
    public function askQuestion(
        string $matchId,
        string $question,
        string $userId
    ): ?array {
        return $this->post('/ask', [
            'match_id' => $matchId,
            'question' => $question,
            'user_id' => $userId,
        ]);
    }

    /**
     * {@inheritdoc}
     */
    public function createReplaySession(
        string $matchId,
        string $userId
    ): ?array {
        return $this->post('/replay/create', [
            'match_id' => $matchId,
            'user_id' => $userId,
        ]);
    }

    /**
     * {@inheritdoc}
     */
    public function navigateReplay(
        string $sessionId,
        int $moveIndex
    ): ?array {
        return $this->post('/replay/navigate', [
            'session_id' => $sessionId,
            'move_index' => $moveIndex,
        ]);
    }

    /**
     * {@inheritdoc}
     */
    public function playReplayMove(
        string $sessionId,
        array $move
    ): ?array {
        return $this->post('/replay/play', [
            'session_id' => $sessionId,
            'move' => $move,
        ]);
    }

    /**
     * {@inheritdoc}
     */
    public function getUsage(string $userId): ?array
    {
        return $this->get('/usage', ['user_id' => $userId]);
    }

    /**
     * {@inheritdoc}
     */
    public function healthCheck(): bool
    {
        try {
            $result = $this->get('/health', [], 1, 5);
            return $result !== null && ($result['status'] ?? '') === 'ok';
        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Make a POST request to the Python service.
     * 
     * @param string $endpoint API endpoint
     * @param array $payload Request body
     * @param int|null $maxRetries Override max retries
     * @param int|null $timeout Override timeout
     * @return array|null Response data or null on failure
     */
    protected function post(
        string $endpoint,
        array $payload,
        ?int $maxRetries = null,
        ?int $timeout = null
    ): ?array {
        return $this->request('POST', $endpoint, $payload, $maxRetries, $timeout);
    }

    /**
     * Make a GET request to the Python service.
     * 
     * @param string $endpoint API endpoint
     * @param array $params Query parameters
     * @param int|null $maxRetries Override max retries
     * @param int|null $timeout Override timeout
     * @return array|null Response data or null on failure
     */
    protected function get(
        string $endpoint,
        array $params = [],
        ?int $maxRetries = null,
        ?int $timeout = null
    ): ?array {
        return $this->request('GET', $endpoint, $params, $maxRetries, $timeout);
    }

    /**
     * Make an HTTP request with retry logic.
     * 
     * @param string $method HTTP method
     * @param string $endpoint API endpoint
     * @param array $data Request data (body for POST, query params for GET)
     * @param int|null $maxRetries Override max retries
     * @param int|null $timeout Override timeout
     * @return array|null Response data or null on failure
     */
    protected function request(
        string $method,
        string $endpoint,
        array $data = [],
        ?int $maxRetries = null,
        ?int $timeout = null
    ): ?array {
        $maxRetries = $maxRetries ?? $this->maxRetries;
        $timeout = $timeout ?? $this->timeoutSeconds;
        $lastError = null;

        for ($attempt = 0; $attempt < $maxRetries; $attempt++) {
            try {
                $result = $this->executeRequest($method, $endpoint, $data, $timeout);
                
                if ($result !== null) {
                    return $result;
                }
            } catch (Exception $e) {
                $lastError = $e;
                $this->logError("Request attempt {$attempt} failed: " . $e->getMessage(), [
                    'endpoint' => $endpoint,
                    'method' => $method,
                    'attempt' => $attempt + 1,
                ]);
            }

            // Exponential backoff before retry
            if ($attempt < $maxRetries - 1) {
                $delay = $this->retryDelayMs * pow(2, $attempt);
                usleep($delay * 1000);
            }
        }

        $this->logError("All {$maxRetries} attempts failed for {$method} {$endpoint}", [
            'last_error' => $lastError ? $lastError->getMessage() : 'Unknown',
        ]);

        return null;
    }

    /**
     * Execute a single HTTP request.
     * 
     * @param string $method HTTP method
     * @param string $endpoint API endpoint
     * @param array $data Request data
     * @param int $timeout Request timeout
     * @return array|null Response data or null on failure
     * @throws Exception On network or parsing errors
     */
    protected function executeRequest(
        string $method,
        string $endpoint,
        array $data,
        int $timeout
    ): ?array {
        $url = rtrim($this->baseUrl, '/') . '/' . ltrim($endpoint, '/');

        if ($method === 'GET' && !empty($data)) {
            $url .= '?' . http_build_query($data);
        }

        $ch = curl_init($url);
        
        if ($ch === false) {
            throw new Exception('Failed to initialize cURL');
        }

        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => $this->connectTimeoutSeconds,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
            ],
        ];

        if ($method === 'POST') {
            $options[CURLOPT_POST] = true;
            $options[CURLOPT_POSTFIELDS] = json_encode($data);
        }

        curl_setopt_array($ch, $options);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        $curlErrno = curl_errno($ch);
        
        curl_close($ch);

        // Handle timeout
        if ($curlErrno === CURLE_OPERATION_TIMEDOUT) {
            throw new Exception("Request timeout after {$timeout}s");
        }

        // Handle network errors
        if ($curlErrno !== 0) {
            throw new Exception("Network error: {$curlError} (errno: {$curlErrno})");
        }

        // Handle HTTP errors
        if ($httpCode >= 400) {
            $errorData = json_decode($response, true);
            $errorMessage = $errorData['error'] ?? $errorData['detail'] ?? "HTTP {$httpCode}";
            
            // Don't retry client errors (4xx)
            if ($httpCode >= 400 && $httpCode < 500) {
                $this->logError("Client error: {$errorMessage}", [
                    'http_code' => $httpCode,
                    'response' => $response,
                ]);
                return null;
            }
            
            throw new Exception("Server error: {$errorMessage} (HTTP {$httpCode})");
        }

        // Parse response
        $result = json_decode($response, true);
        
        if ($result === null && $response !== 'null') {
            throw new Exception('Failed to parse JSON response');
        }

        return $result;
    }

    /**
     * Log an error message.
     * 
     * @param string $message Error message
     * @param array $context Additional context
     */
    protected function logError(string $message, array $context = []): void
    {
        if ($this->errorLogger !== null) {
            ($this->errorLogger)($message, $context);
        }
        error_log("AIBridgeService Error: {$message} " . json_encode($context));
    }

    /**
     * Get the base URL of the Python service.
     * 
     * @return string Base URL
     */
    public function getBaseUrl(): string
    {
        return $this->baseUrl;
    }

    /**
     * Set the base URL of the Python service.
     * 
     * @param string $baseUrl New base URL
     */
    public function setBaseUrl(string $baseUrl): void
    {
        $this->baseUrl = $baseUrl;
    }
}
