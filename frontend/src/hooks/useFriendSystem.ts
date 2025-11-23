    import * as React from 'react'
    import { supabase } from '../lib/supabase'
    import { getApiBase } from '../lib/apiBase'

    export interface FriendProfile {
      user_id: string
      username: string | null
      display_name: string | null
      avatar_url: string | null
      rank_tier: string | null
      last_active: string | null
      is_online: boolean
    }

    export interface FriendEntry {
      id: string
      friend_id: string
      status: 'pending' | 'accepted' | 'blocked' | 'rejected'
      since?: string
      profile: FriendProfile | null
    }

    export interface FriendRequestsPayload {
      incoming: FriendEntry[]
      outgoing: FriendEntry[]
    }

    export interface FriendSearchResult {
      profile: FriendProfile
      status: string | null
      request_id: string | null
    }

    const API_BASE = getApiBase()
    const HAS_REMOTE_API = Boolean(API_BASE)
    const ONLINE_WINDOW_MS = 5 * 60 * 1000
    const MAX_SEARCH_RESULTS = 8

    function isOnline(lastActive?: string | null) {
      if (!lastActive) return false
      const ts = Date.parse(lastActive)
      if (!Number.isFinite(ts)) return false
      return Date.now() - ts <= ONLINE_WINDOW_MS
    }

    function mapProfile(row?: any): FriendProfile | null {
      if (!row) return null
      return {
        user_id: row.user_id,
        username: row.username ?? null,
        display_name: row.display_name ?? null,
        avatar_url: row.avatar_url ?? null,
        rank_tier: row.rank_tier ?? row.current_rank ?? null,
        last_active: row.last_active ?? null,
        is_online: isOnline(row.last_active)
      }
    }

    function buildRelationFilter(a: string, b: string) {
      return `and(user_id.eq.${a},friend_id.eq.${b}),and(user_id.eq.${b},friend_id.eq.${a})`
    }

    async function fallbackFetchFriends(userId: string): Promise<FriendEntry[]> {
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id,
          user_id,
          friend_id,
          status,
          created_at,
          user_profile:profiles!friendships_user_id_fkey(user_id,username,display_name,avatar_url,current_rank,last_active),
          friend_profile:profiles!friendships_friend_id_fkey(user_id,username,display_name,avatar_url,current_rank,last_active)
        `)
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)

      if (error) throw error

      return (data ?? []).map((row) => {
        const counterpartProfile = row.user_id === userId ? row.friend_profile : row.user_profile
        const counterpartId = row.user_id === userId ? row.friend_id : row.user_id
        return {
          id: row.id,
          friend_id: counterpartId,
          status: row.status,
          since: row.created_at,
          profile: mapProfile(counterpartProfile)
        }
      })
    }

    async function fallbackFetchRequests(userId: string): Promise<FriendRequestsPayload> {
      const pendingSelect = `
        id,
        user_id,
        friend_id,
        status,
        created_at,
        user_profile:profiles!friendships_user_id_fkey(user_id,username,display_name,avatar_url,current_rank,last_active),
        friend_profile:profiles!friendships_friend_id_fkey(user_id,username,display_name,avatar_url,current_rank,last_active)
      `

      const { data: incomingRows, error: incomingError } = await supabase
        .from('friendships')
        .select(pendingSelect)
        .eq('friend_id', userId)
        .eq('status', 'pending')

      if (incomingError) throw incomingError

      const { data: outgoingRows, error: outgoingError } = await supabase
        .from('friendships')
        .select(pendingSelect)
        .eq('user_id', userId)
        .eq('status', 'pending')

      if (outgoingError) throw outgoingError

      const incoming = (incomingRows ?? []).map((row) => ({
        id: row.id,
        friend_id: row.user_id,
        status: row.status,
        since: row.created_at,
        profile: mapProfile(row.user_profile)
      }))

      const outgoing = (outgoingRows ?? []).map((row) => ({
        id: row.id,
        friend_id: row.friend_id,
        status: row.status,
        since: row.created_at,
        profile: mapProfile(row.friend_profile)
      }))

      return { incoming, outgoing }
    }

    async function fallbackSearchProfiles(keyword: string, userId: string): Promise<FriendSearchResult[]> {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id,username,display_name,avatar_url,current_rank,last_active')
        .or(`username.ilike.%${keyword}%,display_name.ilike.%${keyword}%`)
        .neq('user_id', userId)
        .limit(MAX_SEARCH_RESULTS)

      if (error) throw error

      const targetIds = profiles?.map((row) => row.user_id) ?? []
      let relations: any[] = []
      if (targetIds.length) {
        const { data: relRows } = await supabase
          .from('friendships')
          .select('id,user_id,friend_id,status')
          .in('friend_id', [userId, ...targetIds])
          .in('user_id', [userId, ...targetIds])

        relations = relRows ?? []
      }

      return (profiles ?? []).map((profile) => {
        const relation = relations.find((row) => {
          return (
            (row.user_id === userId && row.friend_id === profile.user_id) ||
            (row.friend_id === userId && row.user_id === profile.user_id)
          )
        })

        return {
          profile: mapProfile({ ...profile, rank_tier: profile.current_rank })!,
          status: relation ? relation.status : null,
          request_id: relation ? relation.id : null
        }
      })
    }

    async function fallbackSendRequest(username: string, userId: string) {
      const { data: target, error } = await supabase
        .from('profiles')
        .select('user_id,username')
        .eq('username', username)
        .single()

      if (error || !target) throw new Error('Không tìm thấy đạo hữu')
      if (target.user_id === userId) throw new Error('Không thể kết bạn với chính mình')

      const relationFilter = `(${buildRelationFilter(userId, target.user_id)})`
      const { data: existing } = await supabase
        .from('friendships')
        .select('id,status')
        .or(relationFilter)

      if (existing && existing.length) {
        throw new Error(`Đã có trạng thái ${existing[0].status}`)
      }

      const { error: insertError } = await supabase
        .from('friendships')
        .insert({ user_id: userId, friend_id: target.user_id, status: 'pending' })

      if (insertError) throw insertError
    }

    async function fallbackRespond(requestId: string, action: 'accept' | 'reject', userId: string) {
      const { data: requestRow, error } = await supabase
        .from('friendships')
        .select('id,user_id,friend_id,status')
        .eq('id', requestId)
        .single()

      if (error || !requestRow) throw new Error('Không tìm thấy lời mời')
      if (requestRow.friend_id !== userId) throw new Error('Không có quyền xử lý lời mời này')
      if (requestRow.status !== 'pending') throw new Error('Lời mời không còn hiệu lực')

      const { error: updateError } = await supabase
        .from('friendships')
        .update({ status: action === 'accept' ? 'accepted' : 'rejected' })
        .eq('id', requestId)

      if (updateError) throw updateError
    }

    async function fallbackRemoveFriend(friendId: string, userId: string) {
      const relationFilter = `(${buildRelationFilter(userId, friendId)})`
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(relationFilter)

      if (error) throw error
    }

    async function fallbackBlockFriend(friendId: string, userId: string) {
      const relationFilter = `(${buildRelationFilter(userId, friendId)})`
      const { data, error } = await supabase
        .from('friendships')
        .select('id')
        .or(relationFilter)

      if (error) throw error

      if (data && data.length) {
        const { error: updateError } = await supabase
          .from('friendships')
          .update({ status: 'blocked' })
          .or(relationFilter)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('friendships')
          .insert({ user_id: userId, friend_id: friendId, status: 'blocked' })

        if (insertError) throw insertError
      }
    }

    async function authedFetch(path: string, init?: RequestInit) {
      if (!HAS_REMOTE_API) throw new Error('Friend API endpoint chưa được cấu hình')
      const { data } = await supabase.auth.getSession()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined)
      }
      const token = data.session?.access_token
      if (token) headers.Authorization = `Bearer ${token}`

      const url = `${API_BASE}${path}`
      const response = await fetch(url, {
        ...init,
        headers
      })

      if (!response.ok) {
        let message = 'Yêu cầu thất bại'
        try {
          const payload = await response.json()
          if (payload?.error) message = payload.error
        } catch (err) {
          console.warn('Failed to parse error payload', err)
        }
        throw new Error(message)
      }

      if (response.status === 204) return null
      return response.json()
    }

    export function useFriendSystem(currentUserId?: string | null) {
      const [friends, setFriends] = React.useState<FriendEntry[]>([])
      const [incomingRequests, setIncomingRequests] = React.useState<FriendEntry[]>([])
      const [outgoingRequests, setOutgoingRequests] = React.useState<FriendEntry[]>([])
      const [searchResults, setSearchResults] = React.useState<FriendSearchResult[]>([])
      const [friendCount, setFriendCount] = React.useState(0)
      const [loading, setLoading] = React.useState(false)
      const [isMutating, setIsMutating] = React.useState(false)
      const [lastError, setLastError] = React.useState<string | null>(null)

      const refreshFriends = React.useCallback(async () => {
        if (!currentUserId) {
          setFriends([])
          setFriendCount(0)
          return
        }

        if (HAS_REMOTE_API) {
          try {
            const payload = await authedFetch('/friends/list')
            setFriends(payload?.friends ?? [])
            setFriendCount(payload?.total ?? 0)
            return
          } catch (err) {
            console.warn('Friend API unavailable, falling back to Supabase', err)
          }
        }

        const fallback = await fallbackFetchFriends(currentUserId)
        setFriends(fallback)
        setFriendCount(fallback.filter((entry) => entry.status === 'accepted').length)
      }, [currentUserId])

      const refreshRequests = React.useCallback(async () => {
        if (!currentUserId) {
          setIncomingRequests([])
          setOutgoingRequests([])
          return
        }

        if (HAS_REMOTE_API) {
          try {
            const payload: FriendRequestsPayload = await authedFetch('/friends/requests')
            setIncomingRequests(payload?.incoming ?? [])
            setOutgoingRequests(payload?.outgoing ?? [])
            return
          } catch (err) {
            console.warn('Friend requests API unavailable, using Supabase fallback', err)
          }
        }

        const fallback = await fallbackFetchRequests(currentUserId)
        setIncomingRequests(fallback.incoming)
        setOutgoingRequests(fallback.outgoing)
      }, [currentUserId])

      const refreshAll = React.useCallback(async () => {
        if (!currentUserId) return
        setLoading(true)
        try {
          await Promise.all([refreshFriends(), refreshRequests()])
          setLastError(null)
        } catch (err) {
          setLastError((err as Error).message)
        } finally {
          setLoading(false)
        }
      }, [currentUserId, refreshFriends, refreshRequests])

      React.useEffect(() => {
        if (!currentUserId) {
          setFriends([])
          setIncomingRequests([])
          setOutgoingRequests([])
          setFriendCount(0)
          return
        }
        refreshAll()
      }, [currentUserId, refreshAll])

      React.useEffect(() => {
        if (!currentUserId) return
        const channel = supabase
          .channel(`friendships:${currentUserId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `user_id=eq.${currentUserId}` }, () => {
            refreshAll().catch(() => {})
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `friend_id=eq.${currentUserId}` }, () => {
            refreshAll().catch(() => {})
          })
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }
      }, [currentUserId, refreshAll])

      const wrapMutation = React.useCallback(
        async (callback: () => Promise<void>) => {
          setIsMutating(true)
          setLastError(null)
          try {
            await callback()
          } catch (err) {
            setLastError((err as Error).message)
            throw err
          } finally {
            setIsMutating(false)
          }
        },
        []
      )

      const sendFriendRequest = React.useCallback(
        async (username: string) => {
          if (!username.trim() || !currentUserId) return
          await wrapMutation(async () => {
            if (HAS_REMOTE_API) {
              try {
                await authedFetch('/friends/request', {
                  method: 'POST',
                  body: JSON.stringify({ target_username: username.trim() })
                })
                await refreshRequests()
                return
              } catch (err) {
                console.warn('Friend request API failed, falling back to Supabase', err)
              }
            }
            await fallbackSendRequest(username.trim(), currentUserId)
            await refreshRequests()
          })
        },
        [currentUserId, refreshRequests, wrapMutation]
      )

      const respondToRequest = React.useCallback(
        async (requestId: string, action: 'accept' | 'reject') => {
          if (!currentUserId) return
          await wrapMutation(async () => {
            if (HAS_REMOTE_API) {
              try {
                await authedFetch('/friends/respond', {
                  method: 'POST',
                  body: JSON.stringify({ request_id: requestId, action })
                })
                await refreshRequests()
                if (action === 'accept') await refreshFriends()
                return
              } catch (err) {
                console.warn('Friend respond API failed, using Supabase fallback', err)
              }
            }
            await fallbackRespond(requestId, action, currentUserId)
            await refreshRequests()
            if (action === 'accept') await refreshFriends()
          })
        },
        [currentUserId, refreshFriends, refreshRequests, wrapMutation]
      )

      const removeFriend = React.useCallback(
        async (friendId: string) => {
          if (!currentUserId) return
          await wrapMutation(async () => {
            if (HAS_REMOTE_API) {
              try {
                await authedFetch('/friends/remove', {
                  method: 'POST',
                  body: JSON.stringify({ friend_id: friendId })
                })
                await refreshAll()
                return
              } catch (err) {
                console.warn('Friend remove API failed, using Supabase fallback', err)
              }
            }
            await fallbackRemoveFriend(friendId, currentUserId)
            await refreshAll()
          })
        },
        [currentUserId, refreshAll, wrapMutation]
      )

      const blockUser = React.useCallback(
        async (friendId: string) => {
          if (!currentUserId) return
          await wrapMutation(async () => {
            if (HAS_REMOTE_API) {
              try {
                await authedFetch('/friends/block', {
                  method: 'POST',
                  body: JSON.stringify({ friend_id: friendId })
                })
                await refreshAll()
                return
              } catch (err) {
                console.warn('Friend block API failed, using Supabase fallback', err)
              }
            }
            await fallbackBlockFriend(friendId, currentUserId)
            await refreshAll()
          })
        },
        [currentUserId, refreshAll, wrapMutation]
      )

      const searchProfiles = React.useCallback(
        async (keyword: string) => {
          if (!keyword.trim() || !currentUserId) {
            setSearchResults([])
            return
          }
          try {
            if (HAS_REMOTE_API) {
              const payload = await authedFetch(`/friends/search?q=${encodeURIComponent(keyword.trim())}`)
              setSearchResults(payload?.results ?? [])
              return
            }
            const fallback = await fallbackSearchProfiles(keyword.trim(), currentUserId)
            setSearchResults(fallback)
          } catch (err) {
            setLastError((err as Error).message)
          }
        },
        [currentUserId]
      )

      const clearError = React.useCallback(() => setLastError(null), [])

      return {
        friends,
        incomingRequests,
        outgoingRequests,
        friendCount,
        loading,
        isMutating,
        lastError,
        clearError,
        searchResults,
        refresh: refreshAll,
        searchProfiles,
        sendFriendRequest,
        respondToRequest,
        removeFriend,
        blockUser
      }
    }
