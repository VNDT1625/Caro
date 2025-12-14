"""
AI Match Analysis System - Threat Detection

This module implements the ThreatDetector class for scanning the board
and identifying all threat patterns (five, open_four, four, open_three, etc.)

Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
"""

from typing import List, Tuple, Optional, Set, Dict
from .types import (
    ThreatType,
    ThreatPosition,
    ThreatResult,
    DoubleThreatType,
    DoubleThreatPosition,
    THREAT_SCORES,
    DOUBLE_THREAT_SCORES,
    DOUBLE_THREAT_SEVERITY,
    BOARD_SIZE,
    WIN_LENGTH,
)


# Direction vectors for scanning lines
DIRECTIONS = {
    "horizontal": (0, 1),
    "vertical": (1, 0),
    "diagonal_down": (1, 1),  # top-left to bottom-right
    "diagonal_up": (1, -1),   # bottom-left to top-right
}


class ThreatDetector:
    """
    Detects threats on a Gomoku/Caro board.
    
    A threat is a pattern of consecutive pieces that could lead to a win.
    The detector scans all lines (horizontal, vertical, diagonal) and
    identifies patterns like five-in-a-row, open fours, fours, etc.
    
    Requirements:
    - 1.1: Scan lines and identify all threat patterns
    - 1.2: Classify threats with correct scoring
    - 1.3: Return structured result with counts, scores, and positions
    - 1.4: Recalculate threats within 100ms
    - 1.5: Detect all threats without duplication
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize the ThreatDetector.
        
        Args:
            board_size: Size of the board (default 15x15)
        """
        self.board_size = board_size
    
    def detect_all_threats(
        self, 
        board: List[List[Optional[str]]], 
        player: str
    ) -> ThreatResult:
        """
        Detect all threats for a player on the board.
        
        Scans all horizontal, vertical, and diagonal lines to find
        threat patterns. Returns a structured result with threat counts,
        total score, and detailed positions.
        
        Args:
            board: 2D array representing the board state (None, "X", or "O")
            player: The player to detect threats for ("X" or "O")
            
        Returns:
            ThreatResult with threats dict, total_score, and threat_positions
        """
        threats: dict = {t: 0 for t in ThreatType}
        threat_positions: List[ThreatPosition] = []
        seen_positions: Set[Tuple[Tuple[int, int], ...]] = set()
        
        # Scan all directions
        for direction_name, (dx, dy) in DIRECTIONS.items():
            # Get all starting points for this direction
            starts = self._get_line_starts(direction_name)
            
            for start_x, start_y in starts:
                line_threats = self.scan_line(
                    board, start_x, start_y, dx, dy, player
                )
                
                for threat in line_threats:
                    # Create a hashable key from positions to avoid duplicates
                    pos_key = tuple(sorted(threat.positions))
                    if pos_key not in seen_positions:
                        seen_positions.add(pos_key)
                        threats[threat.type] += 1
                        threat_positions.append(threat)
        
        # Calculate total score for single threats
        total_score = sum(
            count * THREAT_SCORES[threat_type]
            for threat_type, count in threats.items()
        )
        
        # Detect double threats (Task 8.2.2)
        double_threats, double_threat_positions = self.detect_double_threats(
            board, player, threat_positions
        )
        
        # Add double threat scores to total
        total_score += sum(
            count * DOUBLE_THREAT_SCORES[dt_type]
            for dt_type, count in double_threats.items()
        )
        
        return ThreatResult(
            threats=threats,
            total_score=total_score,
            threat_positions=threat_positions,
            double_threats=double_threats,
            double_threat_positions=double_threat_positions
        )
    
    def detect_double_threats(
        self,
        board: List[List[Optional[str]]],
        player: str,
        threat_positions: List[ThreatPosition]
    ) -> Tuple[Dict[DoubleThreatType, int], List[DoubleThreatPosition]]:
        """
        Detect double threats from existing threat positions.
        
        Task 8.2.2: Double Threat Detection
        Impact: Detect 100% winning combinations
        
        A double threat occurs when a single empty cell, if filled,
        would create two threats that the opponent cannot both block.
        
        Types detected:
        - DOUBLE_FOUR: 2 FOUR threats sharing a key position → guaranteed win
        - FOUR_THREE: FOUR + OPEN_THREE sharing a key position → guaranteed win
        - DOUBLE_THREE: 2 OPEN_THREE threats sharing a key position → very dangerous
        
        Args:
            board: 2D array representing the board state
            player: The player to detect double threats for
            threat_positions: List of already detected single threats
            
        Returns:
            Tuple of (double_threats count dict, double_threat_positions list)
        """
        double_threats: Dict[DoubleThreatType, int] = {dt: 0 for dt in DoubleThreatType}
        double_threat_positions: List[DoubleThreatPosition] = []
        seen_pairs: Set[Tuple[int, ...]] = set()
        
        # Build a map of empty cells that are adjacent to threats
        # Key: (x, y) of empty cell, Value: list of threats that could use this cell
        potential_threat_cells: Dict[Tuple[int, int], List[ThreatPosition]] = {}
        
        for threat in threat_positions:
            # Find empty cells adjacent to this threat that could extend it
            adjacent_empty = self._find_threat_extension_cells(board, threat, player)
            for cell in adjacent_empty:
                if cell not in potential_threat_cells:
                    potential_threat_cells[cell] = []
                potential_threat_cells[cell].append(threat)
        
        # Check each potential cell for double threats
        for cell, threats_at_cell in potential_threat_cells.items():
            if len(threats_at_cell) < 2:
                continue
            
            # Check all pairs of threats at this cell
            for i in range(len(threats_at_cell)):
                for j in range(i + 1, len(threats_at_cell)):
                    threat1 = threats_at_cell[i]
                    threat2 = threats_at_cell[j]
                    
                    # Skip if same direction (not a true double threat)
                    if threat1.direction == threat2.direction:
                        continue
                    
                    # Create a unique key for this pair to avoid duplicates
                    pair_key = tuple(sorted([
                        id(threat1), id(threat2)
                    ]))
                    if pair_key in seen_pairs:
                        continue
                    seen_pairs.add(pair_key)
                    
                    # Determine the type of double threat
                    double_type = self._classify_double_threat(threat1, threat2)
                    if double_type is not None:
                        double_threats[double_type] += 1
                        double_threat_positions.append(DoubleThreatPosition(
                            type=double_type,
                            key_position=cell,
                            threat1=threat1,
                            threat2=threat2,
                            severity=DOUBLE_THREAT_SEVERITY[double_type]
                        ))
        
        return double_threats, double_threat_positions
    
    def _find_threat_extension_cells(
        self,
        board: List[List[Optional[str]]],
        threat: ThreatPosition,
        player: str
    ) -> List[Tuple[int, int]]:
        """
        Find empty cells that could extend a threat.
        
        For a threat to be part of a double threat, there must be
        an empty cell that, if filled, would strengthen the threat.
        
        Args:
            board: 2D array representing the board state
            threat: The threat to find extension cells for
            player: The player who owns the threat
            
        Returns:
            List of (x, y) coordinates of empty cells that extend the threat
        """
        extension_cells: List[Tuple[int, int]] = []
        
        if not threat.positions:
            return extension_cells
        
        # Get direction vectors
        dx, dy = DIRECTIONS.get(threat.direction, (0, 0))
        if dx == 0 and dy == 0:
            return extension_cells
        
        # Sort positions along the direction to find endpoints
        # For diagonal_up (1, -1), we need to sort differently
        if threat.direction == "diagonal_up":
            # Sort by x ascending (which means y descending due to direction)
            positions = sorted(threat.positions, key=lambda p: p[0])
        else:
            # For other directions, sort by (x, y) tuple
            positions = sorted(threat.positions)
        
        first_pos = positions[0]
        last_pos = positions[-1]
        
        # Check cell before the first position (opposite direction)
        before_x = first_pos[0] - dx
        before_y = first_pos[1] - dy
        if (0 <= before_x < self.board_size and 
            0 <= before_y < self.board_size and
            board[before_x][before_y] is None):
            extension_cells.append((before_x, before_y))
        
        # Check cell after the last position (same direction)
        after_x = last_pos[0] + dx
        after_y = last_pos[1] + dy
        if (0 <= after_x < self.board_size and 
            0 <= after_y < self.board_size and
            board[after_x][after_y] is None):
            extension_cells.append((after_x, after_y))
        
        # For broken patterns, also check the gap positions
        if threat.type in [ThreatType.BROKEN_FOUR, ThreatType.BROKEN_THREE, ThreatType.JUMP_THREE]:
            # Find gaps in the threat by walking through positions
            for i in range(len(positions) - 1):
                curr = positions[i]
                next_pos = positions[i + 1]
                # Walk from curr to next_pos and find gaps
                walk_x, walk_y = curr[0] + dx, curr[1] + dy
                max_steps = self.board_size  # Safety limit
                steps = 0
                while (walk_x, walk_y) != next_pos and steps < max_steps:
                    if (0 <= walk_x < self.board_size and 
                        0 <= walk_y < self.board_size and
                        board[walk_x][walk_y] is None):
                        extension_cells.append((walk_x, walk_y))
                    walk_x += dx
                    walk_y += dy
                    steps += 1
                    # Safety check to prevent infinite loop
                    if not (0 <= walk_x < self.board_size and 0 <= walk_y < self.board_size):
                        break
        
        return extension_cells
    
    def _classify_double_threat(
        self,
        threat1: ThreatPosition,
        threat2: ThreatPosition
    ) -> Optional[DoubleThreatType]:
        """
        Classify the type of double threat from two single threats.
        
        Task 8.2.2: Double Threat Detection
        
        Classification rules:
        - DOUBLE_FOUR: Both threats are FOUR or OPEN_FOUR or BROKEN_FOUR
        - FOUR_THREE: One is FOUR-type, other is THREE-type (open)
        - DOUBLE_THREE: Both are OPEN_THREE or BROKEN_THREE
        
        Args:
            threat1: First threat
            threat2: Second threat
            
        Returns:
            DoubleThreatType or None if not a significant double threat
        """
        four_types = {ThreatType.FOUR, ThreatType.OPEN_FOUR, ThreatType.BROKEN_FOUR}
        three_types = {ThreatType.OPEN_THREE, ThreatType.THREE, ThreatType.BROKEN_THREE}
        
        t1_is_four = threat1.type in four_types
        t2_is_four = threat2.type in four_types
        t1_is_three = threat1.type in three_types
        t2_is_three = threat2.type in three_types
        
        # DOUBLE_FOUR: Both are four-type threats
        if t1_is_four and t2_is_four:
            return DoubleThreatType.DOUBLE_FOUR
        
        # FOUR_THREE: One four-type and one three-type
        if (t1_is_four and t2_is_three) or (t1_is_three and t2_is_four):
            return DoubleThreatType.FOUR_THREE
        
        # DOUBLE_THREE: Both are three-type threats
        if t1_is_three and t2_is_three:
            return DoubleThreatType.DOUBLE_THREE
        
        return None

    def scan_line(
        self,
        board: List[List[Optional[str]]],
        start_x: int,
        start_y: int,
        dx: int,
        dy: int,
        player: str
    ) -> List[ThreatPosition]:
        """
        Scan a single line for threats.
        
        Scans from the starting position in the given direction,
        identifying all threat patterns along the line.
        
        Args:
            board: 2D array representing the board state
            start_x: Starting row index
            start_y: Starting column index
            dx: Row direction (0, 1, or -1)
            dy: Column direction (0, 1, or -1)
            player: The player to detect threats for
            
        Returns:
            List of ThreatPosition objects found on this line
        """
        threats: List[ThreatPosition] = []
        direction_name = self._get_direction_name(dx, dy)
        
        # Extract the line as a list of (x, y, cell_value)
        line: List[Tuple[int, int, Optional[str]]] = []
        x, y = start_x, start_y
        
        while 0 <= x < self.board_size and 0 <= y < self.board_size:
            line.append((x, y, board[x][y]))
            x += dx
            y += dy
        
        # Need at least 2 cells for any pattern (OPEN_TWO)
        # Broken patterns need at least 4 cells (BROKEN_THREE: X_XX)
        if len(line) < 2:
            return threats
        
        # Scan for patterns using a sliding window approach
        # Note: _find_patterns_in_line handles both consecutive and broken patterns
        # and has its own length checks for each pattern type
        threats.extend(self._find_patterns_in_line(line, player, direction_name))
        
        return threats
    
    def _find_patterns_in_line(
        self,
        line: List[Tuple[int, int, Optional[str]]],
        player: str,
        direction: str
    ) -> List[ThreatPosition]:
        """
        Find all threat patterns in a line using a sliding window approach.
        
        This algorithm scans through a line (horizontal, vertical, or diagonal)
        to find consecutive pieces belonging to the specified player. For each
        sequence found, it determines:
        1. How many consecutive pieces exist
        2. Whether the ends are open (empty), blocked (opponent), or at edge
        3. The threat classification based on these factors
        
        Pattern Classification Logic:
        - FIVE: 5+ consecutive pieces (winning condition)
        - OPEN_FOUR: 4 pieces with both ends open (guaranteed win next move)
        - FOUR: 4 pieces with one end open (forces opponent to block)
        - BROKEN_FOUR: 4 pieces with 1 gap (X_XXX, XX_XX, XXX_X)
        - OPEN_THREE: 3 pieces with both ends open (strong threat)
        - THREE: 3 pieces with one end open (developing threat)
        - BROKEN_THREE: 3 pieces with 1 gap (X_XX, XX_X)
        - JUMP_THREE: 3 pieces with 2 gaps (X__XX, XX__X)
        - OPEN_TWO: 2 pieces with both ends open (early development)
        
        Args:
            line: List of (x, y, cell_value) tuples representing the line
            player: The player to detect threats for ("X" or "O")
            direction: Direction name for the threat position
            
        Returns:
            List of ThreatPosition objects found in this line
        """
        threats: List[ThreatPosition] = []
        n = len(line)
        i = 0
        
        # First, detect broken patterns (patterns with gaps)
        broken_threats = self._find_broken_patterns_in_line(line, player, direction)
        threats.extend(broken_threats)
        
        # SLIDING WINDOW: Scan through the line for consecutive patterns
        while i < n:
            # Skip cells that don't belong to the player
            if line[i][2] != player:
                i += 1
                continue
            
            # FOUND PLAYER'S PIECE: Start counting consecutive pieces
            start_idx = i
            positions: List[Tuple[int, int]] = []
            
            # Count consecutive pieces and collect their positions
            while i < n and line[i][2] == player:
                positions.append((line[i][0], line[i][1]))
                i += 1
            
            count = len(positions)
            
            # ANALYZE ENDS: Check what's on either side of the sequence
            # An "open" end has an empty cell, allowing extension
            left_open = start_idx > 0 and line[start_idx - 1][2] is None
            right_open = i < n and line[i][2] is None
            
            # A "blocked" end has an opponent's piece, preventing extension
            left_blocked = start_idx > 0 and line[start_idx - 1][2] is not None and line[start_idx - 1][2] != player
            right_blocked = i < n and line[i][2] is not None and line[i][2] != player
            
            # Board edges count as blocked (can't extend beyond the board)
            if start_idx == 0:
                left_blocked = True
            if i == n:
                right_blocked = True
            
            # Count open ends (0, 1, or 2)
            open_ends = (1 if left_open else 0) + (1 if right_open else 0)
            
            # CLASSIFY THE THREAT based on piece count and open ends
            threat_type = self.classify_threat(count, open_ends, left_blocked, right_blocked)
            
            # Only add significant threats (classify_threat returns None for insignificant patterns)
            if threat_type is not None:
                threats.append(ThreatPosition(
                    type=threat_type,
                    positions=positions,
                    direction=direction
                ))
        
        return threats
    
    def _find_broken_patterns_in_line(
        self,
        line: List[Tuple[int, int, Optional[str]]],
        player: str,
        direction: str
    ) -> List[ThreatPosition]:
        """
        Find broken patterns (patterns with gaps) in a line.
        
        Broken patterns are sequences where pieces are separated by empty cells:
        - BROKEN_FOUR: X_XXX, XX_XX, XXX_X (4 pieces with 1 gap)
        - BROKEN_THREE: X_XX, XX_X (3 pieces with 1 gap)
        - JUMP_THREE: X__XX, XX__X (3 pieces with 2 gaps)
        
        Task 8.2.1: Broken Pattern Detection
        Impact: +20% threat detection accuracy
        
        Args:
            line: List of (x, y, cell_value) tuples representing the line
            player: The player to detect threats for ("X" or "O")
            direction: Direction name for the threat position
            
        Returns:
            List of ThreatPosition objects for broken patterns found
        """
        threats: List[ThreatPosition] = []
        n = len(line)
        
        # We need at least 4 cells to have a broken three (X_XX)
        if n < 4:
            return threats
        
        # Scan using a sliding window of size 5 for broken fours
        # and size 4 for broken threes
        
        # Detect BROKEN_FOUR patterns (5 cells: X_XXX, XX_XX, XXX_X)
        for i in range(n - 4):
            window = line[i:i+5]
            broken_four = self._check_broken_four(window, player)
            if broken_four:
                positions = [(window[j][0], window[j][1]) for j in broken_four]
                threats.append(ThreatPosition(
                    type=ThreatType.BROKEN_FOUR,
                    positions=positions,
                    direction=direction
                ))
        
        # Detect BROKEN_THREE patterns (4 cells: X_XX, XX_X)
        for i in range(n - 3):
            window = line[i:i+4]
            broken_three = self._check_broken_three(window, player)
            if broken_three:
                positions = [(window[j][0], window[j][1]) for j in broken_three]
                # Check if this is not part of a broken four (avoid double counting)
                if not self._is_part_of_broken_four(line, i, i+4, player):
                    threats.append(ThreatPosition(
                        type=ThreatType.BROKEN_THREE,
                        positions=positions,
                        direction=direction
                    ))
        
        # Detect JUMP_THREE patterns (5 cells: X__XX, XX__X)
        for i in range(n - 4):
            window = line[i:i+5]
            jump_three = self._check_jump_three(window, player)
            if jump_three:
                positions = [(window[j][0], window[j][1]) for j in jump_three]
                threats.append(ThreatPosition(
                    type=ThreatType.JUMP_THREE,
                    positions=positions,
                    direction=direction
                ))
        
        return threats
    
    def _check_broken_four(
        self,
        window: List[Tuple[int, int, Optional[str]]],
        player: str
    ) -> Optional[List[int]]:
        """
        Check if a 5-cell window contains a broken four pattern.
        
        Broken four patterns (4 pieces, 1 gap):
        - X_XXX (indices 0, 2, 3, 4)
        - XX_XX (indices 0, 1, 3, 4)
        - XXX_X (indices 0, 1, 2, 4)
        
        Args:
            window: 5-cell window from the line
            player: Player to check for
            
        Returns:
            List of indices where player pieces are, or None if no pattern
        """
        if len(window) != 5:
            return None
        
        cells = [w[2] for w in window]
        
        # Pattern: X_XXX (gap at index 1)
        if (cells[0] == player and cells[1] is None and 
            cells[2] == player and cells[3] == player and cells[4] == player):
            return [0, 2, 3, 4]
        
        # Pattern: XX_XX (gap at index 2)
        if (cells[0] == player and cells[1] == player and 
            cells[2] is None and cells[3] == player and cells[4] == player):
            return [0, 1, 3, 4]
        
        # Pattern: XXX_X (gap at index 3)
        if (cells[0] == player and cells[1] == player and 
            cells[2] == player and cells[3] is None and cells[4] == player):
            return [0, 1, 2, 4]
        
        return None
    
    def _check_broken_three(
        self,
        window: List[Tuple[int, int, Optional[str]]],
        player: str
    ) -> Optional[List[int]]:
        """
        Check if a 4-cell window contains a broken three pattern.
        
        Broken three patterns (3 pieces, 1 gap):
        - X_XX (indices 0, 2, 3)
        - XX_X (indices 0, 1, 3)
        
        Args:
            window: 4-cell window from the line
            player: Player to check for
            
        Returns:
            List of indices where player pieces are, or None if no pattern
        """
        if len(window) != 4:
            return None
        
        cells = [w[2] for w in window]
        
        # Pattern: X_XX (gap at index 1)
        if (cells[0] == player and cells[1] is None and 
            cells[2] == player and cells[3] == player):
            return [0, 2, 3]
        
        # Pattern: XX_X (gap at index 2)
        if (cells[0] == player and cells[1] == player and 
            cells[2] is None and cells[3] == player):
            return [0, 1, 3]
        
        return None
    
    def _check_jump_three(
        self,
        window: List[Tuple[int, int, Optional[str]]],
        player: str
    ) -> Optional[List[int]]:
        """
        Check if a 5-cell window contains a jump three pattern.
        
        Jump three patterns (3 pieces, 2 gaps):
        - X__XX (indices 0, 3, 4)
        - XX__X (indices 0, 1, 4)
        
        Args:
            window: 5-cell window from the line
            player: Player to check for
            
        Returns:
            List of indices where player pieces are, or None if no pattern
        """
        if len(window) != 5:
            return None
        
        cells = [w[2] for w in window]
        
        # Pattern: X__XX (gaps at indices 1, 2)
        if (cells[0] == player and cells[1] is None and 
            cells[2] is None and cells[3] == player and cells[4] == player):
            return [0, 3, 4]
        
        # Pattern: XX__X (gaps at indices 2, 3)
        if (cells[0] == player and cells[1] == player and 
            cells[2] is None and cells[3] is None and cells[4] == player):
            return [0, 1, 4]
        
        return None
    
    def _is_part_of_broken_four(
        self,
        line: List[Tuple[int, int, Optional[str]]],
        start: int,
        end: int,
        player: str
    ) -> bool:
        """
        Check if a broken three pattern is part of a larger broken four.
        
        This prevents double-counting when a broken three is contained
        within a broken four pattern.
        
        Args:
            line: The full line
            start: Start index of the broken three
            end: End index of the broken three
            player: Player to check for
            
        Returns:
            True if the pattern is part of a broken four
        """
        n = len(line)
        
        # Check if extending left creates a broken four
        if start > 0:
            extended_start = start - 1
            if extended_start >= 0 and end <= n:
                window = line[extended_start:end]
                if len(window) == 5 and self._check_broken_four(window, player):
                    return True
        
        # Check if extending right creates a broken four
        if end < n:
            extended_end = end + 1
            if start >= 0 and extended_end <= n:
                window = line[start:extended_end]
                if len(window) == 5 and self._check_broken_four(window, player):
                    return True
        
        return False
    
    def classify_threat(
        self,
        count: int,
        open_ends: int,
        left_blocked: bool = False,
        right_blocked: bool = False
    ) -> Optional[ThreatType]:
        """
        Classify a threat based on piece count and open ends.
        
        Scoring (Requirements 1.2):
        - FIVE: 5+ consecutive pieces (100000 points)
        - OPEN_FOUR: 4 consecutive with both ends open (10000 points)
        - FOUR: 4 consecutive with one end open (1000 points)
        - OPEN_THREE: 3 consecutive with both ends open (500 points)
        - THREE: 3 consecutive with one end open (100 points)
        - OPEN_TWO: 2 consecutive with both ends open (10 points)
        
        Args:
            count: Number of consecutive pieces
            open_ends: Number of open ends (0, 1, or 2)
            left_blocked: Whether left side is blocked
            right_blocked: Whether right side is blocked
            
        Returns:
            ThreatType or None if not a significant threat
        """
        if count >= WIN_LENGTH:
            return ThreatType.FIVE
        
        if count == 4:
            if open_ends == 2:
                return ThreatType.OPEN_FOUR
            elif open_ends == 1:
                return ThreatType.FOUR
            # If both ends blocked, it's not a threat
            return None
        
        if count == 3:
            if open_ends == 2:
                return ThreatType.OPEN_THREE
            elif open_ends == 1:
                return ThreatType.THREE
            return None
        
        if count == 2:
            if open_ends == 2:
                return ThreatType.OPEN_TWO
            # Two with only one open end is not significant
            return None
        
        # Single piece or no open ends - not a threat
        return None
    
    def _get_line_starts(self, direction: str) -> List[Tuple[int, int]]:
        """
        Get all starting positions for scanning lines in a direction.
        
        Args:
            direction: Direction name
            
        Returns:
            List of (x, y) starting positions
        """
        starts: List[Tuple[int, int]] = []
        
        if direction == "horizontal":
            # Start from left edge of each row
            for x in range(self.board_size):
                starts.append((x, 0))
        
        elif direction == "vertical":
            # Start from top edge of each column
            for y in range(self.board_size):
                starts.append((0, y))
        
        elif direction == "diagonal_down":
            # Start from top row and left column
            for y in range(self.board_size):
                starts.append((0, y))
            for x in range(1, self.board_size):
                starts.append((x, 0))
        
        elif direction == "diagonal_up":
            # Start from top row and right column
            # Direction (1, -1) goes from top-right to bottom-left
            for y in range(self.board_size):
                starts.append((0, y))
            for x in range(1, self.board_size):
                starts.append((x, self.board_size - 1))
        
        return starts
    
    def _get_direction_name(self, dx: int, dy: int) -> str:
        """
        Get the direction name from direction vectors.
        
        Args:
            dx: Row direction
            dy: Column direction
            
        Returns:
            Direction name string
        """
        for name, (d_x, d_y) in DIRECTIONS.items():
            if dx == d_x and dy == d_y:
                return name
        return "unknown"
    
    def get_threat_score(self, threat_type: ThreatType) -> int:
        """
        Get the score value for a threat type.
        
        Args:
            threat_type: The type of threat
            
        Returns:
            Integer score value
        """
        return THREAT_SCORES.get(threat_type, 0)
