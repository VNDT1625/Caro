<?php

declare(strict_types=1);

namespace App\Services;

/**
 * TitleService - Quản lý hệ thống danh hiệu
 * Danh hiệu đạt được qua thành tích, KHÔNG MUA ĐƯỢC
 */
class TitleService
{
    private $supabase;

    public function __construct($supabaseClient = null)
    {
        $this->supabase = $supabaseClient;
    }

    /**
     * Lấy tất cả danh hiệu
     */
    public function getAllTitles(): array
    {
        $response = $this->supabase
            ->from('titles')
            ->select('*')
            ->eq('is_active', true)
            ->order('sort_order')
            ->execute();

        return $response->data ?? [];
    }

    /**
     * Lấy danh hiệu theo category
     */
    public function getTitlesByCategory(string $category): array
    {
        $response = $this->supabase
            ->from('titles')
            ->select('*')
            ->eq('category', $category)
            ->eq('is_active', true)
            ->order('sort_order')
            ->execute();

        return $response->data ?? [];
    }

    /**
     * Lấy danh hiệu user đã đạt được
     */
    public function getUserTitles(string $userId): array
    {
        $response = $this->supabase
            ->from('user_titles')
            ->select('*, titles(*)')
            ->eq('user_id', $userId)
            ->order('unlocked_at', ['ascending' => false])
            ->execute();

        return $response->data ?? [];
    }

    /**
     * Lấy danh hiệu đang trang bị
     */
    public function getEquippedTitle(string $userId): ?array
    {
        $response = $this->supabase
            ->from('user_titles')
            ->select('*, titles(*)')
            ->eq('user_id', $userId)
            ->eq('is_equipped', true)
            ->single()
            ->execute();

        return $response->data ?? null;
    }

    /**
     * Trang bị danh hiệu
     */
    public function equipTitle(string $userId, string $titleId): array
    {
        // Bỏ trang bị tất cả danh hiệu cũ
        $this->supabase
            ->from('user_titles')
            ->update(['is_equipped' => false])
            ->eq('user_id', $userId)
            ->execute();

        // Trang bị danh hiệu mới
        $response = $this->supabase
            ->from('user_titles')
            ->update(['is_equipped' => true])
            ->eq('user_id', $userId)
            ->eq('title_id', $titleId)
            ->execute();

        return ['success' => true, 'title_id' => $titleId];
    }

    /**
     * Bỏ trang bị danh hiệu
     */
    public function unequipTitle(string $userId): array
    {
        $this->supabase
            ->from('user_titles')
            ->update(['is_equipped' => false])
            ->eq('user_id', $userId)
            ->execute();

        return ['success' => true];
    }

    /**
     * Mở khóa danh hiệu cho user
     */
    public function unlockTitle(string $userId, string $titleId): array
    {
        // Kiểm tra đã có chưa
        $existing = $this->supabase
            ->from('user_titles')
            ->select('id')
            ->eq('user_id', $userId)
            ->eq('title_id', $titleId)
            ->execute();

        if (!empty($existing->data)) {
            return ['success' => false, 'message' => 'already_unlocked'];
        }

        // Thêm danh hiệu
        $response = $this->supabase
            ->from('user_titles')
            ->insert([
                'user_id' => $userId,
                'title_id' => $titleId,
                'is_equipped' => false
            ])
            ->execute();

        return ['success' => true, 'title_id' => $titleId];
    }

    /**
     * Kiểm tra và mở khóa danh hiệu dựa trên stats
     */
    public function checkAndUnlockTitles(string $userId, array $stats): array
    {
        $unlockedTitles = [];
        $titles = $this->getAllTitles();

        foreach ($titles as $title) {
            if ($this->checkRequirement($title, $stats)) {
                $result = $this->unlockTitle($userId, $title['id']);
                if ($result['success']) {
                    $unlockedTitles[] = $title;
                }
            }
        }

        return $unlockedTitles;
    }

    /**
     * Kiểm tra điều kiện đạt danh hiệu
     */
    private function checkRequirement(array $title, array $stats): bool
    {
        $type = $title['requirement_type'];
        $value = json_decode($title['requirement_value'], true) ?? [];

        switch ($type) {
            case 'rank_reach':
                return $this->checkRankRequirement($stats, $value);
            case 'wins_total':
                return ($stats['total_wins'] ?? 0) >= ($value['wins'] ?? PHP_INT_MAX);
            case 'wins_streak':
                return ($stats['current_streak'] ?? 0) >= ($value['streak'] ?? PHP_INT_MAX);
            case 'first_win':
                return ($stats['total_wins'] ?? 0) >= 1;
            case 'quick_win':
                return ($stats['fastest_win_moves'] ?? PHP_INT_MAX) <= ($value['moves'] ?? 0);
            case 'long_game_win':
                return ($stats['longest_win_moves'] ?? 0) >= ($value['moves'] ?? PHP_INT_MAX);
            case 'leaderboard_position':
                return ($stats['leaderboard_position'] ?? PHP_INT_MAX) <= ($value['position'] ?? 0);
            case 'unique_opponents':
                return ($stats['unique_opponents'] ?? 0) >= ($value['count'] ?? PHP_INT_MAX);
            case 'followers':
                return ($stats['followers'] ?? 0) >= ($value['count'] ?? PHP_INT_MAX);
            case 'analyses_viewed':
                return ($stats['analyses_viewed'] ?? 0) >= ($value['count'] ?? PHP_INT_MAX);
            case 'lessons_completed':
                return ($stats['lessons_completed'] ?? 0) >= ($value['count'] ?? PHP_INT_MAX);
            case 'skills_used':
                return ($stats['skills_used'] ?? 0) >= ($value['count'] ?? PHP_INT_MAX);
            case 'combos_executed':
                return ($stats['combos_executed'] ?? 0) >= ($value['count'] ?? PHP_INT_MAX);
            case 'season_participate':
                return in_array($value['season'] ?? 0, $stats['seasons_participated'] ?? []);
            case 'seasons_played':
                return count($stats['seasons_participated'] ?? []) >= ($value['seasons'] ?? PHP_INT_MAX);
            default:
                return false;
        }
    }

    /**
     * Kiểm tra rank requirement
     */
    private function checkRankRequirement(array $stats, array $value): bool
    {
        $rankOrder = [
            'unranked' => 0,
            'bronze' => 1,
            'silver' => 2,
            'gold' => 3,
            'platinum' => 4,
            'diamond' => 5,
            'master' => 6,
            'grandmaster' => 7,
            'challenger' => 8
        ];

        $currentRank = strtolower($stats['current_rank'] ?? 'unranked');
        $requiredRank = strtolower($value['rank'] ?? 'challenger');

        return ($rankOrder[$currentRank] ?? 0) >= ($rankOrder[$requiredRank] ?? 99);
    }

    /**
     * Lấy thống kê danh hiệu của user
     */
    public function getUserTitleStats(string $userId): array
    {
        $userTitles = $this->getUserTitles($userId);
        $allTitles = $this->getAllTitles();

        $totalPoints = 0;
        $byRarity = ['common' => 0, 'rare' => 0, 'epic' => 0, 'legendary' => 0, 'mythic' => 0];
        $byCategory = [];

        foreach ($userTitles as $ut) {
            $title = $ut['titles'] ?? [];
            $totalPoints += $title['points'] ?? 0;
            $rarity = $title['rarity'] ?? 'common';
            $category = $title['category'] ?? 'other';
            $byRarity[$rarity] = ($byRarity[$rarity] ?? 0) + 1;
            $byCategory[$category] = ($byCategory[$category] ?? 0) + 1;
        }

        return [
            'total_unlocked' => count($userTitles),
            'total_available' => count($allTitles),
            'total_points' => $totalPoints,
            'by_rarity' => $byRarity,
            'by_category' => $byCategory,
            'completion_percent' => count($allTitles) > 0 
                ? round(count($userTitles) / count($allTitles) * 100, 1) 
                : 0
        ];
    }
}
