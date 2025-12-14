"""
Property-Based Tests for ProAnalyzer

**Feature: ai-match-analysis-system, Property 5: Pro Analysis Enhancement**
**Validates: Requirements 4.1, 4.3, 4.6, 4.5**
"""

import pytest
import asyncio
from hypothesis import given, strategies as st, settings
from unittest.mock import AsyncMock, patch, MagicMock
from analysis.pro_analyzer import ProAnalyzer
from analysis.types import (
    Move,
    AnalysisResult,
    AIInsights,
    TimelineEntry,
    Mistake,
    Pattern,
    Summary,
    MoveClassification,
    BOARD_SIZE,
)


def run_async(coro):
    """Helper to run async functions in sync context"""
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(coro)


@st.composite
def simple_game_moves(draw):
    """Generate a simple game with 1-5 moves"""
    num_moves = draw(st.integers(min_value=1, max_value=5))
    all_positions = [(x, y) for x in range(BOARD_SIZE) for y in range(BOARD_SIZE)]
    positions = draw(st.lists(
        st.sampled_from(all_positions),
        min_size=num_moves,
        max_size=num_moves,
        unique=True
    ))
    
    moves = []
    for i, (x, y) in enumerate(positions):
        player = "X" if i % 2 == 0 else "O"
        moves.append(Move(x=x, y=y, player=player, move_number=i + 1))
    
    return moves


class TestProAnalyzerProps:
    """Property tests for ProAnalyzer"""
    
    def setup_method(self):
        # Use a dummy API key for testing
        self.analyzer = ProAnalyzer(api_key="test_key_12345")
    
    @given(moves=simple_game_moves())
    @settings(max_examples=10, deadline=None)
    def test_basic_analysis_runs_first(self, moves):
        """**Feature: ai-match-analysis-system, Property 5: Pro Analysis Enhancement**
        Requirement 4.1: Basic analysis must complete before AI enhancement"""
        
        # Mock the AI API call to fail
        with patch.object(self.analyzer, '_call_openrouter_api', 
                         side_effect=Exception("API unavailable")):
            result = run_async(self.analyzer.analyze_game(moves))
            
            # Even with AI failure, basic analysis should complete
            assert len(result.timeline) == len(moves)
            assert result.summary is not None
            assert result.summary.total_moves == len(moves)
    
    @given(moves=simple_game_moves())
    @settings(max_examples=10, deadline=None)
    def test_ai_enhancement_adds_insights(self, moves):
        """**Feature: ai-match-analysis-system, Property 5: Pro Analysis Enhancement**
        Requirement 4.3: AI enhancement adds natural language explanations"""
        
        # Mock successful AI response
        mock_response = """{
            "summary": "Ván đấu cân bằng với nhiều cơ hội.",
            "mistake_explanations": [
                {"move": 1, "why": "Bỏ lỡ cơ hội tấn công", "should": "Nên chơi vào trung tâm"}
            ],
            "improvement_tips": ["Kiểm soát trung tâm tốt hơn"],
            "advanced_patterns": []
        }"""
        
        async def mock_api_call(prompt):
            return mock_response
        
        with patch.object(self.analyzer, '_call_openrouter_api', 
                         side_effect=mock_api_call):
            result = run_async(self.analyzer.analyze_game(moves))
            
            # Check that AI insights are present
            assert result.ai_insights is not None
            assert isinstance(result.ai_insights.natural_language_summary, str)
            assert len(result.ai_insights.natural_language_summary) > 0
            assert result.tier == "pro"
    
    @given(moves=simple_game_moves())
    @settings(max_examples=10, deadline=None)
    def test_improvement_tips_are_relevant(self, moves):
        """**Feature: ai-match-analysis-system, Property 5: Pro Analysis Enhancement**
        Requirement 4.6: Improvement tips are non-empty and relevant"""
        
        # Mock AI response with improvement tips
        mock_response = """{
            "summary": "Phân tích hoàn tất.",
            "mistake_explanations": [],
            "improvement_tips": [
                "Chú ý đến các đe dọa của đối thủ",
                "Tạo nhiều đường tấn công song song",
                "Kiểm soát trung tâm bàn cờ"
            ],
            "advanced_patterns": []
        }"""
        
        async def mock_api_call(prompt):
            return mock_response
        
        with patch.object(self.analyzer, '_call_openrouter_api', 
                         side_effect=mock_api_call):
            result = run_async(self.analyzer.analyze_game(moves))
            
            # Check improvement tips
            assert result.ai_insights is not None
            assert isinstance(result.ai_insights.improvement_tips, list)
            assert len(result.ai_insights.improvement_tips) > 0
            
            for tip in result.ai_insights.improvement_tips:
                assert isinstance(tip, str)
                assert len(tip) > 0
    
    @given(moves=simple_game_moves())
    @settings(max_examples=10, deadline=None)
    def test_graceful_fallback_on_api_failure(self, moves):
        """**Feature: ai-match-analysis-system, Property 5: Pro Analysis Enhancement**
        Requirement 4.5: Gracefully fallback to basic analysis on API failure"""
        
        # Mock API failure
        with patch.object(self.analyzer, '_call_openrouter_api', 
                         side_effect=Exception("Network error")):
            result = run_async(self.analyzer.analyze_game(moves))
            
            # Should still return valid result
            assert result is not None
            assert len(result.timeline) == len(moves)
            assert result.summary is not None
            
            # Tier should be 'basic' due to fallback
            assert result.tier == "basic"
            
            # AI insights should be None
            assert result.ai_insights is None
    
    @given(moves=simple_game_moves())
    @settings(max_examples=10, deadline=None)
    def test_mistake_explanations_structure(self, moves):
        """**Feature: ai-match-analysis-system, Property 5: Pro Analysis Enhancement**
        Requirement 4.3: Mistake explanations have 'why' and 'should' fields"""
        
        # Mock AI response with mistake explanations
        mock_response = """{
            "summary": "Có một số sai lầm cần cải thiện.",
            "mistake_explanations": [
                {
                    "move": 1,
                    "why": "Nước này không tạo đe dọa và để đối thủ kiểm soát trung tâm",
                    "should": "Nên chơi vào vị trí (8,8) để kiểm soát trung tâm"
                }
            ],
            "improvement_tips": ["Cải thiện khả năng đọc ván"],
            "advanced_patterns": []
        }"""
        
        async def mock_api_call(prompt):
            return mock_response
        
        with patch.object(self.analyzer, '_call_openrouter_api', 
                         side_effect=mock_api_call):
            result = run_async(self.analyzer.analyze_game(moves))
            
            # Check mistake explanations structure
            assert result.ai_insights is not None
            assert isinstance(result.ai_insights.mistake_explanations, list)
            
            for explanation in result.ai_insights.mistake_explanations:
                assert isinstance(explanation, dict)
                assert "move" in explanation
                assert "why" in explanation
                assert "should" in explanation
                assert isinstance(explanation["why"], str)
                assert isinstance(explanation["should"], str)
                assert len(explanation["why"]) > 0
                assert len(explanation["should"]) > 0
    
    def test_parse_ai_response_with_valid_json(self):
        """**Feature: ai-match-analysis-system, Property 5: Pro Analysis Enhancement**
        Parse valid JSON response correctly"""
        
        response_text = """```json
{
    "summary": "Test summary",
    "mistake_explanations": [{"move": 1, "why": "Test why", "should": "Test should"}],
    "improvement_tips": ["Tip 1", "Tip 2"],
    "advanced_patterns": [{"name": "Pattern 1", "explanation": "Explanation 1"}]
}
```"""
        
        # Create a minimal basic result for context
        basic_result = AnalysisResult(
            tier="basic",
            timeline=[],
            mistakes=[],
            patterns=[],
            best_move=None,
            summary=Summary(
                total_moves=0,
                winner=None,
                x_stats={},
                o_stats={},
                key_insights=[]
            )
        )
        
        insights = self.analyzer.parse_ai_response(response_text, basic_result)
        
        assert insights.natural_language_summary == "Test summary"
        assert len(insights.mistake_explanations) == 1
        assert len(insights.improvement_tips) == 2
        assert len(insights.advanced_patterns) == 1
    
    def test_parse_ai_response_fallback(self):
        """**Feature: ai-match-analysis-system, Property 5: Pro Analysis Enhancement**
        Fallback parsing when JSON is invalid"""
        
        response_text = "This is not JSON but still useful text about the game."
        
        # Create a minimal basic result with a mistake
        basic_result = AnalysisResult(
            tier="basic",
            timeline=[],
            mistakes=[
                Mistake(
                    move=1,
                    severity="major",
                    desc="Test mistake",
                    best_alternative={"x": 7, "y": 7}
                )
            ],
            patterns=[],
            best_move=None,
            summary=Summary(
                total_moves=1,
                winner=None,
                x_stats={},
                o_stats={},
                key_insights=[]
            )
        )
        
        insights = self.analyzer.parse_ai_response(response_text, basic_result)
        
        # Should create fallback insights
        assert isinstance(insights.natural_language_summary, str)
        assert len(insights.natural_language_summary) > 0
        assert isinstance(insights.improvement_tips, list)
        assert len(insights.improvement_tips) > 0
    
    def test_build_analysis_prompt_structure(self):
        """**Feature: ai-match-analysis-system, Property 5: Pro Analysis Enhancement**
        Analysis prompt includes game context"""
        
        moves = [
            Move(x=7, y=7, player="X", move_number=1),
            Move(x=7, y=8, player="O", move_number=2),
        ]
        
        # Create a basic result
        basic_result = AnalysisResult(
            tier="basic",
            timeline=[
                TimelineEntry(
                    move=1,
                    player="X",
                    position={"x": 7, "y": 7},
                    score=50.0,
                    win_prob=0.55,
                    category=MoveClassification.GOOD,
                    note="Nước đi tốt"
                ),
                TimelineEntry(
                    move=2,
                    player="O",
                    position={"x": 7, "y": 8},
                    score=-30.0,
                    win_prob=0.45,
                    category=MoveClassification.OKAY,
                    note="Nước đi chấp nhận được"
                )
            ],
            mistakes=[],
            patterns=[],
            best_move=None,
            summary=Summary(
                total_moves=2,
                winner=None,
                x_stats={"accuracy": 75.0},
                o_stats={"accuracy": 60.0},
                key_insights=[]
            )
        )
        
        prompt = self.analyzer.build_analysis_prompt(moves, basic_result)
        
        # Check that prompt contains key information
        assert "Phân Tích Ván Đấu Cờ Caro" in prompt
        assert "Tổng số nước: 2" in prompt
        assert "Độ chính xác X: 75.0%" in prompt
        assert "Độ chính xác O: 60.0%" in prompt
        assert "JSON" in prompt  # Should request JSON format
    
    def test_ask_about_game_returns_answer(self):
        """**Feature: ai-match-analysis-system, Property 5: Pro Analysis Enhancement**
        Q&A feature returns non-empty answer"""
        
        mock_response = "Nước đi này tạo đe dọa mạnh vì nó kiểm soát trung tâm."
        
        async def mock_api_call(prompt):
            return mock_response
        
        with patch.object(self.analyzer, '_call_openrouter_api', 
                         side_effect=mock_api_call):
            answer = run_async(self.analyzer.ask_about_game(
                match_id="test-123",
                question="Tại sao nước 5 là nước tốt?",
                context=None
            ))
            
            assert isinstance(answer, str)
            assert len(answer) > 0
    
    def test_ask_about_game_handles_error(self):
        """**Feature: ai-match-analysis-system, Property 5: Pro Analysis Enhancement**
        Q&A feature handles errors gracefully"""
        
        with patch.object(self.analyzer, '_call_openrouter_api', 
                         side_effect=Exception("API error")):
            answer = run_async(self.analyzer.ask_about_game(
                match_id="test-123",
                question="Test question?",
                context=None
            ))
            
            # Should return error message, not crash
            assert isinstance(answer, str)
            assert "Xin lỗi" in answer or "không thể" in answer


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

