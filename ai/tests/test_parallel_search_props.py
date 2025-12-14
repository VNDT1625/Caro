"""
Property-Based Tests for Parallel Search (Task 8.7.2)

These tests verify that parallel search produces the same results as
sequential search, ensuring correctness of the parallelization.

**Feature: ai-match-analysis-system, Property: Parallel Results = Sequential Results**
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.parallel_search import (
    ParallelSearch,
    ParallelSearchConfig,
    ParallelSearchWorker,
    SequentialSearch,
    SearchResult,
    compare_search_results,
    _create_board_copy,
)
from analysis.types import BOARD_SIZE


# =============================================================================
# Test Helpers
# =============================================================================

def create_empty_board(size: int = BOARD_SIZE) -> List[List[Optional[str]]]:
    """Create an empty board."""
    return [[None for _ in range(size)] for _ in range(size)]


def apply_moves(
    board: List[List[Optional[str]]],
    moves: List[Tuple[int, int, str]]
) -> List[List[Optional[str]]]:
    """Apply a list of moves to a board."""
    for x, y, player in moves:
        if 0 <= x < len(board) and 0 <= y < len(board[0]):
            board[x][y] = player
    return board


def is_valid_board(board: List[List[Optional[str]]]) -> bool:
    """Check if board state is valid (no overlapping pieces)."""
    for row in board:
        for cell in row:
            if cell not in [None, 'X', 'O']:
                return False
    return True


# =============================================================================
# Hypothesis Strategies
# =============================================================================

@st.composite
def board_with_moves(draw, min_moves: int = 2, max_moves: int = 10):
    """
    Generate a board with a sequence of valid moves.
    
    Ensures alternating players and no overlapping moves.
    """
    board = create_empty_board()
    num_moves = draw(st.integers(min_value=min_moves, max_value=max_moves))
    
    moves = []
    used_positions = set()
    
    for i in range(num_moves):
        player = 'X' if i % 2 == 0 else 'O'
        
        # Find available positions
        available = [
            (x, y) for x in range(BOARD_SIZE) for y in range(BOARD_SIZE)
            if (x, y) not in used_positions
        ]
        
        if not available:
            break
        
        # Prefer positions near center or existing pieces
        if moves:
            # Near existing pieces
            near_existing = []
            for px, py, _ in moves:
                for dx in range(-2, 3):
                    for dy in range(-2, 3):
                        nx, ny = px + dx, py + dy
                        if (0 <= nx < BOARD_SIZE and 0 <= ny < BOARD_SIZE and
                            (nx, ny) not in used_positions):
                            near_existing.append((nx, ny))
            if near_existing:
                available = list(set(near_existing))
        
        pos = draw(st.sampled_from(available))
        x, y = pos
        
        board[x][y] = player
        used_positions.add((x, y))
        moves.append((x, y, player))
    
    return board, moves


@st.composite
def simple_board_position(draw):
    """Generate a simple board position for testing."""
    board = create_empty_board()
    
    # Place a few pieces near center
    center = BOARD_SIZE // 2
    num_pieces = draw(st.integers(min_value=2, max_value=6))
    
    used = set()
    for i in range(num_pieces):
        player = 'X' if i % 2 == 0 else 'O'
        
        # Random position near center
        x = draw(st.integers(min_value=center-3, max_value=center+3))
        y = draw(st.integers(min_value=center-3, max_value=center+3))
        
        if (x, y) not in used:
            board[x][y] = player
            used.add((x, y))
    
    # Determine next player
    x_count = sum(1 for row in board for cell in row if cell == 'X')
    o_count = sum(1 for row in board for cell in row if cell == 'O')
    next_player = 'O' if x_count > o_count else 'X'
    
    return board, next_player


# =============================================================================
# Property Tests
# =============================================================================

class TestParallelSearchProperties:
    """
    Property-based tests for parallel search correctness.
    
    **Feature: ai-match-analysis-system, Property: Parallel Results = Sequential Results**
    """
    
    @given(data=simple_board_position())
    @settings(max_examples=20, deadline=30000)  # 30 second deadline for parallel tests
    def test_parallel_equals_sequential_depth_2(self, data):
        """
        **Feature: ai-match-analysis-system, Property: Parallel Results = Sequential Results**
        
        For any valid board position, parallel search at depth 2 should
        produce the same best move as sequential search.
        """
        board, player = data
        
        # Skip if board is empty or nearly empty
        piece_count = sum(1 for row in board for cell in row if cell is not None)
        assume(piece_count >= 2)
        
        # Create searchers
        parallel = ParallelSearch(config=ParallelSearchConfig(num_workers=2))
        sequential = SequentialSearch()
        
        # Run both searches
        parallel_results = parallel.find_best_moves_parallel(
            _create_board_copy(board), player, depth=2, top_n=3
        )
        sequential_results = sequential.find_best_moves(
            _create_board_copy(board), player, depth=2, top_n=3
        )
        
        # Both should return results
        assert len(parallel_results) > 0, "Parallel search should return results"
        assert len(sequential_results) > 0, "Sequential search should return results"
        
        # Best move should be the same
        assert parallel_results[0][0] == sequential_results[0][0], \
            f"Best move X should match: parallel={parallel_results[0][0]}, sequential={sequential_results[0][0]}"
        assert parallel_results[0][1] == sequential_results[0][1], \
            f"Best move Y should match: parallel={parallel_results[0][1]}, sequential={sequential_results[0][1]}"
    
    @given(data=simple_board_position())
    @settings(max_examples=15, deadline=60000)  # 60 second deadline
    def test_parallel_equals_sequential_depth_4(self, data):
        """
        **Feature: ai-match-analysis-system, Property: Parallel Results = Sequential Results**
        
        For any valid board position, parallel search at depth 4 should
        produce the same best move as sequential search.
        """
        board, player = data
        
        piece_count = sum(1 for row in board for cell in row if cell is not None)
        assume(piece_count >= 2)
        
        parallel = ParallelSearch(config=ParallelSearchConfig(num_workers=2))
        sequential = SequentialSearch()
        
        parallel_results = parallel.find_best_moves_parallel(
            _create_board_copy(board), player, depth=4, top_n=3
        )
        sequential_results = sequential.find_best_moves(
            _create_board_copy(board), player, depth=4, top_n=3
        )
        
        assert len(parallel_results) > 0
        assert len(sequential_results) > 0
        
        # Best move should match
        assert parallel_results[0][0] == sequential_results[0][0]
        assert parallel_results[0][1] == sequential_results[0][1]
    
    @given(data=simple_board_position())
    @settings(max_examples=20, deadline=30000)
    def test_parallel_scores_match_sequential(self, data):
        """
        **Feature: ai-match-analysis-system, Property: Parallel Results = Sequential Results**
        
        Scores from parallel search should match sequential search
        within a small tolerance.
        """
        board, player = data
        
        piece_count = sum(1 for row in board for cell in row if cell is not None)
        assume(piece_count >= 2)
        
        parallel = ParallelSearch(config=ParallelSearchConfig(num_workers=2))
        sequential = SequentialSearch()
        
        parallel_results = parallel.find_best_moves_parallel(
            _create_board_copy(board), player, depth=2, top_n=3
        )
        sequential_results = sequential.find_best_moves(
            _create_board_copy(board), player, depth=2, top_n=3
        )
        
        # Compare scores using the comparison function
        assert compare_search_results(parallel_results, sequential_results, tolerance=0.01), \
            f"Results should match: parallel={parallel_results}, sequential={sequential_results}"
    
    @given(data=board_with_moves(min_moves=4, max_moves=8))
    @settings(max_examples=15, deadline=30000)
    def test_parallel_with_game_positions(self, data):
        """
        **Feature: ai-match-analysis-system, Property: Parallel Results = Sequential Results**
        
        For positions from actual game sequences, parallel and sequential
        search should produce the same results.
        """
        board, moves = data
        
        # Determine next player
        next_player = 'O' if len(moves) % 2 == 1 else 'X'
        
        parallel = ParallelSearch(config=ParallelSearchConfig(num_workers=2))
        sequential = SequentialSearch()
        
        parallel_results = parallel.find_best_moves_parallel(
            _create_board_copy(board), next_player, depth=2, top_n=3
        )
        sequential_results = sequential.find_best_moves(
            _create_board_copy(board), next_player, depth=2, top_n=3
        )
        
        assert len(parallel_results) > 0
        assert len(sequential_results) > 0
        
        # Best move should match
        assert parallel_results[0][0] == sequential_results[0][0]
        assert parallel_results[0][1] == sequential_results[0][1]


class TestParallelSearchWorker:
    """Tests for the parallel search worker."""
    
    @given(data=simple_board_position())
    @settings(max_examples=20, deadline=10000)
    def test_worker_produces_valid_results(self, data):
        """
        **Feature: ai-match-analysis-system, Property: Worker Validity**
        
        Each worker should produce valid search results with
        coordinates within board bounds.
        """
        board, player = data
        
        piece_count = sum(1 for row in board for cell in row if cell is not None)
        assume(piece_count >= 2)
        
        worker = ParallelSearchWorker()
        
        # Find a valid empty cell
        empty_cells = [
            (x, y) for x in range(BOARD_SIZE) for y in range(BOARD_SIZE)
            if board[x][y] is None
        ]
        assume(len(empty_cells) > 0)
        
        x, y = empty_cells[0]
        
        result = worker.evaluate_move_with_search(
            _create_board_copy(board), x, y, player, depth=2,
            alpha=float('-inf'), beta=float('inf')
        )
        
        # Result should be valid
        assert isinstance(result, SearchResult)
        assert result.x == x
        assert result.y == y
        assert isinstance(result.score, (int, float))
        assert result.nodes_searched >= 1
    
    @given(data=simple_board_position())
    @settings(max_examples=20, deadline=10000)
    def test_worker_deterministic(self, data):
        """
        **Feature: ai-match-analysis-system, Property: Worker Determinism**
        
        Running the same search twice should produce the same result.
        """
        board, player = data
        
        piece_count = sum(1 for row in board for cell in row if cell is not None)
        assume(piece_count >= 2)
        
        worker = ParallelSearchWorker()
        
        empty_cells = [
            (x, y) for x in range(BOARD_SIZE) for y in range(BOARD_SIZE)
            if board[x][y] is None
        ]
        assume(len(empty_cells) > 0)
        
        x, y = empty_cells[0]
        
        result1 = worker.evaluate_move_with_search(
            _create_board_copy(board), x, y, player, depth=2,
            alpha=float('-inf'), beta=float('inf')
        )
        result2 = worker.evaluate_move_with_search(
            _create_board_copy(board), x, y, player, depth=2,
            alpha=float('-inf'), beta=float('inf')
        )
        
        assert result1.score == result2.score, \
            f"Same search should produce same score: {result1.score} vs {result2.score}"


class TestBoardCopy:
    """Tests for board copy functionality."""
    
    @given(data=simple_board_position())
    @settings(max_examples=30, deadline=5000)
    def test_board_copy_independence(self, data):
        """
        **Feature: ai-match-analysis-system, Property: Board Copy Independence**
        
        Modifying a board copy should not affect the original.
        """
        board, _ = data
        
        # Create copy
        board_copy = _create_board_copy(board)
        
        # Modify copy
        center = BOARD_SIZE // 2
        if board_copy[center][center] is None:
            board_copy[center][center] = 'X'
        else:
            board_copy[center][center] = None
        
        # Original should be unchanged
        assert board[center][center] != board_copy[center][center], \
            "Modifying copy should not affect original"
    
    @given(data=simple_board_position())
    @settings(max_examples=30, deadline=5000)
    def test_board_copy_equality(self, data):
        """
        **Feature: ai-match-analysis-system, Property: Board Copy Equality**
        
        A board copy should initially be equal to the original.
        """
        board, _ = data
        
        board_copy = _create_board_copy(board)
        
        for x in range(BOARD_SIZE):
            for y in range(BOARD_SIZE):
                assert board[x][y] == board_copy[x][y], \
                    f"Copy should equal original at ({x}, {y})"


class TestCompareSearchResults:
    """Tests for the result comparison function."""
    
    def test_identical_results_match(self):
        """Identical results should compare as equal."""
        results = [(7, 7, 100.0), (7, 8, 90.0), (8, 7, 85.0)]
        assert compare_search_results(results, results, tolerance=0.01)
    
    def test_different_moves_dont_match(self):
        """Results with different moves should not match."""
        results1 = [(7, 7, 100.0), (7, 8, 90.0)]
        results2 = [(7, 8, 100.0), (7, 7, 90.0)]
        assert not compare_search_results(results1, results2, tolerance=0.01)
    
    def test_scores_within_tolerance_match(self):
        """Results with scores within tolerance should match."""
        results1 = [(7, 7, 100.0), (7, 8, 90.0)]
        results2 = [(7, 7, 100.5), (7, 8, 89.5)]
        assert compare_search_results(results1, results2, tolerance=0.01)
    
    def test_scores_outside_tolerance_dont_match(self):
        """Results with scores outside tolerance should not match."""
        results1 = [(7, 7, 100.0)]
        results2 = [(7, 7, 110.0)]
        assert not compare_search_results(results1, results2, tolerance=0.01)
    
    def test_different_lengths_dont_match(self):
        """Results with different lengths should not match."""
        results1 = [(7, 7, 100.0), (7, 8, 90.0)]
        results2 = [(7, 7, 100.0)]
        assert not compare_search_results(results1, results2, tolerance=0.01)


# =============================================================================
# Integration Tests
# =============================================================================

class TestParallelSearchIntegration:
    """Integration tests for parallel search."""
    
    def test_empty_board_center_move(self):
        """On empty board, both searches should suggest center."""
        board = create_empty_board()
        
        parallel = ParallelSearch(config=ParallelSearchConfig(num_workers=2))
        sequential = SequentialSearch()
        
        parallel_results = parallel.find_best_moves_parallel(board, 'X', depth=2)
        sequential_results = sequential.find_best_moves(board, 'X', depth=2)
        
        center = BOARD_SIZE // 2
        
        # Both should suggest center
        assert parallel_results[0][0] == center
        assert parallel_results[0][1] == center
        assert sequential_results[0][0] == center
        assert sequential_results[0][1] == center
    
    def test_winning_move_detection(self):
        """Both searches should find winning moves."""
        board = create_empty_board()
        
        # Set up a position where X can win
        # X X X X _ (horizontal four)
        board[7][3] = 'X'
        board[7][4] = 'X'
        board[7][5] = 'X'
        board[7][6] = 'X'
        # Add some O pieces
        board[8][3] = 'O'
        board[8][4] = 'O'
        board[8][5] = 'O'
        
        parallel = ParallelSearch(config=ParallelSearchConfig(num_workers=2))
        sequential = SequentialSearch()
        
        parallel_results = parallel.find_best_moves_parallel(board, 'X', depth=2)
        sequential_results = sequential.find_best_moves(board, 'X', depth=2)
        
        # Both should find the winning move at (7, 7) or (7, 2)
        winning_moves = {(7, 7), (7, 2)}
        
        parallel_best = (parallel_results[0][0], parallel_results[0][1])
        sequential_best = (sequential_results[0][0], sequential_results[0][1])
        
        assert parallel_best in winning_moves, f"Parallel should find winning move, got {parallel_best}"
        assert sequential_best in winning_moves, f"Sequential should find winning move, got {sequential_best}"
        assert parallel_best == sequential_best, "Both should find same winning move"
    
    def test_blocking_move_detection(self):
        """Both searches should find blocking moves."""
        board = create_empty_board()
        
        # Set up a position where O must block X's four
        # X X X X _ (X has open four)
        board[7][3] = 'X'
        board[7][4] = 'X'
        board[7][5] = 'X'
        board[7][6] = 'X'
        # O's turn
        board[8][3] = 'O'
        board[8][4] = 'O'
        board[8][5] = 'O'
        
        parallel = ParallelSearch(config=ParallelSearchConfig(num_workers=2))
        sequential = SequentialSearch()
        
        parallel_results = parallel.find_best_moves_parallel(board, 'O', depth=2)
        sequential_results = sequential.find_best_moves(board, 'O', depth=2)
        
        # Both should find blocking moves at (7, 7) or (7, 2)
        blocking_moves = {(7, 7), (7, 2)}
        
        parallel_best = (parallel_results[0][0], parallel_results[0][1])
        sequential_best = (sequential_results[0][0], sequential_results[0][1])
        
        assert parallel_best in blocking_moves, f"Parallel should find blocking move, got {parallel_best}"
        assert sequential_best in blocking_moves, f"Sequential should find blocking move, got {sequential_best}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
