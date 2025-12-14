"""
Property-Based Tests for RoleEvaluator
Feature: gomoku-basic-analysis, Properties 7-9: Role Evaluation
Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hypothesis import given, strategies as st, settings, assume, HealthCheck
import pytest

from analysis.role_evaluator import (
    RoleEvaluator,
    PlayerRole,
    ATTACKER_THRESHOLD,
    DEFENDER_THRESHOLD,
)
from analysis.types import BOARD_SIZE


@st.composite
def board_with_pieces(draw, min_pieces=2, max_pieces=15):
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    num_pieces = draw(st.integers(min_value=min_pieces, max_value=max_pieces))
    positions = draw(st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=BOARD_SIZE - 1),
            st.integers(min_value=0, max_value=BOARD_SIZE - 1)
        ),
        min_size=num_pieces, max_size=num_pieces, unique=True
    ))
    for i, (x, y) in enumerate(positions):
        board[x][y] = "X" if i % 2 == 0 else "O"
    return board


@given(board=board_with_pieces())
@settings(max_examples=20, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
def test_property_7_role_is_valid_enum(board):
    evaluator = RoleEvaluator()
    for player in ["X", "O"]:
        role_eval = evaluator.determine_role(board, player)
        assert isinstance(role_eval.role, PlayerRole)


@given(board=board_with_pieces())
@settings(max_examples=20, deadline=5000, suppress_health_check=[HealthCheck.too_slow])
def test_property_7_confidence_in_range(board):
    evaluator = RoleEvaluator()
    for player in ["X", "O"]:
        role_eval = evaluator.determine_role(board, player)
        assert 0 <= role_eval.confidence <= 1


def test_property_7_empty_board_is_neutral():
    evaluator = RoleEvaluator()
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    for player in ["X", "O"]:
        role_eval = evaluator.determine_role(board, player)
        assert role_eval.role == PlayerRole.NEUTRAL


def test_property_7_attacker_with_open_four():
    evaluator = RoleEvaluator()
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    for i in range(4):
        board[7][3 + i] = "X"
    role_eval = evaluator.determine_role(board, "X")
    assert role_eval.role == PlayerRole.ATTACKER


def test_property_7_defender_against_open_four():
    evaluator = RoleEvaluator()
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    for i in range(4):
        board[7][3 + i] = "O"
    role_eval = evaluator.determine_role(board, "X")
    assert role_eval.role == PlayerRole.DEFENDER


def test_property_8_threat_creation_scores_high():
    evaluator = RoleEvaluator()
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    board[7][5] = "X"
    board[7][6] = "X"
    threat_move = (7, 7)
    passive_move = (0, 0)
    threat_score = evaluator.score_move_by_role(board, threat_move, "X", PlayerRole.ATTACKER)
    passive_score = evaluator.score_move_by_role(board, passive_move, "X", PlayerRole.ATTACKER)
    assert threat_score.total_score > passive_score.total_score


def test_property_9_blocking_scores_high():
    evaluator = RoleEvaluator()
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    for i in range(3):
        board[7][3 + i] = "O"
    block_move = (7, 6)
    passive_move = (0, 0)
    block_score = evaluator.score_move_by_role(board, block_move, "X", PlayerRole.DEFENDER)
    passive_score = evaluator.score_move_by_role(board, passive_move, "X", PlayerRole.DEFENDER)
    assert block_score.block_score > passive_score.block_score


def test_center_higher_position_score():
    evaluator = RoleEvaluator()
    board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    center = (BOARD_SIZE // 2, BOARD_SIZE // 2)
    corner = (0, 0)
    cs = evaluator.score_move_by_role(board, center, "X")
    cos = evaluator.score_move_by_role(board, corner, "X")
    assert cs.position_score > cos.position_score


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
