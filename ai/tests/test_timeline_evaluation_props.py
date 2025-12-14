"""
Property-based tests for Timeline Evaluation features.

**Feature: gomoku-basic-analysis**

Tests for:
- Property 13: Timeline Evaluation Completeness
- Property 14: Significant Moment Detection
- Property 15: Critical Turning Point Detection

Requirements: 6.1, 6.2, 6.4
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.basic_analyzer import BasicAnalyzer
from analysis.types import Move, TimelineEntry


def create_simple_game(num_moves: int = 10) -> List[Move]:
    """Create a simple game with alternating moves near center."""
    moves = []
    center = 7
    for i in range(num_moves):
        player = "X" if i % 2 == 0 else "O"
        # Alternate positions around center
        x = center + (i % 3) - 1
        y = center + (i // 3) - 1
        moves.append(Move(x=x, y=y, player=player, move_number=i + 1))
    return moves


class TestTimelineEvaluationCompleteness:
    """
    **Feature: gomoku-basic-analysis, Property 13: Timeline Evaluation Completeness**
    **Validates: Requirements 6.1**
    
    For any game analysis, the timeline SHALL have board evaluation for every move.
    """
    
    def test_timeline_has_score_for_every_move(self):
        """Every move in timeline should have a score."""
        analyzer = BasicAnalyzer(use_advanced=False)
        moves = create_simple_game(10)
        
        result = analyzer.analyze_game(moves)
        
        assert len(result.timeline) == len(moves)
        for entry in result.timeline:
            assert entry.score is not None
            assert isinstance(entry.score, (int, float))
    
    def test_timeline_has_score_before_for_every_move(self):
        """Every move in timeline should have score_before field."""
        analyzer = BasicAnalyzer(use_advanced=False)
        moves = create_simple_game(10)
        
        result = analyzer.analyze_game(moves)
        
        for entry in result.timeline:
            assert entry.score_before is not None
            assert isinstance(entry.score_before, (int, float))
    
    def test_timeline_has_score_change_for_every_move(self):
        """Every move in timeline should have score_change field."""
        analyzer = BasicAnalyzer(use_advanced=False)
        moves = create_simple_game(10)
        
        result = analyzer.analyze_game(moves)
        
        for entry in result.timeline:
            assert entry.score_change is not None
            assert isinstance(entry.score_change, (int, float))
    
    def test_score_change_equals_score_minus_score_before(self):
        """score_change should equal score - score_before."""
        analyzer = BasicAnalyzer(use_advanced=False)
        moves = create_simple_game(10)
        
        result = analyzer.analyze_game(moves)
        
        for entry in result.timeline:
            expected_change = entry.score - entry.score_before
            assert abs(entry.score_change - expected_change) < 0.001, \
                f"Move {entry.move}: score_change={entry.score_change}, expected={expected_change}"
    
    def test_first_move_score_before_is_zero(self):
        """First move should have score_before = 0."""
        analyzer = BasicAnalyzer(use_advanced=False)
        moves = create_simple_game(5)
        
        result = analyzer.analyze_game(moves)
        
        assert result.timeline[0].score_before == 0.0
    
    def test_score_before_matches_previous_score(self):
        """Each move's score_before should match previous move's score."""
        analyzer = BasicAnalyzer(use_advanced=False)
        moves = create_simple_game(10)
        
        result = analyzer.analyze_game(moves)
        
        for i in range(1, len(result.timeline)):
            prev_score = result.timeline[i - 1].score
            curr_score_before = result.timeline[i].score_before
            assert abs(prev_score - curr_score_before) < 0.001, \
                f"Move {i + 1}: score_before={curr_score_before}, prev_score={prev_score}"


class TestSignificantMomentDetection:
    """
    **Feature: gomoku-basic-analysis, Property 14: Significant Moment Detection**
    **Validates: Requirements 6.2**
    
    For any move with evaluation change > 20, the move SHALL be marked as significant.
    """
    
    def test_is_significant_field_exists(self):
        """Every timeline entry should have is_significant field."""
        analyzer = BasicAnalyzer(use_advanced=False)
        moves = create_simple_game(10)
        
        result = analyzer.analyze_game(moves)
        
        for entry in result.timeline:
            assert hasattr(entry, 'is_significant')
            assert isinstance(entry.is_significant, bool)
    
    def test_significant_when_change_greater_than_20(self):
        """Move should be significant when |score_change| > 20."""
        analyzer = BasicAnalyzer(use_advanced=False)
        moves = create_simple_game(10)
        
        result = analyzer.analyze_game(moves)
        
        for entry in result.timeline:
            if abs(entry.score_change) > 20:
                assert entry.is_significant, \
                    f"Move {entry.move}: score_change={entry.score_change} should be significant"
    
    def test_not_significant_when_change_less_than_or_equal_20(self):
        """Move should NOT be significant when |score_change| <= 20."""
        analyzer = BasicAnalyzer(use_advanced=False)
        moves = create_simple_game(10)
        
        result = analyzer.analyze_game(moves)
        
        for entry in result.timeline:
            if abs(entry.score_change) <= 20:
                assert not entry.is_significant, \
                    f"Move {entry.move}: score_change={entry.score_change} should NOT be significant"


class TestCriticalTurningPointDetection:
    """
    **Feature: gomoku-basic-analysis, Property 15: Critical Turning Point Detection**
    **Validates: Requirements 6.4**
    
    For any move with evaluation change > 50, the move SHALL be flagged as critical turning point.
    """
    
    def test_is_critical_field_exists(self):
        """Every timeline entry should have is_critical field."""
        analyzer = BasicAnalyzer(use_advanced=False)
        moves = create_simple_game(10)
        
        result = analyzer.analyze_game(moves)
        
        for entry in result.timeline:
            assert hasattr(entry, 'is_critical')
            assert isinstance(entry.is_critical, bool)
    
    def test_critical_when_change_greater_than_50(self):
        """Move should be critical when |score_change| > 50."""
        analyzer = BasicAnalyzer(use_advanced=False)
        moves = create_simple_game(10)
        
        result = analyzer.analyze_game(moves)
        
        for entry in result.timeline:
            if abs(entry.score_change) > 50:
                assert entry.is_critical, \
                    f"Move {entry.move}: score_change={entry.score_change} should be critical"
    
    def test_not_critical_when_change_less_than_or_equal_50(self):
        """Move should NOT be critical when |score_change| <= 50."""
        analyzer = BasicAnalyzer(use_advanced=False)
        moves = create_simple_game(10)
        
        result = analyzer.analyze_game(moves)
        
        for entry in result.timeline:
            if abs(entry.score_change) <= 50:
                assert not entry.is_critical, \
                    f"Move {entry.move}: score_change={entry.score_change} should NOT be critical"
    
    def test_critical_implies_significant(self):
        """If a move is critical, it should also be significant."""
        analyzer = BasicAnalyzer(use_advanced=False)
        moves = create_simple_game(10)
        
        result = analyzer.analyze_game(moves)
        
        for entry in result.timeline:
            if entry.is_critical:
                assert entry.is_significant, \
                    f"Move {entry.move}: critical move should also be significant"


class TestTimelineEvaluationIntegration:
    """Integration tests for timeline evaluation features."""
    
    def test_game_with_winning_move_has_critical_moment(self):
        """A game with a winning move should have at least one critical moment."""
        analyzer = BasicAnalyzer(use_advanced=False)
        
        # Create a game where X wins with 5 in a row
        moves = [
            Move(x=7, y=7, player="X", move_number=1),
            Move(x=7, y=8, player="O", move_number=2),
            Move(x=8, y=7, player="X", move_number=3),
            Move(x=8, y=8, player="O", move_number=4),
            Move(x=9, y=7, player="X", move_number=5),
            Move(x=9, y=8, player="O", move_number=6),
            Move(x=10, y=7, player="X", move_number=7),
            Move(x=10, y=8, player="O", move_number=8),
            Move(x=11, y=7, player="X", move_number=9),  # Winning move
        ]
        
        result = analyzer.analyze_game(moves)
        
        # The winning move should cause a significant score change
        has_significant = any(entry.is_significant for entry in result.timeline)
        assert has_significant, "Game with winning move should have significant moments"
    
    def test_timeline_evaluation_consistency(self):
        """Timeline evaluations should be consistent across multiple analyses."""
        analyzer = BasicAnalyzer(use_advanced=False)
        moves = create_simple_game(8)
        
        result1 = analyzer.analyze_game(moves)
        result2 = analyzer.analyze_game(moves)
        
        for i in range(len(result1.timeline)):
            assert result1.timeline[i].score == result2.timeline[i].score
            assert result1.timeline[i].score_before == result2.timeline[i].score_before
            assert result1.timeline[i].score_change == result2.timeline[i].score_change
            assert result1.timeline[i].is_significant == result2.timeline[i].is_significant
            assert result1.timeline[i].is_critical == result2.timeline[i].is_critical


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
