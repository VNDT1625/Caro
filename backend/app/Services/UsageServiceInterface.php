<?php

namespace App\Services;

/**
 * UsageServiceInterface
 * 
 * Interface for tracking feature usage per user.
 * Handles daily and monthly usage counting and limit enforcement.
 * 
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
 */
interface UsageServiceInterface
{
    /**
     * Feature type constants
     */
    public const FEATURE_BASIC_ANALYSIS = 'basic_analysis';
    public const FEATURE_PRO_ANALYSIS = 'pro_analysis';
    public const FEATURE_REPLAY = 'replay';
    public const FEATURE_AI_QA = 'ai_qa';

    /**
     * Valid feature types
     */
    public const VALID_FEATURES = [
        self::FEATURE_BASIC_ANALYSIS,
        self::FEATURE_PRO_ANALYSIS,
        self::FEATURE_REPLAY,
        self::FEATURE_AI_QA,
    ];

    /**
     * Log a feature usage.
     * 
     * @param string $userId User UUID
     * @param string $feature Feature name
     * @param int $count Usage count (default 1)
     * @return string Usage log ID
     */
    public function logUsage(string $userId, string $feature, int $count = 1): string;

    /**
     * Get daily usage count for a user and feature.
     * 
     * @param string $userId User UUID
     * @param string $feature Feature name
     * @param string|null $date Date in Y-m-d format (default: today)
     * @return int Usage count for the day
     */
    public function getDailyUsage(string $userId, string $feature, ?string $date = null): int;

    /**
     * Get monthly usage count for a user and feature.
     * 
     * @param string $userId User UUID
     * @param string $feature Feature name
     * @param string|null $period Period in Y-m format (default: current month)
     * @return int Usage count for the month
     */
    public function getMonthlyUsage(string $userId, string $feature, ?string $period = null): int;

    /**
     * Get remaining daily allowance for a user and feature.
     * 
     * @param string $userId User UUID
     * @param string $feature Feature name
     * @param int $limit Daily limit
     * @return int Remaining uses (-1 for unlimited)
     */
    public function getRemainingDaily(string $userId, string $feature, int $limit): int;

    /**
     * Get remaining monthly allowance for a user and feature.
     * 
     * @param string $userId User UUID
     * @param string $feature Feature name
     * @param int $limit Monthly limit
     * @return int Remaining uses (-1 for unlimited)
     */
    public function getRemainingMonthly(string $userId, string $feature, int $limit): int;

    /**
     * Get usage summary for a user.
     * 
     * @param string $userId User UUID
     * @return array Usage summary with daily and monthly counts per feature
     */
    public function getUsageSummary(string $userId): array;

    /**
     * Check if a feature type is valid.
     * 
     * @param string $feature Feature name
     * @return bool True if valid
     */
    public function isValidFeature(string $feature): bool;

    /**
     * Get the time until daily reset.
     * 
     * @return int Seconds until midnight UTC
     */
    public function getTimeUntilDailyReset(): int;

    /**
     * Get the time until monthly reset.
     * 
     * @return int Seconds until first of next month UTC
     */
    public function getTimeUntilMonthlyReset(): int;
}
