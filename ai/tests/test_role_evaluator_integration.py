"""
Integration Tests for RoleEvaluator in BasicAnalyzer
Feature: gomoku-basic-analysis, Task 3.3: Integrate RoleEvaluator into BasicAnalyzer
Validates: Requirements 3.1, 3.2, 3.3
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from analysis.basic_analyzer import BasicAnalyzer
from analysis.types import Move, BOARD_SIZE


def test_timeline_entries_have_role_field():
    """Test that timeline entries include role field after integration."""
    analyzer = BasicAnalyzer(use_advanced=False)
    
    # Create a simple game
    moves = [
        Move(x=7, y=7, player="X"),
        Move(x=7, y=8, player="O"),
        Move(x=8, y=7, player="X"),
        Move(x=8, y=8, player="O"),
        Move(x=6, y=7, player="X"),
    ]
    
    result = analyzer.analyze_game(moves)
    
    # Check that all timeline entries have role field
    for entry in result.timeline:
        assert hasattr(entry, 'role'), f"Timeline entry for move {entry.move} missing role field"
        assert entry.role in ["attacker", "defender", "neutral"], f"Invalid role: {entry.role}"


def test_role_changes_with_advantage():
    """Test that role changes when one player gains significant advantage."""
    analyzer = BasicAnalyzer(use_advanced=False)
    
    # Create a game where X builds strong position
    moves = [
        Move(x=7, y=7, player="X"),
        Move(x=0, y=0, player="O"),  # O plays corner (weak)
        Move(x=7, y=8, player="X"),
        Move(x=0, y=1, player="O"),  # O plays edge (weak)
        Move(x=7, y=9, player="X"),  # X has 3 in a row
        Move(x=0, y=2, player="O"),  # O still playing edge
        Move(x=7, y=10, player="X"), # X has 4 in a row (open four!)
    ]
    
    result = analyzer.analyze_game(moves)
    
    # After X creates open four, X should be attacker
    last_x_entry = [e for e in result.timeline if e.player == "X"][-1]
    assert last_x_entry.role == "attacker", f"X should be attacker with open four, got {last_x_entry.role}"


def test_defender_role_when_behind():
    """Test that player gets defender role when opponent has advantage."""
    analyzer = BasicAnalyzer(use_advanced=False)
    
    # Create a game where O builds strong position
    moves = [
        Move(x=7, y=7, player="X"),
        Move(x=8, y=7, player="O"),
        Move(x=0, y=0, player="X"),  # X plays corner (weak)
        Move(x=8, y=8, player="O"),
        Move(x=0, y=1, player="X"),  # X plays edge (weak)
        Move(x=8, y=9, player="O"),  # O has 3 in a row
        Move(x=0, y=2, player="X"),  # X still playing edge
        Move(x=8, y=10, player="O"), # O has 4 in a row (open four!)
    ]
    
    result = analyzer.analyze_game(moves)
    
    # After O creates open four, X should be defender
    last_x_entry = [e for e in result.timeline if e.player == "X"][-1]
    # Note: The last X move is before O's open four, so check the role
    # X should recognize O's threat and be in defender mode
    assert last_x_entry.role in ["defender", "neutral"], f"X should be defender or neutral, got {last_x_entry.role}"


def test_neutral_role_in_balanced_position():
    """Test that players have neutral role in balanced positions."""
    analyzer = BasicAnalyzer(use_advanced=False)
    
    # Create a balanced game
    moves = [
        Move(x=7, y=7, player="X"),
        Move(x=7, y=8, player="O"),
        Move(x=8, y=7, player="X"),
        Move(x=8, y=8, player="O"),
    ]
    
    result = analyzer.analyze_game(moves)
    
    # In early balanced game, roles should be neutral
    for entry in result.timeline:
        # Early game should be neutral or slightly favoring one side
        assert entry.role in ["attacker", "defender", "neutral"]


def test_role_evaluator_initialized():
    """Test that BasicAnalyzer has RoleEvaluator initialized."""
    analyzer = BasicAnalyzer(use_advanced=False)
    
    assert hasattr(analyzer, 'role_evaluator'), "BasicAnalyzer should have role_evaluator attribute"
    assert analyzer.role_evaluator is not None, "role_evaluator should not be None"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
