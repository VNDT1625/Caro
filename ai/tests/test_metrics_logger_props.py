"""Tests for AnalysisMetricsLogger."""

from analysis.metrics_logger import AnalysisMetricsLogger


def test_log_complete_and_error():
    logger = AnalysisMetricsLogger()
    logger.log_analysis_complete(duration_ms=120, move_count=10, tier="basic")
    logger.log_analysis_error(error="timeout", move_count=5, tier="basic")

    assert len(logger.records) == 2
    latest = logger.latest()
    assert latest is not None
    assert latest.success is False
    assert latest.error == "timeout"
