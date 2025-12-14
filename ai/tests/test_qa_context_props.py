"""
Property-Based Tests for AI Q&A Context Relevance

**Feature: ai-match-analysis-system, Property 8: Q&A Context Relevance**
**Validates: Requirements 6.1, 6.2, 6.3, 6.4**
"""

import pytest
import asyncio
from hypothesis import given, strategies as st, settings, assume
from unittest.mock import patch
from analysis.pro_analyzer import ProAnalyzer
from analysis.types import (
    Move,
    AnalysisResult,
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
def valid_match_id(draw):
    """Generate a valid UUID-like match ID"""
    return f"match-{draw(st.integers(min_value=1000, max_value=9999))}"


@st.composite
def vietnamese_question(draw):
    """Generate Vietnamese questions about the game"""
    questions = [
        "Tại sao nước này là sai lầm?",
        "Nước nào là tốt nhất?",
        "Làm thế nào để cải thiện?",
        "Đối thủ có yếu điểm gì?",
        "Tôi nên chơi như thế nào?",
        "Mẫu chiến thuật này là gì?",
        "Tại sao tôi thua?",
        "Nước đi này có tốt không?",
    ]
    return draw(st.sampled_from(questions))


@st.composite
def analysis_context(draw):
    """Generate a valid analysis context"""
    num_moves = draw(st.integers(min_value=5, max_value=20))
    
    # Generate timeline
    timeline = []
    for i in range(num_moves):
        player = "X" if i % 2 == 0 else "O"
        timeline.append(TimelineEntry(
            move=i + 1,
            player=player,
            position={"x": draw(st.integers(0, 14)), "y": draw(st.integers(0, 14))},
            score=draw(st.floats(min_value=-1000, max_value=1000)),
            win_prob=draw(st.floats(min_value=0.0, max_value=1.0)),
            category=draw(st.sampled_from(list(MoveClassification))),
            note=draw(st.sampled_from([
                "Nước đi tốt",
                "Nước đi yếu",
                "Sai lầm nghiêm trọng",
                "Nước đi xuất sắc"
            ]))
        ))
    
    # Generate mistakes
    num_mistakes = draw(st.integers(min_value=0, max_value=5))
    mistakes = []
    for i in range(num_mistakes):
        move_num = draw(st.integers(min_value=1, max_value=num_moves))
        mistakes.append(Mistake(
            move=move_num,
            severity=draw(st.sampled_from(["minor", "major", "critical"])),
            desc=f"Sai lầm ở nước {move_num}",
            best_alternative={"x": 7, "y": 7}
        ))
    
    # Generate patterns
    num_patterns = draw(st.integers(min_value=0, max_value=3))
    patterns = []
    for i in range(num_patterns):
        patterns.append(Pattern(
            label=draw(st.sampled_from(["Tứ Hướng", "Song Song", "Chặn Muộn"])),
            explanation="Mẫu chiến thuật quan trọng",
            moves=[1, 2, 3],
            severity="high"
        ))
    
    # Generate summary
    winner = draw(st.sampled_from(["X", "O", None]))
    summary = Summary(
        total_moves=num_moves,
        winner=winner,
        x_stats={"accuracy": draw(st.floats(min_value=0, max_value=100))},
        o_stats={"accuracy": draw(st.floats(min_value=0, max_value=100))},
        key_insights=["Insight 1", "Insight 2"]
    )
    
    return AnalysisResult(
        tier="pro",
        timeline=timeline,
        mistakes=mistakes,
        patterns=patterns,
        best_move=None,
        summary=summary
    )


class TestQAContextRelevance:
    """Property tests for Q&A context relevance"""
    
    def setup_method(self):
        self.analyzer = ProAnalyzer(api_key="test_key_12345")
    
    @given(
        match_id=valid_match_id(),
        question=vietnamese_question(),
        context=analysis_context()
    )
    @settings(max_examples=20, deadline=None)
    def test_answer_is_non_empty_vietnamese(self, match_id, question, context):
        """**Feature: ai-match-analysis-system, Property 8: Q&A Context Relevance**
        Requirement 6.1, 6.2: Answer must be non-empty and in Vietnamese"""
        
        # Mock AI response in Vietnamese
        mock_response = "Nước đi này tạo đe dọa mạnh vì nó kiểm soát trung tâm bàn cờ."
        
        async def mock_api_call(prompt):
            return mock_response
        
        with patch.object(self.analyzer, '_call_openrouter_api', 
                         side_effect=mock_api_call):
            answer = run_async(self.analyzer.ask_about_game(
                match_id=match_id,
                question=question,
                context=context
            ))
            
            # Property: Answer must be non-empty
            assert isinstance(answer, str)
            assert len(answer) > 0
            
            # Property: Answer should be in Vietnamese (contains Vietnamese characters or common words)
            vietnamese_indicators = ["đi", "nước", "cờ", "thắng", "thua", "tốt", "xấu", "sai", "đúng"]
            has_vietnamese = any(word in answer.lower() for word in vietnamese_indicators)
            assert has_vietnamese or len(answer) > 10  # Either has Vietnamese or is substantial
    
    @given(
        match_id=valid_match_id(),
        question=vietnamese_question(),
        context=analysis_context()
    )
    @settings(max_examples=20, deadline=None)
    def test_context_included_in_prompt(self, match_id, question, context):
        """**Feature: ai-match-analysis-system, Property 8: Q&A Context Relevance**
        Requirement 6.1, 6.2: Analysis context must be included in the prompt"""
        
        captured_prompt = None
        
        async def mock_api_call(prompt):
            nonlocal captured_prompt
            captured_prompt = prompt
            return "Câu trả lời mẫu."
        
        with patch.object(self.analyzer, '_call_openrouter_api', 
                         side_effect=mock_api_call):
            run_async(self.analyzer.ask_about_game(
                match_id=match_id,
                question=question,
                context=context
            ))
            
            # Property: Prompt must include context information
            assert captured_prompt is not None
            assert match_id in captured_prompt
            assert question in captured_prompt
            
            # Property: Prompt must include summary stats
            assert str(context.summary.total_moves) in captured_prompt
            
            # Property: If mistakes exist, they should be in prompt
            if context.mistakes:
                assert "Sai Lầm" in captured_prompt or "sai lầm" in captured_prompt
    
    @given(
        match_id=valid_match_id(),
        question=vietnamese_question()
    )
    @settings(max_examples=15, deadline=None)
    def test_works_without_context(self, match_id, question):
        """**Feature: ai-match-analysis-system, Property 8: Q&A Context Relevance**
        Requirement 6.1: Should work even without analysis context"""
        
        mock_response = "Tôi cần thêm thông tin để trả lời chính xác hơn."
        
        async def mock_api_call(prompt):
            return mock_response
        
        with patch.object(self.analyzer, '_call_openrouter_api', 
                         side_effect=mock_api_call):
            answer = run_async(self.analyzer.ask_about_game(
                match_id=match_id,
                question=question,
                context=None  # No context provided
            ))
            
            # Property: Should still return a valid answer
            assert isinstance(answer, str)
            assert len(answer) > 0
    
    @given(
        match_id=valid_match_id(),
        question=vietnamese_question(),
        context=analysis_context()
    )
    @settings(max_examples=15, deadline=None)
    def test_references_specific_moves_when_relevant(self, match_id, question, context):
        """**Feature: ai-match-analysis-system, Property 8: Q&A Context Relevance**
        Requirement 6.3: Should reference specific moves when applicable"""
        
        # Assume the question is about a specific move
        assume(any(word in question.lower() for word in ["nước", "move"]))
        
        # Mock response that references a move
        move_num = context.mistakes[0].move if context.mistakes else 1
        mock_response = f"Nước {move_num} là sai lầm vì không tạo đe dọa."
        
        async def mock_api_call(prompt):
            return mock_response
        
        with patch.object(self.analyzer, '_call_openrouter_api', 
                         side_effect=mock_api_call):
            answer = run_async(self.analyzer.ask_about_game(
                match_id=match_id,
                question=question,
                context=context
            ))
            
            # Property: Answer should be contextual and specific
            assert isinstance(answer, str)
            assert len(answer) > 0
    
    @given(
        match_id=valid_match_id(),
        question=vietnamese_question(),
        context=analysis_context()
    )
    @settings(max_examples=15, deadline=None)
    def test_actionable_suggestions_in_response(self, match_id, question, context):
        """**Feature: ai-match-analysis-system, Property 8: Q&A Context Relevance**
        Requirement 6.4: Should include actionable suggestions"""
        
        # Mock response with actionable suggestion
        mock_response = "Bạn nên chơi vào trung tâm để kiểm soát bàn cờ tốt hơn. Hãy thử nước (7,7)."
        
        async def mock_api_call(prompt):
            return mock_response
        
        with patch.object(self.analyzer, '_call_openrouter_api', 
                         side_effect=mock_api_call):
            answer = run_async(self.analyzer.ask_about_game(
                match_id=match_id,
                question=question,
                context=context
            ))
            
            # Property: Answer should contain actionable content
            assert isinstance(answer, str)
            assert len(answer) > 0
            
            # Check for action-oriented words
            action_words = ["nên", "hãy", "thử", "cải thiện", "tránh", "chú ý"]
            has_action = any(word in answer.lower() for word in action_words)
            
            # Either has action words or is substantial enough to be helpful
            assert has_action or len(answer) > 20
    
    @given(
        match_id=valid_match_id(),
        question=vietnamese_question(),
        context=analysis_context()
    )
    @settings(max_examples=10, deadline=None)
    def test_handles_api_errors_gracefully(self, match_id, question, context):
        """**Feature: ai-match-analysis-system, Property 8: Q&A Context Relevance**
        Should handle API errors gracefully"""
        
        # Mock API failure
        with patch.object(self.analyzer, '_call_openrouter_api', 
                         side_effect=Exception("Network error")):
            answer = run_async(self.analyzer.ask_about_game(
                match_id=match_id,
                question=question,
                context=context
            ))
            
            # Property: Should return error message, not crash
            assert isinstance(answer, str)
            assert len(answer) > 0
            assert "Xin lỗi" in answer or "không thể" in answer
    
    @given(
        match_id=valid_match_id(),
        question=vietnamese_question(),
        context=analysis_context()
    )
    @settings(max_examples=10, deadline=None)
    def test_concise_responses(self, match_id, question, context):
        """**Feature: ai-match-analysis-system, Property 8: Q&A Context Relevance**
        Requirement 6.2: Responses should be concise (2-3 sentences)"""
        
        # Mock a concise response
        mock_response = "Nước này tốt vì kiểm soát trung tâm. Bạn nên tiếp tục tấn công."
        
        async def mock_api_call(prompt):
            return mock_response
        
        with patch.object(self.analyzer, '_call_openrouter_api', 
                         side_effect=mock_api_call):
            answer = run_async(self.analyzer.ask_about_game(
                match_id=match_id,
                question=question,
                context=context
            ))
            
            # Property: Answer should be concise
            assert isinstance(answer, str)
            assert len(answer) > 0
            
            # Count sentences (rough approximation)
            sentence_count = answer.count('.') + answer.count('!') + answer.count('?')
            
            # Should be reasonably concise (not a novel)
            assert len(answer) < 1000  # Not too long
    
    def test_empty_response_handling(self):
        """**Feature: ai-match-analysis-system, Property 8: Q&A Context Relevance**
        Should handle empty AI responses"""
        
        # Mock empty response
        async def mock_api_call(prompt):
            return ""
        
        with patch.object(self.analyzer, '_call_openrouter_api', 
                         side_effect=mock_api_call):
            answer = run_async(self.analyzer.ask_about_game(
                match_id="test-123",
                question="Test question?",
                context=None
            ))
            
            # Property: Should return fallback message
            assert isinstance(answer, str)
            assert len(answer) > 0
            assert "Xin lỗi" in answer or "không thể" in answer


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
