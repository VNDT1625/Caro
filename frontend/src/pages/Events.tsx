import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'

interface EventReward {
  id: string
  title: string
  target: number
  current: number
  reward: { coin: number; gem: number; item?: string }
  claimed: boolean
}

interface GameEvent {
  id: string
  icon: string
  name: string
  description: string
  startDate: string
  endDate: string
  type: 'hot' | 'new' | 'ending' | 'permanent'
  rewards: EventReward[]
}

export default function Events() {
  const { t } = useLanguage()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [events, setEvents] = useState<GameEvent[]>([])
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [showDetail, setShowDetail] = useState(false)

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      if (!mobile) setShowDetail(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate time remaining
  function getTimeRemaining(endDate: string): { text: string; urgent: boolean } {
    const [day, month, year] = endDate.split('/')
    const end = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const now = new Date()
    const diff = end.getTime() - now.getTime()
    
    if (diff <= 0) return { text: t('events.ended'), urgent: false }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (days > 7) return { text: `${days} ${t('events.daysLeft')}`, urgent: false }
    if (days > 0) return { text: `${days} ${t('events.daysLeft')}`, urgent: days <= 3 }
    return { text: `${hours} ${t('events.hoursLeft')}`, urgent: true }
  }

  // Get type badge
  function getTypeBadge(type: GameEvent['type']) {
    switch (type) {
      case 'hot': return { text: t('events.badge.hot'), color: '#EF4444' }
      case 'new': return { text: t('events.badge.new'), color: '#22D3EE' }
      case 'ending': return { text: t('events.badge.ending'), color: '#F59E0B' }
      case 'permanent': return { text: t('events.badge.permanent'), color: '#8B5CF6' }
      default: return null
    }
  }

  useEffect(() => {
    const sampleEvents: GameEvent[] = [
      {
        id: 'noel_2025',
        icon: '🎄',
        name: t('events.noel.name'),
        description: t('events.noel.desc'),
        startDate: '01/12/2025',
        endDate: '25/12/2025',
        type: 'hot',
        rewards: [
          { id: 'noel1', title: t('events.reward.loginNDays', { n: 1 }), target: 1, current: 0, reward: { coin: 100, gem: 10 }, claimed: false },
          { id: 'noel3', title: t('events.reward.loginNDays', { n: 3 }), target: 3, current: 0, reward: { coin: 300, gem: 30 }, claimed: false },
          { id: 'noel5', title: t('events.reward.loginNDays', { n: 5 }), target: 5, current: 0, reward: { coin: 500, gem: 50 }, claimed: false },
          { id: 'noel7', title: t('events.reward.loginNDays', { n: 7 }), target: 7, current: 0, reward: { coin: 1000, gem: 100, item: t('events.item.santaAvatar') }, claimed: false },
        ]
      },
      {
        id: 'new_year_2026',
        icon: '🎆',
        name: t('events.newyear.name'),
        description: t('events.newyear.desc'),
        startDate: '25/12/2025',
        endDate: '15/01/2026',
        type: 'new',
        rewards: [
          { id: 'ny1', title: t('events.reward.playNMatches', { n: 5 }), target: 5, current: 0, reward: { coin: 200, gem: 20 }, claimed: false },
          { id: 'ny2', title: t('events.reward.winNMatches', { n: 3 }), target: 3, current: 0, reward: { coin: 500, gem: 50 }, claimed: false },
          { id: 'ny3', title: t('events.reward.loginNDays', { n: 7 }), target: 7, current: 0, reward: { coin: 1000, gem: 100, item: t('events.item.snakeFrame') }, claimed: false },
        ]
      },
      {
        id: 'weekend_bonus',
        icon: '🎁',
        name: t('events.weekend.name'),
        description: t('events.weekend.desc'),
        startDate: '06/12/2025',
        endDate: '08/12/2025',
        type: 'ending',
        rewards: [
          { id: 'wb1', title: t('events.reward.winNMatches', { n: 3 }), target: 3, current: 0, reward: { coin: 300, gem: 30 }, claimed: false },
          { id: 'wb2', title: t('events.reward.winNMatches', { n: 5 }), target: 5, current: 0, reward: { coin: 600, gem: 60, item: t('events.item.hotStreak') }, claimed: false },
        ]
      },
      {
        id: 'first_win',
        icon: '🏆',
        name: t('events.firstwin.name'),
        description: t('events.firstwin.desc'),
        startDate: '01/01/2025',
        endDate: '31/12/2025',
        type: 'permanent',
        rewards: [
          { id: 'fw1', title: t('events.reward.playFirstMatch'), target: 1, current: 0, reward: { coin: 100, gem: 50 }, claimed: false },
          { id: 'fw2', title: t('events.reward.winFirstMatch'), target: 1, current: 0, reward: { coin: 300, gem: 100 }, claimed: false },
          { id: 'fw3', title: t('events.reward.playNMatches', { n: 10 }), target: 10, current: 0, reward: { coin: 500, gem: 200, item: t('events.item.starterPack') }, claimed: false },
        ]
      }
    ]

    setEvents(sampleEvents)
    setSelectedEventId(sampleEvents[0]?.id || null)
    loadUser(sampleEvents)
  }, [t])

  async function checkDailyLogin(prof: any) {
    const today = new Date().toISOString().split('T')[0]
    const eventData = prof.metadata?.events || {}
    const lastLogin = eventData.lastLoginDate
    
    if (lastLogin === today) return prof

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    let consecutiveLogins = eventData.consecutiveLogins || 0
    consecutiveLogins = (lastLogin === yesterdayStr) ? consecutiveLogins + 1 : 1

    const newMetadata = {
      ...prof.metadata,
      events: { ...eventData, lastLoginDate: today, consecutiveLogins }
    }

    await supabase
      .from('profiles')
      .update({ metadata: newMetadata })
      .eq('user_id', prof.user_id)

    return { ...prof, metadata: newMetadata }
  }

  async function loadUser(eventList: GameEvent[]) {
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
          const updatedProf = await checkDailyLogin(prof)
          setProfile(updatedProf)
          loadEventProgress(updatedProf, eventList)
        }
      }
    } catch (e) {
      console.error('Load user failed:', e)
    }
  }

  function loadEventProgress(prof: any, eventList: GameEvent[]) {
    const eventData = prof.metadata?.events || {}
    const consecutiveLogins = eventData.consecutiveLogins || 0
    const todayMatches = eventData.todayMatches || 0
    const totalWins = prof.total_wins || 0

    const updatedEvents = eventList.map(event => {
      const rewards = event.rewards.map(reward => {
        let current = 0
        let claimed = eventData[event.id]?.[reward.id] || false

        if (reward.title.includes('Đăng nhập') || reward.title.includes('Login')) {
          current = consecutiveLogins
        } else if (reward.title.includes('Chơi') || reward.title.includes('Play')) {
          current = todayMatches
        } else if (reward.title.includes('Thắng') || reward.title.includes('Win')) {
          current = totalWins
        }

        return { ...reward, current, claimed }
      })

      return { ...event, rewards }
    })

    setEvents(updatedEvents)
  }

  async function claimReward(eventId: string, rewardId: string) {
    if (!user || !profile) return

    const event = events.find(e => e.id === eventId)
    const reward = event?.rewards.find(r => r.id === rewardId)
    if (!reward || reward.claimed || reward.current < reward.target) return

    if (claimingId) return
    setClaimingId(rewardId)

    try {
      const coinReward = reward.reward.coin || 0
      const gemReward = reward.reward.gem || 0
      const newCoins = (profile.coins || 0) + coinReward
      const newGems = (profile.gems || 0) + gemReward

      const eventData = { ...(profile.metadata?.events || {}) }
      if (!eventData[eventId]) eventData[eventId] = {}
      eventData[eventId][rewardId] = true

      const newMetadata = { ...profile.metadata, events: eventData }

      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update({ coins: newCoins, gems: newGems, metadata: newMetadata })
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Failed to claim reward:', error)
        setClaimingId(null)
        return
      }

      setProfile(updatedProfile)
      
      setEvents(prev => prev.map(e => {
        if (e.id !== eventId) return e
        return { ...e, rewards: e.rewards.map(r => r.id === rewardId ? { ...r, claimed: true } : r) }
      }))

      window.dispatchEvent(new CustomEvent('profileUpdated', {
        detail: { field: 'currency', coins: updatedProfile.coins, gems: updatedProfile.gems }
      }))

      setClaimingId(null)
    } catch (e) {
      console.error('Claim reward failed:', e)
      setClaimingId(null)
    }
  }

  const selectedEvent = events.find(e => e.id === selectedEventId)

  return (
    <div className="app-container">
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span 
            onClick={() => window.location.hash = '#home'} 
            style={{ fontSize: '13px', color: 'var(--color-muted)', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-muted)'}
          >
            {t('breadcrumb.home')}
          </span>
          <span style={{ color: 'var(--color-muted)' }}>›</span>
          <span style={{ fontSize: '13px', color: 'var(--color-text)', fontWeight: 500 }}>{t('events.title')}</span>
        </div>
        <h1 style={{
          margin: 0,
          fontSize: '26px',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          🎉 {t('events.title')}
        </h1>
        <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--color-muted)' }}>
          {t('events.subtitle')}
        </p>
      </div>

      {/* Main Layout */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '12px' : '20px',
        height: isMobile ? 'auto' : 'calc(100vh - 200px)',
        minHeight: isMobile ? 'auto' : '450px'
      }}>
        {/* Left: Event List - Hidden on mobile when showing detail */}
        <div style={{
          width: isMobile ? '100%' : '340px',
          flexShrink: 0,
          display: isMobile && showDetail ? 'none' : 'flex',
          flexDirection: 'column',
          gap: '12px',
          overflowY: isMobile ? 'visible' : 'auto',
          paddingRight: isMobile ? '0' : '8px',
          maxHeight: isMobile ? 'none' : 'calc(100vh - 200px)'
        }}>
          {events.map((event) => {
            const isSelected = selectedEventId === event.id
            const claimableCount = event.rewards.filter(r => r.current >= r.target && !r.claimed).length
            const timeInfo = getTimeRemaining(event.endDate)
            const badge = getTypeBadge(event.type)

            return (
              <div
                key={event.id}
                onClick={() => {
                  setSelectedEventId(event.id)
                  if (isMobile) setShowDetail(true)
                }}
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(239,68,68,0.08))'
                    : 'rgba(255,255,255,0.03)',
                  border: isSelected
                    ? '2px solid rgba(245,158,11,0.4)'
                    : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {/* Claimable indicator */}
                {claimableCount > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '4px 8px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 8px rgba(239,68,68,0.4)'
                  }}>
                    🎁 {claimableCount}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '14px' }}>
                  {/* Icon */}
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '12px',
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.15))'
                      : 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '26px',
                    flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    {event.icon}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      {badge && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: `${badge.color}20`,
                          color: badge.color
                        }}>
                          {badge.text}
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: isSelected ? '#F59E0B' : 'var(--color-text)',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {event.name}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--color-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>📅 {event.startDate} ~ {event.endDate}</span>
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: timeInfo.urgent ? '#EF4444' : 'var(--color-muted)',
                      marginTop: '4px',
                      fontWeight: timeInfo.urgent ? 600 : 400
                    }}>
                      ⏳ {timeInfo.text}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Right: Event Detail */}
        <div className="panel" style={{
          flex: 1,
          display: isMobile && !showDetail ? 'none' : 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
          maxHeight: isMobile ? 'none' : 'calc(100vh - 200px)'
        }}>
          {selectedEvent ? (
            <>
              {/* Event Header */}
              <div style={{
                padding: isMobile ? '14px 16px' : '20px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(239,68,68,0.03))'
              }}>
                {/* Back button for mobile */}
                {isMobile && (
                  <button
                    onClick={() => setShowDetail(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: 'var(--color-muted)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      marginBottom: '12px'
                    }}
                  >
                    ← {t('common.back') || 'Quay lại'}
                  </button>
                )}
                <div style={{ 
                  display: 'flex', 
                  alignItems: isMobile ? 'flex-start' : 'center', 
                  gap: isMobile ? '12px' : '16px',
                  flexDirection: isMobile ? 'column' : 'row'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: isMobile ? '100%' : 'auto' }}>
                    <div style={{
                      width: isMobile ? '48px' : '64px',
                      height: isMobile ? '48px' : '64px',
                      borderRadius: isMobile ? '12px' : '16px',
                      background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.15))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isMobile ? '24px' : '32px',
                      border: '2px solid rgba(245,158,11,0.3)',
                      flexShrink: 0
                    }}>
                      {selectedEvent.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{
                        margin: 0,
                        fontSize: isMobile ? '18px' : '22px',
                        fontWeight: 700,
                        color: '#F59E0B'
                      }}>
                        {selectedEvent.name}
                      </h2>
                      <p style={{
                        margin: '4px 0 0 0',
                        fontSize: isMobile ? '12px' : '13px',
                        color: 'var(--color-muted)',
                        display: isMobile ? '-webkit-box' : 'block',
                        WebkitLineClamp: isMobile ? 2 : 'unset',
                        WebkitBoxOrient: 'vertical',
                        overflow: isMobile ? 'hidden' : 'visible'
                      }}>
                        {selectedEvent.description}
                      </p>
                    </div>
                  </div>
                  <div style={{
                    textAlign: isMobile ? 'left' : 'right',
                    fontSize: '12px',
                    color: 'var(--color-muted)',
                    display: 'flex',
                    flexDirection: isMobile ? 'row' : 'column',
                    gap: isMobile ? '12px' : '2px',
                    flexWrap: 'wrap',
                    alignItems: isMobile ? 'center' : 'flex-end'
                  }}>
                    <div>📅 {selectedEvent.startDate} ~ {selectedEvent.endDate}</div>
                    <div style={{
                      fontWeight: 600,
                      color: getTimeRemaining(selectedEvent.endDate).urgent ? '#EF4444' : '#F59E0B'
                    }}>
                      ⏳ {getTimeRemaining(selectedEvent.endDate).text}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rewards List */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: isMobile ? '14px 12px' : '20px 24px'
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🎁 {t('quests.rewards')} ({selectedEvent.rewards.filter(r => r.claimed).length}/{selectedEvent.rewards.length} {t('events.claimed').toLowerCase()})
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedEvent.rewards.map((reward, idx) => {
                    const progress = Math.min((reward.current / reward.target) * 100, 100)
                    const canClaim = reward.current >= reward.target && !reward.claimed

                    return (
                      <div
                        key={reward.id}
                        style={{
                          display: 'flex',
                          alignItems: isMobile ? 'flex-start' : 'center',
                          flexDirection: isMobile ? 'column' : 'row',
                          gap: isMobile ? '10px' : '16px',
                          padding: isMobile ? '12px' : '16px 18px',
                          background: reward.claimed
                            ? 'rgba(74,222,128,0.05)'
                            : canClaim
                            ? 'linear-gradient(90deg, rgba(245,158,11,0.08), rgba(239,68,68,0.05))'
                            : 'rgba(255,255,255,0.02)',
                          borderRadius: '12px',
                          border: canClaim
                            ? '1px solid rgba(245,158,11,0.3)'
                            : reward.claimed
                            ? '1px solid rgba(74,222,128,0.2)'
                            : '1px solid rgba(255,255,255,0.05)',
                          opacity: reward.claimed ? 0.6 : 1,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Top row: Step number + Info */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: isMobile ? '10px' : '16px',
                          width: '100%'
                        }}>
                          {/* Step number */}
                          <div style={{
                            width: isMobile ? '32px' : '36px',
                            height: isMobile ? '32px' : '36px',
                            borderRadius: '10px',
                            background: reward.claimed
                              ? 'rgba(74,222,128,0.2)'
                              : canClaim
                              ? 'linear-gradient(135deg, #F59E0B, #EF4444)'
                              : 'rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: isMobile ? '12px' : '14px',
                            fontWeight: 700,
                            color: reward.claimed ? '#4ADE80' : 'white',
                            flexShrink: 0
                          }}>
                            {reward.claimed ? '✓' : idx + 1}
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: isMobile ? '13px' : '14px',
                              fontWeight: 500,
                              color: 'var(--color-text)',
                              marginBottom: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              flexWrap: 'wrap'
                            }}>
                              <span style={{ 
                                wordBreak: 'break-word',
                                flex: isMobile ? '1 1 100%' : 'unset'
                              }}>{reward.title}</span>
                              <span style={{
                                fontSize: '12px',
                                color: canClaim ? '#F59E0B' : 'var(--color-muted)',
                                fontWeight: canClaim ? 600 : 400
                              }}>
                                {reward.current}/{reward.target}
                              </span>
                            </div>
                            
                            {/* Progress bar */}
                            <div style={{
                              width: '100%',
                              height: '4px',
                              background: 'rgba(255,255,255,0.1)',
                              borderRadius: '2px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${progress}%`,
                                height: '100%',
                                background: reward.claimed
                                  ? 'rgba(74,222,128,0.5)'
                                  : canClaim
                                  ? 'linear-gradient(90deg, #F59E0B, #EF4444)'
                                  : 'rgba(255,255,255,0.3)',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          </div>
                        </div>

                        {/* Bottom row on mobile: Rewards + Button */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          width: '100%',
                          justifyContent: isMobile ? 'space-between' : 'flex-end',
                          marginLeft: isMobile ? '0' : 'auto'
                        }}>
                          {/* Rewards */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: isMobile ? '8px' : '12px',
                            padding: isMobile ? '6px 10px' : '8px 14px',
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '8px',
                            flexShrink: 0
                          }}>
                            {reward.reward.coin > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <img src="/coin.png" alt="coin" style={{ width: isMobile ? '16px' : '18px', height: isMobile ? '16px' : '18px', objectFit: 'contain' }} />
                                <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: 600, color: '#FBBF24' }}>
                                  {reward.reward.coin}
                                </span>
                              </div>
                            )}
                            {reward.reward.gem > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <img src="/gem.png" alt="gem" style={{ width: isMobile ? '16px' : '18px', height: isMobile ? '16px' : '18px', objectFit: 'contain' }} />
                                <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: 600, color: '#22D3EE' }}>
                                  {reward.reward.gem}
                                </span>
                              </div>
                            )}
                            {reward.reward.item && (
                              <div style={{
                                fontSize: isMobile ? '11px' : '12px',
                                color: '#A78BFA',
                                fontWeight: 500,
                                maxWidth: isMobile ? '80px' : '120px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {reward.reward.item}
                              </div>
                            )}
                          </div>

                          {/* Claim button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              canClaim && !claimingId && claimReward(selectedEvent.id, reward.id)
                            }}
                            disabled={!canClaim || reward.claimed || claimingId === reward.id}
                            style={{
                              padding: isMobile ? '8px 14px' : '10px 20px',
                              borderRadius: '8px',
                              border: 'none',
                              background: reward.claimed
                                ? 'rgba(74,222,128,0.15)'
                                : canClaim
                                ? 'linear-gradient(135deg, #F59E0B, #EF4444)'
                                : 'rgba(255,255,255,0.08)',
                              color: reward.claimed
                                ? '#4ADE80'
                                : canClaim
                                ? 'white'
                                : 'var(--color-muted)',
                              fontSize: isMobile ? '12px' : '13px',
                              fontWeight: 600,
                              cursor: canClaim && !claimingId ? 'pointer' : 'default',
                              minWidth: isMobile ? '70px' : '80px',
                              transition: 'all 0.2s ease',
                              boxShadow: canClaim ? '0 4px 15px rgba(245,158,11,0.3)' : 'none',
                              flexShrink: 0
                            }}
                          >
                            {reward.claimed
                              ? `✓ ${t('events.claimed')}`
                              : claimingId === reward.id
                              ? '...'
                              : canClaim
                              ? t('events.claimReward')
                              : t('events.progress')}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-muted)'
            }}>
              {t('events.selectEvent')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
