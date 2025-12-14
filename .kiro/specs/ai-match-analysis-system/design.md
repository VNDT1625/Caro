# Design Document: AI Match Analysis System

## Overview

Hệ thống AI Phân Tích Trận Đấu Caro là một feature phức tạp bao gồm:
- **Backend**: Dual analysis engines (Rule-based + AI-powered), Replay Engine, Q&A Engine
- **Frontend**: Single-screen layout với tier selection, interactive board, tabbed analysis panel
- **Monetization**: 4-tier subscription model (Free, Trial, Pro, Pro Plus)

Hệ thống được xây dựng trên nền tảng hiện có:
- Backend AI: FastAPI (`ai/main.py`) - đã có basic analysis
- Frontend: React + TypeScript (`frontend/src/pages/AiAnalysis.tsx`)
- Database: Supabase (PostgreSQL)
- External AI: OpenRouter API với DeepSeek model

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Match List  │  │ Board Panel │  │Analysis Panel│  │  Chat Panel │    │
│  │  Sidebar    │  │ + Timeline  │  │   (Tabbed)   │  │  (Pro only) │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                              │                                           │
│                    ┌─────────┴─────────┐                                │
│                    │  useAnalysisState │                                │
│                    │    (Custom Hook)  │                                │
│                    └─────────┬─────────┘                                │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │ HTTP/REST
┌──────────────────────────────┼──────────────────────────────────────────┐
│                         Backend (FastAPI)                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        API Layer                                  │   │
│  │  POST /analyze  │  POST /ask  │  POST /replay/*  │  GET /usage   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                               │                                          │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │ Basic Analyzer│  │ Pro Analyzer  │  │ Replay Engine │               │
│  │ (Rule-based)  │  │ (AI-powered)  │  │ (What-if)     │               │
│  └───────┬───────┘  └───────┬───────┘  └───────────────┘               │
│          │                  │                                            │
│  ┌───────┴──────────────────┴───────┐                                   │
│  │         Core Analysis Engine      │                                   │
│  │  ┌─────────────┐ ┌─────────────┐ │                                   │
│  │  │   Threat    │ │  Position   │ │                                   │
│  │  │  Detector   │ │  Evaluator  │ │                                   │
│  │  └─────────────┘ └─────────────┘ │                                   │
│  └───────────────────────────────────┘                                   │
└──────────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────┐
│                         External Services                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │  Supabase   │  │  OpenRouter │  │    Redis    │                     │
│  │  (Database) │  │  (AI API)   │  │   (Cache)   │                     │
│  └─────────────┘  └─────────────┘  └─────────────┘                     │
└──────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend Components

#### 1. ThreatDetector (`ai/analysis/threat_detector.py`)

```python
class ThreatType(Enum):
    FIVE = "five"           # 100000 points
    OPEN_FOUR = "open_four" # 10000 points
    FOUR = "four"           # 1000 points
    OPEN_THREE = "open_three" # 500 points
    THREE = "three"         # 100 points
    OPEN_TWO = "open_two"   # 10 points

class ThreatPosition:
    type: ThreatType
    positions: List[Tuple[int, int]]
    direction: str  # "horizontal", "vertical", "diagonal_down", "diagonal_up"

class ThreatResult:
    threats: Dict[ThreatType, int]  # count per type
    total_score: int
    threat_positions: List[ThreatPosition]

class ThreatDetector:
    def scan_line(board, start, direction, player) -> List[ThreatPosition]
    def detect_all_threats(board, player) -> ThreatResult
    def classify_threat(count, open_ends) -> ThreatType
```

#### 2. PositionEvaluator (`ai/analysis/position_evaluator.py`)

```python
class EvaluationResult:
    score: float
    win_probability: float
    threats: ThreatResult

class MoveClassification(Enum):
    EXCELLENT = "excellent"  # score >= 85
    GOOD = "good"           # 70 <= score < 85
    OKAY = "okay"           # 50 <= score < 70
    WEAK = "weak"           # 30 <= score < 50
    BLUNDER = "blunder"     # score < 30

class PositionEvaluator:
    def __init__(self, threat_detector: ThreatDetector)
    def evaluate_position(board, player) -> EvaluationResult
    def evaluate_move(board, move, player) -> float
    def calculate_win_probability(score) -> float  # sigmoid
    def classify_move(actual_score, best_score) -> MoveClassification
    def position_bonus(x, y, board_size) -> float  # center > edge > corner
```

#### 3. BasicAnalyzer (`ai/analysis/basic_analyzer.py`)

```python
class TimelineEntry:
    move: int
    player: str
    position: Dict[str, int]
    score: float
    win_prob: float
    category: MoveClassification
    note: str

class Mistake:
    move: int
    severity: str  # "minor", "major", "critical"
    desc: str
    best_alternative: Dict[str, int]

class Pattern:
    label: str  # "Tứ Hướng", "Song Song", "Chặn Muộn", "Bỏ Lỡ Thắng"
    explanation: str
    moves: List[int]
    severity: str

class AnalysisResult:
    tier: str
    timeline: List[TimelineEntry]
    mistakes: List[Mistake]
    patterns: List[Pattern]
    best_move: Optional[Dict]
    summary: Dict

class BasicAnalyzer:
    def __init__(self)
    def analyze_game(moves: List[Move]) -> AnalysisResult
    def find_best_moves(board, player, depth=4, top_n=3) -> List[Move]
    def detect_patterns(timeline) -> List[Pattern]
    def generate_note(move, quality, before, after) -> str
    def generate_summary(timeline, mistakes) -> Dict
```

#### 4. ProAnalyzer (`ai/analysis/pro_analyzer.py`)

```python
class ProAnalyzer:
    def __init__(self, api_key: str)
    async def analyze_game(moves: List[Move]) -> AnalysisResult
    async def enhance_with_ai(moves, basic_result) -> Dict
    def build_analysis_prompt(moves, basic_result) -> str
    def parse_ai_response(response) -> Dict
    def merge_results(basic_result, ai_insights) -> Dict
    async def ask_about_game(match_id, question, context) -> str
```

#### 5. ReplayEngine (`ai/replay/replay_engine.py`)

```python
class ReplaySession:
    session_id: str
    match_id: str
    original_moves: List[Move]
    current_board: Board
    current_move_index: int
    mode: str  # "replay", "play_from_here", "what_if"
    divergence_point: Optional[int]

class ReplayEngine:
    def __init__(self)
    def create_replay_session(match_id, moves) -> str
    def navigate_to_move(session_id, move_index) -> Dict
    async def play_from_here(session_id, user_move) -> Dict
    async def analyze_divergence(session) -> Dict
    def cleanup_session(session_id) -> None
```

### Frontend Components

#### 1. State Management (`useAnalysisState.ts`)

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
  
  // Tier & Subscription
  tier: 'basic' | 'pro'
  hasProAccess: boolean
  isTrialActive: boolean
  trialDaysLeft: number
  dailyUsage: { basic: number; pro: number }
  
  // UI State
  currentMoveIndex: number
  isPlaying: boolean
  playSpeed: number
  activeTab: 'summary' | 'mistakes' | 'patterns' | 'alternatives'
  
  // Replay
  replayMode: boolean
  replaySessionId: string | null
  
  // Loading
  loadingMatches: boolean
  analyzing: boolean
  error: string | null
  
  // Actions
  selectMatch: (id: string) => void
  analyze: (tier: 'basic' | 'pro') => Promise<void>
  setCurrentMove: (index: number) => void
  play: () => void
  pause: () => void
  jumpToMove: (index: number) => void
  enterReplayMode: (startMove: number) => Promise<void>
  exitReplayMode: () => void
  playAlternativeMove: (move: Move) => Promise<void>
  askQuestion: (question: string) => Promise<string>
}
```

#### 2. UI Components

```
AiAnalysis.tsx (Main Page)
├── ControlsBar
│   ├── TierToggle (Basic/Pro with usage indicators)
│   ├── MatchSelect (dropdown)
│   ├── AnalyzeButton
│   ├── ModeButtons (Analysis/Replay/Q&A - Pro only)
│   └── CloseButton
├── MatchListSidebar
│   ├── SearchInput
│   ├── Filters (AI matches, date range)
│   └── MatchList (virtual scroll)
├── BoardPanel
│   ├── InteractiveBoard (15x15 grid)
│   ├── MoveSlider
│   ├── PlayControls (play/pause, speed)
│   └── ScoreTimeline (chart)
├── AnalysisPanel
│   ├── Tabs
│   │   ├── SummaryView
│   │   ├── MistakesView
│   │   ├── PatternsView
│   │   └── AlternativesView
│   └── ProInsightsView (Pro only)
├── ReplayModePanel (Pro only)
│   ├── BranchComparison
│   └── ReplayControls
└── AiChatPanel (Pro only)
    ├── ChatHistory
    ├── SuggestedQuestions
    └── ChatInput
```

## Data Models

### Database Tables (Supabase)

#### subscriptions
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id),
  tier VARCHAR NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'trial', 'pro', 'pro_plus')),
  status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### usage_logs
```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id),
  feature VARCHAR NOT NULL CHECK (feature IN ('basic_analysis', 'pro_analysis', 'replay', 'ai_qa')),
  count INTEGER DEFAULT 1,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  period VARCHAR NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_usage_logs_user_date ON usage_logs(user_id, date);
CREATE INDEX idx_usage_logs_user_period ON usage_logs(user_id, period);
```

#### analysis_cache
```sql
CREATE TABLE analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id),
  tier VARCHAR NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '1 hour',
  UNIQUE(match_id, tier)
);
```

### API Request/Response Models

#### POST /analyze
```typescript
// Request
interface AnalyzeRequest {
  match_id: string
  moves: Move[]
  tier: 'basic' | 'pro'
  user_id: string
  difficulty?: TrainingDifficulty
}

// Response
interface AnalyzeResponse {
  tier: string
  best_move: BestMove | null
  timeline: TimelineEntry[]
  mistakes: Mistake[]
  patterns: Pattern[]
  alt_lines: AltLine[]
  summary: Summary
  ai_insights?: AIInsights  // Pro only
  duration_ms: number
}
```

#### POST /ask
```typescript
// Request
interface AskRequest {
  match_id: string
  question: string
  user_id: string
}

// Response
interface AskResponse {
  answer: string
  actions?: Action[]  // clickable actions
}
```

#### POST /replay/create
```typescript
// Request
interface CreateReplayRequest {
  match_id: string
  user_id: string
}

// Response
interface CreateReplayResponse {
  session_id: string
  total_moves: number
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Threat Detection Completeness and Accuracy
*For any* valid board state with pieces placed, the ThreatDetector SHALL identify all threat patterns correctly, where:
- Each identified threat has a valid type (five, open_four, four, open_three, three, open_two)
- The threat score matches the expected value for its type
- No duplicate threats are reported for the same positions
- All threats on the board are detected (no false negatives)

**Validates: Requirements 1.1, 1.2, 1.3, 1.5**

### Property 2: Position Evaluation Consistency
*For any* board state and player, the PositionEvaluator SHALL:
- Return scores for both players that reflect their relative positions
- Calculate win probability in the range [0, 1] using sigmoid function
- Classify moves consistently based on score thresholds (excellent >= 85, good >= 70, okay >= 50, weak >= 30, blunder < 30)
- Award higher position bonus for center positions than edge/corner positions

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 3: Basic Analysis Output Structure
*For any* valid game with N moves, the BasicAnalyzer SHALL return:
- A timeline with exactly N entries, each containing move number, player, score, win_prob, and note
- Mistakes list where each mistake has valid severity (minor, major, critical) and references a valid move number
- Patterns list where each pattern has a label, explanation, and associated moves
- Best move recommendation within board bounds with a non-empty reason string

**Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6**

### Property 4: Analysis Performance
*For any* game with up to 225 moves (full 15x15 board), the BasicAnalyzer SHALL complete analysis within 2 seconds, and board state navigation SHALL complete within 200ms.

**Validates: Requirements 3.1, 5.2**

### Property 5: Pro Analysis Enhancement
*For any* Pro analysis request, the system SHALL:
- First complete basic analysis successfully
- Enhance with AI insights that include natural language explanations
- Return improvement tips that are non-empty and relevant to detected mistakes
- Gracefully fallback to basic analysis if AI API fails

**Validates: Requirements 4.1, 4.3, 4.6, 4.5**

### Property 6: Replay Session Lifecycle
*For any* replay session, the ReplayEngine SHALL:
- Initialize with original moves and empty board state
- Navigate to any move index and produce correct board state
- Mark divergence point when user plays alternative move
- Clean up session resources when exited

**Validates: Requirements 5.1, 5.2, 5.3, 5.6**

### Property 7: Replay AI Response Validity
*For any* user move in what-if mode, the AI response SHALL be a valid move on the current board (empty cell within bounds), and the comparison analysis SHALL include original outcome and current win probability.

**Validates: Requirements 5.4, 5.5**

### Property 8: Q&A Context Relevance
*For any* question about a match, the AI answer SHALL:
- Be non-empty and in Vietnamese
- Include context about referenced moves when applicable
- Contain actionable links/options when suggesting actions

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 9: Subscription Tier Lifecycle
*For any* user, the subscription system SHALL:
- Assign Free tier by default for new users
- Set trial_started_at and expires_at (7 days later) when Trial is activated
- Revert to Free tier when Trial expires
- Enforce correct usage limits based on tier

**Validates: Requirements 7.1, 7.3, 7.4, 7.5, 7.6**

### Property 10: Usage Tracking Accuracy
*For any* feature usage, the system SHALL:
- Create a usage log with correct user_id, feature, date, and period
- Count daily usage only for the current date
- Count monthly usage only for the current month
- Return accurate remaining allowances (daily and monthly)

**Validates: Requirements 8.1, 8.2, 8.3, 8.5**

### Property 11: API Contract Compliance
*For any* API request, the endpoints SHALL:
- Validate request structure and return 400 for invalid requests
- Check tier permissions and return 403 for unauthorized access
- Return correctly structured responses matching the defined schemas
- Return appropriate error codes (400, 403, 429, 500) without exposing internal details

**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

### Property 12: Board State Consistency
*For any* sequence of moves, the board display SHALL accurately reflect the game state at the current move index, with correct piece positions and move numbers.

**Validates: Requirements 10.3, 13.1**

### Property 13: Mistake Grouping and Highlighting
*For any* analysis result with mistakes, the UI SHALL group mistakes by severity with correct color coding (critical: red, major: orange, minor: yellow), and highlight the correct move on the board when clicked.

**Validates: Requirements 12.2, 13.3**

### Property 14: Timeline Chart Data Consistency
*For any* analysis timeline, the score chart SHALL display data points that match the timeline entries, with correct win probability values for each move.

**Validates: Requirements 13.4**

### Property 15: Cache Behavior
*For any* analysis result, the system SHALL cache it with the key format `{match_id}:{tier}` and TTL of 1 hour, and subsequent requests for the same analysis SHALL return the cached result.

**Validates: Requirements 16.1, 16.2**

### Property 16: Input Validation and Sanitization
*For any* user input (moves, questions, match IDs), the system SHALL validate format and sanitize content before processing, rejecting invalid inputs with appropriate error messages.

**Validates: Requirements 17.4**

## Error Handling

### Backend Error Handling

| Error Type | HTTP Code | Response | Recovery |
|------------|-----------|----------|----------|
| Invalid request | 400 | `{"error": "Invalid request", "details": "..."}` | Client fixes request |
| Unauthorized tier | 403 | `{"error": "Pro tier required"}` | Show upgrade modal |
| Rate limit exceeded | 429 | `{"error": "Daily limit reached", "reset_at": "..."}` | Wait for reset |
| AI API failure | 200 | Fallback to basic analysis | Automatic |
| Database error | 500 | `{"error": "Service unavailable"}` | Retry with backoff |
| Timeout | 504 | `{"error": "Request timeout"}` | Allow retry |

### Frontend Error Handling

```typescript
// Error boundary for analysis components
class AnalysisErrorBoundary extends React.Component {
  state = { hasError: false, error: null }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={this.props.onRetry} />
    }
    return this.props.children
  }
}

// API error handling
async function handleApiError(error: ApiError) {
  switch (error.status) {
    case 403:
      showUpgradeModal()
      break
    case 429:
      showLimitReachedMessage(error.reset_at)
      break
    case 500:
    case 504:
      showRetryOption()
      break
    default:
      showGenericError()
  }
}
```

## Testing Strategy

### Dual Testing Approach

This system requires both unit tests and property-based tests:
- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property-based tests**: Verify universal properties that should hold across all inputs

### Property-Based Testing Framework

- **Backend (Python)**: Use `hypothesis` library
- **Frontend (TypeScript)**: Use `fast-check` library

### Test Configuration

- Minimum 100 iterations per property test
- Each property test must be tagged with the format: `**Feature: ai-match-analysis-system, Property {number}: {property_text}**`

### Backend Tests (`ai/tests/`)

#### Unit Tests
```python
# test_threat_detector.py
def test_detect_five_in_row():
    """Verify FIVE detection for horizontal line"""
    
def test_detect_open_four():
    """Verify OPEN_FOUR detection with both ends open"""
    
def test_no_false_positives():
    """Verify no threats detected on empty board"""

# test_position_evaluator.py
def test_center_bonus_higher_than_corner():
    """Verify position bonus calculation"""
    
def test_win_probability_range():
    """Verify sigmoid output is in [0, 1]"""

# test_basic_analyzer.py
def test_timeline_length_matches_moves():
    """Verify timeline has correct number of entries"""
    
def test_mistake_severity_classification():
    """Verify severity levels are correctly assigned"""
```

#### Property-Based Tests
```python
# test_properties.py
from hypothesis import given, strategies as st

@given(board=st.lists(st.tuples(st.integers(0, 14), st.integers(0, 14), st.sampled_from(['X', 'O']))))
def test_threat_detection_completeness():
    """
    **Feature: ai-match-analysis-system, Property 1: Threat Detection Completeness and Accuracy**
    """
    # Test implementation

@given(score=st.floats(min_value=-100000, max_value=100000))
def test_win_probability_range():
    """
    **Feature: ai-match-analysis-system, Property 2: Position Evaluation Consistency**
    """
    prob = calculate_win_probability(score)
    assert 0 <= prob <= 1
```

### Frontend Tests (`frontend/src/__tests__/`)

#### Unit Tests
```typescript
// AiAnalysis.test.tsx
describe('AiAnalysis', () => {
  it('should display 3-column layout on desktop')
  it('should highlight selected match')
  it('should show loading state during analysis')
  it('should group mistakes by severity')
})

// useAnalysisState.test.ts
describe('useAnalysisState', () => {
  it('should initialize with default values')
  it('should update currentMoveIndex correctly')
  it('should cache analysis results')
})
```

#### Property-Based Tests
```typescript
// analysis.property.test.ts
import fc from 'fast-check'

describe('Analysis Properties', () => {
  it('Property 12: Board State Consistency', () => {
    /**
     * **Feature: ai-match-analysis-system, Property 12: Board State Consistency**
     */
    fc.assert(
      fc.property(
        fc.array(fc.record({ x: fc.integer(0, 14), y: fc.integer(0, 14), p: fc.constantFrom('X', 'O') })),
        fc.integer(0, 225),
        (moves, moveIndex) => {
          const boardState = getBoardStateAtMove(moves, moveIndex)
          // Verify board state matches expected
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

### Integration Tests

```python
# test_api_integration.py
async def test_analyze_endpoint_basic():
    """Test POST /analyze with basic tier"""
    
async def test_analyze_endpoint_pro_unauthorized():
    """Test POST /analyze with pro tier without subscription"""
    
async def test_replay_session_lifecycle():
    """Test complete replay session flow"""
    
async def test_usage_tracking_accuracy():
    """Test usage counting and limits"""
```

### Test Coverage Requirements

| Component | Unit Test Coverage | Property Test Coverage |
|-----------|-------------------|----------------------|
| ThreatDetector | 90% | Properties 1 |
| PositionEvaluator | 85% | Properties 2 |
| BasicAnalyzer | 85% | Properties 3, 4 |
| ProAnalyzer | 80% | Properties 5 |
| ReplayEngine | 85% | Properties 6, 7 |
| API Endpoints | 90% | Properties 11 |
| Frontend Components | 80% | Properties 12, 13, 14 |
| Subscription/Usage | 90% | Properties 9, 10 |
