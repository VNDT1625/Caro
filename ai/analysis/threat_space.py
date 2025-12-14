"""
AI Match Analysis System - Threat Space Analysis

Task 8.2.3: Threat Space Analysis
Impact: Better mid-game evaluation

This module implements threat space analysis for evaluating board positions
by calculating:
1. Threat space - the number of empty cells that can create threats
2. Threat potential - the potential for developing threats from current positions

A higher threat space indicates more opportunities to create threats,
which is valuable for mid-game evaluation.
"""

from typing import List, Tuple, Optional, Set, Dict
from dataclasses import dataclass
from .types import (
    ThreatType,
    ThreatPosition,
    ThreatResult,
    THREAT_SCORES,
    BOARD_SIZE,
    WIN_LENGTH,
)
from .threat_detector import ThreatDetector, DIRECTIONS


@dataclass
class ThreatSpaceResult:
    """
    Result of threat space analysis.
    
    Attributes:
        threat_space: Number of empty cells that can create threats
        threat_potential: Score representing the potential for developing threats
        threat_cells: Set of (x, y) coordinates of cells that can create threats
        potential_by_type: Breakdown of potential by threat type
        space_score: Combined score based on threat space and potential
    """
    threat_space: int
    threat_potential: float
    threat_cells: Set[Tuple[int, int]]
    potential_by_type: Dict[ThreatType, int]
    space_score: float


class ThreatSpaceAnalyzer:
    """
    Analyzes threat space on a Gomoku/Caro board.
    
    Task 8.2.3: Threat Space Analysis
    Impact: Better mid-game evaluation
    
    Threat space analysis helps evaluate positions by considering:
    - How many empty cells can create threats (threat space)
    - The potential value of those threats (threat potential)
    
    A player with more threat space has more options and flexibility,
    which is especially valuable in the mid-game.
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize the ThreatSpaceAnalyzer.
        
        Args:
            board_size: Size of the board (default 15x15)
        """
        self.board_size = board_size
        self.threat_detector = ThreatDetector(board_size)

    
    def calculate_threat_space(
        self,
        board: List[List[Optional[str]]],
        player: str,
        detailed: bool = False
    ) -> ThreatSpaceResult:
        """
        Calculate the threat space for a player.
        
        Threat space is the number of empty cells that, if filled,
        would create or strengthen a threat for the player.
        
        Args:
            board: 2D array representing the board state
            player: The player to analyze ("X" or "O")
            detailed: If True, also calculate potential_by_type (slower)
            
        Returns:
            ThreatSpaceResult with threat space metrics
        """
        threat_cells: Set[Tuple[int, int]] = set()
        potential_by_type: Dict[ThreatType, int] = {t: 0 for t in ThreatType}
        total_potential: float = 0.0
        
        # For each empty cell, check if placing a piece would create a threat
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] is not None:
                    continue
                
                # Check what threats this cell could create (fast evaluation)
                cell_potential = self._evaluate_cell_potential(board, x, y, player)
                
                if cell_potential > 0:
                    threat_cells.add((x, y))
                    total_potential += cell_potential
                    
                    # Only categorize by type if detailed mode is requested
                    # This is expensive so we skip it by default
                    if detailed:
                        best_threat = self._get_best_threat_type(board, x, y, player)
                        if best_threat is not None:
                            potential_by_type[best_threat] += 1
        
        threat_space = len(threat_cells)
        
        # Calculate space score: combines threat space count with potential value
        # More threat space = higher score, higher potential = higher score
        space_score = self._calculate_space_score(threat_space, total_potential)
        
        return ThreatSpaceResult(
            threat_space=threat_space,
            threat_potential=total_potential,
            threat_cells=threat_cells,
            potential_by_type=potential_by_type,
            space_score=space_score
        )
    
    def _evaluate_cell_potential(
        self,
        board: List[List[Optional[str]]],
        x: int,
        y: int,
        player: str
    ) -> float:
        """
        Evaluate the threat potential of placing a piece at (x, y).
        
        Checks all four directions to see what threats could be created
        or strengthened by placing a piece at this cell.
        
        Args:
            board: 2D array representing the board state
            x: X coordinate of the cell
            y: Y coordinate of the cell
            player: The player to analyze
            
        Returns:
            Float score representing the threat potential of this cell
        """
        potential: float = 0.0
        
        for direction_name, (dx, dy) in DIRECTIONS.items():
            # Count player pieces and empty cells in this direction
            line_potential = self._evaluate_line_potential(
                board, x, y, dx, dy, player
            )
            potential += line_potential
        
        return potential
    
    def _evaluate_line_potential(
        self,
        board: List[List[Optional[str]]],
        x: int,
        y: int,
        dx: int,
        dy: int,
        player: str
    ) -> float:
        """
        Evaluate the threat potential along a single line through (x, y).
        
        Looks at a window of WIN_LENGTH (5) cells centered on (x, y)
        in the given direction to determine if placing a piece here
        could contribute to a threat.
        
        Args:
            board: 2D array representing the board state
            x: X coordinate of the cell
            y: Y coordinate of the cell
            dx: Row direction
            dy: Column direction
            player: The player to analyze
            
        Returns:
            Float score for this line's potential
        """
        opponent = "O" if player == "X" else "X"
        
        # Look at cells in both directions from (x, y)
        # We need to check if this cell could be part of a winning line
        player_count = 0
        empty_count = 0
        blocked = False
        
        # Check WIN_LENGTH - 1 cells in negative direction
        for i in range(1, WIN_LENGTH):
            nx = x - i * dx
            ny = y - i * dy
            
            if not (0 <= nx < self.board_size and 0 <= ny < self.board_size):
                break
            
            cell = board[nx][ny]
            if cell == player:
                player_count += 1
            elif cell is None:
                empty_count += 1
            else:  # opponent
                blocked = True
                break
        
        # Check WIN_LENGTH - 1 cells in positive direction
        for i in range(1, WIN_LENGTH):
            nx = x + i * dx
            ny = y + i * dy
            
            if not (0 <= nx < self.board_size and 0 <= ny < self.board_size):
                break
            
            cell = board[nx][ny]
            if cell == player:
                player_count += 1
            elif cell is None:
                empty_count += 1
            else:  # opponent
                blocked = True
                break
        
        # Calculate potential based on player pieces and available space
        # If blocked by opponent, potential is reduced
        if blocked and player_count == 0:
            return 0.0
        
        # Potential increases with more player pieces nearby
        # and decreases if blocked
        potential = 0.0
        
        if player_count >= 3:
            # Could create a FOUR or FIVE
            potential = THREAT_SCORES[ThreatType.FOUR] * 0.5
        elif player_count >= 2:
            # Could create a THREE
            potential = THREAT_SCORES[ThreatType.THREE] * 0.3
        elif player_count >= 1:
            # Could create a TWO
            potential = THREAT_SCORES[ThreatType.OPEN_TWO] * 0.2
        elif empty_count >= WIN_LENGTH - 1:
            # Open space with potential
            potential = 1.0
        
        # Reduce potential if blocked
        if blocked:
            potential *= 0.5
        
        return potential

    
    def _get_best_threat_type(
        self,
        board: List[List[Optional[str]]],
        x: int,
        y: int,
        player: str
    ) -> Optional[ThreatType]:
        """
        Determine the best threat type that could be created at (x, y).
        
        Temporarily places a piece and checks what threats are created.
        
        Args:
            board: 2D array representing the board state
            x: X coordinate of the cell
            y: Y coordinate of the cell
            player: The player to analyze
            
        Returns:
            The best ThreatType that could be created, or None
        """
        # Temporarily place the piece
        board[x][y] = player
        
        # Detect threats after placing
        result = self.threat_detector.detect_all_threats(board, player)
        
        # Remove the piece
        board[x][y] = None
        
        # Find the best threat type created
        best_threat: Optional[ThreatType] = None
        best_score = 0
        
        for threat_type, count in result.threats.items():
            if count > 0:
                score = THREAT_SCORES.get(threat_type, 0)
                if score > best_score:
                    best_score = score
                    best_threat = threat_type
        
        return best_threat
    
    def _calculate_space_score(
        self,
        threat_space: int,
        threat_potential: float
    ) -> float:
        """
        Calculate a combined score from threat space and potential.
        
        The score combines:
        - Threat space count (more options = better)
        - Threat potential (higher value threats = better)
        
        Args:
            threat_space: Number of cells that can create threats
            threat_potential: Sum of potential values
            
        Returns:
            Combined space score
        """
        # Base score from threat space count
        # Diminishing returns for very high threat space
        space_component = min(threat_space * 10, 500)
        
        # Potential component (already weighted by threat scores)
        potential_component = threat_potential * 0.1
        
        return space_component + potential_component
    
    def evaluate_threat_potential(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> float:
        """
        Evaluate the overall threat potential for a player.
        
        Task 8.2.3: Evaluate "threat potential" - tiềm năng phát triển threats
        
        Threat potential measures the ability to develop threats from the current
        position. It considers:
        1. Number of cells that can create threats (threat space)
        2. Quality of potential threats (higher threat types = more potential)
        3. Connectivity of existing pieces (connected pieces = easier to extend)
        4. Open lines available for threat development
        5. Position quality (center positions have more potential)
        
        Args:
            board: 2D array representing the board state
            player: The player to analyze
            
        Returns:
            Float score representing threat potential (higher = more potential)
        """
        # Get basic threat space analysis
        result = self.calculate_threat_space(board, player)
        
        # Calculate additional potential factors
        connectivity_bonus = self._calculate_connectivity_potential(board, player)
        open_lines_bonus = self._calculate_open_lines_potential(board, player)
        position_bonus = self._calculate_position_potential(board, player)
        
        # Combine all factors into total threat potential
        total_potential = (
            result.threat_potential +  # Base potential from threat space
            connectivity_bonus * 0.3 +  # Connectivity contributes 30%
            open_lines_bonus * 0.2 +    # Open lines contribute 20%
            position_bonus * 0.1        # Position quality contributes 10%
        )
        
        return total_potential
    
    def _calculate_connectivity_potential(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> float:
        """
        Calculate potential based on connectivity of existing pieces.
        
        Connected pieces are easier to extend into threats.
        
        Args:
            board: 2D array representing the board state
            player: The player to analyze
            
        Returns:
            Float bonus for connectivity
        """
        connectivity_score = 0.0
        
        # Find all player pieces
        player_pieces = []
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] == player:
                    player_pieces.append((x, y))
        
        if len(player_pieces) < 2:
            return 0.0
        
        # Check connectivity between pieces
        for i, (x1, y1) in enumerate(player_pieces):
            for x2, y2 in player_pieces[i+1:]:
                # Check if pieces are adjacent or near each other
                distance = max(abs(x2 - x1), abs(y2 - y1))
                
                if distance == 1:
                    # Adjacent pieces - high connectivity
                    connectivity_score += 50.0
                elif distance == 2:
                    # One cell gap - medium connectivity
                    # Check if the gap is empty (can be filled)
                    mid_x = (x1 + x2) // 2
                    mid_y = (y1 + y2) // 2
                    if 0 <= mid_x < self.board_size and 0 <= mid_y < self.board_size:
                        if board[mid_x][mid_y] is None:
                            connectivity_score += 30.0
                elif distance <= 4:
                    # Within winning distance - some connectivity
                    connectivity_score += 10.0
        
        return connectivity_score
    
    def _calculate_open_lines_potential(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> float:
        """
        Calculate potential based on open lines available.
        
        Open lines (not blocked by opponent) have more potential for threats.
        
        Args:
            board: 2D array representing the board state
            player: The player to analyze
            
        Returns:
            Float bonus for open lines
        """
        opponent = "O" if player == "X" else "X"
        open_lines_score = 0.0
        
        # Find all player pieces
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] != player:
                    continue
                
                # Check each direction for open lines
                for direction_name, (dx, dy) in DIRECTIONS.items():
                    open_count = 0
                    blocked = False
                    
                    # Check WIN_LENGTH cells in positive direction
                    for i in range(1, WIN_LENGTH):
                        nx = x + i * dx
                        ny = y + i * dy
                        
                        if not (0 <= nx < self.board_size and 0 <= ny < self.board_size):
                            break
                        
                        cell = board[nx][ny]
                        if cell == opponent:
                            blocked = True
                            break
                        elif cell is None:
                            open_count += 1
                        # player piece continues the line
                    
                    if not blocked and open_count >= 2:
                        # Open line with potential
                        open_lines_score += open_count * 5.0
        
        return open_lines_score
    
    def _calculate_position_potential(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> float:
        """
        Calculate potential based on position quality.
        
        Center positions have more potential for threat development.
        
        Args:
            board: 2D array representing the board state
            player: The player to analyze
            
        Returns:
            Float bonus for position quality
        """
        position_score = 0.0
        center = self.board_size // 2
        
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] != player:
                    continue
                
                # Calculate distance from center
                dist_from_center = max(abs(x - center), abs(y - center))
                
                # Center positions get higher bonus
                if dist_from_center == 0:
                    position_score += 50.0
                elif dist_from_center <= 2:
                    position_score += 30.0
                elif dist_from_center <= 4:
                    position_score += 15.0
                else:
                    position_score += 5.0
        
        return position_score
    
    def get_threat_space_count(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> int:
        """
        Get the count of cells that can create threats.
        
        Task 8.2.3: Calculate "threat space" - số ô có thể tạo threat
        
        This is a simplified method that returns just the threat space
        count without the full ThreatSpaceResult.
        
        Args:
            board: 2D array representing the board state
            player: The player to analyze
            
        Returns:
            Integer count of threat-creating cells
        """
        result = self.calculate_threat_space(board, player)
        return result.threat_space
    
    def compare_threat_space(
        self,
        board: List[List[Optional[str]]],
        player1: str = "X",
        player2: str = "O"
    ) -> Dict[str, any]:
        """
        Compare threat space between two players.
        
        Useful for evaluating who has the positional advantage
        in terms of threat-creating opportunities.
        
        Args:
            board: 2D array representing the board state
            player1: First player (default "X")
            player2: Second player (default "O")
            
        Returns:
            Dict with comparison metrics
        """
        result1 = self.calculate_threat_space(board, player1)
        result2 = self.calculate_threat_space(board, player2)
        
        return {
            "player1": {
                "player": player1,
                "threat_space": result1.threat_space,
                "threat_potential": result1.threat_potential,
                "space_score": result1.space_score,
            },
            "player2": {
                "player": player2,
                "threat_space": result2.threat_space,
                "threat_potential": result2.threat_potential,
                "space_score": result2.space_score,
            },
            "advantage": player1 if result1.space_score > result2.space_score else player2,
            "space_difference": result1.threat_space - result2.threat_space,
            "potential_difference": result1.threat_potential - result2.threat_potential,
            "score_difference": result1.space_score - result2.space_score,
        }
