"""
AI Match Analysis System - FastAPI Main Application

This module provides the REST API endpoints for the AI analysis system,
including match analysis, AI Q&A, replay sessions, and usage tracking.

Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 17.1-17.5 (Error Handling)
"""

import sys
import os
import time
import re
import asyncio
from typing import List, Literal, Optional, Dict, Any
from datetime import datetime, date

from fastapi import FastAPI, HTTPException, status, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

# Ensure the ai directory is in the path for imports
AI_DIR = os.path.dirname(os.path.abspath(__file__))
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

# Import analysis modules
from analysis.types import (
    Move as AnalysisMove,
    SubscriptionTier,
    FeatureType,
    USAGE_LIMITS,
    MoveClassification,
    ThreatType,
)
from analysis.basic_analyzer import BasicAnalyzer
from analysis.pro_analyzer import ProAnalyzer
from analysis.redis_cache import get_cache, RedisCache
from replay.replay_engine import ReplayEngine
from analysis.comment_generator import CommentGenerator, SUPPORTED_LANGUAGES
from analysis.role_evaluator import RoleEvaluator, PlayerRole
from analysis.board_validation import (
    BoardValidator,
    ValidationErrorCode,
    check_sufficient_moves,
    validate_moves,
)


app = FastAPI(
    title='MindPoint Arena AI Analysis API',
    description='AI-powered match analysis for Gomoku/Caro',
    version='2.0.0'
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (for dev)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# Global Error Handlers - Requirements 17.1-17.5
# ============================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with consistent format."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)},
            "status": exc.status_code
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions - Requirements 17.5."""
    # Log error server-side (in production, use proper logging)
    print(f"Unexpected error: {type(exc).__name__}: {exc}")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau."
            },
            "status": 500
        }
    )


from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors with detailed logging."""
    # Log the raw body for debugging
    try:
        body = await request.body()
        print(f"[Validation Error] URL: {request.url}")
        print(f"[Validation Error] Body: {body.decode('utf-8')[:500]}")
    except:
        pass
    print(f"[Validation Error] Details: {exc.errors()}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Dữ liệu không hợp lệ",
                "details": exc.errors()
            },
            "status": 422
        }
    )


# ============================================
# Input Validation & Sanitization - Requirements 17.4
# ============================================

# ============================================
# Error Codes - Requirements 4.1, 13.1, 12.5
# ============================================

class AnalysisErrorCode:
    """Error codes for analysis API responses."""
    INVALID_BOARD_STATE = "E001"
    INVALID_NOTATION = "E002"
    INVALID_MOVE_SEQUENCE = "E003"
    INSUFFICIENT_MOVES = "E004"
    ANALYSIS_TIMEOUT = "E005"
    UNSUPPORTED_LANGUAGE = "E006"
    PATTERN_DETECTION_FAILED = "E007"
    SERVICE_ERROR = "E008"
    RATE_LIMIT_EXCEEDED = "E009"


# Multi-language error messages
ERROR_MESSAGES = {
    AnalysisErrorCode.INVALID_BOARD_STATE: {
        "vi": "Trạng thái bàn cờ không hợp lệ: {details}",
        "en": "Invalid board state: {details}",
        "zh": "无效的棋盘状态：{details}",
        "ja": "無効な盤面状態：{details}"
    },
    AnalysisErrorCode.INVALID_NOTATION: {
        "vi": "Ký hiệu không hợp lệ: {details}. Sử dụng định dạng A1-O15.",
        "en": "Invalid notation: {details}. Use format A1-O15.",
        "zh": "无效的符号：{details}。使用格式 A1-O15。",
        "ja": "無効な表記：{details}。A1-O15の形式を使用してください。"
    },
    AnalysisErrorCode.INSUFFICIENT_MOVES: {
        "vi": "Không đủ nước đi để phân tích (cần ít nhất 5 nước)",
        "en": "Insufficient moves for analysis (need at least 5 moves)",
        "zh": "棋步不足，无法分析（至少需要5步）",
        "ja": "分析に必要な手数が不足しています（最低5手必要）"
    },
    AnalysisErrorCode.ANALYSIS_TIMEOUT: {
        "vi": "Phân tích quá thời gian cho phép",
        "en": "Analysis timed out",
        "zh": "分析超时",
        "ja": "分析がタイムアウトしました"
    },
    AnalysisErrorCode.UNSUPPORTED_LANGUAGE: {
        "vi": "Ngôn ngữ không được hỗ trợ: {details}. Hỗ trợ: vi, en, zh, ja",
        "en": "Unsupported language: {details}. Supported: vi, en, zh, ja",
        "zh": "不支持的语言：{details}。支持：vi, en, zh, ja",
        "ja": "サポートされていない言語：{details}。サポート：vi, en, zh, ja"
    },
    AnalysisErrorCode.SERVICE_ERROR: {
        "vi": "Dịch vụ phân tích tạm thời không khả dụng",
        "en": "Analysis service temporarily unavailable",
        "zh": "分析服务暂时不可用",
        "ja": "分析サービスが一時的に利用できません"
    },
    AnalysisErrorCode.RATE_LIMIT_EXCEEDED: {
        "vi": "Đã vượt quá giới hạn sử dụng hàng ngày",
        "en": "Daily usage limit exceeded",
        "zh": "已超过每日使用限制",
        "ja": "1日の使用制限を超えました"
    },
}


def get_error_message(code: str, language: str = "vi", details: str = "") -> str:
    """Get localized error message."""
    messages = ERROR_MESSAGES.get(code, {})
    template = messages.get(language, messages.get("en", "Unknown error"))
    return template.format(details=details)


def sanitize_string(value: str, max_length: int = 500) -> str:
    """Sanitize string input to prevent injection attacks."""
    if not value:
        return ""
    # Remove control characters
    value = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', value)
    # Trim whitespace
    value = value.strip()
    # Limit length
    return value[:max_length]


def is_valid_uuid(value: str) -> bool:
    """Validate UUID format."""
    uuid_pattern = re.compile(
        r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    )
    return bool(uuid_pattern.match(value))


async def with_timeout(coro, timeout_seconds: float = 20.0):
    """Execute coroutine with timeout - Requirements 16.5, 17.3."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "code": "TIMEOUT",
                "message": "Yêu cầu đã hết thời gian chờ. Vui lòng thử lại."
            }
        )

# ============================================
# Global Instances
# ============================================

# Disable fast_mode to ensure proper mistake detection
basic_analyzer = BasicAnalyzer(fast_mode=False)
pro_analyzer = ProAnalyzer()
replay_engine = ReplayEngine()
comment_generator = CommentGenerator()
role_evaluator = RoleEvaluator()
board_validator = BoardValidator()

# God-Tier Pro Analyzer V2 (if available)
try:
    from analysis.pro_analyzer_v2 import ProAnalyzerV2
    pro_analyzer_v2 = ProAnalyzerV2()
    GOD_TIER_ENABLED = True
except ImportError:
    pro_analyzer_v2 = None
    GOD_TIER_ENABLED = False

# Redis cache instance (falls back to in-memory if Redis unavailable)
redis_cache = get_cache()

# In-memory storage for usage tracking (in production, use database)
usage_storage: Dict[str, Dict[str, Dict[str, int]]] = {}
# Structure: {user_id: {date_str: {feature: count}}}

# ============================================
# Pydantic Models for API
# ============================================

class Move(BaseModel):
    """Move model for API requests."""
    x: int = Field(..., ge=0, lt=15, description="X coordinate (0-14)")
    y: int = Field(..., ge=0, lt=15, description="Y coordinate (0-14)")
    player: Literal['X', 'O'] = Field(..., alias='p', description="Player (X or O)")
    
    model_config = {"populate_by_name": True}


class AnalyzeRequest(BaseModel):
    """Request model for POST /analyze endpoint."""
    match_id: str = Field(..., description="UUID of the match")
    moves: List[Move] = Field(default_factory=list, description="List of moves")
    tier: Literal['basic', 'pro'] = Field('basic', description="Analysis tier")
    user_id: str = Field(..., description="UUID of the user")
    difficulty: Optional[str] = Field(None, description="Training difficulty")
    subscription_tier: Optional[str] = Field('trial', description="User's subscription tier")
    user_side: Optional[Literal['X', 'O']] = Field(None, description="Which side the user played (X or O)")
    player_x_name: Optional[str] = Field(None, description="Name of player X")
    player_o_name: Optional[str] = Field(None, description="Name of player O")
    force_refresh: Optional[bool] = Field(False, description="Force re-analysis, bypass cache")
    language: Optional[Literal['vi', 'en', 'zh', 'ja']] = Field('vi', description="Language for comments (vi, en, zh, ja)")
    
    @field_validator('match_id', 'user_id')
    @classmethod
    def validate_uuid(cls, v: str) -> str:
        """Validate UUID format - Requirements 17.4."""
        if not is_valid_uuid(v):
            raise ValueError('Invalid UUID format')
        return v
    
    @field_validator('moves')
    @classmethod
    def validate_moves(cls, v: List[Move]) -> List[Move]:
        """Validate moves list - Requirements 17.4."""
        if len(v) > 225:  # Max moves on 15x15 board
            raise ValueError('Too many moves (max 225)')
        return v


class AskRequest(BaseModel):
    """Request model for POST /ask endpoint."""
    match_id: str = Field(..., description="UUID of the match")
    question: str = Field(..., min_length=1, max_length=500, description="Question in Vietnamese")
    user_id: str = Field(..., description="UUID of the user")
    tier: Optional[str] = Field('trial', description="User's subscription tier")
    
    @field_validator('match_id', 'user_id')
    @classmethod
    def validate_uuid(cls, v: str) -> str:
        """Validate UUID format - Requirements 17.4."""
        if not is_valid_uuid(v):
            raise ValueError('Invalid UUID format')
        return v
    
    @field_validator('question')
    @classmethod
    def sanitize_question(cls, v: str) -> str:
        """Sanitize question input - Requirements 17.4."""
        return sanitize_string(v, max_length=500)


class CreateReplayRequest(BaseModel):
    """Request model for POST /replay/create endpoint."""
    match_id: str = Field(..., description="UUID of the match")
    moves: List[Move] = Field(default_factory=list, description="List of moves")
    user_id: str = Field(..., description="UUID of the user")
    tier: Optional[str] = Field('trial', description="User's subscription tier")
    
    @field_validator('match_id', 'user_id')
    @classmethod
    def validate_uuid(cls, v: str) -> str:
        """Validate UUID format - Requirements 17.4."""
        if not is_valid_uuid(v):
            raise ValueError('Invalid UUID format')
        return v


class NavigateReplayRequest(BaseModel):
    """Request model for POST /replay/navigate endpoint."""
    session_id: str = Field(..., description="UUID of the replay session")
    move_index: int = Field(..., ge=-1, description="Target move index")


class PlayReplayRequest(BaseModel):
    """Request model for POST /replay/play endpoint."""
    session_id: str = Field(..., description="UUID of the replay session")
    move: Move = Field(..., description="User's move to play")
    difficulty: Optional[Literal['easy', 'medium', 'hard']] = Field('hard', description="AI difficulty level")


class UsageQuery(BaseModel):
    """Query model for GET /usage endpoint."""
    user_id: str = Field(..., description="UUID of the user")
    tier: Optional[str] = Field('free', description="User's subscription tier")


# ============================================
# Helper Functions
# ============================================

def convert_to_analysis_move(move: Move) -> AnalysisMove:
    """Convert API Move to analysis Move type."""
    return AnalysisMove(x=move.x, y=move.y, player=move.player)


def get_cache_key(match_id: str, tier: str) -> str:
    """Generate cache key for analysis results."""
    return f"{match_id}:{tier}"


def get_cached_analysis(match_id: str, tier: str) -> Optional[Dict]:
    """Get cached analysis result from Redis (or in-memory fallback)."""
    return redis_cache.get_analysis(match_id, tier)


def cache_analysis(match_id: str, tier: str, result: Dict, ttl_hours: int = 1):
    """Cache analysis result with TTL using Redis."""
    ttl_seconds = ttl_hours * 3600
    redis_cache.set_analysis(match_id, tier, result, ttl_seconds)


def get_user_usage(user_id: str, feature: str, period: str = 'daily') -> int:
    """Get usage count for a user and feature."""
    today = date.today().isoformat()
    month = today[:7]  # YYYY-MM
    
    user_usage = usage_storage.get(user_id, {})
    
    if period == 'daily':
        day_usage = user_usage.get(today, {})
        return day_usage.get(feature, 0)
    else:  # monthly
        total = 0
        for date_key, features in user_usage.items():
            if date_key.startswith(month):
                total += features.get(feature, 0)
        return total


def increment_usage(user_id: str, feature: str):
    """Increment usage count for a user and feature."""
    today = date.today().isoformat()
    
    if user_id not in usage_storage:
        usage_storage[user_id] = {}
    
    if today not in usage_storage[user_id]:
        usage_storage[user_id][today] = {}
    
    current = usage_storage[user_id][today].get(feature, 0)
    usage_storage[user_id][today][feature] = current + 1


def check_usage_limit(user_id: str, feature: str, tier: str) -> bool:
    """
    Check if user has exceeded their usage limit for a feature.
    
    This function enforces the subscription tier limits defined in USAGE_LIMITS.
    Each tier has daily and monthly limits for each feature type.
    
    Limit values:
    - -1: Unlimited (Pro Plus tier)
    - 0: Feature not available for this tier
    - >0: Maximum uses per day
    
    Args:
        user_id: UUID of the user
        feature: Feature type string (e.g., 'basic_analysis', 'pro_analysis')
        tier: Subscription tier string (e.g., 'free', 'trial', 'pro')
        
    Returns:
        True if user can use the feature, False if limit exceeded
    """
    # Convert tier string to enum, default to FREE if invalid
    try:
        tier_enum = SubscriptionTier(tier)
    except ValueError:
        tier_enum = SubscriptionTier.FREE
    
    # Convert feature string to enum
    try:
        feature_enum = FeatureType(feature)
    except ValueError:
        return True  # Unknown feature type, allow by default
    
    # Look up limits for this tier and feature
    limits = USAGE_LIMITS.get(tier_enum, {}).get(feature_enum, {})
    daily_limit = limits.get('daily', 0)
    
    # Special case: -1 means unlimited (Pro Plus tier)
    if daily_limit == -1:
        return True
    
    # Special case: 0 means feature not available for this tier
    if daily_limit == 0:
        return False
    
    # Normal case: check if current usage is below the limit
    current_usage = get_user_usage(user_id, feature, 'daily')
    return current_usage < daily_limit


def serialize_analysis_result(
    result, 
    user_side: Optional[str] = None,
    player_x_name: Optional[str] = None,
    player_o_name: Optional[str] = None,
    language: str = "vi"
) -> Dict:
    """
    Serialize AnalysisResult dataclass to JSON-compatible dictionary.
    
    Task 8.8.3: Updated to include new advanced analysis data:
    - Opening recognition info
    - VCF/VCT detection results
    - Endgame analysis
    - Missed win detection
    
    IMPROVED: Now includes user perspective for personalized insights:
    - user_side: Which side the user played
    - your_stats / opponent_stats: Stats from user's perspective
    - personalized_insights: Insights tailored to the user
    
    Args:
        result: AnalysisResult object from BasicAnalyzer or ProAnalyzer
        user_side: Which side the user played ('X' or 'O')
        player_x_name: Display name for player X
        player_o_name: Display name for player O
        
    Returns:
        JSON-serializable dictionary matching the API response schema
    """
    # Determine player names
    x_name = player_x_name or "Người chơi X"
    o_name = player_o_name or "Người chơi O"
    
    response = {
        # Analysis tier used ('basic' or 'pro')
        'tier': result.tier,
        
        # User perspective info
        'user_side': user_side,
        'player_names': {
            'X': x_name,
            'O': o_name
        },
        
        # Best move recommendation (None if game is over)
        'best_move': {
            'x': result.best_move.x,
            'y': result.best_move.y,
            'score': result.best_move.score,
            'reason': result.best_move.reason
        } if result.best_move else None,
        
        # Move-by-move evaluation timeline with player names, role, and multi-language comments
        'timeline': [
            {
                'move': e.move,
                'player': e.player,
                'player_name': x_name if e.player == 'X' else o_name,
                'is_user_move': user_side == e.player if user_side else None,
                'position': e.position,
                'score': e.score,
                'win_prob': e.win_prob,
                # Convert enum to string value for JSON
                'category': e.category.value if hasattr(e.category, 'value') else e.category,
                'note': e.note,
                # Role information (Requirements 3.1)
                'role': getattr(e, 'role', 'neutral'),
                # Multi-language comments (Requirements 4.1)
                'comments': getattr(e, 'comments', {language: e.note}) if hasattr(e, 'comments') else {language: e.note},
            }
            for e in result.timeline
        ],
        
        # Requested language
        'language': language,
        
        # Detected mistakes with severity and alternatives
        'mistakes': [
            {
                'move': m.move,
                'player': result.timeline[m.move - 1].player if m.move <= len(result.timeline) else None,
                'player_name': (x_name if result.timeline[m.move - 1].player == 'X' else o_name) if m.move <= len(result.timeline) else None,
                'is_user_mistake': (user_side == result.timeline[m.move - 1].player) if user_side and m.move <= len(result.timeline) else None,
                'severity': m.severity,
                'desc': m.desc,
                'best_alternative': m.best_alternative
            }
            for m in result.mistakes
        ],
        
        # Tactical patterns detected (Tứ Hướng, Song Song, etc.)
        'patterns': [
            {
                'label': p.label,
                'explanation': p.explanation,
                'moves': p.moves,
                'severity': p.severity
            }
            for p in result.patterns
        ],
        
        # Overall game summary with player statistics
        'summary': {
            'total_moves': result.summary.total_moves,
            'winner': result.summary.winner,
            'winner_name': (x_name if result.summary.winner == 'X' else o_name) if result.summary.winner else None,
            'user_won': (user_side == result.summary.winner) if user_side and result.summary.winner else None,
            'x_stats': result.summary.x_stats,
            'o_stats': result.summary.o_stats,
            'key_insights': result.summary.key_insights
        },
        
        # AI-generated insights (Pro tier only, None for basic)
        'ai_insights': {
            'natural_language_summary': result.ai_insights.natural_language_summary,
            'mistake_explanations': result.ai_insights.mistake_explanations,
            'improvement_tips': result.ai_insights.improvement_tips,
            'advanced_patterns': result.ai_insights.advanced_patterns
        } if result.ai_insights else None,
        
        # Analysis duration in milliseconds
        'duration_ms': result.duration_ms
    }
    
    # Add user-perspective stats if user_side is known
    if user_side:
        your_stats = result.summary.x_stats if user_side == 'X' else result.summary.o_stats
        opponent_stats = result.summary.o_stats if user_side == 'X' else result.summary.x_stats
        opponent_name = o_name if user_side == 'X' else x_name
        
        response['your_stats'] = your_stats
        response['opponent_stats'] = opponent_stats
        response['opponent_name'] = opponent_name
        
        # Generate personalized insights
        personalized_insights = _generate_personalized_insights(
            result, user_side, your_stats, opponent_stats, 
            x_name if user_side == 'X' else o_name,
            opponent_name
        )
        response['personalized_insights'] = personalized_insights
    
    # Task 8.8.3: Add advanced analysis data if available
    if hasattr(result, 'advanced_analysis') and result.advanced_analysis:
        response['advanced_analysis'] = result.advanced_analysis
    
    # Extract opening info from patterns (if present)
    opening_patterns = [p for p in result.patterns if p.label.startswith('Khai cuộc:')]
    if opening_patterns:
        response['opening_info'] = {
            'name': opening_patterns[0].label.replace('Khai cuộc: ', ''),
            'description': opening_patterns[0].explanation
        }
    
    # Check for VCF-related best moves
    if result.best_move and 'VCF' in result.best_move.reason:
        response['has_vcf'] = True
        response['vcf_info'] = {
            'move': {'x': result.best_move.x, 'y': result.best_move.y},
            'description': result.best_move.reason
        }
    
    # Check for missed wins in mistakes
    missed_wins = [m for m in result.mistakes if 'Bỏ lỡ thắng' in m.desc or 'VCF' in m.desc]
    if missed_wins:
        response['missed_wins'] = [
            {
                'move': m.move,
                'description': m.desc,
                'best_alternative': m.best_alternative
            }
            for m in missed_wins
        ]
    
    return response


def _generate_personalized_insights(
    result, 
    user_side: str, 
    your_stats: Dict, 
    opponent_stats: Dict,
    your_name: str,
    opponent_name: str
) -> List[str]:
    """
    Generate personalized insights from the user's perspective.
    
    Args:
        result: AnalysisResult object
        user_side: Which side the user played ('X' or 'O')
        your_stats: User's statistics
        opponent_stats: Opponent's statistics
        your_name: User's display name
        opponent_name: Opponent's display name
        
    Returns:
        List of personalized insight strings in Vietnamese
    """
    insights = []
    
    # Win/Loss insight
    if result.summary.winner:
        if result.summary.winner == user_side:
            insights.append(f"🎉 Chúc mừng! Bạn đã thắng ván này.")
        else:
            insights.append(f"😔 Bạn đã thua ván này. Hãy xem lại các sai lầm để cải thiện.")
    else:
        insights.append("🤝 Ván đấu hòa hoặc chưa kết thúc.")
    
    # Accuracy comparison
    your_accuracy = your_stats.get('accuracy', 0)
    opp_accuracy = opponent_stats.get('accuracy', 0)
    
    if your_accuracy > opp_accuracy + 10:
        insights.append(f"✨ Bạn chơi chính xác hơn đối thủ ({your_accuracy:.0f}% vs {opp_accuracy:.0f}%).")
    elif opp_accuracy > your_accuracy + 10:
        insights.append(f"📈 Đối thủ chơi chính xác hơn bạn ({opp_accuracy:.0f}% vs {your_accuracy:.0f}%). Cần cải thiện!")
    else:
        insights.append(f"⚖️ Độ chính xác tương đương ({your_accuracy:.0f}% vs {opp_accuracy:.0f}%).")
    
    # Mistake analysis
    your_mistakes = your_stats.get('mistakes', 0)
    your_critical = your_stats.get('critical_mistakes', 0)
    opp_mistakes = opponent_stats.get('mistakes', 0)
    
    if your_critical > 0:
        insights.append(f"⚠️ Bạn có {your_critical} sai lầm nghiêm trọng. Đây là điểm cần cải thiện nhất!")
    elif your_mistakes > opp_mistakes:
        insights.append(f"📝 Bạn mắc nhiều sai lầm hơn đối thủ ({your_mistakes} vs {opp_mistakes}).")
    elif your_mistakes < opp_mistakes:
        insights.append(f"👍 Bạn mắc ít sai lầm hơn đối thủ ({your_mistakes} vs {opp_mistakes}).")
    
    # Excellent moves
    your_excellent = your_stats.get('excellent_moves', 0)
    if your_excellent > 0:
        insights.append(f"🌟 Bạn có {your_excellent} nước đi xuất sắc trong ván này!")
    
    return insights[:4]  # Return top 4 insights


# ============================================
# API Endpoints
# ============================================

@app.post('/analyze')
async def analyze_match(req: AnalyzeRequest):
    """
    Analyze a match using basic or pro analysis.
    
    Requirements: 9.1, 4.1, 3.1, 13.1, 12.5
    - Validates request
    - Checks tier permissions
    - Returns analysis results with multi-language comments
    - Includes role information in timeline
    - Handles edge cases (insufficient moves, board validation)
    """
    start_time = time.time()
    print(f"[/analyze] Received request: match_id={req.match_id}, user_id={req.user_id}, moves_count={len(req.moves)}")
    
    # Get language (default to Vietnamese)
    language = req.language or 'vi'
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": AnalysisErrorCode.UNSUPPORTED_LANGUAGE,
                "message": get_error_message(AnalysisErrorCode.UNSUPPORTED_LANGUAGE, language, language),
                "supported_languages": SUPPORTED_LANGUAGES
            }
        )
    
    # Validate request
    if not req.match_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": AnalysisErrorCode.INVALID_BOARD_STATE,
                "message": get_error_message(AnalysisErrorCode.INVALID_BOARD_STATE, language, "match_id is required")
            }
        )
    
    if not req.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": AnalysisErrorCode.INVALID_BOARD_STATE,
                "message": get_error_message(AnalysisErrorCode.INVALID_BOARD_STATE, language, "user_id is required")
            }
        )
    
    # Convert moves to analysis format
    analysis_moves = [convert_to_analysis_move(m) for m in req.moves]
    
    # Edge case: Check for insufficient moves (Requirement 13.1)
    moves_validation = check_sufficient_moves(analysis_moves)
    if not moves_validation.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": AnalysisErrorCode.INSUFFICIENT_MOVES,
                "message": get_error_message(AnalysisErrorCode.INSUFFICIENT_MOVES, language),
                "move_count": len(analysis_moves),
                "minimum_required": 5
            }
        )
    
    # Edge case: Validate move sequence (Requirement 12.5)
    sequence_validation = validate_moves(analysis_moves)
    if not sequence_validation.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": AnalysisErrorCode.INVALID_MOVE_SEQUENCE,
                "message": get_error_message(AnalysisErrorCode.INVALID_BOARD_STATE, language, sequence_validation.error_message),
                "details": sequence_validation.details
            }
        )
    
    # Check cache first (unless force_refresh is True)
    cache_key = f"{req.match_id}:{req.tier}:{language}"
    if not req.force_refresh:
        cached = get_cached_analysis(req.match_id, f"{req.tier}:{language}")
        if cached:
            return cached
    
    # Determine feature type for usage tracking
    feature = 'pro_analysis' if req.tier == 'pro' else 'basic_analysis'
    
    # Check usage limits (simplified - in production, get tier from database)
    subscription_tier = req.subscription_tier or 'trial'  # Default to trial
    if not check_usage_limit(req.user_id, feature, subscription_tier):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": AnalysisErrorCode.RATE_LIMIT_EXCEEDED,
                "message": get_error_message(AnalysisErrorCode.RATE_LIMIT_EXCEEDED, language),
                "reset_at": (date.today().isoformat() + "T00:00:00Z")
            }
        )
    
    try:
        if req.tier == 'pro':
            # Try God-Tier Pro Analyzer V2 first (if available)
            if GOD_TIER_ENABLED and pro_analyzer_v2:
                try:
                    result = await with_timeout(
                        pro_analyzer_v2.analyze_game(analysis_moves),
                        timeout_seconds=20.0
                    )
                except Exception as v2_error:
                    print(f"God-Tier V2 failed, falling back to V1: {v2_error}")
                    result = await with_timeout(
                        pro_analyzer.analyze_game(analysis_moves),
                        timeout_seconds=20.0
                    )
            else:
                # Pro analysis with AI enhancement - with timeout
                result = await with_timeout(
                    pro_analyzer.analyze_game(analysis_moves),
                    timeout_seconds=20.0
                )
        else:
            # Basic rule-based analysis (sync, but fast)
            result = basic_analyzer.analyze_game(analysis_moves)
        
        # Serialize result with user perspective and language
        response = serialize_analysis_result(
            result,
            user_side=req.user_side,
            player_x_name=req.player_x_name,
            player_o_name=req.player_o_name,
            language=language
        )
        
        # Cache the result with language key
        cache_analysis(req.match_id, f"{req.tier}:{language}", response)
        
        # Track usage
        increment_usage(req.user_id, feature)
        
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions (like timeout)
        raise
    except asyncio.TimeoutError:
        # Handle timeout with partial results (Requirement 12.5)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "code": AnalysisErrorCode.ANALYSIS_TIMEOUT,
                "message": get_error_message(AnalysisErrorCode.ANALYSIS_TIMEOUT, language),
                "partial_results": None  # Could include partial results if available
            }
        )
    except Exception as e:
        # Log error server-side - Requirements 17.5
        print(f"Analysis error: {type(e).__name__}: {e}")
        
        # Fallback to basic analysis if pro fails - Requirements 17.1
        if req.tier == 'pro':
            try:
                print("Falling back to basic analysis...")
                result = basic_analyzer.analyze_game(analysis_moves)
                response = serialize_analysis_result(
                    result,
                    user_side=req.user_side,
                    player_x_name=req.player_x_name,
                    player_o_name=req.player_o_name,
                    language=language
                )
                response['fallback'] = True
                response['fallback_reason'] = 'AI service unavailable'
                cache_analysis(req.match_id, f"basic:{language}", response)
                increment_usage(req.user_id, 'basic_analysis')
                return response
            except Exception as fallback_error:
                print(f"Fallback also failed: {fallback_error}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": AnalysisErrorCode.SERVICE_ERROR,
                "message": get_error_message(AnalysisErrorCode.SERVICE_ERROR, language)
            }
        )


@app.post('/api/v1/analyze')
async def analyze_match_v1(req: AnalyzeRequest, response: Response):
    """Backward-compatible analyze endpoint with deprecation notice."""
    result = await analyze_match(req)
    response.headers['X-API-Version'] = 'v1'
    response.headers['Warning'] = '299 - "v1 is deprecated; use /api/v2/analyze"'
    return result


@app.post('/api/v2/analyze')
async def analyze_match_v2(req: AnalyzeRequest, response: Response):
    """Versioned analyze endpoint with explicit version header."""
    result = await analyze_match(req)
    response.headers['X-API-Version'] = 'v2'
    return result


@app.post('/ask')
async def ask_question(req: AskRequest):
    """
    Answer a question about a match using AI.
    
    Requirements: 9.2
    - Validates Pro subscription
    - Checks rate limits
    - Returns AI answer
    """
    # Validate request
    if not req.match_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Invalid request", "details": "match_id is required"}
        )
    
    if not req.question or len(req.question.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Invalid request", "details": "question is required"}
        )
    
    if not req.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Invalid request", "details": "user_id is required"}
        )
    
    # Check usage limits for AI Q&A
    tier = req.tier or 'trial'  # Default to trial for Q&A access
    if not check_usage_limit(req.user_id, 'ai_qa', tier):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Daily limit reached",
                "reset_at": (date.today().isoformat() + "T00:00:00Z")
            }
        )
    
    # Get cached analysis context if available
    context = get_cached_analysis(req.match_id, 'pro')
    if not context:
        context = get_cached_analysis(req.match_id, 'basic')
    
    try:
        # Check if API key is configured
        if not pro_analyzer.api_key:
            # Provide helpful fallback response based on cached analysis
            if context:
                # Generate response from cached analysis
                mistakes_count = len(context.get('mistakes', []))
                patterns_count = len(context.get('patterns', []))
                best_move = context.get('best_move')
                
                fallback_answer = f"Dựa trên phân tích trận đấu:\n\n"
                fallback_answer += f"• Phát hiện {mistakes_count} sai lầm và {patterns_count} mẫu chiến thuật.\n"
                
                if best_move:
                    fallback_answer += f"• Nước đi tốt nhất: ({best_move['x']+1},{best_move['y']+1}) - {best_move.get('reason', '')}\n"
                
                if mistakes_count > 0:
                    top_mistakes = context.get('mistakes', [])[:3]
                    fallback_answer += "\nCác sai lầm chính:\n"
                    for m in top_mistakes:
                        fallback_answer += f"• Nước {m['move']}: {m['desc']}\n"
                
                fallback_answer += "\n💡 Để có phân tích chi tiết hơn với AI, vui lòng cấu hình OpenRouter API key."
            else:
                fallback_answer = "Vui lòng phân tích trận đấu trước khi hỏi AI. Nhấn nút 'Phân tích' để bắt đầu."
            
            return {
                "answer": fallback_answer,
                "actions": []
            }
        
        # Call AI Q&A with timeout - Requirements 16.5
        answer = await with_timeout(
            pro_analyzer.ask_about_game(
                match_id=req.match_id,
                question=req.question,
                context=context  # Pass cached context
            ),
            timeout_seconds=20.0
        )
        
        # Track usage
        increment_usage(req.user_id, 'ai_qa')
        
        return {
            "answer": answer,
            "actions": []  # Actions would be parsed from AI response
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions (like timeout)
        raise
    except Exception as e:
        print(f"Q&A error: {type(e).__name__}: {e}")
        
        # Provide fallback response instead of error
        fallback_answer = "Xin lỗi, AI đang bận. Dựa trên phân tích cơ bản:\n\n"
        if context:
            mistakes = context.get('mistakes', [])
            if mistakes:
                fallback_answer += "Các sai lầm chính trong trận:\n"
                for m in mistakes[:3]:
                    fallback_answer += f"• Nước {m['move']}: {m['desc']}\n"
            else:
                fallback_answer += "Trận đấu không có sai lầm nghiêm trọng.\n"
        else:
            fallback_answer += "Vui lòng phân tích trận đấu trước để có thông tin chi tiết."
        
        return {
            "answer": fallback_answer,
            "actions": []
        }


@app.post('/replay/create')
async def create_replay_session(req: CreateReplayRequest):
    """
    Create a new replay session.
    
    Requirements: 9.3
    - Creates replay session
    - Returns session_id
    """
    # Validate request
    if not req.match_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Invalid request", "details": "match_id is required"}
        )
    
    if not req.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Invalid request", "details": "user_id is required"}
        )
    
    # Check usage limits for replay
    tier = req.tier or 'trial'  # Default to trial for replay access
    if not check_usage_limit(req.user_id, 'replay', tier):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Daily limit reached",
                "reset_at": (date.today().isoformat() + "T00:00:00Z")
            }
        )
    
    try:
        # Convert moves to analysis format
        analysis_moves = [convert_to_analysis_move(m) for m in req.moves]
        
        # Create replay session
        session_id = replay_engine.create_replay_session(
            match_id=req.match_id,
            moves=analysis_moves,
            user_id=req.user_id
        )
        
        # Track usage
        increment_usage(req.user_id, 'replay')
        
        return {
            "session_id": session_id,
            "total_moves": len(req.moves)
        }
        
    except Exception as e:
        print(f"Replay create error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Service unavailable", "details": "Failed to create replay session"}
        )


@app.post('/replay/navigate')
async def navigate_replay(req: NavigateReplayRequest):
    """
    Navigate to a specific move in the replay.
    
    Requirements: 9.4
    - Returns board state at the specified move
    """
    # Validate request
    if not req.session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Invalid request", "details": "session_id is required"}
        )
    
    try:
        result = replay_engine.navigate_to_move(
            session_id=req.session_id,
            move_index=req.move_index
        )
        
        return {
            "board_state": result["board_state"],
            "current_move": result["current_move"],
            "player_turn": result["player_turn"]
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Invalid request", "details": str(e)}
        )
    except Exception as e:
        print(f"Replay navigate error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Service unavailable", "details": "Navigation failed"}
        )


@app.post('/replay/play')
async def play_replay_move(req: PlayReplayRequest):
    """
    Play an alternative move in the replay.
    
    Requirements: 9.5
    - Processes user move
    - Gets AI response
    - Returns updated state
    """
    # Validate request
    if not req.session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Invalid request", "details": "session_id is required"}
        )
    
    try:
        # Convert move to analysis format
        analysis_move = convert_to_analysis_move(req.move)
        
        result = replay_engine.play_from_here(
            session_id=req.session_id,
            user_move=analysis_move,
            difficulty=req.difficulty or 'hard'
        )
        
        return {
            "board_state": result["board_state"],
            "ai_move": {
                "x": result["ai_move"].x,
                "y": result["ai_move"].y,
                "player": result["ai_move"].player
            } if result["ai_move"] else None,
            "original_outcome": result["original_outcome"],
            "current_win_prob": result["current_win_prob"],
            "comparison": result["comparison"]
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Invalid request", "details": str(e)}
        )
    except Exception as e:
        print(f"Replay play error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Service unavailable", "details": "Play failed"}
        )


class UndoReplayRequest(BaseModel):
    """Request model for POST /replay/undo endpoint."""
    session_id: str = Field(..., description="UUID of the replay session")


@app.post('/replay/undo')
async def undo_replay_move(req: UndoReplayRequest):
    """
    Undo the last move pair in what-if mode.
    
    Requirements: 6.1, 6.2, 6.3
    - Removes last user + AI move pair
    - Updates board state and win probability
    - Returns to divergence point if all moves undone
    """
    # Validate request
    if not req.session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Invalid request", "details": "session_id is required"}
        )
    
    try:
        result = replay_engine.undo_move(session_id=req.session_id)
        
        return {
            "board_state": result["board_state"],
            "current_move_index": result["current_move_index"],
            "win_prob": result["win_prob"],
            "can_undo": result["can_undo"],
            "mode": result["mode"]
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Invalid request", "details": str(e)}
        )
    except Exception as e:
        print(f"Replay undo error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Service unavailable", "details": "Undo failed"}
        )


@app.get('/god-tier/status')
async def get_god_tier_status():
    """
    Get God-Tier analysis module status.
    
    Returns availability of advanced analysis features.
    """
    return {
        "god_tier_enabled": GOD_TIER_ENABLED,
        "features": {
            "bitboard_threat_detection": GOD_TIER_ENABLED,
            "dbs_search": GOD_TIER_ENABLED,
            "multi_dimensional_mistakes": GOD_TIER_ENABLED,
            "enhanced_explanations": GOD_TIER_ENABLED,
        },
        "version": "2.0.0" if GOD_TIER_ENABLED else "1.0.0"
    }


@app.post('/analyze/god-tier')
async def analyze_god_tier(req: AnalyzeRequest):
    """
    Analyze a match using God-Tier analysis (Pro Analyzer V2).
    
    Features:
    - Bitboard-based threat detection (100x faster)
    - Dependency-Based Search for VCF/VCT (50+ ply)
    - Multi-dimensional mistake analysis (97% accuracy)
    - Enhanced AI explanations
    """
    if not GOD_TIER_ENABLED or not pro_analyzer_v2:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "God-Tier analysis not available"}
        )
    
    # Validate request
    if not req.match_id or not req.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Invalid request", "details": "match_id and user_id required"}
        )
    
    # Check usage limits
    subscription_tier = req.subscription_tier or 'trial'
    if not check_usage_limit(req.user_id, 'pro_analysis', subscription_tier):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "Daily limit reached"}
        )
    
    # Convert moves
    analysis_moves = [convert_to_analysis_move(m) for m in req.moves]
    
    try:
        result = await with_timeout(
            pro_analyzer_v2.analyze_game(analysis_moves),
            timeout_seconds=25.0
        )
        
        response = serialize_analysis_result(result)
        response['god_tier'] = True
        
        cache_analysis(req.match_id, 'god_tier', response)
        increment_usage(req.user_id, 'pro_analysis')
        
        return response
        
    except Exception as e:
        print(f"God-Tier analysis error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Analysis failed", "details": str(e)}
        )


@app.get('/usage')
async def get_usage(user_id: str, tier: str = 'free'):
    """
    Get usage information for a user.
    
    Requirements: 9.6 (implied)
    - Returns daily and monthly usage
    - Returns remaining allowances
    """
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Invalid request", "details": "user_id is required"}
        )
    
    try:
        tier_enum = SubscriptionTier(tier)
    except ValueError:
        tier_enum = SubscriptionTier.FREE
    
    # Get usage for each feature
    features = ['basic_analysis', 'pro_analysis', 'replay', 'ai_qa']
    
    daily_usage = {}
    monthly_usage = {}
    daily_remaining = {}
    monthly_remaining = {}
    
    for feature in features:
        daily = get_user_usage(user_id, feature, 'daily')
        monthly = get_user_usage(user_id, feature, 'monthly')
        
        daily_usage[feature] = daily
        monthly_usage[feature] = monthly
        
        # Get limits
        try:
            feature_enum = FeatureType(feature)
            limits = USAGE_LIMITS.get(tier_enum, {}).get(feature_enum, {})
            daily_limit = limits.get('daily', 0)
            monthly_limit = limits.get('monthly', 0)
            
            daily_remaining[feature] = max(0, daily_limit - daily) if daily_limit >= 0 else -1
            monthly_remaining[feature] = max(0, monthly_limit - monthly) if monthly_limit >= 0 else -1
        except ValueError:
            daily_remaining[feature] = 0
            monthly_remaining[feature] = 0
    
    return {
        "tier": tier,
        "daily_usage": daily_usage,
        "monthly_usage": monthly_usage,
        "daily_remaining": daily_remaining,
        "monthly_remaining": monthly_remaining
    }


@app.delete('/replay/{session_id}')
async def delete_replay_session(session_id: str):
    """
    Delete a replay session and free resources.
    """
    try:
        replay_engine.cleanup_session(session_id)
        return {"status": "ok", "message": "Session deleted"}
    except Exception as e:
        print(f"Replay delete error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Service unavailable", "details": "Delete failed"}
        )


@app.get('/health')
async def health():
    """Health check endpoint."""
    return {'status': 'ok', 'version': '2.0.0'}


@app.get('/cache/stats')
async def get_cache_stats():
    """
    Get cache statistics and monitoring info.
    
    Returns cache hit rate, memory usage, and key counts.
    """
    return redis_cache.get_cache_info()


@app.post('/cache/warm')
async def warm_cache_endpoint():
    """
    Warm cache with common positions.
    
    Pre-caches opening positions, common patterns, and
    frequently analyzed positions for faster analysis.
    """
    try:
        from analysis.cache_warmer import CacheWarmer
        
        warmer = CacheWarmer(redis_cache)
        result = warmer.warm_all()
        
        return {
            'status': 'ok',
            'openings_cached': result.openings_cached,
            'patterns_cached': result.patterns_cached,
            'positions_cached': result.positions_cached,
            'errors': result.errors,
            'duration_ms': result.duration_ms,
            'message': f'Warmed cache with {result.openings_cached} openings, {result.patterns_cached} patterns, {result.positions_cached} positions'
        }
    except Exception as e:
        print(f"Cache warming error: {e}")
        return {
            'status': 'error',
            'openings_cached': 0,
            'patterns_cached': 0,
            'positions_cached': 0,
            'message': f'Cache warming failed: {str(e)}'
        }


@app.delete('/cache/clear')
async def clear_cache():
    """
    Clear all cache entries.
    
    Use with caution - this will clear all cached analysis results.
    """
    count = redis_cache.clear_all()
    redis_cache.reset_stats()
    return {
        'status': 'ok',
        'entries_cleared': count
    }


@app.get('/cache/keys')
async def get_cache_keys():
    """
    Get count of cache keys by type.
    
    Returns counts for analysis, session, and position caches.
    """
    from analysis.redis_cache import ANALYSIS_PREFIX, SESSION_PREFIX, POSITION_PREFIX
    
    return {
        'analysis_keys': redis_cache.get_key_count(ANALYSIS_PREFIX),
        'session_keys': redis_cache.get_key_count(SESSION_PREFIX),
        'position_keys': redis_cache.get_key_count(POSITION_PREFIX),
        'total_keys': redis_cache.get_key_count()
    }


@app.post('/cache/stats/reset')
async def reset_cache_stats():
    """
    Reset cache statistics.
    
    Resets hit/miss counters and other stats.
    """
    redis_cache.reset_stats()
    return {
        'status': 'ok',
        'message': 'Cache statistics reset'
    }


@app.get('/cache/analysis/{match_id}/{tier}')
async def check_analysis_cache(match_id: str, tier: str):
    """
    Check if analysis is cached for a match.
    
    Args:
        match_id: UUID of the match
        tier: Analysis tier ('basic' or 'pro')
        
    Returns:
        Cache status and metadata
    """
    cached = redis_cache.get_analysis(match_id, tier)
    
    if cached:
        return {
            'cached': True,
            'match_id': match_id,
            'tier': tier,
            'has_data': True
        }
    else:
        return {
            'cached': False,
            'match_id': match_id,
            'tier': tier
        }


@app.delete('/cache/analysis/{match_id}/{tier}')
async def invalidate_analysis_cache(match_id: str, tier: str):
    """
    Invalidate cached analysis for a match.
    
    Args:
        match_id: UUID of the match
        tier: Analysis tier ('basic' or 'pro')
        
    Returns:
        Deletion status
    """
    deleted = redis_cache.delete_analysis(match_id, tier)
    return {
        'status': 'ok' if deleted else 'not_found',
        'match_id': match_id,
        'tier': tier,
        'deleted': deleted
    }


# ============================================
# Legacy Endpoints (for backward compatibility)
# ============================================

# Keep the old /suggest_move endpoint for compatibility
class SuggestRequest(BaseModel):
    board: dict
    mark: str


@app.post('/suggest_move')
async def suggest_move(req: SuggestRequest):
    """Legacy endpoint for move suggestion."""
    import random
    occupied = set(req.board.keys())
    candidates = []
    for key in occupied:
        x, y = map(int, key.split('_'))
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                nx, ny = x + dx, y + dy
                k = f"{nx}_{ny}"
                if k not in occupied:
                    candidates.append((nx, ny))
    if not candidates:
        for x in range(-7, 8):
            for y in range(-7, 8):
                k = f"{x}_{y}"
                if k not in occupied:
                    candidates.append((x, y))
    nx, ny = random.choice(candidates) if candidates else (0, 0)
    return {'x': nx, 'y': ny, 'mark': req.mark}


# ============================================
# Server Startup
# ============================================

if __name__ == "__main__":
    import uvicorn
    print("Starting AI Analysis Server...")
    print("API docs available at: http://localhost:8002/docs")
    uvicorn.run(app, host="0.0.0.0", port=8002)
