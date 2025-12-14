<?php

declare(strict_types=1);

namespace App\Services;

interface SkillEngineServiceInterface
{
    /**
     * Execute a skill effect on the board
     * 
     * @param string $skillId The skill to execute
     * @param array $boardState Current board state (2D array)
     * @param array $context Context including player_side, enemy_side, target_position, etc.
     * @return SkillEffectResult
     */
    public function executeSkill(string $skillId, array $boardState, array $context): SkillEffectResult;
}
