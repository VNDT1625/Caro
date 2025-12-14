"""
AI Match Analysis System - VCF Detector for BASIC Tier

This module implements a simplified VCF (Victory by Continuous Four) detector
for the BASIC analysis tier. It detects forced wins within 3 moves depth.

Requirements: 16.1, 16.2, 16.3, 16.4, 16.5
- 16.1: Detect forced win in N moves (VCF, N≤3 for BASIC tier)
- 16.2: Mark "game over" point when position is lost
- 16.3: Rate missed VCF as "blunder" with winning sequence
- 16.4: Rate found VCF as "excellent"
- 16.5: Show winning sequence in alternatives

Property 45: VCF Detection (3-move depth)
Property 46: Missed Win Detection
"""

from typing import List, Tuple, Optional, Set
from dataclasses import dataclass
from .types import ThreatType, BOARD_SIZE
from .threat_detector import ThreatDetector
from .coordinate_utils import index_to_notation


@dataclass
class VCFResult:
    """
    Result of VCF detection.
    
    Attributes:
        has_vcf: Whether a forced win (VCF) was found
        winning_sequence: List of moves in standard notation ["H9", "I8", "J7"]
        winning_positions: List of (x, y) positions for the winning sequence
        depth: Number of moves to win (0 if no VCF)
    """
    has_vcf: bool
    winning_sequence: List[str]  # Standard notation ["H9", "I8", "J7"]
    winning_positions: List[Tuple[int, int]]  # [(x, y), ...]
    depth: int


class VCFDetector:
    """
    Simplified VCF Detector for BASIC tier.
    
    VCF = Victory by Continuous Four
    A forcing sequence where each move creates a FOUR threat,
    forcing the opponent to block, eventually leading to FIVE.
    
    For BASIC tier:
    - max_depth = 3 (detects wins within 3 attacker moves)
    - Simple algorithm without complex pruning
    - Fast execution for real-time analysis
    
    Requirements:
    - 16.1: Detect VCF with N≤3 for BASIC tier
    - 16.2: Check if position is lost (opponent has VCF)
    - 16.3: Mark missed VCF as blunder
    - 16.4: Mark found VCF as excellent
    - 16.5: Return winning sequence
    """
    
    def __init__(self, board_size: int = BOARD_SIZE, max_depth: int = 3):
        """
        Initialize VCFDetector.
        
        Args:
            board_size: Size of the board (default 15)
            max_depth: Maximum search depth for BASIC tier (default 3)
        """
        self.board_size = board_size
        self.max_depth = max_depth
        self.threat_detector = ThreatDetector(board_size)
    
    def detect_vcf(
        self,
        board: List[List[Optional[str]]],
        player: str,
        max_depth: Optional[int] = None
    ) -> VCFResult:
        """
        Detect if player has a forced win (VCF) within max_depth moves.
        
        Algorithm:
        1. Check for immediate win (FIVE or OPEN_FOUR)
        2. Find moves that create FOUR threats
        3. For each FOUR move, simulate opponent's forced block
        4. Recursively search for VCF after block
        
        Args:
            board: 2D array representing the board state
            player: Player to check for VCF ("X" or "O")
            max_depth: Override max depth (default uses self.max_depth)
            
        Returns:
            VCFResult with has_vcf, winning_sequence, and depth
        """
        depth_limit = max_depth if max_depth is not None else self.max_depth
        
        # Quick check: already has winning position?
        threats = self.threat_detector.detect_all_threats(board, player)
        
        # Check for FIVE (already won)
        if threats.threats.get(ThreatType.FIVE, 0) > 0:
            return VCFResult(
                has_vcf=True,
                winning_sequence=[],
                winning_positions=[],
                depth=0
            )
        
        # Check for OPEN_FOUR (guaranteed win in 1 move)
        if threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            win_pos = self._find_open_four_win(board, threats, player)
            if win_pos:
                return VCFResult(
                    has_vcf=True,
                    winning_sequence=[index_to_notation(win_pos[0], win_pos[1])],
                    winning_positions=[win_pos],
                    depth=1
                )
        
        # Search for VCF
        sequence: List[Tuple[int, int]] = []
        found = self._vcf_search(
            board=board,
            player=player,
            opponent=self._get_opponent(player),
            depth=0,
            max_depth=depth_limit,
            sequence=sequence
        )
        
        if found:
            return VCFResult(
                has_vcf=True,
                winning_sequence=[index_to_notation(x, y) for x, y in sequence],
                winning_positions=sequence.copy(),
                depth=len(sequence)
            )
        
        return VCFResult(
            has_vcf=False,
            winning_sequence=[],
            winning_positions=[],
            depth=0
        )
    
    def is_position_lost(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> bool:
        """
        Check if the position is lost for player (opponent has VCF).
        
        Requirements: 16.2
        
        Args:
            board: 2D array representing the board state
            player: Player to check if position is lost for
            
        Returns:
            True if opponent has VCF (position is lost)
        """
        opponent = self._get_opponent(player)
        result = self.detect_vcf(board, opponent)
        return result.has_vcf
    
    def check_missed_vcf(
        self,
        board_before: List[List[Optional[str]]],
        move_x: int,
        move_y: int,
        player: str
    ) -> Optional[VCFResult]:
        """
        Check if player missed a VCF by playing a different move.
        
        Requirements: 16.3
        
        Args:
            board_before: Board state before the move
            move_x, move_y: The move that was actually played
            player: Player who made the move
            
        Returns:
            VCFResult if a VCF was missed, None otherwise
        """
        # Check if there was a VCF before the move
        vcf_result = self.detect_vcf(board_before, player)
        
        if not vcf_result.has_vcf:
            return None
        
        # Check if the actual move was part of the winning sequence
        if vcf_result.winning_positions:
            first_winning_move = vcf_result.winning_positions[0]
            if (move_x, move_y) == first_winning_move:
                return None  # Player found the VCF
        
        # Player missed the VCF
        return vcf_result
    
    def _vcf_search(
        self,
        board: List[List[Optional[str]]],
        player: str,
        opponent: str,
        depth: int,
        max_depth: int,
        sequence: List[Tuple[int, int]]
    ) -> bool:
        """
        Recursive VCF search.
        
        Args:
            board: Current board state
            player: Attacking player
            opponent: Defending player
            depth: Current depth (number of attacker moves)
            max_depth: Maximum depth to search
            sequence: Accumulated winning sequence
            
        Returns:
            True if VCF found
        """
        if depth >= max_depth:
            return False
        
        # Find moves that create FOUR or OPEN_FOUR
        four_moves = self._find_four_creating_moves(board, player)
        
        if not four_moves:
            return False
        
        for move_x, move_y, is_open_four in four_moves:
            # Make the move
            board[move_x][move_y] = player
            sequence.append((move_x, move_y))
            
            # Check for immediate win
            if is_open_four:
                # OPEN_FOUR = guaranteed win (opponent can't block both ends)
                return True
            
            # Check if this creates FIVE
            threats = self.threat_detector.detect_all_threats(board, player)
            if threats.threats.get(ThreatType.FIVE, 0) > 0:
                return True
            
            # Find opponent's forced block
            block_pos = self._find_forced_block(board, player)
            
            if block_pos is None:
                # No block available = win
                return True
            
            # Make opponent's block
            board[block_pos[0]][block_pos[1]] = opponent
            
            # Continue searching
            if self._vcf_search(board, player, opponent, depth + 1, max_depth, sequence):
                return True
            
            # Undo opponent's block
            board[block_pos[0]][block_pos[1]] = None
            
            # Undo our move
            board[move_x][move_y] = None
            sequence.pop()
        
        return False
    
    def _find_four_creating_moves(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> List[Tuple[int, int, bool]]:
        """
        Find all moves that create FOUR or OPEN_FOUR threats.
        
        Args:
            board: Current board state
            player: Player to find moves for
            
        Returns:
            List of (x, y, is_open_four) tuples, sorted by priority
        """
        four_moves: List[Tuple[int, int, bool]] = []
        
        # Get candidate positions (empty cells near player's pieces)
        candidates = self._get_candidate_moves(board, player)
        
        for x, y in candidates:
            # Try the move
            board[x][y] = player
            threats = self.threat_detector.detect_all_threats(board, player)
            board[x][y] = None
            
            # Check for immediate FIVE (highest priority)
            if threats.threats.get(ThreatType.FIVE, 0) > 0:
                return [(x, y, True)]  # Immediate win, return only this
            
            # Check for OPEN_FOUR (guaranteed win)
            if threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                four_moves.insert(0, (x, y, True))  # High priority
            
            # Check for FOUR (forcing move)
            elif threats.threats.get(ThreatType.FOUR, 0) > 0:
                four_moves.append((x, y, False))
            
            # Check for BROKEN_FOUR (also forcing)
            elif threats.threats.get(ThreatType.BROKEN_FOUR, 0) > 0:
                four_moves.append((x, y, False))
        
        return four_moves
    
    def _find_forced_block(
        self,
        board: List[List[Optional[str]]],
        attacker: str
    ) -> Optional[Tuple[int, int]]:
        """
        Find the position where opponent must block.
        
        Args:
            board: Current board state (with attacker's move)
            attacker: The attacking player
            
        Returns:
            (x, y) of blocking position, or None if no block needed/possible
        """
        threats = self.threat_detector.detect_all_threats(board, attacker)
        
        # Look for FOUR or BROKEN_FOUR threats that need blocking
        for threat in threats.threat_positions:
            if threat.type in [ThreatType.FOUR, ThreatType.OPEN_FOUR, ThreatType.BROKEN_FOUR]:
                # Find the empty cell(s) that would complete the FIVE
                block_positions = self._find_threat_block_positions(board, threat)
                if block_positions:
                    return block_positions[0]  # Return first blocking position
        
        return None
    
    def _find_threat_block_positions(
        self,
        board: List[List[Optional[str]]],
        threat
    ) -> List[Tuple[int, int]]:
        """
        Find positions that would block a threat.
        
        Args:
            board: Current board state
            threat: ThreatPosition to block
            
        Returns:
            List of (x, y) positions that would block the threat
        """
        block_positions: List[Tuple[int, int]] = []
        
        if not threat.positions or len(threat.positions) < 2:
            return block_positions
        
        positions = sorted(threat.positions)
        
        # Calculate direction
        dx = positions[1][0] - positions[0][0]
        dy = positions[1][1] - positions[0][1]
        if dx != 0:
            dx = dx // abs(dx)
        if dy != 0:
            dy = dy // abs(dy)
        
        # Check position before first piece
        before_x = positions[0][0] - dx
        before_y = positions[0][1] - dy
        if self._is_valid_empty(board, before_x, before_y):
            block_positions.append((before_x, before_y))
        
        # Check position after last piece
        after_x = positions[-1][0] + dx
        after_y = positions[-1][1] + dy
        if self._is_valid_empty(board, after_x, after_y):
            block_positions.append((after_x, after_y))
        
        # For broken patterns, check gaps
        if threat.type == ThreatType.BROKEN_FOUR:
            for i in range(len(positions) - 1):
                curr = positions[i]
                next_pos = positions[i + 1]
                # Walk from curr to next_pos
                walk_x, walk_y = curr[0] + dx, curr[1] + dy
                while (walk_x, walk_y) != next_pos:
                    if self._is_valid_empty(board, walk_x, walk_y):
                        block_positions.append((walk_x, walk_y))
                    walk_x += dx
                    walk_y += dy
                    if not (0 <= walk_x < self.board_size and 0 <= walk_y < self.board_size):
                        break
        
        return block_positions
    
    def _find_open_four_win(
        self,
        board: List[List[Optional[str]]],
        threats,
        player: str
    ) -> Optional[Tuple[int, int]]:
        """
        Find the winning move from an OPEN_FOUR position.
        
        Args:
            board: Current board state
            threats: ThreatResult from threat detection
            player: Player with OPEN_FOUR
            
        Returns:
            (x, y) of winning move, or None
        """
        for threat in threats.threat_positions:
            if threat.type == ThreatType.OPEN_FOUR:
                positions = sorted(threat.positions)
                if len(positions) < 2:
                    continue
                
                dx = positions[1][0] - positions[0][0]
                dy = positions[1][1] - positions[0][1]
                if dx != 0:
                    dx = dx // abs(dx)
                if dy != 0:
                    dy = dy // abs(dy)
                
                # Either end wins
                before = (positions[0][0] - dx, positions[0][1] - dy)
                after = (positions[-1][0] + dx, positions[-1][1] + dy)
                
                for pos in [before, after]:
                    if self._is_valid_empty(board, pos[0], pos[1]):
                        return pos
        
        return None
    
    def _get_candidate_moves(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> List[Tuple[int, int]]:
        """
        Get candidate moves near player's pieces.
        
        Args:
            board: Current board state
            player: Player to find candidates for
            
        Returns:
            List of (x, y) candidate positions
        """
        candidates: Set[Tuple[int, int]] = set()
        
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] == player:
                    # Add empty cells within 2 squares
                    for dx in range(-2, 3):
                        for dy in range(-2, 3):
                            nx, ny = x + dx, y + dy
                            if self._is_valid_empty(board, nx, ny):
                                candidates.add((nx, ny))
        
        return list(candidates)
    
    def _is_valid_empty(
        self,
        board: List[List[Optional[str]]],
        x: int,
        y: int
    ) -> bool:
        """Check if position is valid and empty."""
        return (0 <= x < self.board_size and
                0 <= y < self.board_size and
                board[x][y] is None)
    
    def _get_opponent(self, player: str) -> str:
        """Get opponent player."""
        return "O" if player == "X" else "X"


# Convenience function
def detect_vcf(
    board: List[List[Optional[str]]],
    player: str,
    max_depth: int = 3
) -> VCFResult:
    """
    Convenience function to detect VCF.
    
    Args:
        board: Current board state
        player: Player to check for VCF
        max_depth: Maximum depth (default 3 for BASIC tier)
        
    Returns:
        VCFResult
    """
    detector = VCFDetector(max_depth=max_depth)
    return detector.detect_vcf(board, player)


def is_position_lost(
    board: List[List[Optional[str]]],
    player: str
) -> bool:
    """
    Convenience function to check if position is lost.
    
    Args:
        board: Current board state
        player: Player to check
        
    Returns:
        True if opponent has VCF
    """
    detector = VCFDetector()
    return detector.is_position_lost(board, player)
