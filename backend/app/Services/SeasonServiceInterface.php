<?php

declare(strict_types=1);

namespace App\Services;

interface SeasonServiceInterface
{
    public function getCurrentSeason(): ?array;
    public function getSeasonById(string $seasonId): ?array;
    public function getSeasonSkillPool(string $seasonId): array;
    public function getAllSeasons(): array;
    public function getSeasonTimeRemaining(): array;
}
