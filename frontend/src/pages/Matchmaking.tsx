import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'

export default function Matchmaking() {
  const { t } = useLanguage()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [isMatching, setIsMatching] = useState(false)
  const [matchTime, setMatchTime] = useState(0)
  const [opponent, setOpponent] = useState<any>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  // Settings state
  const [settings, setSettings] = useState({
    sound: true,
    effects: true,
    vibration: true,
    volume: 70
  })

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    let interval: any
    if (isMatching) {
      interval = setInterval(() => {
        setMatchTime(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isMatching])

  async function loadUser() {
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
          setAvatarUrl(prof.avatar_url || '')
        }
      }
    } catch (e) {
      console.error('Load user failed:', e)
    }
  }

  async function handleStartMatch() {
    if (!user) return
    setIsMatching(true)
    setMatchTime(0)
    
    try {
      // Import matchmaking service
      const { joinMatchmakingQueue } = await import('../lib/matchmaking')
      
      const matchSettings = {
        mode: 'rank' as const,
        gameType: 'standard',
        boardSize: '15x15',
        winCondition: 5,
        turnTime: 30,
        totalTime: 600,
        swap2Enabled: true // Ranked mode always has Swap 2 enabled
      }
      
      const result = await joinMatchmakingQueue(user.id, matchSettings)
      
      if (result.success && result.queueId) {
        console.log('✓ Joined matchmaking queue:', result.queueId)
        
        // Store in localStorage for persistence
        localStorage.setItem('matchmaking', JSON.stringify({
          active: true,
          queueId: result.queueId,
          startTime: Date.now(),
          matchSettings
        }))
        
        // Poll for match every 2 seconds
        const pollInterval = setInterval(async () => {
          const { findMatch } = await import('../lib/matchmaking')
          const matchResult = await findMatch(user.id, result.queueId!, matchSettings)
          
          if (matchResult.success && matchResult.opponent) {
            clearInterval(pollInterval)
            setOpponent({
              username: matchResult.opponent.displayName || matchResult.opponent.username,
              avatar_url: matchResult.opponent.avatar || '',
              rank: matchResult.opponent.rank,
              mindpoint: matchResult.opponent.mindpoint
            })
            
            // Store room info
            if (matchResult.roomId) {
              localStorage.setItem('currentRoom', JSON.stringify({
                roomId: matchResult.roomId,
                opponent: matchResult.opponent
              }))
            }
          }
        }, 2000)
        
        // Auto-cancel after 60 seconds
        setTimeout(() => {
          if (isMatching && !opponent) {
            clearInterval(pollInterval)
            handleCancelMatch()
            alert('Không tìm thấy đối thủ phù hợp. Vui lòng thử lại!')
          }
        }, 60000)
      } else {
        setIsMatching(false)
        alert('Không thể tham gia hàng đợi: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Matchmaking error:', error)
      setIsMatching(false)
      alert('Có lỗi xảy ra khi tìm trận!')
    }
  }

  async function handleCancelMatch() {
    setIsMatching(false)
    setMatchTime(0)
    setOpponent(null)
    
    // Cancel queue entry if exists
    const matchmaking = localStorage.getItem('matchmaking')
    if (matchmaking) {
      try {
        const data = JSON.parse(matchmaking)
        if (data.queueId) {
          const { cancelMatchmaking } = await import('../lib/matchmaking')
          await cancelMatchmaking(data.queueId)
          console.log('✓ Cancelled matchmaking queue')
        }
      } catch (error) {
        console.error('Error cancelling matchmaking:', error)
      }
      localStorage.removeItem('matchmaking')
    }
  }

  async function handleAvatarClick() {
    if (isMatching) return // Cannot change during matching
    
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0]
      if (!file || !user) return

      try {
        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${fileExt}`
        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(fileName, file)

        if (error) throw error

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName)

        // Update profile
        await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('user_id', user.id)

        setAvatarUrl(publicUrl)
      } catch (err) {
        console.error('Avatar upload failed:', err)
      }
    }
    input.click()
  }

  const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐']

  async function handleSendChat() {
    if (!chatMessage.trim()) return
    
    try {
      // Get room info from localStorage
      const roomData = localStorage.getItem('currentRoom')
      if (!roomData) {
        console.log('No room found, cannot send chat')
        return
      }
      
      const { roomId } = JSON.parse(roomData)
      
      // Insert chat message to database
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          user_id: user.id,
          message: chatMessage.trim(),
          created_at: new Date().toISOString()
        })
      
      if (error) {
        console.error('Error sending chat:', error)
        return
      }
      
      console.log('✓ Chat message sent')
      setChatMessage('')
    } catch (error) {
      console.error('Chat error:', error)
    }
  }

  function handleEmojiSelect(emoji: string) {
    setChatMessage(prev => prev + emoji)
    setShowEmojiPicker(false)
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="matchmaking-container">
      {/* Breadcrumb Navigation */}
      <nav style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '13px', 
        color: 'rgba(255,255,255,0.5)',
        marginBottom: '8px',
        padding: '20px 24px 0'
      }}>
        <a 
          href="#home" 
          style={{ 
            color: 'rgba(255,255,255,0.5)', 
            textDecoration: 'none',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#22D3EE'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
        >
          {t('breadcrumb.home')}
        </a>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>›</span>
        <span style={{ color: '#fff' }}>Ghép Trận Nhanh</span>
      </nav>
      
      <div className="matchmaking-header">
        <button 
          className="back-btn" 
          onClick={() => window.location.hash = '#home'}
          title="Quay Lại"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
           <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Quay Lại
        </button>
        <h1 className="matchmaking-title">GHÉP TRẬN NHANH</h1>
      </div>

      <div className="matchmaking-main-card">
        {/* Players Display */}
        <div className="matchmaking-players">
          {/* Current Player */}
          <div className="player-card">
            <div 
              className="player-avatar" 
              onClick={handleAvatarClick}
              style={{ cursor: isMatching ? 'not-allowed' : 'pointer' }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" />
              ) : (
                <div className="avatar-placeholder">👤</div>
              )}
              {!isMatching && <div className="avatar-edit-hint">Đổi ảnh</div>}
            </div>
            <div className="player-info">
              <div className="player-label">BẠN</div>
              <div className="player-name">{profile?.username || user?.email || 'Player'}</div>
              <div className="player-rank">Rank: {profile?.current_rank || 'Vô Danh'}</div>
            </div>
          </div>

          <div className="vs-divider">VS</div>

          {/* Opponent */}
          <div className="player-card opponent">
            <div className="player-avatar">
              {opponent ? (
                opponent.avatar_url ? (
                  <img src={opponent.avatar_url} alt="Opponent" />
                ) : (
                  <div className="avatar-placeholder">👤</div>
                )
              ) : (
                <div className="avatar-placeholder searching">❓</div>
              )}
            </div>
            <div className="player-info">
              <div className="player-label">ĐỐI THỦ</div>
              <div className="player-name">
                {opponent ? opponent.username : 'Đang tìm...'}
              </div>
              {opponent && <div className="player-rank">Rank: {opponent.current_rank || 'Vô Danh'}</div>}
            </div>
          </div>
        </div>

        {/* Timer Circle */}
        {isMatching && (
          <div className="matchmaking-timer">
            <svg className="timer-circle" viewBox="0 0 120 120">
              <circle
                className="timer-bg"
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
              />
              <circle
                className="timer-progress"
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="#22D3EE"
                strokeWidth="8"
                strokeDasharray="339.292"
                strokeDashoffset={339.292 - (339.292 * (matchTime % 60)) / 60}
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div className="timer-text">{formatTime(matchTime)}</div>
          </div>
        )}

        {/* Settings Button */}
        <button 
          className="settings-btn"
          onClick={() => setShowSettings(!showSettings)}
        >
          <span className="settings-icon">⚙</span>
          <span className="settings-label">Cài đặt</span>
        </button>
      </div>

      {/* Start/Cancel Button */}
      {isMatching ? (
        <button className="cancel-match-btn" onClick={handleCancelMatch}>
          HỦY GHÉP TRẬN
        </button>
      ) : (
        <button className="start-match-btn" onClick={handleStartMatch}>
          BẮT ĐẦU GHÉP TRẬN
        </button>
      )}

      {/* Chat Box */}
      <div className="matchmaking-chat-wrapper">
        <div className="matchmaking-chat">
          <div className="chat-actions">
            <div className="emoji-picker-wrapper">
              <button 
                className="emoji-btn" 
                title="Emoji"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                🙂
              </button>
              {showEmojiPicker && (
                <div className="emoji-picker">
                  <div className="emoji-grid">
                    {emojis.map((emoji, index) => (
                      <button
                        key={index}
                        className="emoji-item"
                        onClick={() => handleEmojiSelect(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="chat-input-wrapper">
            <input
              type="text"
              className="chat-input"
              placeholder="Nhấn Enter để chat…"
              value={chatMessage}
              onChange={e => setChatMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSendChat()
              }}
            />
          </div>
          <button 
            className="send-btn" 
            onClick={handleSendChat}
            disabled={!chatMessage.trim()}
            title="Gửi"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
        <button className="micro-btn" title="Voice">
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="settings-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3>Cài đặt nhanh</h3>
              <button className="close-btn" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="settings-modal-body">
              <div className="setting-item">
                <label>Âm thanh</label>
                <div className="switch-wrapper">
                  <input
                    type="checkbox"
                    id="sound"
                    checked={settings.sound}
                    onChange={e => setSettings({...settings, sound: e.target.checked})}
                  />
                  <label htmlFor="sound" className="switch"></label>
                </div>
              </div>

              <div className="setting-item">
                <label>Hiệu ứng</label>
                <div className="switch-wrapper">
                  <input
                    type="checkbox"
                    id="effects"
                    checked={settings.effects}
                    onChange={e => setSettings({...settings, effects: e.target.checked})}
                  />
                  <label htmlFor="effects" className="switch"></label>
                </div>
              </div>

              <div className="setting-item">
                <label>Rung phản hồi</label>
                <div className="switch-wrapper">
                  <input
                    type="checkbox"
                    id="vibration"
                    checked={settings.vibration}
                    onChange={e => setSettings({...settings, vibration: e.target.checked})}
                  />
                  <label htmlFor="vibration" className="switch"></label>
                </div>
              </div>

              <div className="setting-item">
                <label>Âm lượng: {settings.volume}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.volume}
                  onChange={e => setSettings({...settings, volume: Number(e.target.value)})}
                  className="volume-slider"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
