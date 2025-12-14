<?php

namespace App\Services;

/**
 * DisconnectHandlerServiceInterface
 * 
 * Interface for handling player disconnections during ranked series.
 * Manages disconnect timeouts, reconnection, and forfeit logic.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
interface DisconnectHandlerServiceInterface
{
    /**
     * Handle a player disconnection during a game.
     * 
     * - Pauses the game
     * - Starts a 60-second reconnection timer
     * - Records disconnect timestamp
     * 
     * Requirements: 7.1
     * 
     * @param string $seriesId UUID of the series
     * @param string $playerId UUID of disconnected player
     * @return array Disconnect state with timeout info
     * @throws \RuntimeException If series not found or not in progress
     */
    public function handleDisconnect(string $seriesId, string $playerId): array;

    /**
     * Handle a player reconnection.
     * 
     * - Checks if within 60-second timeout window
     * - Resumes game if reconnected in time
     * - Returns false if timeout already expired
     * 
     * Requirements: 7.2
     * 
     * @param string $seriesId UUID of the series
     * @param string $playerId UUID of reconnecting player
     * @return bool True if reconnection successful, false if timeout expired
     * @throws \RuntimeException If series not found
     */
    public function handleReconnect(string $seriesId, string $playerId): bool;

    /**
     * Check if disconnect timeout has expired and forfeit if necessary.
     * 
     * - Checks if 60 seconds have passed since disconnect
     * - Forfeits game to opponent if timeout expired
     * - Checks if series should end (2 forfeits)
     * 
     * Requirements: 7.2, 7.3
     * 
     * @param string $seriesId UUID of the series
     * @return array Result with forfeit status and updated series state
     * @throws \RuntimeException If series not found
     */
    public function checkTimeout(string $seriesId): array;

    /**
     * Get current disconnect state for a series.
     * 
     * @param string $seriesId UUID of the series
     * @return array|null Disconnect state or null if no active disconnect
     */
    public function getDisconnectState(string $seriesId): ?array;

    /**
     * Clear disconnect state (called after reconnect or forfeit).
     * 
     * @param string $seriesId UUID of the series
     * @return void
     */
    public function clearDisconnectState(string $seriesId): void;

    /**
     * Check if a player is currently disconnected.
     * 
     * @param string $seriesId UUID of the series
     * @param string $playerId UUID of the player
     * @return bool True if player is disconnected
     */
    public function isPlayerDisconnected(string $seriesId, string $playerId): bool;

    /**
     * Get remaining time before timeout (in seconds).
     * 
     * @param string $seriesId UUID of the series
     * @return int|null Remaining seconds or null if no active disconnect
     */
    public function getRemainingTimeout(string $seriesId): ?int;
}
