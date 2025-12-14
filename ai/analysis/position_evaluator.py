"""
Simplified position evaluation utilities for Gomoku/Caro.

Provides basic scoring, win probability calculation, and move classification.
Designed to satisfy property tests while keeping implementation lightweight.
"""

import math
from typing import List, Optional

from .types import (
    EvaluationResult,
    MoveClassification,
    BOARD_SIZE,
    classify_move_score,
)
from .threat_detector import ThreatDetector


class PositionEvaluator:
    """Lightweight evaluator built on top of ThreatDetector."""

    def __init__(self, threat_detector: Optional[ThreatDetector] = None, board_size: int = BOARD_SIZE):
        self.board_size = board_size
        self.threat_detector = threat_detector or ThreatDetector(board_size)

    # ----------------------------
    # Core helpers
    # ----------------------------
    def calculate_win_probability(self, score: float) -> float:
        """Map score to win probability via logistic curve."""
        try:
            prob = 1.0 / (1.0 + math.exp(-score / 1000.0))
        except OverflowError:
            prob = 0.0 if score < 0 else 1.0
        return max(0.0, min(1.0, prob))

    def position_bonus(self, x: int, y: int) -> float:
        """Center-focused bonus scaled to 0-50 range."""
        center = (self.board_size - 1) / 2.0
        max_distance = math.sqrt(2 * center * center)
        distance = math.sqrt((x - center) ** 2 + (y - center) ** 2)
        bonus = 50.0 * (1.0 - (distance / max_distance))
        return max(0.0, bonus)

    def classify_move(self, actual_score: float, best_score: float) -> MoveClassification:
        """Classify move quality based on score ratio."""
        return classify_move_score(actual_score, best_score)

    # ----------------------------
    # Evaluation methods
    # ----------------------------
    def _aggregate_position_bonus(self, board: List[List[Optional[str]]], player: str) -> float:
        """Simple positional bonus: player's stones minus opponent's bonuses."""
        opponent = "O" if player == "X" else "X"
        player_bonus = 0.0
        opponent_bonus = 0.0

        for x in range(self.board_size):
            for y in range(self.board_size):
                cell = board[x][y]
                if cell == player:
                    player_bonus += self.position_bonus(x, y)
                elif cell == opponent:
                    opponent_bonus += self.position_bonus(x, y)

        return player_bonus - opponent_bonus

    def evaluate_position(self, board: List[List[Optional[str]]], player: str) -> EvaluationResult:
        """Evaluate board for given player."""
        threats = self.threat_detector.detect_all_threats(board, player)
        score = threats.total_score + self._aggregate_position_bonus(board, player)
        win_prob = self.calculate_win_probability(score)
        return EvaluationResult(score=score, win_probability=win_prob, threats=threats)

    def evaluate_move(self, board: List[List[Optional[str]]], move_x: int, move_y: int, player: str) -> float:
        """Evaluate a potential move by applying it then scoring the position."""
        if not (0 <= move_x < self.board_size and 0 <= move_y < self.board_size):
            return -math.inf
        if board[move_x][move_y] is not None:
            return -math.inf
    
        temp_board = [row[:] for row in board]
        temp_board[move_x][move_y] = player
        result = self.evaluate_position(temp_board, player)
        return result.score

    def determine_mistake_severity(self, actual_score: float, best_score: float) -> Optional[str]:
        """Classify mistake severity based on score gap."""
        gap = best_score - actual_score
        if gap >= 50:
            return "critical"
        if gap >= 20:
            return "major"
        if gap >= 5:
            return "minor"
        return None

    def find_best_moves(self, board: List[List[Optional[str]]], player: str, top_n: int = 3):
        """Return top-N empty cells scored by positional bonus."""
        candidates = []
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] is None:
                    candidates.append((x, y, self.position_bonus(x, y)))
        candidates.sort(key=lambda m: m[2], reverse=True)
        return candidates[:top_n]
