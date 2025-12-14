<?php

declare(strict_types=1);

namespace App\Services;

interface SkillServiceInterface
{
    /**
     * Get all skills for a season
     * @param string $seasonId
     * @return array
     */
    public function getSkillsBySeason(string $seasonId): array;

    /**
     * Get skill by ID
     * @param string $skillId
     * @return array|null
     */
    public function getSkillById(string $skillId): ?array;

    /**
     * Get skills by IDs
     * @param array $skillIds
     * @return array
     */
    public function getSkillsByIds(array $skillIds): array;

    /**
     * Get starter skills (for beginners)
     * @return array
     */
    public function getStarterSkills(): array;

    /**
     * Get user's unlocked skills
     * @param string $userId
     * @return array
     */
    public function getUserUnlockedSkills(string $userId): array;

    /**
     * Unlock a skill for user
     * @param string $userId
     * @param string $skillId
     * @param string $method
     * @return bool
     */
    public function unlockSkill(string $userId, string $skillId, string $method): bool;

    /**
     * Upgrade a skill for user
     * @param string $userId
     * @param string $skillId
     * @return array Result with success and new level
     */
    public function upgradeSkill(string $userId, string $skillId): array;
}
