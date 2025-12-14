"""
Game Metadata Handler for Gomoku Analysis.

Handles game context including game type, rule variant, time control, and player ELO.
Provides strictness multipliers and comment complexity adjustments based on context.

**Feature: gomoku-basic-analysis**
**Validates: Requirements 14.1, 14.2, 14.3, 14.4**
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, Any


class GameType(Enum):
    """Game type classification."""
    TOURNAMENT = "tournament"
    RANKED = "ranked"
    CASUAL = "casual"


class RuleVariant(Enum):
    """Gomoku rule variants."""
    STANDARD = "standard"
    RENJU = "renju"
    SWAP2 = "swap2"
    PRO = "pro"


class TimeControl(Enum):
    """Time control categories."""
    BLITZ = "blitz"      # < 5 minutes
    RAPID = "rapid"      # 5-15 minutes
    CLASSICAL = "classical"  # > 15 minutes


class CommentComplexity(Enum):
    """Comment complexity levels based on player skill."""
    BEGINNER = "beginner"      # ELO < 1200
    INTERMEDIATE = "intermediate"  # ELO 1200-1600
    ADVANCED = "advanced"      # ELO > 1600


@dataclass
class GameMetadata:
    """
    Game metadata for context-aware analysis.
    
    Attributes:
        game_type: Type of game (tournament, ranked, casual)
        rule_variant: Rule variant being used
        time_control: Time control category
        white_elo: White player's ELO rating (optional)
        black_elo: Black player's ELO rating (optional)
        result: Game result (optional)
        decisive_move: Move number that decided the game (optional)
    """
    game_type: GameType = GameType.CASUAL
    rule_variant: RuleVariant = RuleVariant.STANDARD
    time_control: TimeControl = TimeControl.RAPID
    white_elo: Optional[int] = None
    black_elo: Optional[int] = None
    result: Optional[str] = None  # "black_win", "white_win", "draw"
    decisive_move: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize metadata to dictionary."""
        return {
            "game_type": self.game_type.value,
            "rule_variant": self.rule_variant.value,
            "time_control": self.time_control.value,
            "white_elo": self.white_elo,
            "black_elo": self.black_elo,
            "result": self.result,
            "decisive_move": self.decisive_move
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GameMetadata":
        """Deserialize metadata from dictionary."""
        return cls(
            game_type=GameType(data.get("game_type", "casual")),
            rule_variant=RuleVariant(data.get("rule_variant", "standard")),
            time_control=TimeControl(data.get("time_control", "rapid")),
            white_elo=data.get("white_elo"),
            black_elo=data.get("black_elo"),
            result=data.get("result"),
            decisive_move=data.get("decisive_move")
        )


class GameMetadataHandler:
    """
    Handler for game metadata processing.
    
    Provides:
    - Strictness multipliers based on game type
    - Comment complexity based on player ELO
    - Context-aware analysis adjustments
    """
    
    # Strictness multipliers by game type
    STRICTNESS_MULTIPLIERS = {
        GameType.TOURNAMENT: 1.2,  # Stricter evaluation
        GameType.RANKED: 1.0,      # Standard evaluation
        GameType.CASUAL: 0.8       # More lenient evaluation
    }
    
    # ELO thresholds for comment complexity
    ELO_THRESHOLDS = {
        "beginner": 1200,
        "intermediate": 1600
    }
    
    # Score thresholds by game type (for rating classification)
    # Format: {game_type: {rating: min_score}}
    RATING_THRESHOLDS = {
        GameType.TOURNAMENT: {
            "excellent": 9.5,  # Stricter
            "good": 7.5,
            "average": 5.5,
            "poor": 3.5,
            "blunder": 0.0
        },
        GameType.RANKED: {
            "excellent": 9.0,  # Standard
            "good": 7.0,
            "average": 5.0,
            "poor": 3.0,
            "blunder": 0.0
        },
        GameType.CASUAL: {
            "excellent": 8.5,  # More lenient
            "good": 6.5,
            "average": 4.5,
            "poor": 2.5,
            "blunder": 0.0
        }
    }
    
    def __init__(self, metadata: Optional[GameMetadata] = None):
        """
        Initialize handler with optional metadata.
        
        Args:
            metadata: Game metadata, defaults to casual game if not provided
        """
        self.metadata = metadata or GameMetadata()
    
    def get_strictness_multiplier(self) -> float:
        """
        Get strictness multiplier based on game type.
        
        Tournament games are evaluated more strictly (1.2x),
        casual games are more lenient (0.8x).
        
        Returns:
            Strictness multiplier (0.8 to 1.2)
        """
        return self.STRICTNESS_MULTIPLIERS.get(
            self.metadata.game_type, 
            1.0
        )
    
    def get_comment_complexity(self, player: str = "X") -> CommentComplexity:
        """
        Get comment complexity level based on player ELO.
        
        Args:
            player: "X" (black) or "O" (white)
            
        Returns:
            CommentComplexity level
        """
        # Get relevant ELO
        if player == "X":
            elo = self.metadata.black_elo
        else:
            elo = self.metadata.white_elo
        
        # Default to beginner if no ELO
        if elo is None:
            return CommentComplexity.BEGINNER
        
        # Determine complexity based on ELO
        if elo < self.ELO_THRESHOLDS["beginner"]:
            return CommentComplexity.BEGINNER
        elif elo < self.ELO_THRESHOLDS["intermediate"]:
            return CommentComplexity.INTERMEDIATE
        else:
            return CommentComplexity.ADVANCED
    
    def get_average_elo(self) -> Optional[int]:
        """
        Get average ELO of both players.
        
        Returns:
            Average ELO or None if no ELO data
        """
        elos = []
        if self.metadata.white_elo is not None:
            elos.append(self.metadata.white_elo)
        if self.metadata.black_elo is not None:
            elos.append(self.metadata.black_elo)
        
        if not elos:
            return None
        return sum(elos) // len(elos)
    
    def adjust_score(self, base_score: float) -> float:
        """
        Adjust move score based on game context.
        
        Tournament games have stricter scoring (lower scores for same moves),
        casual games have more lenient scoring.
        
        NOTE: This function now handles raw position scores (can be thousands)
        not just normalized 0-10 scores.
        
        Args:
            base_score: Original score (raw position evaluation)
            
        Returns:
            Adjusted score (same scale as input)
        """
        multiplier = self.get_strictness_multiplier()
        
        # Simply apply multiplier to the score
        # Tournament (1.2): slightly reduce non-winning scores
        # Casual (0.8): slightly increase scores
        # This preserves the relative differences between scores
        return base_score * multiplier
    
    def get_rating_for_score(self, score: float) -> str:
        """
        Get rating classification for a score based on game type.
        
        Args:
            score: Move score (0-10)
            
        Returns:
            Rating string: "excellent", "good", "average", "poor", "blunder"
        """
        thresholds = self.RATING_THRESHOLDS.get(
            self.metadata.game_type,
            self.RATING_THRESHOLDS[GameType.RANKED]
        )
        
        if score >= thresholds["excellent"]:
            return "excellent"
        elif score >= thresholds["good"]:
            return "good"
        elif score >= thresholds["average"]:
            return "average"
        elif score >= thresholds["poor"]:
            return "poor"
        else:
            return "blunder"
    
    def should_use_simple_vocabulary(self, player: str = "X") -> bool:
        """
        Check if simple vocabulary should be used for comments.
        
        Args:
            player: "X" (black) or "O" (white)
            
        Returns:
            True if beginner-level vocabulary should be used
        """
        complexity = self.get_comment_complexity(player)
        return complexity == CommentComplexity.BEGINNER
    
    def is_renju_rules(self) -> bool:
        """Check if Renju rules apply (forbidden moves for Black)."""
        return self.metadata.rule_variant == RuleVariant.RENJU
    
    def is_tournament_game(self) -> bool:
        """Check if this is a tournament game."""
        return self.metadata.game_type == GameType.TOURNAMENT
    
    def is_casual_game(self) -> bool:
        """Check if this is a casual game."""
        return self.metadata.game_type == GameType.CASUAL
    
    def get_context_description(self, language: str = "vi") -> str:
        """
        Get human-readable description of game context.
        
        Args:
            language: Language code (vi, en, zh, ja)
            
        Returns:
            Context description string
        """
        descriptions = {
            "vi": {
                GameType.TOURNAMENT: "Trận đấu giải đấu",
                GameType.RANKED: "Trận xếp hạng",
                GameType.CASUAL: "Trận giao hữu"
            },
            "en": {
                GameType.TOURNAMENT: "Tournament match",
                GameType.RANKED: "Ranked match",
                GameType.CASUAL: "Casual match"
            },
            "zh": {
                GameType.TOURNAMENT: "锦标赛比赛",
                GameType.RANKED: "排位赛",
                GameType.CASUAL: "休闲赛"
            },
            "ja": {
                GameType.TOURNAMENT: "トーナメント戦",
                GameType.RANKED: "ランク戦",
                GameType.CASUAL: "カジュアル戦"
            }
        }
        
        lang_desc = descriptions.get(language, descriptions["en"])
        return lang_desc.get(self.metadata.game_type, "Match")


# Simple vocabulary mappings for beginners
SIMPLE_VOCABULARY = {
    "vi": {
        "fork": "đánh 2 đường cùng lúc",
        "open_four": "hàng 4 trống 2 đầu",
        "closed_four": "hàng 4 bị chặn 1 đầu",
        "open_three": "hàng 3 trống 2 đầu",
        "threat": "đe dọa",
        "block": "chặn",
        "counter_attack": "phản công",
        "tempo": "nhịp đi",
        "initiative": "quyền chủ động"
    },
    "en": {
        "fork": "attack two ways at once",
        "open_four": "four in a row with both ends open",
        "closed_four": "four in a row with one end blocked",
        "open_three": "three in a row with both ends open",
        "threat": "threat",
        "block": "block",
        "counter_attack": "counter attack",
        "tempo": "tempo",
        "initiative": "initiative"
    },
    "zh": {
        "fork": "双杀",
        "open_four": "活四",
        "closed_four": "冲四",
        "open_three": "活三",
        "threat": "威胁",
        "block": "防守",
        "counter_attack": "反击",
        "tempo": "节奏",
        "initiative": "主动权"
    },
    "ja": {
        "fork": "二重攻撃",
        "open_four": "両端が空いた四連",
        "closed_four": "片端が塞がれた四連",
        "open_three": "両端が空いた三連",
        "threat": "脅威",
        "block": "ブロック",
        "counter_attack": "反撃",
        "tempo": "テンポ",
        "initiative": "主導権"
    }
}


def get_simple_term(term: str, language: str = "vi") -> str:
    """
    Get simple vocabulary term for beginners.
    
    Args:
        term: Technical term key
        language: Language code
        
    Returns:
        Simple vocabulary term
    """
    lang_vocab = SIMPLE_VOCABULARY.get(language, SIMPLE_VOCABULARY["en"])
    return lang_vocab.get(term.lower(), term)
