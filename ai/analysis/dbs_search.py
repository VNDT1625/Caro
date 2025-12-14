"""
AI Match Analysis System - Dependency-Based Search (DBS)

God-Tier Tier 3: Perfect Tactical Analysis
Kỹ thuật từ Yixin (World Champion Gomoku Engine)

Key insight: Threats có dependencies.
FOUR at A depends on không bị block tại B.
Build dependency graph → prune impossible branches.

Performance: Search 50+ ply trong threat sequences
"""

from typing import List, Tuple, Optional, Dict, Set
from dataclasses import dataclass, field
from enum import Enum

from .types import ThreatType, ThreatPosition, BOARD_SIZE
from .threat_detector import ThreatDetector


class ThreatDependencyType(Enum):
    """Types of dependencies between threats."""
    BLOCKING = "blocking"      # Position blocks this threat
    EXTENDING = "extending"    # Position extends this threat
    CREATING = "creating"      # Position creates this threat


@dataclass
class ThreatDependency:
    """Represents a dependency of a threat on a position."""
    threat_id: int
    position: Tuple[int, int]
    dep_type: ThreatDependencyType
    

@dataclass
class DBSNode:
    """Node in the DBS search tree."""
    board_hash: int
    player: str
    depth: int
    threats: List[ThreatPosition]
    dependencies: Dict[int, List[ThreatDependency]]
    best_move: Optional[Tuple[int, int]] = None
    score: float = 0.0


@dataclass
class DBSResult:
    """Result of DBS search."""
    found: bool
    sequence: List[Tuple[int, int, str]]
    depth: int
    nodes_searched: int
    winning_type: str = ""  # "vcf", "vct", "double_threat"


class DependencyBasedSearch:
    """
    Dependency-Based Search - Kỹ thuật từ Yixin (World Champion).
    
    Key insight: Threats có dependencies.
    FOUR at A depends on không bị block tại B.
    
    Build dependency graph → prune impossible branches.
    
    Advantages over standard VCF/VCT:
    1. Prune branches where dependencies are violated
    2. Order moves by dependency count (fewer deps = stronger)
    3. Detect complex winning sequences faster
    """
    
    def __init__(self, board_size: int = BOARD_SIZE, max_depth: int = 50):
        self.board_size = board_size
        self.max_depth = max_depth
        self.threat_detector = ThreatDetector(board_size)
        
        # Statistics
        self._nodes_searched = 0
        self._pruned_by_dependency = 0
        
        # Transposition table
        self._tt: Dict[int, Tuple[int, Optional[List]]] = {}
        
        # Dependency graph: threat_id -> list of blocking positions
        self._dependency_graph: Dict[int, List[Tuple[int, int]]] = {}
    
    def search(
        self,
        board: List[List[Optional[str]]],
        player: str,
        search_type: str = "vcf"  # "vcf", "vct", or "all"
    ) -> DBSResult:
        """
        Search for winning sequence using DBS.
        
        Args:
            board: Current board state
            player: Player to search for ("X" or "O")
            search_type: Type of search ("vcf", "vct", or "all")
            
        Returns:
            DBSResult with found status and sequence
        """
        self._nodes_searched = 0
        self._pruned_by_dependency = 0
        self._tt.clear()
        
        # Build initial dependency graph
        self._build_dependencies(board, player)
        
        # Search based on type
        if search_type == "vcf":
            return self._search_vcf(board, player)
        elif search_type == "vct":
            return self._search_vct(board, player)
        else:
            # Try VCF first, then VCT
            vcf_result = self._search_vcf(board, player)
            if vcf_result.found:
                return vcf_result
            return self._search_vct(board, player)
    
    def _build_dependencies(self, board: List[List[Optional[str]]], player: str):
        """
        Build dependency graph for all threats.
        
        For each threat, find positions that:
        1. Block the threat (opponent pieces)
        2. Extend the threat (empty cells)
        3. Create the threat (key positions)
        """
        self._dependency_graph.clear()
        
        threats = self.threat_detector.detect_all_threats(board, player)
        
        for i, threat in enumerate(threats.threat_positions):
            blocking_positions = self._find_blocking_positions(board, threat)
            self._dependency_graph[i] = blocking_positions
    
    def _find_blocking_positions(
        self,
        board: List[List[Optional[str]]],
        threat: ThreatPosition
    ) -> List[Tuple[int, int]]:
        """
        Find positions that would block a threat.
        
        For a threat to be realized, these positions must remain empty
        or be filled by the threat owner.
        """
        blocking = []
        
        if not threat.positions:
            return blocking
        
        # Get direction from threat
        direction_map = {
            "horizontal": (0, 1),
            "vertical": (1, 0),
            "diagonal_down": (1, 1),
            "diagonal_up": (1, -1),
        }
        
        dx, dy = direction_map.get(threat.direction, (0, 0))
        if dx == 0 and dy == 0:
            return blocking
        
        # Sort positions
        positions = sorted(threat.positions)
        first = positions[0]
        last = positions[-1]
        
        # Check cells before and after the threat
        before = (first[0] - dx, first[1] - dy)
        after = (last[0] + dx, last[1] + dy)
        
        if self._is_valid_pos(before) and board[before[0]][before[1]] is None:
            blocking.append(before)
        
        if self._is_valid_pos(after) and board[after[0]][after[1]] is None:
            blocking.append(after)
        
        # For broken patterns, also check gap positions
        if threat.type in [ThreatType.BROKEN_FOUR, ThreatType.BROKEN_THREE, ThreatType.JUMP_THREE]:
            for i in range(len(positions) - 1):
                curr = positions[i]
                next_pos = positions[i + 1]
                
                # Walk from curr to next_pos
                walk_x, walk_y = curr[0] + dx, curr[1] + dy
                while (walk_x, walk_y) != next_pos:
                    if self._is_valid_pos((walk_x, walk_y)):
                        if board[walk_x][walk_y] is None:
                            blocking.append((walk_x, walk_y))
                    walk_x += dx
                    walk_y += dy
        
        return blocking
    
    def _is_valid_pos(self, pos: Tuple[int, int]) -> bool:
        """Check if position is within board bounds."""
        return 0 <= pos[0] < self.board_size and 0 <= pos[1] < self.board_size
    
    def _search_vcf(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> DBSResult:
        """
        Search for VCF (Victory by Continuous Four).
        
        VCF: Sequence of FOUR threats that opponent must block,
        eventually leading to FIVE.
        """
        defender = "O" if player == "X" else "X"
        sequence: List[Tuple[int, int, str]] = []
        
        # Check for immediate win
        threats = self.threat_detector.detect_all_threats(board, player)
        
        if threats.threats.get(ThreatType.FIVE, 0) > 0:
            return DBSResult(found=True, sequence=[], depth=0, 
                           nodes_searched=1, winning_type="vcf")
        
        if threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            # Find winning move
            for threat in threats.threat_positions:
                if threat.type == ThreatType.OPEN_FOUR:
                    winning_move = self._find_open_four_win(board, threat, player)
                    if winning_move:
                        return DBSResult(
                            found=True,
                            sequence=[(winning_move[0], winning_move[1], player)],
                            depth=1,
                            nodes_searched=1,
                            winning_type="vcf"
                        )
        
        # DBS search
        found = self._dbs_vcf_search(board, player, defender, 0, sequence, set())
        
        return DBSResult(
            found=found,
            sequence=sequence if found else [],
            depth=len(sequence) if found else 0,
            nodes_searched=self._nodes_searched,
            winning_type="vcf" if found else ""
        )
    
    def _dbs_vcf_search(
        self,
        board: List[List[Optional[str]]],
        attacker: str,
        defender: str,
        depth: int,
        sequence: List[Tuple[int, int, str]],
        used_threats: Set[int]
    ) -> bool:
        """
        Recursive DBS search for VCF.
        
        Key optimization: Order moves by dependency count.
        Fewer dependencies = stronger threat = search first.
        """
        self._nodes_searched += 1
        
        if depth >= self.max_depth:
            return False
        
        # Get threats sorted by dependency count
        threats = self._get_sorted_threats(board, attacker, used_threats)
        
        for threat_id, threat, deps in threats:
            # Check if threat's dependencies are satisfied
            if not self._dependencies_satisfied(board, deps, attacker):
                self._pruned_by_dependency += 1
                continue
            
            # Only consider FOUR-creating moves for VCF
            if threat.type not in [ThreatType.FOUR, ThreatType.OPEN_FOUR, ThreatType.BROKEN_FOUR]:
                continue
            
            # Find the move that creates/extends this threat
            move = self._find_threat_creating_move(board, threat, attacker)
            if not move:
                continue
            
            # Make attacker's move
            board[move[0]][move[1]] = attacker
            sequence.append((move[0], move[1], attacker))
            
            # Check for win
            new_threats = self.threat_detector.detect_all_threats(board, attacker)
            
            if new_threats.threats.get(ThreatType.FIVE, 0) > 0:
                return True
            
            if new_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                # Find winning continuation
                for t in new_threats.threat_positions:
                    if t.type == ThreatType.OPEN_FOUR:
                        win_move = self._find_open_four_win(board, t, attacker)
                        if win_move:
                            sequence.append((win_move[0], win_move[1], attacker))
                            return True
            
            # Find forced responses (blocking moves)
            responses = self._find_forced_responses(board, new_threats, defender)
            
            if not responses:
                # No blocking move = attacker wins
                return True
            
            # Try each response
            for response in responses:
                board[response[0]][response[1]] = defender
                sequence.append((response[0], response[1], defender))
                
                # Recursive search
                if self._dbs_vcf_search(
                    board, attacker, defender, depth + 2,
                    sequence, used_threats | {threat_id}
                ):
                    return True
                
                # Undo defender's move
                board[response[0]][response[1]] = None
                sequence.pop()
            
            # Undo attacker's move
            board[move[0]][move[1]] = None
            sequence.pop()
        
        return False
    
    def _search_vct(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> DBSResult:
        """
        Search for VCT (Victory by Continuous Threat).
        
        VCT: Sequence of threats (not just FOURs) that eventually
        leads to VCF or direct win.
        """
        defender = "O" if player == "X" else "X"
        sequence: List[Tuple[int, int, str]] = []
        
        # First try VCF
        vcf_result = self._search_vcf(board, player)
        if vcf_result.found:
            return vcf_result
        
        # DBS search for VCT
        found = self._dbs_vct_search(board, player, defender, 0, sequence, set())
        
        return DBSResult(
            found=found,
            sequence=sequence if found else [],
            depth=len(sequence) if found else 0,
            nodes_searched=self._nodes_searched,
            winning_type="vct" if found else ""
        )
    
    def _dbs_vct_search(
        self,
        board: List[List[Optional[str]]],
        attacker: str,
        defender: str,
        depth: int,
        sequence: List[Tuple[int, int, str]],
        used_threats: Set[int]
    ) -> bool:
        """
        Recursive DBS search for VCT.
        
        VCT allows THREE threats in addition to FOURs.
        """
        self._nodes_searched += 1
        
        if depth >= self.max_depth:
            return False
        
        # Check for VCF at this position
        vcf_result = self._search_vcf(board, attacker)
        if vcf_result.found:
            sequence.extend(vcf_result.sequence)
            return True
        
        # Get threats sorted by strength
        threats = self._get_sorted_threats(board, attacker, used_threats)
        
        for threat_id, threat, deps in threats:
            if not self._dependencies_satisfied(board, deps, attacker):
                self._pruned_by_dependency += 1
                continue
            
            # For VCT, consider THREE threats too
            if threat.type not in [
                ThreatType.FOUR, ThreatType.OPEN_FOUR, ThreatType.BROKEN_FOUR,
                ThreatType.OPEN_THREE, ThreatType.THREE, ThreatType.BROKEN_THREE
            ]:
                continue
            
            move = self._find_threat_creating_move(board, threat, attacker)
            if not move:
                continue
            
            board[move[0]][move[1]] = attacker
            sequence.append((move[0], move[1], attacker))
            
            # Check for immediate win
            new_threats = self.threat_detector.detect_all_threats(board, attacker)
            
            if new_threats.threats.get(ThreatType.FIVE, 0) > 0:
                return True
            
            if new_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                for t in new_threats.threat_positions:
                    if t.type == ThreatType.OPEN_FOUR:
                        win_move = self._find_open_four_win(board, t, attacker)
                        if win_move:
                            sequence.append((win_move[0], win_move[1], attacker))
                            return True
            
            # Find responses
            responses = self._find_vct_responses(board, new_threats, defender)
            
            if not responses:
                return True
            
            # Try responses
            for response in responses[:3]:  # Limit branching
                board[response[0]][response[1]] = defender
                sequence.append((response[0], response[1], defender))
                
                if self._dbs_vct_search(
                    board, attacker, defender, depth + 2,
                    sequence, used_threats | {threat_id}
                ):
                    return True
                
                board[response[0]][response[1]] = None
                sequence.pop()
            
            board[move[0]][move[1]] = None
            sequence.pop()
        
        return False
    
    def _get_sorted_threats(
        self,
        board: List[List[Optional[str]]],
        player: str,
        used_threats: Set[int]
    ) -> List[Tuple[int, ThreatPosition, List[Tuple[int, int]]]]:
        """
        Get threats sorted by dependency count (fewer = stronger).
        
        Returns:
            List of (threat_id, threat, dependencies)
        """
        threats = self.threat_detector.detect_all_threats(board, player)
        
        result = []
        for i, threat in enumerate(threats.threat_positions):
            if i in used_threats:
                continue
            
            deps = self._dependency_graph.get(i, [])
            result.append((i, threat, deps))
        
        # Sort by: threat type priority, then dependency count
        priority = {
            ThreatType.FIVE: 0,
            ThreatType.OPEN_FOUR: 1,
            ThreatType.FOUR: 2,
            ThreatType.BROKEN_FOUR: 3,
            ThreatType.OPEN_THREE: 4,
            ThreatType.THREE: 5,
            ThreatType.BROKEN_THREE: 6,
        }
        
        result.sort(key=lambda x: (priority.get(x[1].type, 10), len(x[2])))
        return result
    
    def _dependencies_satisfied(
        self,
        board: List[List[Optional[str]]],
        deps: List[Tuple[int, int]],
        player: str
    ) -> bool:
        """
        Check if threat dependencies are satisfied.
        
        Dependencies are satisfied if blocking positions are
        either empty or occupied by the player.
        """
        opponent = "O" if player == "X" else "X"
        
        for pos in deps:
            if board[pos[0]][pos[1]] == opponent:
                return False
        
        return True
    
    def _find_threat_creating_move(
        self,
        board: List[List[Optional[str]]],
        threat: ThreatPosition,
        player: str
    ) -> Optional[Tuple[int, int]]:
        """
        Find the move that creates or extends a threat.
        """
        if not threat.positions:
            return None
        
        # Get direction
        direction_map = {
            "horizontal": (0, 1),
            "vertical": (1, 0),
            "diagonal_down": (1, 1),
            "diagonal_up": (1, -1),
        }
        
        dx, dy = direction_map.get(threat.direction, (0, 0))
        positions = sorted(threat.positions)
        
        # Check ends
        first = positions[0]
        last = positions[-1]
        
        before = (first[0] - dx, first[1] - dy)
        after = (last[0] + dx, last[1] + dy)
        
        if self._is_valid_pos(before) and board[before[0]][before[1]] is None:
            return before
        
        if self._is_valid_pos(after) and board[after[0]][after[1]] is None:
            return after
        
        return None
    
    def _find_open_four_win(
        self,
        board: List[List[Optional[str]]],
        threat: ThreatPosition,
        player: str
    ) -> Optional[Tuple[int, int]]:
        """Find winning move for an OPEN_FOUR."""
        return self._find_threat_creating_move(board, threat, player)
    
    def _find_forced_responses(
        self,
        board: List[List[Optional[str]]],
        threats,
        defender: str
    ) -> List[Tuple[int, int]]:
        """
        Find forced responses to threats.
        
        For VCF, defender must block FOUR threats.
        """
        responses = []
        
        for threat in threats.threat_positions:
            if threat.type in [ThreatType.FOUR, ThreatType.OPEN_FOUR, ThreatType.BROKEN_FOUR]:
                blocking = self._find_blocking_positions(board, threat)
                for pos in blocking:
                    if pos not in responses:
                        responses.append(pos)
        
        return responses
    
    def _find_vct_responses(
        self,
        board: List[List[Optional[str]]],
        threats,
        defender: str
    ) -> List[Tuple[int, int]]:
        """
        Find responses for VCT.
        
        Includes blocking THREE threats as well.
        """
        responses = []
        
        # First, must block FOURs
        for threat in threats.threat_positions:
            if threat.type in [ThreatType.FOUR, ThreatType.OPEN_FOUR, ThreatType.BROKEN_FOUR]:
                blocking = self._find_blocking_positions(board, threat)
                for pos in blocking:
                    if pos not in responses:
                        responses.append(pos)
        
        # If no FOURs, consider blocking THREEs
        if not responses:
            for threat in threats.threat_positions:
                if threat.type in [ThreatType.OPEN_THREE, ThreatType.THREE, ThreatType.BROKEN_THREE]:
                    blocking = self._find_blocking_positions(board, threat)
                    for pos in blocking:
                        if pos not in responses:
                            responses.append(pos)
        
        return responses
    
    def get_stats(self) -> Dict[str, int]:
        """Get search statistics."""
        return {
            "nodes_searched": self._nodes_searched,
            "pruned_by_dependency": self._pruned_by_dependency,
        }
