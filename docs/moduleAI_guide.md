# Plan Chi Tiết: Hệ Thống AI Phân Tích Trận Đấu Caro

## Tổng Quan

Xây dựng hệ thống AI phân tích trận đấu Caro với **2 tiers** (Basic & Pro) giúp người chơi nâng cao trình độ:

### **Tier 1: Free** (Miễn phí)
- Basic analysis: **3 trận/ngày**
- Rule-based algorithm (nhanh < 2s)
- Đánh giá cơ bản: điểm số, mistakes, best moves
- Ngôn từ template-based
- ❌ Không có Pro analysis
- ❌ Không có Replay
- ❌ Không có AI Q&A

### **Tier 2: Trial** (Dùng thử miễn phí)
- Basic analysis: **5 trận/ngày**
- **Pro analysis: 5 trận/ngày** (AI-powered)
- **Interactive Replay: 5 sessions/ngày** 🔥
- Natural language insights
- ❌ Không có AI Q&A chat
- ⏰ Tự động expire sau 7 ngày

### **Tier 3: Pro** (Premium - $9.99/month)
- Basic analysis: **Unlimited**
- Pro analysis: **50 trận/tháng**
- Interactive Replay: **20 sessions/tháng**
- AI Q&A Chat: **100 câu hỏi/tháng**
- Natural language insights
- Pattern detection nâng cao
- Export PDF

### **Tier 4: Pro Plus** (Premium - $19.99/month)
- **Everything Unlimited**
- Priority analysis (faster queue)
- API access
- Advanced statistics
- Coach mode (coming soon)

## Mục Tiêu

1. **Backend**: Dual analysis engines (Rule-based + AI-powered)
2. **Frontend UI**: Single-screen layout với tier selection
3. **Interactive Replay**: Replay mode với AI opponent
4. **Monetization**: Clear value proposition cho Pro tier

---

## Phase 1: Backend - Dual Analysis Engines

### 1.1 Basic Analysis Engine (Rule-Based)

**File**: `ai/analysis/basic_analyzer.py`

#### 1.1.1 Threat Detection System

**Prompt cho AI**:
```
Tạo file ai/analysis/threat_detector.py:

1. Implement ThreatDetector class:
   - scan_line(): Quét 1 line (ngang/dọc/chéo) tìm threats
   - detect_all_threats(): Quét toàn bộ board
   - classify_threat(): Phân loại threat (five, open_four, four, open_three, ...)

2. Threat types và scores:
   - FIVE (5 liên tiếp): 100000 points → Thắng ngay
   - OPEN_FOUR (4 liên tiếp, 2 đầu trống): 10000 → Thắng trong 1 nước
   - FOUR (4 liên tiếp, 1 đầu trống): 1000 → Đối thủ phải chặn
   - OPEN_THREE (3 liên tiếp, 2 đầu trống): 500 → Tạo nhiều đường tấn công
   - THREE (3 liên tiếp): 100
   - OPEN_TWO (2 liên tiếp, 2 đầu trống): 10

3. Return format:
{
  "threats": {
    "five": 0,
    "open_four": 1,
    "four": 2,
    "open_three": 3,
    "three": 5,
    "open_two": 8
  },
  "total_score": 12850,
  "threat_positions": [
    {"type": "open_four", "positions": [(7,7), (7,8), (7,9), (7,10)], "direction": "horizontal"}
  ]
}
```

#### 1.1.2 Position Evaluator

**Prompt cho AI**:
```
Tạo file ai/analysis/position_evaluator.py:

1. Implement PositionEvaluator class:
   - evaluate_position(board, player): Đánh giá vị trí cho 1 player
   - evaluate_move(board, move): Đánh giá 1 nước đi cụ thể
   - calculate_win_probability(score): Convert score → win probability

2. Evaluation logic:
   # Đánh giá cho player hiện tại
   my_threats = threat_detector.detect_all_threats(board, current_player)
   opponent_threats = threat_detector.detect_all_threats(board, opponent)
   
   # Tính điểm
   score = my_threats.total_score - opponent_threats.total_score * 0.9
   
   # Bonus cho vị trí chiến lược
   score += position_bonus(move)  # Trung tâm > cạnh > góc
   
   # Win probability (sigmoid function)
   win_prob = 1 / (1 + exp(-score / 2000))

3. Move classification:
   - excellent: score >= 85
   - good: 70 <= score < 85
   - okay: 50 <= score < 70
   - weak: 30 <= score < 50
   - blunder: score < 30
```

#### 1.1.3 Basic Analyzer Main Logic

**Prompt cho AI**:
```
Tạo file ai/analysis/basic_analyzer.py:

1. Implement BasicAnalyzer class:

class BasicAnalyzer:
    def __init__(self):
        self.threat_detector = ThreatDetector()
        self.position_evaluator = PositionEvaluator()
        self.transposition_table = {}  # Cache
    
    def analyze_game(self, moves: List[Move]) -> AnalysisResult:
        """
        Phân tích toàn bộ ván đấu
        """
        timeline = []
        mistakes = []
        patterns = []
        board = Board(15, 15)
        
        for i, move in enumerate(moves):
            # Evaluate trước khi đi
            before_eval = self.position_evaluator.evaluate_position(board, move.player)
            
            # Tìm best move (minimax depth 4 cho basic)
            best_moves = self.find_best_moves(board, move.player, depth=4, top_n=3)
            
            # Thực hiện nước đi
            board.make_move(move)
            after_eval = self.position_evaluator.evaluate_position(board, move.player)
            
            # So sánh với best move
            move_quality = self.classify_move(move, best_moves[0])
            
            # Add to timeline
            timeline.append({
                "move": i + 1,
                "player": move.player,
                "position": {"x": move.x, "y": move.y},
                "score": after_eval.score,
                "win_prob": after_eval.win_probability,
                "category": move_quality,
                "note": self.generate_note(move, move_quality, before_eval, after_eval)
            })
            
            # Detect mistakes
            if move_quality in ['weak', 'blunder']:
                mistakes.append({
                    "move": i + 1,
                    "severity": "critical" if move_quality == "blunder" else "major",
                    "desc": f"Nước đi yếu. Tốt hơn: ({best_moves[0].x+1},{best_moves[0].y+1})",
                    "best_alternative": best_moves[0]
                })
        
        # Detect patterns
        patterns = self.detect_patterns(timeline)
        
        return {
            "tier": "basic",
            "timeline": timeline,
            "mistakes": mistakes,
            "patterns": patterns,
            "best_move": best_moves[0] if best_moves else None,
            "summary": self.generate_summary(timeline, mistakes)
        }
    
    def generate_note(self, move, quality, before, after):
        """
        Generate template-based note (cứng, không đa dạng)
        """
        templates = {
            "excellent": "Nước đi tốt nhất",
            "good": "Nước đi tốt",
            "okay": "Nước đi chấp nhận được",
            "weak": "Nước đi yếu",
            "blunder": "Sai lầm nghiêm trọng"
        }
        
        note = templates[quality]
        
        # Thêm context
        if after.threats['open_four'] > before.threats['open_four']:
            note += ", tạo đường 4"
        elif after.threats['open_three'] > before.threats['open_three']:
            note += ", tạo đường 3"
        
        return note
```

### 1.2 Pro Analysis Engine (AI-Powered)

**File**: `ai/analysis/pro_analyzer.py`

#### 1.2.1 AI Analysis với OpenRouter/DeepSeek

**Prompt cho AI**:
```
Tạo file ai/analysis/pro_analyzer.py:

1. Implement ProAnalyzer class:

class ProAnalyzer:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.basic_analyzer = BasicAnalyzer()  # Fallback
        self.ai_client = OpenRouterClient(api_key)
    
    async def analyze_game(self, moves: List[Move]) -> AnalysisResult:
        """
        AI-powered analysis với natural language
        """
        # 1. Chạy basic analysis trước (để có data)
        basic_result = self.basic_analyzer.analyze_game(moves)
        
        # 2. Gửi lên AI để enhance
        enhanced_result = await self.enhance_with_ai(moves, basic_result)
        
        return {
            "tier": "pro",
            **enhanced_result
        }
    
    async def enhance_with_ai(self, moves, basic_result):
        """
        Dùng AI để:
        - Generate natural language explanations
        - Detect advanced patterns
        - Provide personalized insights
        """
        prompt = self.build_analysis_prompt(moves, basic_result)
        
        response = await self.ai_client.chat_completion(
            model="deepseek/deepseek-chat",
            messages=[
                {"role": "system", "content": GOMOKU_EXPERT_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        
        # Parse AI response
        ai_insights = self.parse_ai_response(response)
        
        # Merge với basic result
        return self.merge_results(basic_result, ai_insights)
    
    def build_analysis_prompt(self, moves, basic_result):
        """
        Build prompt cho AI
        """
        return f"""
Bạn là chuyên gia Cờ Caro/Gomoku. Phân tích ván đấu sau:

**Thông tin cơ bản:**
- Tổng số nước: {len(moves)}
- Kết quả: {basic_result['summary']['result']}
- Mistakes phát hiện: {len(basic_result['mistakes'])}

**Timeline (10 nước quan trọng nhất):**
{self.format_timeline(basic_result['timeline'][:10])}

**Mistakes đã phát hiện:**
{self.format_mistakes(basic_result['mistakes'])}

**Yêu cầu:**
1. Phân tích chiến thuật tổng thể của 2 bên
2. Giải thích chi tiết 3 mistakes nghiêm trọng nhất (WHY it's bad, WHAT should do)
3. Phát hiện patterns nâng cao (VD: Song Song, Tứ Hướng, ...)
4. Đưa ra lời khuyên cụ thể để cải thiện

**Format JSON:**
{{
  "overall_analysis": "...",
  "key_mistakes_explained": [
    {{
      "move": 12,
      "explanation": "Nước này yếu vì...",
      "better_approach": "Nên đi ... để ..."
    }}
  ],
  "patterns_detected": [...],
  "improvement_tips": [...]
}}
"""

GOMOKU_EXPERT_SYSTEM_PROMPT = """
Bạn là chuyên gia Cờ Caro/Gomoku với 20 năm kinh nghiệm.
Nhiệm vụ: Phân tích ván đấu và giúp người chơi cải thiện kỹ năng.
Phong cách: Thân thiện, dễ hiểu, cụ thể, có ví dụ.
Ngôn ngữ: Tiếng Việt tự nhiên, không cứng nhắc.
"""
```

#### 1.2.2 Conversational Q&A về Ván Đấu

**Prompt cho AI**:
```
Thêm vào ProAnalyzer:

async def ask_about_game(self, match_id: str, question: str, context: dict) -> str:
    """
    Cho phép user hỏi về ván đấu
    
    Examples:
    - "Tại sao nước 12 của tôi lại là mistake?"
    - "Nếu tôi đi (8,9) thay vì (7,8) thì sao?"
    - "Đối thủ có pattern gì đặc biệt không?"
    """
    # Load analysis result từ cache
    analysis = await self.get_cached_analysis(match_id)
    
    # Build context-aware prompt
    prompt = f"""
Ván đấu ID: {match_id}

**Analysis summary:**
{json.dumps(analysis['summary'], ensure_ascii=False)}

**User question:**
{question}

Trả lời ngắn gọn, cụ thể, dễ hiểu.
"""
    
    response = await self.ai_client.chat_completion(
        model="deepseek/deepseek-chat",
        messages=[
            {"role": "system", "content": GOMOKU_EXPERT_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0.8
    )
    
    return response.choices[0].message.content
```

### 1.3 API Endpoints

**File**: `ai/api/analyze.py`

#### 1.3.1 POST /analyze - Main Analysis Endpoint

**Prompt cho AI**:
```
Tạo endpoint trong ai/api/analyze.py:

@app.post("/analyze")
async def analyze_match(request: AnalyzeRequest):
    """
    Phân tích ván đấu
    
    Request:
    {
      "match_id": "abc-123",
      "moves": [...],
      "tier": "basic" | "pro",  // User chọn tier
      "user_id": "user-456"     // Để check subscription
    }
    """
    # 1. Validate request
    if not request.moves:
        raise HTTPException(400, "No moves provided")
    
    # 2. Check tier permission
    if request.tier == "pro":
        has_permission = await check_pro_subscription(request.user_id)
        if not has_permission:
            return {"error": "Pro tier requires subscription"}
    
    # 3. Check cache
    cache_key = f"{request.match_id}:{request.tier}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # 4. Run analysis
    if request.tier == "basic":
        analyzer = BasicAnalyzer()
        result = analyzer.analyze_game(request.moves)
    else:
        analyzer = ProAnalyzer(api_key=settings.OPENROUTER_API_KEY)
        result = await analyzer.analyze_game(request.moves)
    
    # 5. Cache result (1 hour)
    await redis.setex(cache_key, 3600, json.dumps(result))
    
    return result
```

#### 1.3.2 POST /ask - Conversational Q&A (Pro Only)

**Prompt cho AI**:
```
@app.post("/ask")
async def ask_about_match(request: AskRequest):
    """
    Hỏi đáp về ván đấu (Pro tier only)
    
    Request:
    {
      "match_id": "abc-123",
      "question": "Tại sao nước 12 là mistake?",
      "user_id": "user-456"
    }
    """
    # Check pro subscription
    has_permission = await check_pro_subscription(request.user_id)
    if not has_permission:
        raise HTTPException(403, "Pro tier required")
    
    # Rate limiting: 20 questions/day
    usage = await get_daily_usage(request.user_id)
    if usage >= 20:
        raise HTTPException(429, "Daily limit reached")
    
    # Get answer from AI
    analyzer = ProAnalyzer(api_key=settings.OPENROUTER_API_KEY)
    answer = await analyzer.ask_about_game(
        match_id=request.match_id,
        question=request.question,
        context={}
    )
    
    # Increment usage
    await increment_daily_usage(request.user_id)
    
    return {"answer": answer}
```

### 1.4 Interactive Replay Engine (Pro Feature)

**File**: `ai/replay/replay_engine.py`

#### 1.4.1 Replay Session Management

**Prompt cho AI**:
```
Tạo file ai/replay/replay_engine.py:

class ReplayEngine:
    """
    Cho phép user replay ván đấu và chơi lại với AI từ bất kỳ nước nào
    """
    def __init__(self):
        self.ai_opponent = AIOpponent(difficulty="adaptive")
        self.sessions = {}  # Active replay sessions
    
    def create_replay_session(self, match_id: str, original_moves: List[Move]) -> str:
        """
        Tạo replay session
        """
        session_id = generate_uuid()
        self.sessions[session_id] = {
            "match_id": match_id,
            "original_moves": original_moves,
            "current_board": Board(15, 15),
            "current_move_index": 0,
            "mode": "replay",  # "replay" | "play_from_here" | "what_if"
            "divergence_point": None
        }
        return session_id
    
    def navigate_to_move(self, session_id: str, move_index: int):
        """
        Navigate đến nước thứ N
        """
        session = self.sessions[session_id]
        board = Board(15, 15)
        
        # Replay đến nước đó
        for i in range(move_index):
            board.make_move(session['original_moves'][i])
        
        session['current_board'] = board
        session['current_move_index'] = move_index
        
        return {
            "board_state": board.to_array(),
            "current_move": move_index,
            "next_player": "X" if move_index % 2 == 0 else "O"
        }
    
    async def play_from_here(self, session_id: str, user_move: Move):
        """
        User chọn "Chơi lại từ đây" và đi nước khác
        """
        session = self.sessions[session_id]
        
        # Mark divergence point
        if session['mode'] == 'replay':
            session['mode'] = 'what_if'
            session['divergence_point'] = session['current_move_index']
        
        # Apply user move
        board = session['current_board']
        board.make_move(user_move)
        
        # AI response
        ai_move = await self.ai_opponent.get_best_move(board)
        board.make_move(ai_move)
        
        # Check game over
        game_over, winner = board.check_game_over()
        
        return {
            "user_move": user_move,
            "ai_move": ai_move,
            "board_state": board.to_array(),
            "game_over": game_over,
            "winner": winner,
            "analysis": await self.analyze_divergence(session)
        }
    
    async def analyze_divergence(self, session):
        """
        So sánh nhánh mới với nhánh gốc
        """
        original_outcome = session['original_moves'][-1].result
        current_board = session['current_board']
        
        # Evaluate current position
        evaluator = PositionEvaluator()
        current_eval = evaluator.evaluate_position(current_board, "X")
        
        return {
            "original_outcome": original_outcome,
            "current_win_prob": current_eval.win_probability,
            "comparison": "better" if current_eval.win_probability > 0.5 else "worse"
        }
```

#### 1.4.2 API Endpoints cho Replay

**Prompt cho AI**:
```
Thêm vào ai/api/replay.py:

@app.post("/replay/create")
async def create_replay_session(request: CreateReplayRequest):
    """
    Tạo replay session
    
    Request:
    {
      "match_id": "abc-123",
      "user_id": "user-456"
    }
    """
    # Check pro subscription
    has_permission = await check_pro_subscription(request.user_id)
    if not has_permission:
        raise HTTPException(403, "Pro tier required for replay")
    
    # Load match moves
    moves = await load_match_moves(request.match_id)
    
    # Create session
    replay_engine = ReplayEngine()
    session_id = replay_engine.create_replay_session(request.match_id, moves)
    
    return {
        "session_id": session_id,
        "total_moves": len(moves)
    }

@app.post("/replay/navigate")
async def navigate_replay(request: NavigateRequest):
    """
    Navigate đến nước thứ N
    """
    replay_engine = ReplayEngine()
    result = replay_engine.navigate_to_move(
        session_id=request.session_id,
        move_index=request.move_index
    )
    return result

@app.post("/replay/play")
async def play_from_position(request: PlayRequest):
    """
    User chọn đi nước khác, AI response
    """
    replay_engine = ReplayEngine()
    result = await replay_engine.play_from_here(
        session_id=request.session_id,
        user_move=request.move
    )
    return result

@app.post("/replay/compare")
async def compare_branches(request: CompareRequest):
    """
    So sánh nhánh mới vs nhánh gốc
    """
    # Return side-by-side comparison
    return {
        "original_branch": {...},
        "new_branch": {...},
        "analysis": "Nhánh mới tốt hơn vì..."
    }
```

---

## Phase 2: Redesign Frontend UI

### 2.1 Layout Mới với Tier Selection

**File**: `frontend/src/pages/AiAnalysis.tsx`

#### 2.1.1 Grid Layout với Tier Badge

**Prompt cho AI**:
```
Trong AiAnalysis.tsx, thay đổi layout thành:

```
┌──────────────────────────────────────────────────────────────┐
│ Header: Title + [Basic/Pro Toggle] + Controls               │
├──────────────┬──────────────────────┬────────────────────────┤
│              │                      │                        │
│  Match List  │    Board + Controls  │   Analysis Panel       │
│  (Sidebar)   │    (Center)          │   (Right - Tabbed)     │
│              │                      │                        │
│  - Recent    │  - 15x15 Board       │ [Basic] Tab:           │
│  - Filters   │  - Move slider       │  - Summary             │
│  - Search    │  - Play/Pause        │  - Mistakes (template) │
│              │  - Score chart       │  - Best moves          │
│              │                      │                        │
│              │  [Pro Only]:         │ [Pro] Tab:             │
│              │  - "Chơi lại" button │  - AI Insights         │
│              │  - "Hỏi AI" button   │  - Natural language    │
│              │                      │  - Q&A chat            │
│              │                      │  - Replay controls     │
└──────────────┴──────────────────────┴────────────────────────┘
```

State management:
```typescript
interface AnalysisState {
  tier: 'basic' | 'pro'
  mode: 'analysis' | 'replay' | 'what-if'
  hasProAccess: boolean
  replaySessionId: string | null
}
```

CSS Grid:
```css
.analysis-container {
  display: grid;
  grid-template-columns: 280px 1fr 380px;
  grid-template-rows: auto 1fr;
  height: calc(100vh - 40px);
  gap: 12px;
}
```
```

#### 2.1.2 Compact Match List Sidebar

**Prompt cho AI**:
```
Tạo component MatchListSidebar:

1. Features:
   - Virtual scrolling cho 100+ matches
   - Quick filters: AI matches only, My matches, Date range
   - Search by match ID
   - Compact card: ID + result + date (1 line)

2. Component structure:
<MatchListSidebar
  matches={matches}
  selectedId={selectedId}
  onSelect={setSelectedId}
  loading={loadingMatches}
/>

3. Styling:
   - Height: 100%, overflow-y: auto
   - Each item: 40px height
   - Hover effect + selected highlight
```

### 2.2 Interactive Board Panel

#### 2.2.1 Board với Move Navigation

**Prompt cho AI**:
```
Tạo component InteractiveBoardPanel:

1. Features:
   - Hiển thị board 15x15 với pieces
   - Slider để navigate qua từng nước (1 -> total_moves)
   - Play/Pause button để auto-play
   - Highlight best move và mistakes
   - Click vào ô để xem analysis của nước đó

2. State management:
   - currentMoveIndex: number (0 = empty board, 1 = sau nước 1)
   - isPlaying: boolean
   - playSpeed: 500ms | 1000ms | 2000ms

3. Visual indicators:
   - Best move: green border
   - Mistake: red border
   - Current move: pulsing animation
```

#### 2.2.2 Score Timeline Chart

**Prompt cho AI**:
```
Thêm mini chart dưới board:

1. Sử dụng recharts hoặc canvas
2. X-axis: Move number (1 -> N)
3. Y-axis: Score (0-100) hoặc Win Probability (0-1)
4. 2 lines: Player X (blue) và Player O (orange)
5. Hover để xem details của nước đó
6. Click để jump đến nước đó

Component:
<ScoreTimeline
  timeline={timeline}
  currentMove={currentMoveIndex}
  onMoveClick={setCurrentMoveIndex}
/>
```

### 2.3 Analysis Panel với Tabs

#### 2.3.1 Tabbed Analysis View

**Prompt cho AI**:
```
Tạo component AnalysisPanel với tabs:

Tabs:
1. "Tổng Quan" - Summary
2. "Sai Lầm" - Mistakes (count badge)
3. "Patterns" - Detected patterns
4. "Đề Xuất" - Alternative moves

Layout:
<AnalysisPanel>
  <Tabs>
    <Tab label="Tổng Quan" badge={null}>
      <SummaryView />
    </Tab>
    <Tab label="Sai Lầm" badge={mistakes.length}>
      <MistakesView />
    </Tab>
    <Tab label="Patterns" badge={patterns.length}>
      <PatternsView />
    </Tab>
    <Tab label="Đề Xuất" badge={altPlans.length}>
      <AlternativesView />
    </Tab>
  </Tabs>
</AnalysisPanel>

Styling:
- Fixed height, scrollable content
- Compact spacing
- Collapsible sections
```

#### 2.3.2 Summary View Component

**Prompt cho AI**:
```
Trong SummaryView, hiển thị:

1. Match Info Card (compact):
   - Match ID, Type, Result, Date
   - Total moves, Duration
   - Difficulty used for analysis

2. Overall Stats:
   - Player X: Avg score, Mistakes count, Best move
   - Player O: Avg score, Mistakes count, Best move

3. Key Insights (top 3):
   - "Người chơi X có 3 sai lầm nghiêm trọng ở nước 12, 18, 24"
   - "Người chơi O bỏ lỡ cơ hội thắng ở nước 31"
   - "Phát hiện pattern 'Song Song' ở nước 15-17"

Layout: Vertical stack, max 300px height
```

#### 2.3.3 Mistakes View với Dropdown

**Prompt cho AI**:
```
Trong MistakesView:

1. Group mistakes by severity:
   - Critical (red)
   - Major (orange)
   - Minor (yellow)

2. Each mistake item:
<MistakeCard
  move={12}
  player="X"
  severity="critical"
  description="Bỏ lỡ nước thắng"
  onClick={() => jumpToMove(12)}
>
  <Dropdown>
    <DropdownItem>Xem nước đi này</DropdownItem>
    <DropdownItem>Xem đề xuất thay thế</DropdownItem>
  </Dropdown>
</MistakeCard>

3. Click vào mistake:
   - Jump board đến nước đó
   - Highlight mistake trên board
   - Show alternatives trong modal
```

#### 2.3.4 Patterns View

**Prompt cho AI**:
```
Trong PatternsView:

1. List detected patterns với icon:
   - 🎯 Tứ Hướng
   - ⚡ Song Song
   - 🛡️ Chặn Muộn
   - ❌ Bỏ Lỡ Thắng

2. Each pattern card:
<PatternCard
  icon="🎯"
  label="Tứ Hướng"
  explanation="Nước 15 tạo 4 hướng tấn công..."
  moves={[15, 17]}
  severity="critical"
  onViewMoves={() => highlightMoves([15, 17])}
/>

3. Compact layout: 2 columns grid
```

#### 2.3.5 Alternatives View với Modal

**Prompt cho AI**:
```
Trong AlternativesView:

1. List alternatives grouped by move:
<AlternativeGroup move={12}>
  <AlternativeOption
    position={{x: 7, y: 8}}
    score={78}
    reason="Tạo đường 3 + chặn đường 4"
    winProbChange={+0.15}
    onPreview={() => showPreviewModal()}
  />
</AlternativeGroup>

2. Preview Modal:
   - Show board với alternative move highlighted
   - Show score comparison: Original vs Alternative
   - Show explanation
   - Button: "Đóng"

Modal trigger: Click vào alternative option
```

### 2.4 Controls và Interactions

#### 2.4.1 Top Controls Bar với Tier Toggle

**Prompt cho AI**:
```
Redesign controls bar:

Layout (horizontal):
[Tier Toggle: Basic/Pro] [Match Select] [Analyze Button] [Mode Buttons] [Close]

1. Tier Toggle với Trial Badge:
<TierToggle
  current={tier}
  hasProAccess={hasProAccess}
  isTrialActive={isTrialActive}
  trialDaysLeft={trialDaysLeft}
  onChange={setTier}
>
  <TierOption value="basic" icon="⚡">
    Basic
    <UsageIndicator>
      {dailyUsage.basic}/3 hôm nay
    </UsageIndicator>
  </TierOption>
  
  <TierOption 
    value="pro" 
    icon={isTrialActive ? "🎁" : "👑"} 
    locked={!hasProAccess && !isTrialActive}
  >
    {isTrialActive ? (
      <>
        Trial
        <TrialBadge>
          Còn {trialDaysLeft} ngày
        </TrialBadge>
        <UsageIndicator>
          {dailyUsage.pro}/5 hôm nay
        </UsageIndicator>
      </>
    ) : (
      <>
        Pro
        {!hasProAccess && <UpgradeButton />}
      </>
    )}
  </TierOption>
</TierToggle>

2. Match Select:
   - Dropdown với recent matches
   - Search by ID

3. Analyze Button:
   - "Phân tích (Basic)" hoặc "Phân tích (Pro)"
   - Loading spinner
   - Show cost estimate cho Pro (VD: "~0.02$")

4. Mode Buttons (Pro only):
   - [📊 Xem phân tích] (default)
   - [🎮 Chơi lại] (replay mode)
   - [💬 Hỏi AI] (Q&A mode)

5. Upgrade CTA (nếu chưa có Pro):
   - Floating badge: "Nâng cấp Pro để unlock Replay & AI Chat"
   - Click → Modal giải thích benefits

Styling: Sticky top, glass morphism effect
```

#### 2.4.2 Replay Mode UI

**Prompt cho AI**:
```
Tạo component ReplayModePanel:

1. Khi user click "Chơi lại":
   - Show modal confirm: "Bạn muốn chơi lại từ nước thứ mấy?"
   - Slider: 1 -> total_moves
   - Button: [Chơi lại từ đây] [Hủy]

2. Khi vào replay mode:
   - Board becomes interactive (user có thể click để đi)
   - Show AI thinking indicator
   - Show comparison panel:
     ┌─────────────────────────────────┐
     │ Nhánh Gốc    vs    Nhánh Mới    │
     ├─────────────────────────────────┤
     │ Kết quả: X thắng  │  Đang chơi  │
     │ Win prob: 65%     │  Win prob: 72% │
     │                   │  ↑ Tốt hơn 7%  │
     └─────────────────────────────────┘

3. Controls trong replay mode:
   - [⏮️ Quay lại nhánh gốc]
   - [🔄 Thử nước khác]
   - [💾 Lưu nhánh này]
   - [❌ Thoát replay]

Component structure:
<ReplayModePanel
  sessionId={replaySessionId}
  originalMoves={sequence}
  onMove={handleUserMove}
  onExit={exitReplayMode}
/>
```

#### 2.4.3 AI Q&A Chat Panel (Pro)

**Prompt cho AI**:
```
Tạo component AiChatPanel:

1. Chat interface trong Analysis Panel:
<AiChatPanel matchId={selectedId}>
  <ChatHistory messages={chatMessages} />
  <ChatInput
    placeholder="Hỏi về ván đấu này... VD: Tại sao nước 12 là mistake?"
    onSend={handleAskAI}
    disabled={!hasProAccess}
  />
  <UsageIndicator>
    Còn 15/20 câu hỏi hôm nay
  </UsageIndicator>
</AiChatPanel>

2. Suggested questions (quick buttons):
   - "Tại sao tôi thua?"
   - "Sai lầm lớn nhất của tôi là gì?"
   - "Đối thủ chơi như thế nào?"
   - "Làm sao để cải thiện?"

3. Chat message format:
<ChatMessage type="user">
  Tại sao nước 12 của tôi là mistake?
</ChatMessage>
<ChatMessage type="ai" loading={false}>
  Nước 12 tại (5,8) là mistake vì:
  
  1. Đối thủ đang có đường 4 tại (6,9)
  2. Bạn nên chặn ngay tại đó
  3. Thay vào đó bạn đi (5,8) không tạo threat nào
  
  Kết quả: Đối thủ thắng ngay nước sau.
  
  [Xem nước 12] [Replay từ đây]
</ChatMessage>

4. Integration với replay:
   - Click [Replay từ đây] → Tự động vào replay mode tại nước đó
   - Click [Xem nước 12] → Jump board đến nước 12
```

#### 2.4.2 Keyboard Shortcuts

**Prompt cho AI**:
```
Thêm keyboard shortcuts:

1. Arrow Left/Right: Previous/Next move
2. Space: Play/Pause
3. Home/End: First/Last move
4. 1-4: Switch tabs (Tổng Quan, Sai Lầm, Patterns, Đề Xuất)
5. Esc: Close modal
6. Ctrl+F: Focus search

Implementation:
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') prevMove()
    if (e.key === 'ArrowRight') nextMove()
    // ...
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [currentMoveIndex])
```

---

## Phase 3: State Management và Data Flow

### 3.1 Centralized State

#### 3.1.1 Analysis State Hook

**Prompt cho AI**:
```
Tạo custom hook useAnalysisState:

```typescript
interface AnalysisState {
  // Data
  matches: MatchRow[]
  selectedMatchId: string | null
  sequence: Move[]
  timeline: TimelineEntry[]
  mistakes: Mistake[]
  patterns: Pattern[]
  alternatives: Alternative[]
  
  // UI State
  currentMoveIndex: number
  isPlaying: boolean
  playSpeed: number
  activeTab: 'summary' | 'mistakes' | 'patterns' | 'alternatives'
  
  // Loading
  loadingMatches: boolean
  analyzing: boolean
  error: string | null
  
  // Actions
  selectMatch: (id: string) => void
  analyze: () => Promise<void>
  setCurrentMove: (index: number) => void
  play: () => void
  pause: () => void
  jumpToMove: (index: number) => void
}

export function useAnalysisState(): AnalysisState {
  // Implementation
}
```
```

### 3.2 API Integration

#### 3.2.1 Analysis API Client

**Prompt cho AI**:
```
Tạo api/analysisClient.ts:

```typescript
export async function analyzeMatch(
  matchId: string,
  difficulty: TrainingDifficulty
): Promise<AnalysisResult> {
  const moves = await fetchMatchMoves(matchId)
  
  const response = await fetch(`${AI_BASE_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      match_id: matchId,
      board_size: 15,
      win_length: 5,
      moves,
      difficulty
    }),
    signal: AbortSignal.timeout(20000) // 20s timeout
  })
  
  if (!response.ok) {
    throw new AnalysisError(`Analysis failed: ${response.status}`)
  }
  
  return response.json()
}

export async function fetchMatchMoves(matchId: string): Promise<Move[]> {
  // Fetch from Supabase
}
```
```

---

## Phase 4: Polish và Optimization

### 4.1 Performance

#### 4.1.1 Memoization

**Prompt cho AI**:
```
Optimize với React.memo và useMemo:

1. Memo expensive components:
   - InteractiveBoardPanel
   - ScoreTimeline
   - AnalysisPanel tabs

2. Memo computed values:
   - Filtered matches
   - Current board state
   - Statistics calculations

Example:
const boardState = useMemo(() => {
  return sequence.slice(0, currentMoveIndex)
}, [sequence, currentMoveIndex])
```

#### 4.1.2 Lazy Loading

**Prompt cho AI**:
```
Lazy load heavy components:

```typescript
const ScoreTimeline = lazy(() => import('./ScoreTimeline'))
const AnalysisPanel = lazy(() => import('./AnalysisPanel'))

// Trong component:
<Suspense fallback={<Spinner />}>
  <ScoreTimeline {...props} />
</Suspense>
```
```

### 4.2 Responsive Design

#### 4.2.1 Mobile Layout

**Prompt cho AI**:
```
Thêm responsive breakpoints:

Desktop (>1200px): 3-column layout
Tablet (768-1200px): 2-column (sidebar collapse, board + analysis)
Mobile (<768px): 1-column (tabs: Board | Analysis | Matches)

CSS:
@media (max-width: 1200px) {
  .analysis-container {
    grid-template-columns: 1fr 360px;
  }
  .match-list-sidebar {
    position: absolute;
    left: -280px;
    transition: left 0.3s;
  }
  .match-list-sidebar.open {
    left: 0;
  }
}
```

### 4.3 Accessibility

#### 4.3.1 ARIA Labels và Focus Management

**Prompt cho AI**:
```
Thêm accessibility:

1. ARIA labels:
   - Board cells: aria-label="Row 7, Column 8, Player X"
   - Buttons: aria-label="Play moves automatically"
   - Tabs: role="tablist", aria-selected

2. Focus management:
   - Tab navigation qua board cells
   - Focus trap trong modals
   - Skip to content link

3. Screen reader announcements:
   - Announce move changes
   - Announce analysis completion
```

---

## Phase 5: Testing và Documentation

### 5.1 Unit Tests

**Prompt cho AI**:
```
Viết tests cho:

1. Analysis logic:
   - Move evaluation accuracy
   - Pattern detection
   - Alternative suggestions

2. UI components:
   - Board rendering
   - Move navigation
   - Tab switching

3. State management:
   - useAnalysisState hook
   - API integration

Framework: Jest + React Testing Library
```

### 5.2 User Documentation

**Prompt cho AI**:
```
Tạo docs/AI_ANALYSIS_USER_GUIDE.md:

1. Hướng dẫn sử dụng:
   - Cách chọn trận đấu
   - Cách đọc phân tích
   - Cách sử dụng keyboard shortcuts

2. Giải thích metrics:
   - Score là gì?
   - Win probability tính như thế nào?
   - Các loại mistakes

3. Tips để cải thiện:
   - Học từ mistakes
   - Áp dụng patterns
   - Luyện tập với AI
```

---

---

## Phase 6: Monetization & Subscription

### 6.1 Subscription Management

**File**: `backend/app/Services/SubscriptionService.php`

#### 6.1.1 Subscription Tiers

**Prompt cho AI**:
```
Tạo subscription tiers trong database:

Table: subscriptions
- user_id
- tier: 'free' | 'trial' | 'pro' | 'pro_plus'
- status: 'active' | 'cancelled' | 'expired'
- started_at
- expires_at
- trial_started_at (for trial tracking)
- auto_renew: boolean

Tiers với Daily Limits:
1. Free (Default):
   - Basic analysis: 3/day
   - Pro analysis: 0
   - Replay: 0
   - AI Q&A: 0

2. Trial (Auto-activated on first use):
   - Duration: 7 days
   - Basic analysis: 5/day
   - Pro analysis: 5/day
   - Replay: 5 sessions/day
   - AI Q&A: 0 (not included)
   - Auto-expire after 7 days → revert to Free

3. Pro ($9.99/month):
   - Basic analysis: Unlimited
   - Pro analysis: 50/month (not daily)
   - Replay: 20 sessions/month
   - AI Q&A: 100 questions/month

4. Pro Plus ($19.99/month):
   - Everything unlimited
   - Priority analysis (faster queue)
   - Export to PDF
   - API access

Trial Logic:
- Auto-activate khi user click "Phân tích Pro" lần đầu
- Show countdown: "Còn 5 ngày trial"
- Khi expire: Show upgrade modal
- Không thể trial lại (1 user = 1 trial lifetime)
```

#### 6.1.2 Usage Tracking với Daily/Monthly Limits

**Prompt cho AI**:
```
Table: usage_logs
- user_id
- feature: 'basic_analysis' | 'pro_analysis' | 'replay' | 'ai_qa'
- count: integer
- date: 'YYYY-MM-DD' (for daily tracking)
- period: 'YYYY-MM' (for monthly tracking)

Implement usage checking:
async function checkUsageLimit(userId, feature) {
  const subscription = await getSubscription(userId)
  const today = new Date().toISOString().split('T')[0]
  const thisMonth = today.substring(0, 7)
  
  // Check trial expiration
  if (subscription.tier === 'trial') {
    const trialDays = daysSince(subscription.trial_started_at)
    if (trialDays > 7) {
      await expireTrial(userId)
      subscription.tier = 'free'
    }
  }
  
  // Get usage
  const dailyUsage = await getDailyUsage(userId, feature, today)
  const monthlyUsage = await getMonthlyUsage(userId, feature, thisMonth)
  
  // Define limits
  const limits = {
    free: {
      basic_analysis: { daily: 3, monthly: -1 },
      pro_analysis: { daily: 0, monthly: 0 },
      replay: { daily: 0, monthly: 0 },
      ai_qa: { daily: 0, monthly: 0 }
    },
    trial: {
      basic_analysis: { daily: 5, monthly: -1 },
      pro_analysis: { daily: 5, monthly: -1 },
      replay: { daily: 5, monthly: -1 },
      ai_qa: { daily: 0, monthly: 0 }
    },
    pro: {
      basic_analysis: { daily: -1, monthly: -1 }, // unlimited
      pro_analysis: { daily: -1, monthly: 50 },
      replay: { daily: -1, monthly: 20 },
      ai_qa: { daily: -1, monthly: 100 }
    },
    pro_plus: {
      basic_analysis: { daily: -1, monthly: -1 },
      pro_analysis: { daily: -1, monthly: -1 },
      replay: { daily: -1, monthly: -1 },
      ai_qa: { daily: -1, monthly: -1 }
    }
  }
  
  const limit = limits[subscription.tier][feature]
  
  // Check daily limit
  if (limit.daily !== -1 && dailyUsage >= limit.daily) {
    return {
      allowed: false,
      reason: 'daily_limit',
      remaining: 0,
      resetAt: 'tomorrow'
    }
  }
  
  // Check monthly limit
  if (limit.monthly !== -1 && monthlyUsage >= limit.monthly) {
    return {
      allowed: false,
      reason: 'monthly_limit',
      remaining: 0,
      resetAt: 'next_month'
    }
  }
  
  return {
    allowed: true,
    remaining: {
      daily: limit.daily === -1 ? 'unlimited' : limit.daily - dailyUsage,
      monthly: limit.monthly === -1 ? 'unlimited' : limit.monthly - monthlyUsage
    }
  }
}

// Auto-activate trial
async function autoActivateTrial(userId) {
  const subscription = await getSubscription(userId)
  
  // Only activate if user is on free tier and never had trial
  if (subscription.tier === 'free' && !subscription.trial_started_at) {
    await updateSubscription(userId, {
      tier: 'trial',
      trial_started_at: new Date(),
      expires_at: addDays(new Date(), 7)
    })
    
    return {
      activated: true,
      message: '🎉 Bạn đã kích hoạt 7 ngày dùng thử Pro miễn phí!'
    }
  }
  
  return { activated: false }
}
```

### 6.2 Upgrade Flow

#### 6.2.1 Upgrade Modal với Trial CTA

**Prompt cho AI**:
```
Tạo component UpgradeModal:

<UpgradeModal isOpen={showUpgrade} onClose={closeModal}>
  <ComparisonTable>
    <Column tier="free">
      <TierName>Free</TierName>
      <Price>$0</Price>
      <Features>
        ✅ Basic Analysis (3/ngày)
        ❌ Pro Analysis
        ❌ Interactive Replay
        ❌ AI Q&A
      </Features>
    </Column>
    
    <Column tier="trial" highlighted={!hasTrialed}>
      <TierName>Trial 🎁</TierName>
      <Price>Miễn phí 7 ngày</Price>
      <Features>
        ✅ Basic Analysis (5/ngày)
        ✅ Pro Analysis (5/ngày)
        ✅ Interactive Replay (5/ngày)
        ❌ AI Q&A
      </Features>
      {!hasTrialed ? (
        <Button onClick={handleActivateTrial} variant="primary">
          Dùng thử ngay
        </Button>
      ) : (
        <Badge>Đã dùng thử</Badge>
      )}
    </Column>
    
    <Column tier="pro" highlighted={hasTrialed}>
      <TierName>Pro 👑</TierName>
      <Price>$9.99/tháng</Price>
      <Features>
        ✅ Basic Analysis (Unlimited)
        ✅ Pro Analysis (50/tháng)
        ✅ Interactive Replay (20/tháng)
        ✅ AI Q&A (100/tháng)
        ✅ Natural language insights
        ✅ Pattern detection
      </Features>
      <Button onClick={handleUpgrade}>
        {hasTrialed ? 'Nâng cấp ngay' : 'Dùng thử trước'}
      </Button>
    </Column>
    
    <Column tier="pro_plus">
      <TierName>Pro Plus 💎</TierName>
      <Price>$19.99/tháng</Price>
      <Features>
        ✅ Everything Unlimited
        ✅ Priority analysis
        ✅ Export PDF
        ✅ API access
      </Features>
    </Column>
  </ComparisonTable>
  
  <TrialCountdown show={isTrialActive}>
    ⏰ Còn {trialDaysLeft} ngày trial
    <Button onClick={handleUpgrade}>Nâng cấp ngay để giữ quyền lợi</Button>
  </TrialCountdown>
  
  <Testimonials>
    "Nhờ Pro Analysis tôi đã cải thiện 30% win rate!" - User A
    "Replay feature giúp tôi hiểu sai lầm của mình!" - User B
  </Testimonials>
</UpgradeModal>

// Auto-show trial activation
useEffect(() => {
  if (userClickedProFeature && !hasTrialed && tier === 'free') {
    showModal({
      title: '🎉 Dùng thử Pro miễn phí 7 ngày?',
      message: 'Trải nghiệm đầy đủ Pro Analysis và Interactive Replay',
      actions: [
        { label: 'Dùng thử ngay', onClick: activateTrial },
        { label: 'Để sau', onClick: closeModal }
      ]
    })
  }
}, [userClickedProFeature])
```

---

## Checklist Tổng Hợp

### Phase 1: Backend - Dual Engines
- [ ] 1.1.1: Threat Detection System
- [ ] 1.1.2: Position Evaluator
- [ ] 1.1.3: Basic Analyzer (rule-based)
- [ ] 1.2.1: Pro Analyzer (AI-powered)
- [ ] 1.2.2: Conversational Q&A
- [ ] 1.3.1: POST /analyze endpoint
- [ ] 1.3.2: POST /ask endpoint
- [ ] 1.4.1: Replay Engine
- [ ] 1.4.2: Replay API endpoints

### Phase 2: Frontend UI
- [ ] 2.1.1: Grid layout với tier toggle
- [ ] 2.1.2: Match list sidebar
- [ ] 2.2.1: Interactive board
- [ ] 2.2.2: Score timeline chart
- [ ] 2.3.1: Tabbed analysis panel (Basic/Pro)
- [ ] 2.3.2: Summary view
- [ ] 2.3.3: Mistakes view
- [ ] 2.3.4: Patterns view
- [ ] 2.3.5: AI insights view (Pro)
- [ ] 2.4.1: Top controls với tier toggle
- [ ] 2.4.2: Replay mode UI
- [ ] 2.4.3: AI Q&A chat panel

### Phase 3: State & API
- [ ] 3.1.1: useAnalysisState hook
- [ ] 3.2.1: Analysis API client
- [ ] 3.2.2: Replay API client
- [ ] 3.2.3: Q&A API client

### Phase 4: Polish
- [ ] 4.1.1: Memoization
- [ ] 4.1.2: Lazy loading
- [ ] 4.2.1: Responsive design
- [ ] 4.3.1: Accessibility

### Phase 5: Testing
- [ ] 5.1: Unit tests (backend)
- [ ] 5.2: Integration tests
- [ ] 5.3: E2E tests (replay flow)

### Phase 6: Monetization
- [ ] 6.1.1: Subscription tiers
- [ ] 6.1.2: Usage tracking
- [ ] 6.2.1: Upgrade modal
- [ ] 6.2.2: Payment integration (Stripe/VNPay)

---

## Ước Lượng Thời Gian

### MVP (Basic + Pro Analysis)
- Phase 1 (Backend): 5-6 ngày
  - Basic analyzer: 2 ngày
  - Pro analyzer: 2 ngày
  - API endpoints: 1 ngày
- Phase 2 (Frontend): 6-7 ngày
  - Layout & components: 4 ngày
  - Analysis panels: 2 ngày
  - Polish: 1 ngày
- Phase 3 (Integration): 2 ngày

**MVP Total**: ~13-15 ngày

### Full Version (+ Replay + Q&A)
- Phase 1.4 (Replay Engine): 3-4 ngày
- Phase 2.4.2-2.4.3 (Replay UI + Q&A): 3-4 ngày
- Phase 6 (Monetization): 2-3 ngày
- Testing: 2 ngày

**Full Total**: ~23-28 ngày

### Phased Rollout (Recommended)
```
Week 1-2: Basic Analysis (Free)
  → Launch, gather feedback
  
Week 3-4: Pro Analysis (AI-powered)
  → Soft launch to beta users
  
Week 5-6: Interactive Replay
  → Premium feature, marketing push
  
Week 7: Q&A + Monetization
  → Full launch với subscription
```

---

---

## 📊 Tier Comparison Table

| Feature | Free | Trial (7 days) | Pro ($9.99/mo) | Pro Plus ($19.99/mo) |
|---------|------|----------------|----------------|----------------------|
| **Basic Analysis** | 3/day | 5/day | Unlimited | Unlimited |
| **Pro Analysis (AI)** | ❌ | 5/day | 50/month | Unlimited |
| **Interactive Replay** | ❌ | 5/day 🔥 | 20/month | Unlimited |
| **AI Q&A Chat** | ❌ | ❌ | 100/month | Unlimited |
| **Natural Language** | ❌ | ✅ | ✅ | ✅ |
| **Pattern Detection** | Basic | Advanced | Advanced | Advanced |
| **Export PDF** | ❌ | ❌ | ❌ | ✅ |
| **Priority Queue** | ❌ | ❌ | ❌ | ✅ |
| **API Access** | ❌ | ❌ | ❌ | ✅ |
| **Cost** | $0 | $0 | $9.99/mo | $19.99/mo |

**Key Insight:** Trial tier cho users taste được **Replay** (killer feature) → High conversion rate

---

## Đánh Giá Kế Hoạch

### ✅ Điểm Mạnh

1. **Two-Tier Strategy**
   - Clear value proposition
   - Lowered barrier (free basic)
   - Upsell path rõ ràng

2. **Interactive Replay = Killer Feature**
   - Unique trong thị trường Gomoku
   - Educational value cao
   - High engagement & retention

3. **AI-Powered Pro Tier**
   - Natural language explanations
   - Conversational Q&A
   - Personalized insights

4. **Technical Feasibility**
   - Rule-based: Đơn giản, reliable
   - AI integration: Proven tech (OpenRouter)
   - Replay: Straightforward implementation

### ⚠️ Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| AI API cost | Usage limits + caching + batch processing |
| Replay complexity | Start simple (1 branch), expand later |
| User adoption | Free basic tier + clear upgrade benefits |
| Performance | Caching, lazy loading, web workers |

### 🎯 Success Metrics

**Phase 1 (MVP - Basic Analysis)**
- Target: 1000 analyses/week
- Metric: User retention after first analysis

**Phase 2 (Pro Launch)**
- Target: 5% conversion to Pro (50 users @ $10 = $500/month)
- Metric: Pro analysis usage rate

**Phase 3 (Replay)**
- Target: 10% Pro users use replay weekly
- Metric: Avg replay sessions per user

**Phase 4 (Mature)**
- Target: 200 Pro users = $2000/month
- Metric: Churn rate < 10%

### 💡 Recommendations

#### **Start Small, Iterate Fast**
```
Week 1-2: Basic Analysis MVP
  ✅ Rule-based analyzer
  ✅ Simple UI (1 screen)
  ✅ Core features only
  → Launch & get feedback

Week 3-4: Add Pro Analysis
  ✅ AI integration
  ✅ Better insights
  → Soft launch to 50 beta users

Week 5-6: Add Replay
  ✅ Interactive replay
  ✅ What-if scenarios
  → Marketing push

Week 7+: Monetization
  ✅ Subscription tiers
  ✅ Payment integration
  → Full launch
```

#### **Marketing Angles**
1. **"First Gomoku game with AI post-game analysis"**
   - Emphasize uniqueness
   - Compare với Chess (Lichess)

2. **"Learn from your mistakes"**
   - Educational focus
   - Show before/after win rate improvements

3. **"Play against AI, learn from AI"**
   - Replay feature as main selling point
   - "What if you played differently?"

#### **Pricing Strategy (4-Tier Funnel)**
```
Free Tier:
- 3 basic analyses/day
- Hook users, build habit
- Low commitment

Trial Tier (7 days):
- 5 pro analyses/day + Replay
- Taste premium features
- Create urgency (countdown)
- Convert 10-15% to Pro

Pro Tier ($9.99/month):
- Sweet spot for serious players
- 50 pro analyses/month
- 20 replay sessions/month
- 100 AI Q&A/month

Pro Plus ($19.99/month):
- For power users & coaches
- Unlimited everything
- API access
```

**Conversion Funnel:**
```
1000 Free users
  ↓ 30% try Pro feature
300 activate Trial
  ↓ 10% convert
30 Pro users ($299.70/month)
  ↓ 20% upgrade
6 Pro Plus users ($119.94/month)

Total MRR: $419.64 from 1000 users
ARPU: $0.42/user
```

#### **Technical Priorities**

**Must Have (MVP)**
1. Basic analyzer working
2. Clean UI (single screen)
3. Fast response (< 2s)
4. Mobile responsive

**Should Have (V1)**
5. Pro analyzer (AI)
6. Tier selection
7. Usage tracking
8. Caching

**Nice to Have (V2)**
9. Interactive replay
10. Q&A chat
11. Export PDF
12. API access

---

## Ghi Chú Kỹ Thuật

### Performance
1. **Board Rendering**: Use canvas cho board lớn (> 15x15)
2. **Analysis Caching**: Redis với TTL 1 hour
3. **AI API**: Batch requests, use streaming responses
4. **Replay**: Web Workers cho AI calculations

### Cost Estimation (với Trial)
```
AI API Cost (DeepSeek):
- $0.14 per 1M input tokens
- $0.28 per 1M output tokens

Per analysis (~2000 tokens):
- Input: ~1500 tokens = $0.0002
- Output: ~500 tokens = $0.00014
- Total: ~$0.00034 per analysis

Trial User (7 days, 5 analyses/day):
- Max usage: 35 analyses
- Cost: $0.012/user
- Revenue: $0 (free trial)
- Loss: $0.012/user

Trial → Pro Conversion (assume 10%):
- 100 trial users → 10 Pro users
- Trial cost: $1.20
- Pro revenue (first month): $99.90
- Net: +$98.70 🎉

Pro User (50 analyses/month):
- Cost: $0.017/month
- Revenue: $9.99/month
- Margin: 99.8%

Break-even Analysis:
- Need 1 Pro conversion per 833 trial users
- Industry average trial→paid: 10-25%
- Our target: 10% (conservative)
- Expected: Very profitable 💰
```

### Security
1. **Rate Limiting**: 100 requests/hour per user
2. **API Key Protection**: Server-side only
3. **Subscription Validation**: JWT tokens
4. **Usage Tracking**: Prevent abuse

### Scalability
1. **Database**: Index on (user_id, created_at)
2. **Caching**: Redis cluster
3. **AI API**: Queue system for peak times
4. **CDN**: Static assets (board images, etc.)

---

## Next Steps

### Immediate (This Week)
1. ✅ Review và approve plan này
2. [ ] Setup project structure
3. [ ] Implement ThreatDetector (core logic)
4. [ ] Create basic UI mockup
5. [ ] Setup trial tracking system

### Short Term (Week 1-2)
1. [ ] Complete Basic Analyzer
2. [ ] Build MVP UI
3. [ ] Integration testing
4. [ ] Soft launch to 10 users

### Medium Term (Week 3-4)
1. [ ] Add Pro Analyzer (AI)
2. [ ] Implement tier system
3. [ ] Beta launch to 50 users
4. [ ] Gather feedback

### Long Term (Week 5+)
1. [ ] Add Interactive Replay
2. [ ] Add Q&A Chat
3. [ ] Payment integration
4. [ ] Full public launch

---

## Kết Luận

Kế hoạch của bạn **RẤT TỐT** với:
- ✅ Clear differentiation (Basic vs Pro)
- ✅ Unique killer feature (Interactive Replay)
- ✅ Solid monetization strategy
- ✅ Technical feasibility cao
- ✅ Market gap lớn (first mover advantage)

**Recommendation**: GO FOR IT! 🚀

### **Why This 4-Tier Strategy Works:**

1. **Free (3/day)** → Hook users, low friction
2. **Trial (7 days, 5/day + Replay)** → Taste premium, create urgency
3. **Pro ($9.99)** → Sweet spot for serious players
4. **Pro Plus ($19.99)** → Power users & coaches

**Key Success Factor:** Trial users get to experience **Interactive Replay** (killer feature) → High conversion rate (target 10-15%)

### **Implementation Priority:**

**Phase 1 (Week 1-2): MVP**
- Basic analyzer (Free tier)
- Simple UI
- Usage tracking (daily limits)

**Phase 2 (Week 3-4): Trial System**
- Pro analyzer (AI)
- Trial auto-activation
- Countdown UI
- Replay feature (limited)

**Phase 3 (Week 5-6): Monetization**
- Payment integration
- Subscription management
- Full Pro features

**Phase 4 (Week 7+): Optimization**
- Analytics & conversion tracking
- A/B testing trial duration (7 vs 14 days)
- Optimize conversion funnel

---

## 🎯 Final Thoughts

Kế hoạch 4-tier này **EXCELLENT** vì:
- ✅ Clear progression: Free → Trial → Pro → Pro Plus
- ✅ Trial includes Replay (killer feature preview)
- ✅ Low risk (trial cost ~$0.012/user)
- ✅ High reward (10% conversion = $1/user LTV)
- ✅ No degraded experience (không có "chat yếu")

**Expected Results:**
- Trial activation rate: 30% of free users
- Trial → Pro conversion: 10-15%
- Monthly churn: <10%
- 6-month projection: 200 Pro users = $2000 MRR

Bạn sẵn sàng bắt đầu implement chưa? Tôi có thể giúp code từng phần cụ thể!
