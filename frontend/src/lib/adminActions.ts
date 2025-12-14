/**
 * Admin Action Handlers
 * 
 * Centralized handlers for admin actions on reports, appeals, and bans.
 * Requirements: 9.3, 9.4 - Update status, apply/lift bans
 */

import { supabase } from './supabase'
import { getApiBase } from './apiBase'

type ReportStatus = 'pending' | 'auto_flagged' | 'resolved' | 'dismissed' | 'escalated'
type BanType = 'temporary' | 'permanent' | 'warning'

interface UpdateReportParams {
  reportId: string
  status?: ReportStatus
  adminNotes?: string
}

interface ApplyBanParams {
  userId: string
  reportId: string
  banType: BanType
  reason: string
  durationDays?: number
}

interface LiftBanParams {
  banId: string
  reason: string
}

interface ProcessAppealParams {
  appealId: string
  status: 'approved' | 'rejected'
  adminResponse: string
  liftBan?: boolean
}

interface ActionResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Get authentication token from Supabase session
 */
async function getAuthToken(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession()
  return sessionData?.session?.access_token || null
}

/**
 * Update a report's status and/or admin notes
 * Requirements: 9.3, 9.4
 */
export async function updateReport(params: UpdateReportParams): Promise<ActionResult> {
  try {
    const token = await getAuthToken()
    if (!token) {
      return { success: false, error: 'Bạn cần đăng nhập với quyền admin' }
    }

    const apiBase = getApiBase()
    const response = await fetch(`${apiBase}/api/reports/${params.reportId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: params.status,
        admin_notes: params.adminNotes,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Không thể cập nhật báo cáo')
    }

    return { success: true, data: data.data }
  } catch (err: any) {
    console.error('Update report error:', err)
    return { success: false, error: err.message || 'Có lỗi xảy ra' }
  }
}

/**
 * Apply a ban to a user
 * Requirements: 6.1, 6.2
 */
export async function applyBan(params: ApplyBanParams): Promise<ActionResult> {
  try {
    const token = await getAuthToken()
    if (!token) {
      return { success: false, error: 'Bạn cần đăng nhập với quyền admin' }
    }

    const apiBase = getApiBase()
    const response = await fetch(`${apiBase}/api/admin/bans`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: params.userId,
        report_id: params.reportId,
        ban_type: params.banType,
        reason: params.reason,
        duration_days: params.durationDays,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Không thể áp dụng ban')
    }

    return { success: true, data: data.data }
  } catch (err: any) {
    console.error('Apply ban error:', err)
    return { success: false, error: err.message || 'Có lỗi xảy ra' }
  }
}

/**
 * Lift an existing ban
 * Requirements: 7.5
 */
export async function liftBan(params: LiftBanParams): Promise<ActionResult> {
  try {
    const token = await getAuthToken()
    if (!token) {
      return { success: false, error: 'Bạn cần đăng nhập với quyền admin' }
    }

    const apiBase = getApiBase()
    const response = await fetch(`${apiBase}/api/admin/bans/${params.banId}/lift`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: params.reason,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Không thể gỡ ban')
    }

    return { success: true, data: data.data }
  } catch (err: any) {
    console.error('Lift ban error:', err)
    return { success: false, error: err.message || 'Có lỗi xảy ra' }
  }
}

/**
 * Process an appeal (approve or reject)
 * Requirements: 7.5
 */
export async function processAppeal(params: ProcessAppealParams): Promise<ActionResult> {
  try {
    const token = await getAuthToken()
    if (!token) {
      return { success: false, error: 'Bạn cần đăng nhập với quyền admin' }
    }

    const apiBase = getApiBase()
    const response = await fetch(`${apiBase}/api/appeals/${params.appealId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: params.status,
        admin_response: params.adminResponse,
        lift_ban: params.liftBan,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Không thể xử lý khiếu nại')
    }

    return { success: true, data: data.data }
  } catch (err: any) {
    console.error('Process appeal error:', err)
    return { success: false, error: err.message || 'Có lỗi xảy ra' }
  }
}

/**
 * Get user's ban status
 * Requirements: 6.3
 */
export async function checkBanStatus(_userId: string): Promise<ActionResult> {
  try {
    const token = await getAuthToken()
    if (!token) {
      return { success: false, error: 'Bạn cần đăng nhập' }
    }

    const apiBase = getApiBase()
    // Note: _userId is available for future use when API supports checking other users
    const response = await fetch(`${apiBase}/api/bans/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Không thể kiểm tra trạng thái ban')
    }

    return { success: true, data: data.data }
  } catch (err: any) {
    console.error('Check ban status error:', err)
    return { success: false, error: err.message || 'Có lỗi xảy ra' }
  }
}

/**
 * Get user's ban history (admin only)
 */
export async function getBanHistory(userId: string): Promise<ActionResult> {
  try {
    const token = await getAuthToken()
    if (!token) {
      return { success: false, error: 'Bạn cần đăng nhập với quyền admin' }
    }

    const apiBase = getApiBase()
    const response = await fetch(`${apiBase}/api/admin/bans/user/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Không thể lấy lịch sử ban')
    }

    return { success: true, data: data.data }
  } catch (err: any) {
    console.error('Get ban history error:', err)
    return { success: false, error: err.message || 'Có lỗi xảy ra' }
  }
}

/**
 * Dismiss a report
 * Requirements: 9.3
 */
export async function dismissReport(reportId: string, adminNotes?: string): Promise<ActionResult> {
  return updateReport({
    reportId,
    status: 'dismissed',
    adminNotes,
  })
}

/**
 * Resolve a report
 * Requirements: 9.3
 */
export async function resolveReport(reportId: string, adminNotes?: string): Promise<ActionResult> {
  return updateReport({
    reportId,
    status: 'resolved',
    adminNotes,
  })
}

/**
 * Escalate a report for further review
 * Requirements: 9.3
 */
export async function escalateReport(reportId: string, adminNotes?: string): Promise<ActionResult> {
  return updateReport({
    reportId,
    status: 'escalated',
    adminNotes,
  })
}
