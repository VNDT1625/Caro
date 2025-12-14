"""Tests for WhatIfSimulator (Requirement 23)."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.what_if_simulator import WhatIfSimulator


def test_simulate_move_returns_fields():
    sim = WhatIfSimulator()
    board = [[None for _ in range(15)] for _ in range(15)]
    result = sim.simulate_move(board, 7, 7, "X").to_dict()
    assert "initial_score" in result
    assert "final_score" in result
    assert "evaluation_change" in result
    assert "opponent_response" in result
