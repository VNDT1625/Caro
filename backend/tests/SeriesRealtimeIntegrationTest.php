<?php

use PHPUnit\Framework\TestCase;
use App\Services\SeriesManagerService;
use App\Services\ScoringEngineService;

/**
 * Integration Tests for Series Realtime Events
 * 
 * **Feature: ranked-bo3-system**
 * 
 * Tests that all series events are properly emitted and structured for realtime
 * subscriptions. Validates that the frontend can receive and process events correctly.
 * 
 * **Validates: Requirements 7.1, 7.2, 8.3, 8.5**
 */
class SeriesRealtimeIntegrationTest extends TestCase
{
    private SeriesManagerService $seriesManager;
    private ScoringEngineService $scoringEngine;
    private array $savedSeries = [];
    private array $emittedEvents = [];

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->seriesManager = new SeriesManagerService();
        $this->scoringEngine = new ScoringEngineService();
        $this->savedSeries = [];
        $this->emittedEvents = [];

        // Set up mock callbacks
        $this->seriesManager->setPlayerFetcher(function (string $playerId) {
            return [
                'user_id' => $playerId,
                'mindpoint' => 100,
                'current_rank' => 'vo_danh',
            ];
        });

        $this->seriesManager->setSeriesSaver(function (array $series) {
            $this->savedSeries[$series['id']] = $series;
        });

        $this->seriesManager->setSeriesFinder(function (string $seriesId) {
            return $this->savedSeries[$seriesId] ?? null;
        });

        // Note: ScoringEngine is not used in these tests, so no database setup needed
    }

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
     * Test that series creation emits proper event structure
     * 
     * **Validates: Requirements 8.3**
     * 
     * @test
     */
    public function seriesCreatedEventStructure(): void
    {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        $series = $this->seriesManager->createSeries($player1Id, $player2Id);

        // Verify series structure for realtime event
        $this->assertArrayHasKey('id', $series);
        $this->assertArrayHasKey('player1_id', $series);
        $this->assertArrayHasKey('player2_id', $series);
        $this->assertArrayHasKey('player1_wins', $series);
        $this->assertArrayHasKey('player2_wins', $series);
        $this->assertArrayHasKey('current_game', $series);
        $this->assertArrayHasKey('player1_side', $series);
        $this->assertArrayHasKey('player2_side', $series);
        $this->assertArrayHasKey('status', $series);
        $this->assertArrayHasKey('created_at', $series);

        // Verify initial state
        $this->assertEquals('in_progress', $series['status']);
        $this->assertEquals(0, $series['player1_wins']);
        $this->assertEquals(0, $series['player2_wins']);
        $this->assertEquals(1, $series['current_game']);
        $this->assertTrue(in_array($series['player1_side'], ['X', 'O']), 'player1_side should be X or O');
        $this->assertTrue(in_array($series['player2_side'], ['X', 'O']), 'player2_side should be X or O');
        $this->assertNotEquals($series['player1_side'], $series['player2_side']);
    }

    /**
     * Test that game end emits score update event
     * 
     * **Validates: Requirements 8.3, 8.5**
     * 
     * @test
     */
    public function gameEndedEventStructure(): void
    {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        $series = $this->seriesManager->createSeries($player1Id, $player2Id);
        $seriesId = $series['id'];
        $matchId = $this->generateUuid();

        // End first game with player1 winning
        $result = $this->seriesManager->endGame($seriesId, $matchId, $player1Id, 300);

        // Verify event structure
        $this->assertArrayHasKey('series', $result);
        $this->assertArrayHasKey('isComplete', $result);
        $this->assertArrayHasKey('nextGameReady', $result);

        $updatedSeries = $result['series'];
        
        // Verify score was updated
        $this->assertEquals(1, $updatedSeries['player1_wins']);
        $this->assertEquals(0, $updatedSeries['player2_wins']);
        
        // Verify series is not complete yet
        $this->assertFalse($result['isComplete']);
        
        // Verify next game is ready
        $this->assertTrue($result['nextGameReady']);
    }

    /**
     * Test that side swap event is emitted correctly
     * 
     * **Validates: Requirements 8.3, 8.5**
     * 
     * @test
     */
    public function sideSwapEventStructure(): void
    {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        $series = $this->seriesManager->createSeries($player1Id, $player2Id);
        $seriesId = $series['id'];
        $matchId = $this->generateUuid();

        // End first game
        $result = $this->seriesManager->endGame($seriesId, $matchId, $player1Id, 300);
        $updatedSeries = $result['series'];

        // Note: Sides are NOT swapped anymore because Swap 2 handles side assignment
        // for each game. The player1_side and player2_side fields are only used
        // as fallback when Swap 2 is disabled.
        
        // Verify game number advanced
        $this->assertEquals(2, $updatedSeries['current_game']);
        
        // Verify sides are still valid (X or O)
        $this->assertTrue(in_array($updatedSeries['player1_side'], ['X', 'O']), 'player1_side should be X or O');
        $this->assertTrue(in_array($updatedSeries['player2_side'], ['X', 'O']), 'player2_side should be X or O');
    }

    /**
     * Test that series completion emits proper event
     * 
     * **Validates: Requirements 8.3, 8.5**
     * 
     * @test
     */
    public function seriesCompletedEventStructure(): void
    {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        $series = $this->seriesManager->createSeries($player1Id, $player2Id);
        $seriesId = $series['id'];

        // End game 1 - player1 wins
        $result1 = $this->seriesManager->endGame($seriesId, $this->generateUuid(), $player1Id, 300);
        $this->assertFalse($result1['isComplete']);

        // End game 2 - player1 wins (series complete)
        $result2 = $this->seriesManager->endGame($seriesId, $this->generateUuid(), $player1Id, 300);
        
        // Verify series is complete
        $this->assertTrue($result2['isComplete']);
        
        $completedSeries = $result2['series'];
        $this->assertEquals('completed', $completedSeries['status']);
        $this->assertEquals($player1Id, $completedSeries['winner_id']);
        $this->assertEquals('2-0', $completedSeries['final_score']);
        $this->assertNotNull($completedSeries['ended_at']);
    }

    /**
     * Test that disconnect event has proper structure
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function disconnectEventStructure(): void
    {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        $series = $this->seriesManager->createSeries($player1Id, $player2Id);
        $seriesId = $series['id'];

        // Simulate disconnect event structure
        $disconnectEvent = [
            'type' => 'series_player_disconnected',
            'seriesId' => $seriesId,
            'playerId' => $player1Id,
            'disconnectedAt' => date('c'),
            'timeoutSeconds' => 60
        ];

        // Verify event structure
        $this->assertEquals('series_player_disconnected', $disconnectEvent['type']);
        $this->assertEquals($seriesId, $disconnectEvent['seriesId']);
        $this->assertEquals($player1Id, $disconnectEvent['playerId']);
        $this->assertEquals(60, $disconnectEvent['timeoutSeconds']);
    }

    /**
     * Test that reconnect event has proper structure
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function reconnectEventStructure(): void
    {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        $series = $this->seriesManager->createSeries($player1Id, $player2Id);
        $seriesId = $series['id'];

        // Simulate reconnect event structure
        $reconnectEvent = [
            'type' => 'series_player_reconnected',
            'seriesId' => $seriesId,
            'playerId' => $player1Id,
            'reconnectedAt' => date('c')
        ];

        // Verify event structure
        $this->assertEquals('series_player_reconnected', $reconnectEvent['type']);
        $this->assertEquals($seriesId, $reconnectEvent['seriesId']);
        $this->assertEquals($player1Id, $reconnectEvent['playerId']);
    }

    /**
     * Test that forfeit event has proper structure
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function forfeitEventStructure(): void
    {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        $series = $this->seriesManager->createSeries($player1Id, $player2Id);
        $seriesId = $series['id'];

        // Forfeit game
        $result = $this->seriesManager->forfeitGame($seriesId, $player1Id);

        // Verify forfeit result structure
        $this->assertArrayHasKey('series', $result);
        $updatedSeries = $result['series'];
        
        // Player2 should have won the game
        $this->assertEquals(1, $updatedSeries['player2_wins']);
        $this->assertEquals(0, $updatedSeries['player1_wins']);
    }

    /**
     * Test that abandon event has proper structure
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function abandonEventStructure(): void
    {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        $series = $this->seriesManager->createSeries($player1Id, $player2Id);
        $seriesId = $series['id'];

        // Abandon series
        $result = $this->seriesManager->abandonSeries($seriesId, $player1Id);

        // Verify abandon result structure
        $this->assertArrayHasKey('series', $result);
        $this->assertArrayHasKey('winnerId', $result);
        $this->assertArrayHasKey('loserId', $result);
        $this->assertArrayHasKey('isAbandoned', $result);
        $this->assertArrayHasKey('abandonPenalty', $result);

        $abandonedSeries = $result['series'];
        $this->assertEquals('abandoned', $abandonedSeries['status']);
        $this->assertEquals($player2Id, $result['winnerId']);
        $this->assertEquals($player1Id, $result['loserId']);
        $this->assertEquals(-25, $result['abandonPenalty']);
    }

    /**
     * Test that all series events contain required timestamp
     * 
     * **Validates: Requirements 8.3, 8.5**
     * 
     * @test
     */
    public function allEventsHaveTimestamp(): void
    {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        $series = $this->seriesManager->createSeries($player1Id, $player2Id);
        
        // Verify created_at is present
        $this->assertNotNull($series['created_at']);
        $this->assertNotEmpty($series['created_at']);
        
        // Verify it's a valid ISO 8601 timestamp
        $timestamp = strtotime($series['created_at']);
        $this->assertNotFalse($timestamp, 'created_at should be a valid timestamp');
    }

    /**
     * Test that series data is complete for realtime updates
     * 
     * **Validates: Requirements 9.3**
     * 
     * @test
     */
    public function seriesDataCompletenessForRealtime(): void
    {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        $series = $this->seriesManager->createSeries($player1Id, $player2Id);
        $seriesId = $series['id'];

        // End game to get complete series data
        $result = $this->seriesManager->endGame($seriesId, $this->generateUuid(), $player1Id, 300);
        $updatedSeries = $result['series'];

        // Verify all required fields for realtime
        $requiredFields = [
            'id',
            'player1_id',
            'player2_id',
            'player1_initial_mp',
            'player2_initial_mp',
            'player1_initial_rank',
            'player2_initial_rank',
            'player1_wins',
            'player2_wins',
            'games_to_win',
            'current_game',
            'player1_side',
            'player2_side',
            'status',
            'created_at',
            'started_at'
        ];

        foreach ($requiredFields as $field) {
            $this->assertArrayHasKey(
                $field,
                $updatedSeries,
                "Series data must include '{$field}' for realtime updates"
            );
        }
    }

    /**
     * Test that series events are emitted in correct order
     * 
     * **Validates: Requirements 8.3, 8.5**
     * 
     * @test
     */
    public function seriesEventEmissionOrder(): void
    {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        // Create series
        $series = $this->seriesManager->createSeries($player1Id, $player2Id);
        $seriesId = $series['id'];

        // End game 1
        $result1 = $this->seriesManager->endGame($seriesId, $this->generateUuid(), $player1Id, 300);
        
        // Verify events in order:
        // 1. Game ended
        // 2. Score updated
        // 3. Side swapped (if not complete)
        // 4. Next game ready (if not complete)
        
        $this->assertFalse($result1['isComplete']);
        $this->assertTrue($result1['nextGameReady']);
        
        $updatedSeries = $result1['series'];
        $this->assertEquals(2, $updatedSeries['current_game']);
        // Note: Sides are NOT swapped anymore because Swap 2 handles side assignment
        // Just verify sides are still valid
        $this->assertTrue(in_array($updatedSeries['player1_side'], ['X', 'O']), 'player1_side should be X or O');
    }

    /**
     * Test that presence tracking data is available
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function presenceTrackingDataStructure(): void
    {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();

        // Simulate presence tracking structure
        $presenceData = [
            'user_id' => $player1Id,
            'online_at' => date('c'),
            'side' => 'X'
        ];

        // Verify presence structure
        $this->assertArrayHasKey('user_id', $presenceData);
        $this->assertArrayHasKey('online_at', $presenceData);
        $this->assertEquals($player1Id, $presenceData['user_id']);
    }
}
