"""
Property-Based Tests for BasicAnalyzer

**Feature: ai-match-analysis-system, Property 3: Basic Analysis Output Structure**
**Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6**
"""

from hypothesis import given, strategies as st, settings
from analysis.basic_analyzer import BasicAnalyzer
from analysis.types import Move, MoveClassification, BOARD_SIZE
import pytest


@st.composite
def simple_game_moves(draw):
    """Generate a simple game with 1-5 moves"""
    num_moves = draw(st.integers(min_value=1, max_value=5))
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


class TestBasicAnalyzerProps:
    """Property tests for BasicAnalyzer"""
    
    def setup_method(self):
        self.analyzer = BasicAnalyzer()
    
    @given(moves=simple_game_moves())
    @settings(max_examples=20, deadline=None)
    def test_timeline_length_matches_moves(self, moves):
        """**Feature: ai-match-analysis-system, Property 3: Basic Analysis Output Structure**
        Timeline must have exactly N entries for N moves"""
        result = self.analyzer.analyze_game(moves)
        assert len(result.timeline) == len(moves), \
            f"Timeline length {len(result.timeline)} != moves count {len(moves)}"
    
    @given(moves=simple_game_moves())
    @settings(max_examples=20, deadline=None)
    def test_timeline_entries_complete(self, moves):
        """**Feature: ai-match-analysis-system, Property 3: Basic Analysis Output Structure**
        Each timeline entry has required fields"""
        result = self.analyzer.analyze_game(moves)
        
        for i, entry in enumerate(result.timeline):
            assert isinstance(entry.move, int)
            assert entry.move == i + 1
            assert entry.player in ["X", "O"]
            assert isinstance(entry.position, dict)
            assert "x" in entry.position and "y" in entry.position
            assert 0 <= entry.position["x"] < BOARD_SIZE
            assert 0 <= entry.position["y"] < BOARD_SIZE
            assert isinstance(entry.score, (int, float))
            assert isinstance(entry.win_prob, float)
            assert 0 <= entry.win_prob <= 1
            assert isinstance(entry.category, MoveClassification)
            assert isinstance(entry.note, str)
            assert len(entry.note) > 0
    
    @given(moves=simple_game_moves())
    @settings(max_examples=20, deadline=None)
    def test_mistakes_structure(self, moves):
        """**Feature: ai-match-analysis-system, Property 3: Basic Analysis Output Structure**
        Mistakes have valid structure"""
        result = self.analyzer.analyze_game(moves)
        
        for mistake in result.mistakes:
            assert isinstance(mistake.move, int)
            assert 1 <= mistake.move <= len(moves)
            assert mistake.severity in ["minor", "major", "critical"]
            assert isinstance(mistake.desc, str)
            assert len(mistake.desc) > 0
            assert isinstance(mistake.best_alternative, dict)
            assert "x" in mistake.best_alternative
            assert "y" in mistake.best_alternative
            assert 0 <= mistake.best_alternative["x"] < BOARD_SIZE
            assert 0 <= mistake.best_alternative["y"] < BOARD_SIZE
    
    @given(moves=simple_game_moves())
    @settings(max_examples=20, deadline=None)
    def test_patterns_structure(self, moves):
        """**Feature: ai-match-analysis-system, Property 3: Basic Analysis Output Structure**
        Patterns have valid structure"""
        result = self.analyzer.analyze_game(moves)
        
        for pattern in result.patterns:
            assert isinstance(pattern.label, str)
            assert len(pattern.label) > 0
            assert isinstance(pattern.explanation, str)
            assert len(pattern.explanation) > 0
            assert isinstance(pattern.moves, list)
            for move_num in pattern.moves:
                assert isinstance(move_num, int)
                assert 1 <= move_num <= len(moves)
            assert isinstance(pattern.severity, str)
            assert len(pattern.severity) > 0
    
    @given(moves=simple_game_moves())
    @settings(max_examples=20, deadline=None)
    def test_summary_structure(self, moves):
        """**Feature: ai-match-analysis-system, Property 3: Basic Analysis Output Structure**
        Summary has required fields"""
        result = self.analyzer.analyze_game(moves)
        
        assert result.summary.total_moves == len(moves)
        assert result.summary.winner in ["X", "O", None]
        assert isinstance(result.summary.x_stats, dict)
        assert isinstance(result.summary.o_stats, dict)
        assert isinstance(result.summary.key_insights, list)
        
        for stats in [result.summary.x_stats, result.summary.o_stats]:
            assert "total_moves" in stats
            assert "excellent_moves" in stats
            assert "good_moves" in stats
            assert "mistakes" in stats
            assert "critical_mistakes" in stats
            assert "avg_score" in stats
            assert "accuracy" in stats
    
    @given(moves=simple_game_moves())
    @settings(max_examples=20, deadline=None)
    def test_tier_is_basic(self, moves):
        """**Feature: ai-match-analysis-system, Property 3: Basic Analysis Output Structure**
        Analysis tier is 'basic'"""
        result = self.analyzer.analyze_game(moves)
        assert result.tier == "basic"
    
    @given(moves=simple_game_moves())
    @settings(max_examples=20, deadline=None)
    def test_best_move_structure(self, moves):
        """**Feature: ai-match-analysis-system, Property 3: Basic Analysis Output Structure**
        Best move has valid structure when present"""
        result = self.analyzer.analyze_game(moves)
        
        if result.best_move is not None:
            assert 0 <= result.best_move.x < BOARD_SIZE
            assert 0 <= result.best_move.y < BOARD_SIZE
            assert isinstance(result.best_move.score, (int, float))
            assert isinstance(result.best_move.reason, str)
            assert len(result.best_move.reason) > 0
    
    def test_single_move_game(self):
        """**Feature: ai-match-analysis-system, Property 3: Basic Analysis Output Structure**
        Edge case: single move"""
        moves = [Move(x=7, y=7, player="X", move_number=1)]
        result = self.analyzer.analyze_game(moves)
        
        assert len(result.timeline) == 1
        assert result.summary.total_moves == 1
    
    def test_empty_game(self):
        """**Feature: ai-match-analysis-system, Property 3: Basic Analysis Output Structure**
        Edge case: empty game"""
        moves = []
        result = self.analyzer.analyze_game(moves)
        
        assert len(result.timeline) == 0
        assert result.summary.total_moves == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
