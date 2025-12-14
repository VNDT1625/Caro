/**
 * AI Match Analysis API Client
 * 
 * Provides functions for interacting with the AI analysis backend:
 * - analyzeMatch: Analyze a match using basic or pro analysis
 * - askQuestion: Ask AI questions about a match
 * - createReplaySession: Create a replay session for what-if analysis
 * - navigateReplay: Navigate to a specific move in replay
 * - playReplayMove: Play an alternative move in replay
 * - getUsage: Get usage information for a user
 * 
 * Requirements: 9.1-9.5, 10.1-10.3, 11.4, 16.5
 */

// ============================================
// Types
// ============================================

export type AnalysisTier = 'basic' | 'pro'
export type SubscriptionTier = 'free' | 'trial' | 'pro' | 'pro_plus'
export type MoveClassification = 'excellent' | 'good' | 'okay' | 'weak' | 'blunder'
export type MistakeSeverity = 'minor' | 'major' | 'critical'

export interface Move {
  x: number
  y: number
  p: 'X' | 'O'
}

export interface TimelineEntry {
  move: number
  player: string
  player_name?: string
  is_user_move?: boolean | null
  position: { x: number; y: number }
  score: number
  win_prob: number
  category: MoveClassification
  note: string
}

export interface Mistake {
  move: number
  player?: string
  player_name?: string
  is_user_mistake?: boolean | null
  severity: MistakeSeverity
  desc: string
  best_alternative: { x: number; y: number } | null
}

export interface Pattern {
  label: string
  explanation: string
  moves: number[]
  severity: string
}

export interface BestMove {
  x: number
  y: number
  score: number
  reason: string
}

export interface PlayerStats {
  total_moves?: number
  excellent_moves?: number
  good_moves?: number
  mistakes?: number
  critical_mistakes?: number
  avg_score?: number
  accuracy?: number
}

export interface Summary {
  total_moves: number
  winner: string | null
  winner_name?: string | null
  user_won?: boolean | null
  x_stats: PlayerStats
  o_stats: PlayerStats
  key_insights: string[]
}

export interface AIInsights {
  natural_language_summary: string
  mistake_explanations: Record<number, string>
  improvement_tips: string[]
  advanced_patterns: string[]
}

export interface AnalysisResult {
  tier: string
  best_move: BestMove | null
  timeline: TimelineEntry[]
  mistakes: Mistake[]
  patterns: Pattern[]
  summary: Summary
  ai_insights: AIInsights | null
  duration_ms: number
  // User perspective fields
  user_side?: 'X' | 'O' | null
  player_names?: { X: string; O: string }
  your_stats?: PlayerStats
  opponent_stats?: PlayerStats
  opponent_name?: string
  personalized_insights?: string[]
}

export interface AskResponse {
  answer: string
  actions: Array<{ type: string; label: string; data: any }>
}

export interface ReplayCreateResponse {
  session_id: string
  total_moves: number
}

export interface ReplayNavigateResponse {
  board_state: Record<string, 'X' | 'O'>
  current_move: number
  player_turn: 'X' | 'O'
}

export interface ReplayPlayResponse {
  board_state: Record<string, 'X' | 'O'>
  ai_move: Move | null
  original_outcome: string
  current_win_prob: number
  comparison: {
    original_win_prob: number
    current_win_prob: number
    analysis: string
  }
}

export interface UsageInfo {
  tier: string
  daily_usage: Record<string, number>
  monthly_usage: Record<string, number>
  daily_remaining: Record<string, number>
  monthly_remaining: Record<string, number>
}

export interface ApiError {
  status: number
  error: string
  details?: string
  reset_at?: string
}

// ============================================
// Mock Data (for development/testing)
// ============================================

function generateMockAnalysisResult(tier: AnalysisTier): AnalysisResult {
  const timeline: TimelineEntry[] = [
    { move: 1, player: 'X', position: { x: 7, y: 7 }, score: 0, win_prob: 0.5, category: 'good', note: 'Nước mở tốt' },
    { move: 2, player: 'O', position: { x: 8, y: 7 }, score: 0, win_prob: 0.5, category: 'good', note: 'Phòng thủ tốt' },
    { move: 3, player: 'X', position: { x: 6, y: 7 }, score: 5, win_prob: 0.55, category: 'good', note: 'Tấn công' },
    { move: 4, player: 'O', position: { x: 9, y: 7 }, score: 5, win_prob: 0.5, category: 'okay', note: 'Phòng thủ bình thường' },
  ]

  return {
    tier,
    best_move: { x: 7, y: 6, score: 8, reason: 'Nước này tạo mối đe dọa kép' },
    timeline,
    mistakes: [
      { move: 4, severity: 'minor', desc: 'Nước này không tối ưu', best_alternative: { x: 8, y: 8 } }
    ],
    patterns: [
      { label: 'Mở trung tâm', explanation: 'Cả hai bên tập trung vào trung tâm bàn cờ', moves: [1, 2, 3, 4], severity: 'good' }
    ],
    summary: {
      total_moves: 4,
      winner: null,
      x_stats: { total_moves: 2, excellent_moves: 1, good_moves: 1, mistakes: 0, critical_mistakes: 0, avg_score: 50, accuracy: 80 },
      o_stats: { total_moves: 2, excellent_moves: 0, good_moves: 1, mistakes: 1, critical_mistakes: 0, avg_score: 40, accuracy: 60 },
      key_insights: ['Trận đấu cân bằng', 'Cả hai bên chơi tốt']
    },
    ai_insights: {
      natural_language_summary: 'Đây là một trận đấu cân bằng với cả hai bên chơi tốt.',
      mistake_explanations: { 4: 'Nước này không tối ưu vì không tạo mối đe dọa' },
      improvement_tips: ['Tập trung vào trung tâm', 'Tìm cơ hội tấn công'],
      advanced_patterns: ['Mở trung tâm', 'Phòng thủ tích cực']
    },
    duration_ms: 1500
  }
}

// ============================================
// Configuration
// ============================================

const DEFAULT_TIMEOUT = 20000 // 20 seconds as per requirement 16.5
const AI_API_BASE = (import.meta.env as any).VITE_AI_ANALYSIS_URL || 'http://localhost:8002'
const USE_MOCK_DATA = (import.meta.env as any).VITE_USE_MOCK_ANALYSIS === 'true'

// ============================================
// Helper Functions
// ============================================

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeoutMs: number = DEFAULT_TIMEOUT): { controller: AbortController; timeoutId: NodeJS.Timeout } {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  return { controller, timeoutId }
}

/**
 * Handle API response and errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: any = {}
    try {
      errorData = await response.json()
    } catch {
      errorData = { error: 'Unknown error', details: response.statusText }
    }
    
    const apiError: ApiError = {
      status: response.status,
      error: errorData.error || errorData.detail?.error || 'Request failed',
      details: errorData.details || errorData.detail?.details,
      reset_at: errorData.reset_at || errorData.detail?.reset_at
    }
    
    throw apiError
  }
  
  return response.json()
}

/**
 * Make a fetch request with timeout and error handling
 */
export async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<T> {
  const { controller, timeoutId } = createTimeoutController(timeoutMs)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return handleResponse<T>(response)
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError: ApiError = {
        status: 504,
        error: 'Request timeout',
        details: `Request timed out after ${timeoutMs}ms`
      }
      throw timeoutError
    }
    
    // Re-throw ApiError as-is
    if ((error as ApiError).status) {
      throw error
    }
    
    // Wrap other errors
    const networkError: ApiError = {
      status: 0,
      error: 'Network error',
      details: error instanceof Error ? error.message : 'Failed to connect to server'
    }
    throw networkError
  }
}

// ============================================
// API Functions
// ============================================

/**
 * Analyze a match using basic or pro analysis
 * 
 * Requirements: 9.1
 * - Validates request
 * - Checks tier permissions
 * - Returns analysis results
 */
export async function analyzeMatch(params: {
  matchId: string
  moves: Move[]
  tier: AnalysisTier
  userId: string
  subscriptionTier?: SubscriptionTier
  difficulty?: string
  userSide?: 'X' | 'O'
  playerXName?: string
  playerOName?: string
  language?: string
}): Promise<AnalysisResult> {
  const { 
    matchId, moves, tier, userId, 
    subscriptionTier = 'trial', difficulty,
    userSide, playerXName, playerOName, language
  } = params
  
  if (!matchId) throw { status: 400, error: 'Invalid request', details: 'matchId is required' } as ApiError
  if (!userId) throw { status: 400, error: 'Invalid request', details: 'userId is required' } as ApiError
  
  // Use mock data if enabled
  if (USE_MOCK_DATA) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(generateMockAnalysisResult(tier))
      }, 1000)
    })
  }
  
  return fetchWithTimeout<AnalysisResult>(
    `${AI_API_BASE}/analyze`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match_id: matchId,
        moves: moves.map(m => ({ x: m.x, y: m.y, p: m.p })),
        tier,
        user_id: userId,
        subscription_tier: subscriptionTier,
        difficulty,
        user_side: userSide,
        player_x_name: playerXName,
        player_o_name: playerOName,
        language,
        force_refresh: true  // Always force refresh to get latest analysis
      })
    }
  )
}

/**
 * Ask AI a question about a match
 * 
 * Requirements: 9.2
 * - Validates Pro subscription
 * - Checks rate limits
 * - Returns AI answer
 */
export async function askQuestion(params: {
  matchId: string
  question: string
  userId: string
  tier?: SubscriptionTier
}): Promise<AskResponse> {
  const { matchId, question, userId, tier = 'trial' } = params
  
  if (!matchId) throw { status: 400, error: 'Invalid request', details: 'matchId is required' } as ApiError
  if (!question?.trim()) throw { status: 400, error: 'Invalid request', details: 'question is required' } as ApiError
  if (!userId) throw { status: 400, error: 'Invalid request', details: 'userId is required' } as ApiError
  
  return fetchWithTimeout<AskResponse>(
    `${AI_API_BASE}/ask`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match_id: matchId,
        question: question.trim(),
        user_id: userId,
        tier
      })
    }
  )
}

/**
 * Create a replay session for what-if analysis
 * 
 * Requirements: 9.3
 * - Creates replay session
 * - Returns session_id
 */
export async function createReplaySession(params: {
  matchId: string
  moves: Move[]
  userId: string
  tier?: SubscriptionTier
}): Promise<ReplayCreateResponse> {
  const { matchId, moves, userId, tier = 'trial' } = params
  
  if (!matchId) throw { status: 400, error: 'Invalid request', details: 'matchId is required' } as ApiError
  if (!userId) throw { status: 400, error: 'Invalid request', details: 'userId is required' } as ApiError
  
  return fetchWithTimeout<ReplayCreateResponse>(
    `${AI_API_BASE}/replay/create`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match_id: matchId,
        moves: moves.map(m => ({ x: m.x, y: m.y, p: m.p })),
        user_id: userId,
        tier
      })
    }
  )
}

/**
 * Navigate to a specific move in the replay
 * 
 * Requirements: 9.4
 * - Returns board state at the specified move
 */
export async function navigateReplay(params: {
  sessionId: string
  moveIndex: number
}): Promise<ReplayNavigateResponse> {
  const { sessionId, moveIndex } = params
  
  if (!sessionId) throw { status: 400, error: 'Invalid request', details: 'sessionId is required' } as ApiError
  
  return fetchWithTimeout<ReplayNavigateResponse>(
    `${AI_API_BASE}/replay/navigate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        move_index: moveIndex
      })
    },
    5000 // 5s timeout for navigation (should be fast per requirement 5.2)
  )
}

/**
 * Play an alternative move in the replay
 * 
 * Requirements: 9.5
 * - Processes user move
 * - Gets AI response
 * - Returns updated state
 */
export async function playReplayMove(params: {
  sessionId: string
  move: Move
}): Promise<ReplayPlayResponse> {
  const { sessionId, move } = params
  
  if (!sessionId) throw { status: 400, error: 'Invalid request', details: 'sessionId is required' } as ApiError
  
  return fetchWithTimeout<ReplayPlayResponse>(
    `${AI_API_BASE}/replay/play`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        move: { x: move.x, y: move.y, p: move.p }
      })
    }
  )
}

/**
 * Delete a replay session
 */
export async function deleteReplaySession(sessionId: string): Promise<void> {
  if (!sessionId) return
  
  try {
    await fetchWithTimeout<{ status: string }>(
      `${AI_API_BASE}/replay/${sessionId}`,
      { method: 'DELETE' },
      5000
    )
  } catch {
    // Ignore errors on cleanup
  }
}

/**
 * Get usage information for a user
 * 
 * Requirements: 9.6 (implied)
 * - Returns daily and monthly usage
 * - Returns remaining allowances
 */
export async function getUsage(params: {
  userId: string
  tier?: SubscriptionTier
}): Promise<UsageInfo> {
  const { userId, tier = 'free' } = params
  
  if (!userId) throw { status: 400, error: 'Invalid request', details: 'userId is required' } as ApiError
  
  const url = new URL(`${AI_API_BASE}/usage`)
  url.searchParams.set('user_id', userId)
  url.searchParams.set('tier', tier)
  
  return fetchWithTimeout<UsageInfo>(url.toString(), { method: 'GET' }, 5000)
}

// ============================================
// Error Handling Utilities
// ============================================

/**
 * Check if error is an API error
 */
export function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'status' in error && 'error' in error
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: unknown): error is ApiError {
  return isApiError(error) && error.status === 429
}

/**
 * Check if error is an authorization error
 */
export function isAuthError(error: unknown): error is ApiError {
  return isApiError(error) && error.status === 403
}

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: unknown): error is ApiError {
  return isApiError(error) && error.status === 504
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 429) {
      return 'Bạn đã đạt giới hạn sử dụng hôm nay. Vui lòng thử lại sau.'
    }
    if (error.status === 403) {
      return 'Tính năng này yêu cầu gói Pro. Vui lòng nâng cấp để tiếp tục.'
    }
    if (error.status === 504) {
      return 'Yêu cầu quá thời gian. Vui lòng thử lại.'
    }
    if (error.status === 0) {
      return 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.'
    }
    return error.details || error.error || 'Đã xảy ra lỗi. Vui lòng thử lại.'
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  return 'Đã xảy ra lỗi không xác định.'
}
