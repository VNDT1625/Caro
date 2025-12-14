<?php

namespace App\Services;

use App\GameEngine;

/**
 * RuleEngineService
 * 
 * Implements rule-based detection of cheating patterns in match data.
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 */
class RuleEngineService implements RuleEngineServiceInterface
{
    /**
     * Minimum time between moves in milliseconds (100ms)
     */
    private int $minTimeBetweenMoves;

    /**
     * Maximum time between moves in milliseconds (5 minutes default)
     */
    private int $maxTimeBetweenMoves;

    public function __construct(
        int $minTimeBetweenMoves = 100,
        int $maxTimeBetweenMoves = 300000
    ) {
        $this->minTimeBetweenMoves = $minTimeBetweenMoves;
        $this->maxTimeBetweenMoves = $maxTimeBetweenMoves;
    }

    /**
     * {@inheritdoc}
     */
    public function analyzeMatch(string $matchId): RuleAnalysisResult
    {
        // TODO: Fetch match data from database
        // For now, return empty result - actual DB integration in later tasks
        return RuleAnalysisResult::noViolations();
    }

    /**
     * {@inheritdoc}
     * 
     * **Property 7: Multiple Moves Detection**
     * For any match move sequence where a player has consecutive moves 
     * without opponent's move in between, this SHALL detect and flag as violation.
     */
    public function checkMultipleMoves(array $moves): array
    {
        $violations = [];
        
        if (count($moves) < 2) {
            return $violations;
        }

        $lastPlayer = null;
        $consecutiveCount = 0;
        $consecutiveStartIndex = 0;

        foreach ($moves as $index => $move) {
            $currentPlayer = $move['player'] ?? null;
            
            if ($currentPlayer === null) {
                continue;
            }

            if ($currentPlayer === $lastPlayer) {
                $consecutiveCount++;
                
                // If this is the second consecutive move by same player, record violation
                if ($consecutiveCount === 1) {
                    $violations[] = [
                        'type' => RuleAnalysisResult::VIOLATION_MULTIPLE_MOVES,
                        'description' => "Người chơi {$currentPlayer} đã thực hiện nhiều nước đi liên tiếp",
                        'details' => [
                            'player' => $currentPlayer,
                            'start_index' => $consecutiveStartIndex,
                            'end_index' => $index,
                            'move_indices' => [$consecutiveStartIndex, $index],
                        ],
                    ];
                } else {
                    // Update the last violation with additional consecutive move
                    $lastViolationIndex = count($violations) - 1;
                    if ($lastViolationIndex >= 0) {
                        $violations[$lastViolationIndex]['details']['end_index'] = $index;
                        $violations[$lastViolationIndex]['details']['move_indices'][] = $index;
                    }
                }
            } else {
                $lastPlayer = $currentPlayer;
                $consecutiveCount = 0;
                $consecutiveStartIndex = $index;
            }
        }

        return $violations;
    }


    /**
     * {@inheritdoc}
     * 
     * **Property 8: Impossible Win Detection**
     * For any board state where both players have winning conditions (5 in a row),
     * this SHALL detect and flag as impossible.
     */
    public function checkImpossibleWins(array $boardState): array
    {
        $violations = [];
        
        if (empty($boardState)) {
            return $violations;
        }

        // Find all winning lines for each player
        $xWins = $this->findWinningLines($boardState, 'X');
        $oWins = $this->findWinningLines($boardState, 'O');

        // If both players have winning lines, it's impossible
        if (!empty($xWins) && !empty($oWins)) {
            $violations[] = [
                'type' => RuleAnalysisResult::VIOLATION_IMPOSSIBLE_WIN,
                'description' => 'Cả hai người chơi đều có điều kiện thắng - trạng thái bàn cờ không hợp lệ',
                'details' => [
                    'x_winning_lines' => $xWins,
                    'o_winning_lines' => $oWins,
                ],
            ];
        }

        return $violations;
    }

    /**
     * Find all winning lines (5 in a row) for a player.
     * 
     * @param array $boardState Board state
     * @param string $player 'X' or 'O'
     * @return array List of winning lines found
     */
    private function findWinningLines(array $boardState, string $player): array
    {
        $winningLines = [];
        $positions = [];

        // Build position set for the player
        foreach ($boardState as $key => $val) {
            if ($val !== $player) {
                continue;
            }
            $parts = explode('_', $key);
            if (count($parts) !== 2) {
                continue;
            }
            $positions[$key] = true;
        }

        $dirs = [
            [1, 0],  // horizontal
            [0, 1],  // vertical
            [1, 1],  // diagonal down-right
            [1, -1], // diagonal up-right
        ];

        $checked = [];

        foreach ($positions as $key => $_) {
            $parts = explode('_', $key);
            $x0 = intval($parts[0]);
            $y0 = intval($parts[1]);

            foreach ($dirs as $dirIndex => $d) {
                $dx = $d[0];
                $dy = $d[1];

                // Find the start of the line (go backward)
                $startX = $x0;
                $startY = $y0;
                while (isset($positions[($startX - $dx) . '_' . ($startY - $dy)])) {
                    $startX -= $dx;
                    $startY -= $dy;
                }

                // Create a unique key for this line direction from start
                $lineKey = "{$startX}_{$startY}_{$dirIndex}";
                if (isset($checked[$lineKey])) {
                    continue;
                }
                $checked[$lineKey] = true;

                // Count consecutive pieces from start
                $line = [];
                $cx = $startX;
                $cy = $startY;
                while (isset($positions["{$cx}_{$cy}"])) {
                    $line[] = "{$cx}_{$cy}";
                    $cx += $dx;
                    $cy += $dy;
                }

                if (count($line) >= 5) {
                    $winningLines[] = [
                        'start' => "{$startX}_{$startY}",
                        'direction' => $d,
                        'positions' => $line,
                        'length' => count($line),
                    ];
                }
            }
        }

        return $winningLines;
    }

    /**
     * {@inheritdoc}
     * 
     * **Property 9: Timing Anomaly Detection**
     * For any move sequence with timestamps, if consecutive moves have time 
     * difference less than 100ms or greater than configured timeout, 
     * this SHALL flag as anomaly.
     */
    public function checkTimingAnomalies(array $moves): array
    {
        $violations = [];
        
        if (count($moves) < 2) {
            return $violations;
        }

        $lastTimestamp = null;
        $lastIndex = null;

        foreach ($moves as $index => $move) {
            $timestamp = $move['timestamp'] ?? null;
            
            if ($timestamp === null) {
                continue;
            }

            // Convert to milliseconds if needed
            $timestampMs = is_numeric($timestamp) ? (int)$timestamp : strtotime($timestamp) * 1000;

            if ($lastTimestamp !== null) {
                $timeDiff = $timestampMs - $lastTimestamp;

                // Check for too fast moves
                if ($timeDiff < $this->minTimeBetweenMoves && $timeDiff >= 0) {
                    $violations[] = [
                        'type' => RuleAnalysisResult::VIOLATION_TIMING_ANOMALY,
                        'description' => "Nước đi quá nhanh ({$timeDiff}ms < {$this->minTimeBetweenMoves}ms)",
                        'details' => [
                            'anomaly_type' => 'too_fast',
                            'time_diff_ms' => $timeDiff,
                            'threshold_ms' => $this->minTimeBetweenMoves,
                            'move_index' => $index,
                            'previous_move_index' => $lastIndex,
                        ],
                    ];
                }

                // Check for too slow moves (timeout)
                if ($timeDiff > $this->maxTimeBetweenMoves) {
                    $violations[] = [
                        'type' => RuleAnalysisResult::VIOLATION_TIMING_ANOMALY,
                        'description' => "Nước đi quá chậm ({$timeDiff}ms > {$this->maxTimeBetweenMoves}ms)",
                        'details' => [
                            'anomaly_type' => 'too_slow',
                            'time_diff_ms' => $timeDiff,
                            'threshold_ms' => $this->maxTimeBetweenMoves,
                            'move_index' => $index,
                            'previous_move_index' => $lastIndex,
                        ],
                    ];
                }
            }

            $lastTimestamp = $timestampMs;
            $lastIndex = $index;
        }

        return $violations;
    }

    /**
     * {@inheritdoc}
     */
    public function generateReasonResult(array $violations): string
    {
        if (empty($violations)) {
            return 'Không phát hiện bất thường trong trận đấu.';
        }

        $descriptions = [];
        
        foreach ($violations as $violation) {
            $descriptions[] = $violation['description'] ?? 'Vi phạm không xác định';
        }

        return 'Phát hiện các bất thường: ' . implode('; ', $descriptions) . '.';
    }

    /**
     * Analyze match data and return complete analysis result.
     * 
     * @param array $matchData Match data including moves and board state
     * @return RuleAnalysisResult Complete analysis result
     */
    public function analyzeMatchData(array $matchData): RuleAnalysisResult
    {
        $moves = $matchData['moves'] ?? [];
        $boardState = $matchData['board_state'] ?? [];
        
        $allViolations = [];

        // Check for multiple moves
        $multipleMovesViolations = $this->checkMultipleMoves($moves);
        $allViolations = array_merge($allViolations, $multipleMovesViolations);

        // Check for impossible wins
        $impossibleWinViolations = $this->checkImpossibleWins($boardState);
        $allViolations = array_merge($allViolations, $impossibleWinViolations);

        // Check for timing anomalies
        $timingViolations = $this->checkTimingAnomalies($moves);
        $allViolations = array_merge($allViolations, $timingViolations);

        // Determine confidence based on violations
        $confidence = $this->calculateConfidence($allViolations);

        // Generate reason result
        $reasonResult = $this->generateReasonResult($allViolations);

        return new RuleAnalysisResult(
            hasViolations: !empty($allViolations),
            violations: $allViolations,
            confidence: $confidence,
            reasonResult: $reasonResult,
            metadata: [
                'total_moves' => count($moves),
                'board_positions' => count($boardState),
                'analysis_timestamp' => date('Y-m-d H:i:s'),
            ]
        );
    }

    /**
     * Calculate confidence level based on violations found.
     * 
     * @param array $violations List of violations
     * @return string Confidence level
     */
    private function calculateConfidence(array $violations): string
    {
        if (empty($violations)) {
            return RuleAnalysisResult::CONFIDENCE_HIGH;
        }

        $hasImpossibleWin = false;
        $hasMultipleMoves = false;
        $timingCount = 0;

        foreach ($violations as $violation) {
            $type = $violation['type'] ?? '';
            
            if ($type === RuleAnalysisResult::VIOLATION_IMPOSSIBLE_WIN) {
                $hasImpossibleWin = true;
            } elseif ($type === RuleAnalysisResult::VIOLATION_MULTIPLE_MOVES) {
                $hasMultipleMoves = true;
            } elseif ($type === RuleAnalysisResult::VIOLATION_TIMING_ANOMALY) {
                $timingCount++;
            }
        }

        // Impossible win or multiple moves = high confidence of cheating
        if ($hasImpossibleWin || $hasMultipleMoves) {
            return RuleAnalysisResult::CONFIDENCE_HIGH;
        }

        // Multiple timing anomalies = medium confidence
        if ($timingCount >= 3) {
            return RuleAnalysisResult::CONFIDENCE_MEDIUM;
        }

        // Few timing anomalies = low confidence
        return RuleAnalysisResult::CONFIDENCE_LOW;
    }
}
