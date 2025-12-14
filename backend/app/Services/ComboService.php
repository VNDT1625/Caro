<?php

declare(strict_types=1);

namespace App\Services;

use App\Database;

class ComboService implements ComboServiceInterface
{
    private Database $db;
    private SkillServiceInterface $skillService;
    private SeasonServiceInterface $seasonService;

    private const MAX_SKILLS = 15;
    private const MIN_COMMON = 10;
    private const MAX_RARE = 5;
    private const MAX_LEGENDARY = 3; // use legendary as "cuc hiem"
    private const MAX_PRESETS = 3;

    public function __construct(
        Database $db,
        SkillServiceInterface $skillService,
        SeasonServiceInterface $seasonService
    ) {
        $this->db = $db;
        $this->skillService = $skillService;
        $this->seasonService = $seasonService;
    }

    public function getUserCombos(string $userId, ?string $seasonId = null): array
    {
        if (!$seasonId) {
            $season = $this->seasonService->getCurrentSeason();
            $seasonId = $season['id'] ?? null;
        }

        if (!$seasonId) {
            return [];
        }

        $result = $this->db->query(
            'SELECT * FROM user_skill_combos 
             WHERE user_id = $1 AND season_id = $2 
             ORDER BY preset_slot',
            [$userId, $seasonId]
        );

        return array_map([$this, 'formatCombo'], $result);
    }

    public function getActiveCombo(string $userId, ?string $seasonId = null): ?array
    {
        if (!$seasonId) {
            $season = $this->seasonService->getCurrentSeason();
            $seasonId = $season['id'] ?? null;
        }

        if (!$seasonId) {
            return null;
        }

        $result = $this->db->query(
            'SELECT * FROM user_skill_combos 
             WHERE user_id = $1 AND season_id = $2 AND is_active = true
             LIMIT 1',
            [$userId, $seasonId]
        );

        if (empty($result)) {
            return null;
        }

        return $this->formatCombo($result[0]);
    }

    public function saveCombo(string $userId, string $seasonId, array $skillIds, int $presetSlot = 1, string $presetName = 'Default'): array
    {
        $validation = $this->validateCombo($skillIds, $seasonId, $userId);
        
        if (!$validation['valid']) {
            return ['success' => false, 'errors' => $validation['errors']];
        }

        $result = $this->db->query(
            'INSERT INTO user_skill_combos (user_id, season_id, preset_slot, preset_name, skill_ids, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, season_id, preset_slot)
             DO UPDATE SET skill_ids = $5, preset_name = $4, updated_at = NOW()
             RETURNING *',
            [$userId, $seasonId, $presetSlot, $presetName, json_encode($skillIds), $presetSlot === 1]
        );

        if (empty($result)) {
            return ['success' => false, 'errors' => ['Failed to save combo']];
        }

        return ['success' => true, 'combo' => $this->formatCombo($result[0])];
    }

    public function setActiveCombo(string $userId, string $seasonId, int $presetSlot): bool
    {
        $this->db->query(
            'UPDATE user_skill_combos SET is_active = false WHERE user_id = $1 AND season_id = $2',
            [$userId, $seasonId]
        );

        $result = $this->db->query(
            'UPDATE user_skill_combos SET is_active = true 
             WHERE user_id = $1 AND season_id = $2 AND preset_slot = $3
             RETURNING id',
            [$userId, $seasonId, $presetSlot]
        );

        return !empty($result);
    }

    public function deleteCombo(string $userId, string $seasonId, int $presetSlot): bool
    {
        $result = $this->db->query(
            'DELETE FROM user_skill_combos 
             WHERE user_id = $1 AND season_id = $2 AND preset_slot = $3
             RETURNING id',
            [$userId, $seasonId, $presetSlot]
        );

        return !empty($result);
    }

    public function validateCombo(array $skillIds, string $seasonId, string $userId): array
    {
        $errors = [];

        if (count($skillIds) !== self::MAX_SKILLS) {
            $errors[] = 'Combo phai co dung ' . self::MAX_SKILLS . ' skill';
        }

        if (count($skillIds) !== count(array_unique($skillIds))) {
            $errors[] = 'Combo khong duoc chon trung skill';
        }

        $skills = $this->skillService->getSkillsByIds($skillIds);
        $skillMap = [];
        foreach ($skills as $skill) {
            $skillMap[$skill['id']] = $skill;
        }

        $seasonPool = $this->seasonService->getSeasonSkillPool($seasonId);
        foreach ($skillIds as $skillId) {
            if (!isset($skillMap[$skillId])) {
                $errors[] = "Skill khong ton tai: $skillId";
            } elseif (!in_array($skillId, $seasonPool)) {
                $errors[] = "Skill khong thuoc mua nay: " . ($skillMap[$skillId]['name_vi'] ?? $skillId);
            }
        }

        $unlockedSkills = $this->skillService->getUserUnlockedSkills($userId);
        $unlockedIds = array_column($unlockedSkills, 'id');
        foreach ($skillIds as $skillId) {
            if (!in_array($skillId, $unlockedIds)) {
                $skillName = $skillMap[$skillId]['name_vi'] ?? $skillId;
                $errors[] = "Skill chua mo khoa: $skillName";
            }
        }

        $legendaryCount = 0;
        $rareCount = 0;
        $commonCount = 0;

        foreach ($skillIds as $skillId) {
            if (!isset($skillMap[$skillId])) {
                continue;
            }
            
            $skill = $skillMap[$skillId];
            
            if ($skill['rarity'] === 'legendary') {
                $legendaryCount++;
            }
            if ($skill['rarity'] === 'rare') {
                $rareCount++;
            }
            if ($skill['rarity'] === 'common') {
                $commonCount++;
            }
        }

        if ($commonCount < self::MIN_COMMON) {
            $errors[] = 'Can it nhat ' . self::MIN_COMMON . ' skill thuong';
        }
        if ($rareCount > self::MAX_RARE) {
            $errors[] = 'Toi da ' . self::MAX_RARE . ' skill hiem';
        }
        if ($legendaryCount > self::MAX_LEGENDARY) {
            $errors[] = 'Toi da ' . self::MAX_LEGENDARY . ' skill cuc hiem';
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
            'stats' => [
                'total' => count($skillIds),
                'legendary' => $legendaryCount,
                'rare' => $rareCount,
                'common' => $commonCount,
            ]
        ];
    }

    public function getRecommendedCombo(string $playstyle = 'balanced'): array
    {
        $season = $this->seasonService->getCurrentSeason();
        if (!$season) {
            return [];
        }

        $skills = $this->skillService->getSkillsBySeason($season['id']);

        $commons = array_values(array_filter($skills, fn($s) => $s['rarity'] === 'common'));
        $rares = array_values(array_filter($skills, fn($s) => $s['rarity'] === 'rare'));
        $legendaries = array_values(array_filter($skills, fn($s) => $s['rarity'] === 'legendary'));

        $combo = [];

        foreach (array_slice($commons, 0, self::MIN_COMMON) as $skill) {
            $combo[] = $skill['id'];
        }

        $slotsLeft = self::MAX_SKILLS - count($combo);

        $rareTake = min(self::MAX_RARE, $slotsLeft, count($rares));
        foreach (array_slice($rares, 0, $rareTake) as $skill) {
            $combo[] = $skill['id'];
        }

        $slotsLeft = self::MAX_SKILLS - count($combo);

        $legendaryTake = min(self::MAX_LEGENDARY, $slotsLeft, count($legendaries));
        foreach (array_slice($legendaries, 0, $legendaryTake) as $skill) {
            $combo[] = $skill['id'];
        }

        $slotsLeft = self::MAX_SKILLS - count($combo);

        if ($slotsLeft > 0) {
            $remainingPool = array_merge(array_slice($commons, self::MIN_COMMON), array_slice($rares, $rareTake));
            foreach ($remainingPool as $skill) {
                if (count($combo) >= self::MAX_SKILLS) {
                    break;
                }
                $combo[] = $skill['id'];
            }
        }

        return $combo;
    }

    private function formatCombo(array $row): array
    {
        return [
            'id' => $row['id'],
            'user_id' => $row['user_id'],
            'season_id' => $row['season_id'],
            'preset_slot' => (int) $row['preset_slot'],
            'preset_name' => $row['preset_name'],
            'skill_ids' => json_decode($row['skill_ids'] ?? '[]', true),
            'is_valid' => (bool) $row['is_valid'],
            'validation_errors' => json_decode($row['validation_errors'] ?? 'null', true),
            'is_active' => (bool) $row['is_active'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }
}

