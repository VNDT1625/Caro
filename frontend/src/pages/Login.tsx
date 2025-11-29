import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    if (!email || !password) return setMessage('Vui lòng điền email và mật khẩu')
    setLoading(true)
    ;(async () => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return setMessage(error.message)
        setMessage('Đăng nhập thành công')
        try { localStorage.setItem('supabase_session', JSON.stringify(data.session)) } catch (e) {}
        // go to home
        window.location.hash = '#home'
      } catch (err: any) {
        setMessage(err.message || 'Đăng nhập thất bại')
      } finally {
        setLoading(false)
      }
    })()
  }

  return (
    <div className="auth-page">
      <div className="auth-card panel">
        <h2 style={{ marginTop: 0 }}>Đăng nhập</h2>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder="Mật khẩu" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          
          <div style={{ textAlign: 'right', marginTop: '-4px', marginBottom: '4px' }}>
            <button
              type="button"
              onClick={() => { window.location.hash = '#forgot-password' }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#22D3EE',
                cursor: 'pointer',
                fontSize: '13px',
                textDecoration: 'underline',
                padding: 0
              }}
            >
              Quên mật khẩu?
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={loading}>{loading ? 'Đang...' : 'Đăng nhập'}</button>
            <button type="button" onClick={() => { window.location.hash = '#landing' }}>Quay lại</button>
          </div>
        </form>
        {message && <p style={{ color: 'var(--color-muted)' }}>{message}</p>}
        
        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '14px', color: 'var(--color-muted)' }}>
          Chưa có tài khoản?{' '}
          <button
            type="button"
            onClick={() => { window.location.hash = '#signup' }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#22D3EE',
              cursor: 'pointer',
              fontSize: '14px',
              textDecoration: 'underline',
              padding: 0
            }}
          >
            Đăng ký ngay
          </button>
        </div>
      </div>
    </div>
  )
}

