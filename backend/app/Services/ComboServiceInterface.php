<?php

declare(strict_types=1);

namespace App\Services;

interface ComboServiceInterface
{
    public function getUserCombos(string $userId, ?string $seasonId = null): array;
    public function getActiveCombo(string $userId, ?string $seasonId = null): ?array;
    public function saveCombo(string $userId, string $seasonId, array $skillIds, int $presetSlot = 1, string $presetName = 'Default'): array;
    public function setActiveCombo(string $userId, string $seasonId, int $presetSlot): bool;
    public function deleteCombo(string $userId, string $seasonId, int $presetSlot): bool;
    public function validateCombo(array $skillIds, string $seasonId, string $userId): array;
    public function getRecommendedCombo(string $playstyle = 'balanced'): array;
}
