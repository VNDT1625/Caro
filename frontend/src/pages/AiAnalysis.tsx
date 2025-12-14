/**
 * AiAnalysis - AI Match Analysis Page
 * 
 * Features:
 * - 3-column responsive grid layout (Match List, Board, Analysis Panel)
 * - Tier toggle (Basic/Pro) with usage indicators
 * - Interactive board with move navigation
 * - Score timeline chart
 * - Keyboard shortcuts support
 * - Loading state with progress indicator (Requirements 16.4)
 * - Error handling with retry option (Requirements 16.5)
 * - Language selector for comments (Requirements 19.1, 19.2, 19.3)
 * 
 * Requirements: 10.1-10.5, 11.1-11.5, 13.1-13.5, 16.3, 16.4, 16.5, 19.1, 19.2, 19.3
 */

import { useEffect, useState, lazy, Suspense, useMemo, useCallback, memo, useRef } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { supabase } from '../lib/supabase'
import { useAnalysisState } from '../hooks/useAnalysisState'
import { ReportModal } from '../components/report'

// Comment language type - Requirements 19.1
type CommentLanguage = 'vi' | 'en' | 'zh' | 'ja'

// Language options for selector - Requirements 19.1
const COMMENT_LANGUAGES: { code: CommentLanguage; label: string; flag: string }[] = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' }
]

// Lazy load heavy components for better initial load performance - Requirements 16.4
const ControlsBar = lazy(() => import('../components/analysis/ControlsBar'))
const MatchListSidebar = lazy(() => import('../components/analysis/MatchListSidebar'))
const InteractiveBoard = lazy(() => import('../components/analysis/InteractiveBoard'))
const MoveNavigation = lazy(() => import('../components/analysis/MoveNavigation'))
const ScoreTimeline = lazy(() => import('../components/analysis/ScoreTimeline'))
const AnalysisErrorBoundary = lazy(() => import('../components/analysis/AnalysisErrorBoundary'))
const AIChatPanel = lazy(() => import('../components/analysis/AIChatPanel'))
const OnlinePlayersPanel = lazy(() => import('../components/analysis/OnlinePlayersPanel'))
const ReplayAIPanel = lazy(() => import('../components/analysis/ReplayAIPanel'))
const ComparisonPanel = lazy(() => import('../components/analysis/ComparisonPanel'))

// Import useReplayAI hook for what-if mode
import { useReplayAI } from '../hooks/useReplayAI'
import type { Move } from '../lib/replayApi'

// Right panel tab type
type RightPanelTab = 'analysis' | 'chat' | 'online'

// Loading fallback component
const LoadingFallback = memo(function LoadingFallback({ height = 100 }: { height?: number }) {
  return (
    <div style={{
      height,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(15,23,42,0.6)',
      borderRadius: 8,
      color: '#64748B',
      fontSize: 13
    }}>
      <span style={{
        width: 16,
        height: 16,
        border: '2px solid rgba(56,189,248,0.3)',
        borderTopColor: '#38BDF8',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginRight: 8
      }} />
      Đang tải...
    </div>
  )
})

// Analysis Loading Overlay with Progress - Requirements 16.4
const AnalysisLoadingOverlay = memo(function AnalysisLoadingOverlay({ 
  progress = 0,
  message = 'Đang phân tích...'
}: { 
  progress?: number
  message?: string 
}) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(15,23,42,0.85)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      zIndex: 10,
      backdropFilter: 'blur(4px)'
    }}>
      {/* Spinner */}
      <div style={{
        width: 48,
        height: 48,
        border: '3px solid rgba(56,189,248,0.2)',
        borderTopColor: '#38BDF8',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: 16
      }} />
      
      {/* Message */}
      <div style={{
        color: '#F1F5F9',
        fontSize: 14,
        fontWeight: 500,
        marginBottom: 12
      }}>
        {message}
      </div>
      
      {/* Progress Bar */}
      {progress > 0 && (
        <div style={{
          width: 200,
          height: 6,
          background: 'rgba(71,85,105,0.5)',
          borderRadius: 3,
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${Math.min(100, progress)}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #38BDF8, #818CF8)',
            borderRadius: 3,
            transition: 'width 0.3s ease'
          }} />
        </div>
      )}
      
      {/* Progress Percentage */}
      {progress > 0 && (
        <div style={{
          color: '#94A3B8',
          fontSize: 12,
          marginTop: 8
        }}>
          {Math.round(progress)}%
        </div>
      )}
    </div>
  )
})

// Error Display with Retry - Requirements 16.5
const AnalysisErrorDisplay = memo(function AnalysisErrorDisplay({
  error,
  errorCode,
  onRetry,
  onDismiss
}: {
  error: string
  errorCode?: string
  onRetry: () => void
  onDismiss: () => void
}) {
  // Map error codes to user-friendly messages
  const getErrorDetails = (code?: string) => {
    switch (code) {
      case 'E001':
        return { icon: '🚫', title: 'Bàn cờ không hợp lệ', canRetry: false }
      case 'E002':
        return { icon: '📍', title: 'Tọa độ không hợp lệ', canRetry: false }
      case 'E003':
        return { icon: '🔢', title: 'Chuỗi nước đi không hợp lệ', canRetry: false }
      case 'E004':
        return { icon: '📉', title: 'Không đủ nước đi', canRetry: false }
      case 'E005':
        return { icon: '⏱️', title: 'Quá thời gian', canRetry: true }
      case 'E006':
        return { icon: '🌐', title: 'Ngôn ngữ không hỗ trợ', canRetry: false }
      case 'E007':
        return { icon: '🔍', title: 'Lỗi phát hiện pattern', canRetry: true }
      case 'NETWORK':
        return { icon: '📡', title: 'Lỗi kết nối', canRetry: true }
      case 'RATE_LIMIT':
        return { icon: '⚡', title: 'Hết lượt phân tích', canRetry: false }
      case 'AUTH':
        return { icon: '🔒', title: 'Cần nâng cấp gói', canRetry: false }
      default:
        return { icon: '⚠️', title: 'Lỗi phân tích', canRetry: true }
    }
  }

  const details = getErrorDetails(errorCode)

  return (
    <div style={{
      padding: '16px 20px',
      borderRadius: 12,
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.3)',
      marginTop: 12
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12
      }}>
        {/* Error Icon */}
        <span style={{ fontSize: 24 }}>{details.icon}</span>
        
        {/* Error Content */}
        <div style={{ flex: 1 }}>
          <div style={{
            color: '#FCA5A5',
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 4
          }}>
            {details.title}
          </div>
          <div style={{
            color: '#FDA4AF',
            fontSize: 13,
            lineHeight: 1.5
          }}>
            {error}
          </div>
          {errorCode && (
            <div style={{
              color: '#94A3B8',
              fontSize: 11,
              marginTop: 6
            }}>
              Mã lỗi: {errorCode}
            </div>
          )}
        </div>
        
        {/* Dismiss Button */}
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#FCA5A5',
            cursor: 'pointer',
            fontSize: 18,
            padding: 4,
            lineHeight: 1
          }}
          aria-label="Đóng"
        >
          ×
        </button>
      </div>
      
      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginTop: 12,
        paddingTop: 12,
        borderTop: '1px solid rgba(239,68,68,0.2)'
      }}>
        {details.canRetry && (
          <button
            onClick={onRetry}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #38BDF8, #818CF8)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            🔄 Thử lại
          </button>
        )}
        {!details.canRetry && errorCode === 'RATE_LIMIT' && (
          <button
            onClick={() => { window.location.hash = '#subscription' }}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            ⬆️ Nâng cấp gói
          </button>
        )}
      </div>
    </div>
  )
})

// Language Selector Component - Requirements 19.1, 19.2, 19.3
const LanguageSelector = memo(function LanguageSelector({
  value,
  onChange,
  disabled = false
}: {
  value: CommentLanguage
  onChange: (lang: CommentLanguage) => void
  disabled?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selected = COMMENT_LANGUAGES.find(l => l.code === value) || COMMENT_LANGUAGES[0]

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid rgba(71,85,105,0.5)',
          background: 'rgba(30,41,59,0.8)',
          color: disabled ? '#64748B' : '#F1F5F9',
          fontSize: 12,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1
        }}
      >
        <span>{selected.flag}</span>
        <span>{selected.code.toUpperCase()}</span>
        <span style={{ 
          marginLeft: 2,
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }}>▼</span>
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99
            }}
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'rgba(30,41,59,0.98)',
            border: '1px solid rgba(71,85,105,0.5)',
            borderRadius: 8,
            overflow: 'hidden',
            zIndex: 100,
            minWidth: 140,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            {COMMENT_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => {
                  onChange(lang.code)
                  setIsOpen(false)
                  // Persist preference - Requirements 19.3
                  localStorage.setItem('analysisCommentLang', lang.code)
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  border: 'none',
                  background: value === lang.code ? 'rgba(56,189,248,0.15)' : 'transparent',
                  color: value === lang.code ? '#38BDF8' : '#E2E8F0',
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
                {value === lang.code && <span style={{ marginLeft: 'auto' }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
})

export default function AiAnalysis() {
  const { t } = useLanguage()
  const [userId, setUserId] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('analysis')
  // State for showing suggested alternative move on board when clicking a mistake
  const [suggestedAlternative, setSuggestedAlternative] = useState<{ x: number; y: number } | null>(null)
  
  // Comment language state - Requirements 19.1, 19.2, 19.3
  const [commentLanguage, setCommentLanguage] = useState<CommentLanguage>(() => {
    // Load persisted preference - Requirements 19.3
    const saved = localStorage.getItem('analysisCommentLang')
    if (saved && ['vi', 'en', 'zh', 'ja'].includes(saved)) {
      return saved as CommentLanguage
    }
    return 'vi'
  })
  
  // Analysis progress state - Requirements 16.4
  const [analysisProgress, setAnalysisProgress] = useState(0)
  
  // Error code for detailed error handling - Requirements 16.5
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined)

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null)
    })
  }, [])

  // Use the analysis state hook
  const state = useAnalysisState(userId, commentLanguage)
  
  // Demo moves for onboarding (15x15 board indices)
  const demoMoves = useMemo<Move[]>(() => [
    { x: 7, y: 7, p: 'X' },
    { x: 7, y: 8, p: 'O' },
    { x: 8, y: 7, p: 'X' },
    { x: 8, y: 8, p: 'O' },
    { x: 6, y: 7, p: 'X' },
    { x: 6, y: 8, p: 'O' },
  ], [])
  
  const runDemoAnalysis = useCallback(() => {
    const demoMatchId = 'demo-offline'
    state.selectMatch(demoMatchId)
    state.analyze('basic', {
      language: commentLanguage,
      moves: demoMoves,
      matchId: demoMatchId,
      allowGuest: true
    })
  }, [commentLanguage, demoMoves, state.analyze, state.selectMatch])
  
  const remainingBasic = state.dailyRemaining?.basic ?? 0
  const remainingPro = state.dailyRemaining?.pro ?? 0
  
  // Compute set of analyzed match IDs from cached analysis - Requirements 16.2
  const analyzedMatchIds = useMemo(() => {
    const ids = new Set<string>()
    Object.keys(state.cachedAnalysis || {}).forEach(key => {
      // Cache key format is "matchId:tier"
      const matchId = key.split(':')[0]
      if (matchId) ids.add(matchId)
    })
    return ids
  }, [state.cachedAnalysis])

  // Handle URL parameters for direct match access - Requirements 16.3, 20.4
  useEffect(() => {
    // Parse matchId from URL hash query params (e.g., #ai-analysis?matchId=xxx)
    const hash = window.location.hash
    const queryIndex = hash.indexOf('?')
    if (queryIndex !== -1) {
      const queryString = hash.substring(queryIndex + 1)
      const params = new URLSearchParams(queryString)
      const matchIdFromUrl = params.get('matchId')
      
      if (matchIdFromUrl && state.matches.length > 0 && !state.selectedMatchId) {
        // Check if the match exists in the loaded matches
        const matchExists = state.matches.some(m => m.id === matchIdFromUrl)
        if (matchExists) {
          state.selectMatch(matchIdFromUrl)
          // Auto-trigger analysis after selecting
          setTimeout(() => {
            state.analyze(undefined, { language: commentLanguage })
          }, 100)
        }
        // Clean up URL by removing query params
        window.history.replaceState(null, '', '#ai-analysis')
      }
    }
  }, [state.matches, state.selectedMatchId, state.selectMatch, state.analyze, commentLanguage])

  // Auto-select match from Room page navigation via localStorage (Requirements 16.3, 20.4)
  useEffect(() => {
    const analysisMatchId = localStorage.getItem('analysisMatchId')
    if (analysisMatchId && state.matches.length > 0 && !state.selectedMatchId) {
      // Check if the match exists in the loaded matches
      const matchExists = state.matches.some(m => m.id === analysisMatchId)
      if (matchExists) {
        state.selectMatch(analysisMatchId)
        // Auto-trigger analysis after selecting
        setTimeout(() => {
          state.analyze(undefined, { language: commentLanguage })
        }, 100)
      }
      // Clear the localStorage after using it
      localStorage.removeItem('analysisMatchId')
      localStorage.removeItem('analysisMatchData')
    }
  }, [state.matches, state.selectedMatchId, state.selectMatch, state.analyze, commentLanguage])

  // Khi đổi ngôn ngữ, re-run để lấy comment mới cho trận đang mở
  // FIX: Use ref to track previous language and avoid infinite loop
  const prevCommentLanguageRef = useRef(commentLanguage)
  useEffect(() => {
    // Only re-analyze if language actually changed (not on every render)
    if (prevCommentLanguageRef.current !== commentLanguage) {
      prevCommentLanguageRef.current = commentLanguage
      if (state.selectedMatchId && state.sequence.length > 0 && !state.analyzing) {
        state.analyze(undefined, { language: commentLanguage })
      }
    }
  }, [commentLanguage]) // Minimal dependencies to prevent loop

  const selectedMatch = useMemo(() => state.matches.find((m) => m.id === state.selectedMatchId) || null, [state.matches, state.selectedMatchId])
  const reportTargetId = useMemo(() => {
    if (!selectedMatch) return null
    if (userId && selectedMatch.player_x_user_id === userId) {
      return selectedMatch.player_o_user_id || null
    }
    if (userId && selectedMatch.player_o_user_id === userId) {
      return selectedMatch.player_x_user_id || null
    }
    return selectedMatch.player_o_user_id || selectedMatch.player_x_user_id || null
  }, [selectedMatch, userId])

  // Convert sequence to Move[] for replay hook
  const originalMoves: Move[] = useMemo(() => {
    return state.sequence.map((pos, idx) => ({
      x: pos.x,
      y: pos.y,
      p: (idx % 2 === 0 ? 'X' : 'O') as 'X' | 'O'
    }))
  }, [state.sequence])

  // Use replay AI hook for what-if mode
  const replayAI = useReplayAI(state.selectedMatchId, originalMoves, userId)

  const handleEnterWhatIf = useCallback(() => {
    replayAI.enterWhatIfMode(state.currentMoveIndex)
  }, [replayAI, state.currentMoveIndex])

  // Handle board cell click in what-if mode
  const handleBoardCellClick = useCallback((x: number, y: number) => {
    if (replayAI.mode === 'what_if' && !replayAI.aiThinking) {
      replayAI.playMove(x, y)
    }
  }, [replayAI])

  // Memoize handlers to prevent unnecessary re-renders
  const handleClose = useCallback(() => {
    window.location.hash = '#home'
  }, [])

  const handleUpgrade = useCallback(() => {
    setShowUpgradeModal(true)
  }, [])

  const handleGameChange = useCallback((idx: number) => {
    state.setSelectedGameIndex(idx)
    state.analyze(undefined, { language: commentLanguage })
  }, [state])

  // Responsive breakpoints
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Simulate analysis progress - Requirements 16.4
  useEffect(() => {
    if (state.analyzing) {
      setAnalysisProgress(0)
      const interval = setInterval(() => {
        setAnalysisProgress(prev => {
          // Slow down as we approach 90% (never reach 100% until done)
          if (prev < 30) return prev + 8
          if (prev < 60) return prev + 5
          if (prev < 85) return prev + 2
          if (prev < 95) return prev + 0.5
          return prev
        })
      }, 200)
      return () => clearInterval(interval)
    } else {
      // Complete the progress when analysis finishes
      if (analysisProgress > 0) {
        setAnalysisProgress(100)
        setTimeout(() => setAnalysisProgress(0), 300)
      }
    }
  }, [state.analyzing])

  // Extract error code from error message - Requirements 16.5
  useEffect(() => {
    if (state.error) {
      const errorStr = typeof state.error === 'string' ? state.error : ''
      // Try to extract error code from message
      if (errorStr.includes('kết nối') || errorStr.includes('network')) {
        setErrorCode('NETWORK')
      } else if (errorStr.includes('hết lượt') || errorStr.includes('rate limit')) {
        setErrorCode('RATE_LIMIT')
      } else if (errorStr.includes('nâng cấp') || errorStr.includes('Pro')) {
        setErrorCode('AUTH')
      } else if (errorStr.includes('timeout') || errorStr.includes('thời gian')) {
        setErrorCode('E005')
      } else if (errorStr.includes('không đủ') || errorStr.includes('insufficient')) {
        setErrorCode('E004')
      } else {
        setErrorCode(undefined)
      }
    }
  }, [state.error])

  // Determine layout based on screen width - Requirements 10.5
  const isMobile = windowWidth < 768
  const isTablet = windowWidth >= 768 && windowWidth < 1200
  const isDesktop = windowWidth >= 1200

  // Memoize grid template based on screen size
  const gridTemplate = useMemo(() => {
    if (isMobile) return '1fr' // Single column
    if (isTablet) return '280px 1fr' // 2 columns
    return '280px 1fr 340px' // 3 columns
  }, [isMobile, isTablet])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
      padding: isMobile ? 12 : 20
    }}>
      <div style={{ maxWidth: 1600, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: isMobile ? 22 : 28, 
            color: '#F1F5F9',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            🎯 {t('aiAnalysis.title')}
          </h1>
          <p style={{ 
            color: '#94A3B8', 
            marginTop: 4, 
            fontSize: isMobile ? 13 : 14 
          }}>
            {t('aiAnalysis.subtitle')}
          </p>
        </div>

        {/* Controls Bar */}
        <Suspense fallback={<LoadingFallback height={60} />}>
          <ControlsBar
            tier={state.tier}
            subscriptionTier={state.subscriptionTier}
            hasProAccess={state.hasProAccess}
            isTrialActive={state.isTrialActive}
            trialDaysLeft={state.trialDaysLeft}
            dailyUsage={state.dailyUsage}
            dailyRemaining={state.dailyRemaining}
            analyzing={state.analyzing}
            selectedMatchId={state.selectedMatchId}
            gameCount={state.games.length || 1}
            gameIndex={state.selectedGameIndex || 0}
            onGameChange={handleGameChange}
            onTierChange={state.setTier}
            onAnalyze={() => state.analyze(undefined, { language: commentLanguage })}
            onClose={handleClose}
            onUpgrade={handleUpgrade}
          />
        </Suspense>
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          borderRadius: 10,
          background: 'rgba(30,41,59,0.4)',
          border: '1px solid rgba(71,85,105,0.3)',
          color: '#94A3B8',
          fontSize: 12
        }}>
          Lượt hôm nay: Basic còn {remainingBasic}, Pro còn {remainingPro}. Chưa có trận? Thử nút "Phân tích thử" bên dưới.
        </div>

        {/* Error Display with Retry - Requirements 16.5 */}
        {state.error && (
          <AnalysisErrorDisplay
            error={typeof state.error === 'string' ? state.error : (state.error as any)?.message || JSON.stringify(state.error)}
            errorCode={errorCode}
            onRetry={() => {
              setErrorCode(undefined)
              state.clearError()
              state.analyze(undefined, { language: commentLanguage })
            }}
            onDismiss={() => {
              setErrorCode(undefined)
              state.clearError()
            }}
          />
        )}

        {/* Main Grid Layout - Requirements 10.1 */}
        <Suspense fallback={<LoadingFallback height={100} />}>
          <AnalysisErrorBoundary 
            onRetry={() => state.analyze(undefined, { language: commentLanguage })} 
            onUpgrade={handleUpgrade}
            fallbackHeight={400}
          >
            <div style={{
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              gap: 16,
              minHeight: 'calc(100vh - 200px)'
            }}>
              {/* Left Column - Match List Sidebar + Online Players */}
              <div style={{ 
                display: isMobile ? 'none' : 'flex',
                flexDirection: 'column',
                gap: 12,
                height: isDesktop ? 'calc(100vh - 220px)' : 'auto',
                overflow: 'hidden'
              }}>
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  <Suspense fallback={<LoadingFallback height={300} />}>
                    <MatchListSidebar
                      matches={state.matches}
                      selectedMatchId={state.selectedMatchId}
                      loading={state.loadingMatches}
                      onSelectMatch={(id) => { state.selectMatch(id); setSuggestedAlternative(null) }}
                      currentUserId={userId}
                      analyzedMatchIds={analyzedMatchIds}
                    />
                  </Suspense>
                </div>
                {/* Online Players Panel - Requirements: 1.1, 1.5 */}
                {userId && (
                  <Suspense fallback={<LoadingFallback height={200} />}>
                    <OnlinePlayersPanel
                      currentUserId={userId}
                      onChallenge={(playerId) => {
                        // TODO: Implement challenge invitation
                        console.log('Challenge player:', playerId)
                      }}
                      onMessage={(playerId) => {
                        // TODO: Open DM chat
                        console.log('Message player:', playerId)
                      }}
                      onViewProfile={(playerId) => {
                        window.location.hash = `#profile?id=${playerId}`
                      }}
                    />
                  </Suspense>
                )}
              </div>

          {/* Center Column - Board Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Mobile Match Selector */}
            {isMobile && (
              <select
                value={state.selectedMatchId || ''}
                onChange={(e) => { state.selectMatch(e.target.value); setSuggestedAlternative(null) }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(71,85,105,0.5)',
                  background: 'rgba(15,23,42,0.7)',
                  color: '#F1F5F9',
                  fontSize: 14
                }}
              >
                <option value="">{t('aiAnalysis.selectMatch')}</option>
                {state.matches.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.id.slice(0, 8)}... - {m.result || 'Đang chơi'}
                  </option>
                ))}
              </select>
            )}

            {/* Board Section */}
            <div style={{
              background: 'rgba(15,23,42,0.6)',
              borderRadius: 12,
              border: '1px solid rgba(71,85,105,0.35)',
              padding: isMobile ? 10 : 14,
              position: 'relative'
            }}>
              {/* Loading Overlay with Progress - Requirements 16.4 */}
              {state.analyzing && (
                <AnalysisLoadingOverlay 
                  progress={analysisProgress}
                  message={analysisProgress < 30 ? 'Đang tải dữ liệu...' : 
                           analysisProgress < 60 ? 'Đang phân tích pattern...' :
                           analysisProgress < 90 ? 'Đang đánh giá nước đi...' :
                           'Đang hoàn tất...'}
                />
              )}
              
              <div style={{ 
                fontWeight: 600, 
                marginBottom: 10, 
                color: '#F1F5F9',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  🎯 {t('aiAnalysis.board')}
                  {state.analyzing && (
                    <span style={{
                      fontSize: 11,
                      color: '#38BDF8',
                      background: 'rgba(56,189,248,0.15)',
                      padding: '2px 8px',
                      borderRadius: 4
                    }}>
                      {t('aiAnalysis.loading')}
                    </span>
                  )}
                </div>
                {state.selectedMatchId && (
                  <button
                    onClick={() => {
                      if (!reportTargetId) {
                        alert('Kh?ng t?m th?y ng??i ch?i ?? b?o c?o')
                        return
                      }
                      setShowReportModal(true)
                    }}
                    disabled={!reportTargetId}
                    style={{
                      border: '1px solid rgba(239,68,68,0.4)',
                      background: 'rgba(239,68,68,0.12)',
                      color: '#F87171',
                      padding: '6px 10px',
                      borderRadius: 8,
                      fontSize: 12,
                      cursor: reportTargetId ? 'pointer' : 'not-allowed',
                      opacity: reportTargetId ? 1 : 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    ?? {t('report.button') || 'B?o c?o'}
                  </button>
                )}
              </div>

              {state.sequence.length === 0 && !state.analyzing ? (
                <div style={{
                  padding: 32,
                  textAlign: 'center',
                  color: '#94A3B8',
                  fontSize: 13,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  alignItems: 'center'
                }}>
                  <div>{t('aiAnalysis.noSelection')}</div>
                  <button
                    onClick={runDemoAnalysis}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'linear-gradient(135deg, #38BDF8, #6366F1)',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 10px 30px rgba(56,189,248,0.25)'
                    }}
                  >
                    Phân tích thử (6 nước mẫu)
                  </button>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Cần tối thiểu 5 nước để phân tích. Demo dùng user khách, không trừ lượt.
                  </div>
                </div>
              ) : (
                <Suspense fallback={<LoadingFallback height={300} />}>
                  {/* InteractiveBoard - Requirements 10.3, 10.4, 17.5, 17.6 */}
                  <InteractiveBoard
                    sequence={replayAI.mode === 'what_if' ? [] : state.sequence}
                    currentMoveIndex={replayAI.mode === 'what_if' ? -1 : state.currentMoveIndex}
                    bestMove={replayAI.mode === 'what_if' ? null : state.bestMove}
                    mistakes={replayAI.mode === 'what_if' ? [] : state.mistakes}
                    patterns={replayAI.mode === 'what_if' ? [] : state.patterns}
                    timeline={replayAI.mode === 'what_if' ? [] : state.timeline}
                    replayMode={replayAI.mode === 'what_if' ? true : state.replayMode}
                    replayBoardState={replayAI.mode === 'what_if' 
                      ? (() => {
                          // Convert Board (2D array) to Record<string, 'X' | 'O'>
                          const boardRecord: Record<string, 'X' | 'O'> = {}
                          replayAI.currentBoard.forEach((row, x) => {
                            row.forEach((cell, y) => {
                              if (cell === 'X' || cell === 'O') {
                                boardRecord[`${x},${y}`] = cell
                              }
                            })
                          })
                          return boardRecord
                        })()
                      : state.replayBoardState}
                    suggestedMove={replayAI.mode === 'what_if' ? null : suggestedAlternative}
                    onMoveClick={(idx) => {
                      state.setCurrentMove(idx)
                      // Clear suggested move when navigating to different move
                      setSuggestedAlternative(null)
                    }}
                  />
                  {/* What-if mode indicator */}
                  {replayAI.mode === 'what_if' && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(34,197,94,0.12)',
                      border: '1px solid rgba(34,197,94,0.3)',
                      color: '#22C55E',
                      fontSize: 12,
                      textAlign: 'center'
                    }}>
                      🎯 {t('replay.clickToPlay') || 'Click vào ô trống để đi nước'}
                      {replayAI.aiThinking && (
                        <span style={{ marginLeft: 8 }}>
                          ⏳ {t('replay.aiThinking') || 'AI đang suy nghĩ...'}
                        </span>
                      )}
                    </div>
                  )}
                </Suspense>
              )}
            </div>

            {/* Move Navigation - Requirements 10.1, 10.2, 17.1, 17.2, 17.3, 17.4 */}
            {state.sequence.length > 0 && (
              <Suspense fallback={<LoadingFallback height={120} />}>
                <MoveNavigation
                  currentMoveIndex={state.currentMoveIndex}
                  totalMoves={state.sequence.length}
                  isPlaying={state.isPlaying}
                  playSpeed={state.playSpeed}
                  timeline={state.timeline}
                  onSetMove={state.setCurrentMove}
                  onPlay={state.play}
                  onPause={state.pause}
                  onNext={state.nextMove}
                  onPrev={state.prevMove}
                  onFirst={state.firstMove}
                  onLast={state.lastMove}
                  onSetSpeed={state.setPlaySpeed}
                />
              </Suspense>
            )}

            {/* Score Timeline */}
            {state.timeline.length > 0 && (
              <Suspense fallback={<LoadingFallback height={140} />}>
                <ScoreTimeline
                  timeline={state.timeline}
                  currentMoveIndex={state.currentMoveIndex}
                  onMoveClick={state.setCurrentMove}
                />
              </Suspense>
            )}
          </div>

          {/* Right Column - Analysis Panel with Tabs */}
          {(isDesktop || isTablet) && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              gridColumn: isTablet ? '1 / -1' : 'auto',
              maxHeight: isDesktop ? 'calc(100vh - 220px)' : '500px',
              overflow: 'hidden',
              background: 'rgba(15,23,42,0.6)',
              borderRadius: 12,
              border: '1px solid rgba(71,85,105,0.35)'
            }}>
              {/* Tab Header with Language Selector - Requirements 19.1, 19.2, 19.3 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid rgba(71,85,105,0.35)',
                padding: '0 4px'
              }}>
                <button
                  onClick={() => setRightPanelTab('analysis')}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: rightPanelTab === 'analysis' ? '2px solid #38BDF8' : '2px solid transparent',
                    color: rightPanelTab === 'analysis' ? '#38BDF8' : '#94A3B8',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  📊 Phân tích
                </button>
                <button
                  onClick={() => setRightPanelTab('chat')}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: rightPanelTab === 'chat' ? '2px solid #38BDF8' : '2px solid transparent',
                    color: rightPanelTab === 'chat' ? '#38BDF8' : '#94A3B8',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  💬 Hỏi AI
                </button>
                
                {/* Language Selector - Requirements 19.1, 19.2, 19.3 */}
                <div style={{ padding: '8px 8px 8px 4px' }}>
                  <LanguageSelector
                    value={commentLanguage}
                    onChange={setCommentLanguage}
                    disabled={state.analyzing}
                  />
                </div>
              </div>

              {/* Tab Content */}
              {rightPanelTab === 'chat' ? (
                <div style={{ flex: 1, minHeight: 300 }}>
                  <Suspense fallback={<LoadingFallback height={300} />}>
                    <AIChatPanel
                      chatHistory={state.chatHistory}
                      loading={state.loadingChat}
                      disabled={!state.selectedMatchId}
                      analysisContext={{
                        mistakes: state.mistakes,
                        patterns: state.patterns,
                        bestMove: state.bestMove,
                        timeline: state.timeline
                      }}
                      onSendMessage={state.askQuestion}
                      onClearChat={state.clearChat}
                      matchId={state.selectedMatchId || undefined}
                      opponentUserId={reportTargetId || undefined}
                    />
                  </Suspense>
                </div>
              ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
              {/* Replay AI Panel - What-if mode controls */}
              {state.selectedMatchId && state.sequence.length > 0 && (
                <Suspense fallback={<LoadingFallback height={150} />}>
                  <ReplayAIPanel
                    mode={replayAI.mode}
                    difficulty={replayAI.difficulty}
                    canUndo={replayAI.canUndo}
                    loading={replayAI.loading}
                    aiThinking={replayAI.aiThinking}
                    disabled={!state.selectedMatchId}
                    onEnterWhatIf={handleEnterWhatIf}
                    onExitWhatIf={replayAI.exitWhatIfMode}
                    onUndo={replayAI.undoLastMove}
                    onDifficultyChange={replayAI.setDifficulty}
                  />
                </Suspense>
              )}

              {/* Comparison Panel - Show when in what-if mode */}
              {replayAI.mode === 'what_if' && replayAI.hasDivergence && (
                <Suspense fallback={<LoadingFallback height={200} />}>
                  <ComparisonPanel
                    originalWinProb={replayAI.originalWinProb}
                    currentWinProb={replayAI.currentWinProb}
                    divergencePoint={replayAI.divergencePoint}
                    comparisonColor={replayAI.comparisonColor}
                    explanation={replayAI.explanation}
                    onAnalyze={replayAI.getDivergenceAnalysis}
                  />
                </Suspense>
              )}

              {/* Personalized Insights - User Perspective */}
              {state.personalizedInsights && state.personalizedInsights.length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(99,102,241,0.15) 100%)',
                  borderRadius: 10,
                  padding: 12,
                  border: '1px solid rgba(56,189,248,0.3)'
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 10, color: '#38BDF8', fontSize: 14 }}>
                    🎯 Nhận định cho bạn
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {state.personalizedInsights.map((insight, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#E2E8F0' }}>
                        {insight}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Your Stats vs Opponent */}
              {state.yourStats && state.opponentStats && (
                <div style={{
                  background: 'rgba(30,41,59,0.5)',
                  borderRadius: 10,
                  padding: 12
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 10, color: '#F1F5F9', fontSize: 14 }}>
                    📊 So sánh với {state.opponentName || 'Đối thủ'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ 
                      background: 'rgba(56,189,248,0.12)', 
                      padding: 10, 
                      borderRadius: 8,
                      border: '1px solid rgba(56,189,248,0.3)'
                    }}>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Bạn</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#38BDF8' }}>
                        {state.yourStats.accuracy?.toFixed(0) || 0}%
                      </div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>Độ chính xác</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                        {state.yourStats.excellent_moves || 0} xuất sắc · {state.yourStats.mistakes || 0} sai lầm
                      </div>
                    </div>
                    <div style={{ 
                      background: 'rgba(239,68,68,0.12)', 
                      padding: 10, 
                      borderRadius: 8,
                      border: '1px solid rgba(239,68,68,0.3)'
                    }}>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{state.opponentName || 'Đối thủ'}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#F87171' }}>
                        {state.opponentStats.accuracy?.toFixed(0) || 0}%
                      </div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>Độ chính xác</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                        {state.opponentStats.excellent_moves || 0} xuất sắc · {state.opponentStats.mistakes || 0} sai lầm
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Analysis Summary */}
              <div style={{
                background: 'rgba(30,41,59,0.5)',
                borderRadius: 10,
                padding: 12
              }}>
                <div style={{ fontWeight: 600, marginBottom: 10, color: '#F1F5F9', fontSize: 14 }}>
                  📊 {t('aiAnalysis.analysisSummary')}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>
                  {state.mistakes.length} {t('aiAnalysis.mistakes')} · {state.patterns.length} patterns
                </div>

                {state.summary?.key_insights?.length > 0 && (
                  <div style={{
                    background: 'rgba(56,189,248,0.08)',
                    border: '1px solid rgba(56,189,248,0.25)',
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 10,
                    color: '#E2E8F0',
                    fontSize: 12
                  }}>
                    <div style={{ fontWeight: 600, color: '#38BDF8', marginBottom: 6 }}>3 điểm chính</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(state.summary.key_insights || []).slice(0, 3).map((insight, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <span style={{ color: '#38BDF8' }}>•</span>
                          <span>{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {state.aiInsights?.improvement_tips?.length > 0 && (
                  <div style={{
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 10,
                    color: '#FCD34D',
                    fontSize: 12
                  }}>
                    <div style={{ fontWeight: 600, color: '#FBBF24', marginBottom: 6 }}>Gợi ý cải thiện nhanh</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {state.aiInsights.improvement_tips.slice(0, 3).map((tip, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <span style={{ color: '#F59E0B' }}>•</span>
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Task 8.8.3: Opening Info */}
                {state.openingInfo && (
                  <div style={{
                    fontSize: 12,
                    background: 'rgba(99,102,241,0.12)',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid rgba(99,102,241,0.4)',
                    color: '#A5B4FC',
                    marginBottom: 10
                  }}>
                    <strong>📖 Khai cuộc:</strong> {state.openingInfo.name}
                    {state.openingInfo.description && (
                      <div style={{ marginTop: 4, opacity: 0.9 }}>{state.openingInfo.description}</div>
                    )}
                  </div>
                )}

                {/* Task 8.8.3: VCF Detection */}
                {state.hasVCF && state.vcfInfo && (
                  <div style={{
                    fontSize: 12,
                    background: 'rgba(239,68,68,0.12)',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid rgba(239,68,68,0.4)',
                    color: '#F87171',
                    marginBottom: 10
                  }}>
                    <strong>⚡ VCF phát hiện:</strong> ({state.vcfInfo.move.x + 1},{state.vcfInfo.move.y + 1})
                    <div style={{ marginTop: 4, opacity: 0.9 }}>{state.vcfInfo.description}</div>
                  </div>
                )}

                {/* Best Move */}
                {state.bestMove && (
                  <div style={{
                    fontSize: 12,
                    background: 'rgba(34,197,94,0.12)',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid rgba(34,197,94,0.4)',
                    color: '#22C55E',
                    marginBottom: 10
                  }}>
                    <strong>✨ {t('aiAnalysis.bestMove')}:</strong> ({state.bestMove.x + 1},{state.bestMove.y + 1})
                    <div style={{ marginTop: 4, opacity: 0.9 }}>{state.bestMove.reason}</div>
                  </div>
                )}
              </div>

              {/* Task 8.8.3: Missed Wins Section */}
              {state.missedWins && state.missedWins.length > 0 && (
                <div style={{
                  background: 'rgba(15,23,42,0.6)',
                  borderRadius: 12,
                  border: '1px solid rgba(71,85,105,0.35)',
                  padding: 14
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 10, color: '#F1F5F9', fontSize: 14 }}>
                    💔 Bỏ Lỡ Thắng
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {state.missedWins.map((mw, i) => (
                      <button
                        key={i}
                        onClick={() => state.setCurrentMove(mw.move - 1)}
                        style={{
                          textAlign: 'left',
                          fontSize: 12,
                          background: 'rgba(239,68,68,0.12)',
                          padding: 10,
                          borderRadius: 6,
                          border: '1px solid rgba(239,68,68,0.4)',
                          color: '#F87171',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          #{mw.move} · Bỏ lỡ VCF
                        </div>
                        <div style={{ marginTop: 4, opacity: 0.9 }}>{mw.description}</div>
                        <div style={{ marginTop: 4, fontSize: 11, color: '#22C55E' }}>
                          Nên chơi: ({mw.best_alternative.x + 1},{mw.best_alternative.y + 1})
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mistakes List */}
              {state.mistakes.length > 0 && (
                <div style={{
                  background: 'rgba(15,23,42,0.6)',
                  borderRadius: 12,
                  border: '1px solid rgba(71,85,105,0.35)',
                  padding: 14
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 10, color: '#F1F5F9', fontSize: 14 }}>
                    ⚠️ {t('aiAnalysis.mistakes')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {state.mistakes.map((mk, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          state.setCurrentMove(mk.move - 1)
                          // Show best alternative on board if available
                          if (mk.best_alternative) {
                            setSuggestedAlternative({ x: mk.best_alternative.x, y: mk.best_alternative.y })
                          } else {
                            setSuggestedAlternative(null)
                          }
                        }}
                        style={{
                          textAlign: 'left',
                          fontSize: 12,
                          background: mk.severity === 'critical' 
                            ? 'rgba(239,68,68,0.12)' 
                            : mk.severity === 'major'
                              ? 'rgba(249,115,22,0.12)'
                              : 'rgba(251,191,36,0.12)',
                          padding: 10,
                          borderRadius: 6,
                          border: `1px solid ${
                            mk.severity === 'critical' 
                              ? 'rgba(239,68,68,0.4)' 
                              : mk.severity === 'major'
                                ? 'rgba(249,115,22,0.4)'
                                : 'rgba(251,191,36,0.4)'
                          }`,
                          color: mk.severity === 'critical' 
                            ? '#EF4444' 
                            : mk.severity === 'major'
                              ? '#F97316'
                              : '#FBBF24',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          #{mk.move} · {mk.severity.toUpperCase()}
                        </div>
                        <div style={{ marginTop: 4, opacity: 0.9 }}>{mk.desc}</div>
                        {mk.best_alternative && (
                          <div style={{ marginTop: 6, fontSize: 11, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: '#10B981' }}>★</span>
                            Nên đi: ({mk.best_alternative.x}, {mk.best_alternative.y}) - Click để xem trên bàn cờ
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Patterns */}
              {state.patterns.length > 0 && (
                <div style={{
                  background: 'rgba(15,23,42,0.6)',
                  borderRadius: 12,
                  border: '1px solid rgba(71,85,105,0.35)',
                  padding: 14
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 10, color: '#F1F5F9', fontSize: 14 }}>
                    🎯 {t('aiAnalysis.patterns')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {state.patterns.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 12,
                          background: 'rgba(99,102,241,0.12)',
                          padding: 10,
                          borderRadius: 6,
                          border: '1px solid rgba(99,102,241,0.4)',
                          color: '#A5B4FC'
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{p.label}</div>
                        <div style={{ marginTop: 4, opacity: 0.9 }}>{p.explanation}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Move Quality (Evaluation Flow) */}
              {state.timeline.length > 0 && (
                <div style={{
                  background: 'rgba(15,23,42,0.6)',
                  borderRadius: 12,
                  border: '1px solid rgba(71,85,105,0.35)',
                  padding: 14
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 10, color: '#F1F5F9', fontSize: 14 }}>
                    📈 {t('aiAnalysis.moveQuality')}
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                    gap: 6
                  }}>
                    {state.timeline.slice(0, 20).map((entry, i) => (
                      <button
                        key={i}
                        onClick={() => state.setCurrentMove(entry.move - 1)}
                        style={{
                          textAlign: 'left',
                          fontSize: 11,
                          padding: 8,
                          borderRadius: 6,
                          background: state.currentMoveIndex === entry.move - 1
                            ? 'rgba(56,189,248,0.2)'
                            : 'rgba(51,65,85,0.5)',
                          border: state.currentMoveIndex === entry.move - 1
                            ? '1px solid rgba(56,189,248,0.5)'
                            : '1px solid rgba(71,85,105,0.35)',
                          cursor: 'pointer',
                          color: '#E2E8F0'
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>#{entry.move}</div>
                        <div style={{
                          color: entry.category === 'excellent' ? '#22C55E'
                            : entry.category === 'good' ? '#38BDF8'
                            : entry.category === 'okay' ? '#F59E0B'
                            : entry.category === 'weak' ? '#F97316'
                            : '#EF4444',
                          fontWeight: 700
                        }}>
                          {Math.round(entry.score)}
                        </div>
                        <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>
                          {entry.category}
                        </div>
                      </button>
                    ))}
                  </div>
                  {state.timeline.length > 20 && (
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 8, textAlign: 'center' }}>
                      +{state.timeline.length - 20} nước khác
                    </div>
                  )}
                </div>
              )}
              </div>
              )}
            </div>
          )}
            </div>
          </AnalysisErrorBoundary>
        </Suspense>

        {/* Mobile Panel with Tabs */}
        {isMobile && (
          <div style={{ marginTop: 16 }}>
            {/* Mobile Tab Header */}
            <div style={{
              display: 'flex',
              background: 'rgba(15,23,42,0.6)',
              borderRadius: '12px 12px 0 0',
              border: '1px solid rgba(71,85,105,0.35)',
              borderBottom: 'none'
            }}>
              <button
                onClick={() => setRightPanelTab('analysis')}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'none',
                  border: 'none',
                  borderBottom: rightPanelTab === 'analysis' ? '2px solid #38BDF8' : '2px solid transparent',
                  color: rightPanelTab === 'analysis' ? '#38BDF8' : '#94A3B8',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                📊 Phân tích
              </button>
              <button
                onClick={() => setRightPanelTab('chat')}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'none',
                  border: 'none',
                  borderBottom: rightPanelTab === 'chat' ? '2px solid #38BDF8' : '2px solid transparent',
                  color: rightPanelTab === 'chat' ? '#38BDF8' : '#94A3B8',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                💬 Hỏi AI
              </button>
              <button
                onClick={() => setRightPanelTab('online')}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'none',
                  border: 'none',
                  borderBottom: rightPanelTab === 'online' ? '2px solid #38BDF8' : '2px solid transparent',
                  color: rightPanelTab === 'online' ? '#38BDF8' : '#94A3B8',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                🟢 Online
              </button>
            </div>

            {/* Mobile Tab Content */}
            {rightPanelTab === 'online' ? (
              <div style={{ marginTop: 0 }}>
                {userId && (
                  <Suspense fallback={<LoadingFallback height={300} />}>
                    <OnlinePlayersPanel
                      currentUserId={userId}
                      onChallenge={(playerId) => console.log('Challenge:', playerId)}
                      onMessage={(playerId) => console.log('Message:', playerId)}
                      onViewProfile={(playerId) => { window.location.hash = `#profile?id=${playerId}` }}
                    />
                  </Suspense>
                )}
              </div>
            ) : rightPanelTab === 'chat' ? (
              <div style={{ height: 350 }}>
                <Suspense fallback={<LoadingFallback height={350} />}>
                  <AIChatPanel
                    chatHistory={state.chatHistory}
                    loading={state.loadingChat}
                    disabled={!state.selectedMatchId}
                    analysisContext={{
                      mistakes: state.mistakes,
                      patterns: state.patterns,
                      bestMove: state.bestMove,
                      timeline: state.timeline
                    }}
                    onSendMessage={state.askQuestion}
                    onClearChat={state.clearChat}
                    matchId={state.selectedMatchId || undefined}
                    opponentUserId={reportTargetId || undefined}
                  />
                </Suspense>
              </div>
            ) : state.timeline.length > 0 ? (
              <div style={{
                background: 'rgba(15,23,42,0.6)',
                borderRadius: '0 0 12px 12px',
                border: '1px solid rgba(71,85,105,0.35)',
                borderTop: 'none',
                padding: 14
              }}>
                <div style={{ fontWeight: 600, marginBottom: 8, color: '#F1F5F9', fontSize: 14 }}>
                  📊 {t('aiAnalysis.analysisSummary')}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  {state.mistakes.length} sai lầm · {state.patterns.length} patterns
                </div>
                {state.bestMove && (
                  <div style={{
                    marginTop: 8,
                    fontSize: 12,
                    background: 'rgba(34,197,94,0.12)',
                    padding: 8,
                    borderRadius: 6,
                    color: '#22C55E'
                  }}>
                    ✨ Nước tối ưu: ({state.bestMove.x + 1},{state.bestMove.y + 1})
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                background: 'rgba(15,23,42,0.6)',
                borderRadius: '0 0 12px 12px',
                border: '1px solid rgba(71,85,105,0.35)',
                borderTop: 'none',
                padding: 20,
                textAlign: 'center',
                color: '#64748B',
                fontSize: 13
              }}>
                Chọn trận đấu và phân tích để xem kết quả
              </div>
            )}
          </div>
        )}
      </div>

      {showReportModal && reportTargetId && state.selectedMatchId && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportedUserId={reportTargetId}
          matchId={state.selectedMatchId}
          onSuccess={() => setShowReportModal(false)}
        />
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1E293B, #0F172A)',
            borderRadius: 16,
            padding: 24,
            maxWidth: 400,
            width: '100%',
            border: '1px solid rgba(71,85,105,0.5)'
          }}>
            <h3 style={{ margin: '0 0 12px', color: '#F1F5F9' }}>
              ✨ Nâng cấp lên Pro
            </h3>
            <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 20 }}>
              Mở khóa phân tích AI nâng cao, replay mode, và AI Q&A để cải thiện kỹ năng chơi cờ của bạn.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowUpgradeModal(false)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(71,85,105,0.5)',
                  background: 'transparent',
                  color: '#94A3B8',
                  cursor: 'pointer'
                }}
              >
                Để sau
              </button>
              <button
                onClick={() => {
                  setShowUpgradeModal(false)
                  window.location.hash = '#subscription'
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Nâng cấp ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global styles for lazy loading spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
