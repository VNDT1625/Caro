"""
AI Match Analysis System - Mistake Analyzer

This module implements detailed mistake categorization for Gomoku/Caro analysis.
Mistakes are categorized into four types:
- Tactical: Bỏ lỡ threat (missed threat opportunity or failed to block)
- Positional: Vị trí kém (poor position choice)
- Strategic: Sai hướng (wrong direction/plan)
- Tempo: Chậm 1 nhịp (lost tempo, slow development)

Task 8.6.1: Detailed Mistake Categorization
Impact: Educational value tăng mạnh
"""

from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass
from enum import Enum

from .types import (
    ThreatType,
    ThreatResult,
    Move,
    Mistake,
    MoveClassification,
    BOARD_SIZE,
    THREAT_SCORES,
)
from .threat_detector import ThreatDetector
from .position_evaluator import PositionEvaluator


class MistakeCategory(Enum):
    """
    Categories of mistakes in Gomoku/Caro.
    
    Task 8.6.1: Detailed Mistake Categorization
    
    - TACTICAL: Bỏ lỡ threat - missed a winning threat or failed to block opponent's threat
    - POSITIONAL: Vị trí kém - chose a poor position (edge/corner when center was better)
    - STRATEGIC: Sai hướng - wrong direction, building in wrong area
    - TEMPO: Chậm 1 nhịp - lost tempo, made a slow/passive move when active play was needed
    """
    TACTICAL = "tactical"
    POSITIONAL = "positional"
    STRATEGIC = "strategic"
    TEMPO = "tempo"


# Vietnamese labels for mistake categories
MISTAKE_CATEGORY_LABELS: Dict[MistakeCategory, str] = {
    MistakeCategory.TACTICAL: "Chiến thuật",
    MistakeCategory.POSITIONAL: "Vị trí",
    MistakeCategory.STRATEGIC: "Chiến lược",
    MistakeCategory.TEMPO: "Nhịp độ",
}

# Vietnamese descriptions for mistake categories
MISTAKE_CATEGORY_DESCRIPTIONS: Dict[MistakeCategory, str] = {
    MistakeCategory.TACTICAL: "Bỏ lỡ cơ hội tấn công hoặc không chặn đe dọa của đối thủ",
    MistakeCategory.POSITIONAL: "Chọn vị trí kém, không tận dụng được lợi thế vị trí",
    MistakeCategory.STRATEGIC: "Sai hướng phát triển, xây dựng ở vùng không hiệu quả",
    MistakeCategory.TEMPO: "Chậm 1 nhịp, nước đi thụ động khi cần chủ động",
}


@dataclass
class CategorizedMistake:
    """
    A mistake with detailed categorization.
    
    Attributes:
        move: Move number where mistake occurred
        player: Player who made the mistake
        position: Position of the actual move
        category: Category of the mistake
        severity: Severity level (minor, major, critical)
        description: Vietnamese description of the mistake
        explanation: Detailed explanation of why it's a mistake
        best_alternative: The better move that should have been played
        best_alternative_reason: Why the alternative is better
        score_loss: How much score was lost by this mistake
        educational_tip: Learning tip for avoiding this mistake
    """
    move: int
    player: str
    position: Tuple[int, int]
    category: MistakeCategory
    severity: str
    description: str
    explanation: str
    best_alternative: Tuple[int, int]
    best_alternative_reason: str
    score_loss: float
    educational_tip: str


class MistakeAnalyzer:
    """
    Analyzes and categorizes mistakes in Gomoku/Caro games.
    
    This analyzer provides detailed categorization of mistakes to help
    players understand not just WHAT went wrong, but WHY and HOW to improve.
    
    Task 8.6.1: Detailed Mistake Categorization
    Impact: Educational value tăng mạnh
    
    Categories:
    - Tactical: Missed threats (offensive or defensive)
    - Positional: Poor position choice
    - Strategic: Wrong direction/plan
    - Tempo: Lost tempo, slow development
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize the MistakeAnalyzer.
        
        Args:
            board_size: Size of the board (default 15x15)
        """
        self.board_size = board_size
        self.threat_detector = ThreatDetector(board_size)
        self.position_evaluator = PositionEvaluator(self.threat_detector, board_size)
    
    def categorize_mistake(
        self,
        board_before: List[List[Optional[str]]],
        actual_move: Move,
        best_move: Tuple[int, int],
        actual_score: float,
        best_score: float
    ) -> CategorizedMistake:
        """
        Categorize a single mistake with detailed analysis.
        
        This is the main entry point for mistake categorization. It analyzes
        the position before the move, the actual move played, and the best
        alternative to determine the category and generate explanations.
        
        Args:
            board_before: Board state before the move
            actual_move: The actual move that was played
            best_move: The best move that should have been played
            actual_score: Score of the actual move
            best_score: Score of the best move
            
        Returns:
            CategorizedMistake with full analysis
        """
        player = actual_move.player
        opponent = "O" if player == "X" else "X"
        
        # Calculate score loss
        score_loss = best_score - actual_score
        
        # Determine severity based on score loss
        severity = self._determine_severity(score_loss, best_score)
        
        # Analyze threats before the move
        player_threats_before = self.threat_detector.detect_all_threats(board_before, player)
        opponent_threats_before = self.threat_detector.detect_all_threats(board_before, opponent)
        
        # Simulate best move to analyze what it would achieve
        board_with_best = [row[:] for row in board_before]
        board_with_best[best_move[0]][best_move[1]] = player
        player_threats_after_best = self.threat_detector.detect_all_threats(board_with_best, player)
        opponent_threats_after_best = self.threat_detector.detect_all_threats(board_with_best, opponent)
        
        # Simulate actual move
        board_with_actual = [row[:] for row in board_before]
        board_with_actual[actual_move.x][actual_move.y] = player
        player_threats_after_actual = self.threat_detector.detect_all_threats(board_with_actual, player)
        opponent_threats_after_actual = self.threat_detector.detect_all_threats(board_with_actual, opponent)
        
        # Categorize the mistake
        category = self._determine_category(
            board_before,
            actual_move,
            best_move,
            player_threats_before,
            opponent_threats_before,
            player_threats_after_best,
            opponent_threats_after_best,
            player_threats_after_actual,
            opponent_threats_after_actual
        )
        
        # Generate description and explanation
        description = self._generate_description(category, severity)
        explanation = self._generate_explanation(
            category,
            board_before,
            actual_move,
            best_move,
            player_threats_before,
            opponent_threats_before,
            player_threats_after_best
        )
        
        # Generate best alternative reason
        best_alternative_reason = self._generate_best_alternative_reason(
            category,
            best_move,
            player_threats_after_best,
            opponent_threats_after_best
        )
        
        # Generate educational tip
        educational_tip = self._generate_educational_tip(category)
        
        return CategorizedMistake(
            move=actual_move.move_number or 0,
            player=player,
            position=(actual_move.x, actual_move.y),
            category=category,
            severity=severity,
            description=description,
            explanation=explanation,
            best_alternative=best_move,
            best_alternative_reason=best_alternative_reason,
            score_loss=score_loss,
            educational_tip=educational_tip
        )

    
    def _determine_severity(self, score_loss: float, best_score: float) -> str:
        """
        Determine the severity of a mistake based on score loss.
        
        Severity levels:
        - critical: Lost a winning position or allowed opponent to win
        - major: Significant score loss (>30% of best score or >500 points)
        - minor: Small score loss (<30% of best score and <500 points)
        
        Args:
            score_loss: Difference between best score and actual score
            best_score: Score of the best move
            
        Returns:
            Severity string: "critical", "major", or "minor"
        """
        if best_score <= 0:
            # If best score is 0 or negative, use absolute thresholds
            if score_loss >= 1000:
                return "critical"
            elif score_loss >= 300:
                return "major"
            else:
                return "minor"
        
        # Calculate percentage loss
        percentage_loss = (score_loss / best_score) * 100 if best_score > 0 else 0
        
        # Critical: Lost winning position (OPEN_FOUR or better)
        if score_loss >= 5000 or percentage_loss >= 70:
            return "critical"
        
        # Major: Significant loss
        if score_loss >= 500 or percentage_loss >= 30:
            return "major"
        
        # Minor: Small loss
        return "minor"
    
    def _determine_category(
        self,
        board_before: List[List[Optional[str]]],
        actual_move: Move,
        best_move: Tuple[int, int],
        player_threats_before: ThreatResult,
        opponent_threats_before: ThreatResult,
        player_threats_after_best: ThreatResult,
        opponent_threats_after_best: ThreatResult,
        player_threats_after_actual: ThreatResult,
        opponent_threats_after_actual: ThreatResult
    ) -> MistakeCategory:
        """
        Determine the category of a mistake.
        
        Categories are determined by analyzing what the best move would have
        achieved vs what the actual move achieved:
        
        1. TACTICAL: Best move creates/blocks a significant threat
        2. POSITIONAL: Best move has better position value
        3. STRATEGIC: Best move develops in a better direction
        4. TEMPO: Best move maintains initiative, actual move is passive
        
        Args:
            board_before: Board state before the move
            actual_move: The actual move played
            best_move: The best move
            player_threats_before: Player's threats before move
            opponent_threats_before: Opponent's threats before move
            player_threats_after_best: Player's threats after best move
            opponent_threats_after_best: Opponent's threats after best move
            player_threats_after_actual: Player's threats after actual move
            opponent_threats_after_actual: Opponent's threats after actual move
            
        Returns:
            MistakeCategory enum value
        """
        player = actual_move.player
        
        # Check for TACTICAL mistake (missed threat)
        if self._is_tactical_mistake(
            player_threats_before,
            opponent_threats_before,
            player_threats_after_best,
            opponent_threats_after_best,
            player_threats_after_actual,
            opponent_threats_after_actual
        ):
            return MistakeCategory.TACTICAL
        
        # Check for POSITIONAL mistake (poor position)
        if self._is_positional_mistake(
            board_before,
            actual_move,
            best_move
        ):
            return MistakeCategory.POSITIONAL
        
        # Check for TEMPO mistake (lost initiative)
        if self._is_tempo_mistake(
            player_threats_before,
            opponent_threats_before,
            player_threats_after_best,
            player_threats_after_actual
        ):
            return MistakeCategory.TEMPO
        
        # Default to STRATEGIC (wrong direction)
        return MistakeCategory.STRATEGIC
    
    def _is_tactical_mistake(
        self,
        player_threats_before: ThreatResult,
        opponent_threats_before: ThreatResult,
        player_threats_after_best: ThreatResult,
        opponent_threats_after_best: ThreatResult,
        player_threats_after_actual: ThreatResult,
        opponent_threats_after_actual: ThreatResult
    ) -> bool:
        """
        Check if the mistake is tactical (missed threat).
        
        A tactical mistake occurs when:
        1. Best move would create a winning threat (OPEN_FOUR, FOUR)
        2. Best move would block opponent's winning threat
        3. Actual move fails to do either
        
        Args:
            Various threat results before and after moves
            
        Returns:
            True if this is a tactical mistake
        """
        # Check if best move creates a winning threat
        best_creates_open_four = (
            player_threats_after_best.threats.get(ThreatType.OPEN_FOUR, 0) >
            player_threats_after_actual.threats.get(ThreatType.OPEN_FOUR, 0)
        )
        
        best_creates_four = (
            player_threats_after_best.threats.get(ThreatType.FOUR, 0) >
            player_threats_after_actual.threats.get(ThreatType.FOUR, 0)
        )
        
        # Check if opponent had a threat that best move would block
        opponent_had_four = (
            opponent_threats_before.threats.get(ThreatType.FOUR, 0) > 0 or
            opponent_threats_before.threats.get(ThreatType.OPEN_FOUR, 0) > 0
        )
        
        best_blocks_threat = (
            opponent_threats_after_best.threats.get(ThreatType.FOUR, 0) <
            opponent_threats_after_actual.threats.get(ThreatType.FOUR, 0) or
            opponent_threats_after_best.threats.get(ThreatType.OPEN_FOUR, 0) <
            opponent_threats_after_actual.threats.get(ThreatType.OPEN_FOUR, 0)
        )
        
        # Check if opponent had OPEN_THREE that should be blocked
        opponent_had_open_three = (
            opponent_threats_before.threats.get(ThreatType.OPEN_THREE, 0) > 0
        )
        
        best_blocks_open_three = (
            opponent_threats_after_best.threats.get(ThreatType.OPEN_THREE, 0) <
            opponent_threats_after_actual.threats.get(ThreatType.OPEN_THREE, 0)
        )
        
        return (
            best_creates_open_four or
            best_creates_four or
            (opponent_had_four and best_blocks_threat) or
            (opponent_had_open_three and best_blocks_open_three)
        )
    
    def _is_positional_mistake(
        self,
        board_before: List[List[Optional[str]]],
        actual_move: Move,
        best_move: Tuple[int, int]
    ) -> bool:
        """
        Check if the mistake is positional (poor position choice).
        
        A positional mistake occurs when:
        1. Actual move is on edge/corner when center was available
        2. Actual move is far from existing pieces
        3. Best move has significantly better position bonus
        
        Args:
            board_before: Board state before the move
            actual_move: The actual move played
            best_move: The best move
            
        Returns:
            True if this is a positional mistake
        """
        # Calculate position bonuses
        actual_bonus = self.position_evaluator.position_bonus(actual_move.x, actual_move.y)
        best_bonus = self.position_evaluator.position_bonus(best_move[0], best_move[1])
        
        # Significant position difference
        if best_bonus - actual_bonus >= 5:
            return True
        
        # Check if actual move is on edge/corner while best is more central
        center = self.board_size // 2
        actual_dist_from_center = abs(actual_move.x - center) + abs(actual_move.y - center)
        best_dist_from_center = abs(best_move[0] - center) + abs(best_move[1] - center)
        
        # If actual move is much farther from center
        if actual_dist_from_center - best_dist_from_center >= 4:
            return True
        
        # Check if actual move is isolated (far from other pieces)
        actual_neighbors = self._count_neighbors(board_before, actual_move.x, actual_move.y)
        best_neighbors = self._count_neighbors(board_before, best_move[0], best_move[1])
        
        if best_neighbors - actual_neighbors >= 2:
            return True
        
        return False
    
    def _is_tempo_mistake(
        self,
        player_threats_before: ThreatResult,
        opponent_threats_before: ThreatResult,
        player_threats_after_best: ThreatResult,
        player_threats_after_actual: ThreatResult
    ) -> bool:
        """
        Check if the mistake is a tempo mistake (lost initiative).
        
        A tempo mistake occurs when:
        1. Best move creates threats that force opponent to respond
        2. Actual move is passive and doesn't create pressure
        3. Player loses the initiative
        
        Args:
            Various threat results
            
        Returns:
            True if this is a tempo mistake
        """
        # Best move creates more threats
        best_threat_score = player_threats_after_best.total_score
        actual_threat_score = player_threats_after_actual.total_score
        
        # Best move creates OPEN_THREE or better
        best_creates_pressure = (
            player_threats_after_best.threats.get(ThreatType.OPEN_THREE, 0) >
            player_threats_after_actual.threats.get(ThreatType.OPEN_THREE, 0)
        )
        
        # Actual move doesn't improve threat situation
        actual_is_passive = (
            actual_threat_score <= player_threats_before.total_score
        )
        
        # Significant threat score difference
        threat_score_diff = best_threat_score - actual_threat_score
        
        return (
            (best_creates_pressure and actual_is_passive) or
            (threat_score_diff >= 300 and actual_is_passive)
        )
    
    def _count_neighbors(
        self,
        board: List[List[Optional[str]]],
        x: int,
        y: int
    ) -> int:
        """Count the number of pieces adjacent to a position."""
        count = 0
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                if dx == 0 and dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if (0 <= nx < self.board_size and 
                    0 <= ny < self.board_size and
                    board[nx][ny] is not None):
                    count += 1
        return count

    
    def _generate_description(
        self,
        category: MistakeCategory,
        severity: str
    ) -> str:
        """
        Generate a Vietnamese description for the mistake.
        
        Args:
            category: Category of the mistake
            severity: Severity level
            
        Returns:
            Vietnamese description string
        """
        severity_labels = {
            "critical": "nghiêm trọng",
            "major": "lớn",
            "minor": "nhỏ"
        }
        
        category_labels = {
            MistakeCategory.TACTICAL: "Sai lầm chiến thuật",
            MistakeCategory.POSITIONAL: "Sai lầm vị trí",
            MistakeCategory.STRATEGIC: "Sai lầm chiến lược",
            MistakeCategory.TEMPO: "Mất nhịp"
        }
        
        severity_label = severity_labels.get(severity, "")
        category_label = category_labels.get(category, "Sai lầm")
        
        return f"{category_label} {severity_label}"
    
    def _generate_explanation(
        self,
        category: MistakeCategory,
        board_before: List[List[Optional[str]]],
        actual_move: Move,
        best_move: Tuple[int, int],
        player_threats_before: ThreatResult,
        opponent_threats_before: ThreatResult,
        player_threats_after_best: ThreatResult
    ) -> str:
        """
        Generate a detailed Vietnamese explanation for the mistake.
        
        Args:
            category: Category of the mistake
            board_before: Board state before the move
            actual_move: The actual move played
            best_move: The best move
            player_threats_before: Player's threats before move
            opponent_threats_before: Opponent's threats before move
            player_threats_after_best: Player's threats after best move
            
        Returns:
            Vietnamese explanation string
        """
        player = actual_move.player
        opponent = "O" if player == "X" else "X"
        
        if category == MistakeCategory.TACTICAL:
            # Check what tactical opportunity was missed
            if opponent_threats_before.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                return f"Đối thủ ({opponent}) có Tứ Mở cần chặn ngay. Nước đi ({actual_move.x},{actual_move.y}) không chặn được đe dọa này."
            
            if opponent_threats_before.threats.get(ThreatType.FOUR, 0) > 0:
                return f"Đối thủ ({opponent}) có Tứ cần chặn. Nước đi ({actual_move.x},{actual_move.y}) bỏ lỡ cơ hội phòng thủ."
            
            if player_threats_after_best.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                return f"Có thể tạo Tứ Mở tại ({best_move[0]},{best_move[1]}) nhưng đã chơi ({actual_move.x},{actual_move.y})."
            
            if player_threats_after_best.threats.get(ThreatType.FOUR, 0) > 0:
                return f"Có thể tạo Tứ tại ({best_move[0]},{best_move[1]}) nhưng đã chơi nước khác."
            
            if opponent_threats_before.threats.get(ThreatType.OPEN_THREE, 0) > 0:
                return f"Đối thủ có Ba Mở nguy hiểm. Nên chặn tại ({best_move[0]},{best_move[1]})."
            
            return f"Bỏ lỡ cơ hội tấn công hoặc phòng thủ quan trọng."
        
        elif category == MistakeCategory.POSITIONAL:
            center = self.board_size // 2
            actual_dist = abs(actual_move.x - center) + abs(actual_move.y - center)
            best_dist = abs(best_move[0] - center) + abs(best_move[1] - center)
            
            if actual_dist > best_dist + 3:
                return f"Nước đi ({actual_move.x},{actual_move.y}) quá xa trung tâm. Nên chơi gần trung tâm hơn tại ({best_move[0]},{best_move[1]})."
            
            actual_neighbors = self._count_neighbors(board_before, actual_move.x, actual_move.y)
            if actual_neighbors == 0:
                return f"Nước đi ({actual_move.x},{actual_move.y}) bị cô lập, không kết nối với quân khác."
            
            return f"Vị trí ({actual_move.x},{actual_move.y}) kém hiệu quả hơn ({best_move[0]},{best_move[1]})."
        
        elif category == MistakeCategory.STRATEGIC:
            return f"Nước đi ({actual_move.x},{actual_move.y}) phát triển sai hướng. Nên tập trung vào vùng ({best_move[0]},{best_move[1]}) để tạo áp lực tốt hơn."
        
        elif category == MistakeCategory.TEMPO:
            return f"Nước đi ({actual_move.x},{actual_move.y}) thụ động, mất quyền chủ động. Nên chơi ({best_move[0]},{best_move[1]}) để duy trì áp lực."
        
        return "Có nước đi tốt hơn."
    
    def _generate_best_alternative_reason(
        self,
        category: MistakeCategory,
        best_move: Tuple[int, int],
        player_threats_after_best: ThreatResult,
        opponent_threats_after_best: ThreatResult
    ) -> str:
        """
        Generate a reason why the best alternative is better.
        
        Args:
            category: Category of the mistake
            best_move: The best move
            player_threats_after_best: Player's threats after best move
            opponent_threats_after_best: Opponent's threats after best move
            
        Returns:
            Vietnamese reason string
        """
        if category == MistakeCategory.TACTICAL:
            if player_threats_after_best.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                return f"Tạo Tứ Mở - thắng chắc chắn"
            if player_threats_after_best.threats.get(ThreatType.FOUR, 0) > 0:
                return f"Tạo Tứ - buộc đối thủ phải chặn"
            if player_threats_after_best.threats.get(ThreatType.OPEN_THREE, 0) > 0:
                return f"Tạo Ba Mở - đe dọa mạnh"
            return "Chặn đe dọa của đối thủ"
        
        elif category == MistakeCategory.POSITIONAL:
            return f"Vị trí ({best_move[0]},{best_move[1]}) kiểm soát tốt hơn, gần trung tâm và kết nối với quân khác"
        
        elif category == MistakeCategory.STRATEGIC:
            return f"Phát triển đúng hướng, tạo tiềm năng tấn công tốt hơn"
        
        elif category == MistakeCategory.TEMPO:
            return f"Duy trì quyền chủ động, buộc đối thủ phải phản ứng"
        
        return "Nước đi tốt hơn về tổng thể"
    
    def _generate_educational_tip(self, category: MistakeCategory) -> str:
        """
        Generate an educational tip for avoiding this type of mistake.
        
        Args:
            category: Category of the mistake
            
        Returns:
            Vietnamese educational tip string
        """
        tips = {
            MistakeCategory.TACTICAL: (
                "Mẹo: Luôn kiểm tra đe dọa của đối thủ trước khi đi. "
                "Nếu đối thủ có Tứ hoặc Ba Mở, phải chặn ngay. "
                "Sau đó mới tìm cơ hội tấn công."
            ),
            MistakeCategory.POSITIONAL: (
                "Mẹo: Ưu tiên các vị trí gần trung tâm bàn cờ. "
                "Quân ở trung tâm có thể phát triển theo nhiều hướng. "
                "Tránh chơi ở góc hoặc cạnh khi không cần thiết."
            ),
            MistakeCategory.STRATEGIC: (
                "Mẹo: Tập trung quân vào một vùng để tạo áp lực. "
                "Không nên phân tán quân ra nhiều hướng. "
                "Xây dựng đe dọa theo một hướng chính."
            ),
            MistakeCategory.TEMPO: (
                "Mẹo: Mỗi nước đi nên tạo đe dọa hoặc cải thiện vị trí. "
                "Tránh các nước đi thụ động không tạo áp lực. "
                "Duy trì quyền chủ động để buộc đối thủ phản ứng."
            )
        }
        
        return tips.get(category, "Hãy suy nghĩ kỹ trước khi đi.")
    
    def analyze_mistakes(
        self,
        moves: List[Move],
        mistakes: List[Mistake]
    ) -> List[CategorizedMistake]:
        """
        Analyze and categorize all mistakes in a game.
        
        This method takes the original mistakes detected by BasicAnalyzer
        and adds detailed categorization to each one.
        
        Args:
            moves: List of all moves in the game
            mistakes: List of mistakes detected by BasicAnalyzer
            
        Returns:
            List of CategorizedMistake with detailed analysis
        """
        categorized: List[CategorizedMistake] = []
        
        # Replay the game to get board states
        board = [[None for _ in range(self.board_size)] for _ in range(self.board_size)]
        
        for i, move in enumerate(moves):
            move_number = i + 1
            
            # Check if this move is a mistake
            mistake = next((m for m in mistakes if m.move == move_number), None)
            
            if mistake:
                # Get best alternative
                best_alt = (mistake.best_alternative.get("x", 0), mistake.best_alternative.get("y", 0))
                
                # Calculate scores
                actual_score = self.position_evaluator.evaluate_move(
                    board, move.x, move.y, move.player
                )
                best_score = self.position_evaluator.evaluate_move(
                    board, best_alt[0], best_alt[1], move.player
                )
                
                # Create move object with move_number
                move_with_number = Move(
                    x=move.x,
                    y=move.y,
                    player=move.player,
                    move_number=move_number
                )
                
                # Categorize the mistake
                categorized_mistake = self.categorize_mistake(
                    board,
                    move_with_number,
                    best_alt,
                    actual_score,
                    best_score
                )
                
                categorized.append(categorized_mistake)
            
            # Apply the move to the board
            board[move.x][move.y] = move.player
        
        return categorized
    
    def get_category_statistics(
        self,
        categorized_mistakes: List[CategorizedMistake]
    ) -> Dict[MistakeCategory, Dict]:
        """
        Get statistics about mistake categories.
        
        Args:
            categorized_mistakes: List of categorized mistakes
            
        Returns:
            Dict with statistics per category
        """
        stats: Dict[MistakeCategory, Dict] = {}
        
        for category in MistakeCategory:
            category_mistakes = [m for m in categorized_mistakes if m.category == category]
            
            if category_mistakes:
                total_score_loss = sum(m.score_loss for m in category_mistakes)
                severity_counts = {
                    "critical": len([m for m in category_mistakes if m.severity == "critical"]),
                    "major": len([m for m in category_mistakes if m.severity == "major"]),
                    "minor": len([m for m in category_mistakes if m.severity == "minor"])
                }
                
                stats[category] = {
                    "count": len(category_mistakes),
                    "total_score_loss": total_score_loss,
                    "avg_score_loss": total_score_loss / len(category_mistakes),
                    "severity_counts": severity_counts,
                    "label": MISTAKE_CATEGORY_LABELS[category],
                    "description": MISTAKE_CATEGORY_DESCRIPTIONS[category]
                }
            else:
                stats[category] = {
                    "count": 0,
                    "total_score_loss": 0,
                    "avg_score_loss": 0,
                    "severity_counts": {"critical": 0, "major": 0, "minor": 0},
                    "label": MISTAKE_CATEGORY_LABELS[category],
                    "description": MISTAKE_CATEGORY_DESCRIPTIONS[category]
                }
        
        return stats


# Convenience functions

def categorize_mistake(
    board_before: List[List[Optional[str]]],
    actual_move: Move,
    best_move: Tuple[int, int],
    actual_score: float,
    best_score: float
) -> CategorizedMistake:
    """
    Convenience function to categorize a single mistake.
    
    Args:
        board_before: Board state before the move
        actual_move: The actual move that was played
        best_move: The best move that should have been played
        actual_score: Score of the actual move
        best_score: Score of the best move
        
    Returns:
        CategorizedMistake with full analysis
    """
    analyzer = MistakeAnalyzer()
    return analyzer.categorize_mistake(
        board_before, actual_move, best_move, actual_score, best_score
    )


def analyze_mistakes(
    moves: List[Move],
    mistakes: List[Mistake]
) -> List[CategorizedMistake]:
    """
    Convenience function to analyze all mistakes in a game.
    
    Args:
        moves: List of all moves in the game
        mistakes: List of mistakes detected by BasicAnalyzer
        
    Returns:
        List of CategorizedMistake with detailed analysis
    """
    analyzer = MistakeAnalyzer()
    return analyzer.analyze_mistakes(moves, mistakes)


def get_category_label(category: MistakeCategory) -> str:
    """Get the Vietnamese label for a mistake category."""
    return MISTAKE_CATEGORY_LABELS.get(category, "Không xác định")


def get_category_description(category: MistakeCategory) -> str:
    """Get the Vietnamese description for a mistake category."""
    return MISTAKE_CATEGORY_DESCRIPTIONS.get(category, "")
