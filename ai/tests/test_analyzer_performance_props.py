"""
Property-Based Tests for Analysis Performance

**Feature: ai-match-analysis-system, Property 4: Analysis Performance**
**Validates: Requirements 3.1, 5.2**
"""

import time
from hypothesis import given, strategies as st, settings
from analysis.basic_analyzer import BasicAnalyzer
from analysis.types import Move, BOARD_SIZE
import pytest


@st.composite
def medium_game_moves(draw):
    """Generate a medium game with 10-30 moves"""
    num_moves = draw(st.integers(min_value=10, max_value=30))
    all_positions = [(x, y) for x in range(BOARD_SIZE) for y in range(BOARD_SIZE)]
    positions = draw(st.lists(
        st.sampled_from(all_positions),
        min_size=num_moves,
        max_size=num_moves,
        unique=True
    ))
    
    moves = []
    for i, (x, y) in enumerate(positions):
        player = "X" if i % 2 == 0 else "O"
        moves.append(Move(x=x, y=y, player=player, move_number=i + 1))
    
    return moves


class TestAnalyzerPerformance:
    """Performance property tests for BasicAnalyzer"""
    
    def setup_method(self):
        self.analyzer = BasicAnalyzer()
    
    @given(moves=medium_game_moves())
    @settings(max_examples=10, deadline=None)
    def test_analysis_completes_within_2_seconds(self, moves):
        """**Feature: ai-match-analysis-system, Property 4: Analysis Performance**
        Analysis must complete within 2 seconds for games up to 30 moves
        Validates: Requirement 3.1"""
        start_time = time.time()
        result = self.analyzer.analyze_game(moves)
        duration = time.time() - start_time
        
        assert duration < 2.0, \
            f"Analysis took {duration:.2f}s for {len(moves)} moves, exceeds 2s limit"
        
        # Also check the reported duration
        assert result.duration_ms < 2000, \
            f"Reported duration {result.duration_ms}ms exceeds 2000ms"
    
    def test_small_game_fast(self):
        """**Feature: ai-match-analysis-system, Property 4: Analysis Performance**
        Small games (1-5 moves) should be very fast (<100ms)"""
        moves = [
            Move(x=7, y=7, player="X", move_number=1),
            Move(x=7, y=8, player="O", move_number=2),
            Move(x=8, y=7, player="X", move_number=3),
        ]
        
        start_time = time.time()
        result = self.analyzer.analyze_game(moves)
        duration = time.time() - start_time
        
        assert duration < 0.1, \
            f"Small game analysis took {duration:.2f}s, should be <0.1s"
    
    def test_board_navigation_fast(self):
        """**Feature: ai-match-analysis-system, Property 4: Analysis Performance**
        Board state navigation should complete within 200ms
        Validates: Requirement 5.2"""
        # Create a game with 20 moves
        moves = []
        for i in range(20):
            x = i % BOARD_SIZE
            y = i // BOARD_SIZE
            player = "X" if i % 2 == 0 else "O"
            moves.append(Move(x=x, y=y, player=player, move_number=i + 1))
        
        # Analyze the game
        result = self.analyzer.analyze_game(moves)
        
        # Simulate navigating to different moves by checking timeline access
        start_time = time.time()
        for i in range(len(result.timeline)):
            entry = result.timeline[i]
            # Access all fields to simulate full navigation
            _ = entry.move
            _ = entry.player
            _ = entry.position
            _ = entry.score
            _ = entry.win_prob
        duration = time.time() - start_time
        
        assert duration < 0.2, \
            f"Timeline navigation took {duration:.2f}s, should be <0.2s"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
