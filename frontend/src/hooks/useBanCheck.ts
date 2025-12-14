/**
 * useBanCheck - Hook to check if current user is banned
 * 
 * Checks ban status on login and periodically
 * Shows BanNotificationModal if user is banned
 * 
 * Requirements: 6.3, 6.4
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getApiBase } from '../lib/apiBase'

export interface BanInfo {
  id: string
  ban_type: 'temporary' | 'permanent' | 'warning'
  reason: string
  expires_at: string | null
  summary_for_player?: string
  report_id?: string
}

export interface BanStatus {
  isBanned: boolean
  banInfo: BanInfo | null
  canAppeal: boolean
  loading: boolean
  error: string | null
}

export function useBanCheck(userId: string | null) {
  const [banStatus, setBanStatus] = useState<BanStatus>({
    isBanned: false,
    banInfo: null,
    canAppeal: false,
    loading: false,
    error: null
  })

  const checkBanStatus = useCallback(async () => {
    if (!userId) {
      setBanStatus({
        isBanned: false,
        banInfo: null,
        canAppeal: false,
        loading: false,
        error: null
      })
      return
    }

    setBanStatus(prev => ({ ...prev, loading: true, error: null }))

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        setBanStatus(prev => ({ ...prev, loading: false }))
        return
      }

      const apiBase = getApiBase()
      const response = await fetch(`${apiBase}/api/bans/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        // If 404 or error, assume not banned
        setBanStatus({
          isBanned: false,
          banInfo: null,
          canAppeal: false,
          loading: false,
          error: null
        })
        return
      }

      const data = await response.json()
      
      if (data.success && data.data) {
        const status = data.data
        setBanStatus({
          isBanned: status.is_banned || false,
          banInfo: status.is_banned ? {
            id: status.ban_id || '',
            ban_type: status.ban_type || 'temporary',
            reason: status.reason || 'Vi phạm quy định',
            expires_at: status.expires_at || null,
            summary_for_player: status.summary_for_player,
            report_id: status.report_id
          } : null,
          canAppeal: status.can_appeal || false,
          loading: false,
          error: null
        })
      } else {
        setBanStatus({
          isBanned: false,
          banInfo: null,
          canAppeal: false,
          loading: false,
          error: null
        })
      }
    } catch (err: any) {
      console.error('Ban check error:', err)
      // On error, assume not banned to not block user
      setBanStatus({
        isBanned: false,
        banInfo: null,
        canAppeal: false,
        loading: false,
        error: err.message || 'Không thể kiểm tra trạng thái'
      })
    }
  }, [userId])

  // Check on mount and when userId changes
  useEffect(() => {
    checkBanStatus()
  }, [checkBanStatus])

  // Periodic check every 5 minutes
  useEffect(() => {
    if (!userId) return

    const interval = setInterval(checkBanStatus, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [userId, checkBanStatus])

  return {
    ...banStatus,
    recheckBan: checkBanStatus
  }
}

export default useBanCheck
