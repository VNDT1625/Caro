<?php

namespace App\Services;

use DateTimeImmutable;

/**
 * AnalysisCacheService
 * 
 * Caches analysis results with TTL of 1 hour.
 * 
 * **Validates: Requirements 16.1, 16.2**
 * 
 * **Property 15: Cache Behavior**
 * - Cache key format: {match_id}:{tier}
 * - TTL: 1 hour
 * - Subsequent requests return cached result
 */
class AnalysisCacheService implements AnalysisCacheServiceInterface
{
    /**
     * In-memory cache storage
     * @var array
     */
    private array $cache = [];

    /**
     * Current time provider for testing
     * @var callable|null
     */
    private $timeProvider;

    public function __construct(?callable $timeProvider = null)
    {
        $this->timeProvider = $timeProvider;
    }

    /**
     * Get current timestamp
     */
    protected function now(): int
    {
        if ($this->timeProvider !== null) {
            $time = ($this->timeProvider)();
            if ($time instanceof DateTimeImmutable) {
                return $time->getTimestamp();
            }
            return (int) $time;
        }
        return time();
    }

    /**
     * {@inheritdoc}
     */
    public function get(string $matchId, string $tier): ?array
    {
        $key = $this->buildKey($matchId, $tier);

        if (!isset($this->cache[$key])) {
            return null;
        }

        $entry = $this->cache[$key];

        // Check if expired
        if ($this->now() > $entry['expires_at']) {
            unset($this->cache[$key]);
            return null;
        }

        return $entry['data'];
    }

    /**
     * {@inheritdoc}
     */
    public function set(string $matchId, string $tier, array $result, ?int $ttl = null): bool
    {
        $key = $this->buildKey($matchId, $tier);
        $ttl = $ttl ?? self::CACHE_TTL_SECONDS;

        $this->cache[$key] = [
            'data' => $result,
            'created_at' => $this->now(),
            'expires_at' => $this->now() + $ttl,
            'match_id' => $matchId,
            'tier' => $tier,
        ];

        return true;
    }

    /**
     * {@inheritdoc}
     */
    public function delete(string $matchId, string $tier): bool
    {
        $key = $this->buildKey($matchId, $tier);

        if (isset($this->cache[$key])) {
            unset($this->cache[$key]);
            return true;
        }

        return false;
    }

    /**
     * {@inheritdoc}
     */
    public function has(string $matchId, string $tier): bool
    {
        return $this->get($matchId, $tier) !== null;
    }

    /**
     * {@inheritdoc}
     * 
     * **Property 15**: Cache key format is {match_id}:{tier}
     */
    public function buildKey(string $matchId, string $tier): string
    {
        return "{$matchId}:{$tier}";
    }

    /**
     * {@inheritdoc}
     */
    public function clear(): int
    {
        $count = count($this->cache);
        $this->cache = [];
        return $count;
    }

    /**
     * {@inheritdoc}
     */
    public function cleanup(): int
    {
        $now = $this->now();
        $cleaned = 0;

        foreach ($this->cache as $key => $entry) {
            if ($now > $entry['expires_at']) {
                unset($this->cache[$key]);
                $cleaned++;
            }
        }

        return $cleaned;
    }

    /**
     * Get all cache entries (for testing)
     */
    public function getAll(): array
    {
        return $this->cache;
    }

    /**
     * Get cache entry metadata (for testing)
     */
    public function getMetadata(string $matchId, string $tier): ?array
    {
        $key = $this->buildKey($matchId, $tier);

        if (!isset($this->cache[$key])) {
            return null;
        }

        $entry = $this->cache[$key];
        return [
            'created_at' => $entry['created_at'],
            'expires_at' => $entry['expires_at'],
            'match_id' => $entry['match_id'],
            'tier' => $entry['tier'],
        ];
    }
}
