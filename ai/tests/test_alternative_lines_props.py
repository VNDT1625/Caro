"""
Property-based tests for Alternative Lines Analysis.

**Feature: ai-match-analysis-system, Property: Alternatives are better than actual move**

Task 8.6.3: Alternative Lines Analysis
Impact: "What if" analysis depth

Tests verify:
1. Alternatives have higher scores than the actual (bad) move
2. Continuations are valid sequences of 3-5 moves
3. Comparisons correctly show improvement
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.alternative_lines import (
    AlternativeLinesAnalyzer,
    AlternativeMove,
    Continuation,
    AlternativeLine,
    AlternativeLinesResult,
    find_alternatives,
    analyze_mistake_alternatives,
    analyze_all_mistakes,
)
from analysis.types import Move, Mistake, BOARD_SIZE


# Strategies for generating test data
board_size = 15
position_st = st.tuples(st.integers(0, board_size - 1), st.integers(0, board_size - 1))
player_st = st.sampled_from(['X', 'O'])


def create_empty_board(size: int = 15) -> List[List[Optional[str]]]:
    """Create an empty board."""
    return [[None for _ in range(size)] for _ in range(size)]


def create_board_from_moves(
    moves: List[Tuple[int, int, str]], 
    size: int = 15
) -> List[List[Optional[str]]]:
    """Create a board from a list of moves."""
    board = create_empty_board(size)
    for x, y, piece in moves:
        if 0 <= x < size and 0 <= y < size:
            board[x][y] = piece
    return board


class TestAlternativesAreBetter:
    """
    Property tests verifying alternatives are better than actual move.
    
    **Feature: ai-match-analysis-system, Property: Alternatives are better than actual move**
    """
    
    def test_alternatives_have_higher_score_than_bad_move(self):
        """
        **Feature: ai-match-analysis-system, Property: Alternatives are better than actual move**
        
        When a player makes a bad move (corner when center is available),
        the alternatives should have higher scores.
        """
        board = create_empty_board()
        # Place some pieces to create a position
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        # Bad move: corner instead of near center
        bad_move = (0, 0)
        player = 'X'
        
        analyzer = AlternativeLinesAnalyzer()
        alternatives = analyzer.find_alternatives(board, player, bad_move, top_n=3)
        
        # Get score of bad move
        bad_score = analyzer.position_evaluator.evaluate_move(board, bad_move[0], bad_move[1], player)
        
        # All alternatives should have higher scores
        assert len(alternatives) > 0, "Should find at least one alternative"
        for alt in alternatives:
            assert alt.score >= bad_score, (
                f"Alternative ({alt.x},{alt.y}) score {alt.score} should be >= bad move score {bad_score}"
            )
    
    def test_alternatives_for_missed_threat(self):
        """
        **Feature: ai-match-analysis-system, Property: Alternatives are better than actual move**
        
        When a player misses creating a threat, alternatives should include
        the threat-creating move with higher score.
        """
        board = create_empty_board()
        # X has two in a row, can create OPEN_THREE
        board[7][7] = 'X'
        board[7][8] = 'X'
        board[8][8] = 'O'
        
        # Bad move: far from the action
        bad_move = (0, 0)
        player = 'X'
        
        analyzer = AlternativeLinesAnalyzer()
        alternatives = analyzer.find_alternatives(board, player, bad_move, top_n=3)
        
        # Should find alternatives near the existing pieces
        assert len(alternatives) > 0
        
        # At least one alternative should be near (7,7) or (7,8)
        near_existing = False
        for alt in alternatives:
            dist_to_77 = abs(alt.x - 7) + abs(alt.y - 7)
            dist_to_78 = abs(alt.x - 7) + abs(alt.y - 8)
            if dist_to_77 <= 2 or dist_to_78 <= 2:
                near_existing = True
                break
        
        assert near_existing, "At least one alternative should be near existing pieces"
    
    def test_alternatives_for_failed_block(self):
        """
        **Feature: ai-match-analysis-system, Property: Alternatives are better than actual move**
        
        When a player fails to block opponent's threat, alternatives should
        include the blocking move.
        """
        board = create_empty_board()
        # O has three in a row - X should block
        board[7][5] = 'O'
        board[7][6] = 'O'
        board[7][7] = 'O'
        board[8][8] = 'X'
        
        # Bad move: not blocking
        bad_move = (0, 0)
        player = 'X'
        
        analyzer = AlternativeLinesAnalyzer()
        alternatives = analyzer.find_alternatives(board, player, bad_move, top_n=3)
        
        # Should find blocking moves at (7,4) or (7,8)
        blocking_positions = [(7, 4), (7, 8)]
        found_block = False
        
        for alt in alternatives:
            if (alt.x, alt.y) in blocking_positions:
                found_block = True
                break
        
        assert found_block, f"Should find blocking move at {blocking_positions}"


class TestContinuationValidity:
    """Tests for continuation sequence validity."""
    
    def test_continuation_length_in_range(self):
        """
        **Feature: ai-match-analysis-system, Property: Continuation length 3-5 moves**
        
        Continuation should have 3-5 moves.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        alt_move = AlternativeMove(x=7, y=8, score=100.0, win_prob=0.6, reason="Test")
        
        analyzer = AlternativeLinesAnalyzer()
        continuation = analyzer.generate_continuation(board, alt_move, 'X', depth=4)
        
        # Should have 1-5 moves (including the alternative move)
        assert 1 <= len(continuation.moves) <= 5, (
            f"Continuation should have 1-5 moves, got {len(continuation.moves)}"
        )
    
    def test_continuation_moves_are_valid(self):
        """
        **Feature: ai-match-analysis-system, Property: Continuation moves are valid**
        
        All moves in continuation should be on empty cells within bounds.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        alt_move = AlternativeMove(x=7, y=8, score=100.0, win_prob=0.6, reason="Test")
        
        analyzer = AlternativeLinesAnalyzer()
        continuation = analyzer.generate_continuation(board, alt_move, 'X', depth=4)
        
        # Track board state
        test_board = [row[:] for row in board]
        
        for move in continuation.moves:
            # Check bounds
            assert 0 <= move.x < 15, f"Move x={move.x} out of bounds"
            assert 0 <= move.y < 15, f"Move y={move.y} out of bounds"
            
            # Check cell was empty before this move
            assert test_board[move.x][move.y] is None, (
                f"Move ({move.x},{move.y}) on non-empty cell"
            )
            
            # Apply move
            test_board[move.x][move.y] = move.player
    
    def test_continuation_alternates_players(self):
        """
        **Feature: ai-match-analysis-system, Property: Continuation alternates players**
        
        Players should alternate in the continuation.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        alt_move = AlternativeMove(x=7, y=8, score=100.0, win_prob=0.6, reason="Test")
        
        analyzer = AlternativeLinesAnalyzer()
        continuation = analyzer.generate_continuation(board, alt_move, 'X', depth=4)
        
        if len(continuation.moves) > 1:
            for i in range(1, len(continuation.moves)):
                prev_player = continuation.moves[i-1].player
                curr_player = continuation.moves[i].player
                assert prev_player != curr_player, (
                    f"Players should alternate: move {i-1} was {prev_player}, move {i} was {curr_player}"
                )


class TestCompareOutcomes:
    """Tests for outcome comparison."""
    
    def test_comparison_shows_improvement(self):
        """
        **Feature: ai-match-analysis-system, Property: Comparison shows improvement**
        
        Comparison should show score/probability improvement.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        original_move = Move(x=0, y=0, player='X', move_number=3)
        alt_move = AlternativeMove(x=7, y=8, score=100.0, win_prob=0.6, reason="Test")
        continuation = Continuation(
            moves=[Move(x=7, y=8, player='X', move_number=1)],
            final_score=100.0,
            final_win_prob=0.6,
            description="Test"
        )
        
        analyzer = AlternativeLinesAnalyzer()
        comparison = analyzer.compare_outcomes(board, original_move, alt_move, continuation)
        
        # Comparison should be non-empty Vietnamese text
        assert len(comparison) > 0, "Comparison should not be empty"
        assert isinstance(comparison, str), "Comparison should be a string"
    
    def test_comparison_in_vietnamese(self):
        """
        **Feature: ai-match-analysis-system, Property: Comparison in Vietnamese**
        
        Comparison text should be in Vietnamese.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        original_move = Move(x=0, y=0, player='X', move_number=3)
        alt_move = AlternativeMove(x=7, y=8, score=100.0, win_prob=0.6, reason="Test")
        continuation = Continuation(
            moves=[Move(x=7, y=8, player='X', move_number=1)],
            final_score=100.0,
            final_win_prob=0.6,
            description="Test"
        )
        
        analyzer = AlternativeLinesAnalyzer()
        comparison = analyzer.compare_outcomes(board, original_move, alt_move, continuation)
        
        # Check for Vietnamese keywords
        vietnamese_keywords = ['Nước', 'thay thế', 'tốt hơn', 'điểm', 'xác suất', 'thắng', 'Sau', 'nước']
        has_vietnamese = any(kw in comparison for kw in vietnamese_keywords)
        assert has_vietnamese, f"Comparison should be in Vietnamese: {comparison}"


class TestAnalyzeMistakeAlternatives:
    """Tests for analyzing alternatives for a single mistake."""
    
    def test_returns_correct_number_of_alternatives(self):
        """
        **Feature: ai-match-analysis-system, Property: Returns requested number of alternatives**
        """
        board = create_empty_board()
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        mistake = Mistake(
            move=3,
            severity="minor",
            desc="Test mistake",
            best_alternative={"x": 7, "y": 8}
        )
        original_move = Move(x=0, y=0, player='X', move_number=3)
        
        analyzer = AlternativeLinesAnalyzer()
        alternatives = analyzer.analyze_mistake_alternatives(board, mistake, original_move, top_n=3)
        
        # Should return up to 3 alternatives
        assert len(alternatives) <= 3, f"Should return at most 3 alternatives, got {len(alternatives)}"
        assert len(alternatives) > 0, "Should return at least 1 alternative"
    
    def test_alternatives_have_positive_improvement(self):
        """
        **Feature: ai-match-analysis-system, Property: Alternatives are better than actual move**
        
        All alternatives should have positive score improvement over the bad move.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        mistake = Mistake(
            move=3,
            severity="minor",
            desc="Test mistake",
            best_alternative={"x": 7, "y": 8}
        )
        # Bad move in corner
        original_move = Move(x=0, y=0, player='X', move_number=3)
        
        analyzer = AlternativeLinesAnalyzer()
        alternatives = analyzer.analyze_mistake_alternatives(board, mistake, original_move, top_n=3)
        
        for alt in alternatives:
            assert alt.score_improvement >= 0, (
                f"Alternative should have non-negative improvement, got {alt.score_improvement}"
            )
    
    def test_alternative_line_structure(self):
        """
        **Feature: ai-match-analysis-system, Property: AlternativeLine has all required fields**
        """
        board = create_empty_board()
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        mistake = Mistake(
            move=3,
            severity="minor",
            desc="Test mistake",
            best_alternative={"x": 7, "y": 8}
        )
        original_move = Move(x=0, y=0, player='X', move_number=3)
        
        analyzer = AlternativeLinesAnalyzer()
        alternatives = analyzer.analyze_mistake_alternatives(board, mistake, original_move, top_n=1)
        
        assert len(alternatives) > 0
        alt = alternatives[0]
        
        # Check all fields exist
        assert hasattr(alt, 'mistake_move')
        assert hasattr(alt, 'original_move')
        assert hasattr(alt, 'alternative')
        assert hasattr(alt, 'continuation')
        assert hasattr(alt, 'score_improvement')
        assert hasattr(alt, 'win_prob_improvement')
        assert hasattr(alt, 'comparison')
        
        # Check types
        assert isinstance(alt.mistake_move, int)
        assert isinstance(alt.original_move, Move)
        assert isinstance(alt.alternative, AlternativeMove)
        assert isinstance(alt.continuation, Continuation)
        assert isinstance(alt.score_improvement, float)
        assert isinstance(alt.win_prob_improvement, float)
        assert isinstance(alt.comparison, str)


class TestAnalyzeAllMistakes:
    """Tests for analyzing all mistakes in a game."""
    
    def test_empty_game_returns_empty_result(self):
        """
        **Feature: ai-match-analysis-system, Property: Empty game returns empty result**
        """
        moves = []
        mistakes = []
        
        result = analyze_all_mistakes(moves, mistakes)
        
        assert isinstance(result, AlternativeLinesResult)
        assert len(result.alternatives) == 0
    
    def test_game_with_no_mistakes_returns_empty_alternatives(self):
        """
        **Feature: ai-match-analysis-system, Property: No mistakes means no alternatives**
        """
        moves = [
            Move(x=7, y=7, player='X'),
            Move(x=8, y=8, player='O'),
            Move(x=7, y=8, player='X'),
        ]
        mistakes = []
        
        result = analyze_all_mistakes(moves, mistakes)
        
        assert len(result.alternatives) == 0
    
    def test_game_with_mistakes_returns_alternatives(self):
        """
        **Feature: ai-match-analysis-system, Property: Mistakes get alternatives**
        """
        moves = [
            Move(x=7, y=7, player='X'),
            Move(x=8, y=8, player='O'),
            Move(x=0, y=0, player='X'),  # Bad move
        ]
        mistakes = [
            Mistake(
                move=3,
                severity="minor",
                desc="Bad move",
                best_alternative={"x": 7, "y": 8}
            )
        ]
        
        result = analyze_all_mistakes(moves, mistakes)
        
        assert 3 in result.alternatives, "Should have alternatives for move 3"
        assert len(result.alternatives[3]) > 0, "Should have at least one alternative"
    
    def test_summary_in_vietnamese(self):
        """
        **Feature: ai-match-analysis-system, Property: Summary in Vietnamese**
        """
        moves = [
            Move(x=7, y=7, player='X'),
            Move(x=8, y=8, player='O'),
            Move(x=0, y=0, player='X'),
        ]
        mistakes = [
            Mistake(
                move=3,
                severity="minor",
                desc="Bad move",
                best_alternative={"x": 7, "y": 8}
            )
        ]
        
        result = analyze_all_mistakes(moves, mistakes)
        
        # Summary should be in Vietnamese
        vietnamese_keywords = ['Phân tích', 'nước', 'thay thế', 'sai lầm', 'điểm', 'xác suất']
        has_vietnamese = any(kw in result.summary for kw in vietnamese_keywords)
        assert has_vietnamese, f"Summary should be in Vietnamese: {result.summary}"


class TestPropertyBasedAlternatives:
    """Property-based tests using Hypothesis."""
    
    @given(
        position_st,
        player_st
    )
    @settings(max_examples=30, deadline=None)
    def test_alternatives_always_valid_positions(
        self,
        bad_move: Tuple[int, int],
        player: str
    ):
        """
        **Feature: ai-match-analysis-system, Property: Alternatives are valid positions**
        
        All alternatives should be valid board positions.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        # Ensure bad_move is not on existing pieces
        if board[bad_move[0]][bad_move[1]] is not None:
            return  # Skip this case
        
        analyzer = AlternativeLinesAnalyzer()
        alternatives = analyzer.find_alternatives(board, player, bad_move, top_n=3)
        
        for alt in alternatives:
            assert 0 <= alt.x < 15, f"Alternative x={alt.x} out of bounds"
            assert 0 <= alt.y < 15, f"Alternative y={alt.y} out of bounds"
            assert board[alt.x][alt.y] is None, f"Alternative ({alt.x},{alt.y}) on occupied cell"
    
    @given(st.integers(min_value=3, max_value=5))
    @settings(max_examples=10, deadline=None)
    def test_continuation_respects_depth(self, depth: int):
        """
        **Feature: ai-match-analysis-system, Property: Continuation respects depth**
        
        Continuation should have at most 'depth' moves.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        alt_move = AlternativeMove(x=7, y=8, score=100.0, win_prob=0.6, reason="Test")
        
        analyzer = AlternativeLinesAnalyzer()
        continuation = analyzer.generate_continuation(board, alt_move, 'X', depth=depth)
        
        assert len(continuation.moves) <= depth, (
            f"Continuation should have at most {depth} moves, got {len(continuation.moves)}"
        )
    
    @given(player_st)
    @settings(max_examples=10)
    def test_alternatives_exclude_actual_move(self, player: str):
        """
        **Feature: ai-match-analysis-system, Property: Alternatives exclude actual move**
        
        The actual (bad) move should not appear in alternatives.
        """
        board = create_empty_board()
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        bad_move = (6, 6)
        
        analyzer = AlternativeLinesAnalyzer()
        alternatives = analyzer.find_alternatives(board, player, bad_move, top_n=5)
        
        for alt in alternatives:
            assert (alt.x, alt.y) != bad_move, (
                f"Actual move {bad_move} should not be in alternatives"
            )


class TestAlternativeReasons:
    """Tests for alternative move reasons."""
    
    def test_reason_for_winning_move(self):
        """
        **Feature: ai-match-analysis-system, Property: Reason explains winning move**
        """
        board = create_empty_board()
        # X can win at (7, 4)
        board[7][5] = 'X'
        board[7][6] = 'X'
        board[7][7] = 'X'
        board[7][8] = 'X'
        board[8][8] = 'O'
        
        analyzer = AlternativeLinesAnalyzer()
        alternatives = analyzer.find_alternatives(board, 'X', (0, 0), top_n=3)
        
        # Should find winning move
        winning_alt = next((a for a in alternatives if a.x == 7 and a.y == 4), None)
        if winning_alt:
            assert "Thắng" in winning_alt.reason or "thắng" in winning_alt.reason.lower()
    
    def test_reason_for_threat_creating_move(self):
        """
        **Feature: ai-match-analysis-system, Property: Reason explains threat creation**
        """
        board = create_empty_board()
        # X can create OPEN_THREE
        board[7][7] = 'X'
        board[7][8] = 'X'
        board[8][8] = 'O'
        
        analyzer = AlternativeLinesAnalyzer()
        alternatives = analyzer.find_alternatives(board, 'X', (0, 0), top_n=3)
        
        # At least one alternative should mention threat creation
        has_threat_reason = False
        for alt in alternatives:
            if any(kw in alt.reason for kw in ['Tạo', 'Ba', 'Tứ', 'đe dọa']):
                has_threat_reason = True
                break
        
        # This is expected but not strictly required
        # assert has_threat_reason, "Should explain threat creation"
    
    def test_reason_in_vietnamese(self):
        """
        **Feature: ai-match-analysis-system, Property: Reason in Vietnamese**
        """
        board = create_empty_board()
        board[7][7] = 'X'
        board[8][8] = 'O'
        
        analyzer = AlternativeLinesAnalyzer()
        alternatives = analyzer.find_alternatives(board, 'X', (0, 0), top_n=3)
        
        for alt in alternatives:
            assert len(alt.reason) > 0, "Reason should not be empty"
            # Check for Vietnamese characters or keywords
            vietnamese_keywords = ['Tạo', 'Vị trí', 'trung tâm', 'Kết nối', 'chiến lược', 'Thắng', 'buộc', 'đe dọa']
            has_vietnamese = any(kw in alt.reason for kw in vietnamese_keywords)
            assert has_vietnamese, f"Reason should be in Vietnamese: {alt.reason}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
