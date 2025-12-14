<?php

namespace App\Controllers;

use App\Services\Swap2ManagerServiceInterface;
use App\Services\Swap2State;

/**
 * Swap2Controller - REST API endpoints for Swap 2 opening rule.
 * 
 * Provides endpoints for:
 * - Initializing Swap 2 for a game
 * - Placing stones during Swap 2 phases
 * - Making color choices
 * - Getting current Swap 2 state
 * 
 * Requirements: 7.1, 7.2, 7.3
 */
class Swap2Controller
{
    private ?Swap2ManagerServiceInterface $swap2Manager = null;

    public function __construct(?Swap2ManagerServiceInterface $swap2Manager = null)
    {
        $this->swap2Manager = $swap2Manager;
    }

    public function setSwap2Manager(Swap2ManagerServiceInterface $manager): self
    {
        $this->swap2Manager = $manager;
        return $this;
    }

    /**
     * POST /api/swap2/initialize
     * 
     * Initialize Swap 2 for a new game.
     * 
     * Request body:
     * - room_id: string (required)
     * - player1_id: string (required)
     * - player2_id: string (required)
     * 
     * Requirements: 7.3
     */
    public function initialize(array $request): array
    {
        if ($this->swap2Manager === null) {
            return $this->error('Swap 2 service not configured', 503);
        }

        $roomId = $request['room_id'] ?? null;
        $player1Id = $request['player1_id'] ?? null;
        $player2Id = $request['player2_id'] ?? null;

        if (!$roomId || !$player1Id || !$player2Id) {
            return $this->error('room_id, player1_id, and player2_id are required', 400);
        }

        try {
            $state = $this->swap2Manager->initializeSwap2($roomId, $player1Id, $player2Id);
            
            return [
                'success' => true,
                'swap2State' => $state->jsonSerialize(),
                'gameId' => $roomId
            ];
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), 500);
        }
    }

    /**
     * POST /api/swap2/place-stone
     * 
     * Place a stone during Swap 2 placement phases.
     * 
     * Request body:
     * - room_id: string (required)
     * - player_id: string (required)
     * - x: int (required, 0-14)
     * - y: int (required, 0-14)
     * 
     * Requirements: 7.1
     */
    public function placeStone(array $request): array
    {
        if ($this->swap2Manager === null) {
            return $this->error('Swap 2 service not configured', 503);
        }

        $roomId = $request['room_id'] ?? null;
        $playerId = $request['player_id'] ?? null;
        $x = $request['x'] ?? null;
        $y = $request['y'] ?? null;

        if (!$roomId || !$playerId || $x === null || $y === null) {
            return $this->error('room_id, player_id, x, and y are required', 400);
        }

        // Validate coordinates
        $x = (int) $x;
        $y = (int) $y;
        if ($x < 0 || $x >= 15 || $y < 0 || $y >= 15) {
            return $this->error('Coordinates must be between 0 and 14', 400);
        }

        try {
            // Validate placement first
            $validation = $this->swap2Manager->validatePlacement($roomId, $playerId, $x, $y);
            if (!$validation->isValid()) {
                return $this->error($validation->getMessage(), 400, [
                    'code' => $validation->getCode(),
                    'details' => $validation->getDetails()
                ]);
            }

            // Place the stone
            $state = $this->swap2Manager->placeStone($roomId, $playerId, $x, $y);
            
            return [
                'success' => true,
                'swap2State' => $state->jsonSerialize(),
                'stonePlaced' => ['x' => $x, 'y' => $y],
                'phase' => $state->getPhase(),
                'activePlayerId' => $state->getActivePlayerId()
            ];
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), 500);
        }
    }

    /**
     * POST /api/swap2/make-choice
     * 
     * Make a color choice during Swap 2 choice phases.
     * 
     * Request body:
     * - room_id: string (required)
     * - player_id: string (required)
     * - choice: string (required, 'black'|'white'|'place_more')
     * 
     * Requirements: 7.2
     */
    public function makeChoice(array $request): array
    {
        if ($this->swap2Manager === null) {
            return $this->error('Swap 2 service not configured', 503);
        }

        $roomId = $request['room_id'] ?? null;
        $playerId = $request['player_id'] ?? null;
        $choice = $request['choice'] ?? null;

        if (!$roomId || !$playerId || !$choice) {
            return $this->error('room_id, player_id, and choice are required', 400);
        }

        // Validate choice value
        $validChoices = ['black', 'white', 'place_more'];
        if (!in_array($choice, $validChoices, true)) {
            return $this->error("Invalid choice. Must be one of: " . implode(', ', $validChoices), 400);
        }

        try {
            // Validate choice first
            $validation = $this->swap2Manager->validateChoice($roomId, $playerId, $choice);
            if (!$validation->isValid()) {
                return $this->error($validation->getMessage(), 400, [
                    'code' => $validation->getCode(),
                    'details' => $validation->getDetails()
                ]);
            }

            // Make the choice
            $state = $this->swap2Manager->makeChoice($roomId, $playerId, $choice);
            
            $response = [
                'success' => true,
                'swap2State' => $state->jsonSerialize(),
                'choice' => $choice,
                'phase' => $state->getPhase()
            ];

            // Add color assignments if complete
            if ($this->swap2Manager->isComplete($state)) {
                $assignment = $this->swap2Manager->getFinalAssignments($state);
                $response['colorAssignment'] = [
                    'blackPlayerId' => $assignment->getBlackPlayerId(),
                    'whitePlayerId' => $assignment->getWhitePlayerId(),
                    'firstMover' => $assignment->getBlackPlayerId()
                ];
            }

            return $response;
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), 500);
        }
    }

    /**
     * GET /api/swap2/state/{roomId}
     * 
     * Get current Swap 2 state for a game.
     */
    public function getState(string $roomId): array
    {
        if ($this->swap2Manager === null) {
            return $this->error('Swap 2 service not configured', 503);
        }

        $state = $this->swap2Manager->getState($roomId);
        
        if ($state === null) {
            return $this->error('Swap 2 state not found for room', 404);
        }

        return [
            'success' => true,
            'swap2State' => $state->jsonSerialize(),
            'isComplete' => $this->swap2Manager->isComplete($state)
        ];
    }

    /**
     * Helper to create error response.
     */
    private function error(string $message, int $status, array $extra = []): array
    {
        return array_merge([
            'success' => false,
            'error' => $message,
            'status' => $status
        ], $extra);
    }
}
