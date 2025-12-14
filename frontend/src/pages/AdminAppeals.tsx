import React, { useEffect, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { supabase } from '../lib/supabase'
import { getApiBase } from '../lib/apiBase'

type AppealStatus = 'pending' | 'approved' | 'rejected'

interface Appeal {
  id: string
  report_id: string
  user_id: string
  reason: string
  status: AppealStatus
  admin_response: string | null
  processed_by: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
  user?: { username?: string; display_name?: string } | null
  report?: {
    type: string
    status: string
    ai_summary_player?: string
    reason_result?: string
  } | null
}

const STATUS_COLORS: Record<AppealStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: 'rgba(251, 191, 36, 0.15)', text: '#FBBF24', border: 'rgba(251, 191, 36, 0.3)' },
  approved: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22C55E', border: 'rgba(34, 197, 94, 0.3)' },
  rejected: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' },
}

/**
 * AdminAppealsPage - Admin dashboard for managing ban appeals
 * Requirements: 9.5 - Display appeals with actions
 */
export default function AdminAppealsPage() {
  const { t } = useLanguage()
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null)
  const [statusFilter, setStatusFilter] = useState<AppealStatus | ''>('')

  const perPage = 15

  useEffect(() => {
    void loadAppeals()
  }, [page, statusFilter])

  const loadAppeals = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        setError('Bạn cần đăng nhập với quyền admin')
        return
      }

      const apiBase = getApiBase()
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
      })

      if (statusFilter) params.append('status', statusFilter)

      const response = await fetch(`${apiBase}/api/appeals?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Không thể tải danh sách khiếu nại')
      }

      setAppeals(data.data || [])
      setTotal(data.meta?.total || 0)
      setTotalPages(data.meta?.total_pages || 1)
    } catch (err: any) {
      console.error('Load appeals error:', err)
      setError(err.message || 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('vi-VN')
  }

  const getStatusLabel = (status: AppealStatus): string => {
    const labels: Record<AppealStatus, string> = {
      pending: 'Chờ xử lý',
      approved: 'Đã chấp nhận',
      rejected: 'Đã từ chối',
    }
    return labels[status] || status
  }

  const handleAppealUpdated = () => {
    void loadAppeals()
    setSelectedAppeal(null)
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Breadcrumb */}
      <nav style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
        <a href="#admin" style={{ color: '#38BDF8', textDecoration: 'none' }}>
          🏠 Admin
        </a>
        <span style={{ color: '#64748B' }}>/</span>
        <span style={{ color: '#94A3B8' }}>📨 Khiếu nại</span>
      </nav>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>
          📨 Quản lý Khiếu nại
        </h2>
        <p style={{ margin: '8px 0 0', color: '#94A3B8', fontSize: '14px' }}>
          Xem và xử lý các khiếu nại từ người chơi bị ban
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        marginBottom: '20px',
        padding: '16px',
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: '12px',
        border: '1px solid rgba(71, 85, 105, 0.3)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', color: '#94A3B8' }}>Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as AppealStatus | ''); setPage(1) }}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(71, 85, 105, 0.4)',
              color: '#F8FAFC',
              fontSize: '14px',
              minWidth: '150px',
            }}
          >
            <option value="">Tất cả</option>
            <option value="pending">Chờ xử lý</option>
            <option value="approved">Đã chấp nhận</option>
            <option value="rejected">Đã từ chối</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <button
            onClick={() => loadAppeals()}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🔄 Tải lại
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          color: '#EF4444',
        }}>
          {error}
        </div>
      )}


      {/* Stats Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '20px',
      }}>
        {(['pending', 'approved', 'rejected'] as AppealStatus[]).map(status => {
          const count = appeals.filter(a => a.status === status).length
          const colors = STATUS_COLORS[status]
          return (
            <div
              key={status}
              onClick={() => { setStatusFilter(statusFilter === status ? '' : status); setPage(1) }}
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: statusFilter && statusFilter !== status ? 0.5 : 1,
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 700, color: colors.text }}>{count}</div>
              <div style={{ fontSize: '12px', color: colors.text }}>{getStatusLabel(status)}</div>
            </div>
          )
        })}
      </div>

      {/* Appeals Table */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: '12px',
        border: '1px solid rgba(71, 85, 105, 0.3)',
        overflow: 'hidden',
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '80px 1fr 1fr 120px 140px 100px',
          gap: '12px',
          padding: '14px 16px',
          background: 'rgba(30, 41, 59, 0.8)',
          fontWeight: 600,
          fontSize: '13px',
          color: '#CBD5E1',
          borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
        }}>
          <div>ID</div>
          <div>Người khiếu nại</div>
          <div>Lý do</div>
          <div>Trạng thái</div>
          <div>Ngày tạo</div>
          <div>Hành động</div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
            Đang tải...
          </div>
        )}

        {/* Empty State */}
        {!loading && appeals.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
            Không có khiếu nại nào
          </div>
        )}

        {/* Table Rows */}
        {!loading && appeals.map((appeal, index) => {
          const statusColors = STATUS_COLORS[appeal.status]

          return (
            <div
              key={appeal.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 1fr 120px 140px 100px',
                gap: '12px',
                padding: '14px 16px',
                background: index % 2 === 0 ? 'transparent' : 'rgba(30, 41, 59, 0.3)',
                borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
                alignItems: 'center',
                fontSize: '14px',
              }}
            >
              <div style={{ color: '#64748B', fontSize: '12px' }}>
                {appeal.id.slice(0, 8)}...
              </div>
              <div>
                <div style={{ fontWeight: 500 }}>
                  {appeal.user?.display_name || appeal.user?.username || 'Ẩn danh'}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  {appeal.user_id.slice(0, 8)}...
                </div>
              </div>
              <div style={{
                fontSize: '13px',
                color: '#CBD5E1',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {appeal.reason.slice(0, 50)}{appeal.reason.length > 50 ? '...' : ''}
              </div>
              <div>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: statusColors.bg,
                  border: `1px solid ${statusColors.border}`,
                  color: statusColors.text,
                  fontSize: '12px',
                  fontWeight: 500,
                }}>
                  {getStatusLabel(appeal.status)}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#94A3B8' }}>
                {formatDate(appeal.created_at)}
              </div>
              <div>
                <button
                  onClick={() => setSelectedAppeal(appeal)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38BDF8',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Chi tiết
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '16px',
          padding: '12px 16px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '10px',
        }}>
          <div style={{ color: '#94A3B8', fontSize: '14px' }}>
            Hiển thị {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} / {total} khiếu nại
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: page === 1 ? 'rgba(71, 85, 105, 0.2)' : 'rgba(71, 85, 105, 0.4)',
                border: 'none',
                color: page === 1 ? '#64748B' : '#F8FAFC',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
              }}
            >
              ← Trước
            </button>
            <span style={{ padding: '8px 16px', color: '#F8FAFC' }}>
              Trang {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: page === totalPages ? 'rgba(71, 85, 105, 0.2)' : 'rgba(71, 85, 105, 0.4)',
                border: 'none',
                color: page === totalPages ? '#64748B' : '#F8FAFC',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Sau →
            </button>
          </div>
        </div>
      )}

      {/* Appeal Detail Modal */}
      {selectedAppeal && (
        <AppealDetailModal
          appeal={selectedAppeal}
          onClose={() => setSelectedAppeal(null)}
          onUpdated={handleAppealUpdated}
        />
      )}
    </div>
  )
}


/** AppealDetailModal - Modal for viewing and processing appeal details */
interface AppealDetailModalProps {
  appeal: Appeal
  onClose: () => void
  onUpdated: () => void
}

function AppealDetailModal({ appeal, onClose, onUpdated }: AppealDetailModalProps) {
  const [adminResponse, setAdminResponse] = useState(appeal.admin_response || '')
  const [liftBan, setLiftBan] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('vi-VN')
  }

  const handleProcess = async (status: 'approved' | 'rejected') => {
    if (!adminResponse.trim()) {
      setError('Vui lòng nhập phản hồi')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        setError('Bạn cần đăng nhập với quyền admin')
        return
      }

      const apiBase = getApiBase()
      const response = await fetch(`${apiBase}/api/appeals/${appeal.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          admin_response: adminResponse,
          lift_ban: status === 'approved' && liftBan,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Không thể xử lý khiếu nại')
      }

      onUpdated()
    } catch (err: any) {
      console.error('Process appeal error:', err)
      setError(err.message || 'Có lỗi xảy ra')
    } finally {
      setIsProcessing(false)
    }
  }

  const statusColors = STATUS_COLORS[appeal.status]
  const isPending = appeal.status === 'pending'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(20, 30, 48, 0.98) 100%)',
          borderRadius: '20px',
          maxWidth: '700px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          border: '1px solid rgba(71, 85, 105, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.8)',
          padding: '20px 24px',
          borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: statusColors.bg,
              border: `1px solid ${statusColors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}>
              📨
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#F8FAFC' }}>
                Chi tiết Khiếu nại #{appeal.id.slice(0, 8)}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: statusColors.bg,
                  border: `1px solid ${statusColors.border}`,
                  color: statusColors.text,
                  fontSize: '12px',
                  fontWeight: 500,
                }}>
                  {appeal.status === 'pending' ? 'Chờ xử lý' : appeal.status === 'approved' ? 'Đã chấp nhận' : 'Đã từ chối'}
                </span>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                  {formatDate(appeal.created_at)}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(71, 85, 105, 0.3)',
              border: '1px solid rgba(71, 85, 105, 0.4)',
              color: '#94A3B8',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {/* Error Message */}
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px',
              color: '#EF4444',
              fontSize: '14px',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* User Info */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.5)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid rgba(71, 85, 105, 0.3)',
            marginBottom: '16px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '12px' }}>
              👤 Người khiếu nại
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>Tên</span>
                <span style={{ fontSize: '13px', color: '#F8FAFC', fontWeight: 500 }}>
                  {appeal.user?.display_name || appeal.user?.username || 'Ẩn danh'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>ID</span>
                <span style={{ fontSize: '13px', color: '#F8FAFC', fontWeight: 500 }}>
                  {appeal.user_id.slice(0, 12)}...
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>Report ID</span>
                <span style={{ fontSize: '13px', color: '#F8FAFC', fontWeight: 500 }}>
                  {appeal.report_id.slice(0, 12)}...
                </span>
              </div>
            </div>
          </div>

          {/* Appeal Reason */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.5)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid rgba(71, 85, 105, 0.3)',
            marginBottom: '16px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '12px' }}>
              📝 Lý do khiếu nại
            </div>
            <div style={{
              fontSize: '14px',
              color: '#CBD5E1',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
            }}>
              {appeal.reason}
            </div>
          </div>

          {/* Original Report Info */}
          {appeal.report && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.5)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(71, 85, 105, 0.3)',
              marginBottom: '16px',
            }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '12px' }}>
                📋 Thông tin báo cáo gốc
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#94A3B8' }}>Loại</span>
                  <span style={{ fontSize: '13px', color: '#F8FAFC', fontWeight: 500 }}>
                    {appeal.report.type}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#94A3B8' }}>Trạng thái</span>
                  <span style={{ fontSize: '13px', color: '#F8FAFC', fontWeight: 500 }}>
                    {appeal.report.status}
                  </span>
                </div>
              </div>
              {appeal.report.ai_summary_player && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Tóm tắt AI</div>
                  <div style={{ fontSize: '13px', color: '#CBD5E1' }}>{appeal.report.ai_summary_player}</div>
                </div>
              )}
            </div>
          )}

          {/* Admin Response (for pending appeals) */}
          {isPending && (
            <>
              <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid rgba(71, 85, 105, 0.3)',
                marginBottom: '16px',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '12px' }}>
                  💬 Phản hồi của Admin <span style={{ color: '#EF4444' }}>*</span>
                </div>
                <textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Nhập phản hồi cho người khiếu nại..."
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(71, 85, 105, 0.4)',
                    color: '#F8FAFC',
                    fontSize: '14px',
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Lift Ban Option */}
              <div style={{
                background: 'rgba(34, 197, 94, 0.08)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                marginBottom: '20px',
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={liftBan}
                    onChange={(e) => setLiftBan(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#22C55E' }}>
                      Gỡ ban khi chấp nhận
                    </div>
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                      Tự động gỡ ban cho người chơi nếu khiếu nại được chấp nhận
                    </div>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => handleProcess('rejected')}
                  disabled={isProcessing}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#EF4444',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    opacity: isProcessing ? 0.7 : 1,
                  }}
                >
                  ❌ Từ chối
                </button>
                <button
                  onClick={() => handleProcess('approved')}
                  disabled={isProcessing}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    opacity: isProcessing ? 0.7 : 1,
                  }}
                >
                  {isProcessing ? 'Đang xử lý...' : '✅ Chấp nhận'}
                </button>
              </div>
            </>
          )}

          {/* Show admin response for processed appeals */}
          {!isPending && appeal.admin_response && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.5)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(71, 85, 105, 0.3)',
            }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '12px' }}>
                💬 Phản hồi của Admin
              </div>
              <div style={{
                fontSize: '14px',
                color: '#CBD5E1',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
              }}>
                {appeal.admin_response}
              </div>
              {appeal.processed_at && (
                <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748B' }}>
                  Xử lý lúc: {formatDate(appeal.processed_at)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
