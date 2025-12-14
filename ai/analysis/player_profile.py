"""
Player profile builder for summarizing strengths/weaknesses.
"""

from typing import Dict, List, Optional
from dataclasses import dataclass

from .types import MoveClassification, TimelineEntry


@dataclass
class PlayerProfile:
    offense_defense_ratio: float
    favorite_patterns: List[str]
    common_mistakes: List[str]
    strengths: List[str]
    weaknesses: List[str]
    improvements: List[str]

    def to_dict(self) -> Dict:
        return {
            "offense_defense_ratio": self.offense_defense_ratio,
            "favorite_patterns": self.favorite_patterns,
            "common_mistakes": self.common_mistakes,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "improvements": self.improvements,
        }


class PlayerProfileBuilder:
    """Builds a simple statistical profile from timelines."""

    def build_profile(self, timelines: List[List[TimelineEntry]]) -> PlayerProfile:
        offense_moves = 0
        defense_moves = 0
        blunders = 0
        excellent = 0

        for game in timelines:
            for entry in game:
                if entry.category == MoveClassification.EXCELLENT:
                    excellent += 1
                if entry.category == MoveClassification.BLUNDER:
                    blunders += 1
                if entry.role == "attacker":
                    offense_moves += 1
                elif entry.role == "defender":
                    defense_moves += 1

        ratio = offense_moves / defense_moves if defense_moves else float(offense_moves or 0)
        strengths = []
        weaknesses = []
        improvements = []

        if excellent > blunders:
            strengths.append("Ổn định nước đi tốt")
        else:
            weaknesses.append("Thiếu ổn định nước mạnh")

        if blunders > 0:
            improvements.append("Giảm sai lầm nghiêm trọng")

        return PlayerProfile(
            offense_defense_ratio=ratio,
            favorite_patterns=[],
            common_mistakes=["blunder"] if blunders else [],
            strengths=strengths or ["Cần thêm dữ liệu"],
            weaknesses=weaknesses,
            improvements=improvements,
        )
