import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import * as notificationApi from '../lib/notificationApi'

interface Notification {
  id: string
  user_notification_id: string
  title: string
  content_preview?: string
  content?: string
  sender_name: string
  is_read: boolean
  read_at: string | null
  created_at: string
  is_broadcast: boolean
  has_gift?: boolean
  gift_claimed?: boolean
}

interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: string | null
  page: number
  totalPages: number
  hasMore: boolean
  fetchInbox: (page?: number) => Promise<void>
  fetchUnreadCount: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
}

export function useNotifications(): UseNotificationsReturn {
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id } : null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ? { id: session.user.id } : null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0)
      return
    }
    try {
      const result = await notificationApi.getUnreadCount()
      if (result.success) {
        setUnreadCount(result.unread_count)
      }
    } catch {
      // Silently fail
    }
  }, [user])

  const fetchInbox = useCallback(async (pageNum = 1) => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const result = await notificationApi.getInbox(pageNum, 20)
      if (result.success) {
        if (pageNum === 1) {
          setNotifications(result.notifications)
        } else {
          setNotifications(prev => [...prev, ...result.notifications])
        }
        setPage(result.pagination.page)
        setTotalPages(result.pagination.total_pages)
      } else {
        setError('Failed to load notifications')
      }
    } catch {
      setError('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [user])

  const markAsRead = useCallback(async (id: string) => {
    try {
      const result = await notificationApi.markAsRead(id)
      if (result.success) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch {
      // Silently fail
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      const result = await notificationApi.markAllAsRead()
      if (result.success) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        )
        setUnreadCount(0)
      }
    } catch {
      // Silently fail
    }
  }, [])

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const result = await notificationApi.deleteNotification(id)
      if (result.success) {
        const deleted = notifications.find(n => n.id === id)
        setNotifications(prev => prev.filter(n => n.id !== id))
        if (deleted && !deleted.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
      }
    } catch {
      // Silently fail
    }
  }, [notifications])

  const loadMore = useCallback(async () => {
    if (page < totalPages && !loading) {
      await fetchInbox(page + 1)
    }
  }, [page, totalPages, loading, fetchInbox])

  const refresh = useCallback(async () => {
    setPage(1)
    await Promise.all([fetchInbox(1), fetchUnreadCount()])
  }, [fetchInbox, fetchUnreadCount])

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchInbox(1)
      fetchUnreadCount()
    }
  }, [user, fetchInbox, fetchUnreadCount])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    page,
    totalPages,
    hasMore: page < totalPages,
    fetchInbox,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore,
    refresh
  }
}

// Hook for just unread count (lightweight) with polling
export function useUnreadCount(): { unreadCount: number; refresh: () => Promise<void> } {
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)

  // Get current user
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ? { id: data.session.user.id } : null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, sess) => {
      setUser(sess?.user ? { id: sess.user.id } : null)
      // Reset error count on auth change
      setErrorCount(0)
    })
    return () => subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadCount(0)
      return
    }
    try {
      const result = await notificationApi.getUnreadCount()
      if (result.success) {
        setUnreadCount(result.unread_count)
        setErrorCount(0) // Reset on success
      } else {
        // Increment error count to reduce polling frequency
        setErrorCount(prev => Math.min(prev + 1, 5))
      }
    } catch {
      // Silently fail - user may not be authenticated
      setUnreadCount(0)
      setErrorCount(prev => Math.min(prev + 1, 5))
    }
  }, [user])

  // Initial fetch and polling - only when user is logged in
  useEffect(() => {
    if (user) {
      refresh()
      // Poll with exponential backoff on errors: 60s, 120s, 240s, 480s, 960s (max)
      const baseInterval = 60000
      const interval = baseInterval * Math.pow(2, errorCount)
      const timer = setInterval(refresh, Math.min(interval, 960000))
      return () => clearInterval(timer)
    } else {
      setUnreadCount(0)
    }
  }, [user, refresh, errorCount])

  return { unreadCount, refresh }
}
