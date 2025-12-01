import React from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { joinMatchmakingQueue, findMatch, cancelMatchmaking, subscribeToMatchmaking, MatchmakingSettings } from '../lib/matchmaking'
import { supabase } from '../lib/supabase'
import { TrainingDifficulty, describeDifficulty } from '../lib/game/botAI'
import { useFriendSystem } from '../hooks/useFriendSystem'
import HomeChatOverlay from '../components/chat/HomeChatOverlay'

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

const getFeaturedEvents = (t: any): FeaturedEvent[] => [
  {
    id: 'thien-co-bien',
    title: t('home.events.thienCoBien.title'),
    subtitle: t('home.events.thienCoBien.subtitle'),
    chip: t('home.events.thienCoBien.chip'),
    highlight: t('home.events.thienCoBien.highlight'),
    timeline: t('home.events.thienCoBien.timeline'),
    reward: t('home.events.thienCoBien.reward'),
    accent: '#34d399',
    artwork: 'url(/event-thien-co-bien.svg)',
    ctaLabel: t('home.events.thienCoBien.ctaLabel'),
    ctaHref: '#events'
  },
  {
    id: 'lua-trai-dai-hoi',
    title: t('home.events.luaTraiDaiHoi.title'),
    subtitle: t('home.events.luaTraiDaiHoi.subtitle'),
    chip: t('home.events.luaTraiDaiHoi.chip'),
    highlight: t('home.events.luaTraiDaiHoi.highlight'),
    timeline: t('home.events.luaTraiDaiHoi.timeline'),
    reward: t('home.events.luaTraiDaiHoi.reward'),
    accent: '#f472b6',
    artwork: 'url(/event-lua-trai.svg)',
    ctaLabel: t('home.events.luaTraiDaiHoi.ctaLabel'),
    ctaHref: '#events'
  },
  {
    id: 'tuyet-dinh-song-dau',
    title: t('home.events.tuyetDinhSongDau.title'),
    subtitle: t('home.events.tuyetDinhSongDau.subtitle'),
    chip: t('home.events.tuyetDinhSongDau.chip'),
    highlight: t('home.events.tuyetDinhSongDau.highlight'),
    timeline: t('home.events.tuyetDinhSongDau.timeline'),
    reward: t('home.events.tuyetDinhSongDau.reward'),
    accent: '#a78bfa',
    artwork: 'url(/event-song-dau.svg)',
    ctaLabel: t('home.events.tuyetDinhSongDau.ctaLabel'),
    ctaHref: '#events'
  }
]

export default function Home({ mobileMenuOpen, onCloseMobileMenu, user, rank }: HomeProps = {}) {
  const { t, language } = useLanguage()
  const FEATURED_EVENTS = React.useMemo(() => getFeaturedEvents(t), [t, language])
  const [activeTab, setActiveTab] = React.useState<'friends' | 'chat' | 'ai'>('friends')
  const [showSocialPopup, setShowSocialPopup] = React.useState(false)
  const [matchmaking, setMatchmaking] = React.useState<any>(null)
  const [username, setUsername] = React.useState<string>('')
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
  const [chatOverlayOpen, setChatOverlayOpen] = React.useState(false)
  const [chatOverlayTab, setChatOverlayTab] = React.useState<'world' | 'friend' | 'ai'>('world')
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
  const [friendRequestPopup, setFriendRequestPopup] = React.useState<{requestId: string, from: string, avatar?: string} | null>(null)
  const [blockFor5Min, setBlockFor5Min] = React.useState(false)
  const [showFriendNotification, setShowFriendNotification] = React.useState(false)
  const [notificationMessage, setNotificationMessage] = React.useState('')
  const eventAutoplayRef = React.useRef<number | null>(null)
  const eventPointerStart = React.useRef<number | null>(null)
  const totalEvents = FEATURED_EVENTS.length

  // Realtime subscription for friend requests
  React.useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`friend-requests:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friends',
          filter: `friend_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🔔 New friend request received:', payload)
          
          // Fetch sender profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('user_id', payload.new.user_id)
            .maybeSingle()
          
          const senderName = profile?.display_name || profile?.username || t('home.friends.anonymousUser')
          
          // Show notification
          setNotificationMessage(t('home.friends.friendRequestSent', { name: senderName }))
          setShowFriendNotification(true)
          
          // Play notification sound
          try {
            const audio = new Audio('/notification.mp3')
            audio.volume = 0.5
            audio.play().catch(e => console.log('Audio play failed:', e))
          } catch (e) {
            console.log('Audio error:', e)
          }
          
          // Show popup
          setFriendRequestPopup({
            requestId: payload.new.id,
            from: senderName,
            avatar: profile?.avatar_url
          })
          
          // Refresh friend list
          refreshFriends()
          
          // Auto hide notification after 5s
          setTimeout(() => setShowFriendNotification(false), 5000)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'friends',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🔄 Friend request status updated:', payload)
          
          if (payload.new.status === 'accepted') {
            // Fetch friend profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, display_name')
              .eq('user_id', payload.new.friend_id)
              .maybeSingle()
            
            const friendName = profile?.display_name || profile?.username || t('home.friends.anonymousUser')
            setNotificationMessage(t('home.friends.friendRequestAccepted', { name: friendName }))
            setShowFriendNotification(true)
            
            setTimeout(() => setShowFriendNotification(false), 5000)
          }
          
          refreshFriends()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, refreshFriends])

  // Show popup for existing friend requests on mount
  React.useEffect(() => {
    if (incomingRequests.length > 0 && !friendRequestPopup) {
      const latestRequest = incomingRequests[0]
      if (latestRequest.profile) {
        setFriendRequestPopup({
          requestId: latestRequest.id,
          from: latestRequest.profile.display_name || latestRequest.profile.username || t('home.friends.anonymous'),
          avatar: latestRequest.profile.avatar_url || undefined
        })
      }
    }
  }, [incomingRequests])

  // Load username from profile
  React.useEffect(() => {
    if (!user) {
      setUsername('')
      return
    }
    
    async function loadUsername() {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('username, display_name')
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (data) {
          setUsername(data.username || data.display_name || '')
        }
      } catch (e) {
        console.error('Failed to load username:', e)
      }
    }
    
    loadUsername()
  }, [user])

  const userDisplayName = React.useMemo(() => {
    return (
      username ||
      user?.user_metadata?.name ||
      user?.user_metadata?.full_name ||
      t('home.noUsername')
    )
  }, [user, username, t])

  const trainingDifficultyOrder: TrainingDifficulty[] = ['nhap-mon', 'ky-tai', 'nghich-thien', 'thien-ton', 'hu-vo']

  const trainingBotProfiles: Record<TrainingDifficulty, { title: string; caption: string; emoji: string }> = {
    'nhap-mon': {
      title: t('home.training.nhapMon.title'),
      caption: t('home.training.nhapMon.caption'),
      emoji: '🛡️'
    },
    'ky-tai': {
      title: t('home.training.kyTai.title'),
      caption: t('home.training.kyTai.caption'),
      emoji: '⚖️'
    },
    'nghich-thien': {
      title: t('home.training.nghichThien.title'),
      caption: t('home.training.nghichThien.caption'),
      emoji: '🔥'
    },
    'thien-ton': {
      title: t('home.training.thienTon.title'),
      caption: t('home.training.thienTon.caption'),
      emoji: '⚡'
    },
    'hu-vo': {
      title: t('home.training.huVo.title'),
      caption: t('home.training.huVo.caption'),
      emoji: '🌀'
    }
  }

  const trainingLevelLabels: Record<TrainingDifficulty, string> = {
    'nhap-mon': t('home.training.difficultyEasy'),
    'ky-tai': t('home.training.difficultyMedium'),
    'nghich-thien': t('home.training.difficultyHard'),
    'thien-ton': t('home.training.difficultyVeryHard'),
    'hu-vo': t('home.training.difficultyMaster')
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

  const openChatOverlay = React.useCallback((tab: 'world' | 'friend' | 'ai' = 'world') => {
    setChatOverlayTab(tab)
    setChatOverlayOpen(true)
  }, [])

  const onlineFriendCount = React.useMemo(
    () => friends.filter((entry) => entry.profile?.is_online).length,
    [friends]
  )

  const acceptedFriends = React.useMemo(
    () => friends.filter((entry) => entry.status === 'accepted'),
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
    if (!timestamp) return t('home.friends.hidden')
    const parsed = Date.parse(timestamp)
    if (!Number.isFinite(parsed)) return t('home.friends.hidden')
    const diff = Date.now() - parsed
    if (diff < 60_000) return t('home.friends.justNow')
    if (diff < 3_600_000) return t('home.friends.minutesAgo', { count: Math.floor(diff / 60_000) })
    if (diff < 86_400_000) return t('home.friends.hoursAgo', { count: Math.floor(diff / 3_600_000) })
    return t('home.friends.daysAgo', { count: Math.floor(diff / 86_400_000) })
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
      all: t('home.friends.emptyStateAll'),
      online: t('home.friends.emptyStateOnline'),
      incoming: t('home.friends.emptyStateIncoming'),
      outgoing: t('home.friends.emptyStateOutgoing')
    } as Record<FriendPanelFilter, string>

    return (
      <div className="friends-tab">
        <div className="friend-header">
          <div>
            <div className="friend-title">{t('home.friends.title')}</div>
            <div className="friend-meta">
              {t('home.friends.connections', { count: friendCount })} · {t('home.friends.onlineCount', { count: onlineFriendCount })}
            </div>
          </div>
          <button
            className="ghost-btn"
            onClick={() => refreshFriends()}
            disabled={friendsLoading}
          >
            {friendsLoading ? t('home.friends.loading') : t('home.friends.refresh')}
          </button>
        </div>

        {friendError && (
          <div className="friend-error" role="alert">
            <span>{friendError}</span>
            <button className="ghost-btn" onClick={() => clearFriendError()} aria-label={t('common.close')}>
              ×
            </button>
          </div>
        )}

        <div className="friend-search">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            placeholder={t('home.friends.searchPlaceholder')}
            value={friendSearch}
            onChange={(e) => setFriendSearch(e.target.value)}
          />
        </div>

        {showSearchResults && (
          <div className="friend-search-results">
            {searchingFriends && <div className="friend-placeholder">{t('home.friends.searching')}</div>}
            {!searchingFriends && searchResults.length === 0 && (
              <div className="friend-placeholder">{t('home.friends.noResults')}</div>
            )}
            {!searchingFriends && searchResults.map((result) => {
              const displayName = result.profile.display_name || result.profile.username || t('home.friends.anonymous')
              const rankDisplay = result.profile.rank_tier || t('home.friends.noRank')
              const normalized = (result.status || '').toLowerCase()
              const targetUsername = result.profile.username

              let statusIcon: React.ReactNode = null
              if (!normalized) {
                // Chưa kết bạn - icon add user
                statusIcon = (
                  <button
                    disabled={!targetUsername || friendsMutating}
                    onClick={() => targetUsername && sendFriendRequest(targetUsername)}
                    title={t('home.friends.sendRequest')}
                    style={{
                      background: 'linear-gradient(135deg, #22D3EE, #06B6D4)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: friendsMutating ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      color: 'white',
                      boxShadow: '0 4px 12px rgba(34,211,238,0.5)',
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
                      opacity: friendsMutating ? 0.5 : 1,
                      padding: 0
                    }}
                    onMouseEnter={(e) => {
                      if (!friendsMutating) {
                        e.currentTarget.style.transform = 'scale(1.1)'
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(34,211,238,0.7)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(34,211,238,0.5)'
                    }}
                  >
                    👤➕
                  </button>
                )
              } else if (normalized === 'accepted') {
                statusIcon = <span style={{ fontSize: '20px', color: '#4ADE80', flexShrink: 0 }} title={t('home.friends.alreadyFriends')}>✓</span>
              } else if (normalized === 'pending') {
                statusIcon = <span style={{ fontSize: '18px', color: '#94A3B8', flexShrink: 0 }} title={t('home.friends.pending')}>⏳</span>
              } else if (normalized === 'blocked') {
                statusIcon = <span style={{ fontSize: '18px', color: '#EF4444', flexShrink: 0 }} title={t('home.friends.blocked')}>⛔</span>
              }

              return (
                <div 
                  className="friend-item" 
                  key={result.profile.user_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    gap: '12px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                >
                  <div 
                    className="friend-avatar" 
                    aria-hidden="true"
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      flexShrink: 0
                    }}
                  ></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayName}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                      {rankDisplay}
                    </div>
                  </div>
                  {statusIcon}
                </div>
              )
            })}
          </div>
        )}

        <div className="friend-filters">
          {([
            { key: 'all', label: t('home.friends.filterAll'), count: friendCount },
            { key: 'online', label: t('home.friends.filterOnline'), count: onlineFriendCount },
            { key: 'incoming', label: t('home.friends.filterIncoming'), count: incomingRequests.length },
            { key: 'outgoing', label: t('home.friends.filterOutgoing'), count: outgoingRequests.length }
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
            <div className="friend-placeholder">{t('home.friends.loadingList')}</div>
          ) : filteredFriends.length === 0 ? (
            <div className="friend-placeholder">{emptyStateCopy[friendFilter]}</div>
          ) : (
            filteredFriends.map((entry) => {
              const displayName = entry.profile?.display_name || entry.profile?.username || t('home.friends.anonymous')
              const presence = entry.profile?.is_online
                ? t('home.friends.online')
                : `${t('home.friends.offline')} · ${formatLastSeen(entry.profile?.last_active)}`
              const isIncomingView = friendFilter === 'incoming'
              const isOutgoingView = friendFilter === 'outgoing'

              return (
                <div 
                  className="friend-item" 
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    gap: '12px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    transition: 'all 0.2s ease',
                    marginBottom: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                    e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    {entry.profile?.avatar_url ? (
                      <img 
                        src={entry.profile.avatar_url} 
                        alt={displayName}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: entry.profile.is_online ? '2px solid #22D3EE' : '2px solid rgba(148, 163, 184, 0.3)'
                        }}
                      />
                    ) : (
                      <div 
                        className="friend-avatar" 
                        aria-hidden="true"
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          border: entry.profile?.is_online ? '2px solid #22D3EE' : '2px solid rgba(148, 163, 184, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px'
                        }}
                      >
                        👤
                      </div>
                    )}
                    {entry.profile?.is_online && (
                      <div style={{
                        position: 'absolute',
                        bottom: '0',
                        right: '0',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: '#22D3EE',
                        border: '2px solid #0f172a',
                        boxShadow: '0 0 8px rgba(34, 211, 238, 0.6)'
                      }}></div>
                    )}
                  </div>
                  <div className="friend-info" style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontWeight: 600, 
                      fontSize: '15px', 
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'white'
                    }}>
                      {displayName}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: entry.profile?.is_online ? '#22D3EE' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {isIncomingView ? (
                        <>🔔 {t('home.friends.waitingForResponse')}</>
                      ) : isOutgoingView ? (
                        <>⏳ {t('home.friends.waitingForOpponent')}</>
                      ) : entry.profile?.is_online ? (
                        <>🟢 {t('home.friends.online')}</>
                      ) : (
                        <>⚫ {formatLastSeen(entry.profile?.last_active)}</>
                      )}
                    </div>
                  </div>
                  <div className="friend-actions" style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {isIncomingView ? (
                      <>
                        <button
                          disabled={friendsMutating}
                          onClick={() => respondToRequest(entry.id, 'accept')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #22D3EE, #06B6D4)',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: friendsMutating ? 'not-allowed' : 'pointer',
                            opacity: friendsMutating ? 0.5 : 1
                          }}
                        >
                          ✓
                        </button>
                        <button
                          disabled={friendsMutating}
                          onClick={() => respondToRequest(entry.id, 'reject')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(239, 68, 68, 0.5)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#EF4444',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: friendsMutating ? 'not-allowed' : 'pointer',
                            opacity: friendsMutating ? 0.5 : 1
                          }}
                        >
                          ✕
                        </button>
                      </>
                    ) : isOutgoingView ? (
                      <button
                        disabled={friendsMutating}
                        onClick={() => removeFriend(entry.friend_id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(148, 163, 184, 0.3)',
                          background: 'transparent',
                          color: '#94a3b8',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: friendsMutating ? 'not-allowed' : 'pointer',
                          opacity: friendsMutating ? 0.5 : 1
                        }}
                      >
                        {t('common.cancel')}
                      </button>
                    ) : (
                      <>
                        <button
                          disabled={friendsMutating}
                          onClick={() => handleChallengeFriend(entry.friend_id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #22D3EE, #06B6D4)',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: friendsMutating ? 'not-allowed' : 'pointer',
                            opacity: friendsMutating ? 0.5 : 1,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          ⚔️ {t('home.friends.challenge')}
                        </button>
                        <button
                          disabled={friendsMutating}
                          onClick={() => removeFriend(entry.friend_id)}
                          title={t('home.friends.removeFriend')}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            background: 'transparent',
                            color: '#94a3b8',
                            fontSize: '14px',
                            cursor: friendsMutating ? 'not-allowed' : 'pointer',
                            opacity: friendsMutating ? 0.5 : 1
                          }}
                        >
                          🗑️
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
      alert(t('home.usernamePrompt.errorEmpty'))
      return
    }

    // Validate username format (alphanumeric and underscore, 3-20 chars)
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(usernameInput)) {
      alert(t('home.usernamePrompt.errorInvalid'))
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
        alert(t('home.usernamePrompt.errorUpdate', { message: error.message }))
      } else {
        setShowUsernamePrompt(false)
        alert(t('home.usernamePrompt.success'))
      }
    } catch (err) {
      console.error('Save username error:', err)
      alert(t('home.usernamePrompt.errorSave'))
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
      alert(t('home.matchmaking.opponentDeclined'))
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
      alert(t('home.matchmaking.loginRequired'))
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
      alert(t('home.matchmaking.queueError', { error: result.error }))
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
        <span className="nav-label">{t('home.nav.shop')}</span>
        <span className="nav-badge hot">{t('home.nav.badgeHot')}</span>
      </button>
      <button className="nav-item" onClick={() => { window.location.hash = '#inventory'; onCloseMobileMenu?.() }}>
        <span className="nav-icon">🎒</span>
        <span className="nav-label">{t('home.nav.inventory')}</span>
        <span className="nav-count">12</span>
      </button>
      <button className="nav-item nav-item-new" onClick={() => { window.location.hash = '#quests'; onCloseMobileMenu?.() }}>
        <span className="nav-icon">✨</span>
        <span className="nav-label">{t('home.nav.quests')}</span>
        <span className="nav-count">3</span>
      </button>
      <button className="nav-item nav-item-hot" onClick={() => { window.location.hash = '#events'; onCloseMobileMenu?.() }}>
        <span className="nav-icon">🎉</span>
        <span className="nav-label">{t('home.nav.events')}</span>
        <span className="nav-badge hot">{t('home.nav.badgeHot')}</span>
      </button>
      <button className="nav-item" onClick={() => { window.location.hash = '#khainhan'; onCloseMobileMenu?.() }}>
        <span className="nav-icon">⚡</span>
        <span className="nav-label">{t('home.nav.khaiNhan')}</span>
        <span className="nav-badge rank">{t('home.nav.badgeRank')}</span>
      </button>
      <button className="nav-item" onClick={() => { window.location.hash = '#guide'; onCloseMobileMenu?.() }}>
        <span className="nav-icon">📚</span>
        <span className="nav-label">{t('home.nav.guide')}</span>
      </button>
      <button className="nav-item" onClick={() => { window.location.hash = '#ai-analysis'; onCloseMobileMenu?.() }}>
        <span className="nav-icon">🧙</span>
        <span className="nav-label">{t('home.nav.mentor')}</span>
        <span className="nav-badge new">{t('home.nav.badgeNew')}</span>
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
            }}>{t('home.welcome.greetingTitle')}</h2>
            <p style={{
              color: '#e0e0e0',
              marginBottom: '24px',
              textAlign: 'center',
              fontSize: '14px'
            }}>{t('home.welcome.description')}</p>
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder={t('home.welcome.placeholder')}
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
            }}>{t('home.welcome.validationHint')}</p>
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
              {t('common.confirm')}
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
                  <div className="mobile-nav-username">{username || user?.user_metadata?.name || t('home.noUsername')}</div>
                  <div className="mobile-nav-rank">{t('home.realm')}: {rank ?? t('home.friends.noRank')}</div>
                </div>
              </div>
            </div>
            {navigationItems}
          </nav>
        </div>
      )}

      {/* Friend Request Popup */}
      {friendRequestPopup && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 10000,
          background: 'linear-gradient(135deg, rgba(15,12,41,0.98), rgba(36,36,62,0.98))',
          border: '2px solid rgba(34,211,238,0.3)',
          borderRadius: '12px',
          padding: '16px 20px',
          minWidth: '320px',
          maxWidth: '400px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#22D3EE' }}>
              👥 {t('home.friends.friendRequestTitle')}
            </h3>
            <button
              onClick={() => setFriendRequestPopup(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0',
                width: '24px',
                height: '24px'
              }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--color-text)' }}>
            {t('home.friends.friendRequestMessage', { name: friendRequestPopup.from })}
          </p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={async () => {
                await respondToRequest(friendRequestPopup.requestId, 'accept')
                setFriendRequestPopup(null)
                setBlockFor5Min(false)
              }}
              disabled={friendsMutating}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #22D3EE, #06B6D4)',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: '0 2px 8px rgba(34,211,238,0.4)'
              }}
            >
              {t('home.friends.accept')}
            </button>
            <button
              onClick={async () => {
                await respondToRequest(friendRequestPopup.requestId, 'reject')
                if (blockFor5Min && user?.id) {
                  // Block user for 5 minutes
                  const { blockUser: blockUserFunc } = await import('../lib/friends')
                  const targetUserId = incomingRequests.find(r => r.id === friendRequestPopup.requestId)?.friend_id
                  
                  if (targetUserId) {
                    const result = await blockUserFunc(user.id, targetUserId, 'Blocked for 5 minutes via friend request')
                    
                    if (result.success) {
                      console.log('✓ User blocked for 5 minutes')
                      setNotificationMessage(t('home.friends.userBlocked', { name: friendRequestPopup.from }))
                      setShowFriendNotification(true)
                      
                      // Auto-unblock after 5 minutes
                      setTimeout(async () => {
                        const { unblockUser } = await import('../lib/friends')
                        await unblockUser(user.id, targetUserId)
                        console.log('✓ User automatically unblocked after 5 minutes')
                      }, 5 * 60 * 1000)
                    }
                  }
                }
                setFriendRequestPopup(null)
                setBlockFor5Min(false)
              }}
              disabled={friendsMutating}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {t('home.friends.decline')}
            </button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--color-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={blockFor5Min}
              onChange={(e) => setBlockFor5Min(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            {t('home.friends.blockNotifications')}
          </label>
        </div>
      )}

      {/* Matchmaking Popup */}
      {matchmaking && matchmaking.active && (
        <div className="matchmaking-popup">
          {!matchFound ? (
            <div className="matchmaking-popup-content">
              <div className="matchmaking-spinner"></div>
              <div className="matchmaking-info">
                <h3>{t('home.matchmaking.searching')}</h3>
                <p>{t('home.matchmaking.mode')}: {(matchmaking.matchSettings?.mode === 'rank' || matchmaking.matchSettings?.mode === 'ranked') ? t('home.matchmaking.ranked') : t('home.matchmaking.casual')}</p>
                <div className="matchmaking-popup-timer">{matchmakingTime}s / 30s</div>
              </div>
              <button className="matchmaking-cancel" onClick={handleCancelMatchmaking}>
                {t('home.matchmaking.cancel')}
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
              <h2 className="mm-title">{t('home.hero.title')}</h2>
              <p className="mm-subtitle">{t('home.hero.subtitle')}</p>
              
              <button className="cta-primary" onClick={handleStartQuickMatch}>
                <span className="cta-icon">⚔️</span>
                {t('home.hero.ctaQuickMatch')}
                <span className="rank-badge" style={{ marginLeft: '8px', padding: '2px 8px', background: '#34d399', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>{t('home.hero.ctaRankNote')}</span>
              </button>

              <div className="mode-grid">
                <button className="mode-btn">
                  <span className="mode-icon">⛰️</span>
                  <span className="mode-text">{t('home.modes.ranked')}</span>
                </button>
                <button className="mode-btn" onClick={() => window.location.hash = 'createroom'}>
                  <span className="mode-icon">⚔️</span>
                  <span className="mode-text">{t('home.modes.tournament')}</span>
                </button>
                <button className="mode-btn" onClick={handleOpenTrainingModal}>
                  <span className="mode-icon">🧘</span>
                  <span className="mode-text">{t('home.modes.training')}</span>
                </button>
                <button 
                  className="mode-btn"
                  onClick={handleStartHotseat}
                >
                  <span className="mode-icon">🏛️</span>
                  <span className="mode-text">{t('home.modes.hotseat')}</span>
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
                {t('home.social.friends')}
              </button>
              <button 
                className={`social-tab ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                {t('home.social.chat')}
              </button>
              <button 
                className={`social-tab ${activeTab === 'ai' ? 'active' : ''}`}
                onClick={() => setActiveTab('ai')}
              >
                {t('home.social.info')}
              </button>
            </div>

            <div className="social-content">
              {activeTab === 'friends' && renderFriendsPanel()}
              {activeTab === 'chat' && (
                <div className="chat-tab">
                  <div className="chat-overlay-trigger" onClick={() => openChatOverlay('world')}>
                    <div className="chat-trigger-copy">
                      <div className="chat-trigger-title">Truyền Âm nhanh</div>
                      <div className="chat-trigger-sub">Nhấn để mở cửa sổ chat to giữa màn hình</div>
                    </div>
                    <button className="chat-send-btn" type="button">Mở</button>
                  </div>
                  <div className="chat-trigger-row">
                    <input
                      type="text"
                      placeholder="Nhắn Thế giới..."
                      onFocus={() => openChatOverlay('world')}
                      readOnly
                    />
                    <input
                      type="text"
                      placeholder="Chọn bạn bè để trò chuyện"
                      onFocus={() => openChatOverlay('friend')}
                      readOnly
                    />
                    <button className="chat-send-btn" type="button" onClick={() => openChatOverlay('ai')}>
                      Hỏi Cao nhân
                    </button>
                  </div>
                </div>
              )}
              {activeTab === 'ai' && (
                <div className="chat-tab">
                  <div className="info-placeholder">
                    Hỏi đáp Cao nhân AI theo các mức Basic / Trial / Pro.
                    <div style={{ marginTop: 12 }}>
                      <button className="chat-send-btn" type="button" onClick={() => openChatOverlay('ai')}>
                        Mở khung AI
                      </button>
                    </div>
                  </div>
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
              {t('home.social.friends')}
            </button>
            <button 
              className={`social-tab ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              {t('home.social.chat')}
            </button>
            <button 
              className={`social-tab ${activeTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              {t('home.social.info')}
            </button>
          </div>

          <div className="social-content">
            {activeTab === 'friends' && renderFriendsPanel()}
            {activeTab === 'chat' && (
              <div className="chat-tab">
                <div className="chat-overlay-trigger" onClick={() => openChatOverlay('world')}>
                  <div className="chat-trigger-copy">
                    <div className="chat-trigger-title">Truyền Âm nhanh</div>
                    <div className="chat-trigger-sub">Nhấn để mở cửa sổ chat to giữa màn hình</div>
                  </div>
                  <button className="chat-send-btn" type="button">Mở</button>
                </div>
                <div className="chat-trigger-row">
                  <input
                    type="text"
                    placeholder="Nhắn Thế giới..."
                    onFocus={() => openChatOverlay('world')}
                    readOnly
                  />
                  <input
                    type="text"
                    placeholder="Chọn bạn bè để trò chuyện"
                    onFocus={() => openChatOverlay('friend')}
                    readOnly
                  />
                  <button className="chat-send-btn" type="button" onClick={() => openChatOverlay('ai')}>
                    Hỏi Cao nhân
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'ai' && (
              <div className="chat-tab">
                <div className="info-placeholder">
                  Hỏi đáp Cao nhân AI theo các mức Basic / Trial / Pro.
                  <div style={{ marginTop: 12 }}>
                    <button className="chat-send-btn" type="button" onClick={() => openChatOverlay('ai')}>
                      Mở khung AI
                    </button>
                  </div>
                </div>
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
            <h3 style={{ margin: 0, fontSize: '22px', color: '#fff', fontWeight: 700 }}>{t('home.training.title')}</h3>
            <p style={{ color: '#cbd5f5', marginTop: '6px', fontSize: '14px' }}>
              {t('home.training.subtitle')}
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

      {/* Friend Request Notification Toast */}
      {showFriendNotification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 20000,
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.95), rgba(99, 102, 241, 0.95))',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '16px 20px',
            minWidth: '300px',
            boxShadow: '0 8px 32px rgba(34, 211, 238, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '24px' }}>🔔</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>
                {notificationMessage}
              </div>
            </div>
            <button
              onClick={() => setShowFriendNotification(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '4px',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Friend Request Popup */}
      {friendRequestPopup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 15000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            border: '2px solid rgba(34, 211, 238, 0.3)',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            animation: 'scaleIn 0.3s ease-out'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤝</div>
              <h3 style={{ 
                margin: 0, 
                fontSize: '20px', 
                fontWeight: 700, 
                color: 'white',
                marginBottom: '8px'
              }}>
                Lời Mời Kết Bạn
              </h3>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                marginTop: '16px'
              }}>
                {friendRequestPopup.avatar ? (
                  <img 
                    src={friendRequestPopup.avatar} 
                    alt={friendRequestPopup.from}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      border: '2px solid rgba(34, 211, 238, 0.5)',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px'
                  }}>
                    👤
                  </div>
                )}
                <div style={{ textAlign: 'left' }}>
                  <div style={{ 
                    color: '#22D3EE', 
                    fontSize: '18px', 
                    fontWeight: 600 
                  }}>
                    {friendRequestPopup.from}
                  </div>
                  <div style={{ 
                    color: '#94a3b8', 
                    fontSize: '13px' 
                  }}>
                    muốn kết bạn với bạn
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={async () => {
                  try {
                    await respondToRequest(friendRequestPopup.requestId, 'reject')
                    setFriendRequestPopup(null)
                    if (blockFor5Min) {
                      // TODO: Implement 5-minute block logic
                      console.log('Block for 5 minutes enabled')
                    }
                  } catch (e) {
                    console.error('Failed to reject:', e)
                  }
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#EF4444',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
              >
                Từ chối
              </button>
              <button
                onClick={async () => {
                  try {
                    await respondToRequest(friendRequestPopup.requestId, 'accept')
                    setFriendRequestPopup(null)
                    setNotificationMessage(`Đã kết bạn với ${friendRequestPopup.from}!`)
                    setShowFriendNotification(true)
                    setTimeout(() => setShowFriendNotification(false), 3000)
                  } catch (e) {
                    console.error('Failed to accept:', e)
                  }
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #22D3EE, #06B6D4)',
                  color: 'white',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(34, 211, 238, 0.4)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(34, 211, 238, 0.6)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 211, 238, 0.4)'
                }}
              >
                Chấp nhận
              </button>
            </div>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: '#94a3b8',
                fontSize: '13px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={blockFor5Min}
                  onChange={(e) => setBlockFor5Min(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Chặn trong 5 phút nếu từ chối</span>
              </label>
            </div>
          </div>
        </div>
      )}

      <HomeChatOverlay
        isOpen={chatOverlayOpen}
        onClose={() => setChatOverlayOpen(false)}
        userId={user?.id}
        displayName={userDisplayName}
        friends={acceptedFriends}
        initialTab={chatOverlayTab}
      />

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
      {/* Removed floating AI Analysis trigger to avoid duplication */}
    </div>
    </>
  )
}
