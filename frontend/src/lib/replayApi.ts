/**
 * Replay AI Mode API Client
 * 
 * Provides functions for interacting with the AI replay backend:
 * - createReplaySession: Create a replay session for what-if analysis
 * - navigateToMove: Navigate to a specific move in replay
 * - playFromHere: Play an alternative move and get AI response
 * - analyzeDivergence: Get comparison between original and alternative lines
 * - undoMove: Undo the last move pair in what-if mode
 * - cleanupSession: Clean up server resources
 * 
 * Requirements: 2.1, 3.3, 5.1, 5.2, 5.3, 6.1, 7.2
 */

// Local types to avoid import issues with Vite cache
export interface ApiError {
  status: number
  error: string
  message?: string
  details?: string
  reset_at?: string
}

export function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'status' in error && 'error' in error
}

export type SubscriptionTier = 'free' | 'trial' | 'pro' | 'pro_plus'

export interface Move {
  x: number
  y: number
  p: 'X' | 'O'
  player?: 'X' | 'O'
  moveNumber?: number
}

// ============================================
// Types
// ============================================

export type Difficulty = 'easy' | 'medium' | 'hard'

export type Board = (string | null)[][]

export interface ReplaySessionResponse {
  session_id: string
  total_moves: number
}

export interface NavigateResponse {
  board_state: Board
  current_move: number
  player_turn: 'X' | 'O' | null
}

export interface PlayResponse {
  board_state: Board
  ai_move: { x: number; y: number; player: 'X' | 'O' } | null
  original_outcome: number
  current_win_prob: number
  comparison: string
}

export interface DivergenceAnalysis {
  divergence_point: number
  original_outcome: number
  current_outcome: number
  outcome_difference: number
  analysis: string
}

export interface UndoResponse {
  board_state: Board
  current_move_index: number
  win_prob: number
  can_undo: boolean
  mode: 'replay' | 'what_if'
}

// ============================================
// Configuration
// ============================================

const DEFAULT_TIMEOUT = 20000 // 20 seconds
const AI_RESPONSE_TIMEOUT = 3000 // 3 seconds for AI response (Requirement 2.1)
const AI_API_BASE = (import.meta.env as any).VITE_AI_ANALYSIS_URL || 'http://localhost:8002'

// ============================================
// Helper Functions
// ============================================

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeoutMs: number = DEFAULT_TIMEOUT): { controller: AbortController; timeoutId: ReturnType<typeof setTimeout> } {
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
async function fetchApi<T>(
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
 * Create a new replay session
 * 
 * Requirements: 5.1
 * - Creates replay session on server
 * - Returns unique session_id
 */
export async function createReplaySession(params: {
  matchId: string
  moves: Move[]
  userId: string
  tier?: string
}): Promise<ReplaySessionResponse> {
  const { matchId, moves, userId, tier = 'trial' } = params
  
  if (!matchId) throw { status: 400, error: 'Invalid request', details: 'matchId is required' } as ApiError
  if (!userId) throw { status: 400, error: 'Invalid request', details: 'userId is required' } as ApiError
  
  return fetchApi<ReplaySessionResponse>(
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
 * Requirements: 4.2, 4.3
 * - Returns board state at the specified move
 * - Should complete within 200ms
 */
export async function navigateToMove(params: {
  sessionId: string
  moveIndex: number
}): Promise<NavigateResponse> {
  const { sessionId, moveIndex } = params
  
  if (!sessionId) throw { status: 400, error: 'Invalid request', details: 'sessionId is required' } as ApiError
  
  return fetchApi<NavigateResponse>(
    `${AI_API_BASE}/replay/navigate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        move_index: moveIndex
      })
    },
    5000 // 5s timeout (should be much faster)
  )
}

/**
 * Play an alternative move and get AI response
 * 
 * Requirements: 2.1, 2.3, 2.4, 7.2
 * - Sends user move to server
 * - Gets AI response with specified difficulty
 * - Returns updated board state and comparison
 */
export async function playFromHere(params: {
  sessionId: string
  move: Move
  difficulty?: Difficulty
}): Promise<PlayResponse> {
  const { sessionId, move, difficulty = 'hard' } = params
  
  if (!sessionId) throw { status: 400, error: 'Invalid request', details: 'sessionId is required' } as ApiError
  
  return fetchApi<PlayResponse>(
    `${AI_API_BASE}/replay/play`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        move: { x: move.x, y: move.y, p: move.p },
        difficulty
      })
    },
    AI_RESPONSE_TIMEOUT // 3 seconds for AI response
  )
}

/**
 * Analyze divergence between original and alternative lines
 * 
 * Requirements: 3.3
 * - Returns detailed comparison
 * - Includes Vietnamese explanation
 */
export async function analyzeDivergence(params: {
  sessionId: string
}): Promise<DivergenceAnalysis> {
  const { sessionId } = params
  
  if (!sessionId) throw { status: 400, error: 'Invalid request', details: 'sessionId is required' } as ApiError
  
  return fetchApi<DivergenceAnalysis>(
    `${AI_API_BASE}/replay/analyze`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId
      })
    }
  )
}

/**
 * Undo the last move pair in what-if mode
 * 
 * Requirements: 6.1, 6.2, 6.3
 * - Removes last user + AI move pair
 * - Updates board state and win probability
 */
export async function undoMove(params: {
  sessionId: string
}): Promise<UndoResponse> {
  const { sessionId } = params
  
  if (!sessionId) throw { status: 400, error: 'Invalid request', details: 'sessionId is required' } as ApiError
  
  return fetchApi<UndoResponse>(
    `${AI_API_BASE}/replay/undo`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId
      })
    }
  )
}

/**
 * Clean up a replay session
 * 
 * Requirements: 5.3
 * - Removes session from server
 * - Frees server resources
 */
export async function cleanupSession(sessionId: string): Promise<void> {
  if (!sessionId) return
  
  try {
    await fetchApi<{ status: string }>(
      `${AI_API_BASE}/replay/${sessionId}`,
      { method: 'DELETE' },
      5000
    )
  } catch {
    // Ignore errors on cleanup
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get color for comparison based on outcome difference
 * 
 * Requirements: 3.4
 * - Green for improvement > 5%
 * - Red for worse by > 5%
 * - Yellow for similar
 */
export function getComparisonColor(outcomeDiff: number): 'green' | 'red' | 'yellow' {
  if (outcomeDiff > 0.05) return 'green'
  if (outcomeDiff < -0.05) return 'red'
  return 'yellow'
}

/**
 * Generate explanation for significant win probability change
 * 
 * Requirements: 3.2
 * - Returns Vietnamese explanation for changes > 10%
 */
export function generateExplanation(originalProb: number, currentProb: number): string | null {
  const diff = currentProb - originalProb
  const absDiff = Math.abs(diff)
  
  if (absDiff <= 0.1) return null // Not significant
  
  const percentChange = Math.round(absDiff * 100)
  
  if (diff > 0.2) {
    return `Nhánh mới tốt hơn nhiều! Tỷ lệ thắng tăng ${percentChange}%.`
  } else if (diff > 0.1) {
    return `Nhánh mới tốt hơn. Tỷ lệ thắng tăng ${percentChange}%.`
  } else if (diff < -0.2) {
    return `Nhánh mới tệ hơn nhiều. Tỷ lệ thắng giảm ${percentChange}%.`
  } else if (diff < -0.1) {
    return `Nhánh mới tệ hơn. Tỷ lệ thắng giảm ${percentChange}%.`
  }
  
  return null
}

/**
 * Check if a cell is valid for placing a stone
 * 
 * Requirements: 1.3
 * - Cell must be empty
 * - Cell must be within bounds
 */
export function isValidCell(board: Board, x: number, y: number): boolean {
  if (x < 0 || x >= 15 || y < 0 || y >= 15) return false
  return board[x]?.[y] === null
}

/**
 * Get all valid cells on the board
 * 
 * Requirements: 1.3
 * - Returns array of {x, y} for all empty cells
 */
export function getValidCells(board: Board): Array<{ x: number; y: number }> {
  const validCells: Array<{ x: number; y: number }> = []
  
  for (let x = 0; x < 15; x++) {
    for (let y = 0; y < 15; y++) {
      if (board[x]?.[y] === null) {
        validCells.push({ x, y })
      }
    }
  }
  
  return validCells
}

/**
 * Session storage key for persisting session ID
 */
export function getSessionStorageKey(matchId: string): string {
  return `replay_session_${matchId}`
}

/**
 * Save session ID to localStorage
 * 
 * Requirements: 5.2
 */
export function saveSessionToStorage(matchId: string, sessionId: string): void {
  try {
    localStorage.setItem(getSessionStorageKey(matchId), sessionId)
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get session ID from localStorage
 * 
 * Requirements: 5.2
 */
export function getSessionFromStorage(matchId: string): string | null {
  try {
    return localStorage.getItem(getSessionStorageKey(matchId))
  } catch {
    return null
  }
}

/**
 * Remove session ID from localStorage
 * 
 * Requirements: 5.3
 */
export function removeSessionFromStorage(matchId: string): void {
  try {
    localStorage.removeItem(getSessionStorageKey(matchId))
  } catch {
    // Ignore storage errors
  }
}
