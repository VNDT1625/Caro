<?php

namespace App\Services;

/**
 * Swap2ManagerService - Implementation of Swap 2 Opening Rule.
 * 
 * Manages the fair opening phase in Gomoku/Caro where players can
 * swap sides after seeing initial stones.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 8.1, 8.2, 8.3, 8.4, 8.5
 */
class Swap2ManagerService implements Swap2ManagerServiceInterface
{
    public const BOARD_SIZE = 15;
    public const INITIAL_STONES = 3;
    public const EXTRA_STONES = 2;
    public const TOTAL_STONES_WITH_EXTRA = 5;

    public const CHOICE_BLACK = 'black';
    public const CHOICE_WHITE = 'white';
    public const CHOICE_PLACE_MORE = 'place_more';

    /** Default timeout in seconds for Swap 2 phases */
    public const DEFAULT_TIMEOUT_SECONDS = 60;

    /** @var array<string, Swap2State> In-memory state storage */
    private array $states = [];

    /** @var array<string, int> Timeout timestamps per game */
    private array $timeouts = [];

    /**
     * {@inheritdoc}
     */
    public function initializeSwap2(string $gameId, string $player1Id, string $player2Id): Swap2State
    {
        $state = new Swap2State(
            Swap2State::PHASE_PLACEMENT,
            $player1Id,
            $player2Id,
            $player1Id, // Player 1 is active first
            [],
            null,
            null,
            null,
            []
        );

        $this->states[$gameId] = $state;
        return $state;
    }


    /**
     * {@inheritdoc}
     */
    public function placeStone(string $gameId, string $playerId, int $x, int $y): Swap2State
    {
        $state = $this->getState($gameId);
        if ($state === null) {
            throw new \RuntimeException("Game not found: {$gameId}");
        }

        // Validate phase allows placement
        $phase = $state->getPhase();
        if ($phase !== Swap2State::PHASE_PLACEMENT && $phase !== Swap2State::PHASE_EXTRA) {
            throw new \RuntimeException("Cannot place stone in phase: {$phase}");
        }

        // Validate correct player
        if ($state->getActivePlayerId() !== $playerId) {
            throw new \RuntimeException("Not your turn. Active player: {$state->getActivePlayerId()}");
        }

        // Validate position bounds
        if ($x < 0 || $x >= self::BOARD_SIZE || $y < 0 || $y >= self::BOARD_SIZE) {
            throw new \InvalidArgumentException("Position out of bounds: ({$x}, {$y})");
        }

        // Validate position not occupied
        if ($state->isPositionOccupied($x, $y)) {
            throw new \InvalidArgumentException("Position already occupied: ({$x}, {$y})");
        }

        // Create and add stone
        $placementOrder = $state->getStoneCount() + 1;
        $stone = new TentativeStone($x, $y, $playerId, $placementOrder, $phase);
        $state->addTentativeStone($stone);

        // Record action
        $action = Swap2Action::createPlacement($playerId, $x, $y);
        $state->addAction($action);

        // Check for phase transition
        $stoneCount = $state->getStoneCount();

        if ($phase === Swap2State::PHASE_PLACEMENT && $stoneCount >= self::INITIAL_STONES) {
            // After 3 stones, transition to choice phase
            $state->setPhase(Swap2State::PHASE_CHOICE);
            $state->setActivePlayerId($state->getPlayer2Id());
        } elseif ($phase === Swap2State::PHASE_EXTRA && $stoneCount >= self::TOTAL_STONES_WITH_EXTRA) {
            // After 5 stones (3 + 2), transition to final choice
            $state->setPhase(Swap2State::PHASE_FINAL_CHOICE);
            $state->setActivePlayerId($state->getPlayer1Id());
        }

        return $state;
    }

    /**
     * {@inheritdoc}
     */
    public function makeChoice(string $gameId, string $playerId, string $choice): Swap2State
    {
        $state = $this->getState($gameId);
        if ($state === null) {
            throw new \RuntimeException("Game not found: {$gameId}");
        }

        $phase = $state->getPhase();

        // Validate phase allows choice
        if ($phase !== Swap2State::PHASE_CHOICE && $phase !== Swap2State::PHASE_FINAL_CHOICE) {
            throw new \RuntimeException("Cannot make choice in phase: {$phase}");
        }

        // Validate correct player
        if ($state->getActivePlayerId() !== $playerId) {
            throw new \RuntimeException("Not your turn. Active player: {$state->getActivePlayerId()}");
        }

        // Validate choice options
        $validChoices = $this->getValidChoices($phase);
        if (!in_array($choice, $validChoices, true)) {
            throw new \InvalidArgumentException(
                "Invalid choice '{$choice}' for phase {$phase}. Valid: " . implode(', ', $validChoices)
            );
        }

        // Record action
        $action = Swap2Action::createChoice($playerId, $choice);
        $state->addAction($action);

        // Process choice
        if ($choice === self::CHOICE_PLACE_MORE) {
            // Player 2 wants to place more stones
            $state->setPhase(Swap2State::PHASE_EXTRA);
            // Player 2 continues to place stones
        } else {
            // Color choice made (black or white)
            $this->assignColors($state, $playerId, $choice);
            $state->setFinalChoice($playerId, $choice);
            $state->setPhase(Swap2State::PHASE_COMPLETE);
        }

        return $state;
    }


    /**
     * {@inheritdoc}
     */
    public function getState(string $gameId): ?Swap2State
    {
        return $this->states[$gameId] ?? null;
    }

    /**
     * {@inheritdoc}
     */
    public function isComplete(Swap2State $state): bool
    {
        return $state->getPhase() === Swap2State::PHASE_COMPLETE;
    }

    /**
     * {@inheritdoc}
     */
    public function getFinalAssignments(Swap2State $state): ColorAssignment
    {
        if (!$this->isComplete($state)) {
            throw new \RuntimeException("Swap 2 not complete. Current phase: {$state->getPhase()}");
        }

        $blackPlayerId = $state->getBlackPlayerId();
        $whitePlayerId = $state->getWhitePlayerId();

        if ($blackPlayerId === null || $whitePlayerId === null) {
            throw new \RuntimeException("Color assignments not set");
        }

        return new ColorAssignment($blackPlayerId, $whitePlayerId);
    }

    /**
     * Get valid choices for a given phase.
     * 
     * @param string $phase Current phase
     * @return string[] Valid choice options
     */
    private function getValidChoices(string $phase): array
    {
        if ($phase === Swap2State::PHASE_CHOICE) {
            return [self::CHOICE_BLACK, self::CHOICE_WHITE, self::CHOICE_PLACE_MORE];
        }
        if ($phase === Swap2State::PHASE_FINAL_CHOICE) {
            return [self::CHOICE_BLACK, self::CHOICE_WHITE];
        }
        return [];
    }

    /**
     * Assign colors based on player's choice.
     * 
     * @param Swap2State $state Current state
     * @param string $chooserId Player making the choice
     * @param string $choice 'black' or 'white'
     */
    private function assignColors(Swap2State $state, string $chooserId, string $choice): void
    {
        $player1Id = $state->getPlayer1Id();
        $player2Id = $state->getPlayer2Id();

        if ($choice === self::CHOICE_BLACK) {
            // Chooser takes black
            $state->setBlackPlayerId($chooserId);
            $state->setWhitePlayerId($chooserId === $player1Id ? $player2Id : $player1Id);
        } else {
            // Chooser takes white
            $state->setWhitePlayerId($chooserId);
            $state->setBlackPlayerId($chooserId === $player1Id ? $player2Id : $player1Id);
        }
    }

    /**
     * Load state from array (for persistence).
     * 
     * @param string $gameId Game ID
     * @param array $data Serialized state data
     * @return Swap2State Restored state
     */
    public function loadState(string $gameId, array $data): Swap2State
    {
        $state = Swap2State::fromArray($data);
        $this->states[$gameId] = $state;
        return $state;
    }

    /**
     * Remove state from memory.
     * 
     * @param string $gameId Game ID
     */
    public function clearState(string $gameId): void
    {
        unset($this->states[$gameId]);
    }

    /**
     * Serialize Swap 2 state to JSON string for database storage.
     * 
     * Requirements: 7.1, 7.2
     * 
     * @param Swap2State $state State to serialize
     * @return string JSON encoded state
     */
    public function serializeState(Swap2State $state): string
    {
        return json_encode($state->jsonSerialize(), JSON_THROW_ON_ERROR);
    }

    /**
     * Deserialize Swap 2 state from JSON string.
     * 
     * Requirements: 7.1, 7.2
     * 
     * @param string $json JSON encoded state
     * @return Swap2State Deserialized state
     * @throws \JsonException If JSON is invalid
     */
    public function deserializeState(string $json): Swap2State
    {
        $data = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        return Swap2State::fromArray($data);
    }

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
    public function restoreStateForReconnection(string $gameId, string $json): Swap2State
    {
        $state = $this->deserializeState($json);
        $this->states[$gameId] = $state;
        return $state;
    }

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
    public function getSwap2History(Swap2State $state): array
    {
        $history = [
            'actions' => array_map(fn($a) => $a->jsonSerialize(), $state->getActions()),
            'tentativeStones' => array_map(fn($s) => $s->jsonSerialize(), $state->getTentativeStones()),
            'finalChoice' => $state->getFinalChoice(),
        ];

        if ($this->isComplete($state)) {
            $history['finalAssignment'] = [
                'blackPlayerId' => $state->getBlackPlayerId(),
                'whitePlayerId' => $state->getWhitePlayerId(),
                'firstMover' => $state->getBlackPlayerId(), // Black always moves first
            ];
        }

        return $history;
    }

    /**
     * Serialize Swap 2 history to JSON string for database storage.
     * 
     * Requirements: 7.3
     * 
     * @param Swap2State $state Completed Swap 2 state
     * @return string JSON encoded history
     */
    public function serializeSwap2History(Swap2State $state): string
    {
        return json_encode($this->getSwap2History($state), JSON_THROW_ON_ERROR);
    }

    // ========================================================================
    // VALIDATION & ERROR HANDLING (Requirements 8.1, 8.2, 8.3, 8.4, 8.5)
    // ========================================================================

    /**
     * Validate a stone placement action comprehensively.
     * 
     * Checks player, phase, and position validity.
     * 
     * Requirements: 8.1, 8.2, 8.3
     * 
     * @param string $gameId Game ID
     * @param string $playerId Player attempting the action
     * @param int $x X coordinate
     * @param int $y Y coordinate
     * @return ValidationResult Result with isValid flag and error details
     */
    public function validatePlacement(string $gameId, string $playerId, int $x, int $y): ValidationResult
    {
        $state = $this->getState($gameId);
        
        // Check game exists
        if ($state === null) {
            return new ValidationResult(false, 'game_not_found', "Game not found: {$gameId}");
        }

        // Check phase allows placement
        $phase = $state->getPhase();
        if ($phase !== Swap2State::PHASE_PLACEMENT && $phase !== Swap2State::PHASE_EXTRA) {
            return new ValidationResult(
                false, 
                'invalid_phase', 
                "Cannot place stone in phase: {$phase}. Expected: swap2_placement or swap2_extra",
                ['currentPhase' => $phase, 'validPhases' => [Swap2State::PHASE_PLACEMENT, Swap2State::PHASE_EXTRA]]
            );
        }

        // Check correct player
        $activePlayer = $state->getActivePlayerId();
        if ($activePlayer !== $playerId) {
            return new ValidationResult(
                false, 
                'wrong_player', 
                "Not your turn. Active player: {$activePlayer}",
                ['activePlayerId' => $activePlayer, 'attemptedPlayerId' => $playerId]
            );
        }

        // Check position bounds
        if ($x < 0 || $x >= self::BOARD_SIZE || $y < 0 || $y >= self::BOARD_SIZE) {
            return new ValidationResult(
                false, 
                'out_of_bounds', 
                "Position out of bounds: ({$x}, {$y}). Valid range: 0-" . (self::BOARD_SIZE - 1),
                ['x' => $x, 'y' => $y, 'maxCoord' => self::BOARD_SIZE - 1]
            );
        }

        // Check position not occupied
        if ($state->isPositionOccupied($x, $y)) {
            return new ValidationResult(
                false, 
                'position_occupied', 
                "Position already occupied: ({$x}, {$y})",
                ['x' => $x, 'y' => $y]
            );
        }

        return new ValidationResult(true);
    }

    /**
     * Validate a choice action comprehensively.
     * 
     * Checks player, phase, and choice validity.
     * 
     * Requirements: 8.1, 8.2, 8.3
     * 
     * @param string $gameId Game ID
     * @param string $playerId Player attempting the action
     * @param string $choice The choice being made
     * @return ValidationResult Result with isValid flag and error details
     */
    public function validateChoice(string $gameId, string $playerId, string $choice): ValidationResult
    {
        $state = $this->getState($gameId);
        
        // Check game exists
        if ($state === null) {
            return new ValidationResult(false, 'game_not_found', "Game not found: {$gameId}");
        }

        // Check phase allows choice
        $phase = $state->getPhase();
        if ($phase !== Swap2State::PHASE_CHOICE && $phase !== Swap2State::PHASE_FINAL_CHOICE) {
            return new ValidationResult(
                false, 
                'invalid_phase', 
                "Cannot make choice in phase: {$phase}. Expected: swap2_choice or swap2_final_choice",
                ['currentPhase' => $phase, 'validPhases' => [Swap2State::PHASE_CHOICE, Swap2State::PHASE_FINAL_CHOICE]]
            );
        }

        // Check correct player
        $activePlayer = $state->getActivePlayerId();
        if ($activePlayer !== $playerId) {
            return new ValidationResult(
                false, 
                'wrong_player', 
                "Not your turn. Active player: {$activePlayer}",
                ['activePlayerId' => $activePlayer, 'attemptedPlayerId' => $playerId]
            );
        }

        // Check choice is valid for current phase
        $validChoices = $this->getValidChoices($phase);
        if (!in_array($choice, $validChoices, true)) {
            return new ValidationResult(
                false, 
                'invalid_choice', 
                "Invalid choice '{$choice}' for phase {$phase}. Valid options: " . implode(', ', $validChoices),
                ['choice' => $choice, 'validChoices' => $validChoices, 'phase' => $phase]
            );
        }

        return new ValidationResult(true);
    }

    /**
     * Validate any action (placement or choice) based on current state.
     * 
     * Requirements: 8.1, 8.2, 8.3
     * 
     * @param string $gameId Game ID
     * @param string $playerId Player attempting the action
     * @param string $actionType 'place' or 'choice'
     * @param array $actionData Additional data (x, y for place; choice for choice)
     * @return ValidationResult Result with isValid flag and error details
     */
    public function validateAction(string $gameId, string $playerId, string $actionType, array $actionData): ValidationResult
    {
        if ($actionType === 'place') {
            $x = $actionData['x'] ?? null;
            $y = $actionData['y'] ?? null;
            
            if ($x === null || $y === null) {
                return new ValidationResult(
                    false, 
                    'missing_coordinates', 
                    'Stone placement requires x and y coordinates',
                    ['providedData' => $actionData]
                );
            }
            
            return $this->validatePlacement($gameId, $playerId, (int)$x, (int)$y);
        }
        
        if ($actionType === 'choice') {
            $choice = $actionData['choice'] ?? null;
            
            if ($choice === null) {
                return new ValidationResult(
                    false, 
                    'missing_choice', 
                    'Choice action requires a choice value',
                    ['providedData' => $actionData]
                );
            }
            
            return $this->validateChoice($gameId, $playerId, $choice);
        }
        
        return new ValidationResult(
            false, 
            'invalid_action_type', 
            "Invalid action type: {$actionType}. Valid types: place, choice",
            ['actionType' => $actionType, 'validTypes' => ['place', 'choice']]
        );
    }

    /**
     * Get the expected active player for a given phase.
     * 
     * Requirements: 1.1, 1.2, 1.4, 1.5
     * 
     * @param Swap2State $state Current state
     * @return string Expected active player ID
     */
    public function getExpectedActivePlayer(Swap2State $state): string
    {
        $phase = $state->getPhase();
        
        switch ($phase) {
            case Swap2State::PHASE_PLACEMENT:
            case Swap2State::PHASE_FINAL_CHOICE:
                return $state->getPlayer1Id();
            
            case Swap2State::PHASE_CHOICE:
            case Swap2State::PHASE_EXTRA:
                return $state->getPlayer2Id();
            
            case Swap2State::PHASE_COMPLETE:
                // No active player in complete phase
                return $state->getBlackPlayerId() ?? $state->getPlayer1Id();
            
            default:
                return $state->getPlayer1Id();
        }
    }

    /**
     * Check if the active player is correct for the current phase.
     * 
     * Requirements: 8.2
     * 
     * @param Swap2State $state Current state
     * @return bool True if active player matches expected
     */
    public function isActivePlayerCorrect(Swap2State $state): bool
    {
        if ($state->getPhase() === Swap2State::PHASE_COMPLETE) {
            return true; // No validation needed for complete phase
        }
        
        return $state->getActivePlayerId() === $this->getExpectedActivePlayer($state);
    }

    // ========================================================================
    // TIMEOUT HANDLING (Requirement 8.4)
    // ========================================================================

    /**
     * Set timeout for a game's current phase.
     * 
     * Requirements: 8.4
     * 
     * @param string $gameId Game ID
     * @param int $timeoutSeconds Timeout in seconds (default: 60)
     */
    public function setPhaseTimeout(string $gameId, int $timeoutSeconds = self::DEFAULT_TIMEOUT_SECONDS): void
    {
        $this->timeouts[$gameId] = time() + $timeoutSeconds;
    }

    /**
     * Check if a game has timed out.
     * 
     * Requirements: 8.4
     * 
     * @param string $gameId Game ID
     * @return bool True if timed out
     */
    public function hasTimedOut(string $gameId): bool
    {
        if (!isset($this->timeouts[$gameId])) {
            return false;
        }
        
        return time() > $this->timeouts[$gameId];
    }

    /**
     * Get remaining time for a game's current phase.
     * 
     * Requirements: 8.4
     * 
     * @param string $gameId Game ID
     * @return int Remaining seconds (0 if no timeout set or expired)
     */
    public function getRemainingTime(string $gameId): int
    {
        if (!isset($this->timeouts[$gameId])) {
            return 0;
        }
        
        $remaining = $this->timeouts[$gameId] - time();
        return max(0, $remaining);
    }

    /**
     * Handle timeout by applying default action.
     * 
     * - For placement phases: Place at random valid position
     * - For choice phases: Default to 'black' choice
     * 
     * Requirements: 8.4
     * 
     * @param string $gameId Game ID
     * @return Swap2State|null Updated state, or null if no timeout handling needed
     */
    public function handleTimeout(string $gameId): ?Swap2State
    {
        if (!$this->hasTimedOut($gameId)) {
            return null;
        }

        $state = $this->getState($gameId);
        if ($state === null) {
            return null;
        }

        $phase = $state->getPhase();
        $activePlayer = $state->getActivePlayerId();

        // Clear the timeout
        unset($this->timeouts[$gameId]);

        if ($phase === Swap2State::PHASE_PLACEMENT || $phase === Swap2State::PHASE_EXTRA) {
            // Auto-place at random valid position
            $position = $this->findRandomValidPosition($state);
            if ($position !== null) {
                return $this->placeStone($gameId, $activePlayer, $position['x'], $position['y']);
            }
        } elseif ($phase === Swap2State::PHASE_CHOICE || $phase === Swap2State::PHASE_FINAL_CHOICE) {
            // Default to 'black' choice
            return $this->makeChoice($gameId, $activePlayer, self::CHOICE_BLACK);
        }

        return null;
    }

    /**
     * Find a random valid position for stone placement.
     * 
     * @param Swap2State $state Current state
     * @return array|null Position array ['x' => int, 'y' => int] or null if no valid position
     */
    private function findRandomValidPosition(Swap2State $state): ?array
    {
        $validPositions = [];
        
        // Prefer center area for better gameplay
        $centerX = self::BOARD_SIZE / 2;
        $centerY = self::BOARD_SIZE / 2;
        
        for ($x = 0; $x < self::BOARD_SIZE; $x++) {
            for ($y = 0; $y < self::BOARD_SIZE; $y++) {
                if (!$state->isPositionOccupied($x, $y)) {
                    // Calculate distance from center for weighting
                    $distance = abs($x - $centerX) + abs($y - $centerY);
                    $validPositions[] = ['x' => $x, 'y' => $y, 'distance' => $distance];
                }
            }
        }

        if (empty($validPositions)) {
            return null;
        }

        // Sort by distance to center (prefer center positions)
        usort($validPositions, fn($a, $b) => $a['distance'] <=> $b['distance']);
        
        // Pick from top 25% closest to center with some randomness
        $topCount = max(1, (int)(count($validPositions) * 0.25));
        $index = mt_rand(0, $topCount - 1);
        
        return ['x' => $validPositions[$index]['x'], 'y' => $validPositions[$index]['y']];
    }

    // ========================================================================
    // ERROR RECOVERY (Requirement 8.5)
    // ========================================================================

    /**
     * Validate state integrity and attempt recovery if corrupted.
     * 
     * Requirements: 8.5
     * 
     * @param string $gameId Game ID
     * @return StateRecoveryResult Result with status and recovered state if applicable
     */
    public function validateAndRecoverState(string $gameId): StateRecoveryResult
    {
        $state = $this->getState($gameId);
        
        if ($state === null) {
            return new StateRecoveryResult(false, 'state_not_found', null, "No state found for game: {$gameId}");
        }

        $issues = $this->detectStateIssues($state);
        
        if (empty($issues)) {
            return new StateRecoveryResult(true, 'valid', $state);
        }

        // Attempt recovery
        $recoveredState = $this->attemptStateRecovery($state, $issues);
        
        if ($recoveredState !== null) {
            $this->states[$gameId] = $recoveredState;
            return new StateRecoveryResult(
                true, 
                'recovered', 
                $recoveredState, 
                'State recovered from issues: ' . implode(', ', $issues)
            );
        }

        // Recovery failed - log and return failure
        error_log("Swap2 state corruption detected for game {$gameId}: " . implode(', ', $issues));
        
        return new StateRecoveryResult(
            false, 
            'unrecoverable', 
            null, 
            'State corruption detected: ' . implode(', ', $issues)
        );
    }

    /**
     * Detect issues in state integrity.
     * 
     * @param Swap2State $state State to check
     * @return string[] List of detected issues
     */
    private function detectStateIssues(Swap2State $state): array
    {
        $issues = [];

        // Check phase is valid
        $validPhases = [
            Swap2State::PHASE_PLACEMENT,
            Swap2State::PHASE_CHOICE,
            Swap2State::PHASE_EXTRA,
            Swap2State::PHASE_FINAL_CHOICE,
            Swap2State::PHASE_COMPLETE
        ];
        
        if (!in_array($state->getPhase(), $validPhases, true)) {
            $issues[] = 'invalid_phase';
        }

        // Check stone count matches phase
        $stoneCount = $state->getStoneCount();
        $phase = $state->getPhase();
        
        if ($phase === Swap2State::PHASE_PLACEMENT && $stoneCount > 3) {
            $issues[] = 'stone_count_exceeds_placement_limit';
        }
        
        if ($phase === Swap2State::PHASE_CHOICE && $stoneCount !== 3) {
            $issues[] = 'stone_count_mismatch_choice_phase';
        }
        
        if ($phase === Swap2State::PHASE_EXTRA && ($stoneCount < 3 || $stoneCount > 5)) {
            $issues[] = 'stone_count_invalid_extra_phase';
        }
        
        if ($phase === Swap2State::PHASE_FINAL_CHOICE && $stoneCount !== 5) {
            $issues[] = 'stone_count_mismatch_final_choice';
        }

        // Check active player is valid
        $activePlayer = $state->getActivePlayerId();
        if ($activePlayer !== $state->getPlayer1Id() && $activePlayer !== $state->getPlayer2Id()) {
            $issues[] = 'invalid_active_player';
        }

        // Check active player matches expected for phase
        if (!$this->isActivePlayerCorrect($state)) {
            $issues[] = 'active_player_phase_mismatch';
        }

        // Check for duplicate stone positions
        $positions = [];
        foreach ($state->getTentativeStones() as $stone) {
            $key = $stone->getX() . ',' . $stone->getY();
            if (isset($positions[$key])) {
                $issues[] = 'duplicate_stone_positions';
                break;
            }
            $positions[$key] = true;
        }

        // Check color assignments in complete phase
        if ($phase === Swap2State::PHASE_COMPLETE) {
            if ($state->getBlackPlayerId() === null || $state->getWhitePlayerId() === null) {
                $issues[] = 'missing_color_assignments';
            }
            if ($state->getBlackPlayerId() === $state->getWhitePlayerId()) {
                $issues[] = 'duplicate_color_assignments';
            }
        }

        return $issues;
    }

    /**
     * Attempt to recover from detected state issues.
     * 
     * @param Swap2State $state Corrupted state
     * @param string[] $issues Detected issues
     * @return Swap2State|null Recovered state or null if unrecoverable
     */
    private function attemptStateRecovery(Swap2State $state, array $issues): ?Swap2State
    {
        // Create a copy for recovery
        $data = $state->jsonSerialize();
        
        foreach ($issues as $issue) {
            switch ($issue) {
                case 'active_player_phase_mismatch':
                    // Fix active player based on phase
                    $data['activePlayerId'] = $this->getExpectedActivePlayer($state);
                    break;
                    
                case 'invalid_active_player':
                    // Reset to player 1
                    $data['activePlayerId'] = $data['player1Id'];
                    break;
                    
                case 'stone_count_exceeds_placement_limit':
                case 'stone_count_mismatch_choice_phase':
                case 'stone_count_invalid_extra_phase':
                case 'stone_count_mismatch_final_choice':
                    // These require more complex recovery - try to infer correct phase
                    $stoneCount = count($data['tentativeStones']);
                    if ($stoneCount < 3) {
                        $data['phase'] = Swap2State::PHASE_PLACEMENT;
                        $data['activePlayerId'] = $data['player1Id'];
                    } elseif ($stoneCount === 3) {
                        $data['phase'] = Swap2State::PHASE_CHOICE;
                        $data['activePlayerId'] = $data['player2Id'];
                    } elseif ($stoneCount < 5) {
                        $data['phase'] = Swap2State::PHASE_EXTRA;
                        $data['activePlayerId'] = $data['player2Id'];
                    } elseif ($stoneCount === 5) {
                        $data['phase'] = Swap2State::PHASE_FINAL_CHOICE;
                        $data['activePlayerId'] = $data['player1Id'];
                    }
                    break;
                    
                case 'duplicate_stone_positions':
                    // Remove duplicate stones (keep first occurrence)
                    $seen = [];
                    $uniqueStones = [];
                    foreach ($data['tentativeStones'] as $stone) {
                        $key = $stone['x'] . ',' . $stone['y'];
                        if (!isset($seen[$key])) {
                            $seen[$key] = true;
                            $uniqueStones[] = $stone;
                        }
                    }
                    $data['tentativeStones'] = $uniqueStones;
                    break;
                    
                case 'invalid_phase':
                case 'missing_color_assignments':
                case 'duplicate_color_assignments':
                    // These are unrecoverable without more context
                    return null;
            }
        }

        try {
            return Swap2State::fromArray($data);
        } catch (\Exception $e) {
            error_log("State recovery failed: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Reset Swap 2 state to initial phase, preserving player IDs.
     * 
     * Used when state is unrecoverable.
     * 
     * Requirements: 8.5
     * 
     * @param string $gameId Game ID
     * @return Swap2State|null New initial state, or null if game not found
     */
    public function resetToInitialPhase(string $gameId): ?Swap2State
    {
        $state = $this->getState($gameId);
        
        if ($state === null) {
            return null;
        }

        $player1Id = $state->getPlayer1Id();
        $player2Id = $state->getPlayer2Id();

        // Log the reset
        error_log("Resetting Swap2 state for game {$gameId} due to corruption");

        return $this->initializeSwap2($gameId, $player1Id, $player2Id);
    }
}
