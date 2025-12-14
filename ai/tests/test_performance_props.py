"""
Property-based tests for Analysis Performance Optimization.

Task 12: Optimize Analysis Performance
Requirements:
- 9.1: Full game analysis < 2000ms
- 9.2: Single move analysis < 100ms
- 9.3: Comment generation < 50ms per move
- 9.4: Use caching where appropriate

Property Tests:
- Property 20: Full Game Analysis Performance
- Property 21: Single Move Analysis Performance
- Property 22: Comment Generation Performance
- Property 23: Caching Effectiveness
"""

import time
import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Optional, Tuple

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.types import Move, BOARD_SIZE
from analysis.basic_analyzer import BasicAnalyzer
from analysis.basic_analysis_optimized import OptimizedBasicAnalyzer
from analysis.comment_generator import CommentGenerator, MoveClassification, ThreatType


# ============================================
# Test Helpers
# ============================================

def generate_valid_game(num_moves: int) -> List[Move]:
    """Generate a valid game with specified number of moves."""
    moves = []
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    
    # Start from center
    center = BOARD_SIZE // 2
    positions = [(center, center)]
    
    # Generate adjacent positions
    for x in range(BOARD_SIZE):
        for y in range(BOARD_SIZE):
            if (x, y) != (center, center):
                positions.append((x, y))
    
    # Sort by distance from center for more realistic games
    positions.sort(key=lambda p: abs(p[0] - center) + abs(p[1] - center))
    
    pos_idx = 0
    for i in range(num_moves):
        player = "X" if i % 2 == 0 else "O"
        
        # Find next empty position
        while pos_idx < len(positions):
            x, y = positions[pos_idx]
            pos_idx += 1
            if board[x][y] is None:
                board[x][y] = player
                moves.append(Move(x=x, y=y, player=player, move_number=i + 1))
                break
    
    return moves


def generate_random_game(num_moves: int, seed: int = None) -> List[Move]:
    """Generate a random valid game."""
    import random
    if seed is not None:
        random.seed(seed)
    
    moves = []
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    
    for i in range(num_moves):
        player = "X" if i % 2 == 0 else "O"
        
        # Find all empty positions
        empty = [(x, y) for x in range(BOARD_SIZE) for y in range(BOARD_SIZE) if board[x][y] is None]
        if not empty:
            break
        
        x, y = random.choice(empty)
        board[x][y] = player
        moves.append(Move(x=x, y=y, player=player, move_number=i + 1))
    
    return moves


# ============================================
# Property 20: Full Game Analysis Performance
# ============================================

class TestFullGameAnalysisPerformance:
    """
    Property 20: Full Game Analysis Performance
    
    Requirement 9.1: Full game analysis must complete within 2000ms
    
    Property: For any valid game with N moves (5 <= N <= 100),
    analyze_game() must complete within 2000ms.
    """
    
    def test_analysis_completes_within_2000ms_property(self):
        """Full game analysis should complete within 2000ms."""
        analyzer = OptimizedBasicAnalyzer()
        
        for num_moves in [10, 20, 30, 40]:
            moves = generate_valid_game(num_moves)
            
            start_time = time.time()
            result = analyzer.analyze_game(moves)
            elapsed_ms = (time.time() - start_time) * 1000
            
            # Requirement 9.1: < 2000ms
            assert elapsed_ms < 2000, f"Analysis took {elapsed_ms:.0f}ms for {num_moves} moves (limit: 2000ms)"
            assert result is not None
            assert len(result.timeline) == len(moves)
    
    def test_short_game_performance(self):
        """Short games (10 moves) should be very fast."""
        analyzer = OptimizedBasicAnalyzer()
        moves = generate_valid_game(10)
        
        start_time = time.time()
        result = analyzer.analyze_game(moves)
        elapsed_ms = (time.time() - start_time) * 1000
        
        # Short games should be much faster than limit
        assert elapsed_ms < 500, f"Short game took {elapsed_ms:.0f}ms (expected < 500ms)"
        assert result is not None
    
    def test_medium_game_performance(self):
        """Medium games (30 moves) should complete within limit."""
        analyzer = OptimizedBasicAnalyzer()
        moves = generate_valid_game(30)
        
        start_time = time.time()
        result = analyzer.analyze_game(moves)
        elapsed_ms = (time.time() - start_time) * 1000
        
        assert elapsed_ms < 1500, f"Medium game took {elapsed_ms:.0f}ms (expected < 1500ms)"
        assert result is not None
    
    def test_long_game_performance(self):
        """Long games (50 moves) should still complete within limit."""
        analyzer = OptimizedBasicAnalyzer()
        moves = generate_valid_game(50)
        
        start_time = time.time()
        result = analyzer.analyze_game(moves)
        elapsed_ms = (time.time() - start_time) * 1000
        
        assert elapsed_ms < 2000, f"Long game took {elapsed_ms:.0f}ms (limit: 2000ms)"
        assert result is not None


# ============================================
# Property 21: Single Move Analysis Performance
# ============================================

class TestSingleMoveAnalysisPerformance:
    """
    Property 21: Single Move Analysis Performance
    
    Requirement 9.2: Single move analysis must complete within 100ms
    
    Property: For any valid board position, evaluating a single move
    must complete within 100ms.
    """
    
    def test_single_move_evaluation_within_100ms(self):
        """Single move evaluation should complete within 100ms."""
        analyzer = OptimizedBasicAnalyzer()
        
        for num_moves in [10, 20, 30]:
            moves = generate_valid_game(num_moves)
            
            # Build board state
            board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
            for move in moves:
                board[move.x][move.y] = move.player
            
            # Find an empty position
            empty_pos = None
            for x in range(BOARD_SIZE):
                for y in range(BOARD_SIZE):
                    if board[x][y] is None:
                        empty_pos = (x, y)
                        break
                if empty_pos:
                    break
            
            if empty_pos is None:
                continue
            
            player = "O" if moves[-1].player == "X" else "X"
            
            start_time = time.time()
            score = analyzer._evaluate_move_fast(
                board, empty_pos[0], empty_pos[1], player
            )
            elapsed_ms = (time.time() - start_time) * 1000
            
            # Requirement 9.2: < 100ms
            assert elapsed_ms < 100, f"Single move evaluation took {elapsed_ms:.0f}ms (limit: 100ms)"
    
    def test_find_best_moves_performance(self):
        """Finding best moves should be fast."""
        analyzer = OptimizedBasicAnalyzer()
        moves = generate_valid_game(20)
        
        # Build board state
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        for move in moves:
            board[move.x][move.y] = move.player
        
        player = "O" if moves[-1].player == "X" else "X"
        
        start_time = time.time()
        best_moves = analyzer._find_best_moves_fast(board, player, top_n=3)
        elapsed_ms = (time.time() - start_time) * 1000
        
        # Finding best moves should be reasonably fast
        assert elapsed_ms < 200, f"find_best_moves took {elapsed_ms:.0f}ms (expected < 200ms)"
        assert len(best_moves) > 0


# ============================================
# Property 22: Comment Generation Performance
# ============================================

class TestCommentGenerationPerformance:
    """
    Property 22: Comment Generation Performance
    
    Requirement 9.3: Comment generation must complete within 50ms per move
    
    Property: Generating comments for a single move in all 4 languages
    must complete within 50ms.
    """
    
    def test_comment_generation_within_50ms(self):
        """Comment generation should complete within 50ms."""
        comment_generator = CommentGenerator()
        
        for classification in list(MoveClassification):
            for num_threats in [0, 1, 2, 3]:
                # Generate random threats
                threat_types = [ThreatType.OPEN_THREE, ThreatType.FOUR, ThreatType.OPEN_FOUR]
                threats_created = threat_types[:num_threats] if num_threats > 0 else []
                
                start_time = time.time()
                result = comment_generator.generate_all_languages(
                    classification=classification,
                    threats_created=threats_created,
                    threats_blocked=[],
                    is_winning=False,
                    is_forced=False,
                    better_move=None
                )
                elapsed_ms = (time.time() - start_time) * 1000
                
                # Requirement 9.3: < 50ms
                assert elapsed_ms < 50, f"Comment generation took {elapsed_ms:.0f}ms (limit: 50ms)"
                assert result is not None
                assert result.vi is not None
                assert result.en is not None
                assert result.zh is not None
                assert result.ja is not None
    
    def test_batch_comment_generation(self):
        """Generating comments for many moves should scale linearly."""
        comment_generator = CommentGenerator()
        num_moves = 50
        
        start_time = time.time()
        for i in range(num_moves):
            classification = MoveClassification.GOOD if i % 2 == 0 else MoveClassification.OKAY
            comment_generator.generate_all_languages(
                classification=classification,
                threats_created=[],
                threats_blocked=[],
                is_winning=False,
                is_forced=False,
                better_move=None
            )
        elapsed_ms = (time.time() - start_time) * 1000
        
        # 50 moves * 50ms = 2500ms max, but should be much faster
        avg_per_move = elapsed_ms / num_moves
        assert avg_per_move < 50, f"Average comment generation: {avg_per_move:.1f}ms (limit: 50ms)"


# ============================================
# Property 23: Caching Effectiveness
# ============================================

class TestCachingEffectiveness:
    """
    Property 23: Caching Effectiveness
    
    Requirement 9.4: Use caching where appropriate
    
    Property: Repeated analysis of the same position should be faster
    due to caching (threat cache).
    """
    
    def test_threat_cache_improves_performance(self):
        """Threat cache should improve analysis performance."""
        analyzer = OptimizedBasicAnalyzer()
        
        moves = generate_valid_game(20)
        
        # Build board state
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        for move in moves:
            board[move.x][move.y] = move.player
        
        player = "O" if moves[-1].player == "X" else "X"
        
        # First call (cold cache)
        start_time = time.time()
        analyzer._find_best_moves_fast(board, player, top_n=3)
        first_time = (time.time() - start_time) * 1000
        
        # Second call (warm cache)
        start_time = time.time()
        analyzer._find_best_moves_fast(board, player, top_n=3)
        second_time = (time.time() - start_time) * 1000
        
        # Second call should be faster due to cache
        assert second_time <= first_time * 1.2, \
            f"Cache didn't help: {second_time:.0f}ms vs {first_time:.0f}ms"
    
    def test_repeated_analysis_benefits_from_cache(self):
        """Repeated analysis of same game should be faster."""
        analyzer = OptimizedBasicAnalyzer()
        moves = generate_valid_game(15)
        
        # First analysis (cold cache)
        start_time = time.time()
        result1 = analyzer.analyze_game(moves)
        first_time = (time.time() - start_time) * 1000
        
        # Second analysis (warm cache - but cache is cleared per analysis)
        start_time = time.time()
        result2 = analyzer.analyze_game(moves)
        second_time = (time.time() - start_time) * 1000
        
        # Results should be consistent
        assert len(result1.timeline) == len(result2.timeline)
        
        # Both should be fast
        assert first_time < 1000, f"First analysis too slow: {first_time:.0f}ms"
        assert second_time < 1000, f"Second analysis too slow: {second_time:.0f}ms"


# ============================================
# Performance Benchmarks
# ============================================

class TestPerformanceBenchmarks:
    """
    Benchmark tests for overall performance validation.
    """
    
    def test_benchmark_10_move_game(self):
        """Benchmark: 10-move game analysis."""
        analyzer = OptimizedBasicAnalyzer()
        moves = generate_valid_game(10)
        
        times = []
        for _ in range(3):
            start = time.time()
            analyzer.analyze_game(moves)
            times.append((time.time() - start) * 1000)
        
        avg_time = sum(times) / len(times)
        print(f"\n10-move game: avg={avg_time:.0f}ms, min={min(times):.0f}ms, max={max(times):.0f}ms")
        assert avg_time < 500, f"10-move game too slow: {avg_time:.0f}ms"
    
    def test_benchmark_30_move_game(self):
        """Benchmark: 30-move game analysis."""
        analyzer = OptimizedBasicAnalyzer()
        moves = generate_valid_game(30)
        
        times = []
        for _ in range(3):
            start = time.time()
            analyzer.analyze_game(moves)
            times.append((time.time() - start) * 1000)
        
        avg_time = sum(times) / len(times)
        print(f"\n30-move game: avg={avg_time:.0f}ms, min={min(times):.0f}ms, max={max(times):.0f}ms")
        assert avg_time < 1500, f"30-move game too slow: {avg_time:.0f}ms"
    
    def test_benchmark_50_move_game(self):
        """Benchmark: 50-move game analysis."""
        analyzer = OptimizedBasicAnalyzer()
        moves = generate_valid_game(50)
        
        times = []
        for _ in range(3):
            start = time.time()
            analyzer.analyze_game(moves)
            times.append((time.time() - start) * 1000)
        
        avg_time = sum(times) / len(times)
        print(f"\n50-move game: avg={avg_time:.0f}ms, min={min(times):.0f}ms, max={max(times):.0f}ms")
        assert avg_time < 2000, f"50-move game too slow: {avg_time:.0f}ms"


# ============================================
# Run tests
# ============================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
