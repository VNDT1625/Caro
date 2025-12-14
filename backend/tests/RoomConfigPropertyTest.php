<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Services\RoomConfigService;

/**
 * Property-Based Tests for RoomConfigService
 * 
 * **Feature: swap2-opening-rule**
 * 
 * Tests the room configuration properties including Swap 2 settings
 * and ranked mode enforcement.
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 */
class RoomConfigPropertyTest extends TestCase
{
    use TestTrait;

    private RoomConfigService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->erisSetup();
        $this->service = new RoomConfigService();
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
     * **Feature: swap2-opening-rule, Property 8: Ranked Mode Enforcement**
     * 
     * *For any* game created with mode="ranked", swap2Enabled SHALL be true 
     * and cannot be changed.
     * 
     * **Validates: Requirements 4.1**
     * 
     * @test
     */
    public function rankedModeEnforcement(): void
    {
        $this
            ->forAll(
                Generators::elements([true, false, null])  // Various swap2_enabled requests
            )
            ->withMaxSize(100)
            ->then(function ($requestedSwap2Enabled) {
                $roomId = $this->generateUuid();
                
                // Property: For ranked mode, swap2_enabled SHALL always be true
                // regardless of what was requested
                $config = $this->service->createRoomConfig($roomId, 'ranked', $requestedSwap2Enabled);
                
                $this->assertTrue(
                    $config['swap2_enabled'],
                    "Ranked mode must have swap2_enabled=true, but got: " . 
                    var_export($config['swap2_enabled'], true) .
                    " when requested: " . var_export($requestedSwap2Enabled, true)
                );
                
                // Property: swap2_required SHALL be true for ranked mode
                $this->assertTrue(
                    $config['swap2_required'],
                    "Ranked mode must have swap2_required=true"
                );
                
                // Property: mode SHALL be 'ranked'
                $this->assertEquals('ranked', $config['mode']);
                
                // Property: room_id SHALL match
                $this->assertEquals($roomId, $config['room_id']);
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 8: Ranked Mode Enforcement (getEffectiveSwap2Enabled)**
     * 
     * *For any* request to getEffectiveSwap2Enabled with mode="ranked", 
     * the result SHALL be true regardless of the requested value.
     * 
     * **Validates: Requirements 4.1**
     * 
     * @test
     */
    public function rankedModeEnforcementEffectiveValue(): void
    {
        $this
            ->forAll(
                Generators::elements([true, false, null])  // Various swap2_enabled requests
            )
            ->withMaxSize(100)
            ->then(function ($requestedSwap2Enabled) {
                // Property: getEffectiveSwap2Enabled SHALL return true for ranked mode
                $effectiveValue = $this->service->getEffectiveSwap2Enabled('ranked', $requestedSwap2Enabled);
                
                $this->assertTrue(
                    $effectiveValue,
                    "getEffectiveSwap2Enabled('ranked', " . var_export($requestedSwap2Enabled, true) . 
                    ") must return true, but got: " . var_export($effectiveValue, true)
                );
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 8: Ranked Mode Enforcement (isSwap2Required)**
     * 
     * *For any* call to isSwap2Required with mode="ranked", the result SHALL be true.
     * 
     * **Validates: Requirements 4.1**
     * 
     * @test
     */
    public function rankedModeIsSwap2Required(): void
    {
        $this
            ->forAll(Generators::int())  // Just to run multiple iterations
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                // Property: isSwap2Required SHALL return true for ranked mode
                $this->assertTrue(
                    $this->service->isSwap2Required('ranked'),
                    "isSwap2Required('ranked') must return true"
                );
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 9: Disabled Swap 2 Behavior**
     * 
     * *For any* game with swap2Enabled=false, the initial gamePhase SHALL be 
     * "main_game" with currentTurn="X" and no swap2State.
     * 
     * **Validates: Requirements 4.3**
     * 
     * @test
     */
    public function disabledSwap2Behavior(): void
    {
        $this
            ->forAll(
                Generators::elements(['tieu_dao', 'van_mon', 'di_bien_ky', 'custom', 'casual'])  // Non-ranked modes
            )
            ->withMaxSize(100)
            ->then(function (string $mode) {
                $roomId = $this->generateUuid();
                
                // Create room with swap2_enabled=false
                $config = $this->service->createRoomConfig($roomId, $mode, false);
                
                // Property: swap2_enabled SHALL be false when explicitly set to false
                $this->assertFalse(
                    $config['swap2_enabled'],
                    "Non-ranked mode with swap2_enabled=false must have swap2_enabled=false"
                );
                
                // Property: swap2_required SHALL be false for non-ranked modes
                $this->assertFalse(
                    $config['swap2_required'],
                    "Non-ranked mode must have swap2_required=false"
                );
                
                // Property: mode SHALL match the requested mode
                $this->assertEquals($mode, $config['mode']);
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 9: Disabled Swap 2 Behavior (Default)**
     * 
     * *For any* non-ranked game created without specifying swap2_enabled,
     * swap2_enabled SHALL default to false.
     * 
     * **Validates: Requirements 4.3**
     * 
     * @test
     */
    public function disabledSwap2BehaviorDefault(): void
    {
        $this
            ->forAll(
                Generators::elements(['tieu_dao', 'van_mon', 'di_bien_ky', 'custom', 'casual'])  // Non-ranked modes
            )
            ->withMaxSize(100)
            ->then(function (string $mode) {
                $roomId = $this->generateUuid();
                
                // Create room without specifying swap2_enabled (should default to false)
                $config = $this->service->createRoomConfig($roomId, $mode, null);
                
                // Property: swap2_enabled SHALL default to false for non-ranked modes
                $this->assertFalse(
                    $config['swap2_enabled'],
                    "Non-ranked mode without swap2_enabled specified must default to false"
                );
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 9: Disabled Swap 2 Behavior (getEffectiveSwap2Enabled)**
     * 
     * *For any* non-ranked mode with swap2_enabled=false or null,
     * getEffectiveSwap2Enabled SHALL return false.
     * 
     * **Validates: Requirements 4.3**
     * 
     * @test
     */
    public function disabledSwap2BehaviorEffectiveValue(): void
    {
        $this
            ->forAll(
                Generators::elements(['tieu_dao', 'van_mon', 'di_bien_ky', 'custom', 'casual']),  // Non-ranked modes
                Generators::elements([false, null])  // Disabled or unspecified
            )
            ->withMaxSize(100)
            ->then(function (string $mode, $requestedSwap2Enabled) {
                // Property: getEffectiveSwap2Enabled SHALL return false for non-ranked modes
                // when swap2_enabled is false or null
                $effectiveValue = $this->service->getEffectiveSwap2Enabled($mode, $requestedSwap2Enabled);
                
                $this->assertFalse(
                    $effectiveValue,
                    "getEffectiveSwap2Enabled('{$mode}', " . var_export($requestedSwap2Enabled, true) . 
                    ") must return false, but got: " . var_export($effectiveValue, true)
                );
            });
    }

    /**
     * Test that non-ranked modes can have swap2_enabled=true when explicitly requested.
     * 
     * **Validates: Requirements 4.2**
     * 
     * @test
     */
    public function nonRankedModeCanEnableSwap2(): void
    {
        $this
            ->forAll(
                Generators::elements(['tieu_dao', 'van_mon', 'di_bien_ky', 'custom', 'casual'])  // Non-ranked modes
            )
            ->withMaxSize(100)
            ->then(function (string $mode) {
                $roomId = $this->generateUuid();
                
                // Create room with swap2_enabled=true
                $config = $this->service->createRoomConfig($roomId, $mode, true);
                
                // Property: Non-ranked modes CAN have swap2_enabled=true when requested
                $this->assertTrue(
                    $config['swap2_enabled'],
                    "Non-ranked mode with swap2_enabled=true must have swap2_enabled=true"
                );
                
                // Property: swap2_required SHALL still be false (it's optional)
                $this->assertFalse(
                    $config['swap2_required'],
                    "Non-ranked mode must have swap2_required=false even when swap2 is enabled"
                );
            });
    }

    /**
     * Test room configuration retrieval.
     * 
     * **Validates: Requirements 4.5**
     * 
     * @test
     */
    public function roomConfigRetrieval(): void
    {
        $this
            ->forAll(
                Generators::elements(RoomConfigService::SUPPORTED_MODES),
                Generators::elements([true, false])
            )
            ->withMaxSize(100)
            ->then(function (string $mode, bool $swap2Enabled) {
                $roomId = $this->generateUuid();
                
                // Create room config
                $createdConfig = $this->service->createRoomConfig($roomId, $mode, $swap2Enabled);
                
                // Retrieve room config
                $retrievedConfig = $this->service->getRoomConfig($roomId);
                
                // Property: Retrieved config SHALL match created config
                $this->assertNotNull($retrievedConfig, "Room config must be retrievable");
                $this->assertEquals(
                    $createdConfig['room_id'],
                    $retrievedConfig['room_id'],
                    "Retrieved room_id must match"
                );
                $this->assertEquals(
                    $createdConfig['mode'],
                    $retrievedConfig['mode'],
                    "Retrieved mode must match"
                );
                $this->assertEquals(
                    $createdConfig['swap2_enabled'],
                    $retrievedConfig['swap2_enabled'],
                    "Retrieved swap2_enabled must match"
                );
            });
    }

    /**
     * Test isSwap2Enabled method.
     * 
     * **Validates: Requirements 4.5**
     * 
     * @test
     */
    public function isSwap2EnabledMethod(): void
    {
        $this
            ->forAll(
                Generators::elements(RoomConfigService::SUPPORTED_MODES),
                Generators::elements([true, false])
            )
            ->withMaxSize(100)
            ->then(function (string $mode, bool $requestedSwap2Enabled) {
                $roomId = $this->generateUuid();
                
                // Create room config
                $config = $this->service->createRoomConfig($roomId, $mode, $requestedSwap2Enabled);
                
                // Property: isSwap2Enabled SHALL return the effective swap2_enabled value
                $this->assertEquals(
                    $config['swap2_enabled'],
                    $this->service->isSwap2Enabled($roomId),
                    "isSwap2Enabled must return the effective swap2_enabled value"
                );
            });
    }

    /**
     * Test that non-existent room returns false for isSwap2Enabled.
     * 
     * @test
     */
    public function isSwap2EnabledNonExistentRoom(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $nonExistentRoomId = $this->generateUuid();
                
                // Property: isSwap2Enabled SHALL return false for non-existent rooms
                $this->assertFalse(
                    $this->service->isSwap2Enabled($nonExistentRoomId),
                    "isSwap2Enabled must return false for non-existent rooms"
                );
            });
    }

    /**
     * Test invalid mode rejection.
     * 
     * @test
     */
    public function invalidModeRejection(): void
    {
        $this
            ->forAll(
                Generators::elements(['invalid', 'unknown', 'test', 'RANKED', 'Casual'])  // Invalid modes
            )
            ->withMaxSize(100)
            ->then(function (string $invalidMode) {
                $roomId = $this->generateUuid();
                
                // Property: Invalid modes SHALL throw InvalidArgumentException
                $exceptionThrown = false;
                try {
                    $this->service->createRoomConfig($roomId, $invalidMode, false);
                } catch (\InvalidArgumentException $e) {
                    $exceptionThrown = true;
                    $this->assertStringContainsString('Unsupported', $e->getMessage());
                }
                
                $this->assertTrue(
                    $exceptionThrown,
                    "Invalid mode '{$invalidMode}' must throw InvalidArgumentException"
                );
            });
    }

    /**
     * Test room config cleanup.
     * 
     * @test
     */
    public function roomConfigCleanup(): void
    {
        $this
            ->forAll(
                Generators::elements(RoomConfigService::SUPPORTED_MODES)
            )
            ->withMaxSize(100)
            ->then(function (string $mode) {
                $roomId = $this->generateUuid();
                
                // Create room config
                $this->service->createRoomConfig($roomId, $mode, false);
                $this->assertNotNull($this->service->getRoomConfig($roomId));
                
                // Clear room config
                $this->service->clearRoomConfig($roomId);
                
                // Property: After clearing, room config SHALL be null
                $this->assertNull(
                    $this->service->getRoomConfig($roomId),
                    "Room config must be null after clearing"
                );
            });
    }
}
