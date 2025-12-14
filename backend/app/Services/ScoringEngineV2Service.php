<?php

namespace App\Services;

/**
 * ScoringEngineV2Service
 * 
 * Tính điểm theo hệ thống Rank V2:
 * - Giai đoạn dưới: (Lượt + Thời gian + Rank + 5) × Kết quả
 * - Giai đoạn cao: (Lượt + Thời gian + 5) × Hệ số rank
 */
class ScoringEngineV2Service implements ScoringEngineServiceInterface
{
    private RankSystemV2Service $rankSystem;
    private ?\PDO $db = null;

    public function __construct(?RankSystemV2Service $rankSystem = null)
    {
        $this->rankSystem = $rankSystem ?? new RankSystemV2Service();
    }

    public function setDatabase(\PDO $db): self
    {
        $this->db = $db;
        return $this;
    }

    /**
     * Tính điểm cho winner trong series.
     */
    public function calculateWinnerMP(array $series): int
    {
        $winnerId = $series['winner_id'];
        $isPlayer1Winner = $winnerId === $series['player1_id'];

        $playerRank = $isPlayer1Winner 
            ? $series['player1_initial_rank'] 
            : $series['player2_initial_rank'];
        $opponentRank = $isPlayer1Winner 
            ? $series['player2_initial_rank'] 
            : $series['player1_initial_rank'];

        // Lấy thông tin từ games trong series
        $totalMoves = $series['total_moves'] ?? 30;
        $playerTime = $series['winner_total_time'] ?? 100;
        $opponentTime = $series['loser_total_time'] ?? 100;

        $result = $this->rankSystem->calculateMatchPoints([
            'player_rank' => $playerRank,
            'opponent_rank' => $opponentRank,
            'total_moves' => $totalMoves,
            'player_time' => $playerTime,
            'opponent_time' => $opponentTime,
            'is_win' => true,
        ]);

        // Bonus cho sweep (2-0)
        $winnerWins = $isPlayer1Winner 
            ? (int)$series['player1_wins'] 
            : (int)$series['player2_wins'];
        $loserWins = $isPlayer1Winner 
            ? (int)$series['player2_wins'] 
            : (int)$series['player1_wins'];

        $sweepBonus = ($winnerWins === 2 && $loserWins === 0) ? 5 : 0;

        return $result['points'] + $sweepBonus;
    }

    /**
     * Tính điểm cho loser trong series.
     */
    public function calculateLoserMP(array $series): int
    {
        $winnerId = $series['winner_id'];
        $isPlayer1Loser = $winnerId !== $series['player1_id'];

        $playerRank = $isPlayer1Loser 
            ? $series['player1_initial_rank'] 
            : $series['player2_initial_rank'];
        $opponentRank = $isPlayer1Loser 
            ? $series['player2_initial_rank'] 
            : $series['player1_initial_rank'];

        // Check abandon
        if (isset($series['status']) && $series['status'] === 'abandoned') {
            // Abandon penalty: -35 (max penalty)
            return -35;
        }

        $totalMoves = $series['total_moves'] ?? 30;
        $playerTime = $series['loser_total_time'] ?? 100;
        $opponentTime = $series['winner_total_time'] ?? 100;

        $result = $this->rankSystem->calculateMatchPoints([
            'player_rank' => $playerRank,
            'opponent_rank' => $opponentRank,
            'total_moves' => $totalMoves,
            'player_time' => $playerTime,
            'opponent_time' => $opponentTime,
            'is_win' => false,
        ]);

        return $result['points'];
    }

    /**
     * Tính coins reward.
     * Winner: 50 + 10 × games_won
     * Loser: 20
     */
    public function calculateCoins(string $playerId, array $series): int
    {
        $isWinner = $playerId === $series['winner_id'];

        if ($isWinner) {
            $isPlayer1 = $playerId === $series['player1_id'];
            $gamesWon = $isPlayer1 
                ? (int)$series['player1_wins'] 
                : (int)$series['player2_wins'];
            return 50 + (10 * $gamesWon);
        }

        return 20;
    }

    /**
     * Tính EXP reward.
     * Winner: 100
     * Loser: 40
     */
    public function calculateEXP(string $playerId, array $series): int
    {
        return $playerId === $series['winner_id'] ? 100 : 40;
    }

    /**
     * Tính tất cả rewards.
     */
    public function calculateRewards(array $series): array
    {
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
     * Apply rewards và cập nhật rank.
     */
    public function applyRewards(array $series): array
    {
        $rewards = $this->calculateRewards($series);
        $winnerId = $series['winner_id'];
        $loserId = $winnerId === $series['player1_id'] 
            ? $series['player2_id'] 
            : $series['player1_id'];

        $rankChanges = [];

        // Apply winner rewards
        $winnerChange = $this->applyPlayerRewards(
            $winnerId,
            $rewards['winner']['mp'],
            $rewards['winner']['coins'],
            $rewards['winner']['exp']
        );
        if ($winnerChange) {
            $rankChanges[] = $winnerChange;
        }

        // Apply loser rewards
        $loserChange = $this->applyPlayerRewards(
            $loserId,
            $rewards['loser']['mp'],
            $rewards['loser']['coins'],
            $rewards['loser']['exp']
        );
        if ($loserChange) {
            $rankChanges[] = $loserChange;
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
     * Apply rewards cho một player.
     */
    private function applyPlayerRewards(
        string $playerId,
        int $mpChange,
        int $coins,
        int $exp
    ): ?array {
        if ($this->db === null) {
            return null;
        }

        try {
            // Get current profile
            $stmt = $this->db->prepare(
                'SELECT mindpoint, current_rank, rank_tier, rank_level, coins, exp, season_matches 
                 FROM profiles WHERE user_id = ?'
            );
            $stmt->execute([$playerId]);
            $profile = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$profile) {
                return null;
            }

            $oldMP = (int)$profile['mindpoint'];
            $oldRank = $profile['current_rank'];
            $oldTier = $profile['rank_tier'] ?? 'so_ky';
            $oldLevel = (int)($profile['rank_level'] ?? 1);

            // Calculate new rank
            $newRankInfo = $this->rankSystem->calculateNewRank($oldMP, $mpChange);
            $newMP = $newRankInfo['total_points'];
            $newRank = $newRankInfo['rank'];
            $newTier = $newRankInfo['tier'];
            $newLevel = $newRankInfo['level'];

            // Update profile
            $stmt = $this->db->prepare(
                'UPDATE profiles SET 
                    mindpoint = ?, 
                    current_rank = ?, 
                    rank_tier = ?,
                    rank_level = ?,
                    coins = coins + ?, 
                    exp = exp + ?,
                    season_matches = season_matches + 1,
                    updated_at = NOW()
                 WHERE user_id = ?'
            );
            $stmt->execute([
                $newMP, 
                $newRank, 
                $newTier,
                $newLevel,
                $coins, 
                $exp, 
                $playerId
            ]);

            // Check rank change
            $rankChanged = $oldRank !== $newRank || $oldTier !== $newTier || $oldLevel !== $newLevel;

            if ($rankChanged) {
                // Record rank history
                $this->recordRankChange($playerId, $oldRank, $oldTier, $oldLevel, $newRank, $newTier, $newLevel, $newMP);

                return [
                    'playerId' => $playerId,
                    'oldRank' => $this->rankSystem->formatRankDisplay($oldRank, $oldTier, $oldLevel),
                    'newRank' => $this->rankSystem->formatRankDisplay($newRank, $newTier, $newLevel),
                    'oldMP' => $oldMP,
                    'newMP' => $newMP,
                    'mpChange' => $mpChange,
                    'rankUp' => $newMP > $oldMP,
                ];
            }

            return null;
        } catch (\Exception $e) {
            error_log("Failed to apply rewards for {$playerId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Record rank change to history.
     */
    private function recordRankChange(
        string $playerId,
        string $oldRank,
        string $oldTier,
        int $oldLevel,
        string $newRank,
        string $newTier,
        int $newLevel,
        int $newMP
    ): void {
        if ($this->db === null) {
            return;
        }

        try {
            $stmt = $this->db->prepare(
                'INSERT INTO rank_history (user_id, old_rank, new_rank, mindpoint, reason, created_at) 
                 VALUES (?, ?, ?, ?, ?, NOW())'
            );
            
            $oldDisplay = $this->rankSystem->formatRankDisplay($oldRank, $oldTier, $oldLevel);
            $newDisplay = $this->rankSystem->formatRankDisplay($newRank, $newTier, $newLevel);
            
            $stmt->execute([
                $playerId,
                $oldDisplay,
                $newDisplay,
                $newMP,
                'Series completed'
            ]);
        } catch (\Exception $e) {
            error_log("Failed to record rank change: " . $e->getMessage());
        }
    }

    /**
     * Get rank from MP (compatibility method).
     */
    public function getRankFromMP(int $mp): string
    {
        $rankInfo = $this->rankSystem->getRankFromPoints($mp);
        return $rankInfo['rank'];
    }
}
