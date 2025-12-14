<?php

namespace App\Services;

use DateTime;
use DateTimeImmutable;
use Exception;

/**
 * SubscriptionService
 * 
 * Manages user subscription tiers, trial activation, and limit enforcement.
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
 * 
 * **Property 9: Subscription Tier Lifecycle**
 * - Assigns Free tier by default for new users
 * - Sets trial_started_at and expires_at (7 days later) when Trial is activated
 * - Reverts to Free tier when Trial expires
 * - Enforces correct usage limits based on tier
 */
class SubscriptionService implements SubscriptionServiceInterface
{
    /**
     * Database connection or repository
     * In production, this would be a proper database abstraction
     */
    private $database;

    /**
     * In-memory storage for testing
     */
    private array $subscriptions = [];

    /**
     * Current time provider for testing
     * @var callable|null
     */
    private $timeProvider;

    public function __construct($database = null, ?callable $timeProvider = null)
    {
        $this->database = $database;
        $this->timeProvider = $timeProvider;
    }

    /**
     * Get current time (allows mocking in tests)
     */
    protected function now(): DateTimeImmutable
    {
        if ($this->timeProvider !== null) {
            return ($this->timeProvider)();
        }
        return new DateTimeImmutable();
    }

    /**
     * {@inheritdoc}
     */
    public function getSubscription(string $userId): ?array
    {
        // In-memory storage for testing
        if ($this->database === null) {
            return $this->subscriptions[$userId] ?? null;
        }

        // Production: query database
        // return $this->database->query(...);
        return null;
    }

    /**
     * {@inheritdoc}
     */
    public function getTier(string $userId): string
    {
        $subscription = $this->getSubscription($userId);
        
        if ($subscription === null) {
            return self::TIER_FREE;
        }

        // Check if trial expired
        if ($subscription['tier'] === self::TIER_TRIAL && $this->isTrialExpired($userId)) {
            $this->expireTrial($userId);
            return self::TIER_FREE;
        }

        return $subscription['tier'] ?? self::TIER_FREE;
    }

    /**
     * {@inheritdoc}
     * 
     * **Property 9.1**: Assigns Free tier by default for new users
     */
    public function createDefaultSubscription(string $userId): array
    {
        $now = $this->now();
        
        $subscription = [
            'id' => $this->generateUuid(),
            'user_id' => $userId,
            'tier' => self::TIER_FREE,
            'status' => 'active',
            'started_at' => $now->format('c'),
            'expires_at' => null,
            'trial_started_at' => null,
            'auto_renew' => false,
            'created_at' => $now->format('c'),
            'updated_at' => $now->format('c'),
        ];

        // In-memory storage for testing
        if ($this->database === null) {
            $this->subscriptions[$userId] = $subscription;
            return $subscription;
        }

        // Production: insert into database
        // $this->database->insert(...);
        return $subscription;
    }

    /**
     * {@inheritdoc}
     * 
     * **Property 9.2**: Sets trial_started_at and expires_at (7 days later) when Trial is activated
     */
    public function activateTrial(string $userId): ?array
    {
        // Check if trial already used
        if ($this->hasUsedTrial($userId)) {
            return null;
        }

        $subscription = $this->getSubscription($userId);
        
        if ($subscription === null) {
            $subscription = $this->createDefaultSubscription($userId);
        }

        $now = $this->now();
        $expiresAt = $now->modify('+' . self::TRIAL_DURATION_DAYS . ' days');

        $subscription['tier'] = self::TIER_TRIAL;
        $subscription['trial_started_at'] = $now->format('c');
        $subscription['expires_at'] = $expiresAt->format('c');
        $subscription['updated_at'] = $now->format('c');

        // In-memory storage for testing
        if ($this->database === null) {
            $this->subscriptions[$userId] = $subscription;
            return $subscription;
        }

        // Production: update database
        // $this->database->update(...);
        return $subscription;
    }

    /**
     * {@inheritdoc}
     */
    public function hasUsedTrial(string $userId): bool
    {
        $subscription = $this->getSubscription($userId);
        
        if ($subscription === null) {
            return false;
        }

        return $subscription['trial_started_at'] !== null;
    }

    /**
     * {@inheritdoc}
     */
    public function isTrialExpired(string $userId): bool
    {
        $subscription = $this->getSubscription($userId);
        
        if ($subscription === null || $subscription['tier'] !== self::TIER_TRIAL) {
            return false;
        }

        if ($subscription['expires_at'] === null) {
            return false;
        }

        $expiresAt = new DateTimeImmutable($subscription['expires_at']);
        return $this->now() > $expiresAt;
    }

    /**
     * {@inheritdoc}
     */
    public function getTrialDaysRemaining(string $userId): int
    {
        $subscription = $this->getSubscription($userId);
        
        if ($subscription === null || $subscription['tier'] !== self::TIER_TRIAL) {
            return 0;
        }

        if ($subscription['expires_at'] === null) {
            return 0;
        }

        $expiresAt = new DateTimeImmutable($subscription['expires_at']);
        $now = $this->now();

        if ($now > $expiresAt) {
            return 0;
        }

        $diff = $now->diff($expiresAt);
        return max(0, $diff->days);
    }

    /**
     * {@inheritdoc}
     * 
     * **Property 9.3**: Reverts to Free tier when Trial expires
     */
    public function expireTrial(string $userId): array
    {
        $subscription = $this->getSubscription($userId);
        
        if ($subscription === null) {
            return $this->createDefaultSubscription($userId);
        }

        $now = $this->now();

        $subscription['tier'] = self::TIER_FREE;
        $subscription['status'] = 'expired';
        $subscription['updated_at'] = $now->format('c');

        // In-memory storage for testing
        if ($this->database === null) {
            $this->subscriptions[$userId] = $subscription;
            return $subscription;
        }

        // Production: update database
        // $this->database->update(...);
        return $subscription;
    }

    /**
     * {@inheritdoc}
     */
    public function hasAccess(string $userId, string $requiredTier): bool
    {
        $userTier = $this->getTier($userId);
        
        $tierOrder = [
            self::TIER_FREE => 0,
            self::TIER_TRIAL => 1,
            self::TIER_PRO => 2,
            self::TIER_PRO_PLUS => 3,
        ];

        $userLevel = $tierOrder[$userTier] ?? 0;
        $requiredLevel = $tierOrder[$requiredTier] ?? 0;

        return $userLevel >= $requiredLevel;
    }

    /**
     * {@inheritdoc}
     * 
     * **Property 9.4**: Enforces correct usage limits based on tier
     */
    public function getLimit(string $userId, string $feature): int
    {
        $tier = $this->getTier($userId);
        
        return self::LIMITS[$tier][$feature] ?? 0;
    }

    /**
     * {@inheritdoc}
     */
    public function canUseFeature(string $userId, string $feature, int $currentUsage): bool
    {
        $limit = $this->getLimit($userId, $feature);
        
        // -1 means unlimited
        if ($limit === -1) {
            return true;
        }

        // 0 means no access
        if ($limit === 0) {
            return false;
        }

        return $currentUsage < $limit;
    }

    /**
     * Generate a UUID v4
     */
    protected function generateUuid(): string
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
     * Set subscription directly (for testing)
     */
    public function setSubscription(string $userId, array $subscription): void
    {
        $this->subscriptions[$userId] = $subscription;
    }

    /**
     * Clear all subscriptions (for testing)
     */
    public function clearSubscriptions(): void
    {
        $this->subscriptions = [];
    }
}
