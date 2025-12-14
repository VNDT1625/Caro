# Kế Hoạch Nâng Cấp Hệ Thống AI - Thí Luyện 5 Độ Khó

## Tổng Quan

Nâng cấp hệ thống AI từ skeleton hiện tại thành 5 độ khó hoàn chỉnh:
- **Nhập Môn**: Lấy thủ làm công (phòng thủ > tấn công)
- **Kỳ Tài**: Cân bằng công và thủ
- **Nghịch Thiên**: Lấy công bù thủ, tấn công thông minh
- **Thiên Tôn**: Nhìn trước 2 bước
- **Hư Vô**: Không thể bị đánh bại

## Phân Tích Hiện Trạng

### ✅ Đã Có
- Cấu trúc 5 độ khó với profiles khác nhau
- Hệ thống đánh giá pattern cơ bản (count_direction, evaluate_potential)
- Minimax với lookahead depth (0-3 bước)
- Scoring system với offense/defense weights
- API endpoints cơ bản

### ❌ Thiếu / Cần Cải Thiện
- Threat detection chưa đầy đủ (thiếu phát hiện 4-3, 3-3, v.v.)
- Opening book (nước mở đầu tối ưu)
- Endgame solver (tính toán chắc thắng)
- Alpha-beta pruning (tối ưu minimax)
- Transposition table (cache positions)
- Pattern recognition nâng cao
- Time management
- Difficulty balancing chưa chính xác

---


## PHASE 1: Nâng Cấp Core Engine

### Bước 1.1: Threat Detection System

#### 1.1.1: Tạo ThreatDetector Class
**File**: `ai/core/threat_detector.py`

**Prompt**:
```
Tạo file ai/core/threat_detector.py với class ThreatDetector:

1. Implement các threat types:
   - FIVE: 5 liên tiếp → thắng ngay
   - OPEN_FOUR: _XXXX_ → thắng trong 1 nước
   - FOUR: _XXXX hoặc XXXX_ → đối thủ phải chặn
   - OPEN_THREE: _XXX_ → tạo nhiều đường tấn công
   - BROKEN_THREE: X_XX hoặc XX_X → có tiềm năng
   - THREE: XXX_ hoặc _XXX
   - OPEN_TWO: _XX_
   - TWO: XX_ hoặc _XX

2. Method scan_line(board, x, y, dx, dy, symbol):
   - Quét 1 line theo hướng (dx, dy)
   - Return: (threat_type, positions, open_ends)

3. Method detect_all_threats(board, symbol):
   - Quét toàn bộ board
   - Return: dict với count mỗi loại threat

4. Method get_critical_threats(board, symbol):
   - Trả về các threats cần xử lý ngay (FIVE, OPEN_FOUR, FOUR)
```


#### 1.1.2: Tạo Pattern Recognizer
**File**: `ai/core/pattern_recognizer.py`

**Prompt**:
```
Tạo file ai/core/pattern_recognizer.py với class PatternRecognizer:

1. Implement pattern detection:
   - DOUBLE_FOUR (4-4): 2 đường 4 giao nhau → thắng ngay
   - FOUR_THREE (4-3): 1 đường 4 + 1 đường 3 → thắng trong 2 nước
   - DOUBLE_THREE (3-3): 2 đường 3 mở giao nhau → cấm trong Renju
   - SWORD: Pattern tấn công đặc biệt

2. Method find_winning_patterns(board, symbol):
   - Tìm các patterns dẫn đến thắng chắc
   - Return: list of (pattern_type, positions, priority)

3. Method is_forbidden_move(board, x, y, symbol):
   - Kiểm tra nước cấm (nếu chơi Renju rules)
   - Return: (is_forbidden, reason)
```

#### 1.1.3: Tích Hợp Threat Detection vào Main
**File**: `ai/main.py`

**Prompt**:
```
Trong ai/main.py:

1. Import ThreatDetector và PatternRecognizer
2. Sửa hàm evaluate_potential() để sử dụng ThreatDetector
3. Thêm hàm check_immediate_win(board, symbol):
   - Kiểm tra có nước thắng ngay không
   - Return: (x, y) hoặc None
4. Thêm hàm check_immediate_defense(board, symbol):
   - Kiểm tra đối thủ có thắng ngay không
   - Return: (x, y) hoặc None
5. Sửa get_best_move() để ưu tiên:
   - Nếu có nước thắng ngay → đi ngay
   - Nếu đối thủ sắp thắng → chặn ngay
   - Nếu không → tính toán bình thường
```


### Bước 1.2: Opening Book System

#### 1.2.1: Tạo Opening Database
**File**: `ai/data/openings.json`

**Prompt**:
```
Tạo file ai/data/openings.json với các nước mở đầu tối ưu:

{
  "center_openings": [
    {"moves": [[7,7]], "name": "Tengen", "score": 100},
    {"moves": [[7,7], [7,8]], "name": "Direct", "score": 95},
    {"moves": [[7,7], [8,8]], "name": "Diagonal", "score": 90}
  ],
  "responses": {
    "7_7": [
      {"move": [7,8], "score": 95, "reason": "Áp sát trực tiếp"},
      {"move": [8,8], "score": 90, "reason": "Chéo góc"},
      {"move": [6,6], "score": 85, "reason": "Đối xứng"}
    ]
  }
}

Thêm ít nhất 20 opening sequences phổ biến.
```

#### 1.2.2: Tạo OpeningBook Class
**File**: `ai/core/opening_book.py`

**Prompt**:
```
Tạo file ai/core/opening_book.py với class OpeningBook:

1. Method load_openings():
   - Load từ openings.json
   - Parse thành dict dễ tra cứu

2. Method get_opening_move(board, move_count):
   - Nếu move_count <= 5: tra cứu opening book
   - Return: (x, y, confidence) hoặc None

3. Method match_position(board):
   - So khớp vị trí hiện tại với database
   - Return: best_continuation

4. Thêm randomization nhẹ để không bị đoán trước
```


### Bước 1.3: Alpha-Beta Pruning & Optimization

#### 1.3.1: Implement Alpha-Beta Pruning
**File**: `ai/core/search.py`

**Prompt**:
```
Tạo file ai/core/search.py với class AlphaBetaSearch:

1. Method alphabeta(board, depth, alpha, beta, maximizing, ai_symbol, opponent_symbol):
   - Implement alpha-beta pruning thay vì minimax thuần
   - Pruning để giảm số nodes cần evaluate
   - Return: (score, best_move)

2. Method move_ordering(board, candidates, symbol):
   - Sắp xếp moves theo priority:
     + Winning moves trước
     + Defensive moves
     + Center moves
     + Moves tạo threats
   - Giúp alpha-beta prune hiệu quả hơn

3. Thêm killer move heuristic:
   - Lưu các moves tốt từ subtrees khác
   - Thử killer moves trước

4. Thêm history heuristic:
   - Track moves nào thường tốt
   - Ưu tiên thử những moves đó
```

#### 1.3.2: Transposition Table
**File**: `ai/core/transposition_table.py`

**Prompt**:
```
Tạo file ai/core/transposition_table.py với class TranspositionTable:

1. Method zobrist_hash(board):
   - Tạo hash unique cho mỗi board position
   - Sử dụng Zobrist hashing

2. Method store(hash_key, depth, score, flag, best_move):
   - Lưu kết quả evaluate vào cache
   - flag: EXACT | LOWER_BOUND | UPPER_BOUND

3. Method lookup(hash_key, depth, alpha, beta):
   - Tra cứu position đã evaluate
   - Return: (found, score, best_move)

4. Implement LRU cache với size limit (10MB)
```


### Bước 1.4: Endgame Solver

#### 1.4.1: Tạo Threat Space Search
**File**: `ai/core/endgame_solver.py`

**Prompt**:
```
Tạo file ai/core/endgame_solver.py với class EndgameSolver:

1. Method is_endgame(board):
   - Kiểm tra có phải endgame không
   - Endgame = có threats nghiêm trọng (4, open_3)

2. Method threat_space_search(board, symbol, max_depth=10):
   - Tìm sequence thắng chắc
   - Chỉ xét các moves tạo/chặn threats
   - Return: (is_winning, winning_sequence)

3. Method prove_win(board, symbol):
   - Chứng minh có thể thắng chắc
   - Sử dụng proof-number search
   - Return: (provable, moves)

4. Method defend_against_threat(board, threat_positions):
   - Tìm nước phòng thủ tốt nhất
   - Return: defensive_moves
```

#### 1.4.2: Tích Hợp Endgame Solver
**File**: `ai/main.py`

**Prompt**:
```
Trong ai/main.py, sửa get_best_move():

1. Thêm endgame detection:
   if endgame_solver.is_endgame(board):
       result = endgame_solver.threat_space_search(board, ai_symbol)
       if result.is_winning:
           return result.winning_sequence[0]

2. Ưu tiên endgame solver khi:
   - Có OPEN_FOUR hoặc FOUR trên board
   - Move count > 20
   - Threats nghiêm trọng

3. Fallback về alpha-beta search nếu không solve được
```


---

## PHASE 2: Tinh Chỉnh 5 Độ Khó

### Bước 2.1: Nhập Môn - Lấy Thủ Làm Công

#### 2.1.1: Defensive Strategy
**File**: `ai/strategies/defensive_strategy.py`

**Prompt**:
```
Tạo file ai/strategies/defensive_strategy.py với class DefensiveStrategy:

1. Characteristics:
   - Luôn ưu tiên chặn threats của đối thủ
   - Ít tạo threats chủ động
   - Chơi an toàn, tránh rủi ro

2. Method evaluate_move(board, x, y, ai_symbol, opponent_symbol):
   - Defense weight = 1.8 (cao hơn offense)
   - Offense weight = 0.5
   - Proximity bonus = 15 (thấp, ít aggressive)

3. Method should_defend(board, opponent_symbol):
   - Return True nếu đối thủ có threat >= THREE
   - Luôn chặn FOUR và OPEN_THREE

4. Thêm "passive opening":
   - Không đi trung tâm nếu có thể
   - Đi gần đối thủ để chặn
```

#### 2.1.2: Giới Hạn Search Depth
**File**: `ai/main.py`

**Prompt**:
```
Cập nhật difficulty_profiles['nhap-mon']:

{
  'offenseWeight': 0.5,
  'defenseWeight': 1.8,
  'searchRadius': 2,
  'lookaheadDepth': 0,  # Không lookahead
  'lookaheadBranching': 0,
  'strategy': 'defensive',
  'useOpeningBook': False,  # Không dùng opening book
  'useEndgameSolver': False,
  'maxThinkTime': 1.0  # 1 giây
}

Thêm logic:
- Chỉ xét moves trong radius 2
- Không dùng alpha-beta (quá mạnh)
- Đánh giá đơn giản, không deep search
```


### Bước 2.2: Kỳ Tài - Cân Bằng Công Thủ

#### 2.2.1: Balanced Strategy
**File**: `ai/strategies/balanced_strategy.py`

**Prompt**:
```
Tạo file ai/strategies/balanced_strategy.py với class BalancedStrategy:

1. Characteristics:
   - Cân bằng offense và defense (1:1)
   - Biết khi nào tấn công, khi nào phòng thủ
   - Chơi hợp lý, ít sai lầm

2. Method evaluate_move(board, x, y, ai_symbol, opponent_symbol):
   - Defense weight = 1.0
   - Offense weight = 1.0
   - Proximity bonus = 25

3. Method decide_strategy(board, ai_symbol, opponent_symbol):
   - Nếu đối thủ có FOUR → defend
   - Nếu mình có OPEN_THREE → attack
   - Nếu không → balanced

4. Thêm "flexible opening":
   - Dùng opening book nhưng có variation
   - Respond hợp lý với moves của đối thủ
```

#### 2.2.2: Cấu Hình Kỳ Tài
**File**: `ai/main.py`

**Prompt**:
```
Cập nhật difficulty_profiles['ky-tai']:

{
  'offenseWeight': 1.0,
  'defenseWeight': 1.0,
  'searchRadius': 3,
  'lookaheadDepth': 1,  # Nhìn trước 1 bước
  'lookaheadBranching': 3,
  'strategy': 'balanced',
  'useOpeningBook': True,
  'useEndgameSolver': False,
  'maxThinkTime': 2.0,
  'useAlphaBeta': False  # Chưa dùng alpha-beta
}

Logic:
- Search radius 3 (rộng hơn Nhập Môn)
- Lookahead 1 bước (thấy trước 1 nước)
- Dùng opening book cơ bản
```


### Bước 2.3: Nghịch Thiên - Lấy Công Bù Thủ

#### 2.3.1: Aggressive Strategy
**File**: `ai/strategies/aggressive_strategy.py`

**Prompt**:
```
Tạo file ai/strategies/aggressive_strategy.py với class AggressiveStrategy:

1. Characteristics:
   - Ưu tiên tấn công, tạo threats liên tục
   - Chấp nhận rủi ro để tạo cơ hội thắng
   - Tìm kiếm winning combinations

2. Method evaluate_move(board, x, y, ai_symbol, opponent_symbol):
   - Offense weight = 1.6
   - Defense weight = 0.7
   - Bonus cho moves tạo multiple threats

3. Method find_forcing_moves(board, ai_symbol):
   - Tìm moves buộc đối thủ phải respond
   - FOUR, OPEN_THREE → forcing moves
   - Return: list of forcing moves

4. Method create_double_threat(board, ai_symbol):
   - Tìm moves tạo 2 threats cùng lúc
   - Đối thủ không thể chặn cả 2
   - Return: double_threat_moves

5. Thêm "aggressive opening":
   - Ưu tiên openings tấn công (VD: Sword, Star)
   - Tạo threats sớm
```

#### 2.3.2: Cấu Hình Nghịch Thiên
**File**: `ai/main.py`

**Prompt**:
```
Cập nhật difficulty_profiles['nghich-thien']:

{
  'offenseWeight': 1.6,
  'defenseWeight': 0.7,
  'searchRadius': 4,
  'lookaheadDepth': 2,  # Nhìn trước 2 bước
  'lookaheadBranching': 4,
  'strategy': 'aggressive',
  'useOpeningBook': True,
  'useEndgameSolver': True,  # Bắt đầu dùng endgame solver
  'maxThinkTime': 3.0,
  'useAlphaBeta': True,  # Dùng alpha-beta
  'useTranspositionTable': True
}

Logic:
- Lookahead 2 bước → thấy trước combinations
- Dùng alpha-beta để search sâu hơn
- Endgame solver để tìm winning sequences
- Ưu tiên forcing moves
```


### Bước 2.4: Thiên Tôn - Nhìn Trước 2 Bước

#### 2.4.1: Deep Search Strategy
**File**: `ai/strategies/deep_search_strategy.py`

**Prompt**:
```
Tạo file ai/strategies/deep_search_strategy.py với class DeepSearchStrategy:

1. Characteristics:
   - Tính toán sâu, nhìn trước nhiều bước
   - Hiểu rõ consequences của mỗi move
   - Tránh traps, tìm best lines

2. Method deep_evaluate(board, depth, ai_symbol, opponent_symbol):
   - Evaluate với depth = 4-6
   - Sử dụng alpha-beta + transposition table
   - Return: (score, principal_variation)

3. Method find_best_line(board, ai_symbol, depth=6):
   - Tìm best continuation cho cả 2 bên
   - Return: sequence of best moves

4. Method detect_traps(board, move, ai_symbol):
   - Kiểm tra move có phải trap không
   - Simulate opponent's best response
   - Return: (is_trap, trap_sequence)

5. Thêm "positional understanding":
   - Đánh giá vị trí dài hạn
   - Không chỉ xét immediate threats
   - Control center, create potential
```

#### 2.4.2: Cấu Hình Thiên Tôn
**File**: `ai/main.py`

**Prompt**:
```
Cập nhật difficulty_profiles['thien-ton']:

{
  'offenseWeight': 1.4,
  'defenseWeight': 1.0,
  'searchRadius': 5,
  'lookaheadDepth': 4,  # Nhìn trước 4 bước
  'lookaheadBranching': 5,
  'strategy': 'deep_search',
  'useOpeningBook': True,
  'useEndgameSolver': True,
  'maxThinkTime': 5.0,
  'useAlphaBeta': True,
  'useTranspositionTable': True,
  'useMoveOrdering': True,
  'useKillerMoves': True
}

Logic:
- Lookahead 4 bước → thấy rõ future
- Search radius 5 → xét nhiều possibilities
- Dùng đầy đủ optimizations
- Tránh blunders, chơi gần perfect
```


### Bước 2.5: Hư Vô - Không Thể Bị Đánh Bại

#### 2.5.1: Perfect Play Strategy
**File**: `ai/strategies/perfect_strategy.py`

**Prompt**:
```
Tạo file ai/strategies/perfect_strategy.py với class PerfectStrategy:

1. Characteristics:
   - Chơi gần perfect, không sai lầm
   - Tìm winning moves trong mọi tình huống
   - Defend perfectly, attack precisely

2. Method perfect_evaluate(board, depth, ai_symbol, opponent_symbol):
   - Evaluate với depth = 8-10
   - Iterative deepening
   - Aspiration windows
   - Return: (score, pv, confidence)

3. Method prove_win_or_draw(board, ai_symbol):
   - Chứng minh có thể thắng hoặc hòa
   - Sử dụng proof-number search
   - Return: (result, winning_line)

4. Method find_critical_moves(board, ai_symbol):
   - Tìm moves quan trọng nhất
   - Moves thay đổi outcome
   - Return: critical_moves với analysis

5. Thêm "perfect defense":
   - Không bao giờ để đối thủ tạo winning position
   - Defend mọi threats
   - Counter-attack khi có cơ hội

6. Thêm "time management":
   - Dùng nhiều thời gian cho critical positions
   - Nhanh với obvious moves
```

#### 2.5.2: Cấu Hình Hư Vô
**File**: `ai/main.py`

**Prompt**:
```
Cập nhật difficulty_profiles['hu-vo']:

{
  'offenseWeight': 1.5,
  'defenseWeight': 1.2,
  'searchRadius': 6,
  'lookaheadDepth': 8,  # Nhìn trước 8 bước
  'lookaheadBranching': 6,
  'strategy': 'perfect',
  'useOpeningBook': True,
  'useEndgameSolver': True,
  'maxThinkTime': 10.0,
  'useAlphaBeta': True,
  'useTranspositionTable': True,
  'useMoveOrdering': True,
  'useKillerMoves': True,
  'useHistoryHeuristic': True,
  'useIterativeDeepening': True,
  'useAspirationWindows': True,
  'useProofNumberSearch': True
}

Logic:
- Lookahead 8 bước → thấy rất xa
- Search radius 6 → xét hầu hết possibilities
- Dùng TẤT CẢ optimizations
- Iterative deepening để manage time
- Proof-number search cho endgame
- Gần như không thể thắng
```


---

## PHASE 3: Tối Ưu Hóa & Polish

### Bước 3.1: Performance Optimization

#### 3.1.1: Caching & Memoization
**File**: `ai/core/cache_manager.py`

**Prompt**:
```
Tạo file ai/core/cache_manager.py với class CacheManager:

1. Multi-level caching:
   - L1: In-memory dict (nhanh nhất)
   - L2: Redis (persistent)
   - L3: Disk (backup)

2. Method cache_evaluation(board_hash, depth, score, best_move):
   - Cache kết quả evaluate
   - TTL = 1 hour

3. Method cache_opening(position_hash, best_move):
   - Cache opening moves
   - TTL = 1 day

4. Method get_cached(board_hash, depth):
   - Tra cứu cache
   - Return: (found, score, best_move)

5. Implement cache warming:
   - Pre-compute common positions
   - Load vào cache khi start
```

#### 3.1.2: Parallel Search
**File**: `ai/core/parallel_search.py`

**Prompt**:
```
Tạo file ai/core/parallel_search.py với class ParallelSearch:

1. Method parallel_alphabeta(board, depth, candidates):
   - Chia candidates thành chunks
   - Evaluate parallel với ThreadPoolExecutor
   - Merge results

2. Method lazy_smp():
   - Lazy SMP algorithm
   - Multiple threads search cùng lúc
   - Share transposition table

3. Chỉ dùng cho Thiên Tôn và Hư Vô (độ khó cao)
```


### Bước 3.2: Testing & Balancing

#### 3.2.1: AI vs AI Testing
**File**: `ai/tests/test_ai_strength.py`

**Prompt**:
```
Tạo file ai/tests/test_ai_strength.py:

1. Method test_difficulty_progression():
   - Nhập Môn vs Kỳ Tài: Kỳ Tài thắng 80%
   - Kỳ Tài vs Nghịch Thiên: Nghịch Thiên thắng 75%
   - Nghịch Thiên vs Thiên Tôn: Thiên Tôn thắng 70%
   - Thiên Tôn vs Hư Vô: Hư Vô thắng 90%

2. Method test_response_time():
   - Nhập Môn: < 1s
   - Kỳ Tài: < 2s
   - Nghịch Thiên: < 3s
   - Thiên Tôn: < 5s
   - Hư Vô: < 10s

3. Method test_no_blunders():
   - Thiên Tôn và Hư Vô không được có blunders
   - Nghịch Thiên: max 1 blunder/game
   - Kỳ Tài: max 3 blunders/game

4. Run 100 games cho mỗi matchup
```

#### 3.2.2: Human Testing & Feedback
**File**: `ai/tests/human_testing_guide.md`

**Prompt**:
```
Tạo file ai/tests/human_testing_guide.md:

1. Testing protocol:
   - Recruit 10 testers (beginner → expert)
   - Mỗi người chơi 5 games với mỗi độ khó
   - Thu thập feedback

2. Metrics to track:
   - Win rate theo skill level
   - Perceived difficulty
   - Fun factor
   - AI personality (defensive/aggressive)

3. Adjustment criteria:
   - Nếu Nhập Môn quá khó → giảm searchRadius
   - Nếu Hư Vô bị thắng → tăng lookaheadDepth
   - Balance dựa trên feedback
```


### Bước 3.3: UI/UX Integration

#### 3.3.1: AI Personality Display
**File**: `frontend/src/components/AiPersonality.tsx`

**Prompt**:
```
Tạo component hiển thị personality của AI:

1. Nhập Môn:
   - Icon: 🛡️
   - Description: "Phòng thủ chặt chẽ, ít mạo hiểm"
   - Color: Blue
   - Tagline: "Lấy thủ làm công"

2. Kỳ Tài:
   - Icon: ⚖️
   - Description: "Cân bằng công thủ, linh hoạt"
   - Color: Green
   - Tagline: "Cân bằng công và thủ"

3. Nghịch Thiên:
   - Icon: ⚔️
   - Description: "Tấn công liên tục, tạo áp lực"
   - Color: Orange
   - Tagline: "Lấy công bù thủ"

4. Thiên Tôn:
   - Icon: 👁️
   - Description: "Nhìn xa trông rộng, tính toán sâu"
   - Color: Purple
   - Tagline: "Nhìn trước 2 bước"

5. Hư Vô:
   - Icon: 🌌
   - Description: "Hoàn hảo, không thể đánh bại"
   - Color: Black/Gold
   - Tagline: "Không thể bị đánh bại"
```

#### 3.3.2: AI Thinking Indicator
**File**: `frontend/src/components/AiThinkingIndicator.tsx`

**Prompt**:
```
Tạo component hiển thị AI đang suy nghĩ:

1. Show thinking time
2. Show search depth (nếu debug mode)
3. Show evaluated positions count
4. Animation phù hợp với personality:
   - Nhập Môn: Slow, steady
   - Hư Vô: Fast, intense

5. Show "AI is analyzing..." với progress bar
```


---

## PHASE 4: Advanced Features (Optional)

### Bước 4.1: AI Commentary System

#### 4.1.1: Move Commentary
**File**: `ai/commentary/move_commentator.py`

**Prompt**:
```
Tạo file ai/commentary/move_commentator.py:

1. Method comment_on_move(board, move, evaluation):
   - Generate natural language comment
   - Examples:
     + "Nước đi xuất sắc! Tạo đường 4 mở"
     + "Sai lầm! Nên chặn tại (8,9)"
     + "Nước đi thông minh, tạo 2 threats"

2. Personality-based comments:
   - Nhập Môn: "Phòng thủ tốt"
   - Nghịch Thiên: "Tấn công mạnh mẽ!"
   - Hư Vô: "Hoàn hảo."

3. Context-aware:
   - Opening: "Chiếm trung tâm"
   - Midgame: "Tạo áp lực"
   - Endgame: "Thắng chắc"
```

### Bước 4.2: Adaptive Difficulty

#### 4.2.1: Dynamic Difficulty Adjustment
**File**: `ai/adaptive/difficulty_adjuster.py`

**Prompt**:
```
Tạo file ai/adaptive/difficulty_adjuster.py:

1. Track player performance:
   - Win rate
   - Average game length
   - Mistakes per game

2. Method suggest_difficulty(player_stats):
   - Nếu win rate > 70% → suggest harder
   - Nếu win rate < 30% → suggest easier
   - Return: recommended_difficulty

3. Method adjust_on_the_fly(current_difficulty, game_state):
   - Nếu player đang thua quá nhiều → giảm độ khó
   - Nếu player đang thắng dễ → tăng độ khó
   - Smooth transition
```


---

## Implementation Roadmap

### Week 1-2: Core Engine (Phase 1)
- ✅ Bước 1.1: Threat Detection System
- ✅ Bước 1.2: Opening Book System
- ✅ Bước 1.3: Alpha-Beta Pruning
- ✅ Bước 1.4: Endgame Solver

### Week 3-4: Difficulty Tuning (Phase 2)
- ✅ Bước 2.1: Nhập Môn
- ✅ Bước 2.2: Kỳ Tài
- ✅ Bước 2.3: Nghịch Thiên
- ✅ Bước 2.4: Thiên Tôn
- ✅ Bước 2.5: Hư Vô

### Week 5: Optimization (Phase 3)
- ✅ Bước 3.1: Performance Optimization
- ✅ Bước 3.2: Testing & Balancing
- ✅ Bước 3.3: UI/UX Integration

### Week 6: Polish (Phase 4 - Optional)
- ✅ Bước 4.1: AI Commentary
- ✅ Bước 4.2: Adaptive Difficulty

---

## Testing Checklist

### Functional Testing
- [ ] Mỗi độ khó hoạt động đúng
- [ ] Response time trong giới hạn
- [ ] Không crash với edge cases
- [ ] Opening book hoạt động
- [ ] Endgame solver tìm được winning moves

### Difficulty Testing
- [ ] Nhập Môn: Beginner có thể thắng 50%
- [ ] Kỳ Tài: Intermediate có thể thắng 40%
- [ ] Nghịch Thiên: Advanced có thể thắng 30%
- [ ] Thiên Tôn: Expert có thể thắng 20%
- [ ] Hư Vô: Gần như không thể thắng (<5%)

### Performance Testing
- [ ] Nhập Môn: < 1s per move
- [ ] Kỳ Tài: < 2s per move
- [ ] Nghịch Thiên: < 3s per move
- [ ] Thiên Tôn: < 5s per move
- [ ] Hư Vô: < 10s per move

### AI Quality Testing
- [ ] Không bỏ lỡ winning moves (Thiên Tôn, Hư Vô)
- [ ] Defend correctly against threats
- [ ] Tạo threats hợp lý
- [ ] Opening moves sensible
- [ ] Endgame play correct

---

## Success Metrics

### Technical Metrics
- **Search Speed**: 10,000+ positions/second (Hư Vô)
- **Cache Hit Rate**: > 60%
- **Transposition Table Efficiency**: > 50% pruning
- **Alpha-Beta Pruning**: > 70% nodes pruned

### User Experience Metrics
- **Player Satisfaction**: > 4.0/5.0
- **Difficulty Perception**: Matches actual difficulty
- **Fun Factor**: > 4.0/5.0
- **Replay Rate**: > 30% players play multiple games

### Balance Metrics
- **Win Rate Distribution**:
  - Nhập Môn: 50% (beginner)
  - Kỳ Tài: 35% (intermediate)
  - Nghịch Thiên: 20% (advanced)
  - Thiên Tôn: 10% (expert)
  - Hư Vô: 2% (master)

---

## Notes & Tips

### Development Tips
1. **Start Simple**: Implement Nhập Môn first, then scale up
2. **Test Incrementally**: Test each difficulty after implementation
3. **Profile Performance**: Use profiler to find bottlenecks
4. **Cache Aggressively**: Cache everything that's expensive
5. **Parallel When Possible**: Use threading for Thiên Tôn & Hư Vô

### Common Pitfalls
1. **Over-optimization**: Don't optimize prematurely
2. **Unbalanced Difficulty**: Test with real players
3. **Slow Response**: Set time limits strictly
4. **Memory Leaks**: Clear caches periodically
5. **Deterministic Play**: Add slight randomization

### Debugging Tips
1. **Log Search Depth**: Track how deep search goes
2. **Visualize Search Tree**: See what AI is thinking
3. **Compare with Expected**: Test against known positions
4. **Profile Each Component**: Find slow parts
5. **A/B Test Configs**: Compare different settings

---

## Conclusion

Kế hoạch này cung cấp roadmap chi tiết để nâng cấp hệ thống AI từ skeleton hiện tại thành 5 độ khó hoàn chỉnh. Mỗi bước được thiết kế để có thể implement độc lập và test riêng biệt.

**Estimated Total Time**: 4-6 weeks (1 developer)

**Priority Order**:
1. Phase 1 (Core Engine) - CRITICAL
2. Phase 2 (Difficulty Tuning) - CRITICAL
3. Phase 3 (Optimization) - HIGH
4. Phase 4 (Advanced Features) - MEDIUM

Good luck! 🚀
