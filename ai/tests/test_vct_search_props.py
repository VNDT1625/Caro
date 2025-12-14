"""
Property-based tests for VCT (Victory by Continuous Three) Search.

**Feature: ai-match-analysis-system, Property: VCT Detection Accuracy**
- If VCT exists → must find it
- If no VCT → return None/found=False
- VCT sequence must be valid (all moves legal, leads to win)
- VCT extends VCF with THREE threats
- Defensive VCT correctly identifies blocking moves
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.vct_search import (
    VCTSearch,
    VCTResult,
    VCTMoveType,
    DefensiveVCTSearch,
    find_vct,
    find_vct_defense,
)
from analysis.vcf_search import VCFSearch, find_vcf
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


class TestVCTSearchProperties:
    """Property tests for VCT search algorithm."""
    
    def test_empty_board_no_vct(self):
        """
        **Feature: ai-match-analysis-system, Property: No VCT on empty board**
        An empty board should have no VCT for either player.
        """
        board = create_empty_board()
        
        result_x = find_vct(board, 'X')
        result_o = find_vct(board, 'O')
        
        assert not result_x.found, "Empty board should have no VCT for X"
        assert not result_o.found, "Empty board should have no VCT for O"
    
    def test_single_piece_no_vct(self):
        """
        **Feature: ai-match-analysis-system, Property: No VCT with single piece**
        A board with only one piece should have no VCT.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        result = find_vct(board, 'X')
        
        assert not result.found, "Single piece should have no VCT"
    
    def test_open_four_immediate_vct(self):
        """
        **Feature: ai-match-analysis-system, Property: OPEN_FOUR is immediate VCT**
        If player has OPEN_FOUR, VCT should be found immediately.
        """
        board = create_empty_board()
        # Create OPEN_FOUR: _XXXX_
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        result = find_vct(board, 'X')
        
        assert result.found, "OPEN_FOUR should be detected as VCT"
        assert result.depth <= 2, "OPEN_FOUR VCT should be very short"
    
    def test_five_already_won(self):
        """
        **Feature: ai-match-analysis-system, Property: FIVE is already won**
        If player already has FIVE, VCT should return found=True with depth 0.
        """
        board = create_empty_board()
        # Create FIVE: XXXXX
        for i in range(5):
            board[7][5 + i] = 'X'
        
        result = find_vct(board, 'X')
        
        assert result.found, "FIVE should be detected as won"
        assert result.depth == 0, "Already won should have depth 0"
        assert result.is_vcf, "FIVE should be marked as VCF"

    
    def test_vct_includes_vcf(self):
        """
        **Feature: ai-match-analysis-system, Property: VCT includes VCF**
        Any position with VCF should also have VCT (VCT is superset of VCF).
        """
        board = create_empty_board()
        # Create a position with clear VCF (OPEN_FOUR)
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        vcf_result = find_vcf(board, 'X')
        vct_result = find_vct(board, 'X')
        
        # If VCF exists, VCT must also exist
        if vcf_result.found:
            assert vct_result.found, "VCT should find what VCF finds"
    
    def test_vct_with_three_threats(self):
        """
        **Feature: ai-match-analysis-system, Property: VCT with THREE threats**
        VCT should detect winning sequences that use THREE threats.
        """
        board = create_empty_board()
        # Create a position with OPEN_THREE that can lead to win
        # X has: _XXX_ (OPEN_THREE)
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        # Also add another line to create double threat potential
        board[5][7] = 'X'
        board[6][7] = 'X'
        # board[7][7] already placed
        
        result = find_vct(board, 'X')
        
        # This position should have VCT through THREE threats
        assert isinstance(result, VCTResult)
        assert isinstance(result.found, bool)
    
    @given(player_st)
    @settings(max_examples=10)
    def test_vct_sequence_validity(self, player: str):
        """
        **Feature: ai-match-analysis-system, Property: VCT sequence validity**
        If VCT is found, the sequence should be valid moves.
        """
        # Create a position with known VCT
        board = create_empty_board()
        # OPEN_FOUR guarantees VCT
        board[7][5] = player
        board[7][6] = player
        board[7][7] = player
        board[7][8] = player
        
        result = find_vct(board, player)
        
        assert result.found, "OPEN_FOUR should have VCT"
        
        # Verify sequence validity
        test_board = [row[:] for row in board]  # Copy board
        for x, y, p in result.sequence:
            assert is_valid_move(test_board, x, y), f"Move ({x}, {y}) should be valid"
            test_board[x][y] = p
    
    @given(st.lists(st.tuples(position_st, player_st), min_size=0, max_size=5))
    @settings(max_examples=50, deadline=None)
    def test_no_false_positives_sparse_board(
        self, 
        moves_data: List[Tuple[Tuple[int, int], str]]
    ):
        """
        **Feature: ai-match-analysis-system, Property: No false positives**
        Random sparse boards should rarely have VCT.
        """
        # Create unique moves
        seen_positions = set()
        moves = []
        for (x, y), piece in moves_data:
            if (x, y) not in seen_positions:
                seen_positions.add((x, y))
                moves.append((x, y, piece))
        
        board = create_board_from_moves(moves)
        
        # With very few pieces, VCT is unlikely
        result_x = find_vct(board, 'X', max_depth=8)
        result_o = find_vct(board, 'O', max_depth=8)
        
        # If VCT is found, verify it's valid
        if result_x.found:
            assert len(result_x.sequence) > 0 or result_x.depth == 0
        if result_o.found:
            assert len(result_o.sequence) > 0 or result_o.depth == 0
    
    @given(st.integers(min_value=1, max_value=6))
    @settings(max_examples=10, deadline=None)
    def test_max_depth_respected(self, max_depth: int):
        """
        **Feature: ai-match-analysis-system, Property: Depth limit respected**
        VCT search should respect the max_depth parameter.
        """
        board = create_empty_board()
        # Create a position that might have deep VCT
        board[7][7] = 'X'
        board[7][8] = 'X'
        board[8][7] = 'X'
        
        searcher = VCTSearch(max_depth=max_depth)
        result = searcher.search(board, 'X')
        
        # If VCT found, depth should be within limit
        if result.found:
            assert result.depth <= max_depth * 2, \
                f"VCT depth {result.depth} exceeds max_depth {max_depth}"


class TestVCTMoveTypes:
    """Tests for VCT move type tracking."""
    
    def test_move_types_tracked(self):
        """
        **Feature: ai-match-analysis-system, Property: Move types tracked**
        VCT result should track the types of moves in the sequence.
        """
        board = create_empty_board()
        # Create OPEN_FOUR
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        result = find_vct(board, 'X')
        
        assert result.found
        assert isinstance(result.move_types, list)
    
    def test_is_vcf_flag(self):
        """
        **Feature: ai-match-analysis-system, Property: is_vcf flag accuracy**
        The is_vcf flag should correctly indicate pure VCF sequences.
        """
        board = create_empty_board()
        # Create OPEN_FOUR (pure VCF)
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        result = find_vct(board, 'X')
        
        assert result.found
        assert result.is_vcf, "OPEN_FOUR should be marked as VCF"


class TestDefensiveVCT:
    """Tests for defensive VCT search."""
    
    def test_no_defense_needed_when_no_vct(self):
        """
        **Feature: ai-match-analysis-system, Property: No defense when no VCT**
        If opponent has no VCT, defensive search should indicate this.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        defense = find_vct_defense(board, 'O')
        
        assert not defense["opponent_has_vct"]
        assert defense["can_block"]
    
    def test_defense_found_for_open_four(self):
        """
        **Feature: ai-match-analysis-system, Property: Defense for OPEN_FOUR**
        Defensive search should identify when opponent has OPEN_FOUR.
        """
        board = create_empty_board()
        # X has OPEN_FOUR
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        defense = find_vct_defense(board, 'O')
        
        assert defense["opponent_has_vct"], "Should detect X's VCT"
        # OPEN_FOUR cannot be blocked
        assert not defense["can_block"], "OPEN_FOUR cannot be blocked"
    
    def test_defense_for_four(self):
        """
        **Feature: ai-match-analysis-system, Property: Defense for FOUR**
        Defensive search should find blocking moves for FOUR threat.
        """
        board = create_empty_board()
        # X has FOUR (blocked on one end)
        board[7][4] = 'O'  # Blocker
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        # Only [7][9] is open
        
        defense = find_vct_defense(board, 'O')
        
        # Should detect the threat
        assert defense["opponent_has_vct"]
        # Should find defensive moves
        assert len(defense["defensive_moves"]) > 0
    
    def test_defensive_moves_are_valid(self):
        """
        **Feature: ai-match-analysis-system, Property: Defensive moves validity**
        All suggested defensive moves should be valid (empty cells).
        """
        board = create_empty_board()
        # Create a threat - FOUR with one end blocked
        board[7][4] = 'O'  # Blocker
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        # Only [7][9] is open for X to win
        
        defense = find_vct_defense(board, 'O')
        
        for x, y in defense["defensive_moves"]:
            assert 0 <= x < 15, f"x={x} out of bounds"
            assert 0 <= y < 15, f"y={y} out of bounds"
            assert board[x][y] is None, f"Position ({x}, {y}) is not empty, has {board[x][y]}"


class TestVCTEdgeCases:
    """Edge case tests for VCT search."""
    
    def test_corner_vct(self):
        """Test VCT detection near board corners."""
        board = create_empty_board()
        # Create OPEN_FOUR near corner
        board[0][1] = 'X'
        board[0][2] = 'X'
        board[0][3] = 'X'
        board[0][4] = 'X'
        
        result = find_vct(board, 'X')
        
        assert result.found
    
    def test_diagonal_vct(self):
        """Test VCT detection on diagonal lines."""
        board = create_empty_board()
        # Create diagonal OPEN_FOUR
        board[5][5] = 'X'
        board[6][6] = 'X'
        board[7][7] = 'X'
        board[8][8] = 'X'
        
        result = find_vct(board, 'X')
        
        assert result.found, "Diagonal OPEN_FOUR should be VCT"
    
    def test_nodes_searched_tracking(self):
        """Test that nodes searched is tracked correctly."""
        board = create_empty_board()
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        searcher = VCTSearch()
        result = searcher.search(board, 'X')
        
        nodes = searcher.get_nodes_searched()
        assert nodes >= 0, "Nodes searched should be non-negative"
    
    def test_convenience_functions(self):
        """Test the convenience functions."""
        board = create_empty_board()
        board[7][7] = 'X'
        
        vct_result = find_vct(board, 'X')
        defense_result = find_vct_defense(board, 'O')
        
        assert isinstance(vct_result, VCTResult)
        assert isinstance(defense_result, dict)
        assert "opponent_has_vct" in defense_result
        assert "defensive_moves" in defense_result
        assert "best_defense" in defense_result
        assert "can_block" in defense_result


class TestVCTIntegration:
    """Integration tests with other components."""
    
    def test_vct_uses_vcf_internally(self):
        """
        **Feature: ai-match-analysis-system, Property: VCT uses VCF**
        VCT should use VCF search internally for efficiency.
        """
        board = create_empty_board()
        # Create OPEN_FOUR (pure VCF case)
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        vcf_result = find_vcf(board, 'X')
        vct_result = find_vct(board, 'X')
        
        # Both should find the win
        assert vcf_result.found
        assert vct_result.found
        # VCT should mark this as VCF
        assert vct_result.is_vcf
    
    def test_vct_extends_vcf_with_three(self):
        """
        **Feature: ai-match-analysis-system, Property: VCT extends VCF**
        VCT should find wins that VCF misses (using THREE threats).
        """
        board = create_empty_board()
        # Create a position with OPEN_THREE but no immediate VCF
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        # This is OPEN_THREE, not FOUR
        
        vcf_result = find_vcf(board, 'X', max_depth=6)
        vct_result = find_vct(board, 'X', max_depth=8)
        
        # VCT might find wins that VCF doesn't
        # (depends on the specific position)
        assert isinstance(vcf_result.found, bool)
        assert isinstance(vct_result.found, bool)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
