"""
AI Match Analysis System - Basic Analyzer

This module implements the BasicAnalyzer class for rule-based game analysis,
providing move-by-move evaluation, mistake detection, pattern recognition,
and Vietnamese language notes.

Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

Task 8.8.3: Integration with Existing System
- Integrated VCF/VCT search for winning sequence detection
- Integrated AdvancedEvaluator for multi-factor position evaluation
- Integrated OpeningBook for opening recognition and analysis
- Integrated EndgameAnalyzer for endgame detection and solving
"""

import time
from typing import List, Optional, Tuple, Dict, Any
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
    DoubleThreatType,
    AlternativeMove,
    BOARD_SIZE,
)
from .threat_detector import ThreatDetector
from .position_evaluator import PositionEvaluator
from .transposition_table import (
    TranspositionTable, EntryType, get_transposition_table
)
from .role_evaluator import RoleEvaluator, PlayerRole
from .comment_generator import CommentGenerator, MultiLangComment, SUPPORTED_LANGUAGES
from .game_metadata import GameMetadata, GameMetadataHandler, GameType, CommentComplexity
from .basic_analysis_optimized import OptimizedBasicAnalyzer
from .metrics_logger import AnalysisMetricsLogger

# Import advanced modules for integration (Task 8.8.3)
try:
    from .vcf_search import VCFSearch, find_vcf
    from .vct_search import VCTSearch, find_vct
    from .advanced_evaluator import AdvancedEvaluator
    from .opening_book import OpeningBook
    from .endgame_analyzer import EndgameAnalyzer, detect_endgame
    ADVANCED_MODULES_AVAILABLE = True
except ImportError:
    ADVANCED_MODULES_AVAILABLE = False

# Import Basic Analysis Plan modules (Phase 1-4)
try:
    from .basic_search import BasicSearch
    from .basic_vcf_search import BasicVCFSearch
    from .basic_mistake_analyzer import BasicMistakeAnalyzer, BasicMistakeCategory
    BASIC_PLAN_MODULES_AVAILABLE = True
except ImportError:
    BASIC_PLAN_MODULES_AVAILABLE = False

# Import Defensive Pattern Recognizer (Task 32 - GAP 12)
# Requirements: 17.1, 17.2, 17.3, 17.4
try:
    from .defensive_patterns import (
        DefensivePatternRecognizer,
        DefensivePattern,
        DefensivePatternType,
    )
    DEFENSIVE_PATTERNS_AVAILABLE = True
except ImportError:
    DEFENSIVE_PATTERNS_AVAILABLE = False

# Import Analysis Cache (Task 35 - GAP 20)
# Requirements: 20.1, 20.2, 20.3, 20.4
try:
    from .analysis_cache import (
        AnalysisCache,
        get_analysis_cache,
    )
    ANALYSIS_CACHE_AVAILABLE = True
except ImportError:
    ANALYSIS_CACHE_AVAILABLE = False

# Import Tempo Analyzer (Task 34 - GAP 16)
# Requirements: 19.1, 19.2, 19.3, 19.4
try:
    from .tempo_analyzer import (
        TempoAnalyzer,
        TempoAnalysis,
        TempoStatus,
        TempoSwitchPoint,
    )
    TEMPO_ANALYZER_AVAILABLE = True
except ImportError:
    TEMPO_ANALYZER_AVAILABLE = False


# Vietnamese note templates for different move qualities
# IMPROVED: Better notes with more context (Basic Analysis Plan - Quick Win #3)
NOTE_TEMPLATES = {
    MoveClassification.EXCELLENT: [
        "Nước đi xuất sắc! {reason}",
        "Tuyệt vời! {reason}",
        "Nước đi hoàn hảo. {reason}",
        "Chính xác! {reason}",
        "Nước đi quyết định! {reason}",
    ],
    MoveClassification.GOOD: [
        "Nước đi tốt. {reason}",
        "Lựa chọn hợp lý. {reason}",
        "Nước đi ổn định. {reason}",
        "Nước đi chắc chắn. {reason}",
        "Phát triển tốt. {reason}",
    ],
    MoveClassification.OKAY: [
        "Nước đi chấp nhận được. {reason}",
        "Nước đi bình thường. {reason}",
        "Có thể chơi tốt hơn. {reason}",
        "Nước đi an toàn. {reason}",
    ],
    MoveClassification.WEAK: [
        "Nước đi yếu. {reason}",
        "Cần cải thiện. {reason}",
        "Bỏ lỡ cơ hội tốt hơn. {reason}",
        "Nước đi thụ động. {reason}",
    ],
    MoveClassification.BLUNDER: [
        "Sai lầm nghiêm trọng! {reason}",
        "Nước đi tệ! {reason}",
        "Lỗi lớn! {reason}",
        "Mất cơ hội! {reason}",
    ],
}

# ADDED: Defensive note templates (Basic Analysis Plan - Quick Win #3)
NOTE_TEMPLATES_DEFENSIVE = [
    "Nước phòng thủ tốt. {reason}",
    "Chặn đúng lúc. {reason}",
    "Phòng thủ chắc chắn. {reason}",
    "Ngăn chặn đe dọa. {reason}",
]

# ADDED: Attacking note templates
NOTE_TEMPLATES_ATTACKING = [
    "Tấn công mạnh mẽ! {reason}",
    "Tạo áp lực tốt. {reason}",
    "Đe dọa nguy hiểm. {reason}",
    "Nước đi chủ động. {reason}",
]

# Pattern labels and explanations in Vietnamese
PATTERN_INFO = {
    "tu_huong": {
        "label": "Tứ Hướng",
        "explanation": "Tạo đe dọa từ 4 hướng khác nhau, rất khó phòng thủ.",
    },
    "song_song": {
        "label": "Song Song",
        "explanation": "Hai đường tấn công song song, buộc đối thủ phải chọn chặn một.",
    },
    "chan_muon": {
        "label": "Chặn Muộn",
        "explanation": "Chặn đe dọa của đối thủ quá muộn, để mất lợi thế.",
    },
    "bo_lo_thang": {
        "label": "Bỏ Lỡ Thắng",
        "explanation": "Bỏ lỡ cơ hội thắng ngay lập tức.",
    },
    "double_three": {
        "label": "Đôi Ba",
        "explanation": "Tạo hai đường ba mở cùng lúc, rất nguy hiểm.",
    },
    "four_three": {
        "label": "Tứ Tam",
        "explanation": "Kết hợp đường bốn và đường ba, đảm bảo thắng.",
    },
}

# Mistake severity descriptions in Vietnamese
MISTAKE_DESCRIPTIONS = {
    "critical": "Sai lầm nghiêm trọng - mất cơ hội thắng hoặc để đối thủ thắng",
    "major": "Sai lầm lớn - mất lợi thế đáng kể",
    "minor": "Sai lầm nhỏ - có nước đi tốt hơn",
}


class BasicAnalyzer:
    """
    Rule-based game analyzer for Gomoku/Caro.
    
    Provides fast analysis (<2s) using threat detection and position
    evaluation to generate move-by-move timeline, detect mistakes,
    identify patterns, and suggest best moves.
    
    Task 8.8.3: Now integrated with advanced search engine:
    - VCF/VCT search for winning sequence detection
    - AdvancedEvaluator for multi-factor position evaluation
    - OpeningBook for opening recognition and analysis
    - EndgameAnalyzer for endgame detection and solving
    
    Requirements:
    - 3.1: Complete analysis within 2 seconds
    - 3.2: Generate timeline with move-by-move evaluation
    - 3.3: Detect mistakes with severity levels and alternatives
    - 3.4: Detect tactical patterns (Tứ Hướng, Song Song, etc.)
    - 3.5: Generate Vietnamese template-based notes
    - 3.6: Return best move recommendation with reason
    """
    
    def __init__(
        self,
        board_size: int = BOARD_SIZE,
        use_tt: bool = True,
        use_advanced: bool = True,
        fast_mode: bool = True,
        metrics_logger: Optional[AnalysisMetricsLogger] = None
    ):
        """
        Initialize the BasicAnalyzer.
        
        Args:
            board_size: Size of the board (default 15x15)
            use_tt: Whether to use transposition table (default True)
            use_advanced: Whether to use advanced modules (VCF/VCT, etc.)
            fast_mode: Use optimized analysis path for performance-sensitive flows
        """
        self.board_size = board_size
        self.threat_detector = ThreatDetector(board_size)
        self.position_evaluator = PositionEvaluator(self.threat_detector, board_size)
        self.use_tt = use_tt
        self._tt = get_transposition_table() if use_tt else None
        self.fast_mode = fast_mode
        self._fast_analyzer = OptimizedBasicAnalyzer(board_size) if fast_mode else None
        self.metrics_logger = metrics_logger or AnalysisMetricsLogger()
        
        # Initialize RoleEvaluator for role-based move scoring (Task 3.3)
        self.role_evaluator = RoleEvaluator(board_size)
        
        # Initialize CommentGenerator for multi-language comments (Task 6.3)
        # Requirements: 4.1 - Generate comments in 4 languages (vi, en, zh, ja)
        self.comment_generator = CommentGenerator()
        
        # Move ordering heuristics
        self._killer_moves: Dict[int, List[Tuple[int, int]]] = {}  # depth -> [killer1, killer2]
        self._history_table: Dict[Tuple[int, int], int] = {}  # (x, y) -> score
        self._max_killers = 2  # Keep 2 killer moves per depth
        
        # Initialize advanced modules (Task 8.8.3)
        self.use_advanced = (not fast_mode) and use_advanced and ADVANCED_MODULES_AVAILABLE
        if self.use_advanced:
            self._vcf_searcher = VCFSearch(board_size, max_depth=20)
            self._vct_searcher = VCTSearch(board_size, max_depth=16)
            self._advanced_evaluator = AdvancedEvaluator(
                self.threat_detector, self.position_evaluator, board_size
            )
            self._opening_book = OpeningBook()
            self._endgame_analyzer = EndgameAnalyzer(board_size)
        else:
            self._vcf_searcher = None
            self._vct_searcher = None
            self._advanced_evaluator = None
            self._opening_book = None
            self._endgame_analyzer = None
        
        # Initialize DefensivePatternRecognizer (Task 32 - GAP 12)
        # Requirements: 17.1, 17.2, 17.3, 17.4
        if DEFENSIVE_PATTERNS_AVAILABLE:
            self._defensive_recognizer = DefensivePatternRecognizer(board_size)
        else:
            self._defensive_recognizer = None
        
        # Initialize TempoAnalyzer (Task 34 - GAP 16)
        # Requirements: 19.1, 19.2, 19.3, 19.4
        if TEMPO_ANALYZER_AVAILABLE:
            self._tempo_analyzer = TempoAnalyzer(board_size)
        else:
            self._tempo_analyzer = None
        
        # Initialize AnalysisCache (Task 35 - GAP 20)
        # Requirements: 20.1, 20.2, 20.3, 20.4
        # - 20.1: Return cached result within 10ms
        # - 20.2: Pattern cache with TTL=600s
        # - 20.3: Pre-loaded comment templates
        # - 20.4: 5x-10x performance improvement
        if ANALYSIS_CACHE_AVAILABLE:
            self._cache = get_analysis_cache()
        else:
            self._cache = None
    
    def analyze_game(
        self, 
        moves: List[Move], 
        language: str = "vi",
        metadata: Optional[GameMetadata] = None
    ) -> AnalysisResult:
        """
        Analyze a complete game move-by-move.
        
        Generates a timeline with evaluation for each move,
        detects mistakes and patterns, and provides a summary.
        
        Task 8.8.3: Now uses advanced modules when available:
        - Opening recognition for early game analysis
        - VCF/VCT search for missed win detection
        - Advanced evaluation for more accurate scoring
        - Endgame analysis for critical positions
        
        Task 6.3: Multi-language comment support
        - Generate comments for each move in timeline
        - Store comments in all 4 languages in analysis result
        - Requirements: 4.1
        
        Task 28.3: Game metadata integration
        - Accept metadata parameter for context-aware analysis
        - Apply strictness multiplier based on game type
        - Adjust comment complexity based on player ELO
        - Requirements: 14.1, 14.2, 14.3, 14.4
        
        Args:
            moves: List of moves in the game
            language: Target language for primary comments (vi, en, zh, ja)
            metadata: Optional game metadata for context-aware analysis
            
        Returns:
            AnalysisResult with timeline, mistakes, patterns, and summary
        """
        # Validate language parameter
        if language not in SUPPORTED_LANGUAGES:
            language = "vi"

        if self.fast_mode and self._fast_analyzer is not None:
            return self._fast_analyzer.analyze_game(moves, language)
        start_time = time.time()
        
        # Initialize metadata handler (Task 28.3)
        # Requirements: 14.1 - Support game_type, rule_variant, time_control, player_elo
        self._metadata_handler = GameMetadataHandler(metadata)
        
        # Initialize empty board
        board = [[None for _ in range(self.board_size)] for _ in range(self.board_size)]
        
        timeline: List[TimelineEntry] = []
        mistakes: List[Mistake] = []
        all_best_moves: List[Tuple[int, List[Tuple[int, int, float]]]] = []
        
        # Opening analysis (Task 8.8.3)
        opening_info = None
        if self.use_advanced and self._opening_book and len(moves) <= 10:
            opening_info = self._analyze_opening(moves)
        
        # Analyze each move
        for i, move in enumerate(moves):
            move_number = i + 1
            player = move.player
            
            # Check for endgame conditions (Task 8.8.3)
            is_endgame = False
            if self.use_advanced and self._endgame_analyzer and i >= 10:
                endgame_result = self._endgame_analyzer.detect_endgame(board, check_vcf=True, check_vct=False)
                is_endgame = endgame_result.is_endgame
            
            # Find best moves before making this move
            # Use deeper search in endgame, shallow in opening/midgame
            search_depth = 2 if is_endgame else 1
            best_moves = self.find_best_moves(board, player, depth=search_depth, top_n=3)
            all_best_moves.append((move_number, best_moves))
            
            # Check for missed VCF/VCT (Task 8.8.3)
            missed_win = None
            if self.use_advanced and self._vcf_searcher:
                missed_win = self._check_missed_win(board, player, move)
            
            # Evaluate the actual move using advanced evaluator if available
            if self.use_advanced and self._advanced_evaluator:
                actual_score = self._advanced_evaluator.evaluate_position(
                    self._board_with_move(board, move.x, move.y, player), player
                ).score
            else:
                actual_score = self.position_evaluator.evaluate_move(
                    board, move.x, move.y, player
                )
            
            # Apply role-based scoring adjustment (Task 3.3)
            # Requirements: 3.4, 3.5, 3.6 - Adjust move scoring based on role
            role_score = self.role_evaluator.score_move_by_role(
                board, (move.x, move.y), player
            )
            # Blend role-based score with position score (30% role influence)
            actual_score = actual_score * 0.7 + role_score.total_score * 0.3
            
            # Apply strictness multiplier based on game context (Task 28.3)
            # Requirements: 14.2, 14.3 - Tournament stricter, casual more lenient
            actual_score = self._metadata_handler.adjust_score(actual_score)
            
            # Get best move score for comparison
            best_score = best_moves[0][2] if best_moves else 0
            # Also adjust best_score for fair comparison
            best_score = self._metadata_handler.adjust_score(best_score)
            
            # Classify the move using context-aware thresholds (Task 28.3)
            # Requirements: 14.2 - Tournament games have stricter thresholds
            category = self._classify_move_with_context(actual_score, best_score)
            
            # WINNING MOVE OVERRIDE: If move creates OPEN_FOUR or FIVE, it's at least GOOD
            # Even if there was a "better" move, creating a winning threat is excellent play
            player_threats_after = self.threat_detector.detect_all_threats(board, player)
            # Note: board already has the move applied at this point
            temp_board = [row[:] for row in board]
            temp_board[move.x][move.y] = player
            player_threats_with_move = self.threat_detector.detect_all_threats(temp_board, player)
            if (player_threats_with_move.threats.get(ThreatType.FIVE, 0) > 0 or
                player_threats_with_move.threats.get(ThreatType.OPEN_FOUR, 0) > 0):
                # This is a winning move - at minimum GOOD, likely EXCELLENT
                if category in [MoveClassification.BLUNDER, MoveClassification.WEAK, MoveClassification.OKAY]:
                    category = MoveClassification.GOOD
            
            # EARLY GAME TOLERANCE: First 5 moves are more flexible
            # In opening, most center moves are roughly equivalent
            opponent = "O" if player == "X" else "X"
            opp_threats = self.threat_detector.detect_all_threats(board, opponent)
            player_threats = self.threat_detector.detect_all_threats(board, player)
            
            # Check for immediate threats that require action
            has_immediate_threat = (
                opp_threats.threats.get(ThreatType.FOUR, 0) > 0 or
                opp_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0 or
                opp_threats.threats.get(ThreatType.FIVE, 0) > 0 or
                opp_threats.threats.get(ThreatType.OPEN_THREE, 0) > 0
            )
            
            # Check if player has significant threats (OPEN_THREE or better)
            has_significant_player_threat = (
                player_threats.threats.get(ThreatType.FOUR, 0) > 0 or
                player_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0 or
                player_threats.threats.get(ThreatType.OPEN_THREE, 0) > 0
            )
            
            # EARLY GAME: First 8 moves are more flexible (opening phase)
            if move_number <= 8:
                if category == MoveClassification.BLUNDER:
                    if not has_immediate_threat and not has_significant_player_threat:
                        # No significant threats - opening moves are flexible
                        category = MoveClassification.OKAY
                    elif not has_immediate_threat:
                        # Player has some threats but opponent doesn't - downgrade to WEAK
                        category = MoveClassification.WEAK
                elif category == MoveClassification.EXCELLENT and not has_immediate_threat and not has_significant_player_threat:
                    # Early game without special threat - cap at GOOD
                    category = MoveClassification.GOOD
            
            # Make the move on the board
            board[move.x][move.y] = player
            
            # Evaluate position after move using advanced evaluator if available
            if self.use_advanced and self._advanced_evaluator:
                eval_result = self._advanced_evaluator.evaluate_position(board, player)
            else:
                eval_result = self.position_evaluator.evaluate_position(board, player)
            
            # Determine player role based on board evaluation (Task 3.3)
            # Requirements: 3.1, 3.2, 3.3
            role_eval = self.role_evaluator.determine_role(board, player)
            player_role = role_eval.role.value  # "attacker", "defender", or "neutral"
            
            # Generate note for this move (enhanced with opening/endgame info)
            note = self._generate_enhanced_note(
                move, category, actual_score, best_score, eval_result,
                opening_info if i < 5 else None,
                is_endgame,
                missed_win
            )
            
            # Generate multi-language comments (Task 6.3)
            # Requirements: 4.1 - Generate comments in 4 languages (vi, en, zh, ja)
            threats_created = self._extract_threat_types(eval_result.threats, player)
            
            # Get opponent threats before this move to detect blocked threats
            opponent = "O" if player == "X" else "X"
            board_before = [row[:] for row in board]
            board_before[move.x][move.y] = None  # Undo move temporarily
            opp_threats_before = self.threat_detector.detect_all_threats(board_before, opponent)
            opp_threats_after = self.threat_detector.detect_all_threats(board, opponent)
            threats_blocked = self._detect_blocked_threats(opp_threats_before, opp_threats_after)
            
            # Determine if this is a winning move
            is_winning = eval_result.threats.threats.get(ThreatType.FIVE, 0) > 0
            
            # Determine if this was a forced response
            is_forced = (
                opp_threats_before.threats.get(ThreatType.OPEN_FOUR, 0) > 0 or
                opp_threats_before.threats.get(ThreatType.FOUR, 0) > 0
            )
            
            # Get better move notation if this is a blunder
            better_move_notation = None
            if category == MoveClassification.BLUNDER and best_moves:
                from .coordinate_utils import index_to_notation
                best_x, best_y, _ = best_moves[0]
                better_move_notation = index_to_notation(best_x, best_y)

            # Cultural scenario tagging
            scenario = None
            if category == MoveClassification.BLUNDER and better_move_notation:
                scenario = "missed_win"
            elif len(threats_created) >= 2:
                scenario = "fork"
            elif threats_blocked and category in [MoveClassification.GOOD, MoveClassification.EXCELLENT, MoveClassification.OKAY]:
                scenario = "brave_defense"
            
            # Generate comments in all 4 languages
            # Task 28.3: Adjust comment complexity based on player ELO
            # Requirements: 14.4 - Use simple vocabulary for beginners
            multi_lang_comment = self.comment_generator.generate_all_languages(
                classification=category,
                threats_created=threats_created,
                threats_blocked=threats_blocked,
                is_winning=is_winning,
                is_forced=is_forced,
                better_move=better_move_notation,
                scenario=scenario,
                use_cultural=bool(scenario)
            )
            
            # Apply comment complexity adjustment for beginners (Task 28.3)
            # Requirements: 14.4 - Simple vocabulary for ELO < 1200
            if self._metadata_handler.should_use_simple_vocabulary(player):
                multi_lang_comment = self._simplify_comments(multi_lang_comment)
            
            # Generate alternative move suggestions (Task 7.1)
            # Requirements: 5.1, 5.2, 5.3, 5.4
            # - 5.1: Suggest 2-3 alternative moves with scores
            # - 5.2: Include brief reason for each suggestion
            # - 5.3: Highlight best alternative when actual move is blunder
            # - 5.4: Indicate when multiple good options exist (similar scores)
            alternatives = self.generate_alternatives(
                board_before,  # Use board state BEFORE this move
                player,
                actual_move=(move.x, move.y),
                actual_category=category
            )
            
            # Calculate board evaluation before and after move (Task 9.1)
            # Requirements: 6.1, 6.2, 6.4 - Timeline with evaluation changes
            # Get score before this move (from previous timeline entry or 0 for first move)
            score_before = timeline[-1].score if timeline else 0.0
            score_after = eval_result.score
            score_change = score_after - score_before
            
            # Determine if this is a significant or critical moment (Task 9.1)
            # Requirements: 6.2 - Significant if change > 20
            # Requirements: 6.4 - Critical if change > 50
            is_significant = abs(score_change) > 20
            is_critical = abs(score_change) > 50
            
            # Tempo analysis (Task 34 - GAP 16)
            # Requirements: 19.1, 19.2, 19.3, 19.4
            tempo_is_forcing = False
            tempo_change_val = 0
            tempo_initiative = "neutral"
            tempo_is_switch = False
            tempo_explanation_dict = None
            
            if self._tempo_analyzer is not None:
                # Get previous initiative holder
                prev_initiative = "neutral"
                if timeline:
                    prev_initiative = timeline[-1].initiative_holder
                
                # Analyze tempo for this move
                tempo_result = self._tempo_analyzer.analyze_tempo(
                    board_before,  # Board state before this move
                    board,  # Board state after this move
                    move.x,
                    move.y,
                    player,
                    prev_initiative
                )
                
                tempo_is_forcing = tempo_result.is_forcing
                tempo_change_val = tempo_result.tempo_change
                tempo_initiative = tempo_result.initiative_holder
                tempo_is_switch = (prev_initiative != tempo_initiative and tempo_initiative != "neutral")
                tempo_explanation_dict = {
                    "vi": tempo_result.explanation_vi,
                    "en": tempo_result.explanation_en,
                    "zh": tempo_result.explanation_zh,
                    "ja": tempo_result.explanation_ja
                }
            
            # Create timeline entry with role field (Task 3.3), comments (Task 6.3), alternatives (Task 7.1), evaluation changes (Task 9.1), and tempo (Task 34)
            entry = TimelineEntry(
                move=move_number,
                player=player,
                position={"x": move.x, "y": move.y},
                score=eval_result.score,
                win_prob=eval_result.win_probability,
                category=category,
                note=note,
                role=player_role,
                comments=multi_lang_comment.to_dict(),
                alternatives=alternatives,
                score_before=score_before,
                score_change=score_change,
                is_significant=is_significant,
                is_critical=is_critical,
                is_forcing=tempo_is_forcing,
                tempo_change=tempo_change_val,
                initiative_holder=tempo_initiative,
                is_tempo_switch=tempo_is_switch,
                tempo_explanation=tempo_explanation_dict
            )
            timeline.append(entry)
            
            # Check for mistakes (enhanced with missed win detection)
            # FIXED: Skip mistake detection if this move wins the game
            # FIVE = already won, OPEN_FOUR = guaranteed win next move
            # BUT: If opponent had OPEN_FOUR before our move, we MUST block!
            player_has_five = eval_result.threats.threats.get(ThreatType.FIVE, 0) > 0
            player_has_open_four = eval_result.threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0
            
            # Check if opponent had OPEN_FOUR before this move (must block!)
            opponent = "O" if player == "X" else "X"
            board_before_move = [row[:] for row in board]
            board_before_move[move.x][move.y] = None  # Undo the move temporarily
            opp_threats_before_move = self.threat_detector.detect_all_threats(board_before_move, opponent)
            opp_had_open_four = opp_threats_before_move.threats.get(ThreatType.OPEN_FOUR, 0) > 0
            opp_had_four = opp_threats_before_move.threats.get(ThreatType.FOUR, 0) > 0
            
            # Only consider winning if we actually win (FIVE) or opponent doesn't have immediate win
            is_winning_move = player_has_five or (player_has_open_four and not opp_had_open_four and not opp_had_four)
            
            # FIXED: Check if this move successfully blocked opponent's immediate threat
            # Now includes: OPEN_FOUR, OPEN_THREE, DOUBLE_THREE, FOUR_THREE, DOUBLE_FOUR
            is_good_defense = False
            if not is_winning_move:
                opponent = "O" if player == "X" else "X"
                # Get opponent threats BEFORE this move (board state before applying move)
                board_before_move = [row[:] for row in board]
                board_before_move[move.x][move.y] = None  # Undo the move temporarily
                opp_threats_before = self.threat_detector.detect_all_threats(board_before_move, opponent)
                
                # Check for dangerous threats that need blocking
                opp_open_four_before = opp_threats_before.threats.get(ThreatType.OPEN_FOUR, 0)
                opp_four_before = opp_threats_before.threats.get(ThreatType.FOUR, 0)
                opp_open_three_before = opp_threats_before.threats.get(ThreatType.OPEN_THREE, 0)
                
                # Check for double threats (very dangerous!)
                opp_double_four_before = opp_threats_before.double_threats.get(DoubleThreatType.DOUBLE_FOUR, 0)
                opp_four_three_before = opp_threats_before.double_threats.get(DoubleThreatType.FOUR_THREE, 0)
                opp_double_three_before = opp_threats_before.double_threats.get(DoubleThreatType.DOUBLE_THREE, 0)
                
                # Get threats after our move
                opp_threats_after = self.threat_detector.detect_all_threats(board, opponent)
                
                # Check if we blocked OPEN_FOUR (critical)
                if opp_open_four_before > 0:
                    opp_open_four_after = opp_threats_after.threats.get(ThreatType.OPEN_FOUR, 0)
                    if opp_open_four_after < opp_open_four_before:
                        is_good_defense = True
                
                # Check if we blocked FOUR (important)
                if not is_good_defense and opp_four_before > 0:
                    opp_four_after = opp_threats_after.threats.get(ThreatType.FOUR, 0)
                    if opp_four_after < opp_four_before:
                        is_good_defense = True
                
                # Check if we blocked OPEN_THREE (good defense)
                if not is_good_defense and opp_open_three_before > 0:
                    opp_open_three_after = opp_threats_after.threats.get(ThreatType.OPEN_THREE, 0)
                    if opp_open_three_after < opp_open_three_before:
                        is_good_defense = True
                
                # Check if we blocked DOUBLE_FOUR (critical - guaranteed win for opponent)
                if not is_good_defense and opp_double_four_before > 0:
                    opp_double_four_after = opp_threats_after.double_threats.get(DoubleThreatType.DOUBLE_FOUR, 0)
                    if opp_double_four_after < opp_double_four_before:
                        is_good_defense = True
                
                # Check if we blocked FOUR_THREE (critical - guaranteed win for opponent)
                if not is_good_defense and opp_four_three_before > 0:
                    opp_four_three_after = opp_threats_after.double_threats.get(DoubleThreatType.FOUR_THREE, 0)
                    if opp_four_three_after < opp_four_three_before:
                        is_good_defense = True
                
                # Check if we blocked DOUBLE_THREE (very dangerous)
                if not is_good_defense and opp_double_three_before > 0:
                    opp_double_three_after = opp_threats_after.double_threats.get(DoubleThreatType.DOUBLE_THREE, 0)
                    if opp_double_three_after < opp_double_three_before:
                        is_good_defense = True
            
            severity = None
            if not is_winning_move and not is_good_defense:
                severity = self.position_evaluator.determine_mistake_severity(
                    actual_score, best_score
                )
                
                # Upgrade severity if missed win detected
                if missed_win and missed_win.get('found'):
                    severity = 'critical'
            
            if severity and best_moves and not is_winning_move and not is_good_defense:
                best_alt = best_moves[0]
                
                # FIXED: Skip if best move is the same as actual move (not a mistake)
                if best_alt[0] == move.x and best_alt[1] == move.y:
                    continue
                
                desc = self._generate_mistake_description(
                    move, severity, best_alt, actual_score, best_score
                )
                # Add missed win info to description
                if missed_win and missed_win.get('found'):
                    miss_type = missed_win.get('type', 'missed_vcf')
                    if miss_type == 'failed_block_open_four':
                        desc = f"Không chặn tứ mở! {desc}"
                    elif miss_type == 'failed_defense':
                        desc = f"Không chặn VCF đối thủ! {desc}"
                    else:
                        desc = f"Bỏ lỡ thắng! {desc}"
                
                mistake = Mistake(
                    move=move_number,
                    severity=severity,
                    desc=desc,
                    best_alternative={"x": best_alt[0], "y": best_alt[1]}
                )
                mistakes.append(mistake)
        
        # Detect patterns (enhanced with advanced detection)
        patterns = self.detect_patterns(timeline, all_best_moves, moves)
        
        # Add opening pattern if detected
        if opening_info and opening_info.get('name'):
            patterns.insert(0, Pattern(
                label=f"Khai cuộc: {opening_info['name']}",
                explanation=opening_info.get('description', ''),
                moves=[1, 2, 3],
                severity="info"
            ))
        
        # Generate summary (enhanced)
        summary = self.generate_summary(timeline, mistakes, moves)
        
        # Find best move for current position (if game not finished)
        best_move = None
        if moves and not self._is_game_over(board):
            next_player = "O" if moves[-1].player == "X" else "X"
            
            # Use VCF search first for winning moves (Task 8.8.3)
            if self.use_advanced and self._vcf_searcher:
                vcf_result = self._vcf_searcher.search(board, next_player)
                if vcf_result.found and vcf_result.sequence:
                    first_move = vcf_result.sequence[0]
                    best_move = BestMove(
                        x=first_move[0],
                        y=first_move[1],
                        score=10000.0,
                        reason=f"VCF thắng trong {vcf_result.depth} nước!"
                    )
            
            # Fall back to regular search if no VCF
            if not best_move:
                best_moves = self.find_best_moves(board, next_player, depth=1, top_n=1)
                if best_moves:
                    bm = best_moves[0]
                    best_move = BestMove(
                        x=bm[0],
                        y=bm[1],
                        score=bm[2],
                        reason=self._generate_best_move_reason(board, bm, next_player)
                    )
        
        duration_ms = int((time.time() - start_time) * 1000)
        if self.metrics_logger:
            self.metrics_logger.log_analysis_complete(duration_ms, len(moves), tier="basic")
        
        return AnalysisResult(
            tier="basic",
            timeline=timeline,
            mistakes=mistakes,
            patterns=patterns,
            best_move=best_move,
            summary=summary,
            duration_ms=duration_ms
        )
    
    def _analyze_opening(self, moves: List[Move]) -> Optional[Dict[str, Any]]:
        """
        Analyze the opening using the opening book.
        
        Task 8.8.3: Opening recognition integration
        
        Args:
            moves: List of moves to analyze
            
        Returns:
            Opening info dict or None
        """
        if not self._opening_book or len(moves) < 3:
            return None
        
        try:
            # Convert moves to format expected by opening book
            opening_moves = [(m.x, m.y, m.player) for m in moves[:5]]
            opening = self._opening_book.identify_opening(opening_moves)
            
            if opening:
                return {
                    'name': opening.name,
                    'name_en': opening.name_en,
                    'description': opening.description,
                    'evaluation': opening.evaluation.value,
                    'evaluation_score': opening.evaluation_score,
                    'key_ideas': opening.key_ideas
                }
        except Exception:
            pass
        
        return None
    
    def _check_missed_win(
        self,
        board: List[List[Optional[str]]],
        player: str,
        actual_move: Move
    ) -> Optional[Dict[str, Any]]:
        """
        Check if the player missed a winning VCF sequence.
        
        Task 8.8.3: Missed win detection using VCF search
        
        FIXED: Now properly checks:
        1. If player had VCF and played the winning move → NOT a mistake
        2. If player had VCF but played elsewhere → check if defensive move was needed
        3. If actual move creates FIVE → NOT a mistake (player won!)
        4. If opponent had VCF/OPEN_FOUR and player blocked it → NOT a mistake (good defense!)
        
        Args:
            board: Board state before the move
            player: Player who made the move
            actual_move: The actual move played
            
        Returns:
            Dict with missed win info or None
        """
        if not self._vcf_searcher:
            return None
        
        try:
            opponent = "O" if player == "X" else "X"
            
            # FIRST: Check if the actual move creates FIVE or OPEN_FOUR (winning move)
            # If so, this is NOT a mistake - player won or will win!
            board_after = [row[:] for row in board]
            board_after[actual_move.x][actual_move.y] = player
            threats_after = self.threat_detector.detect_all_threats(board_after, player)
            if threats_after.threats.get(ThreatType.FIVE, 0) > 0:
                # Player won with this move - definitely not a mistake!
                return None
            if threats_after.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                # Player created OPEN_FOUR - this is a winning move!
                # OPEN_FOUR guarantees win on next move
                return None
            
            # SECOND: Check if opponent had immediate threat that needed blocking
            opp_threats_before = self.threat_detector.detect_all_threats(board, opponent)
            opp_had_open_four = opp_threats_before.threats.get(ThreatType.OPEN_FOUR, 0) > 0
            opp_had_four = opp_threats_before.threats.get(ThreatType.FOUR, 0) > 0
            opp_had_vcf = False
            
            if not opp_had_open_four:
                opp_vcf = self._vcf_searcher.search(board, opponent)
                opp_had_vcf = opp_vcf.found
            
            # If opponent had immediate threat, check if player blocked it
            if opp_had_open_four or opp_had_vcf:
                opp_threats_after = self.threat_detector.detect_all_threats(board_after, opponent)
                opp_open_four_before = opp_threats_before.threats.get(ThreatType.OPEN_FOUR, 0)
                opp_open_four_after = opp_threats_after.threats.get(ThreatType.OPEN_FOUR, 0)
                
                # If we successfully blocked opponent's OPEN_FOUR, this is good defense
                # Even if we had our own VCF, blocking opponent's immediate threat is valid
                if opp_had_open_four and opp_open_four_after < opp_open_four_before:
                    # Successfully blocked at least one OPEN_FOUR - not a mistake
                    return None
                
                # If opponent still has OPEN_FOUR after our move, we failed to block!
                if opp_had_open_four and opp_open_four_after >= opp_open_four_before:
                    # Find the blocking position for opponent's OPEN_FOUR
                    best_block = self._find_open_four_block(board, opponent)
                    if best_block:
                        return {
                            'found': True,
                            'type': 'failed_block_open_four',
                            'winning_sequence': [],
                            'depth': 1,
                            'best_move': best_block
                        }
                
                # Check if opponent's VCF is still valid after our move
                opp_vcf_after = self._vcf_searcher.search(board_after, opponent)
                
                if opp_had_vcf and not opp_vcf_after.found:
                    # Successfully blocked opponent's VCF - not a mistake
                    return None
                
                # If opponent had VCF and we blocked their first move, it's good defense
                if opp_had_vcf:
                    opp_vcf = self._vcf_searcher.search(board, opponent)
                    if opp_vcf.found and opp_vcf.sequence:
                        first_opp_vcf = opp_vcf.sequence[0]
                        # Check if our move blocks opponent's VCF first move
                        if actual_move.x == first_opp_vcf[0] and actual_move.y == first_opp_vcf[1]:
                            return None
            
            # THIRD: Check if player blocked opponent's OPEN_THREE
            # Blocking OPEN_THREE is a valid defensive move, even if player had VCF
            opp_open_three_before = opp_threats_before.threats.get(ThreatType.OPEN_THREE, 0)
            if opp_open_three_before > 0:
                opp_threats_after = self.threat_detector.detect_all_threats(board_after, opponent)
                opp_open_three_after = opp_threats_after.threats.get(ThreatType.OPEN_THREE, 0)
                if opp_open_three_after < opp_open_three_before:
                    # Successfully blocked OPEN_THREE - this is valid defense
                    # Not a mistake even if player had VCF
                    return None
            
            # FOURTH: Check if player had VCF before making this move
            vcf_result = self._vcf_searcher.search(board, player)
            
            if vcf_result.found and vcf_result.sequence:
                # Player had VCF - check if they played the winning move
                first_vcf_move = vcf_result.sequence[0]
                if (first_vcf_move[0] != actual_move.x or 
                    first_vcf_move[1] != actual_move.y):
                    # Player missed the winning move!
                    # But only if opponent didn't have a faster VCF
                    if opp_had_vcf:
                        opp_vcf = self._vcf_searcher.search(board, opponent)
                        if opp_vcf.found and opp_vcf.depth <= vcf_result.depth:
                            # Opponent's VCF is faster or equal - player needed to defend
                            # Check if player's move actually blocked opponent's VCF
                            opp_vcf_after = self._vcf_searcher.search(board_after, opponent)
                            if not opp_vcf_after.found:
                                # Successfully blocked - not a mistake
                                return None
                            # Player didn't block opponent's VCF - this is a mistake!
                            # Return the defensive move as best_move
                            if opp_vcf.sequence:
                                first_opp_move = opp_vcf.sequence[0]
                                return {
                                    'found': True,
                                    'type': 'failed_defense',
                                    'winning_sequence': [],
                                    'depth': opp_vcf.depth,
                                    'best_move': (first_opp_move[0], first_opp_move[1])
                                }
                    
                    return {
                        'found': True,
                        'type': 'missed_vcf',
                        'winning_sequence': vcf_result.sequence,
                        'depth': vcf_result.depth,
                        'best_move': (first_vcf_move[0], first_vcf_move[1])
                    }
        except Exception:
            pass
        
        return None
    
    def _find_open_four_block(
        self,
        board: List[List[Optional[str]]],
        opponent: str
    ) -> Optional[Tuple[int, int]]:
        """Find the position to block opponent's OPEN_FOUR."""
        # Try all empty positions and find one that blocks the OPEN_FOUR
        for x in range(BOARD_SIZE):
            for y in range(BOARD_SIZE):
                if board[x][y] is None:
                    # Try placing our piece here
                    test_board = [row[:] for row in board]
                    player = "O" if opponent == "X" else "X"
                    test_board[x][y] = player
                    threats_after = self.threat_detector.detect_all_threats(test_board, opponent)
                    if threats_after.threats.get(ThreatType.OPEN_FOUR, 0) == 0:
                        return (x, y)
        return None
    
    def _board_with_move(
        self,
        board: List[List[Optional[str]]],
        x: int,
        y: int,
        player: str
    ) -> List[List[Optional[str]]]:
        """Create a copy of the board with a move applied."""
        new_board = [row[:] for row in board]
        new_board[x][y] = player
        return new_board
    
    def _simplify_comments(self, multi_lang_comment: MultiLangComment) -> MultiLangComment:
        """
        Simplify comments for beginner players.
        
        Task 28.3: Comment complexity adjustment
        Requirements: 14.4 - Use simple vocabulary for ELO < 1200
        
        Args:
            multi_lang_comment: Original multi-language comments
            
        Returns:
            Simplified MultiLangComment
        """
        from .game_metadata import get_simple_term
        
        # Get comments as dict
        comments = multi_lang_comment.to_dict()
        simplified = {}
        
        # Technical terms to simplify
        term_mappings = {
            "fork": "fork",
            "Fork": "fork",
            "FORK": "fork",
            "đa đường": "fork",
            "双杀": "fork",
            "フォーク": "fork",
            "tứ mở": "open_four",
            "Tứ Mở": "open_four",
            "活四": "open_four",
            "四々": "open_four",
            "open four": "open_four",
            "Open Four": "open_four",
            "tứ kín": "closed_four",
            "Tứ Kín": "closed_four",
            "冲四": "closed_four",
            "四": "closed_four",
            "tam mở": "open_three",
            "Tam Mở": "open_three",
            "活三": "open_three",
            "三々": "open_three",
        }
        
        for lang, comment in comments.items():
            simplified_comment = comment
            # Replace technical terms with simple explanations
            for term, key in term_mappings.items():
                if term in simplified_comment:
                    simple = get_simple_term(key, lang)
                    simplified_comment = simplified_comment.replace(term, simple)
            simplified[lang] = simplified_comment
        
        return MultiLangComment(**simplified)
    
    def _classify_move_with_context(
        self,
        actual_score: float,
        best_score: float
    ) -> MoveClassification:
        """
        Classify move using context-aware thresholds.
        
        Task 28.3: Context-aware move classification
        Requirements: 14.2, 14.3 - Tournament stricter, casual more lenient
        
        Args:
            actual_score: Score of the actual move (already adjusted)
            best_score: Score of the best move (already adjusted)
            
        Returns:
            MoveClassification based on game context
        """
        # Get rating from metadata handler (uses context-aware thresholds)
        rating = self._metadata_handler.get_rating_for_score(actual_score)
        
        # Map rating string to MoveClassification
        rating_to_classification = {
            "excellent": MoveClassification.EXCELLENT,
            "good": MoveClassification.GOOD,
            "average": MoveClassification.OKAY,
            "poor": MoveClassification.WEAK,
            "blunder": MoveClassification.BLUNDER
        }
        
        # Get base classification from rating
        base_classification = rating_to_classification.get(rating, MoveClassification.OKAY)
        
        # Also consider score difference from best move
        score_diff = best_score - actual_score
        
        # CRITICAL: If best move is a winning move (score >= 10000) and we didn't play it
        # This is a serious mistake - missed win opportunity
        if best_score >= 10000 and actual_score < 10000:
            # Missed a winning move - this is at least WEAK, possibly BLUNDER
            if score_diff > 5000:
                return MoveClassification.BLUNDER  # Missed clear win
            elif score_diff > 1000:
                return MoveClassification.WEAK  # Missed good winning opportunity
        
        # If score difference is significant, may need to downgrade
        if score_diff > 5000:
            # Huge score loss - this is a blunder
            return MoveClassification.BLUNDER
        elif score_diff > 1000:
            # Large score loss - this is weak
            return MoveClassification.WEAK
        elif score_diff > 200:
            # Moderate score loss - downgrade appropriately
            if base_classification == MoveClassification.EXCELLENT:
                return MoveClassification.OKAY
            elif base_classification == MoveClassification.GOOD:
                return MoveClassification.WEAK
        elif score_diff > 50:
            # Small score loss - downgrade by one level
            if base_classification == MoveClassification.EXCELLENT:
                return MoveClassification.GOOD
            elif base_classification == MoveClassification.GOOD:
                return MoveClassification.OKAY
            elif base_classification == MoveClassification.OKAY:
                return MoveClassification.WEAK
        
        return base_classification
    
    def _generate_enhanced_note(
        self,
        move: Move,
        category: MoveClassification,
        actual_score: float,
        best_score: float,
        eval_result,
        opening_info: Optional[Dict] = None,
        is_endgame: bool = False,
        missed_win: Optional[Dict] = None
    ) -> str:
        """
        Generate an enhanced Vietnamese note for a move.
        
        Task 8.8.3: Enhanced notes with opening/endgame context
        
        Args:
            move: The move being described
            category: Classification of the move
            actual_score: Score of the actual move
            best_score: Score of the best move
            eval_result: Position evaluation result
            opening_info: Opening analysis info (if in opening)
            is_endgame: Whether position is endgame
            missed_win: Missed win info (if any)
            
        Returns:
            Vietnamese description string
        """
        # Check for missed win first
        if missed_win and missed_win.get('found'):
            miss_type = missed_win.get('type', 'missed_vcf')
            if miss_type == 'failed_block_open_four':
                return f"Không chặn tứ mở của đối thủ! Nên đi ({missed_win['best_move'][0]}, {missed_win['best_move'][1]})"
            elif miss_type == 'failed_defense':
                return f"Không chặn VCF của đối thủ! Nên đi ({missed_win['best_move'][0]}, {missed_win['best_move'][1]})"
            else:
                return f"Bỏ lỡ VCF thắng trong {missed_win['depth']} nước!"
        
        # Add opening context
        if opening_info:
            base_note = self.generate_note(move, category, actual_score, best_score, eval_result)
            return f"{base_note} (Khai cuộc {opening_info.get('name', '')})"
        
        # Add endgame context
        if is_endgame:
            base_note = self.generate_note(move, category, actual_score, best_score, eval_result)
            return f"{base_note} [Tàn cuộc]"
        
        # Default note generation
        return self.generate_note(move, category, actual_score, best_score, eval_result)
    
    def find_best_moves(
        self,
        board: List[List[Optional[str]]],
        player: str,
        depth: int = 2,
        top_n: int = 3,
        time_limit_ms: int = None
    ) -> List[Tuple[int, int, float]]:
        """
        Find the best moves using iterative deepening with alpha-beta pruning.
        
        Uses iterative deepening to progressively search deeper while
        respecting time constraints. Returns the best moves from the
        deepest completed search.
        
        Args:
            board: Current board state
            player: Player to find moves for
            depth: Maximum search depth (default 2 for performance)
            top_n: Number of top moves to return
            time_limit_ms: Optional time limit in milliseconds
            
        Returns:
            List of (x, y, score) tuples for best moves
        """
        candidates = self._get_candidate_moves(board)
        
        if not candidates:
            # If no candidates, return center or first empty cell
            center = self.board_size // 2
            if board[center][center] is None:
                return [(center, center, 50.0)]
            for x in range(self.board_size):
                for y in range(self.board_size):
                    if board[x][y] is None:
                        return [(x, y, 0.0)]
            return []

        # Early check for forced wins or must-block threats
        opponent = "O" if player == "X" else "X"
        winning_moves: List[Tuple[int, int, float]] = []
        blocking_moves: List[Tuple[int, int, float]] = []

        opp_threats_before = self.threat_detector.detect_all_threats(board, opponent)
        opp_five_before = opp_threats_before.threats.get(ThreatType.FIVE, 0)
        opp_open_four_before = opp_threats_before.threats.get(ThreatType.OPEN_FOUR, 0)
        opp_four_before = opp_threats_before.threats.get(ThreatType.FOUR, 0)
        opp_open_three_before = opp_threats_before.threats.get(ThreatType.OPEN_THREE, 0)
        opp_double_four_before = opp_threats_before.double_threats.get(DoubleThreatType.DOUBLE_FOUR, 0)
        opp_four_three_before = opp_threats_before.double_threats.get(DoubleThreatType.FOUR_THREE, 0)
        opp_double_three_before = opp_threats_before.double_threats.get(DoubleThreatType.DOUBLE_THREE, 0)

        has_immediate_loss = (
            opp_five_before > 0
            or opp_open_four_before > 0
            or opp_double_four_before > 0
            or opp_four_three_before > 0
        )
        
        # OPEN_THREE is also dangerous - opponent can create OPEN_FOUR next turn
        has_dangerous_threat = has_immediate_loss or opp_open_three_before > 0

        for x, y in candidates:
            # Try our move: if it creates forced win, return immediately
            board[x][y] = player
            my_threats = self.threat_detector.detect_all_threats(board, player)
            my_double_four = my_threats.double_threats.get(DoubleThreatType.DOUBLE_FOUR, 0)
            my_four_three = my_threats.double_threats.get(DoubleThreatType.FOUR_THREE, 0)
            if (
                my_threats.threats.get(ThreatType.FIVE, 0) > 0
                or my_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0
                or my_threats.threats.get(ThreatType.FOUR, 0) > 0
                or my_double_four > 0
                or my_four_three > 0
            ):
                winning_moves.append((x, y, 15000.0))
                board[x][y] = None
                continue

            # Evaluate defensive value: does this move remove immediate threats?
            opp_threats_after = self.threat_detector.detect_all_threats(board, opponent)
            board[x][y] = None

            blocked_five = max(0, opp_five_before - opp_threats_after.threats.get(ThreatType.FIVE, 0))
            blocked_open_four = max(0, opp_open_four_before - opp_threats_after.threats.get(ThreatType.OPEN_FOUR, 0))
            blocked_four = max(0, opp_four_before - opp_threats_after.threats.get(ThreatType.FOUR, 0))
            blocked_open_three = max(0, opp_open_three_before - opp_threats_after.threats.get(ThreatType.OPEN_THREE, 0))
            blocked_double_four = max(0, opp_double_four_before - opp_threats_after.double_threats.get(DoubleThreatType.DOUBLE_FOUR, 0))
            blocked_four_three = max(0, opp_four_three_before - opp_threats_after.double_threats.get(DoubleThreatType.FOUR_THREE, 0))
            blocked_double_three = max(0, opp_double_three_before - opp_threats_after.double_threats.get(DoubleThreatType.DOUBLE_THREE, 0))

            blocked_any = (
                blocked_five
                or blocked_open_four
                or blocked_double_four
                or blocked_four_three
                or (has_immediate_loss and blocked_four)
                or blocked_open_three  # OPEN_THREE is important to block!
            )

            if blocked_any:
                block_score = 12000.0
                block_score += blocked_five * 3000
                block_score += blocked_open_four * 2000
                block_score += (blocked_double_four + blocked_four_three) * 1500
                block_score += blocked_double_three * 800
                block_score += blocked_four * 300
                block_score += blocked_open_three * 500  # Blocking OPEN_THREE is valuable
                blocking_moves.append((x, y, block_score))

        if winning_moves:
            return sorted(winning_moves, key=lambda m: m[2], reverse=True)[:top_n]
        if blocking_moves:
            return sorted(blocking_moves, key=lambda m: m[2], reverse=True)[:top_n]
        
        # Start new search in transposition table
        if self.use_tt and self._tt is not None:
            self._tt.new_search()
        
        # Time management
        start_time = time.time()
        time_limit = time_limit_ms / 1000.0 if time_limit_ms else None
        
        # Iterative deepening: search at increasing depths
        best_moves: List[Tuple[int, int, float]] = []
        
        for current_depth in range(0, depth + 1, 2):  # 0, 2, 4, ...
            if current_depth == 0:
                current_depth = 1  # Minimum depth 1
            
            # Check time budget (stop if less than 20% remaining)
            if time_limit:
                elapsed = time.time() - start_time
                if elapsed > time_limit * 0.8:
                    break
            
            scored_moves: List[Tuple[int, int, float]] = []
            
            # Compute initial hash for TT
            initial_hash = None
            if self.use_tt and self._tt is not None:
                initial_hash = self._tt.compute_hash(board, player)
            
            for x, y in candidates:
                # Check time during search
                if time_limit:
                    elapsed = time.time() - start_time
                    if elapsed > time_limit * 0.8:
                        break
                
                # Make move and evaluate
                board[x][y] = player
                
                # Update hash incrementally
                new_hash = None
                if initial_hash is not None and self._tt is not None:
                    new_hash = self._tt.update_hash(initial_hash, x, y, player)
                    new_hash = self._tt.toggle_side(new_hash)
                
                score = self._minimax(
                    board, current_depth - 1, float('-inf'), float('inf'),
                    False, player, new_hash
                )
                
                board[x][y] = None
                scored_moves.append((x, y, score))
            
            # Only update best_moves if we completed this depth
            if len(scored_moves) == len(candidates):
                scored_moves.sort(key=lambda m: m[2], reverse=True)
                best_moves = scored_moves[:top_n]
                
                # Reorder candidates for next iteration (best first)
                candidates = [(x, y) for x, y, _ in scored_moves]
        
        return best_moves if best_moves else [(candidates[0][0], candidates[0][1], 0.0)]

    def _minimax(
        self,
        board: List[List[Optional[str]]],
        depth: int,
        alpha: float,
        beta: float,
        is_maximizing: bool,
        original_player: str,
        current_hash: int = None
    ) -> float:
        """
        Minimax algorithm with alpha-beta pruning and transposition table.
        
        This is a recursive algorithm that explores the game tree to find
        the optimal move. It alternates between maximizing (our turn) and
        minimizing (opponent's turn) to simulate perfect play from both sides.
        
        Optimizations:
        - Alpha-beta pruning: Cuts off branches that can't affect the result
        - Transposition table: Caches evaluated positions to avoid re-computation
        
        Args:
            board: Current board state (2D array)
            depth: Remaining search depth (0 = evaluate immediately)
            alpha: Best score maximizer can guarantee so far
            beta: Best score minimizer can guarantee so far
            is_maximizing: True if it's the original player's turn
            original_player: The player we're finding moves for ("X" or "O")
            current_hash: Zobrist hash of current position (optional)
            
        Returns:
            Best achievable score from this position
        """
        # Compute hash if not provided and TT is enabled
        if self.use_tt and self._tt is not None:
            if current_hash is None:
                current_player_for_hash = original_player if is_maximizing else (
                    "O" if original_player == "X" else "X"
                )
                current_hash = self._tt.compute_hash(board, current_player_for_hash)
            
            # Probe transposition table
            tt_score, tt_move = self._tt.probe(current_hash, depth, alpha, beta)
            if tt_score is not None:
                return tt_score
        
        # BASE CASE: Terminal state or depth limit reached
        if depth == 0 or self._is_game_over(board):
            # Use cached evaluation for performance (Task 35 - GAP 20)
            # Requirement 20.4: 5x-10x performance improvement
            eval_result = self._cached_evaluate_position(board, original_player)
            return eval_result.score
        
        # Determine whose turn it is
        current_player = original_player if is_maximizing else (
            "O" if original_player == "X" else "X"
        )
        
        # Get TT move for move ordering
        tt_move = None
        if self.use_tt and self._tt is not None and current_hash is not None:
            _, tt_move = self._tt.probe(current_hash, 0, alpha, beta)
        
        # Get candidate moves with move ordering
        candidates = self._get_candidate_moves(
            board, limit=10, depth=depth, player=current_player, tt_move=tt_move
        )
        
        if not candidates:
            return 0.0  # No moves available, neutral score
        
        # Track best move for TT storage
        best_move = None
        original_alpha = alpha
        
        if is_maximizing:
            max_eval = float('-inf')
            for x, y in candidates:
                # Make the move temporarily
                board[x][y] = current_player
                
                # Update hash incrementally if TT enabled
                new_hash = None
                if self.use_tt and self._tt is not None and current_hash is not None:
                    new_hash = self._tt.update_hash(current_hash, x, y, current_player)
                    new_hash = self._tt.toggle_side(new_hash)
                
                # Recursively evaluate
                eval_score = self._minimax(
                    board, depth - 1, alpha, beta, False, original_player, new_hash
                )
                
                # Undo the move
                board[x][y] = None
                
                if eval_score > max_eval:
                    max_eval = eval_score
                    best_move = (x, y)
                
                alpha = max(alpha, eval_score)
                
                if beta <= alpha:
                    # Beta cutoff - update killer moves and history
                    self._update_killer_move(depth, (x, y))
                    self._update_history((x, y), depth)
                    break  # Alpha-beta pruning
            
            # Store in transposition table
            if self.use_tt and self._tt is not None and current_hash is not None:
                if max_eval <= original_alpha:
                    entry_type = EntryType.UPPER
                elif max_eval >= beta:
                    entry_type = EntryType.LOWER
                else:
                    entry_type = EntryType.EXACT
                self._tt.store(current_hash, depth, max_eval, entry_type, best_move)
            
            return max_eval
        else:
            min_eval = float('inf')
            for x, y in candidates:
                board[x][y] = current_player
                
                new_hash = None
                if self.use_tt and self._tt is not None and current_hash is not None:
                    new_hash = self._tt.update_hash(current_hash, x, y, current_player)
                    new_hash = self._tt.toggle_side(new_hash)
                
                eval_score = self._minimax(
                    board, depth - 1, alpha, beta, True, original_player, new_hash
                )
                
                board[x][y] = None
                
                if eval_score < min_eval:
                    min_eval = eval_score
                    best_move = (x, y)
                
                beta = min(beta, eval_score)
                
                if beta <= alpha:
                    # Alpha cutoff - update killer moves and history
                    self._update_killer_move(depth, (x, y))
                    self._update_history((x, y), depth)
                    break
            
            # Store in transposition table
            if self.use_tt and self._tt is not None and current_hash is not None:
                if min_eval >= beta:
                    entry_type = EntryType.LOWER
                elif min_eval <= original_alpha:
                    entry_type = EntryType.UPPER
                else:
                    entry_type = EntryType.EXACT
                self._tt.store(current_hash, depth, min_eval, entry_type, best_move)
            
            return min_eval

    
    def _get_candidate_moves(
        self,
        board: List[List[Optional[str]]],
        limit: int = 10,
        depth: int = 0,
        player: str = None,
        tt_move: Tuple[int, int] = None
    ) -> List[Tuple[int, int]]:
        """
        Get candidate moves with advanced move ordering.
        
        Move ordering priority:
        1. TT best move (from transposition table)
        2. Threat moves (creating/blocking threats)
        3. Killer moves (caused cutoffs at this depth)
        4. History heuristic (frequently good moves)
        5. Position bonus (center > edge > corner)
        
        Args:
            board: Current board state
            limit: Maximum number of candidates to return
            depth: Current search depth (for killer moves)
            player: Current player (for threat detection)
            tt_move: Best move from transposition table
            
        Returns:
            List of (x, y) candidate positions, ordered by priority
        """
        candidates = set()
        has_pieces = False
        
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] is not None:
                    has_pieces = True
                    # Add empty cells within 1 square
                    for dx in range(-1, 2):
                        for dy in range(-1, 2):
                            nx, ny = x + dx, y + dy
                            if (0 <= nx < self.board_size and 
                                0 <= ny < self.board_size and
                                board[nx][ny] is None):
                                candidates.add((nx, ny))
        
        if not has_pieces:
            center = self.board_size // 2
            if board[center][center] is None:
                return [(center, center)]
            for x in range(self.board_size):
                for y in range(self.board_size):
                    if board[x][y] is None:
                        return [(x, y)]
            return []
        
        # Score candidates with move ordering heuristics
        scored = []
        killers = self._killer_moves.get(depth, [])
        
        for x, y in candidates:
            score = 0.0
            
            # 1. TT move gets highest priority
            if tt_move and (x, y) == tt_move:
                score += 100000
            
            # 2. Threat moves (quick evaluation)
            if player:
                # Check if this move creates a threat
                board[x][y] = player
                threats = self.threat_detector.detect_all_threats(board, player)
                board[x][y] = None
                
                if threats.threats.get(ThreatType.FIVE, 0) > 0:
                    score += 50000  # Winning move
                elif threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                    score += 10000  # Creates open four
                elif threats.threats.get(ThreatType.FOUR, 0) > 0:
                    score += 5000   # Creates four
                elif threats.threats.get(ThreatType.OPEN_THREE, 0) > 0:
                    score += 1000   # Creates open three
            
            # 3. Killer moves
            if (x, y) in killers:
                score += 500
            
            # 4. History heuristic
            history_score = self._history_table.get((x, y), 0)
            score += history_score * 0.1
            
            # 5. Position bonus
            score += self.position_evaluator.position_bonus(x, y)
            
            scored.append((x, y, score))
        
        # Sort by score descending
        scored.sort(key=lambda c: c[2], reverse=True)
        return [(x, y) for x, y, _ in scored[:limit]]
    
    def _update_killer_move(self, depth: int, move: Tuple[int, int]):
        """Update killer moves for a depth after a beta cutoff."""
        if depth not in self._killer_moves:
            self._killer_moves[depth] = []
        
        killers = self._killer_moves[depth]
        if move not in killers:
            killers.insert(0, move)
            if len(killers) > self._max_killers:
                killers.pop()
    
    def _update_history(self, move: Tuple[int, int], depth: int):
        """Update history heuristic score for a move."""
        x, y = move
        current = self._history_table.get((x, y), 0)
        # Increase score based on depth (deeper = more valuable)
        self._history_table[(x, y)] = current + depth * depth
    
    def _clear_search_heuristics(self):
        """Clear killer moves and history table for new search."""
        self._killer_moves.clear()
        # Don't clear history completely - it's useful across searches
        # But decay old values
        for key in self._history_table:
            self._history_table[key] = self._history_table[key] // 2
    
    def _is_game_over(self, board: List[List[Optional[str]]]) -> bool:
        """
        Check if the game is over (someone won or board is full).
        
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
    
    def detect_patterns(
        self,
        timeline: List[TimelineEntry],
        all_best_moves: List[Tuple[int, List[Tuple[int, int, float]]]],
        moves: List[Move]
    ) -> List[Pattern]:
        """
        Detect tactical patterns in the game.
        
        This function analyzes the game move-by-move to identify common
        tactical patterns that indicate strong play or mistakes.
        
        Patterns detected:
        - Tứ Hướng: Multi-directional threats (threats from 3+ directions)
        - Song Song: Parallel attack lines (two threats on parallel lines)
        - Chặn Muộn: Late blocking (failed to block opponent's open four)
        - Bỏ Lỡ Thắng: Missed winning opportunity (had winning move but didn't play it)
        - Đôi Ba: Double three (two open threes created simultaneously)
        - Tứ Tam: Four-three combination (four + three = guaranteed win)
        
        Args:
            timeline: Move-by-move timeline
            all_best_moves: Best moves calculated for each position
            moves: Original moves list
            
        Returns:
            List of detected patterns
        """
        patterns: List[Pattern] = []
        # Replay the game move-by-move to analyze patterns at each position
        board = [[None for _ in range(self.board_size)] for _ in range(self.board_size)]
        
        for i, move in enumerate(moves):
            move_number = i + 1
            player = move.player
            
            # Apply the move to the board
            board[move.x][move.y] = player
            
            # Analyze threats created by this move
            threats = self.threat_detector.detect_all_threats(board, player)
            
            # ============================================
            # PATTERN: Tứ Hướng (Multi-directional threats)
            # ============================================
            # A player has threats coming from 3+ different directions,
            # making it nearly impossible for opponent to defend all of them
            if len(threats.threat_positions) >= 4:
                # Count unique directions (horizontal, vertical, diagonal_down, diagonal_up)
                directions = set(t.direction for t in threats.threat_positions)
                if len(directions) >= 3:
                    patterns.append(Pattern(
                        label=PATTERN_INFO["tu_huong"]["label"],
                        explanation=PATTERN_INFO["tu_huong"]["explanation"],
                        moves=[move_number],
                        severity="high"
                    ))
            
            # ============================================
            # PATTERN: Song Song (Parallel attack lines)
            # ============================================
            # Two threats on parallel lines in the same direction
            # Opponent can only block one, guaranteeing the other succeeds
            threat_by_dir = {}
            for t in threats.threat_positions:
                if t.direction not in threat_by_dir:
                    threat_by_dir[t.direction] = []
                threat_by_dir[t.direction].append(t)
            
            for direction, dir_threats in threat_by_dir.items():
                if len(dir_threats) >= 2:
                    # Verify threats are on different parallel lines (not the same line)
                    if self._are_parallel_threats(dir_threats):
                        patterns.append(Pattern(
                            label=PATTERN_INFO["song_song"]["label"],
                            explanation=PATTERN_INFO["song_song"]["explanation"],
                            moves=[move_number],
                            severity="high"
                        ))
                        break
            
            # ============================================
            # PATTERN: Đôi Ba (Double three)
            # ============================================
            # Two open threes created simultaneously
            # Opponent can only block one, the other becomes open four next turn
            open_threes = [t for t in threats.threat_positions 
                         if t.type == ThreatType.OPEN_THREE]
            if len(open_threes) >= 2:
                patterns.append(Pattern(
                    label=PATTERN_INFO["double_three"]["label"],
                    explanation=PATTERN_INFO["double_three"]["explanation"],
                    moves=[move_number],
                    severity="high"
                ))
            
            # ============================================
            # PATTERN: Tứ Tam (Four-three combination)
            # ============================================
            # A four (or open four) combined with a three (or open three)
            # This is a winning combination: opponent must block the four,
            # allowing the three to become a winning four next turn
            fours = [t for t in threats.threat_positions 
                    if t.type in [ThreatType.FOUR, ThreatType.OPEN_FOUR]]
            threes = [t for t in threats.threat_positions 
                     if t.type in [ThreatType.THREE, ThreatType.OPEN_THREE]]
            if fours and threes:
                patterns.append(Pattern(
                    label=PATTERN_INFO["four_three"]["label"],
                    explanation=PATTERN_INFO["four_three"]["explanation"],
                    moves=[move_number],
                    severity="critical"
                ))
            
            # ============================================
            # PATTERN: Bỏ Lỡ Thắng (Missed winning opportunity)
            # ============================================
            # The previous player had a winning move available but didn't play it
            # We detect this by checking if the best move would have created FIVE
            if i > 0 and move_number <= len(all_best_moves):
                prev_best = all_best_moves[i - 1][1] if i > 0 else []
                if prev_best:
                    # Simulate: what if previous player played the best move instead?
                    prev_player = moves[i - 1].player
                    test_board = [row[:] for row in board]
                    test_board[move.x][move.y] = None  # Undo current move
                    best_x, best_y, _ = prev_best[0]
                    test_board[best_x][best_y] = prev_player
                    
                    # Check if that move would have won the game
                    test_threats = self.threat_detector.detect_all_threats(
                        test_board, prev_player
                    )
                    if test_threats.threats.get(ThreatType.FIVE, 0) > 0:
                        # Previous player missed a winning move!
                        patterns.append(Pattern(
                            label=PATTERN_INFO["bo_lo_thang"]["label"],
                            explanation=PATTERN_INFO["bo_lo_thang"]["explanation"],
                            moves=[move_number - 1],
                            severity="critical"
                        ))
            
            # ============================================
            # PATTERN: Chặn Muộn (Late blocking)
            # ============================================
            # Opponent had an open four (guaranteed win) but player failed to block it
            # This is a critical defensive failure
            if i > 0:
                opponent = "O" if player == "X" else "X"
                # Check opponent's threats BEFORE this move
                opp_threats_before = self.threat_detector.detect_all_threats(
                    self._board_at_move(moves, i - 1), opponent
                )
                # If opponent had open four (must block or lose)
                if opp_threats_before.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                    # Check if this move successfully blocked it
                    opp_threats_after = self.threat_detector.detect_all_threats(
                        board, opponent
                    )
                    # If open four still exists, player failed to block
                    if opp_threats_after.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                        patterns.append(Pattern(
                            label=PATTERN_INFO["chan_muon"]["label"],
                            explanation=PATTERN_INFO["chan_muon"]["explanation"],
                            moves=[move_number],
                            severity="major"
                        ))
            
            # ============================================
            # DEFENSIVE PATTERNS (Task 32 - GAP 12)
            # Requirements: 17.1, 17.2, 17.3, 17.4
            # ============================================
            # Detect and praise good defensive moves:
            # - Chặn Kép (Double Block): blocks two threats simultaneously
            # - Chặn Hi Sinh (Sacrifice Block): sacrifices blocking for counter-attack
            # - Chặn Phòng Ngừa (Preventive Block): prevents opponent fork
            if i > 0 and self._defensive_recognizer:
                opponent = "O" if player == "X" else "X"
                board_before = self._board_at_move(moves, i - 1)
                
                # Get opponent threats before and after this move
                opp_threats_before = self.threat_detector.detect_all_threats(
                    board_before, opponent
                )
                opp_threats_after = self.threat_detector.detect_all_threats(
                    board, opponent
                )
                
                # Get player threats after this move (for counter-attack detection)
                player_threats_after = self.threat_detector.detect_all_threats(
                    board, player
                )
                
                # Detect defensive patterns
                defensive_patterns = self._defensive_recognizer.detect_defensive_patterns(
                    board=board,
                    move=(move.x, move.y),
                    player=player,
                    threats_before=opp_threats_before,
                    threats_after=opp_threats_after,
                    player_threats_after=player_threats_after
                )
                
                # Convert defensive patterns to Pattern objects
                for dp in defensive_patterns:
                    # Generate praise comment
                    praise = self._defensive_recognizer.generate_praise_comment(dp, "vi")
                    
                    # Determine severity based on pattern type
                    if dp.pattern_type == DefensivePatternType.DOUBLE_BLOCK:
                        severity = "high"
                    elif dp.pattern_type == DefensivePatternType.SACRIFICE_BLOCK:
                        severity = "high"
                    elif dp.pattern_type == DefensivePatternType.PREVENTIVE_BLOCK:
                        severity = "medium"
                    else:
                        severity = "info"
                    
                    patterns.append(Pattern(
                        label=dp.pattern_name_vi,
                        explanation=praise,
                        moves=[move_number],
                        severity=severity
                    ))
        
        return patterns
    
    def _are_parallel_threats(self, threats: List) -> bool:
        """Check if threats are on parallel lines."""
        if len(threats) < 2:
            return False
        
        # Get the first position of each threat
        lines = []
        for t in threats:
            if t.positions:
                lines.append(t.positions[0])
        
        if len(lines) < 2:
            return False
        
        # Check if they're on different lines (different row or column)
        first = lines[0]
        for other in lines[1:]:
            if first[0] != other[0] or first[1] != other[1]:
                return True
        return False
    
    def _board_at_move(
        self,
        moves: List[Move],
        move_index: int
    ) -> List[List[Optional[str]]]:
        """Get board state at a specific move index."""
        board = [[None for _ in range(self.board_size)] for _ in range(self.board_size)]
        for i in range(move_index + 1):
            if i < len(moves):
                board[moves[i].x][moves[i].y] = moves[i].player
        return board
    
    def generate_note(
        self,
        move: Move,
        category: MoveClassification,
        actual_score: float,
        best_score: float,
        eval_result
    ) -> str:
        """
        Generate a Vietnamese note for a move.
        
        Uses templates based on move quality and provides
        context about the position.
        
        Args:
            move: The move being described
            category: Classification of the move
            actual_score: Score of the actual move
            best_score: Score of the best move
            eval_result: Position evaluation result
            
        Returns:
            Vietnamese description string
        """
        templates = NOTE_TEMPLATES.get(category, NOTE_TEMPLATES[MoveClassification.OKAY])
        template = templates[0]  # Use first template for consistency
        
        # Generate reason based on threats and category (not score ratio)
        reason = self._generate_move_reason(move, eval_result, category)
        
        return template.format(reason=reason)
    
    def _generate_move_reason(
        self,
        move: Move,
        eval_result,
        category: MoveClassification
    ) -> str:
        """Generate reason text for a move.
        
        FIXED: Use category directly instead of recalculating score ratio.
        This ensures note is always consistent with move classification.
        - EXCELLENT/GOOD/OKAY moves get positive notes
        - WEAK/BLUNDER moves get negative notes
        """
        threats = eval_result.threats
        
        # Check for winning threats first (always positive)
        if threats.threats.get(ThreatType.FIVE, 0) > 0:
            return "Nước thắng!"
        
        if threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            return "Tạo tứ mở, đảm bảo thắng."
        
        if threats.threats.get(ThreatType.FOUR, 0) > 0:
            return "Tạo đường tứ."
        
        if threats.threats.get(ThreatType.OPEN_THREE, 0) > 0:
            return "Tạo ba mở, đe dọa mạnh."
        
        if threats.threats.get(ThreatType.THREE, 0) > 0:
            return "Phát triển đường ba."
        
        # Position-based check
        center = self.board_size // 2
        is_center = abs(move.x - center) <= 2 and abs(move.y - center) <= 2
        
        # Use category directly for note generation (consistent with classification)
        if category == MoveClassification.BLUNDER:
            return "Có nước đi tốt hơn nhiều."
        if category == MoveClassification.WEAK:
            return "Có thể chơi tốt hơn."
        
        # OKAY, GOOD, EXCELLENT get positive notes
        if is_center:
            return "Kiểm soát trung tâm."
        
        return "Phát triển vị trí."

    
    def _generate_mistake_description(
        self,
        move: Move,
        severity: str,
        best_alt: Tuple[int, int, float],
        actual_score: float,
        best_score: float
    ) -> str:
        """Generate Vietnamese description for a mistake."""
        base_desc = MISTAKE_DESCRIPTIONS.get(severity, "Sai lầm")
        
        score_diff = best_score - actual_score
        alt_desc = f"Nên chơi ({best_alt[0]}, {best_alt[1]}) thay vì ({move.x}, {move.y})."
        
        if severity == "critical":
            return f"{base_desc}. {alt_desc} Mất {int(score_diff)} điểm."
        elif severity == "major":
            return f"{base_desc}. {alt_desc}"
        else:
            return f"{base_desc}. {alt_desc}"
    
    def _generate_best_move_reason(
        self,
        board: List[List[Optional[str]]],
        best_move: Tuple[int, int, float],
        player: str
    ) -> str:
        """Generate Vietnamese reason for best move recommendation."""
        x, y, score = best_move
        
        # Simulate the move
        board[x][y] = player
        threats = self.threat_detector.detect_all_threats(board, player)
        board[x][y] = None
        
        if threats.threats.get(ThreatType.FIVE, 0) > 0:
            return "Nước thắng ngay lập tức!"
        
        if threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            return "Tạo tứ mở, đảm bảo thắng ở nước tiếp theo."
        
        if threats.threats.get(ThreatType.FOUR, 0) > 0:
            return "Tạo đường tứ, buộc đối thủ phải chặn."
        
        if threats.threats.get(ThreatType.OPEN_THREE, 0) > 0:
            return "Tạo ba mở, tạo áp lực lớn."
        
        # Check defensive value
        opponent = "O" if player == "X" else "X"
        opp_threats = self.threat_detector.detect_all_threats(board, opponent)
        
        if opp_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            return "Chặn tứ mở của đối thủ, tránh thua."
        
        if opp_threats.threats.get(ThreatType.FOUR, 0) > 0:
            return "Chặn đường tứ của đối thủ."
        
        if opp_threats.threats.get(ThreatType.OPEN_THREE, 0) > 0:
            return "Chặn ba mở của đối thủ."
        
        # Position-based
        center = self.board_size // 2
        if abs(x - center) <= 2 and abs(y - center) <= 2:
            return "Kiểm soát trung tâm bàn cờ."
        
        return "Phát triển vị trí tốt nhất."
    
    def _extract_threat_types(self, threats, player: str) -> List[ThreatType]:
        """
        Extract list of threat types created by a move.
        
        Task 6.3: Helper for comment generation
        
        Args:
            threats: ThreatResult from threat detector
            player: Player who made the move
            
        Returns:
            List of ThreatType enums for threats created
        """
        threat_types = []
        
        # Check each threat type in priority order
        if threats.threats.get(ThreatType.FIVE, 0) > 0:
            threat_types.append(ThreatType.FIVE)
        if threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            threat_types.append(ThreatType.OPEN_FOUR)
        if threats.threats.get(ThreatType.FOUR, 0) > 0:
            threat_types.append(ThreatType.FOUR)
        if threats.threats.get(ThreatType.BROKEN_FOUR, 0) > 0:
            threat_types.append(ThreatType.BROKEN_FOUR)
        if threats.threats.get(ThreatType.OPEN_THREE, 0) > 0:
            threat_types.append(ThreatType.OPEN_THREE)
        if threats.threats.get(ThreatType.THREE, 0) > 0:
            threat_types.append(ThreatType.THREE)
        if threats.threats.get(ThreatType.BROKEN_THREE, 0) > 0:
            threat_types.append(ThreatType.BROKEN_THREE)
        if threats.threats.get(ThreatType.OPEN_TWO, 0) > 0:
            threat_types.append(ThreatType.OPEN_TWO)
        
        return threat_types
    
    def _detect_blocked_threats(self, threats_before, threats_after) -> List[ThreatType]:
        """
        Detect which opponent threats were blocked by a move.
        
        Task 6.3: Helper for comment generation
        
        Args:
            threats_before: Opponent's ThreatResult before the move
            threats_after: Opponent's ThreatResult after the move
            
        Returns:
            List of ThreatType enums for threats that were blocked
        """
        blocked = []
        
        # Check each threat type - if count decreased, it was blocked
        threat_types_to_check = [
            ThreatType.OPEN_FOUR,
            ThreatType.FOUR,
            ThreatType.BROKEN_FOUR,
            ThreatType.OPEN_THREE,
            ThreatType.THREE,
            ThreatType.BROKEN_THREE,
        ]
        
        for threat_type in threat_types_to_check:
            before_count = threats_before.threats.get(threat_type, 0)
            after_count = threats_after.threats.get(threat_type, 0)
            if before_count > after_count:
                blocked.append(threat_type)
        
        return blocked
    
    def generate_alternatives(
        self,
        board: List[List[Optional[str]]],
        player: str,
        actual_move: Optional[Tuple[int, int]] = None,
        actual_category: Optional[MoveClassification] = None
    ) -> List['AlternativeMove']:
        """
        Generate 2-3 alternative move suggestions with reasons.
        
        Requirements: 5.1, 5.2, 5.3, 5.4
        - 5.1: Suggest 2-3 alternative moves with scores
        - 5.2: Include brief reason for each suggestion
        - 5.3: Highlight best alternative when actual move is blunder
        - 5.4: Indicate when multiple good options exist (similar scores)
        
        Args:
            board: Current board state
            player: Player to find alternatives for
            actual_move: The actual move played (x, y) - excluded from alternatives
            actual_category: Classification of actual move (to determine if blunder)
            
        Returns:
            List of 2-3 AlternativeMove objects
        """
        from .types import AlternativeMove
        from .coordinate_utils import index_to_notation
        
        # Find best moves (get 4-5 to ensure we have 2-3 after filtering)
        best_moves = self.find_best_moves(board, player, depth=1, top_n=5)
        
        if not best_moves:
            return []
        
        # Filter out the actual move if provided
        if actual_move:
            best_moves = [
                (x, y, score) for x, y, score in best_moves 
                if not (x == actual_move[0] and y == actual_move[1])
            ]
        
        # Ensure we have at least 2 alternatives, max 3
        alternatives_data = best_moves[:3]
        
        # If we have less than 2, try to find more candidates
        if len(alternatives_data) < 2:
            # Get more candidates
            extra_moves = self.find_best_moves(board, player, depth=1, top_n=10)
            if actual_move:
                extra_moves = [
                    (x, y, score) for x, y, score in extra_moves 
                    if not (x == actual_move[0] and y == actual_move[1])
                ]
            alternatives_data = extra_moves[:3]
        
        if not alternatives_data:
            return []
        
        # Determine if actual move was a blunder
        is_blunder = actual_category == MoveClassification.BLUNDER if actual_category else False
        
        # Calculate score similarity (within 0.5 points = similar)
        scores = [score for _, _, score in alternatives_data]
        max_score = max(scores) if scores else 0
        min_score = min(scores) if scores else 0
        has_similar_scores = (max_score - min_score) <= 0.5 if len(scores) > 1 else False
        
        # Normalize scores to 0-10 scale
        def normalize_score(raw_score: float) -> float:
            """Normalize raw score to 0-10 scale."""
            # Raw scores can vary widely, normalize based on typical ranges
            if raw_score >= 15000:  # Winning move
                return 10.0
            elif raw_score >= 10000:
                return 9.5
            elif raw_score >= 5000:
                return 9.0
            elif raw_score >= 1000:
                return 8.0
            elif raw_score >= 500:
                return 7.0
            elif raw_score >= 100:
                return 6.0
            elif raw_score >= 50:
                return 5.0
            elif raw_score >= 0:
                return 4.0 + (raw_score / 50) * 1.0  # 0-50 maps to 4-5
            else:
                return max(0.0, 4.0 + raw_score / 100)  # Negative scores
        
        alternatives = []
        for i, (x, y, raw_score) in enumerate(alternatives_data):
            # Generate reason for this alternative
            reason = self._generate_alternative_reason(board, x, y, player)
            
            # Normalize score
            normalized_score = normalize_score(raw_score)
            
            # Convert to notation
            try:
                position = index_to_notation(x, y)
            except Exception:
                position = f"{chr(ord('A') + y)}{x + 1}"
            
            # Mark best alternative when actual is blunder
            is_best = (i == 0) and is_blunder
            
            # Mark if scores are similar
            similar_to_others = has_similar_scores and len(alternatives_data) > 1
            
            alt = AlternativeMove(
                position=position,
                x=x,
                y=y,
                score=round(normalized_score, 1),
                reason=reason,
                is_best=is_best,
                similar_to_others=similar_to_others
            )
            alternatives.append(alt)
        
        # Ensure we return 2-3 alternatives
        if len(alternatives) < 2:
            # If we still don't have enough, duplicate with slight variation
            # This shouldn't happen in practice but ensures the contract
            pass
        
        return alternatives[:3]  # Max 3 alternatives
    
    def _generate_alternative_reason(
        self,
        board: List[List[Optional[str]]],
        x: int,
        y: int,
        player: str
    ) -> str:
        """
        Generate a brief reason for why this alternative move is good.
        
        Args:
            board: Current board state
            x: Row index of the move
            y: Column index of the move
            player: Player making the move
            
        Returns:
            Brief Vietnamese explanation
        """
        # Simulate the move
        board[x][y] = player
        threats = self.threat_detector.detect_all_threats(board, player)
        board[x][y] = None
        
        # Check offensive value
        if threats.threats.get(ThreatType.FIVE, 0) > 0:
            return "Thắng ngay!"
        
        if threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            return "Tạo tứ mở, thắng chắc."
        
        # Check for double threats
        double_four = threats.double_threats.get(DoubleThreatType.DOUBLE_FOUR, 0)
        four_three = threats.double_threats.get(DoubleThreatType.FOUR_THREE, 0)
        double_three = threats.double_threats.get(DoubleThreatType.DOUBLE_THREE, 0)
        
        if double_four > 0 or four_three > 0:
            return "Tạo đa đường, thắng chắc."
        
        if double_three > 0:
            return "Tạo đôi ba mở, rất nguy hiểm."
        
        if threats.threats.get(ThreatType.FOUR, 0) > 0:
            return "Tạo đường tứ, buộc chặn."
        
        if threats.threats.get(ThreatType.OPEN_THREE, 0) > 0:
            return "Tạo ba mở, tạo áp lực."
        
        # Check defensive value
        opponent = "O" if player == "X" else "X"
        opp_threats_before = self.threat_detector.detect_all_threats(board, opponent)
        
        board[x][y] = player
        opp_threats_after = self.threat_detector.detect_all_threats(board, opponent)
        board[x][y] = None
        
        # Check if blocks opponent threats
        opp_open_four_before = opp_threats_before.threats.get(ThreatType.OPEN_FOUR, 0)
        opp_open_four_after = opp_threats_after.threats.get(ThreatType.OPEN_FOUR, 0)
        if opp_open_four_before > opp_open_four_after:
            return "Chặn tứ mở đối thủ."
        
        opp_four_before = opp_threats_before.threats.get(ThreatType.FOUR, 0)
        opp_four_after = opp_threats_after.threats.get(ThreatType.FOUR, 0)
        if opp_four_before > opp_four_after:
            return "Chặn đường tứ đối thủ."
        
        opp_open_three_before = opp_threats_before.threats.get(ThreatType.OPEN_THREE, 0)
        opp_open_three_after = opp_threats_after.threats.get(ThreatType.OPEN_THREE, 0)
        if opp_open_three_before > opp_open_three_after:
            return "Chặn ba mở đối thủ."
        
        # Check double threat blocking
        opp_double_four_before = opp_threats_before.double_threats.get(DoubleThreatType.DOUBLE_FOUR, 0)
        opp_double_four_after = opp_threats_after.double_threats.get(DoubleThreatType.DOUBLE_FOUR, 0)
        if opp_double_four_before > opp_double_four_after:
            return "Ngăn đa đường đối thủ."
        
        opp_four_three_before = opp_threats_before.double_threats.get(DoubleThreatType.FOUR_THREE, 0)
        opp_four_three_after = opp_threats_after.double_threats.get(DoubleThreatType.FOUR_THREE, 0)
        if opp_four_three_before > opp_four_three_after:
            return "Ngăn tứ-tam đối thủ."
        
        # Position-based reasons
        center = self.board_size // 2
        dist_to_center = max(abs(x - center), abs(y - center))
        
        if dist_to_center <= 2:
            return "Kiểm soát trung tâm."
        elif dist_to_center <= 4:
            return "Phát triển vị trí tốt."
        
        # Check if creates any threat
        if threats.threats.get(ThreatType.THREE, 0) > 0:
            return "Tạo đường ba."
        
        if threats.threats.get(ThreatType.OPEN_TWO, 0) > 0:
            return "Phát triển đường hai."
        
        return "Nước đi hợp lý."
    
    def generate_summary(
        self,
        timeline: List[TimelineEntry],
        mistakes: List[Mistake],
        moves: List[Move]
    ) -> Summary:
        """
        Generate overall game summary.
        
        Calculates statistics for both players and identifies
        key insights from the game.
        
        Args:
            timeline: Move-by-move timeline
            mistakes: List of detected mistakes
            moves: Original moves list
            
        Returns:
            Summary with stats and insights
        """
        total_moves = len(moves)
        
        # Determine winner
        board = [[None for _ in range(self.board_size)] for _ in range(self.board_size)]
        winner = None
        for move in moves:
            board[move.x][move.y] = move.player
            threats = self.threat_detector.detect_all_threats(board, move.player)
            if threats.threats.get(ThreatType.FIVE, 0) > 0:
                winner = move.player
                break
        
        # Calculate stats per player
        x_stats = self._calculate_player_stats(timeline, mistakes, "X")
        o_stats = self._calculate_player_stats(timeline, mistakes, "O")
        
        # Generate key insights
        key_insights = self._generate_key_insights(timeline, mistakes, winner)
        
        return Summary(
            total_moves=total_moves,
            winner=winner,
            x_stats=x_stats,
            o_stats=o_stats,
            key_insights=key_insights
        )
    
    def _calculate_player_stats(
        self,
        timeline: List[TimelineEntry],
        mistakes: List[Mistake],
        player: str
    ) -> Dict[str, Any]:
        """Calculate statistics for a player."""
        player_entries = [e for e in timeline if e.player == player]
        player_mistakes = [m for m in mistakes 
                         if timeline[m.move - 1].player == player]
        
        if not player_entries:
            return {
                "total_moves": 0,
                "excellent_moves": 0,
                "good_moves": 0,
                "mistakes": 0,
                "critical_mistakes": 0,
                "avg_score": 0,
                "accuracy": 0
            }
        
        excellent = sum(1 for e in player_entries 
                       if e.category == MoveClassification.EXCELLENT)
        good = sum(1 for e in player_entries 
                  if e.category == MoveClassification.GOOD)
        critical = sum(1 for m in player_mistakes if m.severity == "critical")
        
        avg_score = sum(e.score for e in player_entries) / len(player_entries)
        
        # Calculate accuracy (percentage of excellent + good moves)
        accuracy = ((excellent + good) / len(player_entries)) * 100 if player_entries else 0
        
        return {
            "total_moves": len(player_entries),
            "excellent_moves": excellent,
            "good_moves": good,
            "mistakes": len(player_mistakes),
            "critical_mistakes": critical,
            "avg_score": round(avg_score, 2),
            "accuracy": round(accuracy, 1)
        }
    
    def _generate_key_insights(
        self,
        timeline: List[TimelineEntry],
        mistakes: List[Mistake],
        winner: Optional[str]
    ) -> List[str]:
        """Generate key insights from the game."""
        insights = []
        
        # Winner insight
        if winner:
            insights.append(f"Người chơi {winner} thắng ván đấu.")
        else:
            insights.append("Ván đấu hòa hoặc chưa kết thúc.")
        
        # Mistake insights
        critical_mistakes = [m for m in mistakes if m.severity == "critical"]
        if critical_mistakes:
            insights.append(
                f"Có {len(critical_mistakes)} sai lầm nghiêm trọng ảnh hưởng kết quả."
            )
        
        # Accuracy comparison
        x_entries = [e for e in timeline if e.player == "X"]
        o_entries = [e for e in timeline if e.player == "O"]
        
        if x_entries and o_entries:
            x_excellent = sum(1 for e in x_entries 
                            if e.category == MoveClassification.EXCELLENT)
            o_excellent = sum(1 for e in o_entries 
                            if e.category == MoveClassification.EXCELLENT)
            
            if x_excellent > o_excellent:
                insights.append("X chơi chính xác hơn với nhiều nước xuất sắc.")
            elif o_excellent > x_excellent:
                insights.append("O chơi chính xác hơn với nhiều nước xuất sắc.")
        
        # Turning point
        for i, entry in enumerate(timeline):
            if entry.category == MoveClassification.BLUNDER:
                insights.append(f"Nước {entry.move} là bước ngoặt quan trọng.")
                break
        
        return insights[:3]  # Return top 3 insights
    
    def _analyze_game_fast(
        self,
        moves: List[Move],
        language: str,
        metadata: Optional[GameMetadata] = None
    ) -> AnalysisResult:
        """
        Fast-path analysis using OptimizedBasicAnalyzer, enriched to match BasicAnalyzer output.
        """
        start_time = time.time()
        self._metadata_handler = GameMetadataHandler(metadata)
        base_result = self._fast_analyzer.analyze_game(moves, language)

        prev_score = 0.0
        for entry in base_result.timeline:
            entry.score_before = prev_score
            entry.score_change = entry.score - prev_score
            entry.is_significant = abs(entry.score_change) > 20
            entry.is_critical = abs(entry.score_change) > 50
            entry.is_forcing = getattr(entry, "is_forcing", False)
            entry.tempo_change = getattr(entry, "tempo_change", 0)
            entry.initiative_holder = getattr(entry, "initiative_holder", "neutral")
            entry.is_tempo_switch = getattr(entry, "is_tempo_switch", False)
            entry.tempo_explanation = getattr(entry, "tempo_explanation", None)
            prev_score = entry.score

        base_result.summary = self.generate_summary(base_result.timeline, base_result.mistakes, moves)
        base_result.duration_ms = int((time.time() - start_time) * 1000)
        if self.metrics_logger:
            self.metrics_logger.log_analysis_complete(base_result.duration_ms, len(moves), tier="basic")
        return base_result
    
    # ============================================
    # CACHED METHODS (Task 35 - GAP 20)
    # Requirements: 20.1, 20.2, 20.3, 20.4
    # ============================================
    
    def _cached_evaluate_position(
        self,
        board: List[List[Optional[str]]],
        player: str
    ):
        """
        Evaluate position with caching support.
        
        Requirement 20.1: Return cached result within 10ms
        
        Args:
            board: Current board state
            player: Player to evaluate for
            
        Returns:
            EvaluationResult from cache or fresh evaluation
        """
        # Try cache first
        if self._cache is not None:
            cached = self._cache.get_position_evaluation(board, player)
            if cached is not None:
                return cached
        
        # Compute fresh evaluation
        if self.use_advanced and self._advanced_evaluator:
            result = self._advanced_evaluator.evaluate_position(board, player)
        else:
            result = self.position_evaluator.evaluate_position(board, player)
        
        # Store in cache
        if self._cache is not None:
            self._cache.set_position_evaluation(board, player, result)
        
        return result
    
    def _cached_detect_threats(
        self,
        board: List[List[Optional[str]]],
        player: str
    ):
        """
        Detect threats with caching support.
        
        Requirement 20.2: Pattern cache with TTL=600s
        
        Args:
            board: Current board state
            player: Player to detect threats for
            
        Returns:
            ThreatResult from cache or fresh detection
        """
        # Try cache first
        if self._cache is not None:
            cached = self._cache.get_patterns(board, player)
            if cached is not None:
                return cached
        
        # Compute fresh detection
        result = self.threat_detector.detect_all_threats(board, player)
        
        # Store in cache
        if self._cache is not None:
            self._cache.set_patterns(board, player, result)
        
        return result
    
    def _cached_evaluate_move(
        self,
        board: List[List[Optional[str]]],
        move_x: int,
        move_y: int,
        player: str
    ) -> float:
        """
        Evaluate a move with caching support.
        
        Requirement 20.4: 5x-10x performance improvement
        
        Args:
            board: Current board state (before move)
            move_x: X coordinate of the move
            move_y: Y coordinate of the move
            player: Player making the move
            
        Returns:
            Move score from cache or fresh evaluation
        """
        # Try cache first
        if self._cache is not None:
            cached = self._cache.get_move_evaluation(board, move_x, move_y, player)
            if cached is not None:
                return cached
        
        # Compute fresh evaluation
        score = self.position_evaluator.evaluate_move(board, move_x, move_y, player)
        
        # Store in cache
        if self._cache is not None:
            self._cache.set_move_evaluation(board, move_x, move_y, player, score)
        
        return score
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics for monitoring.
        
        Returns:
            Dictionary with cache stats or empty dict if cache not available
        """
        if self._cache is not None:
            return self._cache.stats()
        return {}
    
    def clear_cache(self) -> None:
        """Clear all caches."""
        if self._cache is not None:
            self._cache.clear_all()
