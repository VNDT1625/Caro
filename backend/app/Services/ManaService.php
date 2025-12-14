<?php

declare(strict_types=1);

namespace App\Services;

/**
 * ManaService
 *
 * Manages mana initialization, regeneration, capping, and deductions
 * for the Caro Skill System.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 */
class ManaService implements ManaServiceInterface
{
    /** @var array<string, int> */
    private array $manaPool = [];

    public function initPlayer(string $playerId): int
    {
        $this->manaPool[$playerId] = ManaServiceInterface::INITIAL_MANA;
        return $this->manaPool[$playerId];
    }

    public function getMana(string $playerId): int
    {
        if (!isset($this->manaPool[$playerId])) {
            $this->manaPool[$playerId] = ManaServiceInterface::INITIAL_MANA;
        }

        return $this->manaPool[$playerId];
    }

    public function addMana(string $playerId, int $amount = ManaServiceInterface::MANA_PER_TURN): int
    {
        $this->ensurePlayer($playerId);

        $increment = max(0, $amount);
        $newTotal = $this->manaPool[$playerId] + $increment;
        $this->manaPool[$playerId] = min(ManaServiceInterface::MANA_CAP, $newTotal);

        return $this->manaPool[$playerId];
    }

    public function canAfford(string $playerId, int $cost): bool
    {
        $this->ensurePlayer($playerId);
        $required = max(0, $cost);

        return $this->manaPool[$playerId] >= $required;
    }

    public function deductMana(string $playerId, int $cost, ?string &$error = null): bool
    {
        $this->ensurePlayer($playerId);
        $error = null;

        $required = max(0, $cost);
        if (!$this->canAfford($playerId, $required)) {
            $error = ManaServiceInterface::ERROR_INSUFFICIENT_MANA;
            return false;
        }

        $this->manaPool[$playerId] -= $required;
        return true;
    }

    public function getRetentionCost(string $rarity): int
    {
        $normalized = strtolower($rarity);
        return ManaServiceInterface::RETENTION_COSTS[$normalized] ?? ManaServiceInterface::RETENTION_COSTS['common'];
    }

    /**
     * Ensure a player has an initialized mana entry.
     */
    private function ensurePlayer(string $playerId): void
    {
        if (!isset($this->manaPool[$playerId])) {
            $this->manaPool[$playerId] = ManaServiceInterface::INITIAL_MANA;
        }
    }
}
