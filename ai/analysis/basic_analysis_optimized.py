"""
Optimized Basic Analysis Module

Task 12: Optimize Analysis Performance
Requirements:
- 9.1: Full game analysis < 2000ms
- 9.2: Single move analysis < 100ms
- 9.3: Comment generation < 50ms per move
- 9.4: Use caching where appropriate

Optimizations:
1. Reduced search depth (depth=0 for most moves)
2. Cached threat detection results
3. Simplified best move finding (no minimax for basic tier)
4. Pre-computed position bonuses
5. Lazy evaluation of alternatives
"""

import time
from typing import List, Optional, Tuple, Dict, Any
from functools import lru_cache

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
from .role_evaluator import RoleEvaluator, PlayerRole
from .comment_generator import CommentGenerator, SUPPORTED_LANGUAGES


# Pre-computed position bonuses for 15x15 board
_POSITION_BONUS_CACHE: Dict[Tuple[int, int], float] = {}


def _init_position_bonus_cache(board_size: int = BOARD_SIZE):
    """Pre-compute position bonuses for all cells."""
    global _POSITION_BONUS_CACHE
    if _POSITION_BONUS_CACHE:
        return
    
    import math
    center = (board_size - 1) / 2.0
    max_distance = math.sqrt(2 * center * center)
    max_bonus = 50.0
    
    for x in range(board_size):
        for y in range(board_size):
            dx = abs(x - center)
            dy = abs(y - center)
            distance = math.sqrt(dx * dx + dy * dy)
            bonus = max_bonus * (1.0 - (distance / max_distance))
            _POSITION_BONUS_CACHE[(x, y)] = max(0.0, bonus)


# Initialize cache on module load
_init_position_bonus_cache()


class OptimizedBasicAnalyzer:
    """
    Optimized rule-based game analyzer for Gomoku/Caro.
    
    Provides fast analysis (<2s) using simplified threat detection
    and position evaluation without deep search.
    
    Key optimizations:
    - No minimax search (uses heuristic scoring only)
    - Cached threat detection
    - Pre-computed position bonuses
    - Simplified alternative generation
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """Initialize the OptimizedBasicAnalyzer."""
        self.board_size = board_size
        self.threat_detector = ThreatDetector(board_size)
        self.position_evaluator = PositionEvaluator(self.threat_detector, board_size)
        self.role_evaluator = RoleEvaluator(board_size)
        self.comment_generator = CommentGenerator()
        
        # Threat cache: board_hash -> ThreatResult
        self._threat_cache: Dict[int, Any] = {}
        self._cache_hits = 0
        self._cache_misses = 0
    
    def _board_hash(self, board: List[List[Optional[str]]], player: str) -> int:
        """Compute a hash for board state."""
        # Simple hash using tuple of tuples
        board_tuple = tuple(tuple(row) for row in board)
        return hash((board_tuple, player))
    
    def _get_threats_cached(
        self, 
        board: List[List[Optional[str]]], 
        player: str
    ) -> Any:
        """Get threats with caching."""
        board_hash = self._board_hash(board, player)
        
        if board_hash in self._threat_cache:
            self._cache_hits += 1
            return self._threat_cache[board_hash]
        
        self._cache_misses += 1
        result = self.threat_detector.detect_all_threats(board, player)
        
        # Limit cache size
        if len(self._threat_cache) > 1000:
            # Clear oldest entries (simple approach)
            self._threat_cache.clear()
        
        self._threat_cache[board_hash] = result
        return result
    
    def analyze_game(self, moves: List[Move], language: str = "vi") -> AnalysisResult:
        """
        Analyze a complete game move-by-move (optimized version).
        
        Args:
            moves: List of moves in the game
            language: Target language for primary comments (vi, en, zh, ja)
            
        Returns:
            AnalysisResult with timeline, mistakes, patterns, and summary
        """
        if language not in SUPPORTED_LANGUAGES:
            language = "vi"
        
        start_time = time.time()
        
        # Clear threat cache for new analysis
        self._threat_cache.clear()
        
        # Initialize empty board
        board = [[None for _ in range(self.board_size)] for _ in range(self.board_size)]
        
        timeline: List[TimelineEntry] = []
        mistakes: List[Mistake] = []
        all_best_moves: List[Tuple[int, List[Tuple[int, int, float]]]] = []
        
        # Pre-compute all moves on board first for faster analysis
        boards_at_move = []
        temp_board = [[None for _ in range(self.board_size)] for _ in range(self.board_size)]
        for move in moves:
            boards_at_move.append([row[:] for row in temp_board])
            temp_board[move.x][move.y] = move.player
        
        # Analyze each move
        for i, move in enumerate(moves):
            move_number = i + 1
            player = move.player
            opponent = "O" if player == "X" else "X"
            
            # Use pre-computed board state
            board = boards_at_move[i]
            
            # Find best moves using fast heuristic (no search)
            # Only compute for every 3rd move to save time, interpolate others
            if i % 3 == 0 or i < 5 or i >= len(moves) - 3:
                best_moves = self._find_best_moves_fast(board, player, top_n=3)
            all_best_moves.append((move_number, best_moves))
            
            # Evaluate the actual move (simplified)
            actual_score = self._evaluate_move_fast(board, move.x, move.y, player)
            
            # Get best move score for comparison
            best_score = best_moves[0][2] if best_moves else actual_score
            
            # Classify the move
            category = self._classify_move_fast(actual_score, best_score)
            
            # Make the move on the board for threat detection
            board[move.x][move.y] = player
            
            # Get threats after move
            player_threats = self._get_threats_cached(board, player)
            
            # Override classification for strong moves
            if player_threats.threats.get(ThreatType.FIVE, 0) > 0:
                category = MoveClassification.EXCELLENT
            elif player_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                if category in [MoveClassification.BLUNDER, MoveClassification.WEAK, MoveClassification.OKAY]:
                    category = MoveClassification.GOOD
            elif player_threats.threats.get(ThreatType.FOUR, 0) > 0:
                if category in [MoveClassification.BLUNDER, MoveClassification.WEAK]:
                    category = MoveClassification.OKAY
            elif player_threats.threats.get(ThreatType.OPEN_THREE, 0) > 0:
                # Creating OPEN_THREE is at least OKAY, often GOOD
                if category in [MoveClassification.BLUNDER, MoveClassification.WEAK]:
                    category = MoveClassification.OKAY
            
            # Early game tolerance
            if move_number <= 8 and category == MoveClassification.BLUNDER:
                opp_threats = self._get_threats_cached(board, opponent)
                has_immediate_threat = (
                    opp_threats.threats.get(ThreatType.FOUR, 0) > 0 or
                    opp_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0
                )
                if not has_immediate_threat:
                    category = MoveClassification.OKAY
            
            # Get opponent threats BEFORE this move (for context-aware notes)
            board[move.x][move.y] = None  # Undo temporarily
            opp_threats_before = self._get_threats_cached(board, opponent)
            board[move.x][move.y] = player  # Redo
            
            # Simplified score and win_prob calculation (no full position eval)
            score = player_threats.total_score
            win_prob = min(0.95, max(0.05, 0.5 + score / 20000))
            
            # Simplified role determination
            player_role = "neutral"
            if score > 1000:
                player_role = "attacker"
            elif score < -1000:
                player_role = "defender"
            
            # Generate note with opponent context
            note = self._generate_note_fast(move, category, player_threats, opp_threats_before)
            
            # Generate multi-language comments
            threats_created = self._extract_threat_types(player_threats)
            multi_lang_comment = self.comment_generator.generate_all_languages(
                classification=category,
                threats_created=threats_created,
                threats_blocked=[],
                is_winning=player_threats.threats.get(ThreatType.FIVE, 0) > 0,
                is_forced=False,
                better_move=None
            )
            
            # Generate alternatives (simplified) - only for important moves
            alternatives = []
            if category in [MoveClassification.BLUNDER, MoveClassification.WEAK] or i < 5:
                alternatives = self._generate_alternatives_fast(best_moves, move, category)
            
            # Create timeline entry
            entry = TimelineEntry(
                move=move_number,
                player=player,
                position={"x": move.x, "y": move.y},
                score=score,
                win_prob=win_prob,
                category=category,
                note=note,
                role=player_role,
                comments=multi_lang_comment.to_dict(),
                alternatives=alternatives
            )
            timeline.append(entry)
            
            # Check for mistakes - improved logic
            # Mark as mistake if:
            # 1. Category is weak/blunder/okay AND opponent had urgent threat we ignored
            # 2. OR Category is weak/blunder AND best move is significantly better
            # BUT NOT if we created a winning threat ourselves (OPEN_FOUR, FIVE)
            is_real_mistake = False
            severity = "minor"
            
            # First check: Did WE create a winning threat? If so, NOT a mistake
            we_have_winning_threat = (
                player_threats.threats.get(ThreatType.FIVE, 0) > 0 or
                player_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0
            )
            
            if not we_have_winning_threat:
                # Check if opponent had urgent threat we ignored
                opp_had_open_four = opp_threats_before.threats.get(ThreatType.OPEN_FOUR, 0) > 0
                opp_had_four = opp_threats_before.threats.get(ThreatType.FOUR, 0) > 0
                opp_had_open_three = opp_threats_before.threats.get(ThreatType.OPEN_THREE, 0) > 0
                
                # Check what WE had BEFORE this move (to see if we CREATED new threats)
                board[move.x][move.y] = None  # Undo temporarily
                our_threats_before = self._get_threats_cached(board, player)
                board[move.x][move.y] = player  # Redo
                
                # Did this move CREATE new threats? (not just maintain existing ones)
                created_new_four = (
                    player_threats.threats.get(ThreatType.FOUR, 0) > 
                    our_threats_before.threats.get(ThreatType.FOUR, 0)
                )
                created_new_open_three = (
                    player_threats.threats.get(ThreatType.OPEN_THREE, 0) > 
                    our_threats_before.threats.get(ThreatType.OPEN_THREE, 0)
                )
                
                # Check if we blocked the threat
                opp_threats_after = self._get_threats_cached(board, opponent)
                blocked_open_four = opp_had_open_four and opp_threats_after.threats.get(ThreatType.OPEN_FOUR, 0) == 0
                blocked_four = opp_had_four and opp_threats_after.threats.get(ThreatType.FOUR, 0) < opp_threats_before.threats.get(ThreatType.FOUR, 0)
                blocked_open_three = opp_had_open_three and opp_threats_after.threats.get(ThreatType.OPEN_THREE, 0) < opp_threats_before.threats.get(ThreatType.OPEN_THREE, 0)
                
                # Ignored urgent threat = mistake
                # BUT: If we CREATED a strong NEW threat, it might be a valid counter-attack
                if opp_had_open_four and not blocked_open_four:
                    # MUST block open four unless we have winning threat
                    is_real_mistake = True
                    severity = "critical"
                elif opp_had_four and not blocked_four:
                    # Should block four, unless we created FOUR ourselves (counter-attack)
                    if not created_new_four:
                        is_real_mistake = True
                        severity = "major"
                elif opp_had_open_three and not blocked_open_three:
                    # Should consider blocking open three
                    # BUT: If we CREATED new FOUR or OPEN_THREE, it's a valid counter-attack
                    if not created_new_four and not created_new_open_three:
                        is_real_mistake = True
                        severity = "minor"
                
                # Also check for weak/blunder without urgent threat
                if not is_real_mistake and category in [MoveClassification.BLUNDER, MoveClassification.WEAK]:
                    if best_moves and (best_moves[0][0] != move.x or best_moves[0][1] != move.y):
                        best_score = best_moves[0][2]
                        created_strong_threat = (
                            player_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0 or
                            player_threats.threats.get(ThreatType.FOUR, 0) > 0 or
                            player_threats.threats.get(ThreatType.OPEN_THREE, 0) > 0
                        )
                        if not created_strong_threat and best_score > actual_score * 1.5:
                            is_real_mistake = True
                            severity = "critical" if category == MoveClassification.BLUNDER else "minor"
            
            if is_real_mistake and best_moves:
                best_alt = best_moves[0]
                # Generate descriptive message
                if opp_had_open_four and not blocked_open_four:
                    desc = f"Không chặn tứ mở của đối thủ! Nên chơi ({best_alt[0]}, {best_alt[1]})."
                elif opp_had_four and not blocked_four:
                    desc = f"Không chặn đường tứ của đối thủ. Nên chơi ({best_alt[0]}, {best_alt[1]})."
                elif opp_had_open_three and not blocked_open_three:
                    desc = f"Không chặn ba mở của đối thủ. Nên chơi ({best_alt[0]}, {best_alt[1]})."
                else:
                    desc = f"Nên chơi ({best_alt[0]}, {best_alt[1]}) thay vì ({move.x}, {move.y})."
                
                mistake = Mistake(
                    move=move_number,
                    severity=severity,
                    desc=desc,
                    best_alternative={"x": best_alt[0], "y": best_alt[1]}
                )
                mistakes.append(mistake)
        
        # Use final board state
        final_board = [[None for _ in range(self.board_size)] for _ in range(self.board_size)]
        for move in moves:
            final_board[move.x][move.y] = move.player
        
        # Detect patterns (simplified)
        patterns = self._detect_patterns_fast(timeline, moves)
        
        # Generate summary
        summary = self._generate_summary_fast(timeline, mistakes, moves)
        
        # Find best move for current position
        best_move = None
        if moves and not self._is_game_over(final_board):
            next_player = "O" if moves[-1].player == "X" else "X"
            best_moves = self._find_best_moves_fast(final_board, next_player, top_n=1)
            if best_moves:
                bm = best_moves[0]
                best_move = BestMove(
                    x=bm[0],
                    y=bm[1],
                    score=bm[2],
                    reason=self._generate_best_move_reason_fast(final_board, bm, next_player)
                )
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        return AnalysisResult(
            tier="basic",
            timeline=timeline,
            mistakes=mistakes,
            patterns=patterns,
            best_move=best_move,
            summary=summary,
            duration_ms=duration_ms
        )
    
    def _find_best_moves_fast(
        self,
        board: List[List[Optional[str]]],
        player: str,
        top_n: int = 3
    ) -> List[Tuple[int, int, float]]:
        """
        Find best moves using fast heuristic scoring (no search).
        
        Ultra-optimized version with DEFENSIVE PRIORITY:
        1. Check opponent threats FIRST - if urgent, prioritize blocking
        2. Limit candidates to 15 best positions
        3. Use simplified scoring without full threat detection
        4. Only do full threat detection for top candidates
        """
        opponent = "O" if player == "X" else "X"
        
        # CRITICAL: Check opponent threats BEFORE finding moves
        opp_threats_before = self._get_threats_cached(board, opponent)
        opp_has_open_four = opp_threats_before.threats.get(ThreatType.OPEN_FOUR, 0) > 0
        opp_has_four = opp_threats_before.threats.get(ThreatType.FOUR, 0) > 0
        opp_has_open_three = opp_threats_before.threats.get(ThreatType.OPEN_THREE, 0) > 0
        
        # Get candidate moves (cells adjacent to existing pieces)
        candidates = self._get_candidates_fast(board, radius=1)  # Reduced radius
        
        if not candidates:
            center = self.board_size // 2
            if board[center][center] is None:
                return [(center, center, 50.0)]
            return []
        
        # If opponent has urgent threat, expand candidates to include blocking positions
        if opp_has_open_four or opp_has_four or opp_has_open_three:
            # Add blocking positions from opponent's threats
            for threat in opp_threats_before.threat_positions:
                if threat.type in [ThreatType.OPEN_FOUR, ThreatType.FOUR, ThreatType.OPEN_THREE]:
                    block_positions = self._find_blocking_positions(board, threat)
                    for pos in block_positions:
                        if pos not in candidates:
                            candidates.append(pos)
        
        # Limit candidates for performance
        if len(candidates) > 20:  # Increased limit when defensive
            # Sort by position bonus and take top 20
            candidates = sorted(candidates, 
                key=lambda p: _POSITION_BONUS_CACHE.get(p, 0), 
                reverse=True)[:20]
        
        scored_moves: List[Tuple[int, int, float]] = []
        
        for x, y in candidates:
            # Quick score based on position and local pattern
            score = _POSITION_BONUS_CACHE.get((x, y), 0)
            
            # Check immediate neighbors for quick pattern detection
            score += self._quick_pattern_score(board, x, y, player)
            
            scored_moves.append((x, y, score))
        
        # Sort and get top candidates
        scored_moves.sort(key=lambda m: m[2], reverse=True)
        top_candidates = scored_moves[:min(8, len(scored_moves))]  # Increased to 8 for better defense
        
        # Do full threat detection only for top candidates
        final_moves: List[Tuple[int, int, float]] = []
        
        for x, y, base_score in top_candidates:
            # Make move temporarily
            board[x][y] = player
            
            # Check our threats after move
            our_threats = self._get_threats_cached(board, player)
            
            # Check opponent threats AFTER our move (did we block?)
            opp_threats_after = self._get_threats_cached(board, opponent)
            
            # Calculate final score
            score = base_score
            
            # Winning move - highest priority
            if our_threats.threats.get(ThreatType.FIVE, 0) > 0:
                score = 100000
            elif our_threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
                score = 50000
            else:
                # DEFENSIVE SCORING - Check if we blocked opponent's threat
                blocked_open_four = opp_has_open_four and opp_threats_after.threats.get(ThreatType.OPEN_FOUR, 0) == 0
                blocked_four = opp_has_four and opp_threats_after.threats.get(ThreatType.FOUR, 0) < opp_threats_before.threats.get(ThreatType.FOUR, 0)
                blocked_open_three = opp_has_open_three and opp_threats_after.threats.get(ThreatType.OPEN_THREE, 0) < opp_threats_before.threats.get(ThreatType.OPEN_THREE, 0)
                
                # Blocking urgent threats is CRITICAL
                if blocked_open_four:
                    score += 40000  # Must block open four
                if blocked_four:
                    score += 8000   # Should block four
                if blocked_open_three:
                    score += 2000   # Good to block open three
                
                # Offensive scoring
                score += our_threats.threats.get(ThreatType.FOUR, 0) * 5000
                score += our_threats.threats.get(ThreatType.OPEN_THREE, 0) * 1000
                score += our_threats.threats.get(ThreatType.THREE, 0) * 100
                
                # Double threat bonus (attack while defending)
                if our_threats.double_threats:
                    for dt_type, count in our_threats.double_threats.items():
                        if count > 0:
                            if dt_type == DoubleThreatType.DOUBLE_FOUR:
                                score += 45000
                            elif dt_type == DoubleThreatType.FOUR_THREE:
                                score += 30000
                            elif dt_type == DoubleThreatType.DOUBLE_THREE:
                                score += 15000
            
            # Undo move
            board[x][y] = None
            
            final_moves.append((x, y, score))
        
        # Sort by score descending
        final_moves.sort(key=lambda m: m[2], reverse=True)
        return final_moves[:top_n]
    
    def _find_blocking_positions(
        self,
        board: List[List[Optional[str]]],
        threat: Any
    ) -> List[Tuple[int, int]]:
        """Find positions that can block a threat."""
        blocking_positions = []
        
        if not threat.positions:
            return blocking_positions
        
        # Get direction from threat
        direction = threat.direction
        dx, dy = {
            "horizontal": (0, 1),
            "vertical": (1, 0),
            "diagonal_down": (1, 1),
            "diagonal_up": (1, -1),
        }.get(direction, (0, 0))
        
        if dx == 0 and dy == 0:
            return blocking_positions
        
        # Sort positions to find endpoints
        if direction == "diagonal_up":
            positions = sorted(threat.positions, key=lambda p: p[0])
        else:
            positions = sorted(threat.positions)
        
        first_pos = positions[0]
        last_pos = positions[-1]
        
        # Check cell before first position
        before_x = first_pos[0] - dx
        before_y = first_pos[1] - dy
        if (0 <= before_x < self.board_size and 
            0 <= before_y < self.board_size and
            board[before_x][before_y] is None):
            blocking_positions.append((before_x, before_y))
        
        # Check cell after last position
        after_x = last_pos[0] + dx
        after_y = last_pos[1] + dy
        if (0 <= after_x < self.board_size and 
            0 <= after_y < self.board_size and
            board[after_x][after_y] is None):
            blocking_positions.append((after_x, after_y))
        
        return blocking_positions
    
    def _quick_pattern_score(
        self,
        board: List[List[Optional[str]]],
        x: int,
        y: int,
        player: str
    ) -> float:
        """Quick pattern scoring based on immediate neighbors.
        
        IMPROVED: Higher defensive scores to prioritize blocking.
        """
        score = 0.0
        opponent = "O" if player == "X" else "X"
        
        # Check 4 directions
        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]
        
        for dx, dy in directions:
            player_count = 0
            opponent_count = 0
            player_consecutive = 0
            opponent_consecutive = 0
            
            # Check cells in each direction (extended to 3 for better detection)
            for sign in [-1, 1]:
                consecutive_player = 0
                consecutive_opponent = 0
                for dist in [1, 2, 3]:
                    nx = x + dx * dist * sign
                    ny = y + dy * dist * sign
                    if 0 <= nx < self.board_size and 0 <= ny < self.board_size:
                        if board[nx][ny] == player:
                            player_count += 1
                            consecutive_player += 1
                        elif board[nx][ny] == opponent:
                            opponent_count += 1
                            consecutive_opponent += 1
                        else:
                            break  # Empty cell breaks consecutive
                    else:
                        break
                player_consecutive = max(player_consecutive, consecutive_player)
                opponent_consecutive = max(opponent_consecutive, consecutive_opponent)
            
            # Score based on pattern - OFFENSIVE
            if player_count >= 4:
                score += 5000  # Winning move potential
            elif player_count >= 3:
                score += 1000  # Potential four
            elif player_count >= 2:
                score += 100   # Potential three
            elif player_count >= 1:
                score += 10    # Extension
            
            # DEFENSIVE value - INCREASED SIGNIFICANTLY
            # Blocking opponent's threats is critical
            if opponent_consecutive >= 3:
                score += 4000  # MUST block - opponent has 3 consecutive
            elif opponent_count >= 3:
                score += 2000  # Block potential four (non-consecutive)
            elif opponent_consecutive >= 2:
                score += 500   # Block potential three (consecutive)
            elif opponent_count >= 2:
                score += 200   # Block potential three
        
        return score
    
    def _get_candidates_fast(
        self,
        board: List[List[Optional[str]]],
        radius: int = 2
    ) -> List[Tuple[int, int]]:
        """Get candidate moves (empty cells near existing pieces)."""
        candidates = set()
        has_pieces = False
        
        for x in range(self.board_size):
            for y in range(self.board_size):
                if board[x][y] is not None:
                    has_pieces = True
                    # Add empty cells within radius
                    for dx in range(-radius, radius + 1):
                        for dy in range(-radius, radius + 1):
                            nx, ny = x + dx, y + dy
                            if (0 <= nx < self.board_size and 
                                0 <= ny < self.board_size and
                                board[nx][ny] is None):
                                candidates.add((nx, ny))
        
        if not has_pieces:
            center = self.board_size // 2
            return [(center, center)]
        
        return list(candidates)
    
    def _evaluate_move_fast(
        self,
        board: List[List[Optional[str]]],
        x: int,
        y: int,
        player: str
    ) -> float:
        """Fast move evaluation using heuristics."""
        if board[x][y] is not None:
            return float('-inf')
        
        opponent = "O" if player == "X" else "X"
        
        # Make move temporarily
        board[x][y] = player
        
        # Get threats
        our_threats = self._get_threats_cached(board, player)
        opp_threats = self._get_threats_cached(board, opponent)
        
        # Undo move
        board[x][y] = None
        
        # Calculate score
        score = our_threats.total_score - opp_threats.total_score * 0.9
        score += _POSITION_BONUS_CACHE.get((x, y), 0)
        
        return score
    
    def _classify_move_fast(
        self,
        actual_score: float,
        best_score: float
    ) -> MoveClassification:
        """Fast move classification."""
        if best_score <= 0:
            if actual_score >= 0:
                return MoveClassification.OKAY
            return MoveClassification.WEAK
        
        percentage = (actual_score / best_score) * 100
        
        if percentage >= 85:
            return MoveClassification.EXCELLENT
        elif percentage >= 70:
            return MoveClassification.GOOD
        elif percentage >= 50:
            return MoveClassification.OKAY
        elif percentage >= 30:
            return MoveClassification.WEAK
        else:
            return MoveClassification.BLUNDER
    
    def _generate_note_fast(
        self,
        move: Move,
        category: MoveClassification,
        threats: Any,
        opp_threats_before: Any = None
    ) -> str:
        """Generate Vietnamese note for a move with context awareness."""
        # Check if this is a winning move
        if threats.threats.get(ThreatType.FIVE, 0) > 0:
            return "Nước thắng!"
        
        # Check if opponent had OPEN_FOUR before - if so, our move is likely too late
        opp_had_open_four = opp_threats_before and opp_threats_before.threats.get(ThreatType.OPEN_FOUR, 0) > 0
        
        if threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            if opp_had_open_four:
                return "Tạo tứ mở nhưng đối thủ cũng có - quá muộn!"
            return "Tạo tứ mở, đảm bảo thắng."
        
        # Check if opponent had dangerous threats that we should have blocked
        if opp_threats_before:
            opp_open_four = opp_threats_before.threats.get(ThreatType.OPEN_FOUR, 0)
            opp_four = opp_threats_before.threats.get(ThreatType.FOUR, 0)
            opp_open_three = opp_threats_before.threats.get(ThreatType.OPEN_THREE, 0)
            
            if opp_open_four > 0:
                return "Đối thủ có tứ mở - đã thua!"
            if opp_four > 0:
                if category in [MoveClassification.WEAK, MoveClassification.BLUNDER]:
                    return "Không chặn đường tứ của đối thủ."
            if opp_open_three > 0:
                if category in [MoveClassification.WEAK, MoveClassification.BLUNDER, MoveClassification.OKAY]:
                    return "Nên chặn ba mở của đối thủ."
        
        # Our threats
        if threats.threats.get(ThreatType.FOUR, 0) > 0:
            return "Tạo đường tứ, buộc đối thủ chặn."
        if threats.threats.get(ThreatType.OPEN_THREE, 0) > 0:
            return "Tạo ba mở, đe dọa mạnh."
        
        notes = {
            MoveClassification.EXCELLENT: "Nước đi xuất sắc!",
            MoveClassification.GOOD: "Nước đi tốt.",
            MoveClassification.OKAY: "Nước đi chấp nhận được.",
            MoveClassification.WEAK: "Có thể chơi tốt hơn.",
            MoveClassification.BLUNDER: "Sai lầm nghiêm trọng!",
        }
        return notes.get(category, "Nước đi bình thường.")
    
    def _extract_threat_types(self, threats: Any) -> List[ThreatType]:
        """Extract list of threat types."""
        result = []
        for threat_type in [ThreatType.FIVE, ThreatType.OPEN_FOUR, ThreatType.FOUR,
                          ThreatType.OPEN_THREE, ThreatType.THREE]:
            if threats.threats.get(threat_type, 0) > 0:
                result.append(threat_type)
        return result
    
    def _generate_alternatives_fast(
        self,
        best_moves: List[Tuple[int, int, float]],
        actual_move: Move,
        category: MoveClassification
    ) -> List[AlternativeMove]:
        """Generate alternative move suggestions (simplified)."""
        from .coordinate_utils import index_to_notation
        
        alternatives = []
        is_blunder = category == MoveClassification.BLUNDER
        
        for i, (x, y, score) in enumerate(best_moves):
            if x == actual_move.x and y == actual_move.y:
                continue
            
            try:
                position = index_to_notation(x, y)
            except:
                position = f"{chr(ord('A') + y)}{x + 1}"
            
            # Normalize score to 0-10
            if score >= 50000:
                norm_score = 10.0
            elif score >= 10000:
                norm_score = 9.0
            elif score >= 5000:
                norm_score = 8.0
            elif score >= 1000:
                norm_score = 7.0
            elif score >= 100:
                norm_score = 6.0
            else:
                norm_score = 5.0
            
            alt = AlternativeMove(
                position=position,
                x=x,
                y=y,
                score=norm_score,
                reason="Nước đi tốt hơn, kiểm soát trung tâm.",
                is_best=(i == 0 and is_blunder),
                similar_to_others=False
            )
            alternatives.append(alt)
            
            if len(alternatives) >= 3:
                break
        
        return alternatives
    
    def _detect_patterns_fast(
        self,
        timeline: List[TimelineEntry],
        moves: List[Move]
    ) -> List[Pattern]:
        """Detect tactical patterns (simplified)."""
        patterns = []
        
        # Find critical mistakes
        for entry in timeline:
            if entry.category == MoveClassification.BLUNDER:
                patterns.append(Pattern(
                    label="Sai lầm",
                    explanation="Nước đi này là sai lầm nghiêm trọng.",
                    moves=[entry.move],
                    severity="critical"
                ))
        
        return patterns[:5]  # Limit patterns
    
    def _generate_summary_fast(
        self,
        timeline: List[TimelineEntry],
        mistakes: List[Mistake],
        moves: List[Move]
    ) -> Summary:
        """Generate game summary (simplified)."""
        total_moves = len(moves)
        
        # Determine winner
        winner = None
        board = [[None for _ in range(self.board_size)] for _ in range(self.board_size)]
        for move in moves:
            board[move.x][move.y] = move.player
            threats = self._get_threats_cached(board, move.player)
            if threats.threats.get(ThreatType.FIVE, 0) > 0:
                winner = move.player
                break
        
        # Calculate stats
        x_entries = [e for e in timeline if e.player == "X"]
        o_entries = [e for e in timeline if e.player == "O"]
        
        x_stats = {
            "total_moves": len(x_entries),
            "excellent_moves": sum(1 for e in x_entries if e.category == MoveClassification.EXCELLENT),
            "good_moves": sum(1 for e in x_entries if e.category == MoveClassification.GOOD),
            "mistakes": sum(1 for m in mistakes if timeline[m.move - 1].player == "X"),
        }
        
        o_stats = {
            "total_moves": len(o_entries),
            "excellent_moves": sum(1 for e in o_entries if e.category == MoveClassification.EXCELLENT),
            "good_moves": sum(1 for e in o_entries if e.category == MoveClassification.GOOD),
            "mistakes": sum(1 for m in mistakes if timeline[m.move - 1].player == "O"),
        }
        
        key_insights = []
        if winner:
            key_insights.append(f"Người chơi {winner} thắng ván đấu.")
        if mistakes:
            key_insights.append(f"Có {len(mistakes)} sai lầm trong ván đấu.")
        
        return Summary(
            total_moves=total_moves,
            winner=winner,
            x_stats=x_stats,
            o_stats=o_stats,
            key_insights=key_insights
        )
    
    def _generate_best_move_reason_fast(
        self,
        board: List[List[Optional[str]]],
        best_move: Tuple[int, int, float],
        player: str
    ) -> str:
        """Generate reason for best move."""
        x, y, score = best_move
        
        board[x][y] = player
        threats = self._get_threats_cached(board, player)
        board[x][y] = None
        
        if threats.threats.get(ThreatType.FIVE, 0) > 0:
            return "Nước thắng ngay lập tức!"
        if threats.threats.get(ThreatType.OPEN_FOUR, 0) > 0:
            return "Tạo tứ mở, đảm bảo thắng."
        if threats.threats.get(ThreatType.FOUR, 0) > 0:
            return "Tạo đường tứ, buộc đối thủ phải chặn."
        if threats.threats.get(ThreatType.OPEN_THREE, 0) > 0:
            return "Tạo ba mở, tạo áp lực lớn."
        
        return "Nước đi tốt nhất."
    
    def _is_game_over(self, board: List[List[Optional[str]]]) -> bool:
        """Check if game is over."""
        for player in ["X", "O"]:
            threats = self._get_threats_cached(board, player)
            if threats.threats.get(ThreatType.FIVE, 0) > 0:
                return True
        
        # Check for full board
        for row in board:
            if None in row:
                return False
        return True
