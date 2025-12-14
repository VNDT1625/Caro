"""
What-if simulator for exploring hypothetical moves.

Simulates a move with shallow follow-up and returns evaluation deltas.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from .types import Move, BOARD_SIZE
from .position_evaluator import PositionEvaluator


@dataclass
class WhatIfResult:
    initial_score: float
    final_score: float
    evaluation_change: float
    opponent_response: Optional[Tuple[int, int]]

    def to_dict(self) -> Dict:
        return {
            "initial_score": self.initial_score,
            "final_score": self.final_score,
            "evaluation_change": self.evaluation_change,
            "opponent_response": self.opponent_response,
        }


class WhatIfSimulator:
    """Lightweight simulator that looks one move ahead for both sides."""

    def __init__(self, board_size: int = BOARD_SIZE):
        self.board_size = board_size
        self.evaluator = PositionEvaluator()

    def _empty_cells(self, board: List[List[Optional[str]]]) -> List[Tuple[int, int]]:
        cells = []
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] is None:
                    cells.append((x, y))
        return cells

    def _best_reply(self, board: List[List[Optional[str]]], player: str) -> Optional[Tuple[int, int]]:
        best = None
        best_score = float("-inf")
        for x, y in self._empty_cells(board):
            score = self.evaluator.evaluate_move(board, x, y, player)
            if score > best_score:
                best_score = score
                best = (x, y)
        return best

    def simulate_move(
        self,
        board: List[List[Optional[str]]],
        move_x: int,
        move_y: int,
        player: str,
    ) -> WhatIfResult:
        """Apply a move, choose opponent reply, and report score delta."""
        opponent = "O" if player == "X" else "X"
        initial_score = self.evaluator.evaluate_position(board, player).score

        # Apply hypothetical move
        if board[move_x][move_y] is not None:
            return WhatIfResult(initial_score, initial_score, 0.0, None)

        board_after = [row[:] for row in board]
        board_after[move_x][move_y] = player

        opp_move = self._best_reply(board_after, opponent)
        if opp_move:
            ox, oy = opp_move
            board_after[ox][oy] = opponent

        final_score = self.evaluator.evaluate_position(board_after, player).score
        return WhatIfResult(
            initial_score=initial_score,
            final_score=final_score,
            evaluation_change=final_score - initial_score,
            opponent_response=opp_move,
        )
