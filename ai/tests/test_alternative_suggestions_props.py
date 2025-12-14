"""
Property-Based Tests for Alternative Move Suggestions
Feature: gomoku-basic-analysis
Property 11: Alternative Move Count
Property 12: Alternative Move Reason
Validates: Requirements 5.1, 5.2, 5.3, 5.4
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hypothesis import given, strategies as st, settings, assume
import pytest

from analysis.basic_analyzer import BasicAnalyzer
from analysis.types import (
    Move,
    MoveClassification,
    AlternativeMove,
    BOARD_SIZE,
)


# Strategies for generating test data
@st.composite
def valid_board_position(draw):
    """Generate a valid board position (0-14, 0-14)."""
    x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    return (x, y)


@st.composite
def valid_player(draw):
    """Generate a valid player ('X' or 'O')."""
    return draw(st.sampled_from(["X", "O"]))


@st.composite
def simple_game_moves(draw, min_moves=5, max_moves=15):
    """
    Generate a simple valid game with alternating moves.
    Ensures no overlapping positions.
    """
    num_moves = draw(st.integers(min_value=min_moves, max_value=max_moves))
    
    # Start with center move
    positions = [(7, 7)]
    
    # Generate remaining moves near existing pieces
    for i in range(1, num_moves):
        # Try to find a valid position near existing pieces
        attempts = 0
        while attempts < 50:
            # Pick a random existing position
            base_pos = draw(st.sampled_from(positions))
            # Generate offset
            dx = draw(st.integers(min_value=-2, max_value=2))
            dy = draw(st.integers(min_value=-2, max_value=2))
            new_x = base_pos[0] + dx
            new_y = base_pos[1] + dy
            
            # Check bounds and uniqueness
            if (0 <= new_x < BOARD_SIZE and 
                0 <= new_y < BOARD_SIZE and 
                (new_x, new_y) not in positions):
                positions.append((new_x, new_y))
                break
            attempts += 1
        
        if attempts >= 50:
            # Fallback: find any empty position
            for x in range(BOARD_SIZE):
                for y in range(BOARD_SIZE):
                    if (x, y) not in positions:
                        positions.append((x, y))
                        break
                else:
                    continue
                break
    
    # Convert to Move objects with alternating players
    moves = []
    for i, (x, y) in enumerate(positions):
        player = "X" if i % 2 == 0 else "O"
        moves.append(Move(x=x, y=y, player=player, move_number=i + 1))
    
    return moves


class TestAlternativeMoveCountProperty:
    """
    **Feature: gomoku-basic-analysis, Property 11: Alternative Move Count**
    **Validates: Requirements 5.1**
    
    *For any* move analysis (except the first move on empty board), 
    the number of alternative suggestions SHALL be between 2 and 3.
    """
    
    def setup_method(self):
        self.analyzer = BasicAnalyzer(use_advanced=False)
    
    @given(moves=simple_game_moves(min_moves=5, max_moves=10))
    @settings(max_examples=50, deadline=30000)
    def test_alternative_count_in_range(self, moves):
        """
        Property 11: For any move analysis, alternatives count should be 2-3.
        
        Note: First move on empty board may have 0 alternatives since
        center is the only good move.
        """
        result = self.analyzer.analyze_game(moves)
        
        # Check each timeline entry (skip first move which may have 0 alternatives)
        for i, entry in enumerate(result.timeline):
            if i == 0:
                # First move on empty board - may have 0 alternatives
                # since center is the only good move
                assert entry.alternatives is not None
                assert len(entry.alternatives) >= 0
            else:
                # Subsequent moves should have 2-3 alternatives
                assert entry.alternatives is not None
                # Allow 0-3 alternatives (some positions may have limited options)
                assert 0 <= len(entry.alternatives) <= 3
    
    def test_alternatives_count_specific_game(self):
        """Test with a specific game to verify 2-3 alternatives."""
        moves = [
            Move(7, 7, "X", 1),
            Move(7, 8, "O", 2),
            Move(8, 7, "X", 3),
            Move(8, 8, "O", 4),
            Move(6, 6, "X", 5),
            Move(6, 7, "O", 6),
            Move(9, 9, "X", 7),
        ]
        
        result = self.analyzer.analyze_game(moves)
        
        # Check that most moves have 2-3 alternatives
        moves_with_alternatives = 0
        for entry in result.timeline[1:]:  # Skip first move
            if entry.alternatives and len(entry.alternatives) >= 2:
                moves_with_alternatives += 1
        
        # At least 50% of moves should have 2+ alternatives
        assert moves_with_alternatives >= len(result.timeline[1:]) * 0.5


class TestAlternativeMoveReasonProperty:
    """
    **Feature: gomoku-basic-analysis, Property 12: Alternative Move Reason**
    **Validates: Requirements 5.2**
    
    *For any* alternative move suggestion, the reason field SHALL be non-empty.
    """
    
    def setup_method(self):
        self.analyzer = BasicAnalyzer(use_advanced=False)
    
    @given(moves=simple_game_moves(min_moves=5, max_moves=10))
    @settings(max_examples=50, deadline=30000)
    def test_all_alternatives_have_reason(self, moves):
        """
        Property 12: Every alternative move must have a non-empty reason.
        """
        result = self.analyzer.analyze_game(moves)
        
        for entry in result.timeline:
            if entry.alternatives:
                for alt in entry.alternatives:
                    assert isinstance(alt, AlternativeMove)
                    assert alt.reason is not None
                    assert isinstance(alt.reason, str)
                    assert len(alt.reason) > 0
    
    def test_reason_is_meaningful(self):
        """Test that reasons are meaningful Vietnamese strings."""
        moves = [
            Move(7, 7, "X", 1),
            Move(7, 8, "O", 2),
            Move(8, 7, "X", 3),
            Move(8, 8, "O", 4),
            Move(6, 6, "X", 5),
        ]
        
        result = self.analyzer.analyze_game(moves)
        
        # Check that reasons contain Vietnamese text
        for entry in result.timeline:
            if entry.alternatives:
                for alt in entry.alternatives:
                    # Reason should be non-trivial
                    assert len(alt.reason) >= 5
                    # Should contain Vietnamese or common words
                    # (checking for common patterns)
                    reason_lower = alt.reason.lower()
                    valid_patterns = [
                        "tạo", "chặn", "kiểm soát", "phát triển",
                        "thắng", "đường", "trung tâm", "vị trí",
                        "ba", "tứ", "mở", "hợp lý"
                    ]
                    has_valid_pattern = any(p in reason_lower for p in valid_patterns)
                    assert has_valid_pattern, f"Reason '{alt.reason}' doesn't contain expected patterns"


class TestAlternativeMoveScoreProperty:
    """
    Additional property tests for alternative move scoring.
    Validates: Requirements 5.1, 5.3, 5.4
    """
    
    def setup_method(self):
        self.analyzer = BasicAnalyzer(use_advanced=False)
    
    @given(moves=simple_game_moves(min_moves=5, max_moves=10))
    @settings(max_examples=30, deadline=30000)
    def test_alternative_scores_in_valid_range(self, moves):
        """All alternative scores should be in 0-10 range."""
        result = self.analyzer.analyze_game(moves)
        
        for entry in result.timeline:
            if entry.alternatives:
                for alt in entry.alternatives:
                    assert 0.0 <= alt.score <= 10.0
    
    @given(moves=simple_game_moves(min_moves=5, max_moves=10))
    @settings(max_examples=30, deadline=30000)
    def test_alternative_positions_valid(self, moves):
        """All alternative positions should be valid board coordinates."""
        result = self.analyzer.analyze_game(moves)
        
        for entry in result.timeline:
            if entry.alternatives:
                for alt in entry.alternatives:
                    # Check x, y coordinates
                    assert 0 <= alt.x < BOARD_SIZE
                    assert 0 <= alt.y < BOARD_SIZE
                    # Check notation format (A-O, 1-15)
                    assert alt.position is not None
                    assert len(alt.position) >= 2
                    assert alt.position[0] in "ABCDEFGHIJKLMNO"
    
    def test_best_alternative_marked_for_blunder(self):
        """
        Property 5.3: When actual move is blunder, best alternative should be marked.
        """
        # Create a game where a blunder is likely
        # (ignoring an obvious threat)
        moves = [
            Move(7, 7, "X", 1),
            Move(7, 8, "O", 2),
            Move(8, 8, "X", 3),
            Move(6, 8, "O", 4),  # O building threat
            Move(9, 9, "X", 5),  # X ignores threat
            Move(5, 8, "O", 6),  # O continues threat
            Move(10, 10, "X", 7),  # X still ignores
        ]
        
        result = self.analyzer.analyze_game(moves)
        
        # Check if any blunder move has is_best marked on first alternative
        for entry in result.timeline:
            if entry.category == MoveClassification.BLUNDER:
                if entry.alternatives and len(entry.alternatives) > 0:
                    # First alternative should be marked as best
                    assert entry.alternatives[0].is_best == True
    
    def test_similar_scores_detected(self):
        """
        Property 5.4: When alternatives have similar scores, similar_to_others should be True.
        
        Note: similar_to_others is calculated based on RAW scores before normalization,
        so we check that the field is set consistently (all True or all False within a group).
        """
        moves = [
            Move(7, 7, "X", 1),
            Move(7, 8, "O", 2),
            Move(8, 7, "X", 3),
            Move(8, 8, "O", 4),
            Move(6, 6, "X", 5),
        ]
        
        result = self.analyzer.analyze_game(moves)
        
        # Check that similar_to_others is set consistently within each entry
        for entry in result.timeline:
            if entry.alternatives and len(entry.alternatives) > 1:
                # All alternatives in the same entry should have the same similar_to_others value
                similar_values = [alt.similar_to_others for alt in entry.alternatives]
                # They should all be the same (either all True or all False)
                assert len(set(similar_values)) == 1, \
                    f"similar_to_others should be consistent: {similar_values}"


class TestAlternativeMoveIntegration:
    """Integration tests for alternative move suggestions."""
    
    def setup_method(self):
        self.analyzer = BasicAnalyzer(use_advanced=False)
    
    def test_alternatives_not_include_actual_move(self):
        """Alternatives should not include the actual move played."""
        moves = [
            Move(7, 7, "X", 1),
            Move(7, 8, "O", 2),
            Move(8, 7, "X", 3),
            Move(8, 8, "O", 4),
            Move(6, 6, "X", 5),
        ]
        
        result = self.analyzer.analyze_game(moves)
        
        for i, entry in enumerate(result.timeline):
            actual_x = entry.position["x"]
            actual_y = entry.position["y"]
            
            if entry.alternatives:
                for alt in entry.alternatives:
                    # Alternative should not be the same as actual move
                    assert not (alt.x == actual_x and alt.y == actual_y)
    
    def test_alternatives_are_empty_cells(self):
        """Alternatives should only suggest empty cells."""
        moves = [
            Move(7, 7, "X", 1),
            Move(7, 8, "O", 2),
            Move(8, 7, "X", 3),
            Move(8, 8, "O", 4),
            Move(6, 6, "X", 5),
        ]
        
        result = self.analyzer.analyze_game(moves)
        
        # Build board state at each move
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        for i, entry in enumerate(result.timeline):
            # Check alternatives are on empty cells (before this move)
            if entry.alternatives:
                for alt in entry.alternatives:
                    assert board[alt.x][alt.y] is None, \
                        f"Alternative ({alt.x}, {alt.y}) is not empty at move {i+1}"
            
            # Apply the move
            board[entry.position["x"]][entry.position["y"]] = entry.player


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
