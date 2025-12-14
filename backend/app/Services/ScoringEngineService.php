<?php

namespace App\Services;

use InvalidArgumentException;
use RuntimeException;

/**
 * ScoringEngineService
 * 
 * Calculates and applies rewards for completed ranked series.
 * 
 * Requirements: 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2, 6.3, 6.4
 */
class ScoringEngineService implements ScoringEngineServiceInterface
{
    // MP Constants (Requirements 4.1, 4.2, 4.3, 4.4, 4.5)
    private const BASE_WIN_MP = 20;
    private const SWEEP_BONUS = 10;
    private const TIME_BONUS = 5;
    private const RANK_DIFF_UP_MULT = 5;
    private const RANK_DIFF_DOWN_MULT = 3;
    private const MIN_WIN_MP = 5;
    private const MAX_WIN_MP = 50;
    private const LOSS_PENALTY = -15;
    private const ABANDON_PENALTY = -25;

    // Coin Constants (Requirements 6.2, 6.3)
    private const WINNER_COINS_BASE = 50;
    private const WINNER_COINS_PER_GAME = 10;
    private const LOSER_COINS_FIXED = 20;

    // EXP Constants (Requirements 6.4)
    private const WINNER_EXP = 100;
    private const LOSER_EXP = 40;

    // Rank thresholds for MP to rank conversion
    private const RANK_THRESHOLDS = [
        'truyen_thuyet' => 5500,
        'ky_thanh' => 3000,
        'cao_ky' => 1500,
        'ky_lao' => 600,
        'hoc_ky' => 200,
        'tan_ky' => 50,
        'vo_danh' => 0,
    ];

    // Rank numeric values for comparison
    private const RANK_VALUES = [
        'vo_danh' => 0,
        'tan_ky' => 1,
        'hoc_ky' => 2,
        'ky_lao' => 3,
        'cao_ky' => 4,
        'ky_thanh' => 5,
        'truyen_thuyet' => 6,
    ];

    private ?\PDO $db = null;
    private $profileUpdater = null;


    public function __construct() {}

    /**
     * Set database connection for profile updates.
     */
    public function setDatabase(\PDO $db): self
    {
        $this->db = $db;
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
     * Calculate Mindpoint change for the winner.
     * 
     * Formula: base (20) + sweep_bonus + time_bonus + rank_diff_modifier
     * Range: [5, 50]
     * 
     * Requirements: 3.3, 4.1, 4.2, 4.3, 4.4, 4.5
     */
    public function calculateWinnerMP(array $series): int
    {
        $this->validateSeriesForScoring($series);

        $winnerId = $series['winner_id'];
        $isPlayer1Winner = $winnerId === $series['player1_id'];

        // Start with base MP (Req 4.1)
        $mp = self::BASE_WIN_MP;

        // Sweep bonus: +10 if 2-0 (Req 4.2)
        $winnerWins = $isPlayer1Winner 
            ? (int)$series['player1_wins'] 
            : (int)$series['player2_wins'];
        $loserWins = $isPlayer1Winner 
            ? (int)$series['player2_wins'] 
            : (int)$series['player1_wins'];

        if ($winnerWins === 2 && $loserWins === 0) {
            $mp += self::SWEEP_BONUS;
        }

        // Time bonus: +5 if winner had faster average move time (Req 4.3)
        // This requires game data which may not be available in series
        // For now, we check if winner_avg_move_time < loser_avg_move_time
        if (isset($series['winner_avg_move_time']) && isset($series['loser_avg_move_time'])) {
            if ($series['winner_avg_move_time'] < $series['loser_avg_move_time']) {
                $mp += self::TIME_BONUS;
            }
        }

        // Rank difference modifier (Req 4.4, 4.5)
        $winnerRank = $isPlayer1Winner 
            ? $series['player1_initial_rank'] 
            : $series['player2_initial_rank'];
        $loserRank = $isPlayer1Winner 
            ? $series['player2_initial_rank'] 
            : $series['player1_initial_rank'];

        $rankDiff = $this->getRankDifference($winnerRank, $loserRank);

        if ($rankDiff > 0) {
            // Winner beat higher-ranked opponent: +5 per rank difference (Req 4.4)
            $mp += $rankDiff * self::RANK_DIFF_UP_MULT;
        } elseif ($rankDiff < 0) {
            // Winner beat lower-ranked opponent: -3 per rank difference (Req 4.5)
            $mp += $rankDiff * self::RANK_DIFF_DOWN_MULT; // rankDiff is negative, so this subtracts
        }

        // Apply min/max bounds (Req 3.3, 4.5)
        $mp = max(self::MIN_WIN_MP, min(self::MAX_WIN_MP, $mp));

        return $mp;
    }

    /**
     * Calculate Mindpoint change for the loser.
     * 
     * - Normal loss: -15 MP (fixed)
     * - Abandoned: -25 MP
     * 
     * Requirements: 3.4, 7.5
     */
    public function calculateLoserMP(array $series): int
    {
        $this->validateSeriesForScoring($series);

        // Check if series was abandoned (Req 7.5)
        if (isset($series['status']) && $series['status'] === 'abandoned') {
            return self::ABANDON_PENALTY;
        }

        // Normal loss penalty (Req 3.4)
        return self::LOSS_PENALTY;
    }

    /**
     * Calculate coins reward for a player.
     * 
     * - Winner: 50 base + 10 per game won
     * - Loser: 20 fixed
     * 
     * Requirements: 6.2, 6.3
     */
    public function calculateCoins(string $playerId, array $series): int
    {
        $this->validateSeriesForScoring($series);

        $isWinner = $playerId === $series['winner_id'];

        if ($isWinner) {
            // Winner: 50 + 10 * games_won (Req 6.2)
            $isPlayer1 = $playerId === $series['player1_id'];
            $gamesWon = $isPlayer1 
                ? (int)$series['player1_wins'] 
                : (int)$series['player2_wins'];

            return self::WINNER_COINS_BASE + (self::WINNER_COINS_PER_GAME * $gamesWon);
        }

        // Loser: fixed 20 coins (Req 6.3)
        return self::LOSER_COINS_FIXED;
    }

    /**
     * Calculate EXP reward for a player.
     * 
     * - Winner: 100 EXP
     * - Loser: 40 EXP
     * 
     * Requirements: 6.4
     */
    public function calculateEXP(string $playerId, array $series): int
    {
        $this->validateSeriesForScoring($series);

        $isWinner = $playerId === $series['winner_id'];

        return $isWinner ? self::WINNER_EXP : self::LOSER_EXP;
    }

    /**
     * Calculate all rewards for a completed series.
     * 
     * Requirements: 3.2, 3.5, 6.1
     */
    public function calculateRewards(array $series): array
    {
        $this->validateSeriesForScoring($series);

        $winnerId = $series['winner_id'];
        $loserId = $winnerId === $series['player1_id'] 
            ? $series['player2_id'] 
            : $series['player1_id'];

        return [
            'winner' => [
                'mp' => $this->calculateWinnerMP($series),
                'coins' => $this->calculateCoins($winnerId, $series),
                'exp' => $this->calculateEXP($winnerId, $series),
            ],
            'loser' => [
                'mp' => $this->calculateLoserMP($series),
                'coins' => $this->calculateCoins($loserId, $series),
                'exp' => $this->calculateEXP($loserId, $series),
            ],
        ];
    }


    /**
     * Apply all rewards to player profiles.
     * 
     * Requirements: 3.5
     */
    public function applyRewards(array $series): array
    {
        $this->validateSeriesForScoring($series);

        $rewards = $this->calculateRewards($series);
        $winnerId = $series['winner_id'];
        $loserId = $winnerId === $series['player1_id'] 
            ? $series['player2_id'] 
            : $series['player1_id'];

        $rankChanges = [];

        // Apply winner rewards
        $winnerRankChange = $this->updatePlayerProfile(
            $winnerId,
            $rewards['winner']['mp'],
            $rewards['winner']['coins'],
            $rewards['winner']['exp']
        );
        if ($winnerRankChange !== null) {
            $rankChanges[] = $winnerRankChange;
        }

        // Apply loser rewards
        $loserRankChange = $this->updatePlayerProfile(
            $loserId,
            $rewards['loser']['mp'],
            $rewards['loser']['coins'],
            $rewards['loser']['exp']
        );
        if ($loserRankChange !== null) {
            $rankChanges[] = $loserRankChange;
        }

        return [
            'winnerId' => $winnerId,
            'loserId' => $loserId,
            'rewards' => $rewards,
            'rankChanges' => $rankChanges,
            'applied' => true,
        ];
    }

    /**
     * Update a player's profile with rewards.
     * 
     * @return array|null Rank change info if rank changed, null otherwise
     */
    private function updatePlayerProfile(
        string $playerId,
        int $mpChange,
        int $coins,
        int $exp
    ): ?array {
        if ($this->profileUpdater !== null) {
            return ($this->profileUpdater)($playerId, $mpChange, $coins, $exp);
        }

        if ($this->db === null) {
            return null;
        }

        try {
            // Get current profile
            $stmt = $this->db->prepare(
                'SELECT mindpoint, current_rank, coins, exp FROM profiles WHERE user_id = ?'
            );
            $stmt->execute([$playerId]);
            $profile = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$profile) {
                return null;
            }

            $oldMP = (int)$profile['mindpoint'];
            $oldRank = $profile['current_rank'];
            $oldCoins = (int)($profile['coins'] ?? 0);
            $oldExp = (int)($profile['exp'] ?? 0);

            // Calculate new values
            $newMP = max(0, $oldMP + $mpChange); // MP cannot go below 0
            $newRank = $this->getRankFromMP($newMP);
            $newCoins = $oldCoins + $coins;
            $newExp = $oldExp + $exp;

            // Update profile
            $stmt = $this->db->prepare(
                'UPDATE profiles SET mindpoint = ?, current_rank = ?, coins = ?, exp = ? WHERE user_id = ?'
            );
            $stmt->execute([$newMP, $newRank, $newCoins, $newExp, $playerId]);

            // Return rank change if rank changed
            if ($oldRank !== $newRank) {
                return [
                    'playerId' => $playerId,
                    'oldRank' => $oldRank,
                    'newRank' => $newRank,
                    'newMP' => $newMP,
                ];
            }

            return null;
        } catch (\Exception $e) {
            error_log("Failed to update profile for {$playerId}: " . $e->getMessage());
            throw new RuntimeException("Failed to update profile: " . $e->getMessage());
        }
    }

    /**
     * Get rank from MP value.
     */
    public function getRankFromMP(int $mp): string
    {
        foreach (self::RANK_THRESHOLDS as $rank => $threshold) {
            if ($mp >= $threshold) {
                return $rank;
            }
        }
        return 'vo_danh';
    }

    /**
     * Get rank difference (positive = opponent higher rank).
     */
    private function getRankDifference(string $playerRank, string $opponentRank): int
    {
        $playerValue = self::RANK_VALUES[$playerRank] ?? 0;
        $opponentValue = self::RANK_VALUES[$opponentRank] ?? 0;
        return $opponentValue - $playerValue;
    }

    /**
     * Validate series data has required fields for scoring.
     */
    private function validateSeriesForScoring(array $series): void
    {
        $requiredFields = [
            'winner_id',
            'player1_id',
            'player2_id',
            'player1_wins',
            'player2_wins',
            'player1_initial_rank',
            'player2_initial_rank',
        ];

        foreach ($requiredFields as $field) {
            if (!isset($series[$field])) {
                throw new InvalidArgumentException("Missing required field: {$field}");
            }
        }

        // Validate winner is one of the players
        if ($series['winner_id'] !== $series['player1_id'] && 
            $series['winner_id'] !== $series['player2_id']) {
            throw new InvalidArgumentException('Winner must be one of the players');
        }
    }
}
