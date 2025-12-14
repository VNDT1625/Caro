<?php

declare(strict_types=1);

namespace App\Services;

use App\Database;

class SkillService implements SkillServiceInterface
{
    private Database $db;
    private array $skillCache = [];

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    public function getSkillsBySeason(string $seasonId): array
    {
        // Get season's skill pool
        $season = $this->db->query(
            'SELECT skill_pool FROM seasons WHERE id = $1',
            [$seasonId]
        );

        if (empty($season)) {
            return [];
        }

        $skillIds = json_decode($season[0]['skill_pool'], true) ?? [];
        
        if (empty($skillIds)) {
            return [];
        }

        return $this->getSkillsByIds($skillIds);
    }

    public function getSkillById(string $skillId): ?array
    {
        if (isset($this->skillCache[$skillId])) {
            return $this->skillCache[$skillId];
        }

        $result = $this->db->query(
            'SELECT * FROM skills WHERE id = $1 AND is_active = true',
            [$skillId]
        );

        if (empty($result)) {
            return null;
        }

        $skill = $this->formatSkill($result[0]);
        $this->skillCache[$skillId] = $skill;
        
        return $skill;
    }

    public function getSkillsByIds(array $skillIds): array
    {
        if (empty($skillIds)) {
            return [];
        }

        // Build placeholders
        $placeholders = [];
        for ($i = 1; $i <= count($skillIds); $i++) {
            $placeholders[] = '$' . $i;
        }

        $result = $this->db->query(
            'SELECT * FROM skills WHERE id IN (' . implode(',', $placeholders) . ') AND is_active = true ORDER BY category, rarity, name_vi',
            $skillIds
        );

        return array_map([$this, 'formatSkill'], $result);
    }

    public function getStarterSkills(): array
    {
        $result = $this->db->query(
            'SELECT * FROM skills WHERE is_starter = true AND is_active = true ORDER BY category, name_vi'
        );

        return array_map([$this, 'formatSkill'], $result);
    }

    public function getUserUnlockedSkills(string $userId): array
    {
        $result = $this->db->query(
            'SELECT s.*, us.current_level, us.times_used, us.unlocked_at
             FROM skills s
             JOIN user_skills us ON s.id = us.skill_id
             WHERE us.user_id = $1 AND us.is_unlocked = true AND s.is_active = true
             ORDER BY s.category, s.rarity, s.name_vi',
            [$userId]
        );

        // If user has no unlocked skills, return starter skills
        if (empty($result)) {
            return $this->getStarterSkills();
        }

        return array_map(function ($row) {
            $skill = $this->formatSkill($row);
            $skill['user_level'] = (int) $row['current_level'];
            $skill['times_used'] = (int) $row['times_used'];
            $skill['unlocked_at'] = $row['unlocked_at'];
            return $skill;
        }, $result);
    }

    public function unlockSkill(string $userId, string $skillId, string $method): bool
    {
        $result = $this->db->query(
            'INSERT INTO user_skills (user_id, skill_id, is_unlocked, unlocked_at, unlock_method)
             VALUES ($1, $2, true, NOW(), $3)
             ON CONFLICT (user_id, skill_id) 
             DO UPDATE SET is_unlocked = true, unlocked_at = NOW(), unlock_method = $3
             RETURNING id',
            [$userId, $skillId, $method]
        );

        return !empty($result);
    }

    public function upgradeSkill(string $userId, string $skillId): array
    {
        // Get current level
        $userSkill = $this->db->query(
            'SELECT current_level FROM user_skills WHERE user_id = $1 AND skill_id = $2 AND is_unlocked = true',
            [$userId, $skillId]
        );

        if (empty($userSkill)) {
            return ['success' => false, 'error' => 'Skill not unlocked'];
        }

        $currentLevel = (int) $userSkill[0]['current_level'];
        
        if ($currentLevel >= 3) {
            return ['success' => false, 'error' => 'Skill already at max level'];
        }

        // Get upgrade cost
        $skill = $this->getSkillById($skillId);
        $upgradeCosts = $skill['upgrade_costs'] ?? [];
        $nextLevelCost = null;
        
        foreach ($upgradeCosts as $cost) {
            if ($cost['level'] === $currentLevel + 1) {
                $nextLevelCost = $cost;
                break;
            }
        }

        if (!$nextLevelCost) {
            return ['success' => false, 'error' => 'No upgrade cost defined'];
        }

        // Check user has enough coins
        $profile = $this->db->query(
            'SELECT coins FROM profiles WHERE user_id = $1',
            [$userId]
        );

        if (empty($profile) || $profile[0]['coins'] < $nextLevelCost['coins']) {
            return ['success' => false, 'error' => 'Not enough coins'];
        }

        // Deduct coins and upgrade
        $this->db->query(
            'UPDATE profiles SET coins = coins - $1 WHERE user_id = $2',
            [$nextLevelCost['coins'], $userId]
        );

        $this->db->query(
            'UPDATE user_skills SET current_level = current_level + 1 WHERE user_id = $1 AND skill_id = $2',
            [$userId, $skillId]
        );

        return [
            'success' => true,
            'new_level' => $currentLevel + 1,
            'coins_spent' => $nextLevelCost['coins']
        ];
    }

    private function formatSkill(array $row): array
    {
        return [
            'id' => $row['id'],
            'skill_code' => $row['skill_code'],
            'name_vi' => $row['name_vi'],
            'name_en' => $row['name_en'] ?? null,
            'description_vi' => $row['description_vi'],
            'description_en' => $row['description_en'] ?? null,
            'category' => $row['category'],
            'rarity' => $row['rarity'],
            'effect_type' => $row['effect_type'],
            'effect_params' => $this->decodeJsonField($row['effect_params'] ?? '{}'),
            'cooldown' => (int) ($row['cooldown'] ?? 0),
            'mana_cost' => (int) ($row['mana_cost'] ?? 0),
            'icon_url' => $row['icon_url'] ?? null,
            'preview_animation' => $row['preview_animation'] ?? null,
            'effect_color' => $row['effect_color'] ?? null,
            'unlock_requirement' => $this->decodeJsonField($row['unlock_requirement'] ?? null),
            'upgrade_costs' => $this->decodeJsonField($row['upgrade_costs'] ?? '[]'),
            'level_scaling' => $this->decodeJsonField($row['level_scaling'] ?? '{}'),
            'is_starter' => (bool) ($row['is_starter'] ?? false),
        ];
    }

    /**
     * Decode JSON field - handles both string (from PDO) and array (from REST API).
     */
    private function decodeJsonField($value): mixed
    {
        if ($value === null) {
            return null;
        }
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value)) {
            return json_decode($value, true);
        }
        return $value;
    }
}
