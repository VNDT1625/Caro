import React from 'react'

export default function Profile() {
  const [activeSection, setActiveSection] = React.useState<'overview' | 'settings' | 'history'>('overview')
  const [activeSettingsTab, setActiveSettingsTab] = React.useState<'account' | 'ui' | 'sound' | 'board' | 'notifications' | 'language' | 'other'>('account')

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

    // Apply language
    document.documentElement.setAttribute('lang', newSettings.language)

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
      setSettings(defaultSettings)
      localStorage.removeItem('gameSettings')
      applySettings(defaultSettings)
    }
  }

  // Update a specific setting
  const updateSetting = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // Mock data - sẽ được thay thế bằng dữ liệu thực từ Supabase
  const userData = {
    username: 'VôDanh123',
    email: 'user@example.com',
    phone: '0123456789',
    avatar: '',
    level: 20,
    exp: 65,
    rank: 'Cao Kỳ',
    rankIcon: '🏆',
    title: 'Vô Danh Thành Vô Đối',
    coins: 15300,
    gems: 1000,
    stats: {
      totalMatches: 214,
      wins: 124,
      losses: 90,
      winRate: 58,
      currentStreak: 7,
      elo: 1180
    }
  }

  const matchHistory = [
    { id: 1, result: 'win', opponent: 'Minh', eloChange: +15, time: '10 phút trước' },
    { id: 2, result: 'lose', opponent: 'Ken', eloChange: -12, time: '30 phút trước' },
    { id: 3, result: 'win', opponent: 'Rin', eloChange: +18, time: '1 giờ trước' },
    { id: 4, result: 'win', opponent: 'Linh', eloChange: +20, time: '2 giờ trước' },
    { id: 5, result: 'lose', opponent: 'Hùng', eloChange: -10, time: '3 giờ trước' }
  ]

  return (
    <div className="profile-container">
      <nav className="breadcrumb-nav" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <a href="#home">Chánh Điện</a>
        <span>›</span>
        <span className="breadcrumb-current">Tiên Phủ</span>
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
              <span className="nav-text">Tổng quan</span>
            </button>
            <button 
              className={`profile-nav-item ${activeSection === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveSection('settings')}
            >
              <span className="nav-dot">•</span>
              <span className="nav-text">Cài đặt</span>
            </button>
            <button 
              className={`profile-nav-item ${activeSection === 'history' ? 'active' : ''}`}
              onClick={() => setActiveSection('history')}
            >
              <span className="nav-dot">•</span>
              <span className="nav-text">Lịch sử đấu</span>
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
                      <img src={userData.avatar} alt={userData.username} />
                    ) : (
                      <div className="profile-avatar-placeholder">👤</div>
                    )}
                  </div>
                </div>
                
                {/* Level & EXP */}
                <div className="profile-level">
                  <span className="level-label">Level {userData.level}</span>
                  <div className="exp-bar">
                    <div className="exp-fill" style={{ width: `${userData.exp}%` }}></div>
                  </div>
                  <span className="exp-text">{userData.exp}% to next level</span>
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
                    • Tài khoản
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'ui' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('ui')}
                  >
                    • Giao diện
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'sound' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('sound')}
                  >
                    • Âm thanh
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'board' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('board')}
                  >
                    • Bàn cờ & Nước đi
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'notifications' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('notifications')}
                  >
                    • Thông báo
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'language' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('language')}
                  >
                    • Ngôn ngữ
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'other' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('other')}
                  >
                    • Khác
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
                        <label>Đổi tên hiển thị</label>
                        <div className="input-group">
                          <input type="text" placeholder="Tên mới" />
                          <button className="btn-primary">Cập nhật</button>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>Đổi avatar</label>
                        <button className="btn-secondary">Chọn ảnh</button>
                      </div>
                      <div className="setting-item">
                        <label>Liên kết tài khoản</label>
                        <div className="link-accounts">
                          <button className="link-btn google">🔗 Google</button>
                          <button className="link-btn email">📧 Email</button>
                        </div>
                      </div>
                      <div className="setting-item">
                        <button className="btn-danger">Đăng xuất</button>
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
                      <h3 className="card-title">Ngôn ngữ</h3>
                      <div className="language-grid">
                        <button 
                          className={`language-btn ${settings.language === 'vi' ? 'active' : ''}`}
                          onClick={() => setSettings({...settings, language: 'vi'})}
                        >
                          🇻🇳 Tiếng Việt
                        </button>
                        <button 
                          className={`language-btn ${settings.language === 'en' ? 'active' : ''}`}
                          onClick={() => setSettings({...settings, language: 'en'})}
                        >
                          🇬🇧 English
                        </button>
                        <button 
                          className={`language-btn ${settings.language === 'zh' ? 'active' : ''}`}
                          onClick={() => setSettings({...settings, language: 'zh'})}
                        >
                          🇨🇳 中文
                        </button>
                        <button 
                          className={`language-btn ${settings.language === 'ja' ? 'active' : ''}`}
                          onClick={() => setSettings({...settings, language: 'ja'})}
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
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
