"""Tests for PlayerProfileBuilder."""

from analysis.player_profile import PlayerProfileBuilder
from analysis.types import TimelineEntry, MoveClassification


def _entry(role: str, category: MoveClassification) -> TimelineEntry:
    return TimelineEntry(
        move=1,
        player="X",
        position={"x": 7, "y": 7},
        score=0.0,
        win_prob=0.5,
        category=category,
        note="",
        role=role,
    )


def test_profile_builds_ratio_and_flags():
    builder = PlayerProfileBuilder()
    timeline = [
        _entry("attacker", MoveClassification.EXCELLENT),
        _entry("defender", MoveClassification.BLUNDER),
        _entry("attacker", MoveClassification.GOOD),
    ]
    profile = builder.build_profile([timeline]).to_dict()
    assert profile["offense_defense_ratio"] > 0
    assert "improvements" in profile
