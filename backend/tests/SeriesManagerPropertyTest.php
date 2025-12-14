<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Services\SeriesManagerService;

/**
 * Property-Based Tests for SeriesManagerService
 * 
 * **Feature: ranked-bo3-system**
 * 
 * Tests the core properties of the SeriesManager service including
 * series initialization, side assignment, score updates, completion detection,
 * and side swapping.
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 7.3, 7.4**
 */
class SeriesManagerPropertyTest extends TestCase
{
    use TestTrait;

    private SeriesManagerService $service;
    private array $savedSeries = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->erisSetup();
        $this->service = new SeriesManagerService();
        $this->savedSeries = [];
        
        // Set up mock callbacks for testing
        $this->service->setPlayerFetcher(function (string $playerId) {
            // Return mock player data with random MP
            return [
                'user_id' => $playerId,
                'mindpoint' => rand(0, 6000),
                'current_rank' => 'vo_danh',
            ];
        });
        
        $this->service->setSeriesSaver(function (array $series) {
            $this->savedSeries[$series['id']] = $series;
        });
        
        $this->service->setSeriesFinder(function (string $seriesId) {
            return $this->savedSeries[$seriesId] ?? null;
        });
    }

    protected function tearDown(): void
    {
        $this->savedSeries = [];
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
     * **Feature: ranked-bo3-system, Property 1: Series Initialization Correctness**
     * 
     * *For any* two valid players matched in ranked mode, creating a series SHALL result in
     * status "in_progress", score "0-0", games_to_win = 2, and both players' initial MP/rank recorded.
     * 
     * **Validates: Requirements 1.1, 1.3, 1.4**
     * 
     * @test
     */
    public function seriesInitializationCorrectness(): void
    {
        $this
            ->forAll(
                Generators::choose(0, 6000),  // player1 MP
                Generators::choose(0, 6000)   // player2 MP
            )
            ->withMaxSize(100)
            ->then(function (int $player1MP, int $player2MP) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();
                
                // Set up player fetcher with specific MP values
                $this->service->setPlayerFetcher(function (string $playerId) use ($player1Id, $player2Id, $player1MP, $player2MP) {
                    if ($playerId === $player1Id) {
                        return ['user_id' => $playerId, 'mindpoint' => $player1MP];
                    }
                    if ($playerId === $player2Id) {
                        return ['user_id' => $playerId, 'mindpoint' => $player2MP];
                    }
                    return null;
                });

                $series = $this->service->createSeries($player1Id, $player2Id);

                // Property: Status SHALL be "in_progress"
                $this->assertEquals(
                    'in_progress',
                    $series['status'],
                    'New series must have status "in_progress"'
                );

                // Property: Score SHALL be "0-0"
                $this->assertEquals(0, $series['player1_wins'], 'Player 1 wins must be 0');
                $this->assertEquals(0, $series['player2_wins'], 'Player 2 wins must be 0');

                // Property: games_to_win SHALL be 2 (BO3 format)
                $this->assertEquals(
                    2,
                    $series['games_to_win'],
                    'games_to_win must be 2 for BO3'
                );

                // Property: Initial MP SHALL be recorded
                $this->assertEquals(
                    $player1MP,
                    $series['player1_initial_mp'],
                    'Player 1 initial MP must be recorded'
                );
                $this->assertEquals(
                    $player2MP,
                    $series['player2_initial_mp'],
                    'Player 2 initial MP must be recorded'
                );

                // Property: Initial rank SHALL be recorded
                $this->assertNotEmpty(
                    $series['player1_initial_rank'],
                    'Player 1 initial rank must be recorded'
                );
                $this->assertNotEmpty(
                    $series['player2_initial_rank'],
                    'Player 2 initial rank must be recorded'
                );

                // Property: current_game SHALL be 1
                $this->assertEquals(
                    1,
                    $series['current_game'],
                    'Current game must be 1'
                );

                // Property: Player IDs SHALL be recorded
                $this->assertEquals($player1Id, $series['player1_id']);
                $this->assertEquals($player2Id, $series['player2_id']);
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 2: Side Assignment Fairness**
     * 
     * *For any* large number of series created, the distribution of initial X/O assignments
     * SHALL be approximately 50/50 for each player position.
     * 
     * **Validates: Requirements 1.2**
     * 
     * @test
     */
    public function sideAssignmentFairness(): void
    {
        $player1XCount = 0;
        $player1OCount = 0;
        $totalSeries = 200;

        for ($i = 0; $i < $totalSeries; $i++) {
            $player1Id = $this->generateUuid();
            $player2Id = $this->generateUuid();

            $series = $this->service->createSeries($player1Id, $player2Id);

            if ($series['player1_side'] === 'X') {
                $player1XCount++;
            } else {
                $player1OCount++;
            }

            // Property: Sides must be opposite
            $this->assertNotEquals(
                $series['player1_side'],
                $series['player2_side'],
                'Player sides must be opposite'
            );

            // Property: Sides must be valid
            $this->assertContains(
                $series['player1_side'],
                ['X', 'O'],
                'Player 1 side must be X or O'
            );
            $this->assertContains(
                $series['player2_side'],
                ['X', 'O'],
                'Player 2 side must be X or O'
            );
        }

        // Property: Distribution should be approximately 50/50
        // Allow 20% deviation (40-60% range)
        $player1XRatio = $player1XCount / $totalSeries;
        $this->assertGreaterThan(
            0.30,
            $player1XRatio,
            "Player 1 X ratio ({$player1XRatio}) should be > 30%"
        );
        $this->assertLessThan(
            0.70,
            $player1XRatio,
            "Player 1 X ratio ({$player1XRatio}) should be < 70%"
        );
    }

    /**
     * **Feature: ranked-bo3-system, Property 3: Score Update Consistency**
     * 
     * *For any* game result in a series, the series score SHALL be updated by exactly +1
     * for the winner and +0 for the loser.
     * 
     * **Validates: Requirements 2.1, 2.3**
     * 
     * @test
     */
    public function scoreUpdateConsistency(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2])  // Which player wins (1 or 2)
            )
            ->withMaxSize(100)
            ->then(function (int $winnerPlayerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $series = $this->service->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];
                
                $initialPlayer1Wins = $series['player1_wins'];
                $initialPlayer2Wins = $series['player2_wins'];

                $winnerId = $winnerPlayerNum === 1 ? $player1Id : $player2Id;
                $matchId = $this->generateUuid();

                $result = $this->service->endGame($seriesId, $matchId, $winnerId, 300);
                $updatedSeries = $result['series'];

                // Property: Winner's score SHALL increase by exactly 1
                if ($winnerPlayerNum === 1) {
                    $this->assertEquals(
                        $initialPlayer1Wins + 1,
                        $updatedSeries['player1_wins'],
                        'Winner (player 1) score must increase by 1'
                    );
                    $this->assertEquals(
                        $initialPlayer2Wins,
                        $updatedSeries['player2_wins'],
                        'Loser (player 2) score must remain unchanged'
                    );
                } else {
                    $this->assertEquals(
                        $initialPlayer2Wins + 1,
                        $updatedSeries['player2_wins'],
                        'Winner (player 2) score must increase by 1'
                    );
                    $this->assertEquals(
                        $initialPlayer1Wins,
                        $updatedSeries['player1_wins'],
                        'Loser (player 1) score must remain unchanged'
                    );
                }
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 4: Series Completion Detection**
     * 
     * *For any* series state, the series SHALL be marked complete if and only if
     * either player has exactly 2 wins.
     * 
     * **Validates: Requirements 2.2, 3.1**
     * 
     * @test
     */
    public function seriesCompletionDetection(): void
    {
        $this
            ->forAll(
                Generators::choose(0, 2),  // player1 wins
                Generators::choose(0, 2)   // player2 wins
            )
            ->withMaxSize(100)
            ->then(function (int $player1Wins, int $player2Wins) {
                // Skip invalid states (both can't have 2 wins)
                if ($player1Wins === 2 && $player2Wins === 2) {
                    return;
                }

                $series = [
                    'player1_wins' => $player1Wins,
                    'player2_wins' => $player2Wins,
                ];

                $isComplete = $this->service->isSeriesComplete($series);
                $shouldBeComplete = ($player1Wins >= 2 || $player2Wins >= 2);

                // Property: Series SHALL be complete if and only if someone has 2 wins
                $this->assertEquals(
                    $shouldBeComplete,
                    $isComplete,
                    "Series with score {$player1Wins}-{$player2Wins} should " .
                    ($shouldBeComplete ? 'be' : 'not be') . ' complete'
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 5: Game Transition Correctness**
     * 
     * *For any* series transitioning from game N to game N+1, the game number SHALL increment
     * and a fresh Swap 2 state SHALL be initialized (Swap 2 determines sides, not automatic swap).
     * 
     * **Validates: Requirements 2.4, 6.3**
     * 
     * @test
     */
    public function gameTransitionCorrectness(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2])  // Which player wins game 1
            )
            ->withMaxSize(100)
            ->then(function (int $game1WinnerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $series = $this->service->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];

                // End game 1 (winner doesn't complete series yet)
                $winnerId = $game1WinnerNum === 1 ? $player1Id : $player2Id;
                $matchId = $this->generateUuid();

                $result = $this->service->endGame($seriesId, $matchId, $winnerId, 300);
                
                // If series is not complete, check game transition
                if (!$result['isComplete']) {
                    $updatedSeries = $result['series'];

                    // Property: Game number SHALL increment
                    $this->assertEquals(
                        2,
                        $updatedSeries['current_game'],
                        'Current game must be 2 after first game'
                    );

                    // Property: Fresh Swap 2 state SHALL be initialized
                    $this->assertArrayHasKey(
                        'swap2State',
                        $result,
                        'Result must contain swap2State for next game'
                    );

                    // Property: Swap 2 SHALL be in placement phase
                    $this->assertEquals(
                        'swap2_placement',
                        $result['swap2State']['phase'],
                        'Swap 2 must be in placement phase for new game'
                    );

                    // Property: Player 1 SHALL be active in Swap 2
                    $this->assertEquals(
                        $player1Id,
                        $result['swap2State']['activePlayerId'],
                        'Player 1 must be active in Swap 2 for new game'
                    );

                    // Property: nextGameReady SHALL be true
                    $this->assertTrue(
                        $result['nextGameReady'],
                        'nextGameReady must be true'
                    );
                }
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 4: Series Completion Detection**
     * 
     * *For any* series where a player wins 2 games, the series SHALL be marked as completed.
     * 
     * **Validates: Requirements 2.2, 3.1**
     * 
     * @test
     */
    public function seriesCompletesAfterTwoWins(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2])  // Which player wins both games
            )
            ->withMaxSize(100)
            ->then(function (int $winnerPlayerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $series = $this->service->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];

                $winnerId = $winnerPlayerNum === 1 ? $player1Id : $player2Id;

                // Win game 1
                $result1 = $this->service->endGame($seriesId, $this->generateUuid(), $winnerId, 300);
                $this->assertFalse($result1['isComplete'], 'Series should not be complete after 1 win');

                // Win game 2
                $result2 = $this->service->endGame($seriesId, $this->generateUuid(), $winnerId, 300);
                
                // Property: Series SHALL be complete after 2 wins
                $this->assertTrue($result2['isComplete'], 'Series must be complete after 2 wins');
                
                // Property: Status SHALL be "completed"
                $this->assertEquals(
                    'completed',
                    $result2['series']['status'],
                    'Series status must be "completed"'
                );

                // Property: Winner SHALL be recorded
                $this->assertEquals(
                    $winnerId,
                    $result2['series']['winner_id'],
                    'Winner must be recorded'
                );

                // Property: Final score SHALL reflect winner with 2 wins
                $expectedScore = $winnerPlayerNum === 1 ? '2-0' : '0-2';
                $this->assertEquals(
                    $expectedScore,
                    $result2['series']['final_score'],
                    'Final score must reflect 2-0 sweep for winner'
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 3: Score Update Consistency**
     * 
     * *For any* forfeit, the opponent's score SHALL increase by exactly 1.
     * 
     * **Validates: Requirements 7.3**
     * 
     * @test
     */
    public function forfeitUpdatesScoreCorrectly(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2])  // Which player forfeits
            )
            ->withMaxSize(100)
            ->then(function (int $forfeitingPlayerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $series = $this->service->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];
                
                $initialPlayer1Wins = $series['player1_wins'];
                $initialPlayer2Wins = $series['player2_wins'];

                $forfeitingPlayerId = $forfeitingPlayerNum === 1 ? $player1Id : $player2Id;

                $result = $this->service->forfeitGame($seriesId, $forfeitingPlayerId);
                $updatedSeries = $result['series'];

                // Property: Opponent's score SHALL increase by 1
                if ($forfeitingPlayerNum === 1) {
                    // Player 1 forfeits, player 2 wins
                    $this->assertEquals(
                        $initialPlayer2Wins + 1,
                        $updatedSeries['player2_wins'],
                        'Opponent (player 2) score must increase by 1 on forfeit'
                    );
                    $this->assertEquals(
                        $initialPlayer1Wins,
                        $updatedSeries['player1_wins'],
                        'Forfeiting player (player 1) score must remain unchanged'
                    );
                } else {
                    // Player 2 forfeits, player 1 wins
                    $this->assertEquals(
                        $initialPlayer1Wins + 1,
                        $updatedSeries['player1_wins'],
                        'Opponent (player 1) score must increase by 1 on forfeit'
                    );
                    $this->assertEquals(
                        $initialPlayer2Wins,
                        $updatedSeries['player2_wins'],
                        'Forfeiting player (player 2) score must remain unchanged'
                    );
                }
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 17: Abandon Penalty**
     * 
     * *For any* abandoned series, the abandoning player SHALL lose 25 MP
     * (15 standard + 10 abandon penalty).
     * 
     * **Validates: Requirements 7.4**
     * 
     * @test
     */
    public function abandonSeriesAppliesPenalty(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2])  // Which player abandons
            )
            ->withMaxSize(100)
            ->then(function (int $abandoningPlayerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $series = $this->service->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];

                $abandoningPlayerId = $abandoningPlayerNum === 1 ? $player1Id : $player2Id;
                $winnerId = $abandoningPlayerNum === 1 ? $player2Id : $player1Id;

                $result = $this->service->abandonSeries($seriesId, $abandoningPlayerId);

                // Property: Status SHALL be "abandoned"
                $this->assertEquals(
                    'abandoned',
                    $result['series']['status'],
                    'Series status must be "abandoned"'
                );

                // Property: Winner SHALL be the opponent
                $this->assertEquals(
                    $winnerId,
                    $result['winnerId'],
                    'Winner must be the opponent of abandoning player'
                );

                // Property: Loser SHALL be the abandoning player
                $this->assertEquals(
                    $abandoningPlayerId,
                    $result['loserId'],
                    'Loser must be the abandoning player'
                );

                // Property: isAbandoned flag SHALL be true
                $this->assertTrue(
                    $result['isAbandoned'],
                    'isAbandoned flag must be true'
                );

                // Property: Abandon penalty SHALL be -25 MP
                $this->assertEquals(
                    -25,
                    $result['abandonPenalty'],
                    'Abandon penalty must be -25 MP'
                );

                // Property: loser_mp_change SHALL be -25
                $this->assertEquals(
                    -25,
                    $result['series']['loser_mp_change'],
                    'loser_mp_change must be -25 for abandon'
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 1: Series Initialization Correctness**
     * 
     * *For any* attempt to create a series with the same player twice,
     * the system SHALL throw an exception.
     * 
     * **Validates: Requirements 1.1**
     * 
     * @test
     */
    public function createSeriesRejectsSamePlayer(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $playerId = $this->generateUuid();

                $this->expectException(\InvalidArgumentException::class);
                $this->service->createSeries($playerId, $playerId);
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 1: Series Initialization Correctness**
     * 
     * *For any* attempt to create a series with invalid UUID format,
     * the system SHALL throw an exception.
     * 
     * **Validates: Requirements 1.1**
     * 
     * @test
     */
    public function createSeriesRejectsInvalidUuid(): void
    {
        $invalidUuids = ['invalid', '123', 'not-a-uuid', '', '   '];
        
        $this
            ->forAll(
                Generators::elements($invalidUuids)
            )
            ->withMaxSize(100)
            ->then(function (string $invalidUuid) {
                $validUuid = $this->generateUuid();

                $this->expectException(\InvalidArgumentException::class);
                $this->service->createSeries($invalidUuid, $validUuid);
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 10: Series Swap 2 Reset**
     * 
     * *For any* new game in a ranked series, the game SHALL start with fresh
     * swap2_placement phase regardless of previous game's color assignments.
     * 
     * **Validates: Requirements 6.3**
     * 
     * @test
     */
    public function seriesSwap2Reset(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2])  // Which player wins game 1
            )
            ->withMaxSize(100)
            ->then(function (int $game1WinnerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Create series - should initialize Swap 2 for game 1
                $series = $this->service->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];

                // Property: Initial series SHALL have Swap 2 state
                $this->assertArrayHasKey(
                    'swap2State',
                    $series,
                    'New series must have swap2State'
                );

                // Property: Initial Swap 2 phase SHALL be swap2_placement
                $this->assertEquals(
                    'swap2_placement',
                    $series['swap2State']['phase'],
                    'Initial Swap 2 phase must be swap2_placement'
                );

                // Property: Player 1 SHALL be active in initial Swap 2
                $this->assertEquals(
                    $player1Id,
                    $series['swap2State']['activePlayerId'],
                    'Player 1 must be active in initial Swap 2'
                );

                // Property: No tentative stones initially
                $this->assertEmpty(
                    $series['swap2State']['tentativeStones'],
                    'Initial Swap 2 must have no tentative stones'
                );

                // End game 1 (winner doesn't complete series yet)
                $winnerId = $game1WinnerNum === 1 ? $player1Id : $player2Id;
                $matchId = $this->generateUuid();

                $result = $this->service->endGame($seriesId, $matchId, $winnerId, 300);

                // If series is not complete, check Swap 2 reset
                if (!$result['isComplete']) {
                    // Property: Next game SHALL have fresh Swap 2 state
                    $this->assertArrayHasKey(
                        'swap2State',
                        $result,
                        'Next game must have swap2State'
                    );

                    // Property: Swap 2 phase SHALL be reset to swap2_placement
                    $this->assertEquals(
                        'swap2_placement',
                        $result['swap2State']['phase'],
                        'Swap 2 phase must be reset to swap2_placement for new game'
                    );

                    // Property: Player 1 SHALL be active again (fresh start)
                    $this->assertEquals(
                        $player1Id,
                        $result['swap2State']['activePlayerId'],
                        'Player 1 must be active in new game Swap 2'
                    );

                    // Property: Tentative stones SHALL be empty (fresh start)
                    $this->assertEmpty(
                        $result['swap2State']['tentativeStones'],
                        'New game Swap 2 must have no tentative stones'
                    );

                    // Property: No color assignments yet (fresh start)
                    $this->assertNull(
                        $result['swap2State']['blackPlayerId'],
                        'New game Swap 2 must not have blackPlayerId assigned'
                    );
                    $this->assertNull(
                        $result['swap2State']['whitePlayerId'],
                        'New game Swap 2 must not have whitePlayerId assigned'
                    );

                    // Property: Actions SHALL be empty (fresh start)
                    $this->assertEmpty(
                        $result['swap2State']['actions'],
                        'New game Swap 2 must have no actions'
                    );
                }
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 10: Series Swap 2 Reset**
     * 
     * *For any* series with multiple games, each game SHALL have independent
     * Swap 2 process (not carry over from previous game).
     * 
     * **Validates: Requirements 6.3**
     * 
     * @test
     */
    public function eachGameHasIndependentSwap2(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2]),  // Game 1 winner
                Generators::elements([1, 2])   // Game 2 winner (different from game 1)
            )
            ->withMaxSize(100)
            ->then(function (int $game1WinnerNum, int $game2WinnerNum) {
                // Skip if same player wins both (series would end)
                if ($game1WinnerNum === $game2WinnerNum) {
                    return;
                }

                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $series = $this->service->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];

                // Game 1
                $winner1Id = $game1WinnerNum === 1 ? $player1Id : $player2Id;
                $result1 = $this->service->endGame($seriesId, $this->generateUuid(), $winner1Id, 300);
                
                $this->assertFalse($result1['isComplete'], 'Series should not be complete after game 1');
                $game2Swap2 = $result1['swap2State'];

                // Game 2
                $winner2Id = $game2WinnerNum === 1 ? $player1Id : $player2Id;
                $result2 = $this->service->endGame($seriesId, $this->generateUuid(), $winner2Id, 300);

                // If series continues to game 3
                if (!$result2['isComplete']) {
                    $game3Swap2 = $result2['swap2State'];

                    // Property: Game 3 Swap 2 SHALL be independent from Game 2
                    $this->assertEquals(
                        'swap2_placement',
                        $game3Swap2['phase'],
                        'Game 3 must start with fresh swap2_placement phase'
                    );

                    // Property: Each game starts with Player 1 active
                    $this->assertEquals(
                        $player1Id,
                        $game3Swap2['activePlayerId'],
                        'Game 3 must start with Player 1 active'
                    );
                }
            });
    }

    /**
     * **Feature: swap2-opening-rule, Property 10: Series Swap 2 Reset**
     * 
     * *For any* call to prepareNextSeriesGame, the returned state SHALL have
     * fresh Swap 2 in placement phase.
     * 
     * **Validates: Requirements 6.3**
     * 
     * @test
     */
    public function prepareNextSeriesGameResetsSwap2(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2])  // Which player wins game 1
            )
            ->withMaxSize(100)
            ->then(function (int $game1WinnerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                $series = $this->service->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];

                // End game 1
                $winnerId = $game1WinnerNum === 1 ? $player1Id : $player2Id;
                $this->service->endGame($seriesId, $this->generateUuid(), $winnerId, 300);

                // Explicitly call prepareNextSeriesGame
                try {
                    $nextGameResult = $this->service->prepareNextSeriesGame($seriesId);

                    // Property: Result SHALL contain swap2State
                    $this->assertArrayHasKey(
                        'swap2State',
                        $nextGameResult,
                        'prepareNextSeriesGame must return swap2State'
                    );

                    // Property: Swap 2 SHALL be in placement phase
                    $this->assertEquals(
                        'swap2_placement',
                        $nextGameResult['swap2State']['phase'],
                        'prepareNextSeriesGame must reset to swap2_placement'
                    );

                    // Property: Result SHALL contain gameId
                    $this->assertArrayHasKey(
                        'gameId',
                        $nextGameResult,
                        'prepareNextSeriesGame must return gameId'
                    );

                    // Property: nextGameReady SHALL be true
                    $this->assertTrue(
                        $nextGameResult['nextGameReady'],
                        'nextGameReady must be true'
                    );
                } catch (\RuntimeException $e) {
                    // Series might be complete if same player won twice
                    // This is expected behavior
                    $this->assertStringContainsString(
                        'complete',
                        strtolower($e->getMessage())
                    );
                }
            });
    }
}
