"""
AI Match Analysis System - Advanced Position Evaluation

This module implements the AdvancedEvaluator class for multi-factor
position evaluation, providing more accurate scoring through shape,
connectivity, territory, and tempo analysis.

Task 8.3.1: Multi-Factor Evaluation
Impact: +40% evaluation accuracy

Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
"""

import math
from typing import List, Optional, Tuple, Dict, Set
from .types import (
    ThreatResult,
    ThreatType,
    EvaluationResult,
    BOARD_SIZE,
    THREAT_SCORES,
)
from .threat_detector import ThreatDetector
from .position_evaluator import PositionEvaluator


class AdvancedEvaluator:
    """
    Advanced multi-factor position evaluator for Gomoku/Caro.
    
    Extends basic position evaluation with additional factors:
    - Shape score: Evaluates piece formations and patterns
    - Connectivity score: Connected pieces are stronger than scattered
    - Territory score: Control of board regions
    - Tempo score: Who has the initiative/attack
    
    Task 8.3.1: Multi-Factor Evaluation
    Impact: +40% evaluation accuracy
    """
    
    # Weight factors for combining scores
    # TUNED: Increased weights for better evaluation accuracy (Basic Analysis Plan)
    THREAT_WEIGHT = 1.0       # Base threat score weight
    SHAPE_WEIGHT = 0.20       # Shape pattern weight (increased from 0.15)
    CONNECTIVITY_WEIGHT = 0.15 # Connectivity weight (increased from 0.10)
    TERRITORY_WEIGHT = 0.12   # Territory control weight (increased from 0.08)
    TEMPO_WEIGHT = 0.18       # Tempo/initiative weight (increased from 0.12)
    
    def __init__(
        self, 
        threat_detector: Optional[ThreatDetector] = None,
        position_evaluator: Optional[PositionEvaluator] = None,
        board_size: int = BOARD_SIZE
    ):
        """
        Initialize the AdvancedEvaluator.
        
        Args:
            threat_detector: ThreatDetector instance (creates one if not provided)
            position_evaluator: PositionEvaluator instance (creates one if not provided)
            board_size: Size of the board (default 15x15)
        """
        self.board_size = board_size
        self.threat_detector = threat_detector or ThreatDetector(board_size)
        self.position_evaluator = position_evaluator or PositionEvaluator(
            self.threat_detector, board_size
        )
        
        # Sigmoid scaling factor for win probability
        self.sigmoid_scale = 0.0003

    def evaluate_position(
        self, 
        board: List[List[Optional[str]]], 
        player: str
    ) -> EvaluationResult:
        """
        Evaluate a board position using multi-factor analysis.
        
        Combines multiple evaluation factors:
        1. Threat-based score (from basic evaluator)
        2. Shape score (piece formations)
        3. Connectivity score (piece connections)
        4. Territory score (board control)
        5. Tempo score (initiative)
        
        Args:
            board: 2D array representing the board state
            player: The player to evaluate for ("X" or "O")
            
        Returns:
            EvaluationResult with combined score, win_probability, and threats
        """
        opponent = "O" if player == "X" else "X"
        
        # Get base threat evaluation
        player_threats = self.threat_detector.detect_all_threats(board, player)
        opponent_threats = self.threat_detector.detect_all_threats(board, opponent)
        
        # Calculate base threat score
        threat_score = player_threats.total_score - (opponent_threats.total_score * 0.9)
        
        # Calculate additional factors
        shape_score = self.shape_score(board, player) - self.shape_score(board, opponent) * 0.9
        connectivity_score = self.connectivity_score(board, player) - self.connectivity_score(board, opponent) * 0.9
        territory_score = self.territory_score(board, player) - self.territory_score(board, opponent) * 0.9
        tempo_score = self.tempo_score(board, player, player_threats, opponent_threats)
        
        # Combine scores with weights
        combined_score = (
            threat_score * self.THREAT_WEIGHT +
            shape_score * self.SHAPE_WEIGHT +
            connectivity_score * self.CONNECTIVITY_WEIGHT +
            territory_score * self.TERRITORY_WEIGHT +
            tempo_score * self.TEMPO_WEIGHT
        )
        
        # Calculate win probability
        win_probability = self._calculate_win_probability(combined_score)
        
        return EvaluationResult(
            score=combined_score,
            win_probability=win_probability,
            threats=player_threats
        )
    
    def _calculate_win_probability(self, score: float) -> float:
        """
        Calculate win probability from score using sigmoid function.
        
        Args:
            score: The combined position score
            
        Returns:
            Win probability in range [0, 1]
        """
        exponent = -self.sigmoid_scale * score
        exponent = max(-700, min(700, exponent))
        
        try:
            probability = 1.0 / (1.0 + math.exp(exponent))
        except OverflowError:
            probability = 0.0 if exponent > 0 else 1.0
        
        return probability

    def shape_score(self, board: List[List[Optional[str]]], player: str) -> float:
        """
        Evaluate the shape/formation quality of a player's pieces.
        
        Good shapes:
        - Diamond patterns (pieces forming diamond shape)
        - L-shapes (potential for multiple directions)
        - Cross patterns (control multiple lines)
        - Diagonal chains (flexible development)
        
        Bad shapes:
        - Isolated pieces (no nearby support)
        - Overconcentrated (too many pieces in small area)
        - Edge-heavy (too many pieces on edges)
        
        Args:
            board: 2D array representing the board state
            player: The player to evaluate for
            
        Returns:
            Shape score (positive = good shapes, negative = bad shapes)
        """
        score = 0.0
        pieces = self._get_player_pieces(board, player)
        
        if len(pieces) == 0:
            return 0.0
        
        # Evaluate each piece's shape contribution
        for x, y in pieces:
            # Check for good patterns around this piece
            score += self._evaluate_local_shape(board, x, y, player)
        
        # Penalize overconcentration
        score -= self._calculate_concentration_penalty(pieces)
        
        # Bonus for balanced distribution
        score += self._calculate_distribution_bonus(pieces)
        
        return score
    
    def _get_player_pieces(
        self, 
        board: List[List[Optional[str]]], 
        player: str
    ) -> List[Tuple[int, int]]:
        """Get all positions where the player has pieces."""
        pieces = []
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] == player:
                    pieces.append((x, y))
        return pieces
    
    def _evaluate_local_shape(
        self, 
        board: List[List[Optional[str]]], 
        x: int, 
        y: int, 
        player: str
    ) -> float:
        """
        Evaluate the shape quality around a specific piece.
        
        Checks for good patterns like L-shapes, diagonals, etc.
        """
        score = 0.0
        
        # Check 8 directions for nearby friendly pieces
        directions = [
            (-1, -1), (-1, 0), (-1, 1),
            (0, -1),           (0, 1),
            (1, -1),  (1, 0),  (1, 1)
        ]
        
        nearby_count = 0
        diagonal_count = 0
        orthogonal_count = 0
        
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            if 0 <= nx < self.board_size and 0 <= ny < self.board_size:
                if board[nx][ny] == player:
                    nearby_count += 1
                    if dx != 0 and dy != 0:
                        diagonal_count += 1
                    else:
                        orthogonal_count += 1
        
        # L-shape bonus: 1 orthogonal + 1 diagonal neighbor
        if orthogonal_count >= 1 and diagonal_count >= 1:
            score += 15.0
        
        # Cross pattern bonus: 2+ orthogonal neighbors
        if orthogonal_count >= 2:
            score += 20.0
        
        # Diagonal chain bonus
        if diagonal_count >= 2:
            score += 12.0
        
        # Isolated piece penalty
        if nearby_count == 0:
            score -= 10.0
        
        # Slight bonus for having support
        score += nearby_count * 3.0
        
        return score
    
    def _calculate_concentration_penalty(self, pieces: List[Tuple[int, int]]) -> float:
        """
        Calculate penalty for overconcentrated pieces.
        
        Too many pieces in a small area limits flexibility.
        """
        if len(pieces) < 4:
            return 0.0
        
        # Calculate centroid
        cx = sum(p[0] for p in pieces) / len(pieces)
        cy = sum(p[1] for p in pieces) / len(pieces)
        
        # Calculate average distance from centroid
        avg_dist = sum(
            math.sqrt((p[0] - cx) ** 2 + (p[1] - cy) ** 2)
            for p in pieces
        ) / len(pieces)
        
        # Penalty if pieces are too concentrated (avg_dist < 2)
        if avg_dist < 2.0:
            return (2.0 - avg_dist) * 20.0
        
        return 0.0
    
    def _calculate_distribution_bonus(self, pieces: List[Tuple[int, int]]) -> float:
        """
        Calculate bonus for well-distributed pieces.
        
        Pieces that cover multiple quadrants are more flexible.
        """
        if len(pieces) < 3:
            return 0.0
        
        center = self.board_size // 2
        quadrants = set()
        
        for x, y in pieces:
            q = (0 if x < center else 1, 0 if y < center else 1)
            quadrants.add(q)
        
        # Bonus for covering multiple quadrants
        return (len(quadrants) - 1) * 10.0

    def connectivity_score(self, board: List[List[Optional[str]]], player: str) -> float:
        """
        Evaluate how well connected a player's pieces are.
        
        Connected pieces are stronger than scattered pieces because:
        - They can form threats more easily
        - They support each other defensively
        - They control more territory together
        
        Uses Union-Find to identify connected components and scores based on:
        - Size of largest connected component
        - Number of connections between pieces
        - Chain length along lines
        
        Args:
            board: 2D array representing the board state
            player: The player to evaluate for
            
        Returns:
            Connectivity score (higher = better connected)
        """
        pieces = self._get_player_pieces(board, player)
        
        if len(pieces) <= 1:
            return 0.0
        
        score = 0.0
        
        # Count direct connections (adjacent pieces)
        connections = self._count_connections(board, pieces, player)
        score += connections * 8.0
        
        # Find connected components using Union-Find
        components = self._find_connected_components(pieces)
        
        # Bonus for large connected components
        if components:
            largest_component = max(len(c) for c in components)
            score += largest_component * 15.0
            
            # Penalty for too many separate components
            if len(components) > 1:
                score -= (len(components) - 1) * 10.0
        
        # Bonus for chain lengths
        score += self._evaluate_chain_lengths(board, player)
        
        return score
    
    def _count_connections(
        self, 
        board: List[List[Optional[str]]], 
        pieces: List[Tuple[int, int]], 
        player: str
    ) -> int:
        """Count the number of direct connections between pieces."""
        connections = 0
        piece_set = set(pieces)
        
        # Check each piece for adjacent friendly pieces
        for x, y in pieces:
            # Only check 4 directions to avoid double counting
            for dx, dy in [(0, 1), (1, 0), (1, 1), (1, -1)]:
                nx, ny = x + dx, y + dy
                if (nx, ny) in piece_set:
                    connections += 1
        
        return connections
    
    def _find_connected_components(
        self, 
        pieces: List[Tuple[int, int]]
    ) -> List[Set[Tuple[int, int]]]:
        """
        Find connected components using Union-Find algorithm.
        
        Two pieces are connected if they are adjacent (including diagonals).
        """
        if not pieces:
            return []
        
        piece_set = set(pieces)
        visited = set()
        components = []
        
        def bfs(start: Tuple[int, int]) -> Set[Tuple[int, int]]:
            """BFS to find all pieces in the same component."""
            component = set()
            queue = [start]
            
            while queue:
                x, y = queue.pop(0)
                if (x, y) in visited:
                    continue
                visited.add((x, y))
                component.add((x, y))
                
                # Check all 8 neighbors
                for dx in [-1, 0, 1]:
                    for dy in [-1, 0, 1]:
                        if dx == 0 and dy == 0:
                            continue
                        nx, ny = x + dx, y + dy
                        if (nx, ny) in piece_set and (nx, ny) not in visited:
                            queue.append((nx, ny))
            
            return component
        
        for piece in pieces:
            if piece not in visited:
                component = bfs(piece)
                if component:
                    components.append(component)
        
        return components
    
    def _evaluate_chain_lengths(
        self, 
        board: List[List[Optional[str]]], 
        player: str
    ) -> float:
        """
        Evaluate the length of chains in each direction.
        
        Longer chains are more valuable as they're closer to winning.
        """
        score = 0.0
        visited_chains: Set[Tuple[Tuple[int, int], ...]] = set()
        
        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]
        
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] != player:
                    continue
                
                for dx, dy in directions:
                    chain = self._get_chain(board, x, y, dx, dy, player)
                    if len(chain) >= 2:
                        chain_key = tuple(sorted(chain))
                        if chain_key not in visited_chains:
                            visited_chains.add(chain_key)
                            # Score based on chain length
                            # Longer chains are exponentially more valuable
                            score += (len(chain) ** 1.5) * 5.0
        
        return score
    
    def _get_chain(
        self, 
        board: List[List[Optional[str]]], 
        start_x: int, 
        start_y: int, 
        dx: int, 
        dy: int, 
        player: str
    ) -> List[Tuple[int, int]]:
        """Get all pieces in a chain starting from a position in a direction."""
        chain = []
        x, y = start_x, start_y
        
        # Go backwards first to find the start of the chain
        while (0 <= x - dx < self.board_size and 
               0 <= y - dy < self.board_size and 
               board[x - dx][y - dy] == player):
            x -= dx
            y -= dy
        
        # Now collect the chain going forward
        while (0 <= x < self.board_size and 
               0 <= y < self.board_size and 
               board[x][y] == player):
            chain.append((x, y))
            x += dx
            y += dy
        
        return chain

    def territory_score(self, board: List[List[Optional[str]]], player: str) -> float:
        """
        Evaluate territorial control on the board.
        
        Territory is measured by:
        - Influence: How many empty cells are "controlled" by the player
        - Center control: Controlling the center is strategically important
        - Key positions: Control of strategic positions (center, near-center)
        
        A cell is "influenced" by a player if:
        - It's within 2 cells of a player's piece
        - The influence is stronger closer to the piece
        
        Args:
            board: 2D array representing the board state
            player: The player to evaluate for
            
        Returns:
            Territory score (higher = more territory controlled)
        """
        score = 0.0
        pieces = self._get_player_pieces(board, player)
        
        if len(pieces) == 0:
            return 0.0
        
        # Calculate influence map
        influence = self._calculate_influence_map(board, player)
        
        # Sum up influence on empty cells
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] is None:
                    cell_influence = influence[x][y]
                    # Weight by position importance (center more valuable)
                    position_weight = self._get_position_weight(x, y)
                    score += cell_influence * position_weight
        
        # Bonus for center control
        score += self._evaluate_center_control(board, player)
        
        return score
    
    def _calculate_influence_map(
        self, 
        board: List[List[Optional[str]]], 
        player: str
    ) -> List[List[float]]:
        """
        Calculate influence map for a player.
        
        Each cell gets an influence value based on nearby friendly pieces.
        Influence decreases with distance.
        """
        influence = [[0.0] * self.board_size for _ in range(self.board_size)]
        pieces = self._get_player_pieces(board, player)
        
        for px, py in pieces:
            # Spread influence to nearby cells (radius 3)
            for dx in range(-3, 4):
                for dy in range(-3, 4):
                    nx, ny = px + dx, py + dy
                    if 0 <= nx < self.board_size and 0 <= ny < self.board_size:
                        distance = max(abs(dx), abs(dy))  # Chebyshev distance
                        if distance == 0:
                            continue  # Skip the piece itself
                        # Influence decreases with distance
                        cell_influence = 1.0 / distance
                        influence[nx][ny] += cell_influence
        
        return influence
    
    def _get_position_weight(self, x: int, y: int) -> float:
        """
        Get the strategic weight of a position.
        
        Center positions are more valuable than edges.
        """
        center = self.board_size / 2.0
        dx = abs(x - center)
        dy = abs(y - center)
        max_dist = center
        
        # Weight decreases linearly from center (1.0) to corner (0.3)
        distance = math.sqrt(dx * dx + dy * dy)
        weight = 1.0 - (distance / max_dist) * 0.7
        
        return max(0.3, weight)
    
    def _evaluate_center_control(
        self, 
        board: List[List[Optional[str]]], 
        player: str
    ) -> float:
        """
        Evaluate control of the center region.
        
        The center 5x5 area is strategically important.
        """
        score = 0.0
        center = self.board_size // 2
        
        # Check 5x5 center region
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                x, y = center + dx, center + dy
                if 0 <= x < self.board_size and 0 <= y < self.board_size:
                    if board[x][y] == player:
                        # Bonus for pieces in center, higher for exact center
                        distance = max(abs(dx), abs(dy))
                        score += (3 - distance) * 10.0
        
        return score

    def tempo_score(
        self, 
        board: List[List[Optional[str]]], 
        player: str,
        player_threats: ThreatResult,
        opponent_threats: ThreatResult
    ) -> float:
        """
        Evaluate who has the initiative/tempo in the game.
        
        Tempo measures who is "attacking" vs "defending":
        - Having forcing threats (FOUR, OPEN_THREE) gives tempo
        - Being forced to defend loses tempo
        - Multiple threats give more tempo
        - Higher-level threats give more tempo
        
        A player with tempo can dictate the flow of the game.
        
        Args:
            board: 2D array representing the board state
            player: The player to evaluate for
            player_threats: Pre-calculated threats for the player
            opponent_threats: Pre-calculated threats for the opponent
            
        Returns:
            Tempo score (positive = player has initiative)
        """
        score = 0.0
        
        # Count forcing threats (threats that require immediate response)
        player_forcing = self._count_forcing_threats(player_threats)
        opponent_forcing = self._count_forcing_threats(opponent_threats)
        
        # Having more forcing threats = having tempo
        forcing_diff = player_forcing - opponent_forcing
        score += forcing_diff * 50.0
        
        # Bonus for having multiple threats (opponent can't block all)
        if player_forcing >= 2:
            score += 100.0  # Multiple forcing threats is very strong
        
        # Penalty if opponent has multiple forcing threats
        if opponent_forcing >= 2:
            score -= 80.0
        
        # Evaluate threat development potential
        player_potential = self._evaluate_threat_potential(board, player)
        opponent_potential = self._evaluate_threat_potential(board, "O" if player == "X" else "X")
        
        score += (player_potential - opponent_potential) * 0.5
        
        # Check for immediate winning threats
        if player_threats.threats.get(ThreatType.FIVE, 0) > 0:
            score += 10000.0  # Already won
        elif player_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            score += 5000.0  # Guaranteed win next move
        
        if opponent_threats.threats.get(ThreatType.FIVE, 0) > 0:
            score -= 10000.0  # Already lost
        elif opponent_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            score -= 5000.0  # Must block or lose
        
        return score
    
    def _count_forcing_threats(self, threats: ThreatResult) -> int:
        """
        Count the number of forcing threats.
        
        Forcing threats are those that require immediate response:
        - FIVE (already won)
        - OPEN_FOUR (wins next move if not blocked)
        - FOUR (must be blocked)
        - BROKEN_FOUR (must be blocked)
        """
        count = 0
        count += threats.threats.get(ThreatType.FIVE, 0) * 10  # Overwhelming
        count += threats.threats.get(ThreatType.OPEN_FOUR, 0) * 5
        count += threats.threats.get(ThreatType.FOUR, 0) * 2
        count += threats.threats.get(ThreatType.BROKEN_FOUR, 0) * 2
        return count
    
    def _evaluate_threat_potential(
        self, 
        board: List[List[Optional[str]]], 
        player: str
    ) -> float:
        """
        Evaluate the potential for creating new threats.
        
        Looks at how many "almost threats" exist that could become
        real threats with one more move.
        """
        score = 0.0
        pieces = self._get_player_pieces(board, player)
        
        # For each piece, check if there's room to extend
        for x, y in pieces:
            score += self._evaluate_extension_potential(board, x, y, player)
        
        return score
    
    def _evaluate_extension_potential(
        self, 
        board: List[List[Optional[str]]], 
        x: int, 
        y: int, 
        player: str
    ) -> float:
        """
        Evaluate how much a piece can be extended in each direction.
        """
        score = 0.0
        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]
        
        for dx, dy in directions:
            # Count empty cells in both directions
            empty_forward = 0
            empty_backward = 0
            
            # Forward direction
            nx, ny = x + dx, y + dy
            while (0 <= nx < self.board_size and 
                   0 <= ny < self.board_size and 
                   board[nx][ny] is None):
                empty_forward += 1
                if empty_forward >= 4:
                    break
                nx += dx
                ny += dy
            
            # Backward direction
            nx, ny = x - dx, y - dy
            while (0 <= nx < self.board_size and 
                   0 <= ny < self.board_size and 
                   board[nx][ny] is None):
                empty_backward += 1
                if empty_backward >= 4:
                    break
                nx -= dx
                ny -= dy
            
            # Total extension potential in this direction
            total_empty = empty_forward + empty_backward
            if total_empty >= 4:  # Can potentially make a five
                score += total_empty * 2.0
        
        return score

    def get_detailed_evaluation(
        self, 
        board: List[List[Optional[str]]], 
        player: str
    ) -> Dict[str, float]:
        """
        Get a detailed breakdown of all evaluation factors.
        
        Useful for debugging and understanding the evaluation.
        
        Args:
            board: 2D array representing the board state
            player: The player to evaluate for
            
        Returns:
            Dictionary with all score components
        """
        opponent = "O" if player == "X" else "X"
        
        player_threats = self.threat_detector.detect_all_threats(board, player)
        opponent_threats = self.threat_detector.detect_all_threats(board, opponent)
        
        threat_score = player_threats.total_score - (opponent_threats.total_score * 0.9)
        shape = self.shape_score(board, player) - self.shape_score(board, opponent) * 0.9
        connectivity = self.connectivity_score(board, player) - self.connectivity_score(board, opponent) * 0.9
        territory = self.territory_score(board, player) - self.territory_score(board, opponent) * 0.9
        tempo = self.tempo_score(board, player, player_threats, opponent_threats)
        
        combined = (
            threat_score * self.THREAT_WEIGHT +
            shape * self.SHAPE_WEIGHT +
            connectivity * self.CONNECTIVITY_WEIGHT +
            territory * self.TERRITORY_WEIGHT +
            tempo * self.TEMPO_WEIGHT
        )
        
        return {
            "threat_score": threat_score,
            "shape_score": shape,
            "connectivity_score": connectivity,
            "territory_score": territory,
            "tempo_score": tempo,
            "combined_score": combined,
            "win_probability": self._calculate_win_probability(combined),
            "player_threats": player_threats.total_score,
            "opponent_threats": opponent_threats.total_score,
        }
    
    def is_winning_position(
        self, 
        board: List[List[Optional[str]]], 
        player: str
    ) -> bool:
        """
        Check if the player is in a winning position.
        
        A position is winning if:
        - Player has FIVE (already won)
        - Player has OPEN_FOUR (guaranteed win)
        - Player has DOUBLE_FOUR or FOUR_THREE (guaranteed win)
        
        Args:
            board: 2D array representing the board state
            player: The player to check for
            
        Returns:
            True if the position is winning
        """
        threats = self.threat_detector.detect_all_threats(board, player)
        
        # Check for immediate win
        if threats.threats.get(ThreatType.FIVE, 0) > 0:
            return True
        
        # Check for guaranteed win
        if threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            return True
        
        # Check for double threats (from types.py)
        from .types import DoubleThreatType
        if threats.double_threats.get(DoubleThreatType.DOUBLE_FOUR, 0) > 0:
            return True
        if threats.double_threats.get(DoubleThreatType.FOUR_THREE, 0) > 0:
            return True
        
        return False
    
    def is_losing_position(
        self, 
        board: List[List[Optional[str]]], 
        player: str
    ) -> bool:
        """
        Check if the player is in a losing position.
        
        A position is losing if the opponent is in a winning position.
        
        Args:
            board: 2D array representing the board state
            player: The player to check for
            
        Returns:
            True if the position is losing
        """
        opponent = "O" if player == "X" else "X"
        return self.is_winning_position(board, opponent)
