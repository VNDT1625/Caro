# -*- coding: utf-8 -*-
"""
Property-Based Tests for PositionEvaluator

**Feature: ai-match-analysis-system, Property 2: Position Evaluation Consistency**
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
"""

import sys
import os
import math

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional
import pytest

from analysis.position_evaluator import PositionEvaluator
from analysis.types import MoveClassification, BOARD_SIZE


@st.composite
def board_with_pieces(draw, min_pieces=0, max_pieces=15):
    """Generate a valid board state with random pieces."""
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    pieces = []
    num_pieces = draw(st.integers(min_value=min_pieces, max_value=max_pieces))
    positions = draw(st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=BOARD_SIZE - 1),
            st.integers(min_value=0, max_value=BOARD_SIZE - 1)
        ),
        min_size=num_pieces,
        max_size=num_pieces,
        unique=True
    ))
    for i, (x, y) in enumerate(positions):
        player = "X" if i % 2 == 0 else "O"
        board[x][y] = player
        pieces.append((x, y, player))
    return board, pieces


@st.composite
def board_with_empty_cell(draw, min_pieces=1, max_pieces=10):
    """Generate a board with at least one empty cell."""
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    num_pieces = draw(st.integers(min_value=min_pieces, max_value=max_pieces))
    positions = draw(st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=BOARD_SIZE - 1),
            st.integers(min_value=0, max_value=BOARD_SIZE - 1)
        ),
        min_size=num_pieces,
        max_size=num_pieces,
        unique=True
    ))
    for i, (x, y) in enumerate(positions):
        player = "X" if i % 2 == 0 else "O"
        board[x][y] = player
    empty_cells = [(x, y) for x in range(BOARD_SIZE) for y in range(BOARD_SIZE) if board[x][y] is None]
    assume(len(empty_cells) > 0)
    empty_cell = draw(st.sampled_from(empty_cells))
    return board, empty_cell



class TestPositionEvaluatorProperties:
    """
    Property-based tests for PositionEvaluator.
    
    **Feature: ai-match-analysis-system, Property 2: Position Evaluation Consistency**
    **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
    """
    
    def setup_method(self):
        self.evaluator = PositionEvaluator()
    
    @given(board_data=board_with_pieces(min_pieces=0, max_pieces=15))
    @settings(max_examples=50)
    def test_evaluate_position_returns_scores(self, board_data):
        """Property: Return scores for both players."""
        board, pieces = board_data
        result_x = self.evaluator.evaluate_position(board, "X")
        result_o = self.evaluator.evaluate_position(board, "O")
        assert result_x is not None
        assert result_o is not None
        assert isinstance(result_x.score, (int, float))
        assert isinstance(result_o.score, (int, float))
    
    @given(score=st.floats(min_value=-100000, max_value=100000, allow_nan=False, allow_infinity=False))
    @settings(max_examples=50)
    def test_win_probability_in_valid_range(self, score):
        """Property: Win probability in range [0, 1]."""
        prob = self.evaluator.calculate_win_probability(score)
        assert 0 <= prob <= 1
    
    @given(board_data=board_with_pieces(min_pieces=0, max_pieces=15))
    @settings(max_examples=50)
    def test_evaluation_win_probability_in_range(self, board_data):
        """Property: EvaluationResult win_probability in [0, 1]."""
        board, pieces = board_data
        for player in ["X", "O"]:
            result = self.evaluator.evaluate_position(board, player)
            assert 0 <= result.win_probability <= 1
    
    @given(
        actual_pct=st.floats(min_value=0, max_value=200, allow_nan=False, allow_infinity=False),
        best_score=st.floats(min_value=1, max_value=10000, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=50)
    def test_classify_move_thresholds(self, actual_pct, best_score):
        """Property: Move classification follows thresholds."""
        actual_score = (actual_pct / 100) * best_score
        classification = self.evaluator.classify_move(actual_score, best_score)
        assert isinstance(classification, MoveClassification)
        percentage = (actual_score / best_score) * 100
        if percentage >= 85:
            assert classification == MoveClassification.EXCELLENT
        elif percentage >= 70:
            assert classification == MoveClassification.GOOD
        elif percentage >= 50:
            assert classification == MoveClassification.OKAY
        elif percentage >= 30:
            assert classification == MoveClassification.WEAK
        else:
            assert classification == MoveClassification.BLUNDER
    
    @given(
        x=st.integers(min_value=0, max_value=BOARD_SIZE - 1),
        y=st.integers(min_value=0, max_value=BOARD_SIZE - 1)
    )
    @settings(max_examples=50)
    def test_position_bonus_non_negative(self, x, y):
        """Property: Position bonus is non-negative."""
        bonus = self.evaluator.position_bonus(x, y)
        assert bonus >= 0
    
    def test_position_bonus_center_higher_than_corner(self):
        """Property: center > edge > corner."""
        center = BOARD_SIZE // 2
        center_bonus = self.evaluator.position_bonus(center, center)
        corner_bonus = self.evaluator.position_bonus(0, 0)
        edge_bonus = self.evaluator.position_bonus(center, 0)
        assert center_bonus > edge_bonus
        assert edge_bonus > corner_bonus
    
    def test_sigmoid_monotonicity(self):
        """Property: Win probability increases with score."""
        scores = [-10000, -1000, -100, 0, 100, 1000, 10000]
        probs = [self.evaluator.calculate_win_probability(s) for s in scores]
        for i in range(len(probs) - 1):
            assert probs[i] <= probs[i + 1]
    
    def test_sigmoid_symmetry(self):
        """Property: Sigmoid symmetric around 0.5."""
        for score in [100, 500, 1000, 5000]:
            prob_pos = self.evaluator.calculate_win_probability(score)
            prob_neg = self.evaluator.calculate_win_probability(-score)
            assert abs((prob_pos + prob_neg) - 1.0) < 0.001
    
    def test_empty_board_evaluation(self):
        """Edge case: Empty board has zero score and 0.5 win probability."""
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        for player in ["X", "O"]:
            result = self.evaluator.evaluate_position(board, player)
            assert result.score == 0
            assert abs(result.win_probability - 0.5) < 0.01


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
