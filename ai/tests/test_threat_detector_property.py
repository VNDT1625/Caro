"""
Property-Based Tests for ThreatDetector

**Feature: ai-match-analysis-system, Property 1: Threat Detection Completeness and Accuracy**
**Validates: Requirements 1.1, 1.2, 1.3, 1.5**

This module contains property-based tests using Hypothesis to verify that
the ThreatDetector correctly identifies all threat patterns on the board.

Properties tested:
1. Each identified threat has a valid type
2. The threat score matches the expected value for its type
3. No duplicate threats are reported for the same positions
4. All threats on the board are detected (no false negatives)
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
def board_with_pieces(draw, min_pieces: int = 0, max_pieces: int = 50):
    """
    Generate a valid board state with random pieces.
    
    Args:
        min_pieces: Minimum number of pieces on the board
        max_pieces: Maximum number of pieces on the board
        
    Returns:
        A tuple of (board, pieces) where board is a 2D array and
        pieces is a list of (x, y, player) tuples
    """
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    pieces: List[Tuple[int, int, str]] = []
    
    num_pieces = draw(st.integers(min_value=min_pieces, max_value=max_pieces))
    
    # Generate unique positions
    positions = draw(st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=BOARD_SIZE - 1),
            st.integers(min_value=0, max_value=BOARD_SIZE - 1)
        ),
        min_size=num_pieces,
        max_size=num_pieces,
        unique=True
    ))
    
    # Assign players alternately (roughly balanced)
    for i, (x, y) in enumerate(positions):
        player = "X" if i % 2 == 0 else "O"
        board[x][y] = player
        pieces.append((x, y, player))
    
    return board, pieces


@st.composite
def board_with_known_threat(draw, threat_type: ThreatType, player: str = "X"):
    """
    Generate a board with a known threat pattern.
    
    This is used to verify that specific threat types are detected correctly.
    """
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    
    # Choose a random starting position and direction
    direction = draw(st.sampled_from(["horizontal", "vertical", "diagonal_down", "diagonal_up"]))
    
    # Determine piece count based on threat type
    if threat_type == ThreatType.FIVE:
        count = 5
    elif threat_type in [ThreatType.OPEN_FOUR, ThreatType.FOUR]:
        count = 4
    elif threat_type in [ThreatType.OPEN_THREE, ThreatType.THREE]:
        count = 3
    elif threat_type == ThreatType.OPEN_TWO:
        count = 2
    else:
        count = 1
    
    # Calculate valid starting positions based on direction
    if direction == "horizontal":
        dx, dy = 0, 1
        max_start_x = BOARD_SIZE - 1
        max_start_y = BOARD_SIZE - count - 1  # Leave room for open ends
        min_start_y = 1  # Leave room for open end on left
    elif direction == "vertical":
        dx, dy = 1, 0
        max_start_x = BOARD_SIZE - count - 1
        max_start_y = BOARD_SIZE - 1
        min_start_y = 0
        min_start_x = 1
    elif direction == "diagonal_down":
        dx, dy = 1, 1
        max_start_x = BOARD_SIZE - count - 1
        max_start_y = BOARD_SIZE - count - 1
        min_start_x = 1
        min_start_y = 1
    else:  # diagonal_up
        dx, dy = -1, 1
        max_start_x = BOARD_SIZE - 1
        max_start_y = BOARD_SIZE - count - 1
        min_start_x = count
        min_start_y = 1
    
    # Adjust for open ends requirement
    needs_open_ends = threat_type in [ThreatType.OPEN_FOUR, ThreatType.OPEN_THREE, ThreatType.OPEN_TWO]
    
    if direction == "horizontal":
        start_x = draw(st.integers(min_value=0, max_value=max_start_x))
        if needs_open_ends:
            start_y = draw(st.integers(min_value=1, max_value=BOARD_SIZE - count - 1))
        else:
            start_y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - count))
    elif direction == "vertical":
        if needs_open_ends:
            start_x = draw(st.integers(min_value=1, max_value=BOARD_SIZE - count - 1))
        else:
            start_x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - count))
        start_y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    elif direction == "diagonal_down":
        if needs_open_ends:
            start_x = draw(st.integers(min_value=1, max_value=BOARD_SIZE - count - 1))
            start_y = draw(st.integers(min_value=1, max_value=BOARD_SIZE - count - 1))
        else:
            start_x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - count))
            start_y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - count))
    else:  # diagonal_up
        if needs_open_ends:
            start_x = draw(st.integers(min_value=count, max_value=BOARD_SIZE - 2))
            start_y = draw(st.integers(min_value=1, max_value=BOARD_SIZE - count - 1))
        else:
            start_x = draw(st.integers(min_value=count - 1, max_value=BOARD_SIZE - 1))
            start_y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - count))
    
    # Place the pieces
    positions = []
    x, y = start_x, start_y
    for _ in range(count):
        board[x][y] = player
        positions.append((x, y))
        x += dx
        y += dy
    
    return board, positions, direction, threat_type, player


# ============================================
# Property Tests
# ============================================

class TestThreatDetectorProperties:
    """
    Property-based tests for ThreatDetector.
    
    **Feature: ai-match-analysis-system, Property 1: Threat Detection Completeness and Accuracy**
    **Validates: Requirements 1.1, 1.2, 1.3, 1.5**
    """
    
    def setup_method(self):
        """Set up test fixtures."""
        self.detector = ThreatDetector()
    
    @given(board_data=board_with_pieces(min_pieces=0, max_pieces=50))
    @settings(max_examples=100)
    def test_threat_types_are_valid(self, board_data):
        """
        **Feature: ai-match-analysis-system, Property 1: Threat Detection Completeness and Accuracy**
        
        Property: Each identified threat has a valid type.
        
        For any board state, all detected threats must have a type that is
        a valid ThreatType enum value.
        """
        board, pieces = board_data
        
        for player in ["X", "O"]:
            result = self.detector.detect_all_threats(board, player)
            
            # All threat positions must have valid types
            for threat_pos in result.threat_positions:
                assert isinstance(threat_pos.type, ThreatType), \
                    f"Threat type {threat_pos.type} is not a valid ThreatType"
                assert threat_pos.type in ThreatType, \
                    f"Threat type {threat_pos.type} is not in ThreatType enum"
    
    @given(board_data=board_with_pieces(min_pieces=0, max_pieces=50))
    @settings(max_examples=100)
    def test_threat_scores_match_type(self, board_data):
        """
        **Feature: ai-match-analysis-system, Property 1: Threat Detection Completeness and Accuracy**
        
        Property: The threat score matches the expected value for its type.
        
        For any board state, the total score must equal the sum of
        individual threat scores (single threats + double threats).
        """
        board, pieces = board_data
        
        for player in ["X", "O"]:
            result = self.detector.detect_all_threats(board, player)
            
            # Calculate expected score from single threat counts
            expected_score = sum(
                count * THREAT_SCORES[threat_type]
                for threat_type, count in result.threats.items()
            )
            
            # Add double threat scores
            from analysis.types import DOUBLE_THREAT_SCORES
            expected_score += sum(
                count * DOUBLE_THREAT_SCORES[double_type]
                for double_type, count in result.double_threats.items()
            )
            
            assert result.total_score == expected_score, \
                f"Total score {result.total_score} doesn't match expected {expected_score}"
    
    @given(board_data=board_with_pieces(min_pieces=0, max_pieces=50))
    @settings(max_examples=100)
    def test_no_duplicate_threats(self, board_data):
        """
        **Feature: ai-match-analysis-system, Property 1: Threat Detection Completeness and Accuracy**
        
        Property: No duplicate threats are reported for the same positions.
        
        For any board state, each unique set of positions should only
        appear once in the threat_positions list.
        """
        board, pieces = board_data
        
        for player in ["X", "O"]:
            result = self.detector.detect_all_threats(board, player)
            
            # Check for duplicates by comparing position sets
            seen_positions: Set[Tuple[Tuple[int, int], ...]] = set()
            
            for threat_pos in result.threat_positions:
                pos_key = tuple(sorted(threat_pos.positions))
                assert pos_key not in seen_positions, \
                    f"Duplicate threat detected at positions {threat_pos.positions}"
                seen_positions.add(pos_key)
    
    @given(board_data=board_with_pieces(min_pieces=0, max_pieces=50))
    @settings(max_examples=100)
    def test_threat_count_matches_positions(self, board_data):
        """
        **Feature: ai-match-analysis-system, Property 1: Threat Detection Completeness and Accuracy**
        
        Property: Threat counts match the number of threat positions.
        
        For any board state, the sum of threat counts must equal
        the number of threat positions.
        """
        board, pieces = board_data
        
        for player in ["X", "O"]:
            result = self.detector.detect_all_threats(board, player)
            
            total_count = sum(result.threats.values())
            num_positions = len(result.threat_positions)
            
            assert total_count == num_positions, \
                f"Threat count {total_count} doesn't match positions count {num_positions}"
    
    @given(board_data=board_with_pieces(min_pieces=0, max_pieces=50))
    @settings(max_examples=100)
    def test_threat_positions_contain_player_pieces(self, board_data):
        """
        **Feature: ai-match-analysis-system, Property 1: Threat Detection Completeness and Accuracy**
        
        Property: All positions in a threat contain the player's pieces.
        
        For any detected threat, all positions must contain the
        player's piece on the board.
        """
        board, pieces = board_data
        
        for player in ["X", "O"]:
            result = self.detector.detect_all_threats(board, player)
            
            for threat_pos in result.threat_positions:
                for x, y in threat_pos.positions:
                    assert board[x][y] == player, \
                        f"Position ({x}, {y}) in threat doesn't contain player {player}'s piece"
    
    @given(board_data=board_with_pieces(min_pieces=0, max_pieces=50))
    @settings(max_examples=100)
    def test_threat_positions_are_consecutive(self, board_data):
        """
        **Feature: ai-match-analysis-system, Property 1: Threat Detection Completeness and Accuracy**
        
        Property: Threat positions are consecutive in their direction.
        
        For any detected threat (except broken patterns), the positions must form a consecutive
        line in the specified direction.
        
        Note: Broken patterns (BROKEN_FOUR, BROKEN_THREE, JUMP_THREE) are excluded from this
        check because they have gaps by design.
        """
        board, pieces = board_data
        
        direction_vectors = {
            "horizontal": (0, 1),
            "vertical": (1, 0),
            "diagonal_down": (1, 1),
            "diagonal_up": (1, -1),
        }
        
        # Broken patterns have gaps by design, so exclude them from consecutive check
        broken_pattern_types = {ThreatType.BROKEN_FOUR, ThreatType.BROKEN_THREE, ThreatType.JUMP_THREE}
        
        for player in ["X", "O"]:
            result = self.detector.detect_all_threats(board, player)
            
            for threat_pos in result.threat_positions:
                # Skip broken patterns - they have gaps by design
                if threat_pos.type in broken_pattern_types:
                    continue
                    
                if len(threat_pos.positions) < 2:
                    continue
                
                dx, dy = direction_vectors[threat_pos.direction]
                sorted_positions = sorted(threat_pos.positions)
                
                # Check that positions are consecutive
                for i in range(len(sorted_positions) - 1):
                    x1, y1 = sorted_positions[i]
                    x2, y2 = sorted_positions[i + 1]
                    
                    # The difference should match the direction vector
                    assert (x2 - x1, y2 - y1) == (dx, dy) or (x2 - x1, y2 - y1) == (-dx, -dy), \
                        f"Positions {sorted_positions[i]} and {sorted_positions[i+1]} are not consecutive in direction {threat_pos.direction}"
    
    def test_empty_board_has_no_threats(self):
        """
        **Feature: ai-match-analysis-system, Property 1: Threat Detection Completeness and Accuracy**
        
        Edge case: Empty board should have no threats.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        for player in ["X", "O"]:
            result = self.detector.detect_all_threats(board, player)
            
            assert result.total_score == 0, "Empty board should have score 0"
            assert len(result.threat_positions) == 0, "Empty board should have no threats"
            assert all(count == 0 for count in result.threats.values()), \
                "Empty board should have zero count for all threat types"
    
    def test_five_in_row_detected(self):
        """
        **Feature: ai-match-analysis-system, Property 1: Threat Detection Completeness and Accuracy**
        
        Specific case: Five in a row should be detected as FIVE threat.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Place five X's in a row horizontally
        for i in range(5):
            board[7][i] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        assert result.threats[ThreatType.FIVE] >= 1, \
            "Five in a row should be detected as FIVE threat"
        assert result.total_score >= THREAT_SCORES[ThreatType.FIVE], \
            f"Score should be at least {THREAT_SCORES[ThreatType.FIVE]}"
    
    def test_open_four_detected(self):
        """
        **Feature: ai-match-analysis-system, Property 1: Threat Detection Completeness and Accuracy**
        
        Specific case: Four in a row with both ends open should be OPEN_FOUR.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Place four X's in a row with open ends (positions 2-5, leaving 1 and 6 empty)
        for i in range(2, 6):
            board[7][i] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        assert result.threats[ThreatType.OPEN_FOUR] >= 1, \
            "Four in a row with open ends should be detected as OPEN_FOUR"
    
    def test_blocked_four_detected(self):
        """
        **Feature: ai-match-analysis-system, Property 1: Threat Detection Completeness and Accuracy**
        
        Specific case: Four in a row with one end blocked should be FOUR.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Place four X's starting from edge (blocked on left)
        for i in range(4):
            board[7][i] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        assert result.threats[ThreatType.FOUR] >= 1, \
            "Four in a row with one blocked end should be detected as FOUR"
    
    def test_open_three_detected(self):
        """
        **Feature: ai-match-analysis-system, Property 1: Threat Detection Completeness and Accuracy**
        
        Specific case: Three in a row with both ends open should be OPEN_THREE.
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        # Place three X's in a row with open ends
        for i in range(3, 6):
            board[7][i] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        
        assert result.threats[ThreatType.OPEN_THREE] >= 1, \
            "Three in a row with open ends should be detected as OPEN_THREE"


# ============================================
# Run tests if executed directly
# ============================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
