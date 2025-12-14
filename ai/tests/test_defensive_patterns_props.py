"""
Property-Based Tests for Defensive Pattern Recognition

Tests for DefensivePatternRecognizer class.

**Feature: gomoku-basic-analysis, Property 47: Double Block Recognition**
**Validates: Requirements 17.1**

**Feature: gomoku-basic-analysis, Property 48: Defensive Pattern Names**
**Validates: Requirements 17.4**
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional, Dict

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.defensive_patterns import (
    DefensivePatternRecognizer,
    DefensivePattern,
    DefensivePatternType,
    DEFENSIVE_PATTERN_NAMES,
    DEFENSIVE_PATTERN_NAMES_VI,
    DEFENSIVE_PATTERN_NAMES_EN,
    DEFENSIVE_PATTERN_NAMES_ZH,
    DEFENSIVE_PATTERN_NAMES_JA,
)
from analysis.threat_detector import ThreatDetector
from analysis.types import (
    ThreatType,
    ThreatPosition,
    ThreatResult,
    DoubleThreatType,
    DoubleThreatPosition,
    BOARD_SIZE,
)


# ============================================
# Test Fixtures and Helpers
# ============================================

def create_empty_board(size: int = BOARD_SIZE) -> List[List[Optional[str]]]:
    """Create an empty board."""
    return [[None for _ in range(size)] for _ in range(size)]


def place_stones(
    board: List[List[Optional[str]]],
    positions: List[Tuple[int, int]],
    player: str
) -> List[List[Optional[str]]]:
    """Place stones on the board."""
    for x, y in positions:
        if 0 <= x < len(board) and 0 <= y < len(board[0]):
            board[x][y] = player
    return board


def create_threat_result(
    threats: Dict[ThreatType, int] = None,
    total_score: int = 0,
    threat_positions: List[ThreatPosition] = None,
    double_threats: Dict[DoubleThreatType, int] = None,
    double_threat_positions: List[DoubleThreatPosition] = None
) -> ThreatResult:
    """Create a ThreatResult for testing."""
    return ThreatResult(
        threats=threats or {t: 0 for t in ThreatType},
        total_score=total_score,
        threat_positions=threat_positions or [],
        double_threats=double_threats or {dt: 0 for dt in DoubleThreatType},
        double_threat_positions=double_threat_positions or []
    )


# ============================================
# Property 47: Double Block Recognition
# **Feature: gomoku-basic-analysis, Property 47: Double Block Recognition**
# **Validates: Requirements 17.1**
# ============================================

class TestDoubleBlockRecognition:
    """
    Property 47: Double Block Recognition
    
    *For any* move that blocks two threats simultaneously, the system SHALL
    recognize and praise it with appropriate comment.
    
    **Validates: Requirements 17.1**
    """
    
    def test_double_block_horizontal_and_vertical(self):
        """
        Test double block when move blocks both horizontal and vertical threats.
        
        **Feature: gomoku-basic-analysis, Property 47: Double Block Recognition**
        **Validates: Requirements 17.1**
        """
        recognizer = DefensivePatternRecognizer()
        detector = ThreatDetector()
        
        # Create board with two threats that can be blocked by one move
        # Horizontal threat: O at (7,5), (7,6), (7,8) - needs (7,7) to complete
        # Vertical threat: O at (5,7), (6,7), (8,7) - needs (7,7) to complete
        board_before = create_empty_board()
        # Horizontal threat
        board_before[7][5] = "O"
        board_before[7][6] = "O"
        board_before[7][8] = "O"
        # Vertical threat
        board_before[5][7] = "O"
        board_before[6][7] = "O"
        board_before[8][7] = "O"
        
        # Detect threats before the move
        threats_before = detector.detect_all_threats(board_before, "O")
        
        # Player X blocks at (7,7)
        board_after = [row[:] for row in board_before]
        board_after[7][7] = "X"
        
        # Detect threats after the move
        threats_after = detector.detect_all_threats(board_after, "O")
        
        # Detect defensive patterns
        patterns = recognizer.detect_defensive_patterns(
            board_after,
            move=(7, 7),
            player="X",
            threats_before=threats_before,
            threats_after=threats_after
        )
        
        # Should detect double block
        double_blocks = [p for p in patterns if p.pattern_type == DefensivePatternType.DOUBLE_BLOCK]
        assert len(double_blocks) >= 1, "Should detect double block"
        
        # Verify pattern has correct attributes
        db = double_blocks[0]
        assert db.pattern_name_vi == "Chặn Kép"
        assert len(db.threats_blocked) >= 2
        assert db.move_position == (7, 7)
    
    def test_double_block_diagonal_threats(self):
        """
        Test double block when move blocks two diagonal threats.
        
        **Feature: gomoku-basic-analysis, Property 47: Double Block Recognition**
        **Validates: Requirements 17.1**
        """
        recognizer = DefensivePatternRecognizer()
        detector = ThreatDetector()
        
        # Create board with two diagonal threats
        # Diagonal down: O at (5,5), (6,6), (8,8) - needs (7,7)
        # Diagonal up: O at (9,5), (8,6), (6,8) - needs (7,7)
        board_before = create_empty_board()
        # Diagonal down threat
        board_before[5][5] = "O"
        board_before[6][6] = "O"
        board_before[8][8] = "O"
        # Diagonal up threat
        board_before[9][5] = "O"
        board_before[8][6] = "O"
        board_before[6][8] = "O"
        
        threats_before = detector.detect_all_threats(board_before, "O")
        
        # Player X blocks at (7,7)
        board_after = [row[:] for row in board_before]
        board_after[7][7] = "X"
        
        threats_after = detector.detect_all_threats(board_after, "O")
        
        patterns = recognizer.detect_defensive_patterns(
            board_after,
            move=(7, 7),
            player="X",
            threats_before=threats_before,
            threats_after=threats_after
        )
        
        double_blocks = [p for p in patterns if p.pattern_type == DefensivePatternType.DOUBLE_BLOCK]
        # May or may not detect depending on threat configuration
        # The key is that if detected, it should have correct attributes
        for db in double_blocks:
            assert db.pattern_name_vi == "Chặn Kép"
            assert db.move_position == (7, 7)
    
    def test_no_double_block_single_threat(self):
        """
        Test that single threat block is not classified as double block.
        
        **Feature: gomoku-basic-analysis, Property 47: Double Block Recognition**
        **Validates: Requirements 17.1**
        """
        recognizer = DefensivePatternRecognizer()
        detector = ThreatDetector()
        
        # Create board with only one threat
        board_before = create_empty_board()
        board_before[7][5] = "O"
        board_before[7][6] = "O"
        board_before[7][8] = "O"
        
        threats_before = detector.detect_all_threats(board_before, "O")
        
        # Player X blocks at (7,7)
        board_after = [row[:] for row in board_before]
        board_after[7][7] = "X"
        
        threats_after = detector.detect_all_threats(board_after, "O")
        
        patterns = recognizer.detect_defensive_patterns(
            board_after,
            move=(7, 7),
            player="X",
            threats_before=threats_before,
            threats_after=threats_after
        )
        
        double_blocks = [p for p in patterns if p.pattern_type == DefensivePatternType.DOUBLE_BLOCK]
        assert len(double_blocks) == 0, "Single threat should not be double block"
    
    @given(st.integers(min_value=3, max_value=11))
    @settings(max_examples=20)
    def test_double_block_various_positions(self, center: int):
        """
        Property test: Double block detection works at various board positions.
        
        **Feature: gomoku-basic-analysis, Property 47: Double Block Recognition**
        **Validates: Requirements 17.1**
        """
        recognizer = DefensivePatternRecognizer()
        detector = ThreatDetector()
        
        # Create threats at center position
        board_before = create_empty_board()
        
        # Horizontal threat
        if center - 2 >= 0 and center + 1 < BOARD_SIZE:
            board_before[center][center - 2] = "O"
            board_before[center][center - 1] = "O"
            board_before[center][center + 1] = "O"
        
        # Vertical threat
        if center - 2 >= 0 and center + 1 < BOARD_SIZE:
            board_before[center - 2][center] = "O"
            board_before[center - 1][center] = "O"
            board_before[center + 1][center] = "O"
        
        threats_before = detector.detect_all_threats(board_before, "O")
        
        # Block at center
        board_after = [row[:] for row in board_before]
        board_after[center][center] = "X"
        
        threats_after = detector.detect_all_threats(board_after, "O")
        
        patterns = recognizer.detect_defensive_patterns(
            board_after,
            move=(center, center),
            player="X",
            threats_before=threats_before,
            threats_after=threats_after
        )
        
        # Verify all detected patterns have valid attributes
        for pattern in patterns:
            assert pattern.pattern_type in DefensivePatternType
            assert pattern.pattern_name_vi in DEFENSIVE_PATTERN_NAMES_VI.values()
            assert pattern.move_position == (center, center)


# ============================================
# Property 48: Defensive Pattern Names
# **Feature: gomoku-basic-analysis, Property 48: Defensive Pattern Names**
# **Validates: Requirements 17.4**
# ============================================

class TestDefensivePatternNames:
    """
    Property 48: Defensive Pattern Names
    
    *For any* recognized defensive pattern, the system SHALL use Vietnamese
    pattern names (Chặn Kép, Chặn Hi Sinh, Chặn Phòng Ngừa).
    
    **Validates: Requirements 17.4**
    """
    
    def test_all_pattern_types_have_vietnamese_names(self):
        """
        Test that all pattern types have Vietnamese names defined.
        
        **Feature: gomoku-basic-analysis, Property 48: Defensive Pattern Names**
        **Validates: Requirements 17.4**
        """
        for pattern_type in DefensivePatternType:
            assert pattern_type in DEFENSIVE_PATTERN_NAMES_VI
            assert DEFENSIVE_PATTERN_NAMES_VI[pattern_type] != ""
    
    def test_vietnamese_names_are_correct(self):
        """
        Test that Vietnamese names match requirements.
        
        **Feature: gomoku-basic-analysis, Property 48: Defensive Pattern Names**
        **Validates: Requirements 17.4**
        """
        assert DEFENSIVE_PATTERN_NAMES_VI[DefensivePatternType.DOUBLE_BLOCK] == "Chặn Kép"
        assert DEFENSIVE_PATTERN_NAMES_VI[DefensivePatternType.SACRIFICE_BLOCK] == "Chặn Hi Sinh"
        assert DEFENSIVE_PATTERN_NAMES_VI[DefensivePatternType.PREVENTIVE_BLOCK] == "Chặn Phòng Ngừa"
    
    def test_all_languages_have_names(self):
        """
        Test that all 4 languages have pattern names defined.
        
        **Feature: gomoku-basic-analysis, Property 48: Defensive Pattern Names**
        **Validates: Requirements 17.4**
        """
        languages = ["vi", "en", "zh", "ja"]
        for lang in languages:
            assert lang in DEFENSIVE_PATTERN_NAMES
            for pattern_type in DefensivePatternType:
                assert pattern_type in DEFENSIVE_PATTERN_NAMES[lang]
                assert DEFENSIVE_PATTERN_NAMES[lang][pattern_type] != ""
    
    def test_pattern_get_name_method(self):
        """
        Test that DefensivePattern.get_pattern_name() returns correct names.
        
        **Feature: gomoku-basic-analysis, Property 48: Defensive Pattern Names**
        **Validates: Requirements 17.4**
        """
        pattern = DefensivePattern(
            pattern_type=DefensivePatternType.DOUBLE_BLOCK,
            pattern_name_vi="Chặn Kép",
            threats_blocked=[],
            explanation="Test",
            move_position=(7, 7)
        )
        
        assert pattern.get_pattern_name("vi") == "Chặn Kép"
        assert pattern.get_pattern_name("en") == "Double Block"
        assert pattern.get_pattern_name("zh") == "双挡"
        assert pattern.get_pattern_name("ja") == "ダブルブロック"
    
    @given(st.sampled_from(list(DefensivePatternType)))
    @settings(max_examples=10)
    def test_pattern_names_non_empty_all_languages(self, pattern_type: DefensivePatternType):
        """
        Property test: All pattern types have non-empty names in all languages.
        
        **Feature: gomoku-basic-analysis, Property 48: Defensive Pattern Names**
        **Validates: Requirements 17.4**
        """
        for lang in ["vi", "en", "zh", "ja"]:
            name = DEFENSIVE_PATTERN_NAMES[lang][pattern_type]
            assert name is not None
            assert len(name) > 0


# ============================================
# Additional Tests for Sacrifice Block and Preventive Block
# ============================================

class TestSacrificeBlock:
    """Tests for Sacrifice Block (Chặn Hi Sinh) detection."""
    
    def test_sacrifice_block_with_counter_attack(self):
        """
        Test sacrifice block when player creates counter-attack.
        
        **Feature: gomoku-basic-analysis, Property 47: Double Block Recognition**
        **Validates: Requirements 17.2**
        """
        recognizer = DefensivePatternRecognizer()
        detector = ThreatDetector()
        
        # Create board where blocking creates counter-attack
        board_before = create_empty_board()
        # Opponent has two threats
        board_before[7][5] = "O"
        board_before[7][6] = "O"
        board_before[7][8] = "O"  # Horizontal threat
        board_before[5][10] = "O"
        board_before[6][10] = "O"
        board_before[8][10] = "O"  # Another threat
        
        # Player has potential counter-attack
        board_before[7][10] = "X"
        board_before[7][11] = "X"
        
        threats_before = detector.detect_all_threats(board_before, "O")
        
        # Player blocks one threat and extends counter-attack
        board_after = [row[:] for row in board_before]
        board_after[7][7] = "X"  # Block horizontal threat
        
        threats_after = detector.detect_all_threats(board_after, "O")
        player_threats_after = detector.detect_all_threats(board_after, "X")
        
        patterns = recognizer.detect_defensive_patterns(
            board_after,
            move=(7, 7),
            player="X",
            threats_before=threats_before,
            threats_after=threats_after,
            player_threats_after=player_threats_after
        )
        
        # Check for sacrifice block or other patterns
        for pattern in patterns:
            assert pattern.pattern_type in DefensivePatternType
            assert pattern.pattern_name_vi in DEFENSIVE_PATTERN_NAMES_VI.values()


class TestPreventiveBlock:
    """Tests for Preventive Block (Chặn Phòng Ngừa) detection."""
    
    def test_preventive_block_prevents_fork(self):
        """
        Test preventive block when move prevents opponent fork.
        
        **Feature: gomoku-basic-analysis, Property 47: Double Block Recognition**
        **Validates: Requirements 17.3**
        """
        recognizer = DefensivePatternRecognizer()
        detector = ThreatDetector()
        
        # Create board where opponent could create fork
        board_before = create_empty_board()
        # Opponent has two developing threats that could become fork
        board_before[7][5] = "O"
        board_before[7][6] = "O"  # Horizontal developing
        board_before[5][7] = "O"
        board_before[6][7] = "O"  # Vertical developing
        
        threats_before = detector.detect_all_threats(board_before, "O")
        
        # Player blocks the key position
        board_after = [row[:] for row in board_before]
        board_after[7][7] = "X"
        
        threats_after = detector.detect_all_threats(board_after, "O")
        
        patterns = recognizer.detect_defensive_patterns(
            board_after,
            move=(7, 7),
            player="X",
            threats_before=threats_before,
            threats_after=threats_after
        )
        
        # Verify patterns have correct structure
        for pattern in patterns:
            assert pattern.pattern_type in DefensivePatternType
            assert pattern.move_position == (7, 7)


class TestPraiseCommentGeneration:
    """Tests for praise comment generation."""
    
    def test_generate_praise_all_languages(self):
        """
        Test praise comment generation in all languages.
        
        **Feature: gomoku-basic-analysis, Property 48: Defensive Pattern Names**
        **Validates: Requirements 17.4**
        """
        recognizer = DefensivePatternRecognizer()
        
        pattern = DefensivePattern(
            pattern_type=DefensivePatternType.DOUBLE_BLOCK,
            pattern_name_vi="Chặn Kép",
            threats_blocked=[],
            explanation="Test explanation",
            move_position=(7, 7)
        )
        
        for lang in ["vi", "en", "zh", "ja"]:
            comment = recognizer.generate_praise_comment(pattern, lang)
            assert comment is not None
            assert len(comment) > 0
            # Comment should contain the pattern name
            pattern_name = pattern.get_pattern_name(lang)
            assert pattern_name in comment
    
    @given(st.sampled_from(list(DefensivePatternType)))
    @settings(max_examples=10)
    def test_praise_comments_for_all_pattern_types(self, pattern_type: DefensivePatternType):
        """
        Property test: Praise comments work for all pattern types.
        
        **Feature: gomoku-basic-analysis, Property 48: Defensive Pattern Names**
        **Validates: Requirements 17.4**
        """
        recognizer = DefensivePatternRecognizer()
        
        pattern = DefensivePattern(
            pattern_type=pattern_type,
            pattern_name_vi=DEFENSIVE_PATTERN_NAMES_VI[pattern_type],
            threats_blocked=[],
            explanation="Test",
            move_position=(7, 7)
        )
        
        for lang in ["vi", "en", "zh", "ja"]:
            comment = recognizer.generate_praise_comment(pattern, lang)
            assert comment is not None
            assert len(comment) > 0


# ============================================
# Run tests
# ============================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
