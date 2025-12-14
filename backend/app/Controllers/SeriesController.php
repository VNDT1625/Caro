<?php

namespace App\Controllers;

use App\Services\SeriesManagerServiceInterface;
use InvalidArgumentException;
use RuntimeException;

/**
 * SeriesController
 * 
 * Handles HTTP requests for the Ranked BO3 Series system.
 * Provides endpoints for creating, viewing, and managing series.
 * 
 * **Validates: Requirements 1.1, 2.1, 7.4, 10.1, 10.2**
 */
class SeriesController
{
    private SeriesManagerServiceInterface $seriesManager;
    
    /** @var array<string, array{playerId: string, timestamp: int}> Rematch requests by seriesId */
    private static array $rematchRequests = [];
    
    private const REMATCH_TIMEOUT_SECONDS = 15;

    /**
     * Create a new SeriesController instance.
     * 
     * @param SeriesManagerServiceInterface $seriesManager Service for series operations
     */
    public function __construct(SeriesManagerServiceInterface $seriesManager)
    {
        $this->seriesManager = $seriesManager;
    }

    /**
     * POST /api/series/create - Create a new ranked series
     * 
     * Creates a new BO3 series between two matched players.
     * Called from matchmaking when two players are matched in ranked mode.
     * 
     * Request body:
     * - player1_id: string (required) - UUID of first player
     * - player2_id: string (required) - UUID of second player
     * 
     * **Validates: Requirements 1.1**
     * 
     * @param array $requestData Request body data
     * @return array Response with created series or error
     */
    public function create(array $requestData): array
    {
        try {
            // Validate required fields
            $validation = $this->validateCreateRequest($requestData);
            if (!$validation['valid']) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'Dữ liệu không hợp lệ',
                        'details' => $validation['errors'],
                    ],
                    'status' => 422,
                ];
            }

            // Create the series
            $series = $this->seriesManager->createSeries(
                $requestData['player1_id'],
                $requestData['player2_id']
            );

            return [
                'success' => true,
                'message' => 'Series đã được tạo',
                'data' => $this->formatSeriesResponse($series),
                'status' => 201,
            ];
        } catch (InvalidArgumentException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => $e->getMessage(),
                    'details' => [],
                ],
                'status' => 422,
            ];
        } catch (RuntimeException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể tạo series',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * GET /api/series/{id} - Get series state
     * 
     * Returns current state of a series including score, current game, and sides.
     * 
     * **Validates: Requirements 9.3**
     * 
     * @param string $seriesId UUID of the series
     * @return array Response with series state
     */
    public function show(string $seriesId): array
    {
        try {
            // Validate UUID format
            if (!$this->isValidUuid($seriesId)) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID series không hợp lệ',
                        'details' => [],
                    ],
                    'status' => 422,
                ];
            }

            $state = $this->seriesManager->getSeriesState($seriesId);

            if ($state === null) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'SERIES_NOT_FOUND',
                        'message' => 'Không tìm thấy series',
                        'details' => [],
                    ],
                    'status' => 404,
                ];
            }

            return [
                'success' => true,
                'data' => $this->formatSeriesStateResponse($state),
                'status' => 200,
            ];
        } catch (RuntimeException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể lấy thông tin series',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * POST /api/series/{id}/end-game - End a game within the series
     * 
     * Records the result of a game and updates series state.
     * Handles side swap if series continues.
     * 
     * Request body:
     * - match_id: string (required) - UUID of the completed match
     * - winner_id: string|null (required) - UUID of game winner (null for draw)
     * - duration: int (optional) - Game duration in seconds
     * 
     * **Validates: Requirements 2.1**
     * 
     * @param string $seriesId UUID of the series
     * @param array $requestData Request body data
     * @return array Response with updated series state
     */
    public function endGame(string $seriesId, array $requestData): array
    {
        try {
            // Validate UUID format
            if (!$this->isValidUuid($seriesId)) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID series không hợp lệ',
                        'details' => [],
                    ],
                    'status' => 422,
                ];
            }

            // Validate request data
            $validation = $this->validateEndGameRequest($requestData);
            if (!$validation['valid']) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'Dữ liệu không hợp lệ',
                        'details' => $validation['errors'],
                    ],
                    'status' => 422,
                ];
            }

            $matchId = $requestData['match_id'];
            $winnerId = $requestData['winner_id'] ?? null;
            $duration = (int) ($requestData['duration'] ?? 0);

            $result = $this->seriesManager->endGame($seriesId, $matchId, $winnerId, $duration);

            $message = $result['isComplete'] 
                ? 'Series đã kết thúc' 
                : 'Game đã kết thúc, chuẩn bị game tiếp theo';

            return [
                'success' => true,
                'message' => $message,
                'data' => $this->formatSeriesStateResponse($result),
                'status' => 200,
            ];
        } catch (InvalidArgumentException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => $e->getMessage(),
                    'details' => [],
                ],
                'status' => 422,
            ];
        } catch (RuntimeException $e) {
            if (strpos($e->getMessage(), 'not found') !== false) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'SERIES_NOT_FOUND',
                        'message' => 'Không tìm thấy series',
                        'details' => [],
                    ],
                    'status' => 404,
                ];
            }

            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể cập nhật series',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * POST /api/series/{id}/forfeit - Forfeit current game
     * 
     * Player forfeits the current game (e.g., due to disconnect timeout).
     * Awards game to opponent and checks if series is complete.
     * 
     * Request body:
     * - player_id: string (required) - UUID of forfeiting player
     * 
     * **Validates: Requirements 7.3**
     * 
     * @param string $seriesId UUID of the series
     * @param array $requestData Request body data
     * @return array Response with updated series state
     */
    public function forfeit(string $seriesId, array $requestData): array
    {
        try {
            // Validate UUID format
            if (!$this->isValidUuid($seriesId)) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID series không hợp lệ',
                        'details' => [],
                    ],
                    'status' => 422,
                ];
            }

            // Validate player_id
            if (empty($requestData['player_id']) || !$this->isValidUuid($requestData['player_id'])) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID người chơi không hợp lệ',
                        'details' => ['player_id' => 'ID người chơi là bắt buộc và phải là UUID hợp lệ'],
                    ],
                    'status' => 422,
                ];
            }

            $result = $this->seriesManager->forfeitGame($seriesId, $requestData['player_id']);

            $message = $result['isComplete'] 
                ? 'Series đã kết thúc do forfeit' 
                : 'Game đã forfeit, chuẩn bị game tiếp theo';

            return [
                'success' => true,
                'message' => $message,
                'data' => $this->formatSeriesStateResponse($result),
                'status' => 200,
            ];
        } catch (InvalidArgumentException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => $e->getMessage(),
                    'details' => [],
                ],
                'status' => 422,
            ];
        } catch (RuntimeException $e) {
            if (strpos($e->getMessage(), 'not found') !== false) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'SERIES_NOT_FOUND',
                        'message' => 'Không tìm thấy series',
                        'details' => [],
                    ],
                    'status' => 404,
                ];
            }

            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể forfeit game',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * POST /api/series/{id}/abandon - Abandon entire series
     * 
     * Player abandons the entire series (clicks leave).
     * Immediately ends series with abandon penalty.
     * 
     * Request body:
     * - player_id: string (required) - UUID of abandoning player
     * 
     * **Validates: Requirements 7.4**
     * 
     * @param string $seriesId UUID of the series
     * @param array $requestData Request body data
     * @return array Response with series result
     */
    public function abandon(string $seriesId, array $requestData): array
    {
        try {
            // Validate UUID format
            if (!$this->isValidUuid($seriesId)) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID series không hợp lệ',
                        'details' => [],
                    ],
                    'status' => 422,
                ];
            }

            // Validate player_id
            if (empty($requestData['player_id']) || !$this->isValidUuid($requestData['player_id'])) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID người chơi không hợp lệ',
                        'details' => ['player_id' => 'ID người chơi là bắt buộc và phải là UUID hợp lệ'],
                    ],
                    'status' => 422,
                ];
            }

            $result = $this->seriesManager->abandonSeries($seriesId, $requestData['player_id']);

            return [
                'success' => true,
                'message' => 'Series đã bị hủy bỏ',
                'data' => [
                    'series' => $this->formatSeriesResponse($result['series']),
                    'winner_id' => $result['winnerId'],
                    'loser_id' => $result['loserId'],
                    'final_score' => $result['finalScore'],
                    'is_abandoned' => $result['isAbandoned'],
                    'abandon_penalty' => $result['abandonPenalty'],
                ],
                'status' => 200,
            ];
        } catch (InvalidArgumentException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => $e->getMessage(),
                    'details' => [],
                ],
                'status' => 422,
            ];
        } catch (RuntimeException $e) {
            if (strpos($e->getMessage(), 'not found') !== false) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'SERIES_NOT_FOUND',
                        'message' => 'Không tìm thấy series',
                        'details' => [],
                    ],
                    'status' => 404,
                ];
            }

            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể hủy bỏ series',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * POST /api/series/{id}/rematch - Request rematch
     * 
     * Player requests a rematch after series ends.
     * If both players request within timeout, creates new series.
     * 
     * Request body:
     * - player_id: string (required) - UUID of requesting player
     * 
     * **Validates: Requirements 10.1, 10.2**
     * 
     * @param string $seriesId UUID of the completed series
     * @param array $requestData Request body data
     * @return array Response with rematch status or new series
     */
    public function rematch(string $seriesId, array $requestData): array
    {
        try {
            // Validate UUID format
            if (!$this->isValidUuid($seriesId)) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID series không hợp lệ',
                        'details' => [],
                    ],
                    'status' => 422,
                ];
            }

            // Validate player_id
            if (empty($requestData['player_id']) || !$this->isValidUuid($requestData['player_id'])) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID người chơi không hợp lệ',
                        'details' => ['player_id' => 'ID người chơi là bắt buộc và phải là UUID hợp lệ'],
                    ],
                    'status' => 422,
                ];
            }

            // Get original series to verify player and get opponent
            $state = $this->seriesManager->getSeriesState($seriesId);
            if ($state === null) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'SERIES_NOT_FOUND',
                        'message' => 'Không tìm thấy series',
                        'details' => [],
                    ],
                    'status' => 404,
                ];
            }

            $series = $state['series'];
            $playerId = $requestData['player_id'];

            // Verify player is part of this series
            if ($playerId !== $series['player1_id'] && $playerId !== $series['player2_id']) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'Người chơi không thuộc series này',
                        'details' => [],
                    ],
                    'status' => 422,
                ];
            }

            // Verify series is completed
            if ($series['status'] !== 'completed' && $series['status'] !== 'abandoned') {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'INVALID_STATE',
                        'message' => 'Series chưa kết thúc',
                        'details' => [],
                    ],
                    'status' => 400,
                ];
            }

            $currentTime = time();
            $opponentId = $playerId === $series['player1_id'] 
                ? $series['player2_id'] 
                : $series['player1_id'];

            // Check if opponent already requested rematch
            if (isset(self::$rematchRequests[$seriesId])) {
                $existingRequest = self::$rematchRequests[$seriesId];
                
                // Check if request is from opponent and not expired
                if ($existingRequest['playerId'] === $opponentId) {
                    if ($currentTime - $existingRequest['timestamp'] <= self::REMATCH_TIMEOUT_SECONDS) {
                        // Both players want rematch - create new series
                        unset(self::$rematchRequests[$seriesId]);
                        
                        $newSeries = $this->seriesManager->createSeries(
                            $series['player1_id'],
                            $series['player2_id']
                        );

                        return [
                            'success' => true,
                            'message' => 'Rematch đã được tạo',
                            'data' => [
                                'rematch_accepted' => true,
                                'new_series' => $this->formatSeriesResponse($newSeries),
                            ],
                            'status' => 201,
                        ];
                    } else {
                        // Expired, remove old request
                        unset(self::$rematchRequests[$seriesId]);
                    }
                }
            }

            // Store this player's rematch request
            self::$rematchRequests[$seriesId] = [
                'playerId' => $playerId,
                'timestamp' => $currentTime,
            ];

            return [
                'success' => true,
                'message' => 'Đang chờ đối thủ chấp nhận rematch',
                'data' => [
                    'rematch_accepted' => false,
                    'waiting_for_opponent' => true,
                    'timeout_seconds' => self::REMATCH_TIMEOUT_SECONDS,
                ],
                'status' => 200,
            ];
        } catch (InvalidArgumentException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => $e->getMessage(),
                    'details' => [],
                ],
                'status' => 422,
            ];
        } catch (RuntimeException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể xử lý yêu cầu rematch',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * Validate create series request data.
     * 
     * @param array $data Request data
     * @return array Validation result ['valid' => bool, 'errors' => array]
     */
    private function validateCreateRequest(array $data): array
    {
        $errors = [];

        if (empty($data['player1_id'])) {
            $errors['player1_id'] = 'ID người chơi 1 là bắt buộc';
        } elseif (!$this->isValidUuid($data['player1_id'])) {
            $errors['player1_id'] = 'ID người chơi 1 không hợp lệ';
        }

        if (empty($data['player2_id'])) {
            $errors['player2_id'] = 'ID người chơi 2 là bắt buộc';
        } elseif (!$this->isValidUuid($data['player2_id'])) {
            $errors['player2_id'] = 'ID người chơi 2 không hợp lệ';
        }

        if (!empty($data['player1_id']) && !empty($data['player2_id']) 
            && $data['player1_id'] === $data['player2_id']) {
            $errors['player2_id'] = 'Hai người chơi phải khác nhau';
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Validate end game request data.
     * 
     * @param array $data Request data
     * @return array Validation result ['valid' => bool, 'errors' => array]
     */
    private function validateEndGameRequest(array $data): array
    {
        $errors = [];

        if (empty($data['match_id'])) {
            $errors['match_id'] = 'ID trận đấu là bắt buộc';
        } elseif (!$this->isValidUuid($data['match_id'])) {
            $errors['match_id'] = 'ID trận đấu không hợp lệ';
        }

        // winner_id can be null (for draw), but if provided must be valid UUID
        if (isset($data['winner_id']) && $data['winner_id'] !== null 
            && !$this->isValidUuid($data['winner_id'])) {
            $errors['winner_id'] = 'ID người thắng không hợp lệ';
        }

        if (isset($data['duration']) && (!is_numeric($data['duration']) || $data['duration'] < 0)) {
            $errors['duration'] = 'Thời gian trận đấu không hợp lệ';
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Format series for API response.
     * 
     * @param array $series The series data
     * @return array Formatted series data
     */
    private function formatSeriesResponse(array $series): array
    {
        return [
            'id' => $series['id'],
            'player1_id' => $series['player1_id'],
            'player2_id' => $series['player2_id'],
            'player1_initial_mp' => $series['player1_initial_mp'],
            'player2_initial_mp' => $series['player2_initial_mp'],
            'player1_initial_rank' => $series['player1_initial_rank'],
            'player2_initial_rank' => $series['player2_initial_rank'],
            'player1_wins' => (int) $series['player1_wins'],
            'player2_wins' => (int) $series['player2_wins'],
            'games_to_win' => (int) $series['games_to_win'],
            'current_game' => (int) $series['current_game'],
            'player1_side' => $series['player1_side'],
            'player2_side' => $series['player2_side'],
            'status' => $series['status'],
            'winner_id' => $series['winner_id'],
            'final_score' => $series['final_score'],
            'winner_mp_change' => $series['winner_mp_change'],
            'loser_mp_change' => $series['loser_mp_change'],
            'winner_coins' => $series['winner_coins'],
            'loser_coins' => $series['loser_coins'],
            'winner_exp' => $series['winner_exp'],
            'loser_exp' => $series['loser_exp'],
            'created_at' => $series['created_at'],
            'started_at' => $series['started_at'],
            'ended_at' => $series['ended_at'],
        ];
    }

    /**
     * Format series state for API response.
     * 
     * @param array $state The series state data
     * @return array Formatted series state data
     */
    private function formatSeriesStateResponse(array $state): array
    {
        return [
            'series' => $this->formatSeriesResponse($state['series']),
            'is_complete' => $state['isComplete'],
            'next_game_ready' => $state['nextGameReady'],
        ];
    }

    /**
     * Check if a string is a valid UUID.
     * 
     * @param string $uuid The string to check
     * @return bool True if valid UUID
     */
    private function isValidUuid(string $uuid): bool
    {
        return preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $uuid) === 1;
    }

    /**
     * POST /api/series/{id}/forfeit-disconnect - Forfeit due to disconnect
     * 
     * Handles automatic forfeit when a player disconnects from ranked game.
     * Awards winner +20 MP and deducts loser -20 MP.
     * 
     * Request body:
     * - disconnected_player_id: string (required) - UUID of disconnected player
     * - winner_id: string (required) - UUID of remaining player (winner)
     * - mp_change: int (optional) - MP change amount (default 20)
     * 
     * **Validates: Requirements 1.4, 1.5, 2.1, 2.2 (ranked-disconnect-auto-win)**
     * 
     * @param string $seriesId UUID of the series
     * @param array $requestData Request body data
     * @return array Response with forfeit result
     */
    public function forfeitDisconnect(string $seriesId, array $requestData): array
    {
        try {
            // Validate UUID format
            if (!$this->isValidUuid($seriesId)) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID series không hợp lệ',
                        'details' => [],
                    ],
                    'status' => 422,
                ];
            }

            // Validate disconnected_player_id
            if (empty($requestData['disconnected_player_id']) || !$this->isValidUuid($requestData['disconnected_player_id'])) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID người chơi disconnect không hợp lệ',
                        'details' => ['disconnected_player_id' => 'ID người chơi là bắt buộc và phải là UUID hợp lệ'],
                    ],
                    'status' => 422,
                ];
            }

            // Validate winner_id
            if (empty($requestData['winner_id']) || !$this->isValidUuid($requestData['winner_id'])) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID người thắng không hợp lệ',
                        'details' => ['winner_id' => 'ID người thắng là bắt buộc và phải là UUID hợp lệ'],
                    ],
                    'status' => 422,
                ];
            }

            $disconnectedPlayerId = $requestData['disconnected_player_id'];
            $winnerId = $requestData['winner_id'];
            $mpChange = (int) ($requestData['mp_change'] ?? 20);

            // Use forfeitGame from SeriesManager
            $result = $this->seriesManager->forfeitGame($seriesId, $disconnectedPlayerId);

            // Add disconnect-specific info
            $result['winner_mp_change'] = $mpChange;
            $result['loser_mp_change'] = -$mpChange;
            $result['forfeit_reason'] = 'disconnect';
            $result['disconnected_player_id'] = $disconnectedPlayerId;
            $result['winner_id'] = $winnerId;

            $message = $result['isComplete'] 
                ? 'Series đã kết thúc do đối thủ thoát' 
                : 'Game đã forfeit do disconnect, chuẩn bị game tiếp theo';

            return [
                'success' => true,
                'message' => $message,
                'data' => [
                    'series' => $this->formatSeriesResponse($result['series']),
                    'is_complete' => $result['isComplete'],
                    'series_complete' => $result['isComplete'],
                    'next_game_ready' => $result['nextGameReady'],
                    'winner_id' => $winnerId,
                    'loser_id' => $disconnectedPlayerId,
                    'winner_mp_change' => $mpChange,
                    'loser_mp_change' => -$mpChange,
                    'forfeit_reason' => 'disconnect',
                    'finalScore' => $result['series']['player1_wins'] . '-' . $result['series']['player2_wins'],
                ],
                'status' => 200,
            ];
        } catch (InvalidArgumentException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => $e->getMessage(),
                    'details' => [],
                ],
                'status' => 422,
            ];
        } catch (RuntimeException $e) {
            if (strpos($e->getMessage(), 'not found') !== false) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'SERIES_NOT_FOUND',
                        'message' => 'Không tìm thấy series',
                        'details' => [],
                    ],
                    'status' => 404,
                ];
            }

            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể xử lý forfeit disconnect',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * Clear rematch requests (for testing purposes).
     */
    public static function clearRematchRequests(): void
    {
        self::$rematchRequests = [];
    }

    /**
     * Set rematch request (for testing purposes).
     * 
     * @param string $seriesId Series ID
     * @param string $playerId Player ID
     * @param int $timestamp Timestamp
     */
    public static function setRematchRequest(string $seriesId, string $playerId, int $timestamp): void
    {
        self::$rematchRequests[$seriesId] = [
            'playerId' => $playerId,
            'timestamp' => $timestamp,
        ];
    }
}
