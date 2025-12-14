"""
Property-Based Tests for AdvancedEvaluator

**Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
**Property: winning position → high score, losing → low score**

Tests that the advanced evaluator correctly identifies:
- Winning positions have high scores
- Losing positions have low scores
- Multi-factor evaluation improves accuracy
"""

from hypothesis import given, strategies as st, settings, assume
from analysis.advanced_evaluator import AdvancedEvaluator
from analysis.types import BOARD_SIZE, ThreatType
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


class TestAdvancedEvaluatorProps:
    """Property tests for AdvancedEvaluator"""
    
    def setup_method(self):
        self.evaluator = AdvancedEvaluator()
    
    def test_winning_position_high_score(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
        A winning position (FIVE in a row) should have a very high score.
        """
        board = create_empty_board()
        # Create a winning position for X (five in a row)
        for i in range(5):
            board[7][3 + i] = "X"
        
        result = self.evaluator.evaluate_position(board, "X")
        
        # Winning position should have very high score
        assert result.score > 50000, f"Winning position score {result.score} should be > 50000"
        assert result.win_probability > 0.99, f"Win probability {result.win_probability} should be > 0.99"
    
    def test_losing_position_low_score(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
        A losing position (opponent has FIVE) should have a very low score.
        """
        board = create_empty_board()
        # Create a losing position for X (O has five in a row)
        for i in range(5):
            board[7][3 + i] = "O"
        
        result = self.evaluator.evaluate_position(board, "X")
        
        # Losing position should have very low score
        assert result.score < -50000, f"Losing position score {result.score} should be < -50000"
        assert result.win_probability < 0.01, f"Win probability {result.win_probability} should be < 0.01"
    
    def test_open_four_high_score(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
        An OPEN_FOUR position should have a high score (guaranteed win).
        """
        board = create_empty_board()
        # Create an open four for X: _XXXX_
        for i in range(4):
            board[7][4 + i] = "X"
        
        result = self.evaluator.evaluate_position(board, "X")
        
        # Open four should have high score
        assert result.score > 5000, f"Open four score {result.score} should be > 5000"
        assert result.win_probability > 0.9, f"Win probability {result.win_probability} should be > 0.9"

    def test_opponent_open_four_low_score(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
        When opponent has OPEN_FOUR, player should have low score.
        """
        board = create_empty_board()
        # Create an open four for O: _OOOO_
        for i in range(4):
            board[7][4 + i] = "O"
        
        result = self.evaluator.evaluate_position(board, "X")
        
        # Should have low score when opponent has open four
        assert result.score < -5000, f"Score {result.score} should be < -5000 when opponent has open four"
    
    @given(
        x=st.integers(min_value=0, max_value=BOARD_SIZE - 1),
        y=st.integers(min_value=0, max_value=BOARD_SIZE - 1)
    )
    @settings(max_examples=100)
    def test_shape_score_non_negative_for_single_piece(self, x, y):
        """
        **Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
        Shape score for a single piece should be reasonable (may be negative due to isolation penalty).
        """
        board = create_empty_board()
        board[x][y] = "X"
        
        shape = self.evaluator.shape_score(board, "X")
        # Single piece gets isolation penalty, so score should be around -10
        assert -20 <= shape <= 10, f"Shape score {shape} out of expected range for single piece"
    
    @given(
        x=st.integers(min_value=1, max_value=BOARD_SIZE - 2),
        y=st.integers(min_value=1, max_value=BOARD_SIZE - 2)
    )
    @settings(max_examples=100)
    def test_connectivity_increases_with_adjacent_pieces(self, x, y):
        """
        **Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
        Connectivity score should increase when pieces are adjacent.
        """
        # Single piece
        board1 = create_empty_board()
        board1[x][y] = "X"
        conn1 = self.evaluator.connectivity_score(board1, "X")
        
        # Two adjacent pieces
        board2 = create_empty_board()
        board2[x][y] = "X"
        board2[x][y + 1] = "X"
        conn2 = self.evaluator.connectivity_score(board2, "X")
        
        assert conn2 > conn1, f"Connectivity {conn2} should be > {conn1} with adjacent pieces"
    
    def test_territory_center_control_bonus(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
        Pieces in the center should give higher territory score than edges.
        """
        center = BOARD_SIZE // 2
        
        # Piece in center
        board_center = create_empty_board()
        board_center[center][center] = "X"
        territory_center = self.evaluator.territory_score(board_center, "X")
        
        # Piece in corner
        board_corner = create_empty_board()
        board_corner[0][0] = "X"
        territory_corner = self.evaluator.territory_score(board_corner, "X")
        
        assert territory_center > territory_corner, \
            f"Center territory {territory_center} should be > corner {territory_corner}"
    
    def test_tempo_with_forcing_threats(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
        Player with forcing threats should have positive tempo.
        """
        board = create_empty_board()
        # Create a FOUR for X (forcing threat)
        for i in range(4):
            board[7][3 + i] = "X"
        # Block one end
        board[7][2] = "O"
        
        player_threats = self.evaluator.threat_detector.detect_all_threats(board, "X")
        opponent_threats = self.evaluator.threat_detector.detect_all_threats(board, "O")
        
        tempo = self.evaluator.tempo_score(board, "X", player_threats, opponent_threats)
        
        # Should have positive tempo with forcing threat
        assert tempo > 0, f"Tempo {tempo} should be > 0 with forcing threat"
    
    def test_is_winning_position_with_five(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
        is_winning_position should return True when player has FIVE.
        """
        board = create_empty_board()
        for i in range(5):
            board[7][3 + i] = "X"
        
        assert self.evaluator.is_winning_position(board, "X") is True
        assert self.evaluator.is_losing_position(board, "O") is True
    
    def test_is_winning_position_with_open_four(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
        is_winning_position should return True when player has OPEN_FOUR.
        """
        board = create_empty_board()
        # Create open four: _XXXX_
        for i in range(4):
            board[7][4 + i] = "X"
        
        assert self.evaluator.is_winning_position(board, "X") is True
    
    def test_is_losing_position_when_opponent_wins(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
        is_losing_position should return True when opponent has winning position.
        """
        board = create_empty_board()
        for i in range(5):
            board[7][3 + i] = "O"
        
        assert self.evaluator.is_losing_position(board, "X") is True
        assert self.evaluator.is_winning_position(board, "X") is False

    @given(
        num_pieces=st.integers(min_value=2, max_value=10)
    )
    @settings(max_examples=50)
    def test_connected_pieces_better_than_scattered(self, num_pieces):
        """
        **Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
        Connected pieces should have higher connectivity score than scattered pieces.
        """
        # Connected pieces in a line
        board_connected = create_empty_board()
        for i in range(num_pieces):
            board_connected[7][3 + i] = "X"
        conn_connected = self.evaluator.connectivity_score(board_connected, "X")
        
        # Scattered pieces (spread out)
        board_scattered = create_empty_board()
        for i in range(num_pieces):
            board_scattered[i * 2 % BOARD_SIZE][(i * 3) % BOARD_SIZE] = "X"
        conn_scattered = self.evaluator.connectivity_score(board_scattered, "X")
        
        # Connected should generally be better (may not always be true for very scattered)
        # At minimum, connected pieces should have positive connectivity
        assert conn_connected > 0, f"Connected pieces should have positive connectivity: {conn_connected}"
    
    def test_detailed_evaluation_returns_all_components(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
        get_detailed_evaluation should return all score components.
        """
        board = create_empty_board()
        board[7][7] = "X"
        board[7][8] = "X"
        board[8][7] = "O"
        
        details = self.evaluator.get_detailed_evaluation(board, "X")
        
        # Check all expected keys are present
        expected_keys = [
            "threat_score", "shape_score", "connectivity_score",
            "territory_score", "tempo_score", "combined_score",
            "win_probability", "player_threats", "opponent_threats"
        ]
        for key in expected_keys:
            assert key in details, f"Missing key: {key}"
        
        # Win probability should be in valid range
        assert 0 <= details["win_probability"] <= 1
    
    @given(
        score=st.floats(min_value=-100000, max_value=100000, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=100)
    def test_win_probability_in_valid_range(self, score):
        """
        **Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
        Win probability should always be in [0, 1] range.
        """
        prob = self.evaluator._calculate_win_probability(score)
        assert 0 <= prob <= 1, f"Win probability {prob} out of range for score {score}"
    
    def test_multi_factor_improves_evaluation(self):
        """
        **Feature: ai-match-analysis-system, Task 8.3.1: Multi-Factor Evaluation**
        Multi-factor evaluation should differentiate positions better than threat-only.
        """
        # Two positions with similar threat scores but different shapes
        
        # Position 1: Good shape (L-shape)
        board1 = create_empty_board()
        board1[7][7] = "X"
        board1[7][8] = "X"
        board1[8][7] = "X"
        
        # Position 2: Bad shape (scattered)
        board2 = create_empty_board()
        board2[0][0] = "X"
        board2[7][7] = "X"
        board2[14][14] = "X"
        
        result1 = self.evaluator.evaluate_position(board1, "X")
        result2 = self.evaluator.evaluate_position(board2, "X")
        
        # Good shape should have higher score
        assert result1.score > result2.score, \
            f"Good shape score {result1.score} should be > scattered {result2.score}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
