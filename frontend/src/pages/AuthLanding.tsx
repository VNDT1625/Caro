import React from 'react'

export default function AuthLanding() {
  return (
    <div className="auth-landing">
      <div className="auth-hero">
        <h1 className="auth-title">MindPoint Arena</h1>
        <p className="auth-sub">Hãy đăng nhập hoặc đăng ký để bắt đầu trận đấu</p>

        <div className="auth-buttons">
          <button className="auth-btn primary" onClick={() => { window.location.hash = '#login' }}>ĐĂNG NHẬP</button>
          <button className="auth-btn ghost" onClick={() => { window.location.hash = '#signup' }}>ĐĂNG KÝ</button>
        </div>
      </div>
    </div>
  )
}
