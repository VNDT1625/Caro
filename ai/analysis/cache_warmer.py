"""
AI Match Analysis System - Cache Warmer Module

This module provides cache warming functionality for common positions,
including opening positions, common game patterns, and frequently
analyzed positions.

Requirements: 8.7.3 - Cache warming for common positions
"""

import sys
import os
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

# Ensure the ai directory is in the path for imports
AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

from analysis.redis_cache import get_cache, RedisCache
from analysis.opening_book import OpeningBook
from analysis.position_evaluator import PositionEvaluator
from analysis.threat_detector import ThreatDetector


# Board size constant
BOARD_SIZE = 15


@dataclass
class WarmingResult:
    """Result of cache warming operation."""
    openings_cached: int
    patterns_cached: int
    positions_cached: int
    errors: int
    duration_ms: float


class CacheWarmer:
    """
    Cache warmer for pre-caching common positions.
    
    Warms the cache with:
    - Opening positions and their evaluations
    - Common tactical patterns
    - Frequently analyzed positions
    """
    
    def __init__(self, cache: Optional[RedisCache] = None):
        """
        Initialize cache warmer.
        
        Args:
            cache: Redis cache instance (uses global if not provided)
        """
        self.cache = cache or get_cache()
        self.threat_detector = ThreatDetector(BOARD_SIZE)
        self.position_evaluator = PositionEvaluator(self.threat_detector, BOARD_SIZE)
        
        try:
            self.opening_book = OpeningBook()
        except:
            self.opening_book = None
    
    def warm_all(self) -> WarmingResult:
        """
        Warm cache with all common positions.
        
        Returns:
            WarmingResult with counts
        """
        import time
        start = time.time()
        
        result = WarmingResult(
            openings_cached=0,
            patterns_cached=0,
            positions_cached=0,
            errors=0,
            duration_ms=0
        )
        
        # Warm openings
        try:
            result.openings_cached = self.warm_openings()
        except Exception as e:
            print(f"Error warming openings: {e}")
            result.errors += 1
        
        # Warm common patterns
        try:
            result.patterns_cached = self.warm_common_patterns()
        except Exception as e:
            print(f"Error warming patterns: {e}")
            result.errors += 1
        
        # Warm common positions
        try:
            result.positions_cached = self.warm_common_positions()
        except Exception as e:
            print(f"Error warming positions: {e}")
            result.errors += 1
        
        result.duration_ms = (time.time() - start) * 1000
        return result
    
    def warm_openings(self) -> int:
        """
        Warm cache with opening positions.
        
        Returns:
            Number of openings cached
        """
        if not self.opening_book:
            return 0
        
        openings = self.opening_book.get_all_openings()
        cached = 0
        
        for opening in openings:
            try:
                # Create board from opening moves
                board = self._create_board_from_moves(opening.get('moves', []))
                board_hash = self.cache.hash_board(board)
                
                # Evaluate position
                eval_result = self.position_evaluator.evaluate_position(board, 'X')
                
                evaluation = {
                    'opening_name': opening.get('name', 'Unknown'),
                    'evaluation': opening.get('evaluation', 0),
                    'win_probability': eval_result.win_probability,
                    'score': eval_result.score,
                    'description': opening.get('description', ''),
                    'common_responses': opening.get('common_responses', [])
                }
                
                if self.cache.set_position_evaluation(board_hash, evaluation):
                    cached += 1
            except Exception as e:
                print(f"Error caching opening {opening.get('name', 'unknown')}: {e}")
        
        return cached
    
    def warm_common_patterns(self) -> int:
        """
        Warm cache with common tactical patterns.
        
        Returns:
            Number of patterns cached
        """
        patterns = self._get_common_patterns()
        cached = 0
        
        for pattern in patterns:
            try:
                board = pattern['board']
                board_hash = self.cache.hash_board(board)
                
                # Evaluate position
                eval_result = self.position_evaluator.evaluate_position(board, pattern.get('player', 'X'))
                
                evaluation = {
                    'pattern_name': pattern.get('name', 'Unknown'),
                    'pattern_type': pattern.get('type', 'tactical'),
                    'win_probability': eval_result.win_probability,
                    'score': eval_result.score,
                    'best_move': pattern.get('best_move'),
                    'explanation': pattern.get('explanation', '')
                }
                
                if self.cache.set_position_evaluation(board_hash, evaluation):
                    cached += 1
            except Exception as e:
                print(f"Error caching pattern {pattern.get('name', 'unknown')}: {e}")
        
        return cached
    
    def warm_common_positions(self) -> int:
        """
        Warm cache with common game positions.
        
        These are positions that appear frequently in games,
        such as center openings and common responses.
        
        Returns:
            Number of positions cached
        """
        positions = self._get_common_positions()
        cached = 0
        
        for pos in positions:
            try:
                board = pos['board']
                board_hash = self.cache.hash_board(board)
                
                # Evaluate position
                player = pos.get('player', 'X')
                eval_result = self.position_evaluator.evaluate_position(board, player)
                
                # Find best moves
                best_moves = self.position_evaluator.find_best_moves(board, player, top_n=3)
                
                evaluation = {
                    'position_name': pos.get('name', 'Unknown'),
                    'win_probability': eval_result.win_probability,
                    'score': eval_result.score,
                    'best_moves': [
                        {'x': x, 'y': y, 'score': s}
                        for x, y, s in best_moves
                    ],
                    'move_count': pos.get('move_count', 0)
                }
                
                if self.cache.set_position_evaluation(board_hash, evaluation):
                    cached += 1
            except Exception as e:
                print(f"Error caching position {pos.get('name', 'unknown')}: {e}")
        
        return cached
    
    def _create_board_from_moves(self, moves: List[Dict]) -> List[List[Optional[str]]]:
        """
        Create board state from list of moves.
        
        Args:
            moves: List of move dicts with x, y, player
            
        Returns:
            2D board array
        """
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        
        for move in moves:
            x = move.get('x', 0)
            y = move.get('y', 0)
            player = move.get('player', 'X')
            
            if 0 <= x < BOARD_SIZE and 0 <= y < BOARD_SIZE:
                board[x][y] = player
        
        return board
    
    def _get_common_patterns(self) -> List[Dict]:
        """
        Get common tactical patterns for cache warming.
        
        Returns:
            List of pattern dicts with board and metadata
        """
        patterns = []
        
        # Pattern 1: Open Three (horizontal)
        board1 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board1[7][6] = 'X'
        board1[7][7] = 'X'
        board1[7][8] = 'X'
        patterns.append({
            'name': 'Open Three Horizontal',
            'type': 'threat',
            'board': board1,
            'player': 'X',
            'best_move': {'x': 7, 'y': 5},
            'explanation': 'Extend to create Open Four'
        })
        
        # Pattern 2: Open Three (vertical)
        board2 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board2[5][7] = 'X'
        board2[6][7] = 'X'
        board2[7][7] = 'X'
        patterns.append({
            'name': 'Open Three Vertical',
            'type': 'threat',
            'board': board2,
            'player': 'X',
            'best_move': {'x': 4, 'y': 7},
            'explanation': 'Extend to create Open Four'
        })
        
        # Pattern 3: Open Three (diagonal)
        board3 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board3[5][5] = 'X'
        board3[6][6] = 'X'
        board3[7][7] = 'X'
        patterns.append({
            'name': 'Open Three Diagonal',
            'type': 'threat',
            'board': board3,
            'player': 'X',
            'best_move': {'x': 4, 'y': 4},
            'explanation': 'Extend to create Open Four'
        })
        
        # Pattern 4: Four (must block)
        board4 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board4[7][5] = 'X'
        board4[7][6] = 'X'
        board4[7][7] = 'X'
        board4[7][8] = 'X'
        patterns.append({
            'name': 'Four Horizontal',
            'type': 'winning_threat',
            'board': board4,
            'player': 'O',
            'best_move': {'x': 7, 'y': 4},
            'explanation': 'Must block to prevent win'
        })
        
        # Pattern 5: Double Three
        board5 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board5[7][6] = 'X'
        board5[7][7] = 'X'
        board5[7][8] = 'X'
        board5[6][7] = 'X'
        board5[8][7] = 'X'
        patterns.append({
            'name': 'Double Three Cross',
            'type': 'winning_combination',
            'board': board5,
            'player': 'X',
            'best_move': {'x': 5, 'y': 7},
            'explanation': 'Double threat - guaranteed win'
        })
        
        # Pattern 6: Blocked Three
        board6 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board6[7][5] = 'O'
        board6[7][6] = 'X'
        board6[7][7] = 'X'
        board6[7][8] = 'X'
        patterns.append({
            'name': 'Blocked Three',
            'type': 'semi_threat',
            'board': board6,
            'player': 'X',
            'best_move': {'x': 7, 'y': 9},
            'explanation': 'Extend on open side'
        })
        
        # Pattern 7: Jump Three (broken pattern)
        board7 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board7[7][5] = 'X'
        board7[7][6] = 'X'
        board7[7][8] = 'X'  # Gap at 7,7
        patterns.append({
            'name': 'Jump Three',
            'type': 'hidden_threat',
            'board': board7,
            'player': 'X',
            'best_move': {'x': 7, 'y': 7},
            'explanation': 'Fill gap to create Four'
        })
        
        # Pattern 8: Fork setup
        board8 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board8[6][6] = 'X'
        board8[7][7] = 'X'
        board8[6][8] = 'X'
        patterns.append({
            'name': 'Fork Setup',
            'type': 'strategic',
            'board': board8,
            'player': 'X',
            'best_move': {'x': 8, 'y': 6},
            'explanation': 'Create multiple threat directions'
        })
        
        return patterns
    
    def _get_common_positions(self) -> List[Dict]:
        """
        Get common game positions for cache warming.
        
        Returns:
            List of position dicts with board and metadata
        """
        positions = []
        
        # Position 1: Empty board (first move)
        board1 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        positions.append({
            'name': 'Empty Board',
            'board': board1,
            'player': 'X',
            'move_count': 0
        })
        
        # Position 2: Center opening
        board2 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board2[7][7] = 'X'
        positions.append({
            'name': 'Center Opening',
            'board': board2,
            'player': 'O',
            'move_count': 1
        })
        
        # Position 3: Center + adjacent response
        board3 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board3[7][7] = 'X'
        board3[7][8] = 'O'
        positions.append({
            'name': 'Center + Adjacent',
            'board': board3,
            'player': 'X',
            'move_count': 2
        })
        
        # Position 4: Center + diagonal response
        board4 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board4[7][7] = 'X'
        board4[8][8] = 'O'
        positions.append({
            'name': 'Center + Diagonal',
            'board': board4,
            'player': 'X',
            'move_count': 2
        })
        
        # Position 5: Direct opening (two in a row)
        board5 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board5[7][7] = 'X'
        board5[7][8] = 'X'
        board5[6][7] = 'O'
        positions.append({
            'name': 'Direct Opening',
            'board': board5,
            'player': 'O',
            'move_count': 3
        })
        
        # Position 6: Indirect opening (diagonal)
        board6 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board6[7][7] = 'X'
        board6[8][8] = 'X'
        board6[6][6] = 'O'
        positions.append({
            'name': 'Indirect Opening',
            'board': board6,
            'player': 'O',
            'move_count': 3
        })
        
        # Position 7: Early game (5 moves)
        board7 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board7[7][7] = 'X'
        board7[7][8] = 'O'
        board7[6][7] = 'X'
        board7[8][7] = 'O'
        board7[6][6] = 'X'
        positions.append({
            'name': 'Early Game',
            'board': board7,
            'player': 'O',
            'move_count': 5
        })
        
        # Position 8: Mid game setup
        board8 = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        board8[7][7] = 'X'
        board8[7][8] = 'O'
        board8[6][7] = 'X'
        board8[8][7] = 'O'
        board8[6][6] = 'X'
        board8[8][8] = 'O'
        board8[5][5] = 'X'
        positions.append({
            'name': 'Mid Game Setup',
            'board': board8,
            'player': 'O',
            'move_count': 7
        })
        
        return positions


def warm_cache() -> WarmingResult:
    """
    Convenience function to warm cache.
    
    Returns:
        WarmingResult with counts
    """
    warmer = CacheWarmer()
    return warmer.warm_all()
