<?php

namespace App\Services;

/**
 * GameStateServiceInterface - Interface for game state management.
 * 
 * Handles game initialization, state transitions, and Swap 2 integration.
 * 
 * Requirements: 1.1, 1.6, 4.3, 7.1
 */
interface GameStateServiceInterface
{
    /**
     * Create initial game state for a new game.
     * 
     * If swap2Enabled is true, starts in swap2 phase.
     * Otherwise, starts directly in main_game phase.
     * 
     * Requirements: 1.1, 4.3
     * 
     * @param string $gameId UUID of the game
     * @param string $player1Id UUID of first player
     * @param string $player2Id UUID of second player
     * @param bool $swap2Enabled Whether Swap 2 is enabled
     * @param array $options Additional options (timePerPlayer, etc.)
     * @return array Initial game state
     */
    public function initializeGame(
        string $gameId,
        string $player1Id,
        string $player2Id,
        bool $swap2Enabled,
        array $options = []
    ): array;

    /**
     * Handle a stone placement action.
     * 
     * Routes to Swap 2 manager during swap2 phase,
     * or processes as normal move during main_game.
     * 
     * Requirements: 1.2, 2.1
     * 
     * @param string $gameId UUID of the game
     * @param array $gameState Current game state
     * @param string $playerId UUID of player making move
     * @param int $x X coordinate
     * @param int $y Y coordinate
     * @return array Updated game state
     * @throws \RuntimeException If move is invalid
     */
    public function placeStone(
        string $gameId,
        array $gameState,
        string $playerId,
        int $x,
        int $y
    ): array;

    /**
     * Handle a color choice during Swap 2.
     * 
     * Requirements: 1.3, 3.1
     * 
     * @param string $gameId UUID of the game
     * @param array $gameState Current game state
     * @param string $playerId UUID of player making choice
     * @param string $choice 'black', 'white', or 'place_more'
     * @return array Updated game state
     * @throws \RuntimeException If choice is invalid
     */
    public function makeSwap2Choice(
        string $gameId,
        array $gameState,
        string $playerId,
        string $choice
    ): array;

    /**
     * Get current game phase.
     * 
     * @param array $gameState Current game state
     * @return string 'swap2' or 'main_game'
     */
    public function getGamePhase(array $gameState): string;

    /**
     * Check if game is in Swap 2 phase.
     * 
     * @param array $gameState Current game state
     * @return bool True if in swap2 phase
     */
    public function isInSwap2Phase(array $gameState): bool;

    /**
     * Get Swap 2 state from game state.
     * 
     * @param array $gameState Current game state
     * @return Swap2State|null Swap 2 state or null
     */
    public function getSwap2State(array $gameState): ?Swap2State;

    /**
     * Restore game state for a reconnecting player.
     * 
     * Ensures the Swap2Manager is synchronized with the persisted state.
     * Returns the exact phase and tentativeStones as they were before disconnect.
     * 
     * Requirements: 7.2
     * 
     * @param string $gameId UUID of the game
     * @param array $gameState Game state loaded from database
     * @return array Restored game state with synchronized Swap2Manager
     */
    public function restoreStateForReconnection(string $gameId, array $gameState): array;

    /**
     * Get reconnection info for a player.
     * 
     * Returns information needed to restore the UI state for a reconnecting player.
     * 
     * Requirements: 7.2
     * 
     * @param array $gameState Current game state
     * @param string $playerId UUID of reconnecting player
     * @return array Reconnection info
     */
    public function getReconnectionInfo(array $gameState, string $playerId): array;
}
