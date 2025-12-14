<?php

declare(strict_types=1);

namespace App\Services;

class SkillRandomizerService implements SkillRandomizerServiceInterface
{
    private SkillServiceInterface $skillService;

    public function __construct(SkillServiceInterface $skillService)
    {
        $this->skillService = $skillService;
    }

    public function generateTurnSkills(
        array $comboSkillIds,
        array $cooldownSkillIds,
        int $turnNumber,
        string $matchSeed,
        array $heldSkillIds = [],
        int $luckStacks = 0
    ): array {
        $deck = array_values(array_unique($comboSkillIds));

        // Build cooldown set for quick lookups
        $cooldownSet = [];
        foreach ($cooldownSkillIds as $cd) {
            $cooldownSet[(string) $cd] = true;
        }

        // Keep only valid held cards (in deck, not on cooldown)
        $held = [];
        foreach ($heldSkillIds as $id) {
            $id = (string) $id;
            if (!in_array($id, $deck, true)) {
                continue;
            }
            if (isset($cooldownSet[$id])) {
                continue;
            }
            if (!in_array($id, $held, true)) {
                $held[] = $id;
            }
            if (count($held) >= 3) {
                break;
            }
        }

        // Available pool: in deck, not cooldown, not already held
        $available = [];
        foreach ($deck as $id) {
            $id = (string) $id;
            if (isset($cooldownSet[$id])) {
                continue;
            }
            if (in_array($id, $held, true)) {
                continue;
            }
            $available[] = $id;
        }

        $pool = $available;
        if ($luckStacks > 0 && !empty($available)) {
            $pool = $this->applyLuckBias($available, $luckStacks, $matchSeed, $turnNumber);
        }

        $seedValue = crc32($matchSeed . '_turn_' . $turnNumber);
        $pool = $this->seededShuffle($pool, $seedValue);

        $needed = max(0, 3 - count($held));
        $selected = [];
        foreach ($pool as $skillId) {
            if (count($selected) >= $needed) {
                break;
            }
            if (!in_array($skillId, $selected, true)) {
                $selected[] = $skillId;
            }
        }

        // Fallback when pool is too small but we still need 3 non-cooldown cards
        if ($needed > count($selected) && !empty($available)) {
            $idx = 0;
            while (count($selected) < $needed) {
                $selected[] = $available[$idx % count($available)];
                $idx++;
            }
        }

        $result = array_slice(array_merge($held, $selected), 0, 3);

        // If deck itself has <3 valid cards, try to fill without violating cooldown rule
        if (count($result) < 3) {
            foreach ($deck as $skillId) {
                if (count($result) >= 3) {
                    break;
                }
                if (isset($cooldownSet[$skillId])) {
                    continue;
                }
                if (!in_array($skillId, $result, true)) {
                    $result[] = $skillId;
                }
            }
        }

        return $result;
    }

    private function applyLuckBias(array $pool, int $stacks, string $matchSeed, int $turn): array
    {
        $skills = $this->skillService->getSkillsByIds($pool);
        $weighted = [];
        foreach ($skills as $skill) {
            $weight = 1;
            if (($skill['rarity'] ?? '') === 'legendary') {
                $weight = 1 + 0.5 * $stacks;
            } elseif (($skill['rarity'] ?? '') === 'rare') {
                $weight = 1 + 0.3 * $stacks;
            }
            $weighted[] = ['id' => $skill['id'], 'w' => $weight];
        }

        $expanded = [];
        foreach ($weighted as $item) {
            $repeat = max(1, (int) round($item['w'] * 10));
            for ($i = 0; $i < $repeat; $i++) {
                $expanded[] = $item['id'];
            }
        }

        $seed = crc32($matchSeed . '_luck_' . $turn);
        return $this->seededShuffle($expanded, $seed);
    }

    private function seededShuffle(array $items, int $seed): array
    {
        if (empty($items)) {
            return $items;
        }

        mt_srand($seed);
        $shuffled = $items;
        for ($i = count($shuffled) - 1; $i > 0; $i--) {
            $j = mt_rand(0, $i);
            [$shuffled[$i], $shuffled[$j]] = [$shuffled[$j], $shuffled[$i]];
        }
        mt_srand();

        return $shuffled;
    }

    public function getSeed(string $matchId): string
    {
        return hash('sha256', $matchId . '_skill_random');
    }
}
