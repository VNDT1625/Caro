<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\TitleService;

/**
 * TitleController - API endpoints cho hệ thống danh hiệu
 */
class TitleController
{
    private TitleService $titleService;

    public function __construct(TitleService $titleService)
    {
        $this->titleService = $titleService;
    }

    /**
     * GET /api/titles - Lấy tất cả danh hiệu
     */
    public function index(): array
    {
        $titles = $this->titleService->getAllTitles();
        
        // Group by category
        $grouped = [];
        foreach ($titles as $title) {
            $cat = $title['category'] ?? 'other';
            if (!isset($grouped[$cat])) {
                $grouped[$cat] = [];
            }
            $grouped[$cat][] = $title;
        }

        return [
            'success' => true,
            'data' => [
                'titles' => $titles,
                'grouped' => $grouped,
                'total' => count($titles)
            ]
        ];
    }

    /**
     * GET /api/titles/category/{category} - Lấy danh hiệu theo category
     */
    public function byCategory(string $category): array
    {
        $validCategories = ['rank', 'wins', 'streak', 'special', 'season', 'social', 'skill', 'event'];
        
        if (!in_array($category, $validCategories)) {
            return [
                'success' => false,
                'error' => 'invalid_category',
                'valid_categories' => $validCategories
            ];
        }

        $titles = $this->titleService->getTitlesByCategory($category);

        return [
            'success' => true,
            'data' => [
                'category' => $category,
                'titles' => $titles,
                'total' => count($titles)
            ]
        ];
    }

    /**
     * GET /api/titles/user/{userId} - Lấy danh hiệu của user
     */
    public function userTitles(string $userId): array
    {
        $titles = $this->titleService->getUserTitles($userId);
        $equipped = $this->titleService->getEquippedTitle($userId);
        $stats = $this->titleService->getUserTitleStats($userId);

        return [
            'success' => true,
            'data' => [
                'titles' => $titles,
                'equipped' => $equipped,
                'stats' => $stats
            ]
        ];
    }

    /**
     * POST /api/titles/equip - Trang bị danh hiệu
     */
    public function equip(): array
    {
        $input = json_decode(file_get_contents('php://input'), true);
        $userId = $input['user_id'] ?? null;
        $titleId = $input['title_id'] ?? null;

        if (!$userId || !$titleId) {
            return [
                'success' => false,
                'error' => 'missing_params'
            ];
        }

        $result = $this->titleService->equipTitle($userId, $titleId);

        return [
            'success' => $result['success'],
            'data' => $result
        ];
    }

    /**
     * POST /api/titles/unequip - Bỏ trang bị danh hiệu
     */
    public function unequip(): array
    {
        $input = json_decode(file_get_contents('php://input'), true);
        $userId = $input['user_id'] ?? null;

        if (!$userId) {
            return [
                'success' => false,
                'error' => 'missing_user_id'
            ];
        }

        $result = $this->titleService->unequipTitle($userId);

        return [
            'success' => $result['success'],
            'data' => $result
        ];
    }

    /**
     * POST /api/titles/check - Kiểm tra và mở khóa danh hiệu mới
     */
    public function checkUnlock(): array
    {
        $input = json_decode(file_get_contents('php://input'), true);
        $userId = $input['user_id'] ?? null;
        $stats = $input['stats'] ?? [];

        if (!$userId) {
            return [
                'success' => false,
                'error' => 'missing_user_id'
            ];
        }

        $newTitles = $this->titleService->checkAndUnlockTitles($userId, $stats);

        return [
            'success' => true,
            'data' => [
                'new_titles' => $newTitles,
                'count' => count($newTitles)
            ]
        ];
    }
}
