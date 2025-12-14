/**
 * useAnalysisState - Custom hook for AI Match Analysis state management
 * 
 * Provides state and actions for:
 * - Match selection and loading
 * - Analysis (basic/pro) with caching
 * - Move navigation and playback
 * - Replay mode (what-if analysis)
 * - AI Q&A chat
 * - Subscription tier and usage tracking
 * 
 * Requirements: 9.1-9.5, 10.1-10.3, 11.4, 16.5
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  analyzeMatch,
  askQuestion,
  createReplaySession,
  navigateReplay,
  playReplayMove,
  deleteReplaySession,
  getUsage,
  isApiError,
  isRateLimitError,
  isAuthError,
  getErrorMessage,
  type AnalysisTier,
  type SubscriptionTier,
  type Move,
  type TimelineEntry,
  type Mistake,
  type Pattern,
  type BestMove,
  type Summary,
  type AIInsights,
  type AnalysisResult,
  type UsageInfo
} from '../lib/analysisApi'

// ============================================
// Types
// ============================================

export interface MatchRow {
  id: string
  created_at?: string
  ended_at?: string
  match_type?: string
  result?: string
  total_moves?: number
  is_ai_match?: boolean
  ai_difficulty?: string | null
  player_x_user_id?: string | null
  player_o_user_id?: string | null
  player_x_username?: string | null
  player_o_username?: string | null
}

export type ActiveTab = 'summary' | 'mistakes' | 'patterns' | 'alternatives'

// Task 8.8.3: New types for advanced analysis data
export interface OpeningInfo {
  name: string
  description: string
}

export interface VCFInfo {
  move: { x: number; y: number }
  description: string
}

export interface MissedWin {
  move: number
  description: string
  best_alternative: { x: number; y: number }
}

export interface AdvancedAnalysis {
  opening_info?: OpeningInfo
  has_vcf?: boolean
  vcf_info?: VCFInfo
  missed_wins?: MissedWin[]
}

export interface AnalysisState {
  // Data
  matches: MatchRow[]
  selectedMatchId: string | null
  games: Move[][]
  selectedGameIndex: number
  sequence: Move[]
  timeline: TimelineEntry[]
  mistakes: Mistake[]
  patterns: Pattern[]
  bestMove: BestMove | null
  summary: Summary | null
  aiInsights: AIInsights | null
  
  // Task 8.8.3: Advanced analysis data
  openingInfo: OpeningInfo | null
  hasVCF: boolean
  vcfInfo: VCFInfo | null
  missedWins: MissedWin[]
  
  // User perspective data
  userSide: 'X' | 'O' | null
  playerNames: { X: string; O: string } | null
  yourStats: any | null
  opponentStats: any | null
  opponentName: string | null
  personalizedInsights: string[]
  
  // Tier & Subscription
  tier: AnalysisTier
  subscriptionTier: SubscriptionTier
  hasProAccess: boolean
  isTrialActive: boolean
  trialDaysLeft: number
  dailyUsage: { basic: number; pro: number; replay: number; ai_qa: number }
  dailyRemaining: { basic: number; pro: number; replay: number; ai_qa: number }
  
  // UI State
  currentMoveIndex: number
  isPlaying: boolean
  playSpeed: number
  activeTab: ActiveTab
  
  // Replay
  replayMode: boolean
  replaySessionId: string | null
  replayBoardState: Record<string, 'X' | 'O'>
  
  // Chat
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  
  // Loading
  loadingMatches: boolean
  analyzing: boolean
  loadingReplay: boolean
  loadingChat: boolean
  error: string | null
  
  // Cached analysis results
  cachedAnalysis: Record<string, AnalysisResult>
}

export interface AnalysisActions {
  // Match selection
  selectMatch: (id: string) => void
  loadMatches: () => Promise<void>
  
  // Analysis
  analyze: (tier?: AnalysisTier, options?: { language?: string; moves?: Move[]; matchId?: string; allowGuest?: boolean }) => Promise<void>
  setTier: (tier: AnalysisTier) => void
  
  // Navigation
  setCurrentMove: (index: number) => void
  nextMove: () => void
  prevMove: () => void
  firstMove: () => void
  lastMove: () => void
  play: () => void
  pause: () => void
  setPlaySpeed: (speed: number) => void
  
  // UI
  setActiveTab: (tab: ActiveTab) => void
  clearError: () => void
  
  // Replay
  enterReplayMode: (startMove?: number) => Promise<void>
  exitReplayMode: () => void
  playAlternativeMove: (move: Move) => Promise<void>
  
  // Chat
  askQuestion: (question: string) => Promise<string>
  clearChat: () => void
  
  // Usage
  refreshUsage: () => Promise<void>

  // Games
  setSelectedGameIndex: (idx: number) => void
}

export type UseAnalysisStateResult = AnalysisState & AnalysisActions

// ============================================
// Initial State
// ============================================

const PLAN_LIMITS: Record<SubscriptionTier, { basic: number; pro: number; ai_qa: number }> = {
  free: { basic: 1, pro: 0, ai_qa: 0 }, // analyze 1 lần/ngày, chat thông minh 0
  trial: { basic: 4, pro: 4, ai_qa: 10 }, // 4 analyze/ngày, 10 chat thông minh/ngày
  pro: { basic: 40, pro: 40, ai_qa: 120 }, // 40 analyze/ngày, 120 chat thông minh/ngày
  pro_plus: { basic: 100, pro: 100, ai_qa: 500 } // Pro+ unlimited-ish
}

const initialState: AnalysisState = {
  matches: [],
  selectedMatchId: null,
  games: [],
  selectedGameIndex: 0,
  sequence: [],
  timeline: [],
  mistakes: [],
  patterns: [],
  bestMove: null,
  summary: null,
  aiInsights: null,
  
  // Task 8.8.3: Advanced analysis data
  openingInfo: null,
  hasVCF: false,
  vcfInfo: null,
  missedWins: [],
  
  // User perspective data
  userSide: null,
  playerNames: null,
  yourStats: null,
  opponentStats: null,
  opponentName: null,
  personalizedInsights: [],
  
  tier: 'basic',
  subscriptionTier: 'free',
  hasProAccess: false,
  isTrialActive: false,
  trialDaysLeft: 0,
  dailyUsage: { basic: 0, pro: 0, replay: 0, ai_qa: 0 },
  dailyRemaining: { basic: 1, pro: 0, replay: 0, ai_qa: 0 },
  
  currentMoveIndex: -1,
  isPlaying: false,
  playSpeed: 1,
  activeTab: 'summary',
  
  replayMode: false,
  replaySessionId: null,
  replayBoardState: {},
  
  chatHistory: [],
  
  loadingMatches: false,
  analyzing: false,
  loadingReplay: false,
  loadingChat: false,
  error: null,
  
  cachedAnalysis: {}
}

// ============================================
// Hook Implementation
// ============================================

export function useAnalysisState(userId?: string | null, defaultLanguage: string = 'vi'): UseAnalysisStateResult {
  const [state, setState] = useState<AnalysisState>(initialState)
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const effectiveUserId = userId || null

  // ============================================
  // Helper Functions
  // ============================================

  const updateState = useCallback((updates: Partial<AnalysisState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  const getCacheKey = useCallback((matchId: string, tier: AnalysisTier, language?: string) => {
    const langKey = language || defaultLanguage || 'vi'
    return `${matchId}:${tier}:${langKey}`
  }, [defaultLanguage])

  const checkWin = (board: Map<string, 'X' | 'O'>, move: Move, winLength = 5): boolean => {
    const dirs = [
      [1, 0], [0, 1], [1, 1], [1, -1]
    ]
    const key = `${move.x},${move.y}`
    board.set(key, move.p)
    for (const [dx, dy] of dirs) {
      let count = 1
      let nx = move.x + dx
      let ny = move.y + dy
      while (board.get(`${nx},${ny}`) === move.p) { count++; nx += dx; ny += dy }
      nx = move.x - dx
      ny = move.y - dy
      while (board.get(`${nx},${ny}`) === move.p) { count++; nx -= dx; ny -= dy }
      if (count >= winLength) return true
    }
    return false
  }

  const splitIntoGames = (moves: Move[], winLength = 5): Move[][] => {
    const games: Move[][] = []
    let current: Move[] = []
    const board = new Map<string, 'X' | 'O'>()
    moves.forEach((mv) => {
      current.push(mv)
      const hasWinner = checkWin(board, mv, winLength)
      if (hasWinner) {
        games.push(current)
        current = []
        board.clear()
      }
    })
    if (current.length) games.push(current)
    return games
  }

  // Xác định gói từ profile
  const resolveSubscription = useCallback((plan?: string | null, trialExpires?: string | null, proExpires?: string | null): SubscriptionTier => {
    const now = new Date()
    if (plan === 'pro') {
      if (!proExpires) return 'pro'
      if (new Date(proExpires) > now) return 'pro'
    }
    if (plan === 'trial' || (!plan && trialExpires)) {
      if (trialExpires && new Date(trialExpires) > now) return 'trial'
    }
    return 'free'
  }, [])

  // Áp dụng quota theo gói
  const applyPlanLimits = useCallback((tier: SubscriptionTier, trialExpiresAt?: string | null) => {
    const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free
    const now = new Date()
    const trialEnd = trialExpiresAt ? new Date(trialExpiresAt) : null
    const trialDaysLeft = tier === 'trial' && trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)) : 0

    setState(prev => ({
      ...prev,
      subscriptionTier: tier,
      hasProAccess: tier === 'pro' || tier === 'trial',
      isTrialActive: tier === 'trial',
      trialDaysLeft,
      dailyUsage: { ...prev.dailyUsage, basic: 0, pro: 0, ai_qa: 0 },
      dailyRemaining: {
        ...prev.dailyRemaining,
        basic: limits.basic,
        pro: limits.pro,
        ai_qa: limits.ai_qa
      }
    }))
  }, [])

  // ============================================
  // Match Loading
  // ============================================

  const loadMatches = useCallback(async () => {
    updateState({ loadingMatches: true, error: null })
    
    try {
      // Build query - only fetch matches where current user participated
      let query = supabase
        .from('matches')
        .select(`
          id, created_at, ended_at, match_type, result, total_moves, is_ai_match, ai_difficulty, 
          player_x_user_id, player_o_user_id,
          player_x:profiles!matches_player_x_user_id_fkey(username),
          player_o:profiles!matches_player_o_user_id_fkey(username)
        `)
        .order('created_at', { ascending: false })
        .limit(50)
      
      // Filter by user if logged in - only show matches user participated in
      if (effectiveUserId) {
        query = query.or(`player_x_user_id.eq.${effectiveUserId},player_o_user_id.eq.${effectiveUserId}`)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      
      // Transform data to include usernames
      const matches = (data || []).map((m: any) => ({
        ...m,
        player_x_username: m.player_x?.username || null,
        player_o_username: m.player_o?.username || null
      })) as MatchRow[]
      
      updateState({
        matches,
        loadingMatches: false
      })
    } catch (err) {
      console.error('Failed to load matches:', err)
      updateState({
        loadingMatches: false,
        error: 'Không thể tải danh sách trận đấu'
      })
    }
  }, [updateState, effectiveUserId])

  const fetchMatchMoves = useCallback(async (matchId: string): Promise<Move[] | null> => {
    try {
      const { data, error } = await supabase
        .from('moves')
        .select('position_x, position_y, turn_player, move_number')
        .eq('match_id', matchId)
        .order('move_number', { ascending: true })
      
      if (error || !data?.length) return null
      
      const moves = data.map((row: any, idx: number) => ({
        x: row.position_x ?? 0,
        y: row.position_y ?? 0,
        p: (row.turn_player || (idx % 2 === 0 ? 'X' : 'O')) as 'X' | 'O'
      }))
      const games = splitIntoGames(moves, 5)
      const firstGame = games[0] || moves
      setState(prev => ({
        ...prev,
        games,
        selectedGameIndex: 0,
        sequence: firstGame
      }))
      return firstGame
    } catch (err) {
      console.error('Failed to fetch moves:', err)
      return null
    }
  }, [])

  // ============================================
  // Match Selection
  // ============================================

  const selectMatch = useCallback((id: string) => {
    // Stop playback when selecting new match
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current)
      playIntervalRef.current = null
    }
    
    updateState({
      selectedMatchId: id,
      games: [],
      selectedGameIndex: 0,
      sequence: [],
      timeline: [],
      mistakes: [],
      patterns: [],
      bestMove: null,
      summary: null,
      aiInsights: null,
      // Task 8.8.3: Reset advanced analysis fields
      openingInfo: null,
      hasVCF: false,
      vcfInfo: null,
      missedWins: [],
      // Reset user perspective
      userSide: null,
      playerNames: null,
      yourStats: null,
      opponentStats: null,
      opponentName: null,
      personalizedInsights: [],
      currentMoveIndex: -1,
      isPlaying: false,
      replayMode: false,
      replaySessionId: null,
      replayBoardState: {},
      error: null
    })
  }, [updateState])

  // ============================================
  // Analysis
  // ============================================

  const analyze = useCallback(async (tierOverride?: AnalysisTier, options?: { language?: string; moves?: Move[]; matchId?: string; allowGuest?: boolean }) => {
    setState(prev => {
      const targetTier = tierOverride || prev.tier
      const langKey = options?.language || defaultLanguage || 'vi'
      const { cachedAnalysis, subscriptionTier, hasProAccess, dailyRemaining } = prev
      const effectiveMatchId = options?.matchId || prev.selectedMatchId
      const skipQuotaGuard = options?.allowGuest || options?.matchId === 'demo-offline'
      
      if (!effectiveMatchId) {
        return { ...prev, error: 'Vui lòng chọn một trận đấu' }
      }
      
      if (!effectiveUserId && !skipQuotaGuard) {
        return { ...prev, error: 'Vui lòng đăng nhập để sử dụng tính năng này' }
      }
      
      // Check cache first
      const cacheKey = getCacheKey(effectiveMatchId, targetTier, langKey)
      if (cachedAnalysis[cacheKey]) {
        const cached = cachedAnalysis[cacheKey]
        const timeline = cached.timeline || []
        return {
          ...prev,
          timeline: timeline,
          mistakes: cached.mistakes || [],
          patterns: cached.patterns || [],
          bestMove: cached.best_move || null,
          summary: cached.summary || null,
          aiInsights: cached.ai_insights || null,
          tier: targetTier,
          currentMoveIndex: timeline.length > 0 ? timeline.length - 1 : -1
        }
      }

      // Client-side quota guard
      if (!skipQuotaGuard && targetTier === 'pro' && !hasProAccess) {
        return { ...prev, error: 'Gói hiện tại không cho phép phân tích Pro. Vui lòng nâng cấp.' }
      }
      const remaining = targetTier === 'pro' ? dailyRemaining.pro : dailyRemaining.basic
      if (!skipQuotaGuard && remaining <= 0) {
        return { ...prev, error: 'Bạn đã hết lượt phân tích hôm nay. Vui lòng chờ ngày mai hoặc nâng cấp.' }
      }
      
      return { ...prev, analyzing: true, error: null }
    })

    // Perform async work outside of setState
    try {
      const currentState = state
      const targetTier = tierOverride || currentState.tier
      const langKey = options?.language || defaultLanguage || 'vi'
      const { selectedMatchId, cachedAnalysis, subscriptionTier, games, selectedGameIndex } = currentState
      const targetMatchId = options?.matchId || selectedMatchId
      const allowGuest = options?.allowGuest || options?.matchId === 'demo-offline'
      const effectiveUserForCall = effectiveUserId || (allowGuest ? 'guest-demo' : null)

      if (!targetMatchId || !effectiveUserForCall) return

      // Fetch moves if not already loaded
      let moves = options?.moves || currentState.sequence
      if (!moves.length) {
        const fetchedMoves = await fetchMatchMoves(targetMatchId)
        if (!fetchedMoves?.length) {
          updateState({ analyzing: false, error: 'Không tìm thấy nước đi cho trận này' })
          return
        }
        moves = fetchedMoves
        updateState({ sequence: moves })
      }
      
      // Split series BO3 thành từng ván riêng theo điều kiện thắng 5 liên tiếp
      const gamesList = games.length ? games : splitIntoGames(moves, 5)
      const gameIndex = Math.min(Math.max(selectedGameIndex, 0), Math.max(gamesList.length - 1, 0))
      const gameMoves = gamesList[gameIndex] || moves
      if (gamesList.length > 1 && gameMoves.length !== moves.length) {
        updateState({ sequence: gameMoves, games: gamesList, selectedGameIndex: gameIndex })
      }

      // Determine user side and player names from match data
      const selectedMatch = currentState.matches.find(m => m.id === targetMatchId)
      let userSide: 'X' | 'O' | undefined = undefined
      let playerXName = 'Người chơi X'
      let playerOName = 'Người chơi O'
      
      if (selectedMatch && effectiveUserId) {
        if (selectedMatch.player_x_user_id === effectiveUserId) {
          userSide = 'X'
          playerXName = 'Bạn'
          playerOName = selectedMatch.player_o_username || (selectedMatch.is_ai_match ? 'AI' : 'Đối thủ')
        } else if (selectedMatch.player_o_user_id === effectiveUserId) {
          userSide = 'O'
          playerOName = 'Bạn'
          playerXName = selectedMatch.player_x_username || (selectedMatch.is_ai_match ? 'AI' : 'Đối thủ')
        }
      }

      let result: any = null
      try {
        result = await analyzeMatch({
          matchId: targetMatchId,
          moves: gameMoves,
          tier: targetTier,
          userId: effectiveUserForCall,
          subscriptionTier,
          userSide,
          playerXName,
          playerOName,
          language: langKey
        })
      } catch (apiErr) {
        console.error('API call failed:', apiErr)
        updateState({ analyzing: false, error: 'Lỗi kết nối đến server phân tích' })
        return
      }
      
      // Validate result before using
      if (!result || typeof result !== 'object') {
        updateState({ analyzing: false, error: 'Không nhận được kết quả phân tích từ server' })
        return
      }
      // Task 8.8.3: Extract advanced analysis data from result
      const advancedData = result as any // Type assertion for new fields
      const cacheKey = getCacheKey(targetMatchId, targetTier, langKey)
      const timeline = result.timeline || []

      setState(prev => {
        const key = targetTier === 'pro' ? 'pro' : 'basic'
        const nextUsage = { ...prev.dailyUsage }
        const nextRemaining = { ...prev.dailyRemaining }
        const shouldCountUsage = !(options?.allowGuest || options?.matchId === 'demo-offline')

        if (shouldCountUsage) {
          nextUsage[key] = (nextUsage[key] || 0) + 1
          nextRemaining[key] = Math.max(0, (nextRemaining[key] || 0) - 1)
        }

        const newCache = { ...prev.cachedAnalysis, [cacheKey]: result }

        return {
          ...prev,
          timeline: timeline,
          mistakes: result.mistakes || [],
          patterns: result.patterns || [],
          bestMove: result.best_move || null,
          summary: result.summary || null,
          aiInsights: result.ai_insights || null,
          tier: targetTier,
          currentMoveIndex: timeline.length > 0 ? timeline.length - 1 : -1,
          analyzing: false,
          cachedAnalysis: newCache,
          dailyUsage: nextUsage,
          dailyRemaining: nextRemaining,
          // Task 8.8.3: New advanced analysis fields
          openingInfo: advancedData.opening_info || null,
          hasVCF: advancedData.has_vcf || false,
          vcfInfo: advancedData.vcf_info || null,
          missedWins: advancedData.missed_wins || [],
          // User perspective fields
          userSide: advancedData.user_side || null,
          playerNames: advancedData.player_names || null,
          yourStats: advancedData.your_stats || null,
          opponentStats: advancedData.opponent_stats || null,
          opponentName: advancedData.opponent_name || null,
          personalizedInsights: advancedData.personalized_insights || []
        }
      })
      
    } catch (err) {
      console.error('Analysis failed:', err)
      
      let errorMessage = getErrorMessage(err)
      
      // Handle specific errors
      if (isRateLimitError(err)) {
        errorMessage = 'Bạn đã dùng hết lượt phân tích hôm nay. Vui lòng chờ reset.'
      } else if (isAuthError(err)) {
        errorMessage = 'Bạn cần gói Pro/Trial để dùng phân tích nâng cao.'
      }
      
      updateState({ analyzing: false, error: errorMessage })
    }
  }, [effectiveUserId, getCacheKey, fetchMatchMoves, state])


  // Navigation
  // ============================================

  const setCurrentMove = useCallback((index: number) => {
    const maxIndex = state.sequence.length - 1
    const newIndex = Math.max(-1, Math.min(index, maxIndex))
    updateState({ currentMoveIndex: newIndex })
  }, [state.sequence.length, updateState])

  const nextMove = useCallback(() => {
    setCurrentMove(state.currentMoveIndex + 1)
  }, [state.currentMoveIndex, setCurrentMove])

  const prevMove = useCallback(() => {
    setCurrentMove(state.currentMoveIndex - 1)
  }, [state.currentMoveIndex, setCurrentMove])

  const firstMove = useCallback(() => {
    setCurrentMove(-1)
  }, [setCurrentMove])

  const lastMove = useCallback(() => {
    setCurrentMove(state.sequence.length - 1)
  }, [state.sequence.length, setCurrentMove])

  const play = useCallback(() => {
    if (state.isPlaying) return
    
    updateState({ isPlaying: true })
    
    playIntervalRef.current = setInterval(() => {
      setState(prev => {
        const nextIndex = prev.currentMoveIndex + 1
        if (nextIndex >= prev.sequence.length) {
          // Stop at end
          if (playIntervalRef.current) {
            clearInterval(playIntervalRef.current)
            playIntervalRef.current = null
          }
          return { ...prev, isPlaying: false }
        }
        return { ...prev, currentMoveIndex: nextIndex }
      })
    }, 1000 / state.playSpeed)
  }, [state.isPlaying, state.playSpeed, updateState])

  const pause = useCallback(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current)
      playIntervalRef.current = null
    }
    updateState({ isPlaying: false })
  }, [updateState])

  const setPlaySpeed = useCallback((speed: number) => {
    updateState({ playSpeed: Math.max(0.5, Math.min(4, speed)) })
  }, [updateState])

  // Set analysis tier (basic/pro)
  const setTier = useCallback((tier: AnalysisTier) => {
    updateState({ tier })
  }, [updateState])

  // Chọn ván (BO3)
  const setSelectedGameIndex = useCallback((idx: number) => {
    setState(prev => {
      if (!prev.games.length) return prev
      const clamped = Math.min(Math.max(idx, 0), prev.games.length - 1)
      if (clamped === prev.selectedGameIndex) return prev
      const nextSeq = prev.games[clamped] || []
      return {
        ...prev,
        selectedGameIndex: clamped,
        sequence: nextSeq,
        timeline: [],
        mistakes: [],
        patterns: [],
        bestMove: null,
        summary: null,
        aiInsights: null,
        currentMoveIndex: -1
      }
    })
  }, [])

  // ============================================
  // UI Actions
  // ============================================

  const setActiveTab = useCallback((tab: ActiveTab) => {
    updateState({ activeTab: tab })
  }, [updateState])

  const clearError = useCallback(() => {
    updateState({ error: null })
  }, [updateState])

  // ============================================
  // Replay Mode
  // ============================================

  const enterReplayMode = useCallback(async (startMove?: number) => {
    const { selectedMatchId, sequence, subscriptionTier } = state
    
    if (!selectedMatchId || !effectiveUserId) {
      updateState({ error: 'Vui lòng chọn trận đấu và đăng nhập' })
      return
    }
    
    updateState({ loadingReplay: true, error: null })
    
    try {
      const moves = sequence.length ? sequence : await fetchMatchMoves(selectedMatchId) || []
      
      const result = await createReplaySession({
        matchId: selectedMatchId,
        moves,
        userId: effectiveUserId,
        tier: subscriptionTier
      })
      
      // Navigate to start move if specified
      let boardState: Record<string, 'X' | 'O'> = {}
      const targetMove = startMove ?? -1
      
      if (targetMove >= 0) {
        const navResult = await navigateReplay({
          sessionId: result.session_id,
          moveIndex: targetMove
        })
        boardState = navResult.board_state
      }
      
      updateState({
        replayMode: true,
        replaySessionId: result.session_id,
        replayBoardState: boardState,
        currentMoveIndex: targetMove,
        sequence: moves,
        loadingReplay: false
      })
      
    } catch (err) {
      console.error('Failed to enter replay mode:', err)
      updateState({
        loadingReplay: false,
        error: getErrorMessage(err)
      })
    }
  }, [state, effectiveUserId, updateState, fetchMatchMoves])

  const exitReplayMode = useCallback(async () => {
    const { replaySessionId } = state
    
    if (replaySessionId) {
      await deleteReplaySession(replaySessionId)
    }
    
    updateState({
      replayMode: false,
      replaySessionId: null,
      replayBoardState: {}
    })
  }, [state, updateState])

  const playAlternativeMove = useCallback(async (move: Move) => {
    const { replaySessionId } = state
    
    if (!replaySessionId) {
      updateState({ error: 'Không có phiên replay đang hoạt động' })
      return
    }
    
    updateState({ loadingReplay: true, error: null })
    
    try {
      const result = await playReplayMove({
        sessionId: replaySessionId,
        move
      })
      
      updateState({
        replayBoardState: result.board_state,
        loadingReplay: false
      })
      
    } catch (err) {
      console.error('Failed to play alternative move:', err)
      updateState({
        loadingReplay: false,
        error: getErrorMessage(err)
      })
    }
  }, [state, updateState])

  // ============================================
  // Chat
  // ============================================

  const askQuestionAction = useCallback(async (question: string): Promise<string> => {
    const { selectedMatchId, subscriptionTier, chatHistory, dailyRemaining } = state
    
    if (!selectedMatchId || !effectiveUserId) {
      throw new Error('Vui l?ng ch?n tr?n ??u v? ??ng nh?p')
    }

    if ((dailyRemaining.ai_qa || 0) <= 0) {
      updateState({ error: 'B?n ?? h?t l??t h?i th?ng minh h?m nay. Vui l?ng ch? ng?y mai ho?c n?ng c?p.' })
      throw new Error('H?t l??t h?i')
    }
    
    updateState({
      loadingChat: true,
      error: null,
      chatHistory: [...chatHistory, { role: 'user', content: question }]
    })
    
    try {
      const result = await askQuestion({
        matchId: selectedMatchId,
        question,
        userId: effectiveUserId,
        tier: subscriptionTier
      })
      
      setState(prev => {
        const nextUsage = { ...prev.dailyUsage }
        const nextRemaining = { ...prev.dailyRemaining }
        nextUsage.ai_qa = (nextUsage.ai_qa || 0) + 1
        nextRemaining.ai_qa = Math.max(0, (nextRemaining.ai_qa || 0) - 1)
        return {
          ...prev,
          loadingChat: false,
          chatHistory: [...prev.chatHistory, { role: 'user', content: question }, { role: 'assistant', content: result.answer }],
          dailyUsage: nextUsage,
          dailyRemaining: nextRemaining
        }
      })
      
      return result.answer
      
    } catch (err) {
      console.error('Failed to ask question:', err)
      const errorMessage = getErrorMessage(err)
      updateState({
        loadingChat: false,
        error: errorMessage
      })
      throw new Error(errorMessage)
    }
  }, [state, effectiveUserId, updateState])


  const clearChat = useCallback(() => {
    updateState({ chatHistory: [] })
  }, [updateState])

  // ============================================
  // Usage
  // ============================================

  const refreshUsage = useCallback(async () => {
    if (!effectiveUserId) return
    
    try {
      // Get current subscription tier from state
      const currentTier = state.subscriptionTier
      const usage = await getUsage({
        userId: effectiveUserId,
        tier: currentTier
      })
      
      const dailyUsageData = usage.daily_usage || {}
      const dailyRemainingData = usage.daily_remaining || {}
      
      updateState({
        dailyUsage: {
          basic: dailyUsageData.basic_analysis || 0,
          pro: dailyUsageData.pro_analysis || 0,
          replay: dailyUsageData.replay || 0,
          ai_qa: dailyUsageData.ai_qa || 0
        },
        dailyRemaining: {
          basic: dailyRemainingData.basic_analysis || 0,
          pro: dailyRemainingData.pro_analysis || 0,
          replay: dailyRemainingData.replay || 0,
          ai_qa: dailyRemainingData.ai_qa || 0
        }
      })
    } catch (err) {
      console.error('Failed to refresh usage:', err)
    }
  }, [effectiveUserId, updateState])

  // ============================================
  // Effects
  // ============================================

  // Load matches on mount
  useEffect(() => {
    loadMatches()
  }, [loadMatches])

  // Load gói/plan từ profiles
  useEffect(() => {
    if (!effectiveUserId) {
      applyPlanLimits('free', null)
      return
    }
    let cancelled = false
    const loadPlan = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('plan, trial_expires_at, pro_expires_at')
          .eq('user_id', effectiveUserId)
          .maybeSingle()
        if (cancelled) return
        if (error) throw error
        const tier = resolveSubscription((data as any)?.plan, (data as any)?.trial_expires_at, (data as any)?.pro_expires_at)
        applyPlanLimits(tier, (data as any)?.trial_expires_at)
      } catch (err) {
        console.warn('Không đọc được plan, fallback free', err)
        if (!cancelled) applyPlanLimits('free', null)
      }
    }
    loadPlan()
    return () => { cancelled = true }
  }, [applyPlanLimits, effectiveUserId, resolveSubscription])

  // Auto-select first match
  useEffect(() => {
    if (state.matches.length > 0 && !state.selectedMatchId) {
      selectMatch(state.matches[0].id)
    }
  }, [state.matches.length, state.selectedMatchId, selectMatch])

  // Refresh usage on mount and when user changes
  useEffect(() => {
    if (effectiveUserId) {
      refreshUsage()
    }
  }, [effectiveUserId, refreshUsage])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current)
      }
      if (state.replaySessionId) {
        deleteReplaySession(state.replaySessionId)
      }
    }
  }, [state.replaySessionId])

  // ============================================
  // Return
  // ============================================

  return {
    ...state,
    selectMatch,
    loadMatches,
    analyze,
    setTier,
    setCurrentMove,
    nextMove,
    prevMove,
    firstMove,
    lastMove,
    play,
    pause,
    setPlaySpeed,
    setActiveTab,
    clearError,
    enterReplayMode,
    exitReplayMode,
    playAlternativeMove,
    askQuestion: askQuestionAction,
    clearChat,
    refreshUsage,
    setSelectedGameIndex
  }
}

export default useAnalysisState
