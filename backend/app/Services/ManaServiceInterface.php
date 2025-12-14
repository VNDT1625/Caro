<?php

declare(strict_types=1);

namespace App\Services;

interface ManaServiceInterface
{
    public const INITIAL_MANA = 5;
    public const MANA_PER_TURN = 3;
    public const MANA_CAP = 15;
    public const ERROR_INSUFFICIENT_MANA = 'insufficient_mana';
    /** @var array<string,int> Chi phi giu bai theo do hiem */
    public const RETENTION_COSTS = [
        'common' => 1,
        'rare' => 2,
        'legendary' => 3, // su dung legendary thay cho cuc hiem
    ];

    /**
     * Initialize mana for a player.
     */
    public function initPlayer(string $playerId): int;

    /**
     * Get current mana for a player (initializes if missing).
     */
    public function getMana(string $playerId): int;

    /**
     * Add mana (defaults to per-turn regen) while respecting the cap.
     */
    public function addMana(string $playerId, int $amount = self::MANA_PER_TURN): int;

    /**
     * Check if the player can afford a mana cost.
     */
    public function canAfford(string $playerId, int $cost): bool;

    /**
     * Deduct mana for a skill use.
     * Returns false and sets $error when insufficient.
     *
     * @param string|null $error Populated with error code on failure
     */
    public function deductMana(string $playerId, int $cost, ?string &$error = null): bool;

    /**
     * Tra ve chi phi giu bai theo do hiem.
     */
    public function getRetentionCost(string $rarity): int;
}
