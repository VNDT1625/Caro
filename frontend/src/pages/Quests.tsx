import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'

interface Quest {
  id: string
  titleKey: string
  descKey: string
  target: number
  current: number
  reward: { coin: number; gem: number; exp?: number }
  claimed: boolean
}

interface QuestCategory {
  id: string
  icon: string
  nameKey: string
  badge?: number
  startDate?: string
  endDate?: string
  quests: Quest[]
}

// Quest definitions (static templates)
const QUEST_TEMPLATES: QuestCategory[] = [
  {
    id: 'login_dec',
    icon: '🌸',
    nameKey: 'events.loginDecember',
    startDate: '01/12/2025',
    endDate: '31/12/2025',
    quests: [
      { id: 'login1', titleKey: 'quests.loginDay1', descKey: 'quests.loginDay1Desc', target: 1, current: 0, reward: { coin: 50, gem: 0 }, claimed: false },
      { id: 'login2', titleKey: 'quests.loginDay2', descKey: 'quests.loginDay2Desc', target: 2, current: 0, reward: { coin: 100, gem: 0 }, claimed: false },
      { id: 'login3', titleKey: 'quests.loginDay3', descKey: 'quests.loginDay3Desc', target: 3, current: 0, reward: { coin: 150, gem: 5 }, claimed: false },
      { id: 'login5', titleKey: 'quests.loginDay5', descKey: 'quests.loginDay5Desc', target: 5, current: 0, reward: { coin: 250, gem: 10 }, claimed: false },
      { id: 'login7', titleKey: 'quests.loginDay7', descKey: 'quests.loginDay7Desc', target: 7, current: 0, reward: { coin: 500, gem: 20 }, claimed: false },
    ]
  },
  {
    id: 'daily',
    icon: '📅',
    nameKey: 'quests.daily',
    quests: [
      { id: 'daily_play1', titleKey: 'quests.playRanked', descKey: 'quests.playRankedDesc', target: 1, current: 0, reward: { coin: 50, gem: 30 }, claimed: false },
      { id: 'daily_win1', titleKey: 'quests.winMatch', descKey: 'quests.winMatchDesc', target: 1, current: 0, reward: { coin: 100, gem: 50 }, claimed: false },
      { id: 'daily_play3', titleKey: 'quests.playMatches', descKey: 'quests.playMatchesDesc', target: 3, current: 0, reward: { coin: 200, gem: 100, exp: 5 }, claimed: false },
      { id: 'daily_streak', titleKey: 'quests.winStreak', descKey: 'quests.winStreakDesc', target: 3, current: 0, reward: { coin: 300, gem: 200, exp: 10 }, claimed: false },
    ]
  },
  {
    id: 'weekly',
    icon: '📆',
    nameKey: 'quests.weekly',
    quests: [
      { id: 'weekly_play10', titleKey: 'quests.play10Matches', descKey: 'quests.play10MatchesDesc', target: 10, current: 0, reward: { coin: 500, gem: 200 }, claimed: false },
      { id: 'weekly_win5', titleKey: 'quests.win5Matches', descKey: 'quests.win5MatchesDesc', target: 5, current: 0, reward: { coin: 800, gem: 300, exp: 20 }, claimed: false },
      { id: 'weekly_login7', titleKey: 'quests.login7Days', descKey: 'quests.login7DaysDesc', target: 7, current: 0, reward: { coin: 1000, gem: 500, exp: 50 }, claimed: false },
    ]
  },
  {
    id: 'achievement',
    icon: '🏆',
    nameKey: 'quests.achievement',
    quests: [
      { id: 'ach_first_win', titleKey: 'quests.firstWin', descKey: 'quests.firstWinDesc', target: 1, current: 0, reward: { coin: 200, gem: 50 }, claimed: false },
      { id: 'ach_win10', titleKey: 'quests.win10Total', descKey: 'quests.win10TotalDesc', target: 10, current: 0, reward: { coin: 500, gem: 100 }, claimed: false },
      { id: 'ach_win50', titleKey: 'quests.win50Total', descKey: 'quests.win50TotalDesc', target: 50, current: 0, reward: { coin: 2000, gem: 500, exp: 100 }, claimed: false },
      { id: 'ach_win100', titleKey: 'quests.win100Total', descKey: 'quests.win100TotalDesc', target: 100, current: 0, reward: { coin: 5000, gem: 1000, exp: 200 }, claimed: false },
    ]
  }
]

export default function Quests() {
  const { t } = useLanguage()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('login_dec')
  const [categories, setCategories] = useState<QuestCategory[]>([])
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

  useEffect(() => {
    loadUser()
  }, [])

  // Check and update daily login streak
  async function checkDailyLogin(prof: any): Promise<any> {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const metadata = prof.metadata || {}
    const questsData = metadata.quests || {}
    const lastLoginDate = questsData.lastLoginDate

    // If already logged in today, skip update
    if (lastLoginDate === today) {
      return prof
    }

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    // Calculate consecutive logins
    let consecutiveLogins = questsData.consecutiveLogins || 0
    if (lastLoginDate === yesterdayStr) {
      consecutiveLogins += 1
    } else {
      consecutiveLogins = 1
    }

    // Calculate monthly logins (for login_dec)
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()
    let monthlyLogins = questsData.monthlyLogins || 0
    const lastLoginMonth = questsData.lastLoginMonth
    const lastLoginYear = questsData.lastLoginYear

    if (lastLoginMonth === currentMonth && lastLoginYear === currentYear) {
      monthlyLogins += 1
    } else {
      monthlyLogins = 1
    }

    // Calculate weekly logins
    const currentWeek = getWeekNumber(new Date())
    let weeklyLogins = questsData.weeklyLogins || 0
    const lastWeek = questsData.lastWeek

    if (lastWeek === currentWeek) {
      weeklyLogins += 1
    } else {
      weeklyLogins = 1
    }

    const newQuestsData = {
      ...questsData,
      lastLoginDate: today,
      consecutiveLogins,
      monthlyLogins,
      lastLoginMonth: currentMonth,
      lastLoginYear: currentYear,
      weeklyLogins,
      lastWeek: currentWeek
    }

    const newMetadata = { ...metadata, quests: newQuestsData }

    // Update database
    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update({ metadata: newMetadata })
      .eq('user_id', prof.user_id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update login streak:', error)
      return prof
    }

    console.log(`✅ Login streak updated: ${consecutiveLogins} days, Monthly: ${monthlyLogins}`)
    return updatedProfile
  }

  // Get week number (ISO week)
  function getWeekNumber(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    return `${d.getUTCFullYear()}-W${weekNo}`
  }

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
          // Check daily login and update streak
          const updatedProf = await checkDailyLogin(prof)
          setProfile(updatedProf)
          updateQuestProgress(updatedProf)
        }
      } else {
        // No user logged in - show empty quests
        initializeCategories({})
      }
    } catch (e) {
      console.error('Load user failed:', e)
      initializeCategories({})
    }
  }

  function initializeCategories(claimedQuests: Record<string, boolean>) {
    const cats = QUEST_TEMPLATES.map(cat => ({
      ...cat,
      quests: cat.quests.map(q => ({
        ...q,
        claimed: claimedQuests[q.id] || false
      }))
    }))
    setCategories(cats)
  }

  // Update quest progress from profile data
  function updateQuestProgress(prof: any) {
    const metadata = prof.metadata || {}
    const questsData = metadata.quests || {}
    const claimedQuests = questsData.claimed || {}

    // Get stats from questsData
    const consecutiveLogins = questsData.consecutiveLogins || 0
    const monthlyLogins = questsData.monthlyLogins || 0
    const weeklyLogins = questsData.weeklyLogins || 0

    // Daily stats - get from today's data
    const today = new Date().toISOString().split('T')[0]
    const todayMatches = questsData.lastMatchDate === today ? (questsData.todayMatches || 0) : 0
    const todayWins = questsData.lastMatchDate === today ? (questsData.todayWins || 0) : 0
    const winStreak = questsData.currentWinStreak || 0

    // Weekly stats
    const currentWeek = getWeekNumber(new Date())
    const weeklyMatches = questsData.lastWeek === currentWeek ? (questsData.weeklyMatches || 0) : 0
    const weeklyWins = questsData.lastWeek === currentWeek ? (questsData.weeklyWins || 0) : 0

    // Lifetime stats
    const totalWins = prof.total_wins || 0

    const updatedCategories = QUEST_TEMPLATES.map(cat => {
      const updatedQuests = cat.quests.map(quest => {
        let current = 0
        const claimed = claimedQuests[quest.id] === true

        // Calculate current progress based on quest type
        switch (quest.id) {
          // Login December (monthly logins)
          case 'login1':
          case 'login2':
          case 'login3':
          case 'login5':
          case 'login7':
            current = monthlyLogins
            break

          // Daily quests
          case 'daily_play1':
            current = todayMatches >= 1 ? 1 : 0
            break
          case 'daily_win1':
            current = todayWins >= 1 ? 1 : 0
            break
          case 'daily_play3':
            current = todayMatches
            break
          case 'daily_streak':
            current = winStreak
            break

          // Weekly quests
          case 'weekly_play10':
            current = weeklyMatches
            break
          case 'weekly_win5':
            current = weeklyWins
            break
          case 'weekly_login7':
            current = weeklyLogins
            break

          // Achievements (lifetime)
          case 'ach_first_win':
            current = totalWins >= 1 ? 1 : 0
            break
          case 'ach_win10':
          case 'ach_win50':
          case 'ach_win100':
            current = totalWins
            break

          default:
            current = 0
        }

        return { ...quest, current, claimed }
      })

      // Calculate badge (unclaimed completable quests)
      const badge = updatedQuests.filter(q => q.current >= q.target && !q.claimed).length

      return { ...cat, quests: updatedQuests, badge: badge > 0 ? badge : undefined }
    })

    setCategories(updatedCategories)
  }

  async function claimReward(categoryId: string, questId: string) {
    if (!user || !profile) return

    const category = categories.find(c => c.id === categoryId)
    const quest = category?.quests.find(q => q.id === questId)
    if (!quest || quest.claimed || quest.current < quest.target) return

    // Prevent double-click
    if (claimingId) return
    setClaimingId(questId)

    try {
      // Calculate new values
      const coinReward = quest.reward.coin || 0
      const gemReward = quest.reward.gem || 0
      const newCoins = (profile.coins || 0) + coinReward
      const newGems = (profile.gems || 0) + gemReward

      // Build updated quest tracking data
      const metadata = profile.metadata || {}
      const questsData = { ...(metadata.quests || {}) }
      const claimedQuests = { ...(questsData.claimed || {}) }
      claimedQuests[questId] = true
      questsData.claimed = claimedQuests

      const newMetadata = { ...metadata, quests: questsData }

      // Update database
      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update({
          coins: newCoins,
          gems: newGems,
          metadata: newMetadata
        })
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Failed to claim reward:', error)
        setClaimingId(null)
        return
      }

      console.log(`✅ Quest Claimed: +${coinReward} coins, +${gemReward} gems`)

      // Update local profile state
      setProfile(updatedProfile)

      // Update local categories state
      setCategories(prev => prev.map(cat => {
        if (cat.id !== categoryId) return cat
        const quests = cat.quests.map(q => q.id === questId ? { ...q, claimed: true } : q)
        const badge = quests.filter(q => q.current >= q.target && !q.claimed).length
        return { ...cat, quests, badge: badge > 0 ? badge : undefined }
      }))

      // Update header currency display
      window.dispatchEvent(new CustomEvent('profileUpdated', {
        detail: {
          field: 'currency',
          coins: updatedProfile.coins,
          gems: updatedProfile.gems
        }
      }))

      setClaimingId(null)

    } catch (e) {
      console.error('Claim reward failed:', e)
      setClaimingId(null)
    }
  }

  const selectedCategory = categories.find(c => c.id === selectedCategoryId)

  return (
    <div className="app-container">
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '12px' : '16px',
        height: isMobile ? 'auto' : 'calc(100vh - 140px)',
        minHeight: isMobile ? 'auto' : '500px'
      }}>
        {/* Left Sidebar - Quest Categories */}
        <aside className="panel" style={{
          width: isMobile ? '100%' : '240px',
          minWidth: isMobile ? 'auto' : '240px',
          padding: 0,
          overflow: 'hidden',
          display: isMobile && showDetail ? 'none' : 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          {/* Mobile Breadcrumb */}
          {isMobile && (
            <nav style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: 'var(--color-muted)',
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(0,0,0,0.2)'
            }}>
              <span 
                onClick={() => window.location.hash = '#home'} 
                style={{ color: 'var(--color-muted)', textDecoration: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-muted)'}
              >
                {t('breadcrumb.home')}
              </span>
              <span>›</span>
              <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{t('quests.title')}</span>
            </nav>
          )}

          {/* Sidebar Header */}
          <div style={{
            padding: '16px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(139,92,246,0.04))'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 700,
              color: '#A855F7',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              📋 {t('quests.title')}
            </h2>
            <p style={{
              margin: '6px 0 0 0',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.5)'
            }}>
              {t('quests.subtitle')}
            </p>
          </div>

          {/* Category List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px'
          }}>
            {categories.map((category) => {
              const isSelected = selectedCategoryId === category.id
              return (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategoryId(category.id)
                    if (isMobile) setShowDetail(true)
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    marginBottom: '4px',
                    background: isSelected
                      ? 'linear-gradient(90deg, rgba(168,85,247,0.12), rgba(139,92,246,0.08))'
                      : 'transparent',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    textAlign: 'left',
                    borderLeft: isSelected ? '3px solid #A855F7' : '3px solid transparent'
                  }}
                >
                  {/* Icon Container */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(139,92,246,0.15))'
                        : 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      border: isSelected
                        ? '1px solid rgba(168,85,247,0.4)'
                        : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: isSelected ? '0 4px 12px rgba(168,85,247,0.2)' : 'none',
                      transition: 'all 0.2s ease'
                    }}>
                      {category.icon}
                    </div>
                    {/* Badge */}
                    {category.badge && category.badge > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '-5px',
                        right: '-5px',
                        background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: 700,
                        minWidth: '18px',
                        height: '18px',
                        padding: '0 4px',
                        borderRadius: '9px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid var(--color-bg)',
                        boxShadow: '0 2px 6px rgba(239,68,68,0.4)'
                      }}>
                        {category.badge}
                      </div>
                    )}
                  </div>

                  {/* Category Name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? '#A855F7' : 'var(--color-text)',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      transition: 'color 0.2s ease'
                    }}>
                      {t(category.nameKey)}
                    </div>
                    {category.startDate && (
                      <div style={{
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.4)',
                        marginTop: '2px'
                      }}>
                        {category.startDate} ~ {category.endDate}
                      </div>
                    )}
                  </div>

                  {/* Arrow indicator */}
                  {isSelected && (
                    <div style={{
                      color: '#A855F7',
                      fontSize: '12px',
                      opacity: 0.6
                    }}>›</div>
                  )}
                </button>
              )
            })}
          </div>
        </aside>

        {/* Right Content - Quest Details */}
        <main className="panel" style={{
          flex: 1,
          display: isMobile && !showDetail ? 'none' : 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0
        }}>
          {selectedCategory && (
            <>
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

              {/* Breadcrumb + Time */}
              <nav style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: 'var(--color-muted)',
                marginBottom: '16px',
                flexWrap: isMobile ? 'wrap' : 'nowrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span 
                    onClick={() => window.location.hash = '#home'} 
                    style={{ color: 'var(--color-muted)', textDecoration: 'none', cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-muted)'}
                  >
                    {t('breadcrumb.home')}
                  </span>
                  <span>›</span>
                  <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{t('quests.title')}</span>
                </div>
                {selectedCategory.startDate && (
                  <div style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    background: 'rgba(168,85,247,0.1)',
                    border: '1px solid rgba(168,85,247,0.2)',
                    borderRadius: '20px',
                    color: '#A855F7',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span>⏰</span>
                    <span>{selectedCategory.startDate} ~ {selectedCategory.endDate}</span>
                  </div>
                )}
              </nav>

              {/* Category Title */}
              <div style={{ marginBottom: isMobile ? '14px' : '20px' }}>
                <h2 style={{
                  margin: 0,
                  fontSize: isMobile ? '20px' : '26px',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #A855F7, #8B5CF6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? '8px' : '12px'
                }}>
                  <span style={{
                    fontSize: isMobile ? '24px' : '32px',
                    WebkitTextFillColor: 'initial',
                    filter: 'drop-shadow(0 2px 8px rgba(168,85,247,0.3))'
                  }}>{selectedCategory.icon}</span>
                  {t(selectedCategory.nameKey)}
                </h2>
              </div>

              {/* Quest List */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                marginRight: '-8px',
                paddingRight: '8px'
              }}>
                {selectedCategory.quests.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '300px',
                    color: 'var(--color-muted)',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '16px',
                    border: '1px dashed rgba(255,255,255,0.1)'
                  }}>
                    <div style={{ fontSize: '56px', marginBottom: '16px', opacity: 0.6 }}>🚧</div>
                    <div style={{ fontSize: '16px', fontWeight: 500 }}>{t('events.comingSoon')}</div>
                    <div style={{ fontSize: '13px', marginTop: '8px', opacity: 0.6 }}>{t('events.stayTuned')}</div>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {selectedCategory.quests.map((quest, index) => {
                      const progress = Math.min((quest.current / quest.target) * 100, 100)
                      const canClaim = quest.current >= quest.target && !quest.claimed

                      return (
                        <div
                          key={quest.id}
                          data-tour={index === 0 ? 'first-quest' : undefined}
                          style={{
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            alignItems: isMobile ? 'stretch' : 'center',
                            gap: isMobile ? '10px' : '16px',
                            padding: isMobile ? '12px' : '14px 18px',
                            minHeight: isMobile ? 'auto' : '64px',
                            background: quest.claimed
                              ? 'rgba(255,255,255,0.01)'
                              : canClaim
                              ? 'linear-gradient(90deg, rgba(168,85,247,0.06), rgba(139,92,246,0.04))'
                              : 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                            borderRadius: '12px',
                            border: canClaim
                              ? '1px solid rgba(168,85,247,0.25)'
                              : '1px solid rgba(255,255,255,0.05)',
                            opacity: quest.claimed ? 0.5 : 1,
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            overflow: 'hidden',
                            boxSizing: 'border-box'
                          }}
                        >
                          {/* Glow effect for claimable */}
                          {canClaim && (
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: '1px',
                              background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.5), transparent)'
                            }} />
                          )}

                          {/* Top row: Icon + Info */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px', width: '100%' }}>
                            {/* Quest Icon/Number */}
                            <div style={{
                              width: isMobile ? '36px' : '40px',
                              height: isMobile ? '36px' : '40px',
                              borderRadius: '10px',
                              background: canClaim
                                ? 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(139,92,246,0.15))'
                                : 'rgba(255,255,255,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: isMobile ? '14px' : '16px',
                              fontWeight: 700,
                              color: canClaim ? '#A855F7' : 'var(--color-muted)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              flexShrink: 0
                            }}>
                              {quest.claimed ? '✓' : index + 1}
                            </div>

                            {/* Quest Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: isMobile ? '13px' : '14px',
                                fontWeight: 600,
                                color: 'var(--color-text)',
                                marginBottom: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: isMobile ? 'wrap' : 'nowrap'
                              }}>
                                <span style={{
                                  overflow: isMobile ? 'visible' : 'hidden',
                                  textOverflow: isMobile ? 'unset' : 'ellipsis',
                                  whiteSpace: isMobile ? 'normal' : 'nowrap',
                                  wordBreak: isMobile ? 'break-word' : 'normal',
                                  flex: isMobile ? '1 1 100%' : 'unset'
                                }}>{t(quest.titleKey)}</span>
                                <span style={{
                                  fontSize: '12px',
                                  color: canClaim ? '#A855F7' : 'var(--color-muted)',
                                  fontWeight: 500,
                                  flexShrink: 0
                                }}>
                                  {quest.current}/{quest.target}
                                </span>
                              </div>

                              {/* Progress Bar */}
                              <div style={{
                                width: '100%',
                                height: '4px',
                                background: 'rgba(255,255,255,0.08)',
                                borderRadius: '2px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${progress}%`,
                                  height: '100%',
                                  background: canClaim
                                    ? 'linear-gradient(90deg, #A855F7, #8B5CF6)'
                                    : quest.claimed
                                    ? 'rgba(74,222,128,0.5)'
                                    : 'linear-gradient(90deg, #64748B, #475569)',
                                  borderRadius: '2px',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </div>
                          </div>

                          {/* Bottom row: Rewards + Button */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isMobile ? 'space-between' : 'flex-end',
                            gap: isMobile ? '10px' : '16px',
                            width: '100%'
                          }}>
                          {/* Reward Preview */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: isMobile ? '6px 10px' : '8px 14px',
                            background: 'rgba(0,0,0,0.15)',
                            borderRadius: '8px',
                            flexShrink: 0
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {quest.reward.coin > 0 && (
                                <div style={{
                                  fontSize: '13px',
                                  color: '#FBBF24',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <img src="/coin.png" alt="" style={{ width: '16px', height: '16px' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                                  <span>{quest.reward.coin}</span>
                                </div>
                              )}
                              {quest.reward.gem > 0 && (
                                <div style={{
                                  fontSize: '13px',
                                  color: '#22D3EE',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <img src="/gem.png" alt="" style={{ width: '16px', height: '16px' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                                  <span>{quest.reward.gem}</span>
                                </div>
                              )}
                              {quest.reward.exp && quest.reward.exp > 0 && (
                                <div style={{
                                  fontSize: '13px',
                                  color: '#4ADE80',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <span>⭐</span>
                                  <span>{quest.reward.exp}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          <button
                            data-tour={quest.id === 'login1' ? 'claim-quest' : undefined}
                            onClick={() => canClaim && !claimingId && claimReward(selectedCategory.id, quest.id)}
                            disabled={!canClaim || quest.claimed || claimingId === quest.id}
                            style={{
                              padding: isMobile ? '8px 14px' : '10px 20px',
                              borderRadius: '8px',
                              border: 'none',
                              background: quest.claimed
                                ? 'rgba(74,222,128,0.15)'
                                : claimingId === quest.id
                                ? 'rgba(168,85,247,0.3)'
                                : canClaim
                                ? 'linear-gradient(135deg, #A855F7, #8B5CF6)'
                                : 'rgba(255,255,255,0.06)',
                              color: quest.claimed
                                ? '#4ADE80'
                                : canClaim
                                ? 'white'
                                : 'var(--color-muted)',
                              fontSize: isMobile ? '12px' : '13px',
                              fontWeight: 600,
                              cursor: canClaim && !claimingId ? 'pointer' : 'default',
                              minWidth: isMobile ? '64px' : '72px',
                              transition: 'all 0.2s ease',
                              boxShadow: canClaim && !claimingId ? '0 4px 15px rgba(168,85,247,0.35)' : 'none',
                              flexShrink: 0,
                              opacity: claimingId === quest.id ? 0.7 : 1
                            }}
                            onMouseEnter={(e) => {
                              if (canClaim && !claimingId) {
                                e.currentTarget.style.transform = 'translateY(-2px)'
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(168,85,247,0.5)'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (canClaim && !claimingId) {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = '0 4px 15px rgba(168,85,247,0.35)'
                              }
                            }}
                          >
                            {quest.claimed
                              ? '✓ ' + t('events.claimed')
                              : claimingId === quest.id
                              ? '...'
                              : canClaim
                              ? t('events.claim')
                              : t('events.go')}
                          </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
