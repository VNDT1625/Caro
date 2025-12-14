"""
Property-based tests for Game Metadata Handler.

Tests Properties 39, 40, 41 from the design document.
**Feature: gomoku-basic-analysis**
**Validates: Requirements 14.1, 14.2, 14.3, 14.4**
"""

import pytest
from hypothesis import given, strategies as st, settings, assume

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.game_metadata import (
    GameMetadata,
    GameMetadataHandler,
    GameType,
    RuleVariant,
    TimeControl,
    CommentComplexity,
    get_simple_term,
    SIMPLE_VOCABULARY
)


# =============================================================================
# Strategies for generating test data
# =============================================================================

@st.composite
def game_type_strategy(draw):
    """Generate random GameType."""
    return draw(st.sampled_from(list(GameType)))


@st.composite
def rule_variant_strategy(draw):
    """Generate random RuleVariant."""
    return draw(st.sampled_from(list(RuleVariant)))


@st.composite
def time_control_strategy(draw):
    """Generate random TimeControl."""
    return draw(st.sampled_from(list(TimeControl)))


@st.composite
def elo_strategy(draw):
    """Generate random ELO rating (800-2400 range)."""
    return draw(st.one_of(
        st.none(),
        st.integers(min_value=800, max_value=2400)
    ))


@st.composite
def game_metadata_strategy(draw):
    """Generate random GameMetadata."""
    return GameMetadata(
        game_type=draw(game_type_strategy()),
        rule_variant=draw(rule_variant_strategy()),
        time_control=draw(time_control_strategy()),
        white_elo=draw(elo_strategy()),
        black_elo=draw(elo_strategy()),
        result=draw(st.one_of(
            st.none(),
            st.sampled_from(["black_win", "white_win", "draw"])
        )),
        decisive_move=draw(st.one_of(
            st.none(),
            st.integers(min_value=5, max_value=225)
        ))
    )


@st.composite
def score_strategy(draw):
    """Generate random move score (0.0-10.0)."""
    return draw(st.floats(min_value=0.0, max_value=10.0, allow_nan=False))


# =============================================================================
# Property 39: Game Metadata Support
# **Validates: Requirements 14.1**
# =============================================================================

class TestProperty39GameMetadataSupport:
    """
    **Feature: gomoku-basic-analysis, Property 39: Game Metadata Support**
    **Validates: Requirements 14.1**
    
    For any analysis request with metadata, the system SHALL accept and process
    game_type, rule_variant, time_control, and player_elo fields.
    """
    
    @given(metadata=game_metadata_strategy())
    @settings(max_examples=100)
    def test_metadata_fields_accepted(self, metadata: GameMetadata):
        """
        **Feature: gomoku-basic-analysis, Property 39: Game Metadata Support**
        **Validates: Requirements 14.1**
        
        All metadata fields should be accepted and accessible.
        """
        handler = GameMetadataHandler(metadata)
        
        # Verify all fields are accessible
        assert handler.metadata.game_type in GameType
        assert handler.metadata.rule_variant in RuleVariant
        assert handler.metadata.time_control in TimeControl
        assert handler.metadata.white_elo is None or isinstance(handler.metadata.white_elo, int)
        assert handler.metadata.black_elo is None or isinstance(handler.metadata.black_elo, int)
    
    @given(metadata=game_metadata_strategy())
    @settings(max_examples=100)
    def test_metadata_serialization_roundtrip(self, metadata: GameMetadata):
        """
        **Feature: gomoku-basic-analysis, Property 39: Game Metadata Support**
        **Validates: Requirements 14.1**
        
        Metadata should serialize and deserialize correctly.
        """
        # Serialize
        data = metadata.to_dict()
        
        # Verify dict contains all fields
        assert "game_type" in data
        assert "rule_variant" in data
        assert "time_control" in data
        assert "white_elo" in data
        assert "black_elo" in data
        
        # Deserialize
        restored = GameMetadata.from_dict(data)
        
        # Verify roundtrip
        assert restored.game_type == metadata.game_type
        assert restored.rule_variant == metadata.rule_variant
        assert restored.time_control == metadata.time_control
        assert restored.white_elo == metadata.white_elo
        assert restored.black_elo == metadata.black_elo
    
    @given(
        game_type=game_type_strategy(),
        rule_variant=rule_variant_strategy(),
        time_control=time_control_strategy(),
        white_elo=elo_strategy(),
        black_elo=elo_strategy()
    )
    @settings(max_examples=100)
    def test_handler_accepts_all_combinations(
        self, game_type, rule_variant, time_control, white_elo, black_elo
    ):
        """
        **Feature: gomoku-basic-analysis, Property 39: Game Metadata Support**
        **Validates: Requirements 14.1**
        
        Handler should accept all valid combinations of metadata.
        """
        metadata = GameMetadata(
            game_type=game_type,
            rule_variant=rule_variant,
            time_control=time_control,
            white_elo=white_elo,
            black_elo=black_elo
        )
        
        handler = GameMetadataHandler(metadata)
        
        # Should not raise any exceptions
        _ = handler.get_strictness_multiplier()
        _ = handler.get_comment_complexity("X")
        _ = handler.get_comment_complexity("O")
        _ = handler.get_average_elo()


# =============================================================================
# Property 40: Context-Aware Strictness
# **Validates: Requirements 14.2, 14.3**
# =============================================================================

class TestProperty40ContextAwareStrictness:
    """
    **Feature: gomoku-basic-analysis, Property 40: Context-Aware Strictness**
    **Validates: Requirements 14.2, 14.3**
    
    For any tournament game, the mistake threshold SHALL be stricter than casual games.
    """
    
    @given(score=score_strategy())
    @settings(max_examples=100)
    def test_tournament_stricter_than_casual(self, score: float):
        """
        **Feature: gomoku-basic-analysis, Property 40: Context-Aware Strictness**
        **Validates: Requirements 14.2, 14.3**
        
        Tournament games should have stricter scoring than casual games.
        """
        tournament_handler = GameMetadataHandler(
            GameMetadata(game_type=GameType.TOURNAMENT)
        )
        casual_handler = GameMetadataHandler(
            GameMetadata(game_type=GameType.CASUAL)
        )
        
        tournament_multiplier = tournament_handler.get_strictness_multiplier()
        casual_multiplier = casual_handler.get_strictness_multiplier()
        
        # Tournament should be stricter (higher multiplier)
        assert tournament_multiplier > casual_multiplier
        assert tournament_multiplier == 1.2
        assert casual_multiplier == 0.8
    
    @given(score=st.floats(min_value=1.0, max_value=9.0, allow_nan=False))
    @settings(max_examples=100)
    def test_tournament_adjusted_score_lower(self, score: float):
        """
        **Feature: gomoku-basic-analysis, Property 40: Context-Aware Strictness**
        **Validates: Requirements 14.2, 14.3**
        
        For non-perfect scores, tournament adjusted score should be lower than casual.
        """
        tournament_handler = GameMetadataHandler(
            GameMetadata(game_type=GameType.TOURNAMENT)
        )
        casual_handler = GameMetadataHandler(
            GameMetadata(game_type=GameType.CASUAL)
        )
        
        tournament_adjusted = tournament_handler.adjust_score(score)
        casual_adjusted = casual_handler.adjust_score(score)
        
        # Tournament should give lower scores for same base score
        assert tournament_adjusted <= casual_adjusted
    
    @given(score=score_strategy())
    @settings(max_examples=100)
    def test_adjusted_score_in_valid_range(self, score: float):
        """
        **Feature: gomoku-basic-analysis, Property 40: Context-Aware Strictness**
        **Validates: Requirements 14.2, 14.3**
        
        Adjusted scores should always be in valid range [0, 10].
        """
        for game_type in GameType:
            handler = GameMetadataHandler(
                GameMetadata(game_type=game_type)
            )
            adjusted = handler.adjust_score(score)
            
            assert 0.0 <= adjusted <= 10.0
    
    def test_rating_thresholds_stricter_for_tournament(self):
        """
        **Feature: gomoku-basic-analysis, Property 40: Context-Aware Strictness**
        **Validates: Requirements 14.2, 14.3**
        
        Rating thresholds should be stricter for tournament games.
        """
        tournament_handler = GameMetadataHandler(
            GameMetadata(game_type=GameType.TOURNAMENT)
        )
        casual_handler = GameMetadataHandler(
            GameMetadata(game_type=GameType.CASUAL)
        )
        
        # Score 6.0 should be rated differently
        tournament_rating = tournament_handler.get_rating_for_score(6.0)
        casual_rating = casual_handler.get_rating_for_score(6.0)
        
        # In tournament, 6.0 is "average" (threshold 5.5)
        # In casual, 6.0 is "good" (threshold 6.5 for good, so 6.0 is average)
        # Actually let's check the thresholds
        assert tournament_handler.RATING_THRESHOLDS[GameType.TOURNAMENT]["excellent"] > \
               casual_handler.RATING_THRESHOLDS[GameType.CASUAL]["excellent"]


# =============================================================================
# Property 41: ELO-Based Comment Complexity
# **Validates: Requirements 14.4**
# =============================================================================

class TestProperty41ELOBasedCommentComplexity:
    """
    **Feature: gomoku-basic-analysis, Property 41: ELO-Based Comment Complexity**
    **Validates: Requirements 14.4**
    
    For any player with ELO < 1200, comments SHALL use simple vocabulary
    and avoid technical terms.
    """
    
    @given(elo=st.integers(min_value=800, max_value=1199))
    @settings(max_examples=100)
    def test_beginner_elo_gets_simple_comments(self, elo: int):
        """
        **Feature: gomoku-basic-analysis, Property 41: ELO-Based Comment Complexity**
        **Validates: Requirements 14.4**
        
        Players with ELO < 1200 should get beginner-level comments.
        """
        handler = GameMetadataHandler(
            GameMetadata(black_elo=elo, white_elo=elo)
        )
        
        complexity_x = handler.get_comment_complexity("X")
        complexity_o = handler.get_comment_complexity("O")
        
        assert complexity_x == CommentComplexity.BEGINNER
        assert complexity_o == CommentComplexity.BEGINNER
        assert handler.should_use_simple_vocabulary("X") is True
        assert handler.should_use_simple_vocabulary("O") is True
    
    @given(elo=st.integers(min_value=1200, max_value=1599))
    @settings(max_examples=100)
    def test_intermediate_elo_gets_intermediate_comments(self, elo: int):
        """
        **Feature: gomoku-basic-analysis, Property 41: ELO-Based Comment Complexity**
        **Validates: Requirements 14.4**
        
        Players with ELO 1200-1600 should get intermediate-level comments.
        """
        handler = GameMetadataHandler(
            GameMetadata(black_elo=elo, white_elo=elo)
        )
        
        complexity_x = handler.get_comment_complexity("X")
        complexity_o = handler.get_comment_complexity("O")
        
        assert complexity_x == CommentComplexity.INTERMEDIATE
        assert complexity_o == CommentComplexity.INTERMEDIATE
        assert handler.should_use_simple_vocabulary("X") is False
    
    @given(elo=st.integers(min_value=1600, max_value=2400))
    @settings(max_examples=100)
    def test_advanced_elo_gets_advanced_comments(self, elo: int):
        """
        **Feature: gomoku-basic-analysis, Property 41: ELO-Based Comment Complexity**
        **Validates: Requirements 14.4**
        
        Players with ELO > 1600 should get advanced-level comments.
        """
        handler = GameMetadataHandler(
            GameMetadata(black_elo=elo, white_elo=elo)
        )
        
        complexity_x = handler.get_comment_complexity("X")
        complexity_o = handler.get_comment_complexity("O")
        
        assert complexity_x == CommentComplexity.ADVANCED
        assert complexity_o == CommentComplexity.ADVANCED
        assert handler.should_use_simple_vocabulary("X") is False
    
    def test_no_elo_defaults_to_beginner(self):
        """
        **Feature: gomoku-basic-analysis, Property 41: ELO-Based Comment Complexity**
        **Validates: Requirements 14.4**
        
        When no ELO is provided, should default to beginner complexity.
        """
        handler = GameMetadataHandler(
            GameMetadata(black_elo=None, white_elo=None)
        )
        
        complexity_x = handler.get_comment_complexity("X")
        complexity_o = handler.get_comment_complexity("O")
        
        assert complexity_x == CommentComplexity.BEGINNER
        assert complexity_o == CommentComplexity.BEGINNER
    
    @given(
        black_elo=st.integers(min_value=800, max_value=1199),
        white_elo=st.integers(min_value=1600, max_value=2400)
    )
    @settings(max_examples=100)
    def test_different_elo_different_complexity(self, black_elo: int, white_elo: int):
        """
        **Feature: gomoku-basic-analysis, Property 41: ELO-Based Comment Complexity**
        **Validates: Requirements 14.4**
        
        Different players can have different comment complexity levels.
        """
        handler = GameMetadataHandler(
            GameMetadata(black_elo=black_elo, white_elo=white_elo)
        )
        
        complexity_x = handler.get_comment_complexity("X")  # Black
        complexity_o = handler.get_comment_complexity("O")  # White
        
        assert complexity_x == CommentComplexity.BEGINNER
        assert complexity_o == CommentComplexity.ADVANCED


# =============================================================================
# Additional Tests for Simple Vocabulary
# =============================================================================

class TestSimpleVocabulary:
    """Tests for simple vocabulary helper functions."""
    
    @given(language=st.sampled_from(["vi", "en", "zh", "ja"]))
    @settings(max_examples=20)
    def test_simple_vocabulary_available_for_all_languages(self, language: str):
        """All supported languages should have simple vocabulary."""
        assert language in SIMPLE_VOCABULARY
        
        # Check common terms exist
        vocab = SIMPLE_VOCABULARY[language]
        assert "fork" in vocab
        assert "open_four" in vocab
        assert "threat" in vocab
    
    @given(
        term=st.sampled_from(["fork", "open_four", "closed_four", "open_three", "threat"]),
        language=st.sampled_from(["vi", "en", "zh", "ja"])
    )
    @settings(max_examples=50)
    def test_get_simple_term_returns_string(self, term: str, language: str):
        """get_simple_term should always return a non-empty string."""
        result = get_simple_term(term, language)
        
        assert isinstance(result, str)
        assert len(result) > 0


# =============================================================================
# Additional Tests for Context Description
# =============================================================================

class TestContextDescription:
    """Tests for context description generation."""
    
    @given(
        game_type=game_type_strategy(),
        language=st.sampled_from(["vi", "en", "zh", "ja"])
    )
    @settings(max_examples=50)
    def test_context_description_returns_string(self, game_type, language: str):
        """Context description should return non-empty string for all combinations."""
        handler = GameMetadataHandler(
            GameMetadata(game_type=game_type)
        )
        
        description = handler.get_context_description(language)
        
        assert isinstance(description, str)
        assert len(description) > 0


# =============================================================================
# Additional Tests for Rule Variant Detection
# =============================================================================

class TestRuleVariantDetection:
    """Tests for rule variant detection."""
    
    def test_renju_rules_detection(self):
        """Should correctly detect Renju rules."""
        renju_handler = GameMetadataHandler(
            GameMetadata(rule_variant=RuleVariant.RENJU)
        )
        standard_handler = GameMetadataHandler(
            GameMetadata(rule_variant=RuleVariant.STANDARD)
        )
        
        assert renju_handler.is_renju_rules() is True
        assert standard_handler.is_renju_rules() is False
    
    def test_game_type_detection(self):
        """Should correctly detect game types."""
        tournament_handler = GameMetadataHandler(
            GameMetadata(game_type=GameType.TOURNAMENT)
        )
        casual_handler = GameMetadataHandler(
            GameMetadata(game_type=GameType.CASUAL)
        )
        
        assert tournament_handler.is_tournament_game() is True
        assert tournament_handler.is_casual_game() is False
        assert casual_handler.is_tournament_game() is False
        assert casual_handler.is_casual_game() is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
