"""
Unit Tests for ThreatDetector Edge Cases

**Feature: gomoku-basic-analysis, Task 1.1: Pattern Detection Accuracy**
**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

This module contains unit tests for edge cases in pattern detection:
- Patterns at board edges
- Patterns at board corners
- Overlapping patterns
- Diagonal patterns near edges
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from typing import List, Optional

from analysis.threat_detector import ThreatDetector
from analysis.types import (
    ThreatType,
    ThreatPosition,
    BOARD_SIZE,
)


class TestPatternDetectionEdgeCases:
    """
    Unit tests for pattern detection at board edges and corners.
    
    **Feature: gomoku-basic-analysis, Task 1.1**
    **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
    """
    
    def setup_method(self):
        """Set up test fixtures."""
        self.detector = ThreatDetector()
    
    def create_empty_board(self) -> List[List[Optional[str]]]:
        """Create an empty 15x15 board."""
        return [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    
    # ============================================
    # FIVE Pattern Tests (Requirement 1.1)
    # ============================================
    
    def test_five_at_top_edge_horizontal(self):
        """
        Test FIVE detection at top edge (row 0) horizontal.
        
        **Validates: Requirement 1.1**
        """
        board = self.create_empty_board()
        # Place 5 X's at top edge: (0,5), (0,6), (0,7), (0,8), (0,9)
        for i in range(5, 10):
            board[0][i] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        assert result.threats[ThreatType.FIVE] >= 1, \
            "FIVE at top edge should be detected"
    
    def test_five_at_bottom_edge_horizontal(self):
        """
        Test FIVE detection at bottom edge (row 14) horizontal.
        
        **Validates: Requirement 1.1**
        """
        board = self.create_empty_board()
        # Place 5 X's at bottom edge
        for i in range(5, 10):
            board[14][i] = "X"
        
        result = self.detector.detect_all_threats(board, "X")
        assert result.threats[ThreatType.FIVE] >= 1, \
            "FIVE at bottom edge should be detected"
    
    def test_five_at_left_edge_vertical(self):
        """
        Test FIVE detection at left edge (col 0) vertical.
        
        **Validates: Requirement 1.1**
        """
        board = self.create_empty_board()
        # Place 5 X's at left edge
        for i in range(5, 10):
            board[i][0] = "X"
        
    