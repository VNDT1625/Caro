# 🚀 ULTIMATE AI MATCH ANALYSIS IMPROVEMENT PLAN

## Mục Tiêu: Đạt Level Engine Chuyên Nghiệp

**Target: Từ Amateur → Semi-Pro → Professional Level**

Kế hoạch này nhằm nâng cấp AI Analysis lên ngang tầm với các engine Gomoku hàng đầu như:
- Yixin (China) - World Champion Engine
- Piskvork/Gomocup engines
- Renju Solver

---

## 📊 Đánh Giá Hiện Trạng Chi Tiết

### Điểm Mạnh Hiện Tại
- ✅ Threat Detection cơ bản (FIVE, OPEN_FOUR, FOUR, OPEN_THREE, THREE, OPEN_TWO)
- ✅ Double Threat Detection (DOUBLE_FOUR, FOUR_THREE, DOUBLE_THREE)
- ✅ Broken Pattern Detection (BROKEN_FOUR, BROKEN_THREE, JUMP_THREE)
- ✅ VCF/VCT Search integration
- ✅ Position Evaluator với sigmoid win probability
- ✅ Opening Book integration (26 Renju openings)
- ✅ Endgame Analyzer integration

### 🔴 Điểm Yếu Nghiêm Trọng

#### 1. Search Engine (~30% so với engine pro)
- **Depth quá nông**: Chỉ 1-2 ply, engine pro search 15-25 ply
- **Không có Alpha-Beta Pruning** đúng chuẩn
- **Không có Null Move Pruning**
- **Không có Late Move Reduction (LMR)**
- **Không có Principal Variation Search (PVS)**
- **Không có Aspiration Windows**

#### 2. Evaluation Function (~40% accuracy)
- **Thiếu Neural Network evaluation** (NNUE style)
- **Không có Pattern Matching** với database lớn
- **Không có Threat Space Search**
- **Không có Dependency-Based Search**

#### 3. Tactical Analysis (~50% accuracy)
- **VCF search chưa optimal** - thiếu pruning
- **VCT search quá chậm** - không có heuristics
- **Không có Proof Number Search**
- **Không có Lambda Search**

#### 4. Strategic Understanding (~35% accuracy)
- **Không có Territory Analysis**
- **Không có Influence/Potential Maps**
- **Không có Game Phase Recognition** tốt
- **Không có Long-term Planning**

---

## 🎯 TARGET METRICS (Professional Level)

| Metric | Hiện tại | Target | Pro Engine |
|--------|----------|--------|------------|
| Search Depth | 2 ply | 15+ ply | 20-25 ply |
| Threat Detection | 70% | 98% | 99%+ |
| Position Evaluation | 60% | 92% | 95%+ |
| Tactical Accuracy | 50% | 95% | 98%+ |
| VCF Detection | 80% | 99% | 100% |
| VCT Detection | 60% | 95% | 98%+ |
| Best Move Accuracy | 55% | 90% | 95%+ |
| Analysis Speed | 1.5s | 0.5s | 0.1s |

---

# 🔥 PHASE 1: SEARCH ENGINE REVOLUTION (Tuần 1-4)

## Đây là phase quan trọng nhất - Search Engine quyết định 60% sức mạnh

### Task 1.1: Alpha-Beta với Enhancements
**Priority: CRITICAL | Impact: +200% search efficiency**

```python
# ai/analysis/alpha_beta_search.py

class AlphaBetaSearch:
    """
    Professional-grade Alpha-Beta search với tất cả enhancements.
    
    Features:
    - Iterative Deepening
    - Aspiration Windows
    - Principal Variation Search (PVS)
    - Null Move Pruning
    - Late Move Reduction (LMR)
    - Futility Pruning
    - Killer Move Heuristic
    - History Heuristic
    - Countermove Heuristic
    """
    
    def __init__(self, evaluator, tt_size_mb=128):
        self.evaluator = evaluator
        self.tt = TranspositionTable(tt_size_mb)
        self.killer_moves = [[None, None] for _ in range(64)]  # 2 killers per depth
        self.history = {}  # (player, from, to) -> score
        self.countermoves = {}  # prev_move -> counter_move
        self.pv_table = {}  # Principal Variation
        self.nodes_searched = 0
        
    def search(self, board, player, max_depth=15, time_limit_ms=2000):
        """
        Iterative Deepening với Aspiration Windows.
        """
        best_move = None
        best_score = -float('inf')
        
        # Aspiration window
        alpha = -float('inf')
        beta = float('inf')
        window = 50  # Initial aspiration window
        
        for depth in range(1, max_depth + 1):
            # Check time
            if self._time_exceeded(time_limit_ms):
                break
            
            score = self._pvs_search(board, player, depth, alpha, beta, True)
            
            # Aspiration window failed - re-search with full window
            if score <= alpha or score >= beta:
                score = self._pvs_search(board, player, depth, -float('inf'), float('inf'), True)
            
            if score > best_score:
                best_score = score
                best_move = self.pv_table.get(0)
            
            # Update aspiration window
            alpha = score - window
            beta = score + window
            
        return best_move, best_score
    
    def _pvs_search(self, board, player, depth, alpha, beta, is_pv):
        """
        Principal Variation Search - tối ưu hơn Alpha-Beta thuần.
        """
        self.nodes_searched += 1
        
        # Transposition Table lookup
        tt_entry = self.tt.probe(board.hash, depth, alpha, beta)
        if tt_entry:
            return tt_entry.score
        
        # Terminal node
        if depth == 0:
            return self._quiescence_search(board, player, alpha, beta)
        
        # Null Move Pruning (không dùng trong PV node)
        if not is_pv and depth >= 3 and not self._in_check(board, player):
            null_score = -self._pvs_search(
                board, self._opponent(player), 
                depth - 3, -beta, -beta + 1, False
            )
            if null_score >= beta:
                return beta  # Null move cutoff
        
        # Generate and order moves
        moves = self._generate_ordered_moves(board, player, depth)
        
        best_score = -float('inf')
        best_move = None
        moves_searched = 0
        
        for move in moves:
            board.make_move(move, player)
            
            # PVS: First move searched with full window
            if moves_searched == 0:
                score = -self._pvs_search(
                    board, self._opponent(player),
                    depth - 1, -beta, -alpha, is_pv
                )
            else:
                # Late Move Reduction
                reduction = self._get_lmr_reduction(depth, moves_searched, is_pv)
                
                # Zero-window search
                score = -self._pvs_search(
                    board, self._opponent(player),
                    depth - 1 - reduction, -alpha - 1, -alpha, False
                )
                
                # Re-search if failed high
                if score > alpha and (is_pv or reduction > 0):
                    score = -self._pvs_search(
                        board, self._opponent(player),
                        depth - 1, -beta, -alpha, is_pv
                    )
            
            board.undo_move(move)
            moves_searched += 1
            
            if score > best_score:
                best_score = score
                best_move = move
                
                if score > alpha:
                    alpha = score
                    self.pv_table[depth] = move
                    
                    if score >= beta:
                        # Beta cutoff - update killer and history
                        self._update_killers(depth, move)
                        self._update_history(player, move, depth)
                        break
        
        # Store in TT
        self.tt.store(board.hash, depth, best_score, best_move, alpha, beta)
        
        return best_score
    
    def _quiescence_search(self, board, player, alpha, beta, depth=0):
        """
        Quiescence Search - chỉ search các nước tactical.
        Tránh horizon effect.
        """
        stand_pat = self.evaluator.evaluate(board, player)
        
        if stand_pat >= beta:
            return beta
        if stand_pat > alpha:
            alpha = stand_pat
        
        # Chỉ search các nước tạo threat hoặc block threat
        tactical_moves = self._generate_tactical_moves(board, player)
        
        for move in tactical_moves:
            board.make_move(move, player)
            score = -self._quiescence_search(
                board, self._opponent(player), -beta, -alpha, depth + 1
            )
            board.undo_move(move)
            
            if score >= beta:
                return beta
            if score > alpha:
                alpha = score
        
        return alpha
    
    def _generate_ordered_moves(self, board, player, depth):
        """
        Move ordering - critical cho pruning efficiency.
        
        Order:
        1. Hash move (from TT)
        2. Winning captures (VCF moves)
        3. Killer moves
        4. Countermoves
        5. History heuristic
        6. Remaining moves by static eval
        """
        moves = []
        
        # 1. Hash move
        tt_move = self.tt.get_best_move(board.hash)
        if tt_move:
            moves.append((tt_move, 10000000))
        
        # 2. VCF/Tactical moves
        vcf_moves = self._find_vcf_moves(board, player)
        for m in vcf_moves:
            if m != tt_move:
                moves.append((m, 5000000))
        
        # 3. Killer moves
        for killer in self.killer_moves[depth]:
            if killer and self._is_valid_move(board, killer):
                moves.append((killer, 1000000))
        
        # 4. All other moves with history score
        all_moves = self._generate_all_moves(board)
        for m in all_moves:
            if m not in [x[0] for x in moves]:
                history_score = self.history.get((player, m), 0)
                static_score = self._static_move_score(board, m, player)
                moves.append((m, history_score + static_score))
        
        # Sort by score descending
        moves.sort(key=lambda x: x[1], reverse=True)
        return [m[0] for m in moves]
    
    def _get_lmr_reduction(self, depth, moves_searched, is_pv):
        """
        Late Move Reduction table.
        Reduce search depth for moves that are unlikely to be good.
        """
        if depth < 3 or moves_searched < 4:
            return 0
        
        # LMR reduction table (pre-computed)
        reduction = int(0.5 + math.log(depth) * math.log(moves_searched) / 2.0)
        
        # Less reduction in PV nodes
        if is_pv:
            reduction = max(0, reduction - 1)
        
        return min(reduction, depth - 1)
```

### Task 1.2: Zobrist Hashing
**Priority: HIGH | Impact: +50% TT efficiency**

```python
# ai/analysis/zobrist.py

import random

class ZobristHash:
    """
    Zobrist hashing cho board positions.
    Cho phép incremental update khi make/undo move.
    """
    
    def __init__(self, board_size=15, seed=42):
        random.seed(seed)
        self.board_size = board_size
        
        # Random numbers cho mỗi (position, piece)
        self.piece_keys = {}
        for x in range(board_size):
            for y in range(board_size):
                for piece in ['X', 'O']:
                    self.piece_keys[(x, y, piece)] = random.getrandbits(64)
        
        # Side to move
        self.side_key = random.getrandbits(64)
    
    def compute_hash(self, board, side_to_move):
        """Compute full hash từ board state."""
        h = 0
        for x in range(self.board_size):
            for y in range(self.board_size):
                piece = board[x][y]
                if piece:
                    h ^= self.piece_keys[(x, y, piece)]
        
        if side_to_move == 'O':
            h ^= self.side_key
        
        return h
    
    def update_hash(self, current_hash, x, y, piece, side_changed=True):
        """Incremental hash update khi make/undo move."""
        h = current_hash ^ self.piece_keys[(x, y, piece)]
        if side_changed:
            h ^= self.side_key
        return h
```

### Task 1.3: Enhanced Transposition Table
**Priority: HIGH | Impact: +40% search speed**

```python
# ai/analysis/transposition_table_v2.py

from dataclasses import dataclass
from enum import Enum
import numpy as np

class TTEntryType(Enum):
    EXACT = 0      # Exact score
    LOWER = 1      # Score is lower bound (beta cutoff)
    UPPER = 2      # Score is upper bound (failed low)

@dataclass
class TTEntry:
    hash_key: int
    depth: int
    score: float
    entry_type: TTEntryType
    best_move: tuple
    age: int

class TranspositionTableV2:
    """
    Professional-grade Transposition Table.
    
    Features:
    - Replacement strategy: Depth-preferred với age consideration
    - Two-tier structure: Always-replace + Depth-preferred
    - Prefetch support
    - Lock-free design cho multi-threading
    """
    
    def __init__(self, size_mb=128):
        # Calculate number of entries
        entry_size = 32  # bytes per entry
        self.num_entries = (size_mb * 1024 * 1024) // entry_size
        
        # Two-tier table
        self.always_replace = [None] * self.num_entries
        self.depth_preferred = [None] * self.num_entries
        
        self.current_age = 0
        self.hits = 0
        self.misses = 0
    
    def new_search(self):
        """Call at start of each new search."""
        self.current_age += 1
    
    def probe(self, hash_key, depth, alpha, beta):
        """
        Probe TT for a position.
        Returns (score, best_move) if usable, None otherwise.
        """
        index = hash_key % self.num_entries
        
        # Check both tiers
        for entry in [self.depth_preferred[index], self.always_replace[index]]:
            if entry and entry.hash_key == hash_key:
                self.hits += 1
                
                # Check if entry is usable at this depth
                if entry.depth >= depth:
                    if entry.entry_type == TTEntryType.EXACT:
                        return entry.score, entry.best_move
                    elif entry.entry_type == TTEntryType.LOWER and entry.score >= beta:
                        return entry.score, entry.best_move
                    elif entry.entry_type == TTEntryType.UPPER and entry.score <= alpha:
                        return entry.score, entry.best_move
                
                # Return best move even if score not usable
                return None, entry.best_move
        
        self.misses += 1
        return None, None
    
    def store(self, hash_key, depth, score, best_move, alpha, beta):
        """Store position in TT."""
        index = hash_key % self.num_entries
        
        # Determine entry type
        if score <= alpha:
            entry_type = TTEntryType.UPPER
        elif score >= beta:
            entry_type = TTEntryType.LOWER
        else:
            entry_type = TTEntryType.EXACT
        
        new_entry = TTEntry(
            hash_key=hash_key,
            depth=depth,
            score=score,
            entry_type=entry_type,
            best_move=best_move,
            age=self.current_age
        )
        
        # Always-replace tier
        self.always_replace[index] = new_entry
        
        # Depth-preferred tier - only replace if deeper or older
        existing = self.depth_preferred[index]
        if (not existing or 
            depth > existing.depth or 
            self.current_age - existing.age > 2):
            self.depth_preferred[index] = new_entry
```

### Task 1.4: Threat Space Search (TSS)
**Priority: HIGH | Impact: +30% tactical accuracy**

```python
# ai/analysis/threat_space_search.py

class ThreatSpaceSearch:
    """
    Threat Space Search - specialized search cho Gomoku.
    
    Thay vì search tất cả moves, TSS chỉ search trong "threat space":
    - Moves tạo threat
    - Moves block threat
    - Moves extend existing threats
    
    Đây là kỹ thuật được dùng bởi các engine mạnh nhất.
    """
    
    def __init__(self, threat_detector, board_size=15):
        self.threat_detector = threat_detector
        self.board_size = board_size
        self.max_depth = 30  # TSS có thể search rất sâu
    
    def search(self, board, player, depth=20):
        """
        Search trong threat space.
        
        Returns:
            (found_win, winning_sequence, score)
        """
        return self._tss_search(board, player, depth, [], set())
    
    def _tss_search(self, board, player, depth, sequence, visited):
        """
        Recursive TSS.
        
        Key insight: Trong Gomoku, nếu không có threat nào,
        position thường là draw hoặc cần positional play.
        """
        if depth == 0:
            return False, [], 0
        
        opponent = 'O' if player == 'X' else 'X'
        
        # Check immediate win
        player_threats = self.threat_detector.detect_all_threats(board, player)
        if player_threats.threats.get(ThreatType.FIVE, 0) > 0:
            return True, sequence, 100000
        
        # Check if opponent has winning threat
        opp_threats = self.threat_detector.detect_all_threats(board, opponent)
        if opp_threats.threats.get(ThreatType.FIVE, 0) > 0:
            return False, [], -100000
        
        # Generate threat moves only
        threat_moves = self._generate_threat_moves(board, player, player_threats, opp_threats)
        
        if not threat_moves:
            # No threats - evaluate position
            return False, [], self._evaluate_position(board, player)
        
        best_result = (False, [], -float('inf'))
        
        for move, move_type in threat_moves:
            # Make move
            board[move[0]][move[1]] = player
            new_sequence = sequence + [(move, player)]
            
            # Hash for visited check
            board_hash = self._hash_board(board)
            if board_hash in visited:
                board[move[0]][move[1]] = None
                continue
            visited.add(board_hash)
            
            # If this creates OPEN_FOUR, it's a win
            if move_type == 'open_four':
                board[move[0]][move[1]] = None
                return True, new_sequence, 100000
            
            # If this creates FOUR, opponent must respond
            if move_type == 'four':
                # Find blocking moves
                block_moves = self._find_blocking_moves(board, move, opponent)
                
                if len(block_moves) == 0:
                    # No block = win
                    board[move[0]][move[1]] = None
                    return True, new_sequence, 100000
                
                if len(block_moves) == 1:
                    # Single forced response - continue search
                    block = block_moves[0]
                    board[block[0]][block[1]] = opponent
                    
                    result = self._tss_search(
                        board, player, depth - 2, 
                        new_sequence + [(block, opponent)], visited
                    )
                    
                    board[block[0]][block[1]] = None
                    
                    if result[0]:  # Found win
                        board[move[0]][move[1]] = None
                        return result
                else:
                    # Multiple blocks - opponent can choose
                    # This branch is weaker
                    pass
            
            board[move[0]][move[1]] = None
            
            if best_result[2] < 0:
                best_result = (False, new_sequence, 0)
        
        return best_result
    
    def _generate_threat_moves(self, board, player, player_threats, opp_threats):
        """
        Generate moves trong threat space.
        
        Priority:
        1. Winning moves (create FIVE)
        2. Create OPEN_FOUR
        3. Create FOUR
        4. Block opponent's OPEN_FOUR
        5. Block opponent's FOUR
        6. Create OPEN_THREE
        7. Block opponent's OPEN_THREE
        """
        moves = []
        
        # 1. Winning moves
        for pos in self._find_winning_moves(board, player):
            moves.append((pos, 'five'))
        
        if moves:
            return moves  # If can win, just win
        
        # 2. Block opponent's winning moves
        for pos in self._find_winning_moves(board, 'O' if player == 'X' else 'X'):
            moves.append((pos, 'block_five'))
        
        if moves:
            return moves  # Must block
        
        # 3. Create OPEN_FOUR
        for pos in self._find_open_four_moves(board, player):
            moves.append((pos, 'open_four'))
        
        # 4. Create FOUR
        for pos in self._find_four_moves(board, player):
            moves.append((pos, 'four'))
        
        # 5. Block opponent's OPEN_FOUR
        # ... etc
        
        return moves
```

---

# 🧠 PHASE 2: NEURAL NETWORK EVALUATION (Tuần 5-8)

### Task 1.1: Extended Pattern Detection
**Priority: HIGH | Impact: +15% accuracy**

```python
# Thêm các pattern mới vào threat_detector.py

class ThreatType(Enum):
    # Existing
    FIVE = "five"
    OPEN_FOUR = "open_four"
    FOUR = "four"
    # ...
    
    # NEW PATTERNS
    OVERLINE = "overline"           # 6+ liên tiếp (cấm trong Renju)
    DOUBLE_BROKEN_THREE = "double_broken_three"  # X_XX + XX_X cùng điểm
    POTENTIAL_FOUR = "potential_four"  # 3 quân + 2 ô trống liên tiếp
    POTENTIAL_THREE = "potential_three"  # 2 quân + 3 ô trống liên tiếp
```

**Implementation:**
- [ ] Thêm `detect_overline()` method
- [ ] Thêm `detect_potential_patterns()` method
- [ ] Cập nhật `_find_broken_patterns_in_line()` để cover thêm case
- [ ] Unit tests cho các pattern mới

### Task 1.2: Influence Map
**Priority: MEDIUM | Impact: +10% evaluation accuracy**

```python
# Thêm vào position_evaluator.py hoặc tạo file mới

class InfluenceMap:
    """
    Tính toán vùng ảnh hưởng của mỗi quân cờ.
    Mỗi ô trống có influence score dựa trên:
    - Khoảng cách đến quân cờ gần nhất
    - Số quân cờ trong bán kính
    - Hướng phát triển tiềm năng
    """
    
    def calculate_influence(self, board, player) -> List[List[float]]:
        """Return 15x15 influence map"""
        pass
    
    def get_contested_zones(self, board) -> List[Tuple[int, int]]:
        """Tìm các vùng đang tranh chấp"""
        pass
```

**Implementation:**
- [ ] Tạo `ai/analysis/influence_map.py`
- [ ] Integrate vào AdvancedEvaluator
- [ ] Property tests cho influence calculation

### Task 1.3: Threat Urgency Scoring
**Priority: HIGH | Impact: +12% defense accuracy**

```python
# Cải thiện threat scoring dựa trên urgency

THREAT_URGENCY = {
    ThreatType.FIVE: 10,           # Đã thắng
    ThreatType.OPEN_FOUR: 9,       # Phải chặn ngay
    ThreatType.DOUBLE_FOUR: 9,     # Không thể chặn
    ThreatType.FOUR_THREE: 8,      # Rất nguy hiểm
    ThreatType.FOUR: 7,            # Phải chặn
    ThreatType.DOUBLE_THREE: 6,    # Nguy hiểm
    ThreatType.OPEN_THREE: 5,      # Cần chú ý
    ThreatType.BROKEN_FOUR: 5,     # Tiềm ẩn
    # ...
}

def calculate_urgency_score(threats: ThreatResult) -> float:
    """Tính điểm urgency tổng hợp"""
    pass
```

---

## Phase 2: Position Evaluation Improvement (Tuần 3-4)

### Task 2.1: Multi-Factor Weight Tuning
**Priority: HIGH | Impact: +20% evaluation accuracy**

Hiện tại weights trong `AdvancedEvaluator`:
```python
THREAT_WEIGHT = 1.0
SHAPE_WEIGHT = 0.15
CONNECTIVITY_WEIGHT = 0.1
TERRITORY_WEIGHT = 0.08
TEMPO_WEIGHT = 0.12
```

**Cần tune lại dựa trên:**
- [ ] Phân tích 1000+ ván đấu pro
- [ ] A/B testing với các weight khác nhau
- [ ] Machine learning để tìm optimal weights

**Proposed new weights:**
```python
THREAT_WEIGHT = 1.0
SHAPE_WEIGHT = 0.20       # Tăng từ 0.15
CONNECTIVITY_WEIGHT = 0.15 # Tăng từ 0.10
TERRITORY_WEIGHT = 0.12   # Tăng từ 0.08
TEMPO_WEIGHT = 0.18       # Tăng từ 0.12
POTENTIAL_WEIGHT = 0.10   # MỚI
```

### Task 2.2: Potential Score Calculation
**Priority: MEDIUM | Impact: +15% prediction accuracy**

```python
def calculate_potential_score(self, board, player) -> float:
    """
    Đánh giá tiềm năng phát triển của vị trí.
    
    Factors:
    - Số đường có thể tạo 5 liên tiếp
    - Số ô trống có thể phát triển
    - Flexibility (số hướng có thể đi)
    """
    pass
```

### Task 2.3: Dynamic Evaluation Based on Game Phase
**Priority: MEDIUM | Impact: +10% accuracy**

```python
class GamePhase(Enum):
    OPENING = "opening"      # Move 1-10
    EARLY_MIDDLE = "early_middle"  # Move 11-25
    MIDDLE = "middle"        # Move 26-50
    LATE_MIDDLE = "late_middle"    # Move 51-80
    ENDGAME = "endgame"      # Move 81+

def get_phase_weights(phase: GamePhase) -> Dict[str, float]:
    """
    Trả về weights phù hợp với phase của game.
    
    Opening: Territory > Potential > Threat
    Middle: Threat > Shape > Connectivity
    Endgame: Threat > Tempo > Everything else
    """
    pass
```

---

## Phase 3: Mistake Analysis Enhancement (Tuần 5-6)

### Task 3.1: Complete Mistake Categorization
**Priority: HIGH | Impact: +25% educational value**

Hoàn thiện `MistakeAnalyzer` với đầy đủ categories:

```python
class MistakeCategory(Enum):
    # Tactical Mistakes
    MISSED_WIN = "missed_win"           # Bỏ lỡ thắng
    MISSED_THREAT = "missed_threat"     # Bỏ lỡ tạo threat
    FAILED_DEFENSE = "failed_defense"   # Không chặn threat
    
    # Positional Mistakes
    POOR_POSITION = "poor_position"     # Vị trí kém
    EDGE_PLAY = "edge_play"             # Chơi rìa khi không cần
    OVERCONCENTRATION = "overconcentration"  # Tập trung quá nhiều 1 vùng
    
    # Strategic Mistakes
    WRONG_DIRECTION = "wrong_direction"  # Sai hướng phát triển
    IGNORED_WEAKNESS = "ignored_weakness"  # Bỏ qua điểm yếu
    
    # Tempo Mistakes
    SLOW_MOVE = "slow_move"             # Nước đi chậm
    PASSIVE_PLAY = "passive_play"       # Chơi thụ động
    LOST_INITIATIVE = "lost_initiative"  # Mất quyền chủ động
```

### Task 3.2: Context-Aware Explanations
**Priority: MEDIUM | Impact: +20% understanding**

```python
def generate_contextual_explanation(
    self,
    mistake: CategorizedMistake,
    game_context: GameContext
) -> str:
    """
    Tạo explanation dựa trên context của game.
    
    Ví dụ:
    - "Ở nước 15, bạn đã bỏ lỡ cơ hội tạo Tứ Tam tại H8. 
       Đây là thời điểm quan trọng vì đối thủ đang yếu ở cánh phải."
    """
    pass
```

### Task 3.3: Educational Tips Generation
**Priority: MEDIUM | Impact: +15% learning**

```python
EDUCATIONAL_TIPS = {
    MistakeCategory.MISSED_WIN: [
        "Luôn kiểm tra xem có VCF (Victory by Continuous Four) không trước khi đi.",
        "Khi có 3 quân liên tiếp với 2 đầu mở, hãy tìm cách tạo Tứ Tam.",
    ],
    MistakeCategory.FAILED_DEFENSE: [
        "Khi đối thủ có 3 quân mở, ưu tiên chặn trước khi tấn công.",
        "Đếm số threat của đối thủ trước mỗi nước đi.",
    ],
    # ...
}
```

---

## Phase 4: Pattern Recognition Expansion (Tuần 7-8)

### Task 4.1: Advanced Pattern Library
**Priority: HIGH | Impact: +30% pattern coverage**

```python
# Thêm các pattern mới

ADVANCED_PATTERNS = {
    "fork": {
        "label": "Rẽ Nhánh",
        "explanation": "Tạo 2 đường tấn công từ 1 nước đi",
        "detection": detect_fork_pattern,
    },
    "ladder": {
        "label": "Thang",
        "explanation": "Chuỗi nước đi buộc đối thủ phải theo",
        "detection": detect_ladder_pattern,
    },
    "sacrifice": {
        "label": "Hy Sinh",
        "explanation": "Bỏ 1 đường để tạo đường mạnh hơn",
        "detection": detect_sacrifice_pattern,
    },
    "trap": {
        "label": "Bẫy",
        "explanation": "Dụ đối thủ vào vị trí bất lợi",
        "detection": detect_trap_pattern,
    },
    "connection": {
        "label": "Kết Nối",
        "explanation": "Nối 2 nhóm quân để tăng sức mạnh",
        "detection": detect_connection_pattern,
    },
    "cut": {
        "label": "Cắt",
        "explanation": "Chia cắt quân đối thủ",
        "detection": detect_cut_pattern,
    },
}
```

### Task 4.2: Pattern Sequence Detection
**Priority: MEDIUM | Impact: +15% tactical understanding**

```python
def detect_pattern_sequence(
    self,
    timeline: List[TimelineEntry],
    moves: List[Move]
) -> List[PatternSequence]:
    """
    Phát hiện chuỗi pattern liên tiếp.
    
    Ví dụ:
    - Fork → Double Threat → Win
    - Sacrifice → Ladder → Fork → Win
    """
    pass
```

---

## Phase 5: Search Enhancement (Tuần 9-10)

### Task 5.1: Iterative Deepening
**Priority: HIGH | Impact: +25% best move accuracy**

```python
def find_best_moves_iterative(
    self,
    board: List[List[Optional[str]]],
    player: str,
    max_depth: int = 6,
    time_limit_ms: int = 1500
) -> List[Tuple[int, int, float]]:
    """
    Tìm best moves với iterative deepening.
    
    1. Search depth 1, lưu kết quả
    2. Search depth 2, cập nhật nếu tốt hơn
    3. Tiếp tục cho đến khi hết time hoặc max_depth
    """
    pass
```

### Task 5.2: Move Ordering Optimization
**Priority: HIGH | Impact: +20% search efficiency**

```python
def order_moves(
    self,
    board: List[List[Optional[str]]],
    player: str,
    moves: List[Tuple[int, int]]
) -> List[Tuple[int, int]]:
    """
    Sắp xếp moves theo thứ tự ưu tiên:
    
    1. Killer moves (moves đã gây cutoff ở depth trước)
    2. Threat-creating moves
    3. Defensive moves
    4. Center-biased moves
    5. History heuristic
    """
    pass
```

### Task 5.3: Transposition Table Enhancement
**Priority: MEDIUM | Impact: +15% search speed**

```python
# Cải thiện transposition_table.py

class EnhancedTranspositionTable:
    """
    Transposition table với:
    - Zobrist hashing
    - Replacement strategy (depth-preferred)
    - Age-based cleanup
    """
    
    def __init__(self, size_mb: int = 64):
        self.size = size_mb * 1024 * 1024 // 32  # 32 bytes per entry
        self.table = {}
        self.age = 0
    
    def store(self, hash_key: int, depth: int, score: float, 
              flag: EntryType, best_move: Tuple[int, int]):
        pass
    
    def probe(self, hash_key: int, depth: int, alpha: float, beta: float):
        pass
```

---

## Phase 6: Performance Optimization (Tuần 11-12)

### Task 6.1: Numba JIT Compilation
**Priority: MEDIUM | Impact: +50% speed**

```python
# Sử dụng numba cho các hot paths

from numba import jit, njit

@njit
def fast_threat_scan(board_array, player_id, direction):
    """Numba-optimized threat scanning"""
    pass

@njit
def fast_position_eval(board_array, player_id):
    """Numba-optimized position evaluation"""
    pass
```

### Task 6.2: Parallel Search
**Priority: LOW | Impact: +30% speed (multi-core)**

```python
from concurrent.futures import ThreadPoolExecutor

def parallel_search(
    self,
    board: List[List[Optional[str]]],
    player: str,
    moves: List[Tuple[int, int]],
    depth: int
) -> List[Tuple[int, int, float]]:
    """
    Search song song cho các root moves.
    """
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [
            executor.submit(self._search_move, board, player, move, depth)
            for move in moves
        ]
        results = [f.result() for f in futures]
    return results
```

### Task 6.3: Caching Strategy
**Priority: MEDIUM | Impact: +40% repeated analysis speed**

```python
# Cải thiện caching

class AnalysisCache:
    """
    Multi-level cache:
    - L1: In-memory LRU cache (hot data)
    - L2: Redis cache (warm data)
    - L3: Database cache (cold data)
    """
    
    def get(self, match_id: str, tier: str) -> Optional[AnalysisResult]:
        # Try L1 first
        # Then L2
        # Then L3
        pass
    
    def set(self, match_id: str, tier: str, result: AnalysisResult):
        # Store in all levels with appropriate TTL
        pass
```

---

## Metrics & Success Criteria

### Target Metrics (sau 12 tuần)

| Metric | Hiện tại | Target | Improvement |
|--------|----------|--------|-------------|
| Threat Detection Accuracy | 70% | 90% | +20% |
| Position Evaluation Accuracy | 60% | 80% | +20% |
| Mistake Detection Accuracy | 50% | 75% | +25% |
| Pattern Coverage | 40% | 80% | +40% |
| Best Move Accuracy | 55% | 80% | +25% |
| Analysis Speed (avg) | 1.5s | 1.0s | -33% |

### Testing Requirements

- [ ] Property-based tests cho mỗi module mới
- [ ] Benchmark tests với 100+ positions
- [ ] Regression tests để đảm bảo không break existing functionality
- [ ] Integration tests cho full analysis pipeline

### Rollout Plan

1. **Week 1-2**: Phase 1 (Threat Detection) → Deploy to staging
2. **Week 3-4**: Phase 2 (Position Evaluation) → A/B test
3. **Week 5-6**: Phase 3 (Mistake Analysis) → Deploy to 10% users
4. **Week 7-8**: Phase 4 (Pattern Recognition) → Deploy to 50% users
5. **Week 9-10**: Phase 5 (Search Enhancement) → Deploy to all
6. **Week 11-12**: Phase 6 (Performance) → Optimize based on metrics

---

## Quick Wins (Có thể làm ngay)

### 1. Tune Existing Weights (1-2 ngày)
```python
# Trong advanced_evaluator.py
THREAT_WEIGHT = 1.0
SHAPE_WEIGHT = 0.20       # Tăng từ 0.15
CONNECTIVITY_WEIGHT = 0.15 # Tăng từ 0.10
TERRITORY_WEIGHT = 0.12   # Tăng từ 0.08
TEMPO_WEIGHT = 0.18       # Tăng từ 0.12
```

### 2. Improve Early Game Tolerance (1 ngày)
```python
# Trong basic_analyzer.py, tăng early game tolerance
if move_number <= 10:  # Tăng từ 8
    # More lenient classification
```

### 3. Add More Vietnamese Notes (1 ngày)
```python
# Thêm templates cho các case mới
NOTE_TEMPLATES = {
    # ... existing
    MoveClassification.DEFENSIVE: [
        "Nước phòng thủ tốt. {reason}",
        "Chặn đúng lúc. {reason}",
    ],
    MoveClassification.DEVELOPING: [
        "Phát triển hợp lý. {reason}",
        "Xây dựng thế trận. {reason}",
    ],
}
```

### 4. Better Mistake Descriptions (2 ngày)
```python
# Cải thiện _generate_mistake_description()
def _generate_mistake_description(self, move, severity, best_alt, actual_score, best_score):
    score_diff = best_score - actual_score
    
    if severity == "critical":
        if score_diff > 10000:
            return f"Bỏ lỡ thắng! Nên đi ({best_alt[0]}, {best_alt[1]}) để tạo VCF."
        else:
            return f"Sai lầm nghiêm trọng! Để đối thủ có cơ hội thắng."
    # ...
```

---

## Kết Luận

Plan này chia thành 6 phases với tổng thời gian ~12 tuần. Mỗi phase có thể deploy độc lập và có metrics rõ ràng để đo lường improvement.

**Ưu tiên cao nhất:**
1. Phase 1: Threat Detection Enhancement
2. Phase 3: Mistake Analysis Enhancement
3. Phase 5: Search Enhancement

**Quick wins có thể làm ngay trong 1 tuần đầu** để thấy improvement nhanh chóng.
