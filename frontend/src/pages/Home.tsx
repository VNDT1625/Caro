import React from 'react'
import { joinMatchmakingQueue, findMatch, cancelMatchmaking, subscribeToMatchmaking, MatchmakingSettings } from '../lib/matchmaking'
import { supabase } from '../lib/supabase'
import { TrainingDifficulty, describeDifficulty } from '../lib/game/botAI'
import { useFriendSystem } from '../hooks/useFriendSystem'
import ChatPanel from '../components/chat/ChatPanel'

interface HomeProps {
  mobileMenuOpen?: boolean
  onCloseMobileMenu?: () => void
  user?: any
  rank?: string
}

type FriendPanelFilter = 'all' | 'online' | 'incoming' | 'outgoing'

interface FeaturedEvent {
  id: string
  title: string
  subtitle: string
  chip: string
  highlight: string
  timeline: string
  reward: string
  accent: string
  artwork: string
  ctaLabel: string
  ctaHref: string
}

const FEATURED_EVENTS: FeaturedEvent[] = [
  {
    id: 'thien-co-bien',
    title: 'Thiên Cơ Biến',
    subtitle: 'Leo tháp MindPoint với 5 tầng thử thách tăng dần',
    chip: 'Biến số thời gian',
    highlight: 'Nhận x2 MindPoint khi hoàn tất trước 24h',
    timeline: '22 – 24 / 11',
    reward: '+500 MindPoint • Huy hiệu Thiên Cơ',
    accent: '#34d399',
    artwork: 'url(/event-thien-co-bien.svg)',
    ctaLabel: 'Chi tiết sự kiện',
    ctaHref: '#events'
  },
  {
    id: 'lua-trai-dai-hoi',
    title: 'Lửa Trại Đại Hội',
    subtitle: 'Tổ đội 3 người đi săn dấu ấn để mở rương cộng đồng',
    chip: 'Đoàn kết',
    highlight: 'Quỹ thưởng chung tăng 5% mỗi 1.000 dấu ấn',
    timeline: '25 / 11 – 1 / 12',
    reward: 'Skin bàn Nguyệt Dạ + 800 Coin',
    accent: '#f472b6',
    artwork: 'url(/event-lua-trai.svg)',
    ctaLabel: 'Tham gia ngay',
    ctaHref: '#events'
  },
  {
    id: 'tuyet-dinh-song-dau',
    title: 'Tuyệt Đỉnh Song Đấu',
    subtitle: 'Đấu đôi 2v2 với cơ chế chia sẻ MindPoint',
    chip: 'Song đấu',
    highlight: 'Champion duo nhận danh hiệu Truyền Thuyết',
    timeline: 'Mỗi tối 20h - 22h',
    reward: 'Ngọc Hỏa Phượng + Vé Thí Luyện',
    accent: '#a78bfa',
    artwork: 'url(/event-song-dau.svg)',
    ctaLabel: 'Xếp cặp đấu',
    ctaHref: '#events'
  }
]

export default function Home({ mobileMenuOpen, onCloseMobileMenu, user, rank }: HomeProps = {}) {
  const [activeTab, setActiveTab] = React.useState<'friends' | 'chat' | 'info'>('friends')
  const [showSocialPopup, setShowSocialPopup] = React.useState(false)
  const [matchmaking, setMatchmaking] = React.useState<any>(null)
  const [matchmakingTime, setMatchmakingTime] = React.useState(0)
  const [matchFound, setMatchFound] = React.useState(false)
  const [readyTime, setReadyTime] = React.useState(10)
  const [queueId, setQueueId] = React.useState<string | null>(null)
  const [opponent, setOpponent] = React.useState<any>(null)
  const [roomId, setRoomId] = React.useState<string | null>(null)
  const [popupPosition, setPopupPosition] = React.useState({ 
    x: typeof window !== 'undefined' ? window.innerWidth - 336 : 0, 
    y: typeof window !== 'undefined' ? (window.innerHeight - 400) / 2 : 50 
  })
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 })
  const [showUsernamePrompt, setShowUsernamePrompt] = React.useState(false)
  const [usernameInput, setUsernameInput] = React.useState('')
  const [isReady, setIsReady] = React.useState(false)
  const [opponentReady, setOpponentReady] = React.useState(false)
  const [opponentDeclined, setOpponentDeclined] = React.useState(false)
  const [showTrainingModal, setShowTrainingModal] = React.useState(false)
  const [trainingDifficulty, setTrainingDifficulty] = React.useState<TrainingDifficulty>('nhap-mon')
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    friendCount,
    loading: friendsLoading,
    isMutating: friendsMutating,
    lastError: friendError,
    clearError: clearFriendError,
    searchResults,
    refresh: refreshFriends,
    searchProfiles,
    sendFriendRequest,
    respondToRequest,
    removeFriend,
    blockUser
  } = useFriendSystem(user?.id)
  const [friendFilter, setFriendFilter] = React.useState<FriendPanelFilter>('all')
  const [friendSearch, setFriendSearch] = React.useState('')
  const [searchingFriends, setSearchingFriends] = React.useState(false)
  const [activeEvent, setActiveEvent] = React.useState(0)
  const eventAutoplayRef = React.useRef<number | null>(null)
  const eventPointerStart = React.useRef<number | null>(null)
  const totalEvents = FEATURED_EVENTS.length

  const userDisplayName = React.useMemo(() => {
    return (
      user?.user_metadata?.name ||
      user?.user_metadata?.full_name ||
      user?.email ||
      'Đạo hữu'
    )
  }, [user])

  const trainingDifficultyOrder: TrainingDifficulty[] = ['nhap-mon', 'ky-tai', 'nghich-thien', 'thien-ton', 'hu-vo']

  const trainingBotProfiles: Record<TrainingDifficulty, { title: string; caption: string; emoji: string }> = {
    'nhap-mon': {
      title: 'Nhập Môn',
      caption: 'Lối chơi phòng thủ, phù hợp làm quen.',
      emoji: '🛡️'
    },
    'ky-tai': {
      title: 'Kỳ Tài',
      caption: 'Chiến thuật cân bằng công thủ.',
      emoji: '⚖️'
    },
    'nghich-thien': {
      title: 'Nghịch Thiên',
      caption: 'Siêu tấn công, luôn chủ động ép bạn.',
      emoji: '🔥'
    },
    'thien-ton': {
      title: 'Thiên Tôn',
      caption: 'Đọc trước 2 nước, ưu tiên đòn kép.',
      emoji: '⚡'
    },
    'hu-vo': {
      title: 'Hư Vô',
      caption: 'AI cấp cao mô phỏng chiến thuật sâu.',
      emoji: '🌀'
    }
  }

  const trainingLevelLabels: Record<TrainingDifficulty, string> = {
    'nhap-mon': 'Dễ',
    'ky-tai': 'Trung bình',
    'nghich-thien': 'Khó',
    'thien-ton': 'Rất khó',
    'hu-vo': 'Bá chủ'
  }

  const startEventAutoplay = React.useCallback(() => {
    if (eventAutoplayRef.current !== null) {
      window.clearInterval(eventAutoplayRef.current)
    }
    if (totalEvents <= 1) return
    eventAutoplayRef.current = window.setInterval(() => {
      setActiveEvent(prev => (prev + 1) % totalEvents)
    }, 6500)
  }, [totalEvents])

  const handleEventDirection = React.useCallback((direction: number) => {
    if (!totalEvents) return
    setActiveEvent(prev => {
      const next = (prev + direction + totalEvents) % totalEvents
      return next
    })
    startEventAutoplay()
  }, [startEventAutoplay, totalEvents])

  const handleEventDotClick = React.useCallback((index: number) => {
    if (index === activeEvent) return
    setActiveEvent(index)
    startEventAutoplay()
  }, [activeEvent, startEventAutoplay])

  const handleEventPointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    eventPointerStart.current = e.clientX
  }, [])

  const handleEventPointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (eventPointerStart.current === null) return
    const deltaX = e.clientX - eventPointerStart.current
    if (Math.abs(deltaX) > 45) {
      handleEventDirection(deltaX > 0 ? -1 : 1)
    }
    eventPointerStart.current = null
  }, [handleEventDirection])

  const handleEventPointerLeave = React.useCallback(() => {
    eventPointerStart.current = null
  }, [])

  React.useEffect(() => {
    startEventAutoplay()
    return () => {
      if (eventAutoplayRef.current !== null) {
        window.clearInterval(eventAutoplayRef.current)
      }
    }
  }, [startEventAutoplay])

  const currentEventIndex = totalEvents ? ((activeEvent % totalEvents) + totalEvents) % totalEvents : 0
  const currentEvent = totalEvents ? FEATURED_EVENTS[currentEventIndex] : null

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true)
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setDragStart({ x: clientX - popupPosition.x, y: clientY - popupPosition.y })
  }

  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setPopupPosition({
      x: Math.max(0, Math.min(window.innerWidth - 320, clientX - dragStart.x)),
      y: Math.max(0, Math.min(window.innerHeight - 400, clientY - dragStart.y))
    })
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  const onlineFriendCount = React.useMemo(
    () => friends.filter((entry) => entry.profile?.is_online).length,
    [friends]
  )

  const filteredFriends = React.useMemo(() => {
    if (friendFilter === 'incoming') return incomingRequests
    if (friendFilter === 'outgoing') return outgoingRequests
    if (friendFilter === 'online') {
      return friends.filter((entry) => entry.profile?.is_online)
    }
    return friends
  }, [friendFilter, friends, incomingRequests, outgoingRequests])

  const formatLastSeen = (timestamp?: string | null) => {
    if (!timestamp) return 'Ẩn thân'
    const parsed = Date.parse(timestamp)
    if (!Number.isFinite(parsed)) return 'Ẩn thân'
    const diff = Date.now() - parsed
    if (diff < 60_000) return 'Vừa xong'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`
    return `${Math.floor(diff / 86_400_000)} ngày trước`
  }

  const showSearchResults = friendSearch.trim().length > 0

  React.useEffect(() => {
    if (!friendSearch.trim()) {
      setSearchingFriends(false)
      return
    }
    setSearchingFriends(true)
    const handle = window.setTimeout(() => {
      searchProfiles(friendSearch)
        .catch(() => {})
        .finally(() => setSearchingFriends(false))
    }, 350)

    return () => {
      window.clearTimeout(handle)
    }
  }, [friendSearch, searchProfiles])

  const handleChallengeFriend = (friendId: string) => {
    if (!friendId) return
    window.location.hash = `createroom?with=${friendId}`
  }

  const renderFriendsPanel = () => {
    const emptyStateCopy = {
      all: 'Bạn chưa có đạo hữu nào. Hãy kết nghĩa để leo rank cùng nhau!',
      online: 'Không có đạo hữu nào đang online.',
      incoming: 'Chưa có lời mời nào. Hãy lan truyền danh tiếng của bạn!',
      outgoing: 'Bạn chưa gửi lời mời nào.'
    } as Record<FriendPanelFilter, string>

    return (
      <div className="friends-tab">
        <div className="friend-header">
          <div>
            <div className="friend-title">Đạo Hữu</div>
            <div className="friend-meta">
              {friendCount} kết nối · {onlineFriendCount} đang online
            </div>
          </div>
          <button
            className="ghost-btn"
            onClick={() => refreshFriends()}
            disabled={friendsLoading}
          >
            {friendsLoading ? 'Đang tải…' : '↻ Làm mới'}
          </button>
        </div>

        {friendError && (
          <div className="friend-error" role="alert">
            <span>{friendError}</span>
            <button className="ghost-btn" onClick={() => clearFriendError()} aria-label="Đóng">
              ×
            </button>
          </div>
        )}

        <div className="friend-search">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            placeholder="Tìm đạo hữu theo username hoặc danh xưng…"
            value={friendSearch}
            onChange={(e) => setFriendSearch(e.target.value)}
          />
        </div>

        {showSearchResults && (
          <div className="friend-search-results">
            {searchingFriends && <div className="friend-placeholder">Đang tìm kiếm…</div>}
            {!searchingFriends && searchResults.length === 0 && (
              <div className="friend-placeholder">Không tìm thấy đạo hữu phù hợp.</div>
            )}
            {!searchingFriends && searchResults.map((result) => {
              const displayName = result.profile.display_name || result.profile.username || 'Ẩn danh'
              const presence = result.profile.is_online
                ? 'Đang online'
                : `Offline · ${formatLastSeen(result.profile.last_active)}`
              const normalized = (result.status || '').toLowerCase()
              const targetUsername = result.profile.username

              let actionNode: React.ReactNode = null
              if (!normalized) {
                actionNode = (
                  <button
                    className="invite-btn"
                    disabled={!targetUsername || friendsMutating}
                    onClick={() => targetUsername && sendFriendRequest(targetUsername)}
                  >
                    Kết bạn
                  </button>
                )
              } else if (normalized === 'accepted') {
                actionNode = <span className="friend-chip">Đã kết nghĩa</span>
              } else if (normalized === 'pending') {
                actionNode = <span className="friend-chip">Đang chờ phản hồi</span>
              } else if (normalized === 'blocked') {
                actionNode = <span className="friend-chip">Đang bị chặn</span>
              } else {
                actionNode = <span className="friend-chip">{normalized}</span>
              }

              return (
                <div className="friend-item" key={result.profile.user_id}>
                  <div className="friend-avatar" aria-hidden="true"></div>
                  <div className="friend-info">
                    <div className="friend-name">{displayName}</div>
                    <div className="friend-status">{presence}</div>
                  </div>
                  <div className="friend-actions">{actionNode}</div>
                </div>
              )
            })}
          </div>
        )}

        <div className="friend-filters">
          {([
            { key: 'all', label: 'Tất cả', count: friendCount },
            { key: 'online', label: 'Đang online', count: onlineFriendCount },
            { key: 'incoming', label: 'Lời mời đến', count: incomingRequests.length },
            { key: 'outgoing', label: 'Đã gửi', count: outgoingRequests.length }
          ] as Array<{ key: FriendPanelFilter; label: string; count: number }>).map((filter) => (
            <button
              key={filter.key}
              className={`filter-chip ${friendFilter === filter.key ? 'active' : ''}`}
              onClick={() => setFriendFilter(filter.key)}
            >
              {filter.label}
              {filter.count > 0 && <span className="chip-count">{filter.count}</span>}
            </button>
          ))}
        </div>

        <div className="friend-list">
          {friendsLoading && filteredFriends.length === 0 ? (
            <div className="friend-placeholder">Đang tải danh sách đạo hữu…</div>
          ) : filteredFriends.length === 0 ? (
            <div className="friend-placeholder">{emptyStateCopy[friendFilter]}</div>
          ) : (
            filteredFriends.map((entry) => {
              const displayName = entry.profile?.display_name || entry.profile?.username || 'Ẩn danh'
              const presence = entry.profile?.is_online
                ? 'Đang online'
                : `Offline · ${formatLastSeen(entry.profile?.last_active)}`
              const isIncomingView = friendFilter === 'incoming'
              const isOutgoingView = friendFilter === 'outgoing'

              return (
                <div className="friend-item" key={entry.id}>
                  <div className="friend-avatar" aria-hidden="true"></div>
                  <div className="friend-info">
                    <div className="friend-name">{displayName}</div>
                    <div className="friend-status">
                      {isIncomingView
                        ? 'Chờ bạn phản hồi'
                        : isOutgoingView
                        ? 'Đang chờ đối phương'
                        : presence}
                    </div>
                  </div>
                  <div className="friend-actions">
                    {isIncomingView ? (
                      <>
                        <button
                          className="invite-btn"
                          disabled={friendsMutating}
                          onClick={() => respondToRequest(entry.id, 'accept')}
                        >
                          Chấp nhận
                        </button>
                        <button
                          className="ghost-btn"
                          disabled={friendsMutating}
                          onClick={() => respondToRequest(entry.id, 'reject')}
                        >
                          Từ chối
                        </button>
                      </>
                    ) : isOutgoingView ? (
                      <button
                        className="ghost-btn"
                        disabled={friendsMutating}
                        onClick={() => removeFriend(entry.friend_id)}
                      >
                        Hủy lời mời
                      </button>
                    ) : (
                      <>
                        <button
                          className="invite-btn"
                          disabled={friendsMutating}
                          onClick={() => handleChallengeFriend(entry.friend_id)}
                        >
                          Mời đấu
                        </button>
                        <button
                          className="ghost-btn"
                          disabled={friendsMutating}
                          onClick={() => removeFriend(entry.friend_id)}
                        >
                          Gỡ đạo hữu
                        </button>
                        <button
                          className="icon-btn"
                          disabled={friendsMutating}
                          title="Chặn đạo hữu"
                          onClick={() => blockUser(entry.friend_id)}
                        >
                          ⛔
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  React.useEffect(() => {
    if (isDragging) {
      const handleMove = (e: MouseEvent | TouchEvent) => handleDragMove(e)
      const handleEnd = () => handleDragEnd()
      
      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleEnd)
      window.addEventListener('touchmove', handleMove)
      window.addEventListener('touchend', handleEnd)
      return () => {
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleEnd)
        window.removeEventListener('touchmove', handleMove)
        window.removeEventListener('touchend', handleEnd)
      }
    }
  }, [isDragging, dragStart.x, dragStart.y])

  React.useEffect(() => {
    // Check for matchmaking status from localStorage (for page refresh)
    const checkMatchmaking = () => {
      const mm = localStorage.getItem('matchmaking')
      if (mm) {
        const data = JSON.parse(mm)
        if (data.active && data.queueId) {
          setMatchmaking(data)
          setQueueId(data.queueId)
        }
      }
    }
    
    checkMatchmaking()
  }, [])

  React.useEffect(() => {
    // Check if user needs to set username
    const checkUsername = async () => {
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, display_name')
          .eq('user_id', user.id)
          .single()
        
        if (profile && !profile.username) {
          setShowUsernamePrompt(true)
        }
      }
    }
    
    checkUsername()
  }, [user?.id])

  async function handleSaveUsername() {
    if (!usernameInput.trim()) {
      alert('Vui lòng nhập tên người dùng!')
      return
    }

    // Validate username format (alphanumeric and underscore, 3-20 chars)
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(usernameInput)) {
      alert('Tên người dùng phải từ 3-20 ký tự, chỉ chứa chữ cái, số và dấu gạch dưới!')
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          username: usernameInput.trim(),
          display_name: usernameInput.trim()
        })
        .eq('user_id', user.id)

      if (error) {
        console.error('Update username error:', error)
        alert('Không thể cập nhật tên người dùng: ' + error.message)
      } else {
        setShowUsernamePrompt(false)
        alert('Đã cập nhật tên người dùng thành công!')
      }
    } catch (err) {
      console.error('Save username error:', err)
      alert('Có lỗi xảy ra khi lưu tên người dùng!')
    }
  }

  const handleOpenTrainingModal = () => {
    setTrainingDifficulty('nhap-mon')
    setShowTrainingModal(true)
  }

  const handleCloseTrainingModal = () => {
    setShowTrainingModal(false)
  }

  const handleCreateTrainingRoom = () => {
    const profile = trainingBotProfiles[trainingDifficulty]
    const trainingConfig = {
      mode: 'training',
      difficulty: trainingDifficulty,
      playerSymbol: 'X',
      botSymbol: 'O',
      boardSize: 15,
      botProfile: profile,
      tuning: describeDifficulty(trainingDifficulty),
      createdAt: Date.now()
    }

    localStorage.setItem('trainingMatch', JSON.stringify(trainingConfig))
    setShowTrainingModal(false)
    window.location.hash = '#training'
  }

  const handleStartHotseat = () => {
    window.location.hash = '#hotseat'
  }

  React.useEffect(() => {
    // Subscribe to matchmaking updates if in queue
    if (queueId && user?.id) {
      const unsubscribe = subscribeToMatchmaking(
        user.id,
        (data) => {
          console.log('Match found via subscription!', data)
          // Will be handled by polling as backup
        },
        (error) => {
          console.error('Matchmaking subscription error:', error)
        }
      )

      return unsubscribe
    }
  }, [queueId, user?.id])

  React.useEffect(() => {
    // Poll for matches while in queue
    if (matchmaking && matchmaking.active && queueId && user?.id && !matchFound) {
      const pollInterval = setInterval(async () => {
        const elapsed = Math.floor((Date.now() - matchmaking.startTime) / 1000)
        setMatchmakingTime(elapsed)
        
        // Try to find match every 2 seconds
        if (elapsed % 2 === 0) {
          console.log('Polling for match...', { elapsed, queueId })
          
          // CRITICAL: First check if WE have been matched in the queue
          const { checkQueueMatched } = await import('../lib/matchmaking')
          const queueMatchResult = await checkQueueMatched(user.id, queueId)
          
          if (queueMatchResult.success && queueMatchResult.opponent) {
            console.log('✓ We were matched by someone else!', queueMatchResult.opponent)
            setMatchFound(true)
            setOpponent(queueMatchResult.opponent)
            setReadyTime(10)
            
            // Update localStorage
            localStorage.setItem('matchmaking', JSON.stringify({
              ...matchmaking,
              matchFound: true,
              opponent: queueMatchResult.opponent,
              queueId: queueId
            }))
            return // Stop polling
          }
          
          // If we're still waiting, try to find a match ourselves
          const result = await findMatch(user.id, queueId, matchmaking.matchSettings)
          console.log('FindMatch result:', result)
          
          if (result.success && result.opponent) {
            console.log('✓ We found a match!', result.opponent)
            setMatchFound(true)
            setOpponent(result.opponent)
            setReadyTime(10)
            
            // Update localStorage
            localStorage.setItem('matchmaking', JSON.stringify({
              ...matchmaking,
              matchFound: true,
              opponent: result.opponent,
              queueId: queueId
            }))
          } else if (result.error) {
            console.log('⏳ No match yet:', result.error)
          }
        }
        
        // Auto cancel after 60 seconds
        if (elapsed >= 60) {
          handleCancelMatchmaking()
        }
      }, 1000)
      
      return () => clearInterval(pollInterval)
    }
  }, [matchmaking, matchFound, queueId, user?.id])

  React.useEffect(() => {
    // Subscribe to room_players changes when match is found
    if (matchFound && user?.id && !opponentDeclined) {
      const channel = supabase
        .channel(`match-${user.id}-${Date.now()}`) // Unique channel name
      
      // CRITICAL: Subscribe to ANY room_players insert with my user_id
      // This catches when I'm added to a room by the other player
      console.log('📡 Subscribing to room_players for user:', user.id)
      
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_players',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🆕 I was added to a room:', payload)
          const newPlayer = payload.new as any
          const newRoomId = newPlayer.room_id
          
          console.log('✅ Setting roomId:', newRoomId)
          setRoomId(newRoomId)
          
          // Auto-mark ready after 500ms delay
          setTimeout(async () => {
            console.log('Auto-marking myself as ready...')
            const { error } = await supabase
              .from('room_players')
              .update({ is_ready: true })
              .eq('room_id', newRoomId)
              .eq('user_id', user.id)
            
            if (error) {
              console.error('Error auto-marking ready:', error)
            } else {
              console.log('✅ Auto-marked as ready')
              setIsReady(true)
            }
          }, 500)
        }
      )
      
      // Subscribe to room updates if we have a roomId
      if (roomId) {
        console.log('📡 Also subscribing to specific room updates:', roomId)
        
        channel.on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'room_players',
            filter: `room_id=eq.${roomId}`
          },
          (payload) => {
            console.log('🔔 Room player updated:', payload)
            const updatedPlayer = payload.new as any
            const oldPlayer = payload.old as any
            
            // CRITICAL: Check if opponent is ready (changed from false to true)
            if (updatedPlayer.user_id !== user.id && updatedPlayer.is_ready === true) {
              console.log('✅ Opponent is ready! Setting opponentReady=true')
              setOpponentReady(true)
            }
            
            // Also check if it's our own update completing
            if (updatedPlayer.user_id === user.id && updatedPlayer.is_ready === true) {
              console.log('✅ Confirmed: We are marked as ready in database')
            }
            
            // DEBUG: Log full update
            console.log('UPDATE Details:', {
              old_ready: oldPlayer?.is_ready,
              new_ready: updatedPlayer.is_ready,
              user_id: updatedPlayer.user_id,
              is_me: updatedPlayer.user_id === user.id
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomId}`
          },
          (payload) => {
            console.log('❌ Room deleted - opponent declined')
            setOpponentDeclined(true)
          }
        )
        
        // BACKUP: Poll for opponent ready status every 1 second
        const pollInterval = setInterval(async () => {
          if (opponentReady || opponentDeclined) {
            clearInterval(pollInterval)
            return
          }
          
          console.log('🔍 Polling opponent ready status...')
          const { data: players, error } = await supabase
            .from('room_players')
            .select('user_id, is_ready')
            .eq('room_id', roomId)
          
          if (error) {
            console.error('Poll error:', error)
            return
          }
          
          if (players && players.length === 2) {
            const opponentPlayer = players.find(p => p.user_id !== user.id)
            console.log('Opponent status:', opponentPlayer)
            
            if (opponentPlayer?.is_ready === true && !opponentReady) {
              console.log('✅ Opponent is ready (detected via polling)')
              setOpponentReady(true)
            }
          } else {
            console.log('Waiting for both players in room...')
          }
        }, 1000)
        
        channel.subscribe((status) => {
          console.log('Channel subscription status:', status)
        })
        
        return () => {
          console.log('Cleaning up subscription')
          clearInterval(pollInterval)
          supabase.removeChannel(channel)
        }
      }
      
      // Also check if room gets created (when we don't have roomId yet)
      if (!roomId) {
        channel.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'room_players',
            filter: `user_id=eq.${user.id}`
          },
          async (payload) => {
            console.log('🎉 Added to room!', payload)
            const newPlayer = payload.new as any
            if (newPlayer.room_id) {
              console.log('Setting roomId:', newPlayer.room_id)
              setRoomId(newPlayer.room_id)
              
              // CRITICAL FIX: If we already clicked accept (isReady=true), immediately mark as ready in DB
              if (isReady) {
                console.log('⚡ Auto-marking as ready in new room (opponent created it)')
                // Use a delay to ensure room is fully created
                setTimeout(async () => {
                  console.log('⚡ Executing auto-ready update...')
                  const { error } = await supabase
                    .from('room_players')
                    .update({ is_ready: true })
                    .eq('room_id', newPlayer.room_id)
                    .eq('user_id', user.id)
                  
                  if (error) {
                    console.error('❌ Error auto-marking ready:', error)
                  } else {
                    console.log('✅ Successfully auto-marked as ready')
                    
                    // IMPORTANT: Also check if opponent is already ready
                    const { data: players } = await supabase
                      .from('room_players')
                      .select('user_id, is_ready')
                      .eq('room_id', newPlayer.room_id)
                    
                    if (players) {
                      const opponentPlayer = players.find((p: any) => p.user_id !== user.id)
                      console.log('Opponent status after auto-ready:', opponentPlayer)
                      if (opponentPlayer?.is_ready === true) {
                        console.log('✅ Opponent is also ready!')
                        setOpponentReady(true)
                      }
                    }
                  }
                }, 500) // Small delay to ensure room is fully created
              }
            }
          }
        )
      }
      
      channel.subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [matchFound, roomId, user?.id])

  React.useEffect(() => {
    // Handle opponent declined
    if (opponentDeclined) {
      alert('Đối thủ đã từ chối trận đấu!')
      handleCancelMatchmaking()
      setOpponentDeclined(false)
    }
  }, [opponentDeclined])

  React.useEffect(() => {
    // Auto-navigate when both players are ready
    console.log('🔍 Ready status check:', { isReady, opponentReady, roomId })
    if (isReady && opponentReady && roomId) {
      console.log('🎉 Both players ready! Starting match in 1 second...')
      setTimeout(() => {
        if (opponent) {
          localStorage.setItem('currentMatch', JSON.stringify({
            roomId,
            opponent,
            matchSettings: matchmaking?.matchSettings
          }))
        }
        localStorage.removeItem('matchmaking')
        setMatchmaking(null)
        setMatchFound(false)
        setIsReady(false)
        setOpponentReady(false)
        console.log('🚀 Navigating to #room')
        window.location.hash = '#room'
      }, 1000)
    }
    
    // BACKUP: If we have roomId and isReady, force check opponent status
    if (roomId && isReady && !opponentReady) {
      console.log('🔍 Force checking opponent ready status...')
      setTimeout(async () => {
        const { data: players } = await supabase
          .from('room_players')
          .select('user_id, is_ready')
          .eq('room_id', roomId)
        
        if (players && players.length === 2) {
          const opponentPlayer = players.find(p => p.user_id !== user?.id)
          if (opponentPlayer?.is_ready === true) {
            console.log('✅ Force check: Opponent is ready!')
            setOpponentReady(true)
          }
        }
      }, 2000) // Check after 2 seconds
    }
  }, [isReady, opponentReady, roomId, opponent, matchmaking, user?.id])

  async function handleCancelMatchmaking() {
    // If match was found and we're declining, delete the room
    if (matchFound && roomId) {
      console.log('Declining match, deleting room...')
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId)
      
      if (error) {
        console.error('Error deleting room:', error)
      }
    }
    
    if (queueId) {
      cancelMatchmaking(queueId).then(() => {
        console.log('Cancelled matchmaking')
      })
    }
    
    localStorage.removeItem('matchmaking')
    setMatchmaking(null)
    setMatchmakingTime(0)
    setMatchFound(false)
    setReadyTime(10)
    setQueueId(null)
    setOpponent(null)
    setRoomId(null)
    setIsReady(false)
    setOpponentReady(false)
    setOpponentDeclined(false)
  }

  async function handleStartQuickMatch() {
    if (!user?.id) {
      alert('Vui lòng đăng nhập để tìm trận!')
      return
    }

    const matchSettings: MatchmakingSettings = {
      mode: 'rank',
      gameType: 'standard',
      boardSize: '15x15',
      winCondition: 5,
      turnTime: 30,
      totalTime: 600
    }

    // Join matchmaking queue
    const result = await joinMatchmakingQueue(user.id, matchSettings)
    
    if (result.success && result.queueId) {
      console.log('✓ Joined queue:', result.queueId)
      setQueueId(result.queueId)
      
      const matchmakingState = {
        active: true,
        startTime: Date.now(),
        matchSettings
      }
      
      setMatchmaking(matchmakingState)
      localStorage.setItem('matchmaking', JSON.stringify(matchmakingState))
    } else {
      console.error('Failed to join queue:', result.error)
      alert('Không thể tham gia hàng đợi: ' + result.error)
    }
  }

  async function handleAcceptMatch() {
    console.log('Match accepted, marking as ready...')
    setIsReady(true)
    
    // If we don't have a room yet, need to create one
    // CRITICAL: Only the user with LOWER user_id creates the room to avoid race condition
    if (!roomId && opponent && matchmaking?.matchSettings && user?.id) {
      const shouldCreateRoom = user.id < opponent.id
      
      if (shouldCreateRoom) {
        console.log('🏗️ I will create the room (lower user_id)')
        const { createMatchRoom } = await import('../lib/matchmaking')
        const result = await createMatchRoom(
          user.id,
          opponent.id,
          matchmaking.matchSettings
        )
        
        if (result.success && result.roomId) {
          console.log('✅ Room created:', result.roomId)
          const createdRoomId = result.roomId
          setRoomId(createdRoomId)
          
          // Update localStorage
          localStorage.setItem('matchmaking', JSON.stringify({
            ...matchmaking,
            matchFound: true,
            opponent: opponent,
            roomId: createdRoomId
          }))
          
          // IMPORTANT: Mark myself as ready immediately after creating room
          console.log('Marking myself as ready in new room...')
          const { error: readyError } = await supabase
            .from('room_players')
            .update({ is_ready: true })
            .eq('room_id', createdRoomId)
            .eq('user_id', user.id)
          
          if (readyError) {
            console.error('Error marking ready after room creation:', readyError)
          } else {
            console.log('✅ Marked as ready in new room')
          }
          
          return // Done, no need to continue
        } else {
          console.error('❌ Failed to create room:', result.error)
          return
        }
      } else {
        console.log('⏳ Waiting for opponent to create room...')
        // The other player will create the room, we just wait for it
        // The realtime subscription will detect when we're added to room_players
        return // Wait for room to be created
      }
    }
    
    // If we already have roomId, mark ourselves as ready
    if (roomId && user?.id) {
      console.log('Marking myself as ready in existing room...')
      const { error } = await supabase
        .from('room_players')
        .update({ is_ready: true })
        .eq('room_id', roomId)
        .eq('user_id', user.id)
      
      if (error) {
        console.error('Error updating ready status:', error)
      } else {
        console.log('✅ Marked as ready in database')
      }
    }
  }

  React.useEffect(() => {
    const handleResize = () => {
      setPopupPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - 336),
        y: Math.min(prev.y, window.innerHeight - 400)
      }))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const navigationItems = (
    <>
      <button className="nav-item nav-item-hot" onClick={() => { window.location.hash = '#shop'; onCloseMobileMenu?.() }}>
        <span className="nav-icon">🏯</span>
        <span className="nav-label">Tiêu Bảo Các</span>
        <span className="nav-badge hot">HOT</span>
      </button>
      <button className="nav-item" onClick={() => { window.location.hash = '#inventory'; onCloseMobileMenu?.() }}>
        <span className="nav-icon">🎒</span>
        <span className="nav-label">Túi Trữ Vật</span>
        <span className="nav-count">12</span>
      </button>
      <button className="nav-item nav-item-new" onClick={() => { window.location.hash = '#quests'; onCloseMobileMenu?.() }}>
        <span className="nav-icon">✨</span>
        <span className="nav-label">Tiên Duyên</span>
        <span className="nav-count">3</span>
      </button>
      <button className="nav-item nav-item-hot" onClick={() => { window.location.hash = '#events'; onCloseMobileMenu?.() }}>
        <span className="nav-icon">🎉</span>
        <span className="nav-label">Thiên Cơ Biến</span>
        <span className="nav-badge hot">HOT</span>
      </button>
      <button className="nav-item" onClick={() => { window.location.hash = '#khainhan'; onCloseMobileMenu?.() }}>
        <span className="nav-icon">⚡</span>
        <span className="nav-label">Khai Nhãn</span>
        <span className="nav-badge rank">RANK</span>
      </button>
      <button className="nav-item" onClick={() => { window.location.hash = '#guide'; onCloseMobileMenu?.() }}>
        <span className="nav-icon">📚</span>
        <span className="nav-label">Bí Tịch</span>
      </button>
      <button className="nav-item" onClick={() => { onCloseMobileMenu?.() }}>
        <span className="nav-icon">🧙</span>
        <span className="nav-label">Cao Nhân Chỉ Điểm</span>
        <span className="nav-badge new">NEW</span>
      </button>
    </>
  )

  return (
    <>
      {/* Username Prompt Modal */}
      {showUsernamePrompt && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="username-prompt-modal" style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '2px solid #f39c12',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{
              color: '#f39c12',
              fontSize: '24px',
              marginBottom: '16px',
              textAlign: 'center'
            }}>Chào mừng đạo hữu!</h2>
            <p style={{
              color: '#e0e0e0',
              marginBottom: '24px',
              textAlign: 'center',
              fontSize: '14px'
            }}>Vui lòng đặt tên hiệu để bắt đầu tu luyện</p>
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Nhập tên người dùng..."
              maxLength={20}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                borderRadius: '8px',
                border: '2px solid #f39c12',
                backgroundColor: '#0f3460',
                color: '#fff',
                marginBottom: '16px',
                outline: 'none'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSaveUsername()
                }
              }}
            />
            <p style={{
              color: '#888',
              fontSize: '12px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>3-20 ký tự, chỉ chữ cái, số và dấu gạch dưới</p>
            <button
              onClick={handleSaveUsername}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                fontWeight: 'bold',
                backgroundColor: '#f39c12',
                color: '#1a1a2e',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e67e22'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f39c12'}
            >
              XÁC NHẬN
            </button>
          </div>
        </div>
      )}

      {mobileMenuOpen && (
        <div className="mobile-nav-overlay" onClick={onCloseMobileMenu}>
          <nav className="mobile-nav-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-nav-header">
              <div className="mobile-nav-user">
                <div className="avatar" />
                <div className="mobile-nav-user-info">
                  <div className="mobile-nav-username">{user?.user_metadata?.name ?? user?.email ?? 'username'}</div>
                  <div className="mobile-nav-rank">Cảnh Giới: {rank ?? 'Vô Danh'}</div>
                </div>
              </div>
            </div>
            {navigationItems}
          </nav>
        </div>
      )}

      {/* Matchmaking Popup */}
      {matchmaking && matchmaking.active && (
        <div className="matchmaking-popup">
          {!matchFound ? (
            <div className="matchmaking-popup-content">
              <div className="matchmaking-spinner"></div>
              <div className="matchmaking-info">
                <h3>Đang tìm trận...</h3>
                <p>Chế độ: {(matchmaking.matchSettings?.mode === 'rank' || matchmaking.matchSettings?.mode === 'ranked') ? 'Rank' : 'Giải trí'}</p>
                <div className="matchmaking-popup-timer">{matchmakingTime}s / 30s</div>
              </div>
              <button className="matchmaking-cancel" onClick={handleCancelMatchmaking}>
                Hủy tìm trận
              </button>
            </div>
          ) : (
            <div className="matchmaking-popup-content match-found">
              <div className="match-found-icon">✓</div>
              <div className="matchmaking-info">
                <h3>Đã tìm thấy trận!</h3>
                <p>Đối thủ: {opponent ? `${opponent.displayName} (${opponent.rank})` : `Player#${Math.floor(Math.random() * 9999)}`}</p>
                <div className="ready-countdown">
                  <div className="ready-status">
                    <span className={isReady ? 'ready-check ready' : 'ready-check'}>
                      {isReady ? '✓' : '○'} Bạn {isReady ? 'đã sẵn sàng' : 'chưa sẵn sàng'}
                    </span>
                    <span className={opponentReady ? 'ready-check ready' : 'ready-check'}>
                      {opponentReady ? '✓' : '○'} Đối thủ {opponentReady ? 'đã sẵn sàng' : 'chưa sẵn sàng'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="match-found-actions">
                <button className="match-accept-btn" onClick={handleAcceptMatch}>
                  SẴN SÀNG
                </button>
                <button className="match-decline-btn" onClick={handleCancelMatchmaking}>
                  Từ chối
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="home-container">
        <div className="home-grid">
          {/* Left sidebar [A] - Navigation */}
          <aside className="home-sidebar glass-card">
          <nav className="home-nav">
            {navigationItems}
          </nav>
        </aside>

        {/* Center column [C] - Hero & Matchmaking (single unified card) */}
        <main className="home-center">
          <div className="hero-matchmaking-card glass-card energy-border">
            <div className="hero-art">
              <div className="hero-overlay"></div>
              <div className="hero-label">ẢNH HERO / ART CARO</div>
            </div>

            <div className="matchmaking-content">
              <h2 className="mm-title">VÔ DANH THÀNH VÔ ĐỐI</h2>
              <p className="mm-subtitle">Leo rank MindPoint từ Vô Danh đến Vô Đối chỉ với vài ván mỗi ngày</p>
              
              <button className="cta-primary" onClick={handleStartQuickMatch}>
                <span className="cta-icon">⚔️</span>
                GHÉP TRẬN NGAY
              </button>

              <div className="mode-grid">
                <button className="mode-btn">
                  <span className="mode-icon">⛰️</span>
                  <span className="mode-text">ĐẤU CẢNH</span>
                </button>
                <button className="mode-btn">
                  <span className="mode-icon">⚔️</span>
                  <span className="mode-text">VẠN MÔN TRANH ĐẤU</span>
                </button>
                <button className="mode-btn" onClick={handleOpenTrainingModal}>
                  <span className="mode-icon">🧘</span>
                  <span className="mode-text">THÍ LUYỆN</span>
                </button>
                <button 
                  className="mode-btn"
                  onClick={handleStartHotseat}
                >
                  <span className="mode-icon">🏛️</span>
                  <span className="mode-text">TIÊU DAO</span>
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Right column [D + E] - Event & Social */}
        <aside className="home-right">
          {currentEvent && (
            <div className="event-gallery glass-card" onPointerDown={handleEventPointerDown} onPointerUp={handleEventPointerUp} onPointerLeave={handleEventPointerLeave} onPointerCancel={handleEventPointerLeave}>
              <div className="event-gallery-viewport">
                {FEATURED_EVENTS.map((evt, idx) => (
                  <div
                    key={evt.id}
                    className="event-gallery-slide"
                    style={{
                      transform: `translateX(${(idx - currentEventIndex) * 100}%)`,
                      backgroundImage: evt.artwork
                    }}
                    onClick={() => { window.location.hash = evt.ctaHref || '#events' }}
                    role="button"
                    aria-label={`Sự kiện ${evt.title}`}
                  >
                    <div className="event-gallery-overlay"></div>
                    <div className="event-gallery-caption">
                      <h4>{evt.title}</h4>
                    </div>
                  </div>
                ))}
              </div>
              {totalEvents > 1 && (
                <div className="event-gallery-dots" role="tablist" aria-label="Danh sách sự kiện">
                  {FEATURED_EVENTS.map((evt, index) => (
                    <button
                      key={evt.id}
                      className={`eg-dot ${index === currentEventIndex ? 'active' : ''}`}
                      onClick={() => handleEventDotClick(index)}
                      aria-label={`Xem ${evt.title}`}
                      aria-current={index === currentEventIndex}
                    ></button>
                  ))}
                </div>
              )}
              {totalEvents > 1 && (
                <>
                  <button className="eg-nav prev" onClick={() => handleEventDirection(-1)} aria-label="Trước">‹</button>
                  <button className="eg-nav next" onClick={() => handleEventDirection(1)} aria-label="Sau">›</button>
                </>
              )}
            </div>
          )}

          <div className="social-card glass-card">
            <div className="social-tabs">
              <button 
                className={`social-tab ${activeTab === 'friends' ? 'active' : ''}`}
                onClick={() => setActiveTab('friends')}
              >
                Đạo Hữu
              </button>
              <button 
                className={`social-tab ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                Truyền Âm
              </button>
              <button 
                className={`social-tab ${activeTab === 'info' ? 'active' : ''}`}
                onClick={() => setActiveTab('info')}
              >
                Cao Nhân
              </button>
            </div>

            <div className="social-content">
              {activeTab === 'friends' && renderFriendsPanel()}
              {activeTab === 'chat' && (
                <div className="chat-tab">
                  <ChatPanel
                    mode="home"
                    userId={user?.id}
                    displayName={userDisplayName}
                    roomId={roomId}
                    variant="card"
                  />
                </div>
              )}
              {activeTab === 'info' && (
                <div className="info-tab">
                  <div className="info-placeholder">Info coming soon...</div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Social Toggle Button */}
      <button 
        className="mobile-social-toggle" 
        onClick={() => setShowSocialPopup(!showSocialPopup)}
        aria-label={showSocialPopup ? "Đóng menu xã hội" : "Mở menu xã hội"}
        aria-expanded={showSocialPopup}
      >
        <span className="social-icon" aria-hidden="true">👥</span>
      </button>

      {/* Mobile Social Popup */}
      {showSocialPopup && (
        <div 
          className="mobile-social-popup"
          style={{
            right: `${window.innerWidth - popupPosition.x - 320}px`,
            top: `${popupPosition.y}px`,
            transform: 'none',
            cursor: isDragging ? 'grabbing' : 'auto'
          }}
        >
          <div 
            className="social-popup-header"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            title="Kéo để di chuyển"
          >
            <span className="drag-hint" aria-hidden="true">⋮⋮</span>
            <button 
              className="close-popup" 
              onClick={() => setShowSocialPopup(false)}
              aria-label="Đóng popup"
            >
              ✕
            </button>
          </div>
          <div className="social-tabs">
            <button 
              className={`social-tab ${activeTab === 'friends' ? 'active' : ''}`}
              onClick={() => setActiveTab('friends')}
            >
              Đạo Hữu
            </button>
            <button 
              className={`social-tab ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              Truyền Âm
            </button>
            <button 
              className={`social-tab ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              Cao Nhân
            </button>
          </div>

          <div className="social-content">
            {activeTab === 'friends' && renderFriendsPanel()}
            {activeTab === 'chat' && (
              <div className="chat-tab">
                <ChatPanel
                  mode="home"
                  userId={user?.id}
                  displayName={userDisplayName}
                  roomId={roomId}
                  variant="popup"
                />
              </div>
            )}
            {activeTab === 'info' && (
              <div className="info-tab">
                <div className="info-placeholder">Info coming soon...</div>
              </div>
            )}
          </div>
        </div>
      )}

      {showTrainingModal && (
        <div 
          className="training-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 12000
          }}
          onClick={handleCloseTrainingModal}
        >
          <div
            className="training-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(520px, 92vw)',
              borderRadius: '20px',
              padding: '28px',
              background: 'linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.98) 100%)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.5)'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '22px', color: '#fff', fontWeight: 700 }}>Phòng Thí Luyện</h3>
            <p style={{ color: '#cbd5f5', marginTop: '6px', fontSize: '14px' }}>
              Chọn độ khó bot để luyện tập trước khi leo rank.
            </p>

            <div className="training-difficulty-grid" style={{ display: 'grid', gap: '16px', marginTop: '20px' }}>
              {trainingDifficultyOrder.map((diff) => {
                const profile = trainingBotProfiles[diff]
                const tuning = describeDifficulty(diff)
                const selected = trainingDifficulty === diff
                return (
                  <button
                    key={diff}
                    onClick={() => setTrainingDifficulty(diff)}
                    style={{
                      textAlign: 'left',
                      borderRadius: '16px',
                      border: selected ? '2px solid #22D3EE' : '1px solid rgba(148, 163, 184, 0.3)',
                      padding: '16px',
                      background: selected ? 'rgba(34,211,238,0.08)' : 'rgba(15,23,42,0.6)',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ fontSize: '28px' }}>{profile.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>{profile.title}</div>
                      <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: 4 }}>{profile.caption}</div>
                      <div style={{ color: '#38bdf8', fontSize: '12px' }}>
                        {tuning.style === 'defense' && 'Ưu tiên chặn nước mạnh'}
                        {tuning.style === 'balanced' && 'Cân bằng công thủ'}
                        {tuning.style === 'offense' && 'Luôn tìm cách tấn công'}
                        {tuning.lookaheadDepth && ` • Nhìn trước ${tuning.lookaheadDepth} nước`}
                      </div>
                    </div>
                    <div style={{ color: selected ? '#22D3EE' : '#94a3b8', fontWeight: 600 }}>
                      {trainingLevelLabels[diff]}
                    </div>
                  </button>
                )
              })}
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCloseTrainingModal}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid rgba(148, 163, 184, 0.4)',
                  background: 'transparent',
                  color: '#cbd5f5',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Hủy
              </button>
              <button
                onClick={handleCreateTrainingRoom}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(120deg, #22D3EE, #6366F1)',
                  color: '#0f172a',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 10px 25px rgba(34, 211, 238, 0.35)'
                }}
              >
                Tạo phòng & đấu bot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
