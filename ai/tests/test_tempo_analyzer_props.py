"""
Property-Based Tests for TempoAnalyzer

Tests the tempo analysis functionality using Hypothesis for property-based testing.

**Feature: gomoku-basic-analysis, Property 50: Forcing Move Detection**
**Validates: Requirements 19.1**

**Feature: gomoku-basic-analysis, Property 51: Tempo Switch Detection**
**Validates: Requirements 19.3**
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Optional, Tuple

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.tempo_analyzer import (
    TempoAnalyzer,
    TempoAnalysis,
    TempoStatus,
    TempoSwitchPoint,
    analyze_tempo_for_move,
    detect_tempo_switches,
)
from analysis.types import Move, ThreatType, BOARD_SIZE
from analysis.threat_detector import ThreatDetector


# ============================================
# Test Strategies
# ============================================

@st.composite
def valid_position(draw):
    """Generate a valid board position (0-14, 0-14)."""
    x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    return (x, y)


@st.composite
def player_strategy(draw):
    """Generate a valid player."""
    return draw(st.sampled_from(["X", "O"]))


@st.composite
def empty_board(draw):
    """Generate an empty board."""
    return [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]


@st.composite
def board_with_moves(draw, min_moves=0, max_moves=20):
    """Generate a board with some moves played."""
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    num_moves = draw(st.integers(min_value=min_moves, max_value=max_moves))
    
    positions_used = set()
    current_player = "X"
    
    for _ in range(num_moves):
        # Find an empty position
        attempts = 0
        while attempts < 100:
            x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
            y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
            if (x, y) not in positions_used:
                positions_used.add((x, y))
                board[x][y] = current_player
                current_player = "O" if current_player == "X" else "X"
                break
            attempts += 1
    
    return board


@st.composite
def board_with_forcing_threat(draw, player: str = "X"):
    """Generate a board where player has a forcing threat (FOUR or OPEN_FOUR)."""
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    
    # Create a FOUR pattern: XXXX_ (4 in a row with one end open)
    start_row = draw(st.integers(min_value=2, max_value=BOARD_SIZE - 3))
    start_col = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 5))
    
    # Place 4 pieces in a row
    for i in range(4):
        board[start_row][start_col + i] = player
    
    # Leave the 5th position empty (this creates a FOUR)
    # board[start_row][start_col + 4] is already None
    
    return board, (start_row, start_col + 4)  # Return board and the forcing position


@st.composite
def move_sequence(draw, min_moves=5, max_moves=30):
    """Generate a valid sequence of moves."""
    num_moves = draw(st.integers(min_value=min_moves, max_value=max_moves))
    moves = []
    positions_used = set()
    current_player = "X"
    
    for i in range(num_moves):
        attempts = 0
        while attempts < 100:
            x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
            y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
            if (x, y) not in positions_used:
                positions_used.add((x, y))
                moves.append(Move(x=x, y=y, player=current_player, move_number=i + 1))
                current_player = "O" if current_player == "X" else "X"
                break
            attempts += 1
    
    return moves


# ============================================
# Property 50: Forcing Move Detection
# ============================================

class TestForcingMoveDetection:
    """
    **Feature: gomoku-basic-analysis, Property 50: Forcing Move Detection**
    **Validates: Requirements 19.1**
    
    *For any* move that creates immediate threat requiring response,
    the system SHALL mark it as "forcing" with tempo gain indicator.
    """
    
    @given(player=player_strategy())
    @settings(max_examples=50, deadline=None)
    def test_four_pattern_is_forcing(self, player: str):
        """
        **Feature: gomoku-basic-analysis, Property 50: Forcing Move Detection**
        **Validates: Requirements 19.1**
        
        A move that creates a FOUR pattern should be marked as forcing.
        """
        analyzer = TempoAnalyzer()
        
        # Create board with 3 pieces in a row
        board_before = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        row = 7
        for i in range(3):
            board_before[row][5 + i] = player
        
        # Make a move that creates FOUR (4 in a row)
        move_x, move_y = row, 8  # Extends to 4 in a row
        board_after = [r[:] for r in board_before]
        board_after[move_x][move_y] = player
        
        tempo = analyzer.analyze_tempo(
            board_before, board_after, move_x, move_y, player
        )
        
        # A FOUR is a forcing threat - opponent must block
        assert tempo.is_forcing == True, "FOUR pattern should be forcing"
        assert tempo.status == TempoStatus.FORCING
    
    @given(player=player_strategy())
    @settings(max_examples=50, deadline=None)
    def test_open_four_is_forcing(self, player: str):
        """
        **Feature: gomoku-basic-analysis, Property 50: Forcing Move Detection**
        **Validates: Requirements 19.1**
        
        A move that creates an OPEN_FOUR pattern should be marked as forcing.
        """
        analyzer = TempoAnalyzer()
        
        # Create board with 3 pieces in a row with space on both ends
        board_before = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        row = 7
        # _XXX_ pattern at columns 4,5,6 (with 3,7 empty)
        for i in range(3):
            board_before[row][4 + i] = player
        
        # Make a move that creates OPEN_FOUR: _XXXX_
        move_x, move_y = row, 7  # Extends to 4 in a row with both ends open
        board_after = [r[:] for r in board_before]
        board_after[move_x][move_y] = player
        
        tempo = analyzer.analyze_tempo(
            board_before, board_after, move_x, move_y, player
        )
        
        # OPEN_FOUR is definitely forcing
        assert tempo.is_forcing == True, "OPEN_FOUR pattern should be forcing"
        assert tempo.status == TempoStatus.FORCING
    
    @given(player=player_strategy())
    @settings(max_examples=50, deadline=None)
    def test_no_threat_is_not_forcing(self, player: str):
        """
        **Feature: gomoku-basic-analysis, Property 50: Forcing Move Detection**
        **Validates: Requirements 19.1**
        
        A move that creates no immediate threat should not be marked as forcing.
        """
        analyzer = TempoAnalyzer()
        
        # Empty board - first move creates no forcing threat
        board_before = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        move_x, move_y = 7, 7  # Center move
        board_after = [r[:] for r in board_before]
        board_after[move_x][move_y] = player
        
        tempo = analyzer.analyze_tempo(
            board_before, board_after, move_x, move_y, player
        )
        
        # Single piece creates no forcing threat
        assert tempo.is_forcing == False, "Single piece should not be forcing"
        assert tempo.status != TempoStatus.FORCING
    
    @given(player=player_strategy())
    @settings(max_examples=50, deadline=None)
    def test_forcing_move_has_positive_or_zero_tempo_change(self, player: str):
        """
        **Feature: gomoku-basic-analysis, Property 50: Forcing Move Detection**
        **Validates: Requirements 19.1**
        
        A forcing move should have non-negative tempo change.
        """
        analyzer = TempoAnalyzer()
        
        # Create a FOUR pattern
        board_before = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        row = 7
        for i in range(3):
            board_before[row][5 + i] = player
        
        move_x, move_y = row, 8
        board_after = [r[:] for r in board_before]
        board_after[move_x][move_y] = player
        
        tempo = analyzer.analyze_tempo(
            board_before, board_after, move_x, move_y, player,
            previous_initiative="neutral"
        )
        
        # Forcing move should gain or maintain tempo
        assert tempo.tempo_change >= 0, "Forcing move should not lose tempo"


# ============================================
# Property 51: Tempo Switch Detection
# ============================================

class TestTempoSwitchDetection:
    """
    **Feature: gomoku-basic-analysis, Property 51: Tempo Switch Detection**
    **Validates: Requirements 19.3**
    
    *For any* game, the system SHALL correctly identify points where
    initiative changes between players.
    """
    
    @given(moves=move_sequence(min_moves=5, max_moves=15))
    @settings(max_examples=30, deadline=None)
    def test_switch_points_have_valid_players(self, moves: List[Move]):
        """
        **Feature: gomoku-basic-analysis, Property 51: Tempo Switch Detection**
        **Validates: Requirements 19.3**
        
        All switch points should have valid from_player and to_player.
        """
        analyzer = TempoAnalyzer()
        switch_points = analyzer.detect_tempo_switch([], moves)
        
        for sp in switch_points:
            assert sp.from_player in ["X", "O", "neutral"], f"Invalid from_player: {sp.from_player}"
            assert sp.to_player in ["X", "O"], f"Invalid to_player: {sp.to_player}"
            assert sp.from_player != sp.to_player, "Switch should be between different players"
    
    @given(moves=move_sequence(min_moves=5, max_moves=15))
    @settings(max_examples=30, deadline=None)
    def test_switch_points_have_valid_move_numbers(self, moves: List[Move]):
        """
        **Feature: gomoku-basic-analysis, Property 51: Tempo Switch Detection**
        **Validates: Requirements 19.3**
        
        All switch points should have valid move numbers within game range.
        """
        analyzer = TempoAnalyzer()
        switch_points = analyzer.detect_tempo_switch([], moves)
        
        for sp in switch_points:
            assert 1 <= sp.move_number <= len(moves), \
                f"Move number {sp.move_number} out of range [1, {len(moves)}]"
    
    @given(moves=move_sequence(min_moves=5, max_moves=15))
    @settings(max_examples=30, deadline=None)
    def test_switch_points_are_ordered(self, moves: List[Move]):
        """
        **Feature: gomoku-basic-analysis, Property 51: Tempo Switch Detection**
        **Validates: Requirements 19.3**
        
        Switch points should be in chronological order.
        """
        analyzer = TempoAnalyzer()
        switch_points = analyzer.detect_tempo_switch([], moves)
        
        for i in range(1, len(switch_points)):
            assert switch_points[i].move_number > switch_points[i-1].move_number, \
                "Switch points should be in chronological order"
    
    @given(moves=move_sequence(min_moves=5, max_moves=15))
    @settings(max_examples=30, deadline=None)
    def test_switch_points_have_explanations(self, moves: List[Move]):
        """
        **Feature: gomoku-basic-analysis, Property 51: Tempo Switch Detection**
        **Validates: Requirements 19.3**
        
        All switch points should have non-empty explanations.
        """
        analyzer = TempoAnalyzer()
        switch_points = analyzer.detect_tempo_switch([], moves)
        
        for sp in switch_points:
            assert sp.reason, "Switch point should have a reason"
            assert len(sp.reason) > 0, "Reason should not be empty"
            assert sp.reason_vi, "Should have Vietnamese explanation"


# ============================================
# Additional Tempo Analysis Tests
# ============================================

class TestTempoAnalysisProperties:
    """Additional property tests for tempo analysis."""
    
    @given(player=player_strategy())
    @settings(max_examples=50, deadline=None)
    def test_tempo_analysis_has_all_fields(self, player: str):
        """Tempo analysis should have all required fields."""
        analyzer = TempoAnalyzer()
        
        board_before = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board_after = [r[:] for r in board_before]
        board_after[7][7] = player
        
        tempo = analyzer.analyze_tempo(
            board_before, board_after, 7, 7, player
        )
        
        assert isinstance(tempo.is_forcing, bool)
        assert isinstance(tempo.tempo_change, int)
        assert tempo.tempo_change in [-1, 0, 1]
        assert tempo.initiative_holder in ["X", "O", "neutral"]
        assert isinstance(tempo.status, TempoStatus)
        assert tempo.explanation
        assert tempo.explanation_vi
        assert tempo.explanation_en
        assert tempo.explanation_zh
        assert tempo.explanation_ja
    
    @given(player=player_strategy())
    @settings(max_examples=50, deadline=None)
    def test_blocking_open_four_reduces_threat(self, player: str):
        """Blocking an opponent's OPEN_FOUR should reduce their total threat score."""
        analyzer = TempoAnalyzer()
        opponent = "O" if player == "X" else "X"
        
        # Create board where opponent has an OPEN_FOUR: _XXXX_
        # This requires 4 pieces with both ends open
        board_before = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        row = 7
        # Place 4 opponent pieces at columns 4,5,6,7 (with 3 and 8 empty)
        for i in range(4):
            board_before[row][4 + i] = opponent
        
        # Player blocks one end of the OPEN_FOUR
        move_x, move_y = row, 3  # Block the left end
        board_after = [r[:] for r in board_before]
        board_after[move_x][move_y] = player
        
        # Check that opponent's total threat score is reduced after blocking
        threat_detector = ThreatDetector()
        opp_threats_before = threat_detector.detect_all_threats(board_before, opponent)
        opp_threats_after = threat_detector.detect_all_threats(board_after, opponent)
        
        # Total score should be reduced (OPEN_FOUR becomes FOUR or less)
        assert opp_threats_after.total_score <= opp_threats_before.total_score, \
            "Blocking should reduce or maintain opponent's threat score"
    
    @given(moves=move_sequence(min_moves=10, max_moves=20))
    @settings(max_examples=20, deadline=None)
    def test_game_tempo_analysis_completeness(self, moves: List[Move]):
        """Game tempo analysis should return complete results."""
        analyzer = TempoAnalyzer()
        result = analyzer.analyze_game_tempo(moves)
        
        assert "tempo_per_move" in result
        assert "switch_points" in result
        assert "stats" in result
        
        # Should have tempo analysis for each move
        assert len(result["tempo_per_move"]) == len(moves)
        
        # Stats should have all required fields
        stats = result["stats"]
        assert "x_forcing_moves" in stats
        assert "o_forcing_moves" in stats
        assert "x_slow_moves" in stats
        assert "o_slow_moves" in stats
        assert "total_switches" in stats
        
        # All stats should be non-negative
        for key, value in stats.items():
            assert value >= 0, f"Stat {key} should be non-negative"


# ============================================
# Convenience Function Tests
# ============================================

class TestConvenienceFunctions:
    """Test convenience functions."""
    
    @given(player=player_strategy())
    @settings(max_examples=30, deadline=None)
    def test_analyze_tempo_for_move_function(self, player: str):
        """Test the convenience function analyze_tempo_for_move."""
        board_before = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board_after = [r[:] for r in board_before]
        board_after[7][7] = player
        
        tempo = analyze_tempo_for_move(
            board_before, board_after, 7, 7, player
        )
        
        assert isinstance(tempo, TempoAnalysis)
        assert tempo.initiative_holder in ["X", "O", "neutral"]
    
    @given(moves=move_sequence(min_moves=5, max_moves=10))
    @settings(max_examples=20, deadline=None)
    def test_detect_tempo_switches_function(self, moves: List[Move]):
        """Test the convenience function detect_tempo_switches."""
        switch_points = detect_tempo_switches(moves)
        
        assert isinstance(switch_points, list)
        for sp in switch_points:
            assert isinstance(sp, TempoSwitchPoint)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
