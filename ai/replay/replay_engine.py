"""
AI Match Analysis System - Replay Engine

This module implements the ReplayEngine class for interactive replay
of matches, allowing users to navigate through moves and play alternative
moves against AI in "what-if" mode.

Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
"""

import sys
import os
import uuid
import time
from typing import List, Optional, Dict, Tuple
from datetime import datetime

# Ensure the ai directory is in the path for imports
AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

from analysis.types import (
    Move,
    ReplaySession,
    BOARD_SIZE,
)
from analysis.position_evaluator import PositionEvaluator
from analysis.threat_detector import ThreatDetector
from analysis.redis_cache import get_cache


class ReplayEngine:
    """
    Interactive replay engine for Gomoku/Caro matches.
    
    Allows users to:
    - Navigate through match moves
    - Play alternative moves from any position
    - Get AI responses in "what-if" mode
    - Compare original and alternative outcomes
    
    Requirements:
    - 5.1: Create replay session with original moves
    - 5.2: Navigate to specific move within 200ms
    - 5.3: Mark divergence point in what-if mode
    - 5.4: AI responds to user moves with adaptive difficulty
    - 5.5: Compare original vs current win probability
    - 5.6: Clean up session resources
    """
    
    def __init__(self, board_size: int = BOARD_SIZE, use_redis: bool = True):
        """
        Initialize the ReplayEngine.
        
        Args:
            board_size: Size of the board (default 15x15)
            use_redis: Whether to use Redis for session storage (default True)
        """
        self.board_size = board_size
        self.threat_detector = ThreatDetector(board_size)
        self.position_evaluator = PositionEvaluator(self.threat_detector, board_size)
        
        # Redis cache for session storage
        self.use_redis = use_redis
        self._redis_cache = get_cache() if use_redis else None
        
        # Fallback in-memory storage (used when Redis unavailable)
        self._memory_sessions: Dict[str, ReplaySession] = {}
    
    def create_replay_session(
        self,
        match_id: str,
        moves: List[Move],
        user_id: Optional[str] = None
    ) -> str:
        """
        Create a new replay session.
        
        Initializes an empty board and stores the original moves
        for replay navigation.
        
        Args:
            match_id: UUID of the match being replayed
            moves: List of original moves from the match
            user_id: UUID of the user creating the session
            
        Returns:
            session_id: UUID of the created session
            
        Requirements: 5.1
        """
        session_id = str(uuid.uuid4())
        
        # Initialize empty board
        empty_board = [[None for _ in range(self.board_size)] 
                      for _ in range(self.board_size)]
        
        # Create session
        session = ReplaySession(
            session_id=session_id,
            match_id=match_id,
            original_moves=moves.copy(),
            current_board=empty_board,
            current_move_index=-1,  # -1 means no moves played yet
            mode="replay",
            divergence_point=None,
            user_id=user_id,
            created_at=datetime.utcnow().isoformat()
        )
        
        # Store session (Redis or memory)
        self._save_session(session)
        
        return session_id
    
    def navigate_to_move(
        self,
        session_id: str,
        move_index: int
    ) -> Dict:
        """
        Navigate to a specific move in the replay.
        
        Replays the board state up to the specified move index.
        Must complete within 200ms (Requirement 5.2).
        
        Args:
            session_id: UUID of the replay session
            move_index: Target move index (0-based)
            
        Returns:
            Dict with board_state, current_move, and player_turn
            
        Raises:
            ValueError: If session not found or move_index invalid
            
        Requirements: 5.2
        """
        start_time = time.time()
        
        # Get session from Redis or memory
        session = self._get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        # Validate move_index
        if move_index < -1 or move_index >= len(session.original_moves):
            raise ValueError(
                f"Invalid move_index {move_index}. "
                f"Must be between -1 and {len(session.original_moves) - 1}"
            )
        
        # Reset board to empty
        board = [[None for _ in range(self.board_size)] 
                for _ in range(self.board_size)]
        
        # Replay moves up to move_index
        for i in range(move_index + 1):
            move = session.original_moves[i]
            board[move.x][move.y] = move.player
        
        # Update session
        session.current_board = board
        session.current_move_index = move_index
        
        # Save updated session
        self._save_session(session)
        
        # Determine whose turn it is
        if move_index == -1:
            player_turn = "X"  # First player
        elif move_index >= len(session.original_moves) - 1:
            # Game ended
            player_turn = None
        else:
            # Next player's turn
            last_player = session.original_moves[move_index].player
            player_turn = "O" if last_player == "X" else "X"
        
        # Check performance requirement (200ms)
        elapsed_ms = (time.time() - start_time) * 1000
        if elapsed_ms > 200:
            print(f"Warning: navigate_to_move took {elapsed_ms:.2f}ms (>200ms)")
        
        return {
            "board_state": board,
            "current_move": move_index,
            "player_turn": player_turn
        }
    
    def play_from_here(
        self,
        session_id: str,
        user_move: Move,
        difficulty: str = 'hard'
    ) -> Dict:
        """
        Play an alternative move from the current position.
        
        This is the core "what-if" functionality that allows users to
        explore alternative game lines. The process:
        1. Validate the user's move
        2. Mark the divergence point (where user deviated from original game)
        3. Apply user's move to the board
        4. Generate AI response move with specified difficulty
        5. Compare outcomes between original and alternative lines
        
        Args:
            session_id: UUID of the replay session
            user_move: The alternative move to play
            difficulty: AI difficulty level ('easy', 'medium', 'hard')
            
        Returns:
            Dict with board_state, ai_move, original_outcome,
            current_win_prob, and comparison
            
        Raises:
            ValueError: If session not found or move invalid
            
        Requirements: 5.3, 5.4, 5.5, 7.2, 7.3, 7.4
        """
        # ============================================
        # STEP 1: Session and Move Validation
        # ============================================
        session = self._get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        # Ensure move is valid (within bounds and cell is empty)
        if not self._is_valid_move(session.current_board, user_move):
            raise ValueError(
                f"Invalid move ({user_move.x}, {user_move.y}): "
                f"cell occupied or out of bounds"
            )
        
        # ============================================
        # STEP 2: Mark Divergence Point (Requirement 5.3)
        # ============================================
        # First alternative move switches from "replay" to "what_if" mode
        # and records where the user diverged from the original game
        if session.mode == "replay":
            session.divergence_point = session.current_move_index + 1
            session.mode = "what_if"
        
        # ============================================
        # STEP 3: Apply User's Alternative Move
        # ============================================
        session.current_board[user_move.x][user_move.y] = user_move.player
        session.current_move_index += 1
        
        # ============================================
        # STEP 4: Calculate Original vs Current Outcomes (Requirement 5.5)
        # ============================================
        # Get what the win probability was in the original game at this point
        original_outcome = self._get_original_outcome(session)
        
        # Calculate current win probability after user's alternative move
        current_eval = self.position_evaluator.evaluate_position(
            session.current_board,
            user_move.player
        )
        current_win_prob = current_eval.win_probability
        
        # ============================================
        # STEP 5: Generate AI Response (Requirement 5.4, 7.2, 7.3, 7.4)
        # ============================================
        # AI plays as the opponent with specified difficulty
        opponent = "O" if user_move.player == "X" else "X"
        ai_move = self._generate_ai_move(session.current_board, opponent, difficulty)
        
        # Apply AI's response move if one was generated
        if ai_move:
            session.current_board[ai_move.x][ai_move.y] = ai_move.player
            session.current_move_index += 1
            
            # Recalculate win probability after AI's response
            ai_eval = self.position_evaluator.evaluate_position(
                session.current_board,
                user_move.player
            )
            current_win_prob = ai_eval.win_probability
        
        # ============================================
        # STEP 6: Generate Comparison Analysis
        # ============================================
        # Create Vietnamese text comparing original vs alternative outcomes
        comparison = self._generate_comparison(
            original_outcome,
            current_win_prob,
            user_move.player
        )
        
        # Save updated session
        self._save_session(session)
        
        return {
            "board_state": session.current_board,
            "ai_move": ai_move,
            "original_outcome": original_outcome,
            "current_win_prob": current_win_prob,
            "comparison": comparison
        }
    
    def analyze_divergence(self, session_id: str) -> Dict:
        """
        Analyze the divergence between original and alternative play.
        
        Compares the original game outcome with the current what-if
        scenario to provide insights.
        
        Args:
            session_id: UUID of the replay session
            
        Returns:
            Dict with divergence analysis
            
        Raises:
            ValueError: If session not found or not in what-if mode
            
        Requirements: 5.5
        """
        # Get session from Redis or memory
        session = self._get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        if session.mode != "what_if":
            raise ValueError("Session is not in what-if mode")
        
        if session.divergence_point is None:
            raise ValueError("No divergence point set")
        
        # Get original outcome
        original_outcome = self._get_original_outcome(session)
        
        # Get current outcome
        # Determine which player we're analyzing for
        if session.current_move_index >= 0:
            # Use the player from the divergence point
            divergence_move_idx = session.divergence_point - 1
            if divergence_move_idx >= 0 and divergence_move_idx < len(session.original_moves):
                player = session.original_moves[divergence_move_idx].player
            else:
                player = "X"  # Default to X
        else:
            player = "X"
        
        current_eval = self.position_evaluator.evaluate_position(
            session.current_board,
            player
        )
        current_outcome = current_eval.win_probability
        
        # Calculate difference
        outcome_diff = current_outcome - original_outcome
        
        # Generate analysis
        if outcome_diff > 0.1:
            analysis = "Nhánh mới tốt hơn đáng kể so với trận đấu gốc."
        elif outcome_diff > 0.05:
            analysis = "Nhánh mới có lợi thế nhẹ hơn trận đấu gốc."
        elif outcome_diff < -0.1:
            analysis = "Nhánh mới tệ hơn đáng kể so với trận đấu gốc."
        elif outcome_diff < -0.05:
            analysis = "Nhánh mới có bất lợi hơn trận đấu gốc."
        else:
            analysis = "Nhánh mới tương đương với trận đấu gốc."
        
        return {
            "divergence_point": session.divergence_point,
            "original_outcome": original_outcome,
            "current_outcome": current_outcome,
            "outcome_difference": outcome_diff,
            "analysis": analysis
        }
    
    def undo_move(self, session_id: str) -> Dict:
        """
        Undo the last move pair (user + AI) in what-if mode.
        
        Removes the last two moves from the board and recalculates
        the win probability. If all alternative moves are undone,
        returns to the divergence point state.
        
        Args:
            session_id: UUID of the replay session
            
        Returns:
            Dict with board_state, current_move_index, win_prob, can_undo
            
        Raises:
            ValueError: If session not found or not in what-if mode
            
        Requirements: 6.1, 6.2, 6.3
        """
        session = self._get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        if session.mode != "what_if":
            raise ValueError("Session is not in what-if mode")
        
        if session.divergence_point is None:
            raise ValueError("No divergence point set")
        
        # Check if we can undo (must have moves after divergence point)
        moves_after_divergence = session.current_move_index - (session.divergence_point - 1)
        if moves_after_divergence <= 0:
            raise ValueError("Cannot undo: already at divergence point")
        
        # Determine how many moves to undo (2 for user+AI pair, or 1 if odd)
        moves_to_undo = min(2, moves_after_divergence)
        
        # Rebuild board state from original moves up to divergence point
        # then replay any remaining alternative moves
        new_move_index = session.current_move_index - moves_to_undo
        
        # Reset board to empty
        board = [[None for _ in range(self.board_size)] 
                for _ in range(self.board_size)]
        
        # Replay original moves up to divergence point
        for i in range(session.divergence_point):
            if i < len(session.original_moves):
                move = session.original_moves[i]
                board[move.x][move.y] = move.player
        
        # Update session
        session.current_board = board
        session.current_move_index = session.divergence_point - 1
        
        # If we're back at divergence point, switch back to replay mode
        if new_move_index <= session.divergence_point - 1:
            session.mode = "replay"
            session.divergence_point = None
        
        # Calculate win probability
        player = "X"  # Default
        if session.current_move_index >= 0 and session.current_move_index < len(session.original_moves):
            player = session.original_moves[session.current_move_index].player
        
        current_eval = self.position_evaluator.evaluate_position(
            session.current_board,
            player
        )
        
        # Save updated session
        self._save_session(session)
        
        # Determine if we can undo more
        can_undo = session.mode == "what_if" and session.divergence_point is not None
        
        return {
            "board_state": session.current_board,
            "current_move_index": session.current_move_index,
            "win_prob": current_eval.win_probability,
            "can_undo": can_undo,
            "mode": session.mode
        }
    
    def cleanup_session(self, session_id: str) -> None:
        """
        Clean up a replay session and free resources.
        
        Removes the session from Redis and memory.
        
        Args:
            session_id: UUID of the replay session
            
        Requirements: 5.6
        """
        self._delete_session(session_id)
    
    def get_session(self, session_id: str) -> Optional[ReplaySession]:
        """
        Get a replay session by ID.
        
        Args:
            session_id: UUID of the replay session
            
        Returns:
            ReplaySession or None if not found
        """
        return self._get_session(session_id)
    
    def _get_session(self, session_id: str) -> Optional[ReplaySession]:
        """
        Internal method to get session from Redis or memory.
        
        Args:
            session_id: UUID of the replay session
            
        Returns:
            ReplaySession or None
        """
        # Try Redis first
        if self.use_redis and self._redis_cache:
            session_data = self._redis_cache.get_session(session_id)
            if session_data:
                # Reconstruct ReplaySession from dict
                return self._dict_to_session(session_data)
        
        # Fallback to memory
        return self._memory_sessions.get(session_id)
    
    def _save_session(self, session: ReplaySession) -> bool:
        """
        Save session to Redis or memory.
        
        Args:
            session: ReplaySession to save
            
        Returns:
            True if saved successfully
        """
        # Save to Redis
        if self.use_redis and self._redis_cache:
            session_data = self._session_to_dict(session)
            if self._redis_cache.set_session(session.session_id, session_data):
                return True
        
        # Fallback to memory
        self._memory_sessions[session.session_id] = session
        return True
    
    def _delete_session(self, session_id: str) -> bool:
        """
        Delete session from Redis or memory.
        
        Args:
            session_id: UUID of the session
            
        Returns:
            True if deleted
        """
        deleted = False
        
        # Delete from Redis
        if self.use_redis and self._redis_cache:
            deleted = self._redis_cache.delete_session(session_id)
        
        # Also delete from memory
        if session_id in self._memory_sessions:
            del self._memory_sessions[session_id]
            deleted = True
        
        return deleted
    
    def _session_to_dict(self, session: ReplaySession) -> Dict:
        """
        Convert ReplaySession to dict for Redis storage.
        
        Args:
            session: ReplaySession object
            
        Returns:
            Dict representation
        """
        return {
            'session_id': session.session_id,
            'match_id': session.match_id,
            'original_moves': [
                {'x': m.x, 'y': m.y, 'player': m.player}
                for m in session.original_moves
            ],
            'current_board': session.current_board,
            'current_move_index': session.current_move_index,
            'mode': session.mode,
            'divergence_point': session.divergence_point,
            'user_id': session.user_id,
            'created_at': session.created_at
        }
    
    def _dict_to_session(self, data: Dict) -> ReplaySession:
        """
        Convert dict to ReplaySession.
        
        Args:
            data: Dict from Redis
            
        Returns:
            ReplaySession object
        """
        return ReplaySession(
            session_id=data['session_id'],
            match_id=data['match_id'],
            original_moves=[
                Move(x=m['x'], y=m['y'], player=m['player'])
                for m in data['original_moves']
            ],
            current_board=data['current_board'],
            current_move_index=data['current_move_index'],
            mode=data['mode'],
            divergence_point=data.get('divergence_point'),
            user_id=data.get('user_id'),
            created_at=data.get('created_at')
        )
    
    # ============================================
    # Private Helper Methods
    # ============================================
    
    def _is_valid_move(
        self,
        board: List[List[Optional[str]]],
        move: Move
    ) -> bool:
        """
        Check if a move is valid.
        
        Args:
            board: Current board state
            move: Move to validate
            
        Returns:
            True if move is valid (empty cell within bounds)
        """
        # Check bounds
        if move.x < 0 or move.x >= self.board_size:
            return False
        if move.y < 0 or move.y >= self.board_size:
            return False
        
        # Check if cell is empty
        if board[move.x][move.y] is not None:
            return False
        
        return True
    
    def _get_original_outcome(self, session: ReplaySession) -> float:
        """
        Get the win probability from the original game at the divergence point.
        
        This is used for comparison analysis to show how the user's
        alternative moves compare to what happened in the original game.
        
        The method reconstructs the board state from the original moves
        up to the divergence point and evaluates the position.
        
        Args:
            session: Replay session containing original moves and divergence info
            
        Returns:
            Win probability (0-1) from original game at divergence point
        """
        # Create fresh board to replay original moves
        board = [[None for _ in range(self.board_size)] 
                for _ in range(self.board_size)]
        
        # Determine which move index to evaluate
        # In what-if mode: use the move just before divergence
        # In replay mode: use current position
        target_index = session.divergence_point - 1 if session.divergence_point else session.current_move_index
        
        # No moves played yet = equal chances
        if target_index < 0:
            return 0.5
        
        # Replay original moves up to target index
        for i in range(min(target_index + 1, len(session.original_moves))):
            move = session.original_moves[i]
            board[move.x][move.y] = move.player
        
        # Determine which player's perspective to evaluate from
        if target_index >= 0 and target_index < len(session.original_moves):
            player = session.original_moves[target_index].player
        else:
            player = "X"  # Default to X if no moves
        
        # Evaluate the reconstructed position
        eval_result = self.position_evaluator.evaluate_position(board, player)
        return eval_result.win_probability
    
    def _generate_ai_move(
        self,
        board: List[List[Optional[str]]],
        player: str,
        difficulty: str = 'hard'
    ) -> Optional[Move]:
        """
        Generate an AI move for the given player with difficulty adjustment.
        
        Uses the position evaluator to find moves based on:
        - Offensive potential (threats created)
        - Defensive value (opponent threats blocked)
        - Position bonus (center positions preferred)
        
        Difficulty levels:
        - 'easy': Select randomly from top 5 moves
        - 'medium': Select randomly from top 3 moves
        - 'hard': Always select the best move
        
        Args:
            board: Current board state (2D array)
            player: Player to generate move for ("X" or "O")
            difficulty: AI difficulty level ('easy', 'medium', 'hard')
            
        Returns:
            Move object or None if no valid moves (board full)
            
        Requirements: 5.4, 7.2, 7.3, 7.4
        """
        import random
        
        # Determine how many top moves to consider based on difficulty
        if difficulty == 'easy':
            top_n = 5
        elif difficulty == 'medium':
            top_n = 3
        else:  # 'hard' or default
            top_n = 1
        
        # Use position evaluator to find the best moves
        best_moves = self.position_evaluator.find_best_moves(
            board,
            player,
            top_n=top_n
        )
        
        # No valid moves available (board might be full)
        if not best_moves:
            return None
        
        # Select move based on difficulty
        if difficulty == 'hard' or len(best_moves) == 1:
            # Always select the best move
            x, y, score = best_moves[0]
        else:
            # Randomly select from available top moves
            x, y, score = random.choice(best_moves)
        
        return Move(x=x, y=y, player=player)
    
    def _generate_comparison(
        self,
        original_outcome: float,
        current_outcome: float,
        player: str
    ) -> str:
        """
        Generate Vietnamese comparison text.
        
        Args:
            original_outcome: Win probability in original game
            current_outcome: Current win probability
            player: Player being analyzed
            
        Returns:
            Vietnamese comparison text
        """
        diff = current_outcome - original_outcome
        
        if diff > 0.2:
            return f"Nhánh mới tốt hơn nhiều! Tỷ lệ thắng tăng {diff*100:.1f}%."
        elif diff > 0.1:
            return f"Nhánh mới tốt hơn. Tỷ lệ thắng tăng {diff*100:.1f}%."
        elif diff > 0.05:
            return f"Nhánh mới có lợi thế nhẹ. Tỷ lệ thắng tăng {diff*100:.1f}%."
        elif diff < -0.2:
            return f"Nhánh mới tệ hơn nhiều. Tỷ lệ thắng giảm {abs(diff)*100:.1f}%."
        elif diff < -0.1:
            return f"Nhánh mới tệ hơn. Tỷ lệ thắng giảm {abs(diff)*100:.1f}%."
        elif diff < -0.05:
            return f"Nhánh mới có bất lợi. Tỷ lệ thắng giảm {abs(diff)*100:.1f}%."
        else:
            return f"Nhánh mới tương đương với trận gốc. Chênh lệch {abs(diff)*100:.1f}%."
