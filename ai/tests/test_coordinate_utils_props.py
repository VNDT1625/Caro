"""
Property-Based Tests for Coordinate Utilities

**Feature: gomoku-basic-analysis, Properties 16-19: Coordinate Notation**
**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

This module contains property-based tests using Hypothesis to verify that
the coordinate conversion utilities work correctly.

Properties tested:
- Property 16: Coordinate Notation Format
- Property 17: Coordinate Conversion Round-Trip
- Property 18: Case-Insensitive Notation Input
- Property 19: Invalid Notation Rejection
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hypothesis import given, strategies as st, settings, assume
import pytest

from analysis.coordinate_utils import (
    notation_to_index,
    index_to_notation,
    is_valid_notation,
    is_valid_index,
    parse_move_sequence,
    format_move_sequence,
    get_adjacent_cells,
    manhattan_distance,
    chebyshev_distance,
    get_center_positions,
    is_center_position,
    is_edge_position,
    is_corner_position,
    CoordinateError,
)
from analysis.types import BOARD_SIZE


# ============================================
# Custom Strategies
# ============================================

@st.composite
def valid_notation(draw):
    """Generate a valid notation string (A1-O15)."""
    col = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    row = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    col_letter = chr(ord('A') + col)
    row_number = row + 1
    return f"{col_letter}{row_number}"


@st.composite
def valid_notation_any_case(draw):
    """Generate a valid notation string with random case."""
    col = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    row = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    
    # Randomly choose upper or lower case
    use_upper = draw(st.booleans())
    col_letter = chr(ord('A' if use_upper else 'a') + col)
    row_number = row + 1
    
    return f"{col_letter}{row_number}"


@st.composite
def valid_index(draw):
    """Generate a valid board index (row, col)."""
    row = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    col = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    return (row, col)


@st.composite
def invalid_notation(draw):
    """Generate an invalid notation string."""
    invalid_type = draw(st.sampled_from([
        "out_of_range_col",
        "out_of_range_row",
        "invalid_format",
        "empty",
        "numbers_only",
        "letters_only",
    ]))
    
    if invalid_type == "out_of_range_col":
        # Column beyond O (P, Q, etc.)
        col_letter = draw(st.sampled_from(['P', 'Q', 'R', 'Z']))
        row_number = draw(st.integers(min_value=1, max_value=15))
        return f"{col_letter}{row_number}"
    
    elif invalid_type == "out_of_range_row":
        # Row beyond 15 (16, 17, etc.) or 0
        col_letter = draw(st.sampled_from(['A', 'H', 'O']))
        row_number = draw(st.sampled_from([0, 16, 17, 99]))
        return f"{col_letter}{row_number}"
    
    elif invalid_type == "invalid_format":
        # Random invalid format
        return draw(st.sampled_from([
            "1A", "AA", "11", "A", "1", "A-1", "A.1", "A 1"
        ]))
    
    elif invalid_type == "empty":
        return draw(st.sampled_from(["", "   ", None]))
    
    elif invalid_type == "numbers_only":
        return draw(st.from_regex(r'^\d{1,3}$', fullmatch=True))
    
    else:  # letters_only
        return draw(st.from_regex(r'^[A-Za-z]{2,3}$', fullmatch=True))


# ============================================
# Property Tests
# ============================================

class TestCoordinateNotationProperties:
    """
    Property-based tests for coordinate notation.
    
    **Feature: gomoku-basic-analysis, Properties 16-19**
    **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
    """
    
    @given(notation=valid_notation())
    @settings(max_examples=100)
    def test_property_16_notation_format(self, notation):
        """
        **Property 16: Coordinate Notation Format**
        **Validates: Requirement 8.1**
        
        Valid notations should be in format [A-O][1-15].
        """
        # Should not raise
        row, col = notation_to_index(notation)
        
        # Result should be valid indices
        assert 0 <= row < BOARD_SIZE, f"Row {row} out of bounds"
        assert 0 <= col < BOARD_SIZE, f"Col {col} out of bounds"
        
        # Notation should match expected format
        assert len(notation) >= 2
        assert notation[0].upper() in "ABCDEFGHIJKLMNO"
        assert notation[1:].isdigit()
    
    @given(idx=valid_index())
    @settings(max_examples=100)
    def test_property_17_round_trip_index_to_notation(self, idx):
        """
        **Property 17: Coordinate Conversion Round-Trip**
        **Validates: Requirement 8.4**
        
        Converting index -> notation -> index should return original index.
        """
        row, col = idx
        
        # Convert to notation
        notation = index_to_notation(row, col)
        
        # Convert back to index
        result_row, result_col = notation_to_index(notation)
        
        assert (result_row, result_col) == (row, col), \
            f"Round-trip failed: ({row}, {col}) -> {notation} -> ({result_row}, {result_col})"
    
    @given(notation=valid_notation())
    @settings(max_examples=100)
    def test_property_17_round_trip_notation_to_index(self, notation):
        """
        **Property 17: Coordinate Conversion Round-Trip**
        **Validates: Requirement 8.4**
        
        Converting notation -> index -> notation should return equivalent notation.
        """
        # Convert to index
        row, col = notation_to_index(notation)
        
        # Convert back to notation
        result_notation = index_to_notation(row, col)
        
        # Should be equivalent (uppercase)
        assert result_notation == notation.upper(), \
            f"Round-trip failed: {notation} -> ({row}, {col}) -> {result_notation}"
    
    @given(notation=valid_notation_any_case())
    @settings(max_examples=100)
    def test_property_18_case_insensitive(self, notation):
        """
        **Property 18: Case-Insensitive Notation Input**
        **Validates: Requirement 8.2**
        
        Both uppercase and lowercase notations should work.
        """
        # Should not raise regardless of case
        row, col = notation_to_index(notation)
        
        # Compare with uppercase version
        upper_row, upper_col = notation_to_index(notation.upper())
        lower_row, lower_col = notation_to_index(notation.lower())
        
        assert (row, col) == (upper_row, upper_col) == (lower_row, lower_col), \
            f"Case sensitivity issue: {notation}"
    
    @given(notation=invalid_notation())
    @settings(max_examples=50)
    def test_property_19_invalid_notation_rejected(self, notation):
        """
        **Property 19: Invalid Notation Rejection**
        **Validates: Requirement 8.3**
        
        Invalid notations should raise CoordinateError.
        """
        # Skip None values (handled separately)
        if notation is None:
            with pytest.raises(CoordinateError):
                notation_to_index(notation)
            return
        
        # Should raise CoordinateError
        with pytest.raises(CoordinateError):
            notation_to_index(notation)
    
    def test_invalid_notation_none(self):
        """Invalid notation: None should raise CoordinateError."""
        with pytest.raises(CoordinateError):
            notation_to_index(None)
    
    def test_invalid_notation_empty(self):
        """Invalid notation: Empty string should raise CoordinateError."""
        with pytest.raises(CoordinateError):
            notation_to_index("")
    
    @given(row=st.integers(), col=st.integers())
    @settings(max_examples=100)
    def test_invalid_index_rejected(self, row, col):
        """
        **Property 19: Invalid Index Rejection**
        **Validates: Requirement 8.3**
        
        Invalid indices should raise CoordinateError.
        """
        # Skip valid indices
        if 0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE:
            return
        
        with pytest.raises(CoordinateError):
            index_to_notation(row, col)


class TestCoordinateValidationProperties:
    """Tests for validation functions."""
    
    @given(notation=valid_notation())
    @settings(max_examples=50)
    def test_is_valid_notation_true(self, notation):
        """Valid notations should return True."""
        assert is_valid_notation(notation) is True
    
    @given(notation=invalid_notation())
    @settings(max_examples=50)
    def test_is_valid_notation_false(self, notation):
        """Invalid notations should return False."""
        if notation is None:
            assert is_valid_notation(notation) is False
        else:
            assert is_valid_notation(notation) is False
    
    @given(idx=valid_index())
    @settings(max_examples=50)
    def test_is_valid_index_true(self, idx):
        """Valid indices should return True."""
        row, col = idx
        assert is_valid_index(row, col) is True
    
    @given(row=st.integers(), col=st.integers())
    @settings(max_examples=50)
    def test_is_valid_index_false(self, row, col):
        """Invalid indices should return False."""
        if 0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE:
            return  # Skip valid indices
        
        assert is_valid_index(row, col) is False


class TestMoveSequenceProperties:
    """Tests for move sequence parsing and formatting."""
    
    @given(moves=st.lists(valid_index(), min_size=0, max_size=10))
    @settings(max_examples=50)
    def test_format_parse_round_trip(self, moves):
        """Formatting then parsing should return original moves."""
        formatted = format_move_sequence(moves)
        parsed = parse_move_sequence(formatted)
        
        assert parsed == moves, \
            f"Round-trip failed: {moves} -> {formatted} -> {parsed}"
    
    def test_parse_space_separated(self):
        """Parse space-separated moves."""
        result = parse_move_sequence("A1 B2 C3")
        assert result == [(0, 0), (1, 1), (2, 2)]
    
    def test_parse_comma_separated(self):
        """Parse comma-separated moves."""
        result = parse_move_sequence("A1,B2,C3")
        assert result == [(0, 0), (1, 1), (2, 2)]
    
    def test_parse_mixed_separators(self):
        """Parse mixed separators."""
        result = parse_move_sequence("A1, B2 C3")
        assert result == [(0, 0), (1, 1), (2, 2)]
    
    def test_parse_empty(self):
        """Parse empty string."""
        assert parse_move_sequence("") == []
        assert parse_move_sequence("   ") == []


class TestAdjacentCellsProperties:
    """Tests for adjacent cell functions."""
    
    @given(idx=valid_index())
    @settings(max_examples=50)
    def test_adjacent_cells_valid(self, idx):
        """All adjacent cells should be valid positions."""
        row, col = idx
        adjacent = get_adjacent_cells(row, col)
        
        for adj_row, adj_col in adjacent:
            assert is_valid_index(adj_row, adj_col), \
                f"Invalid adjacent cell: ({adj_row}, {adj_col})"
    
    @given(idx=valid_index())
    @settings(max_examples=50)
    def test_adjacent_cells_count(self, idx):
        """Adjacent cells count should be correct based on position."""
        row, col = idx
        adjacent = get_adjacent_cells(row, col, include_diagonals=True)
        
        # Corner: 3 neighbors
        # Edge (non-corner): 5 neighbors
        # Interior: 8 neighbors
        if is_corner_position(row, col):
            assert len(adjacent) == 3
        elif is_edge_position(row, col):
            assert len(adjacent) == 5
        else:
            assert len(adjacent) == 8
    
    def test_center_has_8_neighbors(self):
        """Center position should have 8 neighbors."""
        center = BOARD_SIZE // 2
        adjacent = get_adjacent_cells(center, center)
        assert len(adjacent) == 8


class TestDistanceProperties:
    """Tests for distance functions."""
    
    @given(pos1=valid_index(), pos2=valid_index())
    @settings(max_examples=50)
    def test_manhattan_distance_non_negative(self, pos1, pos2):
        """Manhattan distance should be non-negative."""
        dist = manhattan_distance(pos1, pos2)
        assert dist >= 0
    
    @given(pos1=valid_index(), pos2=valid_index())
    @settings(max_examples=50)
    def test_chebyshev_distance_non_negative(self, pos1, pos2):
        """Chebyshev distance should be non-negative."""
        dist = chebyshev_distance(pos1, pos2)
        assert dist >= 0
    
    @given(pos=valid_index())
    @settings(max_examples=50)
    def test_distance_to_self_is_zero(self, pos):
        """Distance to self should be zero."""
        assert manhattan_distance(pos, pos) == 0
        assert chebyshev_distance(pos, pos) == 0
    
    @given(pos1=valid_index(), pos2=valid_index())
    @settings(max_examples=50)
    def test_chebyshev_leq_manhattan(self, pos1, pos2):
        """Chebyshev distance should be <= Manhattan distance."""
        manhattan = manhattan_distance(pos1, pos2)
        chebyshev = chebyshev_distance(pos1, pos2)
        assert chebyshev <= manhattan


class TestPositionClassificationProperties:
    """Tests for position classification functions."""
    
    def test_center_positions_count(self):
        """Should return 9 center positions."""
        centers = get_center_positions()
        assert len(centers) == 9
    
    def test_center_positions_valid(self):
        """All center positions should be valid."""
        centers = get_center_positions()
        for row, col in centers:
            assert is_valid_index(row, col)
    
    def test_corners_are_edges(self):
        """All corners should also be edges."""
        corners = [
            (0, 0), (0, BOARD_SIZE - 1),
            (BOARD_SIZE - 1, 0), (BOARD_SIZE - 1, BOARD_SIZE - 1)
        ]
        for row, col in corners:
            assert is_corner_position(row, col)
            assert is_edge_position(row, col)
    
    @given(idx=valid_index())
    @settings(max_examples=50)
    def test_center_and_edge_mutually_exclusive(self, idx):
        """Center (radius=0) and edge positions should be mutually exclusive."""
        row, col = idx
        is_center = is_center_position(row, col, radius=0)
        is_edge = is_edge_position(row, col)
        
        # Can't be both center (radius=0) and edge
        if is_center:
            assert not is_edge


# ============================================
# Specific Test Cases
# ============================================

class TestSpecificCases:
    """Specific test cases for edge conditions."""
    
    def test_all_corners(self):
        """Test all corner notations."""
        corners = [
            ("A1", (0, 0)),
            ("A15", (14, 0)),
            ("O1", (0, 14)),
            ("O15", (14, 14)),
        ]
        for notation, expected in corners:
            assert notation_to_index(notation) == expected
            assert index_to_notation(*expected) == notation
    
    def test_center(self):
        """Test center notation."""
        center = BOARD_SIZE // 2
        notation = index_to_notation(center, center)
        assert notation == "H8"
        assert notation_to_index("H8") == (7, 7)
    
    def test_all_columns(self):
        """Test all column letters."""
        for i, letter in enumerate("ABCDEFGHIJKLMNO"):
            notation = f"{letter}1"
            row, col = notation_to_index(notation)
            assert col == i
            assert row == 0
    
    def test_all_rows(self):
        """Test all row numbers."""
        for i in range(1, 16):
            notation = f"A{i}"
            row, col = notation_to_index(notation)
            assert row == i - 1
            assert col == 0


# ============================================
# Run tests if executed directly
# ============================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
"""
Property-Based Tests for Coordinate Utilities

**Feature: gomoku-basic-analysis, Properties 16-19: Coordinate Notation**
**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

Properties tested:
- Property 16: Coordinate Notation Format (A1-O15)
- Property 17: Coordinate Conversion Round-Trip
- Property 18: Case-Insensitive Notation Input
- Property 19: Invalid Notation Rejection
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hypothesis import given, strategies as st, settings, assume
import pytest

from analysis.coordinate_utils import (
    notation_to_index,
    index_to_notation,
    is_valid_notation,
    is_valid_index,
    parse_move_list,
    format_move_list,
    get_adjacent_positions,
    get_line_positions,
    distance,
    manhattan_distance,
    is_center_region,
    is_edge,
    is_corner,
    CoordinateError,
    BOARD_SIZE,
    COLUMNS,
)


# ============================================
# Custom Strategies
# ============================================

@st.composite
def valid_notation(draw):
    """Generate a valid notation string (A1-O15)."""
    col = draw(st.sampled_from(list(COLUMNS)))
    row = draw(st.integers(min_value=1, max_value=BOARD_SIZE))
    return f"{col}{row}"


@st.composite
def valid_index(draw):
    """Generate valid (row, col) indices."""
    row = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    col = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    return (row, col)


@st.composite
def invalid_notation(draw):
    """Generate an invalid notation string."""
    invalid_type = draw(st.sampled_from([
        "out_of_range_col",
        "out_of_range_row",
        "invalid_format",
        "empty",
        "wrong_order",
    ]))
    
    if invalid_type == "out_of_range_col":
        # Column outside A-O
        col = draw(st.sampled_from(["P", "Q", "Z", "0", "1"]))
        row = draw(st.integers(min_value=1, max_value=15))
        return f"{col}{row}"
    elif invalid_type == "out_of_range_row":
        # Row outside 1-15
        col = draw(st.sampled_from(list(COLUMNS)))
        row = draw(st.sampled_from([0, 16, 20, -1, 100]))
        return f"{col}{row}"
    elif invalid_type == "invalid_format":
        # Random invalid format
        return draw(st.sampled_from(["", "1A", "AA", "11", "A", "1", "A1B", "H8H"]))
    elif invalid_type == "empty":
        return ""
    else:  # wrong_order
        row = draw(st.integers(min_value=1, max_value=15))
        col = draw(st.sampled_from(list(COLUMNS)))
        return f"{row}{col}"


# ============================================
# Property Tests
# ============================================

class TestCoordinateNotationProperties:
    """
    Property-based tests for coordinate notation.
    
    **Feature: gomoku-basic-analysis, Properties 16-19**
    **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
    """
    
    @given(notation=valid_notation())
    @settings(max_examples=100)
    def test_property_16_notation_format(self, notation):
        """
        **Property 16: Coordinate Notation Format**
        
        All valid notations (A1-O15) should be parseable and return
        valid indices within board bounds.
        
        Validates: Requirement 8.1
        """
        row, col = notation_to_index(notation)
        
        # Indices must be within board bounds
        assert 0 <= row < BOARD_SIZE, f"Row {row} out of bounds"
        assert 0 <= col < BOARD_SIZE, f"Col {col} out of bounds"
        
        # Verify the notation format is correct
        assert is_valid_notation(notation)
    
    @given(row=st.integers(min_value=0, max_value=BOARD_SIZE - 1),
           col=st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    @settings(max_examples=100)
    def test_property_17_round_trip_conversion(self, row, col):
        """
        **Property 17: Coordinate Conversion Round-Trip**
        
        Converting index -> notation -> index should return the original index.
        Converting notation -> index -> notation should return equivalent notation.
        
        Validates: Requirement 8.4
        """
        # Index -> Notation -> Index
        notation = index_to_notation(row, col)
        recovered_row, recovered_col = notation_to_index(notation)
        
        assert recovered_row == row, f"Row mismatch: {row} -> {notation} -> {recovered_row}"
        assert recovered_col == col, f"Col mismatch: {col} -> {notation} -> {recovered_col}"
    
    @given(notation=valid_notation())
    @settings(max_examples=100)
    def test_property_17_notation_round_trip(self, notation):
        """
        **Property 17: Coordinate Conversion Round-Trip (notation first)**
        
        Converting notation -> index -> notation should return equivalent notation.
        
        Validates: Requirement 8.4
        """
        row, col = notation_to_index(notation)
        recovered_notation = index_to_notation(row, col)
        
        # Notations should be equivalent (case-insensitive)
        assert recovered_notation.upper() == notation.upper(), \
            f"Notation mismatch: {notation} -> ({row}, {col}) -> {recovered_notation}"
    
    @given(notation=valid_notation())
    @settings(max_examples=100)
    def test_property_18_case_insensitive(self, notation):
        """
        **Property 18: Case-Insensitive Notation Input**
        
        Both uppercase and lowercase notations should parse to the same indices.
        
        Validates: Requirement 8.2
        """
        upper_row, upper_col = notation_to_index(notation.upper())
        lower_row, lower_col = notation_to_index(notation.lower())
        
        assert upper_row == lower_row, f"Row differs for case: {notation}"
        assert upper_col == lower_col, f"Col differs for case: {notation}"
        
        # Mixed case should also work
        if len(notation) >= 2:
            mixed = notation[0].lower() + notation[1:].upper()
            mixed_row, mixed_col = notation_to_index(mixed)
            assert mixed_row == upper_row
            assert mixed_col == upper_col
    
    @given(notation=invalid_notation())
    @settings(max_examples=50)
    def test_property_19_invalid_notation_rejection(self, notation):
        """
        **Property 19: Invalid Notation Rejection**
        
        Invalid notations should raise CoordinateError.
        
        Validates: Requirement 8.3
        """
        with pytest.raises(CoordinateError):
            notation_to_index(notation)
        
        # is_valid_notation should return False
        assert not is_valid_notation(notation), \
            f"Invalid notation {notation!r} was accepted"
    
    def test_invalid_row_out_of_bounds(self):
        """Test that row numbers outside 1-15 are rejected."""
        with pytest.raises(CoordinateError):
            notation_to_index("A0")
        with pytest.raises(CoordinateError):
            notation_to_index("A16")
        with pytest.raises(CoordinateError):
            notation_to_index("H20")
    
    def test_invalid_column_out_of_bounds(self):
        """Test that columns outside A-O are rejected."""
        with pytest.raises(CoordinateError):
            notation_to_index("P1")
        with pytest.raises(CoordinateError):
            notation_to_index("Z8")
    
    def test_invalid_index_out_of_bounds(self):
        """Test that indices outside 0-14 are rejected."""
        with pytest.raises(CoordinateError):
            index_to_notation(-1, 0)
        with pytest.raises(CoordinateError):
            index_to_notation(0, -1)
        with pytest.raises(CoordinateError):
            index_to_notation(15, 0)
        with pytest.raises(CoordinateError):
            index_to_notation(0, 15)


class TestCoordinateUtilityFunctions:
    """Tests for utility functions in coordinate_utils."""
    
    @given(indices=valid_index())
    @settings(max_examples=50)
    def test_is_valid_index(self, indices):
        """Valid indices should be recognized as valid."""
        row, col = indices
        assert is_valid_index(row, col)
    
    def test_is_valid_index_invalid(self):
        """Invalid indices should be recognized as invalid."""
        assert not is_valid_index(-1, 0)
        assert not is_valid_index(0, -1)
        assert not is_valid_index(15, 0)
        assert not is_valid_index(0, 15)
        assert not is_valid_index("a", 0)
        assert not is_valid_index(0, "b")
    
    def test_parse_move_list(self):
        """Test parsing move list strings."""
        # Space-separated
        moves = parse_move_list("H8 H9 H10")
        assert len(moves) == 3
        assert moves[0] == (7, 7)  # H8
        
        # Comma-separated
        moves = parse_move_list("A1, B2, C3")
        assert len(moves) == 3
        assert moves[0] == (0, 0)  # A1
        
        # Empty
        assert parse_move_list("") == []
        assert parse_move_list(None) == []
    
    def test_format_move_list(self):
        """Test formatting move list to string."""
        # (row, col) -> notation: row+1 for number, COLUMNS[col] for letter
        # (7, 7) = H8, (8, 7) = H9, (9, 7) = H10 (same column, different rows)
        moves = [(7, 7), (8, 7), (9, 7)]
        result = format_move_list(moves)
        assert result == "H8 H9 H10"
        
        # Empty
        assert format_move_list([]) == ""
    
    @given(indices=valid_index())
    @settings(max_examples=50)
    def test_get_adjacent_positions(self, indices):
        """Adjacent positions should all be valid and within 1 step."""
        row, col = indices
        adjacent = get_adjacent_positions(row, col)
        
        for adj_row, adj_col in adjacent:
            # All adjacent positions should be valid
            assert is_valid_index(adj_row, adj_col)
            # Distance should be exactly 1
            assert distance((row, col), (adj_row, adj_col)) == 1
    
    def test_get_adjacent_positions_center(self):
        """Center position should have 8 adjacent positions."""
        adjacent = get_adjacent_positions(7, 7)
        assert len(adjacent) == 8
    
    def test_get_adjacent_positions_corner(self):
        """Corner position should have 3 adjacent positions."""
        adjacent = get_adjacent_positions(0, 0)
        assert len(adjacent) == 3
    
    def test_get_adjacent_positions_edge(self):
        """Edge position (not corner) should have 5 adjacent positions."""
        adjacent = get_adjacent_positions(0, 7)  # Top edge, middle
        assert len(adjacent) == 5
    
    def test_get_line_positions(self):
        """Test getting positions along a line."""
        # Horizontal from H8
        positions = get_line_positions(7, 7, "horizontal", 5)
        assert len(positions) == 5
        assert positions[0] == (7, 7)
        assert positions[4] == (7, 11)
        
        # Vertical from H8
        positions = get_line_positions(7, 7, "vertical", 5)
        assert len(positions) == 5
        assert positions[0] == (7, 7)
        assert positions[4] == (11, 7)
    
    def test_get_line_positions_edge_truncation(self):
        """Line positions should stop at board edge."""
        # From corner, only 1 position in diagonal_up direction
        positions = get_line_positions(0, 0, "diagonal_up", 5)
        assert len(positions) == 1  # Only starting position is valid
    
    @given(pos1=valid_index(), pos2=valid_index())
    @settings(max_examples=50)
    def test_distance_properties(self, pos1, pos2):
        """Distance should be non-negative and symmetric."""
        d = distance(pos1, pos2)
        
        # Non-negative
        assert d >= 0
        
        # Symmetric
        assert d == distance(pos2, pos1)
        
        # Zero iff same position
        if pos1 == pos2:
            assert d == 0
        else:
            assert d > 0
    
    @given(pos1=valid_index(), pos2=valid_index())
    @settings(max_examples=50)
    def test_manhattan_distance_properties(self, pos1, pos2):
        """Manhattan distance should be non-negative and symmetric."""
        d = manhattan_distance(pos1, pos2)
        
        # Non-negative
        assert d >= 0
        
        # Symmetric
        assert d == manhattan_distance(pos2, pos1)
        
        # Zero iff same position
        if pos1 == pos2:
            assert d == 0
        else:
            assert d > 0
        
        # Manhattan >= Chebyshev
        assert d >= distance(pos1, pos2)
    
    def test_is_center_region(self):
        """Test center region detection."""
        # Center (7, 7) should be in center region
        assert is_center_region(7, 7)
        
        # Corners should not be in center region (with default radius 3)
        assert not is_center_region(0, 0)
        assert not is_center_region(14, 14)
    
    def test_is_edge(self):
        """Test edge detection."""
        # Edges
        assert is_edge(0, 7)
        assert is_edge(14, 7)
        assert is_edge(7, 0)
        assert is_edge(7, 14)
        
        # Center is not edge
        assert not is_edge(7, 7)
    
    def test_is_corner(self):
        """Test corner detection."""
        # Corners
        assert is_corner(0, 0)
        assert is_corner(0, 14)
        assert is_corner(14, 0)
        assert is_corner(14, 14)
        
        # Edges (not corners)
        assert not is_corner(0, 7)
        
        # Center
        assert not is_corner(7, 7)


# ============================================
# Run tests if executed directly
# ============================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
