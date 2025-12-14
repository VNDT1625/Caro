"""
Property-based tests for God-Tier Analysis modules.

Tests:
1. Bitboard threat detection
2. DBS search
3. God-Tier mistake analyzer
4. Pro Analyzer V2
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from typing import List, Optional, Tuple

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.types import Move, ThreatType, BOARD_SIZE
from analysis.threat_detector import ThreatDetector


# ============================================
# Test Utilities
# ============================================

def create_empty_board(size: int = BOARD_SIZE) -> List[List[Optional[str]]]:
    """Create an empty board."""
    return [[None for _ in range(size)] for _ in range(size)]


def apply_moves(board: List[List[Optional[str]]], moves: List[Tuple[int, int, str]]):
    """Apply moves to board."""
    for x, y, player in moves:
        if 0 <= x < len(board) and 0 <= y < len(board):
            board[x][y] = player


# ============================================
# Bitboard Tests
# ============================================

class TestBitboardThreatDetector:
    """Tests for BitboardThreatDetector."""
    
    @pytest.fixture
    def detector(self):
        """Create bitboard detector."""
        try:
            from analysis.bitboard import BitboardThreatDetector
            return BitboardThreatDetector()
        except ImportError:
            pytest.skip("Bitboard module not available")
    
    def test_empty_board_no_threats(self, detector):
        """Empty board should have no threats."""
        board = create_empty_board()
        detector.set_board(board)
        
        result_x = detector.detect_all_threats("X")
        result_o = detector.detect_all_threats("O")
        
        assert result_x.total_score == 0
        assert result_o.total_score == 0

    def test_five_detection(self, detector):
        """Five in a row should be detected."""
        board = create_empty_board()
        # Create horizontal five
        for y in range(5):
            board[7][y] = "X"
        
        detector.set_board(board)
        result = detector.detect_all_threats("X")
        
        assert result.threats.get(ThreatType.FIVE, 0) >= 1
    
    def test_open_four_detection(self, detector):
        """Open four should be detected."""
        board = create_empty_board()
        # Create _XXXX_ pattern
        for y in range(1, 5):
            board[7][y] = "X"
        
        detector.set_board(board)
        result = detector.detect_all_threats("X")
        
        # Should have OPEN_FOUR or FOUR
        has_four = (
            result.threats.get(ThreatType.OPEN_FOUR, 0) > 0 or
            result.threats.get(ThreatType.FOUR, 0) > 0
        )
        assert has_four
    
    @given(st.lists(
        st.tuples(
            st.integers(0, BOARD_SIZE - 1),
            st.integers(0, BOARD_SIZE - 1),
            st.sampled_from(["X", "O"])
        ),
        min_size=0, max_size=20
    ))
    @settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_threat_score_non_negative(self, detector, moves):
        """Threat scores should always be non-negative."""
        board = create_empty_board()
        
        # Apply moves (skip duplicates)
        seen = set()
        for x, y, player in moves:
            if (x, y) not in seen:
                board[x][y] = player
                seen.add((x, y))
        
        detector.set_board(board)
        
        result_x = detector.detect_all_threats("X")
        result_o = detector.detect_all_threats("O")
        
        assert result_x.total_score >= 0
        assert result_o.total_score >= 0


# ============================================
# DBS Search Tests
# ============================================

class TestDBSSearch:
    """Tests for Dependency-Based Search."""
    
    @pytest.fixture
    def searcher(self):
        """Create DBS searcher."""
        try:
            from analysis.dbs_search import DependencyBasedSearch
            return DependencyBasedSearch(max_depth=20)
        except ImportError:
            pytest.skip("DBS module not available")
    
    def test_immediate_win_detection(self, searcher):
        """Should detect immediate winning position."""
        board = create_empty_board()
        # Create XXXX_ pattern (one move from win)
        for y in range(4):
            board[7][y] = "X"
        
        result = searcher.search(board, "X", "vcf")
        
        # Should find winning move
        assert result.found or result.depth == 0
    
    def test_no_vcf_on_empty_board(self, searcher):
        """Empty board should have no VCF."""
        board = create_empty_board()
        result = searcher.search(board, "X", "vcf")
        
        assert not result.found
    
    def test_vcf_sequence_valid(self, searcher):
        """VCF sequence should be valid moves."""
        board = create_empty_board()
        # Create a position with potential VCF
        board[7][7] = "X"
        board[7][8] = "X"
        board[7][9] = "X"
        board[7][6] = "X"  # XXXX pattern
        
        result = searcher.search(board, "X", "vcf")
        
        if result.found and result.sequence:
            for x, y, player in result.sequence:
                assert 0 <= x < BOARD_SIZE
                assert 0 <= y < BOARD_SIZE
                assert player in ["X", "O"]


# ============================================
# God-Tier Mistake Analyzer Tests
# ============================================

class TestGodTierMistakeAnalyzer:
    """Tests for God-Tier Mistake Analyzer."""
    
    @pytest.fixture
    def analyzer(self):
        """Create mistake analyzer."""
        try:
            from analysis.god_tier_mistake_analyzer import GodTierMistakeAnalyzer
            return GodTierMistakeAnalyzer()
        except ImportError:
            pytest.skip("God-Tier Mistake Analyzer not available")
    
    def test_missed_vcf_detection(self, analyzer):
        """Should detect missed VCF."""
        board = create_empty_board()
        # Create position where X has VCF
        board[7][5] = "X"
        board[7][6] = "X"
        board[7][7] = "X"
        board[7][8] = "X"  # XXXX - can win at (7,4) or (7,9)
        
        # Player plays elsewhere instead
        actual_move = Move(x=0, y=0, player="X", move_number=10)
        best_move = (7, 4)  # Winning move
        
        result = analyzer.analyze_mistake(
            board, actual_move, best_move, {'move_number': 10}
        )
        
        # Should detect critical mistake
        assert result.overall_severity in ["critical", "major"]
    
    def test_no_mistake_on_best_move(self, analyzer):
        """Playing best move should not be a major mistake."""
        board = create_empty_board()
        board[7][7] = "X"
        
        # Play a reasonable move
        actual_move = Move(x=7, y=8, player="X", move_number=2)
        
        result = analyzer.analyze_mistake(
            board, actual_move, (7, 8), {'move_number': 2}
        )
        
        # Score loss should be 0 when playing best move
        assert result.score_loss == 0
    
    def test_recommendations_generated(self, analyzer):
        """Should generate recommendations for mistakes."""
        board = create_empty_board()
        board[7][7] = "X"
        board[7][8] = "X"
        board[7][9] = "X"
        
        actual_move = Move(x=0, y=0, player="X", move_number=5)
        best_move = (7, 10)
        
        result = analyzer.analyze_mistake(
            board, actual_move, best_move, {'move_number': 5}
        )
        
        assert len(result.recommendations) > 0


# ============================================
# Integration Tests
# ============================================

class TestGodTierIntegration:
    """Integration tests for God-Tier modules."""
    
    def test_all_modules_importable(self):
        """All God-Tier modules should be importable."""
        try:
            from analysis.bitboard import BitboardThreatDetector
            from analysis.dbs_search import DependencyBasedSearch
            from analysis.god_tier_mistake_analyzer import GodTierMistakeAnalyzer
            from analysis.pro_analyzer_v2 import ProAnalyzerV2
            assert True
        except ImportError as e:
            pytest.fail(f"Failed to import God-Tier module: {e}")
    
    def test_threat_detector_consistency(self):
        """Bitboard and regular threat detector should give similar results."""
        try:
            from analysis.bitboard import BitboardThreatDetector
            from analysis.threat_detector import ThreatDetector
        except ImportError:
            pytest.skip("Modules not available")
        
        board = create_empty_board()
        # Create some threats
        board[7][7] = "X"
        board[7][8] = "X"
        board[7][9] = "X"
        
        bitboard = BitboardThreatDetector()
        bitboard.set_board(board)
        regular = ThreatDetector()
        
        bb_result = bitboard.detect_all_threats("X")
        reg_result = regular.detect_all_threats(board, "X")
        
        # Both should detect threats
        assert bb_result.total_score > 0
        assert reg_result.total_score > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
