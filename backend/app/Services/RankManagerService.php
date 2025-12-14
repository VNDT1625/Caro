<?php

namespace App\Services;

use InvalidArgumentException;
use RuntimeException;

/**
 * RankManagerService
 * 
 * Manages player ranks and Mindpoint updates.
 * Handles rank threshold checks and rank history recording.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
class RankManagerService implements RankManagerServiceInterface
{
    /**
     * Rank thresholds - MP required to reach each rank
     * Requirements: 5.1
     */
    private const RANK_THRESHOLDS = [
        'truyen_thuyet' => 5500,
        'ky_thanh' => 3000,
        'cao_ky' => 1500,
        'ky_lao' => 600,
        'hoc_ky' => 200,
        'tan_ky' => 50,
        'vo_danh' => 0,
    ];

    /**
     * Valid rank names for validation
     */
    private const VALID_RANKS = [
        'vo_danh',
        'tan_ky',
        'hoc_ky',
        'ky_lao',
        'cao_ky',
        'ky_thanh',
        'truyen_thuyet',
    ];

    private ?\PDO $db = null;
    private $profileFetcher = null;
    private $profileUpdater = null;
    private $historyRecorder = null;

    public function __construct() {}

    /**
     * Set database connection.
     */
    public function setDatabase(\PDO $db): self
    {
        $this->db = $db;
        return $this;
    }


    /**
     * Set custom profile fetcher callback for testing.
     */
    public function setProfileFetcher(callable $fetcher): self
    {
        $this->profileFetcher = $fetcher;
        return $this;
    }

    /**
     * Set custom profile updater callback for testing.
     */
    public function setProfileUpdater(callable $updater): self
    {
        $this->profileUpdater = $updater;
        return $this;
    }

    /**
     * Set custom history recorder callback for testing.
     */
    public function setHistoryRecorder(callable $recorder): self
    {
        $this->historyRecorder = $recorder;
        return $this;
    }

    /**
     * Update a player's Mindpoint and check for rank changes.
     * 
     * Requirements: 5.1, 5.2, 5.3, 5.5
     */
    public function updateMindpoint(string $playerId, int $mpChange, string $reason = ''): array
    {
        if (empty($playerId)) {
            throw new InvalidArgumentException('Player ID cannot be empty');
        }

        // Get current player info
        $playerInfo = $this->getPlayerRankInfo($playerId);
        if ($playerInfo === null) {
            throw new InvalidArgumentException("Player not found: {$playerId}");
        }

        $oldMP = (int)$playerInfo['mindpoint'];
        $oldRank = $playerInfo['current_rank'];

        // Calculate new MP (cannot go below 0)
        $newMP = max(0, $oldMP + $mpChange);

        // Determine new rank based on new MP (Req 5.1)
        $newRank = $this->getRankFromMP($newMP);

        // Check if rank changed
        $rankChanged = $oldRank !== $newRank;

        // Update profile
        $this->updatePlayerProfile($playerId, $newMP, $newRank);

        // Record rank change if it occurred (Req 5.4)
        if ($rankChanged) {
            $this->recordRankChange($playerId, $oldRank, $newRank, $newMP, $reason);
        }

        return [
            'playerId' => $playerId,
            'oldMP' => $oldMP,
            'newMP' => $newMP,
            'mpChange' => $mpChange,
            'oldRank' => $oldRank,
            'newRank' => $newRank,
            'rankChanged' => $rankChanged,
            'rankUp' => $rankChanged && $this->isRankHigher($newRank, $oldRank),
            'rankDown' => $rankChanged && $this->isRankHigher($oldRank, $newRank),
        ];
    }

    /**
     * Get the rank corresponding to a Mindpoint value.
     * 
     * Requirements: 5.1
     */
    public function getRankFromMP(int $mindpoint): string
    {
        // Iterate through thresholds from highest to lowest
        foreach (self::RANK_THRESHOLDS as $rank => $threshold) {
            if ($mindpoint >= $threshold) {
                return $rank;
            }
        }
        return 'vo_danh';
    }

    /**
     * Record a rank change in the rank_history table.
     * 
     * Requirements: 5.4
     */
    public function recordRankChange(
        string $playerId,
        string $oldRank,
        string $newRank,
        int $mindpoint,
        string $reason = ''
    ): bool {
        if (empty($playerId)) {
            throw new InvalidArgumentException('Player ID cannot be empty');
        }

        if (!$this->isValidRank($oldRank)) {
            throw new InvalidArgumentException("Invalid old rank: {$oldRank}");
        }

        if (!$this->isValidRank($newRank)) {
            throw new InvalidArgumentException("Invalid new rank: {$newRank}");
        }

        // Use custom recorder if set (for testing)
        if ($this->historyRecorder !== null) {
            return ($this->historyRecorder)($playerId, $oldRank, $newRank, $mindpoint, $reason);
        }

        if ($this->db === null) {
            return false;
        }

        try {
            $stmt = $this->db->prepare(
                'INSERT INTO rank_history (user_id, old_rank, new_rank, mindpoint, reason, created_at) 
                 VALUES (?, ?, ?, ?, ?, NOW())'
            );
            $stmt->execute([$playerId, $oldRank, $newRank, $mindpoint, $reason ?: null]);
            return true;
        } catch (\Exception $e) {
            error_log("Failed to record rank change for {$playerId}: " . $e->getMessage());
            return false;
        }
    }


    /**
     * Get a player's current rank and MP.
     */
    public function getPlayerRankInfo(string $playerId): ?array
    {
        if (empty($playerId)) {
            return null;
        }

        // Use custom fetcher if set (for testing)
        if ($this->profileFetcher !== null) {
            return ($this->profileFetcher)($playerId);
        }

        if ($this->db === null) {
            return null;
        }

        try {
            $stmt = $this->db->prepare(
                'SELECT user_id, mindpoint, current_rank FROM profiles WHERE user_id = ?'
            );
            $stmt->execute([$playerId]);
            $result = $stmt->fetch(\PDO::FETCH_ASSOC);
            return $result ?: null;
        } catch (\Exception $e) {
            error_log("Failed to get player rank info for {$playerId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Get rank history for a player.
     */
    public function getRankHistory(string $playerId, int $limit = 10): array
    {
        if (empty($playerId)) {
            return [];
        }

        if ($this->db === null) {
            return [];
        }

        try {
            $stmt = $this->db->prepare(
                'SELECT id, user_id, old_rank, new_rank, mindpoint, reason, created_at 
                 FROM rank_history 
                 WHERE user_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT ?'
            );
            $stmt->execute([$playerId, $limit]);
            return $stmt->fetchAll(\PDO::FETCH_ASSOC);
        } catch (\Exception $e) {
            error_log("Failed to get rank history for {$playerId}: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Update player profile with new MP and rank.
     */
    private function updatePlayerProfile(string $playerId, int $newMP, string $newRank): bool
    {
        // Use custom updater if set (for testing)
        if ($this->profileUpdater !== null) {
            return ($this->profileUpdater)($playerId, $newMP, $newRank);
        }

        if ($this->db === null) {
            return false;
        }

        try {
            $stmt = $this->db->prepare(
                'UPDATE profiles SET mindpoint = ?, current_rank = ?, updated_at = NOW() WHERE user_id = ?'
            );
            $stmt->execute([$newMP, $newRank, $playerId]);
            return $stmt->rowCount() > 0;
        } catch (\Exception $e) {
            error_log("Failed to update profile for {$playerId}: " . $e->getMessage());
            throw new RuntimeException("Failed to update profile: " . $e->getMessage());
        }
    }

    /**
     * Check if a rank is valid.
     */
    private function isValidRank(string $rank): bool
    {
        return in_array($rank, self::VALID_RANKS, true);
    }

    /**
     * Check if rank1 is higher than rank2.
     */
    private function isRankHigher(string $rank1, string $rank2): bool
    {
        $index1 = array_search($rank1, self::VALID_RANKS, true);
        $index2 = array_search($rank2, self::VALID_RANKS, true);
        
        if ($index1 === false || $index2 === false) {
            return false;
        }
        
        return $index1 > $index2;
    }

    /**
     * Get all rank thresholds.
     */
    public function getRankThresholds(): array
    {
        return self::RANK_THRESHOLDS;
    }

    /**
     * Get MP needed for next rank.
     * 
     * @param string $currentRank Current rank
     * @return int|null MP needed for next rank, or null if already max rank
     */
    public function getMPForNextRank(string $currentRank): ?int
    {
        $currentIndex = array_search($currentRank, self::VALID_RANKS, true);
        if ($currentIndex === false) {
            return null;
        }

        // Already at max rank
        if ($currentIndex === count(self::VALID_RANKS) - 1) {
            return null;
        }

        $nextRank = self::VALID_RANKS[$currentIndex + 1];
        return self::RANK_THRESHOLDS[$nextRank] ?? null;
    }
}
