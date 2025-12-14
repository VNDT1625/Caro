"""
AI Match Analysis System - Basic VCF Search

This module implements a lightweight VCF search for Basic tier.
Optimized for speed with depth 10-12 (vs 20-30 for Pro tier).

Basic Analysis Realistic Plan - Phase 4: VCF Optimization

Features:
- VCF depth 10-12 (sufficient for 95% detection)
- Time limit 200ms
- Simple pruning
- Fast threat detection

NOT included (reserved for Pro tier):
- VCT search
- Depth 20-30
- Complex pruning strategies
"""

import time
from typing import List, Tuple, Optional, Set
from dataclasses import dataclass
from .types import ThreatType, BOARD_SIZE
from .threat_detector import ThreatDetector


@dataclass
class BasicVCFResult:
    """
    Result of Basic VCF search.
    
    Attributes:
        found: Whether VCF was found
        sequence: Winning sequence [(x, y), ...]
        depth: Depth at which VCF was found
    """
    found: bool
    sequence: List[Tuple[int, int]]
    depth: int


class BasicVCFSearch:
    """
    Lightweight VCF search for Basic tier.
    
    VCF = Victory by Continuous Four
    A forcing sequence of FOUR threats leading to FIVE.
    
    Optimized for:
    - Speed: <200ms
    - Depth: 10-12 (catches 95% of VCFs)
    - Simplicity: No complex pruning
    """
    
    def __init__(
        self,
        board_size: int = BOARD_SIZE,
        max_depth: int = 12,
        time_limit_ms: int = 200
    ):
        """
        Initialize BasicVCFSearch.
        
        Args:
            board_size: Size of the board (default 15)
            max_depth: Maximum search depth (default 12)
            time_limit_ms: Time limit in milliseconds (default 200)
        """
        self.board_size = board_size
        self.max_depth = max_depth
        self.time_limit_ms = time_limit_ms
        self.threat_detector = ThreatDetector(board_size)
        
        self._start_time = 0.0
        self._nodes_searched = 0
    
    def search(
        self,
        board: List[List[Optional[str]]],
        attacker: str
    ) -> BasicVCFResult:
        """
        Search for VCF sequence.
        
        Args:
            board: Current board state
            attacker: Player searching for VCF
            
        Returns:
            BasicVCFResult with found status and sequence
        """
        self._start_time = time.time()
        self._nodes_searched = 0
        
        defender = "O" if attacker == "X" else "X"
        
        # Quick check: already winning?
        threats = self.threat_detector.detect_all_threats(board, attacker)
        
        if threats.threats.get(ThreatType.FIVE, 0) > 0:
            return BasicVCFResult(found=True, sequence=[], depth=0)
        
        if threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            # Find winning move
            win_move = self._find_open_four_win(board, threats, attacker)
            if win_move:
                return BasicVCFResult(found=True, sequence=[win_move], depth=1)
        
        # Start VCF search
        sequence: List[Tuple[int, int]] = []
        found = self._vcf_search(board, attacker, defender, 0, sequence)
        
        return BasicVCFResult(
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
        sequence: List[Tuple[int, int]]
    ) -> bool:
        """
        Recursive VCF search.
        
        Algorithm:
        1. Find moves that create FOUR
        2. For each FOUR move:
           - If creates OPEN_FOUR → win
           - If creates FOUR → defender must block
           - After block, continue searching
        
        Args:
            board: Current board state
            attacker: Attacking player
            defender: Defending player
            depth: Current depth
            sequence: Accumulated sequence
            
        Returns:
            True if VCF found
        """
        self._nodes_searched += 1
        
        # Time/depth limit
        if depth >= self.max_depth or self._time_exceeded():
            return False
        
        # Find FOUR-creating moves
        four_moves = self._find_four_moves(board, attacker)
        
        if not four_moves:
            return False
        
        for move_x, move_y, is_open_four in four_moves:
            # Make move
            board[move_x][move_y] = attacker
            sequence.append((move_x, move_y))
            
            # Check for win
            if is_open_four:
                # OPEN_FOUR = guaranteed win
                return True
            
            # Check if creates FIVE
            threats = self.threat_detector.detect_all_threats(board, attacker)
            if threats.threats.get(ThreatType.FIVE, 0) > 0:
                return True
            
            # Find blocking move
            block = self._find_block(board, move_x, move_y, attacker, defender)
            
            if block is None:
                # No block = win
                return True
            
            # Make block
            board[block[0]][block[1]] = defender
            
            # Continue search
            if self._vcf_search(board, attacker, defender, depth + 2, sequence):
                return True
            
            # Undo block
            board[block[0]][block[1]] = None
            
            # Undo move
            board[move_x][move_y] = None
            sequence.pop()
        
        return False
    
    def _find_four_moves(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> List[Tuple[int, int, bool]]:
        """
        Find moves that create FOUR or OPEN_FOUR.
        
        Args:
            board: Current board state
            player: Player to find moves for
            
        Returns:
            List of (x, y, is_open_four) tuples
        """
        four_moves: List[Tuple[int, int, bool]] = []
        
        # Get candidates near player's pieces
        candidates = self._get_candidates(board, player)
        
        for x, y in candidates:
            board[x][y] = player
            threats = self.threat_detector.detect_all_threats(board, player)
            board[x][y] = None
            
            # Check for FIVE (immediate win)
            if threats.threats.get(ThreatType.FIVE, 0) > 0:
                return [(x, y, True)]  # Immediate win
            
            # Check for OPEN_FOUR
            if threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                four_moves.insert(0, (x, y, True))  # Priority
            
            # Check for FOUR
            elif threats.threats.get(ThreatType.FOUR, 0) > 0:
                four_moves.append((x, y, False))
        
        return four_moves
    
    def _find_block(
        self,
        board: List[List[Optional[str]]],
        move_x: int,
        move_y: int,
        attacker: str,
        defender: str
    ) -> Optional[Tuple[int, int]]:
        """
        Find the blocking move for a FOUR threat.
        
        Args:
            board: Current board state (with attacker's move)
            move_x, move_y: Attacker's move position
            attacker: Attacking player
            defender: Defending player
            
        Returns:
            (x, y) of blocking position, or None if no block needed
        """
        threats = self.threat_detector.detect_all_threats(board, attacker)
        
        for threat in threats.threat_positions:
            if threat.type in [ThreatType.FOUR, ThreatType.OPEN_FOUR]:
                # Find the open end(s)
                positions = sorted(threat.positions)
                if len(positions) < 2:
                    continue
                
                dx = positions[1][0] - positions[0][0]
                dy = positions[1][1] - positions[0][1]
                if dx != 0:
                    dx = dx // abs(dx)
                if dy != 0:
                    dy = dy // abs(dy)
                
                # Check both ends
                before = (positions[0][0] - dx, positions[0][1] - dy)
                after = (positions[-1][0] + dx, positions[-1][1] + dy)
                
                for pos in [before, after]:
                    if (0 <= pos[0] < self.board_size and
                        0 <= pos[1] < self.board_size and
                        board[pos[0]][pos[1]] is None):
                        return pos
        
        return None
    
    def _find_open_four_win(
        self,
        board: List[List[Optional[str]]],
        threats,
        player: str
    ) -> Optional[Tuple[int, int]]:
        """Find winning move from OPEN_FOUR."""
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
                    if (0 <= pos[0] < self.board_size and
                        0 <= pos[1] < self.board_size and
                        board[pos[0]][pos[1]] is None):
                        return pos
        
        return None
    
    def _get_candidates(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> List[Tuple[int, int]]:
        """Get candidate moves near player's pieces."""
        candidates: Set[Tuple[int, int]] = set()
        
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
    
    def _time_exceeded(self) -> bool:
        """Check if time limit exceeded."""
        elapsed_ms = (time.time() - self._start_time) * 1000
        return elapsed_ms >= self.time_limit_ms
    
    def get_nodes_searched(self) -> int:
        """Get number of nodes searched."""
        return self._nodes_searched


def find_basic_vcf(
    board: List[List[Optional[str]]],
    player: str,
    max_depth: int = 12,
    time_limit_ms: int = 200
) -> BasicVCFResult:
    """
    Convenience function to find VCF.
    
    Args:
        board: Current board state
        player: Player to search for
        max_depth: Maximum depth (default 12)
        time_limit_ms: Time limit (default 200ms)
        
    Returns:
        BasicVCFResult
    """
    searcher = BasicVCFSearch(max_depth=max_depth, time_limit_ms=time_limit_ms)
    return searcher.search(board, player)
