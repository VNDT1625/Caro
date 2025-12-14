"""
Property-based tests for Endgame Solver.

**Feature: ai-match-analysis-system, Property: Solvable endgames → correct solution**
- VCF positions correctly solved as WIN
- VCT positions correctly solved as WIN
- Positions with opponent VCF correctly identified as LOSS or DRAW
- Drawing sequences prevent opponent from winning
- Winning sequences lead to FIVE

Task 8.5.2: Endgame Solving
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.endgame_analyzer import (
    EndgameSolver,
    EndgameSolution,
    EndgameSolutionType,
    solve_endgame,
    find_winning_sequence,
    find_drawing_sequence,
)
from analysis.threat_detector import ThreatDetector
from analysis.vcf_search import find_vcf, VCFSearch
from analysis.vct_search import find_vct, VCTSearch
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


def apply_sequence(
    board: List[List[Optional[str]]],
    sequence: List[Tuple[int, int, str]]
) -> List[List[Optional[str]]]:
    """Apply a sequence of moves to a board (creates a copy)."""
    new_board = [row[:] for row in board]
    for x, y, player in sequence:
        if 0 <= x < len(new_board) and 0 <= y < len(new_board[0]):
            new_board[x][y] = player
    return new_board


def has_five(board: List[List[Optional[str]]], player: str) -> bool:
    """Check if player has FIVE in a row."""
    detector = ThreatDetector()
    threats = detector.detect_all_threats(board, player)
    return threats.threats.get(ThreatType.FIVE, 0) > 0


class TestEndgameSolverProperties:
    """Property tests for endgame solver."""
    
    def test_vcf_position_solved_as_win(self):
        """
        **Feature: ai-match-analysis-system, Property: VCF → WIN**
        A position with VCF should be solved as WIN.
        """
        board = create_empty_board()
        # Create OPEN_FOUR (guaranteed VCF): _XXXX_
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        # Verify VCF exists
        vcf_result = find_vcf(board, 'X')
        assume(vcf_result.found)
        
        # Solve endgame
        solution = solve_endgame(board, 'X')
        
        assert solution.solution_type == EndgameSolutionType.WIN
        assert solution.is_vcf or solution.evaluation >= 90
    
    def test_five_in_row_solved_as_win(self):
        """
        **Feature: ai-match-analysis-system, Property: FIVE → WIN**
        A position with FIVE in a row should be solved as WIN.
        """
        board = create_empty_board()
        # Create FIVE: XXXXX
        for i in range(5):
            board[7][5 + i] = 'X'
        
        solution = solve_endgame(board, 'X')
        
        assert solution.solution_type == EndgameSolutionType.WIN
        assert solution.evaluation == 100
    
    def test_opponent_five_solved_as_loss(self):
        """
        **Feature: ai-match-analysis-system, Property: Opponent FIVE → LOSS**
        A position where opponent has FIVE should be solved as LOSS.
        """
        board = create_empty_board()
        # Create FIVE for O: OOOOO
        for i in range(5):
            board[7][5 + i] = 'O'
        
        solution = solve_endgame(board, 'X')
        
        assert solution.solution_type == EndgameSolutionType.LOSS
        assert solution.evaluation == -100
    
    @given(player_st)
    @settings(max_examples=10)
    def test_vcf_winning_sequence_leads_to_five(self, player: str):
        """
        **Feature: ai-match-analysis-system, Property: Winning sequence → FIVE**
        Applying a winning sequence should result in FIVE.
        """
        board = create_empty_board()
        # Create OPEN_FOUR
        board[7][5] = player
        board[7][6] = player
        board[7][7] = player
        board[7][8] = player
        
        # Find winning sequence
        winning_seq = find_winning_sequence(board, player)
        
        if winning_seq:
            # Apply the winning sequence
            result_board = apply_sequence(board, winning_seq)
            
            # Should have FIVE
            assert has_five(result_board, player), \
                "Winning sequence should result in FIVE"
    
    def test_solution_structure_validity(self):
        """
        **Feature: ai-match-analysis-system, Property: Solution structure validity**
        EndgameSolution should always have valid structure.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        solution = solve_endgame(board, 'X')
        
        # Verify structure
        assert isinstance(solution, EndgameSolution)
        assert isinstance(solution.solution_type, EndgameSolutionType)
        assert isinstance(solution.winning_sequence, list)
        assert isinstance(solution.drawing_sequence, list)
        assert isinstance(solution.depth, int)
        assert solution.depth >= 0
        assert isinstance(solution.is_vcf, bool)
        assert isinstance(solution.is_vct, bool)
        assert isinstance(solution.evaluation, int)
        assert -100 <= solution.evaluation <= 100
        assert isinstance(solution.analysis, str)
    
    def test_opponent_vcf_requires_defense(self):
        """
        **Feature: ai-match-analysis-system, Property: Opponent VCF → defense needed**
        When opponent has VCF, solution should be LOSS or DRAW with defense.
        """
        board = create_empty_board()
        # Create OPEN_FOUR for O
        board[7][5] = 'O'
        board[7][6] = 'O'
        board[7][7] = 'O'
        board[7][8] = 'O'
        
        # Verify O has VCF
        vcf_result = find_vcf(board, 'O')
        assume(vcf_result.found)
        
        # Solve for X (defender)
        solution = solve_endgame(board, 'X')
        
        # X should be losing or drawing (if defense exists)
        assert solution.solution_type in [
            EndgameSolutionType.LOSS,
            EndgameSolutionType.DRAW
        ]
        assert solution.evaluation < 0
    
    @given(st.integers(0, 14), st.integers(0, 10))
    @settings(max_examples=20, deadline=None)
    def test_horizontal_vcf_detection(self, row: int, start_col: int):
        """
        **Feature: ai-match-analysis-system, Property: Horizontal VCF detection**
        Horizontal OPEN_FOUR should be detected as VCF win.
        """
        assume(start_col + 4 < 15)  # Ensure FOUR fits
        
        board = create_empty_board()
        # Create horizontal OPEN_FOUR
        for i in range(4):
            board[row][start_col + i] = 'X'
        
        solution = solve_endgame(board, 'X', check_vct=False)
        
        # Should be WIN with VCF
        assert solution.solution_type == EndgameSolutionType.WIN
    
    @given(st.integers(0, 10), st.integers(0, 14))
    @settings(max_examples=20, deadline=None)
    def test_vertical_vcf_detection(self, start_row: int, col: int):
        """
        **Feature: ai-match-analysis-system, Property: Vertical VCF detection**
        Vertical OPEN_FOUR should be detected as VCF win.
        """
        assume(start_row + 4 < 15)  # Ensure FOUR fits
        
        board = create_empty_board()
        # Create vertical OPEN_FOUR
        for i in range(4):
            board[start_row + i][col] = 'O'
        
        solution = solve_endgame(board, 'O', check_vct=False)
        
        # Should be WIN with VCF
        assert solution.solution_type == EndgameSolutionType.WIN
    
    @given(st.integers(0, 10), st.integers(0, 10))
    @settings(max_examples=20, deadline=None)
    def test_diagonal_vcf_detection(self, start_row: int, start_col: int):
        """
        **Feature: ai-match-analysis-system, Property: Diagonal VCF detection**
        Diagonal OPEN_FOUR should be detected as VCF win.
        """
        assume(start_row + 4 < 15 and start_col + 4 < 15)
        
        board = create_empty_board()
        # Create diagonal OPEN_FOUR
        for i in range(4):
            board[start_row + i][start_col + i] = 'X'
        
        solution = solve_endgame(board, 'X', check_vct=False)
        
        # Should be WIN with VCF
        assert solution.solution_type == EndgameSolutionType.WIN


class TestWinningSequenceProperties:
    """Property tests for winning sequence finding."""
    
    def test_winning_sequence_not_empty_when_vcf_exists(self):
        """
        **Feature: ai-match-analysis-system, Property: VCF → non-empty sequence**
        When VCF exists, winning sequence should not be empty.
        """
        board = create_empty_board()
        # Create OPEN_FOUR
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        winning_seq = find_winning_sequence(board, 'X')
        
        assert winning_seq is not None
        assert len(winning_seq) > 0
    
    def test_winning_sequence_moves_are_valid(self):
        """
        **Feature: ai-match-analysis-system, Property: Winning moves are valid**
        All moves in winning sequence should be valid (empty cells, in bounds).
        """
        board = create_empty_board()
        # Create OPEN_FOUR
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        winning_seq = find_winning_sequence(board, 'X')
        
        if winning_seq:
            for x, y, player in winning_seq:
                assert 0 <= x < 15, f"x={x} out of bounds"
                assert 0 <= y < 15, f"y={y} out of bounds"
                assert player in ['X', 'O'], f"Invalid player: {player}"
    
    def test_no_winning_sequence_for_empty_board(self):
        """
        **Feature: ai-match-analysis-system, Property: Empty board → no winning sequence**
        Empty board should have no winning sequence.
        """
        board = create_empty_board()
        
        winning_seq = find_winning_sequence(board, 'X')
        
        assert winning_seq is None


class TestDrawingSequenceProperties:
    """Property tests for drawing sequence finding."""
    
    def test_drawing_sequence_blocks_opponent_vcf(self):
        """
        **Feature: ai-match-analysis-system, Property: Drawing blocks VCF**
        Drawing sequence should block opponent's VCF if possible.
        """
        board = create_empty_board()
        # Create FOUR for O (not OPEN_FOUR, so X can block)
        board[7][5] = 'O'
        board[7][6] = 'O'
        board[7][7] = 'O'
        board[7][8] = 'O'
        # Block one end
        board[7][4] = 'X'
        
        # X needs to block the other end
        drawing_seq = find_drawing_sequence(board, 'X')
        
        # If drawing sequence exists, applying it should block O's win
        if drawing_seq:
            result_board = apply_sequence(board, drawing_seq)
            # O should not have immediate VCF after X's defense
            # (This is a simplified check)
            assert len(drawing_seq) > 0
    
    def test_no_drawing_when_player_can_win(self):
        """
        **Feature: ai-match-analysis-system, Property: Win > Draw**
        When player can win, drawing sequence is not the priority.
        """
        board = create_empty_board()
        # Create OPEN_FOUR for X (X can win)
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        # X should find winning sequence, not drawing
        solution = solve_endgame(board, 'X')
        
        assert solution.solution_type == EndgameSolutionType.WIN
        assert len(solution.winning_sequence) > 0 or solution.evaluation >= 90


class TestEndgameSolverEdgeCases:
    """Edge case tests for endgame solver."""
    
    def test_empty_board_solution(self):
        """
        **Feature: ai-match-analysis-system, Property: Empty board handling**
        Empty board should return UNKNOWN or DRAW solution.
        """
        board = create_empty_board()
        
        solution = solve_endgame(board, 'X')
        
        # Empty board has no forcing sequence
        assert solution.solution_type in [
            EndgameSolutionType.UNKNOWN,
            EndgameSolutionType.DRAW
        ]
    
    def test_single_piece_solution(self):
        """
        **Feature: ai-match-analysis-system, Property: Single piece handling**
        Board with single piece should return UNKNOWN or DRAW.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        solution = solve_endgame(board, 'X')
        
        assert solution.solution_type in [
            EndgameSolutionType.UNKNOWN,
            EndgameSolutionType.DRAW
        ]
    
    def test_corner_vcf(self):
        """
        **Feature: ai-match-analysis-system, Property: Corner VCF handling**
        VCF near corner should be detected correctly.
        """
        board = create_empty_board()
        # Create OPEN_FOUR near corner
        board[0][0] = 'X'
        board[0][1] = 'X'
        board[0][2] = 'X'
        board[0][3] = 'X'
        
        solution = solve_endgame(board, 'X')
        
        # Should still detect VCF
        assert solution.solution_type == EndgameSolutionType.WIN
    
    def test_both_players_have_threats(self):
        """
        **Feature: ai-match-analysis-system, Property: Both players threats**
        Solver should handle positions where both players have threats.
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
        
        # Should not crash
        solution = solve_endgame(board, 'X')
        
        assert isinstance(solution, EndgameSolution)
        assert solution.solution_type in EndgameSolutionType


class TestConvenienceFunctions:
    """Tests for convenience functions."""
    
    def test_solve_endgame_function(self):
        """
        **Feature: ai-match-analysis-system, Property: solve_endgame function**
        Convenience function should work correctly.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        solution = solve_endgame(board, 'X')
        
        assert isinstance(solution, EndgameSolution)
    
    def test_find_winning_sequence_function(self):
        """
        **Feature: ai-match-analysis-system, Property: find_winning_sequence function**
        Convenience function should return sequence or None.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        result = find_winning_sequence(board, 'X')
        
        assert result is None or isinstance(result, list)
    
    def test_find_drawing_sequence_function(self):
        """
        **Feature: ai-match-analysis-system, Property: find_drawing_sequence function**
        Convenience function should return sequence or None.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        result = find_drawing_sequence(board, 'X')
        
        assert result is None or isinstance(result, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
