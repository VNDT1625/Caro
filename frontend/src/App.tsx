import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useLanguage } from './contexts/LanguageContext'
import { RankBadgeV2 } from './components/rank'
import type { MainRank, RankTier, RankLevel } from './types/rankV2'
import { useEquippedMusic } from './hooks/useEquippedMusic'
import { useEquippedFrame } from './hooks/useEquippedFrame'
import { AvatarWithFrame } from './components/avatar'
import Home from './pages/Home'
import AiAnalysis from './pages/AiAnalysis'
import Lobby from './pages/Lobby'
import Room from './pages/Room'
import TrainingRoom from './pages/TrainingRoom'
import VariantMatch from './pages/VariantMatch'
import Shop from './pages/Shop'
import Profile from './pages/Profile'
import Inventory from './pages/Inventory'
import Matchmaking from './pages/Matchmaking'
import CreateRoom from './pages/CreateRoom'
import InMatch from './pages/InMatch'
import Quests from './pages/Quests'
import Guide from './pages/Guide'
import Events from './pages/Events'
import Tournament from './pages/Tournament'
import AuthLanding from './pages/AuthLanding'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Hotseat from './pages/Hotseat'
import Admin from './pages/Admin'
import KhaiNhan from './pages/KhaiNhan'
import Subscription from './pages/Subscription'
import CurrencyShop from './pages/CurrencyShop'
import PaymentResult from './pages/PaymentResult'
import CurrencyResult from './pages/CurrencyResult'
import TestAI from './pages/TestAI'
import Inbox from './pages/Inbox'
import AdminNotifications from './pages/AdminNotifications'
import AdminReports from './pages/AdminReports'
import AdminAppeals from './pages/AdminAppeals'
import Titles from './pages/Titles'
import InboxIcon from './components/notification/InboxIcon'
import { getEquippedTitle } from './lib/titleApi'
import UsernamePopup from './components/UsernamePopup'
import OnboardingTour from './components/OnboardingTour'
import { AudioManager, loadAudioSettingsFromStorage } from './lib/AudioManager'
import { NotificationManager, loadNotificationSettingsFromStorage } from './lib/NotificationManager'
import { preloadDataset } from './lib/caroDataset'

function SettingsPopup({ onClose }: { onClose: () => void }) {
  const { language, setLanguage, t } = useLanguage()
  const initialAudio = React.useMemo(() => loadAudioSettingsFromStorage(), [])
  const [sfxEnabled, setSfxEnabled] = React.useState(initialAudio.sfxEnabled)
  const [sfxVolume, setSfxVolume] = React.useState(initialAudio.sfxVolume)
  const [bgMusicEnabled, setBgMusicEnabled] = React.useState(initialAudio.bgMusic)
  const [bgMusicVolume, setBgMusicVolume] = React.useState(initialAudio.bgMusicVolume)
  const [notifEnabled, setNotifEnabled] = React.useState(() => localStorage.getItem('systemNotif') !== 'false')
  const [effectsQuality, setEffectsQuality] = React.useState(() => localStorage.getItem('effectsQuality') || 'high')

  const getStoredGameSettings = () => {
    try {
      return JSON.parse(localStorage.getItem('gameSettings') || '{}')
    } catch {
      return {}
    }
  }

  const updateAudioSettings = (partial: Partial<ReturnType<typeof loadAudioSettingsFromStorage>>) => {
    const stored = getStoredGameSettings()
    const next = {
      ...stored,
      bgMusic: partial.bgMusic ?? bgMusicEnabled,
      bgMusicVolume: partial.bgMusicVolume ?? bgMusicVolume,
      sfxEnabled: partial.sfxEnabled ?? sfxEnabled,
      sfxVolume: partial.sfxVolume ?? sfxVolume,
      moveSoundEnabled: stored.moveSoundEnabled ?? true
    }

    localStorage.setItem('gameSettings', JSON.stringify(next))
    // Legacy keys to keep older UI parts in sync
    localStorage.setItem('bgMusic', String(next.bgMusic))
    localStorage.setItem('bgMusicVolume', String(next.bgMusicVolume))
    localStorage.setItem('sfxEnabled', String(next.sfxEnabled))
    localStorage.setItem('sfxVolume', String(next.sfxVolume))

    AudioManager.updateSettings({
      bgMusic: next.bgMusic,
      bgMusicVolume: next.bgMusicVolume,
      sfxEnabled: next.sfxEnabled,
      sfxVolume: next.sfxVolume,
      moveSoundEnabled: next.moveSoundEnabled
    })

    // thông báo cho các màn khác (Profile) đồng bộ UI
    window.dispatchEvent(new CustomEvent('audioSettingsUpdated', { detail: next }))

    if (next.bgMusic) {
      AudioManager.playBackgroundMusic()
    } else {
      AudioManager.pauseBackgroundMusic()
    }
  }

  const handleSfxToggle = (enabled: boolean) => {
    setSfxEnabled(enabled)
    updateAudioSettings({ sfxEnabled: enabled })
    // Play feedback sound when enabling
    if (enabled) playClickSound()
  }

  const handleSfxVolumeChange = (volume: number) => {
    const enable = volume > 0
    setSfxVolume(volume)
    setSfxEnabled(enable)
    updateAudioSettings({ sfxVolume: volume, sfxEnabled: enable })
    // Debounced sound preview
    playVolumePreview()
  }

  const handleBgMusicToggle = (enabled: boolean) => {
    setBgMusicEnabled(enabled)
    updateAudioSettings({ bgMusic: enabled })
  }

  const playClickSound = () => {
    AudioManager.playSoundEffect('button')
  }

  const playVolumePreview = () => {
    AudioManager.playSoundEffect('move')
  }

  return (
    <div className="settings-popup-overlay" onClick={onClose} style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      animation: 'fadeIn 0.15s ease-out',
      padding: '20px'
    }}>
      <div className="settings-popup glass-card" onClick={(e) => e.stopPropagation()} style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(20, 30, 48, 0.98) 100%)',
        borderRadius: '24px',
        padding: '0',
        maxWidth: '420px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(56, 189, 248, 0.15)',
        animation: 'slideUp 0.25s cubic-bezier(0.34, 1.5, 0.64, 1)'
      }}>
        <div className="settings-header" style={{
          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)',
          padding: '20px 24px',
          borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #38BDF8 0%, #3B82F6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              boxShadow: '0 6px 20px rgba(56, 189, 248, 0.35)'
            }}>⚙️</div>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#F8FAFC', letterSpacing: '-0.02em' }}>{t('settings.title')}</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>{t('settings.subtitle')}</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'transparent',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            color: '#94A3B8',
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 300
          }} onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'
            e.currentTarget.style.color = '#EF4444'
          }} onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)'
            e.currentTarget.style.color = '#94A3B8'
          }}>✕</button>
        </div>
        
        <div className="settings-content" style={{
          padding: '20px 24px 24px',
          maxHeight: 'calc(90vh - 100px)',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}>
          {/* Main Settings Card */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.5)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid rgba(71, 85, 105, 0.3)',
            marginBottom: '16px'
          }}>
            {/* Âm thanh hiệu ứng - Slider */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>🔊</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>{t('settings.sfx')}</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#38BDF8' }}>{sfxVolume}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={sfxVolume}
                onChange={(e) => handleSfxVolumeChange(Number(e.target.value))}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: `linear-gradient(to right, #38BDF8 0%, #38BDF8 ${sfxVolume}%, rgba(71, 85, 105, 0.3) ${sfxVolume}%, rgba(71, 85, 105, 0.3) 100%)`,
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
              />
            </div>

            {/* Nhạc nền - Slider */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>🎵</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>{t('settings.bgMusic')}</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#A855F7' }}>{bgMusicVolume}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={bgMusicVolume}
                onChange={(e) => {
                  const vol = Number(e.target.value)
                  setBgMusicVolume(vol)
                  if (vol > 0 && !bgMusicEnabled) {
                    setBgMusicEnabled(true)
                  } else if (vol === 0 && bgMusicEnabled) {
                    setBgMusicEnabled(false)
                  }
                  updateAudioSettings({ bgMusicVolume: vol, bgMusic: vol === 0 ? false : true })
                }}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: `linear-gradient(to right, #A855F7 0%, #A855F7 ${bgMusicVolume}%, rgba(71, 85, 105, 0.3) ${bgMusicVolume}%, rgba(71, 85, 105, 0.3) 100%)`,
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
              />
            </div>

            {/* Divider */}
            <div style={{ 
              height: '1px', 
              background: 'linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.15), transparent)', 
              margin: '20px 0' 
            }} />

            {/* Toggle Settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Thông báo Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>{notifEnabled ? '🔔' : '🔕'}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>{t('settings.notification')}</span>
                </div>
                <label className="toggle-switch-small" style={{ cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={notifEnabled}
                    onChange={(e) => {
                      const enabled = e.target.checked
                      setNotifEnabled(enabled)
                      localStorage.setItem('systemNotif', String(enabled))
                    }}
                  />
                  <span className="slider-small" style={{
                    background: notifEnabled ? 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)' : '#475569'
                  }}></span>
                </label>
              </div>

              {/* Ngôn ngữ */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>
                    {language === 'vi' ? '🇻🇳' : language === 'en' ? '🇬🇧' : language === 'zh' ? '🇨🇳' : '🇯🇵'}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>{t('settings.language')}</span>
                </div>
                <select 
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value as any)
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(71, 85, 105, 0.5)',
                    color: '#22C55E',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                  <option value="zh">中文</option>
                  <option value="ja">日本語</option>
                </select>
              </div>

              {/* Hiệu ứng */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>
                    {effectsQuality === 'high' ? '🌟' : effectsQuality === 'medium' ? '💫' : '⚡'}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>{t('settings.effects')}</span>
                </div>
                <select 
                  value={effectsQuality}
                  onChange={(e) => {
                    setEffectsQuality(e.target.value)
                    localStorage.setItem('effectsQuality', e.target.value)
                    document.body.setAttribute('data-effects-quality', e.target.value)
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(71, 85, 105, 0.5)',
                    color: effectsQuality === 'high' ? '#EC4899' : effectsQuality === 'medium' ? '#8B5CF6' : '#94A3B8',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="low">{t('settings.effectsLow')}</option>
                  <option value="medium">{t('settings.effectsMedium')}</option>
                  <option value="high">{t('settings.effectsHigh')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ 
            height: '1px', 
            background: 'linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.2), transparent)', 
            margin: '16px 0 16px' 
          }} />

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => {
                onClose()
                window.location.hash = '#profile'
              }}
              style={{
                flex: 1,
                padding: '12px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                borderRadius: '10px',
                color: '#94A3B8',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(30, 41, 59, 0.8)'
                e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.6)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)'
                e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.4)'
              }}
            >
              <span>⚙️</span>
              <span>{t('common.add')}</span>
            </button>
            <button 
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '10px',
                color: '#38BDF8',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(56, 189, 248, 0.15)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(59, 130, 246, 0.25) 100%)'
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(56, 189, 248, 0.25)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(56, 189, 248, 0.15)'
              }}
            >
              <span>✓</span>
              <span>{t('common.done')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<'home' | 'lobby' | 'room' | 'training' | 'variant' | 'shop' | 'profile' | 'inventory' | 'matchmaking' | 'createroom' | 'tournament' | 'inmatch' | 'quests' | 'guide' | 'events' | 'landing' | 'login' | 'signup' | 'forgot-password' | 'reset-password' | 'hotseat' | 'khainhan' | 'admin' | 'ai-analysis' | 'subscription' | 'currency-shop' | 'payment-result' | 'currency-result' | 'test-ai' | 'inbox' | 'admin-notifications' | 'admin-reports' | 'admin-appeals' | 'titles'>('home')
  const [user, setUser] = useState<any>(null)
  const [showSettingsPopup, setShowSettingsPopup] = useState(false)
  
  // Load equipped music from user inventory
  useEquippedMusic()
  
  // Load equipped avatar frame
  const { frame: equippedFrame } = useEquippedFrame(user?.id)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showMobileWallet, setShowMobileWallet] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [showUsernamePopup, setShowUsernamePopup] = useState(false)
  const [needsUsername, setNeedsUsername] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(true)
  const adminAudioBackup = React.useRef<ReturnType<typeof loadAudioSettingsFromStorage> | null>(null)

  useEffect(() => {
    // Initialize AudioManager
    const audioSettings = loadAudioSettingsFromStorage()
    AudioManager.initialize(audioSettings)
    
    // Start background music when user tương tác lần đầu (bắt buộc cho autoplay)
    const handleFirstInteract = () => {
      AudioManager.playBackgroundMusic()
      document.removeEventListener('pointerdown', handleFirstInteract)
    }
    document.addEventListener('pointerdown', handleFirstInteract, { once: true })

    // Global UI click sound
    const handleUiClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const clickable = target?.closest('button, [role="button"], a, .mode-btn, .cta-primary, .nav-item')
      if (clickable) {
        AudioManager.playSoundEffect('button')
      }
    }
    document.addEventListener('click', handleUiClick)
    
    // Initialize NotificationManager
    const notifSettings = loadNotificationSettingsFromStorage()
    NotificationManager.initialize(notifSettings)
    
    // Preload AI dataset khi browser rảnh (không block UI)
    // Điều này giúp dataset sẵn sàng khi user mở AI chat
    preloadDataset()
    
    // initialize from hash (strip query params for route matching)
    const rawHash = window.location.hash.replace('#', '')
    const hash = rawHash.split('?')[0]
    if (hash === 'home' || hash === 'lobby' || hash === 'room' || hash === 'training' || hash === 'variant' || hash === 'shop' || hash === 'profile' || hash === 'inventory' || hash === 'matchmaking' || hash === 'createroom' || hash === 'tournament' || hash === 'inmatch' || hash === 'quests' || hash === 'guide' || hash === 'events' || hash === 'landing' || hash === 'login' || hash === 'signup' || hash === 'forgot-password' || hash === 'reset-password' || hash === 'hotseat' || hash === 'khainhan' || hash === 'admin' || hash === 'ai-analysis' || hash === 'subscription' || hash === 'currency-shop' || hash === 'payment-result' || hash === 'currency-result' || hash === 'test-ai' || hash === 'inbox' || hash === 'admin-notifications' || hash === 'admin-reports' || hash === 'admin-appeals' || hash === 'titles') setPage(hash as any)

    const onHash = () => {
      const rawH = window.location.hash.replace('#', '')
      const h = rawH.split('?')[0]
      if (h === 'home' || h === 'lobby' || h === 'room' || h === 'training' || h === 'variant' || h === 'shop' || h === 'profile' || h === 'inventory' || h === 'matchmaking' || h === 'createroom' || h === 'tournament' || h === 'inmatch' || h === 'quests' || h === 'guide' || h === 'events' || h === 'landing' || h === 'login' || h === 'signup' || h === 'forgot-password' || h === 'reset-password' || h === 'hotseat' || h === 'khainhan' || h === 'admin' || h === 'ai-analysis' || h === 'subscription' || h === 'currency-shop' || h === 'payment-result' || h === 'currency-result' || h === 'test-ai' || h === 'inbox' || h === 'admin-notifications' || h === 'admin-reports' || h === 'admin-appeals' || h === 'titles') setPage(h as any)
    }

    window.addEventListener('hashchange', onHash)

    // Check for password recovery token in URL
    const urlParams = new URLSearchParams(window.location.search)
    const tokenType = urlParams.get('type')
    if (tokenType === 'recovery') {
      // Redirect to reset password page
      window.location.hash = '#reset-password'
      // Clean up URL params
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash)
    }

    // supabase session init + listener
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        setUser(data.session?.user ?? null)
      } catch (e) {
        setUser(null)
      }
    })()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      
      // Handle password recovery
      if (_event === 'PASSWORD_RECOVERY') {
        window.location.hash = '#reset-password'
      }
    })

    // Listen for profile updates from Profile page
    const handleProfileUpdate = async (event: any) => {
      const detail = event.detail || {}
      if (detail.field === 'currency' || detail.coins !== undefined || detail.gems !== undefined) {
        if (detail.coins !== undefined) setCoin(toNumber(detail.coins))
        if (detail.gems !== undefined) setGem(toNumber(detail.gems))
        
        // If only field='currency' without values, refetch from database
        if (detail.field === 'currency' && detail.coins === undefined && detail.gems === undefined) {
          try {
            const { data: session } = await supabase.auth.getSession()
            if (session?.session?.user?.id) {
              const { data } = await supabase
                .from('profiles')
                .select('coins,gems')
                .eq('user_id', session.session.user.id)
                .single()
              if (data) {
                setCoin(toNumber(data.coins))
                setGem(toNumber(data.gems))
              }
            }
          } catch (e) {
            console.error('Failed to refetch currency:', e)
          }
        }
      }
      if (detail.field === 'username' && detail.username) {
        setUsername(detail.username)
      } else if (detail.field === 'avatar' && detail.avatar_url) {
        setAvatarUrl(detail.avatar_url)
      }
    }
    window.addEventListener('profileUpdated', handleProfileUpdate)
    
    return () => {
      document.removeEventListener('pointerdown', handleFirstInteract)
      document.removeEventListener('click', handleUiClick)
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('profileUpdated', handleProfileUpdate)
      listener?.subscription.unsubscribe()
    }
  }, [])

  const [coin, setCoin] = useState<number>(1000)
  const [gem, setGem] = useState<number>(0)
  const [rankCode, setRankCode] = useState<string>('vo_danh')
  const [rankTier, setRankTier] = useState<string>('so_ky')
  const [rankLevel, setRankLevel] = useState<number>(1)
  const [mindpoint, setMindpoint] = useState<number>(0)
  const [rank, setRank] = useState<string>('Vô danh')
  const [username, setUsername] = useState<string>('')
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const [equippedTitle, setEquippedTitle] = useState<any>(null)

  // helper to normalize numeric values (fallback to 0)
  function toNumber(v: any) {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  // Fetch real coin/gem from `profiles` table if available; auto-logout if profile is missing
  useEffect(() => {
    if (!user) {
      setCoin(0)
      setGem(0)
      setRank('Vô danh')
      setUsername('')
      setAvatarUrl('')
      setNeedsUsername(false)
      setShowUsernamePopup(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        // try to read from profiles table (common pattern)
        const { data, error } = await supabase
          .from('profiles')
          .select('coins,gems,current_rank,mindpoint,display_name,username,user_id,avatar_url,onboarding_completed')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle()

        if (!cancelled && !error && data) {
          setCoin(toNumber((data as any).coins))
          setGem(toNumber((data as any).gems))
          const code = (data as any).current_rank || 'vo_danh'
          setRankCode(code)
          // Calculate tier and level from mindpoint instead of DB columns
          const mp = toNumber((data as any).mindpoint) || 0
          setMindpoint(mp)
          // Default tier/level - will be calculated by useRankV2 if needed
          setRankTier('so_ky')
          setRankLevel(1)
          setRank(formatRankLabel(code))
          setUsername((data as any).username || (data as any).display_name || '')
          setAvatarUrl((data as any).avatar_url || '')
          
          // Check if user needs to set username
          const hasUsername = !!(data as any).username && (data as any).username.trim() !== ''
          if (!hasUsername && !cancelled) {
            setNeedsUsername(true)
            setShowUsernamePopup(true)
          } else {
            setNeedsUsername(false)
            setShowUsernamePopup(false)
            
            // Check if user needs onboarding tour (only if has username)
            const hasCompletedOnboarding = !!(data as any).onboarding_completed
            setOnboardingCompleted(hasCompletedOnboarding)
            if (!hasCompletedOnboarding && !cancelled) {
              setShowOnboarding(true)
            }
          }
          return
        }
        
        // Profile not found - check if this is a new user or existing user who lost profile
        if (!cancelled && !data) {
          // Check if user account is new (created within last 10 minutes)
          const userCreatedAt = user.created_at ? new Date(user.created_at).getTime() : 0
          const now = Date.now()
          const tenMinutes = 10 * 60 * 1000
          const isNewUser = (now - userCreatedAt) < tenMinutes
          
          if (isNewUser) {
            // New user - allow them to create profile via UsernamePopup
            console.log('[App] New user without profile, showing username popup')
            setNeedsUsername(true)
            setShowUsernamePopup(true)
          } else {
            // Existing user who lost profile - auto logout
            console.warn('[App] Existing user lost profile data, auto-logout')
            await supabase.auth.signOut()
            window.location.hash = '#login'
          }
          return
        }
      } catch (e) {
        // On error fetching profile, don't auto-logout immediately
        // Could be network issue - just log and let user retry
        console.warn('[App] Error fetching profile:', e)
      }
    })()

    return () => { cancelled = true }
  }, [user])

  // Load equipped title
  useEffect(() => {
    if (user?.id) {
      getEquippedTitle(user.id).then(setEquippedTitle)
    } else {
      setEquippedTitle(null)
    }
  }, [user?.id])

  // Khi vao trang Admin: tat nhac nen + tat SFX, ra khoi admin thi khoi phuc
  useEffect(() => {
    if (page === 'admin') {
      adminAudioBackup.current = AudioManager.getSettings()
      AudioManager.updateSettings({
        bgMusic: false,
        sfxEnabled: false,
        moveSoundEnabled: false
      })
      AudioManager.pauseBackgroundMusic()
    } else if (adminAudioBackup.current) {
      AudioManager.updateSettings(adminAudioBackup.current)
      adminAudioBackup.current = null
    }
  }, [page])

  // Realtime subscription: update coin/gem/rank when profiles row for this user changes
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`profiles:listen:${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` }, (payload) => {
        try {
          const newRow = payload.new as any
          if (newRow) {
            setCoin(toNumber(newRow.coins ?? newRow.coin))
            setGem(toNumber(newRow.gems ?? newRow.gem))
            if (newRow.current_rank != null || newRow.rank != null) {
              setRank(formatRankLabel(newRow.current_rank ?? newRow.rank))
            }
            if (newRow.username != null || newRow.display_name != null) {
              setUsername(newRow.username || newRow.display_name || '')
            }
            if (newRow.avatar_url != null) {
              setAvatarUrl(newRow.avatar_url || '')
            }
          }
        } catch (e) {
          // ignore
        }
      })

    // subscribe (can return a promise)
    void channel.subscribe()

    return () => {
      try { void channel.unsubscribe() } catch (e) {}
    }
  }, [user])

  // Check admin permission from public.admin table (with timeout to prevent blocking)
  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    let cancelled = false
    
    const checkAdmin = async () => {
      try {
        // Add timeout to prevent blocking when Supabase is down
        const result = await Promise.race([
          supabase
            .from('admin')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle()
            .then(r => r),
          new Promise<{ data: null; error: Error }>((resolve) => 
            setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 5000)
          )
        ])
        
        if (!cancelled) setIsAdmin(!!result.data && !result.error)
      } catch (e: any) {
        // Silently fail - user is not admin if check fails
        console.warn('[App] Admin check failed (Supabase may be unavailable):', e?.message?.slice(0, 50))
        if (!cancelled) setIsAdmin(false)
      }
    }
    
    checkAdmin()
    return () => { cancelled = true }
  }, [user])

  // Heartbeat: update profiles.last_active periodically to support Admin online metric
  // With backoff when Supabase is unavailable
  useEffect(() => {
    if (!user) return

    let cancelled = false
    let consecutiveFailures = 0
    const maxBackoff = 300000 // 5 minutes max
    
    const updateLastSeen = async () => {
      try {
        // Add timeout using Promise.race
        await Promise.race([
          supabase
            .from('profiles')
            .update({ last_active: new Date().toISOString() })
            .eq('user_id', user.id)
            .then(r => r),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ])
        
        consecutiveFailures = 0 // Reset on success
      } catch (e) {
        consecutiveFailures++
        // Don't log every failure to avoid console spam
        if (consecutiveFailures === 1 || consecutiveFailures % 10 === 0) {
          console.warn('[App] Heartbeat failed, consecutive failures:', consecutiveFailures)
        }
      }
    }

    // initial ping (delayed to not block startup)
    const initialTimeout = setTimeout(() => { if (!cancelled) void updateLastSeen() }, 2000)
    
    // interval with exponential backoff on failures
    let intervalId: number | null = null
    const scheduleNext = () => {
      if (cancelled) return
      const baseInterval = 30000 // 30s
      const backoff = Math.min(baseInterval * Math.pow(1.5, consecutiveFailures), maxBackoff)
      intervalId = window.setTimeout(() => {
        if (!cancelled) {
          void updateLastSeen()
          scheduleNext()
        }
      }, backoff)
    }
    scheduleNext()

    // update when tab becomes visible again (but not too frequently)
    let lastVisUpdate = 0
    const onVis = () => { 
      if (!cancelled && document.visibilityState === 'visible' && Date.now() - lastVisUpdate > 10000) {
        lastVisUpdate = Date.now()
        void updateLastSeen() 
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      clearTimeout(initialTimeout)
      if (intervalId) clearTimeout(intervalId)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [user])

  // Global realtime presence: join a global presence channel for accurate online counts
  useEffect(() => {
    if (!user) return

    const channel = supabase.channel('presence:global', {
      config: { presence: { key: user.id } }
    })

    channel.on('presence', { event: 'sync' }, () => {
      // no-op; admin dashboard will read presence state on its own
    })

    void channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.track({
          user_id: user.id,
          username: user.user_metadata?.username || user.email || 'user',
          is_admin: isAdmin,
          online_at: new Date().toISOString()
        })
      }
    })

    return () => { 
      try { void channel.unsubscribe() } catch (e) {} 
    }
  }, [user, isAdmin])

  const { t, language } = useLanguage()

  // Update rank label when language changes
  useEffect(() => {
    setRank(formatRankLabel(rankCode))
  }, [language, rankCode])

  function formatRankLabel(code?: string | null) {
    if (!code) return t('rank.vo_danh')
    
    const rankLabelMap: Record<string, string> = {
      vo_danh: t('rank.vo_danh'),
      tan_ky: t('rank.tan_ky'),
      hoc_ky: t('rank.hoc_ky'),
      ky_lao: t('rank.ky_lao'),
      cao_ky: t('rank.cao_ky'),
      ky_thanh: t('rank.ky_thanh'),
      truyen_thuyet: t('rank.truyen_thuyet')
    }
    
    return rankLabelMap[code as keyof typeof rankLabelMap] ?? code
  }

  function fmt(n: number) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
    return String(n)
  }

  return (
    // fallback: if state hasn't updated for some reason, prefer the hash
    // compute a displayPage that respects the current URL hash as a last-resort
    (() => {
      const currentHash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : ''
      let displayPage = (currentHash === 'shop' || currentHash === 'room' || currentHash === 'training' || currentHash === 'variant' || currentHash === 'lobby' || currentHash === 'home' || currentHash === 'profile' || currentHash === 'inventory' || currentHash === 'matchmaking' || currentHash === 'createroom' || currentHash === 'tournament' || currentHash === 'inmatch' || currentHash === 'quests' || currentHash === 'guide' || currentHash === 'landing' || currentHash === 'login' || currentHash === 'signup' || currentHash === 'forgot-password' || currentHash === 'reset-password' || currentHash === 'hotseat' || currentHash === 'khainhan' || currentHash === 'admin' || currentHash === 'ai-analysis' || currentHash === 'subscription' || currentHash === 'currency-shop' || currentHash === 'inbox' || currentHash === 'admin-notifications' || currentHash === 'admin-reports' || currentHash === 'admin-appeals') ? (currentHash as any) : page

      // If user is not authenticated, always show landing/login/signup/forgot-password/reset-password
      if (!user) {
        if (displayPage !== 'login' && displayPage !== 'signup' && displayPage !== 'landing' && displayPage !== 'forgot-password' && displayPage !== 'reset-password') {
          // prefer hash navigation if explicitly login/signup, otherwise force landing
          displayPage = 'landing'
        }
      }

      // If user is admin, keep them on admin-only views but allow admin subpages
      if (user && isAdmin) {
        const adminPages = ['admin', 'admin-notifications', 'admin-reports', 'admin-appeals']
        if (!adminPages.includes(displayPage)) {
          displayPage = 'admin'
        }
      }

      return (
        <div className="app-container">
      {/* Username Popup - shown globally when user needs to set username */}
      {user && showUsernamePopup && needsUsername && !isAdmin && (
        <UsernamePopup
          userId={user.id}
          currentUsername=""
          onComplete={(newUsername) => {
            console.log('[App] Username set complete:', newUsername)
            
            // Update local state - close popup first
            setUsername(newUsername)
            setShowUsernamePopup(false)
            setNeedsUsername(false)
            
            // Use setTimeout to ensure state updates are flushed before showing onboarding
            setTimeout(() => {
              console.log('[App] Checking onboarding status:', { onboardingCompleted })
              if (!onboardingCompleted) {
                console.log('[App] Showing onboarding tour')
                setShowOnboarding(true)
              }
            }, 100)
          }}
          // No onSkip - user MUST set username
        />
      )}

      {/* Onboarding Tour - shown after username is set */}
      {user && showOnboarding && !needsUsername && !isAdmin && (
        <OnboardingTour
          isOpen={showOnboarding}
          userId={user.id}
          onComplete={async () => {
            setShowOnboarding(false)
            setOnboardingCompleted(true)
            // Save to database
            try {
              await supabase
                .from('profiles')
                .update({ onboarding_completed: true })
                .eq('user_id', user.id)
            } catch (e) {
              console.error('Failed to save onboarding status:', e)
            }
          }}
          onSkip={async () => {
            setShowOnboarding(false)
            setOnboardingCompleted(true)
            // Save to database even if skipped
            try {
              await supabase
                .from('profiles')
                .update({ onboarding_completed: true })
                .eq('user_id', user.id)
            } catch (e) {
              console.error('Failed to save onboarding status:', e)
            }
          }}
        />
      )}
      
      {user && (displayPage === 'home' || displayPage === 'shop' || displayPage === 'profile' || displayPage === 'inventory' || displayPage === 'matchmaking' || displayPage === 'createroom' || displayPage === 'tournament' || displayPage === 'quests' || displayPage === 'guide' || displayPage === 'events' || displayPage === 'hotseat' || displayPage === 'khainhan' || displayPage === 'subscription' || displayPage === 'currency-shop' || displayPage === 'inbox' || displayPage === 'admin-notifications' || displayPage === 'admin-reports' || displayPage === 'admin-appeals' || displayPage === 'titles') ? (
        <>
        {displayPage === 'home' && (
          <button className="mobile-menu-toggle" onClick={() => setShowMobileMenu(!showMobileMenu)}>
            <span className="hamburger-icon">›</span>
          </button>
        )}
        
        <header className="app-header">
          <div className="user-snippet" role="button" onClick={() => { window.location.hash = '#profile' }}>
            <div style={{ width: 64, height: 64, flexShrink: 0 }}>
              <AvatarWithFrame
                avatarUrl={avatarUrl}
                frame={equippedFrame}
                size={64}
                username={username}
                showGlow={false}
                className="header-avatar"
              />
            </div>
            <div className="user-text">
              <div className="user-name">
                {username || user?.user_metadata?.name || 'Chưa đặt tên'}
              </div>
              <div className="user-rank">Rank: {rank}</div>
            </div>
          </div>

          <div className="header-center" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="logo-title">MindPoint Arena</div>
          </div>

          <nav className="header-right">
            {/* Desktop wallet and gear */}
            <div className="wallet desktop-wallet" title={`Nguyên Thần: ${gem} — Tinh Thạch: ${coin}`} style={{ cursor: 'pointer' }} onClick={() => { window.location.hash = '#currency-shop'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <img 
                  src="/gem.png" 
                  alt="Nguyên Thần" 
                  style={{ width: 24, height: 24, objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(56, 189, 248, 0.45))' }} 
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <strong style={{ color: '#38BDF8', fontSize: 14, fontWeight: 700 }}>{fmt(gem)}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <img 
                  src="/coin.png" 
                  alt="Tinh Thạch" 
                  style={{ width: 24, height: 24, objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(251, 191, 36, 0.4))' }} 
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <strong style={{ color: '#FACC15', fontSize: 14, fontWeight: 700 }}>{fmt(coin)}</strong>
              </div>
              <span style={{ color: '#94A3B8', fontSize: 14, fontWeight: 700, marginLeft: 4 }}>+</span>
            </div>
            <InboxIcon className="desktop-inbox" />
            <div 
              className="gear desktop-gear" 
              onClick={() => setShowSettingsPopup(true)} 
              style={{ 
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.2))',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.35), rgba(37, 99, 235, 0.35))'
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.2))'
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.15)'
              }}
            >⚙</div>

            {/* Mobile toggle button */}
            <button className="mobile-wallet-toggle" onClick={() => setShowMobileWallet(!showMobileWallet)}>
              <span className="toggle-icon" style={{ transform: showMobileWallet ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                {showMobileWallet ? '▲' : '▼'}
              </span>
            </button>
            
            {/* Mobile dropdown content */}
            <div className={`mobile-wallet-content ${showMobileWallet ? 'content-visible' : 'content-hidden'}`}>
              <div className="wallet" title={`Nguyên Thần: ${gem} — Tinh Thạch: ${coin}`} style={{ cursor: 'pointer' }} onClick={() => { window.location.hash = '#currency-shop'; setShowMobileWallet(false); }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <img 
                    src="/gem.png" 
                    alt="Nguyên Thần" 
                    style={{ width: 24, height: 24, objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(56, 189, 248, 0.45))' }} 
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <strong style={{ color: '#38BDF8', fontSize: 14, fontWeight: 700 }}>{fmt(gem)}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <img 
                    src="/coin.png" 
                    alt="Tinh Thạch" 
                    style={{ width: 24, height: 24, objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(251, 191, 36, 0.4))' }} 
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <strong style={{ color: '#FACC15', fontSize: 14, fontWeight: 700 }}>{fmt(coin)}</strong>
                </div>
                <span style={{ color: '#94A3B8', fontSize: 14, fontWeight: 700, marginLeft: 4 }}>+</span>
              </div>
              <InboxIcon className="mobile-inbox" />
              <button 
                className="gear mobile-gear" 
                onClick={() => { setShowSettingsPopup(true); setShowMobileWallet(false); }}
                style={{
                  padding: '8px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.2))',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#93C5FD',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)'
                }}
              >
                ⚙
              </button>
            </div>
          </nav>
        </header>

        {/* Settings Popup */}
        {showSettingsPopup && <SettingsPopup onClose={() => setShowSettingsPopup(false)} />}
        </>
      ) : !user ? (
        <header className="app-header">
          <div className="header-center">
            <div className="logo-title">MindPoint Arena</div>
          </div>
          <nav className="header-right">
            <div className="auth-actions">
              <button className="auth-header-btn" onClick={() => { window.location.hash = '#login' }}>{t('auth.landing.login')}</button>
              <button className="auth-header-btn" onClick={() => { window.location.hash = '#signup' }}>{t('auth.landing.signup')}</button>
            </div>
          </nav>
        </header>
      ) : null}

      <main>
        {displayPage === 'landing' && <AuthLanding />}
        {displayPage === 'login' && <Login />}
        {displayPage === 'signup' && <Register />}
        {displayPage === 'forgot-password' && <ForgotPassword />}
        {displayPage === 'reset-password' && <ResetPassword />}
        {displayPage === 'home' && <Home mobileMenuOpen={showMobileMenu} onCloseMobileMenu={() => setShowMobileMenu(false)} user={user} rank={rank} avatarUrl={avatarUrl} equippedFrame={equippedFrame} />}
        {displayPage === 'lobby' && <Lobby />}
        {displayPage === 'room' && <Room />}
        {displayPage === 'training' && <TrainingRoom />}
        {displayPage === 'variant' && <VariantMatch />}
        {displayPage === 'shop' && <Shop />}
        {displayPage === 'profile' && <Profile />}
        {displayPage === 'inventory' && <Inventory />}
        {displayPage === 'matchmaking' && <Matchmaking />}
        {displayPage === 'createroom' && <CreateRoom />}
        {displayPage === 'tournament' && <Tournament />}
        {displayPage === 'inmatch' && <InMatch />}
        {displayPage === 'quests' && <Quests />}
        {displayPage === 'guide' && <Guide />}
        {displayPage === 'events' && <Events />}
        {displayPage === 'hotseat' && <Hotseat />}
        {displayPage === 'admin' && (isAdmin ? <Admin /> : (
          <div style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Not authorized</div>
            <button onClick={() => { window.location.hash = '#home' }}>Back</button>
          </div>
        ))}
        {displayPage === 'khainhan' && <KhaiNhan />}
        {displayPage === 'ai-analysis' && <AiAnalysis />}
        {displayPage === 'subscription' && <Subscription userId={user?.id} />}
        {displayPage === 'currency-shop' && <CurrencyShop userId={user?.id} />}
        {displayPage === 'payment-result' && <PaymentResult />}
        {displayPage === 'currency-result' && <CurrencyResult />}
        {displayPage === 'test-ai' && <TestAI />}
        {displayPage === 'inbox' && <Inbox />}
        {displayPage === 'admin-notifications' && (isAdmin ? <AdminNotifications /> : (
          <div style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Not authorized</div>
            <button onClick={() => { window.location.hash = '#home' }}>Back</button>
          </div>
        ))}
        {displayPage === 'admin-reports' && (isAdmin ? <AdminReports /> : (
          <div style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Not authorized</div>
            <button onClick={() => { window.location.hash = '#home' }}>Back</button>
          </div>
        ))}
        {displayPage === 'admin-appeals' && (isAdmin ? <AdminAppeals /> : (
          <div style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Not authorized</div>
            <button onClick={() => { window.location.hash = '#home' }}>Back</button>
          </div>
        ))}
        {displayPage === 'titles' && <Titles />}
      </main>
      </div>
      )
    })()
  )
}
