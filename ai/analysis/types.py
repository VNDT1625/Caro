"""
AI Match Analysis System - Type Definitions

This module defines all the core types and interfaces used throughout
the analysis system, including threat detection, position evaluation,
and analysis results.

Requirements: 1.1, 1.2, 1.3
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple


class ThreatType(Enum):
    """
    Types of threats that can be detected on the board.
    Each type has an associated score value for position evaluation.
    
    Scores (from Requirements 1.2):
    - FIVE: 100000 points (winning)
    - OPEN_FOUR: 10000 points (guaranteed win next move)
    - FOUR: 1000 points (one move from winning, blocked on one end)
    - BROKEN_FOUR: 800 points (four with 1 gap: X_XXX, XX_XX, XXX_X)
    - OPEN_THREE: 500 points (two moves from winning, open both ends)
    - THREE: 100 points (two moves from winning, blocked on one end)
    - BROKEN_THREE: 80 points (three with 1 gap: X_XX, XX_X)
    - JUMP_THREE: 60 points (three with 2 gaps: X__XX, XX__X)
    - OPEN_TWO: 10 points (potential threat development)
    """
    FIVE = "five"
    OPEN_FOUR = "open_four"
    FOUR = "four"
    BROKEN_FOUR = "broken_four"
    OPEN_THREE = "open_three"
    THREE = "three"
    BROKEN_THREE = "broken_three"
    JUMP_THREE = "jump_three"
    OPEN_TWO = "open_two"


class DoubleThreatType(Enum):
    """
    Types of double threats (combinations of threats at the same position).
    Double threats are extremely dangerous as they often guarantee a win.
    
    Task 8.2.2: Double Threat Detection
    Impact: Detect 100% winning combinations
    
    Types:
    - DOUBLE_FOUR: 2 FOUR threats at same position → guaranteed win
    - FOUR_THREE: FOUR + OPEN_THREE at same position → guaranteed win
    - DOUBLE_THREE: 2 OPEN_THREE threats at same position → very dangerous
    """
    DOUBLE_FOUR = "double_four"      # 2 FOURs → guaranteed win (50000 points)
    FOUR_THREE = "four_three"        # FOUR + OPEN_THREE → guaranteed win (20000 points)
    DOUBLE_THREE = "double_three"    # 2 OPEN_THREEs → very dangerous (5000 points)


# Double threat score mapping (Task 8.2.2)
DOUBLE_THREAT_SCORES: Dict[DoubleThreatType, int] = {
    DoubleThreatType.DOUBLE_FOUR: 50000,   # Guaranteed win - opponent can only block one
    DoubleThreatType.FOUR_THREE: 20000,    # Guaranteed win - blocking FOUR allows THREE to become FOUR
    DoubleThreatType.DOUBLE_THREE: 5000,   # Very dangerous - can become FOUR_THREE next move
}


# Double threat severity mapping (Task 8.2.2)
DOUBLE_THREAT_SEVERITY: Dict[DoubleThreatType, str] = {
    DoubleThreatType.DOUBLE_FOUR: "critical",
    DoubleThreatType.FOUR_THREE: "critical",
    DoubleThreatType.DOUBLE_THREE: "critical",
}


# Threat score mapping (Requirements 1.2, Task 8.2.1)
THREAT_SCORES: Dict[ThreatType, int] = {
    ThreatType.FIVE: 100000,
    ThreatType.OPEN_FOUR: 10000,
    ThreatType.FOUR: 1000,
    ThreatType.BROKEN_FOUR: 800,
    ThreatType.OPEN_THREE: 500,
    ThreatType.THREE: 100,
    ThreatType.BROKEN_THREE: 80,
    ThreatType.JUMP_THREE: 60,
    ThreatType.OPEN_TWO: 10,
}


class MoveClassification(Enum):
    """
    Classification of move quality based on score comparison.
    
    Thresholds (from Requirements 2.4):
    - EXCELLENT: score >= 85
    - GOOD: 70 <= score < 85
    - OKAY: 50 <= score < 70
    - WEAK: 30 <= score < 50
    - BLUNDER: score < 30
    """
    EXCELLENT = "excellent"
    GOOD = "good"
    OKAY = "okay"
    WEAK = "weak"
    BLUNDER = "blunder"


# Move classification thresholds (Requirements 2.4)
CLASSIFICATION_THRESHOLDS = {
    MoveClassification.EXCELLENT: 85,
    MoveClassification.GOOD: 70,
    MoveClassification.OKAY: 50,
    MoveClassification.WEAK: 30,
}


@dataclass
class Move:
    """Represents a single move on the board."""
    x: int
    y: int
    player: str  # "X" or "O"
    move_number: Optional[int] = None


@dataclass
class ThreatPosition:
    """
    Represents a detected threat on the board.
    
    Attributes:
        type: The type of threat (five, open_four, etc.)
        positions: List of (x, y) coordinates forming the threat
        direction: Direction of the threat line
    """
    type: ThreatType
    positions: List[Tuple[int, int]]
    direction: str  # "horizontal", "vertical", "diagonal_down", "diagonal_up"


@dataclass
class DoubleThreatPosition:
    """
    Represents a detected double threat on the board.
    
    Task 8.2.2: Double Threat Detection
    
    A double threat occurs when a single move creates two threats
    that the opponent cannot both block.
    
    Attributes:
        type: The type of double threat (double_four, four_three, double_three)
        key_position: The (x, y) position that creates both threats
        threat1: First threat involved
        threat2: Second threat involved
        severity: Severity level (always "critical" for double threats)
    """
    type: DoubleThreatType
    key_position: Tuple[int, int]
    threat1: ThreatPosition
    threat2: ThreatPosition
    severity: str = "critical"


@dataclass
class ThreatResult:
    """
    Result of threat detection for a player.
    
    Attributes:
        threats: Count of each threat type detected
        total_score: Sum of all threat scores
        threat_positions: List of all detected threat positions with details
        double_threats: Count of each double threat type detected
        double_threat_positions: List of all detected double threat positions
    """
    threats: Dict[ThreatType, int] = field(default_factory=dict)
    total_score: int = 0
    threat_positions: List[ThreatPosition] = field(default_factory=list)
    double_threats: Dict[DoubleThreatType, int] = field(default_factory=dict)
    double_threat_positions: List[DoubleThreatPosition] = field(default_factory=list)


@dataclass
class EvaluationResult:
    """
    Result of position evaluation.
    
    Attributes:
        score: Numerical score of the position
        win_probability: Probability of winning (0-1 range)
        threats: Threat detection result for the evaluated player
    """
    score: float
    win_probability: float
    threats: ThreatResult


@dataclass
class TimelineEntry:
    """
    A single entry in the game analysis timeline.
    
    Attributes:
        move: Move number (1-indexed)
        player: Player who made the move ("X" or "O")
        position: Position of the move {x, y}
        score: Evaluation score after this move
        win_prob: Win probability after this move
        category: Classification of the move quality
        note: Vietnamese description of the move
        role: Player role at this move ("attacker", "defender", "neutral")
        comments: Multi-language comments {vi, en, zh, ja}
        alternatives: List of 2-3 alternative moves with reasons (Requirements 5.1, 5.2, 5.3, 5.4)
        score_before: Board evaluation before this move (Requirements 6.1)
        score_change: Change in board evaluation (after - before) (Requirements 6.1)
        is_significant: True if evaluation change > 20 (Requirements 6.2)
        is_critical: True if evaluation change > 50 (Requirements 6.4)
        is_forcing: True if this move forces opponent to respond (Requirements 19.1)
        tempo_change: +1 (gain), 0 (neutral), -1 (loss) (Requirements 19.1, 19.2)
        initiative_holder: Who has initiative after this move (Requirements 19.3)
        is_tempo_switch: True if initiative changed on this move (Requirements 19.3)
        tempo_explanation: Beginner-friendly tempo explanation (Requirements 19.4)
    """
    move: int
    player: str
    position: Dict[str, int]
    score: float
    win_prob: float
    category: MoveClassification
    note: str
    role: str = "neutral"  # Default to neutral for backward compatibility
    comments: Optional[Dict[str, str]] = None  # Multi-language comments (vi, en, zh, ja)
    alternatives: Optional[List['AlternativeMove']] = None  # 2-3 alternative moves (Requirements 5.1-5.4)
    score_before: Optional[float] = None  # Board evaluation before this move (Requirements 6.1)
    score_change: Optional[float] = None  # Change in board evaluation (Requirements 6.1)
    is_significant: bool = False  # True if |score_change| > 20 (Requirements 6.2)
    is_critical: bool = False  # True if |score_change| > 50 (Requirements 6.4)
    # Tempo analysis fields (Requirements 19.1, 19.2, 19.3, 19.4)
    is_forcing: bool = False  # True if this move forces opponent to respond
    tempo_change: int = 0  # +1 (gain), 0 (neutral), -1 (loss)
    initiative_holder: str = "neutral"  # Who has initiative after this move
    is_tempo_switch: bool = False  # True if initiative changed on this move
    tempo_explanation: Optional[Dict[str, str]] = None  # Multi-language tempo explanation


@dataclass
class Mistake:
    """
    A detected mistake in the game.
    
    Attributes:
        move: Move number where the mistake occurred
        severity: Severity level ("minor", "major", "critical")
        desc: Vietnamese description of the mistake
        best_alternative: The better move that should have been played
    """
    move: int
    severity: str  # "minor", "major", "critical"
    desc: str
    best_alternative: Dict[str, int]


@dataclass
class Pattern:
    """
    A tactical pattern detected in the game.
    
    Attributes:
        label: Pattern name (e.g., "Tứ Hướng", "Song Song", "Chặn Muộn", "Bỏ Lỡ Thắng")
        explanation: Vietnamese explanation of the pattern
        moves: List of move numbers involved in the pattern
        severity: Severity/importance of the pattern
    """
    label: str
    explanation: str
    moves: List[int]
    severity: str


@dataclass
class BestMove:
    """
    Recommended best move with explanation.
    
    Attributes:
        x: X coordinate of the recommended move
        y: Y coordinate of the recommended move
        score: Expected score after this move
        reason: Vietnamese explanation of why this is the best move
    """
    x: int
    y: int
    score: float
    reason: str


@dataclass
class Summary:
    """
    Overall game summary statistics.
    
    Attributes:
        total_moves: Total number of moves in the game
        winner: Winner of the game ("X", "O", or "draw")
        x_stats: Statistics for player X
        o_stats: Statistics for player O
        key_insights: Top insights from the analysis
    """
    total_moves: int
    winner: Optional[str]
    x_stats: Dict[str, any]
    o_stats: Dict[str, any]
    key_insights: List[str]


@dataclass
class AnalysisResult:
    """
    Complete analysis result for a game.
    
    Attributes:
        tier: Analysis tier ("basic" or "pro")
        timeline: Move-by-move evaluation timeline
        mistakes: List of detected mistakes
        patterns: List of detected tactical patterns
        best_move: Recommended best move (if game not finished)
        summary: Overall game summary
        ai_insights: AI-generated insights (Pro tier only)
        duration_ms: Time taken for analysis in milliseconds
    """
    tier: str
    timeline: List[TimelineEntry]
    mistakes: List[Mistake]
    patterns: List[Pattern]
    best_move: Optional[BestMove]
    summary: Summary
    ai_insights: Optional[Dict] = None
    duration_ms: Optional[int] = None


# Board constants
BOARD_SIZE = 15
WIN_LENGTH = 5


@dataclass
class AlternativeMove:
    """
    Alternative move suggestion with reason and scoring.
    
    Requirements: 5.1, 5.2, 5.3, 5.4
    - 5.1: Suggest 2-3 alternative moves with scores
    - 5.2: Include brief reason for each suggestion
    - 5.3: Highlight best alternative when actual move is blunder
    - 5.4: Indicate when multiple good options exist (similar scores)
    
    Attributes:
        position: Standard notation (e.g., "H8")
        x: Row index (0-14)
        y: Column index (0-14)
        score: Move score (0.0-10.0)
        reason: Brief explanation of why this is a good alternative
        is_best: True if this is the best alternative (highlighted when actual is blunder)
        similar_to_others: True if score is within 0.5 of other alternatives
    """
    position: str  # Standard notation (e.g., "H8")
    x: int
    y: int
    score: float
    reason: str
    is_best: bool = False
    similar_to_others: bool = False


@dataclass
class AltLine:
    """
    Alternative line of play suggestion.
    
    Attributes:
        move: Move number where the alternative starts
        moves: List of alternative moves
        score_change: Score difference from original line
        win_prob_change: Win probability change from original
    """
    move: int
    moves: List[Move]
    score_change: float
    win_prob_change: float


@dataclass
class AIInsights:
    """
    AI-generated insights for Pro analysis.
    
    Attributes:
        natural_language_summary: AI-generated summary in Vietnamese
        mistake_explanations: Detailed explanations for each mistake
        improvement_tips: Personalized improvement suggestions
        advanced_patterns: Advanced patterns detected by AI
    """
    natural_language_summary: str
    mistake_explanations: List[Dict[str, str]]
    improvement_tips: List[str]
    advanced_patterns: List[Dict[str, str]]


@dataclass
class Action:
    """
    Clickable action in AI responses.
    
    Attributes:
        type: Action type ("view_move", "replay_from", "show_alternative")
        label: Display label in Vietnamese
        data: Action-specific data (move number, position, etc.)
    """
    type: str
    label: str
    data: Dict


# ============================================
# API Request/Response Models
# ============================================

@dataclass
class AnalyzeRequest:
    """
    Request model for POST /analyze endpoint.
    
    Attributes:
        match_id: UUID of the match to analyze
        moves: List of moves in the game
        tier: Analysis tier ("basic" or "pro")
        user_id: UUID of the requesting user
        difficulty: Optional training difficulty setting
    """
    match_id: str
    moves: List[Move]
    tier: str  # "basic" or "pro"
    user_id: str
    difficulty: Optional[str] = None


@dataclass
class AnalyzeResponse:
    """
    Response model for POST /analyze endpoint.
    
    Attributes:
        tier: Analysis tier used
        best_move: Recommended best move
        timeline: Move-by-move evaluation
        mistakes: Detected mistakes
        patterns: Detected patterns
        alt_lines: Alternative lines of play
        summary: Game summary
        ai_insights: AI insights (Pro only)
        duration_ms: Analysis duration
    """
    tier: str
    best_move: Optional[BestMove]
    timeline: List[TimelineEntry]
    mistakes: List[Mistake]
    patterns: List[Pattern]
    alt_lines: List[AltLine]
    summary: Summary
    ai_insights: Optional[AIInsights] = None
    duration_ms: int = 0


@dataclass
class AskRequest:
    """
    Request model for POST /ask endpoint.
    
    Attributes:
        match_id: UUID of the match being discussed
        question: User's question in Vietnamese
        user_id: UUID of the requesting user
    """
    match_id: str
    question: str
    user_id: str


@dataclass
class AskResponse:
    """
    Response model for POST /ask endpoint.
    
    Attributes:
        answer: AI-generated answer in Vietnamese
        actions: Optional clickable actions
    """
    answer: str
    actions: Optional[List[Action]] = None


@dataclass
class CreateReplayRequest:
    """
    Request model for POST /replay/create endpoint.
    
    Attributes:
        match_id: UUID of the match to replay
        user_id: UUID of the requesting user
    """
    match_id: str
    user_id: str


@dataclass
class CreateReplayResponse:
    """
    Response model for POST /replay/create endpoint.
    
    Attributes:
        session_id: UUID of the created replay session
        total_moves: Total number of moves in the match
    """
    session_id: str
    total_moves: int


@dataclass
class NavigateReplayRequest:
    """
    Request model for POST /replay/navigate endpoint.
    
    Attributes:
        session_id: UUID of the replay session
        move_index: Target move index to navigate to
    """
    session_id: str
    move_index: int


@dataclass
class NavigateReplayResponse:
    """
    Response model for POST /replay/navigate endpoint.
    
    Attributes:
        board_state: 2D array representing the board at the move
        current_move: Current move index
        player_turn: Which player's turn it is
    """
    board_state: List[List[Optional[str]]]
    current_move: int
    player_turn: str


@dataclass
class PlayReplayRequest:
    """
    Request model for POST /replay/play endpoint.
    
    Attributes:
        session_id: UUID of the replay session
        move: User's move to play
    """
    session_id: str
    move: Move


@dataclass
class PlayReplayResponse:
    """
    Response model for POST /replay/play endpoint.
    
    Attributes:
        board_state: Updated board state
        ai_move: AI's response move
        original_outcome: Win probability in original game
        current_win_prob: Current win probability
        comparison: Comparison analysis text
    """
    board_state: List[List[Optional[str]]]
    ai_move: Optional[Move]
    original_outcome: float
    current_win_prob: float
    comparison: str


@dataclass
class UsageResponse:
    """
    Response model for GET /usage endpoint.
    
    Attributes:
        tier: User's subscription tier
        daily_usage: Usage counts for today
        monthly_usage: Usage counts for this month
        daily_remaining: Remaining daily allowances
        monthly_remaining: Remaining monthly allowances
    """
    tier: str
    daily_usage: Dict[str, int]
    monthly_usage: Dict[str, int]
    daily_remaining: Dict[str, int]
    monthly_remaining: Dict[str, int]


# ============================================
# Replay Engine Types
# ============================================

@dataclass
class ReplaySession:
    """
    Represents an active replay session.
    
    Attributes:
        session_id: Unique identifier for the session
        match_id: UUID of the match being replayed
        original_moves: Original moves from the match
        current_board: Current board state (2D array)
        current_move_index: Current position in the replay
        mode: Current mode ("replay", "play_from_here", "what_if")
        divergence_point: Move index where user diverged from original
        user_id: UUID of the user who created the session
        created_at: Timestamp when session was created
    """
    session_id: str
    match_id: str
    original_moves: List[Move]
    current_board: List[List[Optional[str]]]
    current_move_index: int
    mode: str  # "replay", "play_from_here", "what_if"
    divergence_point: Optional[int] = None
    user_id: Optional[str] = None
    created_at: Optional[str] = None


# ============================================
# Subscription and Usage Types
# ============================================

class SubscriptionTier(Enum):
    """
    Subscription tier levels.
    """
    FREE = "free"
    TRIAL = "trial"
    PRO = "pro"
    PRO_PLUS = "pro_plus"


class FeatureType(Enum):
    """
    Types of features that can be tracked for usage.
    """
    BASIC_ANALYSIS = "basic_analysis"
    PRO_ANALYSIS = "pro_analysis"
    REPLAY = "replay"
    AI_QA = "ai_qa"


# Usage limits per tier (daily/monthly)
USAGE_LIMITS: Dict[SubscriptionTier, Dict[FeatureType, Dict[str, int]]] = {
    SubscriptionTier.FREE: {
        # DEV: Increased limits for development/testing
        FeatureType.BASIC_ANALYSIS: {"daily": 100, "monthly": 1000},
        FeatureType.PRO_ANALYSIS: {"daily": 50, "monthly": 500},
        FeatureType.REPLAY: {"daily": 50, "monthly": 500},
        FeatureType.AI_QA: {"daily": 50, "monthly": 500},
    },
    SubscriptionTier.TRIAL: {
        # DEV: Increased limits for development/testing
        FeatureType.BASIC_ANALYSIS: {"daily": 100, "monthly": 1000},
        FeatureType.PRO_ANALYSIS: {"daily": 50, "monthly": 500},
        FeatureType.REPLAY: {"daily": 50, "monthly": 500},
        FeatureType.AI_QA: {"daily": 50, "monthly": 500},
    },
    SubscriptionTier.PRO: {
        FeatureType.BASIC_ANALYSIS: {"daily": 50, "monthly": 500},
        FeatureType.PRO_ANALYSIS: {"daily": 20, "monthly": 200},
        FeatureType.REPLAY: {"daily": 20, "monthly": 200},
        FeatureType.AI_QA: {"daily": 30, "monthly": 300},
    },
    SubscriptionTier.PRO_PLUS: {
        FeatureType.BASIC_ANALYSIS: {"daily": -1, "monthly": -1},  # -1 = unlimited
        FeatureType.PRO_ANALYSIS: {"daily": -1, "monthly": -1},
        FeatureType.REPLAY: {"daily": -1, "monthly": -1},
        FeatureType.AI_QA: {"daily": -1, "monthly": -1},
    },
}


@dataclass
class Subscription:
    """
    User subscription information.
    
    Attributes:
        id: Subscription UUID
        user_id: User UUID
        tier: Subscription tier
        status: Subscription status
        started_at: When subscription started
        expires_at: When subscription expires
        trial_started_at: When trial started (if applicable)
        auto_renew: Whether to auto-renew
    """
    id: str
    user_id: str
    tier: SubscriptionTier
    status: str  # "active", "cancelled", "expired"
    started_at: str
    expires_at: Optional[str] = None
    trial_started_at: Optional[str] = None
    auto_renew: bool = False


@dataclass
class UsageLog:
    """
    Usage log entry.
    
    Attributes:
        id: Log entry UUID
        user_id: User UUID
        feature: Feature type used
        count: Number of uses
        date: Date of usage
        period: Month period (YYYY-MM)
    """
    id: str
    user_id: str
    feature: FeatureType
    count: int
    date: str
    period: str


# ============================================
# Error Types
# ============================================

@dataclass
class APIError:
    """
    Standard API error response.
    
    Attributes:
        error: Error message
        details: Optional additional details
        reset_at: Optional timestamp when rate limit resets
    """
    error: str
    details: Optional[str] = None
    reset_at: Optional[str] = None


# ============================================
# Helper Functions
# ============================================

def classify_move_score(actual_score: float, best_score: float) -> MoveClassification:
    """
    Classify a move based on its score relative to the best move.
    
    Args:
        actual_score: Score of the actual move played
        best_score: Score of the best possible move
        
    Returns:
        MoveClassification enum value
    """
    if best_score == 0:
        return MoveClassification.OKAY
    
    percentage = (actual_score / best_score) * 100 if best_score > 0 else 0
    
    if percentage >= CLASSIFICATION_THRESHOLDS[MoveClassification.EXCELLENT]:
        return MoveClassification.EXCELLENT
    elif percentage >= CLASSIFICATION_THRESHOLDS[MoveClassification.GOOD]:
        return MoveClassification.GOOD
    elif percentage >= CLASSIFICATION_THRESHOLDS[MoveClassification.OKAY]:
        return MoveClassification.OKAY
    elif percentage >= CLASSIFICATION_THRESHOLDS[MoveClassification.WEAK]:
        return MoveClassification.WEAK
    else:
        return MoveClassification.BLUNDER


def get_threat_score(threat_type: ThreatType) -> int:
    """
    Get the score value for a threat type.
    
    Args:
        threat_type: The type of threat
        
    Returns:
        Integer score value
    """
    return THREAT_SCORES.get(threat_type, 0)


def get_double_threat_score(double_threat_type: DoubleThreatType) -> int:
    """
    Get the score value for a double threat type.
    
    Task 8.2.2: Double Threat Detection
    
    Args:
        double_threat_type: The type of double threat
        
    Returns:
        Integer score value
    """
    return DOUBLE_THREAT_SCORES.get(double_threat_type, 0)


def get_double_threat_severity(double_threat_type: DoubleThreatType) -> str:
    """
    Get the severity level for a double threat type.
    
    Task 8.2.2: Double Threat Detection
    All double threats are critical severity.
    
    Args:
        double_threat_type: The type of double threat
        
    Returns:
        Severity string (always "critical" for double threats)
    """
    return DOUBLE_THREAT_SEVERITY.get(double_threat_type, "critical")


def get_usage_limit(tier: SubscriptionTier, feature: FeatureType, period: str = "daily") -> int:
    """
    Get the usage limit for a tier and feature.
    
    Args:
        tier: Subscription tier
        feature: Feature type
        period: "daily" or "monthly"
        
    Returns:
        Integer limit (-1 for unlimited)
    """
    tier_limits = USAGE_LIMITS.get(tier, {})
    feature_limits = tier_limits.get(feature, {})
    return feature_limits.get(period, 0)
