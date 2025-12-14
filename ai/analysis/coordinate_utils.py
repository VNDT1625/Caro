"""
AI Match Analysis System - Coordinate Utilities

This module provides utilities for converting between coordinate notations
used in Gomoku/Caro games.

Requirements: 8.1, 8.2, 8.3, 8.4
- 8.1: Support standard notation (A1-O15)
- 8.2: Support case-insensitive input
- 8.3: Validate invalid notations
- 8.4: Round-trip conversion consistency
"""

from typing import Tuple, Optional
import re

from .types import BOARD_SIZE


class CoordinateError(Exception):
    """Exception raised for invalid coordinate operations."""
    pass


def notation_to_index(notation: str) -> Tuple[int, int]:
    """
    Convert algebraic notation to board indices.
    
    Standard Gomoku notation uses:
    - Letters A-O for columns (A=0, B=1, ..., O=14)
    - Numbers 1-15 for rows (1=0, 2=1, ..., 15=14)
    
    Examples:
        "A1" -> (0, 0)
        "H8" -> (7, 7)
        "O15" -> (14, 14)
        "a1" -> (0, 0)  # Case-insensitive
    
    Args:
        notation: Algebraic notation string (e.g., "A1", "H8", "O15")
        
    Returns:
        Tuple of (row, col) indices (0-indexed)
        
    Raises:
        CoordinateError: If notation is invalid
        
    Requirements: 8.1, 8.2, 8.3
    """
    if not notation or not isinstance(notation, str):
        raise CoordinateError(f"Invalid notation: {notation}")
    
    # Normalize to uppercase for case-insensitive handling (Req 8.2)
    notation = notation.strip().upper()
    
    # Validate format: letter followed by 1-2 digits
    pattern = r'^([A-O])(\d{1,2})$'
    match = re.match(pattern, notation)
    
    if not match:
        raise CoordinateError(f"Invalid notation format: {notation}. Expected format: A1-O15")
    
    col_letter = match.group(1)
    row_number = int(match.group(2))
    
    # Convert column letter to index (A=0, B=1, ..., O=14)
    col = ord(col_letter) - ord('A')
    
    # Convert row number to index (1=0, 2=1, ..., 15=14)
    row = row_number - 1
    
    # Validate bounds (Req 8.3)
    if not (0 <= col < BOARD_SIZE):
        raise CoordinateError(f"Column out of bounds: {col_letter}")
    
    if not (0 <= row < BOARD_SIZE):
        raise CoordinateError(f"Row out of bounds: {row_number}")
    
    return (row, col)


def index_to_notation(row: int, col: int) -> str:
    """
    Convert board indices to algebraic notation.
    
    Standard Gomoku notation uses:
    - Letters A-O for columns (0=A, 1=B, ..., 14=O)
    - Numbers 1-15 for rows (0=1, 1=2, ..., 14=15)
    
    Examples:
        (0, 0) -> "A1"
        (7, 7) -> "H8"
        (14, 14) -> "O15"
    
    Args:
        row: Row index (0-14)
        col: Column index (0-14)
        
    Returns:
        Algebraic notation string (e.g., "A1", "H8", "O15")
        
    Raises:
        CoordinateError: If indices are out of bounds
        
    Requirements: 8.1, 8.3
    """
    # Validate bounds (Req 8.3)
    if not isinstance(row, int) or not isinstance(col, int):
        raise CoordinateError(f"Invalid indices: row={row}, col={col}")
    
    if not (0 <= row < BOARD_SIZE):
        raise CoordinateError(f"Row index out of bounds: {row}")
    
    if not (0 <= col < BOARD_SIZE):
        raise CoordinateError(f"Column index out of bounds: {col}")
    
    # Convert column index to letter (0=A, 1=B, ..., 14=O)
    col_letter = chr(ord('A') + col)
    
    # Convert row index to number (0=1, 1=2, ..., 14=15)
    row_number = row + 1
    
    return f"{col_letter}{row_number}"


def is_valid_notation(notation: str) -> bool:
    """
    Check if a notation string is valid.
    
    Args:
        notation: Notation string to validate
        
    Returns:
        True if valid, False otherwise
        
    Requirements: 8.3
    """
    try:
        notation_to_index(notation)
        return True
    except CoordinateError:
        return False


def is_valid_index(row: int, col: int) -> bool:
    """
    Check if board indices are valid.
    
    Args:
        row: Row index
        col: Column index
        
    Returns:
        True if valid, False otherwise
        
    Requirements: 8.3
    """
    return (
        isinstance(row, int) and 
        isinstance(col, int) and
        0 <= row < BOARD_SIZE and 
        0 <= col < BOARD_SIZE
    )


def parse_move_sequence(moves_str: str) -> list:
    """
    Parse a sequence of moves from a string.
    
    Supports formats:
    - Space-separated: "A1 B2 C3"
    - Comma-separated: "A1, B2, C3"
    - Mixed: "A1,B2 C3"
    
    Args:
        moves_str: String containing move notations
        
    Returns:
        List of (row, col) tuples
        
    Raises:
        CoordinateError: If any notation is invalid
    """
    if not moves_str or not isinstance(moves_str, str):
        return []
    
    # Split by comma or space
    parts = re.split(r'[,\s]+', moves_str.strip())
    
    moves = []
    for part in parts:
        if part:  # Skip empty strings
            moves.append(notation_to_index(part))
    
    return moves


def format_move_sequence(moves: list) -> str:
    """
    Format a sequence of moves as a string.
    
    Args:
        moves: List of (row, col) tuples
        
    Returns:
        Space-separated notation string
        
    Raises:
        CoordinateError: If any index is invalid
    """
    notations = []
    for row, col in moves:
        notations.append(index_to_notation(row, col))
    
    return " ".join(notations)


def get_adjacent_cells(row: int, col: int, include_diagonals: bool = True) -> list:
    """
    Get all valid adjacent cells for a position.
    
    Args:
        row: Row index
        col: Column index
        include_diagonals: Whether to include diagonal neighbors
        
    Returns:
        List of (row, col) tuples for valid adjacent cells
    """
    if not is_valid_index(row, col):
        return []
    
    directions = [
        (-1, 0), (1, 0),   # Vertical
        (0, -1), (0, 1),   # Horizontal
    ]
    
    if include_diagonals:
        directions.extend([
            (-1, -1), (-1, 1),  # Upper diagonals
            (1, -1), (1, 1),    # Lower diagonals
        ])
    
    adjacent = []
    for dr, dc in directions:
        new_row, new_col = row + dr, col + dc
        if is_valid_index(new_row, new_col):
            adjacent.append((new_row, new_col))
    
    return adjacent


def manhattan_distance(pos1: Tuple[int, int], pos2: Tuple[int, int]) -> int:
    """
    Calculate Manhattan distance between two positions.
    
    Args:
        pos1: First position (row, col)
        pos2: Second position (row, col)
        
    Returns:
        Manhattan distance
    """
    return abs(pos1[0] - pos2[0]) + abs(pos1[1] - pos2[1])


def chebyshev_distance(pos1: Tuple[int, int], pos2: Tuple[int, int]) -> int:
    """
    Calculate Chebyshev distance (chessboard distance) between two positions.
    
    This is the minimum number of moves a king would need in chess.
    
    Args:
        pos1: First position (row, col)
        pos2: Second position (row, col)
        
    Returns:
        Chebyshev distance
    """
    return max(abs(pos1[0] - pos2[0]), abs(pos1[1] - pos2[1]))


def get_center_positions() -> list:
    """
    Get the center positions of the board.
    
    Returns the 9 center cells (3x3 area around the center).
    
    Returns:
        List of (row, col) tuples for center positions
    """
    center = BOARD_SIZE // 2
    positions = []
    
    for dr in [-1, 0, 1]:
        for dc in [-1, 0, 1]:
            positions.append((center + dr, center + dc))
    
    return positions


def is_center_position(row: int, col: int, radius: int = 2) -> bool:
    """
    Check if a position is near the center of the board.
    
    Args:
        row: Row index
        col: Column index
        radius: Distance from center to consider as "center area"
        
    Returns:
        True if position is within radius of center
    """
    center = BOARD_SIZE // 2
    return chebyshev_distance((row, col), (center, center)) <= radius


def is_edge_position(row: int, col: int) -> bool:
    """
    Check if a position is on the edge of the board.
    
    Args:
        row: Row index
        col: Column index
        
    Returns:
        True if position is on any edge
    """
    return row == 0 or row == BOARD_SIZE - 1 or col == 0 or col == BOARD_SIZE - 1


def is_corner_position(row: int, col: int) -> bool:
    """
    Check if a position is in a corner of the board.
    
    Args:
        row: Row index
        col: Column index
        
    Returns:
        True if position is a corner
    """
    corners = [
        (0, 0), (0, BOARD_SIZE - 1),
        (BOARD_SIZE - 1, 0), (BOARD_SIZE - 1, BOARD_SIZE - 1)
    ]
    return (row, col) in corners
"""
AI Match Analysis System - Coordinate Utilities

This module provides utilities for converting between coordinate notations
and array indices for the Gomoku board.

Requirements: 8.1, 8.2, 8.3, 8.4
- 8.1: Support standard notation (A1-O15)
- 8.2: Support case-insensitive input
- 8.3: Validate invalid notations
- 8.4: Round-trip conversion consistency
"""

from typing import Tuple, Optional
import re

# Board constants
BOARD_SIZE = 15
COLUMNS = "ABCDEFGHIJKLMNO"  # A-O for columns 0-14


class CoordinateError(Exception):
    """Exception raised for invalid coordinate operations."""
    pass


def notation_to_index(notation: str) -> Tuple[int, int]:
    """
    Convert algebraic notation (e.g., "H8") to array indices (row, col).
    
    The notation format is:
    - Column: A-O (case-insensitive)
    - Row: 1-15
    
    Example: "H8" -> (7, 7) (center of board)
    
    Args:
        notation: Algebraic notation string (e.g., "A1", "H8", "O15")
        
    Returns:
        Tuple of (row, col) indices (0-indexed)
        
    Raises:
        CoordinateError: If notation is invalid
        
    Requirements: 8.1, 8.2, 8.3
    """
    if not notation or not isinstance(notation, str):
        raise CoordinateError(f"Invalid notation: {notation}")
    
    # Normalize to uppercase for case-insensitive handling (Req 8.2)
    notation = notation.strip().upper()
    
    # Validate format: letter followed by 1-2 digits
    pattern = r'^([A-O])(\d{1,2})$'
    match = re.match(pattern, notation)
    
    if not match:
        raise CoordinateError(f"Invalid notation format: {notation}. Expected format: A1-O15")
    
    col_letter = match.group(1)
    row_number = int(match.group(2))
    
    # Validate row number (1-15)
    if row_number < 1 or row_number > BOARD_SIZE:
        raise CoordinateError(f"Invalid row number: {row_number}. Must be 1-{BOARD_SIZE}")
    
    # Convert to indices
    col = COLUMNS.index(col_letter)  # A=0, B=1, ..., O=14
    row = row_number - 1  # 1-indexed to 0-indexed
    
    return (row, col)


def index_to_notation(row: int, col: int) -> str:
    """
    Convert array indices (row, col) to algebraic notation (e.g., "H8").
    
    Args:
        row: Row index (0-14)
        col: Column index (0-14)
        
    Returns:
        Algebraic notation string (e.g., "A1", "H8", "O15")
        
    Raises:
        CoordinateError: If indices are out of bounds
        
    Requirements: 8.1, 8.4
    """
    # Validate indices
    if not isinstance(row, int) or not isinstance(col, int):
        raise CoordinateError(f"Invalid indices: row={row}, col={col}. Must be integers")
    
    if row < 0 or row >= BOARD_SIZE:
        raise CoordinateError(f"Invalid row index: {row}. Must be 0-{BOARD_SIZE - 1}")
    
    if col < 0 or col >= BOARD_SIZE:
        raise CoordinateError(f"Invalid column index: {col}. Must be 0-{BOARD_SIZE - 1}")
    
    # Convert to notation
    col_letter = COLUMNS[col]
    row_number = row + 1  # 0-indexed to 1-indexed
    
    return f"{col_letter}{row_number}"


def is_valid_notation(notation: str) -> bool:
    """
    Check if a notation string is valid.
    
    Args:
        notation: Algebraic notation string to validate
        
    Returns:
        True if valid, False otherwise
        
    Requirements: 8.3
    """
    try:
        notation_to_index(notation)
        return True
    except CoordinateError:
        return False


def is_valid_index(row: int, col: int) -> bool:
    """
    Check if array indices are valid for the board.
    
    Args:
        row: Row index
        col: Column index
        
    Returns:
        True if valid, False otherwise
    """
    return (
        isinstance(row, int) and 
        isinstance(col, int) and
        0 <= row < BOARD_SIZE and 
        0 <= col < BOARD_SIZE
    )


def parse_move_list(moves_str: str) -> list:
    """
    Parse a string of moves into a list of (row, col) tuples.
    
    Accepts various formats:
    - Space-separated: "H8 H9 H10"
    - Comma-separated: "H8, H9, H10"
    - Mixed: "H8,H9 H10"
    
    Args:
        moves_str: String containing move notations
        
    Returns:
        List of (row, col) tuples
        
    Raises:
        CoordinateError: If any notation is invalid
    """
    if not moves_str or not isinstance(moves_str, str):
        return []
    
    # Split by comma or space
    moves = re.split(r'[,\s]+', moves_str.strip())
    moves = [m for m in moves if m]  # Remove empty strings
    
    result = []
    for move in moves:
        result.append(notation_to_index(move))
    
    return result


def format_move_list(moves: list) -> str:
    """
    Format a list of (row, col) tuples as a space-separated notation string.
    
    Args:
        moves: List of (row, col) tuples
        
    Returns:
        Space-separated notation string (e.g., "H8 H9 H10")
        
    Raises:
        CoordinateError: If any index is invalid
    """
    if not moves:
        return ""
    
    notations = []
    for row, col in moves:
        notations.append(index_to_notation(row, col))
    
    return " ".join(notations)


def get_adjacent_positions(row: int, col: int, include_diagonals: bool = True) -> list:
    """
    Get all valid adjacent positions for a given position.
    
    Args:
        row: Row index
        col: Column index
        include_diagonals: Whether to include diagonal neighbors
        
    Returns:
        List of (row, col) tuples for valid adjacent positions
    """
    if not is_valid_index(row, col):
        return []
    
    directions = [
        (-1, 0), (1, 0),   # vertical
        (0, -1), (0, 1),   # horizontal
    ]
    
    if include_diagonals:
        directions.extend([
            (-1, -1), (-1, 1),  # upper diagonals
            (1, -1), (1, 1),    # lower diagonals
        ])
    
    adjacent = []
    for dr, dc in directions:
        new_row, new_col = row + dr, col + dc
        if is_valid_index(new_row, new_col):
            adjacent.append((new_row, new_col))
    
    return adjacent


def get_line_positions(
    row: int, 
    col: int, 
    direction: str, 
    length: int = 5
) -> list:
    """
    Get positions along a line from a starting point.
    
    Args:
        row: Starting row index
        col: Starting column index
        direction: One of "horizontal", "vertical", "diagonal_down", "diagonal_up"
        length: Number of positions to get
        
    Returns:
        List of (row, col) tuples along the line (only valid positions)
    """
    direction_vectors = {
        "horizontal": (0, 1),
        "vertical": (1, 0),
        "diagonal_down": (1, 1),
        "diagonal_up": (-1, 1),
    }
    
    if direction not in direction_vectors:
        return []
    
    dr, dc = direction_vectors[direction]
    positions = []
    
    for i in range(length):
        new_row = row + i * dr
        new_col = col + i * dc
        if is_valid_index(new_row, new_col):
            positions.append((new_row, new_col))
        else:
            break  # Stop at board edge
    
    return positions


def distance(pos1: Tuple[int, int], pos2: Tuple[int, int]) -> int:
    """
    Calculate Chebyshev distance (max of row/col differences) between two positions.
    
    This is the number of moves a king would need in chess.
    
    Args:
        pos1: First position (row, col)
        pos2: Second position (row, col)
        
    Returns:
        Chebyshev distance
    """
    return max(abs(pos1[0] - pos2[0]), abs(pos1[1] - pos2[1]))


def manhattan_distance(pos1: Tuple[int, int], pos2: Tuple[int, int]) -> int:
    """
    Calculate Manhattan distance between two positions.
    
    Args:
        pos1: First position (row, col)
        pos2: Second position (row, col)
        
    Returns:
        Manhattan distance
    """
    return abs(pos1[0] - pos2[0]) + abs(pos1[1] - pos2[1])


def is_center_region(row: int, col: int, radius: int = 3) -> bool:
    """
    Check if a position is in the center region of the board.
    
    Args:
        row: Row index
        col: Column index
        radius: Radius from center (default 3 = 7x7 center region)
        
    Returns:
        True if position is within radius of center
    """
    center = BOARD_SIZE // 2  # 7 for 15x15 board
    return distance((row, col), (center, center)) <= radius


def is_edge(row: int, col: int) -> bool:
    """
    Check if a position is on the edge of the board.
    
    Args:
        row: Row index
        col: Column index
        
    Returns:
        True if position is on any edge
    """
    return row == 0 or row == BOARD_SIZE - 1 or col == 0 or col == BOARD_SIZE - 1


def is_corner(row: int, col: int) -> bool:
    """
    Check if a position is in a corner of the board.
    
    Args:
        row: Row index
        col: Column index
        
    Returns:
        True if position is a corner
    """
    return (row in [0, BOARD_SIZE - 1]) and (col in [0, BOARD_SIZE - 1])
