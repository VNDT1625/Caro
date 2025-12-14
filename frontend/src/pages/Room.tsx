import React from 'react'
import { supabase } from '../lib/supabase'
import ChatPanel from '../components/chat/ChatPanel'
import { useLanguage } from '../contexts/LanguageContext'
import { ReportModal } from '../components/report'
import { useSwap2State } from '../hooks/useSwap2State'
import { useSocket } from '../hooks/useSocket'
import Swap2PhaseIndicator from '../components/swap2/Swap2PhaseIndicator'
import ColorChoiceModal from '../components/swap2/ColorChoiceModal'
import Swap2CompleteOverlay from '../components/swap2/Swap2CompleteOverlay'
import type { ColorAssignment, Swap2Choice } from '../types/swap2'
import { getEquippedTitle } from '../lib/titleApi'
import { useSkillSystem } from '../hooks/useSkillSystem'
import InGameSkillPanel from '../components/skill/InGameSkillPanel'
import SkillEffectOverlay from '../components/skill/SkillEffectOverlay'
import { useSkillApi, Skill } from '../lib/skillApi'
import { useRankedDisconnect } from '../hooks/useRankedDisconnect'
import { DisconnectOverlay, AutoWinResult } from '../components/series/DisconnectOverlay'

// Hook to detect mobile screen
const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

// Type alias for board cell
type BoardCell = null | 'X' | 'O' | 'BLOCKED' | string

export default function Room() {
  const { t } = useLanguage()
  
  // User & Room info
  const [user, setUser] = React.useState<any>(null)
  const [roomId, setRoomId] = React.useState<string | null>(null)
  const [matchId, setMatchId] = React.useState<string | null>(null)
  const [playerSymbol, setPlayerSymbol] = React.useState<'X' | 'O'>('X')
  const [opponentUserId, setOpponentUserId] = React.useState<string | null>(null)
  const opponentSymbol = playerSymbol === 'X' ? 'O' : 'X'
  
  // Swap2 state
  const [swap2Enabled, setSwap2Enabled] = React.useState(false)
  const [player1Id, setPlayer1Id] = React.useState<string | null>(null)
  const [player2Id, setPlayer2Id] = React.useState<string | null>(null)
  const [showSwap2Complete, setShowSwap2Complete] = React.useState(false)
  const [swap2ColorAssignment, setSwap2ColorAssignment] = React.useState<ColorAssignment | null>(null)
  
  // Ranked mode state (for disconnect handling)
  const [seriesId, setSeriesId] = React.useState<string | null>(null)
  const [roomMode, setRoomMode] = React.useState<string>('casual')
  const isRankedMode = roomMode === 'ranked' || roomMode === 'rank'
  
  // Game state
  const [currentTurn, setCurrentTurn] = React.useState<'X' | 'O'>('X')
  const [board, setBoard] = React.useState<(null | 'X' | 'O')[][]>(
    Array(15).fill(null).map(() => Array(15).fill(null))
  )
  const [timeLeft, setTimeLeft] = React.useState(30)
  const [opponentTimeLeft, setOpponentTimeLeft] = React.useState(30)
  const [totalTimeX, setTotalTimeX] = React.useState(300) // 5 minutes
  const [totalTimeO, setTotalTimeO] = React.useState(300)
  const [scores, setScores] = React.useState({ X: 0, O: 0 })
  const [currentGame, setCurrentGame] = React.useState(1)
  const [lastMovePosition, setLastMovePosition] = React.useState<{x: number, y: number} | null>(null)
  const [hoveredCell, setHoveredCell] = React.useState<{x: number, y: number} | null>(null)
  
  // Mobile detection and refs
  const isMobile = useIsMobile()
  const boardRef = React.useRef<HTMLDivElement>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [tapHighlight, setTapHighlight] = React.useState<{x: number, y: number} | null>(null)
  
  // Calculate board size to always be 1:1 square and fit screen
  const [boardPixelSize, setBoardPixelSize] = React.useState(480)
  
  React.useEffect(() => {
    const updateBoardSize = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      // Mobile: tính toán để board vừa màn hình, trừ header + player cards + score + padding
      const padding = isMobile ? 16 : 60
      const headerSpace = isMobile ? 180 : 280 // top bar + player cards
      const bottomSpace = isMobile ? 100 : 120 // score board + padding
      const availableHeight = vh - headerSpace - bottomSpace
      const availableWidth = vw - padding
      const maxSize = Math.min(availableWidth, availableHeight)
      // Mobile: cho phép board nhỏ hơn, desktop: giữ min 280
      const minSize = isMobile ? 240 : 280
      const maxAllowed = isMobile ? 400 : 520
      setBoardPixelSize(Math.max(minSize, Math.min(maxAllowed, maxSize)))
    }
    updateBoardSize()
    window.addEventListener('resize', updateBoardSize)
    return () => window.removeEventListener('resize', updateBoardSize)
  }, [isMobile])
  
  const cellSize = Math.floor(boardPixelSize / 15)
  const [showMoveInfo, setShowMoveInfo] = React.useState(false)
  const [moveHistory, setMoveHistory] = React.useState<Array<{x: number, y: number, player: 'X' | 'O', timestamp: number}>>([])
  const [totalMoveCount, setTotalMoveCount] = React.useState(0)
  const [gameWinner, setGameWinner] = React.useState<'X' | 'O' | 'draw' | null>(null)
  const [matchWinner, setMatchWinner] = React.useState<'X' | 'O' | null>(null)
  const [showGameResultPopup, setShowGameResultPopup] = React.useState(false)
  const [showReportModal, setShowReportModal] = React.useState(false)
  
  // Skill system state
  const [skillModeEnabled, setSkillModeEnabled] = React.useState(false)
  const [showSkillPanel, setShowSkillPanel] = React.useState(false)
  const [skillEffects, setSkillEffects] = React.useState<any[]>([])
  const [pendingSkillChanges, setPendingSkillChanges] = React.useState<any[]>([])
  
  const [opponent, setOpponent] = React.useState({
    name: '',
    rank: '',
    avatar: '🎭'
  })
  
  // Equipped titles
  const [myTitle, setMyTitle] = React.useState<any>(null)
  const [opponentTitle, setOpponentTitle] = React.useState<any>(null)

  // Refs to avoid stale closures in realtime handlers
  const userRef = React.useRef<any>(null)
  const playerSymbolRef = React.useRef<'X' | 'O'>('X')
  const scoresRef = React.useRef(scores)
  const moveHistoryRef = React.useRef(moveHistory)
  const gameWinnerRef = React.useRef(gameWinner)
  const matchWinnerRef = React.useRef(matchWinner)
  const processingMoveRef = React.useRef<string | null>(null)
  const currentTurnRef = React.useRef<'X' | 'O'>('X')
  const totalMoveCountRef = React.useRef(totalMoveCount)

  // Swap2 hook - handles socket communication for swap2 phase
  const handleSwap2Complete = React.useCallback((assignment: ColorAssignment) => {
    console.log('🎨 Swap2 complete, color assignment:', assignment)
    setSwap2ColorAssignment(assignment)
    setShowSwap2Complete(true)
    
    // Update player symbol based on assignment
    if (user?.id === assignment.blackPlayerId) {
      setPlayerSymbol('X')
      playerSymbolRef.current = 'X'
    } else if (user?.id === assignment.whitePlayerId) {
      setPlayerSymbol('O')
      playerSymbolRef.current = 'O'
    }
  }, [user?.id])

  const handleSwap2Error = React.useCallback((error: string) => {
    console.error('❌ Swap2 error:', error)
    // Could show toast notification here
  }, [])

  const {
    isSwap2Active,
    isSwap2Complete,
    currentPhase: swap2Phase,
    tentativeStones,
    activePlayerId,
    isCurrentUserActive,
    stonesPlaced,
    stonesRequired,
    placeStone: swap2PlaceStone,
    makeChoice: swap2MakeChoice,
    shouldShowChoiceModal,
    availableChoices,
    getPhaseDisplayInfo
  } = useSwap2State({
    roomId,
    userId: user?.id || null,
    player1Id,
    player2Id,
    enabled: swap2Enabled,
    onComplete: handleSwap2Complete,
    onError: handleSwap2Error
  })

  // Handle continuing to main game after swap2 complete overlay
  const handleContinueToMainGame = React.useCallback(() => {
    setShowSwap2Complete(false)
    // Board will be populated with tentative stones converted to actual moves
    if (tentativeStones.length > 0) {
      const newBoard = Array(15).fill(null).map(() => Array(15).fill(null))
      tentativeStones.forEach(stone => {
        // Pattern: 1,3,4 = Black(X), 2,5 = White(O)
        const isBlack = [1, 3, 4].includes(stone.placementOrder)
        newBoard[stone.y][stone.x] = isBlack ? 'X' : 'O'
      })
      setBoard(newBoard)
      setCurrentTurn('X') // Black always starts after swap2
    }
  }, [tentativeStones])

  // Load user and match data on mount
  React.useEffect(() => {
    let isMounted = true
    
    async function init() {
      await loadUserAndMatch(isMounted)
    }
    
    init()
    
    return () => {
      isMounted = false
    }
  }, [])

  React.useEffect(() => {
    scoresRef.current = scores
  }, [scores])

  React.useEffect(() => {
    moveHistoryRef.current = moveHistory
  }, [moveHistory])

  React.useEffect(() => {
    totalMoveCountRef.current = totalMoveCount
  }, [totalMoveCount])

  React.useEffect(() => {
    gameWinnerRef.current = gameWinner
  }, [gameWinner])

  React.useEffect(() => {
    matchWinnerRef.current = matchWinner
  }, [matchWinner])

  React.useEffect(() => {
    currentTurnRef.current = currentTurn
  }, [currentTurn])

  // Skill system hook
  const skillSystem = useSkillSystem({
    matchId: matchId || '',
    enabled: skillModeEnabled && !!matchId
  })

  // Ranked disconnect handling hook
  // Requirements: 3.1, 3.2, 3.3, 3.4 (ranked-disconnect-auto-win)
  const handleAutoWin = React.useCallback((result: AutoWinResult) => {
    console.log('🏆 Auto-win received:', result)
    // Could trigger victory screen or update game state
    if (result.seriesComplete) {
      setMatchWinner(result.winnerId === user?.id ? playerSymbol : opponentSymbol)
    } else {
      setGameWinner(result.winnerId === user?.id ? playerSymbol : opponentSymbol)
    }
    setShowGameResultPopup(true)
  }, [user?.id, playerSymbol, opponentSymbol])

  const handleOpponentReconnected = React.useCallback(() => {
    console.log('✅ Opponent reconnected, game continues')
    // Could show toast notification
  }, [])

  const { state: disconnectState, isOverlayVisible: showDisconnectOverlay } = useRankedDisconnect({
    roomId,
    seriesId,
    userId: user?.id || null,
    enabled: isRankedMode && !!roomId && !!seriesId,
    onAutoWin: handleAutoWin,
    onOpponentReconnected: handleOpponentReconnected
  })

  // Refresh skills when it's player's turn
  React.useEffect(() => {
    if (!skillModeEnabled || !matchId) return
    if (currentTurn !== playerSymbol) return
    if (gameWinner || matchWinner) return
    if (isSwap2Active) return // Don't show skills during swap2
    
    // Refresh skills for this turn
    const cooldownIds = Object.entries(skillSystem.cooldowns)
      .filter(([_, cd]) => cd > 0)
      .map(([id]) => id)
    
    skillSystem.refreshTurnSkills([])
    setShowSkillPanel(true)
  }, [currentTurn, playerSymbol, skillModeEnabled, matchId, gameWinner, matchWinner, isSwap2Active])

  // Handle using a skill
  const handleUseSkill = React.useCallback(async (skill: Skill, context?: Record<string, any>) => {
    if (!matchId || !user) return
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      
      const cooldownIds = Object.entries(skillSystem.cooldowns)
        .filter(([_, cd]) => cd > 0)
        .map(([id]) => id)
      
      // Convert board to API format
      const boardForApi = board.map(row => 
        row.map(cell => cell === 'X' ? 'black' : cell === 'O' ? 'white' : null)
      )
      
      const result = await useSkillApi(
        session.access_token,
        matchId,
        skill.id,
        boardForApi,
        {
          ...context,
          player_side: playerSymbol === 'X' ? 'black' : 'white',
          enemy_side: playerSymbol === 'X' ? 'white' : 'black',
          match_id: matchId
        },
        totalMoveCount + 1,
        cooldownIds
      )
      
      if (result.success) {
        // Apply board changes
        if (result.new_board_state) {
          const newBoard = result.new_board_state.map(row =>
            row.map(cell => cell === 'black' ? 'X' : cell === 'white' ? 'O' : cell === 'BLOCKED' ? 'BLOCKED' : null)
          )
          setBoard(newBoard as any)
        }
        
        // Apply visual effects
        if (result.changes && result.changes.length > 0) {
          setSkillEffects(result.changes)
          setPendingSkillChanges(result.changes)
          // Clear effects after animation
          setTimeout(() => {
            setSkillEffects([])
            setPendingSkillChanges([])
          }, 2000)
        }
        
        // Update skill system state
        skillSystem.useSkill(skill)
        setShowSkillPanel(false)
      } else {
        console.error('Skill use failed:', result.error || result.message)
      }
    } catch (err) {
      console.error('Error using skill:', err)
    }
  }, [matchId, user, board, playerSymbol, totalMoveCount, skillSystem])

  const handleSkipSkill = React.useCallback(() => {
    skillSystem.skipSkill()
    setShowSkillPanel(false)
  }, [skillSystem])

  async function loadUserAndMatch(isMounted: boolean = true) {
    try {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser || !isMounted) {
        if (!currentUser) console.error('No user logged in')
        if (!isMounted) console.log('Component unmounted, aborting load')
        if (!currentUser) window.location.hash = '#home'
        return
      }
      setUser(currentUser)
      userRef.current = currentUser
      
      // Load my equipped title
      getEquippedTitle(currentUser.id).then(setMyTitle)

      // Load match from localStorage
      const stored = localStorage.getItem('currentMatch')
      if (!stored || !isMounted) {
        if (!stored) console.error('No match data found')
        if (!isMounted) console.log('Component unmounted during load')
        if (!stored) window.location.hash = '#home'
        return
      }

      const match = JSON.parse(stored)
      if (!isMounted) return
      
      setRoomId(match.roomId)
      console.log('📍 Loading room:', match.roomId)

      // Get player side from room_players
      const { data: roomPlayer, error: rpError } = await supabase
        .from('room_players')
        .select('player_side, user_id')
        .eq('room_id', match.roomId)
        .eq('user_id', currentUser.id)
        .single()

      if (!isMounted) {
        console.log('Component unmounted after query')
        return
      }

      console.log('🔍 Room player query result:', { 
        roomId: match.roomId, 
        userId: currentUser.id,
        roomPlayer, 
        error: rpError 
      })

      if (rpError || !roomPlayer) {
        console.error('❌ Failed to get player side:', rpError)
        setPlayerSymbol('X') // Default
        playerSymbolRef.current = 'X'
      } else {
        console.log('✅ Setting player side to:', roomPlayer.player_side)
        setPlayerSymbol(roomPlayer.player_side as 'X' | 'O')
        playerSymbolRef.current = roomPlayer.player_side as 'X' | 'O'
        console.log('✅ Player symbol state updated to:', roomPlayer.player_side)
      }

      // Load opponent info
      if (match.opponent) {
        setOpponent({
          name: match.opponent.displayName || match.opponent.username || 'Đối thủ',
          rank: match.opponent.rank || 'Vô Danh',
          avatar: '🎭'
        })
        setOpponentUserId(match.opponent.id)
        setPlayer2Id(match.opponent.id)
        
        // Load opponent's equipped title
        getEquippedTitle(match.opponent.id).then(setOpponentTitle)
      }
      
      // Set player1Id (current user)
      setPlayer1Id(currentUser.id)

      // Load room info to check swap2_enabled
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('mode, game_state, game_config')
        .eq('id', match.roomId)
        .single()
      
      if (!roomError && roomData) {
        // Enable swap2 based on:
        // 1. Ranked mode: always enabled
        // 2. Other modes: check game_config.swap2_enabled
        const isRanked = roomData.mode === 'ranked' || roomData.mode === 'rank'
        const gameConfig = roomData.game_config as any
        const swap2FromConfig = gameConfig?.swap2_enabled ?? false
        const shouldEnableSwap2 = isRanked || swap2FromConfig
        
        setSwap2Enabled(shouldEnableSwap2)
        setRoomMode(roomData.mode || 'casual')
        console.log('🎮 Room mode:', roomData.mode, 'Swap2 enabled:', shouldEnableSwap2, '(config:', swap2FromConfig, ')')
        
        // Load seriesId for ranked mode disconnect handling
        // Requirements: 3.1 (ranked-disconnect-auto-win)
        if (isRanked && gameConfig?.series_id) {
          setSeriesId(gameConfig.series_id)
          console.log('🏆 Series ID loaded:', gameConfig.series_id)
        }
        
        // Enable skill mode if configured
        const skillModeFromConfig = gameConfig?.skill_mode ?? false
        const isSkillMode = roomData.mode === 'skill' || skillModeFromConfig
        setSkillModeEnabled(isSkillMode)
        console.log('🎮 Skill mode enabled:', isSkillMode)
        
        // If swap2 state exists in game_state, it will be loaded via socket
      }

      // Create match record if we have valid data
      if (roomPlayer) {
        const foundMatchId = await findMatchForRoom(match.roomId)
        console.log('📍 Match ID after finding:', foundMatchId)
        
        // Subscribe to realtime updates AFTER matchId is confirmed
        if (foundMatchId) {
          await hydrateBoardFromHistory(foundMatchId)
          subscribeToRealtime(match.roomId, foundMatchId)
        }
      }

    } catch (error) {
      console.error('Error loading match:', error)
    }
  }

  async function hydrateBoardFromHistory(currentMatchId: string) {
    try {
      console.log('📥 Loading existing moves for match:', currentMatchId)
      const { data: moves, error } = await supabase
        .from('moves')
        .select('position_x, position_y, turn_player, move_number, player_user_id, created_at')
        .eq('match_id', currentMatchId)
        .order('move_number', { ascending: true })

      if (error) {
        console.error('❌ Failed to load move history:', error)
        return
      }

      if (!moves || moves.length === 0) {
        console.log('ℹ️ No existing moves; keeping board reset')
        setBoard(Array.from({ length: 15 }, () => Array(15).fill(null)))
        setMoveHistory([])
        setLastMovePosition(null)
        setCurrentTurn('X')
        setTotalMoveCount(0)
        return
      }

      const hydratedBoard = Array.from({ length: 15 }, () => Array(15).fill(null))
      const hydratedHistory = moves.map(move => ({
        x: move.position_x,
        y: move.position_y,
        player: move.turn_player as 'X' | 'O',
        timestamp: move.created_at ? new Date(move.created_at).getTime() : Date.now()
      }))

      moves.forEach(move => {
        const { position_x: x, position_y: y, turn_player } = move
        if (typeof x === 'number' && typeof y === 'number' && hydratedBoard[y] && hydratedBoard[y][x] === null) {
          hydratedBoard[y][x] = turn_player
        }
      })

      const lastMove = moves[moves.length - 1]
      const nextTurn = lastMove.turn_player === 'X' ? 'O' : 'X'
      const lastMoveNumber = lastMove.move_number || moves.length

      setBoard(hydratedBoard)
      setMoveHistory(hydratedHistory)
      setLastMovePosition({ x: lastMove.position_x, y: lastMove.position_y })
      setCurrentTurn(nextTurn)
      setTimeLeft(30)
      setOpponentTimeLeft(30)
      setTotalMoveCount(lastMoveNumber)

      console.log('✅ Hydrated board with', moves.length, 'moves. Next turn:', nextTurn)
    } catch (error) {
      console.error('❌ Exception hydrating board:', error)
    }
  }

  function subscribeToRealtime(roomId: string, currentMatchId: string) {
    console.log('📡 Subscribing to room updates:', roomId)
    console.log('📡 Match ID for subscription:', currentMatchId)
    
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'moves'
          // Cannot filter by match_id in subscription, filter in handler
        },
        (payload) => {
          console.log('🔔 New move received:', payload)
          const move = payload.new as any
          console.log('Move details:', { 
            moveMatchId: move.match_id, 
            ourMatchId: currentMatchId,
            player: move.turn_player,
            position: `(${move.position_x}, ${move.position_y})`
          })
          
          // Only process if move is for our match
          if (move.match_id === currentMatchId) {
            console.log('✅ Processing move from opponent')
            handleOpponentMove(move)
          } else {
            console.log('⏭️ Ignoring move from different match')
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          console.log('🏆 Match updated:', payload)
          const match = payload.new as any
          
          let winnerSymbol: 'X' | 'O' | null = null
          
          // Prefer explicit 'winner' symbol if present
          if (match.winner) {
            console.log('🏁 Match winner (symbol) detected:', match.winner)
            winnerSymbol = match.winner
          }
          // Fallback: if only winner_user_id was written, derive symbol relative to current user
          else if (match.winner_user_id) {
            const myId = userRef.current?.id
            if (myId) {
              const winnerIsMe = match.winner_user_id === myId
              winnerSymbol = winnerIsMe ? playerSymbolRef.current : (playerSymbolRef.current === 'X' ? 'O' : 'X')
              console.log('🏁 Match winner derived from user id:', { winner_user_id: match.winner_user_id, derived: winnerSymbol })
            } else {
              console.log('🏁 Match winner_user_id present but current user unknown')
            }
          }
          
          // If we have a match winner, update all related states
          if (winnerSymbol) {
            setGameWinner(winnerSymbol)
            setMatchWinner(winnerSymbol)
            
            // Update scores to reflect the win (only if we haven't already counted it)
            setScores(prev => {
              const newScores = { ...prev }
              // Only increment if current score suggests we haven't counted this win yet
              // Since match winner requires >= 2, if matchWinner is set, ensure score is at least 2
              if (newScores[winnerSymbol] < 2) {
                newScores[winnerSymbol] = 2
              }
              return newScores
            })
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }

  async function recordMatchResult(
    winnerSymbol: 'X' | 'O',
    cause: 'move' | 'timeout' | 'surrender',
    totalMoves: number
  ) {
    if (!matchId) {
      console.warn('⚠️ No match ID when recording result')
      return
    }

    const winnerUserId = winnerSymbol === playerSymbolRef.current
      ? userRef.current?.id
      : opponentUserId

    if (!winnerUserId) {
      console.warn('⚠️ Missing winner user id when recording result')
    }

    const resultValue = winnerSymbol === 'X' ? 'win_x' : 'win_o'

    const { error } = await supabase
      .from('matches')
      .update({
        winner_user_id: winnerUserId,
        winner: winnerSymbol,
        result: resultValue,
        ended_at: new Date().toISOString(),
        total_moves: totalMoves
      })
      .eq('id', matchId)

    if (error) {
      console.error('❌ Failed to record match result:', error)
    } else {
      console.log('✅ Match result recorded:', { winnerSymbol, cause })
    }
  }

  async function concludeGame(
    winnerSymbol: 'X' | 'O',
    cause: 'move' | 'timeout' | 'surrender',
    options?: { shouldRecordMatch?: boolean, totalMoves?: number }
  ) {
    if (gameWinnerRef.current || matchWinnerRef.current) {
      console.log('⏭️ Game already concluded, skipping finalize')
      return
    }

    const shouldRecordMatch = options?.shouldRecordMatch ?? true
    const totalMoves = options?.totalMoves ?? totalMoveCountRef.current

    setGameWinner(winnerSymbol)
    gameWinnerRef.current = winnerSymbol
    
    // Hiển thị popup kết quả game
    setShowGameResultPopup(true)
    setTimeout(() => {
      setShowGameResultPopup(false)
    }, 3000)

    const updatedScores = { ...scoresRef.current }
    if (cause === 'move') {
      updatedScores[winnerSymbol] = (updatedScores[winnerSymbol] || 0) + 1
    } else {
      updatedScores[winnerSymbol] = Math.max(updatedScores[winnerSymbol] || 0, 2)
    }
    scoresRef.current = updatedScores
    setScores(updatedScores)

    const didMatchEnd = updatedScores[winnerSymbol] >= 2

    if (didMatchEnd) {
      setMatchWinner(winnerSymbol)
      matchWinnerRef.current = winnerSymbol
      if (shouldRecordMatch) {
        await recordMatchResult(winnerSymbol, cause, totalMoves)
      }
    } else if (cause === 'move') {
      setTimeout(() => resetGame(), 3000)
    }
  }

  function handleOpponentMove(move: any) {
    const x = move.position_x
    const y = move.position_y
    const player = move.turn_player
    const movePlayerId = move.player_user_id
    const moveKey = `${move.match_id}-${move.move_number || ''}-${x}-${y}-${player}`
    const incomingMoveNumber = move.move_number || totalMoveCountRef.current + 1

    console.log('🎮 Processing move from DB:', { 
      x, 
      y, 
      player, 
      movePlayerId,
      currentUserId: userRef.current?.id,
      playerSymbol: playerSymbolRef.current,
      isOurMove: movePlayerId === userRef.current?.id,
      moveKey
    })

    // Don't process our own moves (already updated locally)
    if (movePlayerId && userRef.current && movePlayerId === userRef.current.id) {
      console.log('⏭️ Skipping our own move (same user_id)')
      return
    }

    // Prevent duplicate processing
    if (processingMoveRef.current === moveKey) {
      console.log('⏭️ Already processing this move')
      return
    }
    processingMoveRef.current = moveKey

    // Validate coordinates
    if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || y < 0 || x >= 15 || y >= 15) {
      console.warn('⚠️ Invalid move coordinates, skipping', { x, y })
      processingMoveRef.current = null
      return
    }

    console.log('✅ This is opponent move, updating board...')

    if (incomingMoveNumber > totalMoveCountRef.current) {
      totalMoveCountRef.current = incomingMoveNumber
      setTotalMoveCount(incomingMoveNumber)
    }

    // Update board synchronously
    setBoard(prevBoard => {
      const newBoard = prevBoard.map(row => [...row])
      
      // Only update if the cell is still empty
      if (newBoard[y][x] !== null) {
        console.warn('⚠️ Cell already occupied', { x, y, currentVal: newBoard[y][x] })
        processingMoveRef.current = null
        return prevBoard
      }
      
      // Update the cell
      newBoard[y][x] = player
      
      // Check for winner immediately with updated board
      const winner = checkWinner(newBoard, x, y, player)
      
      // Use setTimeout to batch state updates
      setTimeout(() => {
        setLastMovePosition({ x, y })
        setMoveHistory(prev => [...prev, { x, y, player, timestamp: Date.now() }])
        setOpponentTimeLeft(30)
        
        if (winner) {
          console.log('🎉 Opponent won!', winner)
          void concludeGame(winner, 'move', {
            shouldRecordMatch: false,
            totalMoves: move.move_number || totalMoveCountRef.current
          })
        } else {
          // No winner - switch turn
          const nextTurn = player === 'X' ? 'O' : 'X'
          console.log('🔄 Turn:', player, '→', nextTurn)
          setCurrentTurn(nextTurn)
          
          // Advance skill system turn when opponent finishes
          if (skillModeEnabled) {
            skillSystem.nextTurn()
          }
        }
        
        processingMoveRef.current = null
        console.log('✅ Done processing opponent move')
      }, 0)
      
      return newBoard
    })
  }

  // Timer countdown
  React.useEffect(() => {
    if (gameWinner || matchWinner) return

    const interval = setInterval(() => {
      if (currentTurn === playerSymbol) {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimeout()
            return 0
          }
          return prev - 1
        })
        
        if (playerSymbol === 'X') {
          setTotalTimeX(prev => Math.max(0, prev - 1))
        } else {
          setTotalTimeO(prev => Math.max(0, prev - 1))
        }
      } else {
        setOpponentTimeLeft(prev => {
          if (prev <= 1) {
            return 30 // Reset for demo, in real game opponent handles their own timeout
          }
          return prev - 1
        })
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [currentTurn, playerSymbol, gameWinner, matchWinner])

  async function findMatchForRoom(roomId: string): Promise<string | null> {
    try {
      console.log('🔍 Finding match for room:', roomId)
      
      // Retry up to 10 times (5 seconds total)
      for (let attempt = 0; attempt < 10; attempt++) {
        const { data: match, error } = await supabase
          .from('matches')
          .select('id')
          .eq('room_id', roomId)
          .maybeSingle()
        
        if (error) {
          console.error('❌ Error finding match:', error)
        }
        
        if (match) {
          console.log('✅ Found match:', match.id)
          setMatchId(match.id)
          return match.id
        }

        if (attempt < 9) {
          console.log(`⏳ Match not found yet, retrying... (${attempt + 1}/10)`)
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      console.error('❌ Could not find match after retries')
      return null
    } catch (error) {
      console.error('❌ Exception in findMatchForRoom:', error)
      return null
    }
  }

  function handleTimeout() {
    if (gameWinnerRef.current || matchWinnerRef.current) return
    console.log('⏰ Timeout! Player', playerSymbol, 'loses')
    void concludeGame(opponentSymbol, 'timeout')
  }

  const getTimeColor = (time: number) => {
    if (time <= 10) return '#EF4444'
    if (time <= 20) return '#F59E0B'
    return '#10B981'
  }

  // Handle cell click
  const handleCellClick = async (x: number, y: number) => {
    console.log('🖱️ Cell clicked:', { x, y })
    console.log('📊 Current state:', { 
      matchId, 
      playerSymbol, 
      currentTurn, 
      currentTurnRef: currentTurnRef.current,
      isMyTurn: currentTurn === playerSymbol,
      cellEmpty: board[y][x] === null 
    })
    
    // Validation checks
    if (!matchId) {
      console.log('❌ No match ID')
      return
    }
    
    if (gameWinner || matchWinner) {
      console.log('❌ Game already ended')
      return
    }

    if (currentTurnRef.current !== playerSymbol) {
      console.log('❌ Not your turn. Current:', currentTurnRef.current, 'You are:', playerSymbol)
      return
    }

    if (board[y][x] !== null) {
      console.log('❌ Cell already occupied')
      return
    }

    console.log(`✅ Making move at (${x}, ${y})`)

    try {
      const projectedMoveCount = totalMoveCountRef.current + 1
      const moveKey = `${matchId}-${projectedMoveCount}-${x}-${y}-${playerSymbol}`
      
      // Mark as processing to prevent duplicate from realtime
      processingMoveRef.current = moveKey
      
      // Update local board immediately BEFORE inserting to DB
      const newBoard = board.map(row => [...row])
      newBoard[y][x] = playerSymbol
      setBoard(newBoard)
      setLastMovePosition({ x, y })
      
      const newMove = { x, y, player: playerSymbol, timestamp: Date.now() }
      setMoveHistory(prev => [...prev, newMove])

      // Reset timers
      setTimeLeft(30)
      setOpponentTimeLeft(30)

      // Check for winner BEFORE inserting to DB
      const winner = checkWinner(newBoard, x, y, playerSymbol)
      console.log('🎯 Winner check result:', winner)
      
      // Insert move to database
      const { error } = await supabase
        .from('moves')
        .insert({
          match_id: matchId,
          player_user_id: user.id,
          position_x: x,
          position_y: y,
          turn_player: playerSymbol,
          move_number: projectedMoveCount,
          is_winning_move: !!winner
        })

      if (error) {
        console.error('❌ Failed to insert move:', error)
        // Rollback local state
        setBoard(board)
        setMoveHistory(prev => prev.slice(0, -1))
        processingMoveRef.current = null
        return
      }

      totalMoveCountRef.current = projectedMoveCount
      setTotalMoveCount(projectedMoveCount)

      if (winner) {
        console.log('🎉 GAME WINNER DETECTED:', winner)
        await concludeGame(winner, 'move', { totalMoves: projectedMoveCount })
      } else {
        // Switch turn
        const nextTurn = opponentSymbol
        console.log('🔄 Switching turn:', playerSymbol, '→', nextTurn)
        setCurrentTurn(nextTurn)
        
        // Advance skill system turn (reduce cooldowns, regen mana)
        if (skillModeEnabled) {
          skillSystem.nextTurn()
        }
      }
      
      // Clear processing flag after a short delay
      setTimeout(() => {
        processingMoveRef.current = null
      }, 100)

    } catch (error) {
      console.error('❌ Error making move:', error)
      processingMoveRef.current = null
    }
  }

  function checkWinner(board: (null | 'X' | 'O')[][], lastX: number, lastY: number, player: 'X' | 'O'): 'X' | 'O' | null {
    console.log(`🔍 Checking winner for ${player} at (${lastX}, ${lastY})`)
    
    const directions = [
      [1, 0],   // horizontal
      [0, 1],   // vertical
      [1, 1],   // diagonal \
      [1, -1]   // diagonal /
    ]
    const dirNames = ['horizontal', 'vertical', 'diagonal \\', 'diagonal /']

    for (let i = 0; i < directions.length; i++) {
      const [dx, dy] = directions[i]
      let count = 1

      // Count in positive direction
      let x = lastX + dx
      let y = lastY + dy
      while (x >= 0 && x < 15 && y >= 0 && y < 15 && board[y][x] === player) {
        count++
        x += dx
        y += dy
      }

      // Count in negative direction
      x = lastX - dx
      y = lastY - dy
      while (x >= 0 && x < 15 && y >= 0 && y < 15 && board[y][x] === player) {
        count++
        x -= dx
        y -= dy
      }

      console.log(`  ${dirNames[i]}: ${count} in a row`)

      if (count >= 5) {
        console.log(`✅ WINNER FOUND! ${player} has ${count} in ${dirNames[i]}`)
        return player
      }
    }

    console.log(`  No winner detected (max < 5)`)
    return null
  }

  function resetGame() {
    setBoard(Array(15).fill(null).map(() => Array(15).fill(null)))
    setCurrentTurn('X')
    setTimeLeft(30)
    setOpponentTimeLeft(30)
    setLastMovePosition(null)
    setMoveHistory([])
    setGameWinner(null)
    setCurrentGame(prev => prev + 1)
  }

  const goBack = () => {
    window.location.hash = '#home'
  }

  const handleSurrender = () => {
    if (gameWinnerRef.current || matchWinnerRef.current) return
    if (confirm(t('room.confirmSurrender'))) {
      void concludeGame(opponentSymbol, 'surrender')
    }
  }

  const handleRequestDraw = () => {
    if (confirm(t('room.confirmDraw'))) {
      alert(t('room.drawSent'))
    }
  }
  
  const handleOpenReport = () => {
    if (!opponentUserId) {
      alert('Không tìm thấy thông tin đối thủ để báo cáo')
      return
    }
    setShowReportModal(true)
  }

  return (
    <div className="app-container" style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#fff'
    }}>
      {/* Top Bar */}
      <div className="match-top-bar" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: isMobile ? '10px 12px' : '16px 24px',
        background: 'rgba(15, 23, 42, 0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        position: 'relative',
        zIndex: 10,
        gap: isMobile ? '8px' : '16px',
        flexWrap: isMobile ? 'wrap' : 'nowrap'
      }}>
        <button className="back-btn" onClick={() => window.location.hash = '#home'} title={t('room.back')} style={{
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid #EF4444',
          color: '#EF4444',
          padding: isMobile ? '6px 10px' : '8px 16px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: isMobile ? '12px' : '14px',
          fontWeight: 600,
          whiteSpace: 'nowrap'
        }}>
          ← {isMobile ? '' : t('room.leaveMatch')}
        </button>

        {/* Center Title */}
        <div style={{
          fontSize: isMobile ? '14px' : '18px',
          fontWeight: 'bold',
          color: '#fff',
          textAlign: 'center',
          flex: isMobile ? '1 1 auto' : 'none',
          order: isMobile ? 1 : 0
        }}>
          🎮 {isMobile ? '' : t('room.matchTitle')}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: isMobile ? '4px' : '8px', alignItems: 'center' }}>
          <button className="action-btn" onClick={() => setShowMoveInfo(!showMoveInfo)} title={t('room.moveHistory')} style={{
            padding: isMobile ? '6px' : '8px',
            borderRadius: '6px',
            border: '1px solid rgba(34, 211, 238, 0.5)',
            background: 'rgba(34, 211, 238, 0.1)',
            color: '#22D3EE',
            cursor: 'pointer',
            fontSize: isMobile ? '14px' : '16px',
            width: isMobile ? '32px' : '36px',
            height: isMobile ? '32px' : '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}>
            📜
          </button>
          <button
            className="action-btn"
            onClick={handleOpenReport}
            disabled={!opponentUserId}
            title={t('report.buttonTitle') || 'Báo cáo vi phạm'}
            style={{
              padding: isMobile ? '6px' : '8px',
              borderRadius: '6px',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#EF4444',
              cursor: opponentUserId ? 'pointer' : 'not-allowed',
              fontSize: isMobile ? '14px' : '16px',
              width: isMobile ? '32px' : '36px',
              height: isMobile ? '32px' : '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              opacity: opponentUserId ? 1 : 0.5
            }}>
            ⚠️
          </button>
          <button className="action-btn" onClick={handleRequestDraw} title={t('room.requestDraw')} style={{
            padding: isMobile ? '6px' : '8px',
            borderRadius: '6px',
            border: '1px solid rgba(251, 191, 36, 0.5)',
            background: 'rgba(251, 191, 36, 0.1)',
            color: '#F59E0B',
            cursor: 'pointer',
            fontSize: isMobile ? '14px' : '16px',
            width: isMobile ? '32px' : '36px',
            height: isMobile ? '32px' : '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}>
            🤝
          </button>
          <button className="action-btn danger" onClick={handleSurrender} title={t('room.surrender')} style={{
            padding: isMobile ? '6px' : '8px',
            borderRadius: '6px',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#EF4444',
            cursor: 'pointer',
            fontSize: isMobile ? '14px' : '16px',
            width: isMobile ? '32px' : '36px',
            height: isMobile ? '32px' : '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}>
            🏳️
          </button>
        </div>
      </div>

      {/* Player Cards - Above Board */}
      <div className="match-players-info" style={{
        display: 'flex',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? '8px' : '40px',
        justifyContent: 'center',
        padding: isMobile ? '10px 8px' : '20px 24px',
        background: 'rgba(15, 23, 42, 0.5)',
        flexDirection: isMobile ? 'column' : 'row'
      }}>
        {/* Mobile: Compact row with both players */}
        {isMobile ? (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'stretch' }}>
            {/* Player X Compact */}
            <div style={{ 
              flex: 1,
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '10px 12px',
              background: 'rgba(34, 211, 238, 0.1)',
              borderRadius: '10px',
              border: currentTurn === 'X' ? '2px solid #22D3EE' : '2px solid rgba(255,255,255,0.1)',
              maxWidth: '48%'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #22D3EE, #06B6D4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 'bold',
                color: 'white',
                flexShrink: 0
              }}>X</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {playerSymbol === 'X' ? t('room.you') : (opponent.name || t('room.opponent'))}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                  <span style={{ color: getTimeColor(playerSymbol === 'X' ? timeLeft : opponentTimeLeft), fontSize: '11px', fontWeight: 600 }}>
                    ⏱️{playerSymbol === 'X' ? timeLeft : opponentTimeLeft}s
                  </span>
                  <span style={{ fontSize: '10px', color: '#888' }}>
                    {Math.floor(totalTimeX / 60)}:{(totalTimeX % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            </div>
            
            {/* VS */}
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: 'bold', color: '#666' }}>VS</div>
            
            {/* Player O Compact */}
            <div style={{ 
              flex: 1,
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '10px 12px',
              background: 'rgba(251, 191, 36, 0.1)',
              borderRadius: '10px',
              border: currentTurn === 'O' ? '2px solid #F59E0B' : '2px solid rgba(255,255,255,0.1)',
              maxWidth: '48%'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 'bold',
                color: 'white',
                flexShrink: 0
              }}>O</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {playerSymbol === 'O' ? t('room.you') : (opponent.name || t('room.opponent'))}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                  <span style={{ color: getTimeColor(playerSymbol === 'O' ? timeLeft : opponentTimeLeft), fontSize: '11px', fontWeight: 600 }}>
                    ⏱️{playerSymbol === 'O' ? timeLeft : opponentTimeLeft}s
                  </span>
                  <span style={{ fontSize: '10px', color: '#888' }}>
                    {Math.floor(totalTimeO / 60)}:{(totalTimeO % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop: Full player cards */}
            {/* Player X Info */}
            <div className="player-card" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              padding: '16px 20px',
              background: 'rgba(34, 211, 238, 0.1)',
              borderRadius: '12px',
              border: currentTurn === 'X' ? '2px solid #22D3EE' : '2px solid rgba(255,255,255,0.1)',
              minWidth: '280px'
            }}>
              <div className="player-avatar" style={{ 
                width: '56px', 
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                border: '2px solid #22D3EE'
              }}>
                {playerSymbol === 'X' ? '👤' : opponent.avatar}
              </div>
              <div className="player-details" style={{ flex: 1 }}>
                <div className="player-name" style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
                  {playerSymbol === 'X' ? t('room.you') : (opponent.name || t('room.opponent'))}
                </div>
                <div className="player-rank" style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                  {playerSymbol === 'X' ? t('room.rankUnknown') : (opponent.rank || t('room.rankUnknown'))}
                </div>
                {(playerSymbol === 'X' ? myTitle?.titles : opponentTitle?.titles) && (
                  <div style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 4, 
                    padding: '2px 8px', 
                    borderRadius: 4,
                    background: `${(playerSymbol === 'X' ? myTitle?.titles : opponentTitle?.titles)?.color}20`,
                    marginBottom: '4px',
                    fontSize: '10px'
                  }}>
                    <span>{(playerSymbol === 'X' ? myTitle?.titles : opponentTitle?.titles)?.icon}</span>
                    <span style={{ color: (playerSymbol === 'X' ? myTitle?.titles : opponentTitle?.titles)?.color, fontWeight: 600 }}>
                      {(playerSymbol === 'X' ? myTitle?.titles : opponentTitle?.titles)?.name_vi}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ color: getTimeColor(playerSymbol === 'X' ? timeLeft : opponentTimeLeft), fontSize: '13px', fontWeight: 600 }}>
                    ⏱️ {playerSymbol === 'X' ? timeLeft : opponentTimeLeft}s
                  </div>
                  <div style={{ fontSize: '11px', color: totalTimeX < 60 ? '#EF4444' : '#888', fontWeight: 500 }}>
                    🕐 {Math.floor(totalTimeX / 60)}:{(totalTimeX % 60).toString().padStart(2, '0')}
                  </div>
                </div>
              </div>
              <div className="player-symbol" style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #22D3EE, #06B6D4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 'bold',
                color: 'white',
                boxShadow: '0 4px 12px rgba(34, 211, 238, 0.4)'
              }}>X</div>
            </div>

            {/* VS Divider */}
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#666',
              textShadow: '0 0 10px rgba(255,255,255,0.3)',
              padding: '0 8px'
            }}>VS</div>

            {/* Player O Info */}
            <div className="player-card" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              padding: '16px 20px',
              background: 'rgba(251, 191, 36, 0.1)',
              borderRadius: '12px',
              border: currentTurn === 'O' ? '2px solid #F59E0B' : '2px solid rgba(255,255,255,0.1)',
              minWidth: '280px'
            }}>
              <div className="player-avatar" style={{ 
                width: '56px', 
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                border: '2px solid #F59E0B'
              }}>
                {playerSymbol === 'O' ? '👤' : opponent.avatar}
              </div>
              <div className="player-details" style={{ flex: 1 }}>
                <div className="player-name" style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
                  {playerSymbol === 'O' ? t('room.you') : (opponent.name || t('room.opponent'))}
                </div>
                <div className="player-rank" style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                  {playerSymbol === 'O' ? t('room.rankUnknown') : (opponent.rank || t('room.rankUnknown'))}
                </div>
                {(playerSymbol === 'O' ? myTitle?.titles : opponentTitle?.titles) && (
                  <div style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 4, 
                    padding: '2px 8px', 
                    borderRadius: 4,
                    background: `${(playerSymbol === 'O' ? myTitle?.titles : opponentTitle?.titles)?.color}20`,
                    marginBottom: '4px',
                    fontSize: '10px'
                  }}>
                    <span>{(playerSymbol === 'O' ? myTitle?.titles : opponentTitle?.titles)?.icon}</span>
                    <span style={{ color: (playerSymbol === 'O' ? myTitle?.titles : opponentTitle?.titles)?.color, fontWeight: 600 }}>
                      {(playerSymbol === 'O' ? myTitle?.titles : opponentTitle?.titles)?.name_vi}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ color: getTimeColor(playerSymbol === 'O' ? timeLeft : opponentTimeLeft), fontSize: '13px', fontWeight: 600 }}>
                    ⏱️ {playerSymbol === 'O' ? timeLeft : opponentTimeLeft}s
                  </div>
                  <div style={{ fontSize: '11px', color: totalTimeO < 60 ? '#EF4444' : '#888', fontWeight: 500 }}>
                    🕐 {Math.floor(totalTimeO / 60)}:{(totalTimeO % 60).toString().padStart(2, '0')}
                  </div>
                </div>
              </div>
              <div className="player-symbol" style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 'bold',
                color: 'white',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)'
              }}>O</div>
            </div>
          </>
        )}
      </div>

      {/* Main Game Area */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        padding: isMobile ? '10px 8px' : '20px',
        gap: isMobile ? '10px' : '20px',
        flexDirection: isMobile ? 'column' : 'row'
      }}>
        {/* Move History Sidebar */}
        {showMoveInfo && (
          <div style={{
            width: isMobile ? '100%' : '250px',
            background: 'rgba(15, 23, 42, 0.8)',
            borderRadius: '12px',
            padding: isMobile ? '12px' : '16px',
            border: '1px solid rgba(255,255,255,0.1)',
            order: isMobile ? 2 : 0
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: isMobile ? '14px' : '16px' }}>Lịch sử nước đi</h3>
              <button onClick={() => setShowMoveInfo(false)} style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: '18px'
              }}>✕</button>
            </div>
            <div style={{ maxHeight: isMobile ? '150px' : '400px', overflowY: 'auto' }}>
              {moveHistory.length === 0 ? (
                <div style={{ color: '#666', fontSize: isMobile ? '12px' : '14px', textAlign: 'center', padding: isMobile ? '12px' : '20px' }}>
                  Chưa có nước đi nào
                </div>
              ) : (
                <div style={{ display: isMobile ? 'flex' : 'block', flexWrap: 'wrap', gap: isMobile ? '4px' : '0' }}>
                  {moveHistory.map((move, index) => (
                    <div key={index} style={{
                      padding: isMobile ? '4px 8px' : '8px',
                      background: move.player === playerSymbol ? 'rgba(34, 211, 238, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                      borderRadius: '6px',
                      marginBottom: isMobile ? 0 : '6px',
                      fontSize: isMobile ? '11px' : '13px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{ fontWeight: 'bold' }}>#{index + 1}</span>
                      <span style={{ color: move.player === 'X' ? '#22D3EE' : '#F59E0B' }}>
                        {move.player}
                      </span>
                      <span style={{ color: '#888' }}>
                        ({move.x},{move.y})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Game Board with Swap2 Support */}
        <div style={{ 
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          width: isMobile ? '100%' : 'auto'
        }}>
          {/* Swap2 Phase Indicator */}
          {isSwap2Active && swap2Phase && swap2Phase !== 'complete' && (
            <div style={{
              position: 'absolute',
              top: '-70px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 100
            }}>
              <Swap2PhaseIndicator
                phase={swap2Phase}
                activePlayerName={activePlayerId === user?.id ? t('room.you') : opponent.name}
                isCurrentUserActive={isCurrentUserActive}
                stonesPlaced={stonesPlaced}
                stonesRequired={stonesRequired}
              />
            </div>
          )}

          <div style={{
            display: isMobile ? 'flex' : 'inline-block',
            justifyContent: 'center',
            background: 'rgba(30, 41, 59, 0.8)',
            padding: isMobile ? '4px' : '20px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            width: isMobile ? '100%' : undefined,
            maxWidth: isMobile ? '100%' : undefined
          }}>
            {/* Board Grid - Mobile responsive */}
            <div
              ref={isMobile ? scrollContainerRef : undefined}
              style={{
                display: 'flex',
                justifyContent: 'center',
                overflow: isMobile ? 'hidden' : 'visible',
                borderRadius: '4px'
              }}
            >
            <div 
              ref={boardRef}
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(15, ${cellSize}px)`,
                gridTemplateRows: `repeat(15, ${cellSize}px)`,
                background: 'linear-gradient(135deg, #d4a574, #c49563)',
                borderRadius: '4px',
                width: `${cellSize * 15}px`,
                height: `${cellSize * 15}px`,
                position: 'relative'
              }}>
              {/* Grid lines overlay - cell borders style */}
              <div style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 1
              }}>
                <svg width="100%" height="100%" style={{ position: 'absolute' }}>
                  {/* Vertical lines - cell borders */}
                  {Array.from({ length: 16 }).map((_, i) => (
                    <line
                      key={`v${i}`}
                      x1={`${i * (100 / 15)}%`}
                      y1="0%"
                      x2={`${i * (100 / 15)}%`}
                      y2="100%"
                      stroke="#8b6f47"
                      strokeWidth="1"
                    />
                  ))}
                  {/* Horizontal lines - cell borders */}
                  {Array.from({ length: 16 }).map((_, i) => (
                    <line
                      key={`h${i}`}
                      x1="0%"
                      y1={`${i * (100 / 15)}%`}
                      x2="100%"
                      y2={`${i * (100 / 15)}%`}
                      stroke="#8b6f47"
                      strokeWidth="1"
                    />
                  ))}
                  {/* Star points - at cell centers */}
                  {[[3,3],[3,11],[11,3],[11,11],[7,7],[3,7],[11,7],[7,3],[7,11]].map(([sx, sy]) => (
                    <circle
                      key={`star${sx}${sy}`}
                      cx={`${(sx + 0.5) * (100 / 15)}%`}
                      cy={`${(sy + 0.5) * (100 / 15)}%`}
                      r="3"
                      fill="#8b6f47"
                    />
                  ))}
                </svg>
              </div>
              {board.map((row, y) => (
                row.map((cell, x) => {
                  const isLastMove = lastMovePosition?.x === x && lastMovePosition?.y === y
                  const isHovered = hoveredCell?.x === x && hoveredCell?.y === y
                  
                  // Check for tentative stone during swap2
                  const tentativeStone = tentativeStones.find(s => s.x === x && s.y === y)
                  const hasTentativeStone = !!tentativeStone
                  const latestOrder = tentativeStones.length > 0 
                    ? Math.max(...tentativeStones.map(s => s.placementOrder)) 
                    : 0
                  const isLatestTentative = tentativeStone?.placementOrder === latestOrder
                  
                  // During swap2, can click empty cells in placement phases
                  const canClickSwap2 = isSwap2Active && isCurrentUserActive &&
                    (swap2Phase === 'swap2_placement' || swap2Phase === 'swap2_extra') &&
                    !hasTentativeStone && !cell
                  
                  const canClickNormal = !isSwap2Active && !gameWinner && !matchWinner && 
                    currentTurn === playerSymbol && !cell
                  
                  const canClick = canClickSwap2 || canClickNormal
                  
                  // Handle click - either swap2 or normal move
                  const handleClick = () => {
                    if (canClickSwap2) {
                      swap2PlaceStone(x, y)
                    } else if (canClickNormal) {
                      handleCellClick(x, y)
                    }
                  }
                  
                  return (
                    <div
                      key={`${x}-${y}`}
                      onClick={handleClick}
                      onMouseEnter={() => setHoveredCell({x, y})}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        width: `${cellSize}px`,
                        height: `${cellSize}px`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: canClick ? 'pointer' : 'default',
                        fontSize: isMobile ? '14px' : '18px',
                        fontWeight: 'bold',
                        transition: 'all 0.15s',
                        color: cell === 'X' ? '#22D3EE' : '#F59E0B',
                        opacity: isHovered && canClick ? 0.7 : 1,
                        position: 'relative',
                        zIndex: 2
                      }}
                    >
                      {/* Last move highlight */}
                      {isLastMove && (
                        <div style={{
                          position: 'absolute',
                          inset: 2,
                          background: 'rgba(34, 197, 94, 0.3)',
                          borderRadius: 4,
                          pointerEvents: 'none'
                        }} />
                      )}
                      
                      {/* Latest tentative highlight */}
                      {isLatestTentative && (
                        <div style={{
                          position: 'absolute',
                          inset: 2,
                          background: 'rgba(168, 85, 247, 0.25)',
                          borderRadius: 4,
                          pointerEvents: 'none'
                        }} />
                      )}
                      
                      {/* Tentative stone during swap2 */}
                      {hasTentativeStone && tentativeStone && (
                        <div style={{
                          width: `${cellSize * 0.75}px`,
                          height: `${cellSize * 0.75}px`,
                          borderRadius: '50%',
                          background: [1, 3, 4].includes(tentativeStone.placementOrder)
                            ? 'radial-gradient(circle at 35% 35%, #666, #000)'
                            : 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
                          border: isLatestTentative 
                            ? '2px solid #A855F7' 
                            : '2px dashed rgba(148, 163, 184, 0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: isMobile ? '8px' : '10px',
                          fontWeight: 700,
                          color: [1, 3, 4].includes(tentativeStone.placementOrder)
                            ? 'rgba(255,255,255,0.7)'
                            : 'rgba(0,0,0,0.5)'
                        }}>
                          {tentativeStone.placementOrder}
                        </div>
                      )}
                      
                      {/* Normal stone */}
                      {cell && !hasTentativeStone && (
                        <div style={{
                          width: `${cellSize * 0.75}px`,
                          height: `${cellSize * 0.75}px`,
                          borderRadius: '50%',
                          background: cell === 'X'
                            ? 'radial-gradient(circle at 35% 35%, #666, #000)'
                            : 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
                          boxShadow: cell === 'X'
                            ? '0 2px 4px rgba(0,0,0,0.6)'
                            : '0 2px 4px rgba(0,0,0,0.3)',
                          border: isLastMove ? `2px solid ${cell === 'X' ? '#3b82f6' : '#ef4444'}` : 'none'
                        }} />
                      )}
                      
                      {/* Hover preview */}
                      {!cell && !hasTentativeStone && isHovered && canClick && (
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: isSwap2Active
                            ? 'rgba(168, 85, 247, 0.4)'
                            : currentTurn === 'X'
                            ? 'rgba(0,0,0,0.3)'
                            : 'rgba(255,255,255,0.3)',
                          border: '2px dashed rgba(148, 163, 184, 0.5)'
                        }} />
                      )}
                    </div>
                  )
                })
              ))}
            </div>
            </div>
          </div>

          {/* Color Choice Modal during swap2 */}
          {shouldShowChoiceModal && swap2Phase && (swap2Phase === 'swap2_choice' || swap2Phase === 'swap2_final_choice') && (
            <ColorChoiceModal
              phase={swap2Phase}
              onChoice={(choice: Swap2Choice) => swap2MakeChoice(choice)}
              tentativeStones={tentativeStones}
              disabled={!isCurrentUserActive}
            />
          )}

          {/* Swap2 Complete Overlay */}
          {showSwap2Complete && swap2ColorAssignment && user?.id && (
            <Swap2CompleteOverlay
              colorAssignment={swap2ColorAssignment}
              player1Name={t('room.you')}
              player2Name={opponent.name || t('room.opponent')}
              currentUserId={user.id}
              onContinue={handleContinueToMainGame}
              autoCloseDelay={5000}
            />
          )}
        </div>

        {/* Right sidebar - Chat & Skills */}
        <div style={{ 
          width: isMobile ? '100%' : '300px', 
          flexShrink: 0, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: isMobile ? '8px' : '12px',
          order: isMobile ? 3 : 0
        }}>
          {/* Skill Panel - hiển thị khi skill mode enabled và đến lượt player */}
          {skillModeEnabled && showSkillPanel && skillSystem.turnSkills.length > 0 && (
            <InGameSkillPanel
              skills={skillSystem.turnSkills}
              cooldowns={skillSystem.cooldowns}
              timeLimit={15}
              disabled={currentTurn !== playerSymbol || !!gameWinner || !!matchWinner}
              mana={skillSystem.mana}
              disabledMap={skillSystem.disabled}
              board={board.map(row => row.map(cell => cell === 'X' ? 'black' : cell === 'O' ? 'white' : cell))}
              playerSide={playerSymbol === 'X' ? 'black' : 'white'}
              enemySide={playerSymbol === 'X' ? 'white' : 'black'}
              onUseSkill={handleUseSkill}
              onSkip={handleSkipSkill}
            />
          )}
          
          {/* Mana display khi skill mode enabled */}
          {skillModeEnabled && (
            <div style={{
              background: 'rgba(15,23,42,0.9)',
              borderRadius: isMobile ? 8 : 12,
              padding: isMobile ? '8px 12px' : '12px 16px',
              border: '1px solid rgba(59,130,246,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ color: '#94A3B8', fontSize: isMobile ? 12 : 13 }}>💧 Mana</span>
              <span style={{ 
                color: '#60A5FA', 
                fontWeight: 700, 
                fontSize: isMobile ? 16 : 18 
              }}>{skillSystem.mana}/15</span>
            </div>
          )}
          
          {/* Chat - ẩn trên mobile hoặc hiển thị compact */}
          {!isMobile && (
            <ChatPanel
              mode="room"
              variant="room"
              userId={user?.id}
              displayName={user?.user_metadata?.name || user?.email || 'Bạn'}
              roomId={roomId}
              enabled={Boolean(roomId)}
            />
          )}
        </div>
      </div>
      
      {/* Skill Effect Overlay - hiển thị hiệu ứng skill trên bàn cờ */}
      {skillModeEnabled && skillEffects.length > 0 && (
        <SkillEffectOverlay
          effects={skillEffects}
          cellSize={32}
          boardOffset={{ x: 0, y: 0 }}
        />
      )}

      {/* Score Board */}
      <div style={{
        textAlign: 'center',
        padding: isMobile ? '10px' : '20px',
        fontSize: isMobile ? '16px' : '20px',
        fontWeight: 'bold'
      }}>
        <div style={{
          display: 'inline-block',
          background: 'rgba(15, 23, 42, 0.8)',
          padding: isMobile ? '10px 20px' : '16px 32px',
          borderRadius: isMobile ? '8px' : '12px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span style={{ color: '#22D3EE' }}>X: {scores.X}</span>
          <span style={{ margin: isMobile ? '0 12px' : '0 20px', color: '#666' }}>-</span>
          <span style={{ color: '#F59E0B' }}>O: {scores.O}</span>
          <div style={{ fontSize: isMobile ? '12px' : '14px', color: '#888', marginTop: isMobile ? '4px' : '8px' }}>
            Ván {currentGame}/3
          </div>
        </div>
      </div>
      {/* Game Result Popup (3s auto-hide) */}
      {showGameResultPopup && gameWinner && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 2000,
          animation: 'slideDown 0.3s ease-out',
          width: isMobile ? '90%' : 'auto',
          maxWidth: isMobile ? '320px' : '400px'
        }}>
          <div style={{
            background: gameWinner === playerSymbol 
              ? 'linear-gradient(135deg, #10b981, #059669)' 
              : 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: '#fff',
            padding: isMobile ? '20px 24px' : '32px 48px',
            borderRadius: isMobile ? '12px' : '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            textAlign: 'center',
            border: '3px solid rgba(255,255,255,0.3)'
          }}>
            <div style={{ fontSize: isMobile ? '36px' : '48px', marginBottom: isMobile ? '8px' : '12px' }}>
              {gameWinner === playerSymbol ? '🎉' : '😢'}
            </div>
            <h2 style={{ 
              margin: '0 0 8px 0', 
              fontSize: isMobile ? '24px' : '32px',
              fontWeight: 'bold',
              textShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>  
              {gameWinner === playerSymbol ? t('room.youWin') : t('room.youLose')}
            </h2>
            <p style={{ 
              margin: '8px 0 0 0', 
              fontSize: isMobile ? '14px' : '18px',
              opacity: 0.95
            }}>
              {t('room.playerWonGame', { player: gameWinner })}
            </p>
            <div style={{
              marginTop: isMobile ? '10px' : '16px',
              fontSize: isMobile ? '12px' : '14px',
              opacity: 0.8
            }}>
              {t('room.currentScore')}: X <strong>{scores.X}</strong> - <strong>{scores.O}</strong> O
            </div>
          </div>
        </div>
      )}

      {/* Match result modal */}
      {matchWinner && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: isMobile ? '16px' : 0
        }}>
          <div style={{
            background: '#0b1220',
            color: '#fff',
            padding: isMobile ? '16px' : '24px',
            borderRadius: '12px',
            width: isMobile ? '100%' : 'auto',
            maxWidth: isMobile ? '340px' : '400px',
            textAlign: 'center',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)'
          }}>
            <h2 style={{ margin: 0, marginBottom: '8px', fontSize: isMobile ? '20px' : '24px' }}>{matchWinner === playerSymbol ? t('room.matchWin') : t('room.matchLose')}</h2>
            <p style={{ margin: '8px 0 16px', fontSize: isMobile ? '14px' : '16px' }}>{t('room.winner')}: <strong>{matchWinner}</strong></p>
            <p style={{ margin: '8px 0 16px', fontSize: isMobile ? '14px' : '16px' }}>{t('room.score')} — X: <strong>{scores.X}</strong> &nbsp; - &nbsp; O: <strong>{scores.O}</strong></p>
            <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => { window.location.hash = '#home' }} style={{ padding: isMobile ? '8px 10px' : '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: isMobile ? '12px' : '14px' }}>{t('room.backHome')}</button>
              <button onClick={() => { setMatchWinner(null); resetGame(); setScores({ X: 0, O: 0 }); }} style={{ padding: isMobile ? '8px 10px' : '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: isMobile ? '12px' : '14px' }}>{t('room.playAgain')}</button>
              {matchId && (
                <button 
                  onClick={() => {
                    localStorage.setItem('analysisMatchId', matchId)
                    localStorage.setItem('analysisMatchData', JSON.stringify({
                      matchId,
                      moves: moveHistory,
                      playerSymbol,
                      opponentName: opponent.name,
                      result: matchWinner === playerSymbol ? 'win' : 'lose',
                      scores
                    }))
                    window.location.hash = '#ai-analysis'
                  }} 
                  style={{ 
                    padding: isMobile ? '8px 12px' : '8px 16px', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: isMobile ? '12px' : '14px',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                    transition: 'all 0.2s'
                  }}
                >
                  🔍 {t('room.analyzeGame')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showReportModal && opponentUserId && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportedUserId={opponentUserId}
          matchId={matchId || undefined}
          onSuccess={() => setShowReportModal(false)}
        />
      )}

      {/* Ranked Disconnect Overlay - Requirements: 3.1, 3.2, 3.3, 3.4 */}
      {isRankedMode && showDisconnectOverlay && (
        <DisconnectOverlay
          isVisible={showDisconnectOverlay}
          disconnectedPlayerId={disconnectState.disconnectedPlayerId || ''}
          remainingSeconds={disconnectState.remainingSeconds}
          autoWinResult={disconnectState.autoWinResult}
        />
      )}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -60%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </div>
  )
}

