"""
AI Match Analysis System - Alternative Lines Analysis

This module implements alternative lines analysis for Gomoku/Caro.
For each mistake, it shows:
- 3 best alternative moves
- Continuation (3-5 moves) after each alternative
- Comparison of outcomes: original vs alternatives

Task 8.6.3: Alternative Lines Analysis
Impact: "What if" analysis depth
"""

from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass, field

from .types import (
    Move,
    Mistake,
    AltLine,
    ThreatType,
    BOARD_SIZE,
)
from .threat_detector import ThreatDetector
from .position_evaluator import PositionEvaluator


@dataclass
class AlternativeMove:
    """
    Represents a single alternative move with its evaluation.
    
    Attributes:
        x: X coordinate of the move
        y: Y coordinate of the move
        score: Evaluation score of this move
        win_prob: Win probability after this move
        reason: Vietnamese explanation of why this is a good alternative
    """
    x: int
    y: int
    score: float
    win_prob: float
    reason: str


@dataclass
class Continuation:
    """
    Represents a continuation sequence after an alternative move.
    
    Attributes:
        moves: List of moves in the continuation (3-5 moves)
        final_score: Score at the end of the continuation
        final_win_prob: Win probability at the end
        description: Vietnamese description of the continuation
    """
    moves: List[Move] = field(default_factory=list)
    final_score: float = 0.0
    final_win_prob: float = 0.5
    description: str = ""


@dataclass
class AlternativeLine:
    """
    Complete alternative line analysis for a mistake.
    
    Attributes:
        mistake_move: Move number where the mistake occurred
        original_move: The original (bad) move that was played
        alternative: The alternative (better) move
        continuation: Continuation sequence after the alternative
        score_improvement: How much better the alternative is
        win_prob_improvement: Win probability improvement
        comparison: Vietnamese comparison of original vs alternative
    """
    mistake_move: int
    original_move: Move
    alternative: AlternativeMove
    continuation: Continuation
    score_improvement: float
    win_prob_improvement: float
    comparison: str


@dataclass
class AlternativeLinesResult:
    """
    Result of alternative lines analysis for all mistakes.
    
    Attributes:
        alternatives: Dict mapping mistake move number to list of alternatives
        summary: Vietnamese summary of the analysis
    """
    alternatives: Dict[int, List[AlternativeLine]] = field(default_factory=dict)
    summary: str = ""



class AlternativeLinesAnalyzer:
    """
    Analyzes alternative lines of play for mistakes in Gomoku/Caro games.
    
    For each mistake, this analyzer:
    1. Finds the 3 best alternative moves
    2. Generates continuation (3-5 moves) after each alternative
    3. Compares outcomes: original vs alternatives
    
    Task 8.6.3: Alternative Lines Analysis
    Impact: "What if" analysis depth
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize the AlternativeLinesAnalyzer.
        
        Args:
            board_size: Size of the board (default 15x15)
        """
        self.board_size = board_size
        self.threat_detector = ThreatDetector(board_size)
        self.position_evaluator = PositionEvaluator(self.threat_detector, board_size)
    
    def find_alternatives(
        self,
        board_before: List[List[Optional[str]]],
        player: str,
        actual_move: Tuple[int, int],
        top_n: int = 3
    ) -> List[AlternativeMove]:
        """
        Find the best alternative moves for a position.
        
        Args:
            board_before: Board state before the move
            player: Player to find moves for
            actual_move: The actual move that was played (to exclude)
            top_n: Number of alternatives to return (default 3)
            
        Returns:
            List of AlternativeMove objects, sorted by score descending
        """
        candidates = self._get_candidate_moves(board_before)
        
        # Exclude the actual move from candidates
        candidates = [c for c in candidates if c != actual_move]
        
        if not candidates:
            return []
        
        scored_moves: List[Tuple[int, int, float]] = []
        
        for x, y in candidates:
            score = self.position_evaluator.evaluate_move(board_before, x, y, player)
            scored_moves.append((x, y, score))
        
        # Sort by score descending
        scored_moves.sort(key=lambda m: m[2], reverse=True)
        
        # Take top N
        top_moves = scored_moves[:top_n]
        
        # Convert to AlternativeMove objects
        alternatives = []
        for x, y, score in top_moves:
            # Calculate win probability
            board_copy = [row[:] for row in board_before]
            board_copy[x][y] = player
            eval_result = self.position_evaluator.evaluate_position(board_copy, player)
            
            # Generate reason
            reason = self._generate_alternative_reason(board_before, x, y, player)
            
            alternatives.append(AlternativeMove(
                x=x,
                y=y,
                score=score,
                win_prob=eval_result.win_probability,
                reason=reason
            ))
        
        return alternatives
    
    def generate_continuation(
        self,
        board_before: List[List[Optional[str]]],
        alternative_move: AlternativeMove,
        player: str,
        depth: int = 4
    ) -> Continuation:
        """
        Generate a continuation sequence after an alternative move.
        
        This simulates optimal play from both sides for 3-5 moves
        to show what would happen after the alternative.
        
        Args:
            board_before: Board state before the alternative move
            alternative_move: The alternative move to start from
            player: Player who plays the alternative
            depth: Number of moves to generate (3-5)
            
        Returns:
            Continuation object with the move sequence
        """
        # Clamp depth to 3-5 range
        depth = max(3, min(5, depth))
        
        # Make a copy of the board
        board = [row[:] for row in board_before]
        
        # Apply the alternative move
        board[alternative_move.x][alternative_move.y] = player
        
        moves: List[Move] = [Move(
            x=alternative_move.x,
            y=alternative_move.y,
            player=player,
            move_number=1
        )]
        
        current_player = "O" if player == "X" else "X"
        
        # Generate continuation moves
        for i in range(depth - 1):
            # Find best move for current player
            best_move = self._find_best_move(board, current_player)
            
            if best_move is None:
                break
            
            x, y = best_move
            board[x][y] = current_player
            
            moves.append(Move(
                x=x,
                y=y,
                player=current_player,
                move_number=i + 2
            ))
            
            # Check if game is over
            if self._is_game_over(board):
                break
            
            # Switch player
            current_player = "O" if current_player == "X" else "X"
        
        # Evaluate final position
        eval_result = self.position_evaluator.evaluate_position(board, player)
        
        # Generate description
        description = self._generate_continuation_description(moves, player)
        
        return Continuation(
            moves=moves,
            final_score=eval_result.score,
            final_win_prob=eval_result.win_probability,
            description=description
        )
    
    def compare_outcomes(
        self,
        board_before: List[List[Optional[str]]],
        original_move: Move,
        alternative: AlternativeMove,
        continuation: Continuation
    ) -> str:
        """
        Compare outcomes between original move and alternative.
        
        Args:
            board_before: Board state before the move
            original_move: The original (bad) move
            alternative: The alternative (better) move
            continuation: Continuation after the alternative
            
        Returns:
            Vietnamese comparison string
        """
        player = original_move.player
        
        # Evaluate original move
        board_original = [row[:] for row in board_before]
        board_original[original_move.x][original_move.y] = player
        original_eval = self.position_evaluator.evaluate_position(board_original, player)
        
        # Calculate improvements
        score_diff = alternative.score - self.position_evaluator.evaluate_move(
            board_before, original_move.x, original_move.y, player
        )
        win_prob_diff = continuation.final_win_prob - original_eval.win_probability
        
        # Generate comparison text
        comparison_parts = []
        
        # Score comparison
        if score_diff > 0:
            comparison_parts.append(
                f"Nước thay thế ({alternative.x},{alternative.y}) tốt hơn {score_diff:.0f} điểm"
            )
        
        # Win probability comparison
        if win_prob_diff > 0:
            comparison_parts.append(
                f"Tăng xác suất thắng {win_prob_diff*100:.1f}%"
            )
        elif win_prob_diff < 0:
            comparison_parts.append(
                f"Giảm xác suất thắng {abs(win_prob_diff)*100:.1f}%"
            )
        
        # Continuation summary
        if continuation.moves:
            comparison_parts.append(
                f"Sau {len(continuation.moves)} nước: {continuation.description}"
            )
        
        return ". ".join(comparison_parts) if comparison_parts else "Nước thay thế tốt hơn"
    
    def analyze_mistake_alternatives(
        self,
        board_before: List[List[Optional[str]]],
        mistake: Mistake,
        original_move: Move,
        top_n: int = 3
    ) -> List[AlternativeLine]:
        """
        Analyze alternatives for a single mistake.
        
        This is the main entry point for analyzing a mistake.
        It finds alternatives, generates continuations, and compares outcomes.
        
        Args:
            board_before: Board state before the mistake
            mistake: The mistake object
            original_move: The original move that was played
            top_n: Number of alternatives to analyze (default 3)
            
        Returns:
            List of AlternativeLine objects
        """
        player = original_move.player
        actual_pos = (original_move.x, original_move.y)
        
        # Find alternatives
        alternatives = self.find_alternatives(board_before, player, actual_pos, top_n)
        
        if not alternatives:
            return []
        
        result: List[AlternativeLine] = []
        
        # Evaluate original move for comparison
        original_score = self.position_evaluator.evaluate_move(
            board_before, original_move.x, original_move.y, player
        )
        board_original = [row[:] for row in board_before]
        board_original[original_move.x][original_move.y] = player
        original_eval = self.position_evaluator.evaluate_position(board_original, player)
        
        for alt in alternatives:
            # Generate continuation
            continuation = self.generate_continuation(board_before, alt, player)
            
            # Compare outcomes
            comparison = self.compare_outcomes(
                board_before, original_move, alt, continuation
            )
            
            # Calculate improvements
            score_improvement = alt.score - original_score
            win_prob_improvement = continuation.final_win_prob - original_eval.win_probability
            
            result.append(AlternativeLine(
                mistake_move=mistake.move,
                original_move=original_move,
                alternative=alt,
                continuation=continuation,
                score_improvement=score_improvement,
                win_prob_improvement=win_prob_improvement,
                comparison=comparison
            ))
        
        return result

    
    def analyze_all_mistakes(
        self,
        moves: List[Move],
        mistakes: List[Mistake],
        top_n: int = 3
    ) -> AlternativeLinesResult:
        """
        Analyze alternatives for all mistakes in a game.
        
        Args:
            moves: List of all moves in the game
            mistakes: List of mistakes detected
            top_n: Number of alternatives per mistake (default 3)
            
        Returns:
            AlternativeLinesResult with all alternatives
        """
        result = AlternativeLinesResult()
        
        # Replay the game to get board states
        board = [[None for _ in range(self.board_size)] for _ in range(self.board_size)]
        
        for i, move in enumerate(moves):
            move_number = i + 1
            
            # Check if this move is a mistake
            mistake = next((m for m in mistakes if m.move == move_number), None)
            
            if mistake:
                # Analyze alternatives for this mistake
                alternatives = self.analyze_mistake_alternatives(
                    board, mistake, move, top_n
                )
                
                if alternatives:
                    result.alternatives[move_number] = alternatives
            
            # Apply the move to the board
            board[move.x][move.y] = move.player
        
        # Generate summary
        result.summary = self._generate_summary(result.alternatives)
        
        return result
    
    def _get_candidate_moves(
        self,
        board: List[List[Optional[str]]],
        limit: int = 15
    ) -> List[Tuple[int, int]]:
        """
        Get candidate moves (empty cells near existing pieces).
        
        Args:
            board: Current board state
            limit: Maximum number of candidates
            
        Returns:
            List of (x, y) positions
        """
        candidates = set()
        has_pieces = False
        
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] is not None:
                    has_pieces = True
                    # Add empty cells within 2 squares
                    for dx in range(-2, 3):
                        for dy in range(-2, 3):
                            nx, ny = x + dx, y + dy
                            if (0 <= nx < self.board_size and 
                                0 <= ny < self.board_size and
                                board[nx][ny] is None):
                                candidates.add((nx, ny))
        
        if not has_pieces:
            center = self.board_size // 2
            return [(center, center)]
        
        # Score candidates by position bonus
        scored = []
        for x, y in candidates:
            bonus = self.position_evaluator.position_bonus(x, y)
            scored.append((x, y, bonus))
        
        scored.sort(key=lambda c: c[2], reverse=True)
        return [(x, y) for x, y, _ in scored[:limit]]
    
    def _find_best_move(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> Optional[Tuple[int, int]]:
        """
        Find the best move for a player.
        
        Args:
            board: Current board state
            player: Player to find move for
            
        Returns:
            (x, y) of best move, or None if no moves available
        """
        candidates = self._get_candidate_moves(board)
        
        if not candidates:
            return None
        
        best_move = None
        best_score = float('-inf')
        
        for x, y in candidates:
            score = self.position_evaluator.evaluate_move(board, x, y, player)
            if score > best_score:
                best_score = score
                best_move = (x, y)
        
        return best_move
    
    def _is_game_over(self, board: List[List[Optional[str]]]) -> bool:
        """
        Check if the game is over.
        
        Args:
            board: Current board state
            
        Returns:
            True if game is over
        """
        # Check for winner
        for player in ["X", "O"]:
            threats = self.threat_detector.detect_all_threats(board, player)
            if threats.threats.get(ThreatType.FIVE, 0) > 0:
                return True
        
        # Check for full board
        for row in board:
            if None in row:
                return False
        return True
    
    def _generate_alternative_reason(
        self,
        board: List[List[Optional[str]]],
        x: int,
        y: int,
        player: str
    ) -> str:
        """
        Generate Vietnamese reason for why an alternative is good.
        
        Args:
            board: Board state before the move
            x, y: Position of the alternative
            player: Player making the move
            
        Returns:
            Vietnamese reason string
        """
        # Make the move and analyze threats
        board_copy = [row[:] for row in board]
        board_copy[x][y] = player
        
        threats = self.threat_detector.detect_all_threats(board_copy, player)
        
        # Check what threats are created
        if threats.threats.get(ThreatType.FIVE, 0) > 0:
            return "Thắng ngay lập tức"
        
        if threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            return "Tạo Tứ Mở - thắng chắc chắn"
        
        if threats.threats.get(ThreatType.FOUR, 0) > 0:
            return "Tạo Tứ - buộc đối thủ phải chặn"
        
        if threats.threats.get(ThreatType.OPEN_THREE, 0) > 0:
            return "Tạo Ba Mở - đe dọa mạnh"
        
        if threats.threats.get(ThreatType.THREE, 0) > 0:
            return "Tạo Ba - phát triển tốt"
        
        # Check position quality
        center = self.board_size // 2
        dist_from_center = abs(x - center) + abs(y - center)
        
        if dist_from_center <= 2:
            return "Vị trí trung tâm - kiểm soát tốt"
        
        if dist_from_center <= 4:
            return "Vị trí gần trung tâm - phát triển linh hoạt"
        
        # Check connectivity
        neighbors = 0
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                if dx == 0 and dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if (0 <= nx < self.board_size and 
                    0 <= ny < self.board_size and
                    board[nx][ny] == player):
                    neighbors += 1
        
        if neighbors >= 2:
            return "Kết nối tốt với quân khác"
        
        return "Vị trí chiến lược tốt"
    
    def _generate_continuation_description(
        self,
        moves: List[Move],
        original_player: str
    ) -> str:
        """
        Generate Vietnamese description of a continuation.
        
        Args:
            moves: List of moves in the continuation
            original_player: The player who started the continuation
            
        Returns:
            Vietnamese description string
        """
        if not moves:
            return "Không có nước tiếp theo"
        
        if len(moves) == 1:
            return f"Nước đi tại ({moves[0].x},{moves[0].y})"
        
        # Check if continuation leads to a win
        last_move = moves[-1]
        
        # Count moves by each player
        player_moves = sum(1 for m in moves if m.player == original_player)
        opponent_moves = len(moves) - player_moves
        
        if player_moves > opponent_moves:
            return f"Duy trì áp lực với {player_moves} nước tấn công"
        elif opponent_moves > player_moves:
            return f"Đối thủ phản công với {opponent_moves} nước"
        else:
            return f"Cân bằng sau {len(moves)} nước"
    
    def _generate_summary(
        self,
        alternatives: Dict[int, List[AlternativeLine]]
    ) -> str:
        """
        Generate Vietnamese summary of all alternatives.
        
        Args:
            alternatives: Dict of alternatives by move number
            
        Returns:
            Vietnamese summary string
        """
        if not alternatives:
            return "Không có sai lầm nào cần phân tích thay thế"
        
        total_mistakes = len(alternatives)
        total_alternatives = sum(len(alts) for alts in alternatives.values())
        
        # Calculate average improvement
        total_score_improvement = 0
        total_win_prob_improvement = 0
        count = 0
        
        for alts in alternatives.values():
            for alt in alts:
                total_score_improvement += alt.score_improvement
                total_win_prob_improvement += alt.win_prob_improvement
                count += 1
        
        if count > 0:
            avg_score_improvement = total_score_improvement / count
            avg_win_prob_improvement = total_win_prob_improvement / count
            
            return (
                f"Phân tích {total_alternatives} nước thay thế cho {total_mistakes} sai lầm. "
                f"Trung bình cải thiện {avg_score_improvement:.0f} điểm "
                f"và {avg_win_prob_improvement*100:.1f}% xác suất thắng."
            )
        
        return f"Phân tích {total_alternatives} nước thay thế cho {total_mistakes} sai lầm."


# Convenience functions

def find_alternatives(
    board: List[List[Optional[str]]],
    player: str,
    actual_move: Tuple[int, int],
    top_n: int = 3
) -> List[AlternativeMove]:
    """
    Convenience function to find alternatives for a position.
    
    Args:
        board: Board state before the move
        player: Player to find moves for
        actual_move: The actual move that was played
        top_n: Number of alternatives to return
        
    Returns:
        List of AlternativeMove objects
    """
    analyzer = AlternativeLinesAnalyzer()
    return analyzer.find_alternatives(board, player, actual_move, top_n)


def analyze_mistake_alternatives(
    board: List[List[Optional[str]]],
    mistake: Mistake,
    original_move: Move,
    top_n: int = 3
) -> List[AlternativeLine]:
    """
    Convenience function to analyze alternatives for a mistake.
    
    Args:
        board: Board state before the mistake
        mistake: The mistake object
        original_move: The original move that was played
        top_n: Number of alternatives to analyze
        
    Returns:
        List of AlternativeLine objects
    """
    analyzer = AlternativeLinesAnalyzer()
    return analyzer.analyze_mistake_alternatives(board, mistake, original_move, top_n)


def analyze_all_mistakes(
    moves: List[Move],
    mistakes: List[Mistake],
    top_n: int = 3
) -> AlternativeLinesResult:
    """
    Convenience function to analyze alternatives for all mistakes.
    
    Args:
        moves: List of all moves in the game
        mistakes: List of mistakes detected
        top_n: Number of alternatives per mistake
        
    Returns:
        AlternativeLinesResult with all alternatives
    """
    analyzer = AlternativeLinesAnalyzer()
    return analyzer.analyze_all_mistakes(moves, mistakes, top_n)
