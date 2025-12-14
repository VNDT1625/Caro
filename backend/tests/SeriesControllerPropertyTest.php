<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Controllers\SeriesController;
use App\Services\SeriesManagerService;

/**
 * Property-Based Tests for SeriesController
 * 
 * **Feature: ranked-bo3-system**
 * 
 * Tests the API controller properties including series data completeness,
 * game-series linkage, and rematch functionality.
 * 
 * **Validates: Requirements 9.2, 9.3, 10.2**
 */
class SeriesControllerPropertyTest extends TestCase
{
    use TestTrait;

    private SeriesController $controller;
    private SeriesManagerService $seriesManager;
    private array $savedSeries = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->erisSetup();
        $this->savedSeries = [];
        
        $this->seriesManager = new SeriesManagerService();
        
        // Set up mock callbacks for testing
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
        
        $this->controller = new SeriesController($this->seriesManager);
        SeriesController::clearRematchRequests();
    }

    protected function tearDown(): void
    {
        $this->savedSeries = [];
        SeriesController::clearRematchRequests();
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
     * **Feature: ranked-bo3-system, Property 18: Series Data Completeness**
     * 
     * *For any* completed series, all required fields SHALL be stored:
     * winner_id, final_score, mp_changes, coins, exp.
     * 
     * **Validates: Requirements 9.3**
     * 
     * @test
     */
    public function seriesDataCompleteness(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2])  // Which player wins
            )
            ->withMaxSize(100)
            ->then(function (int $winnerPlayerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Create series via controller
                $createResponse = $this->controller->create([
                    'player1_id' => $player1Id,
                    'player2_id' => $player2Id,
                ]);

                $this->assertTrue($createResponse['success'], 'Series creation should succeed');
                $this->assertEquals(201, $createResponse['status'], 'Status should be 201');
                
                $seriesId = $createResponse['data']['id'];
                $winnerId = $winnerPlayerNum === 1 ? $player1Id : $player2Id;

                // Win 2 games to complete series
                $matchId1 = $this->generateUuid();
                $this->controller->endGame($seriesId, [
                    'match_id' => $matchId1,
                    'winner_id' => $winnerId,
                    'duration' => 300,
                ]);

                $matchId2 = $this->generateUuid();
                $endResponse = $this->controller->endGame($seriesId, [
                    'match_id' => $matchId2,
                    'winner_id' => $winnerId,
                    'duration' => 300,
                ]);

                // Get series state
                $showResponse = $this->controller->show($seriesId);
                
                $this->assertTrue($showResponse['success'], 'Show should succeed');
                $series = $showResponse['data']['series'];

                // Property: Series SHALL have winner_id
                $this->assertNotNull(
                    $series['winner_id'],
                    'Completed series must have winner_id'
                );
                $this->assertEquals(
                    $winnerId,
                    $series['winner_id'],
                    'Winner ID must match the actual winner'
                );

                // Property: Series SHALL have final_score
                $this->assertNotNull(
                    $series['final_score'],
                    'Completed series must have final_score'
                );
                $this->assertMatchesRegularExpression(
                    '/^\d+-\d+$/',
                    $series['final_score'],
                    'Final score must be in format X-Y'
                );

                // Property: Series SHALL have status "completed"
                $this->assertEquals(
                    'completed',
                    $series['status'],
                    'Completed series must have status "completed"'
                );

                // Property: Series SHALL have ended_at timestamp
                $this->assertNotNull(
                    $series['ended_at'],
                    'Completed series must have ended_at timestamp'
                );

                // Property: is_complete flag SHALL be true
                $this->assertTrue(
                    $showResponse['data']['is_complete'],
                    'is_complete flag must be true for completed series'
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 19: Game-Series Linkage**
     * 
     * *For any* game in a series, the game record SHALL have correct series_id
     * and game_number.
     * 
     * **Validates: Requirements 9.2**
     * 
     * @test
     */
    public function gameSeriesLinkage(): void
    {
        $this
            ->forAll(
                Generators::choose(1, 3)  // Number of games to play
            )
            ->withMaxSize(100)
            ->then(function (int $numGames) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Create series
                $createResponse = $this->controller->create([
                    'player1_id' => $player1Id,
                    'player2_id' => $player2Id,
                ]);

                $this->assertTrue($createResponse['success']);
                $seriesId = $createResponse['data']['id'];

                // Track game numbers
                $gameNumbers = [];
                $winners = [$player1Id, $player2Id, $player1Id]; // Alternate winners

                for ($i = 0; $i < min($numGames, 2); $i++) {
                    $matchId = $this->generateUuid();
                    $winnerId = $winners[$i % 2];

                    // Get current game number before ending
                    $stateResponse = $this->controller->show($seriesId);
                    $currentGame = $stateResponse['data']['series']['current_game'];
                    $gameNumbers[] = $currentGame;

                    $endResponse = $this->controller->endGame($seriesId, [
                        'match_id' => $matchId,
                        'winner_id' => $winnerId,
                        'duration' => 300,
                    ]);

                    // Property: Response SHALL include series data
                    $this->assertTrue($endResponse['success'], 'End game should succeed');
                    $this->assertArrayHasKey('series', $endResponse['data']);

                    // If series continues, game number should increment
                    if (!$endResponse['data']['is_complete']) {
                        $newState = $this->controller->show($seriesId);
                        $newGameNum = $newState['data']['series']['current_game'];
                        
                        // Property: Game number SHALL increment after each game
                        $this->assertEquals(
                            $currentGame + 1,
                            $newGameNum,
                            'Game number must increment after each game'
                        );
                    }
                }

                // Property: Game numbers SHALL be sequential starting from 1
                for ($i = 0; $i < count($gameNumbers); $i++) {
                    $this->assertEquals(
                        $i + 1,
                        $gameNumbers[$i],
                        "Game {$i} should have game_number " . ($i + 1)
                    );
                }
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 20: Rematch Creates New Series**
     * 
     * *For any* mutual rematch request, a new series SHALL be created with
     * the same players but fresh state.
     * 
     * **Validates: Requirements 10.2**
     * 
     * @test
     */
    public function rematchCreatesNewSeries(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2])  // Which player wins original series
            )
            ->withMaxSize(100)
            ->then(function (int $winnerPlayerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Create and complete original series
                $createResponse = $this->controller->create([
                    'player1_id' => $player1Id,
                    'player2_id' => $player2Id,
                ]);

                $originalSeriesId = $createResponse['data']['id'];
                $winnerId = $winnerPlayerNum === 1 ? $player1Id : $player2Id;

                // Complete the series (2 wins)
                $this->controller->endGame($originalSeriesId, [
                    'match_id' => $this->generateUuid(),
                    'winner_id' => $winnerId,
                    'duration' => 300,
                ]);
                $this->controller->endGame($originalSeriesId, [
                    'match_id' => $this->generateUuid(),
                    'winner_id' => $winnerId,
                    'duration' => 300,
                ]);

                // Player 1 requests rematch
                $rematch1Response = $this->controller->rematch($originalSeriesId, [
                    'player_id' => $player1Id,
                ]);

                $this->assertTrue($rematch1Response['success']);
                $this->assertFalse(
                    $rematch1Response['data']['rematch_accepted'],
                    'First rematch request should wait for opponent'
                );
                $this->assertTrue(
                    $rematch1Response['data']['waiting_for_opponent'],
                    'Should be waiting for opponent'
                );

                // Player 2 requests rematch (mutual)
                $rematch2Response = $this->controller->rematch($originalSeriesId, [
                    'player_id' => $player2Id,
                ]);

                // Property: Mutual rematch SHALL create new series
                $this->assertTrue($rematch2Response['success']);
                $this->assertTrue(
                    $rematch2Response['data']['rematch_accepted'],
                    'Mutual rematch should be accepted'
                );
                $this->assertArrayHasKey(
                    'new_series',
                    $rematch2Response['data'],
                    'Response must include new_series'
                );

                $newSeries = $rematch2Response['data']['new_series'];

                // Property: New series SHALL have different ID
                $this->assertNotEquals(
                    $originalSeriesId,
                    $newSeries['id'],
                    'New series must have different ID'
                );

                // Property: New series SHALL have same players
                $this->assertEquals(
                    $player1Id,
                    $newSeries['player1_id'],
                    'New series must have same player1'
                );
                $this->assertEquals(
                    $player2Id,
                    $newSeries['player2_id'],
                    'New series must have same player2'
                );

                // Property: New series SHALL have fresh state
                $this->assertEquals(
                    'in_progress',
                    $newSeries['status'],
                    'New series must have status in_progress'
                );
                $this->assertEquals(
                    0,
                    $newSeries['player1_wins'],
                    'New series must have 0 wins for player1'
                );
                $this->assertEquals(
                    0,
                    $newSeries['player2_wins'],
                    'New series must have 0 wins for player2'
                );
                $this->assertEquals(
                    1,
                    $newSeries['current_game'],
                    'New series must start at game 1'
                );
                $this->assertNull(
                    $newSeries['winner_id'],
                    'New series must have no winner'
                );
                $this->assertNull(
                    $newSeries['final_score'],
                    'New series must have no final score'
                );
            });
    }


    /**
     * **Feature: ranked-bo3-system, Property 18: Series Data Completeness**
     * 
     * *For any* create request with valid player IDs, the response SHALL include
     * all required series fields.
     * 
     * **Validates: Requirements 9.3**
     * 
     * @test
     */
    public function createResponseContainsAllRequiredFields(): void
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
                $this->seriesManager->setPlayerFetcher(function (string $playerId) use ($player1Id, $player2Id, $player1MP, $player2MP) {
                    if ($playerId === $player1Id) {
                        return ['user_id' => $playerId, 'mindpoint' => $player1MP];
                    }
                    if ($playerId === $player2Id) {
                        return ['user_id' => $playerId, 'mindpoint' => $player2MP];
                    }
                    return null;
                });

                $response = $this->controller->create([
                    'player1_id' => $player1Id,
                    'player2_id' => $player2Id,
                ]);

                $this->assertTrue($response['success']);
                $this->assertEquals(201, $response['status']);
                
                $data = $response['data'];

                // Property: Response SHALL include all required fields
                $requiredFields = [
                    'id', 'player1_id', 'player2_id',
                    'player1_initial_mp', 'player2_initial_mp',
                    'player1_initial_rank', 'player2_initial_rank',
                    'player1_wins', 'player2_wins',
                    'games_to_win', 'current_game',
                    'player1_side', 'player2_side',
                    'status', 'created_at', 'started_at'
                ];

                foreach ($requiredFields as $field) {
                    $this->assertArrayHasKey(
                        $field,
                        $data,
                        "Response must include field: {$field}"
                    );
                }

                // Property: Initial values SHALL be correct
                $this->assertEquals($player1Id, $data['player1_id']);
                $this->assertEquals($player2Id, $data['player2_id']);
                $this->assertEquals($player1MP, $data['player1_initial_mp']);
                $this->assertEquals($player2MP, $data['player2_initial_mp']);
                $this->assertEquals(0, $data['player1_wins']);
                $this->assertEquals(0, $data['player2_wins']);
                $this->assertEquals(2, $data['games_to_win']);
                $this->assertEquals(1, $data['current_game']);
                $this->assertEquals('in_progress', $data['status']);
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 18: Series Data Completeness**
     * 
     * *For any* invalid create request, the response SHALL include proper error details.
     * 
     * **Validates: Requirements 9.3**
     * 
     * @test
     */
    public function createValidationErrors(): void
    {
        // Test missing player1_id
        $response1 = $this->controller->create([
            'player2_id' => $this->generateUuid(),
        ]);
        $this->assertFalse($response1['success']);
        $this->assertEquals(422, $response1['status']);
        $this->assertEquals('VALIDATION_ERROR', $response1['error']['code']);
        $this->assertArrayHasKey('player1_id', $response1['error']['details']);

        // Test missing player2_id
        $response2 = $this->controller->create([
            'player1_id' => $this->generateUuid(),
        ]);
        $this->assertFalse($response2['success']);
        $this->assertEquals(422, $response2['status']);
        $this->assertArrayHasKey('player2_id', $response2['error']['details']);

        // Test same player
        $sameId = $this->generateUuid();
        $response3 = $this->controller->create([
            'player1_id' => $sameId,
            'player2_id' => $sameId,
        ]);
        $this->assertFalse($response3['success']);
        $this->assertEquals(422, $response3['status']);

        // Test invalid UUID format
        $response4 = $this->controller->create([
            'player1_id' => 'invalid-uuid',
            'player2_id' => $this->generateUuid(),
        ]);
        $this->assertFalse($response4['success']);
        $this->assertEquals(422, $response4['status']);
    }

    /**
     * **Feature: ranked-bo3-system, Property 19: Game-Series Linkage**
     * 
     * *For any* show request with invalid series ID, the response SHALL return 404.
     * 
     * **Validates: Requirements 9.2**
     * 
     * @test
     */
    public function showReturns404ForNonexistentSeries(): void
    {
        $nonexistentId = $this->generateUuid();
        
        $response = $this->controller->show($nonexistentId);
        
        $this->assertFalse($response['success']);
        $this->assertEquals(404, $response['status']);
        $this->assertEquals('SERIES_NOT_FOUND', $response['error']['code']);
    }

    /**
     * **Feature: ranked-bo3-system, Property 19: Game-Series Linkage**
     * 
     * *For any* show request with invalid UUID format, the response SHALL return 422.
     * 
     * **Validates: Requirements 9.2**
     * 
     * @test
     */
    public function showReturns422ForInvalidUuid(): void
    {
        $invalidIds = ['invalid', '123', 'not-a-uuid', ''];
        
        foreach ($invalidIds as $invalidId) {
            $response = $this->controller->show($invalidId);
            
            $this->assertFalse($response['success']);
            $this->assertEquals(422, $response['status']);
            $this->assertEquals('VALIDATION_ERROR', $response['error']['code']);
        }
    }

    /**
     * **Feature: ranked-bo3-system, Property 20: Rematch Creates New Series**
     * 
     * *For any* rematch request on non-completed series, the response SHALL return error.
     * 
     * **Validates: Requirements 10.2**
     * 
     * @test
     */
    public function rematchRejectsInProgressSeries(): void
    {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        // Create series but don't complete it
        $createResponse = $this->controller->create([
            'player1_id' => $player1Id,
            'player2_id' => $player2Id,
        ]);

        $seriesId = $createResponse['data']['id'];

        // Try to rematch on in-progress series
        $rematchResponse = $this->controller->rematch($seriesId, [
            'player_id' => $player1Id,
        ]);

        $this->assertFalse($rematchResponse['success']);
        $this->assertEquals(400, $rematchResponse['status']);
        $this->assertEquals('INVALID_STATE', $rematchResponse['error']['code']);
    }

    /**
     * **Feature: ranked-bo3-system, Property 20: Rematch Creates New Series**
     * 
     * *For any* rematch request from non-participant, the response SHALL return error.
     * 
     * **Validates: Requirements 10.2**
     * 
     * @test
     */
    public function rematchRejectsNonParticipant(): void
    {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();
        $outsiderId = $this->generateUuid();

        // Create and complete series
        $createResponse = $this->controller->create([
            'player1_id' => $player1Id,
            'player2_id' => $player2Id,
        ]);

        $seriesId = $createResponse['data']['id'];

        // Complete the series
        $this->controller->endGame($seriesId, [
            'match_id' => $this->generateUuid(),
            'winner_id' => $player1Id,
            'duration' => 300,
        ]);
        $this->controller->endGame($seriesId, [
            'match_id' => $this->generateUuid(),
            'winner_id' => $player1Id,
            'duration' => 300,
        ]);

        // Try to rematch as outsider
        $rematchResponse = $this->controller->rematch($seriesId, [
            'player_id' => $outsiderId,
        ]);

        $this->assertFalse($rematchResponse['success']);
        $this->assertEquals(422, $rematchResponse['status']);
    }
}
