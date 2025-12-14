<?php

namespace App\Services;

/**
 * ScoringEngineServiceInterface
 * 
 * Interface for calculating rewards after a ranked series completes.
 * Handles Mindpoint, coins, and EXP calculations.
 * 
 * Requirements: 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2, 6.3, 6.4
 */
interface ScoringEngineServiceInterface
{
    /**
     * Calculate Mindpoint change for the winner.
     * 
     * Formula: base (20) + sweep_bonus (10 if 2-0) + time_bonus (5 if faster) + rank_diff_modifier
     * - If winner beat higher rank: +5 per rank difference
     * - If winner beat lower rank: -3 per rank difference (minimum 5 total)
     * Range: [5, 50]
     * 
     * Requirements: 3.3, 4.1, 4.2, 4.3, 4.4, 4.5
     * 
     * @param array $series Completed series data
     * @return int MP change for winner (positive, 5-50)
     */
    public function calculateWinnerMP(array $series): int;

    /**
     * Calculate Mindpoint change for the loser.
     * 
     * - Normal loss: -15 MP (fixed)
     * - Abandoned: -25 MP (-15 standard + -10 abandon penalty)
     * 
     * Requirements: 3.4, 7.5
     * 
     * @param array $series Completed series data
     * @return int MP change for loser (negative)
     */
    public function calculateLoserMP(array $series): int;

    /**
     * Calculate coins reward for a player.
     * 
     * - Winner: 50 base + 10 per game won (70 for 2-0, 70 for 2-1)
     * - Loser: 20 fixed
     * 
     * Requirements: 6.2, 6.3
     * 
     * @param string $playerId UUID of the player
     * @param array $series Completed series data
     * @return int Coins earned
     */
    public function calculateCoins(string $playerId, array $series): int;

    /**
     * Calculate EXP reward for a player.
     * 
     * - Winner: 100 EXP
     * - Loser: 40 EXP
     * 
     * Requirements: 6.4
     * 
     * @param string $playerId UUID of the player
     * @param array $series Completed series data
     * @return int EXP earned
     */
    public function calculateEXP(string $playerId, array $series): int;

    /**
     * Calculate all rewards for a completed series.
     * 
     * Returns rewards for both winner and loser including MP, coins, and EXP.
     * 
     * Requirements: 3.2, 3.5, 6.1
     * 
     * @param array $series Completed series data
     * @return array Rewards structure with 'winner' and 'loser' keys
     */
    public function calculateRewards(array $series): array;

    /**
     * Apply all rewards to player profiles.
     * 
     * Updates both players' profiles with MP, coins, and EXP changes.
     * 
     * Requirements: 3.5
     * 
     * @param array $series Completed series data
     * @return array Result with applied rewards and any rank changes
     */
    public function applyRewards(array $series): array;
}
