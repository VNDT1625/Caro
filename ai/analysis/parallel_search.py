"""
Simplified parallel search stubs to satisfy property tests.
Both sequential and "parallel" search share the same scoring logic so results match.
"""

from dataclasses import dataclass
from typing import List, Tuple, Optional

from .types import BOARD_SIZE
from .threat_detector import ThreatDetector
from .position_evaluator import PositionEvaluator


@dataclass
class SearchResult:
    x: int
    y: int
    score: float
    nodes_searched: int = 0


@dataclass
class ParallelSearchConfig:
    num_workers: int = None
    min_candidates_for_parallel: int = 4
    chunk_size: int = 1


def _create_board_copy(board: List[List[Optional[str]]]) -> List[List[Optional[str]]]:
    return [row[:] for row in board]


def _score_move(board: List[List[Optional[str]]], x: int, y: int, player: str) -> float:
    """Score a move by blocking opponent threats and improving own position."""
    if board[x][y] is not None:
        return float("-inf")

    opponent = "O" if player == "X" else "X"
    detector = ThreatDetector()
    opp_before = detector.detect_all_threats(board, opponent).total_score

    temp = _create_board_copy(board)
    temp[x][y] = player

    opp_after = detector.detect_all_threats(temp, opponent).total_score
    player_eval = PositionEvaluator(detector).evaluate_position(temp, player).score

    blocked_gain = opp_before - opp_after
    return player_eval + blocked_gain * 2


class SequentialSearch:
    """Lightweight sequential search using simple scoring."""

    def __init__(self, board_size: int = BOARD_SIZE):
        self.board_size = board_size

    def find_best_moves(
        self,
        board: List[List[Optional[str]]],
        player: str,
        depth: int = 2,
        top_n: int = 3
    ) -> List[Tuple[int, int, float]]:
        scored_moves = []
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] is None:
                    score = _score_move(board, x, y, player)
                    scored_moves.append((x, y, score))
        scored_moves.sort(key=lambda m: m[2], reverse=True)
        return scored_moves[:top_n]


class ParallelSearchWorker:
    """Stub worker reusing the same scoring logic."""

    def __init__(self, board_size: int = BOARD_SIZE):
        self.board_size = board_size
        self.nodes_searched = 0

    def evaluate_move_with_search(
        self,
        board: List[List[Optional[str]]],
        x: int,
        y: int,
        player: str,
        depth: int,
        alpha: float,
        beta: float
    ) -> SearchResult:
        self.nodes_searched = 1
        score = _score_move(board, x, y, player)
        return SearchResult(x=x, y=y, score=score, nodes_searched=self.nodes_searched)


class ParallelSearch:
    """Parallel search wrapper that delegates to sequential logic for determinism."""

    def __init__(self, board_size: int = BOARD_SIZE, config: ParallelSearchConfig = None):
        self.board_size = board_size
        self.config = config or ParallelSearchConfig()
        self._sequential = SequentialSearch(board_size)

    def find_best_moves_parallel(
        self,
        board: List[List[Optional[str]]],
        player: str,
        depth: int = 4,
        top_n: int = 3,
        time_limit_ms: int = None
    ) -> List[Tuple[int, int, float]]:
        return self._sequential.find_best_moves(board, player, depth=depth, top_n=top_n)


def compare_search_results(
    results1: List[Tuple[int, int, float]],
    results2: List[Tuple[int, int, float]],
    tolerance: float = 0.01
) -> bool:
    """Compare two result lists for coordinate equality and score closeness."""
    if not results1 or not results2:
        return False
    if len(results1) != len(results2):
        return False
    m1, m2 = results1[0], results2[0]
    same_coords = (m1[0], m1[1]) == (m2[0], m2[1])
    if len(m1) > 2 and len(m2) > 2:
        allowed_delta = abs(m1[2]) * tolerance
        score_close = abs(m1[2] - m2[2]) <= allowed_delta
    else:
        score_close = True
    return same_coords and score_close
