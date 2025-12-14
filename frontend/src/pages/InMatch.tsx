import React from 'react'
import { supabase } from '../lib/supabase'
import { useChat } from '../hooks/useChat'
import { useLanguage } from '../contexts/LanguageContext'
import { SeriesScoreDisplay, GameNumberBadge, PlayerSideIndicator, DisconnectWarning } from '../components/series'
import { useSeriesRealtime, SeriesEvents } from '../hooks/useSeriesRealtime'
import { prepareNextSeriesGame, forfeitSeriesGame } from '../lib/seriesApi'

interface InMatchProps {
  user?: any
  rank?: string
}

interface GameState {
  board: (null | 'X' | 'O')[][]
  moves: Array<{x: number, y: number, player: 'X' | 'O', timestamp: number}>
  currentTurn: 'X' | 'O'
  currentGame: number // 1, 2, or 3
  scores: { X: number, O: number } // wins per player
  totalTimeX: number // Total time remaining for X in seconds (starts at 300)
  totalTimeO: number // Total time remaining for O in seconds (starts at 300)
  gameStartedAt: string | null
  lastMoveAt: string | null
}

export default function InMatch({ user, rank }: InMatchProps = {}) {
  const { t } = useLanguage()
  
  // Room and player info
  const [roomId, setRoomId] = React.useState<string | null>(null)
  const [matchId, setMatchId] = React.useState<string | null>(null)
  const [seriesId, setSeriesId] = React.useState<string | null>(null)
  const [seriesData, setSeriesData] = React.useState<any>(null)
  const [playerSymbol, setPlayerSymbol] = React.useState<'X' | 'O'>('X')
  const opponentSymbol = playerSymbol === 'X' ? 'O' : 'X'
  
  // Game state
  const [gameState, setGameState] = React.useState<GameState>({
    board: Array(15).fill(null).map(() => Array(15).fill(null)),
    moves: [],
    currentTurn: 'X',
    currentGame: 1,
    scores: { X: 0, O: 0 },
    totalTimeX: 300,
    totalTimeO: 300,
    gameStartedAt: null,
    lastMoveAt: null
  })
  
  // Derived state from gameState
  const board = gameState.board
  const currentTurn = gameState.currentTurn
  const moveHistory = gameState.moves
  const currentGame = gameState.currentGame
  const scores = gameState.scores
  
  // Update last move position when moves change
  React.useEffect(() => {
    if (moveHistory.length > 0) {
      const lastMove = moveHistory[moveHistory.length - 1]
      setLastMovePosition({ x: lastMove.x, y: lastMove.y })
    }
  }, [moveHistory])
  
  // Sync total time from game state
  React.useEffect(() => {
    if (gameState.totalTimeX !== undefined) setTotalTimeX(gameState.totalTimeX)
    if (gameState.totalTimeO !== undefined) setTotalTimeO(gameState.totalTimeO)
  }, [gameState.totalTimeX, gameState.totalTimeO])
  
  // UI state
  const [timeLeft, setTimeLeft] = React.useState(30)
  const [opponentTimeLeft, setOpponentTimeLeft] = React.useState(30)
  const [totalTimeX, setTotalTimeX] = React.useState(300) // 5 minutes
  const [totalTimeO, setTotalTimeO] = React.useState(300) // 5 minutes
  const [lastMovePosition, setLastMovePosition] = React.useState<{x: number, y: number} | null>(null)
  const [showChat, setShowChat] = React.useState(false)
  const [chatInput, setChatInput] = React.useState('')
  
  // Use proper chat hook with database and realtime
  const chat = useChat({
    mode: 'room',
    roomId: roomId,
    enabled: !!roomId
  })
  const [gameWinner, setGameWinner] = React.useState<'X' | 'O' | 'draw' | null>(null) // Winner of current game
  const [matchWinner, setMatchWinner] = React.useState<'X' | 'O' | null>(null) // Winner of entire match (best of 3)
  const [showMoveInfo, setShowMoveInfo] = React.useState(false)
  const [hoveredCell, setHoveredCell] = React.useState<{x: number, y: number} | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [showTimeoutWarning, setShowTimeoutWarning] = React.useState(false)
  const [syncError, setSyncError] = React.useState<string | null>(null)
  const [retryCount, setRetryCount] = React.useState(0)
  
  // Rank up animation state
  const [showRankUpModal, setShowRankUpModal] = React.useState(false)
  const [rankUpData, setRankUpData] = React.useState<{
    oldRank: string
    newRank: string
    mindpoint: number
  } | null>(null)

  // Series realtime state - Requirements: 7.1, 7.2, 8.3, 8.5
  const [showDisconnectWarning, setShowDisconnectWarning] = React.useState(false)
  const [nextGameCountdown, setNextGameCountdown] = React.useState<number | null>(null)
  const [seriesRewards, setSeriesRewards] = React.useState<any>(null)

  // Series realtime hook - subscribes to ranked_series table updates
  const {
    seriesData: realtimeSeriesData,
    disconnectState,
    isSubscribed: isSeriesSubscribed
  } = useSeriesRealtime({
    seriesId,
    userId: user?.id,
    enabled: !!seriesId && !!user?.id,
    onGameEnded: (event) => {
      console.log('🎮 Series game ended event:', event)
      // Update local series data
      if (realtimeSeriesData) {
        setSeriesData({
          ...seriesData,
          player1_wins: event.score.split('-')[0],
          player2_wins: event.score.split('-')[1]
        })
      }
    },
    onSeriesCompleted: (event) => {
      console.log('🏆 Series completed event:', event)
      setSeriesRewards(event.rewards)
      // Match winner will be set by the game state update
    },
    onSideSwapped: (event) => {
      console.log('🔄 Side swapped event:', event)
      // Update player symbol based on new sides
      if (seriesData && user?.id) {
        const newSide = seriesData.player1_id === user.id 
          ? event.player1Side 
          : event.player2Side
        setPlayerSymbol(newSide)
      }
    },
    onNextGameReady: (event) => {
      console.log('⏭️ Next game ready event:', event)
      // Start countdown for next game
      setNextGameCountdown(event.countdownSeconds)
    },
    onPlayerDisconnected: (event) => {
      console.log('⚠️ Player disconnected event:', event)
      setShowDisconnectWarning(true)
    },
    onPlayerReconnected: (event) => {
      console.log('✅ Player reconnected event:', event)
      setShowDisconnectWarning(false)
    },
    onGameForfeited: async (event) => {
      console.log('🏳️ Game forfeited event:', event)
      // Handle forfeit - opponent wins this game
      if (event.forfeitingPlayerId !== user?.id) {
        // We won by forfeit
        await handleGameEnd(playerSymbol)
      } else {
        // We forfeited
        await handleGameEnd(opponentSymbol)
      }
    },
    onSeriesAbandoned: (event) => {
      console.log('🚪 Series abandoned event:', event)
      // Set match winner based on who abandoned
      if (event.abandoningPlayerId === user?.id) {
        setMatchWinner(opponentSymbol)
      } else {
        setMatchWinner(playerSymbol)
      }
    },
    onSeriesDataChanged: (data) => {
      console.log('📊 Series data changed:', data)
      setSeriesData(data)
    }
  })

  // Handle disconnect timeout - forfeit game when timer expires
  React.useEffect(() => {
    if (disconnectState.isDisconnected && disconnectState.remainingSeconds <= 0) {
      // Opponent timed out - forfeit their game
      if (seriesId && disconnectState.disconnectedPlayerId) {
        console.log('⏰ Disconnect timeout - forfeiting game for:', disconnectState.disconnectedPlayerId)
        forfeitSeriesGame(seriesId, disconnectState.disconnectedPlayerId)
          .then(result => {
            if (result.success) {
              console.log('✅ Game forfeited due to disconnect timeout')
            }
          })
          .catch(err => console.error('Failed to forfeit game:', err))
      }
    }
  }, [disconnectState.remainingSeconds, disconnectState.isDisconnected, seriesId, disconnectState.disconnectedPlayerId])

  // Handle next game countdown
  React.useEffect(() => {
    if (nextGameCountdown === null || nextGameCountdown <= 0) return

    const timer = setInterval(() => {
      setNextGameCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer)
          // Start next game
          if (roomId && seriesId) {
            prepareNextSeriesGame(roomId, seriesId)
              .then(result => {
                if (result.success && result.gameState) {
                  setGameState(result.gameState)
                  setGameWinner(null)
                  setTimeLeft(30)
                  setOpponentTimeLeft(30)
                  setLastMovePosition(null)
                }
              })
              .catch(err => console.error('Failed to prepare next game:', err))
          }
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [nextGameCountdown, roomId, seriesId])

  // Load opponent data from localStorage or generate mock
  const opponent = React.useMemo(() => {
    const matchData = localStorage.getItem('currentMatch')
    if (matchData) {
      try {
        const { opponent: opp } = JSON.parse(matchData)
        if (opp) {
          return {
            name: opp.displayName || opp.username || `Player#${Math.floor(Math.random() * 9999)}`,
            rank: opp.rank || 'Vô Danh',
            avatar: '🎭'
          }
        }
      } catch (e) {
        console.error('Failed to parse match data:', e)
      }
    }
    
    // Fallback to mock data
    return {
      name: `Player#${Math.floor(Math.random() * 9999)}`,
      rank: 'Tân Kỳ - Cao 2',
      avatar: '🎭'
    }
  }, [])

  // Presence: join match-specific presence channel for accurate in-match online tracking
  React.useEffect(() => {
    if (!user?.id || !matchId) return

    const channel = supabase.channel(`presence:match:${matchId}`, {
      config: { presence: { key: user.id } }
    })

    channel.on('presence', { event: 'sync' }, () => {
      // presence available via channel.presenceState() if needed later
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.track({
          user_id: user.id,
          side: playerSymbol,
          at: new Date().toISOString()
        })
      }
    })

    return () => { try { void channel.unsubscribe() } catch (e) {} }
  }, [user?.id, matchId, playerSymbol])

  // Initialize room and player info on mount
  React.useEffect(() => {
    const initializeMatch = async () => {
      if (!user?.id) {
        console.error('No user found')
        setIsLoading(false)
        return
      }

      try {
        // Get room info from localStorage
        const matchData = localStorage.getItem('currentMatch')
        if (!matchData) {
          console.error('No match data found')
          setIsLoading(false)
          return
        }

        const parsedMatchData = JSON.parse(matchData)
        const { roomId: storedRoomId, seriesId: storedSeriesId, series: storedSeries } = parsedMatchData
        if (!storedRoomId) {
          console.error('No roomId in match data')
          setIsLoading(false)
          return
        }

        setRoomId(storedRoomId)
        console.log('Loaded room:', storedRoomId)

        // Load series info if available (for ranked matches)
        if (storedSeriesId) {
          setSeriesId(storedSeriesId)
          setSeriesData(storedSeries)
          console.log('🏆 Loaded series:', storedSeriesId, storedSeries)
        }

        // Get player side (X or O) from room_players
        const { data: roomPlayer, error: rpError } = await supabase
          .from('room_players')
          .select('player_side')
          .eq('room_id', storedRoomId)
          .eq('user_id', user.id)
          .single()

        if (rpError || !roomPlayer) {
          console.error('❌ Failed to get player side:', rpError)
          setPlayerSymbol('X') // Default to X
        } else {
          setPlayerSymbol(roomPlayer.player_side as 'X' | 'O')
          console.log('✅ Player side loaded:', roomPlayer.player_side, '| User ID:', user.id)
        }

        // Get or create match record - with proper sequencing
        // Player O waits a bit to let X create first
        if (roomPlayer?.player_side === 'O') {
          console.log('⏳ Player O waiting 2 seconds for X to create match...')
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        
        const { data: existingMatch } = await supabase
          .from('matches')
          .select('id, room_id')
          .eq('room_id', storedRoomId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existingMatch) {
          setMatchId(existingMatch.id)
          console.log('✅ Found existing match:', existingMatch.id)
        } else {
          // Only player X creates the match
          if (roomPlayer?.player_side === 'X') {
            console.log('🎮 Player X creating match...')
            
            // Get both players from room
            const { data: allPlayers } = await supabase
              .from('room_players')
              .select('user_id, player_side')
              .eq('room_id', storedRoomId)

            if (allPlayers && allPlayers.length >= 2) {
              const playerX = allPlayers.find(p => p.player_side === 'X')
              const playerO = allPlayers.find(p => p.player_side === 'O')

              if (playerX && playerO) {
                const { data: newMatch, error: createError } = await supabase
                  .from('matches')
                  .insert({
                    room_id: storedRoomId,
                    match_type: 'ranked',
                    player_x_user_id: playerX.user_id,
                    player_o_user_id: playerO.user_id,
                    started_at: new Date().toISOString()
                  })
                  .select()
                  .single()

                if (!createError && newMatch) {
                  setMatchId(newMatch.id)
                  console.log('✅ Player X created match:', newMatch.id)
                } else {
                  console.error('❌ Failed to create match:', createError)
                }
              }
            }
          } else {
            // Player O subscribes to wait for match creation
            console.log('⏳ Player O subscribing to wait for match...')
            
            const matchChannel = supabase
              .channel(`match-wait-${storedRoomId}`)
              .on(
                'postgres_changes',
                {
                  event: 'INSERT',
                  schema: 'public',
                  table: 'matches',
                  filter: `room_id=eq.${storedRoomId}`
                },
                (payload) => {
                  console.log('🎯 Match created by X:', payload.new)
                  const newMatchId = (payload.new as any).id
                  setMatchId(newMatchId)
                  console.log('✅ Player O received match ID:', newMatchId)
                  matchChannel.unsubscribe()
                }
              )
              .subscribe()

            // Also poll as backup (max 10 seconds)
            let pollCount = 0
            const pollInterval = setInterval(async () => {
              pollCount++
              const { data: polledMatch } = await supabase
                .from('matches')
                .select('id')
                .eq('room_id', storedRoomId)
                .limit(1)
                .maybeSingle()

              if (polledMatch) {
                console.log('✅ Player O found match via polling:', polledMatch.id)
                setMatchId(polledMatch.id)
                clearInterval(pollInterval)
                matchChannel.unsubscribe()
              } else if (pollCount >= 10) {
                console.error('❌ Timeout waiting for match')
                clearInterval(pollInterval)
                matchChannel.unsubscribe()
              }
            }, 1000)
          }
        }

        // Load initial game state from room
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .select('game_state')
          .eq('id', storedRoomId)
          .single()

        if (!roomError && room?.game_state) {
          setGameState(room.game_state as GameState)
          console.log('Loaded game state:', room.game_state)
        } else {
          // Initialize game state in room
          const initialState: GameState = {
            board: Array(15).fill(null).map(() => Array(15).fill(null)),
            moves: [],
            currentTurn: 'X',
            currentGame: 1,
            scores: { X: 0, O: 0 },
            totalTimeX: 300,
            totalTimeO: 300,
            gameStartedAt: new Date().toISOString(),
            lastMoveAt: null
          }
          
          const { error: updateError } = await supabase
            .from('rooms')
            .update({ game_state: initialState, status: 'playing' })
            .eq('id', storedRoomId)

          if (updateError) {
            console.error('Failed to initialize game state:', updateError)
          } else {
            setGameState(initialState)
            console.log('Initialized game state')
          }
        }

        setIsLoading(false)
      } catch (error) {
        console.error('Error initializing match:', error)
        setIsLoading(false)
      }
    }

    initializeMatch()
  }, [user?.id])

  // Subscribe to realtime updates for game state
  React.useEffect(() => {
    if (!roomId) return

    console.log('🎮 Subscribing to game state updates for room:', roomId)

    const channel = supabase
      .channel(`game-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`
        },
        (payload) => {
          console.log('🎲 Game state updated via realtime:', payload)
          const newRoom = payload.new as any
          if (newRoom.game_state) {
            const incomingState = newRoom.game_state as GameState
            console.log('📥 Incoming state - currentTurn:', incomingState.currentTurn, 'Your symbol:', playerSymbol)
            setGameState(incomingState)
            
            // Check for game winner
            if (incomingState.scores.X >= 2) {
              setMatchWinner('X')
            } else if (incomingState.scores.O >= 2) {
              setMatchWinner('O')
            }
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [roomId])

  // Timer countdown - both per-move and total time
  React.useEffect(() => {
    if (gameWinner || matchWinner) return

    const interval = setInterval(() => {
      if (currentTurn === playerSymbol) {
        // Decrease per-move timer
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimeOut()
            return 0
          }
          return prev - 1
        })
        
        // Decrease total time
        if (playerSymbol === 'X') {
          setTotalTimeX(prev => {
            if (prev <= 1) {
              handleTimeOut()
              return 0
            }
            return prev - 1
          })
        } else {
          setTotalTimeO(prev => {
            if (prev <= 1) {
              handleTimeOut()
              return 0
            }
            return prev - 1
          })
        }
      } else {
        // Decrease opponent per-move timer
        setOpponentTimeLeft(prev => {
          if (prev <= 1) {
            handleOpponentTimeOut()
            return 0
          }
          return prev - 1
        })
        
        // Decrease opponent total time
        if (opponentSymbol === 'X') {
          setTotalTimeX(prev => {
            if (prev <= 1) {
              handleOpponentTimeOut()
              return 0
            }
            return prev - 1
          })
        } else {
          setTotalTimeO(prev => {
            if (prev <= 1) {
              handleOpponentTimeOut()
              return 0
            }
            return prev - 1
          })
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [currentTurn, gameWinner, matchWinner, playerSymbol, opponentSymbol])

  const handleTimeOut = async () => {
    // Player ran out of time - opponent wins current game
    console.log('⏰ TIMEOUT: Player', playerSymbol, 'ran out of time. Opponent', opponentSymbol, 'wins!')
    setShowTimeoutWarning(true)
    setTimeout(async () => {
      setShowTimeoutWarning(false)
      await handleGameEnd(opponentSymbol)
      // Don't set matchWinner here - let handleGameEnd decide based on score
    }, 2000)
  }

  const handleOpponentTimeOut = async () => {
    // Opponent ran out of time - player wins current game
    console.log('⏰ OPPONENT TIMEOUT: Opponent', opponentSymbol, 'ran out of time. Player', playerSymbol, 'wins!')
    await handleGameEnd(playerSymbol)
  }

  const checkWinner = (board: (null | 'X' | 'O')[][], lastX: number, lastY: number): 'X' | 'O' | 'draw' | null => {
    const player = board[lastY][lastX]
    if (!player) return null

    const directions = [
      [[0, 1], [0, -1]], // horizontal
      [[1, 0], [-1, 0]], // vertical
      [[1, 1], [-1, -1]], // diagonal \
      [[1, -1], [-1, 1]]  // diagonal /
    ]

    for (const [dir1, dir2] of directions) {
      let count = 1
      // Check direction 1
      for (let i = 1; i < 5; i++) {
        const nx = lastX + dir1[0] * i
        const ny = lastY + dir1[1] * i
        if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15 || board[ny][nx] !== player) break
        count++
      }
      // Check direction 2
      for (let i = 1; i < 5; i++) {
        const nx = lastX + dir2[0] * i
        const ny = lastY + dir2[1] * i
        if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15 || board[ny][nx] !== player) break
        count++
      }
      if (count >= 5) return player
    }

    // Check draw (board full)
    const isFull = board.every(row => row.every(cell => cell !== null))
    if (isFull) return 'draw'

    return null
  }

  // Calculate mindpoint change based on game performance
  const calculateMindpointChange = (
    isWinner: boolean,
    totalMoves: number,
    timeRemaining: number,
    playerRank: string = 'vo_danh',
    opponentRank: string = 'vo_danh'
  ): number => {
    if (!isWinner) return -15;
    
    let points = 20; // Base points
    
    // Quick win bonus
    if (totalMoves < 50) points += 10;
    
    // Time bonus
    if (timeRemaining > 180) points += 5;
    
    // Rank difference bonus/penalty
    const rankValues: Record<string, number> = {
      'vo_danh': 0,
      'tan_ky': 1,
      'hoc_ky': 2,
      'ky_lao': 3,
      'cao_ky': 4,
      'ky_thanh': 5,
      'truyen_thuyet': 6
    };
    
    const playerRankValue = rankValues[playerRank] || 0;
    const opponentRankValue = rankValues[opponentRank] || 0;
    const diff = opponentRankValue - playerRankValue;
    
    if (diff > 0) {
      points += diff * 5; // Beat higher rank
    } else if (diff < 0) {
      points += diff * 3; // Beat lower rank (penalty)
    }
    
    return Math.max(points, 5); // Minimum 5 points for winning
  }

  const handleGameEnd = async (winner: 'X' | 'O' | 'draw') => {
    if (!roomId) return

    console.log('🏁 Game ended. Winner:', winner, '| PlayerSymbol:', playerSymbol, '| OpponentSymbol:', opponentSymbol)
    setGameWinner(winner)

    // Update scores
    const newScores = { ...scores }
    if (winner !== 'draw') {
      newScores[winner]++
    }

    // Check if match is over (best of 3)
    const matchOver = newScores.X >= 2 || newScores.O >= 2
    const finalMatchWinner = newScores.X >= 2 ? 'X' : newScores.O >= 2 ? 'O' : null

    if (matchOver && finalMatchWinner) {
      console.log('Match over! Winner:', finalMatchWinner)
      setMatchWinner(finalMatchWinner)

      // Get both players info for mindpoint calculation
      const { data: players, error: playersError } = await supabase
        .from('room_players')
        .select(`
          user_id,
          player_side,
          profiles!inner(current_rank, mindpoint)
        `)
        .eq('room_id', roomId)

      if (!playersError && players && players.length === 2) {
        const playerX = players.find(p => p.player_side === 'X')
        const playerO = players.find(p => p.player_side === 'O')

        // Calculate mindpoint changes
        const playerXMindpointChange = calculateMindpointChange(
          finalMatchWinner === 'X',
          moveHistory.length,
          totalTimeX,
          (playerX as any)?.profiles?.current_rank || 'vo_danh',
          (playerO as any)?.profiles?.current_rank || 'vo_danh'
        )

        const playerOMindpointChange = calculateMindpointChange(
          finalMatchWinner === 'O',
          moveHistory.length,
          totalTimeO,
          (playerO as any)?.profiles?.current_rank || 'vo_danh',
          (playerX as any)?.profiles?.current_rank || 'vo_danh'
        )

        console.log('💎 Mindpoint changes:', { 
          playerX: playerXMindpointChange, 
          playerO: playerOMindpointChange 
        })

        // Update match record with mindpoint changes
        if (matchId) {
          const { error: updateError } = await supabase
            .from('matches')
            .update({
              winner_user_id: finalMatchWinner === 'X' ? playerX?.user_id : playerO?.user_id,
              result: finalMatchWinner === 'X' ? 'win_x' : 'win_o',
              ended_at: new Date().toISOString(),
              total_moves: moveHistory.length,
              player_x_mindpoint_change: playerXMindpointChange,
              player_o_mindpoint_change: playerOMindpointChange
            })
            .eq('id', matchId)

          if (updateError) {
            console.error('❌ Failed to update match:', updateError)
          } else {
            console.log('✅ Match updated with mindpoint changes')

            // Update rank for both players and check for rank up
            const oldRankPlayer = (playerSymbol === 'X' ? playerX : playerO) as any
            const oldRank = oldRankPlayer?.profiles?.current_rank
            const oldMindpoint = oldRankPlayer?.profiles?.mindpoint || 0
            const mindpointChange = playerSymbol === 'X' ? playerXMindpointChange : playerOMindpointChange
            const newMindpoint = oldMindpoint + mindpointChange

            if (playerX?.user_id) {
              const { data: newRankX, error: rankErrorX } = await supabase
                .rpc('update_user_rank', { p_user_id: playerX.user_id })
              
              if (!rankErrorX) {
                console.log('✅ Player X rank updated:', newRankX)
                
                // Show rank up modal if this player ranked up
                if (playerSymbol === 'X' && newRankX && newRankX !== oldRank && finalMatchWinner === playerSymbol) {
                  setRankUpData({
                    oldRank: oldRank || 'vo_danh',
                    newRank: newRankX,
                    mindpoint: newMindpoint
                  })
                  setShowRankUpModal(true)
                  
                  // Auto close after 5 seconds
                  setTimeout(() => setShowRankUpModal(false), 5000)
                }
              }
            }

            if (playerO?.user_id) {
              const { data: newRankO, error: rankErrorO } = await supabase
                .rpc('update_user_rank', { p_user_id: playerO.user_id })
              
              if (!rankErrorO) {
                console.log('✅ Player O rank updated:', newRankO)
                
                // Show rank up modal if this player ranked up
                if (playerSymbol === 'O' && newRankO && newRankO !== oldRank && finalMatchWinner === playerSymbol) {
                  setRankUpData({
                    oldRank: oldRank || 'vo_danh',
                    newRank: newRankO,
                    mindpoint: newMindpoint
                  })
                  setShowRankUpModal(true)
                  
                  // Auto close after 5 seconds
                  setTimeout(() => setShowRankUpModal(false), 5000)
                }
              }
            }
          }
        }
      } else {
        console.error('❌ Failed to get players info:', playersError)
        
        // Fallback: update match without mindpoint changes
        if (matchId) {
          await supabase
            .from('matches')
            .update({
              winner_user_id: finalMatchWinner === playerSymbol ? user?.id : null,
              result: finalMatchWinner === 'X' ? 'win_x' : 'win_o',
              ended_at: new Date().toISOString(),
              total_moves: moveHistory.length
            })
            .eq('id', matchId)
        }
      }

      // Update room status
      await supabase
        .from('rooms')
        .update({ status: 'finished' })
        .eq('id', roomId)
    } else {
      // Start next game
      setTimeout(() => {
        startNextGame(newScores)
      }, 3000)
    }
  }

  const startNextGame = async (newScores: { X: number, O: number }) => {
    if (!roomId) return

    const nextGameNumber = currentGame + 1
    console.log(`Starting game ${nextGameNumber}`)

    const newState: GameState = {
      board: Array(15).fill(null).map(() => Array(15).fill(null)),
      moves: [],
      currentTurn: 'X',
      currentGame: nextGameNumber,
      scores: newScores,
      totalTimeX: totalTimeX, // Keep remaining total time
      totalTimeO: totalTimeO,
      gameStartedAt: new Date().toISOString(),
      lastMoveAt: null
    }

    // Reset UI state
    setGameWinner(null)
    setTimeLeft(30)
    setOpponentTimeLeft(30)
    setLastMovePosition(null)

    // Update room with new game state
    await supabase
      .from('rooms')
      .update({ game_state: newState })
      .eq('id', roomId)

    // Send system message for new game
    try {
      await chat.sendMessage(`Ván ${nextGameNumber} bắt đầu! Tỷ số: X ${newScores.X} - ${newScores.O} O`, 'system')
    } catch (e) {
      console.error('Failed to send system message:', e)
    }
  }

  const handleCellClick = async (x: number, y: number) => {
    console.log('🎯 Cell clicked:', { x, y, roomId, playerSymbol })
    
    if (!roomId) {
      console.log('❌ No roomId')
      return
    }
    
    if (gameWinner || matchWinner) {
      console.log('❌ Game/match already ended')
      return
    }
    
    if (board[y][x] !== null) {
      console.log('❌ Cell occupied')
      return
    }

    console.log('📤 Sending move to server...')

    // Optimistic update UI
    const tempBoard = board.map(row => [...row])
    tempBoard[y][x] = playerSymbol
    setGameState({ ...gameState, board: tempBoard })
    setLastMovePosition({ x, y })

    try {
      // Send move to server for validation
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token

      if (!token) {
        throw new Error('No auth token')
      }

      const response = await fetch('http://localhost:8000/api/game/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roomId, x, y })
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Server rejected move:', data.error)
        alert(data.error || 'Move rejected by server')
        // Revert optimistic update
        setGameState(gameState)
        setLastMovePosition(null)
        return
      }

      console.log('✅ Server accepted move:', data)
      setSyncError(null)

      // Update state immediately from server response
      if (data.gameState) {
        console.log('📥 Updating state from server response')
        setGameState(data.gameState)
      }

      // Also fetch latest state to ensure sync (backup for realtime)
      setTimeout(async () => {
        try {
          const { data: room } = await supabase
            .from('rooms')
            .select('game_state')
            .eq('id', roomId)
            .single()
          
          if (room?.game_state) {
            console.log('🔄 Synced state from database')
            setGameState(room.game_state as GameState)
          }
        } catch (e) {
          console.error('Failed to sync state:', e)
        }
      }, 200)

      // Check if game ended
      if (data.winner) {
        console.log('🎮 Game ended with winner:', data.winner)
        setTimeout(() => handleGameEnd(data.winner), 500)
      }

    } catch (error) {
      console.error('💥 Failed to send move:', error)
      setSyncError('Không thể gửi nước đi. Kiểm tra kết nối.')
      // Revert optimistic update
      setGameState(gameState)
      setLastMovePosition(null)
    }
  }

  const handleSendChat = async () => {
    if (!chatInput.trim()) return
    try {
      await chat.sendMessage(chatInput, 'text')
      setChatInput('')
    } catch (error) {
      console.error('Failed to send chat:', error)
      alert('Không gửi được tin nhắn. Vui lòng thử lại.')
    }
  }

  const handleSurrender = async () => {
    if (window.confirm('Bạn có chắc muốn đầu hàng? Bạn sẽ thua toàn bộ trận đấu.')) {
      await handleGameEnd(opponentSymbol)
      setMatchWinner(opponentSymbol)
    }
  }

  const handleRequestDraw = () => {
    alert('Đã gửi yêu cầu hòa đến đối thủ')
  }

  const getTimeColor = (time: number) => {
    if (time <= 10) return 'rgba(239, 68, 68, 1)'
    if (time <= 20) return 'rgba(251, 191, 36, 1)'
    return 'rgba(34, 211, 238, 1)'
  }

  if (isLoading) {
    return (
      <div className="inmatch-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '20px', color: '#22D3EE' }}>Đang tải trận đấu...</div>
        </div>
      </div>
    )
  }

  // Determine which winner to show in modal
  const displayWinner = matchWinner || gameWinner
  const isMatchOver = matchWinner !== null
  const isGameOver = gameWinner !== null

  return (
    <div className="inmatch-container">
      {/* Sync Error Notification */}
      {syncError && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(239, 68, 68, 0.95)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span>⚠️</span>
          <span>{syncError}</span>
          <button 
            onClick={() => setSyncError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 8px'
            }}
          >×</button>
        </div>
      )}
      
      {/* Rank Up Modal */}
      {showRankUpModal && rankUpData && (
        <div className="rank-up-modal-overlay" style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(8px)'
        }}>
          <div className="rank-up-modal" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '48px 56px',
            borderRadius: '24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 100px rgba(102, 126, 234, 0.5)',
            textAlign: 'center',
            animation: 'rankUpScale 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            border: '3px solid rgba(255,255,255,0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Background effects */}
            <div style={{
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              width: '200%',
              height: '200%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
              animation: 'rotate 20s linear infinite'
            }} />
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Icon */}
              <div style={{ 
                fontSize: '96px', 
                marginBottom: '20px',
                animation: 'bounce 1s ease-in-out 3',
                textShadow: '0 0 30px rgba(255,255,255,0.8)'
              }}>
                👑
              </div>
              
              {/* Title */}
              <h1 style={{ 
                fontSize: '48px', 
                fontWeight: 'bold', 
                color: 'white', 
                marginBottom: '16px',
                textShadow: '0 4px 12px rgba(0,0,0,0.5)',
                letterSpacing: '2px'
              }}>
                RANK UP!
              </h1>
              
              {/* Rank change */}
              <div style={{ 
                fontSize: '24px', 
                color: 'rgba(255,255,255,0.95)', 
                marginBottom: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px'
              }}>
                <span style={{ 
                  textDecoration: 'line-through', 
                  opacity: 0.6,
                  textTransform: 'uppercase',
                  fontWeight: 500
                }}>
                  {rankUpData.oldRank.replace('_', ' ')}
                </span>
                <span style={{ fontSize: '32px', color: '#FCD34D' }}>→</span>
                <span style={{ 
                  fontWeight: 'bold', 
                  color: '#FCD34D',
                  textTransform: 'uppercase',
                  fontSize: '28px',
                  textShadow: '0 0 20px rgba(252, 211, 77, 0.8)'
                }}>
                  {rankUpData.newRank.replace('_', ' ')}
                </span>
              </div>
              
              {/* Mindpoint */}
              <div style={{ 
                fontSize: '18px', 
                color: 'rgba(255,255,255,0.85)',
                marginBottom: '24px',
                padding: '12px 24px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '12px',
                display: 'inline-block'
              }}>
                <span style={{ fontSize: '14px', opacity: 0.8 }}>Mindpoint: </span>
                <span style={{ fontWeight: 'bold', fontSize: '20px' }}>{rankUpData.mindpoint}</span>
              </div>
              
              {/* Message */}
              <div style={{ 
                fontSize: '16px', 
                color: 'rgba(255,255,255,0.75)',
                lineHeight: '1.6',
                maxWidth: '400px',
                margin: '0 auto'
              }}>
                🎉 Chúc mừng! Bạn đã đạt rank mới!<br />
                Tiếp tục nỗ lực để chinh phục đỉnh cao!
              </div>
              
              {/* Auto close message */}
              <div style={{ 
                fontSize: '13px', 
                color: 'rgba(255,255,255,0.5)',
                marginTop: '24px',
                fontStyle: 'italic'
              }}>
                Tự động đóng sau 5 giây...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add CSS animations */}
      <style>{`
        @keyframes rankUpScale {
          0% {
            opacity: 0;
            transform: scale(0.3) rotate(-10deg);
          }
          50% {
            transform: scale(1.05) rotate(2deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      {/* Timeout Warning Popup */}
      {showTimeoutWarning && (
        <div className="winner-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="winner-modal" style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            padding: '40px',
            borderRadius: '16px',
            textAlign: 'center',
            border: '2px solid #EF4444',
            boxShadow: '0 0 40px rgba(239, 68, 68, 0.5)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>⏰</div>
            <h2 style={{ fontSize: '28px', color: '#EF4444', marginBottom: '16px', fontWeight: 'bold' }}>
              HẾT THỜI GIAN!
            </h2>
            <p style={{ fontSize: '16px', color: '#888' }}>
              Bạn đã hết thời gian suy nghĩ. Trận đấu kết thúc!
            </p>
          </div>
        </div>
      )}

      {/* Disconnect Warning - Requirements: 7.1, 7.2 */}
      {showDisconnectWarning && disconnectState.isDisconnected && (
        <DisconnectWarning
          disconnectedPlayerName={opponent.name}
          remainingSeconds={disconnectState.remainingSeconds}
          isOpponent={disconnectState.disconnectedPlayerId !== user?.id}
          onClose={() => setShowDisconnectWarning(false)}
        />
      )}

      {/* Next Game Countdown - Requirements: 8.5 */}
      {nextGameCountdown !== null && nextGameCountdown > 0 && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          border: '2px solid #3b82f6',
          borderRadius: '16px',
          padding: '32px 48px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', color: '#9ca3af', marginBottom: '16px' }}>
            {t('series.nextGameStarting') || 'Ván tiếp theo bắt đầu trong'}
          </div>
          <div style={{
            fontSize: '72px',
            fontWeight: 'bold',
            color: '#3b82f6',
            fontFamily: 'monospace'
          }}>
            {nextGameCountdown}
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '16px' }}>
            {t('series.sidesSwapped') || 'Bên đã được đổi'}
          </div>
        </div>
      )}
      
      {/* Winner Modal - Show for both game end and match end */}
      {displayWinner && (
        <div className="winner-modal-overlay">
          <div className="winner-modal">
            {(() => {
              console.log('🏆 Winner Modal: displayWinner =', displayWinner, '| playerSymbol =', playerSymbol, '| isMatchOver =', isMatchOver)
              return null
            })()}
            <div className="winner-icon">
              {displayWinner === 'draw' ? '🤝' : displayWinner === playerSymbol ? '🎉' : '😔'}
            </div>
            <h2 className="winner-title">
              {isMatchOver ? (
                displayWinner === playerSymbol ? 'CHIẾN THẮNG TRẬN ĐẤU!' : 'THUA TRẬN ĐẤU!'
              ) : (
                displayWinner === 'draw' ? 'VÁN HÒA!' : displayWinner === playerSymbol ? 'THẮNG VÁN NÀY!' : 'THUA VÁN NÀY!'
              )}
            </h2>
            
            {/* Best of 3 Score Display */}
            <div className="match-score" style={{ margin: '20px 0', display: 'flex', justifyContent: 'center' }}>
              <SeriesScoreDisplay
                player1Wins={scores.X}
                player2Wins={scores.O}
                size="large"
                showNames={false}
              />
            </div>
            
            <div className="winner-stats">
              <div className="stat-item" style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <GameNumberBadge currentGame={currentGame} totalGames={3} size="medium" />
              </div>
              <div className="stat-item">
                <span className="stat-label">Tổng nước đi:</span>
                <span className="stat-value">{moveHistory.length}</span>
              </div>
              {isMatchOver && (
                <div className="stat-item">
                  <span className="stat-label">Điểm nhận:</span>
                  <span className="stat-value" style={{color: displayWinner === playerSymbol ? '#22D3EE' : '#EF4444'}}>
                    {displayWinner === playerSymbol ? '+25' : '-12'}
                  </span>
                </div>
              )}
            </div>
            
            <div className="winner-actions">
              {isMatchOver ? (
                <>
                  <button className="winner-btn secondary" onClick={() => window.location.reload()}>
                    ĐẤU TIẾP
                  </button>
                </>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#22D3EE' }}>
                  Ván tiếp theo sẽ bắt đầu sau 3 giây...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Bar - Actions only */}
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
        <button className="back-btn" onClick={() => window.location.hash = '#home'} title={t('room.back')} style={{
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid #EF4444',
          color: '#EF4444',
          padding: '8px 16px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 600
        }}>
          ← {t('room.leaveMatch')}
        </button>

        {/* Center Title */}
        <div style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#fff',
          textAlign: 'center'
        }}>
          🎮 {t('room.matchTitle')}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="action-btn" onClick={() => setShowMoveInfo(!showMoveInfo)} title={t('room.moveHistory')} style={{
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
          <button className="action-btn" onClick={handleRequestDraw} title={t('room.requestDraw')} style={{
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
          <button className="action-btn danger" onClick={handleSurrender} title={t('room.surrender')} style={{
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

      {/* Series Info Bar - Score and Game Number */}
      <div className="series-info-bar" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        padding: '12px 24px',
        background: 'rgba(15, 23, 42, 0.7)',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <GameNumberBadge 
          currentGame={currentGame} 
          totalGames={3} 
          size="medium"
        />
        <SeriesScoreDisplay
          player1Wins={scores.X}
          player2Wins={scores.O}
          player1Name={playerSymbol === 'X' 
            ? (user?.user_metadata?.display_name || user?.user_metadata?.name || 'You')
            : opponent.name
          }
          player2Name={playerSymbol === 'O' 
            ? (user?.user_metadata?.display_name || user?.user_metadata?.name || 'You')
            : opponent.name
          }
          currentPlayerNumber={playerSymbol === 'X' ? 1 : 2}
          size="medium"
          showNames={false}
        />
        <div style={{
          fontSize: '12px',
          color: '#64748B',
          padding: '4px 12px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '6px'
        }}>
          {t('series.bestOf3') || 'Best of 3'}
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
          {/* Player X Info - Bên trái */}
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
                {playerSymbol === 'X' 
                  ? (user?.user_metadata?.display_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Bạn')
                  : opponent.name
                }
              </div>
              <div className="player-rank" style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>
                {playerSymbol === 'X' ? (rank ?? 'Vô Danh') : opponent.rank}
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

          {/* VS Divider with Side Indicators */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}>
              <PlayerSideIndicator 
                side="X" 
                isActiveTurn={currentTurn === 'X'}
                isCurrentUser={playerSymbol === 'X'}
                size="small"
              />
              <span style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#666',
                padding: '0 4px'
              }}>VS</span>
              <PlayerSideIndicator 
                side="O" 
                isActiveTurn={currentTurn === 'O'}
                isCurrentUser={playerSymbol === 'O'}
                size="small"
              />
            </div>
          </div>

          {/* Player O Info - Bên phải */}
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
                {playerSymbol === 'O' 
                  ? (user?.user_metadata?.display_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Bạn')
                  : opponent.name
                }
              </div>
              <div className="player-rank" style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>
                {playerSymbol === 'O' ? (rank ?? 'Vô Danh') : opponent.rank}
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

      {/* Main Match Area */}
      <div className="match-main">
        {/* Left Sidebar - Move History */}
        {showMoveInfo && (
          <div className="match-sidebar left">
            <div className="sidebar-header">
              <h3>Lịch sử nước đi</h3>
              <button className="close-sidebar" onClick={() => setShowMoveInfo(false)}>✕</button>
            </div>
            <div className="move-history">
              {moveHistory.length === 0 ? (
                <div className="empty-history">Chưa có nước đi nào</div>
              ) : (
                moveHistory.map((move, index) => (
                  <div key={index} className={`move-item ${move.player === playerSymbol ? 'you' : 'opponent'}`}>
                    <span className="move-number">#{index + 1}</span>
                    <span className="move-player">{move.player}</span>
                    <span className="move-pos">({move.x}, {move.y})</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Center - Board */}
        <div className="match-board-container">
          {/* Board */}
          <div className="caro-board" style={{ 
            pointerEvents: (gameWinner || matchWinner) ? 'none' : 'auto',
            opacity: (gameWinner || matchWinner) ? 0.6 : 1
          }}>
            {board.map((row, y) => (
              <div key={y} className="board-row" style={{ display: 'flex' }}>
                {row.map((cell, x) => {
                  const isLastMove = lastMovePosition?.x === x && lastMovePosition?.y === y
                  // Only check if cell is empty and game is active - let server validate turn
                  const isClickable = !cell && !gameWinner && !matchWinner
                  
                  return (
                    <div
                      key={`${x}-${y}`}
                      className={`board-cell ${cell ? 'filled' : ''} ${
                        isClickable ? 'hoverable' : ''
                      } ${hoveredCell?.x === x && hoveredCell?.y === y ? 'hovered' : ''} ${
                        isLastMove ? 'last-move' : ''
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        console.log('🖱️ Cell div clicked!', x, y, 'isClickable:', isClickable)
                        handleCellClick(x, y)
                      }}
                      onMouseEnter={() => setHoveredCell({x, y})}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        cursor: isClickable ? 'pointer' : 'default',
                        ...(isLastMove ? {
                          boxShadow: '0 0 20px rgba(34, 211, 238, 0.6), inset 0 0 20px rgba(34, 211, 238, 0.3)',
                          animation: 'pulse 1.5s ease-in-out infinite'
                        } : {})
                      }}
                    >
                      {cell && (
                        <div className={`piece ${cell === 'X' ? 'piece-x' : 'piece-o'}`} style={
                          isLastMove ? {
                            transform: 'scale(1.15)',
                            filter: 'brightness(1.3)',
                            transition: 'all 0.3s ease'
                          } : {}
                        }>
                          {cell}
                        </div>
                      )}
                      {!cell && hoveredCell?.x === x && hoveredCell?.y === y && isClickable && (
                        <div className={`piece preview ${playerSymbol === 'X' ? 'piece-x' : 'piece-o'}`} style={{
                          opacity: 0.5
                        }}>
                          {playerSymbol}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Board Info */}
          <div className="board-info" style={{
            marginTop: '16px',
            textAlign: 'center',
            color: '#888',
            fontSize: '14px',
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <span>Nước đi: {moveHistory.length}</span>
            <span>•</span>
            <span>Chế độ: Rank</span>
            <span>•</span>
            <span>Bàn: 15×15</span>
            <span>•</span>
            <span style={{ 
              color: currentTurn === playerSymbol ? '#22D3EE' : '#F59E0B',
              fontWeight: 'bold'
            }}>
              {currentTurn === playerSymbol ? 'Lượt của bạn' : 'Lượt đối thủ'}
            </span>
          </div>
        </div>

        {/* Right Sidebar - Chat */}
        <div className={`match-sidebar right ${showChat ? 'open' : ''}`}>
          {!showChat ? (
            <button className="open-chat-btn" onClick={() => setShowChat(true)}>
              <span className="chat-icon">💬</span>
            </button>
          ) : (
            <>
              <div className="sidebar-header">
                <h3>Truyền Âm</h3>
                <button className="close-sidebar" onClick={() => setShowChat(false)}>✕</button>
              </div>
              <div className="chat-messages">
                {chat.messages.map((msg) => {
                  const isMe = msg.sender_user_id === user?.id
                  const isSystem = msg.message_type === 'system'
                  return (
                    <div key={msg.id} className={`chat-message ${isMe ? 'you' : isSystem ? 'system' : 'opponent'}`}>
                      <div className="chat-author">
                        {isSystem ? 'System' : isMe ? 'Bạn' : (msg.sender_profile?.display_name || msg.sender_profile?.username || 'Đối thủ')}
                      </div>
                      <div className="chat-text">{msg.content}</div>
                    </div>
                  )
                })}
              </div>
              <div className="chat-input-box">
                <input
                  type="text"
                  placeholder={t('room.typeMessage')}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                />
                <button onClick={handleSendChat}>{t('matchmaking.send')}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
