<?php
namespace App;

use App\Services\SeriesManagerServiceInterface;
use App\Services\ScoringEngineServiceInterface;
use App\Services\GameStateServiceInterface;
use App\Services\Swap2ManagerServiceInterface;
use App\Services\Swap2State;

class GameEngine
{
    private static ?SeriesManagerServiceInterface $seriesManager = null;
    private static ?ScoringEngineServiceInterface $scoringEngine = null;
    private static ?GameStateServiceInterface $gameStateService = null;
    private static ?Swap2ManagerServiceInterface $swap2Manager = null;
    private static ?\PDO $db = null;

    /**
     * Set the SeriesManager service for handling BO3 series
     */
    public static function setSeriesManager(SeriesManagerServiceInterface $manager): void
    {
        self::$seriesManager = $manager;
    }

    /**
     * Set the ScoringEngine service for calculating rewards
     */
    public static function setScoringEngine(ScoringEngineServiceInterface $engine): void
    {
        self::$scoringEngine = $engine;
    }

    /**
     * Set the GameStateService for managing game state with Swap 2 support
     * Requirements: 1.1, 7.1
     */
    public static function setGameStateService(GameStateServiceInterface $service): void
    {
        self::$gameStateService = $service;
    }

    /**
     * Set the Swap2Manager service for handling Swap 2 opening rule
     * Requirements: 1.1, 1.2, 1.3
     */
    public static function setSwap2Manager(Swap2ManagerServiceInterface $manager): void
    {
        self::$swap2Manager = $manager;
    }

    /**
     * Set database connection
     */
    public static function setDatabase(\PDO $db): void
    {
        self::$db = $db;
    }

    /**
     * Initialize a new game with optional Swap 2 support.
     * 
     * Requirements: 1.1, 4.3
     * 
     * @param string $gameId UUID of the game
     * @param string $player1Id UUID of first player
     * @param string $player2Id UUID of second player
     * @param bool $swap2Enabled Whether Swap 2 is enabled
     * @param array $options Additional options
     * @return array Initial game state
     */
    public static function initializeGame(
        string $gameId,
        string $player1Id,
        string $player2Id,
        bool $swap2Enabled = false,
        array $options = []
    ): array {
        if (self::$gameStateService === null) {
            // Fallback to traditional initialization without Swap 2
            return self::createTraditionalGameState($player1Id, $player2Id, $options);
        }

        return self::$gameStateService->initializeGame(
            $gameId,
            $player1Id,
            $player2Id,
            $swap2Enabled,
            $options
        );
    }

    /**
     * Create traditional game state without Swap 2.
     * 
     * @param string $player1Id UUID of first player
     * @param string $player2Id UUID of second player
     * @param array $options Additional options
     * @return array Game state
     */
    private static function createTraditionalGameState(
        string $player1Id,
        string $player2Id,
        array $options = []
    ): array {
        $timePerPlayer = $options['timePerPlayer'] ?? 300;
        
        return [
            'board' => array_fill(0, 15, array_fill(0, 15, null)),
            'moves' => [],
            'currentTurn' => 'X',
            'totalTimeX' => $timePerPlayer,
            'totalTimeO' => $timePerPlayer,
            'gameStartedAt' => date('c'),
            'lastMoveAt' => null,
            'swap2Enabled' => false,
            'gamePhase' => 'main_game',
            'player1Id' => $player1Id,
            'player2Id' => $player2Id,
            'playerX' => $player1Id,
            'playerO' => $player2Id,
            'swap2State' => null
        ];
    }

    /**
     * Handle a stone placement during Swap 2 or main game.
     * 
     * Requirements: 1.2, 2.1, 3.1
     * 
     * @param string $gameId UUID of the game
     * @param array $gameState Current game state
     * @param string $playerId UUID of player making move
     * @param int $x X coordinate
     * @param int $y Y coordinate
     * @return array Updated game state
     */
    public static function handlePlaceStone(
        string $gameId,
        array $gameState,
        string $playerId,
        int $x,
        int $y
    ): array {
        if (self::$gameStateService === null) {
            throw new \RuntimeException('GameStateService not configured');
        }

        return self::$gameStateService->placeStone($gameId, $gameState, $playerId, $x, $y);
    }

    /**
     * Handle a color choice during Swap 2 phase.
     * 
     * Requirements: 1.3, 3.1
     * 
     * @param string $gameId UUID of the game
     * @param array $gameState Current game state
     * @param string $playerId UUID of player making choice
     * @param string $choice 'black', 'white', or 'place_more'
     * @return array Updated game state
     */
    public static function handleSwap2Choice(
        string $gameId,
        array $gameState,
        string $playerId,
        string $choice
    ): array {
        if (self::$gameStateService === null) {
            throw new \RuntimeException('GameStateService not configured');
        }

        return self::$gameStateService->makeSwap2Choice($gameId, $gameState, $playerId, $choice);
    }

    /**
     * Check if game is in Swap 2 phase.
     * 
     * @param array $gameState Current game state
     * @return bool True if in swap2 phase
     */
    public static function isInSwap2Phase(array $gameState): bool
    {
        return ($gameState['gamePhase'] ?? 'main_game') === 'swap2';
    }

    /**
     * Get current game phase.
     * 
     * @param array $gameState Current game state
     * @return string 'swap2' or 'main_game'
     */
    public static function getGamePhase(array $gameState): string
    {
        return $gameState['gamePhase'] ?? 'main_game';
    }

    /**
     * Get Swap 2 state from game state.
     * 
     * @param array $gameState Current game state
     * @return Swap2State|null Swap 2 state or null
     */
    public static function getSwap2State(array $gameState): ?Swap2State
    {
        if (!isset($gameState['swap2State']) || $gameState['swap2State'] === null) {
            return null;
        }

        return Swap2State::fromArray($gameState['swap2State']);
    }

    /**
     * Transition from Swap 2 to main game.
     * Called when Swap 2 phase completes.
     * 
     * Requirements: 1.6, 3.6
     * 
     * @param array $gameState Current game state with completed Swap 2
     * @return array Game state ready for main game
     */
    public static function transitionToMainGame(array $gameState): array
    {
        $swap2State = self::getSwap2State($gameState);
        if ($swap2State === null) {
            return $gameState;
        }

        // Check if already transitioned
        if (($gameState['gamePhase'] ?? 'main_game') === 'main_game') {
            return $gameState;
        }

        // The transition is handled by GameStateService when Swap 2 completes
        // This method is for manual transition if needed
        return $gameState;
    }

    // Simple placeholder for shared game rules (server-authoritative)
    public static function checkWinner(array $board): ?string
    {
        // board: associative array with keys "x_y" => 'X' or 'O'
        // Return 'X' or 'O' if winner, or null
        if (empty($board)) {
            return null;
        }

        // Build position sets for X and O
        $positions = ['X' => [], 'O' => []];
        foreach ($board as $key => $val) {
            if (!in_array($val, ['X', 'O'])) continue;
            $parts = explode('_', $key);
            if (count($parts) !== 2) continue;
            $x = intval($parts[0]);
            $y = intval($parts[1]);
            $positions[$val]["{$x}_{$y}"] = true;
        }

        $dirs = [
            [1, 0], // ngang
            [0, 1], // dọc
            [1, 1], // chéo chính
            [1, -1] // chéo phụ
        ];

        foreach (['X', 'O'] as $player) {
            foreach ($positions[$player] as $key => $_) {
                $parts = explode('_', $key);
                $x0 = intval($parts[0]);
                $y0 = intval($parts[1]);

                foreach ($dirs as $d) {
                    $dx = $d[0];
                    $dy = $d[1];
                    $count = 1;
                    // forward
                    $i = 1;
                    while (isset($positions[$player]["" . ($x0 + $dx * $i) . "_" . ($y0 + $dy * $i)])) {
                        $count++;
                        $i++;
                    }
                    // backward
                    $i = 1;
                    while (isset($positions[$player]["" . ($x0 - $dx * $i) . "_" . ($y0 - $dy * $i)])) {
                        $count++;
                        $i++;
                    }
                    if ($count >= 5) {
                        return $player;
                    }
                }
            }
        }

        return null;
    }

    // Faster check that only inspects lines through the last move.
    // x0, y0: coordinates of the last placed stone.
    // Returns 'X' or 'O' if that move caused a win, otherwise null.
    public static function checkWinnerLastMove(array $board, int $x0, int $y0): ?string
    {
        // Build quick lookup of positions (same as checkWinner)
        $positions = ['X' => [], 'O' => []];
        foreach ($board as $key => $val) {
            if (!in_array($val, ['X', 'O'])) continue;
            $parts = explode('_', $key);
            if (count($parts) !== 2) continue;
            $x = intval($parts[0]);
            $y = intval($parts[1]);
            $positions[$val]["{$x}_{$y}"] = true;
        }

        $keyLast = "{$x0}_{$y0}";
        // If there is no stone at the last move, nothing to check
        $player = null;
        if (isset($positions['X'][$keyLast])) {
            $player = 'X';
        } elseif (isset($positions['O'][$keyLast])) {
            $player = 'O';
        } else {
            return null;
        }

        $dirs = [
            [1, 0],
            [0, 1],
            [1, 1],
            [1, -1]
        ];

        foreach ($dirs as $d) {
            $dx = $d[0];
            $dy = $d[1];
            $count = 1;

            // forward direction
            $i = 1;
            while (isset($positions[$player]["" . ($x0 + $dx * $i) . "_" . ($y0 + $dy * $i)])) {
                $count++;
                $i++;
            }

            // backward direction
            $i = 1;
            while (isset($positions[$player]["" . ($x0 - $dx * $i) . "_" . ($y0 - $dy * $i)])) {
                $count++;
                $i++;
            }

            if ($count >= 5) {
                return $player;
            }
        }

        return null;
    }

    /**
     * Handle game end within a series.
     * Updates series state, swaps sides if needed, and calculates rewards when series completes.
     * 
     * Requirements: 2.1, 2.4, 2.5
     * 
     * @param string $seriesId UUID of the series
     * @param string $matchId UUID of the completed match
     * @param string|null $winnerId UUID of game winner (null for draw)
     * @param int $gameDuration Duration in seconds
     * @return array Series state after game end
     */
    public static function handleGameEndInSeries(
        string $seriesId,
        string $matchId,
        ?string $winnerId,
        int $gameDuration
    ): array {
        if (self::$seriesManager === null) {
            throw new \RuntimeException('SeriesManager not configured');
        }

        // Get current game number BEFORE ending (since endGame increments it)
        $currentState = self::$seriesManager->getSeriesState($seriesId);
        $gameNumberBeforeEnd = $currentState ? ($currentState['series']['current_game'] ?? 1) : 1;

        // End the game in the series (updates score, checks completion, swaps sides)
        $result = self::$seriesManager->endGame($seriesId, $matchId, $winnerId, $gameDuration);

        // If series is complete, calculate and apply rewards
        if ($result['isComplete'] && self::$scoringEngine !== null) {
            $series = $result['series'];
            $rewards = self::$scoringEngine->calculateRewards($series);
            
            // Apply rewards to profiles
            $applyResult = self::$scoringEngine->applyRewards($series);
            
            $result['rewards'] = $applyResult['rewards'] ?? $rewards;
            $result['rankChanges'] = $applyResult['rankChanges'] ?? [];
        }

        // Update match record with series info (use game number BEFORE increment)
        self::updateMatchWithSeriesInfo($matchId, $seriesId, $gameNumberBeforeEnd);

        return $result;
    }

    /**
     * Get current player sides for a series game.
     * Returns which player should play X and which should play O.
     * 
     * Requirements: 2.4
     * 
     * @param string $seriesId UUID of the series
     * @return array|null ['playerX' => playerId, 'playerO' => playerId] or null if series not found
     */
    public static function getSeriesPlayerSides(string $seriesId): ?array
    {
        if (self::$seriesManager === null) {
            return null;
        }

        $state = self::$seriesManager->getSeriesState($seriesId);
        if ($state === null) {
            return null;
        }

        $series = $state['series'];
        return [
            'playerX' => $series['player1_side'] === 'X' ? $series['player1_id'] : $series['player2_id'],
            'playerO' => $series['player1_side'] === 'O' ? $series['player1_id'] : $series['player2_id'],
            'player1Side' => $series['player1_side'],
            'player2Side' => $series['player2_side'],
            'currentGame' => $series['current_game'],
            'score' => [
                'player1' => $series['player1_wins'],
                'player2' => $series['player2_wins']
            ]
        ];
    }

    /**
     * Check if a series is complete (someone has won 2 games).
     * 
     * @param string $seriesId UUID of the series
     * @return bool True if series is complete
     */
    public static function isSeriesComplete(string $seriesId): bool
    {
        if (self::$seriesManager === null) {
            return false;
        }

        $state = self::$seriesManager->getSeriesState($seriesId);
        if ($state === null) {
            return false;
        }

        return $state['isComplete'];
    }

    /**
     * Get series state for display.
     * 
     * @param string $seriesId UUID of the series
     * @return array|null Series state or null if not found
     */
    public static function getSeriesState(string $seriesId): ?array
    {
        if (self::$seriesManager === null) {
            return null;
        }

        return self::$seriesManager->getSeriesState($seriesId);
    }

    /**
     * Update match record with series information.
     * 
     * Requirements: 9.2
     * 
     * @param string $matchId UUID of the match
     * @param string $seriesId UUID of the series
     * @param int $gameNumber Game number within series (1, 2, or 3)
     */
    private static function updateMatchWithSeriesInfo(string $matchId, string $seriesId, int $gameNumber): void
    {
        if (self::$db === null) {
            return;
        }

        try {
            $stmt = self::$db->prepare(
                'UPDATE matches SET series_id = ?, game_number = ? WHERE id = ?'
            );
            $stmt->execute([$seriesId, $gameNumber, $matchId]);
        } catch (\Exception $e) {
            error_log("Failed to update match with series info: " . $e->getMessage());
        }
    }

    /**
     * Prepare next game in series after a game ends.
     * Returns the new player sides for the next game.
     * 
     * Requirements: 2.4, 2.5
     * 
     * @param string $seriesId UUID of the series
     * @return array|null Next game info or null if series complete/not found
     */
    public static function prepareNextGameInSeries(string $seriesId): ?array
    {
        if (self::$seriesManager === null) {
            return null;
        }

        $state = self::$seriesManager->getSeriesState($seriesId);
        if ($state === null || $state['isComplete']) {
            return null;
        }

        $series = $state['series'];
        return [
            'seriesId' => $seriesId,
            'gameNumber' => $series['current_game'],
            'player1Side' => $series['player1_side'],
            'player2Side' => $series['player2_side'],
            'score' => "{$series['player1_wins']}-{$series['player2_wins']}",
            'isReady' => $state['nextGameReady']
        ];
    }
}