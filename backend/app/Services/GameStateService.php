<?php

namespace App\Services;

/**
 * GameStateService - Manages game state including Swap 2 integration.
 * 
 * Extends the game state structure to support Swap 2 opening rule.
 * Handles game initialization, state transitions, and persistence.
 * 
 * Requirements: 1.1, 1.6, 4.3, 7.1
 */
class GameStateService implements GameStateServiceInterface
{
    public const PHASE_SWAP2 = 'swap2';
    public const PHASE_MAIN_GAME = 'main_game';
    
    public const BOARD_SIZE = 15;
    public const DEFAULT_TIME = 300; // 5 minutes per player

    private Swap2ManagerServiceInterface $swap2Manager;

    public function __construct(Swap2ManagerServiceInterface $swap2Manager)
    {
        $this->swap2Manager = $swap2Manager;
    }

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
    ): array {
        $timePerPlayer = $options['timePerPlayer'] ?? self::DEFAULT_TIME;
        
        $baseState = [
            'board' => $this->createEmptyBoard(),
            'moves' => [],
            'currentTurn' => 'X',
            'totalTimeX' => $timePerPlayer,
            'totalTimeO' => $timePerPlayer,
            'gameStartedAt' => date('c'),
            'lastMoveAt' => null,
            'swap2Enabled' => $swap2Enabled,
            'gamePhase' => $swap2Enabled ? self::PHASE_SWAP2 : self::PHASE_MAIN_GAME,
            'player1Id' => $player1Id,
            'player2Id' => $player2Id,
        ];

        if ($swap2Enabled) {
            // Initialize Swap 2 state
            $swap2State = $this->swap2Manager->initializeSwap2($gameId, $player1Id, $player2Id);
            $baseState['swap2State'] = $swap2State->jsonSerialize();
            // During swap2, no currentTurn yet - active player is in swap2State
            $baseState['currentTurn'] = null;
        } else {
            // Traditional game - X starts
            $baseState['swap2State'] = null;
            // Assign sides: player1 = X, player2 = O
            $baseState['playerX'] = $player1Id;
            $baseState['playerO'] = $player2Id;
        }

        return $baseState;
    }

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
    ): array {
        $gamePhase = $gameState['gamePhase'] ?? self::PHASE_MAIN_GAME;

        if ($gamePhase === self::PHASE_SWAP2) {
            return $this->handleSwap2Placement($gameId, $gameState, $playerId, $x, $y);
        }

        return $this->handleMainGameMove($gameState, $playerId, $x, $y);
    }

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
    ): array {
        $gamePhase = $gameState['gamePhase'] ?? self::PHASE_MAIN_GAME;

        if ($gamePhase !== self::PHASE_SWAP2) {
            throw new \RuntimeException("Cannot make Swap 2 choice in phase: {$gamePhase}");
        }

        // Load swap2 state into manager
        if (isset($gameState['swap2State'])) {
            $this->swap2Manager->loadState($gameId, $gameState['swap2State']);
        }

        // Make the choice
        $swap2State = $this->swap2Manager->makeChoice($gameId, $playerId, $choice);
        $gameState['swap2State'] = $swap2State->jsonSerialize();

        // Check if Swap 2 is complete
        if ($this->swap2Manager->isComplete($swap2State)) {
            $gameState = $this->transitionToMainGame($gameId, $gameState, $swap2State);
        }

        return $gameState;
    }

    /**
     * Handle stone placement during Swap 2 phase.
     * 
     * @param string $gameId UUID of the game
     * @param array $gameState Current game state
     * @param string $playerId UUID of player
     * @param int $x X coordinate
     * @param int $y Y coordinate
     * @return array Updated game state
     */
    private function handleSwap2Placement(
        string $gameId,
        array $gameState,
        string $playerId,
        int $x,
        int $y
    ): array {
        // Load swap2 state into manager
        if (isset($gameState['swap2State'])) {
            $this->swap2Manager->loadState($gameId, $gameState['swap2State']);
        }

        // Place the stone
        $swap2State = $this->swap2Manager->placeStone($gameId, $playerId, $x, $y);
        $gameState['swap2State'] = $swap2State->jsonSerialize();

        return $gameState;
    }

    /**
     * Handle move during main game phase.
     * 
     * @param array $gameState Current game state
     * @param string $playerId UUID of player
     * @param int $x X coordinate
     * @param int $y Y coordinate
     * @return array Updated game state
     */
    private function handleMainGameMove(
        array $gameState,
        string $playerId,
        int $x,
        int $y
    ): array {
        // Validate it's the player's turn
        $currentTurn = $gameState['currentTurn'];
        $playerSymbol = null;

        if (isset($gameState['playerX']) && $gameState['playerX'] === $playerId) {
            $playerSymbol = 'X';
        } elseif (isset($gameState['playerO']) && $gameState['playerO'] === $playerId) {
            $playerSymbol = 'O';
        }

        if ($playerSymbol === null) {
            throw new \RuntimeException("Player not found in game: {$playerId}");
        }

        if ($currentTurn !== $playerSymbol) {
            throw new \RuntimeException("Not your turn. Current turn: {$currentTurn}");
        }

        // Validate position
        if ($x < 0 || $x >= self::BOARD_SIZE || $y < 0 || $y >= self::BOARD_SIZE) {
            throw new \InvalidArgumentException("Position out of bounds: ({$x}, {$y})");
        }

        if ($gameState['board'][$y][$x] !== null) {
            throw new \InvalidArgumentException("Position already occupied: ({$x}, {$y})");
        }

        // Apply move
        $gameState['board'][$y][$x] = $playerSymbol;
        $gameState['moves'][] = [
            'x' => $x,
            'y' => $y,
            'player' => $playerSymbol,
            'timestamp' => time() * 1000
        ];
        $gameState['currentTurn'] = $playerSymbol === 'X' ? 'O' : 'X';
        $gameState['lastMoveAt'] = date('c');

        return $gameState;
    }

    /**
     * Transition from Swap 2 to main game.
     * 
     * Applies final color assignments and sets up main game state.
     * 
     * Requirements: 1.6, 3.6
     * 
     * @param string $gameId UUID of the game
     * @param array $gameState Current game state
     * @param Swap2State $swap2State Completed Swap 2 state
     * @return array Updated game state for main game
     */
    private function transitionToMainGame(
        string $gameId,
        array $gameState,
        Swap2State $swap2State
    ): array {
        $assignments = $this->swap2Manager->getFinalAssignments($swap2State);

        // Update game phase
        $gameState['gamePhase'] = self::PHASE_MAIN_GAME;

        // Set player colors (Black = X, White = O in display)
        $gameState['playerX'] = $assignments->getBlackPlayerId();
        $gameState['playerO'] = $assignments->getWhitePlayerId();

        // Black (X) always moves first
        $gameState['currentTurn'] = 'X';

        // Convert tentative stones to board positions
        // First 3 stones: 2 black (X) + 1 white (O)
        // If place_more: additional 1 black + 1 white
        $tentativeStones = $swap2State->getTentativeStones();
        $board = $this->createEmptyBoard();

        // Stone pattern: B, W, B, [B, W] (if place_more)
        // Placement order 1, 2, 3 = B, W, B
        // Placement order 4, 5 = B, W
        foreach ($tentativeStones as $stone) {
            $order = $stone->getPlacementOrder();
            // Pattern: 1=B, 2=W, 3=B, 4=B, 5=W
            $isBlack = in_array($order, [1, 3, 4], true);
            $symbol = $isBlack ? 'X' : 'O';
            $board[$stone->getY()][$stone->getX()] = $symbol;

            // Add to moves history
            $gameState['moves'][] = [
                'x' => $stone->getX(),
                'y' => $stone->getY(),
                'player' => $symbol,
                'timestamp' => time() * 1000,
                'swap2Phase' => true
            ];
        }

        $gameState['board'] = $board;

        // Store final assignments for reference
        $gameState['colorAssignment'] = $assignments->jsonSerialize();

        return $gameState;
    }

    /**
     * Create an empty 15x15 board.
     * 
     * @return array 2D array of nulls
     */
    private function createEmptyBoard(): array
    {
        return array_fill(0, self::BOARD_SIZE, array_fill(0, self::BOARD_SIZE, null));
    }

    /**
     * Get current game phase.
     * 
     * @param array $gameState Current game state
     * @return string 'swap2' or 'main_game'
     */
    public function getGamePhase(array $gameState): string
    {
        return $gameState['gamePhase'] ?? self::PHASE_MAIN_GAME;
    }

    /**
     * Check if game is in Swap 2 phase.
     * 
     * @param array $gameState Current game state
     * @return bool True if in swap2 phase
     */
    public function isInSwap2Phase(array $gameState): bool
    {
        return $this->getGamePhase($gameState) === self::PHASE_SWAP2;
    }

    /**
     * Get Swap 2 state from game state.
     * 
     * @param array $gameState Current game state
     * @return Swap2State|null Swap 2 state or null
     */
    public function getSwap2State(array $gameState): ?Swap2State
    {
        if (!isset($gameState['swap2State']) || $gameState['swap2State'] === null) {
            return null;
        }

        return Swap2State::fromArray($gameState['swap2State']);
    }

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
    public function restoreStateForReconnection(string $gameId, array $gameState): array
    {
        // If in Swap 2 phase, synchronize the Swap2Manager
        if ($this->isInSwap2Phase($gameState) && isset($gameState['swap2State'])) {
            $this->swap2Manager->loadState($gameId, $gameState['swap2State']);
        }

        return $gameState;
    }

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
    public function getReconnectionInfo(array $gameState, string $playerId): array
    {
        $info = [
            'gamePhase' => $this->getGamePhase($gameState),
            'board' => $gameState['board'] ?? [],
            'moves' => $gameState['moves'] ?? [],
            'currentTurn' => $gameState['currentTurn'] ?? null,
            'swap2Enabled' => $gameState['swap2Enabled'] ?? false,
        ];

        if ($this->isInSwap2Phase($gameState)) {
            $swap2State = $this->getSwap2State($gameState);
            if ($swap2State !== null) {
                $info['swap2'] = [
                    'phase' => $swap2State->getPhase(),
                    'activePlayerId' => $swap2State->getActivePlayerId(),
                    'isYourTurn' => $swap2State->getActivePlayerId() === $playerId,
                    'stoneCount' => $swap2State->getStoneCount(),
                    'tentativeStones' => array_map(
                        fn($s) => $s->jsonSerialize(),
                        $swap2State->getTentativeStones()
                    ),
                ];
            }
        } else {
            // Main game phase
            $playerSymbol = null;
            if (isset($gameState['playerX']) && $gameState['playerX'] === $playerId) {
                $playerSymbol = 'X';
            } elseif (isset($gameState['playerO']) && $gameState['playerO'] === $playerId) {
                $playerSymbol = 'O';
            }
            
            $info['playerSymbol'] = $playerSymbol;
            $info['isYourTurn'] = $gameState['currentTurn'] === $playerSymbol;
        }

        return $info;
    }
}
