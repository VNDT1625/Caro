"""
Utilities for serializing/deserializing analysis dataclasses to JSON-friendly
dictionaries. Covers the core types used by the basic analyzer.
"""

from dataclasses import asdict
from typing import Any, Dict, List, Optional

from .types import (
    AlternativeMove,
    AnalysisResult,
    BestMove,
    Move,
    MoveClassification,
    Pattern,
    Summary,
    TimelineEntry,
    Mistake,
)


def _classification_to_value(category: MoveClassification | str) -> str:
    """Return enum value for move classification."""
    if isinstance(category, MoveClassification):
        return category.value
    return str(category)


def _classification_from_value(value: str | MoveClassification) -> MoveClassification:
    """Parse classification value back to enum; fallback to OKAY."""
    if isinstance(value, MoveClassification):
        return value
    try:
        return MoveClassification(value)
    except Exception:
        return MoveClassification.OKAY


def move_to_dict(move: Move) -> Dict[str, Any]:
    return {
        "x": move.x,
        "y": move.y,
        "player": move.player,
        "move_number": move.move_number,
    }


def move_from_dict(data: Dict[str, Any]) -> Move:
    return Move(
        x=int(data.get("x", 0)),
        y=int(data.get("y", 0)),
        player=data.get("player", "X"),
        move_number=data.get("move_number"),
    )


def alternative_move_to_dict(alt: AlternativeMove) -> Dict[str, Any]:
    return {
        "position": alt.position,
        "x": alt.x,
        "y": alt.y,
        "score": alt.score,
        "reason": alt.reason,
        "is_best": alt.is_best,
        "similar_to_others": alt.similar_to_others,
    }


def alternative_move_from_dict(data: Dict[str, Any]) -> AlternativeMove:
    return AlternativeMove(
        position=data.get("position", ""),
        x=int(data.get("x", 0)),
        y=int(data.get("y", 0)),
        score=float(data.get("score", 0.0)),
        reason=data.get("reason", ""),
        is_best=bool(data.get("is_best", False)),
        similar_to_others=bool(data.get("similar_to_others", False)),
    )


def timeline_entry_to_dict(entry: TimelineEntry) -> Dict[str, Any]:
    return {
        "move": entry.move,
        "player": entry.player,
        "position": entry.position,
        "score": entry.score,
        "win_prob": entry.win_prob,
        "category": _classification_to_value(entry.category),
        "note": entry.note,
        "role": entry.role,
        "comments": entry.comments,
        "alternatives": [alternative_move_to_dict(a) for a in entry.alternatives] if entry.alternatives else None,
        "score_before": entry.score_before,
        "score_change": entry.score_change,
        "is_significant": entry.is_significant,
        "is_critical": entry.is_critical,
        "is_forcing": entry.is_forcing,
        "tempo_change": entry.tempo_change,
        "initiative_holder": entry.initiative_holder,
        "is_tempo_switch": entry.is_tempo_switch,
        "tempo_explanation": entry.tempo_explanation,
    }


def timeline_entry_from_dict(data: Dict[str, Any]) -> TimelineEntry:
    alternatives_raw = data.get("alternatives") or []
    alternatives = [alternative_move_from_dict(a) for a in alternatives_raw] if alternatives_raw else None
    return TimelineEntry(
        move=int(data.get("move", 0)),
        player=data.get("player", "X"),
        position=data.get("position", {"x": 0, "y": 0}),
        score=float(data.get("score", 0.0)),
        win_prob=float(data.get("win_prob", 0.0)),
        category=_classification_from_value(data.get("category", MoveClassification.OKAY)),
        note=data.get("note", ""),
        role=data.get("role", "neutral"),
        comments=data.get("comments"),
        alternatives=alternatives,
        score_before=data.get("score_before"),
        score_change=data.get("score_change"),
        is_significant=bool(data.get("is_significant", False)),
        is_critical=bool(data.get("is_critical", False)),
        is_forcing=bool(data.get("is_forcing", False)),
        tempo_change=int(data.get("tempo_change", 0)),
        initiative_holder=data.get("initiative_holder", "neutral"),
        is_tempo_switch=bool(data.get("is_tempo_switch", False)),
        tempo_explanation=data.get("tempo_explanation"),
    )


def mistake_to_dict(mistake: Mistake) -> Dict[str, Any]:
    return asdict(mistake)


def mistake_from_dict(data: Dict[str, Any]) -> Mistake:
    return Mistake(
        move=int(data.get("move", 0)),
        severity=data.get("severity", "minor"),
        desc=data.get("desc", ""),
        best_alternative=data.get("best_alternative", {}),
    )


def pattern_to_dict(pattern: Pattern) -> Dict[str, Any]:
    return asdict(pattern)


def pattern_from_dict(data: Dict[str, Any]) -> Pattern:
    return Pattern(
        label=data.get("label", ""),
        explanation=data.get("explanation", ""),
        moves=list(data.get("moves", [])),
        severity=data.get("severity", "info"),
    )


def best_move_to_dict(best_move: BestMove) -> Dict[str, Any]:
    return asdict(best_move)


def best_move_from_dict(data: Dict[str, Any]) -> BestMove:
    return BestMove(
        x=int(data.get("x", 0)),
        y=int(data.get("y", 0)),
        score=float(data.get("score", 0.0)),
        reason=data.get("reason", ""),
    )


def summary_to_dict(summary: Summary) -> Dict[str, Any]:
    return asdict(summary)


def summary_from_dict(data: Dict[str, Any]) -> Summary:
    return Summary(
        total_moves=int(data.get("total_moves", 0)),
        winner=data.get("winner"),
        x_stats=data.get("x_stats", {}),
        o_stats=data.get("o_stats", {}),
        key_insights=list(data.get("key_insights", [])),
    )


def analysis_result_to_dict(result: AnalysisResult) -> Dict[str, Any]:
    return {
        "tier": result.tier,
        "timeline": [timeline_entry_to_dict(t) for t in result.timeline],
        "mistakes": [mistake_to_dict(m) for m in result.mistakes],
        "patterns": [pattern_to_dict(p) for p in result.patterns],
        "best_move": best_move_to_dict(result.best_move) if result.best_move else None,
        "summary": summary_to_dict(result.summary),
        "ai_insights": result.ai_insights,
        "duration_ms": result.duration_ms,
    }


def analysis_result_from_dict(data: Dict[str, Any]) -> AnalysisResult:
    return AnalysisResult(
        tier=data.get("tier", "basic"),
        timeline=[timeline_entry_from_dict(t) for t in data.get("timeline", [])],
        mistakes=[mistake_from_dict(m) for m in data.get("mistakes", [])],
        patterns=[pattern_from_dict(p) for p in data.get("patterns", [])],
        best_move=best_move_from_dict(data["best_move"]) if data.get("best_move") else None,
        summary=summary_from_dict(data.get("summary", {})),
        ai_insights=data.get("ai_insights"),
        duration_ms=data.get("duration_ms"),
    )
