import React, { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { supabase } from '../../lib/supabase'
import { getApiBase } from '../../lib/apiBase'

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

interface ReportDetailModalProps {
  report: Report
  onClose: () => void
  onUpdated: () => void
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
 * ReportDetailModal - Modal for viewing and managing report details
 * Requirements: 9.2, 9.3 - Show full report info, AI analysis, and action buttons
 */
export default function ReportDetailModal({ report, onClose, onUpdated }: ReportDetailModalProps) {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<'info' | 'analysis' | 'actions'>('info')
  const [adminNotes, setAdminNotes] = useState(report.admin_notes || '')
  const [newStatus, setNewStatus] = useState<ReportStatus>(report.status)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [banDuration, setBanDuration] = useState<number>(7)
  const [banType, setBanType] = useState<'temporary' | 'permanent' | 'warning'>('temporary')

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

  const handleUpdateReport = async () => {
    setIsUpdating(true)
    setError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        setError('Bạn cần đăng nhập với quyền admin')
        return
      }

      const apiBase = getApiBase()
      const response = await fetch(`${apiBase}/api/reports/${report.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          admin_notes: adminNotes,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Không thể cập nhật báo cáo')
      }

      onUpdated()
    } catch (err: any) {
      console.error('Update report error:', err)
      setError(err.message || 'Có lỗi xảy ra')
    } finally {
      setIsUpdating(false)
    }
  }


  const handleApplyBan = async () => {
    if (!report.reported_user_id) {
      setError('Không có người dùng để ban')
      return
    }

    setIsUpdating(true)
    setError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        setError('Bạn cần đăng nhập với quyền admin')
        return
      }

      const apiBase = getApiBase()
      
      // Step 1: Apply ban to user
      const banResponse = await fetch(`${apiBase}/api/admin/bans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: report.reported_user_id,
          report_id: report.id,
          ban_type: banType,
          reason: adminNotes || `Vi phạm: ${TYPE_LABELS[report.type]?.label || report.type}`,
          duration_days: banType === 'temporary' ? banDuration : undefined,
        }),
      })

      const banData = await banResponse.json()
      
      if (!banResponse.ok) {
        throw new Error(banData.error?.message || 'Không thể áp dụng ban')
      }

      // Step 2: Update report status to resolved
      await fetch(`${apiBase}/api/reports/${report.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'resolved',
          admin_notes: adminNotes,
        }),
      })

      alert(`Đã ban user thành công! Loại: ${banType}${banType === 'temporary' ? ` (${banDuration} ngày)` : ''}`)
      onUpdated()
    } catch (err: any) {
      console.error('Apply ban error:', err)
      setError(err.message || 'Có lỗi xảy ra')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDismiss = async () => {
    setNewStatus('dismissed')
    await handleUpdateReport()
  }

  const handleReprocess = async () => {
    setIsUpdating(true)
    setError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        setError('Bạn cần đăng nhập với quyền admin')
        return
      }

      const apiBase = getApiBase()
      const response = await fetch(`${apiBase}/api/reports/${report.id}/reprocess`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Không thể phân tích báo cáo')
      }

      onUpdated()
    } catch (err: any) {
      console.error('Reprocess report error:', err)
      setError(err.message || 'Có lỗi xảy ra')
    } finally {
      setIsUpdating(false)
    }
  }

  const typeInfo = TYPE_LABELS[report.type] || { label: report.type, icon: '📄' }
  const statusColors = STATUS_COLORS[report.status]

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
          maxWidth: '900px',
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
              {typeInfo.icon}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#F8FAFC' }}>
                Chi tiết Báo cáo #{report.id.slice(0, 8)}
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
                  {getStatusLabel(report.status)}
                </span>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                  {formatDate(report.created_at)}
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

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '12px 24px',
          background: 'rgba(15, 23, 42, 0.5)',
          borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
        }}>
          {(['info', 'analysis', 'actions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                background: activeTab === tab ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                border: activeTab === tab ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                color: activeTab === tab ? '#38BDF8' : '#94A3B8',
                fontSize: '14px',
                fontWeight: activeTab === tab ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              {tab === 'info' && '📋 Thông tin'}
              {tab === 'analysis' && '🔍 Phân tích'}
              {tab === 'actions' && '⚡ Hành động'}
            </button>
          ))}
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

          {/* Info Tab */}
          {activeTab === 'info' && (
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Reporter & Reported User */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <InfoCard
                  title="Người báo cáo"
                  icon="👤"
                  items={[
                    { label: 'Tên', value: report.reporter?.display_name || report.reporter?.username || 'Ẩn danh' },
                    { label: 'ID', value: report.reporter_id.slice(0, 12) + '...' },
                  ]}
                />
                <InfoCard
                  title="Người bị báo cáo"
                  icon="🎯"
                  items={report.reported_user_id ? [
                    { label: 'Tên', value: report.reported_user?.display_name || report.reported_user?.username || 'Ẩn danh' },
                    { label: 'ID', value: report.reported_user_id.slice(0, 12) + '...' },
                  ] : [{ label: 'Không có', value: '—' }]}
                />
              </div>

              {/* Report Details */}
              <InfoCard
                title="Chi tiết báo cáo"
                icon="📝"
                items={[
                  { label: 'Loại', value: `${typeInfo.icon} ${typeInfo.label}` },
                  { label: 'Match ID', value: report.match_id ? report.match_id.slice(0, 12) + '...' : '—' },
                  { label: 'Ngày tạo', value: formatDate(report.created_at) },
                  { label: 'Cập nhật', value: formatDate(report.updated_at) },
                ]}
              />

              {/* Description */}
              {report.description && (
                <div style={{
                  background: 'rgba(30, 41, 59, 0.5)',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid rgba(71, 85, 105, 0.3)',
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '12px' }}>
                    📄 Mô tả từ người báo cáo
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#CBD5E1',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {report.description}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Reprocess Button */}
              {/* Show reprocess option for cheat reports without analysis */}
              {!report.reason_result && !report.ai_analysis && (
                <div style={{
                  background: report.type === 'gian_lan_trong_tran' 
                    ? 'rgba(56, 189, 248, 0.1)' 
                    : 'rgba(148, 163, 184, 0.1)',
                  borderRadius: '12px',
                  padding: '16px',
                  border: `1px solid ${report.type === 'gian_lan_trong_tran' 
                    ? 'rgba(56, 189, 248, 0.3)' 
                    : 'rgba(148, 163, 184, 0.3)'}`,
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: 600, 
                      color: report.type === 'gian_lan_trong_tran' ? '#38BDF8' : '#94A3B8' 
                    }}>
                      ⚡ Chưa có phân tích
                    </div>
                    <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>
                      {report.type !== 'gian_lan_trong_tran' 
                        ? 'Loại báo cáo này không hỗ trợ phân tích tự động'
                        : report.match_id 
                          ? 'Có thể phân tích lại báo cáo này' 
                          : 'Báo cáo không có match_id - cần xem xét thủ công'}
                    </div>
                  </div>
                  {report.match_id && report.type === 'gian_lan_trong_tran' && (
                    <button
                      onClick={handleReprocess}
                      disabled={isUpdating}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #38BDF8 0%, #0EA5E9 100%)',
                        border: 'none',
                        color: '#FFFFFF',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: isUpdating ? 'not-allowed' : 'pointer',
                        opacity: isUpdating ? 0.7 : 1,
                      }}
                    >
                      {isUpdating ? 'Đang phân tích...' : '🔄 Phân tích lại'}
                    </button>
                  )}
                </div>
              )}

              {/* Rule Analysis */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid rgba(71, 85, 105, 0.3)',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '12px' }}>
                  🔧 Phân tích Rule-based
                </div>
                {report.reason_result ? (
                  <div style={{
                    fontSize: '14px',
                    color: '#CBD5E1',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    background: 'rgba(15, 23, 42, 0.5)',
                    padding: '12px',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                  }}>
                    {report.reason_result}
                  </div>
                ) : (
                  <div style={{ color: '#64748B', fontSize: '14px' }}>Chưa có phân tích rule-based</div>
                )}
                {report.rule_analysis && (
                  <details style={{ marginTop: '12px' }}>
                    <summary style={{ cursor: 'pointer', color: '#38BDF8', fontSize: '13px' }}>
                      Xem chi tiết JSON
                    </summary>
                    <pre style={{
                      marginTop: '8px',
                      padding: '12px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#94A3B8',
                      overflow: 'auto',
                      maxHeight: '200px',
                    }}>
                      {JSON.stringify(report.rule_analysis, null, 2)}
                    </pre>
                  </details>
                )}
              </div>

              {/* AI Analysis */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid rgba(168, 85, 247, 0.3)',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '12px' }}>
                  🤖 Phân tích AI
                </div>
                {report.ai_analysis ? (
                  <>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Kết quả cuối cùng</div>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          background: report.status === 'auto_flagged' 
                            ? 'rgba(239, 68, 68, 0.15)' 
                            : report.status === 'dismissed'
                              ? 'rgba(34, 197, 94, 0.15)'
                              : 'rgba(251, 191, 36, 0.15)',
                          color: report.status === 'auto_flagged' 
                            ? '#EF4444' 
                            : report.status === 'dismissed'
                              ? '#22C55E'
                              : '#FBBF24',
                          fontSize: '13px',
                          fontWeight: 600,
                        }}>
                          {report.status === 'auto_flagged' 
                            ? '⚠️ Có vi phạm' 
                            : report.status === 'dismissed'
                              ? '✅ Không vi phạm'
                              : '🔍 Cần xem xét'}
                        </span>
                        {report.ai_analysis.report_result && (
                          <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748B' }}>
                            (AI: {report.ai_analysis.report_result === 'co' ? 'có' : 'không'})
                          </span>
                        )}
                      </div>
                      {report.ai_summary_player && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Tóm tắt cho người chơi</div>
                          <div style={{ fontSize: '14px', color: '#CBD5E1' }}>{report.ai_summary_player}</div>
                        </div>
                      )}
                      {report.ai_details_admin && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Chi tiết cho Admin</div>
                          <div style={{ fontSize: '14px', color: '#CBD5E1', whiteSpace: 'pre-wrap' }}>
                            {report.ai_details_admin}
                          </div>
                        </div>
                      )}
                    </div>
                    <details style={{ marginTop: '12px' }}>
                      <summary style={{ cursor: 'pointer', color: '#A855F7', fontSize: '13px' }}>
                        Xem JSON đầy đủ
                      </summary>
                      <pre style={{
                        marginTop: '8px',
                        padding: '12px',
                        background: 'rgba(15, 23, 42, 0.7)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#94A3B8',
                        overflow: 'auto',
                        maxHeight: '200px',
                      }}>
                        {JSON.stringify(report.ai_analysis, null, 2)}
                      </pre>
                    </details>
                  </>
                ) : (
                  <div style={{ color: '#64748B', fontSize: '14px' }}>Chưa có phân tích AI</div>
                )}
              </div>
            </div>
          )}


          {/* Actions Tab */}
          {activeTab === 'actions' && (
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Status Update */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid rgba(71, 85, 105, 0.3)',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '16px' }}>
                  📊 Cập nhật trạng thái
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(['pending', 'auto_flagged', 'escalated', 'resolved', 'dismissed'] as ReportStatus[]).map((status) => {
                    const colors = STATUS_COLORS[status]
                    const isSelected = newStatus === status
                    return (
                      <button
                        key={status}
                        onClick={() => setNewStatus(status)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          background: isSelected ? colors.bg : 'rgba(71, 85, 105, 0.2)',
                          border: `1px solid ${isSelected ? colors.border : 'rgba(71, 85, 105, 0.3)'}`,
                          color: isSelected ? colors.text : '#94A3B8',
                          fontSize: '13px',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {getStatusLabel(status)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Admin Notes */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid rgba(71, 85, 105, 0.3)',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '12px' }}>
                  📝 Ghi chú Admin
                </div>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Thêm ghi chú nội bộ..."
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

              {/* Ban Options (only show if there's a reported user) */}
              {report.reported_user_id && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#EF4444', marginBottom: '16px' }}>
                    🚫 Áp dụng hình phạt
                  </div>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '6px', display: 'block' }}>
                        Loại hình phạt
                      </label>
                      <select
                        value={banType}
                        onChange={(e) => setBanType(e.target.value as any)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid rgba(71, 85, 105, 0.4)',
                          color: '#F8FAFC',
                          fontSize: '14px',
                          width: '100%',
                        }}
                      >
                        <option value="warning">⚠️ Cảnh cáo</option>
                        <option value="temporary">⏰ Ban tạm thời</option>
                        <option value="permanent">🚫 Ban vĩnh viễn</option>
                      </select>
                    </div>
                    {banType === 'temporary' && (
                      <div>
                        <label style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '6px', display: 'block' }}>
                          Thời gian ban (ngày)
                        </label>
                        <select
                          value={banDuration}
                          onChange={(e) => setBanDuration(Number(e.target.value))}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(71, 85, 105, 0.4)',
                            color: '#F8FAFC',
                            fontSize: '14px',
                            width: '100%',
                          }}
                        >
                          <option value={1}>1 ngày</option>
                          <option value={3}>3 ngày</option>
                          <option value={7}>7 ngày</option>
                          <option value={14}>14 ngày</option>
                          <option value={30}>30 ngày</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleDismiss}
                  disabled={isUpdating}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '10px',
                    background: 'rgba(148, 163, 184, 0.15)',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    color: '#94A3B8',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: isUpdating ? 'not-allowed' : 'pointer',
                  }}
                >
                  Bỏ qua
                </button>
                <button
                  onClick={handleUpdateReport}
                  disabled={isUpdating}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: isUpdating ? 'not-allowed' : 'pointer',
                    opacity: isUpdating ? 0.7 : 1,
                  }}
                >
                  {isUpdating ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
                {report.reported_user_id && (
                  <button
                    onClick={handleApplyBan}
                    disabled={isUpdating}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: isUpdating ? 'not-allowed' : 'pointer',
                      opacity: isUpdating ? 0.7 : 1,
                    }}
                  >
                    {isUpdating ? 'Đang xử lý...' : 'Áp dụng hình phạt'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Helper component for info cards */
function InfoCard({ title, icon, items }: { title: string; icon: string; items: { label: string; value: string }[] }) {
  return (
    <div style={{
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '12px',
      padding: '16px',
      border: '1px solid rgba(71, 85, 105, 0.3)',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '12px' }}>
        {icon} {title}
      </div>
      <div style={{ display: 'grid', gap: '8px' }}>
        {items.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#94A3B8' }}>{item.label}</span>
            <span style={{ fontSize: '13px', color: '#F8FAFC', fontWeight: 500 }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
