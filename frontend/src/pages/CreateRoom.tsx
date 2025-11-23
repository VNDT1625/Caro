import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { joinMatchmakingQueue } from '../lib/matchmaking'

export default function CreateRoom() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'settings'>('info')
  const [showFriendsList, setShowFriendsList] = useState(false)
  const [friends, setFriends] = useState<any[]>([])
  const [selectedGuest, setSelectedGuest] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [invitedFriends, setInvitedFriends] = useState<number[]>([])
  
  const [roomInfo, setRoomInfo] = useState({
    name: '',
    hasPassword: false,
    password: '',
    accessType: 'public' as 'public' | 'friends' | 'invite',
    note: ''
  })

  const [matchSettings, setMatchSettings] = useState({
    mode: 'rank' as 'rank' | 'casual' | 'ai' | 'tournament',
    gameType: 'normal' as 'normal' | 'skill' | 'hidden' | 'terrain' | 'pair',
    aiDifficulty: 'beginner' as 'beginner' | 'expert' | 'master',
    tournamentType: 'solo' as 'solo' | 'pair',
    boardSize: '19x19' as 'infinite' | '19x19' | '15x15' | '9x9',
    winCondition: 5,
    blockRule: true,
    ban33: true,
    turnTime: 20,
    totalTime: 10,
    firstPlayer: 'random' as 'random' | 'host' | 'guest',
    timeoutRule: 'lose' as 'lose' | 'skip',
    allowSpectators: false,
    allowUndo: false,
    maxUndo: 1,
    recordMatch: true,
    toxicFilter: false
  })

  useEffect(() => {
    loadUser()
    loadFriends()
  }, [])

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
          setRoomInfo(prev => ({
            ...prev,
            name: `Phòng của ${prof.username || u.email?.split('@')[0] || 'Player'}`
          }))
        }
      }
    } catch (e) {
      console.error('Load user failed:', e)
    }
  }

  async function loadFriends() {
    try {
      // TODO: Load friends from database
      // Mock data for now
      setFriends([
        { id: 1, username: 'Player1', rank: 'Thiên Tài', mindpoint: 1200, avatar: '' },
        { id: 2, username: 'Player2', rank: 'Cao Thủ', mindpoint: 980, avatar: '' },
        { id: 3, username: 'Player3', rank: 'Kỳ Tài', mindpoint: 750, avatar: '' },
        { id: 4, username: 'Player4', rank: 'Đại Sư', mindpoint: 650, avatar: '' },
        { id: 5, username: 'Player5', rank: 'Vô Danh', mindpoint: 500, avatar: '' },
      ])
    } catch (e) {
      console.error('Load friends failed:', e)
    }
  }

  function handleToggleInvite(friendId: number) {
    setInvitedFriends(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId)
      } else {
        return [...prev, friendId]
      }
    })
  }

  function handleSelectGuest(friend: any) {
    setSelectedGuest(friend)
    setShowFriendsList(false)
    setSearchQuery('')
  }

  function handleRemoveGuest() {
    setSelectedGuest(null)
  }

  async function handleCreateRoom() {
    console.log('Creating room:', { roomInfo, matchSettings })
    
    // Check if it's matchmaking (no invited friends and not AI mode)
    const isMatchmaking = invitedFriends.length === 0 && !selectedGuest && matchSettings.mode !== 'ai'
    
    if (isMatchmaking && user?.id) {
      // Start real matchmaking
      const result = await joinMatchmakingQueue(user.id, matchSettings)
      
      if (result.success && result.queueId) {
        localStorage.setItem('matchmaking', JSON.stringify({
          active: true,
          startTime: Date.now(),
          queueId: result.queueId,
          roomInfo,
          matchSettings
        }))
        
        console.log('Joined matchmaking queue:', result.queueId)
      } else {
        alert('Không thể tham gia hàng đợi: ' + (result.error || 'Unknown error'))
        return
      }
    }
    
    // TODO: Implement room creation
    window.location.hash = 'home'
  }

  function handleClose() {
    window.location.hash = 'home'
  }

  function copyRoomLink() {
    const link = `${window.location.origin}/#room/demo123`
    navigator.clipboard.writeText(link)
    alert('Đã copy link mời!')
  }

  const isRankMode = matchSettings.mode === 'rank'
  const isAIMode = matchSettings.mode === 'ai'
  const isTournamentMode = matchSettings.mode === 'tournament'
  const isCasualMode = matchSettings.mode === 'casual'

  const filteredFriends = friends.filter(friend => 
    friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.rank.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="createroom-overlay">
      <div className="createroom-popup">
        {/* Breadcrumb Navigation */}
        <nav style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          fontSize: '12px', 
          color: 'rgba(255,255,255,0.5)',
          marginBottom: '12px',
          padding: '0 4px'
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
            Chánh Điện
        </a>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>›</span>
        <span style={{ color: '#fff' }}>Tiêu Dao</span>
      </nav>        {/* Header */}
        <div className="createroom-header">
          <h1 className="createroom-title">TẠO PHÒNG MỚI</h1>
          <button className="createroom-close" onClick={handleClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="createroom-tabs">
          <button 
            className={`createroom-tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            THÔNG TIN PHÒNG
          </button>
          <button 
            className={`createroom-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            CÀI ĐẶT TRẬN ĐẤU
          </button>
        </div>

        {/* Tab Content */}
        <div className="createroom-content">
          {activeTab === 'info' ? (
            <div className="createroom-info-grid">
              {/* Card 1: Room Info */}
              <div className="createroom-card createroom-card-info">
                <h3 className="card-heading">Thông Tin Phòng</h3>
                
                <div className="form-group">
                  <label>Tên phòng</label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder="Nhập tên phòng..."
                    value={roomInfo.name}
                    onChange={e => setRoomInfo({...roomInfo, name: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Mật khẩu</label>
                  <div className="password-group">
                    <input 
                      type="text" 
                      className="form-input form-input-small"
                      placeholder={roomInfo.hasPassword ? "Nhập mật khẩu" : "Không có mật khẩu"}
                      value={roomInfo.password}
                      onChange={e => setRoomInfo({...roomInfo, password: e.target.value})}
                      disabled={!roomInfo.hasPassword}
                    />
                    <div className="radio-inline">
                      <label className="radio-label">
                        <input 
                          type="radio" 
                          checked={!roomInfo.hasPassword}
                          onChange={() => setRoomInfo({...roomInfo, hasPassword: false, password: ''})}
                        />
                        <span>Không mật khẩu</span>
                      </label>
                      <label className="radio-label">
                        <input 
                          type="radio"
                          checked={roomInfo.hasPassword}
                          onChange={() => setRoomInfo({...roomInfo, hasPassword: true})}
                        />
                        <span>Có</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>Quyền vào</label>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input 
                        type="radio"
                        checked={roomInfo.accessType === 'public'}
                        onChange={() => setRoomInfo({...roomInfo, accessType: 'public'})}
                      />
                      <span>Public</span>
                    </label>
                    <label className="radio-label">
                      <input 
                        type="radio"
                        checked={roomInfo.accessType === 'friends'}
                        onChange={() => setRoomInfo({...roomInfo, accessType: 'friends'})}
                      />
                      <span>Bạn bè</span>
                    </label>
                    <label className="radio-label">
                      <input 
                        type="radio"
                        checked={roomInfo.accessType === 'invite'}
                        onChange={() => setRoomInfo({...roomInfo, accessType: 'invite'})}
                      />
                      <span>Chỉ mời</span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label>Ghi chú <span className="optional">(tuỳ chọn)</span></label>
                  <textarea 
                    className="form-textarea"
                    placeholder="Thêm ghi chú về phòng..."
                    value={roomInfo.note}
                    onChange={e => setRoomInfo({...roomInfo, note: e.target.value})}
                    rows={3}
                  />
                </div>
              </div>

              {/* Card 2: Host & Players */}
              <div className="createroom-card createroom-card-players">
                <h3 className="card-heading">Chủ Phòng & Người Chơi</h3>
                
                <div className="host-info">
                  <div className="host-label">Chủ phòng</div>
                  <div className="host-profile">
                    <div className="host-avatar" />
                    <div className="host-details">
                      <div className="host-name">{profile?.username || user?.email || 'Player'}</div>
                      <div className="host-stats">Rank: {profile?.current_rank || 'Vô Danh'}, MP: {profile?.mindpoint || 0}</div>
                    </div>
                  </div>
                </div>

                <div className="player-slots">
                  <div className="slot-label">Slot người chơi</div>
                  <div className="player-slot filled">
                    <div className="slot-avatar" />
                    <div className="slot-info">
                      <div className="slot-side">Bên X:</div>
                      <div className="slot-name">{profile?.username || 'Bạn'} <span className="you-tag">(Bạn)</span></div>
                    </div>
                  </div>
                  <div className="player-slot empty">
                    {selectedGuest ? (
                      <div className="player-slot filled">
                        <div className="slot-avatar" />
                        <div className="slot-info">
                          <div className="slot-side">Bên O:</div>
                          <div className="slot-name">{selectedGuest.username}</div>
                        </div>
                        <button className="slot-remove-btn" onClick={handleRemoveGuest} title="Xóa">✕</button>
                      </div>
                    ) : (
                      <>
                        <div className="slot-skeleton" />
                        <div className="slot-info">
                          <div className="slot-side">Bên O:</div>
                          <div className="slot-waiting">Chờ người chơi...</div>
                        </div>
                        <button className="slot-add-btn" onClick={() => setShowFriendsList(true)} title="Mời bạn bè">+</button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 3: Link & Summary */}
              <div className="createroom-card createroom-card-summary">
                <div className="invite-section">
                  <label>Link mời nhanh</label>
                  <div className="invite-link-group">
                    <input 
                      type="text" 
                      className="form-input"
                      value={`${window.location.origin}/#room/demo123`}
                      readOnly
                    />
                    <button className="copy-btn" onClick={copyRoomLink}>Copy</button>
                  </div>
                </div>

                <div className="summary-section">
                  <div className="summary-header">
                    <h4>TÓM TẮT CÀI ĐẶT TRẬN</h4>
                    <button className="edit-settings-link" onClick={() => setActiveTab('settings')}>
                      Chỉnh cài đặt trận →
                    </button>
                  </div>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span className="summary-label">Chế độ:</span>
                      <span className="summary-value">
                        {matchSettings.mode === 'rank' ? 'Rank' : 
                         matchSettings.mode === 'casual' ? 'Giải trí' :
                         matchSettings.mode === 'ai' ? 'Đánh với AI' : 'Giải đấu'}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Kiểu chơi:</span>
                      <span className="summary-value">
                        {matchSettings.gameType === 'normal' ? 'Normal' :
                         matchSettings.gameType === 'skill' ? 'Caro Skill' :
                         matchSettings.gameType === 'hidden' ? 'Caro Ẩn' :
                         matchSettings.gameType === 'terrain' ? 'Caro Địa Hình' : 'Caro theo cặp'}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Bàn cờ:</span>
                      <span className="summary-value">
                        {matchSettings.mode === 'rank' ? '19x19' : 
                         matchSettings.boardSize === 'infinite' ? 'Vô hạn' : matchSettings.boardSize}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Thắng khi:</span>
                      <span className="summary-value">{matchSettings.winCondition} quân</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Luật chặn:</span>
                      <span className="summary-value">{matchSettings.blockRule ? 'ON' : 'OFF'}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Cấm 3–3:</span>
                      <span className="summary-value">{matchSettings.ban33 ? 'ON' : 'OFF'}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Thời gian:</span>
                      <span className="summary-value">{matchSettings.turnTime}s / lượt, {matchSettings.totalTime}' / ván</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="createroom-settings-grid">
              {/* Card A: Mode & Type */}
              <div className="createroom-card">
                <h3 className="card-heading">Chế Độ & Kiểu Chơi</h3>
                
                <div className="form-group">
                  <label>Chế độ chính</label>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input 
                        type="radio"
                        checked={matchSettings.mode === 'rank'}
                        onChange={() => setMatchSettings({...matchSettings, mode: 'rank'})}
                      />
                      <span>Rank</span>
                    </label>
                    <label className="radio-label">
                      <input 
                        type="radio"
                        checked={matchSettings.mode === 'casual'}
                        onChange={() => setMatchSettings({...matchSettings, mode: 'casual'})}
                      />
                      <span>Giải trí</span>
                    </label>
                    <label className="radio-label">
                      <input 
                        type="radio"
                        checked={matchSettings.mode === 'ai'}
                        onChange={() => setMatchSettings({...matchSettings, mode: 'ai'})}
                      />
                      <span>Đánh với AI</span>
                    </label>
                    <label className="radio-label">
                      <input 
                        type="radio"
                        checked={matchSettings.mode === 'tournament'}
                        onChange={() => setMatchSettings({...matchSettings, mode: 'tournament'})}
                      />
                      <span>Giải đấu</span>
                    </label>
                  </div>
                </div>

                {isRankMode && (
                  <div className="mode-info">
                    <p className="info-text">⚡ Luật rank chuẩn, auto, không chỉnh được.</p>
                    <p className="info-text">✓ Tính điểm: <strong>BẬT</strong></p>
                    <p className="info-text">🎯 Giới hạn rank ghép: Vô Danh – Vô Đối</p>
                  </div>
                )}

                {isCasualMode && (
                  <div className="form-group">
                    <label>Kiểu chơi</label>
                    <div className="radio-group">
                      <label className="radio-label">
                        <input 
                          type="radio"
                          checked={matchSettings.gameType === 'normal'}
                          onChange={() => setMatchSettings({...matchSettings, gameType: 'normal'})}
                        />
                        <span>Normal</span>
                      </label>
                      <label className="radio-label">
                        <input 
                          type="radio"
                          checked={matchSettings.gameType === 'skill'}
                          onChange={() => setMatchSettings({...matchSettings, gameType: 'skill'})}
                        />
                        <span>Caro Skill</span>
                      </label>
                      <label className="radio-label">
                        <input 
                          type="radio"
                          checked={matchSettings.gameType === 'hidden'}
                          onChange={() => setMatchSettings({...matchSettings, gameType: 'hidden'})}
                        />
                        <span>Caro Ẩn</span>
                      </label>
                      <label className="radio-label">
                        <input 
                          type="radio"
                          checked={matchSettings.gameType === 'terrain'}
                          onChange={() => setMatchSettings({...matchSettings, gameType: 'terrain'})}
                        />
                        <span>Caro Địa Hình</span>
                      </label>
                      <label className="radio-label">
                        <input 
                          type="radio"
                          checked={matchSettings.gameType === 'pair'}
                          onChange={() => setMatchSettings({...matchSettings, gameType: 'pair'})}
                        />
                        <span>Caro theo cặp</span>
                      </label>
                    </div>
                  </div>
                )}

                {isAIMode && (
                  <>
                    <p className="info-text">🤖 Kiểu chơi: Normal (cố định)</p>
                    <div className="form-group">
                      <label>Độ khó</label>
                      <div className="radio-group">
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.aiDifficulty === 'beginner'}
                            onChange={() => setMatchSettings({...matchSettings, aiDifficulty: 'beginner'})}
                          />
                          <span>Nhập Môn</span>
                        </label>
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.aiDifficulty === 'expert'}
                            onChange={() => setMatchSettings({...matchSettings, aiDifficulty: 'expert'})}
                          />
                          <span>Kỳ Tài</span>
                        </label>
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.aiDifficulty === 'master'}
                            onChange={() => setMatchSettings({...matchSettings, aiDifficulty: 'master'})}
                          />
                          <span>Nghịch Thiện</span>
                        </label>
                      </div>
                    </div>
                    <p className="hint-text">💡 Luật auto theo độ khó, không chỉnh chi tiết.</p>
                  </>
                )}

                {isTournamentMode && (
                  <>
                    <div className="form-group">
                      <label>Kiểu đấu</label>
                      <div className="radio-group">
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.tournamentType === 'solo'}
                            onChange={() => setMatchSettings({...matchSettings, tournamentType: 'solo'})}
                          />
                          <span>Solo 1v1</span>
                        </label>
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.tournamentType === 'pair'}
                            onChange={() => setMatchSettings({...matchSettings, tournamentType: 'pair'})}
                          />
                          <span>Theo cặp</span>
                        </label>
                      </div>
                    </div>
                    <p className="hint-text">⚙️ Chỉ chủ phòng/BTC chỉnh luật.</p>
                  </>
                )}
              </div>

              {/* Card B: Board & Rules */}
              <div className={`createroom-card ${isRankMode || isAIMode ? 'readonly' : ''}`}>
                <h3 className="card-heading">Bàn Cờ & Luật Thắng</h3>
                
                {isRankMode && (
                  <div className="readonly-info">
                    <div className="info-row">
                      <span>Kích thước:</span>
                      <strong>19x19</strong>
                    </div>
                    <div className="info-row">
                      <span>Thắng khi:</span>
                      <strong>5 quân</strong>
                    </div>
                    <div className="info-row">
                      <span>Luật chặn:</span>
                      <strong>Bật</strong>
                    </div>
                    <div className="info-row">
                      <span>Cấm 3–3:</span>
                      <strong>Bật</strong>
                    </div>
                  </div>
                )}

                {isCasualMode && (
                  <>
                    <div className="form-group">
                      <label>Kích thước bàn</label>
                      <div className="radio-group">
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.boardSize === 'infinite'}
                            onChange={() => setMatchSettings({...matchSettings, boardSize: 'infinite'})}
                          />
                          <span>Vô hạn</span>
                        </label>
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.boardSize === '15x15'}
                            onChange={() => setMatchSettings({...matchSettings, boardSize: '15x15'})}
                          />
                          <span>15x15</span>
                        </label>
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.boardSize === '9x9'}
                            onChange={() => setMatchSettings({...matchSettings, boardSize: '9x9'})}
                          />
                          <span>9x9</span>
                        </label>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Thắng khi</label>
                      <select 
                        className="form-select"
                        value={matchSettings.winCondition}
                        onChange={e => setMatchSettings({...matchSettings, winCondition: Number(e.target.value)})}
                      >
                        <option value={3}>3 quân</option>
                        <option value={4}>4 quân</option>
                        <option value={5}>5 quân</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="checkbox-label">
                        <input 
                          type="checkbox"
                          checked={matchSettings.blockRule}
                          onChange={e => setMatchSettings({...matchSettings, blockRule: e.target.checked})}
                        />
                        <span>Luật chặn</span>
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="checkbox-label">
                        <input 
                          type="checkbox"
                          checked={matchSettings.ban33}
                          onChange={e => setMatchSettings({...matchSettings, ban33: e.target.checked})}
                        />
                        <span>Cấm 3–3</span>
                      </label>
                    </div>
                  </>
                )}

                {isAIMode && (
                  <div className="readonly-info">
                    <div className="info-row">
                      <span>Nhập Môn:</span>
                      <strong>15x15, thắng 5, luật cơ bản</strong>
                    </div>
                    <div className="info-row">
                      <span>Kỳ Tài:</span>
                      <strong>15x15/vô hạn, thắng 5, chặn + 3–3</strong>
                    </div>
                    <div className="info-row">
                      <span>Nghịch Thiện:</span>
                      <strong>Vô hạn, thắng 5, chặn + 3–3</strong>
                    </div>
                  </div>
                )}

                {isTournamentMode && (
                  <>
                    <div className="form-group">
                      <label>Kích thước bàn</label>
                      <div className="radio-group">
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.boardSize === 'infinite'}
                            onChange={() => setMatchSettings({...matchSettings, boardSize: 'infinite'})}
                          />
                          <span>Vô hạn</span>
                        </label>
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.boardSize === '15x15'}
                            onChange={() => setMatchSettings({...matchSettings, boardSize: '15x15'})}
                          />
                          <span>15x15</span>
                        </label>
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.boardSize === '9x9'}
                            onChange={() => setMatchSettings({...matchSettings, boardSize: '9x9'})}
                          />
                          <span>9x9</span>
                        </label>
                      </div>
                    </div>
                    <p className="hint-text">🎮 Chỉ host/BTC được chỉnh</p>
                  </>
                )}
              </div>

              {/* Card C: Time & Turns */}
              <div className={`createroom-card ${isRankMode || isAIMode ? 'readonly' : ''}`}>
                <h3 className="card-heading">Thời Gian & Lượt Đi</h3>
                
                {isRankMode && (
                  <div className="readonly-info">
                    <div className="info-row">
                      <span>Thời gian lượt:</span>
                      <strong>20s</strong>
                    </div>
                    <div className="info-row">
                      <span>Thời gian tổng:</span>
                      <strong>10'</strong>
                    </div>
                    <div className="info-row">
                      <span>Người đi trước:</span>
                      <strong>Ngẫu nhiên</strong>
                    </div>
                    <div className="info-row">
                      <span>Hết giờ:</span>
                      <strong>Tự thua</strong>
                    </div>
                  </div>
                )}

                {isCasualMode && (
                  <>
                    <div className="form-group">
                      <label>Thời gian mỗi lượt</label>
                      <select 
                        className="form-select"
                        value={matchSettings.turnTime}
                        onChange={e => setMatchSettings({...matchSettings, turnTime: Number(e.target.value)})}
                      >
                        <option value={10}>10 giây</option>
                        <option value={20}>20 giây</option>
                        <option value={30}>30 giây</option>
                        <option value={60}>60 giây</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Thời gian tổng</label>
                      <select 
                        className="form-select"
                        value={matchSettings.totalTime}
                        onChange={e => setMatchSettings({...matchSettings, totalTime: Number(e.target.value)})}
                      >
                        <option value={5}>5 phút</option>
                        <option value={10}>10 phút</option>
                        <option value={15}>15 phút</option>
                        <option value={20}>20 phút</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Người đi trước</label>
                      <div className="radio-group">
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.firstPlayer === 'random'}
                            onChange={() => setMatchSettings({...matchSettings, firstPlayer: 'random'})}
                          />
                          <span>Ngẫu nhiên</span>
                        </label>
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.firstPlayer === 'host'}
                            onChange={() => setMatchSettings({...matchSettings, firstPlayer: 'host'})}
                          />
                          <span>Chủ phòng</span>
                        </label>
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.firstPlayer === 'guest'}
                            onChange={() => setMatchSettings({...matchSettings, firstPlayer: 'guest'})}
                          />
                          <span>Khách</span>
                        </label>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Hết giờ</label>
                      <div className="radio-group">
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.timeoutRule === 'lose'}
                            onChange={() => setMatchSettings({...matchSettings, timeoutRule: 'lose'})}
                          />
                          <span>Tự thua</span>
                        </label>
                        <label className="radio-label">
                          <input 
                            type="radio"
                            checked={matchSettings.timeoutRule === 'skip'}
                            onChange={() => setMatchSettings({...matchSettings, timeoutRule: 'skip'})}
                          />
                          <span>Bỏ lượt</span>
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {isAIMode && (
                  <div className="readonly-info">
                    <div className="info-row">
                      <span>Nhập Môn:</span>
                      <strong>Thời gian thoải mái</strong>
                    </div>
                    <div className="info-row">
                      <span>Kỳ Tài / Nghịch Thiện:</span>
                      <strong>Thời gian gắt hơn</strong>
                    </div>
                  </div>
                )}

                {isTournamentMode && (
                  <>
                    <div className="form-group">
                      <label>Thời gian mỗi lượt</label>
                      <select 
                        className="form-select"
                        value={matchSettings.turnTime}
                        onChange={e => setMatchSettings({...matchSettings, turnTime: Number(e.target.value)})}
                      >
                        <option value={10}>10 giây</option>
                        <option value={20}>20 giây</option>
                        <option value={30}>30 giây</option>
                        <option value={60}>60 giây</option>
                      </select>
                    </div>
                    <p className="hint-text">🎮 Chỉ host/BTC chỉnh</p>
                  </>
                )}
              </div>

              {/* Card D: Advanced Options */}
              <div className={`createroom-card ${isRankMode ? 'readonly' : ''}`}>
                <h3 className="card-heading">Tùy Chọn Nâng Cao</h3>
                
                {isRankMode && (
                  <div className="readonly-info">
                    <div className="checkbox-item">
                      <input type="checkbox" checked disabled />
                      <span>Ghi lại ván đấu</span>
                    </div>
                    <div className="checkbox-item">
                      <input type="checkbox" checked disabled />
                      <span>Chặn chat độc hại cơ bản</span>
                    </div>
                    <div className="checkbox-item">
                      <input type="checkbox" disabled />
                      <span>Xin đi lại (bị khoá)</span>
                    </div>
                  </div>
                )}

                {isCasualMode && (
                  <>
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input 
                          type="checkbox"
                          checked={matchSettings.allowSpectators}
                          onChange={e => setMatchSettings({...matchSettings, allowSpectators: e.target.checked})}
                        />
                        <span>Cho phép khán giả</span>
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="checkbox-label">
                        <input 
                          type="checkbox"
                          checked={matchSettings.allowUndo}
                          onChange={e => setMatchSettings({...matchSettings, allowUndo: e.target.checked})}
                        />
                        <span>Cho phép xin đi lại tối đa</span>
                      </label>
                      {matchSettings.allowUndo && (
                        <input 
                          type="number"
                          className="form-input-inline"
                          min={1}
                          max={5}
                          value={matchSettings.maxUndo}
                          onChange={e => setMatchSettings({...matchSettings, maxUndo: Number(e.target.value)})}
                        />
                      )}
                      <span className="inline-text">lần / ván</span>
                    </div>

                    <div className="form-group">
                      <label className="checkbox-label">
                        <input 
                          type="checkbox"
                          checked={matchSettings.recordMatch}
                          onChange={e => setMatchSettings({...matchSettings, recordMatch: e.target.checked})}
                        />
                        <span>Ghi lại ván đấu</span>
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="checkbox-label">
                        <input 
                          type="checkbox"
                          checked={matchSettings.toxicFilter}
                          onChange={e => setMatchSettings({...matchSettings, toxicFilter: e.target.checked})}
                        />
                        <span>Chặn chat độc hại nâng cao</span>
                      </label>
                    </div>
                  </>
                )}

                {isAIMode && (
                  <div className="readonly-info">
                    <div className="checkbox-item">
                      <input type="checkbox" checked disabled />
                      <span>Ghi lại ván đấu (optional)</span>
                    </div>
                    <div className="checkbox-item">
                      <input type="checkbox" disabled />
                      <span>Xin đi lại (tuỳ design)</span>
                    </div>
                  </div>
                )}

                {isTournamentMode && (
                  <>
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input 
                          type="checkbox"
                          checked={matchSettings.allowSpectators}
                          onChange={e => setMatchSettings({...matchSettings, allowSpectators: e.target.checked})}
                        />
                        <span>Cho phép khán giả</span>
                      </label>
                    </div>
                    <p className="hint-text">🎮 BTC quyết định</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="createroom-footer">
          {activeTab === 'settings' && (
            <button className="btn-secondary" onClick={() => setActiveTab('info')}>
              ← Quay lại tab THÔNG TIN PHÒNG
            </button>
          )}
          {activeTab === 'info' && (
            <button className="btn-secondary" onClick={handleClose}>
              HỦY
            </button>
          )}
          <button className="btn-primary" onClick={activeTab === 'settings' ? () => setActiveTab('info') : handleCreateRoom}>
            {activeTab === 'settings' ? 'LƯU CÀI ĐẶT' : 'TẠO PHÒNG NGAY'}
          </button>
        </div>
      </div>

      {/* Friends Popup */}
      {showFriendsList && (
        <div className="friends-popup-overlay" onClick={() => setShowFriendsList(false)}>
          <div className="friends-popup" onClick={(e) => e.stopPropagation()}>
            <div className="friends-popup-header">
              <h3>Chọn bạn bè</h3>
              <button className="friends-popup-close" onClick={() => setShowFriendsList(false)}>✕</button>
            </div>
            
            <div className="friends-search-bar">
              <input 
                type="text" 
                className="friends-search-input"
                placeholder="Tìm kiếm bạn bè..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="friends-popup-content">
              {filteredFriends.length > 0 ? (
                filteredFriends.map(friend => {
                  const isInvited = invitedFriends.includes(friend.id)
                  return (
                    <div 
                      key={friend.id} 
                      className={`friend-item ${isInvited ? 'invited' : ''}`}
                    >
                      <div className="friend-avatar" />
                      <div className="friend-info" onClick={() => handleSelectGuest(friend)}>
                        <div className="friend-name">{friend.username}</div>
                        <div className="friend-stats">{friend.rank}, MP: {friend.mindpoint}</div>
                      </div>
                      <button 
                        className={`friend-invite-btn ${isInvited ? 'invited' : ''}`}
                        onClick={() => handleToggleInvite(friend.id)}
                      >
                        {isInvited ? '✓ Đã mời' : 'Mời'}
                      </button>
                    </div>
                  )
                })
              ) : (
                <div className="no-friends">
                  {searchQuery ? 'Không tìm thấy bạn bè' : 'Chưa có bạn bè'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
