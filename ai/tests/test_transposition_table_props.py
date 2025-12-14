"""
Property-based tests for Transposition Table with Zobrist Hashing.

**Feature: ai-match-analysis-system, Property: Zobrist Hashing Consistency**
- Same position → same hash
- Different position → different hash (with high probability)
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.transposition_table import (
    ZobristHasher, TranspositionTable, EntryType, TTEntry,
    get_transposition_table, reset_transposition_table
)


# Strategies for generating test data
board_size = 15
position_st = st.tuples(st.integers(0, board_size - 1), st.integers(0, board_size - 1))
piece_st = st.sampled_from(['X', 'O'])
player_st = st.sampled_from(['X', 'O'])


def create_empty_board(size: int = 15) -> List[List[str]]:
    """Create an empty board."""
    return [[None for _ in range(size)] for _ in range(size)]


def create_board_from_moves(moves: List[Tuple[int, int, str]], size: int = 15) -> List[List[str]]:
    """Create a board from a list of moves."""
    board = create_empty_board(size)
    for x, y, piece in moves:
        if 0 <= x < size and 0 <= y < size:
            board[x][y] = piece
    return board


class TestZobristHasherProperties:
    """Property tests for Zobrist hashing."""
    
    @given(st.integers(min_value=0, max_value=100))
    @settings(max_examples=50)
    def test_same_seed_produces_same_hasher(self, seed: int):
        """
        **Feature: ai-match-analysis-system, Property: Zobrist Determinism**
        Same seed should produce identical hash tables.
        """
        hasher1 = ZobristHasher(board_size=15, seed=seed)
        hasher2 = ZobristHasher(board_size=15, seed=seed)
        
        # Check that hash keys are identical
        for x in range(15):
            for y in range(15):
                for piece in ['X', 'O']:
                    assert hasher1.get_hash_key(x, y, piece) == hasher2.get_hash_key(x, y, piece)
    
    @given(st.lists(st.tuples(position_st, piece_st), min_size=0, max_size=20))
    @settings(max_examples=100)
    def test_same_position_same_hash(self, moves_data: List[Tuple[Tuple[int, int], str]]):
        """
        **Feature: ai-match-analysis-system, Property 1: Same position → same hash**
        The same board position should always produce the same hash.
        """
        hasher = ZobristHasher(board_size=15, seed=42)
        
        # Convert moves to unique positions (no duplicates)
        seen_positions = set()
        moves = []
        for (x, y), piece in moves_data:
            if (x, y) not in seen_positions:
                seen_positions.add((x, y))
                moves.append((x, y, piece))
        
        board = create_board_from_moves(moves)
        
        # Compute hash twice
        hash1 = hasher.compute_hash(board, 'X')
        hash2 = hasher.compute_hash(board, 'X')
        
        assert hash1 == hash2, "Same position should produce same hash"
    
    @given(
        st.lists(st.tuples(position_st, piece_st), min_size=1, max_size=10),
        position_st,
        piece_st
    )
    @settings(max_examples=100)
    def test_different_position_different_hash(
        self, 
        moves_data: List[Tuple[Tuple[int, int], str]],
        extra_pos: Tuple[int, int],
        extra_piece: str
    ):
        """
        **Feature: ai-match-analysis-system, Property 2: Different position → different hash**
        Adding a piece should change the hash.
        """
        hasher = ZobristHasher(board_size=15, seed=42)
        
        # Create unique moves
        seen_positions = set()
        moves = []
        for (x, y), piece in moves_data:
            if (x, y) not in seen_positions:
                seen_positions.add((x, y))
                moves.append((x, y, piece))
        
        # Ensure extra position is not already used
        assume(extra_pos not in seen_positions)
        
        board1 = create_board_from_moves(moves)
        board2 = create_board_from_moves(moves + [(extra_pos[0], extra_pos[1], extra_piece)])
        
        hash1 = hasher.compute_hash(board1, 'X')
        hash2 = hasher.compute_hash(board2, 'X')
        
        assert hash1 != hash2, "Different positions should produce different hashes"
    
    @given(
        st.lists(st.tuples(position_st, piece_st), min_size=1, max_size=10),
        position_st,
        piece_st
    )
    @settings(max_examples=100)
    def test_incremental_hash_equals_full_hash(
        self,
        moves_data: List[Tuple[Tuple[int, int], str]],
        new_pos: Tuple[int, int],
        new_piece: str
    ):
        """
        **Feature: ai-match-analysis-system, Property 3: Incremental hash consistency**
        Incrementally updating hash should equal computing full hash.
        """
        hasher = ZobristHasher(board_size=15, seed=42)
        
        # Create unique moves
        seen_positions = set()
        moves = []
        for (x, y), piece in moves_data:
            if (x, y) not in seen_positions:
                seen_positions.add((x, y))
                moves.append((x, y, piece))
        
        # Ensure new position is not already used
        assume(new_pos not in seen_positions)
        
        board = create_board_from_moves(moves)
        initial_hash = hasher.compute_hash(board, 'X')
        
        # Add piece incrementally
        incremental_hash = hasher.update_hash(initial_hash, new_pos[0], new_pos[1], new_piece)
        
        # Compute full hash with new piece
        board[new_pos[0]][new_pos[1]] = new_piece
        full_hash = hasher.compute_hash(board, 'X')
        
        assert incremental_hash == full_hash, "Incremental hash should equal full hash"
    
    @given(player_st)
    @settings(max_examples=10)
    def test_side_to_move_affects_hash(self, player: str):
        """
        **Feature: ai-match-analysis-system, Property 4: Side to move in hash**
        Different side to move should produce different hash.
        """
        hasher = ZobristHasher(board_size=15, seed=42)
        board = create_empty_board()
        
        hash_x = hasher.compute_hash(board, 'X')
        hash_o = hasher.compute_hash(board, 'O')
        
        assert hash_x != hash_o, "Different side to move should produce different hash"
    
    @given(st.lists(st.tuples(position_st, piece_st), min_size=1, max_size=5))
    @settings(max_examples=50)
    def test_xor_reversibility(self, moves_data: List[Tuple[Tuple[int, int], str]]):
        """
        **Feature: ai-match-analysis-system, Property 5: XOR reversibility**
        Adding then removing a piece should restore original hash.
        """
        hasher = ZobristHasher(board_size=15, seed=42)
        
        # Create unique moves
        seen_positions = set()
        moves = []
        for (x, y), piece in moves_data:
            if (x, y) not in seen_positions:
                seen_positions.add((x, y))
                moves.append((x, y, piece))
        
        board = create_board_from_moves(moves)
        original_hash = hasher.compute_hash(board, 'X')
        
        # Add a piece
        test_x, test_y = 7, 7
        assume((test_x, test_y) not in seen_positions)
        
        hash_after_add = hasher.update_hash(original_hash, test_x, test_y, 'X')
        hash_after_remove = hasher.update_hash(hash_after_add, test_x, test_y, 'X')
        
        assert hash_after_remove == original_hash, "XOR should be reversible"


class TestTranspositionTableProperties:
    """Property tests for transposition table."""
    
    def setup_method(self):
        """Reset global TT before each test."""
        reset_transposition_table()
    
    @given(
        st.floats(min_value=-10000, max_value=10000, allow_nan=False),
        st.integers(min_value=1, max_value=10),
        st.sampled_from([EntryType.EXACT, EntryType.LOWER, EntryType.UPPER])
    )
    @settings(max_examples=50)
    def test_store_and_retrieve(self, score: float, depth: int, entry_type: EntryType):
        """
        **Feature: ai-match-analysis-system, Property 6: Store and retrieve**
        Stored entries should be retrievable.
        """
        tt = TranspositionTable(max_size=1000)
        hash_key = 12345
        best_move = (7, 7)
        
        tt.store(hash_key, depth, score, entry_type, best_move)
        
        # Probe with same depth
        retrieved_score, retrieved_move = tt.probe(hash_key, depth, -float('inf'), float('inf'))
        
        if entry_type == EntryType.EXACT:
            assert retrieved_score == score
        assert retrieved_move == best_move
    
    @given(st.integers(min_value=1, max_value=5))
    @settings(max_examples=20)
    def test_depth_requirement(self, stored_depth: int):
        """
        **Feature: ai-match-analysis-system, Property 7: Depth requirement**
        Entries with insufficient depth should not return score.
        """
        tt = TranspositionTable(max_size=1000)
        hash_key = 12345
        
        tt.store(hash_key, stored_depth, 100.0, EntryType.EXACT, (7, 7))
        
        # Probe with higher depth requirement
        higher_depth = stored_depth + 1
        retrieved_score, retrieved_move = tt.probe(hash_key, higher_depth, -float('inf'), float('inf'))
        
        # Score should be None (insufficient depth), but move should still be available
        assert retrieved_score is None
        assert retrieved_move == (7, 7)
    
    @given(st.lists(st.integers(min_value=0, max_value=1000000), min_size=10, max_size=50))
    @settings(max_examples=20)
    def test_hit_rate_tracking(self, hash_keys: List[int]):
        """
        **Feature: ai-match-analysis-system, Property 8: Statistics tracking**
        Hit/miss statistics should be accurate.
        """
        tt = TranspositionTable(max_size=1000)
        
        # Store half the keys
        stored_keys = set(hash_keys[:len(hash_keys) // 2])
        for key in stored_keys:
            tt.store(key, 5, 100.0, EntryType.EXACT, (7, 7))
        
        # Probe all keys
        for key in hash_keys:
            tt.probe(key, 5, -float('inf'), float('inf'))
        
        stats = tt.get_stats()
        
        # Verify statistics are tracked
        assert stats["hits"] + stats["misses"] == len(hash_keys)
        assert stats["hits"] >= 0
        assert stats["misses"] >= 0
    
    def test_new_search_increments_age(self):
        """
        **Feature: ai-match-analysis-system, Property 9: Age tracking**
        new_search() should increment the age counter.
        """
        tt = TranspositionTable(max_size=1000)
        
        initial_age = tt._current_age
        tt.new_search()
        
        assert tt._current_age == initial_age + 1
    
    @given(st.integers(min_value=100, max_value=200))
    @settings(max_examples=10)
    def test_max_size_respected(self, num_entries: int):
        """
        **Feature: ai-match-analysis-system, Property 10: Size limit**
        Table should not exceed max_size significantly after many insertions.
        """
        max_size = 50
        tt = TranspositionTable(max_size=max_size)
        
        # Store more entries than max_size
        for i in range(num_entries):
            tt.store(i, 5, float(i), EntryType.EXACT, (i % 15, i % 15))
        
        # After many insertions, size should be controlled
        # Allow up to 2x max_size as eviction happens lazily
        assert len(tt._table) <= max_size * 2, f"Table size {len(tt._table)} exceeds limit"


class TestIntegrationWithBoard:
    """Integration tests with actual board positions."""
    
    def test_real_game_position_hashing(self):
        """Test hashing with a real game position."""
        tt = TranspositionTable(max_size=1000)
        
        # Create a simple game position
        board = create_empty_board()
        board[7][7] = 'X'  # Center
        board[7][8] = 'O'
        board[8][7] = 'X'
        board[8][8] = 'O'
        
        hash1 = tt.compute_hash(board, 'X')
        hash2 = tt.compute_hash(board, 'X')
        
        assert hash1 == hash2
        assert hash1 != 0  # Should not be zero
    
    def test_incremental_update_during_search(self):
        """Test incremental hash updates during search simulation."""
        tt = TranspositionTable(max_size=1000)
        
        board = create_empty_board()
        board[7][7] = 'X'
        
        current_hash = tt.compute_hash(board, 'O')
        
        # Simulate making a move
        move_x, move_y = 7, 8
        new_hash = tt.update_hash(current_hash, move_x, move_y, 'O')
        new_hash = tt.toggle_side(new_hash)
        
        # Verify by computing full hash
        board[move_x][move_y] = 'O'
        expected_hash = tt.compute_hash(board, 'X')
        
        assert new_hash == expected_hash


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
