<?php

namespace App\Services;

/**
 * Swap2ManagerServiceInterface
 * 
 * Interface for managing Swap 2 Opening Rule in Gomoku/Caro.
 * Handles the fair opening phase where players can swap sides after seeing initial stones.
 * 
 * Swap 2 Flow:
 * 1. Player 1 places 3 stones (2 black + 1 white pattern)
 * 2. Player 2 chooses: black, white, or place_more
 * 3. If place_more: Player 2 places 2 more stones, then Player 1 chooses color
 * 4. Game transitions to main_game with assigned colors
 * 
 * Requirements: 1.1, 1.2, 1.3, 2.2, 7.1
 */
interface Swap2ManagerServiceInterface
{
    /**
     * Initialize Swap 2 phase for a new game.
     * 
     * - Sets phase to 'swap2_placement'
     * - Sets Player 1 as active player
     * - Initializes empty tentative stones array
     * 
     * Requirements: 1.1
     * 
     * @param string $gameId UUID of the game
     * @param string $player1Id UUID of first player (places initial 3 stones)
     * @param string $player2Id UUID of second player (makes first choice)
     * @return Swap2State Initial Swap 2 state
     */
    public function initializeSwap2(string $gameId, string $player1Id, string $player2Id): Swap2State;

    /**
     * Place a stone during Swap 2 phases.
     * 
     * - Validates position is within bounds and not occupied
     * - Validates correct player is acting
     * - Validates current phase allows placement
     * - Auto-advances phase when required stones are placed
     * 
     * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
     * 
     * @param string $gameId UUID of the game
     * @param string $playerId UUID of player placing stone
     * @param int $x X coordinate (0-14)
     * @param int $y Y coordinate (0-14)
     * @return Swap2State Updated state after placement
     * @throws \InvalidArgumentException If position invalid or occupied
     * @throws \RuntimeException If wrong player or wrong phase
     */
    public function placeStone(string $gameId, string $playerId, int $x, int $y): Swap2State;

    /**
     * Make a color choice during Swap 2 choice phases.
     * 
     * - Validates choice is valid for current phase
     * - Processes choice and transitions to next phase
     * - Assigns colors if choice is black/white
     * 
     * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
     * 
     * @param string $gameId UUID of the game
     * @param string $playerId UUID of player making choice
     * @param string $choice One of: 'black', 'white', 'place_more'
     * @return Swap2State Updated state after choice
     * @throws \InvalidArgumentException If choice invalid for current phase
     * @throws \RuntimeException If wrong player or wrong phase
     */
    public function makeChoice(string $gameId, string $playerId, string $choice): Swap2State;

    /**
     * Get current Swap 2 state for a game.
     * 
     * Requirements: 7.1
     * 
     * @param string $gameId UUID of the game
     * @return Swap2State|null Current state or null if not found
     */
    public function getState(string $gameId): ?Swap2State;

    /**
     * Check if Swap 2 phase is complete.
     * 
     * @param Swap2State $state Current Swap 2 state
     * @return bool True if phase is 'complete'
     */
    public function isComplete(Swap2State $state): bool;

    /**
     * Get final color assignments after Swap 2 completes.
     * 
     * Requirements: 3.6
     * 
     * @param Swap2State $state Completed Swap 2 state
     * @return ColorAssignment Final color assignments
     * @throws \RuntimeException If Swap 2 not complete
     */
    public function getFinalAssignments(Swap2State $state): ColorAssignment;

    /**
     * Serialize Swap 2 state to JSON string for database storage.
     * 
     * Requirements: 7.1, 7.2
     * 
     * @param Swap2State $state State to serialize
     * @return string JSON encoded state
     */
    public function serializeState(Swap2State $state): string;

    /**
     * Deserialize Swap 2 state from JSON string.
     * 
     * Requirements: 7.1, 7.2
     * 
     * @param string $json JSON encoded state
     * @return Swap2State Deserialized state
     * @throws \JsonException If JSON is invalid
     */
    public function deserializeState(string $json): Swap2State;

    /**
     * Restore state for a reconnecting player.
     * 
     * Loads the state from JSON and stores it in memory for the game.
     * Returns the exact phase and tentativeStones as they were before disconnect.
     * 
     * Requirements: 7.2
     * 
     * @param string $gameId Game ID
     * @param string $json JSON encoded state from database
     * @return Swap2State Restored state
     * @throws \JsonException If JSON is invalid
     */
    public function restoreStateForReconnection(string $gameId, string $json): Swap2State;

    /**
     * Get Swap 2 history for match completion.
     * 
     * Returns the complete action sequence and final color assignment
     * for storing in match history.
     * 
     * Requirements: 7.3
     * 
     * @param Swap2State $state Completed Swap 2 state
     * @return array History data with actions and finalAssignment
     */
    public function getSwap2History(Swap2State $state): array;

    /**
     * Serialize Swap 2 history to JSON string for database storage.
     * 
     * Requirements: 7.3
     * 
     * @param Swap2State $state Completed Swap 2 state
     * @return string JSON encoded history
     */
    public function serializeSwap2History(Swap2State $state): string;
}
