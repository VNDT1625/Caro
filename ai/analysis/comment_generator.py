"""
AI Match Analysis System - Multi-Language Comment Generator

This module implements the CommentGenerator class for generating
move comments in multiple languages (vi, en, zh, ja).

Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
- 4.1: Generate comments in 4 languages (vi, en, zh, ja)
- 4.2: Template-based comment generation
- 4.3: Context-aware comments based on move quality
- 4.4: Threat type labels in all languages
- 4.5: Natural language flow
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from enum import Enum

from .types import (
    ThreatType,
    MoveClassification,
    BOARD_SIZE,
)


# Supported languages
SUPPORTED_LANGUAGES = ["vi", "en", "zh", "ja"]


@dataclass
class MultiLangComment:
    """
    Comment in all supported languages.
    
    Attributes:
        vi: Vietnamese comment
        en: English comment
        zh: Chinese comment
        ja: Japanese comment
    """
    vi: str
    en: str
    zh: str
    ja: str
    
    def get(self, lang: str) -> str:
        """Get comment in specified language."""
        return getattr(self, lang, self.en)
    
    def to_dict(self) -> Dict[str, str]:
        """Convert to dictionary."""
        return {"vi": self.vi, "en": self.en, "zh": self.zh, "ja": self.ja}


# Threat type labels in all languages (Requirement 4.4)
THREAT_LABELS: Dict[ThreatType, Dict[str, str]] = {
    ThreatType.FIVE: {
        "vi": "Năm liên tiếp",
        "en": "Five in a row",
        "zh": "五连",
        "ja": "五連",
    },
    ThreatType.OPEN_FOUR: {
        "vi": "Tứ mở",
        "en": "Open four",
        "zh": "活四",
        "ja": "活四",
    },
    ThreatType.FOUR: {
        "vi": "Tứ chặn",
        "en": "Blocked four",
        "zh": "冲四",
        "ja": "四",
    },
    ThreatType.BROKEN_FOUR: {
        "vi": "Tứ gãy",
        "en": "Broken four",
        "zh": "跳四",
        "ja": "飛び四",
    },
    ThreatType.OPEN_THREE: {
        "vi": "Tam mở",
        "en": "Open three",
        "zh": "活三",
        "ja": "活三",
    },
    ThreatType.THREE: {
        "vi": "Tam chặn",
        "en": "Blocked three",
        "zh": "眠三",
        "ja": "三",
    },
    ThreatType.BROKEN_THREE: {
        "vi": "Tam gãy",
        "en": "Broken three",
        "zh": "跳三",
        "ja": "飛び三",
    },
    ThreatType.JUMP_THREE: {
        "vi": "Tam nhảy",
        "en": "Jump three",
        "zh": "跳活三",
        "ja": "飛び活三",
    },
    ThreatType.OPEN_TWO: {
        "vi": "Nhị mở",
        "en": "Open two",
        "zh": "活二",
        "ja": "活二",
    },
}


# Move classification labels
CLASSIFICATION_LABELS: Dict[MoveClassification, Dict[str, str]] = {
    MoveClassification.EXCELLENT: {
        "vi": "Xuất sắc",
        "en": "Excellent",
        "zh": "精彩",
        "ja": "素晴らしい",
    },
    MoveClassification.GOOD: {
        "vi": "Tốt",
        "en": "Good",
        "zh": "好棋",
        "ja": "良い",
    },
    MoveClassification.OKAY: {
        "vi": "Chấp nhận được",
        "en": "Okay",
        "zh": "可以",
        "ja": "まあまあ",
    },
    MoveClassification.WEAK: {
        "vi": "Yếu",
        "en": "Weak",
        "zh": "弱",
        "ja": "弱い",
    },
    MoveClassification.BLUNDER: {
        "vi": "Sai lầm",
        "en": "Blunder",
        "zh": "失误",
        "ja": "悪手",
    },
}


# Cultural idioms for special scenarios (Requirement 22.x)
CULTURAL_IDIOMS: Dict[str, Dict[str, str]] = {
    "fork": {
        "vi": "Nước đôi “một tên trúng hai đích”.",
        "en": "Classic fork—one stone threatens two.",
        "zh": "一子多攻，左右逢源。",
        "ja": "一手で二面待ち、二兎を追う妙手。"
    },
    "missed_win": {
        "vi": "Lỡ chuyến đò thắng lợi, bỏ qua cơ hội vàng.",
        "en": "Missed the winning train—golden chance slipped.",
        "zh": "胜机在手却未把握，十分可惜。",
        "ja": "勝ち筋を見逃したのは痛恨。"
    },
    "brave_defense": {
        "vi": "Thủ như đắp đê, kiên trì giữ vững.",
        "en": "Stonewall defense—held the line firmly.",
        "zh": "如筑堤般的防守，稳住了局面。",
        "ja": "堤防のように守り切った。"
    }
}

# Comment templates for different situations
COMMENT_TEMPLATES: Dict[str, Dict[str, str]] = {
    # Winning move
    "winning_move": {
        "vi": "Nước đi chiến thắng! Tạo {threat} để kết thúc ván đấu.",
        "en": "Winning move! Creates {threat} to end the game.",
        "zh": "制胜一击！形成{threat}结束比赛。",
        "ja": "勝利の一手！{threat}を作って勝利。",
    },
    # Creates threat
    "creates_threat": {
        "vi": "Tạo {threat}, đe dọa đối thủ.",
        "en": "Creates {threat}, threatening the opponent.",
        "zh": "形成{threat}，威胁对手。",
        "ja": "{threat}を作り、相手を脅かす。",
    },
    # Blocks threat
    "blocks_threat": {
        "vi": "Chặn {threat} của đối thủ.",
        "en": "Blocks opponent's {threat}.",
        "zh": "阻挡对手的{threat}。",
        "ja": "相手の{threat}をブロック。",
    },
    # Creates and blocks
    "creates_and_blocks": {
        "vi": "Vừa tạo {own_threat} vừa chặn {opp_threat}.",
        "en": "Creates {own_threat} while blocking {opp_threat}.",
        "zh": "形成{own_threat}同时阻挡{opp_threat}。",
        "ja": "{own_threat}を作りながら{opp_threat}をブロック。",
    },
    # Missed win
    "missed_win": {
        "vi": "Bỏ lỡ cơ hội thắng! Nên đánh {better_move} để tạo {threat}.",
        "en": "Missed winning opportunity! Should play {better_move} for {threat}.",
        "zh": "错失胜机！应该下{better_move}形成{threat}。",
        "ja": "勝機を逃した！{better_move}で{threat}を作るべき。",
    },
    # Blunder
    "blunder": {
        "vi": "Sai lầm nghiêm trọng! {reason}",
        "en": "Serious blunder! {reason}",
        "zh": "严重失误！{reason}",
        "ja": "大悪手！{reason}",
    },
    # Developing move
    "developing": {
        "vi": "Nước đi phát triển, chuẩn bị cho các đe dọa sau.",
        "en": "Developing move, preparing future threats.",
        "zh": "发展棋，为后续威胁做准备。",
        "ja": "展開の一手、将来の脅威を準備。",
    },
    # Center control
    "center_control": {
        "vi": "Kiểm soát trung tâm, vị trí chiến lược tốt.",
        "en": "Controls the center, good strategic position.",
        "zh": "控制中心，战略位置良好。",
        "ja": "中央を制御、良い戦略的位置。",
    },
    # Passive move
    "passive": {
        "vi": "Nước đi thụ động, không tạo đe dọa.",
        "en": "Passive move, creates no threats.",
        "zh": "被动棋，没有形成威胁。",
        "ja": "消極的な手、脅威を作らない。",
    },
    # Fork creation
    "fork": {
        "vi": "Tạo nhánh đôi! Đối thủ không thể chặn cả hai.",
        "en": "Creates a fork! Opponent cannot block both threats.",
        "zh": "形成双杀！对手无法同时阻挡。",
        "ja": "フォーク！相手は両方をブロックできない。",
    },
    # Forced response
    "forced": {
        "vi": "Nước đi bắt buộc để chặn {threat}.",
        "en": "Forced move to block {threat}.",
        "zh": "必须下的棋，阻挡{threat}。",
        "ja": "{threat}をブロックする必須の手。",
    },
}


class CommentGenerator:
    """
    Generates move comments in multiple languages.
    
    Uses template-based generation with context-aware selection
    to produce natural-sounding comments.
    
    Requirements:
    - 4.1: Multi-language support (vi, en, zh, ja)
    - 4.2: Template-based generation
    - 4.3: Context-aware comments
    - 4.4: Threat type labels
    - 4.5: Natural language flow
    """
    
    def __init__(self):
        """Initialize the CommentGenerator."""
        self.templates = COMMENT_TEMPLATES
        self.threat_labels = THREAT_LABELS
        self.classification_labels = CLASSIFICATION_LABELS
    
    def generate_comment(
        self,
        classification: MoveClassification,
        threats_created: List[ThreatType],
        threats_blocked: List[ThreatType],
        is_winning: bool = False,
        is_forced: bool = False,
        better_move: Optional[str] = None,
        language: str = "vi"
    ) -> str:
        """
        Generate a comment for a move in the specified language.
        
        Args:
            classification: Move classification
            threats_created: List of threats created by the move
            threats_blocked: List of opponent threats blocked
            is_winning: Whether this is a winning move
            is_forced: Whether this was a forced response
            better_move: Better alternative move notation (if any)
            language: Target language code
            
        Returns:
            Comment string in the specified language
            
        Requirement: 4.1
        """
        if language not in SUPPORTED_LANGUAGES:
            language = "en"
        
        # Winning move
        if is_winning and ThreatType.FIVE in threats_created:
            threat_label = self._get_threat_label(ThreatType.FIVE, language)
            return self._format_template("winning_move", language, threat=threat_label)
        
        # Forced response
        if is_forced and threats_blocked:
            threat_label = self._get_threat_label(threats_blocked[0], language)
            return self._format_template("forced", language, threat=threat_label)
        
        # Blunder with better alternative
        if classification == MoveClassification.BLUNDER and better_move:
            if threats_created:
                threat_label = self._get_threat_label(threats_created[0], language)
                return self._format_template(
                    "missed_win", language,
                    better_move=better_move, threat=threat_label
                )
            else:
                reason = self._get_blunder_reason(threats_blocked, language)
                return self._format_template("blunder", language, reason=reason)
        
        # Creates and blocks
        if threats_created and threats_blocked:
            own_threat = self._get_threat_label(threats_created[0], language)
            opp_threat = self._get_threat_label(threats_blocked[0], language)
            return self._format_template(
                "creates_and_blocks", language,
                own_threat=own_threat, opp_threat=opp_threat
            )
        
        # Fork creation (multiple high-level threats)
        high_threats = [t for t in threats_created if t in [
            ThreatType.OPEN_FOUR, ThreatType.FOUR, ThreatType.BROKEN_FOUR
        ]]
        if len(high_threats) >= 2:
            return self._format_template("fork", language)
        
        # Creates threat
        if threats_created:
            threat_label = self._get_threat_label(threats_created[0], language)
            return self._format_template("creates_threat", language, threat=threat_label)
        
        # Blocks threat
        if threats_blocked:
            threat_label = self._get_threat_label(threats_blocked[0], language)
            return self._format_template("blocks_threat", language, threat=threat_label)
        
        # Developing or passive based on classification
        if classification in [MoveClassification.EXCELLENT, MoveClassification.GOOD]:
            return self._format_template("developing", language)
        elif classification == MoveClassification.OKAY:
            return self._format_template("center_control", language)
        else:
            return self._format_template("passive", language)
    
    def generate_all_languages(
        self,
        classification: MoveClassification,
        threats_created: List[ThreatType],
        threats_blocked: List[ThreatType],
        is_winning: bool = False,
        is_forced: bool = False,
        better_move: Optional[str] = None,
        scenario: Optional[str] = None,
        use_cultural: bool = False
    ) -> MultiLangComment:
        """
        Generate comments in all supported languages.
        
        Args:
            classification: Move classification
            threats_created: List of threats created
            threats_blocked: List of threats blocked
            is_winning: Whether this is a winning move
            is_forced: Whether this was forced
            better_move: Better alternative (if any)
            
        Returns:
            MultiLangComment with comments in all languages
            
        Requirement: 4.1
        """
        comments = {}
        for lang in SUPPORTED_LANGUAGES:
            base_text = self.generate_comment(
                classification=classification,
                threats_created=threats_created,
                threats_blocked=threats_blocked,
                is_winning=is_winning,
                is_forced=is_forced,
                better_move=better_move,
                language=lang
            )
            if use_cultural and scenario:
                idiom = self.get_cultural_idiom(scenario, lang)
                if idiom:
                    base_text = f"{base_text} {idiom}"
            comments[lang] = base_text
        
        return MultiLangComment(**comments)
    
    def _get_threat_label(self, threat_type: ThreatType, language: str) -> str:
        """Get threat type label in specified language."""
        labels = self.threat_labels.get(threat_type, {})
        return labels.get(language, labels.get("en", str(threat_type.value)))
    
    def _get_classification_label(
        self, classification: MoveClassification, language: str
    ) -> str:
        """Get classification label in specified language."""
        labels = self.classification_labels.get(classification, {})
        return labels.get(language, labels.get("en", str(classification.value)))
    
    def _format_template(
        self, template_key: str, language: str, **kwargs
    ) -> str:
        """Format a template with the given parameters."""
        template = self.templates.get(template_key, {})
        text = template.get(language, template.get("en", ""))
        
        try:
            return text.format(**kwargs)
        except KeyError:
            return text
    
    def _get_blunder_reason(
        self, threats_blocked: List[ThreatType], language: str
    ) -> str:
        """Generate reason for blunder."""
        reasons = {
            "vi": "Không chặn đe dọa của đối thủ",
            "en": "Failed to block opponent's threat",
            "zh": "未能阻挡对手威胁",
            "ja": "相手の脅威をブロックできなかった",
        }
        return reasons.get(language, reasons["en"])
    
    def get_threat_label(self, threat_type: ThreatType, language: str = "vi") -> str:
        """
        Public method to get threat label.
        
        Args:
            threat_type: The threat type
            language: Target language
            
        Returns:
            Localized threat label
            
        Requirement: 4.4
        """
        return self._get_threat_label(threat_type, language)
    
    def get_all_threat_labels(self, language: str = "vi") -> Dict[str, str]:
        """
        Get all threat labels in specified language.
        
        Args:
            language: Target language
            
        Returns:
            Dictionary mapping threat type values to labels
        """
        return {
            threat_type.value: self._get_threat_label(threat_type, language)
            for threat_type in ThreatType
        }

    def get_cultural_idiom(self, scenario: str, language: str = "vi") -> str:
        """Return cultural idiom for a scenario if available."""
        idioms = CULTURAL_IDIOMS.get(scenario, {})
        return idioms.get(language, idioms.get("en", ""))
