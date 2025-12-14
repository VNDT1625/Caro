"""
Lightweight search utilities for BASIC analysis tier.

Implements a simple heuristic search to satisfy plan tests without heavy search.
"""

import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from .threat_detector import ThreatDetector
from .position_evaluator import PositionEvaluator
from .types import BOARD_SIZE, ThreatType


@dataclass
class TTEntry:
    depth: int
    score: float
    move: Tuple[int, int]
    flag: str


class SimpleTranspositionTable:
    """Minimal in-memory transposition table."""

    def __init__(self, size: int = 1000):
        self.size = size
        self._table: Dict[str, TTEntry] = {}

    def store(self, key: str, depth: int, score: float, move: Tuple[int, int], flag: str = "exact"):
        entry = self._table.get(key)
        if entry is None or depth >= entry.depth:
            self._table[key] = TTEntry(depth=depth, score=score, move=move, flag=flag)

    def get(self, key: str) -> Optional[TTEntry]:
        return self._table.get(key)


class BasicSearch:
    """Heuristic search for best move."""

    def __init__(self, board_size: int = BOARD_SIZE, max_depth: int = 2, time_limit_ms: int = 500):
        self.max_depth = max_depth
        self.time_limit_ms = time_limit_ms
        self.board_size = board_size
        self.threat_detector = ThreatDetector(board_size)
        self.position_evaluator = PositionEvaluator(self.threat_detector, board_size)
        self.tt = SimpleTranspositionTable()

    def _candidate_moves(self, board: List[List[Optional[str]]]) -> List[Tuple[int, int]]:
        positions = []
        has_stone = False
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] is not None:
                    has_stone = True
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = x + dx, y + dy
                            if 0 <= nx < self.board_size and 0 <= ny < self.board_size and board[nx][ny] is None:
                                positions.append((nx, ny))
        if not has_stone:
            center = self.board_size // 2
            return [(center, center)]
        # Deduplicate and cap
        uniq = list({p for p in positions})
        return uniq[:40] if len(uniq) > 40 else uniq

    def _score_candidate(self, board: List[List[Optional[str]]], move: Tuple[int, int], player: str) -> float:
        x, y = move
        if board[x][y] is not None:
            return float("-inf")

        opponent = "O" if player == "X" else "X"
        opp_threats_before = self.threat_detector.detect_all_threats(board, opponent)

        temp = [row[:] for row in board]
        temp[x][y] = player

        # Score from our position evaluation
        own_score = self.position_evaluator.evaluate_position(temp, player).score

        # Reward blocking opponent immediate threats
        opp_threats_after = self.threat_detector.detect_all_threats(temp, opponent)
        blocked_four = max(0, opp_threats_before.threats.get(ThreatType.FOUR, 0) -
                           opp_threats_after.threats.get(ThreatType.FOUR, 0))
        blocked_open_four = max(0, opp_threats_before.threats.get(ThreatType.OPEN_FOUR, 0) -
                                opp_threats_after.threats.get(ThreatType.OPEN_FOUR, 0))
        blocked_five = max(0, opp_threats_before.threats.get(ThreatType.FIVE, 0) -
                           opp_threats_after.threats.get(ThreatType.FIVE, 0))

        block_bonus = (blocked_five * 100000) + (blocked_open_four * 20000) + (blocked_four * 5000)
        return own_score + block_bonus

    def search(self, board: List[List[Optional[str]]], player: str) -> Tuple[Optional[Tuple[int, int]], float]:
        start = time.time()
        best_move = None
        best_score = float("-inf")

        for move in self._candidate_moves(board):
            if (time.time() - start) * 1000 > self.time_limit_ms + 200:
                break
            score = self._score_candidate(board, move, player)
            if score > best_score:
                best_score = score
                best_move = move

        if best_move is None:
            # Fallback: first empty
            for x in range(BOARD_SIZE):
                for y in range(BOARD_SIZE):
                    if board[x][y] is None:
                        best_move = (x, y)
                        best_score = 0.0
                        break
                if best_move:
                    break

        return best_move, best_score


def find_best_move(board: List[List[Optional[str]]], player: str) -> Tuple[Optional[Tuple[int, int]], float]:
    """Helper function mirroring original API."""
    return BasicSearch().search(board, player)
