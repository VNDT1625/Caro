<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Services\BanService;
use App\Models\UserBan;

/**
 * Property-Based Tests for BanService
 * 
 * **Feature: report-violation-system, Property 14: Ban Application**
 * 
 * Tests that for any auto_flagged report, a corresponding ban record SHALL be 
 * created with the configured penalty type.
 * 
 * **Validates: Requirements 6.1**
 */
class BanServicePropertyTest extends TestCase
{
    use TestTrait;

    private BanService $banService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->erisSetup();
        $this->banService = new BanService(
            defaultBanDuration: 7,
            autoBanEnabled: true,
            defaultBanType: UserBan::TYPE_TEMPORARY
        );
    }

    protected function tearDown(): void
    {
        $this->banService->clearBans();
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
     * Generate a valid ban reason string (non-empty, within length limit)
     */
    private function reasonGenerator()
    {
        // Use a constant prefix to ensure non-empty, then append random suffix
        return Generators::map(
            function ($suffix) {
                $reason = 'Ban reason: ' . $suffix;
                // Truncate if too long
                if (strlen($reason) > UserBan::MAX_REASON_LENGTH) {
                    $reason = substr($reason, 0, UserBan::MAX_REASON_LENGTH);
                }
                return $reason;
            },
            Generators::string()
        );
    }

    /**
     * **Feature: report-violation-system, Property 14: Ban Application**
     * 
     * *For any* auto_flagged report, a corresponding ban record SHALL be created 
     * with the configured penalty type.
     * 
     * **Validates: Requirements 6.1**
     * 
     * @test
     */
    public function banApplicationCreatesRecordWithConfiguredPenaltyType(): void
    {
        $this
            ->forAll(
                Generators::elements(UserBan::VALID_TYPES),
                Generators::choose(1, 30)  // Duration days
            )
            ->withMaxSize(100)
            ->then(function (string $banType, int $durationDays) {
                // Create a new service with the specified ban type
                $service = new BanService(
                    defaultBanDuration: $durationDays,
                    autoBanEnabled: true,
                    defaultBanType: $banType
                );

                $userId = $this->generateUuid();
                $reportId = $this->generateUuid();
                $reasonResult = 'Multiple moves detected';
                $aiDetails = 'AI confirmed cheating';

                // Apply ban for auto-flagged report
                $ban = $service->applyBanForAutoFlagged(
                    $userId,
                    $reportId,
                    $reasonResult,
                    $aiDetails
                );

                // Property: Ban record SHALL be created
                $this->assertNotNull($ban, 'Ban record must be created');

                // Property: Ban type SHALL match configured type
                $this->assertEquals(
                    $banType,
                    $ban->getAttribute('ban_type'),
                    "Ban type must match configured type: {$banType}"
                );

                // Property: Ban SHALL be active
                $this->assertTrue(
                    $ban->getAttribute('is_active'),
                    'New ban must be active'
                );

                // Property: Ban SHALL be linked to report
                $this->assertEquals(
                    $reportId,
                    $ban->getAttribute('report_id'),
                    'Ban must be linked to report'
                );

                // Property: Ban SHALL be linked to user
                $this->assertEquals(
                    $userId,
                    $ban->getAttribute('user_id'),
                    'Ban must be linked to user'
                );

                // Property: Temporary bans SHALL have expiration
                if ($banType === UserBan::TYPE_TEMPORARY) {
                    $this->assertNotNull(
                        $ban->getAttribute('expires_at'),
                        'Temporary ban must have expiration'
                    );
                }

                // Property: Permanent bans SHALL NOT have expiration
                if ($banType === UserBan::TYPE_PERMANENT) {
                    $this->assertNull(
                        $ban->getAttribute('expires_at'),
                        'Permanent ban must not have expiration'
                    );
                }
            });
    }

    /**
     * **Feature: report-violation-system, Property 14: Ban Application**
     * 
     * *For any* valid ban application, the ban record SHALL contain 
     * all required fields and be in active state.
     * 
     * **Validates: Requirements 6.1, 6.2**
     * 
     * @test
     */
    public function applyBanCreatesValidBanRecord(): void
    {
        $this
            ->forAll(
                Generators::elements(UserBan::VALID_TYPES),
                $this->reasonGenerator()
            )
            ->withMaxSize(100)
            ->then(function (string $banType, string $reason) {
                $userId = $this->generateUuid();
                $reportId = $this->generateUuid();
                
                // Determine duration based on ban type
                $durationDays = $banType === UserBan::TYPE_TEMPORARY ? 7 : null;

                $ban = $this->banService->applyBan(
                    $userId,
                    $reportId,
                    $banType,
                    $reason,
                    $durationDays
                );

                // Property: Required fields must be present
                $this->assertNotNull($ban->getAttribute('user_id'), 'user_id must be present');
                $this->assertNotNull($ban->getAttribute('ban_type'), 'ban_type must be present');
                $this->assertNotNull($ban->getAttribute('reason'), 'reason must be present');

                // Property: Ban must be active
                $this->assertTrue(
                    $ban->getAttribute('is_active'),
                    'New ban must be active'
                );

                // Property: Ban type must match input
                $this->assertEquals($banType, $ban->getAttribute('ban_type'));

                // Property: User ID must match input
                $this->assertEquals($userId, $ban->getAttribute('user_id'));

                // Property: Report ID must match input
                $this->assertEquals($reportId, $ban->getAttribute('report_id'));

                // Property: Reason must match input
                $this->assertEquals($reason, $ban->getAttribute('reason'));
            });
    }

    /**
     * **Feature: report-violation-system, Property 14: Ban Application**
     * 
     * *For any* temporary ban, the expiration date SHALL be calculated correctly
     * based on the duration days.
     * 
     * **Validates: Requirements 6.1**
     * 
     * @test
     */
    public function temporaryBanHasCorrectExpiration(): void
    {
        $this
            ->minimumEvaluationRatio(0.0)
            ->forAll(
                Generators::choose(1, 365)  // Duration days
            )
            ->withMaxSize(100)
            ->then(function (int $durationDays) {
                $userId = $this->generateUuid();
                $reason = 'Test ban reason ' . $durationDays;
                $beforeTime = time();

                $ban = $this->banService->applyBan(
                    $userId,
                    null,
                    UserBan::TYPE_TEMPORARY,
                    $reason,
                    $durationDays
                );

                $afterTime = time();

                // Property: Temporary ban must have expiration
                $expiresAt = $ban->getAttribute('expires_at');
                $this->assertNotNull($expiresAt, 'Temporary ban must have expiration');

                // Property: Expiration must be approximately durationDays from now
                // Handle both string and DateTimeImmutable
                if ($expiresAt instanceof \DateTimeInterface) {
                    $expirationTimestamp = $expiresAt->getTimestamp();
                } else {
                    $expirationTimestamp = strtotime($expiresAt);
                }
                $expectedMin = $beforeTime + ($durationDays * 86400);
                $expectedMax = $afterTime + ($durationDays * 86400) + 1;

                $this->assertGreaterThanOrEqual(
                    $expectedMin,
                    $expirationTimestamp,
                    "Expiration must be at least {$durationDays} days from now"
                );
                $this->assertLessThanOrEqual(
                    $expectedMax,
                    $expirationTimestamp,
                    "Expiration must be at most {$durationDays} days from now"
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 14: Ban Application**
     * 
     * *For any* permanent ban, there SHALL be no expiration date.
     * 
     * **Validates: Requirements 6.1**
     * 
     * @test
     */
    public function permanentBanHasNoExpiration(): void
    {
        $this
            ->forAll($this->reasonGenerator())
            ->withMaxSize(100)
            ->then(function (string $reason) {
                $userId = $this->generateUuid();

                $ban = $this->banService->applyBan(
                    $userId,
                    null,
                    UserBan::TYPE_PERMANENT,
                    $reason,
                    null
                );

                // Property: Permanent ban must NOT have expiration
                $this->assertNull(
                    $ban->getAttribute('expires_at'),
                    'Permanent ban must not have expiration'
                );

                // Property: Permanent ban must be active
                $this->assertTrue(
                    $ban->isActive(),
                    'Permanent ban must be active'
                );

                // Property: isPermanent() must return true
                $this->assertTrue(
                    $ban->isPermanent(),
                    'isPermanent() must return true for permanent bans'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 14: Ban Application**
     * 
     * *For any* user with an active ban, checkUserBanStatus SHALL return 
     * isBanned = true with the correct ban information.
     * 
     * **Validates: Requirements 6.3**
     * 
     * @test
     */
    public function checkUserBanStatusReturnsCorrectStatus(): void
    {
        $this
            ->minimumEvaluationRatio(0.0)
            ->forAll(
                Generators::elements([UserBan::TYPE_TEMPORARY, UserBan::TYPE_PERMANENT])
            )
            ->withMaxSize(100)
            ->then(function (string $banType) {
                // Clear previous bans
                $this->banService->clearBans();
                
                $userId = $this->generateUuid();
                $reportId = $this->generateUuid();
                $reason = 'Test ban reason for ' . $banType;
                $durationDays = $banType === UserBan::TYPE_TEMPORARY ? 7 : null;

                // Apply ban
                $ban = $this->banService->applyBan(
                    $userId,
                    $reportId,
                    $banType,
                    $reason,
                    $durationDays
                );

                // Check status
                $status = $this->banService->checkUserBanStatus($userId);

                // Property: Status must indicate banned
                $this->assertTrue(
                    $status->isBanned,
                    'User with active ban must have isBanned = true'
                );

                // Property: Ban type must match
                $this->assertEquals(
                    $banType,
                    $status->banType,
                    'Ban type in status must match'
                );

                // Property: Reason must match
                $this->assertEquals(
                    $reason,
                    $status->reason,
                    'Reason in status must match'
                );

                // Property: Report ID must match
                $this->assertEquals(
                    $reportId,
                    $status->reportId,
                    'Report ID in status must match'
                );

                // Property: Can appeal if has report_id
                $this->assertTrue(
                    $status->canAppeal,
                    'User with report_id should be able to appeal'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 14: Ban Application**
     * 
     * *For any* user without an active ban, checkUserBanStatus SHALL return 
     * isBanned = false.
     * 
     * **Validates: Requirements 6.3**
     * 
     * @test
     */
    public function checkUserBanStatusReturnsNotBannedForUnbannedUser(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $userId = $this->generateUuid();

                // Check status for user with no bans
                $status = $this->banService->checkUserBanStatus($userId);

                // Property: Status must indicate not banned
                $this->assertFalse(
                    $status->isBanned,
                    'User without ban must have isBanned = false'
                );

                // Property: Ban type must be null
                $this->assertNull($status->banType);

                // Property: Reason must be null
                $this->assertNull($status->reason);

                // Property: Cannot appeal if not banned
                $this->assertFalse($status->canAppeal);
            });
    }

    /**
     * **Feature: report-violation-system, Property 14: Ban Application**
     * 
     * *For any* invalid ban type, applyBan SHALL throw an exception.
     * 
     * **Validates: Requirements 6.1**
     * 
     * @test
     */
    public function applyBanRejectsInvalidBanType(): void
    {
        // Use predefined invalid types instead of suchThat to avoid evaluation ratio issues
        $invalidTypes = ['invalid', 'banned', 'suspended', 'blocked', 'temp', 'perm', 'warn', 'kick', 'mute'];
        
        $this
            ->forAll(
                Generators::elements($invalidTypes)
            )
            ->withMaxSize(100)
            ->then(function (string $invalidType) {
                $userId = $this->generateUuid();

                $this->expectException(\InvalidArgumentException::class);
                
                $this->banService->applyBan(
                    $userId,
                    null,
                    $invalidType,
                    'Test reason',
                    null
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 14: Ban Application**
     * 
     * *For any* empty reason, applyBan SHALL throw an exception.
     * 
     * **Validates: Requirements 6.2**
     * 
     * @test
     */
    public function applyBanRejectsEmptyReason(): void
    {
        $this
            ->forAll(
                Generators::elements(UserBan::VALID_TYPES),
                Generators::elements(['', '   ', "\t", "\n"])  // Empty/whitespace reasons
            )
            ->withMaxSize(100)
            ->then(function (string $banType, string $emptyReason) {
                $userId = $this->generateUuid();

                $this->expectException(\InvalidArgumentException::class);
                
                $this->banService->applyBan(
                    $userId,
                    null,
                    $banType,
                    $emptyReason,
                    $banType === UserBan::TYPE_TEMPORARY ? 7 : null
                );
            });
    }
}
