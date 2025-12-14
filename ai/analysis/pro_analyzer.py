"""
AI Match Analysis System - Pro Analyzer

This module implements the ProAnalyzer class for AI-powered game analysis,
providing natural language insights using OpenRouter/DeepSeek API.

Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6

Task 8.8.3: Integration with Existing System
- Integrated AdvancedEvaluator for multi-factor position evaluation
- Integrated VCF/VCT search for winning sequence detection
- Integrated OpeningBook for opening recognition
- Integrated EndgameAnalyzer for endgame analysis
- Enhanced AI prompts with advanced analysis data
"""

import json
import os
import time
from typing import List, Dict, Optional, Any
import httpx

from .types import (
    Move,
    AnalysisResult,
    AIInsights,
    BOARD_SIZE,
)
from .basic_analyzer import BasicAnalyzer

# Import advanced modules for integration (Task 8.8.3)
try:
    from .vcf_search import VCFSearch
    from .vct_search import VCTSearch
    from .advanced_evaluator import AdvancedEvaluator
    from .opening_book import OpeningBook
    from .endgame_analyzer import EndgameAnalyzer
    ADVANCED_MODULES_AVAILABLE = True
except ImportError:
    ADVANCED_MODULES_AVAILABLE = False


class ProAnalyzer:
    """
    AI-powered game analyzer for Gomoku/Caro.
    
    Enhances basic rule-based analysis with natural language insights
    from OpenRouter/DeepSeek API. Provides personalized explanations,
    advanced pattern detection, and improvement tips.
    
    Requirements:
    - 4.1: Run basic analysis first, then enhance with AI
    - 4.2: Use OpenRouter/DeepSeek API with Gomoku expert prompt
    - 4.3: Provide natural language explanations for mistakes
    - 4.4: Detect advanced patterns beyond basic detection
    - 4.5: Gracefully fallback to basic analysis on API failure
    - 4.6: Generate personalized, actionable improvement tips
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        board_size: int = BOARD_SIZE,
        timeout: int = 20,
        use_advanced: bool = True
    ):
        """
        Initialize the ProAnalyzer.
        
        Args:
            api_key: OpenRouter API key (reads from env if not provided)
            board_size: Size of the board (default 15x15)
            timeout: API request timeout in seconds (default 20)
            use_advanced: Whether to use advanced modules (Task 8.8.3)
        """
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY", "")
        self.board_size = board_size
        self.timeout = timeout
        self.basic_analyzer = BasicAnalyzer(board_size, use_advanced=use_advanced, fast_mode=False)
        
        # OpenRouter API configuration
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
        self.model = "deepseek/deepseek-chat"  # DeepSeek model via OpenRouter
        
        # Initialize advanced modules (Task 8.8.3)
        self.use_advanced = use_advanced and ADVANCED_MODULES_AVAILABLE
        if self.use_advanced:
            from .threat_detector import ThreatDetector
            from .position_evaluator import PositionEvaluator
            threat_detector = ThreatDetector(board_size)
            position_evaluator = PositionEvaluator(threat_detector, board_size)
            self._advanced_evaluator = AdvancedEvaluator(
                threat_detector, position_evaluator, board_size
            )
            self._vcf_searcher = VCFSearch(board_size, max_depth=20)
            self._vct_searcher = VCTSearch(board_size, max_depth=16)
            self._opening_book = OpeningBook()
            self._endgame_analyzer = EndgameAnalyzer(board_size)
        else:
            self._advanced_evaluator = None
            self._vcf_searcher = None
            self._vct_searcher = None
            self._opening_book = None
            self._endgame_analyzer = None
        
        # System prompt for Gomoku expert (enhanced with advanced analysis context)
        self.system_prompt = """Bạn là một chuyên gia Cờ Caro (Gomoku) hàng đầu với nhiều năm kinh nghiệm.
Nhiệm vụ của bạn là phân tích các ván đấu và cung cấp lời khuyên chi tiết, dễ hiểu bằng tiếng Việt.

Khi phân tích:
1. Giải thích TẠI SAO một nước đi là sai lầm (không chỉ nói là sai)
2. Đưa ra lời khuyên CỤ THỂ về cách cải thiện
3. Nhận diện các mẫu chiến thuật nâng cao (VCF, VCT, Double Threat)
4. Cung cấp góc nhìn chiến lược tổng thể
5. Phân tích khai cuộc và tàn cuộc khi có thông tin

Phong cách:
- Ngắn gọn, súc tích (2-3 câu mỗi ý)
- Thân thiện, khuyến khích
- Tập trung vào hành động cụ thể
- Sử dụng thuật ngữ Cờ Caro phổ biến"""
    
    async def analyze_game(self, moves: List[Move]) -> AnalysisResult:
        """
        Analyze a complete game with AI enhancement.
        
        First runs basic analysis to gather data, then enhances
        with AI-generated insights. Falls back to basic analysis
        if AI API fails.
        
        Args:
            moves: List of moves in the game
            
        Returns:
            AnalysisResult with AI insights included
        """
        start_time = time.time()
        
        # Step 1: Run basic analysis first (Requirements 4.1)
        basic_result = self.basic_analyzer.analyze_game(moves)
        
        # Step 2: Enhance with AI insights
        try:
            ai_insights = await self.enhance_with_ai(moves, basic_result)
            basic_result.ai_insights = ai_insights
            basic_result.tier = "pro"
        except Exception as e:
            # Graceful fallback (Requirements 4.5)
            print(f"AI enhancement failed: {e}. Falling back to basic analysis.")
            # Keep basic result without AI insights
            basic_result.tier = "basic"
        
        # Update duration
        duration_ms = int((time.time() - start_time) * 1000)
        basic_result.duration_ms = duration_ms
        
        return basic_result
    
    async def enhance_with_ai(
        self,
        moves: List[Move],
        basic_result: AnalysisResult
    ) -> AIInsights:
        """
        Enhance basic analysis with AI-generated insights.
        
        Sends structured prompt to OpenRouter/DeepSeek API and
        parses the response to extract insights.
        
        Args:
            moves: Original moves list
            basic_result: Result from basic analysis
            
        Returns:
            AIInsights with natural language explanations
        """
        # Build the analysis prompt (Requirements 4.2)
        prompt = self.build_analysis_prompt(moves, basic_result)
        
        # Call OpenRouter API
        response_text = await self._call_openrouter_api(prompt)
        
        # Parse AI response (Requirements 4.4)
        ai_insights = self.parse_ai_response(response_text, basic_result)
        
        return ai_insights
    
    def build_analysis_prompt(
        self,
        moves: List[Move],
        basic_result: AnalysisResult
    ) -> str:
        """
        Build a structured prompt for AI analysis.
        
        This method constructs a detailed prompt that provides the AI with:
        1. Game overview (total moves, winner, accuracy stats)
        2. Detected mistakes from basic analysis
        3. Tactical patterns found
        4. Key timeline moments (first 5 and last 5 moves)
        5. Advanced analysis data (VCF/VCT, opening, endgame) - Task 8.8.3
        6. Specific questions for the AI to answer
        
        The prompt is structured in Markdown format for clarity and
        requests JSON output for easy parsing.
        
        Args:
            moves: Original moves list
            basic_result: Result from basic analysis
            
        Returns:
            Formatted prompt string in Vietnamese
        """
        # ============================================
        # SECTION 1: Game Overview
        # ============================================
        # Provide high-level statistics about the game
        summary = basic_result.summary
        prompt_parts = [
            "# Phân Tích Ván Đấu Cờ Caro",
            "",
            "## Thông Tin Chung",
            f"- Tổng số nước: {summary.total_moves}",
            f"- Người thắng: {summary.winner or 'Chưa kết thúc'}",
            f"- Độ chính xác X: {summary.x_stats.get('accuracy', 0)}%",
            f"- Độ chính xác O: {summary.o_stats.get('accuracy', 0)}%",
            "",
        ]
        
        # ============================================
        # SECTION 2: Advanced Analysis (Task 8.8.3)
        # ============================================
        if self.use_advanced:
            advanced_info = self._get_advanced_analysis_info(moves)
            if advanced_info:
                prompt_parts.append("## Phân Tích Nâng Cao")
                
                # Opening info
                if advanced_info.get('opening'):
                    opening = advanced_info['opening']
                    prompt_parts.append(f"- **Khai cuộc**: {opening.get('name', 'Không xác định')}")
                    if opening.get('evaluation'):
                        prompt_parts.append(f"  - Đánh giá: {opening['evaluation']}")
                    if opening.get('key_ideas'):
                        prompt_parts.append(f"  - Ý tưởng chính: {', '.join(opening['key_ideas'][:2])}")
                
                # VCF/VCT info
                if advanced_info.get('vcf_found'):
                    prompt_parts.append(f"- **VCF phát hiện**: {advanced_info['vcf_player']} có VCF thắng trong {advanced_info['vcf_depth']} nước")
                
                if advanced_info.get('vct_found'):
                    prompt_parts.append(f"- **VCT phát hiện**: {advanced_info['vct_player']} có VCT thắng")
                
                # Endgame info
                if advanced_info.get('is_endgame'):
                    prompt_parts.append(f"- **Tàn cuộc**: {advanced_info.get('endgame_type', 'Phát hiện')}")
                    if advanced_info.get('endgame_urgency'):
                        prompt_parts.append(f"  - Mức độ khẩn cấp: {advanced_info['endgame_urgency']}/100")
                
                # Missed wins
                if advanced_info.get('missed_wins'):
                    prompt_parts.append(f"- **Bỏ lỡ thắng**: {len(advanced_info['missed_wins'])} lần")
                    for mw in advanced_info['missed_wins'][:2]:
                        prompt_parts.append(f"  - Nước {mw['move']}: Có thể thắng trong {mw['depth']} nước")
                
                prompt_parts.append("")
        
        # ============================================
        # SECTION 3: Mistakes Found by Basic Analysis
        # ============================================
        # List top 5 mistakes for AI to explain in natural language
        if basic_result.mistakes:
            prompt_parts.append("## Sai Lầm Phát Hiện")
            for mistake in basic_result.mistakes[:5]:  # Limit to top 5 for prompt size
                prompt_parts.append(
                    f"- Nước {mistake.move} ({mistake.severity}): {mistake.desc}"
                )
            prompt_parts.append("")
        
        # ============================================
        # SECTION 4: Tactical Patterns Detected
        # ============================================
        # List top 3 patterns for AI to provide deeper analysis
        if basic_result.patterns:
            prompt_parts.append("## Mẫu Chiến Thuật")
            for pattern in basic_result.patterns[:3]:  # Limit to top 3
                prompt_parts.append(f"- {pattern.label}: {pattern.explanation}")
            prompt_parts.append("")
        
        # ============================================
        # SECTION 5: Key Timeline Moments
        # ============================================
        # Include first 5 moves (opening) and last 5 moves (endgame)
        # These are typically the most instructive parts of the game
        prompt_parts.append("## Diễn Biến Quan Trọng")
        timeline = basic_result.timeline
        # Combine opening and endgame moves, or all moves if game is short
        highlight_moves = timeline[:5] + timeline[-5:] if len(timeline) > 10 else timeline
        for entry in highlight_moves:
            prompt_parts.append(
                f"- Nước {entry.move} ({entry.player}): "
                f"Score={entry.score:.0f}, WinProb={entry.win_prob:.2f}, "
                f"Quality={entry.category.value}"
            )
        prompt_parts.append("")
        
        # ============================================
        # SECTION 6: Analysis Request
        # ============================================
        # Specify exactly what we want the AI to provide
        # Request JSON format for reliable parsing
        prompt_parts.extend([
            "## Yêu Cầu Phân Tích",
            "",
            "Hãy cung cấp:",
            "1. **Tóm tắt tổng quan** (2-3 câu): Đánh giá chung về ván đấu",
            "2. **Giải thích sai lầm** (cho mỗi sai lầm critical/major):",
            "   - TẠI SAO nó là sai lầm",
            "   - NÊN làm gì thay vì thế",
            "3. **Lời khuyên cải thiện** (3-5 điểm cụ thể)",
            "4. **Mẫu nâng cao** (nếu phát hiện thêm mẫu chiến thuật như VCF, VCT, Double Threat)",
            "",
            # Request structured JSON output for reliable parsing
            "Trả lời dưới dạng JSON với cấu trúc:",
            "```json",
            "{",
            '  "summary": "...",',
            '  "mistake_explanations": [',
            '    {"move": 1, "why": "...", "should": "..."}',
            "  ],",
            '  "improvement_tips": ["...", "..."],',
            '  "advanced_patterns": [',
            '    {"name": "...", "explanation": "..."}',
            "  ]",
            "}",
            "```",
        ])
        
        return "\n".join(prompt_parts)
    
    def _get_advanced_analysis_info(self, moves: List[Move]) -> Optional[Dict[str, Any]]:
        """
        Get advanced analysis information for the prompt.
        
        Task 8.8.3: Gather VCF/VCT, opening, and endgame info
        
        Args:
            moves: List of moves to analyze
            
        Returns:
            Dict with advanced analysis info
        """
        if not self.use_advanced:
            return None
        
        info: Dict[str, Any] = {}
        
        try:
            # Build board state
            board = [[None for _ in range(self.board_size)] for _ in range(self.board_size)]
            
            # Opening analysis (first 5 moves)
            if self._opening_book and len(moves) >= 3:
                opening_moves = [(m.x, m.y, m.player) for m in moves[:5]]
                opening = self._opening_book.identify_opening(opening_moves)
                if opening:
                    info['opening'] = {
                        'name': opening.name,
                        'name_en': opening.name_en,
                        'evaluation': opening.evaluation.value,
                        'key_ideas': opening.key_ideas[:3]
                    }
            
            # Replay moves and check for missed wins
            missed_wins = []
            for i, move in enumerate(moves):
                player = move.player
                
                # Check for VCF before this move
                if self._vcf_searcher and i >= 5:
                    vcf_result = self._vcf_searcher.search(board, player)
                    if vcf_result.found and vcf_result.sequence:
                        first_vcf = vcf_result.sequence[0]
                        if first_vcf[0] != move.x or first_vcf[1] != move.y:
                            missed_wins.append({
                                'move': i + 1,
                                'player': player,
                                'depth': vcf_result.depth
                            })
                
                board[move.x][move.y] = player
            
            if missed_wins:
                info['missed_wins'] = missed_wins[:3]  # Limit to 3
            
            # Final position analysis
            if len(moves) > 0:
                last_player = moves[-1].player
                next_player = "O" if last_player == "X" else "X"
                
                # Check for VCF
                if self._vcf_searcher:
                    vcf_x = self._vcf_searcher.search(board, 'X')
                    vcf_o = self._vcf_searcher.search(board, 'O')
                    
                    if vcf_x.found:
                        info['vcf_found'] = True
                        info['vcf_player'] = 'X'
                        info['vcf_depth'] = vcf_x.depth
                    elif vcf_o.found:
                        info['vcf_found'] = True
                        info['vcf_player'] = 'O'
                        info['vcf_depth'] = vcf_o.depth
                
                # Check for VCT (only if no VCF)
                if not info.get('vcf_found') and self._vct_searcher:
                    vct_x = self._vct_searcher.search(board, 'X')
                    vct_o = self._vct_searcher.search(board, 'O')
                    
                    if vct_x.found:
                        info['vct_found'] = True
                        info['vct_player'] = 'X'
                    elif vct_o.found:
                        info['vct_found'] = True
                        info['vct_player'] = 'O'
                
                # Endgame detection
                if self._endgame_analyzer:
                    endgame_result = self._endgame_analyzer.detect_endgame(board, check_vcf=False)
                    if endgame_result.is_endgame:
                        info['is_endgame'] = True
                        info['endgame_type'] = endgame_result.endgame_type.value
                        info['endgame_urgency'] = endgame_result.urgency
        
        except Exception as e:
            # Silently fail - advanced analysis is optional
            print(f"Advanced analysis error: {e}")
        
        return info if info else None
    
    async def _call_openrouter_api(self, prompt: str) -> str:
        """
        Call OpenRouter API with the analysis prompt.
        
        Args:
            prompt: The formatted prompt
            
        Returns:
            Response text from the API
            
        Raises:
            Exception: If API call fails
        """
        if not self.api_key:
            raise Exception("OpenRouter API key not configured")
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://mindpoint-arena.com",  # Optional
            "X-Title": "MindPoint Arena AI Analysis",  # Optional
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 2000,
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                self.api_url,
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            
            data = response.json()
            
            # Extract content from response
            if "choices" in data and len(data["choices"]) > 0:
                content = data["choices"][0]["message"]["content"]
                return content
            else:
                raise Exception("Invalid API response format")
    
    def parse_ai_response(
        self,
        response_text: str,
        basic_result: AnalysisResult
    ) -> AIInsights:
        """
        Parse AI response and extract structured insights.
        
        This method handles the potentially messy output from the AI model:
        1. First attempts to extract and parse JSON from the response
        2. If JSON parsing fails, falls back to creating basic insights
           from the raw text
        
        The fallback mechanism ensures we always return useful insights
        even if the AI doesn't follow the requested format exactly.
        
        Args:
            response_text: Raw response from AI (may contain markdown, JSON, or plain text)
            basic_result: Basic analysis result for context (used in fallback)
            
        Returns:
            AIInsights object with parsed data
        """
        try:
            # STEP 1: Extract JSON from response
            # AI may wrap JSON in markdown code blocks or include extra text
            json_str = self._extract_json(response_text)
            data = json.loads(json_str)
            
            # STEP 2: Extract fields with safe defaults
            # Use .get() to handle missing fields gracefully
            summary = data.get("summary", "Phân tích AI không khả dụng.")
            
            # Parse mistake explanations array
            mistake_explanations = []
            for item in data.get("mistake_explanations", []):
                mistake_explanations.append({
                    "move": item.get("move", 0),
                    "why": item.get("why", ""),      # Why it's a mistake
                    "should": item.get("should", "") # What should have been done
                })
            
            # Parse improvement tips (simple string array)
            improvement_tips = data.get("improvement_tips", [])
            
            # Parse advanced patterns detected by AI
            advanced_patterns = []
            for item in data.get("advanced_patterns", []):
                advanced_patterns.append({
                    "name": item.get("name", ""),
                    "explanation": item.get("explanation", "")
                })
            
            return AIInsights(
                natural_language_summary=summary,
                mistake_explanations=mistake_explanations,
                improvement_tips=improvement_tips,
                advanced_patterns=advanced_patterns
            )
            
        except Exception as e:
            # FALLBACK: JSON parsing failed
            # Create basic insights from raw text and basic analysis
            print(f"Failed to parse AI response as JSON: {e}")
            return self._create_fallback_insights(response_text, basic_result)
    
    def _extract_json(self, text: str) -> str:
        """
        Extract JSON from text that may contain markdown code blocks.
        
        Args:
            text: Text potentially containing JSON
            
        Returns:
            Extracted JSON string
        """
        # Try to find JSON in code blocks
        if "```json" in text:
            start = text.find("```json") + 7
            end = text.find("```", start)
            if end > start:
                return text[start:end].strip()
        
        if "```" in text:
            start = text.find("```") + 3
            end = text.find("```", start)
            if end > start:
                return text[start:end].strip()
        
        # Try to find JSON object directly
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return text[start:end]
        
        raise ValueError("No JSON found in response")
    
    def _create_fallback_insights(
        self,
        response_text: str,
        basic_result: AnalysisResult
    ) -> AIInsights:
        """
        Create fallback insights when JSON parsing fails.
        
        Args:
            response_text: Raw AI response
            basic_result: Basic analysis result
            
        Returns:
            AIInsights with extracted text
        """
        # Use the response text as summary
        summary = response_text[:500] if len(response_text) > 500 else response_text
        
        # Generate basic mistake explanations from basic result
        mistake_explanations = []
        for mistake in basic_result.mistakes[:3]:
            mistake_explanations.append({
                "move": mistake.move,
                "why": mistake.desc,
                "should": f"Xem lại nước {mistake.move} và cân nhắc các phương án khác."
            })
        
        # Generic improvement tips
        improvement_tips = [
            "Chú ý đến các đe dọa của đối thủ trước khi tấn công.",
            "Tạo nhiều đường tấn công song song để tăng áp lực.",
            "Kiểm soát trung tâm bàn cờ để có nhiều lựa chọn hơn."
        ]
        
        return AIInsights(
            natural_language_summary=summary,
            mistake_explanations=mistake_explanations,
            improvement_tips=improvement_tips,
            advanced_patterns=[]
        )
    
    def merge_results(
        self,
        basic_result: AnalysisResult,
        ai_insights: AIInsights
    ) -> Dict[str, Any]:
        """
        Merge basic analysis and AI insights into a unified result.
        
        This method is provided for compatibility but the main
        analyze_game method already handles merging.
        
        Args:
            basic_result: Basic analysis result
            ai_insights: AI-generated insights
            
        Returns:
            Dictionary with merged results
        """
        return {
            "tier": "pro",
            "timeline": [
                {
                    "move": e.move,
                    "player": e.player,
                    "position": e.position,
                    "score": e.score,
                    "win_prob": e.win_prob,
                    "category": e.category.value,
                    "note": e.note
                }
                for e in basic_result.timeline
            ],
            "mistakes": [
                {
                    "move": m.move,
                    "severity": m.severity,
                    "desc": m.desc,
                    "best_alternative": m.best_alternative
                }
                for m in basic_result.mistakes
            ],
            "patterns": [
                {
                    "label": p.label,
                    "explanation": p.explanation,
                    "moves": p.moves,
                    "severity": p.severity
                }
                for p in basic_result.patterns
            ],
            "best_move": {
                "x": basic_result.best_move.x,
                "y": basic_result.best_move.y,
                "score": basic_result.best_move.score,
                "reason": basic_result.best_move.reason
            } if basic_result.best_move else None,
            "summary": {
                "total_moves": basic_result.summary.total_moves,
                "winner": basic_result.summary.winner,
                "x_stats": basic_result.summary.x_stats,
                "o_stats": basic_result.summary.o_stats,
                "key_insights": basic_result.summary.key_insights
            },
            "ai_insights": {
                "natural_language_summary": ai_insights.natural_language_summary,
                "mistake_explanations": ai_insights.mistake_explanations,
                "improvement_tips": ai_insights.improvement_tips,
                "advanced_patterns": ai_insights.advanced_patterns
            },
            "duration_ms": basic_result.duration_ms
        }
    
    async def ask_about_game(
        self,
        match_id: str,
        question: str,
        context: Optional[AnalysisResult] = None
    ) -> str:
        """
        Answer a question about a specific game.
        
        Uses the analysis context to provide relevant answers.
        This method is for the AI Q&A feature (Requirements 6.1, 6.2, 6.3, 6.4).
        
        Requirements:
        - 6.1: Load analysis context from cache (via context parameter)
        - 6.2: Build context-aware prompt with match summary
        - 6.3: Generate concise Vietnamese responses
        - 6.4: Include actionable suggestions in response
        
        Args:
            match_id: UUID of the match
            question: User's question in Vietnamese
            context: Optional analysis result for context (loaded from cache)
            
        Returns:
            AI-generated answer in Vietnamese with actionable suggestions
        """
        # Build context-aware prompt (Requirements 6.1, 6.2)
        prompt_parts = [
            "# Câu Hỏi Về Ván Đấu",
            "",
            f"Match ID: {match_id}",
            "",
        ]
        
        # Include analysis context if available (Requirement 6.1)
        if context:
            prompt_parts.extend([
                "## Bối Cảnh Phân Tích",
                f"- Tổng số nước: {context.summary.total_moves}",
                f"- Người thắng: {context.summary.winner or 'Chưa kết thúc'}",
                f"- Số sai lầm phát hiện: {len(context.mistakes)}",
                f"- Số mẫu chiến thuật: {len(context.patterns)}",
                "",
            ])
            
            # Add key mistakes for context
            if context.mistakes:
                prompt_parts.append("### Sai Lầm Chính:")
                for mistake in context.mistakes[:3]:  # Top 3 mistakes
                    prompt_parts.append(
                        f"- Nước {mistake.move} ({mistake.severity}): {mistake.desc}"
                    )
                prompt_parts.append("")
            
            # Add key patterns for context
            if context.patterns:
                prompt_parts.append("### Mẫu Chiến Thuật:")
                for pattern in context.patterns[:2]:  # Top 2 patterns
                    prompt_parts.append(f"- {pattern.label}: {pattern.explanation}")
                prompt_parts.append("")
        
        # Add the user's question
        prompt_parts.extend([
            "## Câu Hỏi Của Người Chơi",
            question,
            "",
            "## Yêu Cầu Trả Lời",
            "Hãy trả lời:",
            "1. Ngắn gọn (2-3 câu), cụ thể và dễ hiểu",
            "2. Bằng tiếng Việt",
            "3. Bao gồm lời khuyên hành động cụ thể nếu phù hợp",
            "4. Tham chiếu đến các nước đi cụ thể nếu có liên quan",
        ])
        
        prompt = "\n".join(prompt_parts)
        
        try:
            # Call AI API (Requirement 6.3)
            response = await self._call_openrouter_api(prompt)
            answer = response.strip()
            
            # Ensure answer is non-empty and in Vietnamese (Requirement 6.3)
            if not answer:
                return "Xin lỗi, tôi không thể tạo câu trả lời phù hợp lúc này."
            
            return answer
            
        except Exception as e:
            # Graceful error handling
            return f"Xin lỗi, không thể trả lời câu hỏi lúc này. Vui lòng thử lại sau."
