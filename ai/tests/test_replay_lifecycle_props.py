"""
Property-Based Tests for Replay Engine Session Lifecycle

Tests Property 6: Replay Session Lifecycle
Validates Requirements: 5.1, 5.2, 5.3, 5.6

**Feature: ai-match-analysis-system, Property 6: Replay Session Lifecycle**

For any replay session, the ReplayEngine SHALL:
- Initialize with original moves and empty board state
- Navigate to any move index and produce correct board state
- Mark divergence point when user plays alternative move
- Clean up session resources when exited
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple

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

class TestReplaySessionLifecycle:
    """
    Property-based tests for replay session lifecycle.
    
    **Feature: ai-match-analysis-system, Property 6: Replay Session Lifecycle**
    """
    
    @given(moves=move_sequence(min_moves=1, max_moves=20))
    @settings(max_examples=100, deadline=None)
    def test_session_initialization(self, moves: List[Move]):
        """
        Property: Session initialization creates empty board and stores moves.
        
        For any valid move sequence, creating a replay session SHALL:
        - Return a valid session_id
        - Initialize with empty board state
        - Store original moves correctly
        - Set current_move_index to -1
        - Set mode to "replay"
        
        Validates: Requirement 5.1
        """
        engine = ReplayEngine()
        match_id = "test-match-123"
        
        # Create session
        session_id = engine.create_replay_session(match_id, moves)
        
        # Verify session_id is valid
        assert session_id is not None
        assert isinstance(session_id, str)
        assert len(session_id) > 0
        
        # Get session
        session = engine.get_session(session_id)
        assert session is not None
        
        # Verify initialization
        assert session.match_id == match_id
        assert session.current_move_index == -1
        assert session.mode == "replay"
        assert session.divergence_point is None
        
        # Verify empty board
        for row in session.current_board:
            for cell in row:
                assert cell is None, "Board should be empty on initialization"
        
        # Verify original moves stored
        assert len(session.original_moves) == len(moves)
        for i, move in enumerate(moves):
            assert session.original_moves[i].x == move.x
            assert session.original_moves[i].y == move.y
            assert session.original_moves[i].player == move.player
    
    @given(
        moves=move_sequence(min_moves=5, max_moves=20),
        target_index=st.integers(min_value=-1, max_value=19)
    )
    @settings(max_examples=100, deadline=None)
    def test_navigate_to_move_produces_correct_board(
        self,
        moves: List[Move],
        target_index: int
    ):
        """
        Property: Navigate to move produces correct board state.
        
        For any move sequence and valid target index, navigating SHALL:
        - Produce board state with exactly (target_index + 1) pieces
        - Place pieces at correct positions
        - Complete within 200ms (checked in implementation)
        
        Validates: Requirement 5.2
        """
        # Ensure target_index is valid for this move sequence
        assume(target_index < len(moves))
        
        engine = ReplayEngine()
        session_id = engine.create_replay_session("test-match", moves)
        
        # Navigate to target move
        result = engine.navigate_to_move(session_id, target_index)
        
        # Verify result structure
        assert "board_state" in result
        assert "current_move" in result
        assert "player_turn" in result
        
        board = result["board_state"]
        
        # Count pieces on board
        piece_count = sum(1 for row in board for cell in row if cell is not None)
        expected_count = target_index + 1
        assert piece_count == expected_count, \
            f"Expected {expected_count} pieces, found {piece_count}"
        
        # Verify each move is on the board
        for i in range(target_index + 1):
            move = moves[i]
            assert board[move.x][move.y] == move.player, \
                f"Move {i} at ({move.x}, {move.y}) should be {move.player}"
        
        # Verify current_move matches
        assert result["current_move"] == target_index
        
        # Verify player_turn is correct
        if target_index == -1:
            assert result["player_turn"] == "X"
        elif target_index >= len(moves) - 1:
            # Game ended or at last move
            pass  # player_turn can be None or next player
        else:
            last_player = moves[target_index].player
            expected_turn = "O" if last_player == "X" else "X"
            assert result["player_turn"] == expected_turn
    
    @given(
        moves=move_sequence(min_moves=3, max_moves=15),
        nav_index=st.integers(min_value=0, max_value=14)
    )
    @settings(max_examples=100, deadline=None)
    def test_play_from_here_marks_divergence(
        self,
        moves: List[Move],
        nav_index: int
    ):
        """
        Property: Playing alternative move marks divergence point.
        
        For any replay session in replay mode, playing an alternative move SHALL:
        - Switch mode to "what_if"
        - Set divergence_point to current_move_index + 1
        - Apply the user move to the board
        
        Validates: Requirement 5.3
        """
        # Ensure nav_index is valid
        assume(nav_index < len(moves))
        
        engine = ReplayEngine()
        session_id = engine.create_replay_session("test-match", moves)
        
        # Navigate to a position
        engine.navigate_to_move(session_id, nav_index)
        
        # Get session before playing
        session = engine.get_session(session_id)
        assert session.mode == "replay"
        assert session.divergence_point is None
        
        # Find an empty cell for alternative move
        board = session.current_board
        empty_cell = None
        for x in range(BOARD_SIZE):
            for y in range(BOARD_SIZE):
                if board[x][y] is None:
                    empty_cell = (x, y)
                    break
            if empty_cell:
                break
        
        assume(empty_cell is not None)  # Need at least one empty cell
        
        # Determine next player
        next_player = "O" if moves[nav_index].player == "X" else "X"
        
        # Play alternative move
        alt_move = Move(x=empty_cell[0], y=empty_cell[1], player=next_player)
        result = engine.play_from_here(session_id, alt_move)
        
        # Verify divergence marked
        session = engine.get_session(session_id)
        assert session.mode == "what_if"
        assert session.divergence_point == nav_index + 1
        
        # Verify move applied
        assert session.current_board[alt_move.x][alt_move.y] == alt_move.player
    
    @given(moves=move_sequence(min_moves=1, max_moves=10))
    @settings(max_examples=100, deadline=None)
    def test_cleanup_removes_session(self, moves: List[Move]):
        """
        Property: Cleanup removes session and frees resources.
        
        For any replay session, calling cleanup SHALL:
        - Remove the session from storage
        - Make the session inaccessible via get_session
        
        Validates: Requirement 5.6
        """
        engine = ReplayEngine()
        session_id = engine.create_replay_session("test-match", moves)
        
        # Verify session exists
        session = engine.get_session(session_id)
        assert session is not None
        
        # Cleanup session
        engine.cleanup_session(session_id)
        
        # Verify session removed
        session = engine.get_session(session_id)
        assert session is None
    
    @given(
        moves=move_sequence(min_moves=5, max_moves=15),
        indices=st.lists(
            st.integers(min_value=-1, max_value=14),
            min_size=2,
            max_size=5
        )
    )
    @settings(max_examples=100, deadline=None)
    def test_multiple_navigations_maintain_consistency(
        self,
        moves: List[Move],
        indices: List[int]
    ):
        """
        Property: Multiple navigations maintain board state consistency.
        
        For any sequence of navigation operations, the board state SHALL
        always be consistent with the target move index.
        """
        # Filter valid indices
        valid_indices = [idx for idx in indices if idx < len(moves)]
        assume(len(valid_indices) >= 2)
        
        engine = ReplayEngine()
        session_id = engine.create_replay_session("test-match", moves)
        
        # Navigate multiple times
        for target_idx in valid_indices:
            result = engine.navigate_to_move(session_id, target_idx)
            board = result["board_state"]
            
            # Verify board state matches target
            piece_count = sum(1 for row in board for cell in row if cell is not None)
            expected_count = target_idx + 1
            assert piece_count == expected_count
            
            # Verify specific moves
            for i in range(target_idx + 1):
                move = moves[i]
                assert board[move.x][move.y] == move.player
    
    @given(moves=move_sequence(min_moves=1, max_moves=20))
    @settings(max_examples=100, deadline=None)
    def test_navigate_to_negative_one_gives_empty_board(self, moves: List[Move]):
        """
        Property: Navigating to -1 gives empty board.
        
        For any move sequence, navigating to index -1 SHALL:
        - Return empty board (no pieces)
        - Set player_turn to "X" (first player)
        """
        engine = ReplayEngine()
        session_id = engine.create_replay_session("test-match", moves)
        
        result = engine.navigate_to_move(session_id, -1)
        board = result["board_state"]
        
        # Verify empty board
        piece_count = sum(1 for row in board for cell in row if cell is not None)
        assert piece_count == 0
        
        # Verify first player's turn
        assert result["player_turn"] == "X"
        assert result["current_move"] == -1


# ============================================
# Edge Case Tests
# ============================================

class TestReplayEdgeCases:
    """Edge case tests for replay engine."""
    
    def test_invalid_session_id_raises_error(self):
        """Test that invalid session_id raises ValueError."""
        engine = ReplayEngine()
        
        with pytest.raises(ValueError, match="Session .* not found"):
            engine.navigate_to_move("invalid-session-id", 0)
    
    def test_invalid_move_index_raises_error(self):
        """Test that invalid move_index raises ValueError."""
        engine = ReplayEngine()
        moves = [Move(x=7, y=7, player="X", move_number=1)]
        session_id = engine.create_replay_session("test", moves)
        
        # Too large
        with pytest.raises(ValueError, match="Invalid move_index"):
            engine.navigate_to_move(session_id, 10)
        
        # Too small
        with pytest.raises(ValueError, match="Invalid move_index"):
            engine.navigate_to_move(session_id, -2)
    
    def test_invalid_move_position_raises_error(self):
        """Test that invalid move position raises ValueError."""
        engine = ReplayEngine()
        moves = [Move(x=7, y=7, player="X", move_number=1)]
        session_id = engine.create_replay_session("test", moves)
        engine.navigate_to_move(session_id, 0)
        
        # Try to play on occupied cell
        invalid_move = Move(x=7, y=7, player="O")
        with pytest.raises(ValueError, match="Invalid move"):
            engine.play_from_here(session_id, invalid_move)
    
    def test_cleanup_nonexistent_session_is_safe(self):
        """Test that cleaning up non-existent session doesn't raise error."""
        engine = ReplayEngine()
        
        # Should not raise error
        engine.cleanup_session("nonexistent-session")
    
    def test_empty_move_sequence(self):
        """Test replay with empty move sequence."""
        engine = ReplayEngine()
        moves = []
        session_id = engine.create_replay_session("test", moves)
        
        # Should be able to navigate to -1
        result = engine.navigate_to_move(session_id, -1)
        assert result["current_move"] == -1
        assert result["player_turn"] == "X"
        
        # Board should be empty
        board = result["board_state"]
        piece_count = sum(1 for row in board for cell in row if cell is not None)
        assert piece_count == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
