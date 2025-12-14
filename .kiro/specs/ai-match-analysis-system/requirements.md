# Requirements Document

## Introduction

Hệ thống AI Phân Tích Trận Đấu Caro (AI Match Analysis System) là một tính năng quan trọng giúp người chơi nâng cao trình độ thông qua phân tích chi tiết từng ván đấu. Hệ thống cung cấp 4 tiers (Free, Trial, Pro, Pro Plus) với các tính năng từ cơ bản đến nâng cao, bao gồm: phân tích rule-based, phân tích AI-powered với natural language, Interactive Replay, và AI Q&A Chat.

## Glossary

- **Basic Analysis**: Phân tích rule-based sử dụng thuật toán tự phát triển, nhanh (<2s)
- **Pro Analysis**: Phân tích AI-powered sử dụng OpenRouter/DeepSeek API với natural language insights
- **Interactive Replay**: Tính năng cho phép người chơi replay ván đấu và chơi lại với AI từ bất kỳ nước nào
- **AI Q&A Chat**: Tính năng hỏi đáp về ván đấu với AI
- **Threat Detection**: Hệ thống phát hiện các mối đe dọa trên bàn cờ (five, open_four, four, open_three, etc.)
- **Position Evaluator**: Module đánh giá vị trí và nước đi trên bàn cờ
- **Timeline**: Danh sách đánh giá từng nước đi theo thời gian
- **Mistake**: Sai lầm được phát hiện trong ván đấu với mức độ nghiêm trọng (minor, major, critical)
- **Pattern**: Các mẫu chiến thuật được phát hiện (Tứ Hướng, Song Song, Chặn Muộn, Bỏ Lỡ Thắng)
- **Win Probability**: Xác suất thắng được tính toán dựa trên đánh giá vị trí
- **Subscription Tier**: Cấp độ đăng ký của người dùng (Free, Trial, Pro, Pro Plus)
- **Usage Limit**: Giới hạn sử dụng theo ngày hoặc tháng cho mỗi tier

## Requirements

### Requirement 1: Threat Detection System

**User Story:** As a developer, I want a threat detection system that can scan the board and identify all threats, so that the analysis engine can evaluate positions accurately.

#### Acceptance Criteria

1. WHEN the ThreatDetector scans a line (horizontal, vertical, diagonal) THEN the system SHALL identify all threat patterns (five, open_four, four, open_three, three, open_two)
2. WHEN the ThreatDetector detects a threat THEN the system SHALL classify it with the correct type and score (FIVE: 100000, OPEN_FOUR: 10000, FOUR: 1000, OPEN_THREE: 500, THREE: 100, OPEN_TWO: 10)
3. WHEN the ThreatDetector completes scanning THEN the system SHALL return a structured result containing threat counts, total score, and threat positions with directions
4. WHEN the board state changes THEN the system SHALL recalculate threats for the affected areas within 100ms
5. WHEN multiple threats exist on the same line THEN the system SHALL detect and report all of them without duplication

### Requirement 2: Position Evaluator

**User Story:** As a developer, I want a position evaluator that can assess board positions and individual moves, so that the analysis can provide accurate scoring and recommendations.

#### Acceptance Criteria

1. WHEN evaluating a position THEN the system SHALL calculate scores for both players based on their threats
2. WHEN evaluating a move THEN the system SHALL consider offensive potential, defensive value, and strategic position bonus (center > edge > corner)
3. WHEN calculating win probability THEN the system SHALL use a sigmoid function to convert score to probability (0-1 range)
4. WHEN classifying a move THEN the system SHALL categorize it as excellent (>=85), good (70-84), okay (50-69), weak (30-49), or blunder (<30)
5. WHEN comparing moves THEN the system SHALL identify the delta between actual move and best move to determine mistake severity

### Requirement 3: Basic Analysis Engine (Rule-Based)

**User Story:** As a user, I want to analyze my matches using a fast rule-based engine, so that I can quickly understand my mistakes and improve my gameplay.

#### Acceptance Criteria

1. WHEN a user requests basic analysis THEN the system SHALL complete the analysis within 2 seconds
2. WHEN analyzing a game THEN the system SHALL generate a timeline with move-by-move evaluation including score, win probability, and notes
3. WHEN detecting mistakes THEN the system SHALL identify weak and blunder moves with severity levels and suggest better alternatives
4. WHEN detecting patterns THEN the system SHALL identify tactical patterns (Tứ Hướng, Song Song, Chặn Muộn, Bỏ Lỡ Thắng)
5. WHEN generating notes THEN the system SHALL use template-based descriptions in Vietnamese
6. WHEN the analysis completes THEN the system SHALL return best move recommendation with reason



### Requirement 4: Pro Analysis Engine (AI-Powered)

**User Story:** As a Pro user, I want AI-powered analysis with natural language insights, so that I can get deeper understanding of my gameplay with personalized explanations.

#### Acceptance Criteria

1. WHEN a Pro user requests analysis THEN the system SHALL first run basic analysis to gather data, then enhance with AI insights
2. WHEN generating AI insights THEN the system SHALL use OpenRouter/DeepSeek API with the Gomoku expert system prompt
3. WHEN explaining mistakes THEN the system SHALL provide natural language explanations with WHY it's bad and WHAT should be done
4. WHEN detecting patterns THEN the system SHALL identify advanced patterns beyond basic detection
5. WHEN the AI API fails THEN the system SHALL gracefully fallback to basic analysis results
6. WHEN generating improvement tips THEN the system SHALL provide personalized, actionable advice based on the player's mistakes

### Requirement 5: Interactive Replay Engine

**User Story:** As a Pro user, I want to replay my matches and play alternative moves against AI, so that I can explore "what-if" scenarios and learn from different approaches.

#### Acceptance Criteria

1. WHEN a user creates a replay session THEN the system SHALL load the original match moves and initialize an empty board
2. WHEN a user navigates to a specific move THEN the system SHALL replay the board state up to that move within 200ms
3. WHEN a user plays an alternative move THEN the system SHALL mark the divergence point and switch to "what-if" mode
4. WHEN in what-if mode THEN the system SHALL have AI respond to user moves with adaptive difficulty
5. WHEN comparing branches THEN the system SHALL show original outcome vs current win probability with comparison analysis
6. WHEN the user exits replay THEN the system SHALL clean up the session and free resources

### Requirement 6: AI Q&A Chat

**User Story:** As a Pro user, I want to ask questions about my match and get AI-powered answers, so that I can understand specific situations and decisions better.

#### Acceptance Criteria

1. WHEN a user asks a question about a match THEN the system SHALL load the analysis context and generate a relevant answer
2. WHEN answering questions THEN the system SHALL provide concise, specific, and easy-to-understand responses in Vietnamese
3. WHEN the question references a specific move THEN the system SHALL include context about that move in the response
4. WHEN suggesting actions THEN the system SHALL provide clickable options to view moves or start replay from that point
5. WHEN the daily question limit is reached THEN the system SHALL inform the user and suggest upgrading

### Requirement 7: Subscription Tier Management

**User Story:** As a system administrator, I want to manage subscription tiers with usage limits, so that the monetization model works correctly.

#### Acceptance Criteria

1. WHEN a new user registers THEN the system SHALL assign them to the Free tier by default
2. WHEN a Free user first clicks a Pro feature THEN the system SHALL offer to activate a 7-day Trial automatically
3. WHEN a Trial is activated THEN the system SHALL track the start date and expire after 7 days
4. WHEN a Trial expires THEN the system SHALL revert the user to Free tier and show upgrade modal
5. WHEN checking usage limits THEN the system SHALL enforce daily limits for Free/Trial and monthly limits for Pro tiers
6. WHEN a user reaches their limit THEN the system SHALL block the feature and show remaining time until reset

### Requirement 8: Usage Tracking

**User Story:** As a system administrator, I want to track feature usage per user, so that limits can be enforced and analytics can be gathered.

#### Acceptance Criteria

1. WHEN a user uses a feature THEN the system SHALL log the usage with user_id, feature type, date, and period
2. WHEN checking daily usage THEN the system SHALL count uses for the current date only
3. WHEN checking monthly usage THEN the system SHALL count uses for the current month only
4. WHEN multiple requests occur simultaneously THEN the system SHALL handle race conditions and maintain accurate counts
5. WHEN usage data is queried THEN the system SHALL return remaining daily and monthly allowances

### Requirement 9: API Endpoints

**User Story:** As a frontend developer, I want well-defined API endpoints for analysis features, so that the UI can integrate seamlessly.

#### Acceptance Criteria

1. WHEN POST /analyze is called THEN the system SHALL validate the request, check tier permissions, and return analysis results
2. WHEN POST /ask is called THEN the system SHALL validate Pro subscription, check rate limits, and return AI answer
3. WHEN POST /replay/create is called THEN the system SHALL create a replay session and return session_id
4. WHEN POST /replay/navigate is called THEN the system SHALL return the board state at the specified move
5. WHEN POST /replay/play is called THEN the system SHALL process user move, get AI response, and return updated state
6. WHEN any endpoint fails THEN the system SHALL return appropriate error codes and messages without exposing internal details

### Requirement 10: Frontend UI - Layout and Navigation

**User Story:** As a user, I want a clean, single-screen layout for match analysis, so that I can view all information without excessive scrolling.

#### Acceptance Criteria

1. WHEN the analysis page loads THEN the system SHALL display a 3-column grid layout (Match List, Board, Analysis Panel)
2. WHEN selecting a match THEN the system SHALL highlight the selection and load the analysis automatically
3. WHEN navigating moves THEN the system SHALL update the board display and highlight the current move
4. WHEN using keyboard shortcuts THEN the system SHALL respond to Arrow keys (prev/next), Space (play/pause), Home/End (first/last)
5. WHEN the screen is resized THEN the system SHALL adapt the layout responsively (3-col > 2-col > 1-col)

### Requirement 11: Frontend UI - Tier Toggle and Controls

**User Story:** As a user, I want to easily switch between Basic and Pro analysis modes, so that I can choose the level of analysis I need.

#### Acceptance Criteria

1. WHEN displaying the tier toggle THEN the system SHALL show current tier, usage indicators, and trial countdown if applicable
2. WHEN a user without Pro access clicks Pro THEN the system SHALL show upgrade modal or offer Trial activation
3. WHEN Trial is active THEN the system SHALL display remaining days and daily usage prominently
4. WHEN switching tiers THEN the system SHALL not re-trigger analysis if already completed for that tier
5. WHEN the analyze button is clicked THEN the system SHALL show loading state and disable the button until complete

### Requirement 12: Frontend UI - Analysis Panel

**User Story:** As a user, I want a tabbed analysis panel with organized information, so that I can easily find mistakes, patterns, and suggestions.

#### Acceptance Criteria

1. WHEN displaying analysis results THEN the system SHALL organize content into tabs (Tổng Quan, Sai Lầm, Patterns, Đề Xuất)
2. WHEN showing mistakes THEN the system SHALL group by severity with color coding (critical: red, major: orange, minor: yellow)
3. WHEN clicking a mistake THEN the system SHALL jump the board to that move and highlight it
4. WHEN showing patterns THEN the system SHALL display with icons and explanations in a compact grid
5. WHEN showing alternatives THEN the system SHALL allow preview with score comparison

### Requirement 13: Frontend UI - Interactive Board

**User Story:** As a user, I want an interactive board with move navigation and visual indicators, so that I can understand the game flow easily.

#### Acceptance Criteria

1. WHEN displaying the board THEN the system SHALL show a 15x15 grid with pieces and move numbers
2. WHEN navigating moves THEN the system SHALL provide a slider and play/pause controls for auto-play
3. WHEN highlighting moves THEN the system SHALL use green border for best move, red border for mistakes, and pulsing animation for current move
4. WHEN displaying the score timeline THEN the system SHALL show a chart with win probability over time
5. WHEN clicking on the timeline THEN the system SHALL jump to that move on the board

### Requirement 14: Frontend UI - Replay Mode

**User Story:** As a Pro user, I want a dedicated replay mode UI, so that I can easily play alternative moves and compare outcomes.

#### Acceptance Criteria

1. WHEN entering replay mode THEN the system SHALL show a modal to select the starting move
2. WHEN in replay mode THEN the system SHALL make the board interactive for user moves
3. WHEN AI is thinking THEN the system SHALL show a thinking indicator
4. WHEN comparing branches THEN the system SHALL display side-by-side comparison of original vs new branch
5. WHEN exiting replay mode THEN the system SHALL return to analysis view with original data

### Requirement 15: Frontend UI - AI Chat Panel

**User Story:** As a Pro user, I want an AI chat panel integrated with the analysis, so that I can ask questions about my match.

#### Acceptance Criteria

1. WHEN displaying the chat panel THEN the system SHALL show chat history, input field, and usage indicator
2. WHEN suggesting questions THEN the system SHALL provide quick buttons for common questions
3. WHEN displaying AI responses THEN the system SHALL format them with actionable links (view move, replay from here)
4. WHEN the user is not Pro THEN the system SHALL disable the input and show upgrade prompt
5. WHEN sending a message THEN the system SHALL show loading state and append the response to history

### Requirement 16: Performance and Caching

**User Story:** As a user, I want fast analysis and smooth UI interactions, so that my experience is not hindered by slow loading.

#### Acceptance Criteria

1. WHEN analysis results are generated THEN the system SHALL cache them for 1 hour with match_id:tier as key
2. WHEN the same analysis is requested THEN the system SHALL return cached results immediately
3. WHEN rendering the board THEN the system SHALL use memoization to avoid unnecessary re-renders
4. WHEN loading heavy components THEN the system SHALL use lazy loading with suspense fallbacks
5. WHEN the AI API is slow THEN the system SHALL show progress indication and allow cancellation after 20 seconds

### Requirement 17: Error Handling and Graceful Degradation

**User Story:** As a user, I want the system to handle errors gracefully, so that I can still use available features when something fails.

#### Acceptance Criteria

1. WHEN the AI API fails THEN the system SHALL fallback to basic analysis and inform the user
2. WHEN the database is unavailable THEN the system SHALL show appropriate error message without crashing
3. WHEN a request times out THEN the system SHALL allow retry with exponential backoff
4. WHEN invalid data is received THEN the system SHALL validate and sanitize before processing
5. WHEN an unexpected error occurs THEN the system SHALL log details server-side and show generic message to user
6. đừng hỏi lại tôi :I've been encountering repeated failures and would like your input.

Before I continue exploring more alternatives, please let me know how you'd like me to proceed — I can either keep iterating with different approaches, or switch to alternative methods if you provide more detailed instructions. -> tôi luôn luôn chọn cho bạn thử nghiệm với các phương pháp khác nhau hoặc chuyển sang các phương pháp thay thế hoặc là tự đọc lại dự án để tìm bước kế tiếp phù hợp thật sự 

7.I've been using the same tool repeatedly. This might indicate I'm stuck in a loop.

What would you like me to do? -> luôn chọn "Continue with different approaches" hoặc "Try alternative methods" - tức là cho phép AI tự tìm cách khác để giải quyết vấn đề thay vì hỏi lại.
8. 6 và 7 luôn chọn Keep Iterating
9.Lỗi "Exit Code: -1" là do cách Windows xử lý command, không phải do tests fail. - Đó là vì lệnh executePwsh gặp vấn đề với đường dẫn trên Windows (hiển thị "The system cannot find the path specified") nhưng thực tế tests vẫn chạy và pass. - thanh cong va dung lai
