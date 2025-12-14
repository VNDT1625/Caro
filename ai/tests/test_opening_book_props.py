"""
Property-based tests for Opening Book and Opening Recognition.

**Feature: ai-match-analysis-system, Property: Opening Recognition**
- Known openings → correctly identified
- Opening analysis returns valid data
- Opening suggestions are valid moves
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.opening_book import (
    OpeningBook, Opening, OpeningMove, OpeningType, OpeningEvaluation,
    identify_opening, get_opening_analysis, suggest_opening_move,
    get_opening_book
)


# Strategies for generating test data
board_size = 15
position_st = st.tuples(st.integers(0, board_size - 1), st.integers(0, board_size - 1))
player_st = st.sampled_from(['X', 'O'])


class TestOpeningIdentificationProperties:
    """Property tests for opening identification."""
    
    def test_all_known_openings_are_identifiable(self):
        """
        **Feature: ai-match-analysis-system, Property: Known openings → correctly identified**
        All openings in the book should be correctly identified when their exact moves are played.
        Note: Some openings may have identical moves (e.g., Renju vs Gomoku variants),
        so we check that the identified opening has matching moves, not necessarily the same name.
        """
        book = OpeningBook()
        
        for opening_key, opening in book.openings.items():
            # Convert opening moves to tuple format
            moves = [(m.x, m.y, m.player) for m in opening.moves]
            
            # Identify the opening
            identified = book.identify_opening(moves)
            
            assert identified is not None, f"Opening '{opening_key}' should be identified"
            
            # Check that the identified opening has the same moves
            # (Some openings may share the same moves but have different names in different rule sets)
            identified_moves = [(m.x, m.y, m.player) for m in identified.moves]
            assert moves[:len(identified_moves)] == identified_moves, \
                f"Opening '{opening_key}' moves should match identified opening moves"
    
    @given(st.sampled_from(list(get_opening_book().openings.keys())))
    @settings(max_examples=30)
    def test_opening_identification_consistency(self, opening_key: str):
        """
        **Feature: ai-match-analysis-system, Property 1: Opening identification consistency**
        Identifying the same opening multiple times should return the same result.
        """
        book = OpeningBook()
        opening = book.openings[opening_key]
        moves = [(m.x, m.y, m.player) for m in opening.moves]
        
        # Identify multiple times
        result1 = book.identify_opening(moves)
        result2 = book.identify_opening(moves)
        result3 = book.identify_opening(moves)
        
        assert result1 is not None
        assert result1.name == result2.name == result3.name
        assert result1.name_en == result2.name_en == result3.name_en
    
    @given(st.lists(st.tuples(position_st, player_st), min_size=0, max_size=2))
    @settings(max_examples=50)
    def test_insufficient_moves_returns_none(self, moves_data: List[Tuple[Tuple[int, int], str]]):
        """
        **Feature: ai-match-analysis-system, Property 2: Insufficient moves handling**
        Less than 3 moves should return None (not enough to identify opening).
        """
        book = OpeningBook()
        moves = [(pos[0], pos[1], player) for pos, player in moves_data]
        
        assume(len(moves) < 3)
        
        result = book.identify_opening(moves)
        assert result is None, "Less than 3 moves should not identify any opening"
    
    @given(st.lists(position_st, min_size=3, max_size=10, unique=True))
    @settings(max_examples=50)
    def test_random_moves_may_not_match_opening(self, positions: List[Tuple[int, int]]):
        """
        **Feature: ai-match-analysis-system, Property 3: Random moves handling**
        Random moves that don't match any opening should return None or a valid opening.
        """
        book = OpeningBook()
        
        # Create alternating X/O moves
        moves = []
        for i, (x, y) in enumerate(positions):
            player = 'X' if i % 2 == 0 else 'O'
            moves.append((x, y, player))
        
        result = book.identify_opening(moves)
        
        # Result should be None or a valid Opening
        if result is not None:
            assert isinstance(result, Opening)
            assert result.name is not None
            assert result.name_en is not None


class TestOpeningAnalysisProperties:
    """Property tests for opening analysis."""
    
    @given(st.sampled_from(list(get_opening_book().openings.keys())))
    @settings(max_examples=30)
    def test_analysis_returns_valid_structure(self, opening_key: str):
        """
        **Feature: ai-match-analysis-system, Property 4: Analysis structure validity**
        Opening analysis should return a valid dictionary structure.
        """
        book = OpeningBook()
        opening = book.openings[opening_key]
        moves = [(m.x, m.y, m.player) for m in opening.moves]
        
        analysis = book.get_opening_analysis(moves)
        
        # Check required keys
        assert "opening" in analysis
        assert "is_known" in analysis
        assert "evaluation" in analysis
        assert "evaluation_score" in analysis
        assert "suggestions" in analysis
        assert "mistakes" in analysis
        assert "description" in analysis
        assert "key_ideas" in analysis
        
        # Check types
        assert analysis["is_known"] is True
        assert isinstance(analysis["evaluation_score"], (int, float))
        assert isinstance(analysis["suggestions"], list)
        assert isinstance(analysis["mistakes"], list)
        assert isinstance(analysis["description"], str)
        assert isinstance(analysis["key_ideas"], list)
    
    @given(st.sampled_from(list(get_opening_book().openings.keys())))
    @settings(max_examples=30)
    def test_analysis_evaluation_in_valid_range(self, opening_key: str):
        """
        **Feature: ai-match-analysis-system, Property 5: Evaluation score range**
        Evaluation score should be in valid range [-100, 100].
        """
        book = OpeningBook()
        opening = book.openings[opening_key]
        moves = [(m.x, m.y, m.player) for m in opening.moves]
        
        analysis = book.get_opening_analysis(moves)
        
        assert -100 <= analysis["evaluation_score"] <= 100, \
            f"Evaluation score {analysis['evaluation_score']} out of range"
    
    @given(st.sampled_from(list(get_opening_book().openings.keys())))
    @settings(max_examples=30)
    def test_analysis_description_not_empty(self, opening_key: str):
        """
        **Feature: ai-match-analysis-system, Property 6: Description not empty**
        Known openings should have non-empty descriptions.
        """
        book = OpeningBook()
        opening = book.openings[opening_key]
        moves = [(m.x, m.y, m.player) for m in opening.moves]
        
        analysis = book.get_opening_analysis(moves)
        
        assert len(analysis["description"]) > 0, "Description should not be empty"
    
    def test_unknown_position_analysis(self):
        """
        **Feature: ai-match-analysis-system, Property 7: Unknown position handling**
        Unknown positions should return is_known=False.
        """
        book = OpeningBook()
        
        # Create a position that doesn't match any opening
        moves = [(0, 0, 'X'), (14, 14, 'O'), (1, 1, 'X')]
        
        analysis = book.get_opening_analysis(moves)
        
        assert analysis["is_known"] is False
        assert analysis["opening"] is None


class TestOpeningSuggestionProperties:
    """Property tests for opening move suggestions."""
    
    def test_first_move_suggestion(self):
        """
        **Feature: ai-match-analysis-system, Property 8: First move suggestion**
        First move for Black should be center (7, 7).
        """
        book = OpeningBook()
        
        suggestion = book.suggest_opening_move([], 'X')
        
        assert suggestion is not None
        assert suggestion["move"] == (7, 7), "First move should be center"
        assert "reason" in suggestion
        assert len(suggestion["reason"]) > 0
    
    def test_second_move_suggestion(self):
        """
        **Feature: ai-match-analysis-system, Property 9: Second move suggestion**
        Second move for White should be near center.
        """
        book = OpeningBook()
        
        moves = [(7, 7, 'X')]
        suggestion = book.suggest_opening_move(moves, 'O')
        
        assert suggestion is not None
        assert suggestion["move"] == (8, 7), "Second move should be adjacent to center"
        assert "reason" in suggestion
    
    @given(st.sampled_from(list(get_opening_book().openings.keys())))
    @settings(max_examples=30)
    def test_suggestion_is_valid_position(self, opening_key: str):
        """
        **Feature: ai-match-analysis-system, Property 10: Suggestion validity**
        Suggested moves should be valid board positions.
        """
        book = OpeningBook()
        opening = book.openings[opening_key]
        
        # Get moves up to second move
        if len(opening.moves) >= 2:
            moves = [(m.x, m.y, m.player) for m in opening.moves[:2]]
            next_player = 'X' if len(moves) % 2 == 0 else 'O'
            
            suggestion = book.suggest_opening_move(moves, next_player)
            
            if suggestion is not None:
                x, y = suggestion["move"]
                assert 0 <= x < 15, f"X coordinate {x} out of bounds"
                assert 0 <= y < 15, f"Y coordinate {y} out of bounds"
                assert "reason" in suggestion
    
    @given(st.sampled_from(list(get_opening_book().openings.keys())))
    @settings(max_examples=30)
    def test_suggestion_not_on_occupied_cell(self, opening_key: str):
        """
        **Feature: ai-match-analysis-system, Property 11: Suggestion not on occupied cell**
        Suggested moves should not be on already occupied cells.
        """
        book = OpeningBook()
        opening = book.openings[opening_key]
        
        if len(opening.moves) >= 2:
            moves = [(m.x, m.y, m.player) for m in opening.moves[:2]]
            occupied = {(m[0], m[1]) for m in moves}
            next_player = 'X' if len(moves) % 2 == 0 else 'O'
            
            suggestion = book.suggest_opening_move(moves, next_player)
            
            if suggestion is not None:
                assert suggestion["move"] not in occupied, \
                    f"Suggested move {suggestion['move']} is on occupied cell"


class TestOpeningBookStatistics:
    """Property tests for opening book statistics."""
    
    def test_statistics_counts_match(self):
        """
        **Feature: ai-match-analysis-system, Property 12: Statistics consistency**
        Statistics should be consistent with actual openings.
        """
        book = OpeningBook()
        stats = book.get_opening_statistics()
        
        # Total should match
        assert stats["total_openings"] == len(book.openings)
        
        # Sum of types should equal total
        type_sum = sum(stats["by_type"].values())
        assert type_sum == stats["total_openings"]
        
        # Sum of evaluations should equal total
        eval_sum = sum(stats["by_evaluation"].values())
        assert eval_sum == stats["total_openings"]
        
        # Sum of recommendations should equal total
        rec_sum = sum(stats["by_recommendation"].values())
        assert rec_sum == stats["total_openings"]
    
    def test_opening_book_has_minimum_openings(self):
        """
        **Feature: ai-match-analysis-system, Property 13: Minimum openings**
        Opening book should have at least 26 Renju openings.
        """
        book = OpeningBook()
        
        renju_direct = len(book.get_openings_by_type(OpeningType.RENJU_DIRECT))
        renju_indirect = len(book.get_openings_by_type(OpeningType.RENJU_INDIRECT))
        
        # Should have at least 26 Renju openings total
        assert renju_direct + renju_indirect >= 26, \
            f"Expected at least 26 Renju openings, got {renju_direct + renju_indirect}"


class TestOpeningDataIntegrity:
    """Property tests for opening data integrity."""
    
    @given(st.sampled_from(list(get_opening_book().openings.keys())))
    @settings(max_examples=30)
    def test_opening_has_required_fields(self, opening_key: str):
        """
        **Feature: ai-match-analysis-system, Property 14: Opening data completeness**
        Each opening should have all required fields populated.
        """
        book = OpeningBook()
        opening = book.openings[opening_key]
        
        # Check required fields
        assert opening.name is not None and len(opening.name) > 0
        assert opening.name_en is not None and len(opening.name_en) > 0
        assert opening.name_jp is not None and len(opening.name_jp) > 0
        assert opening.type is not None
        assert len(opening.moves) >= 3, "Opening should have at least 3 moves"
        assert opening.evaluation is not None
        assert opening.description is not None and len(opening.description) > 0
    
    @given(st.sampled_from(list(get_opening_book().openings.keys())))
    @settings(max_examples=30)
    def test_opening_moves_are_valid(self, opening_key: str):
        """
        **Feature: ai-match-analysis-system, Property 15: Opening moves validity**
        All moves in an opening should be valid board positions.
        """
        book = OpeningBook()
        opening = book.openings[opening_key]
        
        for i, move in enumerate(opening.moves):
            assert 0 <= move.x < 15, f"Move {i+1} x={move.x} out of bounds"
            assert 0 <= move.y < 15, f"Move {i+1} y={move.y} out of bounds"
            assert move.player in ['X', 'O'], f"Move {i+1} has invalid player {move.player}"
    
    @given(st.sampled_from(list(get_opening_book().openings.keys())))
    @settings(max_examples=30)
    def test_opening_moves_alternate_players(self, opening_key: str):
        """
        **Feature: ai-match-analysis-system, Property 16: Alternating players**
        Opening moves should alternate between X and O.
        """
        book = OpeningBook()
        opening = book.openings[opening_key]
        
        for i, move in enumerate(opening.moves):
            expected_player = 'X' if i % 2 == 0 else 'O'
            assert move.player == expected_player, \
                f"Move {i+1} should be {expected_player}, got {move.player}"
    
    @given(st.sampled_from(list(get_opening_book().openings.keys())))
    @settings(max_examples=30)
    def test_opening_first_move_is_center(self, opening_key: str):
        """
        **Feature: ai-match-analysis-system, Property 17: First move at center**
        First move of all openings should be at center (7, 7).
        """
        book = OpeningBook()
        opening = book.openings[opening_key]
        
        first_move = opening.moves[0]
        assert (first_move.x, first_move.y) == (7, 7), \
            f"First move should be (7, 7), got ({first_move.x}, {first_move.y})"


class TestConvenienceFunctions:
    """Tests for module-level convenience functions."""
    
    def test_identify_opening_function(self):
        """Test the module-level identify_opening function."""
        book = OpeningBook()
        
        # Get a known opening
        kansei = book.openings["kansei"]
        moves = [(m.x, m.y, m.player) for m in kansei.moves]
        
        # Use convenience function
        result = identify_opening(moves)
        
        assert result is not None
        assert result.name == kansei.name
    
    def test_get_opening_analysis_function(self):
        """Test the module-level get_opening_analysis function."""
        book = OpeningBook()
        
        kansei = book.openings["kansei"]
        moves = [(m.x, m.y, m.player) for m in kansei.moves]
        
        analysis = get_opening_analysis(moves)
        
        assert analysis["is_known"] is True
        assert analysis["opening"].name == kansei.name
    
    def test_suggest_opening_move_function(self):
        """Test the module-level suggest_opening_move function."""
        suggestion = suggest_opening_move([], 'X')
        
        assert suggestion is not None
        assert suggestion["move"] == (7, 7)
    
    def test_get_opening_book_singleton(self):
        """Test that get_opening_book returns consistent instance."""
        book1 = get_opening_book()
        book2 = get_opening_book()
        
        # Should return same data
        assert len(book1.openings) == len(book2.openings)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
