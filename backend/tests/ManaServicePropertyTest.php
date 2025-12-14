<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Services\ManaService;
use App\Services\ManaServiceInterface;

/**
 * Property-Based Tests for ManaService
 *
 * **Feature: caro-skill-system (Phase 1: Core Mana System)**
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 */
class ManaServicePropertyTest extends TestCase
{
    use TestTrait;

    private ManaService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->erisSetup();
        $this->service = new ManaService();
    }

    protected function tearDown(): void
    {
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
     * Property 1: Mana Initialization (Requirement 1.1)
     * When a player is initialized, mana starts at INITIAL_MANA.
     */
    public function testManaInitializationStartsAtFive(): void
    {
        $this
            ->forAll(Generators::nat())
            ->then(function (int $seed): void {
                $playerId = "player-{$seed}";
                $this->service->initPlayer($playerId);

                $this->assertSame(
                    ManaServiceInterface::INITIAL_MANA,
                    $this->service->getMana($playerId)
                );
            });
    }

    /**
     * Property 2 & 3: Mana Regeneration and Cap (Requirements 1.2, 1.3)
     * +3 per turn, capped at MANA_CAP.
     */
    public function testManaRegenerationAndCap(): void
    {
        $this
            ->forAll(Generators::choose(0, 20))
            ->then(function (int $turns): void {
                $playerId = "regen-{$turns}";
                $this->service->initPlayer($playerId);

                for ($i = 0; $i < $turns; $i++) {
                    $current = $this->service->addMana($playerId);
                    $this->assertLessThanOrEqual(ManaServiceInterface::MANA_CAP, $current);
                }

                $expected = min(
                    ManaServiceInterface::INITIAL_MANA + $turns * ManaServiceInterface::MANA_PER_TURN,
                    ManaServiceInterface::MANA_CAP
                );

                $this->assertSame($expected, $this->service->getMana($playerId));
            });
    }

    /**
     * Property 4: Mana Deduction (Requirement 1.4)
     * Deducting an affordable cost reduces mana accordingly.
     */
    public function testManaDeductionReducesMana(): void
    {
        $this
            ->forAll(Generators::choose(0, ManaServiceInterface::MANA_CAP))
            ->then(function (int $cost): void {
                $playerId = "deduct-{$cost}";
                $this->service->initPlayer($playerId);
                $this->service->addMana($playerId, ManaServiceInterface::MANA_CAP); // boost to cap

                $error = null;
                $result = $this->service->deductMana($playerId, $cost, $error);

                $this->assertTrue($result);
                $this->assertNull($error);
                $this->assertSame(
                    ManaServiceInterface::MANA_CAP - max(0, $cost),
                    $this->service->getMana($playerId)
                );
            });
    }

    /**
     * Property 5: Insufficient Mana Rejection (Requirement 1.5)
     * Deduction fails and mana remains unchanged when cost is too high.
     */
    public function testInsufficientManaIsRejected(): void
    {
        $this
            ->forAll(Generators::choose(
                ManaServiceInterface::INITIAL_MANA + 1,
                ManaServiceInterface::INITIAL_MANA + 10
            ))
            ->then(function (int $cost): void {
                $playerId = "insufficient-{$cost}";
                $this->service->initPlayer($playerId);

                $before = $this->service->getMana($playerId);
                $error = null;
                $result = $this->service->deductMana($playerId, $cost, $error);

                $this->assertFalse($result);
                $this->assertSame(ManaServiceInterface::ERROR_INSUFFICIENT_MANA, $error);
                $this->assertSame($before, $this->service->getMana($playerId));
            });
    }

    /**
     * Property 6: Retention cost map (Requirements 4.1, 4.2, 4.3)
     * Chi phi giu bai phai dung theo do hiem, default = common.
     */
    public function testRetentionCostMapping(): void
    {
        $cases = [
            'common' => 1,
            'rare' => 2,
            'legendary' => 3,
            'COMMON' => 1,
            'unknown' => 1,
        ];

        foreach ($cases as $rarity => $expected) {
            $this->assertSame($expected, $this->service->getRetentionCost($rarity));
        }
    }
}
