import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useLanguage } from './contexts/LanguageContext'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import Room from './pages/Room'
import TrainingRoom from './pages/TrainingRoom'
import Shop from './pages/Shop'
import Profile from './pages/Profile'
import Inventory from './pages/Inventory'
import Matchmaking from './pages/Matchmaking'
import CreateRoom from './pages/CreateRoom'
import InMatch from './pages/InMatch'
import Quests from './pages/Quests'
import Guide from './pages/Guide'
import Events from './pages/Events'
import AuthLanding from './pages/AuthLanding'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Hotseat from './pages/Hotseat'
import KhaiNhan from './pages/KhaiNhan'
import { AudioManager, loadAudioSettingsFromStorage } from './lib/AudioManager'
import { NotificationManager, loadNotificationSettingsFromStorage } from './lib/NotificationManager'

function SettingsPopup({ onClose }: { onClose: () => void }) {
  const { language, setLanguage, t } = useLanguage()
  const [sfxEnabled, setSfxEnabled] = React.useState(() => localStorage.getItem('sfxEnabled') !== 'false')
  const [sfxVolume, setSfxVolume] = React.useState(() => Number(localStorage.getItem('sfxVolume') || 80))
  const [bgMusicEnabled, setBgMusicEnabled] = React.useState(() => localStorage.getItem('bgMusic') !== 'false')
  const [bgMusicVolume, setBgMusicVolume] = React.useState(() => Number(localStorage.getItem('bgMusicVolume') || 70))
  const [notifEnabled, setNotifEnabled] = React.useState(() => localStorage.getItem('systemNotif') !== 'false')
  const [effectsQuality, setEffectsQuality] = React.useState(() => localStorage.getItem('effectsQuality') || 'high')

  const handleSfxToggle = (enabled: boolean) => {
    setSfxEnabled(enabled)
    localStorage.setItem('sfxEnabled', String(enabled))
    // Play feedback sound when enabling
    if (enabled) playClickSound()
  }

  const handleSfxVolumeChange = (volume: number) => {
    setSfxVolume(volume)
    localStorage.setItem('sfxVolume', String(volume))
    // Debounced sound preview
    playVolumePreview()
  }

  const handleBgMusicToggle = (enabled: boolean) => {
    setBgMusicEnabled(enabled)
    localStorage.setItem('bgMusic', String(enabled))
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
                onChange={(e) => {
                  const vol = Number(e.target.value)
                  setSfxVolume(vol)
                  localStorage.setItem('sfxVolume', String(vol))
                  if (vol > 0 && !sfxEnabled) {
                    setSfxEnabled(true)
                    localStorage.setItem('sfxEnabled', 'true')
                  } else if (vol === 0 && sfxEnabled) {
                    setSfxEnabled(false)
                    localStorage.setItem('sfxEnabled', 'false')
                  }
                }}
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
                  localStorage.setItem('bgMusicVolume', String(vol))
                  if (vol > 0 && !bgMusicEnabled) {
                    setBgMusicEnabled(true)
                    localStorage.setItem('bgMusic', 'true')
                  } else if (vol === 0 && bgMusicEnabled) {
                    setBgMusicEnabled(false)
                    localStorage.setItem('bgMusic', 'false')
                  }
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
              <span>✓</span>
              <span>Xong</span>
            </button>
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
              <span>⚙️</span>
              <span>Thêm</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<'home' | 'lobby' | 'room' | 'training' | 'shop' | 'profile' | 'inventory' | 'matchmaking' | 'createroom' | 'inmatch' | 'quests' | 'guide' | 'events' | 'landing' | 'login' | 'signup' | 'forgot-password' | 'reset-password' | 'hotseat' | 'khainhan'>('home')
  const [user, setUser] = useState<any>(null)
  const [showSettingsPopup, setShowSettingsPopup] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showMobileWallet, setShowMobileWallet] = useState(true)

  useEffect(() => {
    // Initialize AudioManager
    const audioSettings = loadAudioSettingsFromStorage()
    AudioManager.initialize(audioSettings)
    
    // Start background music if enabled
    if (audioSettings.bgMusic) {
      // Delay to allow user interaction first (required by browsers)
      const playMusic = () => {
        AudioManager.playBackgroundMusic()
        document.removeEventListener('click', playMusic)
      }
      document.addEventListener('click', playMusic, { once: true })
    }
    
    // Initialize NotificationManager
    const notifSettings = loadNotificationSettingsFromStorage()
    NotificationManager.initialize(notifSettings)
    
    // initialize from hash
    const hash = window.location.hash.replace('#', '')
    if (hash === 'home' || hash === 'lobby' || hash === 'room' || hash === 'training' || hash === 'shop' || hash === 'profile' || hash === 'inventory' || hash === 'matchmaking' || hash === 'createroom' || hash === 'inmatch' || hash === 'quests' || hash === 'guide' || hash === 'events' || hash === 'landing' || hash === 'login' || hash === 'signup' || hash === 'forgot-password' || hash === 'reset-password' || hash === 'hotseat' || hash === 'khainhan') setPage(hash as any)

    const onHash = () => {
      const h = window.location.hash.replace('#', '')
      if (h === 'home' || h === 'lobby' || h === 'room' || h === 'training' || h === 'shop' || h === 'profile' || h === 'inventory' || h === 'matchmaking' || h === 'createroom' || h === 'inmatch' || h === 'quests' || h === 'guide' || h === 'events' || h === 'landing' || h === 'login' || h === 'signup' || h === 'forgot-password' || h === 'reset-password' || h === 'hotseat' || h === 'khainhan') setPage(h as any)
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
    const handleProfileUpdate = (event: any) => {
      const detail = event.detail
      if (detail.field === 'username' && detail.username) {
        setUsername(detail.username)
      } else if (detail.field === 'avatar' && detail.avatar_url) {
        setAvatarUrl(detail.avatar_url)
      }
    }
    window.addEventListener('profileUpdated', handleProfileUpdate)
    
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('profileUpdated', handleProfileUpdate)
      listener?.subscription.unsubscribe()
    }
  }, [])

  const [coin, setCoin] = useState<number>(1000)
  const [gem, setGem] = useState<number>(0)
  const [rankCode, setRankCode] = useState<string>('vo_danh')
  const [rank, setRank] = useState<string>('Vô danh')
  const [username, setUsername] = useState<string>('')
  const [avatarUrl, setAvatarUrl] = useState<string>('')

  // helper to normalize numeric values (fallback to 0)
  function toNumber(v: any) {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  // Fetch real coin/gem from `profiles` table if available; otherwise fallback to user_metadata; default to 0
  useEffect(() => {
    if (!user) {
      setCoin(0)
      setGem(0)
      setRank('Vô danh')
      setUsername('')
      setAvatarUrl('')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        // try to read from profiles table (common pattern)
        const { data, error } = await supabase
          .from('profiles')
          .select('coins,gems,current_rank,display_name,username,user_id,avatar_url')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!cancelled && !error && data) {
          setCoin(toNumber((data as any).coins))
          setGem(toNumber((data as any).gems))
          const code = (data as any).current_rank || 'vo_danh'
          setRankCode(code)
          setRank(formatRankLabel(code))
          setUsername((data as any).username || (data as any).display_name || '')
          setAvatarUrl((data as any).avatar_url || '')
          return
        }
      } catch (e) {
        // ignore and fallback
      }

      // fallback to user_metadata if profiles table not present or query failed
      try {
        const meta = user.user_metadata ?? {}
        setCoin(toNumber(meta?.coins ?? meta?.coin))
        setGem(toNumber(meta?.gems ?? meta?.gem))
        const code = meta?.current_rank ?? meta?.rank ?? 'vo_danh'
        setRankCode(code)
        setRank(formatRankLabel(code))
      } catch (e) {
        setCoin(0)
        setGem(0)
        setRankCode('vo_danh')
        setRank(formatRankLabel('vo_danh'))
      }
    })()

    return () => { cancelled = true }
  }, [user])

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
      let displayPage = (currentHash === 'shop' || currentHash === 'room' || currentHash === 'training' || currentHash === 'lobby' || currentHash === 'home' || currentHash === 'profile' || currentHash === 'inventory' || currentHash === 'matchmaking' || currentHash === 'createroom' || currentHash === 'inmatch' || currentHash === 'quests' || currentHash === 'guide' || currentHash === 'landing' || currentHash === 'login' || currentHash === 'signup' || currentHash === 'forgot-password' || currentHash === 'reset-password' || currentHash === 'hotseat' || currentHash === 'khainhan') ? (currentHash as any) : page

      // If user is not authenticated, always show landing/login/signup/forgot-password/reset-password
      if (!user) {
        if (displayPage !== 'login' && displayPage !== 'signup' && displayPage !== 'landing' && displayPage !== 'forgot-password' && displayPage !== 'reset-password') {
          // prefer hash navigation if explicitly login/signup, otherwise force landing
          displayPage = 'landing'
        }
      }

      return (
        <div className="app-container">
      {user && (displayPage === 'home' || displayPage === 'shop' || displayPage === 'profile' || displayPage === 'inventory' || displayPage === 'matchmaking' || displayPage === 'createroom' || displayPage === 'quests' || displayPage === 'guide' || displayPage === 'events' || displayPage === 'hotseat' || displayPage === 'khainhan') ? (
        <>
        {displayPage === 'home' && (
          <button className="mobile-menu-toggle" onClick={() => setShowMobileMenu(!showMobileMenu)}>
            <span className="hamburger-icon">›</span>
          </button>
        )}
        
        <header className="app-header">
          <div className="user-snippet" role="button" onClick={() => { window.location.hash = '#profile' }}>
            <div className="avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={username} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👤</div>
              )}
            </div>
            <div className="user-text">
              <div className="user-name">{username || user?.user_metadata?.name || 'Chưa đặt tên'}</div>
              <div className="user-rank">{t('rank.label')}: {rank}</div>
            </div>
          </div>

          <div className="header-center" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="logo-title">MindPoint Arena</div>
          </div>

          <nav className="header-right">
            {/* Desktop wallet and gear */}
            <div className="wallet desktop-wallet" title={`Nguyên Thần: ${gem} — Tinh Thạch: ${coin}`}>
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
            </div>
            <div className="gear desktop-gear" onClick={() => setShowSettingsPopup(true)} style={{ cursor: 'pointer' }}>⚙</div>

            {/* Mobile toggle button */}
            <button className="mobile-wallet-toggle" onClick={() => setShowMobileWallet(!showMobileWallet)}>
              <span className="toggle-icon" style={{ transform: showMobileWallet ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                {showMobileWallet ? '▲' : '▼'}
              </span>
            </button>
            
            {/* Mobile dropdown content */}
            <div className={`mobile-wallet-content ${showMobileWallet ? 'content-visible' : 'content-hidden'}`}>
              <div className="wallet" title={`Nguyên Thần: ${gem} — Tinh Thạch: ${coin}`}>
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
              </div>
              <button className="gear mobile-gear" onClick={() => { setShowSettingsPopup(true); setShowMobileWallet(false); }}>
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
              <button className="auth-header-btn" onClick={() => { window.location.hash = '#login' }}>Đăng nhập</button>
              <button className="auth-header-btn" onClick={() => { window.location.hash = '#signup' }}>Đăng ký</button>
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
        {displayPage === 'home' && <Home mobileMenuOpen={showMobileMenu} onCloseMobileMenu={() => setShowMobileMenu(false)} user={user} rank={rank} />}
        {displayPage === 'lobby' && <Lobby />}
        {displayPage === 'room' && <Room />}
        {displayPage === 'training' && <TrainingRoom />}
        {displayPage === 'shop' && <Shop />}
        {displayPage === 'profile' && <Profile />}
        {displayPage === 'inventory' && <Inventory />}
        {displayPage === 'matchmaking' && <Matchmaking />}
        {displayPage === 'createroom' && <CreateRoom />}
        {displayPage === 'inmatch' && <InMatch />}
        {displayPage === 'quests' && <Quests />}
        {displayPage === 'guide' && <Guide />}
        {displayPage === 'events' && <Events />}
        {displayPage === 'hotseat' && <Hotseat />}
        {displayPage === 'khainhan' && <KhaiNhan />}
      </main>
      </div>
      )
    })()
  )
}
