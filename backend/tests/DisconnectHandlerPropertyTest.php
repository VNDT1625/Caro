<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Services\DisconnectHandlerService;
use App\Services\SeriesManagerService;

/**
 * Property-Based Tests for DisconnectHandlerService
 * 
 * **Feature: ranked-bo3-system**
 * 
 * Tests the core properties of the DisconnectHandler service including
 * disconnect timeout forfeit, double forfeit series end, and abandon penalty.
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
 */
class DisconnectHandlerPropertyTest extends TestCase
{
    use TestTrait;

    private DisconnectHandlerService $handler;
    private SeriesManagerService $seriesManager;
    private array $savedSeries = [];
    private int $currentTime = 1000000;

    protected function setUp(): void
    {
        parent::setUp();
        $this->erisSetup();
        
        $this->handler = new DisconnectHandlerService();
        $this->seriesManager = new SeriesManagerService();
        $this->savedSeries = [];
        $this->currentTime = 1000000;

        // Set up mock callbacks for series manager
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

        // Set up disconnect handler with series manager
        $this->handler->setSeriesManager($this->seriesManager);
        $this->handler->setTimeProvider(function () {
            return $this->currentTime;
        });
        $this->handler->setSeriesFinder(function (string $seriesId) {
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
     * **Feature: ranked-bo3-system, Property 15: Disconnect Timeout Forfeit**
     * 
     * *For any* player disconnected for more than 60 seconds, that game SHALL be forfeited
     * to the opponent.
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function disconnectTimeoutForfeit(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2]),  // Which player disconnects
                Generators::choose(61, 300)   // Time elapsed after disconnect (> 60 seconds)
            )
            ->withMaxSize(100)
            ->then(function (int $disconnectingPlayerNum, int $timeElapsed) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Create series
                $series = $this->seriesManager->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];

                $disconnectingPlayerId = $disconnectingPlayerNum === 1 ? $player1Id : $player2Id;
                $opponentId = $disconnectingPlayerNum === 1 ? $player2Id : $player1Id;

                // Player disconnects
                $this->currentTime = 1000000;
                $disconnectResult = $this->handler->handleDisconnect($seriesId, $disconnectingPlayerId);

                // Property: Disconnect result SHALL have correct structure
                $this->assertEquals('paused', $disconnectResult['status']);
                $this->assertEquals($disconnectingPlayerId, $disconnectResult['disconnected_player_id']);
                $this->assertEquals(60, $disconnectResult['remaining_seconds']);

                // Advance time past timeout
                $this->currentTime = 1000000 + $timeElapsed;

                // Check timeout
                $timeoutResult = $this->handler->checkTimeout($seriesId);

                // Property: Timeout SHALL be detected
                $this->assertTrue($timeoutResult['has_timeout'], 'Timeout should be detected after 60+ seconds');

                // Property: Game SHALL be forfeited
                $this->assertTrue($timeoutResult['forfeited'], 'Game should be forfeited on timeout');

                // Property: Forfeiting player SHALL be recorded
                $this->assertEquals(
                    $disconnectingPlayerId,
                    $timeoutResult['forfeiting_player_id'],
                    'Forfeiting player must be the disconnected player'
                );

                // Property: Opponent's score SHALL increase by 1
                $updatedSeries = $timeoutResult['series_state']['series'];
                if ($disconnectingPlayerNum === 1) {
                    $this->assertEquals(
                        1,
                        $updatedSeries['player2_wins'],
                        'Opponent (player 2) should have 1 win after forfeit'
                    );
                } else {
                    $this->assertEquals(
                        1,
                        $updatedSeries['player1_wins'],
                        'Opponent (player 1) should have 1 win after forfeit'
                    );
                }

                // Property: Disconnect state SHALL be cleared
                $this->assertNull(
                    $this->handler->getDisconnectState($seriesId),
                    'Disconnect state should be cleared after timeout'
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 15: Disconnect Timeout Forfeit**
     * 
     * *For any* player who reconnects within 60 seconds, the game SHALL resume
     * and no forfeit SHALL occur.
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function reconnectWithinTimeoutSucceeds(): void
    {
        $this
            ->minimumEvaluationRatio(0.01)
            ->forAll(
                Generators::elements([1, 2]),  // Which player disconnects
                Generators::choose(1, 59)     // Time elapsed before reconnect (< 60 seconds)
            )
            ->disableShrinking()
            ->withMaxSize(50)
            ->then(function (int $disconnectingPlayerNum, int $timeElapsed) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Create series
                $series = $this->seriesManager->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];

                $disconnectingPlayerId = $disconnectingPlayerNum === 1 ? $player1Id : $player2Id;

                // Player disconnects
                $this->currentTime = 1000000;
                $this->handler->handleDisconnect($seriesId, $disconnectingPlayerId);

                // Advance time but stay within timeout
                $this->currentTime = 1000000 + $timeElapsed;

                // Player reconnects
                $reconnectResult = $this->handler->handleReconnect($seriesId, $disconnectingPlayerId);

                // Property: Reconnection SHALL succeed
                $this->assertTrue($reconnectResult, 'Reconnection should succeed within timeout');

                // Property: Disconnect state SHALL be cleared
                $this->assertNull(
                    $this->handler->getDisconnectState($seriesId),
                    'Disconnect state should be cleared after successful reconnect'
                );

                // Property: Series score SHALL remain unchanged
                $seriesState = $this->seriesManager->getSeriesState($seriesId);
                $updatedSeries = $seriesState['series'];
                $this->assertEquals(0, $updatedSeries['player1_wins'], 'Player 1 wins should remain 0');
                $this->assertEquals(0, $updatedSeries['player2_wins'], 'Player 2 wins should remain 0');
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 16: Double Forfeit Series End**
     * 
     * *For any* player who forfeits 2 games in a series, the series SHALL end
     * with that player as loser.
     * 
     * **Validates: Requirements 7.3**
     * 
     * @test
     */
    public function doubleForfeitEndsSeriesAsLoss(): void
    {
        $this
            ->minimumEvaluationRatio(0.01)
            ->forAll(
                Generators::elements([1, 2])  // Which player forfeits both games
            )
            ->disableShrinking()
            ->withMaxSize(50)
            ->then(function (int $forfeitingPlayerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Create series
                $series = $this->seriesManager->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];

                $forfeitingPlayerId = $forfeitingPlayerNum === 1 ? $player1Id : $player2Id;
                $winnerId = $forfeitingPlayerNum === 1 ? $player2Id : $player1Id;

                // First forfeit
                $this->currentTime = 1000000;
                $this->handler->handleDisconnect($seriesId, $forfeitingPlayerId);
                $this->currentTime = 1000000 + 61;
                $result1 = $this->handler->checkTimeout($seriesId);

                // Property: First forfeit should not complete series
                $this->assertFalse(
                    $result1['is_series_complete'],
                    'Series should not be complete after 1 forfeit'
                );

                // Advance to next game (after first forfeit, we're on game 2)
                $seriesState = $this->seriesManager->getSeriesState($seriesId);
                $updatedSeries = $seriesState['series'];
                $this->assertEquals(2, $updatedSeries['current_game'], 'Should be on game 2 after first forfeit');

                // Second forfeit
                $this->currentTime = 1000000 + 100;
                $this->handler->handleDisconnect($seriesId, $forfeitingPlayerId);
                $this->currentTime = 1000000 + 161;
                $result2 = $this->handler->checkTimeout($seriesId);

                // Property: Second forfeit SHALL complete series
                $this->assertTrue(
                    $result2['is_series_complete'],
                    'Series should be complete after 2 forfeits'
                );

                // Property: Series status SHALL be "completed"
                $finalSeries = $result2['series_state']['series'];
                $this->assertEquals(
                    'completed',
                    $finalSeries['status'],
                    'Series status must be "completed"'
                );

                // Property: Winner SHALL be the opponent
                $this->assertEquals(
                    $winnerId,
                    $finalSeries['winner_id'],
                    'Winner must be the opponent of forfeiting player'
                );

                // Property: Final score SHALL be 2-0 for winner
                if ($forfeitingPlayerNum === 1) {
                    $this->assertEquals(2, $finalSeries['player2_wins'], 'Winner should have 2 wins');
                    $this->assertEquals(0, $finalSeries['player1_wins'], 'Forfeiter should have 0 wins');
                } else {
                    $this->assertEquals(2, $finalSeries['player1_wins'], 'Winner should have 2 wins');
                    $this->assertEquals(0, $finalSeries['player2_wins'], 'Forfeiter should have 0 wins');
                }
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 17: Abandon Penalty**
     * 
     * *For any* abandoned series, the abandoning player SHALL lose 25 MP
     * (15 standard + 10 abandon penalty).
     * 
     * **Validates: Requirements 7.5**
     * 
     * @test
     */
    public function abandonPenaltyApplied(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2])  // Which player abandons
            )
            ->withMaxSize(100)
            ->then(function (int $abandoningPlayerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Create series
                $series = $this->seriesManager->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];

                $abandoningPlayerId = $abandoningPlayerNum === 1 ? $player1Id : $player2Id;
                $winnerId = $abandoningPlayerNum === 1 ? $player2Id : $player1Id;

                // Player abandons
                $abandonResult = $this->handler->handleAbandon($seriesId, $abandoningPlayerId);

                // Property: Result SHALL have correct structure
                $this->assertIsArray($abandonResult);
                $this->assertArrayHasKey('series', $abandonResult);
                $this->assertArrayHasKey('winnerId', $abandonResult);
                $this->assertArrayHasKey('loserId', $abandonResult);

                // Property: Status SHALL be "abandoned"
                $this->assertEquals(
                    'abandoned',
                    $abandonResult['series']['status'],
                    'Series status must be "abandoned"'
                );

                // Property: Winner SHALL be the opponent
                $this->assertEquals(
                    $winnerId,
                    $abandonResult['winnerId'],
                    'Winner must be the opponent of abandoning player'
                );

                // Property: Loser SHALL be the abandoning player
                $this->assertEquals(
                    $abandoningPlayerId,
                    $abandonResult['loserId'],
                    'Loser must be the abandoning player'
                );

                // Property: Abandon penalty SHALL be -25 MP
                $this->assertEquals(
                    -25,
                    $abandonResult['series']['loser_mp_change'],
                    'Loser MP change must be -25 for abandon'
                );

                // Property: Disconnect state SHALL be cleared
                $this->assertNull(
                    $this->handler->getDisconnectState($seriesId),
                    'Disconnect state should be cleared after abandon'
                );

                // Property: Series SHALL be marked complete
                $this->assertEquals(
                    'abandoned',
                    $abandonResult['series']['status'],
                    'Series must be marked as abandoned'
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 15: Disconnect Timeout Forfeit**
     * 
     * *For any* disconnect, the remaining timeout SHALL be exactly 60 seconds
     * minus the elapsed time.
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function remainingTimeoutCalculation(): void
    {
        $this
            ->forAll(
                Generators::choose(0, 59)  // Time elapsed since disconnect
            )
            ->withMaxSize(100)
            ->then(function (int $timeElapsed) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Create series
                $series = $this->seriesManager->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];

                // Player disconnects
                $this->currentTime = 1000000;
                $this->handler->handleDisconnect($seriesId, $player1Id);

                // Advance time
                $this->currentTime = 1000000 + $timeElapsed;

                // Check remaining timeout
                $remaining = $this->handler->getRemainingTimeout($seriesId);

                // Property: Remaining time SHALL be 60 - elapsed
                $expectedRemaining = 60 - $timeElapsed;
                $this->assertEquals(
                    $expectedRemaining,
                    $remaining,
                    "Remaining timeout should be {$expectedRemaining} seconds"
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 15: Disconnect Timeout Forfeit**
     * 
     * *For any* series with no active disconnect, checkTimeout SHALL return
     * has_timeout = false and forfeited = false.
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function checkTimeoutWithoutDisconnect(): void
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

                // Check timeout without any disconnect
                $result = $this->handler->checkTimeout($seriesId);

                // Property: has_timeout SHALL be false
                $this->assertFalse($result['has_timeout'], 'has_timeout should be false without disconnect');

                // Property: forfeited SHALL be false
                $this->assertFalse($result['forfeited'], 'forfeited should be false without disconnect');

                // Property: series_state SHALL be null
                $this->assertNull($result['series_state'], 'series_state should be null without disconnect');
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 15: Disconnect Timeout Forfeit**
     * 
     * *For any* player who is not the disconnected player, reconnect attempt
     * SHALL return true (no-op).
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function reconnectByNonDisconnectedPlayer(): void
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

                // Player 1 disconnects
                $this->currentTime = 1000000;
                $this->handler->handleDisconnect($seriesId, $player1Id);

                // Player 2 tries to reconnect (not the disconnected player)
                $result = $this->handler->handleReconnect($seriesId, $player2Id);

                // Property: Reconnect SHALL return true (no-op)
                $this->assertTrue($result, 'Reconnect by non-disconnected player should return true');

                // Property: Disconnect state SHALL still exist
                $state = $this->handler->getDisconnectState($seriesId);
                $this->assertNotNull($state, 'Disconnect state should still exist');
                $this->assertEquals($player1Id, $state['disconnected_player_id']);
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 15: Disconnect Timeout Forfeit**
     * 
     * *For any* player who reconnects after timeout expires, reconnection
     * SHALL fail (return false).
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function reconnectAfterTimeoutFails(): void
    {
        $this
            ->forAll(
                Generators::choose(61, 300)  // Time elapsed after disconnect (> 60 seconds)
            )
            ->withMaxSize(100)
            ->then(function (int $timeElapsed) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Create series
                $series = $this->seriesManager->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];

                // Player disconnects
                $this->currentTime = 1000000;
                $this->handler->handleDisconnect($seriesId, $player1Id);

                // Advance time past timeout
                $this->currentTime = 1000000 + $timeElapsed;

                // Try to reconnect after timeout
                $result = $this->handler->handleReconnect($seriesId, $player1Id);

                // Property: Reconnection SHALL fail
                $this->assertFalse($result, 'Reconnection should fail after timeout expires');
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 15: Disconnect Timeout Forfeit**
     * 
     * *For any* disconnect, isPlayerDisconnected SHALL return true for the
     * disconnected player and false for the opponent.
     * 
     * **Validates: Requirements 7.1, 7.2**
     * 
     * @test
     */
    public function isPlayerDisconnectedAccuracy(): void
    {
        $this
            ->forAll(
                Generators::elements([1, 2])  // Which player disconnects
            )
            ->withMaxSize(100)
            ->then(function (int $disconnectingPlayerNum) {
                $player1Id = $this->generateUuid();
                $player2Id = $this->generateUuid();

                // Create series
                $series = $this->seriesManager->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];

                $disconnectingPlayerId = $disconnectingPlayerNum === 1 ? $player1Id : $player2Id;
                $opponentId = $disconnectingPlayerNum === 1 ? $player2Id : $player1Id;

                // Player disconnects
                $this->handler->handleDisconnect($seriesId, $disconnectingPlayerId);

                // Property: Disconnected player SHALL be marked as disconnected
                $this->assertTrue(
                    $this->handler->isPlayerDisconnected($seriesId, $disconnectingPlayerId),
                    'Disconnected player should be marked as disconnected'
                );

                // Property: Opponent SHALL NOT be marked as disconnected
                $this->assertFalse(
                    $this->handler->isPlayerDisconnected($seriesId, $opponentId),
                    'Opponent should not be marked as disconnected'
                );
            });
    }
}
