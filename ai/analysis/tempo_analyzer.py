"""
AI Match Analysis System - Tempo Analyzer

This module implements the TempoAnalyzer class for analyzing tempo and initiative
throughout a Gomoku/Caro game. Tempo analysis helps players understand timing
concepts and when initiative changes between players.

Requirements: 19.1, 19.2, 19.3, 19.4
- 19.1: Mark forcing moves with tempo gain
- 19.2: Mark slow moves with potential tempo loss
- 19.3: Detect tempo switch points
- 19.4: Explain tempo concepts in beginner-friendly terms

Property 50: Forcing Move Detection
Property 51: Tempo Switch Detection
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple, Any
from enum import Enum

from .types import (
    ThreatType,
    ThreatResult,
    TimelineEntry,
    BOARD_SIZE,
)
from .threat_detector import ThreatDetector


class TempoStatus(Enum):
    """Status of tempo for a move."""
    FORCING = "forcing"      # Opponent MUST respond
    NEUTRAL = "neutral"      # No immediate pressure
    SLOW = "slow"            # Gives opponent initiative


@dataclass
class TempoAnalysis:
    """
    Result of tempo analysis for a single move.
    
    Requirements: 19.1, 19.2, 19.3, 19.4
    
    Attributes:
        is_forcing: True if opponent MUST respond to this move
        tempo_change: +1 (gain), 0 (neutral), -1 (loss)
        initiative_holder: "X", "O", or "neutral"
        status: TempoStatus enum value
        explanation: Beginner-friendly explanation of tempo
        explanation_vi: Vietnamese explanation
        explanation_en: English explanation
        explanation_zh: Chinese explanation
        explanation_ja: Japanese explanation
    """
    is_forcing: bool
    tempo_change: int  # +1 (gain), 0 (neutral), -1 (loss)
    initiative_holder: str  # "X", "O", "neutral"
    status: TempoStatus
    explanation: str
    explanation_vi: str = ""
    explanation_en: str = ""
    explanation_zh: str = ""
    explanation_ja: str = ""


@dataclass
class TempoSwitchPoint:
    """
    Represents a point where initiative changes between players.
    
    Requirements: 19.3
    
    Attributes:
        move_number: Move number where switch occurred
        from_player: Player who lost initiative
        to_player: Player who gained initiative
        reason: Why the switch happened
        reason_vi: Vietnamese explanation
        reason_en: English explanation
    """
    move_number: int
    from_player: str
    to_player: str
    reason: str
    reason_vi: str = ""
    reason_en: str = ""


# Tempo explanation templates in multiple languages
TEMPO_EXPLANATIONS = {
    "forcing_threat": {
        "vi": "Nước đi tạo đe dọa buộc đối thủ phải chặn - giành quyền chủ động!",
        "en": "This move creates a threat that forces opponent to respond - gaining initiative!",
        "zh": "这步棋创造了威胁，迫使对手必须应对 - 获得主动权！",
        "ja": "この手は相手に対応を強いる脅威を作り出し、主導権を握ります！"
    },
    "forcing_double": {
        "vi": "Tạo đa đường (fork) - đối thủ không thể chặn hết!",
        "en": "Creates a fork - opponent cannot block all threats!",
        "zh": "形成双杀 - 对手无法全部防守！",
        "ja": "フォークを作成 - 相手は全ての脅威を防げません！"
    },
    "slow_no_threat": {
        "vi": "Nước đi không tạo đe dọa - có thể mất quyền chủ động.",
        "en": "This move creates no immediate threat - may lose initiative.",
        "zh": "这步棋没有创造即时威胁 - 可能失去主动权。",
        "ja": "この手は即座の脅威を作らず、主導権を失う可能性があります。"
    },
    "slow_passive": {
        "vi": "Nước đi thụ động - đối thủ có thể tấn công tự do.",
        "en": "Passive move - opponent can attack freely.",
        "zh": "被动的一步 - 对手可以自由进攻。",
        "ja": "受動的な手 - 相手は自由に攻撃できます。"
    },
    "neutral_development": {
        "vi": "Nước đi phát triển - cân bằng giữa công và thủ.",
        "en": "Development move - balanced between attack and defense.",
        "zh": "发展性的一步 - 攻守平衡。",
        "ja": "展開の手 - 攻守のバランスが取れています。"
    },
    "neutral_defense": {
        "vi": "Nước phòng thủ cần thiết - giữ thế cân bằng.",
        "en": "Necessary defensive move - maintaining balance.",
        "zh": "必要的防守 - 保持平衡。",
        "ja": "必要な防御手 - バランスを維持しています。"
    },
    "switch_lost_threat": {
        "vi": "Mất quyền chủ động do không tạo được đe dọa mới.",
        "en": "Lost initiative by not creating new threats.",
        "zh": "因未能创造新威胁而失去主动权。",
        "ja": "新しい脅威を作れず主導権を失いました。"
    },
    "switch_opponent_threat": {
        "vi": "Đối thủ giành quyền chủ động bằng đe dọa mạnh.",
        "en": "Opponent seized initiative with strong threat.",
        "zh": "对手以强力威胁夺取主动权。",
        "ja": "相手が強い脅威で主導権を奪いました。"
    },
    "switch_counter_attack": {
        "vi": "Phản công thành công - giành lại quyền chủ động!",
        "en": "Successful counter-attack - regained initiative!",
        "zh": "反击成功 - 夺回主动权！",
        "ja": "反撃成功 - 主導権を取り戻しました！"
    }
}


class TempoAnalyzer:
    """
    Analyzes tempo and initiative throughout a Gomoku/Caro game.
    
    Tempo is a concept from chess that refers to the "time" or "turns" in a game.
    A player has the initiative when they are making threats that the opponent
    must respond to. Losing tempo means making moves that don't create threats,
    allowing the opponent to take the initiative.
    
    Requirements: 19.1, 19.2, 19.3, 19.4
    - 19.1: Mark forcing moves with tempo gain
    - 19.2: Mark slow moves with potential tempo loss
    - 19.3: Detect tempo switch points
    - 19.4: Explain tempo concepts in beginner-friendly terms
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize the TempoAnalyzer.
        
        Args:
            board_size: Size of the board (default 15x15)
        """
        self.board_size = board_size
        self.threat_detector = ThreatDetector(board_size)
        
        # Threat types that are considered "forcing" (opponent must respond)
        self._forcing_threats = {
            ThreatType.FIVE,
            ThreatType.OPEN_FOUR,
            ThreatType.FOUR,
            ThreatType.BROKEN_FOUR,
        }
        
        # Threat types that create pressure but aren't immediately forcing
        self._pressure_threats = {
            ThreatType.OPEN_THREE,
            ThreatType.THREE,
            ThreatType.BROKEN_THREE,
        }
    
    def analyze_tempo(
        self,
        board_before: List[List[Optional[str]]],
        board_after: List[List[Optional[str]]],
        move_x: int,
        move_y: int,
        player: str,
        previous_initiative: str = "neutral"
    ) -> TempoAnalysis:
        """
        Analyze tempo for a single move.
        
        Requirements: 19.1, 19.2, 19.4
        - 19.1: Mark forcing moves with tempo gain
        - 19.2: Mark slow moves with potential tempo loss
        - 19.4: Explain tempo concepts in beginner-friendly terms
        
        Property 50: Forcing Move Detection
        *For any* move that creates immediate threat requiring response,
        the system SHALL mark it as "forcing" with tempo gain indicator.
        
        Args:
            board_before: Board state before the move
            board_after: Board state after the move
            move_x: Row of the move
            move_y: Column of the move
            player: Player who made the move ("X" or "O")
            previous_initiative: Who had initiative before this move
            
        Returns:
            TempoAnalysis with tempo information
        """
        opponent = "O" if player == "X" else "X"
        
        # Detect threats created by this move
        threats_before = self.threat_detector.detect_all_threats(board_before, player)
        threats_after = self.threat_detector.detect_all_threats(board_after, player)
        
        # Detect opponent threats (to check if we're responding to them)
        opp_threats_before = self.threat_detector.detect_all_threats(board_before, opponent)
        opp_threats_after = self.threat_detector.detect_all_threats(board_after, opponent)
        
        # Check if this move creates forcing threats
        is_forcing = self._creates_forcing_threat(threats_before, threats_after)
        
        # Check if this move creates double threats (fork)
        creates_double = self._creates_double_threat(threats_after)
        
        # Check if opponent had forcing threats that we blocked
        blocked_forcing = self._blocked_forcing_threat(opp_threats_before, opp_threats_after)
        
        # Check if opponent still has forcing threats after our move
        opp_still_forcing = self._has_forcing_threat(opp_threats_after)
        
        # Determine tempo status and change
        if is_forcing or creates_double:
            # We created a forcing threat - we have initiative
            status = TempoStatus.FORCING
            tempo_change = 1 if previous_initiative != player else 0
            initiative_holder = player
            
            if creates_double:
                explanation_key = "forcing_double"
            else:
                explanation_key = "forcing_threat"
                
        elif blocked_forcing and not opp_still_forcing:
            # We blocked opponent's threat and they have no more forcing threats
            # This is neutral - we defended successfully
            status = TempoStatus.NEUTRAL
            tempo_change = 0
            initiative_holder = "neutral"
            explanation_key = "neutral_defense"
            
        elif opp_still_forcing:
            # Opponent still has forcing threats - they have initiative
            status = TempoStatus.SLOW
            tempo_change = -1 if previous_initiative == player else 0
            initiative_holder = opponent
            explanation_key = "slow_passive"
            
        elif self._creates_pressure_threat(threats_before, threats_after):
            # We created some pressure but not forcing
            status = TempoStatus.NEUTRAL
            tempo_change = 0
            initiative_holder = previous_initiative
            explanation_key = "neutral_development"
            
        else:
            # No significant threats created
            status = TempoStatus.SLOW
            tempo_change = -1 if previous_initiative == player else 0
            initiative_holder = opponent if previous_initiative == player else "neutral"
            explanation_key = "slow_no_threat"
        
        # Get explanations in all languages
        explanations = TEMPO_EXPLANATIONS.get(explanation_key, TEMPO_EXPLANATIONS["neutral_development"])
        
        return TempoAnalysis(
            is_forcing=is_forcing or creates_double,
            tempo_change=tempo_change,
            initiative_holder=initiative_holder,
            status=status,
            explanation=explanations["vi"],  # Default to Vietnamese
            explanation_vi=explanations["vi"],
            explanation_en=explanations["en"],
            explanation_zh=explanations["zh"],
            explanation_ja=explanations["ja"]
        )
    
    def detect_tempo_switch(
        self,
        timeline: List[TimelineEntry],
        moves: List[Any],
        boards: Optional[List[List[List[Optional[str]]]]] = None
    ) -> List[TempoSwitchPoint]:
        """
        Detect move numbers where initiative switches between players.
        
        Requirements: 19.3
        
        Property 51: Tempo Switch Detection
        *For any* game, the system SHALL correctly identify points where
        initiative changes between players.
        
        Args:
            timeline: List of TimelineEntry from game analysis
            moves: List of moves in the game
            boards: Optional list of board states after each move
            
        Returns:
            List of TempoSwitchPoint indicating where initiative changed
        """
        if not moves or len(moves) < 2:
            return []
        
        switch_points: List[TempoSwitchPoint] = []
        
        # If boards not provided, reconstruct them
        if boards is None:
            boards = self._reconstruct_boards(moves)
        
        # Track initiative through the game
        current_initiative = "neutral"
        
        for i, move in enumerate(moves):
            if i == 0:
                # First move - player who moves first has slight initiative
                current_initiative = move.player
                continue
            
            # Get board states
            board_before = boards[i - 1] if i > 0 else [[None] * self.board_size for _ in range(self.board_size)]
            board_after = boards[i]
            
            # Analyze tempo for this move
            tempo = self.analyze_tempo(
                board_before,
                board_after,
                move.x,
                move.y,
                move.player,
                current_initiative
            )
            
            # Check if initiative changed
            new_initiative = tempo.initiative_holder
            
            if new_initiative != current_initiative and new_initiative != "neutral":
                # Initiative switched!
                from_player = current_initiative if current_initiative != "neutral" else ("O" if new_initiative == "X" else "X")
                
                # Determine reason for switch
                if tempo.is_forcing:
                    reason_key = "switch_counter_attack"
                elif tempo.status == TempoStatus.SLOW:
                    reason_key = "switch_lost_threat"
                else:
                    reason_key = "switch_opponent_threat"
                
                reasons = TEMPO_EXPLANATIONS.get(reason_key, TEMPO_EXPLANATIONS["switch_lost_threat"])
                
                switch_points.append(TempoSwitchPoint(
                    move_number=i + 1,  # 1-indexed
                    from_player=from_player,
                    to_player=new_initiative,
                    reason=reasons["vi"],
                    reason_vi=reasons["vi"],
                    reason_en=reasons["en"]
                ))
                
                current_initiative = new_initiative
            elif new_initiative == "neutral" and current_initiative != "neutral":
                # Initiative became neutral (balanced position)
                current_initiative = "neutral"
        
        return switch_points
    
    def analyze_game_tempo(
        self,
        moves: List[Any]
    ) -> Dict[str, Any]:
        """
        Analyze tempo for an entire game.
        
        Returns a comprehensive tempo analysis including:
        - Tempo analysis for each move
        - Switch points
        - Overall tempo statistics
        
        Args:
            moves: List of moves in the game
            
        Returns:
            Dictionary with tempo analysis results
        """
        if not moves:
            return {
                "tempo_per_move": [],
                "switch_points": [],
                "stats": {
                    "x_forcing_moves": 0,
                    "o_forcing_moves": 0,
                    "x_slow_moves": 0,
                    "o_slow_moves": 0,
                    "total_switches": 0
                }
            }
        
        # Reconstruct boards
        boards = self._reconstruct_boards(moves)
        
        # Analyze tempo for each move
        tempo_per_move: List[TempoAnalysis] = []
        current_initiative = "neutral"
        
        stats = {
            "x_forcing_moves": 0,
            "o_forcing_moves": 0,
            "x_slow_moves": 0,
            "o_slow_moves": 0,
            "total_switches": 0
        }
        
        for i, move in enumerate(moves):
            board_before = boards[i - 1] if i > 0 else [[None] * self.board_size for _ in range(self.board_size)]
            board_after = boards[i]
            
            tempo = self.analyze_tempo(
                board_before,
                board_after,
                move.x,
                move.y,
                move.player,
                current_initiative
            )
            tempo_per_move.append(tempo)
            
            # Update stats
            if tempo.is_forcing:
                if move.player == "X":
                    stats["x_forcing_moves"] += 1
                else:
                    stats["o_forcing_moves"] += 1
            elif tempo.status == TempoStatus.SLOW:
                if move.player == "X":
                    stats["x_slow_moves"] += 1
                else:
                    stats["o_slow_moves"] += 1
            
            current_initiative = tempo.initiative_holder
        
        # Detect switch points
        switch_points = self.detect_tempo_switch([], moves, boards)
        stats["total_switches"] = len(switch_points)
        
        return {
            "tempo_per_move": tempo_per_move,
            "switch_points": switch_points,
            "stats": stats
        }
    
    def _creates_forcing_threat(
        self,
        threats_before: ThreatResult,
        threats_after: ThreatResult
    ) -> bool:
        """
        Check if a move creates a forcing threat.
        
        A forcing threat is one that the opponent MUST respond to,
        such as FOUR, OPEN_FOUR, or FIVE.
        
        Args:
            threats_before: Threats before the move
            threats_after: Threats after the move
            
        Returns:
            True if a new forcing threat was created
        """
        for threat_type in self._forcing_threats:
            before_count = threats_before.threats.get(threat_type, 0)
            after_count = threats_after.threats.get(threat_type, 0)
            if after_count > before_count:
                return True
        return False
    
    def _creates_pressure_threat(
        self,
        threats_before: ThreatResult,
        threats_after: ThreatResult
    ) -> bool:
        """
        Check if a move creates a pressure threat (OPEN_THREE, etc.).
        
        Args:
            threats_before: Threats before the move
            threats_after: Threats after the move
            
        Returns:
            True if a new pressure threat was created
        """
        for threat_type in self._pressure_threats:
            before_count = threats_before.threats.get(threat_type, 0)
            after_count = threats_after.threats.get(threat_type, 0)
            if after_count > before_count:
                return True
        return False
    
    def _creates_double_threat(self, threats: ThreatResult) -> bool:
        """
        Check if there are double threats (fork).
        
        Args:
            threats: Threat result to check
            
        Returns:
            True if double threats exist
        """
        total_double = sum(threats.double_threats.values())
        return total_double > 0
    
    def _has_forcing_threat(self, threats: ThreatResult) -> bool:
        """
        Check if there are any forcing threats.
        
        Args:
            threats: Threat result to check
            
        Returns:
            True if any forcing threat exists
        """
        for threat_type in self._forcing_threats:
            if threats.threats.get(threat_type, 0) > 0:
                return True
        return False
    
    def _blocked_forcing_threat(
        self,
        opp_threats_before: ThreatResult,
        opp_threats_after: ThreatResult
    ) -> bool:
        """
        Check if we blocked an opponent's forcing threat.
        
        Args:
            opp_threats_before: Opponent threats before our move
            opp_threats_after: Opponent threats after our move
            
        Returns:
            True if we blocked a forcing threat
        """
        for threat_type in self._forcing_threats:
            before_count = opp_threats_before.threats.get(threat_type, 0)
            after_count = opp_threats_after.threats.get(threat_type, 0)
            if after_count < before_count:
                return True
        return False
    
    def _reconstruct_boards(
        self,
        moves: List[Any]
    ) -> List[List[List[Optional[str]]]]:
        """
        Reconstruct board states from a list of moves.
        
        Args:
            moves: List of moves
            
        Returns:
            List of board states after each move
        """
        boards: List[List[List[Optional[str]]]] = []
        board = [[None for _ in range(self.board_size)] for _ in range(self.board_size)]
        
        for move in moves:
            board[move.x][move.y] = move.player
            # Deep copy the board
            boards.append([row[:] for row in board])
        
        return boards


def analyze_tempo_for_move(
    board_before: List[List[Optional[str]]],
    board_after: List[List[Optional[str]]],
    move_x: int,
    move_y: int,
    player: str,
    previous_initiative: str = "neutral",
    board_size: int = BOARD_SIZE
) -> TempoAnalysis:
    """
    Convenience function to analyze tempo for a single move.
    
    Args:
        board_before: Board state before the move
        board_after: Board state after the move
        move_x: Row of the move
        move_y: Column of the move
        player: Player who made the move
        previous_initiative: Who had initiative before
        board_size: Size of the board
        
    Returns:
        TempoAnalysis result
    """
    analyzer = TempoAnalyzer(board_size)
    return analyzer.analyze_tempo(
        board_before, board_after, move_x, move_y, player, previous_initiative
    )


def detect_tempo_switches(
    moves: List[Any],
    board_size: int = BOARD_SIZE
) -> List[TempoSwitchPoint]:
    """
    Convenience function to detect tempo switch points in a game.
    
    Args:
        moves: List of moves in the game
        board_size: Size of the board
        
    Returns:
        List of TempoSwitchPoint
    """
    analyzer = TempoAnalyzer(board_size)
    return analyzer.detect_tempo_switch([], moves)
