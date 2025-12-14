"""
Property-based tests for blocking priority in AI analysis.

Tests that AI correctly prioritizes blocking opponent's threats
when the player doesn't have a winning move.
"""

import pytest
from hypothesis import given, strategies as st, settings, assume

import sys
sys.path.insert(0, '.')

from analysis.basic_analysis_optimized import OptimizedBasicAnalyzer
from analysis.types import Move, ThreatType


class TestBlockingPriority:
    """Tests for blocking priority logic."""
    
    def setup_method(self):
        """Setup analyzer for each test."""
        self.analyzer = OptimizedBasicAnalyzer(board_size=15)
    
    def test_block_opponent_four(self):
        """AI must prioritize blocking opponent's FOUR."""
        board = [[None for _ in range(15)] for _ in range(15)]
        
        # O has 4 consecutive - MUST BLOCK!
        board[7][7] = "O"
        board[7][8] = "O"
        board[7][9] = "O"
        board[7][10] = "O"
        
        # X has scattered pieces (no immediate threat)
        board[5][5] = "X"
        board[9][9] = "X"
        
        best_moves = self.analyzer._find_best_moves_fast(board, "X", top_n=3)
        
        # Must block at (7,6) or (7,11)
        blocking_positions = [(7, 6), (7, 11)]
        
        assert best_moves, "Should find best moves"
        top_move = (best_moves[0][0], best_moves[0][1])
        assert top_move in blocking_positions, f"Top move {top_move} should be blocking position"
    
    def test_block_opponent_open_three_when_no_attack(self):
        """AI should block opponent's OPEN_THREE when player has no strong attack."""
        board = [[None for _ in range(15)] for _ in range(15)]
        
        # O has open three
        board[7][7] = "O"
        board[7][8] = "O"
        board[7][9] = "O"
        
        # X has scattered pieces (no immediate threat)
        board[5][5] = "X"
        board[10][10] = "X"
        
        best_moves = self.analyzer._find_best_moves_fast(board, "X", top_n=3)
        
        # Should block at (7,6) or (7,10)
        blocking_positions = [(7, 6), (7, 10)]
        
        assert best_moves, "Should find best moves"
        top_move = (best_moves[0][0], best_moves[0][1])
        assert top_move in blocking_positions, f"Top move {top_move} should be blocking position"
    
    def test_attack_over_block_when_winning(self):
        """AI should prioritize winning move over blocking."""
        board = [[None for _ in range(15)] for _ in range(15)]
        
        # X has 3 consecutive - can make OPEN_FOUR
        board[7][7] = "X"
        board[8][7] = "X"
        board[9][7] = "X"
        
        # O also has 3 consecutive
        board[7][8] = "O"
        board[8][8] = "O"
        board[9][8] = "O"
        
        best_moves = self.analyzer._find_best_moves_fast(board, "X", top_n=3)
        
        # X should extend to OPEN_FOUR at (6,7) or (10,7)
        winning_positions = [(6, 7), (10, 7)]
        
        assert best_moves, "Should find best moves"
        top_move = (best_moves[0][0], best_moves[0][1])
        assert top_move in winning_positions, f"Top move {top_move} should be winning position"
    
    def test_mistake_detected_when_not_blocking(self):
        """Mistake should be detected when player doesn't block urgent threat."""
        moves = [
            Move(x=7, y=7, player="X"),
            Move(x=7, y=8, player="O"),
            Move(x=8, y=7, player="X"),
            Move(x=8, y=8, player="O"),
            Move(x=9, y=7, player="X"),
            Move(x=9, y=8, player="O"),  # O has open three
            Move(x=5, y=5, player="X"),  # X plays far away - MISTAKE!
        ]
        
        result = self.analyzer.analyze_game(moves, language="vi")
        
        # Should detect mistake at move 7
        mistake_moves = [m.move for m in result.mistakes]
        assert 7 in mistake_moves, "Should detect mistake at move 7"
        
        # Check mistake description mentions blocking
        move_7_mistake = next((m for m in result.mistakes if m.move == 7), None)
        assert move_7_mistake is not None
        assert "chặn" in move_7_mistake.desc.lower() or "block" in move_7_mistake.desc.lower()
    
    def test_no_mistake_when_counter_attacking(self):
        """No mistake when player creates strong counter-attack instead of blocking."""
        moves = [
            Move(x=7, y=7, player="X"),
            Move(x=7, y=8, player="O"),
            Move(x=8, y=7, player="X"),
            Move(x=8, y=8, player="O"),
            Move(x=9, y=7, player="X"),
            Move(x=9, y=8, player="O"),  # O has open three
            Move(x=6, y=7, player="X"),  # X creates FOUR - valid counter-attack!
        ]
        
        result = self.analyzer.analyze_game(moves, language="vi")
        
        # Move 7 should NOT be a mistake (X created FOUR)
        mistake_moves = [m.move for m in result.mistakes]
        assert 7 not in mistake_moves, "Move 7 should not be mistake (counter-attack)"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
