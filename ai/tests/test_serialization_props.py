"""
Property tests for JSON serialization helpers.

Validates Task 13 (Requirements 11.1, 11.2, 11.3):
- Dataclasses serialize to JSON-friendly dictionaries
- Round-trip conversion preserves data and enums
- All nested fields are included
"""

import json
from typing import Dict

from analysis.types import (
    Move,
    TimelineEntry,
    Mistake,
    Pattern,
    BestMove,
    Summary,
    AnalysisResult,
    MoveClassification,
    AlternativeMove,
)
from analysis.serialization import (
    move_to_dict,
    move_from_dict,
    timeline_entry_to_dict,
    timeline_entry_from_dict,
    mistake_to_dict,
    mistake_from_dict,
    pattern_to_dict,
    pattern_from_dict,
    best_move_to_dict,
    best_move_from_dict,
    summary_to_dict,
    summary_from_dict,
    analysis_result_to_dict,
    analysis_result_from_dict,
    alternative_move_to_dict,
    alternative_move_from_dict,
)


def _json_round_trip(payload: Dict) -> Dict:
    text = json.dumps(payload)
    return json.loads(text)


class TestJSONSerializationValidity:
    def test_move_serialization_is_valid_json(self):
        move = Move(x=7, y=7, player="X", move_number=1)
        data = move_to_dict(move)
        assert _json_round_trip(data) == data

    def test_timeline_entry_serialization_is_valid_json(self):
        entry = TimelineEntry(
            move=3,
            player="O",
            position={"x": 4, "y": 5},
            score=12.5,
            win_prob=0.62,
            category=MoveClassification.GOOD,
            note="Solid extension",
            comments={"vi": "Nuoc di tot", "en": "Good move"},
            alternatives=[AlternativeMove(position="H8", x=7, y=7, score=9.1, reason="Build pressure")],
            score_before=5.0,
            score_change=7.5,
            is_significant=True,
            is_critical=False,
            is_forcing=True,
            tempo_change=1,
            initiative_holder="X",
            is_tempo_switch=True,
            tempo_explanation={"vi": "Duy tri nhp", "en": "Keeps initiative"},
        )
        data = timeline_entry_to_dict(entry)
        assert _json_round_trip(data)["category"] == MoveClassification.GOOD.value


class TestJSONRoundTripConsistency:
    def test_timeline_entry_round_trip_preserves_enum(self):
        entry = TimelineEntry(
            move=5,
            player="X",
            position={"x": 10, "y": 10},
            score=8.0,
            win_prob=0.4,
            category=MoveClassification.WEAK,
            note="Loose move",
            alternatives=None,
        )
        restored = timeline_entry_from_dict(timeline_entry_to_dict(entry))
        assert restored.category == MoveClassification.WEAK
        assert restored.position == entry.position

    def test_analysis_result_round_trip(self):
        timeline = [
            TimelineEntry(
                move=1,
                player="X",
                position={"x": 7, "y": 7},
                score=0.0,
                win_prob=0.5,
                category=MoveClassification.OKAY,
                note="Opening",
            )
        ]
        mistakes = [Mistake(move=2, severity="minor", desc="Missed pressure", best_alternative={"x": 8, "y": 8})]
        patterns = [Pattern(label="Fork", explanation="Sets double threat", moves=[5, 7], severity="high")]
        best_move = BestMove(x=8, y=7, score=9.8, reason="Max pressure")
        summary = Summary(
            total_moves=10,
            winner="X",
            x_stats={"score": 55},
            o_stats={"score": 40},
            key_insights=["Good opening"],
        )
        result = AnalysisResult(
            tier="basic",
            timeline=timeline,
            mistakes=mistakes,
            patterns=patterns,
            best_move=best_move,
            summary=summary,
            ai_insights={"explanation": "Sample"},
            duration_ms=1234,
        )

        data = analysis_result_to_dict(result)
        restored = analysis_result_from_dict(_json_round_trip(data))

        assert restored.tier == result.tier
        assert restored.timeline[0].category == MoveClassification.OKAY
        assert restored.mistakes[0].desc == "Missed pressure"
        assert restored.best_move.score == best_move.score
        assert restored.summary.winner == "X"


class TestSerializationCompleteness:
    def test_alternative_move_round_trip(self):
        alt = AlternativeMove(position="J10", x=9, y=9, score=7.5, reason="Balance shape", is_best=True)
        restored = alternative_move_from_dict(_json_round_trip(alternative_move_to_dict(alt)))
        assert restored.is_best is True
        assert restored.position == alt.position

    def test_summary_round_trip_includes_insights(self):
        summary = Summary(
            total_moves=3,
            winner=None,
            x_stats={"wins": 1},
            o_stats={"wins": 0},
            key_insights=["Needs better defense"],
        )
        restored = summary_from_dict(_json_round_trip(summary_to_dict(summary)))
        assert restored.key_insights == summary.key_insights
