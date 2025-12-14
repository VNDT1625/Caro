<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Services\SubscriptionService;
use App\Services\SubscriptionServiceInterface;

/**
 * Property-Based Tests for SubscriptionService
 * 
 * **Feature: ai-match-analysis-system, Property 9: Subscription Tier Lifecycle**
 * 
 * Tests that:
 * - Assigns Free tier by default for new users
 * - Sets trial_started_at and expires_at (7 days later) when Trial is activated
 * - Reverts to Free tier when Trial expires
 * - Enforces correct usage limits based on tier
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
 */
class SubscriptionServicePropertyTest extends TestCase
{
    use TestTrait;

    private SubscriptionService $service;
    private \DateTimeImmutable $fixedTime;

    protected function setUp(): void
    {
        parent::setUp();
        $this->erisSetup();
        $this->fixedTime = new \DateTimeImmutable('2024-12-03 12:00:00');
        $this->service = new SubscriptionService(null, fn() => $this->fixedTime);
    }

    protected function tearDown(): void
    {
        $this->service->clearSubscriptions();
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
     * **Feature: ai-match-analysis-system, Property 9: Subscription Tier Lifecycle**
     * 
     * *For any* new user, the system SHALL assign Free tier by default.
     * 
     * **Validates: Requirements 7.1**
     * 
     * @test
     */
    public function newUserGetsFreeTierByDefault(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $userId = $this->generateUuid();

                // Create default subscription
                $subscription = $this->service->createDefaultSubscription($userId);

                // Property: Tier must be 'free'
                $this->assertEquals(
                    SubscriptionServiceInterface::TIER_FREE,
                    $subscription['tier'],
                    'New user must have free tier'
                );

                // Property: Status must be 'active'
                $this->assertEquals(
                    'active',
                    $subscription['status'],
                    'New subscription must be active'
                );

                // Property: trial_started_at must be null
                $this->assertNull(
                    $subscription['trial_started_at'],
                    'New user must not have trial started'
                );

                // Property: expires_at must be null for free tier
                $this->assertNull(
                    $subscription['expires_at'],
                    'Free tier must not have expiration'
                );
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 9: Subscription Tier Lifecycle**
     * 
     * *For any* user without subscription, getTier SHALL return 'free'.
     * 
     * **Validates: Requirements 7.1**
     * 
     * @test
     */
    public function getTierReturnsFreeTierForNewUser(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $userId = $this->generateUuid();

                // Get tier without creating subscription
                $tier = $this->service->getTier($userId);

                // Property: Tier must be 'free'
                $this->assertEquals(
                    SubscriptionServiceInterface::TIER_FREE,
                    $tier,
                    'User without subscription must have free tier'
                );
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 9: Subscription Tier Lifecycle**
     * 
     * *For any* user activating trial, the system SHALL set trial_started_at 
     * and expires_at (7 days later).
     * 
     * **Validates: Requirements 7.3**
     * 
     * @test
     */
    public function trialActivationSetsCorrectDates(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $userId = $this->generateUuid();

                // Activate trial
                $subscription = $this->service->activateTrial($userId);

                // Property: Subscription must be returned
                $this->assertNotNull($subscription, 'Trial activation must return subscription');

                // Property: Tier must be 'trial'
                $this->assertEquals(
                    SubscriptionServiceInterface::TIER_TRIAL,
                    $subscription['tier'],
                    'Activated trial must have trial tier'
                );

                // Property: trial_started_at must be set
                $this->assertNotNull(
                    $subscription['trial_started_at'],
                    'Trial must have started_at date'
                );

                // Property: expires_at must be set
                $this->assertNotNull(
                    $subscription['expires_at'],
                    'Trial must have expires_at date'
                );

                // Property: expires_at must be 7 days after trial_started_at
                $startedAt = new \DateTimeImmutable($subscription['trial_started_at']);
                $expiresAt = new \DateTimeImmutable($subscription['expires_at']);
                $diff = $startedAt->diff($expiresAt);

                $this->assertEquals(
                    SubscriptionServiceInterface::TRIAL_DURATION_DAYS,
                    $diff->days,
                    'Trial must expire after 7 days'
                );
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 9: Subscription Tier Lifecycle**
     * 
     * *For any* user who already used trial, activateTrial SHALL return null.
     * 
     * **Validates: Requirements 7.3**
     * 
     * @test
     */
    public function trialCannotBeActivatedTwice(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $userId = $this->generateUuid();

                // Activate trial first time
                $firstActivation = $this->service->activateTrial($userId);
                $this->assertNotNull($firstActivation, 'First trial activation must succeed');

                // Try to activate trial second time
                $secondActivation = $this->service->activateTrial($userId);

                // Property: Second activation must return null
                $this->assertNull(
                    $secondActivation,
                    'Trial cannot be activated twice'
                );

                // Property: hasUsedTrial must return true
                $this->assertTrue(
                    $this->service->hasUsedTrial($userId),
                    'hasUsedTrial must return true after activation'
                );
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 9: Subscription Tier Lifecycle**
     * 
     * *For any* expired trial, getTier SHALL return 'free'.
     * 
     * **Validates: Requirements 7.4**
     * 
     * @test
     */
    public function expiredTrialRevertsToFreeTier(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $userId = $this->generateUuid();

                // Activate trial
                $this->service->activateTrial($userId);

                // Simulate time passing (8 days later)
                $expiredTime = $this->fixedTime->modify('+8 days');
                $expiredService = new SubscriptionService(null, fn() => $expiredTime);
                
                // Copy subscription to new service
                $subscription = $this->service->getSubscription($userId);
                $expiredService->setSubscription($userId, $subscription);

                // Get tier after expiration
                $tier = $expiredService->getTier($userId);

                // Property: Tier must be 'free' after expiration
                $this->assertEquals(
                    SubscriptionServiceInterface::TIER_FREE,
                    $tier,
                    'Expired trial must revert to free tier'
                );
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 9: Subscription Tier Lifecycle**
     * 
     * *For any* tier, getLimit SHALL return the correct limit for each feature.
     * 
     * **Validates: Requirements 7.5, 7.6**
     * 
     * @test
     */
    public function getLimitReturnsCorrectLimitsForTier(): void
    {
        $tiers = [
            SubscriptionServiceInterface::TIER_FREE,
            SubscriptionServiceInterface::TIER_TRIAL,
            SubscriptionServiceInterface::TIER_PRO,
            SubscriptionServiceInterface::TIER_PRO_PLUS,
        ];

        $features = ['basic_analysis', 'pro_analysis', 'replay', 'ai_qa'];

        $this
            ->forAll(
                Generators::elements($tiers),
                Generators::elements($features)
            )
            ->withMaxSize(100)
            ->then(function (string $tier, string $feature) {
                $userId = $this->generateUuid();

                // Set up subscription with specific tier
                $subscription = $this->service->createDefaultSubscription($userId);
                $subscription['tier'] = $tier;
                $this->service->setSubscription($userId, $subscription);

                // Get limit
                $limit = $this->service->getLimit($userId, $feature);

                // Property: Limit must match expected value from LIMITS constant
                $expectedLimit = SubscriptionServiceInterface::LIMITS[$tier][$feature] ?? 0;
                $this->assertEquals(
                    $expectedLimit,
                    $limit,
                    "Limit for {$tier}/{$feature} must be {$expectedLimit}"
                );
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 9: Subscription Tier Lifecycle**
     * 
     * *For any* tier and feature, canUseFeature SHALL correctly enforce limits.
     * 
     * **Validates: Requirements 7.5, 7.6**
     * 
     * @test
     */
    public function canUseFeatureEnforcesLimitsCorrectly(): void
    {
        $this
            ->forAll(
                Generators::elements([
                    SubscriptionServiceInterface::TIER_FREE,
                    SubscriptionServiceInterface::TIER_TRIAL,
                ]),
                Generators::elements(['basic_analysis', 'pro_analysis']),
                Generators::choose(0, 20)
            )
            ->withMaxSize(100)
            ->then(function (string $tier, string $feature, int $currentUsage) {
                $userId = $this->generateUuid();

                // Set up subscription with specific tier
                $subscription = $this->service->createDefaultSubscription($userId);
                $subscription['tier'] = $tier;
                $this->service->setSubscription($userId, $subscription);

                $limit = SubscriptionServiceInterface::LIMITS[$tier][$feature] ?? 0;
                $canUse = $this->service->canUseFeature($userId, $feature, $currentUsage);

                if ($limit === -1) {
                    // Unlimited
                    $this->assertTrue($canUse, 'Unlimited feature must always be usable');
                } elseif ($limit === 0) {
                    // No access
                    $this->assertFalse($canUse, 'Feature with 0 limit must not be usable');
                } else {
                    // Limited
                    if ($currentUsage < $limit) {
                        $this->assertTrue($canUse, "Usage {$currentUsage} < limit {$limit} must be allowed");
                    } else {
                        $this->assertFalse($canUse, "Usage {$currentUsage} >= limit {$limit} must be blocked");
                    }
                }
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 9: Subscription Tier Lifecycle**
     * 
     * *For any* Pro Plus user, all features SHALL be unlimited (-1).
     * 
     * **Validates: Requirements 7.5**
     * 
     * @test
     */
    public function proPlusHasUnlimitedAccess(): void
    {
        $features = ['basic_analysis', 'pro_analysis', 'replay', 'ai_qa'];

        $this
            ->forAll(
                Generators::elements($features),
                Generators::choose(0, 1000)
            )
            ->withMaxSize(100)
            ->then(function (string $feature, int $currentUsage) {
                $userId = $this->generateUuid();

                // Set up Pro Plus subscription
                $subscription = $this->service->createDefaultSubscription($userId);
                $subscription['tier'] = SubscriptionServiceInterface::TIER_PRO_PLUS;
                $this->service->setSubscription($userId, $subscription);

                // Property: Limit must be -1 (unlimited)
                $limit = $this->service->getLimit($userId, $feature);
                $this->assertEquals(-1, $limit, 'Pro Plus must have unlimited access');

                // Property: canUseFeature must always return true
                $canUse = $this->service->canUseFeature($userId, $feature, $currentUsage);
                $this->assertTrue($canUse, 'Pro Plus must always be able to use features');
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 9: Subscription Tier Lifecycle**
     * 
     * *For any* Free user, Pro features SHALL have 0 limit (no access).
     * 
     * **Validates: Requirements 7.5**
     * 
     * @test
     */
    public function freeUserHasNoProAccess(): void
    {
        $proFeatures = ['pro_analysis', 'replay', 'ai_qa'];

        $this
            ->forAll(Generators::elements($proFeatures))
            ->withMaxSize(100)
            ->then(function (string $feature) {
                $userId = $this->generateUuid();

                // Create free subscription
                $this->service->createDefaultSubscription($userId);

                // Property: Limit must be 0 (no access)
                $limit = $this->service->getLimit($userId, $feature);
                $this->assertEquals(0, $limit, "Free user must have no access to {$feature}");

                // Property: canUseFeature must return false
                $canUse = $this->service->canUseFeature($userId, $feature, 0);
                $this->assertFalse($canUse, "Free user must not be able to use {$feature}");
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 9: Subscription Tier Lifecycle**
     * 
     * *For any* user, hasAccess SHALL correctly compare tier levels.
     * 
     * **Validates: Requirements 7.5**
     * 
     * @test
     */
    public function hasAccessComparesCorrectly(): void
    {
        $tiers = [
            SubscriptionServiceInterface::TIER_FREE,
            SubscriptionServiceInterface::TIER_TRIAL,
            SubscriptionServiceInterface::TIER_PRO,
            SubscriptionServiceInterface::TIER_PRO_PLUS,
        ];

        $tierOrder = [
            SubscriptionServiceInterface::TIER_FREE => 0,
            SubscriptionServiceInterface::TIER_TRIAL => 1,
            SubscriptionServiceInterface::TIER_PRO => 2,
            SubscriptionServiceInterface::TIER_PRO_PLUS => 3,
        ];

        $this
            ->forAll(
                Generators::elements($tiers),
                Generators::elements($tiers)
            )
            ->withMaxSize(100)
            ->then(function (string $userTier, string $requiredTier) use ($tierOrder) {
                $userId = $this->generateUuid();

                // Set up subscription with specific tier
                $subscription = $this->service->createDefaultSubscription($userId);
                $subscription['tier'] = $userTier;
                $this->service->setSubscription($userId, $subscription);

                $hasAccess = $this->service->hasAccess($userId, $requiredTier);
                $expectedAccess = $tierOrder[$userTier] >= $tierOrder[$requiredTier];

                $this->assertEquals(
                    $expectedAccess,
                    $hasAccess,
                    "User with {$userTier} tier " . ($expectedAccess ? 'should' : 'should not') . " have access to {$requiredTier}"
                );
            });
    }

    /**
     * **Feature: ai-match-analysis-system, Property 9: Subscription Tier Lifecycle**
     * 
     * *For any* active trial, getTrialDaysRemaining SHALL return correct days.
     * 
     * **Validates: Requirements 7.3**
     * 
     * @test
     */
    public function getTrialDaysRemainingReturnsCorrectDays(): void
    {
        $this
            ->forAll(Generators::choose(0, 10))
            ->withMaxSize(100)
            ->then(function (int $daysPassed) {
                $userId = $this->generateUuid();

                // Activate trial
                $this->service->activateTrial($userId);

                // Simulate time passing
                $currentTime = $this->fixedTime->modify("+{$daysPassed} days");
                $timeService = new SubscriptionService(null, fn() => $currentTime);
                
                // Copy subscription
                $subscription = $this->service->getSubscription($userId);
                $timeService->setSubscription($userId, $subscription);

                $daysRemaining = $timeService->getTrialDaysRemaining($userId);
                $expectedDays = max(0, SubscriptionServiceInterface::TRIAL_DURATION_DAYS - $daysPassed);

                $this->assertEquals(
                    $expectedDays,
                    $daysRemaining,
                    "After {$daysPassed} days, {$expectedDays} days should remain"
                );
            });
    }
}
