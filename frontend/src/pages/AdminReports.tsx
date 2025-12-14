import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getApiBase } from '../lib/apiBase'
import ReportDetailModal from '../components/report/ReportDetailModal'

type ReportStatus = 'pending' | 'auto_flagged' | 'resolved' | 'dismissed' | 'escalated'
type ReportType = 'gian_lan_trong_tran' | 'toxic' | 'bug' | 'khac'

interface Report {
  id: string
  reporter_id: string
  reported_user_id: string | null
  match_id: string | null
  type: ReportType
  description: string | null
  status: ReportStatus
  rule_analysis: any
  reason_result: string | null
  ai_analysis: any
  ai_summary_player: string | null
  ai_details_admin: string | null
  processed_at: string | null
  processed_by: string | null
  admin_notes: string | null
  created_at: string
  updated_at: string
  reporter?: { username?: string; display_name?: string } | null
  reported_user?: { username?: string; display_name?: string } | null
}

interface ReportFilters {
  status: ReportStatus | ''
  type: ReportType | ''
  dateFrom: string
  dateTo: string
}

const STATUS_COLORS: Record<ReportStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: 'rgba(251, 191, 36, 0.15)', text: '#FBBF24', border: 'rgba(251, 191, 36, 0.3)' },
  auto_flagged: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' },
  resolved: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22C55E', border: 'rgba(34, 197, 94, 0.3)' },
  dismissed: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: 'rgba(148, 163, 184, 0.3)' },
  escalated: { bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7', border: 'rgba(168, 85, 247, 0.3)' },
}

const TYPE_LABELS: Record<ReportType, { label: string; icon: string }> = {
  gian_lan_trong_tran: { label: 'Gian lận', icon: '🎮' },
  toxic: { label: 'Toxic', icon: '💢' },
  bug: { label: 'Bug', icon: '🐛' },
  khac: { label: 'Khác', icon: '📝' },
}

/**
 * AdminReportsPage - Admin dashboard for managing violation reports
 * Requirements: 9.1 - Display reports with filters for status, type, and date range
 */
export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [filters, setFilters] = useState<ReportFilters>({
    status: '',
    type: '',
    dateFrom: '',
    dateTo: '',
  })

  const perPage = 15

  useEffect(() => {
    void loadReports()
  }, [page, filters])

  const loadReports = async () => {
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

      if (filters.status) params.append('status', filters.status)
      if (filters.type) params.append('type', filters.type)
      if (filters.dateFrom) params.append('date_from', filters.dateFrom)
      if (filters.dateTo) params.append('date_to', filters.dateTo)

      const response = await fetch(`${apiBase}/api/reports?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Không thể tải danh sách báo cáo')
      }

      setReports(data.data || [])
      setTotal(data.meta?.total || 0)
      setTotalPages(data.meta?.total_pages || 1)
    } catch (err: any) {
      console.error('Load reports error:', err)
      setError(err.message || 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters({ status: '', type: '', dateFrom: '', dateTo: '' })
    setPage(1)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('vi-VN')
  }

  const getStatusLabel = (status: ReportStatus): string => {
    const labels: Record<ReportStatus, string> = {
      pending: 'Chờ xử lý',
      auto_flagged: 'Tự động đánh dấu',
      resolved: 'Đã xử lý',
      dismissed: 'Đã bỏ qua',
      escalated: 'Cần xem xét',
    }
    return labels[status] || status
  }

  const handleReportUpdated = () => {
    void loadReports()
    setSelectedReport(null)
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Breadcrumb */}
      <nav style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
        <a href="#admin" style={{ color: '#38BDF8', textDecoration: 'none', cursor: 'pointer' }}>
          🏠 Admin
        </a>
        <span style={{ color: '#64748B' }}>/</span>
        <span style={{ color: '#94A3B8' }}>📋 Báo cáo Vi phạm</span>
      </nav>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>
          📋 Quản lý Báo cáo Vi phạm
        </h2>
        <p style={{ margin: '8px 0 0', color: '#94A3B8', fontSize: '14px' }}>
          Xem và xử lý các báo cáo vi phạm từ người chơi
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
        {/* Status Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', color: '#94A3B8' }}>Trạng thái</label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
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
            <option value="auto_flagged">Tự động đánh dấu</option>
            <option value="escalated">Cần xem xét</option>
            <option value="resolved">Đã xử lý</option>
            <option value="dismissed">Đã bỏ qua</option>
          </select>
        </div>

        {/* Type Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', color: '#94A3B8' }}>Loại</label>
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
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
            <option value="gian_lan_trong_tran">🎮 Gian lận</option>
            <option value="toxic">💢 Toxic</option>
            <option value="bug">🐛 Bug</option>
            <option value="khac">📝 Khác</option>
          </select>
        </div>

        {/* Date From */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', color: '#94A3B8' }}>Từ ngày</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(71, 85, 105, 0.4)',
              color: '#F8FAFC',
              fontSize: '14px',
            }}
          />
        </div>

        {/* Date To */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', color: '#94A3B8' }}>Đến ngày</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(71, 85, 105, 0.4)',
              color: '#F8FAFC',
              fontSize: '14px',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <button
            onClick={clearFilters}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'rgba(71, 85, 105, 0.3)',
              border: '1px solid rgba(71, 85, 105, 0.4)',
              color: '#94A3B8',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Xóa bộ lọc
          </button>
          <button
            onClick={() => loadReports()}
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
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '12px',
        marginBottom: '20px',
      }}>
        {(['pending', 'auto_flagged', 'escalated', 'resolved', 'dismissed'] as ReportStatus[]).map(status => {
          const count = reports.filter(r => r.status === status).length
          const colors = STATUS_COLORS[status]
          return (
            <div
              key={status}
              onClick={() => handleFilterChange('status', filters.status === status ? '' : status)}
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: filters.status && filters.status !== status ? 0.5 : 1,
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 700, color: colors.text }}>{count}</div>
              <div style={{ fontSize: '12px', color: colors.text }}>{getStatusLabel(status)}</div>
            </div>
          )
        })}
      </div>

      {/* Reports Table */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: '12px',
        border: '1px solid rgba(71, 85, 105, 0.3)',
        overflow: 'hidden',
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '80px 1fr 1fr 120px 120px 140px 100px',
          gap: '12px',
          padding: '14px 16px',
          background: 'rgba(30, 41, 59, 0.8)',
          fontWeight: 600,
          fontSize: '13px',
          color: '#CBD5E1',
          borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
        }}>
          <div>ID</div>
          <div>Người báo cáo</div>
          <div>Người bị báo cáo</div>
          <div>Loại</div>
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
        {!loading && reports.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
            Không có báo cáo nào
          </div>
        )}

        {/* Table Rows */}
        {!loading && reports.map((report, index) => {
          const typeInfo = TYPE_LABELS[report.type] || { label: report.type, icon: '📄' }
          const statusColors = STATUS_COLORS[report.status]

          return (
            <div
              key={report.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 1fr 120px 120px 140px 100px',
                gap: '12px',
                padding: '14px 16px',
                background: index % 2 === 0 ? 'transparent' : 'rgba(30, 41, 59, 0.3)',
                borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
                alignItems: 'center',
                fontSize: '14px',
              }}
            >
              <div style={{ color: '#64748B', fontSize: '12px' }}>
                {report.id.slice(0, 8)}...
              </div>
              <div>
                <div style={{ fontWeight: 500 }}>
                  {report.reporter?.display_name || report.reporter?.username || 'Ẩn danh'}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  {report.reporter_id.slice(0, 8)}...
                </div>
              </div>
              <div>
                {report.reported_user_id ? (
                  <>
                    <div style={{ fontWeight: 500 }}>
                      {report.reported_user?.display_name || report.reported_user?.username || 'Ẩn danh'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>
                      {report.reported_user_id.slice(0, 8)}...
                    </div>
                  </>
                ) : (
                  <span style={{ color: '#64748B' }}>—</span>
                )}
              </div>
              <div>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: 'rgba(71, 85, 105, 0.3)',
                  fontSize: '12px',
                }}>
                  {typeInfo.icon} {typeInfo.label}
                </span>
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
                  {getStatusLabel(report.status)}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#94A3B8' }}>
                {formatDate(report.created_at)}
              </div>
              <div>
                <button
                  onClick={() => setSelectedReport(report)}
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
            Hiển thị {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} / {total} báo cáo
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

      {/* Report Detail Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onUpdated={handleReportUpdated}
        />
      )}
    </div>
  )
}
