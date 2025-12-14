"""
AI Match Analysis System - Basic Analysis Lite

This module provides a lightweight analysis interface using the
Basic Analysis Realistic Plan components.

Features:
- Fast analysis (<0.8s target)
- BasicSearch for move finding
- BasicVCFSearch for win detection
- BasicMistakeAnalyzer for mistake detection
- Tuned AdvancedEvaluator weights
- Game phase-based evaluation

Usage:
    from ai.analysis.basic_analysis_lite import analyze_game_lite, find_best_move_lite
    
    # Analyze a game
    result = analyze_game_lite(moves)
    
    # Find best move
    move, score = find_best_move_lite(board, player)
"""

import time
from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum

from .types import (
    Move,
    TimelineEntry,
    Mistake,
    Pattern,
    BestMove,
    Summary,
    AnalysisResult,
    MoveClassification,
    ThreatType,
    BOARD_SIZE,
)
from .threat_detector import ThreatDetector
from .position_evaluator import PositionEvaluator
from .basic_search import BasicSearch
from .basic_vcf_search import BasicVCFSearch
from .basic_mistake_analyzer import BasicMistakeAnalyzer, BasicMistakeCategory
from .advanced_evaluator import AdvancedEvaluator


class GamePhase(Enum):
    """Game phase for phase-based evaluation."""
    OPENING = "opening"
    MIDDLE = "middle"
    ENDGAME = "endgame"


def get_game_phase(move_count: int) -> GamePhase:
    """
    Determine game phase based on move count.
    
    Args:
        move_count: Number of moves played
        
    Returns:
        GamePhase enum
    """
    if move_count <= 10:
        return GamePhase.OPENING
    elif move_count <= 50:
        return GamePhase.MIDDLE
    else:
        return GamePhase.ENDGAME


def get_phase_weights(phase: GamePhase) -> Dict[str, float]:
    """
    Get evaluation weights for a game phase.
    
    Args:
        phase: Current game phase
        
    Returns:
        Dict of weight multipliers
    """
    if phase == GamePhase.OPENING:
        return {'territory': 1.2, 'threat': 0.8, 'shape': 1.0}
    elif phase == GamePhase.MIDDLE:
        return {'threat': 1.2, 'shape': 1.1, 'territory': 0.9}
    else:  # ENDGAME
        return {'threat': 1.5, 'tempo': 1.2, 'shape': 0.8}


@dataclass
class LiteAnalysisResult:
    """
    Lightweight analysis result.
    
    Attributes:
        timeline: Move-by-move evaluation
        mistakes: List of detected mistakes
        best_move: Recommended next move
        summary: Game summary
        duration_ms: Analysis time in milliseconds
    """
    timeline: List[Dict]
    mistakes: List[Dict]
    best_move: Optional[Dict]
    summary: Dict
    duration_ms: int


class BasicAnalysisLite:
    """
    Lightweight game analyzer using Basic Analysis Plan components.
    
    Optimized for:
    - Speed: <0.8s total analysis
    - Accuracy: 75% best move, 90% mistake detection
    - Simplicity: 3 mistake categories
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize BasicAnalysisLite.
        
        Args:
            board_size: Size of the board (default 15)
        """
        self.board_size = board_size
        self.threat_detector = ThreatDetector(board_size)
        self.position_evaluator = PositionEvaluator(self.threat_detector, board_size)
        self.advanced_evaluator = AdvancedEvaluator(
            self.threat_detector, self.position_evaluator, board_size
        )
        self.search = BasicSearch(board_size, max_depth=4, time_limit_ms=100)
        self.quick_search = BasicSearch(board_size, max_depth=2, time_limit_ms=20)  # For per-move analysis
        self.vcf_search = BasicVCFSearch(board_size, max_depth=10, time_limit_ms=100)  # Reduced
        self.mistake_analyzer = BasicMistakeAnalyzer(board_size)
    
    def analyze_game(self, moves: List[Move]) -> LiteAnalysisResult:
        """
        Analyze a complete game.
        
        Optimized for speed:
        - No per-move search (only threat-based evaluation)
        - Mistake detection only for significant score drops
        - Phase-based classification tolerance
        
        Args:
            moves: List of moves in the game
            
        Returns:
            LiteAnalysisResult with timeline, mistakes, and summary
        """
        start_time = time.time()
        
        board = [[None for _ in range(self.board_size)] for _ in range(self.board_size)]
        
        timeline: List[Dict] = []
        mistakes: List[Dict] = []
        prev_score = 0.0
        
        for i, move in enumerate(moves):
            move_number = i + 1
            player = move.player
            opponent = "O" if player == "X" else "X"
            phase = get_game_phase(move_number)
            
            # Get threats BEFORE move (for mistake detection)
            opp_threats_before = self.threat_detector.detect_all_threats(board, opponent)
            player_threats_before = self.threat_detector.detect_all_threats(board, player)
            
            # Make the move
            board[move.x][move.y] = player
            
            # Get threats AFTER move
            player_threats_after = self.threat_detector.detect_all_threats(board, player)
            opp_threats_after = self.threat_detector.detect_all_threats(board, opponent)
            
            # Calculate score based on threats (fast)
            score = player_threats_after.total_score - opp_threats_after.total_score * 0.9
            
            # Classify move based on threat changes
            category = self._classify_move_fast(
                player_threats_before, player_threats_after,
                opp_threats_before, opp_threats_after,
                phase, move_number
            )
            
            # Calculate win probability
            win_prob = min(0.95, max(0.05, 0.5 + score / 20000))
            
            # Generate note
            note = self._generate_note_fast(category, player_threats_after, opp_threats_before)
            
            # Add to timeline
            timeline.append({
                "move": move_number,
                "player": player,
                "position": {"x": move.x, "y": move.y},
                "score": score,
                "win_prob": win_prob,
                "category": category.value,
                "note": note
            })
            
            # Check for critical mistakes only (speed optimization)
            # Only check if opponent had dangerous threat and we didn't block
            if self._is_critical_mistake(opp_threats_before, opp_threats_after, player_threats_after):
                best_block = self._find_best_block(board, opp_threats_before, move, player)
                if best_block:
                    mistakes.append({
                        "move": move_number,
                        "category": "failed_block",
                        "severity": "critical",
                        "description": f"Không chặn threat! Nên đi ({best_block[0]},{best_block[1]})",
                        "best_alternative": {"x": best_block[0], "y": best_block[1]},
                        "tip": "Luôn kiểm tra threat của đối thủ trước khi đi."
                    })
            
            prev_score = score
        
        # Find best move for current position
        best_move = None
        if moves and not self._is_game_over(board):
            next_player = "O" if moves[-1].player == "X" else "X"
            
            # Check VCF first
            vcf_result = self.vcf_search.search(board, next_player)
            if vcf_result.found and vcf_result.sequence:
                first_move = vcf_result.sequence[0]
                best_move = {
                    "x": first_move[0],
                    "y": first_move[1],
                    "score": 10000.0,
                    "reason": f"VCF thắng trong {vcf_result.depth} nước!"
                }
            else:
                move_result, score = self.search.search(board, next_player)
                if move_result:
                    best_move = {
                        "x": move_result[0],
                        "y": move_result[1],
                        "score": score,
                        "reason": self._generate_move_reason(board, move_result, next_player)
                    }
        
        # Generate summary
        summary = self._generate_summary(timeline, mistakes, moves)
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        return LiteAnalysisResult(
            timeline=timeline,
            mistakes=mistakes,
            best_move=best_move,
            summary=summary,
            duration_ms=duration_ms
        )
    
    def find_best_move(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> Tuple[Optional[Tuple[int, int]], float]:
        """
        Find the best move for a position.
        
        Args:
            board: Current board state
            player: Player to move
            
        Returns:
            (best_move, score) tuple
        """
        # Check VCF first
        vcf_result = self.vcf_search.search(board, player)
        if vcf_result.found and vcf_result.sequence:
            return vcf_result.sequence[0], 10000.0
        
        # Use BasicSearch
        return self.search.search(board, player)
    
    def _classify_move_fast(
        self,
        player_threats_before,
        player_threats_after,
        opp_threats_before,
        opp_threats_after,
        phase: GamePhase,
        move_number: int
    ) -> MoveClassification:
        """
        Fast move classification based on threat changes.
        
        No search required - just compare threats before/after.
        """
        # Check if we created winning threat
        if player_threats_after.threats.get(ThreatType.FIVE, 0) > 0:
            return MoveClassification.EXCELLENT
        if player_threats_after.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            return MoveClassification.EXCELLENT
        
        # Check if we blocked opponent's winning threat
        opp_had_danger = (
            opp_threats_before.threats.get(ThreatType.OPEN_FOUR, 0) > 0 or
            opp_threats_before.threats.get(ThreatType.FOUR, 0) > 0
        )
        opp_still_danger = (
            opp_threats_after.threats.get(ThreatType.OPEN_FOUR, 0) > 0 or
            opp_threats_after.threats.get(ThreatType.FOUR, 0) > 0
        )
        
        if opp_had_danger and not opp_still_danger:
            return MoveClassification.GOOD  # Good defense
        
        if opp_had_danger and opp_still_danger:
            return MoveClassification.BLUNDER  # Failed to block!
        
        # Check threat improvement
        threat_improvement = player_threats_after.total_score - player_threats_before.total_score
        
        # Opening tolerance
        if phase == GamePhase.OPENING and move_number <= 8:
            if threat_improvement >= 0:
                return MoveClassification.GOOD
            return MoveClassification.OKAY
        
        # Normal classification
        if threat_improvement >= 500:
            return MoveClassification.EXCELLENT
        elif threat_improvement >= 100:
            return MoveClassification.GOOD
        elif threat_improvement >= -100:
            return MoveClassification.OKAY
        elif threat_improvement >= -500:
            return MoveClassification.WEAK
        else:
            return MoveClassification.BLUNDER
    
    def _generate_note_fast(
        self,
        category: MoveClassification,
        player_threats,
        opp_threats_before
    ) -> str:
        """Generate Vietnamese note based on threats."""
        # Check for specific situations
        if player_threats.threats.get(ThreatType.FIVE, 0) > 0:
            return "Thắng!"
        if player_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            return "Tạo Tứ Mở - thắng chắc chắn!"
        if player_threats.threats.get(ThreatType.FOUR, 0) > 0:
            return "Tạo Tứ - đe dọa mạnh."
        if player_threats.threats.get(ThreatType.OPEN_THREE, 0) > 0:
            return "Tạo Ba Mở - tấn công tốt."
        
        # Check if was defensive
        if (opp_threats_before.threats.get(ThreatType.FOUR, 0) > 0 or
            opp_threats_before.threats.get(ThreatType.OPEN_FOUR, 0) > 0):
            if category in [MoveClassification.EXCELLENT, MoveClassification.GOOD]:
                return "Phòng thủ tốt."
            else:
                return "Không chặn được threat!"
        
        notes = {
            MoveClassification.EXCELLENT: "Nước đi xuất sắc!",
            MoveClassification.GOOD: "Nước đi tốt.",
            MoveClassification.OKAY: "Nước đi chấp nhận được.",
            MoveClassification.WEAK: "Nước đi yếu.",
            MoveClassification.BLUNDER: "Sai lầm!",
        }
        return notes.get(category, "")
    
    def _is_critical_mistake(self, opp_before, opp_after, player_after) -> bool:
        """Check if move was a critical mistake (failed to block)."""
        # If we won, not a mistake
        if player_after.threats.get(ThreatType.FIVE, 0) > 0:
            return False
        
        # If opponent had OPEN_FOUR and still has it
        if (opp_before.threats.get(ThreatType.OPEN_FOUR, 0) > 0 and
            opp_after.threats.get(ThreatType.OPEN_FOUR, 0) > 0):
            return True
        
        # If opponent had FOUR and still has it (and we didn't create bigger threat)
        if (opp_before.threats.get(ThreatType.FOUR, 0) > 0 and
            opp_after.threats.get(ThreatType.FOUR, 0) > 0 and
            player_after.threats.get(ThreatType.OPEN_FOUR, 0) == 0):
            return True
        
        return False
    
    def _find_best_block(self, board, opp_threats, actual_move, player) -> Optional[Tuple[int, int]]:
        """Find the position that should have blocked opponent's threat."""
        # Undo move
        board[actual_move.x][actual_move.y] = None
        
        # Find blocking position from threat positions
        for threat in opp_threats.threat_positions:
            if threat.type in [ThreatType.FOUR, ThreatType.OPEN_FOUR]:
                positions = sorted(threat.positions)
                if len(positions) >= 2:
                    dx = positions[1][0] - positions[0][0]
                    dy = positions[1][1] - positions[0][1]
                    if dx != 0:
                        dx = dx // abs(dx)
                    if dy != 0:
                        dy = dy // abs(dy)
                    
                    # Check both ends
                    for pos in [(positions[0][0] - dx, positions[0][1] - dy),
                               (positions[-1][0] + dx, positions[-1][1] + dy)]:
                        if (0 <= pos[0] < self.board_size and
                            0 <= pos[1] < self.board_size and
                            board[pos[0]][pos[1]] is None):
                            # Redo move
                            board[actual_move.x][actual_move.y] = player
                            return pos
        
        # Redo move
        board[actual_move.x][actual_move.y] = player
        return None
    
    def _generate_move_reason(
        self,
        board: List[List[Optional[str]]],
        move: Tuple[int, int],
        player: str
    ) -> str:
        """Generate reason for best move."""
        board[move[0]][move[1]] = player
        threats = self.threat_detector.detect_all_threats(board, player)
        board[move[0]][move[1]] = None
        
        if threats.threats.get(ThreatType.FIVE, 0) > 0:
            return "Thắng ngay!"
        if threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            return "Tạo Tứ Mở - thắng chắc chắn"
        if threats.threats.get(ThreatType.FOUR, 0) > 0:
            return "Tạo Tứ - buộc đối thủ chặn"
        if threats.threats.get(ThreatType.OPEN_THREE, 0) > 0:
            return "Tạo Ba Mở - đe dọa mạnh"
        
        return "Vị trí tốt nhất"
    
    def _generate_summary(
        self,
        timeline: List[Dict],
        mistakes: List[Dict],
        moves: List[Move]
    ) -> Dict:
        """Generate game summary."""
        x_moves = [t for t in timeline if t["player"] == "X"]
        o_moves = [t for t in timeline if t["player"] == "O"]
        
        x_mistakes = [m for m in mistakes if timeline[m["move"]-1]["player"] == "X"]
        o_mistakes = [m for m in mistakes if timeline[m["move"]-1]["player"] == "O"]
        
        return {
            "total_moves": len(moves),
            "x_accuracy": self._calculate_accuracy(x_moves),
            "o_accuracy": self._calculate_accuracy(o_moves),
            "x_mistakes": len(x_mistakes),
            "o_mistakes": len(o_mistakes),
            "critical_mistakes": len([m for m in mistakes if m["severity"] == "critical"]),
        }
    
    def _calculate_accuracy(self, moves: List[Dict]) -> float:
        """Calculate accuracy percentage."""
        if not moves:
            return 100.0
        
        good_moves = sum(1 for m in moves if m["category"] in ["excellent", "good"])
        return round(good_moves / len(moves) * 100, 1)
    
    def _is_game_over(self, board: List[List[Optional[str]]]) -> bool:
        """Check if game is over."""
        for player in ["X", "O"]:
            threats = self.threat_detector.detect_all_threats(board, player)
            if threats.threats.get(ThreatType.FIVE, 0) > 0:
                return True
        return False


# Convenience functions
def analyze_game_lite(moves: List[Move]) -> LiteAnalysisResult:
    """
    Analyze a game using Basic Analysis Lite.
    
    Args:
        moves: List of moves
        
    Returns:
        LiteAnalysisResult
    """
    analyzer = BasicAnalysisLite()
    return analyzer.analyze_game(moves)


def find_best_move_lite(
    board: List[List[Optional[str]]],
    player: str
) -> Tuple[Optional[Tuple[int, int]], float]:
    """
    Find best move using Basic Analysis Lite.
    
    Args:
        board: Current board state
        player: Player to move
        
    Returns:
        (best_move, score) tuple
    """
    analyzer = BasicAnalysisLite()
    return analyzer.find_best_move(board, player)
