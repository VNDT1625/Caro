import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { validateUsernameInput, type UsernameValidationError } from '../lib/username'

interface UsernamePopupProps {
  userId: string
  currentUsername?: string
  onComplete: (username: string) => void
  onSkip?: () => void
}

export default function UsernamePopup({ userId, currentUsername, onComplete, onSkip }: UsernamePopupProps) {
  const { t } = useLanguage()
  const [username, setUsername] = useState(currentUsername || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [shake, setShake] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  const validation = validateUsernameInput(username)
  const { displayName, slug, error: validationError } = validation
  const errorKeyMap: Record<Exclude<UsernameValidationError, null>, string> = {
    empty: 'usernameErrorEmpty',
    short: 'usernameErrorShort',
    long: 'usernameErrorLong',
    invalid: 'usernameErrorInvalid'
  }

  // Check availability when input valid (debounced)
  useEffect(() => {
    setError('')
    setIsAvailable(null)

    if (validationError) {
      setCheckingAvailability(false)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setCheckingAvailability(true)
      try {
        const { data } = await supabase
          .from('profiles')
          .select('user_id')
          .ilike('username', slug)
          .maybeSingle()

        if (cancelled) return
        const available = !data || data.user_id === userId
        setIsAvailable(available)
        if (!available) {
          setError(t('profile.usernameErrorTaken'))
        }
      } catch (_e) {
        if (!cancelled) setIsAvailable(null)
      } finally {
        if (!cancelled) setCheckingAvailability(false)
      }
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [slug, validationError, userId, t])

  const handleSubmit = async () => {
    const { error: validationError, displayName, slug } = validation

    if (validationError) {
      setError(t(`profile.${errorKeyMap[validationError]}`))
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }

    if (isAvailable === false) {
      setError(t('profile.usernameErrorTaken'))
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }

    setIsLoading(true)
    setError('')

    // Helper for timeout - wraps PromiseLike in real Promise
    const withTimeout = <T,>(promiseLike: PromiseLike<T>, ms: number): Promise<T> => {
      return Promise.race([
        Promise.resolve(promiseLike),
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms))
      ])
    }

    try {
      // Check if username is taken (with timeout)
      let existing: { user_id: string } | null = null
      try {
        const result = await withTimeout(
          supabase
            .from('profiles')
            .select('user_id')
            .ilike('username', slug)
            .maybeSingle(),
          8000
        )
        existing = result.data
      } catch (e: any) {
        // If timeout or network error, skip check and try to save anyway
        console.warn('[UsernamePopup] Username check failed, proceeding:', e?.message)
      }

      if (existing && existing.user_id !== userId) {
        setError(t('profile.usernameErrorTaken'))
        setShake(true)
        setTimeout(() => setShake(false), 500)
        setIsLoading(false)
        return
      }

      // First check if profile exists (with timeout)
      let profileExists: { user_id: string } | null = null
      try {
        const result = await withTimeout(
          supabase
            .from('profiles')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle(),
          8000
        )
        profileExists = result.data
      } catch (e: any) {
        console.warn('[UsernamePopup] Profile check failed:', e?.message)
      }

      let updateError: any = null

      if (!profileExists) {
        // Profile doesn't exist, create it with upsert
        console.log('[UsernamePopup] Profile not found, creating new profile for:', userId)
        try {
          const result = await withTimeout(
            supabase
              .from('profiles')
              .upsert({
                user_id: userId,
                username: slug,
                display_name: displayName,
                coins: 0,
                gems: 0,
                current_rank: 'vo_danh'
              }, { onConflict: 'user_id' }),
            8000
          )
          updateError = result.error
        } catch (e: any) {
          console.error('[UsernamePopup] Upsert timeout/error:', e?.message)
          // If Supabase is down, save locally and proceed
          if (e?.message === 'Request timeout' || e?.message?.includes('Failed to fetch')) {
            console.log('[UsernamePopup] Supabase unavailable, saving locally')
            localStorage.setItem('pendingUsername', JSON.stringify({
              userId,
              username: slug,
              display_name: displayName,
              timestamp: Date.now()
            }))
            window.dispatchEvent(new CustomEvent('profileUpdated', { 
              detail: { username: slug, display_name: displayName, field: 'username' } 
            }))
            onComplete(displayName)
            setIsLoading(false)
            return
          }
          updateError = e
        }
      } else {
        // Profile exists, update it
        console.log('[UsernamePopup] Updating existing profile for:', userId)
        try {
          const result = await withTimeout(
            supabase
              .from('profiles')
              .update({ username: slug, display_name: displayName })
              .eq('user_id', userId)
              .select(),
            8000
          )
          console.log('[UsernamePopup] Update result:', { error: result.error, data: result.data })
          updateError = result.error
        } catch (e: any) {
          console.error('[UsernamePopup] Update timeout/error:', e?.message)
          if (e?.message === 'Request timeout' || e?.message?.includes('Failed to fetch')) {
            console.log('[UsernamePopup] Supabase unavailable, saving locally')
            localStorage.setItem('pendingUsername', JSON.stringify({
              userId,
              username: slug,
              display_name: displayName,
              timestamp: Date.now()
            }))
            window.dispatchEvent(new CustomEvent('profileUpdated', { 
              detail: { username: slug, display_name: displayName, field: 'username' } 
            }))
            onComplete(displayName)
            setIsLoading(false)
            return
          }
          updateError = e
        }
      }

      if (updateError) {
        console.error('[UsernamePopup] Database error:', updateError)
        setError(updateError.code === '23505' ? t('profile.usernameErrorTaken') : t('common.error'))
        setShake(true)
        setTimeout(() => setShake(false), 500)
        setIsLoading(false)
        return
      }

      // Verify the update was successful by reading back (with timeout, optional)
      try {
        const result = await withTimeout(
          supabase
            .from('profiles')
            .select('username, display_name')
            .eq('user_id', userId)
            .maybeSingle(),
          5000
        )

        console.log('[UsernamePopup] Verification:', { data: result.data, error: result.error })

        if (result.error || !result.data?.username) {
        console.warn('[UsernamePopup] Verification failed, but proceeding anyway')
      } else {
        console.log('[UsernamePopup] Username saved successfully:', result.data.username)
      }
    } catch (e) {
        console.warn('[UsernamePopup] Verification timeout, proceeding anyway')
      }

    window.dispatchEvent(new CustomEvent('profileUpdated', { 
      detail: { username: slug, display_name: displayName, field: 'username' } 
    }))
    onComplete(displayName)
  } catch (e: any) {
    console.error('[UsernamePopup] Unexpected error:', e)
    // If network error, allow user to proceed with local save
    if (e?.message?.includes('Failed to fetch') || e?.message === 'Request timeout') {
      localStorage.setItem('pendingUsername', JSON.stringify({
        userId,
        username: slug,
        display_name: displayName,
        timestamp: Date.now()
      }))
      onComplete(displayName)
    } else {
      setError(t('common.error'))
    }
  }
    setIsLoading(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && !validation.error) handleSubmit()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value)
    setError('')
  }

  const isValid = !validation.error && isAvailable !== false
  const hasMinLength = validation.displayName.length >= 3
  const hasValidChars = validation.slug.length >= 3 && validation.slug.length <= 20
  const uniqueStatus = isAvailable === true ? 'done' : isAvailable === false ? 'fail' : ''

  const content = (
    <div className="xh-overlay">
      {/* Subtle grid - bàn cờ */}
      <div className="xh-grid" />
      
      {/* Mist - tập trung quanh card */}
      <div className="xh-mist xh-mist-center" />
      
      {/* Floating particles - linh khí */}
      <div className="xh-particles">
        {[...Array(6)].map((_, i) => (
          <span key={i} className="xh-particle" style={{
            left: `${20 + Math.random() * 60}%`,
            animationDelay: `${i * 0.8}s`,
            animationDuration: `${4 + Math.random() * 2}s`
          }} />
        ))}
      </div>

      <div className={`xh-card ${shake ? 'shake' : ''}`}>
        {/* Border glow */}
        <div className="xh-border-glow" />
        
        {/* Top accent line */}
        <div className="xh-accent" />

        {/* Icon với light flare */}
        <div className="xh-icon">
          <span className="xh-icon-flare" />
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M14.5 3L12 7.5L9.5 3L7 8L3 9.5L7.5 12L3 14.5L7 16L9.5 21L12 16.5L14.5 21L17 16L21 14.5L16.5 12L21 9.5L17 8L14.5 3Z" 
              fill="url(#iconGrad)" stroke="rgba(45,212,191,0.5)" strokeWidth="0.5"/>
            <defs>
              <linearGradient id="iconGrad" x1="3" y1="3" x2="21" y2="21">
                <stop offset="0%" stopColor="#2dd4bf"/>
                <stop offset="100%" stopColor="#0d9488"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Title - lớn hơn, gradient */}
        <h2 className="xh-title">{t('profile.usernamePopupTitle')}</h2>
        
        {/* Desc - nhỏ hơn, tách lớp */}
        <p className="xh-desc">{t('profile.usernamePopupDesc')}</p>

        {/* Input với pattern và feedback */}
        <div className={`xh-input-wrap ${isFocused ? 'focused' : ''} ${error ? 'error' : ''} ${isValid && !error ? 'valid' : ''}`}>
          <div className="xh-input-pattern" />
          <span className="xh-at">@</span>
          <input
            type="text"
            value={username}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={t('profile.usernamePlaceholder')}
            maxLength={20}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          <span className={`xh-count ${hasMinLength ? 'valid' : ''}`}>{username.length}/20</span>
          {isValid && !error && <span className="xh-check">✓</span>}
        </div>

        {/* Error message */}
        {error && <div className="xh-error">⚠ {error}</div>}

        {/* Rules - với checkmarks */}
        <div className="xh-rules">
          <span className={hasMinLength ? 'done' : ''}>
            <i>{hasMinLength ? '✓' : '○'}</i> {t('profile.usernameRuleMin')}
          </span>
          <span className={hasValidChars ? 'done' : 'fail'}>
            <i>{hasValidChars ? '✓' : '✗'}</i> {t('profile.usernameRuleAllowed')}
          </span>
          <span className={uniqueStatus}>
            <i>{uniqueStatus === 'done' ? '✓' : uniqueStatus === 'fail' ? '✗' : (checkingAvailability ? '…' : '○')}</i> {t('profile.usernameRuleUnique')}
          </span>
        </div>

        {/* CTA Button - gradient khi enable */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || !isValid}
          className={`xh-btn ${isValid && !isLoading ? 'active' : ''}`}
        >
          {isLoading ? (
            <><span className="xh-spinner" /> {t('profile.usernameProcessing')}</>
          ) : (
            <>
              {t('profile.usernameConfirm')}
              <span className="xh-arrow">→</span>
            </>
          )}
        </button>

        {onSkip && (
          <button onClick={onSkip} className="xh-skip">
            {t('onboarding.general.skip')}
          </button>
        )}
      </div>

      <style>{`
        .xh-overlay {
          position: fixed;
          inset: 0;
          background: radial-gradient(ellipse at 50% 30%, #0c1929 0%, #020810 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100000;
          padding: 16px;
          overflow: hidden;
        }

        .xh-grid {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(45, 212, 191, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(45, 212, 191, 0.04) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse at 50% 50%, black 30%, transparent 70%);
          pointer-events: none;
        }

        .xh-mist-center {
          position: absolute;
          width: 500px;
          height: 500px;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, rgba(45, 212, 191, 0.12) 0%, transparent 60%);
          filter: blur(60px);
          pointer-events: none;
          animation: mistPulse 4s ease-in-out infinite;
        }

        @keyframes mistPulse {
          0%, 100% { opacity: 0.8; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
        }

        .xh-particles {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .xh-particle {
          position: absolute;
          width: 3px;
          height: 3px;
          background: rgba(45, 212, 191, 0.6);
          border-radius: 50%;
          bottom: 30%;
          animation: particleRise 5s ease-in-out infinite;
          box-shadow: 0 0 6px rgba(45, 212, 191, 0.4);
        }

        @keyframes particleRise {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-150px) scale(0.5); opacity: 0; }
        }

        .xh-card {
          background: linear-gradient(160deg, rgba(15, 30, 50, 0.95) 0%, rgba(8, 20, 35, 0.98) 100%);
          border-radius: 24px;
          padding: 36px 32px 32px;
          width: 100%;
          max-width: 400px;
          position: relative;
          box-shadow: 
            0 0 0 1px rgba(45, 212, 191, 0.15),
            0 25px 80px rgba(0, 0, 0, 0.6),
            0 0 60px rgba(45, 212, 191, 0.08);
          animation: cardIn 0.35s cubic-bezier(0.34, 1.4, 0.64, 1);
          overflow: hidden;
        }

        .xh-card.shake {
          animation: shake 0.4s ease-in-out;
        }

        @keyframes cardIn {
          from { opacity: 0; transform: scale(0.92) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }

        .xh-border-glow {
          position: absolute;
          inset: -1px;
          border-radius: 25px;
          background: linear-gradient(135deg, rgba(45, 212, 191, 0.3) 0%, transparent 40%, transparent 60%, rgba(20, 184, 166, 0.2) 100%);
          z-index: -1;
          animation: borderGlow 3s ease-in-out infinite;
        }

        @keyframes borderGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        .xh-accent {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 50%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #2dd4bf, transparent);
          border-radius: 0 0 4px 4px;
        }

        .xh-icon {
          width: 72px;
          height: 72px;
          margin: 0 auto 20px;
          background: linear-gradient(145deg, rgba(45, 212, 191, 0.12) 0%, rgba(20, 184, 166, 0.08) 100%);
          border: 1px solid rgba(45, 212, 191, 0.2);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          box-shadow: 
            0 8px 32px rgba(45, 212, 191, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .xh-icon-flare {
          position: absolute;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%);
          border-radius: 20px;
          animation: flare 2s ease-in-out infinite;
        }

        @keyframes flare {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .xh-title {
          margin: 0 0 8px;
          font-size: 26px;
          font-weight: 800;
          background: linear-gradient(135deg, #fff 0%, #a5f3fc 50%, #2dd4bf 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-align: center;
          letter-spacing: -0.02em;
        }

        .xh-desc {
          margin: 0 0 24px;
          font-size: 13px;
          color: rgba(148, 163, 184, 0.9);
          text-align: center;
          line-height: 1.5;
        }

        .xh-input-wrap {
          position: relative;
          background: rgba(8, 18, 30, 0.9);
          border: 1.5px solid rgba(71, 85, 105, 0.25);
          border-radius: 14px;
          transition: all 0.25s ease;
          overflow: hidden;
        }

        .xh-input-pattern {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(45, 212, 191, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(45, 212, 191, 0.02) 1px, transparent 1px);
          background-size: 12px 12px;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .xh-input-wrap.focused .xh-input-pattern {
          opacity: 1;
        }

        .xh-input-wrap.focused {
          border-color: rgba(45, 212, 191, 0.5);
          box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1), 0 0 20px rgba(45, 212, 191, 0.1);
        }

        .xh-input-wrap.valid {
          border-color: rgba(34, 197, 94, 0.5);
          box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.08), 0 0 15px rgba(34, 197, 94, 0.1);
        }

        .xh-input-wrap.error {
          border-color: rgba(239, 68, 68, 0.4);
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.08);
        }

        .xh-at {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #2dd4bf;
          font-weight: 700;
          font-size: 16px;
          z-index: 1;
        }

        .xh-input-wrap input {
          width: 100%;
          padding: 16px 70px 16px 40px;
          background: transparent;
          border: none;
          color: #f1f5f9;
          font-size: 16px;
          font-weight: 500;
          outline: none;
          position: relative;
          z-index: 1;
        }

        .xh-input-wrap input::placeholder {
          color: rgba(100, 116, 139, 0.7);
          font-style: italic;
        }

        .xh-count {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 12px;
          color: #64748b;
          font-weight: 600;
          z-index: 1;
          transition: color 0.2s;
        }

        .xh-count.valid {
          color: #22c55e;
        }

        .xh-check {
          position: absolute;
          right: 50px;
          top: 50%;
          transform: translateY(-50%);
          color: #22c55e;
          font-size: 16px;
          font-weight: bold;
          z-index: 1;
          animation: checkPop 0.3s ease;
        }

        @keyframes checkPop {
          0% { transform: translateY(-50%) scale(0); }
          50% { transform: translateY(-50%) scale(1.3); }
          100% { transform: translateY(-50%) scale(1); }
        }

        .xh-error {
          margin-top: 10px;
          font-size: 13px;
          color: #f87171;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
          animation: errorIn 0.3s ease;
        }

        @keyframes errorIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .xh-rules {
          display: flex;
          gap: 16px;
          margin: 14px 0 20px;
          flex-wrap: wrap;
        }

        .xh-rules span {
          font-size: 12px;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: color 0.2s;
        }

        .xh-rules span i {
          font-style: normal;
          font-size: 10px;
        }

        .xh-rules span.done {
          color: #22c55e;
        }

        .xh-rules span.fail {
          color: #f87171;
        }

        .xh-btn {
          width: 100%;
          padding: 16px;
          border: none;
          border-radius: 14px;
          background: rgba(71, 85, 105, 0.25);
          color: #64748b;
          font-size: 15px;
          font-weight: 700;
          cursor: not-allowed;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
        }

        .xh-btn.active {
          background: linear-gradient(135deg, #2dd4bf 0%, #0d9488 100%);
          color: #042f2e;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(45, 212, 191, 0.35);
        }

        .xh-btn.active::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }

        .xh-btn.active:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(45, 212, 191, 0.45);
        }

        .xh-btn.active:active {
          transform: translateY(0);
        }

        .xh-arrow {
          font-size: 18px;
          transition: transform 0.2s;
        }

        .xh-btn.active:hover .xh-arrow {
          transform: translateX(4px);
        }

        .xh-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(4, 47, 46, 0.3);
          border-top-color: #042f2e;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .xh-skip {
          width: 100%;
          margin-top: 12px;
          padding: 12px;
          background: transparent;
          border: 1px solid rgba(71, 85, 105, 0.2);
          border-radius: 12px;
          color: #64748b;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .xh-skip:hover {
          background: rgba(71, 85, 105, 0.1);
          color: #94a3b8;
        }

        @media (max-width: 480px) {
          .xh-card {
            padding: 28px 24px 24px;
            border-radius: 20px;
          }
          .xh-icon {
            width: 60px;
            height: 60px;
          }
          .xh-title {
            font-size: 22px;
          }
          .xh-rules {
            gap: 10px;
          }
        }
      `}</style>
    </div>
  )

  // Use portal to avoid parent transforms clipping the overlay
  if (typeof document !== 'undefined') {
    return createPortal(content, document.body)
  }

  return content
}
