"""
Property-based tests for OpeningEvaluator.

Covers Properties 42-44 with lightweight checks.
"""

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck

from analysis.opening_evaluator import (
    OpeningEvaluator,
    OPENING_PHASE_END,
    CENTER,
    NEAR_CENTER_RADIUS,
    CORNERS,
    EDGE_ROWS,
    EDGE_COLS,
)
from analysis.types import BOARD_SIZE


opening_move_number = st.integers(min_value=1, max_value=OPENING_PHASE_END)


@given(
    row=st.integers(min_value=CENTER - NEAR_CENTER_RADIUS, max_value=CENTER + NEAR_CENTER_RADIUS),
    col=st.integers(min_value=CENTER - NEAR_CENTER_RADIUS, max_value=CENTER + NEAR_CENTER_RADIUS),
    move_num=opening_move_number,
)
@settings(max_examples=50, suppress_health_check=[HealthCheck.filter_too_much])
def test_property_42_opening_move_near_center(row, col, move_num):
    evaluator = OpeningEvaluator()
    result = evaluator.evaluate_opening_move(row, col, move_num)
    assert result.is_near_center
    assert result.score_modifier >= 0


@given(move_num=opening_move_number)
@settings(max_examples=25)
def test_property_42_center_move_excellent(move_num):
    evaluator = OpeningEvaluator()
    result = evaluator.evaluate_opening_move(CENTER, CENTER, move_num)
    assert result.is_near_center
    assert result.score_modifier >= 0


@given(corner=st.sampled_from(CORNERS), move_num=opening_move_number)
@settings(max_examples=25)
def test_property_43_opening_move_at_corner(corner, move_num):
    evaluator = OpeningEvaluator()
    x, y = corner
    result = evaluator.evaluate_opening_move(x, y, move_num)
    assert not result.is_near_center
    assert result.score_modifier <= 0


@given(
    row=st.sampled_from(EDGE_ROWS),
    col=st.sampled_from(EDGE_COLS),
    move_num=opening_move_number,
)
@settings(max_examples=25)
def test_property_44_opening_move_at_edge(row, col, move_num):
    evaluator = OpeningEvaluator()
    result = evaluator.evaluate_opening_move(row, col, move_num)
    assert result.is_edge or result.is_corner
    assert result.score_modifier <= 0
