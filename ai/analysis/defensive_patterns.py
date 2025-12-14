"""
AI Match Analysis System - Defensive Pattern Recognition

This module implements the DefensivePatternRecognizer class for detecting
and praising good defensive moves in Gomoku/Caro games.

Requirements: 17.1, 17.2, 17.3, 17.4
- 17.1: Recognize Double Block (Chặn Kép) - blocks two threats simultaneously
- 17.2: Recognize Sacrifice Block (Chặn Hi Sinh) - sacrifices blocking one threat for counter-attack
- 17.3: Recognize Preventive Block (Chặn Phòng Ngừa) - prevents opponent from creating fork
- 17.4: Use Vietnamese pattern names
"""

from typing import List, Tuple, Optional, Dict, Set
from dataclasses import dataclass
from enum import Enum

from .types import (
    ThreatType,
    ThreatPosition,
    ThreatResult,
    DoubleThreatType,
    DoubleThreatPosition,
    BOARD_SIZE,
)


class DefensivePatternType(Enum):
    """
    Types of defensive patterns that can be recognized.
    
    Requirements 17.1, 17.2, 17.3, 17.4:
    - DOUBLE_BLOCK: Chặn Kép - blocks two threats simultaneously
    - SACRIFICE_BLOCK: Chặn Hi Sinh - sacrifices blocking one threat for counter-attack
    - PREVENTIVE_BLOCK: Chặn Phòng Ngừa - prevents opponent from creating fork
    """
    DOUBLE_BLOCK = "double_block"
    SACRIFICE_BLOCK = "sacrifice_block"
    PREVENTIVE_BLOCK = "preventive_block"


# Vietnamese pattern names (Requirements 17.4)
DEFENSIVE_PATTERN_NAMES_VI: Dict[DefensivePatternType, str] = {
    DefensivePatternType.DOUBLE_BLOCK: "Chặn Kép",
    DefensivePatternType.SACRIFICE_BLOCK: "Chặn Hi Sinh",
    DefensivePatternType.PREVENTIVE_BLOCK: "Chặn Phòng Ngừa",
}

# English pattern names
DEFENSIVE_PATTERN_NAMES_EN: Dict[DefensivePatternType, str] = {
    DefensivePatternType.DOUBLE_BLOCK: "Double Block",
    DefensivePatternType.SACRIFICE_BLOCK: "Sacrifice Block",
    DefensivePatternType.PREVENTIVE_BLOCK: "Preventive Block",
}

# Chinese pattern names
DEFENSIVE_PATTERN_NAMES_ZH: Dict[DefensivePatternType, str] = {
    DefensivePatternType.DOUBLE_BLOCK: "双挡",
    DefensivePatternType.SACRIFICE_BLOCK: "弃挡反击",
    DefensivePatternType.PREVENTIVE_BLOCK: "预防挡",
}

# Japanese pattern names
DEFENSIVE_PATTERN_NAMES_JA: Dict[DefensivePatternType, str] = {
    DefensivePatternType.DOUBLE_BLOCK: "ダブルブロック",
    DefensivePatternType.SACRIFICE_BLOCK: "犠牲ブロック",
    DefensivePatternType.PREVENTIVE_BLOCK: "予防ブロック",
}

# All language pattern names
DEFENSIVE_PATTERN_NAMES: Dict[str, Dict[DefensivePatternType, str]] = {
    "vi": DEFENSIVE_PATTERN_NAMES_VI,
    "en": DEFENSIVE_PATTERN_NAMES_EN,
    "zh": DEFENSIVE_PATTERN_NAMES_ZH,
    "ja": DEFENSIVE_PATTERN_NAMES_JA,
}


@dataclass
class DefensivePattern:
    """
    Represents a detected defensive pattern.
    
    Attributes:
        pattern_type: Type of defensive pattern
        pattern_name_vi: Vietnamese name of the pattern
        threats_blocked: List of threats that were blocked
        explanation: Explanation of the defensive move
        move_position: Position of the defensive move (x, y)
        counter_attack_created: True if move also creates counter-attack
        prevented_fork: True if move prevents opponent fork
    """
    pattern_type: DefensivePatternType
    pattern_name_vi: str
    threats_blocked: List[ThreatPosition]
    explanation: str
    move_position: Tuple[int, int]
    counter_attack_created: bool = False
    prevented_fork: bool = False
    
    def get_pattern_name(self, language: str = "vi") -> str:
        """Get pattern name in specified language."""
        names = DEFENSIVE_PATTERN_NAMES.get(language, DEFENSIVE_PATTERN_NAMES_VI)
        return names.get(self.pattern_type, self.pattern_name_vi)


class DefensivePatternRecognizer:
    """
    Recognizes defensive patterns in Gomoku/Caro games.
    
    Requirements:
    - 17.1: Detect Double Block (Chặn Kép)
    - 17.2: Detect Sacrifice Block (Chặn Hi Sinh)
    - 17.3: Detect Preventive Block (Chặn Phòng Ngừa)
    - 17.4: Use Vietnamese pattern names
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize the DefensivePatternRecognizer.
        
        Args:
            board_size: Size of the board (default 15x15)
        """
        self.board_size = board_size
    
    def detect_defensive_patterns(
        self,
        board: List[List[Optional[str]]],
        move: Tuple[int, int],
        player: str,
        threats_before: ThreatResult,
        threats_after: ThreatResult,
        player_threats_after: Optional[ThreatResult] = None
    ) -> List[DefensivePattern]:
        """
        Detect all defensive patterns for a move.
        
        Args:
            board: 2D array representing the board state after the move
            move: Position of the move (x, y)
            player: Player who made the move ("X" or "O")
            threats_before: Opponent's threats before the move
            threats_after: Opponent's threats after the move
            player_threats_after: Player's threats after the move (for counter-attack detection)
            
        Returns:
            List of detected defensive patterns
        """
        patterns: List[DefensivePattern] = []
        
        # Detect Double Block (Requirements 17.1)
        double_block = self.detect_double_block(
            board, move, player, threats_before, threats_after
        )
        if double_block:
            patterns.append(double_block)
        
        # Detect Sacrifice Block (Requirements 17.2)
        sacrifice_block = self.detect_sacrifice_block(
            board, move, player, threats_before, threats_after, player_threats_after
        )
        if sacrifice_block:
            patterns.append(sacrifice_block)
        
        # Detect Preventive Block (Requirements 17.3)
        preventive_block = self.detect_preventive_block(
            board, move, player, threats_before, threats_after
        )
        if preventive_block:
            patterns.append(preventive_block)
        
        return patterns
    
    def detect_double_block(
        self,
        board: List[List[Optional[str]]],
        move: Tuple[int, int],
        player: str,
        threats_before: ThreatResult,
        threats_after: ThreatResult
    ) -> Optional[DefensivePattern]:
        """
        Detect if a move blocks two threats simultaneously (Chặn Kép).
        
        Requirements 17.1: WHEN a move blocks two threats simultaneously (Double Block)
        THEN the Analysis_System SHALL recognize and praise it
        
        A Double Block occurs when:
        1. Before the move, opponent had 2+ threats
        2. The move position is on the path of 2+ different threats
        3. After the move, those threats are blocked/reduced
        
        Args:
            board: 2D array representing the board state after the move
            move: Position of the move (x, y)
            player: Player who made the move
            threats_before: Opponent's threats before the move
            threats_after: Opponent's threats after the move
            
        Returns:
            DefensivePattern if double block detected, None otherwise
        """
        # Find threats that were blocked by this move
        blocked_threats = self._find_blocked_threats(
            move, threats_before, threats_after
        )
        
        # Need at least 2 blocked threats for a double block
        if len(blocked_threats) < 2:
            return None
        
        # Verify the threats are in different directions (true double block)
        directions = set(t.direction for t in blocked_threats)
        if len(directions) < 2:
            # Same direction threats - not a true double block
            return None
        
        # Create explanation
        threat_types = [t.type.value for t in blocked_threats]
        explanation = f"Chặn đồng thời {len(blocked_threats)} đe dọa: {', '.join(threat_types)}"
        
        return DefensivePattern(
            pattern_type=DefensivePatternType.DOUBLE_BLOCK,
            pattern_name_vi=DEFENSIVE_PATTERN_NAMES_VI[DefensivePatternType.DOUBLE_BLOCK],
            threats_blocked=blocked_threats,
            explanation=explanation,
            move_position=move,
            counter_attack_created=False,
            prevented_fork=False
        )
    
    def detect_sacrifice_block(
        self,
        board: List[List[Optional[str]]],
        move: Tuple[int, int],
        player: str,
        threats_before: ThreatResult,
        threats_after: ThreatResult,
        player_threats_after: Optional[ThreatResult] = None
    ) -> Optional[DefensivePattern]:
        """
        Detect if a move sacrifices blocking one threat to create counter-attack (Chặn Hi Sinh).
        
        Requirements 17.2: WHEN a move sacrifices blocking one threat to create stronger
        counter-attack (Sacrifice Block) THEN the Analysis_System SHALL explain the trade-off
        
        A Sacrifice Block occurs when:
        1. Before the move, opponent had multiple threats
        2. The move blocks one threat but not all
        3. The move creates a stronger counter-attack threat for the player
        
        Args:
            board: 2D array representing the board state after the move
            move: Position of the move (x, y)
            player: Player who made the move
            threats_before: Opponent's threats before the move
            threats_after: Opponent's threats after the move
            player_threats_after: Player's threats after the move
            
        Returns:
            DefensivePattern if sacrifice block detected, None otherwise
        """
        if player_threats_after is None:
            return None
        
        # Find blocked threats
        blocked_threats = self._find_blocked_threats(
            move, threats_before, threats_after
        )
        
        # Need at least 1 blocked threat
        if len(blocked_threats) < 1:
            return None
        
        # Check if there are still remaining opponent threats (sacrifice aspect)
        remaining_threats = self._count_significant_threats(threats_after)
        if remaining_threats == 0:
            # All threats blocked - not a sacrifice
            return None
        
        # Check if player created counter-attack
        player_significant_threats = self._count_significant_threats(player_threats_after)
        if player_significant_threats == 0:
            return None
        
        # Check if counter-attack is stronger than remaining opponent threats
        player_score = player_threats_after.total_score
        opponent_remaining_score = threats_after.total_score
        
        # Counter-attack should be at least as strong as remaining threats
        if player_score < opponent_remaining_score * 0.8:
            return None
        
        # Create explanation
        blocked_types = [t.type.value for t in blocked_threats]
        explanation = (
            f"Chặn {', '.join(blocked_types)} và tạo phản công mạnh hơn. "
            f"Điểm phản công: {player_score}, Đe dọa còn lại: {opponent_remaining_score}"
        )
        
        return DefensivePattern(
            pattern_type=DefensivePatternType.SACRIFICE_BLOCK,
            pattern_name_vi=DEFENSIVE_PATTERN_NAMES_VI[DefensivePatternType.SACRIFICE_BLOCK],
            threats_blocked=blocked_threats,
            explanation=explanation,
            move_position=move,
            counter_attack_created=True,
            prevented_fork=False
        )
    
    def detect_preventive_block(
        self,
        board: List[List[Optional[str]]],
        move: Tuple[int, int],
        player: str,
        threats_before: ThreatResult,
        threats_after: ThreatResult
    ) -> Optional[DefensivePattern]:
        """
        Detect if a move prevents opponent from creating a fork (Chặn Phòng Ngừa).
        
        Requirements 17.3: WHEN a move prevents opponent from creating a fork
        (Preventive Block) THEN the Analysis_System SHALL acknowledge the foresight
        
        A Preventive Block occurs when:
        1. Before the move, opponent had potential to create a fork (double threat)
        2. The move position blocks the key cell that would create the fork
        3. After the move, opponent can no longer create that fork
        
        Args:
            board: 2D array representing the board state after the move
            move: Position of the move (x, y)
            player: Player who made the move
            threats_before: Opponent's threats before the move
            threats_after: Opponent's threats after the move
            
        Returns:
            DefensivePattern if preventive block detected, None otherwise
        """
        # Check if opponent had potential double threats before
        double_threats_before = threats_before.double_threat_positions
        
        # Check if any double threat was prevented
        prevented_double_threats: List[DoubleThreatPosition] = []
        
        for dt in double_threats_before:
            # Check if the move position is the key position of the double threat
            if dt.key_position == move:
                prevented_double_threats.append(dt)
        
        if not prevented_double_threats:
            # Also check if move blocks a position that could become a fork
            # by checking if opponent's double threat count decreased
            double_threats_after = threats_after.double_threat_positions
            
            # Count double threats that were eliminated
            before_count = len(double_threats_before)
            after_count = len(double_threats_after)
            
            if before_count > after_count:
                # Some double threats were prevented
                # Find which ones were blocked
                after_keys = {dt.key_position for dt in double_threats_after}
                for dt in double_threats_before:
                    if dt.key_position not in after_keys:
                        # This double threat was prevented
                        # Check if our move is adjacent to the key position
                        if self._is_adjacent(move, dt.key_position):
                            prevented_double_threats.append(dt)
        
        if not prevented_double_threats:
            return None
        
        # Get the threats that were part of the prevented fork
        blocked_threats: List[ThreatPosition] = []
        for dt in prevented_double_threats:
            blocked_threats.append(dt.threat1)
            blocked_threats.append(dt.threat2)
        
        # Remove duplicates
        seen_positions: Set[Tuple[Tuple[int, int], ...]] = set()
        unique_blocked: List[ThreatPosition] = []
        for t in blocked_threats:
            pos_key = tuple(sorted(t.positions))
            if pos_key not in seen_positions:
                seen_positions.add(pos_key)
                unique_blocked.append(t)
        
        # Create explanation
        fork_types = [dt.type.value for dt in prevented_double_threats]
        explanation = (
            f"Ngăn chặn đối thủ tạo fork ({', '.join(fork_types)}). "
            f"Nước đi có tầm nhìn xa!"
        )
        
        return DefensivePattern(
            pattern_type=DefensivePatternType.PREVENTIVE_BLOCK,
            pattern_name_vi=DEFENSIVE_PATTERN_NAMES_VI[DefensivePatternType.PREVENTIVE_BLOCK],
            threats_blocked=unique_blocked,
            explanation=explanation,
            move_position=move,
            counter_attack_created=False,
            prevented_fork=True
        )
    
    def _find_blocked_threats(
        self,
        move: Tuple[int, int],
        threats_before: ThreatResult,
        threats_after: ThreatResult
    ) -> List[ThreatPosition]:
        """
        Find threats that were blocked by a move.
        
        A threat is considered blocked if:
        1. It existed before the move
        2. The move position is on the threat's line
        3. The threat no longer exists or is weaker after the move
        
        Args:
            move: Position of the move (x, y)
            threats_before: Opponent's threats before the move
            threats_after: Opponent's threats after the move
            
        Returns:
            List of threats that were blocked
        """
        blocked: List[ThreatPosition] = []
        
        # Create a set of threat positions that still exist after the move
        after_positions: Set[Tuple[Tuple[int, int], ...]] = set()
        for t in threats_after.threat_positions:
            pos_key = tuple(sorted(t.positions))
            after_positions.add(pos_key)
        
        # Check each threat from before
        for threat in threats_before.threat_positions:
            pos_key = tuple(sorted(threat.positions))
            
            # Check if move is on the threat's line (adjacent or in the path)
            if self._is_move_blocking_threat(move, threat):
                # Check if threat no longer exists or is weaker
                if pos_key not in after_positions:
                    blocked.append(threat)
                else:
                    # Check if threat type is weaker
                    for after_threat in threats_after.threat_positions:
                        after_key = tuple(sorted(after_threat.positions))
                        if after_key == pos_key:
                            if self._is_threat_weaker(threat.type, after_threat.type):
                                blocked.append(threat)
                            break
        
        return blocked
    
    def _is_move_blocking_threat(
        self,
        move: Tuple[int, int],
        threat: ThreatPosition
    ) -> bool:
        """
        Check if a move position blocks a threat.
        
        A move blocks a threat if it's:
        1. On the same line as the threat
        2. Adjacent to the threat positions
        3. In the extension path of the threat
        
        Args:
            move: Position of the move (x, y)
            threat: The threat to check
            
        Returns:
            True if move blocks the threat
        """
        mx, my = move
        
        # Check if move is directly on one of the threat positions
        # (This shouldn't happen in normal play, but check anyway)
        if move in threat.positions:
            return True
        
        # Check if move is adjacent to any threat position
        for tx, ty in threat.positions:
            if abs(mx - tx) <= 1 and abs(my - ty) <= 1:
                return True
        
        # Check if move is on the same line as the threat
        if not threat.positions:
            return False
        
        # Get direction of the threat
        direction = threat.direction
        
        # Check if move is on the extension of the threat line
        if len(threat.positions) >= 2:
            # Get first and last positions
            sorted_pos = sorted(threat.positions)
            first = sorted_pos[0]
            last = sorted_pos[-1]
            
            # Check if move is collinear with the threat
            if direction == "horizontal":
                if mx == first[0]:  # Same row
                    return True
            elif direction == "vertical":
                if my == first[1]:  # Same column
                    return True
            elif direction == "diagonal_down":
                # Check if on same diagonal (x - y = constant)
                if mx - my == first[0] - first[1]:
                    return True
            elif direction == "diagonal_up":
                # Check if on same anti-diagonal (x + y = constant)
                if mx + my == first[0] + first[1]:
                    return True
        
        return False
    
    def _is_threat_weaker(
        self,
        before_type: ThreatType,
        after_type: ThreatType
    ) -> bool:
        """
        Check if a threat type is weaker than another.
        
        Args:
            before_type: Threat type before the move
            after_type: Threat type after the move
            
        Returns:
            True if after_type is weaker than before_type
        """
        # Threat priority (higher = stronger)
        priority = {
            ThreatType.FIVE: 10,
            ThreatType.OPEN_FOUR: 9,
            ThreatType.FOUR: 8,
            ThreatType.BROKEN_FOUR: 7,
            ThreatType.OPEN_THREE: 6,
            ThreatType.THREE: 5,
            ThreatType.BROKEN_THREE: 4,
            ThreatType.JUMP_THREE: 3,
            ThreatType.OPEN_TWO: 2,
        }
        
        before_priority = priority.get(before_type, 0)
        after_priority = priority.get(after_type, 0)
        
        return after_priority < before_priority
    
    def _count_significant_threats(self, threats: ThreatResult) -> int:
        """
        Count significant threats (FOUR or higher, OPEN_THREE).
        
        Args:
            threats: Threat result to count
            
        Returns:
            Number of significant threats
        """
        significant_types = {
            ThreatType.FIVE,
            ThreatType.OPEN_FOUR,
            ThreatType.FOUR,
            ThreatType.BROKEN_FOUR,
            ThreatType.OPEN_THREE,
        }
        
        count = 0
        for threat_type, num in threats.threats.items():
            if threat_type in significant_types:
                count += num
        
        return count
    
    def _is_adjacent(
        self,
        pos1: Tuple[int, int],
        pos2: Tuple[int, int]
    ) -> bool:
        """
        Check if two positions are adjacent (including diagonals).
        
        Args:
            pos1: First position (x, y)
            pos2: Second position (x, y)
            
        Returns:
            True if positions are adjacent
        """
        dx = abs(pos1[0] - pos2[0])
        dy = abs(pos1[1] - pos2[1])
        return dx <= 1 and dy <= 1 and (dx > 0 or dy > 0)
    
    def generate_praise_comment(
        self,
        pattern: DefensivePattern,
        language: str = "vi"
    ) -> str:
        """
        Generate a praise comment for a defensive pattern.
        
        Args:
            pattern: The defensive pattern to praise
            language: Language code (vi, en, zh, ja)
            
        Returns:
            Praise comment in the specified language
        """
        pattern_name = pattern.get_pattern_name(language)
        
        if language == "vi":
            if pattern.pattern_type == DefensivePatternType.DOUBLE_BLOCK:
                return f"Xuất sắc! {pattern_name} - chặn đồng thời nhiều đe dọa!"
            elif pattern.pattern_type == DefensivePatternType.SACRIFICE_BLOCK:
                return f"Thông minh! {pattern_name} - hy sinh phòng thủ để phản công!"
            elif pattern.pattern_type == DefensivePatternType.PREVENTIVE_BLOCK:
                return f"Tầm nhìn xa! {pattern_name} - ngăn chặn fork của đối thủ!"
        
        elif language == "en":
            if pattern.pattern_type == DefensivePatternType.DOUBLE_BLOCK:
                return f"Excellent! {pattern_name} - blocking multiple threats at once!"
            elif pattern.pattern_type == DefensivePatternType.SACRIFICE_BLOCK:
                return f"Smart! {pattern_name} - sacrificing defense for counter-attack!"
            elif pattern.pattern_type == DefensivePatternType.PREVENTIVE_BLOCK:
                return f"Great foresight! {pattern_name} - preventing opponent's fork!"
        
        elif language == "zh":
            if pattern.pattern_type == DefensivePatternType.DOUBLE_BLOCK:
                return f"精彩！{pattern_name} - 同时挡住多个威胁！"
            elif pattern.pattern_type == DefensivePatternType.SACRIFICE_BLOCK:
                return f"聪明！{pattern_name} - 弃守反击！"
            elif pattern.pattern_type == DefensivePatternType.PREVENTIVE_BLOCK:
                return f"有远见！{pattern_name} - 阻止对手形成双杀！"
        
        elif language == "ja":
            if pattern.pattern_type == DefensivePatternType.DOUBLE_BLOCK:
                return f"素晴らしい！{pattern_name} - 複数の脅威を同時にブロック！"
            elif pattern.pattern_type == DefensivePatternType.SACRIFICE_BLOCK:
                return f"賢い！{pattern_name} - 防御を犠牲にして反撃！"
            elif pattern.pattern_type == DefensivePatternType.PREVENTIVE_BLOCK:
                return f"先見の明！{pattern_name} - 相手のフォークを阻止！"
        
        # Default to Vietnamese
        return f"{pattern_name}: {pattern.explanation}"
