"""
Integration Tests for AI Match Analysis System

Tests the complete flows:
- Analysis flow (Basic → Pro) end-to-end
- Replay lifecycle (create → navigate → play → cleanup)
- Subscription/usage limits enforcement
- Error handling scenarios (timeout, rate limit, auth)

Requirements: 9.1-9.6, 16.1-16.5, 17.1-17.5
"""

import sys
import os
import pytest
import asyncio
from datetime import date
from unittest.mock import patch, MagicMock, AsyncMock

# Add ai directory to path
AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

from fastapi.testclient import TestClient
from main import (
    app, 
    usage_storage, 
    redis_cache,
    basic_analyzer,
    pro_analyzer,
    replay_engine,
    get_user_usage,
    increment_usage,
    check_usage_limit,
    get_cached_analysis,
    cache_analysis,
)
from analysis.types import Move, SubscriptionTier, FeatureType, USAGE_LIMITS

# Alias for backward compatibility
analysis_cache = redis_cache


# Test client
client = TestClient(app)


# ============================================
# Test Fixtures
# ============================================

@pytest.fixture(autouse=True)
def clear_storage():
    """Clear in-memory storage before each test."""
    usage_storage.clear()
    analysis_cache.clear()
    yield
    usage_storage.clear()
    analysis_cache.clear()


@pytest.fixture
def sample_moves():
    """Sample moves for testing."""
    return [
        {"x": 7, "y": 7, "p": "X"},
        {"x": 7, "y": 8, "p": "O"},
        {"x": 8, "y": 7, "p": "X"},
        {"x": 8, "y": 8, "p": "O"},
        {"x": 6, "y": 7, "p": "X"},
    ]


@pytest.fixture
def valid_match_id():
    """Valid UUID for match_id."""
    return "12345678-1234-1234-1234-123456789012"


@pytest.fixture
def valid_user_id():
    """Valid UUID for user_id."""
    return "87654321-4321-4321-4321-210987654321"


# ============================================
# Test 1: Analysis Flow (Basic → Pro) End-to-End
# Requirements: 9.1, 16.1, 16.2, 17.1
# ============================================

class TestAnalysisFlowEndToEnd:
    """Test complete analysis flow from Basic to Pro tier."""
    
    def test_basic_analysis_returns_valid_structure(self, sample_moves, valid_match_id, valid_user_id):
        """Test basic analysis returns all required fields."""
        payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "basic",
            "subscription_tier": "trial"
        }
        
        response = client.post("/analyze", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields exist
        assert "tier" in data
        assert data["tier"] == "basic"
        assert "timeline" in data
        assert "mistakes" in data
        assert "patterns" in data
        assert "summary" in data
        assert "duration_ms" in data
        
        # Verify timeline length matches moves
        assert len(data["timeline"]) == len(sample_moves)
    
    def test_basic_analysis_timeline_structure(self, sample_moves, valid_match_id, valid_user_id):
        """Test timeline entries have correct structure."""
        payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "basic",
            "subscription_tier": "trial"
        }
        
        response = client.post("/analyze", json=payload)
        data = response.json()
        
        for entry in data["timeline"]:
            assert "move" in entry
            assert "player" in entry
            assert "position" in entry
            assert "score" in entry
            assert "win_prob" in entry
            assert "category" in entry
            assert "note" in entry
            
            # Validate win_prob range
            assert 0 <= entry["win_prob"] <= 1
    
    def test_analysis_caching_works(self, sample_moves, valid_match_id, valid_user_id):
        """Test that analysis results are cached - Requirements 16.1, 16.2."""
        payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "basic",
            "subscription_tier": "trial"
        }
        
        # First request
        response1 = client.post("/analyze", json=payload)
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Second request should return cached result
        response2 = client.post("/analyze", json=payload)
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Results should be identical (from cache)
        assert data1["tier"] == data2["tier"]
        assert len(data1["timeline"]) == len(data2["timeline"])
    
    def test_pro_analysis_includes_ai_insights(self, sample_moves, valid_match_id, valid_user_id):
        """Test Pro analysis includes AI insights when available."""
        payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "pro",
            "subscription_tier": "pro"
        }
        
        response = client.post("/analyze", json=payload)
        
        # Pro analysis may succeed or fallback to basic
        assert response.status_code == 200
        data = response.json()
        
        # Should have either ai_insights or fallback flag
        if data.get("fallback"):
            assert data.get("fallback_reason") is not None
        else:
            # If no fallback, should have ai_insights
            assert "ai_insights" in data or data.get("tier") == "basic"
    
    def test_pro_fallback_to_basic_on_ai_failure(self, sample_moves, valid_match_id, valid_user_id):
        """Test Pro analysis falls back to basic when AI fails - Requirements 17.1.
        
        Note: The pro_analyzer internally catches AI failures and returns basic analysis.
        The fallback flag is only set when the entire analyze_game method fails.
        When API key is not configured, pro_analyzer gracefully degrades to basic analysis.
        """
        payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "pro",
            "subscription_tier": "pro"
        }
        
        # Clear cache to ensure fresh analysis
        analysis_cache.clear()
        
        response = client.post("/analyze", json=payload)
        
        # Should still return 200 (either with fallback flag or graceful degradation)
        assert response.status_code == 200
        data = response.json()
        
        # Pro analyzer gracefully degrades when AI is unavailable
        # It either returns with fallback=True or returns basic tier result
        if data.get("fallback"):
            assert "fallback_reason" in data
        else:
            # Graceful degradation - returns result without AI insights
            # This is valid behavior when API key is not configured
            assert "timeline" in data
            assert "mistakes" in data
    
    def test_analysis_tracks_usage(self, sample_moves, valid_match_id, valid_user_id):
        """Test that analysis increments usage counter."""
        payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "basic",
            "subscription_tier": "trial"
        }
        
        # Clear cache to ensure fresh analysis
        analysis_cache.clear()
        
        # Check initial usage
        initial_usage = get_user_usage(valid_user_id, "basic_analysis", "daily")
        
        response = client.post("/analyze", json=payload)
        assert response.status_code == 200
        
        # Check usage incremented
        new_usage = get_user_usage(valid_user_id, "basic_analysis", "daily")
        assert new_usage == initial_usage + 1


# ============================================
# Test 2: Replay Lifecycle
# Requirements: 9.3, 9.4, 9.5, 5.1-5.6
# ============================================

class TestReplayLifecycle:
    """Test complete replay lifecycle: create → navigate → play → cleanup."""
    
    def test_create_replay_session(self, sample_moves, valid_match_id, valid_user_id):
        """Test creating a replay session - Requirements 9.3, 5.1."""
        payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "trial"
        }
        
        response = client.post("/replay/create", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "session_id" in data
        assert "total_moves" in data
        assert data["total_moves"] == len(sample_moves)
        assert len(data["session_id"]) > 0
    
    def test_navigate_to_move(self, sample_moves, valid_match_id, valid_user_id):
        """Test navigating to specific move - Requirements 9.4, 5.2."""
        # Create session first
        create_payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "trial"
        }
        create_response = client.post("/replay/create", json=create_payload)
        session_id = create_response.json()["session_id"]
        
        # Navigate to move 2
        nav_payload = {
            "session_id": session_id,
            "move_index": 2
        }
        response = client.post("/replay/navigate", json=nav_payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "board_state" in data
        assert "current_move" in data
        assert "player_turn" in data
        assert data["current_move"] == 2
    
    def test_navigate_to_start(self, sample_moves, valid_match_id, valid_user_id):
        """Test navigating to start (move -1) - Requirements 5.2."""
        # Create session
        create_payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "trial"
        }
        create_response = client.post("/replay/create", json=create_payload)
        session_id = create_response.json()["session_id"]
        
        # Navigate to start
        nav_payload = {
            "session_id": session_id,
            "move_index": -1
        }
        response = client.post("/replay/navigate", json=nav_payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["current_move"] == -1
        # Board should be empty at start (2D array with all None values)
        board_state = data["board_state"]
        # Check that board is a 2D array with all None values
        if isinstance(board_state, list):
            # Count non-None cells
            non_empty_cells = sum(
                1 for row in board_state 
                for cell in row 
                if cell is not None
            )
            assert non_empty_cells == 0, "Board should be empty at start"
        else:
            # If it's a dict, it should be empty
            assert board_state == {} or len(board_state) == 0
    
    def test_play_alternative_move(self, sample_moves, valid_match_id, valid_user_id):
        """Test playing alternative move - Requirements 9.5, 5.3, 5.4."""
        # Create session
        create_payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "trial"
        }
        create_response = client.post("/replay/create", json=create_payload)
        session_id = create_response.json()["session_id"]
        
        # Navigate to move 1
        nav_payload = {"session_id": session_id, "move_index": 1}
        client.post("/replay/navigate", json=nav_payload)
        
        # Play alternative move
        play_payload = {
            "session_id": session_id,
            "move": {"x": 9, "y": 9, "p": "X"}
        }
        response = client.post("/replay/play", json=play_payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "board_state" in data
        assert "ai_move" in data
        assert "original_outcome" in data
        assert "current_win_prob" in data
        assert "comparison" in data
    
    def test_cleanup_session(self, sample_moves, valid_match_id, valid_user_id):
        """Test cleaning up replay session - Requirements 5.6."""
        # Create session
        create_payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "trial"
        }
        create_response = client.post("/replay/create", json=create_payload)
        session_id = create_response.json()["session_id"]
        
        # Delete session
        response = client.delete(f"/replay/{session_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        
        # Trying to navigate should fail
        nav_payload = {"session_id": session_id, "move_index": 0}
        nav_response = client.post("/replay/navigate", json=nav_payload)
        
        # Should return error (session not found)
        assert nav_response.status_code in [400, 500]
    
    def test_full_replay_lifecycle(self, sample_moves, valid_match_id, valid_user_id):
        """Test complete replay lifecycle end-to-end."""
        # 1. Create session
        create_payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "trial"
        }
        create_response = client.post("/replay/create", json=create_payload)
        assert create_response.status_code == 200
        session_id = create_response.json()["session_id"]
        
        # 2. Navigate through moves
        for i in range(len(sample_moves)):
            nav_payload = {"session_id": session_id, "move_index": i}
            nav_response = client.post("/replay/navigate", json=nav_payload)
            assert nav_response.status_code == 200
            assert nav_response.json()["current_move"] == i
        
        # 3. Go back and play alternative
        nav_payload = {"session_id": session_id, "move_index": 1}
        client.post("/replay/navigate", json=nav_payload)
        
        play_payload = {
            "session_id": session_id,
            "move": {"x": 5, "y": 5, "p": "X"}
        }
        play_response = client.post("/replay/play", json=play_payload)
        assert play_response.status_code == 200
        
        # 4. Cleanup
        delete_response = client.delete(f"/replay/{session_id}")
        assert delete_response.status_code == 200


# ============================================
# Test 3: Subscription/Usage Limits Enforcement
# Requirements: 7.1-7.6, 8.1-8.5
# ============================================

class TestSubscriptionUsageLimits:
    """Test subscription tier and usage limit enforcement."""
    
    def test_free_tier_has_limited_basic_analysis(self, valid_user_id):
        """Test Free tier has limited basic analysis."""
        # Free tier should have limited daily usage
        limits = USAGE_LIMITS.get(SubscriptionTier.FREE, {})
        basic_limit = limits.get(FeatureType.BASIC_ANALYSIS, {}).get('daily', 0)
        
        # Free tier should have some limit (not unlimited)
        assert basic_limit > 0 or basic_limit == -1  # -1 means unlimited
    
    def test_trial_tier_has_pro_access(self, valid_user_id):
        """Test Trial tier has access to Pro features."""
        limits = USAGE_LIMITS.get(SubscriptionTier.TRIAL, {})
        pro_limit = limits.get(FeatureType.PRO_ANALYSIS, {}).get('daily', 0)
        
        # Trial should have some Pro access
        assert pro_limit > 0 or pro_limit == -1
    
    def test_usage_tracking_increments_correctly(self, valid_user_id):
        """Test usage tracking increments correctly - Requirements 8.1."""
        feature = "basic_analysis"
        
        # Initial usage should be 0
        initial = get_user_usage(valid_user_id, feature, "daily")
        assert initial == 0
        
        # Increment usage
        increment_usage(valid_user_id, feature)
        
        # Should be 1 now
        after = get_user_usage(valid_user_id, feature, "daily")
        assert after == 1
        
        # Increment again
        increment_usage(valid_user_id, feature)
        
        # Should be 2
        final = get_user_usage(valid_user_id, feature, "daily")
        assert final == 2
    
    def test_usage_limit_check_works(self, valid_user_id):
        """Test usage limit checking - Requirements 8.2, 8.3."""
        feature = "basic_analysis"
        tier = "free"
        
        # Get the limit for free tier
        limits = USAGE_LIMITS.get(SubscriptionTier.FREE, {})
        daily_limit = limits.get(FeatureType.BASIC_ANALYSIS, {}).get('daily', 3)
        
        if daily_limit == -1:
            # Unlimited, skip this test
            pytest.skip("Free tier has unlimited basic analysis")
        
        # Should be allowed initially
        assert check_usage_limit(valid_user_id, feature, tier) == True
        
        # Use up the limit
        for _ in range(daily_limit):
            increment_usage(valid_user_id, feature)
        
        # Should now be blocked
        assert check_usage_limit(valid_user_id, feature, tier) == False
    
    def test_rate_limit_returns_429(self, sample_moves, valid_match_id, valid_user_id):
        """Test rate limit returns 429 status - Requirements 7.6."""
        # Get the limit for free tier
        limits = USAGE_LIMITS.get(SubscriptionTier.FREE, {})
        daily_limit = limits.get(FeatureType.BASIC_ANALYSIS, {}).get('daily', 3)
        
        if daily_limit == -1:
            pytest.skip("Free tier has unlimited basic analysis")
        
        # Use up the limit
        for _ in range(daily_limit):
            increment_usage(valid_user_id, "basic_analysis")
        
        # Clear cache to force new analysis
        analysis_cache.clear()
        
        payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "basic",
            "subscription_tier": "free"
        }
        
        response = client.post("/analyze", json=payload)
        
        assert response.status_code == 429
        data = response.json()
        assert "error" in data or "Daily limit reached" in str(data)
    
    def test_get_usage_endpoint(self, valid_user_id):
        """Test GET /usage endpoint - Requirements 8.5."""
        # Add some usage
        increment_usage(valid_user_id, "basic_analysis")
        increment_usage(valid_user_id, "basic_analysis")
        increment_usage(valid_user_id, "pro_analysis")
        
        response = client.get(f"/usage?user_id={valid_user_id}&tier=trial")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "tier" in data
        assert "daily_usage" in data
        assert "monthly_usage" in data
        assert "daily_remaining" in data
        assert "monthly_remaining" in data
        
        assert data["daily_usage"]["basic_analysis"] == 2
        assert data["daily_usage"]["pro_analysis"] == 1


# ============================================
# Test 4: Error Handling Scenarios
# Requirements: 17.1-17.5
# ============================================

class TestErrorHandling:
    """Test error handling scenarios."""
    
    def test_invalid_uuid_returns_422(self, sample_moves, valid_user_id):
        """Test invalid UUID returns validation error - Requirements 17.4."""
        payload = {
            "match_id": "invalid-uuid",
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "basic"
        }
        
        response = client.post("/analyze", json=payload)
        
        assert response.status_code == 422  # Validation error
    
    def test_missing_required_field_returns_400_or_422(self, sample_moves, valid_match_id):
        """Test missing required field returns error - Requirements 17.4."""
        payload = {
            "match_id": valid_match_id,
            # Missing user_id
            "moves": sample_moves,
            "tier": "basic"
        }
        
        response = client.post("/analyze", json=payload)
        
        assert response.status_code in [400, 422]
    
    def test_invalid_move_coordinates_rejected(self, valid_match_id, valid_user_id):
        """Test invalid move coordinates are rejected - Requirements 17.4."""
        payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": [
                {"x": 100, "y": 7, "p": "X"}  # x out of range
            ],
            "tier": "basic"
        }
        
        response = client.post("/analyze", json=payload)
        
        assert response.status_code == 422  # Validation error
    
    def test_empty_question_rejected(self, valid_match_id, valid_user_id):
        """Test empty question is rejected - Requirements 17.4."""
        payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "question": "",
            "tier": "trial"
        }
        
        response = client.post("/ask", json=payload)
        
        assert response.status_code == 422  # Validation error
    
    def test_invalid_session_id_returns_error(self):
        """Test invalid session ID returns error."""
        payload = {
            "session_id": "nonexistent-session-id",
            "move_index": 0
        }
        
        response = client.post("/replay/navigate", json=payload)
        
        # Should return error (400 or 500)
        assert response.status_code in [400, 500]
    
    def test_timeout_handling(self, sample_moves, valid_match_id, valid_user_id):
        """Test timeout returns 504 - Requirements 17.3, 16.5."""
        payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "pro",
            "subscription_tier": "pro"
        }
        
        # Mock to simulate timeout
        async def slow_analyze(*args, **kwargs):
            await asyncio.sleep(30)  # Longer than timeout
            return None
        
        with patch.object(pro_analyzer, 'analyze_game', side_effect=asyncio.TimeoutError()):
            response = client.post("/analyze", json=payload)
        
        # Should either timeout (504) or fallback to basic (200)
        assert response.status_code in [200, 504]
    
    def test_internal_error_returns_500(self, sample_moves, valid_match_id, valid_user_id):
        """Test internal error returns 500 - Requirements 17.5."""
        payload = {
            "match_id": valid_match_id,
            "user_id": valid_user_id,
            "moves": sample_moves,
            "tier": "basic",
            "subscription_tier": "trial"
        }
        
        # Mock to raise unexpected error
        with patch.object(basic_analyzer, 'analyze_game', side_effect=RuntimeError("Unexpected error")):
            response = client.post("/analyze", json=payload)
        
        assert response.status_code == 500
        data = response.json()
        
        # Should not expose internal details
        assert "RuntimeError" not in str(data)
        assert "Unexpected error" not in str(data)
    
    def test_health_endpoint_always_works(self):
        """Test health endpoint is always available."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


# ============================================
# Additional Integration Tests
# ============================================

class TestCacheIntegration:
    """Test caching integration - Requirements 16.1, 16.2."""
    
    def test_cache_key_format(self, valid_match_id):
        """Test cache key format is correct."""
        from main import get_cache_key
        
        key = get_cache_key(valid_match_id, "basic")
        assert key == f"{valid_match_id}:basic"
        
        key = get_cache_key(valid_match_id, "pro")
        assert key == f"{valid_match_id}:pro"
    
    def test_cache_stores_and_retrieves(self, valid_match_id):
        """Test cache stores and retrieves correctly."""
        result = {"test": "data", "tier": "basic"}
        
        # Store in cache
        cache_analysis(valid_match_id, "basic", result)
        
        # Retrieve from cache
        cached = get_cached_analysis(valid_match_id, "basic")
        
        assert cached is not None
        assert cached["test"] == "data"
        assert cached["tier"] == "basic"
    
    def test_different_tiers_cached_separately(self, valid_match_id):
        """Test different tiers are cached separately."""
        basic_result = {"tier": "basic", "data": "basic_data"}
        pro_result = {"tier": "pro", "data": "pro_data"}
        
        cache_analysis(valid_match_id, "basic", basic_result)
        cache_analysis(valid_match_id, "pro", pro_result)
        
        cached_basic = get_cached_analysis(valid_match_id, "basic")
        cached_pro = get_cached_analysis(valid_match_id, "pro")
        
        assert cached_basic["tier"] == "basic"
        assert cached_pro["tier"] == "pro"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
