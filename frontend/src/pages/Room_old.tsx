import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import GameBoard from '../components/GameBoard'
import EmotePicker from '../components/EmotePicker'

interface Player {
  id: string
  username: string
  avatar: string
  rank: string
  elo: number
  side: 'X' | 'O'
}

interface Emote {
  id: string
  player: 'X' | 'O'
  emoji: string
  timestamp: number
}

interface Move {
  x: number
  y: number
  player: 'X' | 'O'
  timestamp: number
}

export default function Room() {
  const [user, setUser] = useState<any>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [matchData, setMatchData] = useState<any>(null)
  
  const [players, setPlayers] = useState<Player[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  
  const [emotes, setEmotes] = useState<Emote[]>([])
  const [currentTurn, setCurrentTurn] = useState<'X' | 'O'>('X')
  const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting')
  const [winner, setWinner] = useState<'X' | 'O' | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  
  const [board, setBoard] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState<{ X: number; O: number }>({ X: 300, O: 300 }) // 5 minutes each

  // Load match data from localStorage and Supabase
  useEffect(() => {
    loadMatchData()
  }, [])

  async function loadMatchData() {
    try {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        console.error('No user logged in')
        window.location.hash = '#home'
        return
      }
      setUser(currentUser)
      setCurrentUserId(currentUser.id)

      // Get match data from localStorage
      const matchStr = localStorage.getItem('currentMatch')
      if (!matchStr) {
        console.error('No match data found')
        window.location.hash = '#home'
        return
      }

      const match = JSON.parse(matchStr)
      setMatchData(match)
      setRoomId(match.roomId)

      // Load room and players from Supabase
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', match.roomId)
        .single()

      if (roomError || !room) {
        console.error('Room not found:', roomError)
        return
      }

      // Load room players
      const { data: roomPlayers, error: playersError } = await supabase
        .from('room_players')
        .select('user_id, player_side')
        .eq('room_id', match.roomId)

      if (playersError || !roomPlayers || roomPlayers.length !== 2) {
        console.error('Players not found:', playersError)
        return
      }

      // Load profiles for both players
      const playerIds = roomPlayers.map(p => p.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, current_rank, mindpoint, avatar_url')
        .in('user_id', playerIds)

      if (profiles) {
        const playersData: Player[] = roomPlayers.map(rp => {
          const profile = profiles.find(p => p.user_id === rp.user_id)
          return {
            id: rp.user_id,
            username: profile?.display_name || profile?.username || 'Player',
            avatar: profile?.avatar_url || '👤',
            rank: profile?.current_rank || 'Vô Danh',
            elo: profile?.mindpoint || 1000,
            side: rp.player_side as 'X' | 'O'
          }
        })
        
        setPlayers(playersData)
        
        // Only start game if we have 2 players
        if (playersData.length === 2) {
          setGameStatus('playing')
          setGameStarted(true)
          console.log('✅ Room loaded with 2 players, game starting!')
        } else {
          console.log('⏳ Waiting for second player...')
        }
        
        console.log('✅ Room loaded:', playersData)
      }

      // Subscribe to realtime updates
      subscribeToRealtime(match.roomId)

    } catch (error) {
      console.error('Error loading match:', error)
    }
  }

  function subscribeToRealtime(roomId: string) {
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'moves',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          console.log('New move:', payload)
          const move = payload.new as any
          handleOpponentMove(move)
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
          console.log('Match updated:', payload)
          const match = payload.new as any
          if (match.winner) {
            setWinner(match.winner)
            setGameStatus('finished')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  function handleOpponentMove(move: any) {
    const key = `${move.x}_${move.y}`
    setBoard(prev => ({ ...prev, [key]: move.player }))
    setCurrentTurn(move.player === 'X' ? 'O' : 'X')
  }

  // Timer countdown
  useEffect(() => {
    if (gameStatus !== 'playing' || !gameStarted) return

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = { ...prev }
        if (currentTurn === 'X') {
          newTime.X = Math.max(0, newTime.X - 1)
          if (newTime.X === 0) {
            handleTimeout('X')
          }
        } else {
          newTime.O = Math.max(0, newTime.O - 1)
          if (newTime.O === 0) {
            handleTimeout('O')
          }
        }
        return newTime
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [gameStatus, currentTurn, gameStarted])

  async function handleTimeout(player: 'X' | 'O') {
    const winnerSide = player === 'X' ? 'O' : 'X'
    setWinner(winnerSide)
    setGameStatus('finished')

    // Update match in database
    if (roomId) {
      await supabase
        .from('matches')
        .update({ 
          winner: winnerSide,
          end_reason: 'timeout',
          ended_at: new Date().toISOString()
        })
        .eq('room_id', roomId)
    }
  }

  // Auto-remove emotes after 3 seconds
  useEffect(() => {
    if (emotes.length === 0) return

    const timer = setTimeout(() => {
      const now = Date.now()
      setEmotes(prev => prev.filter(e => now - e.timestamp < 3000))
    }, 100)

    return () => clearTimeout(timer)
  }, [emotes])

  async function handleMove(x: number, y: number, player: 'X' | 'O') {
    if (!roomId || !user) return
    
    // Check if it's current player's turn
    const currentPlayer = players.find(p => p.id === user.id)
    if (!currentPlayer || currentPlayer.side !== player) {
      console.log('Not your turn!')
      return
    }

    if (currentTurn !== player) {
      console.log('Not this side\'s turn!')
      return
    }

    // Save move to database
    const { error } = await supabase
      .from('moves')
      .insert({
        room_id: roomId,
        match_id: matchData?.matchId,
        player: player,
        x: x,
        y: y,
        move_number: Object.keys(board).length + 1
      })

    if (error) {
      console.error('Error saving move:', error)
      return
    }

    // Update local state
    const key = `${x}_${y}`
    setBoard(prev => ({ ...prev, [key]: player }))
    setCurrentTurn(player === 'X' ? 'O' : 'X')
  }

  async function handleWin(winnerSide: 'X' | 'O', chain: Array<[number, number]>) {
    setWinner(winnerSide)
    setGameStatus('finished')

    if (!roomId) return

    // Update match in database
    await supabase
      .from('matches')
      .update({
        winner: winnerSide,
        end_reason: 'checkmate',
        ended_at: new Date().toISOString(),
        winning_line: chain
      })
      .eq('room_id', roomId)

    // Update player stats
    const winnerPlayer = players.find(p => p.side === winnerSide)
    const loserPlayer = players.find(p => p.side !== winnerSide)

    if (winnerPlayer && loserPlayer) {
      // Update winner
      await supabase.rpc('update_player_stats', {
        p_user_id: winnerPlayer.id,
        p_result: 'win'
      })

      // Update loser
      await supabase.rpc('update_player_stats', {
        p_user_id: loserPlayer.id,
        p_result: 'loss'
      })
    }
  }

  const handleReset = () => {
    // Room doesn't support reset in real match
    // Would need to create new match
  }

  const getPlayerBySide = (side: 'X' | 'O'): Player | undefined => {
    return players.find(p => p.side === side)
  }

  const getCurrentPlayer = (): Player | undefined => {
    return players.find(p => p.id === currentUserId)
  }

  const getOpponent = (): Player | undefined => {
    return players.find(p => p.id !== currentUserId)
  }

  const handleEmote = async (side: 'X' | 'O', emoji: string) => {
    const newEmote: Emote = {
      id: `${Date.now()}_${Math.random()}`,
      player: side,
      emoji,
      timestamp: Date.now()
    }
    setEmotes(prev => [...prev, newEmote])
  }

  const handleSwapSides = async () => {
    if (gameStarted) return // Can't swap after game starts
    
    // Swap sides in local state
    setPlayers(prev => [
      { ...prev[0], side: prev[0].side === 'X' ? 'O' : 'X' },
      { ...prev[1], side: prev[1].side === 'X' ? 'O' : 'X' }
    ])

    // TODO: Update in database if needed
    console.log('🔄 Swapped sides')
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const renderPlayerCard = (side: 'X' | 'O') => {
    const player = getPlayerBySide(side)
    if (!player) return null
    
    const isCurrentTurn = currentTurn === side && gameStatus === 'playing'
    const isWinner = winner === side
    const position = side === 'X' ? 'left' : 'right'
    const isCurrentPlayer = player.id === currentUserId
    const playerTime = timeLeft[side]

    return (
      <div style={{
        background: isWinner 
          ? 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.1))'
          : isCurrentTurn
          ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(79,70,229,0.1))'
          : 'linear-gradient(135deg, rgba(30,30,60,0.8), rgba(20,20,40,0.6))',
        border: isWinner
          ? '2px solid gold'
          : isCurrentTurn 
          ? '2px solid rgba(99,102,241,0.6)' 
          : '2px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '20px',
        minWidth: '200px',
        boxShadow: isCurrentTurn 
          ? '0 0 20px rgba(99,102,241,0.3)' 
          : '0 4px 12px rgba(0,0,0,0.3)',
        transition: 'all 0.3s ease',
        animation: isCurrentTurn ? 'pulse 2s ease infinite' : 'none',
        position: 'relative' as const
      }}>
        {/* Turn indicator */}
        {isCurrentTurn && (
          <div style={{
            position: 'absolute',
            top: '-12px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 'bold',
            boxShadow: '0 2px 8px rgba(99,102,241,0.5)'
          }}>
            ⏱️ Lượt đi
          </div>
        )}

        {/* Winner badge */}
        {isWinner && (
          <div style={{
            position: 'absolute',
            top: '-12px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, gold, #fbbf24)',
            color: '#000',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 'bold',
            boxShadow: '0 2px 8px rgba(255,215,0,0.5)'
          }}>
            🏆 Thắng
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Avatar with piece indicator */}
          <div style={{ position: 'relative' }}>
            {/* Main avatar circle */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: side === 'X' 
                ? 'linear-gradient(135deg, #1e293b, #0f172a)'
                : 'linear-gradient(135deg, #422006, #292524)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              border: '3px solid ' + (side === 'X' ? '#3b82f6' : '#ef4444'),
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              position: 'relative'
            }}>
              {player.avatar}
            </div>
            
            {/* Piece indicator badge */}
            <div style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: side === 'X'
                ? 'radial-gradient(circle at 30% 30%, #06b6d4, #0891b2)'
                : 'radial-gradient(circle at 30% 30%, #f97316, #ea580c)',
              border: '2px solid ' + (side === 'X' ? '#0891b2' : '#ea580c'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold',
              color: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              zIndex: 2
            }}>
              {side === 'X' ? 'X' : 'O'}
            </div>
            
            {/* Emote picker button */}
            <div style={{
              position: 'absolute',
              bottom: '-8px',
              [position]: '-8px'
            }}>
              <EmotePicker 
                onEmoteSelect={(emoji) => handleEmote(side, emoji)}
                position={position}
              />
            </div>
          </div>

          {/* Player info */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {player.username}
              {isCurrentPlayer && (
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderRadius: '12px',
                  fontWeight: 'bold'
                }}>
                  Bạn
                </span>
              )}
            </div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.7)',
              marginBottom: '2px'
            }}>
              {player.rank}
            </div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255,215,0,0.9)',
              fontWeight: 'bold'
            }}>
              Elo: {player.elo}
            </div>
          </div>
        </div>

        {/* Timer display */}
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: playerTime < 30 
            ? 'linear-gradient(135deg, rgba(239,68,68,0.3), rgba(220,38,38,0.2))'
            : 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.1))',
          border: `2px solid ${playerTime < 30 ? 'rgba(239,68,68,0.6)' : 'rgba(16,185,129,0.4)'}`,
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '24px',
          fontWeight: 'bold',
          color: playerTime < 30 ? '#f87171' : '#34d399',
          fontFamily: 'monospace',
          letterSpacing: '2px',
          boxShadow: isCurrentTurn ? '0 0 20px rgba(99,102,241,0.4)' : 'none'
        }}>
          ⏱️ {formatTime(playerTime)}
        </div>

        {/* Side indicator */}
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: side === 'X' 
            ? 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.1))'
            : 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.1))',
          border: `2px solid ${side === 'X' ? 'rgba(59,130,246,0.4)' : 'rgba(239,68,68,0.4)'}`,
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
          color: side === 'X' ? '#60a5fa' : '#f87171',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          {side === 'X' ? '⚫ Quân Đen (Đi trước)' : '⚪ Quân Trắng (Đi sau)'}
        </div>

        {/* Active emote display */}
        {emotes.filter(e => e.player === side && Date.now() - e.timestamp < 3000).map(emote => (
          <div
            key={emote.id}
            style={{
              position: 'absolute',
              top: '-40px',
              right: side === 'X' ? '-40px' : 'auto',
              left: side === 'O' ? '-40px' : 'auto',
              fontSize: '32px',
              animation: 'emoteFloat 3s ease',
              pointerEvents: 'none',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
            }}
          >
            {emote.emoji}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="app-container">
      {/* Breadcrumb Navigation */}
      <nav style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '13px', 
        color: 'var(--color-muted)',
        marginBottom: '16px',
        paddingLeft: '24px'
      }}>
        <a 
          href="#home" 
          style={{ 
            color: 'var(--color-muted)', 
            textDecoration: 'none',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-muted)'}
        >
          Chánh Điện
        </a>
        <span style={{ color: 'var(--color-muted)' }}>›</span>
        <span style={{ color: 'var(--color-text)' }}>Phòng Đấu</span>
      </nav>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '30px',
        padding: '20px',
        minHeight: 'calc(100vh - 100px)'
      }}>
        {/* Room header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(30,30,60,0.9), rgba(20,20,40,0.8))',
          border: '2px solid rgba(255,215,0,0.3)',
          borderRadius: '12px',
          padding: '16px 32px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          textAlign: 'center'
        }}>
          <h2 style={{
            margin: '0 0 8px 0',
            fontSize: '20px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            ⚔️ Trận Đấu Cờ Caro
          </h2>
          {!gameStarted && getCurrentPlayer() && getOpponent() && (
            <div style={{
              fontSize: '12px',
              color: 'rgba(255,215,0,0.8)',
              marginTop: '4px'
            }}>
              💡 Nhấn "🔄 Đổi quân" để hoán đổi quân cờ trước khi bắt đầu
              <br/>
              <span style={{ fontSize: '11px', opacity: 0.7 }}>
                (Bạn: {getCurrentPlayer()?.username} - {getCurrentPlayer()?.side === 'X' ? '⚫ Đen' : '⚪ Trắng'} | 
                Đối thủ: {getOpponent()?.username} - {getOpponent()?.side === 'X' ? '⚫ Đen' : '⚪ Trắng'})
              </span>
            </div>
          )}
        </div>

        {/* Game layout */}
        <div style={{
          display: 'flex',
          gap: '40px',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          position: 'relative'
        }}>
          {/* Current Player (You) - Always on left */}
          {getCurrentPlayer() && renderPlayerCard(getCurrentPlayer()!.side)}

          {/* Swap sides button (between players) */}
          <div style={{
            position: 'absolute',
            top: '-50px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10
          }}>
            <button
              onClick={handleSwapSides}
              disabled={gameStarted}
              style={{
                padding: '8px 16px',
                background: gameStarted 
                  ? 'rgba(100,100,100,0.3)' 
                  : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: gameStarted ? 'rgba(255,255,255,0.4)' : 'white',
                border: gameStarted ? '2px solid rgba(255,255,255,0.2)' : '2px solid rgba(255,215,0,0.5)',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: gameStarted ? 'not-allowed' : 'pointer',
                boxShadow: gameStarted ? 'none' : '0 4px 12px rgba(245,158,11,0.4)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                if (!gameStarted) e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                if (!gameStarted) e.currentTarget.style.transform = 'scale(1)'
              }}
              title={gameStarted ? 'Không thể đổi quân sau khi bắt đầu' : 'Đổi quân cờ giữa 2 người chơi'}
            >
              🔄 Đổi quân
            </button>
          </div>

          {/* Game Board */}
          <GameBoard 
            size={15}
            enableForbidden={true}
            board={board}
            currentPlayer={currentTurn}
            disabled={gameStatus !== 'playing' || getCurrentPlayer()?.side !== currentTurn}
            onMove={handleMove}
            onWin={handleWin}
            onReset={handleReset}
          />

          {/* Opponent - Always on right */}
          {getOpponent() && renderPlayerCard(getOpponent()!.side)}
        </div>

        {/* Game controls */}
        <div style={{
          display: 'flex',
          gap: '12px'
        }}>
          <button
            onClick={() => window.location.hash = '#lobby'}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🚪 Rời phòng
          </button>

          <button
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16,185,129,0.4)',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            💬 Chat
          </button>

          <button
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(139,92,246,0.4)',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            ⚙️ Cài đặt
          </button>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(99,102,241,0.3); }
          50% { box-shadow: 0 0 40px rgba(99,102,241,0.6); }
        }
        
        @keyframes emoteFloat {
          0% { 
            transform: translateY(0) scale(0.5); 
            opacity: 0;
          }
          20% { 
            transform: translateY(-10px) scale(1); 
            opacity: 1;
          }
          80% { 
            transform: translateY(-30px) scale(1); 
            opacity: 1;
          }
          100% { 
            transform: translateY(-50px) scale(0.5); 
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
