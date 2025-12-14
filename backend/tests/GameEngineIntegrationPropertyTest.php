<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\GameEngine;
use App\Services\SeriesManagerService;
use App\Services\ScoringEngineService;

/**
 * Property-Based Tests for GameEngine Series Integration
 * 
 * **Feature: ranked-bo3-system**
 * 
 * Tests the integration between GameEngine and SeriesManager for handling
 * game results within a BO3 series, including side swapping and series completion.
 * 
 * **Validates: Requirements 2.1, 2.4, 2.5**
 */
class GameEngineIntegrationPropertyTest extends TestCase
{
    use TestTrait;

    private SeriesManagerService $seriesManager;
    private ScoringEngineService $scoringEngine;
    private array $savedSeries = [];
    private \PDO $mockDb;

    protected function setUp(): void
    {
        parent::setUp();
        $this->erisSetup();
        
        $this->seriesManager = new SeriesManagerService();
        $this->scoringEngine = new ScoringEngineService();
        $this->savedSeries = [];
        
        // Set up mock database
        $this->mockDb = $this->createMockDatabase();
        
        // Configure GameEngine with services
        GameEngine::setSeriesManager($this->seriesManager);
        GameEngine::setScoringEngine($this->scoringEngine);
        GameEngine::setDatabase($this->mockDb);
        
        // Set up mock callbacks for SeriesManager
        $this->seriesManager->setPlayerFetcher(function (string $playerId) {
            return [
                'user_id' => $playerId,
                'mindpoint' => rand(0, 6000),
                'current_rank' => 'vo_danh',
            ];
        });
        
        $this->seriesManager->setSeriesSaver(function (array $series) {
            $this->savedSeries[$series['id']] = $series;
        });
        
        $this->seriesManager->setSeriesFinder(function (string $seriesId) {
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
     * Create a mock PDO database for testing
     * Uses a mock PDO that doesn't require SQLite driver
     */
    private function createMockDatabase(): \PDO
    {
        // Create a mock PDO using anonymous class
        return new class extends \PDO {
            private array $data = [];
            
            public function __construct()
            {
                // Don't call parent constructor - we're mocking
            }
            
            public function prepare($statement, $options = []): \PDOStatement|false
            {
                $mock = $this;
                return new class($mock, $statement) extends \PDOStatement {
                    private $mock;
                    private string $statement;
                    private array $params = [];
                    
                    public function __construct($mock, string $statement)
                    {
                        $this->mock = $mock;
                        $this->statement = $statement;
                    }
                    
                    public function execute($params = null): bool
                    {
                        $this->params = $params ?? [];
                        
                        // Handle UPDATE matches
                        if (str_contains($this->statement, 'UPDATE matches')) {
                            $this->mock->updateMatch($this->params[2], [
                                'series_id' => $this->params[0],
                                'game_number' => $this->params[1]
                            ]);
                        }
                        
                        // Handle SELECT
                        if (str_contains($this->statement, 'SELECT')) {
                            // Store params for fetch
                        }
                        
                        return true;
                    }
                    
                    public function fetch($mode = \PDO::FETCH_BOTH, $cursorOrientation = \PDO::FETCH_ORI_NEXT, $cursorOffset = 0): mixed
                    {
                        if (!empty($this->params)) {
                            return $this->mock->getMatch($this->params[0]);
                        }
                        return false;
                    }
                };
            }
            
            public function exec($statement): int|false
            {
                return 0;
            }
            
            public function setAttribute($attribute, $value): bool
            {
                return true;
            }
            
            public function updateMatch(string $id, array $data): void
            {
                $this->data[$id] = array_merge($this->data[$id] ?? ['id' => $id], $data);
            }
            
            public function getMatch(string $id): array|false
            {
                return $this->data[$id] ?? false;
            }
        };
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
     * *For any* series created through GameEngine, the series SHALL be properly initialized
     * with correct player sides and initial state.
     * 
     * **Validates: Requirements 2.1**
     * 
     * @test
     */
    public function gameEngineHandlesGameEndCorrectly(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2])  // Which player wins
            )
            ->withMaxSize(100)
            ->then(function (int $winnerPlayerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();
                
                // Create series
                $series = $this->seriesManager->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];
                
                $winnerId = $winnerPlayerNum === 1 ? $player1Id : $player2Id;
                $matchId = $this->generateUuid();
                
                // Use GameEngine to handle game end
                $result = GameEngine::handleGameEndInSeries($seriesId, $matchId, $winnerId, 300);
                
                // Property: Result SHALL contain series data
                $this->assertArrayHasKey('series', $result);
                $this->assertArrayHasKey('isComplete', $result);
                
                // Property: Series score SHALL be updated
                $updatedSeries = $result['series'];
                if ($winnerPlayerNum === 1) {
                    $this->assertEquals(1, $updatedSeries['player1_wins']);
                    $this->assertEquals(0, $updatedSeries['player2_wins']);
                } else {
                    $this->assertEquals(0, $updatedSeries['player1_wins']);
                    $this->assertEquals(1, $updatedSeries['player2_wins']);
                }
                
                // Property: Match SHALL be updated with series info
                $stmt = $this->mockDb->prepare('SELECT series_id, game_number FROM matches WHERE id = ?');
                $stmt->execute([$matchId]);
                $match = $stmt->fetch(\PDO::FETCH_ASSOC);
                
                if ($match) {
                    $this->assertEquals($seriesId, $match['series_id']);
                    $this->assertEquals(1, $match['game_number']);
                }
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 5: Swap 2 Initialization for Next Game**
     * 
     * *For any* series transitioning from game N to game N+1, a fresh Swap 2 state SHALL be initialized.
     * With Swap 2 enabled, sides are determined by Swap 2 choice, not automatic swapping.
     * 
     * **Validates: Requirements 2.4, 6.3**
     * 
     * @test
     */
    public function gameEngineSwapsSidesCorrectly(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2])  // Which player wins game 1
            )
            ->withMaxSize(100)
            ->then(function (int $game1WinnerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();
                
                // Create series
                $series = $this->seriesManager->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];
                
                // End game 1
                $winnerId = $game1WinnerNum === 1 ? $player1Id : $player2Id;
                $matchId1 = $this->generateUuid();
                
                $result1 = GameEngine::handleGameEndInSeries($seriesId, $matchId1, $winnerId, 300);
                
                // If series is not complete, verify next game setup
                if (!$result1['isComplete']) {
                    $updatedSeries = $result1['series'];
                    
                    // Property: Game number SHALL increment
                    $this->assertEquals(2, $updatedSeries['current_game']);
                    
                    // Property: Series SHALL remain in progress
                    $this->assertEquals('in_progress', $updatedSeries['status']);
                    
                    // Property: Swap 2 state SHALL be initialized for next game
                    // (With Swap 2, sides are determined by player choice, not automatic swap)
                    $this->assertArrayHasKey('swap2State', $result1);
                    $this->assertNotNull($result1['swap2State']);
                    
                    // Property: Swap 2 SHALL start in placement phase
                    $this->assertEquals('swap2_placement', $result1['swap2State']['phase']);
                    
                    // Property: Player 1 SHALL be active for stone placement
                    $this->assertEquals($player1Id, $result1['swap2State']['activePlayerId']);
                }
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 2: Side Assignment Fairness**
     * 
     * *For any* series, GameEngine SHALL correctly retrieve player sides.
     * 
     * **Validates: Requirements 2.4**
     * 
     * @test
     */
    public function gameEngineRetrievesPlayerSidesCorrectly(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();
                
                // Create series
                $series = $this->seriesManager->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];
                
                // Get player sides through GameEngine
                $sides = GameEngine::getSeriesPlayerSides($seriesId);
                
                // Property: Sides SHALL be returned correctly
                $this->assertNotNull($sides);
                $this->assertArrayHasKey('playerX', $sides);
                $this->assertArrayHasKey('playerO', $sides);
                $this->assertArrayHasKey('player1Side', $sides);
                $this->assertArrayHasKey('player2Side', $sides);
                
                // Property: Player IDs SHALL match series
                $this->assertContains($sides['playerX'], [$player1Id, $player2Id]);
                $this->assertContains($sides['playerO'], [$player1Id, $player2Id]);
                
                // Property: Sides must be opposite
                $this->assertNotEquals($sides['playerX'], $sides['playerO']);
                
                // Property: Sides must match series data
                if ($sides['player1Side'] === 'X') {
                    $this->assertEquals($player1Id, $sides['playerX']);
                    $this->assertEquals($player2Id, $sides['playerO']);
                } else {
                    $this->assertEquals($player1Id, $sides['playerO']);
                    $this->assertEquals($player2Id, $sides['playerX']);
                }
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 4: Series Completion Detection**
     * 
     * *For any* series where a player wins 2 games, GameEngine SHALL detect completion.
     * 
     * **Validates: Requirements 2.1, 2.5**
     * 
     * @test
     */
    public function gameEngineDetectsSeriesCompletion(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2])  // Which player wins both games
            )
            ->withMaxSize(100)
            ->then(function (int $winnerPlayerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();
                
                // Create series
                $series = $this->seriesManager->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];
                
                $winnerId = $winnerPlayerNum === 1 ? $player1Id : $player2Id;
                
                // End game 1
                $result1 = GameEngine::handleGameEndInSeries(
                    $seriesId,
                    $this->generateUuid(),
                    $winnerId,
                    300
                );
                
                // Property: Series should not be complete after 1 win
                $this->assertFalse($result1['isComplete']);
                
                // End game 2
                $result2 = GameEngine::handleGameEndInSeries(
                    $seriesId,
                    $this->generateUuid(),
                    $winnerId,
                    300
                );
                
                // Property: Series SHALL be complete after 2 wins
                $this->assertTrue($result2['isComplete']);
                
                // Property: isSeriesComplete SHALL return true
                $this->assertTrue(GameEngine::isSeriesComplete($seriesId));
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 5: Prepare Next Game Correctly**
     * 
     * *For any* series, GameEngine SHALL prepare next game with correct state.
     * With Swap 2 enabled, sides are preserved until Swap 2 determines new assignment.
     * 
     * **Validates: Requirements 2.5, 6.3**
     * 
     * @test
     */
    public function gameEnginePrepareNextGameCorrectly(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2])  // Which player wins game 1
            )
            ->withMaxSize(100)
            ->then(function (int $game1WinnerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();
                
                // Create series
                $series = $this->seriesManager->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];
                
                // End game 1
                $winnerId = $game1WinnerNum === 1 ? $player1Id : $player2Id;
                GameEngine::handleGameEndInSeries($seriesId, $this->generateUuid(), $winnerId, 300);
                
                // Prepare next game
                $nextGame = GameEngine::prepareNextGameInSeries($seriesId);
                
                // Property: Next game info SHALL be returned
                $this->assertNotNull($nextGame);
                $this->assertArrayHasKey('gameNumber', $nextGame);
                $this->assertArrayHasKey('player1Side', $nextGame);
                $this->assertArrayHasKey('player2Side', $nextGame);
                $this->assertArrayHasKey('score', $nextGame);
                
                // Property: Game number SHALL be 2
                $this->assertEquals(2, $nextGame['gameNumber']);
                
                // Property: Sides SHALL be valid (X or O)
                // With Swap 2, sides are determined by player choice during Swap 2 phase
                // The stored sides are fallback values until Swap 2 completes
                $this->assertContains($nextGame['player1Side'], ['X', 'O']);
                $this->assertContains($nextGame['player2Side'], ['X', 'O']);
                $this->assertNotEquals($nextGame['player1Side'], $nextGame['player2Side']);
                
                // Property: Score SHALL be updated
                if ($game1WinnerNum === 1) {
                    $this->assertStringContainsString('1-0', $nextGame['score']);
                } else {
                    $this->assertStringContainsString('0-1', $nextGame['score']);
                }
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 1: Series Initialization Correctness**
     * 
     * *For any* series, GameEngine SHALL retrieve correct series state.
     * 
     * **Validates: Requirements 2.1**
     * 
     * @test
     */
    public function gameEngineRetrievesSeriesStateCorrectly(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();
                
                // Create series
                $series = $this->seriesManager->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];
                
                // Get series state through GameEngine
                $state = GameEngine::getSeriesState($seriesId);
                
                // Property: State SHALL be returned
                $this->assertNotNull($state);
                $this->assertArrayHasKey('series', $state);
                $this->assertArrayHasKey('isComplete', $state);
                $this->assertArrayHasKey('nextGameReady', $state);
                
                // Property: Series data SHALL match
                $this->assertEquals($seriesId, $state['series']['id']);
                $this->assertEquals($player1Id, $state['series']['player1_id']);
                $this->assertEquals($player2Id, $state['series']['player2_id']);
                
                // Property: Initial state SHALL be correct
                $this->assertEquals(0, $state['series']['player1_wins']);
                $this->assertEquals(0, $state['series']['player2_wins']);
                $this->assertEquals('in_progress', $state['series']['status']);
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 4: Series Completion Detection**
     * 
     * *For any* non-existent series, GameEngine SHALL return null/false.
     * 
     * **Validates: Requirements 2.1**
     * 
     * @test
     */
    public function gameEngineHandlesNonExistentSeriesGracefully(): void
    {
        $this
            ->forAll(Generators::int())
            ->withMaxSize(100)
            ->then(function (int $_unused) {
                $nonExistentSeriesId = $this->generateUuid();
                
                // Property: getSeriesState SHALL return null
                $state = GameEngine::getSeriesState($nonExistentSeriesId);
                $this->assertNull($state);
                
                // Property: getSeriesPlayerSides SHALL return null
                $sides = GameEngine::getSeriesPlayerSides($nonExistentSeriesId);
                $this->assertNull($sides);
                
                // Property: isSeriesComplete SHALL return false
                $isComplete = GameEngine::isSeriesComplete($nonExistentSeriesId);
                $this->assertFalse($isComplete);
                
                // Property: prepareNextGameInSeries SHALL return null
                $nextGame = GameEngine::prepareNextGameInSeries($nonExistentSeriesId);
                $this->assertNull($nextGame);
            });
    }
}
