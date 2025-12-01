import React from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { AudioManager } from '../lib/AudioManager'
import { NotificationManager } from '../lib/NotificationManager'

export default function Profile() {
  const { language, setLanguage, t } = useLanguage()
  const [user, setUser] = React.useState<any>(null)
  const [profile, setProfile] = React.useState<any>(null)
  const [showUsernamePopup, setShowUsernamePopup] = React.useState(false)
  const [newUsername, setNewUsername] = React.useState('')
  const [usernameError, setUsernameError] = React.useState('')
  const [activeSection, setActiveSection] = React.useState<'overview' | 'settings' | 'history'>('overview')
  const [activeSettingsTab, setActiveSettingsTab] = React.useState<'account' | 'ui' | 'sound' | 'board' | 'notifications' | 'language' | 'other'>('account')
  const [matchHistory, setMatchHistory] = React.useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = React.useState(false)
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)
  
  // Password change states
  const [showPasswordChange, setShowPasswordChange] = React.useState(false)
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [passwordError, setPasswordError] = React.useState('')
  const [passwordSuccess, setPasswordSuccess] = React.useState('')
  const [changingPassword, setChangingPassword] = React.useState(false)
  
  // Email change states
  const [showEmailChange, setShowEmailChange] = React.useState(false)
  const [newEmail, setNewEmail] = React.useState('')
  const [emailError, setEmailError] = React.useState('')
  const [emailSuccess, setEmailSuccess] = React.useState('')
  const [changingEmail, setChangingEmail] = React.useState(false)
  
  // Notification permission state
  const [notificationPermission, setNotificationPermission] = React.useState<NotificationPermission>('default')

  // Load user data from Supabase
  React.useEffect(() => {
    loadUserData()
    
    // Check current notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    }
  }, [])

  // Load match history when history section is active
  React.useEffect(() => {
    if (activeSection === 'history' && user) {
      loadMatchHistory()
    }
  }, [activeSection, user])

  async function loadUserData() {
    try {
      const { data } = await supabase.auth.getUser()
      const u = data?.user ?? null
      setUser(u)
      
      if (u) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', u.id)
          .maybeSingle()
        
        if (prof) {
          setProfile(prof)
          // Check if username is missing
          if (!prof.username || prof.username.trim() === '') {
            setShowUsernamePopup(true)
          }
        }
      }
    } catch (e) {
      console.error('Load user failed:', e)
    }
  }

  async function handleSaveUsername() {
    if (!newUsername.trim()) {
      setUsernameError('Vui lòng nhập username')
      return
    }

    if (newUsername.length < 3) {
      setUsernameError('Username phải có ít nhất 3 ký tự')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      setUsernameError('Username chỉ được chứa chữ, số và dấu gạch dưới')
      return
    }

    try {
      // Check if username exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('username', newUsername.trim())
        .maybeSingle()

      if (existing) {
        setUsernameError('Username đã được sử dụng')
        return
      }

      // Update username
      const { error } = await supabase
        .from('profiles')
        .update({ username: newUsername.trim() })
        .eq('user_id', user.id)

      if (error) throw error

      // Reload user data
      await loadUserData()
      setShowUsernamePopup(false)
      setNewUsername('')
      setUsernameError('')
    } catch (e: any) {
      setUsernameError(e.message || 'Lỗi khi lưu username')
    }
  }

  async function handleUpdateUsername() {
    if (!newUsername.trim()) {
      alert('Vui lòng nhập username mới')
      return
    }

    if (newUsername.length < 3) {
      alert('Username phải có ít nhất 3 ký tự')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      alert('Username chỉ được chứa chữ, số và dấu gạch dưới')
      return
    }

    try {
      // Check if username exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('username', newUsername.trim())
        .maybeSingle()

      if (existing && existing.user_id !== user.id) {
        alert('Username đã được sử dụng')
        return
      }

      // Update username
      const { error } = await supabase
        .from('profiles')
        .update({ username: newUsername.trim() })
        .eq('user_id', user.id)

      if (error) throw error

      // Reload user data
      await loadUserData()
      setNewUsername('')
      
      // Dispatch profile update event for global consistency
      window.dispatchEvent(new CustomEvent('profileUpdated', { 
        detail: { 
          username: newUsername.trim(),
          field: 'username'
        } 
      }))
      
      alert('Đã cập nhật username thành công!')
    } catch (e: any) {
      alert(e.message || 'Lỗi khi cập nhật username')
    }
  }

  async function loadMatchHistory() {
    if (!user) return
    setLoadingHistory(true)
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          player_x_user_id,
          player_o_user_id,
          winner_user_id,
          result,
          player_x_mindpoint_change,
          player_o_mindpoint_change,
          ended_at,
          player_x:profiles!matches_player_x_user_id_fkey(username, display_name),
          player_o:profiles!matches_player_o_user_id_fkey(username, display_name)
        `)
        .or(`player_x_user_id.eq.${user.id},player_o_user_id.eq.${user.id}`)
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(20)

      if (error) throw error

      const formatted = (data || []).map((match: any) => {
        const isPlayerX = match.player_x_user_id === user.id
        const opponent = isPlayerX 
          ? (match.player_o?.username || match.player_o?.display_name || 'AI')
          : (match.player_x?.username || match.player_x?.display_name || 'Đối thủ')
        
        let result = 'draw'
        if (match.winner_user_id === user.id) result = 'win'
        else if (match.winner_user_id && match.winner_user_id !== user.id) result = 'lose'

        const eloChange = isPlayerX ? match.player_x_mindpoint_change : match.player_o_mindpoint_change
        
        const timeAgo = formatTimeAgo(match.ended_at)

        return {
          id: match.id,
          result,
          opponent,
          eloChange: eloChange || 0,
          time: timeAgo
        }
      })

      setMatchHistory(formatted)
    } catch (e) {
      console.error('Load match history failed:', e)
    } finally {
      setLoadingHistory(false)
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Vừa xong'
    if (diffMins < 60) return `${diffMins} phút trước`
    if (diffHours < 24) return `${diffHours} giờ trước`
    if (diffDays < 7) return `${diffDays} ngày trước`
    return date.toLocaleDateString('vi-VN')
  }

  async function handleChangePassword() {
    setPasswordError('')
    setPasswordSuccess('')

    // Validation
    if (!newPassword || !confirmPassword) {
      setPasswordError('Vui lòng nhập đầy đủ thông tin')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có ít nhất 8 ký tự')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp')
      return
    }

    // Check password strength
    const hasUpperCase = /[A-Z]/.test(newPassword)
    const hasLowerCase = /[a-z]/.test(newPassword)
    const hasNumber = /[0-9]/.test(newPassword)
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      setPasswordError('Mật khẩu phải chứa chữ hoa, chữ thường và số')
      return
    }

    setChangingPassword(true)
    try {
      // Use Supabase Auth to update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setPasswordSuccess('Đã thay đổi mật khẩu thành công!')
      setShowPasswordChange(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      
      // Optional: Sign out user to require re-login with new password
      setTimeout(() => {
        setPasswordSuccess('')
      }, 3000)
    } catch (e: any) {
      setPasswordError(e.message || 'Lỗi khi thay đổi mật khẩu')
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleChangeEmail() {
    setEmailError('')
    setEmailSuccess('')

    // Validation
    if (!newEmail || !newEmail.trim()) {
      setEmailError('Vui lòng nhập email mới')
      return
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      setEmailError('Email không hợp lệ')
      return
    }

    // Check if email is same as current
    if (newEmail === user?.email) {
      setEmailError('Email mới giống email hiện tại')
      return
    }

    setChangingEmail(true)
    try {
      // Use Supabase Auth to update email
      // This will send a confirmation email to the new address
      const { error } = await supabase.auth.updateUser({
        email: newEmail
      })

      if (error) throw error

      setEmailSuccess('Đã gửi email xác nhận đến địa chỉ mới. Vui lòng kiểm tra hộp thư và xác nhận để hoàn tất thay đổi.')
      setShowEmailChange(false)
      setNewEmail('')
      
      setTimeout(() => {
        setEmailSuccess('')
      }, 5000)
    } catch (e: any) {
      setEmailError(e.message || 'Lỗi khi thay đổi email')
    } finally {
      setChangingEmail(false)
    }
  }

  async function handleUploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !user) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Ảnh không được vượt quá 2MB')
      return
    }

    setUploadingAvatar(true)
    try {
      // Convert image to base64 and store in profile directly
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64String = reader.result as string
        
        try {
          // Update profile with base64 avatar
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: base64String })
            .eq('user_id', user.id)

          if (updateError) throw updateError

          await loadUserData()
          
          // Dispatch profile update event for global consistency
          window.dispatchEvent(new CustomEvent('profileUpdated', { 
            detail: { 
              avatar_url: base64String,
              field: 'avatar'
            } 
          }))
          
          alert('Đã cập nhật avatar thành công!')
        } catch (e: any) {
          console.error('Update avatar failed:', e)
          alert(e.message || 'Lỗi khi cập nhật avatar')
        } finally {
          setUploadingAvatar(false)
        }
      }
      
      reader.onerror = () => {
        alert('Lỗi khi đọc file ảnh')
        setUploadingAvatar(false)
      }
      
      reader.readAsDataURL(file)
    } catch (e: any) {
      console.error('Upload avatar failed:', e)
      alert(e.message || 'Lỗi khi upload avatar')
      setUploadingAvatar(false)
    }
  }

  async function handleLogout() {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
      try {
        await supabase.auth.signOut()
        window.location.href = '/'
      } catch (e) {
        console.error('Logout failed:', e)
        alert('Lỗi khi đăng xuất')
      }
    }
  }

  // Load settings from localStorage on mount
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('gameSettings')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
    return {
      // UI
      theme: 'dark',
      uiEffects: true,
      effectsQuality: 'high',
      uiStyle: 'xianxia',
      fontSize: 'medium',
      // Sound
      bgMusic: true,
      bgMusicVolume: 70,
      sfxEnabled: true,
      sfxVolume: 80,
      moveSoundEnabled: true,
      // Board
      boardSize: '15x15',
      highlightLastMove: true,
      showWinningLine: true,
      pieceDropEffect: true,
      showHints: false,
      boardSkin: 'default',
      // Notifications
      systemNotif: true,
      inviteNotif: true,
      chatNotif: true,
      turnNotif: true,
      // Language
      language: 'vi',
      // Vibration
      vibrationEnabled: true
    }
  }

  // Settings state
  const [settings, setSettings] = React.useState(loadSettings())

  // Save settings to localStorage whenever they change
  React.useEffect(() => {
    try {
      localStorage.setItem('gameSettings', JSON.stringify(settings))
      applySettings(settings)
      
      // Update AudioManager with new audio settings
      AudioManager.updateSettings({
        bgMusic: settings.bgMusic,
        bgMusicVolume: settings.bgMusicVolume,
        sfxEnabled: settings.sfxEnabled,
        sfxVolume: settings.sfxVolume,
        moveSoundEnabled: settings.moveSoundEnabled
      })
      
      // Update NotificationManager with new notification settings
      NotificationManager.updateSettings({
        systemNotif: settings.systemNotif,
        inviteNotif: settings.inviteNotif,
        chatNotif: settings.chatNotif,
        turnNotif: settings.turnNotif
      })
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  }, [settings])

  // Apply settings to the app
  const applySettings = (newSettings: typeof settings) => {
    // Apply theme
    document.documentElement.setAttribute('data-theme', newSettings.theme)
    if (newSettings.theme === 'dark') {
      document.body.style.background = 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)'
    } else {
      document.body.style.background = 'linear-gradient(135deg, #f5f7fa, #c3cfe2)'
    }

    // Apply UI effects
    document.documentElement.style.setProperty('--effects-enabled', newSettings.uiEffects ? '1' : '0')
    if (newSettings.uiEffects) {
      document.body.classList.add('effects-enabled')
      document.body.classList.remove('effects-disabled')
    } else {
      document.body.classList.add('effects-disabled')
      document.body.classList.remove('effects-enabled')
    }
    
    // Apply effects quality
    document.body.setAttribute('data-effects-quality', newSettings.effectsQuality)
    
    // Apply UI style
    document.body.setAttribute('data-ui-style', newSettings.uiStyle)
    
    // Apply font size
    const fontSizes = { small: '14px', medium: '16px', large: '18px' }
    document.documentElement.style.fontSize = fontSizes[newSettings.fontSize as keyof typeof fontSizes] || '16px'

    // Language is handled by LanguageContext's setLanguage(), no need to apply here

    // Apply board preferences as data attributes for game component
    document.body.setAttribute('data-highlight-last-move', newSettings.highlightLastMove.toString())
    document.body.setAttribute('data-piece-drop-effect', newSettings.pieceDropEffect.toString())
    document.body.setAttribute('data-vibration-enabled', newSettings.vibrationEnabled.toString())

    // Store in global for access by other components
    if (typeof window !== 'undefined') {
      (window as any).gameSettings = newSettings
    }
  }

  // Reset all settings to default
  const handleResetSettings = () => {
    if (confirm('Bạn có chắc muốn khôi phục toàn bộ cài đặt về mặc định?')) {
      const defaultSettings = {
        theme: 'dark',
        uiEffects: true,
        effectsQuality: 'high',
        uiStyle: 'xianxia',
        fontSize: 'medium',
        bgMusic: true,
        bgMusicVolume: 70,
        sfxEnabled: true,
        sfxVolume: 80,
        moveSoundEnabled: true,
        boardSize: '15x15',
        highlightLastMove: true,
        showWinningLine: true,
        pieceDropEffect: true,
        showHints: false,
        boardSkin: 'default',
        systemNotif: true,
        inviteNotif: true,
        chatNotif: true,
        turnNotif: true,
        language: 'vi',
        vibrationEnabled: true
      }
      setSettings(defaultSettings)
      localStorage.removeItem('gameSettings')
      applySettings(defaultSettings)
    }
  }

  // Update a specific setting
  const updateSetting = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }))
  }

  // Calculate EXP for next level (same formula as Quests)
  function getExpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.5))
  }

  // Use real data from Supabase
  const currentLevel = profile?.level || 1
  const currentExp = profile?.exp || 0
  const expNeeded = getExpForLevel(currentLevel)
  const expProgress = Math.min((currentExp / expNeeded) * 100, 100)

  const userData = {
    username: profile?.username || profile?.display_name || 'Chưa đặt tên',
    email: user?.email || 'user@example.com',
    phone: user?.phone || 'Chưa cập nhật',
    avatar: profile?.avatar_url || '',
    level: currentLevel,
    exp: currentExp,
    expNeeded: expNeeded,
    expProgress: expProgress,
    rank: getRankName(profile?.current_rank || 'vo_danh'),
    rankIcon: getRankIcon(profile?.current_rank || 'vo_danh'),
    title: 'Vô Danh Thành Vô Đối',
    coins: profile?.coins || 0,
    gems: profile?.gems || 0,
    stats: {
      totalMatches: profile?.total_matches || 0,
      wins: profile?.total_wins || 0,
      losses: profile?.total_losses || 0,
      winRate: profile?.total_matches > 0 ? Math.round((profile?.total_wins / profile?.total_matches) * 100) : 0,
      currentStreak: profile?.win_streak || 0,
      elo: profile?.elo_rating || 1000
    }
  }

  function getRankName(rank: string) {
    const ranks: any = {
      'vo_danh': 'Vô Danh',
      'tan_ky': 'Tân Kỳ',
      'hoc_ky': 'Học Kỳ',
      'ky_lao': 'Kỳ Lão',
      'cao_ky': 'Cao Kỳ',
      'ky_thanh': 'Kỳ Thánh',
      'truyen_thuyet': 'Truyền Thuyết'
    }
    return ranks[rank] || 'Vô Danh'
  }

  function getRankIcon(rank: string) {
    const icons: any = {
      'vo_danh': '🥉',
      'tan_ky': '🥈',
      'hoc_ky': '🥇',
      'ky_lao': '💎',
      'cao_ky': '🏆',
      'ky_thanh': '👑',
      'truyen_thuyet': '⭐'
    }
    return icons[rank] || '🥉'
  }

  return (
    <div className="profile-container">
      {/* Username Popup */}
      {showUsernamePopup && (
        <div className="popup-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="popup-content glass-card" style={{
            padding: '32px',
            maxWidth: '450px',
            width: '90%',
            borderRadius: '16px',
            textAlign: 'center'
          }}>
            <h2 style={{ marginBottom: '16px', fontSize: '24px' }}>🎮 Đặt tên In-Game</h2>
            <p style={{ marginBottom: '24px', color: 'var(--color-muted)', lineHeight: '1.6' }}>
              Để bắt đầu hành trình, hãy chọn một username độc nhất.
              Username này sẽ là danh hiệu của bạn trong game và được dùng để tìm kiếm kết bạn.
            </p>
            <input
              type="text"
              placeholder="Nhập username (VD: VoDanh123)"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSaveUsername()}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontSize: '16px',
                marginBottom: '8px'
              }}
            />
            {usernameError && (
              <p style={{ color: '#EF4444', fontSize: '14px', marginBottom: '16px' }}>
                {usernameError}
              </p>
            )}
            <p style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '24px' }}>
              • Ít nhất 3 ký tự<br/>
              • Chỉ chứa chữ, số và dấu gạch dưới (_)
            </p>
            <button
              onClick={handleSaveUsername}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                fontWeight: 600
              }}
            >
              Xác nhận
            </button>
          </div>
        </div>
      )}
      <nav className="breadcrumb-nav" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <a href="#home">{t('breadcrumb.home')}</a>
        <span>›</span>
        <span className="breadcrumb-current">{t('breadcrumb.profile')}</span>
      </nav>
      <div className="profile-grid">
        {/* Left Sidebar - Simple BangBang Style */}
        <aside className="profile-sidebar glass-card">
          <nav className="profile-nav">
            <button 
              className={`profile-nav-item ${activeSection === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveSection('overview')}
            >
              <span className="nav-dot">•</span>
              <span className="nav-text">{t('profile.overview')}</span>
            </button>
            <button 
              className={`profile-nav-item ${activeSection === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveSection('settings')}
            >
              <span className="nav-dot">•</span>
              <span className="nav-text">{t('profile.settings')}</span>
            </button>
            <button 
              className={`profile-nav-item ${activeSection === 'history' ? 'active' : ''}`}
              onClick={() => setActiveSection('history')}
            >
              <span className="nav-dot">•</span>
              <span className="nav-text">{t('profile.history')}</span>
            </button>
          </nav>
        </aside>

        {/* Main Content - Center Right */}
        <main className="profile-main glass-card energy-border">
          {activeSection === 'overview' && (
            <div className="profile-overview">
              {/* Avatar Section */}
              <div className="profile-avatar-section">
                <div className="profile-avatar-frame">
                  <div className="profile-avatar-glow"></div>
                  <div className="profile-avatar">
                    {userData.avatar ? (
                      <img src={userData.avatar} alt={userData.username} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    ) : (
                      <div className="profile-avatar-placeholder">👤</div>
                    )}
                  </div>
                </div>
                
                {/* Level & EXP */}
                <div className="profile-level">
                  <span className="level-label">Level {userData.level}</span>
                  <div className="exp-bar">
                    <div className="exp-fill" style={{ width: `${userData.expProgress}%` }}></div>
                  </div>
                  <span className="exp-text">{userData.exp} / {userData.expNeeded} EXP</span>
                </div>
              </div>

              {/* User Info */}
              <div className="profile-info">
                <h2 className="profile-username">{userData.username}</h2>
                <div className="profile-rank">
                  <span className="rank-icon">{userData.rankIcon}</span>
                  <span className="rank-name">Rank: {userData.rank}</span>
                </div>
                <div className="profile-title">
                  <span className="title-label">Danh hiệu:</span>
                  <span className="title-value">"{userData.title}"</span>
                </div>
                
                <div className="profile-details">
                  <div className="detail-item">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{userData.email}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Số điện thoại:</span>
                    <span className="detail-value">{userData.phone}</span>
                  </div>
                </div>
              </div>

              {/* Stats Box - BangBang Style */}
              <div className="profile-stats-box">
                <div className="stat-item">
                  <div className="stat-value">{userData.stats.winRate}%</div>
                  <div className="stat-label">Tỷ lệ thắng</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{userData.stats.totalMatches}</div>
                  <div className="stat-label">Tổng trận</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{userData.stats.currentStreak}</div>
                  <div className="stat-label">Chuỗi thắng</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{userData.stats.elo}</div>
                  <div className="stat-label">Elo</div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'settings' && (
            <div className="profile-settings">
              <h2 className="section-title">Cài đặt</h2>
              
              {/* Settings Sidebar */}
              <div className="settings-layout">
                <aside className="settings-sidebar">
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'account' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('account')}
                  >
                    • {t('profile.account')}
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'ui' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('ui')}
                  >
                    • {t('profile.ui')}
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'sound' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('sound')}
                  >
                    • {t('profile.sound')}
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'board' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('board')}
                  >
                    • {t('profile.board')}
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'notifications' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('notifications')}
                  >
                    • {t('profile.notifications')}
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'language' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('language')}
                  >
                    • {t('profile.language')}
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'other' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('other')}
                  >
                    • {t('profile.other')}
                  </button>
                  
                  {/* Reset Button - Moved to sidebar bottom */}
                  <button 
                    className="btn-reset-compact"
                    onClick={handleResetSettings}
                  >
                    <span style={{ fontSize: '14px' }}>↻</span>
                    <span style={{ fontSize: '11px' }}>Khôi phục cài đặt gốc</span>
                  </button>
                </aside>

                <div className="settings-content">
                  {/* CARD 1 - TÀI KHOẢN */}
                  {activeSettingsTab === 'account' && (
                    <div className="settings-card">
                      <h3 className="card-title">Tài khoản</h3>
                      <div className="setting-item">
                        <label>Username</label>
                        <input type="text" value={userData.username} disabled />
                      </div>
                      <div className="setting-item">
                        <label>Đổi username</label>
                        <div className="input-group">
                          <input 
                            type="text" 
                            placeholder="Username mới" 
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                          />
                          <button className="btn-primary" onClick={handleUpdateUsername}>Cập nhật</button>
                        </div>
                        
                      </div>
                      <div className="setting-item">
                        <label>Đổi avatar</label>
                        <input 
                          type="file" 
                          id="avatarInput" 
                          accept="image/*" 
                          style={{ display: 'none' }} 
                          onChange={handleUploadAvatar}
                        />
                        <button 
                          className="btn-secondary" 
                          onClick={() => document.getElementById('avatarInput')?.click()}
                          disabled={uploadingAvatar}
                        >
                          {uploadingAvatar ? 'Đang tải...' : 'Chọn ảnh'}
                        </button>
                        
                      </div>
                      <div className="setting-item">
                        <label>Email</label>
                        <input type="text" value={userData.email} disabled />
                      </div>
                      <div className="setting-item">
                        <label>Đổi email</label>
                        {!showEmailChange ? (
                          <button 
                            className="btn-secondary" 
                            onClick={() => setShowEmailChange(true)}
                          >
                            📧 Thay đổi email
                          </button>
                        ) : (
                          <div className="email-change-form" style={{
                            marginTop: '12px',
                            padding: '16px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.1)'
                          }}>
                            <div style={{ marginBottom: '12px' }}>
                              <input
                                type="email"
                                placeholder="Email mới"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  background: 'rgba(255,255,255,0.05)',
                                  color: 'white',
                                  fontSize: '14px'
                                }}
                              />
                            </div>
                            {emailError && (
                              <p style={{ color: '#EF4444', fontSize: '13px', marginBottom: '8px' }}>
                                {emailError}
                              </p>
                            )}
                            {emailSuccess && (
                              <p style={{ color: '#10B981', fontSize: '13px', marginBottom: '8px' }}>
                                {emailSuccess}
                              </p>
                            )}
                            <p style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '12px' }}>
                              Bạn sẽ nhận email xác nhận tại địa chỉ mới. Vui lòng xác nhận để hoàn tất thay đổi.
                            </p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                className="btn-primary" 
                                onClick={handleChangeEmail}
                                disabled={changingEmail}
                                style={{ flex: 1, padding: '8px' }}
                              >
                                {changingEmail ? 'Đang gửi...' : 'Gửi xác nhận'}
                              </button>
                              <button 
                                className="btn-secondary" 
                                onClick={() => {
                                  setShowEmailChange(false)
                                  setNewEmail('')
                                  setEmailError('')
                                  setEmailSuccess('')
                                }}
                                disabled={changingEmail}
                                style={{ flex: 1, padding: '8px' }}
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="setting-item">
                        <label>Đổi mật khẩu</label>
                        {!showPasswordChange ? (
                          <button 
                            className="btn-secondary" 
                            onClick={() => setShowPasswordChange(true)}
                          >
                            🔒 Thay đổi mật khẩu
                          </button>
                        ) : (
                          <div className="password-change-form" style={{
                            marginTop: '12px',
                            padding: '16px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.1)'
                          }}>
                            <div style={{ marginBottom: '12px' }}>
                              <input
                                type="password"
                                placeholder="Mật khẩu mới"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  background: 'rgba(255,255,255,0.05)',
                                  color: 'white',
                                  fontSize: '14px'
                                }}
                              />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                              <input
                                type="password"
                                placeholder="Xác nhận mật khẩu mới"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  background: 'rgba(255,255,255,0.05)',
                                  color: 'white',
                                  fontSize: '14px'
                                }}
                              />
                            </div>
                            {passwordError && (
                              <p style={{ color: '#EF4444', fontSize: '13px', marginBottom: '8px' }}>
                                {passwordError}
                              </p>
                            )}
                            {passwordSuccess && (
                              <p style={{ color: '#10B981', fontSize: '13px', marginBottom: '8px' }}>
                                {passwordSuccess}
                              </p>
                            )}
                            <p style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '12px' }}>
                              • Ít nhất 8 ký tự<br/>
                              • Chứa chữ hoa, chữ thường và số
                            </p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                className="btn-primary" 
                                onClick={handleChangePassword}
                                disabled={changingPassword}
                                style={{ flex: 1, padding: '8px' }}
                              >
                                {changingPassword ? 'Đang lưu...' : 'Lưu'}
                              </button>
                              <button 
                                className="btn-secondary" 
                                onClick={() => {
                                  setShowPasswordChange(false)
                                  setNewPassword('')
                                  setConfirmPassword('')
                                  setPasswordError('')
                                  setPasswordSuccess('')
                                }}
                                disabled={changingPassword}
                                style={{ flex: 1, padding: '8px' }}
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="setting-item">
                        <label>Liên kết tài khoản</label>
                        <div className="link-accounts">
                          <button className="link-btn google">🔗 Google</button>
                          <button className="link-btn email">📧 Email</button>
                        </div>
                      </div>
                      <div className="setting-item">
                        <button className="btn-danger" onClick={handleLogout}>Đăng xuất</button>
                      </div>
                    </div>
                  )}

                  {/* CARD 2 - GIAO DIỆN */}
                  {activeSettingsTab === 'ui' && (
                    <div className="settings-card">
                      <h3 className="card-title">Giao diện</h3>
                      <div className="setting-item">
                        <label>Chế độ</label>
                        <div className="toggle-group">
                          <button 
                            className={`toggle-btn ${settings.theme === 'dark' ? 'active' : ''}`}
                            onClick={() => setSettings({...settings, theme: 'dark'})}
                          >
                            🌙 Tối
                          </button>
                          <button 
                            className={`toggle-btn ${settings.theme === 'light' ? 'active' : ''}`}
                            onClick={() => setSettings({...settings, theme: 'light'})}
                          >
                            ☀️ Sáng
                          </button>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>Hiệu ứng UI</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="uiEffects" 
                            checked={settings.uiEffects}
                            onChange={(e) => setSettings({...settings, uiEffects: e.target.checked})}
                          />
                          <label htmlFor="uiEffects" className="switch"></label>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>Chất lượng hiệu ứng</label>
                        <select 
                          value={settings.effectsQuality}
                          onChange={(e) => setSettings({...settings, effectsQuality: e.target.value})}
                        >
                          <option value="low">Thấp</option>
                          <option value="medium">Trung bình</option>
                          <option value="high">Cao</option>
                        </select>
                      </div>
                      <div className="setting-item">
                        <label>Kiểu giao diện</label>
                        <div className="radio-group">
                          <label className="radio-label">
                            <input 
                              type="radio" 
                              name="uiStyle" 
                              value="classic"
                              checked={settings.uiStyle === 'classic'}
                              onChange={(e) => setSettings({...settings, uiStyle: e.target.value})}
                            />
                            <span>Cổ điển caro</span>
                          </label>
                          <label className="radio-label">
                            <input 
                              type="radio" 
                              name="uiStyle" 
                              value="xianxia"
                              checked={settings.uiStyle === 'xianxia'}
                              onChange={(e) => setSettings({...settings, uiStyle: e.target.value})}
                            />
                            <span>Tiên hiệp (mặc định)</span>
                          </label>
                          <label className="radio-label">
                            <input 
                              type="radio" 
                              name="uiStyle" 
                              value="anime"
                              checked={settings.uiStyle === 'anime'}
                              onChange={(e) => setSettings({...settings, uiStyle: e.target.value})}
                            />
                            <span>Anime / Neon</span>
                          </label>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>Cỡ chữ</label>
                        <div className="toggle-group">
                          <button 
                            className={`toggle-btn ${settings.fontSize === 'small' ? 'active' : ''}`}
                            onClick={() => setSettings({...settings, fontSize: 'small'})}
                          >
                            Nhỏ
                          </button>
                          <button 
                            className={`toggle-btn ${settings.fontSize === 'medium' ? 'active' : ''}`}
                            onClick={() => setSettings({...settings, fontSize: 'medium'})}
                          >
                            Vừa
                          </button>
                          <button 
                            className={`toggle-btn ${settings.fontSize === 'large' ? 'active' : ''}`}
                            onClick={() => setSettings({...settings, fontSize: 'large'})}
                          >
                            Lớn
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CARD 3 - ÂM THANH */}
                  {activeSettingsTab === 'sound' && (
                    <div className="settings-card">
                      <h3 className="card-title">Âm thanh</h3>
                      <div className="setting-item">
                        <label>Nhạc nền</label>
                        <div className="slider-group">
                          <div className="switch-wrapper">
                            <input 
                              type="checkbox" 
                              id="bgMusic" 
                              checked={settings.bgMusic}
                              onChange={(e) => setSettings({...settings, bgMusic: e.target.checked})}
                            />
                            <label htmlFor="bgMusic" className="switch"></label>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={settings.bgMusicVolume}
                            onChange={(e) => setSettings({...settings, bgMusicVolume: Number(e.target.value)})}
                            disabled={!settings.bgMusic}
                          />
                          <span className="volume-label">{settings.bgMusicVolume}%</span>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>Hiệu ứng âm</label>
                        <div className="slider-group">
                          <div className="switch-wrapper">
                            <input 
                              type="checkbox" 
                              id="sfxEnabled" 
                              checked={settings.sfxEnabled}
                              onChange={(e) => setSettings({...settings, sfxEnabled: e.target.checked})}
                            />
                            <label htmlFor="sfxEnabled" className="switch"></label>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={settings.sfxVolume}
                            onChange={(e) => setSettings({...settings, sfxVolume: Number(e.target.value)})}
                            disabled={!settings.sfxEnabled}
                          />
                          <span className="volume-label">{settings.sfxVolume}%</span>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>Âm đặt quân</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="moveSoundEnabled" 
                            checked={settings.moveSoundEnabled}
                            onChange={(e) => setSettings({...settings, moveSoundEnabled: e.target.checked})}
                          />
                          <label htmlFor="moveSoundEnabled" className="switch"></label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CARD 4 - BÀN CỜ & NƯỚC ĐI */}
                  {activeSettingsTab === 'board' && (
                    <div className="settings-card">
                      <h3 className="card-title">Bàn cờ & Nước đi</h3>
                      <div className="setting-item">
                        <label>Highlight nước vừa đánh</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="highlightLastMove" 
                            checked={settings.highlightLastMove}
                            onChange={(e) => setSettings({...settings, highlightLastMove: e.target.checked})}
                          />
                          <label htmlFor="highlightLastMove" className="switch"></label>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>Hiệu ứng rơi quân</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="pieceDropEffect" 
                            checked={settings.pieceDropEffect}
                            onChange={(e) => setSettings({...settings, pieceDropEffect: e.target.checked})}
                          />
                          <label htmlFor="pieceDropEffect" className="switch"></label>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>Rung phản hồi</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="vibrationEnabled" 
                            checked={settings.vibrationEnabled}
                            onChange={(e) => setSettings({...settings, vibrationEnabled: e.target.checked})}
                          />
                          <label htmlFor="vibrationEnabled" className="switch"></label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CARD 5 - THÔNG BÁO */}
                  {activeSettingsTab === 'notifications' && (
                    <div className="settings-card">
                      <h3 className="card-title">Thông báo</h3>
                      <div className="setting-item" style={{
                        padding: '16px',
                        background: notificationPermission === 'granted' 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : notificationPermission === 'denied'
                          ? 'rgba(239, 68, 68, 0.1)'
                          : 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '8px',
                        border: `1px solid ${notificationPermission === 'granted' 
                          ? 'rgba(16, 185, 129, 0.3)' 
                          : notificationPermission === 'denied'
                          ? 'rgba(239, 68, 68, 0.3)'
                          : 'rgba(59, 130, 246, 0.3)'}`,
                        marginBottom: '16px'
                      }}>
                        <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                          Quyền thông báo trình duyệt
                        </label>
                        <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '12px', lineHeight: '1.5' }}>
                          {notificationPermission === 'granted' 
                            ? '✅ Đã cấp quyền. Bạn sẽ nhận thông báo từ game.'
                            : notificationPermission === 'denied'
                            ? '❌ Đã từ chối. Vui lòng cấp quyền trong cài đặt trình duyệt.'
                            : '🔔 Cho phép thông báo để nhận lời mời đấu, tin nhắn và cập nhật game.'}
                        </p>
                        {notificationPermission !== 'granted' && notificationPermission !== 'denied' && (
                          <button 
                            className="btn-primary"
                            onClick={async () => {
                              const permission = await NotificationManager.requestPermission()
                              setNotificationPermission(permission)
                              if (permission === 'granted') {
                                NotificationManager.notifySystem('Thành công!', 'Bạn sẽ nhận được thông báo từ game')
                              }
                            }}
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                          >
                            🔔 Cho phép thông báo
                          </button>
                        )}
                        {notificationPermission === 'granted' && (
                          <button 
                            className="btn-secondary"
                            onClick={() => {
                              NotificationManager.notifySystem('Thử nghiệm', 'Đây là thông báo thử nghiệm từ MindPoint Arena! 🎮')
                            }}
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                          >
                            🧪 Thử thông báo
                          </button>
                        )}
                      </div>
                      <div className="setting-item">
                        <label>Thông báo hệ thống</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="systemNotif" 
                            checked={settings.systemNotif}
                            onChange={(e) => setSettings({...settings, systemNotif: e.target.checked})}
                          />
                          <label htmlFor="systemNotif" className="switch"></label>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>Thông báo lời mời đấu</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="inviteNotif" 
                            checked={settings.inviteNotif}
                            onChange={(e) => setSettings({...settings, inviteNotif: e.target.checked})}
                          />
                          <label htmlFor="inviteNotif" className="switch"></label>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>Tin nhắn trong game</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="chatNotif" 
                            checked={settings.chatNotif}
                            onChange={(e) => setSettings({...settings, chatNotif: e.target.checked})}
                          />
                          <label htmlFor="chatNotif" className="switch"></label>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>Âm báo khi vào lượt</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="turnNotif" 
                            checked={settings.turnNotif}
                            onChange={(e) => setSettings({...settings, turnNotif: e.target.checked})}
                          />
                          <label htmlFor="turnNotif" className="switch"></label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CARD 6 - NGÔN NGỮ */}
                  {activeSettingsTab === 'language' && (
                    <div className="settings-card">
                      <h3 className="card-title">{t('profile.language')}</h3>
                      <div className="language-grid">
                        <button 
                          className={`language-btn ${language === 'vi' ? 'active' : ''}`}
                          onClick={() => {
                            setLanguage('vi')
                            setSettings({...settings, language: 'vi'})
                          }}
                        >
                          🇻🇳 Tiếng Việt
                        </button>
                        <button 
                          className={`language-btn ${language === 'en' ? 'active' : ''}`}
                          onClick={() => {
                            setLanguage('en')
                            setSettings({...settings, language: 'en'})
                          }}
                        >
                          🇬🇧 English
                        </button>
                        <button 
                          className={`language-btn ${language === 'zh' ? 'active' : ''}`}
                          onClick={() => {
                            setLanguage('zh')
                            setSettings({...settings, language: 'zh'})
                          }}
                        >
                          🇨🇳 中文
                        </button>
                        <button 
                          className={`language-btn ${language === 'ja' ? 'active' : ''}`}
                          onClick={() => {
                            setLanguage('ja')
                            setSettings({...settings, language: 'ja'})
                          }}
                        >
                          🇯🇵 日本語
                        </button>
                      </div>
                    </div>
                  )}

                  {/* CARD 7 - KHÁC */}
                  {activeSettingsTab === 'other' && (
                    <div className="settings-card">
                      <h3 className="card-title">Khác</h3>
                      <div className="setting-item">
                        <button className="btn-link">📖 Giới thiệu game</button>
                      </div>
                      <div className="setting-item">
                        <button className="btn-link">📜 Điều khoản sử dụng</button>
                      </div>
                      <div className="setting-item">
                        <button className="btn-link">🔒 Chính sách bảo mật</button>
                      </div>
                      <div className="setting-item version-info">
                        <span>Phiên bản: v1.0.0</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'history' && (
            <div className="profile-history">
              <h2 className="section-title">Lịch sử đấu</h2>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-muted)' }}>
                  Đang tải lịch sử...
                </div>
              ) : matchHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-muted)' }}>
                  Chưa có trận đấu nào
                </div>
              ) : (
              <div className="history-list">
                {matchHistory.map((match) => (
                  <div key={match.id} className={`history-item ${match.result}`}>
                    <div className="history-result">
                      {match.result === 'win' ? (
                        <span className="result-badge win">Thắng</span>
                      ) : (
                        <span className="result-badge lose">Thua</span>
                      )}
                    </div>
                    <div className="history-opponent">vs {match.opponent}</div>
                    <div className={`history-elo ${match.eloChange > 0 ? 'positive' : 'negative'}`}>
                      {match.eloChange > 0 ? '+' : ''}{match.eloChange} Elo
                    </div>
                    <div className="history-time">{match.time}</div>
                  </div>
                ))}
              </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
