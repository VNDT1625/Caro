"""
Property-Based Tests for Broken Pattern Detection

**Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
**Impact: +20% threat detection accuracy**

This module contains property-based tests using Hypothesis to verify that
the ThreatDetector correctly identifies broken patterns (patterns with gaps):
- BROKEN_FOUR: X_XXX, XX_XX, XXX_X (4 pieces with 1 gap, score: 800)
- BROKEN_THREE: X_XX, XX_X (3 pieces with 1 gap, score: 80)
- JUMP_THREE: X__XX, XX__X (3 pieces with 2 gaps, score: 60)

Properties tested:
1. All broken four patterns are detected correctly
2. All broken three patterns are detected correctly
3. All jump three patterns are detected correctly
4. Broken pattern scores match expected values
5. No false positives for broken patterns
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional, Set
import pytest

from analysis.threat_detector import ThreatDetector
from analysis.types import (
    ThreatType,
    ThreatPosition,
    ThreatResult,
    THREAT_SCORES,
    BOARD_SIZE,
)


# ============================================
# Custom Strategies for Board Generation
# ============================================

@st.composite
def board_with_broken_four(draw, player: str = "X"):
    """
    Generate a board with a known broken four pattern.
    
    Broken four patterns: X_XXX, XX_XX, XXX_X
    
    Note: Direction vectors must match the ThreatDetector's DIRECTIONS:
    - horizontal: (0, 1)
    - vertical: (1, 0)
    - diagonal_down: (1, 1)
    - diagonal_up: (1, -1)  # This goes from top-right to bottom-left
    """
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    
    # Choose pattern type
    pattern_type = draw(st.sampled_from(["X_XXX", "XX_XX", "XXX_X"]))
    
    # Choose direction - use same vectors as ThreatDetector
    direction = draw(st.sampled_from(["horizontal", "vertical", "diagonal_down", "diagonal_up"]))
    
    # Calculate direction vectors (must match ThreatDetector.DIRECTIONS)
    if direction == "horizontal":
        dx, dy = 0, 1
    elif direction == "vertical":
        dx, dy = 1, 0
    elif direction == "diagonal_down":
        dx, dy = 1, 1
    else:  # diagonal_up: goes from top-right to bottom-left
        dx, dy = 1, -1
    
    # Calculate valid starting positions (need 5 cells in the direction)
    if direction == "horizontal":
        start_x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
        start_y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 5))
    elif direction == "vertical":
        start_x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 5))
        start_y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    elif direction == "diagonal_down":
        start_x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 5))
        start_y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 5))
    else:  # diagonal_up: start from top, y must have room to go left
        start_x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 5))
        start_y = draw(st.integers(min_value=4, max_value=BOARD_SIZE - 1))
    
    # Place pieces based on pattern
    positions = []
    if pattern_type == "X_XXX":
        # Indices: 0, 2, 3, 4 (gap at 1)
        indices = [0, 2, 3, 4]
    elif pattern_type == "XX_XX":
        # Indices: 0, 1, 3, 4 (gap at 2)
        indices = [0, 1, 3, 4]
    else:  # XXX_X
        # Indices: 0, 1, 2, 4 (gap at 3)
        indices = [0, 1, 2, 4]
    
    for i in indices:
        x = start_x + i * dx
        y = start_y + i * dy
        board[x][y] = player
        positions.append((x, y))
    
    return board, positions, direction, pattern_type, player


@st.composite
def board_with_broken_three(draw, player: str = "X"):
    """
    Generate a board with a known broken three pattern.
    
    Broken three patterns: X_XX, XX_X
    
    Note: Direction vectors must match the ThreatDetector's DIRECTIONS.
    """
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    
    # Choose pattern type
    pattern_type = draw(st.sampled_from(["X_XX", "XX_X"]))
    
    # Choose direction - use same vectors as ThreatDetector
    direction = draw(st.sampled_from(["horizontal", "vertical", "diagonal_down", "diagonal_up"]))
    
    # Calculate direction vectors (must match ThreatDetector.DIRECTIONS)
    if direction == "horizontal":
        dx, dy = 0, 1
    elif direction == "vertical":
        dx, dy = 1, 0
    elif direction == "diagonal_down":
        dx, dy = 1, 1
    else:  # diagonal_up: goes from top-right to bottom-left
        dx, dy = 1, -1
    
    # Calculate valid starting positions (need 4 cells)
    if direction == "horizontal":
        start_x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
        start_y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 4))
    elif direction == "vertical":
        start_x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 4))
        start_y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    elif direction == "diagonal_down":
        start_x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 4))
        start_y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 4))
    else:  # diagonal_up: start from top, y must have room to go left
        start_x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 4))
        start_y = draw(st.integers(min_value=3, max_value=BOARD_SIZE - 1))
    
    # Place pieces based on pattern
    positions = []
    if pattern_type == "X_XX":
        # Indices: 0, 2, 3 (gap at 1)
        indices = [0, 2, 3]
    else:  # XX_X
        # Indices: 0, 1, 3 (gap at 2)
        indices = [0, 1, 3]
    
    for i in indices:
        x = start_x + i * dx
        y = start_y + i * dy
        board[x][y] = player
        positions.append((x, y))
    
    return board, positions, direction, pattern_type, player


@st.composite
def board_with_jump_three(draw, player: str = "X"):
    """
    Generate a board with a known jump three pattern.
    
    Jump three patterns: X__XX, XX__X
    
    Note: Direction vectors must match the ThreatDetector's DIRECTIONS.
    """
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    
    # Choose pattern type
    pattern_type = draw(st.sampled_from(["X__XX", "XX__X"]))
    
    # Choose direction - use same vectors as ThreatDetector
    direction = draw(st.sampled_from(["horizontal", "vertical", "diagonal_down", "diagonal_up"]))
    
    # Calculate direction vectors (must match ThreatDetector.DIRECTIONS)
    if direction == "horizontal":
        dx, dy = 0, 1
    elif direction == "vertical":
        dx, dy = 1, 0
    elif direction == "diagonal_down":
        dx, dy = 1, 1
    else:  # diagonal_up: goes from top-right to bottom-left
        dx, dy = 1, -1
    
    # Calculate valid starting positions (need 5 cells)
    if direction == "horizontal":
        start_x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
        start_y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 5))
    elif direction == "vertical":
        start_x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 5))
        start_y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    elif direction == "diagonal_down":
        start_x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 5))
        start_y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 5))
    else:  # diagonal_up: start from top, y must have room to go left
        start_x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 5))
        start_y = draw(st.integers(min_value=4, max_value=BOARD_SIZE - 1))
    
    # Place pieces based on pattern
    positions = []
    if pattern_type == "X__XX":
        # Indices: 0, 3, 4 (gaps at 1, 2)
        indices = [0, 3, 4]
    else:  # XX__X
        # Indices: 0, 1, 4 (gaps at 2, 3)
        indices = [0, 1, 4]
    
    for i in indices:
        x = start_x + i * dx
        y = start_y + i * dy
        board[x][y] = player
        positions.append((x, y))
    
    return board, positions, direction, pattern_type, player


# ============================================
# Property Tests
# ============================================

class TestBrokenPatternProperties:
    """
    Property-based tests for Broken Pattern Detection.
    
    **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
    """
    
    def setup_method(self):
        """Set up test fixtures."""
        self.detector = ThreatDetector()
    
    @given(board_data=board_with_broken_four())
    @settings(max_examples=100)
    def test_broken_four_detected(self, board_data):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Property: All broken four patterns (X_XXX, XX_XX, XXX_X) are detected.
        
        For any board with a broken four pattern, the ThreatDetector SHALL
        identify it as a BROKEN_FOUR threat with score 800.
        """
        board, positions, direction, pattern_type, player = board_data
        
        result = self.detector.detect_all_threats(board, player)
        
        # Should detect at least one BROKEN_FOUR
        assert result.threats[ThreatType.BROKEN_FOUR] >= 1, \
            f"Broken four pattern {pattern_type} not detected"
        
        # Verify score contribution
        assert result.total_score >= THREAT_SCORES[ThreatType.BROKEN_FOUR], \
            f"Score should include BROKEN_FOUR score of {THREAT_SCORES[ThreatType.BROKEN_FOUR]}"
    
    @given(board_data=board_with_broken_three())
    @settings(max_examples=100)
    def test_broken_three_detected(self, board_data):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Property: All broken three patterns (X_XX, XX_X) are detected.
        
        For any board with a broken three pattern, the ThreatDetector SHALL
        identify it as a BROKEN_THREE threat with score 80.
        """
        board, positions, direction, pattern_type, player = board_data
        
        result = self.detector.detect_all_threats(board, player)
        
        # Should detect at least one BROKEN_THREE
        # Note: May also detect other patterns like OPEN_TWO
        assert result.threats[ThreatType.BROKEN_THREE] >= 1, \
            f"Broken three pattern {pattern_type} not detected"
        
        # Verify score contribution
        assert result.total_score >= THREAT_SCORES[ThreatType.BROKEN_THREE], \
            f"Score should include BROKEN_THREE score of {THREAT_SCORES[ThreatType.BROKEN_THREE]}"
    
    @given(board_data=board_with_jump_three())
    @settings(max_examples=100)
    def test_jump_three_detected(self, board_data):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Property: All jump three patterns (X__XX, XX__X) are detected.
        
        For any board with a jump three pattern, the ThreatDetector SHALL
        identify it as a JUMP_THREE threat with score 60.
        """
        board, positions, direction, pattern_type, player = board_data
        
        result = self.detector.detect_all_threats(board, player)
        
        # Should detect at least one JUMP_THREE
        assert result.threats[ThreatType.JUMP_THREE] >= 1, \
            f"Jump three pattern {pattern_type} not detected"
        
        # Verify score contribution
        assert result.total_score >= THREAT_SCORES[ThreatType.JUMP_THREE], \
            f"Score should include JUMP_THREE score of {THREAT_SCORES[ThreatType.JUMP_THREE]}"
    
    def test_broken_four_score_is_800(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Specific case: BROKEN_FOUR score should be 800.
        """
        assert THREAT_SCORES[ThreatType.BROKEN_FOUR] == 800, \
            f"BROKEN_FOUR score should be 800, got {THREAT_SCORES[ThreatType.BROKEN_FOUR]}"
    
    def test_broken_three_score_is_80(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Specific case: BROKEN_THREE score should be 80.
        """
        assert THREAT_SCORES[ThreatType.BROKEN_THREE] == 80, \
            f"BROKEN_THREE score should be 80, got {THREAT_SCORES[ThreatType.BROKEN_THREE]}"
    
    def test_jump_three_score_is_60(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Specific case: JUMP_THREE score should be 60.
        """
        assert THREAT_SCORES[ThreatType.JUMP_THREE] == 60, \
            f"JUMP_THREE score should be 60, got {THREAT_SCORES[ThreatType.JUMP_THREE]}"
    
    def test_broken_four_x_xxx_horizontal(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Specific case: X_XXX pattern horizontal should be detected.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Place X_XXX pattern: X at 0, gap at 1, XXX at 2,3,4
        board[7][0] = "X"
        board[7][2] = "X"
        board[7][3] = "X"
        board[7][4] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        assert result.threats[ThreatType.BROKEN_FOUR] >= 1, \
            "X_XXX pattern should be detected as BROKEN_FOUR"
    
    def test_broken_four_xx_xx_horizontal(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Specific case: XX_XX pattern horizontal should be detected.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Place XX_XX pattern: XX at 0,1, gap at 2, XX at 3,4
        board[7][0] = "X"
        board[7][1] = "X"
        board[7][3] = "X"
        board[7][4] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        assert result.threats[ThreatType.BROKEN_FOUR] >= 1, \
            "XX_XX pattern should be detected as BROKEN_FOUR"
    
    def test_broken_four_xxx_x_horizontal(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Specific case: XXX_X pattern horizontal should be detected.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Place XXX_X pattern: XXX at 0,1,2, gap at 3, X at 4
        board[7][0] = "X"
        board[7][1] = "X"
        board[7][2] = "X"
        board[7][4] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        assert result.threats[ThreatType.BROKEN_FOUR] >= 1, \
            "XXX_X pattern should be detected as BROKEN_FOUR"
    
    def test_broken_three_x_xx_horizontal(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Specific case: X_XX pattern horizontal should be detected.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Place X_XX pattern: X at 0, gap at 1, XX at 2,3
        board[7][0] = "X"
        board[7][2] = "X"
        board[7][3] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        assert result.threats[ThreatType.BROKEN_THREE] >= 1, \
            "X_XX pattern should be detected as BROKEN_THREE"
    
    def test_broken_three_xx_x_horizontal(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Specific case: XX_X pattern horizontal should be detected.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Place XX_X pattern: XX at 0,1, gap at 2, X at 3
        board[7][0] = "X"
        board[7][1] = "X"
        board[7][3] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        assert result.threats[ThreatType.BROKEN_THREE] >= 1, \
            "XX_X pattern should be detected as BROKEN_THREE"
    
    def test_jump_three_x__xx_horizontal(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Specific case: X__XX pattern horizontal should be detected.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Place X__XX pattern: X at 0, gaps at 1,2, XX at 3,4
        board[7][0] = "X"
        board[7][3] = "X"
        board[7][4] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        assert result.threats[ThreatType.JUMP_THREE] >= 1, \
            "X__XX pattern should be detected as JUMP_THREE"
    
    def test_jump_three_xx__x_horizontal(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Specific case: XX__X pattern horizontal should be detected.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Place XX__X pattern: XX at 0,1, gaps at 2,3, X at 4
        board[7][0] = "X"
        board[7][1] = "X"
        board[7][4] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        assert result.threats[ThreatType.JUMP_THREE] >= 1, \
            "XX__X pattern should be detected as JUMP_THREE"
    
    def test_empty_board_no_broken_patterns(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Edge case: Empty board should have no broken patterns.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        result = self.detector.detect_all_threats(board, "X")
        
        assert result.threats[ThreatType.BROKEN_FOUR] == 0, \
            "Empty board should have no BROKEN_FOUR"
        assert result.threats[ThreatType.BROKEN_THREE] == 0, \
            "Empty board should have no BROKEN_THREE"
        assert result.threats[ThreatType.JUMP_THREE] == 0, \
            "Empty board should have no JUMP_THREE"
    
    def test_broken_patterns_vertical(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Specific case: Broken patterns should be detected in vertical direction.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Place X_XXX pattern vertically
        board[0][7] = "X"
        board[2][7] = "X"
        board[3][7] = "X"
        board[4][7] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        assert result.threats[ThreatType.BROKEN_FOUR] >= 1, \
            "Vertical X_XXX pattern should be detected as BROKEN_FOUR"
    
    def test_broken_patterns_diagonal(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.1: Broken Pattern Detection**
        
        Specific case: Broken patterns should be detected in diagonal direction.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Place X_XXX pattern diagonally (down-right)
        board[0][0] = "X"
        board[2][2] = "X"
        board[3][3] = "X"
        board[4][4] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        assert result.threats[ThreatType.BROKEN_FOUR] >= 1, \
            "Diagonal X_XXX pattern should be detected as BROKEN_FOUR"


# ============================================
# Run tests if executed directly
# ============================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
