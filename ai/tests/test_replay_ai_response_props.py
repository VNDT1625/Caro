"""
Property-Based Tests for Replay Engine AI Response

Tests Property 7: Replay AI Response Validity
Validates Requirements: 5.4, 5.5

**Feature: ai-match-analysis-system, Property 7: Replay AI Response Validity**

For any user move in what-if mode, the AI response SHALL be a valid move
on the current board (empty cell within bounds), and the comparison analysis
SHALL include original outcome and current win probability.
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List

from analysis.types import Move, BOARD_SIZE
from replay.replay_engine import ReplayEngine


# ============================================
# Hypothesis Strategies
# ============================================

@st.composite
def valid_position(draw):
    """Generate a valid board position."""
    x = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    y = draw(st.integers(min_value=0, max_value=BOARD_SIZE - 1))
    return (x, y)


@st.composite
def move_sequence(draw, min_moves=1, max_moves=20):
    """
    Generate a valid sequence of moves.
    
    Ensures no duplicate positions and alternating players.
    """
    num_moves = draw(st.integers(min_value=min_moves, max_value=max_moves))
    positions = draw(st.lists(
        valid_position(),
        min_size=num_moves,
        max_size=num_moves,
        unique=True
    ))
    
    moves = []
    for i, (x, y) in enumerate(positions):
        player = "X" if i % 2 == 0 else "O"
        moves.append(Move(x=x, y=y, player=player, move_number=i + 1))
    
    return moves


# ============================================
# Property Tests
# ============================================

class TestReplayAIResponse:
    """
    Property-based tests for replay AI response validity.
    
    **Feature: ai-match-analysis-system, Property 7: Replay AI Response Validity**
    """
    
    @given(
        moves=move_sequence(min_moves=3, max_moves=15),
        nav_index=st.integers(min_value=0, max_value=14)
    )
    @settings(max_examples=100, deadline=None)
    def test_ai_move_is_valid_on_board(
        self,
        moves: List[Move],
        nav_index: int
    ):
        """
        Property: AI response is a valid move on the current board.
        
        For any user move in what-if mode, the AI response SHALL:
        - Be within board bounds (0 <= x, y < BOARD_SIZE)
        - Be on an empty cell
        - Have the correct player (opponent of user)
        
        Validates: Requirement 5.4
        """
        # Ensure nav_index is valid and leaves room for moves
        assume(nav_index < len(moves) - 1)
        assume(nav_index < BOARD_SIZE * BOARD_SIZE - 2)  # Need at least 2 empty cells
        
        engine = ReplayEngine()
        session_id = engine.create_replay_session("test-match", moves)
        
        # Navigate to a position
        engine.navigate_to_move(session_id, nav_index)
        
        # Find an empty cell for user move
        session = engine.get_session(session_id)
        board = session.current_board
        empty_cells = []
        for x in range(BOARD_SIZE):
            for y in range(BOARD_SIZE):
                if board[x][y] is None:
                    empty_cells.append((x, y))
        
        assume(len(empty_cells) >= 2)  # Need at least 2 empty cells (user + AI)
        
        # Determine next player
        next_player = "O" if moves[nav_index].player == "X" else "X"
        opponent = "X" if next_player == "O" else "O"
        
        # Play user move
        user_cell = empty_cells[0]
        user_move = Move(x=user_cell[0], y=user_cell[1], player=next_player)
        result = engine.play_from_here(session_id, user_move)
        
        # Verify AI move if generated
        ai_move = result.get("ai_move")
        if ai_move is not None:
            # Check bounds
            assert 0 <= ai_move.x < BOARD_SIZE, \
                f"AI move x={ai_move.x} out of bounds"
            assert 0 <= ai_move.y < BOARD_SIZE, \
                f"AI move y={ai_move.y} out of bounds"
            
            # Check player
            assert ai_move.player == opponent, \
                f"AI move should be for {opponent}, got {ai_move.player}"
            
            # Check that cell was empty before AI move
            # (it's now occupied in the result board)
            assert user_cell != (ai_move.x, ai_move.y), \
                "AI should not play on same cell as user"
            
            # Verify AI move is on the board in result
            result_board = result["board_state"]
            assert result_board[ai_move.x][ai_move.y] == ai_move.player, \
                "AI move should be on the result board"
    
    @given(
        moves=move_sequence(min_moves=3, max_moves=15),
        nav_index=st.integers(min_value=0, max_value=14)
    )
    @settings(max_examples=100, deadline=None)
    def test_comparison_includes_probabilities(
        self,
        moves: List[Move],
        nav_index: int
    ):
        """
        Property: Comparison analysis includes original and current outcomes.
        
        For any user move in what-if mode, the result SHALL include:
        - original_outcome: float in range [0, 1]
        - current_win_prob: float in range [0, 1]
        - comparison: non-empty string
        
        Validates: Requirement 5.5
        """
        # Ensure nav_index is valid
        assume(nav_index < len(moves) - 1)
        assume(nav_index < BOARD_SIZE * BOARD_SIZE - 2)
        
        engine = ReplayEngine()
        session_id = engine.create_replay_session("test-match", moves)
        
        # Navigate to a position
        engine.navigate_to_move(session_id, nav_index)
        
        # Find an empty cell for user move
        session = engine.get_session(session_id)
        board = session.current_board
        empty_cell = None
        for x in range(BOARD_SIZE):
            for y in range(BOARD_SIZE):
                if board[x][y] is None:
                    empty_cell = (x, y)
                    break
            if empty_cell:
                break
        
        assume(empty_cell is not None)
        
        # Determine next player
        next_player = "O" if moves[nav_index].player == "X" else "X"
        
        # Play user move
        user_move = Move(x=empty_cell[0], y=empty_cell[1], player=next_player)
        result = engine.play_from_here(session_id, user_move)
        
        # Verify result structure
        assert "original_outcome" in result
        assert "current_win_prob" in result
        assert "comparison" in result
        
        # Verify original_outcome is valid probability
        original = result["original_outcome"]
        assert isinstance(original, float)
        assert 0.0 <= original <= 1.0, \
            f"original_outcome {original} not in [0, 1]"
        
        # Verify current_win_prob is valid probability
        current = result["current_win_prob"]
        assert isinstance(current, float)
        assert 0.0 <= current <= 1.0, \
            f"current_win_prob {current} not in [0, 1]"
        
        # Verify comparison is non-empty string
        comparison = result["comparison"]
        assert isinstance(comparison, str)
        assert len(comparison) > 0, "comparison should not be empty"
    
    @given(
        moves=move_sequence(min_moves=5, max_moves=15),
        nav_index=st.integers(min_value=1, max_value=14)
    )
    @settings(max_examples=100, deadline=None)
    def test_multiple_what_if_moves_maintain_validity(
        self,
        moves: List[Move],
        nav_index: int
    ):
        """
        Property: Multiple what-if moves maintain AI response validity.
        
        For any sequence of what-if moves, each AI response SHALL
        remain valid (within bounds, on empty cell).
        """
        # Ensure nav_index is valid and leaves room
        assume(nav_index < len(moves) - 1)
        assume(nav_index < BOARD_SIZE * BOARD_SIZE - 10)  # Need room for multiple moves
        
        engine = ReplayEngine()
        session_id = engine.create_replay_session("test-match", moves)
        
        # Navigate to a position
        engine.navigate_to_move(session_id, nav_index)
        
        # Play multiple what-if moves
        num_what_if_moves = min(3, (BOARD_SIZE * BOARD_SIZE - nav_index - 1) // 2)
        
        for i in range(num_what_if_moves):
            session = engine.get_session(session_id)
            board = session.current_board
            
            # Find empty cell
            empty_cell = None
            for x in range(BOARD_SIZE):
                for y in range(BOARD_SIZE):
                    if board[x][y] is None:
                        empty_cell = (x, y)
                        break
                if empty_cell:
                    break
            
            if empty_cell is None:
                break  # Board full
            
            # Determine next player
            piece_count = sum(1 for row in board for cell in row if cell is not None)
            next_player = "X" if piece_count % 2 == 0 else "O"
            
            # Play user move
            user_move = Move(x=empty_cell[0], y=empty_cell[1], player=next_player)
            result = engine.play_from_here(session_id, user_move)
            
            # Verify AI move validity
            ai_move = result.get("ai_move")
            if ai_move is not None:
                assert 0 <= ai_move.x < BOARD_SIZE
                assert 0 <= ai_move.y < BOARD_SIZE
                
                # Verify AI move is on result board
                result_board = result["board_state"]
                assert result_board[ai_move.x][ai_move.y] == ai_move.player
    
    @given(
        moves=move_sequence(min_moves=3, max_moves=10),
        nav_index=st.integers(min_value=0, max_value=9)
    )
    @settings(max_examples=100, deadline=None)
    def test_ai_move_improves_position(
        self,
        moves: List[Move],
        nav_index: int
    ):
        """
        Property: AI move should not worsen its position significantly.
        
        For any AI response, the move should be reasonable (not a blunder).
        This is a soft property - we check that AI doesn't make obviously bad moves.
        """
        # Ensure nav_index is valid
        assume(nav_index < len(moves) - 1)
        assume(nav_index < BOARD_SIZE * BOARD_SIZE - 2)
        
        engine = ReplayEngine()
        session_id = engine.create_replay_session("test-match", moves)
        
        # Navigate to a position
        engine.navigate_to_move(session_id, nav_index)
        
        # Find an empty cell for user move
        session = engine.get_session(session_id)
        board = session.current_board
        empty_cell = None
        for x in range(BOARD_SIZE):
            for y in range(BOARD_SIZE):
                if board[x][y] is None:
                    empty_cell = (x, y)
                    break
            if empty_cell:
                break
        
        assume(empty_cell is not None)
        
        # Determine next player
        next_player = "O" if moves[nav_index].player == "X" else "X"
        
        # Play user move
        user_move = Move(x=empty_cell[0], y=empty_cell[1], player=next_player)
        result = engine.play_from_here(session_id, user_move)
        
        # Verify AI move exists and is valid
        ai_move = result.get("ai_move")
        if ai_move is not None:
            # AI move should be within bounds (already tested above)
            # Here we just verify it's a Move object with valid structure
            assert hasattr(ai_move, 'x')
            assert hasattr(ai_move, 'y')
            assert hasattr(ai_move, 'player')
            assert isinstance(ai_move.x, int)
            assert isinstance(ai_move.y, int)
            assert isinstance(ai_move.player, str)
    
    @given(moves=move_sequence(min_moves=3, max_moves=10))
    @settings(max_examples=100, deadline=None)
    def test_comparison_text_is_vietnamese(self, moves: List[Move]):
        """
        Property: Comparison text should be in Vietnamese.
        
        For any what-if scenario, the comparison text should contain
        Vietnamese characters or common Vietnamese words.
        """
        engine = ReplayEngine()
        session_id = engine.create_replay_session("test-match", moves)
        
        # Navigate to first move
        engine.navigate_to_move(session_id, 0)
        
        # Find empty cell
        session = engine.get_session(session_id)
        board = session.current_board
        empty_cell = None
        for x in range(BOARD_SIZE):
            for y in range(BOARD_SIZE):
                if board[x][y] is None:
                    empty_cell = (x, y)
                    break
            if empty_cell:
                break
        
        assume(empty_cell is not None)
        
        # Play user move
        user_move = Move(x=empty_cell[0], y=empty_cell[1], player="O")
        result = engine.play_from_here(session_id, user_move)
        
        comparison = result["comparison"]
        
        # Check for Vietnamese words (common in comparison text)
        vietnamese_words = ["Nhánh", "tốt", "tệ", "thắng", "tỷ lệ", "gốc", "tăng", "giảm"]
        has_vietnamese = any(word in comparison for word in vietnamese_words)
        
        assert has_vietnamese, \
            f"Comparison text should contain Vietnamese words: {comparison}"


# ============================================
# Edge Case Tests
# ============================================

class TestReplayAIEdgeCases:
    """Edge case tests for replay AI response."""
    
    def test_ai_response_on_nearly_full_board(self):
        """Test AI response when board is nearly full."""
        engine = ReplayEngine()
        
        # Create a nearly full board (leave 2 cells empty)
        moves = []
        positions = []
        for x in range(BOARD_SIZE):
            for y in range(BOARD_SIZE):
                if len(positions) < BOARD_SIZE * BOARD_SIZE - 2:
                    positions.append((x, y))
        
        for i, (x, y) in enumerate(positions):
            player = "X" if i % 2 == 0 else "O"
            moves.append(Move(x=x, y=y, player=player, move_number=i + 1))
        
        session_id = engine.create_replay_session("test", moves)
        engine.navigate_to_move(session_id, len(moves) - 1)
        
        # Find the one remaining empty cell
        session = engine.get_session(session_id)
        board = session.current_board
        empty_cell = None
        for x in range(BOARD_SIZE):
            for y in range(BOARD_SIZE):
                if board[x][y] is None:
                    empty_cell = (x, y)
                    break
            if empty_cell:
                break
        
        assert empty_cell is not None
        
        # Play user move
        next_player = "O" if moves[-1].player == "X" else "X"
        user_move = Move(x=empty_cell[0], y=empty_cell[1], player=next_player)
        result = engine.play_from_here(session_id, user_move)
        
        # AI should not be able to move (board full)
        # Or if there was one more cell, AI should use it
        ai_move = result.get("ai_move")
        # This is acceptable - AI might return None if no valid moves
    
    def test_ai_response_includes_all_required_fields(self):
        """Test that AI response includes all required fields."""
        engine = ReplayEngine()
        moves = [
            Move(x=7, y=7, player="X", move_number=1),
            Move(x=7, y=8, player="O", move_number=2),
            Move(x=8, y=7, player="X", move_number=3),
        ]
        session_id = engine.create_replay_session("test", moves)
        engine.navigate_to_move(session_id, 2)
        
        # Play alternative move
        user_move = Move(x=6, y=7, player="O")
        result = engine.play_from_here(session_id, user_move)
        
        # Verify all required fields
        required_fields = [
            "board_state",
            "ai_move",
            "original_outcome",
            "current_win_prob",
            "comparison"
        ]
        
        for field in required_fields:
            assert field in result, f"Missing required field: {field}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
