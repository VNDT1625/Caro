"""
AI Match Analysis System - VCF Search (Victory by Continuous Four)

This module implements VCF (Victory by Continuous Four) search algorithm
for detecting winning sequences in Gomoku/Caro. VCF is a forcing sequence
where the attacker plays consecutive FOUR threats that the defender must
block, eventually leading to FIVE (win).

A VCF sequence looks like: FOUR → block → FOUR → block → ... → FIVE

The algorithm uses depth-first search with alpha-beta style pruning to
find winning sequences up to 20 moves deep.

Requirements: Task 8.1.4
"""

from typing import List, Tuple, Optional, Set
from dataclasses import dataclass
from .types import ThreatType, BOARD_SIZE
from .threat_detector import ThreatDetector


@dataclass
class VCFResult:
    """
    Result of VCF search.
    
    Attributes:
        found: Whether a VCF sequence was found
        sequence: List of moves in the winning sequence [(x, y, player), ...]
        depth: Depth at which VCF was found
    """
    found: bool
    sequence: List[Tuple[int, int, str]]
    depth: int


class VCFSearch:
    """
    VCF (Victory by Continuous Four) search algorithm.
    
    VCF is a forcing sequence where the attacker continuously creates
    FOUR threats that the defender must block. If the attacker can
    maintain this sequence until achieving FIVE, they win.
    
    Key concepts:
    - FOUR threat: 4 pieces in a row with one open end (opponent MUST block)
    - OPEN_FOUR threat: 4 pieces with both ends open (immediate win)
    - VCF: A sequence of FOURs leading to FIVE
    
    The search is optimized by:
    1. Only considering moves that create FOUR or OPEN_FOUR threats
    2. Pruning branches where defender has multiple blocking options
    3. Using threat detection to quickly evaluate positions
    """
    
    def __init__(self, board_size: int = BOARD_SIZE, max_depth: int = 20):
        """
        Initialize VCF search.
        
        Args:
            board_size: Size of the board (default 15x15)
            max_depth: Maximum search depth (default 20 moves)
        """
        self.board_size = board_size
        self.max_depth = max_depth
        self.threat_detector = ThreatDetector(board_size)
        self._nodes_searched = 0
    
    def search(
        self,
        board: List[List[Optional[str]]],
        attacker: str
    ) -> VCFResult:
        """
        Search for a VCF (Victory by Continuous Four) sequence.
        
        This is the main entry point for VCF search. It attempts to find
        a forcing sequence of FOUR threats that leads to a win.
        
        IMPORTANT: VCF is only valid if the defender doesn't have an
        immediate winning threat (FIVE or OPEN_FOUR). If defender can
        win immediately, attacker's VCF is meaningless.
        
        Args:
            board: Current board state (2D array, None/"X"/"O")
            attacker: The player searching for VCF ("X" or "O")
            
        Returns:
            VCFResult with found=True and sequence if VCF exists,
            or found=False and empty sequence if no VCF
        """
        self._nodes_searched = 0
        defender = "O" if attacker == "X" else "X"
        
        # CRITICAL FIX: Check if defender has immediate winning threat
        # If defender has FIVE or OPEN_FOUR, they win before attacker can play VCF
        defender_threats = self.threat_detector.detect_all_threats(board, defender)
        if defender_threats.threats.get(ThreatType.FIVE, 0) > 0:
            # Defender already won
            return VCFResult(found=False, sequence=[], depth=0)
        if defender_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            # Defender has OPEN_FOUR - they win next move, no VCF possible
            return VCFResult(found=False, sequence=[], depth=0)
        
        # First check if attacker already has a winning position
        attacker_threats = self.threat_detector.detect_all_threats(board, attacker)
        
        # If attacker has FIVE, already won
        if attacker_threats.threats.get(ThreatType.FIVE, 0) > 0:
            return VCFResult(found=True, sequence=[], depth=0)
        
        # If attacker has OPEN_FOUR, can win immediately
        if attacker_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            # Find the winning move
            for threat in attacker_threats.threat_positions:
                if threat.type == ThreatType.OPEN_FOUR:
                    # Either end of the open four wins
                    winning_move = self._find_winning_move_for_open_four(
                        board, threat, attacker
                    )
                    if winning_move:
                        return VCFResult(
                            found=True,
                            sequence=[(winning_move[0], winning_move[1], attacker)],
                            depth=1
                        )
        
        # Start recursive VCF search
        sequence: List[Tuple[int, int, str]] = []
        found = self._vcf_search(board, attacker, defender, 0, sequence)
        
        return VCFResult(
            found=found,
            sequence=sequence if found else [],
            depth=len(sequence) if found else 0
        )

    
    def _vcf_search(
        self,
        board: List[List[Optional[str]]],
        attacker: str,
        defender: str,
        depth: int,
        sequence: List[Tuple[int, int, str]]
    ) -> bool:
        """
        Recursive VCF search.
        
        The algorithm works as follows:
        1. Find all moves that create FOUR or OPEN_FOUR for attacker
        2. For each such move:
           a. If it creates OPEN_FOUR → win (defender can't block both ends)
           b. If it creates FOUR → defender must block
           c. After defender blocks, recursively search for next FOUR
        3. If any branch leads to FIVE, VCF is found
        
        Args:
            board: Current board state
            attacker: Player looking for VCF
            defender: Opponent player
            depth: Current search depth
            sequence: Accumulated move sequence
            
        Returns:
            True if VCF found, False otherwise
        """
        self._nodes_searched += 1
        
        # Depth limit check
        if depth >= self.max_depth:
            return False
        
        # Find all moves that create FOUR or OPEN_FOUR threats
        four_moves = self._find_four_creating_moves(board, attacker)
        
        if not four_moves:
            return False
        
        for move_x, move_y, threat_type, threat_positions in four_moves:
            # Make the attacker's move
            board[move_x][move_y] = attacker
            sequence.append((move_x, move_y, attacker))
            
            # Check if this creates OPEN_FOUR (immediate win)
            if threat_type == ThreatType.OPEN_FOUR:
                # OPEN_FOUR means attacker wins - defender can't block both ends
                # This move alone is the winning move, no need to add continuation
                # (OPEN_FOUR guarantees win on next move regardless of defender's response)
                return True
            
            # Check if this creates FIVE (already won)
            attacker_threats = self.threat_detector.detect_all_threats(board, attacker)
            if attacker_threats.threats.get(ThreatType.FIVE, 0) > 0:
                return True
            
            # For FOUR threat, defender must block
            # Find the blocking move(s)
            blocking_moves = self._find_blocking_moves(
                board, threat_positions, defender
            )
            
            if not blocking_moves:
                # No blocking move means attacker wins
                return True
            
            # If defender has multiple blocking options, this branch is weak
            # But we still try the first one (most common case)
            if len(blocking_moves) == 1:
                # Single forced block - continue VCF
                block_x, block_y = blocking_moves[0]
                board[block_x][block_y] = defender
                sequence.append((block_x, block_y, defender))
                
                # CRITICAL FIX: Check if defender's block creates OPEN_FOUR
                # If so, defender wins and VCF fails
                defender_threats_after = self.threat_detector.detect_all_threats(board, defender)
                if defender_threats_after.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                    # Defender created OPEN_FOUR while blocking - VCF fails
                    board[block_x][block_y] = None
                    sequence.pop()
                    board[move_x][move_y] = None
                    sequence.pop()
                    continue
                
                # Recursively search for next FOUR
                if self._vcf_search(board, attacker, defender, depth + 2, sequence):
                    return True
                
                # Undo defender's block
                board[block_x][block_y] = None
                sequence.pop()
            else:
                # Multiple blocking options - try each one
                # This is less likely to be a true VCF, but we check anyway
                for block_x, block_y in blocking_moves:
                    board[block_x][block_y] = defender
                    sequence.append((block_x, block_y, defender))
                    
                    # CRITICAL FIX: Check if defender's block creates OPEN_FOUR
                    defender_threats_after = self.threat_detector.detect_all_threats(board, defender)
                    if defender_threats_after.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                        # Defender created OPEN_FOUR while blocking - VCF fails
                        board[block_x][block_y] = None
                        sequence.pop()
                        continue
                    
                    if self._vcf_search(board, attacker, defender, depth + 2, sequence):
                        return True
                    
                    board[block_x][block_y] = None
                    sequence.pop()
            
            # Undo attacker's move
            board[move_x][move_y] = None
            sequence.pop()
        
        return False
    
    def _find_four_creating_moves(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> List[Tuple[int, int, ThreatType, List[Tuple[int, int]]]]:
        """
        Find all moves that create FOUR or OPEN_FOUR threats.
        
        This is the key optimization - we only consider moves that
        create forcing threats, not all possible moves.
        
        Args:
            board: Current board state
            player: Player to find moves for
            
        Returns:
            List of (x, y, threat_type, threat_positions) tuples
            Sorted by threat strength (OPEN_FOUR first, then FOUR)
        """
        four_moves: List[Tuple[int, int, ThreatType, List[Tuple[int, int]]]] = []
        
        # Get current threats to find potential extension points
        current_threats = self.threat_detector.detect_all_threats(board, player)
        
        # Find empty cells that could create FOUR/OPEN_FOUR
        candidates = self._get_vcf_candidates(board, player)
        
        for x, y in candidates:
            # Try placing a piece here
            board[x][y] = player
            
            # Check what threats this creates
            new_threats = self.threat_detector.detect_all_threats(board, player)
            
            # Check for OPEN_FOUR (highest priority)
            if new_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                for threat in new_threats.threat_positions:
                    if threat.type == ThreatType.OPEN_FOUR:
                        # Check if this is a new threat (not existing)
                        if self._is_new_threat(threat, current_threats):
                            four_moves.append((
                                x, y, ThreatType.OPEN_FOUR,
                                list(threat.positions)
                            ))
                            break
            
            # Check for FOUR
            elif new_threats.threats.get(ThreatType.FOUR, 0) > 0:
                for threat in new_threats.threat_positions:
                    if threat.type == ThreatType.FOUR:
                        if self._is_new_threat(threat, current_threats):
                            four_moves.append((
                                x, y, ThreatType.FOUR,
                                list(threat.positions)
                            ))
                            break
            
            # Check for FIVE (winning move)
            elif new_threats.threats.get(ThreatType.FIVE, 0) > 0:
                for threat in new_threats.threat_positions:
                    if threat.type == ThreatType.FIVE:
                        four_moves.append((
                            x, y, ThreatType.FIVE,
                            list(threat.positions)
                        ))
                        break
            
            # Undo the move
            board[x][y] = None
        
        # Sort: FIVE first, then OPEN_FOUR, then FOUR
        priority = {ThreatType.FIVE: 0, ThreatType.OPEN_FOUR: 1, ThreatType.FOUR: 2}
        four_moves.sort(key=lambda m: priority.get(m[2], 3))
        
        return four_moves

    
    def _get_vcf_candidates(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> List[Tuple[int, int]]:
        """
        Get candidate moves for VCF search.
        
        Only considers empty cells near existing pieces of the player,
        as VCF moves must extend existing threats.
        
        Args:
            board: Current board state
            player: Player to find candidates for
            
        Returns:
            List of (x, y) candidate positions
        """
        candidates: Set[Tuple[int, int]] = set()
        
        # Find all player's pieces and add nearby empty cells
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] == player:
                    # Add empty cells within 2 squares (for potential FOUR creation)
                    for dx in range(-2, 3):
                        for dy in range(-2, 3):
                            nx, ny = x + dx, y + dy
                            if (0 <= nx < self.board_size and
                                0 <= ny < self.board_size and
                                board[nx][ny] is None):
                                candidates.add((nx, ny))
        
        return list(candidates)
    
    def _is_new_threat(
        self,
        threat,
        existing_threats
    ) -> bool:
        """
        Check if a threat is new (not in existing threats).
        
        Args:
            threat: The threat to check
            existing_threats: ThreatResult with existing threats
            
        Returns:
            True if this is a new threat
        """
        threat_positions_set = set(threat.positions)
        
        for existing in existing_threats.threat_positions:
            if existing.type == threat.type:
                existing_positions_set = set(existing.positions)
                if threat_positions_set == existing_positions_set:
                    return False
        
        return True
    
    def _find_blocking_moves(
        self,
        board: List[List[Optional[str]]],
        threat_positions: List[Tuple[int, int]],
        defender: str
    ) -> List[Tuple[int, int]]:
        """
        Find moves that block a FOUR threat.
        
        For a FOUR threat (4 pieces with one open end), there's typically
        only one blocking move - the open end.
        
        Args:
            board: Current board state
            threat_positions: Positions of the FOUR threat
            defender: Defending player
            
        Returns:
            List of (x, y) blocking moves
        """
        blocking_moves: List[Tuple[int, int]] = []
        
        # Find the direction of the threat
        if len(threat_positions) < 2:
            return blocking_moves
        
        # Sort positions to find direction
        sorted_positions = sorted(threat_positions)
        
        # Calculate direction
        dx = sorted_positions[1][0] - sorted_positions[0][0]
        dy = sorted_positions[1][1] - sorted_positions[0][1]
        
        # Normalize direction
        if dx != 0:
            dx = dx // abs(dx)
        if dy != 0:
            dy = dy // abs(dy)
        
        # Check both ends of the threat line
        first_pos = sorted_positions[0]
        last_pos = sorted_positions[-1]
        
        # Check position before first
        before_x = first_pos[0] - dx
        before_y = first_pos[1] - dy
        if (0 <= before_x < self.board_size and
            0 <= before_y < self.board_size and
            board[before_x][before_y] is None):
            blocking_moves.append((before_x, before_y))
        
        # Check position after last
        after_x = last_pos[0] + dx
        after_y = last_pos[1] + dy
        if (0 <= after_x < self.board_size and
            0 <= after_y < self.board_size and
            board[after_x][after_y] is None):
            blocking_moves.append((after_x, after_y))
        
        return blocking_moves
    
    def _find_winning_move_for_open_four(
        self,
        board: List[List[Optional[str]]],
        threat,
        player: str
    ) -> Optional[Tuple[int, int]]:
        """
        Find the winning move for an OPEN_FOUR threat.
        
        An OPEN_FOUR has both ends open, so either end wins.
        
        Args:
            board: Current board state
            threat: The OPEN_FOUR threat
            player: Player with the threat
            
        Returns:
            (x, y) of winning move, or None
        """
        positions = sorted(threat.positions)
        if len(positions) < 2:
            return None
        
        # Calculate direction
        dx = positions[1][0] - positions[0][0]
        dy = positions[1][1] - positions[0][1]
        
        if dx != 0:
            dx = dx // abs(dx)
        if dy != 0:
            dy = dy // abs(dy)
        
        # Check both ends
        first_pos = positions[0]
        last_pos = positions[-1]
        
        # Try before first
        before_x = first_pos[0] - dx
        before_y = first_pos[1] - dy
        if (0 <= before_x < self.board_size and
            0 <= before_y < self.board_size and
            board[before_x][before_y] is None):
            return (before_x, before_y)
        
        # Try after last
        after_x = last_pos[0] + dx
        after_y = last_pos[1] + dy
        if (0 <= after_x < self.board_size and
            0 <= after_y < self.board_size and
            board[after_x][after_y] is None):
            return (after_x, after_y)
        
        return None
    
    def _find_winning_continuation(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> Optional[Tuple[int, int]]:
        """
        Find a move that completes FIVE from current position.
        
        Used after creating OPEN_FOUR to find the winning move.
        
        Args:
            board: Current board state
            player: Player to find winning move for
            
        Returns:
            (x, y) of winning move, or None
        """
        threats = self.threat_detector.detect_all_threats(board, player)
        
        for threat in threats.threat_positions:
            if threat.type == ThreatType.OPEN_FOUR:
                winning_move = self._find_winning_move_for_open_four(
                    board, threat, player
                )
                if winning_move:
                    return winning_move
        
        return None
    
    def get_nodes_searched(self) -> int:
        """Get the number of nodes searched in the last search."""
        return self._nodes_searched


def find_vcf(
    board: List[List[Optional[str]]],
    player: str,
    max_depth: int = 20
) -> VCFResult:
    """
    Convenience function to search for VCF.
    
    Args:
        board: Current board state
        player: Player to search VCF for
        max_depth: Maximum search depth
        
    Returns:
        VCFResult with found status and sequence
    """
    searcher = VCFSearch(max_depth=max_depth)
    return searcher.search(board, player)
