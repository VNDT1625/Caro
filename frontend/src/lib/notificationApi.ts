import { supabase } from './supabase'

// Use relative path to leverage Vite proxy (proxies /api to localhost:8001)
// This avoids CORS issues and ensures correct routing
const API_URL = ''

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
  gift_data?: {
    coins: number
    gems: number
    item_ids: string[]  // UUID references to items.id
  }
  gift_claimed_at?: string | null
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  total_pages: number
}

interface InboxResponse {
  success: boolean
  notifications: Notification[]
  pagination: PaginationInfo
}

interface NotificationStats {
  total_recipients: number
  read_count: number
  unread_count: number
}

interface GiftStats {
  total_recipients: number
  claimed_count: number
  unclaimed_count: number
}

interface SentNotification {
  id: string
  title: string
  content: string
  content_preview: string
  is_broadcast: boolean
  created_at: string
  stats: NotificationStats
  gift_data?: {
    coins: number
    gems: number
    items: string[]
  } | null
  gift_stats?: GiftStats
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  }
}

/**
 * Safe JSON parse with error handling
 */
async function safeJsonParse<T>(response: Response, defaultValue: T): Promise<T> {
  // If response is not ok (4xx, 5xx), return default value silently
  if (!response.ok) {
    return defaultValue
  }
  const text = await response.text()
  if (!text || text.trim() === '') {
    return defaultValue
  }
  try {
    return JSON.parse(text)
  } catch {
    // Only log in development, not in production
    if (import.meta.env.DEV) {
      console.warn('Failed to parse JSON response:', text.substring(0, 100))
    }
    return defaultValue
  }
}

/**
 * Get user's inbox with pagination
 */
export async function getInbox(page = 1, limit = 20): Promise<InboxResponse> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(
      `${API_URL}/api/notifications/inbox?page=${page}&limit=${limit}`,
      { headers }
    )
    return safeJsonParse(response, { success: false, notifications: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } })
  } catch {
    return { success: false, notifications: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } }
  }
}

/**
 * Get notification detail
 */
export async function getNotification(id: string): Promise<{ success: boolean; notification: Notification | null }> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(
      `${API_URL}/api/notifications/${id}`,
      { headers }
    )
    return safeJsonParse(response, { success: false, notification: null })
  } catch {
    return { success: false, notification: null }
  }
}

/**
 * Mark notification as read
 */
export async function markAsRead(id: string): Promise<{ success: boolean; marked: boolean }> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(
      `${API_URL}/api/notifications/${id}/read`,
      { method: 'POST', headers }
    )
    return safeJsonParse(response, { success: false, marked: false })
  } catch {
    return { success: false, marked: false }
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<{ success: boolean; marked_count: number }> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(
      `${API_URL}/api/notifications/read-all`,
      { method: 'POST', headers }
    )
    return safeJsonParse(response, { success: false, marked_count: 0 })
  } catch {
    return { success: false, marked_count: 0 }
  }
}

/**
 * Delete notification
 */
export async function deleteNotification(id: string): Promise<{ success: boolean; deleted: boolean }> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(
      `${API_URL}/api/notifications/${id}`,
      { method: 'DELETE', headers }
    )
    return safeJsonParse(response, { success: false, deleted: false })
  } catch {
    return { success: false, deleted: false }
  }
}

/**
 * Get unread count
 */
export async function getUnreadCount(): Promise<{ success: boolean; unread_count: number }> {
  try {
    // Check if user is authenticated first
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      // User not authenticated - return 0 silently
      return { success: true, unread_count: 0 }
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    }
    const response = await fetch(
      `${API_URL}/api/notifications/unread-count`,
      { headers }
    )
    return safeJsonParse(response, { success: false, unread_count: 0 })
  } catch {
    // User not authenticated or network error - return 0
    return { success: false, unread_count: 0 }
  }
}

// ============================================================================
// ADMIN API
// ============================================================================

export interface GiftData {
  coins: number
  gems: number
  item_ids: string[]  // UUID references to items.id
}

/**
 * Admin: Send notification with optional gift
 */
export async function sendNotification(
  title: string,
  content: string,
  recipientIds: string[],
  isBroadcast: boolean,
  giftData?: GiftData | null
): Promise<{ success: boolean; notification_id?: string; recipients_count?: number; has_gift?: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders()
    const body: Record<string, unknown> = {
      title,
      content,
      recipient_ids: recipientIds,
      is_broadcast: isBroadcast
    }
    
    // Only include gift_data if it has actual values
    if (giftData && (giftData.coins > 0 || giftData.gems > 0 || giftData.item_ids.length > 0)) {
      body.gift_data = giftData
    }
    
    const response = await fetch(
      `${API_URL}/api/admin/notifications`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      }
    )
    return safeJsonParse(response, { success: false, error: 'Failed to send notification' })
  } catch {
    return { success: false, error: 'Failed to send notification' }
  }
}

/**
 * Claim gift from notification
 */
export async function claimGift(notificationId: string): Promise<{ 
  success: boolean
  claimed?: { coins: number; gems: number; items: string[] }
  error?: string 
}> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(
      `${API_URL}/api/notifications/${notificationId}/claim-gift`,
      { method: 'POST', headers }
    )
    return safeJsonParse(response, { success: false, error: 'Failed to claim gift' })
  } catch {
    return { success: false, error: 'Failed to claim gift' }
  }
}

/**
 * Admin: Get sent notifications
 */
export async function getSentNotifications(
  page = 1,
  limit = 20
): Promise<{ success: boolean; notifications: SentNotification[]; pagination: PaginationInfo }> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(
      `${API_URL}/api/admin/notifications/sent?page=${page}&limit=${limit}`,
      { headers }
    )
    return safeJsonParse(response, { success: false, notifications: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } })
  } catch {
    return { success: false, notifications: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } }
  }
}

/**
 * Admin: Get notification stats
 */
export async function getNotificationStats(id: string): Promise<{ success: boolean; stats: NotificationStats }> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(
      `${API_URL}/api/admin/notifications/${id}/stats`,
      { headers }
    )
    return safeJsonParse(response, { success: false, stats: { total_recipients: 0, read_count: 0, unread_count: 0 } })
  } catch {
    return { success: false, stats: { total_recipients: 0, read_count: 0, unread_count: 0 } }
  }
}

/**
 * Admin: Delete notification (cascade)
 */
export async function adminDeleteNotification(id: string): Promise<{ success: boolean; deleted: boolean }> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(
      `${API_URL}/api/admin/notifications/${id}`,
      { method: 'DELETE', headers }
    )
    return safeJsonParse(response, { success: false, deleted: false })
  } catch {
    return { success: false, deleted: false }
  }
}

/**
 * Search users for recipient selection
 */
export async function searchUsers(query: string): Promise<{ id: string; username: string }[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username')
    .ilike('username', `%${query}%`)
    .limit(20)
  
  if (error) {
    console.error('Search users error:', error)
    return []
  }
  return (data || []).map(p => ({ id: p.user_id, username: p.username }))
}
