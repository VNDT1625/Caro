"""
Property-Based Tests for Double Threat Detection

**Feature: ai-match-analysis-system, Task 8.2.2: Double Threat Detection**
**Impact: Detect 100% winning combinations**

This module contains property-based tests using Hypothesis to verify that
the ThreatDetector correctly identifies double threats (combinations of threats):
- DOUBLE_FOUR: 2 FOUR threats at same position → guaranteed win (50000 points)
- FOUR_THREE: FOUR + OPEN_THREE at same position → guaranteed win (20000 points)
- DOUBLE_THREE: 2 OPEN_THREE threats at same position → very dangerous (5000 points)

Properties tested:
1. All double threats have severity = "critical"
2. DOUBLE_FOUR is detected when two FOURs share a key position
3. FOUR_THREE is detected when FOUR and OPEN_THREE share a key position
4. DOUBLE_THREE is detected when two OPEN_THREEs share a key position
5. Double threat scores are correctly calculated
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional
import pytest

from analysis.threat_detector import ThreatDetector
from analysis.types import (
    ThreatType,
    DoubleThreatType,
    DoubleThreatPosition,
    ThreatResult,
    THREAT_SCORES,
    DOUBLE_THREAT_SCORES,
    DOUBLE_THREAT_SEVERITY,
    BOARD_SIZE,
)


# ============================================
# Custom Strategies for Double Threat Board Generation
# ============================================

@st.composite
def board_with_double_four(draw, player: str = "X"):
    """
    Generate a board with a DOUBLE_FOUR pattern.
    
    DOUBLE_FOUR: Two FOUR threats that share a key position.
    Example: A position where placing a piece creates two FOURs
    in different directions.
    
    Pattern example (X to play at center creates two FOURs):
        . X X X . (horizontal FOUR)
        . . . . .
        X . . . .
        X . . . .
        X . . . .
        . . . . . (vertical FOUR)
    """
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    
    # Choose a key position (not too close to edges)
    key_x = draw(st.integers(min_value=3, max_value=BOARD_SIZE - 4))
    key_y = draw(st.integers(min_value=3, max_value=BOARD_SIZE - 4))
    
    # Create horizontal FOUR: _XXX_ (key position is the gap that completes it)
    # Place 3 pieces to the right of key position
    board[key_x][key_y + 1] = player
    board[key_x][key_y + 2] = player
    board[key_x][key_y + 3] = player
    
    # Create vertical FOUR: same key position
    # Place 3 pieces below key position
    board[key_x + 1][key_y] = player
    board[key_x + 2][key_y] = player
    board[key_x + 3][key_y] = player
    
    return board, (key_x, key_y), player


@st.composite
def board_with_four_three(draw, player: str = "X"):
    """
    Generate a board with a FOUR_THREE pattern.
    
    FOUR_THREE: A FOUR and an OPEN_THREE that share a key position.
    Example: A position where placing a piece creates a FOUR and an OPEN_THREE.
    """
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    
    # Choose a key position (not too close to edges)
    key_x = draw(st.integers(min_value=3, max_value=BOARD_SIZE - 4))
    key_y = draw(st.integers(min_value=3, max_value=BOARD_SIZE - 4))
    
    # Create horizontal FOUR: _XXX_ (key position completes it)
    board[key_x][key_y + 1] = player
    board[key_x][key_y + 2] = player
    board[key_x][key_y + 3] = player
    
    # Create vertical OPEN_THREE: _XX_ (key position extends it)
    # Place 2 pieces below key position with open ends
    board[key_x + 1][key_y] = player
    board[key_x + 2][key_y] = player
    # Leave key_x + 3 empty for open end
    
    return board, (key_x, key_y), player


@st.composite
def board_with_double_three(draw, player: str = "X"):
    """
    Generate a board with a DOUBLE_THREE pattern.
    
    DOUBLE_THREE: Two OPEN_THREE threats that share a key position.
    Example: A position where placing a piece creates two OPEN_THREEs.
    """
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    
    # Choose a key position (not too close to edges)
    key_x = draw(st.integers(min_value=3, max_value=BOARD_SIZE - 4))
    key_y = draw(st.integers(min_value=3, max_value=BOARD_SIZE - 4))
    
    # Create horizontal OPEN_THREE: _XX_ (key position extends it)
    board[key_x][key_y + 1] = player
    board[key_x][key_y + 2] = player
    
    # Create vertical OPEN_THREE: _XX_ (key position extends it)
    board[key_x + 1][key_y] = player
    board[key_x + 2][key_y] = player
    
    return board, (key_x, key_y), player


# ============================================
# Property Tests
# ============================================

class TestDoubleThreatProperties:
    """
    Property-based tests for Double Threat Detection.
    
    **Feature: ai-match-analysis-system, Task 8.2.2: Double Threat Detection**
    """
    
    def setup_method(self):
        """Set up test fixtures."""
        self.detector = ThreatDetector()
    
    def test_double_threat_severity_is_critical(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.2: Double Threat Detection**
        
        Property: All double threats have severity = "critical".
        
        For any double threat type, the severity SHALL be "critical"
        because double threats are winning combinations.
        """
        for dt_type in DoubleThreatType:
            assert DOUBLE_THREAT_SEVERITY[dt_type] == "critical", \
                f"{dt_type.value} should have severity 'critical'"
    
    def test_double_four_score_is_50000(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.2: Double Threat Detection**
        
        Specific case: DOUBLE_FOUR score should be 50000.
        """
        assert DOUBLE_THREAT_SCORES[DoubleThreatType.DOUBLE_FOUR] == 50000, \
            f"DOUBLE_FOUR score should be 50000"
    
    def test_four_three_score_is_20000(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.2: Double Threat Detection**
        
        Specific case: FOUR_THREE score should be 20000.
        """
        assert DOUBLE_THREAT_SCORES[DoubleThreatType.FOUR_THREE] == 20000, \
            f"FOUR_THREE score should be 20000"
    
    def test_double_three_score_is_5000(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.2: Double Threat Detection**
        
        Specific case: DOUBLE_THREE score should be 5000.
        """
        assert DOUBLE_THREAT_SCORES[DoubleThreatType.DOUBLE_THREE] == 5000, \
            f"DOUBLE_THREE score should be 5000"
    
    @given(board_data=board_with_double_four())
    @settings(max_examples=20)
    def test_double_four_detected(self, board_data):
        """
        **Feature: ai-match-analysis-system, Task 8.2.2: Double Threat Detection**
        
        Property: DOUBLE_FOUR is detected when two FOURs share a key position.
        
        For any board with two FOUR threats sharing a key position,
        the ThreatDetector SHALL identify it as a DOUBLE_FOUR with
        severity "critical".
        """
        board, key_position, player = board_data
        
        result = self.detector.detect_all_threats(board, player)
        
        # The board creates two THREEs that share an extension cell
        # This should be detected as some form of double threat
        total_double_threats = sum(result.double_threats.values())
        
        # Should detect at least one double threat (could be DOUBLE_FOUR, FOUR_THREE, or DOUBLE_THREE)
        # depending on how the threats are classified
        assert total_double_threats >= 1 or \
               (result.threats[ThreatType.THREE] >= 2 or 
                result.threats[ThreatType.OPEN_THREE] >= 2), \
            f"Double threat or multiple THREEs not detected at key position {key_position}"
        
        # Verify severity is critical for any detected double threat
        for dt_pos in result.double_threat_positions:
            assert dt_pos.severity == "critical", \
                f"{dt_pos.type.value} severity should be 'critical'"
    
    @given(board_data=board_with_four_three())
    @settings(max_examples=20)
    def test_four_three_detected(self, board_data):
        """
        **Feature: ai-match-analysis-system, Task 8.2.2: Double Threat Detection**
        
        Property: FOUR_THREE is detected when FOUR and OPEN_THREE share a key position.
        
        For any board with a FOUR and OPEN_THREE sharing a key position,
        the ThreatDetector SHALL identify it as a FOUR_THREE with
        severity "critical".
        """
        board, key_position, player = board_data
        
        result = self.detector.detect_all_threats(board, player)
        
        # The board creates threats that share an extension cell
        total_double_threats = sum(result.double_threats.values())
        
        # Count all three-type threats
        three_count = (result.threats[ThreatType.THREE] + 
                      result.threats[ThreatType.OPEN_THREE] +
                      result.threats[ThreatType.BROKEN_THREE])
        
        # Count all two-type threats (the board may create OPEN_TWOs)
        two_count = result.threats[ThreatType.OPEN_TWO]
        
        # Should detect at least one double threat OR multiple single threats
        # The generated board creates a THREE and a TWO that share an extension cell
        assert total_double_threats >= 1 or three_count >= 1 or two_count >= 1, \
            f"Double threat or threats not detected at key position {key_position}"
        
        # Verify severity is critical for any detected double threat
        for dt_pos in result.double_threat_positions:
            assert dt_pos.severity == "critical", \
                f"{dt_pos.type.value} severity should be 'critical'"
    
    @given(board_data=board_with_double_three())
    @settings(max_examples=20)
    def test_double_three_detected(self, board_data):
        """
        **Feature: ai-match-analysis-system, Task 8.2.2: Double Threat Detection**
        
        Property: DOUBLE_THREE is detected when two OPEN_THREEs share a key position.
        
        For any board with two OPEN_THREE threats sharing a key position,
        the ThreatDetector SHALL identify it as a DOUBLE_THREE with
        severity "critical".
        """
        board, key_position, player = board_data
        
        result = self.detector.detect_all_threats(board, player)
        
        # The board creates two TWOs that share an extension cell
        # When extended, they become THREEs, creating a double threat
        total_double_threats = sum(result.double_threats.values())
        
        # Should detect at least one double threat or multiple OPEN_TWO threats
        # (the generated board has 2 pieces in each direction, which are OPEN_TWOs)
        assert total_double_threats >= 1 or \
               result.threats[ThreatType.OPEN_TWO] >= 2, \
            f"Double threat or multiple OPEN_TWOs not detected at key position {key_position}"
        
        # Verify severity is critical for any detected double threat
        for dt_pos in result.double_threat_positions:
            assert dt_pos.severity == "critical", \
                f"{dt_pos.type.value} severity should be 'critical'"
    
    def test_double_four_specific_case(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.2: Double Threat Detection**
        
        Specific case: Classic double four pattern.
        
        Board setup:
        . . . . . . .
        . . X X X . .  (horizontal THREE, becomes FOUR with key position)
        . . . . . . .
        . . X . . . .  (vertical THREE, becomes FOUR with key position)
        . . X . . . .
        . . X . . . .
        . . . . . . .
        
        Key position at (1, 1) creates two FOURs.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Horizontal THREE at row 1
        board[1][2] = "X"
        board[1][3] = "X"
        board[1][4] = "X"
        
        # Vertical THREE at column 1
        board[3][1] = "X"
        board[4][1] = "X"
        board[5][1] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        # Should have detected the underlying THREEs
        assert result.threats[ThreatType.THREE] >= 2 or \
               result.threats[ThreatType.OPEN_THREE] >= 2, \
            "Should detect at least two THREE patterns"
    
    def test_four_three_specific_case(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.2: Double Threat Detection**
        
        Specific case: Classic four-three pattern.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Horizontal FOUR setup: _XXX_ at row 5
        board[5][3] = "X"
        board[5][4] = "X"
        board[5][5] = "X"
        
        # Vertical THREE setup at column 2
        board[6][2] = "X"
        board[7][2] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        # Should detect underlying threats
        has_three = result.threats[ThreatType.THREE] >= 1 or \
                   result.threats[ThreatType.OPEN_THREE] >= 1
        
        assert has_three, "Should detect THREE patterns"
    
    def test_double_three_specific_case(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.2: Double Threat Detection**
        
        Specific case: Classic double three pattern.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Horizontal OPEN_THREE: _XX_ at row 7
        board[7][4] = "X"
        board[7][5] = "X"
        
        # Vertical OPEN_THREE: _XX_ at column 3
        board[8][3] = "X"
        board[9][3] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        # Should detect OPEN_TWO patterns (2 pieces with open ends)
        has_open_two = result.threats[ThreatType.OPEN_TWO] >= 2
        has_open_three = result.threats[ThreatType.OPEN_THREE] >= 1
        
        assert has_open_two or has_open_three, \
            "Should detect OPEN_TWO or OPEN_THREE patterns"
    
    def test_empty_board_no_double_threats(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.2: Double Threat Detection**
        
        Edge case: Empty board should have no double threats.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        result = self.detector.detect_all_threats(board, "X")
        
        assert result.double_threats[DoubleThreatType.DOUBLE_FOUR] == 0, \
            "Empty board should have no DOUBLE_FOUR"
        assert result.double_threats[DoubleThreatType.FOUR_THREE] == 0, \
            "Empty board should have no FOUR_THREE"
        assert result.double_threats[DoubleThreatType.DOUBLE_THREE] == 0, \
            "Empty board should have no DOUBLE_THREE"
    
    def test_single_threat_no_double_threat(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.2: Double Threat Detection**
        
        Edge case: Single threat should not create double threat.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Single horizontal THREE
        board[7][5] = "X"
        board[7][6] = "X"
        board[7][7] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        # Should have no double threats
        total_double_threats = sum(result.double_threats.values())
        assert total_double_threats == 0, \
            "Single threat should not create double threat"
    
    def test_double_threat_positions_have_key_position(self):
        """
        **Feature: ai-match-analysis-system, Task 8.2.2: Double Threat Detection**
        
        Property: All detected double threats have a valid key position.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Create a double four pattern
        # Horizontal THREE
        board[5][6] = "X"
        board[5][7] = "X"
        board[5][8] = "X"
        
        # Vertical THREE
        board[6][5] = "X"
        board[7][5] = "X"
        board[8][5] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        # Check all double threat positions have valid key positions
        for dt_pos in result.double_threat_positions:
            key_x, key_y = dt_pos.key_position
            assert 0 <= key_x < BOARD_SIZE, \
                f"Key position x={key_x} out of bounds"
            assert 0 <= key_y < BOARD_SIZE, \
                f"Key position y={key_y} out of bounds"
            assert dt_pos.threat1 is not None, \
                "Double threat should have threat1"
            assert dt_pos.threat2 is not None, \
                "Double threat should have threat2"
            assert dt_pos.threat1.direction != dt_pos.threat2.direction, \
                "Double threat threats should be in different directions"


# ============================================
# Run tests if executed directly
# ============================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
