"""
Transposition Table with Zobrist Hashing for Caro/Gomoku

This module implements a transposition table using Zobrist hashing to cache
evaluated positions and avoid redundant calculations during minimax search.

**Feature: ai-match-analysis-system, Property: Zobrist Hashing Consistency**
- Same position → same hash
- Different position → different hash (with high probability)
"""

import random
from typing import Dict, Optional, Tuple, Any
from functools import lru_cache
from dataclasses import dataclass
from enum import Enum


class EntryType(Enum):
    """Type of transposition table entry."""
    EXACT = "exact"      # Exact score
    LOWER = "lower"      # Lower bound (beta cutoff)
    UPPER = "upper"      # Upper bound (alpha cutoff)


@dataclass
class TTEntry:
    """Transposition table entry."""
    hash_key: int
    depth: int
    score: float
    entry_type: EntryType
    best_move: Optional[Tuple[int, int]]
    age: int  # For replacement strategy


class ZobristHasher:
    """
    Zobrist hashing for board positions.
    
    Uses random 64-bit integers for each (position, piece) combination.
    XOR operations allow incremental hash updates.
    """
    
    def __init__(self, board_size: int = 15, seed: int = 42):
        """
        Initialize Zobrist hash tables.
        
        Args:
            board_size: Size of the board (default 15x15)
            seed: Random seed for reproducibility
        """
        self.board_size = board_size
        self.seed = seed
        
        # Initialize random number generator with seed for reproducibility
        rng = random.Random(seed)
        
        # Create hash tables for each position and piece type
        # piece_index: 0 = X (black), 1 = O (white)
        self._hash_table: Dict[Tuple[int, int, int], int] = {}
        
        for x in range(board_size):
            for y in range(board_size):
                for piece in range(2):  # 0 = X, 1 = O
                    self._hash_table[(x, y, piece)] = rng.getrandbits(64)
        
        # Hash for side to move
        self._side_hash = rng.getrandbits(64)
    
    def compute_hash(self, board: list, current_player: str = 'X') -> int:
        """
        Compute full Zobrist hash for a board position.
        
        Args:
            board: 2D list representing the board state
            current_player: Current player to move ('X' or 'O')
            
        Returns:
            64-bit hash value
        """
        hash_value = 0
        
        for x in range(min(len(board), self.board_size)):
            for y in range(min(len(board[0]) if board else 0, self.board_size)):
                piece = board[x][y] if x < len(board) and y < len(board[x]) else None
                if piece == 'X':
                    hash_value ^= self._hash_table[(x, y, 0)]
                elif piece == 'O':
                    hash_value ^= self._hash_table[(x, y, 1)]
        
        # Include side to move in hash
        if current_player == 'O':
            hash_value ^= self._side_hash
        
        return hash_value
    
    def update_hash(self, current_hash: int, x: int, y: int, 
                    piece: str, is_add: bool = True) -> int:
        """
        Incrementally update hash after a move.
        
        XOR is its own inverse, so adding and removing use the same operation.
        
        Args:
            current_hash: Current hash value
            x, y: Position of the move
            piece: Piece type ('X' or 'O')
            is_add: True if adding piece, False if removing
            
        Returns:
            Updated hash value
        """
        piece_index = 0 if piece == 'X' else 1
        return current_hash ^ self._hash_table[(x, y, piece_index)]
    
    def toggle_side(self, current_hash: int) -> int:
        """Toggle the side to move in the hash."""
        return current_hash ^ self._side_hash
    
    def get_hash_key(self, x: int, y: int, piece: str) -> int:
        """Get the hash key for a specific position and piece."""
        piece_index = 0 if piece == 'X' else 1
        return self._hash_table.get((x, y, piece_index), 0)


class TranspositionTable:
    """
    Transposition table for caching evaluated positions.
    
    Uses LRU-style replacement with age tracking.
    """
    
    def __init__(self, max_size: int = 1_000_000, board_size: int = 15):
        """
        Initialize transposition table.
        
        Args:
            max_size: Maximum number of entries
            board_size: Size of the board for Zobrist hashing
        """
        self.max_size = max_size
        self.hasher = ZobristHasher(board_size)
        self._table: Dict[int, TTEntry] = {}
        self._current_age = 0
        self._hits = 0
        self._misses = 0
        self._collisions = 0
    
    def new_search(self):
        """Called at the start of a new search to increment age."""
        self._current_age += 1
    
    def probe(self, hash_key: int, depth: int, alpha: float, beta: float
              ) -> Tuple[Optional[float], Optional[Tuple[int, int]]]:
        """
        Probe the transposition table for a position.
        
        Args:
            hash_key: Zobrist hash of the position
            depth: Current search depth
            alpha: Alpha value for alpha-beta pruning
            beta: Beta value for alpha-beta pruning
            
        Returns:
            Tuple of (score if usable, best_move if available)
        """
        entry = self._table.get(hash_key)
        
        if entry is None:
            self._misses += 1
            return None, None
        
        # Verify hash collision hasn't occurred
        if entry.hash_key != hash_key:
            self._collisions += 1
            return None, None
        
        self._hits += 1
        
        # Only use entry if depth is sufficient
        if entry.depth >= depth:
            if entry.entry_type == EntryType.EXACT:
                return entry.score, entry.best_move
            elif entry.entry_type == EntryType.LOWER and entry.score >= beta:
                return entry.score, entry.best_move
            elif entry.entry_type == EntryType.UPPER and entry.score <= alpha:
                return entry.score, entry.best_move
        
        # Return best move even if score isn't usable (for move ordering)
        return None, entry.best_move
    
    def store(self, hash_key: int, depth: int, score: float, 
              entry_type: EntryType, best_move: Optional[Tuple[int, int]]):
        """
        Store a position in the transposition table.
        
        Uses replacement strategy:
        1. Always replace if slot is empty
        2. Replace if new entry has greater depth
        3. Replace if existing entry is from older search
        
        Args:
            hash_key: Zobrist hash of the position
            depth: Search depth
            score: Evaluated score
            entry_type: Type of score (exact, lower, upper bound)
            best_move: Best move found
        """
        existing = self._table.get(hash_key)
        
        # Replacement strategy
        should_replace = (
            existing is None or
            existing.age < self._current_age or
            depth >= existing.depth
        )
        
        if should_replace:
            # Check if we need to evict entries
            if len(self._table) >= self.max_size and existing is None:
                self._evict_entries()
            
            self._table[hash_key] = TTEntry(
                hash_key=hash_key,
                depth=depth,
                score=score,
                entry_type=entry_type,
                best_move=best_move,
                age=self._current_age
            )
    
    def _evict_entries(self):
        """Remove entries when table is full."""
        # First try to remove old entries from previous searches
        old_keys = [
            k for k, v in self._table.items() 
            if v.age < self._current_age
        ]
        
        if old_keys:
            # Remove all old entries
            for key in old_keys:
                del self._table[key]
        else:
            # If no old entries, remove entries with lowest depth
            entries_by_depth = sorted(
                self._table.items(), 
                key=lambda x: (x[1].depth, x[1].age)
            )
            # Remove bottom 25% by depth
            to_remove = len(entries_by_depth) // 4
            for key, _ in entries_by_depth[:max(to_remove, 1)]:
                del self._table[key]
    
    def clear(self):
        """Clear the transposition table."""
        self._table.clear()
        self._current_age = 0
        self._hits = 0
        self._misses = 0
        self._collisions = 0
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about table usage."""
        total_probes = self._hits + self._misses
        hit_rate = self._hits / total_probes if total_probes > 0 else 0
        
        return {
            "size": len(self._table),
            "max_size": self.max_size,
            "hits": self._hits,
            "misses": self._misses,
            "collisions": self._collisions,
            "hit_rate": hit_rate,
            "fill_rate": len(self._table) / self.max_size
        }
    
    def compute_hash(self, board: list, current_player: str = 'X') -> int:
        """Compute hash for a board position."""
        return self.hasher.compute_hash(board, current_player)
    
    def update_hash(self, current_hash: int, x: int, y: int, 
                    piece: str, is_add: bool = True) -> int:
        """Incrementally update hash after a move."""
        return self.hasher.update_hash(current_hash, x, y, piece, is_add)
    
    def toggle_side(self, current_hash: int) -> int:
        """Toggle side to move in hash."""
        return self.hasher.toggle_side(current_hash)


# Global transposition table instance
_global_tt: Optional[TranspositionTable] = None


def get_transposition_table(max_size: int = 1_000_000) -> TranspositionTable:
    """Get or create the global transposition table."""
    global _global_tt
    if _global_tt is None:
        _global_tt = TranspositionTable(max_size=max_size)
    return _global_tt


def reset_transposition_table():
    """Reset the global transposition table."""
    global _global_tt
    if _global_tt is not None:
        _global_tt.clear()
