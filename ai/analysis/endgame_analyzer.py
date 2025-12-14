"""
AI Match Analysis System - Endgame Analyzer

This module implements endgame detection and analysis for Gomoku/Caro.
Endgame detection is crucial for switching to exact solving algorithms
when the game reaches a critical phase.

Task 8.5.1: Endgame Detection
Impact: Switch to exact solving in endgame

Endgame conditions:
1. VCF exists for either player (forcing win sequence)
2. Few empty cells remaining (< 30% of board)
3. Many high-value threats present (FOUR, OPEN_FOUR, OPEN_THREE)
4. Critical position where next move determines outcome
"""

from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass
from enum import Enum

from .types import ThreatType, ThreatResult, BOARD_SIZE, THREAT_SCORES
from .threat_detector import ThreatDetector
from .vcf_search import VCFSearch, VCFResult
from .vct_search import VCTSearch, VCTResult


class EndgameType(Enum):
    """
    Types of endgame positions.
    
    - NOT_ENDGAME: Game is still in opening/midgame
    - VCF_ENDGAME: One player has VCF (forcing win)
    - VCT_ENDGAME: One player has VCT (complex forcing sequence)
    - THREAT_ENDGAME: Many high threats, critical position
    - SPACE_ENDGAME: Few empty cells remaining
    - CRITICAL_ENDGAME: Multiple endgame conditions met
    """
    NOT_ENDGAME = "not_endgame"
    VCF_ENDGAME = "vcf_endgame"
    VCT_ENDGAME = "vct_endgame"
    THREAT_ENDGAME = "threat_endgame"
    SPACE_ENDGAME = "space_endgame"
    CRITICAL_ENDGAME = "critical_endgame"


@dataclass
class EndgameResult:
    """
    Result of endgame detection.
    
    Attributes:
        is_endgame: Whether the position is an endgame
        endgame_type: Type of endgame detected
        vcf_player: Player with VCF (if any)
        vcf_result: VCF search result (if VCF exists)
        vct_player: Player with VCT (if any)
        vct_result: VCT search result (if VCT exists)
        empty_cells: Number of empty cells on the board
        empty_ratio: Ratio of empty cells (0-1)
        high_threat_count: Number of high-value threats
        threat_score_x: Total threat score for X
        threat_score_o: Total threat score for O
        urgency: Urgency level (0-100, higher = more urgent)
        recommended_action: Suggested action for the position
    """
    is_endgame: bool
    endgame_type: EndgameType
    vcf_player: Optional[str] = None
    vcf_result: Optional[VCFResult] = None
    vct_player: Optional[str] = None
    vct_result: Optional[VCTResult] = None
    empty_cells: int = 0
    empty_ratio: float = 1.0
    high_threat_count: int = 0
    threat_score_x: int = 0
    threat_score_o: int = 0
    urgency: int = 0
    recommended_action: str = ""


class EndgameAnalyzer:
    """
    Analyzes board positions to detect endgame conditions.
    
    Endgame detection is important because:
    1. Endgame positions often have forced sequences (VCF/VCT)
    2. Exact solving is possible and preferred in endgame
    3. Different evaluation strategies apply in endgame
    4. Time management should prioritize endgame analysis
    
    Detection criteria:
    - VCF exists: Immediate forcing win sequence
    - VCT exists: Complex forcing win sequence
    - Few empty cells: < 30% of board empty
    - High threats: Multiple FOUR/OPEN_FOUR/OPEN_THREE threats
    """
    
    # Thresholds for endgame detection
    EMPTY_RATIO_THRESHOLD = 0.30  # < 30% empty = space endgame
    HIGH_THREAT_THRESHOLD = 3     # >= 3 high threats = threat endgame
    THREAT_SCORE_THRESHOLD = 2000 # Combined threat score threshold
    
    # High-value threat types
    HIGH_THREAT_TYPES = {
        ThreatType.FIVE,
        ThreatType.OPEN_FOUR,
        ThreatType.FOUR,
        ThreatType.OPEN_THREE,
    }
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize the EndgameAnalyzer.
        
        Args:
            board_size: Size of the board (default 15x15)
        """
        self.board_size = board_size
        self.threat_detector = ThreatDetector(board_size)
        self.vcf_searcher = VCFSearch(board_size, max_depth=20)
        self.vct_searcher = VCTSearch(board_size, max_depth=16)
    
    def detect_endgame(
        self,
        board: List[List[Optional[str]]],
        check_vcf: bool = True,
        check_vct: bool = False
    ) -> EndgameResult:
        """
        Detect if the current position is an endgame.
        
        This is the main entry point for endgame detection. It checks
        multiple conditions to determine if the game has reached an
        endgame phase.
        
        Args:
            board: Current board state (2D array, None/"X"/"O")
            check_vcf: Whether to check for VCF (default True)
            check_vct: Whether to check for VCT (default False, slower)
            
        Returns:
            EndgameResult with detection details
        """
        # Count empty cells
        empty_cells = self._count_empty_cells(board)
        total_cells = self.board_size * self.board_size
        empty_ratio = empty_cells / total_cells
        
        # Detect threats for both players
        threats_x = self.threat_detector.detect_all_threats(board, 'X')
        threats_o = self.threat_detector.detect_all_threats(board, 'O')
        
        # Count high-value threats
        high_threat_count = self._count_high_threats(threats_x, threats_o)
        
        # Initialize result
        result = EndgameResult(
            is_endgame=False,
            endgame_type=EndgameType.NOT_ENDGAME,
            empty_cells=empty_cells,
            empty_ratio=empty_ratio,
            high_threat_count=high_threat_count,
            threat_score_x=threats_x.total_score,
            threat_score_o=threats_o.total_score
        )
        
        # Check for immediate win (FIVE)
        if threats_x.threats.get(ThreatType.FIVE, 0) > 0:
            result.is_endgame = True
            result.endgame_type = EndgameType.CRITICAL_ENDGAME
            result.urgency = 100
            result.recommended_action = "Game over - X wins"
            return result
        
        if threats_o.threats.get(ThreatType.FIVE, 0) > 0:
            result.is_endgame = True
            result.endgame_type = EndgameType.CRITICAL_ENDGAME
            result.urgency = 100
            result.recommended_action = "Game over - O wins"
            return result
        
        # Check for VCF
        vcf_x = None
        vcf_o = None
        if check_vcf:
            vcf_x = self.vcf_searcher.search(board, 'X')
            vcf_o = self.vcf_searcher.search(board, 'O')
            
            if vcf_x.found:
                result.is_endgame = True
                result.endgame_type = EndgameType.VCF_ENDGAME
                result.vcf_player = 'X'
                result.vcf_result = vcf_x
                result.urgency = 95
                result.recommended_action = f"X has VCF in {vcf_x.depth} moves"
                return result
            
            if vcf_o.found:
                result.is_endgame = True
                result.endgame_type = EndgameType.VCF_ENDGAME
                result.vcf_player = 'O'
                result.vcf_result = vcf_o
                result.urgency = 95
                result.recommended_action = f"O has VCF in {vcf_o.depth} moves"
                return result
        
        # Check for VCT (slower, optional)
        if check_vct:
            vct_x = self.vct_searcher.search(board, 'X')
            vct_o = self.vct_searcher.search(board, 'O')
            
            if vct_x.found:
                result.is_endgame = True
                result.endgame_type = EndgameType.VCT_ENDGAME
                result.vct_player = 'X'
                result.vct_result = vct_x
                result.urgency = 85
                result.recommended_action = f"X has VCT in {vct_x.depth} moves"
                return result
            
            if vct_o.found:
                result.is_endgame = True
                result.endgame_type = EndgameType.VCT_ENDGAME
                result.vct_player = 'O'
                result.vct_result = vct_o
                result.urgency = 85
                result.recommended_action = f"O has VCT in {vct_o.depth} moves"
                return result
        
        # Check for space endgame (few empty cells)
        if empty_ratio < self.EMPTY_RATIO_THRESHOLD:
            result.is_endgame = True
            result.endgame_type = EndgameType.SPACE_ENDGAME
            result.urgency = int((1 - empty_ratio) * 70)
            result.recommended_action = f"Space endgame - {empty_cells} cells remaining"
            return result
        
        # Check for threat endgame (many high threats)
        if high_threat_count >= self.HIGH_THREAT_THRESHOLD:
            result.is_endgame = True
            result.endgame_type = EndgameType.THREAT_ENDGAME
            result.urgency = min(80, high_threat_count * 15)
            result.recommended_action = f"Threat endgame - {high_threat_count} high threats"
            return result
        
        # Check combined threat score
        combined_score = threats_x.total_score + threats_o.total_score
        if combined_score >= self.THREAT_SCORE_THRESHOLD:
            result.is_endgame = True
            result.endgame_type = EndgameType.THREAT_ENDGAME
            result.urgency = min(75, combined_score // 50)
            result.recommended_action = f"High threat density - score {combined_score}"
            return result
        
        # Not an endgame
        result.recommended_action = "Continue normal play"
        return result
    
    def is_endgame(
        self,
        board: List[List[Optional[str]]],
        quick_check: bool = True
    ) -> bool:
        """
        Quick check if position is an endgame.
        
        This is a faster version of detect_endgame that only returns
        a boolean. Use this when you don't need detailed information.
        
        Args:
            board: Current board state
            quick_check: If True, skip VCF/VCT search for speed
            
        Returns:
            True if position is an endgame
        """
        # Count empty cells
        empty_cells = self._count_empty_cells(board)
        total_cells = self.board_size * self.board_size
        empty_ratio = empty_cells / total_cells
        
        # Quick space check
        if empty_ratio < self.EMPTY_RATIO_THRESHOLD:
            return True
        
        # Detect threats
        threats_x = self.threat_detector.detect_all_threats(board, 'X')
        threats_o = self.threat_detector.detect_all_threats(board, 'O')
        
        # Check for immediate win
        if (threats_x.threats.get(ThreatType.FIVE, 0) > 0 or
            threats_o.threats.get(ThreatType.FIVE, 0) > 0):
            return True
        
        # Check for OPEN_FOUR (immediate win threat)
        if (threats_x.threats.get(ThreatType.OPEN_FOUR, 0) > 0 or
            threats_o.threats.get(ThreatType.OPEN_FOUR, 0) > 0):
            return True
        
        # Count high threats
        high_threat_count = self._count_high_threats(threats_x, threats_o)
        if high_threat_count >= self.HIGH_THREAT_THRESHOLD:
            return True
        
        # Check combined threat score
        combined_score = threats_x.total_score + threats_o.total_score
        if combined_score >= self.THREAT_SCORE_THRESHOLD:
            return True
        
        # Full VCF check if not quick
        if not quick_check:
            vcf_x = self.vcf_searcher.search(board, 'X')
            if vcf_x.found:
                return True
            
            vcf_o = self.vcf_searcher.search(board, 'O')
            if vcf_o.found:
                return True
        
        return False
    
    def get_endgame_urgency(
        self,
        board: List[List[Optional[str]]]
    ) -> int:
        """
        Get the urgency level of the current position.
        
        Urgency indicates how critical the position is:
        - 0-30: Normal play, no immediate concerns
        - 31-60: Developing threats, be careful
        - 61-80: Critical threats, must respond
        - 81-95: Forcing sequences exist
        - 96-100: Game-deciding position
        
        Args:
            board: Current board state
            
        Returns:
            Urgency level (0-100)
        """
        result = self.detect_endgame(board, check_vcf=True, check_vct=False)
        return result.urgency
    
    def _count_empty_cells(self, board: List[List[Optional[str]]]) -> int:
        """Count the number of empty cells on the board."""
        count = 0
        for row in board:
            for cell in row:
                if cell is None:
                    count += 1
        return count
    
    def _count_high_threats(
        self,
        threats_x: ThreatResult,
        threats_o: ThreatResult
    ) -> int:
        """Count the total number of high-value threats."""
        count = 0
        for threat_type in self.HIGH_THREAT_TYPES:
            count += threats_x.threats.get(threat_type, 0)
            count += threats_o.threats.get(threat_type, 0)
        return count


def detect_endgame(
    board: List[List[Optional[str]]],
    check_vcf: bool = True,
    check_vct: bool = False
) -> EndgameResult:
    """
    Convenience function to detect endgame.
    
    Args:
        board: Current board state
        check_vcf: Whether to check for VCF
        check_vct: Whether to check for VCT
        
    Returns:
        EndgameResult with detection details
    """
    analyzer = EndgameAnalyzer()
    return analyzer.detect_endgame(board, check_vcf, check_vct)


def is_endgame(
    board: List[List[Optional[str]]],
    quick_check: bool = True
) -> bool:
    """
    Convenience function for quick endgame check.
    
    Args:
        board: Current board state
        quick_check: If True, skip VCF/VCT search
        
    Returns:
        True if position is an endgame
    """
    analyzer = EndgameAnalyzer()
    return analyzer.is_endgame(board, quick_check)


# =============================================================================
# Task 8.5.2: Endgame Solving
# =============================================================================

class EndgameSolutionType(Enum):
    """
    Types of endgame solutions.
    
    - WIN: Player can force a win
    - DRAW: Player can force a draw (no win possible)
    - LOSS: Player will lose with best play
    - UNKNOWN: Solution not found within search limits
    """
    WIN = "win"
    DRAW = "draw"
    LOSS = "loss"
    UNKNOWN = "unknown"


@dataclass
class EndgameSolution:
    """
    Result of endgame solving.
    
    Attributes:
        solution_type: Type of solution found
        winning_sequence: Sequence of moves to win (if WIN)
        drawing_sequence: Sequence of moves to draw (if DRAW)
        best_move: Best move in the position
        depth: Depth at which solution was found
        is_vcf: Whether solution is a VCF
        is_vct: Whether solution is a VCT
        evaluation: Position evaluation (-100 to 100)
        analysis: Human-readable analysis
    """
    solution_type: EndgameSolutionType
    winning_sequence: List[Tuple[int, int, str]] = None
    drawing_sequence: List[Tuple[int, int, str]] = None
    best_move: Optional[Tuple[int, int]] = None
    depth: int = 0
    is_vcf: bool = False
    is_vct: bool = False
    evaluation: int = 0
    analysis: str = ""
    
    def __post_init__(self):
        if self.winning_sequence is None:
            self.winning_sequence = []
        if self.drawing_sequence is None:
            self.drawing_sequence = []


class EndgameSolver:
    """
    Exact endgame solver using VCF/VCT search.
    
    This solver attempts to find exact solutions in endgame positions:
    1. First checks for VCF (Victory by Continuous Four) - fastest
    2. Then checks for VCT (Victory by Continuous Three) - more complex
    3. If no forcing win, searches for drawing moves
    4. Evaluates position if no exact solution found
    
    The solver is designed for positions where:
    - One player has a forcing win (VCF/VCT)
    - The game is near completion (few empty cells)
    - Critical threats exist that determine the outcome
    
    Task 8.5.2: Endgame Solving
    Impact: Perfect endgame analysis
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize the EndgameSolver.
        
        Args:
            board_size: Size of the board (default 15x15)
        """
        self.board_size = board_size
        self.threat_detector = ThreatDetector(board_size)
        self.vcf_searcher = VCFSearch(board_size, max_depth=20)
        self.vct_searcher = VCTSearch(board_size, max_depth=16)
        self.endgame_analyzer = EndgameAnalyzer(board_size)
    
    def solve(
        self,
        board: List[List[Optional[str]]],
        player: str,
        check_vct: bool = True
    ) -> EndgameSolution:
        """
        Solve the endgame position.
        
        This is the main entry point for endgame solving. It attempts to
        find an exact solution (win/draw/loss) for the given position.
        
        Args:
            board: Current board state (2D array, None/"X"/"O")
            player: The player to solve for ("X" or "O")
            check_vct: Whether to check VCT (slower but more thorough)
            
        Returns:
            EndgameSolution with the solution details
        """
        opponent = "O" if player == "X" else "X"
        
        # Step 1: Check if game is already over (FIVE exists)
        player_threats = self.threat_detector.detect_all_threats(board, player)
        opponent_threats = self.threat_detector.detect_all_threats(board, opponent)
        
        if player_threats.threats.get(ThreatType.FIVE, 0) > 0:
            return EndgameSolution(
                solution_type=EndgameSolutionType.WIN,
                winning_sequence=[],
                depth=0,
                evaluation=100,
                analysis=f"{player} đã thắng với 5 quân liên tiếp"
            )
        
        if opponent_threats.threats.get(ThreatType.FIVE, 0) > 0:
            return EndgameSolution(
                solution_type=EndgameSolutionType.LOSS,
                depth=0,
                evaluation=-100,
                analysis=f"{opponent} đã thắng với 5 quân liên tiếp"
            )
        
        # Step 2: Check for player's VCF (forcing win)
        vcf_result = self.vcf_searcher.search(board, player)
        if vcf_result.found:
            return EndgameSolution(
                solution_type=EndgameSolutionType.WIN,
                winning_sequence=vcf_result.sequence,
                best_move=vcf_result.sequence[0][:2] if vcf_result.sequence else None,
                depth=vcf_result.depth,
                is_vcf=True,
                evaluation=95,
                analysis=f"{player} có VCF thắng trong {vcf_result.depth} nước"
            )
        
        # Step 3: Check for opponent's VCF (must defend)
        opponent_vcf = self.vcf_searcher.search(board, opponent)
        if opponent_vcf.found:
            # Player must defend - find the best defensive move
            defense = self._find_vcf_defense(board, player, opponent, opponent_vcf)
            if defense:
                return EndgameSolution(
                    solution_type=EndgameSolutionType.DRAW if defense['can_block'] else EndgameSolutionType.LOSS,
                    drawing_sequence=defense.get('defensive_sequence', []),
                    best_move=defense.get('best_defense'),
                    depth=opponent_vcf.depth,
                    evaluation=-50 if defense['can_block'] else -90,
                    analysis=f"{opponent} có VCF, {player} {'có thể chặn' if defense['can_block'] else 'không thể chặn'}"
                )
            else:
                return EndgameSolution(
                    solution_type=EndgameSolutionType.LOSS,
                    depth=opponent_vcf.depth,
                    evaluation=-90,
                    analysis=f"{opponent} có VCF thắng trong {opponent_vcf.depth} nước, không thể chặn"
                )
        
        # Step 4: Check for player's VCT (complex forcing win)
        if check_vct:
            vct_result = self.vct_searcher.search(board, player)
            if vct_result.found:
                return EndgameSolution(
                    solution_type=EndgameSolutionType.WIN,
                    winning_sequence=vct_result.sequence,
                    best_move=vct_result.sequence[0][:2] if vct_result.sequence else None,
                    depth=vct_result.depth,
                    is_vct=True,
                    evaluation=85,
                    analysis=f"{player} có VCT thắng trong {vct_result.depth} nước"
                )
            
            # Step 5: Check for opponent's VCT
            opponent_vct = self.vct_searcher.search(board, opponent)
            if opponent_vct.found:
                defense = self._find_vct_defense(board, player, opponent, opponent_vct)
                if defense and defense['can_block']:
                    return EndgameSolution(
                        solution_type=EndgameSolutionType.DRAW,
                        drawing_sequence=defense.get('defensive_sequence', []),
                        best_move=defense.get('best_defense'),
                        depth=opponent_vct.depth,
                        evaluation=-40,
                        analysis=f"{opponent} có VCT, {player} có thể chặn"
                    )
                else:
                    return EndgameSolution(
                        solution_type=EndgameSolutionType.LOSS,
                        depth=opponent_vct.depth,
                        evaluation=-80,
                        analysis=f"{opponent} có VCT thắng trong {opponent_vct.depth} nước"
                    )
        
        # Step 6: No forcing sequence found - try to find drawing moves
        drawing_solution = self._find_drawing_sequence(board, player)
        if drawing_solution:
            return drawing_solution
        
        # Step 7: Evaluate position if no exact solution
        evaluation = self._evaluate_position(board, player)
        return EndgameSolution(
            solution_type=EndgameSolutionType.UNKNOWN,
            best_move=self._find_best_move(board, player),
            evaluation=evaluation,
            analysis=f"Không tìm thấy giải pháp chính xác, đánh giá: {evaluation}"
        )
    
    def find_winning_sequence(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> Optional[List[Tuple[int, int, str]]]:
        """
        Find a winning sequence if one exists.
        
        This method specifically searches for a winning sequence (VCF or VCT)
        for the given player.
        
        Args:
            board: Current board state
            player: Player to find winning sequence for
            
        Returns:
            List of moves in winning sequence, or None if no win found
        """
        # Check VCF first (faster)
        vcf_result = self.vcf_searcher.search(board, player)
        if vcf_result.found:
            return vcf_result.sequence
        
        # Check VCT (slower but more thorough)
        vct_result = self.vct_searcher.search(board, player)
        if vct_result.found:
            return vct_result.sequence
        
        return None
    
    def find_drawing_sequence(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> Optional[List[Tuple[int, int, str]]]:
        """
        Find a drawing sequence if winning is not possible.
        
        This method searches for moves that prevent the opponent from winning,
        effectively forcing a draw.
        
        Args:
            board: Current board state
            player: Player to find drawing sequence for
            
        Returns:
            List of moves in drawing sequence, or None if no draw found
        """
        solution = self._find_drawing_sequence(board, player)
        if solution and solution.solution_type == EndgameSolutionType.DRAW:
            return solution.drawing_sequence
        return None
    
    def _find_vcf_defense(
        self,
        board: List[List[Optional[str]]],
        defender: str,
        attacker: str,
        vcf_result: VCFResult
    ) -> Optional[Dict]:
        """
        Find defensive moves against opponent's VCF.
        
        Args:
            board: Current board state
            defender: Defending player
            attacker: Attacking player with VCF
            vcf_result: The VCF result to defend against
            
        Returns:
            Dict with defensive analysis, or None
        """
        if not vcf_result.sequence:
            return None
        
        # Try to block the first move in the VCF sequence
        defensive_moves = []
        can_block = False
        best_defense = None
        
        # Get positions from VCF sequence that are empty (potential blocks)
        for x, y, p in vcf_result.sequence:
            if board[x][y] is None:
                defensive_moves.append((x, y))
        
        # Try each defensive move
        for dx, dy in defensive_moves:
            # Make defensive move
            board[dx][dy] = defender
            
            # Check if attacker still has VCF
            new_vcf = self.vcf_searcher.search(board, attacker)
            
            if not new_vcf.found:
                can_block = True
                best_defense = (dx, dy)
                board[dx][dy] = None
                break
            
            board[dx][dy] = None
        
        # If direct blocking doesn't work, try counter-attack
        if not can_block:
            counter_moves = self._find_counter_attack_moves(board, defender)
            for cx, cy in counter_moves:
                board[cx][cy] = defender
                
                # Check if this creates a threat that forces attacker to respond
                defender_threats = self.threat_detector.detect_all_threats(board, defender)
                if (defender_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0 or
                    defender_threats.threats.get(ThreatType.FOUR, 0) > 0):
                    # This creates a counter-threat
                    new_vcf = self.vcf_searcher.search(board, attacker)
                    if not new_vcf.found:
                        can_block = True
                        best_defense = (cx, cy)
                        board[cx][cy] = None
                        break
                
                board[cx][cy] = None
        
        return {
            'can_block': can_block,
            'best_defense': best_defense,
            'defensive_moves': defensive_moves,
            'defensive_sequence': [(best_defense[0], best_defense[1], defender)] if best_defense else []
        }
    
    def _find_vct_defense(
        self,
        board: List[List[Optional[str]]],
        defender: str,
        attacker: str,
        vct_result: VCTResult
    ) -> Optional[Dict]:
        """
        Find defensive moves against opponent's VCT.
        
        Args:
            board: Current board state
            defender: Defending player
            attacker: Attacking player with VCT
            vct_result: The VCT result to defend against
            
        Returns:
            Dict with defensive analysis, or None
        """
        if not vct_result.sequence:
            return None
        
        # Similar to VCF defense but with VCT
        defensive_moves = []
        can_block = False
        best_defense = None
        
        # Get positions from VCT sequence that are empty
        for x, y, p in vct_result.sequence:
            if board[x][y] is None:
                defensive_moves.append((x, y))
        
        # Try each defensive move
        for dx, dy in defensive_moves[:5]:  # Limit to first 5 for performance
            board[dx][dy] = defender
            
            new_vct = self.vct_searcher.search(board, attacker)
            
            if not new_vct.found:
                can_block = True
                best_defense = (dx, dy)
                board[dx][dy] = None
                break
            
            board[dx][dy] = None
        
        return {
            'can_block': can_block,
            'best_defense': best_defense,
            'defensive_moves': defensive_moves,
            'defensive_sequence': [(best_defense[0], best_defense[1], defender)] if best_defense else []
        }
    
    def _find_drawing_sequence(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> Optional[EndgameSolution]:
        """
        Find a sequence of moves that leads to a draw.
        
        A drawing sequence prevents the opponent from winning while
        the player cannot win either.
        
        Args:
            board: Current board state
            player: Player to find drawing sequence for
            
        Returns:
            EndgameSolution with drawing sequence, or None
        """
        opponent = "O" if player == "X" else "X"
        
        # Check if opponent has any forcing sequence
        opponent_vcf = self.vcf_searcher.search(board, opponent)
        opponent_vct = self.vct_searcher.search(board, opponent)
        
        if not opponent_vcf.found and not opponent_vct.found:
            # Opponent has no forcing win - this is already a "draw" position
            # Find the best move to maintain the draw
            best_move = self._find_best_defensive_move(board, player)
            if best_move:
                return EndgameSolution(
                    solution_type=EndgameSolutionType.DRAW,
                    drawing_sequence=[(best_move[0], best_move[1], player)],
                    best_move=best_move,
                    evaluation=0,
                    analysis=f"Không có chuỗi thắng, duy trì thế hòa"
                )
        
        # If opponent has forcing sequence, try to find blocking moves
        if opponent_vcf.found:
            defense = self._find_vcf_defense(board, player, opponent, opponent_vcf)
            if defense and defense['can_block']:
                return EndgameSolution(
                    solution_type=EndgameSolutionType.DRAW,
                    drawing_sequence=defense.get('defensive_sequence', []),
                    best_move=defense.get('best_defense'),
                    evaluation=-20,
                    analysis=f"Chặn VCF của {opponent} để hòa"
                )
        
        if opponent_vct.found:
            defense = self._find_vct_defense(board, player, opponent, opponent_vct)
            if defense and defense['can_block']:
                return EndgameSolution(
                    solution_type=EndgameSolutionType.DRAW,
                    drawing_sequence=defense.get('defensive_sequence', []),
                    best_move=defense.get('best_defense'),
                    evaluation=-30,
                    analysis=f"Chặn VCT của {opponent} để hòa"
                )
        
        return None
    
    def _find_counter_attack_moves(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> List[Tuple[int, int]]:
        """
        Find moves that create counter-threats.
        
        Args:
            board: Current board state
            player: Player to find counter-attack moves for
            
        Returns:
            List of (x, y) positions for counter-attack
        """
        counter_moves = []
        current_threats = self.threat_detector.detect_all_threats(board, player)
        
        # Find empty cells near player's pieces
        candidates = set()
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] == player:
                    for dx in range(-2, 3):
                        for dy in range(-2, 3):
                            nx, ny = x + dx, y + dy
                            if (0 <= nx < self.board_size and
                                0 <= ny < self.board_size and
                                board[nx][ny] is None):
                                candidates.add((nx, ny))
        
        # Check which candidates create strong threats
        for x, y in candidates:
            board[x][y] = player
            new_threats = self.threat_detector.detect_all_threats(board, player)
            
            # Check if this creates FOUR or OPEN_FOUR
            if (new_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 
                current_threats.threats.get(ThreatType.OPEN_FOUR, 0) or
                new_threats.threats.get(ThreatType.FOUR, 0) > 
                current_threats.threats.get(ThreatType.FOUR, 0)):
                counter_moves.append((x, y))
            
            board[x][y] = None
        
        return counter_moves
    
    def _find_best_defensive_move(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> Optional[Tuple[int, int]]:
        """
        Find the best defensive move in the position.
        
        Args:
            board: Current board state
            player: Player to find move for
            
        Returns:
            (x, y) of best defensive move, or None
        """
        opponent = "O" if player == "X" else "X"
        best_move = None
        best_score = float('-inf')
        
        # Find empty cells near pieces
        candidates = set()
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] is not None:
                    for dx in range(-2, 3):
                        for dy in range(-2, 3):
                            nx, ny = x + dx, y + dy
                            if (0 <= nx < self.board_size and
                                0 <= ny < self.board_size and
                                board[nx][ny] is None):
                                candidates.add((nx, ny))
        
        if not candidates:
            # If no candidates, use center
            center = self.board_size // 2
            if board[center][center] is None:
                return (center, center)
            return None
        
        for x, y in candidates:
            board[x][y] = player
            
            # Evaluate: player's threats - opponent's threats
            player_threats = self.threat_detector.detect_all_threats(board, player)
            opponent_threats = self.threat_detector.detect_all_threats(board, opponent)
            
            score = player_threats.total_score - opponent_threats.total_score
            
            # Bonus for center positions
            center = self.board_size // 2
            distance_to_center = abs(x - center) + abs(y - center)
            score += (self.board_size - distance_to_center) * 5
            
            if score > best_score:
                best_score = score
                best_move = (x, y)
            
            board[x][y] = None
        
        return best_move
    
    def _find_best_move(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> Optional[Tuple[int, int]]:
        """
        Find the best move in the position (general case).
        
        Args:
            board: Current board state
            player: Player to find move for
            
        Returns:
            (x, y) of best move, or None
        """
        # First try to find a winning move
        winning_seq = self.find_winning_sequence(board, player)
        if winning_seq:
            return winning_seq[0][:2]
        
        # Otherwise find best defensive move
        return self._find_best_defensive_move(board, player)
    
    def _evaluate_position(
        self,
        board: List[List[Optional[str]]],
        player: str
    ) -> int:
        """
        Evaluate the position for the given player.
        
        Returns a score from -100 to 100:
        - Positive: player is winning
        - Negative: player is losing
        - Zero: equal position
        
        Args:
            board: Current board state
            player: Player to evaluate for
            
        Returns:
            Evaluation score (-100 to 100)
        """
        opponent = "O" if player == "X" else "X"
        
        player_threats = self.threat_detector.detect_all_threats(board, player)
        opponent_threats = self.threat_detector.detect_all_threats(board, opponent)
        
        # Calculate score difference
        score_diff = player_threats.total_score - opponent_threats.total_score
        
        # Normalize to -100 to 100 range
        if score_diff > 0:
            evaluation = min(80, int(score_diff / 100))
        elif score_diff < 0:
            evaluation = max(-80, int(score_diff / 100))
        else:
            evaluation = 0
        
        return evaluation


def solve_endgame(
    board: List[List[Optional[str]]],
    player: str,
    check_vct: bool = True
) -> EndgameSolution:
    """
    Convenience function to solve endgame.
    
    Args:
        board: Current board state
        player: Player to solve for
        check_vct: Whether to check VCT
        
    Returns:
        EndgameSolution with solution details
    """
    solver = EndgameSolver()
    return solver.solve(board, player, check_vct)


def find_winning_sequence(
    board: List[List[Optional[str]]],
    player: str
) -> Optional[List[Tuple[int, int, str]]]:
    """
    Convenience function to find winning sequence.
    
    Args:
        board: Current board state
        player: Player to find winning sequence for
        
    Returns:
        List of moves in winning sequence, or None
    """
    solver = EndgameSolver()
    return solver.find_winning_sequence(board, player)


def find_drawing_sequence(
    board: List[List[Optional[str]]],
    player: str
) -> Optional[List[Tuple[int, int, str]]]:
    """
    Convenience function to find drawing sequence.
    
    Args:
        board: Current board state
        player: Player to find drawing sequence for
        
    Returns:
        List of moves in drawing sequence, or None
    """
    solver = EndgameSolver()
    return solver.find_drawing_sequence(board, player)


# =============================================================================
# Task 8.5.3: Missed Win Detection
# =============================================================================

@dataclass
class MissedWin:
    """
    Represents a missed winning opportunity.
    
    Attributes:
        move_number: The move number where the win was missed
        player: The player who missed the win
        actual_move: The move that was actually played (x, y)
        winning_sequence: The winning sequence that was available
        vcf_depth: Depth of the VCF that was missed
        is_vcf: Whether the missed win was a VCF
        is_vct: Whether the missed win was a VCT
        severity: Severity of the mistake ("critical", "major")
        explanation: Human-readable explanation in Vietnamese
    """
    move_number: int
    player: str
    actual_move: Tuple[int, int]
    winning_sequence: List[Tuple[int, int, str]]
    vcf_depth: int
    is_vcf: bool = True
    is_vct: bool = False
    severity: str = "critical"
    explanation: str = ""


@dataclass
class MissedWinAnalysis:
    """
    Result of missed win analysis for a game.
    
    Attributes:
        missed_wins: List of missed winning opportunities
        total_missed: Total number of missed wins
        missed_by_x: Number of wins missed by X
        missed_by_o: Number of wins missed by O
        most_critical: The most critical missed win (if any)
        summary: Summary of the analysis in Vietnamese
    """
    missed_wins: List[MissedWin]
    total_missed: int
    missed_by_x: int
    missed_by_o: int
    most_critical: Optional[MissedWin] = None
    summary: str = ""


class MissedWinDetector:
    """
    Detects missed winning opportunities in a game.
    
    This analyzer examines each move in a game to determine if the player
    had a winning sequence (VCF or VCT) available before making their move,
    but chose a different move instead.
    
    A missed win is detected when:
    1. Before a player's move, they have a VCF (or VCT)
    2. The move they played is NOT the first move of that VCF/VCT
    3. After their move, they no longer have the same winning sequence
    
    Task 8.5.3: Missed Win Detection
    Impact: Critical mistake detection
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize the MissedWinDetector.
        
        Args:
            board_size: Size of the board (default 15x15)
        """
        self.board_size = board_size
        self.vcf_searcher = VCFSearch(board_size, max_depth=20)
        self.vct_searcher = VCTSearch(board_size, max_depth=12)
        self.threat_detector = ThreatDetector(board_size)
    
    def analyze_game(
        self,
        moves: List[Tuple[int, int, str]],
        check_vct: bool = False
    ) -> MissedWinAnalysis:
        """
        Analyze a complete game for missed winning opportunities.
        
        This is the main entry point for missed win detection. It replays
        the game move by move, checking at each position if the player
        to move had a winning sequence available.
        
        Args:
            moves: List of moves in the game [(x, y, player), ...]
            check_vct: Whether to also check for VCT (slower but more thorough)
            
        Returns:
            MissedWinAnalysis with all detected missed wins
        """
        board = self._create_empty_board()
        missed_wins: List[MissedWin] = []
        missed_by_x = 0
        missed_by_o = 0
        
        for move_number, (x, y, player) in enumerate(moves, start=1):
            # Check if player had a winning sequence before this move
            missed_win = self._check_for_missed_win(
                board, player, (x, y), move_number, check_vct
            )
            
            if missed_win:
                missed_wins.append(missed_win)
                if player == 'X':
                    missed_by_x += 1
                else:
                    missed_by_o += 1
            
            # Make the move
            board[x][y] = player
        
        # Find the most critical missed win
        most_critical = None
        if missed_wins:
            # Sort by VCF depth (shorter = more critical)
            sorted_wins = sorted(missed_wins, key=lambda w: w.vcf_depth)
            most_critical = sorted_wins[0]
        
        # Generate summary
        summary = self._generate_summary(missed_wins, missed_by_x, missed_by_o)
        
        return MissedWinAnalysis(
            missed_wins=missed_wins,
            total_missed=len(missed_wins),
            missed_by_x=missed_by_x,
            missed_by_o=missed_by_o,
            most_critical=most_critical,
            summary=summary
        )
    
    def check_move_for_missed_win(
        self,
        board: List[List[Optional[str]]],
        player: str,
        actual_move: Tuple[int, int],
        move_number: int = 0,
        check_vct: bool = False
    ) -> Optional[MissedWin]:
        """
        Check if a specific move missed a winning opportunity.
        
        This method checks if the player had a VCF/VCT available before
        making their move, and if the actual move was not part of that
        winning sequence.
        
        Args:
            board: Board state BEFORE the move was made
            player: The player making the move
            actual_move: The move that was actually played (x, y)
            move_number: The move number in the game (for reporting)
            check_vct: Whether to also check for VCT
            
        Returns:
            MissedWin if a win was missed, None otherwise
        """
        return self._check_for_missed_win(
            board, player, actual_move, move_number, check_vct
        )
    
    def _check_for_missed_win(
        self,
        board: List[List[Optional[str]]],
        player: str,
        actual_move: Tuple[int, int],
        move_number: int,
        check_vct: bool
    ) -> Optional[MissedWin]:
        """
        Internal method to check for missed win at a specific position.
        
        Args:
            board: Board state BEFORE the move
            player: Player making the move
            actual_move: The move that was played
            move_number: Move number for reporting
            check_vct: Whether to check VCT
            
        Returns:
            MissedWin if detected, None otherwise
        """
        # First check for VCF (faster and more critical)
        vcf_result = self.vcf_searcher.search(board, player)
        
        if vcf_result.found and vcf_result.sequence:
            # Player had a VCF - check if they played the winning move
            first_winning_move = vcf_result.sequence[0][:2]  # (x, y)
            
            if actual_move != first_winning_move:
                # They missed the win!
                return MissedWin(
                    move_number=move_number,
                    player=player,
                    actual_move=actual_move,
                    winning_sequence=vcf_result.sequence,
                    vcf_depth=vcf_result.depth,
                    is_vcf=True,
                    is_vct=False,
                    severity="critical",
                    explanation=self._generate_vcf_explanation(
                        player, actual_move, vcf_result, move_number
                    )
                )
        
        # Check for VCT if requested (slower)
        if check_vct:
            vct_result = self.vct_searcher.search(board, player)
            
            if vct_result.found and vct_result.sequence and not vct_result.is_vcf:
                # Player had a VCT (but not VCF) - check if they played it
                first_winning_move = vct_result.sequence[0][:2]
                
                if actual_move != first_winning_move:
                    return MissedWin(
                        move_number=move_number,
                        player=player,
                        actual_move=actual_move,
                        winning_sequence=vct_result.sequence,
                        vcf_depth=vct_result.depth,
                        is_vcf=False,
                        is_vct=True,
                        severity="major",
                        explanation=self._generate_vct_explanation(
                            player, actual_move, vct_result, move_number
                        )
                    )
        
        return None
    
    def _generate_vcf_explanation(
        self,
        player: str,
        actual_move: Tuple[int, int],
        vcf_result,
        move_number: int
    ) -> str:
        """Generate Vietnamese explanation for missed VCF."""
        winning_move = vcf_result.sequence[0][:2]
        depth = vcf_result.depth
        
        return (
            f"Nước {move_number}: {player} bỏ lỡ thắng! "
            f"Có VCF thắng trong {depth} nước tại ({winning_move[0]}, {winning_move[1]}), "
            f"nhưng đã đi ({actual_move[0]}, {actual_move[1]}). "
            f"Đây là sai lầm nghiêm trọng - bỏ lỡ cơ hội thắng chắc chắn."
        )
    
    def _generate_vct_explanation(
        self,
        player: str,
        actual_move: Tuple[int, int],
        vct_result,
        move_number: int
    ) -> str:
        """Generate Vietnamese explanation for missed VCT."""
        winning_move = vct_result.sequence[0][:2]
        depth = vct_result.depth
        
        return (
            f"Nước {move_number}: {player} bỏ lỡ cơ hội thắng! "
            f"Có VCT thắng trong {depth} nước tại ({winning_move[0]}, {winning_move[1]}), "
            f"nhưng đã đi ({actual_move[0]}, {actual_move[1]}). "
            f"Đây là sai lầm lớn - bỏ lỡ chuỗi tấn công thắng."
        )
    
    def _generate_summary(
        self,
        missed_wins: List[MissedWin],
        missed_by_x: int,
        missed_by_o: int
    ) -> str:
        """Generate Vietnamese summary of missed wins analysis."""
        total = len(missed_wins)
        
        if total == 0:
            return "Không có cơ hội thắng nào bị bỏ lỡ trong ván đấu này."
        
        vcf_count = sum(1 for w in missed_wins if w.is_vcf)
        vct_count = sum(1 for w in missed_wins if w.is_vct)
        
        summary_parts = [f"Phát hiện {total} cơ hội thắng bị bỏ lỡ:"]
        
        if missed_by_x > 0:
            summary_parts.append(f"- X bỏ lỡ {missed_by_x} lần")
        if missed_by_o > 0:
            summary_parts.append(f"- O bỏ lỡ {missed_by_o} lần")
        
        if vcf_count > 0:
            summary_parts.append(f"- {vcf_count} VCF (thắng chắc chắn)")
        if vct_count > 0:
            summary_parts.append(f"- {vct_count} VCT (chuỗi tấn công thắng)")
        
        return " ".join(summary_parts)
    
    def _create_empty_board(self) -> List[List[Optional[str]]]:
        """Create an empty board."""
        return [[None for _ in range(self.board_size)] for _ in range(self.board_size)]
    
    def get_winning_sequence_display(
        self,
        missed_win: MissedWin
    ) -> List[Dict]:
        """
        Get a display-friendly representation of the winning sequence.
        
        Args:
            missed_win: The missed win to display
            
        Returns:
            List of dicts with move information for display
        """
        display = []
        for i, (x, y, player) in enumerate(missed_win.winning_sequence, start=1):
            move_type = "attack" if player == missed_win.player else "defense"
            display.append({
                "step": i,
                "x": x,
                "y": y,
                "player": player,
                "type": move_type,
                "label": f"{i}. {player}({x},{y})"
            })
        return display


def detect_missed_wins(
    moves: List[Tuple[int, int, str]],
    check_vct: bool = False
) -> MissedWinAnalysis:
    """
    Convenience function to detect missed wins in a game.
    
    Args:
        moves: List of moves in the game [(x, y, player), ...]
        check_vct: Whether to also check for VCT
        
    Returns:
        MissedWinAnalysis with all detected missed wins
    """
    detector = MissedWinDetector()
    return detector.analyze_game(moves, check_vct)


def check_move_for_missed_win(
    board: List[List[Optional[str]]],
    player: str,
    actual_move: Tuple[int, int],
    move_number: int = 0,
    check_vct: bool = False
) -> Optional[MissedWin]:
    """
    Convenience function to check a single move for missed win.
    
    Args:
        board: Board state BEFORE the move
        player: Player making the move
        actual_move: The move that was played
        move_number: Move number for reporting
        check_vct: Whether to check VCT
        
    Returns:
        MissedWin if detected, None otherwise
    """
    detector = MissedWinDetector()
    return detector.check_move_for_missed_win(
        board, player, actual_move, move_number, check_vct
    )
