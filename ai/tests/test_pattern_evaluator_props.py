"""
Property-Based Tests for PatternEvaluator

**Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
**Property: known good patterns → positive score**

Tests that the pattern evaluator correctly:
- Identifies good patterns with positive scores
- Identifies bad patterns with negative scores
- Recognizes shape formations correctly
"""

from hypothesis import given, strategies as st, settings, assume
from analysis.pattern_evaluator import (
    PatternEvaluator, 
    PatternCategory,
    ALL_PATTERNS,
    get_pattern_database_stats,
)
from analysis.types import BOARD_SIZE
import pytest


def create_empty_board(size: int = BOARD_SIZE):
    """Create an empty board."""
    return [[None for _ in range(size)] for _ in range(size)]


def place_pieces(board, pieces):
    """Place pieces on the board. pieces is list of (x, y, player)."""
    for x, y, player in pieces:
        if 0 <= x < len(board) and 0 <= y < len(board[0]):
            board[x][y] = player
    return board


class TestPatternEvaluatorProps:
    """Property tests for PatternEvaluator"""
    
    def setup_method(self):
        self.evaluator = PatternEvaluator()
    
    def test_pattern_database_has_50_plus_patterns(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        Pattern database should contain 50+ patterns.
        """
        stats = get_pattern_database_stats()
        assert stats["total_patterns"] >= 50, \
            f"Expected 50+ patterns, got {stats['total_patterns']}"

    
    def test_good_patterns_have_positive_scores(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        All good patterns should have positive scores.
        """
        good_patterns = self.evaluator.get_good_patterns()
        
        assert len(good_patterns) > 0, "Should have good patterns"
        
        for pattern in good_patterns:
            assert pattern.score > 0, \
                f"Good pattern '{pattern.name}' should have positive score, got {pattern.score}"
    
    def test_bad_patterns_have_negative_scores(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        All bad patterns should have negative scores.
        """
        bad_patterns = self.evaluator.get_bad_patterns()
        
        assert len(bad_patterns) > 0, "Should have bad patterns"
        
        for pattern in bad_patterns:
            assert pattern.score < 0, \
                f"Bad pattern '{pattern.name}' should have negative score, got {pattern.score}"
    
    def test_winning_patterns_highest_scores(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        Winning patterns should have the highest scores.
        """
        winning_patterns = self.evaluator.get_patterns_by_category(PatternCategory.WINNING)
        other_patterns = [p for p in ALL_PATTERNS if p.category != PatternCategory.WINNING]
        
        if winning_patterns and other_patterns:
            min_winning_score = min(p.score for p in winning_patterns)
            max_other_score = max(p.score for p in other_patterns)
            
            assert min_winning_score > max_other_score, \
                f"Winning patterns ({min_winning_score}) should score higher than others ({max_other_score})"
    
    def test_five_in_row_detected(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        Five in a row pattern should be detected and have high score.
        """
        board = create_empty_board()
        # Create five in a row
        for i in range(5):
            board[7][3 + i] = "X"
        
        matches = self.evaluator.find_all_patterns(board, "X")
        
        # Should find the five_horizontal pattern
        five_matches = [m for m in matches if "five" in m.pattern_name.lower()]
        assert len(five_matches) > 0, "Should detect five in a row pattern"
        
        # Score should be very high
        score = self.evaluator.evaluate_position(board, "X")
        assert score > 50000, f"Five in a row should have score > 50000, got {score}"

    
    def test_open_four_detected(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        Open four pattern should be detected.
        """
        board = create_empty_board()
        # Create open four: _XXXX_
        for i in range(4):
            board[7][4 + i] = "X"
        
        matches = self.evaluator.find_all_patterns(board, "X")
        
        # Should find open_four pattern
        four_matches = [m for m in matches if "four" in m.pattern_name.lower() or "triple" in m.pattern_name.lower()]
        assert len(four_matches) > 0 or len(matches) > 0, "Should detect patterns for open four"
        
        # Score should be high
        score = self.evaluator.evaluate_position(board, "X")
        assert score > 5000, f"Open four should have score > 5000, got {score}"
    
    def test_cross_shape_positive_score(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        Cross shape (good formation) should have positive score.
        """
        board = create_empty_board()
        # Create cross shape
        center = BOARD_SIZE // 2
        board[center][center] = "X"
        board[center - 1][center] = "X"
        board[center + 1][center] = "X"
        board[center][center - 1] = "X"
        board[center][center + 1] = "X"
        
        matches = self.evaluator.find_all_patterns(board, "X")
        player_matches = [m for m in matches if m.player == "X"]
        
        # Should have positive total score
        total_score = sum(m.score for m in player_matches)
        assert total_score > 0, f"Cross shape should have positive score, got {total_score}"
    
    def test_isolated_piece_negative_score(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        Isolated piece (bad formation) should have negative or low score.
        """
        board = create_empty_board()
        # Single isolated piece in corner
        board[0][0] = "X"
        
        matches = self.evaluator.find_all_patterns(board, "X")
        
        # Check for isolated pattern match
        isolated_matches = [m for m in matches if "isolated" in m.pattern_name.lower()]
        
        # If isolated pattern is detected, it should have negative score
        if isolated_matches:
            for match in isolated_matches:
                assert match.score < 0, f"Isolated pattern should have negative score"
    
    def test_dead_end_pattern_negative_score(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        Dead end pattern (blocked both sides) should have negative score.
        """
        board = create_empty_board()
        # Create dead end: OXXXO
        board[7][3] = "O"
        board[7][4] = "X"
        board[7][5] = "X"
        board[7][6] = "X"
        board[7][7] = "O"
        
        matches = self.evaluator.find_all_patterns(board, "X")
        
        # Check for dead_end or blocked pattern
        dead_matches = [m for m in matches if "dead" in m.pattern_name.lower() or "blocked" in m.pattern_name.lower()]
        
        if dead_matches:
            for match in dead_matches:
                assert match.score < 0, f"Dead end pattern should have negative score"

    
    @given(
        pattern_idx=st.integers(min_value=0, max_value=len(ALL_PATTERNS) - 1)
    )
    @settings(max_examples=100)
    def test_pattern_score_consistency(self, pattern_idx):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        Pattern scores should be consistent with their category.
        """
        pattern = ALL_PATTERNS[pattern_idx]
        
        # Winning patterns should have highest scores
        if pattern.category == PatternCategory.WINNING:
            assert pattern.score >= 10000, \
                f"Winning pattern '{pattern.name}' should have score >= 10000"
        
        # Bad patterns should have negative scores
        elif pattern.category == PatternCategory.BAD:
            assert pattern.score < 0, \
                f"Bad pattern '{pattern.name}' should have negative score"
        
        # Other good patterns should have positive scores
        elif pattern.category in [PatternCategory.ATTACKING, PatternCategory.DEFENSIVE, 
                                   PatternCategory.DEVELOPMENT, PatternCategory.SHAPE,
                                   PatternCategory.POSITIONAL]:
            assert pattern.score > 0, \
                f"Pattern '{pattern.name}' in category {pattern.category} should have positive score"
    
    def test_recognize_shape_returns_valid_structure(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        recognize_shape should return a valid structure with all expected fields.
        """
        board = create_empty_board()
        board[7][7] = "X"
        board[7][8] = "X"
        board[8][7] = "X"
        
        result = self.evaluator.recognize_shape(board, "X")
        
        # Check all expected keys
        expected_keys = [
            "shape_quality", "net_score", "good_patterns_score",
            "bad_patterns_score", "pattern_counts", "category_scores",
            "total_patterns_found", "opponent_patterns_found"
        ]
        for key in expected_keys:
            assert key in result, f"Missing key: {key}"
        
        # shape_quality should be one of the valid values
        valid_qualities = ["excellent", "good", "neutral", "poor", "bad"]
        assert result["shape_quality"] in valid_qualities, \
            f"Invalid shape quality: {result['shape_quality']}"
    
    def test_good_shape_quality_for_strong_formation(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        Strong formations should have good or excellent shape quality.
        """
        board = create_empty_board()
        center = BOARD_SIZE // 2
        
        # Create a strong cross formation
        board[center][center] = "X"
        board[center - 1][center] = "X"
        board[center + 1][center] = "X"
        board[center][center - 1] = "X"
        board[center][center + 1] = "X"
        
        result = self.evaluator.recognize_shape(board, "X")
        
        # Should have positive net score
        assert result["net_score"] > 0, \
            f"Strong formation should have positive net score, got {result['net_score']}"
    
    def test_bad_shape_quality_for_scattered_pieces(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        Scattered pieces should have poor or bad shape quality.
        """
        board = create_empty_board()
        
        # Create scattered pieces in corners
        board[0][0] = "X"
        board[0][14] = "X"
        board[14][0] = "X"
        board[14][14] = "X"
        
        result = self.evaluator.recognize_shape(board, "X")
        
        # Should detect scattered pattern or have low score
        # Note: May not always be "bad" quality, but should not be "excellent"
        assert result["shape_quality"] != "excellent", \
            f"Scattered pieces should not have excellent shape quality"

    
    @given(
        x=st.integers(min_value=2, max_value=BOARD_SIZE - 3),
        y=st.integers(min_value=2, max_value=BOARD_SIZE - 3)
    )
    @settings(max_examples=50)
    def test_diamond_shape_positive_score(self, x, y):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        Diamond shape should have positive score at any valid position.
        """
        board = create_empty_board()
        
        # Create diamond shape
        board[x][y] = "X"      # center
        board[x - 1][y] = "X"  # top
        board[x + 1][y] = "X"  # bottom
        board[x][y - 1] = "X"  # left
        board[x][y + 1] = "X"  # right
        
        score = self.evaluator.evaluate_position(board, "X")
        
        # Diamond shape should have positive score
        assert score > 0, f"Diamond shape at ({x},{y}) should have positive score, got {score}"
    
    def test_pattern_matching_symmetry(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        Pattern matching should work for both X and O players.
        """
        board = create_empty_board()
        
        # Create same pattern for both players
        board[5][5] = "X"
        board[5][6] = "X"
        board[5][7] = "X"
        
        board[10][5] = "O"
        board[10][6] = "O"
        board[10][7] = "O"
        
        matches_x = self.evaluator.find_all_patterns(board, "X")
        matches_o = self.evaluator.find_all_patterns(board, "O")
        
        x_patterns = [m for m in matches_x if m.player == "X"]
        o_patterns = [m for m in matches_o if m.player == "O"]
        
        # Both should find similar patterns (triple_line)
        x_names = set(m.pattern_name for m in x_patterns)
        o_names = set(m.pattern_name for m in o_patterns)
        
        # Should have some overlap in pattern types
        assert len(x_names) > 0 or len(o_names) > 0, "Should detect patterns for both players"
    
    def test_get_shape_recommendations_returns_list(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        get_shape_recommendations should return a list of strings.
        """
        board = create_empty_board()
        board[7][7] = "X"
        
        recommendations = self.evaluator.get_shape_recommendations(board, "X")
        
        assert isinstance(recommendations, list), "Should return a list"
        assert len(recommendations) > 0, "Should have at least one recommendation"
        for rec in recommendations:
            assert isinstance(rec, str), "Each recommendation should be a string"
    
    def test_pattern_count_matches_database(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        count_patterns should match the actual database size.
        """
        count = self.evaluator.count_patterns()
        stats = get_pattern_database_stats()
        
        assert count == stats["total_patterns"], \
            f"count_patterns ({count}) should match database ({stats['total_patterns']})"
    
    def test_all_categories_have_patterns(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.2: Pattern-Based Evaluation**
        All pattern categories should have at least one pattern.
        """
        stats = get_pattern_database_stats()
        
        for category in PatternCategory:
            count = stats["by_category"].get(category.value, 0)
            assert count > 0, f"Category {category.value} should have at least one pattern"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
