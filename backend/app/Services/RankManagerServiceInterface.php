<?php

namespace App\Services;

/**
 * RankManagerServiceInterface
 * 
 * Interface for managing player ranks and Mindpoint updates.
 * Handles rank threshold checks and rank history recording.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
interface RankManagerServiceInterface
{
    /**
     * Update a player's Mindpoint and check for rank changes.
     * 
     * - Updates the player's mindpoint value
     * - Checks if the new MP crosses a rank threshold
     * - If rank changes, records it in rank_history
     * 
     * Requirements: 5.1, 5.2, 5.3, 5.5
     * 
     * @param string $playerId UUID of the player
     * @param int $mpChange Amount to change MP (positive or negative)
     * @param string $reason Reason for the MP change (e.g., 'series_win', 'series_loss')
     * @return array Result with 'newMP', 'oldRank', 'newRank', 'rankChanged'
     */
    public function updateMindpoint(string $playerId, int $mpChange, string $reason = ''): array;

    /**
     * Get the rank corresponding to a Mindpoint value.
     * 
     * Rank thresholds:
     * - vo_danh: 0
     * - tan_ky: 50
     * - hoc_ky: 200
     * - ky_lao: 600
     * - cao_ky: 1500
     * - ky_thanh: 3000
     * - truyen_thuyet: 5500
     * 
     * Requirements: 5.1
     * 
     * @param int $mindpoint The MP value
     * @return string The rank name
     */
    public function getRankFromMP(int $mindpoint): string;

    /**
     * Record a rank change in the rank_history table.
     * 
     * Requirements: 5.4
     * 
     * @param string $playerId UUID of the player
     * @param string $oldRank Previous rank
     * @param string $newRank New rank
     * @param int $mindpoint Current MP value
     * @param string $reason Reason for the change
     * @return bool True if recorded successfully
     */
    public function recordRankChange(
        string $playerId,
        string $oldRank,
        string $newRank,
        int $mindpoint,
        string $reason = ''
    ): bool;

    /**
     * Get a player's current rank and MP.
     * 
     * @param string $playerId UUID of the player
     * @return array|null Player data with 'mindpoint' and 'current_rank', or null if not found
     */
    public function getPlayerRankInfo(string $playerId): ?array;

    /**
     * Get rank history for a player.
     * 
     * @param string $playerId UUID of the player
     * @param int $limit Maximum number of records to return
     * @return array List of rank history records
     */
    public function getRankHistory(string $playerId, int $limit = 10): array;
}
