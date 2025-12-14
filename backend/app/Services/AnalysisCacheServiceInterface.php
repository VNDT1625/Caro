<?php

namespace App\Services;

/**
 * AnalysisCacheServiceInterface
 * 
 * Interface for caching analysis results.
 * 
 * **Validates: Requirements 16.1, 16.2**
 * 
 * **Property 15: Cache Behavior**
 * - Cache key format: {match_id}:{tier}
 * - TTL: 1 hour
 */
interface AnalysisCacheServiceInterface
{
    /**
     * Cache TTL in seconds (1 hour)
     */
    public const CACHE_TTL_SECONDS = 3600;

    /**
     * Get cached analysis result.
     * 
     * @param string $matchId Match UUID
     * @param string $tier Analysis tier ('basic' or 'pro')
     * @return array|null Cached result or null if not found/expired
     */
    public function get(string $matchId, string $tier): ?array;

    /**
     * Set cached analysis result.
     * 
     * @param string $matchId Match UUID
     * @param string $tier Analysis tier ('basic' or 'pro')
     * @param array $result Analysis result to cache
     * @param int|null $ttl TTL in seconds (default: 1 hour)
     * @return bool True if cached successfully
     */
    public function set(string $matchId, string $tier, array $result, ?int $ttl = null): bool;

    /**
     * Delete cached analysis result.
     * 
     * @param string $matchId Match UUID
     * @param string $tier Analysis tier ('basic' or 'pro')
     * @return bool True if deleted successfully
     */
    public function delete(string $matchId, string $tier): bool;

    /**
     * Check if a cached result exists and is valid.
     * 
     * @param string $matchId Match UUID
     * @param string $tier Analysis tier ('basic' or 'pro')
     * @return bool True if cache exists and is not expired
     */
    public function has(string $matchId, string $tier): bool;

    /**
     * Build cache key from match ID and tier.
     * 
     * @param string $matchId Match UUID
     * @param string $tier Analysis tier
     * @return string Cache key in format {match_id}:{tier}
     */
    public function buildKey(string $matchId, string $tier): string;

    /**
     * Clear all cached analysis results.
     * 
     * @return int Number of entries cleared
     */
    public function clear(): int;

    /**
     * Clean up expired cache entries.
     * 
     * @return int Number of entries cleaned up
     */
    public function cleanup(): int;
}
