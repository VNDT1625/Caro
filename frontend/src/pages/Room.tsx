import React from 'react'
import { supabase } from '../lib/supabase'
import ChatPanel from '../components/chat/ChatPanel'

export default function Room() {
  
  // User & Room info
  const [user, setUser] = React.useState<any>(null)
  const [roomId, setRoomId] = React.useState<string | null>(null)
  const [matchId, setMatchId] = React.useState<string | null>(null)
  const [playerSymbol, setPlayerSymbol] = React.useState<'X' | 'O'>('X')
  const [opponentUserId, setOpponentUserId] = React.useState<string | null>(null)
  const opponentSymbol = playerSymbol === 'X' ? 'O' : 'X'
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
  const [showMoveInfo, setShowMoveInfo] = React.useState(false)
  const [moveHistory, setMoveHistory] = React.useState<Array<{x: number, y: number, player: 'X' | 'O', timestamp: number}>>([])
  const [gameWinner, setGameWinner] = React.useState<'X' | 'O' | 'draw' | null>(null)
  const [matchWinner, setMatchWinner] = React.useState<'X' | 'O' | null>(null)
  const [showGameWinPopup, setShowGameWinPopup] = React.useState(false)
  
  const [opponent, setOpponent] = React.useState({
    name: 'Đối thủ',
    rank: 'Vô Danh',
    avatar: '🎭'
  })

  // Refs to avoid stale closures in realtime handlers
  const userRef = React.useRef<any>(null)
  const playerSymbolRef = React.useRef<'X' | 'O'>('X')
  const scoresRef = React.useRef(scores)
  const moveHistoryRef = React.useRef(moveHistory)
  const gameWinnerRef = React.useRef(gameWinner)
  const matchWinnerRef = React.useRef(matchWinner)
  const processingMoveRef = React.useRef<string | null>(null)
  const currentTurnRef = React.useRef<'X' | 'O'>('X')

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
    gameWinnerRef.current = gameWinner
  }, [gameWinner])

  React.useEffect(() => {
    matchWinnerRef.current = matchWinner
  }, [matchWinner])

  React.useEffect(() => {
    currentTurnRef.current = currentTurn
  }, [currentTurn])

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

      setBoard(hydratedBoard)
      setMoveHistory(hydratedHistory)
      setLastMovePosition({ x: lastMove.position_x, y: lastMove.position_y })
      setCurrentTurn(nextTurn)
      setTimeLeft(30)
      setOpponentTimeLeft(30)

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
    const totalMoves = options?.totalMoves ?? moveHistoryRef.current.length

    setGameWinner(winnerSymbol)
    gameWinnerRef.current = winnerSymbol
    
    // Hiển thị popup thắng/thua trong 3 giây
    setShowGameWinPopup(true)
    setTimeout(() => {
      setShowGameWinPopup(false)
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
            totalMoves: move.move_number || moveHistoryRef.current.length + 1
          })
        } else {
          // No winner - switch turn
          const nextTurn = player === 'X' ? 'O' : 'X'
          console.log('🔄 Turn:', player, '→', nextTurn)
          setCurrentTurn(nextTurn)
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
      const projectedMoveCount = moveHistoryRef.current.length + 1
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

      if (winner) {
        console.log('🎉 GAME WINNER DETECTED:', winner)
        await concludeGame(winner, 'move', { totalMoves: projectedMoveCount })
      } else {
        // Switch turn
        const nextTurn = opponentSymbol
        console.log('🔄 Switching turn:', playerSymbol, '→', nextTurn)
        setCurrentTurn(nextTurn)
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
    if (confirm('Bạn có chắc muốn đầu hàng?')) {
      void concludeGame(opponentSymbol, 'surrender')
    }
  }

  const handleRequestDraw = () => {
    if (confirm('Gửi yêu cầu hòa đến đối thủ?')) {
      alert('Đã gửi yêu cầu hòa!')
    }
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
        padding: '16px 24px',
        background: 'rgba(15, 23, 42, 0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        position: 'relative',
        zIndex: 10
      }}>
        <button className="back-btn" onClick={() => window.location.hash = '#home'} title="Quay lại" style={{
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid #EF4444',
          color: '#EF4444',
          padding: '8px 16px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 600
        }}>
          ← Rời trận
        </button>

        {/* Center Title */}
        <div style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#fff',
          textAlign: 'center'
        }}>
          🎮 Trận Đấu - Best of 3
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="action-btn" onClick={() => setShowMoveInfo(!showMoveInfo)} title="Lịch sử nước đi" style={{
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid rgba(34, 211, 238, 0.5)',
            background: 'rgba(34, 211, 238, 0.1)',
            color: '#22D3EE',
            cursor: 'pointer',
            fontSize: '16px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}>
            📜
          </button>
          <button className="action-btn" onClick={handleRequestDraw} title="Yêu cầu hòa" style={{
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid rgba(251, 191, 36, 0.5)',
            background: 'rgba(251, 191, 36, 0.1)',
            color: '#F59E0B',
            cursor: 'pointer',
            fontSize: '16px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}>
            🤝
          </button>
          <button className="action-btn danger" onClick={handleSurrender} title="Đầu hàng" style={{
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#EF4444',
            cursor: 'pointer',
            fontSize: '16px',
            width: '36px',
            height: '36px',
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
        alignItems: 'center',
        gap: '40px',
        justifyContent: 'center',
        padding: '20px 24px',
        background: 'rgba(15, 23, 42, 0.5)'
      }}>
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
              {playerSymbol === 'X' ? 'Bạn' : opponent.name}
            </div>
            <div className="player-rank" style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>
              {playerSymbol === 'X' ? 'Vô Danh' : opponent.rank}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{
                color: getTimeColor(playerSymbol === 'X' ? timeLeft : opponentTimeLeft),
                fontSize: '13px',
                fontWeight: 600
              }}>
                ⏱️ {playerSymbol === 'X' ? timeLeft : opponentTimeLeft}s
              </div>
              <div style={{ 
                fontSize: '11px', 
                color: totalTimeX < 60 ? '#EF4444' : '#888',
                fontWeight: 500
              }}>
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
              {playerSymbol === 'O' ? 'Bạn' : opponent.name}
            </div>
            <div className="player-rank" style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>
              {playerSymbol === 'O' ? 'Vô Danh' : opponent.rank}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{
                color: getTimeColor(playerSymbol === 'O' ? timeLeft : opponentTimeLeft),
                fontSize: '13px',
                fontWeight: 600
              }}>
                ⏱️ {playerSymbol === 'O' ? timeLeft : opponentTimeLeft}s
              </div>
              <div style={{ 
                fontSize: '11px', 
                color: totalTimeO < 60 ? '#EF4444' : '#888',
                fontWeight: 500
              }}>
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
      </div>

      {/* Main Game Area */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        gap: '20px'
      }}>
        {/* Move History Sidebar */}
        {showMoveInfo && (
          <div style={{
            width: '250px',
            background: 'rgba(15, 23, 42, 0.8)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Lịch sử nước đi</h3>
              <button onClick={() => setShowMoveInfo(false)} style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: '18px'
              }}>✕</button>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {moveHistory.length === 0 ? (
                <div style={{ color: '#666', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
                  Chưa có nước đi nào
                </div>
              ) : (
                moveHistory.map((move, index) => (
                  <div key={index} style={{
                    padding: '8px',
                    background: move.player === playerSymbol ? 'rgba(34, 211, 238, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                    borderRadius: '6px',
                    marginBottom: '6px',
                    fontSize: '13px'
                  }}>
                    <span style={{ fontWeight: 'bold' }}>#{index + 1}</span>
                    <span style={{ marginLeft: '8px', color: move.player === 'X' ? '#22D3EE' : '#F59E0B' }}>
                      {move.player}
                    </span>
                    <span style={{ marginLeft: '8px', color: '#888' }}>
                      ({move.x}, {move.y})
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Game Board */}
        <div style={{
          display: 'inline-block',
          background: 'rgba(30, 41, 59, 0.8)',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(15, 32px)`,
            gap: '2px',
            background: '#1e293b',
            padding: '2px',
            borderRadius: '4px'
          }}>
            {board.map((row, y) => (
              row.map((cell, x) => {
                const isLastMove = lastMovePosition?.x === x && lastMovePosition?.y === y
                const isHovered = hoveredCell?.x === x && hoveredCell?.y === y
                
                return (
                  <div
                    key={`${x}-${y}`}
                    onClick={() => handleCellClick(x, y)}
                    onMouseEnter={() => setHoveredCell({x, y})}
                    onMouseLeave={() => setHoveredCell(null)}
                    style={{
                      width: '32px',
                      height: '32px',
                      background: isLastMove 
                        ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.3), rgba(34, 211, 238, 0.1))'
                        : 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: cell ? 'default' : 'pointer',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      transition: 'all 0.15s',
                      color: cell === 'X' ? '#22D3EE' : '#F59E0B',
                      opacity: isHovered && !cell ? 0.7 : 1
                    }}
                  >
                    {cell || (isHovered && !gameWinner && !matchWinner && currentTurn === playerSymbol && (
                      <span style={{ opacity: 0.4 }}>{playerSymbol}</span>
                    ))}
                  </div>
                )
              })
            ))}
          </div>
        </div>

        <div style={{ width: '300px', flexShrink: 0 }}>
          <ChatPanel
            mode="room"
            variant="room"
            userId={user?.id}
            displayName={user?.user_metadata?.name || user?.email || 'Bạn'}
            roomId={roomId}
            enabled={Boolean(roomId)}
          />
        </div>
      </div>

      {/* Score Board */}
      <div style={{
        textAlign: 'center',
        padding: '20px',
        fontSize: '20px',
        fontWeight: 'bold'
      }}>
        <div style={{
          display: 'inline-block',
          background: 'rgba(15, 23, 42, 0.8)',
          padding: '16px 32px',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span style={{ color: '#22D3EE' }}>X: {scores.X}</span>
          <span style={{ margin: '0 20px', color: '#666' }}>-</span>
          <span style={{ color: '#F59E0B' }}>O: {scores.O}</span>
          <div style={{ fontSize: '14px', color: '#888', marginTop: '8px' }}>
            Ván {currentGame}/3
          </div>
        </div>
      </div>

      {/* Game Win Popup - Hiển thị 3s */}
      {showGameWinPopup && gameWinner && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 2000,
          animation: 'slideDown 0.3s ease-out'
        }}>
          <div style={{
            background: gameWinner === playerSymbol 
              ? 'linear-gradient(135deg, #10b981, #059669)' 
              : 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: 'white',
            padding: '40px 60px',
            borderRadius: '20px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 100px rgba(0,0,0,0.3)',
            textAlign: 'center',
            border: '3px solid rgba(255,255,255,0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>
              {gameWinner === playerSymbol ? '🎉' : '😢'}
            </div>
            <h2 style={{ 
              margin: 0, 
              fontSize: '36px', 
              fontWeight: 'bold',
              textShadow: '0 2px 10px rgba(0,0,0,0.3)',
              marginBottom: '12px'
            }}>
              {gameWinner === playerSymbol ? 'BẠN THẮNG!' : 'BẠN THUA!'}
            </h2>
            <p style={{ 
              margin: 0, 
              fontSize: '20px',
              opacity: 0.95
            }}>
              {gameWinner === playerSymbol 
                ? `Quân ${playerSymbol} chiến thắng ván này!` 
                : `Quân ${gameWinner} chiến thắng ván này!`}
            </p>
            <div style={{
              marginTop: '20px',
              fontSize: '16px',
              opacity: 0.9,
              fontWeight: 600
            }}>
              Tỷ số: X {scores.X} - {scores.O} O
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
          zIndex: 1000
        }}>
          <div style={{
            background: '#0b1220',
            color: '#fff',
            padding: '24px',
            borderRadius: '12px',
            minWidth: '320px',
            textAlign: 'center',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)'
          }}>
            <h2 style={{ margin: 0, marginBottom: '8px' }}>{matchWinner === playerSymbol ? 'Bạn đã chiến thắng!' : 'Đối thủ đã chiến thắng'}</h2>
            <p style={{ margin: '8px 0 16px' }}>Người thắng: <strong>{matchWinner}</strong></p>
            <p style={{ margin: '8px 0 16px' }}>Tỉ số — X: <strong>{scores.X}</strong> &nbsp; - &nbsp; O: <strong>{scores.O}</strong></p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => { window.location.hash = '#home' }} style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}>Về Home</button>
              <button onClick={() => { setMatchWinner(null); resetGame(); setScores({ X: 0, O: 0 }); }} style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}>Chơi lại</button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes slideDown {
          0% { 
            opacity: 0; 
            transform: translate(-50%, -60%); 
          }
          100% { 
            opacity: 1; 
            transform: translate(-50%, -50%); 
          }
        }
      `}</style>
    </div>
  )
}
