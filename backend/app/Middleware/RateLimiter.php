<?php

namespace App\Middleware;

/**
 * RateLimiter Middleware
 * 
 * Implements rate limiting for API endpoints to prevent abuse.
 * Uses file-based storage for simplicity (can be upgraded to Redis for production).
 * 
 * **Validates: Non-functional requirements for rate limiting**
 */
class RateLimiter
{
    /** @var string Directory for storing rate limit data */
    private string $storageDir;

    /** @var int Default requests per hour */
    private int $defaultPerHour;

    /** @var int Default requests per day */
    private int $defaultPerDay;

    /**
     * Create a new RateLimiter instance.
     * 
     * @param string|null $storageDir Directory for rate limit data
     */
    public function __construct(?string $storageDir = null)
    {
        $this->storageDir = $storageDir ?? __DIR__ . '/../../storage/rate_limits';
        
        // Load configuration from environment or use defaults
        $this->defaultPerHour = (int)(getenv('REPORT_RATE_LIMIT_PER_HOUR') ?: 5);
        $this->defaultPerDay = (int)(getenv('REPORT_RATE_LIMIT_PER_DAY') ?: 20);

        // Ensure storage directory exists
        if (!is_dir($this->storageDir)) {
            @mkdir($this->storageDir, 0755, true);
        }
    }

    /**
     * Check if a request should be rate limited.
     * 
     * @param string $userId User identifier
     * @param string $action Action being performed (e.g., 'report', 'appeal')
     * @param int|null $perHour Max requests per hour (null = use default)
     * @param int|null $perDay Max requests per day (null = use default)
     * @return array ['allowed' => bool, 'retry_after' => int|null, 'message' => string|null]
     */
    public function check(
        string $userId,
        string $action,
        ?int $perHour = null,
        ?int $perDay = null
    ): array {
        $perHour = $perHour ?? $this->defaultPerHour;
        $perDay = $perDay ?? $this->defaultPerDay;

        $key = $this->getKey($userId, $action);
        $data = $this->loadData($key);
        $now = time();

        // Clean up old entries
        $data = $this->cleanupOldEntries($data, $now);

        // Count requests in the last hour
        $hourAgo = $now - 3600;
        $hourlyCount = count(array_filter($data['timestamps'] ?? [], fn($ts) => $ts >= $hourAgo));

        // Count requests in the last day
        $dayAgo = $now - 86400;
        $dailyCount = count(array_filter($data['timestamps'] ?? [], fn($ts) => $ts >= $dayAgo));

        // Check hourly limit
        if ($hourlyCount >= $perHour) {
            $oldestInHour = min(array_filter($data['timestamps'] ?? [], fn($ts) => $ts >= $hourAgo));
            $retryAfter = $oldestInHour + 3600 - $now;
            return [
                'allowed' => false,
                'retry_after' => max(1, $retryAfter),
                'message' => "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau {$retryAfter} giây.",
            ];
        }

        // Check daily limit
        if ($dailyCount >= $perDay) {
            $oldestInDay = min(array_filter($data['timestamps'] ?? [], fn($ts) => $ts >= $dayAgo));
            $retryAfter = $oldestInDay + 86400 - $now;
            $hours = ceil($retryAfter / 3600);
            return [
                'allowed' => false,
                'retry_after' => max(1, $retryAfter),
                'message' => "Bạn đã đạt giới hạn hàng ngày. Vui lòng thử lại sau {$hours} giờ.",
            ];
        }

        return [
            'allowed' => true,
            'retry_after' => null,
            'message' => null,
        ];
    }

    /**
     * Record a request for rate limiting.
     * 
     * @param string $userId User identifier
     * @param string $action Action being performed
     */
    public function record(string $userId, string $action): void
    {
        $key = $this->getKey($userId, $action);
        $data = $this->loadData($key);
        $now = time();

        // Clean up old entries
        $data = $this->cleanupOldEntries($data, $now);

        // Add new timestamp
        $data['timestamps'][] = $now;

        $this->saveData($key, $data);
    }

    /**
     * Get remaining requests for a user/action.
     * 
     * @param string $userId User identifier
     * @param string $action Action being performed
     * @return array ['hourly_remaining' => int, 'daily_remaining' => int]
     */
    public function getRemaining(string $userId, string $action): array
    {
        $key = $this->getKey($userId, $action);
        $data = $this->loadData($key);
        $now = time();

        // Clean up old entries
        $data = $this->cleanupOldEntries($data, $now);

        $hourAgo = $now - 3600;
        $dayAgo = $now - 86400;

        $hourlyCount = count(array_filter($data['timestamps'] ?? [], fn($ts) => $ts >= $hourAgo));
        $dailyCount = count(array_filter($data['timestamps'] ?? [], fn($ts) => $ts >= $dayAgo));

        return [
            'hourly_remaining' => max(0, $this->defaultPerHour - $hourlyCount),
            'daily_remaining' => max(0, $this->defaultPerDay - $dailyCount),
        ];
    }

    /**
     * Generate storage key for user/action combination.
     * 
     * @param string $userId User identifier
     * @param string $action Action name
     * @return string Storage key
     */
    private function getKey(string $userId, string $action): string
    {
        return md5("{$userId}:{$action}");
    }

    /**
     * Load rate limit data from storage.
     * 
     * @param string $key Storage key
     * @return array Rate limit data
     */
    private function loadData(string $key): array
    {
        $file = "{$this->storageDir}/{$key}.json";
        
        if (!file_exists($file)) {
            return ['timestamps' => []];
        }

        $content = @file_get_contents($file);
        if ($content === false) {
            return ['timestamps' => []];
        }

        $data = json_decode($content, true);
        return is_array($data) ? $data : ['timestamps' => []];
    }

    /**
     * Save rate limit data to storage.
     * 
     * @param string $key Storage key
     * @param array $data Rate limit data
     */
    private function saveData(string $key, array $data): void
    {
        $file = "{$this->storageDir}/{$key}.json";
        @file_put_contents($file, json_encode($data), LOCK_EX);
    }

    /**
     * Clean up entries older than 24 hours.
     * 
     * @param array $data Rate limit data
     * @param int $now Current timestamp
     * @return array Cleaned data
     */
    private function cleanupOldEntries(array $data, int $now): array
    {
        $dayAgo = $now - 86400;
        $data['timestamps'] = array_values(
            array_filter($data['timestamps'] ?? [], fn($ts) => $ts >= $dayAgo)
        );
        return $data;
    }

    /**
     * Clear all rate limit data for a user.
     * Useful for testing or admin override.
     * 
     * @param string $userId User identifier
     * @param string|null $action Specific action to clear (null = all actions)
     */
    public function clear(string $userId, ?string $action = null): void
    {
        if ($action !== null) {
            $key = $this->getKey($userId, $action);
            $file = "{$this->storageDir}/{$key}.json";
            @unlink($file);
        } else {
            // Clear all files for this user (would need to track user->key mapping)
            // For simplicity, this only works with specific action
        }
    }
}
