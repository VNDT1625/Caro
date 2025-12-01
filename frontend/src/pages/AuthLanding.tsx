import React from 'react'
import { useLanguage } from '../contexts/LanguageContext'

export default function AuthLanding() {
  const { t } = useLanguage()

  return (
    <div className="auth-landing">
      <div className="auth-hero">
        <h1 className="auth-title">MindPoint Arena</h1>
        <p className="auth-sub">{t('auth.landing.subtitle')}</p>

        <div className="auth-buttons">
          <button className="auth-btn primary" onClick={() => { window.location.hash = '#login' }}>{t('auth.landing.login')}</button>
          <button className="auth-btn ghost" onClick={() => { window.location.hash = '#signup' }}>{t('auth.landing.signup')}</button>
        </div>
      </div>
    </div>
  )
}
