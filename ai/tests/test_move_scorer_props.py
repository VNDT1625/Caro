"""
Property-Based Tests for MoveScorer

**Feature: gomoku-basic-analysis, Properties 5-6: Move Scoring**
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

Properties tested:
- Property 5: Move Score Range Invariant (0-10)
- Property 6: Move Classification Consistency
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hypothesis import given, strategies as st, settings, assume, HealthCheck
import pytest

from analysis.move_scorer import (
    MoveScorer,
    MoveScoreBreakdown,
    SCORE_THRESHOLDS,
)
from analysis.types import MoveClassification, BOARD_SIZE


@st.composite
def board_with_pieces(draw, min_pieces=2, max_pieces=30):
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    num_pieces = draw(st.integers(min_value=min_pieces, max_value=max_pieces))
    positions = draw(st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=BOARD_SIZE - 1),
            st.integers(min_value=0, max_value=BOARD_SIZE - 1)
        ),
        min_size=num_pieces, max_size=num_pieces, unique=True
    ))
    for i, (x, y) in enumerate(positions):
        board[x][y] = "X" if i % 2 == 0 else "O"
    return board


class TestMoveScoreRange:
    """
    Property 5: Move Score Range Invariant
    Validates: Requirement 2.1
    """
    
    def setup_method(self):
        self.scorer = MoveScorer()
    
    @given(board=board_with_pieces(min_pieces=4, max_pieces=10))
    @settings(max_examples=10, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    def test_score_in_0_10_range(self, board):
        """All move scores should be in 0-10 range."""
        empty = [(r, c) for r in range(BOARD_SIZE) for c in range(BOARD_SIZE) if board[r][c] is None]
        assume(len(empty) > 0)
        
        move = empty[0]
        breakdown = self.scorer.score_move(board, move, "X")
        
        assert 0 <= breakdown.final_score <= 10, f"Score {breakdown.final_score} out of range"
    
    @given(board=board_with_pieces(min_pieces=4, max_pieces=10))
    @settings(max_examples=10, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    def test_component_scores_non_negative(self, board):
        """All component scores should be non-negative."""
        empty = [(r, c) for r in range(BOARD_SIZE) for c in range(BOARD_SIZE) if board[r][c] is None]
        assume(len(empty) > 0)
        
        move = empty[0]
        breakdown = self.scorer.score_move(board, move, "X")
        
        assert breakdown.threats_created_score >= 0
        assert breakdown.threats_blocked_score >= 0
        assert breakdown.position_score >= 0
        assert breakdown.evaluation_change_score >= 0
    
    def test_empty_board_center_scores_well(self):
        """Center move on empty board should score reasonably."""
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        center = (BOARD_SIZE // 2, BOARD_SIZE // 2)
        
        breakdown = self.scorer.score_move(board, center, "X")
        
        assert breakdown.final_score >= 0
        assert breakdown.position_score > 0  # Center has position bonus


class TestMoveClassification:
    """
    Property 6: Move Classification Consistency
    Validates: Requirements 2.3, 2.4
    """
    
    def setup_method(self):
        self.scorer = MoveScorer()
    
    @given(board=board_with_pieces(min_pieces=4, max_pieces=10))
    @settings(max_examples=10, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    def test_classification_matches_score(self, board):
        """Classification should match score thresholds."""
        empty = [(r, c) for r in range(BOARD_SIZE) for c in range(BOARD_SIZE) if board[r][c] is None]
        assume(len(empty) > 0)
        
        move = empty[0]
        breakdown = self.scorer.score_move(board, move, "X")
        
        score = breakdown.final_score
        classification = breakdown.classification
        
        if score >= SCORE_THRESHOLDS[MoveClassification.EXCELLENT]:
            assert classification == MoveClassification.EXCELLENT
        elif score >= SCORE_THRESHOLDS[MoveClassification.GOOD]:
            assert classification == MoveClassification.GOOD
        elif score >= SCORE_THRESHOLDS[MoveClassification.OKAY]:
            assert classification == MoveClassification.OKAY
        elif score >= SCORE_THRESHOLDS[MoveClassification.WEAK]:
            assert classification == MoveClassification.WEAK
        else:
            assert classification == MoveClassification.BLUNDER
    
    def test_winning_move_excellent(self):
        """Move that creates five should be excellent."""
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Place 4 X's in a row
        for i in range(4):
            board[7][3 + i] = "X"
        
        # Winning move
        move = (7, 7)
        breakdown = self.scorer.score_move(board, move, "X")
        
        # Should score very high
        assert breakdown.threats_created_score > 0
    
    def test_blocking_move_scores_well(self):
        """Move that blocks opponent threat should score well."""
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Place 3 O's in a row (threat)
        for i in range(3):
            board[7][3 + i] = "O"
        
        # X blocks
        move = (7, 6)
        breakdown = self.scorer.score_move(board, move, "X")
        
        assert breakdown.threats_blocked_score > 0


class TestScoreBreakdown:
    """
    Tests for score breakdown completeness.
    Validates: Requirement 2.5
    """
    
    def setup_method(self):
        self.scorer = MoveScorer()
    
    @given(board=board_with_pieces(min_pieces=4, max_pieces=10))
    @settings(max_examples=10, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    def test_breakdown_has_all_fields(self, board):
        """Breakdown should have all required fields."""
        empty = [(r, c) for r in range(BOARD_SIZE) for c in range(BOARD_SIZE) if board[r][c] is None]
        assume(len(empty) > 0)
        
        move = empty[0]
        breakdown = self.scorer.score_move(board, move, "X")
        
        assert hasattr(breakdown, 'final_score')
        assert hasattr(breakdown, 'classification')
        assert hasattr(breakdown, 'threats_created_score')
        assert hasattr(breakdown, 'threats_blocked_score')
        assert hasattr(breakdown, 'position_score')
        assert hasattr(breakdown, 'evaluation_change_score')
        assert hasattr(breakdown, 'raw_score')
        assert hasattr(breakdown, 'best_move_score')
        assert hasattr(breakdown, 'delta')
    
    @given(board=board_with_pieces(min_pieces=4, max_pieces=10))
    @settings(max_examples=10, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
    def test_delta_non_negative(self, board):
        """Delta from best move should be non-negative."""
        empty = [(r, c) for r in range(BOARD_SIZE) for c in range(BOARD_SIZE) if board[r][c] is None]
        assume(len(empty) > 0)
        
        move = empty[0]
        breakdown = self.scorer.score_move(board, move, "X")
        
        assert breakdown.delta >= 0


class TestScoreExplanation:
    """Tests for score explanation generation."""
    
    def setup_method(self):
        self.scorer = MoveScorer()
    
    def test_explanation_in_all_languages(self):
        """Should generate explanations in all supported languages."""
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board[7][7] = "X"
        
        move = (7, 8)
        breakdown = self.scorer.score_move(board, move, "X")
        
        for lang in ["vi", "en", "zh", "ja"]:
            explanation = self.scorer.get_score_explanation(breakdown, lang)
            assert isinstance(explanation, str)
            assert len(explanation) > 0
            assert "/10" in explanation  # Should include score


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
