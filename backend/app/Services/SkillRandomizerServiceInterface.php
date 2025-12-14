<?php

declare(strict_types=1);

namespace App\Services;

interface SkillRandomizerServiceInterface
{
    /**
     * Generate 3 random skills for a turn
     * 
     * @param array $comboSkillIds User's combo (15 skills)
     * @param array $cooldownSkillIds Skills currently on cooldown
     * @param array $heldSkillIds Skills the user wants to keep between turns
     * @param int $luckStacks Luck stacks to bias rarity (placeholder)
     * @param int $turnNumber Current turn number
     * @param string $matchSeed Seed for reproducible randomness
     * @return array Array of 3 skill IDs
     */
    public function generateTurnSkills(
        array $comboSkillIds,
        array $cooldownSkillIds,
        int $turnNumber,
        string $matchSeed,
        array $heldSkillIds = [],
        int $luckStacks = 0
    ): array;

    /**
     * Get seed for a match
     */
    public function getSeed(string $matchId): string;
}
