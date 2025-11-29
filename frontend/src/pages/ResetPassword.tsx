import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isValidToken, setIsValidToken] = useState(false)

  useEffect(() => {
    // Check if user has valid recovery token
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setIsValidToken(true)
      } else {
        setError('Link khôi phục không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu gửi lại email.')
      }
    }
    checkSession()
  }, [])

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu mới')
      return
    }

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      setMessage('✅ Đã đổi mật khẩu thành công! Đang chuyển đến trang đăng nhập...')
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.hash = '#login'
      }, 2000)
    } catch (err: any) {
      console.error('Update password error:', err)
      setError(err.message || 'Có lỗi xảy ra khi đổi mật khẩu')
    } finally {
      setLoading(false)
    }
  }

  if (!isValidToken && !error) {
    return (
      <div className="auth-page">
        <div className="auth-container glass-card">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <p style={{ color: 'var(--color-muted)' }}>Đang kiểm tra link khôi phục...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-container glass-card">
        <div className="auth-header">
          <h1 className="auth-title">🔑 Đặt lại mật khẩu</h1>
          <p className="auth-subtitle">
            Nhập mật khẩu mới cho tài khoản của bạn
          </p>
        </div>

        {!isValidToken ? (
          <div>
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
            <button
              className="btn-primary"
              onClick={() => { window.location.hash = '#forgot-password' }}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                fontWeight: 600
              }}
            >
              Gửi lại email khôi phục
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="auth-form">
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
                {message}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                🔒 Mật khẩu mới
              </label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="Ít nhất 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                🔒 Xác nhận mật khẩu
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="form-input"
                placeholder="Nhập lại mật khẩu"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {loading ? '⏳ Đang xử lý...' : '✓ Đặt lại mật khẩu'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <div style={{
            display: 'flex',
            justifyContent: 'center',
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
          </div>
        </div>
      </div>
    </div>
  )
}
