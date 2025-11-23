import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { fetchChatHistory, sendChatMessage } from '../lib/chat'
import type { ChatChannelScope, ChatMessage, ChatMessageType } from '../types/chat'

const MAX_MESSAGE_LENGTH = 300
const MAX_BUFFER = 120
const SEND_COOLDOWN_MS = 1500

export type ChatConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface UseChatOptions {
  mode: 'home' | 'room' | 'match'
  channel?: ChatChannelScope
  roomId?: string | null
  limit?: number
  enabled?: boolean
}

export interface UseChatResult {
  channel: ChatChannelScope
  roomId: string | null
  messages: ChatMessage[]
  status: ChatConnectionStatus
  error: string | null
  notice: string | null
  isLoading: boolean
  canLoadMore: boolean
  cooldownMs: number
  sendMessage: (content: string, type?: ChatMessageType) => Promise<void>
  loadOlder: () => Promise<void>
  reset: () => void
  clearNotice: () => void
}

export function useChat(options: UseChatOptions): UseChatResult {
  const enabled = options.enabled ?? true
  const resolvedChannel: ChatChannelScope = useMemo(() => {
    if (options.mode === 'room') return 'room'
    if (options.mode === 'match' && options.roomId) return 'room'
    return options.channel ?? 'global'
  }, [options.channel, options.mode, options.roomId])

  const effectiveRoomId = resolvedChannel === 'room' ? (options.roomId ?? null) : null

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<ChatConnectionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [canLoadMore, setCanLoadMore] = useState(true)
  const [cooldownMs, setCooldownMs] = useState(0)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const messageIdsRef = useRef<Set<string>>(new Set())
  const tokenRef = useRef<string | null>(null)
  const lastSentRef = useRef<number>(0)

  const limit = options.limit ?? 20

  const clearRealtime = useCallback(() => {
    if (channelRef.current) {
      try { void channelRef.current.unsubscribe() } catch (e) { /* noop */ }
      channelRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    setMessages([])
    setError(null)
    setNotice(null)
    setCanLoadMore(true)
    messageIdsRef.current.clear()
  }, [])

  const clearNotice = useCallback(() => setNotice(null), [])

  const resolveToken = useCallback(async () => {
    if (tokenRef.current) return tokenRef.current
    const { data } = await supabase.auth.getSession()
    tokenRef.current = data.session?.access_token ?? null
    return tokenRef.current
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (mounted) tokenRef.current = data.session?.access_token ?? null
      } catch (_) {
        tokenRef.current = null
      }
    })()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      tokenRef.current = session?.access_token ?? null
    })

    return () => {
      mounted = false
      listener?.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!lastSentRef.current) {
        setCooldownMs((prev) => (prev === 0 ? prev : 0))
        return
      }
      const diff = Date.now() - lastSentRef.current
      const remaining = Math.max(0, SEND_COOLDOWN_MS - diff)
      setCooldownMs(remaining)
    }, 250)

    return () => window.clearInterval(id)
  }, [])

  const pushMessages = useCallback((incoming: ChatMessage | ChatMessage[]) => {
    const list = Array.isArray(incoming) ? incoming : [incoming]
    setMessages((prev) => {
      const next = [...prev]
      let mutated = false
      for (const msg of list) {
        if (!msg?.id || messageIdsRef.current.has(msg.id)) continue
        messageIdsRef.current.add(msg.id)
        next.push(msg)
        mutated = true
      }
      if (!mutated) return prev
      next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      if (next.length > MAX_BUFFER) next.splice(0, next.length - MAX_BUFFER)
      return next
    })
  }, [])

  const loadHistory = useCallback(async (cursor?: string) => {
    setIsLoading(true)
    try {
      const token = await resolveToken()
      const response = await fetchChatHistory({
        channel: resolvedChannel === 'room' ? undefined : resolvedChannel,
        roomId: effectiveRoomId,
        limit,
        cursor,
        token
      })

      const ordered = [...response.messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      if (!cursor) {
        messageIdsRef.current.clear()
        pushMessages(ordered)
      } else {
        setMessages((prev) => {
          const merged = [...ordered, ...prev]
          const seen = new Set<string>()
          const deduped: ChatMessage[] = []
          merged
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .forEach((msg) => {
              if (!msg?.id || seen.has(msg.id)) return
              seen.add(msg.id)
              deduped.push(msg)
            })
          deduped.forEach((msg) => messageIdsRef.current.add(msg.id))
          if (deduped.length > MAX_BUFFER) deduped.splice(0, deduped.length - MAX_BUFFER)
          return deduped
        })
      }
      setCanLoadMore(Boolean(response.nextCursor))
      setError(null)
    } catch (err) {
      console.error('loadHistory error', err)
      setError(err instanceof Error ? err.message : 'Không tải được truyền âm')
      setStatus('error')
    } finally {
      setIsLoading(false)
    }
  }, [effectiveRoomId, limit, pushMessages, resolveToken, resolvedChannel])

  useEffect(() => {
    reset()
    clearRealtime()
    if (!enabled) {
      setStatus('idle')
      return
    }
    setStatus('connecting')
    loadHistory()
  }, [enabled, resolvedChannel, effectiveRoomId, loadHistory, reset, clearRealtime])

  useEffect(() => {
    if (!enabled) return
    const filter = effectiveRoomId ? `room_id=eq.${effectiveRoomId}` : `channel_scope=eq.${resolvedChannel}`
    const channelKey = effectiveRoomId ? `chat:room:${effectiveRoomId}` : `chat:${resolvedChannel}`

    const channel = supabase
      .channel(channelKey)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter }, (payload) => {
        const next = payload.new as ChatMessage
        if (next) pushMessages(next)
      })

    channel.subscribe((subscriptionStatus) => {
      if (subscriptionStatus === 'SUBSCRIBED') {
        setStatus('connected')
      } else if (subscriptionStatus === 'CHANNEL_ERROR') {
        setStatus('error')
      }
    })

    channelRef.current = channel

    return () => {
      try { void channel.unsubscribe() } catch (e) { /* noop */ }
      channelRef.current = null
    }
  }, [effectiveRoomId, enabled, pushMessages, resolvedChannel])

  const loadOlder = useCallback(async () => {
    if (!enabled || isLoading || !messages.length || !canLoadMore) return
    const oldest = messages[0]
    if (!oldest) return
    await loadHistory(oldest.created_at)
  }, [canLoadMore, enabled, isLoading, loadHistory, messages])

  const send = useCallback(async (rawContent: string, type: ChatMessageType = 'text') => {
    if (!enabled) throw new Error('Chat đang tắt trong phiên này')
    const content = rawContent.trim()
    if (!content) throw new Error('Nội dung truyền âm trống')
    if (resolvedChannel === 'room' && !effectiveRoomId) throw new Error('Bạn chưa ở trong phòng nào')

    const now = Date.now()
    if (now - lastSentRef.current < SEND_COOLDOWN_MS) {
      setNotice('Đạo hữu chậm lại một nhịp')
      throw new Error('Đạo hữu chậm lại một nhịp')
    }

    lastSentRef.current = now
    setCooldownMs(SEND_COOLDOWN_MS)

    const token = await resolveToken()
    if (!token) throw new Error('Bạn cần đăng nhập để truyền âm')

    let prepared = content
    if (prepared.length > MAX_MESSAGE_LENGTH) {
      prepared = `${prepared.slice(0, MAX_MESSAGE_LENGTH - 1)}…`
      setNotice('Tin nhắn đã được rút gọn về 300 ký tự')
    }

    const response = await sendChatMessage({
      content: prepared,
      messageType: type,
      roomId: effectiveRoomId,
      channel: resolvedChannel === 'room' ? undefined : resolvedChannel,
      token
    })

    if (response.message) {
      pushMessages(response.message)
    }
    if (response.truncated) {
      setNotice('Tin nhắn trên máy chủ đã được rút gọn thêm để đảm bảo an toàn')
    }
  }, [effectiveRoomId, enabled, pushMessages, resolveToken, resolvedChannel])

  return {
    channel: resolvedChannel,
    roomId: effectiveRoomId,
    messages,
    status,
    error,
    notice,
    isLoading,
    canLoadMore,
    cooldownMs,
    sendMessage: send,
    loadOlder,
    reset,
    clearNotice
  }
}
