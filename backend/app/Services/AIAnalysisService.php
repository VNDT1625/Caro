<?php

namespace App\Services;

use Exception;

/**
 * AIAnalysisService
 * 
 * Implements AI-based cheat detection using OpenRouter/DeepSeek API.
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 */
class AIAnalysisService implements AIAnalysisServiceInterface
{
    /**
     * AI API URL (OpenRouter)
     */
    private string $apiUrl;

    /**
     * AI API Key
     */
    private string $apiKey;

    /**
     * AI Model to use
     */
    private string $model;

    /**
     * Request timeout in seconds
     */
    private int $timeoutSeconds;

    /**
     * Logger callback for errors
     */
    private $errorLogger;

    public function __construct(
        string $apiUrl = '',
        string $apiKey = '',
        string $model = 'deepseek/deepseek-chat',
        int $timeoutSeconds = 30,
        ?callable $errorLogger = null
    ) {
        // Support multiple env variable names for flexibility
        $this->apiUrl = $apiUrl ?: (getenv('AI_API_URL') ?: getenv('VITE_AI_URL') ?: 'https://openrouter.ai/api/v1/chat/completions');
        $this->apiKey = $apiKey ?: (getenv('AI_API_KEY') ?: getenv('VITE_AI_API_KEY') ?: getenv('AI_OpenSource_Key') ?: '');
        $this->model = $model ?: (getenv('AI_MODEL') ?: getenv('VITE_AI_MODEL') ?: getenv('AI_model') ?: 'deepseek/deepseek-chat');
        $this->timeoutSeconds = $timeoutSeconds ?: (int)(getenv('AI_TIMEOUT_SECONDS') ?: 30);
        $this->errorLogger = $errorLogger;
    }


    /**
     * {@inheritdoc}
     * 
     * Analyzes a cheat report by:
     * 1. Building a prompt with match data and rule-based findings
     * 2. Calling the AI model
     * 3. Validating and parsing the response
     * 
     * Returns null if AI fails (timeout, invalid response, network error).
     * In this case, the report should be escalated for manual review.
     */
    public function analyzeCheatReport(array $information, string $reasonResult): ?AIAnalysisResult
    {
        try {
            $prompt = $this->buildPrompt($information, $reasonResult);
            $response = $this->callAIModel($prompt);
            
            if ($response === null) {
                return null;
            }

            if (!$this->validateResponse($response)) {
                $this->logError('AI response validation failed', ['response' => $response]);
                return null;
            }

            return AIAnalysisResult::fromArray($response);
        } catch (Exception $e) {
            $this->logError('AI analysis failed: ' . $e->getMessage(), [
                'exception' => get_class($e),
                'trace' => $e->getTraceAsString(),
            ]);
            return null;
        }
    }

    /**
     * {@inheritdoc}
     * 
     * Builds a structured prompt for the AI model including:
     * - Match data (players, moves, timestamps)
     * - Rule-based analysis findings
     * - Expected response format
     */
    public function buildPrompt(array $information, string $reasonResult): string
    {
        $matchDataJson = json_encode($information, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        
        $prompt = <<<PROMPT
Bạn là hệ thống AI phân tích gian lận trong game Cờ Caro online.

## Dữ liệu trận đấu:
```json
{$matchDataJson}
```

## Kết quả phân tích rule-based:
{$reasonResult}

## Quy tắc phân tích:
- Nếu rule-based phát hiện "nhiều nước đi liên tiếp" của cùng 1 người chơi → ĐÂY LÀ GIAN LẬN (report_result = "co")
- Nếu rule-based phát hiện "cả hai người chơi đều có điều kiện thắng" → ĐÂY LÀ GIAN LẬN (report_result = "co")
- Nếu rule-based phát hiện timing bất thường (< 100ms) → ĐÂY LÀ GIAN LẬN (report_result = "co")
- Nếu rule-based KHÔNG phát hiện bất thường → KHÔNG GIAN LẬN (report_result = "khong")

## QUAN TRỌNG:
- report_result PHẢI NHẤT QUÁN với nội dung summary và details
- Nếu report_result = "co" → summary và details phải mô tả vi phạm
- Nếu report_result = "khong" → summary và details phải nói không có vi phạm

## Format response (JSON):
{
  "report_result": "co" hoặc "khong",
  "summary_for_player": "Tóm tắt cho người chơi",
  "details_for_admin": "Chi tiết cho admin"
}

Chỉ trả về JSON.
PROMPT;

        return $prompt;
    }

    /**
     * {@inheritdoc}
     * 
     * **Property 10: AI Response Validation**
     * Validates that the response contains all required fields with correct types.
     */
    public function validateResponse(array $response): bool
    {
        return AIAnalysisResult::isValidData(
            $response['report_result'] ?? null,
            $response['summary_for_player'] ?? null,
            $response['details_for_admin'] ?? null
        );
    }

    /**
     * Call the AI model API.
     * 
     * @param string $prompt The prompt to send
     * @return array|null Parsed JSON response, or null on failure
     */
    protected function callAIModel(string $prompt): ?array
    {
        if (empty($this->apiKey)) {
            $this->logError('AI API key not configured');
            return null;
        }

        $payload = [
            'model' => $this->model,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Bạn là hệ thống AI phân tích gian lận game. Luôn trả về JSON theo format được yêu cầu.'
                ],
                [
                    'role' => 'user',
                    'content' => $prompt
                ]
            ],
            'temperature' => 0.1,
            'max_tokens' => 1000,
        ];

        $ch = curl_init($this->apiUrl);
        
        if ($ch === false) {
            $this->logError('Failed to initialize cURL');
            return null;
        }

        // Check if SSL verification should be skipped (Windows dev environment)
        $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
        $skipSslRaw = getenv('SUPABASE_SKIP_SSL_VERIFY');
        $skipSsl = $isWindows || $skipSslRaw === '1' || $skipSslRaw === 'true';

        $curlOptions = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->apiKey,
            ],
            CURLOPT_TIMEOUT => $this->timeoutSeconds,
            CURLOPT_CONNECTTIMEOUT => 10,
        ];

        // Skip SSL verification on Windows or when explicitly configured
        if ($skipSsl) {
            $curlOptions[CURLOPT_SSL_VERIFYPEER] = false;
            $curlOptions[CURLOPT_SSL_VERIFYHOST] = 0;
        }

        curl_setopt_array($ch, $curlOptions);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        $curlErrno = curl_errno($ch);
        
        curl_close($ch);

        // Handle timeout
        if ($curlErrno === CURLE_OPERATION_TIMEDOUT) {
            $this->logError('AI API timeout', ['timeout_seconds' => $this->timeoutSeconds]);
            return null;
        }

        // Handle network errors
        if ($curlErrno !== 0) {
            $this->logError('AI API network error', [
                'curl_errno' => $curlErrno,
                'curl_error' => $curlError,
            ]);
            return null;
        }

        // Handle HTTP errors
        if ($httpCode !== 200) {
            $this->logError('AI API HTTP error', [
                'http_code' => $httpCode,
                'response' => $response,
            ]);
            return null;
        }

        // Parse API response
        $apiResponse = json_decode($response, true);
        if ($apiResponse === null) {
            $this->logError('Failed to parse AI API response', ['response' => $response]);
            return null;
        }

        // Extract content from OpenRouter response format
        $content = $apiResponse['choices'][0]['message']['content'] ?? null;
        if ($content === null) {
            $this->logError('AI API response missing content', ['response' => $apiResponse]);
            return null;
        }

        // Parse the AI's JSON response
        $aiResult = $this->parseAIContent($content);
        if ($aiResult === null) {
            $this->logError('Failed to parse AI content as JSON', ['content' => $content]);
            return null;
        }

        return $aiResult;
    }

    /**
     * Parse AI content string to extract JSON.
     * Handles cases where AI might include markdown code blocks.
     * 
     * @param string $content Raw AI response content
     * @return array|null Parsed JSON array or null
     */
    protected function parseAIContent(string $content): ?array
    {
        $content = trim($content);

        // Try to extract JSON from markdown code block
        if (preg_match('/```(?:json)?\s*(\{[\s\S]*?\})\s*```/', $content, $matches)) {
            $content = $matches[1];
        }

        // Try direct JSON parse
        $result = json_decode($content, true);
        
        if ($result !== null && is_array($result)) {
            return $result;
        }

        // Try to find JSON object in the content
        if (preg_match('/\{[\s\S]*\}/', $content, $matches)) {
            $result = json_decode($matches[0], true);
            if ($result !== null && is_array($result)) {
                return $result;
            }
        }

        return null;
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
        // In production, this would log to a proper logging system
        error_log("AIAnalysisService Error: {$message} " . json_encode($context));
    }
}
