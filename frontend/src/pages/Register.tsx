import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'

export default function Register() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    if (!email || !password) return setMessage('Vui lòng điền email và mật khẩu')
    if (password !== confirm) return setMessage('Mật khẩu không khớp')
    setLoading(true)
    ;(async () => {
      try {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) return setMessage(error.message)
        setMessage('Đăng ký thành công — kiểm tra email để xác nhận (nếu có)')
        // optionally redirect to login
        setTimeout(() => { window.location.hash = '#login' }, 1200)
      } catch (err: any) {
        setMessage(err.message || 'Đăng ký thất bại')
      } finally {
        setLoading(false)
      }
    })()
  }

  return (
    <div className="auth-page">
      <div className="auth-card panel">
        <h2 style={{ marginTop: 0 }}>Đăng ký</h2>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder="Mật khẩu" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <input placeholder="Xác nhận mật khẩu" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={loading}>{loading ? 'Đang...' : 'Đăng ký'}</button>
            <button type="button" onClick={() => { window.location.hash = '#landing' }}>Quay lại</button>
          </div>
        </form>
        {message && <p style={{ color: 'var(--color-muted)' }}>{message}</p>}
      </div>
    </div>
  )
}

