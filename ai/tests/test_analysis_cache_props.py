"""
Property-Based Tests for AnalysisCache

Tests the caching layer for analysis performance.

Properties tested:
- Property 52: Cache Hit Performance
- Property 53: Cache Performance Improvement

Requirements: 20.1, 20.4
"""

import pytest
import time
from hypothesis import given, strategies as st, settings, assume

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.analysis_cache import (
    AnalysisCache,
    LRUCache,
    CacheEntry,
    get_analysis_cache,
    reset_analysis_cache
)


# Strategies for generating test data
cell_strategy = st.sampled_from([None, "X", "O"])
board_strategy = st.lists(
    st.lists(cell_strategy, min_size=15, max_size=15),
    min_size=15, max_size=15
)
player_strategy = st.sampled_from(["X", "O"])
coordinate_strategy = st.integers(min_value=0, max_value=14)


class TestLRUCache:
    """Tests for the LRUCache implementation."""
    
    @given(
        key=st.text(min_size=1, max_size=50),
        value=st.integers()
    )
    @settings(max_examples=100)
    def test_set_and_get(self, key: str, value: int):
        """Test that set values can be retrieved."""
        cache = LRUCache(maxsize=100)
        cache.set(key, value)
        assert cache.get(key) == value
    
    @given(
        items=st.lists(
            st.tuples(st.text(min_size=1, max_size=20), st.integers()),
            min_size=5,
            max_size=10,
            unique_by=lambda kv: kv[0]
        )
    )
    @settings(max_examples=50)
    def test_lru_eviction(self, items):
        """Test that LRU eviction works correctly."""
        cache = LRUCache(maxsize=3)
        
        for key, value in items:
            cache.set(key, value)
        
        assert len(cache) <= 3
    
    def test_ttl_expiration(self):
        """Test that TTL expiration works."""
        cache = LRUCache(maxsize=100, default_ttl=0.1)  # 100ms TTL
        
        cache.set("test_key", "test_value")
        assert cache.get("test_key") == "test_value"
        
        # Wait for expiration
        time.sleep(0.15)
        
        # Should be expired now
        assert cache.get("test_key") is None
    
    def test_stats(self):
        """Test cache statistics."""
        cache = LRUCache(maxsize=100)
        
        # Initial stats
        stats = cache.stats()
        assert stats["hits"] == 0
        assert stats["misses"] == 0
        
        # Miss
        cache.get("nonexistent")
        stats = cache.stats()
        assert stats["misses"] == 1
        
        # Set and hit
        cache.set("key", "value")
        cache.get("key")
        stats = cache.stats()
        assert stats["hits"] == 1


class TestAnalysisCache:
    """Tests for the AnalysisCache class."""
    
    def setup_method(self):
        """Reset cache before each test."""
        reset_analysis_cache()
    
    @given(board=board_strategy, player=player_strategy)
    @settings(max_examples=50)
    def test_board_hash_consistency(self, board, player):
        """Test that board hash is consistent for same board."""
        hash1 = AnalysisCache.board_hash(board)
        hash2 = AnalysisCache.board_hash(board)
        assert hash1 == hash2
    
    @given(board=board_strategy, player=player_strategy)
    @settings(max_examples=50)
    def test_position_key_consistency(self, board, player):
        """Test that position key is consistent."""
        key1 = AnalysisCache.position_key(board, player)
        key2 = AnalysisCache.position_key(board, player)
        assert key1 == key2
    
    @given(board=board_strategy, player=player_strategy)
    @settings(max_examples=50)
    def test_pattern_key_consistency(self, board, player):
        """Test that pattern key is consistent."""
        key1 = AnalysisCache.pattern_key(board, player)
        key2 = AnalysisCache.pattern_key(board, player)
        assert key1 == key2
    
    @given(
        board=board_strategy,
        player=player_strategy,
        evaluation=st.floats(min_value=-100000, max_value=100000, allow_nan=False)
    )
    @settings(max_examples=50)
    def test_position_evaluation_cache(self, board, player, evaluation):
        """Test position evaluation caching."""
        cache = AnalysisCache()
        
        # Initially not cached
        assert cache.get_position_evaluation(board, player) is None
        
        # Set and retrieve
        cache.set_position_evaluation(board, player, evaluation)
        cached = cache.get_position_evaluation(board, player)
        assert cached == evaluation
    
    @given(
        board=board_strategy,
        player=player_strategy,
        patterns=st.lists(st.text(min_size=1, max_size=20), min_size=0, max_size=5)
    )
    @settings(max_examples=50)
    def test_pattern_cache(self, board, player, patterns):
        """Test pattern detection caching."""
        cache = AnalysisCache()
        
        # Initially not cached
        assert cache.get_patterns(board, player) is None
        
        # Set and retrieve
        cache.set_patterns(board, player, patterns)
        cached = cache.get_patterns(board, player)
        assert cached == patterns
    
    @given(
        board=board_strategy,
        move_x=coordinate_strategy,
        move_y=coordinate_strategy,
        player=player_strategy,
        score=st.floats(min_value=-1000, max_value=1000, allow_nan=False)
    )
    @settings(max_examples=50)
    def test_move_evaluation_cache(self, board, move_x, move_y, player, score):
        """Test move evaluation caching."""
        cache = AnalysisCache()
        
        # Initially not cached
        assert cache.get_move_evaluation(board, move_x, move_y, player) is None
        
        # Set and retrieve
        cache.set_move_evaluation(board, move_x, move_y, player, score)
        cached = cache.get_move_evaluation(board, move_x, move_y, player)
        assert cached == score
    
    def test_comment_templates_preloaded(self):
        """Test that comment templates are pre-loaded."""
        cache = AnalysisCache()
        templates = cache.get_comment_templates()
        
        # Should have templates loaded
        assert isinstance(templates, dict)
        # May be empty if comment_generator not available, but should be dict
    
    def test_clear_all(self):
        """Test clearing all caches."""
        cache = AnalysisCache()
        
        # Add some data
        board = [[None] * 15 for _ in range(15)]
        cache.set_position_evaluation(board, "X", 100.0)
        cache.set_patterns(board, "X", ["pattern1"])
        
        # Clear
        cache.clear_all()
        
        # Should be empty
        assert cache.get_position_evaluation(board, "X") is None
        assert cache.get_patterns(board, "X") is None
    
    def test_stats(self):
        """Test cache statistics."""
        cache = AnalysisCache()
        stats = cache.stats()
        
        assert "position_cache" in stats
        assert "pattern_cache" in stats
        assert "move_cache" in stats
        assert "comment_templates_loaded" in stats


class TestCachePerformance:
    """
    Performance tests for cache.
    
    Property 52: Cache Hit Performance
    Property 53: Cache Performance Improvement
    """
    
    def setup_method(self):
        """Reset cache before each test."""
        reset_analysis_cache()
    
    def test_property_52_cache_hit_performance(self):
        """
        Property 52: Cache Hit Performance
        
        **Feature: gomoku-basic-analysis, Property 52: Cache Hit Performance**
        **Validates: Requirements 20.1**
        
        For any previously analyzed position, the cached result
        SHALL be returned within 10ms.
        """
        cache = AnalysisCache()
        
        # Create a test board
        board = [[None] * 15 for _ in range(15)]
        board[7][7] = "X"
        board[7][8] = "O"
        board[8][7] = "X"
        
        # Cache a result
        evaluation = {"score": 100.0, "win_probability": 0.55}
        cache.set_position_evaluation(board, "X", evaluation)
        
        # Measure retrieval time
        iterations = 1000
        start_time = time.perf_counter()
        
        for _ in range(iterations):
            result = cache.get_position_evaluation(board, "X")
        
        end_time = time.perf_counter()
        total_time_ms = (end_time - start_time) * 1000
        avg_time_ms = total_time_ms / iterations
        
        # Each retrieval should be well under 10ms
        # We test average to account for system variance
        assert avg_time_ms < 10.0, f"Cache hit took {avg_time_ms:.3f}ms on average, expected < 10ms"
        
        # Verify result is correct
        assert result == evaluation
    
    def test_property_53_cache_performance_improvement(self):
        """
        Property 53: Cache Performance Improvement
        
        **Feature: gomoku-basic-analysis, Property 53: Cache Performance Improvement**
        **Validates: Requirements 20.4**
        
        For any cached analysis, the response time SHALL be at least
        5x faster than uncached analysis.
        """
        # Import position evaluator for comparison
        try:
            from analysis.position_evaluator import PositionEvaluator
            from analysis.threat_detector import ThreatDetector
        except ImportError:
            pytest.skip("PositionEvaluator not available")
        
        cache = AnalysisCache()
        evaluator = PositionEvaluator()
        
        # Create a test board with some pieces
        board = [[None] * 15 for _ in range(15)]
        board[7][7] = "X"
        board[7][8] = "O"
        board[8][7] = "X"
        board[8][8] = "O"
        board[6][6] = "X"
        
        # Measure uncached evaluation time
        iterations = 50
        
        start_time = time.perf_counter()
        for _ in range(iterations):
            result = evaluator.evaluate_position(board, "X")
        uncached_time = time.perf_counter() - start_time
        
        # Cache the result
        cache.set_position_evaluation(board, "X", result)
        
        # Measure cached retrieval time
        start_time = time.perf_counter()
        for _ in range(iterations):
            cached_result = cache.get_position_evaluation(board, "X")
        cached_time = time.perf_counter() - start_time
        
        # Calculate speedup
        if cached_time > 0:
            speedup = uncached_time / cached_time
        else:
            speedup = float('inf')
        
        # Cached should be at least 5x faster
        assert speedup >= 5.0, f"Cache speedup was only {speedup:.1f}x, expected >= 5x"
        
        # Verify result is correct
        assert cached_result.score == result.score


class TestGlobalCache:
    """Tests for the global cache singleton."""
    
    def setup_method(self):
        """Reset cache before each test."""
        reset_analysis_cache()
    
    def test_singleton_pattern(self):
        """Test that get_analysis_cache returns the same instance."""
        cache1 = get_analysis_cache()
        cache2 = get_analysis_cache()
        assert cache1 is cache2
    
    def test_reset_creates_new_instance(self):
        """Test that reset creates a new instance."""
        cache1 = get_analysis_cache()
        
        # Add some data
        board = [[None] * 15 for _ in range(15)]
        cache1.set_position_evaluation(board, "X", 100.0)
        
        # Reset
        reset_analysis_cache()
        
        # Get new instance
        cache2 = get_analysis_cache()
        
        # Should be different instance
        assert cache1 is not cache2
        
        # Data should be gone
        assert cache2.get_position_evaluation(board, "X") is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
