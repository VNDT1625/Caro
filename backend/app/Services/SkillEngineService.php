<?php

declare(strict_types=1);

namespace App\Services;

use App\Database;

class SkillEngineService implements SkillEngineServiceInterface
{
    private Database $db;
    private SkillServiceInterface $skillService;

    public function __construct(Database $db, SkillServiceInterface $skillService)
    {
        $this->db = $db;
        $this->skillService = $skillService;
    }

    public function executeSkill(string $skillId, array $boardState, array $context): SkillEffectResult
    {
        $skill = $this->skillService->getSkillById($skillId);
        
        if (!$skill) {
            return new SkillEffectResult(false, 'Skill not found', [], $boardState);
        }

        $effectType = $skill['effect_type'];
        $params = $skill['effect_params'];
        $userLevel = $context['user_level'] ?? 1;
        
        // Apply level scaling
        $scaling = $skill['level_scaling'][(string)$userLevel] ?? 1.0;

        $activeEffects = $context['active_effects'] ?? [];

        $result = match ($effectType) {
            // Attack skills
            'place_adjacent' => $this->executePlaceAdjacent($boardState, $context, $params, $scaling),
            'place_double' => $this->executePlaceDouble($boardState, $context, $params),
            'push_enemy' => $this->executePushEnemy($boardState, $context, $params),
            'destroy_piece' => $this->executeDestroyPiece($boardState, $context),
            'chaos_move' => $this->executeChaosMove($boardState, $context, $params),
            'burn_area' => $this->executeBurnArea($boardState, $context, $params),
            'push_chain' => $this->executePushChain($boardState, $context, $params),
            'remove_enemy' => $this->executeRemoveEnemy($boardState, $context, $params),
            'remove_furthest' => $this->executeRemoveFurthest($boardState, $context),
            'bomb_area' => $this->executeBombArea($boardState, $context, $params),
            'mark_cell' => $this->executeMarkCell($boardState, $context, $params),
            'no_time_cost' => $this->executeNoTimeCost($context),
            'immune_next' => $this->executeImmuneNext($context, $params),
            'bonus_on_three' => $this->executeBonusOnThree($context),
            'reveal_next_move' => $this->executeRevealNextMove($context),
            'reduce_time' => $this->executeReduceTime($context, $params),
            
            // Defense skills
            'temp_remove' => $this->executeTempRemove($boardState, $context, $params),
            'immunity_area' => $this->executeImmunityArea($boardState, $context, $params),
            'permanent_protect' => $this->executePermanentProtect($boardState, $context, $params),
            'silence_all' => $this->executeSilenceAll($context, $params),
            'mutual_protect' => $this->executeMutualProtect($context, $params),
            'protect_line' => $this->executeProtectLine($boardState, $context, $params),
            'destroy_immunity' => $this->executeDestroyImmunity($boardState, $context, $params),
            'protect_piece' => $this->executeProtectPiece($boardState, $context, $params),
            'block_cell' => $this->executeBlockCell($boardState, $context, $params),
            'restore_piece' => $this->executeRestorePiece($boardState, $context),
            'dodge_next' => $this->executeDodgeNext($context),
            'anchor_piece' => $this->executeAnchorPiece($boardState, $context, $params),
            'hide_pieces' => $this->executeHidePieces($boardState, $context, $params),
            'reflect_attack' => $this->executeReflectAttack($context),
            'add_time' => $this->executeAddTime($context, $params),
            'shield_area' => $this->executeShieldArea($boardState, $context, $params),
            'wall_line' => $this->executeWallLine($boardState, $context, $params),
            'swap_own' => $this->executeSwapOwn($boardState, $context),
            'copy_move' => $this->executeCopyMove($boardState, $context),
            
            // Utility skills
            'restore_mana' => $this->executeRestoreMana($context, $params),
            'double_next' => $this->executeDoubleNext($context, $params),
            'disable_skills' => $this->executeDisableSkills($context, $params),
            'immobilize' => $this->executeImmobilize($boardState, $context, $params),
            'remove_immobilize' => $this->executeRemoveImmobilize($context),
            'turn_manipulation' => $this->executeTurnManipulation($context),
            'double_skill' => $this->executeDoubleSkill($context),
            'break_chain' => $this->executeBreakChain($boardState, $context, $params),
            'reflect_trap' => $this->executeReflectTrapSkill($context, $params),
            'fake_piece' => $this->executeFakePiece($context, $params),
            'buff_immunity' => $this->executeBuffImmunity($context, $params),
            'fire_spread' => $this->executeSpreadStatusGeneric($boardState, $context, 'fire', $params),
            'ice_spread' => $this->executeSpreadStatusGeneric($boardState, $context, 'ice', $params),
            'root_spread' => $this->executeSpreadStatusGeneric($boardState, $context, 'root', $params),
            'stone_spread' => $this->executeSpreadStatusGeneric($boardState, $context, 'stone', $params),
            'rust_spread' => $this->executeSpreadStatusGeneric($boardState, $context, 'rust', $params),
            'counter_metal' => $this->executeCounterElement($context, 'metal'),
            'counter_fire' => $this->executeCounterElement($context, 'fire'),
            'counter_earth' => $this->executeCounterElement($context, 'earth'),
            'counter_water' => $this->executeCounterElement($context, 'water'),
            'counter_wood' => $this->executeCounterElement($context, 'wood'),
            'random_skill' => $this->executeRandomEffect($boardState, $context),
            'ai_suggest' => $this->executeAiSuggest($boardState, $context, $params),
            'peek_skills' => $this->executePeekSkills($context, $params),
            'reroll_skills' => $this->executeRerollSkills($context),
            'save_skill' => $this->executeSaveSkill($context),
            'reduce_cooldown' => $this->executeReduceCooldown($context, $params),
            'increase_enemy_cd' => $this->executeIncreaseEnemyCd($context, $params),
            'show_threats' => $this->executeShowThreats($boardState, $context),
            'reset_one_cd' => $this->executeResetOneCd($context),
            'ai_analyze' => $this->executeAiAnalyze($boardState, $context, $params),
            'undo_enemy' => $this->executeUndoEnemy($boardState, $context),
            'freeze_skills' => $this->executeFreezeSkills($context, $params),
            'extend_turn' => $this->executeExtendTurn($context, $params),
            'extra_turn' => $this->executeExtraTurn($context),
            
            // Special skills
            'force_move_fixed' => $this->executeForceMoveFixed($boardState, $context, $params),
            'reflect_trap_delayed' => $this->executeReflectTrapSkill($context, $params),
            'remove_enemy_skill' => $this->executeRemoveEnemySkill($context),
            'force_reveal' => $this->executeForceReveal($context),
            'teleport_piece' => $this->executeTeleportPiece($boardState, $context),
            'clone_piece' => $this->executeClonePiece($boardState, $context),
            'reset_all_cd' => $this->executeResetAllCd($context),
            'choose_next_skills' => $this->executeChooseNextSkills($context),
            'custom_effect' => $this->executeCustomEffect($context, $skill),
            'spread_status' => $this->executeSpreadStatus($boardState, $context, $params),
            'cleanse_element' => $this->executeCleanseElement($context, $params),
            'line_destroy' => $this->executeLineDestroy($boardState, $context, $params),
            'shuffle_area' => $this->executeShuffleArea($boardState, $context, $params),
            'zone_block' => $this->executeZoneBlock($boardState, $context, $params),
            'banish_piece' => $this->executeBanishPiece($boardState, $context, $params),
            'reset_area' => $this->executeResetArea($boardState, $context, $params),
            'reveal_area' => $this->executeRevealArea($context, $params),
            'dual_protect' => $this->executeDualProtect($context, $params),
            'buff_next_multiplier' => $this->executeBuffNextMultiplier($context, $params),
            'redirect_damage' => $this->executeRedirectDamage($context, $params),
            'deck_lock' => $this->executeDeckLock($context, $params),
            'protect_all' => $this->executeProtectAll($context, $params),
            'random_effect' => $this->executeRandomEffect($boardState, $context),
            'remove_debuff' => $this->executeRemoveDebuff($context),
            'remove_anchor' => $this->executeRemoveAnchor($context),
            'force_move_anchor' => $this->executeForceMoveAnchor($boardState, $context),
            'extend_buffs' => $this->executeExtendBuffs($context, $params),
            'swap_turn_order' => $this->executeSwapTurnOrder($context),
            'erase_enemy_skill' => $this->executeEraseEnemySkill($context),
            'swap_pieces' => $this->executeSwapPieces($boardState, $context),
            'reuse_skill' => $this->executeReuseSkill($context),
            'two_skills_next_turn' => $this->executeTwoSkillsNextTurn($context),
            'force_next_cell' => $this->executeForceNextCell($context),
            'chaos_all' => $this->executeChaosBoard($context),
            'chaos_board' => $this->executeChaosBoard($context),
            'convert_piece' => $this->executeConvertPiece($boardState, $context),
            'luck_buff' => $this->executeLuckBuff($context, $params),
            'push_split_chain' => $this->executePushSplitChain($boardState, $context, $params),
            'attack_buff' => $this->executeAttackBuff($context, $params),
            'chaos_jump' => $this->executeChaosJump($boardState, $context),
            'seal_buff' => $this->executeSealBuff($context, $params),
            'purge_buffs' => $this->executePurgeBuffs($context),
            'block_future_buffs' => $this->executeBlockFutureBuffs($context, $params),
            'remove_specific_buff' => $this->executeRemoveSpecificBuff($context),
            'trap_reflect' => $this->executeTrapReflect($context, $params),
            'steal_skill' => $this->executeEraseEnemySkill($context),
            'clear_all_effects' => $this->executePurgeBuffs($context),
            
            default => new SkillEffectResult(false, 'Unknown effect type: ' . $effectType, [], $boardState),
        };

        // Áp bảo hộ/redirect lên changes nếu cần
        $filtered = $this->applyProtectionAndRedirect($result->changes, $activeEffects, $boardState);
        return new SkillEffectResult(
            $result->success,
            $result->message,
            $filtered,
            $result->newBoardState,
            $result->stateEffects
        );
    }

    // ==================== ATTACK SKILLS ====================

    private function executePlaceAdjacent(array $board, array $ctx, array $params, float $scaling): SkillEffectResult
    {
        $lastMove = $ctx['last_move'] ?? null;
        $playerSide = $ctx['player_side'];
        
        if (!$lastMove) {
            return new SkillEffectResult(false, 'No last move', [], $board);
        }

        $adjacentCells = $this->getAdjacentEmptyCells($board, $lastMove['x'], $lastMove['y']);
        
        if (empty($adjacentCells)) {
            return new SkillEffectResult(false, 'No adjacent empty cells', [], $board);
        }

        // Pick first available (or let client choose via target_position)
        $target = $ctx['target_position'] ?? $adjacentCells[0];
        $board[$target['y']][$target['x']] = $playerSide;

        return new SkillEffectResult(
            true,
            'Placed piece at adjacent cell',
            [['type' => 'place', 'x' => $target['x'], 'y' => $target['y'], 'side' => $playerSide]],
            $board
        );
    }

    private function executePlaceDouble(array $board, array $ctx, array $params): SkillEffectResult
    {
        $positions = $ctx['target_positions'] ?? [];
        $playerSide = $ctx['player_side'];
        $minDistance = $params['min_distance'] ?? 2;

        if (count($positions) !== 2) {
            return new SkillEffectResult(false, 'Must select 2 positions', [], $board);
        }

        // Check distance
        $dist = abs($positions[0]['x'] - $positions[1]['x']) + abs($positions[0]['y'] - $positions[1]['y']);
        if ($dist < $minDistance) {
            return new SkillEffectResult(false, "Positions must be at least $minDistance cells apart", [], $board);
        }

        // Check both empty
        foreach ($positions as $pos) {
            if (($board[$pos['y']][$pos['x']] ?? null) !== null) {
                return new SkillEffectResult(false, 'Position not empty', [], $board);
            }
        }

        // Place both
        $changes = [];
        foreach ($positions as $pos) {
            $board[$pos['y']][$pos['x']] = $playerSide;
            $changes[] = ['type' => 'place', 'x' => $pos['x'], 'y' => $pos['y'], 'side' => $playerSide];
        }

        return new SkillEffectResult(true, 'Placed 2 pieces', $changes, $board);
    }

    private function executePushEnemy(array $board, array $ctx, array $params): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        $direction = $ctx['push_direction'] ?? null; // 'up', 'down', 'left', 'right'
        $enemySide = $ctx['enemy_side'];
        $distance = $params['distance'] ?? 1;

        if (!$target || !$direction) {
            return new SkillEffectResult(false, 'Must select target and direction', [], $board);
        }

        if (($board[$target['y']][$target['x']] ?? null) !== $enemySide) {
            return new SkillEffectResult(false, 'Target is not enemy piece', [], $board);
        }

        $dx = match($direction) { 'left' => -1, 'right' => 1, default => 0 };
        $dy = match($direction) { 'up' => -1, 'down' => 1, default => 0 };
        
        $newX = $target['x'] + $dx * $distance;
        $newY = $target['y'] + $dy * $distance;

        // Check bounds and empty
        if ($newX < 0 || $newX >= 15 || $newY < 0 || $newY >= 15) {
            return new SkillEffectResult(false, 'Cannot push off board', [], $board);
        }
        if (($board[$newY][$newX] ?? null) !== null) {
            return new SkillEffectResult(false, 'Destination not empty', [], $board);
        }

        // Move piece
        $board[$target['y']][$target['x']] = null;
        $board[$newY][$newX] = $enemySide;

        return new SkillEffectResult(true, 'Pushed enemy piece', [
            ['type' => 'remove', 'x' => $target['x'], 'y' => $target['y']],
            ['type' => 'place', 'x' => $newX, 'y' => $newY, 'side' => $enemySide],
        ], $board);
    }

    /**
     * SKL_004 - Lốc Xoáy: Chọn vùng 3x3, di chuyển ngẫu nhiên các quân đến vị trí trống trong vùng
     */
    private function executeChaosMove(array $board, array $ctx, array $params): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        if (!$target) {
            return new SkillEffectResult(false, 'Must select center position', [], $board);
        }
        
        $radius = 1; // 3x3 area
        $centerX = $target['x'];
        $centerY = $target['y'];
        
        // Collect all pieces and empty cells in the 3x3 area
        $pieces = [];
        $emptyCells = [];
        
        for ($dy = -$radius; $dy <= $radius; $dy++) {
            for ($dx = -$radius; $dx <= $radius; $dx++) {
                $x = $centerX + $dx;
                $y = $centerY + $dy;
                if ($x < 0 || $x >= 15 || $y < 0 || $y >= 15) continue;
                
                $cell = $board[$y][$x] ?? null;
                if ($cell === null) {
                    $emptyCells[] = ['x' => $x, 'y' => $y];
                } elseif ($cell !== 'BLOCKED') {
                    $pieces[] = ['x' => $x, 'y' => $y, 'side' => $cell];
                }
            }
        }
        
        if (empty($pieces)) {
            return new SkillEffectResult(false, 'No pieces in area', [], $board);
        }
        
        // Combine pieces positions with empty cells for shuffling
        $allPositions = array_merge(
            array_map(fn($p) => ['x' => $p['x'], 'y' => $p['y']], $pieces),
            $emptyCells
        );
        
        // Shuffle positions
        shuffle($allPositions);
        
        // Clear original positions
        $changes = [];
        foreach ($pieces as $piece) {
            $board[$piece['y']][$piece['x']] = null;
        }
        
        // Place pieces at new random positions
        foreach ($pieces as $idx => $piece) {
            $newPos = $allPositions[$idx];
            $board[$newPos['y']][$newPos['x']] = $piece['side'];
            $changes[] = [
                'type' => 'move',
                'from' => ['x' => $piece['x'], 'y' => $piece['y']],
                'to' => $newPos,
                'side' => $piece['side']
            ];
        }
        
        return new SkillEffectResult(true, 'Tornado shuffled pieces in 3x3 area', $changes, $board);
    }

    private function executeBurnArea(array $board, array $ctx, array $params): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        if (!$target) {
            return new SkillEffectResult(false, 'Must select target', [], $board);
        }
        $radius = $params['radius'] ?? 1;
        $duration = $params['duration'] ?? 3;
        $stateEffects = [[
            'type' => 'burn_area',
            'center' => $target,
            'radius' => $radius,
            'duration' => $duration
        ]];
        return new SkillEffectResult(true, 'Burn area set', [[
            'type' => 'burn_area',
            'center' => $target,
            'radius' => $radius,
            'duration' => $duration
        ]], $board, $stateEffects);
    }

    /**
     * SKL_006 - Thủy Chấn: Xê dịch 1 quân địch theo hướng, tất cả quân phía sau cũng bị đẩy theo chuỗi
     */
    private function executePushChain(array $board, array $ctx, array $params): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        $direction = $ctx['push_direction'] ?? null; // 'up', 'down', 'left', 'right'
        $enemySide = $ctx['enemy_side'];
        
        if (!$target || !$direction) {
            return new SkillEffectResult(false, 'Must select target and direction', [], $board);
        }
        
        if (($board[$target['y']][$target['x']] ?? null) !== $enemySide) {
            return new SkillEffectResult(false, 'Target must be enemy piece', [], $board);
        }
        
        // Direction vectors
        $dx = match($direction) { 'left' => -1, 'right' => 1, default => 0 };
        $dy = match($direction) { 'up' => -1, 'down' => 1, default => 0 };
        
        // Collect all pieces in the push direction (behind the target)
        $piecesToPush = [];
        $x = $target['x'];
        $y = $target['y'];
        
        // Collect pieces from target going backwards (opposite of push direction)
        while ($x >= 0 && $x < 15 && $y >= 0 && $y < 15) {
            $cell = $board[$y][$x] ?? null;
            if ($cell !== null && $cell !== 'BLOCKED') {
                $piecesToPush[] = ['x' => $x, 'y' => $y, 'side' => $cell];
            } else {
                break; // Stop at empty cell or blocked
            }
            $x -= $dx;
            $y -= $dy;
        }
        
        if (empty($piecesToPush)) {
            return new SkillEffectResult(false, 'No pieces to push', [], $board);
        }
        
        // Check if we can push (destination of first piece must be valid)
        $firstPiece = $piecesToPush[0];
        $destX = $firstPiece['x'] + $dx;
        $destY = $firstPiece['y'] + $dy;
        
        if ($destX < 0 || $destX >= 15 || $destY < 0 || $destY >= 15) {
            return new SkillEffectResult(false, 'Cannot push off board', [], $board);
        }
        if (($board[$destY][$destX] ?? null) !== null && $board[$destY][$destX] !== 'BLOCKED') {
            return new SkillEffectResult(false, 'Destination blocked by piece', [], $board);
        }
        
        // Push all pieces (from front to back to avoid overwriting)
        $changes = [];
        foreach ($piecesToPush as $piece) {
            $newX = $piece['x'] + $dx;
            $newY = $piece['y'] + $dy;
            
            if ($newX < 0 || $newX >= 15 || $newY < 0 || $newY >= 15) {
                continue; // Skip if would go off board
            }
            
            $board[$piece['y']][$piece['x']] = null;
            $board[$newY][$newX] = $piece['side'];
            $changes[] = [
                'type' => 'move',
                'from' => ['x' => $piece['x'], 'y' => $piece['y']],
                'to' => ['x' => $newX, 'y' => $newY],
                'side' => $piece['side']
            ];
        }
        
        return new SkillEffectResult(true, 'Chain pushed ' . count($changes) . ' pieces', $changes, $board);
    }

    private function executeDestroyPiece(array $board, array $ctx): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        $enemySide = $ctx['enemy_side'];

        if (!$target) {
            return new SkillEffectResult(false, 'Must select target', [], $board);
        }

        if (($board[$target['y']][$target['x']] ?? null) !== $enemySide) {
            return new SkillEffectResult(false, 'Target is not enemy piece', [], $board);
        }

        $board[$target['y']][$target['x']] = null;

        return new SkillEffectResult(true, 'Enemy piece destroyed', [
            ['type' => 'remove', 'x' => $target['x'], 'y' => $target['y']],
        ], $board);
    }

    private function executeRemoveEnemy(array $board, array $ctx, array $params): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        $enemySide = $ctx['enemy_side'];
        $lastEnemyMove = $ctx['last_enemy_move'] ?? null;

        if (!$target) {
            return new SkillEffectResult(false, 'Must select target', [], $board);
        }

        if (($board[$target['y']][$target['x']] ?? null) !== $enemySide) {
            return new SkillEffectResult(false, 'Target is not enemy piece', [], $board);
        }

        // Cannot remove last placed piece
        if ($lastEnemyMove && $target['x'] === $lastEnemyMove['x'] && $target['y'] === $lastEnemyMove['y']) {
            return new SkillEffectResult(false, 'Cannot remove last placed piece', [], $board);
        }

        $board[$target['y']][$target['x']] = null;

        return new SkillEffectResult(true, 'Removed enemy piece', [
            ['type' => 'remove', 'x' => $target['x'], 'y' => $target['y']],
        ], $board);
    }

    private function executeTempRemove(array $board, array $ctx, array $params): SkillEffectResult
    {
        // Temporary removal = banish with return_after duration
        return $this->executeBanishPiece($board, $ctx, $params);
    }

    private function executeRemoveFurthest(array $board, array $ctx): SkillEffectResult
    {
        $enemySide = $ctx['enemy_side'];
        $centerX = 7;
        $centerY = 7;

        $furthest = null;
        $maxDist = -1;

        for ($y = 0; $y < 15; $y++) {
            for ($x = 0; $x < 15; $x++) {
                if (($board[$y][$x] ?? null) === $enemySide) {
                    $dist = abs($x - $centerX) + abs($y - $centerY);
                    if ($dist > $maxDist) {
                        $maxDist = $dist;
                        $furthest = ['x' => $x, 'y' => $y];
                    }
                }
            }
        }

        if (!$furthest) {
            return new SkillEffectResult(false, 'No enemy pieces found', [], $board);
        }

        $board[$furthest['y']][$furthest['x']] = null;

        return new SkillEffectResult(true, 'Removed furthest enemy piece', [
            ['type' => 'remove', 'x' => $furthest['x'], 'y' => $furthest['y']],
        ], $board);
    }

    private function executeBombArea(array $board, array $ctx, array $params): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        $radius = $params['radius'] ?? 1;

        if (!$target) {
            return new SkillEffectResult(false, 'Must select target', [], $board);
        }

        $changes = [];
        for ($dy = -$radius; $dy <= $radius; $dy++) {
            for ($dx = -$radius; $dx <= $radius; $dx++) {
                $x = $target['x'] + $dx;
                $y = $target['y'] + $dy;
                
                if ($x >= 0 && $x < 15 && $y >= 0 && $y < 15) {
                    if (($board[$y][$x] ?? null) !== null) {
                        $changes[] = ['type' => 'remove', 'x' => $x, 'y' => $y];
                        $board[$y][$x] = null;
                    }
                }
            }
        }

        return new SkillEffectResult(true, 'Bombed area', $changes, $board);
    }

    // Simplified implementations for other skills...
    
    private function executeMarkCell(array $board, array $ctx, array $params): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Cell marked', [
            ['type' => 'mark', 'x' => $ctx['target_position']['x'] ?? 7, 'y' => $ctx['target_position']['y'] ?? 7, 'duration' => $params['duration'] ?? 3]
        ], $board);
    }

    private function executeNoTimeCost(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'No time cost this turn', [['type' => 'modifier', 'effect' => 'no_time_cost']], []);
    }

    private function executeImmuneNext(array $ctx, array $params): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Next piece immune', [['type' => 'modifier', 'effect' => 'immune', 'duration' => $params['duration'] ?? 1]], []);
    }

    private function executeBonusOnThree(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Bonus on three activated', [['type' => 'modifier', 'effect' => 'bonus_on_three']], []);
    }

    private function executeRevealNextMove(array $ctx): SkillEffectResult
    {
        // Would integrate with AI to predict
        return new SkillEffectResult(true, 'Revealed next move', [['type' => 'reveal', 'data' => ['predicted_x' => 7, 'predicted_y' => 7]]], []);
    }

    private function executeReduceTime(array $ctx, array $params): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Reduced enemy time', [['type' => 'time_modifier', 'target' => 'enemy', 'seconds' => -($params['seconds'] ?? 5)]], []);
    }

    // ==================== DEFENSE SKILLS ====================

    private function executeProtectPiece(array $board, array $ctx, array $params): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        $stateEffects = [[
            'type' => 'protect_piece',
            'x' => $target['x'] ?? 0,
            'y' => $target['y'] ?? 0,
            'duration' => $params['duration'] ?? 2,
            'side' => $ctx['player_side'] ?? null
        ]];
        return new SkillEffectResult(true, 'Piece protected', [
            ['type' => 'protect', 'x' => $target['x'] ?? 0, 'y' => $target['y'] ?? 0, 'duration' => $params['duration'] ?? 2]
        ], $board, $stateEffects);
    }

    private function executeBlockCell(array $board, array $ctx, array $params): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        if (!$target || ($board[$target['y']][$target['x']] ?? null) !== null) {
            return new SkillEffectResult(false, 'Invalid target', [], $board);
        }
        
        $board[$target['y']][$target['x']] = 'BLOCKED';
        return new SkillEffectResult(true, 'Cell blocked', [
            ['type' => 'block', 'x' => $target['x'], 'y' => $target['y'], 'duration' => $params['duration'] ?? 2]
        ], $board);
    }

    private function executeImmunityArea(array $board, array $ctx, array $params): SkillEffectResult
    {
        // Wrap shield_area with provided size/duration
        return $this->executeShieldArea($board, $ctx, [
            'size' => $params['size'] ?? 2,
            'duration' => $params['duration'] ?? 3
        ]);
    }

    private function executePermanentProtect(array $board, array $ctx, array $params): SkillEffectResult
    {
        // Protect a piece for a long duration
        return $this->executeProtectPiece($board, $ctx, [
            'duration' => $params['duration'] ?? 99
        ]);
    }

    private function executeSilenceAll(array $ctx, array $params): SkillEffectResult
    {
        $duration = $params['duration'] ?? 2;
        return new SkillEffectResult(true, 'Silence applied', [[
            'type' => 'silence_all',
            'duration' => $duration
        ]], $ctx['board_state'] ?? [], [[
            'type' => 'silence_all',
            'duration' => $duration
        ]]);
    }

    private function executeMutualProtect(array $ctx, array $params): SkillEffectResult
    {
        // Both sides pick pieces to protect (reuse dual protect)
        return $this->executeDualProtect($ctx, $params);
    }

    private function executeProtectLine(array $board, array $ctx, array $params): SkillEffectResult
    {
        return $this->executeWallLine($board, $ctx, $params);
    }

    private function executeDestroyImmunity(array $board, array $ctx, array $params): SkillEffectResult
    {
        // Mark a piece as immune to destroy effects
        $target = $ctx['target_position'] ?? null;
        if (!$target) {
            return new SkillEffectResult(false, 'Must select target', [], $board);
        }
        $duration = $params['duration'] ?? 5;
        $stateEffects = [[
            'type' => 'destroy_immunity',
            'x' => $target['x'],
            'y' => $target['y'],
            'duration' => $duration,
            'side' => $ctx['player_side'] ?? null
        ]];
        return new SkillEffectResult(true, 'Destroy immunity applied', [[
            'type' => 'destroy_immunity',
            'x' => $target['x'],
            'y' => $target['y'],
            'duration' => $duration
        ]], $board, $stateEffects);
    }

    private function executeRestorePiece(array $board, array $ctx): SkillEffectResult
    {
        $lastRemoved = $ctx['last_removed_own'] ?? null;
        if (!$lastRemoved) {
            return new SkillEffectResult(false, 'No piece to restore', [], $board);
        }
        
        $board[$lastRemoved['y']][$lastRemoved['x']] = $ctx['player_side'];
        return new SkillEffectResult(true, 'Piece restored', [
            ['type' => 'place', 'x' => $lastRemoved['x'], 'y' => $lastRemoved['y'], 'side' => $ctx['player_side']]
        ], $board);
    }

    private function executeDodgeNext(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Dodge activated', [['type' => 'modifier', 'effect' => 'dodge_next']], []);
    }

    private function executeAnchorPiece(array $board, array $ctx, array $params): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Piece anchored', [['type' => 'anchor', 'duration' => $params['duration'] ?? 5]], $board);
    }

    /**
     * SKL_058 - Ẩn Thân: Random ẩn 5 quân bất kì của ta và địch
     * Ta vẫn nhìn thấy, địch chỉ thấy vị trí đã đi không hiển thị cờ của ai
     */
    private function executeHidePieces(array $board, array $ctx, array $params): SkillEffectResult
    {
        $count = $params['count'] ?? 5;
        $duration = $params['duration'] ?? 5;
        $playerSide = $ctx['player_side'];
        $enemySide = $ctx['enemy_side'];
        
        // Collect all pieces
        $allPieces = [];
        for ($y = 0; $y < 15; $y++) {
            for ($x = 0; $x < 15; $x++) {
                $cell = $board[$y][$x] ?? null;
                if ($cell !== null && $cell !== 'BLOCKED') {
                    $allPieces[] = ['x' => $x, 'y' => $y, 'side' => $cell];
                }
            }
        }
        
        // Check minimum pieces requirement
        if (count($allPieces) < $count) {
            return new SkillEffectResult(false, 'Not enough pieces on board (need ' . $count . ')', [], $board);
        }
        
        // Random select pieces to hide
        shuffle($allPieces);
        $hiddenPieces = array_slice($allPieces, 0, $count);
        
        $stateEffects = [[
            'type' => 'hide_pieces',
            'positions' => $hiddenPieces,
            'duration' => $duration,
            'owner' => $playerSide, // Owner can still see
            'hidden_from' => $enemySide // Hidden from enemy
        ]];
        
        return new SkillEffectResult(true, 'Hidden ' . count($hiddenPieces) . ' pieces', [
            ['type' => 'hide_pieces', 'positions' => $hiddenPieces, 'duration' => $duration, 'owner' => $playerSide]
        ], $board, $stateEffects);
    }

    private function executeReflectAttack(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Reflect activated', [['type' => 'modifier', 'effect' => 'reflect_attack']], []);
    }

    private function executeAddTime(array $ctx, array $params): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Time added', [['type' => 'time_modifier', 'target' => 'self', 'seconds' => $params['seconds'] ?? 10]], []);
    }

    /**
     * SKL_010 - Hồi Không: Mana quay về 15. Loại bỏ 1 lá bài trong deck vĩnh viễn đến hết trận
     * Cost: 0 mana, nhưng phải sacrifice 1 card
     */
    private function executeRestoreMana(array $ctx, array $params): SkillEffectResult
    {
        $sacrificeSkillId = $ctx['sacrifice_skill_id'] ?? null;
        
        $stateEffects = [[
            'type' => 'mana_restore',
            'amount' => 15,
            'cap' => 15
        ]];
        
        // If sacrifice is required, add deck removal effect
        if ($sacrificeSkillId) {
            $stateEffects[] = [
                'type' => 'remove_from_deck',
                'skill_id' => $sacrificeSkillId,
                'permanent' => true
            ];
        }
        
        return new SkillEffectResult(true, 'Mana restored to 15', [
            ['type' => 'mana_restore', 'amount' => 15, 'cap' => 15],
            ['type' => 'remove_from_deck', 'skill_id' => $sacrificeSkillId]
        ], $ctx['board_state'] ?? [], $stateEffects);
    }

    private function executeDoubleNext(array $ctx, array $params): SkillEffectResult
    {
        $multiplier = $params['multiplier'] ?? 2.0;
        return $this->executeBuffNextMultiplier($ctx, ['multiplier' => $multiplier]);
    }

    private function executeDisableSkills(array $ctx, array $params): SkillEffectResult
    {
        return $this->executeFreezeSkills($ctx, $params);
    }

    private function executeImmobilize(array $board, array $ctx, array $params): SkillEffectResult
    {
        return $this->executeAnchorPiece($board, $ctx, $params);
    }

    private function executeRemoveImmobilize(array $ctx): SkillEffectResult
    {
        return $this->executeRemoveAnchor($ctx);
    }

    private function executeTurnManipulation(array $ctx): SkillEffectResult
    {
        return $this->executeSwapTurnOrder($ctx);
    }

    private function executeDoubleSkill(array $ctx): SkillEffectResult
    {
        return $this->executeTwoSkillsNextTurn($ctx);
    }

    private function executeBreakChain(array $board, array $ctx, array $params): SkillEffectResult
    {
        return $this->executePushSplitChain($board, $ctx, $params);
    }

    private function executeReflectTrapSkill(array $ctx, array $params): SkillEffectResult
    {
        return $this->executeTrapReflect($ctx, $params);
    }

    private function executeFakePiece(array $ctx, array $params): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        $duration = $params['duration'] ?? 5;
        return new SkillEffectResult(true, 'Fake piece created', [[
            'type' => 'fake_piece',
            'position' => $target,
            'duration' => $duration
        ]], $ctx['board_state'] ?? [], [[
            'type' => 'fake_piece',
            'position' => $target,
            'duration' => $duration
        ]]);
    }

    private function executeBuffImmunity(array $ctx, array $params): SkillEffectResult
    {
        return $this->executeBlockFutureBuffs($ctx, $params);
    }

    private function executeSpreadStatusGeneric(array $board, array $ctx, string $status, array $params): SkillEffectResult
    {
        $params['status'] = $status;
        return $this->executeSpreadStatus($board, $ctx, $params);
    }

    private function executeCounterElement(array $ctx, string $element): SkillEffectResult
    {
        return $this->executeCleanseElement($ctx, ['element' => $element]);
    }

    private function executeShieldArea(array $board, array $ctx, array $params): SkillEffectResult
    {
        $stateEffects = [[
            'type' => 'shield_area',
            'center' => $ctx['target_position'] ?? null,
            'size' => $params['size'] ?? 2,
            'duration' => $params['duration'] ?? 3,
            'side' => $ctx['player_side'] ?? null
        ]];
        return new SkillEffectResult(true, 'Shield created', [['type' => 'shield_area']], $board, $stateEffects);
    }

    private function executeWallLine(array $board, array $ctx, array $params): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Wall created', [['type' => 'wall', 'length' => $params['length'] ?? 3]], $board);
    }

    private function executeSwapOwn(array $board, array $ctx): SkillEffectResult
    {
        $pos1 = $ctx['target_positions'][0] ?? null;
        $pos2 = $ctx['target_positions'][1] ?? null;
        
        if (!$pos1 || !$pos2) {
            return new SkillEffectResult(false, 'Must select 2 positions', [], $board);
        }

        $playerSide = $ctx['player_side'];
        if (($board[$pos1['y']][$pos1['x']] ?? null) !== $playerSide || 
            ($board[$pos2['y']][$pos2['x']] ?? null) !== $playerSide) {
            return new SkillEffectResult(false, 'Both must be your pieces', [], $board);
        }

        // Swap (same side, so no actual change needed visually, but positions tracked)
        return new SkillEffectResult(true, 'Pieces swapped', [
            ['type' => 'swap', 'from' => $pos1, 'to' => $pos2]
        ], $board);
    }

    private function executeCopyMove(array $board, array $ctx): SkillEffectResult
    {
        $lastEnemyMove = $ctx['last_enemy_move'] ?? null;
        if (!$lastEnemyMove) {
            return new SkillEffectResult(false, 'No enemy move to copy', [], $board);
        }

        // Mirror the position
        $mirrorX = 14 - $lastEnemyMove['x'];
        $mirrorY = 14 - $lastEnemyMove['y'];
        
        if (($board[$mirrorY][$mirrorX] ?? null) !== null) {
            return new SkillEffectResult(false, 'Mirror position not empty', [], $board);
        }

        $board[$mirrorY][$mirrorX] = $ctx['player_side'];
        return new SkillEffectResult(true, 'Move copied', [
            ['type' => 'place', 'x' => $mirrorX, 'y' => $mirrorY, 'side' => $ctx['player_side']]
        ], $board);
    }

    // ==================== UTILITY SKILLS ====================

    private function executeAiSuggest(array $board, array $ctx, array $params): SkillEffectResult
    {
        // Would call AI service
        return new SkillEffectResult(true, 'AI suggestions', [
            ['type' => 'suggest', 'positions' => [['x' => 7, 'y' => 7], ['x' => 8, 'y' => 7]]]
        ], $board);
    }

    private function executePeekSkills(array $ctx, array $params): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Peeked skills', [['type' => 'peek', 'count' => $params['count'] ?? 2]], []);
    }

    private function executeRerollSkills(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Skills rerolled', [['type' => 'reroll']], []);
    }

    private function executeSaveSkill(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Skill saved', [['type' => 'save_skill']], []);
    }

    /**
     * SKL_009 - Hồi Quy: Giảm thời gian CD tất cả skill đang hồi đi một nửa
     * Không áp dụng cho skill cực hiếm hoặc skill chỉ dùng 1 lần
     */
    private function executeReduceCooldown(array $ctx, array $params): SkillEffectResult
    {
        $amount = $params['amount'] ?? 0.5; // Default 50% reduction
        $stateEffects = [[
            'type' => 'reduce_cooldown',
            'amount' => $amount,
            'exclude_legendary' => true,
            'exclude_one_time' => true
        ]];
        return new SkillEffectResult(true, 'Cooldowns reduced by ' . ($amount * 100) . '%', [
            ['type' => 'reduce_cd', 'amount' => $amount, 'exclude_legendary' => true]
        ], $ctx['board_state'] ?? [], $stateEffects);
    }

    private function executeIncreaseEnemyCd(array $ctx, array $params): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Enemy cooldown increased', [['type' => 'increase_enemy_cd', 'amount' => $params['amount'] ?? 2]], []);
    }

    private function executeShowThreats(array $board, array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Threats shown', [['type' => 'show_threats']], $board);
    }

    private function executeResetOneCd(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Cooldown reset', [['type' => 'reset_one_cd']], []);
    }

    private function executeAiAnalyze(array $board, array $ctx, array $params): SkillEffectResult
    {
        return new SkillEffectResult(true, 'AI analysis', [['type' => 'ai_analyze', 'detailed' => $params['detailed'] ?? true]], $board);
    }

    private function executeUndoEnemy(array $board, array $ctx): SkillEffectResult
    {
        $lastEnemyMove = $ctx['last_enemy_move'] ?? null;
        if (!$lastEnemyMove) {
            return new SkillEffectResult(false, 'No enemy move to undo', [], $board);
        }

        $board[$lastEnemyMove['y']][$lastEnemyMove['x']] = null;
        return new SkillEffectResult(true, 'Enemy move undone', [
            ['type' => 'remove', 'x' => $lastEnemyMove['x'], 'y' => $lastEnemyMove['y']]
        ], $board);
    }

    private function executeFreezeSkills(array $ctx, array $params): SkillEffectResult
    {
        $stateEffects = [[
            'type' => 'freeze_skills',
            'duration' => $params['duration'] ?? 2,
            'target' => $ctx['target_player_id'] ?? 'opponent'
        ]];
        return new SkillEffectResult(true, 'Enemy skills frozen', [['type' => 'freeze', 'duration' => $params['duration'] ?? 2]], [], $stateEffects);
    }

    private function executeExtendTurn(array $ctx, array $params): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Turn extended', [
            ['type' => 'time_modifier', 'target' => 'self', 'seconds' => $params['seconds'] ?? 30],
            ['type' => 'ai_analyze', 'detailed' => true]
        ], []);
    }

    private function executeExtraTurn(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Extra turn granted', [
            ['type' => 'extra_turn']
        ], $ctx['board_state'] ?? []);
    }

    // ==================== SPECIAL SKILLS ====================

    private function executeForceMoveFixed(array $board, array $ctx, array $params): SkillEffectResult
    {
        return $this->executeForceMoveAnchor($board, $ctx);
    }

    private function executeRemoveEnemySkill(array $ctx): SkillEffectResult
    {
        // Reuse erase enemy skill logic
        return $this->executeEraseEnemySkill($ctx);
    }

    private function executeForceReveal(array $ctx): SkillEffectResult
    {
        return $this->executeForceNextCell($ctx);
    }

    private function executeTeleportPiece(array $board, array $ctx): SkillEffectResult
    {
        $from = $ctx['target_positions'][0] ?? null;
        $to = $ctx['target_positions'][1] ?? null;
        $playerSide = $ctx['player_side'];

        if (!$from || !$to) {
            return new SkillEffectResult(false, 'Must select from and to positions', [], $board);
        }

        if (($board[$from['y']][$from['x']] ?? null) !== $playerSide) {
            return new SkillEffectResult(false, 'Source must be your piece', [], $board);
        }

        if (($board[$to['y']][$to['x']] ?? null) !== null) {
            return new SkillEffectResult(false, 'Destination must be empty', [], $board);
        }

        $board[$from['y']][$from['x']] = null;
        $board[$to['y']][$to['x']] = $playerSide;

        return new SkillEffectResult(true, 'Piece teleported', [
            ['type' => 'remove', 'x' => $from['x'], 'y' => $from['y']],
            ['type' => 'place', 'x' => $to['x'], 'y' => $to['y'], 'side' => $playerSide]
        ], $board);
    }

    private function executeClonePiece(array $board, array $ctx): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        $playerSide = $ctx['player_side'];

        if (!$target || ($board[$target['y']][$target['x']] ?? null) !== $playerSide) {
            return new SkillEffectResult(false, 'Must select your piece', [], $board);
        }

        $adjacent = $this->getAdjacentEmptyCells($board, $target['x'], $target['y']);
        if (empty($adjacent)) {
            return new SkillEffectResult(false, 'No adjacent empty cell', [], $board);
        }

        $clonePos = $ctx['clone_position'] ?? $adjacent[0];
        $board[$clonePos['y']][$clonePos['x']] = $playerSide;

        return new SkillEffectResult(true, 'Piece cloned', [
            ['type' => 'place', 'x' => $clonePos['x'], 'y' => $clonePos['y'], 'side' => $playerSide]
        ], $board);
    }

    private function executeResetAllCd(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'All cooldowns reset', [['type' => 'reset_all_cd']], []);
    }

    private function executeChooseNextSkills(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Choose next skills activated', [['type' => 'choose_next_skills']], []);
    }

    /**
     * Generic handler for skills chưa map chi tiết.
     * Trả về success để client xử lý logic hiển thị, không thay đổi board.
     */
    private function executeCustomEffect(array $ctx, array $skill): SkillEffectResult
    {
        return new SkillEffectResult(
            true,
            $skill['name_vi'] ?? 'Custom effect applied',
            [['type' => 'custom_effect', 'skill_id' => $skill['id'] ?? null]],
            $ctx['board_state'] ?? []
        );
    }

    private function executeSpreadStatus(array $board, array $ctx, array $params): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        if (!$target) {
            return new SkillEffectResult(false, 'Must select target', [], $board);
        }
        $status = $params['status'] ?? 'effect';
        $maxTargets = $params['max_targets'] ?? 5;
        $duration = $params['duration'] ?? 5;

        $positions = [$target];
        $neighbors = $this->getNeighborPositions($target['x'], $target['y']);
        foreach ($neighbors as $pos) {
            if (count($positions) >= $maxTargets) break;
            $positions[] = $pos;
        }

        $stateEffects = [[
            'type' => 'status_spread',
            'status' => $status,
            'positions' => $positions,
            'duration' => $duration
        ]];

        return new SkillEffectResult(true, 'Status spread', [[
            'type' => 'status_spread',
            'status' => $status,
            'duration' => $duration,
            'positions' => $positions
        ]], $board, $stateEffects);
    }

    private function executeCleanseElement(array $ctx, array $params): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Cleanse element', [[
            'type' => 'cleanse',
            'element' => $params['element'] ?? 'all'
        ]], $ctx['board_state'] ?? [], [[
            'type' => 'cleanse',
            'element' => $params['element'] ?? 'all',
            'duration' => 0
        ]]);
    }

    /**
     * SKL_002 - Lưỡi Dao Gió: Random chọn 1 hàng/cột/đường chéo, phá hủy tất cả quân trên đường đó
     */
    private function executeLineDestroy(array $board, array $ctx, array $params): SkillEffectResult
    {
        // Random direction: row, col, diagonal_main, diagonal_anti
        $directions = ['row', 'col', 'diagonal_main', 'diagonal_anti'];
        $direction = $params['direction'] ?? $directions[mt_rand(0, 3)];
        
        $changes = [];
        $size = 15;
        
        if ($direction === 'row') {
            // Random row
            $y = mt_rand(0, $size - 1);
            for ($x = 0; $x < $size; $x++) {
                if (($board[$y][$x] ?? null) !== null && $board[$y][$x] !== 'BLOCKED') {
                    $changes[] = ['type' => 'remove', 'x' => $x, 'y' => $y, 'side' => $board[$y][$x]];
                    $board[$y][$x] = null;
                }
            }
        } elseif ($direction === 'col') {
            // Random column
            $x = mt_rand(0, $size - 1);
            for ($y = 0; $y < $size; $y++) {
                if (($board[$y][$x] ?? null) !== null && $board[$y][$x] !== 'BLOCKED') {
                    $changes[] = ['type' => 'remove', 'x' => $x, 'y' => $y, 'side' => $board[$y][$x]];
                    $board[$y][$x] = null;
                }
            }
        } elseif ($direction === 'diagonal_main') {
            // Random main diagonal (top-left to bottom-right)
            $offset = mt_rand(-($size - 1), $size - 1);
            for ($i = 0; $i < $size; $i++) {
                $x = $i;
                $y = $i - $offset;
                if ($x >= 0 && $x < $size && $y >= 0 && $y < $size) {
                    if (($board[$y][$x] ?? null) !== null && $board[$y][$x] !== 'BLOCKED') {
                        $changes[] = ['type' => 'remove', 'x' => $x, 'y' => $y, 'side' => $board[$y][$x]];
                        $board[$y][$x] = null;
                    }
                }
            }
        } else { // diagonal_anti
            // Random anti-diagonal (top-right to bottom-left)
            $offset = mt_rand(0, 2 * ($size - 1));
            for ($i = 0; $i < $size; $i++) {
                $x = $i;
                $y = $offset - $i;
                if ($x >= 0 && $x < $size && $y >= 0 && $y < $size) {
                    if (($board[$y][$x] ?? null) !== null && $board[$y][$x] !== 'BLOCKED') {
                        $changes[] = ['type' => 'remove', 'x' => $x, 'y' => $y, 'side' => $board[$y][$x]];
                        $board[$y][$x] = null;
                    }
                }
            }
        }

        return new SkillEffectResult(true, "Line destroyed ($direction)", $changes, $board);
    }

    private function executeShuffleArea(array $board, array $ctx, array $params): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        if (!$target) {
            return new SkillEffectResult(false, 'Must select target', [], $board);
        }
        $radius = $params['radius'] ?? 1;
        $cells = [];
        for ($dy = -$radius; $dy <= $radius; $dy++) {
            for ($dx = -$radius; $dx <= $radius; $dx++) {
                $x = $target['x'] + $dx;
                $y = $target['y'] + $dy;
                if ($x >= 0 && $x < 15 && $y >= 0 && $y < 15 && ($board[$y][$x] ?? null) !== null) {
                    $cells[] = ['x' => $x, 'y' => $y, 'side' => $board[$y][$x]];
                }
            }
        }
        if (empty($cells)) {
            return new SkillEffectResult(false, 'No pieces to shuffle', [], $board);
        }
        // Shuffle destinations
        $dest = $cells;
        shuffle($dest);
        $changes = [];
        foreach ($cells as $idx => $cell) {
            $from = $cell;
            $to = $dest[$idx];
            $board[$from['y']][$from['x']] = null;
            $board[$to['y']][$to['x']] = $from['side'];
            $changes[] = ['type' => 'move', 'from' => ['x' => $from['x'], 'y' => $from['y']], 'to' => ['x' => $to['x'], 'y' => $to['y']], 'side' => $from['side']];
        }
        return new SkillEffectResult(true, 'Area shuffled', $changes, $board);
    }

    private function executeZoneBlock(array $board, array $ctx, array $params): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        if (!$target) {
            return new SkillEffectResult(false, 'Must select target', [], $board);
        }
        $radius = $params['radius'] ?? 1;
        $duration = $params['duration'] ?? 3;
        $changes = [];
        for ($dy = -$radius; $dy <= $radius; $dy++) {
            for ($dx = -$radius; $dx <= $radius; $dx++) {
                $x = $target['x'] + $dx;
                $y = $target['y'] + $dy;
                if ($x >= 0 && $x < 15 && $y >= 0 && $y < 15) {
                    $board[$y][$x] = 'BLOCKED';
                    $changes[] = ['type' => 'block', 'x' => $x, 'y' => $y, 'duration' => $duration];
                }
            }
        }
        return new SkillEffectResult(true, 'Zone blocked', $changes, $board);
    }

    private function executeResetArea(array $board, array $ctx, array $params): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        if (!$target) {
            return new SkillEffectResult(false, 'Must select target', [], $board);
        }
        $size = max(1, (int)($params['size'] ?? 4));
        $offset = intdiv($size, 2);
        $startX = $target['x'] - $offset + ($size % 2 === 0 ? 1 : 0);
        $startY = $target['y'] - $offset + ($size % 2 === 0 ? 1 : 0);

        $changes = [];
        for ($y = $startY; $y < $startY + $size; $y++) {
            for ($x = $startX; $x < $startX + $size; $x++) {
                if ($x < 0 || $x >= 15 || $y < 0 || $y >= 15) {
                    continue;
                }
                if (($board[$y][$x] ?? null) !== null) {
                    $changes[] = ['type' => 'remove', 'x' => $x, 'y' => $y];
                    $board[$y][$x] = null;
                }
            }
        }

        return new SkillEffectResult(true, 'Area reset', $changes, $board);
    }

    private function executeBanishPiece(array $board, array $ctx, array $params): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        $enemySide = $ctx['enemy_side'];
        if (!$target) {
            return new SkillEffectResult(false, 'Must select target', [], $board);
        }
        if (($board[$target['y']][$target['x']] ?? null) !== $enemySide) {
            return new SkillEffectResult(false, 'Target must be enemy piece', [], $board);
        }
        $board[$target['y']][$target['x']] = null;
        return new SkillEffectResult(true, 'Piece banished', [
            ['type' => 'remove', 'x' => $target['x'], 'y' => $target['y'], 'return_after' => $params['duration'] ?? 3]
        ], $board);
    }

    private function executeRevealArea(array $ctx, array $params): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        $radius = $params['radius'] ?? 1;
        return new SkillEffectResult(true, 'Area revealed', [[
            'type' => 'reveal_area',
            'center' => $target,
            'radius' => $radius
        ]], $ctx['board_state'] ?? []);
    }

    private function executeDualProtect(array $ctx, array $params): SkillEffectResult
    {
        $positions = $ctx['target_positions'] ?? [];
        if (count($positions) !== 2) {
            return new SkillEffectResult(false, 'Must pick 2 pieces', [], $ctx['board_state'] ?? []);
        }
        $stateEffects = [[
            'type' => 'dual_protect',
            'positions' => $positions,
            'duration' => $params['duration'] ?? 5,
            'side' => $ctx['player_side'] ?? null
        ]];
        return new SkillEffectResult(true, 'Dual protect set', [[
            'type' => 'protect_dual',
            'positions' => $positions,
            'duration' => $params['duration'] ?? 5
        ]], $ctx['board_state'] ?? [], $stateEffects);
    }

    private function executeBuffNextMultiplier(array $ctx, array $params): SkillEffectResult
    {
        $stateEffects = [[
            'type' => 'buff_next',
            'multiplier' => $params['multiplier'] ?? 2,
            'duration' => 1
        ]];
        return new SkillEffectResult(true, 'Buff next skill', [[
            'type' => 'buff_next',
            'multiplier' => $params['multiplier'] ?? 2
        ]], $ctx['board_state'] ?? [], $stateEffects);
    }

    private function executeRedirectDamage(array $ctx, array $params): SkillEffectResult
    {
        $stateEffects = [[
            'type' => 'redirect_damage',
            'duration' => $params['duration'] ?? 3,
            'redirect_to' => $ctx['target_position'] ?? ($ctx['target_positions'][0] ?? null),
            'side' => $ctx['player_side'] ?? null
        ]];
        return new SkillEffectResult(true, 'Redirect set', [[
            'type' => 'redirect_damage',
            'duration' => $params['duration'] ?? 3
        ]], $ctx['board_state'] ?? [], $stateEffects);
    }

    private function executeDeckLock(array $ctx, array $params): SkillEffectResult
    {
        $stateEffects = [[
            'type' => 'deck_lock',
            'count' => $params['count'] ?? 10,
            'duration' => $params['duration'] ?? 5,
            'target' => $ctx['target_player_id'] ?? 'opponent'
        ]];
        return new SkillEffectResult(true, 'Deck locked', [[
            'type' => 'deck_lock',
            'count' => $params['count'] ?? 10,
            'duration' => $params['duration'] ?? 5
        ]], $ctx['board_state'] ?? [], $stateEffects);
    }

    private function executeProtectAll(array $ctx, array $params): SkillEffectResult
    {
        $stateEffects = [[
            'type' => 'protect_all',
            'duration' => $params['duration'] ?? 5,
            'side' => $ctx['player_side'] ?? null
        ]];
        return new SkillEffectResult(true, 'Protect all pieces', [[
            'type' => 'protect_all',
            'duration' => $params['duration'] ?? 5
        ]], $ctx['board_state'] ?? [], $stateEffects);
    }

    /**
     * SKL_046 - Khí Hồn: Random sinh ra hiệu ứng của 1 skill bất kỳ trong 60 skill
     * Tỷ lệ: 50% thường, 49% hiếm, 1% cực hiếm
     * Nếu có luck buff: tăng tỷ lệ hiếm và cực hiếm
     */
    private function executeRandomEffect(array $board, array $ctx)
    {
        $luckStacks = $ctx['luck_stacks'] ?? 0;
        
        // Base rates: 50% common, 49% rare, 1% legendary
        $commonRate = 0.50 - ($luckStacks * 0.075); // Giảm 7.5% mỗi stack
        $rareRate = 0.49 + ($luckStacks * 0.055);   // Tăng 5.5% mỗi stack
        $legendaryRate = 0.01 + ($luckStacks * 0.02); // Tăng 2% mỗi stack
        
        // Clamp rates (min 35% common, max 60% rare, max 5% legendary)
        $commonRate = max(0.35, $commonRate);
        $rareRate = min(0.60, $rareRate);
        $legendaryRate = min(0.05, $legendaryRate);
        
        // Normalize
        $total = $commonRate + $rareRate + $legendaryRate;
        $commonRate /= $total;
        $rareRate /= $total;
        
        $roll = mt_rand(0, 10000) / 10000;
        
        if ($roll < $commonRate) {
            // Common skills effects
            $commonEffects = [
                fn() => $this->executeDestroyPiece($board, $ctx),
                fn() => $this->executeBlockCell($board, $ctx, ['permanent' => false, 'duration' => 3]),
                fn() => $this->executeBurnArea($board, $ctx, ['radius' => 1, 'duration' => 3]),
                fn() => $this->executeTeleportPiece($board, $ctx),
                fn() => $this->executeProtectPiece($board, $ctx, ['duration' => 3]),
                fn() => $this->executeDodgeNext($ctx),
                fn() => $this->executeReduceCooldown($ctx, ['amount' => 0.5]),
            ];
            $effect = $commonEffects[mt_rand(0, count($commonEffects) - 1)];
            $result = $effect();
            $result->message = '[Common] ' . $result->message;
            return $result;
        } elseif ($roll < $commonRate + $rareRate) {
            // Rare skills effects
            $rareEffects = [
                fn() => $this->executeExtraTurn($ctx),
                fn() => $this->executeSpreadStatusGeneric($board, $ctx, 'fire', ['duration' => 5]),
                fn() => $this->executeSpreadStatusGeneric($board, $ctx, 'ice', ['duration' => 5]),
                fn() => $this->executeConvertPiece($board, $ctx),
                fn() => $this->executeLuckBuff($ctx, ['amount' => 0.1, 'max_stack' => 2]),
            ];
            $effect = $rareEffects[mt_rand(0, count($rareEffects) - 1)];
            $result = $effect();
            $result->message = '[Rare] ' . $result->message;
            return $result;
        } else {
            // Legendary skills effects
            $legendaryEffects = [
                fn() => $this->executeProtectAll($ctx, ['duration' => 3]),
                fn() => $this->executePurgeBuffs($ctx),
                fn() => $this->executeResetArea($board, $ctx, ['size' => 3]),
                fn() => $this->executeChaosJump($board, $ctx),
            ];
            $effect = $legendaryEffects[mt_rand(0, count($legendaryEffects) - 1)];
            $result = $effect();
            $result->message = '[LEGENDARY!] ' . $result->message;
            return $result;
        }
    }

    private function executeRemoveDebuff(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Debuff removed', [['type' => 'remove_debuff']], $ctx['board_state'] ?? []);
    }

    private function executeRemoveAnchor(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Anchor removed', [['type' => 'remove_anchor']], $ctx['board_state'] ?? []);
    }

    private function executeForceMoveAnchor(array $board, array $ctx): SkillEffectResult
    {
        $positions = $ctx['target_positions'] ?? [];
        if (count($positions) !== 2) {
            return new SkillEffectResult(false, 'Must select from/to', [], $board);
        }
        [$from, $to] = $positions;
        if (($board[$from['y']][$from['x']] ?? null) === null) {
            return new SkillEffectResult(false, 'No piece to move', [], $board);
        }
        if (($board[$to['y']][$to['x']] ?? null) !== null) {
            return new SkillEffectResult(false, 'Destination not empty', [], $board);
        }
        $piece = $board[$from['y']][$from['x']];
        $board[$from['y']][$from['x']] = null;
        $board[$to['y']][$to['x']] = $piece;
        return new SkillEffectResult(true, 'Forced move', [
            ['type' => 'remove', 'x' => $from['x'], 'y' => $from['y']],
            ['type' => 'place', 'x' => $to['x'], 'y' => $to['y'], 'side' => $piece]
        ], $board);
    }

    private function executeExtendBuffs(array $ctx, array $params): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Buffs extended', [[
            'type' => 'extend_buffs',
            'extra_duration' => $params['extra_duration'] ?? 1
        ]], $ctx['board_state'] ?? []);
    }

    private function executeSwapTurnOrder(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Turn order swapped', [['type' => 'swap_turn_order']], $ctx['board_state'] ?? []);
    }

    /**
     * SKL_033 - Nguyên Quyết: Xóa vĩnh viễn 1 skill trong deck địch
     * Hy sinh 1 skill cùng độ hiếm để xóa
     * SKL_053 - Đạo Tặc: Lấy 1 skill hiếm/cực hiếm từ deck địch, dùng ngay
     */
    private function executeEraseEnemySkill(array $ctx): SkillEffectResult
    {
        $targetSkillId = $ctx['target_skill_id'] ?? null;
        $sacrificeSkillId = $ctx['sacrifice_skill_id'] ?? null;
        
        $stateEffects = [[
            'type' => 'erase_enemy_skill',
            'target_skill_id' => $targetSkillId,
            'sacrifice_skill_id' => $sacrificeSkillId,
            'permanent' => true
        ]];
        
        return new SkillEffectResult(true, 'Enemy skill erased from deck', [
            ['type' => 'erase_enemy_skill', 'target_skill_id' => $targetSkillId]
        ], $ctx['board_state'] ?? [], $stateEffects);
    }

    private function executeSwapPieces(array $board, array $ctx): SkillEffectResult
    {
        $positions = $ctx['target_positions'] ?? [];
        if (count($positions) !== 2) {
            return new SkillEffectResult(false, 'Must select 2 pieces', [], $board);
        }
        [$p1, $p2] = $positions;
        $piece1 = $board[$p1['y']][$p1['x']] ?? null;
        $piece2 = $board[$p2['y']][$p2['x']] ?? null;
        if ($piece1 === null || $piece2 === null) {
            return new SkillEffectResult(false, 'Both positions must have pieces', [], $board);
        }
        $board[$p1['y']][$p1['x']] = $piece2;
        $board[$p2['y']][$p2['x']] = $piece1;
        return new SkillEffectResult(true, 'Pieces swapped', [
            ['type' => 'swap', 'from' => $p1, 'to' => $p2]
        ], $board);
    }

    /**
     * SKL_056 - Khai Nguyên: Chọn lại 1 skill đã dùng từ đầu ván để dùng lại ngay
     * Hy sinh 1 skill cùng độ hiếm, không dùng trong 5 lượt tới
     * Mana cost: 8 cho thường, 10 cho hiếm, 15 cho cực hiếm
     */
    private function executeReuseSkill(array $ctx): SkillEffectResult
    {
        $targetSkillId = $ctx['reuse_skill_id'] ?? null;
        $sacrificeSkillId = $ctx['sacrifice_skill_id'] ?? null;
        
        if (!$targetSkillId) {
            return new SkillEffectResult(false, 'Must select a skill to reuse', [], $ctx['board_state'] ?? []);
        }
        
        $stateEffects = [[
            'type' => 'reuse_skill',
            'target_skill_id' => $targetSkillId,
            'sacrifice_skill_id' => $sacrificeSkillId,
            'sacrifice_duration' => 5 // Cannot use sacrificed skill for 5 turns
        ]];
        
        return new SkillEffectResult(true, 'Skill ready to reuse', [
            ['type' => 'reuse_skill', 'skill_id' => $targetSkillId],
            ['type' => 'sacrifice_skill', 'skill_id' => $sacrificeSkillId, 'duration' => 5]
        ], $ctx['board_state'] ?? [], $stateEffects);
    }

    private function executeTwoSkillsNextTurn(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Can use two skills next turn', [['type' => 'two_skills_next_turn']], $ctx['board_state'] ?? []);
    }

    private function executeForceNextCell(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Force enemy to choose next cell', [['type' => 'force_next_cell']], $ctx['board_state'] ?? []);
    }

    /**
     * SKL_054 - Lưỡng Nguyên: Chọn liên tục các quân trên bàn cờ, mỗi quân random 50% có lợi / 50% bất lợi
     * Cực hiếm - chỉ dùng 1 lần
     */
    private function executeChaosBoard(array $ctx): SkillEffectResult
    {
        $board = $ctx['board_state'] ?? [];
        $playerSide = $ctx['player_side'];
        $enemySide = $ctx['enemy_side'];
        $luckStacks = $ctx['luck_stacks'] ?? 0;
        
        // Adjust chance based on luck buff (base 50%, max 70% favorable)
        $favorableChance = 0.5 + ($luckStacks * 0.1);
        $favorableChance = min(0.7, $favorableChance);
        
        $changes = [];
        $stateEffects = [];
        
        // Collect all pieces
        $pieces = [];
        for ($y = 0; $y < 15; $y++) {
            for ($x = 0; $x < 15; $x++) {
                $cell = $board[$y][$x] ?? null;
                if ($cell !== null && $cell !== 'BLOCKED') {
                    $pieces[] = ['x' => $x, 'y' => $y, 'side' => $cell];
                }
            }
        }
        
        // Apply random effect to each piece
        foreach ($pieces as $piece) {
            $roll = mt_rand(0, 10000) / 10000;
            $isFavorable = $roll < $favorableChance;
            $isOwnPiece = $piece['side'] === $playerSide;
            
            // Favorable for player = good for own pieces, bad for enemy
            // Unfavorable = bad for own pieces, good for enemy
            $shouldBenefit = ($isFavorable && $isOwnPiece) || (!$isFavorable && !$isOwnPiece);
            
            if ($shouldBenefit) {
                // Beneficial effects: protect, buff
                $effectType = mt_rand(0, 2);
                if ($effectType === 0) {
                    // Protect for 2 turns
                    $stateEffects[] = [
                        'type' => 'protect_piece',
                        'x' => $piece['x'],
                        'y' => $piece['y'],
                        'duration' => 2,
                        'side' => $piece['side']
                    ];
                    $changes[] = ['type' => 'buff', 'x' => $piece['x'], 'y' => $piece['y'], 'effect' => 'protect'];
                } elseif ($effectType === 1) {
                    // Immunity to destroy
                    $stateEffects[] = [
                        'type' => 'destroy_immunity',
                        'x' => $piece['x'],
                        'y' => $piece['y'],
                        'duration' => 3,
                        'side' => $piece['side']
                    ];
                    $changes[] = ['type' => 'buff', 'x' => $piece['x'], 'y' => $piece['y'], 'effect' => 'immunity'];
                } else {
                    // Nothing happens (lucky escape)
                    $changes[] = ['type' => 'lucky', 'x' => $piece['x'], 'y' => $piece['y']];
                }
            } else {
                // Harmful effects: damage, debuff, remove
                $effectType = mt_rand(0, 2);
                if ($effectType === 0) {
                    // Remove piece
                    $board[$piece['y']][$piece['x']] = null;
                    $changes[] = ['type' => 'remove', 'x' => $piece['x'], 'y' => $piece['y'], 'side' => $piece['side']];
                } elseif ($effectType === 1) {
                    // Immobilize for 3 turns
                    $stateEffects[] = [
                        'type' => 'immobilize',
                        'x' => $piece['x'],
                        'y' => $piece['y'],
                        'duration' => 3,
                        'side' => $piece['side']
                    ];
                    $changes[] = ['type' => 'debuff', 'x' => $piece['x'], 'y' => $piece['y'], 'effect' => 'immobilize'];
                } else {
                    // Seal (cannot receive buffs)
                    $stateEffects[] = [
                        'type' => 'seal_buff',
                        'x' => $piece['x'],
                        'y' => $piece['y'],
                        'duration' => 3,
                        'side' => $piece['side']
                    ];
                    $changes[] = ['type' => 'debuff', 'x' => $piece['x'], 'y' => $piece['y'], 'effect' => 'seal'];
                }
            }
        }
        
        return new SkillEffectResult(
            true, 
            'Chaos applied to ' . count($pieces) . ' pieces', 
            $changes, 
            $board, 
            $stateEffects
        );
    }

    private function executeConvertPiece(array $board, array $ctx): SkillEffectResult
    {
        $target = $ctx['target_position'] ?? null;
        $enemySide = $ctx['enemy_side'];
        $playerSide = $ctx['player_side'];
        if (!$target) {
            return new SkillEffectResult(false, 'Must select target', [], $board);
        }
        if (($board[$target['y']][$target['x']] ?? null) !== $enemySide) {
            return new SkillEffectResult(false, 'Target must be enemy piece', [], $board);
        }
        $board[$target['y']][$target['x']] = $playerSide;
        return new SkillEffectResult(true, 'Piece converted', [
            ['type' => 'place', 'x' => $target['x'], 'y' => $target['y'], 'side' => $playerSide]
        ], $board);
    }

    private function executeLuckBuff(array $ctx, array $params): SkillEffectResult
    {
        $stateEffects = [[
            'type' => 'luck_buff',
            'max_stack' => $params['max_stack'] ?? 3,
            'duration' => 3
        ]];
        return new SkillEffectResult(true, 'Luck buff applied', [[
            'type' => 'luck_buff',
            'max_stack' => $params['max_stack'] ?? 3
        ]], $ctx['board_state'] ?? [], $stateEffects);
    }

    private function executePushSplitChain(array $board, array $ctx, array $params): SkillEffectResult
    {
        $positions = $ctx['target_positions'] ?? [];
        $enemySide = $ctx['enemy_side'];
        if (count($positions) !== 2) {
            return new SkillEffectResult(false, 'Must select 2 enemy pieces', [], $board);
        }
        [$p1, $p2] = $positions;
        if (($board[$p1['y']][$p1['x']] ?? null) !== $enemySide || ($board[$p2['y']][$p2['x']] ?? null) !== $enemySide) {
            return new SkillEffectResult(false, 'Both must be enemy pieces', [], $board);
        }
        // Try push opposite directions horizontally
        $changes = [];
        $left = [$p1['x'] - 1, $p1['y']];
        $right = [$p2['x'] + 1, $p2['y']];
        if ($left[0] >= 0 && ($board[$left[1]][$left[0]] ?? null) === null) {
            $board[$left[1]][$left[0]] = $enemySide;
            $board[$p1['y']][$p1['x']] = null;
            $changes[] = ['type' => 'move', 'from' => $p1, 'to' => ['x' => $left[0], 'y' => $left[1]], 'side' => $enemySide];
        }
        if ($right[0] < 15 && ($board[$right[1]][$right[0]] ?? null) === null) {
            $board[$right[1]][$right[0]] = $enemySide;
            $board[$p2['y']][$p2['x']] = null;
            $changes[] = ['type' => 'move', 'from' => $p2, 'to' => ['x' => $right[0], 'y' => $right[1]], 'side' => $enemySide];
        }
        if (empty($changes)) {
            return new SkillEffectResult(false, 'No space to push', [], $board);
        }
        return new SkillEffectResult(true, 'Chain split', $changes, $board);
    }

    private function executeAttackBuff(array $ctx, array $params): SkillEffectResult
    {
        $stateEffects = [[
            'type' => 'attack_buff',
            'multiplier' => $params['multiplier'] ?? 1.5,
            'duration' => 2
        ]];
        return new SkillEffectResult(true, 'Attack buff', [[
            'type' => 'attack_buff',
            'multiplier' => $params['multiplier'] ?? 1.5
        ]], $ctx['board_state'] ?? [], $stateEffects);
    }

    /**
     * SKL_060 - Nguyên Động: CHAOS - toàn bộ quân trên bàn nhảy loạn sang 1 ô bất kì ngẫu nhiên (8 hướng) nếu trống
     * Điều kiện: Lượt gần nhất địch không được dùng skill hệ Thủy
     */
    private function executeChaosJump(array $board, array $ctx): SkillEffectResult
    {
        // Check condition: enemy didn't use water skill last turn
        $lastEnemySkill = $ctx['last_enemy_skill'] ?? null;
        if ($lastEnemySkill) {
            $waterSkills = ['ice_spread', 'counter_water', 'push_chain']; // Water element skills
            if (in_array($lastEnemySkill['effect_type'] ?? '', $waterSkills)) {
                return new SkillEffectResult(false, 'Cannot use: enemy used water skill last turn', [], $board);
            }
        }
        
        $changes = [];
        $size = 15;
        
        // Collect all pieces first
        $pieces = [];
        for ($y = 0; $y < $size; $y++) {
            for ($x = 0; $x < $size; $x++) {
                $piece = $board[$y][$x] ?? null;
                if ($piece !== null && $piece !== 'BLOCKED') {
                    $pieces[] = ['x' => $x, 'y' => $y, 'side' => $piece];
                }
            }
        }
        
        // Shuffle order to randomize which pieces get priority for empty cells
        shuffle($pieces);
        
        // Track which cells are taken
        $newBoard = array_fill(0, $size, array_fill(0, $size, null));
        // Copy blocked cells
        for ($y = 0; $y < $size; $y++) {
            for ($x = 0; $x < $size; $x++) {
                if (($board[$y][$x] ?? null) === 'BLOCKED') {
                    $newBoard[$y][$x] = 'BLOCKED';
                }
            }
        }
        
        // Move each piece to random adjacent cell if possible
        foreach ($pieces as $piece) {
            $x = $piece['x'];
            $y = $piece['y'];
            $side = $piece['side'];
            
            // Get adjacent empty cells in new board
            $neighbors = [];
            $dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
            foreach ($dirs as [$dx, $dy]) {
                $nx = $x + $dx;
                $ny = $y + $dy;
                if ($nx >= 0 && $nx < $size && $ny >= 0 && $ny < $size) {
                    if ($newBoard[$ny][$nx] === null) {
                        $neighbors[] = ['x' => $nx, 'y' => $ny];
                    }
                }
            }
            
            if (!empty($neighbors)) {
                // Random pick one neighbor
                $dest = $neighbors[array_rand($neighbors)];
                $newBoard[$dest['y']][$dest['x']] = $side;
                $changes[] = [
                    'type' => 'move',
                    'from' => ['x' => $x, 'y' => $y],
                    'to' => $dest,
                    'side' => $side
                ];
            } else {
                // No empty neighbor, stay in place
                $newBoard[$y][$x] = $side;
            }
        }
        
        return new SkillEffectResult(true, 'Chaos jump: ' . count($changes) . ' pieces moved', $changes, $newBoard);
    }

    private function executeSealBuff(array $ctx, array $params): SkillEffectResult
    {
        $stateEffects = [[
            'type' => 'seal_buff',
            'duration' => $params['duration'] ?? 3
        ]];
        return new SkillEffectResult(true, 'Seal buff', [[
            'type' => 'seal_buff',
            'duration' => $params['duration'] ?? 3
        ]], $ctx['board_state'] ?? [], $stateEffects);
    }

    private function executePurgeBuffs(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Purge buffs', [['type' => 'purge_buffs']], $ctx['board_state'] ?? [], [['type' => 'purge_buffs', 'duration' => 0]]);
    }

    private function executeBlockFutureBuffs(array $ctx, array $params): SkillEffectResult
    {
        $stateEffects = [[
            'type' => 'block_future_buffs',
            'duration' => $params['duration'] ?? 3
        ]];
        return new SkillEffectResult(true, 'Block future buffs', [[
            'type' => 'block_future_buffs',
            'duration' => $params['duration'] ?? 3
        ]], $ctx['board_state'] ?? [], $stateEffects);
    }

    private function executeRemoveSpecificBuff(array $ctx): SkillEffectResult
    {
        return new SkillEffectResult(true, 'Remove specific buff', [['type' => 'remove_specific_buff']], $ctx['board_state'] ?? [], [['type' => 'remove_specific_buff']]);
    }

    private function executeTrapReflect(array $ctx, array $params): SkillEffectResult
    {
        $positions = $ctx['target_positions'] ?? [];
        if (empty($positions)) {
            return new SkillEffectResult(false, 'Must choose trap cells', [], $ctx['board_state'] ?? []);
        }
        $stateEffects = [[
            'type' => 'trap_reflect',
            'positions' => $positions,
            'duration' => $params['duration'] ?? 5,
            'side' => $ctx['player_side'] ?? null
        ]];
        return new SkillEffectResult(true, 'Trap set', [[
            'type' => 'trap_reflect',
            'positions' => $positions,
            'duration' => $params['duration'] ?? 5
        ]], $ctx['board_state'] ?? [], $stateEffects);
    }

    private function getNeighborPositions(int $x, int $y): array
    {
        $neighbors = [];
        $dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
        foreach ($dirs as [$dx, $dy]) {
            $nx = $x + $dx;
            $ny = $y + $dy;
            if ($nx >= 0 && $nx < 15 && $ny >= 0 && $ny < 15) {
                $neighbors[] = ['x' => $nx, 'y' => $ny];
            }
        }
        return $neighbors;
    }

    /**
     * Lọc changes dựa trên shield/protect (đơn giản).
     */
    private function applyProtectionAndRedirect(array $changes, array $effects, array $board): array
    {
        $protectedAll = false;
        $protectedCells = [];
        $trapCells = [];
        $redirect = null;

        foreach ($effects as $eff) {
            $type = $eff['type'] ?? '';
            $side = $eff['side'] ?? null;

            if ($type === 'protect_all') {
                if ($side) {
                    foreach ($this->collectSideCells($board, $side) as $cell) {
                        $protectedCells[$cell['x'] . '_' . $cell['y']] = ['side' => $side];
                    }
                } else {
                    $protectedAll = true;
                }
            } elseif ($type === 'protect_piece') {
                $key = ($eff['x'] ?? -1) . '_' . ($eff['y'] ?? -1);
                $protectedCells[$key] = ['side' => $side];
            } elseif ($type === 'dual_protect') {
                foreach ($eff['positions'] ?? [] as $pos) {
                    $protectedCells[($pos['x'] ?? -1) . '_' . ($pos['y'] ?? -1)] = ['side' => $side];
                }
            } elseif ($type === 'shield_area') {
                $center = $eff['center'] ?? ['x' => 7, 'y' => 7];
                $size = $eff['size'] ?? 2;
                $radius = max(0, $size - 1);
                for ($dy = -$radius; $dy <= $radius; $dy++) {
                    for ($dx = -$radius; $dx <= $radius; $dx++) {
                        $x = ($center['x'] ?? 7) + $dx;
                        $y = ($center['y'] ?? 7) + $dy;
                        if ($x >= 0 && $x < 15 && $y >= 0 && $y < 15) {
                            $protectedCells[$x . '_' . $y] = ['side' => $side];
                        }
                    }
                }
            } elseif ($type === 'trap_reflect') {
                foreach ($eff['positions'] ?? [] as $pos) {
                    $trapCells[($pos['x'] ?? -1) . '_' . ($pos['y'] ?? -1)] = ['side' => $side];
                }
            } elseif ($type === 'redirect_damage') {
                $redirect = [
                    'target' => $eff['redirect_to'] ?? null,
                    'side' => $side,
                    'owner' => $eff['owner'] ?? null,
                ];
            }
        }

        $filtered = [];
        foreach ($changes as $change) {
            $type = $change['type'] ?? '';
            $key = isset($change['x'], $change['y']) ? $change['x'] . '_' . $change['y'] : null;
            $isDestructive = in_array($type, ['remove', 'block', 'convert', 'banish', 'damage'], true);
            $cellSide = $this->getCellSide($board, $change);

            if ($isDestructive && $key) {
                $protectedBySide = $this->isProtectedCell($protectedCells, $key, $cellSide);
                if ($protectedAll || $protectedBySide) {
                    $filtered[] = [
                        'type' => 'shield_blocked',
                        'x' => $change['x'] ?? null,
                        'y' => $change['y'] ?? null,
                        'source' => $type
                    ];
                    continue;
                }
                if (isset($trapCells[$key])) {
                    $filtered[] = [
                        'type' => 'trap_trigger',
                        'x' => $change['x'] ?? null,
                        'y' => $change['y'] ?? null,
                        'source' => $type
                    ];
                    continue;
                }
                if ($redirect && $redirect['target'] && (!$redirect['side'] || ($cellSide && $cellSide === $redirect['side']))) {
                    $origin = ['x' => $change['x'] ?? null, 'y' => $change['y'] ?? null];
                    $change['x'] = $redirect['target']['x'] ?? $change['x'];
                    $change['y'] = $redirect['target']['y'] ?? $change['y'];
                    $change['redirected_from'] = $origin;
                    $filtered[] = [
                        'type' => 'redirect',
                        'from' => $origin,
                        'to' => $redirect['target'],
                        'owner' => $redirect['owner'] ?? null
                    ];
                }
            }
            $filtered[] = $change;
        }

        return $filtered;
    }

    private function isProtectedCell(array $protected, string $key, ?string $cellSide): bool
    {
        if (!isset($protected[$key])) {
            return false;
        }
        $side = $protected[$key]['side'] ?? null;
        if (!$side) return true;
        return $cellSide === $side;
    }

    private function getCellSide(array $board, array $change): ?string
    {
        if (!isset($change['x'], $change['y'])) {
            return null;
        }
        return $board[$change['y']][$change['x']] ?? null;
    }

    private function collectSideCells(array $board, string $side): array
    {
        $cells = [];
        for ($y = 0; $y < count($board); $y++) {
            for ($x = 0; $x < count($board[$y]); $x++) {
                if (($board[$y][$x] ?? null) === $side) {
                    $cells[] = ['x' => $x, 'y' => $y];
                }
            }
        }
        return $cells;
    }

    // ==================== HELPERS ====================

    private function getAdjacentEmptyCells(array $board, int $x, int $y): array
    {
        $adjacent = [];
        $directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

        foreach ($directions as [$dx, $dy]) {
            $nx = $x + $dx;
            $ny = $y + $dy;
            
            if ($nx >= 0 && $nx < 15 && $ny >= 0 && $ny < 15) {
                if (($board[$ny][$nx] ?? null) === null) {
                    $adjacent[] = ['x' => $nx, 'y' => $ny];
                }
            }
        }

        return $adjacent;
    }
}
