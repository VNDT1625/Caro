"""
AI Match Analysis System - Redis Cache Module

This module provides Redis-based caching for:
- Analysis results (with 1-hour TTL)
- Replay sessions (with configurable TTL)
- Cache warming for common positions
- Cache statistics and monitoring

Requirements: 16.1, 16.2, 8.7.3
"""

import json
import os
import time
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import hashlib

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


# ============================================
# Configuration
# ============================================

REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))
REDIS_DB = int(os.environ.get('REDIS_DB', 0))
REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD', None)

# Cache TTL settings
ANALYSIS_CACHE_TTL = 3600  # 1 hour for analysis results
SESSION_CACHE_TTL = 7200   # 2 hours for replay sessions
COMMON_POSITION_TTL = 86400  # 24 hours for common positions

# Cache key prefixes
ANALYSIS_PREFIX = "analysis:"
SESSION_PREFIX = "session:"
POSITION_PREFIX = "position:"
STATS_PREFIX = "stats:"


@dataclass
class CacheStats:
    """Statistics for cache monitoring."""
    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0
    errors: int = 0
    last_reset: str = ""
    
    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate."""
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0


class RedisCache:
    """
    Redis-based cache for AI analysis system.
    
    Provides:
    - Analysis result caching with 1-hour TTL
    - Replay session storage
    - Cache warming for common positions
    - Statistics and monitoring
    
    Falls back to in-memory cache if Redis is unavailable.
    """
    
    def __init__(
        self,
        host: str = REDIS_HOST,
        port: int = REDIS_PORT,
        db: int = REDIS_DB,
        password: Optional[str] = REDIS_PASSWORD,
        fallback_to_memory: bool = True
    ):
        """
        Initialize Redis cache.
        
        Args:
            host: Redis server host
            port: Redis server port
            db: Redis database number
            password: Redis password (optional)
            fallback_to_memory: Use in-memory cache if Redis unavailable
        """
        self.host = host
        self.port = port
        self.db = db
        self.password = password
        self.fallback_to_memory = fallback_to_memory
        
        self._redis: Optional[redis.Redis] = None
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._stats = CacheStats(last_reset=datetime.utcnow().isoformat())
        
        # Try to connect to Redis
        self._connect()
    
    def _connect(self) -> bool:
        """
        Attempt to connect to Redis.
        
        Returns:
            True if connected, False otherwise
        """
        if not REDIS_AVAILABLE:
            print("Redis library not available, using in-memory cache")
            return False
        
        try:
            self._redis = redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                password=self.password,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5
            )
            # Test connection
            self._redis.ping()
            print(f"Connected to Redis at {self.host}:{self.port}")
            return True
        except Exception as e:
            print(f"Redis connection failed: {e}")
            self._redis = None
            if self.fallback_to_memory:
                print("Falling back to in-memory cache")
            return False
    
    @property
    def is_redis_available(self) -> bool:
        """Check if Redis is available."""
        if self._redis is None:
            return False
        try:
            self._redis.ping()
            return True
        except:
            return False
    
    # ============================================
    # Analysis Cache Methods
    # ============================================
    
    def get_analysis(self, match_id: str, tier: str) -> Optional[Dict]:
        """
        Get cached analysis result.
        
        Args:
            match_id: UUID of the match
            tier: Analysis tier ('basic' or 'pro')
            
        Returns:
            Cached analysis result or None
        """
        key = f"{ANALYSIS_PREFIX}{match_id}:{tier}"
        return self._get(key)
    
    def set_analysis(
        self,
        match_id: str,
        tier: str,
        result: Dict,
        ttl: int = ANALYSIS_CACHE_TTL
    ) -> bool:
        """
        Cache analysis result.
        
        Args:
            match_id: UUID of the match
            tier: Analysis tier ('basic' or 'pro')
            result: Analysis result to cache
            ttl: Time-to-live in seconds (default 1 hour)
            
        Returns:
            True if cached successfully
        """
        key = f"{ANALYSIS_PREFIX}{match_id}:{tier}"
        return self._set(key, result, ttl)
    
    def delete_analysis(self, match_id: str, tier: str) -> bool:
        """
        Delete cached analysis result.
        
        Args:
            match_id: UUID of the match
            tier: Analysis tier
            
        Returns:
            True if deleted
        """
        key = f"{ANALYSIS_PREFIX}{match_id}:{tier}"
        return self._delete(key)
    
    # ============================================
    # Session Cache Methods
    # ============================================
    
    def get_session(self, session_id: str) -> Optional[Dict]:
        """
        Get cached replay session.
        
        Args:
            session_id: UUID of the session
            
        Returns:
            Session data or None
        """
        key = f"{SESSION_PREFIX}{session_id}"
        return self._get(key)
    
    def set_session(
        self,
        session_id: str,
        session_data: Dict,
        ttl: int = SESSION_CACHE_TTL
    ) -> bool:
        """
        Cache replay session.
        
        Args:
            session_id: UUID of the session
            session_data: Session data to cache
            ttl: Time-to-live in seconds (default 2 hours)
            
        Returns:
            True if cached successfully
        """
        key = f"{SESSION_PREFIX}{session_id}"
        return self._set(key, session_data, ttl)
    
    def delete_session(self, session_id: str) -> bool:
        """
        Delete cached session.
        
        Args:
            session_id: UUID of the session
            
        Returns:
            True if deleted
        """
        key = f"{SESSION_PREFIX}{session_id}"
        return self._delete(key)
    
    def extend_session_ttl(self, session_id: str, ttl: int = SESSION_CACHE_TTL) -> bool:
        """
        Extend session TTL (keep-alive).
        
        Args:
            session_id: UUID of the session
            ttl: New TTL in seconds
            
        Returns:
            True if extended
        """
        key = f"{SESSION_PREFIX}{session_id}"
        return self._extend_ttl(key, ttl)
    
    # ============================================
    # Position Cache Methods (for cache warming)
    # ============================================
    
    def get_position_evaluation(self, board_hash: str) -> Optional[Dict]:
        """
        Get cached position evaluation.
        
        Args:
            board_hash: Hash of the board position
            
        Returns:
            Cached evaluation or None
        """
        key = f"{POSITION_PREFIX}{board_hash}"
        return self._get(key)
    
    def set_position_evaluation(
        self,
        board_hash: str,
        evaluation: Dict,
        ttl: int = COMMON_POSITION_TTL
    ) -> bool:
        """
        Cache position evaluation.
        
        Args:
            board_hash: Hash of the board position
            evaluation: Evaluation result
            ttl: Time-to-live in seconds (default 24 hours)
            
        Returns:
            True if cached
        """
        key = f"{POSITION_PREFIX}{board_hash}"
        return self._set(key, evaluation, ttl)
    
    @staticmethod
    def hash_board(board: List[List[Optional[str]]]) -> str:
        """
        Generate hash for a board position.
        
        Args:
            board: 2D board array
            
        Returns:
            SHA256 hash of the board
        """
        # Convert board to string representation
        board_str = ""
        for row in board:
            for cell in row:
                board_str += cell if cell else "."
        
        return hashlib.sha256(board_str.encode()).hexdigest()[:16]
    
    # ============================================
    # Cache Warming
    # ============================================
    
    def warm_common_positions(self, positions: List[Tuple[List[List[Optional[str]]], Dict]]) -> int:
        """
        Pre-cache common positions for faster analysis.
        
        Args:
            positions: List of (board, evaluation) tuples
            
        Returns:
            Number of positions cached
        """
        cached = 0
        for board, evaluation in positions:
            board_hash = self.hash_board(board)
            if self.set_position_evaluation(board_hash, evaluation):
                cached += 1
        return cached
    
    def warm_opening_positions(self, opening_evaluations: Dict[str, Dict]) -> int:
        """
        Pre-cache opening position evaluations.
        
        Args:
            opening_evaluations: Dict mapping opening name to evaluation
            
        Returns:
            Number of openings cached
        """
        cached = 0
        for opening_name, evaluation in opening_evaluations.items():
            key = f"{POSITION_PREFIX}opening:{opening_name}"
            if self._set(key, evaluation, COMMON_POSITION_TTL):
                cached += 1
        return cached
    
    # ============================================
    # Statistics and Monitoring
    # ============================================
    
    def get_stats(self) -> CacheStats:
        """
        Get cache statistics.
        
        Returns:
            CacheStats object
        """
        return self._stats
    
    def reset_stats(self) -> None:
        """Reset cache statistics."""
        self._stats = CacheStats(last_reset=datetime.utcnow().isoformat())
    
    def get_cache_info(self) -> Dict:
        """
        Get detailed cache information.
        
        Returns:
            Dict with cache info
        """
        info = {
            "backend": "redis" if self.is_redis_available else "memory",
            "stats": asdict(self._stats),
            "hit_rate": f"{self._stats.hit_rate:.2%}",
        }
        
        if self.is_redis_available:
            try:
                redis_info = self._redis.info("memory")
                info["redis_memory_used"] = redis_info.get("used_memory_human", "unknown")
                info["redis_keys"] = self._redis.dbsize()
            except:
                pass
        else:
            info["memory_keys"] = len(self._memory_cache)
        
        return info
    
    def get_key_count(self, prefix: str = "") -> int:
        """
        Get count of keys with given prefix.
        
        Args:
            prefix: Key prefix to count
            
        Returns:
            Number of keys
        """
        if self.is_redis_available:
            try:
                pattern = f"{prefix}*" if prefix else "*"
                return len(list(self._redis.scan_iter(pattern)))
            except:
                return 0
        else:
            if not prefix:
                return len(self._memory_cache)
            return sum(1 for k in self._memory_cache if k.startswith(prefix))
    
    # ============================================
    # Internal Methods
    # ============================================
    
    def _get(self, key: str) -> Optional[Dict]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None
        """
        try:
            if self.is_redis_available:
                value = self._redis.get(key)
                if value:
                    self._stats.hits += 1
                    return json.loads(value)
                else:
                    self._stats.misses += 1
                    return None
            else:
                # In-memory fallback
                entry = self._memory_cache.get(key)
                if entry:
                    if time.time() < entry.get('expires_at', 0):
                        self._stats.hits += 1
                        return entry.get('data')
                    else:
                        # Expired
                        del self._memory_cache[key]
                self._stats.misses += 1
                return None
        except Exception as e:
            self._stats.errors += 1
            print(f"Cache get error: {e}")
            return None
    
    def _set(self, key: str, value: Dict, ttl: int) -> bool:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds
            
        Returns:
            True if set successfully
        """
        try:
            if self.is_redis_available:
                self._redis.setex(key, ttl, json.dumps(value))
            else:
                # In-memory fallback
                self._memory_cache[key] = {
                    'data': value,
                    'expires_at': time.time() + ttl
                }
            self._stats.sets += 1
            return True
        except Exception as e:
            self._stats.errors += 1
            print(f"Cache set error: {e}")
            return False
    
    def _delete(self, key: str) -> bool:
        """
        Delete value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            True if deleted
        """
        try:
            if self.is_redis_available:
                self._redis.delete(key)
            else:
                if key in self._memory_cache:
                    del self._memory_cache[key]
            self._stats.deletes += 1
            return True
        except Exception as e:
            self._stats.errors += 1
            print(f"Cache delete error: {e}")
            return False
    
    def _extend_ttl(self, key: str, ttl: int) -> bool:
        """
        Extend TTL for a key.
        
        Args:
            key: Cache key
            ttl: New TTL in seconds
            
        Returns:
            True if extended
        """
        try:
            if self.is_redis_available:
                return self._redis.expire(key, ttl)
            else:
                if key in self._memory_cache:
                    self._memory_cache[key]['expires_at'] = time.time() + ttl
                    return True
                return False
        except Exception as e:
            self._stats.errors += 1
            print(f"Cache extend TTL error: {e}")
            return False
    
    def clear_all(self) -> int:
        """
        Clear all cache entries.
        
        Returns:
            Number of entries cleared
        """
        try:
            if self.is_redis_available:
                count = self._redis.dbsize()
                self._redis.flushdb()
                return count
            else:
                count = len(self._memory_cache)
                self._memory_cache.clear()
                return count
        except Exception as e:
            self._stats.errors += 1
            print(f"Cache clear error: {e}")
            return 0
    
    def clear(self) -> int:
        """
        Clear all cache entries (alias for clear_all).
        
        Returns:
            Number of entries cleared
        """
        return self.clear_all()
    
    def cleanup_expired(self) -> int:
        """
        Clean up expired entries (for in-memory cache).
        
        Returns:
            Number of entries cleaned
        """
        if self.is_redis_available:
            # Redis handles expiration automatically
            return 0
        
        now = time.time()
        expired_keys = [
            k for k, v in self._memory_cache.items()
            if now >= v.get('expires_at', 0)
        ]
        
        for key in expired_keys:
            del self._memory_cache[key]
        
        return len(expired_keys)


# ============================================
# Global Cache Instance
# ============================================

# Singleton instance
_cache_instance: Optional[RedisCache] = None


def get_cache() -> RedisCache:
    """
    Get the global cache instance.
    
    Returns:
        RedisCache instance
    """
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = RedisCache()
    return _cache_instance


def reset_cache() -> None:
    """Reset the global cache instance (for testing)."""
    global _cache_instance
    _cache_instance = None
