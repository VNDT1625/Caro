"""
AI Match Analysis System - Role-Based Evaluation

This module implements the RoleEvaluator class for determining player roles
(attacker/defender) and scoring moves based on role-appropriate criteria.

Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
- 3.1: Determine role based on board evaluation thresholds
- 3.2: Score attacker moves (prioritize threat creation)
- 3.3: Score defender moves (prioritize threat blocking)
- 3.4: Bonus for defensive moves with counter-attack potential
- 3.5: Role transitions based on evaluation changes
- 3.6: Role-specific move recommendations
"""

from enum import Enum
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict

from .types import (
    ThreatType,
    ThreatResult,
    THREAT_SCORES,
    BOARD_SIZE,
)
from .threat_detector import ThreatDetector


class PlayerRole(Enum):
    """
    Player role based on board position evaluation.
    
    - ATTACKER: Player has advantage, should focus on creating threats
    - DEFENDER: Player is behind, should focus on blocking opponent threats
    - NEUTRAL: Position is balanced, flexible strategy
    """
    ATTACKER = "attacker"
    DEFENDER = "defender"
    NEUTRAL = "neutral"


# Role determination thresholds (Requirement 3.1)
ATTACKER_THRESHOLD = 500    # Score advantage to be considered attacker
DEFENDER_THRESHOLD = -500   # Score disadvantage to be considered defender


@dataclass
class RoleEvaluation:
    """
    Result of role evaluation for a player.
    
    Attributes:
        role: Current role (attacker/defender/neutral)
        score_diff: Score difference (positive = advantage)
        confidence: Confidence in role assignment (0-1)
        reason: Explanation for role assignment
    """
    role: PlayerRole
    score_diff: float
    confidence: float
    reason: str


@dataclass
class MoveScore:
    """
    Score breakdown for a move based on role.
    
    Attributes:
        total_score: Final combined score
        threat_score: Score from threats created
        block_score: Score from threats blocked
        position_score: Score from positional factors
        counter_attack_bonus: Bonus for defensive moves with counter potential
        role_multiplier: Multiplier applied based on role
    """
    total_score: float
    threat_score: float
    block_score: float
    position_score: float
    counter_attack_bonus: float
    role_multiplier: float


class RoleEvaluator:
    """
    Evaluates player roles and scores moves based on role-appropriate criteria.
    
    The role evaluator determines whether a player should be attacking or
    defending based on the current board position, then scores moves
    according to role-specific criteria.
    
    Requirements:
    - 3.1: Role determination based on evaluation thresholds
    - 3.2: Attacker move scoring (threat creation priority)
    - 3.3: Defender move scoring (threat blocking priority)
    - 3.4: Counter-attack bonus for defensive moves
    - 3.5: Role transition detection
    - 3.6: Role-specific recommendations
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize the RoleEvaluator.
        
        Args:
            board_size: Size of the board (default 15x15)
        """
        self.board_size = board_size
        self.threat_detector = ThreatDetector(board_size)
    
    def determine_role(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> RoleEvaluation:
        """
        Determine the role for a player based on board evaluation.
        
        Compares threat scores between the player and opponent to determine
        whether the player should be attacking, defending, or playing neutrally.
        
        Args:
            board: 2D array representing the board state
            player: The player to evaluate ("X" or "O")
            
        Returns:
            RoleEvaluation with role, score difference, and explanation
            
        Requirements: 3.1, 3.5
        """
        opponent = "O" if player == "X" else "X"
        
        # Get threat scores for both players
        player_threats = self.threat_detector.detect_all_threats(board, player)
        opponent_threats = self.threat_detector.detect_all_threats(board, opponent)
        
        score_diff = player_threats.total_score - opponent_threats.total_score
        
        # Determine role based on thresholds
        if score_diff >= ATTACKER_THRESHOLD:
            role = PlayerRole.ATTACKER
            confidence = min(1.0, score_diff / (ATTACKER_THRESHOLD * 2))
            reason = f"Advantage of {score_diff} points - focus on creating threats"
        elif score_diff <= DEFENDER_THRESHOLD:
            role = PlayerRole.DEFENDER
            confidence = min(1.0, abs(score_diff) / (abs(DEFENDER_THRESHOLD) * 2))
            reason = f"Disadvantage of {abs(score_diff)} points - focus on blocking"
        else:
            role = PlayerRole.NEUTRAL
            confidence = 1.0 - abs(score_diff) / ATTACKER_THRESHOLD
            reason = "Balanced position - flexible strategy"
        
        return RoleEvaluation(
            role=role,
            score_diff=score_diff,
            confidence=confidence,
            reason=reason
        )
    
    def score_move_by_role(
        self,
        board: List[List[Optional[str]]],
        move: Tuple[int, int],
        player: str,
        role: Optional[PlayerRole] = None
    ) -> MoveScore:
        """
        Score a move based on the player's role.
        
        Attackers prioritize threat creation, defenders prioritize blocking,
        and neutral players balance both aspects.
        
        Args:
            board: 2D array representing the board state (before move)
            move: The move to evaluate (row, col)
            player: The player making the move
            role: Optional role override (auto-determined if None)
            
        Returns:
            MoveScore with detailed score breakdown
            
        Requirements: 3.2, 3.3, 3.4
        """
        row, col = move
        opponent = "O" if player == "X" else "X"
        
        # Auto-determine role if not provided
        if role is None:
            role_eval = self.determine_role(board, player)
            role = role_eval.role
        
        # Create board copy with the move applied
        new_board = [row[:] for row in board]
        new_board[row][col] = player
        
        # Calculate threat scores before and after move
        threats_before = self.threat_detector.detect_all_threats(board, player)
        threats_after = self.threat_detector.detect_all_threats(new_board, player)
        
        # Calculate opponent threats before and after (for blocking evaluation)
        opp_threats_before = self.threat_detector.detect_all_threats(board, opponent)
        opp_threats_after = self.threat_detector.detect_all_threats(new_board, opponent)
        
        # Threat creation score
        threat_score = threats_after.total_score - threats_before.total_score
        
        # Blocking score (reduction in opponent threats)
        block_score = opp_threats_before.total_score - opp_threats_after.total_score
        
        # Position score (center preference)
        position_score = self._calculate_position_score(row, col)
        
        # Counter-attack bonus (Requirement 3.4)
        counter_attack_bonus = self._calculate_counter_attack_bonus(
            threat_score, block_score, role
        )
        
        # Apply role-based multipliers
        if role == PlayerRole.ATTACKER:
            # Attackers value threat creation more
            role_multiplier = 1.2
            weighted_threat = threat_score * 1.5
            weighted_block = block_score * 0.8
        elif role == PlayerRole.DEFENDER:
            # Defenders value blocking more
            role_multiplier = 1.0
            weighted_threat = threat_score * 0.8
            weighted_block = block_score * 1.5
        else:  # NEUTRAL
            role_multiplier = 1.0
            weighted_threat = threat_score
            weighted_block = block_score
        
        total_score = (
            weighted_threat + 
            weighted_block + 
            position_score + 
            counter_attack_bonus
        ) * role_multiplier
        
        return MoveScore(
            total_score=total_score,
            threat_score=threat_score,
            block_score=block_score,
            position_score=position_score,
            counter_attack_bonus=counter_attack_bonus,
            role_multiplier=role_multiplier
        )
    
    def _calculate_position_score(self, row: int, col: int) -> float:
        """
        Calculate position-based score bonus.
        
        Center positions are more valuable as they have more lines of attack.
        
        Args:
            row: Row index
            col: Column index
            
        Returns:
            Position score (0-50)
        """
        center = self.board_size // 2
        distance = max(abs(row - center), abs(col - center))
        
        # Max bonus at center, decreasing with distance
        max_bonus = 50
        return max(0, max_bonus - distance * 5)
    
    def _calculate_counter_attack_bonus(
        self,
        threat_score: float,
        block_score: float,
        role: PlayerRole
    ) -> float:
        """
        Calculate bonus for defensive moves that also create threats.
        
        A good defensive move that also creates counter-attack opportunities
        deserves extra credit.
        
        Args:
            threat_score: Score from threats created
            block_score: Score from threats blocked
            role: Current player role
            
        Returns:
            Counter-attack bonus (0-200)
            
        Requirement: 3.4
        """
        # Only apply bonus for defensive moves that also create threats
        if block_score <= 0 or threat_score <= 0:
            return 0
        
        # Bonus is proportional to both blocking and threat creation
        base_bonus = min(block_score, threat_score) * 0.3
        
        # Extra bonus for defenders who find counter-attacks
        if role == PlayerRole.DEFENDER:
            base_bonus *= 1.5
        
        return min(200, base_bonus)
    
    def get_role_recommendation(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> Dict[str, any]:
        """
        Get role-specific move recommendations.
        
        Analyzes the board and provides recommendations based on the
        player's current role.
        
        Args:
            board: 2D array representing the board state
            player: The player to get recommendations for
            
        Returns:
            Dictionary with role, recommendations, and priority moves
            
        Requirement: 3.6
        """
        role_eval = self.determine_role(board, player)
        opponent = "O" if player == "X" else "X"
        
        # Get current threats
        player_threats = self.threat_detector.detect_all_threats(board, player)
        opponent_threats = self.threat_detector.detect_all_threats(board, opponent)
        
        recommendations = []
        priority_moves = []
        
        if role_eval.role == PlayerRole.ATTACKER:
            recommendations.append("Focus on creating new threats")
            recommendations.append("Look for fork opportunities (double threats)")
            recommendations.append("Maintain pressure on opponent")
            
            # Find moves that create threats
            priority_moves = self._find_threat_creating_moves(board, player)
            
        elif role_eval.role == PlayerRole.DEFENDER:
            recommendations.append("Block opponent's most dangerous threats first")
            recommendations.append("Look for counter-attack opportunities while defending")
            recommendations.append("Avoid passive moves that don't address threats")
            
            # Find moves that block threats
            priority_moves = self._find_blocking_moves(board, player, opponent_threats)
            
        else:  # NEUTRAL
            recommendations.append("Balance between attack and defense")
            recommendations.append("Control the center if possible")
            recommendations.append("Develop multiple threat lines")
            
            # Find balanced moves
            priority_moves = self._find_balanced_moves(board, player)
        
        return {
            "role": role_eval.role.value,
            "confidence": role_eval.confidence,
            "reason": role_eval.reason,
            "recommendations": recommendations,
            "priority_moves": priority_moves[:5]  # Top 5 moves
        }
    
    def _find_threat_creating_moves(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> List[Tuple[int, int, float]]:
        """Find moves that create the most threats."""
        moves = []
        
        for row in range(self.board_size):
            for col in range(self.board_size):
                if board[row][col] is None:
                    score = self.score_move_by_role(
                        board, (row, col), player, PlayerRole.ATTACKER
                    )
                    if score.threat_score > 0:
                        moves.append((row, col, score.threat_score))
        
        # Sort by threat score descending
        moves.sort(key=lambda x: x[2], reverse=True)
        return moves
    
    def _find_blocking_moves(
        self,
        board: List[List[Optional[str]]],
        player: str,
        opponent_threats: ThreatResult
    ) -> List[Tuple[int, int, float]]:
        """Find moves that block opponent threats."""
        moves = []
        opponent = "O" if player == "X" else "X"
        
        # Collect all positions from opponent threats
        threat_positions = set()
        for threat in opponent_threats.threat_positions:
            for pos in threat.positions:
                threat_positions.add(pos)
        
        # Check empty cells near threats
        for row in range(self.board_size):
            for col in range(self.board_size):
                if board[row][col] is None:
                    score = self.score_move_by_role(
                        board, (row, col), player, PlayerRole.DEFENDER
                    )
                    if score.block_score > 0:
                        moves.append((row, col, score.block_score))
        
        # Sort by block score descending
        moves.sort(key=lambda x: x[2], reverse=True)
        return moves
    
    def _find_balanced_moves(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> List[Tuple[int, int, float]]:
        """Find moves that balance attack and defense."""
        moves = []
        
        for row in range(self.board_size):
            for col in range(self.board_size):
                if board[row][col] is None:
                    score = self.score_move_by_role(
                        board, (row, col), player, PlayerRole.NEUTRAL
                    )
                    moves.append((row, col, score.total_score))
        
        # Sort by total score descending
        moves.sort(key=lambda x: x[2], reverse=True)
        return moves
    
    def detect_role_transition(
        self,
        board_before: List[List[Optional[str]]],
        board_after: List[List[Optional[str]]],
        player: str
    ) -> Optional[Dict[str, any]]:
        """
        Detect if a move caused a role transition.
        
        Args:
            board_before: Board state before the move
            board_after: Board state after the move
            player: The player to check
            
        Returns:
            Dictionary with transition details, or None if no transition
            
        Requirement: 3.5
        """
        role_before = self.determine_role(board_before, player)
        role_after = self.determine_role(board_after, player)
        
        if role_before.role != role_after.role:
            return {
                "from_role": role_before.role.value,
                "to_role": role_after.role.value,
                "score_change": role_after.score_diff - role_before.score_diff,
                "significance": "major" if abs(role_after.score_diff - role_before.score_diff) > 1000 else "minor"
            }
        
        return None
