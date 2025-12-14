<?php

use PHPUnit\Framework\TestCase;
use App\Services\Swap2ManagerService;
use App\Services\Swap2State;
use App\Services\SeriesManagerService;

/**
 * End-to-End Integration Tests for Swap 2 Opening Rule
 * 
 * **Feature: swap2-opening-rule**
 * 
 * Tests the complete Swap 2 flows including:
 * - Direct choice path (P1 places 3 → P2 chooses black/white → main game)
 * - Place more path (P1 places 3 → P2 place_more → P2 places 2 → P1 chooses → main game)
 * - Swap 2 in ranked series (multiple games, each with fresh Swap 2)
 * - Reconnection during Swap 2 phases
 * 
 * **Validates: Requirements 1.1-1.6, 2.1-2.5, 3.1-3.6, 6.1, 6.3, 7.2**
 */
class Swap2IntegrationTest extends TestCase
{
    private Swap2ManagerService $swap2Manager;
    private SeriesManagerService $seriesManager;
    
    /** @var array<string, array> In-memory series storage */
    private array $savedSeries = [];
    
    /** @var array<string, array> In-memory player data */
    private array $players = [];

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->swap2Manager = new Swap2ManagerService();
        $this->seriesManager = new SeriesManagerService();
        
        // Clear storage
        $this->savedSeries = [];
        $this->players = [];
        
        // Setup series manager with mock callbacks
        $this->seriesManager->setSwap2Manager($this->swap2Manager);
        
        $this->seriesManager->setPlayerFetcher(function (string $playerId) {
            return $this->players[$playerId] ?? [
                'user_id' => $playerId,
                'mindpoint' => 1000,
                'current_rank' => 'ky_lao',
            ];
        });
        
        $this->seriesManager->setSeriesSaver(function (array $series) {
            $this->savedSeries[$series['id']] = $series;
        });
        
        $this->seriesManager->setSeriesFinder(function (string $seriesId) {
            return $this->savedSeries[$seriesId] ?? null;
        });
    }

    /**
     * Generate a UUID string
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
     * Create test players
     */
    private function createTestPlayers(): array
    {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();
        
        $this->players[$player1Id] = [
            'user_id' => $player1Id,
            'mindpoint' => 1500,
            'current_rank' => 'cao_ky',
        ];
        
        $this->players[$player2Id] = [
            'user_id' => $player2Id,
            'mindpoint' => 1200,
            'current_rank' => 'ky_lao',
        ];
        
        return [$player1Id, $player2Id];
    }

    // =========================================================================
    // 17.1 Test full Swap 2 flow (direct choice path)
    // =========================================================================

    /**
     * Test: Full Swap 2 flow - Direct choice path with "black" choice
     * 
     * Flow: P1 places 3 stones → P2 chooses "black" → main game starts
     * 
     * **Validates: Requirements 1.1-1.6, 2.1-2.5, 3.1-3.6**
     * 
     * @test
     */
    public function testFullSwap2FlowDirectChoiceBlack(): void
    {
        // Arrange
        $gameId = $this->generateUuid();
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        // Step 1: Initialize Swap 2
        $state = $this->swap2Manager->initializeSwap2($gameId, $player1Id, $player2Id);
        
        // Assert: Initial state is correct (Requirement 1.1)
        $this->assertEquals(Swap2State::PHASE_PLACEMENT, $state->getPhase());
        $this->assertEquals($player1Id, $state->getActivePlayerId());
        $this->assertEquals(0, $state->getStoneCount());
        $this->assertFalse($this->swap2Manager->isComplete($state));

        // Step 2: Player 1 places 3 stones (Requirements 2.1, 2.2)
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 7);
        $this->assertEquals(1, $state->getStoneCount());
        $this->assertEquals(Swap2State::PHASE_PLACEMENT, $state->getPhase());
        
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 8);
        $this->assertEquals(2, $state->getStoneCount());
        $this->assertEquals(Swap2State::PHASE_PLACEMENT, $state->getPhase());
        
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 8, 7);
        $this->assertEquals(3, $state->getStoneCount());
        
        // Assert: Phase transitions to swap2_choice (Requirement 1.2)
        $this->assertEquals(Swap2State::PHASE_CHOICE, $state->getPhase());
        $this->assertEquals($player2Id, $state->getActivePlayerId());

        // Step 3: Player 2 chooses "black" (Requirements 3.1, 3.2)
        $state = $this->swap2Manager->makeChoice($gameId, $player2Id, 'black');
        
        // Assert: Swap 2 completes (Requirement 1.6)
        $this->assertEquals(Swap2State::PHASE_COMPLETE, $state->getPhase());
        $this->assertTrue($this->swap2Manager->isComplete($state));
        
        // Assert: Color assignments are correct (Requirement 3.2)
        $this->assertEquals($player2Id, $state->getBlackPlayerId());
        $this->assertEquals($player1Id, $state->getWhitePlayerId());
        
        // Assert: Final assignments can be retrieved (Requirement 3.6)
        $assignments = $this->swap2Manager->getFinalAssignments($state);
        $this->assertEquals($player2Id, $assignments->getBlackPlayerId());
        $this->assertEquals($player1Id, $assignments->getWhitePlayerId());
        $this->assertEquals($player2Id, $assignments->getFirstMover());
        
        // Assert: Actions are recorded (Requirement 7.3)
        $actions = $state->getActions();
        $this->assertCount(4, $actions); // 3 placements + 1 choice
    }

    /**
     * Test: Full Swap 2 flow - Direct choice path with "white" choice
     * 
     * Flow: P1 places 3 stones → P2 chooses "white" → main game starts
     * 
     * **Validates: Requirements 1.1-1.6, 2.1-2.5, 3.1-3.6**
     * 
     * @test
     */
    public function testFullSwap2FlowDirectChoiceWhite(): void
    {
        // Arrange
        $gameId = $this->generateUuid();
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        // Initialize and place 3 stones
        $state = $this->swap2Manager->initializeSwap2($gameId, $player1Id, $player2Id);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 7);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 8, 7);
        
        // Player 2 chooses "white" (Requirement 3.3)
        $state = $this->swap2Manager->makeChoice($gameId, $player2Id, 'white');
        
        // Assert: Swap 2 completes
        $this->assertEquals(Swap2State::PHASE_COMPLETE, $state->getPhase());
        $this->assertTrue($this->swap2Manager->isComplete($state));
        
        // Assert: Color assignments are correct (Requirement 3.3)
        $this->assertEquals($player1Id, $state->getBlackPlayerId());
        $this->assertEquals($player2Id, $state->getWhitePlayerId());
        
        // Assert: Black player is first mover
        $assignments = $this->swap2Manager->getFinalAssignments($state);
        $this->assertEquals($player1Id, $assignments->getFirstMover());
    }

    /**
     * Test: Tentative stones are tracked correctly during direct choice path
     * 
     * **Validates: Requirements 2.2, 2.3**
     * 
     * @test
     */
    public function testTentativeStonesTrackedCorrectly(): void
    {
        // Arrange
        $gameId = $this->generateUuid();
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        $state = $this->swap2Manager->initializeSwap2($gameId, $player1Id, $player2Id);
        
        // Place stones at specific positions
        $positions = [[7, 7], [8, 8], [9, 9]];
        foreach ($positions as $pos) {
            $state = $this->swap2Manager->placeStone($gameId, $player1Id, $pos[0], $pos[1]);
        }
        
        // Assert: All stones are tracked
        $stones = $state->getTentativeStones();
        $this->assertCount(3, $stones);
        
        // Assert: Each stone has correct metadata
        foreach ($stones as $index => $stone) {
            $this->assertEquals($positions[$index][0], $stone->getX());
            $this->assertEquals($positions[$index][1], $stone->getY());
            $this->assertEquals($player1Id, $stone->getPlacedBy());
            $this->assertEquals($index + 1, $stone->getPlacementOrder());
            $this->assertEquals(Swap2State::PHASE_PLACEMENT, $stone->getPhase());
        }
    }


    // =========================================================================
    // 17.2 Test full Swap 2 flow (place_more path)
    // =========================================================================

    /**
     * Test: Full Swap 2 flow - Place more path
     * 
     * Flow: P1 places 3 → P2 chooses "place_more" → P2 places 2 → P1 chooses → main game
     * 
     * **Validates: Requirements 1.4, 1.5, 2.3**
     * 
     * @test
     */
    public function testFullSwap2FlowPlaceMorePath(): void
    {
        // Arrange
        $gameId = $this->generateUuid();
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        // Step 1: Initialize Swap 2
        $state = $this->swap2Manager->initializeSwap2($gameId, $player1Id, $player2Id);
        $this->assertEquals(Swap2State::PHASE_PLACEMENT, $state->getPhase());

        // Step 2: Player 1 places 3 stones
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 7);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 8, 7);
        
        $this->assertEquals(Swap2State::PHASE_CHOICE, $state->getPhase());
        $this->assertEquals($player2Id, $state->getActivePlayerId());

        // Step 3: Player 2 chooses "place_more" (Requirement 1.4)
        $state = $this->swap2Manager->makeChoice($gameId, $player2Id, 'place_more');
        
        // Assert: Phase transitions to swap2_extra (Requirement 1.4)
        $this->assertEquals(Swap2State::PHASE_EXTRA, $state->getPhase());
        $this->assertEquals($player2Id, $state->getActivePlayerId());
        $this->assertEquals(3, $state->getStoneCount());
        $this->assertFalse($this->swap2Manager->isComplete($state));

        // Step 4: Player 2 places 2 more stones (Requirement 2.3)
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 8, 8);
        $this->assertEquals(4, $state->getStoneCount());
        $this->assertEquals(Swap2State::PHASE_EXTRA, $state->getPhase());
        
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 9, 9);
        $this->assertEquals(5, $state->getStoneCount());
        
        // Assert: Phase transitions to swap2_final_choice (Requirement 1.5)
        $this->assertEquals(Swap2State::PHASE_FINAL_CHOICE, $state->getPhase());
        $this->assertEquals($player1Id, $state->getActivePlayerId());

        // Step 5: Player 1 chooses color (Requirement 3.5)
        $state = $this->swap2Manager->makeChoice($gameId, $player1Id, 'black');
        
        // Assert: Swap 2 completes (Requirement 1.6)
        $this->assertEquals(Swap2State::PHASE_COMPLETE, $state->getPhase());
        $this->assertTrue($this->swap2Manager->isComplete($state));
        
        // Assert: Color assignments are correct
        $this->assertEquals($player1Id, $state->getBlackPlayerId());
        $this->assertEquals($player2Id, $state->getWhitePlayerId());
        
        // Assert: Actions are recorded (5 placements + 2 choices)
        $actions = $state->getActions();
        $this->assertCount(7, $actions);
    }

    /**
     * Test: Place more path with Player 1 choosing "white"
     * 
     * **Validates: Requirements 1.4, 1.5, 3.5**
     * 
     * @test
     */
    public function testPlaceMorePathWithWhiteChoice(): void
    {
        // Arrange
        $gameId = $this->generateUuid();
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        // Initialize and complete placement phases
        $state = $this->swap2Manager->initializeSwap2($gameId, $player1Id, $player2Id);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 7);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 8, 7);
        $state = $this->swap2Manager->makeChoice($gameId, $player2Id, 'place_more');
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 8, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 9, 9);
        
        // Player 1 chooses "white"
        $state = $this->swap2Manager->makeChoice($gameId, $player1Id, 'white');
        
        // Assert: Color assignments are correct
        $this->assertEquals($player2Id, $state->getBlackPlayerId());
        $this->assertEquals($player1Id, $state->getWhitePlayerId());
        
        // Assert: Black player (P2) is first mover
        $assignments = $this->swap2Manager->getFinalAssignments($state);
        $this->assertEquals($player2Id, $assignments->getFirstMover());
    }

    /**
     * Test: Extra stones are tracked with correct metadata
     * 
     * **Validates: Requirements 2.2, 2.3**
     * 
     * @test
     */
    public function testExtraStonesTrackedCorrectly(): void
    {
        // Arrange
        $gameId = $this->generateUuid();
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        // Complete initial placement and choose place_more
        $state = $this->swap2Manager->initializeSwap2($gameId, $player1Id, $player2Id);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 7);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 8, 7);
        $state = $this->swap2Manager->makeChoice($gameId, $player2Id, 'place_more');
        
        // Place extra stones
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 8, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 9, 9);
        
        // Assert: All 5 stones are tracked
        $stones = $state->getTentativeStones();
        $this->assertCount(5, $stones);
        
        // Assert: First 3 stones placed by P1 in placement phase
        for ($i = 0; $i < 3; $i++) {
            $this->assertEquals($player1Id, $stones[$i]->getPlacedBy());
            $this->assertEquals(Swap2State::PHASE_PLACEMENT, $stones[$i]->getPhase());
        }
        
        // Assert: Last 2 stones placed by P2 in extra phase
        for ($i = 3; $i < 5; $i++) {
            $this->assertEquals($player2Id, $stones[$i]->getPlacedBy());
            $this->assertEquals(Swap2State::PHASE_EXTRA, $stones[$i]->getPhase());
        }
    }

    /**
     * Test: Final choice phase only allows "black" or "white" (not "place_more")
     * 
     * **Validates: Requirements 3.5**
     * 
     * @test
     */
    public function testFinalChoicePhaseOnlyAllowsColorChoices(): void
    {
        // Arrange
        $gameId = $this->generateUuid();
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        // Complete to final choice phase
        $state = $this->swap2Manager->initializeSwap2($gameId, $player1Id, $player2Id);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 7);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 8, 7);
        $state = $this->swap2Manager->makeChoice($gameId, $player2Id, 'place_more');
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 8, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 9, 9);
        
        $this->assertEquals(Swap2State::PHASE_FINAL_CHOICE, $state->getPhase());
        
        // Assert: "place_more" is rejected in final choice phase
        $this->expectException(\InvalidArgumentException::class);
        $this->swap2Manager->makeChoice($gameId, $player1Id, 'place_more');
    }

    // =========================================================================
    // 17.3 Test Swap 2 in ranked series
    // =========================================================================

    /**
     * Test: Swap 2 in ranked series - Multiple games with fresh Swap 2
     * 
     * **Validates: Requirements 6.1, 6.3**
     * 
     * @test
     */
    public function testSwap2InRankedSeriesMultipleGames(): void
    {
        // Arrange
        [$player1Id, $player2Id] = $this->createTestPlayers();

        // Step 1: Create series (initializes Swap 2 for game 1)
        $series = $this->seriesManager->createSeries($player1Id, $player2Id);
        
        // Assert: Series created with Swap 2 state (Requirement 6.1)
        $this->assertNotNull($series);
        $this->assertEquals('in_progress', $series['status']);
        $this->assertEquals(1, $series['current_game']);
        $this->assertArrayHasKey('swap2State', $series);
        $this->assertArrayHasKey('gameId', $series);
        
        // Assert: Swap 2 state is in placement phase
        $swap2State = $series['swap2State'];
        $this->assertEquals(Swap2State::PHASE_PLACEMENT, $swap2State['phase']);
        $this->assertEquals($player1Id, $swap2State['activePlayerId']);

        // Step 2: Complete Swap 2 for game 1
        $gameId1 = $series['gameId'];
        $state = $this->swap2Manager->placeStone($gameId1, $player1Id, 7, 7);
        $state = $this->swap2Manager->placeStone($gameId1, $player1Id, 7, 8);
        $state = $this->swap2Manager->placeStone($gameId1, $player1Id, 8, 7);
        $state = $this->swap2Manager->makeChoice($gameId1, $player2Id, 'black');
        
        $this->assertTrue($this->swap2Manager->isComplete($state));
        $game1BlackPlayer = $state->getBlackPlayerId();
        $game1WhitePlayer = $state->getWhitePlayerId();

        // Step 3: End game 1 (P1 wins)
        $matchId1 = $this->generateUuid();
        $result = $this->seriesManager->endGame($series['id'], $matchId1, $player1Id, 300);
        
        // Assert: Series advances to game 2 with fresh Swap 2 (Requirement 6.3)
        $this->assertFalse($result['isComplete']);
        $this->assertTrue($result['nextGameReady']);
        $this->assertArrayHasKey('swap2State', $result);
        $this->assertArrayHasKey('gameId', $result);
        
        // Assert: New Swap 2 state is fresh (not carrying over from game 1)
        $swap2State2 = $result['swap2State'];
        $this->assertEquals(Swap2State::PHASE_PLACEMENT, $swap2State2['phase']);
        $this->assertEquals($player1Id, $swap2State2['activePlayerId']);
        $this->assertEmpty($swap2State2['tentativeStones']);
        $this->assertNull($swap2State2['blackPlayerId']);
        $this->assertNull($swap2State2['whitePlayerId']);

        // Step 4: Complete Swap 2 for game 2 with different choice
        $gameId2 = $result['gameId'];
        $state2 = $this->swap2Manager->placeStone($gameId2, $player1Id, 6, 6);
        $state2 = $this->swap2Manager->placeStone($gameId2, $player1Id, 6, 7);
        $state2 = $this->swap2Manager->placeStone($gameId2, $player1Id, 7, 6);
        $state2 = $this->swap2Manager->makeChoice($gameId2, $player2Id, 'white');
        
        $this->assertTrue($this->swap2Manager->isComplete($state2));
        $game2BlackPlayer = $state2->getBlackPlayerId();
        $game2WhitePlayer = $state2->getWhitePlayerId();
        
        // Assert: Color assignments can be different between games
        // (This is the key benefit of Swap 2 - each game is fair)
        $this->assertNotEquals($game1BlackPlayer, $game2BlackPlayer);
        $this->assertNotEquals($game1WhitePlayer, $game2WhitePlayer);
    }

    /**
     * Test: Each game in series starts with fresh Swap 2 placement phase
     * 
     * **Validates: Requirements 6.3**
     * 
     * @test
     */
    public function testEachSeriesGameStartsWithFreshSwap2(): void
    {
        // Arrange
        [$player1Id, $player2Id] = $this->createTestPlayers();
        $series = $this->seriesManager->createSeries($player1Id, $player2Id);
        
        // Complete game 1
        $gameId1 = $series['gameId'];
        $this->swap2Manager->placeStone($gameId1, $player1Id, 7, 7);
        $this->swap2Manager->placeStone($gameId1, $player1Id, 7, 8);
        $this->swap2Manager->placeStone($gameId1, $player1Id, 8, 7);
        $this->swap2Manager->makeChoice($gameId1, $player2Id, 'black');
        
        $matchId1 = $this->generateUuid();
        $result = $this->seriesManager->endGame($series['id'], $matchId1, $player1Id, 300);
        
        // Assert: Game 2 has completely fresh Swap 2 state
        $swap2State = $result['swap2State'];
        $this->assertEquals(Swap2State::PHASE_PLACEMENT, $swap2State['phase']);
        $this->assertCount(0, $swap2State['tentativeStones']);
        $this->assertCount(0, $swap2State['actions']);
        $this->assertNull($swap2State['finalChoice']);
        $this->assertNull($swap2State['blackPlayerId']);
        $this->assertNull($swap2State['whitePlayerId']);
    }

    /**
     * Test: prepareNextSeriesGame initializes fresh Swap 2
     * 
     * **Validates: Requirements 6.3**
     * 
     * @test
     */
    public function testPrepareNextSeriesGameInitializesFreshSwap2(): void
    {
        // Arrange
        [$player1Id, $player2Id] = $this->createTestPlayers();
        $series = $this->seriesManager->createSeries($player1Id, $player2Id);
        
        // Complete game 1 without using endGame
        $gameId1 = $series['gameId'];
        $this->swap2Manager->placeStone($gameId1, $player1Id, 7, 7);
        $this->swap2Manager->placeStone($gameId1, $player1Id, 7, 8);
        $this->swap2Manager->placeStone($gameId1, $player1Id, 8, 7);
        $this->swap2Manager->makeChoice($gameId1, $player2Id, 'black');
        
        // Manually update series wins
        $this->savedSeries[$series['id']]['player1_wins'] = 1;
        
        // Prepare next game
        $result = $this->seriesManager->prepareNextSeriesGame($series['id']);
        
        // Assert: Fresh Swap 2 is initialized
        $this->assertArrayHasKey('swap2State', $result);
        $this->assertArrayHasKey('gameId', $result);
        $this->assertEquals(2, $result['series']['current_game']);
        
        $swap2State = $result['swap2State'];
        $this->assertEquals(Swap2State::PHASE_PLACEMENT, $swap2State['phase']);
        $this->assertEquals($player1Id, $swap2State['activePlayerId']);
    }


    // =========================================================================
    // 17.4 Test reconnection during Swap 2
    // =========================================================================

    /**
     * Test: Reconnection during swap2_placement phase
     * 
     * **Validates: Requirements 7.2**
     * 
     * @test
     */
    public function testReconnectionDuringPlacementPhase(): void
    {
        // Arrange
        $gameId = $this->generateUuid();
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        // Initialize and place 2 stones
        $state = $this->swap2Manager->initializeSwap2($gameId, $player1Id, $player2Id);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 7);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 8);
        
        // Serialize state (simulating disconnect)
        $serializedState = $this->swap2Manager->serializeState($state);
        
        // Clear in-memory state (simulating server restart or disconnect)
        $this->swap2Manager->clearState($gameId);
        $this->assertNull($this->swap2Manager->getState($gameId));
        
        // Restore state (simulating reconnection)
        $restoredState = $this->swap2Manager->restoreStateForReconnection($gameId, $serializedState);
        
        // Assert: State is restored exactly
        $this->assertEquals(Swap2State::PHASE_PLACEMENT, $restoredState->getPhase());
        $this->assertEquals($player1Id, $restoredState->getActivePlayerId());
        $this->assertEquals(2, $restoredState->getStoneCount());
        
        // Assert: Can continue placing stones
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 8, 7);
        $this->assertEquals(3, $state->getStoneCount());
        $this->assertEquals(Swap2State::PHASE_CHOICE, $state->getPhase());
    }

    /**
     * Test: Reconnection during swap2_choice phase
     * 
     * **Validates: Requirements 7.2**
     * 
     * @test
     */
    public function testReconnectionDuringChoicePhase(): void
    {
        // Arrange
        $gameId = $this->generateUuid();
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        // Initialize and reach choice phase
        $state = $this->swap2Manager->initializeSwap2($gameId, $player1Id, $player2Id);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 7);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 8, 7);
        
        $this->assertEquals(Swap2State::PHASE_CHOICE, $state->getPhase());
        
        // Serialize and clear state
        $serializedState = $this->swap2Manager->serializeState($state);
        $this->swap2Manager->clearState($gameId);
        
        // Restore state
        $restoredState = $this->swap2Manager->restoreStateForReconnection($gameId, $serializedState);
        
        // Assert: State is restored exactly
        $this->assertEquals(Swap2State::PHASE_CHOICE, $restoredState->getPhase());
        $this->assertEquals($player2Id, $restoredState->getActivePlayerId());
        $this->assertEquals(3, $restoredState->getStoneCount());
        
        // Assert: Tentative stones are preserved
        $stones = $restoredState->getTentativeStones();
        $this->assertCount(3, $stones);
        $this->assertEquals(7, $stones[0]->getX());
        $this->assertEquals(7, $stones[0]->getY());
        
        // Assert: Can continue with choice
        $state = $this->swap2Manager->makeChoice($gameId, $player2Id, 'black');
        $this->assertEquals(Swap2State::PHASE_COMPLETE, $state->getPhase());
    }

    /**
     * Test: Reconnection during swap2_extra phase
     * 
     * **Validates: Requirements 7.2**
     * 
     * @test
     */
    public function testReconnectionDuringExtraPhase(): void
    {
        // Arrange
        $gameId = $this->generateUuid();
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        // Initialize and reach extra phase with 1 extra stone placed
        $state = $this->swap2Manager->initializeSwap2($gameId, $player1Id, $player2Id);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 7);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 8, 7);
        $state = $this->swap2Manager->makeChoice($gameId, $player2Id, 'place_more');
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 8, 8);
        
        $this->assertEquals(Swap2State::PHASE_EXTRA, $state->getPhase());
        $this->assertEquals(4, $state->getStoneCount());
        
        // Serialize and clear state
        $serializedState = $this->swap2Manager->serializeState($state);
        $this->swap2Manager->clearState($gameId);
        
        // Restore state
        $restoredState = $this->swap2Manager->restoreStateForReconnection($gameId, $serializedState);
        
        // Assert: State is restored exactly
        $this->assertEquals(Swap2State::PHASE_EXTRA, $restoredState->getPhase());
        $this->assertEquals($player2Id, $restoredState->getActivePlayerId());
        $this->assertEquals(4, $restoredState->getStoneCount());
        
        // Assert: Can continue placing extra stone
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 9, 9);
        $this->assertEquals(5, $state->getStoneCount());
        $this->assertEquals(Swap2State::PHASE_FINAL_CHOICE, $state->getPhase());
    }

    /**
     * Test: Reconnection during swap2_final_choice phase
     * 
     * **Validates: Requirements 7.2**
     * 
     * @test
     */
    public function testReconnectionDuringFinalChoicePhase(): void
    {
        // Arrange
        $gameId = $this->generateUuid();
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        // Initialize and reach final choice phase
        $state = $this->swap2Manager->initializeSwap2($gameId, $player1Id, $player2Id);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 7);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 8, 7);
        $state = $this->swap2Manager->makeChoice($gameId, $player2Id, 'place_more');
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 8, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 9, 9);
        
        $this->assertEquals(Swap2State::PHASE_FINAL_CHOICE, $state->getPhase());
        
        // Serialize and clear state
        $serializedState = $this->swap2Manager->serializeState($state);
        $this->swap2Manager->clearState($gameId);
        
        // Restore state
        $restoredState = $this->swap2Manager->restoreStateForReconnection($gameId, $serializedState);
        
        // Assert: State is restored exactly
        $this->assertEquals(Swap2State::PHASE_FINAL_CHOICE, $restoredState->getPhase());
        $this->assertEquals($player1Id, $restoredState->getActivePlayerId());
        $this->assertEquals(5, $restoredState->getStoneCount());
        
        // Assert: Actions are preserved
        $actions = $restoredState->getActions();
        $this->assertCount(6, $actions); // 5 placements + 1 choice
        
        // Assert: Can continue with final choice
        $state = $this->swap2Manager->makeChoice($gameId, $player1Id, 'white');
        $this->assertEquals(Swap2State::PHASE_COMPLETE, $state->getPhase());
    }

    /**
     * Test: State persistence round-trip preserves all data
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function testStatePersistenceRoundTripPreservesAllData(): void
    {
        // Arrange
        $gameId = $this->generateUuid();
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        // Create a state with all fields populated
        $state = $this->swap2Manager->initializeSwap2($gameId, $player1Id, $player2Id);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 7);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 8, 7);
        $state = $this->swap2Manager->makeChoice($gameId, $player2Id, 'place_more');
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 8, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 9, 9);
        $state = $this->swap2Manager->makeChoice($gameId, $player1Id, 'black');
        
        // Serialize
        $serializedState = $this->swap2Manager->serializeState($state);
        
        // Deserialize
        $deserializedState = $this->swap2Manager->deserializeState($serializedState);
        
        // Assert: All fields are preserved
        $this->assertEquals($state->getPhase(), $deserializedState->getPhase());
        $this->assertEquals($state->getPlayer1Id(), $deserializedState->getPlayer1Id());
        $this->assertEquals($state->getPlayer2Id(), $deserializedState->getPlayer2Id());
        $this->assertEquals($state->getActivePlayerId(), $deserializedState->getActivePlayerId());
        $this->assertEquals($state->getStoneCount(), $deserializedState->getStoneCount());
        $this->assertEquals($state->getBlackPlayerId(), $deserializedState->getBlackPlayerId());
        $this->assertEquals($state->getWhitePlayerId(), $deserializedState->getWhitePlayerId());
        $this->assertEquals($state->getFinalChoice(), $deserializedState->getFinalChoice());
        
        // Assert: Tentative stones are preserved
        $originalStones = $state->getTentativeStones();
        $deserializedStones = $deserializedState->getTentativeStones();
        $this->assertCount(count($originalStones), $deserializedStones);
        
        for ($i = 0; $i < count($originalStones); $i++) {
            $this->assertEquals($originalStones[$i]->getX(), $deserializedStones[$i]->getX());
            $this->assertEquals($originalStones[$i]->getY(), $deserializedStones[$i]->getY());
            $this->assertEquals($originalStones[$i]->getPlacedBy(), $deserializedStones[$i]->getPlacedBy());
            $this->assertEquals($originalStones[$i]->getPlacementOrder(), $deserializedStones[$i]->getPlacementOrder());
            $this->assertEquals($originalStones[$i]->getPhase(), $deserializedStones[$i]->getPhase());
        }
        
        // Assert: Actions are preserved
        $originalActions = $state->getActions();
        $deserializedActions = $deserializedState->getActions();
        $this->assertCount(count($originalActions), $deserializedActions);
    }

    /**
     * Test: Swap 2 history is complete after completion
     * 
     * **Validates: Requirements 6.4, 7.3**
     * 
     * @test
     */
    public function testSwap2HistoryIsCompleteAfterCompletion(): void
    {
        // Arrange
        $gameId = $this->generateUuid();
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        // Complete full Swap 2 flow with place_more
        $state = $this->swap2Manager->initializeSwap2($gameId, $player1Id, $player2Id);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 7);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 7, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player1Id, 8, 7);
        $state = $this->swap2Manager->makeChoice($gameId, $player2Id, 'place_more');
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 8, 8);
        $state = $this->swap2Manager->placeStone($gameId, $player2Id, 9, 9);
        $state = $this->swap2Manager->makeChoice($gameId, $player1Id, 'black');
        
        // Get history
        $history = $this->swap2Manager->getSwap2History($state);
        
        // Assert: History contains all required data
        $this->assertArrayHasKey('actions', $history);
        $this->assertArrayHasKey('tentativeStones', $history);
        $this->assertArrayHasKey('finalChoice', $history);
        $this->assertArrayHasKey('finalAssignment', $history);
        
        // Assert: Actions are complete (5 placements + 2 choices)
        $this->assertCount(7, $history['actions']);
        
        // Assert: All 5 stones are recorded
        $this->assertCount(5, $history['tentativeStones']);
        
        // Assert: Final assignment is correct
        $this->assertEquals($player1Id, $history['finalAssignment']['blackPlayerId']);
        $this->assertEquals($player2Id, $history['finalAssignment']['whitePlayerId']);
        $this->assertEquals($player1Id, $history['finalAssignment']['firstMover']);
    }
}
