import React from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { supabase } from '../../lib/supabase'

interface BanInfo {
  id: string
  ban_type: 'temporary' | 'permanent' | 'warning'
  reason: string
  expires_at: string | null
  summary_for_player?: string
  report_id?: string
}

interface BanNotificationModalProps {
  /** Ban information to display */
  banInfo: BanInfo
  /** Callback when user clicks OK */
  onClose: () => void
  /** Callback when user clicks Appeal button */
  onAppeal?: (reportId: string) => void
}

/**
 * BanNotificationModal - displays when a user is banned
 * Shows ban reason, duration, and provides appeal option
 * Requirements: 8.5, 6.4
 */
export default function BanNotificationModal({
  banInfo,
  onClose,
  onAppeal
}: BanNotificationModalProps) {
  const { t } = useLanguage()
  const [isAppealing, setIsAppealing] = React.useState(false)
  const [appealReason, setAppealReason] = React.useState('')
  const [appealError, setAppealError] = React.useState<string | null>(null)
  const [appealSubmitted, setAppealSubmitted] = React.useState(false)

  const formatExpiryDate = (dateStr: string | null): string => {
    if (!dateStr) return t('ban.permanent') || 'Vĩnh viễn'
    const date = new Date(dateStr)
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getBanTypeLabel = (type: string): string => {
    switch (type) {
      case 'temporary':
        return t('ban.typeTemporary') || 'Tạm khóa'
      case 'permanent':
        return t('ban.typePermanent') || 'Khóa vĩnh viễn'
      case 'warning':
        return t('ban.typeWarning') || 'Cảnh cáo'
      default:
        return type
    }
  }

  const getBanIcon = (type: string): string => {
    switch (type) {
      case 'temporary':
        return '⏰'
      case 'permanent':
        return '🔒'
      case 'warning':
        return '⚠️'
      default:
        return '🚫'
    }
  }


  const handleAppealSubmit = async () => {
    if (!appealReason.trim()) {
      setAppealError(t('appeal.errorReasonRequired') || 'Vui lòng nhập lý do khiếu nại')
      return
    }

    if (!banInfo.report_id) {
      setAppealError(t('appeal.errorNoReport') || 'Không tìm thấy báo cáo liên quan')
      return
    }

    setAppealError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        setAppealError(t('appeal.errorNotLoggedIn') || 'Bạn cần đăng nhập để gửi khiếu nại')
        return
      }

      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8001'
      const response = await fetch(`${apiBase}/api/appeals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          report_id: banInfo.report_id,
          reason: appealReason.trim()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || data.message || 'Không thể gửi khiếu nại')
      }

      setAppealSubmitted(true)
      onAppeal?.(banInfo.report_id)
    } catch (err: any) {
      console.error('Appeal submission error:', err)
      setAppealError(err.message || t('appeal.errorGeneric') || 'Có lỗi xảy ra khi gửi khiếu nại')
    }
  }

  return (
    <div 
      className="ban-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        padding: '20px'
      }}
    >
      <div 
        className="ban-modal glass-card"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 20, 20, 0.98) 100%)',
          borderRadius: '24px',
          maxWidth: '500px',
          width: '100%',
          overflow: 'hidden',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          boxShadow: '0 25px 80px rgba(239, 68, 68, 0.3), 0 0 0 1px rgba(239, 68, 68, 0.2)'
        }}
      >
        {/* Header with warning icon */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.15) 100%)',
          padding: '32px 24px',
          textAlign: 'center',
          borderBottom: '1px solid rgba(239, 68, 68, 0.2)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px',
            margin: '0 auto 16px',
            boxShadow: '0 10px 40px rgba(239, 68, 68, 0.4)'
          }}>
            {getBanIcon(banInfo.ban_type)}
          </div>
          <h2 style={{ 
            margin: 0, 
            fontSize: '24px', 
            fontWeight: 700, 
            color: '#EF4444',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            {t('ban.title') || 'Tài khoản bị khóa'}
          </h2>
          <p style={{ 
            margin: '8px 0 0', 
            fontSize: '14px', 
            color: '#F87171' 
          }}>
            {getBanTypeLabel(banInfo.ban_type)}
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Ban reason */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ 
              fontSize: '12px', 
              color: '#94A3B8', 
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {t('ban.reasonLabel') || 'Lý do'}
            </div>
            <p style={{ 
              margin: 0, 
              fontSize: '15px', 
              color: '#F8FAFC',
              lineHeight: '1.6'
            }}>
              {banInfo.summary_for_player || banInfo.reason || t('ban.noReason') || 'Không có thông tin chi tiết'}
            </p>
          </div>

          {/* Expiry date */}
          {banInfo.ban_type !== 'warning' && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.6)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '24px' }}>📅</span>
              <div>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#94A3B8',
                  marginBottom: '4px'
                }}>
                  {banInfo.ban_type === 'permanent' 
                    ? (t('ban.permanentLabel') || 'Thời hạn')
                    : (t('ban.expiresLabel') || 'Hết hạn vào')}
                </div>
                <div style={{ 
                  fontSize: '15px', 
                  color: banInfo.ban_type === 'permanent' ? '#EF4444' : '#FBBF24',
                  fontWeight: 600
                }}>
                  {formatExpiryDate(banInfo.expires_at)}
                </div>
              </div>
            </div>
          )}


          {/* Appeal Section */}
          {!appealSubmitted && banInfo.report_id && !isAppealing && (
            <div style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <p style={{ 
                margin: 0, 
                fontSize: '14px', 
                color: '#38BDF8',
                lineHeight: '1.5'
              }}>
                💡 {t('ban.appealInfo') || 'Nếu bạn cho rằng đây là sai sót, bạn có thể gửi khiếu nại để được xem xét lại.'}
              </p>
            </div>
          )}

          {/* Appeal Form */}
          {isAppealing && !appealSubmitted && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: '#F8FAFC',
                marginBottom: '10px'
              }}>
                {t('appeal.reasonLabel') || 'Lý do khiếu nại'}
              </label>
              <textarea
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder={t('appeal.reasonPlaceholder') || 'Giải thích tại sao bạn cho rằng quyết định này không chính xác...'}
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                  color: '#F8FAFC',
                  fontSize: '14px',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
              {appealError && (
                <p style={{ 
                  margin: '8px 0 0', 
                  fontSize: '13px', 
                  color: '#EF4444' 
                }}>
                  {appealError}
                </p>
              )}
            </div>
          )}

          {/* Appeal Submitted Message */}
          {appealSubmitted && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>✅</span>
              <p style={{ 
                margin: 0, 
                fontSize: '15px', 
                color: '#22C55E',
                fontWeight: 600
              }}>
                {t('appeal.submitted') || 'Khiếu nại đã được gửi'}
              </p>
              <p style={{ 
                margin: '8px 0 0', 
                fontSize: '13px', 
                color: '#86EFAC' 
              }}>
                {t('appeal.submittedInfo') || 'Admin sẽ xem xét và phản hồi trong thời gian sớm nhất.'}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '12px',
            flexDirection: isAppealing ? 'row' : 'column'
          }}>
            {!appealSubmitted && banInfo.report_id && (
              isAppealing ? (
                <>
                  <button
                    onClick={() => setIsAppealing(false)}
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: '12px',
                      background: 'rgba(71, 85, 105, 0.3)',
                      border: '1px solid rgba(71, 85, 105, 0.4)',
                      color: '#94A3B8',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {t('common.cancel') || 'Hủy'}
                  </button>
                  <button
                    onClick={handleAppealSubmit}
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #38BDF8 0%, #0EA5E9 100%)',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: '15px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 6px 20px rgba(56, 189, 248, 0.3)'
                    }}
                  >
                    {t('appeal.submit') || 'Gửi khiếu nại'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsAppealing(true)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38BDF8',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <span>📝</span>
                  <span>{t('ban.appealButton') || 'Khiếu nại'}</span>
                </button>
              )
            )}
            
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(71, 85, 105, 0.4) 0%, rgba(51, 65, 85, 0.4) 100%)',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                color: '#F8FAFC',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {t('common.ok') || 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
