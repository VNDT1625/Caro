"""
Metrics logger for analysis performance and errors.
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass
import time


@dataclass
class AnalysisMetric:
    timestamp: float
    duration_ms: int
    move_count: int
    tier: str
    success: bool
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "duration_ms": self.duration_ms,
            "move_count": self.move_count,
            "tier": self.tier,
            "success": self.success,
            "error": self.error,
        }


class AnalysisMetricsLogger:
    """In-memory metrics logger."""

    def __init__(self):
        self.records: List[AnalysisMetric] = []

    def log_analysis_complete(self, duration_ms: int, move_count: int, tier: str = "basic"):
        self.records.append(
            AnalysisMetric(
                timestamp=time.time(),
                duration_ms=duration_ms,
                move_count=move_count,
                tier=tier,
                success=True,
            )
        )

    def log_analysis_error(self, error: str, move_count: int = 0, tier: str = "basic"):
        self.records.append(
            AnalysisMetric(
                timestamp=time.time(),
                duration_ms=0,
                move_count=move_count,
                tier=tier,
                success=False,
                error=error,
            )
        )

    def latest(self) -> Optional[AnalysisMetric]:
        return self.records[-1] if self.records else None
