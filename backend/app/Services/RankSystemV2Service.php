<?php

namespace App\Services;

/**
 * RankSystemV2Service
 * 
 * Hệ thống Rank mới với:
 * - 8 bậc chính: Vô Danh → Tân Kỳ → Học Kỳ → Kỳ Lão → Cao Kỳ → Tam Kỳ → Đệ Nhị → Vô Đối
 * - Sub-ranks: Sơ Kỳ, Trung Kỳ, Cao Kỳ (mỗi cái có level 1-3)
 * - Công thức tính điểm động theo lượt và thời gian
 * - Decay system theo mùa
 */
class RankSystemV2Service
{
    // Các bậc rank chính (thứ tự từ thấp đến cao)
    public const RANKS = [
        'vo_danh' => 0,
        'tan_ky' => 1,
        'hoc_ky' => 2,
        'ky_lao' => 3,
        'cao_ky' => 4,
        'tam_ky' => 5,
        'de_nhi' => 6,
        'vo_doi' => 7,
    ];

    // Sub-ranks (tier)
    public const TIERS = [
        'so_ky' => 0,
        'trung_ky' => 1,
        'cao_ky' => 2,
        'vuot_cap' => 3, // Chỉ có ở Học Kỳ
    ];

    // Levels trong mỗi tier
    public const LEVELS = [1, 2, 3];

    // Điểm cần để lên 1 sub-rank
    public const POINTS_PER_SUBRANK = 100;

    // Giai đoạn dưới: Vô Danh → Học Kỳ Cao Kỳ 3
    public const LOW_PHASE_MAX_RANK = 'hoc_ky';
    public const LOW_PHASE_MAX_TIER = 'cao_ky';
    public const LOW_PHASE_MAX_LEVEL = 3;

    // Decay percentages theo rank
    public const DECAY_PERCENTAGES = [
        'vo_danh' => 0.00,
        'tan_ky' => 0.20,
        'hoc_ky' => 0.18,
        'ky_lao' => 0.15,
        'cao_ky' => 0.12,
        'tam_ky' => 0.10,
        'de_nhi' => 0.08,
        'vo_doi' => 0.05,
    ];

    // Activity multipliers
    public const ACTIVITY_MULTIPLIERS = [
        'active' => 0.0,      // >= 20 matches
        'moderate' => 0.5,    // 10-19 matches
        'low' => 1.0,         // 1-9 matches
        'inactive' => 1.5,    // 0 matches
    ];

    // Rank floors (điểm tối thiểu để giữ rank)
    public const RANK_FLOORS = [
        'vo_danh' => 0,
        'tan_ky' => 900,      // 9 sub-ranks × 100
        'hoc_ky' => 1800,     // 18 sub-ranks × 100
        'ky_lao' => 2800,     // Học Kỳ Vượt Cấp + buffer
        'cao_ky' => 4000,
        'tam_ky' => 5500,
        'de_nhi' => 7500,
        'vo_doi' => 10000,
    ];

    /**
     * Tính điểm cho một trận đấu.
     * 
     * @param array $matchData Dữ liệu trận đấu
     * @return array ['points' => int, 'breakdown' => array]
     */
    public function calculateMatchPoints(array $matchData): array
    {
        $playerRank = $matchData['player_rank'] ?? 'vo_danh';
        $opponentRank = $matchData['opponent_rank'] ?? 'vo_danh';
        $totalMoves = $matchData['total_moves'] ?? 20;
        $playerTime = $matchData['player_time'] ?? 100;
        $opponentTime = $matchData['opponent_time'] ?? 100;
        $isWin = $matchData['is_win'] ?? false;

        // Xác định giai đoạn
        $isLowPhase = $this->isLowPhase($playerRank);

        if ($isLowPhase) {
            return $this->calculateLowPhasePoints(
                $totalMoves,
                $playerTime,
                $opponentTime,
                $opponentRank,
                $isWin
            );
        } else {
            return $this->calculateHighPhasePoints(
                $totalMoves,
                $playerTime,
                $opponentTime,
                $playerRank,
                $opponentRank,
                $isWin
            );
        }
    }

    /**
     * Tính điểm giai đoạn dưới (Vô Danh → Học Kỳ Cao Kỳ 3).
     * 
     * Công thức: (Điểm_Lượt + Điểm_Thời_Gian + Điểm_Rank + 5) × Kết_Quả
     * Range: 20 → 35 điểm
     */
    private function calculateLowPhasePoints(
        int $totalMoves,
        float $playerTime,
        float $opponentTime,
        string $opponentRank,
        bool $isWin
    ): array {
        // Điểm theo lượt
        if ($totalMoves < 10) {
            $movePoints = 10;
        } elseif ($totalMoves < 20) {
            $movePoints = 7;
        } else {
            $movePoints = 5;
        }

        // Điểm chênh lệch thời gian
        $timeRatio = $opponentTime > 0 ? $playerTime / $opponentTime : 1;
        if ($timeRatio <= 0.5) { // Player nhanh gấp đôi
            $timePoints = 10;
        } elseif ($timeRatio <= 0.67) { // Player nhanh hơn 1.5x
            $timePoints = 7;
        } else {
            $timePoints = 5;
        }

        // Điểm theo rank đối thủ
        $rankValue = self::RANKS[$opponentRank] ?? 0;
        if ($rankValue <= 0) { // Vô Danh
            $rankPoints = 10;
        } elseif ($rankValue <= 1) { // Tân Kỳ
            $rankPoints = 7;
        } else { // Học Kỳ+
            $rankPoints = 5;
        }

        // Tổng điểm
        $basePoints = $movePoints + $timePoints + $rankPoints + 5;
        $resultMultiplier = $isWin ? 1 : -1;
        $finalPoints = $basePoints * $resultMultiplier;

        // Clamp to range
        $finalPoints = $isWin 
            ? max(20, min(35, $finalPoints))
            : max(-35, min(-20, $finalPoints));

        return [
            'points' => $finalPoints,
            'phase' => 'low',
            'breakdown' => [
                'move_points' => $movePoints,
                'time_points' => $timePoints,
                'rank_points' => $rankPoints,
                'base_bonus' => 5,
                'result_multiplier' => $resultMultiplier,
                'total_moves' => $totalMoves,
                'time_ratio' => round($timeRatio, 2),
            ],
        ];
    }

    /**
     * Tính điểm giai đoạn cao (Học Kỳ Vượt Cấp → Vô Đối).
     * 
     * Công thức: (Điểm_Lượt + Điểm_Thời_Gian + 5) × Hệ_Số_Rank
     */
    private function calculateHighPhasePoints(
        int $totalMoves,
        float $playerTime,
        float $opponentTime,
        string $playerRank,
        string $opponentRank,
        bool $isWin
    ): array {
        // Điểm theo lượt
        if ($totalMoves < 10) {
            $movePoints = 10;
        } elseif ($totalMoves < 20) {
            $movePoints = 7;
        } else {
            $movePoints = 5;
        }

        // Điểm chênh lệch thời gian
        $timeRatio = $opponentTime > 0 ? $playerTime / $opponentTime : 1;
        if ($timeRatio <= 0.5) {
            $timePoints = 10;
        } elseif ($timeRatio <= 0.67) {
            $timePoints = 7;
        } else {
            $timePoints = 5;
        }

        // Hệ số chênh lệch rank
        $playerRankValue = self::RANKS[$playerRank] ?? 0;
        $opponentRankValue = self::RANKS[$opponentRank] ?? 0;
        $isHigherRank = $playerRankValue > $opponentRankValue;

        if ($isHigherRank) {
            // Player cao hơn đối thủ
            $rankMultiplier = $isWin ? 0.5 : -1.5;
        } else {
            // Player thấp hơn hoặc bằng đối thủ
            $rankMultiplier = $isWin ? 1.5 : -0.5;
        }

        // Tổng điểm
        $basePoints = $movePoints + $timePoints + 5;
        $finalPoints = (int) round($basePoints * $rankMultiplier);

        return [
            'points' => $finalPoints,
            'phase' => 'high',
            'breakdown' => [
                'move_points' => $movePoints,
                'time_points' => $timePoints,
                'base_bonus' => 5,
                'rank_multiplier' => $rankMultiplier,
                'player_higher' => $isHigherRank,
                'total_moves' => $totalMoves,
                'time_ratio' => round($timeRatio, 2),
            ],
        ];
    }

    /**
     * Kiểm tra player có ở giai đoạn dưới không.
     */
    public function isLowPhase(string $rank, string $tier = 'so_ky', int $level = 1): bool
    {
        $rankValue = self::RANKS[$rank] ?? 0;
        $maxRankValue = self::RANKS[self::LOW_PHASE_MAX_RANK] ?? 2;

        if ($rankValue < $maxRankValue) {
            return true;
        }

        if ($rankValue > $maxRankValue) {
            return false;
        }

        // Rank = Học Kỳ, check tier
        if ($tier === 'vuot_cap') {
            return false; // Vượt Cấp = giai đoạn cao
        }

        $tierValue = self::TIERS[$tier] ?? 0;
        $maxTierValue = self::TIERS[self::LOW_PHASE_MAX_TIER] ?? 2;

        return $tierValue <= $maxTierValue;
    }

    /**
     * Tính rank mới sau khi cộng/trừ điểm.
     * 
     * @param int $currentPoints Điểm hiện tại
     * @param int $pointsChange Điểm thay đổi (+/-)
     * @return array ['rank', 'tier', 'level', 'points', 'points_in_subrank']
     */
    public function calculateNewRank(int $currentPoints, int $pointsChange): array
    {
        $newPoints = max(0, $currentPoints + $pointsChange);
        return $this->getRankFromPoints($newPoints);
    }

    /**
     * Lấy rank từ tổng điểm.
     */
    public function getRankFromPoints(int $points): array
    {
        // Mỗi rank chính có 9 sub-ranks (3 tiers × 3 levels)
        // Trừ Học Kỳ có thêm Vượt Cấp
        $subRanksPerRank = 9;
        $pointsPerRank = $subRanksPerRank * self::POINTS_PER_SUBRANK; // 900

        // Tính rank chính
        $rankIndex = (int) floor($points / $pointsPerRank);
        $rankIndex = min($rankIndex, count(self::RANKS) - 1);

        $ranks = array_keys(self::RANKS);
        $rank = $ranks[$rankIndex] ?? 'vo_danh';

        // Điểm còn lại trong rank
        $pointsInRank = $points - ($rankIndex * $pointsPerRank);

        // Tính tier và level
        $subRankIndex = (int) floor($pointsInRank / self::POINTS_PER_SUBRANK);
        $subRankIndex = min($subRankIndex, 8); // Max 9 sub-ranks (0-8)

        $tierIndex = (int) floor($subRankIndex / 3);
        $level = ($subRankIndex % 3) + 1;

        $tiers = ['so_ky', 'trung_ky', 'cao_ky'];
        $tier = $tiers[$tierIndex] ?? 'so_ky';

        // Điểm trong sub-rank hiện tại
        $pointsInSubrank = $pointsInRank % self::POINTS_PER_SUBRANK;

        return [
            'rank' => $rank,
            'tier' => $tier,
            'level' => $level,
            'total_points' => $points,
            'points_in_subrank' => $pointsInSubrank,
            'points_to_next' => self::POINTS_PER_SUBRANK - $pointsInSubrank,
        ];
    }

    /**
     * Tính decay cuối mùa.
     * 
     * @param int $currentPoints Điểm hiện tại
     * @param string $rank Rank hiện tại
     * @param int $matchesPlayed Số trận đã chơi trong mùa
     * @return array ['decay_amount', 'new_points', 'multiplier', 'soft_demoted']
     */
    public function calculateDecay(int $currentPoints, string $rank, int $matchesPlayed): array
    {
        $floor = self::RANK_FLOORS[$rank] ?? 0;
        $decayPct = self::DECAY_PERCENTAGES[$rank] ?? 0;

        // Activity multiplier
        if ($matchesPlayed >= 20) {
            $multiplier = self::ACTIVITY_MULTIPLIERS['active'];
        } elseif ($matchesPlayed >= 10) {
            $multiplier = self::ACTIVITY_MULTIPLIERS['moderate'];
        } elseif ($matchesPlayed >= 1) {
            $multiplier = self::ACTIVITY_MULTIPLIERS['low'];
        } else {
            $multiplier = self::ACTIVITY_MULTIPLIERS['inactive'];
        }

        // Decay amount
        $excessPoints = max(0, $currentPoints - $floor);
        $decayAmount = (int) round($excessPoints * $decayPct * $multiplier);

        $newPoints = max($floor, $currentPoints - $decayAmount);

        // Check soft demotion
        $newRankInfo = $this->getRankFromPoints($newPoints);
        $softDemoted = $newRankInfo['rank'] !== $rank;

        return [
            'decay_amount' => $decayAmount,
            'new_points' => $newPoints,
            'multiplier' => $multiplier,
            'matches_played' => $matchesPlayed,
            'soft_demoted' => $softDemoted,
            'new_rank' => $newRankInfo['rank'],
        ];
    }

    /**
     * Format rank để hiển thị.
     */
    public function formatRankDisplay(string $rank, string $tier, int $level): string
    {
        $rankNames = [
            'vo_danh' => 'Vô Danh',
            'tan_ky' => 'Tân Kỳ',
            'hoc_ky' => 'Học Kỳ',
            'ky_lao' => 'Kỳ Lão',
            'cao_ky' => 'Cao Kỳ',
            'tam_ky' => 'Tam Kỳ',
            'de_nhi' => 'Đệ Nhị',
            'vo_doi' => 'Vô Đối',
        ];

        $tierNames = [
            'so_ky' => 'Sơ Kỳ',
            'trung_ky' => 'Trung Kỳ',
            'cao_ky' => 'Cao Kỳ',
            'vuot_cap' => 'Vượt Cấp',
        ];

        $rankName = $rankNames[$rank] ?? $rank;
        $tierName = $tierNames[$tier] ?? $tier;

        // Giai đoạn cao không hiển thị tier/level
        if (!$this->isLowPhase($rank, $tier, $level)) {
            return $rankName;
        }

        return "{$rankName} - {$tierName} {$level}";
    }
}
