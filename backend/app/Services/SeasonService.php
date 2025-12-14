<?php

declare(strict_types=1);

namespace App\Services;

use App\Database;

class SeasonService implements SeasonServiceInterface
{
    private Database $db;
    private ?array $currentSeasonCache = null;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    public function getCurrentSeason(): ?array
    {
        if ($this->currentSeasonCache !== null) {
            return $this->currentSeasonCache;
        }

        // First try: just get active season (simpler query for REST API compatibility)
        $result = $this->db->query(
            "SELECT * FROM seasons WHERE is_active = true ORDER BY season_number DESC LIMIT 1"
        );

        if (empty($result)) {
            return null;
        }

        // Validate date range in PHP
        $season = $result[0];
        $now = new \DateTime();
        $startDate = new \DateTime($season['start_date']);
        $endDate = new \DateTime($season['end_date']);
        
        if ($now >= $startDate && $now < $endDate) {
            $this->currentSeasonCache = $this->formatSeason($season);
            return $this->currentSeasonCache;
        }

        // No valid active season
        return null;
    }

    public function getSeasonById(string $seasonId): ?array
    {
        $result = $this->db->query(
            'SELECT * FROM seasons WHERE id = $1',
            [$seasonId]
        );

        if (empty($result)) {
            return null;
        }

        return $this->formatSeason($result[0]);
    }

    public function getSeasonSkillPool(string $seasonId): array
    {
        $season = $this->getSeasonById($seasonId);
        
        if (!$season) {
            return [];
        }

        return $season['skill_pool'] ?? [];
    }

    public function getAllSeasons(): array
    {
        $result = $this->db->query(
            'SELECT * FROM seasons ORDER BY season_number DESC'
        );

        return array_map([$this, 'formatSeason'], $result);
    }

    public function getSeasonTimeRemaining(): array
    {
        $season = $this->getCurrentSeason();
        
        if (!$season) {
            return ['days' => 0, 'hours' => 0, 'minutes' => 0, 'total_seconds' => 0];
        }

        $endDate = new \DateTime($season['end_date']);
        $now = new \DateTime();
        $diff = $now->diff($endDate);

        if ($now > $endDate) {
            return ['days' => 0, 'hours' => 0, 'minutes' => 0, 'total_seconds' => 0];
        }

        $totalSeconds = $endDate->getTimestamp() - $now->getTimestamp();

        return [
            'days' => $diff->days,
            'hours' => $diff->h,
            'minutes' => $diff->i,
            'total_seconds' => $totalSeconds
        ];
    }

    private function formatSeason(array $row): array
    {
        return [
            'id' => $row['id'],
            'season_number' => (int) $row['season_number'],
            'name' => $row['name'],
            'name_en' => $row['name_en'] ?? null,
            'start_date' => $row['start_date'],
            'end_date' => $row['end_date'],
            'is_active' => (bool) ($row['is_active'] ?? false),
            'skill_pool' => $this->decodeJsonField($row['skill_pool'] ?? '[]'),
            'theme_color' => $row['theme_color'] ?? null,
            'banner_url' => $row['banner_url'] ?? null,
            'created_at' => $row['created_at'] ?? null,
        ];
    }

    /**
     * Decode JSON field - handles both string (from PDO) and array (from REST API).
     */
    private function decodeJsonField($value): mixed
    {
        if ($value === null) {
            return [];
        }
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value)) {
            return json_decode($value, true) ?? [];
        }
        return [];
    }
}
