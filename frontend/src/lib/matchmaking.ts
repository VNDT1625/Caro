import { supabase } from './supabase'

export interface MatchmakingSettings {
  mode: 'rank' | 'casual' | 'ai' | 'tournament'
  gameType: string
  boardSize: string
  winCondition: number
  turnTime: number
  totalTime: number
}

export interface MatchmakingResult {
  success: boolean
  matchId?: string
  opponentId?: string
  opponent?: {
    id: string
    username: string
    displayName: string
    rank: string
    mindpoint: number
    avatar?: string
  }
  roomId?: string
  queueId?: string
  opponentQueueId?: string
  error?: string
}

/**
 * Check if user has been matched via queue (not room yet)
 */
export async function checkQueueMatched(userId: string, queueId: string): Promise<MatchmakingResult> {
  try {
    const { data: queueEntry, error } = await supabase
      .from('matchmaking_queue')
      .select('id, status, matched_with, matched_at')
      .eq('id', queueId)
      .single()

    if (error || !queueEntry) {
      return { success: false, error: 'Queue entry not found' }
    }

    if (queueEntry.status === 'matched' && queueEntry.matched_with) {
      // Fetch opponent profile
      const { data: opponentProfile } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, current_rank, mindpoint, avatar_url')
        .eq('user_id', queueEntry.matched_with)
        .single()

      if (opponentProfile) {
        console.log('✅ Detected matched via queue:', opponentProfile.display_name || opponentProfile.username)
        return {
          success: true,
          opponentId: opponentProfile.user_id,
          opponent: {
            id: opponentProfile.user_id,
            username: opponentProfile.username || 'Player',
            displayName: opponentProfile.display_name || opponentProfile.username || 'Người chơi',
            rank: opponentProfile.current_rank || 'Vô Danh',
            mindpoint: opponentProfile.mindpoint || 0,
            avatar: opponentProfile.avatar_url || ''
          }
        }
      }
    }

    return { success: false, error: 'Not matched yet' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Check if user has been matched and added to a room by another player
 */
export async function checkIfMatched(userId: string): Promise<MatchmakingResult> {
  try {
    // Check if user is in any room
    const { data: roomPlayer, error: roomPlayerError } = await supabase
      .from('room_players')
      .select('room_id, player_side, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (roomPlayerError || !roomPlayer) {
      return { success: false, error: 'Not matched yet' }
    }

    // Get room info separately
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, owner_user_id, room_name, mode, status')
      .eq('id', roomPlayer.room_id)
      .single()

    if (roomError || !room) {
      return { success: false, error: 'Room not found' }
    }
    
    // Get opponent info
    const { data: opponentPlayer } = await supabase
      .from('room_players')
      .select('user_id')
      .eq('room_id', room.id)
      .neq('user_id', userId)
      .single()

    if (!opponentPlayer) {
      return { success: false, error: 'Opponent not found' }
    }

    // Get opponent profile
    const { data: opponentProfile } = await supabase
      .from('profiles')
      .select('user_id, username, display_name, current_rank, mindpoint, avatar_url')
      .eq('user_id', opponentPlayer.user_id)
      .single()

    if (!opponentProfile) {
      return { success: false, error: 'Opponent profile not found' }
    }

    console.log('✅ checkIfMatched success:', {
      roomId: room.id,
      opponent: opponentProfile.display_name || opponentProfile.username
    })

    return {
      success: true,
      roomId: room.id,
      opponentId: opponentProfile.user_id,
      opponent: {
        id: opponentProfile.user_id,
        username: opponentProfile.username || 'Player',
        displayName: opponentProfile.display_name || opponentProfile.username || 'Người chơi',
        rank: opponentProfile.current_rank || 'Vô Danh',
        mindpoint: opponentProfile.mindpoint || 0,
        avatar: opponentProfile.avatar_url || ''
      }
    }
  } catch (err: any) {
    console.error('checkIfMatched error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Join matchmaking queue - add user to queue and start polling
 */
export async function joinMatchmakingQueue(
  userId: string,
  settings: MatchmakingSettings
): Promise<{ success: boolean; queueId?: string; error?: string }> {
  try {
    // Get user's current ELO/mindpoint
    const { data: profile } = await supabase
      .from('profiles')
      .select('elo_rating, mindpoint, current_rank')
      .eq('user_id', userId)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    // Default ELO for new users
    const userElo = profile.elo_rating || profile.mindpoint || 1000

    // Insert into matchmaking queue
    const { data: queueEntry, error } = await supabase
      .from('matchmaking_queue')
      .insert({
        user_id: userId,
        mode: settings.mode,
        elo_rating: userElo,
        preferred_settings: settings,
        status: 'waiting',
        joined_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Queue insert error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, queueId: queueEntry.id }
  } catch (err: any) {
    console.error('Join queue error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Find match - look for opponent in queue with similar ELO
 */
export async function findMatch(
  userId: string,
  queueId: string,
  settings: MatchmakingSettings
): Promise<MatchmakingResult> {
  try {
    // Get user's ELO
    const { data: profile } = await supabase
      .from('profiles')
      .select('elo_rating, mindpoint')
      .eq('user_id', userId)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    const userElo = profile.elo_rating || profile.mindpoint || 1000
    
    // Normalize mode: 'rank' -> 'ranked' for database
    const dbMode = settings.mode === 'rank' ? 'ranked' : settings.mode

    // Find opponents in queue (same mode, similar ELO, not yourself)
    const eloRange = 200 // ±200 ELO range
    
    console.log('🔍 Searching for opponents:', {
      myUserId: userId,
      myElo: userElo,
      mode: dbMode,
      eloRange: [userElo - eloRange, userElo + eloRange]
    })
    
    // First, get all waiting entries to see what's available
    const { data: allWaiting, error: debugError } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('status', 'waiting')
    
    console.log('🔎 All waiting entries:', allWaiting)
    
    const { data: potentialOpponents, error } = await supabase
      .from('matchmaking_queue')
      .select(`
        id,
        user_id,
        elo_rating,
        joined_at,
        status,
        mode
      `)
      .eq('mode', settings.mode) // Use original mode from settings for query
      .eq('status', 'waiting')
      .neq('user_id', userId)
      .gte('elo_rating', userElo - eloRange)
      .lte('elo_rating', userElo + eloRange)
      .order('joined_at', { ascending: true })
      .order('id', { ascending: true }) // Secondary sort by ID for deterministic ordering
      .limit(10)

    console.log('📊 Query result:', { 
      found: potentialOpponents?.length || 0, 
      opponents: potentialOpponents,
      error 
    })
    
    // If we found opponents, fetch their profiles separately
    if (potentialOpponents && potentialOpponents.length > 0) {
      const opponentUserIds = potentialOpponents.map(o => o.user_id)
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, current_rank, mindpoint, avatar_url, elo_rating')
        .in('user_id', opponentUserIds)
      
      console.log('👥 Fetched profiles:', profiles, 'Error:', profileError)
      
      if (profileError) {
        console.error('Profile fetch error:', profileError)
      }
      
      // Merge profiles into opponents with NULL handling
      potentialOpponents.forEach((opp: any) => {
        const profile = profiles?.find(p => p.user_id === opp.user_id)
        if (profile) {
          // Handle NULL values
          opp.profile = {
            ...profile,
            username: profile.username || 'Player',
            display_name: profile.display_name || profile.username || 'Người chơi',
            current_rank: profile.current_rank || 'Vô Danh'
          }
        }
      })
    }
    
    // Log why each waiting entry was skipped
    if (allWaiting && allWaiting.length > 0) {
      allWaiting.forEach((entry: any) => {
        const reasons = []
        if (entry.user_id === userId) reasons.push('❌ Same user')
        if (entry.mode !== settings.mode) reasons.push(`❌ Different mode (${entry.mode} vs ${settings.mode})`)
        if (entry.status !== 'waiting') reasons.push(`❌ Not waiting (${entry.status})`)
        if (entry.elo_rating < userElo - eloRange || entry.elo_rating > userElo + eloRange) {
          reasons.push(`❌ ELO out of range (${entry.elo_rating} vs ${userElo}±${eloRange})`)
        }
        
        if (reasons.length > 0) {
          console.log(`⏭️ Skipped entry ${entry.id.substring(0, 8)}:`, reasons.join(', '))
        } else {
          console.log(`✅ Valid opponent ${entry.id.substring(0, 8)} but not returned by query - possible RLS issue`)
        }
      })
    }

    if (error) {
      console.error('Find match error:', error)
      return { success: false, error: error.message }
    }

    if (!potentialOpponents || potentialOpponents.length === 0) {
      console.log('❌ No valid opponents found')
      return { success: false, error: 'No opponents found' }
    }

    // Pick first opponent
    const opponentQueue: any = potentialOpponents[0]
    const opponentProfile = opponentQueue.profile
    
    // Validate opponent data
    if (!opponentProfile) {
      console.error('❌ Opponent has no profile data')
      return { success: false, error: 'Opponent profile not found' }
    }

    console.log('✅ Match found!', {
      opponent: opponentProfile.display_name || opponentProfile.username,
      rank: opponentProfile.current_rank || 'Vô Danh',
      elo: opponentQueue.elo_rating
    })

    // CRITICAL: Atomically mark both queue entries as matched using an RPC
    // This reduces race conditions and avoids partial updates if one update fails
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('match_players', { a: queueId, b: opponentQueue.id, a_user: userId, b_user: opponentQueue.user_id })

      if (rpcError) {
        console.error('RPC match_players error:', rpcError)
        return { success: false, error: rpcError.message }
      }

      // Check if match was successful (RPC returns boolean)
      if (rpcData === false) {
        console.log('⚠️ Opponent already matched by someone else, retrying...')
        return { success: false, error: 'Opponent already matched' }
      }

      console.log('✅ RPC match_players success')
    } catch (err: any) {
      console.error('Match update exception:', err)
      return { success: false, error: err.message }
    }

    // Return match info WITHOUT creating room yet
    // Room will be created when both players click "SẴN SÀNG"
    return {
      success: true,
      opponentId: opponentQueue.user_id,
      opponent: {
        id: opponentQueue.user_id,
        username: opponentProfile.username || 'Player',
        displayName: opponentProfile.display_name || opponentProfile.username || 'Người chơi',
        rank: opponentProfile.current_rank || 'Vô Danh',
        mindpoint: opponentProfile.mindpoint || 0,
        avatar: opponentProfile.avatar_url || ''
      },
      queueId: queueId,
      opponentQueueId: opponentQueue.id
    }
  } catch (err: any) {
    console.error('Find match error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Cancel matchmaking - remove from queue
 */
export async function cancelMatchmaking(queueId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('matchmaking_queue')
      .update({ status: 'cancelled' })
      .eq('id', queueId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Subscribe to matchmaking updates using Realtime
 */
export function subscribeToMatchmaking(
  userId: string,
  onMatch: (data: any) => void,
  onError: (error: any) => void
) {
  const channel = supabase
    .channel(`matchmaking:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'matchmaking_queue',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        if (payload.new.status === 'matched') {
          onMatch(payload.new)
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Subscribed to matchmaking updates')
      } else if (status === 'CHANNEL_ERROR') {
        onError(new Error('Failed to subscribe to matchmaking'))
      }
    })

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Create room when both players are ready
 */
export async function createMatchRoom(
  userId: string,
  opponentId: string,
  settings: MatchmakingSettings
): Promise<{ success: boolean; roomId?: string; error?: string }> {
  try {
    console.log('Creating room for match...', { userId, opponentId })

    // CRITICAL: Check if room already exists for these 2 players
    const { data: existingRooms } = await supabase
      .from('room_players')
      .select('room_id, rooms!inner(*)')
      .or(`user_id.eq.${userId},user_id.eq.${opponentId}`)
      .eq('rooms.status', 'full')
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingRooms && existingRooms.length > 0) {
      const roomId = existingRooms[0].room_id
      console.log('⚠️ Room already exists:', roomId)
      return { success: true, roomId }
    }

    // Create room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        owner_user_id: userId,
        room_name: `Match ${new Date().getTime()}`,
        mode: settings.mode === 'rank' ? 'ranked' : settings.mode,
        is_private: false,
        max_players: 2,
        current_players: 0,
        status: 'waiting',
        board_size: parseInt(settings.boardSize) || 15,
        win_length: settings.winCondition || 5,
        time_per_move: settings.turnTime || 30
      })
      .select()
      .single()

    if (roomError || !room) {
      console.error('Create room error:', roomError)
      return { success: false, error: roomError?.message || 'Failed to create room' }
    }

    // Add both players to room
    const { error: playersError } = await supabase
      .from('room_players')
      .insert([
        {
          room_id: room.id,
          user_id: userId,
          player_side: 'X',
          is_ready: false
        },
        {
          room_id: room.id,
          user_id: opponentId,
          player_side: 'O',
          is_ready: false
        }
      ])

    if (playersError) {
      console.error('Add players error:', playersError)
      // Try to delete the room if player addition failed
      await supabase.from('rooms').delete().eq('id', room.id)
      return { success: false, error: playersError.message }
    }

    // Update room player count
    await supabase
      .from('rooms')
      .update({ current_players: 2, status: 'full' })
      .eq('id', room.id)

    // CRITICAL: Create match record immediately
    console.log('Creating match record for room:', room.id)
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        room_id: room.id,
        match_type: settings.mode === 'rank' ? 'ranked' : 'casual',
        player_x_user_id: userId,
        player_o_user_id: opponentId,
        board_size: parseInt(settings.boardSize) || 15,
        win_length: settings.winCondition || 5,
        started_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (matchError) {
      console.error('⚠️ Warning: Failed to create match:', matchError)
      // Don't fail the whole operation, match can be created later
    } else {
      console.log('✅ Match created:', match.id)
    }

    console.log('✅ Room created successfully:', room.id)
    return { success: true, roomId: room.id }
  } catch (err: any) {
    console.error('createMatchRoom error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Get queue position
 */
export async function getQueuePosition(
  queueId: string,
  mode: string
): Promise<{ position: number; error?: string }> {
  try {
    const { data: queueEntry } = await supabase
      .from('matchmaking_queue')
      .select('joined_at')
      .eq('id', queueId)
      .single()

    if (!queueEntry) {
      return { position: -1, error: 'Queue entry not found' }
    }

    const { count } = await supabase
      .from('matchmaking_queue')
      .select('*', { count: 'exact', head: true })
      .eq('mode', mode)
      .eq('status', 'waiting')
      .lt('joined_at', queueEntry.joined_at)

    return { position: (count || 0) + 1 }
  } catch (err: any) {
    return { position: -1, error: err.message }
  }
}
