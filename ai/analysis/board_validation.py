"""
AI Match Analysis System - Board Validation Utilities

This module provides utilities for validating Gomoku/Caro board states,
including grid size validation, cell value validation, and overlapping
stone detection.

Requirements: 12.1, 12.2, 12.5, 13.1, 13.2, 13.3, 15.1, 15.2, 15.3

Property 25: Board State Validation
Property 26: Edge Case - Insufficient Moves
Property 27: Edge Case - Board Edge Patterns
Property 30: Pattern Priority Ordering
"""

from typing import List, Optional, Tuple, Dict, Any
from dataclasses import dataclass
from enum import Enum

from .types import (
    BOARD_SIZE,
    ThreatType,
    ThreatPosition,
    Move,
)


class ValidationErrorCode(Enum):
    """Error codes for board validation failures."""
    INVALID_GRID_SIZE = "E001"
    INVALID_CELL_VALUE = "E002"
    OVERLAPPING_STONES = "E003"
    INSUFFICIENT_MOVES = "E004"
    INVALID_MOVE_SEQUENCE = "E005"
    OUT_OF_BOUNDS = "E006"


@dataclass
class ValidationResult:
    """
    Result of board validation.
    
    Attributes:
        is_valid: Whether the board state is valid
        error_code: Error code if validation failed
        error_message: Human-readable error message
        details: Additional details about the error
    """
    is_valid: bool
    error_code: Optional[ValidationErrorCode] = None
    error_message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


# Valid cell values
VALID_CELL_VALUES = {None, "X", "O"}

# Minimum moves required for meaningful analysis
MIN_MOVES_FOR_ANALYSIS = 5

# Pattern priority order (highest to lowest)
# FIVE > OPEN_FOUR > FORK > CLOSED_FOUR > OPEN_THREE
PATTERN_PRIORITY: Dict[ThreatType, int] = {
    ThreatType.FIVE: 100,
    ThreatType.OPEN_FOUR: 90,
    # FORK is handled separately as it's a combination
    ThreatType.FOUR: 70,  # CLOSED_FOUR
    ThreatType.BROKEN_FOUR: 65,
    ThreatType.OPEN_THREE: 60,
    ThreatType.THREE: 50,
    ThreatType.BROKEN_THREE: 45,
    ThreatType.JUMP_THREE: 40,
    ThreatType.OPEN_TWO: 30,
}

# Fork priority (between OPEN_FOUR and CLOSED_FOUR)
FORK_PRIORITY = 80


class BoardValidator:
    """
    Validates Gomoku/Caro board states.
    
    Provides methods to validate:
    - Board grid size (15x15)
    - Cell values (empty, X, O only)
    - Overlapping stones detection
    - Move sequence validity
    
    Requirements:
    - 12.1: Validate board is 15x15 grid
    - 12.2: Validate cell values (empty, X, O only)
    - 12.5: Detect overlapping stones (invalid state)
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize the BoardValidator.
        
        Args:
            board_size: Expected board size (default 15)
        """
        self.board_size = board_size
    
    def validate_board(self, board: List[List[Optional[str]]]) -> ValidationResult:
        """
        Validate a board state.
        
        Checks:
        1. Board is a 2D grid of correct size
        2. All cell values are valid (None, "X", or "O")
        3. No overlapping stones (same position occupied twice)
        
        Args:
            board: 2D array representing the board state
            
        Returns:
            ValidationResult with validation status and any errors
        """
        # Check if board is a list
        if not isinstance(board, list):
            return ValidationResult(
                is_valid=False,
                error_code=ValidationErrorCode.INVALID_GRID_SIZE,
                error_message=f"Board must be a list, got {type(board).__name__}",
                details={"expected_type": "list", "actual_type": type(board).__name__}
            )
        
        # Check row count
        if len(board) != self.board_size:
            return ValidationResult(
                is_valid=False,
                error_code=ValidationErrorCode.INVALID_GRID_SIZE,
                error_message=f"Board must have {self.board_size} rows, got {len(board)}",
                details={"expected_rows": self.board_size, "actual_rows": len(board)}
            )
        
        # Check each row
        for row_idx, row in enumerate(board):
            # Check if row is a list
            if not isinstance(row, list):
                return ValidationResult(
                    is_valid=False,
                    error_code=ValidationErrorCode.INVALID_GRID_SIZE,
                    error_message=f"Row {row_idx} must be a list, got {type(row).__name__}",
                    details={"row": row_idx, "expected_type": "list", "actual_type": type(row).__name__}
                )
            
            # Check column count
            if len(row) != self.board_size:
                return ValidationResult(
                    is_valid=False,
                    error_code=ValidationErrorCode.INVALID_GRID_SIZE,
                    error_message=f"Row {row_idx} must have {self.board_size} columns, got {len(row)}",
                    details={"row": row_idx, "expected_cols": self.board_size, "actual_cols": len(row)}
                )
            
            # Check cell values
            for col_idx, cell in enumerate(row):
                if cell not in VALID_CELL_VALUES:
                    return ValidationResult(
                        is_valid=False,
                        error_code=ValidationErrorCode.INVALID_CELL_VALUE,
                        error_message=f"Invalid cell value at ({row_idx}, {col_idx}): {cell}",
                        details={
                            "row": row_idx,
                            "col": col_idx,
                            "value": cell,
                            "valid_values": list(VALID_CELL_VALUES)
                        }
                    )
        
        return ValidationResult(is_valid=True)
    
    def validate_moves(self, moves: List[Move]) -> ValidationResult:
        """
        Validate a sequence of moves for overlapping stones.
        
        Checks that no two moves occupy the same position.
        
        Args:
            moves: List of moves to validate
            
        Returns:
            ValidationResult with validation status and any errors
        """
        seen_positions: Dict[Tuple[int, int], int] = {}
        
        for i, move in enumerate(moves):
            pos = (move.x, move.y)
            
            # Check bounds
            if not (0 <= move.x < self.board_size and 0 <= move.y < self.board_size):
                return ValidationResult(
                    is_valid=False,
                    error_code=ValidationErrorCode.OUT_OF_BOUNDS,
                    error_message=f"Move {i+1} at ({move.x}, {move.y}) is out of bounds",
                    details={
                        "move_number": i + 1,
                        "position": pos,
                        "board_size": self.board_size
                    }
                )
            
            # Check for overlapping
            if pos in seen_positions:
                return ValidationResult(
                    is_valid=False,
                    error_code=ValidationErrorCode.OVERLAPPING_STONES,
                    error_message=f"Move {i+1} overlaps with move {seen_positions[pos]} at ({move.x}, {move.y})",
                    details={
                        "move_number": i + 1,
                        "overlapping_move": seen_positions[pos],
                        "position": pos
                    }
                )
            
            seen_positions[pos] = i + 1
        
        return ValidationResult(is_valid=True)
    
    def check_sufficient_moves(self, moves: List[Move]) -> ValidationResult:
        """
        Check if there are enough moves for meaningful analysis.
        
        Requirement 13.1: Handle games with < 5 moves
        
        Args:
            moves: List of moves to check
            
        Returns:
            ValidationResult with validation status
        """
        if len(moves) < MIN_MOVES_FOR_ANALYSIS:
            return ValidationResult(
                is_valid=False,
                error_code=ValidationErrorCode.INSUFFICIENT_MOVES,
                error_message=f"Insufficient moves for analysis. Need at least {MIN_MOVES_FOR_ANALYSIS} moves, got {len(moves)}",
                details={
                    "move_count": len(moves),
                    "minimum_required": MIN_MOVES_FOR_ANALYSIS
                }
            )
        
        return ValidationResult(is_valid=True)
    
    def is_edge_position(self, x: int, y: int) -> bool:
        """
        Check if a position is at the board edge.
        
        Requirement 13.2: Handle patterns at board edges
        
        Args:
            x: Row index
            y: Column index
            
        Returns:
            True if position is at edge
        """
        return x == 0 or x == self.board_size - 1 or y == 0 or y == self.board_size - 1
    
    def is_corner_position(self, x: int, y: int) -> bool:
        """
        Check if a position is at a board corner.
        
        Args:
            x: Row index
            y: Column index
            
        Returns:
            True if position is at corner
        """
        corners = [
            (0, 0),
            (0, self.board_size - 1),
            (self.board_size - 1, 0),
            (self.board_size - 1, self.board_size - 1)
        ]
        return (x, y) in corners
    
    def get_valid_neighbors(self, x: int, y: int) -> List[Tuple[int, int]]:
        """
        Get all valid neighboring positions for a cell.
        
        Handles edge cases by only returning positions within bounds.
        
        Args:
            x: Row index
            y: Column index
            
        Returns:
            List of valid (x, y) neighbor positions
        """
        neighbors = []
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if dx == 0 and dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.board_size and 0 <= ny < self.board_size:
                    neighbors.append((nx, ny))
        return neighbors


class PatternPriorityManager:
    """
    Manages pattern priority for threat recommendations.
    
    Requirements:
    - 15.1: Define priority order: FIVE > OPEN_FOUR > FORK > CLOSED_FOUR > OPEN_THREE
    - 15.2: Implement priority-based threat recommendation
    - 15.3: Handle overlapping patterns
    """
    
    def __init__(self):
        """Initialize the PatternPriorityManager."""
        self.priorities = PATTERN_PRIORITY.copy()
        self.fork_priority = FORK_PRIORITY
    
    def get_priority(self, threat_type: ThreatType) -> int:
        """
        Get the priority value for a threat type.
        
        Args:
            threat_type: The threat type to get priority for
            
        Returns:
            Priority value (higher = more important)
        """
        return self.priorities.get(threat_type, 0)
    
    def compare_threats(self, threat1: ThreatType, threat2: ThreatType) -> int:
        """
        Compare two threat types by priority.
        
        Args:
            threat1: First threat type
            threat2: Second threat type
            
        Returns:
            Positive if threat1 > threat2, negative if threat1 < threat2, 0 if equal
        """
        return self.get_priority(threat1) - self.get_priority(threat2)
    
    def sort_threats_by_priority(
        self,
        threats: List[ThreatPosition]
    ) -> List[ThreatPosition]:
        """
        Sort threats by priority (highest first).
        
        Args:
            threats: List of threat positions to sort
            
        Returns:
            Sorted list of threats
        """
        return sorted(
            threats,
            key=lambda t: self.get_priority(t.type),
            reverse=True
        )
    
    def get_highest_priority_threat(
        self,
        threats: List[ThreatPosition]
    ) -> Optional[ThreatPosition]:
        """
        Get the highest priority threat from a list.
        
        Args:
            threats: List of threat positions
            
        Returns:
            Highest priority threat or None if list is empty
        """
        if not threats:
            return None
        return max(threats, key=lambda t: self.get_priority(t.type))
    
    def recommend_block_position(
        self,
        threats: List[ThreatPosition],
        board: List[List[Optional[str]]]
    ) -> Optional[Tuple[int, int]]:
        """
        Recommend the best position to block based on threat priority.
        
        Requirement 15.2: Priority-based threat recommendation
        
        Args:
            threats: List of opponent threats to consider
            board: Current board state
            
        Returns:
            Best blocking position (x, y) or None
        """
        if not threats:
            return None
        
        # Sort by priority
        sorted_threats = self.sort_threats_by_priority(threats)
        
        # Get the highest priority threat
        highest_threat = sorted_threats[0]
        
        # Find the best blocking position for this threat
        # For most threats, blocking the middle or an end is effective
        positions = highest_threat.positions
        if not positions:
            return None
        
        # For FIVE, any position in the line blocks it
        if highest_threat.type == ThreatType.FIVE:
            # Can't block a completed five
            return None
        
        # For OPEN_FOUR, need to block one of the open ends
        # For FOUR, block the open end
        # For OPEN_THREE, block the middle or an end
        
        # Find empty cells adjacent to the threat
        board_size = len(board)
        for pos in positions:
            x, y = pos
            # Check all 8 directions for empty cells
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if (0 <= nx < board_size and 0 <= ny < board_size and
                        board[nx][ny] is None):
                        return (nx, ny)
        
        return None
    
    def is_fork(self, threats_at_position: List[ThreatPosition]) -> bool:
        """
        Check if a position creates a fork (multiple threats).
        
        A fork is when a single move creates 2+ open threes or
        a combination of four and three.
        
        Args:
            threats_at_position: List of threats created by a single move
            
        Returns:
            True if this is a fork
        """
        if len(threats_at_position) < 2:
            return False
        
        # Count threat types
        open_three_count = sum(
            1 for t in threats_at_position
            if t.type in [ThreatType.OPEN_THREE, ThreatType.BROKEN_THREE]
        )
        four_count = sum(
            1 for t in threats_at_position
            if t.type in [ThreatType.FOUR, ThreatType.OPEN_FOUR, ThreatType.BROKEN_FOUR]
        )
        
        # Fork conditions:
        # 1. Two or more open threes
        # 2. One four and one open three
        # 3. Two or more fours
        return (open_three_count >= 2 or
                (four_count >= 1 and open_three_count >= 1) or
                four_count >= 2)


class EdgeCaseHandler:
    """
    Handles edge cases in board analysis.
    
    Requirements:
    - 13.1: Handle games with < 5 moves
    - 13.2: Handle patterns at board edges
    - 13.3: Handle overlapping patterns
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize the EdgeCaseHandler.
        
        Args:
            board_size: Size of the board
        """
        self.board_size = board_size
        self.validator = BoardValidator(board_size)
    
    def handle_insufficient_moves(self, moves: List[Move]) -> Dict[str, Any]:
        """
        Handle games with insufficient moves for analysis.
        
        Requirement 13.1: Return appropriate message for < 5 moves
        
        Args:
            moves: List of moves in the game
            
        Returns:
            Dict with message and basic info
        """
        move_count = len(moves)
        
        if move_count == 0:
            return {
                "can_analyze": False,
                "message": "Không có nước đi nào để phân tích.",
                "message_en": "No moves to analyze.",
                "move_count": 0
            }
        elif move_count < MIN_MOVES_FOR_ANALYSIS:
            return {
                "can_analyze": False,
                "message": f"Cần ít nhất {MIN_MOVES_FOR_ANALYSIS} nước đi để phân tích. Hiện có {move_count} nước.",
                "message_en": f"Need at least {MIN_MOVES_FOR_ANALYSIS} moves for analysis. Currently have {move_count} moves.",
                "move_count": move_count
            }
        
        return {
            "can_analyze": True,
            "message": None,
            "move_count": move_count
        }
    
    def adjust_pattern_for_edge(
        self,
        pattern_positions: List[Tuple[int, int]],
        direction: str
    ) -> Dict[str, Any]:
        """
        Adjust pattern detection for board edges.
        
        Requirement 13.2: Handle patterns at board edges
        
        Args:
            pattern_positions: List of positions in the pattern
            direction: Direction of the pattern
            
        Returns:
            Dict with edge info and adjustments
        """
        if not pattern_positions:
            return {"at_edge": False, "blocked_ends": 0}
        
        # Check if pattern touches edges
        at_edge = any(
            self.validator.is_edge_position(x, y)
            for x, y in pattern_positions
        )
        
        # Count blocked ends due to edge
        blocked_ends = 0
        
        # Get direction vectors
        direction_vectors = {
            "horizontal": (0, 1),
            "vertical": (1, 0),
            "diagonal_down": (1, 1),
            "diagonal_up": (1, -1),
        }
        
        dx, dy = direction_vectors.get(direction, (0, 0))
        if dx == 0 and dy == 0:
            return {"at_edge": at_edge, "blocked_ends": 0}
        
        # Sort positions to find endpoints
        sorted_positions = sorted(pattern_positions)
        first_pos = sorted_positions[0]
        last_pos = sorted_positions[-1]
        
        # Check if ends are blocked by edge
        before_x = first_pos[0] - dx
        before_y = first_pos[1] - dy
        if not (0 <= before_x < self.board_size and 0 <= before_y < self.board_size):
            blocked_ends += 1
        
        after_x = last_pos[0] + dx
        after_y = last_pos[1] + dy
        if not (0 <= after_x < self.board_size and 0 <= after_y < self.board_size):
            blocked_ends += 1
        
        return {
            "at_edge": at_edge,
            "blocked_ends": blocked_ends,
            "first_pos": first_pos,
            "last_pos": last_pos
        }
    
    def detect_overlapping_patterns(
        self,
        patterns: List[ThreatPosition]
    ) -> List[Tuple[ThreatPosition, ThreatPosition]]:
        """
        Detect overlapping patterns that share positions.
        
        Requirement 13.3: Handle overlapping patterns
        
        Args:
            patterns: List of detected patterns
            
        Returns:
            List of overlapping pattern pairs
        """
        overlapping = []
        
        for i in range(len(patterns)):
            for j in range(i + 1, len(patterns)):
                pattern1 = patterns[i]
                pattern2 = patterns[j]
                
                # Check if patterns share any positions
                positions1 = set(pattern1.positions)
                positions2 = set(pattern2.positions)
                
                shared = positions1 & positions2
                if shared:
                    overlapping.append((pattern1, pattern2))
        
        return overlapping


# Convenience functions

def validate_board(board: List[List[Optional[str]]]) -> ValidationResult:
    """
    Validate a board state.
    
    Args:
        board: 2D array representing the board state
        
    Returns:
        ValidationResult with validation status
    """
    validator = BoardValidator()
    return validator.validate_board(board)


def validate_moves(moves: List[Move]) -> ValidationResult:
    """
    Validate a sequence of moves.
    
    Args:
        moves: List of moves to validate
        
    Returns:
        ValidationResult with validation status
    """
    validator = BoardValidator()
    return validator.validate_moves(moves)


def check_sufficient_moves(moves: List[Move]) -> ValidationResult:
    """
    Check if there are enough moves for analysis.
    
    Args:
        moves: List of moves to check
        
    Returns:
        ValidationResult with validation status
    """
    validator = BoardValidator()
    return validator.check_sufficient_moves(moves)


def get_pattern_priority(threat_type: ThreatType) -> int:
    """
    Get the priority value for a threat type.
    
    Args:
        threat_type: The threat type
        
    Returns:
        Priority value
    """
    manager = PatternPriorityManager()
    return manager.get_priority(threat_type)


def sort_threats_by_priority(threats: List[ThreatPosition]) -> List[ThreatPosition]:
    """
    Sort threats by priority (highest first).
    
    Args:
        threats: List of threats to sort
        
    Returns:
        Sorted list
    """
    manager = PatternPriorityManager()
    return manager.sort_threats_by_priority(threats)


def create_empty_board(board_size: int = BOARD_SIZE) -> List[List[Optional[str]]]:
    """
    Create an empty board of the specified size.
    
    Args:
        board_size: Size of the board
        
    Returns:
        Empty 2D board array
    """
    return [[None for _ in range(board_size)] for _ in range(board_size)]


def apply_moves_to_board(
    moves: List[Move],
    board_size: int = BOARD_SIZE
) -> List[List[Optional[str]]]:
    """
    Apply a sequence of moves to create a board state.
    
    Args:
        moves: List of moves to apply
        board_size: Size of the board
        
    Returns:
        Board state after all moves
    """
    board = create_empty_board(board_size)
    for move in moves:
        if 0 <= move.x < board_size and 0 <= move.y < board_size:
            board[move.x][move.y] = move.player
    return board
