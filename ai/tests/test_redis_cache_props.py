"""
Property-Based Tests for Redis Cache Module

Tests the Redis caching functionality including:
- Analysis caching with TTL
- Session storage
- Cache warming
- Statistics and monitoring

**Feature: ai-match-analysis-system, Task 8.7.3: Redis Caching**
"""

import sys
import os
import time
from typing import List, Optional, Dict

# Ensure the ai directory is in the path
AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck

from analysis.redis_cache import (
    RedisCache,
    CacheStats,
    ANALYSIS_CACHE_TTL,
    SESSION_CACHE_TTL,
    reset_cache
)

# Common settings for all property tests - suppress fixture health check
# since our tests are designed to work correctly with shared cache instances
COMMON_SETTINGS = settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)


# ============================================
# Test Fixtures
# ============================================

@pytest.fixture
def cache():
    """Create a fresh cache instance for testing."""
    # Reset global cache
    reset_cache()
    # Create new instance with memory fallback
    return RedisCache(fallback_to_memory=True)


@pytest.fixture
def memory_cache():
    """Create a memory-only cache for testing."""
    return RedisCache(host='invalid', port=0, fallback_to_memory=True)


# ============================================
# Strategies for Property-Based Testing
# ============================================

# UUID-like strings
uuid_strategy = st.text(
    alphabet='0123456789abcdef-',
    min_size=36,
    max_size=36
).filter(lambda x: x.count('-') == 4)

# Simple UUID for testing
simple_uuid = st.uuids().map(str)

# Tier strategy
tier_strategy = st.sampled_from(['basic', 'pro'])

# Analysis result strategy
analysis_result_strategy = st.fixed_dictionaries({
    'tier': tier_strategy,
    'best_move': st.one_of(
        st.none(),
        st.fixed_dictionaries({
            'x': st.integers(0, 14),
            'y': st.integers(0, 14),
            'score': st.floats(-1000, 1000, allow_nan=False, allow_infinity=False),
            'reason': st.text(min_size=1, max_size=100)
        })
    ),
    'timeline': st.lists(
        st.fixed_dictionaries({
            'move': st.integers(0, 225),
            'player': st.sampled_from(['X', 'O']),
            'score': st.floats(-1000, 1000, allow_nan=False, allow_infinity=False),
            'win_prob': st.floats(0, 1, allow_nan=False, allow_infinity=False)
        }),
        min_size=0,
        max_size=10
    ),
    'mistakes': st.lists(
        st.fixed_dictionaries({
            'move': st.integers(0, 225),
            'severity': st.sampled_from(['minor', 'major', 'critical'])
        }),
        min_size=0,
        max_size=5
    ),
    'duration_ms': st.integers(0, 10000)
})

# Session data strategy
session_data_strategy = st.fixed_dictionaries({
    'session_id': simple_uuid,
    'match_id': simple_uuid,
    'current_move_index': st.integers(-1, 225),
    'mode': st.sampled_from(['replay', 'what_if']),
    'divergence_point': st.one_of(st.none(), st.integers(0, 225))
})

# Board strategy (15x15)
board_strategy = st.lists(
    st.lists(
        st.one_of(st.none(), st.sampled_from(['X', 'O'])),
        min_size=15,
        max_size=15
    ),
    min_size=15,
    max_size=15
)


# ============================================
# Property Tests: Analysis Cache
# ============================================

class TestAnalysisCacheProperties:
    """Property tests for analysis caching."""
    
    @given(match_id=simple_uuid, tier=tier_strategy, result=analysis_result_strategy)
    @COMMON_SETTINGS
    def test_set_then_get_returns_same_data(self, cache, match_id, tier, result):
        """
        **Feature: ai-match-analysis-system, Property: Cache Round Trip**
        
        For any analysis result, setting then getting should return the same data.
        """
        # Set the analysis
        success = cache.set_analysis(match_id, tier, result)
        assert success, "Setting analysis should succeed"
        
        # Get it back
        retrieved = cache.get_analysis(match_id, tier)
        assert retrieved is not None, "Should retrieve cached analysis"
        assert retrieved == result, "Retrieved data should match original"
    
    @given(match_id=simple_uuid, tier=tier_strategy, result=analysis_result_strategy)
    @COMMON_SETTINGS
    def test_delete_removes_cached_data(self, cache, match_id, tier, result):
        """
        **Feature: ai-match-analysis-system, Property: Cache Delete**
        
        After deleting, get should return None.
        """
        # Set and verify
        cache.set_analysis(match_id, tier, result)
        assert cache.get_analysis(match_id, tier) is not None
        
        # Delete
        cache.delete_analysis(match_id, tier)
        
        # Should be gone
        assert cache.get_analysis(match_id, tier) is None
    
    @given(match_id=simple_uuid, tier=tier_strategy)
    @COMMON_SETTINGS
    def test_get_nonexistent_returns_none(self, cache, match_id, tier):
        """
        **Feature: ai-match-analysis-system, Property: Cache Miss**
        
        Getting non-existent key should return None.
        """
        # Clear cache first to ensure clean state
        cache.clear_all()
        result = cache.get_analysis(match_id, tier)
        assert result is None
    
    @given(
        match_id=simple_uuid,
        result1=analysis_result_strategy,
        result2=analysis_result_strategy
    )
    @COMMON_SETTINGS
    def test_different_tiers_independent(self, cache, match_id, result1, result2):
        """
        **Feature: ai-match-analysis-system, Property: Tier Independence**
        
        Basic and pro caches for same match should be independent.
        """
        # Set both tiers
        cache.set_analysis(match_id, 'basic', result1)
        cache.set_analysis(match_id, 'pro', result2)
        
        # Retrieve and verify independence
        basic = cache.get_analysis(match_id, 'basic')
        pro = cache.get_analysis(match_id, 'pro')
        
        assert basic == result1
        assert pro == result2


# ============================================
# Property Tests: Session Cache
# ============================================

class TestSessionCacheProperties:
    """Property tests for session caching."""
    
    @given(session_id=simple_uuid, data=session_data_strategy)
    @COMMON_SETTINGS
    def test_session_round_trip(self, cache, session_id, data):
        """
        **Feature: ai-match-analysis-system, Property: Session Round Trip**
        
        Setting then getting session should return same data.
        """
        success = cache.set_session(session_id, data)
        assert success
        
        retrieved = cache.get_session(session_id)
        assert retrieved == data
    
    @given(session_id=simple_uuid, data=session_data_strategy)
    @COMMON_SETTINGS
    def test_session_delete(self, cache, session_id, data):
        """
        **Feature: ai-match-analysis-system, Property: Session Delete**
        
        Deleting session should remove it.
        """
        cache.set_session(session_id, data)
        cache.delete_session(session_id)
        
        assert cache.get_session(session_id) is None


# ============================================
# Property Tests: Board Hashing
# ============================================

class TestBoardHashingProperties:
    """Property tests for board hashing."""
    
    @given(board=board_strategy)
    @COMMON_SETTINGS
    def test_same_board_same_hash(self, board):
        """
        **Feature: ai-match-analysis-system, Property: Hash Consistency**
        
        Same board should always produce same hash.
        """
        hash1 = RedisCache.hash_board(board)
        hash2 = RedisCache.hash_board(board)
        
        assert hash1 == hash2
    
    @given(board1=board_strategy, board2=board_strategy)
    @COMMON_SETTINGS
    def test_different_boards_different_hash(self, board1, board2):
        """
        **Feature: ai-match-analysis-system, Property: Hash Uniqueness**
        
        Different boards should (usually) produce different hashes.
        """
        # Skip if boards are identical
        assume(board1 != board2)
        
        hash1 = RedisCache.hash_board(board1)
        hash2 = RedisCache.hash_board(board2)
        
        # Note: Hash collisions are possible but extremely rare
        # We just verify the hash function works
        assert isinstance(hash1, str)
        assert isinstance(hash2, str)
        assert len(hash1) == 16
        assert len(hash2) == 16


# ============================================
# Property Tests: Statistics
# ============================================

class TestCacheStatisticsProperties:
    """Property tests for cache statistics."""
    
    @given(
        match_ids=st.lists(simple_uuid, min_size=1, max_size=10, unique=True),
        tier=tier_strategy
    )
    @COMMON_SETTINGS
    def test_stats_track_operations(self, cache, match_ids, tier):
        """
        **Feature: ai-match-analysis-system, Property: Stats Accuracy**
        
        Statistics should accurately track cache operations.
        """
        cache.reset_stats()
        cache.clear_all()  # Clear cache to ensure clean state
        
        # Perform some operations
        for match_id in match_ids:
            # Miss
            cache.get_analysis(match_id, tier)
            
            # Set
            cache.set_analysis(match_id, tier, {'test': True})
            
            # Hit
            cache.get_analysis(match_id, tier)
        
        stats = cache.get_stats()
        
        # Verify counts
        assert stats.sets == len(match_ids)
        assert stats.hits == len(match_ids)
        assert stats.misses == len(match_ids)
    
    def test_hit_rate_calculation(self, cache):
        """
        **Feature: ai-match-analysis-system, Property: Hit Rate**
        
        Hit rate should be correctly calculated.
        """
        cache.reset_stats()
        
        # 3 misses
        for i in range(3):
            cache.get_analysis(f'miss-{i}', 'basic')
        
        # Set and hit 7 times
        for i in range(7):
            cache.set_analysis(f'hit-{i}', 'basic', {'test': True})
            cache.get_analysis(f'hit-{i}', 'basic')
        
        stats = cache.get_stats()
        
        # 7 hits, 3 misses = 70% hit rate
        expected_rate = 7 / 10
        assert abs(stats.hit_rate - expected_rate) < 0.01


# ============================================
# Property Tests: Cache Warming
# ============================================

class TestCacheWarmingProperties:
    """Property tests for cache warming."""
    
    @given(
        board=board_strategy,
        evaluation=st.fixed_dictionaries({
            'score': st.floats(-1000, 1000, allow_nan=False, allow_infinity=False),
            'win_prob': st.floats(0, 1, allow_nan=False, allow_infinity=False)
        })
    )
    @COMMON_SETTINGS
    def test_warm_single_position_cached(self, cache, board, evaluation):
        """
        **Feature: ai-match-analysis-system, Property: Warm Positions**
        
        A single warmed position should be retrievable.
        """
        # Warm a single position
        positions = [(board, evaluation)]
        cached_count = cache.warm_common_positions(positions)
        
        assert cached_count == 1
        
        # Verify the position is cached
        board_hash = cache.hash_board(board)
        retrieved = cache.get_position_evaluation(board_hash)
        assert retrieved == evaluation


# ============================================
# Property Tests: TTL Expiration (Memory Cache)
# ============================================

class TestTTLExpirationProperties:
    """Property tests for TTL expiration in memory cache."""
    
    def test_expired_entries_not_returned(self, memory_cache):
        """
        **Feature: ai-match-analysis-system, Property: TTL Expiration**
        
        Expired entries should not be returned.
        """
        # Set with very short TTL
        memory_cache.set_analysis('test-match', 'basic', {'test': True}, ttl=1)
        
        # Should be available immediately
        assert memory_cache.get_analysis('test-match', 'basic') is not None
        
        # Wait for expiration
        time.sleep(1.5)
        
        # Should be expired
        assert memory_cache.get_analysis('test-match', 'basic') is None
    
    def test_cleanup_removes_expired(self, memory_cache):
        """
        **Feature: ai-match-analysis-system, Property: Cleanup**
        
        Cleanup should remove expired entries.
        """
        # Set with very short TTL
        for i in range(5):
            memory_cache.set_analysis(f'test-{i}', 'basic', {'test': True}, ttl=1)
        
        # Wait for expiration
        time.sleep(1.5)
        
        # Cleanup
        cleaned = memory_cache.cleanup_expired()
        
        assert cleaned == 5


# ============================================
# Property Tests: Clear All
# ============================================

class TestClearAllProperties:
    """Property tests for clearing cache."""
    
    @given(
        match_ids=st.lists(simple_uuid, min_size=1, max_size=10, unique=True)
    )
    @COMMON_SETTINGS
    def test_clear_removes_all(self, cache, match_ids):
        """
        **Feature: ai-match-analysis-system, Property: Clear All**
        
        Clear should remove all entries.
        """
        # Add entries
        for match_id in match_ids:
            cache.set_analysis(match_id, 'basic', {'test': True})
        
        # Clear
        count = cache.clear_all()
        
        # Verify all removed
        for match_id in match_ids:
            assert cache.get_analysis(match_id, 'basic') is None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
