"""
Property-Based Tests for Board Validation

**Feature: gomoku-basic-analysis, Property 25: Board State Validation**
**Feature: gomoku-basic-analysis, Property 26: Edge Case - Insufficient Moves**
**Feature: gomoku-basic-analysis, Property 27: Edge Case - Board Edge Patterns**
**Feature: gomoku-basic-analysis, Property 30: Pattern Priority Ordering**
**Validates: Requirements 12.1, 12.2, 12.5, 13.1, 13.2, 15.1, 15.2**

This module contains property-based tests using Hypothesis to verify that
the board validation utilities correctly validate board states.
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional
import pytest

from analysis.board_validation import (
    BoardValidator,
    ValidationResult,
    ValidationErrorCode,
    PatternPriorityManager,
    EdgeCaseHandler,
    PATTERN_PRIORITY,
    MIN_MOVES_FOR_ANALYSIS,
    VALID_CELL_VALUES,
    validate_board,
    validate_moves,
    check_sufficient_moves,
    create_empty_board,
    apply_moves_to_board,
)
from analysis.types import (
    Move,
    ThreatType,
    ThreatPosition,
    BOARD_SIZE,
)


# ============================================
# Custom Strategies for Board Generation
# ============================================

@st.composite
def valid_board(draw):
    """Generate a valid 15x15 board with random pieces."""
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    num_pieces = draw(st.integers(min_value=0, max_value=100))
    
    positions = draw(st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=BOARD_SIZE - 1),
            st.integers(min_value=0, max_value=BOARD_SIZE - 1)
        ),
        min_size=num_pieces,
        max_size=num_pieces,
        unique=True
    ))
    
    for i, (x, y) in enumerate(positions):
        player = "X" if i % 2 == 0 else "O"
        board[x][y] = player
    
    return board


@st.composite
def invalid_board_wrong_size(draw):
    """Generate a board with wrong dimensions."""
    rows = draw(st.integers(min_value=1, max_value=20).filter(lambda x: x != BOARD_SIZE))
    cols = draw(st.integers(min_value=1, max_value=20))
    return [[None for _ in range(cols)] for _ in range(rows)]


@st.composite
def invalid_board_wrong_values(draw):
    """Generate a board with invalid cell values."""
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    invalid_value = draw(st.text(min_size=1, max_size=5).filter(
        lambda v: v not in ["X", "O", None, ""]
    ))
    board[x][y] = invalid_value
    return board, (x, y), invalid_value


@st.composite
def valid_moves(draw, min_moves=0, max_moves=50):
    """Generate a valid sequence of moves without overlaps."""
    num_moves = draw(st.integers(min_value=min_moves, max_value=max_moves))
    positions = draw(st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=BOARD_SIZE - 1),
            st.integers(min_value=0, max_value=BOARD_SIZE - 1)
        ),
        min_size=num_moves,
        max_size=num_moves,
        unique=True
    ))
    
    moves = []
    for i, (x, y) in enumerate(positions):
        player = "X" if i % 2 == 0 else "O"
        moves.append(Move(x=x, y=y, player=player, move_number=i + 1))
    
    return moves


@st.composite
def overlapping_moves(draw):
    """Generate moves with at least one overlap."""
    num_moves = draw(st.integers(min_value=3, max_value=20))
    positions = draw(st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=BOARD_SIZE - 1),
            st.integers(min_value=0, max_value=BOARD_SIZE - 1)
        ),
        min_size=num_moves - 1,
        max_size=num_moves - 1,
        unique=True
    ))
    
    # Add a duplicate position
    overlap_idx = draw(st.integers(min_value=0, max_value=len(positions) - 1))
    overlap_pos = positions[overlap_idx]
    insert_idx = draw(st.integers(min_value=overlap_idx + 1, max_value=len(positions)))
    positions.insert(insert_idx, overlap_pos)
    
    moves = []
    for i, (x, y) in enumerate(positions):
        player = "X" if i % 2 == 0 else "O"
        moves.append(Move(x=x, y=y, player=player, move_number=i + 1))
    
    return moves, overlap_pos, overlap_idx + 1, insert_idx + 1


# ============================================
# Property 25: Board State Validation Tests
# ============================================

class TestBoardValidationProperty25:
    """
    Property-based tests for board state validation.
    
    **Feature: gomoku-basic-analysis, Property 25: Board State Validation**
    **Validates: Requirements 12.1, 12.2, 12.5**
    """
    
    def setup_method(self):
        """Set up test fixtures."""
        self.validator = BoardValidator()
    
    @given(board=valid_board())
    @settings(max_examples=100)
    def test_valid_board_passes_validation(self, board):
        """
        **Feature: gomoku-basic-analysis, Property 25: Board State Validation**
        
        Property: *For any* valid 15x15 board with valid cell values,
        validation SHALL return is_valid=True.
        """
        result = self.validator.validate_board(board)
        assert result.is_valid, f"Valid board should pass validation: {result.error_message}"
    
    @given(board_data=invalid_board_wrong_size())
    @settings(max_examples=50)
    def test_wrong_size_board_fails_validation(self, board_data):
        """
        **Feature: gomoku-basic-analysis, Property 25: Board State Validation**
        
        Property: *For any* board with wrong dimensions,
        validation SHALL return is_valid=False with INVALID_GRID_SIZE error.
        """
        result = self.validator.validate_board(board_data)
        assert not result.is_valid, "Wrong size board should fail validation"
        assert result.error_code == ValidationErrorCode.INVALID_GRID_SIZE
    
    @given(data=invalid_board_wrong_values())
    @settings(max_examples=50)
    def test_invalid_cell_values_fail_validation(self, data):
        """
        **Feature: gomoku-basic-analysis, Property 25: Board State Validation**
        
        Property: *For any* board with invalid cell values (not None, X, or O),
        validation SHALL return is_valid=False with INVALID_CELL_VALUE error.
        """
        board, pos, invalid_value = data
        result = self.validator.validate_board(board)
        assert not result.is_valid, f"Board with invalid value '{invalid_value}' should fail"
        assert result.error_code == ValidationErrorCode.INVALID_CELL_VALUE
        assert result.details["row"] == pos[0]
        assert result.details["col"] == pos[1]
    
    @given(moves=valid_moves(min_moves=0, max_moves=50))
    @settings(max_examples=100)
    def test_valid_moves_pass_validation(self, moves):
        """
        **Feature: gomoku-basic-analysis, Property 25: Board State Validation**
        
        Property: *For any* sequence of moves without overlaps,
        validation SHALL return is_valid=True.
        """
        result = self.validator.validate_moves(moves)
        assert result.is_valid, f"Valid moves should pass: {result.error_message}"
    
    @given(data=overlapping_moves())
    @settings(max_examples=50)
    def test_overlapping_moves_fail_validation(self, data):
        """
        **Feature: gomoku-basic-analysis, Property 25: Board State Validation**
        
        Property: *For any* sequence of moves with overlapping positions,
        validation SHALL return is_valid=False with OVERLAPPING_STONES error.
        """
        moves, overlap_pos, first_idx, second_idx = data
        result = self.validator.validate_moves(moves)
        assert not result.is_valid, "Overlapping moves should fail validation"
        assert result.error_code == ValidationErrorCode.OVERLAPPING_STONES
    
    def test_empty_board_is_valid(self):
        """
        **Feature: gomoku-basic-analysis, Property 25: Board State Validation**
        
        Edge case: Empty board should be valid.
        """
        board = create_empty_board()
        result = self.validator.validate_board(board)
        assert result.is_valid, "Empty board should be valid"
    
    def test_non_list_board_fails(self):
        """
        **Feature: gomoku-basic-analysis, Property 25: Board State Validation**
        
        Edge case: Non-list board should fail validation.
        """
        result = self.validator.validate_board("not a board")
        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.INVALID_GRID_SIZE


# ============================================
# Property 26: Edge Case - Insufficient Moves Tests
# ============================================

class TestInsufficientMovesProperty26:
    """
    Property-based tests for insufficient moves handling.
    
    **Feature: gomoku-basic-analysis, Property 26: Edge Case - Insufficient Moves**
    **Validates: Requirements 13.1**
    """
    
    def setup_method(self):
        """Set up test fixtures."""
        self.validator = BoardValidator()
        self.edge_handler = EdgeCaseHandler()
    
    @given(moves=valid_moves(min_moves=0, max_moves=MIN_MOVES_FOR_ANALYSIS - 1))
    @settings(max_examples=50)
    def test_insufficient_moves_detected(self, moves):
        """
        **Feature: gomoku-basic-analysis, Property 26: Edge Case - Insufficient Moves**
        
        Property: *For any* game with less than 5 moves,
        the system SHALL return an appropriate message instead of analysis.
        """
        result = self.validator.check_sufficient_moves(moves)
        assert not result.is_valid, f"Should detect insufficient moves: {len(moves)}"
        assert result.error_code == ValidationErrorCode.INSUFFICIENT_MOVES
        assert result.details["move_count"] == len(moves)
        assert result.details["minimum_required"] == MIN_MOVES_FOR_ANALYSIS
    
    @given(moves=valid_moves(min_moves=MIN_MOVES_FOR_ANALYSIS, max_moves=100))
    @settings(max_examples=50)
    def test_sufficient_moves_pass(self, moves):
        """
        **Feature: gomoku-basic-analysis, Property 26: Edge Case - Insufficient Moves**
        
        Property: *For any* game with 5 or more moves,
        the system SHALL allow analysis.
        """
        result = self.validator.check_sufficient_moves(moves)
        assert result.is_valid, f"Should allow analysis with {len(moves)} moves"
    
    def test_zero_moves_returns_message(self):
        """
        **Feature: gomoku-basic-analysis, Property 26: Edge Case - Insufficient Moves**
        
        Edge case: Zero moves should return appropriate message.
        """
        result = self.edge_handler.handle_insufficient_moves([])
        assert not result["can_analyze"]
        assert result["move_count"] == 0
        assert "message" in result
    
    def test_exactly_minimum_moves_passes(self):
        """
        **Feature: gomoku-basic-analysis, Property 26: Edge Case - Insufficient Moves**
        
        Edge case: Exactly MIN_MOVES_FOR_ANALYSIS moves should pass.
        """
        moves = [
            Move(x=7, y=7, player="X", move_number=1),
            Move(x=7, y=8, player="O", move_number=2),
            Move(x=8, y=7, player="X", move_number=3),
            Move(x=8, y=8, player="O", move_number=4),
            Move(x=9, y=7, player="X", move_number=5),
        ]
        result = self.validator.check_sufficient_moves(moves)
        assert result.is_valid


# ============================================
# Property 27: Edge Case - Board Edge Patterns Tests
# ============================================

class TestBoardEdgePatternsProperty27:
    """
    Property-based tests for board edge pattern handling.
    
    **Feature: gomoku-basic-analysis, Property 27: Edge Case - Board Edge Patterns**
    **Validates: Requirements 13.2**
    """
    
    def setup_method(self):
        """Set up test fixtures."""
        self.validator = BoardValidator()
        self.edge_handler = EdgeCaseHandler()
    
    @given(
        x=st.integers(min_value=0, max_value=BOARD_SIZE - 1),
        y=st.integers(min_value=0, max_value=BOARD_SIZE - 1)
    )
    @settings(max_examples=100)
    def test_edge_position_detection(self, x, y):
        """
        **Feature: gomoku-basic-analysis, Property 27: Edge Case - Board Edge Patterns**
        
        Property: *For any* position at board edge (row 0, row 14, col 0, col 14),
        the system SHALL correctly identify it as an edge position.
        """
        is_edge = self.validator.is_edge_position(x, y)
        expected_edge = (x == 0 or x == BOARD_SIZE - 1 or y == 0 or y == BOARD_SIZE - 1)
        assert is_edge == expected_edge, f"Position ({x}, {y}) edge detection incorrect"
    
    @given(
        x=st.integers(min_value=0, max_value=BOARD_SIZE - 1),
        y=st.integers(min_value=0, max_value=BOARD_SIZE - 1)
    )
    @settings(max_examples=100)
    def test_corner_position_detection(self, x, y):
        """
        **Feature: gomoku-basic-analysis, Property 27: Edge Case - Board Edge Patterns**
        
        Property: *For any* position at board corner,
        the system SHALL correctly identify it as a corner position.
        """
        is_corner = self.validator.is_corner_position(x, y)
        corners = [(0, 0), (0, BOARD_SIZE - 1), (BOARD_SIZE - 1, 0), (BOARD_SIZE - 1, BOARD_SIZE - 1)]
        expected_corner = (x, y) in corners
        assert is_corner == expected_corner, f"Position ({x}, {y}) corner detection incorrect"
    
    @given(
        x=st.integers(min_value=0, max_value=BOARD_SIZE - 1),
        y=st.integers(min_value=0, max_value=BOARD_SIZE - 1)
    )
    @settings(max_examples=100)
    def test_valid_neighbors_within_bounds(self, x, y):
        """
        **Feature: gomoku-basic-analysis, Property 27: Edge Case - Board Edge Patterns**
        
        Property: *For any* position, all returned neighbors SHALL be within board bounds.
        """
        neighbors = self.validator.get_valid_neighbors(x, y)
        for nx, ny in neighbors:
            assert 0 <= nx < BOARD_SIZE, f"Neighbor x={nx} out of bounds"
            assert 0 <= ny < BOARD_SIZE, f"Neighbor y={ny} out of bounds"
    
    @given(
        x=st.integers(min_value=1, max_value=BOARD_SIZE - 2),
        y=st.integers(min_value=1, max_value=BOARD_SIZE - 2)
    )
    @settings(max_examples=50)
    def test_center_position_has_8_neighbors(self, x, y):
        """
        **Feature: gomoku-basic-analysis, Property 27: Edge Case - Board Edge Patterns**
        
        Property: *For any* non-edge position, there SHALL be exactly 8 neighbors.
        """
        neighbors = self.validator.get_valid_neighbors(x, y)
        assert len(neighbors) == 8, f"Center position ({x}, {y}) should have 8 neighbors"
    
    def test_corner_has_3_neighbors(self):
        """
        **Feature: gomoku-basic-analysis, Property 27: Edge Case - Board Edge Patterns**
        
        Edge case: Corner positions should have exactly 3 neighbors.
        """
        corners = [(0, 0), (0, BOARD_SIZE - 1), (BOARD_SIZE - 1, 0), (BOARD_SIZE - 1, BOARD_SIZE - 1)]
        for x, y in corners:
            neighbors = self.validator.get_valid_neighbors(x, y)
            assert len(neighbors) == 3, f"Corner ({x}, {y}) should have 3 neighbors"
    
    def test_edge_non_corner_has_5_neighbors(self):
        """
        **Feature: gomoku-basic-analysis, Property 27: Edge Case - Board Edge Patterns**
        
        Edge case: Edge (non-corner) positions should have exactly 5 neighbors.
        """
        # Test middle of top edge
        neighbors = self.validator.get_valid_neighbors(0, 7)
        assert len(neighbors) == 5, "Top edge middle should have 5 neighbors"
        
        # Test middle of left edge
        neighbors = self.validator.get_valid_neighbors(7, 0)
        assert len(neighbors) == 5, "Left edge middle should have 5 neighbors"


# ============================================
# Property 30: Pattern Priority Ordering Tests
# ============================================

class TestPatternPriorityProperty30:
    """
    Property-based tests for pattern priority ordering.
    
    **Feature: gomoku-basic-analysis, Property 30: Pattern Priority Ordering**
    **Validates: Requirements 15.1, 15.2**
    """
    
    def setup_method(self):
        """Set up test fixtures."""
        self.priority_manager = PatternPriorityManager()
    
    def test_five_has_highest_priority(self):
        """
        **Feature: gomoku-basic-analysis, Property 30: Pattern Priority Ordering**
        
        Property: FIVE SHALL have the highest priority among all threat types.
        """
        five_priority = self.priority_manager.get_priority(ThreatType.FIVE)
        for threat_type in ThreatType:
            if threat_type != ThreatType.FIVE:
                other_priority = self.priority_manager.get_priority(threat_type)
                assert five_priority > other_priority, \
                    f"FIVE priority ({five_priority}) should be > {threat_type.value} ({other_priority})"
    
    def test_open_four_higher_than_closed_four(self):
        """
        **Feature: gomoku-basic-analysis, Property 30: Pattern Priority Ordering**
        
        Property: OPEN_FOUR SHALL have higher priority than CLOSED_FOUR (FOUR).
        """
        open_four = self.priority_manager.get_priority(ThreatType.OPEN_FOUR)
        closed_four = self.priority_manager.get_priority(ThreatType.FOUR)
        assert open_four > closed_four, \
            f"OPEN_FOUR ({open_four}) should be > FOUR ({closed_four})"
    
    def test_closed_four_higher_than_open_three(self):
        """
        **Feature: gomoku-basic-analysis, Property 30: Pattern Priority Ordering**
        
        Property: CLOSED_FOUR (FOUR) SHALL have higher priority than OPEN_THREE.
        """
        closed_four = self.priority_manager.get_priority(ThreatType.FOUR)
        open_three = self.priority_manager.get_priority(ThreatType.OPEN_THREE)
        assert closed_four > open_three, \
            f"FOUR ({closed_four}) should be > OPEN_THREE ({open_three})"
    
    def test_priority_order_complete(self):
        """
        **Feature: gomoku-basic-analysis, Property 30: Pattern Priority Ordering**
        
        Property: Priority order SHALL be FIVE > OPEN_FOUR > FORK > CLOSED_FOUR > OPEN_THREE.
        """
        five = self.priority_manager.get_priority(ThreatType.FIVE)
        open_four = self.priority_manager.get_priority(ThreatType.OPEN_FOUR)
        fork = self.priority_manager.fork_priority
        closed_four = self.priority_manager.get_priority(ThreatType.FOUR)
        open_three = self.priority_manager.get_priority(ThreatType.OPEN_THREE)
        
        assert five > open_four > fork > closed_four > open_three, \
            f"Priority order incorrect: FIVE({five}) > OPEN_FOUR({open_four}) > FORK({fork}) > FOUR({closed_four}) > OPEN_THREE({open_three})"
    
    @given(st.lists(
        st.sampled_from(list(ThreatType)),
        min_size=2,
        max_size=10
    ))
    @settings(max_examples=50)
    def test_sort_threats_maintains_priority_order(self, threat_types):
        """
        **Feature: gomoku-basic-analysis, Property 30: Pattern Priority Ordering**
        
        Property: *For any* list of threats, sorting SHALL maintain priority order
        (highest priority first).
        """
        # Create threat positions from types
        threats = [
            ThreatPosition(
                type=t,
                positions=[(7, 7), (7, 8)],  # Dummy positions
                direction="horizontal"
            )
            for t in threat_types
        ]
        
        sorted_threats = self.priority_manager.sort_threats_by_priority(threats)
        
        # Verify sorted order
        for i in range(len(sorted_threats) - 1):
            current_priority = self.priority_manager.get_priority(sorted_threats[i].type)
            next_priority = self.priority_manager.get_priority(sorted_threats[i + 1].type)
            assert current_priority >= next_priority, \
                f"Sort order incorrect: {sorted_threats[i].type} should come before {sorted_threats[i + 1].type}"
    
    @given(st.lists(
        st.sampled_from(list(ThreatType)),
        min_size=1,
        max_size=10
    ))
    @settings(max_examples=50)
    def test_get_highest_priority_returns_correct_threat(self, threat_types):
        """
        **Feature: gomoku-basic-analysis, Property 30: Pattern Priority Ordering**
        
        Property: *For any* list of threats, get_highest_priority_threat SHALL return
        the threat with the highest priority value.
        """
        threats = [
            ThreatPosition(
                type=t,
                positions=[(7, 7), (7, 8)],
                direction="horizontal"
            )
            for t in threat_types
        ]
        
        highest = self.priority_manager.get_highest_priority_threat(threats)
        
        assert highest is not None
        highest_priority = self.priority_manager.get_priority(highest.type)
        
        for threat in threats:
            threat_priority = self.priority_manager.get_priority(threat.type)
            assert highest_priority >= threat_priority, \
                f"Highest threat {highest.type} has lower priority than {threat.type}"
    
    def test_empty_threats_returns_none(self):
        """
        **Feature: gomoku-basic-analysis, Property 30: Pattern Priority Ordering**
        
        Edge case: Empty threat list should return None for highest priority.
        """
        highest = self.priority_manager.get_highest_priority_threat([])
        assert highest is None
    
    def test_compare_threats_returns_correct_sign(self):
        """
        **Feature: gomoku-basic-analysis, Property 30: Pattern Priority Ordering**
        
        Property: compare_threats SHALL return positive when first > second,
        negative when first < second, zero when equal.
        """
        # FIVE > OPEN_FOUR
        result = self.priority_manager.compare_threats(ThreatType.FIVE, ThreatType.OPEN_FOUR)
        assert result > 0, "FIVE should compare greater than OPEN_FOUR"
        
        # OPEN_THREE < FOUR
        result = self.priority_manager.compare_threats(ThreatType.OPEN_THREE, ThreatType.FOUR)
        assert result < 0, "OPEN_THREE should compare less than FOUR"
        
        # Same type
        result = self.priority_manager.compare_threats(ThreatType.FIVE, ThreatType.FIVE)
        assert result == 0, "Same types should compare equal"


# ============================================
# Run tests if executed directly
# ============================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
