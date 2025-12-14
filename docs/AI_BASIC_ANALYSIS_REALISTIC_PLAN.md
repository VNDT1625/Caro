# 📋 BASIC ANALYSIS - REALISTIC IMPROVEMENT PLAN

## ✅ IMPLEMENTATION STATUS

**Completed: December 5, 2025**

### Implemented Modules:
- ✅ `ai/analysis/basic_search.py` - Alpha-Beta Lite (Phase 1)
- ✅ `ai/analysis/basic_mistake_analyzer.py` - 3 category mistake detection (Phase 3)
- ✅ `ai/analysis/basic_vcf_search.py` - VCF depth 10-12 (Phase 4)
- ✅ `ai/analysis/basic_analysis_lite.py` - Integration wrapper
- ✅ `ai/analysis/advanced_evaluator.py` - Tuned weights (Phase 2)
- ✅ `ai/tests/test_basic_analysis_plan.py` - 17 tests, all passing

### Performance Results:
- 20 moves analysis: ~111ms ✅ (target was <800ms)
- Per-move analysis: ~5ms
- VCF detection: <200ms
- Best move search: <100ms

### Optimizations Applied:
- Threat-based classification (no per-move search)
- Game phase tolerance for opening moves
- Critical mistake detection only (skip minor mistakes)
- Fast note generation based on threats

---

## Định Nghĩa "Basic" Đúng Scope

**Basic Analysis là:**
- Phân tích nhanh < 1s
- Bắt được win/loss rõ ràng
- Detect mistake cơ bản (bỏ win, không chặn)
- Chạy nhẹ, không ăn tài nguyên
- User phổ thông thấy "ổn, hữu ích"

**Basic KHÔNG cần:**
- Search engine level thi đấu
- Neural network / ML
- Pattern library 1000+ patterns
- Parallel search, Numba optimization
- VCT depth 20+

---

## 📊 TARGET METRICS (Realistic)

| Metric | Hiện tại | Basic Target | Ghi chú |
|--------|----------|--------------|---------|
| Analysis Speed | 1.5s | < 0.8s | Đủ nhanh cho UX |
| VCF Detection | 80% | 95% | Depth 10-12 là đủ |
| Mistake (win/loss) | 70% | 90% | Bắt được cái rõ ràng |
| Mistake (positional) | 30% | 50% | Cơ bản thôi |
| Best Move | 55% | 75% | Không cần perfect |

---

## 🎯 PHASE 1: SEARCH LITE (1-2 tuần)

### 1.1 Alpha-Beta Đơn Giản

```python
class BasicSearch:
    """
    Alpha-Beta lite - đủ dùng cho Basic tier.
    Không cần: PVS, LMR, Null Move, Aspiration...
    """
    
    def __init__(self):
        self.tt = SimpleTranspositionTable()
        self.max_depth = 6  # Đủ cho Basic
        self.time_limit_ms = 600
    
    def search(self, board, player):
        best_move = None
        best_score = -INF
        
        # Iterative deepening đơn giản
        for depth in range(1, self.max_depth + 1):
            if self._time_exceeded():
                break
            
            score, move = self._alpha_beta(board, player, depth, -INF, INF)
            if move:
                best_move = move
                best_score = score
        
        return best_move, best_score
    
    def _alpha_beta(self, board, player, depth, alpha, beta):
        # TT lookup
        cached = self.tt.get(board)
        if cached and cached.depth >= depth:
            return cached.score, cached.move
        
        # Terminal
        if depth == 0:
            return self.evaluate(board, player), None
        
        # Generate moves - ordering cơ bản
        moves = self._generate_ordered_moves(board, player)
        
        best_score = -INF
        best_move = None
        
        for move in moves:
            board.make(move, player)
            score, _ = self._alpha_beta(board, opponent(player), depth-1, -beta, -alpha)
            score = -score
            board.undo(move)
            
            if score > best_score:
                best_score = score
                best_move = move
            
            alpha = max(alpha, score)
            if alpha >= beta:
                break  # Cutoff
        
        self.tt.store(board, depth, best_score, best_move)
        return best_score, best_move
    
    def _generate_ordered_moves(self, board, player):
        """
        Move ordering đơn giản:
        1. Nước thắng/chặn thắng
        2. Nước tạo threat mạnh
        3. Nước gần vùng đang đánh
        4. Ưu tiên gần tâm
        """
        moves = []
        
        # 1. Win/Block win
        win_moves = self._find_winning_moves(board, player)
        if win_moves:
            return win_moves
        
        block_moves = self._find_blocking_moves(board, player)
        if block_moves:
            return block_moves
        
        # 2. Threat moves
        threat_moves = self._find_threat_moves(board, player)
        
        # 3. All other moves, sorted by center distance
        other_moves = self._get_candidate_moves(board)
        other_moves.sort(key=lambda m: self._center_distance(m))
        
        return threat_moves + other_moves
```

### 1.2 Transposition Table Đơn Giản

```python
class SimpleTranspositionTable:
    """
    TT đơn giản - 1 tier, không cần 2-tier phức tạp.
    """
    
    def __init__(self, size=100000):
        self.table = {}
        self.max_size = size
    
    def get(self, board):
        return self.table.get(self._hash(board))
    
    def store(self, board, depth, score, move):
        h = self._hash(board)
        existing = self.table.get(h)
        
        # Chỉ replace nếu depth cao hơn
        if not existing or depth >= existing.depth:
            self.table[h] = TTEntry(depth, score, move)
        
        # Cleanup nếu quá lớn
        if len(self.table) > self.max_size:
            self._cleanup()
    
    def _hash(self, board):
        # Simple hash - không cần Zobrist phức tạp
        return hash(str(board))
```

---

## 🎯 PHASE 2: EVALUATION TUNING (1 tuần)

### 2.1 Tune Weights Hiện Tại

```python
# Trong advanced_evaluator.py - chỉ tune, không thêm mới

THREAT_WEIGHT = 1.0
SHAPE_WEIGHT = 0.20       # Tăng từ 0.15
CONNECTIVITY_WEIGHT = 0.15 # Tăng từ 0.10
TERRITORY_WEIGHT = 0.12   # Tăng từ 0.08
TEMPO_WEIGHT = 0.18       # Tăng từ 0.12
```

### 2.2 Game Phase Đơn Giản

```python
def get_game_phase(move_count):
    if move_count <= 10:
        return 'opening'
    elif move_count <= 50:
        return 'middle'
    else:
        return 'endgame'

def get_phase_weights(phase):
    if phase == 'opening':
        return {'territory': 1.2, 'threat': 0.8}
    elif phase == 'middle':
        return {'threat': 1.2, 'shape': 1.1}
    else:  # endgame
        return {'threat': 1.5, 'tempo': 1.2}
```

### 2.3 Potential Score Đơn Giản

```python
def calculate_potential(board, player):
    """
    Đếm số đường có thể kéo lên 5.
    Không cần InfluenceMap phức tạp.
    """
    potential = 0
    
    for line in get_all_lines(board):
        player_count = count_player_pieces(line, player)
        empty_count = count_empty(line)
        blocked = is_blocked(line)
        
        if not blocked and player_count + empty_count >= 5:
            potential += player_count * 10 + empty_count * 2
    
    return potential
```

---

## 🎯 PHASE 3: MISTAKE ANALYZER LITE (1 tuần)

### 3.1 Categories Gọn

```python
class BasicMistakeCategory(Enum):
    MISSED_WIN = "missed_win"       # Bỏ lỡ thắng (VCF)
    FAILED_BLOCK = "failed_block"   # Không chặn threat
    POOR_POSITION = "poor_position" # Đi xa thế trận
```

### 3.2 Detection Đơn Giản

```python
class BasicMistakeAnalyzer:
    
    def analyze(self, board_before, actual_move, best_move, scores):
        """
        Chỉ detect 3 loại mistake cơ bản.
        """
        mistakes = []
        
        # 1. Missed win
        if self._had_vcf(board_before, actual_move.player):
            if not self._is_vcf_move(actual_move):
                mistakes.append({
                    'type': 'MISSED_WIN',
                    'severity': 'critical',
                    'desc': f'Bỏ lỡ thắng! Nên đi {best_move}',
                })
        
        # 2. Failed block
        opponent = get_opponent(actual_move.player)
        if self._opponent_has_threat(board_before, opponent):
            if not self._blocks_threat(actual_move, board_before, opponent):
                mistakes.append({
                    'type': 'FAILED_BLOCK',
                    'severity': 'major',
                    'desc': f'Cần chặn threat của đối thủ tại {best_move}',
                })
        
        # 3. Poor position (score drop lớn)
        score_diff = scores['best'] - scores['actual']
        if score_diff > 500 and not mistakes:
            mistakes.append({
                'type': 'POOR_POSITION',
                'severity': 'minor',
                'desc': f'Nước đi kém hiệu quả. {best_move} tốt hơn.',
            })
        
        return mistakes
```

### 3.3 Tips Đơn Giản

```python
BASIC_TIPS = {
    'MISSED_WIN': [
        "Luôn check xem có nước thắng ngay không trước khi đi.",
        "Khi có 4 quân liên tiếp với 1 đầu mở, đó là cơ hội thắng.",
    ],
    'FAILED_BLOCK': [
        "Khi đối thủ có 3-4 quân liên tiếp, ưu tiên chặn.",
        "Đếm threat của đối thủ trước mỗi nước đi.",
    ],
    'POOR_POSITION': [
        "Ưu tiên đi gần vùng đang có quân.",
        "Tránh đi rìa bàn cờ khi không cần thiết.",
    ],
}
```

---

## 🎯 PHASE 4: VCF OPTIMIZATION (1 tuần)

### 4.1 VCF Depth Hợp Lý

```python
class BasicVCFSearch:
    """
    VCF search cho Basic - depth 10-12 là đủ.
    """
    
    def __init__(self):
        self.max_depth = 12  # Không cần 20-30 như Pro
        self.time_limit_ms = 200  # Nhanh
    
    def search(self, board, player):
        return self._vcf_search(board, player, self.max_depth)
    
    def _vcf_search(self, board, player, depth):
        if depth == 0 or self._time_exceeded():
            return None
        
        # Chỉ xét nước tạo FOUR
        four_moves = self._find_four_moves(board, player)
        
        for move in four_moves:
            board.make(move, player)
            
            # Check win
            if self._is_win(board, player):
                board.undo(move)
                return [move]
            
            # Opponent must block
            blocks = self._find_blocks(board, move)
            
            if len(blocks) == 1:
                board.make(blocks[0], opponent(player))
                result = self._vcf_search(board, player, depth - 2)
                board.undo(blocks[0])
                
                if result:
                    board.undo(move)
                    return [move, blocks[0]] + result
            
            board.undo(move)
        
        return None
```

---

## 📋 QUICK WINS (Làm ngay - 3 ngày)

### 1. Tune weights (1 ngày)
```python
SHAPE_WEIGHT = 0.20
CONNECTIVITY_WEIGHT = 0.15
TERRITORY_WEIGHT = 0.12
TEMPO_WEIGHT = 0.18
```

### 2. Early game tolerance (0.5 ngày)
```python
if move_number <= 10:
    # Không đánh BLUNDER cho opening moves
    if category == MoveClassification.BLUNDER:
        category = MoveClassification.OKAY
```

### 3. Better notes (0.5 ngày)
```python
NOTE_TEMPLATES['DEFENSIVE'] = [
    "Nước phòng thủ tốt. {reason}",
    "Chặn đúng lúc. {reason}",
]
```

### 4. VCF check trước khi đánh mistake (1 ngày)
```python
# Trong analyze_game()
if self._had_vcf(board, player) and not self._played_vcf(move):
    # Đây mới thực sự là mistake
    mistakes.append(...)
```

---

## 📊 SO SÁNH BASIC vs PRO

| Feature | Basic | Pro |
|---------|-------|-----|
| Search depth | 6 | 15+ |
| Search techniques | Alpha-Beta simple | PVS, LMR, Null Move |
| VCF depth | 12 | 20-30 |
| VCT | Không | Có |
| Mistake categories | 3 | 10+ |
| Pattern library | Không | 50+ patterns |
| Explanation | Template | LLM-powered |
| Speed | < 0.8s | < 2s |
| Numba/Parallel | Không | Có |

---

## 🗓️ TIMELINE

| Tuần | Task | Output |
|------|------|--------|
| 1 | Search Lite + TT | Depth 6, < 0.5s |
| 2 | Eval Tuning | +15% accuracy |
| 3 | Mistake Lite | 3 categories |
| 4 | VCF Optimize | 95% detection |

**Tổng: 4 tuần cho Basic hoàn chỉnh**

---

## 🎯 KẾT LUẬN

Plan này:
- **Đúng scope** cho Basic tier
- **Realistic** - có thể implement trong 4 tuần
- **Đủ mạnh** - user phổ thông thấy hữu ích
- **Tạo gap rõ ràng** với Pro tier để user có lý do upgrade

Những thứ "khủng" (TSS, Pattern Library, Neural Network, Parallel Search...) → **để dành cho Pro tier**.
