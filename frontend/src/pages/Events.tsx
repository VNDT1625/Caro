import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface EventReward {
  day?: number
  matches?: number
  coin: number
  gem: number
  claimed: boolean
}

export default function Events() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [currentBanner, setCurrentBanner] = useState(0)
  const [loginRewards, setLoginRewards] = useState<EventReward[]>([])
  const [matchRewards, setMatchRewards] = useState<EventReward[]>([])
  const [consecutiveLogins, setConsecutiveLogins] = useState(0)
  const [todayMatches, setTodayMatches] = useState(0)

  const banners = [
    {
      id: 1,
      title: 'Sự Kiện Đăng Nhập',
      subtitle: 'Đăng nhập mỗi ngày nhận thưởng',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      icon: '📅',
      type: 'login'
    },
    {
      id: 2,
      title: 'Sự Kiện Chiến Đấu',
      subtitle: 'Chơi trận nhận Tinh Thạch và Gem',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      icon: '⚔️',
      type: 'matches'
    },
    {
      id: 3,
      title: 'Sự Kiện Đặc Biệt',
      subtitle: 'Săn Gem khủng cuối tuần',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      icon: '🎁',
      type: 'special'
    }
  ]

  useEffect(() => {
    loadUser()
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
          loadEventProgress(prof)
        }
      }
    } catch (e) {
      console.error('Load user failed:', e)
    }
  }

  function loadEventProgress(prof: any) {
    const eventData = prof.metadata?.events || {}
    
    // Login rewards: 7 days
    const loginRewardList: EventReward[] = [
      { day: 1, coin: 50, gem: 0, claimed: eventData.login?.[1] || false },
      { day: 2, coin: 100, gem: 0, claimed: eventData.login?.[2] || false },
      { day: 3, coin: 150, gem: 5, claimed: eventData.login?.[3] || false },
      { day: 4, coin: 200, gem: 0, claimed: eventData.login?.[4] || false },
      { day: 5, coin: 250, gem: 10, claimed: eventData.login?.[5] || false },
      { day: 6, coin: 300, gem: 0, claimed: eventData.login?.[6] || false },
      { day: 7, coin: 500, gem: 20, claimed: eventData.login?.[7] || false }
    ]

    // Match rewards: 5 milestones
    const matchRewardList: EventReward[] = [
      { matches: 1, coin: 30, gem: 0, claimed: eventData.matches?.[1] || false },
      { matches: 3, coin: 100, gem: 0, claimed: eventData.matches?.[3] || false },
      { matches: 5, coin: 200, gem: 5, claimed: eventData.matches?.[5] || false },
      { matches: 10, coin: 400, gem: 10, claimed: eventData.matches?.[10] || false },
      { matches: 20, coin: 1000, gem: 30, claimed: eventData.matches?.[20] || false }
    ]

    setLoginRewards(loginRewardList)
    setMatchRewards(matchRewardList)
    setConsecutiveLogins(eventData.consecutiveLogins || 0)
    setTodayMatches(eventData.todayMatches || 0)
  }

  async function claimLoginReward(day: number) {
    if (!user || !profile) return
    
    const reward = loginRewards.find(r => r.day === day)
    if (!reward || reward.claimed) return
    if (consecutiveLogins < day) {
      alert('Bạn chưa đủ điều kiện nhận thưởng này!')
      return
    }

    try {
      const newCoins = (profile.coins || 0) + reward.coin
      const newGems = (profile.gems || 0) + reward.gem

      const eventData = profile.metadata?.events || {}
      if (!eventData.login) eventData.login = {}
      eventData.login[day] = true

      const newMetadata = {
        ...profile.metadata,
        events: eventData
      }

      await supabase
        .from('profiles')
        .update({ 
          coins: newCoins, 
          gems: newGems,
          metadata: newMetadata
        })
        .eq('user_id', user.id)

      setProfile({ ...profile, coins: newCoins, gems: newGems, metadata: newMetadata })
      setLoginRewards(prev => prev.map(r => 
        r.day === day ? { ...r, claimed: true } : r
      ))

      alert(`Đã nhận ${reward.coin} Tinh Thạch${reward.gem > 0 ? ` và ${reward.gem} Gem` : ''}!`)
    } catch (e) {
      console.error('Claim login reward failed:', e)
      alert('Lỗi khi nhận thưởng!')
    }
  }

  async function claimMatchReward(matches: number) {
    if (!user || !profile) return
    
    const reward = matchRewards.find(r => r.matches === matches)
    if (!reward || reward.claimed) return
    if (todayMatches < matches) {
      alert(`Bạn cần chơi ${matches} trận để nhận thưởng này! (Hiện tại: ${todayMatches} trận)`)
      return
    }

    try {
      const newCoins = (profile.coins || 0) + reward.coin
      const newGems = (profile.gems || 0) + reward.gem

      const eventData = profile.metadata?.events || {}
      if (!eventData.matches) eventData.matches = {}
      eventData.matches[matches] = true

      const newMetadata = {
        ...profile.metadata,
        events: eventData
      }

      await supabase
        .from('profiles')
        .update({ 
          coins: newCoins, 
          gems: newGems,
          metadata: newMetadata
        })
        .eq('user_id', user.id)

      setProfile({ ...profile, coins: newCoins, gems: newGems, metadata: newMetadata })
      setMatchRewards(prev => prev.map(r => 
        r.matches === matches ? { ...r, claimed: true } : r
      ))

      alert(`Đã nhận ${reward.coin} Tinh Thạch${reward.gem > 0 ? ` và ${reward.gem} Gem` : ''}!`)
    } catch (e) {
      console.error('Claim match reward failed:', e)
      alert('Lỗi khi nhận thưởng!')
    }
  }

  const nextBanner = () => {
    setCurrentBanner((prev) => (prev + 1) % banners.length)
  }

  const prevBanner = () => {
    setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)
  }

  const currentBannerData = banners[currentBanner]

  return (
    <div className="app-container" style={{ paddingTop: '32px' }}>
      {/* Breadcrumb Navigation */}
      <nav style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '13px', 
        color: 'var(--color-muted)',
        marginBottom: '16px',
        paddingLeft: '24px'
      }}>
        <a 
          href="#home" 
          style={{ 
            color: 'var(--color-muted)', 
            textDecoration: 'none',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-muted)'}
        >
          Chánh Điện
        </a>
        <span style={{ color: 'var(--color-muted)' }}>›</span>
        <span style={{ color: 'var(--color-text)' }}>Sự Kiện</span>
      </nav>

      <div className="grid-3">
        {/* Left Sidebar */}
        <div className="panel" style={{ height: 'fit-content' }}>
          <div className="menu-list">
            <div style={{ 
              padding: '12px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(90deg, rgba(245,158,11,0.08), rgba(251,191,36,0.05))',
              border: '1px solid rgba(245,158,11,0.2)',
              fontWeight: 600,
              color: '#F59E0B'
            }}>
              🎉 Sự Kiện
            </div>
          </div>
        </div>

        {/* Center Content */}
        <div className="panel" style={{ padding: '24px' }}>
          {/* Banner Carousel */}
          <div style={{ 
            position: 'relative', 
            width: '100%', 
            height: '280px',
            borderRadius: '16px',
            overflow: 'hidden',
            marginBottom: '32px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            {/* Banner Content */}
            <div style={{
              width: '100%',
              height: '100%',
              background: currentBannerData.gradient,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              transition: 'all 0.5s ease'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>
                {currentBannerData.icon}
              </div>
              <h2 style={{ fontSize: '32px', fontWeight: 700, margin: '0 0 8px 0', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                {currentBannerData.title}
              </h2>
              <p style={{ fontSize: '16px', opacity: 0.9, margin: 0 }}>
                {currentBannerData.subtitle}
              </p>
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={prevBanner}
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)',
                color: 'white',
                fontSize: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                zIndex: 10
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            >
              ←
            </button>
            <button
              onClick={nextBanner}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)',
                color: 'white',
                fontSize: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                zIndex: 10
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            >
              →
            </button>

            {/* Dots Indicator */}
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '8px',
              zIndex: 10
            }}>
              {banners.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentBanner(index)}
                  style={{
                    width: currentBanner === index ? '24px' : '8px',
                    height: '8px',
                    borderRadius: '4px',
                    border: 'none',
                    background: currentBanner === index ? 'white' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Event Content Based on Current Banner */}
          {currentBannerData.type === 'login' && (
            <div>
              <h3 style={{ fontSize: '24px', marginBottom: '20px', color: 'var(--color-primary)' }}>
                📅 Điểm Danh Hàng Ngày
              </h3>
              <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(102,126,234,0.1)', borderRadius: '12px', border: '1px solid rgba(102,126,234,0.3)' }}>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text)' }}>
                  Đăng nhập liên tục: <strong style={{ color: '#667eea', fontSize: '18px' }}>{consecutiveLogins} ngày</strong>
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                {loginRewards.map((reward) => (
                  <div
                    key={reward.day}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: reward.claimed 
                        ? 'rgba(255,255,255,0.02)' 
                        : reward.day! <= consecutiveLogins
                        ? 'linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.1))'
                        : 'rgba(255,255,255,0.05)',
                      border: reward.claimed
                        ? '1px solid rgba(255,255,255,0.05)'
                        : reward.day! <= consecutiveLogins
                        ? '2px solid rgba(102,126,234,0.4)'
                        : '1px solid rgba(255,255,255,0.1)',
                      textAlign: 'center',
                      opacity: reward.claimed ? 0.5 : 1,
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                      {reward.day === 7 ? '🎁' : '📅'}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text)' }}>
                      Ngày {reward.day}
                    </div>
                    <div style={{ fontSize: '14px', marginBottom: '4px', color: '#FBBF24' }}>
                      💰 {reward.coin}
                    </div>
                    {reward.gem > 0 && (
                      <div style={{ fontSize: '14px', marginBottom: '12px', color: '#22D3EE' }}>
                        💎 {reward.gem}
                      </div>
                    )}
                    {!reward.claimed ? (
                      reward.day! <= consecutiveLogins ? (
                        <button
                          onClick={() => claimLoginReward(reward.day!)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #667eea, #764ba2)',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                          Nhận
                        </button>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--color-muted)', padding: '8px' }}>
                          🔒 Chưa mở
                        </div>
                      )
                    ) : (
                      <div style={{ fontSize: '12px', color: '#4ADE80', fontWeight: 600, padding: '8px' }}>
                        ✓ Đã nhận
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentBannerData.type === 'matches' && (
            <div>
              <h3 style={{ fontSize: '24px', marginBottom: '20px', color: 'var(--color-primary)' }}>
                ⚔️ Nhiệm Vụ Chiến Đấu
              </h3>
              <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(240,147,251,0.1)', borderRadius: '12px', border: '1px solid rgba(240,147,251,0.3)' }}>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text)' }}>
                  Số trận hôm nay: <strong style={{ color: '#f093fb', fontSize: '18px' }}>{todayMatches} trận</strong>
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {matchRewards.map((reward) => (
                  <div
                    key={reward.matches}
                    style={{
                      padding: '20px',
                      borderRadius: '12px',
                      background: reward.claimed 
                        ? 'rgba(255,255,255,0.02)' 
                        : todayMatches >= reward.matches!
                        ? 'linear-gradient(135deg, rgba(240,147,251,0.15), rgba(245,87,108,0.1))'
                        : 'rgba(255,255,255,0.05)',
                      border: reward.claimed
                        ? '1px solid rgba(255,255,255,0.05)'
                        : todayMatches >= reward.matches!
                        ? '2px solid rgba(240,147,251,0.4)'
                        : '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: reward.claimed ? 0.5 : 1,
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text)' }}>
                        {reward.matches === 20 ? '🏆' : '⚔️'} Chơi {reward.matches} trận
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ fontSize: '14px', color: '#FBBF24', fontWeight: 600 }}>
                          💰 {reward.coin} Tinh Thạch
                        </div>
                        {reward.gem > 0 && (
                          <div style={{ fontSize: '14px', color: '#22D3EE', fontWeight: 600 }}>
                            💎 {reward.gem} Gem
                          </div>
                        )}
                      </div>
                      {/* Progress Bar */}
                      <div style={{ marginTop: '12px', width: '300px' }}>
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--color-muted)',
                          marginBottom: '4px',
                          display: 'flex',
                          justifyContent: 'space-between'
                        }}>
                          <span>Tiến độ</span>
                          <span>{Math.min(todayMatches, reward.matches!)}/{reward.matches}</span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '8px',
                          background: 'rgba(255,255,255,0.1)',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${Math.min((todayMatches / reward.matches!) * 100, 100)}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #f093fb, #f5576c)',
                            transition: 'width 0.3s ease'
                          }}></div>
                        </div>
                      </div>
                    </div>
                    <div>
                      {!reward.claimed ? (
                        todayMatches >= reward.matches! ? (
                          <button
                            onClick={() => claimMatchReward(reward.matches!)}
                            style={{
                              padding: '12px 24px',
                              borderRadius: '10px',
                              border: 'none',
                              background: 'linear-gradient(135deg, #f093fb, #f5576c)',
                              color: 'white',
                              fontSize: '16px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 4px 12px rgba(240,147,251,0.4)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)'
                              e.currentTarget.style.boxShadow = '0 6px 16px rgba(240,147,251,0.6)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)'
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(240,147,251,0.4)'
                            }}
                          >
                            Nhận
                          </button>
                        ) : (
                          <div style={{ fontSize: '14px', color: 'var(--color-muted)', padding: '12px 24px' }}>
                            🔒 Chưa đủ
                          </div>
                        )
                      ) : (
                        <div style={{ 
                          fontSize: '14px', 
                          color: '#4ADE80', 
                          fontWeight: 600,
                          padding: '12px 24px',
                          background: 'rgba(74,222,128,0.1)',
                          borderRadius: '10px',
                          border: '1px solid rgba(74,222,128,0.3)'
                        }}>
                          ✓ Đã nhận
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentBannerData.type === 'special' && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '80px', marginBottom: '20px' }}>🎁</div>
              <h3 style={{ fontSize: '28px', marginBottom: '16px', color: 'var(--color-primary)' }}>
                Sự Kiện Đặc Biệt
              </h3>
              <p style={{ fontSize: '16px', color: 'var(--color-muted)', marginBottom: '24px' }}>
                Sự kiện đặc biệt sẽ được cập nhật vào cuối tuần
              </p>
              <div style={{ 
                display: 'inline-block',
                padding: '16px 32px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(79,172,254,0.2), rgba(0,242,254,0.15))',
                border: '2px solid rgba(79,172,254,0.4)',
                fontSize: '14px',
                color: '#4facfe',
                fontWeight: 600
              }}>
                ⏰ Đang chuẩn bị...
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="panel glass-card" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--color-primary)' }}>
            💰 Về Tinh Thạch
          </h3>
          <div style={{ fontSize: '14px', color: 'var(--color-muted)', lineHeight: '1.6' }}>
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(251,191,36,0.1)', borderRadius: '8px', border: '1px solid rgba(251,191,36,0.2)' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#FBBF24', marginBottom: '8px' }}>
                Tinh Thạch (Coin)
              </div>
              <p style={{ margin: '0 0 8px 0', fontSize: '13px' }}>
                Đơn vị tiền tệ chính trong game, dùng để mua vật phẩm, nâng cấp và mở khóa tính năng.
              </p>
            </div>
            
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(34,211,238,0.1)', borderRadius: '8px', border: '1px solid rgba(34,211,238,0.2)' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#22D3EE', marginBottom: '8px' }}>
                Gem (Ngọc)
              </div>
              <p style={{ margin: '0 0 8px 0', fontSize: '13px' }}>
                Đơn vị cao cấp, dùng để mua vật phẩm hiếm và đổi Tinh Thạch.
              </p>
            </div>

            <div style={{ padding: '12px', background: 'rgba(34,197,94,0.1)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#22C55E', marginBottom: '8px' }}>
                💡 Cách kiếm
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', lineHeight: '1.6' }}>
                <li>Đăng nhập mỗi ngày</li>
                <li>Hoàn thành nhiệm vụ</li>
                <li>Chơi trận đấu</li>
                <li>Tham gia sự kiện</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
