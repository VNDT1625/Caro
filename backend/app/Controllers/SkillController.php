<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\SkillServiceInterface;
use App\Services\SeasonServiceInterface;
use App\Services\ComboServiceInterface;
use App\Services\SkillEngineServiceInterface;
use App\Services\SkillRandomizerServiceInterface;
use App\Services\MatchSkillStateService;

class SkillController
{
    private SkillServiceInterface $skillService;
    private SeasonServiceInterface $seasonService;
    private ComboServiceInterface $comboService;
    private SkillEngineServiceInterface $skillEngine;
    private SkillRandomizerServiceInterface $randomizer;
    private MatchSkillStateService $stateService;

    public function __construct(
        SkillServiceInterface $skillService,
        SeasonServiceInterface $seasonService,
        ComboServiceInterface $comboService,
        SkillEngineServiceInterface $skillEngine,
        SkillRandomizerServiceInterface $randomizer,
        MatchSkillStateService $stateService
    ) {
        $this->skillService = $skillService;
        $this->seasonService = $seasonService;
        $this->comboService = $comboService;
        $this->skillEngine = $skillEngine;
        $this->randomizer = $randomizer;
        $this->stateService = $stateService;
    }

    // GET /api/seasons/current
    public function getCurrentSeason(): array
    {
        $season = $this->seasonService->getCurrentSeason();
        if (!$season) {
            return ['error' => 'No active season', 'status' => 404];
        }
        $timeRemaining = $this->seasonService->getSeasonTimeRemaining();
        return ['season' => $season, 'time_remaining' => $timeRemaining];
    }

    // GET /api/skills?season_id=
    public function getSkills(array $params): array
    {
        $seasonId = $params['season_id'] ?? null;
        if (!$seasonId) {
            $season = $this->seasonService->getCurrentSeason();
            $seasonId = $season['id'] ?? null;
        }
        if (!$seasonId) {
            return ['error' => 'No season specified', 'status' => 400];
        }
        $skills = $this->skillService->getSkillsBySeason($seasonId);
        return ['skills' => $skills, 'count' => count($skills)];
    }

    // GET /api/skills/:id
    public function getSkillById(string $skillId): array
    {
        $skill = $this->skillService->getSkillById($skillId);
        if (!$skill) {
            return ['error' => 'Skill not found', 'status' => 404];
        }
        return ['skill' => $skill];
    }

    // GET /api/user/skills
    public function getUserSkills(string $userId): array
    {
        $skills = $this->skillService->getUserUnlockedSkills($userId);
        return ['skills' => $skills, 'count' => count($skills)];
    }

    // POST /api/user/combos
    public function saveCombo(array $data, string $userId): array
    {
        $seasonId = $data['season_id'] ?? null;
        $skillIds = $data['skill_ids'] ?? [];
        $presetSlot = $data['preset_slot'] ?? 1;
        $presetName = $data['preset_name'] ?? 'Default';

        if (!$seasonId) {
            $season = $this->seasonService->getCurrentSeason();
            $seasonId = $season['id'] ?? null;
        }
        if (!$seasonId) {
            return ['error' => 'No active season', 'status' => 400];
        }
        if (count($skillIds) !== 15) {
            return ['error' => 'Combo must have exactly 15 skills', 'status' => 400];
        }
        return $this->comboService->saveCombo($userId, $seasonId, $skillIds, $presetSlot, $presetName);
    }

    // GET /api/user/combos
    public function getUserCombos(string $userId, ?string $seasonId = null): array
    {
        $combos = $this->comboService->getUserCombos($userId, $seasonId);
        return ['combos' => $combos];
    }

    // POST /api/user/combos/active
    public function setActiveCombo(array $data, string $userId): array
    {
        $seasonId = $data['season_id'] ?? null;
        $presetSlot = $data['preset_slot'] ?? 1;
        if (!$seasonId) {
            $season = $this->seasonService->getCurrentSeason();
            $seasonId = $season['id'] ?? null;
        }
        $success = $this->comboService->setActiveCombo($userId, $seasonId, $presetSlot);
        return ['success' => $success];
    }

    // POST /api/match/:id/skill/random
    public function getRandomSkillsForTurn(array $data, string $userId): array
    {
        $matchId = $data['match_id'];
        $turnNumber = $data['turn_number'];
        
        $combo = $this->comboService->getActiveCombo($userId);
        if (!$combo || empty($combo['skill_ids'])) {
            $starterSkills = $this->skillService->getStarterSkills();
            $comboSkillIds = array_column($starterSkills, 'id');
        } else {
            $comboSkillIds = $combo['skill_ids'];
        }

        $cooldownSkillIds = array_values(array_unique($data['cooldown_skill_ids'] ?? []));
        $rawHeldSkillIds = array_slice($data['held_skill_ids'] ?? [], 0, 3);

        // Filter held skills: must be in deck and not on cooldown
        $deckSet = [];
        foreach ($comboSkillIds as $id) {
            $deckSet[(string)$id] = true;
        }
        $cooldownSet = [];
        foreach ($cooldownSkillIds as $id) {
            $cooldownSet[(string)$id] = true;
        }

        $heldSkillIds = [];
        foreach ($rawHeldSkillIds as $id) {
            $id = (string)$id;
            if (!isset($deckSet[$id]) || isset($cooldownSet[$id])) {
                continue;
            }
            if (!in_array($id, $heldSkillIds, true)) {
                $heldSkillIds[] = $id;
            }
            if (count($heldSkillIds) >= 3) {
                break;
            }
        }
        $heldSkills = $this->skillService->getSkillsByIds($heldSkillIds);

        // Load and tick state to current turn (regen mana)
        $state = $this->stateService->load($matchId);
        $modifiers = $this->stateService->computeModifiers($state, $userId);
        $tickChanges = [];
        $currentTurn = $state['turn'] ?? 1;
        if ($turnNumber > $currentTurn) {
            for ($i = $currentTurn; $i < $turnNumber; $i++) {
                $tick = $this->stateService->tick($matchId, $userId, $data['board_state'] ?? []);
                $state = $tick['state'];
                $tickChanges = array_merge($tickChanges, $tick['changes']);
            }
        }

        // Deduct hold cost from mana
        $holdResult = $this->stateService->applyHoldCost($state, $userId, $heldSkills ?? []);
        $state = $holdResult['state'];
        $holdCost = $holdResult['hold_cost'] ?? 0;
        if ($holdResult['error']) {
            $this->stateService->save($matchId, $state);
            return ['error' => 'NOT_ENOUGH_MANA', 'mana' => $state['mana'][$userId] ?? 0, 'status' => 400];
        }

        $seed = $this->randomizer->getSeed($matchId);
        $randomSkillIds = $this->randomizer->generateTurnSkills(
            $comboSkillIds,
            $cooldownSkillIds,
            $turnNumber,
            $seed,
            $heldSkillIds,
            $modifiers['luck_stacks'] ?? 0
        );
        $skills = $this->skillService->getSkillsByIds($randomSkillIds);

        $disabled = [];
        $lockCount = $modifiers['lock_count'] ?? 0;
        $lockedSet = [];
        if ($lockCount > 0) {
            $lockedSet = $this->getLockedSkillsForEffect(['count' => $lockCount, 'owner' => $userId], $comboSkillIds, $matchId, $turnNumber);
        }
        foreach ($randomSkillIds as $id) {
            $reasons = [];
            if (in_array($id, $cooldownSkillIds)) {
                $reasons[] = 'cooldown';
            }
            if ($lockCount > 0 && in_array($id, $lockedSet, true)) {
                $reasons[] = 'deck_lock';
            }
            if (!empty($reasons)) {
                $disabled[$id] = implode('+', $reasons);
            }
        }

        $this->stateService->save($matchId, $state);

        return [
            'skills' => $skills,
            'turn' => $turnNumber,
            'seed' => $seed,
            'held_skill_ids' => $heldSkillIds,
            'hold_cost' => $holdCost,
            'mana' => $state['mana'][$userId] ?? 0,
            'effects' => $state['effects'] ?? [],
            'tick_changes' => $tickChanges,
            'disabled' => $disabled
        ];
    }

    // POST /api/match/:id/skill/use
    public function useSkill(array $data, string $userId): array
    {
        $skillId = $data['skill_id'];
        $boardState = $data['board_state'];
        $context = $data['context'] ?? [];
        $context['user_id'] = $userId;
        $matchId = $context['match_id'] ?? $data['match_id'] ?? 'default';

        $state = $this->stateService->load($matchId);
        $modifiers = $this->stateService->computeModifiers($state, $userId);
        $turnNumber = $data['turn_number'] ?? ($state['turn'] ?? 1);

        $cooldownSkillIds = $data['cooldown_skill_ids'] ?? [];
        if (in_array($skillId, $cooldownSkillIds, true)) {
            return ['error' => 'SKILL_COOLDOWN', 'status' => 400];
        }

        $combo = $this->comboService->getActiveCombo($userId);
        if (!$combo || empty($combo['skill_ids'])) {
            $starterSkills = $this->skillService->getStarterSkills();
            $comboSkillIds = array_column($starterSkills, 'id');
        } else {
            $comboSkillIds = $combo['skill_ids'];
        }

        $lockedSet = [];
        if (($modifiers['lock_count'] ?? 0) > 0) {
            $lockedSet = $this->getLockedSkillsForEffect(['count' => $modifiers['lock_count'], 'owner' => $userId], $comboSkillIds, $matchId, $turnNumber);
        }
        if (in_array($skillId, $lockedSet, true)) {
            return ['error' => 'SKILL_LOCKED', 'status' => 400];
        }

        if ($this->stateService->isSilenced($state, $userId)) {
            return ['error' => 'SILENCED', 'status' => 400];
        }

        $skill = $this->skillService->getSkillById($skillId);
        $cost = (int)($skill['mana_cost'] ?? 0);
        $deduct = $this->stateService->deductMana($state, $userId, $cost);
        $state = $deduct['state'];
        if ($deduct['error']) {
            return ['error' => 'NOT_ENOUGH_MANA', 'mana' => $state['mana'][$userId] ?? 0, 'status' => 400];
        }

        $context['active_effects'] = $state['effects'] ?? [];
        $result = $this->skillEngine->executeSkill($skillId, $boardState, $context);
        $state = $this->stateService->applyEffects($state, $result->stateEffects, $userId);
        $this->stateService->save($matchId, $state);

        $payload = $result->toArray();
        $payload['mana'] = $state['mana'][$userId] ?? 0;
        $payload['effects'] = $state['effects'] ?? [];
        $payload['disabled'] = [
            'cooldown' => $cooldownSkillIds,
            'deck_lock' => $lockedSet
        ];
        return $payload;
    }

    private function getLockedSkillsForEffect(array $effect, array $comboSkillIds, string $matchId, int $turnNumber): array
    {
        $count = $effect['count'] ?? 0;
        if ($count <= 0) return [];
        $seed = crc32($matchId . '_deck_lock_' . $turnNumber . '_' . ($effect['owner'] ?? ''));
        $pool = array_values(array_unique($comboSkillIds));
        $shuffled = $this->seededShuffle($pool, $seed);
        return array_slice($shuffled, 0, min($count, count($shuffled)));
    }

    private function seededShuffle(array $items, int $seed): array
    {
        if (empty($items)) return $items;
        mt_srand($seed);
        $shuffled = $items;
        for ($i = count($shuffled) - 1; $i > 0; $i--) {
            $j = mt_rand(0, $i);
            [$shuffled[$i], $shuffled[$j]] = [$shuffled[$j], $shuffled[$i]];
        }
        mt_srand();
        return $shuffled;
    }

    // GET /api/skills/recommended?playstyle=
    public function getRecommendedCombo(array $params): array
    {
        $playstyle = $params['playstyle'] ?? 'balanced';
        $skillIds = $this->comboService->getRecommendedCombo($playstyle);
        $skills = $this->skillService->getSkillsByIds($skillIds);
        return ['playstyle' => $playstyle, 'skill_ids' => $skillIds, 'skills' => $skills];
    }
}
