<?php

namespace App\Services;

use RuntimeException;
use InvalidArgumentException;

/**
 * DisconnectHandlerService
 * 
 * Handles player disconnections during ranked series.
 * Manages disconnect timeouts, reconnection, and forfeit logic.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
class DisconnectHandlerService implements DisconnectHandlerServiceInterface
{
    /**
     * Timeout duration in seconds before forfeit
     * Requirements: 7.1, 7.2
     */
    public const DISCONNECT_TIMEOUT_SECONDS = 60;

    /**
     * In-memory storage for disconnect states
     * In production, this would be Redis or database
     * @var array<string, array>
     */
    private array $disconnectStates = [];

    /**
     * Series manager for forfeit/abandon operations
     */
    private ?SeriesManagerServiceInterface $seriesManager = null;

    /**
     * Callable to get current timestamp (for testing)
     * @var callable|null
     */
    private $timeProvider = null;

    /**
     * Callable to find series data
     * @var callable|null
     */
    private $seriesFinder = null;

    public function __construct() {}

    /**
     * Set the series manager for forfeit operations
     */
    public function setSeriesManager(SeriesManagerServiceInterface $seriesManager): self
    {
        $this->seriesManager = $seriesManager;
        return $this;
    }

    /**
     * Set custom time provider (for testing)
     */
    public function setTimeProvider(callable $provider): self
    {
        $this->timeProvider = $provider;
        return $this;
    }


    /**
     * Set custom series finder (for testing)
     */
    public function setSeriesFinder(callable $finder): self
    {
        $this->seriesFinder = $finder;
        return $this;
    }

    /**
     * Get current timestamp
     */
    private function getCurrentTime(): int
    {
        if ($this->timeProvider !== null) {
            return (int) ($this->timeProvider)();
        }
        return time();
    }

    /**
     * {@inheritdoc}
     */
    public function handleDisconnect(string $seriesId, string $playerId): array
    {
        $series = $this->findSeries($seriesId);

        if ($series === null) {
            throw new RuntimeException('Series not found: ' . $seriesId);
        }

        if ($series['status'] !== 'in_progress') {
            throw new RuntimeException('Series is not in progress');
        }

        if ($playerId !== $series['player1_id'] && $playerId !== $series['player2_id']) {
            throw new InvalidArgumentException('Player is not part of this series');
        }

        $now = $this->getCurrentTime();
        $timeoutAt = $now + self::DISCONNECT_TIMEOUT_SECONDS;

        $this->disconnectStates[$seriesId] = [
            'series_id' => $seriesId,
            'disconnected_player_id' => $playerId,
            'opponent_id' => $playerId === $series['player1_id'] 
                ? $series['player2_id'] 
                : $series['player1_id'],
            'disconnected_at' => $now,
            'timeout_at' => $timeoutAt,
            'is_paused' => true,
            'current_game' => $series['current_game'] ?? 1,
        ];

        return [
            'status' => 'paused',
            'disconnected_player_id' => $playerId,
            'disconnected_at' => $now,
            'timeout_at' => $timeoutAt,
            'remaining_seconds' => self::DISCONNECT_TIMEOUT_SECONDS,
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function handleReconnect(string $seriesId, string $playerId): bool
    {
        $state = $this->getDisconnectState($seriesId);

        if ($state === null) {
            // No active disconnect, reconnection is trivially successful
            return true;
        }

        if ($state['disconnected_player_id'] !== $playerId) {
            // This player wasn't the one disconnected
            return true;
        }

        $now = $this->getCurrentTime();

        // Check if timeout has already expired
        if ($now >= $state['timeout_at']) {
            return false;
        }

        // Reconnection successful - clear disconnect state
        $this->clearDisconnectState($seriesId);

        return true;
    }

    /**
     * {@inheritdoc}
     */
    public function checkTimeout(string $seriesId): array
    {
        $state = $this->getDisconnectState($seriesId);

        if ($state === null) {
            return [
                'has_timeout' => false,
                'forfeited' => false,
                'series_state' => null,
            ];
        }

        $now = $this->getCurrentTime();

        // Timeout not yet expired
        if ($now < $state['timeout_at']) {
            return [
                'has_timeout' => false,
                'forfeited' => false,
                'remaining_seconds' => $state['timeout_at'] - $now,
                'disconnected_player_id' => $state['disconnected_player_id'],
            ];
        }

        // Timeout expired - forfeit the game
        $this->clearDisconnectState($seriesId);

        if ($this->seriesManager === null) {
            throw new RuntimeException('SeriesManager not configured');
        }

        $forfeitResult = $this->seriesManager->forfeitGame(
            $seriesId, 
            $state['disconnected_player_id']
        );

        return [
            'has_timeout' => true,
            'forfeited' => true,
            'forfeiting_player_id' => $state['disconnected_player_id'],
            'series_state' => $forfeitResult,
            'is_series_complete' => $forfeitResult['isComplete'] ?? false,
        ];
    }


    /**
     * {@inheritdoc}
     */
    public function getDisconnectState(string $seriesId): ?array
    {
        return $this->disconnectStates[$seriesId] ?? null;
    }

    /**
     * {@inheritdoc}
     */
    public function clearDisconnectState(string $seriesId): void
    {
        unset($this->disconnectStates[$seriesId]);
    }

    /**
     * {@inheritdoc}
     */
    public function isPlayerDisconnected(string $seriesId, string $playerId): bool
    {
        $state = $this->getDisconnectState($seriesId);

        if ($state === null) {
            return false;
        }

        return $state['disconnected_player_id'] === $playerId;
    }

    /**
     * {@inheritdoc}
     */
    public function getRemainingTimeout(string $seriesId): ?int
    {
        $state = $this->getDisconnectState($seriesId);

        if ($state === null) {
            return null;
        }

        $now = $this->getCurrentTime();
        $remaining = $state['timeout_at'] - $now;

        return max(0, $remaining);
    }

    /**
     * Find series data
     */
    private function findSeries(string $seriesId): ?array
    {
        if ($this->seriesFinder !== null) {
            return ($this->seriesFinder)($seriesId);
        }

        if ($this->seriesManager !== null) {
            $state = $this->seriesManager->getSeriesState($seriesId);
            return $state['series'] ?? null;
        }

        return null;
    }

    /**
     * Handle abandon (player explicitly leaves).
     * Delegates to SeriesManager.abandonSeries with full penalty.
     * 
     * Requirements: 7.4, 7.5
     * 
     * @param string $seriesId UUID of the series
     * @param string $abandoningPlayerId UUID of player who abandoned
     * @return array Series result with abandon penalty (-25 MP)
     */
    public function handleAbandon(string $seriesId, string $abandoningPlayerId): array
    {
        // Clear any disconnect state first
        $this->clearDisconnectState($seriesId);

        if ($this->seriesManager === null) {
            throw new RuntimeException('SeriesManager not configured');
        }

        return $this->seriesManager->abandonSeries($seriesId, $abandoningPlayerId);
    }

    /**
     * Check if both players are disconnected.
     * In this case, the first to reconnect continues.
     * 
     * @param string $seriesId UUID of the series
     * @return bool True if both players disconnected
     */
    public function areBothPlayersDisconnected(string $seriesId): bool
    {
        $state = $this->getDisconnectState($seriesId);

        if ($state === null) {
            return false;
        }

        // For simplicity, we track one disconnect at a time
        // If both disconnect, we'd need to track both
        // Current implementation: only one player can be "disconnected" at a time
        return false;
    }

    /**
     * Get forfeit count for a player in the current series.
     * Used to check if player has forfeited 2 games (series loss).
     * 
     * Requirements: 7.3
     * 
     * @param string $seriesId UUID of the series
     * @param string $playerId UUID of the player
     * @return int Number of forfeits by this player
     */
    public function getPlayerForfeitCount(string $seriesId, string $playerId): int
    {
        $series = $this->findSeries($seriesId);

        if ($series === null) {
            return 0;
        }

        // Forfeit count is tracked via opponent's wins
        // If player1 forfeits, player2 wins increase
        if ($playerId === $series['player1_id']) {
            return (int) ($series['player2_wins'] ?? 0);
        } else {
            return (int) ($series['player1_wins'] ?? 0);
        }
    }

    /**
     * Set disconnect state directly (for testing).
     * 
     * @param string $seriesId UUID of the series
     * @param array $state Disconnect state
     */
    public function setDisconnectState(string $seriesId, array $state): void
    {
        $this->disconnectStates[$seriesId] = $state;
    }

    /**
     * Fixed MP change for forfeit due to disconnect
     * Requirements: 1.4, 1.5 (ranked-disconnect-auto-win)
     */
    public const FORFEIT_DISCONNECT_MP_CHANGE = 20;

    /**
     * Process forfeit due to disconnect with fixed MP reward/penalty.
     * Awards winner +20 MP and deducts loser -20 MP.
     * 
     * Requirements: 1.4, 1.5, 2.1, 2.2, 2.3 (ranked-disconnect-auto-win)
     * 
     * @param string $seriesId UUID of the series
     * @param string $disconnectedPlayerId UUID of player who disconnected
     * @param string $winnerId UUID of remaining player (winner)
     * @return array Forfeit result with MP changes and series state
     */
    public function processForfeitDisconnect(string $seriesId, string $disconnectedPlayerId, string $winnerId): array
    {
        // Clear any existing disconnect state
        $this->clearDisconnectState($seriesId);

        if ($this->seriesManager === null) {
            throw new RuntimeException('SeriesManager not configured');
        }

        $series = $this->findSeries($seriesId);
        if ($series === null) {
            throw new RuntimeException('Series not found: ' . $seriesId);
        }

        if ($series['status'] !== 'in_progress') {
            throw new RuntimeException('Series is not in progress');
        }

        // Validate players
        if ($disconnectedPlayerId !== $series['player1_id'] && $disconnectedPlayerId !== $series['player2_id']) {
            throw new InvalidArgumentException('Disconnected player is not part of this series');
        }

        if ($winnerId !== $series['player1_id'] && $winnerId !== $series['player2_id']) {
            throw new InvalidArgumentException('Winner is not part of this series');
        }

        if ($disconnectedPlayerId === $winnerId) {
            throw new InvalidArgumentException('Disconnected player cannot be the winner');
        }

        // Use SeriesManager to forfeit the game
        $forfeitResult = $this->seriesManager->forfeitGame($seriesId, $disconnectedPlayerId);

        // Add fixed MP change info to result
        $forfeitResult['winner_mp_change'] = self::FORFEIT_DISCONNECT_MP_CHANGE;
        $forfeitResult['loser_mp_change'] = -self::FORFEIT_DISCONNECT_MP_CHANGE;
        $forfeitResult['forfeit_reason'] = 'disconnect';
        $forfeitResult['disconnected_player_id'] = $disconnectedPlayerId;
        $forfeitResult['winner_id'] = $winnerId;

        return $forfeitResult;
    }
}
