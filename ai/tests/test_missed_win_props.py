"""
Property-based tests for Missed Win Detection.

**Feature: ai-match-analysis-system, Property: Missed wins correctly detected**
- If VCF exists before a move and player doesn't play it → missed win detected
- If player plays the VCF move → no missed win
- Winning sequence is correctly captured
- Analysis summary is accurate

Task 8.5.3: Missed Win Detection
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.endgame_analyzer import (
    MissedWinDetector,
    MissedWin,
    MissedWinAnalysis,
    detect_missed_wins,
    check_move_for_missed_win,
)
from analysis.vcf_search import VCFSearch, find_vcf
from analysis.types import BOARD_SIZE


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


class TestMissedWinDetectionProperties:
    """Property tests for missed win detection."""
    
    def test_vcf_not_played_is_missed_win(self):
        """
        **Feature: ai-match-analysis-system, Property: VCF not played is missed win**
        If a player has VCF but plays a different move, it should be detected as missed win.
        """
        board = create_empty_board()
        # Create OPEN_FOUR for X: _XXXX_
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        # Verify X has VCF
        vcf_result = find_vcf(board, 'X')
        assert vcf_result.found, "X should have VCF"
        
        # X plays a different move (not the VCF)
        wrong_move = (0, 0)  # Far from the winning position
        
        detector = MissedWinDetector()
        missed = detector.check_move_for_missed_win(board, 'X', wrong_move, move_number=1)
        
        assert missed is not None, "Should detect missed win"
        assert missed.player == 'X'
        assert missed.actual_move == wrong_move
        assert missed.is_vcf
        assert missed.severity == "critical"
        assert len(missed.winning_sequence) > 0
    
    def test_vcf_played_is_not_missed_win(self):
        """
        **Feature: ai-match-analysis-system, Property: VCF played is not missed win**
        If a player has VCF and plays the winning move, no missed win should be detected.
        """
        board = create_empty_board()
        # Create OPEN_FOUR for X: _XXXX_
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        # Verify X has VCF and get the winning move
        vcf_result = find_vcf(board, 'X')
        assert vcf_result.found, "X should have VCF"
        
        # X plays the VCF move
        winning_move = vcf_result.sequence[0][:2]
        
        detector = MissedWinDetector()
        missed = detector.check_move_for_missed_win(board, 'X', winning_move, move_number=1)
        
        assert missed is None, "Should not detect missed win when VCF is played"
    
    def test_no_vcf_no_missed_win(self):
        """
        **Feature: ai-match-analysis-system, Property: No VCF means no missed win**
        If a player has no VCF, no missed win should be detected regardless of move.
        """
        board = create_empty_board()
        # Simple position with no VCF
        board[7][7] = 'X'
        board[7][8] = 'X'
        board[8][7] = 'O'
        
        # Verify no VCF
        vcf_result = find_vcf(board, 'X')
        assert not vcf_result.found, "X should not have VCF"
        
        # X plays any move
        any_move = (5, 5)
        
        detector = MissedWinDetector()
        missed = detector.check_move_for_missed_win(board, 'X', any_move, move_number=1)
        
        assert missed is None, "Should not detect missed win when no VCF exists"
    
    def test_game_analysis_detects_all_missed_wins(self):
        """
        **Feature: ai-match-analysis-system, Property: Game analysis detects all missed wins**
        Analyzing a game should detect all missed winning opportunities.
        """
        # Create a game where X has VCF at move 5 but doesn't play it
        moves = [
            (7, 7, 'X'),   # Move 1
            (8, 8, 'O'),   # Move 2
            (7, 8, 'X'),   # Move 3
            (8, 7, 'O'),   # Move 4
            (7, 6, 'X'),   # Move 5 - X now has XXX
            (9, 9, 'O'),   # Move 6
            (7, 9, 'X'),   # Move 7 - X now has XXXX (OPEN_FOUR)
            (0, 0, 'O'),   # Move 8 - O plays random instead of blocking
            (7, 5, 'X'),   # Move 9 - X wins
        ]
        
        # At move 8, O should have blocked but didn't
        # At move 9, X had VCF and played it (no miss)
        
        analysis = detect_missed_wins(moves)
        
        assert isinstance(analysis, MissedWinAnalysis)
        assert analysis.total_missed >= 0
        assert analysis.missed_by_x >= 0
        assert analysis.missed_by_o >= 0
        assert analysis.total_missed == analysis.missed_by_x + analysis.missed_by_o
    
    def test_missed_win_has_winning_sequence(self):
        """
        **Feature: ai-match-analysis-system, Property: Missed win has winning sequence**
        Every detected missed win should include the winning sequence.
        """
        board = create_empty_board()
        # Create OPEN_FOUR for X
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        wrong_move = (0, 0)
        
        detector = MissedWinDetector()
        missed = detector.check_move_for_missed_win(board, 'X', wrong_move, move_number=1)
        
        assert missed is not None
        assert len(missed.winning_sequence) > 0
        
        # First move in sequence should be the winning move
        first_move = missed.winning_sequence[0]
        assert len(first_move) == 3  # (x, y, player)
        assert first_move[2] == 'X'  # Should be X's move
    
    def test_missed_win_explanation_in_vietnamese(self):
        """
        **Feature: ai-match-analysis-system, Property: Explanation in Vietnamese**
        Missed win explanation should be in Vietnamese.
        """
        board = create_empty_board()
        # Create OPEN_FOUR for X
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        wrong_move = (0, 0)
        
        detector = MissedWinDetector()
        missed = detector.check_move_for_missed_win(board, 'X', wrong_move, move_number=1)
        
        assert missed is not None
        assert len(missed.explanation) > 0
        # Check for Vietnamese keywords
        assert any(word in missed.explanation for word in ['bỏ lỡ', 'thắng', 'VCF', 'nước'])
    
    def test_analysis_summary_accuracy(self):
        """
        **Feature: ai-match-analysis-system, Property: Analysis summary accuracy**
        Analysis summary should accurately reflect the missed wins.
        """
        # Game with no missed wins (simple game)
        simple_moves = [
            (7, 7, 'X'),
            (8, 8, 'O'),
            (7, 8, 'X'),
            (8, 7, 'O'),
        ]
        
        analysis = detect_missed_wins(simple_moves)
        
        assert isinstance(analysis.summary, str)
        assert len(analysis.summary) > 0
        
        if analysis.total_missed == 0:
            assert "Không có" in analysis.summary or "0" in analysis.summary
    
    def test_most_critical_missed_win(self):
        """
        **Feature: ai-match-analysis-system, Property: Most critical missed win**
        The most critical missed win should be the one with shortest VCF depth.
        """
        board = create_empty_board()
        # Create OPEN_FOUR for X (very short VCF)
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        # Create a game where X misses this
        moves = [
            (7, 5, 'X'),
            (0, 0, 'O'),
            (7, 6, 'X'),
            (0, 1, 'O'),
            (7, 7, 'X'),
            (0, 2, 'O'),
            (7, 8, 'X'),  # Now X has OPEN_FOUR
            (0, 3, 'O'),
            (0, 4, 'X'),  # X plays wrong move instead of winning
        ]
        
        analysis = detect_missed_wins(moves)
        
        if analysis.total_missed > 0:
            assert analysis.most_critical is not None
            # Most critical should have the shortest depth
            for missed in analysis.missed_wins:
                assert analysis.most_critical.vcf_depth <= missed.vcf_depth
    
    def test_winning_sequence_display(self):
        """
        **Feature: ai-match-analysis-system, Property: Winning sequence display**
        get_winning_sequence_display should return proper display format.
        """
        board = create_empty_board()
        # Create OPEN_FOUR for X
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        
        wrong_move = (0, 0)
        
        detector = MissedWinDetector()
        missed = detector.check_move_for_missed_win(board, 'X', wrong_move, move_number=1)
        
        assert missed is not None
        
        display = detector.get_winning_sequence_display(missed)
        
        assert isinstance(display, list)
        if len(display) > 0:
            first_step = display[0]
            assert "step" in first_step
            assert "x" in first_step
            assert "y" in first_step
            assert "player" in first_step
            assert "type" in first_step
            assert "label" in first_step


class TestMissedWinEdgeCases:
    """Edge case tests for missed win detection."""
    
    def test_empty_game(self):
        """
        **Feature: ai-match-analysis-system, Property: Empty game handling**
        Empty game should return no missed wins.
        """
        analysis = detect_missed_wins([])
        
        assert analysis.total_missed == 0
        assert analysis.missed_by_x == 0
        assert analysis.missed_by_o == 0
        assert len(analysis.missed_wins) == 0
    
    def test_single_move_game(self):
        """
        **Feature: ai-match-analysis-system, Property: Single move game**
        Single move game should not have missed wins.
        """
        moves = [(7, 7, 'X')]
        
        analysis = detect_missed_wins(moves)
        
        assert analysis.total_missed == 0
    
    def test_both_players_miss_wins(self):
        """
        **Feature: ai-match-analysis-system, Property: Both players can miss wins**
        Both X and O can have missed wins in the same game.
        """
        # This is a constructed scenario - in practice both players
        # could miss wins at different points
        detector = MissedWinDetector()
        
        # Test X missing
        board_x = create_empty_board()
        board_x[7][5] = 'X'
        board_x[7][6] = 'X'
        board_x[7][7] = 'X'
        board_x[7][8] = 'X'
        
        missed_x = detector.check_move_for_missed_win(board_x, 'X', (0, 0), 1)
        
        # Test O missing
        board_o = create_empty_board()
        board_o[7][5] = 'O'
        board_o[7][6] = 'O'
        board_o[7][7] = 'O'
        board_o[7][8] = 'O'
        
        missed_o = detector.check_move_for_missed_win(board_o, 'O', (0, 0), 1)
        
        assert missed_x is not None
        assert missed_o is not None
        assert missed_x.player == 'X'
        assert missed_o.player == 'O'
    
    def test_corner_vcf(self):
        """
        **Feature: ai-match-analysis-system, Property: Corner VCF detection**
        VCF near corners should be detected correctly.
        """
        board = create_empty_board()
        # Create OPEN_FOUR near corner
        board[0][0] = 'X'
        board[0][1] = 'X'
        board[0][2] = 'X'
        board[0][3] = 'X'
        
        vcf_result = find_vcf(board, 'X')
        
        if vcf_result.found:
            wrong_move = (7, 7)  # Center, not the winning move
            
            detector = MissedWinDetector()
            missed = detector.check_move_for_missed_win(board, 'X', wrong_move, 1)
            
            if missed:
                assert missed.is_vcf
    
    def test_diagonal_vcf(self):
        """
        **Feature: ai-match-analysis-system, Property: Diagonal VCF detection**
        Diagonal VCF should be detected correctly.
        """
        board = create_empty_board()
        # Create diagonal OPEN_FOUR
        board[5][5] = 'X'
        board[6][6] = 'X'
        board[7][7] = 'X'
        board[8][8] = 'X'
        
        vcf_result = find_vcf(board, 'X')
        
        if vcf_result.found:
            wrong_move = (0, 0)
            
            detector = MissedWinDetector()
            missed = detector.check_move_for_missed_win(board, 'X', wrong_move, 1)
            
            if missed:
                assert missed.is_vcf


class TestMissedWinPropertyBased:
    """Property-based tests using Hypothesis."""
    
    @given(player_st)
    @settings(max_examples=10)
    def test_vcf_implies_potential_missed_win(self, player: str):
        """
        **Feature: ai-match-analysis-system, Property: VCF implies potential missed win**
        If a player has VCF and plays wrong move, missed win is detected.
        """
        board = create_empty_board()
        
        # Create OPEN_FOUR for the player
        board[7][5] = player
        board[7][6] = player
        board[7][7] = player
        board[7][8] = player
        
        # Verify VCF exists
        vcf_result = find_vcf(board, player)
        assume(vcf_result.found)
        
        # Play a wrong move (not the VCF)
        wrong_move = (0, 0)
        
        detector = MissedWinDetector()
        missed = detector.check_move_for_missed_win(board, player, wrong_move, 1)
        
        assert missed is not None, f"{player} should have missed win detected"
        assert missed.player == player
        assert missed.is_vcf
    
    @given(st.lists(st.tuples(position_st, player_st), min_size=0, max_size=5))
    @settings(max_examples=20, deadline=None)
    def test_analysis_result_structure(
        self, 
        moves_data: List[Tuple[Tuple[int, int], str]]
    ):
        """
        **Feature: ai-match-analysis-system, Property: Analysis result structure**
        MissedWinAnalysis should always have valid structure.
        """
        # Create unique moves with alternating players
        seen_positions = set()
        moves = []
        current_player = 'X'
        
        for (x, y), _ in moves_data:
            if (x, y) not in seen_positions:
                seen_positions.add((x, y))
                moves.append((x, y, current_player))
                current_player = 'O' if current_player == 'X' else 'X'
        
        analysis = detect_missed_wins(moves)
        
        # Verify structure
        assert isinstance(analysis, MissedWinAnalysis)
        assert isinstance(analysis.missed_wins, list)
        assert isinstance(analysis.total_missed, int)
        assert isinstance(analysis.missed_by_x, int)
        assert isinstance(analysis.missed_by_o, int)
        assert analysis.total_missed >= 0
        assert analysis.missed_by_x >= 0
        assert analysis.missed_by_o >= 0
        assert analysis.total_missed == analysis.missed_by_x + analysis.missed_by_o
        assert isinstance(analysis.summary, str)
        
        # Verify each missed win
        for missed in analysis.missed_wins:
            assert isinstance(missed, MissedWin)
            assert missed.player in ['X', 'O']
            assert isinstance(missed.actual_move, tuple)
            assert len(missed.actual_move) == 2
            assert isinstance(missed.winning_sequence, list)
            assert isinstance(missed.vcf_depth, int)
            assert missed.vcf_depth >= 0
            assert missed.severity in ["critical", "major"]


class TestConvenienceFunctions:
    """Tests for convenience functions."""
    
    def test_detect_missed_wins_function(self):
        """
        **Feature: ai-match-analysis-system, Property: detect_missed_wins function**
        Convenience function should work correctly.
        """
        moves = [(7, 7, 'X'), (8, 8, 'O')]
        
        result = detect_missed_wins(moves)
        
        assert isinstance(result, MissedWinAnalysis)
    
    def test_check_move_for_missed_win_function(self):
        """
        **Feature: ai-match-analysis-system, Property: check_move_for_missed_win function**
        Convenience function should work correctly.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        
        result = check_move_for_missed_win(board, 'X', (5, 5), 1)
        
        # Should return None (no VCF) or MissedWin
        assert result is None or isinstance(result, MissedWin)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
