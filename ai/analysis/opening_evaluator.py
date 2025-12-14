"""
AI Match Analysis System - Opening Move Evaluator

This module implements the OpeningEvaluator class for evaluating
opening moves (moves 1-10) based on opening principles.

Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
- 15.1: Evaluate opening moves for center proximity
- 15.2: Penalize corner moves in opening
- 15.3: Warn about edge moves
- 15.4: Score modifiers for opening principles
- 15.5: Opening-specific comments
"""

from typing import Tuple, Optional, Dict, List
from dataclasses import dataclass

from .types import BOARD_SIZE


# Opening phase constants
OPENING_PHASE_END = 10  # Moves 1-10 are considered opening
CENTER = BOARD_SIZE // 2  # Center of board (7 for 15x15)

# Distance thresholds
NEAR_CENTER_RADIUS = 3  # Within 3 cells of center
EDGE_DISTANCE = 2  # Within 2 cells of edge

# Corner positions (0-indexed)
CORNERS = [(0, 0), (0, BOARD_SIZE - 1), (BOARD_SIZE - 1, 0), (BOARD_SIZE - 1, BOARD_SIZE - 1)]

# Edge columns and rows
EDGE_COLS = [0, 1, 2, BOARD_SIZE - 3, BOARD_SIZE - 2, BOARD_SIZE - 1]  # A-C, M-O
EDGE_ROWS = [0, 1, 2, BOARD_SIZE - 3, BOARD_SIZE - 2, BOARD_SIZE - 1]  # 1-3, 13-15


@dataclass
class OpeningMoveEvaluation:
    """
    Result of opening move evaluation.
    
    Attributes:
        score_modifier: Score adjustment (-2 to +2)
        is_near_center: Whether move is near center
        is_corner: Whether move is in corner
        is_edge: Whether move is on edge
        comment_key: Key for comment template
        reason: Vietnamese explanation
    """
    score_modifier: float
    is_near_center: bool
    is_corner: bool
    is_edge: bool
    comment_key: str
    reason: str


# Opening comment templates for all 4 languages
OPENING_COMMENTS = {
    "vi": {
        "excellent_center": "Nước đi xuất sắc! Chiếm trung tâm tạo nhiều hướng phát triển.",
        "good_center": "Nước đi tốt. Gần trung tâm, có nhiều lựa chọn phát triển.",
        "corner_warning": "Nước đi yếu! Góc bàn cờ hạn chế phát triển, chỉ có 3 hướng.",
        "edge_warning": "Cẩn thận! Nước đi ở rìa bàn cờ hạn chế khả năng phát triển.",
        "flexible_structure": "Cấu trúc linh hoạt, có thể phát triển nhiều hướng.",
        "rigid_structure": "Cấu trúc cứng nhắc, chỉ có 1 hướng phát triển chính.",
    },
    "en": {
        "excellent_center": "Excellent move! Center control provides multiple development options.",
        "good_center": "Good move. Near center with flexible development.",
        "corner_warning": "Weak move! Corner position limits development to only 3 directions.",
        "edge_warning": "Caution! Edge move limits development potential.",
        "flexible_structure": "Flexible structure with multiple development directions.",
        "rigid_structure": "Rigid structure with only one main development direction.",
    },
    "zh": {
        "excellent_center": "精彩的一步！占据中心，发展方向多。",
        "good_center": "好棋。靠近中心，发展灵活。",
        "corner_warning": "弱棋！角落位置只有3个发展方向。",
        "edge_warning": "注意！边缘位置限制发展潜力。",
        "flexible_structure": "灵活的结构，多个发展方向。",
        "rigid_structure": "僵硬的结构，只有一个主要发展方向。",
    },
    "ja": {
        "excellent_center": "素晴らしい一手！中央を制し、多方向に展開可能。",
        "good_center": "良い手です。中央付近で柔軟な展開が可能。",
        "corner_warning": "弱い手！角は3方向しか展開できません。",
        "edge_warning": "注意！端の手は展開の可能性を制限します。",
        "flexible_structure": "柔軟な構造で、複数の展開方向があります。",
        "rigid_structure": "硬直した構造で、主な展開方向は1つだけです。",
    },
}


class OpeningEvaluator:
    """
    Evaluates opening moves (moves 1-10) based on opening principles.
    
    Opening principles for Gomoku:
    1. Control the center (H8 area)
    2. Avoid corners (limited development)
    3. Avoid edges without tactical reason
    4. Create flexible structures
    """
    
    def __init__(self):
        """Initialize OpeningEvaluator."""
        self.center = (CENTER, CENTER)  # H8 position
    
    def is_opening_phase(self, move_number: int) -> bool:
        """
        Check if move is in opening phase (moves 1-10).
        
        Args:
            move_number: The move number (1-indexed)
            
        Returns:
            True if move is in opening phase
        """
        return 1 <= move_number <= OPENING_PHASE_END
    
    def is_near_center(self, row: int, col: int, distance: int = NEAR_CENTER_RADIUS) -> bool:
        """
        Check if position is within distance of center (H8).
        
        Args:
            row: Row index (0-14)
            col: Column index (0-14)
            distance: Maximum distance from center (default 3)
            
        Returns:
            True if position is within distance of center
            
        Property 42: Opening Move Near Center
        Validates: Requirements 15.1
        """
        center_row, center_col = self.center
        return abs(row - center_row) <= distance and abs(col - center_col) <= distance
    
    def is_corner(self, row: int, col: int) -> bool:
        """
        Check if position is at a corner (A1, O1, A15, O15).
        
        Args:
            row: Row index (0-14)
            col: Column index (0-14)
            
        Returns:
            True if position is at a corner
            
        Property 43: Opening Move at Corner
        Validates: Requirements 15.2
        """
        return (row, col) in CORNERS
    
    def is_edge(self, row: int, col: int) -> bool:
        """
        Check if position is at board edge (columns A-C or M-O, rows 1-3 or 13-15).
        
        Args:
            row: Row index (0-14)
            col: Column index (0-14)
            
        Returns:
            True if position is at edge
            
        Property 44: Opening Move at Edge Warning
        Validates: Requirements 15.3
        """
        # Don't count corners as edge (they have their own evaluation)
        if self.is_corner(row, col):
            return False
        return col in EDGE_COLS or row in EDGE_ROWS
    
    def get_distance_from_center(self, row: int, col: int) -> int:
        """
        Calculate Chebyshev distance from center.
        
        Args:
            row: Row index (0-14)
            col: Column index (0-14)
            
        Returns:
            Maximum of row and column distance from center
        """
        center_row, center_col = self.center
        return max(abs(row - center_row), abs(col - center_col))

    
    def evaluate_opening_move(
        self, 
        row: int, 
        col: int, 
        move_number: int,
        board: Optional[List[List[int]]] = None
    ) -> OpeningMoveEvaluation:
        """
        Evaluate an opening move based on opening principles.
        
        Args:
            row: Row index (0-14)
            col: Column index (0-14)
            move_number: The move number (1-indexed)
            board: Optional board state for structure analysis
            
        Returns:
            OpeningMoveEvaluation with score modifier and comments
            
        Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
        """
        # Not in opening phase - no modifier
        if not self.is_opening_phase(move_number):
            return OpeningMoveEvaluation(
                score_modifier=0.0,
                is_near_center=False,
                is_corner=False,
                is_edge=False,
                comment_key="",
                reason=""
            )
        
        is_near = self.is_near_center(row, col)
        is_corner_pos = self.is_corner(row, col)
        is_edge_pos = self.is_edge(row, col)
        distance = self.get_distance_from_center(row, col)
        
        # Evaluate based on position
        if is_corner_pos:
            # Corner moves are poor - only 3 directions
            # Requirements 15.2
            return OpeningMoveEvaluation(
                score_modifier=-2.0,
                is_near_center=False,
                is_corner=True,
                is_edge=False,
                comment_key="corner_warning",
                reason="Góc bàn cờ hạn chế phát triển"
            )
        
        if is_edge_pos:
            # Edge moves are weak - limited development
            # Requirements 15.3
            return OpeningMoveEvaluation(
                score_modifier=-1.0,
                is_near_center=False,
                is_corner=False,
                is_edge=True,
                comment_key="edge_warning",
                reason="Rìa bàn cờ hạn chế phát triển"
            )
        
        if is_near:
            # Near center is good
            # Requirements 15.1
            if distance <= 1:
                # Very close to center - excellent
                return OpeningMoveEvaluation(
                    score_modifier=2.0,
                    is_near_center=True,
                    is_corner=False,
                    is_edge=False,
                    comment_key="excellent_center",
                    reason="Chiếm trung tâm xuất sắc"
                )
            else:
                # Within 3 cells - good
                return OpeningMoveEvaluation(
                    score_modifier=1.0,
                    is_near_center=True,
                    is_corner=False,
                    is_edge=False,
                    comment_key="good_center",
                    reason="Gần trung tâm, tốt"
                )
        
        # Middle distance - neutral
        return OpeningMoveEvaluation(
            score_modifier=0.0,
            is_near_center=False,
            is_corner=False,
            is_edge=False,
            comment_key="",
            reason=""
        )
    
    def get_opening_comment(
        self, 
        evaluation: OpeningMoveEvaluation, 
        language: str = "vi"
    ) -> str:
        """
        Get opening-specific comment in specified language.
        
        Args:
            evaluation: OpeningMoveEvaluation result
            language: Language code (vi, en, zh, ja)
            
        Returns:
            Comment string in specified language
        """
        if not evaluation.comment_key:
            return ""
        
        lang_comments = OPENING_COMMENTS.get(language, OPENING_COMMENTS["vi"])
        return lang_comments.get(evaluation.comment_key, "")
    
    def analyze_structure_flexibility(
        self, 
        board: List[List[int]], 
        row: int, 
        col: int, 
        player: int
    ) -> Tuple[bool, int]:
        """
        Analyze if the move creates a flexible or rigid structure.
        
        Args:
            board: Current board state
            row: Row of the move
            col: Column of the move
            player: Player who made the move (1 or 2)
            
        Returns:
            Tuple of (is_flexible, num_directions)
            - is_flexible: True if structure has multiple development directions
            - num_directions: Number of viable development directions
            
        Requirements 15.4, 15.5
        """
        directions = [
            (0, 1),   # Horizontal
            (1, 0),   # Vertical
            (1, 1),   # Diagonal down-right
            (1, -1),  # Diagonal down-left
        ]
        
        viable_directions = 0
        
        for dr, dc in directions:
            # Check both directions along this line
            open_spaces = 0
            for sign in [-1, 1]:
                for dist in range(1, 5):
                    nr, nc = row + sign * dr * dist, col + sign * dc * dist
                    if 0 <= nr < BOARD_SIZE and 0 <= nc < BOARD_SIZE:
                        if board[nr][nc] == 0:  # Empty
                            open_spaces += 1
                        elif board[nr][nc] == player:  # Own stone
                            open_spaces += 1
                        else:  # Opponent stone
                            break
                    else:
                        break
            
            # Need at least 4 open spaces in a direction to be viable
            if open_spaces >= 4:
                viable_directions += 1
        
        # Flexible if 3+ directions, rigid if only 1
        is_flexible = viable_directions >= 3
        return is_flexible, viable_directions
