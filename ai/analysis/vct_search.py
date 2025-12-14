"""
AI Match Analysis System - VCT Search (Victory by Continuous Three)

This module implements VCT (Victory by Continuous Three) search algorithm
for detecting complex winning sequences in Gomoku/Caro. VCT extends VCF
by also considering THREE threats, allowing detection of more complex
winning sequences.

A VCT sequence can include:
- FOUR → block → FOUR → ... → FIVE (same as VCF)
- THREE → block → FOUR → ... → FIVE (extended with THREE threats)
- THREE → block → THREE → ... → OPEN_FOUR → FIVE

The algorithm uses depth-first search with pruning to find winning
sequences that involve both FOUR and THREE threats.

Requirements: Task 8.1.5
"""

from typing import List, Tuple, Optional, Set, Dict
from dataclasses import dataclass
from enum import Enum
from .types import ThreatType, BOARD_SIZE
from .threat_detector import ThreatDetector
from .vcf_search import VCFSearch, VCFResult


class VCTMoveType(Enum):
    """Type of move in VCT sequence."""
    FOUR = "four"           # Creates FOUR threat (must block)
    OPEN_FOUR = "open_four" # Creates OPEN_FOUR (immediate win)
    THREE = "three"         # Creates THREE threat (should block)
    OPEN_THREE = "open_three"  # Creates OPEN_THREE (strong threat)
    FIVE = "five"           # Winning move


@dataclass
class VCTResult:
    """
    Result of VCT search.
    
    Attributes:
        found: Whether a VCT sequence was found
        sequence: List of moves in the winning sequence [(x, y, player), ...]
        depth: Depth at which VCT was found
        is_vcf: Whether this is a pure VCF (only FOUR threats)
        move_types: Types of moves in the sequence
    """
    found: bool
    sequence: List[Tuple[int, int, str]]
    depth: int
    is_vcf: bool = False
    move_types: List[VCTMoveType] = None
    
    def __post_init__(self):
        if self.move_types is None:
            self.move_types = []


class VCTSearch:
    """
    VCT (Victory by Continuous Three) search algorithm.
    
    VCT extends VCF by also considering THREE threats. This allows
    detection of more complex winning sequences where the attacker
    uses a combination of THREE and FOUR threats to force a win.
    
    Key concepts:
    - FOUR threat: 4 pieces with one open end (opponent MUST block)
    - OPEN_FOUR: 4 pieces with both ends open (immediate win)
    - THREE threat: 3 pieces with one open end (opponent SHOULD block)
    - OPEN_THREE: 3 pieces with both ends open (strong threat)
    - VCT: A sequence of THREE/FOUR threats leading to FIVE
    
    The search prioritizes:
    1. FIVE (winning move)
    2. OPEN_FOUR (immediate win)
    3. FOUR (forcing move)
    4. OPEN_THREE (strong threat)
    5. THREE (developing threat)
    """
    
    def __init__(self, board_size: int = BOARD_SIZE, max_depth: int = 16):
        """
        Initialize VCT search.
        
        Args:
            board_size: Size of the board (default 15x15)
            max_depth: Maximum search depth (default 16 moves)
        """
        self.board_size = board_size
        self.max_depth = max_depth
        self.threat_detector = ThreatDetector(board_size)
        self.vcf_searcher = VCFSearch(board_size, max_depth=10)
        self._nodes_searched = 0

    
    def search(
        self,
        board: List[List[Optional[str]]],
        attacker: str
    ) -> VCTResult:
        """
        Search for a VCT (Victory by Continuous Three) sequence.
        
        This is the main entry point for VCT search. It first tries VCF
        (faster), then falls back to full VCT search if no VCF is found.
        
        Args:
            board: Current board state (2D array, None/"X"/"O")
            attacker: The player searching for VCT ("X" or "O")
            
        Returns:
            VCTResult with found=True and sequence if VCT exists,
            or found=False and empty sequence if no VCT
        """
        self._nodes_searched = 0
        defender = "O" if attacker == "X" else "X"
        
        # First check if attacker already has a winning position
        attacker_threats = self.threat_detector.detect_all_threats(board, attacker)
        
        # If attacker has FIVE, already won
        if attacker_threats.threats.get(ThreatType.FIVE, 0) > 0:
            return VCTResult(found=True, sequence=[], depth=0, is_vcf=True)
        
        # If attacker has OPEN_FOUR, can win immediately
        if attacker_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            winning_move = self._find_winning_move_for_open_four(board, attacker)
            if winning_move:
                return VCTResult(
                    found=True,
                    sequence=[(winning_move[0], winning_move[1], attacker)],
                    depth=1,
                    is_vcf=True,
                    move_types=[VCTMoveType.OPEN_FOUR]
                )
        
        # Try VCF first (faster, only considers FOUR threats)
        vcf_result = self.vcf_searcher.search(board, attacker)
        if vcf_result.found:
            return VCTResult(
                found=True,
                sequence=vcf_result.sequence,
                depth=vcf_result.depth,
                is_vcf=True
            )
        
        # Full VCT search (includes THREE threats)
        sequence: List[Tuple[int, int, str]] = []
        move_types: List[VCTMoveType] = []
        found = self._vct_search(board, attacker, defender, 0, sequence, move_types)
        
        return VCTResult(
            found=found,
            sequence=sequence if found else [],
            depth=len(sequence) if found else 0,
            is_vcf=False,
            move_types=move_types if found else []
        )
    
    def _vct_search(
        self,
        board: List[List[Optional[str]]],
        attacker: str,
        defender: str,
        depth: int,
        sequence: List[Tuple[int, int, str]],
        move_types: List[VCTMoveType]
    ) -> bool:
        """
        Recursive VCT search.
        
        The algorithm works as follows:
        1. Find all moves that create FOUR, OPEN_FOUR, THREE, or OPEN_THREE
        2. For each such move (prioritized by threat strength):
           a. If it creates OPEN_FOUR → win
           b. If it creates FOUR → defender must block, continue search
           c. If it creates OPEN_THREE → defender should block, continue search
           d. If it creates THREE → defender may block, continue search
        3. If any branch leads to FIVE, VCT is found
        
        Args:
            board: Current board state
            attacker: Player looking for VCT
            defender: Opponent player
            depth: Current search depth
            sequence: Accumulated move sequence
            move_types: Types of moves in sequence
            
        Returns:
            True if VCT found, False otherwise
        """
        self._nodes_searched += 1
        
        # Depth limit check
        if depth >= self.max_depth:
            return False
        
        # Find all threat-creating moves
        threat_moves = self._find_threat_creating_moves(board, attacker)
        
        if not threat_moves:
            return False
        
        for move_x, move_y, threat_type, threat_positions in threat_moves:
            # Make the attacker's move
            board[move_x][move_y] = attacker
            sequence.append((move_x, move_y, attacker))
            move_types.append(self._threat_to_move_type(threat_type))
            
            # Check if this creates FIVE (already won)
            attacker_threats = self.threat_detector.detect_all_threats(board, attacker)
            if attacker_threats.threats.get(ThreatType.FIVE, 0) > 0:
                return True
            
            # Check if this creates OPEN_FOUR (immediate win)
            if threat_type == ThreatType.OPEN_FOUR:
                winning_move = self._find_winning_continuation(board, attacker)
                if winning_move:
                    sequence.append((winning_move[0], winning_move[1], attacker))
                    move_types.append(VCTMoveType.FIVE)
                return True
            
            # For FOUR threat, defender must block
            if threat_type == ThreatType.FOUR:
                blocking_moves = self._find_blocking_moves_for_four(
                    board, threat_positions, defender
                )
                
                if not blocking_moves:
                    # No blocking move means attacker wins
                    return True
                
                # Try each blocking option
                for block_x, block_y in blocking_moves:
                    board[block_x][block_y] = defender
                    sequence.append((block_x, block_y, defender))
                    
                    # Recursively search for next threat
                    if self._vct_search(board, attacker, defender, depth + 2, sequence, move_types):
                        return True
                    
                    # Undo defender's block
                    board[block_x][block_y] = None
                    sequence.pop()
            
            # For THREE/OPEN_THREE threats, defender should block but has more options
            elif threat_type in (ThreatType.THREE, ThreatType.OPEN_THREE):
                blocking_moves = self._find_blocking_moves_for_three(
                    board, threat_positions, defender
                )
                
                if not blocking_moves:
                    # No blocking needed, continue attack
                    if self._vct_search(board, attacker, defender, depth + 1, sequence, move_types):
                        return True
                else:
                    # Defender blocks - try the most likely blocking move
                    # For VCT with THREE, we only try the best block to limit search
                    block_x, block_y = blocking_moves[0]
                    board[block_x][block_y] = defender
                    sequence.append((block_x, block_y, defender))
                    
                    if self._vct_search(board, attacker, defender, depth + 2, sequence, move_types):
                        return True
                    
                    board[block_x][block_y] = None
                    sequence.pop()
            
            # Undo attacker's move
            board[move_x][move_y] = None
            sequence.pop()
            move_types.pop()
        
        return False

    
    def _find_threat_creating_moves(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> List[Tuple[int, int, ThreatType, List[Tuple[int, int]]]]:
        """
        Find all moves that create significant threats.
        
        This includes FOUR, OPEN_FOUR, THREE, and OPEN_THREE threats.
        Moves are sorted by threat strength (FIVE > OPEN_FOUR > FOUR > OPEN_THREE > THREE).
        
        Args:
            board: Current board state
            player: Player to find moves for
            
        Returns:
            List of (x, y, threat_type, threat_positions) tuples
        """
        threat_moves: List[Tuple[int, int, ThreatType, List[Tuple[int, int]]]] = []
        
        # Get current threats to find potential extension points
        current_threats = self.threat_detector.detect_all_threats(board, player)
        
        # Find empty cells that could create threats
        candidates = self._get_vct_candidates(board, player)
        
        for x, y in candidates:
            # Try placing a piece here
            board[x][y] = player
            
            # Check what threats this creates
            new_threats = self.threat_detector.detect_all_threats(board, player)
            
            # Check for each threat type in priority order
            threat_found = False
            
            # FIVE (winning)
            if new_threats.threats.get(ThreatType.FIVE, 0) > 0:
                for threat in new_threats.threat_positions:
                    if threat.type == ThreatType.FIVE:
                        threat_moves.append((x, y, ThreatType.FIVE, list(threat.positions)))
                        threat_found = True
                        break
            
            # OPEN_FOUR
            if not threat_found and new_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                for threat in new_threats.threat_positions:
                    if threat.type == ThreatType.OPEN_FOUR:
                        if self._is_new_threat(threat, current_threats):
                            threat_moves.append((x, y, ThreatType.OPEN_FOUR, list(threat.positions)))
                            threat_found = True
                            break
            
            # FOUR
            if not threat_found and new_threats.threats.get(ThreatType.FOUR, 0) > 0:
                for threat in new_threats.threat_positions:
                    if threat.type == ThreatType.FOUR:
                        if self._is_new_threat(threat, current_threats):
                            threat_moves.append((x, y, ThreatType.FOUR, list(threat.positions)))
                            threat_found = True
                            break
            
            # OPEN_THREE
            if not threat_found and new_threats.threats.get(ThreatType.OPEN_THREE, 0) > 0:
                for threat in new_threats.threat_positions:
                    if threat.type == ThreatType.OPEN_THREE:
                        if self._is_new_threat(threat, current_threats):
                            threat_moves.append((x, y, ThreatType.OPEN_THREE, list(threat.positions)))
                            threat_found = True
                            break
            
            # THREE
            if not threat_found and new_threats.threats.get(ThreatType.THREE, 0) > 0:
                for threat in new_threats.threat_positions:
                    if threat.type == ThreatType.THREE:
                        if self._is_new_threat(threat, current_threats):
                            threat_moves.append((x, y, ThreatType.THREE, list(threat.positions)))
                            threat_found = True
                            break
            
            # Undo the move
            board[x][y] = None
        
        # Sort by threat priority
        priority = {
            ThreatType.FIVE: 0,
            ThreatType.OPEN_FOUR: 1,
            ThreatType.FOUR: 2,
            ThreatType.OPEN_THREE: 3,
            ThreatType.THREE: 4
        }
        threat_moves.sort(key=lambda m: priority.get(m[2], 5))
        
        return threat_moves
    
    def _get_vct_candidates(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> List[Tuple[int, int]]:
        """
        Get candidate moves for VCT search.
        
        Considers empty cells near existing pieces (within 2 squares).
        
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
                    # Add empty cells within 2 squares
                    for dx in range(-2, 3):
                        for dy in range(-2, 3):
                            nx, ny = x + dx, y + dy
                            if (0 <= nx < self.board_size and
                                0 <= ny < self.board_size and
                                board[nx][ny] is None):
                                candidates.add((nx, ny))
        
        return list(candidates)
    
    def _is_new_threat(self, threat, existing_threats) -> bool:
        """Check if a threat is new (not in existing threats)."""
        threat_positions_set = set(threat.positions)
        
        for existing in existing_threats.threat_positions:
            if existing.type == threat.type:
                existing_positions_set = set(existing.positions)
                if threat_positions_set == existing_positions_set:
                    return False
        
        return True
    
    def _find_blocking_moves_for_four(
        self,
        board: List[List[Optional[str]]],
        threat_positions: List[Tuple[int, int]],
        defender: str
    ) -> List[Tuple[int, int]]:
        """
        Find moves that block a FOUR threat.
        
        For a FOUR threat, there's typically only one blocking move.
        
        Args:
            board: Current board state
            threat_positions: Positions of the FOUR threat
            defender: Defending player
            
        Returns:
            List of (x, y) blocking moves
        """
        blocking_moves: List[Tuple[int, int]] = []
        
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
    
    def _find_blocking_moves_for_three(
        self,
        board: List[List[Optional[str]]],
        threat_positions: List[Tuple[int, int]],
        defender: str
    ) -> List[Tuple[int, int]]:
        """
        Find moves that block a THREE threat.
        
        For a THREE threat, there are typically multiple blocking options.
        We return the most effective blocking moves.
        
        Args:
            board: Current board state
            threat_positions: Positions of the THREE threat
            defender: Defending player
            
        Returns:
            List of (x, y) blocking moves (sorted by effectiveness)
        """
        blocking_moves: List[Tuple[int, int]] = []
        
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
        
        # Check positions around the threat
        first_pos = sorted_positions[0]
        last_pos = sorted_positions[-1]
        
        # Check position before first (2 positions)
        for i in range(1, 3):
            check_x = first_pos[0] - dx * i
            check_y = first_pos[1] - dy * i
            if (0 <= check_x < self.board_size and
                0 <= check_y < self.board_size and
                board[check_x][check_y] is None):
                blocking_moves.append((check_x, check_y))
        
        # Check position after last (2 positions)
        for i in range(1, 3):
            check_x = last_pos[0] + dx * i
            check_y = last_pos[1] + dy * i
            if (0 <= check_x < self.board_size and
                0 <= check_y < self.board_size and
                board[check_x][check_y] is None):
                blocking_moves.append((check_x, check_y))
        
        return blocking_moves

    
    def _find_winning_move_for_open_four(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> Optional[Tuple[int, int]]:
        """Find the winning move for an OPEN_FOUR threat."""
        threats = self.threat_detector.detect_all_threats(board, player)
        
        for threat in threats.threat_positions:
            if threat.type == ThreatType.OPEN_FOUR:
                positions = sorted(threat.positions)
                if len(positions) < 2:
                    continue
                
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
        """Find a move that completes FIVE from current position."""
        return self._find_winning_move_for_open_four(board, player)
    
    def _threat_to_move_type(self, threat_type: ThreatType) -> VCTMoveType:
        """Convert ThreatType to VCTMoveType."""
        mapping = {
            ThreatType.FIVE: VCTMoveType.FIVE,
            ThreatType.OPEN_FOUR: VCTMoveType.OPEN_FOUR,
            ThreatType.FOUR: VCTMoveType.FOUR,
            ThreatType.OPEN_THREE: VCTMoveType.OPEN_THREE,
            ThreatType.THREE: VCTMoveType.THREE,
        }
        return mapping.get(threat_type, VCTMoveType.THREE)
    
    def get_nodes_searched(self) -> int:
        """Get the number of nodes searched in the last search."""
        return self._nodes_searched


class DefensiveVCTSearch:
    """
    Defensive VCT search - finds ways to block opponent's VCT.
    
    This class helps detect when the opponent has a VCT and finds
    the best defensive moves to prevent it.
    """
    
    def __init__(self, board_size: int = BOARD_SIZE, max_depth: int = 12):
        """
        Initialize defensive VCT search.
        
        Args:
            board_size: Size of the board (default 15x15)
            max_depth: Maximum search depth (default 12 moves)
        """
        self.board_size = board_size
        self.max_depth = max_depth
        self.vct_searcher = VCTSearch(board_size, max_depth)
        self.threat_detector = ThreatDetector(board_size)
    
    def find_defense(
        self,
        board: List[List[Optional[str]]],
        defender: str
    ) -> Dict:
        """
        Find defensive moves against opponent's VCT.
        
        Args:
            board: Current board state
            defender: The defending player ("X" or "O")
            
        Returns:
            Dict with:
                - opponent_has_vct: Whether opponent has VCT
                - defensive_moves: List of moves that might block VCT
                - best_defense: The best defensive move (if any)
                - can_block: Whether VCT can be blocked
        """
        attacker = "O" if defender == "X" else "X"
        
        # Check if opponent has VCT
        vct_result = self.vct_searcher.search(board, attacker)
        
        if not vct_result.found:
            return {
                "opponent_has_vct": False,
                "defensive_moves": [],
                "best_defense": None,
                "can_block": True
            }
        
        # Opponent has VCT - find defensive moves
        defensive_moves = self._find_defensive_moves(board, defender, attacker, vct_result)
        
        # Check if any defense works
        best_defense = None
        can_block = False
        
        for move in defensive_moves:
            # Try the defensive move
            board[move[0]][move[1]] = defender
            
            # Check if opponent still has VCT
            new_vct = self.vct_searcher.search(board, attacker)
            
            if not new_vct.found:
                can_block = True
                best_defense = move
                board[move[0]][move[1]] = None
                break
            
            board[move[0]][move[1]] = None
        
        return {
            "opponent_has_vct": True,
            "defensive_moves": defensive_moves,
            "best_defense": best_defense,
            "can_block": can_block
        }
    
    def _find_defensive_moves(
        self,
        board: List[List[Optional[str]]],
        defender: str,
        attacker: str,
        vct_result: VCTResult
    ) -> List[Tuple[int, int]]:
        """
        Find potential defensive moves against VCT.
        
        Prioritizes:
        1. Blocking the first move in VCT sequence
        2. Creating counter-threats
        3. Blocking key positions in the VCT path
        
        Args:
            board: Current board state
            defender: Defending player
            attacker: Attacking player
            vct_result: The VCT result to defend against
            
        Returns:
            List of (x, y) defensive moves
        """
        defensive_moves: List[Tuple[int, int]] = []
        seen: Set[Tuple[int, int]] = set()
        
        # 1. Block positions in the VCT sequence (only empty cells)
        for x, y, player in vct_result.sequence:
            if (x, y) not in seen and board[x][y] is None:
                defensive_moves.append((x, y))
                seen.add((x, y))
        
        # 2. Find counter-threat moves (defender's own threats)
        defender_threats = self.threat_detector.detect_all_threats(board, defender)
        
        # Look for moves that create FOUR or OPEN_FOUR for defender
        candidates = self._get_defense_candidates(board, defender)
        
        for x, y in candidates:
            if (x, y) in seen:
                continue
            
            board[x][y] = defender
            new_threats = self.threat_detector.detect_all_threats(board, defender)
            board[x][y] = None
            
            # Check if this creates a strong counter-threat
            if (new_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0 or
                new_threats.threats.get(ThreatType.FOUR, 0) > 0):
                defensive_moves.append((x, y))
                seen.add((x, y))
        
        # 3. Add positions near attacker's pieces
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] == attacker:
                    for dx in range(-1, 2):
                        for dy in range(-1, 2):
                            nx, ny = x + dx, y + dy
                            if (0 <= nx < self.board_size and
                                0 <= ny < self.board_size and
                                board[nx][ny] is None and
                                (nx, ny) not in seen):
                                defensive_moves.append((nx, ny))
                                seen.add((nx, ny))
        
        return defensive_moves
    
    def _get_defense_candidates(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> List[Tuple[int, int]]:
        """Get candidate positions for defensive moves."""
        candidates: Set[Tuple[int, int]] = set()
        
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] == player:
                    for dx in range(-2, 3):
                        for dy in range(-2, 3):
                            nx, ny = x + dx, y + dy
                            if (0 <= nx < self.board_size and
                                0 <= ny < self.board_size and
                                board[nx][ny] is None):
                                candidates.add((nx, ny))
        
        return list(candidates)


def find_vct(
    board: List[List[Optional[str]]],
    player: str,
    max_depth: int = 16
) -> VCTResult:
    """
    Convenience function to search for VCT.
    
    Args:
        board: Current board state
        player: Player to search VCT for
        max_depth: Maximum search depth
        
    Returns:
        VCTResult with found status and sequence
    """
    searcher = VCTSearch(max_depth=max_depth)
    return searcher.search(board, player)


def find_vct_defense(
    board: List[List[Optional[str]]],
    defender: str,
    max_depth: int = 12
) -> Dict:
    """
    Convenience function to find defense against opponent's VCT.
    
    Args:
        board: Current board state
        defender: Defending player
        max_depth: Maximum search depth
        
    Returns:
        Dict with defensive analysis
    """
    searcher = DefensiveVCTSearch(max_depth=max_depth)
    return searcher.find_defense(board, defender)
