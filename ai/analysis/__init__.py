# AI Match Analysis System - Analysis Module
# Contains threat detection, position evaluation, and analysis engines

from .types import (
    # Core Types
    ThreatType,
    ThreatPosition,
    ThreatResult,
    MoveClassification,
    EvaluationResult,
    TimelineEntry,
    Mistake,
    Pattern,
    AnalysisResult,
    Move,
    BestMove,
    Summary,
    AltLine,
    AIInsights,
    Action,
    
    # API Request/Response Models
    AnalyzeRequest,
    AnalyzeResponse,
    AskRequest,
    AskResponse,
    CreateReplayRequest,
    CreateReplayResponse,
    NavigateReplayRequest,
    NavigateReplayResponse,
    PlayReplayRequest,
    PlayReplayResponse,
    UsageResponse,
    
    # Replay Engine Types
    ReplaySession,
    
    # Subscription and Usage Types
    SubscriptionTier,
    FeatureType,
    Subscription,
    UsageLog,
    
    # Error Types
    APIError,
    
    # Constants
    THREAT_SCORES,
    CLASSIFICATION_THRESHOLDS,
    BOARD_SIZE,
    WIN_LENGTH,
    USAGE_LIMITS,
    
    # Helper Functions
    classify_move_score,
    get_threat_score,
    get_usage_limit,
)

__all__ = [
    # Core Types
    "ThreatType",
    "ThreatPosition",
    "ThreatResult",
    "MoveClassification",
    "EvaluationResult",
    "TimelineEntry",
    "Mistake",
    "Pattern",
    "AnalysisResult",
    "Move",
    "BestMove",
    "Summary",
    "AltLine",
    "AIInsights",
    "Action",
    
    # API Request/Response Models
    "AnalyzeRequest",
    "AnalyzeResponse",
    "AskRequest",
    "AskResponse",
    "CreateReplayRequest",
    "CreateReplayResponse",
    "NavigateReplayRequest",
    "NavigateReplayResponse",
    "PlayReplayRequest",
    "PlayReplayResponse",
    "UsageResponse",
    
    # Replay Engine Types
    "ReplaySession",
    
    # Subscription and Usage Types
    "SubscriptionTier",
    "FeatureType",
    "Subscription",
    "UsageLog",
    
    # Error Types
    "APIError",
    
    # Constants
    "THREAT_SCORES",
    "CLASSIFICATION_THRESHOLDS",
    "BOARD_SIZE",
    "WIN_LENGTH",
    "USAGE_LIMITS",
    
    # Helper Functions
    "classify_move_score",
    "get_threat_score",
    "get_usage_limit",
    
    # Threat Detection
    "ThreatDetector",
    
    # Position Evaluation
    "PositionEvaluator",
    
    # Basic Analyzer
    "BasicAnalyzer",
]

# Import ThreatDetector
from .threat_detector import ThreatDetector

# Import PositionEvaluator
from .position_evaluator import PositionEvaluator

# Import BasicAnalyzer
from .basic_analyzer import BasicAnalyzer

# Import VCF Search
from .vcf_search import VCFSearch, VCFResult, find_vcf

# Import VCT Search
from .vct_search import (
    VCTSearch,
    VCTResult,
    VCTMoveType,
    DefensiveVCTSearch,
    find_vct,
    find_vct_defense,
)

# Import Threat Space Analysis (Task 8.2.3)
from .threat_space import ThreatSpaceAnalyzer, ThreatSpaceResult

# Import Advanced Evaluator (Task 8.3.1)
from .advanced_evaluator import AdvancedEvaluator

# Import Opening Book (Task 8.4.1)
from .opening_book import (
    OpeningBook,
    Opening,
    OpeningMove,
    OpeningType,
    OpeningEvaluation,
    CommonMistake,
    identify_opening,
    get_opening_analysis,
    suggest_opening_move,
    get_opening_book,
)

# Import Endgame Analyzer (Task 8.5.1)
from .endgame_analyzer import (
    EndgameAnalyzer,
    EndgameResult,
    EndgameType,
    detect_endgame,
    is_endgame,
    # Endgame Solver (Task 8.5.2)
    EndgameSolver,
    EndgameSolution,
    EndgameSolutionType,
    solve_endgame,
    find_winning_sequence,
    find_drawing_sequence,
    # Missed Win Detection (Task 8.5.3)
    MissedWinDetector,
    MissedWin,
    MissedWinAnalysis,
    detect_missed_wins,
    check_move_for_missed_win,
)

# Import Mistake Analyzer (Task 8.6.1)
from .mistake_analyzer import (
    MistakeAnalyzer,
    MistakeCategory,
    CategorizedMistake,
    categorize_mistake,
    analyze_mistakes,
    get_category_label,
    get_category_description,
    MISTAKE_CATEGORY_LABELS,
    MISTAKE_CATEGORY_DESCRIPTIONS,
)

# Import Lesson Generator (Task 8.6.2)
from .lesson_generator import (
    LessonGenerator,
    MiniLesson,
    SimilarPattern,
    PracticePosition,
    generate_lesson,
    generate_lessons_from_game,
    get_lesson_summary,
    LESSON_TEMPLATES,
    SIMILAR_PATTERNS_DB,
)

# Import Alternative Lines Analyzer (Task 8.6.3)
from .alternative_lines import (
    AlternativeLinesAnalyzer,
    AlternativeMove,
    Continuation,
    AlternativeLine,
    AlternativeLinesResult,
    find_alternatives,
    analyze_mistake_alternatives,
    analyze_all_mistakes,
)

# Import Parallel Search (Task 8.7.2)
from .parallel_search import (
    ParallelSearch,
    ParallelSearchConfig,
    ParallelSearchWorker,
    SequentialSearch,
    SearchResult,
    compare_search_results,
)

# Import Basic Search (Basic Analysis Plan - Phase 1)
from .basic_search import (
    BasicSearch,
    SimpleTranspositionTable,
    TTEntry,
    find_best_move,
)

# Import Basic Mistake Analyzer (Basic Analysis Plan - Phase 3)
from .basic_mistake_analyzer import (
    BasicMistakeAnalyzer,
    BasicMistakeCategory,
    BasicMistake,
    BASIC_CATEGORY_LABELS,
    BASIC_CATEGORY_DESCRIPTIONS,
    BASIC_TIPS,
)

# Import Basic VCF Search (Basic Analysis Plan - Phase 4)
from .basic_vcf_search import (
    BasicVCFSearch,
    BasicVCFResult,
    find_basic_vcf,
)

# Import Basic Analysis Lite (Basic Analysis Plan - Integration)
from .basic_analysis_lite import (
    BasicAnalysisLite,
    LiteAnalysisResult,
    analyze_game_lite,
    find_best_move_lite,
)

# Import Board Validation (Gomoku Basic Analysis - Phase 0)
from .board_validation import (
    BoardValidator,
    ValidationResult,
    ValidationErrorCode,
    PatternPriorityManager,
    EdgeCaseHandler,
    PATTERN_PRIORITY,
    FORK_PRIORITY,
    MIN_MOVES_FOR_ANALYSIS,
    VALID_CELL_VALUES,
    validate_board,
    validate_moves,
    check_sufficient_moves,
    get_pattern_priority,
    sort_threats_by_priority,
    create_empty_board,
    apply_moves_to_board,
)

# Import Defensive Pattern Recognizer (Gomoku Basic Analysis - GAP 12)
from .defensive_patterns import (
    DefensivePatternRecognizer,
    DefensivePattern,
    DefensivePatternType,
    DEFENSIVE_PATTERN_NAMES,
    DEFENSIVE_PATTERN_NAMES_VI,
    DEFENSIVE_PATTERN_NAMES_EN,
    DEFENSIVE_PATTERN_NAMES_ZH,
    DEFENSIVE_PATTERN_NAMES_JA,
)

# Import God-Tier modules
try:
    from .bitboard import BitboardThreatDetector, IncrementalThreatTracker
    from .dbs_search import DependencyBasedSearch, DBSResult
    from .god_tier_mistake_analyzer import (
        GodTierMistakeAnalyzer,
        MistakeAnalysisResult,
        MistakeDetail,
        MistakeDimension,
        analyze_move_mistake,
    )
    from .pro_analyzer_v2 import ProAnalyzerV2, analyze_game_god_tier
    GOD_TIER_AVAILABLE = True
except ImportError:
    GOD_TIER_AVAILABLE = False

__all__.extend([
    "VCFSearch",
    "VCFResult",
    "find_vcf",
    "VCTSearch",
    "VCTResult",
    "VCTMoveType",
    "DefensiveVCTSearch",
    "find_vct",
    "find_vct_defense",
    # Threat Space Analysis (Task 8.2.3)
    "ThreatSpaceAnalyzer",
    "ThreatSpaceResult",
    # Advanced Evaluator (Task 8.3.1)
    "AdvancedEvaluator",
    # Opening Book (Task 8.4.1)
    "OpeningBook",
    "Opening",
    "OpeningMove",
    "OpeningType",
    "OpeningEvaluation",
    "CommonMistake",
    "identify_opening",
    "get_opening_analysis",
    "suggest_opening_move",
    "get_opening_book",
    # Endgame Analyzer (Task 8.5.1)
    "EndgameAnalyzer",
    "EndgameResult",
    "EndgameType",
    "detect_endgame",
    "is_endgame",
    # Endgame Solver (Task 8.5.2)
    "EndgameSolver",
    "EndgameSolution",
    "EndgameSolutionType",
    "solve_endgame",
    "find_winning_sequence",
    "find_drawing_sequence",
    # Missed Win Detection (Task 8.5.3)
    "MissedWinDetector",
    "MissedWin",
    "MissedWinAnalysis",
    "detect_missed_wins",
    "check_move_for_missed_win",
    # Mistake Analyzer (Task 8.6.1)
    "MistakeAnalyzer",
    "MistakeCategory",
    "CategorizedMistake",
    "categorize_mistake",
    "analyze_mistakes",
    "get_category_label",
    "get_category_description",
    "MISTAKE_CATEGORY_LABELS",
    "MISTAKE_CATEGORY_DESCRIPTIONS",
    # Lesson Generator (Task 8.6.2)
    "LessonGenerator",
    "MiniLesson",
    "SimilarPattern",
    "PracticePosition",
    "generate_lesson",
    "generate_lessons_from_game",
    "get_lesson_summary",
    "LESSON_TEMPLATES",
    "SIMILAR_PATTERNS_DB",
    # Alternative Lines Analyzer (Task 8.6.3)
    "AlternativeLinesAnalyzer",
    "AlternativeMove",
    "Continuation",
    "AlternativeLine",
    "AlternativeLinesResult",
    "find_alternatives",
    "analyze_mistake_alternatives",
    "analyze_all_mistakes",
    # Parallel Search (Task 8.7.2)
    "ParallelSearch",
    "ParallelSearchConfig",
    "ParallelSearchWorker",
    "SequentialSearch",
    "SearchResult",
    "compare_search_results",
    # Basic Search (Basic Analysis Plan - Phase 1)
    "BasicSearch",
    "SimpleTranspositionTable",
    "TTEntry",
    "find_best_move",
    # Basic Mistake Analyzer (Basic Analysis Plan - Phase 3)
    "BasicMistakeAnalyzer",
    "BasicMistakeCategory",
    "BasicMistake",
    "BASIC_CATEGORY_LABELS",
    "BASIC_CATEGORY_DESCRIPTIONS",
    "BASIC_TIPS",
    # Basic VCF Search (Basic Analysis Plan - Phase 4)
    "BasicVCFSearch",
    "BasicVCFResult",
    "find_basic_vcf",
    # Basic Analysis Lite (Basic Analysis Plan - Integration)
    "BasicAnalysisLite",
    "LiteAnalysisResult",
    "analyze_game_lite",
    "find_best_move_lite",
    # Board Validation (Gomoku Basic Analysis - Phase 0)
    "BoardValidator",
    "ValidationResult",
    "ValidationErrorCode",
    "PatternPriorityManager",
    "EdgeCaseHandler",
    "PATTERN_PRIORITY",
    "FORK_PRIORITY",
    "MIN_MOVES_FOR_ANALYSIS",
    "VALID_CELL_VALUES",
    "validate_board",
    "validate_moves",
    "check_sufficient_moves",
    "get_pattern_priority",
    "sort_threats_by_priority",
    "create_empty_board",
    "apply_moves_to_board",
    # Defensive Pattern Recognizer (Gomoku Basic Analysis - GAP 12)
    "DefensivePatternRecognizer",
    "DefensivePattern",
    "DefensivePatternType",
    "DEFENSIVE_PATTERN_NAMES",
    "DEFENSIVE_PATTERN_NAMES_VI",
    "DEFENSIVE_PATTERN_NAMES_EN",
    "DEFENSIVE_PATTERN_NAMES_ZH",
    "DEFENSIVE_PATTERN_NAMES_JA",
])

# Add God-Tier exports if available
if GOD_TIER_AVAILABLE:
    __all__.extend([
        # Bitboard (God-Tier Tier 1)
        "BitboardThreatDetector",
        "IncrementalThreatTracker",
        # DBS Search (God-Tier Tier 3)
        "DependencyBasedSearch",
        "DBSResult",
        # God-Tier Mistake Analyzer (Tier 4)
        "GodTierMistakeAnalyzer",
        "MistakeAnalysisResult",
        "MistakeDetail",
        "MistakeDimension",
        "analyze_move_mistake",
        # Pro Analyzer V2 (God-Tier)
        "ProAnalyzerV2",
        "analyze_game_god_tier",
        "GOD_TIER_AVAILABLE",
    ])
