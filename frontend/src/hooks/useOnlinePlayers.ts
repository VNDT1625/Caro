/**
 * useOnlinePlayers - Hook to track online players via Supabase Presence
 * 
 * Features:
 * - Real-time online player tracking
 * - Filter by search query, rank, friends only
 * - Count breakdown by rank
 * 
 * Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 4.1, 4.2
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface OnlinePlayer {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  rank: string
  is_friend: boolean
  last_active: string
  page?: string
}

export interface UseOnlinePlayersOptions {
  userId: string | null
  friendsOnly?: boolean
  rankFilter?: string | null
  searchQuery?: string
  enabled?: boolean
}

export interface UseOnlinePlayersReturn {
  players: OnlinePlayer[]
  totalCount: number
  countByRank: Record<string, number>
  loading: boolean
  error: Error | null
  refresh: () => void
}

interface PresenceState {
  user_id: string
  username?: string
  display_name?: string
  avatar_url?: string
  rank?: string
  online_at: string
  page?: string
}

// Filter functions - exported for testing
export function filterBySearch(players: OnlinePlayer[], query: string): OnlinePlayer[] {
  if (!query || query.trim() === '') return players
  const lowerQuery = query.toLowerCase().trim()
  return players.filter(p => 
    p.username.toLowerCase().includes(lowerQuery) ||
    (p.display_name && p.display_name.toLowerCase().includes(lowerQuery))
  )
}

export function filterByRank(players: OnlinePlayer[], rank: string | null): OnlinePlayer[] {
  if (!rank) return players
  return players.filter(p => p.rank === rank)
}

export function filterByFriends(players: OnlinePlayer[], friendsOnly: boolean): OnlinePlayer[] {
  if (!friendsOnly) return players
  return players.filter(p => p.is_friend)
}

export function countByRank(players: OnlinePlayer[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of players) {
    const rank = p.rank || 'vo_danh'
    counts[rank] = (counts[rank] || 0) + 1
  }
  return counts
}

export function useOnlinePlayers(options: UseOnlinePlayersOptions): UseOnlinePlayersReturn {
  const { userId, friendsOnly = false, rankFilter = null, searchQuery = '', enabled = true } = options
  
  const [allPlayers, setAllPlayers] = useState<OnlinePlayer[]>([])
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  const channelRef = useRef<RealtimeChannel | null>(null)
  const profileCacheRef = useRef<Map<string, Partial<OnlinePlayer>>>(new Map())

  // Fetch friends list
  useEffect(() => {
    if (!userId) {
      setFriendIds(new Set())
      return
    }

    const fetchFriends = async () => {
      try {
        const { data, error: friendsError } = await supabase
          .from('friends')
          .select('friend_id')
          .eq('user_id', userId)
          .eq('status', 'accepted')

        if (friendsError) throw friendsError
        
        const ids = new Set((data || []).map(f => f.friend_id))
        setFriendIds(ids)
      } catch (err) {
        console.error('Failed to fetch friends:', err)
      }
    }

    void fetchFriends()
  }, [userId])

  // Fetch profile data for a user
  const fetchProfile = useCallback(async (uid: string): Promise<Partial<OnlinePlayer>> => {
    // Check cache first
    const cached = profileCacheRef.current.get(uid)
    if (cached) return cached

    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, current_rank')
        .eq('id', uid)
        .single()

      if (profileError || !data) {
        return { id: uid, username: 'Unknown', rank: 'vo_danh' }
      }

      const profile: Partial<OnlinePlayer> = {
        id: data.id,
        username: data.username || 'Unknown',
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        rank: data.current_rank || 'vo_danh'
      }

      profileCacheRef.current.set(uid, profile)
      return profile
    } catch {
      return { id: uid, username: 'Unknown', rank: 'vo_danh' }
    }
  }, [])

  // Process presence state into players list
  const processPresenceState = useCallback(async (presenceState: Record<string, PresenceState[]>) => {
    const playerMap = new Map<string, OnlinePlayer>()

    for (const [key, presences] of Object.entries(presenceState)) {
      if (!presences || presences.length === 0) continue
      
      const presence = presences[0]
      const uid = presence.user_id || key
      
      // Skip current user
      if (uid === userId) continue

      // Get profile data
      let profile = profileCacheRef.current.get(uid)
      if (!profile) {
        profile = await fetchProfile(uid)
      }

      const player: OnlinePlayer = {
        id: uid,
        username: presence.username || profile?.username || 'Unknown',
        display_name: presence.display_name || profile?.display_name,
        avatar_url: presence.avatar_url || profile?.avatar_url,
        rank: presence.rank || profile?.rank || 'vo_danh',
        is_friend: friendIds.has(uid),
        last_active: presence.online_at || new Date().toISOString(),
        page: presence.page
      }

      playerMap.set(uid, player)
    }

    return Array.from(playerMap.values())
  }, [userId, friendIds, fetchProfile])

  // Subscribe to presence channel
  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const channel = supabase.channel('presence:global', {
      config: { presence: { key: userId || `guest-${Math.random().toString(36).slice(2)}` } }
    })

    channel.on('presence', { event: 'sync' }, async () => {
      try {
        const state = channel.presenceState<PresenceState>()
        const players = await processPresenceState(state)
        setAllPlayers(players)
        setLoading(false)
      } catch (err) {
        console.error('Presence sync error:', err)
        setError(err instanceof Error ? err : new Error('Presence sync failed'))
        setLoading(false)
      }
    })

    channel.on('presence', { event: 'join' }, async ({ key, newPresences }) => {
      if (!newPresences || newPresences.length === 0) return
      
      const presence = newPresences[0] as unknown as PresenceState
      const uid = presence.user_id || key
      
      if (uid === userId) return

      const profile = await fetchProfile(uid)
      
      const player: OnlinePlayer = {
        id: uid,
        username: presence.username || profile?.username || 'Unknown',
        display_name: presence.display_name || profile?.display_name,
        avatar_url: presence.avatar_url || profile?.avatar_url,
        rank: presence.rank || profile?.rank || 'vo_danh',
        is_friend: friendIds.has(uid),
        last_active: presence.online_at || new Date().toISOString(),
        page: presence.page
      }

      setAllPlayers(prev => {
        const existing = prev.findIndex(p => p.id === uid)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = player
          return updated
        }
        return [...prev, player]
      })
    })

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      if (!leftPresences || leftPresences.length === 0) return
      
      const presence = leftPresences[0] as unknown as PresenceState
      const uid = presence.user_id || key
      
      setAllPlayers(prev => prev.filter(p => p.id !== uid))
    })

    void channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' && userId) {
        void channel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
          page: 'ai-analysis'
        })
      }
    })

    channelRef.current = channel

    return () => {
      try {
        void channel.unsubscribe()
      } catch {}
      channelRef.current = null
    }
  }, [enabled, userId, processPresenceState, fetchProfile, friendIds])

  // Update is_friend when friendIds changes
  useEffect(() => {
    setAllPlayers(prev => prev.map(p => ({
      ...p,
      is_friend: friendIds.has(p.id)
    })))
  }, [friendIds])

  // Apply filters
  const filteredPlayers = useMemo(() => {
    let result = allPlayers
    result = filterBySearch(result, searchQuery)
    result = filterByRank(result, rankFilter)
    result = filterByFriends(result, friendsOnly)
    return result
  }, [allPlayers, searchQuery, rankFilter, friendsOnly])

  // Calculate count by rank (from unfiltered list)
  const rankCounts = useMemo(() => countByRank(allPlayers), [allPlayers])

  // Refresh function
  const refresh = useCallback(() => {
    profileCacheRef.current.clear()
    if (channelRef.current) {
      const state = channelRef.current.presenceState<PresenceState>()
      void processPresenceState(state).then(setAllPlayers)
    }
  }, [processPresenceState])

  return {
    players: filteredPlayers,
    totalCount: allPlayers.length,
    countByRank: rankCounts,
    loading,
    error,
    refresh
  }
}
