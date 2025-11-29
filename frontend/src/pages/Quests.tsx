import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Quest {
  id: number
  title: string
  desc: string
  coins: number
  gems: number
  exp: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  difficulty: 'Dễ' | 'Trung bình' | 'Khó' | 'Cực khó'
  completed: boolean
  claimed: boolean
  progress?: { current: number; total: number }
}

function formatRewardValue(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return `${value}`
}

// Calculate EXP needed for next level (exponential scaling)
function getExpForLevel(level: number): number {
  // Base: 100 EXP for level 1->2
  // Formula: 100 * level^1.5 (tăng theo cấp bậc)
  return Math.floor(100 * Math.pow(level, 1.5))
}

export default function Quests() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'achievement'>('daily')
  const [quests, setQuests] = useState<Quest[]>([])

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
          loadQuests(prof)
        }
      }
    } catch (e) {
      console.error('Load user failed:', e)
    }
  }

  function loadQuests(prof: any) {
    const questProgress = prof.metadata?.quests || {}
    
    const dailyQuestList: Quest[] = [
      { 
        id: 101, 
        title: 'Chơi 1 trận xếp hạng', 
        desc: 'Thử sức với MindPoint Arena', 
        coins: 30, 
        gems: 0, 
        exp: 50,
        tier: 'bronze', 
        difficulty: 'Dễ',
        completed: false, 
        claimed: questProgress[101] || false,
        progress: { current: 0, total: 1 }
      },
      { 
        id: 102, 
        title: 'Thắng 1 trận bất kỳ', 
        desc: 'Chứng tỏ kỹ năng của bạn', 
        coins: 50, 
        gems: 0, 
        exp: 100,
        tier: 'bronze', 
        difficulty: 'Dễ',
        completed: false, 
        claimed: questProgress[102] || false,
        progress: { current: 0, total: 1 }
      },
      { 
        id: 103, 
        title: 'Chơi 3 trận trong ngày', 
        desc: 'Rèn luyện thường xuyên', 
        coins: 100, 
        gems: 5, 
        exp: 200,
        tier: 'silver', 
        difficulty: 'Trung bình',
        completed: false, 
        claimed: questProgress[103] || false,
        progress: { current: 0, total: 3 }
      },
      { 
        id: 104, 
        title: 'Thắng 3 trận liên tiếp', 
        desc: 'Thể hiện sự ổn định', 
        coins: 200, 
        gems: 10, 
        exp: 300,
        tier: 'gold', 
        difficulty: 'Khó',
        completed: false, 
        claimed: questProgress[104] || false,
        progress: { current: 0, total: 3 }
      }
    ]

    const weeklyQuestList: Quest[] = [
      { 
        id: 201, 
        title: 'Chơi 10 trận xếp hạng', 
        desc: 'Kiên trì leo rank', 
        coins: 200, 
        gems: 5, 
        exp: 500,
        tier: 'bronze', 
        difficulty: 'Dễ',
        completed: false, 
        claimed: questProgress[201] || false,
        progress: { current: 0, total: 10 }
      },
      { 
        id: 202, 
        title: 'Thắng 5 trận xếp hạng', 
        desc: 'Chứng tỏ đẳng cấp', 
        coins: 350, 
        gems: 10, 
        exp: 800,
        tier: 'silver', 
        difficulty: 'Trung bình',
        completed: false, 
        claimed: questProgress[202] || false,
        progress: { current: 0, total: 5 }
      },
      { 
        id: 203, 
        title: 'Leo lên rank cao hơn', 
        desc: 'Tiến bộ trong tuần này', 
        coins: 500, 
        gems: 20, 
        exp: 1000,
        tier: 'gold', 
        difficulty: 'Khó',
        completed: false, 
        claimed: questProgress[203] || false,
        progress: { current: 0, total: 1 }
      }
    ]

    const achievementList: Quest[] = [
      { 
        id: 301, 
        title: '🏆 Thắng 50 trận', 
        desc: 'Chiến thần bất bại', 
        coins: 500, 
        gems: 30, 
        exp: 2000,
        tier: 'gold', 
        difficulty: 'Khó',
        completed: false, 
        claimed: questProgress[301] || false,
        progress: { current: 0, total: 50 }
      },
      { 
        id: 302, 
        title: '💎 Đạt rank Học Kỳ', 
        desc: 'Bậc thầy caro', 
        coins: 1000, 
        gems: 50, 
        exp: 5000,
        tier: 'platinum', 
        difficulty: 'Cực khó',
        completed: false, 
        claimed: questProgress[302] || false,
        progress: { current: 0, total: 1 }
      },
      { 
        id: 303, 
        title: '⚔️ Chơi 100 trận', 
        desc: 'Người không biết mệt', 
        coins: 800, 
        gems: 40, 
        exp: 3000,
        tier: 'gold', 
        difficulty: 'Khó',
        completed: false, 
        claimed: questProgress[303] || false,
        progress: { current: 0, total: 100 }
      }
    ]

    const currentList = activeTab === 'daily' ? dailyQuestList : activeTab === 'weekly' ? weeklyQuestList : achievementList
    setQuests(currentList)
  }

  async function handleClaimQuest(quest: Quest) {
    if (!user || !profile) return
    if (quest.claimed) return

    try {
      const newCoins = (profile.coins || 0) + quest.coins
      const newGems = (profile.gems || 0) + quest.gems
      const newExp = (profile.exp || 0) + quest.exp
      const currentLevel = profile.level || 1
      
      // Calculate level up
      let finalLevel = currentLevel
      let finalExp = newExp
      const expNeeded = getExpForLevel(currentLevel)
      
      if (finalExp >= expNeeded) {
        finalLevel = currentLevel + 1
        finalExp = finalExp - expNeeded
      }

      const questProgress = profile.metadata?.quests || {}
      questProgress[quest.id] = true

      const newMetadata = {
        ...profile.metadata,
        quests: questProgress
      }

      await supabase
        .from('profiles')
        .update({ 
          coins: newCoins, 
          gems: newGems,
          level: finalLevel,
          exp: finalExp,
          metadata: newMetadata
        })
        .eq('user_id', user.id)

      // Show level up notification if leveled up
      if (finalLevel > currentLevel) {
        alert(`🎉 Chúc mừng! Bạn đã lên cấp ${finalLevel}!\n+${quest.exp} EXP`)
      }

      setProfile({ ...profile, coins: newCoins, gems: newGems, level: finalLevel, exp: finalExp, metadata: newMetadata })
      
      setQuests(prev => prev.map(q => 
        q.id === quest.id ? { ...q, claimed: true } : q
      ))

      const parts: string[] = []
      if (quest.gems > 0) parts.push(`${quest.gems} Nguyên Thần`)
      if (quest.coins > 0) parts.push(`${quest.coins} Tinh Thạch`)
      alert(`Đã nhận ${parts.join(' và ') || 'phần thưởng'}!`)
    } catch (e) {
      console.error('Claim quest failed:', e)
      alert('Lỗi khi nhận thưởng!')
    }
  }

  useEffect(() => {
    if (profile) {
      loadQuests(profile)
    }
  }, [activeTab])

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
        <span style={{ color: 'var(--color-text)' }}>Tiên Duyên</span>
      </nav>
      <div className="grid-3">
        {/* Left Sidebar */}
        <div className="panel" style={{ height: 'fit-content' }}>
          <div className="menu-list">
            <div style={{ 
              padding: '12px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(90deg, rgba(34,211,238,0.08), rgba(251,191,36,0.05))',
              border: '1px solid rgba(34,211,238,0.2)',
              fontWeight: 600,
              color: 'var(--color-primary)'
            }}>
              🎯 Nhiệm Vụ
            </div>
          </div>
        </div>

        {/* Center Content */}
        <div className="panel glass-card particle-bg" style={{ minHeight: '700px' }}>
          <h2 className="energy-text" style={{ fontSize: '32px', marginBottom: '24px', textAlign: 'center' }}>
            🎯 Nhiệm Vụ
          </h2>

          {/* Tab Navigation */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            marginBottom: '32px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: '12px'
          }}>
            <button
              onClick={() => setActiveTab('daily')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'daily' ? 'var(--energy-gradient)' : 'rgba(255,255,255,0.03)',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'daily' ? '0 4px 12px rgba(34,211,238,0.4)' : 'none'
              }}
            >
              📅 Hàng Ngày
            </button>
            <button
              onClick={() => setActiveTab('weekly')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'weekly' ? 'var(--energy-gradient)' : 'rgba(255,255,255,0.03)',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'weekly' ? '0 4px 12px rgba(168,85,247,0.4)' : 'none'
              }}
            >
              📆 Hàng Tuần
            </button>
            <button
              onClick={() => setActiveTab('achievement')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'achievement' ? 'var(--energy-gradient)' : 'rgba(255,255,255,0.03)',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'achievement' ? '0 4px 12px rgba(251,191,36,0.4)' : 'none'
              }}
            >
              🏆 Thành Tựu
            </button>
          </div>

          {/* Quest List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {quests.map((quest) => (
              <div
                key={quest.id}
                className={`glass-card quest-${quest.tier} ${quest.claimed ? 'quest-claimed' : ''}`}
                style={{
                  padding: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.3s ease',
                  background: quest.claimed 
                    ? 'rgba(255,255,255,0.02)' 
                    : quest.tier === 'platinum'
                    ? 'linear-gradient(135deg, rgba(229,228,226,0.1), rgba(156,163,175,0.08))'
                    : quest.tier === 'gold' 
                    ? 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(251,191,36,0.05))' 
                    : quest.tier === 'silver'
                    ? 'rgba(192,192,192,0.08)'
                    : 'rgba(205,127,50,0.08)',
                  border: quest.claimed 
                    ? '1px solid rgba(255,255,255,0.05)' 
                    : quest.tier === 'platinum'
                    ? '1px solid rgba(229,228,226,0.3)'
                    : quest.tier === 'gold' 
                    ? '1px solid rgba(255,215,0,0.3)' 
                    : quest.tier === 'silver'
                    ? '1px solid rgba(192,192,192,0.3)'
                    : '1px solid rgba(205,127,50,0.3)',
                  opacity: quest.claimed ? 0.6 : 1
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    marginBottom: '8px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: quest.tier === 'platinum' ? 'linear-gradient(135deg, #E5E4E2, #9CA3AF)' 
                                : quest.tier === 'gold' ? 'linear-gradient(135deg, #FFD700, #FFA500)' 
                                : quest.tier === 'silver' ? 'linear-gradient(135deg, #C0C0C0, #808080)' 
                                : 'linear-gradient(135deg, #CD7F32, #8B4513)',
                      color: '#000',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                      textTransform: 'uppercase'
                    }}>
                      {quest.tier === 'platinum' ? '💠 Platinum' 
                      : quest.tier === 'gold' ? '⭐ Gold' 
                      : quest.tier === 'silver' ? '⚪ Silver' 
                      : '🟤 Bronze'}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: quest.difficulty === 'Cực khó' ? 'rgba(239,68,68,0.2)'
                                : quest.difficulty === 'Khó' ? 'rgba(245,158,11,0.2)'
                                : quest.difficulty === 'Trung bình' ? 'rgba(34,211,238,0.2)'
                                : 'rgba(34,197,94,0.2)',
                      color: quest.difficulty === 'Cực khó' ? '#EF4444'
                           : quest.difficulty === 'Khó' ? '#F59E0B'
                           : quest.difficulty === 'Trung bình' ? '#22D3EE'
                           : '#22C55E',
                      border: '1px solid ' + (quest.difficulty === 'Cực khó' ? '#EF4444'
                           : quest.difficulty === 'Khó' ? '#F59E0B'
                           : quest.difficulty === 'Trung bình' ? '#22D3EE'
                           : '#22C55E')
                    }}>
                      {quest.difficulty}
                    </div>
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 6px 0' }}>
                    {quest.title}
                  </h3>
                  <p style={{ 
                    fontSize: '14px', 
                    color: 'var(--color-muted)', 
                    margin: '0 0 12px 0' 
                  }}>
                    {quest.desc}
                  </p>
                  {quest.progress && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ 
                        fontSize: '12px', 
                        color: 'var(--color-muted)', 
                        marginBottom: '4px',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}>
                        <span>Tiến độ</span>
                        <span>{quest.progress.current}/{quest.progress.total}</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '6px',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${(quest.progress.current / quest.progress.total) * 100}%`,
                          height: '100%',
                          background: quest.tier === 'platinum' ? 'linear-gradient(90deg, #E5E4E2, #9CA3AF)'
                                    : quest.tier === 'gold' ? 'linear-gradient(90deg, #FFD700, #FFA500)'
                                    : quest.tier === 'silver' ? 'linear-gradient(90deg, #C0C0C0, #808080)'
                                    : 'linear-gradient(90deg, #CD7F32, #8B4513)',
                          transition: 'width 0.3s ease'
                        }}></div>
                      </div>
                    </div>
                  )}
                  <div className="quest-reward-pair">
                    {[
                      { key: 'exp', icon: 'EXP', value: quest.exp, label: 'Kinh nghiệm', activeColor: '#A78BFA' },
                      { key: 'gem', icon: '/gem.png', value: quest.gems, label: 'Nguyên Thần', activeColor: '#7DD3FC' },
                      { key: 'coin', icon: '/coin.png', value: quest.coins, label: 'Tinh Thạch', activeColor: '#FCD34D' }
                    ].map((reward) => (
                      <div
                        key={`${quest.id}-${reward.key}`}
                        className={`quest-reward-chip reward-${reward.key} ${reward.value <= 0 ? 'is-empty' : ''}`}
                        title={`${reward.label}: ${reward.value}`}
                      >
                        <span className="quest-reward-chip__icon">
                          {reward.key === 'exp' ? (
                            <span style={{ fontSize: '18px' }}>{reward.icon}</span>
                          ) : (
                            <img
                              src={reward.icon}
                              alt={reward.label}
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                          )}
                        </span>
                        <span
                          className="quest-reward-chip__value"
                          style={{ color: reward.value > 0 ? reward.activeColor : '#94A3B8' }}
                        >
                          {formatRewardValue(reward.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginLeft: '20px' }}>
                  {!quest.claimed ? (
                    <button
                      className="claim-button"
                      onClick={() => handleClaimQuest(quest)}
                      disabled={!(quest.progress && quest.progress.current >= quest.progress.total)}
                      style={{
                        padding: '12px 24px',
                        borderRadius: '10px',
                        border: 'none',
                        background: (quest.progress && quest.progress.current >= quest.progress.total)
                          ? 'linear-gradient(135deg, #22D3EE, #06B6D4)'
                          : 'linear-gradient(135deg, #94A3B8, #CBD5E1)',
                        color: 'white',
                        fontSize: '16px',
                        fontWeight: 700,
                        cursor: (quest.progress && quest.progress.current >= quest.progress.total) ? 'pointer' : 'not-allowed',
                        boxShadow: (quest.progress && quest.progress.current >= quest.progress.total)
                          ? '0 4px 12px rgba(34,211,238,0.4)'
                          : 'none',
                        opacity: (quest.progress && quest.progress.current >= quest.progress.total) ? 1 : 0.5,
                        transition: 'all 0.2s ease',
                        textTransform: 'uppercase'
                      }}
                      onMouseEnter={(e) => {
                        if (quest.progress && quest.progress.current >= quest.progress.total) {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(34,211,238,0.6)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (quest.progress && quest.progress.current >= quest.progress.total) {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(34,211,238,0.4)'
                        }
                      }}
                    >
                      Nhận
                    </button>
                  ) : (
                    <div style={{ 
                      color: '#4ADE80', 
                      fontSize: '16px',
                      fontWeight: 700,
                      padding: '12px 20px',
                      background: 'rgba(74,222,128,0.1)',
                      borderRadius: '10px',
                      border: '1px solid rgba(74,222,128,0.3)',
                      textAlign: 'center'
                    }}>
                      ✓ Đã nhận
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="panel glass-card" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--color-primary)' }}>
            ℹ️ Cấp độ nhiệm vụ
          </h3>
          <div style={{ fontSize: '14px', color: 'var(--color-muted)', lineHeight: '1.6' }}>
            <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(205,127,50,0.1)', borderRadius: '8px', border: '1px solid rgba(205,127,50,0.3)' }}>
              <strong style={{ color: '#CD7F32', fontSize: '13px' }}>🟤 BRONZE</strong>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', lineHeight: '1.5' }}>Nhiệm vụ cơ bản, dễ hoàn thành. Thưởng chủ yếu là Coin.</p>
            </div>
            <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(192,192,192,0.1)', borderRadius: '8px', border: '1px solid rgba(192,192,192,0.3)' }}>
              <strong style={{ color: '#C0C0C0', fontSize: '13px' }}>⚪ SILVER</strong>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', lineHeight: '1.5' }}>Nhiệm vụ trung bình, cần nỗ lực. Thưởng Coin + ít Gem.</p>
            </div>
            <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(255,215,0,0.1)', borderRadius: '8px', border: '1px solid rgba(255,215,0,0.3)' }}>
              <strong style={{ color: '#FFD700', fontSize: '13px' }}>⭐ GOLD</strong>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', lineHeight: '1.5' }}>Nhiệm vụ khó, thử thách kỹ năng. Thưởng lớn cả Coin và Gem.</p>
            </div>
            <div style={{ padding: '10px', background: 'linear-gradient(135deg, rgba(229,228,226,0.15), rgba(156,163,175,0.1))', borderRadius: '8px', border: '1px solid rgba(229,228,226,0.3)' }}>
              <strong style={{ color: '#E5E4E2', fontSize: '13px' }}>💠 PLATINUM</strong>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', lineHeight: '1.5' }}>Nhiệm vụ cực khó, chỉ cao thủ mới làm được. Phần thưởng khổng lồ!</p>
            </div>
          </div>
          
          <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(34,211,238,0.08)', borderRadius: '8px', border: '1px solid rgba(34,211,238,0.2)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#22D3EE', marginBottom: '8px' }}>
              💡 Mẹo
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: 'var(--color-muted)', lineHeight: '1.6' }}>
              <li>Nhấn "Nhận" để claim thưởng ngay lập tức</li>
              <li>Coin và Gem sẽ cập nhật vào tài khoản</li>
              <li>Nhiệm vụ hàng ngày reset vào 0h</li>
              <li>Nhiệm vụ hàng tuần reset vào thứ 2</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
