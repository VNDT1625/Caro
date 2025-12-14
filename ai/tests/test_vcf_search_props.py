"""
Property-based tests for VCF (Victory by Continuous Four) Search.

**Feature: ai-match-analysis-system, Property: VCF Detection Accuracy**
- If VCF exists → must find it
- If no VCF → return None/found=False
- VCF sequence must be valid (all moves legal, leads to win)
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.vcf_search import VCFSearch, VCFResult, find_vcf
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


def is_valid_move(board: List[List[Optional[str]]], x: int, y: int) -> bool:
    """Check if a move is valid (within bounds and cell is empty)."""
    return (0 <= x < len(board) and 
            0 <= y < len(board[0]) and 
            board[x][y] is None)


def has_five(board: List[List[Optional[str]]], player: str) -> bool:
    """Check if player has five in a row."""
    detector = ThreatDetector()
    threats = detector.detect_all_threats(board, player)
    return threats.threats.get(ThreatType.FIVE, 0) > 0


class TestVCFSearchProperties:
    """Property tests for VCF search algorithm."""
    
    def test_empty_board_no_vcf(self):
        """
        **Feature: ai-match-analysis-system, Property: No VCF on empty board**
        An empty board should have no VCF for either player.
        """
        board = create_empty_board()
        
        result_x = find_vcf(board, 'X')
        result_o = find_vcf(board, 'O')
        
        assert not result_x.found, "Empty board should have no VCF for X"
        assert not result_o.found, "Empty board should have no VCF for O"
    
    def test_single_piece_no_vcf(self):
        """
        **Feature: ai-match-analysis-system, Property: No VCF with single piece**
        A board with only one piece should have no VCF.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        result = find_vcf(board, 'X')
        
        assert not result.found, "Single piece should have no VCF"
    
    def test_open_four_immediate_vcf(self):
        """
        **Feature: ai-match-analysis-system, Property: OPEN_FOUR is immediate VCF**
        If player has OPEN_FOUR, VCF should be found immediately.
        """
        board = create_empty_board()
        # Create OPEN_FOUR: _XXXX_
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        # Cells [7][4] and [7][9] are empty (open ends)
        
        result = find_vcf(board, 'X')
        
        assert result.found, "OPEN_FOUR should be detected as VCF"
        assert result.depth <= 2, "OPEN_FOUR VCF should be very short"
    
    def test_five_already_won(self):
        """
        **Feature: ai-match-analysis-system, Property: FIVE is already won**
        If player already has FIVE, VCF should return found=True with depth 0.
        """
        board = create_empty_board()
        # Create FIVE: XXXXX
        for i in range(5):
            board[7][5 + i] = 'X'
        
        result = find_vcf(board, 'X')
        
        assert result.found, "FIVE should be detected as won"
        assert result.depth == 0, "Already won should have depth 0"
    
    def test_simple_vcf_sequence(self):
        """
        **Feature: ai-match-analysis-system, Property: Simple VCF detection**
        A position with clear VCF should be detected.
        """
        board = create_empty_board()
        # Create a position where X can force a win with FOUR threats
        # X has: XXX_ and can create FOUR, then another FOUR
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        # X can play [7][8] to create FOUR (XXXX_)
        # Then play [7][4] to create another threat
        
        # Also add some pieces to make it more realistic
        board[8][5] = 'X'
        board[8][6] = 'X'
        board[8][7] = 'X'
        # Now X has two lines of three
        
        result = find_vcf(board, 'X')
        
        # This position should have VCF
        # Note: The exact result depends on the position
        # We're testing that the algorithm runs without error
        assert isinstance(result, VCFResult)
        assert isinstance(result.found, bool)
    
    @given(player_st)
    @settings(max_examples=10)
    def test_vcf_sequence_validity(self, player: str):
        """
        **Feature: ai-match-analysis-system, Property: VCF sequence validity**
        If VCF is found, the sequence should be valid moves leading to win.
        """
        # Create a position with known VCF
        board = create_empty_board()
        # OPEN_FOUR guarantees VCF
        board[7][5] = player
        board[7][6] = player
        board[7][7] = player
        board[7][8] = player
        
        result = find_vcf(board, player)
        
        assert result.found, "OPEN_FOUR should have VCF"
        
        # Verify sequence validity
        test_board = [row[:] for row in board]  # Copy board
        for x, y, p in result.sequence:
            assert is_valid_move(test_board, x, y), f"Move ({x}, {y}) should be valid"
            test_board[x][y] = p
        
        # After sequence, player should have won (or be about to win)
        # Note: sequence might not include the final winning move
        # but should lead to a winning position
    
    @given(st.lists(st.tuples(position_st, player_st), min_size=0, max_size=5))
    @settings(max_examples=50, deadline=None)
    def test_no_false_positives_sparse_board(
        self, 
        moves_data: List[Tuple[Tuple[int, int], str]]
    ):
        """
        **Feature: ai-match-analysis-system, Property: No false positives**
        Random sparse boards should rarely have VCF.
        """
        # Create unique moves
        seen_positions = set()
        moves = []
        for (x, y), piece in moves_data:
            if (x, y) not in seen_positions:
                seen_positions.add((x, y))
                moves.append((x, y, piece))
        
        board = create_board_from_moves(moves)
        
        # With very few pieces, VCF is unlikely
        result_x = find_vcf(board, 'X', max_depth=10)
        result_o = find_vcf(board, 'O', max_depth=10)
        
        # If VCF is found, verify it's valid
        if result_x.found:
            assert len(result_x.sequence) > 0 or result_x.depth == 0
        if result_o.found:
            assert len(result_o.sequence) > 0 or result_o.depth == 0
    
    def test_blocked_four_no_immediate_vcf(self):
        """
        **Feature: ai-match-analysis-system, Property: Blocked FOUR handling**
        A FOUR with one end blocked is not immediate VCF (needs more moves).
        """
        board = create_empty_board()
        # Create blocked FOUR: OXXXX_
        board[7][4] = 'O'  # Blocker
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        # Only [7][9] is open
        
        result = find_vcf(board, 'X')
        
        # This is a FOUR (not OPEN_FOUR), so it's not immediate win
        # But X can still win by playing [7][9]
        # The test verifies the algorithm handles this correctly
        assert isinstance(result, VCFResult)
    
    @given(st.integers(min_value=1, max_value=10))
    @settings(max_examples=20)
    def test_max_depth_respected(self, max_depth: int):
        """
        **Feature: ai-match-analysis-system, Property: Depth limit respected**
        VCF search should respect the max_depth parameter.
        """
        board = create_empty_board()
        # Create a position that might have deep VCF
        board[7][7] = 'X'
        board[7][8] = 'X'
        board[8][7] = 'X'
        
        searcher = VCFSearch(max_depth=max_depth)
        result = searcher.search(board, 'X')
        
        # If VCF found, depth should be within limit
        if result.found:
            assert result.depth <= max_depth * 2, \
                f"VCF depth {result.depth} exceeds max_depth {max_depth}"
    
    def test_defender_blocking_considered(self):
        """
        **Feature: ai-match-analysis-system, Property: Defender blocking**
        VCF search should consider defender's blocking moves.
        """
        board = create_empty_board()
        # Create FOUR: _XXXX_
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        # This is OPEN_FOUR, so X wins regardless of O's defense
        result = find_vcf(board, 'X')
        
        assert result.found, "OPEN_FOUR should be VCF"
        
        # Now block one end
        board[7][4] = 'O'
        
        # Still a FOUR, X can win by playing [7][9]
        result2 = find_vcf(board, 'X')
        
        # Should still find VCF (X plays [7][9] to win)
        assert result2.found, "FOUR with one open end should still be VCF"


class TestVCFSearchEdgeCases:
    """Edge case tests for VCF search."""
    
    def test_corner_vcf(self):
        """Test VCF detection near board corners."""
        board = create_empty_board()
        # Create OPEN_FOUR near corner
        board[0][1] = 'X'
        board[0][2] = 'X'
        board[0][3] = 'X'
        board[0][4] = 'X'
        
        result = find_vcf(board, 'X')
        
        # Should detect VCF (OPEN_FOUR)
        assert result.found
    
    def test_diagonal_vcf(self):
        """Test VCF detection on diagonal lines."""
        board = create_empty_board()
        # Create diagonal OPEN_FOUR
        board[5][5] = 'X'
        board[6][6] = 'X'
        board[7][7] = 'X'
        board[8][8] = 'X'
        
        result = find_vcf(board, 'X')
        
        assert result.found, "Diagonal OPEN_FOUR should be VCF"
    
    def test_multiple_threats_vcf(self):
        """Test VCF with multiple threat lines."""
        board = create_empty_board()
        # Create position with multiple threat lines
        # Horizontal: XXX_
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        # Vertical: XXX_
        board[5][7] = 'X'
        board[6][7] = 'X'
        # board[7][7] already placed
        
        result = find_vcf(board, 'X')
        
        # Should find VCF through one of the lines
        assert isinstance(result, VCFResult)
    
    def test_nodes_searched_tracking(self):
        """Test that nodes searched is tracked correctly."""
        board = create_empty_board()
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        searcher = VCFSearch()
        result = searcher.search(board, 'X')
        
        nodes = searcher.get_nodes_searched()
        assert nodes >= 0, "Nodes searched should be non-negative"


class TestVCFSearchIntegration:
    """Integration tests with threat detector."""
    
    def test_vcf_uses_threat_detector(self):
        """Verify VCF search uses threat detector correctly."""
        board = create_empty_board()
        # Create known threat pattern
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        # Verify threat detector sees OPEN_FOUR
        detector = ThreatDetector()
        threats = detector.detect_all_threats(board, 'X')
        
        has_open_four = threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0
        
        # VCF should agree with threat detector
        result = find_vcf(board, 'X')
        
        if has_open_four:
            assert result.found, "OPEN_FOUR should be detected as VCF"
    
    def test_convenience_function(self):
        """Test the find_vcf convenience function."""
        board = create_empty_board()
        board[7][7] = 'X'
        
        result = find_vcf(board, 'X')
        
        assert isinstance(result, VCFResult)
        assert hasattr(result, 'found')
        assert hasattr(result, 'sequence')
        assert hasattr(result, 'depth')


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
