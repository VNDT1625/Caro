/**
 * useReplayAI Hook
 * 
 * Manages state and logic for what-if mode in replay analysis.
 * Allows users to play alternative moves and see AI responses.
 * 
 * Requirements: 1.1, 1.4, 2.1, 2.4, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 7.2
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  createReplaySession,
  navigateToMove,
  playFromHere,
  analyzeDivergence,
  undoMove,
  cleanupSession,
  saveSessionToStorage,
  getSessionFromStorage,
  removeSessionFromStorage,
  getComparisonColor,
  generateExplanation,
  type Board,
  type Difficulty,
  type DivergenceAnalysis,
  type Move
} from '../lib/replayApi'

// ============================================
// Types
// ============================================

export type ReplayMode = 'replay' | 'what_if'
export type Branch = 'original' | 'alternative'

export interface UseReplayAIState {
  // Mode state
  mode: ReplayMode
  sessionId: string | null
  divergencePoint: number | null
  
  // Board state
  currentBoard: Board
  currentMoveIndex: number
  playerTurn: 'X' | 'O' | null
  
  // Alternative moves tracking
  alternativeMoves: Array<{ x: number; y: number; player: 'X' | 'O' }>
  
  // Win probability
  originalWinProb: number
  currentWinProb: number
  
  // UI state
  aiThinking: boolean
  loading: boolean
  error: string | null
  
  // Settings
  difficulty: Difficulty
  currentBranch: Branch
  canUndo: boolean
}

export interface UseReplayAIActions {
  // Mode transitions
  enterWhatIfMode: (moveIndex?: number) => Promise<void>
  exitWhatIfMode: () => Promise<void>
  
  // Gameplay
  playMove: (x: number, y: number) => Promise<void>
  undoLastMove: () => Promise<void>
  
  // Navigation
  switchBranch: (branch: Branch) => Promise<void>
  navigateTo: (moveIndex: number) => Promise<void>
  
  // Analysis
  getDivergenceAnalysis: () => Promise<DivergenceAnalysis | null>
  
  // Settings
  setDifficulty: (d: Difficulty) => void
  
  // Cleanup
  cleanup: () => Promise<void>
  clearError: () => void
}

export interface UseReplayAIReturn extends UseReplayAIState, UseReplayAIActions {
  // Computed values
  comparisonColor: 'green' | 'red' | 'yellow'
  explanation: string | null
  hasDivergence: boolean
}

// ============================================
// Initial State
// ============================================

const initialBoard: Board = Array(15).fill(null).map(() => Array(15).fill(null))

const initialState: UseReplayAIState = {
  mode: 'replay',
  sessionId: null,
  divergencePoint: null,
  currentBoard: initialBoard,
  currentMoveIndex: -1,
  playerTurn: 'X',
  alternativeMoves: [],
  originalWinProb: 0.5,
  currentWinProb: 0.5,
  aiThinking: false,
  loading: false,
  error: null,
  difficulty: 'medium',
  currentBranch: 'original',
  canUndo: false
}

// ============================================
// Hook Implementation
// ============================================

export function useReplayAI(
  matchId: string | null,
  originalMoves: Move[],
  userId: string | null
): UseReplayAIReturn {
  // State
  const [state, setState] = useState<UseReplayAIState>(initialState)
  
  // Refs for cleanup
  const sessionIdRef = useRef<string | null>(null)
  const matchIdRef = useRef<string | null>(null)
  
  // Update refs when state changes
  useEffect(() => {
    sessionIdRef.current = state.sessionId
    matchIdRef.current = matchId
  }, [state.sessionId, matchId])
  
  // ============================================
  // ============================================
  // Mode Transitions (Requirements 1.1, 1.4)
  // ============================================
  
  const enterWhatIfMode = useCallback(async (moveIndex?: number) => {
    if (!matchId || !userId || originalMoves.length === 0) {
      setState(s => ({ ...s, error: 'Không thể vào chế độ thử nghiệm' }))
      return
    }

    const targetMoveIndex = Math.max(
      -1,
      Math.min(
        typeof moveIndex === 'number' ? moveIndex : state.currentMoveIndex,
        originalMoves.length - 1
      )
    )
    
    setState(s => ({ ...s, loading: true, error: null }))
    
    try {
      // Check for existing session
      const existingSessionId = getSessionFromStorage(matchId)
      
      if (existingSessionId) {
        // Try to use existing session
        try {
          const navResult = await navigateToMove({
            sessionId: existingSessionId,
            moveIndex: targetMoveIndex
          })
          
          setState(s => ({
            ...s,
            mode: 'what_if',
            sessionId: existingSessionId,
            currentBoard: navResult.board_state,
            playerTurn: navResult.player_turn,
            currentMoveIndex: navResult.current_move,
            loading: false
          }))
          return
        } catch {
          // Session expired, create new one
          removeSessionFromStorage(matchId)
        }
      }
      
      // Create new session
      const result = await createReplaySession({
        matchId,
        moves: originalMoves,
        userId
      })
      
      // Save session ID
      saveSessionToStorage(matchId, result.session_id)
      
      // Navigate to current position
      const navResult = await navigateToMove({
        sessionId: result.session_id,
        moveIndex: targetMoveIndex
      })
      
      setState(s => ({
        ...s,
        mode: 'what_if',
        sessionId: result.session_id,
        currentBoard: navResult.board_state,
        playerTurn: navResult.player_turn,
        currentMoveIndex: navResult.current_move,
        loading: false
      }))
      
    } catch (err: any) {
      setState(s => ({
        ...s,
        loading: false,
        error: err?.details || err?.error || 'Không thể tạo phiên thử nghiệm'
      }))
    }
  }, [matchId, userId, originalMoves, state.currentMoveIndex])
  
  const exitWhatIfMode = useCallback(async () => {
    if (!state.sessionId) {
      setState(s => ({ ...s, mode: 'replay' }))
      return
    }
    
    setState(s => ({ ...s, loading: true }))
    
    try {
      // Navigate back to divergence point or current position
      const targetIndex = state.divergencePoint !== null 
        ? state.divergencePoint - 1 
        : state.currentMoveIndex
      
      const navResult = await navigateToMove({
        sessionId: state.sessionId,
        moveIndex: targetIndex
      })
      
      setState(s => ({
        ...s,
        mode: 'replay',
        currentBoard: navResult.board_state,
        currentMoveIndex: navResult.current_move,
        playerTurn: navResult.player_turn,
        divergencePoint: null,
        alternativeMoves: [],
        currentWinProb: s.originalWinProb,
        currentBranch: 'original',
        canUndo: false,
        loading: false
      }))
      
    } catch (err: any) {
      setState(s => ({
        ...s,
        mode: 'replay',
        loading: false,
        error: err?.details || 'Lỗi khi thoát chế độ thử nghiệm'
      }))
    }
  }, [state.sessionId, state.divergencePoint, state.currentMoveIndex])
  
  // ============================================
  // Gameplay (Requirements 2.1, 2.4, 6.1)
  // ============================================
  
  const playMove = useCallback(async (x: number, y: number) => {
    if (!state.sessionId || state.mode !== 'what_if') {
      setState(s => ({ ...s, error: 'Không ở chế độ thử nghiệm' }))
      return
    }
    
    // Validate move
    if (state.currentBoard[x]?.[y] !== null) {
      setState(s => ({ ...s, error: 'Ô này đã có quân' }))
      return
    }
    
    if (!state.playerTurn) {
      setState(s => ({ ...s, error: 'Ván đấu đã kết thúc' }))
      return
    }
    
    setState(s => ({ ...s, aiThinking: true, error: null }))
    
    try {
      const result = await playFromHere({
        sessionId: state.sessionId,
        move: { x, y, p: state.playerTurn },
        difficulty: state.difficulty
      })
      
      // Track alternative moves
      const newAlternativeMoves = [
        ...state.alternativeMoves,
        { x, y, player: state.playerTurn }
      ]
      
      if (result.ai_move) {
        newAlternativeMoves.push({
          x: result.ai_move.x,
          y: result.ai_move.y,
          player: result.ai_move.player
        })
      }
      
      // Set divergence point on first move
      const newDivergencePoint = state.divergencePoint ?? state.currentMoveIndex + 1
      
      setState(s => ({
        ...s,
        currentBoard: result.board_state,
        currentMoveIndex: s.currentMoveIndex + (result.ai_move ? 2 : 1),
        playerTurn: result.ai_move ? state.playerTurn : (state.playerTurn === 'X' ? 'O' : 'X'),
        alternativeMoves: newAlternativeMoves,
        divergencePoint: newDivergencePoint,
        originalWinProb: result.original_outcome,
        currentWinProb: result.current_win_prob,
        currentBranch: 'alternative',
        canUndo: true,
        aiThinking: false
      }))
      
    } catch (err: any) {
      setState(s => ({
        ...s,
        aiThinking: false,
        error: err?.details || err?.error || 'Lỗi khi đi nước'
      }))
    }
  }, [state.sessionId, state.mode, state.currentBoard, state.playerTurn, state.difficulty, state.divergencePoint, state.currentMoveIndex, state.alternativeMoves])
  
  const undoLastMove = useCallback(async () => {
    if (!state.sessionId || !state.canUndo) {
      return
    }
    
    setState(s => ({ ...s, loading: true, error: null }))
    
    try {
      const result = await undoMove({ sessionId: state.sessionId })
      
      setState(s => ({
        ...s,
        currentBoard: result.board_state,
        currentMoveIndex: result.current_move_index,
        currentWinProb: result.win_prob,
        canUndo: result.can_undo,
        mode: result.mode,
        divergencePoint: result.mode === 'replay' ? null : s.divergencePoint,
        alternativeMoves: result.mode === 'replay' ? [] : s.alternativeMoves.slice(0, -2),
        loading: false
      }))
      
    } catch (err: any) {
      setState(s => ({
        ...s,
        loading: false,
        error: err?.details || 'Lỗi khi hoàn tác'
      }))
    }
  }, [state.sessionId, state.canUndo])
  
  // ============================================
  // Navigation (Requirements 4.2, 4.3)
  // ============================================
  
  const switchBranch = useCallback(async (branch: Branch) => {
    if (!state.sessionId || state.divergencePoint === null) {
      return
    }
    
    setState(s => ({ ...s, loading: true }))
    
    try {
      if (branch === 'original') {
        // Navigate to show original moves
        const navResult = await navigateToMove({
          sessionId: state.sessionId,
          moveIndex: state.divergencePoint - 1
        })
        
        setState(s => ({
          ...s,
          currentBoard: navResult.board_state,
          currentMoveIndex: navResult.current_move,
          playerTurn: navResult.player_turn,
          currentBranch: 'original',
          loading: false
        }))
      } else {
        // Show alternative moves (already in state)
        // Just update the branch indicator
        setState(s => ({
          ...s,
          currentBranch: 'alternative',
          loading: false
        }))
      }
      
    } catch (err: any) {
      setState(s => ({
        ...s,
        loading: false,
        error: err?.details || 'Lỗi khi chuyển nhánh'
      }))
    }
  }, [state.sessionId, state.divergencePoint])
  
  const navigateTo = useCallback(async (moveIndex: number) => {
    if (!state.sessionId) {
      // Just update local state if no session
      setState(s => ({ ...s, currentMoveIndex: moveIndex }))
      return
    }
    
    setState(s => ({ ...s, loading: true }))
    
    try {
      const result = await navigateToMove({
        sessionId: state.sessionId,
        moveIndex
      })
      
      setState(s => ({
        ...s,
        currentBoard: result.board_state,
        currentMoveIndex: result.current_move,
        playerTurn: result.player_turn,
        loading: false
      }))
      
    } catch (err: any) {
      setState(s => ({
        ...s,
        loading: false,
        error: err?.details || 'Lỗi khi di chuyển'
      }))
    }
  }, [state.sessionId])
  
  // ============================================
  // Analysis (Requirements 3.3)
  // ============================================
  
  const getDivergenceAnalysis = useCallback(async (): Promise<DivergenceAnalysis | null> => {
    if (!state.sessionId || state.mode !== 'what_if') {
      return null
    }
    
    try {
      const result = await analyzeDivergence({ sessionId: state.sessionId })
      return result
    } catch {
      return null
    }
  }, [state.sessionId, state.mode])
  
  // ============================================
  // Settings
  // ============================================
  
  const setDifficulty = useCallback((d: Difficulty) => {
    setState(s => ({ ...s, difficulty: d }))
  }, [])
  
  // ============================================
  // Cleanup (Requirements 5.3)
  // ============================================
  
  const cleanup = useCallback(async () => {
    if (sessionIdRef.current) {
      await cleanupSession(sessionIdRef.current)
    }
    if (matchIdRef.current) {
      removeSessionFromStorage(matchIdRef.current)
    }
    setState(initialState)
  }, [])
  
  const clearError = useCallback(() => {
    setState(s => ({ ...s, error: null }))
  }, [])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionIdRef.current && matchIdRef.current) {
        // Don't cleanup session on unmount - allow restoration
        // cleanupSession(sessionIdRef.current)
      }
    }
  }, [])
  
  // Reset when match changes
  useEffect(() => {
    if (matchId !== matchIdRef.current) {
      setState(s => ({
        ...initialState,
        difficulty: s.difficulty // Preserve difficulty setting
      }))
    }
  }, [matchId])
  
  // ============================================
  // Computed Values
  // ============================================
  
  const outcomeDiff = state.currentWinProb - state.originalWinProb
  const comparisonColor = getComparisonColor(outcomeDiff)
  const explanation = generateExplanation(state.originalWinProb, state.currentWinProb)
  const hasDivergence = state.divergencePoint !== null
  
  return {
    // State
    ...state,
    
    // Actions
    enterWhatIfMode,
    exitWhatIfMode,
    playMove,
    undoLastMove,
    switchBranch,
    navigateTo,
    getDivergenceAnalysis,
    setDifficulty,
    cleanup,
    clearError,
    
    // Computed
    comparisonColor,
    explanation,
    hasDivergence
  }
}

export default useReplayAI
