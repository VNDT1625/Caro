"""
Property-based tests for Endgame Analyzer.

**Feature: ai-match-analysis-system, Property: Endgame Detection Accuracy**
- Endgame positions correctly identified
- VCF endgame detected when VCF exists
- Space endgame detected when few empty cells
- Threat endgame detected when many high threats

Task 8.5.1: Endgame Detection
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.endgame_analyzer import (
    EndgameAnalyzer,
    EndgameResult,
    EndgameType,
    detect_endgame,
    is_endgame,
)
from analysis.threat_detector import ThreatDetector
from analysis.vcf_search import find_vcf
from analysis.types import ThreatType, BOARD_SIZE


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


def count_empty_cells(board: List[List[Optional[str]]]) -> int:
    """Count empty cells on the board."""
    count = 0
    for row in board:
        for cell in row:
            if cell is None:
                count += 1
    return count


def fill_board_randomly(
    board: List[List[Optional[str]]], 
    fill_ratio: float
) -> List[List[Optional[str]]]:
    """Fill board to a certain ratio with alternating pieces."""
    import random
    size = len(board)
    total_cells = size * size
    target_filled = int(total_cells * fill_ratio)
    
    empty_positions = []
    for x in range(size):
        for y in range(size):
            if board[x][y] is None:
                empty_positions.append((x, y))
    
    random.shuffle(empty_positions)
    current_player = 'X'
    
    for i, (x, y) in enumerate(empty_positions[:target_filled]):
        board[x][y] = current_player
        current_player = 'O' if current_player == 'X' else 'X'
    
    return board


class TestEndgameDetectionProperties:
    """Property tests for endgame detection."""
    
    def test_empty_board_not_endgame(self):
        """
        **Feature: ai-match-analysis-system, Property: Empty board not endgame**
        An empty board should not be detected as endgame.
        """
        board = create_empty_board()
        
        result = detect_endgame(board)
        
        assert not result.is_endgame, "Empty board should not be endgame"
        assert result.endgame_type == EndgameType.NOT_ENDGAME
        assert result.empty_ratio == 1.0
    
    def test_five_in_row_is_critical_endgame(self):
        """
        **Feature: ai-match-analysis-system, Property: FIVE is critical endgame**
        A board with FIVE in a row should be detected as critical endgame.
        """
        board = create_empty_board()
        # Create FIVE: XXXXX
        for i in range(5):
            board[7][5 + i] = 'X'
        
        result = detect_endgame(board)
        
        assert result.is_endgame, "FIVE should be endgame"
        assert result.endgame_type == EndgameType.CRITICAL_ENDGAME
        assert result.urgency == 100
    
    def test_open_four_is_vcf_endgame(self):
        """
        **Feature: ai-match-analysis-system, Property: OPEN_FOUR triggers VCF endgame**
        A board with OPEN_FOUR should be detected as VCF endgame.
        """
        board = create_empty_board()
        # Create OPEN_FOUR: _XXXX_
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        result = detect_endgame(board, check_vcf=True)
        
        assert result.is_endgame, "OPEN_FOUR should trigger endgame"
        assert result.vcf_player == 'X'
        assert result.urgency >= 90
    
    def test_space_endgame_detection(self):
        """
        **Feature: ai-match-analysis-system, Property: Space endgame detection**
        A board with < 30% empty cells should be detected as space endgame.
        """
        board = create_empty_board()
        size = len(board)
        total_cells = size * size
        
        # Fill more than 70% of the board (leaving < 30% empty)
        fill_board_randomly(board, 0.75)
        
        empty_count = count_empty_cells(board)
        empty_ratio = empty_count / total_cells
        
        # Skip test if we don't have < 30% empty (shouldn't happen with 0.75 fill)
        if empty_ratio >= 0.30:
            pytest.skip(f"Board has {empty_ratio:.1%} empty, need < 30%")
        
        result = detect_endgame(board, check_vcf=False)
        
        assert result.is_endgame, f"Board with {empty_ratio:.1%} empty should be endgame"
        assert result.endgame_type in [
            EndgameType.SPACE_ENDGAME,
            EndgameType.THREAT_ENDGAME,
            EndgameType.CRITICAL_ENDGAME
        ]
    
    def test_threat_endgame_detection(self):
        """
        **Feature: ai-match-analysis-system, Property: Threat endgame detection**
        A board with many high threats should be detected as threat endgame.
        """
        board = create_empty_board()
        
        # Create multiple high threats for X
        # OPEN_THREE 1: _XXX_
        board[5][5] = 'X'
        board[5][6] = 'X'
        board[5][7] = 'X'
        
        # OPEN_THREE 2: _XXX_
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        
        # FOUR: XXXX_
        board[9][5] = 'X'
        board[9][6] = 'X'
        board[9][7] = 'X'
        board[9][8] = 'X'
        
        result = detect_endgame(board, check_vcf=True)
        
        assert result.is_endgame, "Multiple high threats should trigger endgame"
        assert result.high_threat_count >= 3
    
    @given(player_st)
    @settings(max_examples=10)
    def test_vcf_implies_endgame(self, player: str):
        """
        **Feature: ai-match-analysis-system, Property: VCF implies endgame**
        If a player has VCF, the position should be detected as endgame.
        """
        board = create_empty_board()
        
        # Create OPEN_FOUR (guaranteed VCF)
        board[7][5] = player
        board[7][6] = player
        board[7][7] = player
        board[7][8] = player
        
        # Verify VCF exists
        vcf_result = find_vcf(board, player)
        assume(vcf_result.found)
        
        # Endgame should be detected
        result = detect_endgame(board, check_vcf=True)
        
        assert result.is_endgame, "VCF should imply endgame"
        assert result.vcf_player == player
    
    def test_urgency_increases_with_threats(self):
        """
        **Feature: ai-match-analysis-system, Property: Urgency increases with threats**
        More threats should result in higher urgency.
        """
        # Board with few threats
        board1 = create_empty_board()
        board1[7][7] = 'X'
        board1[7][8] = 'X'
        
        # Board with more threats
        board2 = create_empty_board()
        board2[7][5] = 'X'
        board2[7][6] = 'X'
        board2[7][7] = 'X'
        board2[7][8] = 'X'  # OPEN_FOUR
        
        analyzer = EndgameAnalyzer()
        urgency1 = analyzer.get_endgame_urgency(board1)
        urgency2 = analyzer.get_endgame_urgency(board2)
        
        assert urgency2 > urgency1, "More threats should mean higher urgency"
    
    @given(st.lists(st.tuples(position_st, player_st), min_size=0, max_size=10))
    @settings(max_examples=50, deadline=None)
    def test_endgame_result_structure(
        self, 
        moves_data: List[Tuple[Tuple[int, int], str]]
    ):
        """
        **Feature: ai-match-analysis-system, Property: Result structure validity**
        EndgameResult should always have valid structure.
        """
        # Create unique moves
        seen_positions = set()
        moves = []
        for (x, y), piece in moves_data:
            if (x, y) not in seen_positions:
                seen_positions.add((x, y))
                moves.append((x, y, piece))
        
        board = create_board_from_moves(moves)
        
        result = detect_endgame(board, check_vcf=True, check_vct=False)
        
        # Verify result structure
        assert isinstance(result, EndgameResult)
        assert isinstance(result.is_endgame, bool)
        assert isinstance(result.endgame_type, EndgameType)
        assert isinstance(result.empty_cells, int)
        assert 0 <= result.empty_ratio <= 1
        assert isinstance(result.high_threat_count, int)
        assert result.high_threat_count >= 0
        assert isinstance(result.urgency, int)
        assert 0 <= result.urgency <= 100
        assert isinstance(result.recommended_action, str)
    
    def test_is_endgame_quick_check(self):
        """
        **Feature: ai-match-analysis-system, Property: Quick check consistency**
        is_endgame() should be consistent with detect_endgame().
        """
        board = create_empty_board()
        # Create OPEN_FOUR
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        quick_result = is_endgame(board, quick_check=True)
        full_result = detect_endgame(board, check_vcf=True)
        
        # Quick check should detect obvious endgames
        if full_result.endgame_type in [
            EndgameType.CRITICAL_ENDGAME,
            EndgameType.VCF_ENDGAME
        ]:
            assert quick_result, "Quick check should detect critical endgames"


class TestEndgameTypeClassification:
    """Tests for endgame type classification."""
    
    def test_not_endgame_classification(self):
        """
        **Feature: ai-match-analysis-system, Property: NOT_ENDGAME classification**
        Normal positions should be classified as NOT_ENDGAME.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        result = detect_endgame(board, check_vcf=True)
        
        assert result.endgame_type == EndgameType.NOT_ENDGAME
    
    def test_vcf_endgame_classification(self):
        """
        **Feature: ai-match-analysis-system, Property: VCF_ENDGAME classification**
        Positions with VCF should be classified as VCF_ENDGAME.
        """
        board = create_empty_board()
        # Create OPEN_FOUR (VCF)
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        result = detect_endgame(board, check_vcf=True)
        
        assert result.endgame_type == EndgameType.VCF_ENDGAME
        assert result.vcf_player == 'X'
    
    def test_critical_endgame_classification(self):
        """
        **Feature: ai-match-analysis-system, Property: CRITICAL_ENDGAME classification**
        Positions with FIVE should be classified as CRITICAL_ENDGAME.
        """
        board = create_empty_board()
        # Create FIVE
        for i in range(5):
            board[7][5 + i] = 'O'
        
        result = detect_endgame(board)
        
        assert result.endgame_type == EndgameType.CRITICAL_ENDGAME
        assert result.urgency == 100


class TestEndgameAnalyzerEdgeCases:
    """Edge case tests for endgame analyzer."""
    
    def test_both_players_have_threats(self):
        """
        **Feature: ai-match-analysis-system, Property: Both players threats**
        Analyzer should handle positions where both players have threats.
        """
        board = create_empty_board()
        # X has OPEN_THREE
        board[5][5] = 'X'
        board[5][6] = 'X'
        board[5][7] = 'X'
        
        # O has OPEN_THREE
        board[7][5] = 'O'
        board[7][6] = 'O'
        board[7][7] = 'O'
        
        result = detect_endgame(board, check_vcf=True)
        
        # Should have threat scores for both
        assert result.threat_score_x > 0
        assert result.threat_score_o > 0
    
    def test_corner_threats(self):
        """
        **Feature: ai-match-analysis-system, Property: Corner threat handling**
        Analyzer should handle threats near board corners.
        """
        board = create_empty_board()
        # Create FOUR near corner
        board[0][0] = 'X'
        board[0][1] = 'X'
        board[0][2] = 'X'
        board[0][3] = 'X'
        
        result = detect_endgame(board, check_vcf=True)
        
        # Should detect the threat
        assert result.threat_score_x > 0
    
    def test_diagonal_threats(self):
        """
        **Feature: ai-match-analysis-system, Property: Diagonal threat handling**
        Analyzer should handle diagonal threats.
        """
        board = create_empty_board()
        # Create diagonal OPEN_FOUR
        board[5][5] = 'X'
        board[6][6] = 'X'
        board[7][7] = 'X'
        board[8][8] = 'X'
        
        result = detect_endgame(board, check_vcf=True)
        
        assert result.is_endgame, "Diagonal OPEN_FOUR should be endgame"
    
    def test_empty_cells_count_accuracy(self):
        """
        **Feature: ai-match-analysis-system, Property: Empty cells count accuracy**
        Empty cells count should be accurate.
        """
        board = create_empty_board()
        size = len(board)
        total_cells = size * size
        
        # Place some pieces
        board[7][7] = 'X'
        board[7][8] = 'O'
        board[8][7] = 'X'
        
        result = detect_endgame(board)
        
        expected_empty = total_cells - 3
        assert result.empty_cells == expected_empty
        assert abs(result.empty_ratio - (expected_empty / total_cells)) < 0.001


class TestConvenienceFunctions:
    """Tests for convenience functions."""
    
    def test_detect_endgame_function(self):
        """
        **Feature: ai-match-analysis-system, Property: detect_endgame function**
        Convenience function should work correctly.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        result = detect_endgame(board)
        
        assert isinstance(result, EndgameResult)
    
    def test_is_endgame_function(self):
        """
        **Feature: ai-match-analysis-system, Property: is_endgame function**
        Convenience function should return boolean.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        result = is_endgame(board)
        
        assert isinstance(result, bool)
    
    def test_is_endgame_with_vcf_check(self):
        """
        **Feature: ai-match-analysis-system, Property: is_endgame with VCF check**
        is_endgame with quick_check=False should check VCF.
        """
        board = create_empty_board()
        # Create OPEN_FOUR
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        result = is_endgame(board, quick_check=False)
        
        assert result, "OPEN_FOUR should be detected as endgame"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
