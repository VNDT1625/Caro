"""
AI Match Analysis System - Opening Book

This module provides a comprehensive opening book for Caro/Gomoku analysis,
including standard Renju openings and common Gomoku openings.

Task 8.4.1: Opening Database
- Create opening_book.py
- Add 26 standard Renju openings with evaluations
- Add common Gomoku openings (direct, indirect)
- Store: moves, name, evaluation, common mistakes

Impact: Recognize and comment about openings
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum


class OpeningType(Enum):
    """Types of openings in Gomoku/Renju."""
    RENJU_DIRECT = "renju_direct"      # Direct openings (2nd move adjacent to center)
    RENJU_INDIRECT = "renju_indirect"  # Indirect openings (2nd move diagonal)
    GOMOKU_DIRECT = "gomoku_direct"    # Gomoku direct openings
    GOMOKU_INDIRECT = "gomoku_indirect"  # Gomoku indirect openings


class OpeningEvaluation(Enum):
    """Evaluation of opening strength."""
    WINNING = "winning"        # Black has winning advantage
    ADVANTAGE = "advantage"    # Slight advantage for one side
    BALANCED = "balanced"      # Equal position
    DISADVANTAGE = "disadvantage"  # Slight disadvantage
    LOSING = "losing"          # Losing position


@dataclass
class OpeningMove:
    """Represents a move in an opening sequence."""
    x: int
    y: int
    player: str  # "X" (Black) or "O" (White)
    
    def to_tuple(self) -> Tuple[int, int]:
        return (self.x, self.y)


@dataclass
class CommonMistake:
    """A common mistake in an opening."""
    move_number: int
    wrong_move: Tuple[int, int]
    correct_move: Tuple[int, int]
    explanation: str  # Vietnamese explanation
    severity: str  # "minor", "major", "critical"


@dataclass
class Opening:
    """
    Represents a complete opening with all metadata.
    
    Attributes:
        name: Opening name (Vietnamese)
        name_en: Opening name (English)
        name_jp: Opening name (Japanese/Renju terminology)
        type: Type of opening
        moves: Sequence of moves defining the opening
        evaluation: Overall evaluation of the opening
        evaluation_score: Numerical evaluation (-100 to +100, positive = Black advantage)
        description: Vietnamese description of the opening
        key_ideas: Key strategic ideas for this opening
        common_mistakes: List of common mistakes in this opening
        variations: Named variations of this opening
        recommended_for: Skill level recommendation ("beginner", "intermediate", "advanced")
    """
    name: str
    name_en: str
    name_jp: str
    type: OpeningType
    moves: List[OpeningMove]
    evaluation: OpeningEvaluation
    evaluation_score: int  # -100 to +100
    description: str
    key_ideas: List[str] = field(default_factory=list)
    common_mistakes: List[CommonMistake] = field(default_factory=list)
    variations: Dict[str, List[OpeningMove]] = field(default_factory=dict)
    recommended_for: str = "intermediate"


# Board center position (0-indexed, 15x15 board)
CENTER = (7, 7)


class OpeningBook:
    """
    Opening book database for Gomoku/Renju.
    
    Contains 26 standard Renju openings and common Gomoku openings.
    Provides methods to identify openings and get analysis.
    """
    
    def __init__(self):
        """Initialize the opening book with all openings."""
        self.openings: Dict[str, Opening] = {}
        self._load_renju_openings()
        self._load_gomoku_openings()
    
    def _load_renju_openings(self):
        """Load the 26 standard Renju openings."""
        # In Renju, Black plays first at center (7,7)
        # White responds, then Black plays 3rd move
        # The 26 openings are named after the 3rd move position
        
        # ============================================
        # DIRECT OPENINGS (2nd move adjacent to center)
        # ============================================

        # Direct Opening 1: Kansei (寒星) - Cold Star
        self.openings["kansei"] = Opening(
            name="Hàn Tinh",
            name_en="Cold Star",
            name_jp="Kansei (寒星)",
            type=OpeningType.RENJU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),   # 1. Center
                OpeningMove(8, 7, "O"),   # 2. Right of center
                OpeningMove(6, 6, "X"),   # 3. Upper-left diagonal
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=5,
            description="Khai cuộc Hàn Tinh - một trong những khai cuộc cân bằng nhất trong Renju. Đen có nhiều hướng phát triển.",
            key_ideas=[
                "Đen nên phát triển theo đường chéo",
                "Trắng cần chặn sớm để ngăn Đen tạo thế",
                "Vị trí 3 tạo áp lực lên cả hai đường chéo",
            ],
            common_mistakes=[
                CommonMistake(
                    move_number=4,
                    wrong_move=(9, 7),
                    correct_move=(6, 7),
                    explanation="Trắng nên chặn bên trái thay vì tiếp tục bên phải",
                    severity="major"
                ),
            ],
            recommended_for="beginner"
        )
        
        # Direct Opening 2: Kagetsu (花月) - Flower Moon
        self.openings["kagetsu"] = Opening(
            name="Hoa Nguyệt",
            name_en="Flower Moon",
            name_jp="Kagetsu (花月)",
            type=OpeningType.RENJU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 7, "O"),
                OpeningMove(6, 7, "X"),   # 3. Left of center (horizontal)
            ],
            evaluation=OpeningEvaluation.ADVANTAGE,
            evaluation_score=15,
            description="Khai cuộc Hoa Nguyệt - khai cuộc mạnh cho Đen với nhiều biến thể tấn công.",
            key_ideas=[
                "Đen tạo đường ngang mạnh",
                "Trắng phải phòng thủ cẩn thận",
                "Nhiều biến thể VCF cho Đen",
            ],
            common_mistakes=[
                CommonMistake(
                    move_number=4,
                    wrong_move=(5, 7),
                    correct_move=(6, 6),
                    explanation="Trắng nên chặn chéo thay vì tiếp tục đường ngang",
                    severity="critical"
                ),
            ],
            recommended_for="intermediate"
        )
        
        # Direct Opening 3: Suigetsu (水月) - Water Moon
        self.openings["suigetsu"] = Opening(
            name="Thủy Nguyệt",
            name_en="Water Moon",
            name_jp="Suigetsu (水月)",
            type=OpeningType.RENJU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 7, "O"),
                OpeningMove(8, 6, "X"),   # 3. Above White's stone
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=8,
            description="Khai cuộc Thủy Nguyệt - khai cuộc linh hoạt với nhiều hướng phát triển.",
            key_ideas=[
                "Đen tạo áp lực theo đường dọc",
                "Có thể chuyển sang tấn công chéo",
                "Trắng cần cân nhắc kỹ nước 4",
            ],
            common_mistakes=[
                CommonMistake(
                    move_number=4,
                    wrong_move=(8, 8),
                    correct_move=(6, 6),
                    explanation="Trắng nên phát triển xa hơn thay vì đi gần",
                    severity="minor"
                ),
            ],
            recommended_for="intermediate"
        )
        
        # Direct Opening 4: Sangetsu (山月) - Mountain Moon
        self.openings["sangetsu"] = Opening(
            name="Sơn Nguyệt",
            name_en="Mountain Moon",
            name_jp="Sangetsu (山月)",
            type=OpeningType.RENJU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 7, "O"),
                OpeningMove(8, 8, "X"),   # 3. Below-right diagonal
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=3,
            description="Khai cuộc Sơn Nguyệt - khai cuộc phòng thủ, phù hợp cho người mới.",
            key_ideas=[
                "Đen phát triển an toàn",
                "Ít biến thể phức tạp",
                "Trắng có nhiều cơ hội cân bằng",
            ],
            common_mistakes=[],
            recommended_for="beginner"
        )
        
        # Direct Opening 5: Shingetsu (新月) - New Moon
        self.openings["shingetsu"] = Opening(
            name="Tân Nguyệt",
            name_en="New Moon",
            name_jp="Shingetsu (新月)",
            type=OpeningType.RENJU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 7, "O"),
                OpeningMove(9, 7, "X"),   # 3. Far right (horizontal)
            ],
            evaluation=OpeningEvaluation.DISADVANTAGE,
            evaluation_score=-5,
            description="Khai cuộc Tân Nguyệt - khai cuộc yếu cho Đen, Trắng có lợi thế.",
            key_ideas=[
                "Đen đi xa, mất thế",
                "Trắng nên tấn công ngay",
                "Không khuyến khích cho Đen",
            ],
            common_mistakes=[
                CommonMistake(
                    move_number=3,
                    wrong_move=(9, 7),
                    correct_move=(6, 6),
                    explanation="Nước 3 quá xa, nên chọn vị trí gần hơn",
                    severity="major"
                ),
            ],
            recommended_for="advanced"
        )
        
        # Direct Opening 6: Meisui (明星) - Bright Star
        self.openings["meisui"] = Opening(
            name="Minh Tinh",
            name_en="Bright Star",
            name_jp="Meisui (明星)",
            type=OpeningType.RENJU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(7, 8, "O"),   # 2. Below center
                OpeningMove(6, 6, "X"),   # 3. Upper-left diagonal
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=7,
            description="Khai cuộc Minh Tinh - khai cuộc cân bằng với nhiều biến thể.",
            key_ideas=[
                "Đen phát triển đường chéo",
                "Trắng có thể phản công",
                "Cần tính toán kỹ các biến",
            ],
            common_mistakes=[],
            recommended_for="intermediate"
        )
        
        # Direct Opening 7: Zuisei (瑞星) - Lucky Star
        self.openings["zuisei"] = Opening(
            name="Thụy Tinh",
            name_en="Lucky Star",
            name_jp="Zuisei (瑞星)",
            type=OpeningType.RENJU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(7, 8, "O"),
                OpeningMove(8, 6, "X"),   # 3. Upper-right
            ],
            evaluation=OpeningEvaluation.ADVANTAGE,
            evaluation_score=12,
            description="Khai cuộc Thụy Tinh - khai cuộc tấn công mạnh cho Đen.",
            key_ideas=[
                "Đen tạo thế tấn công sớm",
                "Nhiều đường VCF tiềm năng",
                "Trắng cần phòng thủ chính xác",
            ],
            common_mistakes=[
                CommonMistake(
                    move_number=4,
                    wrong_move=(9, 5),
                    correct_move=(6, 8),
                    explanation="Trắng nên chặn gần thay vì đi xa",
                    severity="major"
                ),
            ],
            recommended_for="intermediate"
        )
        
        # Direct Opening 8: Chosei (長星) - Long Star
        self.openings["chosei"] = Opening(
            name="Trường Tinh",
            name_en="Long Star",
            name_jp="Chosei (長星)",
            type=OpeningType.RENJU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(7, 8, "O"),
                OpeningMove(7, 6, "X"),   # 3. Above center (vertical)
            ],
            evaluation=OpeningEvaluation.ADVANTAGE,
            evaluation_score=10,
            description="Khai cuộc Trường Tinh - khai cuộc đường dọc mạnh.",
            key_ideas=[
                "Đen kiểm soát đường dọc",
                "Có thể mở rộng sang hai bên",
                "Trắng cần chặn sớm",
            ],
            common_mistakes=[],
            recommended_for="beginner"
        )

        
        # Direct Opening 9: Kyogetsu (峡月) - Gorge Moon
        self.openings["kyogetsu"] = Opening(
            name="Hiệp Nguyệt",
            name_en="Gorge Moon",
            name_jp="Kyogetsu (峡月)",
            type=OpeningType.RENJU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(7, 8, "O"),
                OpeningMove(6, 8, "X"),   # 3. Left of White
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=5,
            description="Khai cuộc Hiệp Nguyệt - khai cuộc cân bằng, dễ chơi.",
            key_ideas=[
                "Đen tạo áp lực bên trái",
                "Có thể phát triển nhiều hướng",
                "Phù hợp cho người mới",
            ],
            common_mistakes=[],
            recommended_for="beginner"
        )
        
        # Direct Opening 10: Ugetsu (雨月) - Rain Moon
        self.openings["ugetsu"] = Opening(
            name="Vũ Nguyệt",
            name_en="Rain Moon",
            name_jp="Ugetsu (雨月)",
            type=OpeningType.RENJU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(7, 8, "O"),
                OpeningMove(8, 8, "X"),   # 3. Right of White
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=4,
            description="Khai cuộc Vũ Nguyệt - khai cuộc đối xứng, cân bằng.",
            key_ideas=[
                "Đen và Trắng đối xứng",
                "Trận đấu cân bằng",
                "Cần kỹ năng trung bình",
            ],
            common_mistakes=[],
            recommended_for="beginner"
        )
        
        # Direct Opening 11: Kinsei (金星) - Venus/Gold Star
        self.openings["kinsei"] = Opening(
            name="Kim Tinh",
            name_en="Venus",
            name_jp="Kinsei (金星)",
            type=OpeningType.RENJU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(7, 8, "O"),
                OpeningMove(7, 9, "X"),   # 3. Far below (vertical)
            ],
            evaluation=OpeningEvaluation.DISADVANTAGE,
            evaluation_score=-8,
            description="Khai cuộc Kim Tinh - khai cuộc yếu, Đen đi xa.",
            key_ideas=[
                "Nước 3 quá xa trung tâm",
                "Trắng có lợi thế",
                "Không khuyến khích",
            ],
            common_mistakes=[
                CommonMistake(
                    move_number=3,
                    wrong_move=(7, 9),
                    correct_move=(6, 6),
                    explanation="Nước 3 quá xa, mất thế",
                    severity="major"
                ),
            ],
            recommended_for="advanced"
        )
        
        # Direct Opening 12: Shogetsu (松月) - Pine Moon
        self.openings["shogetsu"] = Opening(
            name="Tùng Nguyệt",
            name_en="Pine Moon",
            name_jp="Shogetsu (松月)",
            type=OpeningType.RENJU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(7, 8, "O"),
                OpeningMove(6, 7, "X"),   # 3. Left of center
            ],
            evaluation=OpeningEvaluation.ADVANTAGE,
            evaluation_score=10,
            description="Khai cuộc Tùng Nguyệt - khai cuộc tấn công mạnh.",
            key_ideas=[
                "Đen tạo đường ngang",
                "Nhiều biến thể tấn công",
                "Trắng cần cẩn thận",
            ],
            common_mistakes=[],
            recommended_for="intermediate"
        )
        
        # Direct Opening 13: Kyugetsu (丘月) - Hill Moon
        self.openings["kyugetsu"] = Opening(
            name="Khâu Nguyệt",
            name_en="Hill Moon",
            name_jp="Kyugetsu (丘月)",
            type=OpeningType.RENJU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(7, 8, "O"),
                OpeningMove(8, 7, "X"),   # 3. Right of center
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=6,
            description="Khai cuộc Khâu Nguyệt - khai cuộc cân bằng.",
            key_ideas=[
                "Đen phát triển bên phải",
                "Cân bằng giữa tấn công và phòng thủ",
                "Dễ chơi cho cả hai bên",
            ],
            common_mistakes=[],
            recommended_for="beginner"
        )
        
        # ============================================
        # INDIRECT OPENINGS (2nd move diagonal from center)
        # ============================================
        
        # Indirect Opening 14: Kosei (恒星) - Fixed Star
        self.openings["kosei"] = Opening(
            name="Hằng Tinh",
            name_en="Fixed Star",
            name_jp="Kosei (恒星)",
            type=OpeningType.RENJU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 8, "O"),   # 2. Diagonal
                OpeningMove(6, 6, "X"),   # 3. Opposite diagonal
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=5,
            description="Khai cuộc Hằng Tinh - khai cuộc gián tiếp cân bằng.",
            key_ideas=[
                "Đen và Trắng đối xứng chéo",
                "Trận đấu cân bằng",
                "Cần tính toán kỹ",
            ],
            common_mistakes=[],
            recommended_for="intermediate"
        )
        
        # Indirect Opening 15: Keigetsu (慧月) - Wise Moon
        self.openings["keigetsu"] = Opening(
            name="Tuệ Nguyệt",
            name_en="Wise Moon",
            name_jp="Keigetsu (慧月)",
            type=OpeningType.RENJU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 8, "O"),
                OpeningMove(6, 7, "X"),   # 3. Left of center
            ],
            evaluation=OpeningEvaluation.ADVANTAGE,
            evaluation_score=12,
            description="Khai cuộc Tuệ Nguyệt - khai cuộc tấn công gián tiếp.",
            key_ideas=[
                "Đen tạo thế tấn công",
                "Trắng ở vị trí khó",
                "Nhiều biến thể phức tạp",
            ],
            common_mistakes=[],
            recommended_for="advanced"
        )
        
        # Indirect Opening 16: Ryusei (流星) - Shooting Star
        self.openings["ryusei"] = Opening(
            name="Lưu Tinh",
            name_en="Shooting Star",
            name_jp="Ryusei (流星)",
            type=OpeningType.RENJU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 8, "O"),
                OpeningMove(7, 6, "X"),   # 3. Above center
            ],
            evaluation=OpeningEvaluation.ADVANTAGE,
            evaluation_score=10,
            description="Khai cuộc Lưu Tinh - khai cuộc tấn công nhanh.",
            key_ideas=[
                "Đen phát triển nhanh",
                "Tạo áp lực sớm",
                "Trắng cần phản ứng nhanh",
            ],
            common_mistakes=[],
            recommended_for="intermediate"
        )
        
        # Indirect Opening 17: Ungetsu (雲月) - Cloud Moon
        self.openings["ungetsu"] = Opening(
            name="Vân Nguyệt",
            name_en="Cloud Moon",
            name_jp="Ungetsu (雲月)",
            type=OpeningType.RENJU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 8, "O"),
                OpeningMove(8, 7, "X"),   # 3. Right of center
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=7,
            description="Khai cuộc Vân Nguyệt - khai cuộc linh hoạt.",
            key_ideas=[
                "Đen có nhiều hướng",
                "Trắng có thể phản công",
                "Trận đấu mở",
            ],
            common_mistakes=[],
            recommended_for="intermediate"
        )
        
        # Indirect Opening 18: Engetsu (淵月) - Deep Moon
        self.openings["engetsu"] = Opening(
            name="Uyên Nguyệt",
            name_en="Deep Moon",
            name_jp="Engetsu (淵月)",
            type=OpeningType.RENJU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 8, "O"),
                OpeningMove(7, 8, "X"),   # 3. Below center
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=6,
            description="Khai cuộc Uyên Nguyệt - khai cuộc phòng thủ.",
            key_ideas=[
                "Đen chơi an toàn",
                "Ít biến thể phức tạp",
                "Phù hợp cho người mới",
            ],
            common_mistakes=[],
            recommended_for="beginner"
        )
        
        # Indirect Opening 19: Geigetsu (鯨月) - Whale Moon
        self.openings["geigetsu"] = Opening(
            name="Kình Nguyệt",
            name_en="Whale Moon",
            name_jp="Geigetsu (鯨月)",
            type=OpeningType.RENJU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 8, "O"),
                OpeningMove(9, 9, "X"),   # 3. Continue diagonal
            ],
            evaluation=OpeningEvaluation.DISADVANTAGE,
            evaluation_score=-5,
            description="Khai cuộc Kình Nguyệt - khai cuộc yếu.",
            key_ideas=[
                "Đen đi xa trung tâm",
                "Trắng có lợi thế",
                "Không khuyến khích",
            ],
            common_mistakes=[
                CommonMistake(
                    move_number=3,
                    wrong_move=(9, 9),
                    correct_move=(6, 6),
                    explanation="Nên đi ngược lại thay vì tiếp tục đường chéo",
                    severity="major"
                ),
            ],
            recommended_for="advanced"
        )
        
        # Indirect Opening 20: Meigetsu (名月) - Famous Moon
        self.openings["meigetsu"] = Opening(
            name="Danh Nguyệt",
            name_en="Famous Moon",
            name_jp="Meigetsu (名月)",
            type=OpeningType.RENJU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 8, "O"),
                OpeningMove(6, 8, "X"),   # 3. Left-below
            ],
            evaluation=OpeningEvaluation.ADVANTAGE,
            evaluation_score=8,
            description="Khai cuộc Danh Nguyệt - khai cuộc nổi tiếng.",
            key_ideas=[
                "Đen tạo thế đa hướng",
                "Nhiều biến thể hay",
                "Được nhiều cao thủ sử dụng",
            ],
            common_mistakes=[],
            recommended_for="advanced"
        )

        
        # Indirect Opening 21: Suisei (彗星) - Comet
        self.openings["suisei"] = Opening(
            name="Tuệ Tinh",
            name_en="Comet",
            name_jp="Suisei (彗星)",
            type=OpeningType.RENJU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 8, "O"),
                OpeningMove(8, 6, "X"),   # 3. Upper-right
            ],
            evaluation=OpeningEvaluation.ADVANTAGE,
            evaluation_score=11,
            description="Khai cuộc Tuệ Tinh - khai cuộc tấn công mạnh.",
            key_ideas=[
                "Đen tạo áp lực đa hướng",
                "Nhiều đường VCF",
                "Trắng cần phòng thủ tốt",
            ],
            common_mistakes=[],
            recommended_for="intermediate"
        )
        
        # Indirect Opening 22: Gansei (岩星) - Rock Star
        self.openings["gansei"] = Opening(
            name="Nham Tinh",
            name_en="Rock Star",
            name_jp="Gansei (岩星)",
            type=OpeningType.RENJU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 8, "O"),
                OpeningMove(9, 7, "X"),   # 3. Far right
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=3,
            description="Khai cuộc Nham Tinh - khai cuộc vững chắc.",
            key_ideas=[
                "Đen phát triển bên phải",
                "Trận đấu cân bằng",
                "Ít biến thể phức tạp",
            ],
            common_mistakes=[],
            recommended_for="beginner"
        )
        
        # Indirect Opening 23: Gingetsu (銀月) - Silver Moon
        self.openings["gingetsu"] = Opening(
            name="Ngân Nguyệt",
            name_en="Silver Moon",
            name_jp="Gingetsu (銀月)",
            type=OpeningType.RENJU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 8, "O"),
                OpeningMove(9, 8, "X"),   # 3. Right of White
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=4,
            description="Khai cuộc Ngân Nguyệt - khai cuộc cân bằng.",
            key_ideas=[
                "Đen áp sát Trắng",
                "Trận đấu căng thẳng",
                "Cần tính toán kỹ",
            ],
            common_mistakes=[],
            recommended_for="intermediate"
        )
        
        # Indirect Opening 24: Myogetsu (妙月) - Wonderful Moon
        self.openings["myogetsu"] = Opening(
            name="Diệu Nguyệt",
            name_en="Wonderful Moon",
            name_jp="Myogetsu (妙月)",
            type=OpeningType.RENJU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 8, "O"),
                OpeningMove(8, 9, "X"),   # 3. Below White
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=5,
            description="Khai cuộc Diệu Nguyệt - khai cuộc tinh tế.",
            key_ideas=[
                "Đen tạo thế từ dưới",
                "Nhiều biến thể hay",
                "Cần kinh nghiệm",
            ],
            common_mistakes=[],
            recommended_for="advanced"
        )
        
        # Indirect Opening 25: Sosei (疎星) - Sparse Star
        self.openings["sosei"] = Opening(
            name="Sơ Tinh",
            name_en="Sparse Star",
            name_jp="Sosei (疎星)",
            type=OpeningType.RENJU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 8, "O"),
                OpeningMove(5, 5, "X"),   # 3. Far upper-left
            ],
            evaluation=OpeningEvaluation.DISADVANTAGE,
            evaluation_score=-10,
            description="Khai cuộc Sơ Tinh - khai cuộc yếu, quá xa.",
            key_ideas=[
                "Nước 3 quá xa",
                "Trắng có lợi thế lớn",
                "Không nên sử dụng",
            ],
            common_mistakes=[
                CommonMistake(
                    move_number=3,
                    wrong_move=(5, 5),
                    correct_move=(6, 6),
                    explanation="Nước 3 quá xa trung tâm, mất kiểm soát",
                    severity="critical"
                ),
            ],
            recommended_for="advanced"
        )
        
        # Indirect Opening 26: Hokutosei (北斗星) - Big Dipper
        self.openings["hokutosei"] = Opening(
            name="Bắc Đẩu Tinh",
            name_en="Big Dipper",
            name_jp="Hokutosei (北斗星)",
            type=OpeningType.RENJU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 8, "O"),
                OpeningMove(6, 9, "X"),   # 3. Left-far-below
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=2,
            description="Khai cuộc Bắc Đẩu Tinh - khai cuộc đặc biệt.",
            key_ideas=[
                "Đen tạo thế bất ngờ",
                "Ít người biết biến thể",
                "Có thể gây bất ngờ",
            ],
            common_mistakes=[],
            recommended_for="advanced"
        )
    
    def _load_gomoku_openings(self):
        """Load common Gomoku openings (non-Renju rules)."""
        
        # ============================================
        # GOMOKU DIRECT OPENINGS
        # ============================================
        
        # Gomoku Direct 1: Center Control
        self.openings["gomoku_center"] = Opening(
            name="Kiểm Soát Trung Tâm",
            name_en="Center Control",
            name_jp="Center Control",
            type=OpeningType.GOMOKU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 7, "O"),
                OpeningMove(7, 8, "X"),
            ],
            evaluation=OpeningEvaluation.ADVANTAGE,
            evaluation_score=15,
            description="Khai cuộc kiểm soát trung tâm - Đen chiếm ưu thế vị trí.",
            key_ideas=[
                "Đen kiểm soát trung tâm",
                "Có thể phát triển mọi hướng",
                "Trắng cần phản công nhanh",
            ],
            common_mistakes=[
                CommonMistake(
                    move_number=4,
                    wrong_move=(6, 6),
                    correct_move=(8, 8),
                    explanation="Trắng nên chặn đường chéo thay vì đi xa",
                    severity="minor"
                ),
            ],
            recommended_for="beginner"
        )
        
        # Gomoku Direct 2: Diagonal Attack
        self.openings["gomoku_diagonal"] = Opening(
            name="Tấn Công Chéo",
            name_en="Diagonal Attack",
            name_jp="Diagonal Attack",
            type=OpeningType.GOMOKU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 8, "O"),
                OpeningMove(6, 6, "X"),
            ],
            evaluation=OpeningEvaluation.ADVANTAGE,
            evaluation_score=12,
            description="Khai cuộc tấn công chéo - Đen tạo đường chéo mạnh.",
            key_ideas=[
                "Đen kiểm soát đường chéo",
                "Có thể tạo VCF sớm",
                "Trắng cần chặn kịp thời",
            ],
            common_mistakes=[],
            recommended_for="beginner"
        )
        
        # Gomoku Direct 3: Horizontal Line
        self.openings["gomoku_horizontal"] = Opening(
            name="Đường Ngang",
            name_en="Horizontal Line",
            name_jp="Horizontal Line",
            type=OpeningType.GOMOKU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(7, 8, "O"),
                OpeningMove(7, 6, "X"),
            ],
            evaluation=OpeningEvaluation.ADVANTAGE,
            evaluation_score=10,
            description="Khai cuộc đường ngang - Đen tạo đường ngang mạnh.",
            key_ideas=[
                "Đen kiểm soát đường ngang",
                "Dễ phát triển thành 4",
                "Trắng cần chặn hai đầu",
            ],
            common_mistakes=[],
            recommended_for="beginner"
        )
        
        # Gomoku Direct 4: Vertical Line
        self.openings["gomoku_vertical"] = Opening(
            name="Đường Dọc",
            name_en="Vertical Line",
            name_jp="Vertical Line",
            type=OpeningType.GOMOKU_DIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 7, "O"),
                OpeningMove(6, 7, "X"),
            ],
            evaluation=OpeningEvaluation.ADVANTAGE,
            evaluation_score=10,
            description="Khai cuộc đường dọc - Đen tạo đường dọc mạnh.",
            key_ideas=[
                "Đen kiểm soát đường dọc",
                "Tương tự đường ngang",
                "Trắng cần chặn hai đầu",
            ],
            common_mistakes=[],
            recommended_for="beginner"
        )
        
        # ============================================
        # GOMOKU INDIRECT OPENINGS
        # ============================================
        
        # Gomoku Indirect 1: Knight's Move
        self.openings["gomoku_knight"] = Opening(
            name="Nước Mã",
            name_en="Knight's Move",
            name_jp="Knight's Move",
            type=OpeningType.GOMOKU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 8, "O"),
                OpeningMove(5, 6, "X"),   # Knight's move from center
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=5,
            description="Khai cuộc nước mã - Đen tạo thế bất ngờ.",
            key_ideas=[
                "Đen tạo thế khó đoán",
                "Có thể kết nối sau",
                "Trắng khó chặn",
            ],
            common_mistakes=[],
            recommended_for="intermediate"
        )
        
        # Gomoku Indirect 2: Jump Opening
        self.openings["gomoku_jump"] = Opening(
            name="Nhảy Xa",
            name_en="Jump Opening",
            name_jp="Jump Opening",
            type=OpeningType.GOMOKU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(8, 7, "O"),
                OpeningMove(5, 7, "X"),   # Jump 2 squares
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=3,
            description="Khai cuộc nhảy xa - Đen tạo khoảng cách.",
            key_ideas=[
                "Đen tạo không gian",
                "Có thể kết nối sau",
                "Trắng có thể chen giữa",
            ],
            common_mistakes=[
                CommonMistake(
                    move_number=4,
                    wrong_move=(4, 7),
                    correct_move=(6, 7),
                    explanation="Trắng nên chen giữa thay vì đi xa",
                    severity="minor"
                ),
            ],
            recommended_for="intermediate"
        )
        
        # Gomoku Indirect 3: Double Diagonal
        self.openings["gomoku_double_diagonal"] = Opening(
            name="Chéo Đôi",
            name_en="Double Diagonal",
            name_jp="Double Diagonal",
            type=OpeningType.GOMOKU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(6, 6, "O"),
                OpeningMove(8, 8, "X"),
            ],
            evaluation=OpeningEvaluation.ADVANTAGE,
            evaluation_score=8,
            description="Khai cuộc chéo đôi - Đen kiểm soát đường chéo.",
            key_ideas=[
                "Đen có 2 quân trên đường chéo",
                "Trắng ở giữa nhưng bị kẹp",
                "Đen có lợi thế phát triển",
            ],
            common_mistakes=[],
            recommended_for="beginner"
        )
        
        # Gomoku Indirect 4: Scattered Opening
        self.openings["gomoku_scattered"] = Opening(
            name="Phân Tán",
            name_en="Scattered Opening",
            name_jp="Scattered Opening",
            type=OpeningType.GOMOKU_INDIRECT,
            moves=[
                OpeningMove(7, 7, "X"),
                OpeningMove(9, 9, "O"),
                OpeningMove(5, 5, "X"),
            ],
            evaluation=OpeningEvaluation.BALANCED,
            evaluation_score=0,
            description="Khai cuộc phân tán - Cả hai bên đi xa.",
            key_ideas=[
                "Trận đấu mở",
                "Nhiều không gian",
                "Cần chiến thuật dài hạn",
            ],
            common_mistakes=[],
            recommended_for="advanced"
        )

    
    def get_opening(self, name: str) -> Optional[Opening]:
        """
        Get an opening by its key name.
        
        Args:
            name: Opening key name (e.g., "kansei", "kagetsu")
            
        Returns:
            Opening object or None if not found
        """
        return self.openings.get(name.lower())
    
    def get_all_openings(self) -> List[Opening]:
        """
        Get all openings in the book.
        
        Returns:
            List of all Opening objects
        """
        return list(self.openings.values())
    
    def get_openings_by_type(self, opening_type: OpeningType) -> List[Opening]:
        """
        Get all openings of a specific type.
        
        Args:
            opening_type: Type of opening to filter by
            
        Returns:
            List of Opening objects matching the type
        """
        return [o for o in self.openings.values() if o.type == opening_type]
    
    def get_openings_by_evaluation(self, evaluation: OpeningEvaluation) -> List[Opening]:
        """
        Get all openings with a specific evaluation.
        
        Args:
            evaluation: Evaluation to filter by
            
        Returns:
            List of Opening objects matching the evaluation
        """
        return [o for o in self.openings.values() if o.evaluation == evaluation]
    
    def identify_opening(self, moves: List[Tuple[int, int, str]]) -> Optional[Opening]:
        """
        Identify an opening from a sequence of moves.
        
        Args:
            moves: List of (x, y, player) tuples representing the game moves
            
        Returns:
            Matching Opening object or None if no match found
        """
        if len(moves) < 3:
            return None
        
        # Convert moves to comparable format
        move_sequence = [(m[0], m[1], m[2]) for m in moves[:3]]
        
        for opening in self.openings.values():
            if len(opening.moves) <= len(moves):
                opening_sequence = [
                    (m.x, m.y, m.player) for m in opening.moves
                ]
                if move_sequence[:len(opening_sequence)] == opening_sequence:
                    return opening
        
        return None
    
    def identify_opening_from_moves(self, moves: List['OpeningMove']) -> Optional[Opening]:
        """
        Identify an opening from a list of OpeningMove objects.
        
        Args:
            moves: List of OpeningMove objects
            
        Returns:
            Matching Opening object or None if no match found
        """
        if len(moves) < 3:
            return None
        
        move_tuples = [(m.x, m.y, m.player) for m in moves]
        return self.identify_opening(move_tuples)
    
    def get_opening_analysis(self, moves: List[Tuple[int, int, str]]) -> Dict:
        """
        Get detailed analysis for an opening position.
        
        Args:
            moves: List of (x, y, player) tuples
            
        Returns:
            Dictionary with opening analysis including:
            - opening: Opening object if identified
            - is_known: Whether the opening is in the book
            - evaluation: Position evaluation
            - suggestions: Suggested next moves
            - mistakes: Any mistakes made so far
        """
        opening = self.identify_opening(moves)
        
        result = {
            "opening": opening,
            "is_known": opening is not None,
            "evaluation": None,
            "evaluation_score": 0,
            "suggestions": [],
            "mistakes": [],
            "description": "",
            "key_ideas": [],
        }
        
        if opening:
            result["evaluation"] = opening.evaluation.value
            result["evaluation_score"] = opening.evaluation_score
            result["description"] = opening.description
            result["key_ideas"] = opening.key_ideas
            
            # Check for common mistakes
            for mistake in opening.common_mistakes:
                if len(moves) >= mistake.move_number:
                    actual_move = moves[mistake.move_number - 1]
                    if (actual_move[0], actual_move[1]) == mistake.wrong_move:
                        result["mistakes"].append({
                            "move_number": mistake.move_number,
                            "wrong_move": mistake.wrong_move,
                            "correct_move": mistake.correct_move,
                            "explanation": mistake.explanation,
                            "severity": mistake.severity,
                        })
            
            # Suggest next moves based on variations
            if opening.variations:
                for var_name, var_moves in opening.variations.items():
                    if len(var_moves) > len(moves):
                        next_move = var_moves[len(moves)]
                        result["suggestions"].append({
                            "variation": var_name,
                            "move": (next_move.x, next_move.y),
                            "player": next_move.player,
                        })
        
        return result
    
    def suggest_opening_move(self, moves: List[Tuple[int, int, str]], player: str) -> Optional[Dict]:
        """
        Suggest the next move based on opening theory.
        
        Args:
            moves: Current game moves as (x, y, player) tuples
            player: Player to move ("X" or "O")
            
        Returns:
            Dictionary with suggested move and reasoning, or None
        """
        if len(moves) == 0 and player == "X":
            # First move - always center
            return {
                "move": (7, 7),
                "reason": "Nước đầu tiên nên đi trung tâm để kiểm soát bàn cờ",
                "opening_name": None,
            }
        
        if len(moves) == 1 and player == "O":
            # Second move - suggest adjacent or diagonal
            return {
                "move": (8, 7),
                "reason": "Nước 2 nên đi gần trung tâm để tranh giành kiểm soát",
                "opening_name": None,
            }
        
        # Try to find matching opening and suggest continuation
        opening = self.identify_opening(moves)
        if opening and len(opening.moves) > len(moves):
            next_move = opening.moves[len(moves)]
            if next_move.player == player:
                return {
                    "move": (next_move.x, next_move.y),
                    "reason": f"Theo lý thuyết khai cuộc {opening.name}",
                    "opening_name": opening.name,
                }
        
        # Find openings that match current position and suggest best continuation
        best_suggestion = None
        best_score = -1000
        
        for op in self.openings.values():
            if len(op.moves) > len(moves):
                # Check if current moves match this opening's prefix
                matches = True
                for i, move in enumerate(moves):
                    if i < len(op.moves):
                        op_move = op.moves[i]
                        if (move[0], move[1], move[2]) != (op_move.x, op_move.y, op_move.player):
                            matches = False
                            break
                
                if matches and len(op.moves) > len(moves):
                    next_move = op.moves[len(moves)]
                    if next_move.player == player:
                        # Prefer openings with better evaluation for the current player
                        score = op.evaluation_score if player == "X" else -op.evaluation_score
                        if score > best_score:
                            best_score = score
                            best_suggestion = {
                                "move": (next_move.x, next_move.y),
                                "reason": f"Theo lý thuyết khai cuộc {op.name} ({op.name_en})",
                                "opening_name": op.name,
                            }
        
        return best_suggestion
    
    def get_opening_statistics(self) -> Dict:
        """
        Get statistics about the opening book.
        
        Returns:
            Dictionary with statistics about openings
        """
        stats = {
            "total_openings": len(self.openings),
            "by_type": {},
            "by_evaluation": {},
            "by_recommendation": {},
        }
        
        for opening_type in OpeningType:
            count = len([o for o in self.openings.values() if o.type == opening_type])
            stats["by_type"][opening_type.value] = count
        
        for evaluation in OpeningEvaluation:
            count = len([o for o in self.openings.values() if o.evaluation == evaluation])
            stats["by_evaluation"][evaluation.value] = count
        
        for level in ["beginner", "intermediate", "advanced"]:
            count = len([o for o in self.openings.values() if o.recommended_for == level])
            stats["by_recommendation"][level] = count
        
        return stats


# ============================================
# Helper Functions
# ============================================

def identify_opening(moves: List[Tuple[int, int, str]]) -> Optional[Opening]:
    """
    Convenience function to identify an opening.
    
    Args:
        moves: List of (x, y, player) tuples
        
    Returns:
        Matching Opening or None
    """
    book = OpeningBook()
    return book.identify_opening(moves)


def get_opening_analysis(moves: List[Tuple[int, int, str]]) -> Dict:
    """
    Convenience function to get opening analysis.
    
    Args:
        moves: List of (x, y, player) tuples
        
    Returns:
        Opening analysis dictionary
    """
    book = OpeningBook()
    return book.get_opening_analysis(moves)


def suggest_opening_move(moves: List[Tuple[int, int, str]], player: str) -> Optional[Dict]:
    """
    Convenience function to suggest opening move.
    
    Args:
        moves: Current game moves
        player: Player to move
        
    Returns:
        Suggested move dictionary or None
    """
    book = OpeningBook()
    return book.suggest_opening_move(moves, player)


# ============================================
# Opening Book Instance (Singleton-like)
# ============================================

_opening_book_instance: Optional[OpeningBook] = None


def get_opening_book() -> OpeningBook:
    """
    Get the global opening book instance.
    
    Returns:
        OpeningBook instance
    """
    global _opening_book_instance
    if _opening_book_instance is None:
        _opening_book_instance = OpeningBook()
    return _opening_book_instance
