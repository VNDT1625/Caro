/**
 * NotificationManager - Browser Notification System for MindPoint Arena
 * Handles game invites, turn notifications, chat messages, and system alerts
 */

export interface NotificationSettings {
  systemNotif: boolean
  inviteNotif: boolean
  chatNotif: boolean
  turnNotif: boolean
}

export type NotificationType = 
  | 'game-invite'
  | 'turn-reminder'
  | 'chat-message'
  | 'friend-request'
  | 'match-result'
  | 'achievement'
  | 'system'

interface NotificationOptions {
  title: string
  body: string
  icon?: string
  tag?: string
  requireInteraction?: boolean
  data?: any
}

class NotificationManagerClass {
  private settings: NotificationSettings = {
    systemNotif: true,
    inviteNotif: true,
    chatNotif: true,
    turnNotif: true
  }
  private permission: NotificationPermission = 'default'
  private initialized = false

  /**
   * Initialize notification system with settings
   */
  async initialize(settings: NotificationSettings): Promise<boolean> {
    if (this.initialized) return this.isEnabled()
    
    this.settings = settings
    
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.warn('[NotificationManager] Browser does not support notifications')
      this.initialized = true
      return false
    }

    this.permission = Notification.permission
    this.initialized = true
    
    console.log('[NotificationManager] Initialized with permission:', this.permission)
    return this.isEnabled()
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('[NotificationManager] Notifications not supported')
      return 'denied'
    }

    if (this.permission === 'granted') {
      return 'granted'
    }

    try {
      const permission = await Notification.requestPermission()
      this.permission = permission
      console.log('[NotificationManager] Permission result:', permission)
      return permission
    } catch (error) {
      console.error('[NotificationManager] Permission request failed:', error)
      return 'denied'
    }
  }

  /**
   * Check if notifications are enabled and permitted
   */
  isEnabled(): boolean {
    return 'Notification' in window && this.permission === 'granted'
  }

  /**
   * Get current permission status
   */
  getPermission(): NotificationPermission {
    return this.permission
  }

  /**
   * Show a notification
   */
  async show(type: NotificationType, options: NotificationOptions): Promise<void> {
    // Check if this notification type is enabled in settings
    if (!this.shouldShow(type)) {
      console.log(`[NotificationManager] Notification type "${type}" is disabled`)
      return
    }

    if (!this.isEnabled()) {
      console.log('[NotificationManager] Notifications not enabled or permitted')
      return
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: options.tag || `notif-${Date.now()}`,
        requireInteraction: options.requireInteraction || false,
        data: options.data,
        silent: false
      })

      // Auto-close after 5 seconds if not requiring interaction
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close()
        }, 5000)
      }

      // Handle notification click
      notification.onclick = (event) => {
        event.preventDefault()
        window.focus()
        
        // Handle navigation based on notification type
        this.handleNotificationClick(type, options.data)
        
        notification.close()
      }

      console.log(`[NotificationManager] Showed ${type} notification:`, options.title)
    } catch (error) {
      console.error('[NotificationManager] Failed to show notification:', error)
    }
  }

  /**
   * Check if notification type should be shown based on settings
   */
  private shouldShow(type: NotificationType): boolean {
    switch (type) {
      case 'game-invite':
        return this.settings.inviteNotif
      case 'turn-reminder':
        return this.settings.turnNotif
      case 'chat-message':
        return this.settings.chatNotif
      case 'friend-request':
        return this.settings.systemNotif
      case 'match-result':
        return this.settings.systemNotif
      case 'achievement':
        return this.settings.systemNotif
      case 'system':
        return this.settings.systemNotif
      default:
        return false
    }
  }

  /**
   * Handle notification click - navigate to relevant page
   */
  private handleNotificationClick(type: NotificationType, data?: any): void {
    switch (type) {
      case 'game-invite':
        // Navigate to lobby or matchmaking
        window.location.hash = '#lobby'
        break
      case 'turn-reminder':
        // Navigate to in-game
        if (data?.matchId) {
          window.location.hash = '#inmatch'
        }
        break
      case 'chat-message':
        // Navigate to home (where chat is)
        window.location.hash = '#home'
        break
      case 'friend-request':
        // Navigate to profile/friends
        window.location.hash = '#home'
        break
      default:
        // Default to home
        window.location.hash = '#home'
    }
  }

  /**
   * Update notification settings
   */
  updateSettings(newSettings: Partial<NotificationSettings>): void {
    this.settings = { ...this.settings, ...newSettings }
    console.log('[NotificationManager] Settings updated:', this.settings)
  }

  /**
   * Get current settings
   */
  getSettings(): NotificationSettings {
    return { ...this.settings }
  }

  // ===== Convenience methods for specific notification types =====

  /**
   * Show game invite notification
   */
  async notifyGameInvite(fromUser: string): Promise<void> {
    await this.show('game-invite', {
      title: '🎮 Lời mời đấu!',
      body: `${fromUser} muốn thách đấu với bạn`,
      requireInteraction: true,
      tag: 'game-invite'
    })
  }

  /**
   * Show turn reminder notification
   */
  async notifyTurn(matchId: string): Promise<void> {
    await this.show('turn-reminder', {
      title: '⏰ Đến lượt bạn!',
      body: 'Đối thủ đã đi nước, đến lượt bạn rồi',
      tag: `turn-${matchId}`,
      data: { matchId }
    })
  }

  /**
   * Show chat message notification
   */
  async notifyChatMessage(fromUser: string, message: string): Promise<void> {
    await this.show('chat-message', {
      title: `💬 ${fromUser}`,
      body: message.slice(0, 100) + (message.length > 100 ? '...' : ''),
      tag: 'chat-message'
    })
  }

  /**
   * Show friend request notification
   */
  async notifyFriendRequest(fromUser: string): Promise<void> {
    await this.show('friend-request', {
      title: '👥 Lời mời kết bạn',
      body: `${fromUser} muốn kết bạn với bạn`,
      requireInteraction: true,
      tag: 'friend-request'
    })
  }

  /**
   * Show match result notification
   */
  async notifyMatchResult(result: 'win' | 'lose' | 'draw', eloChange: number): Promise<void> {
    const titles = {
      win: '🏆 Chiến thắng!',
      lose: '😔 Thất bại',
      draw: '🤝 Hòa'
    }
    
    const eloText = eloChange >= 0 ? `+${eloChange}` : `${eloChange}`
    
    await this.show('match-result', {
      title: titles[result],
      body: `ELO: ${eloText} điểm`,
      tag: 'match-result'
    })
  }

  /**
   * Show achievement notification
   */
  async notifyAchievement(achievement: string): Promise<void> {
    await this.show('achievement', {
      title: '🏅 Thành tựu mới!',
      body: achievement,
      requireInteraction: true,
      tag: 'achievement'
    })
  }

  /**
   * Show system notification
   */
  async notifySystem(title: string, body: string): Promise<void> {
    await this.show('system', {
      title: `🔔 ${title}`,
      body,
      tag: 'system'
    })
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return 'Notification' in window
  }

  /**
   * Clear all notifications (if supported by browser)
   */
  clearAll(): void {
    // Not all browsers support this
    console.log('[NotificationManager] Clear all notifications requested')
  }
}

// Export singleton instance
export const NotificationManager = new NotificationManagerClass()

// Helper function to load notification settings from localStorage
export function loadNotificationSettingsFromStorage(): NotificationSettings {
  try {
    const stored = localStorage.getItem('gameSettings')
    if (stored) {
      const settings = JSON.parse(stored)
      return {
        systemNotif: settings.systemNotif ?? true,
        inviteNotif: settings.inviteNotif ?? true,
        chatNotif: settings.chatNotif ?? true,
        turnNotif: settings.turnNotif ?? true
      }
    }
  } catch (error) {
    console.error('[NotificationManager] Failed to load settings from storage:', error)
  }

  // Return defaults
  return {
    systemNotif: true,
    inviteNotif: true,
    chatNotif: true,
    turnNotif: true
  }
}
