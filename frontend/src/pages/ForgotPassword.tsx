import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'

export default function ForgotPassword() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!email.trim()) {
      setError('Vui lòng nhập email')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Email không hợp lệ')
      return
    }

    setLoading(true)
    try {
      // Use base URL without hash, App.tsx will detect type=recovery and redirect
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`
      })

      if (error) throw error

      setMessage('Đã gửi email khôi phục mật khẩu! Vui lòng kiểm tra hộp thư của bạn.')
      setEmail('')
    } catch (err: any) {
      console.error('Reset password error:', err)
      setError(err.message || 'Có lỗi xảy ra khi gửi email khôi phục')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container glass-card">
        <div className="auth-header">
          <h1 className="auth-title">🔐 Quên mật khẩu</h1>
          <p className="auth-subtitle">
            Nhập email của bạn để nhận link khôi phục mật khẩu
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="auth-form">
          {error && (
            <div className="auth-error" style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#EF4444',
              fontSize: '14px',
              marginBottom: '16px'
            }}>
              ⚠️ {error}
            </div>
          )}

          {message && (
            <div className="auth-success" style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(74, 222, 128, 0.1)',
              border: '1px solid rgba(74, 222, 128, 0.3)',
              color: '#4ADE80',
              fontSize: '14px',
              marginBottom: '16px'
            }}>
              ✅ {message}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              📧 Email
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              fontWeight: 600,
              marginTop: '8px'
            }}
          >
            {loading ? '⏳ Đang gửi...' : '📨 Gửi email khôi phục'}
          </button>
        </form>

        <div className="auth-footer">
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            marginTop: '20px'
          }}>
            <button
              className="auth-link-btn"
              onClick={() => { window.location.hash = '#login' }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#22D3EE',
                cursor: 'pointer',
                fontSize: '14px',
                textDecoration: 'underline'
              }}
            >
              ← Quay lại đăng nhập
            </button>
            <span style={{ color: 'var(--color-muted)' }}>|</span>
            <button
              className="auth-link-btn"
              onClick={() => { window.location.hash = '#signup' }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#22D3EE',
                cursor: 'pointer',
                fontSize: '14px',
                textDecoration: 'underline'
              }}
            >
              Tạo tài khoản mới →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
