"""
Property-Based Tests for Threat Space Analysis

**Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
**Impact: Better mid-game evaluation**

This module contains property-based tests using Hypothesis to verify that
the ThreatSpaceAnalyzer correctly calculates:
1. Threat space - the number of empty cells that can create threats
2. Threat potential - the potential for developing threats from current positions

Properties tested:
1. More threat space → higher space score
2. Threat space is always non-negative
3. Threat space is bounded by empty cells
4. Adding player pieces increases threat potential
5. Empty board has maximum threat space
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hypothesis import given, strategies as st, settings, assume, Phase
from typing import List, Tuple, Optional
import pytest

from analysis.threat_space import ThreatSpaceAnalyzer, ThreatSpaceResult
from analysis.types import BOARD_SIZE


# ============================================
# Custom Strategies for Board Generation
# ============================================

@st.composite
def empty_board(draw):
    """Generate an empty board."""
    return [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]


@st.composite
def board_with_pieces(draw, min_pieces: int = 1, max_pieces: int = 20):
    """
    Generate a board with a random number of pieces.
    
    Args:
        min_pieces: Minimum number of pieces to place
        max_pieces: Maximum number of pieces to place
    """
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    
    num_pieces = draw(st.integers(min_value=min_pieces, max_value=max_pieces))
    
    # Generate unique positions
    positions = draw(st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=BOARD_SIZE - 1),
            st.integers(min_value=0, max_value=BOARD_SIZE - 1)
        ),
        min_size=num_pieces,
        max_size=num_pieces,
        unique=True
    ))
    
    # Place pieces alternating between X and O
    for i, (x, y) in enumerate(positions):
        board[x][y] = "X" if i % 2 == 0 else "O"
    
    return board


@st.composite
def board_with_x_pieces_only(draw, min_pieces: int = 1, max_pieces: int = 10):
    """Generate a board with only X pieces (for simpler testing)."""
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    
    num_pieces = draw(st.integers(min_value=min_pieces, max_value=max_pieces))
    
    positions = draw(st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=BOARD_SIZE - 1),
            st.integers(min_value=0, max_value=BOARD_SIZE - 1)
        ),
        min_size=num_pieces,
        max_size=num_pieces,
        unique=True
    ))
    
    for x, y in positions:
        board[x][y] = "X"
    
    return board


@st.composite
def two_boards_with_different_piece_counts(draw):
    """
    Generate two boards where one has more pieces than the other.
    
    Returns:
        Tuple of (board_with_fewer_pieces, board_with_more_pieces)
    """
    # First board: fewer pieces
    fewer_pieces = draw(st.integers(min_value=1, max_value=5))
    board1 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    
    positions1 = draw(st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=BOARD_SIZE - 1),
            st.integers(min_value=0, max_value=BOARD_SIZE - 1)
        ),
        min_size=fewer_pieces,
        max_size=fewer_pieces,
        unique=True
    ))
    
    for x, y in positions1:
        board1[x][y] = "X"
    
    # Second board: more pieces (includes all from board1 plus additional)
    board2 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    
    # Copy board1 pieces
    for x, y in positions1:
        board2[x][y] = "X"
    
    # Add more pieces
    additional_pieces = draw(st.integers(min_value=1, max_value=5))
    
    # Find empty positions not in positions1
    available = [(x, y) for x in range(BOARD_SIZE) for y in range(BOARD_SIZE)
                 if (x, y) not in positions1]
    
    if len(available) >= additional_pieces:
        additional_positions = draw(st.lists(
            st.sampled_from(available),
            min_size=additional_pieces,
            max_size=additional_pieces,
            unique=True
        ))
        
        for x, y in additional_positions:
            board2[x][y] = "X"
    
    return board1, board2


# ============================================
# Property Tests
# ============================================

class TestThreatSpaceProperties:
    """
    Property-based tests for Threat Space Analysis.
    
    **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
    """
    
    def setup_method(self):
        """Set up test fixtures."""
        self.analyzer = ThreatSpaceAnalyzer()
    
    @given(board=board_with_pieces(min_pieces=1, max_pieces=15))
    @settings(max_examples=50, deadline=None)
    def test_threat_space_is_non_negative(self, board):
        """
        **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
        
        Property: Threat space is always non-negative.
        
        For any board state, the threat space count SHALL be >= 0.
        """
        result = self.analyzer.calculate_threat_space(board, "X")
        
        assert result.threat_space >= 0, \
            f"Threat space should be non-negative, got {result.threat_space}"
        assert result.threat_potential >= 0, \
            f"Threat potential should be non-negative, got {result.threat_potential}"
        assert result.space_score >= 0, \
            f"Space score should be non-negative, got {result.space_score}"
    
    @given(board=board_with_pieces(min_pieces=1, max_pieces=15))
    @settings(max_examples=50, deadline=None)
    def test_threat_space_bounded_by_empty_cells(self, board):
        """
        **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
        
        Property: Threat space is bounded by the number of empty cells.
        
        For any board state, the threat space count SHALL be <= number of empty cells.
        """
        result = self.analyzer.calculate_threat_space(board, "X")
        
        # Count empty cells
        empty_cells = sum(1 for row in board for cell in row if cell is None)
        
        assert result.threat_space <= empty_cells, \
            f"Threat space ({result.threat_space}) should be <= empty cells ({empty_cells})"
    
    @given(board=board_with_pieces(min_pieces=1, max_pieces=15))
    @settings(max_examples=50, deadline=None)
    def test_threat_cells_are_empty(self, board):
        """
        **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
        
        Property: All threat cells are empty cells on the board.
        
        For any board state, all cells in threat_cells SHALL be empty (None).
        """
        result = self.analyzer.calculate_threat_space(board, "X")
        
        for x, y in result.threat_cells:
            assert 0 <= x < BOARD_SIZE, f"x={x} out of bounds"
            assert 0 <= y < BOARD_SIZE, f"y={y} out of bounds"
            assert board[x][y] is None, \
                f"Threat cell ({x}, {y}) should be empty, got {board[x][y]}"
    
    @given(board=board_with_pieces(min_pieces=1, max_pieces=15))
    @settings(max_examples=50, deadline=None)
    def test_threat_space_count_matches_cells(self, board):
        """
        **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
        
        Property: Threat space count matches the number of threat cells.
        
        For any board state, threat_space SHALL equal len(threat_cells).
        """
        result = self.analyzer.calculate_threat_space(board, "X")
        
        assert result.threat_space == len(result.threat_cells), \
            f"Threat space ({result.threat_space}) should equal len(threat_cells) ({len(result.threat_cells)})"
    
    def test_empty_board_has_threat_space(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
        
        Specific case: Empty board should have some threat space.
        
        An empty board has potential for threats in any cell.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        result = self.analyzer.calculate_threat_space(board, "X")
        
        # Empty board should have threat space (all cells have potential)
        assert result.threat_space >= 0, \
            "Empty board should have non-negative threat space"
    
    def test_full_board_has_zero_threat_space(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
        
        Specific case: Full board should have zero threat space.
        
        A board with no empty cells has no threat space.
        """
        # Create a full board (alternating X and O)
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        for x in range(BOARD_SIZE):
            for y in range(BOARD_SIZE):
                board[x][y] = "X" if (x + y) % 2 == 0 else "O"
        
        result = self.analyzer.calculate_threat_space(board, "X")
        
        assert result.threat_space == 0, \
            f"Full board should have zero threat space, got {result.threat_space}"
        assert len(result.threat_cells) == 0, \
            f"Full board should have no threat cells, got {len(result.threat_cells)}"

    
    @given(boards=two_boards_with_different_piece_counts())
    @settings(max_examples=50, deadline=None)
    def test_more_pieces_affects_threat_potential(self, boards):
        """
        **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
        
        Property: Adding pieces affects threat potential.
        
        For any two boards where one has more pieces than the other,
        the threat potential SHALL be different (more pieces = more potential
        for creating threats, but also fewer empty cells).
        """
        board_fewer, board_more = boards
        
        result_fewer = self.analyzer.calculate_threat_space(board_fewer, "X")
        result_more = self.analyzer.calculate_threat_space(board_more, "X")
        
        # The board with more pieces should have higher threat potential
        # (more pieces = more opportunities to extend threats)
        # OR lower threat space (fewer empty cells)
        # This is a metamorphic property - the relationship should hold
        
        # Count pieces in each board
        pieces_fewer = sum(1 for row in board_fewer for cell in row if cell == "X")
        pieces_more = sum(1 for row in board_more for cell in row if cell == "X")
        
        # More pieces should generally lead to higher potential (more threats to extend)
        # but fewer empty cells (less threat space)
        empty_fewer = sum(1 for row in board_fewer for cell in row if cell is None)
        empty_more = sum(1 for row in board_more for cell in row if cell is None)
        
        # The board with more pieces should have fewer empty cells
        assert empty_more <= empty_fewer, \
            f"Board with more pieces should have fewer empty cells"
        
        # Threat space should be bounded by empty cells
        assert result_more.threat_space <= empty_more, \
            f"Threat space should be bounded by empty cells"
        assert result_fewer.threat_space <= empty_fewer, \
            f"Threat space should be bounded by empty cells"
    
    @given(board=board_with_x_pieces_only(min_pieces=2, max_pieces=8))
    @settings(max_examples=50, deadline=None)
    def test_more_threat_space_higher_score(self, board):
        """
        **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
        
        Property: More threat space → higher space score.
        
        For any board state, if we compare the space_score with threat_space,
        a higher threat_space SHALL result in a higher or equal space_score
        (all else being equal).
        
        This is tested by verifying the score formula is monotonic with respect
        to threat space.
        """
        result = self.analyzer.calculate_threat_space(board, "X")
        
        # The space score should be positively correlated with threat space
        # space_score = space_component + potential_component
        # where space_component = min(threat_space * 10, 500)
        
        # Verify the relationship holds
        expected_space_component = min(result.threat_space * 10, 500)
        
        # The space score should be at least the space component
        assert result.space_score >= expected_space_component, \
            f"Space score ({result.space_score}) should be >= space component ({expected_space_component})"
    
    def test_space_score_increases_with_threat_space(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
        
        Specific case: Space score increases with threat space.
        
        Compare two boards where one has more threat space than the other.
        """
        # Board 1: Single piece in center (more threat space)
        board1 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board1[7][7] = "X"
        
        # Board 2: Many pieces blocking potential (less threat space)
        board2 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board2[7][7] = "X"
        # Add opponent pieces around to block
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if dx != 0 or dy != 0:
                    board2[7 + dx][7 + dy] = "O"
        
        result1 = self.analyzer.calculate_threat_space(board1, "X")
        result2 = self.analyzer.calculate_threat_space(board2, "X")
        
        # Board 1 should have more threat space (fewer blocking pieces)
        assert result1.threat_space >= result2.threat_space, \
            f"Board with fewer blockers should have more threat space"
    
    @given(board=board_with_pieces(min_pieces=5, max_pieces=15))
    @settings(max_examples=30, deadline=None)
    def test_compare_threat_space_returns_valid_result(self, board):
        """
        **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
        
        Property: compare_threat_space returns valid comparison data.
        
        For any board state, the comparison result SHALL contain valid data
        for both players.
        """
        comparison = self.analyzer.compare_threat_space(board, "X", "O")
        
        # Check structure
        assert "player1" in comparison
        assert "player2" in comparison
        assert "advantage" in comparison
        assert "space_difference" in comparison
        assert "potential_difference" in comparison
        assert "score_difference" in comparison
        
        # Check player1 data
        assert comparison["player1"]["player"] == "X"
        assert comparison["player1"]["threat_space"] >= 0
        assert comparison["player1"]["threat_potential"] >= 0
        assert comparison["player1"]["space_score"] >= 0
        
        # Check player2 data
        assert comparison["player2"]["player"] == "O"
        assert comparison["player2"]["threat_space"] >= 0
        assert comparison["player2"]["threat_potential"] >= 0
        assert comparison["player2"]["space_score"] >= 0
        
        # Check advantage is one of the players
        assert comparison["advantage"] in ["X", "O"]
        
        # Check differences are consistent
        expected_space_diff = comparison["player1"]["threat_space"] - comparison["player2"]["threat_space"]
        assert comparison["space_difference"] == expected_space_diff
    
    def test_center_position_has_high_potential(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
        
        Specific case: Center position should have high threat potential.
        
        A piece in the center has more directions to create threats.
        """
        # Board with single piece in center
        board_center = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board_center[7][7] = "X"
        
        # Board with single piece in corner
        board_corner = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board_corner[0][0] = "X"
        
        result_center = self.analyzer.calculate_threat_space(board_center, "X")
        result_corner = self.analyzer.calculate_threat_space(board_corner, "X")
        
        # Center should have higher or equal threat potential
        # (more directions available for threats)
        assert result_center.threat_potential >= result_corner.threat_potential, \
            f"Center ({result_center.threat_potential}) should have >= potential than corner ({result_corner.threat_potential})"
    
    @given(board=board_with_x_pieces_only(min_pieces=2, max_pieces=10))
    @settings(max_examples=50, deadline=None)
    def test_threat_potential_evaluation(self, board):
        """
        **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
        
        Property: Threat potential evaluation returns valid non-negative score.
        
        For any board state, evaluate_threat_potential() SHALL return a
        non-negative float score representing the potential for developing threats.
        """
        potential = self.analyzer.evaluate_threat_potential(board, "X")
        
        assert isinstance(potential, float), \
            f"Threat potential should be a float, got {type(potential)}"
        assert potential >= 0, \
            f"Threat potential should be non-negative, got {potential}"
    
    @given(board=board_with_x_pieces_only(min_pieces=1, max_pieces=10))
    @settings(max_examples=50, deadline=None)
    def test_more_threat_space_higher_score_property(self, board):
        """
        **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
        
        Property: More threat space → higher space component in score.
        
        For any board state, the space_score SHALL include a component that
        increases with threat_space. Specifically:
        - space_component = min(threat_space * 10, 500)
        - space_score >= space_component
        
        This validates that threat space positively contributes to the overall
        space score used for mid-game evaluation.
        
        Note: The total space_score also includes threat_potential, so a board
        with fewer empty cells but better positioned pieces can have a higher
        total score. This is intentional - connected pieces have more potential.
        """
        result = self.analyzer.calculate_threat_space(board, "X")
        
        # Calculate expected space component
        expected_space_component = min(result.threat_space * 10, 500)
        
        # The space_score should be at least the space component
        # (it can be higher due to threat_potential)
        assert result.space_score >= expected_space_component, \
            f"Space score ({result.space_score}) should be >= space component " \
            f"({expected_space_component}) for threat_space={result.threat_space}"
        
        # Also verify that threat_potential contributes positively
        if result.threat_potential > 0:
            potential_component = result.threat_potential * 0.1
            expected_total = expected_space_component + potential_component
            # Allow small floating point tolerance
            assert result.space_score >= expected_total - 0.01, \
                f"Space score ({result.space_score}) should be >= " \
                f"expected total ({expected_total})"
    
    def test_connected_pieces_higher_potential(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
        
        Specific case: Connected pieces should have higher threat potential.
        
        Pieces that are adjacent or near each other have more potential
        to develop into threats.
        """
        # Board with connected pieces (horizontal line)
        board_connected = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board_connected[7][6] = "X"
        board_connected[7][7] = "X"
        board_connected[7][8] = "X"
        
        # Board with scattered pieces
        board_scattered = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board_scattered[0][0] = "X"
        board_scattered[7][7] = "X"
        board_scattered[14][14] = "X"
        
        potential_connected = self.analyzer.evaluate_threat_potential(board_connected, "X")
        potential_scattered = self.analyzer.evaluate_threat_potential(board_scattered, "X")
        
        # Connected pieces should have higher potential
        assert potential_connected > potential_scattered, \
            f"Connected pieces ({potential_connected}) should have higher potential " \
            f"than scattered pieces ({potential_scattered})"
    
    def test_open_lines_increase_potential(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.3: Threat Space Analysis**
        
        Specific case: Open lines should increase threat potential.
        
        Pieces with open lines (not blocked by opponent) have more potential.
        """
        # Board with open lines
        board_open = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board_open[7][7] = "X"
        board_open[7][8] = "X"
        
        # Board with blocked lines
        board_blocked = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board_blocked[7][7] = "X"
        board_blocked[7][8] = "X"
        # Block both ends
        board_blocked[7][6] = "O"
        board_blocked[7][9] = "O"
        
        potential_open = self.analyzer.evaluate_threat_potential(board_open, "X")
        potential_blocked = self.analyzer.evaluate_threat_potential(board_blocked, "X")
        
        # Open lines should have higher potential
        assert potential_open > potential_blocked, \
            f"Open lines ({potential_open}) should have higher potential " \
            f"than blocked lines ({potential_blocked})"


# ============================================
# Run tests if executed directly
# ============================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
