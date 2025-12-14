"""
AI Match Analysis System - Basic Mistake Analyzer

This module implements a simplified mistake analyzer for Basic tier.
Only detects 3 categories of mistakes:
- MISSED_WIN: Bỏ lỡ thắng (VCF)
- FAILED_BLOCK: Không chặn threat
- POOR_POSITION: Đi xa thế trận

Basic Analysis Realistic Plan - Phase 3: Mistake Analyzer Lite

Features:
- 3 simple mistake categories
- Vietnamese descriptions
- Educational tips
- Fast detection (<100ms per move)

NOT included (reserved for Pro tier):
- 10+ mistake categories
- LLM-powered explanations
- Deep strategic analysis
"""

from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass
from enum import Enum

from .types import (
    ThreatType,
    Move,
    BOARD_SIZE,
)
from .threat_detector import ThreatDetector
from .position_evaluator import PositionEvaluator


class BasicMistakeCategory(Enum):
    """
    Basic mistake categories for Basic tier.
    
    Only 3 categories - simple and clear:
    - MISSED_WIN: Had VCF but didn't play it
    - FAILED_BLOCK: Opponent had threat, didn't block
    - POOR_POSITION: Move far from action, score dropped
    """
    MISSED_WIN = "missed_win"
    FAILED_BLOCK = "failed_block"
    POOR_POSITION = "poor_position"


# Vietnamese labels
BASIC_CATEGORY_LABELS: Dict[BasicMistakeCategory, str] = {
    BasicMistakeCategory.MISSED_WIN: "Bỏ lỡ thắng",
    BasicMistakeCategory.FAILED_BLOCK: "Không chặn",
    BasicMistakeCategory.POOR_POSITION: "Vị trí kém",
}

# Vietnamese descriptions
BASIC_CATEGORY_DESCRIPTIONS: Dict[BasicMistakeCategory, str] = {
    BasicMistakeCategory.MISSED_WIN: "Có cơ hội thắng nhưng không tận dụng",
    BasicMistakeCategory.FAILED_BLOCK: "Đối thủ có đe dọa nguy hiểm nhưng không chặn",
    BasicMistakeCategory.POOR_POSITION: "Nước đi kém hiệu quả, xa vùng đang đánh",
}

# Educational tips
BASIC_TIPS: Dict[BasicMistakeCategory, List[str]] = {
    BasicMistakeCategory.MISSED_WIN: [
        "Luôn check xem có nước thắng ngay không trước khi đi.",
        "Khi có 4 quân liên tiếp với 1 đầu mở, đó là cơ hội thắng.",
        "Tìm chuỗi Tứ liên tiếp (VCF) để thắng chắc chắn.",
    ],
    BasicMistakeCategory.FAILED_BLOCK: [
        "Khi đối thủ có 3-4 quân liên tiếp, ưu tiên chặn.",
        "Đếm threat của đối thủ trước mỗi nước đi.",
        "Tứ Mở (4 quân 2 đầu mở) phải chặn ngay lập tức.",
    ],
    BasicMistakeCategory.POOR_POSITION: [
        "Ưu tiên đi gần vùng đang có quân.",
        "Tránh đi rìa bàn cờ khi không cần thiết.",
        "Mỗi nước đi nên tạo đe dọa hoặc cải thiện vị trí.",
    ],
}


@dataclass
class BasicMistake:
    """
    A basic mistake with simple categorization.
    
    Attributes:
        move: Move number
        player: Player who made the mistake
        position: Position of the actual move
        category: Category of the mistake
        severity: Severity level (critical, major, minor)
        description: Vietnamese description
        best_move: The better move
        tip: Educational tip
    """
    move: int
    player: str
    position: Tuple[int, int]
    category: BasicMistakeCategory
    severity: str
    description: str
    best_move: Tuple[int, int]
    tip: str


class BasicMistakeAnalyzer:
    """
    Simple mistake analyzer for Basic tier.
    
    Only detects 3 types of mistakes:
    1. MISSED_WIN - Had VCF but didn't play it
    2. FAILED_BLOCK - Opponent had threat, didn't block
    3. POOR_POSITION - Score dropped significantly
    
    Fast and simple - no complex analysis.
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize BasicMistakeAnalyzer.
        
        Args:
            board_size: Size of the board (default 15)
        """
        self.board_size = board_size
        self.threat_detector = ThreatDetector(board_size)
        self.position_evaluator = PositionEvaluator(self.threat_detector, board_size)
        
        # Optional VCF search (import if available)
        self._vcf_searcher = None
        try:
            from .vcf_search import VCFSearch
            self._vcf_searcher = VCFSearch(board_size, max_depth=12)  # Depth 12 for Basic
        except ImportError:
            pass
    
    def analyze(
        self,
        board_before: List[List[Optional[str]]],
        actual_move: Move,
        best_move: Tuple[int, int],
        actual_score: float,
        best_score: float
    ) -> Optional[BasicMistake]:
        """
        Analyze a single move for mistakes.
        
        Checks in order:
        1. Missed win (VCF)
        2. Failed block
        3. Poor position
        
        Args:
            board_before: Board state before the move
            actual_move: The actual move played
            best_move: The best move
            actual_score: Score of actual move
            best_score: Score of best move
            
        Returns:
            BasicMistake if mistake detected, None otherwise
        """
        player = actual_move.player
        opponent = "O" if player == "X" else "X"
        
        # Skip if actual move is same as best move
        if actual_move.x == best_move[0] and actual_move.y == best_move[1]:
            return None
        
        # 1. Check for missed win (VCF)
        missed_win = self._check_missed_win(board_before, actual_move, player)
        if missed_win:
            return BasicMistake(
                move=getattr(actual_move, 'move_number', 0),
                player=player,
                position=(actual_move.x, actual_move.y),
                category=BasicMistakeCategory.MISSED_WIN,
                severity='critical',
                description=f"Bỏ lỡ thắng! Nên đi ({missed_win[0]},{missed_win[1]})",
                best_move=missed_win,
                tip=BASIC_TIPS[BasicMistakeCategory.MISSED_WIN][0]
            )
        
        # 2. Check for failed block
        failed_block = self._check_failed_block(board_before, actual_move, opponent)
        if failed_block:
            return BasicMistake(
                move=getattr(actual_move, 'move_number', 0),
                player=player,
                position=(actual_move.x, actual_move.y),
                category=BasicMistakeCategory.FAILED_BLOCK,
                severity='major',
                description=f"Cần chặn threat của đối thủ tại ({failed_block[0]},{failed_block[1]})",
                best_move=failed_block,
                tip=BASIC_TIPS[BasicMistakeCategory.FAILED_BLOCK][0]
            )
        
        # 3. Check for poor position (score drop)
        score_diff = best_score - actual_score
        if score_diff > 500:
            return BasicMistake(
                move=getattr(actual_move, 'move_number', 0),
                player=player,
                position=(actual_move.x, actual_move.y),
                category=BasicMistakeCategory.POOR_POSITION,
                severity='minor',
                description=f"Nước đi kém hiệu quả. ({best_move[0]},{best_move[1]}) tốt hơn.",
                best_move=best_move,
                tip=BASIC_TIPS[BasicMistakeCategory.POOR_POSITION][0]
            )
        
        return None
    
    def _check_missed_win(
        self,
        board: List[List[Optional[str]]],
        actual_move: Move,
        player: str
    ) -> Optional[Tuple[int, int]]:
        """
        Check if player missed a winning VCF.
        
        Args:
            board: Board state before move
            actual_move: The actual move played
            player: Player who moved
            
        Returns:
            Best winning move if VCF was missed, None otherwise
        """
        if not self._vcf_searcher:
            return None
        
        try:
            # Check if player had VCF
            vcf_result = self._vcf_searcher.search(board, player)
            
            if vcf_result.found and vcf_result.sequence:
                first_vcf_move = vcf_result.sequence[0]
                
                # Check if actual move is the VCF move
                if (first_vcf_move[0] != actual_move.x or
                    first_vcf_move[1] != actual_move.y):
                    # Missed the VCF!
                    return (first_vcf_move[0], first_vcf_move[1])
        except Exception:
            pass
        
        return None
    
    def _check_failed_block(
        self,
        board: List[List[Optional[str]]],
        actual_move: Move,
        opponent: str
    ) -> Optional[Tuple[int, int]]:
        """
        Check if player failed to block opponent's threat.
        
        Args:
            board: Board state before move
            actual_move: The actual move played
            opponent: Opponent player
            
        Returns:
            Blocking position if block was needed, None otherwise
        """
        opp_threats = self.threat_detector.detect_all_threats(board, opponent)
        
        # Check for OPEN_FOUR (must block!)
        if opp_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            block_pos = self._find_block_position(board, opp_threats, ThreatType.OPEN_FOUR)
            if block_pos and (block_pos[0] != actual_move.x or block_pos[1] != actual_move.y):
                return block_pos
        
        # Check for FOUR (should block)
        if opp_threats.threats.get(ThreatType.FOUR, 0) > 0:
            block_pos = self._find_block_position(board, opp_threats, ThreatType.FOUR)
            if block_pos and (block_pos[0] != actual_move.x or block_pos[1] != actual_move.y):
                return block_pos
        
        return None
    
    def _find_block_position(
        self,
        board: List[List[Optional[str]]],
        threats,
        threat_type: ThreatType
    ) -> Optional[Tuple[int, int]]:
        """Find position to block a specific threat type."""
        for threat in threats.threat_positions:
            if threat.type == threat_type:
                positions = sorted(threat.positions)
                if len(positions) >= 2:
                    dx = positions[1][0] - positions[0][0]
                    dy = positions[1][1] - positions[0][1]
                    if dx != 0:
                        dx = dx // abs(dx)
                    if dy != 0:
                        dy = dy // abs(dy)
                    
                    # Check both ends
                    before = (positions[0][0] - dx, positions[0][1] - dy)
                    after = (positions[-1][0] + dx, positions[-1][1] + dy)
                    
                    for pos in [before, after]:
                        if (0 <= pos[0] < self.board_size and
                            0 <= pos[1] < self.board_size and
                            board[pos[0]][pos[1]] is None):
                            return pos
        
        return None
    
    def get_tip_for_category(self, category: BasicMistakeCategory) -> str:
        """Get a random tip for a mistake category."""
        import random
        tips = BASIC_TIPS.get(category, ["Hãy suy nghĩ kỹ trước khi đi."])
        return random.choice(tips)
    
    def get_category_label(self, category: BasicMistakeCategory) -> str:
        """Get Vietnamese label for category."""
        return BASIC_CATEGORY_LABELS.get(category, "Sai lầm")
    
    def get_category_description(self, category: BasicMistakeCategory) -> str:
        """Get Vietnamese description for category."""
        return BASIC_CATEGORY_DESCRIPTIONS.get(category, "")
