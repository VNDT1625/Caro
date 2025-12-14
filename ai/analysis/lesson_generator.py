"""
AI Match Analysis System - Lesson Generator

This module generates mini lessons from mistakes to help players learn.
Each lesson includes:
- Why the move was wrong
- What to do instead
- Similar patterns to avoid
- Practice positions

Task 8.6.2: Lesson Generation
Impact: Learning từ mistakes
"""

from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum
import random

from .types import (
    ThreatType,
    Move,
    BOARD_SIZE,
)
from .mistake_analyzer import (
    MistakeAnalyzer,
    MistakeCategory,
    CategorizedMistake,
    MISTAKE_CATEGORY_LABELS,
)
from .threat_detector import ThreatDetector


@dataclass
class SimilarPattern:
    """
    A similar pattern to avoid.
    
    Attributes:
        name: Name of the pattern
        description: Description of the pattern
        example_board: Example board state showing the pattern
        key_positions: Key positions to watch for
    """
    name: str
    description: str
    example_board: List[List[Optional[str]]]
    key_positions: List[Tuple[int, int]]


@dataclass
class PracticePosition:
    """
    A practice position generated from a mistake.
    
    Attributes:
        board: Board state for practice
        player_to_move: Which player should move
        correct_move: The correct move to find
        hint: Hint for the player
        difficulty: Difficulty level (easy, medium, hard)
    """
    board: List[List[Optional[str]]]
    player_to_move: str
    correct_move: Tuple[int, int]
    hint: str
    difficulty: str


@dataclass
class MiniLesson:
    """
    A mini lesson generated from a mistake.
    
    Attributes:
        title: Lesson title
        category: Category of the mistake
        why_wrong: Explanation of why the move was wrong
        what_to_do: What should be done instead
        similar_patterns: List of similar patterns to avoid
        practice_positions: List of practice positions
        key_takeaways: Key points to remember
        difficulty: Lesson difficulty (beginner, intermediate, advanced)
    """
    title: str
    category: MistakeCategory
    why_wrong: str
    what_to_do: str
    similar_patterns: List[SimilarPattern]
    practice_positions: List[PracticePosition]
    key_takeaways: List[str]
    difficulty: str


# Lesson templates for each category
LESSON_TEMPLATES: Dict[MistakeCategory, Dict[str, Any]] = {
    MistakeCategory.TACTICAL: {
        "title_template": "Bài học Chiến thuật: {specific}",
        "why_wrong_templates": [
            "Nước đi này bỏ lỡ cơ hội {opportunity}. Trong Caro, việc nhận ra và tận dụng các đe dọa là rất quan trọng.",
            "Bạn đã không {action}. Đây là sai lầm chiến thuật phổ biến khi không kiểm tra kỹ bàn cờ.",
            "Nước đi thực tế không tạo được áp lực. Cần phải {action} để duy trì lợi thế.",
        ],
        "what_to_do_templates": [
            "Luôn kiểm tra: 1) Đối thủ có đe dọa không? 2) Mình có thể tạo đe dọa không? Ưu tiên chặn đe dọa nguy hiểm trước.",
            "Trước mỗi nước đi, hãy đếm số quân liên tiếp của cả hai bên. Nếu đối thủ có 3+ quân liên tiếp, cần cảnh giác.",
            "Tập trung vào việc tạo đe dọa kép (double threat) - hai đường tấn công cùng lúc khiến đối thủ không thể chặn hết.",
        ],
        "key_takeaways": [
            "Luôn kiểm tra đe dọa của đối thủ trước khi đi",
            "Ưu tiên tạo đe dọa kép (Tứ + Ba, hoặc hai Ba Mở)",
            "Chặn ngay khi đối thủ có Tứ hoặc Ba Mở",
        ],
    },
    MistakeCategory.POSITIONAL: {
        "title_template": "Bài học Vị trí: {specific}",
        "why_wrong_templates": [
            "Nước đi ở vị trí {position} quá xa trung tâm. Quân ở rìa bàn cờ có ít hướng phát triển hơn.",
            "Quân cờ bị cô lập, không kết nối với các quân khác. Điều này làm giảm sức mạnh tổng thể.",
            "Vị trí này không tận dụng được lợi thế không gian. Cần chơi gần trung tâm hơn.",
        ],
        "what_to_do_templates": [
            "Ưu tiên các vị trí gần trung tâm bàn cờ (ô 7,7 và xung quanh). Từ đây có thể phát triển theo 8 hướng.",
            "Giữ các quân cờ kết nối với nhau. Quân liên kết tạo ra nhiều đe dọa tiềm năng hơn.",
            "Tránh chơi ở góc hoặc cạnh trừ khi có lý do chiến thuật cụ thể.",
        ],
        "key_takeaways": [
            "Trung tâm bàn cờ có giá trị cao nhất",
            "Quân kết nối mạnh hơn quân rời rạc",
            "Tránh chơi ở góc/cạnh khi không cần thiết",
        ],
    },
    MistakeCategory.STRATEGIC: {
        "title_template": "Bài học Chiến lược: {specific}",
        "why_wrong_templates": [
            "Nước đi phát triển sai hướng, không phù hợp với kế hoạch tổng thể.",
            "Bạn đang xây dựng ở vùng không hiệu quả trong khi có cơ hội tốt hơn ở nơi khác.",
            "Chiến lược phân tán quân ra nhiều hướng làm giảm sức mạnh tấn công.",
        ],
        "what_to_do_templates": [
            "Tập trung phát triển theo một hướng chính. Xây dựng đe dọa dần dần thay vì phân tán.",
            "Xác định vùng có tiềm năng nhất và tập trung nguồn lực vào đó.",
            "Có kế hoạch rõ ràng: tấn công hay phòng thủ? Hướng nào? Mục tiêu gì?",
        ],
        "key_takeaways": [
            "Tập trung quân vào một vùng để tạo áp lực",
            "Có kế hoạch rõ ràng trước khi đi",
            "Không phân tán quân ra nhiều hướng",
        ],
    },
    MistakeCategory.TEMPO: {
        "title_template": "Bài học Nhịp độ: {specific}",
        "why_wrong_templates": [
            "Nước đi thụ động, không tạo áp lực. Bạn đã mất quyền chủ động.",
            "Đây là nước đi 'chờ đợi' khi cần phải hành động. Mỗi nước đi nên có mục đích.",
            "Bạn đã cho đối thủ thời gian để củng cố vị trí thay vì tấn công.",
        ],
        "what_to_do_templates": [
            "Mỗi nước đi nên tạo đe dọa hoặc cải thiện vị trí. Tránh các nước đi 'vô nghĩa'.",
            "Duy trì quyền chủ động bằng cách liên tục tạo áp lực. Buộc đối thủ phải phản ứng.",
            "Khi có lợi thế, hãy tấn công ngay. Đừng cho đối thủ cơ hội phản công.",
        ],
        "key_takeaways": [
            "Mỗi nước đi phải có mục đích rõ ràng",
            "Duy trì quyền chủ động, buộc đối thủ phản ứng",
            "Khi có lợi thế, tấn công ngay đừng chờ đợi",
        ],
    },
}

# Similar patterns database
SIMILAR_PATTERNS_DB: Dict[MistakeCategory, List[Dict[str, Any]]] = {
    MistakeCategory.TACTICAL: [
        {
            "name": "Bỏ lỡ Tứ Mở",
            "description": "Không nhận ra cơ hội tạo Tứ Mở (4 quân liên tiếp với 2 đầu trống)",
            "pattern": [(7, 5), (7, 6), (7, 7)],  # X X X _ _
            "key_move": (7, 4),  # or (7, 8)
        },
        {
            "name": "Không chặn Tứ",
            "description": "Không chặn khi đối thủ có 4 quân liên tiếp",
            "pattern": [(7, 5), (7, 6), (7, 7), (7, 8)],  # O O O O _
            "key_move": (7, 4),  # or (7, 9)
        },
        {
            "name": "Bỏ lỡ Ba Mở",
            "description": "Không tận dụng cơ hội tạo Ba Mở",
            "pattern": [(7, 6), (7, 7)],  # _ X X _
            "key_move": (7, 5),  # or (7, 8)
        },
    ],
    MistakeCategory.POSITIONAL: [
        {
            "name": "Chơi góc sớm",
            "description": "Đặt quân ở góc bàn cờ khi trung tâm còn trống",
            "pattern": [(0, 0)],
            "key_move": (7, 7),
        },
        {
            "name": "Quân cô lập",
            "description": "Đặt quân xa các quân khác, không kết nối",
            "pattern": [(7, 7), (7, 8), (0, 14)],  # Isolated piece at corner
            "key_move": (7, 9),
        },
    ],
    MistakeCategory.STRATEGIC: [
        {
            "name": "Phân tán quân",
            "description": "Xây dựng ở nhiều vùng khác nhau thay vì tập trung",
            "pattern": [(2, 2), (7, 7), (12, 12)],
            "key_move": (7, 8),
        },
        {
            "name": "Sai hướng phát triển",
            "description": "Phát triển ngược hướng với kế hoạch ban đầu",
            "pattern": [(7, 7), (7, 8), (2, 2)],
            "key_move": (7, 9),
        },
    ],
    MistakeCategory.TEMPO: [
        {
            "name": "Nước đi thụ động",
            "description": "Đi nước không tạo đe dọa khi có cơ hội tấn công",
            "pattern": [(7, 7), (7, 8)],
            "key_move": (7, 9),
        },
        {
            "name": "Mất quyền chủ động",
            "description": "Để đối thủ kiểm soát nhịp trận đấu",
            "pattern": [(7, 7), (8, 8), (5, 5)],
            "key_move": (7, 8),
        },
    ],
}


class LessonGenerator:
    """
    Generates mini lessons from mistakes.
    
    Task 8.6.2: Lesson Generation
    Impact: Learning từ mistakes
    """
    
    def __init__(self, board_size: int = BOARD_SIZE):
        """
        Initialize the LessonGenerator.
        
        Args:
            board_size: Size of the board (default 15x15)
        """
        self.board_size = board_size
        self.threat_detector = ThreatDetector(board_size)
        self.mistake_analyzer = MistakeAnalyzer(board_size)
    
    def generate_lesson(
        self,
        mistake: CategorizedMistake,
        board_before: List[List[Optional[str]]]
    ) -> MiniLesson:
        """
        Generate a mini lesson from a categorized mistake.
        
        Args:
            mistake: The categorized mistake
            board_before: Board state before the mistake
            
        Returns:
            MiniLesson with complete learning content
        """
        category = mistake.category
        templates = LESSON_TEMPLATES[category]
        
        # Generate title
        title = self._generate_title(mistake, templates)
        
        # Generate why wrong explanation
        why_wrong = self._generate_why_wrong(mistake, templates)
        
        # Generate what to do
        what_to_do = self._generate_what_to_do(mistake, templates)
        
        # Generate similar patterns
        similar_patterns = self._generate_similar_patterns(mistake, board_before)
        
        # Generate practice positions
        practice_positions = self._generate_practice_positions(mistake, board_before)
        
        # Get key takeaways
        key_takeaways = templates["key_takeaways"]
        
        # Determine difficulty
        difficulty = self._determine_difficulty(mistake)
        
        return MiniLesson(
            title=title,
            category=category,
            why_wrong=why_wrong,
            what_to_do=what_to_do,
            similar_patterns=similar_patterns,
            practice_positions=practice_positions,
            key_takeaways=key_takeaways,
            difficulty=difficulty,
        )

    def _generate_title(
        self,
        mistake: CategorizedMistake,
        templates: Dict[str, Any]
    ) -> str:
        """Generate lesson title based on mistake category and specifics."""
        category = mistake.category
        
        # Determine specific aspect
        if category == MistakeCategory.TACTICAL:
            if "Tứ Mở" in mistake.explanation or "OPEN_FOUR" in mistake.explanation:
                specific = "Nhận diện Tứ Mở"
            elif "chặn" in mistake.explanation.lower():
                specific = "Kỹ năng phòng thủ"
            elif "Ba Mở" in mistake.explanation or "OPEN_THREE" in mistake.explanation:
                specific = "Tận dụng Ba Mở"
            else:
                specific = "Nhận diện đe dọa"
        elif category == MistakeCategory.POSITIONAL:
            if "trung tâm" in mistake.explanation.lower():
                specific = "Kiểm soát trung tâm"
            elif "cô lập" in mistake.explanation.lower():
                specific = "Kết nối quân cờ"
            else:
                specific = "Chọn vị trí tốt"
        elif category == MistakeCategory.STRATEGIC:
            specific = "Phát triển đúng hướng"
        else:  # TEMPO
            specific = "Duy trì nhịp độ"
        
        return templates["title_template"].format(specific=specific)
    
    def _generate_why_wrong(
        self,
        mistake: CategorizedMistake,
        templates: Dict[str, Any]
    ) -> str:
        """Generate explanation of why the move was wrong."""
        category = mistake.category
        why_templates = templates["why_wrong_templates"]
        
        # Select appropriate template based on mistake details
        if category == MistakeCategory.TACTICAL:
            if "chặn" in mistake.explanation.lower():
                opportunity = "chặn đe dọa của đối thủ"
                action = "chặn đe dọa nguy hiểm"
            elif "Tứ" in mistake.explanation:
                opportunity = "tạo Tứ (4 quân liên tiếp)"
                action = "tạo đe dọa thắng"
            elif "Ba" in mistake.explanation:
                opportunity = "tạo Ba Mở"
                action = "tạo đe dọa kép"
            else:
                opportunity = "tấn công hoặc phòng thủ"
                action = "nhận ra đe dọa"
            
            base = why_templates[0].format(opportunity=opportunity)
        elif category == MistakeCategory.POSITIONAL:
            position = f"({mistake.position[0]},{mistake.position[1]})"
            base = why_templates[0].format(position=position)
        else:
            base = why_templates[0] if why_templates else mistake.explanation
        
        # Add specific context from the mistake
        return f"{base}\n\nChi tiết: {mistake.explanation}"
    
    def _generate_what_to_do(
        self,
        mistake: CategorizedMistake,
        templates: Dict[str, Any]
    ) -> str:
        """Generate advice on what to do instead."""
        what_templates = templates["what_to_do_templates"]
        
        # Combine template advice with specific recommendation
        base_advice = what_templates[0] if what_templates else ""
        specific_advice = f"\n\nTrong trường hợp này: {mistake.best_alternative_reason}"
        
        return f"{base_advice}{specific_advice}"
    
    def _generate_similar_patterns(
        self,
        mistake: CategorizedMistake,
        board_before: List[List[Optional[str]]]
    ) -> List[SimilarPattern]:
        """Generate similar patterns to avoid based on the mistake category."""
        category = mistake.category
        patterns_db = SIMILAR_PATTERNS_DB.get(category, [])
        
        similar_patterns = []
        for pattern_data in patterns_db[:2]:  # Limit to 2 patterns
            # Create example board
            example_board = [[None for _ in range(self.board_size)] 
                           for _ in range(self.board_size)]
            
            player = mistake.player
            for i, pos in enumerate(pattern_data["pattern"]):
                if 0 <= pos[0] < self.board_size and 0 <= pos[1] < self.board_size:
                    example_board[pos[0]][pos[1]] = player
            
            similar_patterns.append(SimilarPattern(
                name=pattern_data["name"],
                description=pattern_data["description"],
                example_board=example_board,
                key_positions=[pattern_data["key_move"]] if "key_move" in pattern_data else [],
            ))
        
        return similar_patterns
    
    def _generate_practice_positions(
        self,
        mistake: CategorizedMistake,
        board_before: List[List[Optional[str]]]
    ) -> List[PracticePosition]:
        """Generate practice positions from the mistake."""
        practice_positions = []
        category = mistake.category
        player = mistake.player
        
        # Create practice position based on the actual mistake
        practice_board = [row[:] for row in board_before]
        
        # Generate hint based on category
        if category == MistakeCategory.TACTICAL:
            hint = "Tìm nước đi tạo đe dọa hoặc chặn đe dọa của đối thủ"
        elif category == MistakeCategory.POSITIONAL:
            hint = "Tìm vị trí tốt nhất để đặt quân"
        elif category == MistakeCategory.STRATEGIC:
            hint = "Tìm hướng phát triển tốt nhất"
        else:  # TEMPO
            hint = "Tìm nước đi tạo áp lực, duy trì quyền chủ động"
        
        # Determine difficulty based on mistake severity
        if mistake.severity == "critical":
            difficulty = "easy"  # Critical mistakes are usually obvious
        elif mistake.severity == "major":
            difficulty = "medium"
        else:
            difficulty = "hard"  # Minor mistakes are subtle
        
        practice_positions.append(PracticePosition(
            board=practice_board,
            player_to_move=player,
            correct_move=mistake.best_alternative,
            hint=hint,
            difficulty=difficulty,
        ))
        
        # Generate additional practice positions based on category
        additional = self._generate_additional_practice(category, player)
        practice_positions.extend(additional[:1])  # Add 1 more practice position
        
        return practice_positions
    
    def _generate_additional_practice(
        self,
        category: MistakeCategory,
        player: str
    ) -> List[PracticePosition]:
        """Generate additional practice positions for the category."""
        additional = []
        opponent = "O" if player == "X" else "X"
        
        if category == MistakeCategory.TACTICAL:
            # Create a position where player can make OPEN_FOUR
            board = [[None for _ in range(self.board_size)] 
                    for _ in range(self.board_size)]
            board[7][5] = player
            board[7][6] = player
            board[7][7] = player
            # Correct move is (7, 4) or (7, 8) to create OPEN_FOUR
            
            additional.append(PracticePosition(
                board=board,
                player_to_move=player,
                correct_move=(7, 4),
                hint="Tìm nước đi tạo Tứ Mở (4 quân với 2 đầu trống)",
                difficulty="easy",
            ))
        
        elif category == MistakeCategory.POSITIONAL:
            # Create early game position
            board = [[None for _ in range(self.board_size)] 
                    for _ in range(self.board_size)]
            board[7][7] = opponent
            # Correct move is near center
            
            additional.append(PracticePosition(
                board=board,
                player_to_move=player,
                correct_move=(7, 8),
                hint="Chọn vị trí gần trung tâm để kiểm soát bàn cờ",
                difficulty="easy",
            ))
        
        elif category == MistakeCategory.STRATEGIC:
            # Create position with development direction
            board = [[None for _ in range(self.board_size)] 
                    for _ in range(self.board_size)]
            board[7][7] = player
            board[7][8] = player
            board[8][8] = opponent
            # Correct move continues development
            
            additional.append(PracticePosition(
                board=board,
                player_to_move=player,
                correct_move=(7, 9),
                hint="Tiếp tục phát triển theo hướng đã chọn",
                difficulty="medium",
            ))
        
        else:  # TEMPO
            # Create position where active play is needed
            board = [[None for _ in range(self.board_size)] 
                    for _ in range(self.board_size)]
            board[7][7] = player
            board[7][8] = player
            board[8][7] = opponent
            # Correct move creates pressure
            
            additional.append(PracticePosition(
                board=board,
                player_to_move=player,
                correct_move=(7, 6),
                hint="Tìm nước đi tạo đe dọa, buộc đối thủ phản ứng",
                difficulty="medium",
            ))
        
        return additional
    
    def _determine_difficulty(self, mistake: CategorizedMistake) -> str:
        """Determine lesson difficulty based on mistake characteristics."""
        # Critical tactical mistakes are usually beginner-level concepts
        if mistake.category == MistakeCategory.TACTICAL and mistake.severity == "critical":
            return "beginner"
        
        # Positional mistakes are intermediate
        if mistake.category == MistakeCategory.POSITIONAL:
            return "intermediate"
        
        # Strategic and tempo mistakes are more advanced
        if mistake.category in [MistakeCategory.STRATEGIC, MistakeCategory.TEMPO]:
            return "advanced"
        
        # Default based on severity
        if mistake.severity == "critical":
            return "beginner"
        elif mistake.severity == "major":
            return "intermediate"
        else:
            return "advanced"
    
    def generate_lessons_from_game(
        self,
        mistakes: List[CategorizedMistake],
        boards_before: List[List[List[Optional[str]]]]
    ) -> List[MiniLesson]:
        """
        Generate lessons from all mistakes in a game.
        
        Args:
            mistakes: List of categorized mistakes
            boards_before: List of board states before each mistake
            
        Returns:
            List of MiniLesson objects
        """
        lessons = []
        
        for i, mistake in enumerate(mistakes):
            if i < len(boards_before):
                board = boards_before[i]
            else:
                # Create empty board if not provided
                board = [[None for _ in range(self.board_size)] 
                        for _ in range(self.board_size)]
            
            lesson = self.generate_lesson(mistake, board)
            lessons.append(lesson)
        
        return lessons
    
    def get_lesson_summary(self, lessons: List[MiniLesson]) -> Dict[str, Any]:
        """
        Get a summary of all lessons.
        
        Args:
            lessons: List of lessons
            
        Returns:
            Summary dictionary with statistics and recommendations
        """
        if not lessons:
            return {
                "total_lessons": 0,
                "by_category": {},
                "by_difficulty": {},
                "main_weakness": None,
                "recommendation": "Không có sai lầm nào được phát hiện. Chơi tốt lắm!",
            }
        
        # Count by category
        by_category: Dict[str, int] = {}
        for lesson in lessons:
            cat_name = MISTAKE_CATEGORY_LABELS[lesson.category]
            by_category[cat_name] = by_category.get(cat_name, 0) + 1
        
        # Count by difficulty
        by_difficulty: Dict[str, int] = {}
        for lesson in lessons:
            by_difficulty[lesson.difficulty] = by_difficulty.get(lesson.difficulty, 0) + 1
        
        # Find main weakness
        main_weakness = max(by_category.keys(), key=lambda k: by_category[k])
        
        # Generate recommendation
        recommendation = self._generate_recommendation(main_weakness, by_category)
        
        return {
            "total_lessons": len(lessons),
            "by_category": by_category,
            "by_difficulty": by_difficulty,
            "main_weakness": main_weakness,
            "recommendation": recommendation,
        }
    
    def _generate_recommendation(
        self,
        main_weakness: str,
        by_category: Dict[str, int]
    ) -> str:
        """Generate personalized recommendation based on weaknesses."""
        recommendations = {
            "Chiến thuật": (
                "Bạn cần cải thiện kỹ năng nhận diện đe dọa. "
                "Hãy tập đếm quân liên tiếp và kiểm tra đe dọa trước mỗi nước đi."
            ),
            "Vị trí": (
                "Bạn cần chú ý hơn đến vị trí quân cờ. "
                "Ưu tiên trung tâm và giữ các quân kết nối với nhau."
            ),
            "Chiến lược": (
                "Bạn cần có kế hoạch rõ ràng hơn. "
                "Tập trung phát triển theo một hướng thay vì phân tán."
            ),
            "Nhịp độ": (
                "Bạn cần duy trì quyền chủ động tốt hơn. "
                "Mỗi nước đi nên tạo áp lực hoặc cải thiện vị trí."
            ),
        }
        
        return recommendations.get(
            main_weakness,
            "Tiếp tục luyện tập để cải thiện kỹ năng chơi Caro."
        )


# Convenience functions

def generate_lesson(
    mistake: CategorizedMistake,
    board_before: List[List[Optional[str]]]
) -> MiniLesson:
    """
    Convenience function to generate a lesson from a mistake.
    
    Args:
        mistake: The categorized mistake
        board_before: Board state before the mistake
        
    Returns:
        MiniLesson with complete learning content
    """
    generator = LessonGenerator()
    return generator.generate_lesson(mistake, board_before)


def generate_lessons_from_game(
    mistakes: List[CategorizedMistake],
    boards_before: List[List[List[Optional[str]]]]
) -> List[MiniLesson]:
    """
    Convenience function to generate lessons from all mistakes in a game.
    
    Args:
        mistakes: List of categorized mistakes
        boards_before: List of board states before each mistake
        
    Returns:
        List of MiniLesson objects
    """
    generator = LessonGenerator()
    return generator.generate_lessons_from_game(mistakes, boards_before)


def get_lesson_summary(lessons: List[MiniLesson]) -> Dict[str, Any]:
    """
    Convenience function to get lesson summary.
    
    Args:
        lessons: List of lessons
        
    Returns:
        Summary dictionary
    """
    generator = LessonGenerator()
    return generator.get_lesson_summary(lessons)
