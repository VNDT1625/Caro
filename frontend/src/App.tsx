import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
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
import Hotseat from './pages/Hotseat'
import KhaiNhan from './pages/KhaiNhan'

export default function App() {
  const [page, setPage] = useState<'home' | 'lobby' | 'room' | 'training' | 'shop' | 'profile' | 'inventory' | 'matchmaking' | 'createroom' | 'inmatch' | 'quests' | 'guide' | 'events' | 'landing' | 'login' | 'signup' | 'hotseat' | 'khainhan'>('home')
  const [user, setUser] = useState<any>(null)
  const [showSettingsPopup, setShowSettingsPopup] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showMobileWallet, setShowMobileWallet] = useState(true)

  useEffect(() => {
    // initialize from hash
    const hash = window.location.hash.replace('#', '')
    if (hash === 'home' || hash === 'lobby' || hash === 'room' || hash === 'training' || hash === 'shop' || hash === 'profile' || hash === 'inventory' || hash === 'matchmaking' || hash === 'createroom' || hash === 'inmatch' || hash === 'quests' || hash === 'guide' || hash === 'events' || hash === 'landing' || hash === 'login' || hash === 'signup' || hash === 'hotseat' || hash === 'khainhan') setPage(hash as any)

    const onHash = () => {
      const h = window.location.hash.replace('#', '')
      if (h === 'home' || h === 'lobby' || h === 'room' || h === 'training' || h === 'shop' || h === 'profile' || h === 'inventory' || h === 'matchmaking' || h === 'createroom' || h === 'inmatch' || h === 'quests' || h === 'guide' || h === 'events' || h === 'landing' || h === 'login' || h === 'signup' || h === 'hotseat' || h === 'khainhan') setPage(h as any)
    }

    window.addEventListener('hashchange', onHash)

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
    })

    return () => {
      window.removeEventListener('hashchange', onHash)
      listener?.subscription.unsubscribe()
    }
  }, [])

  const [coin, setCoin] = useState<number>(1000)
  const [gem, setGem] = useState<number>(0)
  const [rank, setRank] = useState<string>('Vô danh')

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
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        // try to read from profiles table (common pattern)
        const { data, error } = await supabase
          .from('profiles')
          .select('coins,gems,current_rank,display_name,username,user_id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!cancelled && !error && data) {
          setCoin(toNumber((data as any).coins))
          setGem(toNumber((data as any).gems))
          setRank(formatRankLabel((data as any).current_rank) ?? (user?.user_metadata?.rank ?? 'Vô danh'))
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
        setRank(formatRankLabel(meta?.current_rank ?? meta?.rank))
      } catch (e) {
        setCoin(0)
        setGem(0)
        setRank('Vô danh')
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

  const rankLabelMap: Record<string, string> = {
    vo_danh: 'Vô Danh',
    tan_ky: 'Tân Kỳ',
    hoc_ky: 'Học Kỳ',
    ky_lao: 'Kỳ Lão',
    cao_ky: 'Cao Kỳ',
    ky_thanh: 'Kỳ Thánh',
    truyen_thuyet: 'Truyền Thuyết'
  }

  function formatRankLabel(code?: string | null) {
    if (!code) return 'Vô danh'
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
      let displayPage = (currentHash === 'shop' || currentHash === 'room' || currentHash === 'training' || currentHash === 'lobby' || currentHash === 'home' || currentHash === 'profile' || currentHash === 'inventory' || currentHash === 'matchmaking' || currentHash === 'createroom' || currentHash === 'inmatch' || currentHash === 'quests' || currentHash === 'guide' || currentHash === 'landing' || currentHash === 'login' || currentHash === 'signup' || currentHash === 'hotseat' || currentHash === 'khainhan') ? (currentHash as any) : page

      // If user is not authenticated, always show landing/login/signup
      if (!user) {
        if (displayPage !== 'login' && displayPage !== 'signup' && displayPage !== 'landing') {
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
            <div className="avatar" />
            <div className="user-text">
              <div className="user-name">{user?.user_metadata?.name ?? user?.email ?? 'username'}</div>
              <div className="user-rank">Cảnh Giới: {rank}</div>
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
        {showSettingsPopup && (
          <div className="settings-popup-overlay" onClick={() => setShowSettingsPopup(false)}>
            <div className="settings-popup" onClick={(e) => e.stopPropagation()}>
              <div className="settings-header">
                <h3>Cài đặt</h3>
                <button className="close-btn" onClick={() => setShowSettingsPopup(false)}>✕</button>
              </div>
              <div className="settings-content">
                <div className="setting-item">
                  <span className="setting-label">🔊 Âm thanh</span>
                  <label className="toggle-switch-small">
                    <input type="checkbox" defaultChecked />
                    <span className="slider-small"></span>
                  </label>
                </div>
                <div className="setting-item">
                  <span className="setting-label">🎵 Nhạc nền</span>
                  <label className="toggle-switch-small">
                    <input type="checkbox" defaultChecked />
                    <span className="slider-small"></span>
                  </label>
                </div>
                <div className="setting-item">
                  <span className="setting-label">🔔 Thông báo</span>
                  <label className="toggle-switch-small">
                    <input type="checkbox" defaultChecked />
                    <span className="slider-small"></span>
                  </label>
                </div>
                <div className="setting-item">
                  <span className="setting-label">🌐 Ngôn ngữ</span>
                  <select className="setting-select">
                    <option>Tiếng Việt</option>
                    <option>English</option>
                  </select>
                </div>
                
              </div>
            </div>
          </div>
        )}
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
