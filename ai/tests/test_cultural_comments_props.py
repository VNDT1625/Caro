"""Property tests for cultural comment generation (Requirement 22)."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.comment_generator import CommentGenerator
from analysis.types import MoveClassification, ThreatType


def test_cultural_idiom_available_vi():
    gen = CommentGenerator()
    idiom = gen.get_cultural_idiom("fork", "vi")
    assert isinstance(idiom, str)
    assert idiom != ""


def test_generate_all_languages_appends_idiom():
    gen = CommentGenerator()
    comment = gen.generate_all_languages(
        classification=MoveClassification.GOOD,
        threats_created=[ThreatType.OPEN_THREE],
        threats_blocked=[],
        is_winning=False,
        scenario="fork",
        use_cultural=True,
    )
    vi_text = comment.vi.lower()
    assert "nước đôi" in vi_text or "fork" in vi_text
