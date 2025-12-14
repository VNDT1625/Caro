<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Services\Swap2ManagerService;
use App\Services\Swap2State;

/**
 * Property-Based Tests for Swap2ManagerService
 * 
 * **Feature: swap2-opening-rule**
 * 
 * Tests the core properties of the Swap2Manager service including
 * initialization, state machine transitions, stone placement, and color assignment.
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3**
 */
class Swap2ManagerPropertyTest extends TestCase
{
    use TestTrait;

    private Swap2ManagerService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->erisSetup();
        $this->service = new Swap2ManagerService();
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
     * **Feature: swap2-opening-rule, Property 1: Initial Phase Correctness**
     * 
     * *For any* game with swap2Enabled=true, the initial gamePhase SHALL be "swap2" 
     * and swap2State.phase SHALL be "swap2_placement" with player1 as activePlayer.
     * 
     * **Validates: Requirements 1.1**
     * 
     * @test
     */
    public function initialPhaseCorrectness(): void
    {
        $this
            ->forAll(
                Generators::int(),  // Just to generate multiple test cases
                Generators::int()
            )
            ->withMaxSize(100)
            ->then(function (int $_unused1, int $_unused2) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Property: Phase SHALL be "swap2_placement"
                $this->assertEquals(
                    Swap2State::PHASE_PLACEMENT,
                    $state->getPhase(),
                    'Initial phase must be swap2_placement'
                );

                // Property: Player 1 SHALL be active player
                $this->assertEquals(
                    $player1Id,
                    $state->getActivePlayerId(),
                    'Player 1 must be the active player initially'
                );

                // Property: Player IDs SHALL be recorded correctly
                $this->assertEquals($player1Id, $state->getPlayer1Id());
                $this->assertEquals($player2Id, $state->getPlayer2Id());

                // Property: No stones SHALL be placed initially
                $this->assertCount(
                    0,
                    $state->getTentativeStones(),
                    'No stones should be placed initially'
                );

                // Property: No color assignments SHALL exist initially
                $this->assertNull($state->getBlackPlayerId());
                $this->assertNull($state->getWhitePlayerId());

                // Property: No final choice SHALL exist initially
                $this->assertNull($state->getFinalChoice());

                // Property: Actions array SHALL be empty initially
                $this->assertCount(0, $state->getActions());

                // Property: isComplete SHALL return false
                $this->assertFalse($this->service->isComplete($state));
            });
    }


    /**
     * **Feature: swap2-opening-rule, Property 2: State Machine Transition Correctness**
     * 
     * *For any* valid Swap 2 action sequence, the phase transitions SHALL follow the 
     * defined state machine: placement(3) → choice → [extra(2) → final_choice] → complete.
     * 
     * **Validates: Requirements 1.2, 1.3, 1.5, 1.6**
     * 
     * @test
     */
    public function stateMachineTransitionCorrectness(): void
    {
        $this
            ->forAll(
                Generators::elements(['black', 'white', 'place_more'])  // P2's choice
            )
            ->withMaxSize(100)
            ->then(function (string $player2Choice) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Phase 1: swap2_placement - Player 1 places 3 stones
                $this->assertEquals(Swap2State::PHASE_PLACEMENT, $state->getPhase());
                $this->assertEquals($player1Id, $state->getActivePlayerId());

                // Place stone 1
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $this->assertEquals(Swap2State::PHASE_PLACEMENT, $state->getPhase());
                $this->assertEquals(1, $state->getStoneCount());

                // Place stone 2
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $this->assertEquals(Swap2State::PHASE_PLACEMENT, $state->getPhase());
                $this->assertEquals(2, $state->getStoneCount());

                // Place stone 3 - should transition to swap2_choice
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);
                $this->assertEquals(
                    Swap2State::PHASE_CHOICE,
                    $state->getPhase(),
                    'After 3 stones, phase must transition to swap2_choice'
                );
                $this->assertEquals(
                    $player2Id,
                    $state->getActivePlayerId(),
                    'After 3 stones, Player 2 must be active'
                );
                $this->assertEquals(3, $state->getStoneCount());

                // Phase 2: swap2_choice - Player 2 makes choice
                $state = $this->service->makeChoice($gameId, $player2Id, $player2Choice);

                if ($player2Choice === 'place_more') {
                    // Should transition to swap2_extra
                    $this->assertEquals(
                        Swap2State::PHASE_EXTRA,
                        $state->getPhase(),
                        'After place_more choice, phase must be swap2_extra'
                    );
                    $this->assertEquals(
                        $player2Id,
                        $state->getActivePlayerId(),
                        'Player 2 must remain active for extra placement'
                    );

                    // Place stone 4
                    $state = $this->service->placeStone($gameId, $player2Id, 8, 8);
                    $this->assertEquals(Swap2State::PHASE_EXTRA, $state->getPhase());
                    $this->assertEquals(4, $state->getStoneCount());

                    // Place stone 5 - should transition to swap2_final_choice
                    $state = $this->service->placeStone($gameId, $player2Id, 9, 9);
                    $this->assertEquals(
                        Swap2State::PHASE_FINAL_CHOICE,
                        $state->getPhase(),
                        'After 5 stones, phase must be swap2_final_choice'
                    );
                    $this->assertEquals(
                        $player1Id,
                        $state->getActivePlayerId(),
                        'Player 1 must be active for final choice'
                    );
                    $this->assertEquals(5, $state->getStoneCount());

                    // Phase 3: swap2_final_choice - Player 1 chooses color
                    $state = $this->service->makeChoice($gameId, $player1Id, 'black');
                    $this->assertEquals(
                        Swap2State::PHASE_COMPLETE,
                        $state->getPhase(),
                        'After final choice, phase must be complete'
                    );
                } else {
                    // Direct choice (black or white) - should complete immediately
                    $this->assertEquals(
                        Swap2State::PHASE_COMPLETE,
                        $state->getPhase(),
                        'After direct color choice, phase must be complete'
                    );
                }

                // Property: isComplete SHALL return true at the end
                $this->assertTrue($this->service->isComplete($state));

                // Property: Color assignments SHALL be set
                $this->assertNotNull($state->getBlackPlayerId());
                $this->assertNotNull($state->getWhitePlayerId());
            });
    }


    /**
     * **Feature: swap2-opening-rule, Property 3: Stone Count Invariant**
     * 
     * *For any* Swap 2 state, the number of tentativeStones SHALL equal:
     * - 0-3 in swap2_placement phase
     * - 3 in swap2_choice phase
     * - 3-5 in swap2_extra phase
     * - 5 in swap2_final_choice phase (if reached)
     * 
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * @test
     */
    public function stoneCountInvariant(): void
    {
        $this
            ->forAll(
                Generators::choose(0, 2)  // Number of stones to place in initial phase (0-2)
            )
            ->withMaxSize(100)
            ->then(function (int $initialStonesToPlace) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place stones in swap2_placement phase
                $positions = [[7, 7], [7, 8], [8, 7]];
                for ($i = 0; $i < $initialStonesToPlace; $i++) {
                    $state = $this->service->placeStone(
                        $gameId,
                        $player1Id,
                        $positions[$i][0],
                        $positions[$i][1]
                    );
                }

                // Property: In swap2_placement, stone count SHALL be 0-3
                $this->assertEquals(Swap2State::PHASE_PLACEMENT, $state->getPhase());
                $this->assertGreaterThanOrEqual(0, $state->getStoneCount());
                $this->assertLessThanOrEqual(3, $state->getStoneCount());
                $this->assertEquals($initialStonesToPlace, $state->getStoneCount());
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 3: Stone Count Invariant (Choice Phase)**
     * 
     * *For any* Swap 2 state in swap2_choice phase, stone count SHALL be exactly 3.
     * 
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * @test
     */
    public function stoneCountInvariantChoicePhase(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place 3 stones to reach choice phase
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);

                // Property: In swap2_choice, stone count SHALL be exactly 3
                $this->assertEquals(Swap2State::PHASE_CHOICE, $state->getPhase());
                $this->assertEquals(3, $state->getStoneCount());
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 3: Stone Count Invariant (Extra Phase)**
     * 
     * *For any* Swap 2 state in swap2_extra phase, stone count SHALL be 3-5.
     * 
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * @test
     */
    public function stoneCountInvariantExtraPhase(): void
    {
        $this
            ->forAll(
                Generators::choose(0, 1)  // Number of extra stones to place (0-1)
            )
            ->withMaxSize(100)
            ->then(function (int $extraStonesToPlace) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place 3 stones
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);

                // Choose place_more
                $state = $this->service->makeChoice($gameId, $player2Id, 'place_more');
                $this->assertEquals(Swap2State::PHASE_EXTRA, $state->getPhase());

                // Place extra stones
                $extraPositions = [[8, 8], [9, 9]];
                for ($i = 0; $i < $extraStonesToPlace; $i++) {
                    $state = $this->service->placeStone(
                        $gameId,
                        $player2Id,
                        $extraPositions[$i][0],
                        $extraPositions[$i][1]
                    );
                }

                // Property: In swap2_extra, stone count SHALL be 3-5
                if ($state->getPhase() === Swap2State::PHASE_EXTRA) {
                    $this->assertGreaterThanOrEqual(3, $state->getStoneCount());
                    $this->assertLessThan(5, $state->getStoneCount());
                }
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 3: Stone Count Invariant (Final Choice Phase)**
     * 
     * *For any* Swap 2 state in swap2_final_choice phase, stone count SHALL be exactly 5.
     * 
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * @test
     */
    public function stoneCountInvariantFinalChoicePhase(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place 3 stones
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);

                // Choose place_more
                $state = $this->service->makeChoice($gameId, $player2Id, 'place_more');

                // Place 2 more stones
                $state = $this->service->placeStone($gameId, $player2Id, 8, 8);
                $state = $this->service->placeStone($gameId, $player2Id, 9, 9);

                // Property: In swap2_final_choice, stone count SHALL be exactly 5
                $this->assertEquals(Swap2State::PHASE_FINAL_CHOICE, $state->getPhase());
                $this->assertEquals(5, $state->getStoneCount());
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 4: Occupied Cell Rejection**
     * 
     * *For any* stone placement attempt on a cell that already has a tentativeStone, 
     * the Swap2Manager SHALL reject the move and state SHALL remain unchanged.
     * 
     * **Validates: Requirements 2.4**
     * 
     * @test
     */
    public function occupiedCellRejection(): void
    {
        $this
            ->forAll(
                Generators::choose(0, 14),  // x coordinate for first stone
                Generators::choose(0, 14)   // y coordinate for first stone
            )
            ->withMaxSize(100)
            ->then(function (int $x, int $y) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place first stone at (x, y)
                $state = $this->service->placeStone($gameId, $player1Id, $x, $y);
                
                // Capture state before attempting duplicate placement
                $stoneCountBefore = $state->getStoneCount();
                $phaseBefore = $state->getPhase();
                $activePlayerBefore = $state->getActivePlayerId();

                // Property: Attempting to place on occupied cell SHALL throw exception
                $exceptionThrown = false;
                try {
                    $this->service->placeStone($gameId, $player1Id, $x, $y);
                } catch (\InvalidArgumentException $e) {
                    $exceptionThrown = true;
                    $this->assertStringContainsString('occupied', strtolower($e->getMessage()));
                }

                $this->assertTrue(
                    $exceptionThrown,
                    "Placing stone on occupied cell ({$x}, {$y}) must throw InvalidArgumentException"
                );

                // Property: State SHALL remain unchanged after rejection
                $stateAfter = $this->service->getState($gameId);
                $this->assertEquals(
                    $stoneCountBefore,
                    $stateAfter->getStoneCount(),
                    'Stone count must remain unchanged after rejected placement'
                );
                $this->assertEquals(
                    $phaseBefore,
                    $stateAfter->getPhase(),
                    'Phase must remain unchanged after rejected placement'
                );
                $this->assertEquals(
                    $activePlayerBefore,
                    $stateAfter->getActivePlayerId(),
                    'Active player must remain unchanged after rejected placement'
                );
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 4: Occupied Cell Rejection (Extra Phase)**
     * 
     * *For any* stone placement attempt during swap2_extra phase on a cell that already 
     * has a tentativeStone (from initial placement), the Swap2Manager SHALL reject the move.
     * 
     * **Validates: Requirements 2.4**
     * 
     * @test
     */
    public function occupiedCellRejectionExtraPhase(): void
    {
        $this
            ->forAll(
                Generators::choose(0, 2)  // Which of the 3 initial stones to try to overwrite
            )
            ->withMaxSize(100)
            ->then(function (int $stoneIndex) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Initial stone positions
                $initialPositions = [[7, 7], [7, 8], [8, 7]];

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place 3 initial stones
                foreach ($initialPositions as $pos) {
                    $state = $this->service->placeStone($gameId, $player1Id, $pos[0], $pos[1]);
                }

                // Choose place_more to enter extra phase
                $state = $this->service->makeChoice($gameId, $player2Id, 'place_more');
                $this->assertEquals(Swap2State::PHASE_EXTRA, $state->getPhase());

                // Try to place on one of the initial positions
                $targetPos = $initialPositions[$stoneIndex];
                $stoneCountBefore = $state->getStoneCount();

                // Property: Attempting to place on occupied cell SHALL throw exception
                $exceptionThrown = false;
                try {
                    $this->service->placeStone($gameId, $player2Id, $targetPos[0], $targetPos[1]);
                } catch (\InvalidArgumentException $e) {
                    $exceptionThrown = true;
                }

                $this->assertTrue(
                    $exceptionThrown,
                    "Placing stone on occupied cell ({$targetPos[0]}, {$targetPos[1]}) in extra phase must throw exception"
                );

                // Property: State SHALL remain unchanged
                $stateAfter = $this->service->getState($gameId);
                $this->assertEquals($stoneCountBefore, $stateAfter->getStoneCount());
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 5: Color Assignment Correctness**
     * 
     * *For any* completed Swap 2 sequence where a player chooses "black", that player 
     * SHALL be assigned blackPlayerId, and the other player SHALL be assigned whitePlayerId. 
     * Vice versa for "white" choice.
     * 
     * **Validates: Requirements 3.2, 3.3**
     * 
     * @test
     */
    public function colorAssignmentCorrectness(): void
    {
        $this
            ->forAll(
                Generators::elements(['black', 'white']),  // Direct choice by P2
                Generators::bool()  // Whether to test via place_more path
            )
            ->withMaxSize(100)
            ->then(function (string $colorChoice, bool $usePlaceMorePath) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place 3 initial stones
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);

                if ($usePlaceMorePath) {
                    // Test via place_more path - Player 1 makes final choice
                    $state = $this->service->makeChoice($gameId, $player2Id, 'place_more');
                    $state = $this->service->placeStone($gameId, $player2Id, 8, 8);
                    $state = $this->service->placeStone($gameId, $player2Id, 9, 9);
                    
                    // Player 1 makes the color choice
                    $state = $this->service->makeChoice($gameId, $player1Id, $colorChoice);
                    $chooserId = $player1Id;
                    $otherPlayerId = $player2Id;
                } else {
                    // Direct path - Player 2 makes the color choice
                    $state = $this->service->makeChoice($gameId, $player2Id, $colorChoice);
                    $chooserId = $player2Id;
                    $otherPlayerId = $player1Id;
                }

                // Property: Chooser who picks "black" SHALL be assigned blackPlayerId
                // Property: Chooser who picks "white" SHALL be assigned whitePlayerId
                if ($colorChoice === 'black') {
                    $this->assertEquals(
                        $chooserId,
                        $state->getBlackPlayerId(),
                        'Player who chose black must be assigned blackPlayerId'
                    );
                    $this->assertEquals(
                        $otherPlayerId,
                        $state->getWhitePlayerId(),
                        'Other player must be assigned whitePlayerId'
                    );
                } else {
                    $this->assertEquals(
                        $chooserId,
                        $state->getWhitePlayerId(),
                        'Player who chose white must be assigned whitePlayerId'
                    );
                    $this->assertEquals(
                        $otherPlayerId,
                        $state->getBlackPlayerId(),
                        'Other player must be assigned blackPlayerId'
                    );
                }

                // Property: Both assignments SHALL be set
                $this->assertNotNull($state->getBlackPlayerId());
                $this->assertNotNull($state->getWhitePlayerId());

                // Property: Assignments SHALL be different players
                $this->assertNotEquals(
                    $state->getBlackPlayerId(),
                    $state->getWhitePlayerId(),
                    'Black and white players must be different'
                );
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 6: Available Options Correctness**
     * 
     * *For any* swap2_choice phase, exactly 3 options SHALL be available: ["black", "white", "place_more"]. 
     * *For any* swap2_final_choice phase, exactly 2 options SHALL be available: ["black", "white"].
     * 
     * **Validates: Requirements 3.1, 3.5**
     * 
     * @test
     */
    public function availableOptionsCorrectness(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place 3 stones to reach swap2_choice phase
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);

                $this->assertEquals(Swap2State::PHASE_CHOICE, $state->getPhase());

                // Property: In swap2_choice, "black", "white", and "place_more" SHALL be valid
                $validChoicesInChoice = ['black', 'white', 'place_more'];
                foreach ($validChoicesInChoice as $choice) {
                    // Create fresh game for each test
                    $testGameId = $this->generateUuid();
                    $testState = $this->service->initializeSwap2($testGameId, $player1Id, $player2Id);
                    $testState = $this->service->placeStone($testGameId, $player1Id, 7, 7);
                    $testState = $this->service->placeStone($testGameId, $player1Id, 7, 8);
                    $testState = $this->service->placeStone($testGameId, $player1Id, 8, 7);
                    
                    // Should not throw exception
                    $resultState = $this->service->makeChoice($testGameId, $player2Id, $choice);
                    $this->assertNotNull($resultState, "Choice '{$choice}' should be valid in swap2_choice phase");
                }

                // Property: In swap2_choice, invalid choices SHALL be rejected
                $invalidChoice = 'invalid_option';
                $exceptionThrown = false;
                try {
                    $testGameId2 = $this->generateUuid();
                    $testState2 = $this->service->initializeSwap2($testGameId2, $player1Id, $player2Id);
                    $testState2 = $this->service->placeStone($testGameId2, $player1Id, 7, 7);
                    $testState2 = $this->service->placeStone($testGameId2, $player1Id, 7, 8);
                    $testState2 = $this->service->placeStone($testGameId2, $player1Id, 8, 7);
                    $this->service->makeChoice($testGameId2, $player2Id, $invalidChoice);
                } catch (\InvalidArgumentException $e) {
                    $exceptionThrown = true;
                }
                $this->assertTrue($exceptionThrown, 'Invalid choice must throw exception');
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 6: Available Options Correctness (Final Choice Phase)**
     * 
     * *For any* swap2_final_choice phase, exactly 2 options SHALL be available: ["black", "white"].
     * "place_more" SHALL NOT be valid in this phase.
     * 
     * **Validates: Requirements 3.1, 3.5**
     * 
     * @test
     */
    public function availableOptionsFinalChoicePhase(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place 3 stones
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);

                // Choose place_more to reach swap2_final_choice
                $state = $this->service->makeChoice($gameId, $player2Id, 'place_more');
                $state = $this->service->placeStone($gameId, $player2Id, 8, 8);
                $state = $this->service->placeStone($gameId, $player2Id, 9, 9);

                $this->assertEquals(Swap2State::PHASE_FINAL_CHOICE, $state->getPhase());

                // Property: In swap2_final_choice, "black" and "white" SHALL be valid
                foreach (['black', 'white'] as $choice) {
                    $testGameId = $this->generateUuid();
                    $testState = $this->service->initializeSwap2($testGameId, $player1Id, $player2Id);
                    $testState = $this->service->placeStone($testGameId, $player1Id, 7, 7);
                    $testState = $this->service->placeStone($testGameId, $player1Id, 7, 8);
                    $testState = $this->service->placeStone($testGameId, $player1Id, 8, 7);
                    $testState = $this->service->makeChoice($testGameId, $player2Id, 'place_more');
                    $testState = $this->service->placeStone($testGameId, $player2Id, 8, 8);
                    $testState = $this->service->placeStone($testGameId, $player2Id, 9, 9);
                    
                    $resultState = $this->service->makeChoice($testGameId, $player1Id, $choice);
                    $this->assertNotNull($resultState, "Choice '{$choice}' should be valid in swap2_final_choice phase");
                }

                // Property: In swap2_final_choice, "place_more" SHALL be rejected
                $exceptionThrown = false;
                try {
                    $testGameId2 = $this->generateUuid();
                    $testState2 = $this->service->initializeSwap2($testGameId2, $player1Id, $player2Id);
                    $testState2 = $this->service->placeStone($testGameId2, $player1Id, 7, 7);
                    $testState2 = $this->service->placeStone($testGameId2, $player1Id, 7, 8);
                    $testState2 = $this->service->placeStone($testGameId2, $player1Id, 8, 7);
                    $testState2 = $this->service->makeChoice($testGameId2, $player2Id, 'place_more');
                    $testState2 = $this->service->placeStone($testGameId2, $player2Id, 8, 8);
                    $testState2 = $this->service->placeStone($testGameId2, $player2Id, 9, 9);
                    $this->service->makeChoice($testGameId2, $player1Id, 'place_more');
                } catch (\InvalidArgumentException $e) {
                    $exceptionThrown = true;
                    $this->assertStringContainsString('Invalid choice', $e->getMessage());
                }
                $this->assertTrue($exceptionThrown, 'place_more must be rejected in swap2_final_choice phase');
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 7: Next Mover Determination**
     * 
     * *For any* completed Swap 2 sequence, the player assigned blackPlayerId SHALL be 
     * the first to move in main_game phase (currentTurn corresponds to black player).
     * 
     * **Validates: Requirements 3.6**
     * 
     * @test
     */
    public function nextMoverDetermination(): void
    {
        $this
            ->forAll(
                Generators::elements(['black', 'white']),  // Color choice
                Generators::bool()  // Whether to use place_more path
            )
            ->withMaxSize(100)
            ->then(function (string $colorChoice, bool $usePlaceMorePath) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place 3 initial stones
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);

                if ($usePlaceMorePath) {
                    // Place_more path
                    $state = $this->service->makeChoice($gameId, $player2Id, 'place_more');
                    $state = $this->service->placeStone($gameId, $player2Id, 8, 8);
                    $state = $this->service->placeStone($gameId, $player2Id, 9, 9);
                    $state = $this->service->makeChoice($gameId, $player1Id, $colorChoice);
                } else {
                    // Direct path
                    $state = $this->service->makeChoice($gameId, $player2Id, $colorChoice);
                }

                // Get final assignments
                $assignments = $this->service->getFinalAssignments($state);

                // Property: firstMover SHALL be the blackPlayerId
                $this->assertEquals(
                    $assignments->getBlackPlayerId(),
                    $assignments->getFirstMover(),
                    'First mover must be the black player'
                );

                // Property: firstMover SHALL match state's blackPlayerId
                $this->assertEquals(
                    $state->getBlackPlayerId(),
                    $assignments->getFirstMover(),
                    'First mover must match state blackPlayerId'
                );

                // Property: Black player is always first regardless of who chose
                $this->assertNotNull($assignments->getFirstMover());
                $this->assertNotEquals(
                    $assignments->getFirstMover(),
                    $assignments->getWhitePlayerId(),
                    'First mover must not be white player'
                );
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 11: State Persistence Round-Trip**
     * 
     * *For any* Swap 2 state, serializing to JSON and deserializing SHALL produce 
     * an equivalent state with same phase, tentativeStones, and activePlayerId.
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function statePersistenceRoundTrip(): void
    {
        $this
            ->forAll(
                Generators::choose(0, 5),  // Number of actions to perform
                Generators::elements(['direct_black', 'direct_white', 'place_more'])  // Path type
            )
            ->withMaxSize(100)
            ->then(function (int $actionCount, string $pathType) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Initialize state
                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Perform some actions based on actionCount
                $positions = [[7, 7], [7, 8], [8, 7], [8, 8], [9, 9]];
                $actionsPerformed = 0;

                // Place initial stones (up to 3)
                for ($i = 0; $i < min($actionCount, 3); $i++) {
                    $state = $this->service->placeStone($gameId, $player1Id, $positions[$i][0], $positions[$i][1]);
                    $actionsPerformed++;
                }

                // If we placed 3 stones and have more actions, make a choice
                if ($actionsPerformed >= 3 && $actionCount > 3) {
                    if ($pathType === 'place_more') {
                        $state = $this->service->makeChoice($gameId, $player2Id, 'place_more');
                        
                        // Place extra stones if we have more actions
                        for ($i = 3; $i < min($actionCount, 5); $i++) {
                            $state = $this->service->placeStone($gameId, $player2Id, $positions[$i][0], $positions[$i][1]);
                        }
                    } elseif ($pathType === 'direct_black') {
                        $state = $this->service->makeChoice($gameId, $player2Id, 'black');
                    } else {
                        $state = $this->service->makeChoice($gameId, $player2Id, 'white');
                    }
                }

                // Serialize the state
                $json = $this->service->serializeState($state);
                
                // Property: JSON SHALL be valid
                $this->assertJson($json, 'Serialized state must be valid JSON');

                // Deserialize the state
                $restoredState = $this->service->deserializeState($json);

                // Property: Phase SHALL be preserved
                $this->assertEquals(
                    $state->getPhase(),
                    $restoredState->getPhase(),
                    'Phase must be preserved after round-trip'
                );

                // Property: ActivePlayerId SHALL be preserved
                $this->assertEquals(
                    $state->getActivePlayerId(),
                    $restoredState->getActivePlayerId(),
                    'ActivePlayerId must be preserved after round-trip'
                );

                // Property: Player IDs SHALL be preserved
                $this->assertEquals(
                    $state->getPlayer1Id(),
                    $restoredState->getPlayer1Id(),
                    'Player1Id must be preserved after round-trip'
                );
                $this->assertEquals(
                    $state->getPlayer2Id(),
                    $restoredState->getPlayer2Id(),
                    'Player2Id must be preserved after round-trip'
                );

                // Property: TentativeStones count SHALL be preserved
                $this->assertEquals(
                    $state->getStoneCount(),
                    $restoredState->getStoneCount(),
                    'Stone count must be preserved after round-trip'
                );

                // Property: TentativeStones positions SHALL be preserved
                $originalStones = $state->getTentativeStones();
                $restoredStones = $restoredState->getTentativeStones();
                
                for ($i = 0; $i < count($originalStones); $i++) {
                    $this->assertEquals(
                        $originalStones[$i]->getX(),
                        $restoredStones[$i]->getX(),
                        "Stone {$i} X coordinate must be preserved"
                    );
                    $this->assertEquals(
                        $originalStones[$i]->getY(),
                        $restoredStones[$i]->getY(),
                        "Stone {$i} Y coordinate must be preserved"
                    );
                    $this->assertEquals(
                        $originalStones[$i]->getPlacedBy(),
                        $restoredStones[$i]->getPlacedBy(),
                        "Stone {$i} placedBy must be preserved"
                    );
                    $this->assertEquals(
                        $originalStones[$i]->getPlacementOrder(),
                        $restoredStones[$i]->getPlacementOrder(),
                        "Stone {$i} placementOrder must be preserved"
                    );
                }

                // Property: Actions count SHALL be preserved
                $this->assertEquals(
                    count($state->getActions()),
                    count($restoredState->getActions()),
                    'Actions count must be preserved after round-trip'
                );

                // Property: Color assignments SHALL be preserved (if set)
                $this->assertEquals(
                    $state->getBlackPlayerId(),
                    $restoredState->getBlackPlayerId(),
                    'BlackPlayerId must be preserved after round-trip'
                );
                $this->assertEquals(
                    $state->getWhitePlayerId(),
                    $restoredState->getWhitePlayerId(),
                    'WhitePlayerId must be preserved after round-trip'
                );

                // Property: FinalChoice SHALL be preserved (if set)
                $this->assertEquals(
                    $state->getFinalChoice(),
                    $restoredState->getFinalChoice(),
                    'FinalChoice must be preserved after round-trip'
                );
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 11: State Persistence Round-Trip (Reconnection)**
     * 
     * *For any* Swap 2 state, restoring state for reconnection SHALL produce 
     * an equivalent state that can continue the game correctly.
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function statePersistenceReconnection(): void
    {
        $this
            ->forAll(
                Generators::choose(1, 3)  // Number of stones placed before "disconnect"
            )
            ->withMaxSize(100)
            ->then(function (int $stonesBeforeDisconnect) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Initialize and place some stones
                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);
                
                $positions = [[7, 7], [7, 8], [8, 7]];
                for ($i = 0; $i < $stonesBeforeDisconnect; $i++) {
                    $state = $this->service->placeStone($gameId, $player1Id, $positions[$i][0], $positions[$i][1]);
                }

                // Simulate disconnect: serialize state
                $json = $this->service->serializeState($state);

                // Clear the in-memory state (simulating server restart or disconnect)
                $this->service->clearState($gameId);

                // Verify state is cleared
                $this->assertNull(
                    $this->service->getState($gameId),
                    'State should be cleared after clearState'
                );

                // Simulate reconnect: restore state
                $restoredState = $this->service->restoreStateForReconnection($gameId, $json);

                // Property: Restored state SHALL be accessible via getState
                $retrievedState = $this->service->getState($gameId);
                $this->assertNotNull(
                    $retrievedState,
                    'State should be accessible after reconnection'
                );

                // Property: Phase SHALL be preserved
                $this->assertEquals(
                    $state->getPhase(),
                    $retrievedState->getPhase(),
                    'Phase must be preserved after reconnection'
                );

                // Property: Stone count SHALL be preserved
                $this->assertEquals(
                    $state->getStoneCount(),
                    $retrievedState->getStoneCount(),
                    'Stone count must be preserved after reconnection'
                );

                // Property: Game SHALL be continuable after reconnection
                if ($stonesBeforeDisconnect < 3) {
                    // Can still place more stones
                    $nextPos = $positions[$stonesBeforeDisconnect];
                    $continuedState = $this->service->placeStone(
                        $gameId,
                        $player1Id,
                        $nextPos[0],
                        $nextPos[1]
                    );
                    $this->assertEquals(
                        $stonesBeforeDisconnect + 1,
                        $continuedState->getStoneCount(),
                        'Game should be continuable after reconnection'
                    );
                }
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 11: Swap 2 History Completeness**
     * 
     * *For any* completed Swap 2 sequence, the history SHALL contain all actions
     * and final assignments.
     * 
     * **Validates: Requirements 7.3**
     * 
     * @test
     */
    public function swap2HistoryCompleteness(): void
    {
        $this
            ->forAll(
                Generators::elements(['black', 'white']),  // Final color choice
                Generators::bool()  // Whether to use place_more path
            )
            ->withMaxSize(100)
            ->then(function (string $colorChoice, bool $usePlaceMorePath) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place 3 initial stones
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);

                $expectedActionCount = 3; // 3 placements

                if ($usePlaceMorePath) {
                    $state = $this->service->makeChoice($gameId, $player2Id, 'place_more');
                    $expectedActionCount++; // +1 for place_more choice
                    
                    $state = $this->service->placeStone($gameId, $player2Id, 8, 8);
                    $state = $this->service->placeStone($gameId, $player2Id, 9, 9);
                    $expectedActionCount += 2; // +2 for extra placements
                    
                    $state = $this->service->makeChoice($gameId, $player1Id, $colorChoice);
                    $expectedActionCount++; // +1 for final choice
                } else {
                    $state = $this->service->makeChoice($gameId, $player2Id, $colorChoice);
                    $expectedActionCount++; // +1 for direct choice
                }

                // Get history
                $history = $this->service->getSwap2History($state);

                // Property: History SHALL contain actions array
                $this->assertArrayHasKey('actions', $history, 'History must contain actions');
                
                // Property: Actions count SHALL match expected
                $this->assertCount(
                    $expectedActionCount,
                    $history['actions'],
                    'History must contain all actions'
                );

                // Property: History SHALL contain tentativeStones
                $this->assertArrayHasKey('tentativeStones', $history, 'History must contain tentativeStones');
                
                // Property: TentativeStones count SHALL be correct
                $expectedStoneCount = $usePlaceMorePath ? 5 : 3;
                $this->assertCount(
                    $expectedStoneCount,
                    $history['tentativeStones'],
                    'History must contain all tentative stones'
                );

                // Property: History SHALL contain finalChoice
                $this->assertArrayHasKey('finalChoice', $history, 'History must contain finalChoice');
                $this->assertNotNull($history['finalChoice'], 'FinalChoice must be set');

                // Property: History SHALL contain finalAssignment (since complete)
                $this->assertArrayHasKey('finalAssignment', $history, 'History must contain finalAssignment');
                $this->assertArrayHasKey('blackPlayerId', $history['finalAssignment']);
                $this->assertArrayHasKey('whitePlayerId', $history['finalAssignment']);
                $this->assertArrayHasKey('firstMover', $history['finalAssignment']);

                // Property: FirstMover SHALL equal blackPlayerId
                $this->assertEquals(
                    $history['finalAssignment']['blackPlayerId'],
                    $history['finalAssignment']['firstMover'],
                    'FirstMover must be blackPlayerId'
                );
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 12: Invalid Action Rejection**
     * 
     * *For any* action that doesn't match current phase requirements (wrong player, 
     * wrong action type, invalid position), the Swap2Manager SHALL reject and return 
     * error without state change.
     * 
     * **Validates: Requirements 8.1, 8.2, 8.3**
     * 
     * @test
     */
    public function invalidActionRejection(): void
    {
        $this
            ->forAll(
                Generators::choose(0, 14),  // x coordinate
                Generators::choose(0, 14)   // y coordinate
            )
            ->withMaxSize(100)
            ->then(function (int $x, int $y) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Test 1: Wrong player attempts placement in swap2_placement phase
                $validation = $this->service->validatePlacement($gameId, $player2Id, $x, $y);
                $this->assertFalse(
                    $validation->isValid(),
                    'Wrong player placement must be rejected'
                );
                $this->assertEquals('wrong_player', $validation->getErrorCode());

                // Test 2: Choice action in placement phase
                $validation = $this->service->validateChoice($gameId, $player1Id, 'black');
                $this->assertFalse(
                    $validation->isValid(),
                    'Choice in placement phase must be rejected'
                );
                $this->assertEquals('invalid_phase', $validation->getErrorCode());

                // Test 3: Out of bounds position
                $validation = $this->service->validatePlacement($gameId, $player1Id, -1, 0);
                $this->assertFalse(
                    $validation->isValid(),
                    'Out of bounds position must be rejected'
                );
                $this->assertEquals('out_of_bounds', $validation->getErrorCode());

                $validation = $this->service->validatePlacement($gameId, $player1Id, 15, 0);
                $this->assertFalse(
                    $validation->isValid(),
                    'Out of bounds position must be rejected'
                );
                $this->assertEquals('out_of_bounds', $validation->getErrorCode());

                // Place a stone and test occupied position
                $state = $this->service->placeStone($gameId, $player1Id, $x, $y);
                $validation = $this->service->validatePlacement($gameId, $player1Id, $x, $y);
                $this->assertFalse(
                    $validation->isValid(),
                    'Occupied position must be rejected'
                );
                $this->assertEquals('position_occupied', $validation->getErrorCode());
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 12: Invalid Action Rejection (Choice Phase)**
     * 
     * *For any* invalid choice in choice phases, the Swap2Manager SHALL reject 
     * with appropriate error.
     * 
     * **Validates: Requirements 8.1, 8.2, 8.3**
     * 
     * @test
     */
    public function invalidActionRejectionChoicePhase(): void
    {
        $this
            ->forAll(
                Generators::elements(['invalid', 'foo', 'bar', ''])  // Invalid choices
            )
            ->withMaxSize(100)
            ->then(function (string $invalidChoice) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place 3 stones to reach choice phase
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);

                $this->assertEquals(Swap2State::PHASE_CHOICE, $state->getPhase());

                // Test: Invalid choice value
                $validation = $this->service->validateChoice($gameId, $player2Id, $invalidChoice);
                $this->assertFalse(
                    $validation->isValid(),
                    "Invalid choice '{$invalidChoice}' must be rejected"
                );
                $this->assertEquals('invalid_choice', $validation->getErrorCode());

                // Test: Wrong player makes choice
                $validation = $this->service->validateChoice($gameId, $player1Id, 'black');
                $this->assertFalse(
                    $validation->isValid(),
                    'Wrong player choice must be rejected'
                );
                $this->assertEquals('wrong_player', $validation->getErrorCode());

                // Test: Placement action in choice phase
                $validation = $this->service->validatePlacement($gameId, $player2Id, 9, 9);
                $this->assertFalse(
                    $validation->isValid(),
                    'Placement in choice phase must be rejected'
                );
                $this->assertEquals('invalid_phase', $validation->getErrorCode());
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 12: Invalid Action Rejection (State Unchanged)**
     * 
     * *For any* rejected action, the state SHALL remain unchanged.
     * 
     * **Validates: Requirements 8.1, 8.2, 8.3**
     * 
     * @test
     */
    public function invalidActionRejectionStateUnchanged(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place 2 stones
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);

                // Capture state before invalid action
                $phaseBefore = $state->getPhase();
                $stoneCountBefore = $state->getStoneCount();
                $activePlayerBefore = $state->getActivePlayerId();
                $actionCountBefore = count($state->getActions());

                // Attempt invalid action (wrong player)
                try {
                    $this->service->placeStone($gameId, $player2Id, 8, 8);
                } catch (\RuntimeException $e) {
                    // Expected
                }

                // Verify state unchanged
                $stateAfter = $this->service->getState($gameId);
                $this->assertEquals($phaseBefore, $stateAfter->getPhase(), 'Phase must remain unchanged');
                $this->assertEquals($stoneCountBefore, $stateAfter->getStoneCount(), 'Stone count must remain unchanged');
                $this->assertEquals($activePlayerBefore, $stateAfter->getActivePlayerId(), 'Active player must remain unchanged');
                $this->assertEquals($actionCountBefore, count($stateAfter->getActions()), 'Action count must remain unchanged');
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 12: Invalid Action Rejection (Generic Validation)**
     * 
     * *For any* action validated through validateAction, invalid actions SHALL be rejected.
     * 
     * **Validates: Requirements 8.1, 8.2, 8.3**
     * 
     * @test
     */
    public function invalidActionRejectionGenericValidation(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Test: Invalid action type
                $validation = $this->service->validateAction($gameId, $player1Id, 'invalid_type', []);
                $this->assertFalse($validation->isValid());
                $this->assertEquals('invalid_action_type', $validation->getErrorCode());

                // Test: Missing coordinates for place action
                $validation = $this->service->validateAction($gameId, $player1Id, 'place', []);
                $this->assertFalse($validation->isValid());
                $this->assertEquals('missing_coordinates', $validation->getErrorCode());

                // Test: Missing choice for choice action
                $validation = $this->service->validateAction($gameId, $player1Id, 'choice', []);
                $this->assertFalse($validation->isValid());
                $this->assertEquals('missing_choice', $validation->getErrorCode());

                // Test: Valid place action
                $validation = $this->service->validateAction($gameId, $player1Id, 'place', ['x' => 7, 'y' => 7]);
                $this->assertTrue($validation->isValid());

                // Test: Game not found
                $validation = $this->service->validateAction('nonexistent', $player1Id, 'place', ['x' => 7, 'y' => 7]);
                $this->assertFalse($validation->isValid());
                $this->assertEquals('game_not_found', $validation->getErrorCode());
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 13: Active Player Correctness**
     * 
     * *For any* Swap 2 phase, activePlayerId SHALL be:
     * - player1Id in swap2_placement and swap2_final_choice
     * - player2Id in swap2_choice and swap2_extra
     * 
     * **Validates: Requirements 1.1, 1.2, 1.4, 1.5**
     * 
     * @test
     */
    public function activePlayerCorrectness(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Phase: swap2_placement - Player 1 should be active
                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);
                $this->assertEquals(Swap2State::PHASE_PLACEMENT, $state->getPhase());
                $this->assertEquals(
                    $player1Id,
                    $state->getActivePlayerId(),
                    'In swap2_placement, Player 1 must be active'
                );
                $this->assertEquals(
                    $player1Id,
                    $this->service->getExpectedActivePlayer($state),
                    'getExpectedActivePlayer must return Player 1 for swap2_placement'
                );
                $this->assertTrue(
                    $this->service->isActivePlayerCorrect($state),
                    'Active player must be correct in swap2_placement'
                );

                // Place 3 stones to reach swap2_choice
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);

                // Phase: swap2_choice - Player 2 should be active
                $this->assertEquals(Swap2State::PHASE_CHOICE, $state->getPhase());
                $this->assertEquals(
                    $player2Id,
                    $state->getActivePlayerId(),
                    'In swap2_choice, Player 2 must be active'
                );
                $this->assertEquals(
                    $player2Id,
                    $this->service->getExpectedActivePlayer($state),
                    'getExpectedActivePlayer must return Player 2 for swap2_choice'
                );
                $this->assertTrue(
                    $this->service->isActivePlayerCorrect($state),
                    'Active player must be correct in swap2_choice'
                );

                // Choose place_more to reach swap2_extra
                $state = $this->service->makeChoice($gameId, $player2Id, 'place_more');

                // Phase: swap2_extra - Player 2 should be active
                $this->assertEquals(Swap2State::PHASE_EXTRA, $state->getPhase());
                $this->assertEquals(
                    $player2Id,
                    $state->getActivePlayerId(),
                    'In swap2_extra, Player 2 must be active'
                );
                $this->assertEquals(
                    $player2Id,
                    $this->service->getExpectedActivePlayer($state),
                    'getExpectedActivePlayer must return Player 2 for swap2_extra'
                );
                $this->assertTrue(
                    $this->service->isActivePlayerCorrect($state),
                    'Active player must be correct in swap2_extra'
                );

                // Place 2 more stones to reach swap2_final_choice
                $state = $this->service->placeStone($gameId, $player2Id, 8, 8);
                $state = $this->service->placeStone($gameId, $player2Id, 9, 9);

                // Phase: swap2_final_choice - Player 1 should be active
                $this->assertEquals(Swap2State::PHASE_FINAL_CHOICE, $state->getPhase());
                $this->assertEquals(
                    $player1Id,
                    $state->getActivePlayerId(),
                    'In swap2_final_choice, Player 1 must be active'
                );
                $this->assertEquals(
                    $player1Id,
                    $this->service->getExpectedActivePlayer($state),
                    'getExpectedActivePlayer must return Player 1 for swap2_final_choice'
                );
                $this->assertTrue(
                    $this->service->isActivePlayerCorrect($state),
                    'Active player must be correct in swap2_final_choice'
                );
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 13: Active Player Correctness (Direct Path)**
     * 
     * *For any* Swap 2 sequence using direct color choice, active player transitions
     * SHALL be correct.
     * 
     * **Validates: Requirements 1.1, 1.2, 1.4, 1.5**
     * 
     * @test
     */
    public function activePlayerCorrectnessDirectPath(): void
    {
        $this
            ->forAll(
                Generators::elements(['black', 'white'])  // Direct color choice
            )
            ->withMaxSize(100)
            ->then(function (string $colorChoice) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Verify initial active player
                $this->assertEquals($player1Id, $state->getActivePlayerId());
                $this->assertTrue($this->service->isActivePlayerCorrect($state));

                // Place 3 stones
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $this->assertEquals($player1Id, $state->getActivePlayerId());
                
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $this->assertEquals($player1Id, $state->getActivePlayerId());
                
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);
                
                // After 3rd stone, should transition to Player 2
                $this->assertEquals($player2Id, $state->getActivePlayerId());
                $this->assertTrue($this->service->isActivePlayerCorrect($state));

                // Make direct choice - should complete
                $state = $this->service->makeChoice($gameId, $player2Id, $colorChoice);
                $this->assertEquals(Swap2State::PHASE_COMPLETE, $state->getPhase());
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 13: Active Player Correctness (All Phases)**
     * 
     * *For any* phase, the expected active player SHALL match the actual active player
     * after valid state transitions.
     * 
     * **Validates: Requirements 1.1, 1.2, 1.4, 1.5**
     * 
     * @test
     */
    public function activePlayerCorrectnessAllPhases(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Test all phases and verify active player correctness
                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Map of phase -> expected active player
                $phaseToPlayer = [
                    Swap2State::PHASE_PLACEMENT => $player1Id,
                    Swap2State::PHASE_CHOICE => $player2Id,
                    Swap2State::PHASE_EXTRA => $player2Id,
                    Swap2State::PHASE_FINAL_CHOICE => $player1Id,
                ];

                // Verify initial phase
                $this->assertEquals(
                    $phaseToPlayer[$state->getPhase()],
                    $state->getActivePlayerId(),
                    "Active player mismatch for phase {$state->getPhase()}"
                );

                // Progress through all phases
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);
                
                $this->assertEquals(
                    $phaseToPlayer[$state->getPhase()],
                    $state->getActivePlayerId(),
                    "Active player mismatch for phase {$state->getPhase()}"
                );

                $state = $this->service->makeChoice($gameId, $player2Id, 'place_more');
                
                $this->assertEquals(
                    $phaseToPlayer[$state->getPhase()],
                    $state->getActivePlayerId(),
                    "Active player mismatch for phase {$state->getPhase()}"
                );

                $state = $this->service->placeStone($gameId, $player2Id, 8, 8);
                $state = $this->service->placeStone($gameId, $player2Id, 9, 9);
                
                $this->assertEquals(
                    $phaseToPlayer[$state->getPhase()],
                    $state->getActivePlayerId(),
                    "Active player mismatch for phase {$state->getPhase()}"
                );
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 14: Swap 2 History Completeness**
     * 
     * *For any* completed Swap 2 sequence, the actions array SHALL contain exactly 
     * the sequence of placements and choices made, in order.
     * 
     * **Validates: Requirements 6.4, 7.3**
     * 
     * @test
     */
    public function historyCompletenessDirectPath(): void
    {
        $this
            ->forAll(
                Generators::elements(['black', 'white'])  // Color choice
            )
            ->withMaxSize(100)
            ->then(function (string $colorChoice) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place 3 stones
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);

                // Make direct choice
                $state = $this->service->makeChoice($gameId, $player2Id, $colorChoice);

                // Get history
                $history = $this->service->getSwap2History($state);

                // Property: Actions SHALL contain exactly 4 actions (3 placements + 1 choice)
                $this->assertCount(4, $history['actions'], 'Direct path must have 4 actions');

                // Property: First 3 actions SHALL be placements by Player 1
                for ($i = 0; $i < 3; $i++) {
                    $this->assertEquals(
                        'place',
                        $history['actions'][$i]['type'],
                        "Action {$i} must be a placement"
                    );
                    $this->assertEquals(
                        $player1Id,
                        $history['actions'][$i]['playerId'],
                        "Action {$i} must be by Player 1"
                    );
                }

                // Property: 4th action SHALL be a choice by Player 2
                $this->assertEquals('choice', $history['actions'][3]['type']);
                $this->assertEquals($player2Id, $history['actions'][3]['playerId']);
                $this->assertEquals($colorChoice, $history['actions'][3]['data']['choice']);

                // Property: TentativeStones SHALL contain exactly 3 stones
                $this->assertCount(3, $history['tentativeStones']);

                // Property: FinalAssignment SHALL be present
                $this->assertArrayHasKey('finalAssignment', $history);
                $this->assertNotNull($history['finalAssignment']['blackPlayerId']);
                $this->assertNotNull($history['finalAssignment']['whitePlayerId']);
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 14: Swap 2 History Completeness (Place More Path)**
     * 
     * *For any* completed Swap 2 sequence using place_more, the actions array SHALL 
     * contain all 7 actions in correct order.
     * 
     * **Validates: Requirements 6.4, 7.3**
     * 
     * @test
     */
    public function historyCompletenessPlaceMorePath(): void
    {
        $this
            ->forAll(
                Generators::elements(['black', 'white'])  // Final color choice
            )
            ->withMaxSize(100)
            ->then(function (string $colorChoice) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place 3 stones
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);

                // Choose place_more
                $state = $this->service->makeChoice($gameId, $player2Id, 'place_more');

                // Place 2 more stones
                $state = $this->service->placeStone($gameId, $player2Id, 8, 8);
                $state = $this->service->placeStone($gameId, $player2Id, 9, 9);

                // Make final choice
                $state = $this->service->makeChoice($gameId, $player1Id, $colorChoice);

                // Get history
                $history = $this->service->getSwap2History($state);

                // Property: Actions SHALL contain exactly 7 actions
                // (3 placements + place_more choice + 2 placements + final choice)
                $this->assertCount(7, $history['actions'], 'Place more path must have 7 actions');

                // Property: Actions SHALL be in correct order
                // Actions 0-2: Player 1 placements
                for ($i = 0; $i < 3; $i++) {
                    $this->assertEquals('place', $history['actions'][$i]['type']);
                    $this->assertEquals($player1Id, $history['actions'][$i]['playerId']);
                }

                // Action 3: Player 2 place_more choice
                $this->assertEquals('choice', $history['actions'][3]['type']);
                $this->assertEquals($player2Id, $history['actions'][3]['playerId']);
                $this->assertEquals('place_more', $history['actions'][3]['data']['choice']);

                // Actions 4-5: Player 2 placements
                for ($i = 4; $i < 6; $i++) {
                    $this->assertEquals('place', $history['actions'][$i]['type']);
                    $this->assertEquals($player2Id, $history['actions'][$i]['playerId']);
                }

                // Action 6: Player 1 final choice
                $this->assertEquals('choice', $history['actions'][6]['type']);
                $this->assertEquals($player1Id, $history['actions'][6]['playerId']);
                $this->assertEquals($colorChoice, $history['actions'][6]['data']['choice']);

                // Property: TentativeStones SHALL contain exactly 5 stones
                $this->assertCount(5, $history['tentativeStones']);

                // Property: Stone placement order SHALL be preserved
                for ($i = 0; $i < 5; $i++) {
                    $this->assertEquals(
                        $i + 1,
                        $history['tentativeStones'][$i]['placementOrder'],
                        "Stone {$i} must have correct placement order"
                    );
                }
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 14: Swap 2 History Completeness (Action Timestamps)**
     * 
     * *For any* completed Swap 2 sequence, all actions SHALL have valid timestamps
     * in chronological order.
     * 
     * **Validates: Requirements 6.4, 7.3**
     * 
     * @test
     */
    public function historyCompletenessTimestamps(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Complete a full sequence
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);
                $state = $this->service->makeChoice($gameId, $player2Id, 'black');

                // Get history
                $history = $this->service->getSwap2History($state);

                // Property: All actions SHALL have timestamps
                foreach ($history['actions'] as $index => $action) {
                    $this->assertArrayHasKey(
                        'timestamp',
                        $action,
                        "Action {$index} must have a timestamp"
                    );
                    $this->assertNotEmpty(
                        $action['timestamp'],
                        "Action {$index} timestamp must not be empty"
                    );
                    
                    // Verify timestamp is valid ISO 8601 format
                    $timestamp = \DateTime::createFromFormat(\DateTime::ATOM, $action['timestamp']);
                    $this->assertNotFalse(
                        $timestamp,
                        "Action {$index} timestamp must be valid ISO 8601"
                    );
                }
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 14: Swap 2 History Completeness (Serialization)**
     * 
     * *For any* completed Swap 2 sequence, serialized history SHALL be valid JSON
     * and contain all required fields.
     * 
     * **Validates: Requirements 6.4, 7.3**
     * 
     * @test
     */
    public function historyCompletenessSerialization(): void
    {
        $this
            ->forAll(
                Generators::elements(['black', 'white']),
                Generators::bool()  // Use place_more path
            )
            ->withMaxSize(100)
            ->then(function (string $colorChoice, bool $usePlaceMore) {
                $gameId = $this->generateUuid();
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $state = $this->service->initializeSwap2($gameId, $player1Id, $player2Id);

                // Place 3 stones
                $state = $this->service->placeStone($gameId, $player1Id, 7, 7);
                $state = $this->service->placeStone($gameId, $player1Id, 7, 8);
                $state = $this->service->placeStone($gameId, $player1Id, 8, 7);

                if ($usePlaceMore) {
                    $state = $this->service->makeChoice($gameId, $player2Id, 'place_more');
                    $state = $this->service->placeStone($gameId, $player2Id, 8, 8);
                    $state = $this->service->placeStone($gameId, $player2Id, 9, 9);
                    $state = $this->service->makeChoice($gameId, $player1Id, $colorChoice);
                } else {
                    $state = $this->service->makeChoice($gameId, $player2Id, $colorChoice);
                }

                // Serialize history
                $json = $this->service->serializeSwap2History($state);

                // Property: Serialized history SHALL be valid JSON
                $this->assertJson($json, 'Serialized history must be valid JSON');

                // Deserialize and verify
                $decoded = json_decode($json, true);

                // Property: Decoded history SHALL contain all required fields
                $this->assertArrayHasKey('actions', $decoded);
                $this->assertArrayHasKey('tentativeStones', $decoded);
                $this->assertArrayHasKey('finalChoice', $decoded);
                $this->assertArrayHasKey('finalAssignment', $decoded);

                // Property: FinalAssignment SHALL contain all required fields
                $this->assertArrayHasKey('blackPlayerId', $decoded['finalAssignment']);
                $this->assertArrayHasKey('whitePlayerId', $decoded['finalAssignment']);
                $this->assertArrayHasKey('firstMover', $decoded['finalAssignment']);

                // Property: FirstMover SHALL equal blackPlayerId
                $this->assertEquals(
                    $decoded['finalAssignment']['blackPlayerId'],
                    $decoded['finalAssignment']['firstMover']
                );
            });
    }
}
