# Implementation Guide - AI Analysis System
## Dành cho AI Agent tự động implement

> File này chứa instructions chi tiết để AI agent (Claude/GPT) có thể tự động implement toàn bộ hệ thống mà không cần human intervention.

---

## 🎯 Context & Prerequisites

### Project Structure
```
caro/
├── ai/                          # Python backend (FastAPI)
│   ├── analysis/               # Analysis engines
│   ├── api/                    # API endpoints
│   ├── replay/                 # Replay engine
│   └── main.py                 # Entry point
├── frontend/                    # React + TypeScript
│   └── src/
│       ├── pages/              # AiAnalysis.tsx here
│       ├── components/         # Reusable components
│       └── lib/                # Utilities
└── backend/                     # Laravel (existing)
    └── app/Services/           # SubscriptionService here
```

### Existing Tech Stack
- **AI Backend**: Python 3.11, FastAPI, OpenRouter SDK
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **Backend**: Laravel 10, PostgreSQL (Supabase)
- **Caching**: Redis (optional, can use in-memory for MVP)

### Environment Variables
```bash
# ai/.env
OPENROUTER_API_KEY=sk-or-...
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://...

# frontend/.env
VITE_AI_URL=http://localhost:8001
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## 📝 Step-by-Step Implementation

### STEP 1: Setup AI Backend Structure

**Task**: Tạo folder structure và base files

**Commands**:
```bash
cd ai
mkdir -p analysis api replay models
touch analysis/__init__.py
touch analysis/threat_detector.py
touch analysis/position_evaluator.py
touch analysis/basic_analyzer.py
touch analysis/pro_analyzer.py
touch api/__init__.py
touch api/analyze.py
touch api/replay.py
touch replay/__init__.py
touch replay/replay_engine.py
touch models/__init__.py
touch models/board.py
touch models/move.py
```

**Validation**: Chạy `ls -R ai/` và verify structure

---

### STEP 2: Implement Board & Move Models

**File**: `ai/models/board.py`

**Requirements**:
- Board 15x15
- Methods: `make_move()`, `undo_move()`, `check_winner()`, `to_array()`
- Efficient representation (numpy array hoặc 2D list)

**Complete Code**:
```python
import numpy as np
from typing import Optional, Tuple, List

class Board:
    """
    Gomoku board 15x15
    0 = empty, 1 = X, 2 = O
    """
    def __init__(self, size: int = 15):
        self.size = size
        self.board = np.zeros((size, size), dtype=np.int8)
        self.move_history: List[Tuple[int, int, int]] = []
    
    def make_move(self, x: int, y: int, player: int) -> bool:
        """
        Make a move. Returns True if valid.
        player: 1 for X, 2 for O
        """
        if not (0 <= x < self.size and 0 <= y < self.size):
            return False
        if self.board[y][x] != 0:
            return False
        
        self.board[y][x] = player
        self.move_history.append((x, y, player))
        return True
    
    def undo_move(self) -> bool:
        """Undo last move"""
        if not self.move_history:
            return False
        
        x, y, _ = self.move_history.pop()
        self.board[y][x] = 0
        return True
    
    def check_winner(self, win_length: int = 5) -> Optional[int]:
        """
        Check if there's a winner.
        Returns: 1 (X wins), 2 (O wins), or None
        """
        # Check all 4 directions
        directions = [(1,0), (0,1), (1,1), (1,-1)]
        
        for y in range(self.size):
            for x in range(self.size):
                player = self.board[y][x]
                if player == 0:
                    continue
                
                for dx, dy in directions:
                    count = 1
                    # Check forward
                    nx, ny = x + dx, y + dy
                    while (0 <= nx < self.size and 0 <= ny < self.size 
                           and self.board[ny][nx] == player):
                        count += 1
                        nx += dx
                        ny += dy
                    
                    if count >= win_length:
                        return player
        
        return None
    
    def is_full(self) -> bool:
        """Check if board is full"""
        return np.all(self.board != 0)
    
    def get_empty_cells(self) -> List[Tuple[int, int]]:
        """Get list of empty cells"""
        empty = []
        for y in range(self.size):
            for x in range(self.size):
                if self.board[y][x] == 0:
                    empty.append((x, y))
        return empty
    
    def to_array(self) -> List[List[int]]:
        """Convert to 2D array for JSON"""
        return self.board.tolist()
    
    def copy(self) -> 'Board':
        """Deep copy of board"""
        new_board = Board(self.size)
        new_board.board = self.board.copy()
        new_board.move_history = self.move_history.copy()
        return new_board
    
    def __str__(self) -> str:
        """String representation for debugging"""
        symbols = {0: '.', 1: 'X', 2: 'O'}
        lines = []
        for row in self.board:
            lines.append(' '.join(symbols[cell] for cell in row))
        return '\n'.join(lines)
```

**File**: `ai/models/move.py`

```python
from dataclasses import dataclass
from typing import Literal

@dataclass
class Move:
    x: int
    y: int
    player: Literal['X', 'O']
    
    def to_player_int(self) -> int:
        """Convert player to int (1=X, 2=O)"""
        return 1 if self.player == 'X' else 2
    
    @staticmethod
    def from_dict(data: dict) -> 'Move':
        return Move(
            x=data['x'],
            y=data['y'],
            player=data['player']
        )
```

**Validation**: 
```python
# Test script
board = Board(15)
board.make_move(7, 7, 1)  # X at center
board.make_move(7, 8, 2)  # O
print(board)
assert board.check_winner() is None
```

---

### STEP 3: Implement ThreatDetector

**File**: `ai/analysis/threat_detector.py`

**Algorithm**: Scan all lines (horizontal, vertical, diagonal) and count consecutive pieces

**Complete Code**:
```python
from typing import Dict, List, Tuple
from models.board import Board

class ThreatDetector:
    """
    Detect threats (consecutive pieces) on board
    """
    
    THREAT_SCORES = {
        'five': 100000,
        'open_four': 10000,
        'four': 1000,
        'open_three': 500,
        'three': 100,
        'open_two': 10,
        'two': 1
    }
    
    def __init__(self):
        self.directions = [
            (1, 0),   # horizontal
            (0, 1),   # vertical
            (1, 1),   # diagonal \
            (1, -1)   # diagonal /
        ]
    
    def detect_all_threats(self, board: Board, player: int) -> Dict:
        """
        Detect all threats for a player
        Returns: {threat_type: count, ...}
        """
        threats = {
            'five': 0,
            'open_four': 0,
            'four': 0,
            'open_three': 0,
            'three': 0,
            'open_two': 0,
            'two': 0
        }
        
        threat_positions = []
        
        # Scan all positions
        for y in range(board.size):
            for x in range(board.size):
                if board.board[y][x] != player:
                    continue
                
                # Check all directions from this position
                for dx, dy in self.directions:
                    threat = self._scan_line(board, x, y, dx, dy, player)
                    if threat:
                        threat_type, positions = threat
                        threats[threat_type] += 1
                        threat_positions.append({
                            'type': threat_type,
                            'positions': positions,
                            'direction': self._direction_name(dx, dy)
                        })
        
        # Calculate total score
        total_score = sum(
            threats[t] * self.THREAT_SCORES[t] 
            for t in threats
        )
        
        return {
            'threats': threats,
            'total_score': total_score,
            'threat_positions': threat_positions
        }
    
    def _scan_line(
        self, 
        board: Board, 
        x: int, 
        y: int, 
        dx: int, 
        dy: int, 
        player: int
    ) -> Tuple[str, List[Tuple[int, int]]] | None:
        """
        Scan a line from (x,y) in direction (dx,dy)
        Returns: (threat_type, positions) or None
        """
        positions = [(x, y)]
        count = 1
        
        # Count consecutive pieces forward
        nx, ny = x + dx, y + dy
        while (0 <= nx < board.size and 0 <= ny < board.size 
               and board.board[ny][nx] == player):
            positions.append((nx, ny))
            count += 1
            nx += dx
            ny += dy
        
        # Don't count if already counted from other direction
        if count < 2:
            return None
        
        # Check if ends are open
        front_open = (0 <= nx < board.size and 0 <= ny < board.size 
                      and board.board[ny][nx] == 0)
        
        bx, by = x - dx, y - dy
        back_open = (0 <= bx < board.size and 0 <= by < board.size 
                     and board.board[by][bx] == 0)
        
        # Classify threat
        if count >= 5:
            return ('five', positions)
        elif count == 4:
            if front_open and back_open:
                return ('open_four', positions)
            elif front_open or back_open:
                return ('four', positions)
        elif count == 3:
            if front_open and back_open:
                return ('open_three', positions)
            elif front_open or back_open:
                return ('three', positions)
        elif count == 2:
            if front_open and back_open:
                return ('open_two', positions)
            elif front_open or back_open:
                return ('two', positions)
        
        return None
    
    def _direction_name(self, dx: int, dy: int) -> str:
        if dx == 1 and dy == 0:
            return 'horizontal'
        elif dx == 0 and dy == 1:
            return 'vertical'
        elif dx == 1 and dy == 1:
            return 'diagonal_down'
        elif dx == 1 and dy == -1:
            return 'diagonal_up'
        return 'unknown'
```

**Validation**:
```python
# Test
board = Board(15)
# Create open three: . X X X .
board.make_move(5, 7, 1)
board.make_move(6, 7, 1)
board.make_move(7, 7, 1)

detector = ThreatDetector()
result = detector.detect_all_threats(board, 1)
assert result['threats']['open_three'] > 0
print(f"Score: {result['total_score']}")  # Should be 500+
```

---

### STEP 4: Implement PositionEvaluator

**File**: `ai/analysis/position_evaluator.py`

**Complete Code**:
```python
import math
from typing import Dict
from models.board import Board
from analysis.threat_detector import ThreatDetector

class PositionEvaluator:
    """
    Evaluate board position for a player
    """
    
    def __init__(self):
        self.threat_detector = ThreatDetector()
    
    def evaluate_position(self, board: Board, player: int) -> Dict:
        """
        Evaluate current position
        Returns: {score, win_probability, threats}
        """
        opponent = 3 - player  # 1->2, 2->1
        
        # Detect threats for both players
        my_threats = self.threat_detector.detect_all_threats(board, player)
        opp_threats = self.threat_detector.detect_all_threats(board, opponent)
        
        # Calculate score
        score = my_threats['total_score'] - opp_threats['total_score'] * 0.9
        
        # Add position bonus (center is better)
        score += self._position_bonus(board, player)
        
        # Calculate win probability (sigmoid)
        win_prob = self._calculate_win_probability(score)
        
        return {
            'score': int(score),
            'win_probability': win_prob,
            'my_threats': my_threats['threats'],
            'opponent_threats': opp_threats['threats']
        }
    
    def evaluate_move(self, board: Board, x: int, y: int, player: int) -> Dict:
        """
        Evaluate a specific move without making it
        """
        # Make move temporarily
        board_copy = board.copy()
        board_copy.make_move(x, y, player)
        
        # Evaluate
        result = self.evaluate_position(board_copy, player)
        result['move'] = {'x': x, 'y': y}
        
        return result
    
    def _position_bonus(self, board: Board, player: int) -> float:
        """
        Bonus for pieces near center
        """
        center = board.size // 2
        bonus = 0.0
        
        for y in range(board.size):
            for x in range(board.size):
                if board.board[y][x] == player:
                    # Distance from center
                    dist = abs(x - center) + abs(y - center)
                    # Closer to center = higher bonus
                    bonus += max(0, 10 - dist)
        
        return bonus
    
    def _calculate_win_probability(self, score: float) -> float:
        """
        Convert score to win probability using sigmoid
        """
        # Sigmoid: 1 / (1 + e^(-x))
        k = 0.0005  # Tuning parameter
        prob = 1 / (1 + math.exp(-k * score))
        return round(prob, 4)
    
    def classify_move_quality(self, score: int) -> str:
        """
        Classify move quality based on score
        """
        if score >= 85:
            return 'excellent'
        elif score >= 70:
            return 'good'
        elif score >= 50:
            return 'okay'
        elif score >= 30:
            return 'weak'
        else:
            return 'blunder'
```

---

### STEP 5: Implement BasicAnalyzer (Rule-Based)

**File**: `ai/analysis/basic_analyzer.py`

**Algorithm**: 
1. Replay game move by move
2. For each move, find best alternatives (minimax depth 4)
3. Compare actual move with best move
4. Classify and generate notes

**Complete Code** (Simplified minimax):
```python
from typing import List, Dict
from models.board import Board
from models.move import Move
from analysis.position_evaluator import PositionEvaluator
import random

class BasicAnalyzer:
    """
    Rule-based game analyzer
    """
    
    def __init__(self):
        self.evaluator = PositionEvaluator()
    
    def analyze_game(self, moves: List[Dict]) -> Dict:
        """
        Analyze complete game
        moves: [{'x': 7, 'y': 7, 'player': 'X'}, ...]
        """
        board = Board(15)
        timeline = []
        mistakes = []
        
        for i, move_data in enumerate(moves):
            move = Move.from_dict(move_data)
            player_int = move.to_player_int()
            
            # Evaluate before move
            before_eval = self.evaluator.evaluate_position(board, player_int)
            
            # Find best moves (simplified - just evaluate nearby cells)
            best_moves = self._find_best_moves_simple(board, player_int, top_n=3)
            
            # Make the actual move
            board.make_move(move.x, move.y, player_int)
            
            # Evaluate after move
            after_eval = self.evaluator.evaluate_position(board, player_int)
            
            # Classify move quality
            actual_score = after_eval['score']
            best_score = best_moves[0]['score'] if best_moves else actual_score
            score_diff = best_score - actual_score
            
            quality = self._classify_quality(score_diff)
            
            # Generate note
            note = self._generate_note(quality, before_eval, after_eval)
            
            # Add to timeline
            timeline.append({
                'move': i + 1,
                'player': move.player,
                'position': {'x': move.x, 'y': move.y},
                'score': actual_score,
                'win_prob': after_eval['win_probability'],
                'category': quality,
                'note': note
            })
            
            # Detect mistakes
            if quality in ['weak', 'blunder'] and best_moves:
                mistakes.append({
                    'move': i + 1,
                    'severity': 'critical' if quality == 'blunder' else 'major',
                    'desc': f"Nước đi yếu. Tốt hơn: ({best_moves[0]['x']+1},{best_moves[0]['y']+1})",
                    'best_alternative': best_moves[0]
                })
        
        return {
            'tier': 'basic',
            'timeline': timeline,
            'mistakes': mistakes,
            'patterns': [],  # TODO: Pattern detection
            'summary': self._generate_summary(timeline, mistakes)
        }
    
    def _find_best_moves_simple(self, board: Board, player: int, top_n: int = 3) -> List[Dict]:
        """
        Find best moves by evaluating nearby empty cells
        (Simplified version - full version would use minimax)
        """
        candidates = []
        
        # Get cells near existing pieces (within 2 cells)
        for y in range(board.size):
            for x in range(board.size):
                if board.board[y][x] != 0:
                    # Check nearby cells
                    for dy in range(-2, 3):
                        for dx in range(-2, 3):
                            nx, ny = x + dx, y + dy
                            if (0 <= nx < board.size and 0 <= ny < board.size 
                                and board.board[ny][nx] == 0):
                                # Evaluate this move
                                eval_result = self.evaluator.evaluate_move(board, nx, ny, player)
                                candidates.append({
                                    'x': nx,
                                    'y': ny,
                                    'score': eval_result['score']
                                })
        
        # Remove duplicates and sort
        seen = set()
        unique_candidates = []
        for c in candidates:
            key = (c['x'], c['y'])
            if key not in seen:
                seen.add(key)
                unique_candidates.append(c)
        
        unique_candidates.sort(key=lambda c: c['score'], reverse=True)
        return unique_candidates[:top_n]
    
    def _classify_quality(self, score_diff: int) -> str:
        """Classify based on score difference from best move"""
        if score_diff <= 10:
            return 'excellent'
        elif score_diff <= 50:
            return 'good'
        elif score_diff <= 150:
            return 'okay'
        elif score_diff <= 300:
            return 'weak'
        else:
            return 'blunder'
    
    def _generate_note(self, quality: str, before: Dict, after: Dict) -> str:
        """Generate template-based note"""
        templates = {
            'excellent': 'Nước đi tốt nhất',
            'good': 'Nước đi tốt',
            'okay': 'Nước đi chấp nhận được',
            'weak': 'Nước đi yếu',
            'blunder': 'Sai lầm nghiêm trọng'
        }
        
        note = templates[quality]
        
        # Add context
        if after['my_threats'].get('open_four', 0) > before['my_threats'].get('open_four', 0):
            note += ', tạo đường 4'
        elif after['my_threats'].get('open_three', 0) > before['my_threats'].get('open_three', 0):
            note += ', tạo đường 3'
        
        return note
    
    def _generate_summary(self, timeline: List[Dict], mistakes: List[Dict]) -> Dict:
        """Generate game summary"""
        return {
            'total_moves': len(timeline),
            'mistakes_count': len(mistakes),
            'avg_score': sum(t['score'] for t in timeline) / len(timeline) if timeline else 0
        }
```

**Validation**: Test với một ván đấu mẫu

---

## ⏭️ Next Steps

Sau khi hoàn thành STEP 1-5, tiếp tục với:
- STEP 6: ProAnalyzer (AI-powered)
- STEP 7: API Endpoints
- STEP 8: Frontend UI
- STEP 9: Integration & Testing

**Mỗi step có validation test để verify trước khi sang step tiếp theo.**

---

## 🤖 Instructions for AI Agent

Khi implement, follow these rules:
1. **Implement từng step một**, không skip
2. **Run validation test** sau mỗi step
3. **Nếu test fail**, debug và fix trước khi tiếp tục
4. **Commit code** sau mỗi step hoàn thành
5. **Document** mọi thay đổi trong CHANGELOG.md

**Command to start**:
```bash
# Step 1
python -c "from models.board import Board; b = Board(); print('Board OK')"

# Step 2
python -c "from analysis.threat_detector import ThreatDetector; print('ThreatDetector OK')"

# Continue...
```
