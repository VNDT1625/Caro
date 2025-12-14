"""
AI Match Analysis System - Move Scoring (0-10 Scale)

This module implements the MoveScorer class for scoring moves on a 0-10 scale
with classification thresholds.

Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 16.3, 16.4, 16.5
- 2.1: Score moves on 0-10 scale
- 2.2: Consider threats_created, threats_blocked, board_evaluation_change
- 2.3: Classification thresholds (excellent >= 8.5, good >= 7.0, etc.)
- 2.4: Identify delta between actual and best move
- 2.5: Provide score breakdown
- 2.6: Handle edge cases (first move, forced moves)
- 2.7: Consistent scoring across game phases
- 16.3: Mark missed VCF as "blunder"
- 16.4: Mark found VCF as "excellent"
- 16.5: Show winning sequence in alternatives
"""

from enum import Enum
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict

from .types import (
    ThreatType,
    ThreatResult,
    MoveClassification,
    THREAT_SCORES,
    BOARD_SIZE,
)
from .threat_detector import ThreatDetector
from .vcf_detector import VCFDetector, VCFResult


# 0-10 Scale Classification Thresholds (Requirement 2.3)
SCORE_THRESHOLDS = {
    MoveClassification.EXCELLENT: 8.5,
    MoveClassification.GOOD: 7.0,
    MoveClassification.OKAY: 5.0,
    MoveClassification.WEAK: 3.0,
    # Below 3.0 is BLUNDER
}


@dataclass
class MoveScoreBreakdown:
    """
    Detailed breakdown of a move's score.
    
    Attributes:
        final_score: Final 0-10 score
        classification: Move classification (excellent/good/okay/weak/blunder)
        threats_created_score: Score from threats created (0-4)
        threats_blocked_score: Score from threats blocked (0-3)
        position_score: Score from positional factors (0-1.5)
        evaluation_change_score: Score from board evaluation change (0-1.5)
        raw_score: Raw score before normalization
        best_move_score: Score of the best possible move
        delta: Difference from best move
        found_vcf: True if this move finds a VCF (Requirements 16.4)
        missed_vcf: True if player missed a VCF (Requirements 16.3)
        vcf_sequence: Winning sequence if VCF exists (Requirements 16.5)
    """
    final_score: float
    classification: MoveClassification
    threats_created_score: float
    threats_blocked_score: float
    position_score: float
    evaluation_change_score: float
    raw_score: float
    best_move_score: float
    delta: float
    found_vcf: bool = False
    missed_vcf: bool = False
    vcf_sequence: Optional[List[str]] = None


class MoveScorer:
    """
    Scores moves on a 0-10 scale with detailed breakdown.
    
    The scoring system considers:
    - Threats created (40% weight, max 4 points)
    - Threats blocked (30% weight, max 3 points)
    - Position quality (15% weight, max 1.5 points)
    - Board evaluation change (15% weight, max 1.5 points)
    
    Requirements:
    - 2.1: 0-10 scale scoring
    - 2.2: Multi-factor scoring
    - 2.3: Classification thresholds
    - 2.4: Delta calculation
    - 2.5: Score breakdown
    """
    
    # Score component weights (total = 10)
    THREAT_CREATED_WEIGHT = 4.0    # Max 4 points
    THREAT_BLOCKED_WEIGHT = 3.0    # Max 3 points
    POSITION_WEIGHT = 1.5          # Max 1.5 points
    EVAL_CHANGE_WEIGHT = 1.5       # Max 1.5 points
    
    # Threat score normalization factors
    MAX_THREAT_SCORE = 10000  # OPEN_FOUR level
    MAX_BLOCK_SCORE = 10000
    
    def __init__(self, board_size: int = BOARD_SIZE, vcf_max_depth: int = 3):
        """
        Initialize the MoveScorer.
        
        Args:
            board_size: Size of the board (default 15x15)
            vcf_max_depth: Max depth for VCF detection (default 3 for BASIC tier)
        """
        self.board_size = board_size
        self.threat_detector = ThreatDetector(board_size)
        self.vcf_detector = VCFDetector(board_size, max_depth=vcf_max_depth)
    
    def score_move(
        self,
        board: List[List[Optional[str]]],
        move: Tuple[int, int],
        player: str,
        best_move: Optional[Tuple[int, int]] = None,
        check_vcf: bool = True
    ) -> MoveScoreBreakdown:
        """
        Score a move on the 0-10 scale with detailed breakdown.
        
        Args:
            board: 2D array representing the board state (before move)
            move: The move to score (row, col)
            player: The player making the move
            best_move: Optional best move for delta calculation
            check_vcf: Whether to check for VCF (default True)
            
        Returns:
            MoveScoreBreakdown with detailed scoring
            
        Requirements: 2.1, 2.2, 2.5, 16.3, 16.4, 16.5
        """
        row, col = move
        opponent = "O" if player == "X" else "X"
        
        # VCF detection (Requirements 16.3, 16.4, 16.5)
        found_vcf = False
        missed_vcf = False
        vcf_sequence: Optional[List[str]] = None
        
        if check_vcf:
            # Check if there was a VCF before the move
            vcf_before = self.vcf_detector.detect_vcf(board, player)
            
            if vcf_before.has_vcf:
                # Check if this move leads to a win
                # Apply the move and check if it creates FIVE or maintains VCF
                test_board = [r[:] for r in board]
                test_board[row][col] = player
                
                # Check if this move creates FIVE (immediate win)
                threats_after = self.threat_detector.detect_all_threats(test_board, player)
                creates_five = threats_after.threats.get(ThreatType.FIVE, 0) > 0
                
                if creates_five:
                    # Player found a winning move! (Requirement 16.4)
                    found_vcf = True
                    vcf_sequence = vcf_before.winning_sequence
                elif vcf_before.winning_positions:
                    # Check if this move is in the winning sequence
                    first_winning_move = vcf_before.winning_positions[0]
                    if (row, col) == first_winning_move:
                        # Player found the VCF! (Requirement 16.4)
                        found_vcf = True
                        vcf_sequence = vcf_before.winning_sequence
                    else:
                        # Player missed the VCF! (Requirement 16.3)
                        missed_vcf = True
                        vcf_sequence = vcf_before.winning_sequence
        
        # Get threats before move
        player_threats_before = self.threat_detector.detect_all_threats(board, player)
        opponent_threats_before = self.threat_detector.detect_all_threats(board, opponent)
        
        # Apply move
        new_board = [r[:] for r in board]
        new_board[row][col] = player
        
        # Get threats after move
        player_threats_after = self.threat_detector.detect_all_threats(new_board, player)
        opponent_threats_after = self.threat_detector.detect_all_threats(new_board, opponent)
        
        # Calculate component scores
        threats_created = player_threats_after.total_score - player_threats_before.total_score
        threats_blocked = opponent_threats_before.total_score - opponent_threats_after.total_score
        
        # Normalize to 0-1 range then scale
        threats_created_normalized = min(1.0, max(0, threats_created) / self.MAX_THREAT_SCORE)
        threats_blocked_normalized = min(1.0, max(0, threats_blocked) / self.MAX_BLOCK_SCORE)
        
        threats_created_score = threats_created_normalized * self.THREAT_CREATED_WEIGHT
        threats_blocked_score = threats_blocked_normalized * self.THREAT_BLOCKED_WEIGHT
        
        # Position score
        position_score = self._calculate_position_score(row, col)
        
        # Evaluation change score
        eval_before = player_threats_before.total_score - opponent_threats_before.total_score
        eval_after = player_threats_after.total_score - opponent_threats_after.total_score
        eval_change = eval_after - eval_before
        
        eval_change_normalized = min(1.0, max(0, eval_change) / self.MAX_THREAT_SCORE)
        evaluation_change_score = eval_change_normalized * self.EVAL_CHANGE_WEIGHT
        
        # Calculate raw score (sum of components)
        raw_score = (
            threats_created_score +
            threats_blocked_score +
            position_score +
            evaluation_change_score
        )
        
        # Calculate best move score if not provided
        if best_move is None:
            best_move_score = self._find_best_move_score(board, player)
        else:
            best_breakdown = self._score_move_raw(board, best_move, player)
            best_move_score = best_breakdown
        
        # Normalize final score to 0-10 range
        # If this is the best move, it gets 10
        # Otherwise, scale relative to best
        if best_move_score > 0:
            final_score = min(10.0, (raw_score / best_move_score) * 10.0)
        else:
            final_score = 5.0 if raw_score >= 0 else 0.0
        
        # VCF-based score adjustments (Requirements 16.3, 16.4)
        if found_vcf:
            # Found VCF = excellent move (score 10)
            final_score = 10.0
        elif missed_vcf:
            # Missed VCF = blunder (score 0-2)
            final_score = min(final_score, 2.0)
        
        # Ensure score is in valid range
        final_score = max(0.0, min(10.0, final_score))
        
        # Calculate delta
        delta = best_move_score - raw_score if best_move_score > raw_score else 0
        
        # Classify the move
        classification = self._classify_score(final_score)
        
        return MoveScoreBreakdown(
            final_score=round(final_score, 1),
            classification=classification,
            threats_created_score=round(threats_created_score, 2),
            threats_blocked_score=round(threats_blocked_score, 2),
            position_score=round(position_score, 2),
            evaluation_change_score=round(evaluation_change_score, 2),
            raw_score=round(raw_score, 2),
            best_move_score=round(best_move_score, 2),
            delta=round(delta, 2),
            found_vcf=found_vcf,
            missed_vcf=missed_vcf,
            vcf_sequence=vcf_sequence
        )
    
    def _score_move_raw(
        self,
        board: List[List[Optional[str]]],
        move: Tuple[int, int],
        player: str
    ) -> float:
        """Calculate raw score for a move without normalization."""
        row, col = move
        opponent = "O" if player == "X" else "X"
        
        player_threats_before = self.threat_detector.detect_all_threats(board, player)
        opponent_threats_before = self.threat_detector.detect_all_threats(board, opponent)
        
        new_board = [r[:] for r in board]
        new_board[row][col] = player
        
        player_threats_after = self.threat_detector.detect_all_threats(new_board, player)
        opponent_threats_after = self.threat_detector.detect_all_threats(new_board, opponent)
        
        threats_created = player_threats_after.total_score - player_threats_before.total_score
        threats_blocked = opponent_threats_before.total_score - opponent_threats_after.total_score
        
        threats_created_normalized = min(1.0, max(0, threats_created) / self.MAX_THREAT_SCORE)
        threats_blocked_normalized = min(1.0, max(0, threats_blocked) / self.MAX_BLOCK_SCORE)
        
        threats_created_score = threats_created_normalized * self.THREAT_CREATED_WEIGHT
        threats_blocked_score = threats_blocked_normalized * self.THREAT_BLOCKED_WEIGHT
        position_score = self._calculate_position_score(row, col)
        
        eval_before = player_threats_before.total_score - opponent_threats_before.total_score
        eval_after = player_threats_after.total_score - opponent_threats_after.total_score
        eval_change = eval_after - eval_before
        eval_change_normalized = min(1.0, max(0, eval_change) / self.MAX_THREAT_SCORE)
        evaluation_change_score = eval_change_normalized * self.EVAL_CHANGE_WEIGHT
        
        return (
            threats_created_score +
            threats_blocked_score +
            position_score +
            evaluation_change_score
        )
    
    def _find_best_move_score(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> float:
        """Find the score of the best possible move."""
        best_score = 0.0
        
        for row in range(self.board_size):
            for col in range(self.board_size):
                if board[row][col] is None:
                    score = self._score_move_raw(board, (row, col), player)
                    if score > best_score:
                        best_score = score
        
        return best_score
    
    def _calculate_position_score(self, row: int, col: int) -> float:
        """
        Calculate position score (0 to POSITION_WEIGHT).
        
        Center positions score higher.
        """
        center = self.board_size // 2
        distance = max(abs(row - center), abs(col - center))
        max_distance = center
        
        # Linear decrease from center
        normalized = 1.0 - (distance / max_distance)
        return normalized * self.POSITION_WEIGHT
    
    def _classify_score(self, score: float) -> MoveClassification:
        """
        Classify a 0-10 score into a category.
        
        Thresholds (Requirement 2.3):
        - EXCELLENT: >= 8.5
        - GOOD: >= 7.0
        - OKAY: >= 5.0
        - WEAK: >= 3.0
        - BLUNDER: < 3.0
        """
        if score >= SCORE_THRESHOLDS[MoveClassification.EXCELLENT]:
            return MoveClassification.EXCELLENT
        elif score >= SCORE_THRESHOLDS[MoveClassification.GOOD]:
            return MoveClassification.GOOD
        elif score >= SCORE_THRESHOLDS[MoveClassification.OKAY]:
            return MoveClassification.OKAY
        elif score >= SCORE_THRESHOLDS[MoveClassification.WEAK]:
            return MoveClassification.WEAK
        else:
            return MoveClassification.BLUNDER
    
    def score_move_simple(
        self,
        board: List[List[Optional[str]]],
        move: Tuple[int, int],
        player: str
    ) -> float:
        """
        Get simple 0-10 score for a move.
        
        Convenience method that returns just the final score.
        
        Args:
            board: Board state before move
            move: The move (row, col)
            player: Player making the move
            
        Returns:
            Float score 0-10
        """
        breakdown = self.score_move(board, move, player)
        return breakdown.final_score
    
    def classify_move(
        self,
        board: List[List[Optional[str]]],
        move: Tuple[int, int],
        player: str
    ) -> MoveClassification:
        """
        Get classification for a move.
        
        Args:
            board: Board state before move
            move: The move (row, col)
            player: Player making the move
            
        Returns:
            MoveClassification enum
        """
        breakdown = self.score_move(board, move, player)
        return breakdown.classification
    
    def get_score_explanation(
        self,
        breakdown: MoveScoreBreakdown,
        language: str = "vi"
    ) -> str:
        """
        Get human-readable explanation of the score.
        
        Args:
            breakdown: Score breakdown
            language: Language code (vi, en, zh, ja)
            
        Returns:
            Explanation string
        """
        explanations = {
            "vi": {
                MoveClassification.EXCELLENT: "Nước đi xuất sắc",
                MoveClassification.GOOD: "Nước đi tốt",
                MoveClassification.OKAY: "Nước đi chấp nhận được",
                MoveClassification.WEAK: "Nước đi yếu",
                MoveClassification.BLUNDER: "Sai lầm nghiêm trọng",
            },
            "en": {
                MoveClassification.EXCELLENT: "Excellent move",
                MoveClassification.GOOD: "Good move",
                MoveClassification.OKAY: "Acceptable move",
                MoveClassification.WEAK: "Weak move",
                MoveClassification.BLUNDER: "Blunder",
            },
            "zh": {
                MoveClassification.EXCELLENT: "精彩的一步",
                MoveClassification.GOOD: "好棋",
                MoveClassification.OKAY: "可以接受",
                MoveClassification.WEAK: "弱棋",
                MoveClassification.BLUNDER: "严重失误",
            },
            "ja": {
                MoveClassification.EXCELLENT: "素晴らしい手",
                MoveClassification.GOOD: "良い手",
                MoveClassification.OKAY: "まあまあの手",
                MoveClassification.WEAK: "弱い手",
                MoveClassification.BLUNDER: "大悪手",
            },
        }
        
        lang_dict = explanations.get(language, explanations["en"])
        base = lang_dict.get(breakdown.classification, "")
        
        return f"{base} ({breakdown.final_score}/10)"
