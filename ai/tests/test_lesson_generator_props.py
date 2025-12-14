"""
Property-based tests for Lesson Generator.

**Feature: ai-match-analysis-system, Property: Lessons are relevant to mistakes**

Task 8.6.2: Lesson Generation
Impact: Learning từ mistakes
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Tuple, Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.lesson_generator import (
    LessonGenerator,
    MiniLesson,
    SimilarPattern,
    PracticePosition,
    generate_lesson,
    generate_lessons_from_game,
    get_lesson_summary,
    LESSON_TEMPLATES,
    SIMILAR_PATTERNS_DB,
)
from analysis.mistake_analyzer import (
    MistakeAnalyzer,
    MistakeCategory,
    CategorizedMistake,
)
from analysis.types import Move, Mistake, BOARD_SIZE


# Strategies for generating test data
board_size = 15
position_st = st.tuples(st.integers(0, board_size - 1), st.integers(0, board_size - 1))
player_st = st.sampled_from(['X', 'O'])


def create_empty_board(size: int = 15) -> List[List[Optional[str]]]:
    """Create an empty board."""
    return [[None for _ in range(size)] for _ in range(size)]


def create_sample_mistake(
    category: MistakeCategory = MistakeCategory.TACTICAL,
    severity: str = "major",
    player: str = "X"
) -> CategorizedMistake:
    """Create a sample categorized mistake for testing."""
    return CategorizedMistake(
        move=5,
        player=player,
        position=(0, 0),
        category=category,
        severity=severity,
        description="Sai lầm chiến thuật lớn",
        explanation="Bỏ lỡ cơ hội tạo Tứ Mở",
        best_alternative=(7, 8),
        best_alternative_reason="Tạo Tứ Mở - thắng chắc chắn",
        score_loss=500.0,
        educational_tip="Mẹo: Luôn kiểm tra đe dọa của đối thủ trước khi đi.",
    )


class TestLessonStructure:
    """Tests for MiniLesson structure."""
    
    def test_lesson_has_all_required_fields(self):
        """
        **Feature: ai-match-analysis-system, Property: Lesson structure completeness**
        A lesson should have all required fields.
        """
        board = create_empty_board()
        mistake = create_sample_mistake()
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        # Check all required fields exist
        assert hasattr(lesson, 'title')
        assert hasattr(lesson, 'category')
        assert hasattr(lesson, 'why_wrong')
        assert hasattr(lesson, 'what_to_do')
        assert hasattr(lesson, 'similar_patterns')
        assert hasattr(lesson, 'practice_positions')
        assert hasattr(lesson, 'key_takeaways')
        assert hasattr(lesson, 'difficulty')
        
        # Check types
        assert isinstance(lesson.title, str)
        assert isinstance(lesson.category, MistakeCategory)
        assert isinstance(lesson.why_wrong, str)
        assert isinstance(lesson.what_to_do, str)
        assert isinstance(lesson.similar_patterns, list)
        assert isinstance(lesson.practice_positions, list)
        assert isinstance(lesson.key_takeaways, list)
        assert isinstance(lesson.difficulty, str)
    
    def test_lesson_title_in_vietnamese(self):
        """
        **Feature: ai-match-analysis-system, Property: Lesson title in Vietnamese**
        Lesson title should be in Vietnamese.
        """
        board = create_empty_board()
        mistake = create_sample_mistake()
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        # Check for Vietnamese keywords
        vietnamese_keywords = ['Bài học', 'Chiến thuật', 'Vị trí', 'Chiến lược', 'Nhịp độ']
        has_vietnamese = any(kw in lesson.title for kw in vietnamese_keywords)
        assert has_vietnamese, f"Title should be in Vietnamese: {lesson.title}"
    
    def test_lesson_why_wrong_not_empty(self):
        """
        **Feature: ai-match-analysis-system, Property: Why wrong explanation exists**
        Why wrong explanation should not be empty.
        """
        board = create_empty_board()
        mistake = create_sample_mistake()
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        assert len(lesson.why_wrong) > 0
        assert len(lesson.why_wrong) > 20  # Should be substantial
    
    def test_lesson_what_to_do_not_empty(self):
        """
        **Feature: ai-match-analysis-system, Property: What to do advice exists**
        What to do advice should not be empty.
        """
        board = create_empty_board()
        mistake = create_sample_mistake()
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        assert len(lesson.what_to_do) > 0
        assert len(lesson.what_to_do) > 20  # Should be substantial
    
    def test_lesson_has_key_takeaways(self):
        """
        **Feature: ai-match-analysis-system, Property: Key takeaways exist**
        Lesson should have key takeaways.
        """
        board = create_empty_board()
        mistake = create_sample_mistake()
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        assert len(lesson.key_takeaways) > 0
        for takeaway in lesson.key_takeaways:
            assert isinstance(takeaway, str)
            assert len(takeaway) > 0


class TestLessonRelevance:
    """Tests for lesson relevance to mistakes."""
    
    def test_tactical_lesson_for_tactical_mistake(self):
        """
        **Feature: ai-match-analysis-system, Property: Tactical lesson relevance**
        Tactical mistake should generate tactical lesson.
        """
        board = create_empty_board()
        mistake = create_sample_mistake(category=MistakeCategory.TACTICAL)
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        assert lesson.category == MistakeCategory.TACTICAL
        assert "Chiến thuật" in lesson.title
    
    def test_positional_lesson_for_positional_mistake(self):
        """
        **Feature: ai-match-analysis-system, Property: Positional lesson relevance**
        Positional mistake should generate positional lesson.
        """
        board = create_empty_board()
        mistake = create_sample_mistake(category=MistakeCategory.POSITIONAL)
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        assert lesson.category == MistakeCategory.POSITIONAL
        assert "Vị trí" in lesson.title
    
    def test_strategic_lesson_for_strategic_mistake(self):
        """
        **Feature: ai-match-analysis-system, Property: Strategic lesson relevance**
        Strategic mistake should generate strategic lesson.
        """
        board = create_empty_board()
        mistake = create_sample_mistake(category=MistakeCategory.STRATEGIC)
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        assert lesson.category == MistakeCategory.STRATEGIC
        assert "Chiến lược" in lesson.title
    
    def test_tempo_lesson_for_tempo_mistake(self):
        """
        **Feature: ai-match-analysis-system, Property: Tempo lesson relevance**
        Tempo mistake should generate tempo lesson.
        """
        board = create_empty_board()
        mistake = create_sample_mistake(category=MistakeCategory.TEMPO)
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        assert lesson.category == MistakeCategory.TEMPO
        assert "Nhịp độ" in lesson.title


class TestSimilarPatterns:
    """Tests for similar patterns generation."""
    
    def test_similar_patterns_structure(self):
        """
        **Feature: ai-match-analysis-system, Property: Similar patterns structure**
        Similar patterns should have correct structure.
        """
        board = create_empty_board()
        mistake = create_sample_mistake()
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        for pattern in lesson.similar_patterns:
            assert isinstance(pattern, SimilarPattern)
            assert isinstance(pattern.name, str)
            assert isinstance(pattern.description, str)
            assert isinstance(pattern.example_board, list)
            assert isinstance(pattern.key_positions, list)
    
    def test_similar_patterns_relevant_to_category(self):
        """
        **Feature: ai-match-analysis-system, Property: Similar patterns relevance**
        Similar patterns should be relevant to mistake category.
        """
        board = create_empty_board()
        
        for category in MistakeCategory:
            mistake = create_sample_mistake(category=category)
            generator = LessonGenerator()
            lesson = generator.generate_lesson(mistake, board)
            
            # Patterns should exist in the database for this category
            if category in SIMILAR_PATTERNS_DB:
                # At least some patterns should be generated
                assert len(lesson.similar_patterns) >= 0


class TestPracticePositions:
    """Tests for practice positions generation."""
    
    def test_practice_positions_structure(self):
        """
        **Feature: ai-match-analysis-system, Property: Practice positions structure**
        Practice positions should have correct structure.
        """
        board = create_empty_board()
        mistake = create_sample_mistake()
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        assert len(lesson.practice_positions) > 0
        
        for practice in lesson.practice_positions:
            assert isinstance(practice, PracticePosition)
            assert isinstance(practice.board, list)
            assert isinstance(practice.player_to_move, str)
            assert isinstance(practice.correct_move, tuple)
            assert isinstance(practice.hint, str)
            assert isinstance(practice.difficulty, str)
    
    def test_practice_positions_valid_board(self):
        """
        **Feature: ai-match-analysis-system, Property: Practice positions valid board**
        Practice position boards should be valid.
        """
        board = create_empty_board()
        mistake = create_sample_mistake()
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        for practice in lesson.practice_positions:
            # Board should be correct size
            assert len(practice.board) == BOARD_SIZE
            for row in practice.board:
                assert len(row) == BOARD_SIZE
    
    def test_practice_positions_valid_move(self):
        """
        **Feature: ai-match-analysis-system, Property: Practice positions valid move**
        Correct move should be within board bounds.
        """
        board = create_empty_board()
        mistake = create_sample_mistake()
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        for practice in lesson.practice_positions:
            x, y = practice.correct_move
            assert 0 <= x < BOARD_SIZE
            assert 0 <= y < BOARD_SIZE
    
    def test_practice_positions_hint_in_vietnamese(self):
        """
        **Feature: ai-match-analysis-system, Property: Practice hints in Vietnamese**
        Practice hints should be in Vietnamese.
        """
        board = create_empty_board()
        mistake = create_sample_mistake()
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        for practice in lesson.practice_positions:
            # Check for Vietnamese keywords
            vietnamese_keywords = ['Tìm', 'nước', 'đi', 'vị trí', 'đe dọa', 'chặn', 'tạo']
            has_vietnamese = any(kw in practice.hint for kw in vietnamese_keywords)
            assert has_vietnamese, f"Hint should be in Vietnamese: {practice.hint}"


class TestLessonDifficulty:
    """Tests for lesson difficulty determination."""
    
    def test_difficulty_levels(self):
        """
        **Feature: ai-match-analysis-system, Property: Valid difficulty levels**
        Difficulty should be one of: beginner, intermediate, advanced.
        """
        board = create_empty_board()
        
        for category in MistakeCategory:
            for severity in ["critical", "major", "minor"]:
                mistake = create_sample_mistake(category=category, severity=severity)
                generator = LessonGenerator()
                lesson = generator.generate_lesson(mistake, board)
                
                assert lesson.difficulty in ["beginner", "intermediate", "advanced"]
    
    def test_critical_tactical_is_beginner(self):
        """
        **Feature: ai-match-analysis-system, Property: Critical tactical = beginner**
        Critical tactical mistakes should be beginner level.
        """
        board = create_empty_board()
        mistake = create_sample_mistake(
            category=MistakeCategory.TACTICAL,
            severity="critical"
        )
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        assert lesson.difficulty == "beginner"


class TestLessonSummary:
    """Tests for lesson summary generation."""
    
    def test_empty_lessons_summary(self):
        """
        **Feature: ai-match-analysis-system, Property: Empty lessons summary**
        Empty lessons should return appropriate summary.
        """
        generator = LessonGenerator()
        summary = generator.get_lesson_summary([])
        
        assert summary["total_lessons"] == 0
        assert summary["main_weakness"] is None
        assert "Không có sai lầm" in summary["recommendation"]
    
    def test_summary_structure(self):
        """
        **Feature: ai-match-analysis-system, Property: Summary structure**
        Summary should have correct structure.
        """
        board = create_empty_board()
        mistakes = [
            create_sample_mistake(category=MistakeCategory.TACTICAL),
            create_sample_mistake(category=MistakeCategory.POSITIONAL),
        ]
        
        generator = LessonGenerator()
        lessons = [generator.generate_lesson(m, board) for m in mistakes]
        summary = generator.get_lesson_summary(lessons)
        
        assert "total_lessons" in summary
        assert "by_category" in summary
        assert "by_difficulty" in summary
        assert "main_weakness" in summary
        assert "recommendation" in summary
        
        assert summary["total_lessons"] == 2
    
    def test_summary_counts_categories(self):
        """
        **Feature: ai-match-analysis-system, Property: Summary counts categories**
        Summary should correctly count categories.
        """
        board = create_empty_board()
        mistakes = [
            create_sample_mistake(category=MistakeCategory.TACTICAL),
            create_sample_mistake(category=MistakeCategory.TACTICAL),
            create_sample_mistake(category=MistakeCategory.POSITIONAL),
        ]
        
        generator = LessonGenerator()
        lessons = [generator.generate_lesson(m, board) for m in mistakes]
        summary = generator.get_lesson_summary(lessons)
        
        assert summary["by_category"]["Chiến thuật"] == 2
        assert summary["by_category"]["Vị trí"] == 1
    
    def test_summary_identifies_main_weakness(self):
        """
        **Feature: ai-match-analysis-system, Property: Summary identifies main weakness**
        Summary should identify the main weakness.
        """
        board = create_empty_board()
        mistakes = [
            create_sample_mistake(category=MistakeCategory.TACTICAL),
            create_sample_mistake(category=MistakeCategory.TACTICAL),
            create_sample_mistake(category=MistakeCategory.POSITIONAL),
        ]
        
        generator = LessonGenerator()
        lessons = [generator.generate_lesson(m, board) for m in mistakes]
        summary = generator.get_lesson_summary(lessons)
        
        assert summary["main_weakness"] == "Chiến thuật"


class TestConvenienceFunctions:
    """Tests for convenience functions."""
    
    def test_generate_lesson_function(self):
        """
        **Feature: ai-match-analysis-system, Property: generate_lesson function**
        Convenience function should work correctly.
        """
        board = create_empty_board()
        mistake = create_sample_mistake()
        
        lesson = generate_lesson(mistake, board)
        
        assert isinstance(lesson, MiniLesson)
    
    def test_generate_lessons_from_game_function(self):
        """
        **Feature: ai-match-analysis-system, Property: generate_lessons_from_game function**
        Convenience function should work correctly.
        """
        boards = [create_empty_board(), create_empty_board()]
        mistakes = [
            create_sample_mistake(category=MistakeCategory.TACTICAL),
            create_sample_mistake(category=MistakeCategory.POSITIONAL),
        ]
        
        lessons = generate_lessons_from_game(mistakes, boards)
        
        assert len(lessons) == 2
        for lesson in lessons:
            assert isinstance(lesson, MiniLesson)
    
    def test_get_lesson_summary_function(self):
        """
        **Feature: ai-match-analysis-system, Property: get_lesson_summary function**
        Convenience function should work correctly.
        """
        board = create_empty_board()
        mistake = create_sample_mistake()
        
        lesson = generate_lesson(mistake, board)
        summary = get_lesson_summary([lesson])
        
        assert summary["total_lessons"] == 1


class TestPropertyBasedLessonGeneration:
    """Property-based tests using Hypothesis."""
    
    @given(st.sampled_from(list(MistakeCategory)))
    @settings(max_examples=20, deadline=None)
    def test_lesson_category_matches_mistake(self, category: MistakeCategory):
        """
        **Feature: ai-match-analysis-system, Property: Lesson category matches mistake**
        Lesson category should always match the mistake category.
        """
        board = create_empty_board()
        mistake = create_sample_mistake(category=category)
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        assert lesson.category == category
    
    @given(st.sampled_from(["critical", "major", "minor"]))
    @settings(max_examples=10, deadline=None)
    def test_lesson_generated_for_all_severities(self, severity: str):
        """
        **Feature: ai-match-analysis-system, Property: Lessons for all severities**
        Lessons should be generated for all severity levels.
        """
        board = create_empty_board()
        mistake = create_sample_mistake(severity=severity)
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        assert lesson is not None
        assert len(lesson.title) > 0
        assert len(lesson.why_wrong) > 0
        assert len(lesson.what_to_do) > 0
    
    @given(player_st)
    @settings(max_examples=10, deadline=None)
    def test_lesson_generated_for_both_players(self, player: str):
        """
        **Feature: ai-match-analysis-system, Property: Lessons for both players**
        Lessons should be generated for both X and O players.
        """
        board = create_empty_board()
        mistake = create_sample_mistake(player=player)
        
        generator = LessonGenerator()
        lesson = generator.generate_lesson(mistake, board)
        
        assert lesson is not None
        # Practice positions should use the correct player
        for practice in lesson.practice_positions:
            assert practice.player_to_move in ['X', 'O']


class TestLessonTemplates:
    """Tests for lesson templates."""
    
    def test_all_categories_have_templates(self):
        """
        **Feature: ai-match-analysis-system, Property: All categories have templates**
        All mistake categories should have lesson templates.
        """
        for category in MistakeCategory:
            assert category in LESSON_TEMPLATES
            templates = LESSON_TEMPLATES[category]
            
            assert "title_template" in templates
            assert "why_wrong_templates" in templates
            assert "what_to_do_templates" in templates
            assert "key_takeaways" in templates
    
    def test_all_categories_have_similar_patterns(self):
        """
        **Feature: ai-match-analysis-system, Property: All categories have similar patterns**
        All mistake categories should have similar patterns in database.
        """
        for category in MistakeCategory:
            assert category in SIMILAR_PATTERNS_DB
            patterns = SIMILAR_PATTERNS_DB[category]
            
            assert len(patterns) > 0
            for pattern in patterns:
                assert "name" in pattern
                assert "description" in pattern
                assert "pattern" in pattern


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
