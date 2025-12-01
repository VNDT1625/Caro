import { supabase } from './supabase'

/**
 * Send friend request
 */
export async function sendFriendRequest(
  senderId: string,
  receiverId: string,
  message?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if already friends
    const { data: existingFriendship } = await supabase
      .from('friendships')
      .select('id')
      .or(`and(user_id.eq.${senderId},friend_id.eq.${receiverId}),and(user_id.eq.${receiverId},friend_id.eq.${senderId})`)
      .eq('status', 'accepted')
      .maybeSingle()

    if (existingFriendship) {
      return { success: false, error: 'Already friends' }
    }

    // Check if request already exists
    const { data: existingRequest } = await supabase
      .from('friend_requests')
      .select('id, status')
      .eq('sender_id', senderId)
      .eq('receiver_id', receiverId)
      .maybeSingle()

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return { success: false, error: 'Request already sent' }
      }
    }

    // Send new request
    const { error } = await supabase
      .from('friend_requests')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        message: message || null,
        status: 'pending'
      })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Accept friend request
 */
export async function acceptFriendRequest(
  requestId: string,
  receiverId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the request
    const { data: request, error: fetchError } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id')
      .eq('id', requestId)
      .eq('receiver_id', receiverId)
      .eq('status', 'pending')
      .single()

    if (fetchError || !request) {
      return { success: false, error: 'Request not found' }
    }

    // Update request status
    const { error: updateError } = await supabase
      .from('friend_requests')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString()
      })
      .eq('id', requestId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Create friendship (bidirectional)
    const { error: friendshipError } = await supabase
      .from('friendships')
      .insert([
        {
          user_id: request.sender_id,
          friend_id: request.receiver_id,
          status: 'accepted'
        },
        {
          user_id: request.receiver_id,
          friend_id: request.sender_id,
          status: 'accepted'
        }
      ])

    if (friendshipError) {
      return { success: false, error: friendshipError.message }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Decline friend request
 */
export async function declineFriendRequest(
  requestId: string,
  receiverId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('friend_requests')
      .update({
        status: 'declined',
        responded_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .eq('receiver_id', receiverId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Remove friend
 */
export async function removeFriend(
  userId: string,
  friendId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete both directions of friendship
    const { error } = await supabase
      .from('friendships')
      .delete()
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Block user
 */
export async function blockUser(
  blockerId: string,
  blockedId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Remove friendship if exists
    await removeFriend(blockerId, blockedId)

    // Add to blocked list
    const { error } = await supabase
      .from('blocked_users')
      .insert({
        blocker_id: blockerId,
        blocked_id: blockedId,
        reason: reason || null
      })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Unblock user
 */
export async function unblockUser(
  blockerId: string,
  blockedId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Get friend list
 */
export async function getFriends(userId: string) {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        friend_id,
        profiles:friend_id (
          user_id,
          username,
          display_name,
          current_rank,
          mindpoint,
          avatar_url,
          is_online
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'accepted')

    if (error) {
      return { success: false, error: error.message, friends: [] }
    }

    const friends = data?.map((f: any) => ({
      id: f.profiles.user_id,
      username: f.profiles.display_name || f.profiles.username,
      rank: f.profiles.current_rank || 'Vô Danh',
      mindpoint: f.profiles.mindpoint || 0,
      avatar: f.profiles.avatar_url || '',
      isOnline: f.profiles.is_online || false
    })) || []

    return { success: true, friends }
  } catch (err: any) {
    return { success: false, error: err.message, friends: [] }
  }
}

/**
 * Get pending friend requests (received)
 */
export async function getPendingRequests(userId: string) {
  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        id,
        sender_id,
        message,
        created_at,
        profiles:sender_id (
          username,
          display_name,
          current_rank,
          avatar_url
        )
      `)
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message, requests: [] }
    }

    return { success: true, requests: data || [] }
  } catch (err: any) {
    return { success: false, error: err.message, requests: [] }
  }
}

/**
 * Get blocked users
 */
export async function getBlockedUsers(userId: string) {
  try {
    const { data, error } = await supabase
      .from('blocked_users')
      .select(`
        id,
        blocked_id,
        reason,
        created_at,
        profiles:blocked_id (
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('blocker_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message, blocked: [] }
    }

    return { success: true, blocked: data || [] }
  } catch (err: any) {
    return { success: false, error: err.message, blocked: [] }
  }
}

/**
 * Check if user is blocked
 */
export async function isUserBlocked(
  userId: string,
  targetId: string
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('blocked_users')
      .select('id')
      .or(`and(blocker_id.eq.${userId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${userId})`)
      .maybeSingle()

    return !!data
  } catch {
    return false
  }
}

/**
 * Subscribe to friend requests
 */
export function subscribeFriendRequests(
  userId: string,
  onRequest: (request: any) => void
) {
  const channel = supabase
    .channel('friend_requests')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'friend_requests',
        filter: `receiver_id=eq.${userId}`
      },
      (payload) => {
        onRequest(payload.new)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
