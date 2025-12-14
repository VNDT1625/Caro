# AI Match Analysis System

AI-powered match analysis service for MindPoint Arena Gomoku/Caro game.

## Overview

This service provides comprehensive game analysis capabilities including:
- **Basic Analysis**: Fast rule-based analysis (<2s) with threat detection, position evaluation, and pattern recognition
- **Pro Analysis**: AI-powered analysis using OpenRouter/DeepSeek API with natural language insights
- **Interactive Replay**: Navigate through matches and play "what-if" scenarios against AI
- **AI Q&A**: Ask questions about your matches and get AI-powered answers

## Quick Start

### Prerequisites

- Python 3.9+
- pip or conda

### Installation

```bash
cd ai
pip install -r requirements.txt
```

### Running the Server

```powershell
# Development mode with auto-reload
uvicorn ai.main:app --reload --port 8001

# Or using Python directly
python -m uvicorn ai.main:app --reload --port 8001
```

### Environment Variables

```bash
# Required for Pro Analysis and AI Q&A
OPENROUTER_API_KEY=your_openrouter_api_key
```

---

## API Reference

Base URL: `http://localhost:8001`

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "version": "2.0.0"
}
```

---

### POST /analyze

Analyze a match using basic (rule-based) or pro (AI-powered) analysis.

**Request Body:**
```json
{
  "match_id": "uuid-string",
  "moves": [
    {"x": 7, "y": 7, "p": "X"},
    {"x": 7, "y": 8, "p": "O"},
    {"x": 8, "y": 7, "p": "X"}
  ],
  "tier": "basic",
  "user_id": "uuid-string",
  "subscription_tier": "trial"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| match_id | string (UUID) | Yes | Unique identifier for the match |
| moves | array | Yes | List of moves with x, y coordinates and player (p) |
| tier | string | No | "basic" or "pro" (default: "basic") |
| user_id | string (UUID) | Yes | User identifier for usage tracking |
| subscription_tier | string | No | User's subscription tier (default: "trial") |

**Response (200 OK):**
```json
{
  "tier": "basic",
  "best_move": {
    "x": 6,
    "y": 7,
    "score": 150.5,
    "reason": "Tạo ba mở, đe dọa mạnh."
  },
  "timeline": [
    {
      "move": 1,
      "player": "X",
      "position": {"x": 7, "y": 7},
      "score": 50.0,
      "win_prob": 0.52,
      "category": "good",
      "note": "Nước đi tốt. Kiểm soát trung tâm."
    }
  ],
  "mistakes": [
    {
      "move": 5,
      "severity": "major",
      "desc": "Sai lầm lớn - mất lợi thế đáng kể. Nên chơi (6, 8) thay vì (4, 4).",
      "best_alternative": {"x": 6, "y": 8}
    }
  ],
  "patterns": [
    {
      "label": "Tứ Hướng",
      "explanation": "Tạo đe dọa từ 4 hướng khác nhau, rất khó phòng thủ.",
      "moves": [12],
      "severity": "high"
    }
  ],
  "summary": {
    "total_moves": 25,
    "winner": "X",
    "x_stats": {
      "total_moves": 13,
      "excellent_moves": 3,
      "good_moves": 5,
      "mistakes": 2,
      "critical_mistakes": 0,
      "avg_score": 120.5,
      "accuracy": 75
    },
    "o_stats": {...},
    "key_insights": ["X kiểm soát trung tâm tốt", "O bỏ lỡ cơ hội phản công"]
  },
  "ai_insights": null,
  "duration_ms": 450
}
```

**Pro Analysis Response** (tier="pro") includes additional `ai_insights`:
```json
{
  "ai_insights": {
    "natural_language_summary": "Ván đấu thể hiện sự kiểm soát tốt của X...",
    "mistake_explanations": [
      {
        "move": 5,
        "why": "Nước này bỏ lỡ cơ hội tạo tứ mở vì...",
        "should": "Nên chơi (6, 8) để tạo đường tấn công kép."
      }
    ],
    "improvement_tips": [
      "Chú ý đến các đe dọa của đối thủ trước khi tấn công.",
      "Tạo nhiều đường tấn công song song để tăng áp lực."
    ],
    "advanced_patterns": [
      {
        "name": "Khai Cuộc Trung Tâm",
        "explanation": "X sử dụng chiến thuật kiểm soát trung tâm hiệu quả."
      }
    ]
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | Invalid request | Missing or invalid parameters |
| 429 | Daily limit reached | Usage limit exceeded |
| 500 | Service unavailable | Internal server error |
| 504 | Timeout | Request exceeded 20s timeout |

---

### POST /ask

Ask a question about a match (Pro feature).

**Request Body:**
```json
{
  "match_id": "uuid-string",
  "question": "Tại sao nước 5 là sai lầm?",
  "user_id": "uuid-string",
  "tier": "trial"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| match_id | string (UUID) | Yes | Match to ask about |
| question | string | Yes | Question in Vietnamese (max 500 chars) |
| user_id | string (UUID) | Yes | User identifier |
| tier | string | No | User's subscription tier |

**Response (200 OK):**
```json
{
  "answer": "Nước 5 là sai lầm vì bạn đã bỏ lỡ cơ hội tạo tứ mở tại (6, 8). Thay vào đó, bạn nên tập trung vào việc phát triển đường tấn công chính.",
  "actions": []
}
```

---

### POST /replay/create

Create a new replay session for interactive analysis.

**Request Body:**
```json
{
  "match_id": "uuid-string",
  "moves": [
    {"x": 7, "y": 7, "p": "X"},
    {"x": 7, "y": 8, "p": "O"}
  ],
  "user_id": "uuid-string",
  "tier": "trial"
}
```

**Response (200 OK):**
```json
{
  "session_id": "uuid-string",
  "total_moves": 25
}
```

---

### POST /replay/navigate

Navigate to a specific move in the replay.

**Request Body:**
```json
{
  "session_id": "uuid-string",
  "move_index": 5
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| session_id | string (UUID) | Yes | Replay session ID |
| move_index | integer | Yes | Target move index (-1 for empty board) |

**Response (200 OK):**
```json
{
  "board_state": [
    [null, null, null, ...],
    [null, "X", "O", ...],
    ...
  ],
  "current_move": 5,
  "player_turn": "O"
}
```

---

### POST /replay/play

Play an alternative move in "what-if" mode.

**Request Body:**
```json
{
  "session_id": "uuid-string",
  "move": {"x": 6, "y": 8, "p": "X"}
}
```

**Response (200 OK):**
```json
{
  "board_state": [[...]],
  "ai_move": {
    "x": 5,
    "y": 7,
    "player": "O"
  },
  "original_outcome": 0.55,
  "current_win_prob": 0.62,
  "comparison": "Nhánh mới tốt hơn. Tỷ lệ thắng tăng 7.0%."
}
```

---

### DELETE /replay/{session_id}

Delete a replay session and free resources.

**Response (200 OK):**
```json
{
  "status": "ok",
  "message": "Session deleted"
}
```

---

### GET /usage

Get usage information for a user.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string (UUID) | Yes | User identifier |
| tier | string | No | User's subscription tier (default: "free") |

**Response (200 OK):**
```json
{
  "tier": "trial",
  "daily_usage": {
    "basic_analysis": 2,
    "pro_analysis": 1,
    "replay": 0,
    "ai_qa": 3
  },
  "monthly_usage": {
    "basic_analysis": 15,
    "pro_analysis": 5,
    "replay": 2,
    "ai_qa": 10
  },
  "daily_remaining": {
    "basic_analysis": 8,
    "pro_analysis": 2,
    "replay": 3,
    "ai_qa": 2
  },
  "monthly_remaining": {
    "basic_analysis": -1,
    "pro_analysis": 25,
    "replay": 28,
    "ai_qa": 20
  }
}
```

Note: `-1` indicates unlimited usage.

---

## Data Models

### Move
```typescript
{
  x: number,      // Row (0-14)
  y: number,      // Column (0-14)
  p: "X" | "O"    // Player
}
```

### TimelineEntry
```typescript
{
  move: number,           // Move number (1-based)
  player: "X" | "O",
  position: {x: number, y: number},
  score: number,          // Position score
  win_prob: number,       // Win probability (0-1)
  category: "excellent" | "good" | "okay" | "weak" | "blunder",
  note: string            // Vietnamese description
}
```

### Mistake
```typescript
{
  move: number,           // Move number where mistake occurred
  severity: "minor" | "major" | "critical",
  desc: string,           // Vietnamese description
  best_alternative: {x: number, y: number}
}
```

### Pattern
```typescript
{
  label: string,          // Pattern name (e.g., "Tứ Hướng")
  explanation: string,    // Vietnamese explanation
  moves: number[],        // Related move numbers
  severity: "low" | "medium" | "high" | "critical"
}
```

---

## Subscription Tiers & Usage Limits

| Feature | Free | Trial (7 days) | Pro | Pro Plus |
|---------|------|----------------|-----|----------|
| Basic Analysis | 3/day | 10/day | Unlimited | Unlimited |
| Pro Analysis | - | 3/day | 30/month | Unlimited |
| Replay | - | 3/day | 30/month | Unlimited |
| AI Q&A | - | 5/day | 30/month | Unlimited |

---

## Error Handling

All errors follow this format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message in Vietnamese"
  },
  "status": 400
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| INVALID_REQUEST | 400 | Missing or invalid parameters |
| UNAUTHORIZED | 403 | Pro tier required |
| RATE_LIMITED | 429 | Daily/monthly limit exceeded |
| TIMEOUT | 504 | Request exceeded timeout |
| INTERNAL_ERROR | 500 | Server error |
| SERVICE_ERROR | 500 | External service unavailable |

---

## Architecture

```
ai/
├── main.py                 # FastAPI application & endpoints
├── analysis/
│   ├── types.py           # Data models & constants
│   ├── threat_detector.py # Threat pattern detection
│   ├── position_evaluator.py # Position & move evaluation
│   ├── basic_analyzer.py  # Rule-based analysis engine
│   └── pro_analyzer.py    # AI-powered analysis engine
├── replay/
│   └── replay_engine.py   # Interactive replay system
└── tests/
    ├── test_threat_detector_property.py
    ├── test_position_evaluator_property.py
    ├── test_basic_analyzer_props.py
    ├── test_pro_analyzer_props.py
    ├── test_replay_lifecycle_props.py
    └── test_integration.py
```

---

## Running Tests

```bash
# Run all tests
python -m pytest ai/tests/ -v

# Run specific test file
python -m pytest ai/tests/test_basic_analyzer_props.py -v

# Run with coverage
python -m pytest ai/tests/ --cov=ai --cov-report=html
```

---

## Performance Requirements

| Operation | Target | Actual |
|-----------|--------|--------|
| Basic Analysis | <2s | ~450ms |
| Pro Analysis | <20s | ~3-5s |
| Navigate to Move | <200ms | ~10ms |
| AI Q&A Response | <20s | ~2-4s |

---

## License

Proprietary - MindPoint Arena
