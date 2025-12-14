# Tasks - AI Match Analysis System
# note - Always choose Keep Iterating

## Giai đoạn 1: AI Core Module (Python) ✅ HOÀN THÀNH

- [x] 1.1 Threat Detection System
  - [x] Implement `ai/analysis/threat_detector.py`
  - [x] Write property test (Property 1)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.2 Position Evaluator
  - [x] Implement `ai/analysis/position_evaluator.py`
  - [x] Write property test (Property 2)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 1.3 Basic Analyzer (Rule-Based)
  - [x] Implement `ai/analysis/basic_analyzer.py`
  - [x] Write property tests (Property 3, 4)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 1.4 Pro Analyzer (AI-Powered)
  - [x] Implement `ai/analysis/pro_analyzer.py` with OpenRouter/DeepSeek
  - [x] Write property test (Property 5)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 1.5 AI Q&A Feature
  - [x] Add `ask_about_game()` to ProAnalyzer
  - [x] Write property test (Property 8)
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 1.6 Replay Engine
  - [x] Implement `ai/replay/replay_engine.py`
  - [x] Write property tests (Property 6, 7)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 1.7 Checkpoint - AI Core Tests
  - [x] Run all property tests, ensure pass

---

## Giai đoạn 2: Python API Layer ✅ HOÀN THÀNH

- [x] 2.1 Complete Python API Layer
  - [x] Run `python -m pytest ai/tests/ -v` và fix any failing tests
  - [x] Update `ai/main.py` với các endpoints:
    - `POST /analyze` - phân tích trận đấu (basic/pro)
    - `POST /ask` - hỏi đáp AI
    - `POST /replay/create` - tạo replay session
    - `POST /replay/navigate` - di chuyển đến nước cụ thể
    - `POST /replay/play` - chơi nước thay thế
    - `GET /usage` - lấy thông tin sử dụng
  - [x] Add request validation và error handling
  - [x] Test các endpoints với sample requests
  - [x] Verify error responses đúng format
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

---

## Giai đoạn 3: PHP Backend Integration ✅ HOÀN THÀNH

- [x] 3.1 Database & Bridge Service
  - [x] Create migrations: `subscriptions_table.sql`, `usage_logs_table.sql`, `analysis_cache_table.sql`
  - [x] Create `AIBridgeService.php` + Interface (HTTP calls to Python, timeouts, retries)
  - _Requirements: 7.1, 8.1, 16.1_

- [x] 3.2 Subscription & Usage Services
  - [x] Create `SubscriptionService.php` + Interface + Property test
  - [x] Create `UsageService.php` + Interface + Property test
  - _Requirements: 7.1-7.6, 8.1-8.5_

- [x] 3.3 API Controller & Caching
  - [x] Create `AnalysisController.php` với routes + Property test
  - [x] Add caching logic (key: `{match_id}:{tier}`, TTL: 1h) + Property test
  - [x] Test PHP → Python communication
  - _Requirements: 9.1-9.6, 16.1, 16.2_

---

## Giai đoạn 4: Frontend Core ✅ HOÀN THÀNH

- [x] 4.1 API Client & State Hook
  - [x] Create `analysisApi.ts` (analyzeMatch, askQuestion, createReplaySession, navigateReplay, playReplayMove, getUsage) + error handling + 20s timeout
  - [x] Create `useAnalysisState.ts` hook với state và actions
  - [x] Test API client và state hook
  - _Requirements: 9.1-9.5, 10.1-10.3, 11.4, 16.5_

---

## Giai đoạn 5: Frontend UI Components ✅ HOÀN THÀNH

- [x] 5.1 Layout & Board Components
  - [x] Update `AiAnalysis.tsx` (3-column responsive grid) + `ControlsBar` + `MatchListSidebar`
  - [x] Create `InteractiveBoard.tsx` (15x15 grid, highlighting) + `MoveNavigation` + `ScoreTimeline`
  - _Requirements: 10.1-10.5, 11.1-11.5, 13.1-13.5_

- [x] 5.2 Analysis Panel & Pro Features
  - [x] Analysis Panel integrated into AiAnalysis.tsx (Summary, Mistakes, Patterns, Move Quality tabs)
  - [x] Pro UI: Upgrade modal implemented in AiAnalysis.tsx
  - [x] Visual testing và responsive layout testing
  - _Requirements: 12.1-12.5, 14.1-14.5, 15.1-15.5_

---

## Giai đoạn 6: Optimization & Error Handling ✅ HOÀN THÀNH

- [x] 6.1 Optimization & Error Handling
  - [x] Frontend: Add memoization (React.memo, useMemo) + lazy loading với Suspense
  - [x] Backend: Add comprehensive error handling (400, 403, 429, 500, 504) + input validation/sanitization
  - [x] Frontend: Create `AnalysisErrorBoundary` + handle API errors (upgrade modal, retry)
  - [x] Test error scenarios và verify graceful degradation
  - _Requirements: 16.3, 16.4, 17.1-17.5_

---

## Giai đoạn 7: Final Integration & Polish

- [x] Integration Testing
  - [x] Test analysis flow (Basic → Pro) end-to-end
  - [x] Test replay lifecycle (create → navigate → play → cleanup)
  - [x] Test subscription/usage limits enforcement
  - [x] Test error handling scenarios (timeout, rate limit, auth)

  - _Requirements: 9.1-9.6, 16.1-16.5, 17.1-17.5_

- [x] UI Polish & Translation




  - [x] Verify 4 language translations in `i18n.json` are complete for all AI Analysis strings(vn,en,cn,jp)





  - [x] Ensure consistent styling across all analysis components


  - [x] Verify loading states display correctly


  - [x] Test responsive layout on mobile/tablet/desktop


  - _Requirements: 10.5, 12.1-12.5_

- [x] Documentation
  - [x] Update `ai/README.md` với API docs (endpoints, request/response formats)
  - [x] Add inline comments to complex functions
  - _Requirements: Documentation_

- [x] Final Checkpoint



  - [x] Run all Python tests: `python -m pytest ai/tests/ -v`

  - [x] Run all PHP tests: `vendor/bin/phpunit tests/`

  - [x] Manual testing: complete analysis flow

  - [x] Performance testing: verify < 2s analysis, < 200ms navigation

  - _Requirements: 3.1, 5.2, 16.1-16.5_

---

## Giai đoạn 8: World-Class AI Analysis Engine 🚀

**Mục tiêu:** Nâng cấp module AI từ 7/10 lên 10/10, trở thành best-in-class cho Caro/Gomoku analysis.

### 8.1 Advanced Search Engine
- [x] **8.1.1 Transposition Table** ✅
  - [x] Implement Zobrist hashing cho board positions
  - [x] Create `ai/analysis/transposition_table.py` với LRU cache
  - [x] Tích hợp vào minimax để tránh tính lại positions đã biết
  - [x] Property test: same position → same hash, different position → different hash (13 tests passed)
  - _Impact: +30% search speed_

- [x] **8.1.2 Iterative Deepening** ✅
  - [x] Upgrade `find_best_moves()` với iterative deepening (depth 2→4→6→8→10)
  - [x] Add time management: stop khi còn 20% time budget
  - [x] Return best move từ deepest completed search
  - [x] Property test: deeper search → better or equal move quality (12 tests passed)
  - _Impact: Tìm được nước tốt hơn trong cùng thời gian_

- [x] **8.1.3 Move Ordering** ✅
  - [x] Implement killer moves heuristic (nhớ nước gây cắt tỉa)
  - [x] Implement history heuristic (nước hay được chọn → ưu tiên cao)
  - [x] Sort candidates: threats > killers > history > position bonus
  - [x] Property test: better ordering → more pruning → faster search (12 tests passed)
  - _Impact: +50% alpha-beta pruning efficiency_

- [x] **8.1.4 VCF Search (Victory by Continuous Four)**
  - [x] Create `ai/analysis/vcf_search.py`
  - [x] Implement threat sequence search: FOUR → FOUR → ... → FIVE
  - [x] Detect winning sequences up to 20 moves deep
  - [x] Property test: nếu có VCF → phải tìm ra, không có → return None (16 tests passed)
  - _Impact: Detect 100% winning positions có VCF_

- [x] **8.1.5 VCT Search (Victory by Continuous Three)**
  - [x] Extend VCF với THREE threats
  - [x] Implement defensive VCT (tìm cách chặn VCT của đối thủ)
  - [x] Property test: VCT detection accuracy (21 tests passed)
  - _Impact: Detect complex winning sequences_

### 8.2 Advanced Threat Detection
- [x] **8.2.1 Broken Pattern Detection**



  - [x] Detect "X_XX", "XX_X" (broken three với 1 gap)





  - [x] Detect "X_XXX", "XX_XX", "XXX_X" (broken four)
  - [x] Detect "X__XX", "XX__X" (jump patterns)
  - [x] Add scoring: broken_four = 800, broken_three = 80
  - [x] Property test: all broken patterns detected correctly


  - _Impact: +20% threat detection accuracy_

- [x] **8.2.2 Double Threat Detection**
  - [x] Detect DOUBLE_FOUR (2 đường FOUR cùng lúc → thắng chắc)
  - [x] Detect FOUR_THREE (FOUR + THREE → thắng chắc)
  - [x] Detect DOUBLE_THREE (2 đường OPEN_THREE → rất nguy hiểm)
  - [x] Property test: double threats → severity = critical






  - _Impact: Detect 100% winning combinations_
-

- [x] **8.2.3 Threat Space Analysis**




  - [x] Calculate "threat space" - số ô có thể tạo threat





















































  - [x] Evaluate "threat potential" - tiềm năng phát triển threats




  - [x] Property test: more threat space → higher score




  - _Impact: Better mid-game evaluation_

### 8.3 Advanced Position Evaluation



- [x] **8.3.1 Multi-Factor Evaluation** ✅


  - [x] Create `ai/analysis/advanced_evaluator.py`
  - [x] Implement shape_score(): đánh giá hình dạng quân cờ
  - [x] Implement connectivity_score(): quân liên kết tốt hơn rải rác
  - [x] Implement territory_score(): kiểm soát vùng
  - [x] Implement tempo_score(): ai đang chủ động tấn công
  - [x] Property test: winning position → high score, losing → low score (15 tests passed)
  - _Impact: +40% evaluation accuracy_

- [x] **8.3.2 Pattern-Based Evaluation** ✅


  - [x] Create pattern database với 50+ common patterns (55 patterns implemented)
  - [x] Score patterns: good patterns +, bad patterns -
  - [x] Recognize "shape" patterns (good/bad formations)
  - [x] Property test: known good patterns → positive score (18 tests passed)
  - _Impact: Recognize strategic patterns_

### 8.4 Opening Book

- [x] **8.4.1 Opening Database** ✅




  - [x] Create `ai/analysis/opening_book.py`





  - [x] Add 26 standard Renju openings với evaluations
  - [x] Add common Gomoku openings (direct, indirect)
  - [x] Store: moves, name, evaluation, common mistakes

  - [x] Property test: 22 tests passed (opening identification, analysis, suggestions)
  - _Impact: Recognize và comment về openings_


- [x] **8.4.2 Opening Recognition** ✅


  - [x] Implement `identify_opening(moves)` - nhận diện opening



  - [x] Implement `get_opening_analysis(moves)` - phân tích opening
  - [x] Implement `suggest_opening_move(moves)` - gợi ý theo lý thuyết

  - [x] Property test: known openings → correctly identified (22 tests passed)
  - _Impact: Expert-level opening analysis_


### 8.5 Endgame Analysis

-

- [x] **8.5.1 Endgame Detection**



  - [x] Create `ai/analysis/endgame_analyzer.py`




  - [x] Detect endgame conditions: VCF exists, few empty cells, many high threats
  - [x] Property test: endgame positions correctly identified (19 tests passed)

  - _Impact: Switch to exact solving in endgame_




- [x] **8.5.2 Endgame Solving**

















  - [x] Implement exact endgame solver với VCF/VCT










  - [x] Find winning sequence nếu có





















  - [x] Find drawing sequence nếu không thắng được



























  - [ ] Property test: solvable endgames → correct solution
  - _Impact: Perfect endgame analysis_
























- [x] **8.5.3 Missed Win Detection** ✅

  - [x] Analyze mỗi nước: "có bỏ lỡ thắng không?"

  - [x] Nếu có VCF trước nước đi nhưng không chơi → "Bỏ Lỡ Thắng"
  - [x] Show winning sequence bị bỏ lỡ
  - [x] Property test: missed wins correctly detected (18 tests passed)
  - _Impact: Critical mistake detection_

### 8.6 Quality Analysis Enhancement

- [ ] **8.6.1 Detailed Mistake Categorization**

  - [ ] Create `ai/analysis/mistake_analyzer.py`
  - [ ] Categorize: Tactical (bỏ lỡ threat), Positional (vị trí kém), Strategic (sai hướng), Tempo (chậm 1 nhịp)
  - [ ] Generate specific explanation cho từng loại
  - [ ] Property test: mistakes correctly categorized
  - _Impact: Educational value tăng mạnh_




- [ ] **8.6.2 Lesson Generation**

  - [ ] Từ mỗi mistake → tạo mini lesson
  - [ ] Include: why wrong, what to do, similar patterns to avoid
  - [ ] Generate practice positions từ mistakes
  - [ ] Property test: lessons are relevant to mistakes
  - _Impact: Learning từ mistakes_


- [ ] **8.6.3 Alternative Lines Analysis**

  - [ ] Cho mỗi mistake, show 3 best alternatives
  - [ ] Show continuation sau mỗi alternative (3-5 moves)
  - [ ] Compare outcomes: original vs alternatives
  - [ ] Property test: alternatives are better than actual move
  - _Impact: "What if" analysis depth_

### 8.7 Performance Optimization

- [ ] **8.7.1 Cython/Numba Acceleration**

  - [ ] Convert hot paths (threat detection, evaluation) sang Cython hoặc Numba
  - [ ] Target: 5-10x speedup cho core functions
  - [ ] Property test: same results, faster execution
  - _Impact: Deeper search trong cùng thời gian_


- [ ] **8.7.2 Parallel Search**

  - [ ] Implement parallel alpha-beta với multiple threads
  - [ ] Use Python multiprocessing cho CPU-bound tasks
  - [ ] Property test: parallel results = sequential results
  - _Impact: 2-4x speedup trên multi-core_


- [ ] **8.7.3 Redis Caching**

  - [ ] Move sessions và analysis cache sang Redis
  - [ ] Implement cache warming cho common positions
  - [ ] Add cache statistics và monitoring
  - _Impact: Persistent cache, faster repeated analysis_

### 8.8 Integration & Testing
- [ ] **8.8.1 Benchmark Suite**


  - [ ] Create `ai/tests/benchmark_positions.py` với 100+ test positions
  - [ ] Include: opening, midgame, endgame, tactical puzzles
  - [ ] Measure: accuracy, speed, depth reached
  - [ ] Target: 90%+ accuracy trên benchmark
  - _Impact: Measurable quality_


- [ ] **8.8.2 Regression Testing**

  - [ ] Ensure new features không break existing functionality
  - [ ] Compare analysis results trước/sau upgrade
  - [ ] Property test: all existing tests still pass
  - _Impact: Stability_



- [x] **8.8.3 Integration với Existing System** ✅
  - [x] Update `BasicAnalyzer` để dùng new search engine
  - [x] Update `ProAnalyzer` để dùng advanced evaluation
  - [x] Update API responses với new analysis data
  - [x] Update frontend để hiển thị new insights
  - _Impact: Full system upgrade_

### 8.9 Checkpoint - World-Class AI

- [ ] Run full benchmark suite: target 90%+ accuracy

- [ ] Performance test: analysis < 3s với depth 8+
- [ ] VCF/VCT detection: 100% accuracy trên test set
- [ ] Opening recognition: 100% accuracy trên known openings
- [ ] User testing: feedback từ experienced players
- _Target: 10/10 analysis quality_

