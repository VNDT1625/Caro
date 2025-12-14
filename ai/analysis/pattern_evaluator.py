"""
AI Match Analysis System - Pattern-Based Evaluation

This module implements pattern recognition and scoring for Gomoku/Caro positions.
It contains a database of 50+ common patterns (good and bad formations) and
provides scoring based on pattern recognition.

Task 8.3.2: Pattern-Based Evaluation
Impact: Recognize strategic patterns

Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
"""

from typing import List, Optional, Tuple, Dict, Set
from dataclasses import dataclass
from enum import Enum
from .types import BOARD_SIZE


class PatternCategory(Enum):
    """Categories of patterns for organization."""
    WINNING = "winning"           # Patterns that lead to immediate win
    ATTACKING = "attacking"       # Strong offensive patterns
    DEFENSIVE = "defensive"       # Good defensive formations
    DEVELOPMENT = "development"   # Good piece development
    SHAPE = "shape"              # Shape-based patterns (good/bad)
    POSITIONAL = "positional"    # Positional patterns
    BAD = "bad"                  # Bad patterns to avoid


@dataclass
class PatternDefinition:
    """Definition of a pattern in the database."""
    name: str
    pattern: List[List[Optional[str]]]  # 2D pattern grid ('X', 'O', None, '*' for any)
    score: int                          # Positive = good, Negative = bad
    category: PatternCategory
    description: str
    rotations: bool = True              # Whether to check all rotations
    mirror: bool = True                 # Whether to check mirror images


@dataclass
class PatternMatch:
    """Result of a pattern match."""
    pattern_name: str
    position: Tuple[int, int]  # Top-left corner of match
    score: int
    category: PatternCategory
    player: str  # Which player's pattern


# ============================================
# PATTERN DATABASE - 50+ Common Patterns
# ============================================

# Pattern notation:
# 'X' = Player's piece
# 'O' = Opponent's piece  
# None = Empty cell (required)
# '*' = Any cell (don't care)
# '.' = Empty cell (for readability, converted to None)

def _parse_pattern(pattern_str: str) -> List[List[Optional[str]]]:
    """Parse a pattern string into a 2D grid."""
    lines = pattern_str.strip().split('\n')
    result = []
    for line in lines:
        row = []
        for char in line:
            if char == '.':
                row.append(None)
            elif char == '*':
                row.append('*')
            elif char in ('X', 'O'):
                row.append(char)
        result.append(row)
    return result


# ============================================
# WINNING PATTERNS (Score: 1000-5000)
# ============================================

WINNING_PATTERNS = [
    # 1. Five in a row (horizontal)
    PatternDefinition(
        name="five_horizontal",
        pattern=_parse_pattern("XXXXX"),
        score=100000,
        category=PatternCategory.WINNING,
        description="Five in a row - winning position"
    ),
    
    # 2. Open Four (guaranteed win)
    PatternDefinition(
        name="open_four",
        pattern=_parse_pattern(".XXXX."),
        score=10000,
        category=PatternCategory.WINNING,
        description="Open four - guaranteed win next move"
    ),
]


# ============================================
# ATTACKING PATTERNS (Score: 200-1000)
# ============================================

ATTACKING_PATTERNS = [
    # 3. Four with one end blocked
    PatternDefinition(
        name="blocked_four",
        pattern=_parse_pattern("OXXXX."),
        score=1000,
        category=PatternCategory.ATTACKING,
        description="Four with one end blocked - forces response"
    ),
    
    # 4. Open Three
    PatternDefinition(
        name="open_three",
        pattern=_parse_pattern(".XXX."),
        score=500,
        category=PatternCategory.ATTACKING,
        description="Open three - strong attacking threat"
    ),
    
    # 5. Broken Four (X_XXX)
    PatternDefinition(
        name="broken_four_1",
        pattern=_parse_pattern("X.XXX"),
        score=800,
        category=PatternCategory.ATTACKING,
        description="Broken four pattern - very dangerous"
    ),
    
    # 6. Broken Four (XX_XX)
    PatternDefinition(
        name="broken_four_2",
        pattern=_parse_pattern("XX.XX"),
        score=800,
        category=PatternCategory.ATTACKING,
        description="Broken four pattern - very dangerous"
    ),
    
    # 7. Broken Four (XXX_X)
    PatternDefinition(
        name="broken_four_3",
        pattern=_parse_pattern("XXX.X"),
        score=800,
        category=PatternCategory.ATTACKING,
        description="Broken four pattern - very dangerous"
    ),
    
    # 8. Double Three Setup (L-shape)
    PatternDefinition(
        name="double_three_l",
        pattern=_parse_pattern("""
.X.
.X.
.XX
"""),
        score=600,
        category=PatternCategory.ATTACKING,
        description="L-shape double three setup"
    ),
    
    # 9. Double Three Setup (T-shape)
    PatternDefinition(
        name="double_three_t",
        pattern=_parse_pattern("""
.X.
XXX
.X.
"""),
        score=700,
        category=PatternCategory.ATTACKING,
        description="T-shape double three - very strong"
    ),
    
    # 10. Broken Three (X_XX)
    PatternDefinition(
        name="broken_three_1",
        pattern=_parse_pattern(".X.XX."),
        score=200,
        category=PatternCategory.ATTACKING,
        description="Broken three pattern"
    ),
    
    # 11. Broken Three (XX_X)
    PatternDefinition(
        name="broken_three_2",
        pattern=_parse_pattern(".XX.X."),
        score=200,
        category=PatternCategory.ATTACKING,
        description="Broken three pattern"
    ),
]


# ============================================
# SHAPE PATTERNS - GOOD (Score: 50-300)
# ============================================

GOOD_SHAPE_PATTERNS = [
    # 12. Diamond Shape (strong center control)
    PatternDefinition(
        name="diamond",
        pattern=_parse_pattern("""
.X.
X.X
.X.
"""),
        score=150,
        category=PatternCategory.SHAPE,
        description="Diamond shape - good center control"
    ),
    
    # 13. Cross Shape
    PatternDefinition(
        name="cross",
        pattern=_parse_pattern("""
.X.
XXX
.X.
"""),
        score=200,
        category=PatternCategory.SHAPE,
        description="Cross shape - controls multiple directions"
    ),
    
    # 14. Arrow Shape (pointing direction)
    PatternDefinition(
        name="arrow_right",
        pattern=_parse_pattern("""
X..
XX.
X..
"""),
        score=120,
        category=PatternCategory.SHAPE,
        description="Arrow shape - directional development"
    ),
    
    # 15. Triangle Shape
    PatternDefinition(
        name="triangle",
        pattern=_parse_pattern("""
X..
XX.
"""),
        score=80,
        category=PatternCategory.SHAPE,
        description="Triangle shape - compact formation"
    ),
    
    # 16. Square Shape (2x2)
    PatternDefinition(
        name="square_2x2",
        pattern=_parse_pattern("""
XX
XX
"""),
        score=100,
        category=PatternCategory.SHAPE,
        description="Square shape - solid formation"
    ),
    
    # 17. Diagonal Chain (3 pieces)
    PatternDefinition(
        name="diagonal_chain_3",
        pattern=_parse_pattern("""
X..
.X.
..X
"""),
        score=90,
        category=PatternCategory.SHAPE,
        description="Diagonal chain - flexible development"
    ),
    
    # 18. Knight Move Pattern
    PatternDefinition(
        name="knight_move",
        pattern=_parse_pattern("""
X..
..X
"""),
        score=60,
        category=PatternCategory.SHAPE,
        description="Knight move - flexible connection"
    ),
    
    # 19. Staircase Pattern
    PatternDefinition(
        name="staircase",
        pattern=_parse_pattern("""
X..
.X.
..X
"""),
        score=85,
        category=PatternCategory.SHAPE,
        description="Staircase - diagonal development"
    ),
    
    # 20. Hook Shape
    PatternDefinition(
        name="hook",
        pattern=_parse_pattern("""
XX.
..X
"""),
        score=70,
        category=PatternCategory.SHAPE,
        description="Hook shape - corner control"
    ),
    
    # 21. V-Shape
    PatternDefinition(
        name="v_shape",
        pattern=_parse_pattern("""
X.X
.X.
"""),
        score=95,
        category=PatternCategory.SHAPE,
        description="V-shape - branching potential"
    ),
    
    # 22. Anchor Pattern
    PatternDefinition(
        name="anchor",
        pattern=_parse_pattern("""
.X.
XXX
"""),
        score=130,
        category=PatternCategory.SHAPE,
        description="Anchor - stable base formation"
    ),
    
    # 23. Wing Pattern
    PatternDefinition(
        name="wing",
        pattern=_parse_pattern("""
X.X
.X.
X.X
"""),
        score=140,
        category=PatternCategory.SHAPE,
        description="Wing pattern - multi-directional control"
    ),
]


# ============================================
# SHAPE PATTERNS - BAD (Score: -50 to -300)
# ============================================

BAD_SHAPE_PATTERNS = [
    # 24. Isolated Piece (no neighbors)
    PatternDefinition(
        name="isolated_piece",
        pattern=_parse_pattern("""
...
.X.
...
"""),
        score=-50,
        category=PatternCategory.BAD,
        description="Isolated piece - no support"
    ),
    
    # 25. Overconcentrated (too many in small area)
    PatternDefinition(
        name="overconcentrated",
        pattern=_parse_pattern("""
XXX
XXX
"""),
        score=-80,
        category=PatternCategory.BAD,
        description="Overconcentrated - limited flexibility"
    ),
    
    # 26. Dead End Pattern (blocked both sides)
    PatternDefinition(
        name="dead_end",
        pattern=_parse_pattern("OXXXO"),
        score=-200,
        category=PatternCategory.BAD,
        description="Dead end - blocked both sides, wasted moves"
    ),
    
    # 27. Edge Heavy (too many on edge)
    PatternDefinition(
        name="edge_heavy",
        pattern=_parse_pattern("XXXX"),
        score=-30,
        category=PatternCategory.BAD,
        description="Edge heavy - limited expansion",
        rotations=False  # Only check horizontal
    ),
    
    # 28. Scattered Pieces (no connection)
    PatternDefinition(
        name="scattered",
        pattern=_parse_pattern("""
X...X
.....
X...X
"""),
        score=-100,
        category=PatternCategory.BAD,
        description="Scattered pieces - no coordination"
    ),
    
    # 29. Blocked Three (both ends blocked)
    PatternDefinition(
        name="blocked_three",
        pattern=_parse_pattern("OXXXO"),
        score=-150,
        category=PatternCategory.BAD,
        description="Blocked three - no threat potential"
    ),
    
    # 30. Wasted Corner
    PatternDefinition(
        name="wasted_corner",
        pattern=_parse_pattern("""
XX
X.
"""),
        score=-40,
        category=PatternCategory.BAD,
        description="Corner cluster - limited development"
    ),
    
    # 31. Linear Only (no branching)
    PatternDefinition(
        name="linear_only",
        pattern=_parse_pattern("""
.....
XXXXX
.....
"""),
        score=-60,
        category=PatternCategory.BAD,
        description="Linear only - predictable, easy to block"
    ),
]


# ============================================
# DEFENSIVE PATTERNS (Score: 100-400)
# ============================================

DEFENSIVE_PATTERNS = [
    # 32. Block Four
    PatternDefinition(
        name="block_four",
        pattern=_parse_pattern(".OOOOX"),
        score=300,
        category=PatternCategory.DEFENSIVE,
        description="Blocking opponent's four - essential defense"
    ),
    
    # 33. Block Open Three
    PatternDefinition(
        name="block_open_three",
        pattern=_parse_pattern(".OOOX."),
        score=200,
        category=PatternCategory.DEFENSIVE,
        description="Blocking opponent's open three"
    ),
    
    # 34. Defensive Wall
    PatternDefinition(
        name="defensive_wall",
        pattern=_parse_pattern("""
XXX
OOO
"""),
        score=150,
        category=PatternCategory.DEFENSIVE,
        description="Defensive wall - blocking opponent's advance"
    ),
    
    # 35. Counter Position
    PatternDefinition(
        name="counter_position",
        pattern=_parse_pattern("""
.X.
OOO
.X.
"""),
        score=180,
        category=PatternCategory.DEFENSIVE,
        description="Counter position - defensive with counter-attack potential"
    ),
]

# ============================================
# DEVELOPMENT PATTERNS (Score: 30-150)
# ============================================

DEVELOPMENT_PATTERNS = [
    # 36. Center Control
    PatternDefinition(
        name="center_control",
        pattern=_parse_pattern("""
.X.
XXX
.X.
"""),
        score=150,
        category=PatternCategory.DEVELOPMENT,
        description="Center control - strategic advantage"
    ),
    
    # 37. Open Two
    PatternDefinition(
        name="open_two",
        pattern=_parse_pattern("..XX.."),
        score=50,
        category=PatternCategory.DEVELOPMENT,
        description="Open two - development potential"
    ),
    
    # 38. Diagonal Development
    PatternDefinition(
        name="diagonal_dev",
        pattern=_parse_pattern("""
.X.
..X
"""),
        score=40,
        category=PatternCategory.DEVELOPMENT,
        description="Diagonal development - flexible growth"
    ),
    
    # 39. Parallel Lines Setup
    PatternDefinition(
        name="parallel_lines",
        pattern=_parse_pattern("""
XX.
..X
XX.
"""),
        score=120,
        category=PatternCategory.DEVELOPMENT,
        description="Parallel lines - multiple threat potential"
    ),
    
    # 40. Fork Setup
    PatternDefinition(
        name="fork_setup",
        pattern=_parse_pattern("""
.X.
.X.
XX.
"""),
        score=130,
        category=PatternCategory.DEVELOPMENT,
        description="Fork setup - preparing double threat"
    ),
    
    # 41. Extension Base
    PatternDefinition(
        name="extension_base",
        pattern=_parse_pattern("..XX."),
        score=45,
        category=PatternCategory.DEVELOPMENT,
        description="Extension base - room to grow"
    ),
    
    # 42. Bridge Connection
    PatternDefinition(
        name="bridge",
        pattern=_parse_pattern("X.X"),
        score=35,
        category=PatternCategory.DEVELOPMENT,
        description="Bridge - connected with gap"
    ),
]


# ============================================
# POSITIONAL PATTERNS (Score: 20-100)
# ============================================

POSITIONAL_PATTERNS = [
    # 43. Center Piece
    PatternDefinition(
        name="center_piece",
        pattern=_parse_pattern("X"),
        score=30,
        category=PatternCategory.POSITIONAL,
        description="Center piece - strategic position"
    ),
    
    # 44. Near Center
    PatternDefinition(
        name="near_center",
        pattern=_parse_pattern("""
.X
X.
"""),
        score=25,
        category=PatternCategory.POSITIONAL,
        description="Near center - good positioning"
    ),
    
    # 45. Diagonal Pair
    PatternDefinition(
        name="diagonal_pair",
        pattern=_parse_pattern("""
X.
.X
"""),
        score=40,
        category=PatternCategory.POSITIONAL,
        description="Diagonal pair - flexible connection"
    ),
    
    # 46. Adjacent Pair
    PatternDefinition(
        name="adjacent_pair",
        pattern=_parse_pattern("XX"),
        score=35,
        category=PatternCategory.POSITIONAL,
        description="Adjacent pair - basic connection"
    ),
    
    # 47. Spaced Pair
    PatternDefinition(
        name="spaced_pair",
        pattern=_parse_pattern("X.X"),
        score=30,
        category=PatternCategory.POSITIONAL,
        description="Spaced pair - room for development"
    ),
    
    # 48. Triple Line
    PatternDefinition(
        name="triple_line",
        pattern=_parse_pattern("XXX"),
        score=80,
        category=PatternCategory.POSITIONAL,
        description="Triple line - strong presence"
    ),
]

# ============================================
# ADVANCED TACTICAL PATTERNS (Score: 150-500)
# ============================================

TACTICAL_PATTERNS = [
    # 49. Double Attack Setup
    PatternDefinition(
        name="double_attack",
        pattern=_parse_pattern("""
.XX.
X..X
"""),
        score=250,
        category=PatternCategory.ATTACKING,
        description="Double attack setup - threatens two directions"
    ),
    
    # 50. Pincer Attack
    PatternDefinition(
        name="pincer",
        pattern=_parse_pattern("""
X..X
.OO.
X..X
"""),
        score=200,
        category=PatternCategory.ATTACKING,
        description="Pincer attack - surrounding opponent"
    ),
    
    # 51. Ladder Setup
    PatternDefinition(
        name="ladder",
        pattern=_parse_pattern("""
X...
.X..
..X.
...X
"""),
        score=180,
        category=PatternCategory.ATTACKING,
        description="Ladder pattern - forcing sequence"
    ),
    
    # 52. Squeeze Pattern
    PatternDefinition(
        name="squeeze",
        pattern=_parse_pattern("""
X.X
.O.
X.X
"""),
        score=160,
        category=PatternCategory.ATTACKING,
        description="Squeeze - limiting opponent's options"
    ),
    
    # 53. Expansion Pattern
    PatternDefinition(
        name="expansion",
        pattern=_parse_pattern("""
..X..
.X.X.
X...X
"""),
        score=140,
        category=PatternCategory.DEVELOPMENT,
        description="Expansion - controlling large area"
    ),
    
    # 54. Fortress Pattern
    PatternDefinition(
        name="fortress",
        pattern=_parse_pattern("""
.XX.
X..X
.XX.
"""),
        score=170,
        category=PatternCategory.DEFENSIVE,
        description="Fortress - strong defensive structure"
    ),
    
    # 55. Spike Pattern
    PatternDefinition(
        name="spike",
        pattern=_parse_pattern("""
..X
.X.
X..
.X.
..X
"""),
        score=190,
        category=PatternCategory.ATTACKING,
        description="Spike - penetrating formation"
    ),
]


# ============================================
# COMBINE ALL PATTERNS
# ============================================

ALL_PATTERNS: List[PatternDefinition] = (
    WINNING_PATTERNS +
    ATTACKING_PATTERNS +
    GOOD_SHAPE_PATTERNS +
    BAD_SHAPE_PATTERNS +
    DEFENSIVE_PATTERNS +
    DEVELOPMENT_PATTERNS +
    POSITIONAL_PATTERNS +
    TACTICAL_PATTERNS
)


class PatternEvaluator:
    """
    Pattern-based position evaluator for Gomoku/Caro.
    
    Recognizes 50+ common patterns and scores positions based on
    pattern matches. Good patterns contribute positive scores,
    bad patterns contribute negative scores.
    
    Task 8.3.2: Pattern-Based Evaluation
    Impact: Recognize strategic patterns
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize the PatternEvaluator.
        
        Args:
            board_size: Size of the board (default 15x15)
        """
        self.board_size = board_size
        self.patterns = ALL_PATTERNS
        self._pattern_cache: Dict[str, List[PatternDefinition]] = {}
        self._precompute_rotations()
    
    def _precompute_rotations(self):
        """Precompute all pattern rotations and mirrors for faster matching."""
        self._expanded_patterns: List[Tuple[PatternDefinition, List[List[Optional[str]]]]] = []
        
        for pattern_def in self.patterns:
            variations = self._get_pattern_variations(pattern_def)
            for variation in variations:
                self._expanded_patterns.append((pattern_def, variation))
    
    def _get_pattern_variations(
        self, 
        pattern_def: PatternDefinition
    ) -> List[List[List[Optional[str]]]]:
        """
        Get all variations (rotations and mirrors) of a pattern.
        
        Args:
            pattern_def: Pattern definition
            
        Returns:
            List of pattern variations
        """
        variations = [pattern_def.pattern]
        current = pattern_def.pattern
        
        if pattern_def.rotations:
            # Add 90, 180, 270 degree rotations
            for _ in range(3):
                current = self._rotate_90(current)
                if current not in variations:
                    variations.append(current)
        
        if pattern_def.mirror:
            # Add horizontal mirror
            mirrored = self._mirror_horizontal(pattern_def.pattern)
            if mirrored not in variations:
                variations.append(mirrored)
            
            # Add vertical mirror
            mirrored_v = self._mirror_vertical(pattern_def.pattern)
            if mirrored_v not in variations:
                variations.append(mirrored_v)
        
        return variations

    
    def _rotate_90(
        self, 
        pattern: List[List[Optional[str]]]
    ) -> List[List[Optional[str]]]:
        """Rotate a pattern 90 degrees clockwise."""
        if not pattern or not pattern[0]:
            return pattern
        
        rows = len(pattern)
        cols = len(pattern[0])
        rotated = [[None] * rows for _ in range(cols)]
        
        for i in range(rows):
            for j in range(cols):
                rotated[j][rows - 1 - i] = pattern[i][j]
        
        return rotated
    
    def _mirror_horizontal(
        self, 
        pattern: List[List[Optional[str]]]
    ) -> List[List[Optional[str]]]:
        """Mirror a pattern horizontally."""
        return [row[::-1] for row in pattern]
    
    def _mirror_vertical(
        self, 
        pattern: List[List[Optional[str]]]
    ) -> List[List[Optional[str]]]:
        """Mirror a pattern vertically."""
        return pattern[::-1]
    
    def evaluate_position(
        self, 
        board: List[List[Optional[str]]], 
        player: str
    ) -> float:
        """
        Evaluate a board position based on pattern matching.
        
        Scans the board for all known patterns and sums their scores.
        Player's patterns contribute positively, opponent's negatively.
        
        Args:
            board: 2D array representing the board state
            player: The player to evaluate for ("X" or "O")
            
        Returns:
            Pattern-based score (positive = good for player)
        """
        matches = self.find_all_patterns(board, player)
        
        total_score = 0.0
        for match in matches:
            if match.player == player:
                total_score += match.score
            else:
                # Opponent's good patterns are bad for us
                total_score -= match.score * 0.9
        
        return total_score
    
    def find_all_patterns(
        self, 
        board: List[List[Optional[str]]], 
        player: str
    ) -> List[PatternMatch]:
        """
        Find all pattern matches on the board.
        
        Args:
            board: 2D array representing the board state
            player: The player to find patterns for
            
        Returns:
            List of PatternMatch objects
        """
        matches: List[PatternMatch] = []
        opponent = "O" if player == "X" else "X"
        seen_matches: Set[Tuple[str, int, int, str]] = set()
        
        # Check each position on the board
        for x in range(self.board_size):
            for y in range(self.board_size):
                # Try to match each pattern variation at this position
                for pattern_def, variation in self._expanded_patterns:
                    # Try matching for player
                    if self._match_pattern_at(board, x, y, variation, player, opponent):
                        match_key = (pattern_def.name, x, y, player)
                        if match_key not in seen_matches:
                            seen_matches.add(match_key)
                            matches.append(PatternMatch(
                                pattern_name=pattern_def.name,
                                position=(x, y),
                                score=pattern_def.score,
                                category=pattern_def.category,
                                player=player
                            ))
                    
                    # Try matching for opponent (swap X and O)
                    if self._match_pattern_at(board, x, y, variation, opponent, player):
                        match_key = (pattern_def.name, x, y, opponent)
                        if match_key not in seen_matches:
                            seen_matches.add(match_key)
                            matches.append(PatternMatch(
                                pattern_name=pattern_def.name,
                                position=(x, y),
                                score=pattern_def.score,
                                category=pattern_def.category,
                                player=opponent
                            ))
        
        return matches

    
    def _match_pattern_at(
        self,
        board: List[List[Optional[str]]],
        start_x: int,
        start_y: int,
        pattern: List[List[Optional[str]]],
        player: str,
        opponent: str
    ) -> bool:
        """
        Check if a pattern matches at a specific position.
        
        Args:
            board: 2D array representing the board state
            start_x: Starting row index
            start_y: Starting column index
            pattern: Pattern to match
            player: Player's symbol ('X' or 'O')
            opponent: Opponent's symbol
            
        Returns:
            True if pattern matches at this position
        """
        if not pattern or not pattern[0]:
            return False
        
        pattern_rows = len(pattern)
        pattern_cols = len(pattern[0])
        
        # Check if pattern fits on board
        if start_x + pattern_rows > self.board_size:
            return False
        if start_y + pattern_cols > self.board_size:
            return False
        
        # Check each cell in the pattern
        for i in range(pattern_rows):
            for j in range(pattern_cols):
                pattern_cell = pattern[i][j]
                board_cell = board[start_x + i][start_y + j]
                
                # '*' matches anything
                if pattern_cell == '*':
                    continue
                
                # 'X' in pattern should match player's piece
                if pattern_cell == 'X':
                    if board_cell != player:
                        return False
                
                # 'O' in pattern should match opponent's piece
                elif pattern_cell == 'O':
                    if board_cell != opponent:
                        return False
                
                # None (empty) in pattern should match empty cell
                elif pattern_cell is None:
                    if board_cell is not None:
                        return False
        
        return True
    
    def get_pattern_score(self, pattern_name: str) -> int:
        """
        Get the score for a specific pattern by name.
        
        Args:
            pattern_name: Name of the pattern
            
        Returns:
            Pattern score (0 if not found)
        """
        for pattern_def in self.patterns:
            if pattern_def.name == pattern_name:
                return pattern_def.score
        return 0
    
    def get_patterns_by_category(
        self, 
        category: PatternCategory
    ) -> List[PatternDefinition]:
        """
        Get all patterns in a specific category.
        
        Args:
            category: Pattern category to filter by
            
        Returns:
            List of pattern definitions in that category
        """
        return [p for p in self.patterns if p.category == category]
    
    def get_good_patterns(self) -> List[PatternDefinition]:
        """
        Get all patterns with positive scores (good patterns).
        
        Returns:
            List of good pattern definitions
        """
        return [p for p in self.patterns if p.score > 0]
    
    def get_bad_patterns(self) -> List[PatternDefinition]:
        """
        Get all patterns with negative scores (bad patterns).
        
        Returns:
            List of bad pattern definitions
        """
        return [p for p in self.patterns if p.score < 0]
    
    def count_patterns(self) -> int:
        """
        Get the total number of patterns in the database.
        
        Returns:
            Number of patterns
        """
        return len(self.patterns)

    
    def recognize_shape(
        self, 
        board: List[List[Optional[str]]], 
        player: str
    ) -> Dict[str, any]:
        """
        Recognize the overall shape/formation quality for a player.
        
        Analyzes the board to determine if the player has good or bad
        formations based on pattern matching.
        
        Args:
            board: 2D array representing the board state
            player: The player to analyze
            
        Returns:
            Dictionary with shape analysis results
        """
        matches = self.find_all_patterns(board, player)
        
        # Separate player's and opponent's matches
        player_matches = [m for m in matches if m.player == player]
        opponent_matches = [m for m in matches if m.player != player]
        
        # Count by category
        category_counts: Dict[PatternCategory, int] = {cat: 0 for cat in PatternCategory}
        for match in player_matches:
            category_counts[match.category] += 1
        
        # Calculate scores by category
        category_scores: Dict[str, float] = {}
        for cat in PatternCategory:
            cat_matches = [m for m in player_matches if m.category == cat]
            category_scores[cat.value] = sum(m.score for m in cat_matches)
        
        # Determine overall shape quality
        good_score = sum(m.score for m in player_matches if m.score > 0)
        bad_score = sum(m.score for m in player_matches if m.score < 0)
        net_score = good_score + bad_score
        
        # Classify shape quality
        if net_score >= 500:
            shape_quality = "excellent"
        elif net_score >= 200:
            shape_quality = "good"
        elif net_score >= 0:
            shape_quality = "neutral"
        elif net_score >= -200:
            shape_quality = "poor"
        else:
            shape_quality = "bad"
        
        return {
            "shape_quality": shape_quality,
            "net_score": net_score,
            "good_patterns_score": good_score,
            "bad_patterns_score": bad_score,
            "pattern_counts": {cat.value: count for cat, count in category_counts.items()},
            "category_scores": category_scores,
            "total_patterns_found": len(player_matches),
            "opponent_patterns_found": len(opponent_matches),
        }
    
    def get_shape_recommendations(
        self, 
        board: List[List[Optional[str]]], 
        player: str
    ) -> List[str]:
        """
        Get recommendations for improving shape/formation.
        
        Args:
            board: 2D array representing the board state
            player: The player to get recommendations for
            
        Returns:
            List of recommendation strings
        """
        shape_analysis = self.recognize_shape(board, player)
        recommendations = []
        
        # Check for bad patterns
        bad_count = shape_analysis["pattern_counts"].get("bad", 0)
        if bad_count > 0:
            recommendations.append(
                f"Có {bad_count} mẫu hình xấu. Cần cải thiện sự kết nối giữa các quân."
            )
        
        # Check for lack of attacking patterns
        attacking_score = shape_analysis["category_scores"].get("attacking", 0)
        if attacking_score < 100:
            recommendations.append(
                "Thiếu các mẫu tấn công. Cần tạo thêm đe dọa."
            )
        
        # Check for lack of development
        dev_score = shape_analysis["category_scores"].get("development", 0)
        if dev_score < 50:
            recommendations.append(
                "Cần phát triển quân cờ tốt hơn. Tập trung vào trung tâm."
            )
        
        # Check shape quality
        if shape_analysis["shape_quality"] in ["poor", "bad"]:
            recommendations.append(
                "Hình dạng quân cờ kém. Cần tạo các kết nối tốt hơn."
            )
        
        if not recommendations:
            recommendations.append("Hình dạng quân cờ tốt. Tiếp tục duy trì.")
        
        return recommendations


# ============================================
# UTILITY FUNCTIONS
# ============================================

def get_pattern_database_stats() -> Dict[str, any]:
    """
    Get statistics about the pattern database.
    
    Returns:
        Dictionary with database statistics
    """
    total = len(ALL_PATTERNS)
    by_category = {}
    good_count = 0
    bad_count = 0
    
    for pattern in ALL_PATTERNS:
        cat = pattern.category.value
        by_category[cat] = by_category.get(cat, 0) + 1
        if pattern.score > 0:
            good_count += 1
        elif pattern.score < 0:
            bad_count += 1
    
    return {
        "total_patterns": total,
        "by_category": by_category,
        "good_patterns": good_count,
        "bad_patterns": bad_count,
        "neutral_patterns": total - good_count - bad_count,
    }
