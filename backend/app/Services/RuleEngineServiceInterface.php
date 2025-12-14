<?php

namespace App\Services;

/**
 * RuleEngineServiceInterface
 * 
 * Interface for rule-based detection of cheating patterns in match data.
 * Implements detection for:
 * - Multiple moves in a single turn
 * - Impossible win conditions (both players winning)
 * - Timing anomalies (moves too fast or too slow)
 */
interface RuleEngineServiceInterface
{
    /**
     * Analyze a match for rule violations.
     * 
     * @param string $matchId UUID of the match to analyze
     * @return RuleAnalysisResult Analysis results including violations and confidence
     */
    public function analyzeMatch(string $matchId): RuleAnalysisResult;

    /**
     * Check for multiple consecutive moves by the same player.
     * 
     * @param array $moves Array of moves with player and timestamp info
     * @return array List of violations found (empty if none)
     */
    public function checkMultipleMoves(array $moves): array;

    /**
     * Check for impossible win conditions (both players having 5 in a row).
     * 
     * @param array $boardState Board state as associative array "x_y" => "X"|"O"
     * @return array List of violations found (empty if none)
     */
    public function checkImpossibleWins(array $boardState): array;

    /**
     * Check for timing anomalies in move sequence.
     * 
     * @param array $moves Array of moves with timestamps
     * @return array List of violations found (empty if none)
     */
    public function checkTimingAnomalies(array $moves): array;

    /**
     * Generate human-readable description of violations.
     * 
     * @param array $violations List of violations to describe
     * @return string Human-readable description
     */
    public function generateReasonResult(array $violations): string;
}
