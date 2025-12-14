import React, { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { supabase } from '../lib/supabase'
import { useTitles } from '../hooks/useTitles'
import { TitleCard, EquippedTitleBadge } from '../components/title/TitleCard'
import { TITLE_CATEGORIES, TITLE_RARITIES, Title } from '../lib/titleApi'
import { MobileQuickSettings } from '../components/layout'

// Hook to detect mobile screen
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

export default function Titles() {
  const { t, language } = useLanguage()
  const isMobile = useIsMobile()
  const [userId, setUserId] = useState<string | undefined>()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedRarity, setSelectedRarity] = useState<string>('all')

  // Load user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id)
    })
  }, [])

  const {
    allTitles,
    userTitles,
    equippedTitle,
    stats,
    groupedTitles,
    loading,
    error,
    equip,
    unequip,
    isUnlocked,
    getUnlockedTitle
  } = useTitles(userId)

  // Filter titles
  const filteredTitles = allTitles.filter(title => {
    if (selectedCategory !== 'all' && title.category !== selectedCategory) return false
    if (selectedRarity !== 'all' && title.rarity !== selectedRarity) return false
    return true
  })

  // Group filtered titles
  const displayTitles = selectedCategory === 'all'
    ? Object.entries(groupedTitles)
    : [[selectedCategory, filteredTitles.filter(t => t.category === selectedCategory)]]

  if (loading) {
    return (
      <div className="app-container">
        <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
          {t('common.loading')}
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {/* Mobile Breadcrumb - Simple inline */}
      {isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 8px' }}>
          <span 
            style={{ fontSize: 13, color: '#94A3B8', cursor: 'pointer' }}
            onClick={() => window.location.hash = '#home'}
          >
            {t('breadcrumb.home')}
          </span>
          <span style={{ color: '#94A3B8' }}>›</span>
          <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 500 }}>
            {t('breadcrumb.titles')}
          </span>
        </div>
      )}
      
      <div className="titles-page" style={{ display: 'flex', gap: 18 }}>
        {/* Sidebar */}
        <aside className="panel" style={{ width: 280, flexShrink: 0 }}>
          {/* Stats */}
          {stats && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14 }}>{t('title.yourProgress')}</h3>
              
              <div style={{ 
                padding: 16, 
                borderRadius: 10, 
                background: 'rgba(34, 211, 238, 0.1)',
                marginBottom: 12
              }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#22D3EE' }}>
                  {stats.total_unlocked}/{stats.total_available}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  {t('title.titlesUnlocked')} ({stats.completion_percent}%)
                </div>
              </div>

              <div style={{ 
                padding: 12, 
                borderRadius: 8, 
                background: 'rgba(251, 191, 36, 0.1)',
                marginBottom: 12
              }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: '#FBB724' }}>
                  {stats.total_points}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                  {t('title.totalPoints')}
                </div>
              </div>

              {/* By rarity */}
              <div style={{ fontSize: 12, marginBottom: 8 }}>{t('title.byRarity')}:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(TITLE_RARITIES).map(([key, info]) => (
                  <div key={key} style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: info.color + '20',
                    color: info.color,
                    fontSize: 11
                  }}>
                    {stats.by_rarity[key] || 0} {language === 'vi' ? info.name_vi : info.name_en}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equipped title */}
          {equippedTitle?.titles && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14 }}>{t('title.currentTitle')}</h3>
              <EquippedTitleBadge title={equippedTitle.titles} size="large" />
              <button
                onClick={() => unequip()}
                style={{
                  marginTop: 8,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'var(--color-muted)',
                  fontSize: 11,
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                {t('title.unequip')}
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="shop-filters">
            <h3 style={{ margin: '0 0 12px 0', fontSize: 14 }}>{t('title.filter')}</h3>
            
            <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 4 }}>{t('title.category')}</label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ 
                width: '100%', 
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                color: 'var(--color-text)',
                fontSize: 13,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="all">{t('common.all')}</option>
              {Object.entries(TITLE_CATEGORIES).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.icon} {language === 'vi' ? info.name_vi : info.name_en}
                </option>
              ))}
            </select>

            <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 4 }}>{t('title.rarity')}</label>
            <select
              value={selectedRarity}
              onChange={e => setSelectedRarity(e.target.value)}
              style={{ 
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                color: 'var(--color-text)',
                fontSize: 13,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="all">{t('common.all')}</option>
              {Object.entries(TITLE_RARITIES).map(([key, info]) => (
                <option key={key} value={key}>
                  {language === 'vi' ? info.name_vi : info.name_en}
                </option>
              ))}
            </select>
          </div>
        </aside>

        {/* Main content */}
        <main className="panel" style={{ flex: 1 }}>
          {/* Breadcrumb */}
          <nav style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '13px', 
            color: 'var(--color-muted)',
            marginBottom: '12px'
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
              {t('breadcrumb.home')}
            </a>
            <span style={{ color: 'var(--color-muted)' }}>›</span>
            <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{t('breadcrumb.titles')}</span>
          </nav>

          <h2 style={{ margin: '0 0 20px 0' }}>
            🏆 {t('title.pageTitle')}
          </h2>

          {error && (
            <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, marginBottom: 16, color: '#EF4444' }}>
              {error}
            </div>
          )}

          {/* Title sections */}
          {(displayTitles as [string, Title[]][]).map(([category, titles]) => {
            if (!titles || titles.length === 0) return null
            const catInfo = TITLE_CATEGORIES[category as keyof typeof TITLE_CATEGORIES]
            const catName = catInfo ? (language === 'vi' ? catInfo.name_vi : catInfo.name_en) : category

            // Apply rarity filter
            const filtered = selectedRarity === 'all' 
              ? titles 
              : titles.filter((t: Title) => t.rarity === selectedRarity)

            if (filtered.length === 0) return null

            return (
              <section key={category} style={{ marginBottom: 24 }}>
                <h3 style={{ 
                  margin: '0 0 12px 0', 
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <span>{catInfo?.icon}</span>
                  <span>{catName}</span>
                  <span style={{ 
                    fontSize: 12, 
                    color: 'var(--color-muted)',
                    fontWeight: 400
                  }}>
                    ({filtered.filter((t: Title) => isUnlocked(t.id)).length}/{filtered.length})
                  </span>
                </h3>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 12
                }}>
                  {filtered.map((title: Title) => {
                    const unlocked = isUnlocked(title.id)
                    const userTitle = getUnlockedTitle(title.id)
                    const isEquipped = equippedTitle?.title_id === title.id

                    return (
                      <TitleCard
                        key={title.id}
                        title={title}
                        unlocked={unlocked}
                        equipped={isEquipped}
                        unlockedAt={userTitle?.unlocked_at}
                        onEquip={() => equip(title.id)}
                        onUnequip={() => unequip()}
                      />
                    )
                  })}
                </div>
              </section>
            )
          })}

          {filteredTitles.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>
              {t('title.noTitlesFound')}
            </div>
          )}
        </main>
      </div>
      
      {/* Mobile Quick Settings */}
      <MobileQuickSettings onOpenFullSettings={() => window.location.hash = '#profile'} />
    </div>
  )
}
