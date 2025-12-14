<?php

namespace App\Services;

/**
 * SubscriptionServiceInterface
 * 
 * Interface for managing user subscription tiers.
 * Handles tier assignment, trial activation, and limit enforcement.
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
 */
interface SubscriptionServiceInterface
{
    /**
     * Subscription tier constants
     */
    public const TIER_FREE = 'free';
    public const TIER_TRIAL = 'trial';
    public const TIER_PRO = 'pro';
    public const TIER_PRO_PLUS = 'pro_plus';

    /**
     * Trial duration in days
     */
    public const TRIAL_DURATION_DAYS = 7;

    /**
     * Usage limits per tier (daily for free/trial, monthly for pro)
     */
    public const LIMITS = [
        self::TIER_FREE => [
            'basic_analysis' => 3,    // per day
            'pro_analysis' => 0,
            'replay' => 0,
            'ai_qa' => 0,
        ],
        self::TIER_TRIAL => [
            'basic_analysis' => 10,   // per day
            'pro_analysis' => 3,      // per day
            'replay' => 5,            // per day
            'ai_qa' => 10,            // per day
        ],
        self::TIER_PRO => [
            'basic_analysis' => 100,  // per month
            'pro_analysis' => 50,     // per month
            'replay' => 30,           // per month
            'ai_qa' => 100,           // per month
        ],
        self::TIER_PRO_PLUS => [
            'basic_analysis' => -1,   // unlimited
            'pro_analysis' => -1,     // unlimited
            'replay' => -1,           // unlimited
            'ai_qa' => -1,            // unlimited
        ],
    ];

    /**
     * Get a user's current subscription.
     * 
     * @param string $userId User UUID
     * @return array|null Subscription data or null if not found
     */
    public function getSubscription(string $userId): ?array;

    /**
     * Get a user's current tier.
     * Returns 'free' if no subscription exists.
     * 
     * @param string $userId User UUID
     * @return string Tier name
     */
    public function getTier(string $userId): string;

    /**
     * Create a default subscription for a new user.
     * 
     * @param string $userId User UUID
     * @return array Created subscription data
     */
    public function createDefaultSubscription(string $userId): array;

    /**
     * Activate trial for a user.
     * Sets tier to 'trial' and records trial_started_at.
     * 
     * @param string $userId User UUID
     * @return array|null Updated subscription or null if trial already used
     */
    public function activateTrial(string $userId): ?array;

    /**
     * Check if a user has already used their trial.
     * 
     * @param string $userId User UUID
     * @return bool True if trial was already used
     */
    public function hasUsedTrial(string $userId): bool;

    /**
     * Check if a user's trial has expired.
     * 
     * @param string $userId User UUID
     * @return bool True if trial is expired
     */
    public function isTrialExpired(string $userId): bool;

    /**
     * Get remaining trial days for a user.
     * 
     * @param string $userId User UUID
     * @return int Days remaining (0 if not on trial or expired)
     */
    public function getTrialDaysRemaining(string $userId): int;

    /**
     * Expire a user's trial and revert to free tier.
     * 
     * @param string $userId User UUID
     * @return array Updated subscription data
     */
    public function expireTrial(string $userId): array;

    /**
     * Check if a user has access to a specific tier's features.
     * 
     * @param string $userId User UUID
     * @param string $requiredTier Minimum required tier
     * @return bool True if user has access
     */
    public function hasAccess(string $userId, string $requiredTier): bool;

    /**
     * Get the usage limit for a feature based on user's tier.
     * 
     * @param string $userId User UUID
     * @param string $feature Feature name
     * @return int Limit (-1 for unlimited, 0 for no access)
     */
    public function getLimit(string $userId, string $feature): int;

    /**
     * Check if a user can use a feature (has access and within limits).
     * 
     * @param string $userId User UUID
     * @param string $feature Feature name
     * @param int $currentUsage Current usage count
     * @return bool True if user can use the feature
     */
    public function canUseFeature(string $userId, string $feature, int $currentUsage): bool;

    /**
     * Set subscription directly (used by payment webhook or testing).
     * 
     * @param string $userId User UUID
     * @param array $subscription Subscription payload
     * @return void
     */
    public function setSubscription(string $userId, array $subscription): void;
}
