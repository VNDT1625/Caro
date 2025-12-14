import React from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { supabase } from '../../lib/supabase'
import { getApiBase } from '../../lib/apiBase'

export type ReportType = 'gian_lan_trong_tran' | 'toxic' | 'bug' | 'khac'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  reportedUserId: string
  matchId?: string
  onSuccess?: () => void
}

export default function ReportModal({
  isOpen,
  onClose,
  reportedUserId,
  matchId,
  onSuccess
}: ReportModalProps) {
  const { t } = useLanguage()
  const [type, setType] = React.useState<ReportType>('gian_lan_trong_tran')
  const [description, setDescription] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [charCount, setCharCount] = React.useState(0)

  const MAX_DESCRIPTION_LENGTH = 1000

  const reportTypes: { value: ReportType; label: string; icon: string }[] = [
    { value: 'gian_lan_trong_tran', label: t('report.typeCheat') || 'Gian lận trong trận', icon: '🎮' },
    { value: 'toxic', label: t('report.typeToxic') || 'Hành vi toxic', icon: '💢' },
    { value: 'bug', label: t('report.typeBug') || 'Lỗi/Bug', icon: '🐛' },
    { value: 'khac', label: t('report.typeOther') || 'Khác', icon: '📝' }
  ]

  React.useEffect(() => {
    if (isOpen) {
      setType('gian_lan_trong_tran')
      setDescription('')
      setError(null)
      setCharCount(0)
    }
  }, [isOpen])

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    if (value.length <= MAX_DESCRIPTION_LENGTH) {
      setDescription(value)
      setCharCount(value.length)
    }
  }

  const validateForm = () => {
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      setError(t('report.errorDescriptionTooLong') || 'Mô tả không được vượt quá 1000 ký tự')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        setError(t('report.errorNotLoggedIn') || 'Bạn cần đăng nhập để gửi báo cáo')
        return
      }

      // PHP backend on port 8001
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8001'
      const response = await fetch(`${apiBase}/api/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          reported_user_id: reportedUserId,
          match_id: matchId || null,
          type,
          description: description.trim() || null
        })
      })

      // Đọc response text trước
      const responseText = await response.text()
      console.log('[ReportModal] Response status:', response.status)
      console.log('[ReportModal] Response text:', responseText.slice(0, 500))
      
      // Parse JSON nếu có content
      let data: any = {}
      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText)
        } catch (parseErr) {
          console.error('[ReportModal] JSON parse error:', parseErr)
          // Nếu response là HTML error page
          if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
            throw new Error('Server gặp lỗi. Vui lòng thử lại sau.')
          }
          // Nếu response là PHP error
          if (responseText.includes('Fatal error') || responseText.includes('Parse error')) {
            throw new Error('Server gặp lỗi cấu hình. Liên hệ admin.')
          }
          throw new Error(`Server trả về dữ liệu không hợp lệ: ${responseText.slice(0, 100)}`)
        }
      }
      
      if (!response.ok) {
        throw new Error(data.error?.message || data.message || `Lỗi ${response.status}: Không thể gửi báo cáo`)
      }

      onClose()
      onSuccess?.()
      alert(t('report.successMessage') || 'Đã gửi report, hệ thống sẽ kiểm tra')
    } catch (err: any) {
      console.error('Report submission error:', err)
      setError(err.message || t('report.errorGeneric') || 'Có lỗi xảy ra khi gửi báo cáo')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

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
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(20, 30, 48, 0.98) 100%)',
          borderRadius: '20px',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(239, 68, 68, 0.15)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(220, 38, 38, 0.08) 100%)',
            padding: '18px 22px',
            borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                boxShadow: '0 6px 20px rgba(239, 68, 68, 0.35)'
              }}
            >
              🚩
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#F8FAFC' }}>
                {t('report.modalTitle') || 'Báo cáo vi phạm'}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                {t('report.modalSubtitle') || 'Giúp chúng tôi giữ game công bằng'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'transparent',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              color: '#94A3B8',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            flex: 1,
            overflowY: 'auto'
          }}
        >
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '12px 14px',
                color: '#EF4444',
                fontSize: '14px'
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>
              {t('report.typeLabel') || 'Loại vi phạm'} <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {reportTypes.map((reportType) => (
                <label
                  key={reportType.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: type === reportType.value ? 'rgba(239, 68, 68, 0.14)' : 'rgba(30, 41, 59, 0.5)',
                    border: type === reportType.value
                      ? '1px solid rgba(239, 68, 68, 0.4)'
                      : '1px solid rgba(71, 85, 105, 0.35)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <input
                    type="radio"
                    name="reportType"
                    value={reportType.value}
                    checked={type === reportType.value}
                    onChange={() => setType(reportType.value)}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontSize: '18px' }}>{reportType.icon}</span>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: type === reportType.value ? 700 : 500,
                      color: type === reportType.value ? '#EF4444' : '#CBD5E1'
                    }}
                  >
                    {reportType.label}
                  </span>
                  {type === reportType.value && <span style={{ marginLeft: 'auto', color: '#EF4444' }}>✓</span>}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>
              {t('report.descriptionLabel') || 'Mô tả chi tiết'}{' '}
              <span style={{ color: '#94A3B8', fontWeight: 400 }}>
                ({t('report.optional') || 'không bắt buộc'})
              </span>
            </label>
            <textarea
              value={description}
              onChange={handleDescriptionChange}
              placeholder={t('report.descriptionPlaceholder') || 'Mô tả thêm về vi phạm bạn gặp phải...'}
              style={{
                width: '100%',
                minHeight: '110px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                color: '#F8FAFC',
                fontSize: '14px',
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.4'
              }}
            />
            <div style={{ textAlign: 'right', fontSize: '12px', color: charCount > MAX_DESCRIPTION_LENGTH * 0.9 ? '#EF4444' : '#94A3B8' }}>
              {charCount}/{MAX_DESCRIPTION_LENGTH}
            </div>
          </div>

          {matchId && (
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '13px',
                color: '#38BDF8',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <span>🎮</span>
              <span>{t('report.matchAttached') || 'Trận đấu sẽ được đính kèm tự động'}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              position: 'sticky',
              bottom: 0,
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              background: isSubmitting
                ? 'rgba(239, 68, 68, 0.3)'
                : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'all 0.2s ease',
              boxShadow: isSubmitting ? 'none' : '0 6px 20px rgba(239, 68, 68, 0.3)',
              marginTop: '8px'
            }}
          >
            {isSubmitting ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite' }}>⌛</span>
                <span>{t('report.submitting') || 'Đang gửi...'}</span>
              </>
            ) : (
              <>
                <span>📤</span>
                <span>{t('report.submit') || 'Gửi báo cáo'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
