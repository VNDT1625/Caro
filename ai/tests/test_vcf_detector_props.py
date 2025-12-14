"""
Property-based tests for VCF Detector (BASIC tier).

**Feature: gomoku-basic-analysis, Property 45: VCF Detection (3-move depth)**
**Feature: gomoku-basic-analysis, Property 46: Missed Win Detection**

Requirements: 16.1, 16.2, 16.3, 16.4, 16.5
- 16.1: Detect forced win in N moves (VCF, N≤3 for BASIC tier)
- 16.2: Mark "game over" point when position is lost
- 16.3: Rate missed VCF as "blunder" with winning sequence
- 16.4: Rate found VCF as "excellent"
- 16.5: Show winning sequence in alternatives
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.vcf_detector import VCFDetector, VCFResult, detect_vcf, is_position_lost
from analysis.threat_detector import ThreatDetector
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


def copy_board(board: List[List[Optional[str]]]) -> List[List[Optional[str]]]:
    """Create a deep copy of the board."""
    return [row[:] for row in board]


def is_valid_move(board: List[List[Optional[str]]], x: int, y: int) -> bool:
    """Check if a move is valid (within bounds and cell is empty)."""
    return (0 <= x < len(board) and 
            0 <= y < len(board[0]) and 
            board[x][y] is None)


class TestVCFDetectorProperty45:
    """
    Property 45: VCF Detection (3-move depth)
    
    **Feature: gomoku-basic-analysis, Property 45: VCF Detection (3-move depth)**
    *For any* position with forced win in ≤3 moves, the system SHALL detect and report the winning sequence.
    **Validates: Requirements 16.1**
    """
    
    def test_empty_board_no_vcf(self):
        """
        **Feature: gomoku-basic-analysis, Property 45: VCF Detection (3-move depth)**
        An empty board should have no VCF for either player.
        """
        board = create_empty_board()
        detector = VCFDetector()
        
        result_x = detector.detect_vcf(board, 'X')
        result_o = detector.detect_vcf(board, 'O')
        
        assert not result_x.has_vcf, "Empty board should have no VCF for X"
        assert not result_o.has_vcf, "Empty board should have no VCF for O"
        assert result_x.depth == 0
        assert result_o.depth == 0
    
    def test_five_already_won(self):
        """
        **Feature: gomoku-basic-analysis, Property 45: VCF Detection (3-move depth)**
        If player already has FIVE, VCF should return has_vcf=True with depth 0.
        """
        board = create_empty_board()
        # Create FIVE: XXXXX
        for i in range(5):
            board[7][5 + i] = 'X'
        
        detector = VCFDetector()
        result = detector.detect_vcf(board, 'X')
        
        assert result.has_vcf, "FIVE should be detected as won"
        assert result.depth == 0, "Already won should have depth 0"
        assert result.winning_sequence == [], "No moves needed when already won"
    
    def test_open_four_immediate_vcf(self):
        """
        **Feature: gomoku-basic-analysis, Property 45: VCF Detection (3-move depth)**
        If player has OPEN_FOUR, VCF should be found immediately (depth 1).
        """
        board = create_empty_board()
        # Create OPEN_FOUR: _XXXX_
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        # Cells [7][4] and [7][9] are empty (open ends)
        
        detector = VCFDetector()
        result = detector.detect_vcf(board, 'X')
        
        assert result.has_vcf, "OPEN_FOUR should be detected as VCF"
        assert result.depth == 1, "OPEN_FOUR VCF should have depth 1"
        assert len(result.winning_sequence) == 1, "Should have one winning move"
        assert len(result.winning_positions) == 1, "Should have one winning position"
    
    def test_closed_four_vcf(self):
        """
        **Feature: gomoku-basic-analysis, Property 45: VCF Detection (3-move depth)**
        A FOUR (closed on one end) should be detected as VCF.
        """
        board = create_empty_board()
        # Create FOUR: OXXXX_
        board[7][4] = 'O'  # Blocker
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        # Only [7][9] is open
        
        detector = VCFDetector()
        result = detector.detect_vcf(board, 'X')
        
        assert result.has_vcf, "FOUR should be detected as VCF"
        assert result.depth >= 1, "FOUR VCF should have depth >= 1"
    
    def test_diagonal_vcf(self):
        """
        **Feature: gomoku-basic-analysis, Property 45: VCF Detection (3-move depth)**
        VCF should be detected on diagonal lines.
        """
        board = create_empty_board()
        # Create diagonal OPEN_FOUR
        board[5][5] = 'X'
        board[6][6] = 'X'
        board[7][7] = 'X'
        board[8][8] = 'X'
        # [4][4] and [9][9] are open
        
        detector = VCFDetector()
        result = detector.detect_vcf(board, 'X')
        
        assert result.has_vcf, "Diagonal OPEN_FOUR should be VCF"
    
    def test_vertical_vcf(self):
        """
        **Feature: gomoku-basic-analysis, Property 45: VCF Detection (3-move depth)**
        VCF should be detected on vertical lines.
        """
        board = create_empty_board()
        # Create vertical OPEN_FOUR
        board[5][7] = 'X'
        board[6][7] = 'X'
        board[7][7] = 'X'
        board[8][7] = 'X'
        # [4][7] and [9][7] are open
        
        detector = VCFDetector()
        result = detector.detect_vcf(board, 'X')
        
        assert result.has_vcf, "Vertical OPEN_FOUR should be VCF"
    
    @given(player_st)
    @settings(max_examples=10)
    def test_vcf_result_structure(self, player: str):
        """
        **Feature: gomoku-basic-analysis, Property 45: VCF Detection (3-move depth)**
        VCF result should have correct structure.
        """
        board = create_empty_board()
        # Create OPEN_FOUR
        board[7][5] = player
        board[7][6] = player
        board[7][7] = player
        board[7][8] = player
        
        detector = VCFDetector()
        result = detector.detect_vcf(board, player)
        
        assert isinstance(result, VCFResult)
        assert isinstance(result.has_vcf, bool)
        assert isinstance(result.winning_sequence, list)
        assert isinstance(result.winning_positions, list)
        assert isinstance(result.depth, int)
        assert result.depth >= 0
        
        # Sequence and positions should match
        assert len(result.winning_sequence) == len(result.winning_positions)
    
    def test_max_depth_3_respected(self):
        """
        **Feature: gomoku-basic-analysis, Property 45: VCF Detection (3-move depth)**
        BASIC tier should use max_depth=3.
        """
        board = create_empty_board()
        # Create a position that might need deep search
        board[7][7] = 'X'
        board[7][8] = 'X'
        board[8][7] = 'X'
        
        detector = VCFDetector(max_depth=3)
        result = detector.detect_vcf(board, 'X')
        
        # If VCF found, depth should be within limit
        if result.has_vcf:
            assert result.depth <= 3, f"VCF depth {result.depth} exceeds max_depth 3"
    
    @given(st.integers(min_value=1, max_value=5))
    @settings(max_examples=10)
    def test_custom_max_depth(self, max_depth: int):
        """
        **Feature: gomoku-basic-analysis, Property 45: VCF Detection (3-move depth)**
        Custom max_depth should be respected.
        """
        board = create_empty_board()
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        detector = VCFDetector(max_depth=max_depth)
        result = detector.detect_vcf(board, 'X', max_depth=max_depth)
        
        if result.has_vcf:
            assert result.depth <= max_depth


class TestVCFDetectorProperty46:
    """
    Property 46: Missed Win Detection
    
    **Feature: gomoku-basic-analysis, Property 46: Missed Win Detection**
    *For any* move that misses a forced win, the system SHALL rate it as "blunder" and show the winning sequence.
    **Validates: Requirements 16.3**
    """
    
    def test_missed_vcf_detection(self):
        """
        **Feature: gomoku-basic-analysis, Property 46: Missed Win Detection**
        Should detect when player misses a VCF.
        """
        board = create_empty_board()
        # Create OPEN_FOUR: _XXXX_
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        # Winning moves are [7][4] or [7][9]
        
        detector = VCFDetector()
        
        # Player plays a different move (not the winning one)
        missed_result = detector.check_missed_vcf(board, 0, 0, 'X')
        
        assert missed_result is not None, "Should detect missed VCF"
        assert missed_result.has_vcf, "Missed VCF should have has_vcf=True"
        assert len(missed_result.winning_sequence) > 0, "Should show winning sequence"
    
    def test_no_missed_vcf_when_found(self):
        """
        **Feature: gomoku-basic-analysis, Property 46: Missed Win Detection**
        Should not report missed VCF when player finds the winning move.
        """
        board = create_empty_board()
        # Create OPEN_FOUR: _XXXX_
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        detector = VCFDetector()
        
        # First, find the winning move
        vcf_result = detector.detect_vcf(board, 'X')
        assert vcf_result.has_vcf
        
        # Player plays the winning move
        winning_pos = vcf_result.winning_positions[0]
        missed_result = detector.check_missed_vcf(board, winning_pos[0], winning_pos[1], 'X')
        
        assert missed_result is None, "Should not report missed VCF when player finds it"
    
    def test_no_missed_vcf_when_none_exists(self):
        """
        **Feature: gomoku-basic-analysis, Property 46: Missed Win Detection**
        Should not report missed VCF when no VCF exists.
        """
        board = create_empty_board()
        # Just a few pieces, no VCF
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        detector = VCFDetector()
        missed_result = detector.check_missed_vcf(board, 0, 0, 'X')
        
        assert missed_result is None, "Should not report missed VCF when none exists"


class TestVCFDetectorPositionLost:
    """
    Tests for is_position_lost functionality.
    
    **Feature: gomoku-basic-analysis, Property: Position Lost Detection**
    **Validates: Requirements 16.2**
    """
    
    def test_position_lost_when_opponent_has_vcf(self):
        """
        **Feature: gomoku-basic-analysis, Property: Position Lost Detection**
        Position should be marked as lost when opponent has VCF.
        """
        board = create_empty_board()
        # O has OPEN_FOUR
        board[7][5] = 'O'
        board[7][6] = 'O'
        board[7][7] = 'O'
        board[7][8] = 'O'
        
        detector = VCFDetector()
        
        # X's position is lost
        assert detector.is_position_lost(board, 'X'), "X's position should be lost"
        
        # O's position is not lost (O is winning)
        assert not detector.is_position_lost(board, 'O'), "O's position should not be lost"
    
    def test_position_not_lost_on_empty_board(self):
        """
        **Feature: gomoku-basic-analysis, Property: Position Lost Detection**
        Position should not be lost on empty board.
        """
        board = create_empty_board()
        detector = VCFDetector()
        
        assert not detector.is_position_lost(board, 'X')
        assert not detector.is_position_lost(board, 'O')
    
    def test_convenience_function_is_position_lost(self):
        """
        **Feature: gomoku-basic-analysis, Property: Position Lost Detection**
        Convenience function should work correctly.
        """
        board = create_empty_board()
        board[7][5] = 'O'
        board[7][6] = 'O'
        board[7][7] = 'O'
        board[7][8] = 'O'
        
        assert is_position_lost(board, 'X'), "X's position should be lost"


class TestVCFDetectorWinningSequence:
    """
    Tests for winning sequence output.
    
    **Feature: gomoku-basic-analysis, Property: Winning Sequence Output**
    **Validates: Requirements 16.5**
    """
    
    def test_winning_sequence_in_notation(self):
        """
        **Feature: gomoku-basic-analysis, Property: Winning Sequence Output**
        Winning sequence should be in standard notation.
        """
        board = create_empty_board()
        # Create OPEN_FOUR
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        detector = VCFDetector()
        result = detector.detect_vcf(board, 'X')
        
        assert result.has_vcf
        assert len(result.winning_sequence) > 0
        
        # Check notation format (e.g., "H8", "A1", "O15")
        for notation in result.winning_sequence:
            assert isinstance(notation, str)
            assert len(notation) >= 2
            assert notation[0].isalpha()
            assert notation[1:].isdigit()
    
    def test_winning_positions_match_sequence(self):
        """
        **Feature: gomoku-basic-analysis, Property: Winning Sequence Output**
        Winning positions should match winning sequence.
        """
        board = create_empty_board()
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        detector = VCFDetector()
        result = detector.detect_vcf(board, 'X')
        
        assert len(result.winning_sequence) == len(result.winning_positions)
        
        # Each position should be valid
        for x, y in result.winning_positions:
            assert 0 <= x < 15
            assert 0 <= y < 15


class TestVCFDetectorConvenienceFunctions:
    """Tests for convenience functions."""
    
    def test_detect_vcf_function(self):
        """Test detect_vcf convenience function."""
        board = create_empty_board()
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        result = detect_vcf(board, 'X')
        
        assert isinstance(result, VCFResult)
        assert result.has_vcf
    
    def test_detect_vcf_with_custom_depth(self):
        """Test detect_vcf with custom max_depth."""
        board = create_empty_board()
        board[7][7] = 'X'
        
        result = detect_vcf(board, 'X', max_depth=1)
        
        assert isinstance(result, VCFResult)


class TestVCFDetectorEdgeCases:
    """Edge case tests for VCF detector."""
    
    def test_corner_vcf(self):
        """Test VCF detection near board corners."""
        board = create_empty_board()
        # Create OPEN_FOUR near corner
        board[0][1] = 'X'
        board[0][2] = 'X'
        board[0][3] = 'X'
        board[0][4] = 'X'
        
        detector = VCFDetector()
        result = detector.detect_vcf(board, 'X')
        
        # Should detect VCF (OPEN_FOUR, but one end is at edge)
        assert isinstance(result, VCFResult)
    
    def test_edge_vcf(self):
        """Test VCF detection at board edge."""
        board = create_empty_board()
        # Create FOUR at edge
        board[0][0] = 'X'
        board[0][1] = 'X'
        board[0][2] = 'X'
        board[0][3] = 'X'
        # Only [0][4] is open (edge blocks other end)
        
        detector = VCFDetector()
        result = detector.detect_vcf(board, 'X')
        
        assert result.has_vcf, "FOUR at edge should still be VCF"
    
    def test_anti_diagonal_vcf(self):
        """Test VCF on anti-diagonal (bottom-left to top-right)."""
        board = create_empty_board()
        # Create anti-diagonal OPEN_FOUR
        board[8][5] = 'X'
        board[7][6] = 'X'
        board[6][7] = 'X'
        board[5][8] = 'X'
        
        detector = VCFDetector()
        result = detector.detect_vcf(board, 'X')
        
        assert result.has_vcf, "Anti-diagonal OPEN_FOUR should be VCF"
    
    @given(st.lists(st.tuples(position_st, player_st), min_size=0, max_size=3))
    @settings(max_examples=30, deadline=None)
    def test_sparse_board_no_crash(
        self, 
        moves_data: List[Tuple[Tuple[int, int], str]]
    ):
        """
        **Feature: gomoku-basic-analysis, Property 45: VCF Detection (3-move depth)**
        VCF detection should not crash on sparse boards.
        """
        # Create unique moves
        seen_positions = set()
        moves = []
        for (x, y), piece in moves_data:
            if (x, y) not in seen_positions:
                seen_positions.add((x, y))
                moves.append((x, y, piece))
        
        board = create_board_from_moves(moves)
        detector = VCFDetector()
        
        # Should not crash
        result_x = detector.detect_vcf(board, 'X')
        result_o = detector.detect_vcf(board, 'O')
        
        assert isinstance(result_x, VCFResult)
        assert isinstance(result_o, VCFResult)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
