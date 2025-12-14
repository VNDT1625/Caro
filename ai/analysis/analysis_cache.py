"""
AI Match Analysis System - Analysis Cache

This module implements the AnalysisCache class for caching analysis results
to improve performance.

Requirements: 20.1, 20.2, 20.3, 20.4
- 20.1: Return cached result within 10ms for previously analyzed positions
- 20.2: Use pattern cache with TTL of 600 seconds
- 20.3: Use pre-loaded comment templates (no disk I/O per request)
- 20.4: Achieve 5x-10x performance improvement over uncached analysis
"""

import hashlib
import time
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Dict, List, Optional, Tuple, Any
from collections import OrderedDict
import threading


@dataclass
class CacheEntry:
    """
    A single cache entry with value and metadata.
    
    Attributes:
        value: The cached value
        timestamp: When the entry was created
        ttl: Time-to-live in seconds (0 = no expiration)
    """
    value: Any
    timestamp: float
    ttl: float = 0.0
    
    def is_expired(self) -> bool:
        """Check if this entry has expired."""
        if self.ttl <= 0:
            return False
        return time.time() - self.timestamp > self.ttl


class LRUCache:
    """
    Thread-safe LRU (Least Recently Used) cache implementation.
    
    Features:
    - Maximum size limit with automatic eviction
    - Optional TTL (time-to-live) for entries
    - Thread-safe operations
    """
    
    def __init__(self, maxsize: int = 10000, default_ttl: float = 0.0):
        """
        Initialize the LRU cache.
        
        Args:
            maxsize: Maximum number of entries
            default_ttl: Default TTL in seconds (0 = no expiration)
        """
        self.maxsize = maxsize
        self.default_ttl = default_ttl
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get a value from the cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found/expired
        """
        with self._lock:
            if key not in self._cache:
                self._misses += 1
                return None
            
            entry = self._cache[key]
            
            # Check expiration
            if entry.is_expired():
                del self._cache[key]
                self._misses += 1
                return None
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            self._hits += 1
            return entry.value
    
    def set(self, key: str, value: Any, ttl: Optional[float] = None) -> None:
        """
        Set a value in the cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Optional TTL override
        """
        with self._lock:
            # Remove if exists to update position
            if key in self._cache:
                del self._cache[key]
            
            # Evict oldest if at capacity
            while len(self._cache) >= self.maxsize:
                self._cache.popitem(last=False)
            
            # Add new entry
            self._cache[key] = CacheEntry(
                value=value,
                timestamp=time.time(),
                ttl=ttl if ttl is not None else self.default_ttl
            )
    
    def clear(self) -> None:
        """Clear all entries from the cache."""
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0
    
    def stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            total = self._hits + self._misses
            hit_rate = self._hits / total if total > 0 else 0.0
            return {
                "size": len(self._cache),
                "maxsize": self.maxsize,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": hit_rate
            }
    
    def __len__(self) -> int:
        """Return the number of entries in the cache."""
        with self._lock:
            return len(self._cache)
    
    def __contains__(self, key: str) -> bool:
        """Check if a key exists and is not expired."""
        return self.get(key) is not None


class AnalysisCache:
    """
    Caching layer for analysis performance.
    
    Provides caching for:
    - Position evaluations (LRU cache)
    - Pattern detection results (TTL cache, 600s)
    - Pre-loaded comment templates
    
    Requirements:
    - 20.1: Cached result within 10ms
    - 20.2: Pattern cache with TTL=600s
    - 20.3: Pre-loaded comment templates
    - 20.4: 5x-10x performance improvement
    """
    
    # Default cache sizes
    DEFAULT_POSITION_CACHE_SIZE = 10000
    DEFAULT_PATTERN_CACHE_SIZE = 5000
    DEFAULT_PATTERN_TTL = 600.0  # 600 seconds = 10 minutes
    
    def __init__(
        self,
        position_cache_size: int = DEFAULT_POSITION_CACHE_SIZE,
        pattern_cache_size: int = DEFAULT_PATTERN_CACHE_SIZE,
        pattern_ttl: float = DEFAULT_PATTERN_TTL
    ):
        """
        Initialize the AnalysisCache.
        
        Args:
            position_cache_size: Max entries for position cache
            pattern_cache_size: Max entries for pattern cache
            pattern_ttl: TTL for pattern cache entries (seconds)
        """
        # Position evaluation cache (LRU, no TTL)
        self._position_cache = LRUCache(
            maxsize=position_cache_size,
            default_ttl=0.0  # No expiration for position evaluations
        )
        
        # Pattern detection cache (LRU with TTL)
        self._pattern_cache = LRUCache(
            maxsize=pattern_cache_size,
            default_ttl=pattern_ttl
        )
        
        # Pre-loaded comment templates
        self._comment_templates: Dict[str, Dict[str, str]] = {}
        
        # Move evaluation cache
        self._move_cache = LRUCache(
            maxsize=position_cache_size,
            default_ttl=0.0
        )
        
        # Pre-load comment templates at initialization
        self._preload_comment_templates()
    
    def _preload_comment_templates(self) -> None:
        """
        Pre-load all comment templates at startup.
        
        Requirement 20.3: No disk I/O per request
        """
        # Import here to avoid circular imports
        try:
            from .comment_generator import COMMENT_TEMPLATES, THREAT_LABELS, CLASSIFICATION_LABELS
            self._comment_templates = {
                "templates": COMMENT_TEMPLATES,
                "threat_labels": THREAT_LABELS,
                "classification_labels": CLASSIFICATION_LABELS
            }
        except ImportError:
            # Fallback if comment_generator not available
            self._comment_templates = {}
    
    @staticmethod
    def board_hash(board: List[List[Optional[str]]]) -> str:
        """
        Generate a hash for a board state.
        
        Args:
            board: 2D array representing the board
            
        Returns:
            Hash string for the board state
        """
        # Convert board to a string representation
        board_str = ""
        for row in board:
            for cell in row:
                if cell is None:
                    board_str += "."
                else:
                    board_str += cell
        
        # Use MD5 for fast hashing (not security-critical)
        return hashlib.md5(board_str.encode()).hexdigest()
    
    @staticmethod
    def position_key(board: List[List[Optional[str]]], player: str) -> str:
        """
        Generate a cache key for a position evaluation.
        
        Args:
            board: 2D array representing the board
            player: Player to evaluate for
            
        Returns:
            Cache key string
        """
        board_h = AnalysisCache.board_hash(board)
        return f"pos:{board_h}:{player}"
    
    @staticmethod
    def pattern_key(board: List[List[Optional[str]]], player: str) -> str:
        """
        Generate a cache key for pattern detection.
        
        Args:
            board: 2D array representing the board
            player: Player to detect patterns for
            
        Returns:
            Cache key string
        """
        board_h = AnalysisCache.board_hash(board)
        return f"pat:{board_h}:{player}"
    
    @staticmethod
    def move_key(
        board: List[List[Optional[str]]],
        move_x: int,
        move_y: int,
        player: str
    ) -> str:
        """
        Generate a cache key for a move evaluation.
        
        Args:
            board: 2D array representing the board
            move_x: X coordinate of the move
            move_y: Y coordinate of the move
            player: Player making the move
            
        Returns:
            Cache key string
        """
        board_h = AnalysisCache.board_hash(board)
        return f"move:{board_h}:{move_x},{move_y}:{player}"
    
    def get_position_evaluation(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> Optional[Any]:
        """
        Get cached position evaluation.
        
        Requirement 20.1: Return within 10ms
        
        Args:
            board: 2D array representing the board
            player: Player to evaluate for
            
        Returns:
            Cached evaluation result or None
        """
        key = self.position_key(board, player)
        return self._position_cache.get(key)
    
    def set_position_evaluation(
        self,
        board: List[List[Optional[str]]],
        player: str,
        evaluation: Any
    ) -> None:
        """
        Cache a position evaluation.
        
        Args:
            board: 2D array representing the board
            player: Player evaluated for
            evaluation: Evaluation result to cache
        """
        key = self.position_key(board, player)
        self._position_cache.set(key, evaluation)
    
    def get_patterns(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> Optional[Any]:
        """
        Get cached pattern detection result.
        
        Requirement 20.2: TTL of 600 seconds
        
        Args:
            board: 2D array representing the board
            player: Player to detect patterns for
            
        Returns:
            Cached pattern result or None
        """
        key = self.pattern_key(board, player)
        return self._pattern_cache.get(key)
    
    def set_patterns(
        self,
        board: List[List[Optional[str]]],
        player: str,
        patterns: Any
    ) -> None:
        """
        Cache pattern detection result.
        
        Args:
            board: 2D array representing the board
            player: Player patterns detected for
            patterns: Pattern result to cache
        """
        key = self.pattern_key(board, player)
        self._pattern_cache.set(key, patterns)
    
    def get_move_evaluation(
        self,
        board: List[List[Optional[str]]],
        move_x: int,
        move_y: int,
        player: str
    ) -> Optional[float]:
        """
        Get cached move evaluation.
        
        Args:
            board: 2D array representing the board
            move_x: X coordinate of the move
            move_y: Y coordinate of the move
            player: Player making the move
            
        Returns:
            Cached move score or None
        """
        key = self.move_key(board, move_x, move_y, player)
        return self._move_cache.get(key)
    
    def set_move_evaluation(
        self,
        board: List[List[Optional[str]]],
        move_x: int,
        move_y: int,
        player: str,
        score: float
    ) -> None:
        """
        Cache a move evaluation.
        
        Args:
            board: 2D array representing the board
            move_x: X coordinate of the move
            move_y: Y coordinate of the move
            player: Player making the move
            score: Move score to cache
        """
        key = self.move_key(board, move_x, move_y, player)
        self._move_cache.set(key, score)
    
    def get_comment_templates(self) -> Dict[str, Any]:
        """
        Get pre-loaded comment templates.
        
        Requirement 20.3: No disk I/O per request
        
        Returns:
            Dictionary with templates, threat_labels, classification_labels
        """
        return self._comment_templates
    
    def clear_all(self) -> None:
        """Clear all caches."""
        self._position_cache.clear()
        self._pattern_cache.clear()
        self._move_cache.clear()
    
    def clear_position_cache(self) -> None:
        """Clear only the position cache."""
        self._position_cache.clear()
    
    def clear_pattern_cache(self) -> None:
        """Clear only the pattern cache."""
        self._pattern_cache.clear()
    
    def stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with stats for all caches
        """
        return {
            "position_cache": self._position_cache.stats(),
            "pattern_cache": self._pattern_cache.stats(),
            "move_cache": self._move_cache.stats(),
            "comment_templates_loaded": len(self._comment_templates) > 0
        }


# Global cache instance for singleton pattern
_global_cache: Optional[AnalysisCache] = None
_cache_lock = threading.Lock()


def get_analysis_cache() -> AnalysisCache:
    """
    Get the global AnalysisCache instance (singleton).
    
    Returns:
        The global AnalysisCache instance
    """
    global _global_cache
    if _global_cache is None:
        with _cache_lock:
            if _global_cache is None:
                _global_cache = AnalysisCache()
    return _global_cache


def reset_analysis_cache() -> None:
    """Reset the global cache instance (for testing)."""
    global _global_cache
    with _cache_lock:
        if _global_cache is not None:
            _global_cache.clear_all()
        _global_cache = None
