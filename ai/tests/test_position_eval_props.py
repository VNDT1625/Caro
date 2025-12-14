"""
Property-Based Tests for PositionEvaluator

**Feature: ai-match-analysis-system, Property 2: Position Evaluation Consistency**
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
"""

from hypothesis import given, strategies as st, settings
from analysis.position_evaluator import PositionEvaluator
from analysis.types import MoveClassification, BOARD_SIZE
import pytest


class TestPositionEvaluatorProps:
    """Property tests for PositionEvaluator"""
    
    def setup_method(self):
        self.evaluator = PositionEvaluator()
    
    @given(score=st.floats(min_value=-100000, max_value=100000, allow_nan=False, allow_infinity=False))
    @settings(max_examples=100)
    def test_win_probability_range(self, score):
        """**Feature: ai-match-analysis-system, Property 2: Position Evaluation Consistency**
        Win probability must be in [0, 1]"""
        prob = self.evaluator.calculate_win_probability(score)
        assert 0 <= prob <= 1, f"Win probability {prob} out of range for score {score}"
    
    @given(
        x=st.integers(min_value=0, max_value=BOARD_SIZE - 1),
        y=st.integers(min_value=0, max_value=BOARD_SIZE - 1)
    )
    @settings(max_examples=100)
    def test_position_bonus_non_negative(self, x, y):
        """**Feature: ai-match-analysis-system, Property 2: Position Evaluation Consistency**
        Position bonus must be non-negative"""
        bonus = self.evaluator.position_bonus(x, y)
        assert bonus >= 0, f"Position bonus {bonus} is negative for ({x}, {y})"
    
    def test_center_bonus_higher_than_corner(self):
        """**Feature: ai-match-analysis-system, Property 2: Position Evaluation Consistency**
        Center positions have higher bonus than corners"""
        center = BOARD_SIZE // 2
        center_bonus = self.evaluator.position_bonus(center, center)
        corner_bonus = self.evaluator.position_bonus(0, 0)
        edge_bonus = self.evaluator.position_bonus(center, 0)
        
        assert center_bonus > edge_bonus, f"Center {center_bonus} not > edge {edge_bonus}"
        assert edge_bonus > corner_bonus, f"Edge {edge_bonus} not > corner {corner_bonus}"
    
    def test_sigmoid_monotonic(self):
        """**Feature: ai-match-analysis-system, Property 2: Position Evaluation Consistency**
        Win probability increases with score"""
        scores = [-10000, -1000, -100, 0, 100, 1000, 10000]
        probs = [self.evaluator.calculate_win_probability(s) for s in scores]
        
        for i in range(len(probs) - 1):
            assert probs[i] <= probs[i + 1], \
                f"Probability not monotonic: {probs[i]} > {probs[i+1]} at scores {scores[i]}, {scores[i+1]}"
    
    @given(
        actual_pct=st.floats(min_value=0, max_value=200, allow_nan=False, allow_infinity=False),
        best_score=st.floats(min_value=1, max_value=10000, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=100)
    def test_classify_move_thresholds(self, actual_pct, best_score):
        """**Feature: ai-match-analysis-system, Property 2: Position Evaluation Consistency**
        Move classification follows defined thresholds"""
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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
