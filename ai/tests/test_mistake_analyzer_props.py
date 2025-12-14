"""
Property-based tests for Mistake Analyzer.

**Feature: ai-match-analysis-system, Property: Mistakes correctly categorized**
- Tactical mistakes: missed threats (offensive or defensive)
- Positional mistakes: poor position choice
- Strategic mistakes: wrong direction/plan
- Tempo mistakes: lost initiative

Task 8.6.1: Detailed Mistake Categorization
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.mistake_analyzer import (
    MistakeAnalyzer,
    MistakeCategory,
    CategorizedMistake,
    categorize_mistake,
    analyze_mistakes,
    get_category_label,
    get_category_description,
    MISTAKE_CATEGORY_LABELS,
    MISTAKE_CATEGORY_DESCRIPTIONS,
)
from analysis.types import Move, Mistake, BOARD_SIZE


# Strategies for generating test data
board_size = 15
position_st = st.tuples(st.integers(0, board_size - 1), st.integers(0, board_size - 1))
player_st = st.sampled_from(['X', 'O'])


def create_empty_board(size: int = 15) -> List[List[Optional[str]]]:
    """Create an empty board."""
    return [[None for _ in range(size)] for _ in range(size)]


def create_board_from_moves(
    moves: List[Tuple[int, int, str]], 
    size: int = 15
) -> List[List[Optional[str]]]:
    """Create a board from a list of moves."""
    board = create_empty_board(size)
    for x, y, piece in moves:
        if 0 <= x < size and 0 <= y < size:
            board[x][y] = piece
    return board


class TestMistakeCategoryProperties:
    """Property tests for mistake categorization."""
    
    def test_tactical_mistake_missed_open_four(self):
        """
        **Feature: ai-match-analysis-system, Property: Tactical mistake - missed OPEN_FOUR**
        Missing an OPEN_FOUR opportunity should be categorized as tactical.
        """
        board = create_empty_board()
        # Create position where X can make OPEN_FOUR at (7, 4)
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        # Best move is (7, 4) or (7, 8) to create OPEN_FOUR
        
        actual_move = Move(x=0, y=0, player='X', move_number=1)  # Wrong move
        best_move = (7, 4)  # Creates OPEN_FOUR
        
        analyzer = MistakeAnalyzer()
        result = analyzer.categorize_mistake(
            board, actual_move, best_move, 
            actual_score=10.0, best_score=10000.0
        )
        
        assert result.category == MistakeCategory.TACTICAL
        assert result.severity == "critical"
        assert "Tứ" in result.explanation or "tấn công" in result.explanation.lower()
    
    def test_tactical_mistake_failed_to_block(self):
        """
        **Feature: ai-match-analysis-system, Property: Tactical mistake - failed to block**
        Failing to block opponent's FOUR should be categorized as tactical.
        """
        board = create_empty_board()
        # O has FOUR that needs blocking
        board[7][5] = 'O'
        board[7][6] = 'O'
        board[7][7] = 'O'
        board[7][8] = 'O'
        # X must block at (7, 4) or (7, 9)
        
        actual_move = Move(x=0, y=0, player='X', move_number=1)  # Wrong move
        best_move = (7, 4)  # Blocks the FOUR
        
        analyzer = MistakeAnalyzer()
        result = analyzer.categorize_mistake(
            board, actual_move, best_move,
            actual_score=10.0, best_score=1000.0
        )
        
        assert result.category == MistakeCategory.TACTICAL
        assert "chặn" in result.explanation.lower() or "đối thủ" in result.explanation.lower()
    
    def test_positional_mistake_edge_vs_center(self):
        """
        **Feature: ai-match-analysis-system, Property: Positional mistake - edge vs center**
        Playing on edge when center is better should be positional mistake.
        """
        board = create_empty_board()
        # Early game, center is better
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        actual_move = Move(x=0, y=0, player='X', move_number=3)  # Corner
        best_move = (7, 8)  # Near center
        
        analyzer = MistakeAnalyzer()
        result = analyzer.categorize_mistake(
            board, actual_move, best_move,
            actual_score=5.0, best_score=50.0
        )
        
        # Should be positional (far from center)
        assert result.category == MistakeCategory.POSITIONAL
        assert "trung tâm" in result.explanation.lower() or "vị trí" in result.explanation.lower()
    
    def test_positional_mistake_isolated_piece(self):
        """
        **Feature: ai-match-analysis-system, Property: Positional mistake - isolated piece**
        Playing an isolated piece should be positional mistake.
        """
        board = create_empty_board()
        # Pieces clustered in center
        board[7][7] = 'X'
        board[7][8] = 'O'
        board[8][7] = 'X'
        board[8][8] = 'O'
        
        actual_move = Move(x=0, y=14, player='X', move_number=5)  # Far corner, isolated
        best_move = (6, 7)  # Connected to existing pieces
        
        analyzer = MistakeAnalyzer()
        result = analyzer.categorize_mistake(
            board, actual_move, best_move,
            actual_score=2.0, best_score=30.0
        )
        
        # Should be positional (isolated)
        assert result.category == MistakeCategory.POSITIONAL
    
    def test_tempo_mistake_passive_move(self):
        """
        **Feature: ai-match-analysis-system, Property: Tempo mistake - passive move**
        Making a passive move when active play is needed should be tempo mistake.
        """
        board = create_empty_board()
        # X has developing threats
        board[7][7] = 'X'
        board[7][8] = 'X'
        board[8][7] = 'O'
        
        # Best move creates OPEN_THREE, actual move is passive
        actual_move = Move(x=5, y=5, player='X', move_number=3)  # Passive
        best_move = (7, 9)  # Creates OPEN_THREE
        
        analyzer = MistakeAnalyzer()
        result = analyzer.categorize_mistake(
            board, actual_move, best_move,
            actual_score=15.0, best_score=500.0
        )
        
        # Could be tactical or tempo depending on analysis
        assert result.category in [MistakeCategory.TACTICAL, MistakeCategory.TEMPO]
    
    def test_strategic_mistake_wrong_direction(self):
        """
        **Feature: ai-match-analysis-system, Property: Strategic mistake - wrong direction**
        Building in wrong area should be strategic mistake.
        """
        board = create_empty_board()
        # X has development in one area
        board[7][7] = 'X'
        board[7][8] = 'X'
        board[8][8] = 'O'
        
        # Actual move develops in opposite direction
        actual_move = Move(x=2, y=2, player='X', move_number=3)  # Wrong area
        best_move = (7, 6)  # Continues development
        
        analyzer = MistakeAnalyzer()
        result = analyzer.categorize_mistake(
            board, actual_move, best_move,
            actual_score=10.0, best_score=100.0
        )
        
        # Should be strategic or positional
        assert result.category in [MistakeCategory.STRATEGIC, MistakeCategory.POSITIONAL]


class TestCategorizedMistakeStructure:
    """Tests for CategorizedMistake structure."""
    
    def test_categorized_mistake_has_all_fields(self):
        """
        **Feature: ai-match-analysis-system, Property: CategorizedMistake structure**
        CategorizedMistake should have all required fields.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        actual_move = Move(x=0, y=0, player='X', move_number=1)
        best_move = (7, 8)
        
        analyzer = MistakeAnalyzer()
        result = analyzer.categorize_mistake(
            board, actual_move, best_move,
            actual_score=5.0, best_score=50.0
        )
        
        # Check all fields exist
        assert hasattr(result, 'move')
        assert hasattr(result, 'player')
        assert hasattr(result, 'position')
        assert hasattr(result, 'category')
        assert hasattr(result, 'severity')
        assert hasattr(result, 'description')
        assert hasattr(result, 'explanation')
        assert hasattr(result, 'best_alternative')
        assert hasattr(result, 'best_alternative_reason')
        assert hasattr(result, 'score_loss')
        assert hasattr(result, 'educational_tip')
        
        # Check types
        assert isinstance(result.move, int)
        assert isinstance(result.player, str)
        assert isinstance(result.position, tuple)
        assert isinstance(result.category, MistakeCategory)
        assert isinstance(result.severity, str)
        assert isinstance(result.description, str)
        assert isinstance(result.explanation, str)
        assert isinstance(result.best_alternative, tuple)
        assert isinstance(result.best_alternative_reason, str)
        assert isinstance(result.score_loss, float)
        assert isinstance(result.educational_tip, str)
    
    def test_severity_levels(self):
        """
        **Feature: ai-match-analysis-system, Property: Severity levels**
        Severity should be one of: critical, major, minor.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        analyzer = MistakeAnalyzer()
        
        # Test different score losses
        test_cases = [
            (5.0, 10000.0, "critical"),  # Huge loss
            (5.0, 500.0, "major"),        # Significant loss
            (5.0, 50.0, "minor"),         # Small loss
        ]
        
        for actual_score, best_score, expected_severity in test_cases:
            actual_move = Move(x=0, y=0, player='X', move_number=1)
            result = analyzer.categorize_mistake(
                board, actual_move, (7, 8),
                actual_score=actual_score, best_score=best_score
            )
            
            assert result.severity in ["critical", "major", "minor"]
    
    def test_description_in_vietnamese(self):
        """
        **Feature: ai-match-analysis-system, Property: Description in Vietnamese**
        Description should be in Vietnamese.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        actual_move = Move(x=0, y=0, player='X', move_number=1)
        
        analyzer = MistakeAnalyzer()
        result = analyzer.categorize_mistake(
            board, actual_move, (7, 8),
            actual_score=5.0, best_score=100.0
        )
        
        # Check for Vietnamese keywords
        vietnamese_keywords = ['Sai lầm', 'chiến thuật', 'vị trí', 'chiến lược', 'nhịp', 'nghiêm trọng', 'lớn', 'nhỏ']
        has_vietnamese = any(kw in result.description for kw in vietnamese_keywords)
        assert has_vietnamese, f"Description should be in Vietnamese: {result.description}"
    
    def test_explanation_in_vietnamese(self):
        """
        **Feature: ai-match-analysis-system, Property: Explanation in Vietnamese**
        Explanation should be in Vietnamese.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        actual_move = Move(x=0, y=0, player='X', move_number=1)
        
        analyzer = MistakeAnalyzer()
        result = analyzer.categorize_mistake(
            board, actual_move, (7, 8),
            actual_score=5.0, best_score=100.0
        )
        
        # Check for Vietnamese keywords
        vietnamese_keywords = ['Nước đi', 'đối thủ', 'chặn', 'tạo', 'vị trí', 'trung tâm', 'phát triển', 'áp lực']
        has_vietnamese = any(kw in result.explanation for kw in vietnamese_keywords)
        assert has_vietnamese, f"Explanation should be in Vietnamese: {result.explanation}"
    
    def test_educational_tip_in_vietnamese(self):
        """
        **Feature: ai-match-analysis-system, Property: Educational tip in Vietnamese**
        Educational tip should be in Vietnamese.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        actual_move = Move(x=0, y=0, player='X', move_number=1)
        
        analyzer = MistakeAnalyzer()
        result = analyzer.categorize_mistake(
            board, actual_move, (7, 8),
            actual_score=5.0, best_score=100.0
        )
        
        # Check for Vietnamese keywords
        assert "Mẹo" in result.educational_tip or "mẹo" in result.educational_tip.lower()
        assert len(result.educational_tip) > 20  # Should be substantial


class TestAnalyzeMistakes:
    """Tests for analyze_mistakes function."""
    
    def test_analyze_empty_game(self):
        """
        **Feature: ai-match-analysis-system, Property: Empty game analysis**
        Empty game should return empty list.
        """
        moves = []
        mistakes = []
        
        result = analyze_mistakes(moves, mistakes)
        
        assert result == []
    
    def test_analyze_game_with_no_mistakes(self):
        """
        **Feature: ai-match-analysis-system, Property: Game with no mistakes**
        Game with no mistakes should return empty list.
        """
        moves = [
            Move(x=7, y=7, player='X'),
            Move(x=8, y=8, player='O'),
            Move(x=7, y=8, player='X'),
        ]
        mistakes = []  # No mistakes
        
        result = analyze_mistakes(moves, mistakes)
        
        assert result == []
    
    def test_analyze_game_with_mistakes(self):
        """
        **Feature: ai-match-analysis-system, Property: Game with mistakes**
        Game with mistakes should return categorized mistakes.
        """
        moves = [
            Move(x=7, y=7, player='X'),
            Move(x=8, y=8, player='O'),
            Move(x=0, y=0, player='X'),  # Bad move
        ]
        mistakes = [
            Mistake(
                move=3,
                severity="minor",
                desc="Nước đi yếu",
                best_alternative={"x": 7, "y": 8}
            )
        ]
        
        result = analyze_mistakes(moves, mistakes)
        
        assert len(result) == 1
        assert isinstance(result[0], CategorizedMistake)
        assert result[0].move == 3
        assert result[0].player == 'X'


class TestCategoryStatistics:
    """Tests for category statistics."""
    
    def test_get_category_statistics(self):
        """
        **Feature: ai-match-analysis-system, Property: Category statistics**
        Statistics should be calculated correctly.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        analyzer = MistakeAnalyzer()
        
        # Create some categorized mistakes
        mistakes = []
        for i in range(3):
            actual_move = Move(x=i, y=i, player='X', move_number=i+1)
            result = analyzer.categorize_mistake(
                board, actual_move, (7, 8),
                actual_score=5.0, best_score=100.0
            )
            mistakes.append(result)
        
        stats = analyzer.get_category_statistics(mistakes)
        
        # Check structure
        for category in MistakeCategory:
            assert category in stats
            assert "count" in stats[category]
            assert "total_score_loss" in stats[category]
            assert "avg_score_loss" in stats[category]
            assert "severity_counts" in stats[category]
            assert "label" in stats[category]
            assert "description" in stats[category]


class TestConvenienceFunctions:
    """Tests for convenience functions."""
    
    def test_categorize_mistake_function(self):
        """
        **Feature: ai-match-analysis-system, Property: categorize_mistake function**
        Convenience function should work correctly.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        actual_move = Move(x=0, y=0, player='X', move_number=1)
        
        result = categorize_mistake(
            board, actual_move, (7, 8),
            actual_score=5.0, best_score=100.0
        )
        
        assert isinstance(result, CategorizedMistake)
    
    def test_get_category_label_function(self):
        """
        **Feature: ai-match-analysis-system, Property: get_category_label function**
        Should return Vietnamese labels.
        """
        for category in MistakeCategory:
            label = get_category_label(category)
            assert isinstance(label, str)
            assert len(label) > 0
            assert label == MISTAKE_CATEGORY_LABELS[category]
    
    def test_get_category_description_function(self):
        """
        **Feature: ai-match-analysis-system, Property: get_category_description function**
        Should return Vietnamese descriptions.
        """
        for category in MistakeCategory:
            desc = get_category_description(category)
            assert isinstance(desc, str)
            assert len(desc) > 0
            assert desc == MISTAKE_CATEGORY_DESCRIPTIONS[category]


class TestPropertyBasedMistakeAnalysis:
    """Property-based tests using Hypothesis."""
    
    @given(
        position_st,
        position_st,
        player_st,
        st.floats(min_value=0, max_value=100),
        st.floats(min_value=100, max_value=10000)
    )
    @settings(max_examples=50, deadline=None)
    def test_categorization_always_returns_valid_category(
        self,
        actual_pos: Tuple[int, int],
        best_pos: Tuple[int, int],
        player: str,
        actual_score: float,
        best_score: float
    ):
        """
        **Feature: ai-match-analysis-system, Property: Valid category always returned**
        Categorization should always return a valid MistakeCategory.
        """
        assume(actual_pos != best_pos)  # Must be different positions
        
        board = create_empty_board()
        actual_move = Move(x=actual_pos[0], y=actual_pos[1], player=player, move_number=1)
        
        analyzer = MistakeAnalyzer()
        result = analyzer.categorize_mistake(
            board, actual_move, best_pos,
            actual_score=actual_score, best_score=best_score
        )
        
        assert result.category in MistakeCategory
        assert result.severity in ["critical", "major", "minor"]
    
    @given(
        st.floats(min_value=0, max_value=100),
        st.floats(min_value=100, max_value=100000)
    )
    @settings(max_examples=50)
    def test_score_loss_calculated_correctly(
        self,
        actual_score: float,
        best_score: float
    ):
        """
        **Feature: ai-match-analysis-system, Property: Score loss calculation**
        Score loss should be best_score - actual_score.
        """
        board = create_empty_board()
        actual_move = Move(x=0, y=0, player='X', move_number=1)
        
        analyzer = MistakeAnalyzer()
        result = analyzer.categorize_mistake(
            board, actual_move, (7, 7),
            actual_score=actual_score, best_score=best_score
        )
        
        expected_loss = best_score - actual_score
        assert abs(result.score_loss - expected_loss) < 0.001
    
    @given(player_st)
    @settings(max_examples=10)
    def test_player_preserved_in_result(self, player: str):
        """
        **Feature: ai-match-analysis-system, Property: Player preserved**
        Player should be preserved in the result.
        """
        board = create_empty_board()
        actual_move = Move(x=0, y=0, player=player, move_number=1)
        
        analyzer = MistakeAnalyzer()
        result = analyzer.categorize_mistake(
            board, actual_move, (7, 7),
            actual_score=5.0, best_score=100.0
        )
        
        assert result.player == player
    
    @given(st.integers(min_value=1, max_value=225))
    @settings(max_examples=20)
    def test_move_number_preserved_in_result(self, move_number: int):
        """
        **Feature: ai-match-analysis-system, Property: Move number preserved**
        Move number should be preserved in the result.
        """
        board = create_empty_board()
        actual_move = Move(x=0, y=0, player='X', move_number=move_number)
        
        analyzer = MistakeAnalyzer()
        result = analyzer.categorize_mistake(
            board, actual_move, (7, 7),
            actual_score=5.0, best_score=100.0
        )
        
        assert result.move == move_number


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
