<?php

namespace App\Services;

/**
 * SeriesManagerServiceInterface
 * 
 * Interface for managing Ranked BO3 series lifecycle.
 * Handles series creation, game results, side swapping, and completion.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 7.3, 7.4
 */
interface SeriesManagerServiceInterface
{
    /**
     * Create a new ranked series between two players.
     * 
     * - Randomly assigns initial sides (X/O)
     * - Captures initial MP and rank for both players
     * - Sets status to 'in_progress'
     * 
     * Requirements: 1.1, 1.2, 1.3, 1.4
     * 
     * @param string $player1Id UUID of first player
     * @param string $player2Id UUID of second player
     * @return array Created series data
     * @throws \InvalidArgumentException If players are invalid
     */
    public function createSeries(string $player1Id, string $player2Id): array;

    /**
     * Record the end of a game within a series.
     * 
     * - Updates score based on winner
     * - Checks if series is complete (someone reached 2 wins)
     * - Swaps sides for next game if series continues
     * 
     * Requirements: 2.1, 2.2, 2.3, 2.4
     * 
     * @param string $seriesId UUID of the series
     * @param string $matchId UUID of the completed match
     * @param string|null $winnerId UUID of game winner (null for draw)
     * @param int $gameDuration Duration in seconds
     * @return array Updated series state
     * @throws \RuntimeException If series not found or already completed
     */
    public function endGame(string $seriesId, string $matchId, ?string $winnerId, int $gameDuration): array;

    /**
     * Get current state of a series.
     * 
     * @param string $seriesId UUID of the series
     * @return array|null Series state or null if not found
     */
    public function getSeriesState(string $seriesId): ?array;

    /**
     * Complete a series and calculate rewards.
     * 
     * - Marks series as completed
     * - Calls ScoringEngine to calculate MP, coins, EXP
     * - Applies rewards to player profiles
     * 
     * Requirements: 3.1
     * 
     * @param string $seriesId UUID of the series
     * @return array Series result with rewards
     * @throws \RuntimeException If series not found or not ready to complete
     */
    public function completeSeries(string $seriesId): array;

    /**
     * Forfeit the current game (player disconnected/timed out).
     * 
     * - Awards game to opponent
     * - Checks if series is complete
     * 
     * Requirements: 7.3
     * 
     * @param string $seriesId UUID of the series
     * @param string $forfeitingPlayerId UUID of player who forfeited
     * @return array Updated series state
     * @throws \RuntimeException If series not found
     */
    public function forfeitGame(string $seriesId, string $forfeitingPlayerId): array;

    /**
     * Abandon entire series (player leaves mid-series).
     * 
     * - Marks series as abandoned
     * - Awards series to opponent
     * - Applies abandon penalty to leaving player
     * 
     * Requirements: 7.4
     * 
     * @param string $seriesId UUID of the series
     * @param string $abandoningPlayerId UUID of player who abandoned
     * @return array Series result with abandon penalty
     * @throws \RuntimeException If series not found
     */
    public function abandonSeries(string $seriesId, string $abandoningPlayerId): array;

    /**
     * Get the player who should play X in the current game.
     * 
     * @param string $seriesId UUID of the series
     * @return string|null UUID of player who plays X, or null if series not found
     */
    public function getCurrentXPlayer(string $seriesId): ?string;

    /**
     * Check if a series is complete (someone has 2 wins).
     * 
     * @param array $series Series data
     * @return bool True if series is complete
     */
    public function isSeriesComplete(array $series): bool;

    /**
     * Initialize Swap 2 for a new game in the series.
     * 
     * - Creates fresh Swap 2 state for the current game
     * - Player 1 of the series starts placing stones
     * 
     * Requirements: 6.1, 6.3
     * 
     * @param string $seriesId UUID of the series
     * @return array Swap 2 state data
     * @throws \RuntimeException If series not found or not in progress
     */
    public function initializeGameSwap2(string $seriesId): array;

    /**
     * Store Swap 2 history for a completed game.
     * 
     * - Saves actions and final color assignment to match record
     * 
     * Requirements: 6.2, 6.4
     * 
     * @param string $seriesId UUID of the series
     * @param string $matchId UUID of the match
     * @param array $swap2History Swap 2 actions and final assignment
     * @return void
     */
    public function storeSwap2History(string $seriesId, string $matchId, array $swap2History): void;

    /**
     * Prepare next game in series with fresh Swap 2.
     * 
     * - Resets to Swap 2 placement phase (not just swap sides)
     * - Each game starts with fresh Swap 2 process
     * 
     * Requirements: 6.3
     * 
     * @param string $seriesId UUID of the series
     * @return array Updated series state with fresh Swap 2
     * @throws \RuntimeException If series not found or already completed
     */
    public function prepareNextSeriesGame(string $seriesId): array;
}
